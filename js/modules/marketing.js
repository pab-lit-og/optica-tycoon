/* Óptica Tycoon — Departamento de marketing (id "marketing", order 10)
   Fuente de datos: docs/research/marketing.data.json y marketing.md (auditoría 13/10/2026); pase de realismo con
   docs/research/RESULTADO_DEPARTAMENTOS_OFICIO.md (sección 7, MKT_01..48, PUE_08, EVT_MKT_01..03, EVT_TIE_01/02).

   Estado persistente en co.modules.marketing (JSON plano):
     brand        notoriedad 0..100 (decae 1/mes, 0,5 con departamento nivel 3), tope brandCap
     brandCap     30 sin marca registrada · 40 franquicia · 60 cooperativa · 100 marca propia
     traffic      multiplicador extra de visitas ESTA semana, agregado cada semana de `effects` + campañas always-on con tope 0.6
                  (puede bajar hasta -0.3 solo por eventos adversos: obras, reseña viral, competidor low-cost; los consumidores usan (1 + traffic))
     patients     multiplicador extra de pacientes de gabinete esta semana (0..0.5) — lo lee el módulo gabinete si quiere
     retention    recurrencia 0..70 (base 30) · optIn 0..100 (base 50) · stars 2.5..5 (reseñas en internet, inicio 4.0)
     dept         0 dueño · 1 externalizado · 2 responsable+CM+diseño · 3 departamento completo
     group        null | 'cooperativa' | 'franquicia'
     active       campañas activas [{id, start, until(0 = always-on), fee}]
     effects      efectos temporales [{type:'traffic'|'patients'|'retention'|'units'|'optin', ..., until}]
     history      lanzamientos [{id, w}] para la repetición 1 / 0.7 / 0.3 en 24 semanas
     spendYTD, newFansYTD, spend12[], revenue12[], log12[], hist[]
   Ganchos hacia fuera: hypeFactor = 1 + brand/200 · candidateBonus = brand/500 · salesFactor (1 + brand/300 si la
   colección usa tienda/webpropia/influencers/crowd, efectos de unidades, Plan Mirada Escolar, franquicia) · unitCost (comisiones de
   financiación, tarjeta, programa de fabricante, promo 2x1) · scoreFactor (pequeños bonus ≤ 1.06).
   Ingreso recurrente mensual = min(fans, 1,5 M) × retention/100 × 0,5 € SOLO si no existe el módulo tienda.
   Decisiones (sourceId con prefijo "marketing:"): ver MK.DECISIONS al final del fichero (denuncia_publicidad = EVT_MKT_01,
   reclamacion_aepd = EVT_MKT_02, resena_viral = EVT_MKT_03, competidor_lowcost = EVT_TIE_01, cierre_competidor = EVT_TIE_02). */
'use strict';

