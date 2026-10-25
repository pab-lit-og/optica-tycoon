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
  { id: 'premium',   name: 'Lujo',   goldenRatio: 0.5, icon: '💎', research: 'PremiumLine' },
  { id: 'inteligente', name: 'Inteligente', goldenRatio: 1.4, icon: '🥽', research: 'LineaInteligente' }
];

/* ---------- fases y campos (misiones). Pesos por tipo en el mismo orden ---------- */
DATA.STAGES = [
  { name: 'Fase 1 · Diseño', missions: [
    { id: 'Estructura', name: 'Estructura y bisagras', desc: 'Varillas, bisagras, tornillería y resistencia.', tF: 0.8, dF: 0.2, gw: [0.8, 0.9, 1, 1, 0.8, 0.9, 0.9] },
    { id: 'Forma',      name: 'Forma y frente',        desc: 'Silueta del frente, proporciones y encaje facial.', tF: 0.2, dF: 0.8, gw: [1, 0.9, 0.9, 0.8, 0.9, 1, 0.8] },
    { id: 'Concepto',   name: 'Concepto y tendencia',  desc: 'Inspiración, moodboard y narrativa de la colección.', tF: 0.2, dF: 0.8, gw: [1, 0.8, 0.8, 0.8, 0.8, 1, 0.9] }
  ]},
  { name: 'Fase 2 · Fabricación', missions: [
    { id: 'Acabados',   name: 'Acabados y color',      desc: 'Pulidos, lacados, colores y texturas.', tF: 0.1, dF: 0.9, gw: [1, 0.9, 0.8, 0.9, 0.9, 1, 0.7] },
    { id: 'Ergonomia',  name: 'Ergonomía y tallaje',   desc: 'Tallas, plaquetas, peso y comodidad.', tF: 0.6, dF: 0.4, gw: [0.8, 1, 1, 1, 0.6, 0.8, 1] },
    { id: 'Lentes',     name: 'Lentes y tratamientos', desc: 'Lentes, filtros y tratamientos ópticos.', tF: 0.8, dF: 0.2, gw: [0.8, 1, 1, 1, 0.6, 0.8, 1] }
  ]},
  { name: 'Fase 3 · Lanzamiento', missions: [
    { id: 'Escaparate', name: 'Escaparate y presentación', desc: 'Exposición en tienda, fotografía y catálogo.', tF: 0.4, dF: 0.6, gw: [1, 0.8, 0.8, 0.8, 1, 1, 0.9] },
    { id: 'Materiales', name: 'Materiales y calidad',  desc: 'Calidad de materiales y control de producción.', tF: 0.5, dF: 0.5, gw: [0.8, 0.9, 1, 1, 0.6, 1, 1] },
    { id: 'Packaging',  name: 'Packaging y accesorios', desc: 'Estuches, gamuzas y experiencia de compra.', tF: 0.4, dF: 0.6, gw: [0.9, 0.6, 0.9, 0.8, 0.8, 1, 0.8] }
  ]}
];
DATA.MISSIONS = DATA.STAGES.flatMap(s => s.missions);

/* ---------- estilos (topics). gw = pesos por tipo, aw = pesos por público [J,T,A]
   mo = overrides opcionales de misiones (por tipo, 9 valores; 0 = sin cambio) ---------- */
