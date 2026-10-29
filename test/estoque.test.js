"use strict";
// Testes da consulta de estoque (estoque-offline.js + rotas do servidor).
// Firebird simulado: test/mock-firebird (tabela ESTOQUE em estado.json).
const test = require("node:test");
const assert = require("node:assert");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const net = require("node:net");
const { spawn } = require("node:child_process");

const RAIZ = path.join(__dirname, "..");
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), "estoque-teste-"));
process.env.MOCK_FB_DIR = DIR;
process.env.MOCK_SENHA = "s";
const mockFb = require(path.join(__dirname, "mock-firebird", "index.js"));
const { criarEstoque, normalizar } = require(path.join(RAIZ, "estoque-offline.js"));
const { TextDecoder } = require("node:util");
const dec1252 = new TextDecoder("windows-1252");

const ITENS = [
    { CODIGO: "00123", DESCRICAO: "RAÇÃO GATO ADULTO 1KG", REFERENCIA: "7891000100103", QTD_ATUAL: 12, PRECO: 25.9, MEDIDA: "UN", ATIVO: "S", FORNECEDOR: "PET BRASIL" },
    { CODIGO: "00124", DESCRICAO: "RACAO CAO FILHOTE 15KG", REFERENCIA: "789.1000.2002-04", QTD_ATUAL: 0, PRECO: 189.5, MEDIDA: "SC", ATIVO: "S", FORNECEDOR: "PET BRASIL" },
    { CODIGO: "00200", DESCRICAO: "COLEIRA ANTIPULGAS", REFERENCIA: "7890000000017", QTD_ATUAL: -3, PRECO: 59, MEDIDA: "UN", ATIVO: "N", FORNECEDOR: "VET LTDA" },
    { CODIGO: "10", DESCRICAO: "AREIA HIGIÊNICA 4KG", REFERENCIA: "", QTD_ATUAL: 40, PRECO: 18, MEDIDA: "UN", ATIVO: "S", FORNECEDOR: "=CMD|' /C calc'!A0" }
];
fs.writeFileSync(path.join(DIR, "estado.json"), JSON.stringify({ nfce: [], pag: [], ger: [], estoque: ITENS }));

const novo = () => criarEstoque({
    Firebird: mockFb,
    alvo: () => ({ host: "127.0.0.1", path: "/tmp/copia.fdb", porta: 3050, user: "SYSDBA", pass: "s" }),
    decodificar: b => dec1252.decode(b),
    ehCopia: () => true
});
const buscar = (e, p) => new Promise((res, rej) => e.buscar(p, (err, r) => err ? rej(err) : res(r)));

