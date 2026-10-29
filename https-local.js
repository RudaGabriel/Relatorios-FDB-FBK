"use strict";

/**
 * https-local.js
 * @version 1.0.0
 * @author Ruda Gabriel
 * @description Endereço HTTPS do sistema (Relatórios SmallSoft Offline).
 *
 * POR QUE EXISTE: o navegador do celular só libera a câmera AO VIVO (leitor de
 * código de barras do estoque) em página segura — HTTPS ou localhost. Por
 * http://IP:7735 ele só deixa tirar foto. Este módulo abre a MESMA aplicação
 * numa segunda porta (padrão: porta + 1 = 7736) com HTTPS.
 *
 * Certificados (nesta ordem):
 *  1. Tailscale (se instalado e com HTTPS ligado no painel): certificado
 *     oficial para o nome da máquina (pc-loja.tailxxxx.ts.net) — o celular abre
 *     SEM aviso nenhum. Renovado sozinho.
 *  2. Autoassinado, gerado aqui mesmo em Node puro (sem PowerShell, sem
 *     internet), para os IPs desta máquina: na primeira vez o celular mostra um
 *     aviso de certificado ("Avançado → Continuar"); depois disso funciona.
 *     Refeito sozinho quando o IP da máquina muda ou perto de vencer.
 *
 * Nada aqui toca no banco. Arquivos só na pasta "https" ao lado das cópias.
 *
 * 1.0.0 — primeira versão.
 * Histórico completo das versões: CHANGELOG.md no repositório.
 */

const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");
const tls = require("tls");
const crypto = require("crypto");
const cp = require("child_process");

const VERSAO = "1.0.0";
const DIAS_VALIDADE = 397;          // limite aceito pelos navegadores da Apple
const RENOVAR_ANTES_DIAS = 30;
const RENOVAR_TS_MS = 12 * 3600 * 1000;

// ---------------------------------------------------------------------------
// DER mínimo para montar um certificado X.509 v3 autoassinado.
// ---------------------------------------------------------------------------
const derLen = n => {
    if (n < 0x80) return Buffer.from([n]);
    const b = []; while (n > 0) { b.unshift(n & 0xff); n >>= 8; }
    return Buffer.from([0x80 | b.length, ...b]);
};
const tlv = (tag, conteudo) => Buffer.concat([Buffer.from([tag]), derLen(conteudo.length), conteudo]);
const seq = (...partes) => tlv(0x30, Buffer.concat(partes));
const set = (...partes) => tlv(0x31, Buffer.concat(partes));
const inteiro = buf => { if (buf[0] & 0x80) buf = Buffer.concat([Buffer.from([0]), buf]); return tlv(0x02, buf); };
const oid = texto => {
    const p = texto.split(".").map(Number), out = [40 * p[0] + p[1]];
    for (let i = 2; i < p.length; i++) {
        let v = p[i]; const b = [v & 0x7f]; v = Math.floor(v / 128);
        while (v > 0) { b.unshift((v & 0x7f) | 0x80); v = Math.floor(v / 128); }
        out.push(...b);
    }
    return tlv(0x06, Buffer.from(out));
};
const utf8 = s => tlv(0x0c, Buffer.from(String(s), "utf8"));
const octeto = buf => tlv(0x04, buf);
const bits = buf => tlv(0x03, Buffer.concat([Buffer.from([0]), buf]));
const booleano = v => tlv(0x01, Buffer.from([v ? 0xff : 0]));
const tempo = d => {
    // UTCTime até 2049; GeneralizedTime depois (regra do X.509).
    const p = n => String(n).padStart(2, "0");
    const y = d.getUTCFullYear();
    const corpo = p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + "Z";
    return y < 2050 ? tlv(0x17, Buffer.from(String(y).slice(2) + corpo)) : tlv(0x18, Buffer.from(y + corpo));
};
const nome = cn => seq(set(seq(oid("2.5.4.3"), utf8(cn))), set(seq(oid("2.5.4.10"), utf8("Relatorios SmallSoft Offline"))));
const ipBytes = ip => {
    if (net4(ip)) return Buffer.from(ip.split(".").map(Number));
    return null;
};
const net4 = ip => /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.test(ip) && ip.split(".").every(n => +n <= 255);

