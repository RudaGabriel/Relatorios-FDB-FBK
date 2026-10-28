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
    // "Contém" desmarcado: só no começo das palavras.
    assert.strictEqual((await buscar(e, { q: "ato" })).total, 1, "contém deveria achar GATO");
    assert.strictEqual((await buscar(e, { q: "ato", contem: false })).total, 0, "início de palavra não deveria achar GATO");
    assert.deepStrictEqual((await buscar(e, { q: "gat", contem: false })).itens.map(i => i.codigo), ["00123"]);
    assert.deepStrictEqual((await buscar(e, { q: "pulgas", contem: false })).itens.map(i => i.codigo), [], "ANTIPULGAS não começa com PULGAS");
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

const portaLivre = () => new Promise((resolve, reject) => {
    const s = net.createServer(); s.once("error", reject);
    s.listen(0, "127.0.0.1", () => { const p = s.address().port; s.close(() => resolve(p)); });
});

test("servidor: página /estoque, /api/estoque, detalhe e exportação", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "srv-estoque-"));
    for (const f of ["servidor-relatorio.js", "gerar-relatorio-html.js", "offline-copia.js", "estoque-offline.js", "estoque.html"]) fs.copyFileSync(path.join(RAIZ, f), path.join(dir, f));
    const mock = path.join(dir, "node_modules", "node-firebird");
    fs.mkdirSync(mock, { recursive: true });
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "index.js"), path.join(mock, "index.js"));
    fs.copyFileSync(path.join(__dirname, "mock-firebird", "package.json"), path.join(mock, "package.json"));
    const porta = await portaLivre();
    fs.writeFileSync(path.join(dir, "config.json"), JSON.stringify({ appName: "Loja <Teste>", porta, fbHost: "127.0.0.1", fdbPath: "/tmp/teste.fdb", offlinePasta: path.join(dir, "copias") }, null, 2));
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
