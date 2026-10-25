/* Óptica Tycoon — Eventos del mundo (id "mundo", order 99, SIN panel de departamento)
   Fuente: docs/research/RESULTADO_HISTORIA_EVENTOS_COMPETENCIA.md §8 (banco EV_01..EV_50) y §9 (ambientación de A Coruña).
   Los EV que ya cubren otros módulos (inspecciones, guerra de precios/2×1, reseña viral, cierre de competidor, obras,
   Black Friday/Navidad, Night Shopping, Plan Mirada Escolar, averías y lotes de lab, falsificaciones, fuga de ópticos, audiología,
   mascarillas, control de miopía, patrocinio de club, huelga de transporte, grupo de compra, inadaptación a progresivos
   (EV_08 → gabinete:progresivos), receta para comprar online (EV_32 → gabinete:showroomer)) NO se repiten aquí.

   Calendario: año 1 del juego = 1995 real → año real = co.getCurrentDate().year + YEAR_ZERO (1994).
     · Eventos con año concreto ('fixed'): se disparan una sola vez en su año real, desde su mes aproximado hasta diciembre.
     · Eventos de cualquier año / estacionales ('random'): probabilidad semanal pequeña con condiciones (nivel de local,
       investigaciones, colecciones…); los anecdóticos pueden repetirse como mucho una vez a los 8 años, los estacionales
       cada 3 años (máx. 4 veces).
   Cadencia: nada antes de la semana 6 (ni antes de lanzar la primera colección si no ha pasado medio año), como mínimo
   MIN_GAP semanas entre dos eventos, máx. 6 por año real (4 aleatorios), nunca con un diálogo abierto o avisos en cola.

   Estado persistente en co.modules.mundo (JSON plano):
     fired     {id: {n, w, y}}   veces disparado, última semana y último año real
     log       [{id, w, y, c}]   historial (c = opción elegida; null mientras la decisión está pendiente), máx. 200
     years     {añoReal: {all, rnd}}  contador de eventos del año (se podan los años viejos)
     lastWeek  semana del último evento
     effects   [{type:'units'|'unitcost', genre?|notGenre?|all?, pct, until, src}]  → salesFactor / unitCost
     streams   [{label, amount, left}]  cobros (+) o pagos (−) mensuales: plazos, ahorros, ingresos de nicho
     flags     memoria entre eventos (iva: 'absorber'|'subir'|'esperar', rgpd, royaltyVertice…)
   Consecuencias: caja (co.adjustCash), clientes fieles (co.adjustFans), expectación de la colección en curso (o
   co.flags.nextGameHypeBonus), notoriedad y estrellas de marketing (co.modules.marketing.brand/.stars), reputación del
   gabinete (co.modules.gabinete.reputation), rendimiento del personal (adjustEfficiency) y efectos propios de ventas/margen.
   Escala económica: K.SCALE por nivel de local (1,5 · 4 · 5 · 10) sobre las cifras del documento. */
'use strict';

