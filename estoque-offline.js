"use strict";

/**
 * estoque-offline.js
 * @version 1.2.0
 * @author Ruda Gabriel
 * @description Consulta de estoque completa (Relatórios SmallSoft Offline).
 *
 * Lê TODOS os itens da tabela de produtos do Small Commerce (ESTOQUE) — de
 * preferência da cópia offline, que não pesa no banco do caixa — e guarda em
 * memória. A busca procura em TODAS as colunas de texto (nome, código, código
 * de barras, referência, fornecedor, grupo, NCM, localização...), sem limite
 * de resultados, com paginação e exportação.
 *
 * O esquema não é fixo: as colunas são lidas do catálogo do Firebird e
 * classificadas pelo nome (CODIGO, DESCRICAO, REFERENCIA/EAN/GTIN, QTD_ATUAL,
 * PRECO...). Coluna que não existir simplesmente não aparece; coluna que o
 * sistema não conhece aparece no detalhe do item e entra na busca do mesmo jeito.
 *
 * SOMENTE LEITURA: só SELECT, sempre pelo Firebird blindado do servidor.
 *
 * 1.2.0 — Regras da busca em estoque-busca.js (as mesmas no navegador) e pacote do
 *         estoque para o aparelho guardar e usar com o servidor fora do ar.
 * Histórico completo das versões: CHANGELOG.md no repositório.
 */

const VERSAO = "1.2.0";
const Busca = require("./estoque-busca.js");
const TABELAS = ["ESTOQUE", "PRODUTOS", "PRODUTO", "CADPRO", "MERCADORIAS"];

// Papéis das colunas, em ordem de preferência (o 1º nome que existir vence).
const PAPEIS = {
    codigo:     ["CODIGO", "COD", "CODPRODUTO", "COD_PRODUTO", "CODIGO_PRODUTO", "ID_PRODUTO", "IDPRODUTO", "ID"],
    descricao:  ["DESCRICAO", "DESCR", "DESCRICAO_PRODUTO", "PRODUTO", "NOME"],
    barras:     ["CODBARRAS", "COD_BARRAS", "CODIGO_BARRAS", "CODIGODEBARRAS", "CODBAR", "BARRAS", "EAN", "EAN13", "GTIN", "CEAN", "REFERENCIA"],
    referencia: ["REFERENCIA", "REF", "REFERENCIA_FORNECEDOR", "REF_FORNECEDOR", "CODFABRICANTE"],
    qtd:        ["QTD_ATUAL", "QTDATUAL", "ESTOQUE_ATUAL", "ESTOQUE", "SALDO", "QTD", "QTDE", "QUANTIDADE"],
    qtdMin:     ["QTD_MINIM", "QTD_MINIMA", "QTDMINIMA", "ESTOQUE_MINIMO", "QTDMIN", "MINIMO"],
    preco:      ["PRECO", "PRECO_VENDA", "PRECOVENDA", "PRECO1", "PR_VENDA", "VENDA", "VALOR"],
    custo:      ["CUSTOCOMPR", "CUSTO_COMPRA", "CUSTOMEDIO", "CUSTO_MEDIO", "PRECO_CUSTO", "CUSTO"],
    unidade:    ["MEDIDA", "UNIDADE", "UN", "UND", "UNID"],
    grupo:      ["NOME_GRUPO", "GRUPO", "CATEGORIA", "SECAO", "DEPARTAMENTO"],
    fornecedor: ["FORNECEDOR", "NOME_FORNECEDOR", "NOMEFORNEC", "FABRICANTE", "MARCA"],
    ncm:        ["NCM", "CLASSIFICACAO_FISCAL", "CLASFISCAL", "CF"],
    local:      ["LOCAL", "LOCALIZACAO", "PRATELEIRA", "ENDERECO"],
    ativo:      ["ATIVO", "INATIVO", "SITUACAO", "STATUS"],
    alteracao:  ["ALTERADO", "DATA_ALTERACAO", "DT_ALTERACAO", "ULTIMA_ALTERACAO", "ALTERACAO"],
    ultVenda:   ["ULT_VENDA", "ULTIMA_VENDA", "DT_ULT_VENDA", "DATA_ULT_VENDA"]
};

