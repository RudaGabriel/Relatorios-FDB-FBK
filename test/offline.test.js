"use strict";
// Testes da cópia offline (offline-copia.js + integração no servidor).
// Rodam sem Firebird real: gbak simulado (test/mock-gbak.js), Firebird
// simulado (objeto falso aqui, ou test/mock-firebird no servidor) e um socket
// TCP qualquer fazendo o papel do "Firebird desta máquina".
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const crypto = require("node:crypto");
const { spawn } = require("node:child_process");

const RAIZ = path.join(__dirname, "..");
const { criarCopiaOffline, RE_COPIA } = require(path.join(RAIZ, "offline-copia.js"));
const GBAK = path.join(__dirname, "mock-gbak.js");
const esperar = ms => new Promise(r => setTimeout(r, ms));
const hash = f => crypto.createHash("sha256").update(fs.readFileSync(f)).digest("hex");
const ate = async (cond, ms, passo) => { const fim = Date.now() + ms; while (Date.now() < fim) { if (cond()) return true; await esperar(passo || 100); } return cond(); };

// "Firebird desta máquina": só precisa aceitar conexão TCP.
const abrirPortaLocal = () => new Promise((resolve, reject) => {
    const s = net.createServer(c => c.destroy());
    s.once("error", reject);
    s.listen(0, "127.0.0.1", () => resolve({ porta: s.address().port, fechar: () => new Promise(r => s.close(() => r())) }));
});

// Firebird falso: responde à conferência da cópia e registra onde conectou.
const firebirdFalso = () => {
    const conexoes = [];
    return {
        conexoes,
        attach(opts, cb) {
            conexoes.push(opts.database);
            setImmediate(() => cb(null, {
                query(sql, params, cb2) {
                    if (/RDB\$RELATIONS/.test(sql)) return setImmediate(() => cb2(null, [{ N: 1 }]));
                    if (/FROM NFCE/.test(sql)) return setImmediate(() => cb2(null, [{ N: 42 }]));
                    setImmediate(() => cb2(null, []));
                },
                detach(c) { if (c) c(); }
            }));
        }
    };
};

function montar(extra) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "copia-teste-"));
    const fonte = path.join(dir, "SMALL.FDB");
    fs.writeFileSync(fonte, "BANCO-PRINCIPAL-" + "x".repeat(4096));
    const pasta = path.join(dir, "copias");
    const logs = [], trocas = [];
    let sig = "sig-1", erroFonte = null;
    const fb = firebirdFalso();
    const opcoes = Object.assign({
        pasta, gbak: GBAK, user: "SYSDBA", pass: "senha-secreta-123", Firebird: fb,
        fonte: () => ({ host: "127.0.0.1", path: fonte }),
        assinatura: (h, p, cb) => setImmediate(() => erroFonte ? cb(new Error(erroFonte)) : cb(null, sig)),
        aoTrocar: (h, p, info) => trocas.push({ h, p, info }),
        log: m => logs.push(m), verificarMs: 5000, intervaloMinMs: 30000
    }, extra || {});
    return {
        dir, fonte, pasta, logs, trocas, fb, opcoes,
        setSig: v => { sig = v; }, setErroFonte: v => { erroFonte = v; },
        copias: () => { try { return fs.readdirSync(pasta).filter(n => RE_COPIA.test(n)); } catch (_) { return []; } }
    };
}

