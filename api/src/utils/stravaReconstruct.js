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
/** Dispersion relative (écart-type / moyenne), pour comparer distances et durées. */
const spreadRatio = (values) => {
  const mean = avg(values);
  if (!mean) return Infinity;
  return Math.sqrt(avg(values.map(v => (v - mean) ** 2))) / mean;
};
const median = (arr) => {
  if (!arr.length) return 0;
  const sorted = [...arr].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};

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

/**
 * Sépare les allures en deux groupes (effort / facile) par k-moyennes à une
 * dimension, pondérées par la durée du tour.
 *
 * Le plus grand écart entre allures triées, utilisé avant, se laissait piéger
 * par une valeur isolée : un retour au calme à 7:49 créait le plus grand trou
 * du jeu, et le seuil tombait au-dessus de l'échauffement — des kilomètres à
 * 6:10 se retrouvaient classés « effort » avec des 400 m à 3:35. Les
 * k-moyennes minimisent la dispersion dans chaque groupe : un point isolé ne
 * déplace plus la frontière.
 */
function splitByPace(entries) {
  const paces = entries.map(e => e.pace);
  let fast = Math.min(...paces);
  let slow = Math.max(...paces);

  const weightedMean = (group) => {
    const total = group.reduce((sum, e) => sum + e.weight, 0);
    return total > 0 ? group.reduce((sum, e) => sum + e.pace * e.weight, 0) / total : avg(group.map(e => e.pace));
  };

  for (let step = 0; step < 20; step++) {
    const fastGroup = [];
    const slowGroup = [];
    for (const entry of entries) {
      (Math.abs(entry.pace - fast) <= Math.abs(entry.pace - slow) ? fastGroup : slowGroup).push(entry);
    }
    if (!fastGroup.length || !slowGroup.length) break;

    const nextFast = weightedMean(fastGroup);
    const nextSlow = weightedMean(slowGroup);
    if (Math.abs(nextFast - fast) < 0.5 && Math.abs(nextSlow - slow) < 0.5) {
      fast = nextFast;
      slow = nextSlow;
      break;
    }
    fast = nextFast;
    slow = nextSlow;
  }

  return { cut: (fast + slow) / 2, fast, slow };
}

/**
 * Fusionne les tours minuscules dans le précédent : un appui sur le bouton lap
 * produit parfois un tour de 60 m, qui n'est pas une étape de la séance.
 */
function mergeMicroLaps(laps) {
  const MICRO_DISTANCE_M = 120;
  const MICRO_TIME_S = 30;
  const merged = [];

  for (const lap of laps) {
    const distance = lap.distance || 0;
    const time = lap.moving_time || lap.elapsed_time || 0;
    const previous = merged[merged.length - 1];

    if (previous && distance < MICRO_DISTANCE_M && time < MICRO_TIME_S) {
      previous.distance = (previous.distance || 0) + distance;
      previous.moving_time = (previous.moving_time || 0) + (lap.moving_time || 0);
      previous.elapsed_time = (previous.elapsed_time || 0) + (lap.elapsed_time || 0);
      const movingTime = previous.moving_time || previous.elapsed_time;
      if (movingTime > 0) previous.average_speed = previous.distance / movingTime;
      continue;
    }

    merged.push({ ...lap });
  }

  return merged;
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
    description: '',
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
  step.recoveryDescription = '';
}

/**
 * Répétition représentative d'une série homogène : la moyenne des tours, pas le
 * premier. Sur 12 × 400 m, le premier tour est souvent le plus long et le plus
 * lent — le prendre pour modèle décrivait mal la séance.
 */
