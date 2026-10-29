"use strict";

/**
 * offline-copia.js
 * @version 1.4.0
 * @author Ruda Gabriel
 * @description Cópia offline do banco do Small Commerce (Relatórios SmallSoft Offline).
 * @changelog
 *   1.4.0 - 2026-10-29 - Progresso da cópia (status.progresso: pct, decorrido, restante) pelo
 *     tamanho dos arquivos que o gbak grava; sem o "1/7" (número do endereço tentado).
 *   1.3.0 - 2026-10-29 - Terminal com banco em unidade de rede: o gbak tenta os endereços
 *     candidatos (servidor da unidade + caminhos padrão do Small) e avisa qual funcionou;
 *     último recurso: cópia pelo arquivo. Cópia periódica (a data de um .FDB aberto no
 *     Windows quase não muda). A verificação nunca para; cópia travada é liberada.
 *   1.2.1 - 2026-10-29 - Padrão volta a ser o gbak direto (seguro); cópia pelo arquivo opcional.
 *   1.2.0 - 2026-10-29 - Cópia do ARQUIVO para a pasta temporária (sem conectar), só aceita
 *     se o arquivo não mudou durante a cópia, validação com gfix e gbak sobre a cópia
 *     temporária; gbak direto só como reserva (offlineMetodo "auto"|"arquivo"|"gbak").
 *     Banco em rede: copia pela unidade de rede / compartilhamento.
 *   1.1.0 - 2026-10-28 - Sem nenhuma conexão direta com o banco principal: detecção de
 *     mudança pelo arquivo (tamanho/data), sem consulta de verificação; só modo "copia".
 *
 * O relatório não precisa ler o banco principal (SMALL.FDB) ao vivo: ele lê uma
 * CÓPIA local, que este módulo mantém atualizada sozinho. Assim o relatório
 * continua abrindo quando o banco principal está sendo atualizado, em
 * manutenção, travado ou fora do ar — e o banco principal nunca é alterado.
 *
 * Como a cópia é feita: método "gbak" (o PADRÃO) — gbak -b -g direto pelo servidor
 * Firebird, seguro para os dados — e restauração como abaixo (passos 3 e 4).
 * Método "auto" (opcional, offlineMetodo):
 *   1. Copia o ARQUIVO SMALL.FDB para a pasta temporária (copias\temp) só
 *      lendo o arquivo — sem conectar no banco. Espera o banco ficar alguns
 *      segundos sem gravar e só aceita a cópia se tamanho e data do arquivo
 *      forem os mesmos do começo ao fim (senão a cópia poderia misturar
 *      páginas de momentos diferentes); tenta de novo se mudou.
 *   2. Valida a cópia temporária com o gfix (se existir) e faz o backup dela
 *      com o gbak (gbak -b -g na cópia temporária, pelo Firebird desta máquina).
 *      Defeito na cópia temporária = cópia descartada.
 *   3. Restaura o backup como banco SOMENTE LEITURA (gbak -c -mode read_only),
 *      confere e troca a leitura para ele (troca atômica). Qualquer falha
 *      mantém a cópia anterior e apaga os temporários.
 *   Se a cópia do arquivo não sair íntegra (banco gravando sem parar, arquivo
 *   travado pelo Firebird 3+ etc.), o método "auto" usa como RESERVA o gbak
 *   direto pelo servidor Firebird (gbak -b -g host:SMALL.FDB) — que também é
 *   seguro para os dados: é leitura numa foto da transação, sem coleta de lixo.
 *   "arquivo" nunca usa o gbak direto; "gbak" usa só ele.
 *   Banco em outra máquina: copia pela unidade de rede ou compartilhamento
 *   (\\servidor\pasta\SMALL.FDB) quando acessível; senão, gbak direto.
 *
 * NENHUMA CONEXÃO DIRETA COM O BANCO PRINCIPAL: o relatório e o estoque leem
 * só a cópia. No método "auto" o banco principal só é LIDO como arquivo; o
 * gbak conecta nele apenas como reserva (ou sempre, no método "gbak") — nada
 * de consultas de verificação, para não atrapalhar atualização e manutenção
 * do Small Commerce.
 *
 * Quando atualizar a cópia (tudo automático):
 *   - banco principal nesta máquina: a cada `verificarMs` lê só o TAMANHO e a
 *     DATA DE ALTERAÇÃO do arquivo (sem abrir o banco); mudou → nova cópia,
 *     respeitando o intervalo mínimo entre cópias (`intervaloMinMs`, que também
 *     cresce sozinho para 3× a duração da última cópia — nunca ocupa o banco do
 *     caixa mais que 1/3 do tempo);
 *   - banco principal em outra máquina (não dá para olhar o arquivo): a cada
 *     3× o intervalo mínimo;
 *   - a cada `maxIdadeMs` mesmo sem mudança;
 *   - ao pedir "Atualizar cópia agora" (bandeja, tela, API).
 *
 * Sem cópia pronta o relatório espera (tela "Preparando a cópia offline");
 * sem gbak ou sem Firebird local, o motivo aparece no status e no log.
 *
 * Este arquivo não depende de nada do servidor: tudo chega por `opcoes`
 * (o que também permite testá-lo isolado, com gbak e Firebird simulados).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const cp = require("child_process");
const { pipeline } = require("stream");
const net = require("net");

const VERSAO = "1.4.0";
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
const _decUtf8 = (() => { try { return new (require("util").TextDecoder)("utf-8", { fatal: true }); } catch (_) { return null; } })();
const _dec1252 = (() => { try { return new (require("util").TextDecoder)("windows-1252"); } catch (_) { return null; } })();
function _decodificarSaida(b) {
    if (!Buffer.isBuffer(b)) return String(b == null ? "" : b);
    if (_decUtf8) { try { return _decUtf8.decode(b); } catch (_) { /* não é UTF-8 */ } }
    return _dec1252 ? _dec1252.decode(b) : b.toString("latin1");
}
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
    if (log) log("gbak não encontrado (Firebird não instalado nesta máquina?) — sem ele não há cópia offline (informe \"gbakPath\" no config.json).");
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
 *   pasta, gbak, user, pass, porta, charset,
 *   Firebird           — node-firebird JÁ BLINDADO (somente leitura)
 *   fonte()            — {host, path} do banco principal atual
 *   aoTrocar(host, path, info)            — o servidor passa a ler daqui
 *   log(msg), logDebug(msg)
 *   intervaloMinMs, verificarMs, maxIdadeMs, timeoutMs, manterFbk
 */
