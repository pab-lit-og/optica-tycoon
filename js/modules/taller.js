/* Óptica Tycoon — módulo Taller de monturas (id 'taller', order 40).
   Cómo se fabrican físicamente las colecciones: tiers de taller, 35 equipos, 22 materiales
   (DATA.PARTS categoría Materiales), fabricación externa con pedido mínimo (MOQ) y plazo, normativa y tendencias
   (DATA.RESEARCH categoría Taller), formación técnica (DATA.TRAINING), personal asignado,
   11 eventos de riesgo con decisión (+ molde y stock muerto) y ferias (solo si no existe el módulo marketing).
   Fuentes: docs/research/monturas.data.json, monturas.md y RESULTADO_DEPARTAMENTOS_OFICIO.md (sección 5,
   tablas ESCALONES/EQUIPOS EQ_MON_*, PUESTOS PUE_06-07 y EVENTOS EVT_MON_*). Script clásico: todo dentro de una IIFE.
   Estado persistente en co.modules.taller (JSON plano). Ganchos: ver Modules.register al final.
   Escala: los precios de equipos son € de juego, del orden de 1–3 veces el precio real de mercado (el taller del juego
   llega más lejos que una óptica real: los tiers 3 y 4 son fábricas). Se respeta la proporción entre equipos del informe. */