function averageEffort(effortLaps, recoveryLaps) {
  const distances = effortLaps.map(l => l.distance || 0);
  const times = effortLaps.map(l => l.moving_time || l.elapsed_time || 0);
  const distM = avg(distances);
  const timeS = avg(times);

  // Séance au chrono (10 × 1 min 30) ou à la distance (10 × 400 m) ? C'est la
  // grandeur la plus régulière d'un tour à l'autre qui dit comment elle a été
  // courue — l'autre varie avec le terrain.
  const byTime = spreadRatio(times) * 1.3 + 0.002 < spreadRatio(distances);

  const step = {
    role: 'main',
    mode: byTime ? 'duration' : 'distance',
    // À la dizaine de mètres / aux 5 secondes près : une moyenne à 407,3 m ou
    // à 1 min 27,4 s n'a pas de sens sur le terrain.
    distance: byTime ? null : round2(Math.round(distM / 10) * 10 / 1000),
    duration: byTime ? round2((Math.round(timeS / 5) * 5) / 60) : null,
    pace: timeS > 0 ? speedToPaceStr(distM / timeS) : null,
    repetitions: 1,
    description: '',
    recoveryMode: null,
    recoveryDistance: null,
    recoveryDuration: null,
    recoveryPace: null,
    recoveryDescription: '',
    order: 0
  };

  if (recoveryLaps.length) {
    // Médiane : une récup rallongée une fois (lacet, feu rouge, discussion) ne
    // doit pas décrire toute la série.
    const recoveryTime = median(recoveryLaps.map(l => l.moving_time || l.elapsed_time || 0));
    const recoveryDist = median(recoveryLaps.map(l => l.distance || 0));
    step.recoveryMode = 'duration';
    step.recoveryDuration = secondsToRecoveryText(Math.round(recoveryTime / 5) * 5);
    step.recoveryPace = recoveryTime > 0 ? speedToPaceStr(recoveryDist / recoveryTime) : null;
  }

  return step;
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

// Au-delà, on ne court plus : récupération debout, marche, arrêt au feu. Ces
// tours ne doivent pas peser dans la séparation effort / facile, sinon la
// coupure se fait entre « courir » et « être à l'arrêt », et l'échauffement se
// retrouve du côté des efforts.
const STANDING_PACE = 570; // 9:30 /km

/** Classe chaque lap en effort / facile et détecte une course continue. */
function classifyLaps(laps) {
  if (laps.length <= 1) return { isEffort: laps.map(() => false), continuous: true };

  const entries = laps.map(l => ({
    pace: paceSecPerKm(l.average_speed),
    weight: Math.max(1, l.moving_time || l.elapsed_time || 1)
  }));

  const running = entries.filter(e => Number.isFinite(e.pace) && e.pace < STANDING_PACE);
  const standing = entries.length - running.length;
  if (running.length < 2) return { isEffort: laps.map(() => false), continuous: true };

  const paces = running.map(e => e.pace);
  const spread = Math.max(...paces) - Math.min(...paces);

  // Allure de course régulière : soit c'est un footing, soit les seules pauses
  // sont des arrêts — auquel cas tout ce qui est couru est un effort.
  if (spread < 25) {
    if (!standing) return { isEffort: laps.map(() => false), continuous: true };
    return { isEffort: entries.map(e => Number.isFinite(e.pace) && e.pace < STANDING_PACE), continuous: false };
  }

  const { cut, fast, slow } = splitByPace(running);
  // Deux groupes trop proches : c'est une allure qui dérive, pas une alternance.
  if (slow - fast < 20 && !standing) return { isEffort: laps.map(() => false), continuous: true };

  // Un tour à l'arrêt n'est jamais un effort, quelle que soit la coupure.
  return { isEffort: entries.map(e => Number.isFinite(e.pace) && e.pace < STANDING_PACE && e.pace <= cut), continuous: false };
}

/**
 * Fond les tours voisins de même nature en un seul.
 *
 * Une montre qui tourne en tour automatique au kilomètre découpe une répétition
 * de 12 minutes en trois tours : sans cette fusion, on lit trois répétitions
 * d'un kilomètre là où l'athlète en a fait une seule.
 */
function mergeConsecutive(laps, isEffort) {
  const outLaps = [];
  const outEffort = [];

  laps.forEach((lap, index) => {
    const last = outLaps[outLaps.length - 1];
    if (last && outEffort[outEffort.length - 1] === isEffort[index]) {
      last.distance = (last.distance || 0) + (lap.distance || 0);
      last.moving_time = (last.moving_time || 0) + (lap.moving_time || lap.elapsed_time || 0);
      last.elapsed_time = (last.elapsed_time || 0) + (lap.elapsed_time || lap.moving_time || 0);
      const time = last.moving_time || last.elapsed_time;
      if (time > 0) last.average_speed = last.distance / time;
      return;
    }
    outLaps.push({ ...lap, moving_time: lap.moving_time || lap.elapsed_time || 0 });
    outEffort.push(isEffort[index]);
  });

  return { laps: outLaps, isEffort: outEffort };
}

/**
 * Reconstruit runBlocks[] depuis les laps Strava.
 * @param {Array} laps - activity.laps de Strava
 * @param {Array} [plannedBlocks] - blocs prévus par le coach : si fournis, on CALE
 *        les laps sur ce squelette (même structure, valeurs réelles) pour une
 *        comparaison prévu↔réalisé propre. Sinon, détection autonome.
 * @returns {Array} runBlocks (compatibles modèle RunBlock, avec groupes via children)
 */
function reconstructBlocksFromLaps(rawLaps, plannedBlocks) {
  if (!Array.isArray(rawLaps) || rawLaps.length === 0) return [];
  let laps = mergeMicroLaps(rawLaps);

  // Si on a un plan coach → on s'aligne dessus (10×500 prévu rempli depuis 10×550 réels)
  if (Array.isArray(plannedBlocks) && plannedBlocks.length) {
    const aligned = reconstructAgainstPlan(laps, plannedBlocks);
    if (aligned && aligned.length) return aligned;
  }

  // Course continue (1 seul lap)
  if (laps.length === 1) {
    return [continuousBlock(laps)];
  }

  const classified = classifyLaps(laps);

  // Pas de vraie variation d'allure → footing continu
  if (classified.continuous) {
    return [continuousBlock(laps)];
  }

  const merged = mergeConsecutive(laps, classified.isEffort);
  const isEffort = merged.isEffort;
  laps = merged.laps;

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
  const effortLaps = [];
  const recoveryLaps = [];
  let i = firstEffort;
  while (i <= lastEffort) {
    if (isEffort[i]) {
      const step = effortStep(laps[i], 0);
      effortLaps.push(laps[i]);
      // récup = lap facile juste après (s'il y en a un et qu'il est dans le corps)
      if (i + 1 <= lastEffort && !isEffort[i + 1]) {
        attachRecovery(step, laps[i + 1]);
        recoveryLaps.push(laps[i + 1]);
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
      // Efforts homogènes → groupe « Répéter ×N » (1 enfant, la répétition moyenne)
      const child = { ...averageEffort(effortLaps, recoveryLaps), order: 0 };
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
function reconstructAgainstPlan(rawLaps, plannedBlocks) {
  // Les tours voisins de même nature sont fondus : une répétition découpée par
  // le tour automatique au kilomètre redevient une répétition.
  const { laps, isEffort } = mergeConsecutive(rawLaps, classifyLaps(rawLaps).isEffort);
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
  // Une récupération sépare deux efforts : s'il n'y a plus d'effort derrière,
  // ce tour facile est le retour au calme, pas une récup.
  const effortAhead = (from) => {
    for (let i = from; i < n; i++) if (isEffort[i]) return true;
    return false;
  };
  const takeRecovery = () => (cursor < n && !isEffort[cursor] && effortAhead(cursor + 1) ? laps[cursor++] : null);

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
      // Au dixième de minute : arrondir à la minute pleine ferait d'un 1'30 un 2'.
      out.duration = Math.max(0.1, Math.round(avg(secs) / 6) / 10);
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
      // Médiane : une pause plus longue que les autres ne doit pas tirer la récup.
      step.recoveryDuration = secondsToRecoveryText(median(recLaps.map(l => l.moving_time || l.elapsed_time || 0)));
      step.recoveryPace = speedToPaceStr(median(recLaps.map(l => l.average_speed).filter(Boolean)));
      step.recoveryDescription = '';
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
          // Médiane : une pause plus longue que les autres ne doit pas tirer la récup.
          child.recoveryDuration = secondsToRecoveryText(median(acc[ci].rec.map(l => l.moving_time || l.elapsed_time || 0)));
          child.recoveryPace = speedToPaceStr(median(acc[ci].rec.map(l => l.average_speed).filter(Boolean)));
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