DATA.TOPICS = [
  { id: 'aviador', name: 'Aviador', year: 1937, gw: [1, 0.8, 0.8, 0.6, 0.6, 0.9, 0.7], aw: [0.8, 1, 0.9], desc: 'Nació para proteger a los pilotos del deslumbramiento en altitud con lentes en forma de gota.' },
  { id: 'wayfarer', name: 'Trapezoidal clásica', year: 1956, gw: [1, 1, 0.6, 0.9, 0.9, 0.9, 0.9], aw: [1, 1, 0.8], desc: 'La primera silueta de pasta que rompió con el metal y se hizo icono del rock de los cincuenta.' },
  { id: 'pantos', name: 'Pantos', year: 1935, gw: [0.9, 1, 0.6, 0.8, 1, 1, 0.8], aw: [0.8, 1, 1], desc: 'Redondeada abajo y achatada en la ceja: campo amplio, perfecta para graduar.' },
  { id: 'cateye', name: 'Ojo de gato', year: 1950, gw: [1, 1, 0.6, 0.8, 0.9, 1, 0.6], aw: [0.8, 1, 0.9], desc: 'Las divas del cine clásico la hicieron famosa: eleva los ángulos superiores hacia las sienes.' },
  { id: 'clubmaster', name: 'Cejas marcadas', year: 1947, gw: [0.9, 1, 0.6, 0.6, 0.9, 0.9, 0.6], aw: [0.8, 0.9, 1], desc: 'Barra superior de acetato que imita las cejas sobre aros metálicos casi invisibles.' },
  { id: 'redondas', name: 'Redonda clásica', year: 1965, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.9, 0.6], aw: [1, 0.9, 0.8], desc: 'La geometría original de la óptica, adoptada en los sesenta por la contracultura.' },
  { id: 'rectangulares', name: 'Rectangular ejecutiva', year: 1965, gw: [0.8, 1, 0.8, 0.8, 1, 0.8, 0.9], aw: [0.8, 1, 1], desc: 'Líneas horizontales sobrias: el aro de despacho de toda la vida, que se estrechó hacia el cambio de milenio.' },
  { id: 'mariposa', name: 'Mariposa', year: 1955, gw: [1, 0.9, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.6, 0.9, 1], desc: 'Calibres amplios que se abren hacia fuera como alas: mucha protección y mucha presencia.' },
  { id: 'hexagonales', name: 'Hexagonal y octogonal', year: 1930, gw: [1, 1, 0.6, 0.8, 0.8, 1, 0.6], aw: [1, 0.9, 0.6], desc: 'Facetas angulares que reinterpretan la redonda clásica con un giro geométrico.' },
  { id: 'navegador', name: 'Navegador', year: 1957, gw: [1, 0.9, 0.8, 0.6, 0.8, 0.9, 0.7], aw: [0.6, 0.9, 1], desc: 'Primo cuadrado del aviador: más superficie útil para lentes de lejos y cerca.' },
  { id: 'escudo', name: 'Escudo panorámico', year: 1985, gw: [1, 0.6, 1, 0.6, 0.6, 0.9, 0.8], aw: [1, 0.8, 0.6], desc: 'Una sola lente continua, sin tabique: nació en las pistas de esquí y saltó a la pasarela.' },
  { id: 'envolventes', name: 'Envolvente aerodinámica', year: 1984, gw: [0.9, 0.6, 1, 0.8, 0.6, 0.6, 0.8], aw: [1, 0.9, 0.6], desc: 'Curvatura pronunciada que abraza la cabeza y corta el viento lateral.',
    mo: [[0, 0, 0, 0, 1, 1, 0, 0.9, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0.9, 0, 0, 0, 1, 1, 0, 0.9, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0]] },
  { id: 'alaire', name: 'Al aire (taladrada)', year: 1985, gw: [0.8, 1, 0.6, 0.6, 0.8, 0.9, 0.6], aw: [0.6, 0.8, 1], desc: 'Sin aro: puente y varillas van atornillados directamente a la lente.',
    mo: [[0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0.9, 1, 0, 1, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [1, 0, 0, 0, 0.9, 0.9, 0, 1, 0]] },
  { id: 'nylor', name: 'Media montura ranurada', year: 1955, gw: [0.6, 1, 0.8, 0.6, 0.9, 0.8, 0.6], aw: [0.6, 0.9, 1], desc: 'Un hilo de nailon tensado sujeta el borde inferior de la lente: ligera y discreta.' },
  { id: 'doblepuente', name: 'Doble puente', year: 1937, gw: [1, 0.9, 0.8, 0.6, 0.6, 0.9, 0.6], aw: [0.8, 1, 0.9], desc: 'Un travesaño sobre el puente refuerza el frente y le da aire retro.' },
  { id: 'medialuna', name: 'Media luna', year: 1950, gw: [0.6, 0.6, 0.6, 0.6, 1, 0.6, 0.6], aw: [0.6, 0.6, 1], desc: 'Calibre bajo pensado para leer de cerca y mirar por encima del aro.' },
  { id: 'keyhole', name: 'Puente de cerradura', year: 1950, gw: [0.9, 1, 0.6, 0.8, 0.9, 1, 0.7], aw: [0.8, 1, 1], desc: 'Escotadura con forma de cerradura antigua que reparte el peso sin tocar el caballete.' },
  { id: 'crownpanto', name: 'Pantos corona', year: 1935, gw: [0.9, 1, 0.6, 0.6, 0.8, 1, 0.6], aw: [0.8, 1, 0.9], desc: 'Pantos con la línea superior cortada en biseles rectos, sastrería del Jura francés.' },
  { id: 'microoval', name: 'Ovalada micro', year: 1993, gw: [1, 0.9, 0.6, 0.8, 0.9, 0.9, 0.6], aw: [1, 0.8, 0.6], desc: 'Calibre pequeño y elíptico de los noventa: poco grosor en miopías altas.' },
  { id: 'glaciar', name: 'Glaciar con laterales', year: 1950, gw: [0.9, 0.6, 1, 0.6, 0.6, 0.9, 0.6], aw: [0.9, 0.9, 0.6], desc: 'Montura de alta montaña con protecciones laterales contra la ceguera de las nieves.' },
  { id: 'carey', name: 'Carey y habana', year: 1940, gw: [1, 1, 0.6, 0.8, 1, 1, 0.6], aw: [0.8, 1, 1], desc: 'Moteado ámbar y marrón en acetato que sustituyó al caparazón de tortuga.' },
  { id: 'transparentes', name: 'Acetato cristal', year: 1955, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.9, 0.7], aw: [1, 1, 0.8], desc: 'Acetato translúcido o champán: presencia sin oscurecer la cara.' },
  { id: 'bicolor', name: 'Acetato laminado bicolor', year: 1975, gw: [0.9, 1, 0.6, 1, 0.9, 0.9, 0.6], aw: [0.9, 1, 0.9], desc: 'Capas de color termosoldadas que asoman al fresar el frente y biselar.' },
  { id: 'minimal', name: 'Metal fino minimalista', year: 1965, gw: [0.9, 1, 0.6, 0.8, 0.9, 0.9, 0.9], aw: [0.9, 1, 0.9], desc: 'Hilo metálico de apenas un milímetro: ligereza visual y discreción.' },
  { id: 'titanio', name: 'Titanio técnico', year: 1983, gw: [0.8, 1, 0.8, 0.6, 0.6, 1, 0.9], aw: [0.6, 0.9, 1], desc: 'Metal hipoalergénico e inoxidable, mucho más ligero que el acero.' },
  { id: 'chunky', name: 'Acetato grueso', year: 1955, gw: [1, 1, 0.6, 0.6, 0.8, 1, 0.6], aw: [0.9, 1, 0.8], desc: 'Frentes de 8 a 10 mm pulidos días enteros en bombos con virutas de haya.' },
  { id: 'combinada', name: 'Combinada acetato-metal', year: 1950, gw: [0.9, 1, 0.6, 0.6, 0.8, 1, 0.8], aw: [0.8, 1, 1], desc: 'Aros de pasta encajados en un chasis metálico: lo mejor de los dos mundos.' },
  { id: 'madera', name: 'Madera y bambú', year: 2008, gw: [1, 0.8, 0.6, 0.6, 0.6, 0.9, 0.6], aw: [0.9, 0.9, 0.6], desc: 'Chapas prensadas en sentidos cruzados: veta irrepetible y hasta flotan.',
    mo: [[0, 0, 0, 1, 0, 0, 0, 1, 0.9], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 0, 0, 0, 0, 0, 0], [0, 0, 0, 1, 0, 0, 0, 1, 0.9]] },
  { id: 'flexible', name: 'Polímero flexible', year: 1988, gw: [0.8, 0.9, 1, 1, 0.9, 0.6, 0.8], aw: [1, 0.9, 0.6], desc: 'Poliamidas y siliconas que se retuercen y vuelven a su forma sin romperse.' },
  { id: 'carbono', name: 'Fibra de carbono y aluminio', year: 1998, gw: [0.8, 0.9, 1, 0.6, 0.6, 1, 0.9], aw: [0.6, 0.9, 0.9], desc: 'Materiales de la industria aeroespacial: rigidez y estética técnica.' },
  { id: 'joya', name: 'Alta joyería', year: 1965, gw: [0.9, 0.8, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.6, 0.8, 1], desc: 'Baños de oro, platino y pedrería para el cliente más exclusivo.' },
  { id: 'acero', name: 'Acero ultrafino sin tornillos', year: 1996, gw: [0.8, 1, 0.8, 0.8, 0.6, 0.9, 0.8], aw: [0.8, 1, 1], desc: 'Lámina de acero troquelada y plegada: sin un solo tornillo ni soldadura.' },
  { id: 'neon', name: 'Flúor y espejados', year: 1984, gw: [1, 0.6, 1, 0.9, 0.8, 0.6, 0.6], aw: [1, 0.8, 0.6], desc: 'Colores ácidos y lentes espejadas: surf, festivales y mucha luz.' },
  { id: 'soft', name: 'Textura mate', year: 1996, gw: [0.9, 0.9, 1, 1, 0.9, 0.8, 0.8], aw: [1, 1, 0.8], desc: 'Barniz de tacto sedoso que no brilla y agarra aunque haya sudor.' },
  { id: 'nordico', name: 'Minimalismo nórdico', year: 1986, gw: [0.8, 1, 0.6, 0.8, 0.8, 1, 0.8], aw: [0.8, 1, 1], desc: 'La forma sigue a la función: sin logotipos ni adornos.' },
  { id: 'retro70', name: 'Retro años 70', year: 1995, gw: [1, 0.9, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.9, 1, 0.8], desc: 'Calibres generosos con lentes degradadas en ámbar, rosa o azul.' },
  { id: 'retro80', name: 'Exceso años 80', year: 1995, gw: [1, 0.9, 0.8, 0.6, 0.8, 1, 0.6], aw: [0.8, 0.9, 0.9], desc: 'Siluetas contundentes con apliques dorados: gafas de mando.' },
  { id: 'noventas', name: 'Grunge y ciberpunk', year: 1993, gw: [1, 0.9, 0.8, 0.8, 0.6, 0.9, 0.7], aw: [1, 0.9, 0.6], desc: 'Del óvalo de pasta blanca a la microgafa oscura de ciencia ficción.' },
  { id: 'y2k', name: 'Estética dosmilera', year: 2000, gw: [1, 0.8, 0.8, 0.8, 0.6, 1, 0.8], aw: [1, 0.8, 0.6], desc: 'Pantallas al aire, tornillos a la vista, brillos en las varillas y lentes degradadas.' },
  { id: 'logomania', name: 'Logomanía', year: 2001, gw: [1, 0.8, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.9, 0.9, 0.8], desc: 'Varillas anchas convertidas en valla publicitaria de monogramas.' },
  { id: 'hipster', name: 'Indie y geek-chic', year: 2007, gw: [0.9, 1, 0.6, 0.9, 0.9, 0.8, 0.6], aw: [1, 1, 0.6], desc: 'La gafa de pasta negra gruesa como seña de identidad, aunque no haga falta graduar.' },
  { id: 'eco', name: 'Ecodiseño', year: 2012, gw: [0.9, 1, 0.9, 0.9, 0.9, 0.8, 0.6], aw: [1, 1, 0.8], desc: 'Redes de pesca recuperadas, ricino o bioacetato: colecciones trazables.' },
  { id: 'techwear', name: 'Techwear urbano', year: 2016, gw: [0.9, 0.9, 1, 0.6, 0.6, 0.9, 1], aw: [1, 0.9, 0.6], desc: 'Diseño modular con cordones técnicos, imanes de bloqueo y ventilación antivaho.' },
  { id: 'smart', name: 'Gafa conectada', year: 2016, gw: [0.9, 1, 0.9, 0.6, 0.6, 0.9, 1], aw: [0.9, 1, 0.7], desc: 'Audio, sensores y asistente en las varillas: la montura se vuelve electrónica.' },
  { id: 'lujosilencioso', name: 'Lujo silencioso', year: 2021, gw: [0.9, 1, 0.6, 0.6, 0.8, 1, 0.8], aw: [0.6, 1, 1], desc: 'Nada de logos: proporciones clásicas, charnelas de siete barriles y materiales nobles.' },
  { id: 'arquitecto', name: 'Vanguardia arquitectónica', year: 1997, gw: [0.9, 1, 0.6, 0.6, 0.8, 1, 0.7], aw: [0.6, 0.9, 1], desc: 'Monturas asimétricas o escultóricas para quien quiere firmar con la cara.' },
  { id: 'steampunk', name: 'Steampunk', year: 2005, gw: [0.9, 0.6, 0.6, 0.6, 0.6, 0.9, 0.6], aw: [0.9, 0.8, 0.6], desc: 'Retrofuturismo victoriano: aros abatibles, latón envejecido y cuero.' },
  { id: 'carreras', name: 'Herencia de carreras', year: 1960, gw: [1, 0.8, 1, 0.6, 0.6, 1, 0.6], aw: [0.6, 0.9, 1], desc: 'Puentes y varillas perforados como el volante de un bólido clásico.' },
  { id: 'surf', name: 'Surf y skate', year: 1978, gw: [1, 0.8, 1, 0.9, 0.6, 0.6, 0.6], aw: [1, 0.9, 0.6], desc: 'Monturas robustas hechas para aguantar salitre, arena y asfalto.' },
  { id: 'oversize', name: 'Maxigafa', year: 1966, gw: [1, 0.8, 0.6, 0.6, 0.6, 1, 0.6], aw: [0.8, 0.9, 1], desc: 'Calibres enormes de ceja a mejilla para esconder la mirada.' },
  { id: 'flexkids', name: 'Infantil ergonómico', year: 1995, gw: [0.8, 0.9, 0.9, 1, 0.6, 0.6, 0.6], aw: [1, 0.6, 0.6], desc: 'Puentes adaptados a narices en crecimiento, colores vivos y bandas elásticas.' },
  /* ---- épocas: 1960-1995 (docs/research/RESULTADO_PASADO_1965_1995.md) y 2026-2076 (RESULTADO_FUTURO_2026_2076.md) ---- */
  { id: 'bifocal', name: 'Bifocal con lupa', year: 1960, gw: [0.6, 1, 0.6, 0.6, 1, 0.6, 0.6], aw: [0.6, 0.7, 1], desc: 'La «lupa» pegada abajo del cristal: el présbita de toda la vida antes de que los progresivos fueran asequibles.' },
  { id: 'culovaso', name: 'Pasta de culo de vaso', year: 1960, gw: [0.6, 1, 0.6, 0.9, 0.8, 0.6, 0.6], aw: [0.8, 0.9, 1], desc: 'Montura de pasta pequeña y robusta para cristales de alta miopía gruesos como el fondo de un vaso.' },
  { id: 'parche', name: 'Infantil con parche', year: 1960, gw: [0.6, 0.9, 0.6, 1, 0.6, 0.6, 0.6], aw: [1, 0.6, 0.6], desc: 'Gafa de pasta irrompible con parche oclusor para el ojo vago: el uniforme del colegio de los 60 a los 80.' },
  { id: 'visera', name: 'Visera era espacial', year: 1965, gw: [1, 0.6, 0.8, 0.7, 0.6, 1, 0.6], aw: [1, 0.8, 0.6], desc: 'Una pantalla blanca con ranura, como de astronauta yeyé, salida de los desfiles de París.' },
  { id: 'abuelita', name: 'Gafita de abuelita', year: 1966, gw: [0.9, 1, 0.6, 0.7, 1, 0.8, 0.6], aw: [1, 0.9, 0.8], desc: 'Aros metálicos redondos y finísimos, como los que un beatle se puso en un rodaje y ya nunca se quitó.' },
  { id: 'plegable', name: 'Plegable de bolsillo', year: 1968, gw: [1, 0.8, 0.8, 0.6, 0.9, 1, 0.6], aw: [0.8, 1, 1], desc: 'Se dobla por el puente y por las varillas y cabe en el bolsillo de la americana de un ladrón de guante blanco.' },
  { id: 'optyl', name: 'Pasta de resina de modista', year: 1969, gw: [1, 1, 0.6, 0.6, 0.8, 1, 0.6], aw: [0.8, 1, 1], desc: 'Resina termoestable ligera e hipoalergénica que permitió las primeras gafas con firma de la alta costura.' },
  { id: 'aviadegr', name: 'Aviador XXL degradado', year: 1970, gw: [1, 1, 0.8, 0.6, 0.6, 0.9, 0.6], aw: [0.9, 1, 0.9], desc: 'Aviador enorme de metal dorado con lente degradada en marrón o rosa, de cantante melódico a patrullero de autopista.' },
  { id: 'varillabaja', name: 'Varilla baja setentera', year: 1972, gw: [1, 1, 0.6, 0.6, 0.8, 0.9, 0.6], aw: [0.6, 1, 1], desc: 'Las varillas nacen en la parte baja del frente y dejan la ceja libre: la gafa graduada de señora de los 70.' },
  { id: 'glam', name: 'Glam y lentejuelas', year: 1973, gw: [1, 0.7, 0.6, 0.6, 0.6, 1, 0.6], aw: [1, 0.8, 0.6], desc: 'Estrellas, corazones, pedrería y plumas: la gafa como disfraz de escenario.' },
  { id: 'transicion', name: 'Metálica de la Transición', year: 1975, gw: [0.8, 1, 0.6, 0.6, 0.9, 0.8, 0.6], aw: [0.6, 1, 1], desc: 'Montura metálica grande con cristal fotocromático marrón: la gafa del concejal, del notario y del primer telediario en color.' },
  { id: 'movida', name: 'Movida y nueva ola', year: 1980, gw: [1, 0.9, 0.7, 0.8, 0.6, 0.7, 0.6], aw: [1, 0.9, 0.6], desc: 'Pasta blanca, roja o a rayas, persianas y trapezoidales de colores para salir de noche por Malasaña y por el Orzán.' },
  { id: 'cazal', name: 'Rapero de logotipo dorado', year: 1983, gw: [1, 0.7, 0.6, 0.6, 0.6, 1, 0.6], aw: [1, 0.8, 0.6], desc: 'Frentes enormes de metal y acetato con apliques dorados: el hip-hop las hizo símbolo.' },
  { id: 'esqui', name: 'Cristal mineral de esquí', year: 1984, gw: [1, 0.7, 1, 0.6, 0.6, 0.9, 0.6], aw: [1, 0.9, 0.8], desc: 'Lente mineral de alta montaña con camiseta a juego: la marca de las pistas que todos lucían en la playa.' },
  { id: 'yuppie', name: 'Ejecutivo de los ochenta', year: 1985, gw: [0.8, 1, 0.6, 0.6, 0.9, 1, 0.6], aw: [0.6, 1, 1], desc: 'Metal dorado o carey grande, doble puente y tirantes: la gafa del bróker que vende en la bolsa de Madrid.' },
  { id: 'audiogafa', name: 'Gafa auditiva', year: 2026, gw: [0.6, 1, 0.6, 0.6, 1, 0.8, 0.9], aw: [0.6, 0.8, 1], desc: 'Micrófonos direccionales en el frente y altavoces en la varilla: un audífono que nadie ve.' },
  { id: 'pantallahud', name: 'Gafa con pantalla discreta', year: 2027, gw: [0.9, 0.9, 0.8, 0.6, 0.6, 0.8, 1], aw: [1, 0.9, 0.6], desc: 'Una guía de ondas en una lente muestra mensajes y rutas sin sacar el móvil.' },
  { id: 'vintagecert', name: 'Vintage certificado', year: 2027, gw: [1, 1, 0.6, 0.7, 0.9, 1, 0.6], aw: [1, 1, 0.8], desc: 'Monturas de los noventa y los dosmil restauradas, con su historia y su pasaporte de origen.' },
  { id: 'mioexterior', name: 'Infantil con sensor de luz exterior', year: 2028, gw: [0.6, 0.9, 0.8, 1, 0.6, 0.6, 0.9], aw: [1, 0.7, 0.6], desc: 'Cuenta las horas al aire libre y avisa si el niño lee demasiado cerca.' },
  { id: 'autofoco', name: 'Autoenfoque de cristal líquido', year: 2029, gw: [0.6, 1, 0.6, 0.6, 1, 0.9, 1], aw: [0.6, 0.9, 1], desc: 'Varillas algo más gruesas esconden la batería que cambia el foco según adónde mires.' },
  { id: 'modular2', name: 'Montura modular reparable', year: 2029, gw: [0.9, 1, 0.9, 1, 0.9, 0.8, 0.8], aw: [0.9, 1, 0.9], desc: 'Frente, varillas y charnelas se cambian por separado y cada pieza lleva su pasaporte digital.' },
  { id: 'impresa3d', name: 'Impresa a medida en tienda', year: 2030, gw: [0.9, 1, 0.9, 0.9, 0.8, 0.9, 0.8], aw: [1, 1, 0.8], desc: 'Escaneo de la cara por la mañana y montura impresa por la tarde, en el mismo local.' },
  { id: 'protesica', name: 'Gafa protésica para implante retiniano', year: 2032, gw: [0.6, 0.9, 0.6, 0.6, 0.8, 0.8, 1], aw: [0.6, 0.6, 1], desc: 'Cámara y proyector infrarrojo que alimentan un implante en la retina: la gafa vuelve a ser medicina.' },
  { id: 'gafaar', name: 'Gafa de realidad aumentada cotidiana', year: 2033, gw: [0.8, 1, 0.9, 0.6, 0.6, 0.9, 1], aw: [1, 1, 0.7], desc: 'Subtítulos, rutas y traducción flotando sobre la calle, en una montura que parece de pasta normal.' },
  { id: 'electrocromica', name: 'Montura electrocrómica', year: 2033, gw: [1, 0.9, 0.9, 0.8, 0.6, 1, 0.9], aw: [1, 0.9, 0.6], desc: 'El acetato electrónico cambia de color con la ropa o el estado de ánimo.' },
  { id: 'micelio', name: 'Micelio y algas', year: 2034, gw: [0.9, 1, 0.7, 0.9, 0.9, 0.9, 0.6], aw: [1, 1, 0.8], desc: 'Monturas cultivadas en semanas con hongos y algas de la ría, compostables al final de su vida.' },
  { id: 'climatica', name: 'Gafa climática', year: 2033, gw: [1, 0.8, 1, 0.9, 0.6, 0.7, 0.7], aw: [0.9, 1, 0.9], desc: 'Protección UV extrema, laterales ventilados y lentes que refrescan la cara.' },
  { id: 'grafeno', name: 'Grafeno y metamateriales', year: 2036, gw: [0.9, 1, 1, 0.8, 0.7, 0.9, 0.9], aw: [0.8, 1, 0.9], desc: 'Varillas de un gramo que no se doblan y lentes planas como un papel.' },
  { id: 'solar', name: 'Gafa autónoma fotovoltaica', year: 2037, gw: [1, 0.8, 1, 0.7, 0.6, 0.7, 1], aw: [1, 0.9, 0.7], desc: 'Células solares en el frente: la gafa inteligente que nunca se enchufa.' },
  { id: 'sinvarillas', name: 'Sin varillas', year: 2038, gw: [0.9, 0.8, 0.6, 0.6, 1, 1, 0.8], aw: [0.8, 0.9, 1], desc: 'Pinza nasal magnética, heredera del quevedo, que no toca las orejas.' },
  { id: 'autorreparable', name: 'Polímero autorreparable', year: 2040, gw: [0.9, 1, 1, 1, 0.8, 0.8, 0.8], aw: [1, 1, 0.8], desc: 'Los arañazos y las microfisuras se cierran solos con el calor del sol.' },
  { id: 'neoanalogica', name: 'Gafa analógica sin chips', year: 2040, gw: [1, 1, 0.7, 0.9, 1, 1, 0.6], aw: [0.9, 0.9, 1], desc: 'Ni cámara, ni micro, ni batería: la montura como declaración de desconexión.' },
  { id: 'lentillaint', name: 'Montura invisible', year: 2045, gw: [0.6, 1, 1, 0.6, 0.7, 1, 1], aw: [0.9, 1, 0.8], desc: 'La colección es la lentilla: pantalla y sensores en la córnea, y la montura solo como estuche cargador.' },
  { id: 'retroveinte', name: 'Revival de los años veinte', year: 2047, gw: [1, 0.9, 0.7, 0.7, 0.8, 1, 0.9], aw: [1, 0.9, 0.7], desc: 'Pasta gruesa con cámara en la bisagra, como las primeras gafas con IA.' },
  { id: 'neural', name: 'Gafa neural', year: 2050, gw: [0.8, 0.9, 0.9, 0.6, 0.6, 1, 1], aw: [1, 0.9, 0.6], desc: 'Sensores en las varillas leen la intención: se maneja sin tocar nada.' }
];

