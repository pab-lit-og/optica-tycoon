/* Óptica Tycoon — datos estáticos del juego
   Estructura y balance inspirados en Game Dev Tycoon:
   Topic -> Estilo, Genre -> Tipo, Platform -> Canal de venta, Engine -> Taller, Game -> Colección */
'use strict';

const DATA = {};

/* ---------- constantes de balance (idénticas al juego de referencia) ---------- */
DATA.CONST = {
  SECONDS_PER_WEEK: 4,            // 1 semana = 4000 ms de tiempo de juego a velocidad 1x
  BASE_POINTS: 5,
  BASE_RESEARCH_POINTS: 1.5,
  BASE_DURATION: 1800,
  BASE_ENGINE_DURATION: 1500,
  PREP_DURATION: 1000,
  FINISH_DURATION: 1000,
  SPAWN_POINTS_DURATION: 1200,
  EFFICIENCY_RECHARGE_DURATION: 90000,
  BASE_SALARY_PER_LEVEL: 10000,
  START_CASH: 70000,
  TOPICS_VISIBLE: 4,
  UNIT_SCALE: 0.1,                // monturas vendidas = unidades GDT * 0.1 (precios x10)
  SIZE: {
    small:  { label: 'Pequeña',  duration: 1, points: 1,   unitPrice: 70,  optimalTeam: 1, targetFans: 1 },
    medium: { label: 'Mediana',  duration: 2, points: 1.2, unitPrice: 110, optimalTeam: 3, targetFans: 1e5 },
    large:  { label: 'Grande',   duration: 3, points: 1.4, unitPrice: 140, optimalTeam: 5, targetFans: 2.5e5 },
    aaa:    { label: 'Insignia', duration: 6, points: 1.8, unitPrice: 180, optimalTeam: 6, targetFans: 1e6 }
  },
  SALES_LENGTH: { small: 10, medium: 15, large: 20, aaa: 25 },
  BASE_POINTS_BY_TECH: [2, 5, 7, 10, 15, 20, 30, 40],
  V_LEVELS: [1, 2, 4, 6, 8, 10, 12, 14],
  V_POINTS_COST: [10, 15, 40, 80, 100, 150, 250, 300],
  V_DEV_COST: [5, 10, 30, 60, 100, 150, 300, 400],      // x1000
  V_DURATION: [8, 10, 12, 14, 16, 20, 25, 30],          // x1000 ms
  V_ENGINE_POINTS: [10, 15, 30, 40, 80, 120, 200, 300],
  V_ENGINE_COST: [10, 30, 50, 100, 140, 180, 350, 500], // x1000
  XP_LEVELS: [350, 900, 1600, 2400, 3400, 4400, 5500, 7000, 9500, 14000, 20000, 36000, 60000, 100000],
  LEVELS: [
    null,
    { name: 'Puesto del mercado', rent: 6000, maxStaff: 2 },
    { name: 'Local comercial',    rent: 32000, maxStaff: 5 },
    { name: 'Óptica con gabinete', rent: 32000, maxStaff: 5 },
    { name: 'Óptica insignia',    rent: 64000, maxStaff: 7 }
  ]
};

/* ---------- públicos ---------- */
DATA.AUDIENCES = [
  { id: 'young',    name: 'Niños y jóvenes', short: 'J' },
  { id: 'everyone', name: 'Todos los públicos', short: 'T' },
  { id: 'mature',   name: 'Adultos y sénior', short: 'A' }
];

/* ---------- tipos (géneros). Orden fijo para los vectores de pesos:
   [Sol, Graduado, Deportiva, Infantil, Lectura, Lujo] (id 'premium') ---------- */
DATA.GENRES = [
  { id: 'sol',       name: 'Sol',       goldenRatio: 0.5, icon: '🕶️' },
  { id: 'graduado',  name: 'Graduado',  goldenRatio: 1.1, icon: '👓' },
  { id: 'deportiva', name: 'Deportiva', goldenRatio: 1.3, icon: '🚴' },
  { id: 'infantil',  name: 'Infantil',  goldenRatio: 1.2, icon: '🧒' },
  { id: 'lectura',   name: 'Lectura',   goldenRatio: 0.9, icon: '📖' },
  { id: 'premium',   name: 'Lujo',   goldenRatio: 0.5, icon: '💎', research: 'PremiumLine' }
];

/* ---------- fases y campos (misiones). Pesos por tipo en el mismo orden ---------- */
DATA.STAGES = [
  { name: 'Fase 1 · Diseño', missions: [
    { id: 'Estructura', name: 'Estructura y bisagras', desc: 'Varillas, bisagras, tornillería y resistencia.', tF: 0.8, dF: 0.2, gw: [0.8, 0.9, 1, 1, 0.8, 0.9] },
    { id: 'Forma',      name: 'Forma y frente',        desc: 'Silueta del frente, proporciones y encaje facial.', tF: 0.2, dF: 0.8, gw: [1, 0.9, 0.9, 0.8, 0.9, 1] },
    { id: 'Concepto',   name: 'Concepto y tendencia',  desc: 'Inspiración, moodboard y narrativa de la colección.', tF: 0.2, dF: 0.8, gw: [1, 0.8, 0.8, 0.8, 0.8, 1] }
  ]},
  { name: 'Fase 2 · Fabricación', missions: [
    { id: 'Acabados',   name: 'Acabados y color',      desc: 'Pulidos, lacados, colores y texturas.', tF: 0.1, dF: 0.9, gw: [1, 0.9, 0.8, 0.9, 0.9, 1] },
    { id: 'Ergonomia',  name: 'Ergonomía y tallaje',   desc: 'Tallas, plaquetas, peso y comodidad.', tF: 0.6, dF: 0.4, gw: [0.8, 1, 1, 1, 0.6, 0.8] },
    { id: 'Lentes',     name: 'Lentes y tratamientos', desc: 'Lentes, filtros y tratamientos ópticos.', tF: 0.8, dF: 0.2, gw: [0.8, 1, 1, 1, 0.6, 0.8] }
  ]},
  { name: 'Fase 3 · Lanzamiento', missions: [
    { id: 'Escaparate', name: 'Escaparate y presentación', desc: 'Exposición en tienda, fotografía y catálogo.', tF: 0.4, dF: 0.6, gw: [1, 0.8, 0.8, 0.8, 1, 1] },
    { id: 'Materiales', name: 'Materiales y calidad',  desc: 'Calidad de materiales y control de producción.', tF: 0.5, dF: 0.5, gw: [0.8, 0.9, 1, 1, 0.6, 1] },
    { id: 'Packaging',  name: 'Packaging y accesorios', desc: 'Estuches, gamuzas y experiencia de compra.', tF: 0.4, dF: 0.6, gw: [0.9, 0.6, 0.9, 0.8, 0.8, 1] }
  ]}
];
DATA.MISSIONS = DATA.STAGES.flatMap(s => s.missions);

/* ---------- estilos (topics). gw = pesos por tipo, aw = pesos por público [J,T,A]
   mo = overrides opcionales de misiones (por tipo, 9 valores; 0 = sin cambio) ---------- */
