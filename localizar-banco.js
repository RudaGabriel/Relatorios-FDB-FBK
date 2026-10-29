"use strict";

/**
 * localizar-banco.js
 * @version 1.0.0
 * @author Ruda Gabriel
 * @description Acha o SMALL.FDB do Small Commerce — nesta máquina ou na rede —
 *              SEM CONECTAR NO BANCO (Relatórios SmallSoft Offline).
 *
 * Procura, nesta ordem, e para no primeiro ARQUIVO que existir:
 *   1. o que está no config.json (fdbArquivo, fdbPath);
 *   2. as pastas padrão do Small Commerce nesta máquina;
 *   3. os arquivos de configuração (.ini/.cfg/.conf) da pasta do Small Commerce,
 *      que dizem onde está o banco ("SERVIDOR:C:\...\SMALL.FDB", "\\servidor\...");
 *   4. as unidades de rede mapeadas (D: a Z:) nas pastas de costume;
 *   5. os compartilhamentos das máquinas citadas nesses arquivos ("net view");
 *   6. se nada deu certo: as máquinas da rede com a porta 3050 aberta (só um
 *      teste de porta TCP — nenhum login no Firebird) e os compartilhamentos delas.
 *
 * Devolve { arquivo, host, path, origem }:
 *   arquivo — caminho pelo qual o ARQUIVO pode ser copiado (local, unidade de
 *             rede ou \\servidor\compartilhamento); "" se não achou;
 *   host/path — endereço do banco no servidor Firebird, usado só pelo gbak
 *             direto (reserva da cópia offline); "" se não se sabe.
 * Nada aqui abre o banco: só verifica se o arquivo existe (atributos).
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const net = require("net");
const cp = require("child_process");

const VERSAO = "1.0.0";
const WIN = process.platform === "win32";
// Onde o SMALL.FDB costuma ficar dentro de uma unidade ou compartilhamento.
const SUBCAMINHOS = [
    "SMALL.FDB",
    path.join("Small Commerce", "SMALL.FDB"),
    path.join("SmallSoft", "Small Commerce", "SMALL.FDB"),
    path.join("Dados", "SMALL.FDB"),
    path.join("SmallCommerce", "SMALL.FDB"),
    path.join("Program Files (x86)", "SmallSoft", "Small Commerce", "SMALL.FDB"),
    path.join("Program Files", "SmallSoft", "Small Commerce", "SMALL.FDB")
];

const _ehLocal = h => { const s = String(h || "").trim().toLowerCase(); return !s || s === "127.0.0.1" || s === "localhost" || s === "::1"; };
const _ehUNC = p => /^\\\\[^\\]+\\[^\\]+/.test(String(p || ""));
const _uniq = a => { const vis = new Set(); return a.filter(x => { const k = String(x || "").toUpperCase(); if (!x || vis.has(k)) return false; vis.add(k); return true; }); };

/** stat com prazo: caminho de rede inacessível pode demorar dezenas de segundos. */
function existeArquivo(arq, prazoMs) {
    return new Promise(resolve => {
        let fim = false;
        const t = setTimeout(() => { if (!fim) { fim = true; resolve(false); } }, prazoMs || 4000);
        fs.stat(arq, (e, s) => { if (fim) return; fim = true; clearTimeout(t); resolve(!e && s.isFile() && s.size > 0); });
    });
}

/** Pastas padrão do Small Commerce nesta máquina. */
function pastasPadrao() {
    const pf86 = process.env["ProgramFiles(x86)"] || "C:\\Program Files (x86)";
    const pf = process.env["ProgramFiles"] || "C:\\Program Files";
    const pd = process.env["ProgramData"] || "C:\\ProgramData";
    return [
        path.join(pf86, "SmallSoft", "Small Commerce"), path.join(pf, "SmallSoft", "Small Commerce"),
        path.join(pd, "SmallSoft", "Small Commerce"), "C:\\SmallSoft\\Small Commerce", "C:\\SmallCommerce", "C:\\Dados", "C:\\Small"
    ];
}

/**
 * Lê .ini/.cfg/.conf/.txt das pastas e devolve referências ao banco:
 *   { servidores: [{host, path}], arquivos: ["\\srv\...", "C:\..."] }
 */