/* ---------- canales de venta (plataformas). amount en millones de clientes potenciales (x5M como GDT)
   fechas "año/mes/semana". gw por tipo, aw por público. ---------- */
DATA.PLATFORMS = [ /* pesos por tipo topados en 1: la investigación da 1,1-1,2 a los canales afines, pero por encima de 1 rompe el ritmo económico */
  { id: 'tienda', name: 'Tienda propia', company: 'Nosotros', since: 1960, startAmount: 0.22,
    marketKeyPoints: [{ date: '2/1/1', amount: 0.24 }, { date: '4/1/1', amount: 0.41 }, { date: '4/10/2', amount: 0.48 }, { date: '11/5/2', amount: 1.1 }, { date: '16/12/1', amount: 2.1 }, { date: '20/7/1', amount: 2.4 }, { date: '22/9/2', amount: 2.6 }, { date: '23/4/1', amount: 4 }, { date: '26/12/4', amount: 5.7 }],
    unitsSold: 5.7, licencePrize: 0, published: '1/1/1', retire: '260/12/4', devCost: 5000, gw: [0.9, 1, 0.9, 1, 1, 0.6, 0.9], aw: [0.8, 0.9, 1], techLevel: 1, isOwn: true },
  { id: 'mercadillos', name: 'Mercadillos y ferias', company: 'Ayuntamiento', since: 1960, startAmount: 0.28, marketKeyPoints: [{ date: '2/5/1', amount: 0.36 }, { date: '3/1/1', amount: 0.38 }, { date: '4/1/1', amount: 0.386 }, { date: '8/1/1', amount: 0.33 }], unitsSold: 0.25, licencePrize: 0, published: '1/1/1', retire: '15/12/4', devCost: 15000, gw: [1, 0.6, 0.8, 0.7, 1, 0.6], aw: [1, 0.9, 0.8], techLevel: 1 },
  { id: 'indep', name: 'Ópticas tradicionales', company: 'Ópticas de barrio', since: 1960, startAmount: 0.356, marketKeyPoints: [{ date: '3/1/1', amount: 0.444 }, { date: '4/1/1', amount: 0.46 }, { date: '10/1/1', amount: 0.5 }, { date: '18/1/1', amount: 0.42 }], unitsSold: 0.3, licencePrize: 80000, published: '2/1/2', retire: '24/12/4', devCost: 30000, gw: [0.9, 1, 0.9, 1, 0.9, 1], aw: [0.6, 0.9, 1], techLevel: 1 },
  { id: 'farmacia', name: 'Farmacias y parafarmacias', company: 'Red de boticas', since: 1960, startAmount: 0.25, marketKeyPoints: [{ date: '10/1/1', amount: 0.35 }, { date: '30/1/1', amount: 0.45 }], unitsSold: 0.45, licencePrize: 20000, published: '2/3/1', retire: '62/12/4', devCost: 15000, gw: [0.8, 0.6, 0.6, 1, 1, 0.6], aw: [0.7, 0.9, 1], techLevel: 1 },
  { id: 'catalogo', name: 'Venta por catálogo', company: 'OptiCorreo', since: 1977, startAmount: 0.45, unitsSold: 0.4, licencePrize: 40000, published: '2/9/2', retire: '10/6/2', devCost: 25000, gw: [0.9, 0.6, 0.7, 0.6, 1, 0.6], aw: [0.6, 0.9, 1], techLevel: 2 },
  { id: 'almacenes', name: 'Grandes almacenes', company: 'Galerías Hispania', since: 1965, startAmount: 0.43, marketKeyPoints: [{ date: '6/6/2', amount: 0.55 }, { date: '14/1/1', amount: 0.6 }, { date: '20/1/1', amount: 0.5 }], unitsSold: 0.4, licencePrize: 80000, published: '3/2/3', retire: '26/6/2', devCost: 30000, gw: [1, 0.9, 0.9, 0.9, 1, 1], aw: [0.9, 1, 0.8], techLevel: 2 },
  { id: 'regional', name: 'Cooperativa de ópticos', company: 'Unión Óptica', since: 1974, startAmount: 0.5, marketKeyPoints: [{ date: '7/1/1', amount: 0.7 }, { date: '14/1/1', amount: 1 }, { date: '22/1/1', amount: 1.3 }, { date: '30/1/1', amount: 1.4 }], unitsSold: 1.4, licencePrize: 50000, published: '3/6/1', retire: '260/12/4', devCost: 30000, gw: [0.9, 1, 0.9, 1, 0.9, 0.8], aw: [0.8, 1, 1], techLevel: 2 },
  { id: 'nacional', name: 'Cadena de ópticas exprés', company: 'HoraVisión', since: 1985, startAmount: 0.6, marketKeyPoints: [{ date: '8/1/1', amount: 0.8 }, { date: '14/1/1', amount: 1.2 }, { date: '22/1/1', amount: 1.6 }, { date: '30/1/1', amount: 1.8 }], unitsSold: 1.9, licencePrize: 60000, published: '4/6/1', retire: '56/12/4', devCost: 50000, gw: [1, 1, 0.9, 0.9, 0.8, 0.8], aw: [1, 1, 0.8], techLevel: 3 },
  { id: 'central', name: 'Central de compras', company: 'Grupo VisiónRed', startAmount: 0.7, marketKeyPoints: [{ date: '10/1/1', amount: 1.3 }, { date: '16/1/1', amount: 2 }, { date: '24/1/1', amount: 2.8 }, { date: '30/1/1', amount: 3.2 }], unitsSold: 3.3, licencePrize: 120000, published: '4/9/2', retire: '260/12/4', devCost: 40000, gw: [1, 1, 1, 1, 0.9, 0.9], aw: [0.9, 1, 0.9], techLevel: 3 },
  { id: 'onlinepionera', name: 'Portal web pionero', company: 'CiberLentes 2000', startAmount: 0.7, marketKeyPoints: [{ date: '10/1/1', amount: 0.9 }], unitsSold: 0.6, licencePrize: 150000, published: '6/6/1', retire: '18/6/1', devCost: 50000, gw: [1, 0.7, 0.9, 0.6, 1, 0.7], aw: [1, 0.9, 0.6], techLevel: 3 },
  { id: 'lowcost', name: 'Franquicia del 2x1', company: 'Chevalier Ópticos', startAmount: 0.85, marketKeyPoints: [{ date: '12/1/1', amount: 1.6 }, { date: '16/1/1', amount: 2.4 }, { date: '22/1/1', amount: 2.8 }, { date: '30/1/1', amount: 3 }], unitsSold: 3, licencePrize: 200000, published: '9/3/1', retire: '66/12/4', devCost: 60000, gw: [1, 1, 0.7, 1, 0.8, 0.6], aw: [1, 0.9, 0.8], techLevel: 3 },
  { id: 'boutiques', name: 'Boutiques de moda', company: 'Concept stores', since: 1982, startAmount: 1, marketKeyPoints: [{ date: '17/1/1', amount: 1.6 }, { date: '26/1/1', amount: 2 }], unitsSold: 2.2, licencePrize: 300000, published: '11/3/1', retire: '260/12/4', devCost: 70000, gw: [1, 0.8, 0.7, 0.6, 0.9, 1], aw: [0.9, 0.9, 0.8], techLevel: 3 },
  { id: 'mutuas', name: 'Cuadro médico de mutuas', company: 'SaludVisual Plus', startAmount: 1.2, marketKeyPoints: [{ date: '18/1/1', amount: 2 }, { date: '26/1/1', amount: 3 }], unitsSold: 3.4, licencePrize: 350000, published: '13/4/1', retire: '260/12/4', devCost: 70000, gw: [0.6, 1, 0.6, 1, 0.6, 0.6], aw: [0.7, 1, 1], techLevel: 4 },
  { id: 'webpropia', name: 'Tienda online propia', company: 'Nosotros', startAmount: 1.5, unitsSold: 3.8, licencePrize: 350000, published: '13/8/4', marketKeyPoints: [{ date: '26/12/4', amount: 3.8 }], retire: '260/12/4', devCost: 50000, gw: [0.9, 0.9, 1, 0.9, 0.9, 1], aw: [1, 0.9, 0.8], techLevel: 3 },
  { id: 'clinicas', name: 'Clínicas oftalmológicas', company: 'Instituto Ocular', startAmount: 1.5, marketKeyPoints: [{ date: '22/1/1', amount: 2.4 }, { date: '30/1/1', amount: 3 }], unitsSold: 3, licencePrize: 350000, published: '15/2/1', retire: '260/12/4', devCost: 70000, gw: [0.7, 1, 0.7, 1, 0.6, 0.8], aw: [0.7, 1, 1], techLevel: 4 },
  { id: 'crowd', name: 'Venta directa online', company: 'Solaris Direct', startAmount: 2.3, marketKeyPoints: [{ date: '26/1/1', amount: 3.6 }, { date: '31/1/1', amount: 4 }], unitsSold: 4, licencePrize: 100000, published: '19/5/1', retire: '50/12/4', devCost: 50000, gw: [1, 0.8, 1, 0.7, 1, 0.8], aw: [1, 0.9, 0.6], techLevel: 4 },
  { id: 'marketplace', name: 'Gran marketplace', company: 'Ágora Prime', startAmount: 2.4, marketKeyPoints: [{ date: '26/1/1', amount: 4.2 }, { date: '31/1/1', amount: 5 }], unitsSold: 5, licencePrize: 400000, published: '20/3/1', retire: '70/12/4', devCost: 70000, gw: [1, 0.6, 1, 0.6, 1, 0.6], aw: [0.9, 1, 0.8], techLevel: 4 },
  { id: 'influencers', name: 'Venta en redes sociales', company: 'Creadores y redes', startAmount: 2.3, unitsSold: 3.7, licencePrize: 500000, published: '20/9/1', marketKeyPoints: [{ date: '26/12/4', amount: 3.7 }], retire: '58/12/4', devCost: 80000, gw: [1, 0.8, 0.7, 0.9, 0.7, 1], aw: [0.9, 1, 0.6], techLevel: 4 },
  { id: 'megaretail', name: 'Cadena vertical de diseño', company: 'Atelier Vista', startAmount: 3.6, marketKeyPoints: [{ date: '28/1/1', amount: 5.5 }, { date: '31/1/1', amount: 6 }, { date: '59/1/1', amount: 4 }], unitsSold: 6, licencePrize: 800000, published: '22/4/1', retire: '260/12/4', devCost: 90000, gw: [1, 1, 0.6, 0.8, 0.9, 1], aw: [0.9, 1, 0.8], techLevel: 5 },
  { id: 'suscripcion', name: 'Suscripción de gafas', company: 'Rent-a-Look', startAmount: 2, marketKeyPoints: [{ date: '31/1/1', amount: 3 }], unitsSold: 3, licencePrize: 500000, published: '25/2/1', retire: '260/12/4', devCost: 80000, gw: [0.9, 1, 0.7, 1, 0.6, 0.9], aw: [1, 1, 0.7], techLevel: 5 },
  { id: 'domicilio', name: 'Óptica a domicilio', company: 'Visión Rural', startAmount: 4, marketKeyPoints: [{ date: '31/1/1', amount: 5.5 }], unitsSold: 5.5, licencePrize: 1000000, published: '27/3/1', retire: '260/12/4', devCost: 80000, gw: [0.6, 1, 0.6, 0.7, 1, 0.6], aw: [0.6, 0.8, 1], techLevel: 6 },
  { id: 'techretail', name: 'Grandes superficies tecnológicas', company: 'ElectroMedia', startAmount: 5.6, marketKeyPoints: [{ date: '31/1/1', amount: 6.6 }], unitsSold: 6.6, licencePrize: 1500000, published: '29/2/1', retire: '68/12/4', devCost: 150000, gw: [0.7, 0.6, 0.9, 0.6, 0.6, 0.7], aw: [1, 0.9, 0.7], techLevel: 7 },
  /* ---- canales de época (solo en partidas que empiezan antes de 1995) ---- */
  { id: 'cadenaclasica', name: 'Ópticas Gran Vía', company: 'Gran Vía Óptica', pastOnly: true, startAmount: 0.3, unitsSold: 0.6, licencePrize: 30000, published: '-29/1/1', retire: '12/12/4', devCost: 20000, gw: [0.9, 1, 0.8, 0.9, 0.9, 0.8, 0.7], aw: [0.8, 1, 1], techLevel: 1, desc: 'La primera cadena de ópticas de las grandes ciudades: escaparates en la avenida y gafas de pasta y metal.' },
  { id: 'turismo', name: 'Quioscos de playa y gasolineras', company: 'Sol y Carretera', pastOnly: true, startAmount: 0.25, unitsSold: 0.35, licencePrize: 5000, published: '-29/1/1', retire: '1/12/4', devCost: 8000, gw: [1, 0.6, 0.8, 0.8, 0.8, 0.6, 0.6], aw: [1, 0.9, 0.7], techLevel: 1, desc: 'El sol barato del boom turístico: expositores giratorios en la costa y en la carretera.' },
  { id: 'ayudas', name: 'Mutualidad del Funcionario', company: 'Ayudas MUFACE e igualatorios', pastOnly: true, startAmount: 0.3, unitsSold: 0.7, licencePrize: 25000, published: '-17/7/1', retire: '260/12/4', devCost: 20000, gw: [0.6, 1, 0.6, 1, 1, 0.6, 0.6], aw: [0.6, 0.9, 1], techLevel: 1, desc: 'Ayudas para gafas de mutualidades e igualatorios: muchas graduadas y de lectura.' },
  { id: 'hiper', name: 'HiperVisión', company: 'Ópticas de hipermercado', pastOnly: true, startAmount: 0.4, unitsSold: 1.1, licencePrize: 40000, published: '-6/3/1', retire: '260/12/4', devCost: 30000, gw: [1, 0.9, 0.8, 0.9, 0.9, 0.6, 0.7], aw: [0.9, 1, 0.9], techLevel: 2, desc: 'Ópticas dentro de los hipermercados: graduado barato y sol junto al carro de la compra.' },
  /* ---- canales del futuro (2027-2040) ---- */
  { id: 'segundavida', name: 'Segunda vida certificada', company: 'Reóptica', startAmount: 0.6, marketKeyPoints: [{ date: '45/1/1', amount: 2.5 }], unitsSold: 1.5, licencePrize: 60000, published: '33/2/1', retire: '260/12/4', devCost: 40000, gw: [1, 0.9, 0.8, 0.8, 0.8, 1, 0.7], aw: [1, 0.9, 0.7], techLevel: 4, desc: 'Reventa de monturas restauradas y certificadas.' },
  { id: 'cruceros', name: 'Terminal de cruceros y Xacobeo', company: 'Porto da Coruña', startAmount: 0.3, marketKeyPoints: [{ date: '45/1/1', amount: 1.2 }], unitsSold: 0.75, licencePrize: 30000, published: '33/4/1', retire: '260/12/4', devCost: 30000, gw: [1, 0.6, 0.8, 0.7, 0.9, 1, 0.8], aw: [0.8, 1, 0.9], techLevel: 3, desc: 'Turistas de crucero y peregrinos: sol y caprichos de lujo.' },
  { id: 'ecosistema', name: 'Tienda del ecosistema de gafas', company: 'Plataformas Orbe', startAmount: 2, marketKeyPoints: [{ date: '45/1/1', amount: 3.5 }, { date: '58/1/1', amount: 5 }], unitsSold: 4.5, licencePrize: 2000000, published: '34/9/1', retire: '260/12/4', devCost: 150000, gw: [0.8, 0.9, 0.9, 0.6, 0.6, 0.9, 1], aw: [1, 1, 0.7], techLevel: 7, desc: 'La tienda de aplicaciones y monturas de los grandes ecosistemas de gafas inteligentes.' },
  { id: 'agentes', name: 'Compra por asistente de IA', company: 'Agentia', startAmount: 1.5, marketKeyPoints: [{ date: '48/1/1', amount: 3.5 }, { date: '56/1/1', amount: 5 }], unitsSold: 4, licencePrize: 800000, published: '36/6/1', retire: '260/12/4', devCost: 100000, gw: [0.9, 0.9, 0.9, 0.8, 0.9, 0.7, 1], aw: [0.9, 1, 0.8], techLevel: 7, desc: 'El asistente compara y compra por el cliente: premia las buenas reseñas.' },
  { id: 'residencias', name: 'Red sociosanitaria y residencias', company: 'Sénior Galicia', startAmount: 1, marketKeyPoints: [{ date: '55/1/1', amount: 3 }], unitsSold: 2.25, licencePrize: 150000, published: '36/9/1', retire: '260/12/4', devCost: 40000, gw: [0.6, 1, 0.6, 0.6, 1, 0.6, 0.8], aw: [0.6, 0.6, 1], techLevel: 4, desc: 'Residencias y centros de día: graduado y lectura para mayores.' },
  { id: 'cabinas', name: 'Cabinas autónomas de graduación', company: 'OjoBox', startAmount: 1.25, marketKeyPoints: [{ date: '50/1/1', amount: 3 }], unitsSold: 2.5, licencePrize: 600000, published: '37/4/1', retire: '74/12/4', devCost: 80000, gw: [0.8, 1, 0.6, 0.6, 1, 0.6, 0.8], aw: [1, 1, 0.7], techLevel: 6, desc: 'Cabinas en estaciones y centros comerciales que gradúan y venden en diez minutos.' },
  { id: 'europa', name: 'Exportación a Europa y Latinoamérica', company: 'Marca gallega', startAmount: 1.5, marketKeyPoints: [{ date: '50/1/1', amount: 3.5 }, { date: '60/1/1', amount: 4.5 }], unitsSold: 3, licencePrize: 900000, published: '38/1/1', retire: '260/12/4', devCost: 90000, gw: [1, 0.9, 0.9, 0.8, 0.8, 1, 0.9], aw: [0.9, 1, 0.9], techLevel: 6, desc: 'La diáspora gallega y el mercado único: la marca sale fuera.' },
  { id: 'sergas', name: 'Prestación pública de salud visual', company: 'Consellería de Sanidade', startAmount: 2.5, marketKeyPoints: [{ date: '45/1/1', amount: 3.5 }], unitsSold: 3.5, licencePrize: 50000, published: '40/1/1', retire: '260/12/4', devCost: 30000, gw: [0.6, 1, 0.6, 1, 1, 0.6, 0.6], aw: [1, 0.8, 1], techLevel: 5, desc: 'Gafas financiadas para menores y mayores de 65: muchas unidades a precio tasado.' },
  { id: 'impresiondist', name: 'Red de fabricación bajo demanda', company: 'PrintPoint', startAmount: 2.5, marketKeyPoints: [{ date: '50/1/1', amount: 4 }, { date: '60/1/1', amount: 5 }], unitsSold: 4, licencePrize: 1500000, published: '43/3/1', retire: '260/12/4', devCost: 120000, gw: [0.9, 1, 0.9, 0.9, 0.8, 0.9, 0.9], aw: [1, 1, 0.8], techLevel: 7, desc: 'Se vende el archivo, no la montura: se imprime en el punto más cercano al cliente.' },
  { id: 'longevidad', name: 'Clínicas de longevidad', company: 'Vitae', startAmount: 2, marketKeyPoints: [{ date: '52/1/1', amount: 3.5 }, { date: '62/1/1', amount: 4.5 }], unitsSold: 3, licencePrize: 1000000, published: '46/1/1', retire: '260/12/4', devCost: 100000, gw: [0.6, 1, 0.7, 0.6, 0.8, 1, 0.9], aw: [0.6, 0.9, 1], techLevel: 7, desc: 'Chequeos de lujo con la salud visual dentro.' }
];

