/* Óptica Tycoon — módulo «épocas»: demanda por año real (1965-2076).
   · Pasado: ciclos económicos de España (crisis del petróleo, reconversión, CEE y Expo/JJOO, crisis del 93).
   · Futuro: curvas por tipo (docs/research/RESULTADO_FUTURO_2026_2076.md §1.4): la lectura cae por las gotas y el
     autoenfoque (suelo ×0,6), el infantil sube con el control de miopía y luego baja, el sol sube con el calor, la
     inteligente crece en S. En 1995-2025 todo vale 1 (la partida clásica no cambia). */
'use strict';

(function () {
  const ID = 'epocas';
  /* multiplicador global de demanda por año real (pasado) */
  const CYCLE = [[1965, 1], [1973, 1.02], [1974, 0.93], [1979, 0.92], [1981, 0.95], [1985, 0.98], [1986, 1.05], [1991, 1.06], [1992, 1], [1993, 0.93], [1994, 0.97], [1995, 1]];
  /* curvas por tipo en el futuro (año real → multiplicador), interpolación lineal */
  const FUT = {
    sol:         [[2026, 1], [2030, 1.03], [2035, 1.06], [2040, 1.08], [2045, 1.1], [2050, 1.12], [2060, 1.15], [2076, 1.15]],
    graduado:    [[2026, 1], [2035, 1], [2040, 0.97], [2045, 0.95], [2050, 0.92], [2060, 0.88], [2070, 0.85], [2076, 0.85]],
    deportiva:   [[2026, 1], [2040, 1], [2045, 0.98], [2050, 0.96], [2060, 0.95], [2076, 0.95]],
    infantil:    [[2026, 1], [2030, 1.1], [2035, 1.15], [2040, 1.1], [2045, 1], [2050, 0.9], [2060, 0.85], [2070, 0.8], [2076, 0.8]],
    lectura:     [[2026, 1], [2030, 0.97], [2035, 0.88], [2040, 0.8], [2045, 0.72], [2050, 0.68], [2060, 0.62], [2070, 0.6], [2076, 0.6]],
    premium:     [[2026, 1], [2030, 1], [2035, 1.02], [2040, 1.04], [2045, 1.05], [2076, 1.05]],
    inteligente: [[2026, 0.7], [2030, 0.8], [2035, 1], [2040, 1.15], [2045, 1.25], [2050, 1.3], [2060, 1.3], [2076, 1.25]]
  };
  const interp = (pts, y) => { if (y <= pts[0][0]) return pts[0][1]; for (let i = 1; i < pts.length; i++) { if (y <= pts[i][0]) { const [y0, v0] = pts[i - 1], [y1, v1] = pts[i]; return v0 + (v1 - v0) * (y - y0) / (y1 - y0); } } return pts[pts.length - 1][1]; };
  const yearOf = co => co.realYear ? co.realYear() : 1995;
  function factor(co, g) {
    const y = yearOf(co); let f = 1;
    if (y < 1995) f *= interp(CYCLE, y);
    if (y > 2026 && g) { const a = FUT[g.genre] ? interp(FUT[g.genre], y) : 1; const b = g.secondGenre && FUT[g.secondGenre] ? interp(FUT[g.secondGenre], y) : a; f *= (2 * a + b) / 3; }
    return f;
  }
  const MOD = {
    id: ID, name: 'Épocas', icon: '🕰️', order: 98, hidden: true,
    init(co) { co.modules[ID] = co.modules[ID] || {}; },
    salesFactor(co, g) { return factor(co, g); },
    report(co) { const y = yearOf(co); if (y >= 1995 && y <= 2026) return []; const out = []; if (y < 1995) out.push({ label: 'Ciclo económico', value: '×' + interp(CYCLE, y).toFixed(2) }); else for (const id of Object.keys(FUT)) out.push({ label: 'Demanda ' + ((DATA.GENRES.find(x => x.id === id) || {}).name || id), value: '×' + interp(FUT[id], y).toFixed(2) }); return out; },
    api: { factor, interp, CYCLE, FUT }
  };
  Modules.register(MOD);
})();