DATA.TOPICS = [
  { id: 'aviador', name: 'Aviador', year: 1995, gw: [1, 0.8, 0.8, 0.6, 0.6, 0.9], aw: [0.8, 1, 0.9], desc: 'Nació para proteger a los pilotos del deslumbramiento en altitud con lentes en forma de gota.' },
  { id: 'wayfarer', name: 'Trapezoidal clásica', year: 1995, gw: [1, 1, 0.6, 0.9, 0.9, 0.9], aw: [1, 1, 0.8], desc: 'La primera silueta de pasta que rompió con el metal y se hizo icono del rock de los cincuenta.' },
  { id: 'pantos', name: 'Pantos', year: 1995, gw: [0.9, 1, 0.6, 0.8, 1, 1], aw: [0.8, 1, 1], desc: 'Redondeada abajo y achatada en la ceja: campo amplio, perfecta para graduar.' },
  { id: 'cateye', name: 'Ojo de gato', year: 1995, gw: [1, 1, 0.6, 0.8, 0.9, 1], aw: [0.8, 1, 0.9], desc: 'Las divas del cine clásico la hicieron famosa: eleva los ángulos superiores hacia las sienes.' },
  { id: 'clubmaster', name: 'Cejas marcadas', year: 1995, gw: [0.9, 1, 0.6, 0.6, 0.9, 0.9], aw: [0.8, 0.9, 1], desc: 'Barra superior de acetato que imita las cejas sobre aros metálicos casi invisibles.' },
  { id: 'redondas', name: 'Redonda clásica', year: 1995, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.9], aw: [1, 0.9, 0.8], desc: 'La geometría original de la óptica, adoptada en los sesenta por la contracultura.' },
  { id: 'rectangulares', name: 'Rectangular ejecutiva', year: 1995, gw: [0.8, 1, 0.8, 0.8, 1, 0.8], aw: [0.8, 1, 1], desc: 'Líneas horizontales sobrias que dominaron los despachos del cambio de milenio.' },
  { id: 'mariposa', name: 'Mariposa', year: 1995, gw: [1, 0.9, 0.6, 0.6, 0.6, 1], aw: [0.6, 0.9, 1], desc: 'Talcos amplios que se abren hacia fuera como alas: mucha protección y mucha presencia.' },
  { id: 'hexagonales', name: 'Hexagonal y octogonal', year: 1995, gw: [1, 1, 0.6, 0.8, 0.8, 1], aw: [1, 0.9, 0.6], desc: 'Facetas angulares que reinterpretan la redonda clásica con un giro geométrico.' },
  { id: 'navegador', name: 'Navegador', year: 1995, gw: [1, 0.9, 0.8, 0.6, 0.8, 0.9], aw: [0.6, 0.9, 1], desc: 'Primo cuadrado del aviador: más superficie útil para lentes de lejos y cerca.' },
  { id: 'escudo', name: 'Escudo panorámico', year: 1995, gw: [1, 0.6, 1, 0.6, 0.6, 0.9], aw: [1, 0.8, 0.6], desc: 'Una sola lente continua, sin tabique: nació en las pistas de esquí y saltó a la pasarela.' },
  { id: 'envolventes', name: 'Envolvente aerodinámica', year: 1995, gw: [0.9, 0.6, 1, 0.8, 0.6, 0.6], aw: [1, 0.9, 0.6], desc: 'Curvatura pronunciada que abraza la cabeza y corta el viento lateral.',
    mo: [[0, 0, 0, 0, 1, 1, 0, 0.9, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0.9, 0, 0, 0, 1, 1, 0, 0.9, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]] },
  { id: 'alaire', name: 'Al aire (taladrada)', year: 1995, gw: [0.8, 1, 0.6, 0.6, 0.8, 0.9], aw: [0.6, 0.8, 1], desc: 'Sin aro: puente y varillas van atornillados directamente a la lente.',
    mo: [[0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0.9, 1, 0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0.9, 0.9, 0, 1, 0]] },
  { id: 'nylor', name: 'Media montura ranurada', year: 1995, gw: [0.6, 1, 0.8, 0.6, 0.9, 0.8], aw: [0.6, 0.9, 1], desc: 'Un hilo de nailon tensado sujeta el borde inferior de la lente: ligera y discreta.' },
  { id: 'doblepuente', name: 'Doble puente', year: 1995, gw: [1, 0.9, 0.8, 0.6, 0.6, 0.9], aw: [0.8, 1, 0.9], desc: 'Un travesaño sobre el puente refuerza el frente y le da aire retro.' },
  { id: 'medialuna', name: 'Media luna', year: 1995, gw: [0.6, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.6, 0.6, 1], desc: 'Calibre bajo pensado para leer de cerca y mirar por encima del aro.' },
  { id: 'keyhole', name: 'Puente de cerradura', year: 1995, gw: [0.9, 1, 0.6, 0.8, 0.9, 1], aw: [0.8, 1, 1], desc: 'Escotadura con forma de cerradura antigua que reparte el peso sin tocar el caballete.' },
  { id: 'crownpanto', name: 'Pantos corona', year: 1995, gw: [0.9, 1, 0.6, 0.6, 0.8, 1], aw: [0.8, 1, 0.9], desc: 'Pantos con la línea superior cortada en biseles rectos, sastrería del Jura francés.' },
  { id: 'microoval', name: 'Ovalada micro', year: 1995, gw: [1, 0.9, 0.6, 0.8, 0.9, 0.9], aw: [1, 0.8, 0.6], desc: 'Calibre pequeño y elíptico de los noventa: poco grosor en miopías altas.' },
  { id: 'glaciar', name: 'Glaciar con laterales', year: 1995, gw: [0.9, 0.6, 1, 0.6, 0.6, 0.9], aw: [0.9, 0.9, 0.6], desc: 'Montura de alta montaña con protecciones laterales contra la ceguera de las nieves.' },
  { id: 'carey', name: 'Carey y habana', year: 1995, gw: [1, 1, 0.6, 0.8, 1, 1], aw: [0.8, 1, 1], desc: 'Moteado ámbar y marrón en acetato que sustituyó al caparazón de tortuga.' },
  { id: 'transparentes', name: 'Acetato cristal', year: 1995, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.9], aw: [1, 1, 0.8], desc: 'Acetato translúcido o champán: presencia sin oscurecer la cara.' },
  { id: 'bicolor', name: 'Acetato laminado bicolor', year: 1995, gw: [0.9, 1, 0.6, 1, 0.9, 0.9], aw: [0.9, 1, 0.9], desc: 'Capas de color termosoldadas que asoman al fresar el frente y biselar.' },
  { id: 'minimal', name: 'Metal fino minimalista', year: 1995, gw: [0.9, 1, 0.6, 0.8, 0.9, 0.9], aw: [0.9, 1, 0.9], desc: 'Hilo metálico de apenas un milímetro: ligereza visual y discreción.' },
  { id: 'titanio', name: 'Titanio técnico', year: 1995, gw: [0.8, 1, 0.8, 0.6, 0.6, 1], aw: [0.6, 0.9, 1], desc: 'Metal hipoalergénico e inoxidable, mucho más ligero que el acero.' },
  { id: 'chunky', name: 'Acetato grueso', year: 1995, gw: [1, 1, 0.6, 0.6, 0.8, 1], aw: [0.9, 1, 0.8], desc: 'Frentes de 8 a 10 mm pulidos días enteros en bombos con virutas de haya.' },
  { id: 'combinada', name: 'Combinada acetato-metal', year: 1995, gw: [0.9, 1, 0.6, 0.6, 0.8, 1], aw: [0.8, 1, 1], desc: 'Aros de pasta encajados en un chasis metálico: lo mejor de los dos mundos.' },
  { id: 'madera', name: 'Madera y bambú', year: 2008, gw: [1, 0.8, 0.6, 0.6, 0.6, 0.9], aw: [0.9, 0.9, 0.6], desc: 'Chapas prensadas en sentidos cruzados: veta irrepetible y hasta flotan.',
    mo: [[0, 0, 0, 1, 0, 0, 0, 1, 0.9], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 1, 0.9]] },
  { id: 'flexible', name: 'Polímero flexible', year: 1995, gw: [0.8, 0.9, 1, 1, 0.9, 0.6], aw: [1, 0.9, 0.6], desc: 'Poliamidas y siliconas que se retuercen y vuelven a su forma sin romperse.' },
  { id: 'carbono', name: 'Fibra de carbono y aluminio', year: 1998, gw: [0.8, 0.9, 1, 0.6, 0.6, 1], aw: [0.6, 0.9, 0.9], desc: 'Materiales de la industria aeroespacial: rigidez y estética técnica.' },
  { id: 'joya', name: 'Alta joyería', year: 1995, gw: [0.9, 0.8, 0.6, 0.6, 0.6, 1], aw: [0.6, 0.8, 1], desc: 'Baños de oro, platino y pedrería para el cliente más exclusivo.' },
  { id: 'acero', name: 'Acero ultrafino sin tornillos', year: 1995, gw: [0.8, 1, 0.8, 0.8, 0.6, 0.9], aw: [0.8, 1, 1], desc: 'Lámina de acero troquelada y plegada: sin un solo tornillo ni soldadura.' },
  { id: 'neon', name: 'Flúor y espejados', year: 1995, gw: [1, 0.6, 1, 0.9, 0.8, 0.6], aw: [1, 0.8, 0.6], desc: 'Colores ácidos y lentes espejadas: surf, festivales y mucha luz.' },
  { id: 'soft', name: 'Textura mate', year: 1996, gw: [0.9, 0.9, 1, 1, 0.9, 0.8], aw: [1, 1, 0.8], desc: 'Barniz de tacto sedoso que no brilla y agarra aunque haya sudor.' },
  { id: 'nordico', name: 'Minimalismo nórdico', year: 1995, gw: [0.8, 1, 0.6, 0.8, 0.8, 1], aw: [0.8, 1, 1], desc: 'La forma sigue a la función: sin logotipos ni adornos.' },
  { id: 'retro70', name: 'Retro años 70', year: 1995, gw: [1, 0.9, 0.6, 0.6, 0.6, 1], aw: [0.9, 1, 0.8], desc: 'Calibres generosos con lentes degradadas en ámbar, rosa o azul.' },
  { id: 'retro80', name: 'Exceso años 80', year: 1995, gw: [1, 0.9, 0.8, 0.6, 0.8, 1], aw: [0.8, 0.9, 0.9], desc: 'Siluetas contundentes con apliques dorados: gafas de mando.' },
  { id: 'noventas', name: 'Grunge y ciberpunk', year: 1995, gw: [1, 0.9, 0.8, 0.8, 0.6, 0.9], aw: [1, 0.9, 0.6], desc: 'Del óvalo de pasta blanca a la microgafa oscura de ciencia ficción.' },
  { id: 'y2k', name: 'Estética dosmilera', year: 2000, gw: [1, 0.8, 0.8, 0.8, 0.6, 1], aw: [1, 0.8, 0.6], desc: 'Pantallas al aire, tornillos a la vista, brillos en las varillas y lentes degradadas.' },
  { id: 'logomania', name: 'Logomanía', year: 2002, gw: [1, 0.8, 0.6, 0.6, 0.6, 1], aw: [0.9, 0.9, 0.8], desc: 'Varillas anchas convertidas en valla publicitaria de monogramas.' },
  { id: 'hipster', name: 'Indie y geek-chic', year: 2007, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.8], aw: [1, 1, 0.6], desc: 'La gafa de pasta negra gruesa como seña de identidad, aunque no haga falta graduar.' },
  { id: 'eco', name: 'Ecodiseño', year: 2012, gw: [0.9, 1, 0.9, 0.9, 0.9, 0.8], aw: [1, 1, 0.8], desc: 'Redes de pesca recuperadas, ricino o bioacetato: colecciones trazables.' },
  { id: 'techwear', name: 'Techwear urbano', year: 2016, gw: [0.9, 0.9, 1, 0.6, 0.6, 0.9], aw: [1, 0.9, 0.6], desc: 'Diseño modular con cordones técnicos, imanes de bloqueo y ventilación antivaho.' },
  { id: 'smart', name: 'Gafa conectada', year: 2016, gw: [0.9, 1, 0.9, 0.6, 0.6, 0.9], aw: [0.9, 1, 0.7], desc: 'Audio, sensores y asistente en las varillas: la montura se vuelve electrónica.' },
  { id: 'lujosilencioso', name: 'Lujo silencioso', year: 2021, gw: [0.9, 1, 0.6, 0.6, 0.8, 1], aw: [0.6, 1, 1], desc: 'Nada de logos: proporciones clásicas, charnelas de siete barriles y materiales nobles.' },
  { id: 'arquitecto', name: 'Vanguardia arquitectónica', year: 1997, gw: [0.9, 1, 0.6, 0.6, 0.8, 1], aw: [0.6, 0.9, 1], desc: 'Monturas asimétricas o escultóricas para quien quiere firmar con la cara.' },
  { id: 'steampunk', name: 'Steampunk', year: 1995, gw: [0.9, 0.6, 0.6, 0.6, 0.6, 0.9], aw: [0.9, 0.8, 0.6], desc: 'Retrofuturismo victoriano: aros abatibles, latón envejecido y cuero.' },
  { id: 'carreras', name: 'Herencia de carreras', year: 1995, gw: [1, 0.8, 1, 0.6, 0.6, 1], aw: [0.6, 0.9, 1], desc: 'Puentes y varillas perforados como el volante de un bólido clásico.' },
  { id: 'surf', name: 'Surf y skate', year: 1995, gw: [1, 0.8, 1, 0.9, 0.6, 0.6], aw: [1, 0.9, 0.6], desc: 'Monturas robustas hechas para aguantar salitre, arena y asfalto.' },
  { id: 'oversize', name: 'Maxigafa', year: 1995, gw: [1, 0.8, 0.6, 0.6, 0.6, 1], aw: [0.8, 0.9, 1], desc: 'Calibres enormes de ceja a mejilla para esconder la mirada.' },
  { id: 'flexkids', name: 'Infantil ergonómico', year: 1995, gw: [0.8, 0.9, 0.9, 1, 0.6, 0.6], aw: [1, 0.6, 0.6], desc: 'Puentes adaptados a narices en crecimiento, colores vivos y bandas elásticas.' }
];

