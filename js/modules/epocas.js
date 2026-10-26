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
    inteligente: [[2026, 0.7], [2030, 0.8], [2035, 0.95], [2040, 1.05], [2045, 1.12], [2050, 1.15], [2060, 1.15], [2076, 1.1]]
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
    fut_lentes_impresas: g => g.genre === 'graduado' || g.genre === 'lectura' ? { cost: -0.04 } : null,
    fut_impresion3d:    g => g.size === 'small' || g.size === 'medium' ? { cost: -0.1 } : null,
    fut_micelio:        () => ({ cost: -0.05 }),
    fut_autorreparable: () => ({ cost: -0.03, sales: 1.03 }),
    fut_metalente:      g => g.genre === 'graduado' || g.genre === 'deportiva' ? { score: 1.03 } : null,
    fut_lc_autofoco:    g => g.genre === 'lectura' || g.genre === 'graduado' ? { sales: 1.05 } : null,
    fut_electronica:    g => g.genre === 'inteligente' ? { score: 1.03 } : null
  };
  /* eventos con fecha (año real, mes): efectos temporales {target: genre|'*'|'style:id', m, weeks} */
  const XACOBEO = [1965, 1971, 1976, 1982, 1993, 1999, 2004, 2010, 2021, 2027, 2032, 2038, 2049, 2055, 2060, 2066];
  const FIXED = [
    /* pasado */
    { y: 1976, m: 5, fx: [['*', 0.95, 4]] },
    { y: 1986, m: 1, fx: [['*', 0.95, 12]] },
    { y: 1992, m: 12, fx: [['*', 0.93, 6]] },
    { y: 1993, m: 2, tariff: 52, news: ['Devaluación de la peseta', 'La peseta se devalúa: las monturas importadas cuestan un 8 % más durante un año.'] },
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
  ].concat(XACOBEO.map(y => ({ y, m: 6, fx: [['sol', 1.15, 16], ['deportiva', 1.08, 16]], news: y !== 2027 && y !== 1993 ? ['Año Xacobeo ' + y, 'Galicia vuelve a llenarse de peregrinos: buen verano para el sol y la deportiva.'] : null })));
  /* decisiones con fecha */
  const DECIDE = [
    /* pasado */
    { id: 'petroleo', y: 1973, m: 11, min: 1, h: 'Crisis del petróleo', t: 'El crudo se ha cuadruplicado y los proveedores suben todo. ¿Repercutimos la subida en el precio de las gafas?', o: ['Subir precios (vendemos algo menos medio año)', 'Absorberlo nosotros (pagamos la diferencia)'] },
    { id: 'sinreceta', y: 1978, m: 3, min: 1, h: '¿Graduar sin receta?', t: 'Muchos clientes piden que les graduemos la vista aquí mismo, sin pasar por el oftalmólogo. Es habitual en el gremio, pero el colegio de médicos lo considera intrusismo.', o: ['Graduar en la óptica (más clientes, riesgo de sanción)', 'Seguir con la receta del oftalmólogo'] },
    { id: 'mundial82', cost: 8000, y: 1982, m: 5, min: 1, h: 'Mundial en Riazor', t: 'A Coruña acoge partidos del Mundial: el Ayuntamiento alquila casetas en el paseo marítimo por 8.000 €.', o: ['Montar caseta de gafas de sol (−8.000 €)', 'No merece la pena'] },
    { id: 'carey', y: 1986, m: 6, min: 1, h: 'Prohibido el carey auténtico', t: 'España aplica el convenio que protege a las tortugas marinas: el carey auténtico queda prohibido. Nos quedan monturas en el almacén.', o: ['Retirarlas y anunciarlo (imagen)', 'Venderlas por lo bajo antes de que se note'] },
    { id: 'chips', y: 2044, m: 5, min: 2, h: 'Se avecina una crisis de chips', t: 'Los proveedores avisan: faltan chips y tierras raras y las gafas inteligentes se van a encarecer medio año. ¿Hacemos acopio?', o: ['Acopiar componentes (3 % de la caja)', 'Esperar y ver'] },
    { id: 'reparar', y: 2052, m: 3, min: 2, h: 'Derecho a reparar tus gafas', t: 'La nueva ley europea obliga a tener piezas y software durante diez años. ¿Montamos un servicio de reparación propio?', o: ['Montar el servicio (1 % de la caja)', 'Cumplir lo justo'] },
    { id: 'lentillas', y: 2058, m: 2, min: 2, h: 'La lentilla inteligente se masifica', t: 'Cada vez más clientes cambian la montura por lentillas con pantalla. ¿Formamos al equipo en su adaptación?', o: ['Formar al equipo (2 % de la caja)', 'Seguir con las monturas'] },
    { id: 'fusion', y: 2066, m: 4, min: 3, h: 'Oferta de fusión', t: 'Una cadena europea de salud visual quiere fusionarse con nosotros: inyecta capital, pero impone su catálogo durante años.', o: ['Fusionarnos (+20 % de caja ahora, −10 % de ventas 5 años)', 'Seguir independientes'] },
    { id: 'fundacion', y: 2071, m: 3, min: 3, h: 'Fundación de salud visual', t: 'Con tantos años de historia a nuestras espaldas, el patronato propone crear una fundación que gradúe gratis a quien no puede pagar.', o: ['Crear la fundación (−10 % de la caja)', 'No es el momento'] },
    { id: 'piloto_autofoco', cost: 40000, y: 2027, m: 7, min: 2, h: 'Óptica piloto del autoenfoque', t: 'El fabricante de las lentes de cristal líquido busca ópticas piloto en Galicia: 40.000 € por el equipo de adaptación y formación.', o: ['Ser óptica piloto (−40.000 €)', 'Esperar a que se abaraten'] },
    { id: 'campana_escolar', cost: 60000, y: 2030, m: 10, min: 2, h: 'Uno de cada tres escolares, miope', t: 'Los colegios piden ópticas que hagan cribados de miopía. Una campaña escolar cuesta 60.000 €.', o: ['Hacer la campaña escolar (−60.000 €)', 'No, gracias'] }
  ];
  /* sucesos aleatorios (probabilidad anual, desde el año real indicado) */
  const RANDOM = [
    { id: 'apagon', from: 2026, p: 0.08, min: 1 },
    { id: 'temporal', from: 2030, p: 0.12, min: 2 },
    { id: 'ransomware', from: 2027, p: 0.06, min: 3, need: 'Gabinete' },
    { id: 'brick', from: 2032, p: 0.12, min: 1, need: 'GafaPropia' },
    { id: 'pandemia', from: 2040, to: 2060, p: 0.03, min: 1, once: true },
    { id: 'aranceles', from: 2028, p: 0.05, min: 2 },
    /* sucesos de cualquier época */
    { id: 'boda', from: 1960, p: 0.12, min: 1 },
    { id: 'cierre_vecina', from: 1960, p: 0.06, min: 1 },
    { id: 'ola_calor', from: 1985, p: 0.12, min: 1 },
    { id: 'premio_comercio', from: 1960, p: 0.08, min: 1 },
    { id: 'huelga_transporte', from: 1975, p: 0.06, min: 2 },
    { id: 'creador', from: 2012, p: 0.15, min: 1 }
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

  /* huella de los relevos (G.HEIR_PERKS) */
  const perks = co => (co.flags && co.flags.heirPerks) || [];
  const perkSales = (co, g) => { let f = 1; for (const p of perks(co)) { if (p === 'familia' || p === 'dependiente') f *= 1.04; if ((p === 'optico' || p === 'audioprotesista') && (g.genre === 'graduado' || g.genre === 'lectura')) f *= 1.08; } return f; };
  function salesFactor(co, g) {
    const y = yearOf(co); let f = perkSales(co, g);
    if (y < 1995) f *= interp(CYCLE, y);
    if (y > 2026 && g) { const a = curve(co, g.genre, y); const b = g.secondGenre ? curve(co, g.secondGenre, y) : a; f *= (2 * a + b) / 3; }
    for (const [id, e] of Object.entries(INNOV)) { if (!has(co, id)) continue; if (e.all) f *= e.all; if (e.genre && e.genre[g.genre]) f *= e.genre[g.genre]; if (e.style && e.style[g.topic]) f *= e.style[g.topic]; if (e.audience && e.audience[g.targetAudience]) f *= e.audience[g.targetAudience]; }
    for (const r of partFx(g)) if (r.sales) f *= r.sales;
    /* sin pasaporte digital, los canales grandes castigan desde 2031 */
    if (y >= 2031 && !has(co, 'fut_pasaporte') && !(g.features || []).includes('fut_pasaporte') && (g.platforms || []).some(p => ['megaretail', 'marketplace', 'ecosistema', 'europa'].includes(p))) f *= 0.9;
    return f * fxFor(co, g);
  }
  function unitCost(co, g) { let pct = 0; for (const p of perks(co)) if (p === 'tecnico' || p === 'labtech' || p === 'gerencia') pct -= 0.03; for (const [id, e] of Object.entries(INNOV)) if (e.cost && has(co, id)) pct += e.cost; for (const r of partFx(g)) if (r.cost) pct += r.cost; if (S(co).tariffUntil > co.currentWeek) pct += 0.08; return pct * (g.unitPrice || 0); }
  function scoreFactor(co, g) { let f = 1; for (const p of perks(co)) { if (p === 'disenador') f *= 1.03; if (p === 'tecnico' || p === 'labtech') f *= 1.01; } for (const [id, e] of Object.entries(INNOV)) if (e.score && has(co, id)) f *= e.score; let pm = 1; for (const r of partFx(g)) if (r.score) pm = Math.max(pm, r.score); return f * pm; /* las tecnologías no se acumulan: cuenta la mejor */ }
  function hypeFactor(co) { let f = 1; for (const p of perks(co)) if (p === 'marketing') f *= 1.1; for (const [id, e] of Object.entries(INNOV)) if (e.hype && has(co, id)) f *= e.hype; return f; }
  function monthly(co) {
    let inc = 0, fans = 0;
    for (const [id, e] of Object.entries(INNOV)) { if (!has(co, id)) continue; if (e.inc) inc += e.inc * co.level; if (e.incFans) inc += Math.min(e.incFans * co.fans / 12, 20000 * co.level); if (e.fans) fans += e.fans * co.level; }
    if (inc > 0) co.adjustCash(Math.round(inc), 'Servicios de salud visual e innovación');
    if (fans > 0) co.adjustFans(fans);
  }
  function weekly(co, w, d) {
    const s = S(co); const y = yearOf(co); s.fx = s.fx.filter(e => e.until >= w);
    if (d.week === 1) {
      for (const e of FIXED) { const k = 'f' + e.y + '_' + e.m; if (e.y === y && e.m === d.month && !s.done[k]) { s.done[k] = true; for (const [t, m, wk] of e.fx || []) addFx(co, t, e.presb && has(co, 'fut_presbicia_farmaco') ? 1 - (1 - m) / 2 : m, wk); if (e.tariff) s.tariffUntil = w + e.tariff; if (e.news) G.log('📰 ' + e.news[0] + ': ' + e.news[1]); } }
      for (const e of DECIDE) { if (e.y === y && e.m === d.month && !s.done[e.id] && co.level >= e.min) { s.done[e.id] = true; const c = e.cost ? G.scaledCost(e.cost, co) : 0; const fix = t => e.cost ? t.split(U.money(e.cost)).join(U.money(c)) : t; notify(e.h, fix(e.t), 'decision', { sourceId: ID + ':' + e.id, options: e.o.map(fix), cost: c }); } }
      /* Año Xacobeo: el 25 de julio cae en domingo y A Coruña se llena de peregrinos y turistas */
      if (d.month === 6 && y >= 1965 && new Date(y, 6, 25).getDay() === 0 && !s.done['xacobeo' + y]) { s.done['xacobeo' + y] = true; addFx(co, '*', 1.06, 26); addFx(co, 'sol', 1.08, 20); notify('Año Xacobeo', `${y} es Año Santo: el 25 de julio cae en domingo y Galicia se llena de peregrinos y turistas. Más gente por la calle durante medio año (+6 % de ventas, gafas de sol +8 % extra en verano).`, 'news'); }
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
    else if (id === 'temporal') { const c = Math.max(10000 * L, Math.round(co.cash * 0.01)); addFx(co, '*', 0.9, 6); co.adjustCash(-c, 'Temporal: reparaciones'); notify('Temporal atlántico', `El mar pasa por encima del paseo de Riazor y el Orzán: obras, menos visitas durante seis semanas y ${U.money(c)} de reparaciones.`); }
    else if (id === 'ransomware') { const c = Math.max(25000 * L, Math.round(co.cash * 0.02)); notify('Secuestro de datos en el gabinete', `Un programa malicioso cifra las fichas de los pacientes y piden ${U.money(c)} de rescate.`, 'decision', { sourceId: ID + ':ransomware', options: [`Pagar (−${U.money(c)})`, 'Restaurar copias (dos semanas sin gabinete)'], cost: c }); }
    else if (id === 'brick') { const c = Math.max(50000, Math.round(co.cash * 0.03)); notify('Nuestra gafa se queda en negro', 'Una actualización falla y bloquea miles de gafas de nuestra plataforma.', 'decision', { sourceId: ID + ':brick', options: [`Reponerlas gratis (−${U.money(c)})`, 'Parche y disculpas'], cost: c }); }
    else if (id === 'pandemia') { addFx(co, '*', 0.6, 8); notify('Nueva pandemia respiratoria', 'Confinamientos de nuevo: la tienda pierde el 40 % de las ventas durante dos meses.'); }
    else if (id === 'boda') { const c = G.scaledCost(1500 + 2500 * L, co); notify('Una boda sonada', `Una pareja muy conocida de la ciudad se casa en verano y quiere gafas de sol a juego para todos los invitados. Pagan ${U.money(c)}, pero el equipo dedicará dos semanas a ese pedido.`, 'decision', { sourceId: ID + ':boda', options: [`Aceptar el pedido (+${U.money(c)})`, 'Rechazarlo con educación'], cost: c }); }
    else if (id === 'cierre_vecina') { const c = G.scaledCost(6000 * L, co); notify('Se jubila el óptico de enfrente', `La óptica de toda la vida de la otra acera cierra y su dueño nos ofrece las fichas de sus clientes (con su permiso por escrito) por ${U.money(c)}.`, 'decision', { sourceId: ID + ':cierre_vecina', options: [`Quedarnos con su clientela (−${U.money(c)})`, 'No, gracias'], cost: c }); }
    else if (id === 'ola_calor') { addFx(co, 'sol', 1.2, 4); notify('Ola de calor', 'Una ola de calor tiene a todo el mundo buscando sombra: las gafas de sol se venden un 20 % más durante un mes.', 'news'); }
    else if (id === 'premio_comercio') { const last = co.gameLog[co.gameLog.length - 1]; if (!last || last.score < 7) return; addFx(co, '*', 1.05, 12); co.adjustFans(Math.round(co.fans * 0.02) + 100); notify('Premio al comercio del año', `La Cámara de Comercio premia nuestra óptica por ${last.title}. Salimos en el periódico: +5 % de ventas durante tres meses y nuevos clientes fieles.`, 'news'); }
    else if (id === 'huelga_transporte') { const c = G.scaledCost(3000 * L, co); notify('Huelga de transportistas', `Los camiones están parados y los pedidos de monturas no llegan. Podemos traer la mercancía por mensajería urgente (${U.money(c)}) o aguantar un mes con menos stock.`, 'decision', { sourceId: ID + ':huelga_transporte', options: [`Mensajería urgente (−${U.money(c)})`, 'Aguantar (−15 % de ventas un mes)'], cost: c }); }
    else if (id === 'creador') { const c = G.scaledCost(800, co); notify('Un creador de contenido', `Un creador con muchos seguidores pide gafas gratis a cambio de enseñarlas en sus vídeos (unos ${U.money(c)} en monturas). Puede salir muy bien… o no mencionarnos nunca.`, 'decision', { sourceId: ID + ':creador', options: [`Regalarle las gafas (−${U.money(c)})`, 'No hacemos regalos'], cost: c }); }
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
    if (id === 'petroleo') { if (choice === 0) addFx(co, '*', 0.92, 26); else co.adjustCash(-15000 * co.level, 'Crisis del petróleo: subida absorbida'); }
    else if (id === 'sinreceta') { if (choice === 0) { co.adjustFans(Math.round(co.fans * 0.04) + 150); addFx(co, 'graduado', 1.1, 96); if (U.rnd() < 0.35) { const c = 12000 * co.level; co.adjustCash(-c, 'Sanción por intrusismo'); notify('Sanción por intrusismo', `El colegio de médicos denuncia a la óptica: ${U.money(c)} de multa. Los clientes, en cambio, siguen viniendo.`); } } }
    else if (id === 'mundial82') { if (choice === 0) { co.adjustCash(-(n && n.cost || 8000), 'Caseta del Mundial'); addFx(co, 'sol', 1.2, 8); co.adjustFans(250); } }
    else if (id === 'carey') { if (choice === 0) co.adjustFans(Math.round(co.fans * 0.02) + 100); else { co.adjustCash(4000 * co.level, 'Liquidación de carey'); co.adjustFans(-Math.round(co.fans * 0.015)); } }
    else if (id === 'chips') { if (choice === 0) { co.adjustCash(-Math.round(Math.max(30000, co.cash * 0.03)), 'Acopio de componentes'); addFx(co, 'inteligente', 1 / 0.85, 26); } }
    else if (id === 'reparar') { if (choice === 0) { co.adjustCash(-Math.round(Math.max(20000, co.cash * 0.01)), 'Servicio de reparación'); addFx(co, '*', 1.03, 240); co.adjustFans(Math.round(co.fans * 0.01)); } else addFx(co, '*', 0.98, 96); }
    else if (id === 'lentillas') { if (choice === 0) { co.adjustCash(-Math.round(Math.max(40000, co.cash * 0.02)), 'Formación en lentillas inteligentes'); addFx(co, 'style:lentillaint', 1.25, 144); addFx(co, 'graduado', 1.04, 144); } else addFx(co, 'inteligente', 0.92, 52); }
    else if (id === 'fusion') { if (choice === 0) { const yearSales = co.gameLog.slice(-4).reduce((a, g) => a + (g.revenue || 0), 0); co.adjustCash(Math.round(Math.min(Math.max(0, co.cash) * 0.2, yearSales)), 'Fusión: capital europeo', true); addFx(co, '*', 0.9, 240); } }
    else if (id === 'fundacion') { if (choice === 0) { co.adjustCash(-Math.round(Math.max(100000, co.cash * 0.1)), 'Fundación de salud visual'); co.adjustFans(Math.round(co.fans * 0.05)); addFx(co, '*', 1.08, 240); } }
    else if (id === 'piloto_autofoco') { if (choice === 0) { co.adjustCash(-(n && n.cost || 40000), 'Óptica piloto del autoenfoque'); co.adjustFans(Math.round(co.fans * 0.03) + 200); addFx(co, 'lectura', 1.1, 52); addFx(co, 'graduado', 1.05, 52); G.log('Somos óptica piloto del autoenfoque: más clientes présbitas durante un año.'); } }
    else if (id === 'campana_escolar') { if (choice === 0) { co.adjustCash(-(n && n.cost || 60000), 'Campaña escolar de miopía'); co.adjustFans(Math.round(co.fans * 0.02) + 300); addFx(co, 'infantil', 1.1, 96); } else addFx(co, 'infantil', 1.04, 96); }
    else if (id === 'ransomware') { if (choice === 0) co.adjustCash(-(n && n.cost || 25000 * co.level), 'Rescate de datos'); else { addFx(co, 'graduado', 0.9, 2); co.adjustFans(-Math.round(co.fans * 0.01)); } }
    else if (id === 'boda') { if (choice === 0) { co.adjustCash(n && n.cost || 4000, 'Pedido de una boda'); co.adjustFans(Math.round(co.fans * 0.01) + 80); addFx(co, '*', 0.95, 2); } }
    else if (id === 'cierre_vecina') { if (choice === 0) { co.adjustCash(-(n && n.cost || 6000), 'Fichas de la óptica vecina'); co.adjustFans(Math.round(co.fans * 0.04) + 300); addFx(co, 'graduado', 1.08, 24); } }
    else if (id === 'huelga_transporte') { if (choice === 0) co.adjustCash(-(n && n.cost || 3000), 'Mensajería urgente'); else addFx(co, '*', 0.85, 4); }
    else if (id === 'creador') { if (choice === 0) { co.adjustCash(-(n && n.cost || 800), 'Gafas para un creador'); if (U.rnd() < 0.6) { const f = Math.round(co.fans * 0.03) + 200; co.adjustFans(f); addFx(co, '*', 1.05, 6); notify('Funcionó', `El vídeo con nuestras gafas se hace viral: ${U.num(f)} clientes fieles nuevos y más visitas durante seis semanas.`, 'news'); } else G.log('El creador nunca llegó a enseñar las gafas.'); } }
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
