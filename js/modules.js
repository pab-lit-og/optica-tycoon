/* Óptica Tycoon — registro de módulos (departamentos) y ganchos del motor.
   Cada módulo vive en js/modules/<id>.js y se registra con Modules.register({...}).
   Contrato (todos los métodos son opcionales):
     id            'taller' | 'lab' | 'gabinete' | 'tienda' | 'marketing' | ...
     name, icon    para el menú de departamentos
     order         orden en el menú
     init(co)      crea/repara co.modules[id] (estado persistente, debe ser JSON serializable)
     weekly(co, w, date)      cada semana (después de procesar ventas)
     monthly(co, date)        cada inicio de mes (después de pagar gastos fijos)
     monthlyCost(co) -> €     coste fijo mensual adicional (mantenimiento, cuotas, personal externo)
     salesFactor(co, game) -> multiplicador de unidades vendidas al lanzar una colección (1 = neutro)
     unitCost(co, game) -> € por montura vendida (materiales, componentes): reduce el margen
     scoreFactor(co, game) -> multiplicador de la puntuación bruta antes de las reseñas (como la tendencia)
     onCreateGame(co, game)   al empezar una colección
     onRelease(co, game)      al lanzar una colección (después de reseñas y cálculo de ventas)
     hypeFactor(co, game) -> multiplicador de la expectación generada por campañas
     candidateBonus(co) -> 0..0.4 mejora de candidatos en búsqueda de personal
     ui(co) -> { body:html, bind(modalElement), buttons:[...] }   panel del departamento
     sceneInfo(co) -> objeto libre que render.js usa para dibujar (tier, equipos, personal asignado…)
     report(co) -> [{label, value}]   líneas para el resumen/KPIs
*/
'use strict';

const Modules = {
  list: [],
  register(m) { if (!m || !m.id) throw new Error('módulo sin id'); if (this.list.some(x => x.id === m.id)) return; this.list.push(m); this.list.sort((a, b) => (a.order || 99) - (b.order || 99)); },
  get(id) { return this.list.find(m => m.id === id); },
  init(co) { co.modules = co.modules || {}; for (const m of this.list) { try { if (m.init) m.init(co); } catch (e) { console.error('init', m.id, e); } } },
  call(hook, ...args) { for (const m of this.list) { if (typeof m[hook] === 'function') { try { m[hook](...args); } catch (e) { console.error(hook, m.id, e); } } } },
  sum(hook, ...args) { let s = 0; for (const m of this.list) { if (typeof m[hook] === 'function') { try { const v = +m[hook](...args); if (!isNaN(v)) s += v; } catch (e) { console.error(hook, m.id, e); } } } return s; },
  product(hook, ...args) { let p = 1; for (const m of this.list) { if (typeof m[hook] === 'function') { try { const v = +m[hook](...args); if (!isNaN(v) && v > 0) p *= v; } catch (e) { console.error(hook, m.id, e); } } } return p; },
  max(hook, ...args) { let p = -Infinity; for (const m of this.list) { if (typeof m[hook] === 'function') { try { const v = +m[hook](...args); if (!isNaN(v)) p = Math.max(p, v); } catch (e) { console.error(hook, m.id, e); } } } return p === -Infinity ? 0 : p; },
  reports(co) { const out = []; for (const m of this.list) { if (m.report) { try { out.push({ id: m.id, name: m.name, lines: m.report(co) || [] }); } catch (e) { console.error('report', m.id, e); } } } return out; }
};

/* Roles de personal (compartidos por módulos y UI de contratación).
   Un empleado tiene s.role (uno de estos ids) y s.assignment (null = colecciones/taller de diseño,
   o el id de un departamento: 'gabinete', 'tienda', 'marketing', 'lab', 'taller'). */
/* salaryMult: proporciones de los convenios del sector (óptico director técnico > audioprotesista > diseño > técnicos > asesor) */
DATA.ROLES = [
  { id: 'disenador',      name: 'Diseñador/a de monturas', short: 'Diseño',    dept: null,        focus: 'design',   salaryMult: 1, titulo: 'Grado en diseño industrial o de moda', desc: 'Puntos de diseño en las colecciones.' },
  { id: 'tecnico',        name: 'Técnico/a de taller',     short: 'Taller',    dept: 'taller',    focus: 'tech',     salaryMult: 0.85, titulo: 'FP de mecanizado o escuela de artesanía', desc: 'Puntos técnicos; necesario para fabricar y montar.' },
  { id: 'optico',         name: 'Óptico/a-optometrista',   short: 'Óptico',    dept: 'gabinete',  focus: 'balanced', salaryMult: 1.15, titulo: 'Grado en Óptica y Optometría + colegiación', desc: 'Director técnico, gabinete y venta de lentes. Obligatorio para vender graduado.' },
  { id: 'dependiente',    name: 'Asesor/a de ventas',      short: 'Ventas',    dept: 'tienda',    focus: 'none',     salaryMult: 0.72, titulo: 'FP de comercio + formación interna en visagismo', desc: 'Atiende la tienda: conversión y venta cruzada.' },
  { id: 'marketing',      name: 'Marketing',               short: 'Marketing', dept: 'marketing', focus: 'none',     salaryMult: 0.9, titulo: 'Grado en marketing o publicidad', desc: 'Campañas, redes, CRM y notoriedad de marca.' },
  { id: 'audioprotesista', name: 'Audioprotesista',        short: 'Audio',     dept: 'gabinete',  focus: 'none',     salaryMult: 0.93, titulo: 'Técnico Superior en Audiología Protésica', desc: 'Audiología: audiometrías y audífonos.' },
  { id: 'labtech',        name: 'Técnico/a de laboratorio', short: 'Lab',      dept: 'lab',       focus: 'tech',     salaryMult: 0.8, titulo: 'FP de óptica o experiencia acreditada en taller', desc: 'Biselado, montaje y tallado de lentes.' }
];
DATA.roleById = id => DATA.ROLES.find(r => r.id === id) || DATA.ROLES[0];
