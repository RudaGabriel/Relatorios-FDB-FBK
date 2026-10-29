"use strict";
// Testes da cópia offline (offline-copia.js + integração no servidor).
// Rodam sem Firebird real: gbak simulado (test/mock-gbak.js), Firebird
// simulado (objeto falso aqui, ou test/mock-firebird no servidor) e um socket
// TCP qualquer fazendo o papel do "Firebird desta máquina".
// Regra central conferida em todos: o sistema NUNCA conecta direto no banco
// principal — só o gbak encosta nele, para copiar.
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
const GFIX = path.join(__dirname, "mock-gfix.js");
const { localizarBanco, lerReferencias } = require(path.join(RAIZ, "localizar-banco.js"));
const lerLog = f => { try { return fs.readFileSync(f, "utf8").trim().split("\n").filter(Boolean).map(l => JSON.parse(l)); } catch (_) { return []; } };
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
    const fb = firebirdFalso();
    let host = "127.0.0.1";
    const opcoes = Object.assign({
        pasta, gbak: GBAK, user: "SYSDBA", pass: "senha-secreta-123", Firebird: fb,
        fonte: () => ({ host, path: fonte }),
        aoTrocar: (h, p, info) => trocas.push({ h, p, info }),
        log: m => logs.push(m), verificarMs: 5000, intervaloMinMs: 600000, quietoMs: 0, metodo: "auto"
    }, extra || {});
    return {
        dir, fonte, pasta, logs, trocas, fb, opcoes, setHost: h => { host = h; },
        copias: () => { try { return fs.readdirSync(pasta).filter(n => RE_COPIA.test(n)); } catch (_) { return []; } },
        // Nenhuma conexão do sistema pode ter ido para o banco principal.
        semConexaoNaFonte: () => assert.ok(!fb.conexoes.some(d => path.resolve(String(d)) === path.resolve(fonte)), "conectou direto no banco principal: " + fb.conexoes.join(", "))
    };
}

test("cópia offline: primeira cópia sozinha, conferida e lida; o banco principal não é aberto nem alterado", async () => {
    const local = await abrirPortaLocal();
    const logGbak = path.join(os.tmpdir(), "gbak-" + process.pid + "-1.log");
    process.env.MOCK_GBAK_LOG = logGbak;
    const t = montar({ porta: local.porta });
    const antes = hash(t.fonte), mtimeAntes = fs.statSync(t.fonte).mtimeMs;
    const oc = criarCopiaOffline(t.opcoes);
    try {
        assert.strictEqual(oc.copiaInicial(), null, "sem cópia ainda: nada para ler");
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não trocou para a cópia: " + t.logs.join(" | "));
        const tr = t.trocas[0];
        assert.strictEqual(tr.info.lendo, "copia");
        assert.ok(RE_COPIA.test(path.basename(tr.p)), "nome da cópia fora do padrão: " + tr.p);
        assert.strictEqual(path.dirname(tr.p), t.pasta);
        assert.strictEqual(fs.readFileSync(tr.p, "utf8"), fs.readFileSync(t.fonte, "utf8"), "conteúdo da cópia difere");
        assert.ok(fs.existsSync(path.join(t.pasta, "ultimo-backup.fbk")), "último backup não foi guardado");
        assert.ok(t.fb.conexoes.includes(tr.p), "a cópia nova não foi conferida antes da troca");
        t.semConexaoNaFonte();
        assert.strictEqual(hash(t.fonte), antes);
        assert.strictEqual(fs.statSync(t.fonte).mtimeMs, mtimeAntes);
        // gbak: backup sem coleta de lixo (-g), cópia somente leitura, senha só por ambiente.
        const chamadas = fs.readFileSync(logGbak, "utf8").trim().split("\n").map(l => JSON.parse(l));
        const bk = chamadas.find(c => c.args.includes("-b")), rs = chamadas.find(c => c.args.includes("-c"));
        assert.ok(bk && bk.args.includes("-g"), "backup sem -g");
        // Padrão: copia o ARQUIVO para a pasta temporária e o gbak converte a CÓPIA — nunca o banco.
        const origemBk = bk.args[bk.args.length - 2];
        assert.ok(/\.copia\.tmp$/.test(origemBk) && origemBk.includes(path.join(t.pasta, "temp")), "o backup não saiu da cópia temporária: " + origemBk);
        chamadas.forEach(c => assert.ok(!c.args.some(x => x.endsWith(t.fonte)), "o gbak recebeu o banco principal: " + c.args.join(" ")));
        assert.deepStrictEqual(fs.readdirSync(path.join(t.pasta, "temp")), [], "cópia temporária não foi apagada");
        assert.strictEqual(oc.status().copia.metodo, "arquivo");
        assert.ok(rs && rs.args.join(" ").includes("-mode read_only"), "restauração sem -mode read_only");
        chamadas.forEach(c => {
            assert.ok(c.senhaPorAmbiente && c.usuarioPorAmbiente, "credenciais não vieram por variável de ambiente");
            assert.ok(!c.args.join(" ").includes("senha-secreta-123"), "senha apareceu na linha de comando");
        });
        const st = oc.status();
        assert.strictEqual(st.lendo, "copia");
        assert.strictEqual(st.modo, "copia");
        assert.strictEqual(st.copia.vendas, 42);
        assert.strictEqual(st.fonteOk, true);
        // Manifesto: um novo gerenciador na mesma pasta já abre direto na cópia.
        const oc2 = criarCopiaOffline(t.opcoes);
        const ini = oc2.copiaInicial();
        assert.ok(ini && ini.path === tr.p, "manifesto não reabre a cópia");
        assert.ok(oc.ehCopia(tr.p) && !oc.ehCopia(t.fonte));
    } finally { oc.parar(); delete process.env.MOCK_GBAK_LOG; await local.fechar(); }
});