test("estoque: lê todos os itens e acha por nome sem acento, código, código de barras e referência", async () => {
    const e = novo();
    const todos = await buscar(e, { q: "" });
    assert.strictEqual(todos.totalItens, 4);
    assert.strictEqual(todos.total, 4);
    assert.strictEqual(todos.papeis.codigo, "CODIGO");
    assert.strictEqual(todos.papeis.barras, "REFERENCIA");
    assert.strictEqual(todos.papeis.qtd, "QTD_ATUAL");
    // Acento: "racao" acha "RAÇÃO" (lido como bytes Windows-1252) e "RACAO".
    const r1 = await buscar(e, { q: "racao" });
    assert.deepStrictEqual(r1.itens.map(i => i.codigo).sort(), ["00123", "00124"]);
    assert.strictEqual(r1.itens.find(i => i.codigo === "00123").descricao, "RAÇÃO GATO ADULTO 1KG", "acento corrompido");
    // Vários termos: todos precisam aparecer.
    assert.deepStrictEqual((await buscar(e, { q: "racao gato" })).itens.map(i => i.codigo), ["00123"]);
    // Exclusão e frase exata.
    assert.deepStrictEqual((await buscar(e, { q: "racao -gato" })).itens.map(i => i.codigo), ["00124"]);
    assert.deepStrictEqual((await buscar(e, { q: "\"CAO FILHOTE\"" })).itens.map(i => i.codigo), ["00124"]);
    // Código de barras exato vem primeiro; com pontuação no cadastro também acha.
    assert.strictEqual((await buscar(e, { q: "7891000100103" })).itens[0].codigo, "00123");
    assert.strictEqual((await buscar(e, { q: "7891000200204" })).itens[0].codigo, "00124");
    // Código com zeros à esquerda: "123" traz o 00123 em primeiro.
    assert.strictEqual((await buscar(e, { q: "123" })).itens[0].codigo, "00123");
    // Busca por fornecedor (qualquer coluna de texto).
    assert.strictEqual((await buscar(e, { q: "vet ltda" })).itens[0].codigo, "00200");
    assert.strictEqual(normalizar("  Ração  Gato "), "RACAO GATO");
    // "Contém" desmarcado: só itens que COMEÇAM com o texto (em algum campo).
    assert.strictEqual((await buscar(e, { q: "ato" })).total, 1, "contém deveria achar GATO");
    assert.strictEqual((await buscar(e, { q: "ato", contem: false })).total, 0, "início não deveria achar GATO");
    assert.deepStrictEqual((await buscar(e, { q: "gato", contem: false })).itens.map(i => i.codigo), [], "GATO está no meio de RAÇÃO GATO");
    assert.deepStrictEqual((await buscar(e, { q: "racao g", contem: false })).itens.map(i => i.codigo), ["00123"]);
    assert.deepStrictEqual((await buscar(e, { q: "racao", contem: false })).itens.map(i => i.codigo).sort(), ["00123", "00124"]);
    assert.deepStrictEqual((await buscar(e, { q: "racao -gato", contem: false })).itens.map(i => i.codigo), ["00124"]);
    assert.deepStrictEqual((await buscar(e, { q: "pulgas", contem: false })).itens.map(i => i.codigo), [], "ANTIPULGAS não começa com PULGAS");
    assert.deepStrictEqual((await buscar(e, { q: "coleira", contem: false })).itens.map(i => i.codigo), ["00200"]);
    assert.deepStrictEqual((await buscar(e, { q: "pet bra", contem: false })).itens.map(i => i.codigo).sort(), ["00123", "00124"], "fornecedor também é campo");
    assert.strictEqual((await buscar(e, { q: "123", contem: false })).itens[0].codigo, "00123", "código sem os zeros à esquerda");
    assert.deepStrictEqual((await buscar(e, { q: "pulgas" })).itens.map(i => i.codigo), ["00200"]);
    assert.strictEqual((await buscar(e, { q: "7891000100103", contem: false })).itens[0].codigo, "00123", "código de barras inteiro também vale no modo início");
});

test("estoque: filtros, ordem, paginação, detalhe com todas as colunas e CSV seguro", async () => {
    const e = novo();
    assert.deepStrictEqual((await buscar(e, { estoque: "com" })).itens.map(i => i.codigo).sort(), ["00123", "10"]);
    assert.deepStrictEqual((await buscar(e, { estoque: "sem" })).itens.map(i => i.codigo), ["00124"]);
    assert.deepStrictEqual((await buscar(e, { estoque: "negativo" })).itens.map(i => i.codigo), ["00200"]);
    assert.ok(!(await buscar(e, { ativos: true })).itens.some(i => i.codigo === "00200"), "inativo apareceu com 'só ativos'");
    assert.strictEqual((await buscar(e, { ordem: "preco" })).itens[0].codigo, "00124");
    assert.strictEqual((await buscar(e, { ordem: "codigo" })).itens[0].codigo, "10");
    const p1 = await buscar(e, { limite: 3, pagina: 1, ordem: "descricao" }), p2 = await buscar(e, { limite: 3, pagina: 2, ordem: "descricao" });
    assert.strictEqual(p1.itens.length, 3); assert.strictEqual(p2.itens.length, 1); assert.strictEqual(p1.paginas, 2);
    const sem = await buscar(e, { q: "nada-disso-existe-xyz" });
    assert.strictEqual(sem.total, 0);
    // Detalhe: todas as colunas.
    const id = (await buscar(e, { q: "coleira" })).itens[0].id;
    const det = await new Promise((res, rej) => e.item(id, (err, r) => err ? rej(err) : res(r)));
    assert.deepStrictEqual(det.campos.map(c => c.nome), ["CODIGO", "DESCRICAO", "REFERENCIA", "QTD_ATUAL", "PRECO", "MEDIDA", "ATIVO", "FORNECEDOR"]);
    assert.strictEqual(det.resumo.ativo, false);
    await assert.rejects(new Promise((res, rej) => e.item(9999, (err, r) => err ? rej(err) : res(r))));
    // CSV: todas as linhas, separador ";", BOM, e texto com cara de fórmula neutralizado.
    const csv = await new Promise((res, rej) => e.csv({ q: "" }, (err, c) => err ? rej(err) : res(c)));
    assert.ok(csv.startsWith("﻿CODIGO;DESCRICAO;"));
    assert.strictEqual(csv.trim().split("\r\n").length, 5);
    assert.ok(csv.includes("25,9"), "número sem vírgula decimal");
    assert.ok(!/;=CMD/.test(csv) && csv.includes("'=CMD"), "fórmula não foi neutralizada");
});