(function () {
  'use strict';
  const ID = 'taller';
  const esc = s => (typeof UI !== 'undefined' && UI.esc) ? UI.esc(s) : String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const toast = m => { if (typeof UI !== 'undefined' && UI.toast) UI.toast(m); };
  const money = n => U.money(n);
  const wk = co => Math.floor(co.currentWeek);
  const pct = v => Math.round(100 * v) + ' %';

  /* =====================================================================
     1. CATÁLOGO (podado y adaptado de monturas.data.json; € de juego)
     ===================================================================== */
  const TIERS = [
    { tier: 0, name: 'Sin taller propio', short: 'Proveedor genérico', capex: 0, maint: 0, cap: 0, qmax: 0.75, tech: 0, dur: 1, level: 1, desc: 'Las monturas se compran a distribuidores y fábricas de catálogo, con pedido mínimo por marca (24–60 piezas): coste unitario ×1,4, sin control de calidad y con un tope de unidades por semana según el tamaño del local.' },
    { tier: 1, name: 'Atelier artesanal', short: 'Atelier', capex: 10000, maint: 350, cap: 30, qmax: 0.85, tech: 1, dur: 1.3, level: 1, includes: ['kit_manual', 'stock_planchas'], desc: 'Banco de artesano con sierra de marquetería, limas y fresas de galce, ventilete y planchas de acetato compradas sin mínimos. Se recortan frente y varillas, se inserta el alma metálica, se remachan las charnelas y se pule con bombo y mopa. 15–40 monturas a la semana hechas a mano: lentas, pero con alma.' },
    { tier: 2, name: 'Taller CNC profesional', short: 'Taller CNC', capex: 180000, maint: 2500, cap: 250, qmax: 0.92, tech: 3, dur: 1, level: 2, research: 'CustomEngine', includes: ['cnc_optica_3ejes'], desc: 'Centro de fresado CNC de 3 ejes para frentes y varillas. Base para el tren de bombos octogonales, la prensa de bombeado, la insertadora de charnelas, el láser de marcaje y la cabina de pulido. 120–300 monturas a la semana con 2–4 operarios.' },
    { tier: 3, name: 'Fábrica mediana', short: 'Fábrica', capex: 2200000, maint: 15000, cap: 2500, qmax: 0.97, tech: 5, dur: 0.85, level: 3, includes: ['cnc_multihusillo'], desc: 'Fila de centros CNC de 4–5 ejes con cambio automático de herramienta. Permite inyectora, línea de metal, soldadura láser en argón, galvánica y PVD, laboratorio de color y laboratorio de ensayos. 1.500–3.000 monturas a la semana.' },
    { tier: 4, name: 'Manufactura industrial', short: 'Manufactura', capex: 9000000, maint: 40000, cap: 20000, qmax: 1, tech: 7, dur: 0.75, level: 4, includes: ['manifattura'], desc: 'Planta industrial completa, al estilo de los grandes distritos del Véneto: todas las fases bajo un mismo techo, cientos de operarios y sello de origen propio. Calidad máxima y capacidad para cualquier colección insignia.' }
  ];
  const PROVIDER_CAP = [0, 600, 1500, 5000, 15000]; // monturas/semana que sirve el proveedor genérico según nivel de local

  /* Equipos (35). cap = monturas/semana extra; q = bono de puntuación (scoreFactor); maint = €/mes;
     req: { level, research, equipo, date } (date = año del juego = año real − 1994); fail = probabilidad mensual de avería;
     only = grupos de material a los que aplica q. Referencias reales (informe, EQ_MON_*): fresadora horizontal manual
     1,3–3,2 k€; tren de bombos 2,8–6,5 k€; soldadora láser compacta 3,3–6,8 k€; CNC 3 ejes de sobremesa 14–26 k€;
     CNC 5 ejes 55–110 k€; SLS 28–65 k€; inyectora 38–85 k€ (+ moldes 2,5–6 k€); láser de fibra CNC + PVD 45–115 k€. */
  const EQ = [
    // Tier 1 · atelier
    { id: 'kit_manual', tier: 1, name: 'Banco de artesano: sierra de marquetería, limas, fresas de galce y lijas', cost: 500, maint: 10, q: 0, desc: 'Requisito mínimo para trabajar acetato y madera: recortar frente y varillas, abrir el galce y repasar a mano.' },
    { id: 'cnc3018', tier: 1, name: 'Fresadora CNC de aficionado (formato 3018, 500 W)', cost: 1200, maint: 20, cap: 15, q: 0.005, fail: 0.05, desc: 'Fresa contornos de frentes y varillas desde un archivo CAD. Poca rigidez: vibra, rompe fresas y se avería a menudo.' },
    { id: 'fresadora_rigida', tier: 1, name: 'Fresadora CNC de sobremesa rígida de 3 ejes', cost: 10000, maint: 60, cap: 30, q: 0.01, req: { equipo: 'cnc3018' }, desc: 'Bancada de fundición y husillo refrigerado: galce y cajeado de charnela fiables, menos roturas. Capacidad +30/semana.' },
    { id: 'cad_software', tier: 1, name: 'Programa de diseño CAD 3D + plantillas de calibre y puente', cost: 1000, maint: 50, q: 0.01, desc: 'Frentes con calibre, puente y ángulo pantoscópico bien medidos: +1 % de nota.' },
    { id: 'fdm_prototipos', tier: 1, name: 'Impresora 3D de filamento para prototipos de ajuste', cost: 800, maint: 15, q: 0.005, req: { date: '16/1' }, desc: 'Un prototipo en 24 h para probar puente y largo de varilla: menos defectos de tallaje.' },
    { id: 'calor_glicerol', tier: 1, name: 'Ventilete de aire caliente y baño de glicerina', cost: 800, maint: 10, q: 0.01, only: ['acetato'], desc: 'Bombeado del frente a 100–130 °C y calado de lentes a 60–90 °C sin cuartear el acetato.' },
    { id: 'bombo_hobby', tier: 1, name: 'Bombo octogonal de sobremesa (un tambor)', cost: 900, maint: 15, q: 0.01, only: ['acetato', 'madera'], desc: '48–96 h girando con chips de madera de haya, piedra pómez y pasta de pulir: cantos redondeados y menos defectos de superficie.' },
    { id: 'pulidora_banco', tier: 1, name: 'Motor de mopa con ruedas de algodón y pastas de pulir', cost: 600, maint: 10, q: 0.005, desc: 'Brillo final a mano tras el bombo. Con demasiada presión deja marcas de calor.' },
    { id: 'insertadora_manual', tier: 1, name: 'Fresadora horizontal manual + insertadora de almas y charnelas', cost: 2400, maint: 10, cap: 5, q: 0.01, desc: 'Fresado de frentes por plantilla, alma metálica insertada en caliente en las varillas y charnelas incrustadas o remachadas: −15 % de defectos de charnela.' },
    { id: 'stock_planchas', tier: 1, name: 'Stock de planchas de acetato de celulosa', cost: 1500, maint: 0, q: 0, desc: 'Planchas compradas al por menor, sin mínimos (en España se encuentran con facilidad hasta 5 mm; las gruesas hay que importarlas). Sin planchas no se fabrica.' },
    // Tier 2 · taller CNC
    { id: 'cnc_optica_3ejes', tier: 2, name: 'Centro de fresado CNC de 3 ejes para frentes y varillas', cost: 38000, maint: 400, q: 0.01, req: { level: 2, research: 'CustomEngine' }, desc: 'Un frente fresado en 10–20 minutos, con galce y cajeado de charnela de serie. Base del taller profesional.' },
    { id: 'bombos_serie', tier: 2, name: 'Tren de 4 bombos octogonales de madera + mopa de algodón', cost: 6500, maint: 90, q: 0.02, only: ['acetato', 'cuerno'], req: { equipo: 'cnc_optica_3ejes' }, desc: 'Ciclos de 48–96 h con chips de haya y pastas abrasivas: acabado espejo profundo. Permite fabricar acetato premium y cuerno, y el ciclo completo con secado controlado evita monturas mal curadas que encogen.' },
    { id: 'prensa_bombeado', tier: 2, name: 'Prensa de bombeado de frentes con calentamiento', cost: 10000, maint: 80, q: 0.01, only: ['acetato'], req: { equipo: 'cnc_optica_3ejes' }, desc: 'Curva base del frente constante en toda la serie: −10 % de defectos.' },
    { id: 'insertadora_auto', tier: 2, name: 'Insertadora automática de charnelas y almas (calor / ultrasonidos)', cost: 6000, maint: 60, cap: 40, q: 0.01, req: { equipo: 'cnc_optica_3ejes' }, desc: 'Charnelas de 5 y 7 barriles incrustadas sin holguras y almas centradas en la varilla. Capacidad +40/semana.' },
    { id: 'horno_varillas', tier: 2, name: 'Horno de curvado de varillas + dobladora de terminales', cost: 6000, maint: 50, cap: 10, q: 0.01, req: { equipo: 'cnc_optica_3ejes' }, desc: 'Varillas y terminales curvados de serie: mejor ajuste detrás de la oreja.' },
    { id: 'ranuradora', tier: 2, name: 'Ranuradora de galce (ranura en V de 110–120°)', cost: 5000, maint: 40, q: 0.005, req: { equipo: 'cnc_optica_3ejes' }, desc: 'Galce uniforme en todo el aro: −10 % de devoluciones por lentes que saltan.' },
    { id: 'laser_fibra', tier: 2, name: 'Láser de marcaje para grabar varillas', cost: 9000, maint: 60, q: 0.005, req: { level: 2 }, desc: 'Marca, modelo, calibre y número de serie grabados en la cara interior de la varilla: protege contra las falsificaciones.' },
    { id: 'serigrafia', tier: 2, name: 'Tampografía de logotipos', cost: 4000, maint: 30, q: 0, hype: 1.05, req: { level: 2 }, desc: 'Marca visible en cada varilla: +5 % de expectación en las campañas.' },
    { id: 'cabina_pulido', tier: 2, name: 'Cabina de pulido con aspiración', cost: 3500, maint: 30, q: 0.005, req: { level: 2 }, desc: 'Las virutas y el polvo del fresado arden junto a la mopa caliente. Elimina el riesgo de incendio en el taller.' },
    { id: 'babyplast', tier: 2, name: 'Micro-inyectora de sobremesa + moldes de aluminio', cost: 34000, maint: 250, cap: 100, q: 0, fail: 0.02, req: { level: 2, research: 'CustomEngine' }, desc: 'Poliamida tipo TR90, polipropileno y nailon regenerado en tiradas cortas, sin depender de China. Un molde por modelo nuevo.' },
    { id: 'sls_fuse', tier: 2, name: 'Celda de impresión 3D SLS compacta (impresora, desempolvado y granallado)', cost: 60000, maint: 600, cap: 150, q: 0.01, fail: 0.02, req: { level: 2, research: 'Impresion3D', date: '24/1' }, desc: 'Poliamida sinterizada sin molde ni mínimos: decenas de frentes por lote de una noche.' },
    { id: 'escaner_facial', tier: 2, name: 'Escáner facial 3D de tienda', cost: 15000, maint: 100, q: 0, req: { level: 2, research: 'EscaneoAMedida' }, desc: 'Gafas a medida: +15 % de ventas en graduado impreso en 3D.' },
    // Tier 3 · fábrica
    { id: 'cnc_multihusillo', tier: 3, name: 'Fila de centros CNC multihusillo de 4–5 ejes', cost: 250000, maint: 2000, q: 0.02, req: { level: 3 }, desc: 'Un frente cada 2–3 minutos con puente anatómico, biselado escultórico y cajeado de charnela. Permite aluminio y carbono mecanizados.' },
    { id: 'bombos_industriales', tier: 3, name: 'Sala de bombos industrial (desbaste, alisado y brillo)', cost: 60000, maint: 500, q: 0.025, only: ['acetato', 'cuerno'], req: { equipo: 'cnc_multihusillo' }, desc: 'Decenas de tambores en tres etapas: acabado de cuatro días sin cuello de botella.' },
    { id: 'inyectora_150t', tier: 3, name: 'Inyectora de 120–160 t + moldes de acero', cost: 95000, maint: 1000, cap: 2000, q: 0, fail: 0.02, req: { level: 3 }, desc: 'Cientos de frentes y varillas a la hora, a 1–3 € la pieza, pero cada modelo exige un molde de acero de 2.500–6.000 €: coste unitario −60 % en poliamida tipo TR90, polipropileno y nailon regenerado.' },
    { id: 'linea_metal', tier: 3, name: 'Línea de metal: trefilado, curvadora de aros, prensas y soldadura por inducción', cost: 180000, maint: 1500, cap: 800, q: 0.01, only: ['metal', 'combinada'], req: { level: 3, research: 'metal2' }, desc: 'Aros, puentes, plaquetas y varillas de metal propias, y el frente metálico de las combinadas.' },
    { id: 'soldadura_laser_titanio', tier: 3, name: 'Estación de soldadura láser con cámara de argón', cost: 40000, maint: 300, q: 0.01, only: ['titanio'], req: { equipo: 'linea_metal' }, desc: 'Soldado al aire el titanio se oxida y se vuelve quebradizo: habilita titanio y beta-titanio propios; −20 % de roturas en soldaduras.' },
    { id: 'galvanica', tier: 3, name: 'Planta galvánica (barrera de paladio, oro, rutenio, pasivado)', cost: 220000, maint: 2500, q: 0.01, only: ['metal', 'combinada'], fail: 0.02, req: { equipo: 'linea_metal' }, desc: 'Baños de oro y colores clásicos en casa. Cumplir el límite de níquel de REACH es obligatorio.' },
    { id: 'pvd_ip', tier: 3, name: 'Cámara de PVD / chapado iónico en vacío', cost: 220000, maint: 2200, q: 0.02, only: ['metal', 'titanio', 'combinada'], req: { equipo: 'linea_metal', research: 'TitanioIP' }, desc: 'Colores intensos y durabilidad +30 % en metal y titanio. La capa sella el metal base: no libera níquel.' },
    { id: 'lacado', tier: 3, name: 'Cabina de lacado al horno (epoxi / poliuretano)', cost: 60000, maint: 500, q: 0.01, req: { level: 3 }, desc: 'Lacado mate y degradados sin coste unitario extra.' },
    { id: 'lab_color', tier: 3, name: 'Laboratorio de color y bloques de acetato propios', cost: 150000, maint: 1500, q: 0.02, only: ['acetato'], hype: 1.1, req: { level: 3, research: 'ColorPropio' }, desc: 'Colores exclusivos (fusión de 24 h + reposo de 45 días): +10 % de expectación. Permite acetato reciclado.' },
    { id: 'sls_industrial', tier: 3, name: 'Celda SLS industrial (impresora de gran formato + tintado y alisado por vapor)', cost: 280000, maint: 2500, cap: 600, q: 0.01, only: ['pa'], req: { level: 3, research: 'Impresion3D', date: '16/1' }, desc: 'Decenas de miles de frentes al año por impresora. Impresión 3D a 8–12 € la unidad.' },
    { id: 'qc_lab', tier: 3, name: 'Laboratorio de ensayos: sudor artificial, EN ISO 12870 y níquel EN 16128', cost: 30000, maint: 300, q: 0.03, req: { level: 3 }, desc: '−30 % de defectos. Ensayos propios de puente, fatiga de charnela y liberación de níquel (sin pagar laboratorio externo) y control de los lotes importados: anula los defectos del OEM chino.' },
    // Tier 4 · manufactura
    { id: 'manifattura', tier: 4, name: 'Planta industrial propia de monturas', cost: 8000000, maint: 120000, q: 0.03, req: { level: 4 }, desc: 'Capacidad 20.000/semana, calidad máxima y sello de origen propio.' },
    { id: 'planta_acetato', tier: 4, name: 'Planta de acetato propia', cost: 3000000, maint: 40000, q: 0.01, only: ['acetato'], income: 20000, req: { equipo: 'manifattura' }, desc: 'Acetato de celulosa y plastificante mezclados, bloques prensados, laminados en planchas y curados durante semanas: acetato −40 % y venta de planchas a terceros (20.000 €/mes).' }
  ];
  const EQBY = {}; for (const e of EQ) EQBY[e.id] = e;

  /* Materiales (22): clave = id en DATA.PARTS. g = grupo de coste (para OEM/proveedor), c = coste unitario propio (€),
     own = equipos (cualquiera) necesarios para fabricarlo en casa, capMult = fracción de capacidad que consume.
     estilos/tipos = ids de DATA.TOPICS / DATA.GENRES afines (los que no existan se ignoran). */
  const MAT = {
    acetato1: { src: 'inyectado_cp', g: 'inyectado', c: 4, q: 3, own: ['babyplast', 'inyectora_150t'], tipos: ['infantil', 'lectura', 'sol'], estilos: ['neon', 'redondas', 'medialuna', 'bicolor'], note: 'Granza de acetato inyectada en molde: barata y ligera. Propio solo con inyectora.' },
    acetato2: { src: 'inyectado_cp', g: 'inyectado', c: 5, q: 4, own: ['babyplast', 'inyectora_150t'], tipos: ['infantil', 'lectura', 'sol'], estilos: ['neon', 'redondas', 'medialuna', 'bicolor'], note: 'Inyección con mejor pintura y lacado. Propio solo con inyectora.' },
    acetato3: { src: 'acetato_std', g: 'acetato', c: 12, q: 6, own: ['kit_manual'], tipos: ['graduado', 'sol'], estilos: ['wayfarer', 'cateye', 'carey', 'oversize', 'pantos', 'chunky', 'keyhole', 'retro70'], note: 'Plancha de acetato de celulosa de 6–8 mm, color en masa, fresada y pulida en bombo. "Hecho a mano".' },
    acetato4: { src: 'acetato_mazzucchelli', g: 'acetato', c: 38, q: 8, own: ['bombos_serie'], tipos: ['premium', 'graduado', 'sol'], estilos: ['joya', 'arquitecto', 'nordico', 'carey', 'crownpanto', 'lujosilencioso'], note: 'Acetato italiano en planchas de primera calidad: paletas exclusivas y laminados; cuesta el doble que el estándar asiático y es más estable.' },
    acetato5: { src: 'bio_acetato', g: 'acetato', c: 48, q: 8, own: ['bombos_serie'], eco: true, tipos: ['premium', 'graduado', 'sol'], estilos: ['eco', 'minimal', 'nordico', 'soft'], note: 'Bio-acetato con plastificante vegetal (≈60–68 % de origen renovable). Eco-lujo certificado.' },
    acetato_fino: { g: 'acetato', c: 14, q: 7, own: ['cnc_optica_3ejes'], tipos: ['graduado'], estilos: ['minimal', 'nordico', 'transparentes', 'microoval'], note: 'Frente de 4 mm: ligero y moderno, pero con más roturas.' },
    acetato_reciclado: { g: 'acetato', c: 24, q: 7, own: ['lab_color'], eco: true, tipos: ['graduado', 'sol'], estilos: ['eco', 'bicolor'], note: 'Recortes de plancha reprensados: colores moteados y discurso circular.' },
    tr90: { g: 'inyectado', c: 7, q: 6, own: ['babyplast', 'inyectora_150t'], tipos: ['deportiva', 'infantil', 'graduado'], estilos: ['envolventes', 'flexible', 'flexkids', 'glaciar', 'escudo', 'techwear'], note: 'Poliamida tipo TR90 inyectada: flexible, con memoria e hipoalergénica. Molde obligatorio.' },
    rilsan_pa11: { g: 'inyectado', c: 10, q: 7, own: ['babyplast', 'inyectora_150t'], eco: true, tipos: ['deportiva', 'infantil', 'sol'], estilos: ['eco', 'carreras', 'flexkids', 'surf'], note: 'Poliamida PA11 transparente de aceite de ricino: la versión bio de la poliamida inyectada.' },
    pp_pc: { g: 'inyectado', c: 2, q: 2, own: ['inyectora_150t'], cheap: true, tipos: ['lectura', 'sol'], estilos: ['medialuna', 'neon', 'redondas'], note: 'Lo más barato: premontadas de lectura de farmacia y gafas promocionales. Las revistas de moda lo castigan.' },
    metal1: { src: 'monel', g: 'metal', c: 6, q: 5, own: ['linea_metal'], nickel: true, tipos: ['graduado', 'lectura', 'sol'], estilos: ['aviador', 'navegador', 'rectangulares', 'medialuna', 'retro80'], note: 'Aleación de níquel y cobre (dos tercios de níquel): se suelda y se chapa bien, pero da alergias.' },
    metal2: { src: 'monel', g: 'metal', c: 7, q: 5, own: ['linea_metal'], nickel: true, tipos: ['graduado', 'lectura', 'sol'], estilos: ['aviador', 'navegador', 'rectangulares', 'medialuna', 'retro80'], note: 'Metal de moda con mejor acabado. Sigue liberando níquel si no lleva barrera.' },
    metal3: { src: 'inox', g: 'metal', c: 12, q: 7, own: ['linea_metal'], tipos: ['graduado', 'deportiva'], estilos: ['minimal', 'hexagonales', 'alaire', 'arquitecto', 'acero', 'nylor'], note: 'Hilo o chapa de acero inoxidable cortada a láser. Ligero, sin corrosión, sin tornillos.' },
    aluminio: { g: 'metal', c: 22, q: 7, own: ['cnc_multihusillo'], tipos: ['sol', 'deportiva', 'premium'], estilos: ['arquitecto', 'steampunk', 'carreras', 'escudo', 'carbono'], note: 'Mecanizado desde tocho y anodizado. No se suelda.' },
    metal4: { src: 'titanio', g: 'titanio', c: 28, q: 9, own: ['soldadura_laser_titanio'], tipos: ['graduado', 'premium', 'deportiva'], estilos: ['titanio', 'alaire', 'minimal', 'arquitecto', 'lujosilencioso'], note: 'Titanio puro soldado en argón: sin níquel y con la mitad de peso que la aleación de níquel.' },
    metal5: { src: 'beta_titanio', g: 'titanio', c: 38, q: 9, own: ['soldadura_laser_titanio'], tipos: ['graduado', 'premium', 'lectura'], estilos: ['alaire', 'titanio', 'nylor', 'microoval'], note: 'Beta-titanio: elástico, permite puentes y varillas finísimas.' },
    metal6: { src: 'pa12_sls', g: 'pa', c: 15, q: 7, own: ['sls_fuse', 'sls_industrial'], tipos: ['graduado', 'deportiva', 'premium'], estilos: ['smart', 'techwear', 'eco', 'minimal'], note: 'Poliamida PA12 sinterizada: sin molde ni mínimos, acabado mate.' },
    pa11_bio: { g: 'pa', c: 20, q: 8, own: ['sls_fuse', 'sls_industrial'], eco: true, tipos: ['graduado', 'deportiva', 'infantil'], estilos: ['eco', 'flexkids', 'smart', 'flexible'], note: 'PA11 de ricino impresa: flexible y con menos CO₂.' },
    titanio_3d: { g: 'titanio_3d', c: 60, q: 9, own: [], lux: true, tipos: ['premium', 'graduado'], estilos: ['titanio', 'arquitecto', 'smart'], note: 'Fusión láser de polvo de titanio en un servicio externo: pieza única de alta tecnología. Solo externo.' },
    metal7: { src: 'carbono', g: 'carbono', c: 40, q: 8, own: ['cnc_multihusillo'], tipos: ['deportiva', 'premium', 'sol'], estilos: ['carbono', 'carreras', 'titanio', 'escudo'], note: 'Fibra de carbono y composites: ultraligero, nicho deportivo-premium.' },
    econyl: { g: 'inyectado', c: 10, q: 6, own: ['babyplast', 'inyectora_150t'], eco: true, tipos: ['sol', 'deportiva', 'infantil'], estilos: ['eco', 'surf', 'envolventes'], note: 'Nailon regenerado a partir de redes de pesca recuperadas en el puerto.' },
    madera: { src: 'madera_laminada', g: 'madera', c: 30, q: 7, own: ['kit_manual'], capMult: 0.5, tipos: ['sol', 'premium'], estilos: ['madera', 'eco', 'surf', 'nordico'], note: 'Chapas cruzadas y prensadas, 100 % manual: consume el doble de capacidad.' },
    cuerno: { g: 'cuerno', c: 90, q: 10, own: ['bombos_serie'], capMult: 0.2, lux: true, tipos: ['premium', 'graduado'], estilos: ['joya', 'carey', 'arquitecto', 'lujosilencioso'], note: 'Cuerno de búfalo laminado: más de 280 pasos a mano. Lujo artesanal, cinco veces más lento.' },
    combinada: { g: 'combinada', c: 22, q: 8, own: ['linea_metal'], tipos: ['graduado', 'sol', 'premium'], estilos: ['combinada', 'clubmaster', 'navegador', 'doblepuente'], note: 'Ceja de acetato sobre aro de metal: dos cadenas de producción, o un "terzista" (taller subcontratado del Cadore).' }
  };
  const MAT_DEFAULT = { id: 'generico', name: 'Acetato inyectado de catálogo', g: 'inyectado', c: 5, q: 3, own: [], tipos: [], estilos: [], note: 'Acetato inyectado de catálogo.' };
  const GROUP_NAME = { inyectado: 'inyectados', acetato: 'acetato en plancha', metal: 'metal', titanio: 'titanio', pa: 'impresión 3D', titanio_3d: 'titanio 3D', carbono: 'carbono', madera: 'madera', cuerno: 'cuerno', combinada: 'combinadas' };

  /* Servicios externos (11): 7 acuerdos OEM + 4 servicios complementarios.
     MOQ y plazos según el informe (polos OEM): Wenzhou 600 uds/modelo y 60–90 días + barco; Shenzhen 300 uds y 75–105 días;
     Cadore 100–250 uds (series cortas de 50 con recargo) y 60–90 días con cierre en agosto; Sabae 150–300 uds y 4–6 meses.
     Los costes unitarios son puestos en almacén (FOB + flete + aduana), por eso superan el FOB del informe. */
  const DEALS = [
    { id: 'oem_china_wenzhou', name: 'OEM China — Wenzhou/Taizhou', fee: 50000, monthly: 400, moq: 600, lead: 14, unit: { acetato: 12, inyectado: 7, metal: 6, titanio: 25 }, q: -0.03, china: true, req: { level: 2, date: '4/1' }, desc: 'Modelos propios a partir de 600 piezas por modelo (máx. 3 colores): 60–90 días de fábrica más el barco. Acetato básico, metal e inyectados baratos y sin límite, pero +25 % de defectos salvo control de calidad. Pago: 30 % de anticipo y 70 % antes del embarque.' },
    { id: 'oem_china_shenzhen', name: 'OEM China — Shenzhen/Dongguan', fee: 80000, monthly: 600, moq: 300, lead: 15, unit: { acetato: 16, metal: 9, titanio: 30 }, q: -0.01, china: true, req: { level: 3, date: '6/1' }, desc: 'Gama media-alta: acetato de buena calidad y titanio con PVD, 300 piezas por modelo (100 por color). Mejor calidad que Wenzhou; prototipo en 25 días y producción en 75–105.' },
    { id: 'oem_xiamen', name: 'OEM China — Xiamen (gafas de sol)', fee: 40000, monthly: 300, moq: 500, lead: 9, unit: { inyectado: 5, acetato: 10 }, q: -0.02, china: true, solOnly: true, req: { level: 2, date: '5/1' }, desc: 'Solo gafas de sol: modelos de catálogo con tu marca a coste muy bajo y +10 % de ventas en grandes almacenes y marketplaces.' },
    { id: 'oem_italia_cadore', name: 'Terzisti del Cadore (Belluno, Italia)', fee: 120000, monthly: 1000, moq: 150, lead: 14, unit: { acetato: 45, metal: 35, combinada: 50, inyectado: 14 }, q: 0.04, italia: true, req: { level: 3, date: '8/1' }, desc: 'Talleres subcontratados del Véneto ("terzisti"): acetato laminado, fresado de volumen y charnelas remachadas de 5 y 7 barriles. Sin aduanas, pero cierran en agosto. +4 % de nota por origen y +15 % en boutiques.' },
    { id: 'oem_italia_sin_moq', name: 'Terzista del Cadore para series cortas', fee: 20000, monthly: 300, moq: 50, lead: 12, unit: { acetato: 70, metal: 60 }, q: 0.03, italia: true, req: { level: 2, date: '3/1' }, desc: 'Series cortas de 50 piezas con recargo: entrada al hecho en Italia sin llenar el almacén. Margen bajo, calidad alta.' },
    { id: 'oem_japon_sabae', name: 'Fábrica de Sabae (Fukui, Japón)', fee: 200000, monthly: 1500, moq: 150, lead: 24, unit: { titanio: 75, combinada: 85 }, q: 0.06, japon: true, req: { level: 3, date: '6/1', research: 'metal4' }, desc: 'Titanio y beta-titanio, más de 200 pasos, chapado iónico y grabados de filigrana en puente y varillas. 150–300 piezas por modelo y 4–6 meses de producción: inmoviliza capital, pero da el máximo prestigio (+6 % de nota, +9 % en titanio).' },
    { id: 'bureau_3d', name: 'Servicio externo de impresión 3D industrial', fee: 10000, monthly: 200, moq: 1, lead: 4, unit: { pa: 45, titanio_3d: 60 }, q: 0, req: { level: 2, date: '12/1', research: 'Impresion3D' }, desc: 'Una nave con decenas de impresoras SLS, lotes de 1 a 10.000. Caro por unidad, pero sin impresora ni stock.' }
  ];
  const DEALBY = {}; for (const d of DEALS) DEALBY[d.id] = d;
  const ADDONS = [
    { id: 'inspector_china', name: 'Inspector de calidad en origen', fee: 0, monthly: 0, perRelease: 5000, req: { chinaDeal: true }, desc: '5.000 € por colección fabricada en China: revisa el lote antes del embarque y anula el malus de defectos del OEM.' },
    { id: 'consultora_mdr', name: 'Responsable de cumplimiento (PRRC) externo', fee: 8000, monthly: 500, req: { level: 1 }, desc: 'Documentación técnica, Declaración UE de conformidad y vigilancia poscomercialización (MDR): +1 % de nota y sin inspecciones por falta de registro.' },
    { id: 'transitario', name: 'Transitario y aduanas (marítimo / aéreo)', fee: 3000, monthly: 300, req: { chinaDeal: true }, desc: '−4 semanas de plazo desde China, flete aéreo más barato y la mitad de retrasos por cierres de fábrica.' },
    { id: 'lab_ensayos_iso12870', name: 'Ensayos externos EN ISO 12870 y níquel por modelo', auto: true, perRelease: 600, desc: '600 € por colección mientras no tengas laboratorio de ensayos propio. Se contrata solo al investigar los ensayos.' }
  ];
  const ADDONBY = {}; for (const a of ADDONS) ADDONBY[a.id] = a;

  /* Ferias (el taller las ofrece solo si no existe el módulo marketing). */
  const FAIRS = [
    { id: 'opti', name: 'Feria de óptica de Múnich', month: 1, week: 2, cost: 12000, level: 2, hype: 50, fans: 0.005, desc: 'La primera feria del año. Buen escaparate para el mercado alemán.' },
    { id: 'mido', name: 'Gran feria de óptica de Milán', month: 2, week: 1, cost: 25000, level: 2, hype: 90, fans: 0.01, desc: 'La feria más importante del mundo. Contacto directo con los "terzisti" (talleres subcontratados) del Cadore: −25 % en la cuota de los acuerdos italianos durante un año.' },
    { id: 'vision_expo', name: 'Feria de óptica de Nueva York', month: 3, week: 1, cost: 30000, level: 3, hype: 110, fans: 0.015, desc: 'Entrada al mercado americano. Ojo con los aranceles.' },
    { id: 'silmo', name: 'Salón de óptica de París', month: 9, week: 1, cost: 25000, level: 2, hype: 90, fans: 0.01, desc: 'Diseño y tendencias. Si ganamos el premio de diseño del salón, la próxima colección sube de nota.' },
    { id: 'date', name: 'Feria de ópticas independientes de Florencia', month: 9, week: 3, cost: 6000, level: 2, research: 'PremiumLine', hype: 30, fans: 0.004, desc: 'Feria de ópticas independientes: +10 % de ventas de Premium en boutiques durante un año.' }
  ];

  /* =====================================================================
     2. REGISTRO EN DATA.* (al cargar el fichero, antes de Modules.register)
     ===================================================================== */
  const pushUnique = (arr, items) => { for (const it of items) if (!arr.some(x => x.id === it.id)) arr.push(it); };
  pushUnique(DATA.PARTS, [
    { id: 'pp_pc', name: 'Polipropileno / policarbonato inyectado', category: 'Materiales', v: 2, techLevel: 1, group: 'inyectado', devCost: 5000, req: { missionLevel: ['Materiales', 1] } },
    { id: 'acetato_fino', name: 'Acetato fino de 4 mm', category: 'Materiales', v: 6, techLevel: 3, group: 'acetato', devCost: 25000, req: { research: 'AcetatoFino' } },
    { id: 'acetato_reciclado', name: 'Acetato reciclado', category: 'Materiales', v: 6, techLevel: 3, group: 'acetato', devCost: 30000, req: { research: 'ColorPropio' } },
    { id: 'rilsan_pa11', name: 'Poliamida PA11 de ricino (bio-inyección)', category: 'Materiales', v: 6, techLevel: 3, group: 'inyectado', devCost: 30000, req: { research: 'BioInyeccion' } },
    { id: 'econyl', name: 'Nailon regenerado (redes de pesca)', category: 'Materiales', v: 6, techLevel: 3, group: 'inyectado', devCost: 30000, req: { research: 'RedesRecicladas' } },
    { id: 'combinada', name: 'Montura combinada acetato + metal', category: 'Materiales', v: 8, techLevel: 4, group: 'combinada', devCost: 50000, req: { featureLevel: ['metal2', 1], date: '5/1' } },
    { id: 'aluminio', name: 'Aluminio mecanizado y anodizado', category: 'Materiales', v: 8, techLevel: 4, group: 'metal', devCost: 60000, req: { featureLevel: ['metal3', 1], date: '9/1' } },
    { id: 'cuerno', name: 'Cuerno de búfalo laminado', category: 'Materiales', v: 10, techLevel: 3, group: 'cuerno', devCost: 80000, req: { research: 'PremiumLine', date: '10/1' } },
    { id: 'pa11_bio', name: 'Impresión 3D en PA11 bio', category: 'Materiales', v: 10, techLevel: 6, group: 'pa', devCost: 100000, req: { research: 'Impresion3D', date: '18/1' } },
    { id: 'titanio_3d', name: 'Titanio impreso en 3D (fusión láser)', category: 'Materiales', v: 12, techLevel: 6, group: 'titanio_3d', devCost: 150000, req: { research: 'Impresion3D', date: '15/1' } }
  ]);
  const later = (y, m) => co => co.isLaterOrEqualThan(y, m);
  const RESEARCH = [
    { id: 'MDRClase1', name: 'Fabricante de producto sanitario de clase I (MDR, AEMPS)', category: 'Taller', pointsCost: 15, duration: 8000, cost: 8000, req: co => co.gameLog.length >= 1 && co.isLaterOrEqualThan(1, 1), desc: 'Monturas, lentes y premontadas de lectura son producto sanitario de clase I: documentación técnica, Declaración UE de conformidad, marcado CE, UDI-DI y registro ante la AEMPS (sin organismo notificado). Sin él, los grandes canales venden un 40 % menos y Sanidad puede inspeccionarte.', noticia: 'Quien pone su marca en una montura graduable es el fabricante legal, aunque la haga otro: si la importa, además es importador.' },
    { id: 'EPISol', name: 'Gafas de sol como EPI (EN ISO 12312-1)', category: 'Taller', pointsCost: 10, duration: 6000, cost: 5000, req: co => co.gameLog.length >= 1 && co.isLaterOrEqualThan(1, 1), desc: 'Ensayos de transmitancia UV400, potencia prismática y categoría de filtro, con su declaración de conformidad. Sin ellos, las colecciones de sol pierden un 3 % de nota y venden menos fuera de la tienda.', noticia: 'Una gafa de sol no es producto sanitario sino un equipo de protección individual: categoría de filtro 0–4 y UV400.' },
    { id: 'ISO12870', name: 'Ensayos EN ISO 12870 y níquel EN 16128', category: 'Taller', pointsCost: 20, duration: 8000, cost: 15000, req: co => co.hasResearch('MDRClase1'), desc: 'Deformación del puente, fatiga de charnelas, sudor artificial, retención de lentes e inflamabilidad, más la liberación de níquel. +2 % de nota y requisito de clínicas y mutuas. 600 € por modelo sin laboratorio propio.', noticia: 'Las clínicas y las mutuas solo compran monturas con ensayos de fatiga y sudor.' },
    { id: 'SinNiquel', name: 'Metal sin níquel (barrera de paladio, titanio, PVD)', category: 'Taller', pointsCost: 30, duration: 12000, cost: 60000, req: later(8, 1), desc: 'Cumple REACH (≤0,5 µg/cm² por semana tras el ensayo de desgaste y sudor). Elimina el brote de alergias al níquel.', noticia: 'La normativa limita la liberación de níquel a 0,5 µg/cm² por semana en artículos en contacto con la piel.' },
    { id: 'TitanioIP', name: 'Titanio con chapado iónico (PVD)', category: 'Taller', pointsCost: 90, duration: 15000, cost: 200000, req: co => co.isLaterOrEqualThan(6, 1) && co.hasResearch('metal4'), desc: 'Colores intensos y durabilidad en titanio. Permite la cámara de PVD y mejora el metal propio.', noticia: 'Las fábricas de Sabae popularizan el chapado iónico en titanio.' },
    { id: 'Impresion3D', name: 'Impresión 3D de monturas (SLS)', category: 'Taller', pointsCost: 80, duration: 15000, cost: 150000, req: co => co.isLaterOrEqualThan(11, 1) && co.level >= 2, desc: 'Poliamida sinterizada por láser, sin tornillos ni moldes. Desbloquea el servicio externo de impresión, la celda SLS, el PA11 y el titanio impreso.', noticia: 'Un estudio danés presenta gafas sin tornillos impresas en nailon; sin moldes ni mínimos.' },
    { id: 'ColorPropio', name: 'Laboratorio de color propio', category: 'Taller', pointsCost: 70, duration: 12000, cost: 150000, req: co => co.isLaterOrEqualThan(12, 1) && co.level >= 3, desc: 'Bloques de acetato exclusivos. Desbloquea el laboratorio de color y el acetato reciclado.', noticia: 'Una marca que solo vende por internet fabrica sus propios bloques de acetato para no compartir colores con nadie.' },
    { id: 'BioInyeccion', name: 'Bio-inyección (PA11 de ricino)', category: 'Taller', pointsCost: 40, duration: 10000, cost: 80000, req: co => co.isLaterOrEqualThan(14, 1) && co.hasResearch('tr90'), desc: 'Desbloquea la poliamida PA11 transparente. Bonus eco en Deportiva e Infantil.', noticia: 'Un químico francés lanza una poliamida transparente de aceite de ricino para gafas deportivas.' },
    { id: 'RedesRecicladas', name: 'Nailon de redes de pesca recicladas', category: 'Taller', pointsCost: 40, duration: 10000, cost: 80000, req: later(15, 1), desc: 'Pescadores que entregan las redes viejas y granza regenerada para inyectar. Desbloquea el nailon regenerado.', noticia: 'Una empresa emergente de Barcelona recoge 240 toneladas de plástico marino al año con pescadores de tres países.' },
    { id: 'EscaneoAMedida', name: 'Gafas a medida con escaneo facial', category: 'Taller', pointsCost: 120, duration: 15000, cost: 250000, req: co => co.isLaterOrEqualThan(16, 9) && co.hasResearch('Impresion3D'), desc: 'Escáner en tienda, diseño paramétrico y montura impresa en 4 semanas. Desbloquea el escáner facial.', noticia: 'Un fabricante de lentes y un impresor 3D lanzan gafas diseñadas alrededor de la cara del paciente.' },
    { id: 'AcetatoFino', name: 'Acetato fino y transparente', category: 'Taller', pointsCost: 30, duration: 8000, cost: 50000, req: co => co.isLaterOrEqualThan(17, 1) && co.hasResearch('acetato3'), desc: 'Desbloquea el acetato de 4 mm. Transparentes y minimalistas suben de nota dos años.', noticia: 'Las pasarelas imponen monturas de acetato cristal de 4 milímetros.' },
    { id: 'BioAcetato', name: 'Bio-acetato certificado', category: 'Taller', pointsCost: 60, duration: 12000, cost: 120000, req: co => co.isLaterOrEqualThan(19, 1) && co.hasResearch('acetato4'), desc: 'Acetato con plastificante de origen vegetal y certificación de contenido renovable. Los estilos eco suben de nota tres años y el bio-acetato propio cuesta menos.', noticia: 'Los grandes productores de acetato presentan planchas con un 60–68 % de contenido vegetal.' },
    { id: 'SmartGlasses', name: 'Gafas inteligentes con cámara y audio', category: 'Taller', pointsCost: 150, duration: 20000, cost: 400000, req: co => co.isLaterOrEqualThan(21, 9) && co.level >= 3, desc: 'Electrónica y batería integradas en la varilla. El estilo Inteligentes sube un 5 % de nota.', noticia: 'Una red social y el mayor grupo óptico del mundo lanzan unas gafas de pasta clásicas con cámara.' }
  ];
  pushUnique(DATA.RESEARCH, RESEARCH);
  pushUnique(DATA.TRAINING, [
    { id: 'taller_curso_cnc', name: 'Curso de fresado CNC, bombo y montaje de charnelas', cost: 40000, pointsCost: 10, duration: 16000, basePoints: 10, tF: 1, dF: 0.1, rF: 0, sF: 0.2, maxP: 700, level: 2, skill: 'taller_cnc' },
    { id: 'taller_curso_sourcing', name: 'Compras y negociación con fábricas OEM', cost: 50000, pointsCost: 15, duration: 16000, basePoints: 8, tF: 0.2, dF: 0.2, rF: 0.5, sF: 1, maxP: 700, level: 2, skill: 'sourcing' },
    { id: 'taller_curso_regulatorio', name: 'Cumplimiento normativo: MDR, REACH y EPI', cost: 60000, pointsCost: 20, duration: 16000, basePoints: 8, tF: 0.3, dF: 0, rF: 1, sF: 0, maxP: 800, level: 3, skill: 'regulatorio' }
  ]);

  /* =====================================================================
     3. ESTADO
     ===================================================================== */
  function defaults() {
    return { v: 1, tier: 0, capacityWeek: 0, capacityBase: 0, qualityMax: 0.75, unitCostBase: 7, techLevel: 0, staffFactor: 0, staffUnits: 0, equipment: [], broken: {}, stoppedWeeks: 0,
      deals: {}, addons: {}, mode: 'auto', preferredDeal: null, tariff: 0, tariffUntil: 0, returnsUntil: 0, returnsRate: 0,
      flags: { silmoDor: false, italiaContactUntil: 0, dateBonusUntil: 0, italiaOffUntil: 0, chinaOffUntil: 0, warnedCap: false, advanceCash: 0, advanceUntil: 0 }, fairs: {}, cool: {}, molds: {}, researchWeek: {},
      prevUnits: {}, lastUnits: {}, pendingDead: null, history: [], stats: { own: 0, out: 0, prov: 0, lost: 0, deadLoss: 0, fines: 0, upgrades: 0, repairs: 0 }, demandWeek: 0, madeWeek: 0, busy: 0 };
  }
  function S(co) { return co.modules && co.modules[ID]; }
  function init(co) {
    co.modules = co.modules || {}; const d = defaults(); let st = co.modules[ID];
    if (!st || typeof st !== 'object') st = co.modules[ID] = d;
    for (const k of Object.keys(d)) { if (st[k] === undefined || st[k] === null && d[k] !== null) st[k] = d[k]; }
    for (const k of ['flags', 'stats', 'deals', 'addons', 'broken', 'fairs', 'cool', 'molds', 'researchWeek', 'prevUnits', 'lastUnits']) { if (!st[k] || typeof st[k] !== 'object' || Array.isArray(st[k])) st[k] = d[k]; }
    for (const k of Object.keys(d.flags)) if (st.flags[k] === undefined) st.flags[k] = d.flags[k];
    for (const k of Object.keys(d.stats)) if (typeof st.stats[k] !== 'number') st.stats[k] = 0;
    if (!Array.isArray(st.equipment)) st.equipment = []; if (!Array.isArray(st.history)) st.history = [];
    st.tier = U.clamp(Math.floor(st.tier) || 0, 0, 4); if (!['auto', 'own', 'oem'].includes(st.mode)) st.mode = 'auto';
    for (let t = 1; t <= st.tier; t++) for (const e of (TIERS[t].includes || [])) if (!st.equipment.includes(e)) st.equipment.push(e);
    st.equipment = st.equipment.filter(e => EQBY[e]); for (const id of Object.keys(st.deals)) if (!DEALBY[id]) delete st.deals[id];
    /* partidas anteriores al módulo: las colecciones ya en venta no deben contar como demanda acumulada la primera semana */
    for (const g of (co.gameLog || [])) if (g && !g.soldOut && g.releaseWeek !== undefined && st.prevUnits[g.id] === undefined) st.prevUnits[g.id] = g.unitsSold || 0;
    recompute(co, st);
  }

  /* ---------- personal y capacidad ---------- */
  function staffList(co) { return co.staff.filter(s => s.assignment === ID); }
  function staffUnits(co) {
    let u = 0;
    for (const s of staffList(co)) { const w = s.role === 'tecnico' ? 1 : s.role === 'labtech' ? 0.75 : s.role === 'optico' ? 0.6 : 0.5; const lvl = typeof s.level === 'function' ? s.level() : 1; let f = w * (0.7 + 0.1 * Math.min(lvl, 5)) * Math.max(0.5, s.efficiency || 1); if (s.skills && s.skills.taller_cnc) f *= 1.15; if (s.state === 'vacation' || s.state === 'training') f *= 0.2; u += f; }
    return u;
  }
  function staffFactor(tier, units) { if (tier <= 0) return 0; if (tier === 1) return Math.min(1.3, 0.7 + 0.3 * units); return Math.min(1.3, 0.4 + 0.3 * Math.min(units, 2) + 0.1 * U.clamp(units - 2, 0, 3)); }
  function has(st, id) { return st.equipment.includes(id) && !st.broken[id]; }
  function owns(st, id) { return st.equipment.includes(id); }
  function hasSkill(co, skill) { return staffList(co).some(s => s.skills && s.skills[skill] && s.state !== 'vacation'); }
  function recompute(co, st) {
    const t = TIERS[st.tier]; let base = t.cap; for (const id of st.equipment) if (!st.broken[id]) base += EQBY[id].cap || 0;
    st.capacityBase = base; st.staffUnits = Math.round(staffUnits(co) * 100) / 100; st.staffFactor = Math.round(staffFactor(st.tier, st.staffUnits) * 100) / 100;
    st.capacityWeek = st.stoppedWeeks > 0 ? 0 : Math.round(base * st.staffFactor); st.qualityMax = t.qmax; st.techLevel = t.tech;
    st.unitCostBase = Math.round(matCost(co, st, 'acetato3').best * 10) / 10;
  }
  function monthlyCost(co) {
    const st = S(co); if (!st) return 0; const t = TIERS[st.tier]; let c = t.maint;
    for (const id of st.equipment) { if ((t.includes || []).includes(id)) continue; c += EQBY[id].maint || 0; }
    for (const id of Object.keys(st.deals)) c += DEALBY[id].monthly || 0;
    for (const id of Object.keys(st.addons)) if (st.addons[id] && ADDONBY[id]) c += ADDONBY[id].monthly || 0;
    return c;
  }

  /* ---------- requisitos genéricos ---------- */
  function reqText(co, st, r) {
    if (!r) return null; const miss = [];
    if (r.level && co.level < r.level) miss.push(C.LEVELS[r.level].name);
    if (r.research && !co.hasResearch(r.research)) { const it = DB.item(r.research); miss.push('investigar "' + (it ? it.name : r.research) + '"'); }
    if (r.equipo && !owns(st, r.equipo)) miss.push('tener ' + EQBY[r.equipo].name.split(' (')[0].split(':')[0]);
    if (r.date && !co.isLaterOrEqualThan(...r.date.split('/').map(Number))) miss.push('a partir de ' + (+r.date.split('/')[0] + 1994));
    if (r.chinaDeal && !Object.keys(st.deals).some(d => DEALBY[d].china)) miss.push('un acuerdo OEM con China');
    if (r.tier && st.tier < r.tier) miss.push(TIERS[r.tier].name);
    return miss.length ? 'Requiere ' + miss.join(', ') : null;
  }

  /* ---------- materiales y costes ---------- */
  function matOf(partId) { const m = MAT[partId]; if (!m) return null; const p = DB.part(partId); return Object.assign({ id: partId, name: p ? p.name : partId, capMult: 1 }, m); }
  function gameMaterial(g) {
    let best = null; for (const fid of (g.features || [])) { const m = matOf(fid); if (m && (!best || m.c > best.c)) best = m; }
    return best || Object.assign({}, MAT_DEFAULT);
  }
  function canMakeOwn(st, m) { if (st.tier < 1 || !m.own || !m.own.length) return false; return m.own.some(e => has(st, e)); }
  function tierDiscount(st) { return [1, 1, 0.9, 0.75, 0.65][st.tier]; }
  function ownCost(co, st, m) {
    let c = m.c * tierDiscount(st);
    if (m.g === 'inyectado' && has(st, 'inyectora_150t')) c = m.c * 0.4;
    if (m.g === 'acetato' && has(st, 'planta_acetato')) c *= 0.6;
    if (m.g === 'pa' && has(st, 'sls_industrial')) c *= 0.7;
    if (m.id === 'acetato5' && co.hasResearch('BioAcetato')) c *= 0.85;
    return c;
  }
  function providerCost(m) { return m.c * 1.4; }
  function dealReady(st, d, w) { const x = st.deals[d.id]; if (!x) return false; if (x.readyWeek > w) return false; if (d.china && st.flags.chinaOffUntil > w) return false; return true; }
  function dealCost(co, st, d, m) { let c = d.unit[m.g]; if (c === undefined) return null; if (hasSkill(co, 'sourcing')) c *= 0.9; if (d.china && st.tariffUntil > wk(co)) c *= 1 + st.tariff; return c; }
  function dealFor(co, st, m, g) {
    const w = wk(co); let best = null, bestC = Infinity;
    const consider = d => { if (!dealReady(st, d, w)) return; if (d.solOnly && g && g.genre !== 'sol' && g.secondGenre !== 'sol') return; const c = dealCost(co, st, d, m); if (c === null) return; if (st.preferredDeal === d.id) { best = d; bestC = -1; return; } if (c < bestC) { best = d; bestC = c; } };
    for (const d of DEALS) consider(d); return best;
  }
  function kitCost(co, st, g) {
    let k = { small: 1, medium: 1.5, large: 2, aaa: 3 }[g && g.size] || 1; const f = g && g.features || [];
    const add = { flex: 1.5, muelle: 2.5, sintornillos: 1, memoria: 3, estuche: 2, estuchepremium: 8, gamuza: 0.5, ecopack: 2.5, unboxing: 6, plaquetas: 0.3, inox: 0.05, funda: 0.5 };
    for (const fid of f) if (add[fid]) k += add[fid];
    return k * (st.tier === 0 ? 1.4 : st.tier >= 3 ? 0.8 : 1);
  }
  /* coste unitario posible de un material por las tres vías (para el panel) */
  function matCost(co, st, partId, g) {
    const m = matOf(partId) || MAT_DEFAULT; const own = canMakeOwn(st, m) ? ownCost(co, st, m) : null; const d = dealFor(co, st, m, g); const deal = d ? dealCost(co, st, d, m) : null; const prov = providerCost(m);
    const opts = [own, deal, prov].filter(x => x !== null); return { own, deal, dealId: d ? d.id : null, prov, best: Math.min(...opts) };
  }

  /* ---------- estimación de demanda (réplica determinista de Sales.calculateSales) ---------- */
  function estimateUnits(co, g, score) {
    const d = U.clamp(score || 7, 1, 10), f = d / 10, year = co.getCurrentDate().year;
    const k = Math.min(1.5e6, co.fans) + Math.max(0, co.fans - 1.5e6) / 10; const plats = (g.platforms || []).map(DB.platform).filter(Boolean); if (!plats.length) return 0;
    let minTech = 8; for (const p of plats) if (!p.isOwn) minTech = Math.min(minTech, p.techLevel); const week = wk(co); const m = [];
    for (let i = 0; i < plats.length; i++) { let v = plats[i].techLevel; if (plats[i].isOwn) v = minTech === 8 ? v : minTech; let A = 1; if (i === 0 && plats.length > 1) A = 0.7; else if (i === 1) A = plats.length === 2 ? 0.55 : 0.4; else if (i === 2) A = 0.3; m[i] = Platforms.marketSizeForWeek(plats[i], week) * A * (1 / v) * (minTech === 8 ? v : minTech); }
    let v, q = 1; if (d <= 9) { v = Math.pow(d, 3) / 100 * 0.2; if (co.level === 4) q = 1.25; } else { v = Math.pow(d, 3) / (100 - 35 * (d - 9)); q = year < 6 ? 0.65 : co.level === 4 ? 0.35 : 0.5; }
    v = v * q / 15 * 0.2 + 0.008; let sum = 0;
    for (let i = 0; i < plats.length; i++) { const vv = v * W.platformAudience([plats[i]], g.targetAudience); let t = Math.floor(m[i] * vv); if (g.hypePoints) { const c = Math.min(500, g.hypePoints) / 500; if (d >= 5) t += Math.floor((d - 5) / 5 * m[i] * c * 0.05); else t -= Math.floor(d / 5 * vv * 0.25 * c * m[i]); } t = Math.min(t, m[i]); if (i === 0) { if (g.flags && g.flags.royaltyRate) t = (t + Math.max(0, Sales.targetFans(g) - k) * f) * 10; else t += k * f; } else if (g.flags && g.flags.royaltyRate) t *= 10; sum += t; }
    return Math.max(0, (0.8 * f + 0.1) * sum * C.UNIT_SCALE);
  }
  function estimateDemandWeek(co, g, score) { return estimateUnits(co, g, score) / (C.SALES_LENGTH[g.size] || 10) * 1.3; }

  /* ---------- plan de producción de una colección ---------- */
  function plan(co, st, g, score) {
    const m = gameMaterial(g); const demand = estimateDemandWeek(co, g, score); const w = wk(co);
    const capOwn = canMakeOwn(st, m) && st.mode !== 'oem' ? st.capacityWeek * (m.capMult || 1) : 0;
    const deal = st.mode === 'own' ? null : dealFor(co, st, m, g); const provCap = PROVIDER_CAP[co.level] || 600;
    let own = Math.min(demand, capOwn), rest = demand - own, out = 0, prov = 0, lost = 0;
    if (deal) out = rest; else { prov = Math.min(rest, provCap); lost = rest - prov; }
    const served = demand - lost; const share = x => served > 0 ? x / served : 0;
    const oc = canMakeOwn(st, m) ? ownCost(co, st, m) : 0, dc = deal ? dealCost(co, st, deal, m) : 0, pc = providerCost(m);
    const unitMat = served > 0 ? share(own) * oc + share(out) * dc + share(prov) * pc : (deal ? dc : (capOwn > 0 ? oc : pc));
    const factor = demand > 0 ? U.clamp(served / demand, 0.35, 1) : 1;
    return { mat: m, group: m.g, demand, capOwn, own, out, prov, lost, ownShare: share(own), dealShare: share(out), provShare: share(prov), deal: deal ? deal.id : null, dealDelayed: deal ? (st.deals[deal.id].delayUntil || 0) > w : false, unitMat, kit: kitCost(co, st, g), unitCost: unitMat + kitCost(co, st, g), factor, week: w };
  }
  function normFactor(co, g) {
    const st = S(co); const plats = g.platforms || []; let f = 1; const sol = g.genre === 'sol';
    const REG = ['clinicas', 'mutuas', 'megaretail', 'central', 'farmacia', 'domicilio', 'techretail']; // canales que exigen la documentación MDR del fabricante
    if (!sol && !co.hasResearch('MDRClase1') && plats.some(p => REG.includes(p))) f = Math.min(f, 0.6);
    if (!co.hasResearch('ISO12870') && plats.some(p => p === 'clinicas' || p === 'mutuas')) f = Math.min(f, 0.6);
    if (sol && !co.hasResearch('EPISol') && plats.some(p => p !== 'tienda' && p !== 'mercadillos')) f = Math.min(f, 0.85);
    if (st && g.genre === 'premium' && st.flags.dateBonusUntil > wk(co) && plats.includes('boutiques')) f *= 1.1;
    return f;
  }

  /* =====================================================================
     4. GANCHOS DEL NÚCLEO
     ===================================================================== */
  function salesFactor(co, g) {
    const st = S(co); if (!st) return 1; recompute(co, st); const p = plan(co, st, g, g.score); g.flags = g.flags || {}; g.flags.tallerPlan = p;
    let f = p.factor * normFactor(co, g); const m = p.mat;
    if (p.lost > 0 && p.factor < 0.98) { G.notify('¡No damos abasto!', `${g.title} apunta a unas ${U.num(p.demand)} monturas por semana y entre el taller (${U.num(p.capOwn)}) y el proveedor genérico (${U.num(PROVIDER_CAP[co.level])}) solo llegamos a ${U.num(p.demand - p.lost)}. Perderemos un ${Math.round((1 - p.factor) * 100)} % de las ventas.\nAmplía el taller, contrata técnicos o firma un acuerdo de fabricación externa.`); }
    if (p.deal && DEALBY[p.deal].solOnly && (g.genre === 'sol') && (g.platforms || []).some(x => x === 'almacenes' || x === 'marketplace')) f *= 1.1;
    if (p.deal && DEALBY[p.deal].italia && st.flags.italiaOffUntil <= wk(co) && (g.platforms || []).includes('boutiques')) f *= 1.15;
    if (p.dealDelayed) f *= 0.85;
    if (m.g === 'pa' && g.genre === 'graduado' && has(st, 'escaner_facial')) f *= 1.15;
    if (m.lux && g.genre === 'premium') f *= 1.3;
    if (m.eco && g.topic === 'eco' && co.hasResearch('BioAcetato') && (st.researchWeek.BioAcetato || 0) + 144 > wk(co)) f *= 1.2;
    return U.clamp(f, 0.2, 1.6);
  }
  function unitCost(co, g) {
    const st = S(co); if (!st) return 0; const p = (g.flags && g.flags.tallerPlan && g.flags.tallerPlan.week === wk(co)) ? g.flags.tallerPlan : plan(co, st, g, g.score);
    return Math.round(p.unitCost * 100) / 100;
  }
  function scoreFactor(co, g) {
    const st = S(co); if (!st) return 1; recompute(co, st); const w = wk(co); const p = plan(co, st, g, g.score || 7); const m = p.mat; let s = 0;
    const tierQ = [0, 0.02, 0.04, 0.06, 0.08][st.tier]; s += tierQ * p.ownShare; if (st.tier === 1 && g.size === 'small') s += 0.01 * p.ownShare;
    let eq = 0; for (const id of st.equipment) { if (st.broken[id]) continue; const e = EQBY[id]; if (!e.q) continue; if (e.only && !e.only.includes(m.g)) continue; eq += e.q; } s += Math.min(0.08, eq) * p.ownShare;
    if (p.deal) { const d = DEALBY[p.deal]; let dq = d.q; if (d.china && dq < 0 && (has(st, 'qc_lab') || st.addons.inspector_china || hasSkill(co, 'sourcing'))) dq = 0; if (d.italia && st.flags.italiaOffUntil > w) dq = Math.min(dq, 0.01); if (d.japon && m.g === 'titanio') dq += 0.03; s += dq * p.dealShare; }
    if (co.hasResearch('ISO12870')) s += 0.02; if (st.addons.consultora_mdr || hasSkill(co, 'regulatorio')) s += 0.01;
    if (g.genre === 'sol' && !co.hasResearch('EPISol')) s -= 0.03;
    if (m.nickel && !co.hasResearch('SinNiquel') && !has(st, 'pvd_ip')) s -= 0.03;
    if (m.cheap && g.genre !== 'lectura' && g.genre !== 'sol') s -= 0.05;
    if (m.lux) s += g.genre === 'premium' ? 0.06 : -0.02;
    if (m.estilos && m.estilos.includes(g.topic)) s += 0.02; if (m.tipos && (m.tipos.includes(g.genre) || m.tipos.includes(g.secondGenre))) s += 0.01;
    if (co.hasResearch('TitanioIP') && (m.g === 'titanio' || m.g === 'metal')) s += 0.02;
    if (co.hasResearch('AcetatoFino') && (st.researchWeek.AcetatoFino || 0) + 96 > w && (g.topic === 'transparentes' || g.topic === 'minimal')) s += 0.03;
    if (co.hasResearch('BioAcetato') && (st.researchWeek.BioAcetato || 0) + 144 > w && g.topic === 'eco') s += 0.03;
    if (co.hasResearch('SmartGlasses') && g.topic === 'smart') s += 0.05;
    if (st.tier >= 2 && st.staffUnits < 1) s -= 0.03; if (st.stoppedWeeks > 0 || Object.keys(st.broken).length) s -= 0.02;
    if (p.lost > 0) s -= 0.03; if (st.flags.silmoDor) s += 0.05;
    return U.clamp(1 + s, 0.8, 1.2);
  }
  function hypeFactor(co) { const st = S(co); if (!st) return 1; let f = 1; for (const id of st.equipment) if (!st.broken[id] && EQBY[id].hype) f *= EQBY[id].hype; return f; }
  function candidateBonus(co) { const st = S(co); if (!st) return 0; return st.tier >= 4 ? 0.1 : st.tier === 3 ? 0.05 : 0; }

  function onCreateGame(co, g) {
    const st = S(co); if (!st || st.tier < 1) return;
    G.log(`Taller: capacidad ${U.num(st.capacityWeek)}/semana (${st.staffUnits >= 1 ? staffList(co).length + (staffList(co).length === 1 ? ' técnico' : ' técnicos') : 'sin técnicos asignados'}); el proveedor genérico sirve hasta ${U.num(PROVIDER_CAP[co.level])}/semana.`);
  }
  function onRelease(co, g) {
    const st = S(co); if (!st) return; const w = wk(co); const p = (g.flags && g.flags.tallerPlan) || plan(co, st, g, g.score);
    const mf = g.marginFactor || 1; const units = g.totalSalesCash > 0 ? g.totalSalesCash / (g.unitPrice * mf) : 0; const len = C.SALES_LENGTH[g.size] || 10;
    g.flags.taller = { mat: p.mat.id, group: p.group, deal: p.deal, ownShare: Math.round(p.ownShare * 100) / 100, dealShare: Math.round(p.dealShare * 100) / 100, provShare: Math.round(p.provShare * 100) / 100, unitCost: g.unitCost, units: Math.round(units), perWeek: Math.round(units / len), factor: Math.round(p.factor * 100) / 100, releaseWeek: w };
    delete g.flags.tallerPlan;
    if (p.deal) { const d = DEALBY[p.deal]; const x = st.deals[p.deal]; if (x) { x.uses = (x.uses || 0) + 1; x.lastUse = w; } if (d.china && st.addons.inspector_china) { co.adjustCash(-5000, 'Inspector en origen'); } }
    if (co.hasResearch('ISO12870') && !has(st, 'qc_lab')) co.adjustCash(-600, 'Ensayo ISO 12870');
    if (st.flags.silmoDor) { st.flags.silmoDor = false; G.log(`El premio de diseño del salón de París ha dado alas a ${g.title}.`); }
    if (p.ownShare > 0 && p.mat.g === 'inyectado' && (has(st, 'babyplast') || has(st, 'inyectora_150t')) && !st.molds[p.mat.id]) { st.molds[p.mat.id] = true; if (U.rnd() < 0.3) { const cost = has(st, 'inyectora_150t') ? 6000 : 2500; /* molde de acero 2.500–6.000 €; de aluminio, más barato */ G.notify('Molde con rechupes', `El primer molde de ${p.mat.name} ha salido con rechupes: las primeras piezas de ${g.title} tienen marcas en el frente.`, 'decision', { sourceId: 'taller:molde', gameId: g.id, cost, options: [`Repetir el molde (${money(cost)})`, 'Lanzar con rechupes (−10 % ventas)'] }); } }
    const src = p.ownShare >= 0.99 ? 'fabricada en casa' : p.deal ? `${pct(p.ownShare)} propia, ${pct(p.dealShare)} ${DEALBY[p.deal].name}` : st.tier >= 1 ? `${pct(p.ownShare)} propia, ${pct(p.provShare)} proveedor genérico` : 'proveedor genérico';
    const matName = p.mat.name || ((typeof DB !== 'undefined' && DB.part(p.mat.id)) || {}).name || 'material de catálogo'; G.log(`Taller: ${g.title} — ${matName}, ${src}. Coste unitario ${g.unitCost.toFixed(1)} € sobre ${g.unitPrice} € (margen ${Math.round(mf * 100)} %).`);
  }
  function onResearch(co, item) { const st = S(co); if (!st) return; st.researchWeek[item.id] = wk(co); const r = RESEARCH.find(x => x.id === item.id); if (r && r.noticia) G.log(r.noticia); recompute(co, st); }
  function onTraining(co, ch, tr) { const st = S(co); if (!st) return; recompute(co, st); if (tr.skill === 'taller_cnc' && ch.assignment === ID) G.log(`${ch.name} ya domina el CNC: la capacidad del taller sube.`); }
  function onAssign(co, ch, dept) { const st = S(co); if (!st) return; recompute(co, st); if (dept === ID && st.tier === 0) G.log(`${ch.name} está en el taller… pero no hay taller. Monta el atelier desde el panel del departamento.`); }

  /* ---------- semana ---------- */
  function activeGames(co) { return co.gameLog.filter(g => !g.soldOut && g.releaseWeek !== undefined); }
  function weekly(co, w) {
    const st = S(co); if (!st) return; recompute(co, st);
    let demand = 0; const seen = {};
    for (const g of activeGames(co)) { const prev = st.prevUnits[g.id] || 0; const delta = Math.max(0, (g.unitsSold || 0) - prev); st.prevUnits[g.id] = g.unitsSold || 0; st.lastUnits[g.id] = Math.round(delta); seen[g.id] = true; const t = g.flags && g.flags.taller; if (t) { const ownU = Math.round(delta * t.ownShare), outU = Math.round(delta * t.dealShare); st.stats.own += ownU; st.stats.out += outU; st.stats.prov += delta - ownU - outU; demand += delta; if (st.returnsUntil > w && t.group === 'acetato' && g.salesCashLog && g.salesCashLog.length) { const loss = Math.round(st.returnsRate * g.salesCashLog[g.salesCashLog.length - 1]); if (loss > 0) co.adjustCash(-loss, 'Devoluciones ' + g.title); } } else demand += delta; }
    for (const id of Object.keys(st.prevUnits)) if (!seen[id]) { delete st.prevUnits[id]; delete st.lastUnits[id]; }
    const made = Math.min(demand, st.capacityWeek); st.demandWeek = Math.round(demand); st.madeWeek = Math.round(made); st.busy = st.capacityWeek > 0 ? U.clamp(made / st.capacityWeek, 0, 1) : 0;
    st.history.push({ w, demand: Math.round(demand), own: Math.round(made), cap: st.capacityWeek }); if (st.history.length > 12) st.history.shift();
    if (st.flags.advanceUntil && w >= st.flags.advanceUntil) { const back = Math.round((st.flags.advanceCash || 0) * 0.97); if (back > 0) { co.adjustCash(back, 'Stock adelantado vendido'); G.log(`Hemos vendido el stock del pedido adelantado: recuperamos ${money(back)} (3 % de coste financiero).`); } st.flags.advanceCash = 0; st.flags.advanceUntil = 0; }
    if (st.stoppedWeeks > 0) { st.stoppedWeeks--; if (st.stoppedWeeks === 0) G.log('El taller vuelve a funcionar.'); }
    for (const id of Object.keys(st.broken)) { st.broken[id]--; if (st.broken[id] <= 0) { delete st.broken[id]; G.log(`${EQBY[id].name.split(' (')[0]}: reparación terminada.`); recompute(co, st); } }
    for (const g of co.gameLog.slice(-15)) { const t = g.flags && g.flags.taller; if (!t || !g.soldOut || t.closed) continue; t.closed = true; if (t.deal && DEALBY[t.deal]) { const d = DEALBY[t.deal]; const x = st.deals[t.deal]; const moq = Math.round(d.moq * (hasSkill(co, 'sourcing') ? 0.7 : 1)); const sold = Math.round((g.unitsSold || 0) * t.dealShare); const dead = moq - sold; if (dead > 0 && x) { const uc = (d.unit[t.group] || 20); G.notify('Stock muerto', `${g.title} se ha retirado y de las ${U.num(moq)} monturas del pedido mínimo a ${d.name} solo se vendieron ${U.num(sold)}. Quedan ${U.num(dead)} en el almacén (${money(dead * uc)} pagados).`, 'decision', { sourceId: 'taller:stock_muerto', dead, uc, options: ['Liquidarlas a un saldista (recuperas el 40 %)', 'Regalarlas a los clientes fieles'] }); } } }
    if (!(w % 4 === 2) && !(w % 4 === 0)) checkEvents(co, st, w); // dos oportunidades al mes
    const d = U.dateFromWeek(w); if (!Modules.get('marketing')) checkFairs(co, st, d);
    if (st.tier >= 1 && !st.flags.warnedCap && demand > st.capacityWeek + PROVIDER_CAP[co.level]) { st.flags.warnedCap = true; G.log('Taller: la demanda supera lo que fabricamos y lo que sirve el proveedor. Hay que ampliar.'); }
  }
  function monthly(co) {
    const st = S(co); if (!st) return;
    for (const id of st.equipment) { const e = EQBY[id]; if (e.fail && !st.broken[id] && U.rnd() < e.fail) { st.broken[id] = 2; const cost = Math.round(e.cost * 0.05); co.adjustCash(-cost, 'Avería ' + e.name.split(' (')[0]); st.stats.repairs += cost; G.notify('Avería en el taller', `${e.name.split(' (')[0]} se ha averiado. Dos semanas de reparación y ${money(cost)} de recambios.`, 'news'); } if (e.income && !st.broken[id]) co.adjustCash(e.income, 'Venta de planchas'); }
    if (st.tier >= 1 && st.history.length) { const dem = st.history.slice(-4).reduce((s, h) => s + h.demand, 0), own = st.history.slice(-4).reduce((s, h) => s + h.own, 0); if (dem > 0) G.log(`Taller: ${U.num(own)} de ${U.num(dem)} monturas fabricadas en casa este mes (${pct(own / dem)}). Mantenimiento ${money(monthlyCost(co))}.`); }
    recompute(co, st);
  }

  /* ---------- eventos de riesgo (probabilidad anual → 24 comprobaciones/año) ----------
     contenedor = EVT_MON_02 (Año Nuevo chino / cierre de agosto en el Cadore, solo en los meses previos);
     aduana = EVT_MON_01 (retención en Sanidad Exterior sin ensayo de níquel); bombos = EVT_MON_03; editorial = EVT_MON_04. */
  const monthOf = w => (U.dateFromWeek(w) || {}).month || 0;
  const acetatoOwnGame = co => activeGames(co).find(x => x.flags.taller && x.flags.taller.group === 'acetato' && x.flags.taller.ownShare > 0.3);
  const EVENTS = [
    { id: 'incendio', p: 0.12, when: (co, st) => st.tier >= 2 && !has(st, 'cabina_pulido') && st.stoppedWeeks === 0, fire: (co, st) => { const cost = st.tier >= 3 ? 60000 : 15000; G.notify('¡Incendio en la zona de pulido!', 'Las virutas y el polvo del fresado acumulados junto a la mopa caliente han prendido. Nadie ha resultado herido, pero el taller queda parado.', 'decision', { sourceId: 'taller:incendio', cost, options: [`Reparar deprisa (${money(cost)}, 1 semana parados)`, 'Esperar al seguro (gratis, 3 semanas parados)'] }); } },
    { id: 'contenedor', p: 1.2, when: (co, st, w) => { const mo = monthOf(w); return DEALS.some(d => dealReady(st, d, w) && !(st.deals[d.id].delayUntil > w) && ((d.china && (mo === 12 || mo === 1) && (!st.addons.transitario || U.rnd() < 0.5)) || (d.italia && (mo === 6 || mo === 7)))); },
      fire: (co, st, w) => {
        const mo = monthOf(w); const act = DEALS.filter(x => st.deals[x.id] && (x.china || x.italia)); if (!act.length) return;
        const d = act.find(x => x.italia && mo >= 5 && mo <= 8) || act.find(x => x.china) || act[0]; const moq = st.deals[d.id].moq || d.moq;
        const advance = Math.round(moq * Math.min(...Object.values(d.unit))); const air = Math.round(moq * (d.china && st.addons.transitario ? 1.6 : 2.2) + (d.china ? 1500 : 800));
        const delay = d.china ? 6 + Math.floor(U.rnd() * 6) : 4 + Math.floor(U.rnd() * 4);
        const head = d.china ? 'Año Nuevo chino' : 'Cierre de agosto en el Cadore';
        const txt = d.china ? `Las fábricas de ${d.name.split(' — ')[1] || 'China'} cierran tres o cuatro semanas por el Año Nuevo chino y, a la vuelta, falta personal. Si no movemos ficha, el próximo pedido llegará ${delay} semanas tarde, en plena campaña de primavera.` : `Los talleres del Cadore cierran todo agosto y en julio ya no aceptan pedidos nuevos. Si no movemos ficha, la reposición de ${d.name} llegará ${delay} semanas tarde.`;
        G.notify(head, txt, 'decision', { sourceId: 'taller:contenedor', dealId: d.id, delay, air, advance, options: [`Adelantar el pedido (${money(advance)} de tesorería inmovilizada unas 12 semanas)`, `Pedir tarde y traerlo por avión (${money(air)})`, d.china ? `Esperar al barco (colecciones con este fabricante −15 % de ventas durante ${delay} semanas)` : `Esperar a septiembre (colecciones con este fabricante −15 % de ventas durante ${delay} semanas)`] });
      } },
    { id: 'niquel', p: 0.4, when: co => activeGames(co).some(g => g.flags.taller && MAT[g.flags.taller.mat] && MAT[g.flags.taller.mat].nickel) && !co.hasResearch('SinNiquel') && !has(S(co), 'pvd_ip'), fire: co => { const g = activeGames(co).find(x => x.flags.taller && MAT[x.flags.taller.mat] && MAT[x.flags.taller.mat].nickel); if (!g) return; const cost = Math.max(2000, Math.round(3 * (g.unitsSold || 0))); G.notify('Brote de alergias al níquel', `Varios clientes de ${g.title} han venido con eccema en el puente de la nariz y detrás de las orejas. La aleación de níquel y cobre libera más níquel del que permite REACH (0,5 µg/cm² por semana).`, 'decision', { sourceId: 'taller:niquel', gameId: g.id, cost, options: [`Retirar y cambiar plaquetas y terminales (${money(cost)})`, 'Ignorarlo (−3 % clientes fieles, −10 % ventas)'] }); } },
    { id: 'made_in', p: 0.2, when: (co, st, w) => DEALS.some(d => d.italia && st.deals[d.id]) && DEALS.some(d => d.china && st.deals[d.id]) && st.flags.italiaOffUntil <= w, fire: (co, st) => { G.notify('"Made in Italy" cuestionado', 'Un programa de televisión investiga marcas que montan en Italia frentes y varillas fabricados en China. Nuestro nombre aparece en la lista.', 'decision', { sourceId: 'taller:made_in', options: ['Cambiar la etiqueta a "Diseñado en España" (sin bonus italiano un año)', 'Defender el "Made in Italy" (posible multa y pérdida de clientes)'] }); } },
    { id: 'falsificaciones', p: 0.3, when: co => activeGames(co).some(g => (g.unitsSold || 0) > 15000 && !g.flags.tallerFake && !(g.features || []).some(f => f === 'laser' || f === 'edicionlimitada')), fire: co => { const g = activeGames(co).find(x => (x.unitsSold || 0) > 15000 && !x.flags.tallerFake && !(x.features || []).some(f => f === 'laser' || f === 'edicionlimitada')); if (!g) return; g.flags.tallerFake = true; G.notify('Copias en internet', `${g.title} es un éxito… y ya hay copias a 15 € en una plataforma de venta asiática. Sin grabado láser ni numeración en la varilla, cuesta demostrar cuál es la original.`, 'decision', { sourceId: 'taller:falsificaciones', gameId: g.id, options: ['Denunciar y retirar anuncios (20.000 €, −7 % ventas)', 'Dejarlo pasar (−15 % ventas)'] }); } },
    { id: 'aemps', p: 0.3, when: (co, st) => !co.hasResearch('MDRClase1') && !st.addons.consultora_mdr && !hasSkill(co, 'regulatorio') && activeGames(co).some(g => g.genre !== 'sol' && (g.platforms || []).some(p => p !== 'tienda' && p !== 'mercadillos')), fire: co => { const g = activeGames(co).find(x => x.genre !== 'sol' && (x.platforms || []).some(p => p !== 'tienda' && p !== 'mercadillos')); if (!g) return; G.notify('Inspección de producto sanitario', `Un inspector de la AEMPS pide la Declaración UE de conformidad, la documentación técnica y el UDI-DI de ${g.title}. No estamos registrados como fabricante de producto sanitario de clase I.`, 'decision', { sourceId: 'taller:aemps', gameId: g.id, options: ['Regularizar ya (registro 8.000 € + multa 3.000 €)', 'Recurrir (multa 10.000 € y −15 % ventas)'] }); } },
    { id: 'arancel', p: 0.5, when: (co, st, w) => st.tariffUntil <= w && activeGames(co).some(g => g.flags.taller && g.flags.taller.deal && DEALBY[g.flags.taller.deal] && DEALBY[g.flags.taller.deal].china && (g.platforms || []).some(p => ['megaretail', 'central', 'techretail'].includes(p))), fire: (co, st) => { const t = 0.1 + Math.round(U.rnd() * 20) / 100; G.notify('Arancel a las monturas chinas', `Bruselas impone un arancel antidumping provisional del ${Math.round(t * 100)} % a las monturas fabricadas en China. Nuestras colecciones para las grandes cadenas se encarecen.`, 'decision', { sourceId: 'taller:arancel', tariff: t, options: ['Trasladar la producción (OEM chino parado 6 meses)', `Asumir el arancel (+${Math.round(t * 100)} % de coste un año)`] }); } },
    { id: 'encogimiento', p: 0.25, when: (co, st) => st.tier >= 1 && st.tier <= 2 && !has(st, 'bombos_serie') && !has(st, 'lab_color') && !!acetatoOwnGame(co), fire: co => { const g = acetatoOwnGame(co); if (!g) return; const cost = Math.max(1000, Math.round(2 * (g.unitsSold || 0))); G.notify('El acetato encoge', `Las monturas de ${g.title} se están cerrando: el acetato no estaba bien curado y las lentes saltan del galce. Los clientes vuelven con las gafas en la mano.`, 'decision', { sourceId: 'taller:encogimiento', gameId: g.id, cost, options: [`Recalar las lentes gratis (${money(cost)})`, 'Cambiar las monturas que fallen (devoluciones 2 meses, −2 % clientes)'] }); } },
    { id: 'aduana', p: 0.5, when: (co, st, w) => DEALS.some(d => d.china && dealReady(st, d, w)) && !(has(st, 'qc_lab') && co.hasResearch('MDRClase1')),
      fire: (co, st) => {
        const d = DEALS.find(x => x.china && st.deals[x.id]); if (!d) return; const lot = st.deals[d.id].moq || d.moq; const uc = d.unit.metal || Math.min(...Object.values(d.unit)); const loss = Math.round(lot * uc); const test = 550;
        G.notify('Lote retenido en la aduana', `Sanidad Exterior ha retenido en el puerto un lote de ${U.num(lot)} monturas de ${d.name}. Pide la Declaración UE de conformidad (producto sanitario de clase I), el UDI-DI y el ensayo de liberación de níquel (EN 16128) de las piezas metálicas.`, 'decision', { sourceId: 'taller:aduana', dealId: d.id, lot, loss, test, options: [`Presentar la documentación y pagar el ensayo de níquel (${money(test)}; el lote sale en 5 días)`, `Reclamarlo sin ensayo (si no pasa, destruyen el lote: ${money(loss)} y expediente de la AEMPS)`] });
      } },
    { id: 'bombos', p: 0.4, when: (co, st) => st.tier >= 1 && st.tier <= 3 && (has(st, 'bombo_hobby') || has(st, 'bombos_serie') || has(st, 'bombos_industriales')) && !!acetatoOwnGame(co),
      fire: (co, st) => {
        const g = acetatoOwnGame(co) || activeGames(co)[0]; if (!g) return; const cost = has(st, 'bombos_industriales') ? 2500 : has(st, 'bombos_serie') ? 600 : 250;
        G.notify('Bombos de pulido contaminados', `Una tanda de frentes de ${g.title} ha salido del bombo con rayas y manchas: los chips de madera de haya y la pasta se han contaminado con restos de abrasivo grueso.`, 'decision', { sourceId: 'taller:bombos', gameId: g.id, cost, options: [`Vaciar los tambores, cambiar chips y pastas y repetir el ciclo de 72 h (${money(cost)}, unos días de retraso)`, 'Pulir a mano con la mopa para salir del paso (marcas de calor en los frentes: −5 % de ventas)'] });
      } },
    { id: 'editorial', p: 0.3, when: (co, st, w) => (st.tier >= 1 || DEALS.some(d => dealReady(st, d, w))) && activeGames(co).some(g => (g.score || 0) >= 7),
      fire: (co, st, w) => {
        const games = activeGames(co); if (!games.length) return; const g = games.slice().sort((a, b) => (b.score || 0) - (a.score || 0))[0];
        const canMake = st.capacityWeek * 4 >= 300 || DEALS.some(d => dealReady(st, d, w)); const uc = g.unitCost || (g.flags.taller && g.flags.taller.unitCost) || 15;
        const gain = Math.max(0, Math.round(300 * ((g.unitPrice || 70) * (g.marginFactor || 1) - uc)));
        G.notify('Una revista de moda elige nuestra montura', `Un estilista ha elegido ${g.title} para un editorial de moda. Si tenemos stock cuando salga el número, se agotará en un mes.`, 'decision', { sourceId: 'taller:editorial', gameId: g.id, gain, canMake, options: [`Lanzar una tirada rápida de 300 monturas (≈${money(canMake ? gain : gain * 0.5)} de margen${canMake ? '' : '; sin capacidad, solo llegaremos a la mitad'})`, 'Mandar solo el muestrario de prensa (algo de expectación para la próxima colección)'] });
      } }
  ];
  function checkEvents(co, st, w) {
    for (const ev of EVENTS) { if ((st.cool[ev.id] || 0) > w) continue; const p = ev.p / 24; if (U.rnd() >= p) continue; let ok = false; try { ok = ev.when(co, st, w); } catch (e) { console.error('taller event', ev.id, e); } if (!ok) continue; st.cool[ev.id] = w + 24; ev.fire(co, st, w); return ev.id; }
    return null;
  }
  function fireEvent(co, id) { const st = S(co); const ev = EVENTS.find(e => e.id === id); if (!ev || !st) return false; const before = co.notifications.length; ev.fire(co, st, wk(co)); return co.notifications.length > before; }
  function cutSales(g, frac) { if (!g || g.soldOut) return 0; const rem = Math.max(0, (g.totalSalesCash || 0) - (g.currentSalesCash || 0)); const cut = Math.round(rem * frac); g.totalSalesCash -= cut; return cut; }
  function onDecision(co, sourceId, choice, n) {
    const st = S(co); if (!st || !sourceId || sourceId.indexOf('taller:') !== 0) return; n = n || {}; const w = wk(co); const g = n.gameId ? co.gameLog.find(x => x.id === n.gameId) : null; const fine = (v, label) => { co.adjustCash(-v, label); st.stats.fines += v; };
    switch (sourceId) {
      case 'taller:incendio': if (choice === 0) { co.adjustCash(-(n.cost || 15000), 'Reparación tras incendio'); st.stoppedWeeks = 1; } else st.stoppedWeeks = 3; G.log(choice === 0 ? 'Taller reparado a toda prisa: una semana parados.' : 'Esperamos al perito del seguro: tres semanas sin fabricar.'); break;
      case 'taller:contenedor': { const x = st.deals[n.dealId]; if (!x) break;
        if (choice === 0 && n.advance) { co.adjustCash(-n.advance, 'Pedido adelantado ' + DEALBY[n.dealId].name); st.flags.advanceCash = (st.flags.advanceCash || 0) + n.advance; st.flags.advanceUntil = w + 12; G.log('Pedido adelantado: el stock llegará a tiempo y la tesorería se recupera al venderlo.'); }
        else if (choice === 0 || choice === 1) { co.adjustCash(-(n.air || 5000), 'Envío urgente por avión'); G.log('El pedido llega en avión: salvamos la campaña, pero con menos margen.'); }
        else { x.delayUntil = w + (n.delay || 8); G.log(`El pedido llegará ${n.delay || 8} semanas tarde.`); } break; }
      case 'taller:niquel': if (choice === 0) { co.adjustCash(-(n.cost || 2000), 'Retirada por níquel'); G.log('Plaquetas y terminales sustituidos: los clientes lo agradecen.'); } else { co.adjustFans(-Math.floor(co.fans * 0.03)); cutSales(g, 0.1); G.log('Las quejas por el níquel corren de boca en boca.'); } break;
      case 'taller:molde': if (choice === 0) co.adjustCash(-(n.cost || 2500), 'Molde nuevo'); else { cutSales(g, 0.1); co.adjustFans(-Math.floor(co.fans * 0.01)); } break;
      case 'taller:stock_muerto': { const loss = Math.round((n.dead || 0) * (n.uc || 20)); if (choice === 0) { co.adjustCash(Math.round(loss * 0.4), 'Liquidación de stock'); st.stats.deadLoss += Math.round(loss * 0.6); G.log(`Stock liquidado al 40 %: recuperamos ${money(loss * 0.4)}.`); } else { const f = Math.floor((n.dead || 0) * 2 + co.fans * 0.005); co.adjustFans(f); st.stats.deadLoss += loss; G.log(`Regalamos ${U.num(n.dead || 0)} monturas: ganamos ${U.num(f)} clientes fieles.`); } break; }
      case 'taller:made_in': if (choice === 0) { st.flags.italiaOffUntil = w + 48; G.log('Nueva etiqueta: "Diseñado en España". Sin bonus de origen italiano durante un año.'); } else if (U.rnd() < 0.5) { const f = Math.min(50000, Math.round(Math.max(0, co.cash) * 0.02) + 5000); fine(f, 'Multa por etiquetado'); co.adjustFans(-Math.floor(co.fans * 0.05)); G.notify('Sanción', `La autoridad de consumo nos multa con ${money(f)} por el etiquetado de origen y perdemos un 5 % de clientes fieles.`, 'news'); } else G.log('La polémica del "Made in Italy" se desinfla sin consecuencias.'); break;
      case 'taller:falsificaciones': if (choice === 0) { fine(20000, 'Abogados antifalsificación'); cutSales(g, 0.07); } else cutSales(g, 0.15); break;
      case 'taller:aemps': if (choice === 0) { fine(11000, 'Registro MDR y multa'); if (!co.hasResearch('MDRClase1')) { co.researchCompleted.push('MDRClase1'); co.availableResearch = co.availableResearch.filter(x => x !== 'MDRClase1'); st.researchWeek.MDRClase1 = w; } G.log('Registro de fabricante de producto sanitario de clase I completado por la vía rápida.'); } else { fine(10000, 'Multa AEMPS'); cutSales(g, 0.15); } break;
      case 'taller:arancel': if (choice === 0) { st.flags.chinaOffUntil = w + 24; G.log('Producción china suspendida seis meses.'); } else { st.tariff = n.tariff || 0.15; st.tariffUntil = w + 48; } break;
      case 'taller:encogimiento': if (choice === 0) co.adjustCash(-(n.cost || 1000), 'Recalado de lentes'); else { st.returnsUntil = w + 8; st.returnsRate = 0.15; co.adjustFans(-Math.floor(co.fans * 0.02)); } break;
      case 'taller:aduana': { if (choice === 0) { co.adjustCash(-(n.test || 550), 'Ensayo de níquel y gestoría'); G.log('Documentación presentada y ensayo de níquel superado: el lote sale de la aduana en cinco días.'); break; }
        if (U.rnd() < 0.6) { const loss = n.loss || 2400; co.adjustCash(-loss, 'Lote destruido en aduana'); st.stats.deadLoss += loss; fine(3000, 'Expediente AEMPS'); const x = st.deals[n.dealId]; if (x) x.delayUntil = Math.max(x.delayUntil || 0, w + 6); G.notify('Lote destruido', `El lote supera el límite de liberación de níquel: Sanidad lo inmoviliza y lo destruye (${money(loss)}) y la AEMPS nos abre expediente (3.000 €). Hay que repetir el pedido: seis semanas de retraso.`, 'news'); }
        else G.log('Esta vez la inspección deja pasar el lote sin ensayo. Hemos tenido suerte.'); break; }
      case 'taller:bombos': if (choice === 0) { co.adjustCash(-(n.cost || 600), 'Recarga de bombos'); G.log('Bombos vaciados y recargados: acabado espejo tras repetir el ciclo.'); } else { cutSales(g, 0.05); co.adjustFans(-Math.floor(co.fans * 0.005)); G.log('Pulido a mano con la mopa: algunos frentes llevan marcas de calor.'); } break;
      case 'taller:editorial': if (choice === 0) { const got = Math.round((n.gain || 0) * (n.canMake === false ? 0.5 : 1)); if (got) co.adjustCash(got, 'Tirada para editorial de moda'); co.adjustFans(Math.floor(co.fans * 0.01 + 100)); G.log(`La tirada del editorial se agota en un mes: ${money(got)} de margen.`); } else { co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + 25; co.adjustFans(Math.floor(co.fans * 0.003)); G.log('Muestrario enviado: la revista nos cita y la próxima colección llega con algo de expectación.'); } break;
      default: if (sourceId.indexOf('taller:feria_') === 0) { const f = FAIRS.find(x => 'taller:feria_' + x.id === sourceId); if (f && choice === 0) bookFair(co, st, f); }
    }
  }

  /* ---------- ferias ---------- */
  function checkFairs(co, st, d) {
    for (const f of FAIRS) { if (d.month !== f.month || d.week !== f.week) continue; const key = f.id + '-' + d.year; if (st.fairs[key]) continue; if (co.level < f.level || (f.research && !co.hasResearch(f.research))) continue; st.fairs[key] = 'asked'; G.notify(f.name, `${f.desc}\nUn stand pequeño cuesta ${money(f.cost)}.`, 'decision', { sourceId: 'taller:feria_' + f.id, options: [`Reservar stand (${money(f.cost)})`, 'Este año no'] }); }
  }
  function bookFair(co, st, f) {
    if (co.cash < f.cost) { G.notify(f.name, 'No tenemos dinero para el stand. Otro año será.', 'news'); return; }
    co.adjustCash(-f.cost, 'Stand ' + f.name); const w = wk(co); st.fairs[f.id + '-' + co.getCurrentDate().year] = 'done';
    const hype = Math.floor(f.hype * (0.8 + 0.4 * U.rnd())); if (co.currentGame) co.currentGame.hypePoints += hype; else co.flags.nextGameHypeBonus = (co.flags.nextGameHypeBonus || 0) + hype;
    const fans = Math.floor(co.fans * f.fans + 200); co.adjustFans(fans); let extra = '';
    if (f.id === 'mido') { st.flags.italiaContactUntil = w + 48; extra = ' Hemos hecho contactos en el Cadore: los acuerdos italianos salen un 25 % más baratos durante un año.'; }
    if (f.id === 'silmo' && U.rnd() < 0.15) { st.flags.silmoDor = true; extra = ' ¡Hemos ganado el premio de diseño del salón! La próxima colección subirá de nota.'; }
    if (f.id === 'date') { st.flags.dateBonusUntil = w + 48; extra = ' Las boutiques independientes nos han fichado: +10 % de ventas Premium en boutiques un año.'; }
    G.notify(f.name, `Feria terminada: ${hype} puntos de expectación y ${U.num(fans)} clientes fieles nuevos.${extra}`);
  }

  /* =====================================================================
     5. ACCIONES DEL PANEL
     ===================================================================== */
  function canUpgrade(co, st) {
    const nx = TIERS[st.tier + 1]; if (!nx) return { ok: false, msg: 'Ya tienes el taller más grande posible.' };
    if (co.level < nx.level) return { ok: false, msg: `Necesitas ${C.LEVELS[nx.level].name}.` };
    if (nx.research && !co.hasResearch(nx.research)) return { ok: false, msg: `Investiga "${DB.research(nx.research).name}" primero.` };
    if (co.cash < nx.capex) return { ok: false, msg: `Faltan ${money(nx.capex - co.cash)}.` };
    return { ok: true };
  }
  function upgrade(co, st) {
    const c = canUpgrade(co, st); if (!c.ok) return c; const nx = TIERS[st.tier + 1]; co.adjustCash(-nx.capex, 'Taller: ' + nx.name); st.tier = nx.tier; st.stats.upgrades++;
    for (const e of (nx.includes || [])) if (!st.equipment.includes(e)) st.equipment.push(e);
    recompute(co, st);
    const txt = { 1: 'Ya tenemos atelier: banco de artesano, sierra de marquetería, limas, ventilete y las primeras planchas de acetato. Asígnate (o asigna a alguien) al taller para fabricar más deprisa.', 2: 'El centro de fresado CNC de 3 ejes ya está en marcha. Sin operarios asignados el taller rinde al 40 %: contrata y asigna personal de taller.', 3: 'La fábrica mediana está lista: ahora podemos añadir inyectora, línea de metal, soldadura en argón, galvánica, laboratorio de color y laboratorio de ensayos.', 4: 'Bienvenidos a la manufactura. Veinte mil monturas a la semana con el sello de la casa.' }[nx.tier];
    G.log(`${nx.name}: ${txt}`); return { ok: true, msg: 'Taller ampliado' };
  }
  function canBuy(co, st, e) {
    if (owns(st, e.id)) return { ok: false, msg: 'Ya lo tienes.' }; if (st.tier < e.tier) return { ok: false, msg: `Requiere ${TIERS[e.tier].name}.` };
    const r = reqText(co, st, e.req); if (r) return { ok: false, msg: r + '.' }; if (co.cash < e.cost) return { ok: false, msg: `Faltan ${money(e.cost - co.cash)}.` }; return { ok: true };
  }
  function buy(co, st, id) { const e = EQBY[id]; if (!e) return { ok: false, msg: 'Equipo desconocido' }; const c = canBuy(co, st, e); if (!c.ok) return c; co.adjustCash(-e.cost, 'Equipo: ' + e.name.split(' (')[0]); st.equipment.push(id); recompute(co, st); G.log(`Nuevo equipo en el taller: ${e.name.split(' (')[0]}.`); return { ok: true, msg: 'Comprado' }; }
  function dealFee(st, d, w) { return Math.round(d.fee * (d.italia && st.flags.italiaContactUntil > w ? 0.75 : 1)); }
  function dealPrepaid(co, st, d) { const moq = Math.round(d.moq * (hasSkill(co, 'sourcing') ? 0.7 : 1)); const costs = Object.keys(d.unit).map(k => d.unit[k]); return { moq, amount: Math.round(moq * Math.min(...costs)) }; }
  function canSign(co, st, d) {
    if (st.deals[d.id]) return { ok: false, msg: 'Acuerdo ya firmado.' }; const r = reqText(co, st, d.req); if (r) return { ok: false, msg: r + '.' };
    const w = wk(co); const total = dealFee(st, d, w) + dealPrepaid(co, st, d).amount; if (co.cash < total) return { ok: false, msg: `Faltan ${money(total - co.cash)} (cuota + pedido mínimo).` }; return { ok: true };
  }
  function sign(co, st, id) {
    const d = DEALBY[id]; if (!d) return { ok: false, msg: 'Acuerdo desconocido' }; const c = canSign(co, st, d); if (!c.ok) return c; const w = wk(co); const pre = dealPrepaid(co, st, d);
    co.adjustCash(-dealFee(st, d, w), 'Acuerdo ' + d.name); co.adjustCash(-pre.amount, 'Pedido mínimo ' + d.name); let lead = d.lead; if (d.china && st.addons.transitario) lead = Math.max(2, lead - 4);
    st.deals[id] = { since: w, readyWeek: w + lead, moq: pre.moq, uses: 0 }; G.log(`Acuerdo firmado · ${d.name}: las primeras muestras y el pedido mínimo (${U.num(pre.moq)} uds.) llegarán en ${lead} semanas. A partir de entonces el acuerdo cubre toda la demanda que el taller no alcance.`); return { ok: true, msg: 'Acuerdo firmado' };
  }
  function cancel(co, st, id) { if (!st.deals[id]) return { ok: false, msg: 'No hay acuerdo.' }; delete st.deals[id]; if (st.preferredDeal === id) st.preferredDeal = null; for (const a of Object.keys(st.addons)) { const ad = ADDONBY[a]; if (ad && ad.req && ad.req.chinaDeal && !Object.keys(st.deals).some(x => DEALBY[x].china)) delete st.addons[a]; } G.log(`Acuerdo con ${DEALBY[id].name} cancelado.`); return { ok: true, msg: 'Acuerdo cancelado' }; }
  function toggleAddon(co, st, id) {
    const a = ADDONBY[id]; if (!a || a.auto) return { ok: false, msg: 'Servicio no contratable.' };
    if (st.addons[id]) { delete st.addons[id]; return { ok: true, msg: 'Servicio cancelado' }; }
    const r = reqText(co, st, a.req); if (r) return { ok: false, msg: r + '.' }; if (co.cash < (a.fee || 0)) return { ok: false, msg: `Faltan ${money(a.fee - co.cash)}.` };
    if (a.fee) co.adjustCash(-a.fee, a.name); st.addons[id] = true; return { ok: true, msg: 'Servicio contratado' };
  }
  function startResearch(co, st, id) {
    const it = DB.research(id); if (!it) return { ok: false, msg: 'Investigación desconocida.' }; if (co.hasResearch(id)) return { ok: false, msg: 'Ya investigado.' };
    if (!co.researchEnabled) return { ok: false, msg: 'La investigación se desbloquea tras la primera colección.' }; if (it.req && !it.req(co)) return { ok: false, msg: 'Todavía no está disponible.' };
    const staff = co.staff.find(s => s.isIdle()); if (!staff) return { ok: false, msg: 'Nadie está libre para investigar.' };
    if (co.researchPoints < (it.pointsCost || 0)) return { ok: false, msg: `Faltan ${it.pointsCost - co.researchPoints} puntos de investigación.` }; if (co.cash < (it.cost || 0)) return { ok: false, msg: `Faltan ${money(it.cost - co.cash)}.` };
    if (!co.availableResearch.includes(id)) co.availableResearch.push(id); if (!G.startResearch(id, staff)) return { ok: false, msg: 'No se ha podido iniciar.' }; return { ok: true, msg: `${staff.name} investiga "${it.name}"` };
  }
  function action(co, act, id, value) {
    const st = S(co); if (!st) return { ok: false, msg: 'Sin estado' };
    switch (act) {
      case 'upgrade': return upgrade(co, st);
      case 'buy': return buy(co, st, id);
      case 'sign': return sign(co, st, id);
      case 'cancel': return cancel(co, st, id);
      case 'addon': return toggleAddon(co, st, id);
      case 'research': return startResearch(co, st, id);
      case 'pref': st.preferredDeal = st.preferredDeal === id ? null : id; return { ok: true, msg: st.preferredDeal ? 'Acuerdo preferido' : 'Sin preferencia' };
      case 'mode': if (['auto', 'own', 'oem'].includes(value)) st.mode = value; return { ok: true, msg: { auto: 'Modo automático', own: 'Solo fabricación propia', oem: 'Todo fuera' }[st.mode] };
    }
    return { ok: false, msg: 'Acción desconocida' };
  }

  /* =====================================================================
     6. PANEL DEL DEPARTAMENTO
     ===================================================================== */
  function injectCss() {
    try {
      if (typeof document === 'undefined' || !document.head || (document.getElementById && document.getElementById('css-taller'))) return;
      const s = document.createElement('style'); s.id = 'css-taller';
      s.textContent = `.dept-taller .dt-top{display:grid;grid-template-columns:1.4fr 1fr;gap:10px}.dept-taller .dt-box{background:#fff;border:1px solid #d6c9b3;border-radius:8px;padding:8px 10px}.dept-taller .dt-kv{display:flex;flex-wrap:wrap;gap:4px 14px;font-size:12.5px;margin:6px 0}.dept-taller .dt-kv b{font-size:13px}.dept-taller .dt-chart{display:flex;align-items:flex-end;gap:5px;height:70px;padding:4px 6px;background:#fff;border:1px solid #d6c9b3;border-radius:8px}.dept-taller .dt-col{flex:1;display:flex;align-items:flex-end;gap:1px;height:100%;position:relative}.dept-taller .dt-col i{flex:1;border-radius:2px 2px 0 0;min-height:2px}.dept-taller .dt-col i.dem{background:#c9b996}.dept-taller .dt-col i.own{background:#e67e22}.dept-taller .dt-col i.cap{background:#3498db;opacity:.5}.dept-taller .dt-col span{position:absolute;bottom:-14px;left:0;right:0;text-align:center;font-size:9px;color:#777}.dept-taller .dt-leg{font-size:11px;color:#6b5f55;margin:16px 0 4px}.dept-taller .dt-leg i{display:inline-block;width:10px;height:10px;border-radius:2px;vertical-align:middle;margin:0 3px 0 8px}.dept-taller .dt-chips{display:flex;flex-wrap:wrap;gap:5px;margin:4px 0}.dept-taller .dt-chip{background:#fdebd5;border:1px solid #e67e22;border-radius:12px;padding:2px 8px;font-size:11.5px}.dept-taller .dt-chip.off{background:#f3dede;border-color:#c0392b}.dept-taller .dt-chip.inc{background:#e9f7ef;border-color:#27ae60}.dept-taller .dt-tabs{display:flex;gap:4px;flex-wrap:wrap;margin:10px 0 4px}.dept-taller .dt-tabs button{background:#ece4d4;border:1px solid #d6c9b3;border-radius:6px 6px 0 0;padding:5px 10px;cursor:pointer;font-size:12.5px;font-weight:600}.dept-taller .dt-tabs button.on{background:#fff;border-bottom-color:#fff}.dept-taller .dt-sec{display:none}.dept-taller .dt-sec.on{display:block}.dept-taller .tbl td small{display:block;color:#777;font-size:11px}.dept-taller .ok{color:#229710;font-weight:700}.dept-taller .bad{color:#c0392b}.dept-taller .dt-mini{font-size:11.5px;color:#6b5f55}`;
      document.head.appendChild(s);
    } catch (e) { /* sin DOM */ }
  }
  let uiTab = 'cap';
  function ui(co) {
    injectCss(); const st = S(co); if (!st) return { body: '<div class="sub">Sin estado del taller.</div>' }; recompute(co, st); const w = wk(co); const t = TIERS[st.tier]; const nx = TIERS[st.tier + 1]; const up = canUpgrade(co, st);
    const staff = staffList(co); const monthly = monthlyCost(co);
    /* cabecera */
    let h = `<div class="dt-top"><div class="dt-box"><b>${st.tier ? `Nivel ${st.tier} · ` : ""}${esc(t.name)}</b><div class="sub">${esc(t.desc)}</div>
      <div class="dt-kv"><span>Capacidad propia <b>${U.num(st.capacityWeek)}/sem</b> <span class="dt-mini">(base ${U.num(st.capacityBase)} × personal ${st.staffFactor.toFixed(2)})</span></span><span>Proveedor genérico <b>${U.num(PROVIDER_CAP[co.level])}/sem</b> <span class="dt-mini">(×1,4 coste)</span></span><span>Calidad máx. <b>${Math.round(st.qualityMax * 100)} %</b></span><span>Nivel técnico <b>${st.techLevel}</b></span><span>Coste mensual <b>${money(monthly)}</b></span>${st.stoppedWeeks ? `<span class="bad">⛔ Taller parado ${st.stoppedWeeks} sem.</span>` : ''}</div>
      ${nx ? `<div class="row"><button class="btn small primary" data-act="upgrade" ${up.ok ? '' : 'disabled'}>Ampliar: ${esc(nx.name)} (${money(nx.capex)})</button><span class="dt-mini">${up.ok ? `+${U.num(nx.cap)} uds/sem, mantenimiento ${money(nx.maint)}/mes` : esc(up.msg)}</span></div>` : '<div class="sub ok">Taller al máximo.</div>'}
      </div><div class="dt-box"><b>Personal del taller</b> <span class="dt-mini">(${staff.length} asignados · factor ${st.staffFactor.toFixed(2)})</span>
      ${staff.length ? `<div class="dt-chips">${staff.map(s => `<span class="dt-chip ${s.state === 'vacation' ? 'off' : ''}">${esc(s.name)} · ${esc(s.roleInfo().short)} nv. ${s.level()}${s.skills && s.skills.taller_cnc ? ' · CNC' : ''}${s.skills && s.skills.sourcing ? ' · compras' : ''}${s.skills && s.skills.regulatorio ? ' · MDR' : ''}</span>`).join('')}</div>` : `<div class="sub">${st.tier >= 2 ? '<span class="bad">Sin técnicos el taller rinde al 40 %.</span>' : 'Nadie asignado.'} Asigna personal desde su ficha (menú Personal → Detalles → Destino: Taller). Rol afín: técnico/a de taller (artesano monturero u operario CNC).</div>`}
      <div class="row"><label class="dt-mini">Producción <select data-sel="mode"><option value="auto" ${st.mode === 'auto' ? 'selected' : ''}>Automática: taller propio y el resto fuera</option><option value="own" ${st.mode === 'own' ? 'selected' : ''}>Solo taller propio + proveedor genérico</option><option value="oem" ${st.mode === 'oem' ? 'selected' : ''}>Todo con acuerdos externos</option></select></label></div>
      <div class="dt-mini">Coste de referencia (acetato en plancha): <b>${st.unitCostBase} €</b>/montura · Fabricado en casa: ${U.num(st.stats.own)} · externo ${U.num(st.stats.out)} · proveedor ${U.num(st.stats.prov)}</div></div></div>`;
    /* pestañas */
    const tabs = [['cap', 'Capacidad y demanda'], ['eq', 'Equipos'], ['mat', 'Materiales'], ['out', 'Fabricación externa'], ['norm', 'Normativa'], ['cost', 'Costes']]; if (!Modules.get('marketing')) tabs.push(['fair', 'Ferias']);
    h += `<div class="dt-tabs">${tabs.map(x => `<button data-tab="${x[0]}" class="${uiTab === x[0] ? 'on' : ''}">${x[1]}</button>`).join('')}</div>`;
    h += `<div class="dt-sec ${uiTab === 'cap' ? 'on' : ''}" data-sec="cap">${uiCap(co, st, w)}</div>`;
    h += `<div class="dt-sec ${uiTab === 'eq' ? 'on' : ''}" data-sec="eq">${uiEq(co, st)}</div>`;
    h += `<div class="dt-sec ${uiTab === 'mat' ? 'on' : ''}" data-sec="mat">${uiMat(co, st)}</div>`;
    h += `<div class="dt-sec ${uiTab === 'out' ? 'on' : ''}" data-sec="out">${uiOut(co, st, w)}</div>`;
    h += `<div class="dt-sec ${uiTab === 'norm' ? 'on' : ''}" data-sec="norm">${uiNorm(co, st)}</div>`;
    h += `<div class="dt-sec ${uiTab === 'cost' ? 'on' : ''}" data-sec="cost">${uiCost(co, st, monthly)}</div>`;
    if (!Modules.get('marketing')) h += `<div class="dt-sec ${uiTab === 'fair' ? 'on' : ''}" data-sec="fair">${uiFair(co, st)}</div>`;
    return {
      body: h,
      bind(el, refresh) {
        if (!el || !el.querySelectorAll) return;
        el.querySelectorAll('button[data-tab]').forEach(b => b.addEventListener('click', () => { uiTab = b.dataset.tab; el.querySelectorAll('button[data-tab]').forEach(x => x.classList.toggle('on', x.dataset.tab === uiTab)); el.querySelectorAll('.dt-sec').forEach(x => x.classList.toggle('on', x.dataset.sec === uiTab)); }));
        el.querySelectorAll('button[data-act]').forEach(b => b.addEventListener('click', () => { const r = action(co, b.dataset.act, b.dataset.id); if (r && r.msg) toast(r.msg); if (typeof G !== 'undefined' && G.emit) G.emit('refresh'); refresh(); }));
        el.querySelectorAll('select[data-sel]').forEach(s => s.addEventListener('change', () => { const r = action(co, s.dataset.sel, null, s.value); if (r && r.msg) toast(r.msg); refresh(); }));
      }
    };
  }
  function uiCap(co, st, w) {
    const games = activeGames(co); let h = '';
    if (games.length) {
      h += `<table class="tbl"><tr><th>Colección</th><th>Nota</th><th>Material</th><th>Demanda / sem</th><th>Origen</th><th>Coste ud.</th><th>Margen</th></tr>`;
      for (const g of games) { const t = g.flags.taller || {}; const last = st.lastUnits[g.id] || 0; const m = matOf(t.mat) || MAT_DEFAULT; const src = t.deal ? `${pct(t.ownShare || 0)} propia · ${pct(t.dealShare || 0)} ${esc(DEALBY[t.deal].name.split(' — ')[0])}` : (t.ownShare ? `${pct(t.ownShare)} propia · ${pct(t.provShare || 0)} proveedor` : 'proveedor genérico'); h += `<tr><td><b>${esc(g.title)}</b><small>${C.SIZE[g.size].label} · ${U.num(g.unitsSold || 0)} uds. vendidas</small></td><td><span class="score s${Math.round(g.score)}">${g.score.toFixed(1)}</span></td><td>${esc(m.name || t.mat || '—')}</td><td>${U.num(t.perWeek || last)}<small>media estimada · última semana ${U.num(last)}</small></td><td><small>${src}</small>${t.factor && t.factor < 1 ? `<small class="bad">ventas ×${t.factor} por falta de capacidad</small>` : ''}</td><td>${t.unitCost !== undefined ? t.unitCost.toFixed(1) + ' €' : '—'}</td><td>${Math.round((g.marginFactor || 1) * 100)} %</td></tr>`; }
      h += '</table>';
    } else h += '<div class="sub">No hay colecciones a la venta. La demanda aparecerá aquí al lanzar la próxima.</div>';
    const hist = st.history.slice(-12); const mx = Math.max(1, ...hist.map(x => Math.max(x.demand, x.own, x.cap || 0)));
    h += `<h4>Últimas 12 semanas</h4><div class="dt-chart">${hist.length ? hist.map(x => `<div class="dt-col" title="Semana ${x.w}: demanda ${U.num(x.demand)}, fabricadas ${U.num(x.own)}, capacidad ${U.num(x.cap || 0)}"><i class="dem" style="height:${Math.max(2, 100 * x.demand / mx)}%"></i><i class="own" style="height:${Math.max(2, 100 * x.own / mx)}%"></i><i class="cap" style="height:${Math.max(2, 100 * (x.cap || 0) / mx)}%"></i><span>${x.w % 48 ? x.w % 48 : 48}</span></div>`).join('') : '<div class="sub">Sin datos todavía.</div>'}</div><div class="dt-leg"><i style="background:#c9b996"></i>monturas demandadas <i style="background:#e67e22"></i>fabricadas en casa <i style="background:#3498db;opacity:.5"></i>capacidad propia</div>`;
    const tot = hist.reduce((s, x) => s + x.demand, 0), own = hist.reduce((s, x) => s + x.own, 0);
    h += `<div class="sub">En las últimas ${hist.length} semanas: ${U.num(tot)} monturas demandadas, ${U.num(own)} fabricadas en el taller (${tot ? pct(own / tot) : '—'}). Ocupación actual ${pct(st.busy)}.</div>`;
    if (st.returnsUntil > w) h += `<div class="note">Devoluciones por encogimiento del acetato hasta la semana ${st.returnsUntil}: −${pct(st.returnsRate)} de las ventas de acetato.</div>`;
    return h;
  }
  function uiEq(co, st) {
    const t = TIERS[st.tier]; const owned = EQ.filter(e => owns(st, e.id)); const avail = EQ.filter(e => !owns(st, e.id) && e.tier <= Math.min(4, st.tier + 1));
    let h = `<div class="dt-chips">${owned.length ? owned.map(e => `<span class="dt-chip ${st.broken[e.id] ? 'off' : ((t.includes || []).includes(e.id) ? 'inc' : '')}" title="${esc(e.desc)}">${esc(e.name.split(' (')[0].split(':')[0])}${st.broken[e.id] ? ' · averiado ' + st.broken[e.id] + ' sem.' : ''}${e.cap ? ' · +' + e.cap + '/sem' : ''}${e.maint && !(t.includes || []).includes(e.id) ? ' · ' + money(e.maint) + '/mes' : ''}</span>`).join('') : '<span class="sub">Sin equipos. Monta el atelier para empezar.</span>'}</div>`;
    h += '<h4>Disponibles</h4>';
    for (const e of avail) { const c = canBuy(co, st, e); h += `<div class="ritem ${c.ok ? '' : 'off'}"><div><b>${esc(e.name)}</b> <small class="tag">tier ${e.tier}</small><small>${esc(e.desc)}${e.cap ? ` Capacidad +${e.cap}/semana.` : ''}${e.q ? ` Nota +${(e.q * 100).toFixed(1)} %${e.only ? ' en ' + e.only.map(g => GROUP_NAME[g] || g).join('/') : ''}.` : ''}${e.fail ? ` Avería ${Math.round(e.fail * 100)} %/mes.` : ''}</small>${c.ok ? '' : `<small class="bad">${esc(c.msg)}</small>`}</div><div class="rcost">${money(e.cost)}<br><small>${e.maint ? money(e.maint) + '/mes' : 'sin mantenimiento'}</small></div><button class="btn small primary" data-act="buy" data-id="${e.id}" ${c.ok ? '' : 'disabled'}>Comprar</button></div>`; }
    if (!avail.length) h += '<div class="sub">Tienes todo el equipo de este nivel.</div>';
    return h;
  }
  function uiMat(co, st) {
    const prices = [70, 110, 140, 180];
    let h = `<div class="sub">Coste unitario del material más caro de la colección + fornituras (charnelas, tornillos, plaquetas y estuche: 1–3 €). Sin taller propio todo sube ×1,4. El margen se calcula sobre el precio de la colección (${prices.join(' / ')} € según tamaño).</div><table class="tbl"><tr><th>Material</th><th>Estado</th><th>Propio</th><th>Externo</th><th>Proveedor</th><th>Mejor · margen en Pequeña</th><th>Afín a</th></tr>`;
    for (const pid of Object.keys(MAT)) { const m = matOf(pid); const p = DB.part(pid); const researched = p && (p.start || co.hasResearch(pid)); const avail = co.availableResearch.includes(pid); const mc = matCost(co, st, pid); const own = canMakeOwn(st, m); const ownReq = m.own.length ? m.own.map(e => EQBY[e] ? EQBY[e].name.split(' (')[0].split(':')[0] : e).join(' o ') : 'solo externo'; const st8 = researched ? '<span class="ok">✔ investigado</span>' : avail ? 'disponible para investigar' : '<small>pendiente de requisitos</small>'; h += `<tr><td><b>${esc(m.name)}</b><small>${esc(m.note || '')}</small></td><td>${st8}</td><td>${own ? mc.own.toFixed(1) + ' €' : `<small>necesita ${esc(ownReq)}</small>`}</td><td>${mc.deal !== null ? mc.deal.toFixed(1) + ' € <small>' + esc(DEALBY[mc.dealId].name.split(' — ')[0]) + '</small>' : '<small>sin acuerdo</small>'}</td><td>${mc.prov.toFixed(1)} €</td><td><b>${mc.best.toFixed(1)} €</b> <small>margen ${Math.round(Math.max(20, 100 * (1 - (mc.best + 1) / 70)))} %</small></td><td><small>${m.tipos.filter(x => DB.genre(x)).map(x => DB.genre(x).name).join(', ')}<br>${m.estilos.filter(x => DB.topic(x)).slice(0, 4).map(x => DB.topic(x).name).join(', ')}</small></td></tr>`; }
    return h + '</table>';
  }
  function uiOut(co, st, w) {
    let h = '<div class="sub">Un acuerdo activo cubre toda la demanda que no alcance tu taller, al coste del fabricante. Pagas cuota de apertura y el pedido mínimo por modelo (MOQ) y esperas el plazo de prototipo y producción; si una colección vende menos que el MOQ, el resto es stock muerto. Italia y Japón suben la nota; China la baja salvo control de calidad.</div>';
    const active = DEALS.filter(d => st.deals[d.id]);
    if (active.length) { h += '<h4>Acuerdos activos</h4>'; for (const d of active) { const x = st.deals[d.id]; const ready = x.readyWeek <= w; const delayed = (x.delayUntil || 0) > w; const off = d.china && st.flags.chinaOffUntil > w; h += `<div class="ritem"><div><b>${esc(d.name)}</b> ${st.preferredDeal === d.id ? '<small class="tag">preferido</small>' : ''}<small>${ready ? (off ? `<span class="bad">suspendido ${st.flags.chinaOffUntil - w} sem. (aranceles)</span>` : delayed ? `<span class="bad">pedido retrasado ${x.delayUntil - w} sem.</span>` : '<span class="ok">operativo</span>') : `muestras en ${x.readyWeek - w} sem.`} · MOQ ${U.num(x.moq)} uds. · ${Object.keys(d.unit).map(k => `${GROUP_NAME[k] || k} ${d.unit[k]} €`).join(', ')} · usado en ${x.uses || 0} colecciones</small></div><div class="rcost">${money(d.monthly)}/mes</div><div><button class="btn small" data-act="pref" data-id="${d.id}">${st.preferredDeal === d.id ? 'Quitar preferencia' : 'Preferir'}</button> <button class="btn small danger" data-act="cancel" data-id="${d.id}">Cancelar</button></div></div>`; } }
    h += '<h4>Acuerdos disponibles</h4>';
    for (const d of DEALS) { if (st.deals[d.id]) continue; const c = canSign(co, st, d); const pre = dealPrepaid(co, st, d); h += `<div class="ritem ${c.ok ? '' : 'off'}"><div><b>${esc(d.name)}</b><small>${esc(d.desc)}</small><small>MOQ ${U.num(pre.moq)} uds. · plazo de entrega ${d.lead} semanas · ${Object.keys(d.unit).map(k => `${GROUP_NAME[k] || k} ${d.unit[k]} €`).join(', ')} · nota ${d.q >= 0 ? '+' : ''}${Math.round(d.q * 100)} %</small>${c.ok ? '' : `<small class="bad">${esc(c.msg)}</small>`}</div><div class="rcost">${money(dealFee(st, d, w))}<br><small>+ MOQ ${money(pre.amount)} · ${money(d.monthly)}/mes</small></div><button class="btn small" data-act="sign" data-id="${d.id}" ${c.ok ? '' : 'disabled'}>Firmar</button></div>`; }
    h += '<h4>Servicios complementarios</h4>';
    for (const a of ADDONS) { if (a.auto) { const on = co.hasResearch('ISO12870') && !has(st, 'qc_lab'); h += `<div class="ritem"><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small></div><div class="rcost">${money(a.perRelease)}/colección</div><div class="dt-mini">${on ? '<span class="ok">activo</span>' : has(st, 'qc_lab') ? 'laboratorio propio' : 'sin ensayos'}</div></div>`; continue; } const on = !!st.addons[a.id]; const r = reqText(co, st, a.req); h += `<div class="ritem ${on || !r ? '' : 'off'}"><div><b>${esc(a.name)}</b><small>${esc(a.desc)}</small>${!on && r ? `<small class="bad">${esc(r)}.</small>` : ''}</div><div class="rcost">${a.fee ? money(a.fee) : ''}${a.monthly ? '<br><small>' + money(a.monthly) + '/mes</small>' : ''}${a.perRelease ? '<br><small>' + money(a.perRelease) + '/colección</small>' : ''}</div><button class="btn small ${on ? 'danger' : ''}" data-act="addon" data-id="${a.id}" ${on || !r ? '' : 'disabled'}>${on ? 'Cancelar' : 'Contratar'}</button></div>`; }
    return h;
  }
  function uiNorm(co, st) {
    let h = '<div class="sub">Quien pone su marca en una montura es su fabricante legal (producto sanitario de clase I, MDR): sin Declaración UE de conformidad ni registro, los canales grandes venden un 40 % menos (salvo Sol). Sin ensayos EN ISO 12870, clínicas y mutuas no compran; las gafas de sol son EPI (EN ISO 12312-1) y sin ensayos pierden nota; el metal debe cumplir el límite de níquel de REACH. Las tendencias desbloquean materiales y equipos.</div>';
    const idle = co.staff.some(s => s.isIdle());
    for (const r of RESEARCH) { const done = co.hasResearch(r.id); const avail = r.req(co) && co.researchEnabled; const can = !done && avail && idle && co.researchPoints >= r.pointsCost && co.cash >= r.cost; const busy = co.staff.some(s => s.currentResearch && s.currentResearch.id === r.id); h += `<div class="ritem ${done || can ? '' : 'off'}"><div><b>${esc(r.name)}</b> ${done ? '<small class="tag">✔ hecho</small>' : busy ? '<small class="tag">en curso</small>' : ''}<small>${esc(r.desc)}</small></div><div class="rcost">🔬 ${r.pointsCost}${r.cost ? ' · ' + U.shortMoney(r.cost) : ''}<br><small>${(r.duration / WEEK_MS).toFixed(1)} sem.</small></div>${done ? '<span class="ok">✔</span>' : `<button class="btn small" data-act="research" data-id="${r.id}" ${can && !busy ? '' : 'disabled'} title="${!avail ? 'Todavía no disponible' : !idle ? 'Nadie libre' : ''}">Investigar</button>`}</div>`; }
    return h;
  }
  function uiCost(co, st, monthly) {
    const t = TIERS[st.tier]; const rows = [];
    if (t.maint) rows.push(['Mantenimiento del taller (' + t.name + ')', t.maint]);
    for (const id of st.equipment) { if ((t.includes || []).includes(id)) continue; const e = EQBY[id]; if (e.maint) rows.push([e.name.split(' (')[0], e.maint]); }
    for (const id of Object.keys(st.deals)) rows.push(['Acuerdo ' + DEALBY[id].name, DEALBY[id].monthly]);
    for (const id of Object.keys(st.addons)) if (st.addons[id] && ADDONBY[id] && ADDONBY[id].monthly) rows.push([ADDONBY[id].name, ADDONBY[id].monthly]);
    let h = `<table class="tbl"><tr><th>Concepto</th><th>€/mes</th></tr>${rows.map(r => `<tr><td>${esc(r[0])}</td><td>${money(r[1])}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${money(monthly)}</b></td></tr></table>`;
    const inc = st.equipment.filter(id => EQBY[id].income && !st.broken[id]).reduce((s, id) => s + EQBY[id].income, 0); if (inc) h += `<div class="sub ok">Ingresos del taller: ${money(inc)}/mes por venta de planchas.</div>`;
    h += `<div class="sub">Acumulado: multas ${money(st.stats.fines)} · stock muerto ${money(st.stats.deadLoss)} · reparaciones ${money(st.stats.repairs)} · ampliaciones ${st.stats.upgrades}.</div>`;
    h += `<h4>Niveles del taller</h4><table class="tbl"><tr><th>Nivel</th><th>Inversión</th><th>Mantenimiento</th><th>Capacidad base</th><th>Calidad máx.</th><th>Requisito</th></tr>${TIERS.slice(1).map(x => `<tr class="${x.tier === st.tier ? 'on' : ''}"><td>${x.tier === st.tier ? '▶ ' : ''}${esc(x.name)}</td><td>${money(x.capex)}</td><td>${money(x.maint)}/mes</td><td>${U.num(x.cap)}/sem</td><td>${Math.round(x.qmax * 100)} %</td><td><small>${C.LEVELS[x.level].name}${x.research ? ' + ' + DB.research(x.research).name : ''}</small></td></tr>`).join('')}</table>`;
    return h;
  }
  function uiFair(co, st) {
    const d = co.getCurrentDate(); let h = '<div class="sub">Las ferias se anuncian solas en su mes. El taller las gestiona mientras no exista el departamento de marketing.</div>';
    for (const f of FAIRS) { const key = f.id + '-' + d.year; const state = st.fairs[key] === 'done' ? '<span class="ok">stand reservado este año</span>' : st.fairs[key] === 'asked' ? 'este año no fuimos' : `mes ${f.month}`; const ok = co.level >= f.level && (!f.research || co.hasResearch(f.research)); h += `<div class="ritem ${ok ? '' : 'off'}"><div><b>${esc(f.name)}</b><small>${esc(f.desc)}</small>${ok ? '' : `<small class="bad">Requiere ${C.LEVELS[f.level].name}${f.research ? ' y ' + DB.research(f.research).name : ''}.</small>`}</div><div class="rcost">${money(f.cost)}<br><small>+${f.hype} expectación</small></div><div class="dt-mini">${state}</div></div>`; }
    return h;
  }

  /* =====================================================================
     7. ESCENA, INFORME Y REGISTRO
     ===================================================================== */
  function sceneInfo(co) { const st = S(co); if (!st) return { tier: 0, machines: [], busy: 0 }; return { tier: st.tier, machines: st.equipment.filter(id => !st.broken[id]).slice(0, 10), busy: st.busy || 0, stopped: st.stoppedWeeks > 0, staff: staffList(co).length, owned: st.equipment.slice() /* render.js: todo el equipo comprado */ }; }
  function report(co) {
    const st = S(co); if (!st) return []; const hist = st.history.slice(-4); const dem = hist.reduce((s, x) => s + x.demand, 0), own = hist.reduce((s, x) => s + x.own, 0);
    return [{ label: 'Fabricado en casa (mes)', value: `${U.num(own)} de ${U.num(dem)}` }, { label: 'Coste mensual', value: money(monthlyCost(co)) }, { label: 'Taller', value: TIERS[st.tier].name }, { label: 'Capacidad', value: U.num(st.capacityWeek) + ' uds/semana' }, { label: 'Acuerdos externos', value: String(Object.keys(st.deals).length) }];
  }

  Modules.register({
    id: ID, name: 'Taller de monturas', icon: '🛠️', order: 40,
    init, weekly, monthly, monthlyCost, salesFactor, unitCost, scoreFactor, hypeFactor, candidateBonus,
    onCreateGame, onRelease, onResearch, onTraining, onAssign, onDecision, ui, sceneInfo, report,
    /* API interna para pruebas y para otros módulos (no forma parte del contrato) */
    api: { TIERS, EQ, MAT, DEALS, ADDONS, FAIRS, EVENTS, RESEARCH, PROVIDER_CAP, state: S, recompute, plan, estimateUnits, estimateDemandWeek, matCost, action, fireEvent, checkEvents, bookFair, staffUnits, canMakeOwn, gameMaterial }
  });
})();
