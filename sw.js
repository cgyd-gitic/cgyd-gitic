// Service worker de Gestión Científica CGyAD-GITIC (v0.7.1): permite instalar la web como aplicación y recibe las
// notificaciones push. No guarda datos ni páginas en caché (siempre se carga la versión publicada).
// El aviso push llega vacío: el texto se pide al servidor con el código propio de este dispositivo (guardado en IndexedDB).
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* sin caché: el navegador hace la petición normal */ });

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
