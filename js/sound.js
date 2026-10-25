/* Óptica Tycoon — efectos de sonido sintetizados con Web Audio (sin archivos de audio).
   Sound.play(nombre) · Sound.toggle() · Sound.on. El audio arranca con el primer clic (política de autoplay). */
'use strict';

const Sound = {
  on: true, ctx: null, master: null,
  init() {
    try { const v = localStorage.getItem('opticaTycoon.sound'); if (v === '0') this.on = false; } catch (e) { /* sin almacenamiento */ }
  },
  ensure() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume().catch(() => {}); /* iOS: 'interrupted' tras llamadas o segundo plano */ return this.ctx; }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext); if (!AC) return null;
    try { this.ctx = new AC(); this.master = this.ctx.createGain(); this.master.gain.value = 0.22; this.master.connect(this.ctx.destination); } catch (e) { this.ctx = null; }
    return this.ctx;
  },
  toggle() { this.on = !this.on; try { localStorage.setItem('opticaTycoon.sound', this.on ? '1' : '0'); } catch (e) { /* sin almacenamiento */ } if (this.on) this.play('click'); return this.on; },
  /* una nota: frecuencia, inicio (s desde ahora), duración, forma de onda, volumen relativo */
  tone(f, t0, dur, type, vol) {
    const c = this.ctx; const o = c.createOscillator(); const g = c.createGain(); const t = c.currentTime + (t0 || 0);
    o.type = type || 'sine'; o.frequency.setValueAtTime(f, t);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol || 0.6, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t + dur + 0.05);
  },
  noise(t0, dur, vol) {
    const c = this.ctx; const n = Math.floor(c.sampleRate * dur); const b = c.createBuffer(1, n, c.sampleRate); const d = b.getChannelData(0); for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const s = c.createBufferSource(); s.buffer = b; const g = c.createGain(); g.gain.value = vol || 0.3; const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(c.currentTime + (t0 || 0));
  },
  play(name, arg) {
    if (!this.on || !this.ensure()) return;
    try {
      const N = (semi) => 523.25 * Math.pow(2, semi / 12); /* do5 como referencia */
      switch (name) {
        case 'click': this.tone(1200, 0, 0.04, 'triangle', 0.18); break;
        case 'chime': this.tone(N(7), 0, 0.35, 'sine', 0.25); this.tone(N(12), 0.09, 0.45, 'sine', 0.2); break;
        case 'launch': [0, 4, 7, 12].forEach((s, i) => this.tone(N(s), i * 0.09, 0.3, 'triangle', 0.4)); break;
        case 'press': this.noise(0, 0.12, 0.12); this.noise(0.14, 0.1, 0.1); break;
        /* cada reseña: más aguda cuanto mejor la nota */
        case 'review': { const sc = Math.max(1, Math.min(10, +arg || 5)); this.tone(N(-5 + sc * 1.6), 0, 0.22, 'square', 0.16); this.tone(N(-5 + sc * 1.6) * 2, 0.03, 0.18, 'sine', 0.12); break; }
        case 'good': [0, 4, 7, 12, 16].forEach((s, i) => this.tone(N(s), i * 0.08, 0.5, 'triangle', 0.38)); break;
        case 'bad': [0, -3, -7].forEach((s, i) => this.tone(N(s - 5), i * 0.16, 0.38, 'sine', 0.3)); break;
        case 'fanfare': [[0, 0], [4, 0.12], [7, 0.24], [12, 0.36], [7, 0.52], [12, 0.62]].forEach(([s, t]) => { this.tone(N(s), t, 0.42, 'sawtooth', 0.16); this.tone(N(s), t, 0.42, 'triangle', 0.3); }); break;
        case 'cash': this.tone(N(19), 0, 0.12, 'square', 0.18); this.tone(N(24), 0.07, 0.4, 'sine', 0.3); this.noise(0, 0.05, 0.08); break;
        case 'error': this.tone(220, 0, 0.16, 'square', 0.15); this.tone(196, 0.1, 0.2, 'square', 0.12); break;
      }
    } catch (e) { /* el sonido nunca debe romper el juego */ }
  }
};
Sound.init();