test("cópia offline: arquivo do banco alterado gera cópia nova sozinho (sem conectar); parado, não copia de novo", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta, intervaloMinMs: 5000 });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "primeira cópia não saiu");
        const primeira = t.trocas[0].p;
        // Sem mudança no arquivo: nenhuma cópia nova (a assinatura é lida depois do próprio backup).
        await esperar(12000);
        assert.strictEqual(t.trocas.length, 1, "copiou de novo sem o banco mudar");
        // Venda nova: o arquivo muda → cópia nova automática.
        fs.appendFileSync(t.fonte, "VENDA-NOVA");
        assert.ok(await ate(() => t.trocas.length > 1, 20000), "não detectou a mudança no arquivo: " + t.logs.slice(-3).join(" | "));
        const segunda = t.trocas[1].p;
        assert.notStrictEqual(segunda, primeira);
        assert.ok(fs.readFileSync(segunda, "utf8").endsWith("VENDA-NOVA"));
        t.semConexaoNaFonte();
        oc.parar();
        // Ao iniciar de novo, a cópia antiga (fora do manifesto) é apagada — nunca a em uso nem o banco.
        const oc2 = criarCopiaOffline(t.opcoes);
        oc2.iniciar(); oc2.parar();
        assert.ok(!fs.existsSync(primeira), "cópia antiga não foi apagada");
        assert.ok(fs.existsSync(segunda), "apagou a cópia em uso");
        assert.ok(fs.existsSync(t.fonte), "apagou o banco principal");
        const intruso = path.join(t.dir, "SMALL_OFFLINE_20260101_000000.FDB");
        fs.writeFileSync(intruso, "x");
        assert.strictEqual(oc2.ehCopia(intruso), false, "arquivo fora da pasta das cópias tratado como cópia");
    } finally { oc.parar(); await local.fechar(); }
});

