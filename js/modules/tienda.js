/* Óptica Tycoon — Departamento Tienda y venta cruzada (id "tienda", icono 🏬, order 50)
   Fuente de datos: docs/research/tienda.data.json, tienda.md y RESULTADO_DEPARTAMENTOS_OFICIO.md (investigación oct 2026). Script clásico: todo dentro de una IIFE.

   Escala: las VISITAS y los TICKETS se expresan en unidades de juego (×10 de la realidad, como los clientes fieles del núcleo);
   los precios son reales (ticket 45 € en el puesto, 180/210/260 € en local/gabinete/insignia) y K_TIENDA = 0,1 devuelve el ingreso
   bruto a la escala del juego (igual que UNIT_SCALE en las colecciones). Los pacientes convertidos del gabinete (escala real) se
   multiplican por VOL = 10 para sumarlos a los tickets. Los importes fijos (cuotas, servicios) están directamente en € de juego.

   Estado persistente en co.modules.tienda (JSON plano, reparado por init):
     level, visitsWeek, conversion, ticket, salesWeek, kpis   ← campos compartidos (DESIGN §1)
     display (0..9 nivel de escaparate/mobiliario) · zones [ids] · stockValue (€ invertidos en monturas) · incentive · schedule
     promos [{id, start, until}] (campañas de 4 semanas) · policies [ids] (políticas permanentes) · promoLog [{id, w}]
     lc {users, subs} usuarios de lentillas recurrentes · nps (0..100) · effects [{type, mult/val, until, src}] (eventos)
     hist (24 semanas) · months (12 meses) · month (acumulador) · fired {} · lastEvent · stats · flags · log
   Consumo de otros módulos (valores neutros si no existen): marketing.traffic/brand/stars/retention/group,
   gabinete.convertedWeek, lab.deliveryDays/defectRate/lensMargin. Hacia fuera: salesFactor (escaparate → canal tienda),
   hypeFactor (escaparate temático), monthlyCost (cuotas, mobiliario, incentivos, horario, obsolescencia de stock).
   Decisiones (sourceId): tienda:guerra_precios · tienda:inspeccion_consumo · tienda:oferta_competencia · tienda:crisis_mutua ·
   tienda:lote_defectuoso · tienda:cliente_conflictivo · tienda:cierre_competidor · tienda:black_friday · tienda:hurto_exposicion ·
   tienda:devolucion_audifonos. Textos y cifras revisados con docs/research/RESULTADO_DEPARTAMENTOS_OFICIO.md (§6, tablas SERVICIOS_TIENDA, EQUIPOS y EVENTOS). */