/* ---------- tendencias históricas (investigación de mercado). Año real; dan +8 % a sus estilos y +12 % si además el tipo es de los favorecidos ---------- */
DATA.TRENDS = [
  { year: 1969, name: 'Gafas de colegio', years: 2, styles: ['parche', 'culovaso', 'bifocal', 'nylor'], genres: ['infantil', 'graduado'], text: 'La escolarización masiva llena las aulas de pasta irrompible y parches para el ojo vago.' },
  { year: 1965, name: 'Era espacial y yeyé', years: 2, styles: ['visera', 'cateye', 'chunky', 'wayfarer'], genres: ['sol', 'premium'], text: 'París viste de astronauta y las chicas yeyés cambian el ojo de gato por viseras blancas.' },
  { year: 1967, name: 'Psicodelia y gafita redonda', years: 3, styles: ['abuelita', 'redondas', 'hexagonales', 'oversize'], genres: ['sol', 'graduado'], text: 'Los Beatles y los hippies resucitan las gafitas de aro metálico y los cristales de colores.' },
  { year: 1970, name: 'Maxigafas setenteras', years: 3, styles: ['oversize', 'mariposa', 'aviadegr', 'optyl'], genres: ['sol', 'premium'], text: 'Calibres enormes, resina de modista y lentes degradadas: cuanto más grande, mejor.' },
  { year: 1973, name: 'Glam y purpurina', years: 2, styles: ['glam', 'mariposa', 'oversize', 'varillabaja'], genres: ['sol', 'premium'], text: 'Los ídolos del glam suben al escenario con gafas de estrellas y pedrería.' },
  { year: 1975, name: 'Fotocromáticas y varilla baja', years: 4, styles: ['transicion', 'varillabaja', 'aviadegr', 'navegador'], genres: ['graduado', 'lectura'], text: 'La gafa graduada grande, metálica y con cristal que se oscurece se adueña de despachos y tertulias.' },
  { year: 1977, name: 'Patrulla de autopista', years: 3, styles: ['aviadegr', 'navegador', 'doblepuente', 'carreras', 'plegable'], genres: ['sol', 'deportiva'], text: 'Policías de televisión, pilotos y taxistas de cine: el aviador XXL vive su edad de oro.' },
  { year: 1980, name: 'Movida y nueva ola', years: 3, styles: ['movida', 'wayfarer', 'transparentes', 'bicolor'], genres: ['sol', 'graduado'], text: 'Pasta blanca, roja o a rayas: la noche de Madrid y de Vigo decide qué se lleva en la cara.' },
  { year: 1983, name: 'La trapezoidal vuelve al cine', years: 3, styles: ['wayfarer', 'movida', 'cazal', 'clubmaster'], genres: ['sol', 'premium'], text: 'Una película juvenil resucita la trapezoidal negra y el hip-hop pone de moda el logotipo dorado.' },
  { year: 1984, name: 'Deporte espectáculo', years: 3, styles: ['envolventes', 'esqui', 'glaciar', 'carreras'], genres: ['sol', 'deportiva'], text: 'Ciclistas, esquiadores y pilotos imponen gafas técnicas que acaban en la playa.' },
  { year: 1986, name: 'Yuppies y aviadores', years: 3, styles: ['aviador', 'yuppie', 'doblepuente', 'carey'], genres: ['sol', 'graduado', 'premium'], text: 'Tirantes, bolsa y carey: los ejecutivos jóvenes quieren parecer pilotos de caza.' },
  { year: 1988, name: 'Firma de diseñador', years: 3, styles: ['optyl', 'joya', 'combinada', 'nordico'], genres: ['premium', 'graduado'], text: 'Las pasarelas españolas despegan y la gafa con firma pasa a ser artículo de lujo.' },
  { year: 1990, name: 'Minimalismo metálico', years: 3, styles: ['minimal', 'redondas', 'titanio', 'alaire'], genres: ['graduado', 'lectura'], text: 'Tras una década de excesos, aros finos, titanio japonés y monturas al aire.' },
  { year: 1992, name: 'Barcelona 92', years: 2, styles: ['envolventes', 'neon', 'surf', 'flexible'], genres: ['deportiva', 'sol'], text: 'Los Juegos convierten la gafa deportiva envolvente en prenda de calle.' },
  { year: 1993, name: 'Grunge', years: 2, styles: ['noventas', 'redondas', 'abuelita', 'microoval'], genres: ['sol', 'graduado'], text: 'Óvalos blancos, redondas oscuras y cero glamour: Seattle manda.' },
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
  { year: 2025, name: 'Gafa conectada', years: 3, styles: ['wayfarer', 'rectangulares', 'soft', 'techwear', 'smart'], genres: ['sol', 'graduado'], text: 'Altavoces y asistente en la varilla: la montura se vuelve electrónica.' },
  { year: 2026, name: 'Asistente en la varilla', years: 3, styles: ['smart', 'wayfarer', 'rectangulares', 'audiogafa'], genres: ['sol', 'graduado'], text: 'Todo el mundo habla con sus gafas: música, llamadas y un asistente que te lee los carteles.' },
  { year: 2028, name: 'Segunda vida', years: 2, styles: ['vintagecert', 'carey', 'pantos', 'redondas'], genres: ['graduado', 'premium'], text: 'Las monturas de los noventa restauradas se pagan más que las nuevas.' },
  { year: 2029, name: 'Pantalla en la mirada', years: 3, styles: ['pantallahud', 'techwear', 'smart', 'soft'], genres: ['sol', 'inteligente'], text: 'Mensajes y rutas flotando delante del ojo: la gafa empieza a sustituir al móvil.' },
  { year: 2031, name: 'Hecho a tu cara', years: 3, styles: ['impresa3d', 'keyhole', 'arquitecto', 'modular2'], genres: ['graduado', 'premium'], text: 'Nadie quiere una talla estándar: escaneo facial e impresión el mismo día.' },
  { year: 2033, name: 'Verano africano en el Atlántico', years: 3, styles: ['climatica', 'escudo', 'envolventes', 'neon'], genres: ['sol', 'deportiva'], text: 'Los veranos gallegos ya no se parecen a los de antes: la gafa de sol pasa a ser de protección.' },
  { year: 2035, name: 'Realidad aumentada cotidiana', years: 3, styles: ['gafaar', 'rectangulares', 'minimal', 'electrocromica'], genres: ['inteligente', 'graduado'], text: 'Subtítulos, traducción y mapas en una montura que parece de pasta.' },
  { year: 2037, name: 'Biofabricación', years: 3, styles: ['micelio', 'eco', 'madera', 'transparentes'], genres: ['sol', 'graduado', 'infantil'], text: 'Monturas cultivadas, no fabricadas: hongos, algas y bioacetato.' },
  { year: 2040, name: 'Desconexión elegante', years: 3, styles: ['neoanalogica', 'nordico', 'lujosilencioso', 'crownpanto'], genres: ['graduado', 'premium', 'lectura'], text: 'El verdadero lujo es no estar conectado.' },
  { year: 2042, name: 'Ingravidez', years: 3, styles: ['grafeno', 'titanio', 'acero', 'minimal'], genres: ['deportiva', 'inteligente'], text: 'Gafas de un gramo con electrónica dentro: se olvida que se llevan puestas.' },
  { year: 2045, name: 'Adiós a las varillas', years: 3, styles: ['sinvarillas', 'medialuna', 'alaire', 'joya'], genres: ['lectura', 'premium'], text: 'Vuelve el quevedo, ahora con imanes: nada detrás de las orejas.' },
  { year: 2047, name: 'Nostalgia de los veinte', years: 3, styles: ['retroveinte', 'chunky', 'bicolor', 'smart'], genres: ['sol', 'graduado'], text: 'Las primeras gafas con cámara son ya vintage: pasta gruesa y bisagra con lente.' },
  { year: 2050, name: 'Lo invisible', years: 3, styles: ['lentillaint', 'alaire', 'minimal', 'neural'], genres: ['inteligente', 'premium'], text: 'La mejor montura es la que no se ve.' },
  { year: 2053, name: 'Autonomía solar', years: 3, styles: ['solar', 'surf', 'climatica', 'flexible'], genres: ['sol', 'deportiva'], text: 'Gafas que se cargan al sol y no se enchufan nunca.' },
  { year: 2056, name: 'Dosmilerismo 3.0', years: 2, styles: ['y2k', 'neon', 'escudo', 'electrocromica'], genres: ['sol', 'premium'], text: 'Vuelven los brillos y las pantallas, ahora con color que cambia.' },
  { year: 2059, name: 'Mente y mirada', years: 3, styles: ['neural', 'gafaar', 'arquitecto'], genres: ['inteligente'], text: 'Se maneja pensando: la gafa neural sale de los laboratorios.' },
  { year: 2062, name: 'Para toda la vida', years: 3, styles: ['autorreparable', 'modular2', 'flexkids', 'flexible'], genres: ['infantil', 'deportiva'], text: 'Monturas que se curan solas y se heredan de hermano en hermano.' },
  { year: 2066, name: 'Artesanía atlántica', years: 3, styles: ['madera', 'carey', 'micelio', 'neoanalogica'], genres: ['sol', 'premium'], text: 'Año santo y orgullo local: castaño, algas y oficio gallego.' },
  { year: 2069, name: 'Las gafas de los abuelos', years: 3, styles: ['redondas', 'retro70', 'pantos', 'sinvarillas'], genres: ['graduado', 'lectura'], text: 'Los nietos rescatan las monturas de sus abuelos de los años cuarenta.' },
  { year: 2072, name: 'Clásicos eternos', years: 4, styles: ['aviador', 'wayfarer', 'cateye', 'lujosilencioso'], genres: ['sol', 'graduado', 'premium'], text: 'Ochenta años de óptica después, lo que mejor se vende es lo de siempre.' },
  { year: 2008, name: 'Revival ochentero', years: 2, styles: ['retro80', 'steampunk', 'neon', 'cazal'], genres: ['sol', 'premium'], text: 'Apliques dorados, flúor y latón envejecido vuelven de los videoclips.' },
  { year: 2032, name: 'Gafa y salud', years: 3, styles: ['mioexterior', 'autofoco', 'protesica', 'audiogafa'], genres: ['infantil', 'graduado', 'lectura'], text: 'Miopía, presbicia y baja visión: la gafa vuelve a ser medicina.' }
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
  { id: 'metal4', name: 'Titanio V4', category: 'Materiales', v: 8, techLevel: 4, group: 'metal', req: { date: '-11/1', featureLevel: ['metal3', 2] } },
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
  { id: 'antirreflejante', name: 'Antirreflejante', category: 'Lentes', v: 4, req: { date: '-24/1', missionLevel: ['Lentes', 3] } },
  { id: 'polarizadas', name: 'Lentes polarizadas de alta eficiencia', category: 'Lentes', v: 4, req: { missionLevel: ['Lentes', 4] } },
  { id: 'fotocromaticas', name: 'Lentes fotocromáticas', category: 'Lentes', v: 6, req: { date: '-26/1', missionLevel: ['Lentes', 5] } },
  { id: 'altoindice', name: 'Alto índice', category: 'Lentes', v: 6, group: 'lente', req: { date: '-19/1', missionLevel: ['Lentes', 5] } },
  { id: 'filtroazul', name: 'Filtro de luz azul-violeta', category: 'Lentes', v: 6, req: { missionLevel: ['Lentes', 5], date: '20/1' } },
  { id: 'progresivos', name: 'Lentes progresivas', category: 'Lentes', v: 8, group: 'lente', req: { missionLevel: ['Lentes', 7] } },
  { id: 'freeform', name: 'Progresivas freeform a medida', category: 'Lentes', v: 10, group: 'lente', req: { date: '9/1', missionLevel: ['Lentes', 8] } },
  // Escaparate (world design)
  { id: 'expositor', name: 'Expositores básicos', category: 'Escaparate', v: 2, req: { missionLevel: ['Escaparate', 2] } },
  { id: 'led', name: 'Escaparate con pantallas LED', category: 'Escaparate', v: 2, req: { date: '19/1', missionLevel: ['Escaparate', 3] } },
  { id: 'espejo', name: 'Espejo inteligente', category: 'Escaparate', v: 2, enginePoints: 0, req: { date: '24/1', missionLevel: ['Escaparate', 4] } },
  { id: 'tematico', name: 'Escaparate temático', category: 'Escaparate', v: 4, req: { missionLevel: ['Escaparate', 5] } },
  { id: 'merchandising', name: 'Visual merchandising pro', category: 'Escaparate', v: 6, req: { missionLevel: ['Escaparate', 6] } },
  { id: 'showroom', name: 'Experiencia omnicanal en tienda', category: 'Escaparate', v: 8, req: { date: '25/1', missionLevel: ['Escaparate', 7] } },
  /* ---- tecnologías del futuro (2026-2050) ---- */
  { id: 'fut_audiogafa', name: 'Altavoces y micrófonos en la varilla', category: 'Ergonomia', v: 10, techLevel: 6, req: { date: '32/1', missionLevel: ['Ergonomia', 6] } },
  { id: 'fut_electronica', name: 'Electrónica integrada en varillas', category: 'Estructura', v: 10, techLevel: 6, req: { date: '34/1', missionLevel: ['Estructura', 6] } },
  { id: 'fut_impresion3d', name: 'Impresora 3D de monturas en tienda', category: 'Forma', v: 10, techLevel: 6, req: { date: '34/6', missionLevel: ['Forma', 6] } },
  { id: 'fut_miopia2', name: 'Control de miopía personalizado', category: 'Lentes', v: 10, techLevel: 6, req: { date: '34/1', missionLevel: ['Lentes', 7] } },
  { id: 'fut_asistente_ia', name: 'Asistente de IA en el escaparate', category: 'Escaparate', v: 10, techLevel: 6, req: { date: '34/1', missionLevel: ['Escaparate', 6] } },
  { id: 'fut_tradein', name: 'Recompra y pasaporte de segunda vida', category: 'Packaging', v: 10, techLevel: 6, req: { date: '33/1', missionLevel: ['Packaging', 6] } },
  { id: 'fut_pasaporte', name: 'Pasaporte digital de producto', category: 'Materiales', v: 10, techLevel: 6, req: { date: '35/1', missionLevel: ['Materiales', 6] } },
  { id: 'fut_lc_autofoco', name: 'Lentes de autoenfoque de cristal líquido', category: 'Lentes', v: 12, techLevel: 7, req: { date: '35/1', missionLevel: ['Lentes', 8] } },
  { id: 'fut_huella', name: 'Etiqueta de huella de carbono', category: 'Concepto', v: 10, techLevel: 6, req: { date: '36/1', missionLevel: ['Concepto', 6] } },
  { id: 'fut_lentes_impresas', name: 'Lentes graduadas impresas', category: 'Lentes', v: 12, techLevel: 7, req: { date: '37/1', missionLevel: ['Lentes', 8] } },
  { id: 'fut_avatares', name: 'Embajadores virtuales y gemelo digital', category: 'Concepto', v: 12, techLevel: 7, req: { date: '38/1', missionLevel: ['Concepto', 7] } },
  { id: 'fut_guiaondas', name: 'Guías de onda de realidad aumentada', category: 'Estructura', v: 12, techLevel: 7, req: { date: '39/1', missionLevel: ['Estructura', 7] } },
  { id: 'fut_micelio', name: 'Biorreactor de micelio', category: 'Materiales', v: 12, techLevel: 7, req: { date: '40/1', missionLevel: ['Materiales', 7] } },
  { id: 'fut_escaparate_ar', name: 'Escaparate de realidad aumentada', category: 'Escaparate', v: 12, techLevel: 7, req: { date: '40/1', missionLevel: ['Escaparate', 7] } },
  { id: 'fut_celula_robot', name: 'Célula robótica de acabado', category: 'Acabados', v: 12, techLevel: 7, req: { date: '42/1', missionLevel: ['Acabados', 7] } },
  { id: 'fut_grafeno', name: 'Compuestos de grafeno', category: 'Materiales', v: 14, techLevel: 7, req: { date: '42/6', missionLevel: ['Materiales', 8] } },
  { id: 'fut_autorreparable', name: 'Polímeros autorreparables', category: 'Ergonomia', v: 14, techLevel: 7, req: { date: '46/1', missionLevel: ['Ergonomia', 8] } },
  { id: 'fut_metalente', name: 'Metalentes planas', category: 'Lentes', v: 14, techLevel: 7, req: { date: '48/1', missionLevel: ['Lentes', 8] } }
];