/**
 * Gera chave RSA 2048 + certificado autoassinado (PEM) válido para os nomes e
 * IPs informados. Puro Node: funciona igual em qualquer Windows.
 */
function gerarAutoassinado(nomes, ips, agora) {
    const { privateKey, publicKey } = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    const ini = new Date((agora || Date.now()) - 24 * 3600 * 1000);
    const fim = new Date(ini.getTime() + DIAS_VALIDADE * 24 * 3600 * 1000);
    const algoritmo = seq(oid("1.2.840.113549.1.1.11"), tlv(0x05, Buffer.alloc(0)));
    const serial = crypto.randomBytes(16); serial[0] &= 0x7f;
    const sans = [];
    for (const n of nomes) if (n) sans.push(tlv(0x82, Buffer.from(String(n), "ascii")));
    for (const ip of ips) { const b = ipBytes(ip); if (b) sans.push(tlv(0x87, b)); }
    const extensoes = seq(
        seq(oid("2.5.29.19"), booleano(true), octeto(seq())),                                   // basicConstraints: não é CA
        seq(oid("2.5.29.15"), booleano(true), octeto(tlv(0x03, Buffer.from([0x05, 0xa0])))),    // digitalSignature + keyEncipherment
        seq(oid("2.5.29.37"), octeto(seq(oid("1.3.6.1.5.5.7.3.1")))),                           // serverAuth
        seq(oid("2.5.29.17"), octeto(seq(...sans)))                                             // nomes e IPs
    );
    const cn = nomes[0] || ips[0] || "localhost";
    const tbs = seq(
        tlv(0xa0, inteiro(Buffer.from([2]))),
        inteiro(serial),
        algoritmo,
        nome(cn),
        seq(tempo(ini), tempo(fim)),
        nome(cn),
        publicKey.export({ type: "spki", format: "der" }),
        tlv(0xa3, extensoes)
    );
    const assinatura = crypto.sign("sha256", tbs, privateKey);
    const der = seq(tbs, algoritmo, bits(assinatura));
    const pem = "-----BEGIN CERTIFICATE-----\n" + der.toString("base64").match(/.{1,64}/g).join("\n") + "\n-----END CERTIFICATE-----\n";
    return { cert: pem, key: privateKey.export({ type: "pkcs8", format: "pem" }), validoAte: fim.getTime() };
}

/** IPv4 desta máquina (rede local e Tailscale), sem os internos. */
function ipsDaMaquina() {
    const out = ["127.0.0.1"];
    try {
        const ifs = os.networkInterfaces();
        Object.keys(ifs).forEach(n => (ifs[n] || []).forEach(a => {
            const v4 = a.family === "IPv4" || a.family === 4;
            if (v4 && !a.internal && net4(a.address) && out.indexOf(a.address) < 0) out.push(a.address);
        }));
    } catch (_) {}
    return out;
}

/** Caminho do tailscale.exe/tailscale (null se não estiver instalado). */
function localizarTailscale() {
    const cands = [];
    if (process.platform === "win32") {
        const pf = [process.env.ProgramFiles, process.env["ProgramFiles(x86)"], "C:\\Program Files"].filter(Boolean);
        pf.forEach(p => cands.push(path.join(p, "Tailscale", "tailscale.exe")));
    } else {
        cands.push("/usr/bin/tailscale", "/usr/local/bin/tailscale", "/usr/sbin/tailscale");
    }
    for (const c of cands) { try { if (fs.existsSync(c)) return c; } catch (_) {} }
    return null;
}

