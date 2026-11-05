/**
 * estoque-sw.js
 * @version 1.0.3
 * @author Ruda Gabriel
 * @description Service worker do estoque (Relatórios SmallSoft Offline).
 *
 * Guarda NO APARELHO a página do estoque, as regras da busca e o leitor de código
 * de barras, para o estoque abrir mesmo com o servidor de relatórios fora do ar (os
 * dados ficam no IndexedDB, gravados pela própria página do estoque).
 *
 * Só intercepta: a página /estoque (rede primeiro; sem rede, a cópia guardada),
 * os arquivos do estoque e do leitor (cópia guardada, atualizada em segundo plano)
 * e, sem rede, qualquer outra página (aviso "somente o estoque está disponível").
 * Todo o resto (API, SSE, relatório com o servidor no ar) passa direto.
 *
 * O navegador só aceita service worker em página segura (HTTPS, porta 7736, ou
 * localhost) — por http://IP:7735 o estoque continua funcionando enquanto a página
 * estiver aberta, mas não abre de novo sem o servidor.
 *
 * 1.0.3 — Textos da página de reserva em linguagem formal ("Servidor de relatórios indisponível",
 *         "Retornar ao relatório em tempo real").
 * Histórico completo das versões: CHANGELOG.md no repositório.
 */
"use strict";
var CACHE = "estoque-offline-v3";
var PAGINA = "/estoque";
var ARQUIVOS = [
    "/estoque-busca.js",
    "/leitor/leitor.js", "/leitor/foco.js",
    "/leitor/vendor/barcode-detector-ponyfill.js", "/leitor/vendor/zxing-library.min.js", "/leitor/vendor/zxing_reader.wasm"
];