/* ---------- canales de venta (plataformas). amount en millones de clientes potenciales (x5M como GDT)
   fechas "año/mes/semana". gw por tipo, aw por público. ---------- */
DATA.PLATFORMS = [ /* pesos por tipo topados en 1: la investigación da 1,1-1,2 a los canales afines, pero por encima de 1 rompe el ritmo económico */
  { id: 'tienda', name: 'Tienda propia', company: 'Nosotros', startAmount: 0.22,
    marketKeyPoints: [{ date: '2/1/1', amount: 0.24 }, { date: '4/1/1', amount: 0.41 }, { date: '4/10/2', amount: 0.48 }, { date: '11/5/2', amount: 1.1 }, { date: '16/12/1', amount: 2.1 }, { date: '20/7/1', amount: 2.4 }, { date: '22/9/2', amount: 2.6 }, { date: '23/4/1', amount: 4 }, { date: '26/12/4', amount: 5.7 }],
    unitsSold: 5.7, licencePrize: 0, published: '1/1/1', retire: '260/12/4', devCost: 5000, gw: [0.9, 1, 0.9, 1, 1, 0.6], aw: [0.8, 0.9, 1], techLevel: 1, isOwn: true },
  { id: 'mercadillos', name: 'Mercadillos y ferias', company: 'Ayuntamiento', startAmount: 0.28, marketKeyPoints: [{ date: '2/5/1', amount: 0.36 }, { date: '3/1/1', amount: 0.38 }, { date: '4/1/1', amount: 0.386 }, { date: '8/1/1', amount: 0.33 }], unitsSold: 0.25, licencePrize: 0, published: '1/1/1', retire: '11/12/4', devCost: 15000, gw: [1, 0.6, 0.8, 0.7, 1, 0.6], aw: [1, 0.9, 0.8], techLevel: 1 },
  { id: 'indep', name: 'Ópticas tradicionales', company: 'Ópticas de barrio', startAmount: 0.356, marketKeyPoints: [{ date: '3/1/1', amount: 0.444 }, { date: '4/1/1', amount: 0.46 }, { date: '10/1/1', amount: 0.5 }, { date: '18/1/1', amount: 0.42 }], unitsSold: 0.3, licencePrize: 80000, published: '2/1/2', retire: '24/12/4', devCost: 30000, gw: [0.9, 1, 0.9, 1, 0.9, 1], aw: [0.6, 0.9, 1], techLevel: 1 },
  { id: 'farmacia', name: 'Farmacias y parafarmacias', company: 'Red de boticas', startAmount: 0.25, marketKeyPoints: [{ date: '10/1/1', amount: 0.35 }, { date: '30/1/1', amount: 0.45 }], unitsSold: 0.45, licencePrize: 20000, published: '2/3/1', retire: '260/12/4', devCost: 15000, gw: [0.8, 0.6, 0.6, 1, 1, 0.6], aw: [0.7, 0.9, 1], techLevel: 1 },
  { id: 'catalogo', name: 'Venta por catálogo', company: 'OptiCorreo', startAmount: 0.45, unitsSold: 0.4, licencePrize: 40000, published: '2/9/2', retire: '10/6/2', devCost: 25000, gw: [0.9, 0.6, 0.7, 0.6, 1, 0.6], aw: [0.6, 0.9, 1], techLevel: 2 },
  { id: 'almacenes', name: 'Grandes almacenes', company: 'Galerías Hispania', startAmount: 0.43, marketKeyPoints: [{ date: '6/6/2', amount: 0.55 }, { date: '14/1/1', amount: 0.6 }, { date: '20/1/1', amount: 0.5 }], unitsSold: 0.4, licencePrize: 80000, published: '3/2/3', retire: '26/6/2', devCost: 30000, gw: [1, 0.9, 0.9, 0.9, 1, 1], aw: [0.9, 1, 0.8], techLevel: 2 },
  { id: 'regional', name: 'Cooperativa de ópticos', company: 'Unión Óptica', startAmount: 0.5, marketKeyPoints: [{ date: '7/1/1', amount: 0.7 }, { date: '14/1/1', amount: 1 }, { date: '22/1/1', amount: 1.3 }, { date: '30/1/1', amount: 1.4 }], unitsSold: 1.4, licencePrize: 50000, published: '3/6/1', retire: '260/12/4', devCost: 30000, gw: [0.9, 1, 0.9, 1, 0.9, 0.8], aw: [0.8, 1, 1], techLevel: 2 },
  { id: 'nacional', name: 'Cadena de ópticas exprés', company: 'HoraVisión', startAmount: 0.6, marketKeyPoints: [{ date: '8/1/1', amount: 0.8 }, { date: '14/1/1', amount: 1.2 }, { date: '22/1/1', amount: 1.6 }, { date: '30/1/1', amount: 1.8 }], unitsSold: 1.9, licencePrize: 60000, published: '4/6/1', retire: '260/12/4', devCost: 50000, gw: [1, 1, 0.9, 0.9, 0.8, 0.8], aw: [1, 1, 0.8], techLevel: 3 },
  { id: 'central', name: 'Central de compras', company: 'Grupo VisiónRed', startAmount: 0.7, marketKeyPoints: [{ date: '10/1/1', amount: 1.3 }, { date: '16/1/1', amount: 2 }, { date: '24/1/1', amount: 2.8 }, { date: '30/1/1', amount: 3.2 }], unitsSold: 3.3, licencePrize: 120000, published: '4/9/2', retire: '260/12/4', devCost: 40000, gw: [1, 1, 1, 1, 0.9, 0.9], aw: [0.9, 1, 0.9], techLevel: 3 },
  { id: 'onlinepionera', name: 'Portal web pionero', company: 'CiberLentes 2000', startAmount: 0.7, marketKeyPoints: [{ date: '10/1/1', amount: 0.9 }], unitsSold: 0.6, licencePrize: 150000, published: '6/6/1', retire: '18/6/1', devCost: 50000, gw: [1, 0.7, 0.9, 0.6, 1, 0.7], aw: [1, 0.9, 0.6], techLevel: 3 },
  { id: 'lowcost', name: 'Franquicia del 2x1', company: 'Chevalier Ópticos', startAmount: 0.85, marketKeyPoints: [{ date: '12/1/1', amount: 1.6 }, { date: '16/1/1', amount: 2.4 }, { date: '22/1/1', amount: 2.8 }, { date: '30/1/1', amount: 3 }], unitsSold: 3, licencePrize: 200000, published: '9/3/1', retire: '260/12/4', devCost: 60000, gw: [1, 1, 0.7, 1, 0.8, 0.6], aw: [1, 0.9, 0.8], techLevel: 3 },
  { id: 'boutiques', name: 'Boutiques de moda', company: 'Concept stores', startAmount: 1, marketKeyPoints: [{ date: '17/1/1', amount: 1.6 }, { date: '26/1/1', amount: 2 }], unitsSold: 2.2, licencePrize: 300000, published: '11/3/1', retire: '260/12/4', devCost: 70000, gw: [1, 0.8, 0.7, 0.6, 0.9, 1], aw: [0.9, 0.9, 0.8], techLevel: 3 },
  { id: 'mutuas', name: 'Cuadro médico de mutuas', company: 'SaludVisual Plus', startAmount: 1.2, marketKeyPoints: [{ date: '18/1/1', amount: 2 }, { date: '26/1/1', amount: 3 }], unitsSold: 3.4, licencePrize: 350000, published: '13/4/1', retire: '260/12/4', devCost: 70000, gw: [0.6, 1, 0.6, 1, 0.6, 0.6], aw: [0.7, 1, 1], techLevel: 4 },
  { id: 'webpropia', name: 'Tienda online propia', company: 'Nosotros', startAmount: 1.5, unitsSold: 3.8, licencePrize: 350000, published: '13/8/4', marketKeyPoints: [{ date: '26/12/4', amount: 3.8 }], retire: '260/12/4', devCost: 50000, gw: [0.9, 0.9, 1, 0.9, 0.9, 1], aw: [1, 0.9, 0.8], techLevel: 3 },
  { id: 'clinicas', name: 'Clínicas oftalmológicas', company: 'Instituto Ocular', startAmount: 1.5, marketKeyPoints: [{ date: '22/1/1', amount: 2.4 }, { date: '30/1/1', amount: 3 }], unitsSold: 3, licencePrize: 350000, published: '15/2/1', retire: '260/12/4', devCost: 70000, gw: [0.7, 1, 0.7, 1, 0.6, 0.8], aw: [0.7, 1, 1], techLevel: 4 },
  { id: 'crowd', name: 'Venta directa online', company: 'Solaris Direct', startAmount: 2.3, marketKeyPoints: [{ date: '26/1/1', amount: 3.6 }, { date: '31/1/1', amount: 4 }], unitsSold: 4, licencePrize: 100000, published: '19/5/1', retire: '260/12/4', devCost: 50000, gw: [1, 0.8, 1, 0.7, 1, 0.8], aw: [1, 0.9, 0.6], techLevel: 4 },
  { id: 'marketplace', name: 'Gran marketplace', company: 'Ágora Prime', startAmount: 2.4, marketKeyPoints: [{ date: '26/1/1', amount: 4.2 }, { date: '31/1/1', amount: 5 }], unitsSold: 5, licencePrize: 400000, published: '20/3/1', retire: '260/12/4', devCost: 70000, gw: [1, 0.6, 1, 0.6, 1, 0.6], aw: [0.9, 1, 0.8], techLevel: 4 },
  { id: 'influencers', name: 'Venta en redes sociales', company: 'Creadores y redes', startAmount: 2.3, unitsSold: 3.7, licencePrize: 500000, published: '20/9/1', marketKeyPoints: [{ date: '26/12/4', amount: 3.7 }], retire: '260/12/4', devCost: 80000, gw: [1, 0.8, 0.7, 0.9, 0.7, 1], aw: [0.9, 1, 0.6], techLevel: 4 },
  { id: 'megaretail', name: 'Cadena vertical de diseño', company: 'Atelier Vista', startAmount: 3.6, marketKeyPoints: [{ date: '28/1/1', amount: 5.5 }, { date: '31/1/1', amount: 6 }], unitsSold: 6, licencePrize: 800000, published: '22/4/1', retire: '260/12/4', devCost: 90000, gw: [1, 1, 0.6, 0.8, 0.9, 1], aw: [0.9, 1, 0.8], techLevel: 5 },
  { id: 'suscripcion', name: 'Suscripción de gafas', company: 'Rent-a-Look', startAmount: 2, marketKeyPoints: [{ date: '31/1/1', amount: 3 }], unitsSold: 3, licencePrize: 500000, published: '25/2/1', retire: '260/12/4', devCost: 80000, gw: [0.9, 1, 0.7, 1, 0.6, 0.9], aw: [1, 1, 0.7], techLevel: 5 },
  { id: 'domicilio', name: 'Óptica a domicilio', company: 'Visión Rural', startAmount: 4, marketKeyPoints: [{ date: '31/1/1', amount: 5.5 }], unitsSold: 5.5, licencePrize: 1000000, published: '27/3/1', retire: '260/12/4', devCost: 80000, gw: [0.6, 1, 0.6, 0.7, 1, 0.6], aw: [0.6, 0.8, 1], techLevel: 6 },
  { id: 'techretail', name: 'Grandes superficies tecnológicas', company: 'ElectroMedia', startAmount: 5.6, marketKeyPoints: [{ date: '31/1/1', amount: 6.6 }], unitsSold: 6.6, licencePrize: 1500000, published: '29/2/1', retire: '260/12/4', devCost: 150000, gw: [0.7, 0.6, 0.9, 0.6, 0.6, 0.7], aw: [1, 0.9, 0.7], techLevel: 7 }
];

