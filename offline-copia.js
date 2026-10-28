"use strict";

/**
 * offline-copia.js
 * @version 1.0.0
 * @author Ruda Gabriel
 * @description Cópia offline do banco do Small Commerce (Relatórios SmallSoft Offline).
 *
 * O relatório não precisa ler o banco principal (SMALL.FDB) ao vivo: ele lê uma
 * CÓPIA local, que este módulo mantém atualizada sozinho. Assim o relatório
 * continua abrindo quando o banco principal está sendo atualizado, em
 * manutenção, travado ou fora do ar — e o banco principal nunca é alterado.
 *
 * Como a cópia é feita (sempre pelo próprio Firebird, nunca copiando o arquivo
 * aberto — copiar um .FDB em uso gera arquivo corrompido):
 *   1. gbak -b -g  host:SMALL.FDB  →  copia.fbk.tmp
 *      Backup lógico pelo servidor Firebird. É uma LEITURA: roda numa transação
 *      de foto (snapshot) e, com -g, não faz nem a coleta de lixo — nenhuma
 *      página do banco principal é alterada.
 *   2. gbak -c -mode read_only  copia.fbk.tmp  →  SMALL_OFFLINE_AAAAMMDD_HHMMSS.FDB
 *      Restaura num arquivo NOVO, marcado como SOMENTE LEITURA no próprio
 *      Firebird (nem o sistema consegue gravar nele).
 *   3. Confere a cópia nova (conecta e lê o catálogo e a tabela NFCE).
 *   4. Só então troca a leitura para ela (troca atômica: o manifesto é gravado
 *      em .tmp e renomeado). A cópia anterior é apagada quando o Firebird a
 *      soltar. Qualquer falha em qualquer etapa descarta os temporários e
 *      mantém a cópia que já estava em uso — nunca fica sem cópia válida.
 *
 * Quando atualizar a cópia (tudo automático):
 *   - a cada `verificarMs` uma consulta leve (somente leitura) tira a
 *     "assinatura" das vendas do dia no banco principal; mudou → nova cópia,
 *     respeitando o intervalo mínimo entre cópias (`intervaloMinMs`, que também
 *     cresce sozinho para 3× a duração da última cópia — nunca ocupa o banco do
 *     caixa mais que 1/3 do tempo);
 *   - a cada `maxIdadeMs` mesmo sem mudança detectada (cobre alteração em
 *     outros dias);
 *   - ao pedir "Atualizar cópia agora" (bandeja, tela, API).
 *
 * Modos (`modo`):
 *   "copia"     — padrão: o relatório lê SEMPRE a cópia offline.
 *   "hibrido"   — lê o banco principal ao vivo enquanto ele responde; quando
 *                 ele cai/entra em manutenção, passa sozinho para a cópia e
 *                 volta quando ele responder de novo.
 *   "desligado" — sem cópia: lê o banco principal direto (como o sistema SSH).
 *
 * Sem gbak ou sem Firebird local para abrir a cópia, o módulo informa o motivo
 * no status/log e o sistema segue lendo o banco principal direto (somente
 * leitura), sem parar.
 *
 * Este arquivo não depende de nada do servidor: tudo chega por `opcoes`
 * (o que também permite testá-lo isolado, com gbak e Firebird simulados).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");
const net = require("net");

const VERSAO = "1.0.0";
const MANIFESTO = "copia-offline.json";
const PREFIXO = "SMALL_OFFLINE_";
// Únicos nomes que este módulo cria — e os ÚNICOS que ele apaga.
const RE_COPIA = /^SMALL_OFFLINE_\d{8}_\d{6}(?:_\d+)?\.FDB$/i;
const RE_TEMP = /^SMALL_OFFLINE_.*\.(?:tmp|fbk\.tmp|FDB\.tmp)$/i;
const FBK_ULTIMO = "ultimo-backup.fbk";

const _p2 = n => String(n).padStart(2, "0");
const _carimbo = d => d.getFullYear() + _p2(d.getMonth() + 1) + _p2(d.getDate()) + "_" + _p2(d.getHours()) + _p2(d.getMinutes()) + _p2(d.getSeconds());
const _faixa = (v, min, max, padrao) => { const n = Number(v); return isFinite(n) && n >= min && n <= max ? n : padrao; };
const _txt = (v, max) => String(v == null ? "" : v).replace(/[\r\n\t]+/g, " ").replace(/\s+/g, " ").trim().slice(0, max || 400);
const _norm = p => String(p || "").replace(/\//g, "\\").replace(/\\+$/, "").toUpperCase();
const _ehLocal = h => { const s = String(h || "").trim().toLowerCase(); return !s || s === "127.0.0.1" || s === "localhost" || s === "::1"; };

// Caminho de banco com host para o gbak: "host:C:\..." (porta fora do padrão: "host/porta:C:\...").
const _alvoGbak = (host, porta, arquivo) => (host || "127.0.0.1") + (porta && Number(porta) !== 3050 ? "/" + porta : "") + ":" + arquivo;

/**
 * Mensagem amigável para os erros mais comuns do gbak/Firebird.
 */
