// ============================================================================
// Reconstruction des blocs d'une séance (runBlocks) à partir des laps Strava.
//
// Idée : les laps = les segments réellement courus (chaque lap a distance, temps,
// vitesse, pace_zone). On classe chaque lap en effort / facile, on isole
// l'échauffement (laps faciles au début), le retour au calme (laps faciles à la
// fin), et on reconstruit le corps de séance (efforts + récup) — en groupe
// « Répéter » si les efforts sont homogènes, sinon en liste (pyramide).
//
// Le résultat est une SUGGESTION : il pré-remplit les blocs réalisés, que
// l'athlète/coach peut ensuite éditer dans l'app.
// ============================================================================

const round2 = (n) => Math.round(n * 100) / 100;
const avg = (arr) => (arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : 0);

/** Vitesse m/s → allure "m:ss" /km. */
function speedToPaceStr(speedMs) {
  if (!speedMs || speedMs <= 0) return null;
  let totalSec = Math.round(1000 / speedMs); // arrondi avant découpe → évite "5:60"
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Allure en secondes/km (pour comparer des laps). */
function paceSecPerKm(speedMs) {
  return speedMs > 0 ? 1000 / speedMs : Infinity;
}

/** Durée s → texte court "1min30" / "45s" pour la récup. */
function secondsToRecoveryText(sec) {
  if (!sec || sec <= 0) return null;
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  if (m === 0) return `${s}s`;
  return s === 0 ? `${m}min` : `${m}min${String(s).padStart(2, '0')}`;
}

/** Détermine le seuil effort/facile via le plus grand écart entre allures triées. */
function effortThreshold(paces) {
  const sorted = [...paces].sort((a, b) => a - b);
  let bestGap = 0;
  let cut = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    const gap = sorted[i] - sorted[i - 1];
    if (gap > bestGap) {
      bestGap = gap;
      cut = (sorted[i] + sorted[i - 1]) / 2;
    }
  }
  return { cut, spread: sorted[sorted.length - 1] - sorted[0] };
}

/** Construit un step "effort" depuis un lap (mode distance). */
function effortStep(lap, order) {
  return {
    role: 'main',
    mode: 'distance',
    distance: round2((lap.distance || 0) / 1000),
    duration: null,
    pace: speedToPaceStr(lap.average_speed),
    repetitions: 1,
    description: 'Effort',
    recoveryMode: null,
    recoveryDistance: null,
    recoveryDuration: null,
    recoveryPace: null,
    recoveryDescription: '',
    order
  };
}

/** Attache un lap de récup (mode durée) à un step effort. */
function attachRecovery(step, lap) {
  step.recoveryMode = 'duration';
  step.recoveryDuration = secondsToRecoveryText(lap.moving_time || lap.elapsed_time);
  step.recoveryPace = speedToPaceStr(lap.average_speed);
  step.recoveryDescription = 'Récup';
}

/** Bloc échauffement / retour au calme à partir d'un ou plusieurs laps faciles fusionnés. */
function easyBlock(role, laps, order) {
  const distM = laps.reduce((a, l) => a + (l.distance || 0), 0);
  const timeS = laps.reduce((a, l) => a + (l.moving_time || l.elapsed_time || 0), 0);
  const speed = distM > 0 && timeS > 0 ? distM / timeS : avg(laps.map(l => l.average_speed));
  return {
    role,
    mode: 'duration',
    duration: Math.max(1, Math.round(timeS / 60)),
    distance: null,
    pace: speedToPaceStr(speed),
    repetitions: 1,
    description: role === 'warmup' ? 'Échauffement' : 'Retour au calme',
    recoveryMode: null,
    order
  };
}

/** Deux distances sont "homogènes" si à ±12% l'une de l'autre. */
function homogeneous(values) {
  if (values.length <= 1) return true;
  const min = Math.min(...values);
  const max = Math.max(...values);
  return min > 0 && (max - min) / min <= 0.12;
}

const isGroup = (b) => Array.isArray(b.children) && b.children.length > 0;

/** Classe chaque lap en effort / facile et détecte une course continue. */
function classifyLaps(laps) {
  if (laps.length <= 1) return { isEffort: laps.map(() => false), continuous: true };
  const paces = laps.map(l => paceSecPerKm(l.average_speed));
  const { cut, spread } = effortThreshold(paces);
  return {
    isEffort: laps.map(l => paceSecPerKm(l.average_speed) <= cut),
    continuous: spread < 25
  };
}

/**
 * Reconstruit runBlocks[] depuis les laps Strava.
 * @param {Array} laps - activity.laps de Strava
 * @param {Array} [plannedBlocks] - blocs prévus par le coach : si fournis, on CALE
 *        les laps sur ce squelette (même structure, valeurs réelles) pour une
 *        comparaison prévu↔réalisé propre. Sinon, détection autonome.
 * @returns {Array} runBlocks (compatibles modèle RunBlock, avec groupes via children)
 */