(function () {
  const ID = 'mundo';
  const YEAR_ZERO = 1994;
  const K = { START_WEEK: 6, MIN_GAP: 4, MAX_YEAR: 6, MAX_RANDOM_YEAR: 4, LOG_MAX: 200, P_ANEC: 0.012, SCALE: [0, 1.5, 4, 5, 10], ANEC_REPEAT: { gap: 8, max: 2 }, SEASON_REPEAT: { gap: 3, max: 4 } };

  /* ---------- utilidades ---------- */
  const realYearOf = w => U.realYear(U.dateFromWeek(w).year);
  const weekOfReal = (y, m) => U.gameWeek(`${y - YEAR_ZERO}/${m || 1}/1`);
  const week = co => Math.floor(co.currentWeek);
  const scale = co => K.SCALE[co.level] || 1;
  const sc = (co, base) => Math.max(10, Math.round(base * scale(co) / 10) * 10);
  const money = v => U.money(v);
  const pctTxt = p => (p > 0 ? '+' : '−') + Math.round(Math.abs(p) * 100) + ' %';
  const genreIs = (g, id) => !!g && (g.genre === id || g.secondGenre === id);
  const hasGab = co => co.hasResearch('Gabinete') || !!(co.modules && co.modules.gabinete && co.modules.gabinete.tier > 0);
  const hasOptico = co => co.staff.some(x => x.role === 'optico');
  const ctxOf = (co, w) => { const d = U.dateFromWeek(w); return { w, d, y: U.realYear(d.year), L: co.level }; };
  const toast = m => { try { if (typeof UI !== 'undefined' && UI && UI.toast) UI.toast(m); } catch (e) { /* sin DOM */ } };

  /* el registro de módulos pinta un botón por módulo en el menú lateral: este no es un departamento, se oculta */
  try {
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('css-mundo')) {
      const st = document.createElement('style'); st.id = 'css-mundo';
      st.textContent = '#actions .dept[data-dept="mundo"]{display:none!important}';
      document.head.appendChild(st);
    }
  } catch (e) { /* sin DOM */ }

  /* ---------- estado ---------- */
  function defaults() { return { v: 1, fired: {}, log: [], years: {}, lastWeek: -99, effects: [], streams: [], flags: {} }; }
  function init(co) {
    co.modules = co.modules || {};
    let s = co.modules[ID]; if (!s || typeof s !== 'object' || Array.isArray(s)) s = co.modules[ID] = defaults();
    const d = defaults();
    for (const k of ['fired', 'years', 'flags']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = d[k];
    for (const k of ['log', 'effects', 'streams']) if (!Array.isArray(s[k])) s[k] = [];
    s.lastWeek = isFinite(+s.lastWeek) ? +s.lastWeek : -99;
    for (const id in s.fired) { const f = s.fired[id]; if (!f || !BY[id] || !isFinite(+f.n)) delete s.fired[id]; }
    s.log = s.log.filter(x => x && BY[x.id] && isFinite(+x.w)).slice(-K.LOG_MAX);
    s.effects = s.effects.filter(e => e && (e.type === 'units' || e.type === 'unitcost') && isFinite(+e.pct) && isFinite(+e.until));
    s.streams = s.streams.filter(x => x && isFinite(+x.amount) && +x.left > 0);
    s.v = 1; return s;
  }
  const S = co => (co.modules && co.modules[ID]) || init(co);

  /* ---------- consecuencias: cada llamada aplica el efecto y apunta un resumen legible ---------- */
  function collector(co, s, w) {
    const out = [];
    const sign = v => (v > 0 ? '+' : '−');
    return {
      out,
      cash(v, label) { v = Math.round(+v); if (!v || !isFinite(v)) return; co.adjustCash(v, label); out.push(sign(v) + money(Math.abs(v))); },
      fans(base, pct) {
        let n = Math.round((base || 0) * scale(co) + co.fans * (pct || 0)); if (!isFinite(n)) return 0;
        if (n < 0) n = -Math.min(co.fans, -n); if (!n) return 0;
        co.adjustFans(n); out.push(sign(n) + U.num(Math.abs(n)) + ' clientes fieles'); return n;
      },
      hype(h) {
        h = Math.round(+h); if (!h || !isFinite(h)) return; const g = co.currentGame;
        if (g) { g.hypePoints = Math.max(0, (+g.hypePoints || 0) + h); out.push(`${sign(h)}${Math.abs(h)} de expectación para ${g.title}`); }
        else { co.flags.nextGameHypeBonus = Math.max(0, (+co.flags.nextGameHypeBonus || 0) + h); out.push(`${sign(h)}${Math.abs(h)} de expectación para la próxima colección`); }
      },
      brand(v) {
        const m = co.modules.marketing; if (!m || typeof m.brand !== 'number') return;
        const b0 = m.brand; m.brand = U.clamp(m.brand + v, 0, Math.max(m.brand, +m.brandCap || 30));
        const dv = Math.round((m.brand - b0) * 10) / 10; if (dv) out.push(`${sign(dv)}${String(Math.abs(dv)).replace('.', ',')} de notoriedad`);
      },
      stars(v) {
        const m = co.modules.marketing; if (!m || typeof m.stars !== 'number') return;
        const s0 = m.stars; m.stars = U.clamp(m.stars + v, 2.5, 5); const dv = m.stars - s0;
        if (Math.abs(dv) >= 0.01) out.push(`${sign(dv)}${Math.abs(dv).toFixed(2).replace('.', ',')} ★ en reseñas`);
      },
      rep(v) {
        const g = co.modules.gabinete; if (!g || typeof g.reputation !== 'number') return;
        const r0 = g.reputation; g.reputation = U.clamp(g.reputation + v, 0, 100); const dv = Math.round(g.reputation - r0);
        if (dv) out.push(`${sign(dv)}${Math.abs(dv)} de reputación clínica`);
      },
      morale(v, filter) {
        let k = 0; for (const ch of co.staff) { if (filter && !filter(ch)) continue; if (typeof ch.adjustEfficiency === 'function' && ch.state !== 'vacation') { ch.adjustEfficiency(v); k++; } }
        if (k) out.push(v > 0 ? 'el equipo, animado' : 'el equipo, agotado unos días');
      },
      units(sel, pct, weeks, what) {
        weeks = Math.max(1, Math.round(weeks)); s.effects.push(Object.assign({ type: 'units', pct, until: w + weeks, src: what }, sel));
        out.push(`${pctTxt(pct)} de unidades ${what} durante ${weeks} semanas`);
      },
      unitcost(sel, pct, until, what) { s.effects.push(Object.assign({ type: 'unitcost', pct, until, src: what }, sel)); out.push(`−${Math.round(pct * 100)} % de margen en ${what} hasta nuevo aviso`); },
      stream(amount, months, label) { amount = Math.round(+amount); if (!amount || !isFinite(amount) || months <= 0) return; s.streams.push({ label, amount, left: months }); out.push(`${sign(amount)}${money(Math.abs(amount))}/mes durante ${months} meses`); },
      note(t) { out.push(t); }
    };
  }

  /* ---------- catálogo de eventos ----------
     kind 'fixed': year (real), month → ventana desde ese mes hasta diciembre de ese año
     kind 'random': p (prob. semanal), months | win(d), minY/maxY (años reales), minL/maxL, repeat {gap años, max}
     when(co, c, s) condición extra · prep(co, c, s) → datos (importes ya escalados) · text(co, d) · opts[{label(d), cost?(d), costLabel, run(co, X, d, c, s) → narración}] */
  const EVENTS = [
    /* ===== Años concretos ===== */
    { id: 'furgoneta', ev: 'EV_01', kind: 'fixed', year: 1995, month: 3, title: 'La furgoneta blanca', when: co => co.level === 1,
      prep: co => ({ cost: sc(co, 600), rev: sc(co, 1800), fine: sc(co, 1500), box: sc(co, 150) }),
      text: () => 'Un comercial con gabardina aparca una furgoneta blanca junto al puesto y nos ofrece 200 gafas de sol «inspiradas en Italia» a mitad de precio. Al abrir la caja, el olor a disolvente hace llorar los ojos. Del marcado CE, ni rastro.',
      opts: [
        { label: d => `Comprar el lote (${money(d.cost)})`, cost: d => d.cost, costLabel: 'Lote de gafas sin marcado CE', run(co, X, d) { X.cash(d.rev, 'Venta del lote de la furgoneta'); X.brand(-3); X.stars(-0.15); X.fans(-20, -0.01); if (U.rnd() < 0.3) { X.cash(-d.fine, 'Multa de Consumo'); return 'Las gafas vuelan… hasta que un inspector de Consumo se pasea por el mercadillo.'; } return 'Las gafas vuelan, aunque alguna clienta vuelve con dolor de cabeza.'; } },
        { label: () => 'Pedirle el marcado CE', run(co, X) { X.fans(40, 0.005); X.brand(1); return 'El comercial arranca sin despedirse. Los vecinos de puesto lo han visto todo.'; } },
        { label: d => `Solo los estuches (${money(d.box)})`, cost: d => d.box, costLabel: 'Estuches de la furgoneta', run(co, X) { X.hype(5); return 'Los estuches, ya sin olor, lucen de maravilla en el mostrador.'; } }
      ] },
    { id: 'euro', ev: 'EV_05', kind: 'fixed', year: 2002, month: 1, title: 'El redondeo del euro',
      prep: co => ({ round: sc(co, 800), coins: sc(co, 100), up: sc(co, 1500) }),
      text: () => 'Llegan los euros y nuestras gafas de lectura de 1.995 pesetas se quedan en unos rarísimos 11,99 €. En la caja no hay ni un céntimo y la cafetería de enfrente ya ha «redondeado» el café.',
      opts: [
        { label: () => 'Redondear a la baja', run(co, X, d) { X.cash(-d.round, 'Redondeo a la baja'); X.fans(80, 0.01); X.brand(2); return 'Gafas a 10 € justos: el barrio lo comenta y vuelve.'; } },
        { label: d => `Cambio exacto (${money(d.coins)})`, cost: d => d.coins, costLabel: 'Cartuchos de céntimos', run(co, X) { X.note('la clientela, igual'); return 'Cartuchos de céntimos del banco: cuentas claras y cero polémica.'; } },
        { label: () => 'Redondear al alza', run(co, X, d) { X.cash(d.up, 'Redondeo al alza'); X.fans(-45, -0.015); X.stars(-0.1); return 'Subimos a 15 €, como todo el mundo. La caja lo nota… y algunos clientes también.'; } }
      ] },
    { id: 'iva_2015', ev: 'EV_12', kind: 'fixed', year: 2015, month: 2, title: 'Hacienda y las monturas sueltas',
      prep: () => ({ until: weekOfReal(2017, 7) }),
      text: () => 'Hacienda aclara su criterio: desde el 1 de enero, las monturas que se venden sueltas, sin lentes, tributan al 21 % de IVA y no al 10 %. Las gafas graduadas completas y las lentes siguen al 10 %, y las de sol, como siempre, al 21 %. Medio sector seguía facturando las monturas sueltas al tipo reducido.',
      opts: [
        { label: () => 'Aplicar el 21 % y absorberlo', run(co, X, d, c, s) { s.flags.iva = 'absorber'; X.unitcost({ notGenre: 'sol' }, 0.03, d.until, 'monturas graduadas'); return 'Facturamos bien desde ya y nos comemos la diferencia en las monturas sueltas.'; } },
        { label: () => 'Subir el precio de las sueltas', run(co, X, d, c, s) { s.flags.iva = 'subir'; X.units({ notGenre: 'sol' }, -0.04, d.until - c.w, 'de monturas graduadas'); return 'Quien solo cambia de montura paga más y se lo piensa dos veces.'; } },
        { label: () => 'Esperar a que se aclare', run(co, X, d, c, s) { s.flags.iva = 'esperar'; X.note('seguimos al 10 % y cruzamos los dedos'); return 'Seguimos facturando las sueltas al 10 % «hasta que se aclare». La asesoría pone cara rara.'; } }
      ] },
    { id: 'iva_2016', ev: 'EV_13', kind: 'fixed', year: 2016, month: 4, title: 'Requerimiento de Hacienda',
      prep: (co, c, s) => { const wait = s.flags.iva === 'esperar' || !s.flags.iva; const amount = sc(co, wait ? 3400 : 900); return { wait, amount, legal: sc(co, 900), plazo: Math.round(amount * 1.07 / 12) }; },
      text: (co, d) => d.wait
        ? `Carta certificada de la Agencia Tributaria: regularización del IVA de las monturas sueltas que vendimos en 2015 al 10 %. Reclaman ${money(d.amount)} entre cuota, recargo e intereses. Las inspecciones están llegando a proveedores y ópticas de todo el país.`
        : `Carta certificada de la Agencia Tributaria: aunque aplicamos el 21 % a las monturas sueltas, reclaman las ventas de las primeras semanas de 2015 a tipo reducido: ${money(d.amount)}. Las inspecciones están llegando a proveedores y ópticas de todo el país.`,
      opts: [
        { label: d => `Pagar (${money(d.amount)})`, cost: d => d.amount, costLabel: 'Regularización IVA de monturas', run() { return 'Pagamos y archivamos la carta en la carpeta de «nunca más».'; } },
        { label: d => `Recurrir con la asociación (${money(d.legal)})`, cost: d => d.legal, costLabel: 'Recurso económico-administrativo', run(co, X, d) { if (U.rnd() < 0.4) return 'La asociación de ópticos gana el primer asalto: anulan nuestra liquidación.'; X.cash(-d.amount, 'Regularización IVA de monturas'); return 'El recurso no prospera y toca pagar igualmente.'; } },
        { label: () => 'Aplazar en 12 plazos', run(co, X, d) { X.stream(-d.plazo, 12, 'Aplazamiento IVA de monturas'); return 'Doce cómodos plazos… con intereses.'; } }
      ] },
    { id: 'iva_2017', ev: 'EV_14', kind: 'fixed', year: 2017, month: 7, title: 'Las monturas vuelven al 10 %',
      prep: co => ({ camp: sc(co, 800), gain: sc(co, 1200) }),
      text: () => 'Los nuevos Presupuestos Generales devuelven las monturas sueltas al IVA del 10 %, como las gafas graduadas. Los clientes que lo han leído en el periódico preguntan si se va a notar en la etiqueta.',
      opts: [
        { label: d => `Bajar precios y anunciarlo (${money(d.camp)})`, cost: d => d.camp, costLabel: 'Campaña «IVA sanitario»', run(co, X) { X.units({ notGenre: 'sol' }, 0.06, 16, 'de monturas graduadas'); X.fans(60, 0.005); X.brand(2); return '«Recuperamos el IVA sanitario»: carteles nuevos y escaparate lleno.'; } },
        { label: () => 'Mantener el precio', run(co, X, d) { X.cash(d.gain, 'Margen recuperado (IVA de monturas)'); X.fans(-10, -0.003); return 'Mismo precio en la etiqueta y algo más de margen en caja. Alguno se ha dado cuenta.'; } }
      ] },
    { id: 'rgpd', ev: 'EV_38', kind: 'fixed', year: 2018, month: 5, title: 'Llega el RGPD',
      prep: co => ({ soft: sc(co, 2400), arm: sc(co, 200) }),
      text: () => 'Entra en vigor el Reglamento General de Protección de Datos. Nuestras fichas de clientes en cartulina, escritas a boli desde los noventa, y el ordenador viejo de la trastienda son una bomba legal.',
      opts: [
        { label: d => `Software en la nube (${money(d.soft)})`, cost: d => d.soft, costLabel: 'Software de gestión óptica', run(co, X, d, c, s) { s.flags.rgpd = true; X.morale(0.05); X.stars(0.02); return 'Fichas cifradas, firma en tableta y copias automáticas: atendemos más rápido.'; } },
        { label: d => `Archivador con llave (${money(d.arm)})`, cost: d => d.arm, costLabel: 'Archivador con llave', run(co, X) { X.morale(-0.05); return 'Un armario metálico con llave y muchos dedos cruzados. Encontrar una ficha sigue costando lo suyo.'; } },
        { label: () => 'Ya veremos', run(co, X, d, c, s) { s.flags.rgpdRisk = true; X.morale(-0.03); X.stars(-0.03); return 'Las cartulinas se quedan donde estaban. La asesoría ya no nos coge el teléfono.'; } }
      ] },
    { id: 'acetato', ev: 'EV_27', kind: 'fixed', year: 2022, month: 3, title: 'Retraso del acetato italiano',
      prep: co => ({ rec: sc(co, 1100), urg: sc(co, 3800), title: co.currentGame ? co.currentGame.title : null }),
      text: (co, d) => `La fábrica italiana de acetato avisa: los carey habana y los verde botella llegan con diez semanas de retraso por la crisis energética. ${d.title ? `«${d.title}» los necesitaba.` : 'La próxima colección los necesitaba.'}`,
      opts: [
        { label: d => `Acetato reciclado (${money(d.rec)})`, cost: d => d.rec, costLabel: 'Rediseño con acetato reciclado', run(co, X) { X.hype(5); X.units({ all: true }, 0.03, 16, 'de todas las colecciones'); return 'Rediseñamos con acetato reciclado de un proveedor nacional: el guiño ecológico gusta.'; } },
        { label: d => `Envío urgente (${money(d.urg)})`, cost: d => d.urg, costLabel: 'Recargo de envío urgente', run(co, X) { X.note('diseño original intacto'); return 'Pagamos el recargo y el carey llega a tiempo.'; } },
        { label: () => 'Esperar al acetato', run(co, X) { X.hype(-10); X.units({ all: true }, -0.10, 12, 'de todas las colecciones'); return 'Esperamos al acetato bueno y la temporada se nos echa encima.'; } }
      ] },
    { id: 'luz', ev: 'EV_42', kind: 'fixed', year: 2022, month: 9, title: 'El recibo de la luz', when: co => co.level >= 2,
      prep: co => ({ bill: sc(co, 300), led: sc(co, 1600), save: sc(co, 140), half: sc(co, 60) }),
      text: (co, d) => `El recibo de la luz de la óptica se ha duplicado este mes (${money(d.bill)} de más): los focos halógenos que hacen brillar las monturas están devorando el margen.`,
      opts: [
        { label: d => `Pasarse a LED (${money(d.led)})`, cost: d => d.led, costLabel: 'Iluminación LED', run(co, X, d) { X.cash(-d.bill, 'Factura de la luz'); X.stream(d.save, 36, 'Ahorro con LED'); X.units({ all: true }, 0.03, 24, 'de todas las colecciones'); return 'LED de alta reproducción cromática y temporizadores: factura a la baja y monturas que lucen mejor.'; } },
        { label: () => 'Apagar medio escaparate', run(co, X, d) { X.cash(-d.bill, 'Factura de la luz'); X.stream(d.half, 12, 'Ahorro apagando focos'); X.units({ all: true }, -0.04, 24, 'de todas las colecciones'); return 'Medio escaparate a oscuras desde las nueve. Ahorramos, pero se nota desde la acera.'; } }
      ] },
    { id: 'aniversario', ev: 'EV_50', kind: 'fixed', year: 2026, month: 10, title: 'Gala de aniversario',
      prep: co => ({ expo: sc(co, 5000), ed: sc(co, 25000) }),
      text: () => 'La Cámara de Comercio y el Colexio Oficial de Ópticos-Optometristas de Galicia nos rinden homenaje por más de tres décadas de oficio. En una vitrina brilla la primera gafa que vendimos en el mercadillo, allá por 1995.',
      opts: [
        { label: d => `Exposición y dos becas (${money(d.expo)})`, cost: d => d.expo, costLabel: 'Exposición del aniversario', run(co, X) { X.brand(5); X.rep(5); X.fans(300, 0.02); return 'Retrospectiva abierta a toda la ciudad y dos becas para estudiantes de Óptica en Santiago.'; } },
        { label: () => 'Edición limitada «1995-2026»', run(co, X, d) { X.cash(d.ed, 'Edición limitada del aniversario'); X.hype(20); return 'Titanio y acetato numerados: se agotan antes de que acabe la gala.'; } }
      ] },

    /* ===== Estacionales y ambientación (A Coruña / Betanzos) ===== */
    { id: 'tormenta', ev: 'EV_02', kind: 'random', title: 'Temporal en la feria', maxL: 1, maxY: 1999, months: [6, 7, 8, 9], p: 0.04,
      prep: co => ({ lonas: sc(co, 180), lost: sc(co, 400), gain: sc(co, 200), dmg: sc(co, 350) }),
      text: () => 'Feria del día 16 en Betanzos y, a media mañana, se levanta un vendaval con lluvia horizontal. Los expositores de cartón están a punto de salir volando hacia el Mandeo.',
      opts: [
        { label: d => `Lonas y pinzas (${money(d.lonas)})`, cost: d => d.lonas, costLabel: 'Lonas reforzadas', run(co, X) { X.fans(15, 0.003); return 'El ferretero de al lado nos salva la mañana y la clientela lo agradece.'; } },
        { label: () => 'Recoger antes', run(co, X, d) { X.cash(-d.lost, 'Ventas perdidas en la feria'); X.morale(0.05); return 'Recogemos dos horas antes: menos ventas, pero nadie acaba empapado.'; } },
        { label: () => 'Aguantar el toldo', run(co, X, d) { if (U.rnd() < 0.5) { X.cash(d.gain, 'Ventas en la feria'); return 'Aguantamos el toldo casi con los dientes y la gente compra por pura admiración.'; } X.cash(-d.dmg, 'Género dañado por la lluvia'); return 'Una ráfaga se lleva medio expositor: varias gafas acaban en un charco.'; } }
      ] },
    { id: 'betanzos_medieval', ev: '§9', kind: 'random', title: 'Mercado Medieval de Betanzos', maxL: 1, win: d => d.month === 7 && (d.week === 2 || d.week === 3), p: 0.45, repeat: { gap: 2, max: 3 },
      prep: co => ({ cost: sc(co, 400), inc: sc(co, 1500 + Math.round(1500 * U.rnd())) }),
      text: () => 'A mediados de julio, el casco histórico de Betanzos se llena de gaiteros, artesanos y turistas con el Mercado Medieval. La organización aún tiene un hueco para un puesto, y unas gafas de sol redondas «de inspiración artesanal» encajarían de maravilla.',
      opts: [
        { label: d => `Montar el puesto (${money(d.cost)})`, cost: d => d.cost, costLabel: 'Puesto en el Mercado Medieval', run(co, X, d) { X.cash(d.inc, 'Mercado Medieval de Betanzos'); X.fans(30, 0.004); return 'Vendemos gafas redondas hasta a un caballero con armadura.'; } },
        { label: () => 'Quedarse en Os Mallos', run(co, X) { X.note('semana tranquila'); return 'Este año nos quedamos en el mercadillo de siempre.'; } }
      ] },
    { id: 'nordes', ev: 'EV_20', kind: 'random', title: 'Nordés y salitre', months: [7, 8], p: 0.05, repeat: K.SEASON_REPEAT,
      prep: co => ({ kit: sc(co, 600), later: sc(co, 600), inc: sc(co, 1200 + Math.round(1200 * U.rnd())) }),
      text: () => 'Dos semanas de sol radiante y nordés sin tregua: el viento levanta arena y salitre en Riazor y Orzán, y media ciudad limpia las gafas con la camiseta.',
      opts: [
        { label: d => `Kits de limpieza con logo (${money(d.kit)})`, cost: d => d.kit, costLabel: 'Kits de limpieza con logo', run(co, X, d) { X.fans(65, 0.005); X.stream(d.later, 2, 'Ventas por los kits de limpieza'); return 'Spray y gamuza con nuestro logo en todas las toallas de la playa.'; } },
        { label: () => 'Campaña de antirrayado', run(co, X, d) { X.cash(d.inc, 'Lentes antirrayado'); return 'Las lentes con endurecido salen como churros: el salitre hace el resto.'; } }
      ] },
    { id: 'orballo', ev: 'EV_21', kind: 'random', title: 'Semanas de orballo', months: [11], p: 0.1, repeat: K.SEASON_REPEAT,
      prep: co => ({ esc: sc(co, 450), liq: sc(co, 1600) }),
      text: () => 'Una borrasca tras otra: seis semanas de orballo y cielo color panza de burro. Las gafas de sol del escaparate parecen una broma.',
      opts: [
        { label: d => `Escaparate de lluvia (${money(d.esc)})`, cost: d => d.esc, costLabel: 'Escaparate de otoño', run(co, X) { X.units({ genre: 'graduado' }, 0.10, 8, 'de Graduado'); X.units({ genre: 'lectura' }, 0.08, 8, 'de Lectura'); X.fans(20, 0.002); return 'Progresivos, lectura y lentes para conducir de noche bajo la lluvia: por fin el escaparate tiene sentido.'; } },
        { label: () => 'Liquidar el sol al 50 %', run(co, X, d) { X.cash(d.liq, 'Liquidación de sol'); X.units({ genre: 'sol' }, -0.06, 24, 'de Sol'); return 'Caja inmediata, aunque la gente se acostumbra a esperar a las liquidaciones.'; } },
        { label: () => 'Esperar a que escampe', run(co, X) { X.units({ all: true }, -0.05, 4, 'de todas las colecciones'); return 'Miramos llover por el cristal. Ya escampará.'; } }
      ] },
    { id: 'san_juan', ev: 'EV_22', kind: 'random', title: 'La mañana de San Juan', win: d => (d.month === 6 && d.week === 4) || (d.month === 7 && d.week === 1), p: 0.45, repeat: K.SEASON_REPEAT,
      prep: co => ({ extra: sc(co, 300), incA: sc(co, 1600), incB: sc(co, 1100) }),
      text: () => 'La mañana después de San Juan, con las playas todavía oliendo a sardinas y hoguera, aparece una procesión de clientes con gafas pisoteadas en la arena o con el antirreflejante achicharrado.',
      opts: [
        { label: d => `Reparar en 2 horas (${money(d.extra)})`, cost: d => d.extra, costLabel: 'Horas extra de San Juan', run(co, X, d) { X.cash(d.incA, 'Urgencias de San Juan'); X.fans(45, 0.004); X.morale(-0.06); return '«Plan resaca visual»: entregas en dos horas y un equipo que pide siesta.'; } },
        { label: () => 'Tarifa de urgencia', run(co, X, d) { X.cash(d.incB, 'Urgencias de San Juan'); X.stars(-0.04); return 'Cobramos el recargo de urgencia. Nadie se queja en voz alta.'; } }
      ] },
    { id: 'conjuntivitis', ev: 'EV_25', kind: 'random', title: 'Conjuntivitis en los colegios', months: [3, 4, 5], p: 0.03, repeat: { gap: 6, max: 2 }, when: co => hasGab(co) || hasOptico(co),
      prep: co => ({ lost: sc(co, 400), inc: sc(co, 400) }),
      text: () => 'Brote de conjuntivitis vírica en los colegios de la comarca. Hoy han entrado diez familias pidiendo graduar a niños con los ojos rojos como tomates.',
      opts: [
        { label: () => 'Derivar al médico', run(co, X, d) { X.cash(-d.lost, 'Revisiones aplazadas'); X.rep(5); X.stars(0.05); return 'Los mandamos al pediatra, desinfectamos el gabinete y les damos cita para dentro de dos semanas. Las familias lo agradecen.'; } },
        { label: () => 'Graduarlos igualmente', run(co, X, d) { X.cash(d.inc, 'Revisiones'); if (U.rnd() < 0.6) { X.morale(-0.4, ch => ch.role === 'optico' || ch.id === 0); X.rep(-4); return 'Mala idea: el contagio llega al gabinete y pasamos dos semanas con los ojos como tomates.'; } return 'Esta vez no hay contagios. Esta vez.'; } }
      ] },
    { id: 'alergias', ev: 'EV_44', kind: 'random', title: 'Polen y lentillas', months: [5], p: 0.08, repeat: K.SEASON_REPEAT, when: co => co.hasResearch('Lentillas'),
      prep: co => ({ stock: sc(co, 1000), monthly: sc(co, 400), tears: sc(co, 375) }),
      text: () => 'El polen de las gramíneas bate récords. Los usuarios de lentillas mensuales llegan con picor y depósitos de proteínas.',
      opts: [
        { label: d => `Pasarlos a diarias (${money(d.stock)})`, cost: d => d.stock, costLabel: 'Stock de lentillas diarias', run(co, X, d) { X.stream(d.monthly, 4, 'Lentillas diarias'); X.fans(40, 0.003); return 'Diarias y solución única: menos picor y clientes atados a la reposición.'; } },
        { label: () => 'Lágrimas en el mostrador', run(co, X, d) { X.cash(d.tears, 'Lágrimas artificiales'); return 'Monodosis de lágrimas artificiales junto a la caja. Se venden solas.'; } }
      ] },

    /* ===== Anécdotas de mostrador y oportunidades (cualquier año, con condiciones) ===== */
    { id: 'cianoacrilato', ev: 'EV_03', kind: 'random', title: 'Gafas al pegamento', p: K.P_ANEC, repeat: K.ANEC_REPEAT,
      prep: co => ({ lens: sc(co, 120), renove: sc(co, 180) }),
      text: () => 'Entra un señor muy digno con unas gafas partidas por el puente y rebozadas en pegamento instantáneo, cristalizado hasta en mitad de la lente progresiva. Pregunta si «eso tiene arreglo».',
      opts: [
        { label: () => 'Limpiarlas con acetona', run(co, X, d) { if (U.rnd() < 0.6) { X.fans(20, 0.002); X.stars(0.03); return 'Media hora de bastoncillo y acetona después, las gafas vuelven a la vida. El señor lo cuenta por todo el barrio.'; } X.cash(-d.lens, 'Lente progresiva repuesta'); X.fans(10, 0.001); return 'La acetona se come también el tratamiento. Le ponemos una lente nueva a nuestra costa y sonríe igual.'; } },
        { label: () => 'Plan renove (−25 %)', run(co, X, d) { X.cash(d.renove, 'Plan renove'); X.fans(10, 0.001); return 'Se lleva montura nueva y las viejas en una bolsita, «de recuerdo».'; } },
        { label: () => 'La verdad, con tacto', run(co, X) { X.stars(-0.03); return 'Le explicamos que aquello ya es arqueología industrial. No le hace ninguna gracia.'; } }
      ] },
    { id: 'tornillo', ev: 'EV_09', kind: 'random', title: 'El microtornillo fugitivo', p: K.P_ANEC, repeat: K.ANEC_REPEAT,
      prep: co => ({ kit: sc(co, 320), lost: sc(co, 200) }),
      text: () => 'Ajustando las gafas al aire de una clienta de toda la vida, el microtornillo sale disparado a la velocidad de un neutrino y desaparece en el suelo del taller.',
      opts: [
        { label: d => `Maletín de repuestos (${money(d.kit)})`, cost: d => d.kit, costLabel: 'Maletín de microtornillería', run(co, X) { X.morale(0.05); X.fans(10, 0.001); return 'Dos mil microtornillos de titanio clasificados por medida. Nunca más.'; } },
        { label: () => 'Todos a gatear', run(co, X, d) { X.cash(-d.lost, 'Ventas perdidas buscando un tornillo'); X.morale(-0.08); return 'Media hora de plantilla a cuatro patas con linternas. El tornillo aparece… en el puño de la clienta.'; } },
        { label: () => 'Apaño con sedal', run(co, X) { X.stars(-0.08); X.fans(-10, -0.002); return 'El apaño aguanta hasta la parada del autobús.'; } }
      ] },
    { id: 'baja_vision', ev: 'EV_26', kind: 'random', title: 'La lupa de las esquelas', p: K.P_ANEC, repeat: K.ANEC_REPEAT,
      prep: co => ({ lupa: sc(co, 25), sale: sc(co, 600), gab: hasGab(co) }),
      text: () => 'Un cliente de 78 años asegura que sus gafas de hace quince años le van perfectas: solo quiere una lupa con luz para las esquelas y el crucigrama.',
      opts: [
        { label: () => 'Lupa y charla sin prisas', run(co, X, d) { X.cash(d.lupa, 'Lupa con luz'); X.fans(15, 0.002); X.stars(0.03); return 'Se lleva su lupa y media hora de conversación sobre el tiempo y los nietos.'; } },
        { label: d => d.gab ? 'Revisión de baja visión' : 'Recomendarle el oftalmólogo', run(co, X, d) {
          if (!d.gab) { X.fans(5, 0.0005); return 'Vuelve a las tres semanas con receta nueva y una caja de pastas.'; }
          X.rep(3); if (U.rnd() < 0.4) { X.cash(d.sale, 'Ayudas de baja visión'); return 'La revisión destapa una baja visión sin atender: telelupa, filtros y un cliente agradecido.'; }
          X.fans(5, 0.0005); return 'Con la lupa va servido, pero ya sabe dónde estamos.'; } }
      ] },
    { id: 'perro', ev: 'EV_34', kind: 'random', title: 'El labrador y el acetato', p: K.P_ANEC, repeat: K.ANEC_REPEAT,
      prep: co => ({ cover: sc(co, 65) }),
      text: () => 'Una clienta trae una bolsita con trece fragmentos masticados de las gafas que estrenó ayer. Al parecer, al cachorro de labrador le encanta el acetato de celulosa.',
      opts: [
        { label: d => `Cubrir el 70 % (${money(d.cover)})`, cost: d => d.cover, costLabel: 'Garantía de rotura', run(co, X) { X.fans(25, 0.003); X.stars(0.03); return 'Garantía de rotura activada. La clienta nos recomienda a todo su edificio (y al veterinario).'; } },
        { label: () => 'Montura a precio de coste', run(co, X) { X.fans(10, 0.001); return 'Montura nueva a precio de coste y las lentes, milagrosamente, intactas.'; } }
      ] },
    { id: 'titanio', ev: 'EV_39', kind: 'random', title: 'Memoria de forma… o no', p: K.P_ANEC, repeat: K.ANEC_REPEAT, minY: 2001,
      prep: co => ({ charge: sc(co, 30) }),
      text: () => 'Un cliente presumía en el bar de que su montura de titanio con memoria se retorcía como un sacacorchos… hasta que sonó «clac». Ahora tiene media gafa en cada mano.',
      opts: [
        { label: () => 'Tramitar la garantía', run(co, X) { X.fans(15, 0.001); return 'Una hora al teléfono con el fabricante y montura nueva sin coste. El cliente vuelve al bar a contarlo.'; } },
        { label: () => 'Soldadura láser (cobrando)', run(co, X, d) { X.cash(d.charge, 'Soldadura láser'); X.fans(5, 0.0005); return 'Soldadura láser en un taller especializado: queda como nueva y el cliente paga la diferencia.'; } }
      ] },
    { id: 'casa_valmont', ev: 'EV_36', kind: 'random', title: 'Casa Valmont aprieta', p: K.P_ANEC, minY: 2005, minL: 2,
      prep: co => ({ buy: sc(co, 2400), own: sc(co, 750) }),
      text: () => 'El comercial de Casa Valmont avisa: para conservar su expositor iluminado hay que comprar 80 gafas por temporada, incluidos quince modelos verde neón que no se va a llevar nadie.',
      opts: [
        { label: d => `Aceptar (${money(d.buy)})`, cost: d => d.buy, costLabel: 'Compra mínima de Casa Valmont', run(co, X) { X.brand(3); X.units({ genre: 'premium' }, 0.10, 24, 'de Premium'); return 'El logo de lujo sigue brillando en el escaparate. El verde neón, en el almacén.'; } },
        { label: d => `Dar el hueco a lo nuestro (${money(d.own)})`, cost: d => d.own, costLabel: 'Nuevo expositor propio', run(co, X) { X.units({ all: true }, 0.05, 24, 'de nuestras colecciones'); X.brand(-1); return 'Retiramos el expositor y ponemos nuestras monturas y marcas de autor. El margen respira.'; } },
        { label: () => 'No contestar', run(co, X) { X.brand(-2); return 'Casa Valmont retira el expositor sin despedirse. Queda un rectángulo sin polvo en la pared.'; } }
      ] },
    { id: 'autoescuelas', ev: 'EV_46', kind: 'random', title: 'Convenio con autoescuelas', p: K.P_ANEC, minL: 2,
      prep: co => ({ cost: sc(co, 500) }),
      text: () => 'Tres autoescuelas del barrio proponen colaborar: revisión visual gratis a sus alumnos y descuento en unas gafas de repuesto para la guantera.',
      opts: [
        { label: d => `Firmar el convenio (${money(d.cost)})`, cost: d => d.cost, costLabel: 'Convenio con autoescuelas', run(co, X) { X.fans(45, 0.003); X.units({ genre: 'graduado' }, 0.04, 24, 'de Graduado'); return 'Cada trimestre llega una tanda de conductores noveles con el psicotécnico en la mano.'; } },
        { label: () => 'Rechazar', run(co, X) { X.note('sin cambios'); return 'Los alumnos de autoescuela solo miran el precio, decidimos. Quizá.'; } }
      ] },
    { id: 'influencer', ev: 'EV_19', kind: 'random', title: 'Gafas gratis por «visibilidad»', p: K.P_ANEC, minY: 2015,
      prep: co => ({ gift: sc(co, 90), aff: sc(co, 300) }),
      text: () => 'Un creador de contenido de la ciudad, con 80.000 seguidores, entra pidiendo dos gafas de sol de gama alta gratis a cambio de «tres historias etiquetándonos».',
      opts: [
        { label: d => `Regalarle dos gafas (${money(d.gift)})`, cost: d => d.gift, costLabel: 'Gafas regaladas a un creador', run(co, X) { if (U.rnd() < 0.6) { X.hype(8); X.fans(50, 0.006); return 'Las historias funcionan: llegan chavales enseñando en el móvil «las del vídeo».'; } X.note('sin efecto'); return 'Media audiencia eran bots. Dos gafas menos y una lección más.'; } },
        { label: () => 'Código de afiliado', run(co, X, d) { X.cash(d.aff, 'Ventas con código de afiliado'); return 'Le damos un código del 15 %. Algo se mueve.'; } },
        { label: () => 'Explicarle lo del alquiler', run(co, X) { X.brand(1); X.fans(15, 0.001); return 'Le explicamos que el casero no acepta visibilidad. La clientela de toda la vida aplaude por dentro.'; } }
      ] },
    { id: 'lentilla', ev: 'EV_41', kind: 'random', title: 'La lentilla perdida', p: K.P_ANEC, repeat: K.ANEC_REPEAT, when: co => co.hasResearch('Lentillas'),
      prep: co => ({ fee: sc(co, 30) }),
      text: () => 'Un adolescente entra desesperado: se ha puesto la lentilla, le pica horrores y está convencido de que «se le ha ido detrás del cerebro».',
      opts: [
        { label: () => 'Atenderle en la lámpara', run(co, X) { X.fans(25, 0.002); X.rep(2); return 'Lentilla doblada en el fondo de saco, fuera en dos minutos, y clase de inserción gratis. Su madre nos adora.'; } },
        { label: () => 'Cobrar la urgencia', run(co, X, d) { X.cash(d.fee, 'Urgencia de contactología'); X.stars(-0.03); return 'Cobramos la consulta de urgencia. La lentilla sale; la simpatía, no tanto.'; } }
      ] },
    { id: 'daltonismo', ev: 'EV_43', kind: 'random', title: 'Rojo o verde', p: K.P_ANEC, minY: 2019, when: co => hasGab(co),
      prep: co => ({ kit: sc(co, 1800), monthly: sc(co, 150) }),
      text: () => 'Un opositor a bombero y un diseñador gráfico preguntan, el mismo día, por filtros que ayuden a distinguir el rojo del verde.',
      opts: [
        { label: d => `Kit de filtros cromáticos (${money(d.kit)})`, cost: d => d.kit, costLabel: 'Kit de filtros cromáticos', run(co, X, d) { X.stream(d.monthly, 24, 'Filtros de realce cromático'); X.rep(2); return 'Un nicho pequeño pero fiel: la noticia corre por los foros.'; } },
        { label: () => 'No trabajamos eso', run(co, X) { X.note('sin cambios'); return 'Les recomendamos otra óptica. Se van con cara de pena.'; } }
      ] },
    { id: 'critico', ev: 'EV_45', kind: 'random', title: 'El crítico de incógnito', months: [10, 11, 12], p: 0.06, minL: 2, repeat: { gap: 5, max: 3 },
      when: (co, c) => co.gameLog.some(g => g.releaseWeek != null && U.dateFromWeek(g.releaseWeek).year === c.d.year && g.score >= 6),
      prep: (co, c) => ({ best: Math.max(0, ...co.gameLog.filter(g => g.releaseWeek != null && U.dateFromWeek(g.releaseWeek).year === c.d.year).map(g => +g.score || 0)) }),
      text: () => 'Un señor con gabardina, libreta y gafas octogonales de carey pregunta por el número de Abbe de nuestras lentes. Todo apunta a que es del jurado de la revista del sector.',
      opts: [
        { label: () => 'Que le atienda el mejor óptico', run(co, X) { X.hype(12); X.stars(0.05); X.morale(-0.03); return 'Le enseñamos el taller, la colección y hasta el cuarto de la limpieza. Sale tomando notas.'; } },
        { label: () => 'Tratarle como a cualquiera', run(co, X, d) { if (d.best >= 7.5) { X.hype(15); X.brand(2); return 'Nos trata como a cualquiera y escribe que somos de todo menos cualquiera.'; } X.hype(3); return 'Reseña correcta, sin más. Al menos es honesta.'; } }
      ] },
    { id: 'y2k', ev: 'EV_37', kind: 'random', title: 'Vuelven las gafas de 2001', p: K.P_ANEC, minY: 2023,
      when: co => co.gameLog.some(g => g.releaseWeek != null && realYearOf(g.releaseWeek) <= 2005),
      prep: co => { const old = co.gameLog.find(g => g.releaseWeek != null && realYearOf(g.releaseWeek) <= 2005); return { clean: sc(co, 100), vint: sc(co, 3200), cesta: sc(co, 750), title: old ? old.title : 'una colección antigua' }; },
      text: (co, d) => `De la noche a la mañana, cientos de jóvenes piden monturas rectangulares estrechas como las de principios de siglo. En el altillo del almacén quedan dos cajas de «${d.title}», olvidadas desde entonces.`,
      opts: [
        { label: d => `Archivo vintage (${money(d.clean)})`, cost: d => d.clean, costLabel: 'Restauración de stock antiguo', run(co, X, d) { X.cash(d.vint, 'Archivo vintage'); X.brand(2); X.fans(40, 0.003); return 'Ultrasonidos, plaquetas nuevas y etiqueta de «archivo auténtico»: se agotan en un fin de semana.'; } },
        { label: () => 'Cesta de liquidación', run(co, X, d) { X.cash(d.cesta, 'Liquidación del altillo'); return 'A 39 € la pieza, desaparecen en 48 horas. Alguien las revenderá a 160.'; } }
      ] },
    { id: 'smart_glasses', ev: 'EV_47', kind: 'random', title: 'Gafas con asistente', p: K.P_ANEC, minY: 2024, minL: 2,
      prep: co => ({ cost: sc(co, 6000), monthly: sc(co, 250) }),
      text: () => 'Un fabricante tecnológico busca ópticas sanitarias para graduar y ajustar sus gafas con cámara, microaltavoces en las varillas y asistente de IA.',
      opts: [
        { label: d => `Ser centro certificado (${money(d.cost)})`, cost: d => d.cost, costLabel: 'Certificación de gafas inteligentes', run(co, X, d) { X.stream(d.monthly, 24, 'Gafas inteligentes'); X.fans(100, 0.01); X.brand(2); return 'Formamos al equipo en electrónica de varillas. Llega un público nuevo que habla en gigas.'; } },
        { label: () => 'Esperar a ver', run(co, X) { X.note('sin cambios'); return 'Esperaremos a que las baterías no pesen tanto en las orejas. La novedad se la lleva otro.'; } }
      ] },
    { id: 'vertice', ev: 'EV_49', kind: 'random', title: 'Una oferta de Grupo Vértice', p: 0.03, minY: 2023, minL: 4,
      when: co => { const m = co.modules.marketing, g = co.modules.gabinete; return co.fans >= 1e6 || (m && (m.stars >= 4.5 || m.brand >= 50)) || (g && g.reputation >= 80); },
      prep: co => ({ cash: sc(co, 150000) }),
      text: () => 'El director de expansión ibérica de Grupo Vértice Óptico nos cita en un hotel de cinco estrellas. Sobre la mesa, un cheque por la marca y la tienda insignia: en dos años, su rótulo sustituiría al nuestro.',
      opts: [
        { label: () => 'No está en venta', run(co, X) { X.brand(5); X.stars(0.1); X.rep(5); X.morale(0.15); X.fans(200, 0.02); return 'Nuestro nombre sigue en el rótulo. La plantilla lo celebra y la ciudad lo comenta.'; } },
        { label: d => `Vender el 25 % de la línea (+${U.shortMoney(d.cash)})`, run(co, X, d, c, s) { X.cash(d.cash, 'Venta del 25 % de la línea a Grupo Vértice'); X.fans(0, -0.05); s.flags.royaltyVertice = true; X.note('4 % del precio de cada montura en royalties para Vértice'); return 'Vendemos una participación minoritaria de la línea de monturas: caja para crecer, a cambio de royalties y de algún cliente que nos ve «vendidos».'; } }
      ] }
  ];
  const BY = {}; for (const e of EVENTS) BY[e.id] = e;
  const freeIndex = e => e.opts.findIndex(o => !o.cost);

  /* ---------- elegibilidad y disparo ---------- */
  function eligibleRandom(co, s, c) {
    const out = [];
    for (const e of EVENTS) {
      if (e.kind !== 'random') continue;
      if (e.minY && c.y < e.minY) continue; if (e.maxY && c.y > e.maxY) continue;
      if (e.minL && c.L < e.minL) continue; if (e.maxL && c.L > e.maxL) continue;
      if (e.months && !e.months.includes(c.d.month)) continue; if (e.win && !e.win(c.d)) continue;
      const f = s.fired[e.id]; if (f && (!e.repeat || f.n >= e.repeat.max || c.y - f.y < e.repeat.gap)) continue;
      try { if (e.when && !e.when(co, c, s)) continue; } catch (err) { console.error('mundo when', e.id, err); continue; }
      out.push(e);
    }
    return out;
  }
  function dueFixed(co, s, c) {
    return EVENTS.filter(e => { if (e.kind !== 'fixed' || e.year !== c.y || c.d.month < e.month || s.fired[e.id]) return false; try { return !e.when || e.when(co, c, s); } catch (err) { console.error('mundo when', e.id, err); return false; } }).sort((a, b) => a.month - b.month);
  }
  function fire(co, e, c) {
    const s = S(co); c = c || ctxOf(co, week(co)); let d = {};
    try { d = e.prep ? e.prep(co, c, s) || {} : {}; } catch (err) { console.error('mundo prep', e.id, err); d = {}; }
    const text = e.text(co, d); const options = e.opts.map(o => o.label(d));
    G.notify(e.title, text, 'decision', { sourceId: ID + ':' + e.id, options, mundo: { d, y: c.y } });
    const f = s.fired[e.id] || { n: 0 }; f.n++; f.w = c.w; f.y = c.y; s.fired[e.id] = f;
    s.log.push({ id: e.id, w: c.w, y: c.y, c: null }); if (s.log.length > K.LOG_MAX) s.log.shift();
    const yc = s.years[c.y] || (s.years[c.y] = { all: 0, rnd: 0 }); yc.all++; if (e.kind === 'random') yc.rnd++;
    for (const k in s.years) if (+k < c.y - 3) delete s.years[k];
    s.lastWeek = c.w;
    return true;
  }
  function weekly(co, w, dt) {
    const s = S(co); s.effects = s.effects.filter(e => e.until > w);
    if (w < K.START_WEEK) return;
    if (!co.gameLog.length && w < 24) return;                                   // tutorial: primero la primera colección
    if (G.modalOpen || (co.notifications && co.notifications.length)) return;   // nada encima de otro diálogo ni con avisos en cola
    if (w - s.lastWeek < K.MIN_GAP) return;
    const c = ctxOf(co, w); const yc = s.years[c.y] || { all: 0, rnd: 0 };
    if (yc.all >= K.MAX_YEAR) return;
    const fixed = dueFixed(co, s, c); if (fixed.length) return fire(co, fixed[0], c);
    if (yc.rnd >= K.MAX_RANDOM_YEAR) return;
    for (const e of U.shuffle(eligibleRandom(co, s, c))) if (U.rnd() < e.p) return fire(co, e, c);
  }
  function monthly(co) {
    const s = S(co); if (!s.streams.length) return;
    for (const x of s.streams) { const v = Math.round(+x.amount); if (v && isFinite(v)) co.adjustCash(v, x.label); x.left--; }
    s.streams = s.streams.filter(x => x.left > 0);
  }

  /* ---------- decisiones ---------- */
  function onDecision(co, sourceId, choice, n) {
    if (!sourceId || sourceId.indexOf(ID + ':') !== 0) return;
    const id = sourceId.slice(ID.length + 1); const e = BY[id]; if (!e) return;
    const s = S(co); const w = week(co); const c = ctxOf(co, w);
    let d = n && n.mundo && n.mundo.d; if (!d || typeof d !== 'object') { try { d = e.prep ? e.prep(co, c, s) || {} : {}; } catch (err) { d = {}; } }
    let i = Math.floor(+choice); if (!(i >= 0 && i < e.opts.length)) i = Math.max(0, freeIndex(e));
    let opt = e.opts[i]; const X = collector(co, s, w); let pre = '';
    const cost = opt.cost ? Math.round(+opt.cost(d, co) || 0) : 0;
    if (cost > 0) {
      if (!G.canSpend(cost)) { const fi = Math.max(0, freeIndex(e)); pre = `No hay caja para «${opt.label(d)}»; nos quedamos con «${e.opts[fi].label(d)}». `; i = fi; opt = e.opts[fi]; }
      else X.cash(-cost, opt.costLabel || e.title);
    }
    let narr = ''; try { narr = opt.run(co, X, d, c, s) || ''; } catch (err) { console.error('mundo run', id, err); }
    const entry = s.log.slice().reverse().find(x => x.id === id && x.c === null); if (entry) entry.c = i;
    const msg = `${e.title}: ${pre}${narr}${X.out.length ? ' (' + X.out.join(' · ') + ')' : ''}`;
    G.log(msg); try { if (typeof UI !== 'undefined' && UI && UI.newsBanner) UI.newsBanner({ header: e.title, icon: '🌍', text: `${pre}${narr}${X.out.length ? ' (' + X.out.join(' · ') + ')' : ''}` }); else toast(msg); } catch (err) { /* sin DOM */ }
  }

  /* ---------- efectos sobre las colecciones ---------- */
  function matches(game, e) { if (e.all) return true; if (e.genre) return genreIs(game, e.genre); if (e.notGenre) return !!game && game.genre !== e.notGenre; return false; }
  function salesFactor(co, game) { const s = S(co); const w = week(co); let f = 1; for (const e of s.effects) if (e.type === 'units' && e.until > w && matches(game, e)) f *= 1 + e.pct; return U.clamp(f, 0.7, 1.4); }
  function unitCost(co, game) {
    const s = S(co); const w = week(co); let pct = s.flags.royaltyVertice ? 0.04 : 0;
    for (const e of s.effects) if (e.type === 'unitcost' && e.until > w && matches(game, e)) pct += e.pct;
    if (!pct) return 0; const sz = DATA.CONST.SIZE[game && game.size]; const price = (game && +game.unitPrice) || (sz && sz.unitPrice) || 70;
    return Math.round(price * Math.min(0.2, pct) * 100) / 100;
  }

  const MOD = {
    id: ID, name: 'Eventos del mundo', icon: '🌍', order: 99, hidden: true,
    init, weekly, monthly, salesFactor, unitCost, onDecision,
    DECISIONS: EVENTS.map(e => ID + ':' + e.id),
    api: { K, YEAR_ZERO, EVENTS, BY, S, fire: (co, id) => BY[id] && fire(co, BY[id]), eligibleRandom, dueFixed, realYearOf, weekOfReal, freeIndex, scale }
  };
  Modules.register(MOD);
})();