function explicarErro(msg) {
    const s = String(msg || "");
    if (/unavailable database|connection refused|ECONNREFUSED|failed to establish|network (?:error|request)/i.test(s)) return "Firebird não respondeu (serviço parado ou porta 3050 bloqueada).";
    if (/shutdown|is in use|lock time-?out|object .* in use/i.test(s)) return "Banco principal em manutenção ou bloqueado por outro programa (shutdown/uso exclusivo).";
    if (/I\/O error|No such file|cannot find|not found|does not exist|ENOENT/i.test(s)) return "Arquivo do banco não encontrado ou inacessível.";
    if (/password|user name|login|not defined as/i.test(s)) return "Usuário ou senha do Firebird recusados (fbUser/fbPass no config.json).";
    if (/access to database .* not allowed|DatabaseAccess/i.test(s)) return "O Firebird local não permite criar a cópia nesta pasta (firebird.conf: DatabaseAccess).";
    if (/space|disk full|ENOSPC/i.test(s)) return "Disco cheio.";
    if (/unsupported on-disk structure|ODS|wrong version/i.test(s)) return "Versão do Firebird local incompatível com o backup (use o gbak da mesma versão do servidor).";
    if (/tempo esgotado|timeout/i.test(s)) return "A cópia demorou mais que o limite (offlineTimeoutMin).";
    return "";
}

/**
 * Procura o gbak.exe: config → serviço do Firebird em execução → pastas
 * conhecidas → PATH. Devolve "" se não achar. Síncrona (só no início).
 */
function localizarGbak(preferido, log) {
    const existe = p => { try { return !!p && fs.statSync(p).isFile(); } catch (_) { return false; } };
    if (preferido && existe(preferido)) return preferido;
    const nome = process.platform === "win32" ? "gbak.exe" : "gbak";
    const cands = [];
    if (process.platform === "win32") {
        // Pasta do serviço Firebird em execução: o gbak certo é o da MESMA versão do servidor.
        try {
            const out = cp.execFileSync("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command",
                "Get-CimInstance Win32_Service | Where-Object { $_.Name -like 'Firebird*' -and $_.State -eq 'Running' } | ForEach-Object { $_.PathName }"],
                { encoding: "utf8", timeout: 8000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
            String(out || "").split(/\r?\n/).forEach(l => {
                const m = l.match(/^\s*"?([^"]+?\.exe)"?/i);
                if (m) cands.push(path.join(path.dirname(m[1]), nome));
            });
        } catch (_) {}
        const raizes = [process.env["ProgramFiles"], process.env["ProgramFiles(x86)"], "C:\\Program Files", "C:\\Program Files (x86)"].filter(Boolean);
        raizes.forEach(r => {
            ["Firebird_5_0", "Firebird_4_0", "Firebird_3_0", "Firebird_2_5", "Firebird_2_1"].forEach(v => cands.push(path.join(r, "Firebird", v, "bin", nome), path.join(r, "Firebird", v, nome)));
            try {
                fs.readdirSync(path.join(r, "Firebird")).forEach(d => cands.push(path.join(r, "Firebird", d, "bin", nome), path.join(r, "Firebird", d, nome)));
            } catch (_) {}
            cands.push(path.join(r, "SmallSoft", "Small Commerce", "Firebird", "bin", nome));
        });
    } else {
        cands.push("/opt/firebird/bin/gbak", "/usr/bin/gbak", "/usr/local/bin/gbak");
    }
    for (const c of cands) if (existe(c)) return c;
    try {
        const out = cp.execFileSync(process.platform === "win32" ? "where" : "which", [nome], { encoding: "utf8", timeout: 5000, windowsHide: true, stdio: ["ignore", "pipe", "ignore"] });
        const p = String(out || "").split(/\r?\n/).map(s => s.trim()).find(existe);
        if (p) return p;
    } catch (_) {}
    if (log) log("gbak não encontrado (Firebird não instalado nesta máquina?) — a cópia offline fica desativada; o relatório lê o banco principal direto.");
    return "";
}

/** Pasta padrão das cópias: local (o Firebird não abre banco em pasta de rede). */
function pastaPadrao(appName) {
    const base = process.platform === "win32"
        ? (process.env.ProgramData || "C:\\ProgramData")
        : path.join(os.homedir(), ".local", "share");
    const nome = String(appName || "Relatorios SmallSoft Offline").replace(/[^A-Za-z0-9 _-]+/g, "").trim() || "Relatorios SmallSoft Offline";
    return path.join(base, nome.replace(/\s+/g, ""), "copias");
}

/**
 * Cria o gerenciador.
 * opcoes:
 *   pasta, gbak, user, pass, porta, charset, modo,
 *   Firebird           — node-firebird JÁ BLINDADO (somente leitura)
 *   fonte()            — {host, path} do banco principal atual
 *   assinatura(host, path, cb(err, sig))  — consulta leve das vendas do dia
 *   aoTrocar(host, path, info)            — o servidor passa a ler daqui
 *   log(msg), logDebug(msg)
 *   intervaloMinMs, verificarMs, maxIdadeMs, timeoutMs, manterFbk
 */