// O sistema só lê a cópia offline: os testes já começam com uma cópia pronta
// (o Firebird simulado responde igual para qualquer arquivo).
function semearCopia(dir, fonte) {
    const pasta = path.join(dir, "copias");
    fs.mkdirSync(pasta, { recursive: true });
    const arq = path.join(pasta, "SMALL_OFFLINE_20260101_000000.FDB");
    fs.writeFileSync(arq, "COPIA");
    fs.writeFileSync(path.join(pasta, "copia-offline.json"), JSON.stringify({ versao: 1, ativa: {
        arquivo: arq, host: "127.0.0.1", dadosDe: Date.now(), criadaEm: Date.now(), origem: "fdb",
        fonte: { host: "127.0.0.1", path: fonte }, sig: null } }));
    return arq;
}

test("estoque: sentido da coluna de situação decidido pelos dados (Small: \"0\" = ativo)", async () => {
    const original = fs.readFileSync(path.join(DIR, "estado.json"), "utf8");
    const itens = [];
    for (let i = 0; i < 12; i++) itens.push({ CODIGO: String(500 + i), DESCRICAO: "ITEM " + i, QTD_ATUAL: 5, PRECO: 1, ATIVO: "0" });
    itens.push({ CODIGO: "999", DESCRICAO: "ITEM DESATIVADO", QTD_ATUAL: 0, PRECO: 1, ATIVO: "1" });
    fs.writeFileSync(path.join(DIR, "estado.json"), JSON.stringify({ nfce: [], pag: [], ger: [], estoque: itens }));
    try {
        const r = await buscar(novo(), { q: "" , limite: 1000 });
        const desativado = r.itens.find(i => i.codigo === "999"), normal = r.itens.find(i => i.codigo === "500");
        assert.strictEqual(normal.ativo, true, "a maioria (\"0\") deveria ser ativa");
        assert.strictEqual(desativado.ativo, false);
        assert.strictEqual((await buscar(novo(), { q: "", ativos: true, limite: 1000 })).total, 12);
    } finally { fs.writeFileSync(path.join(DIR, "estado.json"), original); }
});

const portaLivre = () => new Promise((resolve, reject) => {
    const s = net.createServer(); s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});