/* ---------- tendencias históricas (investigación de mercado). Año real; dan +8 % a sus estilos y +12 % si además el tipo es de los favorecidos ---------- */
DATA.TRENDS = [
  { year: 1995, name: 'Britpop y lentes tintadas', years: 3, styles: ['redondas', 'minimal', 'retro70', 'noventas'], genres: ['sol', 'graduado'], text: 'Las bandas británicas llenan las revistas de gafitas redondas y lentes de color.' },
  { year: 1997, name: 'Minimalismo sin tornillos', years: 4, styles: ['alaire', 'titanio', 'acero', 'nordico'], genres: ['graduado', 'premium'], text: 'Llegan de Escandinavia y Japón monturas ligerísimas, al aire y sin un solo tornillo.' },
  { year: 1999, name: 'Ciberpunk y microgafa', years: 3, styles: ['envolventes', 'alaire', 'microoval', 'noventas'], genres: ['sol', 'graduado', 'deportiva'], text: 'El cine de ciencia ficción de fin de milenio pone de moda las microgafas oscuras.' },
  { year: 2001, name: 'Fiebre dosmilera', years: 4, styles: ['escudo', 'alaire', 'y2k', 'logomania'], genres: ['sol', 'premium'], text: 'Pantallas, degradados rosas y brillos en las varillas: la alfombra roja manda.' },
  { year: 2004, name: 'Maxigafa y logomanía', years: 4, styles: ['mariposa', 'carey', 'logomania', 'oversize'], genres: ['sol', 'premium'], text: 'Cuanto más grande el logo en la varilla, mejor: España compra lujo a crédito.' },
  { year: 2007, name: 'Revival de los años 50', years: 4, styles: ['wayfarer', 'cateye', 'clubmaster', 'combinada'], genres: ['sol', 'graduado'], text: 'Las series de época devuelven las cejas marcadas y la pasta de los cincuenta.' },
  { year: 2009, name: 'Gafa de pasta hipster', years: 4, styles: ['wayfarer', 'keyhole', 'chunky', 'hipster'], genres: ['graduado', 'lectura'], text: 'La pasta negra gruesa deja de ser cosa de empollones: ahora es identidad.' },
  { year: 2011, name: 'Bambú y espíritu surfero', years: 3, styles: ['wayfarer', 'madera', 'neon', 'surf'], genres: ['sol', 'deportiva'], text: 'Madera, colores flúor y tablas de surf: el verano se vuelve artesano.' },
  { year: 2013, name: 'Espejadas de bajo coste', years: 3, styles: ['wayfarer', 'flexible', 'neon', 'soft'], genres: ['sol', 'deportiva'], text: 'Las marcas nacidas en internet venden espejadas a precio de menú del día.' },
  { year: 2015, name: 'Vuelve el metal fino', years: 3, styles: ['aviador', 'navegador', 'doblepuente', 'minimal'], genres: ['sol', 'graduado'], text: 'Tras años de pasta gruesa, el péndulo vuelve al metal dorado y el doble puente.' },
  { year: 2017, name: 'Geometría y acetato cristal', years: 3, styles: ['pantos', 'hexagonales', 'crownpanto', 'transparentes'], genres: ['graduado', 'lectura'], text: 'Hexágonos, octógonos y acetatos transparentes llenan los escaparates.' },
  { year: 2018, name: 'Nostalgia noventera', years: 2, styles: ['rectangulares', 'microoval', 'noventas', 'y2k'], genres: ['sol', 'premium'], text: 'Las microgafas rectangulares de los noventa vuelven de la mano de las redes.' },
  { year: 2020, name: 'Teletrabajo y videollamada', years: 3, styles: ['pantos', 'rectangulares', 'transparentes', 'flexible'], genres: ['graduado', 'infantil'], text: 'Con la casa convertida en oficina, todos quieren una montura que quede bien en cámara.' },
  { year: 2022, name: 'Dopamina y bioacetato', years: 2, styles: ['cateye', 'crownpanto', 'bicolor', 'chunky', 'eco'], genres: ['sol', 'graduado', 'premium'], text: 'Colores vivos, acetato grueso y materiales de origen vegetal tras la pandemia.' },
  { year: 2023, name: 'Lujo silencioso', years: 3, styles: ['pantos', 'keyhole', 'crownpanto', 'carey', 'titanio', 'lujosilencioso'], genres: ['graduado', 'premium'], text: 'Nada de logos: proporciones clásicas, carey y titanio bien hechos.' },
  { year: 2024, name: 'Gafas de velocidad', years: 2, styles: ['escudo', 'envolventes', 'carbono', 'techwear'], genres: ['sol', 'deportiva'], text: 'Las pantallas envolventes del ciclismo saltan de la carretera a la calle.' },
  { year: 2025, name: 'Gafa conectada', years: 3, styles: ['wayfarer', 'rectangulares', 'soft', 'techwear', 'smart'], genres: ['sol', 'graduado'], text: 'Altavoces y asistente en la varilla: la montura se vuelve electrónica.' }
];

