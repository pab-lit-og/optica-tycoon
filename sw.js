/* Óptica Tycoon — modo sin conexión. Guarda una copia del juego en el dispositivo la primera vez que se abre con internet.
   La página se pide primero a la red (para recibir las actualizaciones) y, sin conexión, se sirve la copia guardada. */
'use strict';
const VERSION = '20261023c'; /* lo cambia publicar.sh en cada publicación */
const CACHE = 'optica-tycoon-' + VERSION;
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => './' + m[1].replace(/^\.\//, ''));
    await c.addAll([...new Set(BASE.concat(assets))]);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => { for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k); await self.clients.claim(); })());
});

self.addEventListener('fetch', e => {
  const r = e.request; if (r.method !== 'GET' || new URL(r.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    const c = await caches.open(CACHE);
    if (r.mode === 'navigate') { try { const net = await fetch(r); if (net.ok) c.put('./index.html', net.clone()); return net; } catch (err) { return (await c.match('./index.html')) || (await c.match('./')) || Response.error(); } }
    const hit = await c.match(r); if (hit) return hit;
    try { const net = await fetch(r); if (net.ok) c.put(r, net.clone()); return net; } catch (err) { return Response.error(); }
  })());
});