function reconstructBlocksFromLaps(laps, plannedBlocks) {
  if (!Array.isArray(laps) || laps.length === 0) return [];

  // Si on a un plan coach → on s'aligne dessus (10×500 prévu rempli depuis 10×550 réels)
  if (Array.isArray(plannedBlocks) && plannedBlocks.length) {
    const aligned = reconstructAgainstPlan(laps, plannedBlocks);
    if (aligned && aligned.length) return aligned;
  }

  // Course continue (1 seul lap)
  if (laps.length === 1) {
    return [continuousBlock(laps)];
  }

  const { isEffort, continuous } = classifyLaps(laps);

  // Pas de vraie variation d'allure → footing continu
  if (continuous) {
    return [continuousBlock(laps)];
  }

  // Indices du premier et dernier effort
  const firstEffort = isEffort.indexOf(true);
  let lastEffort = -1;
  for (let i = isEffort.length - 1; i >= 0; i--) {
    if (isEffort[i]) { lastEffort = i; break; }
  }
  if (firstEffort === -1) {
    return [continuousBlock(laps)];
  }

  const blocks = [];
  let order = 0;

  // Échauffement = laps faciles avant le 1er effort
  if (firstEffort > 0) {
    blocks.push(easyBlock('warmup', laps.slice(0, firstEffort), order++));
  }

  // Corps : du 1er au dernier effort → on apparie effort + (lap facile suivant = récup)
  const intervalSteps = [];
  let i = firstEffort;
  while (i <= lastEffort) {
    if (isEffort[i]) {
      const step = effortStep(laps[i], 0);
      // récup = lap facile juste après (s'il y en a un et qu'il est dans le corps)
      if (i + 1 <= lastEffort && !isEffort[i + 1]) {
        attachRecovery(step, laps[i + 1]);
        i += 2;
      } else {
        i += 1;
      }
      intervalSteps.push(step);
    } else {
      // lap facile isolé au milieu (sans effort avant) → on l'ignore comme bruit léger
      i += 1;
    }
  }

  if (intervalSteps.length === 1) {
    // un seul effort → step simple
    intervalSteps[0].order = order++;
    blocks.push(intervalSteps[0]);
  } else if (intervalSteps.length > 1) {
    const distances = intervalSteps.map(s => s.distance || 0);
    if (homogeneous(distances)) {
      // Efforts homogènes → groupe « Répéter ×N » (1 enfant répété)
      const child = { ...intervalSteps[0], order: 0 };
      blocks.push({
        role: 'main',
        mode: 'distance',
        distance: null,
        duration: null,
        pace: null,
        repetitions: intervalSteps.length,
        description: 'Fractionné',
        recoveryMode: null,
        children: [child],
        order: order++
      });
    } else {
      // Efforts variables (pyramide…) → groupe avec tous les enfants, ×1
      const children = intervalSteps.map((s, idx) => ({ ...s, order: idx }));
      blocks.push({
        role: 'main',
        mode: 'distance',
        distance: null,
        duration: null,
        pace: null,
        repetitions: 1,
        description: 'Série',
        recoveryMode: null,
        children,
        order: order++
      });
    }
  }

  // Retour au calme = laps faciles après le dernier effort
  if (lastEffort < laps.length - 1) {
    blocks.push(easyBlock('cooldown', laps.slice(lastEffort + 1), order++));
  }

  return blocks;
}

/**
 * Cale les laps Strava sur le squelette du plan coach : on garde la STRUCTURE du
 * plan (échauffement / groupes / récup / retour au calme) et on remplit chaque
 * élément avec les valeurs RÉELLES tirées des laps. Résultat : des blocs réalisés
 * alignés 1:1 sur le prévu → comparaison directe (10×500 prévu → 10×550 réalisé).
 */