/* ---------- tecnologías del taller (engine parts). category = id de misión.
   v = nivel (define coste RP, dinero, duración, puntos de taller). req = {missionLevel:[id, n]} | {featureLevel:[id, n]} | {research:id} | {date:'y/m'} ---------- */
DATA.PARTS = [
  // Materiales (gráficos): línea de acetato (2D) y línea metal/titanio (3D) con techLevel
  { id: 'acetato1', name: 'Acetato inyectado V1', category: 'Materiales', v: 2, techLevel: 1, start: true, group: 'acetato', devCost: 10000 },
  { id: 'acetato2', name: 'Acetato inyectado V2', category: 'Materiales', v: 4, techLevel: 2, group: 'acetato', req: { research: 'CustomEngine' } },
  { id: 'acetato3', name: 'Acetato fresado en bloque V3', category: 'Materiales', v: 6, techLevel: 2, group: 'acetato', req: { featureLevel: ['acetato2', 2] } },
  { id: 'acetato4', name: 'Acetato laminado multicapa V4', category: 'Materiales', v: 8, techLevel: 3, group: 'acetato', req: { featureLevel: ['acetato3', 2] } },
  { id: 'acetato5', name: 'Bioacetato V5', category: 'Materiales', v: 10, techLevel: 3, group: 'acetato', req: { date: '22/1', featureLevel: ['acetato4', 2] } },
  { id: 'metal1', name: 'Metal con níquel (alpaca) V1', category: 'Materiales', v: 2, techLevel: 1, group: 'metal', req: { featureLevel: ['acetato2', 2] } },
  { id: 'metal2', name: 'Metal fashion V2', category: 'Materiales', v: 4, techLevel: 2, group: 'metal', req: { featureLevel: ['metal1', 2] } },
  { id: 'metal3', name: 'Acero quirúrgico V3', category: 'Materiales', v: 6, techLevel: 3, group: 'metal', req: { featureLevel: ['metal2', 2] } },
  { id: 'metal4', name: 'Titanio V4', category: 'Materiales', v: 8, techLevel: 4, group: 'metal', req: { featureLevel: ['metal3', 2] } },
  { id: 'metal5', name: 'Beta-titanio V5', category: 'Materiales', v: 10, techLevel: 5, group: 'metal', req: { date: '7/1', featureLevel: ['metal4', 2] } },
  { id: 'metal6', name: 'Impresión 3D por sinterizado V6', category: 'Materiales', v: 12, techLevel: 6, group: 'metal', req: { date: '24/1', featureLevel: ['metal5', 2] } },
  { id: 'metal7', name: 'Fibra de carbono V7', category: 'Materiales', v: 14, techLevel: 7, group: 'metal', req: { date: '10/1', featureLevel: ['metal6', 2] } },
  { id: 'tr90', name: 'Poliamida TR90 ultraligera', category: 'Materiales', v: 4, req: { date: '4/1', missionLevel: ['Materiales', 3] } },
  { id: 'madera', name: 'Madera laminada certificada', category: 'Materiales', v: 6, req: { date: '14/1', missionLevel: ['Materiales', 5] } },
  // Packaging (sonido)
  { id: 'funda', name: 'Funda básica', category: 'Packaging', v: 1, start: true, group: 'estuche', devCost: 2000 },
  { id: 'estuche', name: 'Estuche rígido', category: 'Packaging', v: 2, group: 'estuche', req: { research: 'CustomEngine', missionLevel: ['Packaging', 1] } },
  { id: 'gamuza', name: 'Gamuza y kit de limpieza', category: 'Packaging', v: 4, req: { missionLevel: ['Packaging', 3] } },
  { id: 'estuchepremium', name: 'Estuche premium', category: 'Packaging', v: 4, group: 'estuche', req: { missionLevel: ['Packaging', 4] } },
  { id: 'ecopack', name: 'Estuche ecológico (corcho y papel)', category: 'Packaging', v: 6, group: 'estuche', req: { date: '24/1', missionLevel: ['Packaging', 5] } },
  { id: 'unboxing', name: 'Estuche plegable magnético', category: 'Packaging', v: 8, req: { date: '19/1', missionLevel: ['Packaging', 7] } },
  // Estructura (engine)
  { id: 'bisagra', name: 'Bisagra estándar', category: 'Estructura', v: 1, start: true, group: 'bisagra', devCost: 2000 },
  { id: 'flex', name: 'Bisagra flex', category: 'Estructura', v: 2, group: 'bisagra', req: { research: 'CustomEngine', missionLevel: ['Estructura', 3] } },
  { id: 'inox', name: 'Tornillería inoxidable', category: 'Estructura', v: 4, req: { research: 'CustomEngine', missionLevel: ['Estructura', 4] } },
  { id: 'varillaajust', name: 'Varillas ajustables', category: 'Estructura', v: 4, req: { research: 'CustomEngine', missionLevel: ['Estructura', 5] } },
  { id: 'sintornillos', name: 'Bisagra en lámina sin tornillos', category: 'Estructura', v: 2, req: { date: '5/1', research: 'CustomEngine', missionLevel: ['Estructura', 5] } },
  { id: 'muelle', name: 'Bisagra flex de muelle', category: 'Estructura', v: 6, group: 'bisagra', req: { research: 'CustomEngine', missionLevel: ['Estructura', 6] } },
  { id: 'memoria', name: 'Aleación con memoria de forma', category: 'Estructura', v: 8, req: { date: '4/1', research: 'CustomEngine', missionLevel: ['Estructura', 8] } },
  { id: 'modular', name: 'Bisagra magnética y modular', category: 'Estructura', v: 2, req: { missionLevel: ['Estructura', 5], date: '22/1' } },
  // Forma (gameplay)
  { id: 'plantillas', name: 'Plantillas de ajuste', category: 'Forma', v: 2, req: { research: 'CustomEngine', missionLevel: ['Forma', 1] } },
  { id: 'puente', name: 'Puente anatómico', category: 'Forma', v: 2, req: { research: 'CustomEngine', missionLevel: ['Forma', 2] } },
  { id: 'parametrico', name: 'Fresado CNC escultórico', category: 'Forma', v: 4, req: { date: '11/1', research: 'CustomEngine', missionLevel: ['Forma', 3] } },
  { id: 'edicionlimitada', name: 'Numeración y edición limitada', category: 'Forma', v: 2, req: { missionLevel: ['Forma', 5], date: '13/1' } },
  { id: 'escaneo', name: 'Escaneo facial 3D a medida', category: 'Forma', v: 8, req: { date: '25/1', missionLevel: ['Forma', 7] } },
  { id: 'ar', name: 'Probador de realidad aumentada', category: 'Forma', v: 8, req: { date: '24/1' } },
  // Concepto (story)
  { id: 'lineaclasica', name: 'Línea clásica', category: 'Concepto', v: 2, group: 'concepto', req: { research: 'NEVER' } },
  { id: 'lookbook', name: 'Lookbook de temporada', category: 'Concepto', v: 2, group: 'lookbook', req: { missionLevel: ['Concepto', 2] } },
  { id: 'capsula', name: 'Colección cápsula', category: 'Concepto', v: 4, group: 'concepto', req: { missionLevel: ['Concepto', 3] } },
  { id: 'lookbookpro', name: 'Lookbook profesional', category: 'Concepto', v: 4, group: 'lookbook', req: { missionLevel: ['Concepto', 4] } },
  { id: 'colab', name: 'Licencia con diseñador de moda', category: 'Concepto', v: 6, req: { date: '12/1', missionLevel: ['Concepto', 5] } },
  { id: 'storytelling', name: 'Storytelling de marca', category: 'Concepto', v: 6, group: 'concepto', req: { missionLevel: ['Concepto', 6] } },
  { id: 'firma', name: 'Firma de autor', category: 'Concepto', v: 6, req: { missionLevel: ['Concepto', 6] } },
  { id: 'altacostura', name: 'Alta costura óptica', category: 'Concepto', v: 8, group: 'concepto', req: { missionLevel: ['Concepto', 7] } },
  { id: 'viva', name: 'Colección viva (lanzamientos por redes)', category: 'Concepto', v: 10, req: { date: '21/1', missionLevel: ['Concepto', 8] } },
  // Acabados (diálogos)
  { id: 'pulido', name: 'Pulido a mano', category: 'Acabados', v: 1, req: { missionLevel: ['Acabados', 2] } },
  { id: 'degradado', name: 'Colores degradados', category: 'Acabados', v: 4, req: { missionLevel: ['Acabados', 3] } },
  { id: 'lacado', name: 'Acabado mate de tacto suave', category: 'Acabados', v: 6, req: { date: '8/1', missionLevel: ['Acabados', 5] } },
  { id: 'laser', name: 'Grabado láser', category: 'Acabados', v: 6, group: 'grabado', req: { missionLevel: ['Acabados', 5] } },
  { id: 'banooro', name: 'Recubrimiento PVD y baño de oro', category: 'Acabados', v: 6, group: 'grabado', req: { missionLevel: ['Acabados', 7] } },
  { id: 'nacar', name: 'Nácar y gemas', category: 'Acabados', v: 10, req: { missionLevel: ['Acabados', 8] } },
  // Ergonomía (level design)
  { id: 'tallas', name: 'Tallas múltiples', category: 'Ergonomia', v: 1, req: { missionLevel: ['Ergonomia', 2] } },
  { id: 'plaquetas', name: 'Plaquetas de silicona', category: 'Ergonomia', v: 2, req: { missionLevel: ['Ergonomia', 4] } },
  { id: 'antideslizante', name: 'Terminales antideslizantes', category: 'Ergonomia', v: 4, req: { missionLevel: ['Ergonomia', 5] } },
  { id: 'termico', name: 'Ajuste térmico en tienda', category: 'Ergonomia', v: 6, req: { missionLevel: ['Ergonomia', 6] } },
  { id: 'ultraligero', name: 'Pesos ultraligeros', category: 'Ergonomia', v: 8, req: { missionLevel: ['Ergonomia', 7] } },
  // Lentes (IA)
  { id: 'cr39', name: 'Lentes orgánicas CR-39', category: 'Lentes', v: 2, group: 'lente', req: { research: 'CustomEngine', missionLevel: ['Lentes', 1] } },
  { id: 'endurecido', name: 'Tratamiento endurecido', category: 'Lentes', v: 2, req: { missionLevel: ['Lentes', 2] } },
  { id: 'antirreflejante', name: 'Antirreflejante', category: 'Lentes', v: 4, req: { missionLevel: ['Lentes', 3] } },
  { id: 'polarizadas', name: 'Lentes polarizadas de alta eficiencia', category: 'Lentes', v: 4, req: { missionLevel: ['Lentes', 4] } },
  { id: 'fotocromaticas', name: 'Lentes fotocromáticas', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 5] } },
  { id: 'altoindice', name: 'Alto índice 1.67', category: 'Lentes', v: 6, group: 'lente', req: { missionLevel: ['Lentes', 5] } },
  { id: 'filtroazul', name: 'Filtro de luz azul-violeta', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 5], date: '20/1' } },
  { id: 'progresivos', name: 'Lentes progresivas', category: 'Lentes', v: 8, group: 'lente', req: { missionLevel: ['Lentes', 7] } },
  { id: 'freeform', name: 'Progresivas freeform a medida', category: 'Lentes', v: 10, group: 'lente', req: { date: '9/1', missionLevel: ['Lentes', 8] } },
  // Escaparate (world design)
  { id: 'expositor', name: 'Expositores básicos', category: 'Escaparate', v: 2, req: { missionLevel: ['Escaparate', 2] } },
  { id: 'led', name: 'Escaparate con pantallas LED', category: 'Escaparate', v: 2, req: { date: '19/1', missionLevel: ['Escaparate', 3] } },
  { id: 'espejo', name: 'Espejo inteligente', category: 'Escaparate', v: 2, enginePoints: 0, req: { date: '24/1', missionLevel: ['Escaparate', 4] } },
  { id: 'tematico', name: 'Escaparate temático', category: 'Escaparate', v: 4, req: { missionLevel: ['Escaparate', 5] } },
  { id: 'merchandising', name: 'Visual merchandising pro', category: 'Escaparate', v: 6, req: { missionLevel: ['Escaparate', 6] } },
  { id: 'showroom', name: 'Experiencia omnicanal en tienda', category: 'Escaparate', v: 8, req: { date: '25/1', missionLevel: ['Escaparate', 7] } }
];