(function () {
  const ID = 'marketing';
  const OWN_CH = ['tienda', 'webpropia'];
  const BRAND_CH = ['tienda', 'webpropia', 'influencers', 'crowd'];
  const K = {
    TRAFFIC_CAP: 0.6, TRAFFIC_MIN: -0.3, PATIENTS_CAP: 0.5, RETENTION_EUR: 0.5, FANS_CAP: 1.5e6,
    BRAND_DECAY: 1, BRAND_DECAY_D3: 0.5, REPEAT: [1, 0.7, 0.3], REPEAT_WINDOW: 24,
    OPT_IN_BASE: 50, RETENTION_BASE: 30, RETENTION_MAX: 70, STARS_START: 4.0, STARS_MIN: 2.5,
    VISITS_BASE: [0, 600, 1500, 2200, 4000], BUDGET_TARGET: [0, 0.02, 0.03, 0.045, 0.065],
    COOP_FEE: 400, COOP_ENTRY: 10000, FRANQ_ENTRY: 30000, FRANQ_EXIT: 50000, FRANQ_ROYALTY: 0.08,
    PLAN_VEO_COST: 500, REFERRAL_COST: 50, REFERRAL_MAX: 500
  };

  /* ---------- niveles del departamento ---------- */
  const DEPT = [
    { lvl: 0, name: 'Cartelería a mano y boca a boca', cost: 0, slots: 3, eff: 0.6, desc: 'Sin personal de marketing: tú mismo pintas los carteles, cuidas la ficha en el buscador y repartes folletos; el boca a boca de vecinos y familiares hace el resto. Eficacia 60 %, 3 acciones simultáneas.', req: () => null },
    { lvl: 1, name: 'Marketing de barrio externalizado', cost: 1775, slots: 6, eff: 0.8, desc: 'Escaparatista por temporada (375 €), gestor de redes sociales autónomo (600 €) y agencia de posicionamiento local (800 €): escaparate temático, ficha en el buscador, buzoneo y radio local. Eficacia 80 %, 6 acciones; posicionamiento y redes externos incluidos en la cuota.', req: co => co.level >= 2 ? null : 'Necesitas el local comercial (nivel 2)' },
    { lvl: 2, name: 'Responsable de marketing y CRM sanitario', cost: 8700, slots: 10, eff: 1.0, desc: 'Especialista en marketing óptico, CRM y RGPD (3.300 €), gestor de redes júnior (2.600 €) y diseñador gráfico (2.800 €), con cotizaciones. Lleva las recitaciones con consentimiento, los convenios con colegios y empresas y la revisión legal de la publicidad sanitaria. Eficacia 100 %, 10 acciones, campañas −10 % de coste, presupuesto automático, +2 % en reseñas por escaparate y packaging.', req: co => (co.level >= 3 || co.hasResearch('DeptoMarketing')) ? null : 'Requiere la óptica con gabinete (nivel 3) o investigar «Departamento de marketing»' },
    { lvl: 3, name: 'Departamento omnicanal (enseña de referencia)', cost: 38700, slots: 99, eff: 1.3, desc: 'Dirección, marca, CRM, contenidos, diseño sénior, trade, prensa y relaciones institucionales, publicidad digital y escaparatista en plantilla (≈ 465 k€/año): campañas clínicas estacionales, conciertos con aseguradoras y medios masivos. Eficacia 130 %, acciones ilimitadas, la notoriedad decae la mitad, +1 notoriedad/mes, CRM −30 % de coste, +5 recurrencia, +10 opt-in, +4 % visitas, +8 % unidades en canales de terceros, +10 % en web propia, prensa en plantilla (crisis −50 %).', req: co => (co.level >= 4 && co.hasResearch('DeptoMarketing')) ? null : 'Requiere la óptica insignia (nivel 4) e investigar «Departamento de marketing»' }
  ];

  /* ---------- investigaciones (categoría Marketing) ---------- */
  const mkState = co => (co && co.modules && co.modules[ID]) || null;
  const RESEARCH = [
    { id: 'MarketingLocal', name: 'Marketing de barrio', pointsCost: 10, duration: 8000, cost: 5000, req: () => true, desc: 'Ficha en guías y buscadores locales, programa de reseñas, buzoneo, escaparate, prensa y radio local, eventos en tienda, presentación de colección y cita online. Folletos y escaparate con el número de registro sanitario visible.' },
    { id: 'PublicidadSanitaria', name: 'Protocolo de publicidad sanitaria', pointsCost: 15, duration: 8000, cost: 6000, req: co => co.hasResearch('MarketingLocal'), desc: 'Revisión legal previa de toda la publicidad (RD 1907/1996, RD 192/2023 de productos sanitarios, art. 7 del Reglamento UE 2017/745 y Código Deontológico, art. 4.5.2): nada de propiedades terapéuticas ni de famosos o sanitarios recomendando productos sanitarios. Riesgo de sanción ×0,25 y daño a la mitad.' },
    { id: 'EstudiosMercado', name: 'Estudios de mercado', pointsCost: 30, duration: 10000, cost: 25000, req: co => co.level >= 2, desc: 'Informes de tendencias: revelan la tendencia vigente, cuánto le queda y los canales con más cuota.' },
    { id: 'CRMFidelizacion', name: 'CRM y fidelización', pointsCost: 60, duration: 12000, cost: 40000, req: co => co.level >= 2, desc: 'Base de clientes con consentimiento comercial expreso y separado de la ficha clínica (art. 9 RGPD), tarjeta de fidelización, recitaciones, correo postal, boletín electrónico, «Trae a un amigo» y financiación en 12 meses.' },
    { id: 'MarketingDigital', name: 'Marketing digital', pointsCost: 40, duration: 10000, cost: 30000, req: co => co.isLaterOrEqualThan(9, 1), desc: 'Anuncios en el buscador local, agencia de posicionamiento y analítica web. Las páginas de destino deben cumplir la normativa de productos sanitarios.' },
    { id: 'RedesSociales', name: 'Redes sociales', pointsCost: 50, duration: 10000, cost: 30000, req: co => co.isLaterOrEqualThan(13, 1), desc: 'Gestión de redes sociales, sorteos y contenido en vídeo. Si aparece un paciente real, cesión de imagen firmada por escrito.' },
    { id: 'InfluencerMarketing', name: 'Marketing con creadores de contenido', pointsCost: 80, duration: 12000, cost: 60000, req: co => co.hasResearch('RedesSociales') && co.isLaterOrEqualThan(15, 1), desc: 'Creadores de contenido locales, envío de producto y embajadores, solo para gafas de sol y monturas como moda: la ley prohíbe que un famoso recomiende lentillas o cristales graduados.' },
    { id: 'MarketingClinico', name: 'Marketing del gabinete', pointsCost: 40, duration: 10000, cost: 30000, req: co => co.hasResearch('Gabinete') || !!(co.modules.gabinete && co.modules.gabinete.tier > 0), desc: 'Campañas sanitarias: cribados en colegios y empresas, conciertos con aseguradoras, control de miopía, presbicia, audiología, programas de fabricante y relación con prescriptores médicos (sin comisiones por receta: es ilegal).' },
    { id: 'MarcaPropia', name: 'Marca propia y branding', pointsCost: 100, duration: 15000, cost: 120000, req: co => co.level >= 3 && co.hasResearch('Marketing') && !(mkState(co) && mkState(co).group === 'franquicia'), desc: 'Marca registrada, identidad, packaging de marca, prensa de moda y TV autonómica. Sube el tope de notoriedad de 30 a 100 (60 en cooperativa).' },
    { id: 'ProbadorVirtualWeb', name: 'Probador virtual online', pointsCost: 60, duration: 10000, cost: 50000, req: co => co.isLaterOrEqualThan(16, 1) && co.hasResearch('MarketingDigital'), desc: 'Probador por cámara web en la venta online propia: +15 % unidades. No se guarda el escaneo facial sin permiso (RGPD).' },
    { id: 'DeptoMarketing', name: 'Departamento de marketing', pointsCost: 150, duration: 15000, cost: 200000, req: co => co.level >= 3 && co.hasResearch('MarcaPropia'), desc: 'Contratar un responsable o un departamento completo, presupuesto automático y campañas siempre activas.' },
    { id: 'TradeMarketing', name: 'Trade marketing', pointsCost: 120, duration: 15000, cost: 150000, req: co => co.hasResearch('MultiPlatform') || co.gameLog.filter(g => (g.platforms || []).some(p => !OWN_CH.includes(p))).length >= 3, desc: 'PLV, expositores de marca y formación de producto para ópticas y cadenas de terceros.' },
    { id: 'FeriasInternacionales', name: 'Ferias internacionales', pointsCost: 80, duration: 10000, cost: 100000, req: co => co.level >= 4 || !!(mkState(co) && mkState(co).brand >= 40), desc: 'Stand en las ferias internacionales de óptica Milano Eyewear (Milán, febrero) y Salón Prisma (París, septiembre). Requiere marca registrada.' },
    { id: 'AppPropia', name: 'App propia', pointsCost: 200, duration: 15000, cost: 250000, req: co => co.isLaterOrEqualThan(16, 1) && co.hasResearch('CRMFidelizacion') && co.hasResearch('MarketingDigital'), desc: 'App con tarjeta digital, cita online y probador: +10 recurrencia, +20 opt-in.' }
  ];
  for (const r of RESEARCH) if (!DATA.RESEARCH.some(x => x.id === r.id)) DATA.RESEARCH.push(Object.assign({ category: 'Marketing' }, r));
  const TRAINING = [
    { id: 'curso_marketing', name: 'Curso de marketing para ópticas', cost: 40000, pointsCost: 10, duration: 16000, basePoints: 10, tF: 0.1, dF: 0.3, rF: 0.3, sF: 0.3, maxP: 700, level: 2, skill: 'marketing' },
    { id: 'master_branding', name: 'Máster en branding y comunicación', cost: 110000, pointsCost: 25, duration: 20000, basePoints: 12, tF: 0.1, dF: 0.6, rF: 0.3, sF: 0.2, maxP: 900, level: 3, skill: 'branding' }
  ];
  for (const t of TRAINING) if (!DATA.TRAINING.some(x => x.id === t.id)) DATA.TRAINING.push(t);

  /* ---------- requisitos reutilizables (devuelven texto del motivo o null) ---------- */
  const R = {
    res: (co, id) => co.hasResearch(id) ? null : 'Investiga «' + ((DB.research(id) || {}).name || id) + '»',
    lvl: (co, n) => co.level >= n ? null : 'Requiere local de nivel ' + n + ' (' + C.LEVELS[n].name + ')',
    date: (co, y, m) => co.isLaterOrEqualThan(y, m) ? null : 'Disponible a partir de ' + (+y + 1994),
    act: (s, id) => isActive(s, id) ? null : 'Requiere tener activa «' + CAMP[id].name + '»',
    dev: co => co.currentGame && co.currentGame.state === 'dev' ? null : 'Solo durante el desarrollo de una colección',
    selling: co => (co.gameLog.some(g => !g.soldOut) || (co.currentGame && co.currentGame.stage >= 3)) ? null : 'Necesitas una colección en ventas o en fase de lanzamiento',
    third: co => (co.licencedPlatforms.some(p => !OWN_CH.includes(p) && p !== 'mercadillos') || co.gameLog.some(g => (g.platforms || []).some(p => !OWN_CH.includes(p)))) ? null : 'Necesitas trabajar con algún canal de terceros',
    brand: (s, n) => s.brand >= n ? null : 'Requiere notoriedad ≥ ' + n,
    branding: s => s.flags.branding ? null : 'Requiere «Marca registrada e identidad visual»',
    noFranq: s => s.group !== 'franquicia' ? null : 'No disponible en una franquicia (la marca es de la cadena)',
    gab: co => (co.hasResearch('Gabinete') || (co.modules.gabinete && co.modules.gabinete.tier > 0)) ? null : 'Requiere gabinete optométrico',
    audio: co => (co.researchCompleted.some(id => /audio/i.test(id)) || (co.modules.gabinete && co.modules.gabinete.audiologia)) ? null : 'Requiere la unidad de audiología',
    thirdGame: co => (co.currentGame && (co.currentGame.platforms || []).some(p => !OWN_CH.includes(p))) ? null : 'La colección en desarrollo debe venderse en algún canal de terceros',
    gmb: s => s.flags.gmb ? null : 'Crea primero la ficha de empresa en el buscador'
  };
  const any = (...fns) => fns.find(x => x) || null;

  /* ---------- catálogo de campañas (48) ----------
     type: puntual (temporal, ocupa plaza) · recurrente (always-on con cuota, ocupa plaza) · setup (acuerdo/alta permanente, sin plaza)
           temporada (temporal larga) · lanzamiento (las 4 del núcleo) · promo · estudio
     fx: hype, traffic/trafficWeeks, brand, fans, fansPct, stars, retentionTemp/retentionWeeks, patients/patientsWeeks,
         units:[{genre|audience|channel|third|all, pct}]/unitsWeeks, reach
         always-on: trafficPerm, patientsPerm, retention, optIn, marginPct, unitsAlways, hypeWeekly/hypeCap, brandMonthly,
         fansPctMonthly, trafficMonthly/trafficCap, starsQuarter, hypeCollection, fansLossPct, reachMonthly, scaleOptIn */
  const CAMP = {};
  const def = (c) => { CAMP[c.id] = c; };
  // --- Acciones locales (MarketingLocal)
  def({ id: 'gmb_perfil', name: 'Ficha de empresa en guías y buscadores locales', cat: 'local', type: 'setup', cost: 0, fee: 0, weeks: 0, req: () => null, fx: { trafficPerm: 0.05, special: 'gmb' }, desc: 'Gratis: guía telefónica y páginas de comercios al principio, ficha con mapa, horario y fotos del gabinete en el buscador después. +5 % visitas permanente y activa la mecánica de reseñas (el 97 % de los clientes las lee). Comprar reseñas falsas está prohibido.' });
  def({ id: 'programa_resenas', name: 'Programa de reseñas (QR en tienda + respuestas)', cat: 'local', type: 'recurrente', cost: 300, fee: 50, weeks: 0, research: 'MarketingLocal', req: (co, s) => any(R.res(co, 'MarketingLocal'), R.gmb(s)), fx: { starsQuarter: 0.1 }, desc: '+0,1 estrellas por trimestre hasta 4,8: solo reseñas reales, pedidas tras la entrega a quien ha aceptado ser contactado. El 89 % de los clientes espera respuesta del negocio.' });
  def({ id: 'cita_online', name: 'Agenda de citas online', cat: 'local', type: 'recurrente', cost: 200, fee: 60, weeks: 0, research: 'MarketingLocal', req: co => any(R.date(co, 10, 1), R.res(co, 'MarketingLocal'), R.lvl(co, 2)), fx: { patientsPerm: 0.05, trafficPerm: 0.02, optIn: 5 }, desc: '+5 % pacientes de gabinete, +2 % visitas y +5 opt-in: los datos entran con consentimiento. Menos ausencias.' });
  def({ id: 'buzoneo', name: 'Buzoneo de 10.000 folletos en el barrio', cat: 'local', type: 'puntual', cost: 1500, fee: 0, weeks: 2, research: 'MarketingLocal', req: co => R.res(co, 'MarketingLocal'), fx: { hype: 4, traffic: 0.08, trafficWeeks: 8, reach: 10000 }, desc: 'Imprenta y reparto con vales de descuento, con el número de registro sanitario si anuncia servicios clínicos: +8 % visitas durante 8 semanas (sobre todo vecinos mayores) y +4 expectación si hay colección en desarrollo. Repetible (0,7 / 0,3).' });
  def({ id: 'prensa_local', name: 'Anuncio en prensa local y revista de barrio', cat: 'local', type: 'puntual', cost: 2500, fee: 0, weeks: 1, research: 'MarketingLocal', req: co => R.res(co, 'MarketingLocal'), fx: { hype: 8, traffic: 0.05, trafficWeeks: 4, brand: 1, reach: 40000 }, desc: 'Media página en el diario de la provincia y faldón en la revista del barrio: +8 expectación, +5 % visitas 4 semanas, +1 notoriedad.' });
  def({ id: 'radio_local', name: 'Cuñas en radio local (60 cuñas, 2 semanas)', cat: 'local', type: 'puntual', cost: 3000, fee: 0, weeks: 2, research: 'MarketingLocal', req: co => R.res(co, 'MarketingLocal'), fx: { hype: 10, traffic: 0.10, trafficWeeks: 6, brand: 2, reach: 480000 }, desc: 'Llega sobre todo a mayores de 50 (presbicia y audiología): +10 expectación, +10 % visitas 6 semanas, +2 notoriedad. Sin atribuir propiedades curativas a gafas o audífonos.' });
  def({ id: 'escaparate_pro', name: 'Escaparate temático de temporada (escaparatista)', cat: 'local', type: 'puntual', cost: 1500, fee: 0, weeks: 1, research: 'MarketingLocal', req: co => any(R.res(co, 'MarketingLocal'), R.lvl(co, 2)), fx: { hype: 5, traffic: 0.06, trafficWeeks: 12, special: 'escaparate' }, desc: 'Sol en primavera, vuelta al cole, otoño o Navidad, con el número de registro sanitario siempre visible: +6 % visitas 12 semanas (+10 % en temporada de sol), +5 expectación y mejor presentación de la colección en curso. Gratis con escaparatista en plantilla (departamento nivel 3).' });
  def({ id: 'evento_tienda', name: 'Evento de presentación en tienda', cat: 'local', type: 'puntual', cost: 2500, fee: 0, weeks: 1, research: 'MarketingLocal', req: co => any(R.res(co, 'MarketingLocal'), R.lvl(co, 2), R.selling(co)), fx: { hype: 12, fansPct: 0.005, fans: 50, stars: 0.05 }, desc: 'Catering, invitaciones y música: +12 expectación, +0,5 % clientes fieles (+50), +0,05 estrellas.' });
  def({ id: 'dia_de_marca', name: 'Presentación de colección con el proveedor', cat: 'local', type: 'puntual', cost: 800, fee: 0, weeks: 1, research: 'MarketingLocal', req: co => any(R.res(co, 'MarketingLocal'), R.lvl(co, 2), R.third(co)), fx: { hype: 6, traffic: 0.10, trafficWeeks: 2, fans: 60, units: [{ channel: 'tienda', pct: 0.08 }], unitsWeeks: 4 }, desc: 'El proveedor presta el muestrario completo y comparte el gasto: +6 expectación, +10 % visitas 2 semanas, +60 fieles, +8 % unidades en tienda 4 semanas.' });
  // --- Marketing del gabinete (MarketingClinico)
  def({ id: 'revision_colegios', name: 'Cribado visual en colegios (con autorización del centro)', cat: 'clinico', type: 'puntual', cost: 4000, fee: 0, weeks: 4, research: 'MarketingClinico', req: co => R.res(co, 'MarketingClinico'), fx: { fansPct: 0.01, fans: 300, traffic: 0.08, trafficWeeks: 8, brand: 2, retentionTemp: 1, retentionWeeks: 48, units: [{ genre: 'infantil', pct: 0.15 }], unitsWeeks: 6, special: 'colegios' }, desc: 'Con autorización firmada de la dirección y el AMPA y consentimiento de las familias; dentro del colegio no se vende nada: las familias con un resultado alterado vienen a la óptica. +1 % fieles (+300), +8 % visitas 8 semanas, +2 notoriedad, +1 recurrencia un año, Infantil +15 % unidades 6 semanas. ×1,5 en septiembre, ×1,3 con Plan Mirada Escolar.' });
  def({ id: 'revision_empresas', name: 'Convenio de salud visual laboral con empresas y colectivos', cat: 'clinico', type: 'puntual', cost: 3000, fee: 0, weeks: 4, research: 'MarketingClinico', req: co => R.res(co, 'MarketingClinico'), fx: { fans: 200, retentionTemp: 2, retentionWeeks: 48, patients: 0.10, patientsWeeks: 12 }, desc: 'Revisiones, gafas de protección EN 166 y lentes ocupacionales facturadas a la empresa: +200 fieles, +2 recurrencia un año, +10 % pacientes de gabinete 12 semanas (descuento de colectivo 10-25 %).' });
  def({ id: 'convenio_aseguradoras', name: 'Concierto con aseguradoras de salud y mutualidades', cat: 'clinico', type: 'setup', cost: 1000, fee: 0, weeks: 0, research: 'MarketingClinico', req: co => any(R.res(co, 'MarketingClinico'), R.gab(co)), fx: { patientsPerm: 0.12, trafficPerm: 0.05, retention: 2, unitsAlways: [{ channel: 'mutuas', pct: 0.15 }], marginPct: 0.02 }, desc: 'Centro concertado en el cuadro médico de las aseguradoras de salud y de las mutualidades de funcionarios, con precios de baremo (15-30 % de descuento a sus asegurados): +12 % pacientes, +5 % visitas, +2 recurrencia, +15 % unidades en el canal Aseguradoras; −2 % de margen medio por el baremo. Se puede rescindir.' });
  def({ id: 'campana_control_miopia', name: 'Campaña de control de miopía infantil', cat: 'clinico', type: 'puntual', cost: 2500, fee: 0, weeks: 4, research: 'MarketingClinico', req: co => R.res(co, 'MarketingClinico'), fx: { hype: 6, patients: 0.10, patientsWeeks: 12, units: [{ genre: 'infantil', pct: 0.20 }], unitsWeeks: 8, retentionTemp: 3, retentionWeeks: 48, fans: 150, special: 'miopia' }, desc: 'Información veraz a las familias, sin prometer que una lente «elimina» la miopía ni explotar la preocupación de los padres: +10 % pacientes 12 semanas, Infantil +20 % unidades 8 semanas, +3 recurrencia (revisiones semestrales), +150 fieles. ×1,5 con adaptación de lentillas investigada.' });
  def({ id: 'campana_progresivos', name: 'Campaña de presbicia y progresivos (45+)', cat: 'clinico', type: 'puntual', cost: 2000, fee: 0, weeks: 3, research: 'MarketingClinico', req: co => R.res(co, 'MarketingClinico'), fx: { hype: 7, units: [{ audience: 'mature', pct: 0.15 }], unitsWeeks: 8, patients: 0.08, patientsWeeks: 8, stars: 0.03, special: 'progresivos' }, desc: 'Garantía de adaptación y prueba sin compromiso, dirigida a mayores de 45: público Adultos y sénior +15 % unidades 8 semanas, +8 % pacientes, +0,03 estrellas. ×1,3 si dominas progresivas o free-form.' });
  def({ id: 'campana_audiologia', name: 'Jornadas de puertas abiertas de audiología', cat: 'clinico', type: 'puntual', cost: 1500, fee: 0, weeks: 3, research: 'MarketingClinico', req: co => any(R.res(co, 'MarketingClinico'), R.audio(co)), fx: { patients: 0.06, patientsWeeks: 8, fans: 100, retentionTemp: 1, retentionWeeks: 48, special: 'audio' }, desc: 'Revisión auditiva gratuita y prueba de audífonos 30 días, en cabina insonorizada y con audioprotesista titulado: +6 % pacientes 8 semanas, +100 fieles, +1 recurrencia; audiología +20 % ingresos 8 semanas. ×1,5 la semana del Día Mundial de la Audición.' });
  def({ id: 'programa_fabricante', name: 'Programa de fabricante de lentes (centro certificado)', cat: 'clinico', type: 'setup', cost: 0, fee: 0, weeks: 0, research: 'MarketingClinico', req: co => any(R.res(co, 'MarketingClinico'), R.lvl(co, 3)), fx: { brand: 2, patientsPerm: 0.05, trafficPerm: 0.03, marginPct: 0.05, scoreBonus: 0.02 }, desc: 'Red de centros certificados de un fabricante de lentes: +2 notoriedad, +5 % pacientes, +3 % visitas (apareces en su localizador de ópticas), mejores notas en Lentes; compromiso de compra: −5 % de margen.' });
  // --- Marca y notoriedad (Marketing / MarcaPropia)
  def({ id: 'club_deportivo', name: 'Patrocinio y convenio con club deportivo local (temporada)', cat: 'marca', type: 'temporada', cost: 6000, fee: 0, weeks: 36, research: 'Marketing', req: co => R.res(co, 'Marketing'), fx: { brand: 3, fansPct: 0.01, fans: 100, hypeCollection: 10, hypeGenre: 'deportiva' }, desc: 'Valla, camiseta y descuento a los socios de un club de base o de categoría regional (fútbol, running, pádel, ciclismo): +3 notoriedad, +1 % fieles (+100); colecciones Deportiva lanzadas en temporada +10 expectación.' });
  def({ id: 'mupis_exterior', name: 'Circuito de mupis y marquesinas (14 días)', cat: 'marca', type: 'puntual', cost: 8000, fee: 0, weeks: 2, research: 'Marketing', req: co => any(R.res(co, 'Marketing'), R.lvl(co, 2)), fx: { hype: 12, brand: 3, traffic: 0.10, trafficWeeks: 4, reach: 300000 }, desc: '20-30 caras de 120×176 cm con el establecimiento sanitario identificado: +12 expectación, +3 notoriedad, +10 % visitas 4 semanas.' });
  def({ id: 'branding_marca', name: 'Marca registrada e identidad visual', cat: 'marca', type: 'setup', cost: 12000, fee: 0, weeks: 0, research: 'MarcaPropia', req: (co, s) => any(R.res(co, 'MarcaPropia'), R.noFranq(s)), fx: { brand: 5, fansPct: 0.05, special: 'branding' }, desc: 'Registro en la OEPM y la EUIPO más identidad visual: sube el tope de notoriedad de 30 a 100 (60 en cooperativa), +5 notoriedad, +5 % fieles. Requisito para embajador, TV y ferias internacionales.' });
  def({ id: 'packaging_marca', name: 'Packaging de marca para la colección en curso', cat: 'marca', type: 'puntual', cost: 5000, fee: 0, weeks: 2, research: 'MarcaPropia', req: co => any(R.res(co, 'MarcaPropia'), R.dev(co)), fx: { brand: 1, retentionTemp: 1, retentionWeeks: 48, special: 'packaging' }, desc: 'Estuche, bolsa y gamuza con logo: +10 % de fieles ganados por la colección en curso, +1 recurrencia, +1 notoriedad y mejor nota en Packaging. −40 % de coste con diseño senior (nivel 3).' });
  def({ id: 'pr_prensa_moda', name: 'Gabinete de prensa de moda (iguala mensual)', cat: 'marca', type: 'recurrente', cost: 0, fee: 2500, weeks: 0, research: 'MarcaPropia', req: co => any(R.res(co, 'MarcaPropia'), R.lvl(co, 3)), fx: { hypeWeekly: 4, hypeCap: 40, brandMonthly: 1, scoreBonus: 0.02 }, desc: '+4 expectación/semana en desarrollo (tope 40 por colección), +1 notoriedad/mes y mejores reseñas en Óptica & Moda. Incluido con el departamento completo.' });
  def({ id: 'tv_autonomica', name: 'Campaña en TV autonómica (spot + 60 pases)', cat: 'marca', type: 'puntual', cost: 45000, fee: 0, weeks: 3, research: 'MarcaPropia', req: (co, s) => any(R.date(co, -9, 8), R.res(co, 'MarcaPropia'), R.brand(s, 15)), fx: { hype: 25, brand: 6, fansPct: 0.01, traffic: 0.15, trafficWeeks: 4, reach: 3600000 }, desc: '+25 expectación, +6 notoriedad, +1 % fieles, +15 % visitas 4 semanas.' });
  def({ id: 'embajador_marca', name: 'Embajador de gafas de sol y monturas (deportista o famoso, 1 año)', cat: 'marca', type: 'temporada', cost: 60000, fee: 0, weeks: 48, research: 'InfluencerMarketing', req: (co, s) => any(R.res(co, 'InfluencerMarketing'), R.lvl(co, 3), R.brand(s, 20), R.branding(s), R.noFranq(s)), fx: { brand: 8, fansPct: 0.02, hypeCollection: 20 }, desc: 'Solo como imagen de moda: puede lucir gafas de sol (EPI) y monturas, nunca recomendar lentillas ni cristales graduados. +8 notoriedad, +2 % fieles y +20 expectación a cada colección que empiece durante el contrato.' });
  // --- Digital y redes
  def({ id: 'google_ads_local', name: 'Anuncios en el buscador local (trimestre)', cat: 'digital', type: 'recurrente', cost: 0, fee: 1500, weeks: 12, research: 'MarketingDigital', req: co => R.res(co, 'MarketingDigital'), fx: { trafficPerm: 0.12, patientsPerm: 0.08, reachMonthly: 15000 }, desc: '«óptica + ciudad», «progresivos», «audífonos»: +12 % visitas y +8 % pacientes durante 12 semanas (renovable; se renueva solo con presupuesto automático). ×0,8 sin departamento, ×1,3 con especialista en publicidad digital.' });
  def({ id: 'seo_local', name: 'Posicionamiento local, blog de salud visual y gestión de la ficha', cat: 'digital', type: 'recurrente', cost: 0, fee: 800, weeks: 0, research: 'MarketingDigital', req: (co, s) => any(R.res(co, 'MarketingDigital'), R.gmb(s)), fx: { trafficMonthly: 0.03, trafficCap: 0.20, starsQuarter: 0.1 }, desc: 'Artículos sobre miopía, ojo seco o progresivos firmados por un óptico-optometrista colegiado: +3 % visitas acumulativo por mes (hasta +20 %), +0,1 estrellas/trimestre e inmunidad frente a cambios de algoritmo. Incluido en la cuota del departamento nivel ≥ 1.' });
  def({ id: 'cm_externo', name: 'Gestor de redes sociales externo', cat: 'digital', type: 'recurrente', cost: 0, fee: 600, weeks: 0, research: 'RedesSociales', req: co => R.res(co, 'RedesSociales'), fx: { brandMonthly: 0.5, hypeWeekly: 2, hypeCap: 20, fansPctMonthly: 0.002 }, desc: '1-2 redes, 8-12 publicaciones/mes con monturas nuevas y trabajos del taller: +0,5 notoriedad/mes, +2 expectación/semana en desarrollo (tope 20), +0,2 % fieles/mes. Incluido en la cuota del departamento nivel ≥ 1 (×1,2 con gestor de redes júnior).' });
  def({ id: 'sorteo_redes', name: 'Sorteo en redes', cat: 'digital', type: 'puntual', cost: 800, fee: 0, weeks: 2, research: 'RedesSociales', req: (co, s) => any(R.res(co, 'RedesSociales'), (isActive(s, 'cm_externo') || s.dept >= 2) ? null : 'Requiere gestor de redes sociales (campaña activa o departamento nivel ≥ 2)'), fx: { hype: 6, fansPct: 0.003, fans: 150, youngBonus: 1.3 }, desc: 'Se sortean 1-3 gafas de sol o vales de montura: +6 expectación (×1,3 público joven), +0,3 % fieles (+150).' });
  def({ id: 'contenido_video', name: 'Producción de vídeo corto para redes sociales', cat: 'digital', type: 'recurrente', cost: 0, fee: 1500, weeks: 0, research: 'RedesSociales', req: co => any(R.res(co, 'RedesSociales'), R.date(co, 17, 1)), fx: { brandMonthly: 1, hypeWeekly: 3, hypeCap: 30, youngBonus: 1.3 }, desc: '+1 notoriedad/mes, +3 expectación/semana (tope 30, ×1,3 público joven). ×1,3 con responsable de contenidos (nivel 3).' });
  def({ id: 'influencers_micro', name: 'Campaña con 10 creadores de contenido de moda locales', cat: 'digital', type: 'puntual', cost: 6000, fee: 0, weeks: 3, research: 'InfluencerMarketing', req: co => R.res(co, 'InfluencerMarketing'), fx: { hype: 15, fansPct: 0.005, fans: 200, brand: 2, reach: 300000, genreBonus: { sol: 1.3, premium: 1.3 } }, desc: 'Pequeños creadores (150-500 € por colaboración + producto), solo gafas de sol y monturas como moda: +15 expectación (×1,3 en Sol y Lujo), +0,5 % fieles (+200), +2 notoriedad. Con una colección Graduado, Infantil o Lectura en desarrollo (productos sanitarios), riesgo de denuncia por publicidad sanitaria.' });
  def({ id: 'seeding_producto', name: 'Envío de producto a 50 creadores de contenido', cat: 'digital', type: 'puntual', cost: 9000, fee: 0, weeks: 4, research: 'InfluencerMarketing', req: co => R.res(co, 'InfluencerMarketing'), fx: { hype: 18, brand: 3, special: 'seeding' }, desc: '50 gafas de sol o monturas a coste con packaging: +18 expectación, +3 notoriedad y triplica durante 6 meses la probabilidad de que un creador con 1 M de seguidores suba tus gafas. Mismo riesgo legal que los creadores si la colección es un producto sanitario.' });
  def({ id: 'probador_virtual_web', name: 'Probador virtual en la web', cat: 'digital', type: 'recurrente', cost: 3000, fee: 200, weeks: 0, research: 'ProbadorVirtualWeb', req: co => any(R.res(co, 'ProbadorVirtualWeb'), R.date(co, 16, 1)), fx: { unitsAlways: [{ channel: 'webpropia', pct: 0.15 }, { channel: 'crowd', pct: 0.10 }], hypeCollection: 5 }, desc: 'Prueba de monturas por cámara web (sin guardar el escaneo facial sin permiso): +15 % unidades en Venta online propia, +10 % en Venta directa, +5 expectación por colección.' });
  def({ id: 'app_fidelizacion', name: 'App propia (tarjeta digital, cita online, probador)', cat: 'crm', type: 'recurrente', cost: 40000, fee: 500, weeks: 0, research: 'AppPropia', req: co => R.res(co, 'AppPropia'), fx: { retention: 10, trafficPerm: 0.05, fansLossPct: 0.3, patientsPerm: 0.10, optIn: 20 }, desc: '+10 recurrencia, +5 % visitas, +10 % pacientes, +20 opt-in; las pérdidas de fieles por colecciones malas bajan un 30 %.' });
  // --- CRM y fidelización
  def({ id: 'consentimiento_rgpd', name: 'Consentimiento RGPD y segmentación de la base', cat: 'crm', type: 'setup', cost: 1200, fee: 40, weeks: 0, research: 'CRMFidelizacion', req: co => R.res(co, 'CRMFidelizacion'), fx: { optIn: 15, special: 'rgpd' }, desc: 'Asesoría + software: consentimiento comercial expreso y firmado, separado de la ficha clínica. +15 opt-in e inmunidad frente a la brecha de datos. Sin esto, cada campaña CRM tiene un 10 % de riesgo de denuncia ante la AEPD (la historia optométrica es un dato de salud, art. 9 RGPD) y las recitaciones pueden acabar en reclamación.' });
  def({ id: 'tarjeta_fidelizacion', name: 'Tarjeta o club de fidelización familiar (puntos)', cat: 'crm', type: 'recurrente', cost: 1500, fee: 100, weeks: 0, research: 'CRMFidelizacion', req: co => R.res(co, 'CRMFidelizacion'), fx: { retention: 5, fansLossPct: 0.2, optIn: 20, marginPct: 0.03 }, desc: '5 % de cada compra en puntos y cheque anual para toda la familia: +5 recurrencia, +20 opt-in, pérdidas de fieles −20 %; −3 % de margen (coste del cheque).' });
  def({ id: 'programa_referidos', name: 'Programa «Trae a un amigo»', cat: 'crm', type: 'recurrente', cost: 500, fee: 0, weeks: 0, research: 'CRMFidelizacion', req: (co, s) => any(R.res(co, 'CRMFidelizacion'), R.act(s, 'tarjeta_fidelizacion')), fx: { fansPctMonthly: 0.004, optIn: 10, special: 'referidos' }, desc: '20 € al padrino + 20 € al nuevo cliente, solo si compra: +0,4 % fieles al mes (máximo 500) a 40 € cada uno, cobrados como cuota mensual (coste por cliente 40 € frente a 120 € objetivo), +10 opt-in.' });
  def({ id: 'financiacion_12_meses', name: 'Financiación en 12 meses sin intereses', cat: 'crm', type: 'setup', cost: 0, fee: 0, weeks: 0, research: 'CRMFidelizacion', req: co => any(R.res(co, 'CRMFidelizacion'), R.lvl(co, 2)), fx: { unitsAlways: [{ genre: 'premium', pct: 0.10 }, { genre: 'graduado', pct: 0.05 }], marginPct: 0.04 }, desc: '«Paga cómodamente en un año», con TAE y condiciones visibles: Premium +10 % y Graduado +5 % unidades, conversión y ticket de tienda al alza; −4 % de margen (comisión de la financiera).' });
  def({ id: 'crm_recordatorios', name: 'Recordatorio anual de revisión (CRM)', cat: 'crm', type: 'recurrente', cost: 2000, fee: 300, weeks: 0, research: 'CRMFidelizacion', req: co => any(R.res(co, 'CRMFidelizacion'), R.gab(co)), fx: { retention: 8, patientsPerm: 0.15, scaleOptIn: true }, desc: 'Carta, correo electrónico, SMS y mensajería solo a quien firmó el consentimiento comercial: +8 recurrencia y +15 % pacientes, ambos escalados por el opt-in. Sin consentimiento en regla, riesgo de reclamación ante la AEPD.' });
  def({ id: 'cumpleanos_estacional', name: 'Campañas de cumpleaños y estacionales', cat: 'crm', type: 'recurrente', cost: 0, fee: 150, weeks: 0, research: 'CRMFidelizacion', req: (co, s) => any(R.res(co, 'CRMFidelizacion'), R.act(s, 'crm_recordatorios')), fx: { retention: 2, trafficPerm: 0.03, scaleOptIn: true }, desc: 'Felicitación con cheque regalo y avisos de temporada por correo y mensajería, con consentimiento: +2 recurrencia y +3 % visitas permanentes (escalan con el opt-in).' });
  def({ id: 'mailing_postal', name: 'Mailing postal con catálogo a la base de clientes', cat: 'crm', type: 'puntual', cost: 500, costFn: (co, s) => Math.max(500, Math.round(Math.min(co.fans * s.optIn / 100, 20000))), fee: 0, weeks: 2, research: 'CRMFidelizacion', req: co => any(R.res(co, 'CRMFidelizacion'), R.selling(co)), fx: { hype: 10, retentionTemp: 3, retentionWeeks: 12, traffic: 0.06, trafficWeeks: 6 }, desc: '1 € por cliente contactable (mín. 500 €, máx. 20.000): +10 expectación, +3 recurrencia 12 semanas, +6 % visitas 6 semanas.' });
  def({ id: 'newsletter_lanzamiento', name: 'Boletín electrónico de lanzamiento', cat: 'crm', type: 'puntual', cost: 300, fee: 0, weeks: 1, research: 'CRMFidelizacion', req: co => any(R.res(co, 'CRMFidelizacion'), R.date(co, 9, 1), R.dev(co)), fx: { special: 'newsletter' }, desc: 'Boletín a la base con consentimiento: de +2 a +6 expectación según fieles × opt-in.' });
  // --- Lanzamiento (las 4 del núcleo; se contratan con G.applyMarketing)
  def({ id: 'revistas', name: 'Anuncios en revistas', cat: 'lanzamiento', type: 'lanzamiento', cost: 50000, fee: 0, weeks: 0, research: 'Marketing', req: co => any(R.res(co, 'Marketing'), R.dev(co)), fx: { brand: 1 }, desc: 'Campaña del núcleo (factor 0,5). Además +1 notoriedad.' });
  def({ id: 'demos', name: 'Revistas y muestras', cat: 'lanzamiento', type: 'lanzamiento', cost: 150000, fee: 0, weeks: 0, research: 'Marketing', req: co => any(R.res(co, 'Marketing'), R.dev(co)), fx: { brand: 2 }, desc: 'Campaña del núcleo (factor 1). Además +2 notoriedad.' });
  def({ id: 'campana', name: 'Campaña nacional', cat: 'lanzamiento', type: 'lanzamiento', cost: 500000, fee: 0, weeks: 0, research: 'Marketing', req: co => any(R.res(co, 'Marketing'), R.dev(co)), fx: { brand: 5 }, desc: 'Campaña del núcleo (factor 1,5). Además +5 notoriedad.' });
  def({ id: 'campanaxl', name: 'Campaña internacional con TV y desfiles', cat: 'lanzamiento', type: 'lanzamiento', cost: 2000000, fee: 0, weeks: 0, research: 'Marketing', req: co => any(R.res(co, 'Marketing'), R.lvl(co, 4), R.dev(co)), fx: { brand: 12 }, desc: 'Campaña del núcleo (factor 2). Además +12 notoriedad.' });
  // --- Trade marketing
  def({ id: 'plv_canal', name: 'PLV y expositores de marca para la colección en curso', cat: 'trade', type: 'puntual', cost: 15000, fee: 0, weeks: 3, research: 'TradeMarketing', req: co => any(R.res(co, 'TradeMarketing'), R.dev(co), R.thirdGame(co)), fx: { brand: 2, special: 'plv' }, desc: 'Expositores de sobremesa en 100-300 puntos de venta: +10 % unidades en los canales de terceros de esa colección, +2 notoriedad.' });
  def({ id: 'formacion_canal', name: 'Formación de producto a vendedores del canal', cat: 'trade', type: 'puntual', cost: 8000, fee: 0, weeks: 2, research: 'TradeMarketing', req: co => R.res(co, 'TradeMarketing'), fx: { units: [{ third: true, pct: 0.06 }], unitsWeeks: 12 }, desc: 'Formador + viajes + muestras: +6 % unidades en canales de terceros para las colecciones lanzadas en 12 semanas.' });
  // --- Estudios y promociones
  def({ id: 'informe_tendencias', name: 'Informe de tendencias', cat: 'estudio', type: 'estudio', cost: 5000, fee: 0, weeks: 0, research: 'EstudiosMercado', req: co => R.res(co, 'EstudiosMercado'), fx: { special: 'informe' }, desc: 'Panel sectorial de consumo óptico: revela la tendencia vigente, cuánto le queda y los canales con más cuota.' });
  def({ id: 'promo_2x1', name: 'Promoción 2×1 / segunda gafa por 1 €', cat: 'promo', type: 'promo', cost: 0, fee: 0, weeks: 4, research: null, req: co => any(R.lvl(co, 2), R.selling(co)), fx: { brand: -1, fansPct: 0.003, special: 'promo' }, desc: 'Durante 4 semanas: +30 % unidades y −20 % de precio en las colecciones lanzadas o en venta, +0,3 % fieles, −1 notoriedad. Precio de referencia: el más bajo de los últimos 30 días (LOCM art. 20) y límites de graduación indicados. Más de 3 veces al año: 5 % de riesgo de inspección por publicidad engañosa.' });
  const CATS = [['local', 'Acciones locales'], ['digital', 'Digital y redes'], ['crm', 'CRM y fidelización'], ['clinico', 'Marketing del gabinete'], ['marca', 'Marca y notoriedad'], ['trade', 'Trade marketing'], ['lanzamiento', 'Campañas de lanzamiento'], ['estudio', 'Estudios'], ['promo', 'Promociones']];
  const FAIRS = {
    mido: { name: 'Milano Eyewear (Milán)', bookMonth: 1, runMonth: 2, runWeek: 2, base: 45000, perYear: 2000, hypeMin: 20, hypeMax: 150, opts: [{ name: 'Stand de 8 m²', cost: 60000, factor: 0.4, brand: 5 }, { name: 'Stand de 32 m²', cost: 150000, factor: 0.8, brand: 10 }, { name: 'Stand isla', cost: 400000, factor: 1.5, brand: 15 }] },
    silmo: { name: 'Salón Prisma (París)', bookMonth: 8, runMonth: 9, runWeek: 4, base: 35000, perYear: 1500, hypeMin: 15, hypeMax: 120, opts: [{ name: 'Stand de 12 m²', cost: 50000, factor: 0.35, brand: 4 }, { name: 'Stand de 24 m²', cost: 120000, factor: 0.7, brand: 8 }, { name: 'Stand de 48 m²', cost: 350000, factor: 1.3, brand: 12 }] }
  };

  /* ---------- estado ---------- */
  function defaults() {
    return { v: 1, brand: 0, brandCap: 30, traffic: 0, patients: 0, retention: K.RETENTION_BASE, optIn: K.OPT_IN_BASE, stars: K.STARS_START, dept: 0, group: null, groupSince: 0,
      spendYTD: 0, newFansYTD: 0, spendMonth: 0, lastFans: 0, lastYear: null, spend12: [], revenue12: [], log12: [], hist: [],
      active: [], effects: [], history: [], flags: {}, fired: {}, seoTraffic: 0, hypeGiven: { gid: null, by: {} }, coreSeen: { gid: null, by: {} },
      planVeo: false, planVeoUntil: 0, promoUses: [], sanctions: [], seedingUntil: 0, audioUntil: 0, fair: { mido: null, silmo: null }, autoBudget: false,
      reachMonth: 0, reachLast: 0, lastRetentionIncome: 0, lastRoyalty: 0, visitsMonth: 0, lastInforme: null };
  }
  function S(co) {
    co.modules = co.modules || {}; let s = co.modules[ID]; if (!s || typeof s !== 'object') s = co.modules[ID] = {};
    const d = defaults(); for (const k in d) { if (s[k] === undefined || s[k] === null && d[k] !== null) s[k] = d[k]; }
    for (const k of ['spend12', 'revenue12', 'log12', 'hist', 'active', 'effects', 'history', 'promoUses', 'sanctions']) if (!Array.isArray(s[k])) s[k] = [];
    for (const k of ['flags', 'fired', 'hypeGiven', 'coreSeen', 'fair']) if (!s[k] || typeof s[k] !== 'object') s[k] = d[k];
    if (!s.hypeGiven.by) s.hypeGiven.by = {}; if (!s.coreSeen.by) s.coreSeen.by = {};
    s.active = s.active.filter(a => a && CAMP[a.id]); s.history = s.history.filter(h => h && CAMP[h.id]);
    s.brand = U.clamp(+s.brand || 0, 0, 100); s.stars = U.clamp(+s.stars || K.STARS_START, K.STARS_MIN, 5); s.dept = U.clamp(Math.floor(+s.dept || 0), 0, 3);
    if (s.group !== 'cooperativa' && s.group !== 'franquicia') s.group = null;
    return s;
  }
  const isActive = (s, id) => s.active.some(a => a.id === id);
  const activeOf = (s, id) => s.active.find(a => a.id === id);
  const week = co => Math.floor(co.currentWeek);
  const esc = v => String(v == null ? '' : v).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const toast = m => { if (typeof UI !== 'undefined' && UI && UI.toast) UI.toast(m); else if (G && G.company) G.log(m); };
  const notify = (h, t, type, opts) => G.notify(h, t, type, opts);
  const genreIs = (g, id) => g && (g.genre === id || g.secondGenre === id);

  /* ---------- plantilla asignada, eficacia, costes ---------- */
  function staffWeight(co) { let w = 0; for (const s of co.staff) { if (s.assignment !== ID) continue; let v = s.role === ID ? 1 : 0.5; v *= 1 + Math.min(5, (typeof s.level === 'function' ? s.level() : 1) - 1) * 0.1; if (s.skills && s.skills.marketing) v += 0.5; if (s.skills && s.skills.branding) v += 0.5; w += v; } return w; }
  function efficiency(co, s) { return DEPT[s.dept].eff + Math.min(0.4, 0.1 * staffWeight(co)); }
  function slots(co, s) { return DEPT[s.dept].slots + Math.floor(staffWeight(co)); }
  /* acciones que ocupan plaza: todo salvo altas/acuerdos (setup) y promociones de precio (las lleva la tienda) */
  function usedSlots(s) { return s.active.filter(a => CAMP[a.id] && CAMP[a.id].type !== 'setup' && CAMP[a.id].type !== 'promo').length; }
  function deptCost(co, s) { const base = DEPT[s.dept].cost; if (!base) return 0; const w = staffWeight(co); if (s.dept === 3) return Math.round(Math.max(base * 0.5, base - 2000 * w)); return Math.round(base * (1 - Math.min(0.75, 0.2 * w))); }
  function costOf(co, s, c) { let v = c.costFn ? c.costFn(co, s) : c.cost; if (co.level === 1 && c.cat === 'local') v *= 0.35; if (c.id === 'escaparate_pro' && s.dept === 3) return 0; if (c.id === 'packaging_marca' && s.dept === 3) v *= 0.6; if (c.type === 'lanzamiento') return v; if (s.dept === 3) v *= 0.85; else if (s.dept === 2 && (c.type === 'puntual' || c.type === 'temporada')) v *= 0.9; return Math.round(v); }
  /* referidos que entran al mes (0,4 % de los fieles × eficacia, tope REFERRAL_MAX); su coste (50 € cada uno) se cobra como cuota mensual */
  function referralFans(co, s) { const f = CAMP.programa_referidos ? CAMP.programa_referidos.fx.fansPctMonthly : 0.004; return Math.max(0, Math.min(K.REFERRAL_MAX, Math.floor(co.fans * f * efficiency(co, s)))); }
  function feeOf(co, s, c) { if (c.id === 'programa_referidos') return Math.round(referralFans(co, s) * K.REFERRAL_COST); let f = c.fee || 0; if (!f) return 0; if (s.dept >= 1 && (c.id === 'seo_local' || c.id === 'cm_externo')) return 0; if (s.dept === 3 && c.id === 'pr_prensa_moda') return 0; if (s.dept === 3 && c.cat === 'crm') f *= 0.7; return Math.round(f); }
  function repFactor(s, id, w) { const n = s.history.filter(h => h.id === id && h.w > w - K.REPEAT_WINDOW).length; return K.REPEAT[Math.min(n, 2)]; }
  function starsFactor(st) { return st < 3 ? 0.70 : st < 4 ? 0.85 : st < 4.5 ? 1.0 : st < 4.8 ? 1.12 : 1.2; }
  function brandTier(b) { return b < 30 ? 'local' : b < 60 ? 'regional' : 'nacional'; }
  function computeCap(s) { if (s.group === 'franquicia') return 40; if (s.group === 'cooperativa') return 60; return s.flags.branding ? 100 : 30; }
  function addBrand(s, v) { s.brandCap = computeCap(s); s.brand = U.clamp(s.brand + v, 0, s.brandCap); }
  function spend(co, s, amount, label) { if (amount <= 0) return; co.adjustCash(-amount, label); s.spendYTD += amount; s.spendMonth += amount; }
  function visitsMonth(co, s) { return Math.round(K.VISITS_BASE[co.level] * (1 + s.traffic) * starsFactor(s.stars) * (1 + s.brand / 200)); }
  function addEffect(s, e) { s.effects.push(e); if (s.effects.length > 80) s.effects.shift(); }
  function matchUnits(game, m) { const plats = game.platforms || []; if (m.all) return true; if (m.genre) return genreIs(game, m.genre); if (m.audience) return game.targetAudience === m.audience; if (m.channel) return plats.includes(m.channel); if (m.third) return plats.some(p => !OWN_CH.includes(p)); return false; }
  function hasPR(s) { return s.dept === 3; }
  function sanctionMult(co) { return co.hasResearch('PublicidadSanitaria') ? 0.25 : 1; }

  /* ---------- recálculo semanal de variables agregadas ---------- */
  function recompute(co, s, w) {
    s.brandCap = computeCap(s); s.brand = U.clamp(s.brand, 0, s.brandCap);
    let optIn = K.OPT_IN_BASE; for (const a of s.active) { const f = CAMP[a.id].fx; if (f.optIn) optIn += f.optIn; }
    if (s.dept === 3) optIn += 10; for (const e of s.effects) if (e.type === 'optin') optIn += e.val;
    s.optIn = U.clamp(Math.round(optIn), 0, 100); const oi = s.optIn / 100; const eff = efficiency(co, s);
    let traffic = 0, patients = 0, retention = K.RETENTION_BASE;
    for (const a of s.active) {
      const c = CAMP[a.id], f = c.fx; const sc = f.scaleOptIn ? oi : 1; let mult = eff;
      if (c.id === 'google_ads_local') mult *= s.dept === 0 ? 0.8 : s.dept === 3 ? 1.3 : 1;
      if (f.trafficPerm) traffic += f.trafficPerm * sc * (c.type === 'setup' ? 1 : mult);
      if (f.patientsPerm) patients += f.patientsPerm * sc * (c.type === 'setup' ? 1 : mult);
      if (f.retention) retention += f.retention * sc;
    }
    traffic += s.seoTraffic; if (s.dept === 3) { traffic += 0.04; retention += 5; }
    if (s.planVeo) patients += 0.03;
    for (const e of s.effects) { if (e.type === 'traffic') traffic += e.pct; else if (e.type === 'patients') patients += e.pct; else if (e.type === 'retention') retention += e.val; }
    s.traffic = Math.round(U.clamp(traffic, K.TRAFFIC_MIN, K.TRAFFIC_CAP) * 1000) / 1000;
    s.patients = Math.round(U.clamp(patients, 0, K.PATIENTS_CAP) * 1000) / 1000;
    s.retention = Math.round(U.clamp(retention, 0, K.RETENTION_MAX));
    s.visitsMonth = visitsMonth(co, s);
  }

  /* ---------- expectación semanal de las campañas always-on y sincronización con las del núcleo ---------- */
  function weeklyHype(co, s) {
    const g = co.currentGame; if (!g || g.state !== 'dev') return;
    if (s.hypeGiven.gid !== g.id) s.hypeGiven = { gid: g.id, by: {} };
    const eff = efficiency(co, s); const hf = 1 + s.brand / 200;
    for (const a of s.active) {
      const c = CAMP[a.id], f = c.fx; if (!f.hypeWeekly) continue; let v = f.hypeWeekly * eff;
      if (c.id === 'cm_externo' && s.dept === 2) v *= 1.2; if (c.id === 'contenido_video' && s.dept === 3) v *= 1.3; if (f.youngBonus && g.targetAudience === 'young') v *= f.youngBonus;
      const given = s.hypeGiven.by[c.id] || 0; v = Math.min(v, f.hypeCap - given); if (v <= 0) continue; v = Math.floor(v * hf); if (v <= 0) continue; g.hypePoints += v; s.hypeGiven.by[c.id] = given + v;
    }
  }
  function syncCore(co, s) {
    const g = co.currentGame; if (!g) return; if (s.coreSeen.gid !== g.id) s.coreSeen = { gid: g.id, by: {} };
    const counts = {}; for (const f of g.featureLog) if (f.type === 'marketing') counts[f.id] = (counts[f.id] || 0) + 1;
    for (const id in counts) { const prev = s.coreSeen.by[id] || 0; if (counts[id] > prev) { const c = CAMP[id]; const mk = DATA.MARKETING.find(x => x.id === id); for (let i = prev; i < counts[id]; i++) { if (c) addBrand(s, c.fx.brand); if (mk) { s.spendYTD += mk.cost; s.spendMonth += mk.cost; } } s.coreSeen.by[id] = counts[id]; } }
  }

  /* ---------- lanzamiento de campañas ---------- */
  function canLaunch(co, s, c) {
    if (c.type === 'lanzamiento') { if (!co.currentGame) return 'Solo durante el desarrollo de una colección'; const r = c.req(co, s); if (r) return r; return co.cash >= c.cost ? null : 'No hay dinero suficiente'; }
    const r = c.req(co, s); if (r) return r;
    if (c.type !== 'puntual' && c.type !== 'promo' && c.type !== 'estudio' && c.type !== 'temporada' && isActive(s, c.id)) return 'Ya está activa';
    if (c.type === 'setup' && (s.flags['done_' + c.id] && c.id !== 'convenio_aseguradoras' && c.id !== 'programa_fabricante')) return 'Ya lo tienes';
    if ((c.type === 'puntual' || c.type === 'temporada' || c.type === 'promo') && isActive(s, c.id)) return 'Ya está en marcha';
    if (c.type !== 'setup' && c.type !== 'estudio' && c.type !== 'promo' && usedSlots(s) >= slots(co, s)) return 'Sin capacidad: ' + usedSlots(s) + '/' + slots(co, s) + ' acciones en marcha (amplía el departamento o asigna personal)';
    const cost = costOf(co, s, c); if (co.cash < cost) return 'No hay dinero suficiente (' + U.money(cost) + ')';
    return null;
  }
  function launch(co, id) {
    const s = S(co); const c = CAMP[id]; if (!c) return { ok: false, msg: 'Campaña desconocida' };
    const why = canLaunch(co, s, c); if (why) return { ok: false, msg: why };
    const w = week(co);
    if (c.type === 'lanzamiento') { const mk = DATA.MARKETING.find(x => x.id === id); if (!mk || !G.applyMarketing(mk)) return { ok: false, msg: 'No se pudo contratar la campaña' }; syncCore(co, s); return { ok: true, msg: c.name + ' contratada' }; }
    const cost = costOf(co, s, c); const rep = (c.type === 'puntual' || c.type === 'promo' || c.type === 'temporada') ? repFactor(s, id, w) : 1; const eff = efficiency(co, s); const mult = eff * rep;
    // riesgos legales
    if (c.cat === 'crm' && !s.flags.rgpd && c.type !== 'setup' && U.rnd() < 0.10) breachEvent(co, s, w);
    if (c.type === 'promo') { s.promoUses = s.promoUses.filter(x => x > w - 48); if (s.promoUses.length >= 3 && U.rnd() < 0.05 * sanctionMult(co)) sanctionEvent(co, s, w); s.promoUses.push(w); }
    spend(co, s, cost, c.name); s.history.push({ id, w }); if (s.history.length > 300) s.history.shift();
    const until = c.weeks ? w + c.weeks : 0;
    if (c.type !== 'estudio' && c.type !== 'promo') s.active.push({ id, start: w, until, fee: feeOf(co, s, c) });
    if (c.type === 'promo') s.active.push({ id, start: w, until, fee: 0 });
    if (c.type === 'setup') s.flags['done_' + id] = true;
    applyFx(co, s, c, mult, w);
    recompute(co, s, w);
    G.log(`Marketing: ${c.name}${cost ? ' (' + U.money(cost) + ')' : ''}${rep < 1 ? ' · efecto ×' + rep + ' por repetición' : ''}.`);
    return { ok: true, msg: c.name + (rep < 1 ? ' lanzada (rinde ×' + rep + ' por repetirla)' : ' lanzada') };
  }
  function applyFx(co, s, c, mult, w) {
    const f = c.fx; const g = co.currentGame; const d = U.dateFromWeek(w);
    let hype = f.hype || 0; let fansMult = 1; let unitsMult = 1; let patientsMult = 1;
    if (c.id === 'revision_colegios') { if (d.month === 9) fansMult *= 1.5; if (s.planVeo) fansMult *= 1.3; }
    if (c.id === 'campana_control_miopia' && co.hasResearch('Lentillas')) { unitsMult *= 1.5; patientsMult *= 1.5; }
    if (c.id === 'campana_progresivos' && (co.researchCompleted.includes('progresivos') || co.researchCompleted.includes('freeform'))) unitsMult *= 1.3;
    if (c.id === 'campana_audiologia') { s.audioUntil = w + 8; if (d.month === 3 && d.week === 1) patientsMult *= 1.5; }
    if (f.genreBonus && g) for (const gid in f.genreBonus) if (genreIs(g, gid)) hype *= f.genreBonus[gid];
    if (f.youngBonus && g && g.targetAudience === 'young') hype *= f.youngBonus;
    if (c.id === 'newsletter_lanzamiento') hype = (4 * Math.min(1, co.fans / 50000) + 2) * s.optIn / 100 * 2;
    if (hype && g && g.state === 'dev') { const prog = Math.abs(G.getGameProgress() - 0.7); const k = Math.max(0, Math.floor(hype * mult * (1 - prog / 2) * (1 + s.brand / 200))); if (k > 0) { g.hypePoints += k; G.log(`${c.name}: +${k} de expectación para ${g.title}.`); } }
    if (f.traffic) { let pct = f.traffic * mult; let wk = f.trafficWeeks || 4; if (c.id === 'escaparate_pro' && (d.month === 5 || d.month === 6)) pct = 0.10 * mult; addEffect(s, { type: 'traffic', pct: Math.round(pct * 1000) / 1000, until: w + wk, src: c.id }); }
    if (f.brand) addBrand(s, f.brand * (f.brand > 0 ? mult : 1));
    if (f.fans || f.fansPct) { const n = Math.floor(((f.fans || 0) + co.fans * (f.fansPct || 0)) * mult * fansMult); if (n) co.adjustFans(n); }
    if (f.stars) s.stars = U.clamp(s.stars + f.stars, K.STARS_MIN, 5);
    if (f.retentionTemp) addEffect(s, { type: 'retention', val: f.retentionTemp, until: w + (f.retentionWeeks || 12), src: c.id });
    if (f.patients) addEffect(s, { type: 'patients', pct: Math.round(f.patients * mult * patientsMult * 1000) / 1000, until: w + (f.patientsWeeks || 8), src: c.id });
    if (f.units) for (const m of f.units) addEffect(s, Object.assign({ type: 'units', pct: Math.round(m.pct * unitsMult * 100) / 100, until: w + (f.unitsWeeks || 4), src: c.id }, m));
    if (f.reach) s.reachMonth += Math.round(f.reach * mult);
    // creadores/famosos con una colección que es producto sanitario (graduado, infantil, lectura): riesgo de denuncia (EVT_MKT_01)
    if ((c.id === 'influencers_micro' || c.id === 'seeding_producto' || c.id === 'embajador_marca') && g && (genreIs(g, 'graduado') || genreIs(g, 'infantil') || genreIs(g, 'lectura'))) s.flags.claimRiskUntil = w + 24;
    switch (f.special) {
      case 'gmb': s.flags.gmb = true; break;
      case 'rgpd': s.flags.rgpd = true; break;
      case 'branding': s.flags.branding = true; s.brandCap = computeCap(s); notify('Marca registrada', `Ya tenemos la marca registrada y una identidad visual propia. El tope de notoriedad sube a ${s.brandCap}.`); break;
      case 'seeding': s.seedingUntil = w + 24; break;
      case 'escaparate': if (g && g.state === 'dev') g.flags.mkEscaparate = true; break;
      case 'packaging': if (g && g.state === 'dev') g.flags.mkPackaging = true; break;
      case 'plv': if (g && g.state === 'dev') g.flags.mkPLV = true; break;
      case 'informe': informeTendencias(co, s, w); break;
      case 'promo': for (const gg of co.gameLog) { if (gg.soldOut || !gg.totalSalesCash) continue; const rem = gg.totalSalesCash - gg.currentSalesCash; if (rem > 0) gg.totalSalesCash += rem * 0.04; } notify('Promoción 2×1', 'Arranca la promoción: más monturas vendidas durante 4 semanas, pero con un 20 % menos de precio. La notoriedad de marca se resiente un poco (guerra de precios).', 'news'); break;
    }
  }
  function informeTendencias(co, s, w) {
    const t = co.flags.trends && co.flags.trends.currentTrend; const left = co.flags.trends ? Math.max(0, Math.round((co.flags.trends.expireBy - G.gameTime) / WEEK_MS)) : 0;
    const plats = Platforms.onMarket(w).map(p => ({ p, sh: Platforms.sharePercent(p, w) })).sort((a, b) => b.sh - a.sh).slice(0, 3);
    const txt = (t ? `Tendencia vigente: ${t.label}. Se espera que dure unas ${left} semanas más.` : `No hay ninguna tendencia clara en el mercado; la situación podría cambiar en unas ${left} semanas.`) + `\nCanales con más cuota ahora mismo: ${plats.map(x => `${x.p.name} (${x.sh.toFixed(0)} %)`).join(', ')}.` + `\nNuestra notoriedad es ${brandTier(s.brand)} (${Math.round(s.brand)}/100) y los clientes nos puntúan con ${s.stars.toFixed(1)} estrellas.`;
    s.lastInforme = { w, text: txt }; notify('Informe de tendencias', txt);
  }
  function cancel(co, id) {
    const s = S(co); const a = activeOf(s, id); if (!a) return { ok: false, msg: 'No está activa' }; const c = CAMP[id];
    if (c.type === 'puntual' || c.type === 'promo') return { ok: false, msg: 'Las acciones puntuales terminan solas' };
    endCampaign(co, s, a); recompute(co, s, week(co)); return { ok: true, msg: c.name + ' cancelada' };
  }
  function endCampaign(co, s, a) { s.active = s.active.filter(x => x !== a); const c = CAMP[a.id]; if (!c) return; if (c.id === 'seo_local') s.seoTraffic = 0; if (c.id === 'convenio_aseguradoras' || c.id === 'programa_fabricante' || c.id === 'consentimiento_rgpd') s.flags['done_' + c.id] = false; if (c.id === 'consentimiento_rgpd') s.flags.rgpd = false; }

  /* ---------- departamento y enseña ---------- */
  function setDept(co, lvl) {
    const s = S(co); lvl = U.clamp(Math.floor(lvl), 0, 3); if (lvl === s.dept) return { ok: false, msg: 'Ya tienes ese nivel' };
    if (lvl > s.dept) { const d = DEPT[lvl]; const r = d.req(co); if (r) return { ok: false, msg: r }; const setup = d.cost; if (co.cash < setup) return { ok: false, msg: 'No hay dinero para la primera mensualidad (' + U.money(setup) + ')' }; spend(co, s, setup, 'Marketing: ' + d.name); s.dept = lvl; G.log(`Marketing pasa a «${d.name}» (${U.money(deptCost(co, s))}/mes).`); return { ok: true, msg: 'Departamento ampliado: ' + d.name }; }
    const sev = Math.round(DEPT[s.dept].cost); if (co.cash < sev) return { ok: false, msg: 'La indemnización cuesta ' + U.money(sev) }; spend(co, s, sev, 'Marketing: reducción de plantilla'); s.dept = lvl; G.log(`Marketing reducido a «${DEPT[lvl].name}».`); return { ok: true, msg: 'Departamento reducido' };
  }
  function setGroup(co, g) {
    const s = S(co); const w = week(co); if (g === s.group) return { ok: false, msg: 'Ya estás en esa enseña' }; if (co.level < 2) return { ok: false, msg: 'Decide la enseña cuando tengas local comercial (nivel 2)' };
    // salida de la enseña actual
    if (s.group === 'franquicia') { if (co.cash < K.FRANQ_EXIT) return { ok: false, msg: 'Rescindir la franquicia cuesta ' + U.money(K.FRANQ_EXIT) }; spend(co, s, K.FRANQ_EXIT, 'Rescisión de franquicia'); s.brand = Math.max(0, s.brand - 30); }
    if (s.group === 'cooperativa') s.brand = Math.max(0, s.brand - 15);
    if (g === 'cooperativa') { if (co.cash < K.COOP_ENTRY) return { ok: false, msg: 'La aportación inicial es ' + U.money(K.COOP_ENTRY) }; spend(co, s, K.COOP_ENTRY, 'Aportación a la cooperativa'); s.group = g; s.groupSince = w; addBrand(s, 15); notify('Cooperativa', `Nos unimos a una cooperativa de ópticos con rótulo compartido. Su publicidad en televisión nos presta notoriedad (+15, tope 60), +5 de expectación por colección y sus rappels rebajan un 8 % los costes de canal; a cambio pagamos ${U.money(K.COOP_FEE)} al mes, rotulamos con su marca y nos comprometemos a comprar un cupo anual de sus colecciones.`); }
    else if (g === 'franquicia') { if (s.flags.branding) return { ok: false, msg: 'Ya tienes marca propia registrada: una cadena no te dejaría usarla' }; const entry = K.FRANQ_ENTRY * 0.5; if (co.cash < entry) return { ok: false, msg: 'El canon de entrada (financiado al 50 %) es ' + U.money(entry) }; spend(co, s, entry, 'Canon de franquicia'); s.group = g; s.groupSince = w; addBrand(s, 30); notify('Franquicia', `Firmamos con una gran cadena: su televisión nacional y sus ofertas de volumen nos dan +30 de notoriedad (tope 40) y +12 de expectación por colección, pero pagamos un 8 % de royalties y fondo de publicidad sobre las ventas en tienda, la central decide precios, escaparate y surtido, no podemos registrar marca propia y nuestras colecciones solo en tienda venden un 30 % menos. La cadena financia la mitad del canon.`); }
    else { s.group = null; s.groupSince = w; notify('Independientes', 'Volvemos a competir con nuestra propia enseña. La notoriedad prestada por el grupo desaparece.'); }
    s.brandCap = computeCap(s); s.brand = Math.min(s.brand, s.brandCap); recompute(co, s, w); return { ok: true, msg: 'Enseña actualizada' };
  }
  function bookFair(co, fair, idx) {
    const s = S(co); const F = FAIRS[fair]; const o = F && F.opts[idx]; if (!o) return { ok: false, msg: 'Opción no válida' }; const d = co.getCurrentDate();
    const r = any(R.res(co, 'FeriasInternacionales'), R.branding(s)); if (r) return { ok: false, msg: r }; if (d.month !== F.bookMonth) return { ok: false, msg: 'Solo se reserva en el mes ' + F.bookMonth };
    if (s.fair[fair] !== null && s.fair[fair] !== undefined) return { ok: false, msg: 'Ya tenemos stand reservado' }; if (co.cash < o.cost) return { ok: false, msg: 'No hay dinero suficiente' };
    spend(co, s, o.cost, 'Stand ' + F.name); s.fair[fair] = idx; return { ok: true, msg: `${o.name} reservado en ${F.name}` };
  }
  function runFair(co, s, fair, w, d) {
    const F = FAIRS[fair]; const idx = s.fair[fair]; const o = F.opts[idx]; s.fair[fair] = null; if (!o) return;
    const total = F.base + F.perYear * d.year; const fansF = U.clamp(co.fans / 5e5, 0, 1); const c = Math.floor(total * (0.004 + 0.25 * o.factor * (0.6 + 0.4 * fansF))); const p = c / total;
    const hype = Math.floor(F.hypeMin + (F.hypeMax - F.hypeMin) * Math.min(1, p / 0.4)); if (co.currentGame) co.currentGame.hypePoints += hype; else co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + hype;
    const fans = Math.floor(c * 0.08); co.adjustFans(fans); addBrand(s, o.brand); let extra = '';
    if (fair === 'mido') { addEffect(s, { type: 'units', third: true, pct: 0.10, until: w + 24, src: 'mido' }); extra = '\nVarias cadenas extranjeras se interesan por la marca: +10 % de unidades en canales de terceros durante 24 semanas.'; }
    else { addEffect(s, { type: 'units', genre: 'premium', pct: 0.15, until: w + 8, src: 'silmo' }); const dor = co.gameLog.find(g => genreIs(g, 'premium') && g.score >= 9 && g.releaseWeek > w - 48); if (dor) { const h2 = 40; if (co.currentGame) co.currentGame.hypePoints += h2; else co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + h2; co.adjustFans(Math.floor(co.fans * 0.03)); extra = `\n¡${dor.title} gana una mención Prisma de diseño! +40 de expectación y +3 % de clientes fieles.`; } else extra = '\nLas colecciones Premium venden un 15 % más durante 8 semanas.'; }
    notify(F.name, `Han pasado por nuestro stand (${o.name.toLowerCase()}) ${U.num(c)} profesionales de ${U.num(total)}. Expectación +${hype}, ${U.num(fans)} clientes fieles nuevos y +${o.brand} de notoriedad.${extra}`);
  }

  /* ---------- eventos ---------- */
  function fireOnce(s, key) { if (s.fired[key]) return false; s.fired[key] = true; return true; }
  function sanctionEvent(co, s, w) {
    const dmg = hasPR(s) ? 0.5 : 1; const second = s.sanctions.some(x => x > w - 96); s.sanctions.push(w); const fine = Math.round(6000 * dmg); spend(co, s, fine, 'Sanción por publicidad');
    addBrand(s, -(second ? 4 : 2) * dmg); s.stars = U.clamp(s.stars - 0.1 * dmg, K.STARS_MIN, 5);
    notify('Inspección de Consumo', `Nos sancionan por publicidad engañosa: promociones «2×1» encadenadas cuyo precio de referencia no era el más bajo de los últimos 30 días. Multa de ${U.money(fine)}, −${second ? 4 : 2} de notoriedad y −0,1 estrellas.${second ? ' Al ser reincidentes, el Colegio abre expediente deontológico (art. 4.5.2).' : ''}${hasPR(s) ? ' Nuestro equipo de prensa ha reducido el daño a la mitad.' : ''}`);
  }
  function breachEvent(co, s, w) {
    const fine = 5000 + Math.floor(U.rnd() * 15000); spend(co, s, fine, 'Multa AEPD'); addEffect(s, { type: 'optin', val: -30, until: w + 48, src: 'brecha' }); s.stars = U.clamp(s.stars - 0.2, K.STARS_MIN, 5); addBrand(s, -2);
    notify('Denuncia ante la AEPD', `Un paciente denuncia que usamos su historia clínica para enviarle publicidad sin consentimiento (RGPD art. 9, LSSI art. 21). Multa de ${U.money(fine)}, −30 de opt-in durante un año, −0,2 estrellas y −2 de notoriedad. Investiga «CRM y fidelización» y activa el consentimiento RGPD.`);
  }
  function calendar(co, s, w, d) {
    const Y = d.year;
    // Plan Mirada Escolar (programa público ficticio, inspirado en las ayudas reales de 2025): noticia con decisión en 25/10/1 y prórroga en 26/11/1
    if ((w === U.gameWeek('25/10/1') || w === U.gameWeek('26/11/1'))) { const pro = w === U.gameWeek('26/11/1'); notify(pro ? 'Prórroga del Plan Mirada Escolar' : 'Plan Mirada Escolar', (pro ? 'La Xunta prorroga un año más el Plan Mirada Escolar. ' : 'La Consellería de Sanidade lanza el Plan Mirada Escolar: hasta 100 € en gafas o lentillas para menores de 16 años. La óptica adherida descuenta el importe en caja y el Consejo de Colegios se lo liquida a mes vencido. ') + `Para adherirnos hay que estar inscritos en el registro de centros sanitarios, tener un óptico-optometrista colegiado, una colección Infantil en catálogo y respetar el baremo del convenio (alta y cartelería oficial: ${U.money(K.PLAN_VEO_COST)}). ¿Nos adherimos?`, 'decision', { sourceId: 'marketing:plan_veo', options: ['Adherirse (' + U.money(K.PLAN_VEO_COST) + ')', 'No, gracias'] }); }
    if (s.planVeo && w >= s.planVeoUntil) { s.planVeo = false; notify('Fin del Plan Mirada Escolar', 'Se agota el presupuesto del Plan Mirada Escolar: termina el impulso de las gafas infantiles subvencionadas.', 'news'); }
    if (s.flags.veoPenaltyUntil && w >= s.flags.veoPenaltyUntil) s.flags.veoPenaltyUntil = 0;
    // Enseña: noticia 2/9/1 (o cuando se alcance el nivel 2 después)
    if (!s.flags.ensenaOffered && co.level >= 2 && w >= U.gameWeek('2/9/1')) { s.flags.ensenaOffered = true; notify('¿Bajo qué marca compites?', 'Nos llaman tres modelos de grupo. Un grupo de compra abierto (90-220 €/mes) centraliza las compras con rappels del 38-52 % en lentes y nos deja nuestro nombre. Una cooperativa con rótulo compartido pide una aportación de 3.000-15.000 € y 300-650 €/mes, impone su imagen y un cupo de compra y a cambio anuncia la enseña en televisión. Una franquicia de gran cadena cobra 15.000-30.000 € de canon y un 7-11 % de las ventas en royalties, decide precios y escaparate y llena la tienda con ofertas agresivas a costa del margen. Puedes decidirlo en cualquier momento desde el panel de marketing.', 'decision', { sourceId: 'marketing:ensena', options: ['Ver opciones', 'Seguir independientes por ahora'] }); }
    // Franquicia low-cost al lado (9/4/1)
    if (!s.flags.lowcostDone && co.level >= 2 && w >= U.gameWeek('9/4/1')) { s.flags.lowcostDone = true; notify('Competencia', 'Una cadena low-cost abre dos portales más abajo con «2 gafas graduadas por 49 €». Podemos diferenciarnos por arriba (gabinete, audiología y colecciones propias), aguantar sin cambiar nada o entrar en la guerra de precios, que mantiene las visitas pero hunde el margen.', 'decision', { sourceId: 'marketing:competidor_lowcost', options: ['Diferenciarnos: campaña de servicios clínicos y colecciones propias (10.000 €)', 'Aguantar', 'Guerra de precios: 2×1 en todo'] }); }
    // Calendario sanitario y comercial
    if (co.realYear() >= 2000 && d.month === 10 && d.week === 2 && !R.gab(co) && fireOnce(s, 'vision' + Y)) notify('Día Mundial de la Visión', 'El segundo jueves de octubre es el Día Mundial de la Visión. El Colegio y las ONG de salud visual animan a las ópticas a organizar jornadas de revisiones gratuitas, sin obligar a comprar nada. ¿Montamos la nuestra?', 'decision', { sourceId: 'marketing:dia_vision', options: ['Jornada de revisiones (600 €)', 'Este año no'] });
    if (d.month === 3 && d.week === 2 && co.hasResearch('Retinografo') && fireOnce(s, 'glaucoma' + Y)) notify('Semana Mundial del Glaucoma', 'En marzo se celebra la Semana Mundial del Glaucoma. Podemos ofrecer a los mayores de 40 una toma de presión intraocular con tonómetro de aire y una retinografía, dejando claro que es un cribado optométrico: el diagnóstico corresponde al oftalmólogo, al que derivaremos los casos sospechosos.', 'decision', { sourceId: 'marketing:dia_glaucoma', options: ['Cribado gratuito (400 €)', 'No'] });
    if (d.month === 11 && d.week === 2 && co.hasResearch('Retinografo') && fireOnce(s, 'diabetes' + Y)) notify('Día Mundial de la Diabetes', 'El 14 de noviembre es el Día Mundial de la Diabetes: un cribado de fondo de ojo con el retinógrafo, con el informe validado por un oftalmólogo, nos daría visibilidad y derivaciones de los centros de salud.', 'decision', { sourceId: 'marketing:dia_diabetes', options: ['Cribado de retina (450 €)', 'No'] });
    if (d.month === 3 && d.week === 1 && !R.audio(co) && fireOnce(s, 'audicion' + Y)) notify('Día Mundial de la Audición', 'El 3 de marzo es el Día Mundial de la Audición. ¿Organizamos revisiones auditivas gratuitas en la cabina, sin compromiso de compra?', 'decision', { sourceId: 'marketing:dia_audicion', options: ['Cribado auditivo (600 €)', 'No'] });
    if (d.month === 9 && d.week === 1 && fireOnce(s, 'cole' + Y)) { const local = s.active.some(a => CAMP[a.id].cat === 'local' || CAMP[a.id].cat === 'clinico'); if (local) { addEffect(s, { type: 'units', genre: 'infantil', pct: 0.20, until: w + 6, src: 'vuelta_cole' }); notify('Vuelta al cole', 'Septiembre: las familias renuevan las gafas de los niños. Gracias a nuestras acciones locales, las colecciones Infantil venderán un 20 % más durante 6 semanas.', 'news'); } else if (Y <= 3) notify('Vuelta al cole', 'Septiembre: las familias renuevan las gafas de los niños. Con alguna acción local activa (buzoneo, prensa, cribado en colegios) aprovecharíamos el tirón del tipo Infantil.', 'news'); }
    if (d.month === 5 && d.week === 1 && fireOnce(s, 'sol' + Y)) { addEffect(s, { type: 'units', genre: 'sol', pct: 0.15, until: w + 8, src: 'temporada_sol' }); if (Y <= 2) notify('Temporada de sol', 'Llega el buen tiempo: las gafas de sol se venden un 15 % más hasta finales de junio. Un escaparate de temporada rinde más estas semanas.', 'news'); }
    if (d.month === 12 && d.week === 1 && co.level >= 2 && fireOnce(s, 'navidad' + Y)) notify('Campaña de Navidad', 'Las gafas de sol y las de lujo son regalo estrella, y muchos clientes agotan antes del 31 de diciembre el reembolso anual de su seguro de salud. ¿Montamos escaparate navideño y tarjetas regalo?', 'decision', { sourceId: 'marketing:navidad', options: ['Escaparate navideño (1.200 €)', 'No'] });
    if (d.month === 11 && d.week === 4 && co.level >= 2 && co.isLaterOrEqualThan(18, 1) && co.gameLog.some(g => !g.soldOut) && fireOnce(s, 'bf' + Y)) notify('Black Friday', 'Toda la calle anuncia descuentos. ¿Entramos con un 2×1 —anunciando como precio anterior el más bajo de los últimos 30 días, como exige la ley de comercio minorista— o mantenemos el precio y la imagen de marca?', 'decision', { sourceId: 'marketing:rebajas', options: ['Promoción 2×1', 'Mantener el precio'] });
    if (((d.month === 1 && d.week === 2) || (d.month === 7 && d.week === 1)) && co.level >= 2 && co.gameLog.some(g => !g.soldOut && Math.floor(co.currentWeek) - g.releaseWeek >= 4) && fireOnce(s, 'rebajas' + Y + '-' + d.month)) notify('Rebajas', 'Empiezan las rebajas: solo pueden rebajarse artículos que llevan al menos un mes a la venta, con el precio anterior a la vista. ¿Promoción 2×1 en las colecciones a la venta o mantenemos precio?', 'decision', { sourceId: 'marketing:rebajas', options: ['Promoción 2×1', 'Mantener el precio'] });
    if (co.realYear() >= 2008 && d.month === 6 && d.week === 3 && fireOnce(s, 'noche' + Y)) notify('Noche del comercio local', 'El ayuntamiento organiza la Noche del Comercio: tiendas abiertas hasta medianoche, música y sorteos. Participar cuesta 500 €.', 'decision', { sourceId: 'marketing:noche_comercio', options: ['Participar (500 €)', 'No'] });
    // Ferias
    if (d.month === FAIRS.mido.bookMonth && d.week === 1 && co.hasResearch('FeriasInternacionales') && s.flags.branding && s.fair.mido == null && fireOnce(s, 'mido' + Y)) notify('Milano Eyewear', `En febrero se celebra en Milán Milano Eyewear, la mayor feria internacional de óptica (más de 1.200 expositores). ¿Reservamos un stand de 32 m² (${U.money(FAIRS.mido.opts[1].cost)})? Otros tamaños, en el panel de marketing durante enero.`, 'decision', { sourceId: 'marketing:mido', options: ['Stand de 32 m²', 'Este año no'] });
    if (d.month === FAIRS.silmo.bookMonth && d.week === 1 && co.hasResearch('FeriasInternacionales') && s.flags.branding && s.fair.silmo == null && fireOnce(s, 'silmo' + Y)) notify('Salón Prisma', `A finales de septiembre se celebra en París Salón Prisma, la feria internacional de óptica y moda. ¿Reservamos un stand de 24 m² (${U.money(FAIRS.silmo.opts[1].cost)})? Otros tamaños, en el panel de marketing durante agosto.`, 'decision', { sourceId: 'marketing:silmo', options: ['Stand de 24 m²', 'Este año no'] });
    if (d.month === FAIRS.mido.runMonth && d.week === FAIRS.mido.runWeek && s.fair.mido != null) runFair(co, s, 'mido', w, d);
    if (d.month === FAIRS.silmo.runMonth && d.week === FAIRS.silmo.runWeek && s.fair.silmo != null) runFair(co, s, 'silmo', w, d);
    if (d.month === 6 && d.week === 2 && co.conferenceStandFactor) { const b = co.conferenceStandFactor >= 1.3 ? 10 : co.conferenceStandFactor >= 0.5 ? 5 : 2; addBrand(s, b); G.log(`IberÓptica: +${b} de notoriedad por el stand.`); }
    // Premios del sector (el núcleo los concede en la semana 1 de enero): +5 notoriedad
    if (d.month === 1 && d.week === 2 && co.awards.some(a => a.year === Y - 1) && fireOnce(s, 'premio' + Y)) { addBrand(s, 5); G.log('El premio a la mejor colección del año da +5 de notoriedad.'); }
  }
  function randomEvents(co, s, w, d) {
    const Y = d.year; const roll = U.rnd(); let acc = 0; const hit = p => { acc += p; return roll < acc; };
    if (s.group !== 'franquicia' && co.realYear() >= 2009 && hit(0.03)) return notify('Bono comercio', 'El ayuntamiento lanza los bonos de consumo para el comercio local: paga el 20-30 % del ticket durante un mes. Adherirse cuesta 200 € de gestión.', 'decision', { sourceId: 'marketing:bono_comercio', options: ['Adherirse (200 €)', 'No'] });
    const last = co.gameLog[co.gameLog.length - 1];
    if (co.gameLog.length >= 4 && (s.stars < 4.3 || (last && last.score < 5)) && hit(0.02)) return notify('Reseña viral', 'Una clienta ha publicado un vídeo furioso sobre unas gafas mal montadas y su reseña ya lleva miles de visualizaciones. Podemos responder con educación —sin revelar jamás datos clínicos, que son secreto profesional— y citarla en privado con el director técnico para rehacer las gafas, dejarlo pasar o contestar enseñando su graduación para demostrar que no tiene razón.', 'decision', { sourceId: 'marketing:resena_viral', options: ['Responder con educación y rehacer las gafas (600 €)', 'Ignorar', 'Publicar su graduación para rebatirla'] });
    if (co.level >= 2 && Y >= 5 && hit(0.01)) return notify('Cierra la óptica del barrio vecino', 'La óptica histórica del barrio de al lado cierra por jubilación tras 30 años. Su titular nos ofrece la cartera de pacientes (cesión legal en el traspaso, informando a cada paciente) junto con su biseladora y su campímetro por 18.000 €. También podemos limitarnos a un buzoneo de bienvenida en su zona.', 'decision', { sourceId: 'marketing:cierre_competidor', options: ['Buzoneo de bienvenida (1.200 €)', 'Nada', 'Comprar cartera y equipos (18.000 €)'] });
    if (co.level >= 2 && hit(0.01)) return notify('Obras en la calle', 'El ayuntamiento levanta la calle durante tres meses: vallas, ruido y aceras cortadas. ¿Lanzamos la campaña «Seguimos abiertos» (1.000 €) para limitar el daño?', 'decision', { sourceId: 'marketing:obras', options: ['Seguimos abiertos (1.000 €)', 'Aguantar'] });
    if (s.brand >= 20 && co.isLaterOrEqualThan(15, 1) && hit(0.015 * (s.seedingUntil > w ? 3 : 1))) return notify('Un creador con 1 M de seguidores', 'Un creador de contenido con un millón de seguidores ha subido un vídeo luciendo nuestras gafas y no para de etiquetarnos. ¿Le proponemos ser embajador de gafas de sol y monturas durante un año? Como imagen de moda es legal; que recomiende nuestras lentillas o cristales graduados, no: son productos sanitarios.', 'decision', { sourceId: 'marketing:creador_viral', options: ['Embajador de sol y monturas (40.000 €)', 'Agradecérselo', 'Pedirle que recomiende también nuestras lentillas'] });
    if (s.brand >= 30 && hit(0.02)) { const g = co.currentGame; const h = 20; if (g) g.hypePoints += h; else co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + h; co.adjustFans(Math.floor(co.fans * 0.01)); addBrand(s, 3); return notify('Matinal de TV', `Nos invitan al programa matinal de la televisión autonómica a hablar de salud visual. Gratis: +${h} de expectación, +1 % de clientes fieles y +3 de notoriedad.`, 'news'); }
    if (co.isLaterOrEqualThan(10, 1) && s.flags.gmb && hit(0.01)) { if (isActive(s, 'seo_local') || s.dept === 3) return notify('El buscador cambia su algoritmo', 'El buscador ha cambiado el algoritmo de búsquedas locales. Gracias al posicionamiento local no nos afecta.', 'news'); addEffect(s, { type: 'traffic', pct: -0.05, until: w + 12, src: 'algoritmo' }); return notify('El buscador cambia su algoritmo', 'El buscador ha cambiado el algoritmo local y nuestra ficha pierde posiciones: −5 % de visitas durante tres meses. Una agencia de posicionamiento nos habría protegido.', 'news'); }
    // EVT_MKT_01: denuncia por publicidad sanitaria (creadores o famosos con productos sanitarios); el protocolo legal la reduce a la cuarta parte
    if (s.flags.claimRiskUntil > w && hit(0.08 * sanctionMult(co))) { s.flags.claimRiskUntil = 0; return notify('Denuncia por publicidad sanitaria', 'El Colegio de Ópticos-Optometristas ha trasladado a Sanidad una denuncia contra nuestra campaña con creadores de contenido: usa la notoriedad de personas famosas para recomendar un producto sanitario y le atribuye beneficios que no recoge su marcado CE. La sanción puede ir de 3.005 a 30.000 €. ¿Retiramos y rectificamos, o recurrimos?', 'decision', { sourceId: 'marketing:denuncia_publicidad', options: ['Retirar, rectificar y revisión legal (600 €)', 'Recurrir y mantener la campaña'] }); }
    // EVT_MKT_02: reclamación ante la AEPD por recitaciones sin consentimiento comercial separado
    if ((isActive(s, 'crm_recordatorios') || isActive(s, 'cumpleanos_estacional')) && (!s.flags.rgpd || s.optIn < 40) && hit(0.025)) return notify('Reclamación ante la AEPD', 'Un paciente ha reclamado ante la Agencia de Protección de Datos por un SMS promocional que le enviamos usando su ficha clínica, sin haber firmado el consentimiento comercial. Podemos auditar la base de datos y separar los consentimientos (suele acabar en apercibimiento) o alegar y seguir enviando igual (multa de 5.000 a 12.000 €).', 'decision', { sourceId: 'marketing:reclamacion_aepd', options: ['Auditar la base y separar el consentimiento (900 €)', 'Alegar y seguir enviando igual'] });
  }

  /* ---------- decisiones ---------- */
  function onDecision(co, sourceId, choice) {
    if (!sourceId || sourceId.indexOf('marketing:') !== 0) return; const s = S(co); const w = week(co); const id = sourceId.replace('marketing:', ''); const yes = choice === 0;
    const pay = (amount, label) => { if (!G.canSpend(amount)) { G.log(`Marketing: no hay caja para «${label}» (${U.money(amount)}); seguimos sin gastar.`); if (typeof UI !== 'undefined' && UI.toast) UI.toast(`Sin caja para ${label}: no se hace`); return false; } spend(co, s, amount, label); return true; };
    switch (id) {
      case 'plan_veo': if (!yes) { if (!s.planVeo) { addEffect(s, { type: 'traffic', pct: -0.05, until: w + 24, src: 'plan_veo' }); s.flags.veoPenaltyUntil = w + 24; G.log('Las familias se van a las ópticas adheridas al Plan Mirada Escolar: −5 % de visitas durante 6 meses.'); } break; } adherePlanVeo(co, s, w); break;
      case 'ensena': if (yes && typeof UI !== 'undefined' && UI && UI.showDepartment) co.notifications.unshift({ id: U.guid(), type: 'action', sourceId: 'openDept', dept: ID, header: 'Marketing', text: '' }); break;
      case 'competidor_lowcost': if (choice === 2) { const r = launch(co, 'promo_2x1'); if (!r.ok) notify('Guerra de precios', 'No podemos lanzar el 2×1: ' + r.msg); addBrand(s, -2); G.log('Guerra de precios: conservamos las visitas, pero el margen y la imagen de marca se resienten.'); break; } if (yes && pay(10000, 'Campaña de diferenciación')) { addBrand(s, 4); addEffect(s, { type: 'traffic', pct: -0.03, until: w + 24, src: 'lowcost' }); } else addEffect(s, { type: 'traffic', pct: s.retention >= 50 ? -0.05 : -0.10, until: w + 24, src: 'lowcost' }); break;
      case 'dia_vision': if (yes && pay(600, 'Día Mundial de la Visión')) { co.adjustFans(300 + Math.floor(co.fans * 0.01)); addEffect(s, { type: 'retention', val: 2, until: w + 48, src: 'vision' }); addBrand(s, 1); s.stars = U.clamp(s.stars + 0.05, K.STARS_MIN, 5); G.log('Jornada del Día Mundial de la Visión: +300 clientes fieles, +2 recurrencia, +1 notoriedad.'); } break;
      case 'dia_glaucoma': if (yes && pay(400, 'Cribado de glaucoma')) { co.adjustFans(150); addEffect(s, { type: 'patients', pct: 0.05, until: w + 8, src: 'glaucoma' }); addBrand(s, 1); } break;
      case 'dia_diabetes': if (yes && pay(450, 'Cribado de retina')) { co.adjustFans(150); addEffect(s, { type: 'patients', pct: 0.05, until: w + 8, src: 'diabetes' }); s.stars = U.clamp(s.stars + 0.03, K.STARS_MIN, 5); } break;
      case 'dia_audicion': if (yes && pay(600, 'Cribado auditivo')) { co.adjustFans(100); addEffect(s, { type: 'patients', pct: 0.06, until: w + 8, src: 'audicion' }); s.audioUntil = w + 8; } break;
      case 'navidad': if (yes && pay(1200, 'Escaparate navideño')) { addEffect(s, { type: 'units', genre: 'sol', pct: 0.12, until: w + 4, src: 'navidad' }); addEffect(s, { type: 'units', genre: 'premium', pct: 0.12, until: w + 4, src: 'navidad' }); addEffect(s, { type: 'traffic', pct: 0.08, until: w + 4, src: 'navidad' }); } break;
      case 'rebajas': if (yes) { const r = launch(co, 'promo_2x1'); if (!r.ok) notify('Promoción', 'No podemos lanzar la promoción: ' + r.msg); } else { addEffect(s, { type: 'units', all: true, pct: -0.05, until: w + 4, src: 'precio' }); addBrand(s, 1); G.log('Mantenemos el precio: −5 % de unidades estas semanas, +1 de notoriedad.'); } break;
      case 'noche_comercio': if (yes && pay(500, 'Noche del comercio')) { addEffect(s, { type: 'traffic', pct: 0.15, until: w + 2, src: 'noche' }); co.adjustFans(100); } break;
      case 'bono_comercio': if (yes && pay(200, 'Bono comercio')) { addEffect(s, { type: 'traffic', pct: 0.15, until: w + 4, src: 'bono' }); co.adjustFans(100); } break;
      case 'resena_viral': { const dmg = hasPR(s) ? 0.5 : 1;
        if (choice === 2) { const fine = 10000; spend(co, s, fine, 'Multa AEPD'); s.stars = U.clamp(s.stars - 0.5 * dmg, K.STARS_MIN, 5); addBrand(s, -3); addEffect(s, { type: 'traffic', pct: -0.20 * dmg, until: w + 8, src: 'viral' }); addEffect(s, { type: 'optin', val: -20, until: w + 48, src: 'viral' }); notify('Escándalo', `Publicar la graduación de una clienta es revelar datos de salud: la AEPD nos multa con ${U.money(fine)}, la polémica se dispara (−0,5 estrellas, −3 de notoriedad, −20 % de visitas dos meses) y muchos clientes retiran su consentimiento.`); break; }
        if (yes && pay(600, 'Rehacer las gafas de la clienta')) { s.stars = U.clamp(s.stars - 0.05 * dmg, K.STARS_MIN, 5); addEffect(s, { type: 'traffic', pct: -0.03 * dmg, until: w + 4, src: 'viral' }); G.log('Respondemos con educación y sin datos clínicos: la gente valora la profesionalidad y la crisis se apaga.'); } else { s.stars = U.clamp(s.stars - 0.3 * dmg, K.STARS_MIN, 5); addEffect(s, { type: 'traffic', pct: -0.15 * dmg, until: w + 8, src: 'viral' }); } break; }
      case 'cierre_competidor': if (choice === 2 && pay(18000, 'Compra de cartera y equipos')) { addEffect(s, { type: 'traffic', pct: 0.15, until: w + 24, src: 'cierre' }); addEffect(s, { type: 'patients', pct: 0.10, until: w + 24, src: 'cierre' }); addEffect(s, { type: 'retention', val: 4, until: w + 48, src: 'cierre' }); co.adjustFans(350 + Math.floor(co.fans * 0.01)); G.log('Compramos la cartera y los equipos de la óptica vecina: sus pacientes de progresivos pasan a revisarse con nosotros.'); } else if (yes && pay(1200, 'Buzoneo de bienvenida')) { addEffect(s, { type: 'traffic', pct: 0.12, until: w + 24, src: 'cierre' }); co.adjustFans(300); addEffect(s, { type: 'retention', val: 2, until: w + 48, src: 'cierre' }); } else addEffect(s, { type: 'traffic', pct: 0.08, until: w + 24, src: 'cierre' }); break;
      case 'obras': if (yes && pay(1000, 'Campaña «Seguimos abiertos»')) { addEffect(s, { type: 'traffic', pct: -0.08, until: w + 12, src: 'obras' }); co.adjustFans(50); } else addEffect(s, { type: 'traffic', pct: -0.20, until: w + 12, src: 'obras' }); break;
      case 'creador_viral': { const g = co.currentGame; if (g) g.hypePoints += 30; else co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + 30; co.adjustFans(Math.floor(co.fans * 0.02)); if (yes && pay(40000, 'Embajador de marca')) { addBrand(s, 8); if (!isActive(s, 'embajador_marca')) { s.active.push({ id: 'embajador_marca', start: w, until: w + 48, fee: 0 }); s.history.push({ id: 'embajador_marca', w }); } } else if (choice === 2) { addBrand(s, 2); addEffect(s, { type: 'traffic', pct: 0.05, until: w + 8, src: 'creador' }); s.flags.claimRiskUntil = w + 24; G.log('El creador recomienda nuestras lentillas: más visitas unas semanas, pero es publicidad de un producto sanitario por una persona famosa, y eso está prohibido.'); } break; }
      case 'denuncia_publicidad': { const dmg = hasPR(s) ? 0.5 : 1; s.flags.claimRiskUntil = 0;
        if (yes) { spend(co, s, 600 + 1500, 'Revisión legal y multa mínima'); addBrand(s, -1); G.log('Retiramos la campaña y publicamos la rectificación: el expediente se cierra con la multa mínima (1.500 €).'); }
        else { const fine = Math.round((6000 + Math.floor(U.rnd() * 9000)) * dmg); spend(co, s, fine, 'Sanción por publicidad sanitaria'); addBrand(s, -3 * dmg); s.stars = U.clamp(s.stars - 0.1 * dmg, K.STARS_MIN, 5); notify('Sanción de Sanidad', `Perdemos el recurso: multa de ${U.money(fine)} por publicidad de productos sanitarios, −${3 * dmg} de notoriedad y −${(0.1 * dmg).toFixed(2).replace('.', ',')} estrellas.${hasPR(s) ? ' Nuestro equipo de prensa ha reducido el daño a la mitad.' : ''}`); }
        break; }
      case 'reclamacion_aepd':
        if (yes) { spend(co, s, 900, 'Auditoría RGPD'); addEffect(s, { type: 'optin', val: -10, until: w + 24, src: 'auditoria' }); notify('AEPD', 'Auditamos la base, separamos el consentimiento comercial de la ficha clínica y damos de baja a quien no lo firmó: la Agencia nos apercibe sin multa. Perdemos unos cuantos contactos durante unos meses.'); }
        else { const fine = 5000 + Math.floor(U.rnd() * 7000); spend(co, s, fine, 'Multa AEPD'); addEffect(s, { type: 'optin', val: -30, until: w + 48, src: 'aepd' }); s.stars = U.clamp(s.stars - 0.1, K.STARS_MIN, 5); addBrand(s, -1); notify('AEPD', `Multa de ${U.money(fine)} por usar datos de salud con fines comerciales sin consentimiento expreso (art. 9 RGPD), −30 de opt-in durante un año y −0,1 estrellas.`); }
        break;
      case 'mido': if (yes) { const r = bookFair(co, 'mido', 1); if (!r.ok) notify('Milano Eyewear', 'No se pudo reservar: ' + r.msg); } break;
      case 'silmo': if (yes) { const r = bookFair(co, 'silmo', 1); if (!r.ok) notify('Salón Prisma', 'No se pudo reservar: ' + r.msg); } break;
    }
    recompute(co, s, w);
  }
  function adherePlanVeo(co, s, w) {
    const hasOptico = co.staff.some(x => x.role === 'optico'); const hasKids = co.gameLog.some(g => genreIs(g, 'infantil')) || (co.currentGame && genreIs(co.currentGame, 'infantil'));
    if (!hasOptico || !hasKids) { notify('Plan Mirada Escolar', `No cumplimos los requisitos de adhesión: ${!hasOptico ? 'hace falta un óptico-optometrista colegiado en plantilla' : 'necesitamos una colección Infantil (producto básico infantil) en catálogo'}. Podrás adherirte desde el panel de marketing cuando los cumplas.`); return { ok: false, msg: 'Requisitos no cumplidos' }; }
    if (co.cash < K.PLAN_VEO_COST) return { ok: false, msg: 'No hay dinero suficiente' };
    spend(co, s, K.PLAN_VEO_COST, 'Alta en el Plan Mirada Escolar'); s.planVeo = true; s.planVeoUntil = Math.max(s.planVeoUntil, w >= U.gameWeek('26/11/1') ? U.gameWeek('28/1/1') : U.gameWeek('27/1/1')); co.adjustFans(500);
    notify('Plan Mirada Escolar', 'Ya aparecemos en el listado oficial de ópticas adheridas. Las colecciones Infantil venden un 25 % más mientras dure el plan, ganamos 500 clientes fieles y el gabinete recibe un 3 % más de familias.');
    return { ok: true, msg: 'Adheridos al Plan Mirada Escolar' };
  }

  /* ---------- CSS del panel ---------- */
  try {
    if (typeof document !== 'undefined' && document.getElementById && !document.getElementById('css-marketing')) {
      const st = document.createElement('style'); st.id = 'css-marketing';
      st.textContent = '.dept-marketing .mk-kpis{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:6px;margin:4px 0 8px}.dept-marketing .mk-kpi{background:#fff;border:1px solid #e0d6c3;border-radius:8px;padding:6px 8px;font-size:12px}.dept-marketing .mk-kpi b{display:block;font-size:17px;margin:2px 0}.dept-marketing .mk-kpi small{color:#777;display:block}.dept-marketing details{margin:6px 0}.dept-marketing summary{cursor:pointer;font-weight:700;font-size:13px;padding:4px 0}.dept-marketing .mk-bars{display:flex;align-items:flex-end;gap:3px;height:52px;background:#fff;border:1px solid #e0d6c3;border-radius:6px;padding:4px}.dept-marketing .mk-bars i{flex:1;background:#e67e22;border-radius:2px 2px 0 0;min-width:4px}.dept-marketing .mk-bars i.b{background:#3498db}.dept-marketing .mk-bars i.g{background:#2faf1b}.dept-marketing .mk-ok{color:#229710}.dept-marketing .mk-warn{color:#c0392b}.dept-marketing .mk-tag{display:inline-block;background:#fde9c8;border:1px solid #ffd17b;border-radius:4px;padding:0 5px;margin-left:4px;font-size:11px;font-weight:600;vertical-align:middle}.dept-marketing .mk-cols{display:grid;grid-template-columns:1fr 1fr;gap:10px}@media(max-width:800px){.dept-marketing .mk-cols{grid-template-columns:1fr}}';
      document.head.appendChild(st);
    }
  } catch (e) { /* sin DOM */ }

  /* ---------- panel ---------- */
  function ui(co) {
    const s = S(co); const w = week(co); const d = co.getCurrentDate(); recompute(co, s, w);
    const eff = efficiency(co, s); const dc = deptCost(co, s); const used = usedSlots(s), cap = slots(co, s);
    const spend12 = s.spend12.reduce((a, b) => a + b, 0), rev12 = s.revenue12.reduce((a, b) => a + b, 0); const pct = rev12 > 0 ? spend12 / rev12 : 0; const target = K.BUDGET_TARGET[co.level];
    const cac = s.newFansYTD > 0 ? s.spendYTD / s.newFansYTD : null; const team = co.staff.filter(x => x.assignment === ID);
    const retIncome = Modules.get('tienda') ? null : Math.floor(Math.min(co.fans, K.FANS_CAP) * s.retention / 100 * K.RETENTION_EUR);
    const kpi = (l, v, sub) => `<div class="mk-kpi"><small>${l}</small><b>${v}</b>${sub ? `<small>${sub}</small>` : ''}</div>`;
    let h = `<div class="mk-kpis">
      ${kpi('Notoriedad', `${Math.round(s.brand)} / ${s.brandCap}`, `<span class="bar thin" style="display:block;margin:3px 0"><span style="display:block;height:100%;width:${Math.round(100 * s.brand / Math.max(1, s.brandCap))}%;background:#e67e22"></span></span>${brandTier(s.brand)} · decae ${s.dept === 3 ? '0,5' : '1'}/mes`)}
      ${kpi(co.realYear() >= 2005 ? 'Reseñas en internet' : 'Boca a boca', `★ ${s.stars.toFixed(1)}`, `visitas ×${starsFactor(s.stars).toFixed(2)}${s.flags.gmb ? '' : ' · sin ficha en el buscador'}`)}
      ${kpi('Tráfico extra', `${s.traffic >= 0 ? '+' : ''}${Math.round(s.traffic * 100)} %`, `${s.effects.filter(e => e.type === 'traffic').length} efectos temporales · tope +60 %`)}
      ${kpi('Recurrencia', `${s.retention} / 70`, retIncome !== null ? `${U.money(retIncome)}/mes de clientes recurrentes` : 'la usa la tienda')}
      ${kpi('Consentimiento RGPD', `${s.optIn} %`, s.flags.rgpd ? 'consentimiento comercial separado de la ficha clínica' : 'sin consentimiento comercial firmado')}
      ${kpi('Visitas estimadas', U.num(s.visitsMonth) + '/mes', `base ${U.num(K.VISITS_BASE[co.level])} × tráfico × reseñas × marca`)}
      ${kpi('Coste por cliente nuevo (año)', cac === null ? '—' : U.money(cac), cac !== null && cac > 200 ? '<span class="mk-warn">muy alto (objetivo &lt; 120 €)</span>' : 'objetivo &lt; 120 € · cada cliente fiel vale ≈ 380 €')}
      ${kpi('Presupuesto (12 meses)', rev12 > 0 ? (100 * pct).toFixed(1) + ' % ventas' : U.shortMoney(spend12), `objetivo ${Math.round(target * 100)} % · gasto ${U.shortMoney(spend12)}`)}
      ${kpi('Alcance', U.num(s.reachMonth), `este mes · ${U.num(s.reachLast)} el anterior`)}
      ${kpi('Pacientes extra', `+${Math.round(s.patients * 100)} %`, 'para el gabinete')}
    </div>`;
    // Departamento
    const D = DEPT[s.dept]; const next = DEPT[s.dept + 1]; const nreq = next ? next.req(co) : null;
    h += `<h4>Departamento: ${esc(D.name)} <span class="mk-tag">nivel ${s.dept}</span></h4><div class="sub">${esc(D.desc)}</div>
      <div class="row between"><div class="sub">Coste <b>${U.money(dc)}/mes</b>${dc < D.cost ? ` (${U.money(D.cost)} sin plantilla propia)` : ''} · eficacia <b>${Math.round(eff * 100)} %</b> · acciones en marcha <b>${used}/${cap}</b> · equipo asignado: ${team.length ? team.map(x => esc(x.name) + (x.role === ID ? '' : ' (' + esc(x.roleInfo().short) + ')')).join(', ') : 'nadie (asigna personal desde su ficha)'}</div></div>
      <div class="row">${next ? `<button class="btn small primary" data-mk="dept" data-v="${s.dept + 1}" ${nreq ? 'disabled' : ''} title="${esc(nreq || '')}">Ampliar a «${esc(next.name)}» (${U.money(next.cost)}/mes)</button>${nreq ? `<small class="mk-warn">${esc(nreq)}</small>` : ''}` : '<small class="mk-ok">Departamento al máximo</small>'}${s.dept > 0 ? `<button class="btn small" data-mk="dept" data-v="${s.dept - 1}">Reducir a «${esc(DEPT[s.dept - 1].name)}»</button>` : ''}${s.dept >= 2 ? `<label class="feat"><input type="checkbox" data-mk="auto" ${s.autoBudget ? 'checked' : ''}> Presupuesto automático (renueva los anuncios del buscador al vencer)</label>` : ''}</div>`;
    // Enseña
    const gl = { null: 'Independientes', cooperativa: 'Cooperativa con rótulo compartido', franquicia: 'Franquicia de gran cadena' };
    h += `<h4>Enseña: ${gl[s.group]}</h4><div class="sub">${co.level < 2 ? 'Podrás decidirlo cuando tengas local comercial (nivel 2).' : 'Decisión reversible: salir de la cooperativa pierde la notoriedad prestada; rescindir una franquicia cuesta ' + U.money(K.FRANQ_EXIT) + '.'}</div><div class="grid">
      <button class="sel ${s.group === null ? 'on' : ''}" data-mk="group" data-v="" ${co.level < 2 || s.group === null ? 'disabled' : ''}>Independiente con marca propia<small>Sin cuotas, pero negocias solo con los proveedores (descuentos del 10-20 %). Tope de notoriedad 30 → 100 con marca registrada. Todo el marketing lo pagas tú.</small></button>
      <button class="sel ${s.group === 'cooperativa' ? 'on' : ''}" data-mk="group" data-v="cooperativa" ${co.level < 2 || s.group === 'cooperativa' ? 'disabled' : ''}>Cooperativa con rótulo compartido (central de compras)<small>Aportación ${U.money(K.COOP_ENTRY)} + ${U.money(K.COOP_FEE)}/mes · imagen y cupo de compra del grupo, anuncios en TV: +15 notoriedad (tope 60), +5 expectación/colección, −8 % costes de canal por los rappels.</small></button>
      <button class="sel ${s.group === 'franquicia' ? 'on' : ''}" data-mk="group" data-v="franquicia" ${co.level < 2 || s.group === 'franquicia' || s.flags.branding ? 'disabled' : ''}>Franquicia de gran cadena<small>Canon ${U.money(K.FRANQ_ENTRY)} (50 % financiado) · +30 notoriedad (tope 40), +12 expectación/colección, 8 % de royalties y fondo de publicidad sobre ventas en tienda; la central fija precios, escaparate y surtido: sin marca propia, solo tienda −30 % unidades.</small></button></div>`;
    if (s.group === 'franquicia' && s.lastRoyalty) h += `<div class="sub">Royalties del último mes: ${U.money(s.lastRoyalty)}.</div>`;
    // Plan Mirada Escolar
    const veoWindow = w >= U.gameWeek('25/10/1') && w < U.gameWeek('28/1/1');
    if (veoWindow || s.planVeo) h += `<div class="note"><b>Plan Mirada Escolar</b> (ayuda pública para gafas infantiles): ${s.planVeo ? `adheridos hasta ${U.realYear(U.dateFromWeek(s.planVeoUntil).year)} · Infantil +25 % unidades, +3 % pacientes.` : `no adheridos. <button class="btn small" data-mk="veo">Adherirse (${U.money(K.PLAN_VEO_COST)})</button>`}</div>`;
    // Activas
    h += `<h4>Campañas y efectos activos</h4>`;
    const act = s.active.map(a => { const c = CAMP[a.id]; const fee = feeOf(co, s, c); return `<tr><td><b>${esc(c.name)}</b></td><td>${c.type === 'setup' ? 'acuerdo' : a.until ? Math.max(0, a.until - w) + ' sem.' : 'siempre activa'}</td><td>${fee ? U.money(fee) + '/mes' : '—'}</td><td>${c.type === 'puntual' || c.type === 'promo' ? '' : `<button class="btn small danger" data-mk="cancel" data-id="${c.id}">Cancelar</button>`}</td></tr>`; }).join('');
    const effRows = s.effects.filter(e => e.until > w).map(e => `<tr><td>${esc(effLabel(e))}</td><td>${e.until - w} sem.</td><td>${esc(e.src || '')}</td><td></td></tr>`).join('');
    h += act || effRows ? `<table class="tbl"><tr><th>Acción</th><th>Restante</th><th>Cuota / detalle</th><th></th></tr>${act}${effRows}</table>` : '<div class="sub">Nada en marcha. Empieza por la ficha en el buscador (gratis) y el buzoneo.</div>';
    // Catálogo
    h += `<h4>Catálogo de campañas</h4><div class="sub">Las acciones puntuales repetidas en 24 semanas rinden ×0,7 y luego ×0,3. Los efectos se multiplican por la eficacia del departamento (${Math.round(eff * 100)} %).</div>`;
    let opened = false; // solo se despliega la primera categoría con algo lanzable; el resto queda plegado con su recuento
    for (const [cid, cname] of CATS) {
      const items = Object.values(CAMP).filter(c => c.cat === cid); if (!items.length) continue;
      const rows = items.map(c => { const why = canLaunch(co, s, c); const cost = costOf(co, s, c); const fee = feeOf(co, s, c); const locked = !!why; const act = isActive(s, c.id) || (c.type === 'setup' && s.flags['done_' + c.id]); const rep = (c.type === 'puntual' || c.type === 'promo') ? repFactor(s, c.id, w) : 1; return `<div class="ritem ${locked ? 'off' : ''}"><div><b>${esc(c.name)}</b>${act ? '<span class="mk-tag">activa</span>' : ''}${c.weeks && c.weeks < 9999 ? `<span class="mk-tag">${c.weeks} sem.</span>` : ''}${rep < 1 ? `<span class="mk-tag">×${rep} por repetición</span>` : ''}<small>${esc(c.desc)}</small>${locked && !act ? `<small class="mk-warn">${esc(why)}</small>` : ''}</div><div class="rcost">${cost ? U.money(cost) : 'gratis'}${fee ? `<br><small>+ ${U.money(fee)}/mes</small>` : ''}</div><button class="btn small ${locked ? '' : 'primary'}" data-mk="launch" data-id="${c.id}" ${locked ? 'disabled' : ''} title="${esc(why || '')}">${c.type === 'lanzamiento' ? 'Contratar' : c.type === 'setup' ? 'Activar' : c.type === 'recurrente' ? 'Contratar' : 'Lanzar'}</button></div>`; }).join('');
      const open = !opened && items.some(c => !canLaunch(co, s, c)) ? (opened = true, ' open') : '';
      h += `<details${open}><summary>${esc(cname)} <small>(${items.filter(c => !canLaunch(co, s, c)).length} disponibles de ${items.length})</small></summary>${rows}</details>`;
    }
    // Ferias
    const fairHtml = Object.keys(FAIRS).map(k => { const F = FAIRS[k]; const can = !any(R.res(co, 'FeriasInternacionales'), R.branding(s)); const booked = s.fair[k] != null; const inWin = d.month === F.bookMonth; return `<div class="ritem ${can ? '' : 'off'}"><div><b>${esc(F.name)}</b><small>${k === 'mido' ? 'Febrero, Fiera Milano Rho; reserva en enero. Abre canales de terceros (+10 % unidades 24 semanas).' : 'Finales de septiembre, París; reserva en agosto. Premium +15 % 8 semanas y opción a Silmo d\'Or.'}</small>${booked ? `<small class="mk-ok">Reservado: ${esc(F.opts[s.fair[k]].name)}</small>` : ''}${!can ? `<small class="mk-warn">${esc(any(R.res(co, 'FeriasInternacionales'), R.branding(s)))}</small>` : ''}</div><div class="rcost">${F.opts.map(o => U.shortMoney(o.cost)).join(' / ')}</div><div class="row">${F.opts.map((o, i) => `<button class="btn small" data-mk="fair" data-id="${k}" data-v="${i}" ${can && inWin && !booked && co.cash >= o.cost ? '' : 'disabled'} title="${o.name}: +${o.brand} notoriedad">${esc(o.name)}</button>`).join('')}</div></div>`; }).join('');
    h += `<h4>Ferias internacionales</h4>${fairHtml}<div class="sub">IberÓptica (Madrid, junio) la gestiona la óptica desde la noticia de mayo; el stand suma +2/+5/+10 de notoriedad.</div>`;
    // Investigaciones
    const idle = co.staff.find(x => x.isIdle());
    h += `<h4>Investigaciones de marketing</h4>${RESEARCH.map(r => { const done = co.hasResearch(r.id); const avail = co.availableResearch.includes(r.id); const can = avail && idle && co.researchPoints >= r.pointsCost && co.cash >= r.cost; return `<div class="ritem ${done || avail ? '' : 'off'}"><div><b>${esc(r.name)}</b>${done ? '<span class="mk-tag">hecha</span>' : ''}<small>${esc(r.desc)}</small></div><div class="rcost">${done ? '' : `🔬 ${r.pointsCost} · ${U.shortMoney(r.cost)}`}</div>${done ? '<span class="mk-ok">✓</span>' : `<button class="btn small" data-mk="research" data-id="${r.id}" ${can ? '' : 'disabled'} title="${avail ? (idle ? 'Investigar con ' + esc(idle.name) : 'Nadie libre para investigar') : 'Todavía no disponible'}">Investigar</button>`}</div>`; }).join('')}`;
    // Histórico
    const l12 = s.log12.slice(-12); const mxT = Math.max(0.1, ...l12.map(x => Math.abs(x.traffic)));
    const hist = s.hist.slice(-12); const mxS = Math.max(1, ...hist.map(x => x.spend));
    h += `<h4>Histórico</h4><div class="mk-cols"><div><div class="wl">Tráfico extra (12 semanas)</div><div class="mk-bars">${l12.map(x => `<i title="semana ${x.w}: ${Math.round(x.traffic * 100)} %" style="height:${Math.max(3, 100 * Math.abs(x.traffic) / mxT)}%"></i>`).join('') || '<small>sin datos</small>'}</div><div class="wl">Notoriedad (12 semanas)</div><div class="mk-bars">${l12.map(x => `<i class="b" title="${Math.round(x.brand)}" style="height:${Math.max(3, x.brand)}%"></i>`).join('') || '<small>sin datos</small>'}</div></div>
      <div><div class="wl">Gasto mensual en marketing (12 meses)</div><div class="mk-bars">${hist.map(x => `<i class="g" title="A${x.y} M${x.m}: ${U.money(x.spend)}" style="height:${Math.max(3, 100 * x.spend / mxS)}%"></i>`).join('') || '<small>sin datos</small>'}</div><div class="sub">Gasto en el año: ${U.money(s.spendYTD)} · clientes fieles nuevos: ${U.num(s.newFansYTD)}${s.lastYear ? ` · año anterior: ${U.money(s.lastYear.spend)} y ${U.num(s.lastYear.fans)} fieles (CAC ${s.lastYear.fans ? U.money(s.lastYear.spend / s.lastYear.fans) : '—'})` : ''}</div>${s.lastInforme ? `<div class="note">${esc(s.lastInforme.text).replace(/\n/g, '<br>')}</div>` : ''}</div></div>`;
    return { body: `<div class="mk">${h}</div>`, bind(el, refresh) {
      const all = el.querySelectorAll ? el.querySelectorAll('[data-mk]') : [];
      all.forEach(b => {
        const act = b.dataset ? b.dataset.mk : b.getAttribute('data-mk'); const id = b.dataset ? b.dataset.id : b.getAttribute('data-id'); const v = b.dataset ? b.dataset.v : b.getAttribute('data-v');
        const ev = act === 'auto' ? 'change' : 'click';
        b.addEventListener(ev, () => {
          let r;
          if (act === 'launch') r = launch(co, id);
          else if (act === 'cancel') r = cancel(co, id);
          else if (act === 'dept') r = setDept(co, +v);
          else if (act === 'group') r = setGroup(co, v || null);
          else if (act === 'fair') r = bookFair(co, id, +v);
          else if (act === 'veo') r = adherePlanVeo(co, S(co), week(co));
          else if (act === 'auto') { S(co).autoBudget = !!b.checked; r = { ok: true, msg: b.checked ? 'Presupuesto automático activado' : 'Presupuesto automático desactivado' }; }
          else if (act === 'research') { const st = co.staff.find(x => x.isIdle()); r = st && G.startResearch(id, st) ? { ok: true, msg: 'Investigación iniciada' } : { ok: false, msg: 'No se pudo iniciar (faltan puntos, dinero o personal libre)' }; }
          if (r) toast(r.msg); if (typeof G !== 'undefined') G.emit('refresh'); if (refresh) refresh();
        });
      });
    } };
  }
  function effLabel(e) { if (e.type === 'traffic') return `Tráfico ${e.pct >= 0 ? '+' : ''}${Math.round(e.pct * 100)} %`; if (e.type === 'patients') return `Pacientes +${Math.round(e.pct * 100)} %`; if (e.type === 'retention') return `Recurrencia +${e.val}`; if (e.type === 'optin') return `Opt-in ${e.val}`; if (e.type === 'units') return `Unidades ${e.pct >= 0 ? '+' : ''}${Math.round(e.pct * 100)} % (${e.genre ? DB.genre(e.genre).name : e.audience ? 'público ' + e.audience : e.channel ? DB.platform(e.channel).name : e.third ? 'canales de terceros' : 'todas'})`; return e.type; }

  /* ---------- registro ---------- */
  const MOD = {
    id: ID, name: 'Departamento de marketing', icon: '📣', order: 10,
    K, DEPT, CAMP, RESEARCH, FAIRS, state: S, launch, cancel, setDept, setGroup, bookFair, adherePlanVeo, efficiency, slots, deptCost, costOf, feeOf, repFactor, starsFactor, visitsMonth, recompute,
    init(co) { const s = S(co); s.lastFans = s.lastFans || co.fans || 0; s.brandCap = computeCap(s); recompute(co, s, week(co)); },
    weekly(co, w, d) {
      const s = S(co);
      s.effects = s.effects.filter(e => e.until > w);
      for (const a of s.active.slice()) { if (a.until && a.until <= w) { endCampaign(co, s, a); if (a.id === 'google_ads_local' && s.autoBudget) { const r = launch(co, 'google_ads_local'); if (r.ok) G.log('Presupuesto automático: anuncios del buscador renovados.'); } } }
      recompute(co, s, w); weeklyHype(co, s); syncCore(co, s);
      calendar(co, s, w, d); if (d.week === 4) randomEvents(co, s, w, d);
      recompute(co, s, w);
      s.log12.push({ w, traffic: s.traffic, brand: Math.round(s.brand * 10) / 10, visits: s.visitsMonth }); if (s.log12.length > 12) s.log12.shift();
    },
    monthly(co, d) {
      const s = S(co); const w = week(co); const eff = efficiency(co, s);
      if (d.month === 1) { s.lastYear = { spend: s.spendYTD, fans: s.newFansYTD }; s.spendYTD = 0; s.newFansYTD = 0; const keep = {}; for (const k in s.fired) if (!/\d/.test(k) || +(k.match(/\d+/) || [0])[0] >= d.year - 2) keep[k] = true; s.fired = keep; }
      s.brand = Math.max(0, s.brand - (s.dept === 3 ? K.BRAND_DECAY_D3 : K.BRAND_DECAY));
      for (const a of s.active) {
        const c = CAMP[a.id], f = c.fx;
        if (f.brandMonthly) addBrand(s, f.brandMonthly * eff * (c.id === 'cm_externo' && s.dept === 2 ? 1.2 : 1));
        if (f.fansPctMonthly) { let n = Math.floor(co.fans * f.fansPctMonthly * eff); if (c.id === 'programa_referidos') n = referralFans(co, s); /* el coste de los referidos ya va en la cuota mensual (feeOf) */ if (n > 0) co.adjustFans(n); }
        if (f.trafficMonthly) s.seoTraffic = Math.min(f.trafficCap, s.seoTraffic + f.trafficMonthly * (s.dept === 3 ? 1.3 : 1));
        if (f.reachMonthly) s.reachMonth += f.reachMonthly;
      }
      if (s.dept === 3) addBrand(s, 1);
      if (d.month % 3 === 0 && (isActive(s, 'programa_resenas') || isActive(s, 'seo_local')) && s.stars < 4.8) s.stars = Math.min(4.8, s.stars + 0.1);
      // ingreso recurrente (solo si no existe el módulo tienda, que usa retention)
      if (!Modules.get('tienda')) { const inc = Math.floor(Math.min(co.fans, K.FANS_CAP) * s.retention / 100 * K.RETENTION_EUR); s.lastRetentionIncome = inc; if (inc > 0) { co.adjustCash(inc, 'Clientes recurrentes'); G.log(`Fidelización: ${U.money(inc)} de clientes que repiten (recurrencia ${s.retention} %).`); } }
      // royalties de franquicia sobre ventas en tienda del último mes
      let storeSales = 0, revenueMonth = 0;
      for (const e of co.cashLog) { if (e.week < w - 4 || e.amount <= 0 || !/^Ventas /.test(e.label || '')) continue; revenueMonth += e.amount; const g = co.gameLog.find(x => 'Ventas ' + x.title === e.label); if (g && (g.platforms || []).includes('tienda')) storeSales += e.amount / Math.max(1, g.platforms.length); }
      if (s.group === 'franquicia') { const roy = Math.round(storeSales * K.FRANQ_ROYALTY); s.lastRoyalty = roy; if (roy > 0) spend(co, s, roy, 'Royalties de franquicia'); }
      // seguimiento de gasto, ingresos y fans
      const fixed = MOD.monthlyCost(co); s.spendMonth += fixed; s.spendYTD += fixed;
      s.spend12.push(Math.round(s.spendMonth)); if (s.spend12.length > 12) s.spend12.shift(); s.revenue12.push(Math.round(revenueMonth)); if (s.revenue12.length > 12) s.revenue12.shift();
      const gained = Math.max(0, co.fans - (s.lastFans || 0)); s.newFansYTD += gained; s.lastFans = co.fans;
      s.hist.push({ y: d.year, m: d.month, spend: Math.round(s.spendMonth), revenue: Math.round(revenueMonth), brand: Math.round(s.brand), fans: co.fans }); if (s.hist.length > 24) s.hist.shift();
      if (d.month === 7 && s.newFansYTD > 50 && s.spendYTD / s.newFansYTD > 200 && fireOnce(s, 'cac' + d.year)) notify('Marketing', `Ojo: cada cliente fiel nuevo nos está costando ${U.money(s.spendYTD / s.newFansYTD)} en marketing (objetivo: menos de 120 €). Quizá convenga apostar más por la fidelización y «Trae a un amigo».`, 'news');
      s.spendMonth = 0; s.reachLast = s.reachMonth; s.reachMonth = 0;
      recompute(co, s, w);
    },
    monthlyCost(co) { const s = S(co); let t = deptCost(co, s); for (const a of s.active) t += feeOf(co, s, CAMP[a.id]); if (s.group === 'cooperativa') t += K.COOP_FEE; return Math.round(t); },
    hypeFactor(co, game) { const s = S(co); let f = 1 + s.brand / 200; if (s.dept === 3 && game && genreIs(game, 'premium')) f *= 1.1; return f; },
    candidateBonus(co) { return U.clamp(S(co).brand / 500, 0, 0.4); },
    salesFactor(co, game) {
      const s = S(co); const plats = (game && game.platforms) || []; let f = 1; const w = week(co);
      if (plats.some(p => BRAND_CH.includes(p))) f *= 1 + s.brand / 300;
      for (const e of s.effects) if (e.type === 'units' && e.until > w && matchUnits(game, e)) f *= 1 + e.pct;
      for (const a of s.active) { const fx = CAMP[a.id].fx; if (fx.unitsAlways) for (const m of fx.unitsAlways) if (matchUnits(game, m)) f *= 1 + m.pct; }
      if (s.planVeo && genreIs(game, 'infantil')) f *= 1.25;
      if (s.group === 'franquicia' && plats.length && plats.every(p => p === 'tienda')) f *= 0.7;
      if (s.dept === 3) { if (plats.some(p => !OWN_CH.includes(p))) f *= 1.08; if (plats.includes('webpropia')) f *= 1.1; }
      if (game && game.flags && game.flags.mkPLV && plats.some(p => !OWN_CH.includes(p))) f *= 1.10;
      if (isActive(s, 'promo_2x1')) f *= 1.3;
      return U.clamp(f, 0.5, 2);
    },
    unitCost(co, game) { const s = S(co); const price = game && game.size && C.SIZE[game.size] ? C.SIZE[game.size].unitPrice : 70; let pct = 0; for (const a of s.active) pct += CAMP[a.id].fx.marginPct || 0; if (isActive(s, 'promo_2x1')) pct += 0.2; return Math.round(price * Math.min(0.35, pct) * 100) / 100; },
    scoreFactor(co, game) { const s = S(co); let f = 1; if (game && game.flags && game.flags.mkPackaging) f += 0.02; if (game && game.flags && game.flags.mkEscaparate) f += 0.02; if (isActive(s, 'pr_prensa_moda') || s.dept === 3) f += 0.02; if (isActive(s, 'programa_fabricante')) f += 0.02; if (s.dept >= 2) f += 0.02; return Math.min(1.06, f); },
    onCreateGame(co, g) {
      const s = S(co); let h = Math.floor(s.brand / 2); if (s.group === 'cooperativa') h += 5; if (s.group === 'franquicia') h += 12;
      for (const a of s.active) { const c = CAMP[a.id]; if (c.fx.hypeCollection && (!c.fx.hypeGenre || genreIs(g, c.fx.hypeGenre))) h += c.fx.hypeCollection; }
      if (h > 0) { g.hypePoints += h; G.log(`La marca aporta ${h} de expectación inicial a ${g.title}.`); }
      if (s.group === 'cooperativa' && g.costs > 0) { const ref = Math.round(g.costs * 0.08); co.adjustCash(ref, 'Descuento central de compras'); g.costs -= ref; }
      if (s.group === 'franquicia' && (g.platforms || []).length && g.platforms.every(p => p === 'tienda')) notify('Franquicia', `${g.title} solo se venderá en nuestra tienda, pero el contrato de franquicia no permite exponer marca propia: venderá un 30 % menos. Añade canales de terceros para evitarlo.`, 'news');
      if (isActive(s, 'escaparate_pro')) g.flags.mkEscaparate = true;
    },
    onRelease(co, g) {
      const s = S(co); if (g.score < 5) { s.stars = U.clamp(s.stars - 0.3, K.STARS_MIN, 5); G.log(`Las malas reseñas de ${g.title} se notan en internet: ${s.stars.toFixed(1)} estrellas.`); }
      if (typeof g.fansChangeTarget === 'number') { if (g.fansChangeTarget < 0) { let m = 1 - s.retention / 200; for (const a of s.active) if (CAMP[a.id].fx.fansLossPct) m *= 1 - CAMP[a.id].fx.fansLossPct; g.fansChangeTarget *= m; } else if (g.flags && g.flags.mkPackaging) g.fansChangeTarget *= 1.1; }
    },
    onResearch(co, item) { if (!item || item.category !== 'Marketing') return; const un = Object.values(CAMP).filter(c => c.research === item.id).map(c => c.name); if (un.length) notify('Marketing', `${item.name}: nuevas acciones disponibles en el panel de marketing: ${un.join(', ')}.`, 'news'); },
    onAssign(co, ch, dept) { if (dept === ID) G.log(`${ch.name} se incorpora al equipo de marketing${ch.role === ID ? '' : ' (rinde a medias: no es su especialidad)'}.`); },
    onDecision,
    ui, sceneInfo(co) { const s = S(co); return { dept: s.dept, campaignActive: s.active.some(a => a.until && CAMP[a.id] && CAMP[a.id].type !== 'setup'), brand: s.brand, traffic: s.traffic }; },
    report(co) { const s = S(co); const used = usedSlots(s); return [{ label: 'Notoriedad', value: `${Math.round(s.brand)}/${s.brandCap} (${brandTier(s.brand)})` }, { label: co.realYear() >= 2005 ? 'Reseñas en internet' : 'Boca a boca', value: '★ ' + s.stars.toFixed(1) }, { label: 'Recurrencia / opt-in', value: `${s.retention} / ${s.optIn} %` }, { label: 'Tráfico extra', value: `${s.traffic >= 0 ? '+' : ''}${Math.round(s.traffic * 100)} %` }, { label: 'Departamento', value: `${DEPT[s.dept].name} (${U.money(deptCost(co, s))}/mes)` }, { label: 'Acciones en marcha', value: `${used}/${slots(co, s)}` }, { label: 'Enseña', value: s.group || 'independiente' }, { label: 'Gasto en marketing (año)', value: U.money(s.spendYTD) }, { label: 'Coste por cliente nuevo', value: s.newFansYTD ? U.money(s.spendYTD / s.newFansYTD) : '—' }]; },
    DECISIONS: ['marketing:plan_veo', 'marketing:ensena', 'marketing:competidor_lowcost', 'marketing:dia_vision', 'marketing:dia_glaucoma', 'marketing:dia_diabetes', 'marketing:dia_audicion', 'marketing:navidad', 'marketing:rebajas', 'marketing:noche_comercio', 'marketing:bono_comercio', 'marketing:resena_viral', 'marketing:cierre_competidor', 'marketing:obras', 'marketing:creador_viral', 'marketing:mido', 'marketing:silmo', 'marketing:denuncia_publicidad', 'marketing:reclamacion_aepd']
  };
  Modules.register(MOD);
})();
