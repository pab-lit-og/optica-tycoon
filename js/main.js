/* Óptica Tycoon — arranque y bucle principal */
'use strict';

(function () {
  /* Safari de iPad anterior a 17.4: los deslizadores de fase necesitan el apaño .oldrange (ver style.css) */
  { const ua = navigator.userAgent, v = ua.match(/Version\/(\d+)\.(\d+)/); if (v && /Safari/.test(ua) && !/Chrome|CriOS|FxiOS|Edg/.test(ua) && (+v[1] < 17 || (+v[1] === 17 && +v[2] < 4))) document.documentElement.classList.add('oldrange'); }
  const canvas = document.getElementById('canvas');
  Scene.init(canvas);
  UI.init();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    if (G.paused && dt < (G.modalOpen ? 90 : 30)) { requestAnimationFrame(frame); return; } /* en pausa basta con ~30 fps; con una ventana abierta, ~11 (ahorra batería) */
    last = now;
    try { G.tick(dt); } catch (e) { console.error(e); }
    try { Scene.draw(dt); } catch (e) { console.error(e); } /* un fallo de dibujo no debe parar el juego */
    UI.tickCash();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && /^https:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  /* guardar al salir: en iOS (app de pantalla de inicio) no llega beforeunload, sí visibilitychange/pagehide */
  const flush = () => { if (G.company && G.company.cash >= -G.overdraftLimit()) G.save(); };
  window.addEventListener('beforeunload', flush); window.addEventListener('pagehide', flush);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
})();
