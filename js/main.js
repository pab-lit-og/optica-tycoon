/* Óptica Tycoon — arranque y bucle principal */
'use strict';

(function () {
  const canvas = document.getElementById('canvas');
  Scene.init(canvas);
  UI.init();
  let last = performance.now();
  function frame(now) {
    const dt = Math.min(100, now - last);
    if (G.paused && dt < 30) { requestAnimationFrame(frame); return; } /* en pausa basta con ~30 fps */
    last = now;
    try { G.tick(dt); } catch (e) { console.error(e); }
    Scene.draw(dt); UI.tickCash();
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
  if ('serviceWorker' in navigator && /^https:$/.test(location.protocol)) navigator.serviceWorker.register('sw.js').catch(() => { /* sin modo sin conexión */ });
  window.addEventListener('beforeunload', () => { if (G.company && G.company.cash >= -G.overdraftLimit()) G.save(); });
})();