/* ---------- investigaciones generales ---------- */
DATA.RESEARCH = [
  { id: 'NewTopic', name: 'Nuevo estilo', category: 'General', pointsCost: 10, duration: 10000, isTopic: true },
  { id: 'CustomEngine', name: 'Taller propio', category: 'General', pointsCost: 50, duration: 15000, desc: 'Permite diseñar tus propias líneas de producción con las tecnologías investigadas.' },
  { id: 'MediumSizeGames', name: 'Colecciones medianas', category: 'Gestión', pointsCost: 10, duration: 10000, cost: 150000, req: c => c.staff.length > 1, desc: 'Colecciones más amplias: más tiempo, más puntos y más ventas. Requiere al menos 2 personas.' },
  { id: 'LargeSizeGames', name: 'Colecciones grandes', category: 'Gestión', pointsCost: 40, duration: 15000, cost: 300000, req: c => c.fans > 25000 && c.staff.length > 4, desc: 'Grandes colecciones de temporada. Requiere 25.000 clientes fieles y 5 personas.' },
  { id: 'AAA', name: 'Colecciones insignia', category: 'Gestión', pointsCost: 80, duration: 20000, cost: 1000000, req: c => c.level >= 4 && c.hasResearch('LargeSizeGames') && c.staff.length > 5, desc: 'La colección de referencia de la temporada: más tiempo, más puntos y más ventas. Requiere la óptica insignia, colecciones grandes y 6 personas.' },
  { id: 'TargetAudience', name: 'Público objetivo', category: 'Diseño', pointsCost: 15, duration: 10000, cost: 30000, req: c => c.flags.targetAudienceStory, desc: 'Permite orientar cada colección a un público concreto.' },
  { id: 'PremiumLine', name: 'Línea Premium', category: 'Diseño', pointsCost: 20, duration: 10000, cost: 25000, req: c => c.isLaterOrEqualThan(3, 10), desc: 'Desbloquea el tipo Premium (lujo).' },
  { id: 'Marketing', name: 'Marketing', category: 'Comercial', pointsCost: 40, duration: 10000, cost: 50000, req: c => c.flags.marketingStory, desc: 'Campañas de publicidad para generar expectación antes del lanzamiento.' },
  { id: 'Sequels', name: 'Segundas ediciones', category: 'Diseño', pointsCost: 20, duration: 13000, cost: 80000, req: c => c.isLaterOrEqualThan(8, 6), desc: 'Relanza colecciones de éxito como nuevas ediciones.' },
  { id: 'MultiGenre', name: 'Tipo combinado', category: 'Diseño', pointsCost: 80, duration: 10000, cost: 35000, req: c => c.isLaterOrEqualThan(12, 8), desc: 'Combina dos tipos en una colección (p. ej. Sol + Deportiva).' },
  { id: 'MultiPlatform', name: 'Multicanal', category: 'Comercial', pointsCost: 100, duration: 15000, cost: 500000, req: c => c.isLaterOrEqualThan(17, 2), desc: 'Lanza la misma colección en hasta 3 canales a la vez.' },
  { id: 'Gabinete', name: 'Gabinete optométrico', category: 'Clínica', pointsCost: 30, duration: 12000, cost: 60000, req: c => c.level >= 3, desc: 'Ingresos recurrentes por revisiones visuales. Requiere la óptica con gabinete.' },
  { id: 'Lentillas', name: 'Adaptación de lentes de contacto', category: 'Clínica', pointsCost: 60, duration: 12000, cost: 90000, req: c => c.hasResearch('Gabinete'), desc: 'Más ingresos por paciente en el gabinete.' },
  { id: 'Retinografo', name: 'Retinógrafo y OCT', category: 'Clínica', pointsCost: 120, duration: 15000, cost: 250000, req: c => c.hasResearch('Lentillas') && c.isLaterOrEqualThan(10, 1), desc: 'Instrumental avanzado: más pacientes y mejor reputación.' },
  { id: 'TerapiaVisual', name: 'Terapia visual', category: 'Clínica', pointsCost: 200, duration: 15000, cost: 400000, req: c => c.hasResearch('Retinografo') && c.level >= 4, desc: 'Unidad de terapia visual y baja visión: ingresos premium.' }
];

