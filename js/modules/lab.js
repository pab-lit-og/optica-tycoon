/* Óptica Tycoon — módulo Laboratorio de lentes (id 'lab', order 30).
   Dónde se biselan y montan las lentes de la óptica y, en los dos niveles altos, dónde se TALLAN.
   Biselar ≠ tallar: más del 95 % de las ópticas con taller solo biselan y montan lentes terminadas que compran al
   fabricante; tallar (generar la superficie a partir de bloques semiterminados con generador, pulidora, lacado y
   antirreflejante en cámara de vacío) exige 200.000 €–1 M€ y solo compensa con volumen de progresivos y recetas complejas.
   Escalera real N1-N5 (docs/research/RESULTADO_DEPARTAMENTOS_OFICIO.md) ↔ tier del juego 0-4:
     tier 0 = N1 montaje externo y telebiselado · tier 1 = N2 biselado propio básico · tier 2 = N3 biselado 3D y taladrado
     tier 3 = N4 minilab de tallado digital freeform (aquí empieza el tallado) · tier 4 = N5 laboratorio industrial con vacío y venta a terceros.
   Contenido: 5 tiers, 26 equipos (+ contrato de mantenimiento), 23 lentes nuevas en DATA.PARTS (categoría Lentes; las 9 del
   núcleo se conservan), 8 laboratorios externos, 7 investigaciones (categoría Laboratorio), 3 cursos técnicos, eventos de
   proveedor/avería/montaje/auditoría, canal "laboratorio para terceros" en tier 4 y estado compartido para tienda y gabinete:
     co.modules.lab = { tier, deliveryDays, defectRate, lensMargin, capacityDay, ... }
   Fuentes: docs/research/lentes.data.json, lentes.md y RESULTADO_DEPARTAMENTOS_OFICIO.md. Script clásico: todo dentro de una IIFE.
   Precios en € de juego ≈ € reales en los tiers 1-3; el tier 4 se mantiene por encima del rango real (0,55-1,1 M€) por equilibrio.
   Fórmulas principales (ver recompute()):
     capacidad/día   = base del tier × factor de personal (técnicos asignados / mínimo, tope 1,4) + equipos
     defectos propios = Σ(prob. base de los 12 pasos − reducciones de equipos) × factor de pericia × factor de tier
     defectos externos = 0,02 + (1 − calidad del proveedor) × 0,3
     entrega (días)  = cuota propia × días del tier + cuota externa × plazo del proveedor (+ huelgas)
     ingreso semanal = propios × (tarifa de servicio + ticket × margen propio) + externos × ticket × margen externo
                       + venta a terceros (tier 4) − remontajes × coste de remontaje
*/
(function () {
  'use strict';
  const ID = 'lab';
  const esc = s => (typeof UI !== 'undefined' && UI.esc) ? UI.esc(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = m => { if (typeof UI !== 'undefined' && UI.toast) UI.toast(m); };
  const money = n => U.money(n);
  const wk = co => Math.floor(co.currentWeek);
  const pct = v => Math.round(100 * v) + ' %';
  const pct1 = v => (100 * v).toFixed(1) + ' %';
  const notify = (h, t, type, opts) => { if (typeof G !== 'undefined' && G.notify) G.notify(h, t, type, opts); };
  const log = t => { if (typeof G !== 'undefined' && G.log) G.log(t); };
  const LENS_GENRES = { graduado: 1, lectura: 0.8, infantil: 1, premium: 0.5, deportiva: 0.3, sol: 0.15 };
  const DAYS_WEEK = 5.5;          // días de taller por semana
  const REMAKE_OWN = [0, 35, 50, 70, 70], REMAKE_EXT = 25; // € por remontaje propio según tier (lente de stock → tallada) y externo (coste medio de la investigación: 70 €)

  /* =====================================================================
     1. CATÁLOGO (podado y adaptado de lentes.data.json; € de juego)
     ===================================================================== */
  /* Tiers: capex (una vez), monthly (€/mes), capacityDay (trabajos/día con el personal mínimo), days (entrega propia),
     margin (puntos de margen extra sobre el ticket de lentes), fee (€ que la óptica se embolsa por montar en casa:
     montaje ahorrado + servicio exprés), staffMin (técnicos), defectK (factor de proceso), level, includes (equipos que trae). */
  const TIERS = [
    { tier: 0, name: 'Montaje externo y telebiselado', short: 'Externo', capex: 0, monthly: 0, capacityDay: 0, days: 0, margin: 0, fee: 0, staffMin: 0, defectK: 1, level: 1, includes: [], desc: 'No biselamos: mandamos la montura al laboratorio o le enviamos el trazado y la lente vuelve biselada, lista para montar, con un recargo de 4-6 € por lente y 24-72 horas de espera (más si es de fabricación). La óptica mide, monta a mano y entrega: cada par depende del plazo y de la calidad del proveedor.' },
    { tier: 1, name: 'Taller de biselado básico', short: 'Biselado básico', capex: 6500, monthly: 180, capacityDay: 12, days: 0.5, margin: 0.04, fee: 10, staffMin: 1, defectK: 1, level: 1, includes: ['biseladora_manual_usada', 'frontofocometro_manual', 'ventilete', 'kit_herramientas'], desc: 'Biseladora automática 2D de ocasión, frontofocómetro manual, ventilete y banco de taller en la trastienda: con el stock de lentes, lo mínimo que exige la normativa gallega para abrir. Biselas y montas en aro completo lentes terminadas de stock en el día; los progresivos y las recetas de fabricación siguen llegando del laboratorio, y el al aire o las envolventes dan muchas mermas.' },
    { tier: 2, name: 'Taller de biselado 3D y taladrado', short: 'Biselado 3D', capex: 38000, monthly: 600, capacityDay: 30, days: 0.3, margin: 0.07, fee: 16, staffMin: 1, defectK: 1, level: 2, includes: ['biseladora_auto_3d', 'trazador_bloqueador', 'ventilete'], desc: 'Biseladora robotizada con taladro e inclinación de muela, trazador 3D y centrador-bloqueador. Monofocales de stock en una hora, ranurado para nylon, taladrado al aire y bisel escalonado para envolventes, con mermas por debajo del 1,5 %. Es el techo de casi todas las ópticas: siguen comprando las lentes terminadas.' },
    { tier: 3, name: 'Minilab de tallado digital freeform', short: 'Minilab', capex: 300000, monthly: 7000, capacityDay: 75, days: 0.2, margin: 0.18, fee: 20, staffMin: 2, defectK: 0.9, level: 3, includes: ['generador_freeform', 'pulidora_freeform', 'bloqueadora_superficie'], desc: 'Bloqueadora de superficie, generador digital freeform compacto y pulidora flexible en un cuarto de 50 m² con corriente trifásica. Tallamos a partir de bloques semiterminados los progresivos, ocupacionales y recetas especiales en menos de 24 horas; los monofocales de stock se siguen comprando terminados, porque tallarlos no compensa. Solo sale a cuenta con volumen de progresivos.' },
    { tier: 4, name: 'Laboratorio industrial freeform con vacío', short: 'Industrial', capex: 2200000, monthly: 27000, capacityDay: 800, days: 0.1, margin: 0.30, fee: 28, staffMin: 3, defectK: 0.8, level: 4, includes: ['linea_modular_freeform', 'coater_industrial', 'hardcoat_linea'], desc: 'Línea automatizada de generadores freeform, lacado endurecido en línea y cámara de alto vacío para antirreflejante multicapa propio. Cientos de trabajos al día: sobra capacidad para vender lentes a otras ópticas.' }
  ];
  const USED_TIER2 = { capex: 14000, failMult: 2.5, capMult: 0.8, label: 'de segunda mano' };

  /* Equipos (26). cost €, maint €/mes, tier mínimo, req {equipo, level}, efectos: cap (trabajos/día), def (puntos de defectos, − mejora),
     margin (puntos de margen), days (− días de entrega propia), fail (prob. mensual de avería sin contrato), step (paso del flujo que mejora). */
  const EQ = [
    // Tier 1 (N2: biselado propio básico)
    { id: 'biseladora_manual_usada', tier: 1, name: 'Biseladora automática 2D de ocasión', cost: 2500, maint: 25, cap: 12, def: 0, fail: 0.03, core: true, desc: 'Recorta y bisela lentes orgánicas y minerales para aro completo y nylon sencillo siguiendo la plantilla o el trazado. De segunda mano: unos 12 trabajos al día y alguna avería.' },
    { id: 'biseladora_mano', tier: 1, name: 'Biseladora manual de muela de diamante', cost: 900, maint: 5, def: -1, desc: 'Mata los cantos de seguridad, retoca décimas de milímetro en lentes grandes y suaviza picos: −1 punto de defectos.' },
    { id: 'frontofocometro_manual', tier: 1, name: 'Frontofocómetro manual', cost: 850, maint: 5, def: -2, step: 5, desc: 'Verifica esfera, cilindro, eje y prisma al recibir las lentes y marca el centro óptico: −2 puntos de defectos.' },
    { id: 'ventilete', tier: 1, name: 'Ventilete de aire caliente u horno de arena', cost: 400, maint: 0, def: -1, step: 9, desc: 'Dilata el aro de pasta para montar las lentes y ajustar varillas. Obligatorio en todo taller; sin él el acetato se quema o se parte: −1 punto de defectos.' },
    { id: 'kit_herramientas', tier: 1, name: 'Banco de taller (alicates de ajuste, destornilladores, taladro manual, ultrasonidos)', cost: 900, maint: 10, fee: 1, desc: 'Plaquetas, tornillos, ajuste de puente y pequeñas reparaciones cobradas: +1 € por trabajo propio.' },
    { id: 'stock_lentes_basico', tier: 1, name: 'Stock de lentes de taller (más de 1.100 esféricas y tóricas terminadas)', cost: 3000, maint: 300, margin: 0.02, days: -0.2, desc: 'El stock que pide la inspección en Galicia: monofocales sencillos montados en el día sin pedir al laboratorio. +2 puntos de margen, −0,2 días de entrega. Reposición 300 €/mes.' },
    // Tier 2 (N3: biselado 3D y taladrado)
    { id: 'biseladora_auto_3d', tier: 2, name: 'Biseladora 3D robotizada con taladro e inclinación de muela', cost: 29000, maint: 100, cap: 30, def: -3, fail: 0.02, step: 8, core: true, req: { level: 2 }, desc: 'Bisel en V, ranura para nylon, bisel escalonado para envolventes y taladros para al aire, todo automático en unos 5 minutos por lente. Corazón del taller.' },
    { id: 'trazador_bloqueador', tier: 2, name: 'Trazador 3D y centrador-bloqueador con ventosa', cost: 8000, maint: 30, def: -5, step: 7, req: { equipo: 'biseladora_auto_3d' }, desc: 'Escanea el galce de la montura en 3D y centra la lente con cámara antes de pegar la ventosa: adiós al descentrado a ojo (±1 mm). −5 puntos de defectos.' },
    { id: 'frontofocometro_digital', tier: 2, name: 'Frontofocómetro digital con medida de UV y detección de progresivos', cost: 4500, maint: 15, def: -3, step: 5, desc: 'Detecta los errores del laboratorio antes de montar: −3 puntos de defectos (también en pedidos externos).' },
    { id: 'modulo_taladro_ranura', tier: 2, name: 'Taladradora y ranuradora de retoque (al aire y nylon)', cost: 3500, maint: 15, def: -2, fee: 2, step: 9, desc: 'Taladros y ranuras retocados sin lascar la lente: −2 puntos de defectos y +2 € por trabajo (suplemento de al aire y nylon).' },
    { id: 'tintadora', tier: 2, name: 'Tintadora de lentes (cubetas de tinte a 90 °C)', cost: 750, maint: 20, margin: 0.015, desc: 'Sol graduada y degradados en casa por 1 € de tinte, vigilando que los dos ojos queden del mismo tono: +1,5 puntos de margen.' },
    { id: 'pulidora_bisel', tier: 2, name: 'Pulidora de cantos', cost: 1000, maint: 5, def: -1, desc: 'Cantos abrillantados en las monturas al aire y de nylon: −1 punto de defectos.' },
    { id: 'software_pedidos_edi', tier: 2, name: 'Programa de gestión con pedidos EDI y telebiselado', cost: 2500, maint: 120, def: -1, extDays: -1, step: 4, desc: 'Se envía el trazado digital y la montura no viaja al laboratorio: −1 día en pedidos externos, −1 punto de defectos (pedidos mal tecleados).' },
    { id: 'contrato_mantenimiento', tier: 2, name: 'Contrato de mantenimiento preventivo', cost: 0, maint: 150, failMult: 0.25, desc: 'El servicio técnico revisa bombas de agua, muelas y palpadores cada trimestre: las averías se reducen un 75 %.' },
    // Tier 3 (N4: minilab de tallado digital freeform)
    { id: 'generador_freeform', tier: 3, name: 'Generador digital freeform compacto', cost: 160000, maint: 1250, cap: 75, margin: 0.06, fail: 0.015, core: true, req: { level: 3 }, desc: 'Fresa y tornea con herramienta de diamante la cara interna del bloque semiterminado, punto a punto, hasta unas 75 lentes por hora. Núcleo del minilab.' },
    { id: 'pulidora_freeform', tier: 3, name: 'Pulidora flexible de doble husillo', cost: 80000, maint: 400, def: -2, core: true, req: { equipo: 'generador_freeform' }, desc: 'Pule la superficie tallada hasta la transparencia sin deformar el pasillo del progresivo: −2 puntos de defectos.' },
    { id: 'bloqueadora_superficie', tier: 3, name: 'Bloqueadora de superficie (aleación o adhesivo UV)', cost: 35000, maint: 150, def: -2, core: true, req: { equipo: 'generador_freeform' }, desc: 'Encinta y fija el semiterminado al bloque sin burbujas que induzcan prisma: −2 puntos de defectos.' },
    { id: 'desbloqueo_lavado', tier: 3, name: 'Desbloqueadora y lavado por ultrasonidos', cost: 18000, maint: 80, def: -1, cap: 5, req: { equipo: 'generador_freeform' }, desc: 'Separa el bloque sin choque térmico ni rayas y deja la lente limpia para el lacado: −1 punto de defectos, +5 trabajos/día.' },
    { id: 'mapeador_superficie', tier: 3, name: 'Verificador de superficies freeform (mapa de potencias)', cost: 30000, maint: 120, def: -4, step: 10, req: { equipo: 'generador_freeform' }, desc: 'Mapa de potencias de cada lente tallada según ISO 21987: caza ondas de pulido y ejes fuera de tolerancia antes de montar. −4 puntos de defectos.' },
    { id: 'hardcoat_inmersion', tier: 3, name: 'Lacado endurecido por inmersión y curado', cost: 60000, maint: 350, def: -1, margin: 0.03, req: { equipo: 'generador_freeform' }, desc: 'Barniz antirrayas de polisiloxano propio por 1 € el par (cuidado con las motas de polvo): +3 puntos de margen. Requisito para la cámara de vacío.' },
    { id: 'software_lds', tier: 3, name: 'Software de cálculo freeform y licencias de diseño', cost: 20000, maint: 1500, margin: 0.04, ticket: 15, req: { equipo: 'generador_freeform' }, desc: 'Calcula la superficie con distancia al vértice, ángulo pantoscópico y facial; diseños progresivos y ocupacionales con canon por lente: +4 puntos de margen y +15 € de ticket.' },
    { id: 'camara_ar_pequena', tier: 3, name: 'Cámara de vacío compacta para antirreflejante', cost: 210000, maint: 1500, margin: 0.07, def: 2, fail: 0.01, req: { equipo: 'hardcoat_inmersion', level: 3 }, flag: 'lab_ar_propio', desc: 'Evapora capas de óxidos y una capa hidrófuga en lotes de unas 30 lentes: antirreflejante propio por 3 € el par, +7 puntos de margen. Curva de aprendizaje: +2 puntos de defectos (4 los primeros 6 meses) por delaminaciones y reflejos desiguales. Desbloquea el "Antirreflejante propio".' },
    // Tier 4 (N5: laboratorio industrial freeform con vacío)
    { id: 'linea_modular_freeform', tier: 4, name: 'Línea automatizada de generadores freeform', cost: 1000000, maint: 10000, cap: 800, fail: 0.01, core: true, req: { level: 4 }, desc: 'Generadores de 100-120 lentes por hora con doble herramienta de diamante y mantenimiento predictivo, alimentados por cintas. Unos 7 € de coste por lente.' },
    { id: 'coater_industrial', tier: 4, name: 'Cámara de alto vacío industrial (antirreflejante y espejado)', cost: 600000, maint: 5000, margin: 0.05, core: true, req: { equipo: 'linea_modular_freeform' }, desc: 'Cargas de 140-200 lentes por ciclo: antirreflejante, filtro azul e hidrófugo a 1,5 € el par. +5 puntos de margen.' },
    { id: 'hardcoat_linea', tier: 4, name: 'Lacado endurecido en línea (centrifugado automático)', cost: 250000, maint: 2000, def: -2, core: true, req: { equipo: 'linea_modular_freeform' }, desc: 'Laca antirrayas uniforme y sin motas, sin manipular la lente: −2 puntos de defectos.' },
    { id: 'automatizacion_mes', tier: 4, name: 'Cintas, robots y software de control de producción', cost: 350000, maint: 2500, days: -0.05, staffSave: 1, cap: 100, req: { equipo: 'linea_modular_freeform' }, desc: 'Cada bandeja localizada de principio a fin y menos manos: el personal mínimo baja en 1, +100 trabajos/día.' },
    { id: 'inspeccion_automatica', tier: 4, name: 'Inspección automática final (potencia, cosmética y grabados)', cost: 150000, maint: 1000, def: -5, step: 10, req: { equipo: 'linea_modular_freeform' }, desc: 'Ninguna lente fuera de tolerancia sale de la línea: −5 puntos de defectos.' }
  ];
  const EQBY = {}; for (const e of EQ) EQBY[e.id] = e;

  /* Flujo de trabajo (12 pasos) con la probabilidad base de defecto de cada paso (suma 35 %) y el equipo que la reduce.
     Es el recorrido de una gafa en la óptica; los defectos de fabricación de la lente (bloqueo, generado, pulido, lacado,
     antirreflejante) los comete el proveedor hasta el tier 2 y entran por la recepción (paso 5) y el control final (paso 10).
     defectos propios = Σ(base − reducción de los equipos con step) × pericia del personal × defectK del tier. */
  const STEPS = [
    { n: 1, name: 'Receta y anamnesis', who: 'óptico', base: 1, err: 'receta incompleta, prisma o adición olvidados' },
    { n: 2, name: 'Toma de medidas (DNP, altura, pantoscópico, vértice)', who: 'óptico', base: 6, err: 'altura o DNP mal medidas → prisma inducido', eq: { trazador_bloqueador: 2 } },
    { n: 3, name: 'Elección de lente (material, índice, diseño, tratamientos)', who: 'óptico', base: 2, err: 'curva base que no casa con la montura, índice inadecuado, policarbonato sin endurecer' },
    { n: 4, name: 'Pedido al laboratorio o cálculo de la superficie', who: 'técnico', base: 2, err: 'pedido mal tecleado, OD/OI invertidos, DNP o altura mal introducidas', eq: { software_pedidos_edi: 1 } },
    { n: 5, name: 'Recepción y verificación (frontofocómetro)', who: 'técnico', base: 3, err: 'no se detecta el error del laboratorio: eje o prisma fuera de tolerancia', eq: { frontofocometro_manual: 2, frontofocometro_digital: 3 }, max: 3 },
    { n: 6, name: 'Trazado del galce de la montura', who: 'técnico', base: 3, err: 'trazado impreciso → lente floja o forzada en el aro', eq: { trazador_bloqueador: 2 } },
    { n: 7, name: 'Centrado y bloqueo con ventosa', who: 'técnico', base: 4, err: 'la ventosa resbala en lentes hidrófugas y gira el eje; centro óptico desplazado; prisma por mal asiento del bloque', eq: { trazador_bloqueador: 1, bloqueadora_superficie: 2 } },
    { n: 8, name: 'Biselado (bisel en V, ranura, plano y taladros)', who: 'técnico', base: 4, err: 'lascado al taladrar, astillado, bisel mal posicionado, rayas', eq: { biseladora_auto_3d: 3, biseladora_mano: 1, pulidora_bisel: 1 }, max: 4 },
    { n: 9, name: 'Montaje (ventilete, tornillos, nylon, al aire)', who: 'técnico', base: 3, err: 'antirreflejante cuarteado por exceso de calor, montura vieja que se parte, tornillos pasados, grietas', eq: { ventilete: 1, modulo_taladro_ranura: 2 } },
    { n: 10, name: 'Control de calidad final (ISO 21987)', who: 'técnico', base: 2, err: 'entregar fuera de tolerancia: ondas de pulido, motas en la laca, reflejo desigual entre ojos', eq: { mapeador_superficie: 4, inspeccion_automatica: 5, pulidora_freeform: 2, hardcoat_linea: 2, desbloqueo_lavado: 1 }, max: 2 },
    { n: 11, name: 'Ajuste anatómico y entrega', who: 'óptico', base: 2, err: 'montura caída → altura efectiva mal' },
    { n: 12, name: 'Seguimiento y adaptación de progresivos', who: 'óptico', base: 3, err: 'inadaptación a progresivos' }
  ];

  /* Laboratorios externos (8). coef = coste relativo (1 = tarifa del fabricante líder), quality 0..1, days = plazo medio de un pedido de fabricación,
     extMargin = puntos de margen que la óptica gana en los pedidos externos por comprar más barato, loyalty = bono tras 24 semanas.
     Los ids conservan nombres históricos; los textos visibles son genéricos (sin marcas reales). */
  const PROVIDERS = [
    { id: 'lab_essilor', name: 'Multinacional líder de lentes', brands: 'marcas de progresivos y tratamientos que el cliente conoce por la tele', coef: 1.0, quality: 0.95, days: 5, extMargin: 0.0, loyalty: 0.015, hype: 5, desc: 'El gigante del sector: calidad alta, marcas que el cliente pide por su nombre (+5 de expectación en colecciones graduadas) y descuento por volumen si le eres fiel.' },
    { id: 'lab_hoya', name: 'Multinacional asiática de lentes', brands: 'programa exprés y lentes de control de miopía', coef: 0.95, quality: 0.93, days: 4, extMargin: 0.01, loyalty: 0.015, desc: 'Servicio exprés de 24/48 h en progresivos de gama alta y descuento por volumen.' },
    { id: 'lab_zeiss', name: 'Fabricante alemán de óptica de precisión', brands: 'progresivos individualizados de gama alta', coef: 1.05, quality: 0.96, days: 5, extMargin: -0.01, premium: 0.02, desc: 'La mejor calidad del mercado y un plus en colecciones Premium (+2 % de nota). Caro.' },
    { id: 'lab_rodenstock', name: 'Fabricante centroeuropeo de lentes biométricas', brands: 'progresivos calculados con biometría ocular', coef: 1.05, quality: 0.94, days: 6, extMargin: -0.01, premium: 0.01, desc: 'Lentes calculadas con medidas biométricas del ojo. Lento y caro, pero impecable.' },
    { id: 'lab_indo', name: 'Fabricante nacional de lentes y maquinaria', brands: 'lentes y biseladoras de fabricación nacional', coef: 0.85, quality: 0.88, days: 4, extMargin: 0.025, eqDiscount: 0.1, desc: 'Proveedor nacional que también vende maquinaria de taller: 10 % de descuento en biseladoras y trazadores.' },
    { id: 'lab_prats', name: 'Laboratorio nacional independiente', brands: 'laboratorio de recetas de tamaño medio, servicio rápido', coef: 0.8, quality: 0.88, days: 3, extMargin: 0.035, desc: 'Independiente, el más rápido y competitivo del país. Nuestro favorito de salida.' },
    { id: 'lab_asia', name: 'Laboratorio asiático low-cost', brands: 'stock 1.56 de marca blanca por importación', coef: 0.45, quality: 0.7, days: 14, extMargin: 0.08, lotRisk: 0.08, desc: 'Lentes a un euro el par… que tardan dos semanas y llegan como llegan. Riesgo de lotes defectuosos.' },
    { id: 'central_compra', name: 'Central de compra', brands: 'grupo de compra de ópticas independientes', coef: 0.8, quality: 0.92, days: 4, extMargin: 0.045, commit: 5000, penalty: 1500, level: 2, desc: 'Descuentos directos y rappels sobre la tarifa del fabricante a cambio de volumen: hay que comprar al menos 5.000 €/mes de lentes externas o pagar 1.500 € de penalización.' }
  ];
  const PROVBY = {}; for (const p of PROVIDERS) PROVBY[p.id] = p;

  /* Efectos de cada lente (DATA.PARTS categoría Lentes) sobre el laboratorio: ticket (€ extra en el ticket medio de lentes),
     def (puntos de defectos), margin (puntos de margen). Incluye las 9 del núcleo. */
  const LENS_FX = {
    cr39: { ticket: 4, def: 0, margin: 0.005 }, endurecido: { ticket: 2, def: -2 }, antirreflejante: { ticket: 10, def: 0.5, margin: 0.01 }, polarizadas: { ticket: 6, margin: 0.01 }, fotocromaticas: { ticket: 12, margin: 0.015 },
    altoindice: { ticket: 12, def: 0.5, margin: 0.015 }, filtroazul: { ticket: 6, margin: 0.01 }, progresivos: { ticket: 22, def: 1.5, margin: 0.02 }, freeform: { ticket: 36, def: 0.5, margin: 0.03 },
    mineral: { ticket: 0, def: 1 }, organico156: { ticket: -4, def: 0.5, margin: 0.02 }, policarbonato: { ticket: 5, def: 1 }, indice160: { ticket: 10, margin: 0.01 }, trivex: { ticket: 8, def: -0.5, margin: 0.01 },
    indice174: { ticket: 16, def: 1, margin: 0.02 }, mineral_alto: { ticket: 10, def: 1.5, margin: 0.015 }, semiterminados_propios: { ticket: 0, margin: 0.06 },
    uv400: { ticket: 2 }, tintado: { ticket: 4, margin: 0.005 }, ar_premium: { ticket: 18, def: -1, margin: 0.02 }, espejadas: { ticket: 6, margin: 0.005 }, antivaho: { ticket: 5, margin: 0.005 }, conduccion: { ticket: 6, margin: 0.005 }, ar_propio: { ticket: 10, margin: 0.05, def: 1 },
    monofocal_esferica: { ticket: 0 }, monofocal_asferica: { ticket: 6, margin: 0.005 }, bifocal: { ticket: 8, margin: 0.01 }, lenticular: { ticket: 6, margin: 0.01 }, base8_deportiva: { ticket: 8, margin: 0.01 },
    ocupacional: { ticket: 12, margin: 0.015 }, monofocal_freeform: { ticket: 12, def: -1, margin: 0.015 }, freeform_personalizado: { ticket: 50, margin: 0.04 }, control_miopia: { ticket: 28, margin: 0.04 }
  };
  const TICKET_BASE = [0, 60, 95, 110, 140];  // € de lentes por trabajo según nivel de local (antes del mix): base sobre la que el laboratorio gana margen
  const WALKIN_BASE = [0, 15, 50, 120, 230];  // trabajos/semana de mostrador según nivel (sin colecciones ni gabinete)

  /* =====================================================================
     2. REGISTRO EN DATA.* (al cargar el fichero, antes de Modules.register)
     ===================================================================== */
  const NEW_PARTS = [
    // materiales (group 'lente': excluyentes entre sí en una línea de producción)
    { id: 'mineral', name: 'Lentes minerales (vidrio crown 1.523)', category: 'Lentes', v: 1, group: 'lente', req: { missionLevel: ['Lentes', 1] } },
    { id: 'organico156', name: 'Orgánicas 1.56 de stock (gama económica)', category: 'Lentes', v: 2, group: 'lente', req: { missionLevel: ['Lentes', 1], date: '3/1' } },
    { id: 'policarbonato', name: 'Policarbonato 1.59 (resistente al impacto)', category: 'Lentes', v: 4, group: 'lente', req: { missionLevel: ['Lentes', 3] } },
    { id: 'indice160', name: 'Alto índice 1.60', category: 'Lentes', v: 4, group: 'lente', req: { missionLevel: ['Lentes', 3] } },
    { id: 'trivex', name: 'Poliuretano 1.53 (ligero y resistente al impacto)', category: 'Lentes', v: 6, group: 'lente', req: { missionLevel: ['Lentes', 4], date: '7/1' } },
    { id: 'indice174', name: 'Ultra alto índice 1.74', category: 'Lentes', v: 8, group: 'lente', req: { missionLevel: ['Lentes', 6], featureLevel: ['altoindice', 2] } },
    { id: 'mineral_alto', name: 'Mineral alto índice 1.8/1.9', category: 'Lentes', v: 8, group: 'lente', req: { missionLevel: ['Lentes', 6], featureLevel: ['mineral', 1] } },
    { id: 'semiterminados_propios', name: 'Bloques semiterminados propios y marca de lentes', category: 'Lentes', v: 10, req: { research: 'lab_tier3', missionLevel: ['Lentes', 7] } },
    // tratamientos
    { id: 'uv400', name: 'Protección UV400', category: 'Lentes', v: 1, req: { missionLevel: ['Lentes', 1] } },
    { id: 'tintado', name: 'Tintado uniforme y degradado', category: 'Lentes', v: 2, req: { missionLevel: ['Lentes', 2] } },
    { id: 'espejadas', name: 'Espejado (ligero o total)', category: 'Lentes', v: 4, req: { missionLevel: ['Lentes', 4], featureLevel: ['tintado', 1] } },
    { id: 'ar_premium', name: 'Antirreflejante superior (hidrófugo, oleófugo y antiestático)', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 5], featureLevel: ['antirreflejante', 2] } },
    { id: 'antivaho', name: 'Antivaho permanente', category: 'Lentes', v: 6, req: { featureLevel: ['ar_premium', 1], date: '16/1' } },
    { id: 'conduccion', name: 'Tratamiento para conducción (antideslumbramiento)', category: 'Lentes', v: 6, req: { featureLevel: ['ar_premium', 1] } },
    { id: 'ar_propio', name: 'Antirreflejante propio (cámara de vacío en casa)', category: 'Lentes', v: 10, req: { research: 'lab_ar_propio', featureLevel: ['ar_premium', 2] } },
    // diseños (group 'lente_diseno')
    { id: 'monofocal_asferica', name: 'Monofocal asférica', category: 'Lentes', v: 2, group: 'lente_diseno', req: { missionLevel: ['Lentes', 2] } },
    { id: 'bifocal', name: 'Bifocal de segmento', category: 'Lentes', v: 2, group: 'lente_diseno', req: { missionLevel: ['Lentes', 2] } },
    { id: 'lenticular', name: 'Lenticulares para altas graduaciones', category: 'Lentes', v: 4, req: { missionLevel: ['Lentes', 4] } },
    { id: 'base8_deportiva', name: 'Lentes base 8 compensadas para envolventes', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 4] } },
    { id: 'ocupacional', name: 'Ocupacionales y degresivas (oficina)', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 5], date: '9/1' } },
    { id: 'monofocal_freeform', name: 'Monofocal freeform compensada (tallado digital)', category: 'Lentes', v: 8, group: 'lente_diseno', req: { missionLevel: ['Lentes', 6], date: '8/1' } },
    { id: 'freeform_personalizado', name: 'Progresivos freeform individualizados (medidas de montura y biometría)', category: 'Lentes', v: 10, group: 'lente_diseno', req: { missionLevel: ['Lentes', 8], featureLevel: ['freeform', 2], research: 'Gabinete' } },
    { id: 'control_miopia', name: 'Lentes de desenfoque periférico para control de miopía', category: 'Lentes', v: 10, req: { missionLevel: ['Lentes', 8], date: '24/1', research: 'Gabinete' } }
  ];
  for (const p of NEW_PARTS) if (!DATA.PARTS.some(x => x.id === p.id)) DATA.PARTS.push(p);

  const tierOf = co => (co.modules && co.modules[ID] ? co.modules[ID].tier : 0);
  const RESEARCH = [
    { id: 'LabControlCalidad', name: 'Protocolo de control de calidad (ISO 21987)', category: 'Laboratorio', pointsCost: 20, duration: 10000, cost: 15000, req: co => tierOf(co) >= 1, desc: 'Tolerancias de la norma verificadas en el frontofocómetro en cada entrega y descargo firmado antes de calentar monturas viejas: −2 puntos de defectos del laboratorio.' },
    { id: 'LabExpress', name: 'Servicio "gafa graduada en 1 hora"', category: 'Laboratorio', pointsCost: 30, duration: 10000, cost: 25000, req: co => tierOf(co) >= 2, desc: 'Monofocales del stock del taller biselados y montados mientras el cliente espera, con sobreprecio: +8 € por trabajo propio y −0,1 días de entrega.' },
    { id: 'LabGarantiaAdaptacion', name: 'Garantía de adaptación de progresivos', category: 'Laboratorio', pointsCost: 40, duration: 12000, cost: 40000, req: co => co.hasResearch('progresivos') && tierOf(co) >= 1, desc: 'Cambio gratuito en 30 días si no se adapta, tramitado con la garantía del fabricante: los remontajes propios cuestan un 25 % menos y ganamos clientes fieles.' },
    { id: 'LabTrazadoRemoto', name: 'Integración digital con el laboratorio (pedidos EDI y videocentrado)', category: 'Laboratorio', pointsCost: 60, duration: 12000, cost: 60000, req: co => co.level >= 2 && tierOf(co) >= 1, desc: 'Medidas del videocentrado y trazado digital de la montura enviados al proveedor: −1 día en pedidos externos y −1 punto de defectos.' },
    { id: 'LabMarcaPropia', name: 'Marca de lentes propia', category: 'Laboratorio', pointsCost: 150, duration: 15000, cost: 200000, req: co => tierOf(co) >= 3, desc: 'Grabamos nuestra marca en las lentes que tallamos: +4 puntos de margen y +10 de expectación en colecciones graduadas.' },
    { id: 'LabTerceros', name: 'Laboratorio para terceros (venta a otras ópticas)', category: 'Laboratorio', pointsCost: 200, duration: 15000, cost: 300000, req: co => tierOf(co) >= 4, desc: 'Vendemos lentes talladas y tratadas a otras ópticas con la capacidad que nos sobra: un ingreso mensual propio del laboratorio.' },
    { id: 'LabCertificacionISO', name: 'Certificación ISO 13485 del laboratorio', category: 'Laboratorio', pointsCost: 250, duration: 20000, cost: 400000, req: co => co.hasResearch('LabTerceros'), desc: 'Las cadenas y las mutuas exigen un sistema de calidad de fabricante de productos sanitarios: +50 % de demanda de otras ópticas y +2 € por par vendido.' }
  ];
  for (const r of RESEARCH) if (!DATA.RESEARCH.some(x => x.id === r.id)) DATA.RESEARCH.push(r);

  const TRAINING = [
    { id: 'curso_biselado', name: 'Curso de biselado y montaje', cost: 25000, pointsCost: 5, duration: 12000, basePoints: 8, tF: 1, dF: 0, rF: 0, sF: 0.2, maxP: 600, level: 1, skill: 'montaje', lab: '−2 puntos de defectos por persona formada en el laboratorio' },
    { id: 'curso_calidad_lab', name: 'Control de calidad de lentes (ISO 21987)', cost: 30000, pointsCost: 10, duration: 12000, basePoints: 8, tF: 0.5, dF: 0, rF: 0.8, sF: 0, maxP: 700, level: 2, skill: 'calidad_lab', lab: '−1,5 puntos de defectos por persona formada' },
    { id: 'curso_freeform', name: 'Tallado digital freeform, lacado y antirreflejante', cost: 60000, pointsCost: 20, duration: 16000, basePoints: 10, tF: 1, dF: 0.1, rF: 0.3, sF: 0, maxP: 800, level: 3, skill: 'freeform', lab: '+10 % de capacidad por persona a partir del minilab' }
  ];
  for (const t of TRAINING) if (!DATA.TRAINING.some(x => x.id === t.id)) DATA.TRAINING.push(t);


  /* ---------- constantes de balance (ajustadas con tests/sim_lab.js) ---------- */
  const OWN_MAX = [0, 0.7, 0.9, 1, 1];          // cuota máxima de trabajos que se montan en casa por tier (con biselado básico los progresivos siguen llegando de fuera)
  const COLL_SHARE_OWN = 0.2, COLL_SHARE_OTHER = 0.04; // parte de las monturas de una colección cuyos clientes montan las lentes con nosotros (canal propio / ajeno)
  const COLL_CAP_MULT = 2;                       // tope de trabajos semanales procedentes de colecciones = × trabajos de mostrador del nivel
  const DEF_K = 0.4;                             // escala de los puntos de defecto del flujo (35 pts brutos ≈ 14 % sin equipo ni formación)
  const MIX_K = { ticket: 0.3, def: 0.3, margin: 0.2 }; // dilución del mix de lentes investigadas sobre ticket/defectos/margen
  const B2B = { base: 300, spare: 0.8, margin: 10, isoMargin: 2, isoDemand: 1.5, days: 22 }; // laboratorio para terceros (tier 4)
  const prov = st => PROVBY[st.provider] || PROVBY.lab_prats;
  const weekOf = s => U.weekFromDate(s);

  /* Eventos: probabilidad anual, condición y efecto (fire). Los de proveedor los ignora el tier ≥3 (independencia).
     Decisiones con sourceId 'lab:<id>' resueltas en onDecision. Basados en EVT_LAB_01..04 de la investigación de oficio. */
  const EVENTS = [
    { id: 'tarifas', pYear: 0.5, cond: (co, st) => co.level >= 2 && st.extShare > 0.2 && st.tier < 3 && !(st.fx.tariffUntil > wk(co)),
      fire(co, st) { const p = prov(st); const hike = 0.04 + Math.round(U.rnd() * 4) / 100; const opts = [`Absorber la subida sin tocar precios (−${(hike * 40).toFixed(1)} puntos de margen externo, 12 meses)`, 'Negociar a través del grupo de compra comprometiendo un 15 % más de volumen (puede salir mal)', 'Repercutir la subida en el precio de las lentes (−4 % de clientes de mostrador, 12 meses)']; if (p.id !== 'lab_asia') opts.push('Pasarnos a un laboratorio asiático low-cost (más barato, 14 días de plazo y más inadaptaciones)'); notify('Subida anual de tarifas', `Llega enero y nuestro proveedor (${p.name}) sube un ${Math.round(hike * 100)} % las lentes terminadas y de fabricación "por el encarecimiento de la energía y las materias primas". Con tallado propio esto nos daría igual.`, 'decision', { sourceId: 'lab:tarifas', hike, options: opts }); } },
    { id: 'huelga', pYear: 0.3, cond: (co, st) => co.level >= 2 && st.extShare > 0.2 && st.tier < 3 && !(st.fx.strikeUntil > wk(co)),
      fire(co, st) { const cost = Math.round(200 + st.extJobs * 3 * 6); notify('Huelga de transportistas', `Los transportistas paran tres semanas y las lentes del laboratorio llegan con tres días de retraso. Los clientes preguntan por sus gafas cada día.`, 'decision', { sourceId: 'lab:huelga', cost, options: [`Mensajería urgente a nuestra costa (${money(cost)})`, 'Esperar (+3 días de entrega durante 3 semanas)'] }); } },
    { id: 'averia', pYear: 0.4, cond: (co, st) => st.tier >= 1 && !st.stoppedUntil && !(st.fx.downUntil > wk(co)),
      fire(co, st) { const mach = st.tier >= 4 ? 'la línea de generadores' : st.tier === 3 ? 'el generador freeform' : st.tier === 2 ? 'la biseladora robotizada' : 'la biseladora'; const why = st.tier >= 3 ? U.pick(['el husillo hace un ruido que no promete nada', 'la herramienta de diamante se ha astillado', 'la bomba del refrigerante ha reventado', 'la placa electrónica ha dicho basta']) : U.pick(['se ha quemado la bomba de agua y la muela de diamante se ha embotado', 'el palpador del trazador se ha doblado', 'la placa electrónica ha dicho basta']); const cost = Math.round([0, 1100, 1500, 12000, 40000][st.tier] * (st.used && st.tier === 2 ? 1.3 : 1)); const contract = has(st, 'contrato_mantenimiento'); notify('Avería en el laboratorio', `Se ha parado ${mach}: ${why}. Hay gafas prometidas para esta semana.`, 'decision', { sourceId: 'lab:averia', cost, contract, options: [`Servicio técnico oficial y telebiselado del laboratorio mientras tanto (${money(cost)}, 1 semana sin biselar en casa)`, contract ? 'Esperar al técnico del contrato (gratis, 2 semanas parados)' : `Recambio de segunda mano por internet (${money(Math.round(cost * 0.35))}): taller parado 2 semanas, retrasos y alguna cancelación`] }); } },
    { id: 'lote', pYear: 0.2, cond: (co, st) => st.extShare > 0.1 && !(st.fx.lotUntil > wk(co)),
      fire(co, st) { const own = st.tier >= 3; const what = own ? 'Un lote de bloques semiterminados llega con burbujas e inclusiones en la masa. Si lo tallamos, muchas lentes volverán.' : `Empiezan a volver gafas con el antirreflejante cuarteado y delaminado, todas de un mismo lote del proveedor (${prov(st).name}). Los clientes juran que no las dejaron al sol.`; notify('Lote defectuoso', what, 'decision', { sourceId: 'lab:lote', blame: !own, options: own ? ['Devolver el lote (+2 días de entrega durante 4 semanas)', 'Tallarlo igualmente y asumir los remontajes (+8 puntos de defectos 4 semanas)'] : ['Reponerlas sin coste con la garantía de fabricación del proveedor (+2 días de entrega durante 4 semanas)', 'Culpar al cliente (el salpicadero, el sol…) y seguir montando el lote (+8 puntos de defectos 4 semanas, clientes perdidos)'] }); } },
    { id: 'auditoria', pYear: 0.25, cond: (co, st) => st.tier >= 1 && st.history.length >= 8,
      fire(co, st) { const d = st.defectRate; let txt, f = 0; if (d < 0.03) { f = Math.floor(co.fans * 0.02 + 150); txt = `Un auditor externo revisa 40 gafas montadas según la norma ISO 21987: todas dentro de tolerancia (tasa de remontajes ${pct1(d)}). El informe circula por el sector y ganamos ${U.num(f)} clientes fieles.`; } else if (d > 0.05) { f = -Math.floor(co.fans * 0.03); txt = `Un auditor externo revisa 40 gafas montadas según la norma ISO 21987 y encuentra varias fuera de tolerancia (tasa de remontajes ${pct1(d)}): prismas inducidos y ejes girados. Perdemos ${U.num(-f)} clientes fieles. Formación y equipos de control, por favor.`; } else txt = `Un auditor externo revisa 40 gafas montadas según la norma ISO 21987: resultado correcto sin más (tasa de remontajes ${pct1(d)}). Por debajo del 3 % habríamos salido en la revista del colegio.`; if (f) co.adjustFans(f); notify('Auditoría de calidad', txt); } },
    { id: 'b2b_contrato', pYear: 0.6, cond: (co, st) => st.tier >= 4 && st.b2b.active && !(st.b2b.contractUntil > wk(co)),
      fire(co, st) { const n = 100 + Math.round(U.rnd() * 200); const client = U.pick(['Ópticas Brétema', 'una central de compra gallega', 'una red de clínicas oftalmológicas', 'una cadena portuguesa', 'una mutua de salud']); notify('Contrato de laboratorio', `${client.charAt(0).toUpperCase() + client.slice(1)} busca laboratorio para sus lentes: ${n} trabajos al día durante un año. Pagan a ${B2B.margin - 2} € de margen por par, algo menos que el resto, pero es volumen fijo.`, 'decision', { sourceId: 'lab:b2b_contrato', n, client, options: [`Firmar: +${n} trabajos/día durante 12 meses`, 'Rechazar: preferimos la capacidad para nosotros'] }); } },
    { id: 'glaucoma_lente', pYear: 0.2, cond: (co, st) => st.tier >= 2 && st.jobsWeek > 30,
      fire(co, st) { const f = Math.floor(co.fans * 0.02 + 300); co.adjustFans(f); notify('Ojo clínico en el taller', `Al verificar en el frontofocómetro las gafas viejas de un cliente habitual, ${staffList(co).length ? staffList(co)[0].name : 'el técnico'} se extraña: la graduación ha cambiado dos dioptrías en seis meses. El óptico-optometrista lo deriva al oftalmólogo con un informe y le detectan una diabetes sin diagnosticar. El cliente lo cuenta a todo el barrio: +${U.num(f)} clientes fieles.`, 'news'); } },
    { id: 'montura_cliente', pYear: 0.3, cond: (co, st) => st.tier >= 1 && st.jobsWeek > 10,
      fire(co, st) { const signed = !!st.flags.descargo || co.hasResearch('LabControlCalidad'); notify('Montura partida en el ventilete', `Al calentar en el ventilete la montura de pasta de un cliente, que tiene quince años y quiere lentes nuevas, el frente cruje y se parte por el puente. ${signed ? 'Por suerte firmó el descargo de responsabilidad para monturas usadas.' : 'Nadie le pidió que firmara el descargo para monturas usadas.'}`, 'decision', { sourceId: 'lab:montura_cliente', signed, options: signed ? ['Ofrecerle reparar el acetato (16 €) o un 35 % de descuento en una montura nueva', 'Cobrarle la montura nueva a precio de venta: firmó el descargo'] : ['Asumir la culpa y regalarle una montura de la casa (unos 15 €)', 'Discutir y cobrarle la montura nueva (hoja de reclamaciones y arbitraje de consumo)'] }); } }
  ];
  const EVBY = {}; for (const e of EVENTS) EVBY[e.id] = e;

  /* =====================================================================
     3. ESTADO
     ===================================================================== */
  function defaults() {
    return { v: 1, tier: 0, used: false, provider: 'lab_prats', providerSince: 0, loyalNotified: false, equipment: [], broken: {}, stoppedUntil: 0,
      /* campos compartidos (DESIGN §1) */
      deliveryDays: 3, defectRate: 0.05, lensMargin: 0, capacityDay: 0,
      /* derivados por recompute() */
      capacityWeek: 0, capacityBase: 0, staffUnits: 0, staffFactor: 0, staffMin: 0, ownDefect: 0, extDefect: 0.05, ticket: 0, feeJob: 0, marginOwn: 0, marginExt: 0, ownDays: 0, provDays: 3, ownShare: 0, extShare: 1,
      /* flujo semanal */
      jobsWeek: 0, ownJobs: 0, extJobs: 0, queue: 0, remakesWeek: 0, incomeWeek: 0, costWeek: 0, busy: 0, demand: { walk: 0, coll: 0, gab: 0 },
      prevUnits: {}, history: [], months: [], month: { jobs: 0, own: 0, ext: 0, remakes: 0, income: 0, cost: 0, b2b: 0, extSpend: 0 },
      b2b: { active: false, jobsDay: 0, demandDay: 0, contractUntil: 0, contractJobs: 0, incomeMonth: 0, client: '' },
      fx: { tariffUntil: 0, tariff: 0, strikeUntil: 0, strikeDays: 0, downUntil: 0, lotUntil: 0, lotExtra: 0, antivahoUntil: 0, arLearnUntil: 0, pvpUntil: 0 },
      cool: {}, researchWeek: {}, flags: { antivahoShown: false, warnedStaff: false, warnedCap: false, descargo: false },
      stats: { jobs: 0, own: 0, ext: 0, remakes: 0, remakeCost: 0, income: 0, b2b: 0, repairs: 0, fines: 0, upgrades: 0, penalties: 0 } };
  }
  function S(co) { return co.modules && co.modules[ID]; }
  function includedIn(tier, id) { for (let t = 1; t <= tier; t++) if ((TIERS[t].includes || []).includes(id)) return true; return false; }
  function init(co) {
    co.modules = co.modules || {}; const d = defaults(); let st = co.modules[ID];
    if (!st || typeof st !== 'object' || Array.isArray(st)) st = co.modules[ID] = d;
    for (const k of Object.keys(d)) { if (st[k] === undefined || (st[k] === null && d[k] !== null)) st[k] = d[k]; }
    for (const k of ['broken', 'demand', 'prevUnits', 'month', 'b2b', 'fx', 'cool', 'researchWeek', 'flags', 'stats']) { if (!st[k] || typeof st[k] !== 'object' || Array.isArray(st[k])) st[k] = d[k]; else for (const kk of Object.keys(d[k])) if (st[k][kk] === undefined) st[k][kk] = d[k][kk]; }
    for (const k of ['equipment', 'history', 'months']) if (!Array.isArray(st[k])) st[k] = [];
    for (const k of Object.keys(d.stats)) if (typeof st.stats[k] !== 'number' || !isFinite(st.stats[k])) st.stats[k] = 0;
    for (const k of Object.keys(d.month)) if (typeof st.month[k] !== 'number' || !isFinite(st.month[k])) st.month[k] = 0;
    st.tier = U.clamp(Math.floor(+st.tier) || 0, 0, 4); st.used = !!st.used && st.tier === 2;
    if (!PROVBY[st.provider]) st.provider = 'lab_prats'; if (typeof st.providerSince !== 'number') st.providerSince = 0;
    st.equipment = st.equipment.filter((id, i, a) => EQBY[id] && a.indexOf(id) === i);
    for (let t = 1; t <= st.tier; t++) for (const e of (TIERS[t].includes || [])) if (!st.equipment.includes(e)) st.equipment.push(e);
    for (const id of Object.keys(st.broken)) if (!EQBY[id] || !(st.broken[id] > 0)) delete st.broken[id];
    if (!(st.stoppedUntil > 0)) st.stoppedUntil = 0; if (!(st.queue >= 0)) st.queue = 0;
    st.history = st.history.filter(h => h && typeof h === 'object').slice(-52);
    /* pseudo-investigaciones que desbloquean lentes (requisitos de DATA.PARTS): tier 3 y cámara de vacío */
    if (Array.isArray(co.researchCompleted)) { if (st.tier >= 3 && !co.researchCompleted.includes('lab_tier3')) co.researchCompleted.push('lab_tier3'); if (st.equipment.includes('camara_ar_pequena') && !co.researchCompleted.includes('lab_ar_propio')) co.researchCompleted.push('lab_ar_propio'); }
    /* colecciones ya en venta en partidas anteriores al módulo: no contar lo vendido antes */
    for (const g of (co.gameLog || [])) if (g && !g.soldOut && g.releaseWeek !== undefined && st.prevUnits[g.id] === undefined) st.prevUnits[g.id] = g.unitsSold || 0;
    if (!(st.ownShare >= 0 && st.ownShare <= 1)) st.ownShare = st.tier >= 1 ? OWN_MAX[st.tier] : 0;
    recompute(co, st);
  }

  /* =====================================================================
     4. CÁLCULO: personal, capacidad, defectos, márgenes, entrega
     ===================================================================== */
  function staffList(co) { return (co.staff || []).filter(s => s.assignment === ID); }
  function has(st, id) { return st.equipment.includes(id) && !st.broken[id]; }
  function owns(st, id) { return st.equipment.includes(id); }
  function countSkill(co, skill) { let n = 0; for (const s of staffList(co)) if (s.skills && s.skills[skill] && s.state !== 'vacation') n++; return n; }
  function staffUnits(co) {
    let u = 0;
    for (const s of staffList(co)) { const w = s.role === 'labtech' ? 1 : s.role === 'optico' ? 0.8 : s.role === 'tecnico' ? 0.7 : 0.4; const lvl = typeof s.level === 'function' ? s.level() : 1; let f = w * (0.7 + 0.1 * Math.min(lvl, 5)) * Math.max(0.5, s.efficiency || 1); if (s.skills && s.skills.montaje) f *= 1.1; if (s.state === 'vacation' || s.state === 'training') f *= 0.2; u += f; }
    return u;
  }
  function avgLevel(co) { const l = staffList(co); if (!l.length) return 0; return l.reduce((a, s) => a + (typeof s.level === 'function' ? s.level() : 1), 0) / l.length; }
  /* mix de lentes investigadas (DATA.PARTS categoría Lentes) → ticket / defectos / margen del laboratorio */
  function lensMix(co) {
    const m = { ticket: 0, def: 0, margin: 0, n: 0 };
    for (const id of Object.keys(LENS_FX)) { const p = DB.part(id); if (!p) continue; if (!(p.start || co.hasResearch(id))) continue; const fx = LENS_FX[id]; m.ticket += fx.ticket || 0; m.def += fx.def || 0; m.margin += fx.margin || 0; m.n++; }
    m.ticket *= MIX_K.ticket; m.def *= MIX_K.def; m.margin *= MIX_K.margin; return m;
  }
  const STEP_EQ = new Set(); for (const s of STEPS) if (s.eq) for (const id of Object.keys(s.eq)) STEP_EQ.add(id);
  /* puntos de defecto por paso con el equipo actual (para el panel y para ownDefect) */
  function stepPoints(st) {
    const out = []; let spill = 0;
    for (const s of STEPS) { let red = 0; if (s.eq) for (const id of Object.keys(s.eq)) if (has(st, id)) red += s.eq[id]; const used = Math.min(red, s.base); spill += (red - used) * 0.5; out.push({ n: s.n, name: s.name, who: s.who, err: s.err, base: s.base, now: s.base - used }); }
    return { steps: out, spill };
  }
  function ownDefect(co, st, mix) {
    const w = wk(co); const sp = stepPoints(st); let pts = sp.steps.reduce((a, s) => a + s.now, 0) - sp.spill;
    const gab = co.modules && co.modules.gabinete; if (gab && Array.isArray(gab.instruments) && gab.instruments.includes('centrado_digital')) pts -= 2;
    for (const id of st.equipment) { if (st.broken[id] || STEP_EQ.has(id)) continue; pts += EQBY[id].def || 0; }
    if (has(st, 'camara_ar_pequena') && st.fx.arLearnUntil > w) pts += 2;
    if (co.hasResearch('LabControlCalidad')) pts -= 2; if (co.hasResearch('LabTrazadoRemoto')) pts -= 1;
    pts -= 2 * Math.min(2, countSkill(co, 'montaje')); pts -= 1.5 * Math.min(2, countSkill(co, 'calidad_lab'));
    pts += (mix || lensMix(co)).def;
    const staff = staffList(co); const skillF = staff.length ? U.clamp(1.15 - 0.09 * Math.min(avgLevel(co), 6), 0.6, 1.15) : 1.25;
    pts = Math.max(1.5, pts) * skillF * TIERS[st.tier].defectK * DEF_K; if (st.used && st.tier === 2) pts += 1.5;
    return Math.round(pts * 100) / 10000;
  }
  function extDefect(co, st, p) {
    let d = 0.02 + (1 - p.quality) * 0.3; if (has(st, 'frontofocometro_digital')) d -= 0.01; if (has(st, 'software_pedidos_edi') || co.hasResearch('LabTrazadoRemoto')) d -= 0.005;
    return Math.round(Math.max(0.01, d) * 10000) / 10000;
  }
  function recompute(co, st) {
    const t = TIERS[st.tier]; const w = wk(co); const p = prov(st); const level = U.clamp(co.level || 1, 1, 4);
    /* personal */
    const units = staffUnits(co); st.staffUnits = Math.round(units * 100) / 100;
    const staffMin = st.tier >= 1 ? Math.max(1, t.staffMin - (has(st, 'automatizacion_mes') ? 1 : 0)) : 0; st.staffMin = staffMin;
    let sf = 0; if (st.tier >= 1) sf = units > 0 ? U.clamp(units / staffMin, 0.35, 1.4) : (st.tier === 1 ? 0.35 : 0.2); st.staffFactor = Math.round(sf * 100) / 100;
    /* capacidad */
    let cap = t.capacityDay; for (const id of st.equipment) { if (includedIn(st.tier, id) || st.broken[id]) continue; cap += EQBY[id].cap || 0; }
    if (st.used && st.tier === 2) cap *= USED_TIER2.capMult; if (st.tier >= 3) cap *= 1 + 0.1 * Math.min(3, countSkill(co, 'freeform'));
    const coreDown = st.equipment.some(id => st.broken[id] && EQBY[id].core); const stopped = st.stoppedUntil > w;
    st.capacityBase = Math.round(cap); st.capacityDay = stopped ? 0 : Math.round(cap * sf * (coreDown ? 0.3 : 1)); st.capacityWeek = Math.round(st.capacityDay * DAYS_WEEK);
    /* defectos */
    const mix = lensMix(co); st.ownDefect = ownDefect(co, st, mix); st.extDefect = extDefect(co, st, p);
    /* ticket, tarifa y márgenes */
    st.ticket = Math.round(TICKET_BASE[level] + mix.ticket + (has(st, 'software_lds') ? EQBY.software_lds.ticket : 0) + (st.fx.antivahoUntil > w && co.hasResearch('antivaho') ? 8 : 0));
    let fee = t.fee; for (const id of st.equipment) if (!st.broken[id] && !includedIn(st.tier, id)) fee += EQBY[id].fee || 0; if (co.hasResearch('LabExpress')) fee += 8; st.feeJob = fee;
    let lm = t.margin; for (const id of st.equipment) if (!st.broken[id] && !includedIn(st.tier, id)) lm += EQBY[id].margin || 0; lm += mix.margin; if (co.hasResearch('LabMarcaPropia')) lm += 0.04; st.lensMargin = Math.round(U.clamp(lm, 0, 0.4) * 1000) / 1000;
    const loyal = w - (st.providerSince || 0) >= 24; let em = p.extMargin + (loyal ? (p.loyalty || 0) : 0) - (st.fx.tariffUntil > w ? st.fx.tariff : 0); st.marginExt = Math.round((em + mix.margin * 0.5) * 1000) / 1000;
    st.marginOwn = Math.round((st.lensMargin + (st.tier <= 2 ? em : 0)) * 1000) / 1000;
    /* entrega */
    let pd = p.days + (st.fx.strikeUntil > w ? st.fx.strikeDays : 0); if (has(st, 'software_pedidos_edi')) pd += EQBY.software_pedidos_edi.extDays; if (co.hasResearch('LabTrazadoRemoto')) pd -= 1; st.provDays = Math.max(1, Math.round(pd * 10) / 10);
    let od = t.days + [0, 0.6, 0.5, 0, 0][st.tier] * Math.max(0, st.provDays - 2); for (const id of st.equipment) if (!st.broken[id]) od += EQBY[id].days || 0; if (co.hasResearch('LabExpress')) od -= 0.1; st.ownDays = Math.max(0.1, Math.round(od * 10) / 10);
    const os = st.tier >= 1 && !stopped ? U.clamp(st.ownShare, 0, OWN_MAX[st.tier]) : 0;
    st.deliveryDays = Math.round((os * st.ownDays + (1 - os) * st.provDays) * 10) / 10;
    st.extShare = Math.round((st.tier >= 3 ? 1 - os : 1 - 0.4 * os) * 100) / 100;
    st.defectRate = Math.round((os * st.ownDefect + (1 - os) * st.extDefect + (st.fx.lotUntil > w ? st.fx.lotExtra : 0)) * 10000) / 10000;
  }
  function monthlyCost(co) {
    const st = S(co); if (!st) return 0; const t = TIERS[st.tier]; let c = t.monthly; if (st.used && st.tier === 2) c = Math.round(c * 1.5);
    for (const id of st.equipment) { if (includedIn(st.tier, id)) continue; c += EQBY[id].maint || 0; }
    return c;
  }

  /* =====================================================================
     5. GANCHOS DEL NÚCLEO
     ===================================================================== */
  function isLensGame(g) { return !!(g && (LENS_GENRES[g.genre] || LENS_GENRES[g.secondGenre])); }
  function genreFactor(g) { return Math.max(LENS_GENRES[g.genre] || 0, LENS_GENRES[g.secondGenre] || 0); }
  function channelShare(g) { const ps = (g.platforms || []).map(DB.platform).filter(Boolean); if (!ps.length) return COLL_SHARE_OTHER; let s = 0; for (const p of ps) s += p.isOwn ? COLL_SHARE_OWN : COLL_SHARE_OTHER; return s / ps.length; }
  const RX_GENRES = ['graduado', 'lectura', 'infantil'];
  function isRx(g) { return RX_GENRES.includes(g.genre) || RX_GENRES.includes(g.secondGenre); }
  /* nota: ×(1 − defectos/2), +3 % con tallado propio (tier ≥3), proveedor premium en Premium, marca propia en graduado */
  function scoreFactor(co, g) {
    const st = S(co); if (!st || !g) return 1; let f = 1; const p = prov(st);
    if (isRx(g)) { f *= 1 - st.defectRate / 2; if (st.tier >= 3) f *= 1.03; if (co.hasResearch('LabMarcaPropia')) f *= 1.01; if (st.stoppedUntil > wk(co)) f *= 0.98; }
    if ((g.genre === 'premium' || g.secondGenre === 'premium') && st.tier < 3 && p.premium) f *= 1 + p.premium;
    return U.clamp(f, 0.8, 1.2);
  }
  /* ventas de graduado según el plazo de entrega (lentes.md §5): ≤1 día ×1,08 · ≤4 ×1 · ≤10 ×0,94 · más ×0,88 */
  function salesFactor(co, g) {
    const st = S(co); if (!st || !g || !isRx(g)) return 1; const d = st.deliveryDays;
    return d <= 1 ? 1.08 : d <= 4 ? 1 : d <= 10 ? 0.94 : 0.88;
  }
  function onCreateGame(co, g) {
    const st = S(co); if (!st || !g || !isLensGame(g)) return; const p = prov(st);
    if (isRx(g) && p.hype && st.tier < 3) { g.hypePoints += p.hype; G.log(`Las marcas de lentes de nuestro proveedor (${p.name}) en el escaparate dan +${p.hype} de expectación a ${g.title}.`); }
    if (isRx(g) && co.hasResearch('LabMarcaPropia')) { g.hypePoints += 10; G.log(`Nuestra marca de lentes propia suma +10 de expectación a ${g.title}.`); }
    if (st.tier >= 1) G.log(`Laboratorio: ${TIERS[st.tier].short}, entrega media ${st.deliveryDays} días, remontajes ${pct1(st.defectRate)}.`);
  }
  function onRelease(co, g) { const st = S(co); if (!st || !g || !isLensGame(g)) return; if (st.prevUnits[g.id] === undefined) st.prevUnits[g.id] = 0; }
  function onResearch(co, item) {
    const st = S(co); if (!st || !item) return; st.researchWeek[item.id] = wk(co);
    if (item.id === 'LabTerceros') { st.b2b.active = true; notify('Laboratorio para terceros', 'Ya podemos vender lentes talladas y tratadas a otras ópticas. La venta a terceros usa la capacidad que nos sobra cada mes; actívala o párala desde el panel del laboratorio.', 'news'); }
    if (item.id === 'LabMarcaPropia') G.log('Las lentes salen grabadas con nuestra marca: +4 puntos de margen y las colecciones graduadas ganan expectación.');
    recompute(co, st);
  }
  function onTraining(co, ch, tr) { const st = S(co); if (!st || !tr) return; recompute(co, st); if (['montaje', 'calidad_lab', 'freeform'].includes(tr.skill) && ch && ch.assignment === ID) G.log(`${ch.name} aplica lo aprendido en el laboratorio: ${TRAINING.find(x => x.id === tr.id) ? TRAINING.find(x => x.id === tr.id).lab : 'mejora el taller'}.`); }
  function onAssign(co, ch, dept) { const st = S(co); if (!st) return; recompute(co, st); if (dept === ID && st.tier === 0 && ch) G.log(`${ch.name} está en el laboratorio… pero no hay laboratorio. Monta el taller de biselado desde el panel del departamento.`); }

  /* ---------- semana ---------- */
  function activeGames(co) { return (co.gameLog || []).filter(g => g && !g.soldOut && g.releaseWeek !== undefined); }
  function weekly(co, w) {
    const st = S(co); if (!st) return; recompute(co, st); const t = TIERS[st.tier]; const p = prov(st); const level = U.clamp(co.level || 1, 1, 4);
    /* 1. demanda: mostrador + colecciones con lentes + gabinete + cola */
    const mk = (co.modules && co.modules.marketing) || {}; const traffic = U.clamp(+mk.traffic || 0, 0, 0.6), brand = U.clamp(+mk.brand || 0, 0, 100);
    const walk = WALKIN_BASE[level] * (1 + traffic) * (1 + brand / 400) * (0.9 + 0.2 * U.rnd()) * (st.fx.antivahoUntil > w ? 1.05 : 1) * (st.fx.pvpUntil > w ? 0.96 : 1);
    let coll = 0; const seen = {};
    for (const g of activeGames(co)) { const prev = st.prevUnits[g.id] || 0; const delta = Math.max(0, (g.unitsSold || 0) - prev); st.prevUnits[g.id] = g.unitsSold || 0; seen[g.id] = true; const gf = genreFactor(g); if (gf && delta) coll += delta * gf * channelShare(g); }
    for (const id of Object.keys(st.prevUnits)) if (!seen[id]) delete st.prevUnits[id];
    coll = Math.min(coll, COLL_CAP_MULT * WALKIN_BASE[level]);
    const gab = (co.modules && co.modules.gabinete && +co.modules.gabinete.convertedWeek) || 0;
    const demand = walk + coll + gab + st.queue;
    /* 2. propio vs externo (montaje remoto) con cola de una semana */
    const ownMax = OWN_MAX[st.tier]; const wantOwn = demand * ownMax; const own = st.tier >= 1 ? Math.min(wantOwn, st.capacityWeek) : 0;
    const overflow = Math.max(0, wantOwn - own); const q = st.tier >= 1 ? Math.min(overflow * 0.5, st.capacityWeek * 0.5) : 0; const ext = Math.max(0, demand - own - q);
    /* 3. defectos y remontajes */
    const lot = st.fx.lotUntil > w ? st.fx.lotExtra : 0; const ownRem = own * (st.ownDefect + lot), extRem = ext * (st.extDefect + lot);
    const remakeCost = ownRem * REMAKE_OWN[st.tier] * (co.hasResearch('LabGarantiaAdaptacion') ? 0.75 : 1) + extRem * REMAKE_EXT;
    /* 4. ingresos: margen que aporta el laboratorio (la venta de la lente en sí es de la tienda) */
    const income = own * (st.feeJob + st.ticket * st.marginOwn) + ext * st.ticket * st.marginExt;
    const inc = Math.round(income), cost = Math.round(remakeCost);
    if (inc) co.adjustCash(inc, 'Laboratorio de lentes'); if (cost) co.adjustCash(-cost, 'Remontajes');
    /* 5. estado, historial y estadísticas */
    const jobs = own + ext; st.jobsWeek = Math.round(jobs); st.ownJobs = Math.round(own); st.extJobs = Math.round(ext); st.queue = Math.round(q); st.remakesWeek = Math.round(ownRem + extRem); st.incomeWeek = inc; st.costWeek = cost;
    st.ownShare = jobs > 0 ? Math.round(own / jobs * 1000) / 1000 : (st.tier >= 1 ? ownMax : 0); st.busy = st.capacityWeek > 0 ? Math.round(U.clamp(own / st.capacityWeek, 0, 1) * 100) / 100 : 0;
    st.demand = { walk: Math.round(walk), coll: Math.round(coll), gab: Math.round(gab) };
    st.history.push({ w, jobs: st.jobsWeek, own: st.ownJobs, ext: st.extJobs, rem: st.remakesWeek, inc, cost, cap: st.capacityWeek, q: st.queue }); if (st.history.length > 52) st.history.shift();
    const m = st.month; m.jobs += st.jobsWeek; m.own += st.ownJobs; m.ext += st.extJobs; m.remakes += st.remakesWeek; m.income += inc; m.cost += cost; m.extSpend += ext * st.ticket * 0.4 * p.coef;
    const s = st.stats; s.jobs += st.jobsWeek; s.own += st.ownJobs; s.ext += st.extJobs; s.remakes += st.remakesWeek; s.remakeCost += cost; s.income += inc;
    /* 6. caducidades */
    if (st.stoppedUntil && st.stoppedUntil <= w) { st.stoppedUntil = 0; G.log('El laboratorio vuelve a funcionar.'); }
    for (const id of Object.keys(st.broken)) { st.broken[id]--; if (st.broken[id] <= 0) { delete st.broken[id]; G.log(`${shortName(id)} reparado.`); } }
    if (st.fx.lotUntil && st.fx.lotUntil <= w && st.fx.lotExtra) st.fx.lotExtra = 0;
    /* 7. eventos: dos oportunidades al mes + noticias con fecha */
    if (w % 4 === 1 || w % 4 === 3) checkEvents(co, st, w);
    if (!st.flags.antivahoShown && w >= weekOf('26/3/1')) { st.flags.antivahoShown = true; if (w < weekOf('26/9/1')) { st.fx.antivahoUntil = w + 48; notify('Mascarillas y vaho', 'Con las mascarillas, media España va con las gafas empañadas. Se dispara la demanda de tratamientos antivaho durante un año.' + (co.hasResearch('antivaho') ? ' Nuestro antivaho permanente se vende solo: +8 € de ticket.' : ' Investiga el antivaho permanente para aprovecharlo.'), 'news'); } }
    /* 8. avisos útiles una sola vez */
    if (st.tier >= 2 && !staffList(co).length && !st.flags.warnedStaff) { st.flags.warnedStaff = true; notify('Laboratorio sin técnico', 'El taller de biselado está montado pero no hay nadie asignado: rinde al 20 %. Asigna un técnico de laboratorio u óptico desde su ficha (menú Personal → Detalles → Destino: Laboratorio).'); }
    if (st.tier >= 1 && !st.flags.warnedCap && st.queue > 0 && overflow > st.capacityWeek * 0.5) { st.flags.warnedCap = true; G.log('Laboratorio: hay más trabajos de los que biselamos; parte se manda a telebiselar con el plazo del proveedor. Amplía el taller o asigna más personal.'); }
    recompute(co, st);
  }
  function shortName(id) { const e = EQBY[id]; return e ? e.name.split(' (')[0].split(':')[0] : id; }

  /* ---------- mes ---------- */
  function monthly(co) {
    const st = S(co); if (!st) return; const w = wk(co); const p = prov(st); recompute(co, st);
    /* averías aleatorias de equipos (contrato de mantenimiento −75 %, maquinaria de segunda mano ×2,5) */
    const fm = (has(st, 'contrato_mantenimiento') ? EQBY.contrato_mantenimiento.failMult : 1) * (st.used && st.tier === 2 ? USED_TIER2.failMult : 1);
    for (const id of st.equipment) { const e = EQBY[id]; if (!e.fail || st.broken[id]) continue; if (U.rnd() < e.fail * fm) { st.broken[id] = e.core ? 1 : 2; const cost = Math.max(300, Math.round(e.cost * 0.05)); co.adjustCash(-cost, 'Avería ' + shortName(id)); st.stats.repairs += cost; notify('Avería', `${shortName(id)} se ha averiado: ${money(cost)} de recambios y ${st.broken[id]} semana${st.broken[id] > 1 ? 's' : ''} de reparación${e.core ? ' (capacidad al 30 % mientras tanto)' : ''}.`, 'news'); } }
    /* central de compra: compromiso mensual */
    if (p.commit) { if (st.month.extSpend < p.commit) { co.adjustCash(-p.penalty, 'Penalización central de compra'); st.stats.penalties += p.penalty; G.log(`Central de compra: solo ${money(st.month.extSpend)} de lentes externas este mes (mínimo ${money(p.commit)}). Penalización de ${money(p.penalty)}.`); } }
    /* fidelidad al proveedor */
    if (p.loyalty && !st.loyalNotified && w - st.providerSince >= 24) { st.loyalNotified = true; notify('Descuento por volumen', `Nuestro proveedor (${p.name}) premia medio año de fidelidad con un ${(p.loyalty * 100).toFixed(1)} % de descuento adicional en lentes.`, 'news'); }
    /* venta a terceros (B2B): laboratorio para otras ópticas (tier 4) */
    let b2bInc = 0; const b = st.b2b;
    if (st.tier >= 4 && b.active && co.hasResearch('LabTerceros')) {
      const hist = st.history.slice(-4); const ownDay = hist.length ? hist.reduce((a, h) => a + h.own, 0) / hist.length / DAYS_WEEK : 0;
      const spare = Math.max(0, st.capacityDay - ownDay); const iso = co.hasResearch('LabCertificacionISO');
      b.demandDay = Math.round(B2B.base * (iso ? B2B.isoDemand : 1) + (b.contractUntil > w ? b.contractJobs : 0));
      b.jobsDay = Math.round(Math.min(spare * B2B.spare, b.demandDay));
      const um = B2B.margin + (iso ? B2B.isoMargin : 0) + (has(st, 'coater_industrial') ? 1 : 0) + (has(st, 'inspeccion_automatica') ? 1 : 0);
      const contractPart = b.contractUntil > w ? Math.min(b.jobsDay, b.contractJobs) : 0;
      b2bInc = Math.round(contractPart * B2B.days * (um - 2) + (b.jobsDay - contractPart) * B2B.days * um);
      if (b2bInc > 0) { co.adjustCash(b2bInc, 'Laboratorio para terceros'); st.stats.b2b += b2bInc; st.month.b2b += b2bInc; }
      b.incomeMonth = b2bInc; if (b.contractUntil && b.contractUntil <= w) { b.contractUntil = 0; b.contractJobs = 0; G.log('El contrato de laboratorio con ' + (b.client || 'la cadena') + ' ha terminado.'); }
    } else { b.jobsDay = 0; b.incomeMonth = 0; }
    /* cierre del mes */
    const m = st.month; st.months.push({ w, jobs: m.jobs, own: m.own, ext: m.ext, remakes: m.remakes, income: m.income, cost: m.cost, b2b: m.b2b, maint: monthlyCost(co) }); if (st.months.length > 24) st.months.shift();
    if (st.tier >= 1 && m.jobs > 0) G.log(`Laboratorio: ${U.num(m.jobs)} trabajos este mes (${pct(m.jobs ? m.own / m.jobs : 0)} en casa), ${U.num(m.remakes)} remontajes, margen ${money(m.income - m.cost)}${b2bInc ? ', venta a terceros ' + money(b2bInc) : ''}, mantenimiento ${money(monthlyCost(co))}.`);
    st.month = { jobs: 0, own: 0, ext: 0, remakes: 0, income: 0, cost: 0, b2b: 0, extSpend: 0 };
    recompute(co, st);
  }

  /* =====================================================================
     6. EVENTOS Y DECISIONES
     ===================================================================== */
  function checkEvents(co, st, w) {
    for (const ev of EVENTS) { if ((st.cool[ev.id] || 0) > w) continue; if (U.rnd() >= ev.pYear / 24) continue; let ok = false; try { ok = ev.cond(co, st, w); } catch (e) { console.error('lab event', ev.id, e); } if (!ok) continue; st.cool[ev.id] = w + 24; ev.fire(co, st, w); return ev.id; }
    return null;
  }
  function fireEvent(co, id) { const st = S(co); const ev = EVBY[id]; if (!ev || !st) return false; const before = co.notifications.length; ev.fire(co, st, wk(co)); return co.notifications.length > before; }
  function onDecision(co, sourceId, choice, n) {
    const st = S(co); if (!st || !sourceId || sourceId.indexOf('lab:') !== 0) return; n = n || {}; const w = wk(co);
    switch (sourceId) {
      case 'lab:tarifas': { const hike = n.hike || 0.06; const lossTxt = (hike * 40).toFixed(1);
        if (choice === 0) { st.fx.tariff = Math.round(hike * 400) / 1000; st.fx.tariffUntil = w + 48; G.log(`Absorbemos la subida sin tocar precios: −${lossTxt} puntos de margen en lentes externas durante un año.`); }
        else if (choice === 1) { const pOk = st.provider === 'central_compra' ? 0.85 : 0.5; if (U.rnd() < pOk) { st.fx.tariffUntil = w + 24; st.fx.tariff = 0; G.log('El grupo de compra negocia por todos: comprometemos más volumen y el rappel se mantiene. La subida se queda en el cajón.'); } else { st.fx.tariff = Math.round(hike * 400) / 1000; st.fx.tariffUntil = w + 48; st.providerSince = w; st.loyalNotified = false; G.log('El comercial no se inmuta: la subida sigue adelante y perdemos el descuento por fidelidad.'); } }
        else if (choice === 2) { st.fx.tariff = 0; st.fx.tariffUntil = w + 48; st.fx.pvpUntil = w + 48; G.log('Subimos el precio de las lentes en la misma proporción: mantenemos el margen, pero algún presupuesto se queda sin cerrar (−4 % de clientes de mostrador durante un año).'); }
        else { if (st.provider !== 'lab_asia') setProvider(co, st, 'lab_asia'); st.fx.tariff = 0; st.fx.tariffUntil = w + 48; G.log('Nos pasamos al laboratorio low-cost: lentes más baratas, dos semanas de espera y más inadaptaciones.'); }
        recompute(co, st); break; }
      case 'lab:huelga': if (choice === 0) { co.adjustCash(-(n.cost || 500), 'Mensajería urgente'); G.log('Las lentes llegan por mensajería urgente: plazo intacto.'); } else { st.fx.strikeUntil = w + 3; st.fx.strikeDays = 3; G.log('Tres semanas con tres días más de espera en cada pedido.'); } break;
      case 'lab:averia': { const cost = n.cost || 1100; st.fx.downUntil = w + 24;
        if (choice === 0) { co.adjustCash(-cost, 'Servicio técnico del laboratorio'); st.stats.repairs += cost; st.stoppedUntil = w + 1; G.log('Servicio técnico oficial: una semana mandando a telebiselar, sin retrasos para el cliente.'); }
        else if (n.contract) { st.stoppedUntil = w + 2; G.log('El técnico del contrato viene en dos semanas; mientras tanto, todo fuera.'); }
        else { const c2 = Math.round(cost * 0.35); co.adjustCash(-c2, 'Recambio usado del laboratorio'); st.stats.repairs += c2; st.stoppedUntil = w + 2; const lost = Math.floor((co.fans || 0) * 0.003); if (lost) co.adjustFans(-lost); G.log(`Recambio de segunda mano: dos semanas con el taller parado, gafas que se retrasan y algún pedido cancelado (−${U.num(lost)} clientes fieles).`); }
        recompute(co, st); break; }
      case 'lab:lote': st.fx.lotUntil = w + 4;
        if (choice === 0) { st.fx.lotExtra = 0; st.fx.strikeUntil = Math.max(st.fx.strikeUntil || 0, w + 4); st.fx.strikeDays = 2; G.log(n.blame ? 'Garantía de fabricación: el proveedor repone las lentes sin coste y el taller rehace los montajes (dos días más de espera durante un mes).' : 'Lote devuelto: dos días más de espera durante un mes.'); }
        else { st.fx.lotExtra = 0.08; if (n.blame) { const lost = Math.floor((co.fans || 0) * 0.01); if (lost) co.adjustFans(-lost); G.log(`Le echamos la culpa al sol del salpicadero: la mitad paga media lente y la otra mitad no vuelve (−${U.num(lost)} clientes fieles), y el lote sigue dando guerra este mes.`); } else G.log('Tallamos el lote: este mes volverán más gafas de la cuenta.'); }
        recompute(co, st); break;
      case 'lab:montura_cliente': st.flags.descargo = true;
        if (n.signed) { if (choice === 0) { co.adjustCash(45, 'Montura nueva con descuento'); G.log('El cliente acepta una montura nueva con el 35 % de descuento: +45 € de margen y sin malas caras.'); } else { co.adjustCash(120, 'Montura nueva a precio de venta'); const lost = Math.floor((co.fans || 0) * 0.003); if (lost) co.adjustFans(-lost); G.log(`Le cobramos la montura entera: tenía razón el descargo, pero no vuelve (−${U.num(lost)} clientes fieles).`); } }
        else if (choice === 0) { co.adjustCash(-15, 'Montura de cortesía'); const f = Math.floor((co.fans || 0) * 0.002 + 20); co.adjustFans(f); G.log(`Le regalamos una montura de la casa y sale encantado (+${U.num(f)} clientes fieles). Desde hoy, descargo firmado antes de calentar monturas viejas.`); }
        else { const lost = Math.floor((co.fans || 0) * 0.01); if (lost) co.adjustFans(-lost); G.log(`Hoja de reclamaciones y arbitraje de consumo por una montura de quince años (−${U.num(lost)} clientes fieles). Desde hoy, descargo firmado antes de calentar monturas viejas.`); }
        break;
      case 'lab:b2b_contrato': if (choice === 0) { st.b2b.contractUntil = w + 48; st.b2b.contractJobs = n.n || 150; st.b2b.client = n.client || 'la cadena'; G.log(`Contrato firmado: +${n.n || 150} trabajos/día para ${n.client || 'la cadena'} durante un año.`); } else G.log('Rechazamos el contrato de laboratorio.'); break;
      default: break;
    }
  }

  /* =====================================================================
     7. ACCIONES DEL PANEL (compras con requisitos)
     ===================================================================== */
  function staffReq(tier) { return [0, 0, 1, 2, 3][tier] || 0; }
  function canUpgrade(co, st, used) {
    const nx = TIERS[st.tier + 1]; if (!nx) return { ok: false, msg: 'Ya tienes el laboratorio más grande posible.' };
    if (used && nx.tier !== 2) return { ok: false, msg: 'Solo hay maquinaria de segunda mano para el taller de biselado 3D.' };
    if (co.level < nx.level) return { ok: false, msg: `Necesitas ${C.LEVELS[nx.level].name}.` };
    const need = staffReq(nx.tier); const have = staffList(co).length; if (have < need) return { ok: false, msg: `Necesitas ${need} persona${need > 1 ? 's' : ''} asignada${need > 1 ? 's' : ''} al laboratorio (técnico de laboratorio u óptico); hay ${have}.` };
    const capex = used ? USED_TIER2.capex : nx.capex; if (co.cash < capex) return { ok: false, msg: `Faltan ${money(capex - co.cash)}.` };
    return { ok: true };
  }
  function upgrade(co, st, used) {
    const c = canUpgrade(co, st, used); if (!c.ok) return c; const nx = TIERS[st.tier + 1]; const capex = used ? USED_TIER2.capex : nx.capex;
    co.adjustCash(-capex, 'Laboratorio: ' + nx.name + (used ? ' (usado)' : '')); st.tier = nx.tier; st.used = !!used && nx.tier === 2; st.stats.upgrades++;
    for (const e of (nx.includes || [])) if (!st.equipment.includes(e)) st.equipment.push(e);
    if (nx.tier >= 3 && !co.researchCompleted.includes('lab_tier3')) co.researchCompleted.push('lab_tier3');
    st.ownShare = OWN_MAX[st.tier]; recompute(co, st);
    const txt = { 1: 'Biseladora automática de ocasión, frontofocómetro, ventilete y banco de taller en la trastienda. Los monofocales de stock se biselan y montan en el día; asigna a alguien al laboratorio (o asígnate tú) para que rinda.', 2: used ? 'Biseladora robotizada de segunda mano con su trazador y bloqueador: funciona, pero se avería más que una nueva y rinde un 80 %. Cuando haya caja, renueva la maquinaria.' : 'Biseladora 3D robotizada con taladro, trazador 3D y centrador-bloqueador. Monofocales en una hora, ranurado para nylon, al aire y bisel escalonado. Sin técnico asignado rinde al 20 %.', 3: 'El minilab está en marcha: tallamos a partir de bloques semiterminados nuestros propios progresivos y recetas especiales en menos de 24 horas, y las tarifas de los laboratorios ya no nos quitan el sueño. Se desbloquean los semiterminados propios y la marca de lentes.', 4: 'Laboratorio industrial: línea automatizada de generadores, lacado en línea y cámara de alto vacío para el antirreflejante. Cientos de trabajos al día; investiga "Laboratorio para terceros" para vender lentes a otras ópticas.' }[nx.tier];
    notify(nx.name, txt); return { ok: true, msg: 'Laboratorio ampliado' };
  }
  function renew(co, st) {
    if (!st.used) return { ok: false, msg: 'La maquinaria ya es nueva.' }; const cost = TIERS[2].capex - USED_TIER2.capex; if (co.cash < cost) return { ok: false, msg: `Faltan ${money(cost - co.cash)}.` };
    co.adjustCash(-cost, 'Renovación de la biseladora'); st.used = false; recompute(co, st); G.log('Biseladora y trazador nuevos: capacidad al 100 % y muchas menos averías.'); return { ok: true, msg: 'Maquinaria renovada' };
  }
  function eqPrice(st, e) { const p = prov(st); let c = e.cost; if (p.eqDiscount && /biseladora|trazador/.test(e.id)) c = Math.round(c * (1 - p.eqDiscount)); return c; }
  function reqText(co, st, r) {
    if (!r) return null; const miss = [];
    if (r.level && co.level < r.level) miss.push(C.LEVELS[r.level].name);
    if (r.equipo && !owns(st, r.equipo)) miss.push('tener ' + shortName(r.equipo));
    if (r.research && !co.hasResearch(r.research)) { const it = DB.item(r.research); miss.push('investigar "' + (it ? it.name : r.research) + '"'); }
    return miss.length ? 'Requiere ' + miss.join(', ') : null;
  }
  function canBuy(co, st, e) {
    if (owns(st, e.id)) return { ok: false, msg: 'Ya lo tienes.' }; if (st.tier < e.tier) return { ok: false, msg: `Requiere ${TIERS[e.tier].name}.` };
    const r = reqText(co, st, e.req); if (r) return { ok: false, msg: r + '.' }; const price = eqPrice(st, e); if (co.cash < price) return { ok: false, msg: `Faltan ${money(price - co.cash)}.` }; return { ok: true };
  }
  function buy(co, st, id) {
    const e = EQBY[id]; if (!e) return { ok: false, msg: 'Equipo desconocido' }; const c = canBuy(co, st, e); if (!c.ok) return c; const price = eqPrice(st, e);
    if (price) co.adjustCash(-price, 'Laboratorio: ' + shortName(id)); st.equipment.push(id);
    if (e.flag && !co.researchCompleted.includes(e.flag)) co.researchCompleted.push(e.flag);
    if (id === 'camara_ar_pequena') st.fx.arLearnUntil = wk(co) + 24;
    recompute(co, st); G.log(`Laboratorio: ${shortName(id)} instalado.`); return { ok: true, msg: price ? 'Comprado' : 'Contratado' };
  }
  function repair(co, st, id) {
    if (!st.broken[id]) return { ok: false, msg: 'No está averiado.' }; const e = EQBY[id]; const cost = Math.max(200, Math.round(e.cost * 0.03)); if (co.cash < cost) return { ok: false, msg: `Faltan ${money(cost - co.cash)}.` };
    co.adjustCash(-cost, 'Reparación exprés ' + shortName(id)); st.stats.repairs += cost; delete st.broken[id]; recompute(co, st); return { ok: true, msg: 'Reparado' };
  }
  function canProvider(co, st, p) {
    if (!p) return { ok: false, msg: 'Proveedor desconocido.' }; if (st.provider === p.id) return { ok: false, msg: 'Ya es tu proveedor.' };
    if (p.level && co.level < p.level) return { ok: false, msg: `Requiere ${C.LEVELS[p.level].name}.` }; return { ok: true };
  }
  function setProvider(co, st, id) {
    const p = PROVBY[id]; const c = canProvider(co, st, p); if (!c.ok) return c; st.provider = id; st.providerSince = wk(co); st.loyalNotified = false; st.fx.tariffUntil = 0; st.fx.tariff = 0; recompute(co, st);
    G.log(`Nuevo laboratorio externo: ${p.name} (plazo ${p.days} días, calidad ${Math.round(p.quality * 100)} %).`); return { ok: true, msg: 'Proveedor: ' + p.name };
  }
  function startResearch(co, st, id) {
    const it = DB.research(id); if (!it) return { ok: false, msg: 'Investigación desconocida.' }; if (co.hasResearch(id)) return { ok: false, msg: 'Ya investigado.' };
    if (!co.researchEnabled) return { ok: false, msg: 'La investigación se desbloquea tras la primera colección.' }; if (it.req && !it.req(co)) return { ok: false, msg: 'Todavía no está disponible.' };
    const staff = co.staff.find(s => s.isIdle()); if (!staff) return { ok: false, msg: 'Nadie está libre para investigar.' };
    if (co.researchPoints < (it.pointsCost || 0)) return { ok: false, msg: `Faltan ${it.pointsCost - co.researchPoints} puntos de investigación.` }; if (co.cash < (it.cost || 0)) return { ok: false, msg: `Faltan ${money(it.cost - co.cash)}.` };
    if (!co.availableResearch.includes(id)) co.availableResearch.push(id); if (!G.startResearch(id, staff)) return { ok: false, msg: 'No se ha podido iniciar.' }; return { ok: true, msg: `${staff.name} investiga "${it.name}"` };
  }
  function toggleB2B(co, st) {
    if (st.tier < 4) return { ok: false, msg: 'Requiere el laboratorio industrial.' }; if (!co.hasResearch('LabTerceros')) return { ok: false, msg: 'Investiga "Laboratorio para terceros".' };
    st.b2b.active = !st.b2b.active; if (!st.b2b.active) { st.b2b.jobsDay = 0; } return { ok: true, msg: st.b2b.active ? 'Venta a terceros activada' : 'Venta a terceros parada' };
  }
  function action(co, act, id, value) {
    const st = S(co); if (!st) return { ok: false, msg: 'Sin estado' };
    switch (act) {
      case 'upgrade': return upgrade(co, st, false);
      case 'upgrade_used': return upgrade(co, st, true);
      case 'renew': return renew(co, st);
      case 'buy': return buy(co, st, id);
      case 'repair': return repair(co, st, id);
      case 'provider': return setProvider(co, st, id || value);
      case 'research': return startResearch(co, st, id);
      case 'b2b': return toggleB2B(co, st);
    }
    return { ok: false, msg: 'Acción desconocida' };
  }

  /* =====================================================================
     8. PANEL DEL DEPARTAMENTO
     ===================================================================== */
  function injectCss() {
    try {
      if (typeof document === 'undefined' || !document.head || (document.getElementById && document.getElementById('css-lab'))) return;
      const s = document.createElement('style'); s.id = 'css-lab';
      s.textContent = `.dept-lab .dl-top{display:grid;grid-template-columns:1.4fr 1fr;gap:10px}.dept-lab .dl-box{background:#fff;border:1px solid #d6c9b3;border-radius:8px;padding:8px 10px}.dept-lab .dl-kv{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;margin:6px 0}.dept-lab .dl-kv b{font-size:13px}.dept-lab .dl-chart{display:flex;align-items:flex-end;gap:4px;height:74px;padding:4px 6px;background:#fff;border:1px solid #d6c9b3;border-radius:8px}.dept-lab .dl-col{flex:1;display:flex;align-items:flex-end;gap:1px;height:100%;position:relative}.dept-lab .dl-col i{flex:1;border-radius:2px 2px 0 0;min-height:2px}.dept-lab .dl-col i.own{background:#2980b9}.dept-lab .dl-col i.ext{background:#c9b996}.dept-lab .dl-col i.cap{background:#27ae60;opacity:.45}.dept-lab .dl-col i.inc{background:#e67e22}.dept-lab .dl-col span{position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:9px;color:#777}.dept-lab .dl-leg{font-size:11px;color:#6b5f55;margin:16px 0 4px}.dept-lab .dl-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin:0 3px 0 8px}.dept-lab .dl-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.dept-lab .dl-chip{background:#dff0fb;border:1px solid #2980b9;border-radius:12px;padding:2px 8px;font-size:11.5px}.dept-lab .dl-chip.off{background:#f3dede;border-color:#c0392b}.dept-lab .dl-chip.inc{background:#e9f7ef;border-color:#27ae60}.dept-lab .dl-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0 4px}.dept-lab .dl-tabs button{background:#ece4d4;border:1px solid #d6c9b3;border-radius:6px 6px 0 0;padding:5px 10px;cursor:pointer;font-size:12.5px;font-weight:600}.dept-lab .dl-tabs button.on{background:#fff;border-bottom-color:#fff}.dept-lab .dl-sec{display:none}.dept-lab .dl-sec.on{display:block}.dept-lab .tbl td small{display:block;color:#777;font-size:11px}.dept-lab .ok{color:#229710;font-weight:700}.dept-lab .bad{color:#c0392b}.dept-lab .dl-mini{font-size:11.5px;color:#6b5f55}.dept-lab .dl-steps{display:grid;grid-template-columns:repeat(auto-fill,minmax(230px,1fr));gap:5px;margin:6px 0}.dept-lab .dl-step{background:#fff;border:1px solid #e0d6c3;border-radius:8px;padding:5px 8px;font-size:11.5px}.dept-lab .dl-step b{display:block;font-size:12px}.dept-lab .dl-step .bar{height:6px;margin-top:4px}.dept-lab .dl-step .bar div{background:#c0392b}.dept-lab .dl-step.good .bar div{background:#27ae60}.dept-lab .dl-prov{display:grid;grid-template-columns:repeat(auto-fill,minmax(260px,1fr));gap:6px}.dept-lab .dl-prov .sel{align-items:stretch}.dept-lab .dl-prov .sel .row{justify-content:space-between;width:100%}`;
      document.head.appendChild(s);
    } catch (e) { /* sin DOM */ }
  }
  let uiTab = 'flow';
  function ui(co) {
    injectCss(); const st = S(co); if (!st) return { body: '<div class="sub">Sin estado del laboratorio.</div>', bind() {} }; recompute(co, st); const w = wk(co); const t = TIERS[st.tier]; const nx = TIERS[st.tier + 1]; const p = prov(st);
    const up = canUpgrade(co, st, false); const upUsed = nx && nx.tier === 2 ? canUpgrade(co, st, true) : null; const staff = staffList(co); const monthly = monthlyCost(co); const stopped = st.stoppedUntil > w;
    let h = `<div class="dl-top"><div class="dl-box"><b>${st.tier ? `Nivel ${st.tier} · ` : ""}${esc(t.name)}${st.used ? ' (segunda mano)' : ''}</b><div class="sub">${esc(t.desc)}</div>
      <div class="dl-kv"><span>Capacidad <b>${U.num(st.capacityDay)} trabajos/día</b> <span class="dl-mini">(${U.num(st.capacityWeek)}/sem · base ${U.num(st.capacityBase)} × personal ${st.staffFactor.toFixed(2)})</span></span><span>Entrega media <b>${st.deliveryDays} días</b> <span class="dl-mini">(propia ${st.ownDays} · proveedor ${st.provDays})</span></span><span>Remontajes <b class="${st.defectRate > 0.05 ? 'bad' : st.defectRate < 0.03 ? 'ok' : ''}">${pct1(st.defectRate)}</b> <span class="dl-mini">(${st.tier >= 1 ? 'propios ' + pct1(st.ownDefect) + ' · ' : ''}externos ${pct1(st.extDefect)})</span></span><span>Margen extra en lentes <b>+${(st.lensMargin * 100).toFixed(1)} pts</b></span><span>Ticket de lentes <b>${money(st.ticket)}</b></span><span>Coste mensual <b>${money(monthly)}</b></span>${stopped ? `<span class="bad">⛔ Laboratorio parado ${st.stoppedUntil - w} sem.</span>` : ''}</div>
      ${nx ? `<div class="row"><button class="btn small primary" data-act="upgrade" ${up.ok ? '' : 'disabled'}>Ampliar: ${esc(nx.name)} (${money(nx.capex)})</button><span class="dl-mini">${up.ok ? `${U.num(nx.capacityDay)} trabajos/día, entrega ${nx.days} d, +${Math.round(nx.margin * 100)} pts de margen, ${money(nx.monthly)}/mes, ${nx.staffMin} técnico${nx.staffMin > 1 ? 's' : ''}` : esc(up.msg)}</span></div>` : '<div class="sub ok">Laboratorio al máximo.</div>'}
      ${upUsed ? `<div class="row"><button class="btn small" data-act="upgrade_used" ${upUsed.ok ? '' : 'disabled'}>${esc(TIERS[2].name)} de segunda mano (${money(USED_TIER2.capex)})</button><span class="dl-mini">${upUsed.ok ? 'Capacidad al 80 %, averías ×2,5 y +1,5 puntos de defectos; se puede renovar después.' : esc(upUsed.msg)}</span></div>` : ''}
      ${st.used ? `<div class="row"><button class="btn small" data-act="renew" ${co.cash >= TIERS[2].capex - USED_TIER2.capex ? '' : 'disabled'}>Renovar maquinaria (${money(TIERS[2].capex - USED_TIER2.capex)})</button><span class="dl-mini">Vuelve al 100 % de capacidad y a las averías normales.</span></div>` : ''}
      </div><div class="dl-box"><b>Laboratorio externo: ${esc(p.name)}</b> <span class="dl-mini">${esc(p.brands)}</span>
      <div class="dl-kv"><span>Plazo <b>${p.days} d</b></span><span>Calidad <b>${Math.round(p.quality * 100)} %</b></span><span>Coste <b>×${p.coef.toFixed(2)}</b></span><span>Margen externo <b>${(st.marginExt * 100).toFixed(1)} pts</b></span>${w - st.providerSince >= 24 && p.loyalty ? '<span class="ok">fidelidad ✔</span>' : p.loyalty ? `<span class="dl-mini">fidelidad en ${Math.max(0, 24 - (w - st.providerSince))} sem.</span>` : ''}${st.fx.tariffUntil > w ? `<span class="bad">tarifas +${(st.fx.tariff * 100).toFixed(1)} pts ${st.fx.tariffUntil - w} sem.</span>` : ''}${st.fx.strikeUntil > w ? `<span class="bad">+${st.fx.strikeDays} días (transporte) ${st.fx.strikeUntil - w} sem.</span>` : ''}${st.fx.lotUntil > w && st.fx.lotExtra ? `<span class="bad">lote defectuoso ${st.fx.lotUntil - w} sem.</span>` : ''}</div>
      <div class="dl-mini">${st.tier >= 3 ? 'Con tallado propio solo dependes del proveedor para lo que no fabricas en casa.' : 'Cambia de proveedor en la pestaña «Laboratorios externos».'}</div>
      <b style="display:block;margin-top:8px">Personal del laboratorio</b> <span class="dl-mini">(${staff.length} asignados · mínimo ${st.staffMin} · factor ${st.staffFactor.toFixed(2)})</span>
      ${staff.length ? `<div class="dl-chips">${staff.map(s => `<span class="dl-chip ${s.state === 'vacation' ? 'off' : ''}">${esc(s.name)} · ${esc(s.roleInfo().short)} nv. ${s.level()}${s.skills && s.skills.montaje ? ' · montaje' : ''}${s.skills && s.skills.calidad_lab ? ' · calidad' : ''}${s.skills && s.skills.freeform ? ' · freeform' : ''}</span>`).join('')}</div>` : `<div class="sub">${st.tier >= 2 ? '<span class="bad">Sin técnicos el laboratorio rinde al 20 %.</span>' : st.tier === 1 ? 'Nadie asignado: el taller rinde al 35 %.' : 'Nadie asignado.'} Asigna personal desde su ficha (menú Personal → Detalles → Destino: Laboratorio). Rol afín: técnico/a de laboratorio; también sirven ópticos y técnicos de taller.</div>`}
      </div></div>`;
    const tabs = [['flow', 'Flujo de trabajo'], ['eq', 'Equipos'], ['lens', 'Lentes'], ['res', 'Investigación y formación'], ['prov', 'Laboratorios externos'], ['cost', 'Costes y niveles']]; if (st.tier >= 4 || co.hasResearch('LabTerceros')) tabs.push(['b2b', 'Laboratorio para terceros']);
    if (!tabs.some(x => x[0] === uiTab)) uiTab = 'flow';
    h += `<div class="dl-tabs">${tabs.map(x => `<button data-tab="${x[0]}" class="${uiTab === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>`;
    h += `<div class="dl-sec ${uiTab === 'flow' ? 'on' : ''}" data-sec="flow">${uiFlow(co, st, w)}</div>`;
    h += `<div class="dl-sec ${uiTab === 'eq' ? 'on' : ''}" data-sec="eq">${uiEq(co, st)}</div>`;
    h += `<div class="dl-sec ${uiTab === 'lens' ? 'on' : ''}" data-sec="lens">${uiLens(co, st)}</div>`;
    h += `<div class="dl-sec ${uiTab === 'res' ? 'on' : ''}" data-sec="res">${uiRes(co, st)}</div>`;
    h += `<div class="dl-sec ${uiTab === 'prov' ? 'on' : ''}" data-sec="prov">${uiProv(co, st, w)}</div>`;
    h += `<div class="dl-sec ${uiTab === 'cost' ? 'on' : ''}" data-sec="cost">${uiCost(co, st, monthly)}</div>`;
    if (tabs.some(x => x[0] === 'b2b')) h += `<div class="dl-sec ${uiTab === 'b2b' ? 'on' : ''}" data-sec="b2b">${uiB2B(co, st, w)}</div>`;
    return {
      body: h,
      bind(el, refresh) {
        if (!el || !el.querySelectorAll) return; refresh = typeof refresh === 'function' ? refresh : () => {};
        el.querySelectorAll('button[data-tab]').forEach(b => b.addEventListener('click', () => { uiTab = b.dataset.tab; el.querySelectorAll('button[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === uiTab)); el.querySelectorAll('.dl-sec').forEach(x => x.classList.toggle('on', x.dataset.sec === uiTab)); }));
        el.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => { const r = action(co, b.dataset.act, b.dataset.id); if (r && r.msg) toast(r.msg); if (typeof G !== 'undefined' && G.emit) G.emit('refresh'); refresh(); }));
        el.querySelectorAll('select[data-sel]').forEach(s => s.addEventListener('change', () => { const r = action(co, s.dataset.sel, null, s.value); if (r && r.msg) toast(r.msg); refresh(); }));
      }
    };
  }
  function chart(rows, keys, mx, tip) {
    return `<div class="dl-chart">${rows.length ? rows.map(x => `<div class="dl-col" title="${esc(tip(x))}">${keys.map(k => `<i class="${k}" style="height:${Math.max(2, 100 * (x[k] || 0) / mx)}%"></i>`).join('')}<span>${x.w % 48 ? x.w % 48 : 48}</span></div>`).join('') : '<div class="sub">Sin datos todavía.</div>'}</div>`;
  }
  function uiFlow(co, st, w) {
    const d = st.demand || { walk: 0, coll: 0, gab: 0 }; const gabMod = !!(co.modules && co.modules.gabinete); const net = st.incomeWeek - st.costWeek;
    let h = `<table class="tbl"><tr><th>Esta semana</th><th>Trabajos</th><th>Detalle</th></tr>
      <tr><td>Mostrador</td><td>${U.num(d.walk)}</td><td><small>clientes de la tienda que traen receta o montura (nivel ${co.level}${co.modules && co.modules.marketing ? ', con tráfico de marketing' : ''})</small></td></tr>
      <tr><td>Colecciones con lentes</td><td>${U.num(d.coll)}</td><td><small>graduado ×1 · infantil ×1 · lectura ×0,8 · premium ×0,5 · deportiva ×0,3 · sol ×0,15; canal propio ${Math.round(COLL_SHARE_OWN * 100)} %, otros ${Math.round(COLL_SHARE_OTHER * 100)} %</small></td></tr>
      <tr><td>Gabinete</td><td>${U.num(d.gab)}</td><td><small>${gabMod ? 'pacientes que compran gafa graduada (convertidos)' : 'sin módulo de gabinete'}</small></td></tr>
      <tr><td><b>Biselados y montados en casa</b></td><td><b>${U.num(st.ownJobs)}</b></td><td><small>capacidad ${U.num(st.capacityWeek)}/sem · tope ${Math.round(OWN_MAX[st.tier] * 100)} % de los trabajos en este nivel · ocupación ${pct(st.busy)}</small></td></tr>
      <tr><td>Enviados al laboratorio</td><td>${U.num(st.extJobs)}</td><td><small>lente biselada por ${esc(prov(st).name)} (telebiselado) · ${st.provDays} días</small></td></tr>
      <tr><td>En cola</td><td>${U.num(st.queue)}</td><td><small>esperan a la semana que viene</small></td></tr>
      <tr><td>Remontajes</td><td>${U.num(st.remakesWeek)}</td><td><small>${money(REMAKE_OWN[st.tier])} cada uno propio, ${money(REMAKE_EXT)} externo${co.hasResearch('LabGarantiaAdaptacion') ? ' · garantía de adaptación −25 %' : ''} → ${money(st.costWeek)}</small></td></tr>
      <tr><td><b>Margen del laboratorio</b></td><td><b class="${net >= 0 ? 'ok' : 'bad'}">${money(net)}</b></td><td><small>propio: ${money(st.feeJob)} de servicio + ${money(st.ticket)} × ${(st.marginOwn * 100).toFixed(1)} pts por trabajo · externo: ${money(st.ticket)} × ${(st.marginExt * 100).toFixed(1)} pts</small></td></tr></table>`;
    const hist = st.history.slice(-24); const mx = Math.max(1, ...hist.map(x => Math.max(x.own + x.ext, x.cap || 0)));
    h += `<h4>Últimas ${hist.length || 24} semanas · trabajos</h4>` + chart(hist.map(x => ({ w: x.w, own: x.own, ext: x.ext, cap: x.cap })), ['own', 'ext', 'cap'], mx, x => `Semana ${x.w}: ${U.num(x.own)} en casa, ${U.num(x.ext)} fuera, capacidad ${U.num(x.cap || 0)}`) + `<div class="dl-leg"><i style="background:#2980b9"></i>biselados en casa <i style="background:#c9b996"></i>biselados fuera <i style="background:#27ae60;opacity:.45"></i>capacidad propia</div>`;
    const mxI = Math.max(1, ...hist.map(x => x.inc)); h += `<h4>Margen semanal</h4>` + chart(hist.map(x => ({ w: x.w, inc: x.inc, cost: x.cost })), ['inc'], mxI, x => `Semana ${x.w}: ${money(x.inc)} de margen, ${money(x.cost)} en remontajes`) + `<div class="dl-leg"><i style="background:#e67e22"></i>margen del laboratorio (antes de remontajes)</div>`;
    const tot = hist.reduce((s, x) => s + x.jobs, 0), own = hist.reduce((s, x) => s + x.own, 0), inc = hist.reduce((s, x) => s + x.inc - x.cost, 0);
    h += `<div class="sub">En las últimas ${hist.length} semanas: ${U.num(tot)} trabajos, ${U.num(own)} montados en casa (${tot ? pct(own / tot) : '—'}), margen neto ${money(inc)}. Historial de 52 semanas guardado; acumulado ${U.num(st.stats.jobs)} trabajos y ${money(st.stats.income - st.stats.remakeCost)}.</div>`;
    const sp = stepPoints(st); h += `<h4>Los 12 pasos de una gafa (puntos de defecto)</h4><div class="dl-steps">${sp.steps.map(s => `<div class="dl-step ${s.now <= s.base / 2 ? 'good' : ''}" title="${esc(s.err)}"><b>${s.n}. ${esc(s.name)}</b>${esc(s.who)} · ${s.now.toFixed(1)} / ${s.base} pts<div class="bar"><div style="width:${Math.round(100 * s.now / s.base)}%"></div></div></div>`).join('')}</div><div class="dl-mini">Suma ${sp.steps.reduce((a, s) => a + s.now, 0).toFixed(1)} pts − ${sp.spill.toFixed(1)} de control extra; × pericia del personal (nivel y cursos) × ${TIERS[st.tier].defectK} del nivel × ${DEF_K} = ${pct1(st.ownDefect)} de remontajes propios. Los pasos del óptico mejoran con el centrado digital del gabinete; los defectos de fabricación de la lente entran por la recepción (5) y el control final (10).</div>`;
    return h;
  }
  function uiEq(co, st) {
    const owned = EQ.filter(e => owns(st, e.id)); const avail = EQ.filter(e => !owns(st, e.id) && e.tier <= Math.min(4, st.tier + 1));
    let h = `<div class="dl-chips">${owned.length ? owned.map(e => `<span class="dl-chip ${st.broken[e.id] ? 'off' : (includedIn(st.tier, e.id) ? 'inc' : '')}" title="${esc(e.desc)}">${esc(shortName(e.id))}${st.broken[e.id] ? ' · averiado ' + st.broken[e.id] + ' sem.' : ''}${e.maint && !includedIn(st.tier, e.id) ? ' · ' + money(e.maint) + '/mes' : ''}</span>`).join('') : '<span class="sub">Sin equipos. Monta el taller de biselado básico para empezar.</span>'}</div>`;
    const broken = owned.filter(e => st.broken[e.id]); if (broken.length) { h += '<h4>Averiados</h4>'; for (const e of broken) h += `<div class="ritem"><div><b>${esc(shortName(e.id))}</b><small>${st.broken[e.id]} semana${st.broken[e.id] > 1 ? 's' : ''} de reparación${e.core ? ' · capacidad al 30 %' : ''}</small></div><div class="rcost">${money(Math.max(200, Math.round(e.cost * 0.03)))}</div><button class="btn small" data-act="repair" data-id="${e.id}" ${co.cash >= Math.max(200, Math.round(e.cost * 0.03)) ? '' : 'disabled'}>Reparar ya</button></div>`; }
    h += '<h4>Disponibles</h4>';
    const fx = e => { const f = []; if (e.cap) f.push(`+${e.cap} trabajos/día`); if (e.def) f.push(`${e.def > 0 ? '+' : ''}${e.def} pts defectos`); if (e.margin) f.push(`+${(e.margin * 100).toFixed(1)} pts margen`); if (e.days) f.push(`${e.days} días propios`); if (e.extDays) f.push(`${e.extDays > 0 ? '+' : ''}${e.extDays} ${Math.abs(e.extDays) === 1 ? 'día' : 'días'} de plazo externo`); if (e.fee) f.push(`+${e.fee} €/trabajo`); if (e.ticket) f.push(`+${e.ticket} € ticket`); if (e.fail) f.push(`avería ${Math.round(e.fail * 100)} %/mes`); if (e.failMult) f.push('averías −75 %'); if (e.staffSave) f.push('−1 técnico mínimo'); return f.join(' · '); };
    for (const e of avail) { const c = canBuy(co, st, e); const price = eqPrice(st, e); h += `<div class="ritem ${c.ok ? '' : 'off'}"><div><b>${esc(e.name)}</b> <small class="tag">nivel ${e.tier}</small>${e.brands ? `<small>${esc(e.brands)}</small>` : ''}<small>${esc(e.desc)}</small><small>${fx(e)}</small>${c.ok ? '' : `<small class="bad">${esc(c.msg)}</small>`}</div><div class="rcost">${price ? money(price) : 'sin inversión'}${price !== e.cost ? `<br><small>−${Math.round((prov(st).eqDiscount || 0) * 100)} % proveedor</small>` : ''}<br><small>${e.maint ? money(e.maint) + '/mes' : 'sin mantenimiento'}</small></div><button class="btn small primary" data-act="buy" data-id="${e.id}" ${c.ok ? '' : 'disabled'}>${e.cost ? 'Comprar' : 'Contratar'}</button></div>`; }
    if (!avail.length) h += '<div class="sub">Tienes todo el equipo de este nivel.</div>';
    return h;
  }
  function uiLens(co, st) {
    const mix = lensMix(co); const parts = DATA.PARTS.filter(x => x.category === 'Lentes');
    let h = `<div class="sub">Materiales, tratamientos y diseños de lente son tecnologías de la fase "Lentes y tratamientos" (menú Investigar, con Taller propio). Cada una investigada entra en el mix del laboratorio: ${mix.n} activas → ticket +${Math.round(mix.ticket)} €, defectos ${mix.def >= 0 ? '+' : ''}${mix.def.toFixed(1)} pts, margen +${(mix.margin * 100).toFixed(1)} pts.</div><table class="tbl"><tr><th>Lente</th><th>Nivel</th><th>Estado</th><th>Efecto en el laboratorio</th><th>Requisitos</th></tr>`;
    const reqOf = p => { const r = p.req || {}; const out = []; if (r.missionLevel) out.push(`Lentes nivel ${r.missionLevel[1] + 1}`); if (r.featureLevel) { const fp = DB.part(r.featureLevel[0]); out.push(`${fp ? fp.name : r.featureLevel[0]} nivel ${r.featureLevel[1] + 1}`); } if (r.date) out.push(`año ${r.date.split('/')[0]}`); if (r.research === 'lab_tier3') out.push('minilab de tallado freeform'); else if (r.research === 'lab_ar_propio') out.push('cámara de vacío propia'); else if (r.research && r.research !== 'CustomEngine') { const it = DB.item(r.research); out.push(it ? it.name : r.research); } return out.join(', ') || '—'; };
    for (const p of parts) { const fx = LENS_FX[p.id] || {}; const done = p.start || co.hasResearch(p.id); const avail = co.availableResearch.includes(p.id); const st8 = done ? '<span class="ok">✔ investigada</span>' : avail ? 'disponible para investigar' : '<small>pendiente de requisitos</small>'; const eff = [fx.ticket ? `ticket ${fx.ticket > 0 ? '+' : ''}${fx.ticket} €` : '', fx.def ? `defectos ${fx.def > 0 ? '+' : ''}${fx.def} pts` : '', fx.margin ? `margen +${(fx.margin * 100).toFixed(1)} pts` : ''].filter(Boolean).join(' · ') || 'neutra'; h += `<tr><td><b>${esc(p.name)}</b>${p.group ? `<small>${p.group === 'lente' ? 'material' : 'diseño'} (excluyente)</small>` : ''}</td><td>${p.v}</td><td>${st8}</td><td><small>${eff}</small></td><td><small>${esc(reqOf(p))}</small></td></tr>`; }
    return h + '</table>';
  }
  function uiRes(co, st) {
    const idle = co.staff.some(s => s.isIdle()); let h = '<div class="sub">Investigaciones propias del laboratorio (categoría Laboratorio). Se pueden lanzar desde aquí o desde el menú Investigar.</div>';
    for (const r of RESEARCH) { const done = co.hasResearch(r.id); const avail = r.req(co) && co.researchEnabled; const can = !done && avail && idle && co.researchPoints >= r.pointsCost && co.cash >= r.cost; const busy = co.staff.some(s => s.currentResearch && s.currentResearch.id === r.id); h += `<div class="ritem ${done || can ? '' : 'off'}"><div><b>${esc(r.name)}</b> ${done ? '<small class="tag">✔ hecho</small>' : busy ? '<small class="tag">en curso</small>' : ''}<small>${esc(r.desc)}</small>${!done && !avail ? '<small class="bad">Todavía no disponible (nivel del laboratorio, del local o investigación previa).</small>' : ''}</div><div class="rcost">🔬 ${r.pointsCost}${r.cost ? ' · ' + U.shortMoney(r.cost) : ''}<br><small>${(r.duration / WEEK_MS).toFixed(1)} sem.</small></div>${done ? '<span class="ok">✔</span>' : `<button class="btn small" data-act="research" data-id="${r.id}" ${can && !busy ? '' : 'disabled'} title="${!avail ? 'Todavía no disponible' : !idle ? 'Nadie libre' : ''}">Investigar</button>`}</div>`; }
    h += '<h4>Formación técnica recomendada</h4><div class="sub">Los cursos se hacen desde la ficha de cada empleado (menú Personal → Detalles → Formación). Certificaciones que cuentan en el laboratorio:</div>';
    for (const tr of TRAINING) { const who = staffList(co).filter(s => s.skills && s.skills[tr.skill]).map(s => s.name); h += `<div class="ritem"><div><b>${esc(tr.name)}</b><small>${esc(tr.lab)}</small><small>${who.length ? '<span class="ok">✔ ' + esc(who.join(', ')) + '</span>' : 'nadie del laboratorio lo tiene todavía'}</small></div><div class="rcost">${money(tr.cost)}<br><small>🔬 ${tr.pointsCost} · nivel ${tr.level}+</small></div><div class="dl-mini">${(tr.duration / WEEK_MS).toFixed(1)} sem.</div></div>`; }
    return h;
  }
  function uiProv(co, st, w) {
    let h = `<div class="sub">El laboratorio externo fabrica la lente (o la saca de su stock) y, si no biselamos en casa, nos la manda biselada y lista para montar. Elige por plazo (conversión del gabinete y ventas de graduado), calidad (remontajes) y coste (margen). Cambiar de proveedor reinicia la fidelidad. ${st.tier >= 3 ? 'Con tallado propio solo afecta a lo que no fabricas en casa y los eventos de proveedor ya no te tocan.' : 'Las subidas de tarifas, las huelgas y los lotes defectuosos dependen de él hasta que talles en casa.'}</div><div class="dl-prov">`;
    for (const p of PROVIDERS) { const cur = st.provider === p.id; const c = canProvider(co, st, p); const traits = []; if (p.loyalty) traits.push(`fidelidad +${(p.loyalty * 100).toFixed(1)} pts a las 24 sem.`); if (p.hype) traits.push(`+${p.hype} expectación en graduado`); if (p.premium) traits.push(`+${Math.round(p.premium * 100)} % nota Premium`); if (p.eqDiscount) traits.push(`−${Math.round(p.eqDiscount * 100)} % en biseladoras/trazadores`); if (p.lotRisk) traits.push('riesgo de lotes defectuosos'); if (p.commit) traits.push(`compromiso ${money(p.commit)}/mes (penalización ${money(p.penalty)})`); h += `<div class="sel ${cur ? 'on' : ''} ${!cur && !c.ok ? 'lock' : ''}"><div class="row"><span>${esc(p.name)}${cur ? ' <small>(actual)</small>' : ''}</span><span>${cur ? '' : `<button class="btn small" data-act="provider" data-id="${p.id}" ${c.ok ? '' : 'disabled'}>Elegir</button>`}</span></div><small>${esc(p.brands)}</small><small>Plazo ${p.days} días · calidad ${Math.round(p.quality * 100)} % · coste ×${p.coef.toFixed(2)} · margen ${p.extMargin >= 0 ? '+' : ''}${(p.extMargin * 100).toFixed(1)} pts</small><small>${esc(p.desc)}</small>${traits.length ? `<small>${esc(traits.join(' · '))}</small>` : ''}${!cur && !c.ok ? `<small class="bad">${esc(c.msg)}</small>` : ''}</div>`; }
    h += '</div>';
    const tiersAhead = st.tier < 3 ? `<div class="note">Entrega estimada en el gabinete: ${st.deliveryDays} días (bonus de conversión +10 pts con ≤1 día, +5 con ≤3). Ventas de graduado: ${salesFactor(co, { genre: 'graduado' }) >= 1.08 ? '+8 %' : salesFactor(co, { genre: 'graduado' }) >= 1 ? 'neutras' : '−' + Math.round((1 - salesFactor(co, { genre: 'graduado' })) * 100) + ' %'} por el plazo.</div>` : '';
    return h + tiersAhead;
  }
  function uiCost(co, st, monthly) {
    const t = TIERS[st.tier]; const rows = [];
    if (t.monthly) rows.push([`Mantenimiento: ${t.name}${st.used ? ' (segunda mano ×1,5)' : ''}`, st.used && st.tier === 2 ? Math.round(t.monthly * 1.5) : t.monthly]);
    for (const id of st.equipment) { if (includedIn(st.tier, id)) continue; const e = EQBY[id]; if (e.maint) rows.push([shortName(id), e.maint]); }
    let h = `<table class="tbl"><tr><th>Concepto</th><th>€/mes</th></tr>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${money(r[1])}</td></tr>`).join('')}<tr><td><b>Total fijo</b></td><td><b>${money(monthly)}</b></td></tr></table>`;
    const ms = st.months.slice(-12); if (ms.length) { const avg = k => ms.reduce((a, x) => a + (x[k] || 0), 0) / ms.length; h += `<div class="sub">Media de los últimos ${ms.length} meses: ${U.num(avg('jobs'))} trabajos, margen ${money(avg('income'))}, remontajes ${money(avg('cost'))}${avg('b2b') ? ', venta a terceros ' + money(avg('b2b')) : ''}, mantenimiento ${money(avg('maint'))} → neto ${money(avg('income') - avg('cost') + avg('b2b') - avg('maint'))}/mes.</div>`; }
    h += `<div class="sub">Acumulado: reparaciones ${money(st.stats.repairs)} · remontajes ${money(st.stats.remakeCost)} · penalizaciones ${money(st.stats.penalties)} · ampliaciones ${st.stats.upgrades} · venta a terceros ${money(st.stats.b2b)}.</div>`;
    h += `<h4>Niveles del laboratorio</h4><table class="tbl"><tr><th>Nivel</th><th>Inversión</th><th>Mantenimiento</th><th>Capacidad</th><th>Entrega propia</th><th>Margen</th><th>Técnicos</th><th>Requisito</th></tr>${TIERS.slice(1).map(x => `<tr class="${x.tier === st.tier ? 'on' : ''}"><td>${x.tier === st.tier ? '▶ ' : ''}${esc(x.name)}</td><td>${money(x.capex)}${x.tier === 2 ? `<small>usado ${money(USED_TIER2.capex)}</small>` : ''}</td><td>${money(x.monthly)}/mes</td><td>${U.num(x.capacityDay)}/día</td><td>${x.days} d</td><td>+${Math.round(x.margin * 100)} pts, ${money(x.fee)}/trabajo</td><td>${x.staffMin}</td><td><small>${C.LEVELS[x.level].name}${staffReq(x.tier) ? ` · ${staffReq(x.tier)} asignado${staffReq(x.tier) > 1 ? 's' : ''}` : ''}</small></td></tr>`).join('')}</table>`;
    return h;
  }
  function uiB2B(co, st, w) {
    const b = st.b2b; const ok = st.tier >= 4 && co.hasResearch('LabTerceros'); const iso = co.hasResearch('LabCertificacionISO');
    let h = `<div class="sub">Vendemos lentes talladas a otras ópticas con la capacidad que sobra cada mes: trabajos/día × ${B2B.days} días × margen unitario (${money(B2B.margin)}${iso ? ' +' + B2B.isoMargin + ' ISO' : ''}${has(st, 'coater_industrial') ? ' +1 vacío propio' : ''}${has(st, 'inspeccion_automatica') ? ' +1 inspección' : ''}). Demanda base ${B2B.base} trabajos/día${iso ? ' ×1,5 con ISO 13485' : ' (×1,5 con ISO 13485)'}, más los contratos que firmes.</div>`;
    h += `<div class="row"><button class="btn small ${b.active ? 'danger' : 'primary'}" data-act="b2b" ${ok ? '' : 'disabled'}>${b.active ? 'Dejar de vender a otras ópticas' : 'Vender a otras ópticas'}</button><span class="dl-mini">${ok ? (b.active ? 'activo' : 'parado') : st.tier < 4 ? 'Requiere el laboratorio industrial.' : 'Investiga "Laboratorio para terceros".'}</span></div>`;
    h += `<div class="dl-kv"><span>Último mes <b>${U.num(b.jobsDay)} trabajos/día</b></span><span>Demanda <b>${U.num(b.demandDay)}/día</b></span><span>Ingreso <b>${money(b.incomeMonth)}</b></span>${b.contractUntil > w ? `<span>Contrato con ${esc(b.client)}: +${b.contractJobs}/día, ${b.contractUntil - w} sem.</span>` : '<span class="dl-mini">sin contrato fijo (llegan ofertas al azar)</span>'}</div>`;
    const ms = st.months.slice(-12).filter(x => x.b2b); if (ms.length) h += `<h4>Últimos meses</h4>` + chart(ms.map(x => ({ w: x.w, inc: x.b2b })), ['inc'], Math.max(1, ...ms.map(x => x.b2b)), x => `${money(x.inc)}`) + '<div class="dl-leg"><i style="background:#e67e22"></i>ingreso mensual por venta a terceros</div>';
    return h;
  }

  /* =====================================================================
     9. ESCENA, INFORME Y REGISTRO
     ===================================================================== */
  function sceneInfo(co) { const st = S(co); if (!st) return { tier: 0, machines: [], busy: 0 }; return { tier: st.tier, machines: st.equipment.filter(id => !st.broken[id]).slice(0, 10), busy: st.busy || 0, stopped: st.stoppedUntil > wk(co), staff: staffList(co).length, owned: st.equipment.slice() /* render.js: todo el equipo comprado */ }; }
  function report(co) {
    const st = S(co); if (!st) return []; const hist = st.history.slice(-4); const jobs = hist.reduce((s, x) => s + x.jobs, 0), own = hist.reduce((s, x) => s + x.own, 0), net = hist.reduce((s, x) => s + x.inc - x.cost, 0);
    return [{ label: 'Trabajos (mes)', value: `${U.num(jobs)} (${U.num(own)} en casa)` }, { label: 'Margen del laboratorio (mes)', value: money(net + (st.b2b.incomeMonth || 0)) }, { label: 'Laboratorio', value: TIERS[st.tier].name }, { label: 'Entrega media', value: st.deliveryDays + ' días' }, { label: 'Remontajes', value: pct1(st.defectRate) }, { label: 'Coste mensual', value: money(monthlyCost(co)) }];
  }

  Modules.register({
    id: ID, name: 'Laboratorio de lentes', icon: '🧪', order: 30,
    init, weekly, monthly, monthlyCost, salesFactor, scoreFactor,
    onCreateGame, onRelease, onResearch, onTraining, onAssign, onDecision, ui, sceneInfo, report,
    /* API interna para pruebas y para otros módulos (no forma parte del contrato) */
    api: { TIERS, EQ, STEPS, PROVIDERS, LENS_FX, NEW_PARTS, RESEARCH, TRAINING, EVENTS, USED_TIER2, OWN_MAX, WALKIN_BASE, TICKET_BASE, B2B, state: S, recompute, action, fireEvent, checkEvents, staffUnits, lensMix, stepPoints, ownDefect, extDefect, canUpgrade, canBuy, monthlyCost }
  });
})();