test("cópia offline: banco em manutenção (gbak recusado ou arquivo sumido) mantém a cópia anterior", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "primeira cópia não saiu");
        const boa = t.trocas[0].p;
        process.env.MOCK_GBAK_FALHAR = "backup";
        oc.atualizarAgora();
        assert.ok(await ate(() => oc.status().fonteOk === false, 15000), "falha do gbak não marcou o banco como indisponível");
        let st = oc.status();
        assert.match(st.fonteErro, /manutenção|bloqueado/i);
        assert.strictEqual(st.copia.arquivo, path.basename(boa), "perdeu a cópia boa");
        assert.strictEqual(t.trocas.length, 1, "trocou de leitura mesmo com falha");
        assert.deepStrictEqual(fs.readdirSync(t.pasta).filter(n => /\.tmp$/i.test(n)), [], "sobrou temporário");
        // Restauração falhando também não estraga nada.
        process.env.MOCK_GBAK_FALHAR = "restauracao";
        const r2 = await new Promise(r => oc.importarFbk(path.join(t.pasta, "ultimo-backup.fbk"), r));
        assert.strictEqual(r2.ok, false);
        assert.deepStrictEqual(t.copias(), [path.basename(boa)], "cópia parcial ficou na pasta");
        delete process.env.MOCK_GBAK_FALHAR;
        // Arquivo do banco sumiu (atualização trocando o arquivo): aviso, cópia mantida.
        fs.renameSync(t.fonte, t.fonte + ".mov");
        assert.ok(await ate(() => /não encontrado/.test(oc.status().fonteErro || ""), 12000), "não avisou do arquivo sumido");
        assert.ok(fs.existsSync(boa));
        fs.renameSync(t.fonte + ".mov", t.fonte);
        oc.atualizarAgora();
        assert.ok(await ate(() => oc.status().fonteOk === true && t.trocas.length > 1, 20000), "não voltou ao normal com o banco de volta");
        t.semConexaoNaFonte();
    } finally { delete process.env.MOCK_GBAK_FALHAR; oc.parar(); await local.fechar(); }
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
        assert.deepStrictEqual(t.fb.conexoes, [], "conectou em algum banco");
    } finally { oc.parar(); delete process.env.MOCK_GBAK_LOG; }
});

test("cópia offline: banco em outra máquina é copiado pelo gbak sem olhar o arquivo; .fbk escolhido vira a cópia", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta });
    t.setHost("192.168.0.50");
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não copiou o banco remoto: " + t.logs.join(" | "));
        assert.strictEqual(oc.status().fonteOk, true);
        t.semConexaoNaFonte();
        const fbk = path.join(t.dir, "SMALL.fbk");
        fs.writeFileSync(fbk, Buffer.concat([Buffer.from("FBK1\n"), Buffer.from("DADOS-DO-BACKUP")]));
        const r2 = await new Promise(res => oc.importarFbk(fbk, res));
        assert.ok(r2.ok, "importação falhou: " + JSON.stringify(r2));
        assert.strictEqual(oc.status().copia.origem, "fbk");
        assert.strictEqual(fs.readFileSync(path.join(t.pasta, oc.status().copia.arquivo), "utf8"), "DADOS-DO-BACKUP");
        assert.strictEqual((await new Promise(res => oc.importarFbk(path.join(t.dir, "nao-existe.fbk"), res))).ok, false);
        assert.strictEqual((await new Promise(res => oc.importarFbk(t.fonte, res))).ok, false, "aceitou um .FDB como backup");
    } finally { oc.parar(); await local.fechar(); }
});