/* ---------- campañas de marketing ---------- */
DATA.MARKETING = [
  { id: 'revistas', name: 'Anuncios en revistas', short: 'Revistas', desc: 'Publicidad en revistas del sector y de moda.', marketingFactor: 0.5, cost: 50000 },
  { id: 'demos', name: 'Revistas y muestras', short: 'Muestras', desc: 'Anuncios y envío de muestras a ópticas e influencers.', marketingFactor: 1, cost: 150000 },
  { id: 'campana', name: 'Campaña pequeña', short: 'Campaña', desc: 'Campaña nacional: prensa, muestras y entrevistas.', marketingFactor: 1.5, cost: 500000 },
  { id: 'campanaxl', name: 'Campaña grande', short: 'Campaña XL', desc: 'Campaña internacional con TV, desfiles y embajadores.', marketingFactor: 2, cost: 2000000 }
];

/* ---------- formación ---------- */
DATA.TRAINING = [
  { id: 'curso_diseno', name: 'Curso de diseño de monturas', cost: 70000, pointsCost: 10, duration: 20000, basePoints: 12, tF: 0.2, dF: 1, rF: 0.1, sF: 0, maxP: 700, level: 1 },
  { id: 'curso_tecnico', name: 'Curso de taller y montaje', cost: 70000, pointsCost: 10, duration: 20000, basePoints: 12, tF: 1, dF: 0.2, rF: 0.1, sF: 0, maxP: 700, level: 1 },
  { id: 'curso_gestion', name: 'Curso de gestión de óptica', cost: 70000, pointsCost: 10, duration: 20000, basePoints: 12, tF: 0.1, dF: 0.1, rF: 0.2, sF: 1, maxP: 700, level: 1 },
  { id: 'curso_optometria', name: 'Curso de optometría avanzada', cost: 70000, pointsCost: 10, duration: 20000, basePoints: 12, tF: 0.1, dF: 0.1, rF: 1, sF: 0.1, maxP: 700, level: 1 },
  { id: 'master_diseno', name: 'Máster en diseño de gafas', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 0.2, dF: 1, rF: 0.1, sF: 0, maxP: 900, level: 3 },
  { id: 'master_tecnico', name: 'Máster en tecnología óptica', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 1, dF: 0.2, rF: 0.1, sF: 0, maxP: 900, level: 3 },
  { id: 'master_gestion', name: 'Máster en dirección comercial', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 0.1, dF: 0.1, rF: 0.2, sF: 1, maxP: 900, level: 3 },
  { id: 'master_idi', name: 'Máster en I+D óptico', cost: 140000, pointsCost: 30, duration: 20000, basePoints: 13, tF: 0.1, dF: 0.1, rF: 1, sF: 0.1, maxP: 900, level: 3 },
  { id: 'vacaciones', name: 'Vacaciones', cost: 0, pointsCost: 0, duration: 8000, isVacation: true, level: 1 }
];

/* ---------- encargos genéricos (contratos) ---------- */
DATA.CONTRACTS = {
  small: [
    { name: 'Festival de música de verano', desc: 'Gafas de sol promocionales serigrafiadas con filtro UV400 para la entrada VIP.', tF: 0.8, dF: 1.6, rF: 1 },
    { name: 'Residencia de mayores', desc: 'Lote de gafas de lectura resistentes, ligeras y con cordón.', tF: 1, dF: 1, rF: 1 },
    { name: 'Campaña escolar del concello', desc: 'Monturas infantiles flexibles para los niños que no pasan el cribado de visión.', tF: 1.3, dF: 1.2, rF: 1 },
    { name: 'Productora de series de época', desc: 'Réplicas artesanales de monturas de los años 50 que no hagan reflejos en cámara.', tF: 0.8, dF: 2, rF: 1.3 },
    { name: 'Astillero de la ría', desc: 'Gafas de protección laboral graduadas para los soldadores del dique.', tF: 2, dF: 0.6, rF: 1 },
    { name: 'Club de fútbol de la ciudad', desc: 'Gafas de sol con los colores del equipo para la tienda oficial.', tF: 1, dF: 1.5, rF: 1 },
    { name: 'Club ciclista local', desc: 'Cuarenta gafas deportivas con lentes intercambiables.', tF: 1.5, dF: 1, rF: 1 },
    { name: 'Coleccionista vintage', desc: 'Restaurar y replicar una montura de los años 60.', tF: 1.4, dF: 1.6, rF: 1.3 }
  ],
  medium: [
    { name: 'Flota pesquera de altura', desc: 'Gafas polarizadas con cordón flotante para las tripulaciones del Gran Sol.', tF: 1.8, dF: 1, rF: 1.1 },
    { name: 'Mutua de accidentes de trabajo', desc: 'Convenio anual para reponer gafas rotas en accidentes laborales.', tF: 1.6, dF: 1, rF: 1.3 },
    { name: 'Aerolínea nacional', desc: 'Gafas de sol de uniforme para pilotos: lente neutra, sin polarizar, para leer las pantallas de cabina.', tF: 1.6, dF: 1.4, rF: 1.1 },
    { name: 'Marca de moda', desc: 'Cápsula de gafas para su desfile de temporada.', tF: 1, dF: 2.4, rF: 1 },
    { name: 'Federación de montaña', desc: 'Gafas de glaciar con protecciones laterales para el equipo nacional.', tF: 2, dF: 1.2, rF: 1.1 }
  ],
  large: [
    { name: 'Cooperativa nacional de ópticas', desc: 'Línea de monturas de marca blanca en acetato para cientos de asociados.', tF: 2, dF: 2, rF: 1.2 },
    { name: 'Cadena de grandes almacenes', desc: 'Colección cápsula de sol de autor con anticipo y regalías.', tF: 1.4, dF: 2.8, rF: 1.3 },
    { name: 'Delegación olímpica', desc: 'Proveedor oficial de gafas deportivas del equipo.', tF: 3, dF: 1.8, rF: 1.3 },
    { name: 'Programa estatal de ayudas visuales', desc: 'Monturas infantiles robustas para el programa público de gafas para menores.', tF: 2.5, dF: 2, rF: 1.2 }
  ]
};