function criarCopiaOffline(opcoes) {
    const o = Object.assign({}, opcoes || {});
    const log = typeof o.log === "function" ? o.log : () => {};
    const logDebug = typeof o.logDebug === "function" ? o.logDebug : () => {};
    const modo = "copia"; // único modo: o sistema nunca lê o banco principal direto
    const pasta = path.resolve(String(o.pasta || pastaPadrao(o.appName)));
    const porta = o.porta || 3050;
    let intervaloMinMs = _faixa(o.intervaloMinMs, 5000, 24 * 3600000, 5 * 60000);
    let verificarMs = _faixa(o.verificarMs, 5000, 3600000, 20000);
    let maxIdadeMs = _faixa(o.maxIdadeMs, 5 * 60000, 7 * 24 * 3600000, 180 * 60000);
    // Cópia periódica (v1.3.0): no Windows a data de alteração de um banco ABERTO pelo
    // Firebird quase não muda — só a data não basta para saber que houve venda nova.
    let periodoMs = _faixa(o.periodoMs, 60000, 24 * 3600000, 5 * 60000);
    let timeoutMs = _faixa(o.timeoutMs, 60000, 6 * 3600000, 30 * 60000);
    const manterFbk = o.manterFbk !== false;
    const gbak = String(o.gbak || "");
    // gfix (mesma pasta do gbak): valida a cópia temporária antes do backup.
    const gfix = (() => {
        if (o.gfix !== undefined) return String(o.gfix || "");
        if (!gbak || /\.js$/i.test(gbak)) return "";
        const g = path.join(path.dirname(gbak), process.platform === "win32" ? "gfix.exe" : "gfix");
        try { return fs.statSync(g).isFile() ? g : ""; } catch (_) { return ""; }
    })();
    // Como tirar a cópia do banco principal:
    //   "gbak"    (padrão) gbak direto pelo servidor Firebird — seguro para os dados
    //             (leitura numa foto da transação, sem coleta de lixo);
    //   "auto"    copia o ARQUIVO para a pasta temporária e converte de lá; se a cópia
    //             do arquivo não sair íntegra, usa o gbak direto (reserva);
    //   "arquivo" só a cópia do arquivo — o gbak nunca conecta no banco principal.
    let metodo = ["auto", "arquivo", "gbak"].indexOf(String(o.metodo || "gbak").toLowerCase()) >= 0 ? String(o.metodo || "gbak").toLowerCase() : "gbak";
    const quietoMs = _faixa(o.quietoMs, 0, 600000, 5000); // arquivo sem gravação há este tempo antes de copiar
    const tentativasArquivo = _faixa(o.tentativasArquivo, 1, 10, 3);
    const ganchoTeste = o.ganchoTeste || null;
    const manifestoArq = path.join(pasta, MANIFESTO);
    const pastaTemp = path.join(pasta, "temp");

    // ── Estado ──────────────────────────────────────────────────────────────
    const st = {
        ativa: null,           // { arquivo, host, dadosDe, criadaEm, origem, fonte, tamanho, sig, duracaoMs }
        lendo: "fonte",        // "fonte" | "copia"
        fonteOk: null,         // null = ainda não verificada
        fonteErro: "",
        fonteDesde: 0,         // desde quando está no estado atual (ok ou com erro)
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
        try { fs.mkdirSync(pasta, { recursive: true }); fs.mkdirSync(pastaTemp, { recursive: true }); } catch (e) { return "Não consegui criar a pasta das cópias (" + pasta + "): " + _txt(e && e.message); }
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
        const dir = _norm(path.dirname(path.resolve(arq)));
        if (dir !== _norm(pasta) && !(dir === _norm(pastaTemp) && RE_TEMP.test(base))) return false;
        const f = typeof o.fonte === "function" ? (o.fonte() || {}) : {};
        if (f.path && _norm(f.path) === _norm(arq)) return false;
        if (f.arquivo && _norm(f.arquivo) === _norm(arq)) return false;
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
        try { fs.readdirSync(pastaTemp).forEach(n => { if (RE_TEMP.test(n)) apagar(path.join(pastaTemp, n)); }); } catch (_) {}
        processarPendentes();
    };

    // gbak/gfix de uma execução anterior que ficaram rodando — só os que gravam NA
    // PASTA DAS CÓPIAS (identificados pela linha de comando); nenhum outro é tocado.
    const encerrarGbakOrfaos = (cb) => {
        if (process.platform !== "win32") { cb(); return; }
        const alvo = pasta.replace(/'/g, "''").replace(/([\[\]*?`])/g, "`$1");
        const ps = "$ps = Get-CimInstance Win32_Process -Filter \"Name='gbak.exe' OR Name='gfix.exe'\" -ErrorAction SilentlyContinue | " +
            "Where-Object { $_.CommandLine -and $_.CommandLine -like '*" + alvo + "*' }; " +
            "foreach ($p in $ps) { try { Stop-Process -Id $p.ProcessId -Force -ErrorAction Stop; Write-Output $p.ProcessId } catch {} }";
        try {
            cp.execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", ps], { windowsHide: true, timeout: 20000 }, (e, out) => {
                const pids = String(out || "").split(/\r?\n/).map(x => x.trim()).filter(x => /^\d+$/.test(x));
                if (pids.length) log("Cópia offline: encerrado(s) " + pids.length + " gbak/gfix de uma cópia interrompida (PID " + pids.join(", ") + ") — a cópia em uso não foi afetada; uma nova será feita.");
                // O Firebird leva um instante para soltar os arquivos que o gbak usava.
                setTimeout(cb, pids.length ? 3000 : 0);
            });
        } catch (_) { cb(); }
    };

    // ── Execução do gbak (credenciais por variável de ambiente) ─────────────
    const rodarGbak = (args, rotulo, cb) => rodarFerramenta(gbak, args, rotulo, cb);
    const rodarFerramenta = (exe, args, rotulo, cb) => {
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
            filho = /\.js$/i.test(exe)
                ? cp.spawn(process.execPath, [exe].concat(args), { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] })
                : cp.spawn(exe, args, { env, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
        } catch (e) { concluir(e); return; }
        filhoAtual = filho;
        // Prioridade baixa: o caixa (Small Commerce) tem preferência na máquina.
        try { if (filho.pid && os.setPriority) os.setPriority(filho.pid, os.constants.priority.PRIORITY_BELOW_NORMAL); } catch (_) {}
        // Mensagens do gbak no Windows vêm na codificação do sistema (Windows-1252), não em
        // UTF-8: sem isto o "não" virava "n�o" no log e na tela.
        const juntar = b => { saida += _decodificarSaida(b); if (saida.length > 20000) saida = saida.slice(-20000); };
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
        if (f && f.arquivo) { try { return fs.statSync(f.arquivo).size; } catch (_) {} }
        if (f && f.path && _ehLocal(f.host)) { try { return fs.statSync(f.path).size; } catch (_) {} }
        try { return fs.statSync(path.join(pasta, FBK_ULTIMO)).size * 2; } catch (_) {}
        return st.ativa && st.ativa.tamanho ? st.ativa.tamanho : 0;
    };

    // ── Um ciclo de cópia ───────────────────────────────────────────────────
    // origem: { tipo: "fdb", host, path, sig } | { tipo: "fbk", arquivo }
    // prog = faixa da barra de progresso desta etapa: { arquivo, esperado, de, ate } —
    // o percentual vem do tamanho que o arquivo já tem (o gbak grava aos poucos)
    // comparado com o tamanho esperado (o da cópia anterior, ou uma estimativa).
    const etapa = (txt, prog) => { st.etapa = txt; st.etapaDesde = Date.now(); st.prog = prog || null; logDebug("Cópia offline: " + txt); };
    const progresso = () => {
        if (!st.emAndamento) return null;
        const p = st.prog;
        let pct = 0;
        if (p) {
            let frac = 0;
            if (p.arquivo && p.esperado > 0) { try { frac = Math.min(0.99, fs.statSync(p.arquivo).size / p.esperado); } catch (_) { frac = 0; } }
            else if (p.fixo !== undefined) frac = p.fixo;
            pct = p.de + (p.ate - p.de) * frac;
        }
        pct = Math.max(st.progMax || 0, Math.min(99, pct)); // nunca volta para trás
        st.progMax = pct;
        const decorridoS = Math.round((Date.now() - (st.ultimaTentativa || Date.now())) / 1000);
        const restanteS = pct >= 3 ? Math.max(1, Math.round(decorridoS * (100 - pct) / pct)) : null;
        return { pct: Math.round(pct), decorridoS, restanteS };
    };
    // Tamanhos esperados (para o percentual): os da cópia anterior; na 1ª vez, estimativas.
    const tamanhoDe = a => { try { return fs.statSync(a).size; } catch (_) { return 0; } };
    const esperadoFbk = (origem) => (st.ativa && st.ativa.tamanhoFbk) || tamanhoDe(path.join(pasta, FBK_ULTIMO)) || Math.round(tamanhoFonte(origem) * 0.55) || 0;
    const esperadoFdb = (fbk) => (st.ativa && st.ativa.tamanho) || Math.round(tamanhoDe(fbk) * 1.7) || 0;
    const executarCopia = (origem, motivo, cb) => {
        cb = typeof cb === "function" ? cb : () => {};
        if (st.emAndamento) { cb({ ok: false, erro: "Já existe uma cópia em andamento." }); return; }
        if (st.limpando) { cb({ ok: false, erro: "Encerrando uma cópia interrompida antes desta — tente de novo em alguns segundos." }); return; }
        if (!gbak) { cb({ ok: false, erro: st.indisponivel || "gbak não encontrado." }); return; }
        const erroPasta = garantirPasta();
        if (erroPasta) { st.ultimoErro = erroPasta; log(erroPasta); cb({ ok: false, erro: erroPasta }); return; }

        const precisa = tamanhoFonte(origem.tipo === "fdb" ? origem : null);
        const livre = espacoLivre();
        // Cópia temporária + backup + cópia restaurada.
        const fator = origem.tipo === "fdb" && origem.arquivo && metodo !== "gbak" ? 3.3 : 2.2;
        if (livre >= 0 && precisa > 0 && livre < precisa * fator + 200 * 1024 * 1024) {
            const msg = "Espaço em disco insuficiente para a cópia offline: livre " + Math.round(livre / 1048576) + " MB, necessário ~" + Math.round((precisa * fator) / 1048576 + 200) + " MB (" + pasta + ").";
            st.ultimoErro = msg; log(msg); cb({ ok: false, erro: msg }); return;
        }

        st.emAndamento = true; st.ultimaTentativa = Date.now(); st.ultimoErro = ""; st.progMax = 0;
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
        const tempFdb = path.join(pastaTemp, PREFIXO + _carimbo(agora) + ".copia.tmp");
        let metodoUsado = origem.tipo === "fbk" ? "fbk" : "";
        let metodoUsadoAlvo = null; // endereço do gbak que funcionou (fica registrado na cópia)
        const descricao = origem.tipo === "fbk" ? "arquivo de backup " + origem.arquivo
            : (origem.arquivo && metodo !== "gbak" ? "arquivo " + origem.arquivo : _alvoGbak(origem.host, porta, origem.path));
        log("Cópia offline: iniciando (" + motivo + ") a partir de " + descricao + ".");

        const falhar = (e, etapaFalha) => {
            st.emAndamento = false; st.etapa = "";
            apagar(fbkTmp); apagar(tempFdb);
            // O Firebird pode ainda segurar o arquivo: o que não sair agora fica na fila.
            [destinoTmp, destino].forEach(a => {
                if (!apagar(a)) { const b = path.basename(a); if (st.pendentesApagar.indexOf(b) < 0) { st.pendentesApagar.push(b); gravarManifesto(); clearTimeout(timerApagar); timerApagar = setTimeout(processarPendentes, 30000); if (timerApagar.unref) timerApagar.unref(); } }
            });
            const bruto = _txt(e && (e.message || e), 500);
            const amigavel = explicarErro(bruto);
            st.ultimoErro = (amigavel ? amigavel + " " : "") + "[" + etapaFalha + "] " + bruto;
            if (origem.tipo === "fdb" && (etapaFalha === "backup" || etapaFalha === "cópia do arquivo") && !/cancelada/.test(bruto)) {
                if (st.fonteOk !== false) st.fonteDesde = Date.now();
                st.fonteOk = false; st.fonteErroDe = "gbak";
                st.fonteErro = (amigavel || "O banco principal não deixou copiar agora.") + " (" + _txt(bruto, 200) + ")";
            }
            // Falhou: espera o intervalo mínimo antes de tentar de novo (não martela o banco).
            st.proximaPermitida = Date.now() + intervaloMinMs;
            log("Cópia offline FALHOU em " + etapaFalha + ": " + st.ultimoErro + " — o relatório continua com a cópia anterior" + (st.ativa ? " (dados de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + ")." : "."));
            cb({ ok: false, erro: st.ultimoErro });
        };
        const cancelado = () => minhaGer !== geracao || parado;

        let faixaRestauracao = origem.tipo === "fbk" ? 0 : 55;
        let tamFbk = 0;
        const restaurar = (arquivoFbk, dadosDe) => {
            tamFbk = tamanhoDe(arquivoFbk);
            if (cancelado()) return falhar(new Error("cancelada"), "restauração");
            etapa("restaurando a cópia (somente leitura)", { arquivo: destinoTmp, esperado: esperadoFdb(arquivoFbk), de: faixaRestauracao, ate: 96 });
            rodarGbak(["-c", "-mode", "read_only", arquivoFbk, _alvoGbak("127.0.0.1", porta, destinoTmp)], "gbak (restauração)", (e2) => {
                if (e2) return falhar(e2, "restauração");
                if (cancelado()) return falhar(new Error("cancelada"), "restauração");
                // Renomear um banco fechado é seguro; o Firebird pode levar um instante para soltar o arquivo.
                renomearComRetry(destinoTmp, destino, 20, (e3) => {
                if (e3) return falhar(e3, "renomear a cópia");
                if (cancelado()) return falhar(new Error("cancelada"), "renomear a cópia");
                etapa("conferindo a cópia nova", { fixo: 0.5, de: 96, ate: 99 });
                conferir(destino, (e4, info) => {
                    if (e4) return falhar(e4, "conferência");
                    if (cancelado()) return falhar(new Error("cancelada"), "conferência");
                    if (info && info.aviso) log("Cópia offline: aviso — " + info.aviso + ".");
                    let tam = 0; try { tam = fs.statSync(destino).size; } catch (_) {}
                    const anterior = st.ativa;
                    st.ativa = {
                        arquivo: destino, host: "127.0.0.1", dadosDe, criadaEm: Date.now(), origem: origem.tipo,
                        fonte: origem.tipo === "fbk" ? { arquivo: origem.arquivo } : { host: origem.host || "", path: origem.path || "", arquivo: origem.arquivo || "" },
                        servidorUsado: metodoUsadoAlvo ? metodoUsadoAlvo.host + ":" + metodoUsadoAlvo.path : null,
                        metodo: metodoUsado,
                        tamanho: tam, tamanhoFbk: tamFbk || null, sig: origem.sig || null, duracaoMs: Date.now() - inicio,
                        vendas: info && typeof info.vendas === "number" ? info.vendas : null
                    };
                    if (anterior && anterior.arquivo && _norm(anterior.arquivo) !== _norm(destino)) {
                        const b = path.basename(anterior.arquivo);
                        if (RE_COPIA.test(b) && st.pendentesApagar.indexOf(b) < 0) st.pendentesApagar.push(b);
                    }
                    gravarManifesto();
                    apagar(fbkTmp); // só existe se não virou o "último backup"
                    st.emAndamento = false; st.etapa = ""; st.ultimoOk = Date.now(); st.ultimoErro = ""; st.indisponivel = "";
                    if (origem.tipo === "fdb") { if (st.fonteOk !== true) st.fonteDesde = Date.now(); st.fonteOk = true; st.fonteErro = ""; st.fonteErroDe = ""; }
                    st.ultimaDuracaoMs = Date.now() - inicio;
                    // Intervalo mínimo adaptativo: nunca ocupa o banco do caixa mais que 1/3 do tempo.
                    st.proximaPermitida = Date.now() + Math.max(intervaloMinMs, st.ultimaDuracaoMs * 3);
                    log("Cópia offline pronta em " + Math.round(st.ultimaDuracaoMs / 1000) + " s (" + ({ arquivo: "cópia do arquivo + gbak local", gbak: "gbak direto", fbk: "backup .fbk" }[metodoUsado] || metodoUsado) + "): " + nome + " (" + Math.round(tam / 1048576) + " MB, dados de " + new Date(dadosDe).toLocaleString("pt-BR") + ").");
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
        // ── Banco principal → backup (.fbk) ────────────────────────────────
        const depoisDoBackup = (dadosDe, como) => {
            if (cancelado()) return falhar(new Error("cancelada"), "backup");
            metodoUsado = como;
            let fbkUsar = fbkTmp;
            if (manterFbk) {
                // Guarda o último backup bom (útil como segurança extra) e restaura dele.
                try { try { fs.unlinkSync(fbkFinal); } catch (_) {} fs.renameSync(fbkTmp, fbkFinal); fbkUsar = fbkFinal; } catch (_) { fbkUsar = fbkTmp; }
            }
            restaurar(fbkUsar, dadosDe);
        };
        // Endereços para o gbak direto, em ordem: o principal (se fizer sentido) e os
        // candidatos achados pela procura (servidor da unidade de rede + caminhos padrão
        // do Small). "127.0.0.1 + caminho que não existe nesta máquina" é descartado.
        const alvosGbak = (() => {
            const lista = [], vistos = new Set();
            const add = (h, pth) => {
                h = String(h || ""); pth = String(pth || "");
                if (!h || !pth || /^\\\\/.test(pth)) return;
                if (_ehLocal(h)) { try { if (!fs.statSync(pth).isFile()) return; } catch (_) { return; } }
                const k = h.toUpperCase() + "|" + pth.toUpperCase();
                if (!vistos.has(k)) { vistos.add(k); lista.push({ host: h, path: pth }); }
            };
            add(origem.host, origem.path);
            (Array.isArray(origem.candidatos) ? origem.candidatos : []).slice(0, 12).forEach(c => add(c && c.host, c && c.path));
            return lista;
        })();
        const podeGbakDireto = alvosGbak.length > 0;
        let jaTentouGbak = false, jaTentouArquivo = false;
        // Erro de "banco não está aqui / servidor não responde": vale tentar o próximo endereço.
        const tentarProximo = e => /open file|encontrar o arquivo|cannot find|not found|No such file|I\/O error|unavailable database|refused|failed to establish|network|host|Unable to complete|recusou|11001|10061|10060/i.test(String(e && (e.message || e)));
        // gbak direto pelo servidor Firebird: LEITURA (foto da transação, -g sem coleta de lixo).
        const viaGbakDireto = (motivoReserva) => {
            jaTentouGbak = true;
            if (!podeGbakDireto) return falhar(new Error("o banco principal só está acessível como arquivo (" + (origem.arquivo || "?") + ") e a cópia do arquivo não deu certo" + (motivoReserva ? ": " + motivoReserva : "")), "cópia do arquivo");
            if (motivoReserva) log("Cópia offline: a cópia do arquivo não deu certo (" + motivoReserva + ") — usando o gbak direto (somente leitura) desta vez.");
            const erros = [];
            const tentar = (k) => {
                if (cancelado()) return falhar(new Error("cancelada"), "backup");
                const alvo = alvosGbak[k];
                // (sem "1/7": o número do endereço tentado não é progresso — a barra é.)
                etapa("lendo o banco principal (gbak direto, somente leitura)" + (k > 0 || !_ehLocal(alvo.host) ? " — " + alvo.host : ""),
                    { arquivo: fbkTmp, esperado: esperadoFbk(origem), de: jaTentouArquivo ? 30 : 0, ate: jaTentouArquivo ? 60 : 55 });
                faixaRestauracao = jaTentouArquivo ? 60 : 55;
                const dadosDe = Date.now(); // a foto do gbak é tirada no início da transação
                apagar(fbkTmp);
                rodarGbak(["-b", "-g", _alvoGbak(alvo.host, porta, alvo.path), fbkTmp], "gbak (backup)", (e1) => {
                    if (!e1) {
                        metodoUsadoAlvo = alvo;
                        if (k > 0 || alvo.host !== origem.host || alvo.path !== origem.path) {
                            log("Cópia offline: o banco principal respondeu em " + alvo.host + ":" + alvo.path + " — este endereço fica salvo para as próximas cópias.");
                            try { if (typeof o.aoServidorEncontrado === "function") o.aoServidorEncontrado({ host: alvo.host, path: alvo.path }); } catch (_) {}
                        }
                        return depoisDoBackup(dadosDe, "gbak");
                    }
                    erros.push(alvo.host + ":" + alvo.path + " → " + _txt(e1.message, 160));
                    if (k + 1 < alvosGbak.length && tentarProximo(e1)) return tentar(k + 1);
                    // Nenhum endereço aceitou o gbak, mas o ARQUIVO está acessível (unidade de rede /
                    // compartilhamento): último recurso, para as cópias não pararem.
                    if (origem.arquivo && !jaTentouArquivo) {
                        log("Cópia offline: o gbak direto não conseguiu abrir o banco (" + erros.join(" | ") + ") — copiando o arquivo " + origem.arquivo + " e convertendo aqui.");
                        return viaArquivo();
                    }
                    falhar(new Error(erros.length > 1 ? "nenhum endereço do banco funcionou: " + erros.join(" | ") : _txt(e1.message, 400)), "backup");
                });
            };
            tentar(0);
        };
        // Cópia do ARQUIVO para a pasta temporária (sem conectar no banco) →
        // validação (gfix) → gbak sobre a cópia temporária.
        const reservaOuFalha = (e, etapaFalha) => {
            apagar(tempFdb);
            if (cancelado()) return falhar(new Error("cancelada"), etapaFalha);
            if (metodo === "auto" && podeGbakDireto && !jaTentouGbak) return viaGbakDireto(_txt(e && (e.message || e), 200));
            falhar(e, etapaFalha);
        };
        const viaArquivo = () => {
            jaTentouArquivo = true;
            etapa("copiando o arquivo do banco para a pasta temporária (sem conectar)");
            copiarArquivoConsistente(origem.arquivo, tempFdb, (eC, dadosDe) => {
                if (eC) return reservaOuFalha(eC, "cópia do arquivo");
                if (cancelado()) return reservaOuFalha(new Error("cancelada"), "cópia do arquivo");
                const converter = () => {
                    etapa("convertendo a cópia temporária (gbak)", { arquivo: fbkTmp, esperado: esperadoFbk(origem), de: 30, ate: 60 });
                    faixaRestauracao = 60;
                    rodarGbak(["-b", "-g", _alvoGbak("127.0.0.1", porta, tempFdb), fbkTmp], "gbak (backup da cópia temporária)", (e1) => {
                        apagar(tempFdb);
                        // gbak recusou a cópia temporária = cópia com defeito: reserva/falha.
                        if (e1) return reservaOuFalha(new Error("a cópia temporária não passou no gbak: " + _txt(e1.message, 200)), "conversão da cópia temporária");
                        depoisDoBackup(dadosDe, "arquivo");
                    });
                };
                if (!gfix) return converter();
                etapa("validando a cópia temporária (gfix)", { fixo: 0.5, de: 25, ate: 30 });
                rodarFerramenta(gfix, ["-v", "-full", "-n", _alvoGbak("127.0.0.1", porta, tempFdb)], "gfix (validação)", (eV, saidaV) => {
                    if (eV || /validation error|errors? found|corrupt/i.test(String(saidaV || "")))
                        return reservaOuFalha(new Error("a validação da cópia temporária encontrou problemas" + (eV ? ": " + _txt(eV.message, 200) : ": " + _txt(saidaV, 200))), "validação da cópia temporária");
                    converter();
                });
            });
        };
        if (metodo !== "gbak" && origem.arquivo) viaArquivo();
        // Método "gbak", mas o banco só é alcançável como arquivo (\\servidor\...: o Firebird
        // não abre banco por compartilhamento): copia o arquivo — senão não haveria cópia nenhuma.
        else if (metodo === "gbak" && !podeGbakDireto && origem.arquivo) { log("Cópia offline: banco só acessível como arquivo (" + origem.arquivo + ") — copiando o arquivo em vez do gbak direto."); viaArquivo(); }
        else if (metodo === "arquivo") falhar(new Error("sem acesso ao ARQUIVO do banco principal (pasta local, unidade de rede ou compartilhamento) — com offlineMetodo \"arquivo\" o gbak direto não é usado"), "cópia do arquivo");
        else viaGbakDireto("");
        });
    };

    // Copia o arquivo do banco sem abri-lo no Firebird. Só aceita a cópia se o
    // arquivo NÃO mudou do começo ao fim (tamanho e data iguais) — senão a
    // cópia pode misturar páginas de momentos diferentes. Espera o banco ficar
    // sem gravações por `quietoMs` antes de começar e tenta `tentativasArquivo` vezes.
    const copiarArquivoConsistente = (src, dst, cb) => {
        let tentativa = 0, esperas = 0;
        const tentar = () => {
            if (parado) { cb(new Error("cancelada")); return; }
            let s0;
            try { s0 = fs.statSync(src); } catch (e) { cb(e); return; }
            if (!s0.isFile() || s0.size <= 0) { cb(new Error("arquivo do banco vazio ou inválido: " + src)); return; }
            if (Date.now() - s0.mtimeMs < quietoMs && esperas < 20) {
                esperas++;
                etapa("aguardando o banco ficar sem gravações para copiar o arquivo");
                const t = setTimeout(tentar, Math.max(500, Math.min(quietoMs, 3000)));
                if (t.unref) t.unref();
                return;
            }
            tentativa++;
            etapa("copiando o arquivo do banco para a pasta temporária (sem conectar)" + (tentativa > 1 ? " — tentativa " + tentativa : ""), { arquivo: dst, esperado: s0.size, de: 0, ate: 25 });
            const inicio = Date.now();
            let leitor, escritor;
            try {
                leitor = fs.createReadStream(src, { flags: "r", highWaterMark: 1 << 20 }); // só leitura
                escritor = fs.createWriteStream(dst, { flags: "w" });
            } catch (e) { cb(e); return; }
            pipeline(leitor, escritor, (e) => {
                if (e) { cb(e); return; }
                try { if (ganchoTeste && typeof ganchoTeste.depoisDeLer === "function") ganchoTeste.depoisDeLer(src, tentativa); } catch (_) {}
                let s1, d;
                try { s1 = fs.statSync(src); d = fs.statSync(dst); } catch (e2) { cb(e2); return; }
                const mudou = s1.size !== s0.size || Math.round(s1.mtimeMs) !== Math.round(s0.mtimeMs) || d.size !== s0.size;
                if (!mudou) { cb(null, inicio); return; }
                if (tentativa < tentativasArquivo) {
                    log("Cópia offline: o banco foi gravado durante a cópia do arquivo — descartada, tentando de novo.");
                    const t = setTimeout(tentar, 2000);
                    if (t.unref) t.unref();
                    return;
                }
                cb(new Error("o banco foi gravado durante a cópia do arquivo em " + tentativa + " tentativa(s) — cópia descartada"));
            });
        };
        tentar();
    };

    // ── Para onde o relatório olha: SEMPRE a cópia ──────────────────────────
    // O sistema nunca lê o banco principal. Sem cópia pronta, o relatório
    // espera (tela "Preparando a cópia offline").
    const copiaUsavel = () => !!(st.ativa && st.ativa.arquivo && fs.existsSync(st.ativa.arquivo));
    // Banco principal: {host, path} para o gbak direto e/ou `arquivo` (pasta
    // local, unidade de rede ou \\servidor\compartilhamento) para copiar sem conectar.
    const fonteAtual = () => {
        const f = typeof o.fonte === "function" ? (o.fonte() || {}) : {};
        if (!f || (!f.path && !f.arquivo)) return null;
        const r = { host: f.path ? (f.host || "127.0.0.1") : "", path: f.path || "", arquivo: f.arquivo || "",
            candidatos: Array.isArray(f.candidatos) ? f.candidatos : [] };
        // Banco nesta máquina: o próprio caminho serve para copiar o arquivo — só se ele
        // EXISTIR aqui (num terminal, "127.0.0.1 + caminho do servidor" não existe e
        // travava a verificação antes de tentar os endereços candidatos).
        // Sem candidatos, o caminho local é o banco desta máquina: se sumir, é avisado.
        if (!r.arquivo && r.path && _ehLocal(r.host)) {
            let existe = false;
            try { existe = fs.statSync(r.path).isFile(); } catch (_) {}
            if (existe || !r.candidatos.length) r.arquivo = r.path;
        }
        return r;
    };
    const aplicarLeitura = (motivo) => {
        if (!copiaUsavel()) return;
        st.lendo = "copia";
        if (typeof o.aoTrocar === "function") o.aoTrocar("127.0.0.1", st.ativa.arquivo, { motivo, lendo: "copia", dadosDe: st.ativa.dadosDe });
    };

    // ── Detecção de mudança SEM conectar no banco principal ─────────────────
    // Banco principal nesta máquina: tamanho + data de alteração do arquivo
    // (só leitura dos atributos, nunca abre o banco). Em outra máquina: não dá
    // para olhar o arquivo — a cópia é refeita a cada 3× o intervalo mínimo.
    const assinaturaArquivo = f => {
        if (!f || !f.arquivo) return { remoto: true };
        try { const s = fs.statSync(f.arquivo); return { sig: s.size + "|" + Math.round(s.mtimeMs) }; }
        catch (e) { return { erro: e && e.code === "ENOENT" ? "Arquivo do banco principal não encontrado: " + f.arquivo : "Não consegui ler os atributos do banco principal (" + f.arquivo + "): " + _txt(e && e.message, 200) }; }
    };
    const chaveFonte = x => [String(x && x.host || ""), _norm(x && x.path), _norm(x && x.arquivo)].join("|");

    const agendarVerificacao = (ms) => {
        clearTimeout(timerVerif);
        if (parado) return;
        timerVerif = setTimeout(verificar, Math.max(1000, ms));
        if (timerVerif.unref) timerVerif.unref();
    };
    // A verificação NUNCA pode parar: erro inesperado → registra e reagenda.
    const verificar = () => {
        try { verificarSeguro(); }
        catch (e) {
            log("Cópia offline: erro inesperado na verificação (" + _txt(e && (e.stack || e.message || e), 300) + ") — tentando de novo.");
            agendarVerificacao(verificarMs);
        }
    };
    const verificarSeguro = () => {
        if (parado) return;
        if (st.limpando) { agendarVerificacao(1000); return; } // encerrando gbak de uma execução anterior
        // Cópia "em andamento" além de todo prazo possível (algo travou): libera.
        if (st.emAndamento && st.ultimaTentativa && Date.now() - st.ultimaTentativa > timeoutMs * 2 + 120000) {
            log("Cópia offline: a cópia iniciada às " + new Date(st.ultimaTentativa).toLocaleTimeString("pt-BR") + " não terminou — liberando para tentar de novo.");
            st.emAndamento = false; st.etapa = ""; geracao++;
            if (filhoAtual) { matarFilho(filhoAtual); filhoAtual = null; }
        }
        const f = fonteAtual();
        if (!f) { agendarVerificacao(verificarMs); return; }
        st.ultimaVerificacao = Date.now();
        const a = assinaturaArquivo(f);
        if (a.erro) {
            if (st.fonteOk !== false || st.fonteErroDe !== "arquivo") {
                st.fonteOk = false; st.fonteDesde = Date.now(); st.fonteErro = a.erro; st.fonteErroDe = "arquivo";
                log(a.erro + (copiaUsavel() ? " — o relatório segue com a cópia de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + "." : ""));
            }
            if (!st.ativa && !st.tentouFbkDisco) { st.tentouFbkDisco = true; api.tentarFbkDoDisco(o.fbkExtras || [], () => {}); }
            agendarVerificacao(verificarMs);
            return;
        }
        if (st.fonteErroDe === "arquivo") { st.fonteOk = null; st.fonteErro = ""; st.fonteErroDe = ""; log("Arquivo do banco principal encontrado de novo."); }
        const agora = Date.now();
        const mesmaFonte = !!(st.ativa && st.ativa.origem === "fdb" && st.ativa.fonte && chaveFonte(st.ativa.fonte) === chaveFonte(f));
        const mudou = !mesmaFonte || (a.remoto ? agora - (st.ativa.dadosDe || 0) >= intervaloMinMs * 3 : st.ativa.sig !== a.sig);
        const velha = st.ativa && agora - (st.ativa.dadosDe || 0) > maxIdadeMs;
        const periodica = st.ativa && agora - (st.ativa.dadosDe || 0) >= periodoMs;
        const manual = st.pedidoManual;
        if (gbak && !st.emAndamento && (manual || ((mudou || velha || periodica) && agora >= st.proximaPermitida))) {
            st.pedidoManual = false;
            const motivo = manual ? "pedido manual" : (!st.ativa ? "primeira cópia" : !mesmaFonte ? "banco principal trocado"
                : mudou ? (a.remoto ? "atualização periódica (banco em outra máquina)" : "banco principal alterado")
                : periodica && !velha ? "atualização periódica (a cada " + Math.round(periodoMs / 60000) + " min)" : "cópia com mais de " + Math.round(maxIdadeMs / 60000) + " min");
            executarCopia({ tipo: "fdb", host: f.host, path: f.path, arquivo: f.arquivo, candidatos: f.candidatos }, motivo, (r) => {
                // O próprio backup mexe no cabeçalho do banco (contador de transações):
                // a assinatura é lida DEPOIS dele, senão toda cópia pediria outra.
                setTimeout(() => {
                    if (r && r.ok && st.ativa && st.ativa.origem === "fdb") {
                        const d = assinaturaArquivo(f);
                        if (d.sig) { st.ativa.sig = d.sig; gravarManifesto(); }
                    }
                    agendarVerificacao(verificarMs);
                }, 3000);
            });
            return;
        }
        agendarVerificacao(verificarMs);
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
            if (!copiaUsavel()) return null;
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
            if (!gbak) st.indisponivel = "gbak.exe não encontrado nesta máquina (instale o Firebird ou informe \"gbakPath\" no config.json).";
            if (!o.Firebird) st.indisponivel = "node-firebird indisponível.";
            const erroPasta = garantirPasta();
            if (erroPasta) { st.indisponivel = erroPasta; log(erroPasta); }
            limparOrfaos();
            // Servidor encerrado à força (Gerenciador de Tarefas, queda): o gbak que estava
            // copiando pode ter ficado rodando sozinho. Ele só LÊ o banco (não corrompe nada),
            // mas segura uma conexão e o disco à toa: encerra e apaga o que ele deixou.
            // Nenhuma cópia nova começa antes disso (senão o gbak NOVO seria encerrado junto).
            st.limpando = true;
            encerrarGbakOrfaos(() => { st.limpando = false; if (!parado) limparOrfaos(); });
            log("Cópia offline " + VERSAO + ": método \"" + metodo + "\"" + (metodo !== "gbak" ? " (copia o arquivo para a pasta temporária e converte de lá" + (gfix ? ", validando com gfix" : "") + ")" : "") + " | pasta " + pasta + " | gbak " + (gbak || "não encontrado") +
                " | verifica o arquivo do banco a cada " + Math.round(verificarMs / 1000) + " s (sem conectar) | intervalo mínimo entre cópias " + Math.round(intervaloMinMs / 60000) + " min" +
                (st.ativa ? " | cópia em uso: " + path.basename(st.ativa.arquivo) + " (dados de " + new Date(st.ativa.dadosDe).toLocaleString("pt-BR") + ")" : " | ainda sem cópia"));
            if (st.indisponivel) log("Cópia offline indisponível: " + st.indisponivel + " Sem cópia o relatório não abre (o sistema não lê o banco principal direto).");
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
            if (!gbak) { cb({ ok: false, erro: st.indisponivel || "gbak não encontrado." }); return; }
            if (st.emAndamento) { cb({ ok: true, jaEmAndamento: true, msg: "A cópia já está sendo feita (" + st.etapa + ")." }); return; }
            st.pedidoManual = true;
            agendarVerificacao(0);
            cb({ ok: true, msg: "Cópia offline solicitada. O relatório troca sozinho para a cópia nova quando ela ficar pronta." });
        },
        /** Restaura um .fbk escolhido pelo usuário e passa a ler dele. */
        importarFbk(arquivo, cb) {
            cb = typeof cb === "function" ? cb : () => {};
            let s = null; try { s = fs.statSync(String(arquivo || "")); } catch (_) {}
            if (!s || !s.isFile() || s.size <= 0) { cb({ ok: false, erro: "Arquivo de backup não encontrado: " + arquivo }); return; }
            if (!/\.(fbk|gbk)$/i.test(String(arquivo))) { cb({ ok: false, erro: "O arquivo precisa ser um backup do Firebird (.fbk ou .gbk)." }); return; }
            executarCopia({ tipo: "fbk", arquivo: path.resolve(String(arquivo)) }, "backup escolhido pelo usuário", cb);
        },
        /** Sem cópia e sem banco principal: tenta um SMALL.fbk do disco. */
        tentarFbkDoDisco(extras, cb) {
            cb = typeof cb === "function" ? cb : () => {};
            if (!gbak || st.ativa || st.emAndamento) { cb({ ok: false }); return; }
            const fbk = procurarFbk(extras);
            if (!fbk) { cb({ ok: false, erro: "Nenhum SMALL.fbk encontrado nos locais conhecidos." }); return; }
            log("Sem banco principal e sem cópia: usando o backup encontrado em " + fbk + ".");
            executarCopia({ tipo: "fbk", arquivo: fbk }, "backup encontrado no disco", cb);
        },
        /** Muda as opções em tempo real (tela de configurações). */
        configurar(novas) {
            const n = novas || {};
            if (n.intervaloMinMs !== undefined) intervaloMinMs = _faixa(n.intervaloMinMs, 5000, 24 * 3600000, intervaloMinMs);
            if (n.verificarMs !== undefined) verificarMs = _faixa(n.verificarMs, 5000, 3600000, verificarMs);
            if (n.periodoMs !== undefined) periodoMs = _faixa(n.periodoMs, 60000, 24 * 3600000, periodoMs);
            if (n.maxIdadeMs !== undefined) maxIdadeMs = _faixa(n.maxIdadeMs, 5 * 60000, 7 * 24 * 3600000, maxIdadeMs);
            if (n.metodo !== undefined && ["auto", "arquivo", "gbak"].indexOf(String(n.metodo)) >= 0 && n.metodo !== metodo) { log("Cópia offline: método \"" + metodo + "\" → \"" + n.metodo + "\"."); metodo = String(n.metodo); }
            if (n.timeoutMs !== undefined) timeoutMs = _faixa(n.timeoutMs, 60000, 6 * 3600000, timeoutMs);
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
                    vendas: st.ativa.vendas, metodo: st.ativa.metodo || null
                } : null,
                metodo, gfix: gfix || null,
                fonte: (() => { const f = fonteAtual(); return f ? { host: f.host, path: f.path, arquivo: f.arquivo } : null; })(),
                fonteOk: st.fonteOk, fonteErro: st.fonteErro || null, fonteDesde: st.fonteDesde || null,
                emAndamento: st.emAndamento, etapa: st.etapa || null, etapaDesde: st.etapaDesde || null,
                progresso: progresso(),
                ultimaTentativa: st.ultimaTentativa || null, ultimoOk: st.ultimoOk || null, ultimoErro: st.ultimoErro || null,
                proximaPermitida: st.proximaPermitida || null, ultimaVerificacao: st.ultimaVerificacao || null,
                intervaloMinMin: Math.round(intervaloMinMs / 60000), verificarSeg: Math.round(verificarMs / 1000),
                periodoMin: Math.round(periodoMs / 60000),
                proximaCopia: st.ativa ? Math.max(st.proximaPermitida || 0, (st.ativa.dadosDe || 0) + periodoMs) : null,
                servidorUsado: st.ativa && st.ativa.servidorUsado || null,
                pendentesApagar: st.pendentesApagar.length
            };
        }
    };

    lerManifesto();
    return api;
}

module.exports = { criarCopiaOffline, localizarGbak, pastaPadrao, explicarErro, VERSAO, RE_COPIA };
