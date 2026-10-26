/* Óptica Tycoon — Departamento Gabinete optométrico (id "gabinete", icono 👁️, order 20)
   Fuente de datos: docs/research/gabinete.data.json y gabinete.md (investigación 12/10/2026) y, para el pase de realismo,
   docs/research/RESULTADO_DEPARTAMENTOS_OFICIO.md (escalera del gabinete, Decreto 12/2009 de Galicia, tablas EQUIPOS EQ_GAB_*,
   ESPECIALIDADES ESP_* y eventos EVT_GAB_*). Competencias del óptico-optometrista: sin fármacos (ni ciclopléjicos ni anestésicos,
   así que nada de tonometría de aplanación con anestesia: aire o rebote), cribado e informe de derivación al oftalmólogo, nunca diagnóstico.

   Estado persistente en co.modules.gabinete (JSON plano, reparado por init):
     tier           0 sin gabinete · 1 reglamentario · 2 clínico y contactología · 3 digital · 4 centro de especialidades · 5 instituto
     instruments    ids de instrumentos comprados · used {id:true} comprados de segunda mano · broken {id: semana en que vuelve}
     examMode       'gratis' (gancho: más pacientes) | 'cobro' (60 € por examen, menos pacientes)
     patientsWeek, convertedWeek, conversion, reputation (0..100)   ← campos compartidos que lee la tienda
     active         ids de especialidades activas esta semana
     pools          recurrentes {lentillas, ortok, miopia, audifonos, ojoseco: {n}}
     hist           últimas 24 semanas {w, p, c, inc, ex, sp, rc, gl} · months últimos 12 meses · month acumulador del mes
     boosts         efectos temporales [{mult, until, src}] · convenioUntil · closedUntil · teleSuspendedUntil
     repPenalty / repBonus  modificadores de reputación que decaen · stats contadores
   Hacia fuera: salesFactor (Graduado ×0.5 sin Autorización sanitaria; bonus por especialidades), scoreFactor (tipos clínicos),
   candidateBonus (reputación), monthlyCost (mantenimiento), fans +pacientes/20.
   Escala: pacientes en escala real (30-90 por optometrista y semana según tier, como en la investigación); la tienda multiplica
   convertedWeek por su VOL y vende la gafa a ticket real. Sin módulo tienda, el gabinete cobra la gafa él mismo (210 € × margen 0,5).
   Servicios de especialidad a precio real × 2 (investigación) × SCALE para que el gabinete sea un colchón, no la fuente principal.
   Decisiones (sourceId): gabinete:inspeccion · gabinete:averia · gabinete:convenio · gabinete:polemica · gabinete:club · gabinete:planveo (solo sin marketing)
   · gabinete:derivacion (hallazgo en un cribado) · gabinete:showroomer (piden la receta gratis para comprar en internet) · gabinete:progresivos (inadaptación). */
