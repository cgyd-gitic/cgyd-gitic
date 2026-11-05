// Service worker mínimo: permite instalar la web como aplicación. No guarda datos ni páginas en caché
// (siempre se carga la versión publicada), así que no hay que borrar nada al actualizar.
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", function () { /* sin caché: el navegador hace la petición normal */ });
