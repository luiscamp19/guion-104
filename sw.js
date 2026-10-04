// Guarda la página en el iPad para que funcione sin internet.
// Siempre responde con la copia guardada (rápido y sin depender de la red) y, si hay internet,
// descarga en segundo plano la versión publicada; si cambió, la guarda y avisa a la página.
var CACHE = 'guion104';
var ARCHIVOS = ['./', 'index.html', 'manifest.webmanifest', 'icono-180.png', 'icono-192.png', 'icono-512.png'];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(ARCHIVOS); }).then(function () { return self.skipWaiting(); }));
});
self.addEventListener('activate', function (e) { e.waitUntil(self.clients.claim()); });

function avisar() {
  return self.clients.matchAll({ includeUncontrolled: true }).then(function (cs) {
    cs.forEach(function (c) { c.postMessage('nueva-version'); });
  });
}

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;
  var url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  var esPagina = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  var clave = esPagina ? new URL('index.html', self.registration.scope).href : url.href.split('?')[0];

  var trabajo = caches.open(CACHE).then(function (c) {
    return c.match(clave).then(function (guardada) {
      // copia para comparar: la original se entrega a la página y su contenido ya no se puede leer después
      var paraComparar = guardada ? guardada.clone() : null;
      // se pide por dirección (no con la solicitud original: las de navegación no aceptan opciones)
      var actualizar = fetch(esPagina ? clave : req.url, { cache: 'no-store' }).then(function (r) {
        if (!r || !r.ok) return null;
        if (!esPagina || !guardada) return c.put(clave, r.clone()).then(function () { return r; });
        return Promise.all([paraComparar.text(), r.clone().text()]).then(function (t) {
          if (t[0] === t[1]) return r;
          return c.put(clave, r.clone()).then(avisar).then(function () { return r; });
        });
      }).catch(function () { return null; });
      return { guardada: guardada, actualizar: actualizar };
    });
  });

  e.respondWith(trabajo.then(function (x) {
    if (x.guardada) return x.guardada;
    return x.actualizar.then(function (r) {
      return r || new Response('<h1>Sin conexión</h1><p>Abre la app una vez con internet para guardarla en el iPad.</p>',
        { status: 503, headers: { 'Content-Type': 'text/html; charset=utf-8' } });
    });
  }));
  e.waitUntil(trabajo.then(function (x) { return x.actualizar; }));
});