'use strict';
(function () {
  const ID = 'gabinete';
  const K = {
    TICKET: 210,          // ticket medio real de la gafa graduada (FEDAO 2025: 210,93 €); lo cobra la tienda si existe
    GLASS_MARGIN: 0.5,    // sin módulo tienda: el gabinete ingresa ticket × margen por cada paciente que compra gafa
    EXAM_PRICE: 60,       // examen visual con informe optométrico (real 30 € × 2; la entrega de receta sola son 20 €)
    RECETA: 40,           // entrega de graduación o receta (real 20 € × 2): la cobra quien elige no regalarla al showroomer
    SCALE: 0.3,           // escala global de especialidades y recurrentes (precio real × 2 × SCALE)
    OVERBOOK: 1.1,        // un box puede atender hasta un 10 % por encima de su capacidad (horas extra); el resto de la demanda se pierde
    SPEC_LOAD: 0.8,       // fracción del tiempo de especialidad que ocupa el box (el resto lo hacen auxiliares o es gabinete aparte)
    MODE: { gratis: { pat: 1.15, conv: 0.03 }, cobro: { pat: 0.8, conv: -0.02 } }, // examen gratuito como gancho vs examen de pago
    PAT_CAP: 0.35,        // tope del bonus de pacientes por instrumental
    CONV_CAP: 0.75, HIST: 24, WEEKS_MONTH: 4.33, MIN_EXAM: 25,
    /* sanciones sanitarias reales 3.005-15.000 € × 4 (escala del instrumental): funcionar sin director técnico = 9.000 € reales y
       clausura cautelar (≈15 días); infracciones leves de la inspección rutinaria desde 3.005 € reales */
    INSPECTION_FINE: 36000, LAWYER: 12000, MINOR_FINE: 12000
  };
  const gab = c => (c && c.modules && c.modules[ID]) || { tier: 0, instruments: [], used: {}, broken: {} };
  const later = (c, y, m) => c.isLaterOrEqualThan(y, m || 1);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  const toast = m => { if (typeof UI !== 'undefined' && UI && UI.toast) UI.toast(m); else if (typeof G !== 'undefined' && G.company) G.log(m); };
  const notify = (h, t, type, o) => G.notify(h, t, type, o);
  const money = n => U.money(n);

  /* =====================================================================
     1. CATÁLOGOS
     ===================================================================== */
  const TIERS = [
    { tier: 0, name: 'Sin gabinete', cost: 0, maint: 0, level: 1, patients: 0, conv: 0, instr: [], desc: 'Sin autorización sanitaria solo se venden gafas de sol (EPI) y premontadas de lectura (+1,00 a +3,50 D) con un espejo y una cartilla de cerca. Graduar exige local, autorización sanitaria, sala de gabinete y un óptico-optometrista colegiado como director técnico.' },
    /* Escalón 2 de la investigación (Decreto 12/2009 de Galicia): sala independiente ≥ 8 m² con todo el instrumental obligatorio.
       El oftalmómetro va con el retinoscopio, prismas y cilindros cruzados con la caja de pruebas y duocromo, estereopsis y colores con los optotipos. */
    { tier: 1, name: 'Gabinete reglamentario', cost: 10000, maint: 450, level: 2, patients: 30, conv: 0.45, research: 'AutorizacionSanitaria', instr: ['sala_oscura_obra', 'optotipos_basicos', 'caja_pruebas_gafa_prueba', 'retinoscopio', 'frontofocometro_manual', 'oftalmoscopio_directo', 'lampara_hendidura', 'pupilometro_digital', 'software_historia_clinica'], desc: 'Lo que exige el Decreto 12/2009 de Galicia: sala independiente de al menos 8 m² con lámpara de hendidura, caja de pruebas con prismas y cilindros cruzados, retinoscopio con reglas de esquiascopia, oftalmómetro, oftalmoscopio, optotipos de lejos y cerca, interpupilómetro y tests duocromo, de estereopsis y de colores. Refracción manual (unos 30 minutos por paciente) y revisión infantil básica.' },
    { tier: 2, name: 'Gabinete clínico y contactología', cost: 120000, maint: 1500, level: 2, patients: 50, conv: 0.50, research: 'Gabinete', instr: ['unidad_refraccion', 'autorrefractometro_queratometro', 'tonometro_aire'], desc: 'Unidad de refracción, autorrefractómetro-queratómetro y tonómetro de aire: el pre-examen automático deja la consulta en unos 20 minutos. Contactología blanda (en Galicia, en una segunda sala de 8 m²), pediatría, cribado básico con derivación al oftalmólogo y óptica a domicilio.' },
    { tier: 3, name: 'Gabinete digital', cost: 300000, maint: 3000, level: 3, patients: 65, conv: 0.55, research: 'GabineteDigital', instr: ['foropter_digital', 'topografo_corneal'], desc: 'Foróptero digital conectado al autorrefractómetro y topógrafo corneal: contactología avanzada, ortoqueratología, terapia visual, baja visión, control de miopía y audiología.' },
    { tier: 4, name: 'Centro de especialidades optométricas', cost: 500000, maint: 4000, level: 3, patients: 85, conv: 0.60, research: 'Retinografo', instr: ['retinografo_no_midriatico', 'campimetro'], desc: 'Retinógrafo no midriático y campímetro computerizado: cribado de retina por telemedicina, cribado de glaucoma, esclerales, visión deportiva y control de miopía con biometría.' },
    { tier: 5, name: 'Instituto de la visión', cost: 1200000, maint: 8000, level: 4, patients: 100, conv: 0.65, research: null, instr: ['oct', 'segundo_gabinete'], desc: 'Varios gabinetes, OCT, biómetro óptico y luz pulsada para el ojo seco, en cogestión con oftalmólogos: todas las especialidades y la referencia clínica de la ciudad.' }
  ];

  /* Instrumentos (38). cost = coste_juego (precio real × 4, contrastado con la tabla EQUIPOS EQ_GAB_*: precio nuevo medio) · maint €/mes (≈0,6 % del coste)
     tier = nivel de gabinete en que encaja (se puede comprar un tier por delante) · date 'año/mes' del juego = año de popularización real − 1994
     fx: pat +pacientes · conv +conversión · price +precio de examen/pruebas · rep reputación · def −defectos (nota de colecciones clínicas) · rec +recurrencia · mkt +tráfico · boxes
     fail = probabilidad anual de avería (usado ×2,5) · key = obligatorio por el Decreto 12/2009 (etiqueta en el panel) · noUsed = no existe de segunda mano */
  const INSTR = [];
  function I(id, name, cat, cost, maint, tier, fx, o) { INSTR.push(Object.assign({ id, name, cat, cost, maint, tier, fx: fx || {}, req: [], fail: 0.03 }, o || {})); }
  /* --- dotación obligatoria del gabinete (Galicia) --- */
  I('optotipos_basicos', 'Optotipos de lejos y cerca, test duocromo, estereotest y láminas de colores', 'Refracción', 4000, 0, 1, {}, { key: true, fail: 0.01, desc: 'Obligatorios por norma: agudeza visual de lejos y cerca, duocromo rojo-verde para afinar la esfera, test de estereopsis y láminas de visión del color. Sin ellos no hay examen.' });
  I('caja_pruebas_gafa_prueba', 'Caja de pruebas, gafa de prueba, prismas y cilindros cruzados', 'Refracción', 6000, 0, 1, {}, { key: true, fail: 0.01, desc: 'Obligatoria (o foróptero): lentes esféricas y cilíndricas, barras de prismas y cilindros cruzados para afinar el astigmatismo. Indispensable en baja visión y pediatría.' });
  I('retinoscopio', 'Retinoscopio de franja, reglas de esquiascopia y oftalmómetro', 'Refracción', 10000, 0, 1, {}, { key: true, fail: 0.01, desc: 'Obligatorios: refracción objetiva sin colirios (imprescindible con niños) y radios de la córnea con el oftalmómetro manual.' });
  I('frontofocometro_manual', 'Frontofocómetro manual', 'Verificación', 4000, 0, 1, { def: 0.03 }, { key: true, fail: 0.02, desc: 'Obligatorio. Mide las gafas que trae el paciente y verifica las lentes que salen del taller: −3 % defectos.' });
  I('sala_oscura_obra', 'Sala de gabinete independiente (≥ 8 m², obra)', 'Obra', 32000, 0, 1, {}, { key: true, level: 2, fail: 0, noUsed: true, desc: 'Dependencia distinta de al menos 8 m², con oscurecimiento, ventilación, lavamanos y distancia de examen (o espejo). Lo exige el Decreto 12/2009.' });
  I('software_historia_clinica', 'Historia clínica y agenda de citas', 'Gestión', 6000, 50, 1, { rec: 0.05 }, { key: true, fail: 0.04, noUsed: true, desc: 'Registro de historias clínicas (obligatorio; son datos de salud) y recordatorios de revisión: +5 % recurrencia.' });
  I('oftalmoscopio_directo', 'Oftalmoscopio directo', 'Salud ocular', 2000, 0, 1, { rep: 1 }, { key: true, fail: 0.01, desc: 'Obligatorio. Observación básica del fondo de ojo y de los medios transparentes para el cribado.' });
  I('lampara_hendidura', 'Lámpara de hendidura (biomicroscopio)', 'Salud ocular', 20000, 120, 1, { conv: 0.02, rep: 2 }, { key: true, fail: 0.04, desc: 'Obligatoria en el gabinete y base de la contactología: córnea, conjuntiva, lágrima y cristalino. +2 pts conversión, +2 reputación.' });
  I('pupilometro_digital', 'Interpupilómetro digital', 'Venta técnica', 2000, 0, 1, { def: 0.03, price: 0.02 }, { key: true, fail: 0.03, desc: 'Obligatorio en Galicia. Distancias nasopupilares de lejos y cerca al milímetro: −3 % defectos, +2 % precio.' });
  /* --- gabinete clínico y contactología --- */
  I('pantalla_lcd_optotipos', 'Proyector de optotipos / pantalla polarizada', 'Refracción', 7000, 40, 2, { pat: 0.03, rep: 1 }, { req: ['optotipos_basicos'], fail: 0.04, desc: 'Primero el proyector y, desde finales de los 2000, la pantalla LCD polarizada con tests binoculares: examen más rápido y moderno, +3 % pacientes, +1 reputación.' });
  I('unidad_refraccion', 'Unidad de refracción (sillón + columna)', 'Mobiliario clínico', 32000, 100, 2, { pat: 0.05, conv: 0.02, rep: 1 }, { req: ['sala_oscura_obra'], fail: 0.03, desc: 'Sillón elevador, columna y brazo para los instrumentos: menos fatiga del optometrista y mejor imagen. +5 % pacientes, +2 pts de conversión.' });
  I('foropter_manual', 'Foróptero manual', 'Refracción', 12000, 30, 2, { pat: 0.05 }, { req: ['unidad_refraccion'], fail: 0.03, desc: 'Refracción subjetiva unos 6 minutos más rápida que con la caja de pruebas: +5 % pacientes.' });
  I('autorrefractometro_queratometro', 'Autorrefractómetro-queratómetro', 'Refracción', 35000, 210, 2, { pat: 0.15 }, { date: '-14/1', fail: 0.07, desc: 'Refracción objetiva y queratometría en 30 segundos: +15 % pacientes. Base de la contactología.' });
  I('tonometro_aire', 'Tonómetro de aire (no contacto)', 'Salud ocular', 28000, 170, 2, { price: 0.03, rep: 2 }, { date: '-22/1', fail: 0.06, desc: 'Presión intraocular con un soplo de aire, sin tocar el ojo ni anestesia: tonometría y cribado de glaucoma, +3 % precio.' });
  I('tonometro_contacto_rebote', 'Tonómetro de rebote portátil', 'Salud ocular', 16000, 60, 2, { rep: 1 }, { date: '14/1', fail: 0.03, desc: 'Sonda ultraligera que rebota en la córnea, sin soplo ni anestesia (la aplanación con anestesia es cosa del oftalmólogo). Ideal con niños, mayores y a domicilio.' });
  I('set_lc_prueba', 'Set de contactología (lentes de prueba, fluoresceína, filtro azul cobalto y analizador de LC)', 'Contactología', 12000, 70, 2, {}, { req: ['lampara_hendidura'], fail: 0.01, noUsed: true, desc: 'Lo que exige la norma gallega para adaptar lentillas: lentes de prueba, filtro azul cobalto en la lámpara para los fluorogramas y analizador de radios y bordes de lentes rígidas.' });
  I('kit_pediatrico', 'Kit de optometría pediátrica (optotipos infantiles, test de mirada preferencial, estereotest)', 'Pediatría', 3200, 0, 2, {}, { req: ['retinoscopio'], fail: 0.01, desc: 'Tests para los más pequeños, sin colirios: optometría pediátrica y control de miopía.' });
  I('maletin_portatil', 'Maletín portátil (autorrefractómetro de mano, retinoscopio, caja de pruebas)', 'Domicilio', 28000, 80, 2, {}, { req: ['caja_pruebas_gafa_prueba'], fail: 0.04, desc: 'Óptica a domicilio y residencias.' });
  /* --- gabinete digital --- */
  I('foropter_digital', 'Foróptero digital', 'Refracción', 45000, 270, 3, { pat: 0.10, conv: 0.02, rep: 2 }, { req: ['unidad_refraccion'], date: '11/1', fail: 0.08, desc: 'Conectado al autorrefractómetro y a la historia clínica, sin errores de transcripción: +10 % pacientes, +2 pts conversión, +2 reputación. Base de la telerrefracción.' });
  I('frontofocometro_digital', 'Frontofocómetro digital', 'Verificación', 14000, 80, 3, { def: 0.05, pat: 0.03 }, { req: ['frontofocometro_manual'], date: '8/1', fail: 0.05, desc: 'Lee progresivos, distancia pupilar y transmisión UV al instante: −5 % defectos, +3 % pacientes.' });
  I('lampara_hendidura_digital', 'Módulo de vídeo digital para la lámpara de hendidura', 'Salud ocular', 8000, 50, 3, { conv: 0.02, rep: 2, mkt: 0.05 }, { req: ['lampara_hendidura'], date: '10/1', fail: 0.06, desc: 'Fotos y vídeo del segmento anterior para el paciente y para la historia clínica: +2 pts conversión, +2 reputación.' });
  I('retinografo_no_midriatico', 'Retinógrafo no midriático', 'Imagen', 60000, 360, 3, { pat: 0.08, rep: 3 }, { date: '12/1', fail: 0.08, desc: 'Foto del fondo de ojo sin dilatar la pupila: cribado de retina y telemedicina con el oftalmólogo, +8 % pacientes, +3 reputación.' });
  I('topografo_corneal', 'Topógrafo corneal', 'Contactología', 48000, 290, 3, { rep: 2 }, { req: ['lampara_hendidura'], date: '6/1', fail: 0.07, desc: 'Mapa de miles de puntos de la córnea: imprescindible para ortoqueratología, lentes rígidas, esclerales y queratocono.' });
  I('centrado_digital', 'Torre de videocentrado digital', 'Venta técnica', 52000, 310, 3, { price: 0.12, conv: 0.03, def: 0.05, rep: 2 }, { part: 'progresivos', date: '15/1', fail: 0.06, desc: 'Mide al décimo de milímetro los parámetros de los progresivos personalizados: +12 % precio, +3 pts conversión, −5 % defectos. Requiere dominar las lentes progresivas (tecnología del taller).' });
  I('paquimetro', 'Paquímetro corneal', 'Salud ocular', 12000, 40, 3, { rep: 1 }, { req: ['tonometro_aire'], date: '7/1', fail: 0.04, desc: 'Espesor de la córnea en micras: corrige la lectura de la presión intraocular.' });
  I('kit_terapia_visual', 'Kit de terapia visual (flippers, cordón de Brock, vectogramas, prismas)', 'Terapia visual', 10000, 20, 3, {}, { fail: 0.01, desc: 'Material para insuficiencia de convergencia, disfunciones acomodativas y ambliopía.' });
  I('kit_baja_vision', 'Maletín de baja visión (telescopios, microscopios, lupas y filtros)', 'Baja visión', 16000, 30, 3, {}, { fail: 0.01, desc: 'Ayudas ópticas para aprovechar el resto visual (DMAE, retinopatía diabética, retinosis).' });
  I('cabina_audiologia', 'Cabina audiométrica insonorizada (< 40 dB), audiómetro, videotoscopio e impedanciómetro', 'Audiología', 72000, 300, 3, {}, { level: 2, date: '8/1', fail: 0.05, desc: 'Requisito sanitario de la sección de audiología protésica: ruido ambiente por debajo de 40 dB. Abre el centro auditivo (necesita un Técnico Superior en Audiología Protésica).' });
  /* --- centro de especialidades e instituto --- */
  I('oct', 'OCT (tomografía de coherencia óptica)', 'Imagen', 140000, 840, 4, { pat: 0.10, conv: 0.03, price: 0.05, rep: 5 }, { req: ['retinografo_no_midriatico'], date: '18/1', fail: 0.10, desc: 'Cortes de la mácula y del nervio óptico: cribado de glaucoma y mácula con informe para el oftalmólogo. +10 % pacientes, +3 pts conversión, +5 reputación. Rentable si se usa 3 días por semana.' });
  I('campimetro', 'Campímetro computerizado (perímetro automático)', 'Salud ocular', 100000, 900, 4, { rep: 3 }, { req: ['tonometro_aire'], date: '-20/1', fail: 0.10, desc: 'Campo visual: cribado de glaucoma, neurología, baja visión y certificados.' });
  I('biometro_optico', 'Biómetro óptico (longitud axial)', 'Control de miopía', 90000, 540, 4, { rep: 2 }, { date: '21/1', fail: 0.07, desc: 'Longitud axial del ojo en micras sin contacto: control de miopía de calidad y cogestión de cataratas con el oftalmólogo.' });
  I('camara_ojo_seco_meibografia', 'Analizador de superficie ocular y meibógrafo', 'Ojo seco', 52000, 310, 4, { rep: 2 }, { req: ['lampara_hendidura'], date: '22/1', fail: 0.07, desc: 'Ruptura lagrimal no invasiva, menisco y glándulas de Meibomio: abre la unidad de ojo seco.' });
  I('aberrometro_multidiagnostico', 'Estación multifunción de pre-examen', 'Imagen', 72000, 430, 4, { pat: 0.08, price: 0.05, rep: 3 }, { date: '22/1', fail: 0.08, substitutes: ['autorrefractometro_queratometro', 'tonometro_aire', 'topografo_corneal', 'paquimetro'], desc: 'Autorrefracción, queratometría, tonometría, paquimetría y topografía en un solo equipo: +8 % pacientes y sustituye a los cuatro.' });
  I('terapia_visual_digital', 'Terapia visual digital (pantalla táctil, gafas estroboscópicas, luces de reacción)', 'Terapia visual', 32000, 100, 4, { rep: 2 }, { req: ['kit_terapia_visual'], date: '23/1', fail: 0.05, desc: 'Visión deportiva (tiempo de reacción ojo-mano, sacádicos) y terapia gamificada con más capacidad.' });
  I('set_esclerales', 'Set de pruebas de lentes esclerales e híbridas', 'Contactología', 12000, 60, 4, {}, { req: ['topografo_corneal'], fail: 0.01, noUsed: true, desc: 'Necesario para adaptar esclerales.' });
  I('estacion_telerrefraccion', 'Estación de telerrefracción (foróptero remoto + videoconsulta)', 'Tele-optometría', 120000, 900, 4, {}, { req: ['foropter_digital', 'autorrefractometro_queratometro'], date: '22/1', fail: 0.12, noUsed: true, desc: 'Un optometrista atiende varias estaciones: +30 % pacientes por óptico, −3 pts conversión. Polémico.' });
  I('ipl_ojo_seco', 'Equipo de luz pulsada intensa (IPL) para ojo seco', 'Ojo seco', 100000, 600, 5, {}, { req: ['camara_ojo_seco_meibografia'], date: '25/1', fail: 0.08, desc: 'Trata la disfunción de las glándulas de Meibomio por sesiones, sin vender gafas.' });
  I('segundo_gabinete', 'Segundo gabinete equipado (otra sala ≥ 8 m²)', 'Obra', 160000, 300, 5, { boxes: 1 }, { level: 4, fail: 0, noUsed: true, desc: 'Otra sala independiente con su unidad de refracción: dos optometristas pasando consulta a la vez.' });
  const BY = {}; for (const it of INSTR) BY[it.id] = it;

  /* Especialidades (20). tier mínimo · research que la desbloquea · instr requeridos ('a|b' = cualquiera) · skill de ch.skills · role
     patients/semana base · dur minutos (carga sobre el box) · income € por paciente (real × 2) · toGlasses fracción que compra gafa
     rep reputación cuando está activa · pool recurrente que alimenta · detect probabilidad de evento "patología detectada" · genre bonus de ventas */
  const SPECS = [];
  function Sp(id, name, tier, research, instr, skill, role, o, desc) { SPECS.push(Object.assign({ id, name, tier, research, instr, skill, role: role || 'optico', patients: 0, dur: 30, income: 0, toGlasses: 0, rep: 0, desc }, o || {})); }
  Sp('refraccion_general', 'Refracción general (examen visual)', 1, 'AutorizacionSanitaria', ['optotipos_basicos', 'caja_pruebas_gafa_prueba', 'retinoscopio|autorrefractometro_queratometro', 'frontofocometro_manual'], null, 'optico', { base: true, dur: 25 }, 'Refracción objetiva y subjetiva, sin colirios: el examen de toda la vida y la puerta de entrada. Cada paciente que convierte compra una gafa graduada en la tienda (con examen de pago, 30 € reales con informe optométrico).');
  Sp('pediatrica_basica', 'Revisión visual infantil básica', 1, 'AutorizacionSanitaria', ['retinoscopio', 'optotipos_basicos'], null, 'optico', { patients: 4, dur: 30, income: 0, toGlasses: 0.5, rep: 1, genre: { infantil: 0.05 }, supersededBy: 'pediatrica' }, 'Revisiones gratuitas en colegios (con permiso del centro y de las familias, y sin vender dentro): no cobra, pero las familias vienen luego a por la gafa. Queda integrada en la optometría pediátrica cuando esta se activa.');
  Sp('cribado_basico', 'Cribado básico (presión intraocular, fondo de ojo y derivación)', 2, 'Gabinete', ['tonometro_aire|tonometro_contacto_rebote', 'oftalmoscopio_directo'], null, 'optico', { patients: 15, dur: 10, income: 40, toGlasses: 0.15, rep: 2, detect: 0.02 }, 'Tonometría sin anestesia y oftalmoscopia en diez minutos (10-20 € reales). No diagnosticamos: si algo no cuadra, informe de derivación al oftalmólogo. Da prestigio.');
  Sp('contactologia_blanda', 'Contactología (lentes blandas)', 2, 'Lentillas', ['lampara_hendidura', 'autorrefractometro_queratometro', 'set_lc_prueba'], null, 'optico', { patients: 10, dur: 40, income: 300, rep: 2, pool: 'lentillas' }, 'Adaptación (30-45 € de honorarios reales) más el primer pack de lentillas, unos 150 € por paciente. Margen estrecho, pero el usuario vuelve cuatro veces al año: ingresos recurrentes.');
  Sp('pediatrica', 'Optometría pediátrica', 2, 'Pediatrica', ['retinoscopio', 'kit_pediatrico'], null, 'optico', { patients: 10, dur: 45, income: 100, toGlasses: 0.5, rep: 2, genre: { infantil: 0.10 } }, 'Primera visita infantil completa (35-50 € reales) con retinoscopia y tests infantiles, sin ciclopléjico: eso es cosa del oftalmólogo. Absorbe las revisiones escolares. Bonus a las colecciones Infantil.');
  Sp('geriatrica_domicilio', 'Optometría geriátrica y a domicilio', 2, 'Geriatrica', ['maletin_portatil'], null, 'optico', { patients: 6, dur: 40, income: 300, toGlasses: 0.7, rep: 2, genre: { lectura: 0.10 } }, 'Residencias y domicilios con el maletín: convierten mucho y compran lectura.');
  Sp('audiologia', 'Audiología protésica (centro auditivo)', 3, 'Audiologia', ['cabina_audiologia'], 'audiologia', 'audioprotesista', { patients: 5, dur: 60, income: 1400, rep: 2, pool: 'audifonos', poolRate: 0.35 }, 'Audiometría gratuita en cabina y prueba de audífonos de 30 días; un 35 % se queda como usuario (audífono de 1.650-2.800 € reales la unidad). Necesita un Técnico Superior en Audiología Protésica.');
  Sp('contactologia_avanzada', 'Lentes rígidas permeables al gas e híbridas (córnea irregular)', 3, 'ContactologiaAvanzada', ['topografo_corneal', 'lampara_hendidura'], 'contactologia', 'optico', { patients: 3, dur: 60, income: 1000, rep: 3 }, 'Queratocono, córneas irregulares y poscirugía: adaptación de 45-120 € reales en varias visitas más las lentes. Pocos pacientes y derivaciones de oftalmólogos.');
  Sp('orto_k', 'Ortoqueratología nocturna', 3, 'OrtoK', ['topografo_corneal', 'lampara_hendidura'], 'contactologia', 'optico', { patients: 3, dur: 60, income: 2000, rep: 3, pool: 'ortok' }, 'Lentes rígidas nocturnas que remodelan la córnea: el niño ve sin gafas de día. Unos 1.000 € reales el primer año (adaptación y lentes) y renovación anual.');
  Sp('terapia_visual', 'Terapia visual', 3, 'TerapiaVisual', ['kit_terapia_visual'], 'terapia_visual', 'optico', { patients: 4, dur: 45, income: 1700, rep: 3 }, 'Programas de 12 a 24 sesiones (30-45 € reales cada una) para insuficiencia de convergencia, problemas acomodativos y ambliopía. Vende sesiones, no gafas.');
  Sp('baja_vision', 'Baja visión y rehabilitación visual', 3, 'BajaVision', ['kit_baja_vision'], 'baja_vision', 'optico', { patients: 2, dur: 90, income: 1200, toGlasses: 0.3, rep: 4 }, 'Telescopios, microscopios, lupas y filtros para quien ya no mejora con gafas (DMAE, retinopatía diabética). Enorme prestigio.');
  Sp('control_miopia_basico', 'Control de miopía infantil (lentes de desenfoque periférico, lentillas)', 3, 'ControlMiopia', ['autorrefractometro_queratometro', 'retinoscopio', 'kit_pediatrico'], 'control_miopia', 'optico', { patients: 5, dur: 45, income: 1200, rep: 3, pool: 'miopia', genre: { infantil: 0.15 } }, 'Frenar la miopía de los niños con lentes de desenfoque periférico o lentillas de control: unos 600 € reales al año y revisión cada seis meses.');
  Sp('cribado_retina', 'Cribado de retina (retinografía y telemedicina)', 3, 'Retinografo', ['retinografo_no_midriatico'], null, 'optico', { patients: 20, dur: 10, income: 60, toGlasses: 0.15, rep: 3, detect: 0.04 }, 'Retinografía sin dilatar en cada revisión (25-40 € reales) y lectura por un oftalmólogo a distancia. Abre la puerta a convenios con la Consellería.');
  Sp('esclerales', 'Lentes esclerales (queratocono, ojo seco severo)', 4, 'Esclerales', ['topografo_corneal', 'set_esclerales', 'lampara_hendidura'], 'contactologia', 'optico', { patients: 1.5, dur: 75, income: 2300, rep: 4 }, 'La élite de la contactología: adaptación de 150-280 € reales más las lentes, y pacientes derivados de toda la comunidad.');
  Sp('control_miopia_avanzado', 'Control de miopía con biometría', 4, 'ControlMiopiaAvanzado', ['biometro_optico', 'topografo_corneal'], 'control_miopia', 'optico', { patients: 8, dur: 45, income: 1600, rep: 3, pool: 'miopia' }, 'Longitud axial medida con el biómetro en cada revisión (60-90 € reales): programa anual premium, en contacto con el oftalmólogo.');
  Sp('ojo_seco', 'Unidad de ojo seco (estudio de superficie ocular)', 4, 'OjoSeco', ['camara_ojo_seco_meibografia', 'lampara_hendidura'], 'ojo_seco', 'optico', { patients: 5, dur: 40, income: 100, rep: 2, pool: 'ojoseco' }, 'Estudio de la lágrima y de las glándulas de Meibomio (unos 50 € reales) y pauta de higiene palpebral y lágrimas: productos cada mes.');
  Sp('vision_deportiva', 'Visión deportiva', 4, 'VisionDeportiva', ['terapia_visual_digital'], 'terapia_visual', 'optico', { patients: 2, dur: 60, income: 1000, rep: 2, genre: { deportiva: 0.15 } }, 'Entrenamiento visual para deportistas: tiempo de reacción, seguimiento y visión periférica. Los clubes llaman a la puerta.');
  Sp('cribado_avanzado', 'Cribado avanzado (OCT, campimetría y glaucoma)', 4, 'CribadoAvanzado', ['oct', 'campimetro', 'tonometro_aire'], null, 'optico', { patients: 20, dur: 15, income: 150, toGlasses: 0.2, rep: 5, detect: 0.06, convMod: 0.03 }, 'OCT y campo visual (45-75 € reales): informes de derivación y cogestión con el oftalmólogo, que es quien diagnostica. Somos la referencia clínica: +3 pts de conversión general.');
  Sp('ojo_seco_tratamiento', 'Tratamiento de ojo seco con luz pulsada (IPL)', 5, 'OjoSecoIPL', ['ipl_ojo_seco'], 'ojo_seco', 'optico', { patients: 3, dur: 30, income: 900, rep: 3 }, 'Bonos de varias sesiones de luz pulsada para la disfunción de las glándulas de Meibomio (300-450 € reales el bono).');
  Sp('teleoptometria', 'Tele-optometría / telerrefracción', 5, 'TeleOptometria', ['estacion_telerrefraccion'], null, 'optico', { patients: 0, dur: 18, income: 0, rep: -1, patOpt: 0.3, convMod: -0.03 }, '+30 % de pacientes por optometrista y −3 pts de conversión. El Colegio no lo ve claro.');
  const SPEC_BY = {}; for (const sp of SPECS) SPEC_BY[sp.id] = sp;

  const SKILLS = { contactologia: 'Máster en contactología', terapia_visual: 'Posgrado en terapia visual', baja_vision: 'Experto en baja visión', control_miopia: 'Certificación en manejo de la miopía', ojo_seco: 'Curso de ojo seco', audiologia: 'Técnico Superior en Audiología Protésica' };

  /* Recurrentes: monthly € por usuario activo (real × 2), capPerOpt usuarios por profesional, join fracción de pacientes nuevos que se quedan, churn semanal */
  const POOLS = {
    lentillas: { name: 'Usuarios de lentillas', monthly: 60, capPerOpt: 200, join: 0.6, churn: 0.0035 },
    ortok: { name: 'Pacientes de orto-k', monthly: 100, capPerOpt: 120, join: 0.5, churn: 0.003 },
    miopia: { name: 'Niños en control de miopía', monthly: 100, capPerOpt: 150, join: 0.7, churn: 0.0025 },
    audifonos: { name: 'Usuarios de audífonos (pilas y revisiones)', monthly: 15, capPerOpt: 300, join: 0.35, churn: 0.003 },
    ojoseco: { name: 'Pacientes de ojo seco (productos)', monthly: 40, capPerOpt: 120, join: 0.5, churn: 0.004 }
  };

  /* =====================================================================
     2. REGISTRO EN DATA.* (al cargar el fichero, antes de Modules.register)
     ===================================================================== */
  const CORE_IDS = ['Gabinete', 'Lentillas', 'Retinografo', 'TerapiaVisual']; // ya existían en data.js: se reescriben para el nuevo árbol
  const RES = [];
  function R(id, name, pointsCost, duration, cost, req, desc) { RES.push({ id, name, category: 'Gabinete', pointsCost, duration, cost, req, desc }); }
  const hasI = (c, id) => gab(c).instruments.indexOf(id) >= 0;
  const skillIn = (c, sk) => c.staff.some(s => s.skills && s.skills[sk]);
  R('AutorizacionSanitaria', 'Autorización sanitaria y registro', 10, 8000, 20000, c => c.level >= 2 && c.staff.some(s => s.role === 'optico'), 'Autorización sanitaria de instalación y funcionamiento (Decreto 12/2009) e inscripción en el Rexistro de centros sanitarios, con el número de registro visible en la fachada. Sin ella las colecciones Graduado venden la mitad. Permite comprar instrumental y abrir el gabinete reglamentario. Requiere local y un óptico-optometrista colegiado como director técnico (tú cuentas).');
  R('Gabinete', 'Gabinete clínico', 30, 12000, 60000, c => c.hasResearch('AutorizacionSanitaria') && gab(c).tier >= 1, 'Protocolos de pre-examen automático (autorrefractómetro-queratómetro, tonómetro de aire) para bajar la consulta de 30 a 20 minutos. Permite ampliar al gabinete clínico y activa el cribado básico con derivación al oftalmólogo.');
  R('Lentillas', 'Contactología (lentes blandas)', 60, 12000, 90000, c => c.hasResearch('Gabinete') && gab(c).tier >= 2 && hasI(c, 'lampara_hendidura'), 'Adaptación de lentes de contacto blandas (30-45 € de honorarios reales más el producto) y usuarios que vuelven cada pocos meses. En Galicia exige una segunda sala de 8 m², filtro azul cobalto y analizador de lentes de contacto (el set de contactología).');
  R('Pediatrica', 'Optometría pediátrica', 40, 10000, 60000, c => c.hasResearch('Gabinete') && gab(c).tier >= 2, 'Primera visita infantil completa con optotipos infantiles, test de mirada preferencial y estereotest, sin colirios. Bonus de ventas en Infantil.');
  R('Geriatrica', 'Óptica a domicilio y residencias', 40, 10000, 80000, c => c.hasResearch('Gabinete') && gab(c).tier >= 2, 'Convenios con residencias y visitas a domicilio con el maletín portátil. Los mayores convierten un 70 %.');
  R('Audiologia', 'Centro auditivo', 60, 12000, 120000, c => c.hasResearch('Gabinete') && c.level >= 2 && later(c, 8, 1), 'Cabina audiométrica insonorizada (< 40 dB) y un Técnico Superior en Audiología Protésica: audífonos con margen alto que sostienen los meses flojos de febrero y noviembre.');
  R('GabineteDigital', 'Gabinete digital', 80, 12000, 150000, c => c.hasResearch('Gabinete') && gab(c).tier >= 2 && c.level >= 3 && later(c, 11, 1), 'Foróptero digital conectado al autorrefractómetro y topografía corneal. Permite ampliar al gabinete digital.');
  R('ContactologiaAvanzada', 'Contactología avanzada (rígidas e híbridas)', 100, 15000, 200000, c => c.hasResearch('Lentillas') && gab(c).tier >= 3 && hasI(c, 'topografo_corneal'), 'Córneas irregulares y queratocono con lentes rígidas permeables al gas e híbridas, guiadas por la topografía. Para ejercerla hace falta un óptico con el Máster en contactología.');
  R('OrtoK', 'Ortoqueratología nocturna', 80, 12000, 120000, c => c.hasResearch('ContactologiaAvanzada') && later(c, 7, 1), 'Lentes rígidas nocturnas que remodelan la córnea para ver sin gafas de día. Renovación anual: fideliza muchísimo.');
  R('BajaVision', 'Baja visión', 80, 12000, 150000, c => c.hasResearch('GabineteDigital') && c.level >= 3, 'Unidad de rehabilitación visual y ayudas ópticas. Requiere un óptico con el Experto en baja visión.');
  R('Retinografo', 'Retinografía y centro de especialidades', 120, 15000, 250000, c => c.hasResearch('Lentillas') && gab(c).tier >= 3 && later(c, 12, 1), 'Cribado de retina con retinógrafo no midriático y lectura por telemedicina con el oftalmólogo. Permite ampliar al centro de especialidades optométricas (retinógrafo y campímetro).');
  R('CribadoAvanzado', 'Cribado avanzado y glaucoma', 100, 12000, 180000, c => c.hasResearch('Retinografo') && gab(c).tier >= 4, 'OCT, campimetría y tonometría en la revisión: cribado de glaucoma y mácula con informe de derivación; el diagnóstico es del oftalmólogo. Requiere OCT, campímetro y tonómetro.');
  R('TerapiaVisual', 'Terapia visual', 200, 15000, 400000, c => c.hasResearch('Retinografo') && gab(c).tier >= 3 && (c.level >= 4 || skillIn(c, 'terapia_visual')), 'Programas de terapia visual binocular y acomodativa. Requiere un óptico con el Posgrado en terapia visual.');
  R('VisionDeportiva', 'Visión deportiva', 100, 12000, 180000, c => c.hasResearch('TerapiaVisual') && later(c, 23, 1), 'Entrenamiento visual de deportistas con sistemas digitales, gafas estroboscópicas y luces de reacción. Bonus en Deportiva y contratos con clubes.');
  R('OjoSeco', 'Unidad de ojo seco', 120, 15000, 250000, c => c.hasResearch('Lentillas') && gab(c).tier >= 3 && later(c, 22, 1), 'Estudio de superficie ocular y meibografía con plan de tratamiento. Requiere el analizador de superficie ocular y el Curso de ojo seco.');
  R('OjoSecoIPL', 'Tratamiento de ojo seco con luz pulsada', 120, 12000, 200000, c => c.hasResearch('OjoSeco') && gab(c).tier >= 4 && later(c, 25, 1), 'Luz pulsada intensa por bonos de sesiones para la disfunción de las glándulas de Meibomio. Requiere equipo IPL.');
  R('ControlMiopia', 'Control de miopía', 100, 12000, 200000, c => c.hasResearch('Pediatrica') && gab(c).tier >= 3 && later(c, 20, 1), 'Lentes de desenfoque periférico, lentillas de control y ortoqueratología para frenar la miopía infantil. Requiere un óptico con la Certificación en manejo de la miopía.');
  R('ControlMiopiaAvanzado', 'Control de miopía con biometría', 120, 12000, 220000, c => c.hasResearch('ControlMiopia') && gab(c).tier >= 4, 'Longitud axial con biómetro óptico en cada revisión: programa anual premium.');
  R('Esclerales', 'Lentes esclerales', 120, 12000, 200000, c => c.hasResearch('ContactologiaAvanzada') && gab(c).tier >= 4, 'Esclerales e híbridas para queratocono y ojo seco severo. Requiere set de esclerales.');
  R('TeleOptometria', 'Tele-optometría', 200, 15000, 500000, c => c.hasResearch('GabineteDigital') && gab(c).tier >= 4 && later(c, 22, 1), 'Un optometrista remoto atiende varias estaciones de telerrefracción. Más pacientes, menos conversión y polémica con el Colegio.');
  for (const r of RES) {
    const ex = DATA.RESEARCH.find(x => x.id === r.id);
    if (!ex) DATA.RESEARCH.push(r);
    else if (CORE_IDS.indexOf(r.id) >= 0) Object.assign(ex, r);
    else console.warn('gabinete: investigación duplicada', r.id);
  }
  const RES_BY = {}; for (const r of RES) RES_BY[r.id] = r;
  const resName = id => (RES_BY[id] || DB.research(id) || { name: id }).name;

  const TRAIN = [
    { id: 'master_contactologia', name: 'Máster en contactología avanzada', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 0.3, dF: 0.1, rF: 1, sF: 0.1, maxP: 900, level: 3, skill: 'contactologia' },
    { id: 'posgrado_terapia_visual', name: 'Posgrado (máster) en terapia visual y visión deportiva', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 0.1, dF: 0.3, rF: 1, sF: 0.1, maxP: 900, level: 3, skill: 'terapia_visual' },
    { id: 'curso_baja_vision', name: 'Experto en baja visión y rehabilitación visual', cost: 70000, pointsCost: 10, duration: 15000, basePoints: 12, tF: 0.1, dF: 0.1, rF: 1, sF: 0, maxP: 700, level: 2, skill: 'baja_vision' },
    { id: 'curso_control_miopia', name: 'Certificación en manejo de la miopía', cost: 70000, pointsCost: 10, duration: 15000, basePoints: 12, tF: 0.2, dF: 0.1, rF: 1, sF: 0, maxP: 700, level: 2, skill: 'control_miopia' },
    { id: 'curso_ojo_seco', name: 'Curso de superficie ocular y ojo seco', cost: 50000, pointsCost: 10, duration: 12000, basePoints: 10, tF: 0.1, dF: 0.1, rF: 1, sF: 0, maxP: 700, level: 2, skill: 'ojo_seco' },
    { id: 'fp_audiologia', name: 'Técnico Superior en Audiología Protésica (FP, 2.000 h)', cost: 90000, pointsCost: 20, duration: 25000, basePoints: 12, tF: 0.3, dF: 0.1, rF: 0.6, sF: 0.1, maxP: 700, level: 2, skill: 'audiologia' }
  ];
  for (const t of TRAIN) if (!DATA.TRAINING.some(x => x.id === t.id)) DATA.TRAINING.push(t);

  /* =====================================================================
     3. ESTADO
     ===================================================================== */
  function defaults() {
    return { v: 1, tier: 0, instruments: [], used: {}, broken: {}, examMode: 'cobro', patientsWeek: 0, convertedWeek: 0, conversion: 0, reputation: 40, active: [], pools: {}, hist: [], months: [],
      month: { patients: 0, income: 0, exams: 0, spec: 0, rec: 0, glasses: 0 }, boosts: [], convenioUntil: 0, closedUntil: 0, teleSuspendedUntil: 0, repPenalty: 0, repBonus: 0, fanAcc: 0, week: 0,
      noDTWeeks: 0, lastInspection: -99, lastDetect: -99, lastConvenio: -99, lastPolemica: -99, lastClub: -99, lastShowroomer: -99, lastProgresivos: -99, flags: {}, log: [],
      stats: { patients: 0, income: 0, breakdowns: 0, fines: 0, detections: 0, invested: 0 } };
  }
  function init(co) {
    co.modules = co.modules || {};
    const d = defaults(); const old = (co.modules[ID] && typeof co.modules[ID] === 'object') ? co.modules[ID] : {}; const s = co.modules[ID] = Object.assign(defaults(), old);
    for (const k of ['used', 'broken', 'pools', 'month', 'flags', 'stats']) if (!s[k] || typeof s[k] !== 'object' || Array.isArray(s[k])) s[k] = d[k];
    for (const k of ['instruments', 'active', 'hist', 'months', 'boosts', 'log']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['convenioUntil', 'closedUntil', 'teleSuspendedUntil', 'repPenalty', 'repBonus', 'fanAcc', 'week', 'noDTWeeks', 'patientsWeek', 'convertedWeek', 'conversion', 'lastShowroomer', 'lastProgresivos']) if (!isFinite(+s[k])) s[k] = d[k];
    s.stats = Object.assign({ patients: 0, income: 0, breakdowns: 0, fines: 0, detections: 0, invested: 0 }, s.stats);
    s.month = Object.assign({ patients: 0, income: 0, exams: 0, spec: 0, rec: 0, glasses: 0 }, s.month);
    s.instruments = s.instruments.filter((id, i, a) => BY[id] && a.indexOf(id) === i);
    s.active = s.active.filter(id => SPEC_BY[id]); s.boosts = s.boosts.filter(b => b && isFinite(+b.until) && isFinite(+b.mult));
    for (const id of Object.keys(s.broken)) if (!BY[id] || !isFinite(+s.broken[id])) delete s.broken[id];
    s.tier = U.clamp(Math.floor(+s.tier || 0), 0, 5); s.reputation = U.clamp(isFinite(+s.reputation) ? +s.reputation : 40, 0, 100);
    if (s.examMode !== 'cobro') s.examMode = 'gratis';
    for (const k in POOLS) { if (!s.pools[k] || typeof s.pools[k].n !== 'number') s.pools[k] = { n: 0 }; }
    /* partidas anteriores a este módulo: si ya habían investigado el gabinete del núcleo, se les monta el equivalente */
    if (!s.flags.migrated) {
      s.flags.migrated = true;
      if (s.tier === 0 && typeof co.hasResearch === 'function' && co.hasResearch('Gabinete')) {
        if (!co.hasResearch('AutorizacionSanitaria')) co.researchCompleted.push('AutorizacionSanitaria');
        const grant = TIERS[1].instr.concat(TIERS[2].instr); s.tier = 2;
        if (co.hasResearch('Retinografo')) { grant.push('retinografo_no_midriatico', 'topografo_corneal', 'foropter_digital'); if (co.level >= 3) { s.tier = 3; if (!co.hasResearch('GabineteDigital')) co.researchCompleted.push('GabineteDigital'); } }
        if (co.hasResearch('Lentillas')) grant.push('set_lc_prueba');
        for (const id of grant) if (s.instruments.indexOf(id) < 0) s.instruments.push(id);
      }
    }
    /* partidas guardadas antes del pase de realismo: el gabinete reglamentario exige ahora también oftalmoscopio, lámpara de hendidura e
       interpupilómetro (Decreto 12/2009); a quien ya lo tenía abierto se le dan para que la inspección no le multe por un cambio de reglas */
    if (!s.flags.realism1) {
      s.flags.realism1 = true;
      if (s.tier >= 1) for (const id of TIERS[1].instr) if (s.instruments.indexOf(id) < 0) s.instruments.push(id);
    }
  }
  const S = co => { if (!co.modules || !co.modules[ID]) init(co); return co.modules[ID]; };

  /* =====================================================================
     4. CÁLCULO SEMANAL (puro: lo usa weekly y el panel)
     ===================================================================== */
  const lvl = x => (typeof x.level === 'function' ? x.level() : 1);
  /* capacidad de un optometrista: 1 = los pacientes base del tier. Nivel 1 → 0,8; nivel 6+ → 1,1; el dueño (id 0) conoce a la clientela (+0,1);
     la eficiencia (recién contratado 5 %, vuelve al 100 % en unas semanas) pesa un 40 % */
  const weight = x => (0.8 + 0.06 * Math.min(Math.max(lvl(x) - 1, 0), 5) + (x.id === 0 ? 0.1 : 0)) * (0.6 + 0.4 * U.clamp(x.efficiency === undefined ? 1 : x.efficiency, 0, 1));
  const isAudio = x => x.role === 'audioprotesista' || !!(x.skills && x.skills.audiologia);
  function staffInfo(co) {
    const assigned = co.staff.filter(x => x.assignment === ID);
    const present = assigned.filter(x => x.state === 'idle'); // de vacaciones, formándose o investigando no pasan consulta
    const opts = present.filter(x => x.role === 'optico');
    const audios = present.filter(x => x.role !== 'optico' && isAudio(x));
    const aux = present.filter(x => opts.indexOf(x) < 0 && audios.indexOf(x) < 0);
    const optW = opts.reduce((a, x) => a + weight(x), 0);
    const dtPresent = co.staff.some(x => x.role === 'optico' && x.state !== 'vacation'); // director técnico: un óptico colegiado en plantilla que no esté de vacaciones
    return { assigned, present, opts, audios, aux, optW, dtPresent };
  }
  function own(s, id) { return s.instruments.indexOf(id) >= 0; }
  function working(s, id) {
    if (own(s, id) && !s.broken[id]) return true;
    const ab = BY.aberrometro_multidiagnostico; return own(s, ab.id) && !s.broken[ab.id] && ab.substitutes.indexOf(id) >= 0;
  }
  function instrFx(s) {
    const fx = { pat: 0, conv: 0, price: 0, rep: 0, def: 0, rec: 0, mkt: 0, boxes: 0, usedCount: 0 };
    for (const id of s.instruments) { const it = BY[id]; if (!it) continue; if (s.used[id]) fx.usedCount++; if (s.broken[id]) continue; for (const k in it.fx) fx[k] = (fx[k] || 0) + it.fx[k]; }
    return fx;
  }
  function instrLabel(token) { return token.split('|').map(id => BY[id] ? BY[id].name : id).join(' o '); }
  function qualified(sp, st) {
    if (sp.role === 'audioprotesista') return st.audios.length;
    return st.opts.filter(x => !sp.skill || (x.skills && x.skills[sp.skill])).length;
  }
  /* 'a|b' en sp.instr = vale cualquiera de los dos (p. ej. retinoscopio o autorrefractómetro) */
  const tokenOk = (s, t) => t.split('|').some(id => working(s, id));
  function specStatus(co, s, sp, st, w) {
    const miss = [];
    if (s.tier < sp.tier) miss.push(`gabinete «${TIERS[sp.tier].name}»`);
    if (!co.hasResearch(sp.research)) miss.push(`investigar «${resName(sp.research)}»`);
    for (const t of sp.instr) if (!tokenOk(s, t)) { const brokenOwned = t.split('|').some(id => own(s, id) && s.broken[id]); miss.push(instrLabel(t) + (brokenOwned ? ' (averiado)' : '')); }
    const q = qualified(sp, st);
    if (!q) miss.push(sp.role === 'audioprotesista' ? 'un/a audioprotesista asignado/a al gabinete' : sp.skill ? `un/a óptico/a con «${SKILLS[sp.skill]}» asignado/a` : 'un/a óptico/a asignado/a');
    if (sp.id === 'teleoptometria' && s.teleSuspendedUntil > w) miss.push('servicio suspendido tras la polémica');
    return { ok: !miss.length, miss, q };
  }
  /* estado de todas las especialidades; una especialidad "superseded" (revisión infantil básica) se integra en la completa cuando esta funciona */
  function allStatuses(co, s, st, w) {
    const statuses = {};
    for (const sp of SPECS) statuses[sp.id] = specStatus(co, s, sp, st, w);
    for (const sp of SPECS) { if (sp.supersededBy && statuses[sp.id].ok && statuses[sp.supersededBy] && statuses[sp.supersededBy].ok) { const r = statuses[sp.id]; r.ok = false; r.superseded = true; r.miss = [`integrada en «${SPEC_BY[sp.supersededBy].name}»`]; } }
    return statuses;
  }
  function compute(co, s, w) {
    const st = staffInfo(co); const fx = instrFx(s); const T = TIERS[s.tier];
    const mk = (co.modules && co.modules.marketing) || {}; const lab = (co.modules && co.modules.lab) || {};
    const traffic = U.clamp(+mk.traffic || 0, -0.3, 0.6), mkPat = U.clamp(+mk.patients || 0, 0, 0.5), stars = U.clamp(+mk.stars || 4, 2.5, 5), retention = U.clamp(+mk.retention || 30, 0, 100);
    const boxes = s.tier >= 1 ? 1 + (fx.boxes || 0) : 0; const closed = s.closedUntil > w;
    const statuses = allStatuses(co, s, st, w); const active = [];
    for (const sp of SPECS) if (statuses[sp.id].ok && s.tier >= 1) active.push(sp);
    const baseOk = statuses.refraccion_general.ok; const tele = active.some(sp => sp.id === 'teleoptometria');
    /* capacidad: optometristas presentes (peso por nivel y eficiencia), tope 1,5 por box (turnos), +30 % con telerrefracción, +15 % por auxiliar (máx. 2) */
    const optEff = Math.min(st.optW, boxes * 1.5) * (tele ? 1.3 : 1);
    const auxF = 1 + 0.15 * Math.min(st.aux.length, 2);
    const repF = 0.8 + 0.4 * s.reputation / 100; const mode = K.MODE[s.examMode] || K.MODE.gratis;
    let tempF = 1; for (const b of s.boosts) tempF *= b.mult; if (s.convenioUntil > w) tempF *= 1.2;
    const patMult = 1 + Math.min(K.PAT_CAP, fx.pat);
    const capacity = !closed && s.tier >= 1 ? T.patients * optEff * auxF : 0;                                 // exámenes que caben en el box a la semana
    const demand = baseOk ? capacity * patMult * (1 + traffic + mkPat) * repF * mode.pat * tempF : 0;         // exámenes generales que entran por la puerta
    const specs = []; let load = 0;
    for (const sp of active) {
      if (sp.base || !sp.patients) continue;
      const q = statuses[sp.id].q; const p = closed ? 0 : sp.patients * Math.min(1.3, 0.85 + 0.15 * q) * repF * (1 + traffic / 2) * (1 + 0.05 * (s.tier - sp.tier)) * tempF;
      specs.push({ sp, p, q }); load += p * sp.dur / K.MIN_EXAM * K.SPEC_LOAD;
    }
    /* las especialidades ocupan box: si no cabe todo, se recortan proporcionalmente; el examen general se queda con el hueco que deja el box
       (hasta OVERBOOK × capacidad): con más demanda que box hay que ampliar, abrir un segundo box o asignar más optometristas */
    const squeeze = load > capacity && load > 0 ? capacity / load : 1;
    if (squeeze < 1) { for (const x of specs) x.p *= squeeze; load = capacity; }
    const seen = Math.min(demand, capacity * K.OVERBOOK);
    const general = Math.max(0, seen - load); const lost = Math.max(0, demand - load - general);
    const labBonus = lab.deliveryDays !== undefined ? (lab.deliveryDays <= 1 ? 0.10 : lab.deliveryDays <= 3 ? 0.05 : 0) - Math.min(0.1, (+lab.defectRate || 0) * 0.5) : 0;
    const convMod = active.reduce((a, sp) => a + (sp.convMod || 0), 0);
    const conv = s.tier >= 1 && baseOk ? U.clamp(T.conv + fx.conv + labBonus + (stars - 4) * 0.05 + mode.conv + convMod, 0.1, K.CONV_CAP) : 0;
    const converted = general * conv + specs.reduce((a, x) => a + x.p * (x.sp.toGlasses || 0), 0);
    const priceMult = 1 + Math.min(0.3, fx.price);
    const exams = s.examMode === 'cobro' ? general * K.EXAM_PRICE * priceMult : 0;
    const spec = specs.reduce((a, x) => a + x.p * x.sp.income, 0) * K.SCALE;
    let rec = 0; for (const k in POOLS) rec += (s.pools[k] ? s.pools[k].n : 0) * POOLS[k].monthly / K.WEEKS_MONTH * K.SCALE;
    const patients = general + specs.reduce((a, x) => a + x.p, 0);
    const glasses = glassesCash(converted);
    return { st, fx, T, boxes, closed, active, statuses, specs, capacity, demand, general, lost, load, squeeze, conv, converted, exams, spec, rec, glasses, patients, repF, traffic, mkPat, stars, retention, tele, priceMult, baseOk, labBonus, mode };
  }
  /* gafa graduada: la vende la tienda si existe; si no, el gabinete cobra ticket real × margen por paciente convertido */
  const glassesCash = converted => (Modules.get('tienda') ? 0 : converted * K.TICKET * K.GLASS_MARGIN);
  function repTarget(s, c) {
    const specRep = c.active.reduce((a, sp) => a + (sp.rep || 0), 0);
    return 25 + 2 * s.tier + Math.min(30, c.fx.rep) + Math.min(25, specRep) + (s.examMode === 'cobro' ? 3 : 0) - 2 * c.fx.usedCount - 5 * (c.lost > c.capacity * 0.5 ? 1 : 0) - s.repPenalty + s.repBonus + (c.stars - 4) * 5;
  }
  function addLog(s, w, text) { s.log.push({ w, text }); if (s.log.length > 8) s.log.shift(); }

  /* =====================================================================
     5. GANCHOS DEL MOTOR
     ===================================================================== */
  function weekly(co, w) {
    const s = S(co); s.week = w;
    s.boosts = s.boosts.filter(b => b.until > w);
    if (s.convenioUntil && s.convenioUntil <= w) { s.convenioUntil = 0; notify('Fin del convenio', 'Termina el programa de prevención visual de la Consellería. Volvemos al ritmo normal de pacientes.', 'news'); }
    for (const id of Object.keys(s.broken)) if (s.broken[id] <= w) { delete s.broken[id]; G.log(`Gabinete: ${BY[id] ? BY[id].name : id} vuelve a estar operativo.`); }
    if (s.tier < 1) { s.patientsWeek = 0; s.convertedWeek = 0; s.conversion = 0; s.active = []; return; }
    const c = compute(co, s, w); s.active = c.active.map(sp => sp.id);
    const general = c.general * (0.9 + 0.2 * U.rnd());
    const specs = c.specs.map(x => ({ sp: x.sp, p: x.p * (0.85 + 0.3 * U.rnd()) }));
    const specPatients = specs.reduce((a, x) => a + x.p, 0);
    const patientsWeek = Math.round(general + specPatients);
    const converted = general * c.conv + specs.reduce((a, x) => a + x.p * (x.sp.toGlasses || 0), 0);
    const exams = s.examMode === 'cobro' ? general * K.EXAM_PRICE * c.priceMult : 0;
    const spec = specs.reduce((a, x) => a + x.p * x.sp.income, 0) * K.SCALE;
    /* recurrentes: altas desde las especialidades, bajas por churn (menos con buena recurrencia y software de citas) */
    let rec = 0; const retF = 1 - c.retention / 200; const recF = 1 - Math.min(0.3, c.fx.rec);
    for (const k in POOLS) {
      const P = POOLS[k]; const pool = s.pools[k]; const feeders = specs.filter(x => x.sp.pool === k); const alive = feeders.length > 0;
      const join = feeders.reduce((a, x) => a + x.p * (x.sp.poolRate || P.join), 0);
      const churn = P.churn * retF * recF * (alive ? 1 : 4);
      const cap = P.capPerOpt * Math.max(1, k === 'audifonos' ? c.st.audios.length : c.st.opts.length);
      let n = pool.n * (1 - churn) + join; if (alive) n = Math.min(cap, n); pool.n = n < 0.5 ? 0 : n;
      rec += pool.n * P.monthly / K.WEEKS_MONTH * K.SCALE;
    }
    const glasses = glassesCash(converted);
    const total = exams + spec + rec + glasses;
    if (total >= 1) co.adjustCash(Math.round(total), 'Gabinete');
    s.fanAcc += patientsWeek / 20; const f = Math.floor(s.fanAcc); if (f > 0) { co.adjustFans(f); s.fanAcc -= f; }
    /* reputación: se acerca al objetivo; las penalizaciones y bonus se diluyen */
    const target = repTarget(s, c); s.reputation = U.clamp(s.reputation + (target - s.reputation) * 0.08, 0, 100);
    s.repPenalty = s.repPenalty > 0.1 ? s.repPenalty * 0.92 : 0; s.repBonus = s.repBonus > 0.1 ? s.repBonus * 0.96 : 0;
    /* históricos */
    s.hist.push({ w, p: patientsWeek, c: Math.round(converted), inc: Math.round(total), ex: Math.round(exams), sp: Math.round(spec), rc: Math.round(rec), gl: Math.round(glasses) }); if (s.hist.length > K.HIST) s.hist.shift();
    const m = s.month; m.patients += patientsWeek; m.income += total; m.exams += exams; m.spec += spec; m.rec += rec; m.glasses += glasses;
    s.stats.patients += patientsWeek; s.stats.income += total;
    s.patientsWeek = patientsWeek; s.convertedWeek = Math.round(converted); s.conversion = Math.round(c.conv * 1000) / 1000;
    /* cansancio del optometrista: encadenar exámenes por encima de la capacidad del box cansa y provoca errores de graduación */
    { const util = c.capacity > 0 ? (c.load + c.general) / c.capacity : 0; s.saturation = Math.round(util * 100);
      const opts = c.st.opts || []; if (util > 1.0 && opts.length) { for (const o of opts) if (o.adjustEfficiency) o.adjustEfficiency(-(0.01 + 0.2 * (util - 1))); }
      const tired = opts.filter(o => (o.efficiency === undefined ? 1 : o.efficiency) < 0.7);
      if (tired.length) { const err = Math.min(0.08, 0.03 * tired.length); s.repPenalty = (s.repPenalty || 0) + err * 10; s.flags.tiredWeeks = (s.flags.tiredWeeks || 0) + 1;
        if (!s.flags.tiredWarn || w - s.flags.tiredWarn >= 12) { s.flags.tiredWarn = w; G.log(`Gabinete: ${tired.map(o => o.name.split(' ')[0]).join(' y ')} ${tired.length > 1 ? 'están saturados' : 'está saturado/a'}: más errores de graduación y remontajes. Más optometristas, un auxiliar o vacaciones.`); if (typeof UI !== 'undefined' && UI.newsBanner) UI.newsBanner({ header: '⚠️ Optometrista agotado/a', text: `${tired[0].name} encadena demasiados exámenes: empieza a equivocarse con las graduaciones (baja la reputación clínica).` }); } } }
    events(co, s, w, c); breakdowns(co, s, w);
  }
  function monthly(co, d) {
    const s = S(co); if (s.tier < 1) return; const m = s.month;
    s.months.push({ y: d.year, m: d.month === 1 ? 12 : d.month - 1, patients: m.patients, income: Math.round(m.income), exams: Math.round(m.exams), spec: Math.round(m.spec), rec: Math.round(m.rec), glasses: Math.round(m.glasses), maint: monthlyCost(co) }); if (s.months.length > 12) s.months.shift();
    if (m.patients > 0) G.log(`Gabinete: ${U.num(m.patients)} pacientes este mes, ${money(m.income)} (exámenes ${U.shortMoney(m.exams)} · especialidades ${U.shortMoney(m.spec)} · recurrentes ${U.shortMoney(m.rec)}${m.glasses ? ' · gafas ' + U.shortMoney(m.glasses) : ''}).`);
    s.month = { patients: 0, income: 0, exams: 0, spec: 0, rec: 0, glasses: 0 };
  }
  function monthlyCost(co) { const s = S(co); let c = TIERS[s.tier].maint; for (const id of s.instruments) if (BY[id]) c += BY[id].maint; return c; }
  function salesFactor(co, g) {
    const genres = [g.genre, g.secondGenre].filter(Boolean); let f = 1; const s = S(co); const act = s.active || [];
    if (genres.indexOf('graduado') >= 0 && !co.hasResearch('AutorizacionSanitaria')) { const pl = g.platforms || []; const own = pl.filter(p => ['tienda', 'mercadillos', 'webpropia'].includes(p)).length / Math.max(1, pl.length); f *= 1 - 0.5 * own; }
    if (genres.indexOf('graduado') >= 0 && s.tier >= 2) f *= 1 + 0.015 * s.tier;
    for (const gen of genres) { let b = 0; for (const id of act) { const sp = SPEC_BY[id]; if (sp && sp.genre && sp.genre[gen]) b += sp.genre[gen]; } f *= 1 + Math.min(0.15, b) * 0.6; }
    return f;
  }
  function scoreFactor(co, g) {
    const genres = [g.genre, g.secondGenre].filter(Boolean); if (!genres.some(x => x === 'graduado' || x === 'lectura' || x === 'infantil')) return 1;
    /* nivel del gabinete y verificación (frontofocómetros, pupilómetro, centrado) suben la nota de los tipos clínicos hasta +8 %; +2 % en Infantil con pediatría o control de miopía. Tope 1,1 */
    const s = S(co); const fx = instrFx(s); let f = Math.min(1.08, 1 + 0.01 * s.tier + Math.min(0.04, fx.def * 0.5)); if (genres.indexOf('infantil') >= 0 && (s.active || []).some(id => id === 'pediatrica' || id === 'control_miopia_basico' || id === 'control_miopia_avanzado')) f += 0.02;
    return Math.min(1.1, f);
  }
  function candidateBonus(co) { const s = S(co); return s.reputation > 60 ? Math.min(0.1, (s.reputation - 60) / 400) : 0; }
  function onCreateGame(co, g) {
    const s = S(co); const genres = [g.genre, g.secondGenre].filter(Boolean);
    if (genres.indexOf('graduado') >= 0 && !co.hasResearch('AutorizacionSanitaria')) { const txt = `${g.title} es una colección de Graduado, pero no tenemos autorización sanitaria ni gabinete: habrá que mandar a la gente a graduarse a otra óptica y en nuestros canales (Tienda y Mercadillos) venderemos la mitad; la nota no cambia. ${co.level >= 2 ? 'Investiga «Autorización sanitaria y registro» (categoría Gabinete).' : 'Hace falta un local comercial para poder registrarnos; hasta entonces, Sol, Deportiva, Infantil y Lectura dan más dinero.'}`; if (s.flags.warnedNoAuth) G.log('⚠️ ' + txt); else { s.flags.warnedNoAuth = true; notify('Sin autorización sanitaria', txt); } }
    else if (genres.indexOf('graduado') >= 0 && s.tier === 0 && !s.flags.hintTier) { s.flags.hintTier = true; notify('Gabinete', `Ya tenemos autorización sanitaria. Con la sala de 8 m², el instrumental obligatorio y ${money(TIERS[1].cost)} podemos abrir el ${TIERS[1].name.toLowerCase()} desde el departamento Gabinete: cada paciente que graduemos comprará gafas en la tienda.`); }
  }
  function onResearch(co, item) {
    if (!item || !RES_BY[item.id]) return; const s = S(co);
    if (item.id === 'AutorizacionSanitaria') { notify('Rexistro sanitario', `Ya somos establecimiento sanitario con número de registro. Las colecciones Graduado venden con normalidad y en el departamento Gabinete puedes comprar el instrumental obligatorio del Decreto 12/2009 y abrir el ${TIERS[1].name.toLowerCase()} (${money(TIERS[1].cost)}).`); return; }
    const t = TIERS.find(x => x.research === item.id && x.tier === s.tier + 1); if (t) { notify('Gabinete', `Con «${item.name}» ya podemos ampliar al ${t.name} (${money(t.cost)}) en cuanto tengamos ${t.instr.map(id => BY[id].name).join(', ')}.`); return; }
    const sp = SPECS.filter(x => x.research === item.id); if (!sp.length) return;
    const st = staffInfo(co); const all = allStatuses(co, s, st, s.week); const txt = sp.map(x => { const r = all[x.id]; return `• ${x.name}: ${r.ok ? 'activa desde esta semana' : 'falta ' + r.miss.join(', ')}`; }).join('\n');
    notify('Nueva especialidad', `${item.name} investigado.\n${txt}`);
  }
  function onTraining(co, ch, tr) {
    if (!tr || !tr.skill || !SKILLS[tr.skill]) return;
    if (tr.skill === 'audiologia' && ch.role === 'dependiente') { ch.role = 'audioprotesista'; notify('Audioprotesista', `${ch.name} ya es Técnico Superior en Audiología Protésica y pasa a ser audioprotesista. Si lo asignas al gabinete con una cabina audiométrica insonorizada, abrimos el centro auditivo.`); return; }
    const unl = SPECS.filter(sp => sp.skill === tr.skill && co.hasResearch(sp.research)); if (unl.length && ch.assignment !== ID) G.log(`${ch.name} ya puede ejercer ${unl.map(x => x.name).join(', ')} si lo asignas al gabinete.`);
  }
  function onAssign(co, ch, dept) {
    if (dept !== ID) return; const s = S(co);
    if (ch.role !== 'optico' && !isAudio(ch)) G.log(`${ch.name} hará de recepción y pre-pruebas en el gabinete (+15 % de pacientes). Solo los ópticos pueden graduar.`);
    else if (s.tier === 0) G.log(`${ch.name} espera en un gabinete que todavía no existe. Ábrelo desde el departamento Gabinete.`);
    else if (ch.id === 0) G.log(`Pasas consulta tú mismo: ${TIERS[s.tier].patients} pacientes base a la semana, pero las colecciones se quedan sin ti.`);
  }
  /* eventos del núcleo (G.randomEvents / ferias / premios): la inspección rutinaria del núcleo también deja huella en el gabinete */
  function onEvent(co, id, data) {
    const s = S(co); if (s.tier < 1) return;
    if (id === 'inspection') { s.repPenalty += 2; s.stats.fines++; addLog(s, Math.floor(co.currentWeek), `Inspección rutinaria del núcleo: multa ${money((data && data.fine) || 0)}`); }
    else if (id === 'celebrity' || id === 'awards') s.repBonus += 1;
  }

  /* ---------- eventos ---------- */
  const hit = pAnnual => U.rnd() < pAnnual / 48;
  /* hallazgos de cribado (EVT_GAB_03): el optometrista no diagnostica; ve signos compatibles y deriva con informe al oftalmólogo */
  const PATHOLOGIES = [
    { n: 'un glaucoma incipiente (presión alta y excavación del nervio óptico)', who: 'un paciente de 54 años que venía "solo a cambiar los cristales"' },
    { n: 'una retinopatía diabética', who: 'una clienta de toda la vida que no sabía que era diabética' },
    { n: 'un desprendimiento de retina', who: 'un chaval de 19 años que veía "moscas" y destellos' },
    { n: 'una degeneración macular', who: 'una señora que creía que era cosa de la edad' }
  ];
  const progresivosOk = co => { try { const pt = DB.part('progresivos'); return !!((pt && pt.start) || co.researchCompleted.includes('progresivos')); } catch (e) { return false; } };
  function events(co, s, w, c) {
    /* 1. Director técnico ausente: inspección casi segura */
    if (!c.st.dtPresent) { s.noDTWeeks++; if (s.noDTWeeks >= 2 && U.rnd() < 0.4 && s.lastInspection < w - 8) inspection(co, s, w, 'noDT'); }
    else {
      s.noDTWeeks = 0;
      /* 2. Inspección sanitaria sorpresa (EVT_GAB_01: ≈0,4 al año) */
      if (hit(0.4) && s.lastInspection < w - 24) inspection(co, s, w, 'routine');
    }
    /* 3. Hallazgo en un cribado: decisión de derivar (EVT_GAB_03) */
    const det = c.specs.reduce((a, x) => a + (x.sp.detect || 0) * x.p, 0) / 25;
    if (det > 0 && s.lastDetect < w - 20 && U.rnd() < Math.min(0.15, det)) {
      s.lastDetect = w; const pi = Math.floor(U.rnd() * PATHOLOGIES.length) % PATHOLOGIES.length; const p = PATHOLOGIES[pi]; const opt = c.st.opts[0];
      notify('Hallazgo en el cribado', `${opt ? opt.name : 'Nuestro equipo'} ve en ${p.who} signos compatibles con ${p.n}. No podemos diagnosticar ni tratar: lo que toca es un informe optométrico urgente con las pruebas y derivarlo al oftalmólogo. ¿Qué hacemos?`, 'decision', { sourceId: 'gabinete:derivacion', options: ['Informe urgente y derivación al oftalmólogo', 'Venderle unas gafas nuevas y no decir nada'], gab: { p: pi, opt: opt ? opt.name : '' } });
    }
    /* 4. Convenio con la Consellería */
    if (!s.convenioUntil && s.lastConvenio < w - 48 && c.active.some(sp => sp.id === 'cribado_retina') && hit(0.5)) {
      s.lastConvenio = w;
      notify('Consellería de Sanidade', 'La Consellería busca ópticas inscritas en el registro sanitario con retinógrafo para su programa de cribado de retinopatía diabética: los centros de salud nos derivarían pacientes durante seis meses (+20 % de pacientes) para hacerles la retinografía gratis, que leerá un oftalmólogo por telemedicina. Mucho papeleo y baremos estrictos. ¿Firmamos el convenio?', 'decision', { sourceId: 'gabinete:convenio', options: ['Firmar el convenio', 'Declinar'] });
    }
    /* 5. Polémica tele-optometría */
    if (c.tele && s.lastPolemica < w - 48 && hit(0.35)) {
      s.lastPolemica = w;
      notify('Polémica en el Colegio', 'El Colegio de Ópticos-Optometristas publica un comunicado contra la telerrefracción "sin óptico delante" y una radio local nos pone de ejemplo. ¿Defendemos el servicio o lo suspendemos una temporada?', 'decision', { sourceId: 'gabinete:polemica', options: ['Defender el servicio', 'Suspender la telerrefracción 3 meses'] });
    }
    /* 6. Club deportivo */
    if (s.lastClub < w - 48 && c.active.some(sp => sp.id === 'vision_deportiva') && hit(0.4)) {
      s.lastClub = w;
      notify('Club deportivo', 'El club de baloncesto de la ciudad quiere un programa de entrenamiento visual para su cantera: 12.000 € por ocho semanas de sesiones, aunque nos ocuparán parte del gabinete.', 'decision', { sourceId: 'gabinete:club', options: ['Aceptar (12.000 €)', 'No tenemos hueco'] });
    }
    /* 7. Plan Mirada Escolar: solo si no existe el módulo de marketing */
    if (!Modules.get('marketing') && w === U.gameWeek('25/10/1') && co.hasResearch('AutorizacionSanitaria')) notify('Plan Mirada Escolar', 'La Consellería de Sanidade lanza el Plan Mirada Escolar: gafas y lentillas para menores de 16 años pagadas con fondos públicos en las ópticas adheridas. Adherirse cuesta 2.000 € de alta y cartelería y traería más revisiones infantiles durante un año.', 'decision', { sourceId: 'gabinete:planveo', options: ['Adherirse (2.000 €)', 'No, gracias'] });
    /* 8. El showroomer (EVT_GAB_04): con examen gratuito, alguien pide la graduación para comprar las gafas por internet */
    if (s.examMode === 'gratis' && c.baseOk && !c.closed && s.lastShowroomer < w - 24 && hit(1.5)) {
      s.lastShowroomer = w;
      notify('Receta para llevar', `Un paciente se ha hecho el examen gratuito (media hora de gabinete) y pide la graduación por escrito «para comprar las gafas por internet, que salen a 39 €». Tenemos a la vista la tarifa de honorarios: 20 € por entrega de receta, descontables si compra aquí.`, 'decision', { sourceId: 'gabinete:showroomer', options: ['Cobrar la entrega de receta (20 €, descontables)', 'Dársela gratis', 'Negarse a darle su graduación'] });
    }
    /* 9. Inadaptación a progresivos (EVT_GAB_02) */
    if (s.tier >= 1 && c.baseOk && c.converted >= 5 && s.lastProgresivos < w - 24 && progresivosOk(co) && hit(1.0)) {
      s.lastProgresivos = w;
      notify('No se adapta a los progresivos', 'Un paciente vuelve a las dos semanas con sus progresivos de gama alta: se marea al bajar escaleras y no ve bien el ordenador. Los fabricantes tienen garantía de adaptación, pero hay que repetir el examen binocular y comprobar las alturas de montaje.', 'decision', { sourceId: 'gabinete:progresivos', options: ['Repetir el examen y tramitar la garantía de adaptación', 'Cambiárselos por dos gafas, de lejos y de cerca', 'Negarse: la graduación es correcta'] });
    }
  }
  function inspection(co, s, w, kind) {
    s.lastInspection = w;
    if (kind === 'noDT') {
      s.closedUntil = w + 2; s.repPenalty += 10; s.stats.fines++;
      notify('Inspección de Sanidade', `Una inspectora de la Consellería de Sanidade se presenta sin avisar y no hay ningún óptico-optometrista colegiado en la óptica: el gabinete funciona sin director técnico. Levanta acta de infracción: multa de ${money(G.scaledCost(K.INSPECTION_FINE))} y cierre cautelar del gabinete durante dos semanas.`, 'decision', { sourceId: 'gabinete:inspeccion', options: [`Pagar la multa (${money(G.scaledCost(K.INSPECTION_FINE))})`, `Recurrir con abogados (${money(G.scaledCost(K.LAWYER))}, 50 %)`] });
      addLog(s, w, 'Inspección: sin director técnico. Cierre cautelar 2 semanas.'); return;
    }
    const problems = [];
    if (!working(s, 'software_historia_clinica')) problems.push('no hay registro de historias clínicas');
    for (const id of TIERS[1].instr) if (!own(s, id)) problems.push(`falta ${BY[id].name.toLowerCase()}`);
    if (Object.keys(s.used).some(id => own(s, id)) && U.rnd() < 0.5) problems.push('equipos de segunda mano sin certificado de calibración');
    if (problems.length) { const fine = G.scaledCost(K.MINOR_FINE + Math.floor(U.rnd() * 8000)); co.adjustCash(-fine, 'Multa de Sanidade'); s.repPenalty += 4; s.stats.fines++; notify('Inspección de Sanidade', `Inspección sorpresa de la Consellería de Sanidade: ${problems.join(', ')}. Acta de infracción leve: multa de ${money(fine)} y requerimiento para subsanarlo.`); addLog(s, w, 'Inspección con multa: ' + problems[0]); }
    else { s.repBonus += 2; notify('Inspección de Sanidade', 'Inspección sorpresa de la Consellería de Sanidade: director técnico presente con su placa identificativa, gabinete independiente de más de 8 m², instrumental obligatorio completo y calibrado, número de registro sanitario a la vista e historias clínicas al día. Acta sin incidencias; la inspectora se va con un folleto de la nueva colección. +reputación.', 'news'); addLog(s, w, 'Inspección superada sin incidencias'); }
  }
  function breakdowns(co, s, w) {
    for (const id of s.instruments) { const it = BY[id]; if (!it || !it.fail || s.broken[id]) continue; if (U.rnd() < it.fail * (s.used[id] ? 2.5 : 1) / 48) breakInstrument(co, s, id, w); }
  }
  function breakInstrument(co, s, id, w) {
    const it = BY[id]; const used = !!s.used[id]; const repair = G.repairCost(it.cost * (used ? 0.15 : 0.10)); s.stats.breakdowns++;
    if (it.cost < 30000) { co.adjustCash(-repair, 'Reparación ' + it.name); s.broken[id] = w + (used ? 2 : 1); s.repPenalty += 1; G.log(`Avería: ${it.name}${used ? ' (de segunda mano)' : ''}. Reparación ${money(repair)}, parado ${used ? 'dos semanas' : 'una semana'}.`); addLog(s, w, `Avería de ${it.name} (${money(repair)})`); return; }
    s.broken[id] = w + 6;
    notify('Avería en el gabinete', `${it.name}${used ? ', que compramos de segunda mano,' : ''} ha dejado de funcionar en mitad de una consulta. El servicio técnico pide ${money(repair)} por venir mañana; en garantía tardarían seis semanas. Mientras tanto, las especialidades que lo necesitan se paran.`, 'decision', { sourceId: 'gabinete:averia', options: [`Reparar ya (${money(repair)})`, 'Esperar al servicio técnico (6 semanas)'], gab: { id } });
    addLog(s, w, `Avería de ${it.name}`);
  }
  function onDecision(co, sourceId, choice, n) {
    if (!sourceId || sourceId.indexOf('gabinete:') !== 0) return; const s = S(co); const w = s.week || Math.floor(co.currentWeek); const yes = choice === 0;
    switch (sourceId) {
      case 'gabinete:inspeccion':
        if (yes) co.adjustCash(-G.scaledCost(K.INSPECTION_FINE), 'Multa de Sanidade');
        else { co.adjustCash(-G.scaledCost(K.LAWYER), 'Abogados'); if (U.rnd() < 0.5) { notify('Recurso estimado', 'Los abogados han conseguido que se anule la multa por un defecto de forma. El cierre de dos semanas, eso sí, ya está hecho.', 'news'); } else { co.adjustCash(-G.scaledCost(K.INSPECTION_FINE), 'Multa de Sanidade'); notify('Recurso desestimado', `El recurso no prospera: pagamos la multa de ${money(G.scaledCost(K.INSPECTION_FINE))} además de los abogados.`); } }
        break;
      case 'gabinete:averia': {
        const id = n && n.gab && n.gab.id; if (!id || !BY[id]) break; const it = BY[id]; const used = !!s.used[id];
        if (yes) { const repair = G.repairCost(it.cost * (used ? 0.15 : 0.10)); co.adjustCash(-repair, 'Reparación ' + it.name); s.broken[id] = w + (used ? 3 : 2); s.repPenalty += 1; }
        else { s.broken[id] = w + 6; s.repPenalty += 3; }
        break; }
      case 'gabinete:convenio':
        if (yes) { s.convenioUntil = w + 26; s.repBonus += 4; G.log('Convenio con la Consellería firmado: +20 % de pacientes durante seis meses.'); addLog(s, w, 'Convenio con la Consellería (26 semanas)'); }
        break;
      case 'gabinete:polemica':
        if (yes) { s.repPenalty += 5; s.boosts.push({ mult: 0.9, until: w + 12, src: 'polemica' }); addLog(s, w, 'Polémica telerrefracción: −10 % pacientes 12 semanas'); }
        else { s.teleSuspendedUntil = w + 12; s.repPenalty += 1; addLog(s, w, 'Telerrefracción suspendida 12 semanas'); }
        break;
      case 'gabinete:club':
        if (yes) { co.adjustCash(12000, 'Programa de visión deportiva'); co.adjustFans(1500); s.repBonus += 2; s.boosts.push({ mult: 0.95, until: w + 8, src: 'club' }); addLog(s, w, 'Programa con el club: +12.000 €'); }
        break;
      case 'gabinete:planveo':
        if (yes && co.cash >= 2000) { co.adjustCash(-2000, 'Plan Mirada Escolar'); s.boosts.push({ mult: 1.1, until: w + 48, src: 'planveo' }); addLog(s, w, 'Adheridos al Plan Mirada Escolar: +10 % pacientes un año'); }
        break;
      case 'gabinete:derivacion': {
        const p = PATHOLOGIES[(n && n.gab && n.gab.p) | 0] || PATHOLOGIES[0]; const who = (n && n.gab && n.gab.opt) || 'Nuestro equipo';
        if (yes) {
          const fans = 1500 + Math.floor(co.fans * 0.01); co.adjustFans(fans); s.repBonus += 4; s.stats.detections++;
          notify('Derivación a tiempo', `${who} redacta un informe optométrico urgente con las pruebas y deriva al paciente a Oftalmología. El oftalmólogo confirma ${p.n}, empieza el tratamiento a tiempo y desde entonces nos manda pacientes; el periódico local lo cuenta a toda página. Ganamos ${U.num(fans)} clientes fieles y reputación clínica.`, 'news');
          addLog(s, w, 'Derivación al oftalmólogo tras el cribado: +reputación, +' + U.num(fans) + ' fieles');
        } else {
          co.adjustCash(-1000, 'Gabinete: devolución y reclamación'); s.repPenalty += 12; co.adjustFans(-Math.min(co.fans, 800));
          notify('Negligencia', `Al mes el paciente vuelve: otro profesional le ha encontrado ${p.n}. Exige la devolución de las gafas, pone una reclamación y amenaza con denunciarnos al Colegio. Ocultar un hallazgo es una falta deontológica grave.`);
          addLog(s, w, 'Hallazgo sin derivar: devolución, reclamación y −reputación');
        }
        break; }
      case 'gabinete:showroomer':
        if (choice === 0) {
          co.adjustCash(K.RECETA, 'Gabinete'); const stays = U.rnd() < 0.4;
          if (stays) { co.adjustFans(20); G.log('Receta cobrada: el paciente prefiere comprar aquí la gafa y descontarse los 20 €.'); } else G.log('Receta cobrada: el paciente se lleva su graduación (es su derecho) y compra en internet.');
          addLog(s, w, 'Receta para internet: cobrada' + (stays ? ' y gafa vendida' : ''));
        } else if (choice === 1) { G.log('Receta regalada: media hora de gabinete sin cobrar y la gafa se compra en internet.'); addLog(s, w, 'Receta para internet: regalada'); }
        else {
          s.repPenalty += 6; co.adjustFans(-Math.min(co.fans, 100));
          notify('Reclamación sanitaria', 'Negarse es ilegal: el paciente tiene derecho a su información clínica (Ley 41/2002 de autonomía del paciente). Pone una reclamación ante Sanidade y una reseña de una estrella.');
          addLog(s, w, 'Receta para internet: negada → reclamación');
        }
        break;
      case 'gabinete:progresivos':
        if (choice === 0) { s.repBonus += 2; s.boosts.push({ mult: 0.98, until: w + 1, src: 'progresivos' }); addLog(s, w, 'Inadaptación a progresivos: examen repetido y garantía de adaptación (0 € en lentes)'); }
        else if (choice === 1) { co.adjustCash(-120, 'Gabinete: cambio de progresivos'); s.repBonus += 1; addLog(s, w, 'Inadaptación a progresivos: cambio por dos gafas (−margen)'); }
        else { s.repPenalty += 6; s.boosts.push({ mult: 0.95, until: w + 8, src: 'resena' }); notify('Hoja de reclamaciones', 'El paciente pide la hoja de reclamaciones de Consumo y deja una reseña de una estrella: «me venden unos progresivos que no sirven y encima me dicen que es culpa mía».'); addLog(s, w, 'Inadaptación a progresivos: reclamación y mala reseña'); }
        break;
    }
  }

  /* =====================================================================
     6. ACCIONES DEL JUGADOR (las usa el panel y los tests)
     ===================================================================== */
  function canBuy(co, s, it) {
    if (own(s, it.id)) return 'ya lo tienes';
    if (!co.hasResearch('AutorizacionSanitaria')) return 'requiere la investigación «Autorización sanitaria»';
    if (it.tier > s.tier + 1) return `requiere el ${TIERS[it.tier - 1].name}`;
    if (it.level && co.level < it.level) return `requiere ${C.LEVELS[it.level].name}`;
    if (it.date) { const p = it.date.split('/').map(Number); if (!later(co, p[0], p[1])) return `disponible a partir de ${p[0] + 1994}`; }
    if (it.part) { const pt = DB.part(it.part); if (!(pt && pt.start) && !co.researchCompleted.includes(it.part)) return `requiere la tecnología «${pt ? pt.name : it.part}» (menú Investigar)`; }
    const miss = it.req.filter(id => !own(s, id)); if (miss.length) return 'requiere ' + miss.map(id => BY[id].name).join(', ');
    return null;
  }
  function buyInstrument(co, id, used) {
    const s = S(co); const it = BY[id]; if (!it) return false; const why = canBuy(co, s, it); if (why) { toast(`${it.name}: ${why}`); return false; }
    if (used && it.noUsed) { toast('No existe de segunda mano'); return false; }
    const cost = used ? Math.round(it.cost * 0.5) : it.cost; if (co.cash < cost) { toast('No hay dinero suficiente'); return false; }
    co.adjustCash(-cost, it.name); s.instruments.push(id); if (used) s.used[id] = true; else delete s.used[id]; s.stats.invested += cost;
    toast(`${it.name} comprado${used ? ' de segunda mano' : ''}`); G.log(`Gabinete: ${it.name}${used ? ' (segunda mano)' : ''} por ${money(cost)}.`); return true;
  }
  function replaceUsed(co, id) { const s = S(co); const it = BY[id]; if (!it || !s.used[id]) return false; const cost = Math.round(it.cost * 0.9); if (co.cash < cost) { toast('No hay dinero suficiente'); return false; } co.adjustCash(-cost, it.name + ' nuevo'); delete s.used[id]; delete s.broken[id]; s.stats.invested += cost; toast(`${it.name} sustituido por uno nuevo`); return true; }
  function repairNow(co, id) { const s = S(co); const it = BY[id]; if (!it || !s.broken[id]) return false; const repair = G.repairCost(it.cost * (s.used[id] ? 0.15 : 0.10)); if (co.cash < repair) { toast('No hay dinero suficiente'); return false; } co.adjustCash(-repair, 'Reparación ' + it.name); delete s.broken[id]; toast(`${it.name} reparado`); return true; }
  function tierReqs(co, s, t) {
    const r = [{ ok: co.level >= t.level, text: `Local: ${C.LEVELS[t.level].name}` }];
    if (t.research) r.push({ ok: co.hasResearch(t.research), text: `Investigación «${resName(t.research)}»` });
    for (const id of t.instr) r.push({ ok: own(s, id), text: BY[id].name });
    if (t.tier === 5) r.push({ ok: co.staff.filter(x => x.role === 'optico').length >= 2, text: 'Dos ópticos-optometristas en plantilla' });
    r.push({ ok: co.cash >= t.cost, text: `Caja: ${money(t.cost)}` });
    return r;
  }
  function buyTier(co) {
    const s = S(co); const t = TIERS[s.tier + 1]; if (!t) { toast('El gabinete ya está al máximo'); return false; }
    const bad = tierReqs(co, s, t).filter(x => !x.ok); if (bad.length) { toast('Falta: ' + bad.map(x => x.text).join(', ')); return false; }
    co.adjustCash(-t.cost, t.name); s.tier = t.tier; s.stats.invested += t.cost; if (s.reputation < 40) s.reputation = 40;
    const txt = { 1: 'Primer paciente en la sala nueva: la vecina del tercero, que llevaba diez años con la misma graduación. Con el instrumental del Decreto 12/2009 y un director técnico colegiado, ya graduamos con todas las de la ley.', 2: 'Sillón, columna, autorrefractómetro-queratómetro y tonómetro de aire: el pre-examen lo hace la máquina, la consulta baja a unos 20 minutos y podemos adaptar lentillas.', 3: 'Foróptero digital y topógrafo corneal: refracción sin errores de transcripción y mapas de la córnea. Se abren las especialidades avanzadas.', 4: 'Con retinógrafo y campímetro, los oftalmólogos de la zona leen nuestras retinografías y empiezan a derivarnos casos. Somos un centro de especialidades optométricas.', 5: 'Varios gabinetes, OCT y cogestión con oftalmólogos. El Instituto de la Visión sale en las noticias regionales.' }[t.tier];
    notify(t.name, `${txt}\nPacientes base por optometrista: ${t.patients}/semana · conversión base ${Math.round(t.conv * 100)} % · mantenimiento ${money(t.maint)}/mes.`);
    addLog(s, s.week, 'Ampliación: ' + t.name); return true;
  }
  function setMode(co, mode) { const s = S(co); s.examMode = mode === 'cobro' ? 'cobro' : 'gratis'; toast(s.examMode === 'cobro' ? `Examen de pago con informe optométrico: ${money(K.EXAM_PRICE)} por examen, menos pacientes y algo menos de conversión` : 'Examen gratuito: más pacientes, cobramos en la gafa (y alguno se llevará la receta a internet)'); return true; }

  /* =====================================================================
     7. PANEL DEL DEPARTAMENTO
     ===================================================================== */
  let uiShowAll = false;
  (function injectCss() {
    if (typeof document === 'undefined' || !document.head || (document.getElementById && document.getElementById('css-gabinete'))) return;
    const st = document.createElement('style'); st.id = 'css-gabinete';
    st.textContent = `.dept-gabinete .gkpis{display:flex;flex-wrap:wrap;gap:8px;margin:6px 0 10px}.dept-gabinete .gkpi{flex:1 1 110px;background:rgba(255,255,255,.6);border:2px solid #A4A4A4;border-radius:8px;padding:6px 10px}.dept-gabinete .gkpi b{display:block;font-size:19px}.dept-gabinete .gkpi small{color:#555}.dept-gabinete .gchart{background:#fff;border:2px solid #A4A4A4;border-radius:8px;padding:6px 10px}.dept-gabinete .gbars{display:flex;align-items:flex-end;gap:3px;height:70px;margin:2px 0 6px}.dept-gabinete .gbars i{flex:1;display:block;background:#A3E7FF;border:1px solid #4aa3c7;border-radius:2px 2px 0 0;min-height:3px}.dept-gabinete .gbars i.i{background:#FFC561;border-color:#F47A20}.dept-gabinete .gok{color:#229710}.dept-gabinete .gbad{color:#F42727}.dept-gabinete .gwarn{color:#b86e00}.dept-gabinete .gtag{display:inline-block;font-size:11px;padding:1px 7px;border-radius:10px;background:#e8f4ff;margin-left:4px;vertical-align:middle}.dept-gabinete .gtag.on{background:#d9f5d2}.dept-gabinete .gtag.off{background:#fde2e2}.dept-gabinete .gtag.used{background:#fff1c9}.dept-gabinete .grep{height:10px;background:#eee;border-radius:5px;overflow:hidden;margin-top:4px}.dept-gabinete .grep>i{display:block;height:100%;background:linear-gradient(90deg,#FAA51A,#2FAF1B)}.dept-gabinete .gcols{display:grid;grid-template-columns:1fr 1fr;gap:12px}@media(max-width:760px){.dept-gabinete .gcols{grid-template-columns:1fr}}.dept-gabinete .gbtns{display:flex;flex-direction:column;gap:4px;align-items:stretch}.dept-gabinete .ritem .req{display:block;font-size:11px;color:#777;margin-top:2px}.dept-gabinete .ritem .req.bad{color:#c0392b}.dept-gabinete .glog{font-size:12px;color:#555;margin:2px 0}.dept-gabinete .dept-gabinete h4{margin-top:14px}`;
    document.head.appendChild(st);
  })();
  /* gráfica de 12 semanas con divs: barras azules = pacientes, barras naranjas = ingresos del gabinete */
  function chartHtml(hist) {
    const h = hist.slice(-12); if (!h.length) return '<div class="sub">Todavía no hay semanas registradas.</div>';
    const maxP = Math.max(1, ...h.map(x => x.p)); const maxI = Math.max(1, ...h.map(x => x.inc));
    const bars = (key, mx, cls, fmt) => `<div class="gbars">${h.map(x => `<i class="${cls}" title="semana ${x.w % 48 + 1}: ${fmt(x[key])}" style="height:${Math.max(3, Math.round(100 * x[key] / mx))}%"></i>`).join('')}</div>`;
    return `<div class="gchart"><div class="wl">Pacientes/semana <small>(máx. ${U.num(maxP)})</small></div>${bars('p', maxP, 'p', v => U.num(v) + ' pacientes')}<div class="wl">Ingresos del gabinete/semana <small>(máx. ${U.shortMoney(maxI)})</small></div>${bars('inc', maxI, 'i', v => money(v))}<div class="sub">De izquierda a derecha, de la semana más antigua a la actual.</div></div>`;
  }
  function ui(co) {
    const s = S(co); const w = Math.floor(co.currentWeek); const c = compute(co, s, w); const T = TIERS[s.tier]; const next = TIERS[s.tier + 1];
    const auth = co.hasResearch('AutorizacionSanitaria'); const last4 = s.hist.slice(-4); const inc4 = last4.reduce((a, x) => a + x.inc, 0); const maint = monthlyCost(co);
    const pct = v => Math.round(v * 100) + ' %';
    let h = '';
    /* --- cabecera --- */
    const status = s.tier === 0 ? '<span class="gtag off">sin gabinete</span>' : c.closed ? `<span class="gtag off">cerrado por Sanidade durante ${s.closedUntil - w} ${s.closedUntil - w === 1 ? 'semana' : 'semanas'} más</span>` : !c.st.dtPresent ? '<span class="gtag off">sin director técnico</span>' : !c.baseOk ? '<span class="gtag off">examen general parado</span>' : '<span class="gtag on">abierto</span>';
    h += `<div class="sub"><b>${T.name}</b> ${status} · ${esc(T.desc)}</div>`;
    const optCap = Math.round(c.boxes * 1.5 * 10) / 10;
    h += `<div class="gkpis"><div class="gkpi"><small>Pacientes/semana</small><b>${U.num(s.patientsWeek)}</b><small>previsión ${U.num(Math.round(c.patients))}${c.lost >= 1 ? ` · <span class="gwarn">agenda llena: ${U.num(Math.round(c.lost))} se van sin cita</span>` : ''}${c.squeeze < 1 ? ' · especialidades recortadas' : ''}</small></div><div class="gkpi"><small>Carga del box</small><b class="${(s.saturation || 0) > 100 ? 'bad' : ''}">${s.saturation || 0} %</b><small>${(s.saturation || 0) > 100 ? 'por encima: el optometrista se cansa y se equivoca' : 'por debajo del 100 % no hay sobrecarga'}</small></div><div class="gkpi"><small>Conversión a gafa</small><b>${pct(c.conv)}</b><small>${U.num(s.convertedWeek)} gafas/sem${Modules.get('tienda') ? ' (las vende la tienda)' : ''}</small></div><div class="gkpi"><small>Ingresos (4 semanas)</small><b>${U.shortMoney(inc4)}</b><small>mantenimiento ${U.shortMoney(maint)}/mes</small></div><div class="gkpi"><small>Reputación</small><b>${Math.round(s.reputation)}</b><div class="grep"><i style="width:${Math.round(s.reputation)}%"></i></div></div><div class="gkpi"><small>Optometristas en consulta</small><b>${c.st.opts.length}<small> / ${optCap} por ${c.boxes} gabinete${c.boxes === 1 ? '' : 's'}</small></b><small>capacidad ${(Math.min(c.st.optW, c.boxes * 1.5) * 100).toFixed(0)} %${c.st.aux.length ? ' · ' + c.st.aux.length + ' aux.' : ''}${c.st.audios.length ? ' · ' + c.st.audios.length + ' audioprotesista' : ''}</small></div></div>`;
    if (!auth) h += `<div class="note">Sin <b>Autorización sanitaria</b> no podemos graduar ni comprar instrumental y las colecciones Graduado venden la mitad. ${co.level >= 2 ? 'Investígala desde el menú Investigar (categoría Gabinete).' : 'Primero hace falta mudarse a un local comercial.'}</div>`;
    else if (s.tier >= 1 && !c.st.opts.length) h += `<div class="note">No hay ningún óptico-optometrista pasando consulta: asigna uno al gabinete (o asígnate tú) para recibir pacientes.</div>`;
    h += `<div class="gcols"><div><h4>Últimas 12 semanas</h4>${chartHtml(s.hist)}</div><div><h4>Ingresos por línea (4 semanas)</h4><table class="tbl"><tr><th>Línea</th><th>€</th></tr><tr><td>Exámenes de pago</td><td>${money(last4.reduce((a, x) => a + x.ex, 0))}</td></tr><tr><td>Especialidades</td><td>${money(last4.reduce((a, x) => a + x.sp, 0))}</td></tr><tr><td>Recurrentes (lentillas, miopía, orto-k, audífonos, ojo seco)</td><td>${money(last4.reduce((a, x) => a + x.rc, 0))}</td></tr>${Modules.get('tienda') ? `<tr><td>Gafas graduadas</td><td><small>las vende la tienda (${U.num(s.convertedWeek)} pacientes/sem)</small></td></tr>` : `<tr><td>Gafas graduadas (sin tienda: ${money(K.TICKET * K.GLASS_MARGIN)} netos por paciente)</td><td>${money(last4.reduce((a, x) => a + x.gl, 0))}</td></tr>`}<tr><td>Mantenimiento mensual</td><td class="gbad">−${money(maint)}</td></tr></table>
      <div class="gmode row" style="margin-top:8px"><span class="sub">Examen visual:</span><button class="btn small ${s.examMode === 'gratis' ? 'on primary' : ''}" data-g="mode" data-id="gratis" title="+${Math.round((K.MODE.gratis.pat - 1) * 100)} % pacientes, +${Math.round(K.MODE.gratis.conv * 100)} pts conversión, 0 € por examen: cobramos en la gafa, aunque algunos se llevan la receta a internet">Gratuito (gancho)</button><button class="btn small ${s.examMode === 'cobro' ? 'on primary' : ''}" data-g="mode" data-id="cobro" title="Examen con informe optométrico: ${money(K.EXAM_PRICE)} por examen, ${Math.round((K.MODE.cobro.pat - 1) * 100)} % pacientes, ${Math.round(K.MODE.cobro.conv * 100)} pts conversión, +3 reputación">De pago (${money(K.EXAM_PRICE)})</button></div></div></div>`;
    /* --- ampliación --- */
    if (next) {
      const reqs = tierReqs(co, s, next); const ok = reqs.every(x => x.ok);
      h += `<h4>Ampliar al ${esc(next.name)}</h4><div class="ritem ${ok ? '' : 'off'}"><div><b>${esc(next.name)}</b><small>${esc(next.desc)}</small><small>Pacientes base ${next.patients}/semana por optometrista · conversión ${pct(next.conv)} · mantenimiento ${money(next.maint)}/mes</small>${reqs.map(r => `<span class="req ${r.ok ? '' : 'bad'}">${r.ok ? '✔' : '✘'} ${esc(r.text)}</span>`).join('')}</div><div class="rcost">${money(next.cost)}</div><button class="btn small primary" data-g="tier" ${ok ? '' : 'disabled'}>Ampliar</button></div>`;
    }
    /* --- personal --- */
    const people = co.staff.filter(x => x.assignment === ID || x.role === 'optico' || isAudio(x));
    const stateTxt = x => ({ idle: 'libre', working: 'en colecciones', researching: 'investigando', training: 'en formación', vacation: 'de vacaciones' }[x.state] || x.state);
    h += `<h4>Personal del gabinete</h4><div class="sub">Director técnico: ${c.st.dtPresent ? '<span class="gok">óptico-optometrista presente</span>' : '<span class="gbad">¡ningún óptico presente! Sanidade puede cerrarnos</span>'}. Cada optometrista ve ${T.patients || TIERS[1].patients} pacientes base/semana; un gabinete (sala) admite 1,5 optometristas en turnos. Los asignados no trabajan en colecciones.</div>`;
    h += people.map(x => { const sk = Object.keys(x.skills || {}).filter(k => SKILLS[k]).map(k => `<span class="gtag">${SKILLS[k]}</span>`).join(''); const inG = x.assignment === ID; return `<div class="ritem"><div><b>${esc(x.name)}</b> <small>${esc(DATA.roleById(x.role).name)} · nivel ${lvl(x)}${x.id === 0 ? ' · tú' : ''} · ${inG ? (x.state === 'idle' ? 'pasando consulta' : stateTxt(x)) : stateTxt(x)}</small>${sk ? `<small>${sk}</small>` : ''}</div><div class="rcost"><small>rendimiento ${Math.round(x.efficiency * 100)} %</small></div><button class="btn small ${inG ? '' : 'primary'}" data-g="${inG ? 'unassign' : 'assign'}" data-id="${x.id}" ${x.state === 'vacation' || x.state === 'training' || x.state === 'researching' ? 'disabled' : ''}>${inG ? 'A colecciones' : 'Al gabinete'}</button></div>`; }).join('') || '<div class="sub">Nadie en plantilla con perfil clínico.</div>';
    const poolRows = Object.keys(POOLS).filter(k => s.pools[k] && s.pools[k].n >= 1).map(k => `<tr><td>${POOLS[k].name}</td><td>${U.num(s.pools[k].n)}</td><td>${money(s.pools[k].n * POOLS[k].monthly * K.SCALE)}/mes</td></tr>`).join('');
    if (poolRows) h += `<table class="tbl" style="margin-top:6px"><tr><th>Recurrentes</th><th>Usuarios</th><th>Ingreso</th></tr>${poolRows}</table>`;
    /* --- especialidades --- */
    h += '<h4>Especialidades</h4>';
    const specRow = sp => { const r = c.statuses[sp.id]; const researched = co.hasResearch(sp.research); const avail = co.availableResearch.indexOf(sp.research) >= 0; const x = c.specs.find(y => y.sp === sp);
      let tag, extra = '';
      if (r.ok && s.tier >= 1) { tag = '<span class="gtag on">activa</span>'; extra = sp.base ? `<small>${U.num(Math.round(c.general))} pacientes/sem · ${s.examMode === 'cobro' ? money(K.EXAM_PRICE * c.priceMult) + ' por examen' : 'gratis'} · ${pct(c.conv)} compran gafa</small>` : x ? `<small>${x.p.toFixed(1)} pacientes/sem × ${money(sp.income * K.SCALE)} = ${money(x.p * sp.income * K.SCALE)}/sem${sp.pool ? ' + recurrentes' : ''}${sp.toGlasses ? ' · ' + pct(sp.toGlasses) + ' compran gafa' : ''}</small>` : ''; }
      else if (r.superseded) tag = '<span class="gtag on">integrada</span>';
      else if (!researched) { tag = avail ? '<span class="gtag">investigable</span>' : '<span class="gtag off">pendiente</span>'; }
      else tag = '<span class="gtag off">bloqueada</span>';
      const reqTxt = r.ok ? '' : `<span class="req bad">Falta: ${r.miss.map(esc).join(' · ')}</span>`;
      const need = `<span class="req">Nivel ${sp.tier} · ${sp.instr.map(instrLabel).map(esc).join(', ')}${sp.skill ? ' · ' + SKILLS[sp.skill] : ''}${sp.role === 'audioprotesista' ? ' · audioprotesista' : ''}${sp.patients ? ' · ' + sp.patients + ' pac./sem · ' + money(sp.income * K.SCALE) + '/pac.' : ''}</span>`;
      return `<div class="ritem ${r.ok ? '' : 'off'}"><div><b>${esc(sp.name)}</b>${tag}<small>${esc(sp.desc)}</small>${extra}${need}${reqTxt}</div><div class="rcost">${researched ? '' : `🔬 ${RES_BY[sp.research].pointsCost} · ${U.shortMoney(RES_BY[sp.research].cost)}`}</div>${!researched && avail ? '<button class="btn small" data-g="research">Investigar</button>' : ''}</div>`; };
    const act = SPECS.filter(sp => c.statuses[sp.id].ok && s.tier >= 1), rest = SPECS.filter(sp => act.indexOf(sp) < 0);
    h += act.map(specRow).join('') + (act.length ? '' : '<div class="sub">Ninguna especialidad activa todavía.</div>');
    h += `<details><summary class="sub">Por desbloquear (${rest.length})</summary>${rest.map(specRow).join('')}</details>`;
    /* --- instrumentos --- */
    const visible = INSTR.filter(it => uiShowAll || own(s, it.id) || it.tier <= s.tier + 1);
    const cats = []; for (const it of visible) if (cats.indexOf(it.cat) < 0) cats.push(it.cat);
    h += `<h4>Instrumental <small class="sub">(${s.instruments.length}/${INSTR.length} · usado = 50 % del precio, ×2,5 averías, −2 reputación)</small> <button class="btn small" data-g="showall">${uiShowAll ? 'Solo los de mi nivel' : 'Mostrar todos'}</button></h4>`;
    for (const cat of cats) {
      h += `<div class="wl">${esc(cat)}</div>` + visible.filter(it => it.cat === cat).map(it => {
        const fxTxt = Object.keys(it.fx).map(k => ({ pat: '+' + Math.round(it.fx[k] * 100) + ' % pacientes', conv: (it.fx[k] > 0 ? '+' : '') + Math.round(it.fx[k] * 100) + ' pts conversión', price: '+' + Math.round(it.fx[k] * 100) + ' % precio', rep: '+' + it.fx[k] + ' reputación', def: '−' + Math.round(it.fx[k] * 100) + ' % defectos', rec: '+' + Math.round(it.fx[k] * 100) + ' % recurrencia', mkt: '+' + Math.round(it.fx[k] * 100) + ' % tráfico', boxes: '+1 gabinete' }[k])).filter(Boolean).join(', ');
        const unlocks = SPECS.filter(sp => sp.instr.some(t => t.split('|').indexOf(it.id) >= 0)).map(sp => sp.name);
        let right, btns;
        if (own(s, it.id)) { const br = s.broken[it.id]; right = `<div class="rcost">${br ? `<span class="gbad">averiado</span><br><small>vuelve en ${Math.max(1, br - w)} sem.</small>` : '<span class="gok">operativo</span>'}${s.used[it.id] ? '<br><span class="gtag used">usado</span>' : ''}<br><small>${it.maint ? money(it.maint) + '/mes' : 'sin mantenimiento'}</small></div>`; btns = `<div class="gbtns">${br ? `<button class="btn small" data-g="repair" data-id="${it.id}" ${co.cash >= it.cost * 0.1 ? '' : 'disabled'}>Reparar ya (${U.shortMoney(it.cost * (s.used[it.id] ? 0.15 : 0.1))})</button>` : ''}${s.used[it.id] ? `<button class="btn small" data-g="replace" data-id="${it.id}" ${co.cash >= it.cost * 0.9 ? '' : 'disabled'}>Nuevo (${U.shortMoney(it.cost * 0.9)})</button>` : ''}</div>`; }
        else { const why = canBuy(co, s, it); const canN = !why && co.cash >= it.cost, canU = !why && !it.noUsed && co.cash >= it.cost / 2; right = `<div class="rcost">${money(it.cost)}<br><small>${it.maint ? money(it.maint) + '/mes' : 'sin mantenimiento'}</small></div>`; btns = `<div class="gbtns"><button class="btn small primary" data-g="buy" data-id="${it.id}" ${canN ? '' : 'disabled'} title="${esc(why || (co.cash < it.cost ? 'sin dinero' : ''))}">Comprar</button>${it.noUsed ? '' : `<button class="btn small" data-g="used" data-id="${it.id}" ${canU ? '' : 'disabled'} title="${esc(why || '')}">Usado (${U.shortMoney(it.cost / 2)})</button>`}</div>`; if (why) right = right.replace('</div>', `<br><small class="gbad">${esc(why)}</small></div>`); }
        return `<div class="ritem ${own(s, it.id) ? '' : canBuy(co, s, it) ? 'off' : ''}"><div><b>${esc(it.name)}</b>${it.key ? '<span class="gtag">obligatorio</span>' : ''}<small>${esc(it.desc || '')}${fxTxt ? ' ' + fxTxt + '.' : ''}</small>${unlocks.length ? `<span class="req">Para: ${unlocks.map(esc).join(', ')}</span>` : ''}${it.req.length ? `<span class="req">Requiere: ${it.req.map(id => BY[id].name).map(esc).join(', ')}</span>` : ''}</div>${right}${btns}</div>`; }).join('');
    }
    /* --- registro --- */
    if (s.log.length) h += '<h4>Últimos sucesos</h4>' + s.log.slice().reverse().map(l => { const d = U.dateFromWeek(l.w); return `<div class="glog">${U.MONTHS[d.month - 1].slice(0, 3)} ${U.realYear(d.year)} · ${esc(l.text)}</div>`; }).join('');
    h += `<div class="sub" style="margin-top:10px">Totales: ${U.num(s.stats.patients)} pacientes · ${money(s.stats.income)} ingresados · ${money(s.stats.invested)} invertidos · ${s.stats.breakdowns} averías · ${s.stats.detections} derivaciones al oftalmólogo por hallazgos en el cribado.</div>`;
    return { body: `<div class="dept-gabinete">${h}</div>`, bind(el, refresh) {
      el.querySelectorAll('[data-g]').forEach(b => b.addEventListener('click', () => {
        const a = b.dataset.g, id = b.dataset.id; let ok = true;
        if (a === 'buy') ok = buyInstrument(co, id, false); else if (a === 'used') ok = buyInstrument(co, id, true); else if (a === 'tier') ok = buyTier(co);
        else if (a === 'mode') setMode(co, id); else if (a === 'repair') ok = repairNow(co, id); else if (a === 'replace') ok = replaceUsed(co, id); else if (a === 'showall') uiShowAll = !uiShowAll;
        else if (a === 'assign' || a === 'unassign') { const ch = co.staff.find(x => String(x.id) === String(id)); if (ch) { G.assign(ch, a === 'assign' ? ID : null); toast(a === 'assign' ? `${ch.name} pasa consulta en el gabinete` : `${ch.name} vuelve a las colecciones`); } }
        else if (a === 'research') { if (typeof UI !== 'undefined' && UI.showResearch) return UI.showResearch(); }
        if (ok !== false && refresh) refresh();
      }));
    } };
  }
  function sceneInfo(co) {
    const s = S(co); const w = Math.floor(co.currentWeek); const vis = s.instruments.slice().sort((a, b) => BY[b].cost - BY[a].cost).slice(0, 8);
    const cap = Math.max(1, TIERS[s.tier].patients * 1.5); const busy = U.clamp(s.patientsWeek / cap, 0, 1);
    return { tier: s.tier, instruments: vis, patientsNow: s.tier && s.closedUntil <= w ? Math.min(3, Math.round(busy * 3)) : 0, boxes: s.tier ? 1 + (own(s, 'segundo_gabinete') ? 1 : 0) : 0, open: s.tier >= 1 && s.closedUntil <= w, busy, reputation: s.reputation,
      /* para render.js: todo el instrumental comprado (ids) y el averiado, para dibujar cada equipo */
      owned: s.instruments.slice(), broken: Object.keys(s.broken) };
  }
  function report(co) {
    const s = S(co); const lm = s.months[s.months.length - 1];
    return [{ label: 'Pacientes/semana', value: U.num(s.patientsWeek) }, { label: 'Ingresos último mes', value: lm ? money(lm.income) : '—' }, { label: 'Gabinete', value: TIERS[s.tier].name }, { label: 'Conversión a gafa', value: Math.round(s.conversion * 100) + ' %' }, { label: 'Reputación clínica', value: Math.round(s.reputation) + '/100' }, { label: 'Especialidades activas', value: `${(s.active || []).length}/${SPECS.length}` }, { label: 'Instrumental', value: `${s.instruments.length}/${INSTR.length}` }, { label: 'Mantenimiento', value: money(monthlyCost(co)) + '/mes' }];
  }

  Modules.register({
    id: ID, name: 'Gabinete optométrico', icon: '👁️', order: 20,
    init, weekly, monthly, monthlyCost, salesFactor, scoreFactor, candidateBonus,
    onCreateGame, onResearch, onTraining, onAssign, onDecision, onEvent, ui, sceneInfo, report,
    DECISIONS: ['gabinete:inspeccion', 'gabinete:averia', 'gabinete:convenio', 'gabinete:polemica', 'gabinete:club', 'gabinete:planveo', 'gabinete:derivacion', 'gabinete:showroomer', 'gabinete:progresivos'],
    api: { K, TIERS, INSTR, SPECS, POOLS, SKILLS, RES, TRAIN, compute, staffInfo, specStatus, allStatuses, instrFx, weight, buyInstrument, buyTier, setMode, repairNow, replaceUsed, canBuy, tierReqs, breakInstrument, inspection, events, repTarget }
  });
})();