'use strict';
(function () {
  const ID = 'tienda';
  const K = {
    K_TIENDA: 0.1,        // escala del juego sobre el ingreso bruto (como UNIT_SCALE)
    VOL: 10,              // pacientes del gabinete (escala real) → tickets de juego
    WEEKS_MONTH: 4.33, HIST: 24,
    CAP_PER_STAFF: 350,   // tickets/semana (juego) que cierra un asesor a jornada completa (≈125 atenciones reales, algo más de un cuarto acaban en venta)
    ATT_MIN: 0.4,         // atención mínima: sin nadie en la tienda se atiende al 40 %
    ATT_MIN_LEVEL: [0, 0.7, 0.4, 0.4, 0.4], // en el puesto el dueño atiende a ratos
    UTIL_OK: 0.85,        // utilización a partir de la cual crece la espera
    LC_MONTHLY: 25, LC_CHURN: 0.25, LC_CHURN_SUBS: 0.12,
    RECALL_BASE: 0.55, FANS_CAP: 1.5e6, REPEAT_CONV: 0.4,
    PROMO_WEEKS: 4, STOCK_OBS: 0.20, STOCK_SELL: 0.6,
    NPS_BASE: 30, FANS_PER_TICKET: 0.03,
    SECOND_PAIR_PRICE: 0.5, // la segunda gafa al 50 %: con el coste de la primera deja ~40 % de margen
    LENS_MARGIN: 0.75,    // lentes graduadas: 78-85 % con rappel de grupo de compra; una independiente sin grupo (10-20 % de descuento) se queda por debajo
    BRAND_FRAME_MARGIN: 0.62, OWN_FRAME_EXTRA: 0.22, // monturas de firma 55-65 %, marca propia 80-88 %
    LC_COGS: 0.70,        // lentillas: margen 25-35 %
    WARRANTY_PRICE: 25, WARRANTY_COGS: 0.10, // seguro de rotura a 2 años: 18-35 €, margen 90 %
    FIN_COST: 0.035,      // financiación sin intereses: coste 2,5-4,5 % que asume la óptica
    PLAN_SHARE: 0.14, PLAN_FEE: 20, PLAN_COGS: 0.26 // plan renove: 14 % de adopción, 15-35 €/mes, margen 74 %
  };
  const esc = s => (typeof UI !== 'undefined' && UI && UI.esc) ? UI.esc(s) : String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = m => { if (typeof UI !== 'undefined' && UI && UI.toast) UI.toast(m); else if (typeof G !== 'undefined' && G.company) G.log(m); };
  const notify = (h, t, type, o) => G.notify(h, t, type, o);
  const money = n => U.money(n);
  const pct = v => Math.round(100 * v) + ' %';
  const pct1 = v => (100 * v).toFixed(1) + ' %';
  const wk = co => Math.floor(co.currentWeek);
  const lvlOf = x => (typeof x.level === 'function' ? x.level() : 1);
  const mkOf = co => (co.modules && co.modules.marketing) || null;
  const gabOf = co => (co.modules && co.modules.gabinete) || null;
  const labOf = co => (co.modules && co.modules.lab) || null;
  const tallerOf = co => (co.modules && co.modules.taller) || null;

  /* =====================================================================
     1. CATÁLOGOS (podados y adaptados de tienda.data.json)
     ===================================================================== */
  /* Niveles de tienda = nivel de local. visits en unidades de juego (×10 de niveles_tienda.trafico_base_semana). */
  const LEVELS = [null,
    { level: 1, name: 'Puesto del mercado', visits: 2500, conv: 0.07, ticket: 45, upt: 1.1, p2: 0.03, stock: 3000, step: 1000, frames: 40, sunShare: 0.8, kidsShare: 0.05, maxStaff: 1, desc: 'Seis metros cuadrados en el mercadillo, expositores giratorios y un espejo de mano. Sin autorización sanitaria solo se puede vender gafa de sol sin graduar (EPI con marcado CE) y lectura premontada de +1,00 a +3,50 D: graduar o montar a medida aquí sería intrusismo. Ticket medio 45 €.' },
    { level: 2, name: 'Local comercial', visits: 1850, conv: 0.10, ticket: 180, upt: 1.2, p2: 0.06, stock: 20000, step: 5000, frames: 300, sunShare: 0.2, kidsShare: 0.1, maxStaff: 3, desc: 'Treinta y cinco a cincuenta metros a pie de calle con exposición cerrada: las monturas en vitrinas y gavetas con llave, y cada prueba la atiende alguien en la mesa de venta. Para vender graduado el local se inscribe como establecimiento sanitario, con óptico-optometrista director técnico y el número de registro en el rótulo. Ticket medio 180 €; una óptica de barrio factura 110.000-175.000 € al año.' },
    { level: 3, name: 'Óptica con gabinete', visits: 2600, conv: 0.12, ticket: 210, upt: 1.25, p2: 0.08, stock: 45000, step: 10000, frames: 600, sunShare: 0.15, kidsShare: 0.1, maxStaff: 5, desc: 'Ochenta a ciento cuarenta metros de exposición abierta: lineales retroiluminados de libre acceso con 400-600 monturas, gabinete y, si se quiere, cabina audiométrica. Cada paciente que graduamos sale por la mesa de venta. Ticket 210 €, el precio medio real de la gafa completa en España.' },
    { level: 4, name: 'Óptica insignia', visits: 4500, conv: 0.14, ticket: 260, upt: 1.35, p2: 0.10, stock: 120000, step: 20000, frames: 1500, sunShare: 0.15, kidsShare: 0.1, maxStaff: 8, desc: 'Tienda insignia de más de 250 m² en calle principal: taller de biselado y artesanía visto tras un cristal, sala de visagismo, espacios de firmas de autor, gabinetes y audiología. Ticket 260 €; una óptica así factura 0,65-1,4 M€ al año.' }
  ];
  /* Estacionalidad real del mercado español (informe de oficio, §7): cuesta de enero, primavera media, gran campaña de verano,
     agosto flojo en interior, vuelta al cole, noviembre valle (el Black Friday va aparte, como campaña) y pico de Navidad.
     El sol concentra de mayo a agosto unos dos tercios de sus ventas anuales. */
  const SEASON = { 1: 0.8, 2: 0.8, 3: 1.0, 4: 1.0, 5: 1.2, 6: 1.25, 7: 1.25, 8: 0.8, 9: 1.2, 10: 1.15, 11: 0.95, 12: 1.2 };
  const SEASON_SUN = { 1: 0.5, 2: 0.5, 3: 0.8, 4: 1.0, 5: 1.9, 6: 2.5, 7: 2.6, 8: 2.1, 9: 0.9, 10: 0.6, 11: 0.5, 12: 1.0 };
  const SEASON_KIDS = { 9: 1.4, 10: 1.2 };
  /* año del juego = año real − 1994: fechas de popularización que usan los requisitos yearN */
  const YEAR_WHY = { 15: 'La torre de videocentrado se populariza en las ópticas hacia 2009', 18: 'El Black Friday llega a la óptica española hacia 2012' };

  /* Requisitos: lista de tokens comunes a escaparate, zonas, servicios y promociones.
     lvlN · res:ID (investigación) · svc:id (servicio de tienda) · zone:id · part:id (tecnología del taller) · disp:N (escaparate ≥ N)
     role:ROL (alguien con ese rol en plantilla) · team2 (≥2 personas en tienda) · own2 (≥2 colecciones lanzadas en canal tienda)
     web (canal en línea propio) · staff6 (≥6 empleados) · yearN (año del juego ≥ N; año real − 1994) · gab (gabinete abierto o investigación Gabinete) · group (franquicia, marca propia o notoriedad ≥ 40) */
  function reqWhy(co, s, token) {
    const m = /^lvl(\d)$/.exec(token); if (m) return co.level >= +m[1] ? null : 'Requiere ' + C.LEVELS[+m[1]].name.toLowerCase();
    let p = token.split(':'); const kind = p[0], arg = p[1];
    if (kind === 'res') return co.hasResearch(arg) ? null : 'Investiga «' + ((DB.research(arg) || {}).name || arg) + '»';
    if (kind === 'svc') return co.hasResearch(arg) ? null : 'Requiere «' + (SV_BY[arg] ? SV_BY[arg].name : arg) + '»';
    if (kind === 'zone') return s.zones.indexOf(arg) >= 0 ? null : 'Requiere la zona «' + (ZONE_BY[arg] ? ZONE_BY[arg].name : arg) + '»';
    if (kind === 'part') return co.researchCompleted.indexOf(arg) >= 0 ? null : 'Requiere la tecnología «' + ((DB.part(arg) || {}).name || arg) + '»';
    if (kind === 'disp') return s.display >= +arg ? null : 'Requiere mobiliario nivel ' + arg + ' (' + DISPLAY[+arg].name + ')';
    if (kind === 'role') return co.staff.some(x => x.role === arg || (arg === 'tecnico' && x.role === 'labtech') || (arg === 'audioprotesista' && x.skills && x.skills.audiologia)) ? null : 'Hace falta ' + (DATA.roleById(arg) || { name: arg }).name.toLowerCase() + ' en plantilla';
    if (token === 'team2') return staffInfo(co).list.length >= 2 ? null : 'Requiere al menos 2 personas asignadas a la tienda';
    if (token === 'own2') return co.gameLog.filter(g => (g.platforms || []).indexOf('tienda') >= 0).length >= 2 ? null : 'Requiere haber lanzado 2 colecciones en el canal Tienda propia';
    if (token === 'web') return (co.licencedPlatforms || []).some(x => x === 'webpropia' || x === 'probadorpropio' || x === 'techretail') ? null : 'Requiere un canal en línea (venta en línea propia, probador virtual propio o tienda tecnológica)';
    if (token === 'staff6') return co.staff.length >= 6 ? null : 'Requiere una plantilla de 6 personas';
    const yr = /^year(\d+)$/.exec(token); if (yr) return co.isLaterOrEqualThan(+yr[1], 1) ? null : (YEAR_WHY[+yr[1]] || 'Disponible a partir de ' + (+yr[1] + 1994));
    if (token === 'gab') { const g = gabOf(co); return (g && g.tier >= 1) || co.hasResearch('Gabinete') ? null : 'Requiere gabinete optométrico'; }
    if (token === 'group') { const mk = mkOf(co); return (mk && (mk.group === 'franquicia' || mk.brand >= 40)) || co.hasResearch('MarcaPropia') ? null : 'Requiere una enseña reconocible: franquicia, marca propia o notoriedad ≥ 40'; }
    if (token === 'tecnico') { const t = tallerOf(co), l = labOf(co); return (t && t.tier >= 1) || (l && l.tier >= 2) || co.staff.some(x => x.role === 'tecnico' || x.role === 'labtech') ? null : 'Requiere un técnico (taller o laboratorio propio, o un técnico en plantilla)'; }
    return null;
  }
  function whyNot(co, s, reqs) { for (const t of reqs || []) { const w = reqWhy(co, s, t); if (w) return w; } return null; }

  /* Escaparate y mobiliario: escalera de 10 niveles (se compran en orden). fx acumulables: traffic (+% visitas), conv (+% conversión),
     ticket (+% ticket), upt, nps, tol (minutos de tolerancia a la espera), fans (×), hype (×), premium (cuota de tickets premium). */
  const DISPLAY = [
    { id: 'esc0_mesa_mercado', name: 'Mesa plegable y espejo de mano', cost: 0, frames: 40, level: 1, fx: {}, desc: 'Lo que hay: las gafas de sol y de lectura en una mesa del mercadillo y un espejo de mano.' },
    { id: 'esc1_expositor_toldo', name: 'Expositores giratorios, toldo y rótulo', cost: 2000, frames: 80, level: 1, fx: { traffic: 0.10, conv: 0.02 }, desc: 'Dos expositores giratorios al aire libre y un toldo con el nombre (un puesto completo cuesta 600-2.000 €): +10 % visitas, +2 % conversión.' },
    { id: 'esc2_escaparate_vitrinas', name: 'Escaparate acristalado y exposición cerrada (vitrinas y gavetas con llave)', cost: 12000, frames: 150, level: 2, fx: { traffic: 0.12, conv: 0.03 }, desc: 'El primer contacto con la calle. Las monturas, en vitrinas y gavetas bajo llave: cada prueba la atiende el asesor en la mesa de venta. +12 % visitas, +3 % conversión.' },
    { id: 'esc3_led_cri90', name: 'Iluminación LED de alto rendimiento de color y espejos iluminados', cost: 18000, frames: 250, level: 2, fx: { conv: 0.05, nps: 1 }, desc: 'Tres capas de luz (general, focos a los expositores y más de 800 lux en los espejos de prueba): los colores del acetato se ven de verdad. +5 % conversión y menos devoluciones.' },
    { id: 'esc4_fachada_rotulo', name: 'Fachada y rótulo luminoso con el número de registro sanitario', cost: 25000, frames: 250, level: 2, fx: { traffic: 0.06, fans: 1.05 }, desc: 'Que se vea desde la otra acera, con el nombre del centro, su oferta asistencial y el número de registro sanitario a la vista, como exige la norma: +6 % visitas y +5 % de clientes fieles nuevos.' },
    { id: 'esc5_zonificacion', name: 'Zonificación de la sala (sol, graduado, infantil, lentillas, firmas)', cost: 35000, frames: 400, level: 2, fx: { upt: 0.08, ticket: 0.04, tol: 2 }, desc: 'Cada cosa en su sitio y el cliente circula solo: +0,08 unidades por ticket, +4 % ticket, 2 minutos más de paciencia.' },
    { id: 'esc6_escaparate_tematico', name: 'Escaparate temático renovado cada 4-6 semanas', cost: 2000, monthly: 1000, frames: 400, level: 2, fx: { traffic: 0.12, hype: 1.05 }, desc: 'Primavera y sol, verano, vuelta al cole, otoño y Navidad: escaparatista y atrezo cada 4-6 semanas (1.000 €/mes; gratis con un empleado formado en escaparatismo o el departamento de marketing completo). +12 % visitas y +5 % de expectación en las campañas.' },
    { id: 'esc7_digital_probador', name: 'Exposición abierta: lineales retroiluminados de libre acceso y pantallas', cost: 40000, frames: 400, level: 3, fx: { traffic: 0.06, conv: 0.03, nps: 3 }, desc: 'Se acabaron las vitrinas cerradas: el cliente coge las monturas, se las prueba y el asesor le guía. Lineales retroiluminados, pantallas con las colecciones y espejos a cada metro: +6 % visitas, +3 % conversión, +3 NPS. Ojo: la exposición abierta invita al hurto.' },
    { id: 'esc8_boutique_lujo', name: 'Espacio de firmas de autor (vitrinas cerradas, asesor dedicado)', cost: 60000, frames: 520, level: 3, research: 'PremiumLine', fx: { premium: 0.04, nps: 1 }, desc: 'Vitrinas cerradas con llave para las firmas caras y un asesor que no tiene prisa: 4 % de tickets premium (×3), es decir, +8 % de ticket medio. Requiere investigar «Línea de lujo».' },
    { id: 'esc9_showroom_flagship', name: 'Tienda insignia: taller visto tras cristal y sala de visagismo', cost: 150000, frames: 2000, level: 4, fx: { traffic: 0.15, ticket: 0.08, nps: 5 }, desc: 'Más de 250 m² en calle principal, con el taller de biselado y artesanía a la vista detrás de un cristal y una sala reservada de visagismo: +15 % visitas, +8 % ticket, +5 NPS.' }
  ];
  /* Zonas (14): compras únicas con requisitos de nivel. fx como arriba más sunTraffic (×, ponderado por la cuota de sol), kids/mature (×),
     capture (+ captura gabinete→venta), lcEnable / lcNew (usuarios nuevos de lentillas por semana) / lcChurn (×), services (€/sem de juego), graduado (habilita). */
  const ZONES = [
    { id: 'sol', name: 'Zona de sol', cost: 4500, level: 1, fx: { sunTraffic: 1.15, ticket: 1.02 }, desc: 'Expositor de sol con espejo, filtros de categoría 0 a 4 rotulados y marcado CE a la vista (las gafas de sol son EPI). El sol vende de mayo a agosto dos tercios de su año: +15 % de tráfico de sol, +2 % ticket. Habilita las promociones de sol.' },
    { id: 'lectura', name: 'Expositor giratorio de lectura premontada', cost: 600, level: 1, fx: { upt: 0.05, mature: 1.03 }, desc: 'El giratorio de +1,00 a +3,50 D junto a la caja, con una cartilla de lectura a 40 cm para que el cliente pruebe él mismo: +0,05 unidades por ticket, atrae al público sénior.' },
    { id: 'accesorios', name: 'Mostrador de accesorios (estuches, cordones, kits de limpieza, líquidos)', cost: 1500, level: 1, fx: { upt: 0.15, ticketAdd: 6, marginPp: 1 }, desc: 'Complementos con margen del 80 %: +0,15 unidades por ticket, +6 € de ticket, +1 pt de margen.' },
    { id: 'graduado', name: 'Zona de graduado (vitrinas, gavetas y mesa de venta)', cost: 10000, level: 2, fx: { graduado: true, frames: 150 }, desc: 'Sin ella la tienda sigue vendiendo como un puesto: solo sol y lectura. Habilita la venta de gafa graduada completa (lentes y monturas son dos tercios de la facturación), siempre que el local tenga autorización sanitaria y óptico-optometrista director técnico.' },
    { id: 'infantil', name: 'Rincón infantil', cost: 8000, level: 2, fx: { traffic: 1.03, kids: 1.3 }, desc: 'Monturas flexibles a su altura y un rincón para esperar: +3 % visitas (familias), +30 % tickets infantiles. Habilita la garantía de graduación infantil y la Vuelta al cole.' },
    { id: 'lentes_contacto_reposicion', name: 'Vitrina de lentillas y soluciones (reposición)', cost: 4000, level: 2, fx: { lcEnable: true }, desc: 'Vitrina de mostrador iluminada con cajas, líquidos y lágrima artificial. Habilita el flujo de lentillas de reposición (8-15 % de la facturación de una óptica).' },
    { id: 'espera', name: 'Zona de espera con pantalla', cost: 5000, level: 2, fx: { tol: 5, nps: 2 }, desc: 'Sofá, café y una pantalla con las colecciones: 5 minutos más de paciencia y +2 NPS.' },
    { id: 'taller_basico', name: 'Banco de taller, frontofocómetro y ventilete', cost: 5000, level: 2, fx: { conv: 1.02, nps: 1, services: 40 }, desc: 'El taller mínimo que exige la norma, a la vista del cliente: ajustes gratis y arreglos al momento a precio de taller (plaquetas o tornillo 3 €, hilo de nylon 5 €, sacar un tornillo partido 6 €, alinear una montura al aire 9 €, soldar un acetato 16 €). +2 % conversión, +40 €/semana.' },
    { id: 'gabinete', name: 'Recepción y sala de espera del gabinete', cost: 30000, level: 3, req: ['gab'], fx: { capture: 0.05, nps: 2 }, desc: 'Mostrador de recepción junto al gabinete, agenda y paso ordenado del paciente a la mesa de venta: +5 pts de captura examen→venta, +2 NPS.' },
    { id: 'contactologia', name: 'Sala de contactología', cost: 15000, level: 3, req: ['res:Lentillas'], fx: { lcEnable: true, lcNewAdd: 30, lcChurn: 0.9 }, desc: 'Sala propia de 8 m² (en Galicia, separada del gabinete) con lavamanos, espejo y lámpara con filtro azul cobalto para enseñar a poner y quitar: +30 usuarios nuevos de lentillas a la semana y −10 % de abandono.' },
    { id: 'taller', name: 'Taller completo (gafas en 1 hora y reparaciones)', cost: 45000, level: 3, req: ['tecnico'], fx: { conv: 1.05, nps: 3, services: 120 }, desc: 'Biseladora con taladro, trazador y banco completo: monofocales en una hora y carta de reparaciones (taladro 3,75 € por agujero, incrustar charnela 15 €, pulir un acetato 16 €, soldadura láser con lacado 16 €, titanio 35 €, decapar 25 €, grabado láser en la lente 42,50 €). +5 % conversión, +3 NPS, +120 €/semana. Requiere un técnico.' },
    { id: 'lujo', name: 'Rincón de firmas de autor', cost: 30000, level: 3, req: ['res:PremiumLine'], fx: { premium: 0.02, mature: 1.05 }, desc: 'Vitrinas de acetato grueso y titanio japonés: 2 % de tickets premium (+4 % ticket medio). Requiere investigar «Línea de lujo».' },
    { id: 'audiologia', name: 'Cabina audiométrica (< 40 dB)', cost: 22000, level: 3, req: ['role:audioprotesista'], fx: { services: 1500, mature: 1.1 }, desc: 'Cabina insonorizada homologada con menos de 40 dB de ruido (5.800-12.500 €), audiómetro de dos canales y videotoscopio (4.200-8.500 €) y obra: la norma autonómica la exige para vender audífonos. +1.500 €/semana mientras haya un técnico superior en audiología protésica.' },
    { id: 'terapia_visual', name: 'Sala de terapia visual y baja visión', cost: 40000, level: 4, req: ['res:TerapiaVisual'], fx: { services: 800, nps: 2 }, desc: 'Programas de 12-24 sesiones de terapia visual a 30-45 € y ayudas de baja visión: +800 €/semana, +2 NPS.' }
  ];
  const ZONE_BY = {}; for (const z of ZONES) ZONE_BY[z.id] = z;

  /* Servicios de venta cruzada (37) → DATA.RESEARCH categoría Tienda. tier 1-4 · cost € · rp puntos · dur ms · req tokens · fx efectos
     fx: traffic/conv/ticket (×), ticketAdd (€), upt, p2 (+tasa 2.º par), p2Price (+precio relativo del 2.º par), recur (× recurrencia),
         recall (tasa de retorno), marginPp (pts de margen), nps, capture, lcEnable/lcNew(×)/lcChurn(×)/subs/lcPrice, financed (cuota financiada),
         warranty (adopción de garantía), services (€/sem), premium (cuota premium), mature/young (×), productivity (×), monthly (€/mes), unlock [promos],
         stockObs (×), fans (×), incomeMult (×todo), members (plan de salud) */
  const SERVICES = []; const SV_BY = {};
  /* servicios que también ofrece otro departamento: si ese módulo está cargado, lo gestiona él (no se paga ni se suma dos veces) */
  const DUP = { t1_tarjeta_fidelidad: 'marketing', t2_financiacion: 'marketing', t2_cita_online: 'marketing', t2_crm: 'marketing', t2_mutuas: 'marketing', t3_audiologia: 'gabinete', t3_servicios_pago: 'gabinete', t3_lc_especializada: 'gabinete' };
  const ZONE_DUP = { audiologia: 'gabinete', terapia_visual: 'gabinete' };
  const dupOf = id => { const m = DUP[id] || ZONE_DUP[id]; const mod = m && typeof Modules !== 'undefined' && Modules.get(m); return mod ? mod.name : null; };
  function Sv(id, name, tier, cost, rp, dur, req, fx, desc, ref) { const o = { id, name, tier, cost, rp, dur, req: req || [], fx: fx || {}, desc, ref }; SERVICES.push(o); SV_BY[id] = o; }
  // Tier 1 (también en el puesto: solo sol, lectura premontada y accesorios)
  Sv('t1_acogida', 'Protocolo de acogida', 1, 3000, 5, 6000, [], { conv: 1.08, nps: 5 }, 'Saludar en diez segundos, preguntar para qué la quiere y dejar probar sin prisa. Base de toda la venta consultiva: +8 % conversión, +5 NPS.', 'Pasar del 10 al 15 % de conversión es un 50 % más de ventas con el mismo tráfico.');
  Sv('t1_accesorios', 'Kit de limpieza y accesorios en mostrador', 1, 2500, 5, 5000, [], { upt: 0.12, ticketAdd: 3, marginPp: 1 }, 'Spray limpiador o antivaho, gamuza de microfibra, cordón y estuche a la altura de la mano (6-15 €, margen 82 %, se lo lleva uno de cada tres clientes): +0,12 unidades por ticket, +3 € y +1 pt de margen.', 'Informe de oficio, SRV_18: kit de limpieza 6-15 €, adopción 30 %.');
  Sv('t1_clip_lectura', 'Venta guiada de lectura premontada (+1,00 a +3,50 D)', 1, 4000, 5, 5000, [], { upt: 0.08, ticketAdd: 5 }, 'Cartilla de lectura a 40 cm para que el cliente pruebe él mismo la potencia y gafas de cerca seriadas de 12-29 € (margen 80 %, se las lleva una de cada cuatro personas présbitas). Es producto sanitario de clase I de venta libre: ni se gradúa ni se monta a medida. +0,08 unidades por ticket, +5 €.', 'SRV_19: lectura premontada 12-29 €, adopción 25 %.');
  Sv('t1_segundo_par', 'Oferta de segunda gafa (−50 % el mismo día)', 1, 6000, 10, 8000, ['svc:t1_acogida'], { p2: 0.07, marginPp: -3, unlock: ['segundo_par_50'] }, 'Proponer siempre una segunda gafa: en el puesto, otra de sol o de lectura; en la óptica, una graduada blanca o de sol al 50 % o por tarifa plana (49-120 €). +7 pts de tasa de segunda gafa, −3 pts de margen. Desbloquea la política «Segunda gafa −50 %».', 'SRV_01: la acepta el 38 % de los compradores cuando se ofrece siempre.');
  Sv('t1_ficha_cliente', 'Ficha de cliente y libreta de revisiones', 1, 2000, 5, 5000, [], { recur: 1.1 }, 'Nombre, teléfono, qué se llevó y cuándo (con gabinete, la graduación va en la historia clínica): +10 % de clientes que repiten.', 'Los avisos comerciales exigen el consentimiento del cliente (RGPD).');
  Sv('t1_tarjeta_fidelidad', 'Club de fidelización familiar (5 % en puntos)', 3, 5000, 10, 8000, ['svc:t1_ficha_cliente'], { recur: 1.08, fans: 1.1 }, 'Tarjeta familiar que acumula el 5 % de cada compra para la siguiente (descuento diferido, margen 95 %; se apunta el 60 % de los clientes): +8 % recurrencia y +10 % de clientes fieles nuevos.', 'SRV_17: propio de una óptica de exposición abierta.');
  Sv('t1_calendario_promocional', 'Calendario promocional', 1, 3000, 5, 5000, [], { unlock: ['rebajas_estacionales', 'black_friday', 'vuelta_al_cole'] }, 'Planificar las promociones del año dentro de la ley: rebajas en sus fechas, precio anterior a la vista, condiciones por escrito y hojas de reclamaciones anunciadas. Desbloquea Rebajas, Vuelta al cole y Black Friday y deja la cartelería en regla ante Consumo.', 'Ley de ordenación del comercio minorista: el precio anterior es el más bajo de los últimos 30 días.');
  // Tier 2 (local comercial)
  Sv('t2_venta_consultiva', 'Venta consultiva por necesidades', 2, 25000, 20, 10000, ['lvl2', 'svc:t1_acogida'], { ticket: 1.08, nps: 5 }, 'Preguntar por pantallas, conducción y deporte, y presentar primero las lentes y después la montura: +8 % ticket, +5 NPS.', 'La escalera de valor de la mesa de venta: suplementos de lente, segunda gafa, seguro y financiación.');
  Sv('t2_visagismo', 'Asesoramiento por morfología facial (visagismo)', 2, 20000, 15, 9000, ['svc:t2_venta_consultiva'], { conv: 1.05, ticket: 1.03, nps: 2 }, 'Forma del rostro, colorimetría de piel y pelo, y proporción de la montura con la distancia pupilar: +5 % conversión, +3 % ticket y menos devoluciones.', 'MKT_37: el visagismo con cita sube un 30 % el ticket de montura.');
  Sv('t2_tratamientos', 'Suplementos de lente: antirreflejante, filtro azul, fotocromático y alto índice', 2, 20000, 20, 9000, ['lvl2'], { ticketAdd: 12, marginPp: 3, partsBonus: ['antirreflejante', 'fotocromaticas', 'filtroazul'] }, 'Explicados como beneficio y con el precio claro: antirreflejante hidrófobo 35-70 € (lo acepta el 76 %), filtro azul-violeta 25-50 €, fotocromático 75-140 € y alto índice 45-160 € (márgenes del 74-86 %). +12 € de ticket (+3 € por cada tratamiento investigado en el taller), +3 pts de margen.', 'SRV_02-05. Prohibido anunciar que el filtro azul previene o cura enfermedades.');
  Sv('t2_sol_graduada', 'Sol graduada polarizada o clip solar como segunda gafa', 2, 15000, 15, 8000, ['svc:t1_segundo_par', 'zone:sol'], { p2: 0.05, p2Price: 0.15, ticket: 1.02 }, 'La segunda gafa es de sol graduada polarizada (suplemento 60-110 €) o un clip solar magnético a medida (25-45 €): +5 pts de segunda gafa y una segunda gafa más cara (+15 %).', 'SRV_06 y SRV_08: sol graduada 22 % de adopción, clip 24 %.');
  Sv('t2_garantia_rotura', 'Seguro de rotura a 2 años y garantía de adaptación a progresivos (90 días)', 2, 15000, 15, 8000, ['lvl2'], { warranty: 0.42, recur: 1.05, nps: 2 }, 'Seguro de rotura de dos años por 18-35 € (cubre el 70-80 % de la reposición; margen 90 %, lo contrata el 42 %) y cambio gratuito de los progresivos si no hay adaptación en 90 días: +5 % recurrencia, +2 NPS.', 'SRV_11 y SRV_13.');
  Sv('t2_financiacion', 'Financiación sin intereses (3 a 12 meses)', 2, 30000, 25, 10000, ['lvl2', 'year9'], { ticket: 1.06, conv: 1.03, financed: 0.25, unlock: ['sin_pagar'] }, '«Págalo en 12 meses» en presupuestos de más de 300 € (progresivos y audífonos): +6 % ticket, +3 % conversión; se financia uno de cada cuatro tickets y el coste financiero (2,5-4,5 %, de media 3,5 %) lo asume la óptica. Desbloquea «Te vas sin pagar».', 'SRV_14: la usa el 45 % de los tickets de más de 300 €.');
  Sv('t2_lc_reposicion', 'Venta y reposición de lentes de contacto', 2, 15000, 15, 8000, ['lvl2', 'zone:lentes_contacto_reposicion'], { lcEnable: true }, 'Cajas de lentillas, líquidos, lágrima artificial sin conservantes y toallitas palpebrales para quien ya las usa: abre el flujo recurrente de lentillas (25 €/mes por usuario, margen 30 %).', 'Contactología: 8-15 % de la facturación, margen estrecho y cuatro visitas al año por usuario.');
  Sv('t2_suscripcion_lc', 'Suscripción de lentillas (pack semestral con envío, −5 %)', 2, 25000, 25, 10000, ['svc:t2_lc_reposicion', 'year6'], { subs: true, lcNew: 1.2, lcPrice: 0.95 }, 'Pack de inicio o suscripción semestral de lentillas y líquidos (95-210 €) con envío a casa: el abandono baja del 25 al 12 % anual y entran un 20 % más de usuarios, a cambio de un 5 % de descuento. Solo se envía reposición de una adaptación vigente.', 'SRV_09 y MKT_43: la primera adaptación siempre es presencial.');
  Sv('t2_cita_online', 'Cita previa en línea y recordatorios por SMS o mensajería', 2, 15000, 15, 8000, ['lvl2', 'year10'], { traffic: 1.04, capture: 0.03, nps: 2 }, 'Agenda web sincronizada con el gabinete y confirmación por SMS: +4 % visitas, +3 pts de captura y menos citas perdidas.', 'SRV_16: la usa el 40 % de los clientes.');
  Sv('t2_crm', 'Fichero de clientes y aviso de revisión anual', 2, 30000, 30, 12000, ['svc:t1_ficha_cliente', 'lvl2'], { recall: 0.75, recur: 1.2, monthly: 300 }, 'Factura y guía de cuidado, seguimiento a los seis meses y aviso de revisión anual a quien firmó el consentimiento comercial: la tasa de retorno sube del 55 al 75 % y la recurrencia un 20 %. Cuota 300 €/mes.', 'MKT_15: datos de salud (art. 9 RGPD), consentimiento expreso y separado de la historia clínica.');
  Sv('t2_colectivos', 'Convenios con empresas y colectivos (−10/−20 %)', 2, 20000, 15, 8000, ['lvl2'], { traffic: 1.08, marginPp: -3 }, 'Carné joven, asociaciones, clubes deportivos y pymes del polígono: gafas de protección laboral EN 166 graduadas (95-190 €) y gafas de natación graduadas. +8 % visitas, −3 pts de margen.', 'SRV_20, SRV_21 y MKT_33: facturación a la empresa.');
  Sv('t2_mutuas', 'Concierto con aseguradoras de salud (−15/−30 %)', 2, 40000, 30, 12000, ['lvl3', 'svc:t2_colectivos'], { traffic: 1.10, capture: 0.05, marginPp: -5 }, 'Entrar en el cuadro de ópticas concertadas de las aseguradoras: +10 % visitas, +5 pts de captura, −5 pts de margen por los precios baremados. Riesgo: que la aseguradora rompa el concierto.', 'MKT_34: +20 % de pacientes del cuadro, con descuento obligatorio del 15-30 %.');
  Sv('t2_plan_kids', 'Rincón infantil y garantía de graduación infantil (1 año)', 2, 20000, 15, 8000, ['zone:infantil'], { traffic: 1.03, kids: 1.2, recur: 1.05, young: 1.2 }, 'Si en un año sube la miopía, lentes nuevas gratis o al 50 % (15-25 €, margen 85 %; la contratan dos de cada tres familias): +3 % visitas, +20 % tickets infantiles, +5 % recurrencia.', 'SRV_12.');
  Sv('t2_control_stock', 'Programa de gestión de óptica: stock, rotación y tarifas', 2, 12000, 10, 7000, ['lvl2'], { stockObs: 0.5, monthly: 150 }, 'Aviso de las monturas con más de 180 días en exposición y liquidación programada: la obsolescencia del stock se reduce a la mitad. Cuota 150 €/mes.', 'Rotación real de monturas: 1,1-1,4 vueltas al año en una óptica de barrio, 2,1-2,8 en una tienda insignia.');
  // Tier 3 (óptica con gabinete y exposición abierta)
  Sv('t3_handoff', 'Paso del gabinete a la mesa de venta con recomendación del óptico', 3, 40000, 40, 12000, ['gab', 'svc:t2_venta_consultiva'], { capture: 0.12, p2: 0.03, ticket: 1.03 }, 'El óptico recomienda gafa de interior y de exterior y lo repite al presentar al asesor: +12 pts de captura examen→venta, +3 pts de segunda gafa, +3 % ticket.', 'Conversión real del gabinete a venta: 60-70 % en barrio, 72-82 % en las grandes.');
  Sv('t3_progresivos_premium', 'Torre de videocentrado y progresivos personalizados', 3, 35000, 50, 14000, ['svc:t2_venta_consultiva', 'part:progresivos', 'year15'], { ticket: 1.10, mature: 1.05, nps: 2 }, 'Torre de videocentrado 3D (7.500-18.000 €) que mide al décimo de milímetro distancia al vértice, ángulo pantoscópico y alturas, y enseña al miope fotos comparativas para elegir montura sin gafas. Con garantía de adaptación de 90 días, del progresivo de 400 € se pasa al de 600 €: +10 % ticket, +5 % público sénior.', 'EQ_TIE_01: se populariza hacia 2009 y sube un 22 % el ticket de los progresivos.');
  Sv('t3_taller_1h', 'Gafas en 1 hora y cristales nuevos en tu montura', 3, 60000, 40, 12000, ['zone:taller', 'tecnico'], { conv: 1.06, nps: 10, ticket: 0.97 }, 'Con stock de lentes y biseladora, las monofocales salen en una hora (recargo exprés 5 €). También montamos cristales nuevos en la montura del cliente (30-290 € según la lente; lo pide el 18 %) con descargo firmado por si el acetato reseco se parte en el ventilete. +6 % conversión, +10 NPS, −3 % ticket (no se vende montura).', 'SRV_07 y SRV_36.');
  Sv('t3_nps_mystery', 'Encuestas de satisfacción y cliente misterioso', 3, 30000, 25, 10000, ['lvl3'], { nps: 8, monthly: 400 }, 'Encuesta tras cada compra y cliente misterioso trimestral: +8 NPS y un panel de calidad por empleado. Cuota 400 €/mes.', 'Las cadenas miden la recomendación después de cada venta.');
  Sv('t3_incentivos', 'Plan de objetivos e incentivos del equipo', 3, 25000, 20, 9000, ['team2'], { productivity: 1.1, p2: 0.03 }, 'Objetivos semanales por persona y reunión de los lunes: +10 % productividad, +3 pts de segunda gafa. Desbloquea la plataforma de premios.', 'PUE_05: el asesor cobra incentivos del 1-3 % sobre ventas.');
  Sv('t3_marca_propia', 'Marca propia en tienda (tus colecciones en tus expositores)', 3, 0, 20, 8000, ['own2'], { ownBoost: 1.5, fans: 1.1, unlock: ['segundo_par_1eur', 'pack_2x_graduadas'] }, 'Tus colecciones ocupan la pared principal: el surtido propio pesa un 50 % más (margen 80-88 % frente al 55-65 % de las firmas), +10 % fieles. Desbloquea «Segunda gafa por 1 € más» y «Precio cerrado».', 'Monturas de marca propia: 80-88 % de margen.');
  Sv('t3_boutique', 'Espacio de firmas de autor', 3, 60000, 40, 12000, ['res:PremiumLine', 'zone:lujo'], { premium: 0.04, mature: 1.1 }, 'Firmas de autor con cita previa y presentaciones de colección: +4 % de tickets premium (×3), es decir, +8 % de ticket medio; +10 % público sénior.', 'MKT_36: una presentación de colección vende 15-35 gafas de gama alta en una tarde.');
  Sv('t3_audiologia', 'Audiología protésica (centro auditivo)', 3, 120000, 60, 15000, ['lvl3', 'role:audioprotesista', 'zone:audiologia'], { services: 2500, mature: 1.2 }, 'Audiometría y videotoscopia (12 €) en cabina de menos de 40 dB, audífonos de 1.500-3.400 € con 30 días de prueba (margen 74 %), pack anual de pilas y filtros (35-90 €) y tapones a medida (45-95 €): +2.500 €/semana y +20 % de público sénior. Sostiene los meses flojos de febrero y noviembre.', 'SRV_22-24: en una óptica madura, dos audífonos al mes pagan el alquiler.');
  Sv('t3_servicios_pago', 'Pruebas clínicas de pago (tonometría, retinografía, OCT)', 3, 20000, 20, 8000, ['res:Retinografo'], { services: 900, nps: 3 }, 'Carta de honorarios a la vista: tonometría 10 €, retinografía 25-40 €, OCT 45-75 €, estudio de glaucoma 45 €, con informe de derivación al oftalmólogo (el óptico criba, no diagnostica). +900 €/semana con margen del 90 %, +3 NPS.', 'Honorarios de referencia de los colegios: 10-75 € por prueba.');
  Sv('t3_lc_especializada', 'Contactología especializada (ortoqueratología, esclerales, control de miopía)', 3, 45000, 40, 12000, ['res:Lentillas', 'zone:contactologia'], { lcNew: 1.3, lcChurn: 0.7, services: 600 }, 'Rígidas permeables (adaptación 45 € más las lentes), esclerales (150-280 €), ortoqueratología nocturna (250-450 €) y control de miopía con revisiones de 60-90 €: +30 % usuarios nuevos de lentillas, −30 % abandono, +600 €/semana.', 'Honorarios de adaptación del informe de oficio.');
  // Tier 4 (insignia)
  Sv('t4_omnicanal', 'Reserva en línea, recogida en tienda y probador virtual web', 4, 100000, 80, 15000, ['web', 'lvl3'], { traffic: 1.15, conv: 1.03, upt: 0.05 }, 'Reservar la montura desde casa y recogerla en tienda: +15 % visitas, +3 % conversión y el 40 % compra algo más al recoger. La gafa graduada sigue pasando por el óptico.', 'MKT_45: el probador virtual duplica el tiempo de visita en la web.');
  Sv('t4_bi', 'Cuadro de mando de tienda', 4, 60000, 50, 12000, ['svc:t2_control_stock', 'svc:t3_nps_mystery'], { conv: 1.03, ticket: 1.03, productivity: 1.05 }, 'Alertas de captura, segunda gafa, espera y rotación por empleado y familia de producto: +3 % en conversión y ticket, +5 % productividad.', 'Indicadores reales: conversión, ticket por familia, rotación, ventas por m² y margen ponderado.');
  Sv('t4_academy', 'Escuela interna de ventas', 4, 150000, 100, 20000, ['lvl4', 'staff6'], { productivity: 1.1, academy: true }, 'Formación en línea y presencial para toda la plantilla: +10 % productividad y todo el equipo de tienda cuenta como formado en venta consultiva.', 'Las grandes cadenas forman a sus asesores con escuela propia.');
  Sv('t4_estilismo', 'Sala de visagismo con cita (asesoría de imagen)', 4, 80000, 60, 12000, ['svc:t2_visagismo', 'svc:t3_boutique'], { premium: 0.06, productivity: 0.95 }, 'Citas de 45 minutos con estilista en una sala reservada: 6 % de tickets de estilismo (×2,5), +9 % de ticket medio; cada cita ocupa más tiempo (−5 % productividad).', 'MKT_37: +30 % de ticket de montura con estilismo.');
  Sv('t4_vision_plan', 'Plan renove: gafas y salud visual por cuota mensual', 4, 120000, 80, 15000, ['svc:t2_crm', 'svc:t2_garantia_rotura', 'gab', 'lvl3'], { recall: 0.9, recur: 1.15, members: true }, 'Cuota de 20 €/mes con gafa nueva cada dos años, revisión anual, seguro de rotura y lentillas −10 %: se hace socio el 14 % de los clientes fieles (tope 6.000 €/semana, margen 74 %), tasa de retorno 90 %.', 'SRV_15: 15-35 €/mes, margen 74 %, adopción 14 %.');
  Sv('t4_segunda_tienda', 'Segunda óptica con nuestra enseña', 4, 250000, 100, 20000, ['lvl4', 'group'], { incomeMult: 1.5, monthly: 15000 }, 'Una segunda óptica con nuestro nombre al otro lado de la ciudad: ×1,5 ingresos de tienda, 15.000 €/mes de costes fijos y hace falta equipo para las dos (con menos de 4 personas en tienda rinde ×1,2).', 'Abrir una óptica cuesta 100-150 k€ y se recupera en 3-5 años.');

  /* Promociones (12). type 'camp' = campaña de 4 semanas (coste de activación, erosiona la notoriedad); 'policy' = política permanente que se activa y desactiva.
     fx como los servicios + sunTraffic (×), p2Mult, p2Price, weekly (€/sem de juego), month (mes natural recomendado: ×1,15 de efecto). brand = erosión de notoriedad al activar. */
  const PROMOS = [
    { id: 'segundo_par_50', type: 'policy', name: 'Segunda gafa −50 % el mismo día (−20 % después)', cost: 0, req: ['svc:t1_segundo_par'], fx: { p2Mult: 1.8, marginPp: -2 }, desc: 'La ventana de un día empuja la decisión: tasa de segunda gafa ×1,8 con la segunda gafa al 40 % de margen (−2 pts de margen global).', ref: 'SRV_01: segunda gafa al 50 % o por tarifa plana, la acepta el 38 %. Alargar la oferta a 30 días le quita la urgencia.' },
    { id: 'segundo_par_1eur', type: 'camp', name: 'Segunda gafa por 1 € más (con montura de marca propia)', cost: 5000, req: ['svc:t3_marca_propia', 'lvl2', 'year8'], brand: 2, fx: { conv: 1.2, upt: 0.4, ticket: 1.1, marginPp: -12 }, desc: 'Cuatro semanas de «la segunda por 1 € más» con montura de marca propia: +20 % conversión, +0,4 unidades por ticket, +10 % ticket, −12 pts de margen, −2 notoriedad.', ref: 'La promoción con la que las cadenas de franquicia disparan las visitas un 45 % comprimiendo el margen.' },
    { id: 'pack_2x_graduadas', type: 'policy', name: 'Precio cerrado: montura propia y cristales antirreflejantes por 79 €', cost: 3000, req: ['svc:t3_marca_propia'], brand: 2, fx: { traffic: 1.2, ticket: 0.85, marginPp: -5, nps: -2 }, desc: 'Gafa completa a precio cerrado con montura de marca propia (cuesta 3-6 €) y cristales de stock con antirreflejante. El cartel debe decir los límites incluidos (esfera hasta ±4,00 D y cilindro hasta ±2,00 D). +20 % visitas, −15 % ticket, −5 pts de margen, −2 NPS (imagen de descuento) y −2 notoriedad al activarlo.', ref: 'MKT_48: competir con las cadenas de descuento sin bajar del 80 % de margen en la montura.' },
    { id: 'pack_2x_sol', type: 'camp', name: 'Pack 2 gafas de sol (39/59/69 €)', cost: 2000, req: ['zone:sol'], brand: 1, months: [5, 6, 7], fx: { sunTraffic: 1.4, marginPp: -6 }, desc: 'Dos de sol por el precio de una buena, todas con marcado CE y categoría de filtro: +40 % de tráfico de sol, −6 pts de margen. Rinde más de mayo a julio.', ref: 'MKT_01 y MKT_23: el «2x1 en gafas de sol» de toda la vida; las de sol son EPI, no producto sanitario.' },
    { id: 'rebajas_estacionales', type: 'camp', name: 'Rebajas de enero y julio', cost: 2000, req: ['svc:t1_calendario_promocional'], brand: 1, months: [1, 2, 7, 8], fx: { traffic: 1.1, marginPp: -10, liquidate: true }, desc: 'Liquidación de monturas de temporadas pasadas: +10 % visitas, −10 pts de margen y sale el stock viejo (recupera parte de la obsolescencia). Lo rebajado tiene que haber estado a la venta al menos un mes.', ref: 'MKT_26: libera caja y sube la rotación medio punto.' },
    { id: 'mes_progresivos', type: 'camp', name: 'Campaña de progresivos (−50 % en la segunda lente)', cost: 4000, req: ['part:progresivos'], brand: 1, months: [9, 10, 11], fx: { ticket: 1.06, mature: 1.15, marginPp: -4 }, desc: 'Otoño, el pico clínico del año: +6 % ticket, +15 % público sénior, −4 pts de margen.', ref: 'Los progresivos son el 35 % de las gafas y más del 55 % de la facturación de óptica.' },
    { id: 'descuento_sol_40', type: 'camp', name: 'Hasta −40 % en sol (salvo firmas de lujo)', cost: 2000, req: ['zone:sol'], brand: 1, months: [6, 7, 8], fx: { sunTraffic: 1.4, sunMarginPp: -15 }, desc: '+40 % de tráfico de sol, −15 pts de margen en sol (ponderado por el peso del sol en la tienda).', ref: 'De mayo a agosto se vende el 65 % de las gafas de sol del año.' },
    { id: 'black_friday', type: 'camp', name: 'Black Friday', cost: 3000, req: ['svc:t1_calendario_promocional', 'year18'], brand: 2, months: [11], fx: { traffic: 1.5, marginPp: -12 }, desc: 'Tráfico récord y márgenes mínimos: +50 % visitas, −12 pts de margen, −2 notoriedad. El precio tachado tiene que ser el más bajo de los últimos 30 días. Solo tiene sentido en noviembre.', ref: 'MKT_24: multiplica ×2,2 las ventas de esa semana con un −12 % de margen.' },
    { id: 'vuelta_al_cole', type: 'camp', name: 'Vuelta al cole: revisión y gafa infantil', cost: 2000, req: ['zone:infantil'], brand: 0, months: [9], fx: { traffic: 1.04, kids: 1.5, young: 1.1 }, desc: 'Revisión visual y montura infantil con descuento en septiembre: +4 % visitas, +50 % tickets infantiles.', ref: 'MKT_22: +45 % de facturación en gafa infantil; la publicidad a menores tiene que ser veraz.' },
    { id: 'garantia_satisfaccion_30d', type: 'policy', name: 'Garantía de satisfacción 30 días', cost: 1000, req: ['lvl2'], fx: { conv: 1.05, nps: 3, marginPp: -1 }, desc: 'Si la montura no convence, se cambia o se devuelve el dinero en 30 días: +5 % conversión, +3 NPS, −1 pt de margen por devoluciones.', ref: 'Garantía habitual de las ópticas que compiten por servicio.' },
    { id: 'prueba_gratis_lentillas', type: 'policy', name: 'Prueba gratuita de lentillas', cost: 500, req: ['res:Lentillas'], fx: { lcNew: 1.3, weekly: 150 }, desc: 'Un par de prueba tras la adaptación en gabinete: +30 % de usuarios nuevos de lentillas, 150 €/semana en muestras.', ref: 'La adaptación inicial es presencial y la hace un óptico-optometrista.' },
    { id: 'sin_pagar', type: 'camp', name: '«Te vas sin pagar»: financiación al 0 % de 3 a 12 meses', cost: 4000, req: ['svc:t2_financiacion'], brand: 1, fx: { conv: 1.10, financed: 0.4 }, desc: 'Cuatro semanas de financiación agresiva: +10 % conversión, el 40 % de los tickets se financia (3,5 % de coste para la óptica).', ref: 'SRV_14: el coste financiero lo asume la óptica.' }
  ];
  const PROMO_BY = {}; for (const p of PROMOS) PROMO_BY[p.id] = p;

  /* Formación comercial (9) → DATA.TRAINING con skill. Efecto en la tienda cuando el formado está asignado a ella. */
  const TRAIN = [
    { id: 'f_venta_consultiva', name: 'Curso de venta consultiva en óptica', cost: 30000, pointsCost: 8, duration: 15000, basePoints: 9, tF: 0.1, dF: 0.3, rF: 0.1, sF: 1, maxP: 600, level: 2, skill: 'ventas', fx: 'ticket +5 % (por asesor formado)' },
    { id: 'f_visagismo', name: 'Curso de visagismo y colorimetría', cost: 20000, pointsCost: 6, duration: 12000, basePoints: 8, tF: 0.1, dF: 1, rF: 0.1, sF: 0.3, maxP: 600, level: 2, skill: 'visagismo', fx: 'conversión +6 %' },
    { id: 'f_progresivos_fabricante', name: 'Certificación del fabricante en progresivos personalizados', cost: 5000, pointsCost: 4, duration: 8000, basePoints: 6, tF: 1, dF: 0.1, rF: 0.2, sF: 0.1, maxP: 500, level: 2, skill: 'progresivos', fx: 'ticket +3 % (sénior)' },
    { id: 'f_roleplay_segundo_par', name: 'Ensayo de venta: gafa completa y segunda gafa', cost: 10000, pointsCost: 4, duration: 6000, basePoints: 6, tF: 0.1, dF: 0.3, rF: 0.1, sF: 1, maxP: 500, level: 2, skill: 'segundo_par', fx: 'segunda gafa +4 pts, captura +4 pts' },
    { id: 'f_contactologia_comercial', name: 'Contactología comercial y suscripción', cost: 25000, pointsCost: 8, duration: 12000, basePoints: 8, tF: 0.6, dF: 0.1, rF: 0.6, sF: 0.3, maxP: 600, level: 3, skill: 'lc_comercial', fx: 'usuarios de lentillas +10 %, abandono −10 %' },
    { id: 'f_gestion_tienda_kpis', name: 'Gestión de tienda por indicadores (para encargados)', cost: 37000, pointsCost: 10, duration: 15000, basePoints: 9, tF: 0.2, dF: 0.2, rF: 0.8, sF: 0.8, maxP: 700, level: 3, skill: 'gestion_tienda', fx: 'productividad +5 %, encargado (evita el −10 % con 4+ personas)' },
    { id: 'f_visual_merchandising', name: 'Escaparatismo y exposición comercial de óptica', cost: 25000, pointsCost: 8, duration: 12000, basePoints: 8, tF: 0.1, dF: 1, rF: 0.1, sF: 0.2, maxP: 600, level: 3, skill: 'merchandising', fx: 'visitas +5 %, escaparate temático sin cuota' },
    { id: 'f_atencion_conflictos', name: 'Gestión de reclamaciones y devoluciones', cost: 12000, pointsCost: 4, duration: 8000, basePoints: 6, tF: 0.1, dF: 0.2, rF: 0.3, sF: 1, maxP: 500, level: 2, skill: 'reclamaciones', fx: 'NPS +4, devoluciones −10 %' },
    { id: 'f_audiologia', name: 'Técnico superior en audiología protésica (ciclo de 2.000 h)', cost: 50000, pointsCost: 15, duration: 20000, basePoints: 10, tF: 0.8, dF: 0.1, rF: 0.8, sF: 0.1, maxP: 700, level: 3, skill: 'audiologia', fx: 'da la titulación que exige la cabina audiométrica (cuenta como audioprotesista)' }
  ];
  const SKILL_NAME = { ventas: 'venta consultiva', visagismo: 'visagismo', progresivos: 'progresivos', segundo_par: 'segunda gafa', lc_comercial: 'lentillas', gestion_tienda: 'gestión por indicadores', merchandising: 'escaparatismo', reclamaciones: 'reclamaciones', audiologia: 'audiología' };

  /* Incentivos (5 esquemas). cost: fijo €/mes · perHead €/persona/mes · pctSales cuota sobre ventas de tienda (coste variable semanal) */
  const INCENTIVES = [
    { id: 'sin_incentivos', name: 'Sueldo fijo de convenio', cost: 0, perHead: 0, pctSales: 0, fx: {}, desc: 'Sin variable. Nadie se mata por vender una segunda gafa, pero tampoco agobia al cliente.' },
    { id: 'comision_ventas', name: 'Comisión del 2 % sobre ventas', cost: 0, perHead: 0, pctSales: 0.02, fx: { productivity: 1.08, upt: 0.05, nps: -2 }, desc: 'Lo habitual en el sector es un 1-3 % para el asesor: +8 % productividad, +0,05 unidades por ticket, −2 NPS (riesgo de sobreventa). Cuesta el 2 % de las ventas.' },
    { id: 'objetivos_equipo', name: 'Bonus trimestral por objetivos de tienda', cost: 0, perHead: 100, pctSales: 0, fx: { productivity: 1.06, nps: 1 }, desc: '300 € por persona y trimestre si se cumple el objetivo: +6 % productividad, equipo cohesionado (+1 NPS).' },
    { id: 'cuota_segundo_par', name: 'Bono por cuota mensual de segunda gafa', cost: 0, perHead: 50, pctSales: 0, fx: { p2: 0.03 }, desc: '50 € al mes por persona que cumple su cuota de segundas gafas: +3 pts de tasa de segunda gafa.' },
    { id: 'plataforma_premios', name: 'Plataforma de incentivos con premios y clasificación', cost: 200, setup: 5000, perHead: 0, pctSales: 0, req: ['svc:t3_incentivos'], fx: { productivity: 1.10, p2: 0.02 }, desc: 'Clasificación semanal, puntos y viajes: +10 % productividad, +2 pts de segunda gafa. 5.000 € de alta y 200 €/mes. Requiere el plan de incentivos.' }
  ];
  const INC_BY = {}; for (const i of INCENTIVES) INC_BY[i.id] = i;
  /* Horarios (3): tráfico, capacidad y pluses sobre los salarios del personal de tienda; el centro comercial encarece el alquiler. */
  const SCHEDULES = [
    { id: 'partido', name: 'Horario partido de calle (10-14 / 17-20:30, sábado mañana)', traffic: 1, cap: 1, salaryPlus: 0, rentPlus: 0, desc: '50 horas de apertura, dentro de la jornada de convenio. Sin pluses.' },
    { id: 'continuo', name: 'Horario continuo (10-21)', traffic: 1.12, cap: 1.15, salaryPlus: 0.25, rentPlus: 0, req: ['team2'], desc: '66 horas: +12 % visitas, +15 % capacidad de atención; turnos y pluses del 25 % sobre los salarios del personal de tienda. Requiere 2 personas en tienda.' },
    { id: 'centro_comercial', name: 'Centro comercial (10-22, domingos y festivos)', traffic: 1.3, cap: 1.3, salaryPlus: 0.5, rentPlus: 0.4, req: ['lvl2', 'team2'], desc: '84 horas con domingos: +30 % visitas y capacidad; turnos, plus por domingo o festivo trabajado y recargo de las tardes del 24 y el 31 (pluses del 50 %) y el alquiler sube un 40 % (sobre los gastos fijos del local).' }
  ];
  const SCH_BY = {}; for (const h of SCHEDULES) SCH_BY[h.id] = h;

  /* KPIs semanales (11 de los indicadores reales; las ventas por empleado se calculan en s.kpis pero se muestran en Cuentas) con base/objetivo/excelente;
     ticket y visitas se escalan por nivel. Umbrales del informe de oficio (§6): margen ponderado 68-78 %, conversión del gabinete 60-82 %, rotación 1,1-2,8. */
  const KPIS = [
    { id: 'visits', name: 'Visitas a tienda', base: 2000, obj: 2600, exc: 4500, fmt: v => U.num(v), scale: 'visits' },
    { id: 'conv', name: 'Conversión visita→compra', base: 0.10, obj: 0.15, exc: 0.20, fmt: pct1 },
    { id: 'capture', name: 'Captura examen→venta', base: 0.60, obj: 0.72, exc: 0.82, fmt: pct, needsGab: true },
    { id: 'ticket', name: 'Ticket medio', base: 210, obj: 260, exc: 350, fmt: v => money(v), scale: 'ticket' },
    { id: 'upt', name: 'Unidades por ticket', base: 1.2, obj: 1.4, exc: 1.7, fmt: v => v.toFixed(2) },
    { id: 'p2', name: 'Tasa de segunda gafa', base: 0.10, obj: 0.15, exc: 0.38, fmt: pct },
    { id: 'attention', name: 'Clientes atendidos (sin esperas)', base: 0.85, obj: 0.95, exc: 1.0, fmt: pct },
    { id: 'nps', name: 'NPS', base: 30, obj: 50, exc: 70, fmt: v => Math.round(v) },
    { id: 'margin', name: 'Margen bruto ponderado', base: 0.62, obj: 0.68, exc: 0.74, fmt: pct },
    { id: 'rotation', name: 'Rotación de monturas (vueltas/año)', base: 1.1, obj: 1.5, exc: 2.1, fmt: v => v.toFixed(1) },
    { id: 'lcRetention', name: 'Retención anual de usuarios de lentillas', base: 0.75, obj: 0.88, exc: 0.95, fmt: pct }
  ];

  /* Noticias programadas (año/mes/semana) → DATA.NEWS si la fecha está libre */
  const NEWS = [
    { date: '2/3/2', title: 'La segunda gafa', text: 'Las revistas del sector hablan de «multiposesión»: una gafa para cada momento. Investigar la oferta de segunda gafa permitiría vender más de un par por cliente.' },
    { date: '3/6/2', title: 'Rebajas en la óptica', text: 'Las ópticas se suman al periodo oficial de rebajas: una buena promoción puede subir las ventas entre un 5 y un 15 %, si no se come el margen. Lo rebajado tiene que haber estado a la venta antes.' },
    { date: '5/9/2', title: 'Grupos de compra', text: 'Las cadenas ya suman casi la mitad del mercado. Las ópticas independientes se agrupan en centrales de compra para conseguir rappels del 35-55 % en lentes.' },
    { date: '6/2/2', title: 'Lentillas por suscripción', text: 'Un fabricante lanza el envío semestral de lentillas con cargo periódico. Las ópticas que lo ofrecen retienen a sus usuarios frente a las tiendas en línea.' },
    { date: '8/5/2', title: 'Guerra de precios: dos por uno', text: 'Una gran cadena anuncia la segunda gafa por un euro más. El sector teme por los márgenes: la gafa completa ya cuesta de media algo más de 200 €.' },
    { date: '9/1/2', title: 'Te vas sin pagar', text: 'La financiación sin intereses a doce meses llega a las ópticas como argumento de cierre en progresivos y audífonos. El coste financiero lo paga la óptica.' },
    { date: '12/4/2', title: 'Faltan ópticos', text: 'La federación del sector advierte de un déficit estructural de ópticos-optometristas: los salarios suben y las vacantes tardan meses en cubrirse.', flag: 'faltanOpticos' },
    { date: '14/6/2', title: 'Probador virtual', text: 'Las webs de las cadenas permiten probarse las gafas desde casa: quien lo usa tiene 2,5 veces más probabilidad de pedir cita en tienda.' },
    { date: '15/3/2', title: 'La torre de videocentrado', text: 'Los fabricantes de lentes llevan a las ópticas torres digitales que miden al décimo de milímetro los parámetros del progresivo personalizado. Las primeras en tenerlas suben un 22 % el ticket de progresivos.' },
    { date: '16/10/2', title: 'Audiología en la óptica', text: 'Las cadenas abren centros auditivos dentro de sus ópticas, con cabina de menos de 40 dB: la audiología crece más de un 25 % al año.' },
    { date: '18/9/2', title: 'Medición en oído real', text: 'Los centros auditivos verifican con una sonda en el conducto la ganancia real del audífono: las devoluciones tras el mes de prueba se reducen a la mitad.' },
    { date: '19/11/2', title: 'Black Friday óptico', text: 'La semana de descuentos llega a la óptica con campañas de televisión. Tráfico récord, márgenes mínimos y Consumo vigilando que el precio tachado sea el más bajo de los últimos 30 días.' },
    { date: '21/3/2', title: 'Crisis de la mutua', text: 'Una gran aseguradora de salud abandona un concierto masivo: cientos de miles de asegurados buscan dónde graduarse la vista.' }
  ];

  /* =====================================================================
     2. REGISTRO EN DATA.* (al cargar el fichero, antes de Modules.register)
     ===================================================================== */
  const RES = [];
  for (const sv of SERVICES) {
    if (DATA.RESEARCH.some(r => r.id === sv.id)) continue;
    const it = { id: sv.id, name: sv.name, category: 'Tienda', pointsCost: sv.rp, duration: sv.dur, cost: sv.cost, tier: sv.tier, desc: sv.desc,
      req: co => { const s = co.modules && co.modules[ID]; if (!s || dupOf(sv.id)) return false; if (sv.tier >= 3 && co.level < 3) return false; if (sv.tier === 4 && co.level < 4 && sv.req.indexOf('lvl3') < 0) return false; return !whyNot(co, s, sv.req); } };
    DATA.RESEARCH.push(it); RES.push(it);
  }
  for (const t of TRAIN) if (!DATA.TRAINING.some(x => x.id === t.id)) DATA.TRAINING.push({ id: t.id, name: t.name, cost: t.cost, pointsCost: t.pointsCost, duration: t.duration, basePoints: t.basePoints, tF: t.tF, dF: t.dF, rF: t.rF, sF: t.sF, maxP: t.maxP, level: t.level, skill: t.skill });
  if (Array.isArray(DATA.NEWS)) for (const n of NEWS) if (!DATA.NEWS.some(x => x.date === n.date)) DATA.NEWS.push(n);

  /* =====================================================================
     3. ESTADO
     ===================================================================== */
  const blankMonth = () => ({ income: 0, cost: 0, net: 0, tickets: 0, visits: 0, lc: 0, services: 0 });
  function defaults() {
    return { v: 1, level: 1, visitsWeek: 0, conversion: 0, ticket: 0, salesWeek: 0, kpis: {},
      display: 0, zones: [], stockValue: 0, incentive: 'sin_incentivos', schedule: 'partido',
      promos: [], policies: [], promoLog: [], lc: { users: 0, subs: false }, nps: K.NPS_BASE, effects: [],
      hist: [], months: [], month: blankMonth(), fired: {}, lastEventW: -99, week: 0, fanAcc: 0,
      flags: {}, log: [], stats: { income: 0, cost: 0, tickets: 0, invested: 0, promos: 0, events: 0 } };
  }
  function init(co) {
    co.modules = co.modules || {};
    const d = defaults(); const old = (co.modules[ID] && typeof co.modules[ID] === 'object' && !Array.isArray(co.modules[ID])) ? co.modules[ID] : {};
    const s = co.modules[ID] = Object.assign(d, old);
    for (const k of ['zones', 'promos', 'policies', 'promoLog', 'hist', 'months', 'effects', 'log']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['lc', 'month', 'fired', 'flags', 'stats', 'kpis']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = defaults()[k];
    s.lc = Object.assign({ users: 0, subs: false }, s.lc); s.lc.users = Math.max(0, +s.lc.users || 0); s.lc.subs = !!s.lc.subs;
    s.month = Object.assign(blankMonth(), s.month); s.stats = Object.assign(defaults().stats, s.stats);
    s.zones = s.zones.filter((id, i, a) => ZONE_BY[id] && a.indexOf(id) === i);
    s.policies = s.policies.filter((id, i, a) => PROMO_BY[id] && PROMO_BY[id].type === 'policy' && a.indexOf(id) === i);
    s.promos = s.promos.filter(p => p && PROMO_BY[p.id] && typeof p.until === 'number');
    s.promoLog = s.promoLog.filter(p => p && PROMO_BY[p.id] && typeof p.w === 'number');
    s.effects = s.effects.filter(e => e && typeof e.until === 'number' && e.type);
    s.display = U.clamp(Math.floor(+s.display || 0), 0, DISPLAY.length - 1);
    s.stockValue = Math.max(0, Math.round(+s.stockValue || 0)); s.nps = U.clamp(+s.nps || K.NPS_BASE, 0, 100); s.fanAcc = +s.fanAcc || 0;
    if (!INC_BY[s.incentive]) s.incentive = 'sin_incentivos'; if (!SCH_BY[s.schedule]) s.schedule = 'partido';
    s.level = U.clamp(Math.floor(+co.level || 1), 1, 4);
    /* partidas anteriores al módulo: si ya tenían local, se les monta lo básico para no castigarlas */
    if (!s.flags.migrated) {
      s.flags.migrated = true;
      if (co.level >= 2 && s.stockValue === 0 && !s.hist.length && (co.gameLog || []).length > 0) { s.stockValue = Math.round(LEVELS[co.level].stock * 0.5); if (!s.zones.length) s.zones = ['sol', 'graduado', 'accesorios']; if (s.display < 2) s.display = 2; }
    }
  }
  const S = co => { if (!co.modules || !co.modules[ID]) init(co); return co.modules[ID]; };
  function addLog(s, w, text) { s.log.push({ w, text }); if (s.log.length > 10) s.log.shift(); }
  function addEffect(s, e) { s.effects.push(e); if (s.effects.length > 40) s.effects.shift(); }

  /* =====================================================================
     4. CÁLCULO SEMANAL (puro: lo usan weekly y el panel)
     ===================================================================== */
  /* personal asignado a la tienda: peso de atención (rol afín ×1, otro ×0,5; nivel y rendimiento), habilidades */
  function staffInfo(co) {
    const list = co.staff.filter(x => x.assignment === ID);
    let weight = 0; const skills = {}; let n = 0;
    for (const x of list) {
      if (x.state === 'vacation') continue; n++;
      let v = (x.role === 'dependiente' || x.role === 'optico') ? 1 : 0.5; v *= 0.85 + 0.05 * Math.min(lvlOf(x), 6); v *= 0.5 + 0.5 * (x.efficiency === undefined ? 1 : U.clamp(x.efficiency, 0, 1)); weight += v;
      for (const k in (x.skills || {})) if (x.skills[k] && SKILL_NAME[k]) skills[k] = (skills[k] || 0) + 1;
    }
    const share = k => n ? Math.min(1, (skills[k] || 0) / n) : 0;
    return { list, n, weight: Math.round(weight * 100) / 100, skills, share, opticos: list.filter(x => x.role === 'optico' && x.state !== 'vacation').length, manager: list.some(x => (x.skills && x.skills.gestion_tienda) || lvlOf(x) >= 5) };
  }
  function ownOnSale(co) { const games = (co.gameLog || []).filter(g => g && !g.soldOut && g.releaseWeek !== undefined); return { n: games.length, share: Math.min(0.6, 0.15 * games.length), games }; }
  function newFx() {
    return { traffic: 1, sunTraffic: 1, conv: 1, ticket: 1, ticketAdd: 0, upt: 0, p2: 0, p2Mult: 1, p2Price: K.SECOND_PAIR_PRICE, recur: 1, recall: K.RECALL_BASE, marginPp: 0, sunMarginPp: 0, nps: 0, capture: 0,
      lcEnable: false, lcNew: 1, lcNewAdd: 0, lcChurn: 1, subs: false, lcPrice: 1, financed: 0, warranty: 0, services: 0, premium: 0, mature: 1, young: 1, kids: 1, productivity: 1, tol: 0, fans: 1, hype: 1,
      incomeMult: 1, ownBoost: 1, stockObs: 1, members: false, graduado: false, frames: 0, liquidate: false, academy: false, weekly: 0, attention: 1 };
  }
  const MULT_KEYS = ['traffic', 'sunTraffic', 'conv', 'ticket', 'recur', 'lcNew', 'lcChurn', 'lcPrice', 'mature', 'young', 'kids', 'productivity', 'fans', 'hype', 'incomeMult', 'ownBoost', 'stockObs', 'p2Mult', 'attention'];
  const ADD_KEYS = ['ticketAdd', 'upt', 'p2', 'p2Price', 'marginPp', 'sunMarginPp', 'nps', 'capture', 'premium', 'tol', 'services', 'lcNewAdd', 'frames', 'weekly'];
  const FLAG_KEYS = ['lcEnable', 'subs', 'members', 'graduado', 'liquidate', 'academy'];
  function applyFx(F, fx, co) {
    for (const k in fx) {
      const v = fx[k];
      if (MULT_KEYS.indexOf(k) >= 0) F[k] *= v;
      else if (ADD_KEYS.indexOf(k) >= 0) F[k] += v;
      else if (FLAG_KEYS.indexOf(k) >= 0) { if (v) F[k] = true; }
      else if (k === 'recall' || k === 'financed' || k === 'warranty') F[k] = Math.max(F[k], v);
      else if (k === 'partsBonus') { for (const pid of v) if (co.researchCompleted.indexOf(pid) >= 0) F.ticketAdd += 3; }
    }
  }
  const starsFactor = st => st < 3 ? 0.70 : st < 4 ? 0.85 : st < 4.5 ? 1.0 : st < 4.8 ? 1.12 : 1.2;
  function compute(co, s, w) {
    const L = LEVELS[U.clamp(co.level || 1, 1, 4)]; const d = U.dateFromWeek(w); const month = d.month;
    const mk = mkOf(co) || {}; const gab = gabOf(co) || {}; const lab = labOf(co) || {};
    const traffic = U.clamp(+mk.traffic || 0, -0.3, 0.6), brand = U.clamp(+mk.brand || 0, 0, 100), stars = U.clamp(+mk.stars || 4, 2.5, 5), retention = U.clamp(+mk.retention || 30, 0, 100), group = mk.group || null;
    const delivery = lab.deliveryDays === undefined ? 3 : +lab.deliveryDays, defects = lab.defectRate === undefined ? 0.05 : U.clamp(+lab.defectRate || 0, 0, 1), lensMargin = U.clamp(+lab.lensMargin || 0, 0, 0.4);
    const st = staffInfo(co); const F = newFx();
    /* escaparate y mobiliario (acumulativo hasta el nivel actual) */
    let dT = 0, dC = 0, dTk = 0;
    for (let i = 1; i <= s.display; i++) { const f = DISPLAY[i].fx; dT += f.traffic || 0; dC += f.conv || 0; dTk += f.ticket || 0; F.upt += f.upt || 0; F.nps += f.nps || 0; F.tol += f.tol || 0; F.premium += f.premium || 0; if (f.fans) F.fans *= f.fans; if (f.hype) F.hype *= f.hype; }
    F.traffic *= 1 + dT; F.conv *= 1 + dC; F.ticket *= 1 + dTk;
    for (const id of s.zones) { const zf = ZONE_BY[id].fx; applyFx(F, dupOf(id) ? Object.assign({}, zf, { services: 0 }) : zf, co); }
    const researched = SERVICES.filter(sv => co.hasResearch(sv.id) && !dupOf(sv.id)); for (const sv of researched) applyFx(F, sv.fx, co);
    const activeCamps = s.promos.filter(p => p.until > w);
    for (const p of activeCamps) { const P = PROMO_BY[p.id]; const seasonal = P.months && P.months.indexOf(month) >= 0; applyFx(F, P.fx, co); if (seasonal) F.traffic *= 1.05; }
    for (const id of s.policies) applyFx(F, PROMO_BY[id].fx, co);
    const inc = INC_BY[s.incentive] || INCENTIVES[0]; applyFx(F, inc.fx, co);
    const sch = SCH_BY[s.schedule] || SCHEDULES[0]; F.traffic *= sch.traffic;
    /* habilidades del equipo de tienda (ponderadas por la cuota de personal formado) */
    const sh = k => (F.academy && k === 'ventas') ? 1 : st.share(k);
    F.ticket *= (1 + 0.05 * sh('ventas')) * (1 + 0.03 * sh('progresivos')); F.conv *= 1 + 0.06 * sh('visagismo');
    F.p2 += 0.04 * sh('segundo_par'); F.capture += 0.04 * sh('segundo_par'); F.lcNew *= 1 + 0.1 * sh('lc_comercial'); F.lcChurn *= 1 - 0.1 * sh('lc_comercial'); F.nps += 4 * sh('reclamaciones');
    if (st.skills.gestion_tienda) F.productivity *= 1.05; if (st.skills.merchandising) F.traffic *= 1.05;
    if (st.n >= 4 && !st.manager) F.productivity *= 0.9;
    /* eventos temporales */
    for (const e of s.effects) { if (e.until <= w) continue; if (e.type === 'nps' || e.type === 'capture' || e.type === 'marginPp') F[e.type] += e.val || 0; else if (MULT_KEYS.indexOf(e.type) >= 0) F[e.type] *= e.mult || 1; }
    /* enseña (marketing) */
    if (group === 'cooperativa') F.marginPp += 3; else if (group === 'franquicia') { F.traffic *= 1.15; F.marginPp -= 3; }
    /* ¿se puede vender graduado? zona + autorización sanitaria (si existe el módulo gabinete) */
    const authOk = !Modules.get('gabinete') || co.hasResearch('AutorizacionSanitaria');
    const graduado = co.level >= 2 && F.graduado && authOk;
    /* visitas (unidades de juego) */
    const sunShare = (graduado || co.level === 1) ? L.sunShare : 0.6;
    const season = (SEASON[month] || 1) * (1 - sunShare) + (SEASON_SUN[month] || SEASON[month] || 1) * sunShare;
    const sunF = 1 + (F.sunTraffic - 1) * sunShare; const kidsF = 1 + (F.kids - 1) * L.kidsShare * (SEASON_KIDS[month] || 1);
    const matureF = 1 + (F.mature - 1) * 0.5; const youngF = 1 + (F.young - 1) * 0.25;
    const starsF = starsFactor(stars); const fansF = 1 + 0.15 * Math.log10(1 + co.fans / 10000);
    F.traffic = Math.min(F.traffic, 2.2); F.conv = Math.min(F.conv, 1.7);
    const visitsBase = L.visits * F.traffic * sunF * season * (1 + traffic) * starsF * (1 + brand / 200) * fansF * youngF;
    const recur = Math.min(F.recur, 1.8);
    let repeat = Math.min(co.fans, K.FANS_CAP) * (retention / 100) * (F.recall / 130) * recur; repeat = Math.min(repeat, L.visits * (1 + dT));
    const visits = visitsBase + repeat;
    /* conversión */
    const need = L.stock; const own = ownOnSale(co); const stockRatio = need ? (s.stockValue + own.n * 0.1 * need) / need : 1;
    const stockF = stockRatio < 1 ? 0.7 + 0.3 * stockRatio : Math.min(1.08, 1 + 0.16 * (stockRatio - 1));
    const labF = co.level >= 2 ? (delivery <= 1 ? 1.05 : delivery <= 3 ? 1 : delivery <= 5 ? 0.98 : 0.95) * (defects > 0.08 ? 0.97 : 1) : 1;
    const npsF = 1 + (s.nps - 30) / 500;
    const convWalk = U.clamp(L.conv * F.conv * stockF * labF * npsF * kidsF * ((graduado || co.level === 1) ? 1 : 0.8) * (1 + 0.03 * Math.min(2, st.opticos)), 0.01, 0.6);
    const walkT = visitsBase * convWalk; const repeatT = repeat * K.REPEAT_CONV * Math.min(1.3, F.conv) * stockF;
    const gabConv = graduado ? Math.max(0, +gab.convertedWeek || 0) * K.VOL : 0; const captureF = Math.min(1.3, 1 + F.capture); const gabT = gabConv * captureF;
    const demand = walkT + repeatT + gabT;
    /* atención: capacidad del personal frente a la demanda (sin nadie: 40 %) */
    const cap = st.weight * K.CAP_PER_STAFF * F.productivity * sch.cap; const util = cap > 0 ? demand / cap : Infinity; const okUtil = Math.min(0.95, K.UTIL_OK + 0.02 * F.tol);
    let attention = st.weight <= 0 ? (K.ATT_MIN_LEVEL[co.level] || K.ATT_MIN) : util <= okUtil ? 1 : okUtil / util; attention = U.clamp(attention * F.attention, 0.1, 1);
    const tickets = Math.min(demand * attention, st.weight <= 0 ? K.CAP_PER_STAFF * (co.level === 1 ? 1 : 0.3) : Infinity);
    /* ticket medio */
    const ticketBase = (graduado || co.level === 1) ? L.ticket : L.ticket * 0.45;
    const premiumF = 1 + 2 * Math.min(0.1, F.premium);
    const ticketF = Math.min(1.5, F.ticket * premiumF * matureF);
    const ticket = ticketBase * ticketF + Math.min(F.ticketAdd, 40) * (co.level === 1 ? 0.5 : 1);
    const upt = L.upt + Math.min(0.35, F.upt); const uptF = 1 + (upt - 1) * 0.5;
    const p2 = U.clamp((L.p2 + F.p2) * F.p2Mult, 0, 0.6);
    const mainG = tickets * ticket * uptF; const p2G = tickets * p2 * ticket * F.p2Price; const warrG = tickets * F.warranty * K.WARRANTY_PRICE;
    /* lentillas recurrentes */
    const lcOn = F.lcEnable && co.level >= 2; const lcG = lcOn ? s.lc.users * K.LC_MONTHLY / K.WEEKS_MONTH * F.lcPrice : 0;
    const lcNew = lcOn ? (tickets * 0.03 + F.lcNewAdd) * F.lcNew : 0;
    const churn = U.clamp((F.subs ? K.LC_CHURN_SUBS : K.LC_CHURN) / 52 * F.lcChurn * (1 - (retention - 30) / 100 * 0.5), 0, 0.1);
    /* servicios fijos y plan de salud (€ de juego/semana) */
    let servicesCash = F.services; if (s.zones.indexOf('audiologia') >= 0 && reqWhy(co, s, 'role:audioprotesista')) servicesCash -= ZONE_BY.audiologia.fx.services; servicesCash = Math.max(0, servicesCash);
    const membersCash = F.members ? Math.min(6000, Math.min(co.fans, K.FANS_CAP) * K.PLAN_SHARE * K.PLAN_FEE * K.K_TIENDA / K.WEEKS_MONTH) : 0;
    /* margen por categoría (mix real: lentes 45 %, monturas 25 %, sol 15 %, complementos 5 %, otros 10 %) */
    const frameMargin = K.BRAND_FRAME_MARGIN + Math.min(0.6, own.share * F.ownBoost) * K.OWN_FRAME_EXTRA;
    let margin = graduado ? 0.45 * K.LENS_MARGIN + 0.25 * frameMargin + 0.15 * 0.60 + 0.05 * 0.65 + 0.10 * 0.60 : 0.85 * 0.60 + 0.15 * 0.65;
    margin = U.clamp(margin + F.marginPp / 100 + F.sunMarginPp / 100 * sunShare, 0.2, 0.85);
    const cogsG = mainG * (1 - margin) + p2G * 0.6 + warrG * K.WARRANTY_COGS + lcG * K.LC_COGS;
    const finG = (mainG + p2G) * F.financed * K.FIN_COST; const commG = (mainG + p2G) * inc.pctSales;
    const im = (F.incomeMult > 1 && st.n < 4) ? 1 + (F.incomeMult - 1) * 0.4 : F.incomeMult;
    const salesG = (mainG + p2G + warrG + lcG) * im; const costG = (cogsG + finG + commG) * im;
    const income = salesG * K.K_TIENDA + servicesCash + membersCash; const cost = costG * K.K_TIENDA + servicesCash * 0.1 + membersCash * K.PLAN_COGS + F.weekly;
    const frameShare = graduado ? 0.25 : 0.85;
    const kpis = { visits, conv: convWalk, capture: gabConv > 0 ? Math.min(1, captureF * attention) : 0, ticket, upt, p2, attention, nps: s.nps,
      margin: salesG > 0 ? 1 - cogsG * im / salesG : margin, rotation: s.stockValue > 0 ? (mainG * frameShare * (1 - frameMargin) * K.K_TIENDA * 52) / s.stockValue : 0,
      lcRetention: 1 - Math.min(1, churn * 52), salesPerStaff: st.n ? income * 52 / st.n : 0 };
    return { L, F, st, inc, sch, graduado, authOk, visits, visitsBase, repeat, walkT, repeatT, gabT, gabConv, demand, cap, util, attention, tickets, ticket, upt, p2, mainG, p2G, warrG, lcG, lcOn, lcNew, churn, servicesCash, membersCash,
      margin, frameMargin, salesG, costG, income, cost, net: income - cost, kpis, stockRatio, stockF, own, traffic, brand, stars, retention, season, sunShare, activeCamps, researched, fansF, starsF, delivery, defects, lensMargin, group, okUtil };
  }
  function roundKpis(k) { const o = {}; for (const key in k) o[key] = Math.round((+k[key] || 0) * 1000) / 1000; o.visits = Math.round(k.visits || 0); o.ticket = Math.round(k.ticket || 0); o.salesPerStaff = Math.round(k.salesPerStaff || 0); return o; }
  function kpiClass(kp, v, co) {
    let base = kp.base, obj = kp.obj; if (kp.scale === 'ticket') { const f = LEVELS[U.clamp(co.level || 1, 1, 4)].ticket / 210; base *= f; obj *= f; } if (kp.scale === 'visits') { const f = LEVELS[U.clamp(co.level || 1, 1, 4)].visits / 2600; base *= f; obj *= f; }
    return v >= obj ? 'kpi-ok' : v >= base ? 'kpi-warn' : 'kpi-bad';
  }

  /* =====================================================================
     5. GANCHOS DEL MOTOR
     ===================================================================== */
  function weekly(co, w) {
    const s = S(co); s.week = w; const prevLevel = s.level; s.level = U.clamp(co.level || 1, 1, 4);
    if (s.level !== prevLevel) onLevelChange(co, s, prevLevel, w);
    const ended = s.promos.filter(p => p.until <= w);
    if (ended.length) { for (const p of ended) addLog(s, w, `Termina «${PROMO_BY[p.id].name}»`); s.promos = s.promos.filter(p => p.until > w); }
    s.effects = s.effects.filter(e => e.until > w);
    const c = compute(co, s, w);
    /* caja */
    const income = Math.round(c.income), cost = Math.round(c.cost);
    if (income > 0) co.adjustCash(income, 'Tienda: ventas'); if (cost > 0) co.adjustCash(-cost, 'Tienda: compras y comisiones');
    /* usuarios de lentillas */
    if (c.lcOn) {
      if (!s.flags.lcStarted) { s.flags.lcStarted = true; s.lc.users = Math.round(Math.min(co.fans, K.FANS_CAP) * 0.07 * 0.1) + 20; addLog(s, w, `Arranca la venta de lentillas con ${U.num(s.lc.users)} usuarios`); }
      s.lc.users = Math.max(0, s.lc.users + c.lcNew - s.lc.users * c.churn); s.lc.subs = !!c.F.subs;
    }
    /* NPS: media móvil hacia un objetivo que depende de servicios, esperas, defectos, promociones agresivas y estrellas */
    const pressure = s.promoLog.filter(x => x.w > w - 48 && PROMO_BY[x.id].type === 'camp').length;
    let target = K.NPS_BASE + c.F.nps + (c.attention >= 0.95 ? 8 : c.attention < 0.6 ? -15 : c.attention < 0.8 ? -6 : 0) + (c.defects > 0.06 ? -5 : c.defects < 0.03 ? 2 : 0) + (pressure > 3 ? -3 * (pressure - 3) : 0) + (c.stockRatio < 0.6 && co.level >= 2 ? -4 : 0) + (c.stars - 4) * 10;
    target = U.clamp(target, 0, 100); s.nps = Math.round((s.nps + (target - s.nps) * 0.1) * 10) / 10;
    /* clientes fieles */
    s.fanAcc += c.tickets * K.FANS_PER_TICKET * (1 + s.nps / 100) * c.F.fans; const f = Math.floor(s.fanAcc); if (f > 0) { co.adjustFans(f); s.fanAcc -= f; }
    /* campos compartidos e histórico */
    s.visitsWeek = Math.round(c.visits); s.conversion = Math.round(c.kpis.conv * 1000) / 1000; s.ticket = Math.round(c.ticket); s.salesWeek = income; s.kpis = roundKpis(c.kpis);
    s.hist.push({ w, v: s.visitsWeek, t: Math.round(c.tickets), inc: income, cost, net: income - cost, nps: Math.round(s.nps), att: Math.round(c.attention * 100) / 100, conv: s.conversion, tk: s.ticket, lc: Math.round(s.lc.users), gab: Math.round(c.gabT * c.attention) });
    if (s.hist.length > K.HIST) s.hist.shift();
    const m = s.month; m.income += income; m.cost += cost; m.net += income - cost; m.tickets += c.tickets; m.visits += c.visits; m.lc += c.lcG * K.K_TIENDA; m.services += c.servicesCash + c.membersCash;
    s.stats.income += income; s.stats.cost += cost; s.stats.tickets += c.tickets;
    hints(co, s, c, w);
    const d = U.dateFromWeek(w);
    if (!Modules.get('marketing') && d.month === 11 && d.week === 1 && co.isLaterOrEqualThan(18, 1) && co.hasResearch('t1_calendario_promocional') && !s.promos.some(p => p.id === 'black_friday') && s.fired['bf' + d.year] !== true) { s.fired['bf' + d.year] = true; notify('Black Friday', `Las cadenas ya anuncian su Black Friday en televisión. Podemos sumarnos durante cuatro semanas: +50 % de visitas con márgenes mínimos y la notoriedad se resiente un poco. Ojo con Consumo: el precio tachado tiene que ser el más bajo de los últimos 30 días. Coste: ${money(PROMO_BY.black_friday.cost)}.`, 'decision', { sourceId: 'tienda:black_friday', options: ['Lanzar el Black Friday (3.000 €)', 'Este año no'] }); }
    if (w % 4 === 3) checkEvents(co, s, c, w);
  }
  function onLevelChange(co, s, prev, w) {
    const L = LEVELS[s.level];
    if (s.level > prev) { addLog(s, w, `La tienda pasa a «${L.name}»`); notify('Tienda', `${L.name}: ${L.desc} Toca reponer stock (${money(L.stock)} recomendados)${s.level === 2 ? ', montar la zona de graduado y poner a alguien detrás del mostrador' : ' y revisar escaparate, zonas y personal'}.`); }
    if (s.schedule === 'centro_comercial' && s.level < 2) s.schedule = 'partido';
  }
  function hints(co, s, c, w) {
    const once = (k, h, t) => { if (s.flags[k]) return; s.flags[k] = true; notify(h, t); };
    if (co.level >= 2 && !c.F.graduado) once('hintGraduado', 'La tienda vende como un puesto', 'Tenemos local, pero sin zona de graduado (10.000 € en el panel Tienda → Local) seguimos vendiendo solo sol sin graduar y lectura premontada: ticket medio de 80 € en vez de 180 €.');
    if (co.level >= 2 && c.F.graduado && !c.authOk) once('hintAuth', 'Sin autorización sanitaria', 'Para vender gafa graduada el local tiene que estar autorizado como establecimiento sanitario, con óptico-optometrista director técnico (investigación «Autorización sanitaria»). Mientras tanto, la tienda solo puede vender sol sin graduar y lectura premontada.');
    if (co.level >= 2 && c.st.weight <= 0 && s.hist.length > 4 && c.visits > 0) once('hintStaff' + co.level, 'Nadie atiende la tienda', 'La tienda está sin atender: el 60 % de los clientes se va sin comprar. Asigna un asesor de ventas o un óptico (menú Personal → Detalles → Destino: Tienda) o atiéndela tú mismo.');
    if (co.level >= 2 && c.stockRatio < 0.5) once('hintStock' + co.level, 'Expositores medio vacíos', `Con ${money(s.stockValue)} en monturas los expositores dan pena y la conversión cae un ${Math.round((1 - c.stockF) * 100)} %. Para este local se recomiendan ${money(c.L.stock)} (panel Tienda → Local → Stock).`);
    if (c.util > 1.3 && c.st.weight > 0) once('hintQueue' + co.level, 'Colas en el mostrador', `Hay más clientes de los que ${c.st.n === 1 ? 'una persona puede' : 'el equipo puede'} atender: solo despachamos al ${Math.round(c.attention * 100)} %. Más personal en tienda, horario continuo o una zona de espera ayudarían.`);
    if (!co.hasResearch('t1_acogida') && s.hist.length === 8) once('hintResearch', 'Venta cruzada', 'Las investigaciones de la categoría «Tienda» (protocolo de acogida, segunda gafa, accesorios…) suben la conversión y el ticket. Aparecen en el menú Investigar cuando cumples sus requisitos.');
  }
  function monthly(co, d) {
    const s = S(co); const m = s.month;
    s.months.push({ y: d.month === 1 ? d.year - 1 : d.year, m: d.month === 1 ? 12 : d.month - 1, income: Math.round(m.income), cost: Math.round(m.cost), net: Math.round(m.net), tickets: Math.round(m.tickets), visits: Math.round(m.visits), lc: Math.round(m.lc), services: Math.round(m.services), fixed: monthlyCost(co), stock: s.stockValue });
    if (s.months.length > 12) s.months.shift(); s.month = blankMonth();
  }
  /* coste fijo mensual: cuotas de servicios, escaparate temático, incentivos, pluses de horario y obsolescencia del stock (puro, sin efectos) */
  function monthlyCost(co) {
    const s = S(co); const st = staffInfo(co); const mk = mkOf(co); let c = 0;
    for (const sv of SERVICES) if (sv.fx.monthly && co.hasResearch(sv.id) && !dupOf(sv.id)) c += sv.fx.monthly;
    if (s.display >= 6 && !((mk && mk.dept >= 3) || st.skills.merchandising)) c += DISPLAY[6].monthly;
    const inc = INC_BY[s.incentive]; if (inc) c += inc.cost + inc.perHead * st.n;
    const sch = SCH_BY[s.schedule]; if (sch) { if (sch.salaryPlus) c += Math.round(sch.salaryPlus * st.list.reduce((a, x) => a + (x.salary || 0), 0)); if (sch.rentPlus) c += Math.round(sch.rentPlus * ((C.LEVELS[co.level] || C.LEVELS[1]).rent)); }
    c += obsolescence(co, s);
    return c;
  }
  function obsolescence(co, s) { const need = LEVELS[U.clamp(co.level || 1, 1, 4)].stock; let r = K.STOCK_OBS; if (co.hasResearch('t2_control_stock')) r *= 0.5; if (need && s.stockValue > 1.5 * need) r *= 1.3; return Math.round(s.stockValue * r / 12 * 0.5); }
  function salesFactor(co, g) { const s = S(co); if (!g || !(g.platforms || []).some(p => p === 'tienda')) return 1; return 1 + 0.015 * s.display; }
  function hypeFactor(co) { const s = S(co); return s.display >= 6 ? DISPLAY[6].fx.hype : 1; }
  function onResearch(co, it) {
    const s = S(co); if (!it) return; const sv = SV_BY[it.id]; const w = wk(co);
    if (sv) { addLog(s, w, `Servicio nuevo: ${sv.name}`); if (sv.fx.unlock) notify('Promociones', `Con «${sv.name}» se desbloquean nuevas promociones en el panel Tienda: ${sv.fx.unlock.map(id => PROMO_BY[id].name).join('; ')}.`, 'news'); if (sv.id === 't2_lc_reposicion') notify('Lentillas', 'Empezamos a vender lentillas de reposición. Cada usuario gasta unos 25 € al mes y el abandono anual ronda el 25 %: la suscripción y la contactología lo reducen.', 'news'); }
    else if (it.id === 'AutorizacionSanitaria' && co.level >= 2 && !s.zones.some(z => z === 'graduado')) notify('Tienda', 'Ya podemos vender gafa graduada. Falta la zona de graduado en la tienda (panel Tienda → Local).', 'news');
  }
  function onTraining(co, ch, tr) { const s = S(co); if (!ch || !tr || !TRAIN.some(t => t.id === tr.id)) return; const t = TRAIN.find(x => x.id === tr.id); if (ch.assignment === ID) G.log(`${ch.name} aplica «${t.name}» en la tienda: ${t.fx}.`); else G.log(`${ch.name} ha hecho «${t.name}»: rendirá cuando esté en la tienda.`); addLog(s, wk(co), `${ch.name}: ${t.name}`); }
  function onAssign(co, ch, dept) { const s = S(co); if (!ch) return; if (dept === ID) { addLog(s, wk(co), `${ch.name} pasa a atender la tienda`); if (ch.role !== 'dependiente' && ch.role !== 'optico') G.log(`${ch.name} atiende la tienda, pero no es su oficio: rinde la mitad que un asesor de ventas.`); } }
  function onRelease(co, g) { const s = S(co); if (!g) return; if ((g.platforms || []).some(p => p === 'tienda')) { const n = ownOnSale(co).n; addLog(s, wk(co), `${g.title} llega a nuestros expositores (${n} colecciones propias a la venta)`); if (!s.flags.ownHint) { s.flags.ownHint = true; G.log(`Tienda: con ${g.title} en la pared vendemos más montura propia (margen 80-88 % frente al 55-65 % de las firmas). Cuantas más colecciones propias haya a la venta, mejor surtido.`); } } }

  /* ---------- eventos (15, probabilidad anual; se comprueban una vez al mes) ---------- */
  const canRem = co => co.isLaterOrEqualThan(18, 1); // la medición en oído real se populariza hacia 2012
  const EVENTS = [
    { id: 'ola_de_calor', name: 'Ola de calor en junio', p: 0.4, when: (co, s, c, d) => d.month === 6 && (s.zones.indexOf('sol') >= 0 || co.level === 1), fire(co, s, c, w) { addEffect(s, { type: 'sunTraffic', mult: 1.4, until: w + 3, src: 'ola_de_calor' }); notify('Ola de calor', 'Cuarenta grados a la sombra y la gente entra buscando gafas de sol (y aire acondicionado): +40 % de tráfico de sol durante tres semanas.', 'news'); } },
    { id: 'verano_sin_sol', name: 'Verano sin sol', p: 0.15, when: (co, s, c, d) => d.month === 6, fire(co, s, c, w) { addEffect(s, { type: 'sunTraffic', mult: 0.6, until: w + 10, src: 'verano_sin_sol' }); notify('Un verano sin sol', 'Junio y julio de lluvia y niebla: las gafas de sol se quedan en el expositor. Tráfico de sol −40 % durante diez semanas.', 'news'); } },
    { id: 'guerra_precios', name: 'Abre una cadena de descuento en la calle', p: 0.12, when: co => co.level >= 2 && !Modules.get('marketing'), fire(co, s, c, w) { notify('Cadena de descuento en la calle', 'Una cadena de descuento abre dos portales más abajo con «2 gafas graduadas por 49 €» en el escaparate. Los clientes de monofocal básica van a mirar allí primero. Podemos diferenciarnos por arriba (gabinete, audiología, colecciones propias: perdemos monofocales baratas pero sube el ticket), entrar en la guerra bajando todo un 35 % (mantenemos las visitas, pero el margen se hunde por debajo del 50 %) o montar un rincón de precio cerrado a 59 € con monturas de marca blanca y lentes de stock (4.000 €).', 'decision', { sourceId: 'tienda:guerra_precios', options: ['Diferenciarnos por arriba', 'Guerra de precios (−35 % en todo)', 'Rincón de precio cerrado a 59 € (4.000 €)'] }); } },
    { id: 'inspeccion_consumo', name: 'Inspección de Consumo', p: 0.2, when: (co, s, c) => co.level >= 2 && (c.activeCamps.length > 0 || s.policies.length > 0), fire(co, s, c, w) { const ok = co.hasResearch('t1_calendario_promocional'); if (ok) { notify('Inspección de Consumo', 'Un inspector de Consumo revisa la tienda: hojas de reclamaciones disponibles y su cartel a la vista, precios y honorarios expuestos, y en la promoción el precio anterior (el más bajo de los últimos 30 días) y las condiciones por escrito. Todo en regla gracias al calendario promocional.', 'news'); return; } notify('Inspección de Consumo', 'Un inspector de Consumo revisa la promoción y no encuentra el precio anterior (tiene que ser el más bajo de los últimos 30 días) ni las condiciones por escrito, y el cartel que anuncia las hojas de reclamaciones no está a la vista. Propuesta de sanción: 3.000 €. Si la reconocemos y la pagamos ya, se reduce un 40 %; también podemos recurrir (abogado 1.500 €, 50 % de éxito).', 'decision', { sourceId: 'tienda:inspeccion_consumo', options: ['Reconocer y pagar con reducción (1.800 €)', 'Recurrir (1.500 € de abogado)'] }); } },
    { id: 'oferta_competencia', name: 'Una cadena quiere fichar a nuestro óptico', p: 0.25, when: (co, s, c) => co.isLaterOrEqualThan(12, 1) && c.st.list.some(x => x.role === 'optico' && x.id !== 0), fire(co, s, c, w) { const ch = c.st.list.find(x => x.role === 'optico' && x.id !== 0); if (!ch) return; notify('Oferta de la competencia', `Faltan ópticos-optometristas colegiados y una gran cadena le ofrece a ${ch.name} 4.000 € más al año y no trabajar los sábados por la tarde. Podemos igualar la oferta o dejar que se lo piense (seguirá, pero con menos ganas).`, 'decision', { sourceId: 'tienda:oferta_competencia', options: ['Igualar la oferta (+15 % de salario)', 'No subir el sueldo'], staffId: ch.id }); } },
    { id: 'mystery_shopper', name: 'Cliente misterioso', p: 0.5, when: (co, s) => co.level >= 2 && ((mkOf(co) && mkOf(co).group === 'franquicia') || co.hasResearch('t3_nps_mystery')), fire(co, s, c, w) { const franq = mkOf(co) && mkOf(co).group === 'franquicia'; if (s.nps < 40) { co.adjustCash(-3000, 'Formación obligatoria'); notify('Cliente misterioso', `${franq ? 'La central de la cadena' : 'La consultora'} ha mandado un cliente misterioso y el informe es malo (NPS ${Math.round(s.nps)}): sin saludo, sin preguntar para qué quiere la gafa, sin ofrecer segunda gafa. ${franq ? 'Formación obligatoria: 3.000 €.' : 'Curso de refuerzo: 3.000 €.'}`); addEffect(s, { type: 'nps', val: 3, until: w + 12, src: 'mystery' }); } else if (s.nps > 60) { co.adjustCash(2000, 'Premio al mejor servicio'); co.adjustFans(300); notify('Cliente misterioso', `El cliente misterioso nos pone nota alta (NPS ${Math.round(s.nps)}): ${franq ? 'la central' : 'la revista del sector'} nos da 2.000 € de premio y sale una nota en la prensa local (+300 fieles).`, 'news'); } else notify('Cliente misterioso', `Visita de un cliente misterioso: informe correcto sin más (NPS ${Math.round(s.nps)}). Por encima de 60 habría premio.`, 'news'); } },
    { id: 'influencer', name: 'Una creadora local se graba con nuestras gafas de sol', p: 0.1, when: co => co.level >= 2 && co.isLaterOrEqualThan(12, 1), fire(co, s, c, w) { addEffect(s, { type: 'traffic', mult: 1.3, until: w + 4, src: 'influencer' }); addEffect(s, { type: 'young', mult: 1.3, until: w + 4, src: 'influencer' }); co.adjustFans(200 + Math.floor(co.fans * 0.005)); notify('Influencer local', 'Una creadora de la ciudad sube un vídeo probándose gafas de sol en nuestra tienda y se hace viral en el barrio: +30 % de visitas durante un mes, sobre todo jóvenes. Con las de sol puede hacerlo; si recomendara lentillas o cristales graduados sería publicidad sanitaria prohibida.', 'news'); } },
    { id: 'crisis_mutua', name: 'La aseguradora rompe el concierto', p: 0.1, when: co => co.hasResearch('t2_mutuas'), fire(co, s, c, w) { addEffect(s, { type: 'traffic', mult: 0.9, until: w + 20, src: 'crisis_mutua' }); notify('Fin del concierto con la aseguradora', 'La aseguradora de salud con la que teníamos concierto rehace su cuadro de ópticas y nos deja fuera: sus asegurados pierden el descuento y −10 % de visitas durante veinte semanas. Podemos mantenerles un descuento puente (campaña de 3.000 €: recupera el tráfico y añade un 5 %, pero cuesta 3 pts de margen).', 'decision', { sourceId: 'tienda:crisis_mutua', options: ['Descuento puente para sus asegurados (3.000 €)', 'Nada'] }); } },
    { id: 'lentillas_online', name: 'Una tienda en línea regala el envío de lentillas', p: 0.2, when: (co, s, c) => c.lcOn && co.isLaterOrEqualThan(8, 1), fire(co, s, c, w) { const subs = !!c.F.subs; addEffect(s, { type: 'lcChurn', mult: subs ? 1.1 : 1.5, until: w + 12, src: 'lentillas_online' }); notify('Lentillas por internet', subs ? 'Una tienda en línea regala el envío de lentillas. Nuestros usuarios en suscripción apenas se inmutan (+10 % de abandono tres meses).' : 'Una tienda en línea regala el envío de lentillas y nuestros usuarios lo notan: +50 % de abandono durante tres meses. La suscripción habría amortiguado el golpe.', 'news'); } },
    { id: 'lote_defectuoso', name: 'Lote de lentes con el antirreflejante cuarteado', p: 0.08, when: (co, s, c) => c.graduado, fire(co, s, c, w) { notify('Lote de lentes defectuoso', 'Un lote de lentes llega con el antirreflejante mal curado y empiezan a volver gafas con el tratamiento cuarteado. Podemos reponerlas todas por la garantía de fabricación de dos años (el fabricante paga las lentes; a nosotros nos cuesta 1.500 € de remontajes y horas de taller) o decirle a cada cliente que es por dejar las gafas al sol en el salpicadero.', 'decision', { sourceId: 'tienda:lote_defectuoso', options: ['Reponer todas por la garantía (1.500 € de taller)', 'Culpar al calor del salpicadero'] }); } },
    { id: 'premio_optica', name: 'Premio «Óptica del año»', p: 0.05, when: (co, s) => s.nps > 65 && co.level >= 3 && !(s.fired.premioUntil > wk(co)), fire(co, s, c, w) { s.fired.premioUntil = w + 96; addEffect(s, { type: 'traffic', mult: 1.2, until: w + 12, src: 'premio' }); co.adjustFans(5000); notify('Óptica del año', `¡${co.name} es la «Óptica del año» de la revista del sector! Sale en todos los medios: +5.000 clientes fieles y +20 % de visitas durante doce semanas.`, 'news'); } },
    { id: 'cliente_conflictivo', name: 'Cliente que no se adapta a los progresivos', p: 0.3, when: (co, s, c) => c.graduado, fire(co, s, c, w) { notify('Cliente conflictivo', 'Un cliente vuelve a los cuatro meses —fuera de los 90 días de la garantía de adaptación— diciendo que no ve bien con sus progresivos de 600 € y exige el dinero. Amenaza con una hoja de reclamaciones en Consumo y una reseña de una estrella. ¿Le cambiamos los progresivos por dos gafas, de lejos y de cerca, o nos mantenemos firmes?', 'decision', { sourceId: 'tienda:cliente_conflictivo', options: ['Revisar alturas y cambiarlas por dos gafas (600 €)', 'Mantenernos firmes'] }); } },
    { id: 'cierre_competidor', name: 'Se jubila la óptica de toda la vida del barrio', p: 0.08, when: co => co.level >= 2 && !Modules.get('marketing'), fire(co, s, c, w) { addEffect(s, { type: 'traffic', mult: 1.08, until: w + 16, src: 'cierre' }); notify('Cierra la óptica vecina', 'La óptica de toda la vida de la calle de al lado cierra por jubilación y sus clientes buscan dónde ir (+8 % de visitas durante cuatro meses). Su titular nos ofrece por 18.000 € la cartera de pacientes (con cesión legal del fichero, informando a cada uno como exige el RGPD), su exposición de monturas y la maquinaria de ocasión. Sin comprar nada, un buzoneo en el barrio (1.200 €) atraería a parte de sus clientes.', 'decision', { sourceId: 'tienda:cierre_competidor', options: ['Comprar cartera, monturas y maquinaria (18.000 €)', 'Buzoneo en el barrio (1.200 €)', 'Nada'] }); } },
    { id: 'hurto_exposicion', name: 'Hurto de gafas de sol en la exposición abierta', p: 0.15, when: (co, s) => co.level >= 3 && s.display >= 7 && !s.flags.antihurto, fire(co, s, c, w) { const loss = Math.round(1500 + U.rnd() * 1500); co.adjustCash(-loss, 'Hurto en la exposición'); notify('Hurto en la exposición', `Mientras el asesor atiende a una clienta, alguien se lleva del lineal abierto unas gafas de sol de firma (pérdida ${money(loss)}). Con exposición abierta la merma desconocida ronda el 2,5 % al año. Podemos poner arcos antihurto y etiquetas discretas en la varilla (1.800 €), volver a meter las gafas caras en vitrinas con llave (las ventas por impulso de sol caen un 25 %) o asumir las pérdidas.`, 'decision', { sourceId: 'tienda:hurto_exposicion', options: ['Arcos antihurto y etiquetas (1.800 €)', 'Volver a las vitrinas cerradas', 'Asumir las pérdidas'] }); } },
    { id: 'devolucion_audifonos', name: 'Devolución de audífonos tras el mes de prueba', p: 0.15, when: (co, s, c, d) => s.zones.indexOf('audiologia') >= 0 && !reqWhy(co, s, 'role:audioprotesista') && (!s.flags.rem || d.month % 2 === 0), fire(co, s, c, w) { const rem = canRem(co); const txt = s.flags.rem ? 'Con la medición en oído real podemos comprobar la ganancia dentro del conducto y reajustar en dos sesiones.' : rem ? 'Podríamos comprar un equipo de medición en oído real con impedanciómetro (9.000 €) para comprobar la ganancia dentro del conducto y reajustar en dos sesiones.' : 'Todavía no hay en las ópticas medición en oído real: solo podemos ofrecerle sesiones extra de ajuste fino.'; notify('Devolución de audífonos', `Un paciente quiere devolver sus dos audífonos de gama alta (3.800 €) al acabar los 30 días de prueba gratuita: dice que todo le suena «a lata». ${txt}`, 'decision', { sourceId: 'tienda:devolucion_audifonos', options: [s.flags.rem ? 'Medir en oído real y reajustar' : rem ? 'Comprar la medición en oído real (9.000 €) y reajustar' : 'Dos sesiones extra de ajuste fino', 'Aceptar la devolución'] }); } }
  ];
  function checkEvents(co, s, c, w) {
    if (s.lastEventW > w - 8) return; const d = U.dateFromWeek(w);
    for (const ev of EVENTS) { let ok = false; try { ok = ev.when(co, s, c, d); } catch (e) { ok = false; } if (!ok) continue; if (U.rnd() >= ev.p / 12) continue; s.lastEventW = w; s.stats.events++; s.fired[ev.id] = (s.fired[ev.id] || 0) + 1; addLog(s, w, ev.name); ev.fire(co, s, c, w); return ev.id; }
    return null;
  }
  function fireEvent(co, id) { const s = S(co); const w = wk(co); const ev = EVENTS.find(e => e.id === id); if (!ev) return false; const c = compute(co, s, w); s.lastEventW = w; s.stats.events++; addLog(s, w, ev.name); ev.fire(co, s, c, w); return true; }
  function onDecision(co, sourceId, choice, n) {
    if (!sourceId || sourceId.indexOf('tienda:') !== 0) return; const s = S(co); const w = s.week || wk(co); const yes = choice === 0; const mk = mkOf(co);
    switch (sourceId) {
      case 'tienda:guerra_precios': {
        /* EVT_TIE_01: diferenciarse por arriba / guerra de precios / rincón de precio cerrado */
        const strong = co.level >= 3 || ((gabOf(co) || {}).tier >= 2) || s.zones.indexOf('audiologia') >= 0 || ownOnSale(co).n > 0;
        if (choice === 2 && co.cash >= 4000) { co.adjustCash(-4000, 'Rincón de precio cerrado'); addEffect(s, { type: 'traffic', mult: 0.95, until: w + 26, src: 'guerra' }); addEffect(s, { type: 'ticket', mult: 0.97, until: w + 26, src: 'guerra' }); addEffect(s, { type: 'marginPp', val: -1, until: w + 26, src: 'guerra' }); addLog(s, w, 'Cadena de descuento: rincón de precio cerrado a 59 € (−5 % visitas, −3 % ticket 26 sem.)'); }
        else if (choice === 1) { addEffect(s, { type: 'ticket', mult: 0.80, until: w + 26, src: 'guerra' }); addEffect(s, { type: 'marginPp', val: -15, until: w + 26, src: 'guerra' }); if (mk) mk.brand = Math.max(0, mk.brand - 2); addLog(s, w, 'Cadena de descuento: guerra de precios (−20 % ticket, −15 pts de margen 26 sem.)'); }
        else { addEffect(s, { type: 'traffic', mult: 0.85, until: w + 26, src: 'guerra' }); addEffect(s, { type: 'ticket', mult: strong ? 1.15 : 1.05, until: w + 26, src: 'guerra' }); addEffect(s, { type: 'marginPp', val: 2, until: w + 26, src: 'guerra' }); addLog(s, w, `Cadena de descuento: nos diferenciamos por arriba (−15 % visitas, +${strong ? 15 : 5} % ticket 26 sem.)${choice === 2 ? ' — no había caja para el rincón de precio cerrado' : ''}`); }
        break; }
      case 'tienda:inspeccion_consumo':
        if (yes) co.adjustCash(-1800, 'Sanción de Consumo (reducida un 40 %)');
        else { co.adjustCash(-1500, 'Abogado'); if (U.rnd() < 0.5) notify('Recurso estimado', 'Consumo archiva el expediente por un defecto de forma. Nos libramos de la sanción.', 'news'); else { co.adjustCash(-3000, 'Sanción de Consumo'); notify('Recurso desestimado', 'El recurso no prospera: 3.000 € de sanción, sin reducción, más el abogado. El calendario promocional nos habría ahorrado el susto.'); } }
        break;
      case 'tienda:oferta_competencia': {
        const ch = n && n.staffId !== undefined ? co.staff.find(x => String(x.id) === String(n.staffId)) : null;
        if (yes && ch) { ch.salary = Math.round((ch.salary || 0) * 1.15 / 100) * 100; addLog(s, w, `${ch.name} se queda con un 15 % más de salario`); G.log(`${ch.name} se queda: salario ${money(ch.salary)}/mes.`); }
        else { addEffect(s, { type: 'attention', mult: 0.85, until: w + 12, src: 'desmotivado' }); addEffect(s, { type: 'nps', val: -3, until: w + 12, src: 'desmotivado' }); addLog(s, w, `${ch ? ch.name : 'El óptico'} se queda a disgusto: −15 % de atención 12 semanas`); }
        break; }
      case 'tienda:crisis_mutua':
        if (yes && co.cash >= 3000) { co.adjustCash(-3000, 'Descuento puente para asegurados'); s.effects = s.effects.filter(e => e.src !== 'crisis_mutua'); addEffect(s, { type: 'traffic', mult: 1.05, until: w + 20, src: 'puente' }); addEffect(s, { type: 'marginPp', val: -3, until: w + 20, src: 'puente' }); addLog(s, w, 'Descuento puente: +5 % visitas, −3 pts margen 20 sem.'); }
        break;
      case 'tienda:lote_defectuoso':
        if (yes) { co.adjustCash(-1500, 'Remontaje del lote por garantía'); addEffect(s, { type: 'nps', val: 2, until: w + 8, src: 'lote' }); addLog(s, w, 'Lote defectuoso: reponemos todas por garantía (+2 NPS)'); }
        else { co.adjustCash(500, 'Medias lentes cobradas'); addEffect(s, { type: 'nps', val: -10, until: w + 8, src: 'lote' }); if (mk) mk.stars = Math.max(2.5, (mk.stars || 4) - 0.1); addLog(s, w, 'Lote defectuoso: culpamos al salpicadero; la mitad paga media lente y la otra mitad no vuelve (−10 NPS, −0,1 estrellas)'); }
        break;
      case 'tienda:cliente_conflictivo':
        if (yes) { co.adjustCash(-600, 'Cambio de progresivos por dos gafas'); addEffect(s, { type: 'nps', val: 2, until: w + 6, src: 'conflictivo' }); }
        else { addEffect(s, { type: 'nps', val: -4, until: w + 8, src: 'conflictivo' }); if (mk) mk.stars = Math.max(2.5, (mk.stars || 4) - 0.05); }
        break;
      case 'tienda:cierre_competidor':
        /* EVT_TIE_02: cartera con cesión legal RGPD + monturas + maquinaria de ocasión (se revende) / buzoneo */
        if (choice === 0 && co.cash >= 18000) { co.adjustCash(-18000, 'Cartera y monturas de la óptica vecina'); co.adjustCash(3000, 'Reventa de su maquinaria de ocasión'); s.stockValue += 10000; co.adjustFans(3500); s.stats.invested += 18000; addLog(s, w, 'Compramos la cartera de la óptica vecina (+350 pacientes, +10.000 € de monturas)'); }
        else if (choice === 1 && co.cash >= 1200) { co.adjustCash(-1200, 'Buzoneo en el barrio'); addEffect(s, { type: 'traffic', mult: 1.10, until: w + 16, src: 'buzoneo' }); co.adjustFans(900); addLog(s, w, 'Buzoneo: captamos a parte de los clientes de la óptica vecina'); }
        break;
      case 'tienda:black_friday':
        if (yes) { const r = startPromo(co, 'black_friday'); if (!r.ok) G.log('Black Friday: ' + r.msg); }
        break;
      case 'tienda:hurto_exposicion':
        /* EVT_TIE_03: arcos antihurto / vitrinas cerradas / asumir la merma */
        if (choice === 0 && co.cash >= 1800) { co.adjustCash(-1800, 'Arcos antihurto'); s.flags.antihurto = true; addLog(s, w, 'Arcos antihurto: la merma desconocida baja del 2,5 al 0,2 %'); }
        else if (choice === 1) { addEffect(s, { type: 'sunTraffic', mult: 0.75, until: w + 26, src: 'vitrinas' }); addLog(s, w, 'Gafas caras otra vez en vitrinas: −25 % de ventas de sol por impulso 26 sem.'); }
        break;
      case 'tienda:devolucion_audifonos': {
        /* EVT_TIE_04: medición en oído real y ajuste fino / aceptar la devolución */
        if (yes) {
          if (canRem(co) && !s.flags.rem && co.cash >= 9000) { co.adjustCash(-9000, 'Medición en oído real e impedanciómetro'); s.flags.rem = true; }
          const p = s.flags.rem ? 0.65 : 0.4;
          if (U.rnd() < p) { addEffect(s, { type: 'nps', val: 2, until: w + 8, src: 'audio' }); addLog(s, w, 'Audífonos: reajuste y venta salvada'); notify('Venta salvada', 'Tras el reajuste el paciente oye bien y se queda los audífonos.', 'news'); }
          else { co.adjustCash(-3800, 'Devolución de audífonos'); addLog(s, w, 'Audífonos: devueltos pese al reajuste'); }
        } else { co.adjustCash(-3800, 'Devolución de audífonos'); addEffect(s, { type: 'nps', val: 1, until: w + 8, src: 'audio' }); addLog(s, w, 'Audífonos devueltos al fabricante; el paciente se queda con nosotros para las gafas'); }
        break; }
    }
  }

  /* =====================================================================
     6. ACCIONES DEL JUGADOR (panel y tests)
     ===================================================================== */
  function canBuyDisplay(co, s) { const nx = DISPLAY[s.display + 1]; if (!nx) return 'Mobiliario al máximo'; if (co.level < nx.level) return 'Requiere ' + C.LEVELS[nx.level].name.toLowerCase(); if (nx.research && !co.hasResearch(nx.research)) return 'Investiga «' + ((DB.research(nx.research) || {}).name || nx.research) + '»'; if (co.cash < nx.cost) return 'No hay dinero suficiente (' + money(nx.cost) + ')'; return null; }
  function buyDisplay(co) { const s = S(co); const why = canBuyDisplay(co, s); if (why) return { ok: false, msg: why }; const nx = DISPLAY[s.display + 1]; co.adjustCash(-nx.cost, 'Tienda: ' + nx.name); s.display++; s.stats.invested += nx.cost; addLog(s, wk(co), `Mobiliario: ${nx.name}`); return { ok: true, msg: nx.name + ' instalado' }; }
  function canBuyZone(co, s, z) { if (!z) return 'Zona desconocida'; if (s.zones.indexOf(z.id) >= 0) return 'Ya la tienes'; if (co.level < z.level) return 'Requiere ' + C.LEVELS[z.level].name.toLowerCase(); const why = whyNot(co, s, z.req); if (why) return why; if (co.cash < z.cost) return 'No hay dinero suficiente (' + money(z.cost) + ')'; return null; }
  function buyZone(co, id) { const s = S(co); const z = ZONE_BY[id]; const why = canBuyZone(co, s, z); if (why) return { ok: false, msg: why }; co.adjustCash(-z.cost, 'Tienda: ' + z.name); s.zones.push(id); s.stats.invested += z.cost; addLog(s, wk(co), `Zona nueva: ${z.name}`); return { ok: true, msg: z.name + ' lista' }; }
  function adjustStock(co, dir) {
    const s = S(co); const L = LEVELS[U.clamp(co.level || 1, 1, 4)]; const step = L.step;
    if (dir > 0) { if (co.cash < step) return { ok: false, msg: 'No hay dinero suficiente (' + money(step) + ')' }; co.adjustCash(-step, 'Tienda: compra de monturas'); s.stockValue += step; s.stats.invested += step; return { ok: true, msg: `Stock ${money(s.stockValue)}` }; }
    const q = Math.min(step, s.stockValue); if (q <= 0) return { ok: false, msg: 'No hay stock que liquidar' }; const back = Math.round(q * K.STOCK_SELL); co.adjustCash(back, 'Tienda: liquidación de monturas'); s.stockValue -= q; return { ok: true, msg: `Liquidadas monturas por ${money(q)} (recuperamos ${money(back)})` };
  }
  function promoUses(s, id, w) { return s.promoLog.filter(x => x.id === id && x.w > w - 24).length; }
  function canStartPromo(co, s, P, w) {
    if (!P) return 'Promoción desconocida'; const why = whyNot(co, s, P.req); if (why) return why;
    if (P.type === 'camp' && s.promos.some(p => p.id === P.id && p.until > w)) return 'Ya está en marcha';
    if (P.type === 'camp' && s.promos.filter(p => p.until > w).length >= 2) return 'Máximo dos campañas a la vez';
    if (co.cash < P.cost) return 'No hay dinero suficiente (' + money(P.cost) + ')'; return null;
  }
  function startPromo(co, id) {
    const s = S(co); const P = PROMO_BY[id]; const w = wk(co); const mk = mkOf(co);
    if (P && P.type === 'policy' && s.policies.indexOf(id) >= 0) { s.policies = s.policies.filter(x => x !== id); addLog(s, w, `Retiramos «${P.name}»`); return { ok: true, msg: P.name + ' desactivada' }; }
    const why = canStartPromo(co, s, P, w); if (why) return { ok: false, msg: why };
    if (P.cost) co.adjustCash(-P.cost, 'Promoción: ' + P.name);
    const uses = promoUses(s, id, w); const erosion = (P.brand || 0) * (1 + uses);
    if (mk && erosion) mk.brand = Math.max(0, (+mk.brand || 0) - erosion);
    s.promoLog.push({ id, w }); if (s.promoLog.length > 60) s.promoLog.shift(); s.stats.promos++;
    if (P.type === 'policy') { s.policies.push(id); addLog(s, w, `Política nueva: ${P.name}`); return { ok: true, msg: P.name + ' activada' }; }
    s.promos.push({ id, start: w, until: w + K.PROMO_WEEKS }); addLog(s, w, `Campaña: ${P.name} (4 semanas)`);
    return { ok: true, msg: `${P.name}: cuatro semanas${erosion ? ' · notoriedad −' + erosion : ''}${uses ? ' · repetida (más desgaste)' : ''}` };
  }
  function stopPromo(co, id) { const s = S(co); const n = s.promos.length; s.promos = s.promos.filter(p => p.id !== id); if (s.promos.length === n) return { ok: false, msg: 'No estaba activa' }; addLog(s, wk(co), `Cancelamos «${PROMO_BY[id].name}»`); return { ok: true, msg: 'Campaña cancelada (sin devolución)' }; }
  function setIncentive(co, id) {
    const s = S(co); const inc = INC_BY[id]; if (!inc) return { ok: false, msg: 'Esquema desconocido' }; if (s.incentive === id) return { ok: false, msg: 'Ya es el esquema actual' };
    const why = whyNot(co, s, inc.req); if (why) return { ok: false, msg: why };
    if (inc.setup && !s.flags['inc_' + id]) { if (co.cash < inc.setup) return { ok: false, msg: 'El alta cuesta ' + money(inc.setup) }; co.adjustCash(-inc.setup, 'Alta: ' + inc.name); s.flags['inc_' + id] = true; }
    s.incentive = id; addLog(s, wk(co), `Incentivos: ${inc.name}`); return { ok: true, msg: inc.name };
  }
  function setSchedule(co, id) { const s = S(co); const h = SCH_BY[id]; if (!h) return { ok: false, msg: 'Horario desconocido' }; if (s.schedule === id) return { ok: false, msg: 'Ya es el horario actual' }; const why = whyNot(co, s, h.req); if (why) return { ok: false, msg: why }; s.schedule = id; addLog(s, wk(co), `Horario: ${h.name}`); return { ok: true, msg: h.name }; }
  function action(co, act, id, val) {
    switch (act) {
      case 'display': return buyDisplay(co);
      case 'zone': return buyZone(co, id);
      case 'stockUp': return adjustStock(co, 1);
      case 'stockDown': return adjustStock(co, -1);
      case 'promo': return startPromo(co, id);
      case 'promostop': return stopPromo(co, id);
      case 'incentive': return setIncentive(co, id);
      case 'schedule': return setSchedule(co, id || val);
      case 'assign': case 'unassign': { const ch = co.staff.find(x => String(x.id) === String(id)); if (!ch) return { ok: false, msg: 'Empleado no encontrado' }; G.assign(ch, act === 'assign' ? ID : null); return { ok: true, msg: act === 'assign' ? `${ch.name} atiende la tienda` : `${ch.name} vuelve a las colecciones` }; }
    }
    return { ok: false, msg: 'Acción desconocida' };
  }

  /* =====================================================================
     7. PANEL DEL DEPARTAMENTO
     ===================================================================== */
  let uiTab = 'resumen';
  function injectCss() {
    if (typeof document === 'undefined' || !document.head || (document.getElementById && document.getElementById('css-tienda'))) return;
    const st = document.createElement('style'); st.id = 'css-tienda';
    st.textContent = '.dept-tienda .tk{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}.dept-tienda .tk .k{flex:1 1 128px;background:rgba(255,255,255,.65);border:2px solid #A4A4A4;border-radius:8px;padding:6px 10px}.dept-tienda .k b{display:block;font-size:19px}.dept-tienda .k small{color:#555;display:block}'
      + '.dept-tienda .tchart{display:flex;align-items:flex-end;gap:3px;height:130px;background:#fff;border:2px solid #A4A4A4;border-radius:8px;padding:6px}.dept-tienda .tcol{flex:1;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;height:100%}.dept-tienda .tcol i{display:block;width:70%;background:linear-gradient(#FAA51A,#F47A20);border-radius:2px 2px 0 0}.dept-tienda .tcol i.neg{background:#F42727}.dept-tienda .tcol span{font-size:9px;color:#777}'
      + '.dept-tienda .ttabs{display:flex;gap:4px;flex-wrap:wrap;margin:8px 0}.dept-tienda .ttabs button{background:#fff;border:2px solid #d9ccb4;border-radius:6px;padding:5px 10px;cursor:pointer;font-weight:600;font-size:13px;font-family:inherit}.dept-tienda .ttabs button.on{border-color:#F47A20;background:linear-gradient(#fff3df,#ffe3b8)}.dept-tienda .tsec{display:none}.dept-tienda .tsec.on{display:block}'
      + '.dept-tienda .tag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;background:#e8f4ff;margin-left:4px;vertical-align:middle}.dept-tienda .tag.on{background:#d9f5d2}.dept-tienda .tag.off{background:#fde2e2}.dept-tienda .tag.t{background:#eee}.dept-tienda .ok{color:#229710}.dept-tienda .bad{color:#F42727}.dept-tienda .warn{color:#b86e00}'
      + '.dept-tienda .cols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.dept-tienda .cols{grid-template-columns:1fr}}.dept-tienda .ritem .req{display:block;font-size:11px;color:#777;margin-top:2px}.dept-tienda .ritem .req.bad{color:#c0392b}.dept-tienda .ritem .ref{display:block;font-size:10.5px;color:#999;font-style:italic}'
      + '.dept-tienda .stockbar{height:12px;background:#eee;border-radius:6px;overflow:hidden;margin:4px 0}.dept-tienda .stockbar>i{display:block;height:100%;background:linear-gradient(90deg,#FAA51A,#2FAF1B)}.dept-tienda .tlog{font-size:12px;color:#555;margin:2px 0}.dept-tienda .sem{display:inline-block;width:10px;height:10px;border-radius:50%;margin-right:5px;vertical-align:middle}.dept-tienda .sem.kpi-ok{background:#2FAF1B}.dept-tienda .sem.kpi-warn{background:#e67e22}.dept-tienda .sem.kpi-bad{background:#F42727}'
      + '.dept-tienda .chips{display:flex;flex-wrap:wrap;gap:6px;margin:4px 0}.dept-tienda .chip{background:#fff;border:1px solid #d9ccb4;border-radius:14px;padding:3px 10px;font-size:12px}.dept-tienda .chip.off{opacity:.6}.dept-tienda .mini{font-size:11.5px;color:#666}.dept-tienda .ladder{display:flex;flex-wrap:wrap;gap:4px;margin:4px 0}.dept-tienda .ladder span{font-size:11px;padding:2px 7px;border-radius:4px;background:#eee}.dept-tienda .ladder span.on{background:#d9f5d2}.dept-tienda .ladder span.next{background:#ffe3b8}';
    document.head.appendChild(st);
  }
  function chartHtml(hist) {
    const h = hist.slice(-12); if (!h.length) return '<div class="sub">Todavía no hay semanas registradas.</div>';
    const mx = Math.max(1, ...h.map(x => Math.abs(x.net)));
    return `<div class="tchart">${h.map(x => `<div class="tcol" title="Semana ${x.w}: ventas ${money(x.inc)}, compras ${money(x.cost)}, neto ${money(x.net)}, ${U.num(x.t)} tickets, ${U.num(x.v)} visitas"><i class="${x.net < 0 ? 'neg' : ''}" style="height:${Math.max(2, Math.round(100 * Math.abs(x.net) / mx))}%"></i><span>${x.w % 48 ? x.w % 48 : 48}</span></div>`).join('')}</div><div class="mini">Neto semanal de la tienda (ventas − compras y comisiones) en las últimas ${h.length} semanas · máx. ${U.shortMoney(mx)}.</div>`;
  }
  function kpiBoxes(co, s, c) {
    const gabOn = !!(gabOf(co) && gabOf(co).tier >= 1);
    return `<div class="tk">${KPIS.filter(k => !k.needsGab || gabOn).map(k => { const v = c.kpis[k.id]; const cls = kpiClass(k, v, co); const last = s.hist.length >= 2 ? s.hist[s.hist.length - 2] : null; return `<div class="k"><small><span class="sem ${cls}"></span>${esc(k.name)}</small><b class="${cls}">${k.fmt(v)}</b><small>objetivo ${k.fmt(k.scale === 'ticket' ? k.obj * c.L.ticket / 210 : k.scale === 'visits' ? k.obj * c.L.visits / 2600 : k.obj)}</small></div>`; }).join('')}</div>`;
  }
  function uiResumen(co, s, c, w) {
    const L = c.L; const mk = mkOf(co); let h = '';
    const tags = [c.st.weight > 0 ? `<span class="tag on">${c.st.n} en tienda</span>` : '<span class="tag off">sin atender (40 %)</span>', co.level >= 2 ? (c.graduado ? '<span class="tag on">graduado</span>' : '<span class="tag off">solo sol y lectura</span>') : '<span class="tag t">solo sol y lectura</span>', c.activeCamps.length ? `<span class="tag on">${c.activeCamps.length} campaña${c.activeCamps.length > 1 ? 's' : ''}</span>` : '', `<span class="tag t">${esc(c.sch.name.split(' (')[0])}</span>`].join('');
    h += `<div class="sub"><b>${esc(L.name)}</b> ${tags} · ${esc(L.desc)}</div>`;
    /* embudo de la semana: de la puerta a la caja (visual explicativo) */
    { const v = Math.max(0, c.visits || 0), t = Math.max(0, c.tickets || 0), att = U.clamp(c.attention || 0, 0, 1); const pot = att > 0 ? Math.min(v, t / att) : t; const lost = Math.max(0, pot - t); const tk = Math.round(c.ticket || 0); const gab = Math.round((c.gabT || 0) * att);
      const row = (lbl, n, max, cls, note) => `<div class="fn-row"><span class="fn-lbl">${lbl}</span><span class="fn-bar"><i class="${cls}" style="width:${max > 0 ? Math.max(1.5, 100 * n / max) : 0}%"></i></span><b>${U.num(Math.round(n))}</b>${note ? `<small>${note}</small>` : ''}</div>`;
      h += `<div class="funnel"><div class="fn-head">Esta semana, de la puerta a la caja</div>
        ${row('Entran en la tienda', v, v, 'a', '')}
        ${row('Quieren comprar', pot, v, 'b', v > 0 ? Math.round(100 * pot / v) + ' % de las visitas' : '')}
        ${row('Compran', t, v, 'c', `ticket medio ${U.money(tk)}${gab > 0 ? ` · ${U.num(gab)} vienen del gabinete` : ''}`)}
        ${lost >= 1 ? row('Se van sin atender', lost, v, 'd', att < 1 ? `falta personal: atendemos al ${Math.round(att * 100)} % · cada asesor más en tienda cierra unos ${U.num(Math.round(K.CAP_PER_STAFF * (c.F.productivity || 1) * ((c.sch && c.sch.cap) || 1) * (c.okUtil || 0.9)))} tickets/semana${co.staff.length >= co.maxStaff ? ' (plantilla completa: habría que quitarlo de otro departamento)' : ''}` : '') : ''}
        <div class="sub">Ingresos de la semana: <b>${U.money(Math.round(c.income || 0))}</b>. Para vender más: más visitas (escaparate, marketing), más ganas de comprar (zonas, servicios, colecciones que encajen) o más personal si hay gente que se va sin atender.</div></div>`; }
    h += kpiBoxes(co, s, c);
    const src = [['Visitas de paso', c.visitsBase, c.walkT], ['Clientes que repiten', c.repeat, c.repeatT], ['Pacientes del gabinete', c.gabConv, c.gabT]];
    h += `<div class="cols"><div><h4>Últimas 12 semanas</h4>${chartHtml(s.hist)}</div><div><h4>Previsión de esta semana</h4><table class="tbl"><tr><th>Origen</th><th>Visitas</th><th>Tickets</th></tr>${src.map(r => `<tr><td>${r[0]}</td><td>${U.num(r[1])}</td><td>${U.num(r[2] * c.attention)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${U.num(c.visits)}</b></td><td><b>${U.num(c.tickets)}</b> <small>(atención ${pct(c.attention)})</small></td></tr></table>
      <table class="tbl" style="margin-top:6px"><tr><td>Ticket medio × ${c.upt.toFixed(2)} uds</td><td>${money(c.ticket)}</td></tr><tr><td>Ventas (gafas, 2.ª gafa ${pct(c.p2)}, seguros, lentillas${c.lcOn ? ' · ' + U.num(s.lc.users) + ' usuarios' : ''})</td><td>${money(c.salesG * K.K_TIENDA)}</td></tr>${c.servicesCash + c.membersCash > 0 ? `<tr><td>Servicios (taller, audiología, pruebas, terapia, plan renove)</td><td>${money(c.servicesCash + c.membersCash)}</td></tr>` : ''}<tr><td>Compras de producto (margen ${pct(c.margin)}), financiación y comisiones</td><td class="bad">−${money(c.cost)}</td></tr><tr><td>Cuotas fijas (prorrateo mensual)</td><td class="bad">−${money(monthlyCost(co) / K.WEEKS_MONTH)}</td></tr><tr><td><b>Neto semanal estimado</b></td><td><b class="${c.net - monthlyCost(co) / K.WEEKS_MONTH >= 0 ? 'ok' : 'bad'}">${money(c.net - monthlyCost(co) / K.WEEKS_MONTH)}</b></td></tr></table></div></div>`;
    h += `<h4>Factores de esta semana</h4><div class="mini">Escaparate ×${(1 + DISPLAY.slice(1, s.display + 1).reduce((a, d) => a + (d.fx.traffic || 0), 0)).toFixed(2)} · estacionalidad ×${c.season.toFixed(2)} · marketing: tráfico ${c.traffic >= 0 ? '+' : ''}${Math.round(c.traffic * 100)} %, notoriedad ${Math.round(c.brand)} (×${(1 + c.brand / 200).toFixed(2)}), ${c.stars.toFixed(1)} estrellas (×${c.starsF.toFixed(2)}), recurrencia ${Math.round(c.retention)} · clientes fieles ×${c.fansF.toFixed(2)} · stock ${pct(c.stockRatio)} del recomendado (×${c.stockF.toFixed(2)}) · laboratorio: entrega ${c.delivery} d, remontajes ${pct1(c.defects)} · NPS ${Math.round(s.nps)}${c.gabConv ? ` · captura gabinete ${pct(Math.min(1, (1 + c.F.capture) * c.attention))}` : ''}${c.own.n ? ` · ${c.own.n} colección${c.own.n > 1 ? 'es' : ''} propia${c.own.n > 1 ? 's' : ''} a la venta (margen de montura ${pct(c.frameMargin)})` : ''}.</div>`;
    if (mk) h += `<div class="mini">Enseña: ${mk.group === 'franquicia' ? 'franquicia (+15 % visitas, −3 pts de margen; lo decide Marketing)' : mk.group === 'cooperativa' ? 'cooperativa / central de compras (+3 pts de margen)' : 'óptica independiente'}.</div>`;
    if (c.activeCamps.length) h += '<h4>Campañas en marcha</h4>' + c.activeCamps.map(p => `<div class="ritem"><div><b>${esc(PROMO_BY[p.id].name)}</b><small>${esc(PROMO_BY[p.id].desc)}</small></div><div class="rcost">${p.until - w} sem.</div><button class="btn small danger" data-act="promostop" data-id="${p.id}">Cancelar</button></div>`).join('');
    if (s.log.length) h += '<h4>Últimos sucesos</h4>' + s.log.slice().reverse().map(l => { const d = U.dateFromWeek(l.w); return `<div class="tlog">${U.MONTHS[d.month - 1].slice(0, 3)} ${U.realYear(d.year)} · ${esc(l.text)}</div>`; }).join('');
    h += `<div class="mini" style="margin-top:8px">Totales: ${money(s.stats.income)} vendidos · ${money(s.stats.cost)} en compras · ${money(s.stats.invested)} invertidos en local y stock · ${U.num(s.stats.tickets)} tickets · ${s.stats.promos} promociones · ${s.stats.events} sucesos.</div>`;
    return h;
  }
  function uiServicios(co, s, c, w) {
    let h = `<div class="sub">${c.researched.length}/${SERVICES.length} servicios de venta cruzada investigados. Los disponibles se investigan desde el menú Investigar (categoría Tienda) con puntos de investigación, dinero y una persona libre.</div>`;
    const TIER_NAME = { 1: 'Nivel 1 · mostrador', 2: 'Nivel 2 · local comercial', 3: 'Nivel 3 · óptica con gabinete', 4: 'Nivel 4 · insignia' };
    for (let t = 1; t <= 4; t++) {
      const list = SERVICES.filter(sv => sv.tier === t); h += `<h4>${TIER_NAME[t]} <small class="mini">(${list.filter(sv => co.hasResearch(sv.id)).length}/${list.length})</small></h4>`;
      h += list.map(sv => {
        const dup = dupOf(sv.id); if (dup) return `<div class="ritem off"><div><b>${esc(sv.name)}</b><span class="tag">en ${esc(dup)}</span><small>Este servicio lo gestiona ${esc(dup)}: así no se paga ni se cuenta dos veces.</small></div></div>`;
        const done = co.hasResearch(sv.id); const it = DB.research(sv.id); const avail = !done && it && it.req(co); const why = done ? null : (whyNot(co, s, sv.req) || (sv.tier >= 3 && co.level < 3 ? 'Requiere ' + C.LEVELS[3].name.toLowerCase() : sv.tier === 4 && co.level < 4 && sv.req.indexOf('lvl3') < 0 ? 'Requiere ' + C.LEVELS[4].name.toLowerCase() : null));
        const listed = co.availableResearch.indexOf(sv.id) >= 0;
        return `<div class="ritem ${done ? '' : avail ? '' : 'off'}"><div><b>${esc(sv.name)}</b>${done ? '<span class="tag on">activo</span>' : avail ? '<span class="tag">disponible</span>' : ''}<small>${esc(sv.desc)}</small>${sv.ref ? `<span class="ref">${esc(sv.ref)}</span>` : ''}${why ? `<span class="req bad">${esc(why)}</span>` : ''}${sv.fx.monthly ? `<span class="req">Cuota ${money(sv.fx.monthly)}/mes</span>` : ''}</div><div class="rcost">${done ? '<span class="ok">✓</span>' : `🔬 ${sv.rp} · ${U.shortMoney(sv.cost)}<br><small>${(sv.dur / WEEK_MS).toFixed(1)} sem.</small>`}</div>${!done && avail ? `<button class="btn small ${listed ? 'primary' : ''}" data-act="research">Investigar</button>` : '<span></span>'}</div>`;
      }).join('');
    }
    return h;
  }
  function uiLocal(co, s, c, w) {
    const L = c.L; let h = '';
    /* escaparate */
    const cur = DISPLAY[s.display], nx = DISPLAY[s.display + 1]; const why = canBuyDisplay(co, s);
    h += `<h4>Escaparate y mobiliario <small class="mini">(nivel ${s.display}/9 · capacidad ${U.num(Math.max(cur.frames, L.frames * 0.4) + c.F.frames)} monturas expuestas)</small></h4>`;
    h += `<div class="ladder">${DISPLAY.map((d, i) => `<span class="${i <= s.display ? 'on' : i === s.display + 1 ? 'next' : ''}" title="${esc(d.name)}">${i}</span>`).join('')}</div>`;
    h += `<div class="ritem"><div><b>Actual: ${esc(cur.name)}</b><small>${esc(cur.desc)}</small></div><div class="rcost"><span class="ok">instalado</span></div><span></span></div>`;
    if (nx) h += `<div class="ritem ${why ? 'off' : ''}"><div><b>Siguiente: ${esc(nx.name)}</b><small>${esc(nx.desc)}</small>${why ? `<span class="req bad">${esc(why)}</span>` : ''}${nx.monthly ? `<span class="req">Cuota ${money(nx.monthly)}/mes</span>` : ''}</div><div class="rcost">${money(nx.cost)}</div><button class="btn small primary" data-act="display" ${why ? 'disabled' : ''}>Instalar</button></div>`;
    else h += '<div class="sub ok">Mobiliario al máximo: tienda insignia.</div>';
    h += `<details><summary class="sub">Todos los niveles</summary>${DISPLAY.map((d, i) => `<div class="mini">${i <= s.display ? '✓' : '·'} ${i}. ${esc(d.name)} — ${money(d.cost)}${d.monthly ? ' + ' + money(d.monthly) + '/mes' : ''} · ${C.LEVELS[d.level].name}${d.research ? ' · ' + ((DB.research(d.research) || {}).name || d.research) : ''}</div>`).join('')}</details>`;
    /* zonas */
    const owned = ZONES.filter(z => s.zones.indexOf(z.id) >= 0), rest = ZONES.filter(z => s.zones.indexOf(z.id) < 0);
    h += `<h4>Zonas de la tienda <small class="mini">(${owned.length}/${ZONES.length})</small></h4>`;
    if (owned.length) h += `<div class="chips">${owned.map(z => `<span class="chip">${esc(z.name)}</span>`).join('')}</div>`;
    h += rest.map(z => { const wz = canBuyZone(co, s, z); const far = co.level < z.level; return `<div class="ritem ${wz ? 'off' : ''}"><div><b>${esc(z.name)}</b>${far ? `<span class="tag t">${C.LEVELS[z.level].name}</span>` : ''}<small>${esc(z.desc)}</small>${wz ? `<span class="req bad">${esc(wz)}</span>` : ''}</div><div class="rcost">${money(z.cost)}</div><button class="btn small primary" data-act="zone" data-id="${z.id}" ${wz ? 'disabled' : ''}>Montar</button></div>`; }).join('');
    /* stock */
    const ratio = c.stockRatio; const obs = obsolescence(co, s);
    h += `<h4>Stock de monturas</h4><div class="cols"><div><div class="sub">Invertido: <b>${money(s.stockValue)}</b> · recomendado para este local: ${money(L.stock)} · ${c.own.n ? c.own.n + ' colección(es) propia(s) a la venta cuentan como surtido · ' : ''}efecto en conversión ×${c.stockF.toFixed(2)} · rotación ${c.kpis.rotation.toFixed(1)} vueltas/año (real: ${['', '1,1-1,4', '1,1-1,4', '1,5-2,0', '2,1-2,8'][U.clamp(co.level || 1, 1, 4)]})</div><div class="stockbar"><i style="width:${Math.round(Math.min(1, ratio / 1.5) * 100)}%"></i></div><div class="mini">${ratio < 0.6 ? '<span class="bad">Expositores medio vacíos: la conversión cae hasta un 30 %.</span>' : ratio < 1 ? '<span class="warn">Algo escaso: completa el surtido.</span>' : ratio <= 1.5 ? '<span class="ok">Surtido completo (hasta +8 % de conversión con un 50 % más).</span>' : '<span class="warn">Sobrestock: la obsolescencia sube un 30 %.</span>'} Obsolescencia estimada ${money(obs)}/mes (${co.hasResearch('t2_control_stock') ? '10' : '20'} % anual liquidado al −50 %).</div></div>
      <div><div class="row"><button class="btn small primary" data-act="stockUp" ${co.cash < L.step ? 'disabled' : ''}>+ Comprar monturas (${U.shortMoney(L.step)})</button><button class="btn small" data-act="stockDown" ${s.stockValue <= 0 ? 'disabled' : ''}>− Liquidar (${U.shortMoney(Math.min(L.step, s.stockValue))} al 60 %)</button></div><div class="mini">Mix recomendado 80 % graduado / 20 % sol. Monturas de firma: margen 55-65 %; marca blanca o propia: 80-88 %. Una óptica con 600 monturas expuestas vende 900-1.200 al año.</div></div></div>`;
    /* horario */
    h += `<h4>Horario comercial</h4>` + SCHEDULES.map(sc => { const on = s.schedule === sc.id; const wh = on ? null : whyNot(co, s, sc.req); return `<div class="ritem ${on ? '' : wh ? 'off' : ''}"><div><b>${esc(sc.name)}</b>${on ? '<span class="tag on">actual</span>' : ''}<small>${esc(sc.desc)}</small>${wh ? `<span class="req bad">${esc(wh)}</span>` : ''}</div><div class="rcost">${sc.salaryPlus ? '+' + Math.round(sc.salaryPlus * 100) + ' % salarios' : 'sin pluses'}${sc.rentPlus ? '<br><small>+' + Math.round(sc.rentPlus * 100) + ' % alquiler</small>' : ''}</div>${on ? '<span></span>' : `<button class="btn small" data-act="schedule" data-id="${sc.id}" ${wh ? 'disabled' : ''}>Cambiar</button>`}</div>`; }).join('');
    return h;
  }
  function uiPromos(co, s, c, w) {
    let h = `<div class="sub">Las campañas duran ${K.PROMO_WEEKS} semanas (máximo dos a la vez), cuestan dinero al activarlas y desgastan la notoriedad de marca (el doble si se repiten en menos de 24 semanas; más de tres campañas al año bajan el NPS). Las políticas permanentes se activan y desactivan cuando quieras.</div>`;
    const camps = PROMOS.filter(p => p.type === 'camp'), pols = PROMOS.filter(p => p.type === 'policy'); const month = U.dateFromWeek(w).month;
    const row = P => {
      const active = P.type === 'camp' ? s.promos.find(p => p.id === P.id && p.until > w) : (s.policies.indexOf(P.id) >= 0 ? true : null);
      const why = active ? null : canStartPromo(co, s, P, w); const uses = promoUses(s, P.id, w); const good = P.months && P.months.indexOf(month) >= 0;
      return `<div class="ritem ${active ? '' : why ? 'off' : ''}"><div><b>${esc(P.name)}</b>${active ? `<span class="tag on">${P.type === 'camp' ? 'en marcha · ' + (active.until - w) + ' sem.' : 'activa'}</span>` : ''}${good && !active ? '<span class="tag">buen mes</span>' : ''}<small>${esc(P.desc)}</small>${P.ref ? `<span class="ref">${esc(P.ref)}</span>` : ''}${why ? `<span class="req bad">${esc(why)}</span>` : ''}${!active && uses ? `<span class="req">Repetida ${uses} ${uses === 1 ? 'vez' : 'veces'} en 24 semanas: desgaste ×${1 + uses}</span>` : ''}${P.months ? `<span class="req">Meses recomendados: ${P.months.join(', ')}</span>` : ''}</div><div class="rcost">${P.cost ? money(P.cost) : 'gratis'}${P.brand ? `<br><small>notoriedad −${P.brand}</small>` : ''}${P.fx.weekly ? `<br><small>${money(P.fx.weekly)}/sem</small>` : ''}</div>${active ? (P.type === 'camp' ? `<button class="btn small danger" data-act="promostop" data-id="${P.id}">Cancelar</button>` : `<button class="btn small" data-act="promo" data-id="${P.id}">Desactivar</button>`) : `<button class="btn small primary" data-act="promo" data-id="${P.id}" ${why ? 'disabled' : ''}>${P.type === 'camp' ? 'Lanzar' : 'Activar'}</button>`}</div>`;
    };
    h += '<h4>Campañas de 4 semanas</h4>' + camps.map(row).join('') + '<h4>Políticas permanentes</h4>' + pols.map(row).join('');
    if (s.promoLog.length) h += `<div class="mini" style="margin-top:6px">Historial: ${s.promoLog.slice(-8).reverse().map(x => { const d = U.dateFromWeek(x.w); return `${esc(PROMO_BY[x.id].name.split(' (')[0])} (${U.MONTHS[d.month - 1].slice(0, 3)} ${U.realYear(d.year)})`; }).join(' · ')}</div>`;
    return h;
  }
  function uiEquipo(co, s, c, w) {
    const st = c.st; let h = '';
    h += `<div class="sub">Capacidad de atención: <b>${U.num(c.cap)}</b> tickets/semana (${st.n} persona${st.n === 1 ? '' : 's'} · peso ${st.weight} × ${K.CAP_PER_STAFF} × productividad ${c.F.productivity.toFixed(2)}${c.sch.cap !== 1 ? ' × horario ' + c.sch.cap : ''}) frente a una demanda de <b>${U.num(c.demand)}</b>: utilización ${isFinite(c.util) ? pct(c.util) : '∞'} → atención ${pct(c.attention)}${c.util > c.okUtil ? ' <span class="warn">(hay esperas)</span>' : ''}. ${st.n >= 4 && !st.manager ? '<span class="bad">Cuatro o más personas sin encargado (nivel 5 o curso de gestión): productividad −10 %.</span>' : ''}</div>`;
    const card = x => { const sk = Object.keys(x.skills || {}).filter(k => x.skills[k] && SKILL_NAME[k]).map(k => SKILL_NAME[k]); const w0 = (x.role === 'dependiente' || x.role === 'optico') ? 1 : 0.5; return `<div class="ritem"><div><b>${esc(x.name)}</b>${x.id === 0 ? '<span class="tag t">tú</span>' : ''}${x.state === 'vacation' ? '<span class="tag off">vacaciones</span>' : ''}<small>${esc(x.roleInfo().name)} · nivel ${lvlOf(x)} · rendimiento ${Math.round((x.efficiency === undefined ? 1 : x.efficiency) * 100)} %${w0 < 1 ? ' · <span class="warn">rol no afín (×0,5)</span>' : ''}${sk.length ? ' · formación: ' + sk.join(', ') : ''}</small></div><div class="rcost">${x.salary ? U.shortMoney(x.salary) + '/mes' : '—'}</div><button class="btn small" data-act="unassign" data-id="${x.id}">Quitar</button></div>`; };
    h += '<h4>Personal en tienda</h4>' + (st.list.length ? st.list.map(card).join('') : '<div class="sub bad">Nadie atiende la tienda: el 60 % de los clientes se va sin comprar.</div>');
    const others = co.staff.filter(x => x.assignment !== ID && x.state !== 'vacation');
    if (others.length) h += '<h4>Disponibles para asignar</h4>' + others.map(x => `<div class="ritem"><div><b>${esc(x.name)}</b><small>${esc(x.roleInfo().name)} · nivel ${lvlOf(x)} · ahora en ${x.assignment ? esc((Modules.get(x.assignment) || { name: x.assignment }).name) : 'colecciones'}${x.role !== 'dependiente' && x.role !== 'optico' ? ' · <span class="warn">rinde la mitad en tienda</span>' : ''}</small></div><div class="rcost"></div><button class="btn small primary" data-act="assign" data-id="${x.id}">Asignar</button></div>`).join('');
    h += `<div class="mini">Contrata asesores de ventas desde el menú Personal (rol «Asesor/a de ventas»): se asignan solos a la tienda. Los ópticos también venden (y suman +3 % de conversión cada uno, hasta dos).</div>`;
    /* incentivos */
    h += '<h4>Incentivos del equipo</h4>' + INCENTIVES.map(i => { const on = s.incentive === i.id; const wh = on ? null : whyNot(co, s, i.req); const costTxt = [i.setup && !s.flags['inc_' + i.id] ? 'alta ' + money(i.setup) : '', i.cost ? money(i.cost) + '/mes' : '', i.perHead ? money(i.perHead) + '/persona/mes' : '', i.pctSales ? Math.round(i.pctSales * 100) + ' % de las ventas' : ''].filter(Boolean).join(' · ') || 'sin coste'; return `<div class="ritem ${on ? '' : wh ? 'off' : ''}"><div><b>${esc(i.name)}</b>${on ? '<span class="tag on">actual</span>' : ''}<small>${esc(i.desc)}</small>${wh ? `<span class="req bad">${esc(wh)}</span>` : ''}</div><div class="rcost">${costTxt}</div>${on ? '<span></span>' : `<button class="btn small" data-act="incentive" data-id="${i.id}" ${wh ? 'disabled' : ''}>Aplicar</button>`}</div>`; }).join('');
    /* formación */
    h += '<h4>Formación comercial</h4><div class="mini">Se cursa desde la ficha de cada empleado (menú Personal → Detalles → Formación). El efecto se aplica mientras la persona formada esté en la tienda.</div>' + TRAIN.map(t => { const who = co.staff.filter(x => x.skills && x.skills[t.skill]).map(x => x.name); return `<div class="ritem"><div><b>${esc(t.name)}</b>${who.length ? '<span class="tag on">' + esc(who.join(', ')) + '</span>' : ''}<small>${esc(t.fx)}. Requiere ${C.LEVELS[t.level].name.toLowerCase()}.</small></div><div class="rcost">${money(t.cost)}<br><small>🔬 ${t.pointsCost} · ${(t.duration / WEEK_MS).toFixed(1)} sem.</small></div><span></span></div>`; }).join('');
    return h;
  }
  function uiCuentas(co, s, c, w) {
    let h = ''; const fixed = monthlyCost(co); const st = c.st; const mk = mkOf(co);
    const lines = [];
    for (const sv of SERVICES) if (sv.fx.monthly && co.hasResearch(sv.id) && !dupOf(sv.id)) lines.push([sv.name, sv.fx.monthly]);
    if (s.display >= 6) lines.push(['Escaparate temático', ((mk && mk.dept >= 3) || st.skills.merchandising) ? 0 : DISPLAY[6].monthly]);
    const inc = INC_BY[s.incentive]; if (inc && (inc.cost || inc.perHead)) lines.push([inc.name, inc.cost + inc.perHead * st.n]);
    const sch = SCH_BY[s.schedule]; if (sch && sch.salaryPlus) lines.push(['Pluses de horario (' + Math.round(sch.salaryPlus * 100) + ' % de los salarios de tienda)', Math.round(sch.salaryPlus * st.list.reduce((a, x) => a + (x.salary || 0), 0))]); if (sch && sch.rentPlus) lines.push(['Alquiler de centro comercial (+' + Math.round(sch.rentPlus * 100) + ' %)', Math.round(sch.rentPlus * (C.LEVELS[co.level] || C.LEVELS[1]).rent)]);
    lines.push(['Obsolescencia del stock', obsolescence(co, s)]);
    const sal = st.list.reduce((a, x) => a + (x.salary || 0), 0);
    h += `<div class="sub">Ventas por persona en tienda: <b>${U.shortMoney(c.kpis.salesPerStaff)}</b>/año (objetivo 150 K €) · margen bruto ${pct(c.kpis.margin)}.</div><h4>Costes fijos mensuales de la tienda: ${money(fixed)}</h4><table class="tbl">${lines.map(l => `<tr><td>${esc(l[0])}</td><td>${money(l[1])}</td></tr>`).join('')}<tr><td><i>Salarios del personal en tienda (los paga el núcleo con los gastos mensuales)</i></td><td><i>${money(sal)}</i></td></tr></table>`;
    h += `<h4>Últimos 12 meses</h4>`;
    if (!s.months.length) h += '<div class="sub">Todavía no se ha cerrado ningún mes.</div>';
    else { const T = { income: 0, cost: 0, fixed: 0, tickets: 0 }; h += `<table class="tbl"><tr><th>Mes</th><th>Visitas</th><th>Tickets</th><th>Ventas</th><th>Compras</th><th>Fijos</th><th>Neto</th><th>Neto − salarios</th></tr>${s.months.map(m => { T.income += m.income; T.cost += m.cost; T.fixed += m.fixed; T.tickets += m.tickets; const net = m.income - m.cost - m.fixed; return `<tr><td>A${m.y} M${m.m}</td><td>${U.num(m.visits)}</td><td>${U.num(m.tickets)}</td><td>${money(m.income)}</td><td>−${money(m.cost)}</td><td>−${money(m.fixed)}</td><td class="${net >= 0 ? 'ok' : 'bad'}">${money(net)}</td><td class="${net - sal >= 0 ? 'ok' : 'bad'}">${money(net - sal)}</td></tr>`; }).join('')}<tr><td><b>Total</b></td><td></td><td><b>${U.num(T.tickets)}</b></td><td><b>${money(T.income)}</b></td><td><b>−${money(T.cost)}</b></td><td><b>−${money(T.fixed)}</b></td><td><b>${money(T.income - T.cost - T.fixed)}</b></td><td></td></tr></table>`; }
    h += `<div class="mini" style="margin-top:6px">Objetivo orientativo de neto mensual (ventas − compras − fijos) por local: puesto 2-5 k€, local 10-30 k€, gabinete 40-120 k€, insignia 150-400 k€, siempre con personal e inversión. La tienda es un colchón; las colecciones son el negocio. Margen bruto real: 68-72 % en una óptica de barrio, 73-78 % en una insignia.</div>`;
    return h;
  }
  function ui(co) {
    injectCss(); const s = S(co); const w = wk(co); const c = compute(co, s, w);
    const tabs = [['resumen', 'Resumen'], ['servicios', `Servicios (${c.researched.length}/${SERVICES.length})`], ['local', 'Local y stock'], ['promos', 'Promociones'], ['equipo', 'Equipo'], ['cuentas', 'Cuentas']];
    let h = `<div class="dept-tienda"><div class="ttabs">${tabs.map(t => `<button data-tab="${t[0]}" class="${uiTab === t[0] ? 'on' : ''}">${t[1]}</button>`).join('')}</div>`;
    const secs = { resumen: uiResumen, servicios: uiServicios, local: uiLocal, promos: uiPromos, equipo: uiEquipo, cuentas: uiCuentas };
    for (const k in secs) { let body; try { body = secs[k](co, s, c, w); } catch (e) { body = `<div class="sub bad">Error al pintar la pestaña: ${esc(e && e.message)}</div>`; } h += `<div class="tsec ${uiTab === k ? 'on' : ''}" data-sec="${k}">${body}</div>`; }
    h += '</div>';
    return {
      body: h,
      bind(el, refresh) {
        if (!el || !el.querySelectorAll) return;
        el.querySelectorAll('button[data-tab]').forEach(b => b.addEventListener('click', () => { uiTab = b.dataset.tab; el.querySelectorAll('button[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === uiTab)); el.querySelectorAll('.tsec').forEach(x => x.classList.toggle('on', x.dataset.sec === uiTab)); }));
        el.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => {
          const a = b.dataset.act;
          if (a === 'research') { if (typeof UI !== 'undefined' && UI.showResearch) return UI.showResearch(); return; }
          const r = action(co, a, b.dataset.id); if (r && r.msg) toast(r.msg); if (typeof G !== 'undefined' && G.emit) G.emit('refresh'); if (refresh) refresh();
        }));
      }
    };
  }

  /* =====================================================================
     8. ESCENA, RESUMEN Y REGISTRO
     ===================================================================== */
  function sceneInfo(co) {
    const s = S(co); const w = wk(co); const last = s.hist[s.hist.length - 1];
    const L = LEVELS[U.clamp(co.level || 1, 1, 4)]; const busy = last ? U.clamp(last.t / (L.visits * L.conv * 2), 0, 1) : 0;
    return { level: s.level, displays: s.display, zones: s.zones.length, customersNow: Math.min(5, Math.round(busy * 5)), promo: s.promos.some(p => p.until > w), staff: staffInfo(co).n, stockRatio: L.stock ? Math.round(s.stockValue / L.stock * 100) / 100 : 1, nps: s.nps,
      zoneIds: s.zones.slice(), displayId: DISPLAY[s.display] ? DISPLAY[s.display].id : null /* render.js: zonas y mobiliario a la vista */ };
  }
  function report(co) {
    const s = S(co); const lm = s.months[s.months.length - 1]; const st = staffInfo(co);
    return [{ label: 'Ventas última semana', value: money(s.salesWeek) }, { label: 'Neto último mes', value: lm ? money(lm.net - lm.fixed) : '—' }, { label: 'Tienda', value: LEVELS[U.clamp(co.level || 1, 1, 4)].name }, { label: 'Visitas/semana', value: U.num(s.visitsWeek) }, { label: 'Conversión', value: pct1(s.conversion) }, { label: 'Ticket medio', value: money(s.ticket) }, { label: 'NPS', value: Math.round(s.nps) }, { label: 'Personal en tienda', value: String(st.n) }, { label: 'Servicios', value: `${SERVICES.filter(sv => co.hasResearch(sv.id)).length}/${SERVICES.length}` }, { label: 'Mobiliario / zonas', value: `${s.display}/9 · ${s.zones.length}/${ZONES.length}` }, { label: 'Costes fijos', value: money(monthlyCost(co)) + '/mes' }];
  }
  const DECISIONS = ['tienda:guerra_precios', 'tienda:inspeccion_consumo', 'tienda:oferta_competencia', 'tienda:crisis_mutua', 'tienda:lote_defectuoso', 'tienda:cliente_conflictivo', 'tienda:cierre_competidor', 'tienda:black_friday', 'tienda:hurto_exposicion', 'tienda:devolucion_audifonos'];
  Modules.register({
    id: ID, name: 'Tienda', icon: '🏬', order: 50,
    init, weekly, monthly, monthlyCost, salesFactor, hypeFactor, onResearch, onTraining, onAssign, onRelease, onDecision, ui, sceneInfo, report,
    api: { K, LEVELS, DISPLAY, ZONES, SERVICES, PROMOS, TRAIN, INCENTIVES, SCHEDULES, KPIS, EVENTS, NEWS, RES, DECISIONS, state: S, compute, staffInfo, action, buyDisplay, buyZone, adjustStock, startPromo, stopPromo, setIncentive, setSchedule, canBuyDisplay, canBuyZone, canStartPromo, whyNot, checkEvents, fireEvent, monthlyCost, obsolescence, kpiClass }
  });
})();