self.addEventListener("install", function (ev) {
    ev.waitUntil(caches.open(CACHE).then(function (c) {
        // Um arquivo que falhar não impede os outros (nem a instalação).
        return Promise.all([PAGINA].concat(ARQUIVOS).map(function (u) { return c.add(new Request(u, { cache: "no-store" })).catch(function () {}); }));
    }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (ev) {
    ev.waitUntil(caches.keys().then(function (ks) {
        return Promise.all(ks.filter(function (k) { return k.indexOf("estoque-offline-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    }).then(function () { return self.clients.claim(); }));
});

// Rede com prazo: servidor travado não segura a tela (cai para a cópia guardada).
var comPrazo = function (req, ms) {
    return new Promise(function (ok, falha) {
        var t = setTimeout(function () { falha(new Error("tempo esgotado")); }, ms);
        fetch(req).then(function (r) { clearTimeout(t); ok(r); }, function (e) { clearTimeout(t); falha(e); });
    });
};

var paginaSemServidor = function () {
    var html = '<!doctype html><html lang="pt-br"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
        '<title>Servidor indisponível</title><style>' +
        'body{margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;background:#0b1120;color:#e5e7eb;font:15px/1.5 Inter,"Segoe UI",Arial,sans-serif;padding:20px;box-sizing:border-box}' +
        '.c{max-width:460px;background:#111827;border:1px solid rgba(148,163,184,.25);border-radius:16px;padding:24px;text-align:center}' +
        'h1{font-size:19px;margin:0 0 8px;color:#fca5a5}p{margin:8px 0;color:#cbd5e1}b{color:#f8fafc}' +
        'a{display:inline-block;margin-top:14px;padding:11px 18px;border-radius:12px;background:#2563eb;color:#fff;text-decoration:none;font-weight:700}' +
        '</style></head><body><div class="c"><h1>Servidor de relatórios indisponível</h1>' +
        '<p><b>Somente o estoque está disponível</b>, pela cópia salva neste aparelho.</p><p id="info"></p>' +
        '<a href="/estoque" id="abrirEst">Abrir o estoque</a><p style="font-size:12px;margin-top:16px" id="volta">O relatório voltará a ser exibido quando o servidor for iniciado novamente.</p></div>' +
        '<script>try{var m=JSON.parse(localStorage.getItem("estoqueOffline.meta")||"null");if(m&&m.carregadoEm){' +
        'var p=function(n){return(n<10?"0":"")+n},d=new Date(m.dadosDe||m.carregadoEm),b=Number(m.bytes)||0;' +
        'document.getElementById("info").textContent="Estoque atualizado em "+p(d.getDate())+"/"+p(d.getMonth()+1)+"/"+d.getFullYear()+" "+p(d.getHours())+":"+p(d.getMinutes())+' +
        '" · "+Number(m.itens||0).toLocaleString("pt-BR")+" itens · "+(b>=1073741824?(b/1073741824).toFixed(2).replace(".",",")+" GB":b>=1048576?(b/1048576).toFixed(1).replace(".",",")+" MB":Math.max(1,Math.round(b/1024))+" KB");' +
        '}else document.getElementById("info").textContent="Este aparelho ainda não possui uma cópia do estoque.";}catch(e){}' +
        // 1.0.2: abre a CÓPIA da página do estoque guardada no aparelho (estoqueOffline.kit).
        // Antes o botão ia para /estoque e, sem a página no cache do service worker, caía de
        // novo nesta mesma tela — no celular parecia que "nada acontecia".
        'var abrirKit=function(){try{var k=localStorage.getItem("estoqueOffline.kit");if(!k)return false;document.open();document.write(k);document.close();return true;}catch(e){return false;}};' +
        'document.getElementById("abrirEst").onclick=function(e){e.preventDefault();if(abrirKit())return;' +
        'if(location.pathname!=="/estoque"){location.href="/estoque";return;}' +
        'document.getElementById("info").textContent="Este aparelho ainda não possui a cópia do estoque: abra o estoque uma vez com o servidor ligado.";};' +
        // Já em /estoque (página do estoque sem cache): abre a cópia direto, sem precisar tocar.
        'if(location.pathname==="/estoque")abrirKit();' +
        // Servidor de volta: botão para voltar ao ao vivo (confere a cada 10 s).
        'var conf=function(){fetch("/api/db-status",{cache:"no-store"}).then(function(r){if(!r.ok)throw 0;var v=document.getElementById("volta");' +
        'v.innerHTML="<b style=\\"color:#86efac\\">✓ O servidor de relatórios está disponível novamente.</b><br><a href=\\"\\" id=\\"aoVivo\\" style=\\"background:#16a34a\\">Retornar ao relatório em tempo real</a>";' +
        'document.getElementById("aoVivo").onclick=function(e){e.preventDefault();location.reload();};}).catch(function(){setTimeout(conf,10000);});};setTimeout(conf,10000);' +
        '<\/script></body></html>';
    return new Response(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" } });
};

self.addEventListener("fetch", function (ev) {
    var req = ev.request;
    if (req.method !== "GET") return;
    var url;
    try { url = new URL(req.url); } catch (e) { return; }
    if (url.origin !== self.location.origin) return;

    // Página do estoque: rede primeiro (dados e versão sempre atuais); sem rede, a guardada.
    if (url.pathname === PAGINA) {
        ev.respondWith(comPrazo(req, 6000).then(function (r) {
            if (r && r.ok) { var cp = r.clone(); caches.open(CACHE).then(function (c) { return c.put(PAGINA, cp); }).catch(function () {}); }
            return r;
        }).catch(function () {
            return caches.match(PAGINA, { ignoreSearch: true }).then(function (r) { return r || paginaSemServidor(); });
        }));
        return;
    }
    // Arquivos do estoque/leitor: a cópia guardada na hora; atualiza em segundo plano.
    if (ARQUIVOS.indexOf(url.pathname) >= 0) {
        ev.respondWith(caches.open(CACHE).then(function (c) {
            return c.match(url.pathname).then(function (guardado) {
                var daRede = fetch(req).then(function (r) { if (r && r.ok) c.put(url.pathname, r.clone()).catch(function () {}); return r; });
                if (guardado) { daRede.catch(function () {}); return guardado; }
                return daRede;
            });
        }));
        return;
    }
    // Outras páginas (relatório...): direto do servidor; se ele não responder, o aviso.
    if (req.mode === "navigate") {
        ev.respondWith(fetch(req).catch(function () { return paginaSemServidor(); }));
    }
});
