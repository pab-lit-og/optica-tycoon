/* Óptica Tycoon — modo sin conexión. Guarda una copia del juego en el dispositivo la primera vez que se abre con internet.
   La página se pide primero a la red (para recibir las actualizaciones) y, sin conexión, se sirve la copia guardada. */
'use strict';
const VERSION = '20261024c'; /* lo cambia publicar.sh en cada publicación */
const CACHE = 'optica-tycoon-' + VERSION;
const EXTRA = './img/gafas/alaire-g.webp,./img/gafas/alaire-s.webp,./img/gafas/aviador-g.webp,./img/gafas/aviador-s.webp,./img/gafas/bicolor-g.webp,./img/gafas/bicolor-s.webp,./img/gafas/carey-g.webp,./img/gafas/carey-s.webp,./img/gafas/cateye-g.webp,./img/gafas/cateye-s.webp,./img/gafas/clubmaster-g.webp,./img/gafas/clubmaster-s.webp,./img/gafas/crownpanto-g.webp,./img/gafas/crownpanto-s.webp,./img/gafas/doblepuente-g.webp,./img/gafas/doblepuente-s.webp,./img/gafas/eco-g.webp,./img/gafas/eco-s.webp,./img/gafas/envolventes-g.webp,./img/gafas/envolventes-s.webp,./img/gafas/escudo-g.webp,./img/gafas/escudo-s.webp,./img/gafas/flexible-g.webp,./img/gafas/flexible-s.webp,./img/gafas/flexkids-g.webp,./img/gafas/flexkids-s.webp,./img/gafas/glaciar-g.webp,./img/gafas/glaciar-s.webp,./img/gafas/hexagonales-g.webp,./img/gafas/hexagonales-s.webp,./img/gafas/keyhole-g.webp,./img/gafas/keyhole-s.webp,./img/gafas/lujosilencioso-g.webp,./img/gafas/lujosilencioso-s.webp,./img/gafas/mariposa-g.webp,./img/gafas/mariposa-s.webp,./img/gafas/medialuna-g.webp,./img/gafas/medialuna-s.webp,./img/gafas/microoval-g.webp,./img/gafas/microoval-s.webp,./img/gafas/minimal-g.webp,./img/gafas/minimal-s.webp,./img/gafas/navegador-g.webp,./img/gafas/navegador-s.webp,./img/gafas/neon-g.webp,./img/gafas/neon-s.webp,./img/gafas/nylor-g.webp,./img/gafas/nylor-s.webp,./img/gafas/pantos-g.webp,./img/gafas/pantos-s.webp,./img/gafas/rectangulares-g.webp,./img/gafas/rectangulares-s.webp,./img/gafas/redondas-g.webp,./img/gafas/redondas-s.webp,./img/gafas/soft-g.webp,./img/gafas/soft-s.webp,./img/gafas/surf-g.webp,./img/gafas/surf-s.webp,./img/gafas/titanio-g.webp,./img/gafas/titanio-s.webp,./img/gafas/transparentes-g.webp,./img/gafas/transparentes-s.webp,./img/gafas/wayfarer-g.webp,./img/gafas/wayfarer-s.webp'.split(',').filter(s => s && s.indexOf('__') < 0); /* fotos de las monturas (las pone publicar.sh) */
const BASE = ['./', './index.html', './manifest.webmanifest', './icons/icon-192.png', './icons/icon-512.png', './icons/apple-touch-icon.png'];

self.addEventListener('install', e => {
  e.waitUntil((async () => {
    const c = await caches.open(CACHE);
    const html = await (await fetch('./index.html', { cache: 'no-store' })).text();
    const assets = [...html.matchAll(/(?:src|href)="([^"#:]+)"/g)].map(m => './' + m[1].replace(/^\.\//, ''));
    await c.addAll([...new Set(BASE.concat(assets, EXTRA))]);
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