test("cópia offline: primeira cópia é feita sozinha, conferida e passa a ser lida; o banco principal não muda", async () => {
    const local = await abrirPortaLocal();
    const logGbak = path.join(os.tmpdir(), "gbak-" + process.pid + "-1.log");
    process.env.MOCK_GBAK_LOG = logGbak;
    const t = montar({ porta: local.porta });
    const antes = hash(t.fonte), mtimeAntes = fs.statSync(t.fonte).mtimeMs;
    const oc = criarCopiaOffline(t.opcoes);
    try {
        assert.strictEqual(oc.copiaInicial(), null, "sem cópia ainda: começa pelo banco principal");
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não trocou para a cópia: " + t.logs.join(" | "));
        const tr = t.trocas[0];
        assert.strictEqual(tr.info.lendo, "copia");
        assert.ok(RE_COPIA.test(path.basename(tr.p)), "nome da cópia fora do padrão: " + tr.p);
        assert.strictEqual(path.dirname(tr.p), t.pasta);
        assert.ok(fs.existsSync(tr.p));
        assert.strictEqual(fs.readFileSync(tr.p, "utf8"), fs.readFileSync(t.fonte, "utf8"), "conteúdo da cópia difere");
        assert.ok(fs.existsSync(path.join(t.pasta, "ultimo-backup.fbk")), "último backup não foi guardado");
        assert.ok(t.fb.conexoes.includes(tr.p), "a cópia nova não foi conferida antes da troca");
        // Banco principal intacto.
        assert.strictEqual(hash(t.fonte), antes);
        assert.strictEqual(fs.statSync(t.fonte).mtimeMs, mtimeAntes);
        // gbak: backup sem coleta de lixo (-g), cópia somente leitura, senha só por ambiente.
        const chamadas = fs.readFileSync(logGbak, "utf8").trim().split("\n").map(l => JSON.parse(l));
        const bk = chamadas.find(c => c.args.includes("-b")), rs = chamadas.find(c => c.args.includes("-c"));
        assert.ok(bk && bk.args.includes("-g"), "backup sem -g");
        assert.ok(rs && rs.args.join(" ").includes("-mode read_only"), "restauração sem -mode read_only");
        chamadas.forEach(c => {
            assert.ok(c.senhaPorAmbiente && c.usuarioPorAmbiente, "credenciais não vieram por variável de ambiente");
            assert.ok(!c.args.join(" ").includes("senha-secreta-123"), "senha apareceu na linha de comando");
        });
        const st = oc.status();
        assert.strictEqual(st.lendo, "copia");
        assert.strictEqual(st.copia.vendas, 42);
        assert.strictEqual(st.fonteOk, true);
        // Manifesto: um novo gerenciador na mesma pasta já abre direto na cópia.
        const oc2 = criarCopiaOffline(t.opcoes);
        const ini = oc2.copiaInicial();
        assert.ok(ini && ini.path === tr.p, "manifesto não reabre a cópia");
        assert.ok(oc.ehCopia(tr.p) && !oc.ehCopia(t.fonte));
    } finally { oc.parar(); delete process.env.MOCK_GBAK_LOG; await local.fechar(); }
});

test("cópia offline: falha no gbak mantém a cópia anterior e limpa os temporários", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "primeira cópia não saiu");
        const boa = t.trocas[0].p;
        process.env.MOCK_GBAK_FALHAR = "backup";
        let resp = null;
        oc.atualizarAgora(r => { resp = r; });
        assert.ok(resp && resp.ok, "pedido manual recusado");
        assert.ok(await ate(() => !!oc.status().ultimoErro, 15000), "falha não foi registrada");
        const st = oc.status();
        assert.match(st.ultimoErro, /manutenção|bloqueado|backup/i);
        assert.strictEqual(st.copia.arquivo, path.basename(boa), "perdeu a cópia boa");
        assert.ok(fs.existsSync(boa));
        assert.strictEqual(t.trocas.length, 1, "trocou de leitura mesmo com falha");
        assert.deepStrictEqual(fs.readdirSync(t.pasta).filter(n => /\.tmp$/i.test(n)), [], "sobrou temporário");
        // Restauração falhando também não estraga nada.
        process.env.MOCK_GBAK_FALHAR = "restauracao";
        const r2 = await new Promise(r => oc.importarFbk(path.join(t.pasta, "ultimo-backup.fbk"), r));
        assert.strictEqual(r2.ok, false);
        assert.ok(fs.existsSync(boa));
        assert.deepStrictEqual(t.copias(), [path.basename(boa)], "cópia parcial ficou na pasta");
    } finally { delete process.env.MOCK_GBAK_FALHAR; oc.parar(); await local.fechar(); }
});

test("cópia offline: mudança nas vendas gera cópia nova e a antiga é apagada (nunca o banco principal)", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000));
        const primeira = t.trocas[0].p;
        await esperar(1100); // nome da cópia tem resolução de segundos
        t.setSig("sig-2");
        fs.appendFileSync(t.fonte, "VENDA-NOVA");
        oc.atualizarAgora(); // pula o intervalo mínimo
        assert.ok(await ate(() => t.trocas.length > 1, 15000), "não fez a segunda cópia");
        const segunda = t.trocas[1].p;
        assert.notStrictEqual(segunda, primeira);
        assert.ok(fs.readFileSync(segunda, "utf8").endsWith("VENDA-NOVA"));
        oc.parar();
        // Ao iniciar de novo, a cópia antiga (fora do manifesto) é apagada.
        const oc2 = criarCopiaOffline(t.opcoes);
        oc2.iniciar(); oc2.parar();
        assert.ok(!fs.existsSync(primeira), "cópia antiga não foi apagada");
        assert.ok(fs.existsSync(segunda), "apagou a cópia em uso");
        assert.ok(fs.existsSync(t.fonte), "apagou o banco principal");
        // Arquivo com cara de cópia fora da pasta das cópias nunca é tratado como cópia.
        const intruso = path.join(t.dir, "SMALL_OFFLINE_20260101_000000.FDB");
        fs.writeFileSync(intruso, "x");
        assert.strictEqual(oc2.ehCopia(intruso), false);
    } finally { oc.parar(); await local.fechar(); }
});