test("cópia offline: arquivo gravado durante a cópia é descartado; 'auto' usa o gbak direto de reserva, 'arquivo' nunca", async () => {
    const local = await abrirPortaLocal();
    const logGbak = path.join(os.tmpdir(), "gbak-" + process.pid + "-7.log");
    try { fs.unlinkSync(logGbak); } catch (_) {}
    process.env.MOCK_GBAK_LOG = logGbak;
    // O "caixa" grava no banco no meio de toda cópia do arquivo.
    let gravacoes = 0;
    const gancho = { depoisDeLer: (src) => { gravacoes++; fs.appendFileSync(src, "V" + gravacoes); } };
    const t = montar({ porta: local.porta, ganchoTeste: gancho, tentativasArquivo: 2 });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 20000), "não fez a cópia: " + t.logs.join(" | "));
        assert.strictEqual(gravacoes, 2, "deveria tentar a cópia do arquivo 2 vezes");
        assert.strictEqual(oc.status().copia.metodo, "gbak", "deveria ter usado o gbak direto de reserva");
        assert.ok(t.logs.some(l => /gravado durante a cópia/.test(l)) && t.logs.some(l => /usando o gbak direto/.test(l)));
        assert.deepStrictEqual(fs.readdirSync(path.join(t.pasta, "temp")), [], "cópia temporária descartada ficou na pasta");
        t.semConexaoNaFonte();
    } finally { oc.parar(); }
    // Método "arquivo": mesma situação → falha, e o gbak NUNCA recebe o banco principal.
    try { fs.unlinkSync(logGbak); } catch (_) {}
    const t2 = montar({ porta: local.porta, ganchoTeste: { depoisDeLer: (src) => fs.appendFileSync(src, "X") }, tentativasArquivo: 2, metodo: "arquivo" });
    const oc2 = criarCopiaOffline(t2.opcoes);
    try {
        oc2.iniciar();
        assert.ok(await ate(() => !!oc2.status().ultimoErro, 20000), "não registrou a falha");
        assert.match(oc2.status().ultimoErro, /gravado durante a cópia/);
        assert.strictEqual(t2.trocas.length, 0);
        assert.ok(!lerLog(logGbak).some(c => c.args.some(x => x.endsWith(t2.fonte))), "método 'arquivo' chamou o gbak no banco principal");
    } finally { oc2.parar(); delete process.env.MOCK_GBAK_LOG; await local.fechar(); }
});

test("cópia offline: o padrão é o gbak direto (seguro), sem cópia temporária", async () => {
    const local = await abrirPortaLocal();
    const logGbak = path.join(os.tmpdir(), "gbak-" + process.pid + "-pad.log");
    try { fs.unlinkSync(logGbak); } catch (_) {}
    process.env.MOCK_GBAK_LOG = logGbak;
    const t = montar({ porta: local.porta });
    const opcoes = Object.assign({}, t.opcoes); delete opcoes.metodo;
    const oc = criarCopiaOffline(opcoes);
    try {
        assert.strictEqual(oc.status().metodo, "gbak");
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não copiou: " + t.logs.join(" | "));
        const bk = lerLog(logGbak).find(c => c.args.includes("-b"));
        assert.ok(bk && bk.args.includes("-g") && /^127\.0\.0\.1(\/\d+)?:/.test(bk.args[bk.args.length - 2]) && bk.args[bk.args.length - 2].endsWith(":" + t.fonte), "backup não foi direto do banco: " + JSON.stringify(bk));
        assert.strictEqual(oc.status().copia.metodo, "gbak");
        assert.deepStrictEqual(fs.readdirSync(path.join(t.pasta, "temp")), [], "usou a pasta temporária no método gbak");
        t.semConexaoNaFonte();
    } finally { oc.parar(); delete process.env.MOCK_GBAK_LOG; await local.fechar(); }
});

