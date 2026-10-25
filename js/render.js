/* Óptica Tycoon — escena isométrica (estilo Game Dev Tycoon, dibujo 100 % procedural)
   Contrato público: Scene.init(canvas), Scene.resize(), Scene.draw(dt), Scene.hitTest(x,y),
   Scene.addFloater(text,color), Scene.SHIRT, Scene.COLORS, Scene.charPos(i), Scene.iso(u,v), Scene.scale(), Scene.target()
   Lee: G.company (level, staff, gameLog, currentGame), G.points, G.isIdle(), Modules.list[i].sceneInfo(co)
   Ambiente (Scene.env): época por año real (tubo/cable · plano · pantallas/tablet · doble pantalla), temporada (Navidad, rebajas,
   sol, vuelta al cole) y tiempo (orballo/lluvia/sol; eventos 'orballo', 'nordes' y 'tormenta' de co.modules.mundo.fired) */
'use strict';

/* compatibilidad: roundRect no existe en navegadores anteriores a 2023 (Safari < 16, Firefox < 112) */
if (typeof CanvasRenderingContext2D !== 'undefined' && !CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h, r) { let rs = Array.isArray(r) ? r.slice() : [r]; if (rs.length === 1) rs = [rs[0], rs[0], rs[0], rs[0]]; else if (rs.length === 2) rs = [rs[0], rs[1], rs[0], rs[1]]; else if (rs.length === 3) rs = [rs[0], rs[1], rs[2], rs[1]];
    const m = Math.min(Math.abs(w), Math.abs(h)) / 2; const [a, b, c, d] = rs.map(v => Math.max(0, Math.min(+v || 0, m)));
    this.moveTo(x + a, y); this.lineTo(x + w - b, y); this.arcTo(x + w, y, x + w, y + b, b); this.lineTo(x + w, y + h - c); this.arcTo(x + w, y + h, x + w - c, y + h, c); this.lineTo(x + d, y + h); this.arcTo(x, y + h, x, y + h - d, d); this.lineTo(x, y + a); this.arcTo(x, y, x + a, y, a); this.closePath(); };
}
const Scene = {
  canvas: null, ctx: null, W: 960, H: 600, time: 0, hover: null, floaters: [], pops: [], customers: [], lastLevel: 0, lastScale: 0,
  spriteCache: new Map(), bg: null, bgKey: '',
  COLORS: { d: '#f39c12', t: '#3498db', r: '#2ecc71', b: '#e74c3c', br: '#e74c3c', e: '#9b59b6' },
  SKIN: ['#f6cfa8', '#e8b48a', '#c98f62', '#8d5a3c', '#f1d2b6', '#d9a982'],
  HAIR: ['#3b2a20', '#1d1d1d', '#8a5a2b', '#d9b36b', '#5c3b2e', '#a33b2b'],
  SHIRT: ['#2980b9', '#c0392b', '#27ae60', '#8e44ad', '#d35400', '#16a085', '#7f8c8d'],
  DEPT_ICON: { taller: '🛠️', lab: '🧪', gabinete: '👁️', tienda: '🏬', marketing: '📣' },

  /* ================= inicialización ================= */
  init(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.resize(); window.addEventListener('resize', () => this.resize());
    canvas.addEventListener('mousemove', e => { const p = this.toLocal(e); this.hover = this.hitTest(p.x, p.y); canvas.style.cursor = this.hover ? 'pointer' : 'default'; });
    canvas.addEventListener('mouseleave', () => { this.hover = null; });
    canvas.addEventListener('click', e => { const p = this.toLocal(e); const h = this.hitTest(p.x, p.y); if (!matchMedia('(hover: hover)').matches) this.hover = null; /* en táctil no hay mouseleave: sin esto el globo se queda pegado */ if (h && typeof UI !== 'undefined') UI.onSceneClick(h, e); });
  },
  resize() { const r = this.canvas.parentElement.getBoundingClientRect(); const dpr = Math.min(2, window.devicePixelRatio || 1); this.dpr = dpr; this.W = Math.max(300, Math.floor(r.width)); this.H = Math.max(240, Math.floor(r.height)); this.canvas.width = this.W * dpr; this.canvas.height = this.H * dpr; this.canvas.style.width = this.W + 'px'; this.canvas.style.height = this.H + 'px'; this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.bgKey = ''; this.spriteCache.clear(); },
  toLocal(e) { const r = this.canvas.getBoundingClientRect(); return { x: (e.clientX - r.left), y: (e.clientY - r.top) }; },
  co() { return G.company; },
  level() { return this.co() ? this.co().level : 1; },
  layout() { if (this.view !== 'main' && ROOMS[this.view]) return this.roomLayout(this.view); return LAYOUTS[this.level()] || LAYOUTS[1]; },

  /* ================= proyección ================= */
  scale() { const L = this.layout(); const R = L.size; const wall = 2.3; const s = Math.min(this.W * 0.99 / (R + 0.4), this.H * 0.97 / (R * 0.5 + wall * 0.5 + 0.3), 130); return Math.max(26, s); },
  origin() { const L = this.layout(); const R = L.size; const s = this.scale(); const roomH = R * 0.5 * s + 2.3 * 0.5 * s; return { ox: this.W / 2, oy: (this.H - roomH) / 2 + 2.3 * 0.5 * s + 6 }; },
  iso(u, v, z) { const s = this.scale(); const o = this.origin(); return { x: o.ox + (u - v) * s * 0.5, y: o.oy + (u + v) * s * 0.25 - (z || 0) * s * 0.5 }; },
  target() { return { x: this.W - 36, y: 28 }; },
  slots() { return this.layout().desks; },
  charPos(i) { const d = this.slots(); const sl = d[Math.min(i, d.length - 1)]; return this.iso(sl.u + 0.5, sl.v - 0.3); },
  deptZone(id) { return (this.layout().depts || {})[id] || null; },
  info(id) { this._info = this._info || {}; const c = this._info[id]; if (c && this.time - c.t < 250) return c.v; const m = (typeof Modules !== 'undefined') && Modules.get(id); const co = this.co(); let v = {}; if (m && co && m.sceneInfo) { try { v = m.sceneInfo(co) || {}; } catch (e) { v = {}; } } this._info[id] = { t: this.time, v }; return v; },

  /* ================= hit test ================= */
  hitTest(x, y) {
    const co = this.co(); if (!co) return null; const s = this.scale(); const k = s / 90;
    const placed = this.placeStaff(); for (let i = placed.length - 1; i >= 0; i--) { const p = placed[i]; if (Math.abs(x - p.x) < 24 * k && y < p.y + 8 && y > p.y - 84 * k) return { type: 'staff', staff: p.ch }; }
    const L = this.layout(); if (L.room) { const st = this.stationAt(x, y); return st && !st.empty ? { type: 'station', dept: L.room, st } : null; } const c = L.counter; if (c) { const a = this.iso(c.u, c.v), b = this.iso(c.u + c.w, c.v + c.d); const cx = (a.x + b.x) / 2, cy = (a.y + b.y) / 2 - s * 0.3; if (Math.abs(x - cx) < s * 0.9 && Math.abs(y - cy) < s * 0.5) return { type: 'counter' }; }
    for (const id in (L.depts || {})) { if (!this.deptAvailable(id)) continue; const z = L.depts[id]; if (this.inTileRect(x, y, z.u, z.v, z.w, z.d)) return { type: 'dept', dept: id }; }
    return null;
  },
  deptAvailable(id) { return typeof Modules !== 'undefined' && !!Modules.get(id); },
  inTileRect(x, y, u, v, w, d) { const s = this.scale(); const o = this.origin(); const dx = (x - o.ox) / (s * 0.5), dy = (y - o.oy) / (s * 0.25); const uu = (dx + dy) / 2, vv = (dy - dx) / 2; return uu >= u && uu <= u + w && vv >= v && vv <= v + d; },

  /* ================= bucle de dibujo ================= */
  draw(dt) {
    this.time += dt; const ctx = this.ctx; const W = this.W, H = this.H; const co = this.co();
    ctx.clearRect(0, 0, W, H);
    const bgG = ctx.createLinearGradient(0, 0, 0, H); bgG.addColorStop(0, '#dfe8ee'); bgG.addColorStop(1, '#b7c4cc'); ctx.fillStyle = bgG; ctx.fillRect(0, 0, W, H);
    if (!co) return;
    const E = this.env();
    // key: cambia la distribución (clientes y navegación se rehacen) · dkey: solo decoración del fondo (época, temporada, tiempo, pared)
    const key = this.level() + '|' + this.W + 'x' + this.H + '|' + (co.hasResearch && co.hasResearch('Gabinete') ? 1 : 0) + '|' + JSON.stringify([this.info('taller').tier || 0, this.info('lab').tier || 0, this.info('gabinete').tier || 0, (this.info('tienda').displays || 0)]) + (this.hasAudio() ? '|A' : '') + '|' + this.view + (this.view !== 'main' ? ':' + ((this.info(this.view).owned || this.info(this.view).instruments || []).join(',')) : '');
    const dkey = E.key + '|' + this.decorSig();
    if ((key !== this.bgKey || dkey !== this.decorKey) && (!this.bg || this.time - (this.lastBuild || -1e9) > 400)) { const full = key !== this.bgKey; this.buildBackground(); this.bgKey = key; this.decorKey = dkey; this.lastBuild = this.time; this.dynItems = this.furniture(this.layout()); if (full) { this.customers = []; this.buildNav(); } }
    if (G.points.length > 400) G.points.splice(0, G.points.length - 400);
    ctx.drawImage(this.bg, 0, 0, W, H);
    this.drawAmbientBack();
    if (this.view !== 'main' && this.roomsAvailable().indexOf(this.view) < 0) this.setView('main');
    if (!this.inRoom()) this.updateCustomers(dt); this._placed = this.placeStaff();
    this.drawSorted(this.collectDynamic());
    this.drawStaffTags();
    this.drawAmbientFront();
    this.drawLabels();
    if (!this.inRoom()) this.drawPoints(dt); this.drawPops(dt); this.drawFloaters(dt);
  },

  /* ================= ambiente: época, estación y tiempo atmosférico =================
     Sale de la fecha de la partida (año real = año + 1994, U.realYear) y de co.modules.mundo.fired (orballo, nordés, temporal).
     Se calcula una vez por semana; el fondo solo se reconstruye cuando cambia E.key (época, temporada, tiempo). */
  ERA_PC: ['Ordenador de tubo', 'Monitor plano', 'Pantalla panorámica', 'Doble pantalla'],
  SKY: { sun: ['#6fbdf0', '#e2f4fb'], cloud: ['#aebfcb', '#e4ebef'], orballo: ['#8b97a0', '#c4ccd1'], rain: ['#6d7983', '#a7b1b8'] },
  env() {
    if (this._env && this._envT === this.time) return this._env;
    const co = this.co(); const w = Math.max(0, Math.floor(co.currentWeek || 0)); const lvl = this.level(); const mw = co.modules && co.modules.mundo; const fired = (mw && mw.fired) || {};
    const fk = (fired.orballo ? fired.orballo.w : '') + ',' + (fired.nordes ? fired.nordes.w : '') + ',' + (fired.tormenta ? fired.tormenta.w : '');
    const E0 = this._env; this._envT = this.time; if (E0 && E0.w === w && E0.lvl === lvl && E0.fk === fk) return E0;
    const d = U.dateFromWeek(w); const ry = U.realYear(d.year); const m = d.month;
    const era = ry < 2003 ? 0 : ry < 2013 ? 1 : ry < 2020 ? 2 : 3; // tubo y cable · monitor plano · pantallas y tablet · pantallas finas (y mampara 2020-22)
    const since = id => { const f = fired[id]; const k = f ? w - Math.floor(+f.w) : NaN; return k >= 0 ? k : 999; };
    const hs = n => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };
    const h = hs(Math.floor(w / 2)), h2 = hs(Math.floor(w / 2) + 0.37); // rachas de dos semanas, deterministas (no parpadea al recargar)
    const pRain = [0, 0.6, 0.55, 0.45, 0.35, 0.25, 0.12, 0.06, 0.08, 0.2, 0.45, 0.62, 0.6][m], pSun = [0, 0.3, 0.35, 0.45, 0.5, 0.6, 0.8, 0.9, 0.85, 0.6, 0.45, 0.3, 0.3][m];
    let weather = h < pRain ? (h2 < 0.28 ? 'rain' : 'orballo') : (h2 < pSun ? 'sun' : 'cloud');
    if (since('orballo') < 6) weather = 'orballo'; if (since('nordes') < 2) weather = 'sun'; if (since('tormenta') < 1) weather = 'rain';
    const covid = (ry === 2020 && m >= 5) || ry === 2021 || (ry === 2022 && m <= 6);
    const E = { w, lvl, fk, ry, month: m, era, weather, rain: weather === 'rain' || weather === 'orballo', xmas: m === 12, sales: m === 1 || m === 7, summer: m >= 6 && m <= 8, school: m === 9, covid };
    E.tint = E.rain ? 'rgba(70,90,112,0.07)' : weather === 'sun' ? 'rgba(255,214,140,0.06)' : era === 0 ? 'rgba(255,230,170,0.05)' : null;
    E.retro = ry < 1982; /* antes de los PC: máquina de escribir en las mesas */
    E.fkey = [era, E.retro ? 'T' : '', E.xmas ? 'X' : '', E.sales ? 'R' : '', E.summer ? (E.rain ? 'S' : 'Sh') : '', E.school ? 'C' : '', covid ? 'M' : ''].join(''); // muebles (sin el tiempo)
    E.key = weather + E.fkey;
    return (this._env = E);
  },
  owned(id) { const i = this.info(id); return i.owned || i.instruments || i.machines || []; },
  hasAudio() { return !!this.layout().audio && (this.owned('gabinete').indexOf('cabina_audiologia') >= 0 || (this.info('tienda').zoneIds || []).indexOf('audiologia') >= 0); },
  lcdChart() { return this.owned('gabinete').indexOf('pantalla_lcd_optotipos') >= 0 && this.env().ry >= 2006; },
  posterWord() { const co = this.co(); const tr = co.flags && co.flags.trends && co.flags.trends.currentTrend; const gn = tr && tr.type === 'genre' && typeof DB !== 'undefined' && DB.genre(tr.genre); return gn ? String(gn.name).toUpperCase().slice(0, 10) : 'NUEVA'; },
  decorSig() { return (this.lcdChart() ? 'L' : '') + this.posterWord(); },
  /* lluvia en cristales (detrás de todo lo dinámico) y bombillas de Navidad parpadeando */
  drawAmbientBack() {
    const E = this.env(); const ctx = this.ctx; const t = this.time;
    if (E.rain && this._glassBox && this._glassBox.length) {
      const heavy = E.weather === 'rain'; const len = heavy ? 9 : 4, sp = heavy ? 0.3 : 0.1;
      ctx.save(); ctx.beginPath(); for (const g of this._glass) { ctx.moveTo(g[0].x, g[0].y); for (let i = 1; i < g.length; i++) ctx.lineTo(g[i].x, g[i].y); ctx.closePath(); } ctx.clip();
      ctx.strokeStyle = heavy ? 'rgba(228,240,250,0.85)' : 'rgba(238,244,250,0.7)'; ctx.lineWidth = 1; ctx.beginPath();
      for (const b of this._glassBox) { const n = Math.ceil(b.w * b.h / (heavy ? 130 : 95)); for (let i = 0; i < n; i++) { const x = b.x + ((i * 61.7 + 13) % b.w); const y = b.y - 10 + ((t * sp * (0.8 + (i % 4) * 0.12) + i * 47.3) % (b.h + 20)); ctx.moveTo(x, y); ctx.lineTo(x - len * 0.25, y + len); } }
      ctx.stroke(); ctx.restore();
    }
    if (E.xmas && this._bulbs && this._bulbs.length) { for (let i = 0; i < this._bulbs.length; i++) { const b = this._bulbs[i]; ctx.globalAlpha = 0.35 + 0.65 * Math.max(0, Math.sin(t / 420 + i * 1.7)); ctx.fillStyle = b.c; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, 7); ctx.fill(); } ctx.globalAlpha = 1; }
  },
  /* lluvia al aire libre (puesto del mercado) y tinte de luz según tiempo/época, por encima de la escena */
  drawAmbientFront() {
    const E = this.env(); const ctx = this.ctx; const W = this.W, H = this.H;
    if (this.level() === 1 && E.rain) { const heavy = E.weather === 'rain'; const n = heavy ? 140 : 90, len = heavy ? 12 : 5, sp = heavy ? 0.45 : 0.15; ctx.save(); ctx.strokeStyle = heavy ? 'rgba(205,218,232,0.55)' : 'rgba(220,228,236,0.45)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < n; i++) { const x = (i * 97.13) % W; const y = ((this.time * sp * (0.85 + (i % 5) * 0.08) + i * 71.9) % (H + 30)) - 15; ctx.moveTo(x, y); ctx.lineTo(x - len * 0.3, y + len); } ctx.stroke(); ctx.restore(); }
    if (E.tint) { ctx.fillStyle = E.tint; ctx.fillRect(0, 0, W, H); }
  },
  /* equipo más destacado a la vista por departamento (tooltip); el orden coincide con lo que se dibuja */
  SHOW: {
    gabinete: [['oct', 'OCT'], ['campimetro', 'Campímetro'], ['retinografo_no_midriatico', 'Retinógrafo'], ['aberrometro_multidiagnostico', 'Estación de pre-examen'], ['foropter_digital', 'Foróptero digital'], ['topografo_corneal', 'Topógrafo corneal'], ['autorrefractometro_queratometro', 'Autorrefractómetro'], ['tonometro_aire', 'Tonómetro de aire'], ['lampara_hendidura_digital', 'Lámpara de hendidura con vídeo'], ['foropter_manual', 'Foróptero'], ['unidad_refraccion', 'Unidad de refracción'], ['lampara_hendidura', 'Lámpara de hendidura'], ['pantalla_lcd_optotipos', 'Pantalla de optotipos'], ['caja_pruebas_gafa_prueba', 'Caja de pruebas']],
    lab: [['linea_modular_freeform', 'Línea freeform automatizada'], ['coater_industrial', 'Cámara de alto vacío'], ['camara_ar_pequena', 'Cámara de antirreflejante'], ['generador_freeform', 'Generador freeform'], ['biseladora_auto_3d', 'Biseladora 3D'], ['trazador_bloqueador', 'Trazador-bloqueador'], ['tintadora', 'Tintadora'], ['frontofocometro_digital', 'Frontofocómetro digital'], ['biseladora_manual_usada', 'Biseladora 2D'], ['frontofocometro_manual', 'Frontofocómetro']],
    taller: [['cnc_multihusillo', 'Centro CNC multihusillo'], ['inyectora_150t', 'Inyectora'], ['sls_fuse', 'Impresora 3D SLS'], ['bombos_industriales', 'Sala de bombos'], ['cnc_optica_3ejes', 'Centro CNC de 3 ejes'], ['babyplast', 'Micro-inyectora'], ['bombos_serie', 'Tren de bombos'], ['fresadora_rigida', 'Fresadora CNC rígida'], ['cnc3018', 'Fresadora CNC 3018'], ['bombo_hobby', 'Bombo de pulido'], ['fdm_prototipos', 'Impresora 3D'], ['kit_manual', 'Banco de artesano']]
  },
  featured(id) {
    const E = this.env(); const list = this.SHOW[id];
    if (list) { const own = this.owned(id); const hit = list.find(x => own.indexOf(x[0]) >= 0); return hit ? hit[1] : null; }
    if (id === 'marketing') return this.ERA_PC[E.era];
    if (id === 'tienda') { const zs = this.info('tienda').zoneIds || []; const lvl = this.level();
      if (this.hasAudio()) return 'Cabina de audiología'; if (E.summer) return 'Expositor de sol (temporada)'; if (E.era >= 2 && lvl >= 2) return 'Pantalla de escaparate';
      for (const [z, n] of [['lujo', 'Vitrina de firmas'], ['sol', 'Expositor de sol'], ['lentes_contacto_reposicion', 'Vitrina de lentillas'], ['lectura', 'Giratorio de lectura'], ['accesorios', 'Mostrador de accesorios']]) if (zs.indexOf(z) >= 0) return n;
      return lvl === 1 ? (E.era < 2 ? 'Caja de caudales' : 'Lector de tarjetas') : ['Caja registradora', 'TPV', 'Tablet de venta', 'Tablet de venta'][E.era]; }
    return null;
  },

  /* ================= fondo estático (suelo, paredes, mobiliario fijo) ================= */
  buildBackground() {
    const W = this.W, H = this.H; const reuse = this.bg && this.bg.width === Math.floor(W * this.dpr) && this.bg.height === Math.floor(H * this.dpr); // con el tiempo/temporada se rehace a menudo: se reutiliza el lienzo
    const c = reuse ? this.bg : document.createElement('canvas'); if (!reuse) { c.width = W * this.dpr; c.height = H * this.dpr; } const ctx = c.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    const L = this.layout(); const R = L.size; const s = this.scale(); const lvl = this.level();
    const saved = this.ctx; this.ctx = ctx; this._glass = []; this._glassBox = []; this._bulbs = [];
    // sombra general de la sala
    const a = this.iso(0, 0), b = this.iso(R, 0), cc = this.iso(R, R), d = this.iso(0, R);
    /* sombra difuminada sin ctx.filter (Safari ≤17 no lo soporta): se dibuja la forma fuera de la vista y solo se ve su sombra */ { const off = 10000, k = ctx.getTransform ? ctx.getTransform().a : (this.dpr || 1); ctx.save(); ctx.shadowColor = 'rgba(0,0,0,0.28)'; ctx.shadowBlur = 10 * k; ctx.shadowOffsetX = off * k; this.poly([{ x: a.x - off, y: a.y + 14 }, { x: b.x + 10 - off, y: b.y + 14 }, { x: cc.x - off, y: cc.y + 22 }, { x: d.x - 10 - off, y: d.y + 14 }], '#000'); ctx.restore(); }
    this.drawFloor(L); this.drawWalls(L); if (lvl === 1) this.drawStallWeather(L); else { this.drawWindowLight(L); this.drawZoneFloors(L); }
    for (const g of this._glass) { const xs = g.map(p => p.x), ys = g.map(p => p.y); const x0 = Math.min(...xs), y0 = Math.min(...ys); this._glassBox.push({ x: x0, y: y0, w: Math.max(1, Math.max(...xs) - x0), h: Math.max(1, Math.max(...ys) - y0) }); }
    // mobiliario fijo (sin partes móviles) en orden de profundidad
    const furn = this.furniture(L).filter(f => !f.dynamic).sort((p, q) => p.depth - q.depth); for (const f of furn) f.draw();
    // viñeta suave
    const vg = ctx.createRadialGradient(W / 2, H / 2, Math.min(W, H) * 0.35, W / 2, H / 2, Math.max(W, H) * 0.75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,0.18)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);
    this.ctx = saved; this.bg = c;
  },
  shade(hex, p) { const n = parseInt(hex.slice(1), 16); let r = n >> 16, g = (n >> 8) & 255, b = n & 255; const f = c => Math.max(0, Math.min(255, Math.round(p < 0 ? c * (1 + p) : c + (255 - c) * p))); return '#' + ((1 << 24) + (f(r) << 16) + (f(g) << 8) + f(b)).toString(16).slice(1); },
  poly(pts, fill, stroke, lw) { const ctx = this.ctx; ctx.beginPath(); pts.forEach((p, i) => i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)); ctx.closePath(); if (fill) { ctx.fillStyle = fill; ctx.fill(); } if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lw || 1; ctx.lineJoin = 'round'; ctx.stroke(); } },
  /* cubo isométrico en coordenadas de baldosa (u,v,z) con tamaño (w,d,h) */
  box(u, v, z, w, d, h, col, o) {
    o = o || {}; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz); const top = o.top || this.shade(col, 0.22), left = o.left || col, right = o.right || this.shade(col, -0.22); const line = o.line || 'rgba(30,20,10,0.45)';
    if (h > 0) { this.poly([P(0, d, 0), P(w, d, 0), P(w, d, h), P(0, d, h)], left, line); this.poly([P(w, 0, 0), P(w, d, 0), P(w, d, h), P(w, 0, h)], right, line); }
    this.poly([P(0, 0, h), P(w, 0, h), P(w, d, h), P(0, d, h)], top, line);
  },
  shadow(u, v, w, d, k) { const c = this.iso(u + w / 2, v + d / 2); const s = this.scale(); const ctx = this.ctx; ctx.save(); ctx.globalAlpha = 0.22 * (k || 1); ctx.fillStyle = '#000'; ctx.beginPath(); ctx.ellipse(c.x + s * 0.08, c.y + s * 0.05, (w + d) * s * 0.26, (w + d) * s * 0.13, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore(); },

  drawFloor(L) {
    const R = L.size; const ctx = this.ctx; const s = this.scale(); const lvl = this.level();
    const pal = L.pal ? L.pal.floor : { 1: ['#b9b3a8', '#aaa397'], 2: ['#d8b48a', '#cfa87c'], 3: ['#d9d6d0', '#cdc9c2'], 4: ['#ece9e4', '#e0dcd6'] }[lvl];
    for (let u = 0; u < R; u++) for (let v = 0; v < R; v++) { const p = [this.iso(u, v), this.iso(u + 1, v), this.iso(u + 1, v + 1), this.iso(u, v + 1)]; this.poly(p, (lvl === 2 && !L.pal ? ((u % 2) ? pal[0] : pal[1]) : ((u + v) % 2 ? pal[0] : pal[1])), 'rgba(0,0,0,0.07)'); }
    if (lvl === 2 && !L.pal) { ctx.strokeStyle = 'rgba(90,50,20,0.18)'; ctx.lineWidth = 1; for (let u = 0; u <= R; u += 0.5) { const p1 = this.iso(u, 0), p2 = this.iso(u, R); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.stroke(); } }
    if (lvl === 1) { // adoquines de plaza alrededor del puesto
      ctx.save(); ctx.globalAlpha = 0.5; for (let i = 0; i < 70; i++) { const u = (i * 7.3) % R, v = (i * 3.7) % R; const p = this.iso(u, v); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.06, s * 0.03, 0, 0, 7); ctx.fill(); } ctx.restore();
    }
    // alfombra de bienvenida / zona de espera
    if (L.rug) { const r = L.rug; const k = (du, dv) => this.iso(r.u + du, r.v + dv); this.poly([k(0, 0), k(r.w, 0), k(r.w, r.d), k(0, r.d)], r.color || '#5aa9a3', 'rgba(0,0,0,0.25)'); this.poly([k(0.25, 0.25), k(r.w - 0.25, 0.25), k(r.w - 0.25, r.d - 0.25), k(0.25, r.d - 0.25)], this.shade(r.color || '#5aa9a3', 0.18)); }
  },
  /* suelo de cada departamento: hormigón con franja de seguridad (taller), resina blanca (laboratorio), vinilo clínico (gabinete), moqueta (marketing) */
  ZONE_FLOOR: { taller: ['#b3aea6', '#a39e95', 'hazard'], lab: ['#eef4f7', '#e2ebf0', '#9fc3d4'], gabinete: ['#d9e7f0', '#cddde8', '#8fb3c9'], marketing: ['#d9d0e4', '#d2c8de', '#a99bbd'] },
  drawZoneFloors(L) { const ctx = this.ctx; const s = this.scale();
    for (const id in (L.depts || {})) { const F = this.ZONE_FLOOR[id]; if (!F || !this.deptAvailable(id)) continue; const z = L.depts[id]; const m = 0.12; const u0 = z.u - m, v0 = z.v - m, u1 = z.u + z.w + m, v1 = z.v + z.d + m; const Q = (u, v) => this.iso(u, v);
      this.poly([Q(u0, v0), Q(u1, v0), Q(u1, v1), Q(u0, v1)], F[0]);
      ctx.save(); ctx.strokeStyle = F[1]; ctx.lineWidth = 1; ctx.beginPath(); const st = id === 'taller' ? 0.5 : 0.35; for (let u = u0 + st; u < u1 - 0.01; u += st) { const a = Q(u, v0), b = Q(u, v1); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } for (let v = v0 + st; v < v1 - 0.01; v += st) { const a = Q(u0, v), b = Q(u1, v); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke(); ctx.restore();
      if (F[2] === 'hazard') { const a = Q(u0, v1), b = Q(u1, v1), c = Q(u1, v0); ctx.save(); ctx.lineCap = 'butt'; ctx.lineWidth = Math.max(3, s * 0.06); ctx.strokeStyle = '#2d3436'; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.setLineDash([s * 0.1, s * 0.1]); ctx.strokeStyle = '#f1c40f'; ctx.stroke(); ctx.restore(); }
      else { const a = Q(u0, v1), b = Q(u1, v1), c = Q(u1, v0); ctx.save(); ctx.strokeStyle = F[2]; ctx.lineWidth = Math.max(2, s * 0.03); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.stroke(); ctx.restore(); } } },
  drawWindowLight(L) { const E = this.env(); const a = E.weather === 'sun' ? 0.2 : E.rain ? 0.07 : 0.12; const R = L.size;
    for (const w of (L.windows || [])) { const side = w.side || 'right'; const q = (t, dd) => side === 'right' ? this.iso(Math.min(R, t), dd) : this.iso(dd, Math.min(R, t)); const p0 = q(w.u + 0.5, 0.15), p1 = q(w.u + 1.2, 2.1); const g = this.ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y); g.addColorStop(0, `rgba(255,248,215,${a})`); g.addColorStop(1, 'rgba(255,248,215,0)');
      this.poly([q(w.u + 0.1, 0.12), q(w.u + w.w - 0.1, 0.12), q(w.u + w.w + 0.6, 2.2), q(w.u + 0.7, 2.2)], g); } },
  drawWalls(L) {
    const R = L.size; const s = this.scale(); const lvl = this.level(); const wallH = 2.3; const ctx = this.ctx;
    const a = this.iso(0, 0), b = this.iso(R, 0), d = this.iso(0, R);
    const colR = L.pal ? L.pal.wallR : { 1: '#8fa86a', 2: '#efe6d2', 3: '#e7ecf0', 4: '#f3f1ec' }[lvl], colL = L.pal ? L.pal.wallL : { 1: '#7c9458', 2: '#e2d6bd', 3: '#d5dce3', 4: '#e6e2db' }[lvl];
    if (lvl === 1 && !L.room) { // puesto: panel trasero de madera + toldo
      const woodA = '#8a5a2b'; this.poly([{ x: a.x, y: a.y - s * 1.1 }, { x: b.x, y: b.y - s * 1.1 }, b, a], woodA, 'rgba(0,0,0,0.4)'); this.poly([{ x: a.x, y: a.y - s * 1.1 }, { x: d.x, y: d.y - s * 1.1 }, d, a], this.shade(woodA, -0.18), 'rgba(0,0,0,0.4)');
      for (let i = 1; i < 6; i++) { const p1 = this.iso(i * R / 6, 0), p2 = this.iso(i * R / 6, 0); ctx.strokeStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.moveTo(p1.x, p1.y - s * 1.1); ctx.lineTo(p2.x, p2.y); ctx.stroke(); }
      // toldo rayado sobre la pared trasera y lateral
      const awn = (p1, p2, n) => { for (let i = 0; i < n; i++) { const x1 = p1.x + (p2.x - p1.x) * i / n, x2 = p1.x + (p2.x - p1.x) * (i + 1) / n, y1 = p1.y + (p2.y - p1.y) * i / n, y2 = p1.y + (p2.y - p1.y) * (i + 1) / n; this.poly([{ x: x1, y: y1 - s * 1.75 }, { x: x2, y: y2 - s * 1.75 }, { x: x2 + s * 0.12, y: y2 - s * 1.3 }, { x: x1 + s * 0.12, y: y1 - s * 1.3 }], i % 2 ? '#e74c3c' : '#fbfbf7', 'rgba(0,0,0,0.25)'); const sc = s * 0.09; ctx.fillStyle = i % 2 ? '#e74c3c' : '#fbfbf7'; ctx.beginPath(); ctx.arc((x1 + x2) / 2 + s * 0.12, (y1 + y2) / 2 - s * 1.3 + sc * 0.4, sc, 0, Math.PI); ctx.fill(); } };
      awn(a, b, 8); awn(d, a, 8);
      // postes
      for (const p of [a, b, d]) { ctx.fillStyle = '#6b4423'; ctx.fillRect(p.x - 3, p.y - s * 1.75, 6, s * 1.75); }
      const sp1 = this.iso(R * 0.5, 0); ctx.save(); ctx.fillStyle = '#fff8e7'; ctx.strokeStyle = '#6b4423'; ctx.lineWidth = 2; const tw1 = Math.min(s * 2.4, 170); ctx.beginPath(); ctx.roundRect(sp1.x - tw1 / 2, sp1.y - s * 0.95, tw1, 24, 4); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#6b4423'; ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText((this.co().name || 'Óptica').slice(0, 22), sp1.x, sp1.y - s * 0.95 + 17); ctx.restore();
      this.drawStallSeason(L);
      return;
    }
    // paredes con zócalo
    this.poly([{ x: a.x, y: a.y - s * wallH * 0.5 }, { x: b.x, y: b.y - s * wallH * 0.5 }, b, a], colR, 'rgba(0,0,0,0.35)');
    this.poly([{ x: a.x, y: a.y - s * wallH * 0.5 }, { x: d.x, y: d.y - s * wallH * 0.5 }, d, a], colL, 'rgba(0,0,0,0.35)');
    // volumen: más luz arriba y sombra hacia la esquina del fondo
    { const top = Math.min(a.y, b.y, d.y) - s * wallH * 0.5; const vg = ctx.createLinearGradient(0, top, 0, Math.max(b.y, d.y)); vg.addColorStop(0, 'rgba(255,255,255,0.16)'); vg.addColorStop(1, 'rgba(0,0,0,0.05)');
      for (const e of [b, d]) { this.poly([{ x: a.x, y: a.y - s * wallH * 0.5 }, { x: e.x, y: e.y - s * wallH * 0.5 }, e, a], vg); const cg = ctx.createLinearGradient(a.x, 0, a.x + (e.x - a.x) * 0.35, 0); cg.addColorStop(0, 'rgba(40,30,20,0.12)'); cg.addColorStop(1, 'rgba(40,30,20,0)'); this.poly([{ x: a.x, y: a.y - s * wallH * 0.5 }, { x: e.x, y: e.y - s * wallH * 0.5 }, e, a], cg); } }
    // sombra de contacto en el suelo, junto a las paredes
    for (const side of ['right', 'left']) { const q = (t, dd) => side === 'right' ? this.iso(t, dd) : this.iso(dd, t); const p0 = q(R / 2, 0), p1 = q(R / 2, 0.45); const fg = ctx.createLinearGradient(p0.x, p0.y, p1.x, p1.y); fg.addColorStop(0, 'rgba(30,20,10,0.16)'); fg.addColorStop(1, 'rgba(30,20,10,0)'); this.poly([q(0, 0), q(R, 0), q(R, 0.45), q(0, 0.45)], fg); }
    // canto superior de las paredes (grosor)
    { const th = 0.16, zt = wallH; const Q = (u, v) => this.iso(u, v, zt); this.poly([Q(-th, -th), Q(R, -th), Q(R, 0), Q(0, 0)], this.shade(colR, 0.35), 'rgba(0,0,0,0.3)'); this.poly([Q(-th, -th), Q(0, 0), Q(0, R), Q(-th, R)], this.shade(colL, 0.3), 'rgba(0,0,0,0.3)');
      this.poly([Q(R, -th), { x: this.iso(R, -th).x, y: this.iso(R, -th).y }, this.iso(R, 0), Q(R, 0)], this.shade(colR, -0.25), 'rgba(0,0,0,0.3)'); this.poly([Q(-th, R), { x: this.iso(-th, R).x, y: this.iso(-th, R).y }, this.iso(0, R), Q(0, R)], this.shade(colL, -0.25), 'rgba(0,0,0,0.3)'); }
    // zócalo
    const z = s * 0.12; this.poly([{ x: a.x, y: a.y - z }, { x: b.x, y: b.y - z }, b, a], '#9c7b56'); this.poly([{ x: a.x, y: a.y - z }, { x: d.x, y: d.y - z }, d, a], '#866847');
    // iluminación según la época (tubos fluorescentes · focos halógenos · línea LED)
    this.drawEraLights(L);
    // ventanas (pared derecha) y puerta (pared izquierda = fachada: los de ese lado son escaparates)
    const nLeft = (L.windows || []).filter(w => (w.side || 'right') === 'left').length; let li = 0;
    for (const w of (L.windows || [])) { const sd = w.side || 'right'; this.drawWindow(w.u, w.w, sd, sd === 'left' ? li++ : -1, nLeft); }
    if (L.door) this.drawDoor(L.door);
    if (this.env().rain) this.drawUmbrellas(L);
    // cuadros / pósters / expositores de pared
    for (const it of (L.wallItems || [])) { if (it.type === 'display') this.drawWallDisplay(it.u, it.w, it.side || 'right'); else if (it.type === 'poster') this.drawPoster(it.u, it.side || 'right', it.color); else if (it.type === 'board') this.drawBoard(it.u, it.side || 'right'); else if (it.type === 'optotipo') this.drawOptotipo(it.u, it.side || 'right'); else if (it.type === 'screen') this.drawWallScreen(it.u, it.w, it.side || 'right'); else if (it.type === 'mirror') this.drawMirror(it.u, it.side || 'right'); }
    if (this.env().xmas) this.drawGarland(L);
    // rótulo con el nombre (luminoso con la fachada nueva)
    const sp = this.iso(L.sign ? L.sign.u : R * 0.55, 0); ctx.save(); ctx.fillStyle = '#2f2a28'; ctx.strokeStyle = '#ffd166'; ctx.lineWidth = 2; if ((this.info('tienda').displays || 0) >= 4) { ctx.shadowColor = 'rgba(255,209,102,0.9)'; ctx.shadowBlur = 14; } const tw = Math.min(s * 2.6, 190); ctx.beginPath(); ctx.roundRect(sp.x - tw / 2, sp.y - s * wallH * 0.5 + 10, tw, 26, 5); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#ffd166'; ctx.font = 'bold 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.fillText((L.title || this.co().name || 'Óptica').slice(0, 24), sp.x, sp.y - s * wallH * 0.5 + 28); ctx.restore();
  },
  wallPt(u, side, z) { return side === 'right' ? this.iso(u, 0, z) : this.iso(0, u, z); },
  wq(u, w, z0, z1, side) { return [this.wallPt(u, side, z0), this.wallPt(u + w, side, z0), this.wallPt(u + w, side, z1), this.wallPt(u, side, z1)]; },
  /* texto pegado a la pared (inclinado como ella) */
  wallText(u, z, side, txt, px, col, bold) { const p = this.wallPt(u, side, z); const ctx = this.ctx; ctx.save(); ctx.translate(p.x, p.y); ctx.transform(1, side === 'right' ? 0.5 : -0.5, 0, 1, 0, 0); ctx.font = `${bold ? 'bold ' : ''}${Math.max(6, Math.round(px))}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillStyle = col; ctx.fillText(txt, 0, 0); ctx.restore(); },
  /* iluminación de techo según la época: tubos fluorescentes (90), carril de halógenos (2000s o LED de exposición) y línea LED (desde 2013) */
  drawEraLights(L) {
    const R = L.size; const E = this.env(); const ctx = this.ctx; const s = this.scale(); const style = E.era >= 2 ? 'led' : (E.era === 1 || (this.info('tienda').displays || 0) >= 3) ? 'halo' : 'tube';
    const signU = L.sign ? L.sign.u : R * 0.55; const signHalf = Math.min(s * 2.6, 190) / s + 0.3;
    ctx.save();
    for (const side of ['right', 'left']) {
      if (style === 'led') { const a = this.wallPt(0.05, side, 2.22), b = this.wallPt(R - 0.05, side, 2.22); ctx.shadowColor = 'rgba(255,255,255,0.95)'; ctx.shadowBlur = 14; ctx.strokeStyle = 'rgba(255,255,255,0.95)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.shadowBlur = 0;
        for (let u = 1.2; u < R - 0.6; u += 2.0) { if (side === 'right' && Math.abs(u - signU) < signHalf) continue; const c = this.wallPt(u, side, 1.7); const rg = ctx.createRadialGradient(c.x, c.y - s * 0.3, 0, c.x, c.y, s * 0.6); rg.addColorStop(0, 'rgba(235,248,255,0.4)'); rg.addColorStop(1, 'rgba(235,248,255,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.3, s * 0.6, 0, 0, 7); ctx.fill(); const sp = this.wallPt(u, side, 2.17); ctx.fillStyle = '#ffffff'; ctx.strokeStyle = 'rgba(120,140,150,0.6)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, s * 0.06, s * 0.025, 0, 0, 7); ctx.fill(); ctx.stroke(); } }
      else if (style === 'halo') { const a = this.wallPt(0.2, side, 2.2), b = this.wallPt(R - 0.2, side, 2.2); ctx.strokeStyle = '#4b4f55'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
        for (let u = 0.9; u < R - 0.4; u += 1.5) { if (side === 'right' && Math.abs(u - signU) < signHalf) continue; const c = this.wallPt(u, side, 1.55); const rg = ctx.createRadialGradient(c.x, c.y - s * 0.2, 0, c.x, c.y, s * 0.55); rg.addColorStop(0, 'rgba(255,226,160,0.32)'); rg.addColorStop(1, 'rgba(255,226,160,0)'); ctx.fillStyle = rg; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.36, s * 0.6, 0, 0, 7); ctx.fill(); const sp = this.wallPt(u, side, 2.13); ctx.fillStyle = '#2f3237'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, s * 0.045, s * 0.06, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.arc(sp.x, sp.y + s * 0.045, s * 0.022, 0, 7); ctx.fill(); } }
      else { for (let u = 1.0; u < R - 1.3; u += 2.4) { if (side === 'right' && Math.abs(u + 0.55 - signU) < signHalf + 0.5) continue; ctx.shadowColor = 'rgba(225,255,235,0.9)'; ctx.shadowBlur = 10; this.poly(this.wq(u, 1.1, 2.05, 2.13, side), '#f4fff7', 'rgba(120,130,125,0.8)'); ctx.shadowBlur = 0; } }
    }
    ctx.restore();
  },
  drawWindow(u, w, side, idx, nLeft) { const s = this.scale(); const ctx = this.ctx; const E = this.env(); const L = this.layout(); const wp = (du, z) => this.wallPt(u + du, side, z); const p1 = wp(0, 0.7), p2 = wp(w, 0.7), p3 = wp(w, 1.9), p4 = wp(0, 1.9);
    const sky = this.SKY[E.weather] || this.SKY.cloud; this.poly([p1, p2, p3, p4], sky[1], '#5c6b73', 2); const g = ctx.createLinearGradient(0, p4.y, 0, p1.y); g.addColorStop(0, sky[0]); g.addColorStop(1, sky[1]); this.poly([p1, p2, p3, p4], g);
    if (E.weather === 'sun' || E.rain) { ctx.save(); ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(p3.x, p3.y); ctx.lineTo(p4.x, p4.y); ctx.closePath(); ctx.clip();
      if (E.weather === 'sun') { const c = wp(w * 0.78, 1.75); const rg = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, s * 0.45); rg.addColorStop(0, 'rgba(255,252,220,1)'); rg.addColorStop(0.18, 'rgba(255,240,170,0.7)'); rg.addColorStop(1, 'rgba(255,240,170,0)'); ctx.fillStyle = rg; ctx.fillRect(c.x - s * 0.5, c.y - s * 0.5, s, s); }
      else { ctx.fillStyle = 'rgba(255,255,255,0.55)'; for (let i = 0; i < Math.round(w * 9); i++) { const q = wp(((i * 0.377) % 1) * w, 0.75 + ((i * 0.611) % 1) * 1.1); ctx.beginPath(); ctx.ellipse(q.x, q.y, 1.2, 1.7, 0, 0, 7); ctx.fill(); } }
      ctx.restore(); }
    const shop = side === 'left' && L.door && (L.door.side || 'left') === 'left' && idx >= 0; if (shop && idx === 0) this.drawShopWindow(u, w, side);
    ctx.save(); ctx.globalAlpha = 0.16; this.poly([wp(w * 0.14, 1.9), wp(w * 0.3, 1.9), wp(w * 0.16, 0.7), wp(0, 0.7)], '#ffffff'); ctx.restore();
    ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 2; const m1 = wp(w / 2, 0.7), m2 = wp(w / 2, 1.9); ctx.beginPath(); ctx.moveTo(m1.x, m1.y); ctx.lineTo(m2.x, m2.y); ctx.stroke(); const h1 = wp(0, 1.3), h2 = wp(w, 1.3); ctx.beginPath(); ctx.moveTo(h1.x, h1.y); ctx.lineTo(h2.x, h2.y); ctx.stroke(); ctx.restore();
    if (shop && idx === 0 && E.era === 0) { this.wallText(u + w / 2, 1.64, side, 'GRADUAMOS', s * 0.075, 'rgba(255,255,255,0.95)', true); this.wallText(u + w / 2, 1.5, side, 'SU VISTA', s * 0.075, 'rgba(255,255,255,0.95)', true); }
    if (shop && idx === (nLeft > 1 ? 1 : 0)) this.drawWindowSticker(u, w, side);
    this._glass.push([p1, p2, p3, p4]);
    // luz en el suelo (más intensa con sol, casi nada con lluvia)
    const fa = E.weather === 'sun' ? 0.2 : E.rain ? 0.04 : 0.1;
    const f1 = this.iso(side === 'right' ? u : 0.2, side === 'right' ? 0.2 : u), f2 = this.iso(side === 'right' ? u + w : 1.4, side === 'right' ? 1.4 : u + w); ctx.save(); ctx.globalAlpha = fa; ctx.fillStyle = '#fff6c8'; ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y); ctx.lineTo(f2.x + s * 0.3, f2.y + s * 0.5); ctx.lineTo(f1.x - s * 0.3, f1.y + s * 0.5); ctx.closePath(); ctx.fill(); ctx.restore(); },
  /* lo que hay detrás del cristal del escaparate según la época: caja de luz (2000s) o pantalla digital (desde 2013) */
  drawShopWindow(u, w, side) { const E = this.env(); if (E.era === 0) return; const s = this.scale(); const ctx = this.ctx; const wp = (du, z) => this.wallPt(u + du, side, z); const tilt = side === 'left' ? -0.5 : 0.5;
    const a = E.era >= 3 ? 0.14 : 0.24, b = 1 - a, z0 = E.era >= 3 ? 0.8 : 0.86, z1 = E.era >= 3 ? 1.84 : 1.74; const q = (fu, z) => wp(w * (a + (b - a) * fu), z);
    if (E.era === 1) { this.poly([q(0, z0), q(1, z0), q(1, z1), q(0, z1)], '#f2efe8', '#7f8c8d', 2); const g = ctx.createLinearGradient(0, q(0, z1).y, 0, q(0, z0).y); g.addColorStop(0, '#f6d365'); g.addColorStop(1, '#fda085'); this.poly([q(0.08, z0 + 0.05), q(0.92, z0 + 0.05), q(0.92, z1 - 0.05), q(0.08, z1 - 0.05)], g); }
    else { this.poly([q(0, z0), q(1, z0), q(1, z1), q(0, z1)], '#15181d', '#000', 2); const g = ctx.createLinearGradient(0, q(0, z1).y, 0, q(0, z0).y); g.addColorStop(0, E.era >= 3 ? '#00c6ff' : '#4facfe'); g.addColorStop(1, E.era >= 3 ? '#7f00ff' : '#8e44ad'); this.poly([q(0.06, z0 + 0.04), q(0.94, z0 + 0.04), q(0.94, z1 - 0.04), q(0.06, z1 - 0.04)], g); }
    const c = q(0.5, (z0 + z1) / 2 + 0.12); this.glasses(c.x, c.y, s * 0.075, E.era === 1 ? '#5d4037' : '#fff', tilt); this.wallText(u + w * 0.5, (z0 + z1) / 2 - 0.16, side, E.era === 1 ? 'COLECCIÓN' : 'NOVEDADES', s * 0.065, E.era === 1 ? '#5d4037' : '#fff', true); },
  /* vinilos de temporada en el escaparate: rebajas, Navidad y sol */
  drawWindowSticker(u, w, side) { const E = this.env(); const s = this.scale(); const ctx = this.ctx; const wp = (du, z) => this.wallPt(u + du, side, z);
    if (E.sales) { this.poly([wp(w * 0.06, 0.98), wp(w * 0.94, 0.98), wp(w * 0.94, 1.24), wp(w * 0.06, 1.24)], '#e74c3c', '#ffffff', 1.5); this.wallText(u + w / 2, 1.05, side, 'REBAJAS', s * 0.105, '#ffffff', true); }
    else if (E.xmas) { ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 1.3; for (const [fu, z, r] of [[0.25, 1.62, 0.07], [0.72, 1.48, 0.055], [0.5, 1.78, 0.045], [0.82, 1.75, 0.04]]) { const c = wp(w * fu, z); const rr = s * r; ctx.beginPath(); for (let k = 0; k < 3; k++) { const an = k * Math.PI / 3; ctx.moveTo(c.x - Math.cos(an) * rr, c.y - Math.sin(an) * rr); ctx.lineTo(c.x + Math.cos(an) * rr, c.y + Math.sin(an) * rr); } ctx.stroke(); } ctx.globalAlpha = 0.75; this.poly([wp(0, 0.7), wp(w * 0.35, 0.7), wp(0, 0.86)], '#ffffff'); this.poly([wp(w, 0.7), wp(w * 0.62, 0.7), wp(w, 0.84)], '#ffffff'); ctx.restore(); }
    else if (E.summer) { const c = wp(w * 0.74, 1.58); const r = s * 0.075; ctx.save(); ctx.strokeStyle = '#f39c12'; ctx.lineWidth = 2; ctx.beginPath(); for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4; ctx.moveTo(c.x + Math.cos(an) * r * 1.3, c.y + Math.sin(an) * r * 1.3); ctx.lineTo(c.x + Math.cos(an) * r * 1.8, c.y + Math.sin(an) * r * 1.8); } ctx.stroke(); ctx.fillStyle = '#f9ca24'; ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, 7); ctx.fill(); ctx.restore(); this.wallText(u + w * 0.74, 1.36, side, 'SOL', s * 0.08, '#d35400', true); } },
  /* espumillón con bombillas por lo alto de las paredes (diciembre); las bombillas parpadean en drawAmbientBack */
  drawGarland(L) { const R = L.size; const ctx = this.ctx; const s = this.scale(); const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff']; let k = 0; ctx.save(); ctx.lineCap = 'round';
    for (const side of ['right', 'left']) { const step = 0.8; for (let u = 0.15; u + step <= R - 0.1; u += step) { const a = this.wallPt(u, side, 2.2), b = this.wallPt(u + step, side, 2.2), m = this.wallPt(u + step / 2, side, 2.02); const cx = 2 * m.x - (a.x + b.x) / 2, cy = 2 * m.y - (a.y + b.y) / 2;
      ctx.strokeStyle = '#1e8449'; ctx.lineWidth = Math.max(3, s * 0.05); ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(cx, cy, b.x, b.y); ctx.stroke(); ctx.strokeStyle = '#f1c40f'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]); this._bulbs.push({ x: m.x, y: m.y + 3, r: Math.max(2, s * 0.03), c: cols[k++ % 4] }); } }
    ctx.restore(); },
  /* día de lluvia: paragüero con paraguas mojados, charco y huellas en la entrada */
  drawUmbrellas(L) { const dr = L.door; if (!dr || (dr.side || 'left') !== 'left') return; const s = this.scale(); const ctx = this.ctx; const u0 = 0.1, v0 = dr.u - 0.48; const dw = dr.w || 1.2;
    const pc = this.iso(0.8, dr.u + dw / 2); ctx.save(); ctx.globalAlpha = 0.4; const g = ctx.createLinearGradient(pc.x - s * 0.45, 0, pc.x + s * 0.45, 0); g.addColorStop(0, '#8fa8b8'); g.addColorStop(1, '#dce8ee'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(pc.x, pc.y, s * 0.46, s * 0.15, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 0.7; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(pc.x - s * 0.12, pc.y - s * 0.03, s * 0.14, s * 0.035, 0, Math.PI * 1.1, Math.PI * 1.75); ctx.stroke();
    ctx.globalAlpha = 0.14; ctx.fillStyle = '#2c3e50'; for (let i = 0; i < 4; i++) { const f = this.iso(1.3 + i * 0.45, dr.u + dw / 2 + (i % 2 ? 0.12 : -0.12)); ctx.beginPath(); ctx.ellipse(f.x, f.y, s * 0.05, s * 0.025, 0.4, 0, 7); ctx.fill(); } ctx.restore();
    const pb = this.iso(u0 + 0.15, v0 + 0.15); ctx.save(); ctx.globalAlpha = 0.35; ctx.fillStyle = '#9fb6c6'; ctx.beginPath(); ctx.ellipse(pb.x, pb.y + 2, s * 0.24, s * 0.09, 0, 0, 7); ctx.fill(); ctx.restore();
    this.box(u0, v0, 0, 0.3, 0.3, 0.38, '#566573', { top: '#1c2833' });
    for (const [i, col] of [[0, '#1d1d1d'], [1, '#c0392b'], [2, '#1f3a93']]) { const b0 = this.iso(u0 + 0.08 + i * 0.07, v0 + 0.08 + i * 0.06, 0.38), b1 = this.iso(u0 + 0.06 + i * 0.08, v0 + 0.1 + i * 0.05, 0.85 + i * 0.05); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(b0.x - s * 0.035, b0.y); ctx.lineTo(b1.x, b1.y + s * 0.08); ctx.lineTo(b0.x + s * 0.035, b0.y); ctx.closePath(); ctx.fill(); ctx.strokeStyle = '#3d2b1f'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b1.x, b1.y + s * 0.08); ctx.lineTo(b1.x, b1.y); ctx.arc(b1.x - s * 0.035, b1.y, s * 0.035, 0, Math.PI, true); ctx.stroke(); ctx.fillStyle = 'rgba(160,200,230,0.9)'; ctx.beginPath(); ctx.ellipse(b0.x + (i - 1) * 3, b0.y + s * 0.06, 1.2, 1.8, 0, 0, 7); ctx.fill(); } },
  /* puesto del mercado: cartel de cartón de temporada y bombillas bajo el toldo en Navidad */
  drawStallSeason(L) { const E = this.env(); const R = L.size; const s = this.scale(); const ctx = this.ctx;
    const t = E.sales ? ['REBAJAS', '#e74c3c', '#fff'] : E.school ? ['VUELTA AL COLE', '#f9ca24', '#2d3436'] : E.summer ? ['GAFAS DE SOL', '#f9ca24', '#d35400'] : E.xmas ? ['FELIZ NAVIDAD', '#c0392b', '#fff'] : null;
    if (t) { const u0 = R * 0.28, w = 1.9; const hk1 = this.wallPt(u0 + 0.2, 'left', 1.72), hk2 = this.wallPt(u0 + w - 0.2, 'left', 1.72); ctx.strokeStyle = 'rgba(60,40,20,0.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(hk1.x, hk1.y); ctx.lineTo(hk1.x, hk1.y - s * 0.22); ctx.moveTo(hk2.x, hk2.y); ctx.lineTo(hk2.x, hk2.y - s * 0.22); ctx.stroke(); this.poly(this.wq(u0, w, 1.32, 1.72, 'left'), t[1], 'rgba(60,40,20,0.6)', 1.5); this.wallText(u0 + w / 2, 1.44, 'left', t[0], s * 0.13, t[2], true); }
    if (E.xmas) { const cols = ['#ff5252', '#ffd740', '#69f0ae', '#40c4ff']; let k = 0; for (const side of ['right', 'left']) for (let u = 0.4; u < R - 0.2; u += 0.55) { const p = this.wallPt(u, side, 2.5); this._bulbs.push({ x: p.x + s * 0.06, y: p.y + 2, r: Math.max(2, s * 0.035), c: cols[k++ % 4] }); } } },
  /* puesto al aire libre: suelo mojado con charcos (lluvia) o sol de mercado */
  drawStallWeather(L) { const E = this.env(); const R = L.size; const s = this.scale(); const ctx = this.ctx; const a = this.iso(0, 0), b = this.iso(R, 0), c = this.iso(R, R), d = this.iso(0, R);
    if (E.rain) { this.poly([a, b, c, d], 'rgba(40,60,80,0.14)'); for (const [u, v, r] of [[4.9, 2.9, 0.5], [1.2, 5.2, 0.4], [3.6, 5.3, 0.3]]) { const p = this.iso(u, v); ctx.save(); ctx.globalAlpha = 0.45; const g = ctx.createLinearGradient(p.x - s * r, 0, p.x + s * r, 0); g.addColorStop(0, '#8fa8b8'); g.addColorStop(1, '#e3edf2'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * r, s * r * 0.35, 0, 0, 7); ctx.fill(); ctx.restore(); } }
    else if (E.weather === 'sun') { const rg = ctx.createRadialGradient(this.W * 0.85, 0, 0, this.W * 0.85, 0, this.W * 0.6); rg.addColorStop(0, 'rgba(255,240,180,0.45)'); rg.addColorStop(1, 'rgba(255,240,180,0)'); ctx.fillStyle = rg; ctx.fillRect(0, 0, this.W, this.H); } },
  drawDoor(dr) { const side = dr.side || 'left'; const s = this.scale(); const ctx = this.ctx; const u = dr.u, w = dr.w || 1.2; const E = this.env(); const p1 = this.wallPt(u, side, 0), p2 = this.wallPt(u + w, side, 0), p3 = this.wallPt(u + w, side, 1.95), p4 = this.wallPt(u, side, 1.95);
    const sky = this.SKY[E.weather] || this.SKY.cloud; this.poly([p1, p2, p3, p4], E.era >= 2 ? '#4a4f55' : '#6b4a2e', '#3a2616', 2); const g1 = this.wallPt(u + 0.15, side, 1.0), g2 = this.wallPt(u + w - 0.15, side, 1.0), g3 = this.wallPt(u + w - 0.15, side, 1.75), g4 = this.wallPt(u + 0.15, side, 1.75); this.poly([g1, g2, g3, g4], sky[1], '#3a2616'); this._glass.push([g1, g2, g3, g4]); const k = this.wallPt(u + w - 0.25, side, 0.9); ctx.fillStyle = '#e4c35b'; ctx.beginPath(); ctx.arc(k.x, k.y, s * 0.04, 0, 7); ctx.fill(); },
  drawWallDisplay(u, w, side) { const s = this.scale(); const ctx = this.ctx; const p = (du, z) => this.wallPt(u + du, side, z); this.poly([p(0, 0.3), p(w, 0.3), p(w, 1.62), p(0, 1.62)], '#f7f3ea', 'rgba(0,0,0,0.35)');
    for (let r = 0; r < 4; r++) { const z = 0.45 + r * 0.3; const a = p(0.05, z), b = p(w - 0.05, z); ctx.strokeStyle = '#d9cbb0'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); const n = Math.max(2, Math.round(w * 3)); for (let k = 0; k < n; k++) { const q = p(0.18 + (w - 0.36) * k / Math.max(1, n - 1), z + 0.12); this.glasses(q.x, q.y, s * 0.075, ['#222', '#16a085', '#c0392b', '#f1c40f', '#8e44ad', '#2c3e50', '#e67e22'][(r + k) % 7], side === 'left' ? -0.5 : 0.5); } }
    // luz LED superior
    const l1 = p(0, 1.65), l2 = p(w, 1.65); ctx.strokeStyle = 'rgba(255,255,220,0.9)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(l1.x, l1.y); ctx.lineTo(l2.x, l2.y); ctx.stroke(); },
  drawPoster(u, side, color) { const p = (du, z) => this.wallPt(u + du, side, z); const s = this.scale(); const ctx = this.ctx; const tilt = side === 'left' ? -0.5 : 0.5;
    if (this.env().school) { // vuelta al cole: cartel amarillo con lápiz y gafas infantiles
      this.poly([p(0, 1.05), p(0.7, 1.05), p(0.7, 1.85), p(0, 1.85)], '#f9ca24', '#111', 2); const c1 = p(0.22, 1.62), c2 = p(0.5, 1.62); this.glasses(c1.x, c1.y, s * 0.06, '#e74c3c', tilt); this.glasses(c2.x, c2.y, s * 0.06, '#0984e3', tilt);
      const a = p(0.12, 1.12), b = p(0.58, 1.12); ctx.save(); ctx.lineCap = 'butt'; ctx.strokeStyle = '#e17055'; ctx.lineWidth = s * 0.05; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); ctx.restore();
      ctx.fillStyle = '#2d3436'; ctx.font = `bold ${Math.max(7, s * 0.085)}px sans-serif`; ctx.textAlign = 'center'; const c = p(0.35, 1.45); ctx.fillText('VUELTA', c.x, c.y); ctx.fillText('AL COLE', c.x, c.y + s * 0.11); return; }
    this.poly([p(0, 1.05), p(0.7, 1.05), p(0.7, 1.85), p(0, 1.85)], color || '#2c3e50', '#111', 2); const c = p(0.35, 1.5); this.glasses(c.x, c.y, s * 0.13, '#fff', tilt); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `bold ${Math.max(8, s * 0.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText(this.posterWord(), c.x, c.y + s * 0.3); },
  drawBoard(u, side) { const p = (du, z) => this.wallPt(u + du, side, z); const s = this.scale(); const ctx = this.ctx; this.poly([p(0, 0.9), p(1.4, 0.9), p(1.4, 1.9), p(0, 1.9)], '#2d4a3a', '#8a5a2b', 3); ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.lineWidth = 1.5; const c1 = p(0.4, 1.4), c2 = p(1.0, 1.4); this.glasses(c1.x, c1.y, s * 0.11, 'rgba(255,255,255,0.85)', side === 'left' ? -0.5 : 0.5); ctx.beginPath(); ctx.moveTo(c2.x - s * 0.15, c2.y - s * 0.1); ctx.lineTo(c2.x + s * 0.15, c2.y + s * 0.05); ctx.stroke(); ctx.fillStyle = 'rgba(255,255,255,0.85)'; ctx.font = `${Math.max(7, s * 0.08)}px sans-serif`; ctx.fillText('52□18', c2.x - s * 0.1, c2.y + s * 0.25); },
  /* optotipo de Snellen con su texto en el plano de la pared (no se sale del cuadro) y test duocromo */
  drawOptotipo(u, side) { const ctx = this.ctx; const p = (du, z) => this.wallPt(u + du, side, z); const lcd = this.lcdChart();
    if (lcd) this.poly([p(-0.08, 0.92), p(0.68, 0.92), p(0.68, 1.86), p(-0.08, 1.86)], '#16191d', '#000', 2);
    this.poly([p(0, 1.0), p(0.6, 1.0), p(0.6, 1.8), p(0, 1.8)], '#ffffff', lcd ? '#000' : '#333', 2);
    const o = p(0, 1.8), ex = p(1, 1.8), ez = p(0, 0.8); ctx.save(); ctx.transform((ex.x - o.x) / 100, (ex.y - o.y) / 100, (ez.x - o.x) / 100, (ez.y - o.y) / 100, o.x, o.y);
    ctx.fillStyle = '#1b1b1b'; ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic'; let y = 3;
    for (const [t, f] of [['E', 17], ['F P', 11], ['T O Z', 8], ['L P E D', 6], ['P E C F D', 4.6]]) { y += f + 1.6; ctx.font = `bold ${f}px "Courier New", monospace`; ctx.fillText(t, 30, y); }
    ctx.fillStyle = '#e74c3c'; ctx.fillRect(5, 67, 25, 8); ctx.fillStyle = '#27ae60'; ctx.fillRect(30, 67, 25, 8); ctx.restore(); },
  drawWallScreen(u, w, side) { const p = (du, z) => this.wallPt(u + du, side, z); const s = this.scale(); const ctx = this.ctx; const era = this.env().era;
    if (era === 0) { this.poly([p(0, 0.95), p(w, 0.95), p(w, 1.75), p(0, 1.75)], '#ecf0f1', '#7f8c8d', 3); const g0 = ctx.createLinearGradient(0, p(0, 1.7).y, 0, p(0, 1.0).y); g0.addColorStop(0, '#f8c291'); g0.addColorStop(1, '#e55039'); this.poly([p(0.06, 1.0), p(w - 0.06, 1.0), p(w - 0.06, 1.7), p(0.06, 1.7)], g0); const c0 = p(w / 2, 1.38); this.glasses(c0.x, c0.y, s * 0.14, '#2c2c2c', side === 'left' ? -0.5 : 0.5); ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(7, s * 0.09)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('MODA', c0.x, c0.y + s * 0.26); return; } // caja de luz
    this.poly([p(0, 0.9), p(w, 0.9), p(w, 1.75), p(0, 1.75)], '#1b1f27', '#000', era === 1 ? 7 : 3); const g = ctx.createLinearGradient(0, p(0, 1.75).y, 0, p(0, 0.9).y); g.addColorStop(0, era === 1 ? '#3c6382' : '#2d7bd6'); g.addColorStop(1, era === 1 ? '#82ccdd' : '#7ad2ff'); this.poly([p(0.05, 0.95), p(w - 0.05, 0.95), p(w - 0.05, 1.7), p(0.05, 1.7)], g); const c = p(w / 2, 1.35); this.glasses(c.x, c.y, s * 0.14, '#fff', side === 'left' ? -0.5 : 0.5); ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.max(7, s * 0.09)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('#MIRADA', c.x, c.y + s * 0.26); },
  drawMirror(u, side) { const p = (du, z) => this.wallPt(u + du, side, z); const ctx = this.ctx; const g = ctx.createLinearGradient(p(0, 0.3).x, 0, p(0.6, 1.9).x, 0); g.addColorStop(0, '#dfeef5'); g.addColorStop(0.5, '#ffffff'); g.addColorStop(1, '#c9dbe5'); this.poly([p(0, 0.3), p(0.6, 0.3), p(0.6, 1.9), p(0, 1.9)], g, '#b89a62', 3); },
  /* gafas: forma (round, rect, cat, browline, aviator, panto), montura con brillo, lente con reflejo y varillas.
     Sin forma explícita, se elige por color para que los expositores tengan variedad estable. */
  GL_SHAPES: ['rect', 'round', 'cat', 'browline', 'aviator', 'panto'],
  PREVIEW: { aviador: ['aviator', '#b7950b'], wayfarer: ['rect', '#1d1d1d', 1.05], pantos: ['panto', '#5d4037'], cateye: ['cat', '#c0392b'], clubmaster: ['browline', '#3e2723'], redondas: ['round', '#8e5a2b'], rectangulares: ['rect', '#2c3e50'], mariposa: ['cat', '#8e44ad', 1.15],
    hexagonales: ['hex', '#b7950b'], navegador: ['aviator', '#7f8c8d'], escudo: ['shield', '#2d3436'], envolventes: ['shield', '#c0392b'], alaire: ['rimless', '#95a5a6'], nylor: ['browline', '#34495e'], doblepuente: ['aviator', '#b7950b'], medialuna: ['browline', '#7f8c8d', 0.9], keyhole: ['panto', '#1d1d1d'], crownpanto: ['panto', '#8e5a2b'],
    microoval: ['round', '#2d3436', 0.85], glaciar: ['round', '#5d4037'], carey: ['panto', '#8b4513'], transparentes: ['rect', 'rgba(170,200,215,0.95)'], bicolor: ['rect', '#16a085'], minimal: ['round', '#95a5a6', 0.95], titanio: ['rect', '#7f8c8d'], chunky: ['rect', '#1d1d1d', 1.1], combinada: ['browline', '#2c3e50'],
    madera: ['rect', '#a0522d'], flexible: ['round', '#2980b9'], carbono: ['rect', '#2d3436'], joya: ['cat', '#d4ac0d'], acero: ['rimless', '#7f8c8d'], neon: ['shield', '#e84393'], soft: ['rect', '#6d6d6d'], nordico: ['round', '#bdc3c7'], retro70: ['aviator', '#8e5a2b', 1.15], retro80: ['rect', '#e84393', 1.15],
    noventas: ['round', '#1d1d1d', 0.8], y2k: ['shield', '#8e44ad'], logomania: ['rect', '#d4ac0d'], hipster: ['panto', '#1d1d1d', 1.05], eco: ['round', '#7d5a3c'], techwear: ['shield', '#2d3436'], smart: ['rect', '#2c3e50', 1.05], lujosilencioso: ['rect', '#b7950b', 0.95], arquitecto: ['hex', '#2d3436'], steampunk: ['round', '#b87333'],
    carreras: ['aviator', '#c0392b'], surf: ['shield', '#16a085'], oversize: ['rect', '#1d1d1d', 1.25], flexkids: ['round', '#16a085'] },
  /* fotos de producto (img/gafas/<estilo>-g.webp lente graduada, -s.webp lente solar). Si un estilo no tiene foto o no
     carga (sin conexión y sin caché), se dibuja la montura vectorial (PREVIEW). */
  PHOTOS: 'abuelita,acero,alaire,arquitecto,audiogafa,autofoco,autorreparable,aviadegr,aviador,bicolor,bifocal,carbono,carey,carreras,cateye,cazal,chunky,climatica,clubmaster,combinada,crownpanto,culovaso,doblepuente,eco,electrocromica,envolventes,escudo,esqui,flexible,flexkids,gafaar,glaciar,glam,grafeno,hexagonales,hipster,impresa3d,joya,keyhole,lentillaint,logomania,lujosilencioso,madera,mariposa,medialuna,micelio,microoval,minimal,mioexterior,modular2,movida,navegador,neoanalogica,neon,neural,nordico,noventas,nylor,optyl,oversize,pantallahud,pantos,parche,plegable,protesica,rectangulares,redondas,retro70,retro80,retroveinte,sinvarillas,smart,soft,solar,steampunk,surf,techwear,titanio,transicion,transparentes,varillabaja,vintagecert,visera,wayfarer,y2k,yuppie',
  photoSrc(topic, genre) { if (!this._phs) this._phs = new Set(this.PHOTOS.split(',')); const id = this._phs.has(topic) ? topic : null; if (!id) return null; return 'img/gafas/' + id + (genre === 'sol' || genre === 'deportiva' ? '-s' : '-g') + '.webp'; },
  photo(src, cb) { this._ph = this._ph || new Map(); let e = this._ph.get(src);
    if (!e) { e = { im: new Image(), cbs: [] }; e.im.decoding = 'async'; e.im.onload = () => { const l = e.cbs; e.cbs = []; l.forEach(f => f()); }; e.im.onerror = () => { e.bad = true; e.cbs = []; }; e.im.src = src; this._ph.set(src, e); if (this._ph.size > 60) { const k = this._ph.keys().next().value; if (k !== src) this._ph.delete(k); } }
    if (e.bad) return null; if (e.im.complete && e.im.naturalWidth) return e.im; if (cb) e.cbs.push(cb); return null; },
  /* miniatura para tablas, tarjetas y avisos: la foto si la hay; si no, data URL del dibujo (en caché) */
  previewURL(topic, genre) { const ph = this.photoSrc(topic, genre); if (ph) { this.photo(ph); return ph; } const key = topic + '|' + genre; this._pv = this._pv || new Map(); let u = this._pv.get(key); if (u) return u; try { const cv = document.createElement('canvas'); cv.width = 96; cv.height = 44; this.drawFramePreview(cv, topic, genre, true); u = cv.toDataURL(); } catch (e) { u = ''; } this._pv.set(key, u); return u; },
  /* vista previa de la montura en el asistente: la foto del estilo con lente clara o solar según el tipo; sin foto, el dibujo */
  drawFramePreview(cv, topic, genre, vectorOnly) {
    const src = !vectorOnly && topic && this.photoSrc(topic, genre); cv._pk = topic + '|' + genre;
    if (src) { const k0 = cv._pk; const im = this.photo(src, () => { if (cv._pk === k0) this.drawFramePreview(cv, topic, genre); });
      if (im) { const c = cv.getContext('2d'), W = cv.width, H = cv.height; c.clearRect(0, 0, W, H); const k = Math.min(W * 0.94 / im.naturalWidth, H * 0.92 / im.naturalHeight); const w = im.naturalWidth * k, h = im.naturalHeight * k; c.imageSmoothingQuality = 'high'; c.drawImage(im, (W - w) / 2, (H - h) / 2, w, h); return; } }
    const c = cv.getContext('2d'); const W = cv.width, H = cv.height; c.clearRect(0, 0, W, H); if (!topic) { c.fillStyle = '#b8ab93'; c.font = '13px "Segoe UI", sans-serif'; c.textAlign = 'center'; c.fillText('Elige un estilo', W / 2, H / 2 + 4); return; }
    const p = this.PREVIEW[topic] || ['rect', '#2c3e50']; let shape = p[0], col = p[1] || '#2c3e50', lens = null; const k = p[2] || 1;
    if (genre === 'sol') { lens = 'rgba(28,30,40,0.85)'; } else if (genre === 'deportiva') { shape = 'shield'; lens = 'rgba(235,120,40,0.55)'; } else if (genre === 'infantil') { col = ['#16a085', '#e84393', '#2980b9', '#f39c12'][topic.length % 4]; if (shape === 'cat' || shape === 'aviator' || shape === 'hex') shape = 'round'; } else if (genre === 'premium') { col = col.startsWith('rgba') ? col : '#b7950b'; } else if (genre === 'lectura') { if (shape === 'rect' || shape === 'panto') shape = 'browline'; }
    c.fillStyle = 'rgba(0,0,0,0.12)'; c.beginPath(); c.ellipse(W / 2, H * 0.82, W * 0.3, H * 0.07, 0, 0, 7); c.fill();
    const saved = this.ctx; this.ctx = c; try { this.glasses(W / 2, H * 0.48, H * 0.2 * k, col, 0, lens, shape, false); } finally { this.ctx = saved; } },
  glasses(x, y, r, col, tilt, lens, shape, face) {
    const ctx = this.ctx; if (!shape) { let h = 0; for (let i = 0; i < col.length; i++) h = (h * 31 + col.charCodeAt(i)) | 0; shape = this.GL_SHAPES[Math.abs(h + Math.round(r * 10)) % this.GL_SHAPES.length]; }
    ctx.save(); ctx.translate(x, y); ctx.transform(1, (tilt || 0) * 0.35, 0, 1, 0, 0); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const lw = Math.max(face ? 0.9 : 1, r * (shape === 'browline' ? 0.18 : 0.27)); const gap = r * 1.12;
    if (shape === 'shield') { ctx.beginPath(); ctx.moveTo(-gap - r * 1.1, -r * 0.5); ctx.quadraticCurveTo(0, -r * 0.9, gap + r * 1.1, -r * 0.5); ctx.quadraticCurveTo(gap + r * 1.25, r * 0.6, gap * 0.4, r * 0.8); ctx.quadraticCurveTo(0, r * 0.05, -gap * 0.4, r * 0.8); ctx.quadraticCurveTo(-gap - r * 1.25, r * 0.6, -gap - r * 1.1, -r * 0.5); ctx.closePath();
      ctx.fillStyle = lens || 'rgba(205,225,240,0.3)'; ctx.fill(); ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke();
      if (r > 2.2) { ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = Math.max(0.6, r * 0.14); ctx.beginPath(); ctx.moveTo(-gap - r * 0.4, -r * 0.1); ctx.lineTo(-gap + r * 0.1, -r * 0.5); ctx.stroke(); }
      ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, lw * 0.8); ctx.beginPath(); ctx.moveTo(-gap - r * 1.1, -r * 0.45); ctx.lineTo(-gap - r * 1.6, -r * 0.2); ctx.moveTo(gap + r * 1.1, -r * 0.45); ctx.lineTo(gap + r * 1.6, -r * 0.2); ctx.stroke(); ctx.restore(); return; }
    const path = (cx, d) => { ctx.beginPath();
      if (shape === 'round') ctx.ellipse(cx, 0, r * 0.95, r * 0.9, 0, 0, Math.PI * 2);
      else if (shape === 'rect') ctx.roundRect(cx - r * 1.05, -r * 0.68, r * 2.1, r * 1.36, r * 0.32);
      else if (shape === 'panto') { ctx.moveTo(cx - r, -r * 0.62); ctx.lineTo(cx + r, -r * 0.62); ctx.quadraticCurveTo(cx + r * 1.08, r * 0.75, cx, r * 0.85); ctx.quadraticCurveTo(cx - r * 1.08, r * 0.75, cx - r, -r * 0.62); }
      else if (shape === 'hex') { for (let k = 0; k < 6; k++) { const an = k * Math.PI / 3; const px = cx + Math.cos(an) * r * 1.05, py = Math.sin(an) * r * 0.88; if (k) ctx.lineTo(px, py); else ctx.moveTo(px, py); } }
      else if (shape === 'rimless') ctx.roundRect(cx - r * 1.0, -r * 0.62, r * 2.0, r * 1.3, r * 0.45);
      else if (shape === 'cat') { ctx.moveTo(cx - d * r * 0.95, -r * 0.42); ctx.quadraticCurveTo(cx, -r * 0.72, cx + d * r * 1.25, -r * 0.92); ctx.quadraticCurveTo(cx + d * r * 1.1, r * 0.72, cx, r * 0.68); ctx.quadraticCurveTo(cx - d * r * 1.0, r * 0.62, cx - d * r * 0.95, -r * 0.42); }
      else if (shape === 'aviator') { ctx.moveTo(cx - d * r * 0.9, -r * 0.62); ctx.lineTo(cx + d * r * 1.05, -r * 0.62); ctx.quadraticCurveTo(cx + d * r * 1.15, r * 0.55, cx + d * r * 0.1, r * 0.95); ctx.quadraticCurveTo(cx - d * r * 0.95, r * 0.75, cx - d * r * 0.9, -r * 0.62); }
      else { ctx.roundRect(cx - r * 1.0, -r * 0.6, r * 2.0, r * 1.25, [r * 0.15, r * 0.15, r * 0.6, r * 0.6]); }
      ctx.closePath(); };
    for (const d of [-1, 1]) { const cx = d * gap; path(cx, d); ctx.fillStyle = lens || (face ? 'rgba(215,236,250,0.28)' : 'rgba(205,225,240,0.22)'); ctx.fill();
      if (shape === 'rimless') { ctx.strokeStyle = 'rgba(150,160,168,0.7)'; ctx.lineWidth = Math.max(0.6, lw * 0.35); ctx.stroke(); ctx.fillStyle = col; ctx.beginPath(); ctx.arc(cx + d * r * 0.95, -r * 0.3, Math.max(0.8, r * 0.12), 0, 7); ctx.arc(cx - d * r * 0.95, -r * 0.3, Math.max(0.8, r * 0.12), 0, 7); ctx.fill(); }
      else if (shape === 'browline') { ctx.strokeStyle = '#a7adb2'; ctx.lineWidth = Math.max(0.7, lw * 0.6); ctx.stroke(); ctx.strokeStyle = col; ctx.lineWidth = lw * 2.4; ctx.beginPath(); ctx.moveTo(cx - r * 1.0, -r * 0.5); ctx.quadraticCurveTo(cx, -r * 0.72, cx + r * 1.0, -r * 0.5); ctx.stroke(); }
      else { ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.stroke(); }
      if (r > 2.2) { ctx.strokeStyle = lens ? 'rgba(255,255,255,0.3)' : (face ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.5)'); ctx.lineWidth = Math.max(0.6, r * 0.14); ctx.beginPath(); ctx.moveTo(cx - r * 0.5, -r * 0.15); ctx.lineTo(cx - r * 0.15, -r * 0.45); ctx.stroke(); } }
    // puente y varillas
    ctx.strokeStyle = shape === 'browline' || shape === 'aviator' ? '#9aa1a6' : col; ctx.lineWidth = Math.max(0.8, lw * 0.85); ctx.beginPath(); ctx.moveTo(-gap + r * 0.85, -r * 0.2); ctx.quadraticCurveTo(0, -r * 0.55, gap - r * 0.85, -r * 0.2);
    if (shape === 'aviator') { ctx.moveTo(-gap + r * 0.7, -r * 0.6); ctx.lineTo(gap - r * 0.7, -r * 0.6); }
    ctx.stroke();
    ctx.strokeStyle = col; ctx.lineWidth = Math.max(0.8, lw * 0.8); ctx.beginPath(); if (face) { ctx.moveTo(-gap - r * 1.0, -r * 0.3); ctx.lineTo(-gap - r * 1.35, -r * 0.15); ctx.moveTo(gap + r * 1.0, -r * 0.3); ctx.lineTo(gap + r * 1.35, -r * 0.15); }
    else { ctx.moveTo(-gap - r * 1.0, -r * 0.3); ctx.lineTo(-gap - r * 1.55, -r * 0.05); ctx.moveTo(gap + r * 1.0, -r * 0.3); ctx.lineTo(gap + r * 1.55, -r * 0.05); }
    ctx.stroke(); ctx.restore(); },

  /* ================= mobiliario (estático y dinámico) ================= */
  furniture(L) {
    if (L.room) return this.roomFurniture(L);
    const out = []; const s = this.scale(); const lvl = this.level(); const self = this; const co = this.co();
    const add = (u, v, w, d, fn, dynamic, nav) => out.push({ depth: u + v + (w + d) / 2, draw: fn, dynamic: true, rect: { u, v, w, d }, box: { u, v, w, d }, nav });
    // mostrador
    const zsig = () => { const ti = self.info('tienda'); return ti._zs || (ti._zs = (ti.zoneIds || []).join(',')); };
    const c = L.counter; if (c) add(c.u, c.v, c.w, c.d, () => { self.cached('counter', c, 1.9, zsig(), () => self.drawCounter(c)); self.drawCounterPulse(c); }, true);
    // mesas de trabajo (una por puesto hasta maxStaff)
    const nDesks = this.nDesks(); for (let i = 0; i < nDesks; i++) { const dk = L.desks[i]; add(dk.u, dk.v - 0.62, 1.7, 1.72, () => { const occ = i < co.staff.length; const p = self._deskOcc && self._deskOcc[i]; self.cached('dchair' + i, { u: dk.u + 0.2, v: dk.v - 0.6, w: 0.6, d: 0.6 }, 1.2, '', () => self.drawDeskChair(dk)); if (p) self.drawStaffMember(p); self.cached('desk' + i, { u: dk.u, v: dk.v, w: 1.7, d: 1.1 }, 1.6, occ ? 1 : 0, () => self.drawDesk(dk, occ, i)); }, false, { u: dk.u, v: dk.v - 0.6, w: 1.7, d: 1.7 }); }
    // expositores de suelo / giratorios (en el puesto, el primero se vuelve de gafas de sol en verano o con la zona de sol)
    (L.standDisplays || []).forEach((e, i) => add(e.u, e.v, 0.8, 0.8, e.kind === 'rotativo' ? () => self.drawStandDisplay(e.u, e.v, e.kind, lvl === 1 && i === 0 && (self.env().summer || (self.info('tienda').zoneIds || []).indexOf('sol') >= 0) ? 'sun' : null) : () => self.cached('stand' + i, { u: e.u, v: e.v, w: 0.8, d: 0.8 }, 1.8, '', () => self.drawStandDisplay(e.u, e.v, e.kind)), e.kind === 'rotativo'));
    // sillas de espera, mesa baja, plantas (la primera es un abeto en diciembre), otros
    (L.plants || []).forEach((p, i) => add(p.u, p.v, 0.6, 0.6, () => self.cached('plant' + i, { u: p.u, v: p.v, w: 0.6, d: 0.6 }, 1.4, '', () => self.drawPlant(p.u, p.v, i === 0 && self.env().xmas))));
    (L.chairs || []).forEach((ch, i) => add(ch.u, ch.v, 0.6, 0.6, () => self.cached('chair' + i, { u: ch.u, v: ch.v, w: 0.6, d: 0.6 }, 1.0, '', () => self.drawChair(ch.u, ch.v, ch.dir || 0, '#b0612c'))));
    if (L.table) add(L.table.u, L.table.v, 1, 0.8, () => self.cached('table', { u: L.table.u, v: L.table.v, w: 1, d: 0.8 }, 0.6, '', () => self.drawLowTable(L.table.u, L.table.v)));
    if (L.sofa) add(L.sofa.u, L.sofa.v, 1.8, 0.8, () => self.cached('sofa', { u: L.sofa.u, v: L.sofa.v, w: 1.8, d: 0.8 }, 1.0, '', () => self.drawSofa(L.sofa.u, L.sofa.v)));
    // departamentos (la información se lee en cada fotograma, con la caché de 250 ms de info())
    const depts = L.depts || {};
    if (depts.gabinete) { const z = depts.gabinete; add(z.u, z.v, z.w, z.d, () => { const info = self.info('gabinete'); const equipped = (co.hasResearch && co.hasResearch('Gabinete')) || (info.tier || 0) > 0; const sig = info._sig || (info._sig = (equipped ? 'E' : '') + (info.tier || 0) + (info.owned || info.instruments || []).join(',')); self.cached('gabinete', z, 2.0, sig, () => self.drawGabinete(z, equipped, info)); }); }
    if (depts.taller) { const z = depts.taller; add(z.u, z.v, z.w, z.d, () => self.drawTaller(z, self.info('taller')), true); }
    if (depts.lab) { const z = depts.lab; add(z.u, z.v, z.w, z.d, () => self.drawLab(z, self.info('lab')), true); }
    if (depts.marketing) { const z = depts.marketing; add(z.u, z.v, z.w, z.d, () => self.drawMarketing(z, self.info('marketing')), true); }
    if (depts.tienda) { const z = depts.tienda; add(z.u, z.v, z.w, z.d, () => self.cached('tienda', z, 2.0, zsig(), () => self.drawVitrina(z))); }
    // cabina de audiología (instrumento del gabinete o zona de la tienda), en la zona de venta
    if (L.audio && this.hasAudio()) { const a = L.audio; add(a.u, a.v, 1, 1, () => self.cached('audio', { u: a.u, v: a.v, w: 1, d: 1 }, 1.4, '', () => self.drawAudioBooth(a.u, a.v))); }
    return out;
  },
  /* sprites de muebles estáticos: se pintan una vez en un lienzo aparte y se reutilizan mientras no cambie su firma
     (estado del mueble + tamaño/nivel + época/temporada). Ahorra la mayor parte del dibujo por fotograma. */
  cached(id, r, zTop, sig, fn) {
    const key = sig + '|' + this.bgKey + '|' + this.env().fkey; let sp = this.spriteCache.get(id);
    if (!sp || sp.key !== key) {
      const s = this.scale(), dpr = this.dpr || 1, pad = s * 0.45 + 30; let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9;
      for (const du of [0, r.w]) for (const dv of [0, r.d]) for (const z of [0, zTop]) { const p = this.iso(r.u + du, r.v + dv, z); x0 = Math.min(x0, p.x); y0 = Math.min(y0, p.y); x1 = Math.max(x1, p.x); y1 = Math.max(y1, p.y); }
      x0 = Math.floor((x0 - pad) * dpr) / dpr; y0 = Math.floor((y0 - pad) * dpr) / dpr; const cw = Math.max(1, Math.ceil((x1 + pad - x0) * dpr)), ch = Math.max(1, Math.ceil((y1 + pad * 0.6 - y0) * dpr));
      const c = (sp && sp.c) || document.createElement('canvas'); c.width = cw; c.height = ch; const g = c.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, -x0 * dpr, -y0 * dpr);
      const saved = this.ctx; this.ctx = g; try { fn(); } finally { this.ctx = saved; }
      sp = { key, c, x: x0, y: y0, w: cw / dpr, h: ch / dpr }; this.spriteCache.set(id, sp);
    }
    this.ctx.drawImage(sp.c, sp.x, sp.y, sp.w, sp.h);
  },
  /* mostrador: madera y formica con caja registradora y teléfono de cable (90) · TPV y datáfono (2000s) · blanco con tablet (2013+) · mampara (2020-22) */
  drawCounter(c) { const s = this.scale(); const ctx = this.ctx; const lvl = this.level(); const E = this.env(); const zs = this.info('tienda').zoneIds || []; this.shadow(c.u, c.v, c.w, c.d);
    const m = lvl === 1 ? ['#a0693a', '#c58a52', '#7d4f28', '#8e5a2e', '#e74c3c'] : E.era === 0 ? ['#a87b52', '#eadfc8', '#7f5a36', '#946a43', '#7b241c'] : E.era === 1 ? [lvl === 4 ? '#f2f2f0' : '#f4efe6', '#fbf8f1', '#cfc3b0', '#e6dccb', '#2c3e50'] : ['#f7f7f5', '#ffffff', '#d5d8dc', '#eceef0', '#bfe9ff'];
    this.box(c.u, c.v, 0, c.w, c.d, 0.95, m[0], { top: m[1], right: m[2], left: m[3] });
    // franja decorativa (línea de luz desde 2013)
    const P = (du, dv, dz) => this.iso(c.u + du, c.v + dv, dz); this.poly([P(0, c.d, 0.55), P(c.w, c.d, 0.55), P(c.w, c.d, 0.7), P(0, c.d, 0.7)], m[4]);
    const T = 0.95, cu = c.u, cv = c.v;
    // fila del fondo: vitrina de lentillas y accesorios (zonas compradas en la tienda)
    if (zs.indexOf('lentes_contacto_reposicion') >= 0 || zs.indexOf('contactologia') >= 0) this.lcBox(cu + c.w * 0.27, cv + 0.06, T);
    if (zs.indexOf('accesorios') >= 0) this.accessories(cu + c.w * 0.43, cv + 0.08, T);
    this.till(cu + c.w * 0.62, cv + c.d * 0.2, T, lvl === 1, E.era);
    if (zs.indexOf('lectura') >= 0) this.readingTower(cu + 0.06, cv + c.d * 0.2, T);
    const g1 = P(c.w * 0.25, c.d * 0.45, 0.98), g2 = P(c.w * 0.42, c.d * 0.62, 0.98); this.glasses(g1.x, g1.y, s * 0.07, '#222', 0.5); this.glasses(g2.x, g2.y, s * 0.07, '#c0392b', 0.5);
    if (lvl > 1) { if (E.era === 0) this.deskPhone(cu + c.w * 0.84, cv + c.d * 0.12, T); else this.cardTerminal(cu + c.w * 0.86, cv + c.d * 0.45, T, E.era); }
    if (E.covid && lvl > 1) { this.box(cu + c.w * 0.52, cv + c.d * 0.62, T, 0.06, 0.06, 0.13, '#a8e6cf', { top: '#2d3436' }); ctx.save(); ctx.globalAlpha = 0.85; this.poly([P(0.1, c.d - 0.06, T), P(c.w - 0.1, c.d - 0.06, T), P(c.w - 0.1, c.d - 0.06, T + 0.72), P(0.1, c.d - 0.06, T + 0.72)], 'rgba(200,235,250,0.22)', 'rgba(110,150,170,0.7)', 1.5); ctx.restore(); }
  },
  /* aviso parpadeante sobre el mostrador cuando no hay colección en marcha (se pinta fuera del sprite) */
  drawCounterPulse(c) { const ctx = this.ctx; const P = (du, dv, dz) => this.iso(c.u + du, c.v + dv, dz);
    if (G.isIdle && G.isIdle() && !(typeof UI !== 'undefined' && UI.interlude) && !G.modalOpen) { const m2 = P(c.w / 2, c.d / 2, 1.45); const bob = Math.sin(this.time / 300) * 3; const y = m2.y - 6 + bob; ctx.save(); ctx.font = 'bold 12px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; const txt = '👓 Nueva colección'; const w = ctx.measureText(txt).width + 18; ctx.shadowColor = 'rgba(0,0,0,0.25)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2; ctx.fillStyle = '#fff9ef'; ctx.strokeStyle = '#F47A20'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(m2.x - w / 2, y - 22, w, 22, 8); ctx.moveTo(m2.x - 6, y); ctx.lineTo(m2.x, y + 8); ctx.lineTo(m2.x + 6, y); ctx.fill(); ctx.shadowColor = 'transparent'; ctx.stroke(); ctx.fillStyle = '#fff9ef'; ctx.fillRect(m2.x - 5, y - 2, 10, 3); ctx.fillStyle = '#7a3d0c'; ctx.fillText(txt, m2.x, y - 7); ctx.restore(); } },
  /* caja de cobro según época: caja de caudales o lector (puesto) · registradora beige · TPV · tablet */
  till(u, v, z, stall, era) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    if (stall) { if (era < 2) { this.box(u, v, z, 0.34, 0.26, 0.1, '#7f8c8d', { top: '#95a5a6' }); const h1 = P(0.1, 0.13, 0.1), h2 = P(0.24, 0.13, 0.1); ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(h1.x, h1.y); ctx.quadraticCurveTo((h1.x + h2.x) / 2, h1.y - s * 0.07, h2.x, h2.y); ctx.stroke(); }
      else { this.box(u, v, z, 0.12, 0.22, 0.012, '#1e272e', { top: '#2d3436' }); const sc = P(0.06, 0.11, 0.015); ctx.fillStyle = '#74b9ff'; ctx.fillRect(sc.x - s * 0.04, sc.y - s * 0.03, s * 0.08, s * 0.05); this.box(u + 0.18, v + 0.04, z, 0.12, 0.12, 0.03, '#f5f6fa', { top: '#dfe6e9' }); } return; }
    if (era === 0) { this.box(u, v, z, 0.42, 0.34, 0.14, '#d8cfb7', { top: '#e9e2cf', right: '#b5ab92' }); this.box(u + 0.05, v + 0.02, z + 0.14, 0.32, 0.1, 0.12, '#cfc5ab', { top: '#ddd5bf' }); const dp = P(0.21, 0.12, 0.21); ctx.fillStyle = '#1b1b1b'; ctx.fillRect(dp.x - s * 0.07, dp.y - s * 0.035, s * 0.14, s * 0.045); ctx.fillStyle = '#4cd137'; ctx.fillRect(dp.x - s * 0.05, dp.y - s * 0.022, s * 0.08, s * 0.02); ctx.fillStyle = '#6d6650'; for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) { const k = P(0.08 + i * 0.11, 0.17 + j * 0.08, 0.14); ctx.fillRect(k.x - 1.5, k.y - 1, 3, 2); } return; }
    if (era === 1) { this.box(u, v, z, 0.35, 0.3, 0.22, '#3b3f46', { top: '#6b7280' }); const scr = P(0.1, 0, 0.35); ctx.fillStyle = '#9ad7ff'; ctx.fillRect(scr.x - s * 0.08, scr.y - s * 0.07, s * 0.16, s * 0.1); return; }
    this.box(u + 0.1, v + 0.08, z, 0.1, 0.12, 0.03, '#b2bec3', { top: '#dfe6e9' }); this.poly([P(0, 0.2, 0.03), P(0.32, 0.2, 0.03), P(0.32, 0.06, 0.28), P(0, 0.06, 0.28)], '#1e272e', '#000'); this.poly([P(0.03, 0.19, 0.05), P(0.29, 0.19, 0.05), P(0.29, 0.07, 0.26), P(0.03, 0.07, 0.26)], era >= 3 ? '#a29bfe' : '#74b9ff'); this.poly([P(0.06, 0.15, 0.1), P(0.26, 0.15, 0.1), P(0.26, 0.13, 0.13), P(0.06, 0.13, 0.13)], 'rgba(255,255,255,0.8)'); },
  cardTerminal(u, v, z, era) { const s = this.scale(); const ctx = this.ctx; const col = era >= 3 ? '#f1f2f6' : '#2d3436'; this.box(u, v, z, 0.12, 0.18, era >= 2 ? 0.07 : 0.05, col, { top: this.shade(col, era >= 3 ? -0.08 : 0.15) }); const sc = this.iso(u + 0.06, v + 0.05, z + (era >= 2 ? 0.07 : 0.05)); ctx.fillStyle = era >= 2 ? '#74b9ff' : '#55efc4'; ctx.fillRect(sc.x - s * 0.03, sc.y - s * 0.02, s * 0.06, s * 0.03); if (era === 1) { const a = this.iso(u, v + 0.15, z + 0.02), b = this.iso(u - 0.15, v + 0.3, z); ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(b.x, a.y, b.x, b.y); ctx.stroke(); } },
  deskPhone(u, v, z) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u, v, z, 0.24, 0.2, 0.07, '#cdbfa0', { top: '#ddd2b8', right: '#a99c7f' }); this.box(u + 0.02, v + 0.03, z + 0.07, 0.2, 0.07, 0.05, '#b8ab8c', { top: '#c9bd9f' });
    const a = P(0.02, 0.07, 0.09), b = P(-0.03, 0.2, 0.0); ctx.strokeStyle = '#8c7f63'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); for (let k = 1; k <= 9; k++) { const t = k / 9; ctx.lineTo(a.x + (b.x - a.x) * t + Math.sin(k * 2.4) * 2.2, a.y + (b.y - a.y) * t + s * 0.06 * Math.sin(t * Math.PI) + Math.cos(k * 2.4) * 1.4); } ctx.stroke(); },
  readingTower(u, v, z) { const s = this.scale(); const ctx = this.ctx; const b = this.iso(u + 0.1, v + 0.1, z), t = this.iso(u + 0.1, v + 0.1, z + 0.52); ctx.fillStyle = '#636e72'; ctx.beginPath(); ctx.ellipse(b.x, b.y, s * 0.08, s * 0.04, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#636e72'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke();
    const cols = ['#2d3436', '#8e44ad', '#c0392b', '#0984e3', '#e67e22', '#16a085']; for (let r = 0; r < 3; r++) { const q = this.iso(u + 0.1, v + 0.1, z + 0.14 + r * 0.13); this.glasses(q.x - s * 0.07, q.y, s * 0.028, cols[r * 2], 0.5); this.glasses(q.x + s * 0.07, q.y, s * 0.028, cols[r * 2 + 1], -0.5); } },
  accessories(u, v, z) { this.box(u, v, z, 0.1, 0.08, 0.05, '#e84393'); this.box(u + 0.11, v, z, 0.1, 0.08, 0.05, '#0984e3'); this.box(u + 0.05, v, z + 0.05, 0.1, 0.08, 0.05, '#fdcb6e'); this.box(u + 0.24, v + 0.01, z, 0.04, 0.04, 0.13, '#74b9ff', { top: '#ffffff' }); },
  lcBox(u, v, z) { this.box(u + 0.03, v + 0.04, z, 0.07, 0.07, 0.08, '#00b894'); this.box(u + 0.11, v + 0.04, z, 0.07, 0.07, 0.08, '#0984e3'); this.box(u + 0.19, v + 0.04, z, 0.07, 0.07, 0.08, '#fd79a8'); this.box(u, v, z, 0.3, 0.16, 0.17, 'rgba(225,242,250,0.45)', { top: 'rgba(245,252,255,0.55)', right: 'rgba(190,220,235,0.45)', left: 'rgba(215,238,248,0.45)', line: 'rgba(60,90,110,0.5)' }); },
  /* mesa de trabajo: madera oscura (90), haya (2000s), blanca con patas metálicas (2013+); el ordenador y el teléfono también según la época */
  drawDesk(dk, occupied, idx) { const s = this.scale(); const ctx = this.ctx; const u = dk.u, v = dk.v; const E = this.env(); this.shadow(u, v, 1.7, 1.1, 0.8);
    const dc = E.era === 0 ? ['#a7774d', '#c8996a', '#7c5532', '#916440', '#6b4a2a'] : E.era >= 2 ? ['#e9e5de', '#f7f5f1', '#bdb6aa', '#d9d2c7', '#7f8c8d'] : ['#c89a5b', '#e2b97a', '#8f6a35', '#b08248', '#7a5a2a'];
    this.box(u, v, 0, 1.7, 1.0, 0.72, dc[0], { top: dc[1], right: dc[2], left: dc[3] });
    // patas visibles
    const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); ctx.strokeStyle = dc[4]; ctx.lineWidth = E.era >= 2 ? 2 : 3; for (const [a, b] of [[0.05, 0.95], [1.65, 0.95], [1.65, 0.05]]) { const p = P(a, b, 0), q = P(a, b, 0.72); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }
    // teclado y ratón (lado de la persona) y el monitor delante, de espaldas a la cámara
    this.box(u + 0.55, v + 0.07, 0.72, 0.62, 0.24, E.era >= 2 ? 0.02 : 0.04, E.era === 0 ? '#ddd3bb' : '#dfe3e6', { top: E.era === 0 ? '#ece5d2' : '#f3f5f6' }); const mo = P(1.42, 0.2, 0.75); ctx.fillStyle = E.era === 0 ? '#e2d9c3' : '#eef0f2'; ctx.beginPath(); ctx.ellipse(mo.x, mo.y, s * 0.045, s * 0.03, 0, 0, 7); ctx.fill();
    this.drawComputer(u + 0.95, v + 0.36, 0.72, E.era, occupied, false, true);
    // teléfono: de cable en la primera mesa (90), móvil (2000s) o smartphone (2013+)
    if (E.era === 0) { if (!idx) this.deskPhone(u + 0.1, v + 0.1, 0.72); }
    else { const ph = P(0.2, 0.48, 0.73); ctx.fillStyle = E.era === 1 ? '#7f8c8d' : '#1e272e'; ctx.fillRect(ph.x - s * 0.035, ph.y - s * 0.05, s * 0.07, s * 0.1); ctx.fillStyle = E.era === 1 ? '#b8e994' : '#74b9ff'; ctx.fillRect(ph.x - s * 0.025, ph.y - s * 0.04, s * 0.05, E.era === 1 ? s * 0.035 : s * 0.075); }
    const cup = P(0.25, 0.75, 0.72); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.ellipse(cup.x, cup.y - s * 0.03, s * 0.045, s * 0.03, 0, 0, 7); ctx.fill(); ctx.fillRect(cup.x - s * 0.045, cup.y - s * 0.1, s * 0.09, s * 0.07); ctx.fillStyle = '#ff7b6b'; ctx.beginPath(); ctx.ellipse(cup.x, cup.y - s * 0.1, s * 0.045, s * 0.03, 0, 0, 7); ctx.fill();
    const gl = P(0.5, 0.72, 0.74); this.glasses(gl.x, gl.y, s * 0.05, ['#444', '#8e44ad', '#c0392b', '#16a085'][idx % 4], 0.5);
    if (!occupied) { const m = P(0.85, 0.5, 1.5); ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.font = `${Math.max(9, s * 0.11)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('puesto libre', m.x, m.y); } },
  /* ordenador según la época (bu,bv = esquina del monitor sobre la mesa a altura z). Devuelve q(fu,fz) → punto de la pantalla principal (0..1) */
  drawComputer(bu, bv, z, era, on, raw, back) { const s = this.scale(); let sq; const scr = [];
    const retro = era === 0 && this.env().retro;
    if (retro) { // máquina de escribir con la hoja puesta (antes de 1982)
      this.box(bu + 0.02, bv + 0.02, z, 0.56, 0.42, 0.1, '#2f4a3a', { top: '#3f5f4b', right: '#243a2d' }); this.box(bu + 0.06, bv + 0.3, z + 0.1, 0.48, 0.1, 0.06, '#1f3328', { top: '#2c4637' });
      this.box(bu + 0.1, bv + 0.33, z + 0.16, 0.4, 0.02, 0.02, '#c9c9c9'); sq = { u0: bu + 0.14, u1: bu + 0.46, v: bv + 0.34, z0: z + 0.17, z1: z + 0.5 }; scr.push(sq); }
    else if (era === 0) { // PC de sobremesa beige con monitor de tubo encima
      this.box(bu - 0.04, bv - 0.08, z, 0.68, 0.6, 0.12, '#d3cab2', { top: '#e4dcc8', right: '#b3aa92' }); const fl = this.iso(bu + 0.42, bv + 0.52, z + 0.06); this.ctx.fillStyle = '#6d6650'; this.ctx.fillRect(fl.x - s * 0.06, fl.y - 1, s * 0.1, 2);
      this.box(bu + 0.02, bv - 0.04, z + 0.12, 0.56, 0.48, 0.44, '#ddd4bd', { top: '#ebe5d4', right: '#bab096' }); sq = { u0: bu + 0.09, u1: bu + 0.51, v: bv + 0.445, z0: z + 0.2, z1: z + 0.5 }; scr.push(sq); }
    else if (era === 1) { // monitor plano 4:3 con marco plateado
      this.box(bu + 0.18, bv, z, 0.24, 0.18, 0.02, '#8a9097'); this.box(bu + 0.27, bv + 0.05, z + 0.02, 0.06, 0.05, 0.12, '#8a9097'); this.box(bu, bv + 0.04, z + 0.1, 0.6, 0.07, 0.46, '#bfc4c9', { top: '#dde1e4', right: '#9aa0a6' }); sq = { u0: bu + 0.04, u1: bu + 0.56, v: bv + 0.115, z0: z + 0.14, z1: z + 0.52 }; scr.push(sq); }
    else if (era === 2) { // panorámico fino
      this.box(bu + 0.2, bv + 0.02, z, 0.2, 0.14, 0.015, '#c8ccd0'); this.box(bu + 0.28, bv + 0.05, z, 0.04, 0.03, 0.2, '#c8ccd0'); this.box(bu - 0.12, bv + 0.07, z + 0.12, 0.84, 0.025, 0.42, back ? '#5b636b' : '#1b1e22', { top: back ? '#7d868e' : '#2a2e33' }); sq = { u0: bu - 0.1, u1: bu + 0.7, v: bv + 0.1, z0: z + 0.14, z1: z + 0.52 }; scr.push(sq); }
    else { // doble pantalla sin marcos
      for (const du of [-0.24, 0.32]) { this.box(bu + du + 0.22, bv + 0.05, z, 0.04, 0.03, 0.18, '#8e959c'); this.box(bu + du + 0.12, bv + 0.02, z, 0.24, 0.12, 0.012, '#8e959c'); this.box(bu + du, bv + 0.07, z + 0.12, 0.5, 0.02, 0.36, back ? '#c9ced3' : '#121417', { top: back ? '#e4e7ea' : '#1f2226', right: back ? '#9aa1a8' : undefined }); scr.push({ u0: bu + du + 0.01, u1: bu + du + 0.49, v: bv + 0.092, z0: z + 0.13, z1: z + 0.47 }); } sq = scr[0]; }
    const mk = S => (fu, fz) => this.iso(S.u0 + (S.u1 - S.u0) * fu, S.v, S.z0 + (S.z1 - S.z0) * fz); const q = mk(sq);
    if (back) { const ctx = this.ctx; scr.forEach(S => { const Q = mk(S); if (era === 0) { ctx.strokeStyle = 'rgba(90,80,60,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let i = 0; i < 4; i++) { const a = Q(0.25, 0.35 + i * 0.12), b = Q(0.75, 0.35 + i * 0.12); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); } ctx.stroke(); } else { const c = Q(0.5, 0.55); ctx.fillStyle = era === 1 ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.25)'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.025, s * 0.02, 0, 0, 7); ctx.fill(); } if (on) { const g = Q(0.5, 1.02); ctx.fillStyle = era >= 2 ? 'rgba(120,200,255,0.25)' : 'rgba(150,230,200,0.2)'; ctx.beginPath(); ctx.ellipse(g.x, g.y - s * 0.02, s * 0.2, s * 0.05, 0, 0, 7); ctx.fill(); } }); return q; }
    if (raw) return q;
    scr.forEach((S, n) => { const Q = mk(S); const rect = (f0, f1, g0, g1, col, line) => this.poly([Q(f0, g0), Q(f1, g0), Q(f1, g1), Q(f0, g1)], col, line);
      if (retro) { rect(0, 1, 0, 1, '#fbf8ee', '#b9b2a0'); if (on) for (let i = 0; i < 5; i++) rect(0.12, 0.88 - (i % 3) * 0.12, 0.82 - i * 0.12, 0.86 - i * 0.12, '#7a7466'); return; }
      if (!on) { rect(0, 1, 0, 1, '#1b262e', '#111'); return; }
      if (era === 0) { rect(0, 1, 0, 1, '#0b7f7f', '#222'); rect(0.15, 0.8, 0.22, 0.82, '#c3c3c3'); rect(0.15, 0.8, 0.72, 0.82, '#0a1f8f'); rect(0.22, 0.6, 0.48, 0.54, '#7a7a7a'); rect(0.22, 0.7, 0.34, 0.4, '#7a7a7a'); }
      else if (era === 1) { rect(0, 1, 0.35, 1, '#4f93e0', '#111'); rect(0, 1, 0.08, 0.35, '#5aa83a'); rect(0, 1, 0, 0.08, '#2459c4'); rect(0, 0.18, 0, 0.08, '#3c9a3c'); rect(0.28, 0.8, 0.3, 0.84, '#f0f0f0'); rect(0.28, 0.8, 0.76, 0.84, '#2a62d8'); }
      else if (era === 2) { rect(0, 1, 0, 1, '#f5f6fa', '#111'); rect(0.06, 0.3, 0.55, 0.9, '#00a8ff'); rect(0.36, 0.62, 0.55, 0.9, '#e84118'); rect(0.68, 0.94, 0.55, 0.9, '#4cd137'); rect(0.06, 0.94, 0.3, 0.38, '#dcdde1'); rect(0.06, 0.7, 0.12, 0.2, '#dcdde1'); }
      else { rect(0, 1, 0, 1, '#1e272e', '#000'); if (n === 0) { rect(0.08, 0.6, 0.75, 0.82, '#00cec9'); rect(0.08, 0.8, 0.6, 0.67, '#fdcb6e'); rect(0.14, 0.7, 0.45, 0.52, '#a29bfe'); rect(0.08, 0.5, 0.3, 0.37, '#fd79a8'); } else { for (let i = 0; i < 5; i++) rect(0.1 + i * 0.17, 0.2 + i * 0.17, 0.1, 0.25 + ((i * 37) % 60) / 100, '#00cec9'); } }
    });
    return q; },
  /* silla de oficina detrás de la mesa, mirando a la cámara */
  drawDeskChair(dk) { const u = dk.u + 0.23, v = dk.v - 0.58, col = '#2c3e50'; const s = this.scale(); const ctx = this.ctx; const b = this.iso(u + 0.27, v + 0.28, 0), sp = this.iso(u + 0.27, v + 0.28, 0.4);
    ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(b.x, b.y + 2, s * 0.24, s * 0.11, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#2f3640'; ctx.lineWidth = Math.max(2, s * 0.03); ctx.beginPath(); for (let a = 0; a < 5; a++) { const q = this.iso(u + 0.27 + Math.cos(a * 1.257) * 0.26, v + 0.28 + Math.sin(a * 1.257) * 0.26, 0.03); ctx.moveTo(b.x, b.y - 2); ctx.lineTo(q.x, q.y); } ctx.stroke();
    ctx.fillStyle = '#7f8c8d'; ctx.fillRect(b.x - 2, sp.y, 4, b.y - sp.y);
    this.box(u + 0.04, v, 0.52, 0.46, 0.09, 0.46, '#34495e', { top: '#5d7389', line: 'rgba(0,0,0,0.5)' }); this.box(u, v + 0.06, 0.4, 0.54, 0.5, 0.09, col, { top: this.shade(col, 0.2), line: 'rgba(0,0,0,0.5)' }); },
  drawChair(u, v, dir, col, office) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz);
    if (office) { const b = P(0.3, 0.3, 0); ctx.fillStyle = '#2f3640'; ctx.beginPath(); ctx.ellipse(b.x, b.y, s * 0.22, s * 0.11, 0, 0, 7); ctx.fill(); ctx.fillRect(b.x - 2, b.y - s * 0.42, 4, s * 0.42); this.box(u + 0.05, v + 0.05, 0.42, 0.5, 0.5, 0.08, col, { top: this.shade(col, 0.25) }); this.box(u + 0.05, v + 0.42, 0.5, 0.5, 0.1, 0.5, col, { top: this.shade(col, 0.25) }); return; }
    this.box(u + 0.05, v + 0.05, 0.4, 0.5, 0.5, 0.06, col, { top: this.shade(col, 0.3) }); const back = dir === 1 ? [u + 0.05, v + 0.05, 0.5, 0.1] : dir === 2 ? [u + 0.05, v + 0.05, 0.1, 0.5] : [u + 0.5, v + 0.05, 0.1, 0.5]; this.box(back[0], back[1], 0.46, back[2], back[3], 0.45, col, { top: this.shade(col, 0.3) });
    ctx.strokeStyle = this.shade(col, -0.35); ctx.lineWidth = 2; for (const [a, b] of [[0.08, 0.5], [0.5, 0.5], [0.5, 0.08]]) { const p = P(a, b, 0), q = P(a, b, 0.4); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); } },
  drawLowTable(u, v) { this.shadow(u, v, 1, 0.8, 0.6); this.box(u, v, 0.32, 1, 0.8, 0.06, '#b0612c', { top: '#d08a4a' }); const s = this.scale(); const ctx = this.ctx; const p = this.iso(u + 0.5, v + 0.4, 0.4); ctx.fillStyle = '#fff'; ctx.fillRect(p.x - s * 0.12, p.y - s * 0.07, s * 0.24, s * 0.14); ctx.fillStyle = '#e67e22'; ctx.fillRect(p.x - s * 0.1, p.y - s * 0.05, s * 0.08, s * 0.1); },
  drawSofa(u, v) { this.shadow(u, v, 1.8, 0.8); this.box(u, v, 0, 1.8, 0.8, 0.35, '#5b7ea8', { top: '#7f9fc4' }); this.box(u, v, 0.35, 1.8, 0.2, 0.4, '#4a6b93', { top: '#6f8fb8' }); this.box(u, v, 0.35, 0.15, 0.8, 0.2, '#4a6b93'); this.box(u + 1.65, v, 0.35, 0.15, 0.8, 0.2, '#4a6b93'); },
  drawPlant(u, v, xmas) { const s = this.scale(); const ctx = this.ctx; this.shadow(u, v, 0.6, 0.6, 0.5);
    if (xmas) { // abeto de Navidad con bolas y estrella
      this.box(u + 0.14, v + 0.14, 0, 0.32, 0.32, 0.22, '#c0392b', { top: '#5a3a1a' }); const p = this.iso(u + 0.3, v + 0.3, 0.22);
      for (let k = 0; k < 3; k++) { const w = s * (0.3 - k * 0.07), y0 = p.y - k * s * 0.17, y1 = y0 - s * 0.32; ctx.fillStyle = k % 2 ? '#27ae60' : '#1e8449'; ctx.beginPath(); ctx.moveTo(p.x - w, y0); ctx.lineTo(p.x + w, y0); ctx.lineTo(p.x, y1); ctx.closePath(); ctx.fill(); }
      const balls = [[-0.16, -0.05, '#e74c3c'], [0.14, -0.08, '#f1c40f'], [-0.06, -0.22, '#3498db'], [0.09, -0.3, '#e74c3c'], [-0.04, -0.42, '#f1c40f']]; for (const [dx, dy, c] of balls) { ctx.fillStyle = c; ctx.beginPath(); ctx.arc(p.x + dx * s, p.y + dy * s, Math.max(1.5, s * 0.025), 0, 7); ctx.fill(); }
      const st = { x: p.x, y: p.y - s * 0.68 }; ctx.fillStyle = '#f1c40f'; ctx.beginPath(); for (let i = 0; i < 10; i++) { const r = i % 2 ? s * 0.025 : s * 0.06; const a = -Math.PI / 2 + i * Math.PI / 5; ctx.lineTo(st.x + Math.cos(a) * r, st.y + Math.sin(a) * r); } ctx.closePath(); ctx.fill(); return; }
    this.box(u + 0.12, v + 0.12, 0, 0.36, 0.36, 0.3, '#b05a2b', { top: '#5a3a1a' }); const p = this.iso(u + 0.3, v + 0.3, 0.3); ctx.fillStyle = '#2e8b57'; for (let i = 0; i < 7; i++) { const a = i * 0.9 + 0.3; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(a); ctx.beginPath(); ctx.ellipse(s * 0.16, -s * 0.06, s * 0.17, s * 0.06, 0, 0, 7); ctx.fillStyle = i % 2 ? '#2e8b57' : '#3fa66b'; ctx.fill(); ctx.restore(); } },
  drawStandDisplay(u, v, kind, variant) { const s = this.scale(); const ctx = this.ctx; this.shadow(u, v, 0.8, 0.8, 0.6); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz);
    if (kind === 'rotativo') { const sun = variant === 'sun'; this.box(u + 0.25, v + 0.25, 0, 0.3, 0.3, 0.08, '#444', { top: '#666' }); const base = P(0.4, 0.4, 0.08), top = P(0.4, 0.4, 1.62); const rot = this.time / 2500; const cols = ['#222', '#c0392b', '#16a085', '#f39c12', '#8e44ad', '#2c3e50'];
      const items = []; for (let r = 0; r < 4; r++) { const z = 0.42 + r * 0.3; for (let k = 0; k < 5; k++) { const a = rot + k * Math.PI * 2 / 5 + r * 0.6; items.push({ a, z, r, k, d: Math.sin(a) + Math.cos(a) }); } }
      const ring = z => { const c = P(0.4, 0.4, z); ctx.fillStyle = 'rgba(120,125,130,0.18)'; ctx.strokeStyle = 'rgba(70,72,76,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.17, s * 0.085, 0, 0, 7); ctx.fill(); ctx.stroke(); };
      const gl = it => { const q = P(0.4 + Math.cos(it.a) * 0.27, 0.4 + Math.sin(it.a) * 0.27, it.z + 0.1); ctx.globalAlpha = it.d < 0 ? 0.55 : 1; this.glasses(q.x, q.y, s * 0.045, cols[(it.k + it.r * 2) % cols.length], Math.cos(it.a) * 0.6, sun ? 'rgba(25,25,35,0.85)' : null); ctx.globalAlpha = 1; };
      for (let r = 0; r < 4; r++) ring(0.42 + r * 0.3); items.filter(i => i.d < 0).forEach(gl);
      ctx.strokeStyle = '#4a4a4a'; ctx.lineWidth = Math.max(2, s * 0.035); ctx.beginPath(); ctx.moveTo(base.x, base.y); ctx.lineTo(top.x, top.y); ctx.stroke(); ctx.fillStyle = '#666'; ctx.beginPath(); ctx.arc(top.x, top.y, Math.max(2, s * 0.03), 0, 7); ctx.fill();
      items.filter(i => i.d >= 0).forEach(gl);
      if (sun) this.sunTopper(top.x, top.y - 2, this.env().summer && !this.env().rain); return; }
    const lux = variant === 'lux'; // vitrina de pie (con la zona de firmas: lacada en negro con filo dorado)
    this.box(u, v, 0, 0.8, 0.8, 0.9, lux ? '#2d3436' : '#f4f0e8', lux ? { top: '#d4ac0d', right: '#1e2427', left: '#2d3436' } : { top: '#fbf9f4', right: '#cfc4ae', left: '#e4dbc8' }); this.box(u + 0.05, v + 0.05, 0.9, 0.7, 0.7, 0.75, 'rgba(190,230,245,0.55)', { top: 'rgba(230,245,250,0.6)', right: 'rgba(160,200,220,0.5)', left: 'rgba(200,230,245,0.5)', line: lux ? 'rgba(212,172,13,0.8)' : 'rgba(60,90,110,0.5)' }); for (let k = 0; k < 3; k++) { const q = P(0.2 + k * 0.2, 0.3 + k * 0.15, 1.05 + k * 0.18); this.glasses(q.x, q.y, s * 0.055, lux ? ['#d4ac0d', '#2d3436', '#b7950b'][k] : ['#222', '#8e44ad', '#e67e22'][k], 0.5); } },
  /* cartel "SOL" sobre un expositor; en temporada, más grande y con halo */
  sunTopper(x, y, hot) { const s = this.scale(); const ctx = this.ctx; const w = s * (hot ? 0.62 : 0.48), h = s * (hot ? 0.21 : 0.16);
    if (hot) { const rg = ctx.createRadialGradient(x, y - h / 2, 0, x, y - h / 2, w); rg.addColorStop(0, 'rgba(255,230,120,0.55)'); rg.addColorStop(1, 'rgba(255,230,120,0)'); ctx.fillStyle = rg; ctx.fillRect(x - w, y - h / 2 - w, w * 2, w * 2); }
    ctx.fillStyle = hot ? '#f9ca24' : '#f6e58d'; ctx.strokeStyle = '#d35400'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(x - w / 2, y - h, w, h, 4); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.arc(x - w * 0.3, y - h / 2, h * 0.28, 0, 7); ctx.fill(); ctx.fillStyle = '#7f3b08'; ctx.font = `bold ${Math.max(8, Math.round(h * 0.62))}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('SOL', x + w * 0.1, y - h * 0.26); },
  /* expositor de gafas de sol (zona de sol de la tienda; en verano, destacado) */
  drawSunStand(u, v, hot) { const s = this.scale(); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.shadow(u, v, 0.8, 0.8, 0.6);
    this.box(u, v, 0, 0.8, 0.8, 0.55, '#f4f0e8', { top: '#fbf9f4', right: '#cfc4ae', left: '#e4dbc8' });
    this.box(u + 0.08, v + 0.25, 0.55, 0.64, 0.12, 1.0, '#fdf3d8', { top: '#fffaf0', right: '#e6d3a3', left: '#f6e7c1' });
    for (let r = 0; r < 3; r++) for (let k = 0; k < 2; k++) { const q = P(0.27 + k * 0.28, 0.37, 0.78 + r * 0.27); this.glasses(q.x, q.y, s * 0.055, ['#222', '#c0392b', '#8e44ad', '#16a085', '#d35400', '#2c3e50'][(r * 2 + k) % 6], 0.5, 'rgba(25,25,35,0.85)'); }
    const t = P(0.4, 0.37, 1.6); this.sunTopper(t.x, t.y - 2, hot); },
  drawVitrina(z) { const E = this.env(); const zs = this.info('tienda').zoneIds || []; const n = Math.max(1, Math.round(z.w)); for (let i = 0; i < n; i++) { if (i === 0 && (E.summer || zs.indexOf('sol') >= 0)) this.drawSunStand(z.u + i, z.v, E.summer && !E.rain); else this.drawStandDisplay(z.u + i, z.v, 'vitrina', zs.indexOf('lujo') >= 0 ? 'lux' : null); } },
  /* gabinete: cada instrumento comprado (sceneInfo.owned) se ve: lámpara de hendidura y caja de pruebas, unidad de refracción con foróptero
     manual o digital, mesa de pre-examen (autorrefractómetro, tonómetro, topógrafo, retinógrafo, OCT…), campímetro y pantalla de optotipos */
  PRE_EXAM: { oct: 1, retinografo_no_midriatico: 1, aberrometro_multidiagnostico: 1, topografo_corneal: 1, autorrefractometro_queratometro: 1, tonometro_aire: 1 },
  drawGabinete(z, equipped, info) { const s = this.scale(); const ctx = this.ctx; const u = z.u, v = z.v; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz);
    let own = info.owned || info.instruments || []; if (!own.length && equipped && !(info.tier > 0)) own = ['unidad_refraccion', 'foropter_manual', 'lampara_hendidura']; const has = id => own.indexOf(id) >= 0;
    // tabique de cristal
    if (z.glass) { const g1 = P(0, z.d, 0), g2 = P(z.w, z.d, 0), g3 = P(z.w, z.d, 1.6), g4 = P(0, z.d, 1.6); this.poly([g1, g2, g3, g4], 'rgba(170,215,235,0.35)', 'rgba(60,90,110,0.7)', 2); const m1 = P(z.w, 0, 0), m2 = P(z.w, z.d, 0), m3 = P(z.w, z.d, 1.6), m4 = P(z.w, 0, 1.6); this.poly([m1, m2, m3, m4], 'rgba(170,215,235,0.3)', 'rgba(60,90,110,0.7)', 2); ctx.fillStyle = 'rgba(40,60,80,0.85)'; ctx.font = `bold ${Math.max(8, s * 0.1)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; const lab = P(z.w / 2, z.d, 1.75); ctx.fillText('GABINETE', lab.x, lab.y); }
    // mesa de instrumentos: caja de pruebas y lámpara de hendidura
    const slit = has('lampara_hendidura') || has('lampara_hendidura_digital'), trial = has('caja_pruebas_gafa_prueba');
    if (slit || trial) { this.box(u + 0.2, v + 0.2, 0, 0.9, 0.6, 0.7, '#eceff1', { top: '#f8f9fa' }); if (trial) this.trialCase(u + 0.24, v + 0.3, 0.7); if (slit) this.slitLamp(u + 0.6, v + 0.24, 0.7, has('lampara_hendidura_digital')); }
    // sillón de refracción (unidad) o silla de exploración
    const unit = has('unidad_refraccion'); const col = equipped ? '#2c3e50' : '#8d9aa5'; this.shadow(u + 0.6, v + 0.6, 1, 1, 0.8);
    if (unit) { this.box(u + 0.7, v + 0.8, 0, 0.8, 0.8, 0.45, col, { top: this.shade(col, 0.2) }); this.box(u + 0.7, v + 1.45, 0.45, 0.8, 0.15, 0.7, col, { top: this.shade(col, 0.2) }); this.box(u + 0.7, v + 0.8, 0.45, 0.12, 0.8, 0.2, col); this.box(u + 1.38, v + 0.8, 0.45, 0.12, 0.8, 0.2, col); }
    else { const cc = equipped ? '#6d4c41' : '#8d9aa5'; const lp = (a, b) => { const p = P(a, b, 0), q = P(a, b, 0.4); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke(); }; ctx.strokeStyle = '#4e342e'; ctx.lineWidth = 2; lp(0.85, 1.45); lp(1.35, 1.45); lp(1.35, 0.95); this.box(u + 0.8, v + 0.9, 0.4, 0.6, 0.6, 0.06, cc, { top: this.shade(cc, 0.25) }); this.box(u + 0.8, v + 1.42, 0.46, 0.6, 0.08, 0.5, cc, { top: this.shade(cc, 0.25) }); }
    // columna, brazo y foróptero (manual: gris oscuro; digital: blanco con pantallas)
    if (unit) { this.box(u + 1.7, v + 0.2, 0, 0.35, 0.35, 1.5, '#bdc3c7', { top: '#e3e6e8' }); const arm = P(1.6, 0.5, 1.45), armb = P(1.2, 1.1, 1.35); ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(arm.x, arm.y); ctx.lineTo(armb.x, armb.y); ctx.stroke(); const f = armb;
      if (has('foropter_digital')) { ctx.fillStyle = '#f5f6fa'; ctx.strokeStyle = '#95a5a6'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.roundRect(f.x - s * 0.24, f.y - s * 0.13, s * 0.48, s * 0.22, 6); ctx.fill(); ctx.stroke(); ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(f.x - s * 0.1, f.y - s * 0.02, s * 0.055, 0, 7); ctx.arc(f.x + s * 0.1, f.y - s * 0.02, s * 0.055, 0, 7); ctx.fill(); ctx.fillStyle = '#74b9ff'; ctx.fillRect(f.x - s * 0.04, f.y - s * 0.11, s * 0.08, s * 0.04); }
      else if (has('foropter_manual')) { ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.roundRect(f.x - s * 0.22, f.y - s * 0.12, s * 0.44, s * 0.2, 4); ctx.fill(); ctx.fillStyle = '#9ad7ff'; ctx.beginPath(); ctx.arc(f.x - s * 0.1, f.y - s * 0.02, s * 0.05, 0, 7); ctx.arc(f.x + s * 0.1, f.y - s * 0.02, s * 0.05, 0, 7); ctx.fill(); }
      else { ctx.fillStyle = '#7f8c8d'; ctx.beginPath(); ctx.arc(f.x, f.y, s * 0.05, 0, 7); ctx.fill(); } }
    // mesa de pre-examen con los dos aparatos más importantes
    const devs = this.SHOW.gabinete.map(x => x[0]).filter(id => this.PRE_EXAM[id] && has(id)).slice(0, 2);
    if (devs.length) { const bu = u + z.w - 0.82, bv = v + 0.9; this.shadow(bu, bv, 0.66, 1.0, 0.6); this.box(bu, bv, 0, 0.66, 1.0, 0.7, '#dfe6e9', { top: '#f1f2f6' }); devs.forEach((id, i) => this.preExam(bu + 0.12, bv + 0.08 + i * 0.48, 0.7, id)); }
    if (has('campimetro') && z.d >= 2.5) this.campimeter(u + 1.6, v + 1.92);
    if (equipped) { const E = this.env(); this.shadow(u + 0.15, v + 1.75, 0.75, 0.5, 0.5); this.box(u + 0.15, v + 1.75, 0, 0.75, 0.5, 0.7, '#f1f2f6', { top: '#ffffff', right: '#d5dbe0' }); this.drawComputer(u + 0.22, v + 1.78, 0.7, E.era, true); }
    if (!equipped) { const m = P(z.w / 2, z.d / 2, 1.9); ctx.fillStyle = 'rgba(0,0,0,0.5)'; ctx.font = `${Math.max(9, s * 0.1)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('gabinete sin equipar', m.x, m.y); } },
  slitLamp(u, v, z, dig) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u, v, z, 0.46, 0.4, 0.06, '#d5dbe0', { top: '#eef1f4' }); // mesa de la lámpara
    this.box(u + 0.16, v + 0.1, z + 0.06, 0.12, 0.12, 0.22, '#5f6b75'); this.box(u + 0.12, v + 0.03, z + 0.28, 0.2, 0.22, 0.08, '#2d3436', { top: '#3d4448' }); this.box(u + 0.14, v + 0.0, z + 0.36, 0.05, 0.05, 0.07, '#1e272e'); this.box(u + 0.24, v + 0.0, z + 0.36, 0.05, 0.05, 0.07, '#1e272e'); // microscopio y oculares
    this.box(u + 0.36, v + 0.12, z + 0.06, 0.05, 0.05, 0.5, '#8395a7'); this.box(u + 0.33, v + 0.09, z + 0.56, 0.11, 0.11, 0.09, '#ecf0f1', { top: '#ffffff' }); // torre de iluminación
    const a = P(0.385, 0.2, 0.56), b = P(0.24, 0.36, 0.34); ctx.strokeStyle = 'rgba(255,240,150,0.85)'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    this.box(u + 0.02, v + 0.34, z + 0.06, 0.04, 0.04, 0.42, '#9aa5ae'); this.box(u + 0.4, v + 0.34, z + 0.06, 0.04, 0.04, 0.42, '#9aa5ae'); this.box(u + 0.02, v + 0.34, z + 0.46, 0.42, 0.04, 0.03, '#9aa5ae'); // mentonera
    if (dig) { this.box(u + 0.2, v + 0.08, z + 0.43, 0.07, 0.07, 0.06, '#111'); this.box(u + 0.1, v - 0.02, z + 0.62, 0.3, 0.02, 0.17, '#111', { top: '#222' }); const c1 = P(0.13, -0.0, 0.65), c2 = P(0.37, -0.0, 0.76); ctx.fillStyle = '#e17055'; ctx.fillRect(Math.min(c1.x, c2.x), Math.min(c1.y, c2.y), Math.abs(c2.x - c1.x), Math.abs(c2.y - c1.y) * 0.6); } },
  trialCase(u, v, z) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.poly([P(0, 0, 0.05), P(0.28, 0, 0.05), P(0.28, 0, 0.3), P(0, 0, 0.3)], '#8d6e63', 'rgba(40,20,10,0.5)'); this.box(u, v, z, 0.28, 0.3, 0.05, '#6d4c41', { top: '#4e342e' });
    ctx.fillStyle = '#cfd8dc'; for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) { const q = P(0.05 + i * 0.09, 0.05 + j * 0.065, 0.05); ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.02, s * 0.012, 0, 0, 7); ctx.fill(); } },
  preExam(u, v, z, id) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    const big = id === 'oct' || id === 'retinografo_no_midriatico' || id === 'aberrometro_multidiagnostico'; const col = id === 'retinografo_no_midriatico' ? '#3d4852' : '#f1f2f6';
    const acc = { oct: '#0984e3', aberrometro_multidiagnostico: '#6c5ce7', retinografo_no_midriatico: '#00cec9', topografo_corneal: '#e17055', autorrefractometro_queratometro: '#0984e3', tonometro_aire: '#00b894' }[id] || '#0984e3'; const h = big ? 0.34 : 0.26;
    this.box(u, v, z, 0.42, 0.38, 0.05, '#b2bec3', { top: '#dfe6e9' }); this.box(u + 0.06, v + 0.05, z + 0.05, 0.3, 0.28, h, col, { top: this.shade(col, 0.15), right: this.shade(col, -0.2) });
    this.poly([P(0.06, 0.33, 0.1), P(0.36, 0.33, 0.1), P(0.36, 0.33, 0.14), P(0.06, 0.33, 0.14)], acc);
    this.poly([P(0.36, 0.1, 0.14), P(0.36, 0.28, 0.14), P(0.36, 0.28, 0.05 + h - 0.04), P(0.36, 0.1, 0.05 + h - 0.04)], '#1e272e'); // pantalla en el lado del óptico
    if (id === 'topografo_corneal') { const c = P(0.21, 0.33, 0.05 + h * 0.6); ctx.lineWidth = 1.2; for (let k = 3; k >= 1; k--) { ctx.strokeStyle = k % 2 ? '#2d3436' : '#ffffff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.025 * k, s * 0.03 * k, 0, 0, 7); ctx.stroke(); } }
    else { const c = P(0.21, 0.33, 0.05 + h * 0.62); ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(c.x, c.y, s * (id === 'tonometro_aire' ? 0.02 : 0.035), 0, 7); ctx.fill(); }
    if (id === 'oct') { this.box(u + 0.38, v + 0.02, z + 0.05, 0.03, 0.03, 0.42, '#7f8c8d'); this.box(u + 0.37, v - 0.06, z + 0.47, 0.03, 0.3, 0.2, '#111', { top: '#222' }); const c = P(0.4, 0.09, 0.57); ctx.strokeStyle = '#ff7675'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(c.x - s * 0.06, c.y + s * 0.03); ctx.quadraticCurveTo(c.x, c.y - s * 0.04, c.x + s * 0.06, c.y); ctx.stroke(); } },
  campimeter(u, v) { const s = this.scale(); const ctx = this.ctx; this.shadow(u, v, 0.5, 0.45, 0.6); this.box(u + 0.05, v + 0.05, 0, 0.4, 0.35, 0.65, '#dfe6e9', { top: '#f1f2f6' }); this.box(u, v, 0.65, 0.5, 0.4, 0.5, '#f5f6fa', { top: '#ffffff', right: '#d5dbe0' });
    const c = this.iso(u + 0.25, v + 0.4, 0.9); const g = ctx.createRadialGradient(c.x, c.y, 1, c.x, c.y, s * 0.17); g.addColorStop(0, '#ffffff'); g.addColorStop(1, '#b2bec3'); ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.15, s * 0.17, 0, 0, 7); ctx.fill(); ctx.strokeStyle = '#636e72'; ctx.lineWidth = 1.5; ctx.stroke(); ctx.fillStyle = '#ffeaa7'; ctx.beginPath(); ctx.arc(c.x + s * 0.04, c.y - s * 0.03, 1.5, 0, 7); ctx.fill(); },
  /* cabina audiométrica insonorizada con ventanuco y puerta */
  drawAudioBooth(u, v) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.shadow(u, v, 1, 1, 0.8);
    this.box(u, v, 0, 1.0, 1.0, 1.35, '#dfe6ec', { top: '#eef3f6', right: '#c3ccd3', left: '#d5dde3' });
    ctx.fillStyle = 'rgba(90,110,125,0.35)'; for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const q = P(0.1 + i * 0.25, 1.0, 0.2 + j * 0.18); ctx.fillRect(q.x - 1, q.y - 1, 2, 2); }
    this.poly([P(0.12, 1.0, 0.72), P(0.62, 1.0, 0.72), P(0.62, 1.0, 1.12), P(0.12, 1.0, 1.12)], 'rgba(150,200,225,0.8)', '#7f8c8d', 2); const r1 = P(0.2, 1.0, 1.08), r2 = P(0.32, 1.0, 0.78); ctx.strokeStyle = 'rgba(255,255,255,0.7)'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(r1.x, r1.y); ctx.lineTo(r2.x, r2.y); ctx.stroke();
    this.poly([P(1.0, 0.22, 0.02), P(1.0, 0.8, 0.02), P(1.0, 0.8, 1.2), P(1.0, 0.22, 1.2)], '#b8c4cc', '#7f8c8d', 1.5); const hd = P(1.0, 0.72, 0.62); ctx.fillStyle = '#636e72'; ctx.fillRect(hd.x - 1.5, hd.y - s * 0.06, 3, s * 0.12);
    const lp = P(1.0, 0.5, 1.28); ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(lp.x, lp.y, Math.max(2, s * 0.025), 0, 7); ctx.fill();
    const t = P(0.5, 1.0, 1.2); ctx.save(); ctx.translate(t.x, t.y); ctx.transform(1, 0.5, 0, 1, 0, 0); ctx.fillStyle = '#1f3a5f'; ctx.font = `bold ${Math.max(7, Math.round(s * 0.085))}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText('AUDIOLOGÍA', 0, 0); ctx.restore(); },
  /* taller: banco con lo comprado (sceneInfo.owned): tornillo y limas, fresadora CNC de sobremesa, bombo, impresora 3D;
     en el suelo, bombos en serie o industriales y máquinas grandes (centro CNC, multihusillo, inyectora, SLS, micro-inyectora) */
  drawTaller(z, info) { const s = this.scale(); const ctx = this.ctx; const u = z.u, v = z.v; const tier = info.tier || 0; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); const own = info.owned || info.machines || []; const has = id => own.indexOf(id) >= 0; const busy = !!info.busy;
    this.shadow(u, v, z.w, z.d, 0.7);
    this.box(u, v, 0, Math.min(2.2, z.w), 0.9, 0.8, '#8d6e4a', { top: '#b08c60', right: '#5f4630' });
    // tornillo de banco / herramientas
    this.box(u + 0.2, v + 0.3, 0.8, 0.3, 0.25, 0.25, '#555', { top: '#777' }); if (has('kit_manual')) { const t1 = P(0.35, 0.72, 0.82); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t1.x + s * 0.12, t1.y - s * 0.05); ctx.moveTo(t1.x + s * 0.03, t1.y + s * 0.04); ctx.lineTo(t1.x + s * 0.15, t1.y); ctx.stroke(); }
    if (has('bombo_hobby')) { this.box(u + 0.6, v + 0.25, 0.8, 0.34, 0.32, 0.05, '#5d4037'); this.drum(u + 0.77, v + 0.52, 1.02, 0.13, 0.24, '#a1887f', this.time / (busy ? 500 : 1400)); }
    if (has('fdm_prototipos')) { const fu = u + 1.0, fv = v + 0.48; this.box(fu, fv, 0.8, 0.26, 0.26, 0.03, '#2d3436'); this.box(fu, fv + 0.22, 0.83, 0.03, 0.03, 0.3, '#2d3436'); this.box(fu + 0.23, fv + 0.22, 0.83, 0.03, 0.03, 0.3, '#2d3436'); this.box(fu, fv + 0.22, 1.13, 0.26, 0.03, 0.03, '#2d3436'); this.box(fu + 0.09, fv + 0.08, 0.83, 0.08, 0.08, 0.06 + (busy ? 0.04 * Math.abs(Math.sin(this.time / 2000)) : 0.04), '#e67e22'); }
    // fresadora CNC de sobremesa (3018 de aficionado o rígida de fundición) con husillo girando
    const bench = has('fresadora_rigida') ? 'rigid' : has('cnc3018') ? 'hobby' : null;
    if (bench) { const rigid = bench === 'rigid'; this.box(u + 1.3, v + 0.15, 0.8, 0.8, 0.6, rigid ? 0.2 : 0.12, rigid ? '#455a64' : '#95a5a6', { top: rigid ? '#607d8b' : '#bdc3c7' }); const sp = P(1.7, 0.45, rigid ? 1.25 : 1.15); const spin = this.time / 120; ctx.strokeStyle = '#34495e'; ctx.lineWidth = rigid ? 6 : 4; ctx.beginPath(); ctx.moveTo(sp.x, sp.y - s * 0.25); ctx.lineTo(sp.x, sp.y); ctx.stroke(); ctx.fillStyle = '#e67e22'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, s * 0.06 + Math.sin(spin) * 1, s * 0.03, 0, 0, 7); ctx.fill(); if (busy) { ctx.fillStyle = 'rgba(255,200,80,0.8)'; for (let i = 0; i < 3; i++) { const a = spin * 3 + i * 2.1; ctx.beginPath(); ctx.arc(sp.x + Math.cos(a) * s * 0.1, sp.y + Math.sin(a) * s * 0.05, 1.5, 0, 7); ctx.fill(); } } }
    // suelo: bombos delante a la izquierda y máquinas grandes en los huecos libres
    const drums = has('bombos_industriales') ? 'ind' : has('bombos_serie') ? 'serie' : null; const cabs = ['cnc_multihusillo', 'inyectora_150t', 'sls_fuse', 'cnc_optica_3ejes', 'babyplast'].filter(has);
    const slots = []; if (z.w >= 3) slots.push({ u: 2.4, v: 0.1, w: 0.9, d: 0.9 }); if (z.d >= 1.8) slots.push({ u: 1.3, v: 1.1, w: 0.95, d: 0.75 }); if (z.d >= 1.8 && !drums) slots.push({ u: 0.15, v: 1.1, w: 0.95, d: 0.75 });
    const jobs = cabs.slice(0, slots.length).map((id, i) => ({ id, sl: slots[i] })); if (drums && z.d >= 1.8) jobs.push({ id: drums, sl: { u: 0.15, v: 1.1, w: 0.95, d: 0.75 } }); jobs.sort((a, b) => (a.sl.u + a.sl.v) - (b.sl.u + b.sl.v));
    for (const j of jobs) this.tallerMachine(j.id, u + j.sl.u, v + j.sl.v, j.sl.w, j.sl.d, busy);
    ctx.fillStyle = 'rgba(40,30,20,0.75)'; ctx.font = `bold ${Math.max(8, s * 0.1)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; const lab = P(z.w / 2, z.d + 0.2, 0); ctx.fillText('TALLER' + (tier ? ' · nivel ' + tier : ''), lab.x, lab.y + 12); },
  tallerMachine(id, u, v, w, d, busy) { const s = this.scale(); const ctx = this.ctx;
    if (id === 'bombos_serie' || id === 'bombos_industriales') { const ind = id === 'bombos_industriales'; const r = ind ? 0.25 : 0.19; this.shadow(u, v, w, d, 0.6); this.box(u, v + 0.1, 0, w, d - 0.15, 0.16, '#4e342e', { top: '#6d4c41' }); const n = 2; for (let i = 0; i < n; i++) { const cu = u + (i + 0.5) * w / n; this.box(cu - 0.03, v + 0.15, 0.16, 0.06, 0.06, r + 0.12, '#3e2723'); this.drum(cu, v + d - 0.12, r + 0.32, r, d - 0.35, ind ? '#8d6e63' : '#a1887f', this.time / (busy ? 450 : 1300) + i); } return; }
    if (id === 'cnc_optica_3ejes') return this.cabinet(u, v, Math.min(w, 0.85), Math.min(d, 0.72), 1.15, '#eceff1', { stripe: '#e67e22', win: '#2d3436', spin: true, screen: '#74b9ff' });
    if (id === 'cnc_multihusillo') { this.cabinet(u, v, w / 2 - 0.03, d, 1.3, '#546e7a', { stripe: '#f1c40f', win: '#263238', spin: true }); return this.cabinet(u + w / 2 + 0.03, v, w / 2 - 0.03, d, 1.3, '#546e7a', { stripe: '#f1c40f', win: '#263238', spin: true, screen: '#55efc4' }); }
    if (id === 'sls_fuse') return this.cabinet(u, v, Math.min(w, 0.8), Math.min(d, 0.72), 1.2, '#f5f6fa', { win: '#2d3436', glow: busy ? 0.45 + 0.3 * Math.sin(this.time / 300) : 0.25, glowCol: '#ff9f43', screen: '#55efc4' });
    if (id === 'inyectora_150t') { this.shadow(u, v, w, d, 0.6); this.box(u, v + 0.15, 0, w, d - 0.15, 0.55, '#1565c0', { top: '#1e88e5', right: '#0d47a1' }); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.poly([P(0, d, 0.08), P(w, d, 0.08), P(w, d, 0.14), P(0, d, 0.14)], '#f1c40f'); this.box(u + w * 0.6, v + 0.3, 0.55, 0.22, 0.22, 0.35, '#90a4ae', { top: '#cfd8dc' }); const sc = P(w, d * 0.5, 0.4); ctx.fillStyle = busy ? '#ffeb3b' : '#90a4ae'; ctx.fillRect(sc.x - s * 0.06, sc.y - s * 0.05, s * 0.12, s * 0.08); return; }
    if (id === 'babyplast') { this.shadow(u + 0.1, v + 0.1, 0.5, 0.45, 0.6); this.box(u + 0.1, v + 0.1, 0, 0.5, 0.45, 0.45, '#78909c', { top: '#90a4ae' }); this.box(u + 0.15, v + 0.15, 0.45, 0.4, 0.3, 0.3, '#0984e3', { top: '#74b9ff' }); }
  },
  /* armario de máquina con ventana frontal (herramienta girando o brillo), franja y pantalla lateral */
  cabinet(u, v, w, d, h, col, o) { o = o || {}; const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.shadow(u, v, w, d, 0.6);
    // zócalo oscuro y carrocería
    this.box(u, v, 0, w, d, 0.08, this.shade(col, -0.45)); this.box(u, v, 0.08, w, d, h - 0.08, col, { top: this.shade(col, 0.2), right: this.shade(col, -0.22) });
    if (o.stripe) this.poly([P(0, d, h * 0.86), P(w, d, h * 0.86), P(w, d, h * 0.91), P(0, d, h * 0.91)], o.stripe);
    if (o.win) { // puerta de cristal grande con el interior a la vista (mesa y husillo), marco y tirador
      const x0 = w * 0.08, x1 = w * 0.72, z0 = h * 0.24, z1 = h * 0.8; const wq = [P(x0, d, z0), P(x1, d, z0), P(x1, d, z1), P(x0, d, z1)];
      this.poly(wq, this.shade(o.win, 0.1), 'rgba(0,0,0,0.6)', 1.5);
      this.poly([P(x0 + 0.03, d, z0 + 0.03), P(x1 - 0.03, d, z0 + 0.03), P(x1 - 0.03, d, z0 + (z1 - z0) * 0.25), P(x0 + 0.03, d, z0 + (z1 - z0) * 0.25)], '#7f8c8d'); // mesa de trabajo
      if (o.spin) { const top = P((x0 + x1) / 2, d, z1 - 0.02), tip = P((x0 + x1) / 2, d, z0 + (z1 - z0) * 0.42); ctx.strokeStyle = '#b2bec3'; ctx.lineWidth = Math.max(2, s * 0.03); ctx.beginPath(); ctx.moveTo(top.x, top.y); ctx.lineTo(tip.x, tip.y); ctx.stroke(); const a = this.time / 90; ctx.strokeStyle = '#e67e22'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tip.x - Math.cos(a) * s * 0.035, tip.y + 2); ctx.lineTo(tip.x + Math.cos(a) * s * 0.035, tip.y + 2); ctx.stroke(); }
      if (o.glow) { ctx.save(); ctx.globalAlpha = Math.max(0, Math.min(1, o.glow)); this.poly(wq, o.glowCol || '#ffb142'); ctx.restore(); }
      ctx.save(); ctx.globalAlpha = 0.35; this.poly([P(x0 + 0.04, d, z1 - 0.04), P(x0 + (x1 - x0) * 0.35, d, z1 - 0.04), P(x0 + 0.04, d, z0 + (z1 - z0) * 0.45)], '#ffffff'); ctx.restore(); // reflejo
      const hd = P(x1 - 0.05, d, (z0 + z1) / 2), hd2 = P(x1 - 0.05, d, (z0 + z1) / 2 + 0.12); ctx.strokeStyle = '#dfe6e9'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(hd.x, hd.y); ctx.lineTo(hd2.x, hd2.y); ctx.stroke(); }
    // panel de control (pantalla y botonera) en el frontal derecho
    const px0 = w * 0.76, px1 = w * 0.96; this.poly([P(px0, d, h * 0.42), P(px1, d, h * 0.42), P(px1, d, h * 0.8), P(px0, d, h * 0.8)], '#2d3436', 'rgba(0,0,0,0.5)');
    if (o.screen || o.win) this.poly([P(px0 + 0.02, d, h * 0.62), P(px1 - 0.02, d, h * 0.62), P(px1 - 0.02, d, h * 0.77), P(px0 + 0.02, d, h * 0.77)], o.screen || '#74b9ff');
    const b1 = P(px0 + (px1 - px0) * 0.3, d, h * 0.52), b2 = P(px0 + (px1 - px0) * 0.7, d, h * 0.52); ctx.fillStyle = '#e74c3c'; ctx.beginPath(); ctx.arc(b1.x, b1.y, Math.max(1.5, s * 0.014), 0, 7); ctx.fill(); ctx.fillStyle = '#2ecc71'; ctx.beginPath(); ctx.arc(b2.x, b2.y, Math.max(1.5, s * 0.014), 0, 7); ctx.fill();
    // torre de luces en las máquinas industriales
    if (h >= 1.0 && (o.stripe || o.spin)) { const t = P(w * 0.88, d * 0.2, h); this.box(u + w * 0.86, v + d * 0.18, h, 0.04, 0.04, 0.12, '#636e72'); [['#e74c3c', 0.12], ['#f39c12', 0.19], ['#2ecc71', 0.26]].forEach(([c, z]) => { const q = P(w * 0.88, d * 0.2, h + z); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.025, s * 0.03, 0, 0, 7); ctx.fill(); }); } },
  /* bombo octogonal de pulido girando sobre un eje horizontal (eje a lo largo de v; la tapa visible mira a +v) */
  drum(cu, cv, cz, r, len, col, rot) { const ctx = this.ctx; const front = [], back = []; for (let k = 0; k < 8; k++) { const a = rot + k * Math.PI / 4 + Math.PI / 8; const du = Math.cos(a) * r, dz = Math.sin(a) * r; front.push(this.iso(cu + du, cv, cz + dz)); back.push(this.iso(cu + du, cv - len, cz + dz)); }
    const dark = this.shade(col, -0.3); this.poly(back, dark); ctx.fillStyle = dark; for (let k = 0; k < 8; k++) { const k2 = (k + 1) % 8; ctx.beginPath(); ctx.moveTo(front[k].x, front[k].y); ctx.lineTo(front[k2].x, front[k2].y); ctx.lineTo(back[k2].x, back[k2].y); ctx.lineTo(back[k].x, back[k].y); ctx.closePath(); ctx.fill(); }
    this.poly(front, col, 'rgba(40,25,10,0.6)', 1.2); const c = this.iso(cu, cv, cz); ctx.strokeStyle = 'rgba(60,35,15,0.55)'; ctx.lineWidth = 1; ctx.beginPath(); for (let k = 0; k < 8; k += 2) { ctx.moveTo(c.x, c.y); ctx.lineTo(front[k].x, front[k].y); } ctx.stroke(); },
  /* laboratorio: en el banco la biseladora (2D de ocasión o 3D), trazador, frontofocómetro (manual/digital) y tintadora;
     en el suelo el generador freeform, la cámara de antirreflejante o la línea automatizada */
  drawLab(z, info) { const s = this.scale(); const ctx = this.ctx; const u = z.u, v = z.v; const tier = info.tier || 0; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); const own = info.owned || info.machines || []; const has = id => own.indexOf(id) >= 0; const busy = !!info.busy;
    this.shadow(u, v, z.w, z.d, 0.7); const bw = Math.min(2.4, z.w); this.box(u, v, 0, bw, 0.9, 0.85, '#eceff1', { top: '#fafafa', right: '#b0bec5' }); const T = 0.85;
    if (has('biseladora_auto_3d')) this.edger(u + 0.15, v + 0.2, T, true, busy); else if (has('biseladora_manual_usada')) this.edger(u + 0.15, v + 0.2, T, false, busy);
    else { this.box(u + 0.25, v + 0.3, T, 0.5, 0.35, 0.05, '#90caf9', { top: '#bbdefb' }); ctx.fillStyle = 'rgba(255,255,255,0.9)'; for (let k = 0; k < 4; k++) { const q = P(0.33 + (k % 2) * 0.2, 0.4 + Math.floor(k / 2) * 0.15, T + 0.05); ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.04, s * 0.02, 0, 0, 7); ctx.fill(); } }
    if (has('trazador_bloqueador')) { this.box(u + 1.06, v + 0.3, T, 0.26, 0.3, 0.2, '#f1f2f6', { top: '#ffffff', right: '#c8d0d6' }); const c = P(1.19, 0.45, T + 0.2); ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.07, s * 0.035, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#74b9ff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.045, s * 0.022, 0, 0, 7); ctx.fill(); }
    if (has('frontofocometro_digital')) { this.box(u + 1.42, v + 0.3, T, 0.28, 0.28, 0.42, '#f1f2f6', { top: '#ffffff', right: '#c8d0d6' }); this.poly([P(1.46, 0.58, T + 0.2), P(1.66, 0.58, T + 0.2), P(1.66, 0.58, T + 0.38), P(1.46, 0.58, T + 0.38)], '#74b9ff', '#2d3436'); }
    else if (has('frontofocometro_manual')) this.box(u + 1.42, v + 0.3, T, 0.28, 0.28, 0.6, '#607d8b', { top: '#90a4ae' });
    if (has('tintadora') && bw >= 2.2) { this.box(u + 1.82, v + 0.25, T, 0.45, 0.4, 0.16, '#b0bec5', { top: '#cfd8dc' }); ['#8d5524', '#636e72', '#2e8b57'].forEach((c, k) => { const q = P(1.92 + k * 0.12, 0.45, T + 0.16); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(q.x, q.y, s * 0.045, s * 0.022, 0, 0, 7); ctx.fill(); }); }
    const floor = ['linea_modular_freeform', 'coater_industrial', 'camara_ar_pequena', 'generador_freeform'].filter(has); const slots = [{ u: 0, v: 1.0, w: 1.45, d: 0.85 }]; if (z.w >= 3.2 && z.d >= 2) slots.push({ u: 1.65, v: 1.05, w: 1.6, d: 0.9 });
    floor.slice(0, slots.length).forEach((id, i) => this.labMachine(id, u + slots[i].u, v + slots[i].v, slots[i].w, slots[i].d, busy));
    ctx.fillStyle = 'rgba(40,30,20,0.75)'; ctx.font = `bold ${Math.max(8, s * 0.1)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; const lab = P(z.w / 2, z.d + 0.2, 0); ctx.fillText('LABORATORIO' + (tier ? ' · nivel ' + tier : ''), lab.x, lab.y + 12); },
  edger(u, v, z, modern, busy) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    if (modern) { this.box(u, v, z, 0.85, 0.58, 0.42, '#f5f6fa', { top: '#ffffff', right: '#c8d0d6', left: '#e6eaee' }); this.poly([P(0.08, 0.08, 0.42), P(0.55, 0.08, 0.42), P(0.55, 0.5, 0.42), P(0.08, 0.5, 0.42)], 'rgba(40,50,60,0.75)'); this.poly([P(0.6, 0.58, 0.18), P(0.8, 0.58, 0.18), P(0.8, 0.58, 0.34), P(0.6, 0.58, 0.34)], '#74b9ff', '#2d3436'); }
    else { this.box(u, v, z, 0.85, 0.58, 0.48, '#d8d0bb', { top: '#e8e2d2', right: '#b3aa92' }); const lid = P(0.42, 0.3, 0.48); ctx.fillStyle = '#90caf9'; ctx.beginPath(); ctx.ellipse(lid.x, lid.y, s * 0.2, s * 0.1, 0, 0, 7); ctx.fill(); }
    if (busy) { const l = P(0.75, 0.58, 0.42); ctx.fillStyle = '#ff7043'; ctx.beginPath(); ctx.arc(l.x, l.y, 2.5 + Math.sin(this.time / 150), 0, 7); ctx.fill(); } },
  labMachine(id, u, v, w, d, busy) { const s = this.scale(); const ctx = this.ctx;
    if (id === 'generador_freeform') return this.cabinet(u, v, Math.min(w, 1.4), d, 1.3, '#78909c', { win: '#263238', spin: busy, screen: '#69f0ae' });
    if (id === 'camara_ar_pequena' || id === 'coater_industrial') { const big = id === 'coater_industrial'; const r = big ? 0.4 : 0.32; const cu = u + r + 0.05, cv = v + d * 0.5; this.shadow(cu - r, cv - r, 2 * r, 2 * r, 0.6); this.cyl(cu, cv, 0, r, big ? 1.35 : 1.1, big ? '#95a5a6' : '#b2bec3'); const p = this.iso(cu + r * 0.5, cv + r * 0.75, big ? 0.75 : 0.6); ctx.save(); ctx.globalAlpha = busy ? 0.6 + 0.35 * Math.sin(this.time / 250) : 0.55; ctx.fillStyle = big ? '#a29bfe' : '#0abde3'; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.08, s * 0.1, 0, 0, 7); ctx.fill(); ctx.restore(); ctx.strokeStyle = '#636e72'; ctx.lineWidth = 2; ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.08, s * 0.1, 0, 0, 7); ctx.stroke(); this.box(u + 2 * r + 0.15, v + 0.1, 0, 0.3, 0.45, 0.9, '#636e72', { top: '#7f8c8d' }); return; }
    if (id === 'linea_modular_freeform') { this.shadow(u, v, w, d, 0.6); this.box(u, v + d * 0.3, 0, w, 0.42, 0.5, '#636e72', { top: '#2d3436' }); this.box(u + 0.1, v + d * 0.2, 0.5, 0.4, 0.55, 0.45, '#b2bec3', { top: '#dfe6e9' }); this.box(u + w - 0.5, v + d * 0.2, 0.5, 0.4, 0.55, 0.45, '#b2bec3', { top: '#dfe6e9' }); ctx.fillStyle = '#81ecec'; for (let i = 0; i < 4; i++) { const t = ((this.time / 2600) + i / 4) % 1; const p = this.iso(u + 0.55 + t * (w - 1.1), v + d * 0.3 + 0.21, 0.5); ctx.beginPath(); ctx.ellipse(p.x, p.y, s * 0.05, s * 0.025, 0, 0, 7); ctx.fill(); } }
  },
  cyl(cu, cv, z, r, h, col) { const s = this.scale(); const ctx = this.ctx; const b = this.iso(cu, cv, z), t = this.iso(cu, cv, z + h); const rx = r * s * 0.707, ry = rx * 0.5;
    ctx.fillStyle = col; ctx.beginPath(); ctx.ellipse(b.x, b.y, rx, ry, 0, 0, 7); ctx.fill(); ctx.fillRect(t.x - rx, t.y, rx * 2, b.y - t.y); ctx.fillStyle = 'rgba(0,0,0,0.13)'; ctx.fillRect(t.x + rx * 0.3, t.y, rx * 0.7, b.y - t.y);
    ctx.fillStyle = this.shade(col, 0.25); ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(t.x, t.y, rx, ry, 0, 0, 7); ctx.fill(); ctx.stroke(); },
  drawMarketing(z, info) { const s = this.scale(); const ctx = this.ctx; const u = z.u, v = z.v; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); const era = this.env().era;
    this.shadow(u, v, z.w, z.d, 0.6); this.box(u, v + 0.2, 0, 1.6, 0.8, 0.72, '#f5f5f5', { top: '#ffffff', right: '#cfcfcf' });
    // ordenador de la época con gráfica de barras animada
    const q = this.drawComputer(u + 0.45, v + 0.32, 0.72, era, true, true); const t = this.time / 1000; const rect = (f0, f1, g0, g1, col, line) => this.poly([q(f0, g0), q(f1, g0), q(f1, g1), q(f0, g1)], col, line);
    if (era === 0 && this.env().retro) { rect(0, 1, 0, 1, '#fbf8ee', '#b9b2a0'); for (let i = 0; i < 5; i++) { const h = 0.15 + 0.6 * Math.abs(Math.sin(t * 0.5 + i)); rect(0.08 + i * 0.18, 0.2 + i * 0.18, 0.08, 0.08 + h, '#7a7466'); } }
    else { rect(0, 1, 0, 1, era === 0 ? '#0b3d2e' : '#ff8a65', '#111'); if (era > 0) rect(0, 1, 0.55, 1, '#ffb74d'); for (let i = 0; i < 5; i++) { const h = 0.15 + 0.6 * Math.abs(Math.sin(t + i)); rect(0.08 + i * 0.18, 0.2 + i * 0.18, 0.08, 0.08 + h, era === 0 ? '#4cd137' : 'rgba(255,255,255,0.9)'); } }
    if (info.campaignActive) { const m = P(0.8, 0.3, 1.5); ctx.fillStyle = '#e74c3c'; ctx.font = `bold ${Math.max(8, s * 0.1)}px sans-serif`; ctx.textAlign = 'center'; ctx.fillText('CAMPAÑA EN MARCHA', m.x, m.y); }
    ctx.fillStyle = 'rgba(40,30,20,0.75)'; ctx.font = `bold ${Math.max(8, s * 0.1)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; const lab = P(z.w / 2, z.d + 0.2, 0); ctx.fillText('MARKETING', lab.x, lab.y + 12); },

  /* ================= personajes ================= */
  /* ================= navegación de clientes: rejilla de 0,25 baldosas con los muebles bloqueados + A* ================= */
  buildNav() {
    const L = this.layout(); const R = L.size; const res = 0.25; const n = Math.ceil(R / res); const blocked = new Uint8Array(n * n); const m = 0.12;
    for (const f of this.furniture(L)) { const r = f.nav || f.rect; if (!r) continue; const i0 = Math.max(0, Math.floor((r.u - m) / res)), i1 = Math.min(n - 1, Math.floor((r.u + r.w + m) / res)), j0 = Math.max(0, Math.floor((r.v - m) / res)), j1 = Math.min(n - 1, Math.floor((r.v + r.d + m) / res)); for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) blocked[i * n + j] = 1; }
    this.nav = { res, n, blocked };
  },
  navFree(i, j) { const N = this.nav; return i >= 0 && j >= 0 && i < N.n && j < N.n && !N.blocked[i * N.n + j]; },
  navCell(p) { const N = this.nav; return [U.clamp(Math.floor(p.u / N.res), 0, N.n - 1), U.clamp(Math.floor(p.v / N.res), 0, N.n - 1)]; },
  navNearest(c) { if (this.navFree(c[0], c[1])) return c; for (let r = 1; r < 12; r++) for (let di = -r; di <= r; di++) for (let dj = -r; dj <= r; dj++) { if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue; if (this.navFree(c[0] + di, c[1] + dj)) return [c[0] + di, c[1] + dj]; } return c; },
  navLine(a, b) { const d = Math.hypot(b.u - a.u, b.v - a.v); const steps = Math.ceil(d / 0.1); for (let k = 0; k <= steps; k++) { const t = steps ? k / steps : 0; const c = this.navCell({ u: a.u + (b.u - a.u) * t, v: a.v + (b.v - a.v) * t }); if (!this.navFree(c[0], c[1])) return false; } return true; },
  findPath(a, b) {
    if (!this.nav) this.buildNav(); const N = this.nav; const n = N.n; const s = this.navNearest(this.navCell(a)), g = this.navNearest(this.navCell(b)); const key = c => c[0] * n + c[1];
    const open = [s]; const came = new Map(); const gS = new Map([[key(s), 0]]); const h = c => { const dx = Math.abs(c[0] - g[0]), dy = Math.abs(c[1] - g[1]); return Math.max(dx, dy) + 0.414 * Math.min(dx, dy); }; const fS = new Map([[key(s), h(s)]]); let guard = 0;
    while (open.length && guard++ < 6000) {
      let bi = 0; for (let i = 1; i < open.length; i++) if (fS.get(key(open[i])) < fS.get(key(open[bi]))) bi = i; const cur = open.splice(bi, 1)[0];
      if (cur[0] === g[0] && cur[1] === g[1]) { const cells = [cur]; let k = key(cur); while (came.has(k)) { const p = came.get(k); cells.unshift(p); k = key(p); } const pts = cells.map(c => ({ u: (c[0] + 0.5) * N.res, v: (c[1] + 0.5) * N.res })); pts[0] = this.navFree(...this.navCell(a)) ? a : pts[0]; pts[pts.length - 1] = this.navFree(...this.navCell(b)) ? b : pts[pts.length - 1]; const out = [pts[0]]; let i = 0; while (i < pts.length - 1) { let j = pts.length - 1; while (j > i + 1 && !this.navLine(pts[i], pts[j])) j--; out.push(pts[j]); i = j; } return out; }
      for (let di = -1; di <= 1; di++) for (let dj = -1; dj <= 1; dj++) { if (!di && !dj) continue; const nb = [cur[0] + di, cur[1] + dj]; if (!this.navFree(nb[0], nb[1])) continue; if (di && dj && (!this.navFree(cur[0] + di, cur[1]) || !this.navFree(cur[0], cur[1] + dj))) continue; const t = gS.get(key(cur)) + (di && dj ? 1.414 : 1); if (t < (gS.has(key(nb)) ? gS.get(key(nb)) : Infinity)) { came.set(key(nb), cur); gS.set(key(nb), t); fS.set(key(nb), t + h(nb)); if (!open.some(o => o[0] === nb[0] && o[1] === nb[1])) open.push(nb); } }
    }
    return [a, b];
  },
  /* orden isométrico real: A va detrás de B si está separado de B hacia el fondo en un eje y no queda "en diagonal" */
  drawSorted(items) {
    const n = items.length; const behind = (A, B) => (A.u + A.w <= B.u + 1e-3 && !(B.v + B.d <= A.v + 1e-3)) || (A.v + A.d <= B.v + 1e-3 && !(B.u + B.w <= A.u + 1e-3));
    const indeg = new Array(n).fill(0); const adj = items.map(() => []);
    for (let i = 0; i < n; i++) { const A = items[i].box; if (!A) continue; for (let j = 0; j < n; j++) { if (i === j) continue; const B = items[j].box; if (!B) continue; if (behind(A, B)) { adj[i].push(j); indeg[j]++; } } }
    const done = new Array(n).fill(false); let left = n;
    while (left > 0) { let pick = -1; for (let i = 0; i < n; i++) if (!done[i] && indeg[i] === 0 && (pick < 0 || items[i].depth < items[pick].depth)) pick = i; if (pick < 0) { for (let i = 0; i < n; i++) if (!done[i] && (pick < 0 || items[i].depth < items[pick].depth)) pick = i; } done[pick] = true; left--; items[pick].draw(); for (const j of adj[pick]) indeg[j]--; }
  },
  placeStaff() {
    if (this.inRoom()) { this._deskOcc = {}; return this.roomStaff(this.layout()); }
    const co = this.co(); const out = []; const deptCount = {}; let deskIdx = 0; const occ = {}; this._deskOcc = occ;
    co.staff.forEach((ch, i) => {
      let pos, pose = 'sit'; let dept = null;
      let uv;
      if (ch.assignment && this.deptZone(ch.assignment) && this.deptAvailable(ch.assignment)) { dept = ch.assignment; const k = deptCount[dept] = (deptCount[dept] || 0); deptCount[dept]++; const z = this.deptZone(dept); const spots = z.stand || [{ u: z.u + z.w / 2, v: z.v + z.d + 0.6 }]; uv = spots[k % spots.length]; pose = dept === 'taller' || dept === 'lab' ? 'work' : 'stand'; }
      let desk = null, dk = null; if (!dept) { const d = this.slots(); const di = deskIdx++; dk = d[Math.min(di, d.length - 1)]; uv = { u: dk.u + 0.5, v: dk.v - 0.3 }; if (di < this.nDesks()) desk = di; }
      pos = this.iso(uv.u, uv.v);
      const e = { ch, x: pos.x, y: pos.y, u: uv.u, v: uv.v, pose, dept, i, depth: uv.u + uv.v, desk, dk }; out.push(e); if (desk !== null) occ[desk] = e;
    });
    return out;
  },
  nDesks() { const co = this.co(); return Math.min(this.layout().desks.length, Math.max(1, (co && co.maxStaff) || 1)); },
  collectDynamic() {
    const items = []; const self = this; const L = this.layout();
    if (L.room) { for (const f of (this.dynItems || [])) items.push(f); for (const p of this._placed) items.push({ depth: p.depth + 0.2, box: { u: p.u - 0.15, v: p.v - 0.15, w: 0.3, d: 0.3 }, draw: () => self.drawStaffMember(p) }); return items.concat(this.roomPatients(L)); }
    // mobiliario dinámico (con partes móviles): expositores giratorios, departamentos
    for (const f of (this.dynItems || [])) items.push(f);
    // personal
    for (const p of this._placed) if (p.desk === null || p.desk === undefined) items.push({ depth: p.depth + 0.2, box: { u: p.u - 0.15, v: p.v - 0.15, w: 0.3, d: 0.3 }, draw: () => self.drawStaffMember(p) });
    // clientes y pacientes
    for (const c of this.customers) items.push({ depth: c.u + c.v + 0.2, box: { u: c.u - 0.15, v: c.v - 0.15, w: 0.3, d: 0.3 }, draw: () => self.drawCustomer(c) });
    const gi = this.info('gabinete'); const gz = this.deptZone('gabinete'); if (gz && (gi.patientsNow || 0) > 0 && this.deptAvailable('gabinete')) { const p = this.iso(gz.u + 1.1, gz.v + 1.2); items.push({ depth: gz.u + gz.v + 2.3 + 0.25, box: { u: gz.u + 0.95, v: gz.v + 1.05, w: 0.3, d: 0.3 }, draw: () => self.drawPerson(p.x, p.y + 2, { skin: 2, hair: 3, shirt: '#8e44ad', female: true, pose: 'sitPlain', scaleK: 0.95, style: self._patientStyle || (self._patientStyle = Object.assign({}, self.styleFor('paciente', true), { glasses: 'round', frame: '#4a4f55' })) }) }); }
    return items;
  },
  OUTFIT: { optico: 'coat', labtech: 'coat', audioprotesista: 'coat', tecnico: 'apron', marketing: 'blazer', dependiente: 'badge' },
  drawStaffMember(p) {
    const ch = p.ch; if (ch.state === 'vacation') return; const working = ch.state === 'working' || ch.state === 'researching' || ch.state === 'training';
    const hl = this.hover && this.hover.type === 'staff' && this.hover.staff === ch; const female = ch.sex === 'female';
    const look = { skin: ch.look % 6, hair: (ch.look + (female ? 2 : 0)) % 6, shirt: this.SHIRT[(ch.look + String(ch.name).length) % 7], female, outfit: this.OUTFIT[ch.role] || null, style: this.styleFor('st' + ch.name, female), pose: p.pose === 'stand' || p.pose === 'work' ? 'stand' : (working ? 'type' : 'sit'), back: p.pose === 'work', anim: this.time / 1000 + p.i, hl, onFire: ch.isOnFire ? ch.isOnFire() : false, tired: ch.flags && ch.flags.needsVacation, thinking: working && ((this.time / 1000 + p.i * 2.7) % 9) < 1.4 };
    p.onFire = look.onFire; this.drawPerson(p.x, p.y, look);
  },
  /* retrato (cabeza y hombros) igual que en la escena, para las fichas de personal y candidatos */
  portrait(o) {
    const key = [o.name, o.look, o.sex, o.role].join('|'); this._pc = this._pc || new Map(); const hit = this._pc.get(key); if (hit) return hit;
    const cv = document.createElement('canvas'); cv.width = cv.height = 96; const c = cv.getContext('2d'); const saved = this.ctx; this.ctx = c; const female = o.sex === 'female'; const look = o.look || 0;
    try { c.beginPath(); c.arc(48, 48, 47, 0, Math.PI * 2); c.clip(); const g = c.createLinearGradient(0, 0, 0, 96); g.addColorStop(0, '#fdf6e8'); g.addColorStop(1, '#e9dcc4'); c.fillStyle = g; c.fillRect(0, 0, 96, 96);
      this.drawPerson(48, 158, { skin: look % 6, hair: (look + (female ? 2 : 0)) % 6, shirt: this.SHIRT[(look + String(o.name).length) % 7], female, outfit: this.OUTFIT[o.role] || null, style: this.styleFor('st' + o.name, female), pose: 'stand', anim: 0.5, scaleK: 1.7 * 90 / this.scale() }); }
    catch (e) { /* sin retrato */ } finally { this.ctx = saved; }
    const url = cv.toDataURL(); if (this._pc.size > 200) this._pc.clear(); this._pc.set(key, url); return url;
  },
  /* nombres e iconos de estado del personal, por encima de todo el mobiliario */
  drawStaffTags() {
    const ctx = this.ctx; const s = this.scale(); const k = s / 90;
    for (const p of this._placed || []) { const ch = p.ch; ctx.save(); ctx.textAlign = 'center';
      if (ch.state === 'vacation') { ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.font = `${Math.max(9, s * 0.11)}px "Segoe UI", sans-serif`; ctx.fillText('🏖️ ' + ch.name.split(' ')[0] + ' (vacaciones)', p.x, p.y - 30 * k); ctx.restore(); continue; }
      const working = ch.state === 'working' || ch.state === 'researching' || ch.state === 'training';
      const np = p.desk !== undefined && p.desk !== null ? (q => ({ x: p.x, y: q.y }))(this.iso(p.dk.u + 0.5, p.dk.v + 0.55, 0.74)) : { x: p.x, y: p.y + 16 * k };
      ctx.font = `600 ${Math.max(10, s * 0.12)}px "Segoe UI", sans-serif`; ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(255,255,255,0.8)'; ctx.fillStyle = '#1b2631'; const nm = ch.name.split(' ')[0]; ctx.strokeText(nm, np.x, np.y); ctx.fillText(nm, np.x, np.y);
      const icon = ch.state === 'researching' ? '🔬' : ch.state === 'training' ? '🎓' : (ch.state === 'idle' && !ch.assignment ? '💤' : ''); if (icon) { ctx.font = `${Math.max(11, s * 0.14)}px sans-serif`; ctx.fillText(icon, p.x + 22 * k, p.y - 88 * k); }
      if (ch.isOnFire && ch.isOnFire()) { ctx.font = `${Math.max(11, s * 0.14)}px sans-serif`; ctx.fillText('🔥', p.x - 22 * k, p.y - 88 * k); }
      if (ch.efficiency < 0.5 && working) { ctx.font = `${Math.max(9, s * 0.1)}px "Segoe UI", sans-serif`; ctx.fillStyle = '#c0392b'; ctx.fillText(Math.round(ch.efficiency * 100) + ' %', np.x, np.y + 12 * k); }
      ctx.restore(); }
  },
  /* rasgos estables de cada persona (peinado, gafas, ropa) a partir de una semilla: siempre se ve igual */
  STYLE_CACHE: new Map(),
  styleFor(seed, female) {
    const key = seed + '|' + (female ? 1 : 0); let st = this.STYLE_CACHE.get(key); if (st) return st;
    let h = 2166136261; const str = String(seed) + (female ? 'f' : 'm'); for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    const r = () => { h ^= h << 13; h ^= h >>> 17; h ^= h << 5; return ((h >>> 0) % 10007) / 10007; }; const pick = a => a[Math.floor(r() * a.length)];
    const hairStyle = female ? pick(['long', 'bob', 'pony', 'bun', 'curly', 'long', 'bob']) : pick(['crop', 'part', 'curly', 'buzz', 'quiff', 'part']);
    let glasses = r() < 0.85 ? pick(['round', 'rect', 'cat', 'browline', 'aviator', 'rect', 'round', 'panto']) : null; if (glasses === 'cat' && !female) glasses = 'browline';
    st = { hairStyle, glasses, frame: pick(['#2c3e50', '#1d1d1d', '#8e5a2b', '#c0392b', '#b7950b', '#7f8c8d', '#6c3483', '#16a085', '#1d1d1d']), pants: pick(['#34495e', '#2d3436', '#4a3b2c', '#3d5a80', '#5d6d7e', '#2c3e50']), beard: !female && r() < 0.3, skirt: female && r() < 0.35, collar: pick(['v', 'polo', 'round', 'shirt']), shoes: pick(['#2c2c2c', '#5b3a29', '#7f8c8d', '#2c2c2c']) };
    if (this.STYLE_CACHE.size > 400) this.STYLE_CACHE.clear(); this.STYLE_CACHE.set(key, st); return st;
  },
  /* persona estilo GDT: cabeza grande, cuerpo corto; poses: type (sentado tecleando), sit, stand, walk, sitPlain.
     o: skin, hair, shirt, female, pose, anim, hl, onFire, tired, thinking, scaleK, outfit ('coat'|'apron'|'blazer'|'badge'), style (styleFor), bag */
  drawPerson(x, y, o) {
    const ctx = this.ctx; const s = this.scale(); const k = (s / 90) * (o.scaleK || 1); const skin = this.SKIN[o.skin % 6], hair = this.HAIR[o.hair % 6], shirt = o.shirt || '#2980b9'; const t = o.anim || this.time / 1000;
    const st = o.style || this.styleFor((o.skin || 0) + '-' + (o.hair || 0) + '-' + shirt, o.female);
    const sitting = o.pose === 'type' || o.pose === 'sit' || o.pose === 'sitPlain'; const walk = o.pose === 'walk'; const back = !!o.back;
    const bob = back ? Math.abs(Math.sin(t * 3.2)) * 0.8 * k : o.pose === 'type' ? Math.sin(t * 9) * 0.8 * k : walk ? Math.abs(Math.sin(t * 8)) * 2 * k : Math.sin(t * 1.6) * 0.35 * k;
    const line = 'rgba(40,28,22,0.75)', lw = Math.max(0.8, 1.15 * k);
    const fs = fill => { ctx.fillStyle = fill; ctx.fill(); ctx.lineWidth = lw; ctx.strokeStyle = line; ctx.stroke(); };
    const rr = (x0, y0, w, h, r) => { ctx.beginPath(); ctx.roundRect(x0, y0, w, h, r); };
    const ell = (cx, cy, rx, ry) => { ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2); };
    ctx.save(); ctx.translate(x, y); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    if (o.hl) { ctx.fillStyle = 'rgba(255,214,102,0.75)'; ell(0, 4, 26 * k, 10 * k); ctx.fill(); }
    ctx.fillStyle = 'rgba(0,0,0,0.2)'; ell(0, 2, 15 * k, 5.5 * k); ctx.fill();
    ctx.translate(0, -bob);
    const bodyTop = sitting ? -47 * k : -52 * k, bodyH = sitting ? 31 * k : 30 * k, hy = bodyTop - 14 * k; const coat = o.outfit === 'coat';
    const shirtL = this.shade(shirt, 0.2), shirtD = this.shade(shirt, -0.2); const hairD = this.shade(hair, -0.25);
    /* pelo de detrás (melena, media melena, coleta, rizos) */
    ctx.fillStyle = hair;
    if (back) { /* de espaldas: el pelo largo cae por delante del cuerpo, se dibuja después */ }
    else if (st.hairStyle === 'long') { rr(-17.5 * k, hy - 9 * k, 35 * k, 31 * k, [10 * k, 10 * k, 6 * k, 6 * k]); fs(hair); }
    else if (st.hairStyle === 'bob') { rr(-17.5 * k, hy - 9 * k, 35 * k, 23 * k, [10 * k, 10 * k, 7 * k, 7 * k]); fs(hair); }
    else if (st.hairStyle === 'pony') { ctx.save(); ctx.translate(15 * k, hy + 3 * k); ctx.rotate(0.35); ell(0, 0, 5.5 * k, 12 * k); fs(hair); ctx.restore(); }
    else if (st.hairStyle === 'curly' && o.female) { for (const [cx, cy] of [[-14, 4], [14, 4], [-15, 12], [15, 12], [-12, 18], [12, 18]]) { ell(cx * k, hy + cy * k, 6.5 * k, 6.5 * k); fs(hair); } }
    /* piernas */
    const pants = st.pants;
    if (!sitting) {
      const sw = walk ? Math.sin(t * 8) * 5 * k : 0;
      if (st.skirt) { ctx.strokeStyle = '#3b3030'; ctx.lineWidth = 4.5 * k; ctx.beginPath(); ctx.moveTo(-5 * k + sw * 0.3, -14 * k); ctx.lineTo(-5 * k + sw * 0.3, -1 * k); ctx.moveTo(5 * k - sw * 0.3, -14 * k); ctx.lineTo(5 * k - sw * 0.3, -1 * k); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(-11 * k, -26 * k); ctx.lineTo(11 * k, -26 * k); ctx.lineTo(14 * k, -12 * k); ctx.lineTo(-14 * k, -12 * k); ctx.closePath(); fs(pants); }
      else { const g = ctx.createLinearGradient(-9 * k, 0, 9 * k, 0); g.addColorStop(0, this.shade(pants, 0.15)); g.addColorStop(1, this.shade(pants, -0.15));
        rr(-9 * k + sw * 0.3, -25 * k, 8.5 * k, 25 * k, 3 * k); fs(g); rr(0.5 * k - sw * 0.3, -25 * k, 8.5 * k, 25 * k, 3 * k); fs(g); }
      for (const [sx, d] of [[-5, 1], [5, -1]]) { ell(sx * k + d * sw * 0.3, 0.5 * k, 6.2 * k, 3.2 * k); fs(st.shoes); ctx.fillStyle = 'rgba(255,255,255,0.25)'; ell(sx * k + d * sw * 0.3 - 1.5 * k, -0.6 * k, 2.4 * k, 1 * k); ctx.fill(); }
    } else {
      if (o.pose === 'sitPlain') { rr(-9 * k, -9 * k, 7 * k, 9 * k, 2 * k); fs(st.skirt ? '#3b3030' : pants); rr(2 * k, -9 * k, 7 * k, 9 * k, 2 * k); fs(st.skirt ? '#3b3030' : pants); ell(-5.5 * k, 0.5 * k, 5.5 * k, 2.8 * k); fs(st.shoes); ell(5.5 * k, 0.5 * k, 5.5 * k, 2.8 * k); fs(st.shoes); }
      rr(-12 * k, -18 * k, 24 * k, 12 * k, 5 * k); fs(st.skirt ? shirtD : pants);
    }
    /* torso con volumen (luz desde la izquierda) */
    const tg = ctx.createLinearGradient(-13 * k, 0, 13 * k, 0);
    if (coat) { tg.addColorStop(0, '#ffffff'); tg.addColorStop(0.65, '#f1f4f6'); tg.addColorStop(1, '#d5dde3'); } else { tg.addColorStop(0, shirtL); tg.addColorStop(0.6, shirt); tg.addColorStop(1, shirtD); }
    rr(-13.5 * k, bodyTop, 27 * k, bodyH, [10 * k, 10 * k, 4 * k, 4 * k]); fs(tg);
    if (back) { ctx.strokeStyle = coat ? 'rgba(80,95,105,0.4)' : 'rgba(0,0,0,0.15)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(0, bodyTop + 4 * k); ctx.lineTo(0, bodyTop + bodyH); ctx.stroke();
      if (o.outfit === 'apron') { ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 2 * k; ctx.beginPath(); ctx.moveTo(-9 * k, bodyTop + 1 * k); ctx.lineTo(8 * k, bodyTop + 18 * k); ctx.moveTo(9 * k, bodyTop + 1 * k); ctx.lineTo(-8 * k, bodyTop + 18 * k); ctx.stroke(); ctx.fillStyle = '#8d6e63'; ell(-3 * k, bodyTop + 19 * k, 3 * k, 2 * k); ctx.fill(); ell(3 * k, bodyTop + 19 * k, 3 * k, 2 * k); ctx.fill(); } }
    else if (coat) { // bata: camisa en pico, solapas, bolsillo con bolígrafo
      ctx.beginPath(); ctx.moveTo(-5 * k, bodyTop + 1 * k); ctx.lineTo(0, bodyTop + 11 * k); ctx.lineTo(5 * k, bodyTop + 1 * k); ctx.closePath(); fs(shirt);
      ctx.strokeStyle = 'rgba(80,95,105,0.55)'; ctx.lineWidth = lw; ctx.beginPath(); ctx.moveTo(-5 * k, bodyTop + 1 * k); ctx.lineTo(-1 * k, bodyTop + 14 * k); ctx.lineTo(-1 * k, bodyTop + bodyH); ctx.moveTo(5 * k, bodyTop + 1 * k); ctx.lineTo(1 * k, bodyTop + 14 * k); ctx.stroke();
      rr(-11 * k, bodyTop + 13 * k, 7 * k, 6 * k, 1.5 * k); ctx.strokeStyle = 'rgba(80,95,105,0.5)'; ctx.stroke(); ctx.strokeStyle = '#2e86de'; ctx.lineWidth = 1.4 * k; ctx.beginPath(); ctx.moveTo(-6 * k, bodyTop + 10.5 * k); ctx.lineTo(-6 * k, bodyTop + 15 * k); ctx.stroke();
      ctx.fillStyle = '#b2bec3'; for (const by of [17, 23]) { ell(2.5 * k, bodyTop + by * k, 1 * k, 1 * k); ctx.fill(); }
    } else {
      if (st.collar === 'v') { ctx.beginPath(); ctx.moveTo(-4.5 * k, bodyTop + 0.5 * k); ctx.lineTo(0, bodyTop + 7 * k); ctx.lineTo(4.5 * k, bodyTop + 0.5 * k); ctx.closePath(); fs(skin); }
      else if (st.collar === 'round') { ctx.beginPath(); ctx.ellipse(0, bodyTop + 0.5 * k, 5 * k, 3.5 * k, 0, 0, Math.PI); fs(skin); }
      else { const cc = st.collar === 'shirt' ? '#ffffff' : shirtL; for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(0, bodyTop + 1 * k); ctx.lineTo(d * 7 * k, bodyTop - 0.5 * k); ctx.lineTo(d * 4 * k, bodyTop + 5.5 * k); ctx.closePath(); fs(cc); } ctx.fillStyle = shirtD; for (const by of [6, 11]) { ell(0, bodyTop + by * k, 0.9 * k, 0.9 * k); ctx.fill(); } }
      if (o.outfit === 'apron') { rr(-9.5 * k, bodyTop + 9 * k, 19 * k, bodyH - 8 * k, 3 * k); fs('#8d6e63'); ctx.strokeStyle = '#6d4c41'; ctx.lineWidth = 1.6 * k; ctx.beginPath(); ctx.moveTo(-7 * k, bodyTop + 9 * k); ctx.lineTo(-9 * k, bodyTop + 1 * k); ctx.moveTo(7 * k, bodyTop + 9 * k); ctx.lineTo(9 * k, bodyTop + 1 * k); ctx.stroke(); rr(-4 * k, bodyTop + 15 * k, 8 * k, 5 * k, 1 * k); ctx.strokeStyle = 'rgba(60,40,30,0.6)'; ctx.lineWidth = lw; ctx.stroke(); }
      if (o.outfit === 'blazer') { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 13.5 * k, bodyTop + 6 * k); ctx.quadraticCurveTo(d * 13.5 * k, bodyTop, d * 6 * k, bodyTop + 0.5 * k); ctx.lineTo(d * 1.5 * k, bodyTop + 15 * k); ctx.lineTo(d * 3 * k, bodyTop + bodyH); ctx.lineTo(d * 13.5 * k, bodyTop + bodyH); ctx.closePath(); fs(d < 0 ? '#3d4a5c' : '#2c3644'); } }
      if (o.outfit === 'badge') { rr(4.5 * k, bodyTop + 8 * k, 6.5 * k, 3.6 * k, 1 * k); fs('#f6e58d'); ctx.fillStyle = '#F47A20'; ctx.fillRect(5.3 * k, bodyTop + 9 * k, 2 * k, 1.6 * k); }
    }
    /* brazos */
    const sleeve = coat ? '#f4f6f8' : o.outfit === 'blazer' ? '#34404f' : shirt; const sleeveD = coat ? '#d5dde3' : this.shade(sleeve, -0.15);
    if (back) { const w1 = Math.sin(t * 5) * 1.5 * k, w2 = Math.cos(t * 4.3) * 1.5 * k; // de espaldas, trabajando con las manos delante
      ctx.save(); ctx.translate(-14.5 * k, bodyTop + 4 * k); ctx.rotate(0.22); rr(-4 * k, 0, 8 * k, 17 * k + w1, 4 * k); fs(sleeve); ctx.restore(); ctx.save(); ctx.translate(14.5 * k, bodyTop + 4 * k); ctx.rotate(-0.22); rr(-4 * k, 0, 8 * k, 17 * k + w2, 4 * k); fs(sleeveD); ctx.restore(); }
    else if (o.pose === 'type') { // brazos hacia el teclado (las manos quedan tras el monitor)
      const h1 = Math.sin(t * 14) * 1.2 * k, h2 = Math.cos(t * 14) * 1.2 * k;
      ctx.save(); ctx.translate(-14 * k, bodyTop + 5 * k); ctx.rotate(0.35); rr(-4 * k, 0, 8 * k, 19 * k + h1, 4 * k); fs(sleeve); ctx.restore();
      ctx.save(); ctx.translate(14 * k, bodyTop + 5 * k); ctx.rotate(-0.35); rr(-4 * k, 0, 8 * k, 19 * k + h2, 4 * k); fs(sleeveD); ctx.restore();
    } else {
      const sw = walk ? Math.sin(t * 8) * 3 * k : 0;
      for (const d of [-1, 1]) { const off = d * sw; ctx.save(); ctx.translate(d * 15.5 * k, bodyTop + 4 * k); ctx.rotate(-d * 0.08 + off * 0.02); rr(-4 * k, 0, 8 * k, sitting ? 17 * k : 20 * k, 4 * k); fs(d < 0 ? sleeve : sleeveD); ell(0, (sitting ? 19 : 22.5) * k, 3.9 * k, 3.9 * k); fs(skin);
        if (o.bag && d > 0) { rr(-5 * k, 23 * k, 10 * k, 11 * k, 1.5 * k); fs('#F47A20'); ctx.strokeStyle = '#a04a0c'; ctx.lineWidth = lw; ctx.beginPath(); ctx.arc(0, 23 * k, 3 * k, Math.PI, 0); ctx.stroke(); ctx.fillStyle = '#fff'; ell(0, 28.5 * k, 2.2 * k, 1.4 * k); ctx.fill(); }
        ctx.restore(); }
    }
    if (back) { // cabeza de espaldas: orejas, nuca y pelo; patillas de las gafas sobre las orejas
      for (const d of [-1, 1]) { ell(d * 14.6 * k, hy + 2 * k, 2.8 * k, 3.8 * k); fs(skin); }
      ell(0, hy, 15 * k, 16 * k); fs(skin); const hs = st.hairStyle; ctx.fillStyle = hair;
      if (hs === 'buzz') { ctx.globalAlpha = 0.6; ell(0, hy - 1 * k, 15.2 * k, 14.5 * k); ctx.fill(); ctx.globalAlpha = 1; }
      else if (hs === 'curly') { for (let a = 0; a < 12; a++) { const r0 = a * Math.PI / 6; ell(Math.cos(r0) * 11 * k, hy - 2 * k + Math.sin(r0) * 11 * k, 6 * k, 6 * k); fs(hair); } ell(0, hy - 2 * k, 10 * k, 10 * k); ctx.fill(); }
      else { ctx.beginPath(); ctx.ellipse(0, hy - 1 * k, 15.8 * k, 15.5 * k, 0, Math.PI * 0.92, Math.PI * 2.08); ctx.quadraticCurveTo(13 * k, hy + 11 * k, 0, hy + 12 * k); ctx.quadraticCurveTo(-13 * k, hy + 11 * k, -15.6 * k, hy + 3 * k); ctx.closePath(); fs(hair);
        if (hs === 'long') { rr(-15.5 * k, hy + 4 * k, 31 * k, 20 * k, 6 * k); fs(hair); } else if (hs === 'bob') { rr(-16 * k, hy + 2 * k, 32 * k, 10 * k, 6 * k); fs(hair); } else if (hs === 'pony') { ell(0, hy + 14 * k, 4.5 * k, 10 * k); fs(hair); ctx.fillStyle = '#e84393'; ell(0, hy + 5 * k, 3 * k, 1.8 * k); ctx.fill(); } else if (hs === 'bun') { ell(0, hy - 13 * k, 6.5 * k, 5.5 * k); fs(hair); }
        ctx.strokeStyle = hairD; ctx.lineWidth = lw * 0.7; ctx.beginPath(); ctx.moveTo(-6 * k, hy - 10 * k); ctx.quadraticCurveTo(0, hy - 4 * k, 6 * k, hy - 10 * k); ctx.stroke(); }
      if (st.glasses) { ctx.strokeStyle = st.frame; ctx.lineWidth = Math.max(0.8, 1.1 * k); ctx.beginPath(); for (const d of [-1, 1]) { ctx.moveTo(d * 15.5 * k, hy + 0.5 * k); ctx.lineTo(d * 13 * k, hy + 1.5 * k); } ctx.stroke(); }
      ctx.restore(); return; }
    /* cabeza: orejas, cara con volumen, pelo, rasgos */
    if (st.hairStyle !== 'long' && st.hairStyle !== 'bob') for (const d of [-1, 1]) { ell(d * 14.6 * k, hy + 2 * k, 2.8 * k, 3.8 * k); fs(skin); }
    const fg = ctx.createRadialGradient(-5 * k, hy - 6 * k, 2 * k, 0, hy, 18 * k); fg.addColorStop(0, this.shade(skin, 0.14)); fg.addColorStop(0.7, skin); fg.addColorStop(1, this.shade(skin, -0.1));
    ell(0, hy, 15 * k, 16 * k); fs(fg);
    // pelo de delante
    const hs = st.hairStyle; ctx.fillStyle = hair;
    const cap = (ry, top) => { ctx.beginPath(); ctx.ellipse(0, hy - (top || 6) * k, 15.8 * k, ry * k, 0, Math.PI, 0); ctx.quadraticCurveTo(15 * k, hy - 2 * k, 14.5 * k, hy + 1 * k); ctx.lineTo(12.5 * k, hy - 4 * k); ctx.quadraticCurveTo(0, hy - 9 * k, -12.5 * k, hy - 4 * k); ctx.lineTo(-14.5 * k, hy + 1 * k); ctx.quadraticCurveTo(-15 * k, hy - 2 * k, -15.8 * k, hy - (top || 6) * k); ctx.closePath(); fs(hair); };
    if (hs === 'buzz') { ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.ellipse(0, hy - 5 * k, 15.2 * k, 11 * k, 0, Math.PI, 0); ctx.closePath(); ctx.fillStyle = hair; ctx.fill(); ctx.globalAlpha = 1; }
    else if (hs === 'curly') { if (!o.female) cap(10); ctx.fillStyle = hair; for (let a = -168; a <= -12; a += 26) { const r0 = a * Math.PI / 180; ell(Math.cos(r0) * 13 * k, hy - 4 * k + Math.sin(r0) * 12.5 * k, 5.4 * k, 5.4 * k); fs(hair); } }
    else if (hs === 'crop') cap(10.5);
    else if (hs === 'part') { cap(11); ctx.beginPath(); ctx.moveTo(-15 * k, hy - 6 * k); ctx.quadraticCurveTo(-6 * k, hy - 16 * k, 8 * k, hy - 10 * k); ctx.quadraticCurveTo(0, hy - 7 * k, -14 * k, hy - 1 * k); ctx.closePath(); fs(hair); ctx.strokeStyle = hairD; ctx.lineWidth = lw * 0.8; ctx.beginPath(); ctx.moveTo(-5 * k, hy - 16 * k); ctx.quadraticCurveTo(-6 * k, hy - 11 * k, -4 * k, hy - 8 * k); ctx.stroke(); }
    else if (hs === 'quiff') { cap(10); ctx.beginPath(); ctx.ellipse(-2 * k, hy - 13.5 * k, 9 * k, 4.6 * k, -0.2, 0, Math.PI * 2); fs(hair); }
    else { // peinados largos: casquete + flequillo ladeado (y moño)
      cap(12, 5); ctx.beginPath(); ctx.moveTo(-15.5 * k, hy - 1 * k); ctx.quadraticCurveTo(-10 * k, hy - 14 * k, 6 * k, hy - 11 * k); ctx.quadraticCurveTo(13 * k, hy - 8 * k, 15.5 * k, hy + 2 * k); ctx.quadraticCurveTo(8 * k, hy - 6 * k, -2 * k, hy - 6 * k); ctx.quadraticCurveTo(-10 * k, hy - 6 * k, -15.5 * k, hy - 1 * k); ctx.closePath(); fs(hair);
      if (hs === 'bun') { ell(0, hy - 19 * k, 6.5 * k, 5.5 * k); fs(hair); }
      if (hs === 'long' || hs === 'bob') { for (const d of [-1, 1]) { ctx.beginPath(); ctx.moveTo(d * 11 * k, hy - 4 * k); ctx.quadraticCurveTo(d * 17.5 * k, hy - 2 * k, d * 17.5 * k, hy + (hs === 'long' ? 18 : 11) * k); ctx.lineTo(d * 12.5 * k, hy + (hs === 'long' ? 18 : 11) * k); ctx.quadraticCurveTo(d * 13 * k, hy + 4 * k, d * 11 * k, hy - 4 * k); ctx.closePath(); ctx.fillStyle = hair; ctx.fill(); } } }
    // barba
    if (st.beard) { ctx.beginPath(); ctx.moveTo(-13.5 * k, hy + 2 * k); ctx.quadraticCurveTo(-13 * k, hy + 16.5 * k, 0, hy + 16.5 * k); ctx.quadraticCurveTo(13 * k, hy + 16.5 * k, 13.5 * k, hy + 2 * k); ctx.quadraticCurveTo(7 * k, hy + 8 * k, 0, hy + 7 * k); ctx.quadraticCurveTo(-7 * k, hy + 8 * k, -13.5 * k, hy + 2 * k); ctx.closePath(); fs(hair); }
    // cejas, ojos (parpadean), nariz, mofletes, boca
    ctx.strokeStyle = hairD; ctx.lineWidth = Math.max(0.9, 1.4 * k); ctx.beginPath(); for (const d of [-1, 1]) { const tilt = o.tired ? d * 1.2 : o.thinking ? -d * 0.6 : 0; ctx.moveTo(d * 8 * k, hy - 5 * k - tilt * k); ctx.quadraticCurveTo(d * 5.5 * k, hy - 6.6 * k, d * 3 * k, hy - 5 * k + tilt * k); } ctx.stroke();
    const blink = ((t + (o.skin || 0) * 1.37) % 4.2) < 0.13 || o.tired && ((t % 2.5) < 0.6);
    if (blink) { ctx.strokeStyle = '#2b2b2b'; ctx.lineWidth = Math.max(0.8, 1.1 * k); ctx.beginPath(); ctx.moveTo(-7 * k, hy + 1 * k); ctx.lineTo(-4 * k, hy + 1 * k); ctx.moveTo(4 * k, hy + 1 * k); ctx.lineTo(7 * k, hy + 1 * k); ctx.stroke(); }
    else { ctx.fillStyle = '#2b2b2b'; for (const d of [-1, 1]) { ell(d * 5.5 * k, hy + 1 * k, 1.7 * k, 2.1 * k); ctx.fill(); } ctx.fillStyle = '#fff'; for (const d of [-1, 1]) { ell(d * 5.5 * k - 0.6 * k, hy + 0.2 * k, 0.65 * k, 0.65 * k); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(120,70,50,0.45)'; ctx.lineWidth = Math.max(0.8, 1.1 * k); ctx.beginPath(); ctx.moveTo(-0.5 * k, hy + 3 * k); ctx.quadraticCurveTo(1.5 * k, hy + 5.5 * k, -1 * k, hy + 6 * k); ctx.stroke();
    ctx.fillStyle = 'rgba(235,110,100,0.22)'; for (const d of [-1, 1]) { ell(d * 9 * k, hy + 6.5 * k, 2.8 * k, 1.7 * k); ctx.fill(); }
    ctx.strokeStyle = st.beard ? '#4a2a20' : '#8a4a3a'; ctx.lineWidth = Math.max(0.9, 1.25 * k); ctx.beginPath();
    if (o.tired) ctx.arc(0, hy + 12 * k, 3 * k, Math.PI * 1.15, Math.PI * 1.85); else if (o.thinking) { ctx.ellipse(1 * k, hy + 9.5 * k, 1.4 * k, 1.1 * k, 0, 0, Math.PI * 2); } else ctx.arc(0, hy + 7 * k, 3.6 * k, 0.18 * Math.PI, 0.82 * Math.PI); ctx.stroke();
    if (o.tired) { ctx.fillStyle = 'rgba(100,80,140,0.3)'; for (const d of [-1, 1]) { ell(d * 5.5 * k, hy + 4.5 * k, 3.6 * k, 1.3 * k); ctx.fill(); } }
    // gafas (cada persona las suyas; los clientes a veces sin gafas o con gafas de sol en verano)
    if (st.glasses) this.glasses(0, hy + 1 * k, 4.6 * k, st.frame, 0, o.sun ? 'rgba(30,30,40,0.85)' : null, st.glasses, true);
    // burbuja de pensar
    if (o.thinking) { ctx.fillStyle = 'rgba(255,255,255,0.95)'; ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 1; const bx = 22 * k, by = hy - 24 * k; ell(bx, by, 16 * k, 10 * k); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.arc(bx - 12 * k, by + 10 * k, 3 * k, 0, 7); ctx.arc(bx - 17 * k, by + 15 * k, 1.8 * k, 0, 7); ctx.fill(); ctx.fillStyle = '#555'; const ph = Math.floor((t * 3) % 3); for (let i = 0; i < 3; i++) { ell(bx - 6 * k + i * 6 * k, by + (i === ph ? -2 * k : 0), 1.8 * k, 1.8 * k); ctx.fill(); } }
    // llamas (racha)
    if (o.onFire) { ctx.globalCompositeOperation = 'lighter'; for (let i = 0; i < 6; i++) { const a = t * 6 + i * 1.1; const fx = Math.sin(a) * 13 * k, fy = hy - 20 * k - Math.abs(Math.cos(a * 0.7)) * 11 * k; ctx.fillStyle = i % 2 ? 'rgba(255,120,0,0.6)' : 'rgba(255,215,60,0.7)'; ell(fx, fy, 3.2 * k, 5.5 * k); ctx.fill(); } ctx.globalCompositeOperation = 'source-over'; }
    ctx.restore();
  },

  /* ---------- instrumentos y máquinas con su silueta real ---------- */
  /* aparato oftálmico de sobremesa: base con joystick, cuerpo, mentonera y frontal del lado del paciente, pantalla del lado del óptico */
  examDevice(u, v, z, col, acc, o) { o = o || {}; const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u, v, z, 0.46, 0.42, 0.05, '#b2bec3', { top: '#dfe6e9' }); this.box(u + 0.32, v + 0.04, z + 0.05, 0.08, 0.08, 0.04, '#636e72'); const j = P(0.36, 0.08, 0.13); ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.arc(j.x, j.y, Math.max(1.5, s * 0.018), 0, 7); ctx.fill();
    const h = o.h || 0.28; this.box(u + 0.08, v + 0.06, z + 0.05, 0.28, 0.24, h, col, { top: this.shade(col, 0.15), right: this.shade(col, -0.18) });
    // objetivo hacia el paciente (+v)
    const c = P(0.22, 0.3, 0.05 + h * 0.62); ctx.fillStyle = '#2d3436'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.04, s * 0.04, 0, 0, 7); ctx.fill(); ctx.fillStyle = acc || '#74b9ff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.018, s * 0.018, 0, 0, 7); ctx.fill();
    if (o.rings) { ctx.lineWidth = 1; for (let k = 3; k >= 1; k--) { ctx.strokeStyle = k % 2 ? '#2d3436' : '#ffffff'; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.02 * k + s * 0.02, s * 0.022 * k + s * 0.02, 0, 0, 7); ctx.stroke(); } }
    // mentonera (dos postes, barra de frente y apoyo de barbilla)
    for (const du of [0.04, 0.4]) this.box(u + du, v + 0.36, z + 0.05, 0.03, 0.03, 0.42, '#9aa5ae'); this.box(u + 0.04, v + 0.36, z + 0.44, 0.39, 0.03, 0.03, '#9aa5ae'); this.box(u + 0.17, v + 0.34, z + 0.18, 0.13, 0.06, 0.03, '#dfe6e9');
    // pantalla para el óptico (lado +u)
    if (o.screen !== false) { this.poly([P(0.36, 0.1, 0.05 + h * 0.45), P(0.36, 0.26, 0.05 + h * 0.45), P(0.36, 0.26, 0.05 + h - 0.02), P(0.36, 0.1, 0.05 + h - 0.02)], '#1e272e'); this.poly([P(0.36, 0.12, 0.05 + h * 0.5), P(0.36, 0.24, 0.05 + h * 0.5), P(0.36, 0.24, 0.05 + h - 0.05), P(0.36, 0.12, 0.05 + h - 0.05)], acc || '#74b9ff'); }
    if (o.hand) { const a = P(0.06, 0.1, 0.3), b = P(-0.08, 0.2, 0.18); ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.quadraticCurveTo(a.x - s * 0.1, a.y + s * 0.1, b.x, b.y); ctx.stroke(); this.box(u - 0.12, v + 0.16, z + 0.05, 0.08, 0.08, 0.14, o.hand, { top: this.shade(o.hand, 0.2) }); } },
  /* frontofocómetro: columna, mesa de la lente con sujetador, ocular (manual) o pantalla inclinada (digital) */
  lensmeter(u, v, z, digital) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz); const col = digital ? '#f1f2f6' : '#5d6d7e';
    this.box(u + 0.1, v + 0.1, z, 0.32, 0.3, 0.06, this.shade(col, -0.1)); this.box(u + 0.16, v + 0.12, z + 0.06, 0.2, 0.16, 0.42, col, { top: this.shade(col, 0.15), right: this.shade(col, -0.2) });
    this.box(u + 0.14, v + 0.26, z + 0.2, 0.24, 0.12, 0.03, '#2d3436'); this.box(u + 0.24, v + 0.3, z + 0.23, 0.04, 0.04, 0.12, '#95a5a6'); // mesa de lente y sujetador
    if (digital) { this.poly([P(0.12, 0.3, 0.5), P(0.4, 0.3, 0.5), P(0.4, 0.22, 0.68), P(0.12, 0.22, 0.68)], '#1e272e', '#636e72'); this.poly([P(0.15, 0.29, 0.53), P(0.37, 0.29, 0.53), P(0.37, 0.23, 0.65), P(0.15, 0.23, 0.65)], '#55efc4'); }
    else { this.box(u + 0.22, v + 0.02, z + 0.42, 0.08, 0.14, 0.08, '#2d3436'); const e = P(0.26, 0.02, 0.46); ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(e.x, e.y, Math.max(1.5, s * 0.022), 0, 7); ctx.fill(); this.box(u + 0.36, v + 0.18, z + 0.3, 0.06, 0.06, 0.06, '#c0392b'); } },
  /* fresadora CNC de aficionado (tipo 3018): placa, laterales de aluminio, viga, motor del husillo y fresa girando */
  gantry(u, v, z, busy) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u + 0.1, v + 0.12, z, 0.62, 0.5, 0.04, '#bdc3c7', { top: '#dfe6e9' }); this.box(u + 0.2, v + 0.2, z + 0.04, 0.42, 0.34, 0.02, '#c8a165');
    for (const dv of [0.14, 0.56]) this.box(u + 0.36, v + dv, z + 0.04, 0.06, 0.04, 0.42, '#2d3436'); this.box(u + 0.36, v + 0.14, z + 0.42, 0.06, 0.46, 0.06, '#636e72');
    this.box(u + 0.3, v + 0.32, z + 0.22, 0.12, 0.12, 0.2, '#2d3436', { top: '#3d4448' }); const b0 = P(0.36, 0.38, 0.22), b1 = P(0.36, 0.38, 0.08); ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(b0.x, b0.y); ctx.lineTo(b1.x, b1.y); ctx.stroke();
    if (busy) { ctx.fillStyle = 'rgba(200,161,101,0.8)'; for (let k = 0; k < 4; k++) { const a = this.time / 60 + k * 1.6; ctx.fillRect(b1.x + Math.cos(a) * s * 0.06, b1.y + Math.sin(a) * s * 0.02, 2, 2); } } },
  /* impresora 3D de filamento: marco abierto, cama, cabezal y bobina */
  printerFDM(u, v, z, busy) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz); const k = '#2d3436';
    this.box(u + 0.15, v + 0.15, z, 0.48, 0.44, 0.06, k); for (const [a, b] of [[0.15, 0.15], [0.59, 0.15], [0.15, 0.55], [0.59, 0.55]]) this.box(u + a, v + b, z + 0.06, 0.04, 0.04, 0.5, k); this.box(u + 0.15, v + 0.15, z + 0.56, 0.48, 0.44, 0.03, k, { top: '#3d4448' });
    this.box(u + 0.22, v + 0.22, z + 0.14, 0.34, 0.3, 0.02, '#b2bec3'); this.box(u + 0.3, v + 0.3, z + 0.16, 0.14, 0.12, 0.06, '#e67e22', { top: '#f39c12' }); const hz = 0.32 + (busy ? Math.sin(this.time / 300) * 0.02 : 0); this.box(u + 0.32, v + 0.3, z + hz, 0.1, 0.1, 0.08, '#e74c3c');
    const sp = P(0.68, 0.36, 0.42); ctx.fillStyle = '#27ae60'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, s * 0.05, s * 0.07, -0.5, 0, 7); ctx.fill(); ctx.fillStyle = '#1e8449'; ctx.beginPath(); ctx.ellipse(sp.x, sp.y, s * 0.018, s * 0.025, -0.5, 0, 7); ctx.fill(); },
  /* motor de pulido: cuerpo con dos ruedas de algodón */
  buffer(u, v, z, busy) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u + 0.3, v + 0.3, z, 0.24, 0.2, 0.04, '#636e72'); this.cyl(u + 0.42, v + 0.4, z + 0.04, 0.09, 0.2, '#34495e');
    for (const du of [0.14, 0.7]) { const c = P(du, 0.4, 0.2); const rot = this.time / (busy ? 70 : 600); ctx.fillStyle = '#f5f0e6'; ctx.strokeStyle = 'rgba(0,0,0,0.35)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(c.x, c.y, s * 0.05, s * 0.11, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.strokeStyle = 'rgba(150,130,100,0.6)'; ctx.beginPath(); ctx.moveTo(c.x, c.y - Math.cos(rot) * s * 0.1); ctx.lineTo(c.x, c.y + Math.cos(rot) * s * 0.1); ctx.stroke(); }
    const a = P(0.18, 0.4, 0.2), b = P(0.66, 0.4, 0.2); ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); },
  /* prensa de bombeado: base, dos columnas, cabezal con pistón y placas calientes */
  press(u, v, busy) { const s = this.scale(); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.shadow(u, v, 1, 0.85, 0.6);
    this.box(u + 0.15, v + 0.15, 0, 0.75, 0.6, 0.5, '#7f8c8d', { top: '#95a5a6' }); for (const du of [0.2, 0.78]) this.box(u + du, v + 0.4, 0.5, 0.07, 0.07, 0.75, '#bdc3c7'); this.box(u + 0.15, v + 0.3, 1.25, 0.75, 0.3, 0.18, '#d63031', { top: '#ff7675' });
    const pz = busy ? 0.8 + 0.08 * Math.sin(this.time / 400) : 0.85; this.box(u + 0.45, v + 0.42, pz, 0.14, 0.12, 1.25 - pz, '#dfe6e9'); this.box(u + 0.3, v + 0.35, pz - 0.05, 0.45, 0.25, 0.05, '#e17055'); this.box(u + 0.3, v + 0.35, 0.5, 0.45, 0.25, 0.05, '#e17055'); },
  /* taladro / ranuradora de columna */
  drill(u, v, z, col, busy) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(u + du, v + dv, z + dz);
    this.box(u + 0.2, v + 0.15, z, 0.4, 0.5, 0.05, '#636e72'); this.box(u + 0.36, v + 0.18, z + 0.05, 0.07, 0.07, 0.55, '#95a5a6'); this.box(u + 0.28, v + 0.18, z + 0.5, 0.22, 0.3, 0.14, col, { top: this.shade(col, 0.2) });
    this.box(u + 0.28, v + 0.38, z + 0.18, 0.22, 0.2, 0.03, '#2d3436'); const t0 = P(0.39, 0.42, 0.5), t1 = P(0.39, 0.42, 0.32); ctx.strokeStyle = '#ecf0f1'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.stroke(); },
  /* vitrina de kits y lentes de prueba: armario con puertas de cristal y estuches de colores */
  vitrine(u, v, w, items) { this.shadow(u, v, w, 0.5, 0.6); this.box(u + 0.05, v + 0.05, 0, w - 0.1, 0.45, 1.45, '#f1f2f6', { top: '#ffffff', right: '#cfd8dc' }); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz);
    for (let r = 0; r < 3; r++) { for (let k = 0; k < 3; k++) { const c = items[(r * 3 + k) % items.length]; this.box(u + 0.14 + k * (w - 0.28) / 3, v + 0.25, 0.15 + r * 0.43, (w - 0.28) / 3 - 0.05, 0.22, 0.2, c, { top: this.shade(c, 0.25) }); } }
    this.poly([P(0.05, 0.5, 0.05), P(w - 0.05, 0.5, 0.05), P(w - 0.05, 0.5, 1.4), P(0.05, 0.5, 1.4)], 'rgba(190,225,240,0.35)', 'rgba(90,110,125,0.6)', 1.5); const m = P(w / 2, 0.5, 0.05), n = P(w / 2, 0.5, 1.4); this.ctx.strokeStyle = 'rgba(90,110,125,0.6)'; this.ctx.beginPath(); this.ctx.moveTo(m.x, m.y); this.ctx.lineTo(n.x, n.y); this.ctx.stroke(); },
  /* ================= salas aparte (como los laboratorios de Game Dev Tycoon) =================
     Scene.view = 'main' | 'taller' | 'lab' | 'gabinete'. Cada sala tiene su propia distribución (ROOMS) y muestra
     todo el equipo comprado (sceneInfo.owned) en puestos; los huecos libres se ven como marcas en el suelo. */
  view: 'main',
  ROOM_IDS: ['taller', 'lab', 'gabinete'],
  roomsAvailable() { const co = this.co(); if (!co || co.level < 3) return []; const main = LAYOUTS[this.level()] || {}; return this.ROOM_IDS.filter(id => main.depts && main.depts[id] && this.deptAvailable(id)); },
  setView(v) { if (v !== 'main' && this.roomsAvailable().indexOf(v) < 0) v = 'main'; if (v === this.view) return; this.view = v; this.bgKey = ''; this.lastBuild = -1e9; this.hover = null; this.customers = []; this.spriteCache.clear(); },
  inRoom() { return this.view !== 'main' && !!ROOMS[this.view]; },
  /* catálogo del departamento (nombres) */
  catalog(dept) { const m = typeof Modules !== 'undefined' && Modules.get(dept); const api = m && m.api; return (api && (api.EQ || api.INSTR)) || []; },
  shortName(n) { n = String(n || '').split(/[:(]/)[0].trim(); return n.length > 38 ? n.slice(0, 36) + '…' : n; },
  /* aspecto de cada equipo: tipo de dibujo, color, altura y detalles */
  ARCH: {
    kit_manual: ['tools', '#8d6e4a'], cnc3018: ['gantry'], fresadora_rigida: ['cab', '#455a64', 1.0, { stripe: '#e67e22', win: '#263238', spin: true }], cad_software: ['pc'], fdm_prototipos: ['fdm'],
    calor_glicerol: ['dev', '#e17055', 0.25, { glow: '#ffb142' }], bombo_hobby: ['drum1', '#a1887f'], pulidora_banco: ['buffer'], insertadora_manual: ['drill', '#0984e3'], stock_planchas: ['rack', '#e17055', 0, { items: ['#e17055', '#8e44ad', '#16a085', '#f1c40f', '#2d3436', '#c0392b'] }],
    cnc_optica_3ejes: ['tm'], bombos_serie: ['tm'], cnc_multihusillo: ['tm'], sls_fuse: ['tm'], inyectora_150t: ['tm'], babyplast: ['tm'], bombos_industriales: ['tm'],
    prensa_bombeado: ['press'], insertadora_auto: ['cab', '#dfe6e9', 0.85, { screen: '#55efc4', win: '#2d3436' }], horno_varillas: ['cab', '#636e72', 0.95, { win: '#2d3436', glow: 0.5, glowCol: '#ff7f50' }], ranuradora: ['drill', '#6c5ce7'],
    laser_fibra: ['cab', '#2d3436', 0.95, { win: '#111', glow: 0.35, glowCol: '#ff3b3b', screen: '#74b9ff' }], serigrafia: ['dev', '#fdcb6e', 0.3], cabina_pulido: ['cab', '#81ecec', 1.2, { win: '#2d3436', spin: true }], escaner_facial: ['kiosk', '#ffffff'],
    linea_metal: ['cab', '#95a5a6', 1.0, { stripe: '#f1c40f', win: '#2d3436' }], soldadura_laser_titanio: ['cab', '#2d3436', 1.05, { win: '#111', glow: 0.45, glowCol: '#74b9ff' }], galvanica: ['tanks', '#b2bec3', 0, { items: ['#d4ac0d', '#bdc3c7', '#8e9aa6'] }], pvd_ip: ['cyl', '#b2bec3'],
    lacado: ['cab', '#fab1a0', 1.15, { win: '#2d3436', glow: 0.25, glowCol: '#ff9f43' }], lab_color: ['rack', '#8e44ad', 0, { items: ['#8b4513', '#e84393', '#2980b9', '#27ae60', '#f39c12', '#2d3436'] }], sls_industrial: ['cab', '#f5f6fa', 1.35, { win: '#2d3436', glow: 0.4, glowCol: '#ff9f43', screen: '#55efc4' }],
    qc_lab: ['dev', '#00cec9', 0.3, { screen: 1 }], manifattura: ['cab', '#2c3e50', 1.4, { stripe: '#f1c40f', win: '#111', spin: true, screen: '#55efc4' }], planta_acetato: ['tanks', '#8e44ad', 0, { items: ['#e17055', '#8b4513', '#2980b9'] }],
    biseladora_manual_usada: ['edger', 0], biseladora_auto_3d: ['edger', 1], biseladora_mano: ['buffer'], frontofocometro_manual: ['lensm', 0], frontofocometro_digital: ['lensm', 1], ventilete: ['dev', '#e17055', 0.25, { glow: '#ffb142' }],
    kit_herramientas: ['tools', '#b0bec5'], stock_lentes_basico: ['rack', '#74b9ff', 0, { items: ['#dfe6e9', '#b2bec3', '#74b9ff', '#dfe6e9', '#81ecec', '#dfe6e9'] }], trazador_bloqueador: ['dev', '#f1f2f6', 0.32, { screen: 1 }], modulo_taladro_ranura: ['drill', '#74b9ff'],
    tintadora: ['tanks', '#b0bec5', 0, { items: ['#8d5524', '#636e72', '#2e8b57'] }], pulidora_bisel: ['buffer'], software_pedidos_edi: ['pc'], contrato_mantenimiento: ['skip'], generador_freeform: ['lm'], camara_ar_pequena: ['lm'], linea_modular_freeform: ['lm'], coater_industrial: ['lm'],
    pulidora_freeform: ['cab', '#dfe6e9', 1.0, { win: '#2d3436', spin: true, screen: '#74b9ff' }], bloqueadora_superficie: ['dev', '#a29bfe', 0.34], desbloqueo_lavado: ['tanks', '#b0bec5', 0, { items: ['#74b9ff', '#a8e6ff', '#74b9ff'] }], mapeador_superficie: ['dev', '#f1f2f6', 0.4, { screen: 1 }],
    hardcoat_inmersion: ['tanks', '#b0bec5', 0, { items: ['#e8f8ff', '#dff9fb', '#e8f8ff'] }], software_lds: ['pc'], hardcoat_linea: ['cab', '#dfe6e9', 1.0, { stripe: '#0984e3', win: '#2d3436' }], automatizacion_mes: ['cab', '#636e72', 0.9, { stripe: '#f1c40f', screen: '#55efc4' }], inspeccion_automatica: ['cab', '#ffffff', 1.0, { win: '#2d3436', screen: '#74b9ff' }],
    // gabinete (lo que no va dentro de la consulta)
    cabina_audiologia: ['audio'], campimetro: ['camp'], oct: ['pre'], retinografo_no_midriatico: ['pre'], topografo_corneal: ['pre'], autorrefractometro_queratometro: ['pre'], tonometro_aire: ['pre'], aberrometro_multidiagnostico: ['pre'],
    biometro_optico: ['exam', '#f1f2f6', '#00cec9'], camara_ojo_seco_meibografia: ['exam', '#ffffff', '#e17055', { rings: 1 }], paquimetro: ['exam', '#dfe6e9', '#0984e3', { h: 0.22 }], centrado_digital: ['kiosk', '#f5f6fa'], estacion_telerrefraccion: ['kiosk', '#dfe6e9'], terapia_visual_digital: ['kiosk', '#2d3436'], ipl_ojo_seco: ['exam', '#fdcfe0', '#e84393', { hand: '#fd79a8' }],
    frontofocometro_manual_g: ['dev', '#607d8b', 0.55], kit_pediatrico: ['vitr', '#fdcb6e', 0, { items: ['#e84393', '#fdcb6e', '#00b894', '#0984e3', '#e17055', '#6c5ce7'] }], kit_terapia_visual: ['vitr', '#00b894', 0, { items: ['#00b894', '#e17055', '#0984e3', '#fdcb6e', '#00b894', '#a29bfe'] }], kit_baja_vision: ['vitr', '#636e72', 0, { items: ['#2d3436', '#636e72', '#b2bec3', '#2d3436', '#636e72', '#b2bec3'] }],
    set_lc_prueba: ['vitr', '#74b9ff', 0, { items: ['#dff9fb', '#74b9ff', '#dff9fb', '#81ecec', '#dff9fb', '#74b9ff'] }], set_esclerales: ['vitr', '#81ecec', 0, { items: ['#dff9fb', '#81ecec', '#dff9fb', '#81ecec', '#dff9fb', '#81ecec'] }], maletin_portatil: ['dev', '#2d3436', 0.22], tonometro_contacto_rebote: ['dev', '#dfe6e9', 0.2]
  },
  /* lo que se dibuja dentro de la consulta (no ocupa puesto aparte) */
  IN_BOX: { optotipos_basicos: 1, caja_pruebas_gafa_prueba: 1, retinoscopio: 1, sala_oscura_obra: 1, software_historia_clinica: 1, oftalmoscopio_directo: 1, lampara_hendidura: 1, pupilometro_digital: 1, pantalla_lcd_optotipos: 1, unidad_refraccion: 1, foropter_manual: 1, foropter_digital: 1, lampara_hendidura_digital: 1, frontofocometro_manual: 1, frontofocometro_digital: 1, segundo_gabinete: 1 },
  /* piloto de actividad encima de cada equipo cuando el departamento trabaja */
  stationPulse(st, i) { const ctx = this.ctx; const s = this.scale(); const h = st.arch && st.arch[0] === 'cab' ? (st.arch[2] || 1) + 0.05 : st.arch && (st.arch[0] === 'rack' || st.arch[0] === 'kiosk') ? 0 : 1.15; if (!h) return; const p = this.iso(st.u + st.w * 0.8, st.v + 0.15, h); const on = ((this.time / 600 + i * 0.37) % 1) < 0.6; ctx.fillStyle = on ? '#2ecc71' : 'rgba(46,204,113,0.35)'; ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(2, s * 0.025), 0, 7); ctx.fill(); },
  /* puesto vacío: marca en el suelo para que se vea dónde cabe más equipo */
  drawEmptySlot(st, label) { const ctx = this.ctx; const s = this.scale(); const Q = (du, dv) => this.iso(st.u + du, st.v + dv); ctx.save(); ctx.setLineDash([s * 0.08, s * 0.06]); ctx.strokeStyle = 'rgba(80,90,100,0.45)'; ctx.lineWidth = 1.5; this.poly([Q(0, 0), Q(st.w, 0), Q(st.w, st.d), Q(0, st.d)], 'rgba(255,255,255,0.18)', 'rgba(80,90,100,0.45)', 1.5); ctx.setLineDash([]); const c = Q(st.w / 2, st.d / 2); ctx.fillStyle = 'rgba(60,70,80,0.55)'; ctx.font = `bold ${Math.max(9, s * 0.14)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.fillText(label ? '' : '+', c.x, c.y + 4); if (label) { ctx.font = `${Math.max(9, s * 0.1)}px "Segoe UI", sans-serif`; ctx.fillText(label, c.x, c.y + 4); } ctx.restore(); },
  drawStation(st, dept) {
    if (st.empty) return this.drawEmptySlot(st);
    const s = this.scale(); const ctx = this.ctx; const a = st.arch; const type = a[0], col = a[1] || '#95a5a6', h = a[2] || 0.3, o = a[3] || {}; const busy = !!this.info(dept).busy; const u = st.u, v = st.v, w = st.w, d = st.d; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz);
    const bench = (top) => { if (st.onBench) return; this.shadow(u, v, w, d, 0.6); this.box(u, v, 0, w, d, 0.8, top || (dept === 'taller' ? '#8d6e4a' : '#eceff1'), dept === 'taller' ? { top: '#b08c60', right: '#5f4630' } : { top: '#fafafa', right: '#b0bec5' }); };
    if (type === 'tm') return this.tallerMachine(st.id, u, v, w, d, busy);
    if (type === 'gantry') { bench(); return this.gantry(u + 0.1, v + 0.05, 0.8, busy); }
    if (type === 'fdm') { bench(); return this.printerFDM(u + 0.1, v + 0.05, 0.8, busy); }
    if (type === 'buffer') { bench(); return this.buffer(u + 0.1, v + 0.1, 0.8, busy); }
    if (type === 'press') return this.press(u, v, busy);
    if (type === 'drill') { bench(); return this.drill(u + 0.1, v + 0.05, 0.8, a[1] || '#0984e3', busy); }
    if (type === 'lensm') { bench(); return this.lensmeter(u + 0.25, v + 0.1, 0.8, !!a[1]); }
    if (type === 'exam') { bench('#dfe6e9'); return this.examDevice(u + 0.28, v + 0.15, 0.8, a[1] || '#f1f2f6', a[2], a[3]); }
    if (type === 'vitr') return this.vitrine(u, v, w, o.items || [col]);
    if (type === 'lm') return this.labMachine(st.id, u, v, w, d, busy);
    if (type === 'edger') { bench(); return this.edger(u + 0.1, v + 0.15, 0.8, !!a[1], busy); }
    if (type === 'pre') { bench('#dfe6e9'); return this.preExam(u + 0.25, v + 0.15, 0.8, st.id); }
    if (type === 'camp') return this.campimeter(u + 0.25, v + 0.2);
    if (type === 'audio') return this.drawAudioBooth(u, v - 0.05);
    if (type === 'cab') return this.cabinet(u + 0.05, v + 0.05, w - 0.1, d - 0.1, h, col, o);
    if (type === 'cyl') { this.shadow(u, v, w, d, 0.6); this.box(u + 0.1, v + 0.1, 0, w - 0.2, d - 0.2, 0.15, '#636e72'); this.cyl(u + w / 2, v + d / 2, 0.15, 0.36, 0.8, col); const g = P(w / 2, d / 2 + 0.36, 0.55); ctx.fillStyle = 'rgba(162,155,254,0.85)'; ctx.beginPath(); ctx.ellipse(g.x, g.y, s * 0.07, s * 0.07, 0, 0, 7); ctx.fill(); return; }
    if (type === 'kiosk') { this.shadow(u + 0.3, v + 0.2, 0.4, 0.4, 0.6); this.box(u + 0.3, v + 0.25, 0, 0.4, 0.35, 1.3, col, { top: this.shade(col, 0.2), right: this.shade(col, -0.2) }); this.poly([P(0.36, 0.6, 0.7), P(0.64, 0.6, 0.7), P(0.64, 0.6, 1.2), P(0.36, 0.6, 1.2)], '#1e272e'); this.poly([P(0.39, 0.6, 0.75), P(0.61, 0.6, 0.75), P(0.61, 0.6, 1.15), P(0.39, 0.6, 1.15)], '#74b9ff'); return; }
    if (type === 'pc') { bench(); this.drawComputer(u + 0.25, v + 0.1, 0.8, this.env().era, true); return; }
    if (type === 'rack') { this.shadow(u, v, w, 0.5, 0.6); const items = o.items || [col]; this.box(u + 0.05, v + 0.05, 0, w - 0.1, 0.45, 1.5, '#7f8c8d', { top: '#95a5a6', right: '#636e72' }); for (let r = 0; r < 3; r++) for (let k = 0; k < 4; k++) { const c = items[(r * 4 + k) % items.length]; this.box(u + 0.12 + k * (w - 0.24) / 4, v + 0.38, 0.12 + r * 0.46, (w - 0.24) / 4 - 0.04, 0.12, 0.34, c, { top: this.shade(c, 0.2) }); } return; }
    if (type === 'tanks') { this.shadow(u, v, w, d, 0.6); this.box(u, v, 0, w, d, 0.55, '#b0bec5', { top: '#cfd8dc', right: '#90a4ae' }); (o.items || ['#74b9ff']).slice(0, 3).forEach((c, k) => { const q = [P(0.1 + k * (w - 0.2) / 3, 0.15, 0.56), P(0.1 + (k + 1) * (w - 0.2) / 3 - 0.05, 0.15, 0.56), P(0.1 + (k + 1) * (w - 0.2) / 3 - 0.05, d - 0.15, 0.56), P(0.1 + k * (w - 0.2) / 3, d - 0.15, 0.56)]; this.poly(q, c, 'rgba(0,0,0,0.3)'); if (busy) { const b = P(0.1 + (k + 0.45) * (w - 0.2) / 3, d / 2, 0.6 + 0.05 * Math.sin(this.time / 200 + k)); ctx.fillStyle = 'rgba(255,255,255,0.7)'; ctx.beginPath(); ctx.arc(b.x, b.y, s * 0.02, 0, 7); ctx.fill(); } }); return; }
    if (type === 'drum1') { bench(); this.box(u + 0.3, v + 0.2, 0.8, 0.4, 0.4, 0.05, '#5d4037'); this.drum(u + 0.5, v + 0.52, 1.02, 0.15, 0.28, col, this.time / (busy ? 500 : 1400)); return; }
    if (type === 'tools') { bench(); this.box(u + 0.15, v + 0.25, 0.8, 0.3, 0.25, 0.22, '#555', { top: '#777' }); const t1 = P(0.6, 0.55, 0.82); ctx.strokeStyle = '#333'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(t1.x, t1.y); ctx.lineTo(t1.x + s * 0.14, t1.y - s * 0.05); ctx.moveTo(t1.x + s * 0.03, t1.y + s * 0.05); ctx.lineTo(t1.x + s * 0.17, t1.y); ctx.stroke(); return; }
    // dispositivo de sobremesa genérico sobre banco
    bench(); this.box(u + 0.25, v + 0.2, 0.8, 0.5, 0.45, h, col, { top: this.shade(col, 0.22), right: this.shade(col, -0.22) });
    if (o.screen) { const sc = P(0.5, 0.65, 0.8 + h * 0.55); ctx.fillStyle = typeof o.screen === 'string' ? o.screen : '#74b9ff'; ctx.fillRect(sc.x - s * 0.06, sc.y - s * 0.04, s * 0.12, s * 0.07); }
    if (o.glow) { const g = P(0.5, 0.65, 0.8 + h * 0.5); ctx.save(); ctx.globalAlpha = busy ? 0.55 + 0.3 * Math.sin(this.time / 250) : 0.35; ctx.fillStyle = o.glow; ctx.beginPath(); ctx.ellipse(g.x, g.y, s * 0.08, s * 0.05, 0, 0, 7); ctx.fill(); ctx.restore(); }
    if (o.spin) { const c = P(0.5, 0.42, 0.8 + h + 0.06); const a0 = this.time / (busy ? 90 : 400); ctx.strokeStyle = '#2d3436'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(c.x + Math.cos(a0) * s * 0.07, c.y + Math.sin(a0) * s * 0.035); ctx.lineTo(c.x - Math.cos(a0) * s * 0.07, c.y - Math.sin(a0) * s * 0.035); ctx.stroke(); }
  },
  /* ---------- distribución realista de las salas ----------
     Taller y laboratorio = cadena de proceso: máquinas grandes en fila contra la pared del fondo (con cinta transportadora delante)
     y en islas, equipos de sobremesa sobre bancos corridos, estanterías y vitrinas contra la pared izquierda y la parte delantera
     libre (paso y expedición). La sala crece lo justo para que quepa el equipo comprado. */
  FLOW: {
    taller: ['cad_software', 'escaner_facial', 'stock_planchas', 'lab_color', 'planta_acetato', 'cnc3018', 'fresadora_rigida', 'cnc_optica_3ejes', 'cnc_multihusillo', 'manifattura', 'fdm_prototipos', 'sls_fuse', 'sls_industrial', 'babyplast', 'inyectora_150t', 'linea_metal', 'soldadura_laser_titanio', 'prensa_bombeado', 'calor_glicerol', 'horno_varillas', 'ranuradora', 'insertadora_manual', 'insertadora_auto', 'kit_manual', 'bombo_hobby', 'bombos_serie', 'bombos_industriales', 'pulidora_banco', 'cabina_pulido', 'lacado', 'galvanica', 'pvd_ip', 'laser_fibra', 'serigrafia', 'qc_lab'],
    lab: ['software_pedidos_edi', 'software_lds', 'stock_lentes_basico', 'trazador_bloqueador', 'bloqueadora_superficie', 'generador_freeform', 'pulidora_freeform', 'linea_modular_freeform', 'automatizacion_mes', 'desbloqueo_lavado', 'mapeador_superficie', 'hardcoat_inmersion', 'hardcoat_linea', 'camara_ar_pequena', 'coater_industrial', 'biseladora_mano', 'biseladora_manual_usada', 'biseladora_auto_3d', 'modulo_taladro_ranura', 'pulidora_bisel', 'frontofocometro_manual', 'frontofocometro_digital', 'inspeccion_automatica', 'tintadora', 'ventilete', 'kit_herramientas']
  },
  ROLE(id) { const a = this.ARCH[id] || ['dev']; const t = a[0]; if (t === 'skip') return null; if (t === 'rack' || t === 'vitr' || t === 'kiosk') return 'wall'; if (t === 'audio' || t === 'camp') return 'corner'; if (['cab', 'tm', 'lm', 'cyl', 'press', 'tanks'].indexOf(t) >= 0) return 'big'; return 'bench'; },
  roomItems(dept) {
    const info = this.info(dept); const own = (info.owned || info.instruments || []).slice(); const flow = this.FLOW[dept] || []; const cat = this.catalog(dept);
    const ord = id => { const i = flow.indexOf(id); return i >= 0 ? i : 500 + cat.findIndex(e => e.id === id); };
    let ids = own.filter(id => this.ROLE(id));
    if (dept === 'gabinete') { const inBox = this.SHOW.gabinete.map(x => x[0]).filter(id => this.PRE_EXAM[id] && own.indexOf(id) >= 0).slice(0, 2); ids = ids.filter(id => !this.IN_BOX[id] && inBox.indexOf(id) < 0); }
    return ids.sort((a, b) => ord(a) - ord(b)).map(id => { const e = cat.find(x => x.id === id); return { id, name: this.shortName(e ? e.name : id), arch: this.ARCH[id] || ['dev', '#95a5a6', 0.32], role: this.ROLE(id) }; });
  },
  planRoom(items, R) { /* filas alternas desde la pared del fondo: máquinas grandes (si las hay) y bancos, con pasillo delante de cada una */
    const u0 = 1.25, uMax = R - 0.3, BW = 1.05, DW = 0.9; const nB = Math.floor((uMax - u0) / BW), nD = Math.floor((uMax - u0) / DW);
    const big = items.filter(x => x.role === 'big'), bench = items.filter(x => x.role === 'bench'), wall = items.filter(x => x.role === 'wall'); const doorV = R - 2.1;
    const rows = []; let v = 0.3, bl = big.length, dl = bench.length;
    while (v + 0.85 <= R - 1.6 && (bl > 0 || dl > 0)) { if (bl > 0 && (rows.length % 2 === 0 || dl <= 0)) { rows.push({ t: 'big', v }); bl -= nB; } else { rows.push({ t: 'bench', v }); dl -= nD; } v += 1.6; }
    return { ok: bl <= 0 && dl <= 0 && wall.length <= Math.floor((doorV - 0.3) / 1.1), rows, u0, nB, nD, BW, DW, big, bench, wall };
  },
  roomLayout(id) { const base = ROOMS[id]; if (!base.grow) return this.gabLayout(base); const items = this.roomItems(id); const sig = id + ':' + items.map(x => x.id).join(','); this._rooms = this._rooms || {}; if (this._rooms[sig]) return this._rooms[sig];
    let R = 6, plan = null; for (R = 6; R <= 12; R++) { plan = this.planRoom(items, R); if (plan.ok) break; } R = Math.min(R, 12);
    const stations = [], benches = []; let bi = 0, di = 0;
    for (const row of plan.rows) {
      if (row.t === 'big') { const seg = plan.big.slice(bi, bi + plan.nB); bi += seg.length; seg.forEach((it, k) => stations.push(Object.assign({}, it, { u: plan.u0 + k * plan.BW, v: row.v, w: 1.0, d: 0.85, row: row.v }))); }
      else { const seg = plan.bench.slice(di, di + plan.nD); di += seg.length; if (!seg.length) continue; const b = { u: plan.u0, v: row.v, w: seg.length * plan.DW + 0.1, d: 0.75, items: [] }; seg.forEach((it, k) => { const st = Object.assign({}, it, { u: plan.u0 + 0.05 + k * plan.DW, v: row.v, w: plan.DW, d: 0.75, onBench: true, row: row.v }); stations.push(st); b.items.push(st); }); benches.push(b); }
    }
    plan.wall.forEach((it, k) => stations.push(Object.assign({}, it, { u: 0.2, v: 0.3 + k * 1.1, w: 0.5, d: 1.0, side: 'u' })));
    const first = stations.filter(s => s.row === 0.3 && !s.onBench); const conveyor = first.length >= 2 ? { u: plan.u0, v: 1.22, w: first.length * plan.BW - 0.05, d: 0.42 } : null;
    const L = Object.assign({}, base, { size: R, stations, benches, conveyor, door: { side: 'left', u: R - 2.1, w: 1.3 }, windows: [{ u: R * 0.18, w: 1.4, side: 'right' }, { u: R * 0.55, w: 1.4, side: 'right' }], wallItems: [{ type: 'board', u: R * 0.8, side: 'right' }, { type: 'poster', u: R - 3.6, side: 'left', color: base.posterCol }], plants: [{ u: R - 0.7, v: R - 0.7 }], sign: { u: R * 0.4 }, pack: { u: R - 2.6, v: R - 1.3, w: 1.5, d: 0.6 } });
    this._rooms[sig] = L; return L; },
  /* gabinete: consultas al fondo, mesas modulares de pre-examen (taburete para paciente y óptico), vitrinas en la pared, audiología y campímetro en su rincón, espera y recepción junto a la puerta */
  gabLayout(base) { const items = this.roomItems('gabinete'); const sig = 'g:' + items.map(x => x.id).join(','); this._rooms = this._rooms || {}; if (this._rooms[sig]) return this._rooms[sig];
    const stations = [], benches = []; const DW = 0.95, u0 = 1.6, nD = Math.floor((base.size - 0.3 - u0) / DW);
    const bench = items.filter(x => x.role === 'bench'); [4.3, 5.95].forEach((v, r) => { const seg = bench.slice(r * nD, (r + 1) * nD); if (!seg.length) return; const b = { u: u0, v, w: seg.length * DW + 0.1, d: 0.7, items: [], modular: true }; seg.forEach((it, k) => { const st = Object.assign({}, it, { u: u0 + 0.05 + k * DW, v, w: DW, d: 0.7, onBench: true, row: v }); stations.push(st); b.items.push(st); }); benches.push(b); });
    // vitrinas y columnas contra la pared izquierda (los kits se agrupan de dos en dos si no caben)
    let wall = items.filter(x => x.role === 'wall'); if (wall.length > 3) { const kits = wall.filter(x => x.arch[0] === 'vitr'), rest = wall.filter(x => x.arch[0] !== 'vitr'); const merged = []; for (let i = 0; i < kits.length; i += 2) { const a = kits[i], b = kits[i + 1]; merged.push(b ? Object.assign({}, a, { name: a.name + ' · ' + b.name, arch: ['vitr', a.arch[1], 0, { items: (a.arch[3].items || []).slice(0, 3).concat((b.arch[3].items || []).slice(0, 3)) }] }) : a); } wall = merged.concat(rest).slice(0, 3); }
    wall.forEach((it, k) => stations.push(Object.assign({}, it, { u: 0.2, v: 0.4 + k * 1.15, w: 0.5, d: 1.0, side: 'u' })));
    items.filter(x => x.role === 'corner').forEach(it => stations.push(Object.assign({}, it, it.arch[0] === 'audio' ? { u: 7.35, v: 6.4, w: 1.2, d: 1.2 } : { u: 6.2, v: 7.6, w: 0.6, d: 0.55 })));
    const L = Object.assign({}, base, { stations, benches }); this._rooms[sig] = L; return L; },
  /* banco corrido (taller: madera con cajones; laboratorio: blanco; gabinete: mesas modulares con taburetes) con sus equipos encima */
  drawBench(b, dept) { const u = b.u, v = b.v, w = b.w, d = b.d; const wood = dept === 'taller'; this.shadow(u, v, w, d, 0.5);
    if (b.modular) { b.items.forEach(st => { this.box(st.u + 0.05, v, 0, st.w - 0.1, d, 0.75, '#f1f2f6', { top: '#ffffff', right: '#cfd8dc' }); this.stool(st.u + st.w / 2 - 0.15, v + d + 0.12); this.stool(st.u + st.w / 2 - 0.15, v - 0.42); }); }
    else { this.box(u, v, 0, w, d, 0.8, wood ? '#8d6e4a' : '#e3e8ec', wood ? { top: '#b08c60', right: '#5f4630' } : { top: '#fafafa', right: '#b0bec5' }); const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); const n = Math.max(1, Math.round(w / 0.9));
      for (let k = 0; k < n; k++) { const a = 0.08 + k * w / n, c = a + w / n - 0.16; this.poly([P(a, d, 0.5), P(c, d, 0.5), P(c, d, 0.7), P(a, d, 0.7)], wood ? '#7a5c3c' : '#cfd8dc', 'rgba(0,0,0,0.25)'); const hm = P((a + c) / 2, d, 0.62); this.ctx.fillStyle = wood ? '#3e2b1a' : '#95a5a6'; this.ctx.fillRect(hm.x - 3, hm.y - 1, 6, 2); } }
    for (const st of b.items) this.drawStation(st, dept); },
  stool(u, v) { const s = this.scale(); const ctx = this.ctx; const b = this.iso(u + 0.15, v + 0.15, 0), t = this.iso(u + 0.15, v + 0.15, 0.45); ctx.strokeStyle = '#7f8c8d'; ctx.lineWidth = Math.max(2, s * 0.025); ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(t.x, t.y); ctx.stroke(); ctx.fillStyle = '#34495e'; ctx.beginPath(); ctx.ellipse(t.x, t.y, s * 0.11, s * 0.055, 0, 0, 7); ctx.fill(); ctx.fillStyle = '#4a6278'; ctx.beginPath(); ctx.ellipse(t.x, t.y - 2, s * 0.1, s * 0.048, 0, 0, 7); ctx.fill(); },
  /* cinta transportadora con piezas avanzando hacia la expedición */
  drawConveyor(c, dept) { const s = this.scale(); const ctx = this.ctx; const P = (du, dv, dz) => this.iso(c.u + du, c.v + dv, dz); this.box(c.u, c.v, 0, c.w, c.d, 0.45, '#636e72', { top: '#2d3436', right: '#4b5256' });
    for (let k = 0.2; k < c.w; k += 0.35) { const a = P(k, 0.04, 0.46), b = P(k, c.d - 0.04, 0.46); ctx.strokeStyle = 'rgba(255,255,255,0.12)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); }
    const busy = !!this.info(dept).busy; const n = Math.max(2, Math.floor(c.w / 0.7)); const off = busy ? (this.time / 3000) % 1 : 0.3;
    for (let k = 0; k < n; k++) { const f = ((k + off) / n) * (c.w - 0.3) + 0.15; const q = P(f, c.d / 2, 0.5); if (dept === 'lab') { ctx.fillStyle = '#0984e3'; ctx.fillRect(q.x - s * 0.08, q.y - s * 0.035, s * 0.16, s * 0.07); ctx.fillStyle = 'rgba(220,240,255,0.95)'; ctx.beginPath(); ctx.ellipse(q.x - s * 0.035, q.y - s * 0.01, s * 0.03, s * 0.02, 0, 0, 7); ctx.ellipse(q.x + s * 0.035, q.y - s * 0.01, s * 0.03, s * 0.02, 0, 0, 7); ctx.fill(); } else this.glasses(q.x, q.y - s * 0.02, s * 0.035, ['#c0392b', '#2c3e50', '#8e44ad', '#16a085'][k % 4], 0.5); } },
  /* mesa de expedición con cajas */
  drawPack(p) { this.shadow(p.u, p.v, p.w, p.d, 0.5); this.box(p.u, p.v, 0, p.w, p.d, 0.75, '#b08c60', { top: '#c9a678', right: '#7a5c3c' }); for (const [du, h] of [[0.1, 0.22], [0.45, 0.3], [0.85, 0.18]]) this.box(p.u + du, p.v + 0.12, 0.75, 0.32, 0.34, h, '#d4a373', { top: '#e3b98a', right: '#a9805a' }); this.box(p.u + 0.2, p.v + 0.16, 0.97, 0.3, 0.3, 0.16, '#d4a373', { top: '#e3b98a' }); },
  /* estantería o vitrina contra la pared izquierda (mira hacia +u) */
  wallUnit(st) { const u = st.u, v = st.v, d = st.d; const a = st.arch; const t = a[0]; const items = (a[3] && a[3].items) || [a[1] || '#95a5a6']; const P = (du, dv, dz) => this.iso(u + du, v + dv, dz); this.shadow(u, v, 0.5, d, 0.5);
    if (t === 'kiosk') { const col = a[1] || '#ffffff'; this.box(u + 0.05, v + 0.3, 0, 0.35, 0.4, 1.3, col, { top: this.shade(col, 0.2), right: this.shade(col, -0.15) }); this.poly([P(0.4, 0.35, 0.7), P(0.4, 0.65, 0.7), P(0.4, 0.65, 1.2), P(0.4, 0.35, 1.2)], '#1e272e'); this.poly([P(0.4, 0.38, 0.75), P(0.4, 0.62, 0.75), P(0.4, 0.62, 1.15), P(0.4, 0.38, 1.15)], '#74b9ff'); return; }
    const glass = t === 'vitr'; this.box(u, v + 0.05, 0, 0.45, d - 0.1, 1.55, glass ? '#f1f2f6' : '#7f8c8d', glass ? { top: '#ffffff', right: '#dfe6e9', left: '#cfd8dc' } : { top: '#95a5a6', right: '#8a969f', left: '#636e72' });
    for (let r = 0; r < 3; r++) { const z = 0.14 + r * 0.47; this.poly([P(0.45, 0.08, z - 0.02), P(0.45, d - 0.08, z - 0.02), P(0.45, d - 0.08, z), P(0.45, 0.08, z)], 'rgba(0,0,0,0.25)'); for (let k = 0; k < 3; k++) { const c = items[(r * 3 + k) % items.length]; this.box(u + 0.25, v + 0.12 + k * (d - 0.24) / 3, z, 0.18, (d - 0.24) / 3 - 0.05, glass ? 0.2 : 0.36, c, { top: this.shade(c, 0.25), right: this.shade(c, -0.1) }); } }
    if (glass) this.poly([P(0.46, 0.06, 0.04), P(0.46, d - 0.06, 0.04), P(0.46, d - 0.06, 1.5), P(0.46, 0.06, 1.5)], 'rgba(190,225,240,0.32)', 'rgba(90,110,125,0.6)', 1.5); },
  roomFurniture(L) {
    const out = []; const self = this; const dept = L.room; const info = this.info(dept); const busyK = info.busy ? 'B' : '';
    const add = (r, fn, extra) => out.push(Object.assign({ depth: r.u + r.v + (r.w + r.d) / 2, draw: fn, dynamic: true, rect: r, box: r, nav: r }, extra || {}));
    this._stations = L.stations || [];
    (L.benches || []).forEach((b, i) => add({ u: b.u, v: b.v - (b.modular ? 0.45 : 0), w: b.w, d: b.d + (b.modular ? 0.9 : 0) }, () => { self.cached('bench' + dept + i, { u: b.u, v: b.v - 0.45, w: b.w, d: b.d + 0.9 }, 2.0, b.items.map(x => x.id).join(',') + busyK, () => self.drawBench(b, dept)); if (info.busy) b.items.forEach((st, k) => self.stationPulse(st, k)); }));
    this._stations.filter(st => !st.onBench).forEach((st, i) => add({ u: st.u, v: st.v, w: st.w, d: st.d }, () => { self.cached('st' + dept + st.id, { u: st.u, v: st.v, w: st.w, d: st.d }, 2.2, st.id + busyK + (st.side || ''), () => st.side === 'u' ? self.wallUnit(st) : self.drawStation(st, dept)); if (info.busy && !st.side) self.stationPulse(st, i); }));
    if (L.conveyor) add(L.conveyor, () => self.drawConveyor(L.conveyor, dept));
    if (L.pack) add(L.pack, () => self.cached('pack' + dept, L.pack, 1.4, '', () => self.drawPack(L.pack)));
    if (dept === 'gabinete') {
      const own = info.owned || info.instruments || []; const two = own.indexOf('segundo_gabinete') >= 0; const boxInfo = Object.assign({}, info, { owned: own.filter(x => x !== 'campimetro') });
      L.boxes.slice(0, two ? 2 : 1).forEach((z, i) => add({ u: z.u, v: z.v, w: z.w, d: z.d }, () => self.cached('gbox' + i, z, 2.0, own.join(',') + i, () => self.drawGabinete(Object.assign({}, z, { glass: true }), true, boxInfo)), { depth: z.u + z.v }));
      if (!two && L.boxes[1]) { const z = L.boxes[1]; add({ u: z.u, v: z.v, w: z.w, d: z.d }, () => self.drawEmptySlot(z, 'Segunda consulta (se compra en el gabinete)'), { depth: z.u + z.v }); }
      for (const [i, ch] of (L.chairs || []).entries()) add({ u: ch.u, v: ch.v, w: 0.6, d: 0.6 }, () => self.cached('rchair' + i, { u: ch.u, v: ch.v, w: 0.6, d: 0.6 }, 1.0, '', () => self.drawChair(ch.u, ch.v, ch.dir || 0, '#5b7ea8')));
      if (L.reception) { const r = L.reception; add(r, () => self.cached('recep', r, 1.6, '', () => { self.shadow(r.u, r.v, r.w, r.d, 0.6); self.box(r.u, r.v, 0, r.w, r.d, 0.95, '#f1f2f6', { top: '#ffffff', right: '#cfd8dc' }); self.poly([self.iso(r.u, r.v + r.d, 0.55), self.iso(r.u + r.w, r.v + r.d, 0.55), self.iso(r.u + r.w, r.v + r.d, 0.62), self.iso(r.u, r.v + r.d, 0.62)], '#74b9ff'); self.drawComputer(r.u + 0.5, r.v + 0.05, 0.95, self.env().era, true); })); }
    }
    for (const [i, p] of (L.plants || []).entries()) add({ u: p.u, v: p.v, w: 0.6, d: 0.6 }, () => self.cached('rplant' + i, { u: p.u, v: p.v, w: 0.6, d: 0.6 }, 1.4, '', () => self.drawPlant(p.u, p.v, false)));
    return out;
  },
  /* personal: delante de los bancos y de las máquinas en isla (de espaldas); en el gabinete, en las consultas y al otro lado de las mesas de pre-examen */
  roomStaff(L) {
    const co = this.co(); const out = []; const dept = L.room; const st = (this._stations || []); let k = 0; const mine = co.staff.filter(c => c.assignment === dept && c.state !== 'vacation');
    const spots = dept === 'gabinete' ? [] : st.filter(x => !x.side && x.row !== 0.3 || x.onBench).map(x => ({ u: x.u + x.w / 2, v: x.v + x.d + (x.onBench ? 0.3 : 0.25) }));
    mine.forEach((ch) => { let uv, pose = 'work'; const i = co.staff.indexOf(ch);
      if (dept === 'gabinete') { const two = (this.info('gabinete').owned || []).indexOf('segundo_gabinete') >= 0; if (k < (two ? 2 : 1)) { const b = L.boxes[k]; uv = { u: b.u + 2.1, v: b.v + 1.6 }; pose = 'stand'; } else { const bs = st.filter(x => x.onBench); const sx = bs[(k - 1) % Math.max(1, bs.length)]; uv = sx ? { u: sx.u + sx.w / 2, v: sx.v - 0.28 } : { u: 4, v: 3.9 }; pose = 'stand'; } }
      else { const sp = spots.length ? spots[Math.min(spots.length - 1, Math.floor((k + 0.5) * spots.length / Math.max(1, mine.length)))] : null; uv = sp || { u: L.size / 2, v: L.size - 1.5 }; }
      k++; const pos = this.iso(uv.u, uv.v); out.push({ ch, x: pos.x, y: pos.y, u: uv.u, v: uv.v, pose, dept, i, depth: uv.u + uv.v, desk: null }); });
    return out;
  },
  /* pacientes del gabinete: en el sillón de cada consulta, en los taburetes de pre-examen y esperando */
  roomPatients(L) { if (L.room !== 'gabinete') return []; const info = this.info('gabinete'); const out = []; const self = this; const two = (info.owned || []).indexOf('segundo_gabinete') >= 0;
    const occ = +(info.busy || 0); const busyN = (info.patientsNow || 0) > 0 ? Math.min(two ? 2 : 1, info.patientsNow) : 0; const waiting = info.open === false ? 0 : Math.min((L.chairs || []).length, Math.round(occ * (L.chairs || []).length));
    const sit = (u, v, i, extra) => { const p = this.iso(u, v); out.push({ depth: u + v + 0.3, box: { u: u - 0.15, v: v - 0.15, w: 0.3, d: 0.3 }, draw: () => self.drawPerson(p.x, p.y + 2, Object.assign({ skin: (i * 3 + 1) % 6, hair: (i * 2 + 1) % 6, shirt: ['#7f8c8d', '#d35400', '#6c5ce7', '#00b894', '#e84393', '#2c3e50', '#8e44ad', '#16a085'][i % 8], female: i % 2 === 1, pose: 'sitPlain', scaleK: 0.95, anim: this.time / 1000 + i }, extra)) }); };
    for (let i = 0; i < busyN; i++) { const b = L.boxes[i]; sit(b.u + 1.1, b.v + 1.2, i + 10, { style: Object.assign({}, self.styleFor('pac' + i, i % 2 === 0), { glasses: 'round', frame: '#4a4f55' }) }); }
    const bs = (this._stations || []).filter(x => x.onBench); const nPre = info.open === false ? 0 : Math.min(bs.length, Math.round(occ * bs.length * 0.6)); for (let i = 0; i < nPre; i++) { const sx = bs[(i * 2) % bs.length]; sit(sx.u + sx.w / 2, sx.v + sx.d + 0.28, i + 20); }
    for (let i = 0; i < waiting; i++) { const c = L.chairs[i]; sit(c.u + 0.3, c.v + 0.3, i); }
    return out; },
  /* puesto bajo el ratón (nombre del equipo) */
  stationAt(x, y) { for (const st of (this._stations || [])) { if (this.inTileRect(x, y, st.u, st.v, st.w, st.d)) return st; } return null; },

  /* ================= clientes ================= */
  updateCustomers(dt) {
    const L = this.layout(); const co = this.co(); const ti = this.info('tienda'); const selling = co.gameLog.filter(g => !g.soldOut && g.releaseWeek !== undefined).length;
    const want = Math.min(6, Math.max(0, ti.customersNow !== undefined ? ti.customersNow : Math.min(3, selling)));
    if (this.customers.length < want && (this.time - (this.lastSpawn || 0)) > 1800) { this.lastSpawn = this.time; this.customers.push(this.newCustomer(L)); }
    for (let i = this.customers.length - 1; i >= 0; i--) { const c = this.customers[i]; this.stepCustomer(c, dt); if (c.done) { this.customers.splice(i, 1); } }
    if (this.customers.length > want + 1) { const c = this.customers[0]; if (c.phase < c.path.length - 1) c.phase = c.path.length - 1; }
  },
  newCustomer(L) { let door = L.door ? (L.door.side === 'left' ? { u: 0.3, v: L.door.u + 0.5 } : { u: L.door.u + 0.5, v: 0.3 }) : { u: 0.5, v: L.size - 0.5 }; const stops = L.stops && L.stops.length ? L.stops : [{ u: L.size / 2, v: L.size / 2 }]; let stop = stops[Math.floor(Math.random() * stops.length)]; let counter = L.counter ? { u: L.counter.u + L.counter.w / 2, v: L.counter.v + L.counter.d + 0.7 } : stop; if (!this.nav) this.buildNav(); const snap = p => { const c = this.navCell(p); if (this.navFree(c[0], c[1])) return p; const f = this.navNearest(c); return { u: (f[0] + 0.5) * this.nav.res, v: (f[1] + 0.5) * this.nav.res }; }; door = snap(door); stop = snap(stop); counter = snap(counter); const path = [door]; const waits = [0]; const legs = [[stop, 1800 + Math.random() * 2500], [counter, 1500 + Math.random() * 1500], [door, 0]]; for (const [tgt, wt] of legs) { const seg = this.findPath(path[path.length - 1], tgt); for (let k = 1; k < seg.length; k++) { path.push(seg[k]); waits.push(k === seg.length - 1 ? wt : 0); } }
    return { u: door.u, v: door.v, path, waits, stopIdx: waits.findIndex(x => x > 0), phase: 0, wait: 0, speed: 0.0011 + Math.random() * 0.0005, look: Math.floor(Math.random() * 6), shirt: ['#7f8c8d', '#2c3e50', '#d35400', '#6c5ce7', '#00b894', '#e84393'][Math.floor(Math.random() * 6)], female: Math.random() < 0.5, trying: false, done: false, t: Math.random() * 10, seed: 'c' + Math.floor(Math.random() * 1e6), buys: Math.random() < 0.6, buyIdx: waits.length - 2 - [...waits].reverse().slice(1).findIndex(x => x > 0) }; },
  stepCustomer(c, dt) { c.t += dt / 1000; const tgt = c.path[c.phase + 1]; if (!tgt) { c.done = true; return; } if (c.wait > 0) { c.wait -= dt; c.trying = c.phase === c.stopIdx; return; } c.trying = false; const du = tgt.u - c.u, dv = tgt.v - c.v; const dist = Math.hypot(du, dv); const step = c.speed * dt; if (dist <= step) { c.u = tgt.u; c.v = tgt.v; c.phase++; c.wait = c.waits[c.phase] || 0; if (c.phase >= c.path.length - 1) c.done = true; } else { c.u += du / dist * step; c.v += dv / dist * step; } },
  drawCustomer(c) { const p = this.iso(c.u, c.v); const moving = c.wait <= 0; if (!c.style) { const E = this.env(); c.style = Object.assign({}, this.styleFor(c.seed || 'c', c.female)); c.sun = E.summer && Math.random() < 0.35; if (c.sun) c.style.glasses = c.style.glasses || 'aviator'; else if (Math.random() < 0.4) c.style.glasses = null; }
    let st = c.style, sunNow = c.sun; if (c.trying) { const n = Math.floor(c.t / 1.1); c.tryStyle = c.tryStyle || Object.assign({}, c.style); c.tryStyle.glasses = this.GL_SHAPES[(n + c.look) % this.GL_SHAPES.length]; c.tryStyle.frame = ['#c0392b', '#2c3e50', '#8e44ad', '#b7950b', '#16a085', '#1d1d1d'][(n * 7 + c.look) % 6]; st = c.tryStyle; sunNow = false; }
    this.drawPerson(p.x, p.y, { skin: c.look, hair: (c.look + 1) % 6, shirt: c.shirt, female: c.female, pose: moving ? 'walk' : 'stand', anim: c.t, scaleK: 0.95, style: st, sun: sunNow, bag: c.buys && c.buyIdx >= 0 && (c.phase > c.buyIdx || (c.phase === c.buyIdx && c.wait <= 0)) });
    if (c.trying && c.buys && c.wait < 700) { const k = this.scale() / 90 * 0.95, ctx = this.ctx, hx = p.x + 17 * k, hy = p.y - 92 * k - (700 - c.wait) / 700 * 6 * k; ctx.save(); ctx.globalAlpha = Math.min(1, (700 - c.wait) / 200); ctx.fillStyle = '#e84393'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(hx, hy + 4 * k); ctx.bezierCurveTo(hx - 7 * k, hy - 1 * k, hx - 4 * k, hy - 7 * k, hx, hy - 3 * k); ctx.bezierCurveTo(hx + 4 * k, hy - 7 * k, hx + 7 * k, hy - 1 * k, hx, hy + 4 * k); ctx.fill(); ctx.stroke(); ctx.restore(); } },

  drawLabels() {
    const ctx0 = this.ctx; const h = this.hover;
    if (h && h.type === 'staff' && h.staff) { const ch = h.staff; const pl = (this._placed || []).find(p => p.ch === ch); if (pl) { const st = ch.assignment ? 'en ' + ((Modules.get(ch.assignment) || {}).name || ch.assignment) : ({ idle: 'libre', working: 'trabajando', researching: 'investigando', training: 'en formación', vacation: 'de vacaciones' }[ch.state] || ch.state); const lines = [ch.name, (ch.roleInfo ? ch.roleInfo().name : '') + ' · nivel ' + ch.level(), 'D ' + Math.floor(500 * ch.designFactor) + '  T ' + Math.floor(500 * ch.technologyFactor) + '  I ' + Math.floor(500 * ch.researchFactor), st + ' · rendimiento ' + Math.round(ch.efficiency * 100) + ' %']; this.tooltip(pl.x, pl.y - 100 * this.scale() / 90, lines); } }
    if (h && h.type === 'station') { const st = h.st; const c = this.iso(st.u + st.w / 2, st.v + st.d / 2, 1.6); this.tooltip(c.x, c.y - 10, [st.name, 'Clic para abrir el departamento']); return; }
    if (h && h.type === 'dept') { const m = Modules.get(h.dept); const z = this.layout().depts[h.dept]; if (m && z && m.report) { let rep = []; try { rep = m.report(this.co()) || []; } catch (e) { rep = []; } const c = this.iso(z.u + z.w / 2, z.v + z.d / 2, 2.3); const ft = this.featured(h.dept); this.tooltip(c.x, c.y - 30, [(m.icon || '') + ' ' + m.name].concat(rep.slice(0, 3).map(r => r.label + ': ' + r.value)).concat(ft ? ['A la vista: ' + ft] : []).concat(['Clic para abrir'])); return; } }
    this.drawLabelsBase();
  },
  tooltip(x, y, lines) { lines = lines.map(l => String(l).replace(/(^|[^\d.])(\d+)\.(\d{1,2})(?![\d.])/g, '$1$2,$3')); const ctx = this.ctx; ctx.save(); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.font = '12px "Segoe UI", sans-serif'; const w = Math.max(...lines.map(l => ctx.measureText(l).width)) + 18; const hgt = lines.length * 16 + 10; let bx = Math.min(Math.max(4, x - w / 2), this.W - w - 4), by = Math.max(4, y - hgt); ctx.fillStyle = 'rgba(255,249,239,0.97)'; ctx.strokeStyle = '#FFD17B'; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(bx, by, w, hgt, 6); ctx.fill(); ctx.stroke(); lines.forEach((l, i) => { ctx.fillStyle = i === 0 ? '#252525' : '#5a5148'; ctx.font = (i === 0 ? 'bold ' : '') + '12px "Segoe UI", sans-serif'; ctx.fillText(l, bx + 9, by + 18 + i * 16); }); ctx.restore(); },
  drawLabelsBase() {
    const ctx = this.ctx; const L = this.layout(); const s = this.scale();
    if (this.hover && this.hover.type === 'dept') { const z = L.depts[this.hover.dept]; const m = (typeof Modules !== 'undefined') ? Modules.get(this.hover.dept) : null; if (z && m) { const c = this.iso(z.u + z.w / 2, z.v + z.d / 2, 2.3); ctx.save(); ctx.font = 'bold 13px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; const txt = (m.icon || '') + ' ' + m.name; const w = ctx.measureText(txt).width + 18; ctx.fillStyle = 'rgba(43,36,32,0.9)'; ctx.beginPath(); ctx.roundRect(c.x - w / 2, c.y - 24, w, 24, 6); ctx.fill(); ctx.fillStyle = '#ffd166'; ctx.fillText(txt, c.x, c.y - 7); ctx.restore(); } }
  },

  /* ================= burbujas de puntos ================= */
  drawPoints(dt) {
    const ctx = this.ctx; const tg = this.target(); const placed = this._placed || this.placeStaff(); const s = this.scale(); const k = s / 90;
    for (const p of G.points) {
      if (p.delay > 0) continue; const pl = placed.find(q => q.ch.id === p.ch) || (this.inRoom() ? null : placed[0]); if (!pl) continue; const from = { x: pl.x, y: pl.y - 80 * k };
      const kk = Math.min(1, p.t / p.duration); const e = kk < 0.5 ? 2 * kk * kk : -1 + (4 - 2 * kk) * kk; // ease in-out
      const cx = (from.x + tg.x) / 2, cy = Math.min(from.y, tg.y) - 90; const x = (1 - e) * (1 - e) * from.x + 2 * (1 - e) * e * cx + e * e * tg.x, y = (1 - e) * (1 - e) * from.y + 2 * (1 - e) * e * cy + e * e * tg.y;
      const col = this.COLORS[p.type] || '#999'; const r = (kk < 0.15 ? 6 + 6 * (kk / 0.15) : 12) * (1 - 0.35 * Math.max(0, (kk - 0.7) / 0.3)); ctx.globalAlpha = kk > 0.88 ? (1 - kk) / 0.12 : 1;
      ctx.beginPath(); ctx.arc(x, y + 3, r, 0, 7); ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.fill();
      const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.2, x, y, r); g.addColorStop(0, this.shade(col, 0.45)); g.addColorStop(1, col); ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(255,255,255,0.9)'; ctx.lineWidth = 2; ctx.stroke();
      ctx.fillStyle = '#fff'; ctx.font = `bold ${Math.round(r * 0.95)}px "Segoe UI", sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText({ d: 'D', t: 'T', r: 'I', b: '✕', br: '✔', e: 'E' }[p.type] || '?', x, y + 1); ctx.textBaseline = 'alphabetic'; ctx.globalAlpha = 1;
      if (kk > 0.97 && !p._popped) { p._popped = true; this.pops.push({ x: tg.x, y: tg.y, t: 0, col }); }
    }
  },
  drawPops(dt) { const ctx = this.ctx; for (let i = this.pops.length - 1; i >= 0; i--) { const p = this.pops[i]; p.t += dt; if (p.t > 260) { this.pops.splice(i, 1); continue; } const k = p.t / 260; ctx.globalAlpha = 1 - k; ctx.strokeStyle = p.col; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 6 + 18 * k, 0, 7); ctx.stroke(); ctx.globalAlpha = 1; } },
  addFloater(text, color) { const busy = this.floaters.filter(f => f.t < 900).length; this.floaters.push({ text, color: color || '#27ae60', t: 0, x: this.W * 0.5 + (Math.random() - 0.5) * 160, y: this.H * 0.42 + busy * 26 }); }, /* los que coinciden se apilan en vez de solaparse */
  drawFloaters(dt) { const ctx = this.ctx; for (let i = this.floaters.length - 1; i >= 0; i--) { const f = this.floaters[i]; f.t += dt; if (f.t > 1800) { this.floaters.splice(i, 1); continue; } ctx.save(); ctx.globalAlpha = Math.min(1, 1.3 - f.t / 1800); ctx.font = 'bold 16px "Segoe UI", sans-serif'; ctx.textAlign = 'center'; ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(255,255,255,0.85)'; ctx.fillStyle = f.color; const y = f.y - f.t / 22; ctx.strokeText(f.text, f.x, y); ctx.fillText(f.text, f.x, y); ctx.restore(); } }
};

/* ================= distribuciones por nivel (coordenadas de baldosa) =================
   size: lado de la sala · desks: puestos de trabajo (origen de la mesa) · counter: mostrador · door/windows/wallItems · stops: paradas de clientes · depts: zonas
   audio: hueco de la cabina de audiología (solo se dibuja si se ha comprado) */
const ROOMS = {
  taller: { room: 'taller', grow: true, posterCol: '#e67e22', title: 'Taller de monturas', size: 9, desks: [], depts: {}, door: { side: 'left', u: 6.9, w: 1.3 }, windows: [{ u: 1.2, w: 1.4, side: 'right' }, { u: 4.4, w: 1.4, side: 'right' }], wallItems: [{ type: 'board', u: 6.7, side: 'right' }, { type: 'poster', u: 3.4, side: 'left', color: '#e67e22' }], plants: [{ u: 8.3, v: 8.3 }], sign: { u: 3.2 },
    pal: { floor: ['#bdb8b0', '#b1aba2'], wallR: '#e3e6e8', wallL: '#d3d8dc' }, slots: [0.35, 2.4, 4.45, 6.5].flatMap(v => [0.4, 1.75, 3.1, 4.45, 5.8, 7.15].map(u => ({ u, v, w: 1.05, d: 0.85 }))).filter(sl => !(sl.u < 1 && sl.v > 6)) },
  lab: { room: 'lab', grow: true, posterCol: '#0984e3', title: 'Laboratorio de lentes', size: 9, desks: [], depts: {}, door: { side: 'left', u: 6.9, w: 1.3 }, windows: [{ u: 1.2, w: 1.4, side: 'right' }, { u: 4.4, w: 1.4, side: 'right' }], wallItems: [{ type: 'board', u: 6.7, side: 'right' }, { type: 'poster', u: 3.4, side: 'left', color: '#0984e3' }], plants: [{ u: 8.3, v: 8.3 }], sign: { u: 3.2 },
    pal: { floor: ['#eef3f6', '#e3eaee'], wallR: '#f1f4f6', wallL: '#e1e7eb' }, slots: [0.35, 2.4, 4.45, 6.5].flatMap(v => [0.4, 1.75, 3.1, 4.45, 5.8, 7.15].map(u => ({ u, v, w: 1.05, d: 0.85 }))).filter(sl => !(sl.u < 1 && sl.v > 6)) },
  gabinete: { room: 'gabinete', title: 'Gabinete optométrico', size: 9, desks: [], depts: {}, door: { side: 'left', u: 4.3, w: 1.2 }, windows: [{ u: 7.7, w: 1.0, side: 'right' }], wallItems: [{ type: 'optotipo', u: 2.4, side: 'right' }, { type: 'screen', u: 5.0, w: 1.6, side: 'right' }, { type: 'poster', u: 6.6, side: 'left', color: '#0984e3' }], plants: [{ u: 8.3, v: 8.3 }], sign: { u: 4.6 },
    pal: { floor: ['#dbe7ef', '#cfdde7'], wallR: '#f2f6f9', wallL: '#e3ebf1' }, boxes: [{ u: 1.2, v: 0.35, w: 3.3, d: 3.0 }, { u: 4.85, v: 0.35, w: 3.3, d: 3.0 }],
    slots: [{ u: 7.55, v: 0.4 }, { u: 7.55, v: 1.9 }].concat([1.75, 3.1, 4.45, 5.8, 7.15].map(u => ({ u, v: 4.0 })), [1.75, 3.1, 4.45, 5.8, 7.15].map(u => ({ u, v: 5.8 }))).map(sl => Object.assign({ w: 1.05, d: 0.85 }, sl)),
    chairs: [{ u: 0.25, v: 6.0, dir: 2 }, { u: 0.25, v: 6.75, dir: 2 }, { u: 0.25, v: 7.5, dir: 2 }, { u: 0.25, v: 8.25, dir: 2 }], reception: { u: 3.6, v: 7.75, w: 2.0, d: 0.7 } }
};
const LAYOUTS = {
  1: { size: 6, desks: [{ u: 0.5, v: 0.6 }, { u: 2.6, v: 0.6 }], counter: { u: 2.3, v: 3.9, w: 2.6, d: 0.8 }, standDisplays: [{ u: 4.6, v: 0.5, kind: 'rotativo' }, { u: 0.6, v: 3.2, kind: 'rotativo' }], stops: [{ u: 4.9, v: 1.9 }, { u: 1.9, v: 3.6 }], sign: { u: 3 }, depts: {} },
  2: { size: 9, desks: [{ u: 0.6, v: 1.2 }, { u: 3.2, v: 1.2 }, { u: 0.6, v: 3.6 }, { u: 3.2, v: 3.6 }, { u: 5.8, v: 1.2 }], counter: { u: 5.6, v: 6.3, w: 2.6, d: 0.9 }, door: { side: 'left', u: 6.6, w: 1.2 }, windows: [{ u: 0.6, w: 1.4, side: 'right' }, { u: 0.6, w: 1.2, side: 'left' }, { u: 2.2, w: 1.2, side: 'left' }],
     wallItems: [{ type: 'display', u: 2.4, w: 1.6, side: 'right' }, { type: 'display', u: 4.3, w: 1.6, side: 'right' }, { type: 'board', u: 6.2, side: 'right' }, { type: 'mirror', u: 4.0, side: 'left' }, { type: 'poster', u: 5.0, side: 'left', color: '#2c3e50' }],
     standDisplays: [{ u: 7.8, v: 2.6, kind: 'vitrina' }, { u: 7.8, v: 3.8, kind: 'vitrina' }], plants: [{ u: 0.3, v: 8.1 }, { u: 8.2, v: 0.4 }], chairs: [{ u: 1.2, v: 6.4, dir: 1 }, { u: 2.1, v: 6.4, dir: 1 }], table: { u: 1.3, v: 7.3 }, rug: { u: 1.0, v: 6.1, w: 2.4, d: 2.2, color: '#5aa9a3' }, stops: [{ u: 6.5, v: 1.5 }, { u: 7.0, v: 3.6 }, { u: 3.9, v: 0.9 }], sign: { u: 5 },
     depts: { tienda: { u: 7.6, v: 4.9, w: 1, d: 1, stand: [{ u: 7.2, v: 6.0 }, { u: 4.9, v: 7.6 }] }, marketing: { u: 0.6, v: 5.6, w: 1.6, d: 1.0, stand: [{ u: 1.5, v: 5.4 }] } } },
  3: { size: 11, desks: [{ u: 0.6, v: 1.2 }, { u: 3.2, v: 1.2 }, { u: 0.6, v: 3.6 }, { u: 3.2, v: 3.6 }, { u: 0.6, v: 6.0 }], counter: { u: 7.0, v: 8.0, w: 2.8, d: 0.9 }, door: { side: 'left', u: 8.6, w: 1.2 }, windows: [{ u: 0.6, w: 1.4, side: 'right' }, { u: 0.8, w: 1.2, side: 'left' }, { u: 2.6, w: 1.2, side: 'left' }, { u: 4.4, w: 1.2, side: 'left' }],
     wallItems: [{ type: 'display', u: 2.4, w: 1.6, side: 'right' }, { type: 'display', u: 4.3, w: 1.6, side: 'right' }, { type: 'display', u: 6.2, w: 1.6, side: 'right' }, { type: 'optotipo', u: 9.6, side: 'right' }, { type: 'mirror', u: 6.2, side: 'left' }, { type: 'poster', u: 7.2, side: 'left', color: '#8e44ad' }],
     standDisplays: [{ u: 9.8, v: 3.6, kind: 'vitrina' }, { u: 9.8, v: 4.8, kind: 'vitrina' }, { u: 5.9, v: 9.6, kind: 'rotativo' }], plants: [{ u: 0.3, v: 10.2 }, { u: 10.2, v: 2.6 }, { u: 6.4, v: 0.3 }], chairs: [{ u: 1.4, v: 8.6, dir: 1 }, { u: 2.3, v: 8.6, dir: 1 }, { u: 3.2, v: 8.6, dir: 1 }], table: { u: 1.8, v: 9.6 }, rug: { u: 1.1, v: 8.3, w: 3.2, d: 2.4, color: '#5aa9a3' }, stops: [{ u: 7.0, v: 1.6 }, { u: 9.0, v: 4.4 }, { u: 4.0, v: 0.9 }, { u: 6.3, v: 8.8 }], sign: { u: 5 },
     depts: { gabinete: { u: 7.8, v: 0.4, w: 2.9, d: 2.6, glass: true, stand: [{ u: 9.55, v: 1.95 }] }, taller: { u: 6.2, v: 3.0, w: 2.6, d: 2.0, stand: [{ u: 6.5, v: 5.3 }, { u: 8.5, v: 5.3 }] }, lab: { u: 3.4, v: 6.0, w: 2.6, d: 1.4, stand: [{ u: 4.0, v: 7.75 }, { u: 5.3, v: 7.75 }] }, tienda: { u: 9.8, v: 6.2, w: 1, d: 1, stand: [{ u: 8.6, v: 7.6 }, { u: 5.9, v: 8.4 }] }, marketing: { u: 6.6, v: 5.8, w: 1.6, d: 1.0, stand: [{ u: 7.6, v: 5.6 }] } }, audio: { u: 9.75, v: 9.75 } },
  4: { size: 13, desks: [{ u: 0.6, v: 1.2 }, { u: 3.2, v: 1.2 }, { u: 5.8, v: 1.2 }, { u: 0.6, v: 3.6 }, { u: 3.2, v: 3.6 }, { u: 5.8, v: 3.6 }, { u: 0.6, v: 6.0 }], counter: { u: 8.6, v: 9.6, w: 3.2, d: 0.9 }, door: { side: 'left', u: 10.4, w: 1.4 }, windows: [{ u: 0.6, w: 1.6, side: 'right' }, { u: 0.8, w: 1.4, side: 'left' }, { u: 2.8, w: 1.4, side: 'left' }, { u: 4.8, w: 1.4, side: 'left' }, { u: 6.8, w: 1.4, side: 'left' }],
     wallItems: [{ type: 'display', u: 2.6, w: 1.8, side: 'right' }, { type: 'display', u: 4.7, w: 1.8, side: 'right' }, { type: 'display', u: 6.8, w: 1.8, side: 'right' }, { type: 'screen', u: 9.0, w: 1.8, side: 'right' }, { type: 'optotipo', u: 11.6, side: 'right' }, { type: 'mirror', u: 8.6, side: 'left' }, { type: 'poster', u: 9.5, side: 'left', color: '#c0392b' }],
     standDisplays: [{ u: 11.8, v: 4.0, kind: 'vitrina' }, { u: 11.8, v: 5.2, kind: 'vitrina' }, { u: 11.8, v: 6.4, kind: 'vitrina' }, { u: 7.4, v: 11.6, kind: 'rotativo' }, { u: 4.6, v: 11.6, kind: 'rotativo' }], plants: [{ u: 0.3, v: 12.2 }, { u: 12.2, v: 2.8 }, { u: 8.2, v: 0.3 }, { u: 6.2, v: 8.3 }], chairs: [], sofa: { u: 1.4, v: 10.4 }, table: { u: 1.8, v: 11.6 }, rug: { u: 1.0, v: 10.0, w: 3.4, d: 2.8, color: '#5a7fa8' }, stops: [{ u: 7.6, v: 1.8 }, { u: 10.8, v: 4.9 }, { u: 4.4, v: 0.9 }, { u: 7.8, v: 10.6 }, { u: 10.2, v: 2.2 }], sign: { u: 6 },
     depts: { gabinete: { u: 9.6, v: 0.4, w: 3.2, d: 3.0, glass: true, stand: [{ u: 11.35, v: 1.9 }] }, taller: { u: 7.6, v: 3.6, w: 3.4, d: 2.2, stand: [{ u: 9.7, v: 6.15 }, { u: 10.7, v: 6.15 }] }, lab: { u: 3.2, v: 6.4, w: 3.4, d: 2.2, stand: [{ u: 4.0, v: 8.95 }, { u: 5.6, v: 8.95 }] }, tienda: { u: 11.8, v: 7.8, w: 1, d: 1, stand: [{ u: 10.6, v: 9.0 }, { u: 7.8, v: 9.4 }, { u: 10.0, v: 7.2 }] }, marketing: { u: 7.4, v: 6.8, w: 1.6, d: 1.0, stand: [{ u: 8.4, v: 6.6 }, { u: 6.9, v: 8.0 }] } }, audio: { u: 11.7, v: 11.5 } }
};