test("cópia offline: modo híbrido lê o banco ao vivo e cai para a cópia quando ele fica indisponível", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta, modo: "hibrido" });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        assert.strictEqual(oc.copiaInicial(), null, "híbrido começa pelo banco principal");
        oc.iniciar();
        assert.ok(await ate(() => oc.status().copia !== null, 15000), "não fez a cópia de reserva");
        assert.strictEqual(oc.status().lendo, "fonte", "híbrido com banco no ar deveria ler ao vivo");
        t.setErroFonte("Error: database shutdown");
        assert.ok(await ate(() => oc.status().lendo === "copia", 20000), "não caiu para a cópia");
        const st = oc.status();
        assert.strictEqual(st.fonteOk, false);
        assert.match(st.fonteErro, /manutenção|bloqueado/i);
        assert.strictEqual(t.trocas[t.trocas.length - 1].info.lendo, "copia");
        t.setErroFonte(null);
        assert.ok(await ate(() => oc.status().lendo === "fonte", 15000), "não voltou ao banco principal");
        assert.strictEqual(t.trocas[t.trocas.length - 1].p, t.fonte);
    } finally { oc.parar(); await local.fechar(); }
});

test("cópia offline: sem Firebird nesta máquina não faz backup do banco principal à toa", async () => {
    const livre = await abrirPortaLocal(); const porta = livre.porta; await livre.fechar(); // porta sem ninguém
    const logGbak = path.join(os.tmpdir(), "gbak-" + process.pid + "-5.log");
    try { fs.unlinkSync(logGbak); } catch (_) {}
    process.env.MOCK_GBAK_LOG = logGbak;
    const t = montar({ porta });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => !!oc.status().indisponivel, 15000), "não informou o motivo");
        assert.match(oc.status().indisponivel, /Firebird não está rodando/);
        assert.ok(!fs.existsSync(logGbak), "chamou o gbak mesmo sem Firebird local");
        assert.strictEqual(t.trocas.length, 0);
    } finally { oc.parar(); delete process.env.MOCK_GBAK_LOG; }
});

test("cópia offline: modo desligado não copia nada; .fbk escolhido vira a cópia", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta, modo: "desligado" });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        await esperar(2500);
        assert.deepStrictEqual(t.copias(), []);
        const r = await new Promise(res => oc.atualizarAgora(res));
        assert.strictEqual(r.ok, false);
        oc.configurar({ modo: "copia" });
        const fbk = path.join(t.dir, "SMALL.fbk");
        fs.writeFileSync(fbk, Buffer.concat([Buffer.from("FBK1\n"), Buffer.from("DADOS-DO-BACKUP")]));
        const r2 = await new Promise(res => oc.importarFbk(fbk, res));
        assert.ok(r2.ok, "importação falhou: " + JSON.stringify(r2));
        assert.strictEqual(oc.status().copia.origem, "fbk");
        assert.strictEqual(fs.readFileSync(path.join(t.pasta, oc.status().copia.arquivo), "utf8"), "DADOS-DO-BACKUP");
        const r3 = await new Promise(res => oc.importarFbk(path.join(t.dir, "nao-existe.fbk"), res));
        assert.strictEqual(r3.ok, false);
        const r4 = await new Promise(res => oc.importarFbk(t.fonte, res));
        assert.strictEqual(r4.ok, false, "aceitou um .FDB como backup");
    } finally { oc.parar(); await local.fechar(); }
});

// ---------------------------------------------------------------------------
// Integração com o servidor (Firebird simulado de test/mock-firebird).
// O servidor confere o "Firebird desta máquina" na porta 3050: o teste abre
// um socket nela (se já houver algo escutando, também serve).
// ---------------------------------------------------------------------------
const portaLivre = () => new Promise((resolve, reject) => {
    const s = net.createServer(); s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});
const abrir3050 = () => new Promise(resolve => {
    const s = net.createServer(c => c.destroy());
    s.once("error", () => resolve({ fechar: async () => {} }));
    s.listen(3050, "127.0.0.1", () => resolve({ fechar: () => new Promise(r => s.close(() => r())) }));
});