function criarCopiaOffline(opcoes) {
    const o = Object.assign({}, opcoes || {});
    const log = typeof o.log === "function" ? o.log : () => {};
    const logDebug = typeof o.logDebug === "function" ? o.logDebug : () => {};
    const MODOS = ["copia", "hibrido", "desligado"];
    let modo = MODOS.indexOf(String(o.modo || "").toLowerCase()) >= 0 ? String(o.modo).toLowerCase() : "copia";
    const pasta = path.resolve(String(o.pasta || pastaPadrao(o.appName)));
    const porta = o.porta || 3050;
    let intervaloMinMs = _faixa(o.intervaloMinMs, 30000, 24 * 3600000, 5 * 60000);
    let verificarMs = _faixa(o.verificarMs, 5000, 3600000, 20000);
    let maxIdadeMs = _faixa(o.maxIdadeMs, 5 * 60000, 7 * 24 * 3600000, 180 * 60000);
    let timeoutMs = _faixa(o.timeoutMs, 60000, 6 * 3600000, 30 * 60000);
    const manterFbk = o.manterFbk !== false;
    const gbak = String(o.gbak || "");
    const manifestoArq = path.join(pasta, MANIFESTO);

    // ── Estado ──────────────────────────────────────────────────────────────
    const st = {
        ativa: null,           // { arquivo, host, dadosDe, criadaEm, origem, fonte, tamanho, sig, duracaoMs }
        lendo: "fonte",        // "fonte" | "copia"
        fonteOk: null,         // null = ainda não verificada
        fonteErro: "",
        fonteDesde: 0,         // desde quando está no estado atual (ok ou com erro)
        falhasFonte: 0,
        ultimaSig: null,       // última assinatura lida do banco principal
        ultimaVerificacao: 0,
        emAndamento: false,
        etapa: "",
        etapaDesde: 0,
        ultimaTentativa: 0,
        ultimoErro: "",
        ultimoOk: 0,
        ultimaDuracaoMs: 0,
        proximaPermitida: 0,
        pedidoManual: false,
        indisponivel: "",      // motivo de a cópia não poder ser feita (sem gbak etc.)
        pendentesApagar: []    // cópias antigas esperando o Firebird soltar o arquivo
    };
    let timerVerif = null, timerApagar = null, filhoAtual = null, parado = true, geracao = 0;

    // ── Manifesto (gravação atômica) ────────────────────────────────────────
    const gravarManifesto = () => {
        const dados = JSON.stringify({ versao: 1, modulo: VERSAO, ativa: st.ativa, pendentesApagar: st.pendentesApagar }, null, 2);
        const tmp = manifestoArq + ".tmp" + process.pid;
        try { fs.writeFileSync(tmp, dados, "utf8"); fs.renameSync(tmp, manifestoArq); return true; }
        catch (e) {
            try { fs.writeFileSync(manifestoArq, dados, "utf8"); return true; } catch (_) {}
            try { fs.unlinkSync(tmp); } catch (_) {}
            log("Não consegui gravar o manifesto da cópia offline: " + _txt(e && e.message));
            return false;
        }
    };
    const lerManifesto = () => {
        try {
            const m = JSON.parse(fs.readFileSync(manifestoArq, "utf8"));
            const a = m && m.ativa;
            if (a && typeof a.arquivo === "string" && RE_COPIA.test(path.basename(a.arquivo)) && fs.existsSync(path.join(pasta, path.basename(a.arquivo)))) {
                a.arquivo = path.join(pasta, path.basename(a.arquivo)); // sempre dentro da pasta (manifesto movido/editado)
                st.ativa = a;
            }
            if (m && Array.isArray(m.pendentesApagar)) st.pendentesApagar = m.pendentesApagar.filter(n => RE_COPIA.test(String(n || "")));
        } catch (_) {}
    };

    const garantirPasta = () => {
        try { fs.mkdirSync(pasta, { recursive: true }); } catch (e) { return "Não consegui criar a pasta das cópias (" + pasta + "): " + _txt(e && e.message); }
        // O arquivo restaurado pertence à conta do serviço do Firebird; o usuário
        // precisa poder apagá-lo depois. Quem cria a pasta já pode (CREATOR OWNER),
        // mas reforça dando "modificar" ao grupo Usuários (melhor esforço).
        if (process.platform === "win32") {
            try { cp.execFile("icacls", [pasta, "/grant", "*S-1-5-32-545:(OI)(CI)M", "/Q"], { windowsHide: true, timeout: 15000 }, () => {}); } catch (_) {}
        }
        try { const t = path.join(pasta, ".teste-escrita" + process.pid); fs.writeFileSync(t, "ok"); fs.unlinkSync(t); }
        catch (e) { return "Sem permissão de escrita na pasta das cópias (" + pasta + "): " + _txt(e && e.message); }
        return "";
    };

    // Proteção máxima: o caminho a apagar tem que estar NA pasta das cópias, ter
    // o nome que só este módulo cria e não ser o banco principal nem a cópia em uso.
    const podeApagar = arq => {
        const base = path.basename(String(arq || ""));
        if (!RE_COPIA.test(base) && !RE_TEMP.test(base) && base !== FBK_ULTIMO + ".tmp") return false;
        if (_norm(path.dirname(path.resolve(arq))) !== _norm(pasta)) return false;
        const f = typeof o.fonte === "function" ? (o.fonte() || {}) : {};
        if (f.path && _norm(f.path) === _norm(arq)) return false;
        if (st.ativa && _norm(st.ativa.arquivo) === _norm(arq)) return false;
        return true;
    };
    const apagar = arq => {
        if (!podeApagar(arq)) return true; // nunca apaga o que não é seu — e não insiste
        try { fs.unlinkSync(arq); return true; }
        catch (e) { return !!(e && e.code === "ENOENT"); }
    };
    // Tenta apagar as cópias antigas; o Firebird pode segurar o arquivo por um tempo.
    const processarPendentes = () => {
        const antes = st.pendentesApagar.length;
        st.pendentesApagar = st.pendentesApagar.filter(n => !apagar(path.join(pasta, n)));
        if (st.pendentesApagar.length !== antes) gravarManifesto();
        clearTimeout(timerApagar);
        if (st.pendentesApagar.length && !parado) { timerApagar = setTimeout(processarPendentes, 30000); if (timerApagar.unref) timerApagar.unref(); }
    };
    // Limpeza no início: temporários de uma cópia interrompida e cópias que o
    // manifesto não usa mais.
    const limparOrfaos = () => {
        let lista = [];
        try { lista = fs.readdirSync(pasta); } catch (_) { return; }
        const ativa = st.ativa ? path.basename(st.ativa.arquivo).toUpperCase() : "";
        lista.forEach(n => {
            if (RE_TEMP.test(n) || n === FBK_ULTIMO + ".tmp") { apagar(path.join(pasta, n)); return; }
            if (RE_COPIA.test(n) && n.toUpperCase() !== ativa && st.pendentesApagar.indexOf(n) < 0) st.pendentesApagar.push(n);
        });
        processarPendentes();
    };

    // ── Execução do gbak (credenciais por variável de ambiente) ─────────────
    const rodarGbak = (args, rotulo, cb) => {
        const env = Object.assign({}, process.env, { ISC_USER: o.user || "SYSDBA", ISC_PASSWORD: o.pass || "masterkey" });
        let saida = "", fim = false, filho;
        const concluir = (err) => {
            if (fim) return; fim = true;
            clearTimeout(tmo);
            if (filhoAtual === filho) filhoAtual = null;
            cb(err, saida);
        };
        const tmo = setTimeout(() => {
            matarFilho(filho);
            concluir(new Error("tempo esgotado em " + rotulo + " (" + Math.round(timeoutMs / 60000) + " min)"));
        }, timeoutMs);
        try {
            // gbak em .js = gbak simulado dos testes automáticos (roda pelo próprio Node).
            filho = /\.js$/i.test(gbak)
                ? cp.spawn(process.execPath, [gbak].concat(args), { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
                : cp.spawn(gbak, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) { concluir(e); return; }
        filhoAtual = filho;
        // Prioridade baixa: o caixa (Small Commerce) tem preferência na máquina.
        try { if (filho.pid && os.setPriority) os.setPriority(filho.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
        const juntar = b => { saida += String(b || ""); if (saida.length > 20000) saida = saida.slice(-20000); };
        if (filho.stdout) filho.stdout.on("data", juntar);
        if (filho.stderr) filho.stderr.on("data", juntar);
        filho.on("error", e => concluir(e));
        filho.on("close", code => {
            if (code === 0) concluir(null);
            else concluir(new Error(rotulo + " terminou com código " + code + (saida ? ": " + _txt(saida.split(/\r?\n/).filter(Boolean).slice(-3).join(" | "), 300) : "")));
        });
    };
    const matarFilho = f => {
        if (!f || !f.pid) return;
        try {
            if (process.platform === "win32") cp.spawn("taskkill", ["/F", "/T", "/PID", String(f.pid)], { stdio: "ignore", windowsHide: true });
            else f.kill("SIGKILL");
        } catch (_) {}
    };

    const renomearComRetry = (de, para, tentativas, cb) => {
        try { fs.renameSync(de, para); cb(null); }
        catch (e) {
            if (tentativas <= 1 || parado) { cb(e); return; }
            setTimeout(() => renomearComRetry(de, para, tentativas - 1, cb), 500);
        }
    };
    // A cópia é aberta pelo Firebird DESTA máquina: sem ele, nem começa (não
    // adianta fazer o backup do banco principal para depois não ter onde abrir).
    const firebirdLocalNoAr = (cb) => {
        let fim = false;
        const s = new net.Socket();
        const acabar = ok => { if (fim) return; fim = true; try { s.destroy(); } catch (_) {} cb(ok); };
        s.setTimeout(2000);
        s.on("connect", () => acabar(true));
        s.on("error", () => acabar(false));
        s.on("timeout", () => acabar(false));
        try { s.connect(Number(porta) || 3050, "127.0.0.1"); } catch (_) { acabar(false); }
    };

    // ── Conferência da cópia nova (somente leitura) ─────────────────────────
    const conferir = (arquivo, cb) => {
        if (!o.Firebird) { cb(null, { aviso: "node-firebird indisponível — cópia não conferida" }); return; }
        let fim = false;
        const fechar = (db) => { try { if (db) db.detach(() => {}); } catch (_) {} };
        const t = setTimeout(() => { if (fim) return; fim = true; cb(new Error("a cópia nova não respondeu em 20 s")); }, 20000);
        const opts = { host: "127.0.0.1", port: porta, database: arquivo, user: o.user || "SYSDBA", password: o.pass || "masterkey", role: null, charset: o.charset || "WIN1252", lowercase_keys: false };
        try {
            o.Firebird.attach(opts, (err, db) => {
                if (fim) { fechar(db); return; }
                if (err || !db) { fim = true; clearTimeout(t); cb(err || new Error("sem conexão com a cópia nova")); return; }
                db.query("SELECT COUNT(*) AS N FROM RDB$RELATIONS WHERE TRIM(RDB$RELATION_NAME) = 'NFCE'", [], (e1, r1) => {
                    if (fim) { fechar(db); return; }
                    if (e1) { fim = true; clearTimeout(t); fechar(db); cb(e1); return; }
                    const temNfce = Number(r1 && r1[0] && (r1[0].N !== undefined ? r1[0].N : r1[0].n)) > 0;
                    if (!temNfce) { fim = true; clearTimeout(t); fechar(db); cb(null, { aviso: "a cópia não tem a tabela NFCE (o banco é mesmo do Small Commerce?)" }); return; }
                    db.query("SELECT COUNT(*) AS N FROM NFCE", [], (e2, r2) => {
                        if (fim) { fechar(db); return; }
                        fim = true; clearTimeout(t); fechar(db);
                        if (e2) { cb(e2); return; }
                        cb(null, { vendas: Number(r2 && r2[0] && (r2[0].N !== undefined ? r2[0].N : r2[0].n)) || 0 });
                    });
                });
            });
        } catch (e) { if (!fim) { fim = true; clearTimeout(t); cb(e); } }
    };

    // ── Espaço em disco ─────────────────────────────────────────────────────
    const espacoLivre = () => {
        try { if (fs.statfsSync) { const s = fs.statfsSync(pasta); return Number(s.bavail) * Number(s.bsize); } } catch (_) {}
        return -1; // desconhecido
    };
    const tamanhoFonte = f => {
        if (f && _ehLocal(f.host)) { try { return fs.statSync(f.path).size; } catch (_) {} }
        try { return fs.statSync(path.join(pasta, FBK_ULTIMO)).size * 2; } catch (_) {}
        return st.ativa && st.ativa.tamanho ? st.ativa.tamanho : 0;
    };

    // ── Um ciclo de cópia ───────────────────────────────────────────────────
    // origem: { tipo: "fdb", host, path, sig } | { tipo: "fbk", arquivo }
    const etapa = (txt) => { st.etapa = txt; st.etapaDesde = Date.now(); logDebug("Cópia offline: " + txt); };
    const executarCopia = (origem, motivo, cb) => {
        cb = typeof cb === "function" ? cb : () => {};
        if (st.emAndamento) { cb({ ok: false, erro: "Já existe uma cópia em andamento." }); return; }
        if (!gbak) { cb({ ok: false, erro: st.indisponivel || "gbak não encontrado." }); return; }
        const erroPasta = garantirPasta();
        if (erroPasta) { st.ultimoErro = erroPasta; log(erroPasta); cb({ ok: false, erro: erroPasta }); return; }

        const precisa = tamanhoFonte(origem.tipo === "fdb" ? origem : null);
        const livre = espacoLivre();
        if (livre >= 0 && precisa > 0 && livre < precisa * 2.2 + 200 * 1024 * 1024) {
            const msg = "Espaço em disco insuficiente para a cópia offline: livre " + Math.round(livre / 1048576) + " MB, necessário ~" + Math.round((precisa * 2.2) / 1048576 + 200) + " MB (" + pasta + ").";
            st.ultimoErro = msg; log(msg); cb({ ok: false, erro: msg }); return;
        }

        st.emAndamento = true; st.ultimaTentativa = Date.now(); st.ultimoErro = "";
        etapa("verificando o Firebird desta máquina");
        firebirdLocalNoAr((noAr) => {
        if (!noAr) {
            st.emAndamento = false; st.etapa = "";
            st.indisponivel = "O Firebird não está rodando nesta máquina (porta " + porta + " em 127.0.0.1): é ele que abre a cópia offline. Instale/inicie o Firebird aqui ou rode o sistema no computador do banco.";
            st.ultimoErro = st.indisponivel;
            st.proximaPermitida = Date.now() + intervaloMinMs;
            log("Cópia offline adiada: " + st.indisponivel);
            cb({ ok: false, erro: st.indisponivel });
            return;
        }
        const minhaGer = geracao;
        const inicio = Date.now();
        const agora = new Date();
        let nome = PREFIXO + _carimbo(agora) + ".FDB", n = 1;
        while (fs.existsSync(path.join(pasta, nome))) nome = PREFIXO + _carimbo(agora) + "_" + (n++) + ".FDB";
        const destino = path.join(pasta, nome);
        const destinoTmp = destino + ".tmp"; // restaura com nome temporário; renomeia depois de conferir
        const fbkTmp = path.join(pasta, PREFIXO + _carimbo(agora) + ".fbk.tmp");
        const fbkFinal = path.join(pasta, FBK_ULTIMO);
        const descricao = origem.tipo === "fbk" ? "arquivo de backup " + origem.arquivo : _alvoGbak(origem.host, porta, origem.path);
        log("Cópia offline: iniciando (" + motivo + ") a partir de " + descricao + ".");

        const falhar = (e, etapaFalha) => {
            st.emAndamento = false; st.etapa = "";
            apagar(fbkTmp);
            // O Firebird pode ainda segurar o arquivo: o que não sair agora fica na fila.
            [destinoTmp, destino].forEach(a => {
                if (!apagar(a)) { const b = path.basename(a); if (st.pendentesApagar.indexOf(b) < 0) { st.pendentesApagar.push(b); gravarManifesto(); clearTimeout(timerApagar); timerApagar = setTimeout(processarPendentes, 30000); if (timerApagar.unref) timerApagar.unref(); } }
            });
            const bruto = _txt(e && (e.message || e), 500);
            const amigavel = explicarErro(bruto);
            st.ultimoErro = (amigavel ? amigavel + " " : "") + "[" + etapaFalha + "] " + bruto;
            // Falhou: espera o intervalo mínimo antes de tentar de novo (não martela o banco).
            st.proximaPermitida = Date.now() + intervaloMinMs;
            log("Cópia offline FALHOU em " + etapaFalha + ": " + st.ultimoErro + " — o relatório continua com a cópia anterior" + (st.ativa ? " (dados de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + ")." : "."));
            cb({ ok: false, erro: st.ultimoErro });
        };
        const cancelado = () => minhaGer !== geracao || parado;

        const restaurar = (arquivoFbk, dadosDe) => {
            if (cancelado()) return falhar(new Error("cancelada"), "restauração");
            etapa("restaurando a cópia (somente leitura)");
            rodarGbak(["-c", "-mode", "read_only", arquivoFbk, _alvoGbak("127.0.0.1", porta, destinoTmp)], "gbak (restauração)", (e2) => {
                if (e2) return falhar(e2, "restauração");
                if (cancelado()) return falhar(new Error("cancelada"), "restauração");
                // Renomear um banco fechado é seguro; o Firebird pode levar um instante para soltar o arquivo.
                renomearComRetry(destinoTmp, destino, 20, (e3) => {
                if (e3) return falhar(e3, "renomear a cópia");
                if (cancelado()) return falhar(new Error("cancelada"), "renomear a cópia");
                etapa("conferindo a cópia nova");
                conferir(destino, (e4, info) => {
                    if (e4) return falhar(e4, "conferência");
                    if (cancelado()) return falhar(new Error("cancelada"), "conferência");
                    if (info && info.aviso) log("Cópia offline: aviso — " + info.aviso + ".");
                    let tam = 0; try { tam = fs.statSync(destino).size; } catch (_) {}
                    const anterior = st.ativa;
                    st.ativa = {
                        arquivo: destino, host: "127.0.0.1", dadosDe, criadaEm: Date.now(), origem: origem.tipo,
                        fonte: origem.tipo === "fbk" ? { arquivo: origem.arquivo } : { host: origem.host, path: origem.path },
                        tamanho: tam, sig: origem.sig || null, duracaoMs: Date.now() - inicio,
                        vendas: info && typeof info.vendas === "number" ? info.vendas : null
                    };
                    if (anterior && anterior.arquivo && _norm(anterior.arquivo) !== _norm(destino)) {
                        const b = path.basename(anterior.arquivo);
                        if (RE_COPIA.test(b) && st.pendentesApagar.indexOf(b) < 0) st.pendentesApagar.push(b);
                    }
                    gravarManifesto();
                    apagar(fbkTmp); // só existe se não virou o "último backup"
                    st.emAndamento = false; st.etapa = ""; st.ultimoOk = Date.now(); st.ultimoErro = ""; st.indisponivel = "";
                    st.ultimaDuracaoMs = Date.now() - inicio;
                    // Intervalo mínimo adaptativo: nunca ocupa o banco do caixa mais que 1/3 do tempo.
                    st.proximaPermitida = Date.now() + Math.max(intervaloMinMs, st.ultimaDuracaoMs * 3);
                    log("Cópia offline pronta em " + Math.round(st.ultimaDuracaoMs / 1000) + " s: " + nome + " (" + Math.round(tam / 1048576) + " MB, dados de " + new Date(dadosDe).toLocaleString("pt-BR") + ").");
                    aplicarLeitura("cópia offline atualizada");
                    // Dá tempo de as gerações em andamento soltarem a cópia anterior.
                    clearTimeout(timerApagar);
                    timerApagar = setTimeout(processarPendentes, 15000);
                    if (timerApagar.unref) timerApagar.unref();
                    cb({ ok: true, ativa: st.ativa });
                });
                });
            });
        };

        if (origem.tipo === "fbk") {
            let dadosDe = Date.now();
            try { dadosDe = fs.statSync(origem.arquivo).mtimeMs || dadosDe; } catch (e0) { return falhar(e0, "leitura do backup"); }
            restaurar(origem.arquivo, dadosDe);
            return;
        }
        etapa("copiando o banco principal (backup somente leitura)");
        const dadosDe = Date.now(); // a foto do gbak é tirada no início da transação
        rodarGbak(["-b", "-g", _alvoGbak(origem.host, porta, origem.path), fbkTmp], "gbak (backup)", (e1) => {
            if (e1) return falhar(e1, "backup");
            if (cancelado()) return falhar(new Error("cancelada"), "backup");
            let fbkUsar = fbkTmp;
            if (manterFbk) {
                // Guarda o último backup bom (útil como segurança extra) e restaura dele.
                try { try { fs.unlinkSync(fbkFinal); } catch (_) {} fs.renameSync(fbkTmp, fbkFinal); fbkUsar = fbkFinal; } catch (_) { fbkUsar = fbkTmp; }
            }
            restaurar(fbkUsar, dadosDe);
        });
        });
    };

    // ── Para onde o relatório olha ──────────────────────────────────────────
    const copiaUsavel = () => !!(st.ativa && st.ativa.arquivo && fs.existsSync(st.ativa.arquivo));
    const fonteAtual = () => { const f = typeof o.fonte === "function" ? (o.fonte() || {}) : {}; return f && f.path ? { host: f.host || "127.0.0.1", path: f.path } : null; };
    // Decide (copia/fonte) e avisa o servidor quando muda.
    const aplicarLeitura = (motivo) => {
        let alvo = "fonte";
        if (modo === "copia" && copiaUsavel()) alvo = "copia";
        if (modo === "hibrido" && copiaUsavel() && st.fonteOk === false) alvo = "copia";
        const f = fonteAtual();
        if (alvo === "copia") {
            st.lendo = "copia";
            if (typeof o.aoTrocar === "function") o.aoTrocar("127.0.0.1", st.ativa.arquivo, { motivo, lendo: "copia", dadosDe: st.ativa.dadosDe });
        } else if (f) {
            st.lendo = "fonte";
            if (typeof o.aoTrocar === "function") o.aoTrocar(f.host, f.path, { motivo, lendo: "fonte" });
        }
    };

    // ── Verificação periódica do banco principal ────────────────────────────
    const agendarVerificacao = (ms) => {
        clearTimeout(timerVerif);
        if (parado) return;
        timerVerif = setTimeout(verificar, Math.max(1000, ms));
        if (timerVerif.unref) timerVerif.unref();
    };
    const verificar = () => {
        if (parado || modo === "desligado") return;
        const f = fonteAtual();
        if (!f || typeof o.assinatura !== "function") { agendarVerificacao(verificarMs); return; }
        const minhaGer = geracao;
        st.ultimaVerificacao = Date.now();
        o.assinatura(f.host, f.path, (err, sig) => {
            if (parado || minhaGer !== geracao) return;
            const estavaOk = st.fonteOk;
            if (err) {
                st.falhasFonte++;
                const msg = _txt(err.message || err, 300);
                // Uma falha isolada não muda nada; duas seguidas = banco principal fora.
                if (st.falhasFonte >= 2 && st.fonteOk !== false) {
                    st.fonteOk = false; st.fonteDesde = Date.now();
                    st.fonteErro = (explicarErro(msg) || "Banco principal sem resposta.") + " (" + msg + ")";
                    log("Banco principal indisponível (" + st.fonteErro + ")" + (copiaUsavel() ? " — o relatório segue com a cópia offline de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + "." : " — ainda não há cópia offline."));
                    if (modo === "hibrido") aplicarLeitura("banco principal indisponível");
                    if (!st.ativa && !st.tentouFbkDisco) { st.tentouFbkDisco = true; api.tentarFbkDoDisco(o.fbkExtras || [], () => {}); }
                } else if (st.fonteOk === false) {
                    st.fonteErro = (explicarErro(msg) || "Banco principal sem resposta.") + " (" + msg + ")";
                }
                agendarVerificacao(verificarMs);
                return;
            }
            st.falhasFonte = 0;
            if (st.fonteOk !== true) {
                st.fonteOk = true; st.fonteDesde = Date.now(); st.fonteErro = "";
                if (estavaOk === false) log("Banco principal voltou a responder.");
                if (modo === "hibrido" && estavaOk === false) aplicarLeitura("banco principal voltou");
            }
            st.ultimaSig = sig;
            const agora = Date.now();
            const mudou = !st.ativa || st.ativa.origem !== "fdb" || st.ativa.sig !== sig ||
                !st.ativa.fonte || _norm(st.ativa.fonte.path) !== _norm(f.path) || String(st.ativa.fonte.host || "") !== String(f.host || "");
            const velha = st.ativa && agora - (st.ativa.dadosDe || 0) > maxIdadeMs;
            const manual = st.pedidoManual;
            if (gbak && !st.emAndamento && (manual || ((mudou || velha) && agora >= st.proximaPermitida))) {
                st.pedidoManual = false;
                const motivo = manual ? "pedido manual" : (!st.ativa ? "primeira cópia" : (mudou ? "mudança nas vendas detectada" : "cópia com mais de " + Math.round(maxIdadeMs / 60000) + " min"));
                executarCopia({ tipo: "fdb", host: f.host, path: f.path, sig }, motivo, () => agendarVerificacao(verificarMs));
                return;
            }
            agendarVerificacao(verificarMs);
        });
    };

    // ── .fbk encontrado no disco (sem banco e sem cópia) ────────────────────
    const procurarFbk = (extras) => {
        const home = os.homedir();
        const cands = [].concat(extras || [], [
            path.join(__dirname, "SMALL.fbk"), path.join(__dirname, "VE", "SMALL.fbk"),
            path.join(home, "Desktop", "VE", "SMALL.fbk"), path.join(home, "Desktop", "SMALL.fbk"),
            path.join(home, "Documents", "SMALL.fbk"), path.join(home, "OneDrive", "Desktop", "SMALL.fbk"),
            path.join(process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)", "SmallSoft", "Small Commerce", "SMALL.fbk"),
            path.join(process.env["ProgramFiles"] || "C:\\Program Files", "SmallSoft", "Small Commerce", "SMALL.fbk")
        ]).filter(Boolean);
        let melhor = null;
        cands.forEach(c => { try { const s = fs.statSync(c); if (s.isFile() && s.size > 0 && (!melhor || s.mtimeMs > melhor.mt)) melhor = { arq: c, mt: s.mtimeMs }; } catch (_) {} });
        return melhor ? melhor.arq : "";
    };

    // ── API pública ─────────────────────────────────────────────────────────
    const api = {
        VERSAO,
        pasta,
        /** Cópia válida para abrir já no início (antes de qualquer verificação). */
        copiaInicial() {
            if (modo === "desligado" || !gbak && !st.ativa) return null;
            if (!copiaUsavel()) return null;
            if (modo === "hibrido") return null; // híbrido começa pelo banco principal
            st.lendo = "copia";
            return { host: "127.0.0.1", path: st.ativa.arquivo, dadosDe: st.ativa.dadosDe };
        },
        /** É um arquivo de cópia gerenciado por este módulo? */
        ehCopia(arquivo) {
            const b = path.basename(String(arquivo || ""));
            return RE_COPIA.test(b) && _norm(path.dirname(path.resolve(String(arquivo || "")))) === _norm(pasta);
        },
        lendoCopia() { return st.lendo === "copia"; },
        modo() { return modo; },
        iniciar() {
            if (!parado) return;
            parado = false; geracao++;
            if (modo === "desligado") { log("Cópia offline desligada (offlineModo = \"desligado\"): o relatório lê o banco principal direto."); return; }
            if (!gbak) st.indisponivel = "gbak.exe não encontrado nesta máquina (instale o Firebird ou informe \"gbakPath\" no config.json).";
            if (!o.Firebird) st.indisponivel = "node-firebird indisponível.";
            const erroPasta = garantirPasta();
            if (erroPasta) { st.indisponivel = erroPasta; log(erroPasta); }
            limparOrfaos();
            log("Cópia offline " + VERSAO + ": modo \"" + modo + "\" | pasta " + pasta + " | gbak " + (gbak || "não encontrado") +
                " | verificação a cada " + Math.round(verificarMs / 1000) + " s | intervalo mínimo entre cópias " + Math.round(intervaloMinMs / 60000) + " min" +
                (st.ativa ? " | cópia em uso: " + path.basename(st.ativa.arquivo) + " (dados de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + ")" : " | ainda sem cópia"));
            if (st.indisponivel) log("Cópia offline indisponível: " + st.indisponivel + " O relatório lê o banco principal direto (somente leitura).");
            agendarVerificacao(1500);
        },
        parar() {
            parado = true; geracao++;
            clearTimeout(timerVerif); clearTimeout(timerApagar);
            if (filhoAtual) { matarFilho(filhoAtual); filhoAtual = null; }
        },
        /** Pede uma cópia já (ignora o intervalo mínimo). */
        atualizarAgora(cb) {
            cb = typeof cb === "function" ? cb : () => {};
            if (modo === "desligado") { cb({ ok: false, erro: "A cópia offline está desligada (offlineModo = \"desligado\")." }); return; }
            if (!gbak) { cb({ ok: false, erro: st.indisponivel || "gbak não encontrado." }); return; }
            if (st.emAndamento) { cb({ ok: true, jaEmAndamento: true, msg: "A cópia já está sendo feita (" + st.etapa + ")." }); return; }
            st.pedidoManual = true;
            agendarVerificacao(0);
            cb({ ok: true, msg: "Cópia offline solicitada. O relatório troca sozinho para a cópia nova quando ela ficar pronta." });
        },
        /** Restaura um .fbk escolhido pelo usuário e passa a ler dele. */
        importarFbk(arquivo, cb) {
            cb = typeof cb === "function" ? cb : () => {};
            if (modo === "desligado") { cb({ ok: false, erro: "A cópia offline está desligada (offlineModo = \"desligado\")." }); return; }
            let s = null; try { s = fs.statSync(String(arquivo || "")); } catch (_) {}
            if (!s || !s.isFile() || s.size <= 0) { cb({ ok: false, erro: "Arquivo de backup não encontrado: " + arquivo }); return; }
            if (!/\.(fbk|gbk)$/i.test(String(arquivo))) { cb({ ok: false, erro: "O arquivo precisa ser um backup do Firebird (.fbk ou .gbk)." }); return; }
            executarCopia({ tipo: "fbk", arquivo: path.resolve(String(arquivo)) }, "backup escolhido pelo usuário", cb);
        },
        /** Sem cópia e sem banco principal: tenta um SMALL.fbk do disco. */
        tentarFbkDoDisco(extras, cb) {
            cb = typeof cb === "function" ? cb : () => {};
            if (modo === "desligado" || !gbak || st.ativa || st.emAndamento) { cb({ ok: false }); return; }
            const fbk = procurarFbk(extras);
            if (!fbk) { cb({ ok: false, erro: "Nenhum SMALL.fbk encontrado nos locais conhecidos." }); return; }
            log("Sem banco principal e sem cópia: usando o backup encontrado em " + fbk + ".");
            executarCopia({ tipo: "fbk", arquivo: fbk }, "backup encontrado no disco", cb);
        },
        /** Muda as opções em tempo real (tela de configurações). */
        configurar(novas) {
            const n = novas || {};
            if (n.intervaloMinMs !== undefined) intervaloMinMs = _faixa(n.intervaloMinMs, 30000, 24 * 3600000, intervaloMinMs);
            if (n.verificarMs !== undefined) verificarMs = _faixa(n.verificarMs, 5000, 3600000, verificarMs);
            if (n.maxIdadeMs !== undefined) maxIdadeMs = _faixa(n.maxIdadeMs, 5 * 60000, 7 * 24 * 3600000, maxIdadeMs);
            if (n.timeoutMs !== undefined) timeoutMs = _faixa(n.timeoutMs, 60000, 6 * 3600000, timeoutMs);
            if (n.modo !== undefined && MODOS.indexOf(String(n.modo)) >= 0 && n.modo !== modo) {
                const antes = modo; modo = String(n.modo);
                log("Cópia offline: modo \"" + antes + "\" → \"" + modo + "\".");
                if (modo === "desligado") { clearTimeout(timerVerif); }
                else if (!parado) agendarVerificacao(500);
                aplicarLeitura("modo alterado");
            }
        },
        status() {
            const agora = Date.now();
            return {
                versao: VERSAO, modo, pasta, gbak: gbak || null, disponivel: !st.indisponivel, indisponivel: st.indisponivel || null,
                lendo: st.lendo,
                copia: st.ativa ? {
                    arquivo: path.basename(st.ativa.arquivo), dadosDe: st.ativa.dadosDe, criadaEm: st.ativa.criadaEm,
                    idadeMin: Math.max(0, Math.round((agora - st.ativa.dadosDe) / 60000)), origem: st.ativa.origem,
                    tamanhoMB: Math.round((st.ativa.tamanho || 0) / 1048576), duracaoS: Math.round((st.ativa.duracaoMs || 0) / 1000),
                    vendas: st.ativa.vendas
                } : null,
                fonte: (() => { const f = fonteAtual(); return f ? { host: f.host, path: f.path } : null; })(),
                fonteOk: st.fonteOk, fonteErro: st.fonteErro || null, fonteDesde: st.fonteDesde || null,
                emAndamento: st.emAndamento, etapa: st.etapa || null, etapaDesde: st.etapaDesde || null,
                ultimaTentativa: st.ultimaTentativa || null, ultimoOk: st.ultimoOk || null, ultimoErro: st.ultimoErro || null,
                proximaPermitida: st.proximaPermitida || null, ultimaVerificacao: st.ultimaVerificacao || null,
                intervaloMinMin: Math.round(intervaloMinMs / 60000), verificarSeg: Math.round(verificarMs / 1000),
                pendentesApagar: st.pendentesApagar.length
            };
        }
    };

    lerManifesto();
    return api;
}

module.exports = { criarCopiaOffline, localizarGbak, pastaPadrao, explicarErro, VERSAO, RE_COPIA };