const _semAcento = s => String(s == null ? "" : s).normalize("NFD").replace(/[̀-ͯ]/g, "");
const normalizar = s => _semAcento(s).toUpperCase().replace(/\s+/g, " ").trim();
const _soDigitos = s => String(s || "").replace(/\D+/g, "");
// Tipos do Firebird (RDB$FIELD_TYPE).
const T_TEXTO = { 14: "CHAR", 37: "VARCHAR", 40: "CSTRING" };
const T_BLOB = 261;
const T_DATA = { 12: "DATE", 13: "TIME", 35: "TIMESTAMP" };

function _primeiroQueExiste(lista, cols) { for (const n of lista) if (cols[n]) return n; return null; }

/** Lê o valor como número (ou null). */
function _num(v) {
    if (v == null || v === "") return null;
    const n = typeof v === "number" ? v : Number(String(v).replace(",", "."));
    return isFinite(n) ? n : null;
}

/**
 * Sentido da coluna de situação: cada sistema usa uma convenção (no Small Commerce,
 * por exemplo, "0" pode ser ATIVO). Decide pelos dados: numa loja a grande maioria dos
 * itens está ativa — se pela leitura direta quase todos dariam "inativo", inverte.
 */
function decidirAtivo(papel, idx, linhas) {
    if (!papel || idx < 0) return { inverterAtivo: false, contagemAtivo: null };
    const cont = {};
    let pos = 0, neg = 0;
    linhas.forEach(l => {
        const v = l[idx]; const k = v == null ? "(vazio)" : String(v).trim() || "(vazio)";
        cont[k] = (cont[k] || 0) + 1;
        const a = _ativo(papel, v);
        if (a === true) pos++; else if (a === false) neg++;
    });
    const total = pos + neg;
    return { inverterAtivo: total >= 10 && neg / total > 0.7, contagemAtivo: cont };
}

/** Item ativo? null = não dá para saber (sem coluna). */
function _ativo(papel, v) {
    if (!papel || v == null || v === "") return null;
    const s = normalizar(v);
    const positivo = /^(S|SIM|1|T|TRUE|A|ATIVO)$/.test(s);
    const negativo = /^(N|NAO|0|F|FALSE|I|INATIVO)$/.test(s);
    if (!positivo && !negativo) return null;
    return papel === "INATIVO" ? negativo : positivo;
}

/**
 * Cria a consulta de estoque.
 * opcoes: Firebird (blindado), alvo() → {host, path, porta, user, pass, charset},
 *         decodificar(buffer) → texto, log(msg), ehCopia() → bool,
 *         ttlDiretoMs (validade do cache ao ler o banco principal direto)
 */