function reconstructAgainstPlan(laps, plannedBlocks) {
  const { isEffort } = classifyLaps(laps);
  const n = laps.length;
  let cursor = 0;

  const takeEasyRun = () => {
    const start = cursor;
    while (cursor < n && !isEffort[cursor]) cursor++;
    return laps.slice(start, cursor);
  };
  const takeEffort = () => {
    while (cursor < n && !isEffort[cursor]) cursor++; // saute un éventuel lap facile parasite
    return cursor < n ? laps[cursor++] : null;
  };
  const takeRecovery = () => (cursor < n && !isEffort[cursor]) ? laps[cursor++] : null;

  // Valeur réalisée d'un step en respectant le mode du plan (distance/durée)
  const realizedValue = (planStep, effLaps) => {
    const speeds = effLaps.map(l => l.average_speed).filter(Boolean);
    const out = {
      mode: planStep.mode || 'distance',
      distance: null,
      duration: null,
      pace: speeds.length ? speedToPaceStr(avg(speeds)) : null
    };
    if (out.mode === 'duration') {
      const secs = effLaps.map(l => l.moving_time || l.elapsed_time || 0);
      out.duration = Math.max(1, Math.round(avg(secs) / 60));
    } else {
      out.distance = round2(avg(effLaps.map(l => l.distance || 0)) / 1000);
    }
    return out;
  };

  const buildRealizedStep = (planStep, order) => {
    const reps = Math.max(1, planStep.repetitions || 1);
    const effLaps = [];
    const recLaps = [];
    for (let r = 0; r < reps; r++) {
      const e = takeEffort();
      if (!e) break;
      effLaps.push(e);
      if (planStep.recoveryMode) {
        const rec = takeRecovery();
        if (rec) recLaps.push(rec);
      }
    }
    if (!effLaps.length) return null;
    const val = realizedValue(planStep, effLaps);
    const step = {
      role: 'main',
      mode: val.mode,
      distance: val.distance,
      duration: val.duration,
      pace: val.pace,
      repetitions: effLaps.length,
      description: planStep.description || 'Effort',
      recoveryMode: null,
      recoveryDistance: null,
      recoveryDuration: null,
      recoveryPace: null,
      recoveryDescription: '',
      order
    };
    if (planStep.recoveryMode && recLaps.length) {
      step.recoveryMode = 'duration';
      step.recoveryDuration = secondsToRecoveryText(avg(recLaps.map(l => l.moving_time || l.elapsed_time || 0)));
      step.recoveryPace = speedToPaceStr(avg(recLaps.map(l => l.average_speed).filter(Boolean)));
      step.recoveryDescription = 'Récup';
    }
    return step;
  };

  const result = [];
  let order = 0;
  const ordered = [...plannedBlocks].sort((a, b) => (a.order || 0) - (b.order || 0));

  for (const blk of ordered) {
    if (blk.role === 'warmup') {
      const easy = takeEasyRun();
      if (easy.length) result.push(easyBlock('warmup', easy, order++));
    } else if (blk.role === 'cooldown') {
      const easy = takeEasyRun();
      if (easy.length) result.push(easyBlock('cooldown', easy, order++));
    } else if (isGroup(blk)) {
      // Groupe « Répéter » : on reproduit children × reps avec les valeurs réelles
      const R = Math.max(1, blk.repetitions || 1);
      const children = blk.children;
      const acc = children.map(() => ({ eff: [], rec: [] }));
      let consumed = 0;
      for (let r = 0; r < R; r++) {
        for (let ci = 0; ci < children.length; ci++) {
          const e = takeEffort();
          if (!e) { r = R; break; }
          acc[ci].eff.push(e);
          consumed++;
          if (children[ci].recoveryMode) {
            const rec = takeRecovery();
            if (rec) acc[ci].rec.push(rec);
          }
        }
      }
      if (consumed === 0) continue;
      const realizedChildren = children.map((c, ci) => {
        const val = realizedValue(c, acc[ci].eff.length ? acc[ci].eff : [{ average_speed: 0, distance: 0 }]);
        const child = {
          role: 'main',
          mode: val.mode,
          distance: val.distance,
          duration: val.duration,
          pace: val.pace,
          repetitions: 1,
          description: c.description || 'Effort',
          recoveryMode: null,
          order: ci
        };
        if (c.recoveryMode && acc[ci].rec.length) {
          child.recoveryMode = 'duration';
          child.recoveryDuration = secondsToRecoveryText(avg(acc[ci].rec.map(l => l.moving_time || l.elapsed_time || 0)));
          child.recoveryPace = speedToPaceStr(avg(acc[ci].rec.map(l => l.average_speed).filter(Boolean)));
          child.recoveryDescription = 'Récup';
        }
        return child;
      });
      // reps réelles = nb d'efforts consommés / nb d'enfants
      const realReps = Math.max(1, Math.round(consumed / children.length));
      result.push({
        role: 'main',
        mode: 'distance',
        distance: null,
        duration: null,
        pace: null,
        repetitions: realReps,
        description: blk.description || 'Fractionné',
        recoveryMode: null,
        children: realizedChildren,
        order: order++
      });
    } else {
      // Step simple (éventuellement reps>1 legacy)
      const step = buildRealizedStep(blk, order);
      if (step) { step.order = order++; result.push(step); }
    }
  }

  // Laps d'effort restants non prévus par le plan → on les ajoute en fin (l'athlète en a fait plus)
  // (optionnel, on les ignore pour rester fidèle au plan)

  return result.length ? result : null;
}

/** Bloc unique pour une course continue (toute la séance). */
function continuousBlock(laps) {
  const distM = laps.reduce((a, l) => a + (l.distance || 0), 0);
  const timeS = laps.reduce((a, l) => a + (l.moving_time || l.elapsed_time || 0), 0);
  const speed = distM > 0 && timeS > 0 ? distM / timeS : avg(laps.map(l => l.average_speed));
  return {
    role: 'main',
    mode: 'distance',
    distance: round2(distM / 1000),
    duration: null,
    pace: speedToPaceStr(speed),
    repetitions: 1,
    description: 'Course continue',
    recoveryMode: null,
    order: 0
  };
}

module.exports = { reconstructBlocksFromLaps, speedToPaceStr, paceSecPerKm };
