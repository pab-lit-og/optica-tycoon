/* Óptica Tycoon — motor de juego (lógica portada de la estructura de Game Dev Tycoon) */
'use strict';

const C = DATA.CONST;
const WEEK_MS = C.SECONDS_PER_WEEK * 1000;

/* ---------- utilidades ---------- */
const U = {
  clamp: (v, a, b) => Math.min(Math.max(v, a), b),
  rnd: () => Math.random(),
  sign: () => (Math.random() < 0.5 ? -1 : 1),
  pick: arr => arr[Math.floor(Math.random() * arr.length)],
  shuffle: arr => { const a = arr.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; },
  guid: () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36),
  weekFromDate: (s) => { const p = s.split('/').map(Number); return (p[0] - 1) * 48 + (p[1] - 1) * 4 + ((p[2] || 1) - 1); },
  /* calendario real: el año 1 de la partida es 1995 */
  YEAR0: 1994, MONTHS: ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'],
  /* calendario: la partida empieza en co.startYear (1965…2026). currentWeek = semanas transcurridas desde el inicio.
     Las fechas del contenido ('a/m/s' en data.js y módulos) van en el calendario 1995 (año 1 = 1995, admite años ≤ 0 para antes). */
  startYear: () => (typeof G !== 'undefined' && G.company && G.company.startYear) || 1995,
  shiftWeeks: () => (U.startYear() - 1995) * 48,
  absWeek: w => w + U.shiftWeeks(),                 /* semana transcurrida → semana del calendario 1995 */
  gameWeek: s => U.weekFromDate(s) - U.shiftWeeks(), /* fecha de contenido → semana transcurrida de esta partida */
  realYear: y => y + U.startYear() - 1,
  shortDate: w => { const d = U.dateFromWeek(w); return U.MONTHS[d.month - 1].slice(0, 3) + ' ' + U.realYear(d.year); },
  dateFromWeek: (w) => { w = Math.floor(w); const y = Math.floor(w / 48); const r = w - y * 48; return { year: y + 1, month: Math.floor(r / 4) + 1, week: (r % 4) + 1 }; },
  money: (n) => { n = Math.round(n); const s = Math.abs(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'); return (n < 0 ? '-' : '') + s + ' €'; },
  shortMoney: (n) => { const a = Math.abs(n); let s; if (a >= 1e6) s = (a / 1e6).toFixed(a >= 1e7 ? 0 : 1).replace('.', ',') + ' M'; else if (a >= 1e3) s = Math.round(a / 1e3) + ' K'; else s = Math.round(a).toString(); return (n < 0 ? '-' : '') + s + ' €'; },
  num: (n) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.'),
  vIndex: v => C.V_LEVELS.indexOf(v),
  avg: arr => arr.reduce((a, b) => a + b, 0) / (arr.length || 1)
};

/* ---------- niveles / experiencia ---------- */
const Level = {
  getLevel(xp) { xp = xp || 0; let lvl = 1; for (let i = 0; i < C.XP_LEVELS.length; i++) if (xp >= C.XP_LEVELS[i]) lvl = i + 2; return lvl; },
  bonus(xp) { const l = Level.getLevel(xp); return l === 1 ? 1 : 1 + (l - 1) / 10 * 0.5; },
  xpForLevel(l) { l = Math.floor(l); return l <= 1 ? 0 : C.XP_LEVELS[Math.min(l - 2, C.XP_LEVELS.length - 1)]; },
  progress(xp) { const l = Level.getLevel(xp); const lo = Level.xpForLevel(l), hi = Level.xpForLevel(l + 1); return hi === lo ? 0 : U.clamp((xp - lo) / (hi - lo), 0, 1); }
};

/* ---------- acceso a datos ---------- */
const DB = {
  topic: id => DATA.TOPICS.find(t => t.id === id),
  genre: id => DATA.GENRES.find(g => g.id === id),
  genreIndex: id => DATA.GENRES.findIndex(g => g.id === id),
  platform: id => DATA.PLATFORMS.find(p => p.id === id),
  part: id => DATA.PARTS.find(p => p.id === id),
  research: id => DATA.RESEARCH.find(r => r.id === id),
  mission: id => DATA.MISSIONS.find(m => m.id === id),
  missionIndex: id => DATA.MISSIONS.findIndex(m => m.id === id),
  training: id => DATA.TRAINING.find(t => t.id === id),
  item: id => DB.research(id) || DB.part(id),
  audienceIndex: a => ({ young: 0, everyone: 1, mature: 2 })[a]
};

/* ---------- pesos de tipo / público (GameGenre, Platforms, General) ---------- */
const W = {
  genre(arr, g, g2) { if (!arr) return 1; if (g2) return (W.genre(arr, g2) + 2 * W.genre(arr, g)) / 3; const v = arr[DB.genreIndex(g)]; return v === undefined ? 0.8 : v; }, /* 0,8 para vectores antiguos sin el 7.º tipo (Inteligente) */
  golden(g, g2) { if (g2) return (2 * W.golden(g) + W.golden(g2)) / 3; return DB.genre(g).goldenRatio; },
  audience(arr, a) { if (!a || !arr) return 1; return arr[DB.audienceIndex(a)]; },
  normGenre(v) { return v === 1 ? 1.1 : v === 0.9 ? 1.05 : v === 0.8 ? 1 : v === 0.7 ? 0.95 : v === 0.6 ? 0.9 : 1; },
  normAudience(v) { return v >= 0.8 ? v + 0.2 : v >= 0.7 ? v + 0.1 : v + 0.05; },
  platformGenre(platforms, g, g2) { let d = 1, k = 1, m = 0; for (let i = 0; i < platforms.length; i++) { const arr = platforms[i].gw; const wgt = g2 ? (W.normGenre(W.genre(arr, g2)) + 2 * W.normGenre(W.genre(arr, g))) / 3 : W.normGenre(W.genre(arr, g)); if (i < platforms.length - 1) { d *= 0.7; m += wgt * d; k -= d; } else m += wgt * k; } return m; },
  platformAudience(platforms, a, raw) { if (!a) return 1; let d = 1, k = 1, m = 0; for (let i = 0; i < platforms.length; i++) { const v = platforms[i].aw[DB.audienceIndex(a)]; const wgt = raw ? v : W.normAudience(v); if (i < platforms.length - 1) { d *= 0.7; m += wgt * d; k -= d; } else m += wgt * k; } return m; },
  missionGenre(mission, game) { const arr = mission.gw.slice(); const t = DB.topic(game.topic); if (t && t.mo) { const mi = DB.missionIndex(mission.id); for (let gi = 0; gi < t.mo.length; gi++) { const o = t.mo[gi][mi]; if (o) arr[gi] = o; } } return W.genre(arr, game.genre, game.secondGenre); }
};

/* ---------- canales: cuota de mercado por semana ---------- */
const Platforms = {
  /* since = año real desde el que existía el canal: en partidas que empiezan antes de 1995 se adelanta su apertura */
  publishWeek: p => { const w = U.weekFromDate(p.published); if (p.since && U.startYear() < 1995) return Math.min(w, U.weekFromDate(`${p.since - 1994}/1/1`)); return w; },
  retireWeek: p => U.weekFromDate(p.retire),
  /* semana en que el canal se abre AL JUGADOR. En 1995 coincide con su aparición. Si la partida empieza en otra época, los canales que ya
     existían no se abren todos de golpe: tienda y mercadillos desde el principio y el resto, del más barato al más caro, uno cada pocos meses
     (como la progresión de la partida clásica). El tamaño de su mercado sigue la fecha real (publishWeek). */
  openWeek(p) { const pw = Platforms.publishWeek(p); if (p.isCustom || U.startYear() === 1995) return pw; const s0 = U.absWeek(0); if (pw > s0 || !p.licencePrize) return Math.max(pw, s0);
    const key = U.startYear(); if (!Platforms._stag || Platforms._stag.key !== key) { const past = key < 1995; const ex = DATA.PLATFORMS.filter(x => !x.isCustom && x.licencePrize && (past || !x.pastOnly) && Platforms.publishWeek(x) <= s0 && Platforms.retireWeek(x) > s0).sort((a, b) => a.licencePrize - b.licencePrize || Platforms.publishWeek(a) - Platforms.publishWeek(b)); const gap = Math.min(16, Math.floor(240 / Math.max(1, ex.length))); const at = {}; ex.forEach((x, i) => { at[x.id] = s0 + 12 + i * gap; }); Platforms._stag = { key, at }; }
    const a = Platforms._stag.at[p.id]; return a === undefined ? pw : a; },
  marketSizeForWeek(p, week) { return Platforms.rawMarketSize(p, week) * ((G.company && G.company.marketScale) || 1); },
  /* tamaño de mercado sin escalar (week = semana transcurrida de la partida) */
  rawMarketSize(p, week) {
    week = U.absWeek(week);
    if (p.isCustom) { /* canal propio (I+D): la cuota crece con los clientes fieles */ if (week < Platforms.publishWeek(p)) return 0; const fans = G.company ? G.company.fans : 0; return 5e6 * U.clamp(p.baseAmount + (p.fansScale || 0) * fans / 1e6, p.baseAmount, p.maxAmount || 6); }
    let m = week - Platforms.publishWeek(p); if (m < 0) return 0;
    let l = p.startAmount, g = p.unitsSold, n = Platforms.retireWeek(p) - Platforms.publishWeek(p);
    if (p.marketKeyPoints) {
      let k = Platforms.publishWeek(p); n = Platforms.retireWeek(p);
      for (let r = 0; r < p.marketKeyPoints.length; r++) { const w = U.weekFromDate(p.marketKeyPoints[r].date); if (week >= w) { m = week - w; l = p.marketKeyPoints[r].amount; k = w; } }
      for (let r = p.marketKeyPoints.length - 1; r >= 0; r--) { const w = U.weekFromDate(p.marketKeyPoints[r].date); if (week <= w) { n = w; g = p.marketKeyPoints[r].amount; } }
      n -= k;
    }
    if (n === 0) return 5e6 * l; if (m > n) m = n;
    return 5e6 * (m / n * (g - l) + l);
  },
  /* canales que existen en el mercado (para escalar el tamaño de la partida) */
  existing(week) { week = U.absWeek(week); const past = U.startYear() < 1995; return DATA.PLATFORMS.filter(p => (past || !p.pastOnly) && Platforms.publishWeek(p) <= week && Platforms.retireWeek(p) > week); },
  /* canales abiertos al jugador */
  onMarket(week) { week = U.absWeek(week); const past = U.startYear() < 1995; const lic = (G.company && G.company.licencedPlatforms) || []; return DATA.PLATFORMS.filter(p => (past || !p.pastOnly) && (Platforms.openWeek(p) <= week || (lic.includes(p.id) && Platforms.publishWeek(p) <= week)) && Platforms.retireWeek(p) > week); },
  totalMarket(week) { return Platforms.onMarket(week).reduce((s, p) => s + Platforms.marketSizeForWeek(p, week), 0); },
  sharePercent(p, week) { const t = Platforms.totalMarket(week); return t ? 100 * Platforms.marketSizeForWeek(p, week) / t : 0; },
};

/* ---------- investigación: costes ---------- */
const Research = {
  pointsCost(it) { if (!it.v) return it.pointsCost || 0; return C.V_POINTS_COST[U.vIndex(it.v)]; },
  devCost(it, game) { if (!it.v) return it.cost || 0; let c = it.devCost || 1000 * C.V_DEV_COST[U.vIndex(it.v)]; if (game) { c = c * C.SIZE[game.size].duration; c = 1000 * Math.floor(c / 1000); } return c; },
  researchCost(it) { return it.cost ? it.cost : (it.v ? 4 * Research.devCost(it) : 0); },
  duration(it) { if (!it.v) return it.duration; return 1000 * C.V_DURATION[U.vIndex(it.v)]; },
  enginePoints(it) { if (it.enginePoints !== undefined) return it.enginePoints; if (!it.v) return 0; return C.V_ENGINE_POINTS[U.vIndex(it.v)]; },
  engineCost(it) { if (it.enginePoints === 0) return 0; if (!it.v) return 0; return 1000 * C.V_ENGINE_COST[U.vIndex(it.v)]; }
};

/* ---------- Laboratorio I+D (equivalente al R&D lab / consola propia de GDT): proyectos grandes con RP + € ----------
   Se añaden a DATA.RESEARCH como investigaciones normales (categoría "Laboratorio I+D") con onComplete(co). */
Research.bigProjects = [
  { id: 'RnDLab', name: 'Laboratorio I+D', category: 'Laboratorio I+D', big: true, pointsCost: 300, duration: 20000, cost: 2000000, req: c => c.level >= 4, desc: 'Montamos un laboratorio de I+D en la óptica insignia: abre proyectos grandes que cambian el negocio (marca propia, canales propios, suscripción).' },
  { id: 'OwnLensBrand', name: 'Marca propia de lentes', category: 'Laboratorio I+D', big: true, pointsCost: 600, duration: 30000, cost: 5000000, req: c => c.hasResearch('RnDLab'), desc: 'Lentes con nuestra propia marca: +8 % de ventas en Graduado, Lectura e Infantil y +15 de expectación en cada colección nueva.', onComplete(co) { co.flags.ownLensBrand = true; } },
  { id: 'GafaPropia', name: 'Plataforma de gafa propia', category: 'Laboratorio I+D', big: true, pointsCost: 1000, duration: 40000, cost: 15000000, req: c => c.hasResearch('RnDLab') && c.hasResearch('LineaInteligente') && c.isLaterOrEqualThan(37, 1), desc: 'Nuestra propia gafa inteligente con su tienda de aplicaciones : un canal sin licencia cuya cuota crece con los clientes fieles.', onComplete(co) { G.addOwnPlatform({ id: 'gafapropia', name: 'Nuestra gafa inteligente', baseAmount: 0.8, fansScale: 2.2, maxAmount: 7, devCost: 40000, gw: [0.8, 1, 1, 0.7, 0.7, 1, 1], aw: [1, 1, 0.8] }); } },
  { id: 'OwnTryOn', name: 'Probador virtual propio', category: 'Laboratorio I+D', big: true, pointsCost: 800, duration: 35000, cost: 8000000, req: c => c.hasResearch('RnDLab') && c.isLaterOrEqualThan(14, 1), desc: 'Nuestra propia app de probador virtual: un canal de venta propio sin licencia cuya cuota de mercado crece con los clientes fieles.', onComplete(co) { G.addOwnPlatform({ id: 'probadorpropio', name: 'Probador virtual propio', baseAmount: 0.8, fansScale: 2.0, maxAmount: 5, devCost: 30000, gw: [1, 0.9, 0.9, 0.9, 0.8, 0.9], aw: [0.9, 1, 0.9] }); } },
  { id: 'OwnFrameBrand', name: 'Marca propia de monturas', category: 'Laboratorio I+D', big: true, pointsCost: 900, duration: 40000, cost: 10000000, req: c => c.hasResearch('OwnLensBrand'), desc: 'Boutiques con nuestra marca de monturas: canal propio premium y +30 de expectación en cada colección.', onComplete(co) { co.flags.ownFrameBrand = true; G.addOwnPlatform({ id: 'boutiquepropia', name: 'Boutiques de marca propia', baseAmount: 0.6, fansScale: 1.6, maxAmount: 4.5, devCost: 40000, gw: [1, 0.9, 0.7, 0.7, 0.7, 1], aw: [0.8, 0.9, 1] }); } },
  { id: 'Subscription', name: 'Suscripción de gafas', category: 'Laboratorio I+D', big: true, pointsCost: 1000, duration: 40000, cost: 12000000, req: c => c.hasResearch('OwnTryOn') && c.isLaterOrEqualThan(17, 1), desc: 'Gafas por suscripción: canal propio de recurrencia y un ingreso mensual proporcional a los clientes fieles.', onComplete(co) { co.flags.subscription = true; G.addOwnPlatform({ id: 'suscripcionpropia', name: 'Suscripción propia', baseAmount: 1.0, fansScale: 2.5, maxAmount: 6, devCost: 30000, gw: [0.9, 0.9, 0.8, 1, 0.9, 1], aw: [1, 1, 0.8] }); } }
];
for (const bp of Research.bigProjects) if (!DATA.RESEARCH.some(r => r.id === bp.id)) DATA.RESEARCH.push(bp);

/* =====================================================================
   PERSONAJE (Character)
   ===================================================================== */
class Character {
  constructor(a) {
    this.id = a.id; this.name = a.name; this.sex = a.sex || 'male';
    this.designFactor = a.dF; this.technologyFactor = a.tF; this.speedFactor = a.speedF; this.qualityFactor = a.qualityF; this.researchFactor = a.researchF;
    this.salary = a.salary || 0; this.experience = a.experience || 0; this.efficiency = a.efficiency === undefined ? 1 : a.efficiency;
    this.state = a.state || 'idle'; this.flags = a.flags || {}; this.slot = a.slot || 0; this.look = a.look || Math.floor(Math.random() * 6);
    this.role = a.role || 'disenador'; this.assignment = a.assignment || null; this.skills = a.skills || {};
    this.currentFeature = a.currentFeature || null; this.currentResearch = a.currentResearch || null; this.currentTraining = a.currentTraining || null;
    this.engineProgress = a.engineProgress || { points: 0, research: 0 }; this.contractProgress = a.contractProgress || { d: 0, t: 0, r: 0 };
    this.bugFixingDelta = a.bugFixingDelta || 0; this.dLeft = a.dLeft || 0; this.tLeft = a.tLeft || 0; this.rLeft = a.rLeft || 0; this.lastUpdate = null;
    this.vacationEnd = a.vacationEnd || 0; this.workAnim = 0;
  }
  save() { const o = Object.assign({}, this); o.dF = this.designFactor; o.tF = this.technologyFactor; o.speedF = this.speedFactor; o.qualityF = this.qualityFactor; o.researchF = this.researchFactor; delete o.lastUpdate; return o; }
  isIdle() { return this.state === 'idle'; }
  isAvailable() { return this.state === 'idle' && !this.assignment; }
  roleInfo() { return DATA.roleById(this.role); }
  level() { return Level.getLevel(this.experience); }
  /* racha ("on fire" de GDT): ch.flags.onFire = instante de juego en que caduca; render.js puede leer isOnFire() */
  isOnFire() { return !!this.flags.onFire && this.flags.onFire > G.gameTime; }
  boostFactor() { return this.isOnFire() ? (this.flags.boostFactor || 1.25) : 1; }
  getCurrentQualityFactor() {
    let a = 0.3;
    if (this.id === 0) { const l = this.level(); if (l === 1) a += 0.3; else if (l === 2) a += 0.2; else if (l === 3) a += 0.1; }
    a += this.qualityFactor; return a > 1 ? 1 + 0.5 * (a - 1) : a;
  }
  adjustEfficiency(v) { this.efficiency = U.clamp(this.efficiency + v, 0.001, 1); }
  resetLeftOverPoints() { this.dLeft = this.tLeft = this.rLeft = 0; }
  /* calcula los puntos totales que este personaje aportará a la misión actual */
  calcFeature(game, feat) {
    /* lead = 1.25 si este personaje es el responsable del campo, 0.85 si el responsable es otro, 1 si el campo no tiene responsable (neutro en total para un equipo de 3) */
    const lead = General.leadFactor(G.company, game, feat, this);
    let d = General.getD(game, feat) * this.designFactor * this.getCurrentQualityFactor() * lead + this.dLeft;
    if (this.id !== 0 && d < 1 && d > 0.6) d = 1;
    let t = General.getT(game, feat) * this.technologyFactor * this.getCurrentQualityFactor() * lead + this.tLeft;
    if (this.id !== 0 && t < 1 && t > 0.6) t = 1;
    let r = General.getR(game, feat, this) + this.rLeft;
    if (!isFinite(d)) d = 0; if (!isFinite(t)) t = 0; if (!isFinite(r)) r = 0;
    this.dLeft = d - Math.floor(d * feat.progress); this.tLeft = t - Math.floor(t * feat.progress); this.rLeft = r - Math.floor(r * feat.progress);
    this.currentFeature = { id: feat.id, type: feat.type, d, t, r, currentD: Math.floor(d * feat.progress), currentT: Math.floor(t * feat.progress), currentR: Math.floor(r * feat.progress), currentDf: 0, currentTf: 0, currentRf: 0, duration: feat.duration, progress: feat.progress };
  }
  tick(gameTime) {
    if (this.lastUpdate === null) this.lastUpdate = gameTime;
    const dt = gameTime - this.lastUpdate; this.lastUpdate = gameTime; if (dt <= 0) return;
    if (this.flags.onFire && this.flags.onFire <= gameTime) this.flags.onFire = 0;
    const co = G.company; let recharge = true;
    if (this.id !== 0 && this.state !== 'vacation' && this.flags.nextVacation && this.flags.nextVacation < gameTime) {
      if (!this.flags.needsVacation && co.flags.autoVacation) this.flags.needsVacation = true; /* con vacaciones automáticas no se avisa */
      if (!this.flags.needsVacation) { this.flags.needsVacation = true; const q = co.notifications.find(n => n.sourceId === 'tired'); if (q) { if (!q.staffIds.includes(this.id)) q.staffIds.push(this.id); q.text = G.tiredText(q.staffIds); } else G.notify('Personal agotado', G.tiredText([this.id]), 'decision', { sourceId: 'tired', staffIds: [this.id], options: ['Mandar de vacaciones', 'Más tarde', 'Siempre automático'] }); }
      /* vacaciones automáticas: entre colecciones (o, si está en un departamento, en cuanto quede libre) */
      if (co.flags.autoVacation && this.flags.needsVacation && !this.currentResearch && (this.state === 'idle' || (this.state === 'working' && this.assignment)) && (!co.currentGame || this.assignment)) { const tr = DB.training('vacaciones'); if (tr && G.startTraining(this, tr)) { G.log(`${this.name} se va de vacaciones (automáticas).`); return; } }
      this.adjustEfficiency(-dt / C.EFFICIENCY_RECHARGE_DURATION); recharge = false;
    }
    if (this.efficiency !== 1 && recharge) this.adjustEfficiency(dt / C.EFFICIENCY_RECHARGE_DURATION);
    if (this.state === 'vacation') { if (gameTime >= this.vacationEnd) { this.state = 'idle'; this.efficiency = 1; if (co.flags.autoVacation) G.log(`${this.name} ha vuelto de vacaciones.`); else G.notify('Personal', `${this.name} ha vuelto de vacaciones con las pilas cargadas.`, 'news'); } return; }
    if (this.state === 'training') { this._doTraining(dt); return; }
    if (this.state === 'researching') { this._doResearch(dt); return; }
    /* como GDT: quien se queda libre (vuelve de vacaciones, termina una investigación) se reincorpora al proyecto en marcha */
    if (this.state === 'idle' && !this.assignment) G.rejoinWork(this);
    if (G.currentEngineDev && this.state === 'working' && !G.currentFeature) { this._doEngineWork(dt); return; }
    if (G.currentContract && G.currentContract.type === 'generic' && this.state === 'working') { this._doContractWork(dt); return; }
    if (G.currentFeature && this.state === 'working') this._doWork(dt);
  }
  _doWork(dt) {
    const c = this.currentFeature; const F = G.currentFeature; const co = G.company; const game = co.currentGame; if (!c || !game) return;
    if (F.id === 'BugFixing') { this._doFinishingWork(co, dt); return; }
    const k = 0.44 + 0.5 * U.clamp(this.getCurrentQualityFactor(), 0, 1);
    let m = (G.gameTime - F.startTime) / F.duration; if (m <= 0 || c.progress >= 1) return;
    let a = dt; if (m > 1) { a -= F.duration * (m - 1); if (a < 0) a = 0; } m = Math.min(m, 1); c.progress = m; F.progress = m;
    const n = C.SIZE[game.size].optimalTeam, cnt = G.staffCountWorking(); const g = U.clamp(n / cnt, 0, 1);
    a = a * this.efficiency * (n === 1 ? g : 0.5 + 0.5 * g) * this.boostFactor();
    c.currentDf += c.d / c.duration * a; c.currentTf += c.t / c.duration * a; c.currentRf += c.r / c.duration * a;
    if (!isFinite(c.currentDf)) c.currentDf = c.currentD; if (!isFinite(c.currentTf)) c.currentTf = c.currentT; if (!isFinite(c.currentRf)) c.currentRf = c.currentR;
    const CAP = 40; const fd = Math.min(Math.floor(c.currentDf), c.currentD + CAP), ft = Math.min(Math.floor(c.currentTf), c.currentT + CAP), fr = Math.min(Math.floor(c.currentRf), c.currentR + CAP);
    if (fd > c.currentD) { for (let i = 0; i < fd - c.currentD; i++) { if (U.rnd() > k) this.spawnPoints(1, 'b'); else { this.spawnPoints(1, 'd'); this._chanceRandomBug(); } } this.dLeft -= fd - c.currentD; c.currentD = fd; }
    if (ft > c.currentT) { for (let i = 0; i < ft - c.currentT; i++) { if (U.rnd() > k) this.spawnPoints(1, 'b'); else { this.spawnPoints(1, 't'); this._chanceRandomBug(); } } this.tLeft -= ft - c.currentT; c.currentT = ft; }
    if (fr > c.currentR) { for (let i = 0; i < fr - c.currentR; i++) this.spawnPoints(1, 'r'); this.rLeft -= fr - c.currentR; c.currentR = fr; }
  }
  /* como GDT: la probabilidad de defecto extra sube con la sobrecarga del responsable (carga efectiva > 100 %) */
  _chanceRandomBug() { const g = G.company.currentGame; const f = 0.05 + 0.6 * Math.max(0, (General.getEffectiveWorkload(this, g) - 100) / 100); if (U.rnd() < f) { this.spawnPoints(1, 'b'); g.freeBugCount++; } }
  _doFinishingWork(co, dt) {
    const f = co.currentGame; const d = 1 / (this.technologyFactor + this.designFactor) * this.designFactor;
    this.bugFixingDelta += dt; if (this.bugFixingDelta * this.speedFactor < 500) return; this.bugFixingDelta = 0;
    const k0 = 1 * this.efficiency;
    if (f.bugs > 0 && U.rnd() < 0.9) {
      let k = Math.min(k0, f.bugs); if (k > 0) { for (let i = 0; i < k; i++) { this.spawnPoints(1, 'br'); const l = f.bugs - f.freeBugCount; if (f.freeBugCount > 0 && (l <= 0 || U.rnd() > 0.5)) f.freeBugCount--; else if (U.rnd() < 0.3 && U.rnd() < U.clamp(this.getCurrentQualityFactor(), 0, 1)) { if (U.rnd() < d) this.spawnPoints(1, 'd'); else this.spawnPoints(1, 't'); } } }
    } else {
      const k = 0.44 + 0.5 * U.clamp(this.getCurrentQualityFactor(), 0, 1); const m = U.clamp(0.5 * this.getCurrentQualityFactor(), 0, 1) / 2;
      if (U.rnd() < m) { if (U.rnd() > k) { this.spawnPoints(1, 'b'); f.freeBugCount++; } else if (U.rnd() < 0.25) { if (U.rnd() < d) this.spawnPoints(1, 'd'); else this.spawnPoints(1, 't'); } }
    }
  }
  _doEngineWork(dt) {
    const E = G.currentEngineDev; if (!E) return; const a = dt / C.BASE_ENGINE_DURATION;
    let c = C.BASE_POINTS * this.getCurrentQualityFactor() * a * this.efficiency * this.boostFactor(); const f = this.engineProgress.points; this.engineProgress.points += c;
    if (Math.floor(this.engineProgress.points) > Math.floor(f)) { c = Math.floor(this.engineProgress.points) - Math.floor(f); if (E.remainingPoints < c) c = E.remainingPoints; if (c) this.spawnPoints(c, 'e'); }
    const r = this.engineProgress.research; this.engineProgress.research += C.BASE_RESEARCH_POINTS / 2 * this.researchFactor * a * this.efficiency;
    if (Math.floor(this.engineProgress.research) > Math.floor(r)) this.spawnPoints(Math.floor(this.engineProgress.research) - Math.floor(r), 'r');
  }
  _doContractWork(dt) {
    const c = G.currentContract; if (!c) return; let a = C.BASE_POINTS * this.getCurrentQualityFactor() * (dt / C.BASE_ENGINE_DURATION) * this.efficiency * this.boostFactor() / 2;
    const needD = c.requiredD - c.spawnedD > 0, needT = c.requiredT - c.spawnedT > 0; if (!needD && !needT) return;
    if (!(needD && needT)) a += 0.4 * a;
    if (needD) { let m = a * this.designFactor; m += 0.2 * m * U.rnd(); const p = this.contractProgress.d; this.contractProgress.d += m; if (Math.floor(this.contractProgress.d) > Math.floor(p)) { let d = Math.floor(this.contractProgress.d) - Math.floor(p); d = Math.min(d, c.requiredD - c.spawnedD); if (d > 0) { this.spawnPoints(d, 'd'); c.spawnedD += d; } } }
    if (needT) { let m = a * this.technologyFactor; m += 0.2 * m * U.rnd(); const p = this.contractProgress.t; this.contractProgress.t += m; if (Math.floor(this.contractProgress.t) > Math.floor(p)) { let t = Math.floor(this.contractProgress.t) - Math.floor(p); t = Math.min(t, c.requiredT - c.spawnedT); if (t > 0) { this.spawnPoints(t, 't'); c.spawnedT += t; } } }
    const r = this.contractProgress.r; this.contractProgress.r += C.BASE_RESEARCH_POINTS / 2 * this.researchFactor * (dt / C.BASE_ENGINE_DURATION) * (c.rF || 1) * this.efficiency;
    if (Math.floor(this.contractProgress.r) > Math.floor(r)) this.spawnPoints(Math.floor(this.contractProgress.r) - Math.floor(r), 'r');
  }
  _doResearch(dt) {
    const r = this.currentResearch; if (!r) { this.state = 'idle'; return; }
    r.progress = Math.min(1, r.progress + dt / r.duration);
    this.rAcc = (this.rAcc || 0) + C.BASE_RESEARCH_POINTS * 0.3 * this.researchFactor * dt / C.BASE_ENGINE_DURATION;
    if (this.rAcc >= 1) { this.spawnPoints(1, 'r'); this.rAcc -= 1; }
    if (r.progress >= 1) G.finishResearch(this, r);
  }
  _doTraining(dt) {
    const t = this.currentTraining; if (!t) { this.state = 'idle'; return; }
    t.progress = Math.min(1, t.progress + dt / t.duration);
    if (t.progress >= 1) G.finishTraining(this, t);
  }
  spawnPoints(n, type) { if (!isFinite(n)) return; n = Math.min(Math.floor(n), 200); for (let i = 0; i < n; i++) G.spawnPoint(this, type); }
  applyPoint(type, v) {
    const co = G.company; const g = co.currentGame;
    switch (type) {
      case 'd': if (g) g.designPoints += v; this.experience += v; break;
      case 't': if (g) g.technologyPoints += v; this.experience += v; break;
      case 'r': co.researchPoints += v; break;
      case 'b': if (g) g.bugs += v; break;
      case 'br': if (g) g.bugs = Math.max(0, g.bugs - v); break;
      case 'e': if (G.currentEngineDev) { G.currentEngineDev.remainingPoints = Math.max(0, G.currentEngineDev.remainingPoints - v); if (G.currentEngineDev.remainingPoints <= 0) G.finishEngine(); } break;
    }
  }
  goOnVacation() { this.state = 'vacation'; this.vacationEnd = G.gameTime + 8000; this.flags.nextVacation = G.gameTime + 54 * WEEK_MS; this.flags.needsVacation = false; this.currentFeature = this.currentResearch = this.currentTraining = null; this.resetLeftOverPoints(); }
}

/* =====================================================================
   GENERAL: puntos por misión, duración, etc.
   ===================================================================== */
const General = {
  sizeDuration: size => C.SIZE[size].duration,
  sizePoints: g => C.SIZE[g.size].points,
  optimalTeam: g => C.SIZE[g.size].optimalTeam,
  multiPlatformDuration(g) { return g.platforms.length > 1 ? 1 + 0.45 * (g.platforms.length - 1) / 2 : 1; },
  multiPlatformCost(g) { return 1 + 0.5 * (g.platforms.length - 1); },
  basePoints(g) { let b = g.techLevel || 0; const i = Math.floor(b), fr = b - i; let c = C.BASE_POINTS_BY_TECH[Math.min(i, 7)]; if (fr && i + 1 < 8) c += (C.BASE_POINTS_BY_TECH[i + 1] - c) * fr; return c; },
  featureEfficiency(g, feats, pct) { let l = 100; if (feats.length) { const sumV = feats.reduce((s, f) => s + f.v, 0); l = U.clamp(100 / (5 * sumV * (g.size === 'aaa' ? 0.4 : g.size === 'large' ? 0.7 : 1)) * pct, 0, 100); } return l; },
  _points(g, feat, field) {
    const l = W.genre(DB.topic(g.topic).gw, g.genre, g.secondGenre); const m = DB.mission(feat.id); if (!m) return 0;
    let n;
    if (feat.type === 'prep') n = C.BASE_POINTS / 2;
    else {
      n = C.BASE_POINTS * W.missionGenre(m, g) * Level.bonus(G.company.missionXp[m.id] || 0);
      n += General.basePoints(g) / 9;
      n *= field === 'd' ? m.dF : m.tF;
      n *= feat.percentage / (100 / 3);
      const feats = g.features.map(DB.part).filter(p => p && p.category === m.id);
      let c = 0; for (const p of feats) c += p.v * Level.bonus(G.company.featureXp[p.id] || 0) * 0.8;
      c *= General.featureEfficiency(g, feats, feat.percentage) / 100;
      n = (n + c) * General.getResponsibleStaffFactor(G.company, m, field);
    }
    return n * l;
  },
  /* ---- responsables de campo (featureResponsibility de GDT) ----
     game.flags.featureResponsibility[missionId] = staffId. El responsable marca el ritmo del campo para todo el equipo:
     factor = 0.5 + 0.5·clamp(skill) + 0.1·skill (+0.15·skill si es experto), penalizado por carga de trabajo (0.75 por exceso, 0.25 por defecto).
     skill = designFactor para puntos D y technologyFactor para puntos T. Sin responsable el factor es 1; responsable desaparecido: 0.7. */
  responsibleOf(co, missionId, game) { const g = game || (co && co.currentGame); const fr = g && g.flags && g.flags.featureResponsibility; if (!fr || fr[missionId] === undefined || fr[missionId] === null || fr[missionId] === '') return null; const id = fr[missionId]; return co.staff.find(s => String(s.id) === String(id)) || null; },
  getResponsibleStaffFactor(co, mission, field) {
    const g = co && co.currentGame; if (!g) return 1; const fr = g.flags.featureResponsibility; if (!fr || !Object.prototype.hasOwnProperty.call(fr, mission.id) || fr[mission.id] === null || fr[mission.id] === '') return 1;
    const ch = General.responsibleOf(co, mission.id, g); if (!ch) return 0.7;
    const wl = General.getEffectiveWorkload(ch, g); const skill = field === 'd' ? ch.designFactor : ch.technologyFactor;
    let l = 0.5 + 0.5 * U.clamp(skill, 0, 1) + 0.1 * skill; if (ch.flags.expert === mission.id) l += 0.15 * skill;
    const b = U.clamp(wl / 100 - 1, -1, 1); l = b > 0 ? l - 0.75 * l * b : l - 0.25 * l * -b; return l;
  },
  /* carga efectiva (%) = carga acumulada (suma de % de los campos a su cargo en toda la colección) × equipoÓptimo / 3. 100 % = equilibrado. */
  getEffectiveWorkload(ch, g) { if (!ch || !g) return 0; const wl = (ch.flags && ch.flags.workload) || 0; return 100 / (300 / General.optimalTeam(g)) * wl; },
  /* carga efectiva que tendría `ch` si además se le asignaran los campos de `extra` ({missionId: pct}) */
  projectedWorkload(ch, g, extra) { let wl = (ch.flags && ch.flags.workload) || 0; if (extra) for (const k in extra) wl += extra[k] || 0; return 100 / (300 / General.optimalTeam(g)) * wl; },
  /* reparto del trabajo dentro del campo: el responsable lidera (×1.25), el resto apoya (×0.85); sin responsable, todos ×1 */
  leadFactor(co, g, feat, ch) { if (!g || !feat || feat.type !== 'mission') return 1; const r = General.responsibleOf(co, feat.id, g); if (!r) return 1; return r === ch ? 1.25 : 0.85; },
  /* importancia de un campo para un tipo: '+' (≥0.9), '=' (0.8), '-' (≤0.7) */
  weightBucket(w) { w = Math.round(10 * w) / 10; return w >= 0.9 ? '+' : w <= 0.7 ? '-' : '='; },
  getD(g, feat) { return feat.type === 'prep' ? C.BASE_POINTS / 2 : General._points(g, feat, 'd'); },
  getT(g, feat) { return feat.type === 'prep' ? C.BASE_POINTS / 2 : General._points(g, feat, 't'); },
  getR(g, feat, ch) {
    if (feat.type === 'prep' || feat.type === 'bugfix') return 0;
    let l = C.BASE_RESEARCH_POINTS * ch.researchFactor; l += l * U.rnd() * 0.1; l *= feat.percentage / (100 / 3); l *= General.sizePoints(g);
    for (let i = 1; i < G.company.staff.length; i++) l *= 0.95; for (let i = 0; i < G.company.researchPoints / 200; i++) l *= 0.95; return l;
  },
  missionDuration(g, m, pct) { let d = 3 * C.BASE_DURATION / 100 * pct; const feats = g.features.map(DB.part).filter(p => p && p.category === m.id); for (const p of feats) d += Research.duration(p) / 6; return Math.max(300, d * General.sizeDuration(g.size) * General.multiPlatformDuration(g)); },
  monthlyCosts(co) { let b = co.level === 1 ? 6000 : 8000; if (co.level === 2 || co.level === 3) b *= 4; else if (co.level === 4) b *= 8; for (const s of co.staff) b += s.salary || 0; b += Modules.sum('monthlyCost', co); return b; }
};

/* =====================================================================
   COLECCIÓN (Game)
   ===================================================================== */
function newGame(co) {
  return {
    id: U.guid(), title: 'Colección ' + (co.gameLog.length + 1), size: 'small', topic: null, genre: null, secondGenre: null, targetAudience: null,
    platforms: [], engine: co.engines[0].id, features: [], featureLog: [], sliders: [[33.3, 33.3, 33.3], [33.3, 33.3, 33.3], [33.3, 33.3, 33.3]],
    designPoints: 0, technologyPoints: 0, bugs: 0, freeBugCount: 0, hypePoints: co.flags.nextGameHypeBonus || 0, costs: 0, stage: 0, state: 'dev',
    techLevel: 0, flags: { staffContribution: {}, featureResponsibility: Object.assign({}, co.flags.featureResponsibility || {}) }, startWeek: co.currentWeek, score: 0, reviews: [], sequelTo: null, contractId: null
  };
}

/* =====================================================================
   RESEÑAS (Reviews.rateGame portado)
   ===================================================================== */
const Reviews = {
  expectedTop(co) {
    if (co.lastTopScore) {
      const y = co.getCurrentDate().year; const b0 = 0.5; void y; /* el listón sube la mitad de lo superado: acertar todo vuelve a dar buena nota */ const c = co.previousTopScore ? co.previousTopScore : 20;
      const b = Math.floor(co.lastTopScore + co.lastTopScoreIncrease * b0); const l = 6 + 9 * General.sizeDuration(co.lastTopScoreGameSize || 'small');
      return (!co.lastTopScoreWeek || co.currentWeek >= co.lastTopScoreWeek + l) ? b : Math.floor(c + (b - c) * (co.currentWeek - co.lastTopScoreWeek) / l);
    } return 20;
  },
  setTopScore(co, score) {
    if (!co.lastTopScore || co.lastTopScore < score) {
      const f = Reviews.expectedTop(co);
      if (co.lastTopScore) { co.lastTopScoreIncrease = Math.max(score - co.lastTopScore, 0.04 * f); if (co.level >= 2 && co.lastTopScoreIncrease > 0.08 * co.lastTopScore) co.lastTopScoreIncrease = 0.08 * co.lastTopScore; }
      else co.lastTopScoreIncrease = Math.max(score - f, 0.04 * f);
      co.previousTopScore = co.lastTopScore ? co.lastTopScore : 20; co.lastTopScore = score; co.lastTopScoreWeek = co.currentWeek; co.lastTopScoreGameSize = co.currentGame.size;
    }
  },
  achieveTop(co, score) { co.topScoreAchievements++; co.currentGame.flags.topScore = true; Reviews.setTopScore(co, score); },
  /* expertos al frente de campos clave (GDT): cuenta los campos con peso ≥ 0.9 cuyo responsable es experto en ese campo */
  expertCount(co, g) {
    const fr = (g.flags && g.flags.featureResponsibility) || {}; let n = 0;
    for (const a of g.featureLog) { if (a.missionType !== 'mission') continue; const m = DB.mission(a.id); if (!m || W.missionGenre(m, g) < 0.9) continue; const id = fr[a.id]; if (id === undefined || id === null || id === '') continue; const s = co.staff.find(x => String(x.id) === String(id)); if (s && s.flags.expert === a.id) n++; }
    return n;
  },
  techFactor(co, g) {
    const ex = Reviews.expertCount(co, g); if (ex >= 2) g.flags.psEnabled = true; g.flags.expertCount = ex;
    if (g.size === 'small' && co.level >= 2) { g.flags.techWhy = 'small'; return 9; }
    if (g.size === 'medium' && co.fans <= 2e4) { g.flags.techWhy = 'medium'; return 9; }
    g.flags.techWhy = g.size === 'aaa' ? 'aaa' : g.size === 'large' ? 'large' : '';
    let l = g.techLevel || 0;
    if (g.size === 'large') { l = U.clamp(3 - l, 0, 3); return 10 - l; }
    if (g.size === 'aaa') { l = U.clamp(5 - l, 0, 3); const c = U.clamp(3 - ex, 0, 3); return 10 - (l + 0.6 * c); }
    return 10;
  },
  rateGame(co) {
    const g = co.currentGame; const pos = [], neg = []; let s = 0, u = 0, t = 0; const l0 = 1;
    let seq = null; if (g.sequelTo) { seq = co.gameLog.find(x => x.id === g.sequelTo); if (seq && seq.releaseWeek > co.currentWeek - 40) g.flags.sequelsTooClose = true; }
    const r = g.technologyPoints, p = g.designPoints; let balance = null;
    if (p + r >= 15) {
      const q = p * W.golden(g.genre, g.secondGenre) - r; const v = r > p ? Math.abs(q / r * 100) : Math.abs(q / p * 100);
      if (Math.abs(v) <= 25) { s += 0.1; u += 1; balance = 'ok'; pos.push('Han logrado un equilibrio excelente entre técnica y diseño.'); }
      else if (Math.abs(v) > 50) { s -= 0.1; if (q < 0) { balance = 'moreDesign'; neg.push('Deberían centrarse más en el diseño.'); } else { balance = 'moreTech'; neg.push('Deberían centrarse más en la parte técnica.'); } }
    }
    const sBal = s; /* desglose de la nota: lo que suma cada bloque al modificador s */
    const missions = g.featureLog.filter(a => a.missionType === 'mission');
    const frac = a => a.duration / General.sizeDuration(g.size) / General.multiPlatformDuration(g) / (3 * C.BASE_DURATION);
    const good = missions.filter(a => W.missionGenre(DB.mission(a.id), g) >= 0.9 && frac(a) >= 0.4);
    if (good.length >= 2) { s += 0.2; u += good.length; pos.push(`Su atención a «${DB.mission(U.pick(good).id).name}» le ha sentado muy bien a esta colección.`); }
    else if (good.length === 1) { s += 0.1; u += 1; } else s -= 0.15 * l0;
    const odd = missions.filter(a => W.missionGenre(DB.mission(a.id), g) < 0.8 && frac(a) >= 0.4);
    if (odd.length === 2) { s -= 0.2 * l0; t += 2; neg.push(`Tanto esfuerzo en «${DB.mission(U.pick(odd).id).name}» resulta un poco raro.`); } else if (odd.length === 1) { s -= 0.1 * l0; t += 1; }
    const forgot = missions.filter(a => W.missionGenre(DB.mission(a.id), g) >= 0.9 && frac(a) <= 0.2);
    for (const a of forgot) { s -= 0.15 * l0; t += 1; neg.push(`No deberían olvidarse de «${DB.mission(a.id).name}».`); }
    const sTime = s - sBal;
    /* datos para el informe post-lanzamiento (G.generateReport) */
    g.flags.reportData = { good: good.map(a => a.id), odd: odd.map(a => a.id), forgot: forgot.map(a => a.id), balance };
    let score = (p + r) / 2 / General.sizePoints(g);
    const topicW = W.genre(DB.topic(g.topic).gw, g.genre, g.secondGenre); const tName = DB.topic(g.topic).name, gName = DB.genre(g.genre).name + (g.secondGenre ? '/' + DB.genre(g.secondGenre).name : '');
    if (topicW <= 0.6) neg.push(`${tName} y ${gName} es una combinación terrible.`); else if (topicW === 1) pos.push(`${tName} y ${gName} es una combinación genial.`);
    const last = co.gameLog[co.gameLog.length - 1];
    if (last && last.genre === g.genre && last.secondGenre === g.secondGenre && last.topic === g.topic) { t += 1; neg.push(`¿Otra colección ${gName} de estilo ${tName}?`); g.flags.sameGenreTopic = true; s += -0.4; }
    else { const near = co.gameLog.slice(-4, -1).reverse().find(x => x.topic === g.topic && x.genre === g.genre && (x.secondGenre || null) === (g.secondGenre || null)); if (near) { t += 1; neg.push(`Se parece mucho a ${near.title}: se nota que vamos alternando las mismas ideas.`); g.flags.nearRepeat = true; s += -0.2; } }
    const plats = g.platforms.map(DB.platform); const pw = W.platformGenre(plats, g.genre, g.secondGenre);
    if (pw <= 0.6) neg.push(`Las colecciones ${gName} no funcionan bien en ${plats[0].name}.`); else if (pw > 1) pos.push(`Las colecciones ${gName} funcionan muy bien en ${plats[0].name}.`);
    const aw = W.audience(DB.topic(g.topic).aw, g.targetAudience); if (aw <= 0.6) neg.push(`${tName} es un estilo horrible para el público «${DATA.AUDIENCES.find(a => a.id === g.targetAudience).name}».`);
    if (g.flags.sequelsTooClose) { s -= 0.4; t += 1; neg.push(`¿No acabamos de ver ${seq.title} hace nada?`); }
    if (g.sequelTo && seq) { if (g.engine === seq.engine) { s -= 0.1; t += 1; } else { const e1 = co.engines.find(e => e.id === g.engine), e2 = co.engines.find(e => e.id === seq.engine); if (e1 && e2 && e1.parts.length > e2.parts.length) { s += 0.2; u += 1; } } }
    const sOther = s - sBal - sTime;
    let A = 1; if (g.bugs > 0) { A = 1 - 0.8 * (U.clamp(100 / (g.technologyPoints + g.designPoints) * g.bugs, 0, 100) / 100); if (A <= 0.6) neg.push('Plagada de defectos.'); else if (A < 0.9) neg.push('Demasiados defectos de fabricación.'); }
    Object.assign(g.flags.reportData, { bugsA: A, topicW, pw, aw });
    let techPen = 1; if (plats.length > 1) { const lv = plats.map(x => x.techLevel); techPen -= (Math.max(...lv) - Math.min(...lv)) / 20; }
    score = (score + score * s) * pw; score *= aw; score *= A; score *= techPen;
    const trend = Trends.factor(g); g.flags.trendModifier = trend; score *= trend;
    const modF = Modules.product('scoreFactor', co, g); g.flags.moduleModifier = modF; score *= modF;
    const B = Reviews.expectedTop(co); let z = score / B; const zMods = z;
    if (z >= 0.6 && (aw <= 0.7 || topicW <= 0.7)) z = 0.6 + (z - 0.6) / 2;
    const comboCap = z / Math.max(1e-9, zMods);
    let chanAud = 1; if (z > 0.7) for (const pl of plats) { const pa = W.platformAudience([pl], g.targetAudience, true); if (pa < 0.8) { chanAud = pa; score *= pa; z = score / B; break; } }
    z = U.clamp(10 * z, 1, 10);
    /* fracción del equipo de colecciones (sin contar departamentos) que ha trabajado en esta colección */
    { const team = co.staff.filter(st => !st.assignment); const n = team.filter(st => g.flags.staffContribution && g.flags.staffContribution[st.id]).length; g.flags.teamContribution = team.length ? n / team.length : 1; }
    const newStaff = co.staff.filter(st => !st.assignment && (st.flags.gamesContributed || 0) < 1 && st.id !== 0); /* solo el equipo de diseño: quien está en un departamento no es «nuevo en el equipo» */
    if (co.lastTopScore > 0 && z <= 5.2 - 0.2 * plats.length && u > 0 && u > t && g.flags.teamContribution >= 0.8) {
      let q = 6; const opt = General.optimalTeam(g); const diff = Math.abs(opt - co.staff.filter(st => !st.assignment).length); if (diff > 1) q -= diff - 1; if (newStaff.length) q -= newStaff.length / 2;
      q += u / 2 - t / 2; if (A < 0.9) q -= 0.5; else if (A <= 0.6) q -= 1; if (pw <= 0.8) q -= 1 - pw; if (aw <= 0.8) q -= 1 - aw; q -= U.rnd(); q = Math.min(q, 7.7);
      if (z < q) { g.flags.scoreWithoutBrackets = z; z = q; }
      if (co.gameLog.length > 3) { let bad = true; for (let i = 1; i <= 3; i++) { const gg = co.gameLog[co.gameLog.length - i]; if (gg.score > 5.2 - 0.2 * gg.platforms.length && !gg.flags.scoreWithoutBrackets) { bad = false; break; } } if (bad) { co.lastTopScore = score / trend; g.flags.topScoreDecreased = true; } }
    }
    const tf = Reviews.techFactor(co, g) / 10; if (g.size !== 'small' && g.size !== 'medium' && tf < 1) neg.push(g.size === 'aaa' && (g.flags.expertCount || 0) < 3 ? 'Una colección insignia necesita especialistas al frente de sus campos clave.' : 'La tecnología no está a la última.'); z *= tf;
    if (z >= 9) {
      let reduce = false; if (s < 0.1 && U.rnd() < 0.8) { reduce = true; g.flags.capWhy = 'fields'; } else if (newStaff.length) { reduce = true; g.flags.newStaffIds = newStaff.map(x => x.id); g.flags.capWhy = 'new'; }
      if (reduce) { z = g.flags.newStaffIds && g.flags.newStaffIds.length ? 8.15 + 0.95 / g.flags.newStaffIds.length * U.rnd() : 8.45 + 0.65 * U.rnd(); if (U.rnd() < 0.1) z = 9 + 0.25 * U.rnd(); Reviews.setTopScore(co, score / trend); }
    }
    if (seq) { if (z <= 4) neg.push('¡Qué segunda edición tan horrible!'); else if (z <= 7) neg.push('Una segunda edición del montón.'); else pos.push('¡Gran segunda edición!'); }
    if (co.topScoreAchievements < 2 && co.getCurrentDate().year < 4) { if (z === 10) { z -= 1.05 + 0.45 * U.rnd(); Reviews.achieveTop(co, score / trend); } else if (z >= 9) { z -= 1.05 + 0.2 * U.rnd(); Reviews.achieveTop(co, score / trend); } else if (z > 8.5) z -= 0.4 + 0.2 * U.rnd(); }
    if (z >= 9) Reviews.achieveTop(co, score / trend);
    if (z !== 10 && g.flags.topScore && co.topScoreAchievements === 3) z = 10;
    g.score = z; g.rawScore = score; g.expectedScore = B;
    { const base = (p + r) / 2 / General.sizePoints(g); const zBase = U.clamp(10 * base / B, 0, 10); const zPre = U.clamp(10 * zMods * comboCap * chanAud, 0, 10);
      g.flags.breakdown = { base: zBase, final: z, expected: B, raw: Math.round((p + r) / 2 / General.sizePoints(g)), topicW, rows: [
        { k: 'time', label: 'Reparto del tiempo entre campos', f: 1 + sTime },
        { k: 'balance', label: 'Equilibrio diseño / técnica', f: 1 + sBal },
        { k: 'other', label: 'Repeticiones y segundas ediciones', f: 1 + sOther },
        { k: 'channel', label: 'Encaje del tipo con el canal', f: pw },
        { k: 'audience', label: 'Encaje del estilo con el público', f: aw },
        { k: 'chanaud', label: 'Encaje del canal con el público', f: chanAud },
        { k: 'bugs', label: 'Defectos de fabricación', f: A },
        { k: 'mix', label: 'Mezcla de canales muy distintos', f: techPen },
        { k: 'trend', label: 'Tendencia del mercado', f: trend },
        { k: 'depts', label: 'Departamentos (taller, laboratorio…)', f: modF },
        { k: 'combo', label: 'Encaje estilo-tipo (techo si es malo)', f: comboCap },
        { k: 'tech', label: 'Nivel técnico exigido por el tamaño', f: tf }
      ].filter(x => Math.abs(x.f - 1) > 0.004), adjust: Math.round((z - Math.min(10, zPre * tf)) * 10) / 10 }; }
    return Reviews.getReviews(g, z, pos, neg);
  },
  getReviews(g, b, pos, neg) {
    let base = U.clamp(Math.floor(b), 1, 10); if (b >= 9.5) base = 10; const out = [], used = [], scores = []; let u = 1;
    for (let i = 0; i < 4; i++) {
      if (base === 5 || base === 6) u = U.rnd() < 0.05 ? 2 : 1;
      const q = U.sign() === 1 ? 0 : u * U.sign(); let v = U.clamp(base + q, 1, 10);
      if (v === 10 && scores.length === 3 && U.avg(scores) === 10 && (Math.floor(b) < 10 || U.rnd() < 0.8)) v--;
      let msg; let tries = 0;
      do { msg = undefined; if (U.rnd() <= 0.5) { if (v >= 6 && pos.length) msg = U.pick(pos); else if (v < 6 && neg.length) msg = U.pick(neg); } if (!msg) msg = U.pick(DATA.REVIEW_TEXT[v]); tries++; } while (used.includes(msg) && tries < 10);
      used.push(msg); scores.push(v); out.push({ score: v, message: msg, reviewerName: DATA.REVIEWERS[i] });
    }
    return out;
  }
};

/* =====================================================================
   VENTAS (Sales portado)
   ===================================================================== */
const Sales = {
  unitPrice: g => C.SIZE[g.size].unitPrice,
  targetFans: g => C.SIZE[g.size].targetFans,
  /* semanas de venta; gancho opcional salesLengthFactor (Modules.product) por si un módulo alarga o acorta la vida comercial */
  salesLength: g => { const base = C.SALES_LENGTH[g.size] || 10; const f = (typeof Modules !== 'undefined' && G.company) ? Modules.product('salesLengthFactor', G.company, g) : 1; return Math.max(2, Math.round(base * (f > 0 ? f : 1))); },
  calculateSales(co, g) {
    g.flags.fansAtLaunch = co.fans; const year = co.getCurrentDate().year; const d = U.clamp(g.score, 1, 10); const f = d / 10;
    const k = Math.min(1.5e6, co.fans) + Math.max(0, co.fans - 1.5e6) / 10; const plats = g.platforms.map(DB.platform); const m = [0, 0, 0];
    let minTech = 8; for (const p of plats) if (!p.isOwn) minTech = Math.min(minTech, p.techLevel);
    for (let i = 0; i < plats.length; i++) { let v = plats[i].techLevel; if (plats[i].isOwn) v = minTech === 8 ? v : minTech; let A = 1; if (i === 0 && plats.length > 1) A = 0.7; else if (i === 1) A = plats.length === 2 ? 0.55 : 0.4; else if (i === 2) A = 0.3; m[i] += Platforms.marketSizeForWeek(plats[i], co.currentWeek) * A * (1 / v) * (minTech === 8 ? v : minTech); }
    const t = [0, 0, 0]; let v, q = 1;
    if (d <= 9) { v = Math.pow(d, 3) / 100 * 0.2; if (co.level === 4) q = 1.25; } else { v = Math.pow(d, 3) / (100 - 35 * (d - 9)); q = year < 6 ? 0.65 : co.level === 4 ? 0.35 : 0.5; }
    v = v * q / 15 * 0.2 + 0.008; const vv = [v, v, v];
    for (let i = 0; i < plats.length; i++) { vv[i] *= W.platformAudience([plats[i]], g.targetAudience); t[i] += Math.floor(m[i] * vv[i]); }
    if (g.hypePoints) { const c = Math.min(500, g.hypePoints) / 500; if (d >= 5) for (let i = 0; i < plats.length; i++) t[i] += Math.floor((d - 5) / 5 * m[i] * c * 0.05); else for (let i = 0; i < plats.length; i++) t[i] -= Math.floor(d / 5 * vv[i] * 0.25 * c * m[i]); }
    for (let i = 0; i < plats.length; i++) t[i] = Math.floor(Math.min(t[i], m[i]));
    if (g.flags.royaltyRate) { t[0] += Math.max(0, Sales.targetFans(g) - k) * f; for (let i = 0; i < plats.length; i++) t[i] *= 10; } else t[0] += k * f;
    const sum = t.reduce((a, b) => a + b, 0); let units = Math.floor(0.8 * sum * f + 0.2 * sum * U.rnd());
    units = Math.floor(units * Modules.product('salesFactor', co, g));
    units = Math.floor(units * G.coreSalesFactor(co, g));
    /* desgaste por canal: repetir canal agota a su clientela (media de los canales usados, como mucho −15 %) */
    units = Math.floor(units * plats.reduce((a, p) => a + G.wearFactor(co, p.id), 0) / Math.max(1, plats.length));
    g.unitPrice = Sales.unitPrice(g); g.unitCost = Modules.sum('unitCost', co, g); g.marginFactor = Math.max(0.2, 1 - g.unitCost / g.unitPrice);
    let c = 0; if (d >= 7 && !g.flags.sequelsTooClose) c += 0.05 * k + 0.05 * k * U.rnd();
    if (d >= 5 && !g.flags.sequelsTooClose) { if (g.flags.royaltyRate && Sales.targetFans(g) - k <= 0) c += Math.floor((0.0075 * units * f + 0.0075 * units * U.rnd()) / 10); else c += Math.floor(0.0075 * units * f + 0.0075 * units * U.rnd()); } else c = -co.fans * (1 - f) * 0.25 * U.rnd();
    g.totalSalesCash = units * g.unitPrice * C.UNIT_SCALE * g.marginFactor; g.currentSalesCash = 0; g.salesCashLog = []; g.unitsSold = 0; g.revenue = 0; g.fansChangeTarget = c; g.fansChanged = 0;
    co.chanWear = co.chanWear || {}; for (const p of plats) co.chanWear[p.id] = (co.chanWear[p.id] || 0) + 1;
    g.initialSalesRank = Sales.initialRank(g); g.topSalesRank = g.initialSalesRank; g.currentSalesRank = g.initialSalesRank; g.soldOut = false;
  },
  initialRank(g) { const c = Math.floor(g.score); let d; if (c === 10) d = 1; else if (c === 9) d = 5; else if (c === 8) d = 10; else if (c === 7) d = 20; else if (c === 6) d = 40; else if (c === 5) d = 60; else return -1; let x = d * U.rnd(); x += 0.5 * d * U.rnd() * U.sign(); const f = Math.floor(d + x); if (f > 100) return -1; return f <= 0 ? 1 : f; },
  getIncome(co, g) {
    let c = g.totalSalesCash - g.currentSalesCash; let d = 1; if (g.size === 'medium') d = 0.75; else if (g.size === 'large') d = 0.65; else if (g.size === 'aaa') d = 0.5;
    const rem = (g.totalSalesCash - g.currentSalesCash) / g.totalSalesCash;
    if (rem < 0.1 * d) { if (rem > 0.01 * d) c = (g.totalSalesCash - g.currentSalesCash) * (0.4 * U.rnd() * d + 0.4 * d); } else c = (g.totalSalesCash - g.currentSalesCash) * (0.2 * U.rnd() * d + 0.2 * d);
    return c;
  },
  sellGame(co, g, week) {
    g.unitsSold = g.unitsSold || 0; g.revenue = g.revenue || 0; const d = Sales.salesLength(g);
    if (g.nextSalesCash !== undefined) {
      g.currentSalesRank = g.nextSalesRank; g.fansChanged += g.nextfansChange;
      const mf = g.marginFactor || 1;
      if (g.flags.royaltyRate) { g.currentSalesCash += g.nextSalesCash / g.flags.royaltyRate; g.unitsSold += Math.floor(g.nextSalesCash / g.flags.royaltyRate / (g.unitPrice * mf)); }
      else { g.currentSalesCash += g.nextSalesCash; g.unitsSold += Math.floor(g.nextSalesCash / (g.unitPrice * mf)); }
      if (g.nextSalesCash !== 0) { co.adjustCash(g.nextSalesCash, 'Ventas ' + g.title); g.revenue += Math.floor(g.nextSalesCash); G.emit('sale', { game: g, amount: g.nextSalesCash }); }
      if (g.nextfansChange !== 0) { const f = Math.floor(g.nextfansChange); if (co.fans === 0 && f > 0) G.notify('Clientes fieles', `¡${g.title} ha tenido tanto éxito que ya tenemos ${U.num(f)} clientes fieles!`); co.adjustFans(f); }
      if (g.firstSales) { { let txt = `${g.title} vendió ${U.num(g.unitsSold)} monturas en su primera semana.`; const top = g.currentSalesRank > 0 && g.currentSalesRank < 10; if (top) txt += `\n¡Entramos en el ranking de ventas en el puesto #${g.currentSalesRank}!`; const tip = G.tutorialInline('firstSale', { weeks: d }); if (tip) txt += `

📘 ${tip.text}`; if (co.gameLog.length < 2 || top || tip) G.notify('¡Primera semana de ventas!', txt); else G.log(txt); } }
      g.nextfansChange = undefined; g.nextSalesCash = undefined;
    }
    if (g.totalSalesCash > g.currentSalesCash) {
      const first = g.currentSalesCash === 0; const inc = Sales.getIncome(co, g);
      g.nextfansChange = g.totalSalesCash > 0 ? Math.floor(inc / g.totalSalesCash * (g.fansChangeTarget || 0)) : 0; if (!isFinite(g.nextfansChange)) g.nextfansChange = 0; g.nextSalesCash = Math.floor(inc);
      if (g.flags.royaltyRate) g.nextSalesCash = Math.floor(g.nextSalesCash * g.flags.royaltyRate);
      if (g.nextSalesCash <= 0) { g.nextSalesCash = undefined; g.totalSalesCash = g.currentSalesCash; } else g.salesCashLog.push(g.nextSalesCash);
      if (g.initialSalesRank !== -1) { const a = (week - g.releaseWeek) / d; let r = Math.max(g.initialSalesRank, Math.floor(g.initialSalesRank + 2 * g.initialSalesRank * (a - 0.1))); g.nextSalesRank = r > 100 ? -1 : r; }
      g.firstSales = first;
    } else { g.soldOut = true; g.currentSalesRank = -1; G.emit('soldout', g); G.notify('Colección retirada', `${g.title} ya no está a la venta. Vendió ${U.num(g.unitsSold)} monturas y generó ${U.money(g.revenue)}.`, 'sales'); G.emit('soldout', g); }
  },
  processSales(co) { const week = Math.floor(co.currentWeek); for (const g of co.gameLog) if (week > g.releaseWeek && !g.soldOut) Sales.sellGame(co, g, week); }
};

/* =====================================================================
   TENDENCIAS
   ===================================================================== */
const Trends = {
  factor(g) {
    const t = G.company.flags.trends && G.company.flags.trends.currentTrend; if (!t) return 1;
    if (t.type === 'era') { const st = (t.styles || []).includes(g.topic), gn = (t.genres || []).includes(g.genre); return st && gn ? 1.12 : st ? 1.08 : 1; }
    if (t.type === 'genre') { if (g.genre === t.genre) return 1.2; }
    else if (t.type === 'newTopics') { if (!G.company.gameLog.some(x => x.topic === g.topic)) return 1.2; }
    else if (t.type === 'audience') { if (g.targetAudience === t.audience) return 1.2; }
    else if (t.type === 'strangeCombos') { const a = W.genre(DB.topic(g.topic).gw, g.genre); return a === 1 ? 0.85 : a === 0.9 ? 1.1 : a === 0.8 ? 1.2 : 1.4; }
    return 1;
  },
  update(co) {
    co.flags.trends = co.flags.trends || { expireBy: 0, currentTrend: null };
    const b = co.flags.trends; if (b.expireBy > G.gameTime) return;
    b.expireBy = G.gameTime + (24 + 12 * U.rnd()) * WEEK_MS; if (co.level === 1) return;
    const prev = b.currentTrend; b.currentTrend = null;
    /* tendencias históricas: la moda real de cada época tiene prioridad sobre las aleatorias */
    const ry = U.realYear(co.getCurrentDate().year); b.usedEras = b.usedEras || [];
    const era = (DATA.TRENDS || []).find(x => !b.usedEras.includes(x.year) && x.year <= ry && x.year >= ry - 1);
    if (era) { b.usedEras.push(era.year); b.expireBy = G.gameTime + Math.min(era.years, 2) * 24 * WEEK_MS; b.currentTrend = { type: 'era', year: era.year, styles: era.styles, genres: era.genres, label: 'Moda: ' + era.name };
      G.notify('Tendencias', `${era.text}
Estilos de moda: ${era.styles.map(id => DB.topic(id) ? DB.topic(id).name : id).join(', ')}. Tipos favorecidos: ${era.genres.map(id => DB.genre(id).name).join(', ')}.`, 'news'); return; }
    if (prev === null && U.rnd() >= 0.5) {
      const l = U.rnd();
      if (l <= 0.5) { const gnr = U.pick(co.availableGenres()); b.currentTrend = { type: 'genre', genre: gnr.id, label: 'Tipo de moda: ' + gnr.name }; }
      else if (l <= 0.7) b.currentTrend = { type: 'newTopics', label: 'De moda: estilos nuevos' };
      else if (l <= 0.95) { if (co.hasResearch('TargetAudience')) { const a = U.pick(DATA.AUDIENCES); b.currentTrend = { type: 'audience', audience: a.id, label: 'Público fuerte: ' + a.name }; } }
      else b.currentTrend = { type: 'strangeCombos', label: 'Tendencia: combinaciones raras' };
    }
    if (prev && !b.currentTrend) G.notify('Tendencias', 'El mercado se ha normalizado y ya no hay tendencias claras.', 'news');
    else if (b.currentTrend) { const txt = { genre: `Las revistas no hablan de otra cosa: las gafas de tipo «${b.currentTrend.genre ? DB.genre(b.currentTrend.genre).name : ''}» arrasan. Se espera que las colecciones de este tipo se vendan mejor durante los próximos meses.`, newTopics: 'Los clientes están cansados de lo de siempre. Las colecciones con estilos que nunca hayamos trabajado tendrán mejor acogida.', audience: `Los analistas detectan una demanda fuerte en el público «${b.currentTrend.audience ? DATA.AUDIENCES.find(a => a.id === b.currentTrend.audience).name : ''}».`, strangeCombos: 'Hay una moda extraña: cuanto más rara sea la combinación de estilo y tipo, mejor se vende. Las combinaciones "perfectas" se ven aburridas.' }[b.currentTrend.type]; G.notify('Tendencias del mercado', txt, 'news'); }
  }
};

/* =====================================================================
   EMPRESA (Company)
   ===================================================================== */
class Company {
  constructor(name, playerName, startYear) {
    this.startYear = startYear || 1995; this.name = name; this.cash = C.START_CASH; this.fans = 0; this.fansChange = 0; this.researchPoints = 0; this.currentWeek = 0; this.level = 1; this.maxStaff = C.LEVELS[1].maxStaff;
    this.staff = [new Character({ id: 0, name: playerName, dF: 0.6, tF: 0.6, speedF: 0.6, qualityF: 0.2, researchF: 0.6, salary: 0, slot: 0, sex: 'male', look: 0, role: 'optico' })];
    this.modules = {};
    this.currentGame = null; this.gameLog = []; this.cashLog = []; this.notifications = [];
    this.topics = []; this.researchCompleted = []; this.availableResearch = []; this.engines = []; this.licencedPlatforms = ['tienda', 'mercadillos'];
    this.flags = { nextGameHypeBonus: 0 }; this.missionXp = {}; this.featureXp = {}; this.lastTopScore = 0; this.lastTopScoreIncrease = 0; this.lastTopScoreWeek = 0; this.lastTopScoreGameSize = 'small'; this.previousTopScore = 0; this.topScoreAchievements = 0;
    this.researchEnabled = false; this.contractsEnabled = false; this.topicOrder = U.shuffle(DATA.TOPICS.map(t => t.id)); this.scheduledShown = []; this.awards = []; this.stats = { totalRevenue: 0, bestScore: 0 };
    /* mecánicas GDT: responsables por campo (valores por defecto), conocimiento de los informes, tutorial, informes, galas y canales propios */
    this.flags.featureResponsibility = {}; this.knowledge = {}; this.tutorialShown = []; this.reports = []; this.awardsHistory = []; this.ownPlatforms = [];
    this.topics = this.topicOrder.filter(t => (DB.topic(t).year || 0) <= this.startYear && !(DB.topic(t).until && DB.topic(t).until < this.startYear)).slice(0, 4);
    this.engines.push({ id: 'taller0', name: 'Taller básico', parts: DATA.PARTS.filter(p => p.start).map(p => p.id), createdWeek: 0 });
  }
  /* repara partidas antiguas: rellena los campos nuevos con valores por defecto */
  repair() {
    if (!this.startYear || !Number.isFinite(+this.startYear)) this.startYear = 1995;
    if (Array.isArray(this.topicOrder)) { const miss = DATA.TOPICS.map(t => t.id).filter(id => !this.topicOrder.includes(id)); for (const id of miss) this.topicOrder.splice(Math.floor(U.rnd() * (this.topicOrder.length + 1)), 0, id); }
    for (const [k, v] of [['cash', 0], ['fans', 0], ['researchPoints', 0], ['currentWeek', 0]]) if (!Number.isFinite(this[k])) this[k] = v;
    this.level = U.clamp(Math.round(+this.level) || 1, 1, C.LEVELS.length - 1);
    for (const k of ['notifications', 'gameLog', 'engines', 'licencedPlatforms', 'topics', 'researchCompleted', 'availableResearch', 'scheduledShown', 'cashLog']) if (!Array.isArray(this[k])) this[k] = [];
    this.topics = this.topics.filter(t => DB.topic(t)); this.gameLog = this.gameLog.filter(g => g && DB.topic(g.topic) && DB.genre(g.genre));
    this.flags = this.flags || {}; if (!this.flags.featureResponsibility || typeof this.flags.featureResponsibility !== 'object') this.flags.featureResponsibility = {};
    if (this.flags.nextGameHypeBonus === undefined) this.flags.nextGameHypeBonus = 0;
    if (!this.knowledge || typeof this.knowledge !== 'object') this.knowledge = {};
    if (!Array.isArray(this.tutorialShown)) this.tutorialShown = []; if (!Array.isArray(this.reports)) this.reports = []; if (!Array.isArray(this.awardsHistory)) this.awardsHistory = []; if (!Array.isArray(this.ownPlatforms)) this.ownPlatforms = [];
    if (!Array.isArray(this.awards)) this.awards = []; if (!Array.isArray(this.achievements)) this.achievements = []; this.stats = Object.assign({ totalRevenue: 0, bestScore: 0 }, this.stats || {}); this.modules = this.modules || {};
    for (const s of this.staff) { s.flags = s.flags || {}; if (!s.flags.workload) s.flags.workload = 0; if (!s.flags.responsibilityCount) s.flags.responsibilityCount = {}; }
    for (const g of this.gameLog) { g.flags = g.flags || {}; if (!g.flags.featureResponsibility) g.flags.featureResponsibility = {}; }
    if (this.currentGame) { this.currentGame.flags = this.currentGame.flags || {}; if (!this.currentGame.flags.featureResponsibility) this.currentGame.flags.featureResponsibility = {}; if (!this.currentGame.flags.staffContribution) this.currentGame.flags.staffContribution = {}; }
    return this;
  }
  getCurrentDate() { return U.dateFromWeek(this.currentWeek); }
  isLaterOrEqualThan(y, m) { return Math.floor(this.currentWeek) + (this.startYear - 1995) * 48 >= U.weekFromDate(`${y}/${m || 1}/1`); }
  realYear() { return this.getCurrentDate().year + this.startYear - 1; }
  playedAtLeast(y, m) { return Math.floor(this.currentWeek) >= U.weekFromDate(`${y}/${m || 1}/1`); } /* tiempo jugado (hitos de progresión, como en GDT) */
  adjustCash(v, label, notRevenue) { if (!isFinite(v)) { console.error('adjustCash: valor no numérico', label, v); return; } this.cash += v; if (label) this.cashLog.push({ week: Math.floor(this.currentWeek), amount: v, label }); if (this.cashLog.length > 400) this.cashLog.shift(); if (v > 0 && !notRevenue) this.stats.totalRevenue += v; G.emit('cash', v); }
  adjustFans(v) { if (!isFinite(v)) { console.error('adjustFans: valor no numérico', v); return; } if (v > 0 && this.fans > 2e6) v *= 2e6 / this.fans; /* saturación desde 2 M: crecer cuesta cada vez más, pero nunca se para */ this.fans = Math.max(0, Math.round(this.fans + v)); if (!isFinite(this.fans)) this.fans = 0; }
  hasResearch(id) { return this.researchCompleted.includes(id); }
  canDevelopEngine() { return this.hasResearch('CustomEngine'); }
  canSetTargetAudience() { return this.hasResearch('TargetAudience'); }
  availableGenres() { return DATA.GENRES.filter(g => !g.research || this.hasResearch(g.research)); }
  availableSizes() { const s = ['small']; if (this.hasResearch('MediumSizeGames')) s.push('medium'); if (this.hasResearch('LargeSizeGames')) s.push('large'); if (this.hasResearch('AAA')) s.push('aaa'); return s; }
  save() {
    const o = Object.assign({}, this); o.staff = this.staff.map(s => s.save());
    /* las colecciones antiguas (salvo las 10 últimas) se guardan sin el detalle de trabajo, que es el 80 % del peso; el desglose de la nota se conserva */
    const n = this.gameLog.length; o.gameLog = this.gameLog.map((g, i) => { if (i >= n - 10 || !g.flags || !g.soldOut || !g.flags.reportDone) return g; const f = Object.assign({}, g.flags); delete f.xpLog; delete f.taller; delete f.staffContribution; delete f.featureResponsibility; return Object.assign({}, g, { flags: f, featureLog: undefined }); }); return o;
  }
  static load(o) { const c = new Company(o.name, 'x'); Object.assign(c, o); c.staff = o.staff.map(s => new Character(s)); return c.repair(); }
}

/* =====================================================================
   GAME MANAGER
   ===================================================================== */
/* ---------- logros (se calculan sobre el estado; se guardan con la semana en que se consiguieron) ---------- */
const ACHIEVEMENTS = [
  { id: 'primera', icon: '👓', name: 'Abrimos el puesto', desc: 'Lanza tu primera colección', test: co => co.gameLog.length >= 1 },
  { id: 'nota8', icon: '⭐', name: 'Buena crítica', desc: 'Una colección con nota 8 o más', test: co => co.gameLog.some(g => g.score >= 8) },
  { id: 'nota95', icon: '🌟', name: 'Matrícula de honor', desc: 'Una colección con nota 9,5 o más', test: co => co.gameLog.some(g => g.score >= 9.5) },
  { id: 'pleno', icon: '💯', name: 'Pleno de dieces', desc: 'Las cuatro revistas te ponen un 10', test: co => co.gameLog.some(g => g.reviews && g.reviews.length && g.reviews.every(r => r.score === 10)) },
  { id: 'col10', icon: '📚', name: 'Catálogo propio', desc: 'Lanza 10 colecciones', test: co => co.gameLog.length >= 10 },
  { id: 'col50', icon: '🗂️', name: 'Medio centenar', desc: 'Lanza 50 colecciones', test: co => co.gameLog.length >= 50 },
  { id: 'super', icon: '📦', name: 'Superventas', desc: 'Una colección que vende 100.000 monturas', test: co => co.gameLog.some(g => (g.unitsSold || 0) >= 1e5) },
  { id: 'millon', icon: '💶', name: 'El primer millón', desc: '1 M€ de ingresos acumulados', test: co => co.stats.totalRevenue >= 1e6 },
  { id: 'imperio', icon: '👑', name: 'Imperio óptico', desc: '100 M€ de ingresos acumulados', test: co => co.stats.totalRevenue >= 1e8 },
  { id: 'local', icon: '🏬', name: 'Del mercado a la calle', desc: 'Múdate al local comercial', test: co => co.level >= 2 },
  { id: 'gabinete', icon: '👁️', name: 'Con gabinete propio', desc: 'Múdate a la óptica con gabinete', test: co => co.level >= 3 },
  { id: 'insignia', icon: '🏙️', name: 'Óptica insignia', desc: 'Llega al último local', test: co => co.level >= 4 },
  { id: 'prisma', icon: '🏆', name: 'Prisma de Oro', desc: 'Gana un premio del sector', test: co => co.awards.length >= 1 },
  { id: 'prismas5', icon: '🎖️', name: 'Vitrina llena', desc: 'Gana 5 Prismas de Oro', test: co => co.awards.length >= 5 },
  { id: 'fieles', icon: '❤️', name: 'Cien mil fieles', desc: 'Llega a 100.000 clientes fieles', test: co => co.fans >= 1e5 },
  { id: 'secuela', icon: '🔁', name: 'Segunda edición', desc: 'Lanza la segunda edición de una colección', test: co => co.gameLog.some(g => g.sequelTo) },
  { id: 'acuerdo', icon: '🤝', name: 'Trato hecho', desc: 'Lanza una colección para un distribuidor', test: co => co.gameLog.some(g => g.contractId) },
  { id: 'deptos', icon: '🏗️', name: 'La óptica completa', desc: 'Monta tienda, gabinete, taller y laboratorio', test: co => ['gabinete', 'taller', 'lab'].every(id => co.modules && co.modules[id] && co.modules[id].tier >= 1) && co.level >= 2 },
  { id: 'equipo', icon: '👥', name: 'Plantilla completa', desc: 'Llena la plantilla de la óptica insignia', test: co => co.level >= 4 && co.staff.length >= co.maxStaff },
  { id: 'sabio', icon: '🔬', name: 'Siempre investigando', desc: 'Completa 40 investigaciones', test: co => (co.researchCompleted || []).length >= 40 },
  { id: 'decada', icon: '📅', name: 'Diez años abiertos', desc: 'Sigue en el negocio diez años', test: co => co.getCurrentDate().year >= 11 },
  { id: 'treinta', icon: '🎂', name: 'Treinta años de óptica', desc: 'Sigue en el negocio treinta años', test: co => co.getCurrentDate().year >= 31 },
  { id: 'cincuenta', icon: '🥇', name: 'Bodas de oro', desc: 'Sigue en el negocio cincuenta años', test: co => co.getCurrentDate().year >= 51 },
  { id: 'idlab', icon: '🧪', name: 'Laboratorio I+D', desc: 'Monta el laboratorio de I+D', test: co => co.hasResearch('RnDLab') },
  { id: 'grandes3', icon: '🚀', name: 'Proyectos de futuro', desc: 'Termina 3 proyectos del Laboratorio I+D', test: co => ['OwnLensBrand', 'GafaPropia', 'OwnTryOn', 'OwnFrameBrand', 'Subscription'].filter(id => co.hasResearch(id)).length >= 3 },
  { id: 'red6', icon: '🗺️', name: 'Red gallega', desc: 'Abre 6 sucursales', test: co => (co.branches || 0) >= 6 },
  { id: 'red12', icon: '🌍', name: 'Cadena completa', desc: 'Abre las 12 sucursales', test: co => (co.branches || 0) >= 12 },
  { id: 'relevo', icon: '👪', name: 'Segunda generación', desc: 'Pasa la óptica a otra generación', test: co => (co.flags.generations || 1) >= 2 },
  { id: 'relevo3', icon: '🌳', name: 'Saga familiar', desc: 'Tres generaciones al frente de la óptica', test: co => (co.flags.generations || 1) >= 3 },
  { id: 'milmillones', icon: '🏦', name: 'Mil millones', desc: '1.000 M€ de ingresos acumulados', test: co => co.stats.totalRevenue >= 1e9 },
  { id: 'fieles10m', icon: '💞', name: 'Diez millones de fieles', desc: 'Llega a 10 millones de clientes fieles', test: co => co.fans >= 1e7 },
  { id: 'col100', icon: '🏛️', name: 'Centenario de colecciones', desc: 'Lanza 100 colecciones', test: co => co.gameLog.length >= 100 },
  { id: 'decadas', icon: '🕰️', name: 'Prismas de tres décadas', desc: 'Gana Prismas de Oro en tres décadas distintas', test: co => new Set(co.awards.map(a => Math.floor(U.realYear(a.year) / 10))).size >= 3 },
  { id: 'fin2076', icon: '🏁', name: 'Hasta 2076', desc: 'Llega al final de la partida', test: co => co.realYear() >= 2076 }
];

const G = {
  SAVE_KEY: 'opticaTycoon.v4',
  END_YEAR: 2076,
  /* épocas de inicio: año → contexto para la bienvenida */
  ERA_INTRO: {
    1965: 'España vive el desarrollismo: el oftalmólogo receta y la óptica talla y monta; las gafas de pasta y las de metal dorado mandan.',
    1975: 'Llega la Transición: crisis del petróleo, inflación alta y una juventud que quiere gafas grandes y de colores.',
    1985: 'España entra en la CEE (1986) y llega el IVA: cadenas de ópticas, lentillas desechables y el boom de las marcas.',
    2026: 'Las gafas inteligentes ya se venden por millones y la miopía crece sin freno: el óptico se convierte en especialista en salud visual.'
  },
  company: null, gameTime: 0, speed: 1, paused: true, currentFeature: null, featureQueue: [], currentEngineDev: null, currentContract: null, contracts: null, hireSearch: null, candidates: null,
  listeners: {}, points: [], lastResearchCheck: 0, pendingSliders: null, unreadLog: [],
  on(ev, fn) { (this.listeners[ev] = this.listeners[ev] || []).push(fn); },
  emit(ev, data) { (this.listeners[ev] || []).forEach(fn => { try { fn(data); } catch (e) { console.error(ev, e); } }); },

  /* ---------- inicio ---------- */
  newGame(companyName, playerName, startYear) {
    /* la partida anterior no se pierde: queda como copia («Recuperar partida anterior») */
    if (this.company && this.company.cash >= -this.overdraftLimit() && !this.company.flags.sold) this.save(); this.backupFailed = false; try { const p = localStorage.getItem(G.SAVE_KEY); if (p) localStorage.setItem(G.SAVE_KEY + '.bak', p); } catch (e) { this.backupFailed = true; /* no cabe la copia: la UI avisa */ }
    this.removeOwnPlatforms();
    this.company = new Company(companyName, playerName, startYear); this.gameTime = 0; this.currentFeature = null; this.featureQueue = []; this.currentEngineDev = null; this.currentContract = null; this.contracts = null; this.hireSearch = null; this.candidates = null; this.points = []; this.unreadLog = [];
    this.paused = true; this.speed = 1; Modules.init(this.company);
    /* las partidas que empiezan en 2026 arrancan con un mercado del tamaño del de 1995 (si no, serían un paseo); el crecimiento posterior se mantiene */
    { const co = this.company; const tot = sh => { const save = co.startYear; co.startYear = sh; const t = Platforms.existing(0).reduce((s, p) => s + Platforms.rawMarketSize(p, 0), 0); co.startYear = save; return t; };
      const t95 = tot(1995), t0 = tot(co.startYear);
      /* y que el mercado gratuito del principio (tienda + mercadillos) sea al menos el 40 % del de 1995: sin eso, 1985 y 2026 llevaban a la quiebra */
      const free = sh => { const save = co.startYear; co.startYear = sh; const t = Platforms.existing(0).filter(p => co.licencedPlatforms.includes(p.id)).reduce((s, p) => s + Platforms.rawMarketSize(p, 0), 0); co.startYear = save; return t; };
      const f95 = free(1995), f0 = free(co.startYear); co.marketScale = Math.max(t0 > t95 ? t95 / t0 : 1, f0 > 0 ? Math.min(3, 0.4 * f95 / f0) : 1); if (co.startYear === 1995) co.marketScale = 1; }
    { const co = this.company; co.knowledge = co.knowledge || {}; co.knowledge._combos = co.knowledge._combos || {}; for (const t of co.topics.slice(0, 3)) { const tp = DB.topic(t); let bi = tp.gw[0] >= tp.gw[4] ? 0 : 4; co.knowledge._combos[t + '|' + DATA.GENRES[bi].id] = tp.gw[bi]; } } /* el consejo de bienvenida cuenta como encaje ya conocido */
    const sy = this.company.startYear; this.notify('Bienvenido', DATA.NEWS[0].text.replace('Es 1995.', `Es ${sy}.`).replace('70.000 € ahorrados', sy < 1995 ? 'unos ahorros equivalentes a 70.000 € de hoy' : '70.000 € ahorrados').replace(/\(Aviador[^)]*\)/, '(' + this.company.topics.slice(0, 3).map(t => { const tp = DB.topic(t); const okG = [0, 4]; let bi = tp.gw[0] >= tp.gw[4] ? 0 : 4; okG.forEach(i => { if (tp.gw[i] > tp.gw[bi]) bi = i; }); return tp.name + ' → ' + DATA.GENRES[bi].name; }).join(', ') + ')') + (G.ERA_INTRO[sy] ? ' ' + G.ERA_INTRO[sy] : '')); this.company.scheduledShown.push('1/1/1');
    this.emit('newgame'); this.emit('refresh');
  },

  /* ---------- bucle principal ---------- */
  tick(dtReal) {
    if (!this.company) return; this.showPendingNotifications(); if (this.paused) return; const dt = Math.min(dtReal, 100) * this.speed; this.gameTime += dt;
    const co = this.company; const prevWeek = co.currentWeek; co.currentWeek = this.gameTime / WEEK_MS;
    if (Math.floor(co.currentWeek) > Math.floor(prevWeek)) { for (let w = Math.floor(prevWeek) + 1; w <= Math.floor(co.currentWeek); w++) this.proceedOneWeek(w); if (co.cash >= 0) { delete co.flags['bankruptWarning' + co.level]; delete co.flags['bankruptWarn2' + co.level]; } if (co.cash < 0) { this.checkGameOver(); if (this.paused) return; } }
    if (Math.floor(10 * co.currentWeek) > Math.floor(10 * prevWeek)) { this.checkForNewResearch(); this.checkTriggers(); this.emit('status'); }
    this.updateFeatures(); for (const s of co.staff) s.tick(this.gameTime);
    if (co.currentGame && !this.currentFeature && !this.featureQueue.length && co.currentGame.stage < 3 && !this.modalOpen) { this.modalOpen = true; this.paused = true; this.emit('sliders', co.currentGame.stage + 1); }
    if (this.currentContract && this.currentContract.type === 'generic') this.updateContractProgress();
    this.updatePoints(dt); this.showPendingNotifications();
  },

  /* ---------- burbujas de puntos ---------- */
  spawnPoint(ch, type) { this.points.push({ ch: ch.id, type, t: 0, duration: C.SPAWN_POINTS_DURATION, delay: Math.random() * 300 }); },
  updatePoints(dt) {
    for (let i = this.points.length - 1; i >= 0; i--) { const p = this.points[i]; if (p.delay > 0) { p.delay -= dt; continue; } p.t += dt; if (p.t >= p.duration) { const ch = this.company.staff.find(s => s.id === p.ch) || this.company.staff[0]; ch.applyPoint(p.type, 1); this.points.splice(i, 1); this.emit('points'); } }
  },
  staffCountWorking() { return Math.max(1, this.company.staff.filter(s => s.state === 'working').length); },
  isIdle() { return !this.company.currentGame && !this.currentEngineDev && !this.currentContract; },

  /* ---------- semana ---------- */
  proceedOneWeek(w) {
    const co = this.company; const d = U.dateFromWeek(w);
    Sales.processSales(co);
    this.offerReports(w); this.checkBoosts(w);
    for (const g of co.gameLog) if (g.flags && g.flags.cfWeek && w >= g.flags.cfWeek) { delete g.flags.cfWeek; if (!g.soldOut) this.checkCounterfeit(g); }
    Modules.call('weekly', co, w, d);
    if (d.week === 1) { const b = General.monthlyCosts(co); co.adjustCash(-b, 'Gastos mensuales'); if (co.currentGame) co.currentGame.costs += b; if (!Modules.get('gabinete')) this.gabineteIncome(); this.subscriptionIncome(); Modules.call('monthly', co, d); this.decayWear(co); if (co.branches) co.adjustCash(this.branchesNet(co), 'Red de sucursales'); if (co.hasResearch('RnDLab')) co.researchPoints += 10 + 2 * (co.branches || 0); /* el laboratorio de I+D produce investigación */ }
    if (d.month === 1 && d.week === 1 && d.year > 1) { const ry = U.realYear(d.year); const nuevos = DATA.TOPICS.filter(t => t.year === ry); if (nuevos.length) this.log(`🆕 Nuevos estilos en el mercado (${ry}): ${nuevos.map(t => t.name).join(', ')}. Ya se pueden investigar.`); }
    Trends.update(co);
    if (co.startYear !== 1995 && d.week === 1) { if (!co.flags.targetAudienceStory && co.playedAtLeast(2, 6)) { co.flags.targetAudienceStory = true; this.notify('Público objetivo', 'Los estudios de mercado empiezan a segmentar las ventas de gafas por edades. Investigar «Público objetivo» permitiría orientar mejor cada colección.'); } if (!co.flags.marketingStory && co.playedAtLeast(3, 4)) { co.flags.marketingStory = true; this.notify('Publicidad', 'Las revistas de moda lanzan secciones de óptica. Investigar «Marketing» permitiría anunciar las colecciones antes de su lanzamiento.'); } }
    if (co.level > 1 && d.month === 5 && d.week === 1 && co.realYear() >= 2001) this.notify('IberÓptica', 'La feria IberÓptica (Madrid) se celebra en junio: ópticas, laboratorios y fabricantes de toda la península. ¿Reservamos un stand?', 'decision', { sourceId: 'booth' });
    else if (d.month === 6 && d.week === 2 && co.conferenceStandFactor) this.runConference();
    for (const p of DATA.PLATFORMS) { if (Platforms.openWeek(p) === U.absWeek(w) && w > 0) { this.notify('Noticias del canal', Platforms.openWeek(p) > Platforms.publishWeek(p) ? `${p.name} (${p.company}) se fija en tu óptica: ya puedes vender tus colecciones en este canal.` : `Hoy se abre un nuevo canal de venta: ${p.name} (${p.company}).` + (p.licencePrize ? ` Licencia: ${U.money(p.licencePrize)}.` : ''), 'news'); if (p.licencePrize === 0 && !co.licencedPlatforms.includes(p.id)) co.licencedPlatforms.push(p.id); } if (Platforms.retireWeek(p) === U.absWeek(w) && w > 0 && (U.startYear() < 1995 || !p.pastOnly) && Platforms.openWeek(p) < U.absWeek(w)) this.notify('Noticias del canal', `${p.name} cierra sus puertas. Ya no se pueden lanzar colecciones ahí.`, 'news'); }
    for (const n of DATA.NEWS) { if (n.classic && co.startYear !== 1995) continue; if (U.weekFromDate(n.date) === U.absWeek(w) && !co.scheduledShown.includes(n.date)) { co.scheduledShown.push(n.date); if (n.flag) co.flags[n.flag] = true; this.notify(n.title, n.text, 'news'); } }
    if (this.hireSearch && w >= this.hireSearch.targetWeek && !this.candidates) { this.candidates = this.generateApplicants(this.hireSearch); this.notify('Candidatos', `Han llegado ${this.candidates.length} candidaturas para el puesto. Revísalas en el menú de personal.`, 'decision', { sourceId: 'hire' }); }
    if (this.currentContract && this.currentContract.type === 'generic' && w >= this.currentContract.deadlineWeek) this.finishContract(false);
    if (d.month === 1 && d.week === 1 && d.year > 1) { this.yearlyAwards(d.year - 1); this.yearlyRecap(d.year - 1); }
    if (d.month === 1 && d.week === 1 && (d.year === 36 || d.year === 71 || d.year === 106) && !co.flags['relevo' + d.year]) { co.flags['relevo' + d.year] = true; const best = this.bestHeirEmployee(); this.notify('Relevo generacional', `Han pasado ${d.year - 1} años desde que se abrió el puesto del mercado. Toca decidir quién lleva la óptica a partir de ahora.`, 'decision', { sourceId: 'relevo', options: ['Lo coge mi hija o mi hijo (talento parecido, menos experiencia, +3 % de clientes fieles)', best ? `Se la dejo a ${best.name} (ocupa tu puesto con su talento y deja una plaza libre)` : 'Busco un gerente de fuera (menos experiencia)', 'Vender la óptica y retirarme (fin de la partida: el patrimonio suma a la puntuación)'] }); }
    if (d.month === 1 && d.week === 1 && co.realYear() >= this.END_YEAR && !co.flags.end2076) { co.flags.end2076 = true; co.flags.endReason = 'fin'; this.notify(`Fin de la partida: ${this.END_YEAR}`, `Hemos llegado a ${this.END_YEAR}. Hora de hacer balance de toda la historia de ${co.name}.`, 'decision', { sourceId: 'gameend', options: ['Ver la puntuación final'] }); }
    if (d.year === 31 && d.month === 1 && d.week === 1 && !co.flags.endShown) { co.flags.endShown = true; this.notify('30 años de óptica', `Han pasado treinta años desde aquel puesto del mercado de ${co.startYear}. Es hora de hacer balance (la partida puede seguir hasta 2076).`, 'decision', { sourceId: 'gameend', options: ['Ver el balance (la partida sigue)'] }); }
    this.randomEvents(w);
    this.checkAchievements();
    /* autoguardado al final de la semana (después de relevo, fin de partida y eventos) */
    if (d.week === 1 && (this.speed < 2 || d.month % 3 === 1) && co.cash >= -this.overdraftLimit()) this.emit('autosave');
    this.emit('week');
  },
  gabineteIncome() {
    const co = this.company; if (!co.hasResearch('Gabinete') || co.staff.length < 2) return;
    let pts = 80 + Math.min(600, co.fans / 500); let mult = 1; if (co.hasResearch('Lentillas')) mult += 0.3; if (co.hasResearch('Retinografo')) mult += 0.6; if (co.hasResearch('TerapiaVisual')) mult += 1;
    pts = Math.floor(pts * (0.8 + 0.4 * U.rnd())); const income = Math.floor(pts * 90 * mult); co.adjustCash(income, 'Gabinete'); co.adjustFans(Math.floor(pts / 20));
    this.log(`Gabinete: ${U.num(pts)} pacientes este mes, ${U.money(income)}.`);
  },
  /* ---------- Prismas de Oro: gala anual con categorías, nominados y competidores ficticios ---------- */
  AWARD_CATEGORIES: [
    { id: 'best', name: 'Prisma de Oro a la colección del año', icon: '🏆', desc: 'La colección más completa del año según el jurado de la feria de París.' },
    { id: 'design', name: 'Prisma de Oro al diseño', icon: '🎨', desc: 'Forma, concepto y acabados: la colección más bonita.' },
    { id: 'tech', name: 'Prisma de Oro a la innovación técnica', icon: '⚙️', desc: 'Estructura, lentes y materiales: la colección mejor construida.' },
    { id: 'newstyle', name: 'Prisma de Oro a la revelación', icon: '✨', desc: 'La mejor colección en un estilo que la óptica nunca había trabajado.' },
    { id: 'public', name: 'Premio del público', icon: '❤️', desc: 'Votado por los clientes: la colección más vendida y querida.' }
  ],
  COMPETITORS: ['Óptica Casares Hnos.', 'FocoExpress', 'DúoVisión', 'Casa Valmont', 'SunDrop Co.', 'Grupo Vértice Óptico', 'Atelier Mirada', 'Óptica Ría Grande', 'Gafas Atlántico', 'Ópticas Miraflor', 'Ollos Novos', 'Vista Clara', 'Óptica Meridiana', 'Casa das Lentes', 'Brillos de Moda', 'Óptica Solpor', 'Mirada Urbana', 'Lúmina Eyewear', 'Óptica do Mar', 'Cristal Fino'],
  COMPETITOR_COLLECTIONS: ['Serie Negra', 'Colección Marea', 'Línea Horizonte', 'Edición Brétema', 'Colección Faro', 'Serie Granito', 'Línea Ámbar', 'Colección Luar', 'Edición Vento', 'Serie Sal', 'Colección Néboa', 'Línea Orballo', 'Edición Ártabra', 'Serie Castro', 'Colección Area'],
  awardStrength(cat, g) {
    const D = g.designPoints || 0, T = g.technologyPoints || 0, share = D + T > 0 ? D / (D + T) : 0.5;
    if (cat === 'design') return g.score + 2 * (share - 0.5);
    if (cat === 'tech') return g.score + 2 * (0.5 - share);
    if (cat === 'public') return g.score * 0.6 + 4 * U.clamp(Math.log10(1 + (g.unitsSold || 0)) / 6, 0, 1);
    return g.score;
  },
  /* foto de cada año (gráfica del final) y un balance que no detiene el juego */
  yearlyRecap(year) {
    const co = this.company; const Y = co.stats.yearly = Array.isArray(co.stats.yearly) ? co.stats.yearly : []; const prev = Y[Y.length - 1];
    const gs = co.gameLog.filter(g => g.releaseWeek !== undefined && U.dateFromWeek(g.releaseWeek).year === year); const best = gs.reduce((m, g) => Math.max(m, g.score || 0), 0); const aw = co.awards.filter(a => a.year === year).length;
    const rec = { y: U.realYear(year), cash: Math.round(co.cash), fans: Math.round(co.fans), totRev: Math.round(co.stats.totalRevenue), rev: prev || year === 1 ? Math.round(co.stats.totalRevenue - (prev ? prev.totRev : 0)) : null, best: Math.round(best * 10) / 10, n: gs.length, aw };
    Y.push(rec); if (Y.length > 120) Y.shift(); if (rec.rev === null) return; /* partida guardada antes de existir el balance */
    const dv = prev && prev.rev > 0 ? Math.round((rec.rev / prev.rev - 1) * 100) : null;
    this.notify(`Balance de ${rec.y}`, `Ingresos ${U.shortMoney(rec.rev)}${dv !== null ? ` (${dv >= 0 ? '+' : ''}${dv} % frente a ${rec.y - 1})` : ''} · caja ${U.shortMoney(rec.cash)} · ${U.num(rec.fans)} clientes fieles · ${gs.length} colección${gs.length === 1 ? '' : 'es'}${best ? `, mejor nota ${best.toFixed(1).replace('.', ',')}` : ''}${aw ? ` · ${aw} Prisma${aw > 1 ? 's' : ''} de Oro` : ''}.`, 'news');
  },
  yearlyAwards(year) {
    const co = this.company; const games = co.gameLog.filter(g => U.dateFromWeek(g.releaseWeek).year === year); if (!games.length) return null;
    const firstTopicYear = {}; for (const g of co.gameLog) { if (firstTopicYear[g.topic] === undefined) firstTopicYear[g.topic] = U.dateFromWeek(g.releaseWeek).year; }
    const names = U.shuffle(this.COMPETITORS), cols = U.shuffle(this.COMPETITOR_COLLECTIONS); let ni = 0;
    const ceremony = { year, categories: [], won: [] };
    for (const cat of this.AWARD_CATEGORIES) {
      let pool = games.filter(g => g.score >= 6); if (cat.id === 'newstyle') pool = pool.filter(g => firstTopicYear[g.topic] === year);
      const ours = pool.map(g => ({ title: g.title, by: co.name, gameId: g.id, strength: this.awardStrength(cat.id, g), score: g.score, ours: true })).sort((a, b) => b.strength - a.strength).slice(0, 1);
      const rivals = []; for (let i = 0; i < 3; i++) { const s = U.clamp(6.8 + 2.3 * U.rnd() + 0.025 * Math.min(year, 30), 6, 9.9); rivals.push({ title: cols[(ni + i) % cols.length], by: names[(ni + i) % names.length], strength: s, score: s, ours: false }); } ni += 3;
      const nominees = ours.concat(rivals).sort((a, b) => b.strength - a.strength).slice(0, 3);
      const winner = nominees[0]; const entry = { id: cat.id, name: cat.name, icon: cat.icon, desc: cat.desc, nominees, winner, ours: !!winner.ours, nominated: ours.length > 0 };
      ceremony.categories.push(entry);
      if (entry.ours) { ceremony.won.push(cat.id); co.awards.push({ year, category: cat.id, categoryName: cat.name, title: winner.title, score: winner.score });
        if (cat.id === 'best') { co.flags.nextGameHypeBonus += 50; co.adjustFans(Math.floor(co.fans * 0.04) + 1000); } else { co.flags.nextGameHypeBonus += 20; co.adjustFans(Math.floor(co.fans * 0.015) + 300); } }
    }
    co.awardsHistory.push(ceremony); if (co.awardsHistory.length > 40) co.awardsHistory.shift();
    const nWon = ceremony.won.length; const nom = ceremony.categories.filter(c => c.nominated).length;
    const txt = nWon ? `¡${co.name} se lleva ${nWon === 1 ? 'un Prisma de Oro' : nWon + ' Prismas de Oro'} en la gala de París ${U.realYear(year)}! Ganamos clientes fieles y expectación para la próxima colección.` : nom ? `Estábamos nominados en ${nom} ${nom === 1 ? 'categoría' : 'categorías'} de los Prismas de Oro ${U.realYear(year)}, pero esta vez los premios se los llevó la competencia.` : `Se celebra la gala de los Prismas de Oro ${U.realYear(year)}. Este año no hemos conseguido ninguna nominación: hacen falta colecciones con nota 6 o más.`;
    if (nom) this.notify(`Prismas de Oro ${U.realYear(year)}`, `Esta noche se celebra en París la gala de los Prismas de Oro ${U.realYear(year)}. Estamos nominados en ${nom} ${nom === 1 ? 'categoría' : 'categorías'}.`, 'decision', { sourceId: 'awards', ceremony, options: ['Ver la gala'] }); else this.notify(`Prismas de Oro ${U.realYear(year)}`, txt);
    if (!nom) this.tutorial('awards');
    Modules.call('onEvent', co, 'awards', { year, won: ceremony.won.slice(), nominated: nom });
    return ceremony;
  },
  randomEvents(w) {
    const co = this.company; if (w % 4 !== 2 || U.rnd() > 0.12) return; const r = U.rnd();
    /* cada evento avisa a los módulos con Modules.call('onEvent', co, id, datos) — ids: press, theft, celebrity, inspection, supplierDelay */
    if (r < 0.25 && co.currentGame) { const h = 8 + Math.floor(12 * U.rnd()); co.currentGame.hypePoints += h; this.notify('Prensa local', `Un periódico local ha publicado un reportaje sobre tu óptica. La colección en desarrollo gana ${h} puntos de expectación.`, 'news'); Modules.call('onEvent', co, 'press', { hype: h }); }
    else if (r < 0.45) { const loss = this.scaledCost(2000 + U.rnd() * 6000 * co.level, co); co.adjustCash(-loss, 'Robo en tienda'); this.notify('Robo', `Han entrado en la tienda de noche y se han llevado monturas del escaparate. Pérdidas: ${U.money(loss)}.`); Modules.call('onEvent', co, 'theft', { loss }); }
    else if (r < 0.65 && co.fans > 0) { const f = Math.floor(co.fans * 0.04 + 200); co.adjustFans(f); this.notify('Cliente famoso', `Una presentadora de televisión ha aparecido en antena con tus gafas. Ganamos ${U.num(f)} clientes fieles.`, 'news'); Modules.call('onEvent', co, 'celebrity', { fans: f }); }
    else if (r < 0.8 && co.level >= 3 && co.hasResearch('Gabinete')) { const fine = this.scaledCost(3000 + U.rnd() * 5000, co); co.adjustCash(-fine, 'Inspección'); this.notify('Inspección de Sanidad', `Inspección rutinaria del gabinete: falta documentación de calibración. Multa de ${U.money(fine)}.`); Modules.call('onEvent', co, 'inspection', { fine }); }
    else if (co.currentGame && this.currentFeature && this.currentFeature.type === 'mission') { this.currentFeature.startTime += 2 * WEEK_MS; this.currentFeature.delayUntil = this.gameTime + 2 * WEEK_MS; this.notify('Proveedor', 'El proveedor de acetato se retrasa dos semanas con la entrega. El desarrollo de la colección se alarga.'); Modules.call('onEvent', co, 'supplierDelay', { weeks: 2 }); }
  },

  /* ---------- game over y nivel de local ---------- */
  checkGameOver() {
    const co = this.company; if (co.cash < 0) this.tutorial('negativeCash'); if (co.cash > -5000) return;
    const lim = co.level === 1 ? 50000 : co.level <= 3 ? 200000 : 2000000; const flag = 'bankruptWarning' + co.level;
    if (!co.flags[flag]) { co.flags[flag] = true; this.notify('Aviso del banco', `Tu cuenta está en números rojos. El banco te permite un descubierto de hasta ${U.shortMoney(lim)}, pero si lo superas tendrás que cerrar la óptica.`); }
    else if (co.cash < -lim) { this.paused = true; this.emit('gameover'); }
    else if (co.cash < -0.7 * lim && !co.flags['bankruptWarn2' + co.level]) { co.flags['bankruptWarn2' + co.level] = true; this.notify('Último aviso del banco', `Estamos a ${U.money(lim + co.cash)} del límite del descubierto. Si lo superamos, el banco cierra la óptica. Los gastos fijos son ${U.money(General.monthlyCosts(co))} al mes.`); }
  },
  checkTriggers() {
    const co = this.company; const idle = this.isIdle(); const now = this.gameTime; const cool = !co.flags.lastMoveQ || co.flags.lastMoveQ <= now - 20 * WEEK_MS;
    const nl = this.nextLevelInfo(); if (idle && nl && nl.ok && cool && !co.flags['askedMove' + nl.level]) { co.flags.lastMoveQ = now; co.flags['askedMove' + nl.level] = true; this.notify(nl.title, nl.text + ` Coste: ${U.money(nl.cost)}. También puedes hacerlo cuando quieras desde el Menú ☰ → Local y mudanza.`, 'decision', { sourceId: 'level' + nl.level, options: [`Mudarse (${U.shortMoney(nl.cost)})`, 'Todavía no'] }); }
    if (!co.flags.mediumContractsEnabled && co.level >= 2) co.flags.mediumContractsEnabled = true; if (!co.flags.largeContractsEnabled && co.level >= 3) co.flags.largeContractsEnabled = true;
    if (!co.flags.publishersEnabled && co.level >= 2 && co.gameLog.length >= 3) { co.flags.publishersEnabled = true; this.notify('Distribuidores', 'Las grandes cadenas y distribuidores empiezan a ofrecernos acuerdos: ellos pagan por adelantado y se quedan con la mayor parte de las ventas. Consulta los encargos.', 'news'); }
  },
  overdraftLimit() { const l = this.company ? this.company.level : 1; return l === 1 ? 50000 : l <= 3 ? 200000 : 2000000; },
  canSpend(c) { return !(c > 0) || this.company.cash - c >= -this.overdraftLimit(); },
  /* requisitos del siguiente local (visible en el menú Local) */
  nextLevelInfo() {
    const co = this.company; const l = co.level + 1; if (l > 4) return null;
    const def = { 2: { cost: 150000, cash: 350000, staff: 1, games: 1, title: '¿Nuevo local?', text: 'Un local comercial en el centro nos permitiría contratar personal, investigar colecciones medianas y abrir tienda de verdad. Ojo: los gastos fijos suben de 6.000 a 32.000 €/mes, así que conviene encadenar colecciones y usar la tienda y el gabinete.' },
      3: { cost: 150000, cash: 400000, staff: 2, games: 4, title: 'Reforma del local', text: 'El equipo propone reformar el local para montar un gabinete optométrico, taller y laboratorio.' },
      4: { cost: 4000000, cash: 5000000, staff: 4, games: 10, title: 'Óptica insignia', text: 'Ha llegado el momento de dar el salto: una óptica insignia con laboratorio propio y espacio para más personal. Los gastos fijos suben a 64.000 €/mes.' } }[l];
    const reasons = []; if (co.cash < def.cash) reasons.push(`caja mínima ${U.money(def.cash)} (tienes ${U.money(co.cash)})`); if (co.staff.length < def.staff) reasons.push(`${def.staff} persona${def.staff > 1 ? 's' : ''} en plantilla`); if (co.gameLog.length < def.games) reasons.push(`${def.games} colecci${def.games === 1 ? 'ón lanzada' : 'ones lanzadas'} (llevas ${co.gameLog.length})`); if (!this.isIdle()) reasons.push('terminar el proyecto en marcha');
    return Object.assign({ level: l, name: C.LEVELS[l].name, ok: reasons.length === 0, reasons }, def);
  },
  /* desgaste por canal: cada lanzamiento suma 1 al canal y se recupera un 15 % cada mes; las ventas se dividen entre (1 + 0,06·desgaste), mínimo ×0,85 */
  wearOf(co, pid) { return (co && co.chanWear && co.chanWear[pid]) || 0; },
  wearFactor(co, pid) { return Math.max(0.85, 1 / (1 + 0.06 * this.wearOf(co, pid))); },
  decayWear(co) { if (!co.chanWear) return; for (const k of Object.keys(co.chanWear)) { co.chanWear[k] *= 0.85; if (co.chanWear[k] < 0.05) delete co.chanWear[k]; } },
  /* consultoría de I+D: convierte dinero en puntos de investigación, cada compra un 35 % más cara (desde la óptica con gabinete) */
  /* los sucesos con coste fijo se encarecen con el tamaño de la óptica (una multa de 3.000 € no se nota en una red de ópticas) */
  costScale(co) { co = co || this.company; if (!co) return 1; const l = co.level; return l <= 2 ? 1 : l === 3 ? 1.5 : Math.min(5, 2.5 * (1 + 0.15 * (co.branches || 0))); },
  /* averías: la mitad de la subida (un técnico urgente para una red de ópticas cuesta más, pero la pieza es la misma) */
  repairCost(base, co) { const v = base * (1 + (this.costScale(co) - 1) * 0.5); return v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 10) * 10; },
  /* cambia los importes «N.NNN €» de un texto por su valor escalado (para avisos con el precio escrito) */
  scaleMoneyText(t, co) { return this.costScale(co) === 1 ? t : String(t).replace(/(\d{1,3}(?:\.\d{3})+|\d+) €/g, (m, n) => U.money(this.scaledCost(+n.replace(/\./g, ''), co))); },
  scaledCost(base, co) { const v = base * this.costScale(co); return v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100; },
  rpCost(co) { return Math.round(60000 * this.costScale(co) * Math.pow(1.15, (co.flags && co.flags.rpBought) || 0) / 1000) * 1000; },
  buyResearchPoints() { const co = this.company; if (!co || co.level < 3) return false; const c = this.rpCost(co); if (!this.canSpend(c)) return false; co.adjustCash(-c, 'Consultoría de I+D'); co.researchPoints += 25; co.flags.rpBought = (co.flags.rpBought || 0) + 1; this.emit('refresh'); return true; },
  /* red de ópticas (sumidero de dinero en la insignia): cada sucursal cuesta más y rinde algo menos que la anterior */
  BRANCH_MAX: 12,
  branchCost(n) { return Math.round(5e6 * Math.pow(1.4, n)); },
  branchIncome(co, i) { return Math.round(Math.min(500000, 150000 + (co.fans || 0) * 0.05) * Math.pow(0.92, i)); },
  branchUpkeep: 60000,
  branchesNet(co) { let n = 0; for (let i = 0; i < (co.branches || 0); i++) n += this.branchIncome(co, i) - this.branchUpkeep; return n; },
  openBranch() { const co = this.company; const n = co.branches || 0; if (co.level < 4 || n >= this.BRANCH_MAX) return false; const c = this.branchCost(n); if (!this.canSpend(c)) return false; co.adjustCash(-c, 'Nueva sucursal'); co.stats.branchSpend = (co.stats.branchSpend || 0) + c; co.branches = n + 1; if (co.branches <= 3) { co.maxStaff++; this.log(`👥 Con la nueva sucursal cabe una persona más en la plantilla (${co.maxStaff}).`); } co.adjustFans(Math.round(co.fans * 0.03) + 2000); this.log(`🏪 Abrimos la sucursal n.º ${co.branches} de ${co.name}.`); this.emit('refresh'); return true; },
  moveToLevel(l) {
    const co = this.company; const cost = l === 4 ? 4e6 : 150000; co.adjustCash(-cost, 'Nuevo local'); co.level = l; co.maxStaff = C.LEVELS[l].maxStaff;
    const txt = { 2: 'Nos hemos mudado al local comercial. Ya podemos contratar hasta 4 empleados (menú Personal) e investigar colecciones medianas.', 3: 'Reforma terminada: ahora tenemos gabinete optométrico (investígalo para empezar a recibir pacientes), sala de formación y un taller mejor equipado. Hay nuevos cursos disponibles.', 4: 'Bienvenidos a la óptica insignia. Hasta 6 empleados, laboratorio de I+D y mucho más espacio.' }[l];
    this.notify(C.LEVELS[l].name, this.withTip(txt, 'level' + l)); this.emit('level'); this.emit('refresh');
  },

  /* ---------- notificaciones ---------- */
  notify(header, text, type, opts) { if (type === 'sales') { this.log(`${header}: ${text}`); return; } this.company.notifications.push(Object.assign({ id: U.guid(), header, text, type: type || 'popup', weeksUntilFired: 0, atWeek: this.company.currentWeek }, opts || {})); },
  log(text) { this.unreadLog.push({ week: Math.floor(this.company.currentWeek), text }); if (this.unreadLog.length > 150) this.unreadLog.shift(); this.emit('log'); },
  showPendingNotifications() {
    const co = this.company; if (!co.notifications.length || this.modalOpen) return;
    const n = co.notifications.shift();
    /* decisiones que el jugador pidió responder siempre igual: se aplican solas y quedan en el registro */
    if (n.type === 'decision' && n.sourceId && n.options && this.canAutoAnswer(n)) { co.flags.seenDecision = co.flags.seenDecision || {}; co.flags.seenDecision[n.sourceId] = (co.flags.seenDecision[n.sourceId] || 0) + 1; const aa = co.flags.autoAnswer && co.flags.autoAnswer[n.sourceId]; if (Number.isInteger(aa) && aa >= 0 && aa < n.options.length) { this.log(`${n.header}: respuesta automática «${n.options[aa]}».`); this.closeNotification(n, aa); if (!this.modalOpen && !co.notifications.length) this.paused = this.userPaused || false; return; } }
    if (n.type !== 'sales' && n.sourceId !== 'sliders') this.shownNotification = n; if (n.type === 'news' || n.type === 'sales') { this.log(`${n.header}: ${n.text}`); if (n.type === 'news') { if (this.shownNotification === n) this.shownNotification = null; this.emit('newsBanner', n); }
      if (n.type === 'sales' && this.shownNotification === n) this.shownNotification = null;
      /* sin ventana abierta y sin más avisos: el juego no puede quedarse en pausa por un aviso que no abre ventana */
      if (!this.modalOpen && !co.notifications.length) this.paused = this.userPaused || false; return; }
    this.modalOpen = true; this.paused = true; this.emit('notification', n);
  },
  /* relevo generacional: el mejor empleado como posible sucesor */
  bestHeirEmployee() { const co = this.company; return co.staff.filter(s => s.id !== 0).sort((a, b) => (b.designFactor + b.technologyFactor + (b.experience || 0) / 5000) - (a.designFactor + a.technologyFactor + (a.experience || 0) / 5000))[0] || null; },
  resolveSuccession(choice) {
    const co = this.company; const boss = co.staff[0]; if (!boss) return;
    if (choice === 2) { co.flags.endReason = 'venta'; co.flags.sold = true; this.emit('gameend'); return; }
    co.flags.generations = (co.flags.generations || 1) + 1;
    const surname = boss.name.split(' ').slice(1).join(' ') || U.pick(DATA.NAMES.last);
    if (choice === 1) { const h = this.bestHeirEmployee();
      if (h) { this.clearResponsibilities(h, true); boss.name = h.name; boss.designFactor = h.designFactor; boss.technologyFactor = h.technologyFactor; boss.speedFactor = h.speedFactor; boss.experience = h.experience; boss.sex = h.sex; boss.look = h.look; boss.skills = Object.assign({}, boss.skills || {}, h.skills || {}); if (h.currentResearch) { if (!boss.currentResearch && boss.state === 'idle') { boss.currentResearch = h.currentResearch; boss.state = h.state; } else { const it = DB.item(h.currentResearch.id); if (it) { co.researchPoints += Research.pointsCost(it); const c = Research.researchCost(it); if (c) co.adjustCash(c, 'Investigación interrumpida (devolución)'); } } } co.staff = co.staff.filter(s => s !== h); this.notify('Nueva dirección', `${h.name} pasa a dirigir ${co.name}. Conoce la casa como nadie: el equipo sigue igual de motivado.`); }
      else { boss.name = U.pick(DATA.NAMES.female) + ' ' + U.pick(DATA.NAMES.last); boss.sex = 'female'; boss.experience = Math.round((boss.experience || 0) * 0.5); this.notify('Nueva dirección', `${boss.name}, gerente de fuera, toma las riendas de ${co.name}.`); }
    } else { const sex = U.rnd() < 0.5 ? 'female' : 'male'; boss.name = U.pick(DATA.NAMES[sex]) + ' ' + surname; boss.sex = sex; boss.experience = Math.round((boss.experience || 0) * 0.6); boss.designFactor = U.clamp(boss.designFactor * (0.85 + 0.3 * U.rnd()), 0.3, 1.5); boss.technologyFactor = U.clamp(boss.technologyFactor * (0.85 + 0.3 * U.rnd()), 0.3, 1.5); co.adjustFans(Math.round(co.fans * 0.03)); this.notify('Nueva generación', `${boss.name} coge el relevo en ${co.name}. Los clientes de toda la vida celebran que la óptica siga en la familia (+3 % de clientes fieles).`); }
    this.emit('refresh');
  },
  /* se puede «responder siempre así» en las decisiones que se repiten (no en mudanzas, relevo, informes ni avisos del equipo) */
  NO_AUTO: ['level2', 'level3', 'level4', 'relevo', 'report', 'reviews', 'sliders', 'booth', 'hire', 'openDept', 'gameend', 'awards', 'tired'],
  canAutoAnswer(n) { return !!(n && n.sourceId && n.options && n.options.length > 1 && !this.NO_AUTO.includes(n.sourceId)); },
  closeNotification(n, choice) {
    this.modalOpen = false; this.shownNotification = null;
    if (n && n.sourceId) {
      if (n.sourceId === 'level2' && choice === 0) this.moveToLevel(2); if (n.sourceId === 'level3' && choice === 0) this.moveToLevel(3); if (n.sourceId === 'level4' && choice === 0) this.moveToLevel(4);
      if (n.sourceId === 'booth') { this.emit('booth'); return; } if (n.sourceId === 'hire') { this.emit('showCandidates'); return; }
      if (n.sourceId === 'sliders') { this.emit('sliders', n.stage); return; }
      if (n.sourceId === 'reviews') { this.emit('reviews', n.game); return; }
      if (n.sourceId === 'gameend') { this.emit('gameend'); return; }
      if (n.sourceId === 'relevo') { this.resolveSuccession(choice); if (choice === 2) return; }
      if (n.sourceId === 'awards') { this.emit('awards', n.ceremony); return; }
      if (n.sourceId === 'report') { if (choice === 0) { const g = this.company.gameLog.find(x => x.id === n.gameId); const rep = g ? this.generateReport(g) : null; if (rep) { this.emit('report', rep); return; } } }
      if (n.sourceId === 'counterfeit') this.resolveCounterfeit(n.gameId, choice);
      if (n.sourceId === 'tired' && choice === 2) { this.company.flags.autoVacation = true; this.log('Vacaciones automáticas activadas: puedes desactivarlas en Personal.'); }
      if (n.sourceId === 'tired' && (choice === 0 || choice === 2)) { const tr = DB.training('vacaciones'); for (const id of n.staffIds || []) { const s = this.company.staff.find(x => x.id === id); if (!s || s.state === 'vacation') continue; if (!tr || !this.startTraining(s, tr)) this.log(`${s.name} no puede irse ahora (${s.state === 'training' ? 'está en formación' : 'está ocupado/a'}); mándalo/a desde su ficha cuando acabe.`); } }
      if (n.sourceId.includes(':')) Modules.call('onDecision', this.company, n.sourceId, choice, n);
    }
    if (!this.company.notifications.length) this.paused = this.userPaused || false;
  },

  /* ---------- investigación ---------- */
  checkForNewResearch() {
    const co = this.company; if (!co.researchEnabled) return; const found = [];
    for (const it of DATA.RESEARCH) { if (it.isTopic) continue; if (co.researchCompleted.includes(it.id) || co.availableResearch.includes(it.id)) continue; if (it.req && !it.req(co)) continue; found.push(it); }
    for (const p of DATA.PARTS) { if (p.start || co.researchCompleted.includes(p.id) || co.availableResearch.includes(p.id)) continue; if (!co.canDevelopEngine()) continue; if (!this.canResearchPart(p)) continue; found.push(p); }
    if (found.length) { for (const f of found) co.availableResearch.push(f.id); if (co.gameLog.length <= 1) this.log('🔬 Nuevas investigaciones disponibles: ' + found.map(f => f.name).join(' · ')); else this.notify('¡Nueva investigación!', 'Nuevas investigaciones disponibles:\n' + found.map(f => '• ' + f.name).join('\n'), 'news'); }
  },
  canResearchPart(p) {
    const co = this.company; const r = p.req || {}; if (r.research === 'NEVER') return false; if (r.research && r.research !== 'CustomEngine' && !co.hasResearch(r.research)) return false;
    if (r.missionLevel && !(Level.getLevel(co.missionXp[r.missionLevel[0]] || 0) > r.missionLevel[1])) return false;
    if (r.featureLevel && !(co.researchCompleted.includes(r.featureLevel[0]) || DB.part(r.featureLevel[0]).start) ) return false;
    if (r.featureLevel && !(Level.getLevel(co.featureXp[r.featureLevel[0]] || 0) > r.featureLevel[1])) return false;
    if (r.date && !co.isLaterOrEqualThan(...r.date.split('/').map(Number))) return false; return true;
  },
  startResearch(itemId, staff, topicId) {
    const co = this.company; const it = DB.item(itemId); if (!it) return false; if (!it.isTopic && (co.researchCompleted.includes(it.id) || co.staff.some(s => s.currentResearch && s.currentResearch.id === itemId))) return false; if (it.isTopic && co.staff.some(s => s.currentResearch && s.currentResearch.topicId === topicId)) return false; if (it.isTopic && topicId && DB.topic(topicId) && (DB.topic(topicId).year || 0) > co.realYear()) return false; /* estilo que aún no existe en esta época */ const pc = Research.pointsCost(it), cost = Research.researchCost(it);
    if (co.researchPoints < pc || co.cash < cost || !staff.isIdle()) return false;
    co.researchPoints -= pc; if (cost) co.adjustCash(-cost, it.name);
    staff.state = 'researching'; staff.currentResearch = { id: it.id, topicId, progress: 0, duration: Research.duration(it) }; this.tutorial(it.big ? 'bigProject' : 'firstResearch', { name: staff.name }); this.emit('refresh'); return true;
  },
  finishResearch(staff, r) {
    const co = this.company; staff.state = 'idle'; staff.currentResearch = null; const it = DB.item(r.id);
    if (it.isTopic) { co.topics.push(r.topicId); this.notify('Investigación', `Ya dominamos el estilo «${DB.topic(r.topicId).name}».`, 'news'); }
    else {
      co.researchCompleted.push(it.id); co.availableResearch = co.availableResearch.filter(x => x !== it.id);
      if (typeof it.onComplete === 'function') { try { it.onComplete(co); } catch (e) { console.error('onComplete', it.id, e); } }
      Modules.call('onResearch', co, it); let extra = ''; if (it.id === 'CustomEngine') extra = ' Ya puedes crear líneas de producción propias (botón ⚙️ Líneas) e investigar tecnologías.'; if (it.id === 'Marketing') extra = ' Durante el desarrollo de una colección podrás contratar campañas.';
      if (it.big) this.notify('Laboratorio I+D', `Proyecto terminado: ${it.name}. ${it.desc || ''}${it.id === 'RnDLab' ? ' En el menú Investigar aparecerán los proyectos del laboratorio a medida que cumplas sus requisitos.' : ''}`);
      else this.notify('Investigación completada', `${it.name} investigado.${extra}`, extra ? 'popup' : 'news');
    }
    this.emit('refresh');
  },

  /* ---------- taller (motor) ---------- */
  startEngine(name, partIds, staffIds) {
    const co = this.company; const parts = partIds.map(DB.part); const cost = parts.reduce((s, p) => s + Research.engineCost(p), 0); if (co.cash < cost) return false;
    co.adjustCash(-cost, 'Nueva línea: ' + name); this.currentEngineDev = { name, parts: partIds, remainingPoints: Math.max(1, parts.reduce((s, p) => s + Research.enginePoints(p), 0)), total: 0 }; this.currentEngineDev.total = this.currentEngineDev.remainingPoints;
    for (const s of co.staff) if (staffIds.includes(s.id) && s.isIdle()) { s.state = 'working'; s.engineProgress = { points: 0, research: 0 }; } this.tutorial('firstEngine'); this.emit('refresh'); return true;
  },
  finishEngine() {
    const co = this.company; const E = this.currentEngineDev; if (!E) return; this.currentEngineDev = null;
    co.engines.push({ id: U.guid(), name: E.name, parts: E.parts, createdWeek: Math.floor(co.currentWeek) }); for (const s of co.staff) if (s.state === 'working') s.state = 'idle';
    this.notify('Taller', `La línea de producción «${E.name}» está lista. Úsala en tu próxima colección.`); this.emit('refresh');
  },

  /* ---------- colecciones: creación y pipeline ---------- */
  createGame(cfg) {
    const co = this.company; const g = newGame(co); Object.assign(g, cfg);
    for (const pid of g.platforms) { const p = DB.platform(pid); if (!co.licencedPlatforms.includes(pid)) { co.adjustCash(-p.licencePrize, 'Licencia ' + p.name); co.licencedPlatforms.push(pid); } co.adjustCash(-p.devCost, 'Costes de canal'); g.costs += p.devCost; }
    for (const fid of g.features) { const c = Research.devCost(DB.part(fid), g) * General.multiPlatformCost(g); co.adjustCash(-c, 'Tecnología'); g.costs += c; }
    const eng = co.engines.find(e => e.id === g.engine); const tls = g.features.map(DB.part).filter(p => p.techLevel).map(p => p.techLevel); const etls = eng.parts.map(DB.part).filter(p => p.techLevel).map(p => p.techLevel); g.techLevel = tls.length ? Math.max(...tls) : (etls.length ? Math.max(...etls) : 0);
    co.flags.nextGameHypeBonus = 0; co.currentGame = g; this.featureQueue = []; this.currentFeature = null;
    /* marca propia (Laboratorio I+D): expectación extra en cada colección */
    if (co.flags.ownLensBrand) g.hypePoints += 15; if (co.flags.ownFrameBrand) g.hypePoints += 30;
    for (const s of co.staff) { s.flags.workload = 0; if (s.isAvailable()) { s.state = 'working'; s.resetLeftOverPoints(); g.flags.staffContribution[s.id] = 1; } }
    /* responsables por defecto: solo los que siguen en el equipo de esta colección */
    for (const k in g.flags.featureResponsibility) { const id = g.flags.featureResponsibility[k]; const s = co.staff.find(x => String(x.id) === String(id)); if (!s || s.state !== 'working') delete g.flags.featureResponsibility[k]; }
    Modules.call('onCreateGame', co, g);
    this.tutorial('firstGame');
    this.startFeature({ id: 'prep', type: 'prep', duration: C.PREP_DURATION * General.sizeDuration(g.size), percentage: 100 / 3 });
    this.emit('refresh');
  },
  startFeature(f) {
    f.startTime = this.gameTime; f.progress = 0; if (!isFinite(f.duration) || f.duration < 100) f.duration = 100; this.currentFeature = f;
    for (const s of this.company.staff) if (s.state === 'working') s.calcFeature(this.company.currentGame, f);
  },
  /* resp (opcional) = { missionId: staffId | '' } responsables de los campos de esta fase (featureResponsibility de GDT) */
  setSliders(stage, vals, feats, resp) {
    const g = this.company.currentGame; const co = this.company; g.sliders[stage - 1] = vals; const sum = vals.reduce((a, b) => a + b, 0) || 1; const ms = DATA.STAGES[stage - 1].missions;
    for (const fid of (feats || [])) { if (g.features.includes(fid)) continue; const part = DB.part(fid); if (!part) continue; const c = Research.devCost(part, g) * General.multiPlatformCost(g); co.adjustCash(-c, 'Tecnología: ' + part.name); g.costs += c; g.features.push(fid); if (part.techLevel) g.techLevel = Math.max(g.techLevel || 0, part.techLevel); }
    g.flags.featureResponsibility = g.flags.featureResponsibility || {}; co.flags.featureResponsibility = co.flags.featureResponsibility || {};
    if (resp && this.isStaffResponsibilityEnabled(g)) {
      g.flags.responsibilityUsed = true;
      ms.forEach((m, i) => {
        const id = resp[m.id]; const ch = (id === undefined || id === null || id === '') ? null : co.staff.find(s => String(s.id) === String(id) && s.state === 'working');
        if (ch) { g.flags.featureResponsibility[m.id] = ch.id; co.flags.featureResponsibility[m.id] = ch.id; ch.flags.workload = (ch.flags.workload || 0) + vals[i] / sum * 100; }
        else { delete g.flags.featureResponsibility[m.id]; delete co.flags.featureResponsibility[m.id]; }
      });
    } else for (const m of ms) delete g.flags.featureResponsibility[m.id];
    this.featureQueue = ms.map((m, i) => ({ id: m.id, type: 'mission', percentage: vals[i] / sum * 100, duration: General.missionDuration(g, m, vals[i] / sum * 100) }));
    g.stage = stage; this.modalOpen = false; this.paused = this.userPaused || false; this.nextFeature();
  },
  /* equipo que trabaja en la colección actual (no asignados a departamentos) */
  collectionTeam() { const co = this.company; if (!co) return []; return co.staff.filter(s => s.state === 'working' && !s.assignment); },
  /* como en GDT: los responsables por campo se asignan cuando hay al menos 2 personas en la colección */
  isStaffResponsibilityEnabled(g) { g = g || (this.company && this.company.currentGame); if (!g) return false; return this.collectionTeam().length >= 2; },
  updateFeatures() {
    const F = this.currentFeature; if (!F) return; const g = this.company.currentGame; if (!g) { this.currentFeature = null; return; }
    F.progress = U.clamp((this.gameTime - F.startTime) / F.duration, 0, 1);
    if (F.progress >= 1) {
      /* como GDT: terminado el tiempo mínimo, el equipo sigue corrigiendo mientras queden defectos y el jugador decide cuándo lanzar
         (botón «Lanzar ya»); sin defectos se lanza sola. Tope de seguridad: 20 veces la duración. */
      if (F.id === 'BugFixing') { const elapsed = (this.gameTime - F.startTime) / F.duration; const bugsLeft = (g.bugs || 0) > 0 || this.points.some(p => p.type === 'b' || p.type === 'br'); if (bugsLeft && !F.releaseNow && elapsed < 20) { if (!F.readyNotified) { F.readyNotified = true; this.emit('bugfixReady', g); } return; } if (this.points.length) return; }
      this.finishCurrentMission();
    }
  },
  finishCurrentMission() {
    const F = this.currentFeature; const g = this.company.currentGame; const co = this.company;
    if (F.type === 'mission') { g.featureLog.push({ id: F.id, missionType: 'mission', duration: F.duration }); const gain = 150 * F.percentage / 33.33 * General.sizePoints(g); co.missionXp[F.id] = (co.missionXp[F.id] || 0) + gain; this.logXp(g, 'missions', F.id, gain); }
    if (F.id === 'BugFixing') { this.currentFeature = null; this.releaseGame(); return; }
    this.currentFeature = null; this.nextFeature();
  },
  nextFeature() {
    const g = this.company.currentGame; if (!g) return;
    if (this.featureQueue.length) { this.startFeature(this.featureQueue.shift()); return; }
    if (g.stage < 3) { if (this.modalOpen) return; /* el vigilante del tick las abrirá al cerrar la ventana actual */ this.modalOpen = true; this.paused = true; this.emit('sliders', g.stage + 1); return; }
    for (const fid of g.features) { const gain = 200 * General.sizePoints(g); this.company.featureXp[fid] = (this.company.featureXp[fid] || 0) + gain; this.logXp(g, 'features', fid, gain); }
    this.tutorial('bugfix');
    this.startFeature({ id: 'BugFixing', type: 'bugfix', duration: C.FINISH_DURATION * General.sizeDuration(g.size) * 1.5, percentage: 100 / 3 });
    if (this.currentFeature && this.currentFeature.id === 'BugFixing') this.currentFeature.bugs0 = Math.max(1, Math.round(g.bugs || 0));
  },
  getGameProgress() { const g = this.company.currentGame; if (!g) return 0; const total = C.BASE_DURATION * 9 * General.sizeDuration(g.size) * General.multiPlatformDuration(g); let done = 0; for (const f of g.featureLog) if (f.missionType === 'mission') done += f.duration; if (this.currentFeature && this.currentFeature.type === 'mission') done += this.currentFeature.duration * this.currentFeature.progress; return Math.min(1, done / total); },
  releaseGame() {
    const co = this.company; const g = co.currentGame; const q0 = co.notifications.length; g.state = 'released'; g.releaseWeek = Math.floor(co.currentWeek) + 1;
    for (const s of co.staff) { if (g.flags.staffContribution[s.id]) s.flags.gamesContributed = (s.flags.gamesContributed || 0) + 1; if (s.state === 'working') s.state = 'idle'; }
    this.updateExpertise(g);
    g.reviews = Reviews.rateGame(co); this.applyXpBonuses(g);
    let pubOk = null; if (this.currentContract && this.currentContract.type === 'gameContract') { pubOk = g.score >= this.currentContract.minScore; if (pubOk) g.flags.royaltyRate = this.currentContract.royaltyRate; }
    Sales.calculateSales(co, g); co.stats.bestScore = Math.max(co.stats.bestScore, g.score); Modules.call('onRelease', co, g);
    if (co.gameLog.length === 0) { co.researchEnabled = true; co.availableResearch.push('NewTopic', 'CustomEngine'); }
    co.gameLog.push(g); if (!co.contractsEnabled && co.gameLog.length >= 3) { co.contractsEnabled = true; this.notify('Encargos', 'Un gestor de encargos nos ha contactado: varias empresas buscan ópticas que fabriquen pedidos a medida. Consulta el menú de encargos.', 'news'); }
    co.currentGame = null; this.featureQueue = [];
    if (pubOk !== null) this.finishPublisherContract(pubOk, g);
    this.notify('Reseñas', `¡Han llegado las primeras reseñas de ${g.title}!`, 'decision', { sourceId: 'reviews', game: g });
    { const i = co.notifications.findIndex(n => n.sourceId === 'reviews' && n.game === g); if (i > q0) co.notifications.splice(q0, 0, co.notifications.splice(i, 1)[0]); } /* el veredicto no se adelanta a la crítica */
    g.flags.cfWeek = Math.floor(co.currentWeek) + 4 + Math.floor(4 * U.rnd()); /* las copias aparecen cuando la colección ya se vende, no el día del lanzamiento */
    if (co.gameLog.length === 1) this.notify('Noticias', `Una pequeña óptica llamada ${co.name} ha presentado su primera colección, «${g.title}». El sector mira con curiosidad.`, 'sales');
    if (co.gameLog.length === 1) this.notify('Investigación', `Ya podemos investigar (botón Investigar). Tenemos ${co.researchPoints} 🔬: un estilo nuevo cuesta 10 y el taller propio 50. Mientras investigas no se avanza en colecciones: hazlo entre una y otra.`);
    this.emit('refresh');
  },
  trashGame() { const co = this.company; co.currentGame = null; this.currentFeature = null; this.featureQueue = []; for (const s of co.staff) if (s.state === 'working') s.state = 'idle'; if (this.currentContract && this.currentContract.type === 'gameContract') this.finishPublisherContract(false); this.emit('refresh'); },
  applyMarketing(mk) {
    const co = this.company; const g = co.currentGame; if (!g || co.cash < mk.cost) return false;
    let d = 1; const n = g.featureLog.filter(f => f.type === 'marketing' && f.id === mk.id).length; if (n === 1) d = 0.7; else if (n >= 2) d = 0.3;
    const prog = Math.abs(this.getGameProgress() - 0.7); d -= prog / 2; d *= mk.marketingFactor / 5;
    let k = 100 * d * W.genre(DB.topic(g.topic).gw, g.genre, g.secondGenre); k = Math.floor(0.9 * k + 0.1 * k * U.rnd()); k = Math.max(0, Math.floor(k * Modules.product('hypeFactor', co, g)));
    g.hypePoints += k; g.costs += mk.cost; co.adjustCash(-mk.cost, mk.name); g.featureLog.push({ id: mk.id, type: 'marketing' }); this.log(`${mk.name}: +${k} de expectación para ${g.title}.`); this.tutorial('hype'); this.emit('refresh'); return true;
  },

  /* ---------- feria ---------- */
  bookBooth(idx) { const co = this.company; const booths = [{ f: 0.3, cost: 80000 }, { f: 0.5, cost: 200000 }, { f: 1.3, cost: 500000 }]; const b = booths[idx]; if (!b || co.cash < b.cost) return false; co.adjustCash(-b.cost, 'Stand IberÓptica'); co.conferenceStandFactor = b.f; return true; },
  runConference() {
    const co = this.company; const year = co.getCurrentDate().year; const total = Math.floor(49876 + 47500 * year); const min = Math.floor(0.005 * total);
    const fansF = U.clamp(co.fans / 5e5, 0, 1); const f = Math.floor(total * fansF * 0.7), r = Math.floor(total * co.conferenceStandFactor * 0.3); let c = min + f + r; c = Math.floor(U.clamp(c, 0, total)); const p = c / total; const rank = Math.floor(Math.abs(200 * p - 199));
    const hype = Math.floor(10 + 20 * U.rnd() + 100 * p); if (co.currentGame) co.currentGame.hypePoints += hype; else co.flags.nextGameHypeBonus += hype;
    let txt = `Este año han visitado nuestro stand ${U.num(c)} personas.`; txt += rank > 100 ? '\nNo hemos entrado entre los 100 mejores stands. ¡Con más clientes fieles lo lograremos!' : (rank <= 1 ? '\n¡Hemos tenido el mejor stand de toda la feria!' : `\nNuestro stand ha quedado en el puesto #${rank}.`); txt += `\nExpectación generada: ${hype}.`;
    co.adjustFans(Math.floor(c * 0.1)); co.conferenceStandFactor = null; this.notify('IberÓptica', txt);
    Modules.call('onEvent', co, 'conference', { visitors: c, rank, hype });
  },

  /* ---------- personal ---------- */
  searchStaff(ratio, test, role) { const co = this.company; const cost = Math.floor(10000 + ratio * 190000); if (!this.canSpend(cost) || this.hireSearch) return false; co.adjustCash(-cost, 'Búsqueda de personal'); const r = DATA.roleById(role || 'disenador'); this.hireSearch = { ratio, test: test && test !== 'auto' ? test : r.focus, role: r.id, startWeek: co.currentWeek, targetWeek: co.currentWeek + 1.5 + 1.5 * ratio }; this.candidates = null; return true; },
  generateApplicants(s) {
    const co = this.company; const c = s.ratio; const l = Math.floor(2 + 3 * U.clamp(c + 0.2, 0, 1)); let n = (co.level === 4 ? 0.8 : 0.4) + Modules.sum('candidateBonus', co); const out = []; const names = co.staff.map(x => x.name); let m = 0; const role = DATA.roleById(s.role || 'disenador');
    for (let i = 0; i < l; i++) {
      let L = c / 3 + (1 - c / 3) * U.rnd(); if (U.rnd() >= 0.95) n += 0.2; const T = 0.2 + n * L; const N = U.clamp(Math.floor(5 * T), 1, 5); let M = 1, Q = 0;
      if (s.test === 'tech') M -= 0.6; if (s.test === 'balanced') { Q = 0.3; M -= 0.3; } if (s.test === 'design') { Q = 0.6; M -= 0.6; }
      let R = 200 * N; M = R * Q + R * M * U.rnd(); R = R - M; const P = U.rnd(), Qr = 0.2 + n * P, O = U.rnd(), Wv = 0.2 + n * O; const good = O > 0.5 && L > 0.5 && P > 0.5;
      if (!good && m < 2 && U.rnd() <= U.clamp(c + 0.1, 0, 0.7)) { i--; m++; continue; } m = 0;
      const sex = U.rnd() < 0.5 ? 'female' : 'male'; let name; do { name = U.pick(DATA.NAMES[sex]) + ' ' + U.pick(DATA.NAMES.last); } while (names.includes(name)); names.push(name);
      let sal = N * C.BASE_SALARY_PER_LEVEL * (role.salaryMult || 1); sal += 0.2 * sal * U.rnd() * U.sign(); sal = 1000 * Math.floor(sal / 1000);
      out.push({ name, qualityFactor: T, technologyFactor: R / 500, designFactor: M / 500, researchFactor: Qr, speedFactor: Wv, salary: sal, sex, look: Math.floor(Math.random() * 6), role: role.id });
    }
    return out;
  },
  hire(ap) {
    const co = this.company; if (co.staff.length >= co.maxStaff) return false; const lvl = 5 * ap.qualityFactor;
    const ch = new Character({ id: U.guid(), name: ap.name, dF: ap.designFactor, tF: ap.technologyFactor, speedF: ap.speedFactor, qualityF: Math.floor(lvl) / 5, experience: Level.xpForLevel(lvl), researchF: ap.researchFactor, salary: ap.salary, efficiency: 0.05, sex: ap.sex, look: ap.look, slot: co.staff.length, role: ap.role || 'disenador', assignment: this.deptReady(DATA.roleById(ap.role || 'disenador').dept) ? DATA.roleById(ap.role || 'disenador').dept : null });
    ch.flags.nextVacation = this.gameTime + 48 * WEEK_MS; ch.flags.workload = 0; ch.flags.responsibilityCount = {}; co.staff.push(ch); this.hireSearch = null; this.candidates = null;
    if (co.currentGame && this.currentFeature && !ch.assignment) { ch.state = 'working'; co.currentGame.flags.staffContribution[ch.id] = 1; ch.calcFeature(co.currentGame, this.currentFeature); }
    this.tutorial('firstHire', { name: ch.name }); if (ch.assignment) this.tutorial('firstDepartment', { name: ch.name, dept: (Modules.get(ch.assignment) || {}).name || ch.assignment });
    this.emit('refresh'); return true;
  },
  fire(ch) { const co = this.company; if (ch.id === 0) return; co.staff = co.staff.filter(s => s !== ch); this.clearResponsibilities(ch, false); this.emit('refresh'); },
  /* quita a `ch` de los responsables por defecto de la empresa (y, si `current`, también de la colección en curso) */
  clearResponsibilities(ch, current) {
    const co = this.company; const wipe = fr => { if (!fr) return; for (const k in fr) if (String(fr[k]) === String(ch.id)) delete fr[k]; };
    wipe(co.flags.featureResponsibility); if (current && co.currentGame) wipe(co.currentGame.flags.featureResponsibility);
  },
  /* asigna un empleado a un departamento (null = colecciones). Si estaba trabajando en la colección, la deja (y deja de ser responsable de sus campos). */
  /* un departamento admite personal si su módulo existe y, si tiene niveles (tier), ya está montado */
  deptReady(dept) { if (!dept || typeof Modules === 'undefined' || !Modules.get(dept)) return false; const st = this.company && this.company.modules && this.company.modules[dept]; return !st || st.tier === undefined || st.tier > 0; },
  assign(ch, dept) {
    const co = this.company; dept = dept || null; if (dept && !this.deptReady(dept)) return false;
    if (ch.state === 'working' && dept) { ch.state = 'idle'; ch.currentFeature = null; ch.resetLeftOverPoints(); }
    if (dept) this.clearResponsibilities(ch, true);
    ch.assignment = dept;
    if (!dept && co.currentGame && this.currentFeature && ch.state === 'idle') { ch.state = 'working'; co.currentGame.flags.staffContribution[ch.id] = 1; ch.calcFeature(co.currentGame, this.currentFeature); }
    if (dept) this.tutorial('firstDepartment', { name: ch.name, dept: (Modules.get(dept) || {}).name || dept });
    Modules.call('onAssign', co, ch, dept); this.emit('refresh'); return true;
  },
  startTraining(ch, tr) {
    const co = this.company; if (tr.isVacation && ch.state === 'working') { ch.state = 'idle'; ch.currentFeature = null; ch.resetLeftOverPoints(); }
    if (!ch.isIdle() || co.cash < tr.cost || co.researchPoints < tr.pointsCost) return false; co.adjustCash(-tr.cost, tr.name); co.researchPoints -= tr.pointsCost;
    if (tr.isVacation) { ch.goOnVacation(); this.emit('refresh'); return true; }
    ch.state = 'training'; ch.currentTraining = { id: tr.id, progress: 0, duration: tr.duration }; this.emit('refresh'); return true;
  },
  finishTraining(ch, t) {
    const tr = DB.training(t.id); ch.state = 'idle'; ch.currentTraining = null; const gains = [];
    const apply = (key, f, label) => { if (!f) return; const cur = ch[key] * 500; const g = Math.floor(tr.basePoints * f * (0.6 + 0.8 * U.rnd())); if (cur + g <= tr.maxP || U.rnd() < 0.1) { ch[key] += g / 500; gains.push(`${label} +${g}`); } };
    apply('technologyFactor', tr.tF, 'T'); apply('designFactor', tr.dF, 'D'); apply('researchFactor', tr.rF, 'I'); apply('speedFactor', tr.sF, 'Vel');
    if (tr.skill) { ch.skills = ch.skills || {}; ch.skills[tr.skill] = true; gains.push('certificación en ' + String(tr.skill).replace(/_/g, ' ')); }
    ch.flags.trainingsDone = ch.flags.trainingsDone || []; ch.flags.trainingsDone.push(tr.id); Modules.call('onTraining', this.company, ch, tr);
    this.notify('Formación', `${ch.name} ha terminado «${tr.name}». ${gains.length ? gains.join(', ') : 'No ha mejorado (ya domina la materia).'}`); this.emit('refresh');
  },

  /* ---------- encargos ---------- */
  getContracts() {
    const co = this.company; if (!co.contractsEnabled) return [];
    if (!this.contracts || this.contracts.expireWeek <= co.currentWeek) {
      const list = []; const mk = (pool, size, n) => { const picked = U.shuffle(pool).slice(0, Math.max(1, Math.floor(1 + U.rnd() * n))); for (const m of picked) { let s = U.rnd(); if (U.rnd() > 0.8) s += U.rnd(); let Cb = size === 'small' ? 11 : size === 'medium' ? 30 : 100; const I0 = co.getCurrentDate().year / 25; Cb = Cb + Cb * I0; const tot = Cb + Cb * s; const per = tot / (m.dF + m.tF); let rd = per * m.dF, rt = per * m.tF; rd += 0.2 * rd * U.rnd() * U.sign(); rt += 0.2 * rt * U.rnd() * U.sign(); const pay = 1000 * Math.floor(tot); let weeks = Math.floor(3 + 7 * U.rnd()); if (size === 'small') weeks = Math.floor(3 + 3 * U.rnd()); const pen = 1000 * Math.floor((0.2 * pay + 0.3 * pay * U.rnd()) / 1000); list.push({ id: U.guid(), type: 'generic', name: m.name, desc: m.desc, requiredD: Math.floor(rd), requiredT: Math.floor(rt), spawnedD: 0, spawnedT: 0, payment: pay, penalty: pen, weeksToFinish: weeks, rF: m.rF, size }); } };
      mk(DATA.CONTRACTS.small, 'small', 4); if (co.flags.mediumContractsEnabled) mk(DATA.CONTRACTS.medium, 'medium', 3); if (co.flags.largeContractsEnabled) mk(DATA.CONTRACTS.large, 'large', 2);
      if (co.flags.publishersEnabled) for (let i = 0; i < 3; i++) list.push(this.generatePublisherContract());
      this.contracts = { list, expireWeek: co.currentWeek + 24 };
    }
    return this.contracts.list;
  },
  generatePublisherContract() {
    const co = this.company; const sizes = co.availableSizes(); const size = U.pick(sizes); const topic = U.rnd() < 0.6 ? U.pick(co.topics) : null; const genre = U.rnd() < 0.6 ? U.pick(co.availableGenres()).id : null;
    const plats = Platforms.onMarket(co.currentWeek).filter(p => !p.isOwn); const plat = U.rnd() < 0.7 && plats.length ? U.pick(plats) : null; const aud = co.canSetTargetAudience() && U.rnd() < 0.5 ? U.pick(DATA.AUDIENCES).id : null;
    const minScore = Math.floor(5 + 4 * U.rnd()); const base = { small: 60000, medium: 200000, large: 500000, aaa: 1500000 }[size]; let pay = minScore / 10 * base; pay = 5000 * Math.max(1, Math.floor(pay / 5000)); const pen = 5000 * Math.floor((1.2 * pay + 1.8 * pay * U.rnd()) / 5000); const royalty = Math.floor(7 + 8 * U.rnd()) / 100;
    const name = (topic ? DB.topic(topic).name : 'Cualquier estilo') + ' / ' + (genre ? DB.genre(genre).name : 'Cualquier tipo');
    return { id: U.guid(), type: 'gameContract', name, publisher: plat ? plat.company : U.pick(['Grupo Mirada', 'VistaCorp', 'Ojo Global', 'Lentia', 'Distribuciones Ribeira']), topic, genre, platform: plat ? plat.id : null, size, audience: aud, minScore, payment: pay, penalty: pen, royaltyRate: royalty };
  },
  startContract(ct) {
    const co = this.company; if (!this.isIdle()) return false;
    const c = Object.assign({}, ct); this.contracts.list = this.contracts.list.filter(x => x.id !== ct.id);
    if (c.type === 'generic') { c.deadlineWeek = co.currentWeek + c.weeksToFinish; c.startWeek = co.currentWeek; this.currentContract = c; for (const s of co.staff) if (s.isAvailable()) { s.state = 'working'; s.contractProgress = { d: 0, t: 0, r: 0 }; } this.tutorial('firstContract'); }
    else { co.adjustCash(c.payment, 'Anticipo del distribuidor'); this.currentContract = c; void 0 /* tutorial firstPublisher: en línea en el asistente */; this.emit('newGameFromContract', c); }
    this.emit('refresh'); return true;
  },
  updateContractProgress() { const c = this.currentContract; if (c.spawnedD >= c.requiredD && c.spawnedT >= c.requiredT && !this.points.length) this.finishContract(true); },
  finishContract(ok) {
    const co = this.company; const c = this.currentContract; this.currentContract = null; for (const s of co.staff) if (s.state === 'working') s.state = 'idle';
    if (ok) { co.adjustCash(c.payment, 'Encargo: ' + c.name); this.notify('Encargo completado', `${c.name}: «${U.pick(['Gracias por encargaros de esto.', 'Buen trabajo.', 'Justo lo que queríamos.', 'Excelente trabajo.'])}» Cobramos ${U.money(c.payment)}.`); }
    else { co.adjustCash(-c.penalty, 'Penalización: ' + c.name); this.notify('Encargo fallido', `No hemos cumplido el plazo de «${c.name}». Penalización: ${U.money(c.penalty)}.`); }
    this.emit('refresh');
  },
  finishPublisherContract(ok, g) {
    const co = this.company; const c = this.currentContract; this.currentContract = null; if (!c) return;
    if (ok) { if (g) g.flags.royaltyRate = c.royaltyRate; this.notify('Distribuidor', `${c.publisher} está satisfecho con la colección (puntuación mínima ${c.minScore}). Cobraremos un ${Math.round(c.royaltyRate * 100)} % de royalties sobre unas ventas mucho mayores.`); }
    else { co.adjustCash(-c.penalty, 'Penalización distribuidor'); this.notify('Distribuidor', `${c.publisher} no está contento: no alcanzamos la puntuación mínima de ${c.minScore}. Pagamos una penalización de ${U.money(c.penalty)}.`); }
  },

  /* =====================================================================
     MECÁNICAS GDT: tutorial, informes de colección, especialistas, rachas, falsificaciones y canales propios
     ===================================================================== */
  /* ---------- tutorial paso a paso (una sola vez por clave; se guarda en co.tutorialShown) ---------- */
  TUTORIAL: {
    firstGame: { header: 'Manos a la obra', text: 'Tu primera colección está en marcha. Durante la preparación verás salir burbujas: las naranjas (D) son puntos de diseño, las azules (T) de técnica, las verdes (I) de investigación y las rojas (✕) defectos que corregiremos al final.\nCuando termine la preparación te pediré repartir el tiempo de cada fase.' },
    firstSliders: { header: 'Reparte el tiempo', text: 'Cada fase tiene tres campos. Sube los que importen para el tipo de gafa (una de Sol vive de Forma, Concepto, Acabados y Escaparate; una Deportiva, de Estructura, Ergonomía, Lentes y Materiales) y no bajes ninguno del 20 %: un campo cuenta como «bien» cuando recibe al menos el 40 % de su fase: pon ese 40 % en el campo clave del tipo. Lo que más pesa en la nota es que el tipo pegue con el estilo. Los informes irán marcando cada campo (☆ importante · = normal · ✕ poco útil · ? sin datos).' },
    responsibility: { header: 'Responsables por campo', text: 'Con más de una persona en el equipo puedes decidir quién lidera cada campo. Elige a quien tenga la habilidad adecuada (Diseño para Forma o Acabados, Técnica para Estructura o Lentes) y vigila su carga de trabajo: por encima del 100 % rinde peor y salen más defectos. Tras 5 colecciones al frente del mismo campo se convierte en especialista.' },
    firstSale: { header: 'Primeras ventas', text: 'Las ventas llegan semana a semana durante unas {weeks} semanas y las verás en el panel de Ventas. Cuanto mejor sea la nota, más clientes fieles tengas y más expectación hayas creado, más se vende. Unas semanas después del lanzamiento te ofreceré su informe: ahí verás qué falló y qué acertaste.' },
    firstResearch: { header: 'Investigando', text: 'Mientras {name} investiga no trabaja en colecciones. Los puntos de investigación (burbujas verdes) se generan trabajando: gástalos en estilos nuevos, en el taller propio y, más adelante, en tecnologías para tus líneas de producción.' },
    negativeCash: { header: 'Números rojos', text: 'Nos hemos quedado sin caja. El banco permite un descubierto (50.000 € en el puesto del mercado), pero no conviene abusar: para remontar, lanza la próxima colección en la Tienda propia (el canal más barato) con un tipo que pegue con el estilo. Los encargos llegan tras unas cuantas colecciones. Recuerda que los gastos fijos se cobran cada mes.' },
    level2: { header: 'Nuevo local', text: 'En el local comercial caben hasta 5 personas. Busca personal en el menú Personal (más presupuesto, mejores candidatos). Cada empleado cobra un salario mensual, se cansa y pide vacaciones una vez al año. Con dos o más personas podrás repartir responsables por campo en cada fase.' },
    level3: { header: 'Óptica con gabinete', text: 'Ya puedes investigar el gabinete optométrico y asignar personal a los departamentos desde la ficha de cada empleado. Quien está en un departamento deja de trabajar en colecciones, así que compensa la plantilla.' },
    level4: { header: 'Óptica insignia', text: 'Con la óptica insignia se abre el Laboratorio I+D en el menú Investigar: proyectos grandes y caros (marca propia de lentes, probador virtual propio, suscripción de gafas) que desbloquean canales de venta propios cuya cuota crece con tus clientes fieles.' },
    firstHire: { header: 'Nueva incorporación', text: '{name} empieza con el rendimiento al mínimo: tardará unas semanas en coger ritmo. Las caras nuevas restan algo a la nota de su primera colección, así que no contrates justo antes de un lanzamiento importante. Desde su ficha puedes formarle o asignarle a un departamento.' },
    firstDepartment: { header: 'Departamentos', text: '{name} ahora trabaja en {dept} y deja las colecciones. Cada departamento tiene su panel en el menú lateral, con compras, investigaciones e indicadores propios. Sus ingresos son un colchón mensual; las colecciones siguen siendo el motor del negocio.' },
    department: { header: 'Panel de departamento', text: 'Aquí verás el estado del departamento, lo que puedes comprar o investigar y quién está asignado. Los botones se activan cuando cumples los requisitos (nivel de local, dinero, investigación o personal).' },
    firstEngine: { header: 'Línea de producción', text: 'Mientras el equipo monta la línea no puede hacer colecciones. Cuando esté lista, elígela al crear una colección: sus tecnologías aparecerán en las fases correspondientes (con coste propio) y suben el nivel técnico.' },
    firstContract: { header: 'Encargos', text: 'Los encargos piden puntos de diseño y técnica antes de una fecha. Dan dinero rápido, pero si no llegas a tiempo pagas la penalización. Son ideales para los huecos entre colecciones.' },
    firstPublisher: { header: 'Acuerdo con distribuidor', text: '{publisher} adelanta dinero y multiplica las ventas, pero se queda con la mayor parte: cobraremos royalties. Si no alcanzamos la nota mínima pagaremos una penalización, así que elige bien estilo, tipo y canal.' },
    firstReport: { header: 'Informe de la colección', text: 'Los informes analizan qué funcionó y qué no: campos a los que dedicar más o menos tiempo, equilibrio diseño/técnica, combinación estilo/tipo, canal y público. Lo aprendido aparece como marcas junto a cada campo en los sliders (☆ importante, = normal, ✕ poco útil, ? desconocido). Puedes releerlos en Historial → Informes.' },
    expert: { header: 'Especialista', text: '{name} se ha convertido en especialista en {field}: cuando lidere ese campo producirá más puntos, y las colecciones insignia necesitan especialistas al frente de sus campos clave.' },
    onFire: { header: '¡En racha!', text: '{name} está en racha: una semana produciendo un 25-50 % más. Se carga con seis semanas seguidas a pleno rendimiento; puede saltar sola o activarla tú desde su ficha. El cansancio la corta.' },
    bugfix: { header: 'Control de calidad', text: 'Última fase: el equipo revisa las monturas y corrige los defectos (✕) que han ido saliendo. Cuantos menos defectos queden al lanzar, mejor nota; la fase termina sola cuando no queda nada por corregir (o al agotar el tiempo máximo) y entonces la colección sale a la venta.' },
    firstReviews: { header: 'Las reseñas', text: 'Cuatro revistas puntúan de 1 a 10. No comparan tu colección con la competencia, sino con tu mejor trabajo anterior y con lo que el mercado espera de ti: para repetir nota alta hay que mejorar cada vez (más puntos, mejor tecnología, equipo más grande). Tras las reseñas empiezan las ventas semanales.' },
    hype: { header: 'Expectación', text: 'La expectación (🔥) son las ganas que tiene el mercado de ver la colección: la generan las campañas, la prensa, las ferias y los premios. Con una buena nota multiplica las ventas de las primeras semanas; con una mala, se vuelve en tu contra. Las campañas rinden más cerca del final del desarrollo y pierden efecto si se repiten.' },
    awards: { header: 'Prismas de Oro', text: 'Cada enero, la feria de París entrega los Prismas de Oro: colección del año, diseño, innovación técnica, revelación (un estilo que nunca habías trabajado) y premio del público. Compites contra otras ópticas con las colecciones lanzadas el año anterior (nota 6 o más). Cada premio da clientes fieles y expectación para la siguiente colección.' },
    counterfeit: { header: 'Falsificaciones', text: 'Cuando una óptica se hace famosa aparecen copias de sus colecciones. Denunciar cuesta dinero pero limita el daño; ignorarlo recorta las ventas de esa colección entre un 5 y un 15 % mientras esté en el mercado.' },
    bigProject: { header: 'Proyecto de I+D', text: 'Los proyectos del laboratorio son largos y caros, pero cambian el negocio: la marca propia de lentes mejora las ventas de graduado, y el probador virtual, la suscripción y las boutiques crean canales propios sin licencia cuya cuota crece con los clientes fieles.' }
  },
  tutorialText(key, vars) { const t = this.TUTORIAL[key]; if (!t) return null; let txt = t.text; if (vars) for (const k in vars) txt = txt.split('{' + k + '}').join(String(vars[k])); return { key, header: t.header, text: txt }; },
  /* muestra el paso `key` como ventana la primera vez; devuelve true si se ha encolado */
  tutorial(key, vars) { const co = this.company; if (!co) return false; co.tutorialShown = co.tutorialShown || []; if (co.flags.tutorialOff || co.tutorialShown.includes(key)) return false; const t = this.tutorialText(key, vars); if (!t) return false; co.tutorialShown.push(key); this.notify(t.header, t.text, 'tutorial'); return true; },
  /* versión para diálogos: devuelve {header,text} la primera vez (y lo marca como visto) para pintarlo dentro del propio diálogo */
  /* añade la explicación del tutorial (si toca) al final del aviso, en vez de abrir otra ventana */
  withTip(text, key, vars) { const t = this.tutorialInline(key, vars); return t ? `${text}

📘 ${t.text}` : text; },
  tutorialInline(key, vars) { const co = this.company; if (!co) return null; co.tutorialShown = co.tutorialShown || []; if (co.flags.tutorialOff || co.tutorialShown.includes(key)) return null; const t = this.tutorialText(key, vars); if (!t) return null; co.tutorialShown.push(key); return t; },

  /* ---------- especialistas: 5 colecciones al frente del mismo campo ---------- */
  updateExpertise(g) {
    const co = this.company; const fr = (g.flags && g.flags.featureResponsibility) || {};
    for (const mid in fr) {
      const ch = co.staff.find(s => String(s.id) === String(fr[mid])); if (!ch || !DB.mission(mid)) continue;
      ch.flags.responsibilityCount = ch.flags.responsibilityCount || {}; const n = (ch.flags.responsibilityCount[mid] || 0) + 1; ch.flags.responsibilityCount[mid] = n;
      if (n >= 5 && !ch.flags.expert) { ch.flags.expert = mid; const m = DB.mission(mid); this.notify('Especialista', this.withTip(`${ch.name} lleva ${n} colecciones al frente de «${m.name}» y se ha convertido en especialista. Al liderar ese campo rendirá más, y las colecciones insignia necesitan especialistas en sus campos clave.`, 'expert', { name: ch.name, field: m.name })); }
    }
  },

  /* ---------- rachas ("on fire"/boost de GDT) ----------
     La racha se carga trabajando a pleno rendimiento (ch.flags.streakWeeks; llena a las BOOST_WEEKS semanas). Cargada, puede saltar sola
     (10 % semanal) o activarla el jugador desde la ficha (G.activateBoost): ×1.25 a ×1.5 según lo que se haya esperado, durante una semana.
     Se guarda en ch.flags (onFire = instante de juego en que caduca, boostFactor, streakWeeks). */
  BOOST_WEEKS: 6,
  boostCharge(ch) { return U.clamp((ch.flags.streakWeeks || 0) / this.BOOST_WEEKS, 0, 1); },
  canBoost(ch) { return !!ch && ch.state === 'working' && !ch.isOnFire() && (ch.flags.streakWeeks || 0) >= this.BOOST_WEEKS; },
  boostFactorFor(ch) { return Math.min(1.5, Math.round((1.25 + 0.05 * Math.max(0, (ch.flags.streakWeeks || 0) - this.BOOST_WEEKS)) * 100) / 100); },
  activateBoost(ch, auto) {
    if (!this.canBoost(ch)) return false; const f = ch.flags; f.boostFactor = this.boostFactorFor(ch); f.onFire = this.gameTime + WEEK_MS; f.streakWeeks = 0; f.boostsUsed = (f.boostsUsed || 0) + 1;
    this.log(`🔥 ${ch.name} ${auto ? 'entra en racha' : 'se lanza'}: ×${f.boostFactor} durante una semana.`); this.emit('onfire', ch); this.tutorial('onFire', { name: ch.name }); this.emit('refresh'); return true;
  },
  checkBoosts(w) {
    const co = this.company;
    for (const ch of co.staff) {
      const f = ch.flags; if (ch.state === 'working' && ch.efficiency >= 0.9) f.streakWeeks = (f.streakWeeks || 0) + 1; else if (ch.state !== 'working') f.streakWeeks = 0; else f.streakWeeks = Math.max(0, (f.streakWeeks || 0) - 1);
      if (f.streakWeeks === this.BOOST_WEEKS && !ch.isOnFire()) this.log(`⚡ ${ch.name} tiene la racha cargada: puedes activarla desde su ficha.`);
      if (this.canBoost(ch) && U.rnd() < 0.10) this.activateBoost(ch, true);
    }
  },
  /* quien se queda libre durante una colección o un encargo genérico se reincorpora (GDT). No toca el desarrollo de líneas (ahí el equipo se elige a mano). */
  rejoinWork(ch) {
    const co = this.company; if (!co || !ch || ch.state !== 'idle' || ch.assignment) return false;
    if (co.currentGame && this.currentFeature && this.currentFeature.progress < 1) { ch.state = 'working'; ch.resetLeftOverPoints(); co.currentGame.flags.staffContribution[ch.id] = 1; ch.calcFeature(co.currentGame, this.currentFeature); return true; }
    if (this.currentContract && this.currentContract.type === 'generic' && !co.currentGame) { ch.state = 'working'; ch.contractProgress = { d: 0, t: 0, r: 0 }; return true; }
    if (this.currentEngineDev && !co.currentGame && !co.staff.some(s => s.state === 'working')) { ch.state = 'working'; ch.engineProgress = { points: 0, research: 0 }; return true; }
    return false;
  },

  /* ---------- experiencia por campo visible (pantalla de experiencia de GDT): g.flags.xpLog = { missions:{id:xp}, features:{id:xp}, bonus:[{id,label,bonus}], bonusFactor } ---------- */
  logXp(g, kind, id, gain) { if (!g || !gain) return; g.flags.xpLog = g.flags.xpLog || { missions: {}, features: {}, bonus: [] }; const L = g.flags.xpLog; L[kind] = L[kind] || {}; L[kind][id] = (L[kind][id] || 0) + gain; },
  /* bonificaciones al cerrar la colección: buena gestión (responsables activos y nadie por encima del 100 % de carga) y combinación estilo/tipo nueva, +30 % cada una */
  applyXpBonuses(g) {
    const co = this.company; const L = g && g.flags && g.flags.xpLog; if (!L) return null; const bonus = [];
    if (g.flags.responsibilityUsed) { const over = co.staff.some(s => g.flags.staffContribution && g.flags.staffContribution[s.id] && General.getEffectiveWorkload(s, g) > 101); if (!over) bonus.push({ id: 'management', label: 'Buena gestión', bonus: 0.3 }); }
    if (!co.gameLog.some(x => x.topic === g.topic && x.genre === g.genre && (x.secondGenre || null) === (g.secondGenre || null))) bonus.push({ id: 'combo', label: 'Combinación nueva', bonus: 0.3 });
    const f = bonus.reduce((s, b) => s + b.bonus, 0); L.bonus = bonus; L.bonusFactor = 1 + f;
    if (f > 0) { for (const id in L.missions) { const extra = L.missions[id] * f; co.missionXp[id] = (co.missionXp[id] || 0) + extra; L.missions[id] += extra; } for (const id in L.features) { const extra = L.features[id] * f; co.featureXp[id] = (co.featureXp[id] || 0) + extra; L.features[id] += extra; } }
    return L;
  },
  /* nivel y progreso de un campo (misión) o tecnología, para la UI */
  fieldLevel(id) { const co = this.company; const xp = (co && (co.missionXp[id] !== undefined ? co.missionXp[id] : co.featureXp[id])) || 0; return { xp, level: Level.getLevel(xp), progress: Level.progress(xp) }; },

  tiredText(ids) { const co = this.company; const names = ids.map(id => (co.staff.find(s => s.id === id) || {}).name).filter(Boolean); const one = names.length === 1; return `${one ? names[0] + ' está agotado/a y necesita' : names.slice(0, -1).join(', ') + ' y ' + names[names.length - 1] + ' están agotados y necesitan'} vacaciones. El rendimiento bajará hasta que ${one ? 'descanse' : 'descansen'}.\nSe pueden ir aunque estén trabajando; también desde Personal → ficha → Vacaciones.`; },
  checkAchievements() {
    const co = this.company; if (!co) return; co.achievements = co.achievements || []; const have = new Set(co.achievements.map(a => a.id)); const fresh = [];
    for (const a of ACHIEVEMENTS) { if (have.has(a.id)) continue; let ok = false; try { ok = !!a.test(co); } catch (e) { ok = false; } if (ok) { co.achievements.push({ id: a.id, week: Math.floor(co.currentWeek) }); fresh.push(a); } }
    if (fresh.length) { this.log('🏆 Logro: ' + fresh.map(a => a.name).join(' · ')); this.emit('achievement', fresh); }
  },
  /* ---------- informe post-lanzamiento (game report de GDT) ---------- */
  canReport(g) { const co = this.company; if (!co || !g || !g.flags || g.flags.reportDone || g.releaseWeek === undefined) return false; return !!g.soldOut || Math.floor(co.currentWeek) >= g.releaseWeek + 3; },
  offerReports(w) {
    const co = this.company;
    for (const g of co.gameLog) { if (!g.flags || g.flags.reportOffered || !this.canReport(g)) continue; g.flags.reportOffered = true; this.notify('Informe de la colección', `Ya tenemos datos suficientes de ${g.title} (nota ${g.score.toFixed(1)}, ${U.num(g.unitsSold || 0)} monturas). ¿Analizamos qué ha funcionado y qué no?`, 'decision', { sourceId: 'report', gameId: g.id, options: ['Ver el informe', 'Más tarde'] }); }
  },
  /* mismos criterios que Reviews.rateGame, recalculados a partir de la colección (sirve para partidas antiguas) */
  analyzeGame(g) {
    const missions = (g.featureLog || []).filter(a => a.missionType === 'mission' && DB.mission(a.id));
    const frac = a => a.duration / General.sizeDuration(g.size) / General.multiPlatformDuration(g) / (3 * C.BASE_DURATION); const wOf = a => W.missionGenre(DB.mission(a.id), g);
    const good = missions.filter(a => wOf(a) >= 0.9 && frac(a) >= 0.4).map(a => a.id), odd = missions.filter(a => wOf(a) < 0.8 && frac(a) >= 0.4).map(a => a.id), forgot = missions.filter(a => wOf(a) >= 0.9 && frac(a) <= 0.2).map(a => a.id);
    const p = g.designPoints || 0, r = g.technologyPoints || 0; let balance = null;
    if (p + r >= 15) { const q = p * W.golden(g.genre, g.secondGenre) - r; const v = r > p ? Math.abs(q / r * 100) : Math.abs(q / p * 100); if (v <= 25) balance = 'ok'; else if (v > 50) balance = q < 0 ? 'moreDesign' : 'moreTech'; }
    const topicW = W.genre(DB.topic(g.topic).gw, g.genre, g.secondGenre); const plats = (g.platforms || []).map(DB.platform).filter(Boolean); const pw = plats.length ? W.platformGenre(plats, g.genre, g.secondGenre) : 1; const aw = W.audience(DB.topic(g.topic).aw, g.targetAudience);
    const bugsA = (g.bugs || 0) > 0 ? 1 - 0.8 * (U.clamp(100 / Math.max(1, p + r) * g.bugs, 0, 100) / 100) : 1;
    return { good, odd, forgot, balance, topicW, pw, aw, bugsA, plats };
  },
  comboAdjective(w) { w = Math.round(10 * w) / 10; return w >= 1 ? 'genial' : w >= 0.9 ? 'buena' : w >= 0.8 ? 'correcta' : w >= 0.7 ? 'floja' : 'terrible'; },
  generateReport(g) {
    const co = this.company; if (!g) return null; co.reports = co.reports || []; if (g.flags.reportDone) return co.reports.find(r => r.gameId === g.id) || null;
    const a = this.analyzeGame(g); const gName = DB.genre(g.genre).name + (g.secondGenre ? '/' + DB.genre(g.secondGenre).name : ''); const tName = DB.topic(g.topic).name; const mName = id => DB.mission(id).name;
    const list = ids => { const n = ids.map(mName); return n.length <= 1 ? n.join('') : n.slice(0, -1).join(', ') + ' y ' + n[n.length - 1]; };
    co.knowledge = co.knowledge || {}; const K = co.knowledge[g.genre] = co.knowledge[g.genre] || {}; const learned = [];
    const learn = mid => { const b = General.weightBucket(W.genre(DB.mission(mid).gw, g.genre)); if (K[mid] !== b) { K[mid] = b; learned.push(mid); } };
    const lines = [];
    for (const id of a.forgot.concat(a.odd, a.good)) learn(id);
    if (a.forgot.length && a.odd.length) lines.push(`En las colecciones ${gName} deberíamos dedicar más tiempo a ${list(a.forgot)} y menos a ${list(a.odd)}.`);
    else if (a.forgot.length) lines.push(`En las colecciones ${gName} deberíamos dedicar más tiempo a ${list(a.forgot)}.`);
    else if (a.odd.length) lines.push(`Tanto tiempo (reparto + tecnologías) en ${list(a.odd)} no luce en una colección ${gName}: mejor repartir ese tiempo en otros campos.`);
    if (a.good.length) lines.push(`${list(a.good)} ${a.good.length > 1 ? 'han sido aciertos' : 'ha sido un acierto'} para una colección ${gName}: conviene repetirlo.`);
    if (a.balance === 'moreDesign') lines.push(`Las ${gName} piden más diseño que técnica: el equilibrio se quedó corto de diseño.`); else if (a.balance === 'moreTech') lines.push(`Las ${gName} piden más técnica que diseño: nos faltó parte técnica.`); else if (a.balance === 'ok') lines.push(`El equilibrio entre diseño y técnica fue el ideal para una colección ${gName}.`);
    co.knowledge._combos = co.knowledge._combos || {}; const ck = g.topic + '|' + g.genre; if (co.knowledge._combos[ck] === undefined) { co.knowledge._combos[ck] = a.topicW; lines.push(`${tName} + ${gName}: una combinación ${this.comboAdjective(a.topicW)}.`); }
    if (a.plats.length && a.pw <= 0.7) lines.push(`Las colecciones ${gName} no tienen mucho público en ${a.plats[0].name}.`); else if (a.plats.length && a.pw > 1) lines.push(`${a.plats[0].name} es un canal estupendo para las colecciones ${gName}.`);
    if (g.targetAudience && a.aw <= 0.7) { const au = DATA.AUDIENCES.find(x => x.id === g.targetAudience); lines.push(`El público «${au ? au.name : g.targetAudience}» no acaba de conectar con el estilo ${tName}.`); }
    if (a.bugsA < 0.9) lines.push('Salió con demasiados defectos: más tiempo de control de calidad al final habría subido la nota.');
    /* como el informe de GDT: caras nuevas y equipo disperso */
    if (g.flags.newStaffIds && g.flags.newStaffIds.length) { const nn = g.flags.newStaffIds.map(id => co.staff.find(s => String(s.id) === String(id))).filter(Boolean).map(s => s.name.split(' ')[0]); if (nn.length) lines.push(`${nn.length === 1 ? nn[0] + ' todavía es nuevo/a en el equipo' : nn.join(', ') + ' todavía son nuevos en el equipo'}: un par de colecciones más y rendirán al máximo.`); }
    if (co.staff.filter(s => !s.assignment).length > 1 && g.flags.teamContribution !== undefined && g.flags.teamContribution <= 0.8) lines.push('Parte del equipo no trabajó en esta colección: conviene centrar a todos en el mismo proyecto.');
    if (lines.length < 4) { const unknown = DATA.MISSIONS.map(m => m.id).filter(id => !K[id]); if (unknown.length) { const id = U.pick(unknown); learn(id); lines.push(`${mName(id)} parece ${K[id] === '+' ? 'muy importante' : K[id] === '-' ? 'poco importante' : 'de importancia media'} en las colecciones ${gName}.`); } }
    { const i = lines.findIndex(l => l.includes('una combinación')); if (a.topicW <= 0.7 && i > 0) lines.unshift(lines.splice(i, 1)[0]); }
    const final = lines.slice(0, 4); if (final.length < 2) final.push(`La nota final fue ${g.score.toFixed(1)} con ${U.num(g.unitsSold || 0)} monturas vendidas: ${g.score >= 7 ? 'un buen trabajo del que aprender' : 'margen de mejora para la siguiente'}.`);
    const rp = Math.floor(10 * General.sizePoints(g)); co.researchPoints += rp;
    const rep = { id: U.guid(), gameId: g.id, title: g.title, genre: g.genre, topic: g.topic, week: Math.floor(co.currentWeek), score: g.score, units: g.unitsSold || 0, revenue: g.revenue || 0, lines: final, learned: learned.map(id => ({ id, name: mName(id), mark: K[id] })), rp };
    g.flags.reportDone = true; co.reports.push(rep); if (co.reports.length > 80) co.reports.shift();
    this.log(`Informe de ${g.title}: ${final[0]}`); this.emit('refresh');
    return rep;
  },
  /* marca de ayuda para el diálogo de sliders: ☆ importante, = media, ✕ poco útil, ? desconocido ("?" añadido si hay tipo combinado) */
  knowledgeMark(co, g, missionId) {
    const K = (co && co.knowledge && co.knowledge[g.genre]) || {}; const b = K[missionId];
    if (!b) return { sym: '?', mark: null, known: false, label: 'Importancia desconocida para este tipo: genera informes de tus colecciones para descubrirla.' };
    const unsure = !!g.secondGenre; const sym = (b === '+' ? '☆' : b === '-' ? '✕' : '=') + (unsure ? '?' : '');
    const label = (b === '+' ? 'Importante para este tipo de gafa.' : b === '-' ? 'Poco útil para este tipo de gafa.' : 'Importancia media para este tipo de gafa.') + (unsure ? ' Tipo combinado: sin confirmar.' : '');
    return { sym, mark: b, known: true, label };
  },

  /* ---------- falsificaciones (piratería de GDT): a partir del año 12 si la óptica es conocida ---------- */
  checkCounterfeit(g) {
    const co = this.company; const year = co.getCurrentDate().year; if (year < 12 || g.flags.royaltyRate || g.flags.counterfeit) return false;
    if (co.fans < 150000 && g.score < 8.5) return false;
    const p = U.clamp(0.15 + co.fans / 2e6 + (g.score >= 8 ? 0.1 : 0), 0, 0.6); if (U.rnd() > p) return false;
    g.flags.counterfeit = { rate: Math.round((0.05 + 0.10 * U.rnd()) * 1000) / 1000, decision: null };
    const ryC = co.realYear(); const where = U.pick(['en los mercadillos de la costa', 'en bazares de medio país'].concat(ryC >= 1998 ? ['en una web con dominio exótico'] : ['en tenderetes de las ferias de verano']).concat(ryC >= 2008 ? ['en redes sociales con fotos robadas de nuestro catálogo'] : []));
    const cfCost = this.scaledCost(20000, co); this.notify('Falsificaciones', this.withTip(`Han aparecido copias de ${g.title} ${where}: mismas formas, materiales de pena. Podemos denunciarlo (abogados y aduanas: ${U.money(this.scaledCost(20000, co))}) para frenar el daño, o mirar para otro lado y asumir que venderemos algo menos.`, 'counterfeit'), 'decision', { sourceId: 'counterfeit', gameId: g.id, options: [`Denunciar (${U.money(cfCost)})`, 'Ignorar'] });
    Modules.call('onEvent', co, 'counterfeit', { gameId: g.id, rate: g.flags.counterfeit.rate }); return true;
  },
  resolveCounterfeit(gameId, choice) {
    const co = this.company; const g = co.gameLog.find(x => x.id === gameId); if (!g || !g.flags.counterfeit || g.flags.counterfeit.decision) return;
    const cf = g.flags.counterfeit; cf.decision = choice === 0 ? 'denounce' : 'ignore'; let rate = cf.rate;
    if (choice === 0) { co.adjustCash(-this.scaledCost(20000, co), 'Denuncia por falsificaciones'); rate = Math.round(rate / 3 * 1000) / 1000; }
    cf.applied = rate; const rem = Math.max(0, (g.totalSalesCash || 0) - (g.currentSalesCash || 0)); g.totalSalesCash -= rem * rate;
    if (choice === 0) { const seized = Math.floor(1000 + 9000 * U.rnd()); this.log(`Aduanas incauta ${U.num(seized)} copias de ${g.title}. Las ventas apenas se resienten (−${Math.round(rate * 100)} %).`); if (U.rnd() < 0.5) co.adjustFans(Math.floor(200 + co.fans * 0.005)); }
    else this.log(`Las copias de ${g.title} campan a sus anchas: ventas −${Math.round(rate * 100)} % mientras esté en el mercado.`);
  },

  /* ---------- Laboratorio I+D: canales propios, marca propia y suscripción ---------- */
  removeOwnPlatforms() { for (let i = DATA.PLATFORMS.length - 1; i >= 0; i--) if (DATA.PLATFORMS[i].isCustom) DATA.PLATFORMS.splice(i, 1); },
  /* añade en caliente un canal propio a DATA.PLATFORMS (isOwn + isCustom: cuota = baseAmount + fansScale·fans/1M, tope maxAmount) y lo recuerda en co.ownPlatforms para recargarlo */
  addOwnPlatform(def, silent) {
    const co = this.company; if (!co || !def || !def.id) return null; const d = U.dateFromWeek(U.absWeek(co.currentWeek));
    const p = Object.assign({ company: co.name, isOwn: true, isCustom: true, licencePrize: 0, devCost: 30000, retire: '260/12/4', baseAmount: 0.8, fansScale: 2, maxAmount: 5, gw: [1, 1, 1, 1, 1, 1], aw: [1, 1, 1] }, def);
    if (!p.published) p.published = `${d.year}/${d.month}/${d.week}`; p.startAmount = p.baseAmount; p.unitsSold = p.maxAmount;
    if (!p.techLevel) { const others = Platforms.onMarket(Math.floor(co.currentWeek)).filter(x => !x.isCustom).map(x => x.techLevel || 1); p.techLevel = others.length ? Math.max(...others) : 1; }
    if (!DATA.PLATFORMS.some(x => x.id === p.id)) DATA.PLATFORMS.push(p);
    if (!co.licencedPlatforms.includes(p.id)) co.licencedPlatforms.push(p.id);
    co.ownPlatforms = co.ownPlatforms || []; if (!co.ownPlatforms.some(x => x.id === p.id)) co.ownPlatforms.push(JSON.parse(JSON.stringify(p)));
    if (!silent) this.notify('Canal propio', `Abrimos nuestro propio canal de venta: ${p.name}. No necesita licencia y su cuota de mercado crecerá con nuestros clientes fieles.`, 'news');
    return p;
  },
  subscriptionIncome() { const co = this.company; if (!co.flags.subscription) return 0; const inc = Math.min(2e6, Math.floor(co.fans * 0.4)); if (inc > 0) { co.adjustCash(inc, 'Suscripción de gafas'); this.log(`Suscripción de gafas: ${U.money(inc)} este mes (${U.num(co.fans)} clientes fieles).`); } return inc; },
  /* multiplicador de unidades del núcleo (marca propia de lentes: +8 % en Graduado, Lectura e Infantil) */
  coreSalesFactor(co, g) { let f = 1; if (co.flags.ownLensBrand && ['graduado', 'lectura', 'infantil'].some(x => x === g.genre || x === g.secondGenre)) f *= 1.08; return f; },

  /* ---------- guardado ---------- */
  save() {
    if (!this.company) return; const data = { v: 2, gameTime: this.gameTime, company: this.company.save(), currentFeature: this.currentFeature, featureQueue: this.featureQueue, currentEngineDev: this.currentEngineDev, currentContract: this.currentContract, contracts: this.contracts, hireSearch: this.hireSearch, candidates: this.candidates, unreadLog: this.unreadLog, savedAt: Date.now() };
    if (this.shownNotification && this.modalOpen) data.company.notifications = [this.shownNotification].concat(this.company.notifications);
    const txt = JSON.stringify(data); try { localStorage.setItem(G.SAVE_KEY, txt); return true; } catch (e) { try { localStorage.removeItem(G.SAVE_KEY + '.bak'); localStorage.setItem(G.SAVE_KEY, txt); return true; } catch (e2) { console.error(e2); this.saveFailed = true; return false; } }
  },
  load() {
    try { const raw = localStorage.getItem(G.SAVE_KEY); if (!raw) return false; const d = JSON.parse(raw); const nco = Company.load(d.company);
      if (!nco || !C.LEVELS[nco.level] || !Array.isArray(nco.staff) || !nco.staff.length || !Array.isArray(nco.gameLog) || !Array.isArray(nco.engines) || !nco.engines.length) throw new Error('partida no válida');
      this.removeOwnPlatforms(); this.company = nco; this.gameTime = Number.isFinite(d.gameTime) ? d.gameTime : 0; this.currentFeature = d.currentFeature; this.featureQueue = d.featureQueue || []; this.currentEngineDev = d.currentEngineDev; this.currentContract = d.currentContract; this.contracts = d.contracts; this.hireSearch = d.hireSearch; this.candidates = d.candidates; this.unreadLog = d.unreadLog || []; this.points = []; this.paused = true; this.modalOpen = false; for (const p of this.company.ownPlatforms) this.addOwnPlatform(p, true); Modules.init(this.company); { const want = C.LEVELS[this.company.level].maxStaff + (this.company.level >= 4 ? Math.min(3, this.company.branches || 0) : 0); if (this.company.maxStaff < want) this.company.maxStaff = want; } this.company.notifications = this.company.notifications.filter(n => n.sourceId !== 'sliders'); if (this.company.currentGame && !this.currentFeature && !this.featureQueue.length && this.company.currentGame.stage < 3) { this.modalOpen = true; this.emit('sliders', this.company.currentGame.stage + 1); } this.emit('newgame'); this.emit('refresh'); if (this.company.flags && this.company.flags.sold) setTimeout(() => this.emit('gameend'), 0); return true; } catch (e) { console.error(e); return false; }
  },
  hasSave() { try { return !!localStorage.getItem(G.SAVE_KEY); } catch (e) { return false; } },
  hasBackup() { try { return !!localStorage.getItem(G.SAVE_KEY + '.bak'); } catch (e) { return false; } },
  /* vuelve a la partida que había antes de pulsar «Nueva partida» (la actual pasa a ser la copia) */
  restoreBackup() { try { const b = localStorage.getItem(G.SAVE_KEY + '.bak'); if (!b) return false; if (this.company) this.save(); const cur = localStorage.getItem(G.SAVE_KEY); localStorage.setItem(G.SAVE_KEY, b); if (cur) localStorage.setItem(G.SAVE_KEY + '.bak', cur); return this.load(); } catch (e) { return false; } },
  /* copia de la partida en un archivo, para pasarla entre dispositivos (PC ↔ iPad) */
  exportSave() { if (this.company) this.save(); try { return localStorage.getItem(G.SAVE_KEY); } catch (e) { return null; } },
  importSave(text) {
    if (typeof text !== 'string' || text.length > 8e6) return 'El archivo no es una partida válida.';
    let d; try { d = JSON.parse(text); } catch (e) { return 'El archivo no es una partida válida.'; }
    if (!d || typeof d !== 'object' || !d.company || typeof d.company !== 'object' || !Array.isArray(d.company.staff) || !Array.isArray(d.company.gameLog) || typeof d.company.name !== 'string') return 'El archivo no es una partida de Óptica Tycoon.';
    let prev = null; try { prev = localStorage.getItem(G.SAVE_KEY); localStorage.setItem(G.SAVE_KEY, text); } catch (e) { return 'El navegador no deja guardar datos (modo privado o sin espacio).'; }
    if (this.load()) { try { if (prev) localStorage.setItem(G.SAVE_KEY + '.bak', prev); } catch (e) { /* sin espacio */ } return null; }
    try { if (prev) localStorage.setItem(G.SAVE_KEY, prev); else localStorage.removeItem(G.SAVE_KEY); } catch (e) { /* nada */ } if (prev && this.company) this.load(); return 'No se pudo cargar esa partida.'; },
  /* borra la partida guardada (y restos de versiones anteriores) */
  deleteSave() { try { for (const k of ['opticaTycoon.save', 'opticaTycoon.v2', 'opticaTycoon.v3', G.SAVE_KEY, G.SAVE_KEY + '.bak']) localStorage.removeItem(k); return true; } catch (e) { return false; } }
};