test("cópia offline: gfix valida a cópia temporária; com erros, a cópia é recusada", async () => {
    const local = await abrirPortaLocal();
    const logGfix = path.join(os.tmpdir(), "gfix-" + process.pid + ".log");
    try { fs.unlinkSync(logGfix); } catch (_) {}
    process.env.MOCK_GFIX_LOG = logGfix;
    const t = montar({ porta: local.porta, gfix: GFIX, metodo: "arquivo" });
    const oc = criarCopiaOffline(t.opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não fez a cópia validada: " + t.logs.join(" | "));
        const v = lerLog(logGfix);
        assert.ok(v.length === 1 && v[0].args.includes("-v") && v[0].args.includes("-n") && /\.copia\.tmp$/.test(v[0].args[v[0].args.length - 1]), "gfix não validou a cópia temporária (somente leitura): " + JSON.stringify(v));
        process.env.MOCK_GFIX_FALHAR = "1";
        fs.appendFileSync(t.fonte, "MAIS");
        oc.atualizarAgora();
        assert.ok(await ate(() => /validação da cópia temporária/.test(oc.status().ultimoErro || ""), 15000), "não recusou a cópia com erros: " + oc.status().ultimoErro);
        assert.strictEqual(t.trocas.length, 1, "trocou para uma cópia com defeito");
        assert.deepStrictEqual(fs.readdirSync(path.join(t.pasta, "temp")), []);
    } finally { delete process.env.MOCK_GFIX_FALHAR; delete process.env.MOCK_GFIX_LOG; oc.parar(); await local.fechar(); }
});

test("cópia offline: banco só acessível como arquivo de rede (\\\\servidor\\...) é copiado pelo arquivo", async () => {
    const local = await abrirPortaLocal();
    const t = montar({ porta: local.porta });
    const opcoes = Object.assign({}, t.opcoes, { fonte: () => ({ host: "", path: "", arquivo: t.fonte }) });
    const oc = criarCopiaOffline(opcoes);
    try {
        oc.iniciar();
        assert.ok(await ate(() => t.trocas.length > 0, 15000), "não copiou: " + t.logs.join(" | "));
        assert.strictEqual(oc.status().copia.metodo, "arquivo");
        // Arquivo sumiu e não há endereço para o gbak: falha clara, sem tentar o gbak.
        fs.renameSync(t.fonte, t.fonte + ".x");
        oc.atualizarAgora(() => {});
        assert.ok(await ate(() => /não encontrado/.test(oc.status().fonteErro || ""), 15000), "não avisou do arquivo sumido: " + JSON.stringify(oc.status()));
        assert.strictEqual(oc.status().fonteOk, false);
        assert.strictEqual(t.trocas.length, 1, "trocou de cópia sem banco");
    } finally { oc.parar(); await local.fechar(); }
});

test("localizar banco: acha pela configuração do Small, unidade de rede e compartilhamento — sem conectar", async () => {
    const base = fs.mkdtempSync(path.join(os.tmpdir(), "loc-teste-"));
    const small = path.join(base, "small"); fs.mkdirSync(small);
    fs.writeFileSync(path.join(small, "small.ini"), "[Banco]\r\nServidor=SERVIDOR1:C:\\Program Files (x86)\\SmallSoft\\Small Commerce\\SMALL.FDB\r\nOutro=\\\\NAS\\dados\\SMALL.FDB\r\n", "latin1");
    const refs = lerReferencias([small]);
    assert.deepStrictEqual(refs.servidores.map(r => r.host + "|" + r.path), ["SERVIDOR1|C:\\Program Files (x86)\\SmallSoft\\Small Commerce\\SMALL.FDB"]);
    assert.ok(refs.arquivos.includes("\\\\NAS\\dados\\SMALL.FDB"));
    // Compartilhamento do SERVIDOR1 com o banco dentro de "Small Commerce".
    const share = path.join(base, "share"); fs.mkdirSync(path.join(share, "Small Commerce"), { recursive: true });
    fs.writeFileSync(path.join(share, "Small Commerce", "SMALL.FDB"), "BANCO");
    const perguntados = [];
    const r1 = await localizarBanco({ pastasIni: [small], raizes: [], compartilhamentos: async h => { perguntados.push(h); return h === "SERVIDOR1" ? [share] : []; }, maquinasRede: async () => [], prazoMs: 1000 });
    assert.strictEqual(r1.arquivo, path.join(share, "Small Commerce", "SMALL.FDB"));
    assert.strictEqual(r1.host, "SERVIDOR1");
    assert.match(r1.path, /SMALL\.FDB$/);
    assert.match(r1.origem, /compartilhamento de SERVIDOR1/);
    // Unidade de rede mapeada (SmallSoft\Small Commerce\SMALL.FDB na raiz).
    const unidade = path.join(base, "Z"); fs.mkdirSync(path.join(unidade, "SmallSoft", "Small Commerce"), { recursive: true });
    fs.writeFileSync(path.join(unidade, "SmallSoft", "Small Commerce", "SMALL.FDB"), "BANCO");
    const r2 = await localizarBanco({ pastasIni: [], raizes: [unidade], compartilhamentos: async () => [], maquinasRede: async () => [], prazoMs: 1000 });
    assert.strictEqual(r2.arquivo, path.join(unidade, "SmallSoft", "Small Commerce", "SMALL.FDB"));
    assert.strictEqual(r2.origem, "unidade de rede");
    // Máquina com Firebird na rede (só teste de porta) e o banco no compartilhamento dela.
    const r3 = await localizarBanco({ pastasIni: [], raizes: [], compartilhamentos: async h => h === "192.168.1.20" ? [share] : [], maquinasRede: async () => ["192.168.1.20"], prazoMs: 1000 });
    assert.match(r3.origem, /192\.168\.1\.20/);
    // Nada em lugar nenhum: arquivo vazio, sem erro.
    const r4 = await localizarBanco({ pastasIni: [], raizes: [], compartilhamentos: async () => [], maquinasRede: async () => [], prazoMs: 500 });
    assert.strictEqual(r4.arquivo, "");
});

