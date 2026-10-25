/* Óptica Tycoon — asesor: «qué hacer ahora» y lista de objetivos.
   Advisor.items(co)  -> consejos ordenados por prioridad: { p, icon, title, why, go: 'acción' }
   Advisor.goals(co)  -> objetivos con progreso:          { done, title, detail, pct }
   Advisor.run(go)    -> abre la ventana que resuelve el consejo (UI.action, UI.showDepartment…)
   Solo lee el estado de la partida; no cambia nada. */
'use strict';

const Advisor = {
  /* investigaciones por orden de utilidad para el jugador (las que no estén disponibles se saltan) */
  RESEARCH_ORDER: ['Marketing', 'TargetAudience', 'CustomEngine', 'MediumSizeGames', 'AutorizacionSanitaria', 'Gabinete', 'NewTopic', 'MultiPlatform', 'Sequels', 'LargeSizeGames', 'PremiumLine', 'MultiGenre', 'Lentillas', 'AAA', 'RnDLab'],
  WHY: {
    Marketing: 'desbloquea las campañas: más expectación y más ventas en cada lanzamiento',
    TargetAudience: 'eliges público (jóvenes, todos, adultos): bien elegido sube la nota',
    CustomEngine: 'te deja crear líneas de producción con las tecnologías que vayas investigando',
    MediumSizeGames: 'colecciones medianas: más puntos y más ventas que las pequeñas',
    AutorizacionSanitaria: 'sin ella, las gafas graduadas se venden a mitad de precio en tienda y mercadillos',
    Gabinete: 'abre el gabinete optométrico: pacientes e ingresos cada mes',
    NewTopic: 'cada estilo nuevo da más combinaciones buenas y evita repetir',
    MultiPlatform: 'vender en varios canales a la vez multiplica el público',
    Sequels: 'segundas ediciones de tus éxitos',
    LargeSizeGames: 'colecciones grandes: el siguiente salto de ventas',
    PremiumLine: 'tipo Lujo: márgenes altos',
    MultiGenre: 'combinar dos tipos en una colección',
    Lentillas: 'adaptación de lentes de contacto en el gabinete',
    AAA: 'colecciones insignia: las más rentables del juego',
    RnDLab: 'laboratorio I+D: marca propia, probador virtual y suscripción'
  },
  DEPT_NAMES: { gabinete: 'el gabinete', taller: 'el taller', lab: 'el laboratorio', tienda: 'la tienda', marketing: 'marketing' },

  /* alertas de los departamentos (las mismas cifras que enseñan sus paneles) */
  deptAlerts(co) {
    const out = []; const w = Math.floor(co.currentWeek);
    try { const T = Modules.get('tienda'); if (T && T.api && co.level >= 2) { const s = T.api.state(co); const c = T.api.compute(co, s, w); const att = c.attention || 0; const team = co.staff.filter(x => !x.assignment).length; const optM = C.SIZE.medium.optimalTeam;
        if (c.F && !c.F.graduado) out.push({ dept: 'tienda', p: 75, icon: '🏬', title: 'La tienda vende como un puesto', why: 'Sin zona de graduado solo vendes sol y lectura premontada. Móntala en Tienda → Local (10.000 €).', go: 'dept:tienda' });
        if (c.stockRatio < 0.5) out.push({ dept: 'tienda', p: 72, icon: '🏬', title: 'Expositores medio vacíos', why: `La conversión cae un ${Math.round((1 - (c.stockF || 1)) * 100)} %. Repón stock en Tienda → Local (se recomiendan ${U.money(c.L ? c.L.stock : 0)}).`, go: 'dept:tienda' });
        if (c.visits > 20 && att < 0.7) out.push({ dept: 'tienda', p: 62, icon: '🏬', title: `La tienda solo atiende al ${Math.round(att * 100)} %`, why: team < optM ? 'Muchos clientes se van sin comprar. Contrata un asesor de ventas para la tienda (no saques a nadie de diseño: ya te falta gente).' : 'Muchos clientes se van sin comprar. Pon a otra persona en la tienda (ficha → Destino: Tienda) o contrata un asesor de ventas.', go: 'staff' }); } } catch (e) { /* sin tienda */ }
    try { const Gb = Modules.get('gabinete'); const s = co.modules && co.modules.gabinete; if (Gb && Gb.api && s && (s.tier || 0) > 0) { const c = Gb.api.compute(co, s, w); if (c.lost >= 1) out.push({ dept: 'gabinete', p: 58, icon: '👁️', title: `Agenda del gabinete llena (${Math.round(c.lost)} se van sin cita)`, why: 'Hace falta más capacidad: otra persona óptica en el gabinete, instrumental más rápido o un box más.', go: 'dept:gabinete' }); } } catch (e) { /* sin gabinete */ }
    for (const id of ['taller', 'lab']) { const st = co.modules && co.modules[id]; if (st && (st.tier || 0) >= 2 && !co.staff.some(x => x.assignment === id)) out.push({ dept: id, p: 46, icon: id === 'taller' ? '🛠️' : '🧪', title: `${id === 'taller' ? 'El taller' : 'El laboratorio'} no tiene a nadie`, why: 'Está montado pero sin personal asignado rinde al mínimo. Asigna a alguien desde su ficha.', go: 'staff' }); }
    return out;
  },
  /* la investigación que el asesor recomienda ahora (la marca Investigación con ⭐) */
  bestResearch(co) { const fixed = this.fixed(co); const rank = it => { const i = this.RESEARCH_ORDER.indexOf(it.id); return i < 0 ? 50 + (it.v || 0) : i; };
    const avail = (co.availableResearch || []).filter(id => id !== 'NewTopic' && !co.researchCompleted.includes(id)).map(id => DB.item(id)).filter(Boolean).sort((a, b) => rank(a) - rank(b));
    const can = avail.filter(it => co.researchPoints >= Research.pointsCost(it) && co.cash - Research.researchCost(it) > fixed); return (can[0] || avail[0] || {}).id || null; },
  has(co, id) { return co.hasResearch ? co.hasResearch(id) : (co.researchCompleted || []).includes(id); },
  researching(co) { return co.staff.some(s => s.currentResearch); },
  fixed(co) { try { return General.monthlyCosts(co); } catch (e) { return 0; } },

  items(co) {
    if (!co) return [];
    const out = []; const add = (p, icon, title, why, go) => out.push({ p, icon, title, why, go });
    const fixed = this.fixed(co); const idle = G.isIdle(); const g = co.currentGame;
    // 1. dinero
    if (co.cash < 0) add(100, '🚨', 'Estás en descubierto', `Lanza colecciones y evita gastos grandes hasta volver a positivo. Gastos fijos: ${U.money(fixed)}/mes.`, idle ? 'newgame' : null);
    else if (fixed > 0 && co.cash < fixed * 2 && co.gameLog.length > 0) add(80, '💸', 'Caja justa', `Tienes menos de dos meses de gastos fijos (${U.money(fixed)}/mes). Prioriza vender antes que invertir.`, null);
    // 2. personal agotado
    const tired = co.staff.filter(s => s.flags && s.flags.needsVacation && s.state !== 'vacation');
    if (tired.length) add(90, '😴', `${tired.length === 1 ? tired[0].name.split(' ')[0] + ' necesita' : tired.length + ' personas necesitan'} vacaciones`, 'Cansados rinden mucho menos y meten más defectos. Mándalos de vacaciones entre colecciones.', 'staff');
    // 3. sin proyecto
    if (idle && !co.currentGame && !G.currentEngineDev && co.staff.some(s => s.isAvailable && s.isAvailable())) {
      const team = co.staff.filter(s => !s.assignment).length; const sizes = co.availableSizes(); let best = sizes.filter(sz => C.SIZE[sz].optimalTeam <= Math.max(1, team)).pop() || 'small'; if (co.level >= 2 && best === 'small' && sizes.includes('medium')) best = 'medium';
      add(85, '👓', 'Empieza una colección', `No hay nada en marcha. Con ${team} persona${team === 1 ? '' : 's'} en diseño, el tamaño que mejor rinde es ${C.SIZE[best].label.toLowerCase()}.`, 'newgame');
    }
    // 3b. tamaño: desde el local comercial las pequeñas restan nota; si falta gente en diseño, traerla de un departamento
    if (co.level >= 2 && co.hasResearch('MediumSizeGames')) { const team = co.staff.filter(s => !s.assignment).length; const inDept = co.staff.length - team; const opt = C.SIZE.medium.optimalTeam;
      if (team < opt && inDept > 0) add(66, '🧑‍🎨', `Faltan diseñadores para colecciones medianas (${team}/${opt})`, `En ${C.LEVELS[co.level].name.toLowerCase()} las colecciones pequeñas restan un 10 % de nota. Pasa a diseño a alguien de un departamento o contrata (ficha del empleado → Destino).`, 'staff'); }
    // 3c. la última colección: causa principal de la nota y qué hacer
    { const lg = co.gameLog[co.gameLog.length - 1]; const bd = lg && lg.flags && lg.flags.breakdown;
      if (bd && co.currentWeek - (lg.releaseWeek || 0) < 24 && lg.score < 7.5) { const worst = (bd.rows || []).filter(r => r.f < 0.97).sort((a, b) => a.f - b.f)[0];
        const tip = worst ? ({ time: 'da más tiempo a los campos clave del tipo en cada fase (los informes los marcan con ☆)', balance: 'equilibra diseño y técnica (mira si faltó diseño o técnica)', channel: 'elige un canal que encaje mejor con el tipo (estrellas en el asistente)', audience: 'cambia el público o el estilo', chanaud: 'ese canal apenas llega a ese público', bugs: 'deja que el control de calidad llegue a 0 defectos', other: 'no repitas la misma combinación seguida', combo: 'ese estilo no pega con ese tipo', trend: 'la moda iba en contra: prueba otro estilo', mix: 'no mezcles canales muy distintos', tech: lg.flags.techWhy === 'small' ? 'pasa a colecciones medianas' : lg.flags.techWhy === 'medium' ? 'consigue más clientes fieles (20.000) o crea una línea de producción nueva' : 'crea una línea de producción con tus tecnologías más nuevas' }[worst.k] || '') : (bd.base < 6 ? 'genera más puntos: más gente en diseño, tamaño acorde y personal descansado' : '');
        if (tip) add(64, '📉', `${lg.title}: ${lg.score.toFixed(1)}${worst ? ' · lo que más restó: ' + worst.label.toLowerCase() : ''}`, 'Para la próxima: ' + tip + '.', null); } }
    // 4. mudanza
    const nl = G.nextLevelInfo && G.nextLevelInfo();
    if (nl && nl.ok) add(88, '🏢', `¡Ya puedes pasar a ${nl.name}!`, 'Cumples todos los requisitos. Más espacio, más personal y nuevos departamentos.', 'local');
    // 5. investigación
    if (co.researchEnabled && !this.researching(co)) {
      const avail = (co.availableResearch || []).filter(id => !co.researchCompleted.includes(id)).map(id => DB.item(id)).filter(Boolean);
      const rank = it => { const i = this.RESEARCH_ORDER.indexOf(it.id); return i < 0 ? 50 + (it.v || 0) : i; };
      avail.sort((a, b) => rank(a) - rank(b));
      const can = avail.filter(it => co.researchPoints >= Research.pointsCost(it) && co.cash - Research.researchCost(it) > fixed);
      const bid = this.bestResearch(co); const top = can.find(it => it.id === bid) || can[0] || null;
      if (top) add(70 - Math.min(20, rank(top)), '🔬', top.id === 'NewTopic' ? (() => { const t = co.topicOrder.find(x => !co.topics.includes(x) && (DB.topic(x).year || 0) <= co.realYear()); return t ? `Investiga el estilo «${DB.topic(t).name}»` : 'Investiga un estilo nuevo'; })() : `Investiga «${top.name}»`, (this.WHY[top.id] || (top.desc ? top.desc.replace(/\s*\(desde \d+\)$/, '').replace(/\.$/, '').toLowerCase() : top.category ? 'mejora de ' + top.category.toLowerCase() + ' para tus líneas de producción' : 'te abre nuevas opciones')) + `. Cuesta ${Research.pointsCost(top)} puntos${Research.researchCost(top) ? ' y ' + U.money(Research.researchCost(top)) : ''}.`, 'research');
      else if (avail.length) { const n = avail[0]; add(30, '🔬', `Siguiente investigación: «${n.name}»`, `Te faltan ${Math.max(0, Research.pointsCost(n) - Math.floor(co.researchPoints))} puntos de investigación (salen al desarrollar colecciones).`, 'research'); }
    }
    // 6. línea de producción anticuada
    if (co.canDevelopEngine && co.canDevelopEngine() && co.engines.length) {
      const last = co.engines[co.engines.length - 1]; const parts = DATA.PARTS.filter(p => co.researchCompleted.includes(p.id) && !last.parts.includes(p.id));
      if (parts.length >= 2 && !G.currentEngineDev) add(60, '⚙️', 'Crea una línea de producción nueva', `Tienes ${parts.length} tecnologías investigadas que tu línea más nueva no usa (${parts.slice(0, 3).map(p => p.name).join(', ')}${parts.length > 3 ? '…' : ''}). Más tecnología = más puntos y mejor nota.`, 'engines');
    }
    // 7. personal
    if (co.level >= 2 && co.staff.length < co.maxStaff && co.cash > fixed * 6) add(55, '👥', `Contrata (${co.staff.length}/${co.maxStaff})`, 'Más gente = más puntos por colección y colecciones más grandes. Busca a alguien que complemente tu equipo (diseño o técnica).', 'staff');
    // 8. departamentos
    if (co.level >= 3) for (const id of ['gabinete', 'taller', 'lab']) {
      const st = co.modules && co.modules[id]; const tier = st ? (st.tier || 0) : 0;
      if (id === 'gabinete' && !this.has(co, 'Gabinete')) continue;
      if (tier === 0 && co.cash > fixed * 4) add(50, '🏗️', `Monta ${this.DEPT_NAMES[id]}`, 'Departamento sin montar: con un primer nivel barato empieza a dar ingresos o a abaratar la producción.', 'dept:' + id);
      else if (tier > 0 && !co.staff.some(s => s.assignment === id)) {
        const team = co.staff.filter(s => !s.assignment).length; const opt = Math.max(...co.availableSizes().map(sz => C.SIZE[sz].optimalTeam));
        if (team > opt) add(45, '🧑‍🔧', `Nadie trabaja en ${this.DEPT_NAMES[id]}`, `Sin personal asignado rinde al mínimo. Te sobra gente en diseño (${team} para un equipo óptimo de ${opt}): asigna a alguien desde su ficha.`, 'staff');
        else if (co.staff.length < co.maxStaff) add(35, '🧑‍🔧', `${this.DEPT_NAMES[id][0].toUpperCase() + this.DEPT_NAMES[id].slice(1)} no tiene personal`, 'Contrata a alguien para ese departamento (rol técnico/a o de laboratorio) y asígnalo.', 'staff');
      }
    }
    // 8a. dinero de sobra en la insignia: red de sucursales
    { const nb = co.branches || 0; const net = nb < G.BRANCH_MAX ? G.branchIncome(co, nb) - G.branchUpkeep : 0; if (co.level >= 4 && net > 0 && co.cash > G.branchCost(nb) * 2.5 && G.branchCost(nb) / net < 120) add(40, '🏪', 'Abre una sucursal', `Te sobra caja: una sucursal cuesta ${U.money(G.branchCost(nb))} y deja ${U.money(net)}/mes netos y más clientes fieles.`, 'local'); }
    // 8b. alertas de departamentos
    for (const a of this.deptAlerts(co).filter((a, i, arr) => arr.findIndex(b => b.dept === a.dept) === i)) { const nm = this.DEPT_NAMES[a.dept] || ''; if (!out.some(o => o.title === a.title || (nm && o.title.toLowerCase().includes(nm.replace(/^(el|la) /, ''))))) add(a.p, a.icon, a.title, a.why, a.go); }
    // 9. objetivos cercanos
    if (nl && !nl.ok) add(25, '🎯', `Para pasar a ${nl.name}`, 'Te falta: ' + nl.reasons.join(', ') + '.', 'local');
    if (g && G.currentFeature && G.currentFeature.id === 'BugFixing' && G.currentFeature.progress >= 1 && (g.bugs || 0) > 0) add(40, '🧪', 'Colección lista para lanzar', `Quedan ${Math.round(g.bugs)} defectos: el equipo sigue corrigiendo. Espera a 0 para mejor nota o pulsa «Lanzar ya».`, null);
    return out.sort((a, b) => b.p - a.p);
  },

  goals(co) {
    if (!co) return [];
    const L = []; const add = (done, title, detail, pct) => L.push({ done: !!done, title, detail, pct: pct === undefined ? (done ? 1 : 0) : U.clamp(pct, 0, 1) });
    add(co.gameLog.length >= 1, 'Lanza tu primera colección', 'Desbloquea la investigación.', co.gameLog.length >= 1 ? 1 : 0);
    const nl = G.nextLevelInfo && G.nextLevelInfo();
    if (nl) add(false, `Pasa a ${nl.name}`, nl.ok ? '¡Listo! Menú ☰ → Local y mudanza.' : 'Falta: ' + nl.reasons.join(', '), Math.min(1, co.cash / Math.max(1, nl.cash)));
    else add(true, 'Óptica insignia', 'Has llegado al local más grande.');
    add(this.has(co, 'MediumSizeGames'), 'Investiga colecciones medianas', 'Más puntos y ventas por colección. Desde el local comercial.');
    add(co.fans >= 20000, '20.000 clientes fieles', 'Las medianas dejan de tener el −10 % de «nivel técnico».', co.fans / 20000);
    add(this.has(co, 'LargeSizeGames'), 'Colecciones grandes', 'Requiere 25.000 clientes fieles y 5 personas.', Math.min(co.fans / 25000, co.staff.length / 5));
    if (co.level >= 2) add(co.staff.length >= co.maxStaff, `Plantilla completa (${co.staff.length}/${co.maxStaff})`, 'Cada local admite más gente que el anterior.', co.staff.length / Math.max(1, co.maxStaff));
    const best = co.gameLog.reduce((m, x) => Math.max(m, x.score || 0), 0);
    add(best >= 9, 'Saca un 9 o más', best ? `Tu mejor nota: ${best.toFixed(1)}.` : 'Aún sin colecciones.', best / 9);
    const deps = ['gabinete', 'taller', 'lab'].filter(id => co.modules && co.modules[id] && (co.modules[id].tier || 0) > 0).length;
    add(deps >= 3, `Departamentos montados (${deps}/3)`, 'Gabinete, taller y laboratorio (desde la reforma del local).', deps / 3);
    const ach = (co.achievements || []).length; const tot = (typeof ACHIEVEMENTS !== 'undefined' ? ACHIEVEMENTS.length : 22);
    add(ach >= tot, `Logros (${ach}/${tot})`, 'Menú ☰ → Puntuación y logros.', ach / tot);
    return L;
  },

  run(go) {
    if (!go || typeof UI === 'undefined') return;
    if (go === 'local') return UI.showLocal();
    if (go === 'engines') return UI.showTaller();
    if (go.startsWith('dept:')) return UI.showDepartment(go.slice(5));
    return UI.action(go);
  }
};