/* ---------- investigaciones generales ---------- */
DATA.RESEARCH = [
  { id: 'NewTopic', name: 'Nuevo estilo', category: 'General', pointsCost: 10, duration: 10000, isTopic: true },
  { id: 'CustomEngine', name: 'Taller propio', category: 'General', pointsCost: 50, duration: 15000, desc: 'Permite diseñar tus propias líneas de producción con las tecnologías investigadas.' },
  { id: 'MediumSizeGames', name: 'Colecciones medianas', category: 'Gestión', pointsCost: 10, duration: 10000, cost: 150000, req: c => c.staff.length > 1, desc: 'Colecciones más amplias: más tiempo, más puntos y más ventas. Requiere al menos 2 personas.' },
  { id: 'LargeSizeGames', name: 'Colecciones grandes', category: 'Gestión', pointsCost: 40, duration: 15000, cost: 300000, req: c => c.fans > 25000 && c.staff.length > 4, desc: 'Grandes colecciones de temporada. Requiere 25.000 clientes fieles y 5 personas.' },
  { id: 'AAA', name: 'Colecciones insignia', category: 'Gestión', pointsCost: 80, duration: 20000, cost: 1000000, req: c => c.level >= 4 && c.hasResearch('LargeSizeGames') && c.staff.length > 5, desc: 'La colección de referencia de la temporada: más tiempo, más puntos y más ventas. Requiere la óptica insignia, colecciones grandes y 6 personas.' },
  { id: 'TargetAudience', name: 'Público objetivo', category: 'Diseño', pointsCost: 15, duration: 10000, cost: 30000, req: c => c.flags.targetAudienceStory, desc: 'Permite orientar cada colección a un público concreto.' },
  { id: 'LineaInteligente', name: 'Línea inteligente', category: 'Diseño', pointsCost: 60, duration: 15000, cost: 300000, req: c => c.isLaterOrEqualThan(35, 1) && c.playedAtLeast(3, 1), desc: 'Desbloquea el tipo Inteligente: gafas con audio, pantalla y asistente (desde 2029).' },
  { id: 'PremiumLine', name: 'Línea de lujo', category: 'Diseño', pointsCost: 20, duration: 10000, cost: 25000, req: c => c.playedAtLeast(3, 10), desc: 'Desbloquea el tipo Lujo.' },
  { id: 'Marketing', name: 'Marketing', category: 'Comercial', pointsCost: 40, duration: 10000, cost: 50000, req: c => c.flags.marketingStory, desc: 'Campañas de publicidad para generar expectación antes del lanzamiento.' },
  { id: 'Sequels', name: 'Segundas ediciones', category: 'Diseño', pointsCost: 20, duration: 13000, cost: 80000, req: c => c.playedAtLeast(8, 6), desc: 'Relanza colecciones de éxito como nuevas ediciones.' },
  { id: 'MultiGenre', name: 'Tipo combinado', category: 'Diseño', pointsCost: 80, duration: 10000, cost: 35000, req: c => c.playedAtLeast(12, 8), desc: 'Combina dos tipos en una colección (p. ej. Sol + Deportiva).' },
  { id: 'MultiPlatform', name: 'Multicanal', category: 'Comercial', pointsCost: 100, duration: 15000, cost: 500000, req: c => c.playedAtLeast(17, 2), desc: 'Lanza la misma colección en hasta 3 canales a la vez.' },
  /* ---- innovaciones 2026-2041 por departamento (efectos en js/modules/epocas.js) ---- */
  { id: 'fut_audicion_gafa', name: 'Adaptación de gafa auditiva', category: 'Clínica', pointsCost: 40, duration: 13600, cost: 50000, req: c => c.isLaterOrEqualThan(32, 1) && c.hasResearch('Gabinete'), desc: 'Gafas con audífono integrado: nuevos pacientes sénior e ingresos mensuales en el gabinete. (desde 2026)' },
  { id: 'fut_miopia_mixta', name: 'Protocolo combinado de miopía', category: 'Clínica', pointsCost: 60, duration: 14400, cost: 80000, req: c => c.isLaterOrEqualThan(32, 6) && c.hasResearch('Gabinete'), desc: 'Gafa de control de miopía + colirio con el oftalmólogo: +8 % de ventas en Infantil. (desde 2026)' },
  { id: 'fut_teleopt', name: 'Teleoptometría', category: 'Clínica', pointsCost: 90, duration: 15600, cost: 200000, req: c => c.isLaterOrEqualThan(33, 6) && c.hasResearch('Gabinete'), desc: 'Revisiones a distancia supervisadas (rural y residencias): ingresos mensuales. (desde 2027)' },
  { id: 'fut_ia_retina', name: 'Cribado de retina con IA certificado', category: 'Clínica', pointsCost: 140, duration: 17600, cost: 400000, req: c => c.isLaterOrEqualThan(34, 8) && c.hasResearch('Gabinete'), desc: 'Detección precoz certificada: ingresos mensuales y clientes fieles. (desde 2028)' },
  { id: 'fut_presbicia_farmaco', name: 'Consulta de presbicia farmacológica', category: 'Clínica', pointsCost: 100, duration: 16000, cost: 150000, req: c => c.isLaterOrEqualThan(36, 1) && c.hasResearch('Gabinete'), desc: 'Revisiones y lentillas para quien usa gotas: recupera la mitad de la caída de Lectura. (desde 2030)' },
  { id: 'fut_protesis', name: 'Rehabilitación de prótesis visuales', category: 'Clínica', pointsCost: 200, duration: 20000, cost: 900000, req: c => c.isLaterOrEqualThan(38, 1) && c.hasResearch('fut_ia_retina'), desc: 'Pacientes con implante retiniano: ingresos altos y +15 % de ventas del estilo protésico. (desde 2032)' },
  { id: 'fut_oculomica', name: 'Oculómica', category: 'Clínica', pointsCost: 260, duration: 22400, cost: 1500000, req: c => c.isLaterOrEqualThan(39, 1) && c.hasResearch('fut_ia_retina'), desc: 'La retina como chequeo de salud general, en convenio con la sanidad: ingresos mensuales altos. (desde 2033)' },
  { id: 'fut_biometria_casa', name: 'Monitorización domiciliaria', category: 'Clínica', pointsCost: 180, duration: 19200, cost: 800000, req: c => c.isLaterOrEqualThan(41, 1) && c.hasResearch('Gabinete'), desc: 'Autorrefractor y biómetro en casa del paciente por suscripción: ingresos mensuales. (desde 2035)' },
  { id: 'fut_terapia_genica', name: 'Seguimiento de terapias génicas', category: 'Clínica', pointsCost: 300, duration: 24000, cost: 2000000, req: c => c.isLaterOrEqualThan(44, 1) && c.hasResearch('fut_ia_retina'), desc: 'Red de derivación hospitalaria: clientes fieles y +3 % en Graduado. (desde 2038)' },
  { id: 'fut_suscripcion_wear', name: 'Gafa inteligente como servicio', category: 'Tienda', pointsCost: 120, duration: 16800, cost: 400000, req: c => c.isLaterOrEqualThan(35, 1) && c.hasResearch('LineaInteligente'), desc: 'Cuota mensual por gafa inteligente con renovación cada dos años: ingresos según clientes fieles. (desde 2029)' },
  { id: 'fut_seguro', name: 'Seguro de rotura y robo', category: 'Tienda', pointsCost: 50, duration: 14000, cost: 80000, req: c => c.isLaterOrEqualThan(35, 6) && true, desc: 'Seguro para gafas electrónicas: +2 % de ventas. (desde 2029)' },
  { id: 'fut_servicio_tecnico', name: 'Servicio técnico y actualizaciones', category: 'Tienda', pointsCost: 80, duration: 15200, cost: 200000, req: c => c.isLaterOrEqualThan(36, 1) && true, desc: 'La gente entra a «actualizar» sus gafas: ingresos mensuales y +5 % en Inteligente. (desde 2030)' },
  { id: 'fut_silver', name: 'Óptica de proximidad sénior', category: 'Tienda', pointsCost: 90, duration: 15600, cost: 250000, req: c => c.isLaterOrEqualThan(36, 6) && true, desc: 'Domicilio y residencias: +10 % de ventas en colecciones para Adultos y sénior. (desde 2030)' },
  { id: 'fut_autonoma', name: 'Tienda autónoma 24 h', category: 'Tienda', pointsCost: 220, duration: 20800, cost: 1200000, req: c => c.isLaterOrEqualThan(37, 1) && c.hasResearch('fut_teleopt'), desc: 'Abierta día y noche con cabina de graduación: +5 % de ventas e ingresos mensuales. (desde 2031)' },
  { id: 'fut_geo', name: 'Visibilidad en asistentes de IA', category: 'Marketing', pointsCost: 50, duration: 14000, cost: 80000, req: c => c.isLaterOrEqualThan(33, 1) && true, desc: 'Que los asistentes de IA recomienden tu óptica: +10 % de expectación en cada colección. (desde 2027)' },
  { id: 'fut_comunidad', name: 'Club de salud visual', category: 'Marketing', pointsCost: 70, duration: 14800, cost: 150000, req: c => c.isLaterOrEqualThan(34, 1) && true, desc: 'Comunidad y app de clientes: +3 % de ventas y protege los datos en los apagones. (desde 2028)' },
  { id: 'fut_datos_salud', name: 'Marketing con datos de salud', category: 'Marketing', pointsCost: 100, duration: 16000, cost: 200000, req: c => c.isLaterOrEqualThan(36, 6) && c.hasResearch('Gabinete'), desc: 'Campañas a pacientes con consentimiento reforzado: +5 % de expectación. (desde 2030)' },
  { id: 'fut_reacondicionado', name: 'Reparación y reacondicionado', category: 'Taller', pointsCost: 60, duration: 14400, cost: 120000, req: c => c.isLaterOrEqualThan(33, 3) && true, desc: 'Piezas recuperadas y reparaciones: −5 % de coste por montura e ingresos mensuales. (desde 2027)' },
  { id: 'fut_ensayos_ip', name: 'Ensayos de estanqueidad y batería', category: 'Taller', pointsCost: 60, duration: 14400, cost: 150000, req: c => c.isLaterOrEqualThan(35, 6) && c.hasResearch('LineaInteligente'), desc: 'Certificación de la electrónica: +5 % en Inteligente y adiós a las retiradas de lote. (desde 2029)' },
  { id: 'fut_qc_ia', name: 'Control de calidad con visión artificial', category: 'Laboratorio', pointsCost: 70, duration: 14800, cost: 150000, req: c => c.isLaterOrEqualThan(33, 1) && true, desc: 'Menos defectos que llegan al cliente: +2 % de nota en todas las colecciones. (desde 2027)' },
  { id: 'fut_insertos_rx', name: 'Insertos graduados para gafas inteligentes', category: 'Laboratorio', pointsCost: 40, duration: 13600, cost: 60000, req: c => c.isLaterOrEqualThan(32, 3) && true, desc: 'Graduación para gafas con IA: +5 % de ventas en Inteligente. (desde 2026)' },
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
  { classic: true, date: '1/8/1', title: 'Rumor', text: 'Dicen que las grandes ópticas van a dejar de fabricar sus propias monturas y buscarán proveedores pequeños.' },
  { classic: true, date: '2/1/1', title: 'Noticias del sector', text: 'Las ópticas de barrio empiezan a comprar colecciones a diseñadores independientes. Su red abrirá pedidos la semana que viene.' },
  { classic: true, date: '2/6/1', title: 'Público objetivo', text: 'Los estudios de mercado empiezan a segmentar las ventas de gafas por edades. Investigar "Público objetivo" permitiría orientar mejor cada colección.', flag: 'targetAudienceStory' },
  { classic: true, date: '3/4/1', title: 'Publicidad', text: 'Las revistas de moda lanzan secciones de óptica. Investigar "Marketing" permitiría anunciar las colecciones antes de su lanzamiento.', flag: 'marketingStory' },
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
  { date: '30/7/1', title: 'Récord del sector', text: 'Las ópticas españolas superan los 2.100 millones de euros de facturación. Hay menos tiendas que nunca, pero más grandes y más clínicas.' },
  /* ---- épocas: 1965-1994 y 2026-2076 ---- */
  { date: '-29/7/2', title: 'Los Beatles en España', text: 'Los de Liverpool tocan en Madrid y Barcelona. Los jóvenes quieren flequillo… y gafas de sol.' },
  { date: '-29/10/2', title: 'Moda espacial', text: 'Un modista de París presenta gafas-visera blancas de astronauta: nace la «Visera era espacial».' },
  { date: '-28/9/2', title: 'Un beatle se pone gafas', text: 'John Lennon rueda con unas gafitas redondas de aro metálico. Tus clientes jóvenes ya preguntan por ellas.' },
  { date: '-26/1/2', title: 'Cristales que se oscurecen', text: 'Llegan los primeros cristales de vidrio fotocromático: transparentes dentro, oscuros al sol.' },
  { date: '-26/4/2', title: 'Massiel gana Eurovisión', text: '«La, la, la» conquista Londres: todo el país pegado al televisor.' },
  { date: '-26/9/2', title: 'Gafas de ladrón de guante blanco', text: 'Un galán de Hollywood saca unas gafas plegables de su americana en una película de atracos.' },
  { date: '-25/7/2', title: 'El hombre en la Luna', text: 'El Apolo 11 aluniza: los aviadores y las viseras espaciales viven su momento.' },
  { date: '-25/10/2', title: 'La alta costura firma gafas', text: 'Una casa de París licencia su nombre a un fabricante alemán de resina termoestable: llegan las gafas de modista.' },
  { date: '-23/3/2', title: 'Lentillas blandas', text: 'En Estados Unidos aprueban la primera lentilla blanda de hidrogel. Aquí todavía se adaptan lentillas «duras».' },
  { date: '-22/1/2', title: 'Fusión de laboratorios', text: 'Los dos grandes laboratorios franceses de lentes se fusionan y lanzan un progresivo de segunda generación.' },
  { date: '-22/10/2', title: 'La óptica llega a la universidad', text: 'Se crea la Escuela Universitaria de Óptica y el título de Diplomado en Óptica.' },
  { date: '-21/10/2', title: 'Crisis del petróleo', text: 'El crudo se cuadruplica. La gasolina y la gafa nueva, a esperar.' },
  { date: '-19/5/2', title: 'Abre una tienda de ropa en Juan Flórez', text: 'Un comerciante coruñés abre una tienda de ropa de moda a precio asequible. A ver cuánto dura.' },
  { date: '-19/11/2', title: 'Muere Franco', text: 'Se abre un periodo de incertidumbre y cambio. La calle se llena de gafas de metal grandes.' },
  { date: '-18/5/2', title: 'Petrolero en llamas', text: 'Un petrolero embarranca y arde a la entrada del puerto de A Coruña. Humo negro sobre la ciudad durante días.' },
  { date: '-17/7/2', title: 'Ayudas para gafas', text: 'La mutualidad de funcionarios empieza a pagar ayudas para gafas: llega una clientela nueva.' },
  { date: '-17/10/2', title: 'Pactos de la Moncloa', text: 'La inflación roza el 25 %: Gobierno y partidos pactan para frenarla. Ojo con los precios.' },
  { date: '-16/12/2', title: 'Constitución', text: 'España vota la Constitución. Fiebre de televisión en color en los escaparates.' },
  { date: '-15/9/2', title: 'Nuevos estatutos', text: 'El Colegio de Ópticos exige separar el gabinete de optometría y el taller de la zona de venta.' },
  { date: '-13/4/2', title: 'Estatuto de Galicia', text: 'Galicia estrena autonomía: la Xunta tendrá competencias en sanidad y comercio.' },
  { date: '-13/10/2', title: 'Verano azul', text: 'Una serie de pandillas en bicicleta arrasa en la tele: los niños piden gafas de sol de colores.' },
  { date: '-12/6/2', title: 'Mundial en Riazor', text: 'A Coruña acoge partidos del Mundial: los turistas compran sol en el paseo marítimo.' },
  { date: '-11/8/2', title: 'La trapezoidal vuelve al cine', text: 'Un actor joven baila con unas trapezoidales de pasta negra y las ventas del modelo se disparan.' },
  { date: '-10/7/2', title: 'Gafas para ciclistas', text: 'Una marca californiana de motocross lanza una pantalla envolvente para corredores. El Tour la adopta enseguida.' },
  { date: '-10/11/2', title: 'Reconversión naval', text: 'Protestas en Ferrol por el cierre de astilleros. La comarca recorta gastos.' },
  { date: '-9/2/2', title: 'Gafas en una hora', text: 'Una cadena madrileña monta laboratorio en tienda: gafas graduadas listas en sesenta minutos.' },
  { date: '-9/7/2', title: 'Televisión de Galicia', text: 'Arranca la televisión autonómica: publicidad local en televisión al alcance de un comercio coruñés.' },
  { date: '-8/1/2', title: 'España entra en la CEE', text: 'Desde hoy, Europa. Llega el IVA a las gafas.' },
  { date: '-8/5/2', title: 'Pilotos de caza en el cine', text: 'Una película de aviones de combate dispara las ventas de los aviadores.' },
  { date: '-8/11/2', title: 'El gigante llega a Cuatro Caminos', text: 'Unos grandes almacenes de siete plantas abren en Ramón y Cajal, con su propia sección de gafas de sol.' },
  { date: '-7/6/2', title: 'Lentillas de usar y tirar', text: 'En Estados Unidos venden lentillas que se cambian cada semana. En dos años estarán aquí.' },
  { date: '-6/12/2', title: 'Huelga general', text: 'El país se para un día. Persianas bajadas en el centro.' },
  { date: '-4/7/2', title: 'Ópticos que gradúan', text: 'El nuevo título de Diplomado en Óptica y Optometría pone la optometría en el centro de la profesión.' },
  { date: '-4/11/2', title: 'Escuela de Óptica en Santiago', text: 'Galicia tendrá su propia Escuela Universitaria de Óptica y Optometría.' },
  { date: '-3/1/2', title: 'Fotocromáticos de plástico', text: 'Llegan los fotocromáticos orgánicos: ligeros y sin el gris del vidrio.' },
  { date: '-2/7/2', title: 'Barcelona 92', text: 'Los Juegos ponen de moda las envolventes deportivas.' },
  { date: '-2/12/2', title: 'Otro petrolero en la costa', text: 'Un petrolero encalla y arde junto a la Torre de Hércules. Golpe al marisqueo y al comercio local.' },
  { date: '-1/1/2', title: 'Xacobeo 93', text: 'Año Santo con una campaña turística nunca vista: peregrinos en toda Galicia.' },
  { date: '0/5/2', title: 'El penalti', text: 'El Deportivo pierde la Liga en el último minuto. A Coruña llora; la caja también.' },
  { date: '32/10/2', title: 'Las tecnológicas se ponen gafas', text: 'Una gran marca coreana y un buscador lanzan gafas con IA hechas con dos firmas de moda.' },
  { date: '32/7/2', title: 'La retina vuelve a ver', text: 'Europa aprueba un implante que devuelve la lectura a pacientes con atrofia geográfica: necesita unas gafas especiales.' },
  { date: '33/1/2', title: 'Año Xacobeo 2027', text: 'Las calles de Galicia se llenan de peregrinos: buen año para el sol y la deportiva.' },
  { date: '33/6/2', title: 'Gafas que enfocan solas', text: 'Una empresa finlandesa estrena en Europa lentes de cristal líquido que enfocan según adónde mires.' },
  { date: '33/9/2', title: 'Rumor: la manzana se pone gafas', text: 'Se dice que el gigante californiano presentará pronto sus primeras gafas.' },
  { date: '34/8/2', title: 'La IA sanitaria, bajo lupa', text: 'Entra en vigor el régimen de alto riesgo del reglamento europeo de IA para productos sanitarios.' },
  { date: '35/4/2', title: 'Gotas para ver de cerca', text: 'Llega a las farmacias europeas el primer colirio para la presbicia. Las gafas de lectura lo notarán.' },
  { date: '35/1/2', title: 'Nace la gafa inteligente', text: 'Las gafas con audio, pantalla y asistente ya son una categoría propia. Investiga la «Línea inteligente».' },
  { date: '36/6/2', title: 'Mundial 2030', text: 'España, Portugal y Marruecos organizan el Mundial: deportiva y sol en alza.' },
  { date: '36/9/2', title: 'Uno de cada tres escolares, miope', text: 'Los estudios confirman la previsión: el control de miopía infantil se dispara.' },
  { date: '37/1/2', title: 'Pasaporte digital para cada montura', text: 'Europa exige que cada montura lleve su pasaporte digital de producto.' },
  { date: '37/3/2', title: 'Los millennials cumplen 45', text: 'La generación más numerosa descubre la presbicia: boom de progresivos.' },
  { date: '39/7/2', title: 'Ola de calor histórica', text: '39 °C en A Coruña: la gafa de sol pasa a ser protección.' },
  { date: '40/1/2', title: 'La Xunta paga gafas a los mayores', text: 'La prestación pública de salud visual se extiende a los mayores de 65 años.' },
  { date: '41/1/2', title: 'Galicia de canas', text: 'Uno de cada tres gallegos ya tiene más de 65 años.' },
  { date: '42/1/2', title: 'Vuelven a faltar ópticos', text: 'Las cadenas pujan por cada titulado: los sueldos de los ópticos suben.' },
  { date: '43/5/2', title: 'Primera lentilla con pantalla', text: 'Se aprueba la primera lentilla con pantalla integrada. La montura invisible está más cerca.' },
  { date: '44/9/2', title: 'Terapia génica para la retinosis', text: 'Una terapia génica frena una retinosis frecuente. El óptico vigila la baja visión.' },
  { date: '46/3/2', title: 'Cirugía refractiva a 499 €', text: 'Una cadena robotizada abre en todas las capitales: los jóvenes miopes se operan.' },
  { date: '50/6/2', title: 'Crisis de chips', text: 'Faltan chips y tierras raras: las gafas inteligentes se encarecen.' },
  { date: '51/1/2', title: 'Los miopes altos cumplen 40', text: 'Los niños miopes de 2010 llegan a la edad del glaucoma: más revisiones de retina.' },
  { date: '54/1/2', title: 'Cristalino nuevo a los 60', text: 'Las lentes intraoculares acomodativas se vuelven rutina en la cirugía de cataratas.' },
  { date: '56/1/2', title: 'Medio mundo miope', text: 'Se cumple la previsión de 2016: uno de cada dos humanos es miope.' },
  { date: '58/1/2', title: 'Derecho a reparar tus gafas', text: 'Ley europea: piezas y software disponibles durante diez años.' },
  { date: '61/1/2', title: 'Máximo de mayores en España', text: 'El 30,5 % de los españoles tiene más de 65 años.' },
  { date: '64/1/2', title: 'La lentilla inteligente se masifica', text: 'Pantalla y sensores en la córnea: la montura pasa a ser un accesorio.' },
  { date: '66/1/2', title: 'Interfaz neural sin cirugía', text: 'Las gafas se manejan con el pensamiento.' },
  { date: '71/1/2', title: 'El regreso de lo analógico', text: 'Una generación harta de pantallas compra gafas «tontas».' },
  { date: '74/1/2', title: 'Las cabinas se apagan', text: 'Las gafas ya se gradúan solas: cierran las cabinas de graduación.' }
];
