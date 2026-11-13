// Service worker de Gestión Científica CGyAD-GITIC (v0.9)
// 1) Guarda la INTERFAZ (la página lleva dentro la letra y los iconos; los datos nunca se guardan) para que la web abra al instante, también con mala conexión.
//    La página guardada se muestra enseguida y, a la vez, se pide la publicada: si es distinta, se guarda y la web avisa
//    («Hay una versión nueva · Actualizar»).
// 2) Recibe las notificaciones push. El aviso llega vacío: el texto se pide al servidor con el código propio de este dispositivo.
var CACHE = "gc-app-v2";
var ESTATICOS = ["manifest.webmanifest", "icon-192.png", "favicon-32.png", "apple-touch-icon.png", "badge-96.png"];

self.addEventListener("install", function (e) {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(["./", "config.js"].concat(ESTATICOS)); }).catch(function () {}));
});
self.addEventListener("activate", function (e) {
  e.waitUntil(caches.keys().then(function (ks) {
    return Promise.all(ks.filter(function (k) { return k.indexOf("gc-app-") === 0 && k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).catch(function () {}).then(function () { return self.clients.claim(); }));
});
function avisarVersion() {
  return self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) { cs.forEach(function (c) { c.postMessage({ nuevaVersion: true }); }); }).catch(function () {});
}
// Pide el archivo a la red, lo guarda y, si ha cambiado respecto al guardado, avisa a la página
function revalidar(clave, url) {
  return fetch(url, { cache: "no-cache" }).then(function (r) {
    if (!r || !r.ok || r.redirected || (r.type && r.type !== "basic")) return r;
    var paraGuardar = r.clone(), paraComparar = r.clone();
    return caches.open(CACHE).then(function (c) {
      return c.match(clave).then(function (vieja) {
        return Promise.all([vieja ? vieja.text() : null, paraComparar.text()]).then(function (t) {
          return c.put(clave, paraGuardar).then(function () { if (t[0] !== null && t[0] !== t[1]) return avisarVersion(); });
        });
      });
    }).catch(function () {}).then(function () { return r; });
  });
}
self.addEventListener("fetch", function (e) {
  var req = e.request, base = self.registration.scope;
  if (req.method !== "GET" || req.url.indexOf(base) !== 0) return;                    // el servidor (Apps Script) y lo demás: red normal
  var ruta = req.url.slice(base.length).split("?")[0].split("#")[0];
  var esPagina = req.mode === "navigate" || ruta === "" || ruta === "index.html";
  if (esPagina || ruta === "config.js") {
    var clave = esPagina ? "./" : "config.js", url = esPagina ? base : base + "config.js";
    e.respondWith(caches.open(CACHE).then(function (c) { return c.match(clave); }).then(function (guardada) {
      var red = revalidar(clave, url);
      if (guardada) { e.waitUntil(red.catch(function () {})); return guardada; }
      return red;
    }).catch(function () { return fetch(req); }));
    return;
  }
  if (/^(icon-|favicon-|apple-touch-icon|badge-|manifest\.webmanifest)/.test(ruta)) {
    e.respondWith(caches.open(CACHE).then(function (c) {
      return c.match(req, { ignoreSearch: true }).then(function (g) {
        return g || fetch(req).then(function (r) { if (r && r.ok) c.put(req, r.clone()); return r; });
      });
    }).catch(function () { return fetch(req); }));
  }
});

// ---- notificaciones push ----
function leerCfg() {
  return new Promise(function (ok) {
    try {
      var rq = indexedDB.open("gc-push", 1);
      rq.onupgradeneeded = function () { rq.result.createObjectStore("cfg"); };
      rq.onsuccess = function () { try { var g = rq.result.transaction("cfg", "readonly").objectStore("cfg").get("cfg"); g.onsuccess = function () { ok(g.result || null); }; g.onerror = function () { ok(null); }; } catch (e) { ok(null); } };
      rq.onerror = function () { ok(null); };
    } catch (e) { ok(null); }
  });
}
function pedirAvisos(cfg) {
  if (!cfg || !cfg.api || !cfg.secreto) return Promise.resolve([]);
  return fetch(cfg.api, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" }, body: JSON.stringify({ fn: "webPushPendientes", args: [cfg.secreto] }), redirect: "follow" })
    .then(function (r) { return r.json(); }).then(function (j) { return (j && j.r) || []; }).catch(function () { return []; });
}
self.addEventListener("push", function (e) {
  e.waitUntil(leerCfg().then(pedirAvisos).then(function (lista) {
    if (!lista.length) lista = [{ id: "general", titulo: "Gestión Científica CGyAD-GITIC", texto: "Tienes avisos nuevos. Abre la app para verlos.", vista: "inicio" }];
    return Promise.all(lista.map(function (a) {
      return self.registration.showNotification(a.titulo || "Gestión Científica CGyAD-GITIC", {
        body: a.texto || "", icon: "icon-192.png", badge: "badge-96.png", tag: "gc-" + (a.id || "general"), silent: !!a.repetido, data: { vista: a.vista || "inicio" } });
    }));
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var vista = (e.notification.data && e.notification.data.vista) || "inicio", url = new URL("./#ir=" + vista, self.registration.scope).href;
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (cs) {
    for (var i = 0; i < cs.length; i++) if (cs[i].url.indexOf(self.registration.scope) === 0 && "focus" in cs[i]) { cs[i].postMessage({ ir: vista }); return cs[i].focus(); }
    return self.clients.openWindow(url);
  }));
});