// ---------------------------------------------------------------------------
// Integração com o servidor (Firebird simulado de test/mock-firebird, que
// registra cada conexão em sql.log com MOCK_LOG_ATTACH=1).
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

test("servidor: espera a cópia sem tocar no banco principal, depois lê só a cópia", async () => {
    const p3050 = await abrir3050();
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srv-copia-"));
    for (const f of ["servidor-relatorio.js", "gerar-relatorio-html.js", "offline-copia.js", "estoque-offline.js", "estoque.html"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
    const mock = path.join(dir, "node_modules", "node-firebird");
    fs.mkdirSync(mock, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "index.js"), path.join(mock, "index.js"));
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "package.json"), path.join(mock, "package.json"));
    const fonte = path.join(dir, "SMALL.FDB");
    fs.writeFileSync(fonte, "BANCO");
    const porta = await portaLivre();
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({
        appName: "Teste Offline", porta, pollInterval: 200, fbHost: "127.0.0.1", fdbPath: fonte,
        offlinePasta: path.join(dir, "copias"), gbakPath: GBAK, offlineVerificarSeg: 5, offlineMetodo: "auto"
    }, null, 2));
    const pad = n => String(n).padStart(2, "0"), d = new Date();
    const hora = [d.getHours(), d.getMinutes(), d.getSeconds()].map(pad).join(":");
    fs.writeFileSync(path.join(dir, "estado.json"), JSON.stringify({ nfce: [{ numero: "500", hora }], pag: [], ger: [] }));
    // gbak lento: dá tempo de ver a tela de espera antes da 1ª cópia.
    const logGbakSrv = path.join(dir, "gbak.log");
    const env = Object.assign({}, process.env, { MOCK_SENHA: "s", RELATORIO_FB_PASS: "s", MOCK_FB_DIR: dir, MOCK_LOG_ATTACH: "1", MOCK_GBAK_ATRASO_MS: "2500", MOCK_GBAK_LOG: logGbakSrv });
    const proc = spawn(process.execPath, ["servidor-relatorio.js", "--no-browser"], { cwd: dir, env, stdio: "ignore" });
    const base = "http://127.0.0.1:" + porta;
    const json = async r => (await fetch(base + r, { cache: "no-store" })).json();
    const sqlLog = () => { try { return fs.readFileSync(path.join(dir, "sql.log"), "utf8"); } catch (_) { return ""; } };
    try {
        let pag = "";
        for (let i = 0; i < 50; i++) { try { pag = await (await fetch(base + "/")).text(); break; } catch (_) { await esperar(200); } }
        assert.match(pag, /Preparando a cópia offline/, "sem cópia, deveria mostrar a tela de espera");
        const est = await json("/api/estoque?q=x");
        assert.strictEqual(est.ok, false);
        assert.match(est.erro, /cópia offline/);
        let st = null;
        for (let i = 0; i < 150; i++) {
            try { st = await json("/api/offline"); if (st && st.lendo === "copia") break; } catch (_) {}
            await esperar(200);
        }
        assert.ok(st && st.lendo === "copia", "servidor não passou a ler a cópia: " + JSON.stringify(st));
        assert.ok(st.copia && RE_COPIA.test(st.copia.arquivo));
        const info = await json("/api/info");
        assert.ok(RE_COPIA.test(path.basename(info.banco.caminho)), "relatório não está lendo a cópia");
        assert.strictEqual(info.bancoPrincipal.path, fonte, "perdeu o banco principal");
        let html = "";
        for (let i = 0; i < 100; i++) { html = await (await fetch(base + "/")).text(); if (html.includes("__off_chip")) break; await esperar(200); }
        assert.ok(html.includes("__off_chip"), "selo offline não foi injetado");
        assert.ok(!html.includes("_badge.id='__srv_badge'") && !html.includes("\\u21bb auto"), "selo verde \"auto\" voltou");
        // Escolher outro banco: só grava e pede cópia — não conecta nele.
        const outro = path.join(dir, "OUTRO.FDB");
        fs.writeFileSync(outro, "OUTRO-BANCO");
        const sv = await (await fetch(base + "/api/salvar-fdb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho: outro }) })).json();
        assert.strictEqual(sv.ok, true, JSON.stringify(sv));
        assert.strictEqual(JSON.parse(fs.readFileSync(path.join(dir, "config.json"), "utf8")).fdbPath, outro);
        const r = await (await fetch(base + "/api/salvar-fdb", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ caminho: info.banco.caminho }) })).json();
        assert.strictEqual(r.ok, false);
        assert.match(r.erro, /cópia offline/);
        const ruim = await fetch(base + "/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offlineIntervaloMin: 0 }) });
        assert.strictEqual(ruim.status, 400);
        assert.strictEqual((await fetch(base + "/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ offlineIntervaloMin: 9 }) })).status, 200);
        assert.strictEqual((await json("/api/offline")).intervaloMinMin, 9);
        await esperar(4000); // deixa o fast-poll, a geração e a 2ª cópia rodarem
        const attaches = sqlLog().split("\n").filter(l => l.startsWith("ATTACH "));
        assert.ok(attaches.length > 0, "o teste não registrou conexões");
        const naFonte = attaches.filter(l => /SMALL\.FDB$|OUTRO\.FDB$/i.test(l.slice(7)) && !RE_COPIA.test(path.basename(l.slice(7))));
        assert.deepStrictEqual(naFonte, [], "conectou direto no banco principal");
        attaches.forEach(l => assert.ok(RE_COPIA.test(path.basename(l.slice(7))), "conexão fora da cópia: " + l));
        assert.ok(!/TX_ESCRITA|^UPDATE/m.test(sqlLog()), "houve escrita: " + sqlLog().slice(0, 300));
        assert.strictEqual(fs.readFileSync(fonte, "utf8"), "BANCO", "banco principal foi alterado");
        // A cópia saiu do ARQUIVO (pasta temporária), não do banco principal pelo gbak.
        const gb = lerLog(logGbakSrv);
        assert.ok(gb.some(c => c.args.includes("-b")), "o gbak não rodou");
        gb.forEach(c => assert.ok(!c.args.some(x => x.endsWith("SMALL.FDB") || x.endsWith("OUTRO.FDB")), "o gbak recebeu o banco principal: " + c.args.join(" ")));
        assert.strictEqual((await json("/api/offline")).metodo, "auto");
    } finally {
        try { proc.kill(); } catch (_) {}
        await p3050.fechar();
    }
});
