/* Óptica Tycoon — módulo «épocas»: demanda por año real (1965-2076), innovaciones del futuro y sus eventos.
   · Pasado: ciclos económicos de España (crisis del petróleo, reconversión, CEE y Expo/JJOO, crisis del 93).
   · Futuro: curvas por tipo (docs/research/RESULTADO_FUTURO_2026_2076.md §1.4): la lectura cae por las gotas y el
     autoenfoque (suelo ×0,6), el infantil sube con el control de miopía y luego baja, el sol sube con el calor, la
     inteligente crece en S. En 1995-2025 todo vale 1 (la partida clásica no cambia).
   · Innovaciones (investigaciones fut_* de data.js y tecnologías fut_* de las líneas): ingresos mensuales, ventas por
     tipo o público, expectación, coste por montura y nota.
   · Eventos del futuro: efectos temporales sobre la demanda (Xacobeo, ola de calor, gotas para la presbicia…), sucesos
     aleatorios (apagón, temporal, ransomware, retirada de lote) y decisiones con sourceId 'epocas:<id>'. */
'use strict';

(function () {
  const ID = 'epocas';
  const CYCLE = [[1965, 1], [1973, 1.02], [1974, 0.93], [1979, 0.92], [1981, 0.95], [1985, 0.98], [1986, 1.05], [1991, 1.06], [1992, 1], [1993, 0.93], [1994, 0.97], [1995, 1]];
  const FUT = {
    sol:         [[2026, 1], [2030, 1.03], [2035, 1.06], [2040, 1.08], [2045, 1.1], [2050, 1.12], [2060, 1.15], [2076, 1.15]],
    graduado:    [[2026, 1], [2035, 1], [2040, 0.97], [2045, 0.95], [2050, 0.92], [2060, 0.88], [2070, 0.85], [2076, 0.85]],
    deportiva:   [[2026, 1], [2040, 1], [2045, 0.98], [2050, 0.96], [2060, 0.95], [2076, 0.95]],
    infantil:    [[2026, 1], [2030, 1.1], [2035, 1.15], [2040, 1.1], [2045, 1], [2050, 0.9], [2060, 0.85], [2070, 0.8], [2076, 0.8]],
    lectura:     [[2026, 1], [2030, 0.97], [2035, 0.88], [2040, 0.8], [2045, 0.72], [2050, 0.68], [2060, 0.62], [2070, 0.6], [2076, 0.6]],
    premium:     [[2026, 1], [2030, 1], [2035, 1.02], [2040, 1.04], [2045, 1.05], [2076, 1.05]],
    inteligente: [[2026, 0.7], [2030, 0.8], [2035, 1], [2040, 1.15], [2045, 1.25], [2050, 1.3], [2060, 1.3], [2076, 1.25]]
  };
  /* innovaciones de departamento: efecto mientras estén investigadas (inc = € al mes por nivel de local) */
  const INNOV = {
    fut_audicion_gafa:     { inc: 1500, fans: 15 },
    fut_miopia_mixta:      { genre: { infantil: 1.08 } },
    fut_teleopt:           { inc: 2500 },
    fut_ia_retina:         { inc: 4000, fans: 40 },
    fut_presbicia_farmaco: { lecturaHalf: true },
    fut_protesis:          { inc: 8000, style: { protesica: 1.15 }, fans: 30 },
    fut_oculomica:         { inc: 10000, fans: 30 },
    fut_biometria_casa:    { inc: 6000 },
    fut_terapia_genica:    { genre: { graduado: 1.03 }, fans: 60 },
    fut_suscripcion_wear:  { incFans: 0.02 },
    fut_seguro:            { all: 1.02 },
    fut_servicio_tecnico:  { inc: 3000, genre: { inteligente: 1.05 } },
    fut_silver:            { audience: { mature: 1.1 } },
    fut_autonoma:          { inc: 4000, all: 1.05 },
    fut_geo:               { hype: 1.1 },
    fut_comunidad:         { all: 1.03 },
    fut_datos_salud:       { hype: 1.05 },
    fut_reacondicionado:   { inc: 1500, cost: -0.05 },
    fut_ensayos_ip:        { genre: { inteligente: 1.05 } },
    fut_qc_ia:             { score: 1.02 },
    fut_insertos_rx:       { genre: { inteligente: 1.05 } }
  };
  /* tecnologías de las líneas de producción con efecto propio cuando la colección las usa */
  const PARTFX = {
    fut_guiaondas:      g => g.genre === 'inteligente' || g.secondGenre === 'inteligente' ? { score: 1.05 } : null,
    fut_rx_guia:        g => g.genre === 'inteligente' ? { score: 1.03 } : null,
    fut_impresion3d:    g => g.size === 'small' || g.size === 'medium' ? { cost: -0.1 } : null,
    fut_micelio:        () => ({ cost: -0.05 }),
    fut_autorreparable: () => ({ cost: -0.03, sales: 1.03 }),
    fut_metalente:      g => g.genre === 'graduado' || g.genre === 'deportiva' ? { score: 1.03 } : null,
    fut_lc_autofoco:    g => g.genre === 'lectura' || g.genre === 'graduado' ? { sales: 1.05 } : null,
    fut_electronica:    g => g.genre === 'inteligente' ? { score: 1.03 } : null
  };
  /* eventos con fecha (año real, mes): efectos temporales {target: genre|'*'|'style:id', m, weeks} */
  const XACOBEO = [2027, 2032, 2038, 2049, 2055, 2060, 2066];
  const FIXED = [
    { y: 2026, m: 10, fx: [['inteligente', 1.05, 26], ['sol', 1.05, 26]] },
    { y: 2027, m: 9, fx: [['inteligente', 1.1, 52]] },
    { y: 2029, m: 4, fx: [['lectura', 0.85, 52]], presb: true },
    { y: 2030, m: 6, fx: [['deportiva', 1.12, 12], ['sol', 1.08, 12]] },
    { y: 2031, m: 3, fx: [['graduado', 1.05, 48 * 9]] },
    { y: 2033, m: 7, fx: [['sol', 1.2, 8]] },
    { y: 2044, m: 6, fx: [['inteligente', 0.85, 26], ['style:neoanalogica', 1.1, 26]] },
    { y: 2050, m: 1, fx: [['graduado', 1.03, 96]] },
    { y: 2058, m: 1, fx: [['style:lentillaint', 1.15, 96]] },
    { y: 2060, m: 1, fx: [['style:neural', 1.2, 96]] },
    { y: 2065, m: 1, fx: [['style:neoanalogica', 1.1, 144], ['style:carey', 1.1, 144], ['style:redondas', 1.1, 144]] }
  ].concat(XACOBEO.map(y => ({ y, m: 6, fx: [['sol', 1.15, 16], ['deportiva', 1.08, 16]], news: y > 2027 ? ['Año Xacobeo ' + y, 'Galicia vuelve a llenarse de peregrinos: buen verano para el sol y la deportiva.'] : null })));
  /* decisiones con fecha */
  const DECIDE = [
    { id: 'piloto_autofoco', y: 2027, m: 7, min: 2, h: 'Óptica piloto del autoenfoque', t: 'El fabricante de las lentes de cristal líquido busca ópticas piloto en Galicia: 40.000 € por el equipo de adaptación y formación.', o: ['Ser óptica piloto (−40.000 €)', 'Esperar a que se abaraten'] },
    { id: 'campana_escolar', y: 2030, m: 10, min: 2, h: 'Uno de cada tres escolares, miope', t: 'Los colegios piden ópticas que hagan cribados de miopía. Una campaña escolar cuesta 60.000 €.', o: ['Hacer la campaña escolar (−60.000 €)', 'No, gracias'] }
  ];
  /* sucesos aleatorios (probabilidad anual, desde el año real indicado) */
  const RANDOM = [
    { id: 'apagon', from: 2026, p: 0.08, min: 1 },
    { id: 'temporal', from: 2030, p: 0.12, min: 2 },
    { id: 'ransomware', from: 2027, p: 0.06, min: 3, need: 'Gabinete' },
    { id: 'brick', from: 2032, p: 0.12, min: 1, need: 'GafaPropia' },
    { id: 'pandemia', from: 2040, to: 2060, p: 0.03, min: 1, once: true },
    { id: 'aranceles', from: 2028, p: 0.05, min: 2 }
  ];

  const interp = (pts, y) => { if (y <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) { if (y <= pts[i][0]) { const [y0, v0] = pts[i - 1], [y1, v1] = pts[i]; return v0 + (v1 - v0) * (y - y0) / (y1 - y0); } } return pts[pts.length - 1][1]; };
  const yearOf = co => co.realYear ? co.realYear() : 1995;
  const S = co => { co.modules[ID] = co.modules[ID] || {}; const s = co.modules[ID]; if (!Array.isArray(s.fx)) s.fx = []; if (!s.done || typeof s.done !== 'object') s.done = {}; return s; };
  const has = (co, id) => co.hasResearch && co.hasResearch(id);
  const notify = (h, t, type, opts) => G.notify(h, t, type, opts);
  const addFx = (co, target, m, weeks) => S(co).fx.push({ t: target, m, until: Math.floor(co.currentWeek) + weeks });
  const fxFor = (co, g) => { let f = 1; const w = co.currentWeek; for (const e of S(co).fx) { if (e.until < w) continue; if (e.t === '*' || e.t === g.genre || (e.t === g.secondGenre && g.secondGenre) || e.t === 'style:' + g.topic) f *= e.m; } return f; };
  const curve = (co, genre, y) => { if (!FUT[genre]) return 1; let v = interp(FUT[genre], y); if (genre === 'lectura' && has(co, 'fut_presbicia_farmaco')) v = 1 - (1 - v) / 2; return v; };
  const partFx = g => { const out = []; for (const id of g.features || []) { const fn = PARTFX[id]; const r = fn && fn(g); if (r) out.push(r); } return out; };

  function salesFactor(co, g) {
    const y = yearOf(co); let f = 1;
    if (y < 1995) f *= interp(CYCLE, y);
    if (y > 2026 && g) { const a = curve(co, g.genre, y); const b = g.secondGenre ? curve(co, g.secondGenre, y) : a; f *= (2 * a + b) / 3; }
    for (const [id, e] of Object.entries(INNOV)) { if (!has(co, id)) continue; if (e.all) f *= e.all; if (e.genre && e.genre[g.genre]) f *= e.genre[g.genre]; if (e.style && e.style[g.topic]) f *= e.style[g.topic]; if (e.audience && e.audience[g.targetAudience]) f *= e.audience[g.targetAudience]; }
    for (const r of partFx(g)) if (r.sales) f *= r.sales;
    /* sin pasaporte digital, los canales grandes castigan desde 2031 */
    if (y >= 2031 && !has(co, 'fut_pasaporte') && !(g.features || []).includes('fut_pasaporte') && (g.platforms || []).some(p => ['megaretail', 'marketplace', 'ecosistema', 'europa'].includes(p))) f *= 0.9;
    return f * fxFor(co, g);
  }
  function unitCost(co, g) { let pct = 0; for (const [id, e] of Object.entries(INNOV)) if (e.cost && has(co, id)) pct += e.cost; for (const r of partFx(g)) if (r.cost) pct += r.cost; if (S(co).tariffUntil > co.currentWeek) pct += 0.08; return pct * (g.unitPrice || 0); }
  function scoreFactor(co, g) { let f = 1; for (const [id, e] of Object.entries(INNOV)) if (e.score && has(co, id)) f *= e.score; for (const r of partFx(g)) if (r.score) f *= r.score; return f; }
  function hypeFactor(co) { let f = 1; for (const [id, e] of Object.entries(INNOV)) if (e.hype && has(co, id)) f *= e.hype; return f; }
  function monthly(co) {
    let inc = 0, fans = 0;
    for (const [id, e] of Object.entries(INNOV)) { if (!has(co, id)) continue; if (e.inc) inc += e.inc * co.level; if (e.incFans) inc += e.incFans * co.fans / 12; if (e.fans) fans += e.fans * co.level; }
    if (inc > 0) co.adjustCash(Math.round(inc), 'Servicios de salud visual e innovación');
    if (fans > 0) co.adjustFans(fans);
  }
  function weekly(co, w, d) {
    const s = S(co); const y = yearOf(co); if (y < 2026) return; s.fx = s.fx.filter(e => e.until >= w);
    if (d.week === 1) {
      for (const e of FIXED) { const k = 'f' + e.y + '_' + e.m; if (e.y === y && e.m === d.month && !s.done[k]) { s.done[k] = true; for (const [t, m, wk] of e.fx) addFx(co, t, e.presb && has(co, 'fut_presbicia_farmaco') ? 1 - (1 - m) / 2 : m, wk); if (e.news) G.log('📰 ' + e.news[0] + ': ' + e.news[1]); } }
      for (const e of DECIDE) { if (e.y === y && e.m === d.month && !s.done[e.id] && co.level >= e.min) { s.done[e.id] = true; notify(e.h, e.t, 'decision', { sourceId: ID + ':' + e.id, options: e.o }); } }
    }
    for (const e of RANDOM) {
      if (y < e.from || (e.to && y > e.to) || co.level < e.min || (e.need && !has(co, e.need)) || (e.once && s.done[e.id])) continue;
      if ((s.cool && s.cool[e.id] || 0) > w) continue;
      if (U.rnd() < e.p / 48) { s.cool = s.cool || {}; s.cool[e.id] = w + 26; s.done[e.id] = true; fire(co, e.id); }
    }
  }
  function fire(co, id) {
    const L = co.level;
    if (id === 'apagon') { addFx(co, '*', 0.7, 2); notify('Apagón general', 'Se va la luz en toda la península durante horas: tiendas a oscuras y ventas paradas un par de semanas.' + (has(co, 'fut_comunidad') ? ' Con el club de clientes en la nube no se ha perdido ningún dato.' : ' Sin copia en la nube se pierden citas y algún cliente fiel.')); if (!has(co, 'fut_comunidad')) co.adjustFans(-Math.round(co.fans * 0.01)); }
    else if (id === 'temporal') { const c = 10000 * L; addFx(co, '*', 0.9, 6); co.adjustCash(-c, 'Temporal: reparaciones'); notify('Temporal atlántico', `El mar pasa por encima del paseo de Riazor y el Orzán: obras, menos visitas durante seis semanas y ${U.money(c)} de reparaciones.`); }
    else if (id === 'ransomware') { const c = 25000 * L; notify('Secuestro de datos en el gabinete', `Un programa malicioso cifra las fichas de los pacientes y piden ${U.money(c)} de rescate.`, 'decision', { sourceId: ID + ':ransomware', options: [`Pagar (−${U.money(c)})`, 'Restaurar copias (dos semanas sin gabinete)'], cost: c }); }
    else if (id === 'brick') { const c = Math.max(50000, Math.round(co.cash * 0.03)); notify('Nuestra gafa se queda en negro', 'Una actualización falla y bloquea miles de gafas de nuestra plataforma.', 'decision', { sourceId: ID + ':brick', options: [`Reponerlas gratis (−${U.money(c)})`, 'Parche y disculpas'], cost: c }); }
    else if (id === 'pandemia') { addFx(co, '*', 0.6, 8); notify('Nueva pandemia respiratoria', 'Confinamientos de nuevo: la tienda pierde el 40 % de las ventas durante dos meses.'); }
    else if (id === 'aranceles') { S(co).tariffUntil = Math.floor(co.currentWeek) + 52; notify('Guerra arancelaria', 'Suben los aranceles a las importaciones de Asia: las monturas cuestan un 8 % más de fabricar durante un año.'); }
  }
  function onRelease(co, g) {
    if ((g.genre === 'inteligente' || g.secondGenre === 'inteligente') && !has(co, 'fut_ensayos_ip') && U.rnd() < 0.12) {
      const c = Math.round((g.revenue || 0) * 0.15 + 20000 * co.level); co.adjustCash(-c, 'Retirada de lote'); co.adjustFans(-Math.round(co.fans * 0.02));
      notify('Retirada de lote', `Varias gafas de ${g.title} se hinchan al cargarse: retiramos el lote (${U.money(c)}) y perdemos algo de confianza. Los ensayos de estanqueidad y batería lo habrían evitado.`);
    }
  }
  function onDecision(co, sourceId, choice, n) {
    if (!sourceId || !sourceId.startsWith(ID + ':')) return; const id = sourceId.split(':')[1];
    if (id === 'piloto_autofoco') { if (choice === 0) { co.adjustCash(-40000, 'Óptica piloto del autoenfoque'); co.adjustFans(Math.round(co.fans * 0.03) + 200); addFx(co, 'lectura', 1.1, 52); addFx(co, 'graduado', 1.05, 52); G.log('Somos óptica piloto del autoenfoque: más clientes présbitas durante un año.'); } }
    else if (id === 'campana_escolar') { if (choice === 0) { co.adjustCash(-60000, 'Campaña escolar de miopía'); co.adjustFans(Math.round(co.fans * 0.02) + 300); addFx(co, 'infantil', 1.1, 96); } else addFx(co, 'infantil', 1.04, 96); }
    else if (id === 'ransomware') { if (choice === 0) co.adjustCash(-(n && n.cost || 25000 * co.level), 'Rescate de datos'); else { addFx(co, 'graduado', 0.9, 2); co.adjustFans(-Math.round(co.fans * 0.01)); } }
    else if (id === 'brick') { if (choice === 0) { co.adjustCash(-(n && n.cost || 50000), 'Reposición de gafas'); co.adjustFans(Math.round(co.fans * 0.02)); } else { co.adjustFans(-Math.round(co.fans * 0.05)); addFx(co, 'inteligente', 0.85, 26); } }
  }
  const MOD = {
    id: ID, name: 'Épocas', icon: '🕰️', order: 98,
    init(co) { S(co); },
    salesFactor, unitCost, scoreFactor, hypeFactor, monthly, weekly, onRelease, onDecision,
    report(co) { const y = yearOf(co); const out = []; if (y < 1995) out.push({ label: 'Ciclo económico', value: '×' + interp(CYCLE, y).toFixed(2) }); else if (y > 2026) for (const id of Object.keys(FUT)) out.push({ label: 'Demanda ' + ((DATA.GENRES.find(x => x.id === id) || {}).name || id), value: '×' + curve(co, id, y).toFixed(2) }); return out; },
    DECISIONS: DECIDE.map(e => ID + ':' + e.id).concat([ID + ':ransomware', ID + ':brick']),
    api: { interp, CYCLE, FUT, INNOV, PARTFX, FIXED, RANDOM, fire, addFx, curve }
  };
  Modules.register(MOD);
})();