test("servidor: página /estoque, /api/estoque, detalhe e exportação", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srv-estoque-"));
    for (const f of ["servidor-relatorio.js", "gerar-relatorio-html.js", "offline-copia.js", "estoque-offline.js", "estoque.html", "https-local.js"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
    fs.cpSync(path.join(RAIZ, "leitor"), path.join(dir, "leitor"), { recursive: true });
    const mock = path.join(dir, "node_modules", "node-firebird");
    fs.mkdirSync(mock, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "index.js"), path.join(mock, "index.js"));
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "package.json"), path.join(mock, "package.json"));
    const porta = await portaLivre(), portaHttps = await portaLivre();
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ appName: "Loja <Teste>", porta, portaHttps, fbHost: "127.0.0.1", fdbPath: "/tmp/teste.fdb", offlinePasta: path.join(dir, "copias") }, null, 2));
    semearCopia(dir, "/tmp/teste.fdb");
    fs.writeFileSync(path.join(dir, "estado.json"), JSON.stringify({ nfce: [], pag: [], ger: [], estoque: ITENS }));
    const env = Object.assign({}, process.env, { MOCK_SENHA: "s", RELATORIO_FB_PASS: "s", MOCK_FB_DIR: dir });
    const proc = spawn(process.execPath, ["servidor-relatorio.js", "--no-browser"], { cwd: dir, env, stdio: "ignore" });
    const base = "http://127.0.0.1:" + porta;
    try {
        let r = null;
        for (let i = 0; i < 100; i++) { try { r = await (await fetch(base + "/api/estoque?q=gato")).json(); if (r && r.ok) break; } catch (_) {} await new Promise(x => setTimeout(x, 200)); }
        assert.ok(r && r.ok, "API do estoque não respondeu: " + JSON.stringify(r));
        assert.deepStrictEqual(r.itens.map(i => i.codigo), ["00123"]);
        assert.strictEqual((await (await fetch(base + "/api/estoque?q=ato&contem=0")).json()).total, 0, "contem=0 ignorado pela API");
        assert.strictEqual((await (await fetch(base + "/api/estoque?q=ato")).json()).total, 1);
        const pag = await (await fetch(base + "/estoque")).text();
        assert.ok(pag.includes("Loja &lt;Teste&gt;") && !pag.includes("Loja <Teste>"), "nome do sistema sem escape na página");
        assert.ok(pag.includes('id="q"'));
        // Leitor de código de barras: página com o botão e arquivos locais (sem internet).
        assert.ok(pag.includes('id="bLer"') && pag.includes('import { criarLeitor } from "/leitor/leitor.js"'), "leitor não está na página do estoque");
        const tipos = { "/leitor/leitor.js": /javascript/, "/leitor/foco.js": /javascript/, "/leitor/vendor/zxing_reader.wasm": /application\/wasm/, "/leitor/vendor/barcode-detector-ponyfill.js": /javascript/, "/leitor/vendor/zxing-library.min.js": /javascript/ };
        for (const [u, re] of Object.entries(tipos)) {
            const rr = await fetch(base + u);
            assert.strictEqual(rr.status, 200, u);
            assert.match(rr.headers.get("content-type") || "", re, u);
        }
        assert.ok(!/cdn\.jsdelivr|https:\/\//.test(await (await fetch(base + "/leitor/leitor.js")).text().then(t => t.replace(/^\s*(\/\/|\*).*$/gm, ""))), "leitor ainda busca biblioteca na internet");
        const http = require("node:http");
        const pedir = caminho => new Promise(ok => http.get({ host: "127.0.0.1", port: porta, path: caminho }, rs => { rs.resume(); ok(rs.statusCode); }).on("error", () => ok(0)));
        for (const ruim of ["/leitor/../config.json", "/leitor/%2e%2e/config.json", "/leitor/vendor/../../servidor-relatorio.js", "/leitor/x.exe"]) assert.strictEqual(await pedir(ruim), 404, ruim);
        // Comandos da bandeja chegam ao estoque (SSE): "Editar configurações" com o estoque aberto.
        assert.ok(pag.includes('new EventSource("/api/events")') && pag.includes('irPara("/config?voltar="'), "estoque não escuta os comandos da bandeja");
        const sse = await new Promise((ok, falhou) => {
            const rq = http.get({ host: "127.0.0.1", port: porta, path: "/api/events" }, rs => {
                let buf = "";
                rs.setEncoding("utf8");
                rs.on("data", ch => {
                    buf += ch;
                    if (buf.includes('"connected"') && !rq._pediu) { rq._pediu = true; fetch(base + "/api/navigate/config").then(x => x.json()).then(j => { rq._clients = j.clients; }).catch(falhou); }
                    if (buf.includes('"navigate-hash"')) { rq.destroy(); ok({ buf, clients: rq._clients }); }
                });
            });
            rq.on("error", e => { if (!rq.destroyed) falhou(e); });
            setTimeout(() => { rq.destroy(); falhou(new Error("comando de configurações não chegou pelo SSE")); }, 8000);
        });
        assert.ok(sse.buf.includes('"hash":"config"'));
        // Configurações abertas a partir do estoque voltam para o estoque (com a busca).
        assert.ok(pag.includes('irPara("/config?voltar="'), "estoque não informa para onde voltar");
        const cfgEst = await (await fetch(base + "/config?voltar=" + encodeURIComponent("/estoque?q=racao%20gato"))).text();
        assert.ok(cfgEst.includes('data-voltar="/estoque?q=racao%20gato"') && cfgEst.includes("Voltar para o estoque"), "botão não volta para o estoque: " + (cfgEst.match(/<button[^>]*voltarBtn[^>]*>[^<]*/) || [cfgEst.slice(0, 300)])[0]);
        for (const ruim of ["//exemplo.com", "https://exemplo.com", "javascript:alert(1)", "/\\exemplo.com", "/config?voltar=/estoque", "/x\"onmouseover=\"1"]) {
            const t = await (await fetch(base + "/config?voltar=" + encodeURIComponent(ruim))).text();
            assert.ok(t.includes('data-voltar="/"') && t.includes("Voltar para o relatorio"), "voltar inseguro aceito: " + ruim);
        }
        // HTTPS (leitor ao vivo no celular): mesma aplicação na portaHttps, certificado próprio.
        const https = require("node:https");
        const pedirHttps = caminho => new Promise((ok, falhou) => {
            const rq = https.get({ host: "127.0.0.1", port: portaHttps, path: caminho, rejectUnauthorized: false }, rs => {
                const cert = rs.socket && rs.socket.getPeerCertificate ? rs.socket.getPeerCertificate() : {};
                let b = ""; rs.setEncoding("utf8"); rs.on("data", d => b += d); rs.on("end", () => ok({ status: rs.statusCode, corpo: b, cert }));
            });
            rq.on("error", falhou); rq.setTimeout(8000, () => rq.destroy(new Error("tempo esgotado")));
        });
        let rh = null;
        for (let i = 0; i < 50 && !rh; i++) { try { rh = await pedirHttps("/estoque"); } catch (_) { await new Promise(x => setTimeout(x, 200)); } }
        assert.ok(rh && rh.status === 200 && rh.corpo.includes('id="q"'), "estoque não abriu por HTTPS");
        assert.ok(/IP Address:127\.0\.0\.1/.test(rh.cert.subjectaltname || ""), "certificado sem o IP: " + (rh.cert && rh.cert.subjectaltname));
        assert.ok(fs.existsSync(path.join(dir, "https", "autoassinado.crt")), "certificado fora da pasta https ao lado das cópias");
        const apiH = await (await fetch(base + "/api/https")).json();
        assert.strictEqual(apiH.url, "https://127.0.0.1:" + portaHttps);
        assert.strictEqual(apiH.confiavel, false);
        assert.strictEqual(JSON.parse((await pedirHttps("/api/https")).corpo).seguro, true);
        assert.ok(pag.includes("irParaSeguro") && pag.includes('get("ler") === "1"'), "estoque não leva ao leitor ao vivo pelo HTTPS");
        const det = await (await fetch(base + "/api/estoque/item?id=" + r.itens[0].id)).json();
        assert.strictEqual(det.ok, true);
        const csv = await fetch(base + "/api/estoque/csv?q=racao");
        assert.match(csv.headers.get("content-disposition") || "", /attachment; filename="estoque-\d{4}-\d{2}-\d{2}\.csv"/);
        assert.strictEqual((await csv.text()).trim().split("\r\n").length, 3);
        // Parâmetros inválidos não quebram nada.
        const ruim = await (await fetch(base + "/api/estoque?estoque=xx&ordem=;drop&limite=999999&pagina=-5")).json();
        assert.strictEqual(ruim.ok, true); assert.strictEqual(ruim.limite, 1000); assert.strictEqual(ruim.pagina, 1);
        // Relatório traz o atalho do estoque.
        let html = "";
        for (let i = 0; i < 100; i++) { html = await (await fetch(base + "/")).text(); if (html.includes("__est_chip")) break; await new Promise(x => setTimeout(x, 200)); }
        assert.ok(html.includes("__est_chip"), "atalho do estoque não aparece no relatório");
        const sqlLog = (() => { try { return fs.readFileSync(path.join(dir, "sql.log"), "utf8"); } catch (_) { return ""; } })();
        assert.ok(!/TX_ESCRITA|^UPDATE/m.test(sqlLog), "houve escrita: " + sqlLog.slice(0, 300));
    } finally { try { proc.kill(); } catch (_) {} }
});