test("servidor: lê a cópia offline, mostra o selo e não grava o endereço da cópia no config.json", async () => {
    const p3050 = await abrir3050();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srv-copia-"));
    for (const f of ["servidor-relatorio.js", "gerar-relatorio-html.js", "offline-copia.js"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
    const mock = path.join(dir, "node_modules", "node-firebird");
    fs.mkdirSync(mock, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "index.js"), path.join(mock, "index.js"));
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "package.json"), path.join(mock, "package.json"));
    const fonte = path.join(dir, "SMALL.FDB");
    fs.writeFileSync(fonte, "BANCO");
    const porta = await portaLivre();
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({
        appName: "Teste Offline", porta, pollInterval: 200, fbHost: "127.0.0.1", fdbPath: fonte,
        offlineModo: "copia", offlinePasta: path.join(dir, "copias"), gbakPath: GBAK, offlineVerificarSeg: 5
    }, null, 2));
    const pad = n => String(n).padStart(2, "0"), d = new Date();
    const hora = [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad).join(":");
    fs.writeFileSync(path.join(dir, "estado.json"), JSON.stringify({ nfce: [{ numero: "500", hora }], pag: [], ger: [] }));
    const env = Object.assign({}, process.env, { MOCK_SENHA: "s", RELATORIO_FB_PASS: "s", MOCK_FB_DIR: dir });
    const proc = spawn(process.execPath, ["servidor-relatorio.js", "--no-browser"], { cwd: dir, env, stdio: "ignore" });
    const base = "http://127.0.0.1:" + porta;
    const json = async r => (await fetch(base + r, { cache: "no-store" })).json();
    try {
        let st = null;
        assert.ok(await ate(() => false, 0) || true);
        for (let i = 0; i < 150; i++) {
            try { st = await json("/api/offline"); if (st && st.lendo === "copia") break; } catch (_) {}
            await esperar(200);
        }
        assert.ok(st && st.lendo === "copia", "servidor não passou a ler a cópia: " + JSON.stringify(st));
        assert.strictEqual(st.modo, "copia");
        assert.ok(st.copia && RE_COPIA.test(st.copia.arquivo));
        const info = await json("/api/info");
        assert.ok(RE_COPIA.test(path.basename(info.banco.caminho)), "relatório não está lendo a cópia");
        assert.strictEqual(info.bancoPrincipal.path, fonte, "perdeu o banco principal");
        // Relatório gerado a partir da cópia, com o selo.
        let html = "";
        for (let i = 0; i < 100; i++) {
            html = await (await fetch(base + "/")).text();
            if (html.includes("__off_chip")) break;
            await esperar(200);
        }
        assert.ok(html.includes("__off_chip"), "selo offline não foi injetado");
        // config.json continua apontando para o banco principal.
        const cfg = JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8"));
        assert.strictEqual(cfg.fdbPath, fonte);
        assert.strictEqual(cfg.fbHost, "127.0.0.1");
        // Escolher a própria cópia como banco é recusado.
        const r = await (await fetch(base + "/api/salvar-fdb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho: info.banco.caminho }) })).json();
        assert.strictEqual(r.ok, false);
        assert.match(r.erro, /cópia offline/);
        // Pedido de cópia nova pela API.
        const at = await (await fetch(base + "/api/offline/atualizar", { method: "POST" })).json();
        assert.strictEqual(at.ok, true, JSON.stringify(at));
        // Configuração da cópia: validação de faixa.
        const ruim = await fetch(base + "/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offlineIntervaloMin: 0 }) });
        assert.strictEqual(ruim.status, 400);
        const bom = await fetch(base + "/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offlineIntervaloMin: 9 }) });
        assert.strictEqual(bom.status, 200);
        assert.strictEqual((await json("/api/offline")).intervaloMinMin, 9);
        // Somente leitura também na cópia: nenhuma transação de escrita.
        const sqlLog = (() => { try { return fs.readFileSync(path.join(dir, "sql.log"), "utf8"); } catch (_) { return ""; } })();
        assert.ok(!/TX_ESCRITA|^UPDATE/m.test(sqlLog), "houve escrita: " + sqlLog.slice(0, 300));
        assert.strictEqual(fs.readFileSync(fonte, "utf8"), "BANCO", "banco principal foi alterado");
    } finally {
        try { proc.kill(); } catch (_) {}
        await p3050.fechar();
    }
});