function lerReferencias(pastas) {
    const servidores = [], arquivos = [];
    const reSrv = /(?:^|[\s="';,])((?:\d{1,3}(?:\.\d{1,3}){3})|[A-Za-z][\w.-]+)(?:\/\d+)?:([A-Za-z]:\\[^\r\n"';|<>]*?\.fdb)\b/gim;
    const reUNC = /(\\\\[^\r\n"';|<>\\]+\\[^\r\n"';|<>]*?\.fdb)\b/gi;
    const reLocal = /(?:^|[\s="';,])([A-Za-z]:\\[^\r\n"';|<>]*?\.fdb)\b/gim;
    (pastas || []).forEach(dir => {
        let nomes = [];
        try { nomes = fs.readdirSync(dir); } catch (_) { return; }
        nomes.filter(n => /\.(ini|cfg|conf|config|txt|xml)$/i.test(n)).slice(0, 200).forEach(n => {
            const arq = path.join(dir, n);
            let txt = "";
            try { const st = fs.statSync(arq); if (!st.isFile() || st.size > 512 * 1024) return; txt = fs.readFileSync(arq, "latin1"); } catch (_) { return; }
            let m;
            reSrv.lastIndex = 0;
            while ((m = reSrv.exec(txt))) if (!/^[A-Za-z]$/.test(m[1])) servidores.push({ host: m[1], path: m[2].trim(), de: arq });
            reUNC.lastIndex = 0;
            while ((m = reUNC.exec(txt))) arquivos.push(m[1].trim());
            reLocal.lastIndex = 0;
            while ((m = reLocal.exec(txt))) arquivos.push(m[1].trim());
        });
    });
    return { servidores, arquivos: _uniq(arquivos) };
}

/** Compartilhamentos de disco de uma máquina ("net view \\host"), como raízes \\host\nome. */
function compartilhamentos(host, prazoMs) {
    if (!WIN) return Promise.resolve([]);
    return new Promise(resolve => {
        cp.execFile("net", ["view", "\\\\" + host, "/all"], { timeout: prazoMs || 8000, windowsHide: true, encoding: "latin1" }, (e, out) => {
            if (e || !out) { resolve([]); return; }
            const linhas = String(out).split(/\r?\n/);
            const i = linhas.findIndex(l => /^-{5,}/.test(l.trim()));
            if (i < 0) { resolve([]); return; }
            const raizes = [];
            linhas.slice(i + 1).forEach(l => {
                const col = l.split(/\s{2,}/);
                if (col.length >= 2 && /^(Disk|Disco)$/i.test(col[1].trim()) && col[0].trim()) raizes.push("\\\\" + host + "\\" + col[0].trim());
            });
            resolve(raizes);
        });
    });
}

/** Máquinas da rede local (/24) com a porta do Firebird aberta — só teste de porta TCP. */
function maquinasComFirebird(porta, prazoMs) {
    return new Promise(resolve => {
        let base = null;
        try {
            const ifs = os.networkInterfaces();
            Object.keys(ifs).some(k => (ifs[k] || []).some(a => {
                const v4 = a && (a.family === "IPv4" || a.family === 4);
                if (v4 && !a.internal && /^(10|172\.(1[6-9]|2\d|3[01])|192\.168)\./.test(a.address) && !/tailscale|zerotier|vmware|virtualbox|vethernet/i.test(k)) { base = a.address.split(".").slice(0, 3).join("."); return true; }
                return false;
            }));
        } catch (_) {}
        if (!base) { resolve([]); return; }
        const achados = [], fila = [];
        for (let i = 1; i <= 254; i++) fila.push(base + "." + i);
        let ativos = 0, feitos = 0;
        const proximo = () => {
            while (ativos < 40 && fila.length) {
                const ip = fila.shift(); ativos++;
                const s = new net.Socket(); let fim = false;
                const acabar = ok => { if (fim) return; fim = true; try { s.destroy(); } catch (_) {} if (ok) achados.push(ip); ativos--; feitos++; if (feitos === 254) resolve(achados); else proximo(); };
                s.setTimeout(prazoMs || 450);
                s.on("connect", () => acabar(true)); s.on("error", () => acabar(false)); s.on("timeout", () => acabar(false));
                try { s.connect(porta || 3050, ip); } catch (_) { acabar(false); }
            }
        };
        proximo();
    });
}

/**
 * Procura o banco. opcoes:
 *   configHost, configPath, configArquivo — do config.json
 *   pastasIni      — pastas onde procurar arquivos de configuração (padrão: pastas do Small)
 *   raizes         — raízes extras (unidades/pastas) onde aplicar SUBCAMINHOS (padrão: D:..Z:)
 *   compartilhamentos(host) → Promise<raízes>   (padrão: net view)
 *   maquinasRede() → Promise<hosts>              (padrão: teste da porta 3050 na /24)
 *   varrerRede     — permite o passo 6 (padrão true)
 *   prazoMs, log
 */
async function localizarBanco(opcoes) {
    const o = Object.assign({ varrerRede: true, prazoMs: 4000 }, opcoes || {});
    const log = typeof o.log === "function" ? o.log : () => {};
    const shares = typeof o.compartilhamentos === "function" ? o.compartilhamentos : (h => compartilhamentos(h, 8000));
    const rede = typeof o.maquinasRede === "function" ? o.maquinasRede : (() => maquinasComFirebird(o.porta || 3050));
    const cfgHost = String(o.configHost || "").trim(), cfgPath = String(o.configPath || "").trim(), cfgArq = String(o.configArquivo || "").trim();
    const testados = new Set();
    const testar = async (lista, origem) => {
        for (const c of _uniq(lista)) {
            const k = c.toUpperCase();
            if (testados.has(k)) continue;
            testados.add(k);
            if (await existeArquivo(c, o.prazoMs)) return { arquivo: c, origem };
        }
        return null;
    };
    // Endereço para o gbak (reserva): o do config, ou o primeiro citado pelo Small.
    const pastasSmall = o.pastasIni || pastasPadrao();
    const refs = lerReferencias(pastasSmall.concat(cfgPath && !_ehUNC(cfgPath) && _ehLocal(cfgHost) ? [path.dirname(cfgPath)] : []));
    const servidor = (cfgPath && !_ehLocal(cfgHost) && !_ehUNC(cfgPath)) ? { host: cfgHost, path: cfgPath }
        : (refs.servidores.find(r => !_ehLocal(r.host)) || null);
    const resultado = (achado) => {
        const r = { arquivo: achado ? achado.arquivo : "", origem: achado ? achado.origem : "", host: "", path: "" };
        if (achado && !_ehUNC(achado.arquivo) && /^[A-Za-z]:\\|^\//.test(achado.arquivo) && !(achado.rede)) {
            // Arquivo nesta máquina: o Firebird local também o alcança pelo mesmo caminho.
            r.host = "127.0.0.1"; r.path = achado.arquivo;
        }
        // Arquivo achado na rede: o endereço do gbak só vale se for da MESMA máquina.
        if (achado && achado.rede && servidor && (!achado.hostRede || achado.hostRede === servidor.host)) { r.host = servidor.host; r.path = servidor.path; }
        if (!r.path && servidor) { r.host = servidor.host; r.path = servidor.path; }
        if (!r.path && cfgPath && !_ehUNC(cfgPath)) { r.host = cfgHost || "127.0.0.1"; r.path = cfgPath; }
        return r;
    };

    // 1. config.json
    let a = await testar([cfgArq, _ehUNC(cfgPath) ? cfgPath : "", _ehLocal(cfgHost) ? cfgPath : ""].filter(Boolean), "config.json");
    if (a) { a.rede = _ehUNC(a.arquivo); return resultado(a); }
    // 2. pastas padrão nesta máquina
    a = await testar(pastasSmall.map(d => path.join(d, "SMALL.FDB")), "pasta padrão do Small Commerce");
    if (a) return resultado(a);
    // 3. referências nos arquivos de configuração do Small
    a = await testar(refs.arquivos, "configuração do Small Commerce");
    if (a) { a.rede = _ehUNC(a.arquivo); return resultado(a); }
    // 4. unidades de rede mapeadas / raízes extras
    const raizes = o.raizes || (WIN ? "DEFGHIJKLMNOPQRSTUVWXYZ".split("").map(l => l + ":\\").filter(r => { try { return fs.existsSync(r); } catch (_) { return false; } }) : []);
    const candRaizes = [];
    raizes.forEach(r => SUBCAMINHOS.forEach(s => candRaizes.push(path.join(r, s))));
    a = await testar(candRaizes, "unidade de rede");
    if (a) { a.rede = true; return resultado(a); }
    // 5. compartilhamentos das máquinas citadas (config/Small)
    const hosts = _uniq([servidor && servidor.host].concat(refs.servidores.map(r => r.host)).filter(h => h && !_ehLocal(h)));
    for (const h of hosts) {
        const cand = [];
        // Compartilhamento administrativo (\\host\C$\...) — só funciona com permissão de administrador.
        refs.servidores.concat(servidor ? [servidor] : []).filter(r => r.host === h).forEach(r => {
            const m = String(r.path).match(/^([A-Za-z]):\\(.*)$/);
            if (m && WIN) cand.push("\\\\" + h + "\\" + m[1] + "$\\" + m[2]);
        });
        let rs = [];
        try { rs = await shares(h); } catch (_) {}
        rs.forEach(r => SUBCAMINHOS.forEach(s => cand.push(path.join(r, s))));
        a = await testar(cand, "compartilhamento de " + h);
        if (a) { a.rede = true; a.hostRede = h; return resultado(a); }
    }
    // 6. máquinas com Firebird na rede (só teste de porta) e seus compartilhamentos
    if (o.varrerRede) {
        let maqs = [];
        try { maqs = await rede(); } catch (_) {}
        if (maqs.length) log("Procurando o SMALL.FDB nos compartilhamentos de " + maqs.length + " máquina(s) com Firebird na rede: " + maqs.join(", ") + ".");
        for (const h of maqs) {
            if (hosts.indexOf(h) >= 0) continue;
            let rs = [];
            try { rs = await shares(h); } catch (_) {}
            const cand = [];
            rs.forEach(r => SUBCAMINHOS.forEach(s => cand.push(path.join(r, s))));
            a = await testar(cand, "compartilhamento de " + h);
            if (a) { a.rede = true; a.hostRede = h; return resultado(a); }
        }
    }
    return resultado(null);
}

module.exports = { localizarBanco, lerReferencias, existeArquivo, compartilhamentos, maquinasComFirebird, SUBCAMINHOS, VERSAO };