function criarEstoque(opcoes) {
    const o = Object.assign({}, opcoes || {});
    const log = typeof o.log === "function" ? o.log : () => {};
    const ttlDireto = Number(o.ttlDiretoMs) > 0 ? Number(o.ttlDiretoMs) : 120000;
    let cache = null;      // { chave, carregadoEm, tabela, colunas:[{nome,tipo}], papeis:{}, linhas:[[]], busca:[str], ... }
    let carregando = null; // { chave, espera:[cb] }
    let octetsRecusado = false;

    const decod = v => {
        if (Buffer.isBuffer(v)) { try { return typeof o.decodificar === "function" ? o.decodificar(v) : v.toString("latin1"); } catch (_) { return v.toString("latin1"); } }
        return v;
    };
    const chaveAlvo = a => a ? (a.host + ":" + a.path) : "";

    const conectar = (a, cb) => {
        let fim = false;
        const t = setTimeout(() => { if (!fim) { fim = true; cb(new Error("o banco não respondeu em 15 s")); } }, 15000);
        try {
            o.Firebird.attach({ host: a.host, port: a.porta || 3050, database: a.path, user: a.user, password: a.pass, role: null, charset: a.charset || "UTF8", lowercase_keys: false }, (err, db) => {
                if (fim) { try { if (db) db.detach(() => {}); } catch (_) {} return; }
                fim = true; clearTimeout(t); cb(err, db);
            });
        } catch (e) { if (!fim) { fim = true; clearTimeout(t); cb(e); } }
    };
    const consultar = (db, sql, params, ms) => new Promise(resolve => {
        let fim = false;
        const t = setTimeout(() => { if (!fim) { fim = true; resolve({ e: new Error("consulta demorou mais de " + Math.round(ms / 1000) + " s") }); } }, ms);
        try { db.query(sql, params || [], (e, r) => { if (fim) return; fim = true; clearTimeout(t); resolve({ e, r: r || [] }); }); }
        catch (e) { if (!fim) { fim = true; clearTimeout(t); resolve({ e }); } }
    });

    const montarCache = async (a) => {
        if (!o.Firebird) throw new Error("node-firebird indisponível.");
        const db = await new Promise((res, rej) => conectar(a, (e, d) => e || !d ? rej(e || new Error("sem conexão")) : res(d)));
        try {
            // Tabela de produtos + colunas (com tipo) pelo catálogo.
            const cat = await consultar(db,
                "SELECT TRIM(rf.RDB$RELATION_NAME) AS T, TRIM(rf.RDB$FIELD_NAME) AS C, f.RDB$FIELD_TYPE AS TP, f.RDB$FIELD_SUB_TYPE AS ST, " +
                "COALESCE(f.RDB$CHARACTER_LENGTH, f.RDB$FIELD_LENGTH) AS TAM, f.RDB$FIELD_SCALE AS ESC, rf.RDB$FIELD_POSITION AS POS " +
                "FROM RDB$RELATION_FIELDS rf JOIN RDB$FIELDS f ON f.RDB$FIELD_NAME = rf.RDB$FIELD_SOURCE " +
                "WHERE TRIM(rf.RDB$RELATION_NAME) IN ('" + TABELAS.join("','") + "') ORDER BY rf.RDB$RELATION_NAME, rf.RDB$FIELD_POSITION", [], 20000);
            if (cat.e) throw cat.e;
            const porTabela = {};
            cat.r.forEach(r => {
                const t = String(r.T || r.t || "").trim().toUpperCase(), c = String(r.C || r.c || "").trim().toUpperCase();
                if (!t || !c) return;
                (porTabela[t] = porTabela[t] || []).push({ nome: c, tp: Number(r.TP != null ? r.TP : r.tp), st: Number(r.ST != null ? r.ST : r.st) || 0, tam: Number(r.TAM != null ? r.TAM : r.tam) || 0 });
            });
            const tabela = TABELAS.find(t => porTabela[t] && porTabela[t].length);
            if (!tabela) throw new Error("Tabela de produtos (ESTOQUE) não encontrada no banco.");
            const cols = porTabela[tabela];
            const mapa = {}; cols.forEach(c => { mapa[c.nome] = c; });
            const papeis = {};
            Object.keys(PAPEIS).forEach(p => { papeis[p] = _primeiroQueExiste(PAPEIS[p], mapa); });
            // Código de barras e referência não podem ser a mesma coluna duas vezes.
            if (papeis.referencia && papeis.referencia === papeis.barras) papeis.referencia = null;
            if (papeis.descricao && papeis.descricao === papeis.fornecedor) papeis.fornecedor = null;

            // SELECT de todas as colunas: texto como BYTES (acento de banco sem
            // charset), blob de texto resumido, binário fora.
            const q = n => '"' + n.replace(/"/g, '""') + '"';
            const usadas = cols.filter(c => !(c.tp === T_BLOB && c.st !== 1));
            const partes = usadas.map((c, i) => {
                const al = "C" + i;
                if (T_TEXTO[c.tp]) return "cast(" + q(c.nome) + " as varchar(" + Math.min(32000, Math.max(1, c.tam) * 4) + ") character set octets) as " + al;
                if (c.tp === T_BLOB) return "cast(substring(" + q(c.nome) + " from 1 for 1000) as varchar(4000) character set octets) as " + al;
                return q(c.nome) + " as " + al;
            });
            const sqlOct = "SELECT " + partes.join(", ") + " FROM " + q(tabela);
            let r = await consultar(db, octetsRecusado ? sqlOct.replace(/ character set octets/g, "") : sqlOct, [], 120000);
            if (r.e && !octetsRecusado && /octets|transliterat|character set|charset|malformed|conversion|truncation|arithmetic/i.test(String(r.e.message || r.e))) {
                octetsRecusado = true;
                r = await consultar(db, sqlOct.replace(/ character set octets/g, ""), [], 120000);
            }
            if (r.e) throw r.e;

            const linhas = new Array(r.r.length), busca = new Array(r.r.length), digitos = new Array(r.r.length);
            const idxPapel = {};
            Object.keys(papeis).forEach(p => { idxPapel[p] = papeis[p] ? usadas.findIndex(c => c.nome === papeis[p]) : -1; });
            const ehTexto = usadas.map(c => !!T_TEXTO[c.tp] || c.tp === T_BLOB);
            const numPesq = usadas.map(c => !T_TEXTO[c.tp] && c.tp !== T_BLOB && /COD|BARRA|EAN|GTIN|REF/.test(c.nome));
            r.r.forEach((row, i) => {
                const lin = new Array(usadas.length);
                const txt = [], dig = [];
                for (let k = 0; k < usadas.length; k++) {
                    let v = row["C" + k]; if (v === undefined) v = row["c" + k];
                    v = decod(v);
                    if (v instanceof Date) v = isNaN(v.getTime()) ? null : v.toISOString();
                    else if (typeof v === "string") v = v.replace(/\s+$/, "");
                    else if (typeof v === "bigint") v = Number(v);
                    lin[k] = v == null ? null : v;
                    if (v != null && v !== "") {
                        if (ehTexto[k]) { txt.push(normalizar(v)); const d = _soDigitos(v); if (d.length >= 3) dig.push(d); }
                        // Número inteiro em coluna de código (CODIGO numérico, EAN em BIGINT...) também é pesquisável.
                        else if (typeof v === "number" && Number.isInteger(v) && (k === idxPapel.codigo || numPesq[k])) { txt.push(String(v)); dig.push(String(v)); }
                    }
                }
                linhas[i] = lin;
                busca[i] = "\u0001" + txt.join("\u0001") + "\u0001";
                digitos[i] = "\u0001" + dig.join("\u0001") + "\u0001";
            });
            return {
                chave: chaveAlvo(a), carregadoEm: Date.now(), tabela, colunas: usadas.map(c => ({ nome: c.nome, tipo: T_TEXTO[c.tp] || T_DATA[c.tp] || (c.tp === T_BLOB ? "BLOB" : "NUM") })),
                papeis, idxPapel, linhas, busca, digitos, octets: !octetsRecusado,
                ...decidirAtivo(papeis.ativo, idxPapel.ativo, linhas)
            };
        } finally {
            try { db.detach(() => {}); } catch (_) {}
        }
    };

    /** Garante o cache do alvo atual (carrega uma vez; pedidos simultâneos esperam o mesmo). */
    const garantir = (forcar, cb) => {
        const a = typeof o.alvo === "function" ? o.alvo() : null;
        if (!a || !a.path) { cb(new Error("A cópia offline do banco ainda não está pronta — o estoque aparece assim que ela terminar.")); return; }
        const ch = chaveAlvo(a);
        const copia = typeof o.ehCopia === "function" && o.ehCopia();
        const valido = cache && cache.chave === ch && (copia || Date.now() - cache.carregadoEm < ttlDireto);
        if (valido && !forcar) { cb(null, cache); return; }
        if (carregando && carregando.chave === ch) { carregando.espera.push(cb); return; }
        const meu = { chave: ch, espera: [cb] };
        carregando = meu;
        const t0 = Date.now();
        montarCache(a).then(c => {
            cache = c;
            log("Estoque carregado " + (copia ? "da cópia offline" : "do banco principal") + ": " + c.linhas.length + " itens da tabela " + c.tabela + " em " + (Date.now() - t0) + " ms" +
                " (código: " + (c.papeis.codigo || "—") + ", descrição: " + (c.papeis.descricao || "—") + ", barras: " + (c.papeis.barras || "—") + ", estoque: " + (c.papeis.qtd || "—") + ", preço: " + (c.papeis.preco || "—") + ").");
            if (c.papeis.ativo) log("Estoque: coluna de situação " + c.papeis.ativo + " — valores " + Object.keys(c.contagemAtivo || {}).map(k => k + "=" + c.contagemAtivo[k]).join(", ") +
                (c.inverterAtivo ? " → lida ao contrário (a maioria dos itens daria \"inativo\")." : " → lida direto."));
            if (carregando === meu) carregando = null;
            meu.espera.forEach(f => { try { f(null, c); } catch (_) {} });
        }).catch(e => {
            if (carregando === meu) carregando = null;
            const err = e instanceof Error ? e : new Error(String(e));
            log("Falha ao carregar o estoque: " + String(err.message || err).slice(0, 300));
            // Sem dados novos, o cache anterior (mesmo de outro alvo) ainda serve.
            meu.espera.forEach(f => { try { f(cache ? null : err, cache, cache ? err : null); } catch (_) {} });
        });
    };

    const valor = (c, i, papel) => { const k = c.idxPapel[papel]; return k >= 0 ? c.linhas[i][k] : null; };
    const ativoDe = (c, i) => { const a = _ativo(c.papeis.ativo, valor(c, i, "ativo")); return a === null ? null : (c.inverterAtivo ? !a : a); };
    const resumo = (c, i) => {
        const it = { id: i };
        ["codigo", "descricao", "barras", "referencia", "unidade", "grupo", "fornecedor", "ncm", "local"].forEach(p => {
            const v = valor(c, i, p); if (v != null && v !== "") it[p] = typeof v === "string" ? v.trim() : v;
        });
        ["qtd", "qtdMin", "preco", "custo"].forEach(p => { const n = _num(valor(c, i, p)); if (n != null) it[p] = n; });
        const at = ativoDe(c, i);
        if (at !== null) it.ativo = at;
        return it;
    };

    // Regras da busca: estoque-busca.js (as mesmas usadas pelo navegador quando o
    // servidor está fora do ar e a página usa a cópia salva no aparelho).
    const fonteDe = c => ({
        n: c.linhas.length,
        busca: i => c.busca[i],
        digitos: i => c.digitos[i],
        val: (i, papel) => valor(c, i, papel),
        ativo: i => ativoDe(c, i),
        temQtd: c.idxPapel.qtd >= 0,
        temPreco: c.idxPapel.preco >= 0,
        temAtivo: !!c.papeis.ativo
    });
    const filtrar = (c, consulta, filtros) => Busca.filtrar(fonteDe(c), consulta, filtros);
    const ordenar = (c, res, ordem) => Busca.ordenar(fonteDe(c), res, ordem);

    const api = {
        VERSAO,
        /** Pesquisa paginada. cb(err, resultado). */
        buscar(params, cb) {
            const p = params || {};
            garantir(!!p.recarregar, (err, c, avisoErr) => {
                if (err || !c) { cb(err || new Error("Estoque indisponível.")); return; }
                const r = Busca.pesquisar(fonteDe(c), p, i => resumo(c, i));
                delete r._res;
                r.papeis = c.papeis; r.tabela = c.tabela; r.carregadoEm = c.carregadoEm;
                r.aviso = avisoErr ? "Mostrando dados carregados antes: " + String(avisoErr.message || avisoErr).slice(0, 200) : null;
                cb(null, r);
            });
        },
        /**
         * Pacote para o navegador guardar (cópia do estoque no aparelho, usada quando o
         * servidor está fora do ar): os campos da lista + o texto de busca de cada item.
         * Versão igual à do aparelho → { igual: true } (nada a baixar).
         */
        pacote(versaoAparelho, cb) {
            garantir(false, (err, c) => {
                if (err || !c) { cb(err || new Error("Estoque indisponível.")); return; }
                const versao = String(c.chave || "") + "|" + c.carregadoEm;
                if (versaoAparelho && versaoAparelho === versao) { cb(null, { ok: true, igual: true, versao }); return; }
                const campos = ["codigo", "descricao", "barras", "referencia", "unidade", "grupo", "fornecedor", "ncm", "local", "qtd", "qtdMin", "preco", "custo", "ativo"];
                const linhas = new Array(c.linhas.length);
                for (let i = 0; i < c.linhas.length; i++) {
                    const it = resumo(c, i);
                    linhas[i] = campos.map(k => it[k] === undefined ? null : it[k]);
                }
                cb(null, {
                    ok: true, versao, carregadoEm: c.carregadoEm, tabela: c.tabela, papeis: c.papeis,
                    temQtd: c.idxPapel.qtd >= 0, temPreco: c.idxPapel.preco >= 0, temAtivo: !!c.papeis.ativo,
                    campos, linhas, busca: c.busca, digitos: c.digitos
                });
            });
        },
        /** Todas as colunas de um item. */
        item(id, cb) {
            garantir(false, (err, c) => {
                if (err || !c) { cb(err || new Error("Estoque indisponível.")); return; }
                const i = parseInt(id, 10);
                if (!(i >= 0 && i < c.linhas.length)) { cb(new Error("Item não encontrado (o estoque pode ter sido recarregado — pesquise de novo).")); return; }
                cb(null, { ok: true, id: i, resumo: resumo(c, i), campos: c.colunas.map((col, k) => ({ nome: col.nome, tipo: col.tipo, valor: c.linhas[i][k] })), carregadoEm: c.carregadoEm });
            });
        },
        /** CSV (separador ;) de TODOS os resultados da busca, com todas as colunas. */
        csv(params, cb) {
            garantir(false, (err, c) => {
                if (err || !c) { cb(err || new Error("Estoque indisponível.")); return; }
                const res = ordenar(c, filtrar(c, params && params.q, params), String(params && params.ordem || ""));
                const cel = v => {
                    if (v == null) return "";
                    let s = typeof v === "number" ? String(v).replace(".", ",") : String(v);
                    if (/^[=+\-@\t\r]/.test(s) && typeof v !== "number") s = "'" + s; // evita fórmula no Excel
                    return /[";\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
                };
                const linhas = [c.colunas.map(x => cel(x.nome)).join(";")];
                res.forEach(r => linhas.push(c.linhas[r.i].map(cel).join(";")));
                cb(null, "﻿" + linhas.join("\r\n") + "\r\n", res.length);
            });
        },
        /** Esquece o cache (troca de banco/cópia já faz isso sozinha pela chave). */
        invalidar() { cache = null; },
        status() { return cache ? { itens: cache.linhas.length, tabela: cache.tabela, carregadoEm: cache.carregadoEm, papeis: cache.papeis } : null; }
    };
    return api;
}

module.exports = { criarEstoque, normalizar, VERSAO, PAPEIS };