/* ---------- revistas ---------- */
DATA.REVIEWERS = ['Óptica & Moda', 'Gaceta del Óptico', 'Lentes Hoy', 'Vista Consumer'];
DATA.REVIEW_TEXT = {
  1: ['Un despropósito: las varillas pellizcan las sienes y el puente parece pensado para torturar.', 'Tantas rebabas de molde que debería venderse en la sección de bricolaje.', 'Horrible.'],
  2: ['Bisagras que ceden al tercer plegado; ni en un mercadillo de los noventa colaría.', 'Ergonomía tan pobre que resbala por la nariz cada vez que parpadeas.', 'Mal acabada y peor pensada.'],
  3: ['Cumple por los pelos el marcado CE, pero no tiene alma.', 'Parece sacada de un catálogo de liquidación de hace dos décadas.', 'Decepcionante en casi todo.'],
  4: ['Calibre correcto, pero el reparto de pesos castiga las graduaciones altas.', 'Intento honesto de seguir la moda, lastrado por un acetato demasiado rígido.', 'Cumple a medias.'],
  5: ['Un caballo de batalla digno: montura honesta y sin sorpresas.', 'Producto seguro para rellenar cajoneras, aunque no hará girar cabezas.', 'Correcta sin más.'],
  6: ['Buen trabajo de taller: el biselado esconde con elegancia el grosor de las lentes.', 'Entiende lo que pide el público este año: comodidad desde la primera prueba.', 'Buena relación calidad-precio.'],
  7: ['Colores translúcidos muy bien escogidos y una adaptación facilísima.', 'Equilibrio logrado entre ligereza y moda urbana: fideliza al cliente.', 'Sólida.'],
  8: ['Pulido impecable y una charnela de cinco barriles que transmite solidez.', 'Calidad óptica y diseño se dan la mano en los escaparates más exigentes.', 'Una de las mejores del año.'],
  9: ['Una joya: ligerísima y con una geometría que favorece tanto como corrige.', 'Candidata clara a los Prismas de Oro: redefine el lujo silencioso.', 'Diseño y técnica de primer nivel.'],
  10: ['Obra maestra de la óptica contemporánea: confort ingrávido y diseño de icono.', 'Perfección diez sobre diez: de un humilde puesto a sentar cátedra.', 'Historia de las gafas.']
};

/* ---------- nombres de personal ---------- */
DATA.NAMES = {
  female: ['Antía', 'Uxía', 'Noa', 'Sabela', 'Lúa', 'Carme', 'Alba', 'Iria', 'Icía', 'Nerea', 'Xiana', 'Mariña', 'Olalla', 'Catuxa', 'Aldara', 'Lucía', 'Paula', 'Marta', 'Ana', 'Sara', 'Inés', 'Laura', 'Eva', 'Elena', 'María', 'Carmen', 'Martina', 'Sofía', 'Lara', 'Julia', 'Raquel', 'Cristina', 'Valeria', 'Pilar'],
  male: ['Xoán', 'Brais', 'Iago', 'Martiño', 'Roi', 'Anxo', 'Breixo', 'Lois', 'Diego', 'Manuel', 'Xurxo', 'Mateo', 'Hugo', 'Pedro', 'Álvaro', 'Daniel', 'Adrián', 'Pablo', 'Marcos', 'Rubén', 'David', 'Sergio', 'Jorge', 'Óscar', 'José', 'Antonio', 'Javier', 'Carlos', 'Miguel', 'Martín', 'Lucas', 'Leo', 'Fernando', 'Luis'],
  last: ['Pérez', 'López', 'García', 'Fernández', 'Rodríguez', 'Vázquez', 'Castro', 'Otero', 'Rey', 'Lamas', 'Souto', 'Blanco', 'Vila', 'Seoane', 'Freire', 'Varela', 'Iglesias', 'Pena', 'Cao', 'Miguez', 'Nóvoa', 'Barreiro', 'Ferreiro', 'Costa', 'Martínez', 'Sánchez', 'Gómez', 'Díaz', 'Álvarez', 'Romero', 'Piñeiro', 'Dopico', 'Mosquera', 'Pazos', 'Bello', 'Rivas', 'Cendán', 'Casares', 'Domínguez', 'Méndez']
};

/* ---------- noticias programadas (año/mes) ---------- */
DATA.NEWS = [
  { date: '1/1/1', title: 'Bienvenido', text: 'Es 1995. Has montado un puesto de gafas en el mercado con 70.000 € ahorrados. Haz clic en el mostrador (o en «Nueva colección») para diseñar tu primera colección. Lo que más pesa en la nota es que el tipo pegue con el estilo (Aviador → Sol, Envolvente → Deportiva, Media luna → Lectura). En el mercadillo funcionan el sol y la lectura: las gafas graduadas necesitan una óptica con gabinete.' },
  { date: '1/8/1', title: 'Rumor', text: 'Dicen que las grandes ópticas van a dejar de fabricar sus propias monturas y buscarán proveedores pequeños.' },
  { date: '2/1/1', title: 'Noticias del sector', text: 'Las ópticas de barrio empiezan a comprar colecciones a diseñadores independientes. Su red abrirá pedidos la semana que viene.' },
  { date: '2/6/1', title: 'Público objetivo', text: 'Los estudios de mercado empiezan a segmentar las ventas de gafas por edades. Investigar "Público objetivo" permitiría orientar mejor cada colección.', flag: 'targetAudienceStory' },
  { date: '3/4/1', title: 'Publicidad', text: 'Las revistas de moda lanzan secciones de óptica. Investigar "Marketing" permitiría anunciar las colecciones antes de su lanzamiento.', flag: 'marketingStory' },
  { date: '3/9/2', title: 'Exposición abierta', text: 'Una cadena estrena tiendas sin mostrador: el cliente coge las monturas y se las prueba sin pedir permiso. Las ópticas de cajonera empiezan a parecer antiguas.' },
  { date: '4/6/2', title: 'Marcado CE obligatorio', text: 'Termina el periodo transitorio europeo: ninguna montura ni gafa de sol podrá venderse sin el marcado CE. Los lotes sin papeles ya no pasan una inspección.' },
  { date: '6/1/1', title: 'Progresivos digitales', text: 'Los grandes laboratorios presentan las primeras lentes progresivas talladas punto a punto. Prometen acabar con el mareo de los primeros días.' },
  { date: '7/1/1', title: 'IberÓptica', text: 'La feria IberÓptica (Madrid) se celebrará cada año en junio. Las ópticas con local podrán reservar stand en mayo.' },
  { date: '9/11/3', title: 'Profesión sanitaria', text: 'La nueva ley de profesiones sanitarias reconoce al óptico-optometrista como profesional sanitario. Ningún gabinete podrá abrir sin un titulado colegiado al frente.' },
  { date: '14/10/1', title: 'Crisis', text: 'Estalla la crisis financiera. Las familias aplazan la renovación de sus gafas y piden aprovechar la montura vieja: «cámbiame solo los cristales».' },
  { date: '15/10/3', title: 'Adiós a la venta ambulante', text: 'La nueva normativa de productos sanitarios deja fuera de los mercadillos las gafas graduadas y premontadas. Toca ser 100 % formales.' },
  { date: '16/9/1', title: 'Grado universitario', text: 'Las facultades estrenan el grado de cuatro años en Óptica y Optometría: más formación clínica y sueldos de salida algo más altos.' },
  { date: '19/4/1', title: 'Gafas inteligentes', text: 'Las gafas con cámara y pantalla salen del laboratorio. Los fabricantes tecnológicos buscan socios ópticos que sepan graduarlas.' },
  { date: '19/6/1', title: 'Sol en internet', text: 'Unos jóvenes emprendedores venden millones de gafas de sol espejadas a 25 € por redes sociales. El cliente joven ya compra sol sin pisar una óptica.' },
  { date: '21/1/1', title: 'Pantallas', text: 'El uso masivo del móvil dispara las consultas por fatiga visual. Llegan los tratamientos con filtro de luz azul-violeta.' },
  { date: '23/5/1', title: 'Reglamento europeo', text: 'Bruselas aprueba el nuevo reglamento de productos sanitarios: más trazabilidad para cada montura y cada lente que se pone en el mercado.' },
  { date: '24/10/1', title: 'Megafusión', text: 'El mayor fabricante de lentes y el mayor de monturas se fusionan en el Grupo Vértice Óptico. Fabrican la lente, la montura y además son dueños de muchas tiendas.' },
  { date: '29/3/1', title: 'Normativa', text: 'España adapta por fin el reglamento europeo de productos sanitarios. Las premontadas siguen en venta libre, con advertencias en la etiqueta.' },
  { date: '30/1/1', title: '30 años', text: 'Casi treinta años después de aquel puesto del mercado de 1995, tu óptica es historia del sector. El juego continúa, pero ya puedes consultar tu puntuación final en el menú.' },
  { date: '30/7/1', title: 'Récord del sector', text: 'Las ópticas españolas superan los 2.100 millones de euros de facturación. Hay menos tiendas que nunca, pero más grandes y más clínicas.' }
];