function criarHttpsLocal(o) {
    const log = typeof o.log === "function" ? o.log : () => {};
    const pasta = path.resolve(String(o.pasta));
    const porta = o.porta;
    const st = { server: null, ctxPadrao: null, ctxTs: null, tsNome: "", erro: "", ativo: false, ipsCert: [], avisouTs: false, timer: null };

    const arq = n => path.join(pasta, n);
    const lerJson = f => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch (_) { return null; } };
    const gravarAtomico = (f, dados) => { const t = f + ".tmp"; fs.writeFileSync(t, dados); fs.renameSync(t, f); };

    // Autoassinado: refeito se faltar, se um IP atual não estiver nele ou se estiver perto de vencer.
    function garantirAutoassinado() {
        fs.mkdirSync(pasta, { recursive: true });
        const meta = lerJson(arq("autoassinado.json"));
        const ips = ipsDaMaquina();
        const nomes = [os.hostname(), "localhost"].filter(Boolean).map(n => String(n).toLowerCase().replace(/[^a-z0-9.-]/g, "")).filter(Boolean);
        let refazer = !meta || !fs.existsSync(arq("autoassinado.key")) || !fs.existsSync(arq("autoassinado.crt"));
        if (!refazer && ips.some(ip => (meta.ips || []).indexOf(ip) < 0)) refazer = true;
        if (!refazer && !(meta.validoAte > Date.now() + RENOVAR_ANTES_DIAS * 24 * 3600 * 1000)) refazer = true;
        if (refazer) {
            // Mantém IPs antigos também (o celular pode ter o endereço salvo).
            const todos = Array.from(new Set(ips.concat(meta && Array.isArray(meta.ips) ? meta.ips.filter(net4) : []))).slice(0, 40);
            const c = gerarAutoassinado(nomes, todos);
            gravarAtomico(arq("autoassinado.key"), c.key);
            gravarAtomico(arq("autoassinado.crt"), c.cert);
            gravarAtomico(arq("autoassinado.json"), JSON.stringify({ versao: 1, ips: todos, nomes, validoAte: c.validoAte }, null, 2));
            log("HTTPS: certificado próprio gerado para " + todos.filter(i => i !== "127.0.0.1").join(", ") + " (válido até " + new Date(c.validoAte).toLocaleDateString("pt-BR") + ").");
        }
        st.ipsCert = (lerJson(arq("autoassinado.json")) || {}).ips || ips;
        st.ctxPadrao = tls.createSecureContext({ key: fs.readFileSync(arq("autoassinado.key")), cert: fs.readFileSync(arq("autoassinado.crt")) });
    }

    // Tailscale: pede/renova o certificado oficial do nome da máquina (só se o
    // HTTPS estiver ligado no painel do Tailscale; senão avisa uma vez no log).
    function atualizarTailscale(cb) {
        const fimOk = () => { try { cb && cb(); } catch (_) {} };
        const exe = o.tailscalePath === false ? null : (o.tailscalePath || localizarTailscale());
        if (!exe) return fimOk();
        cp.execFile(exe, ["status", "--json"], { timeout: 15000, windowsHide: true, maxBuffer: 8 * 1024 * 1024 }, (e1, saida) => {
            let nomeDns = "";
            try { nomeDns = String(JSON.parse(String(saida || "{}")).Self.DNSName || "").replace(/\.$/, "").toLowerCase(); } catch (_) {}
            if (e1 || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.ts\.net$/.test(nomeDns)) return fimOk();
            const crt = arq("tailscale.crt"), key = arq("tailscale.key");
            cp.execFile(exe, ["cert", "--cert-file", crt, "--key-file", key, nomeDns], { timeout: 90000, windowsHide: true }, e2 => {
                if (e2) {
                    if (!st.avisouTs) {
                        st.avisouTs = true;
                        log("HTTPS: o Tailscale não emitiu o certificado de " + nomeDns + " (" + String(e2.message || e2).split("\n")[0].slice(0, 200) + "). " +
                            "Para abrir sem aviso no celular, ligue \"HTTPS Certificates\" em https://login.tailscale.com/admin/dns . Enquanto isso, vale o certificado próprio.");
                    }
                    return fimOk();
                }
                try {
                    st.ctxTs = tls.createSecureContext({ key: fs.readFileSync(key), cert: fs.readFileSync(crt) });
                    if (st.tsNome !== nomeDns) log("HTTPS: certificado do Tailscale ativo para " + nomeDns + " (abre no celular sem aviso).");
                    st.tsNome = nomeDns;
                } catch (e3) { log("HTTPS: certificado do Tailscale ilegível: " + e3.message); }
                fimOk();
            });
        });
    }

    function iniciar() {
        if (!(porta > 0 && porta < 65536)) { st.erro = "porta inválida"; return; }
        try { garantirAutoassinado(); }
        catch (e) { st.erro = "não foi possível criar o certificado: " + e.message; log("HTTPS: " + st.erro); return; }
        const opcoes = {
            SNICallback: (servidor, cb) => {
                const s = String(servidor || "").toLowerCase();
                cb(null, st.ctxTs && st.tsNome && s === st.tsNome ? st.ctxTs : st.ctxPadrao);
            },
            key: fs.readFileSync(arq("autoassinado.key")), cert: fs.readFileSync(arq("autoassinado.crt"))
        };
        const srv = https.createServer(opcoes, o.handler);
        srv.on("tlsClientError", () => {}); // celular recusando o certificado: normal na 1ª vez
        srv.on("error", e => {
            st.ativo = false;
            st.erro = e && e.code === "EADDRINUSE" ? "a porta " + porta + " já está em uso" : String(e && e.message || e);
            log("HTTPS: não foi possível abrir a porta " + porta + " (" + st.erro + "). O leitor ao vivo no celular fica indisponível; o resto funciona normal.");
        });
        srv.listen(porta, o.bind || "0.0.0.0", () => {
            st.ativo = true; st.erro = "";
            log("HTTPS (leitor ao vivo no celular): porta " + porta + ".");
        });
        st.server = srv;
        atualizarTailscale();
        // Renovação: IP novo / validade (autoassinado) e certificado do Tailscale.
        st.timer = setInterval(() => {
            try { garantirAutoassinado(); } catch (e) { log("HTTPS: renovação do certificado falhou: " + e.message); }
            atualizarTailscale();
        }, RENOVAR_TS_MS);
        if (st.timer.unref) st.timer.unref();
    }

    function parar() {
        try { clearInterval(st.timer); } catch (_) {}
        try { st.server && st.server.close(); } catch (_) {}
        st.ativo = false;
    }

    /**
     * Endereço HTTPS para quem acessou por "host" (como o navegador digitou).
     * Pelo Tailscale (IP 100.x ou nome .ts.net) com certificado oficial: o nome,
     * sem aviso. Senão: o mesmo host na porta HTTPS (certificado próprio).
     */
    function enderecoPara(host) {
        if (!st.ativo) return null;
        const h = String(host || "").toLowerCase().replace(/:\d+$/, "").replace(/^\[|\]$/g, "");
        if (!h || !/^[a-z0-9.-]+$/.test(h)) return null;
        const ehTs = /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(h) || /\.ts\.net$/.test(h);
        if (ehTs && st.ctxTs && st.tsNome) return { url: "https://" + st.tsNome + ":" + porta, confiavel: true };
        return { url: "https://" + h + ":" + porta, confiavel: false };
    }

    return {
        VERSAO, iniciar, parar, enderecoPara,
        status: () => ({ ativo: st.ativo, porta, erro: st.erro || null, tailscale: st.tsNome || null, ips: st.ipsCert })
    };
}

module.exports = { criarHttpsLocal, gerarAutoassinado, ipsDaMaquina, VERSAO };
