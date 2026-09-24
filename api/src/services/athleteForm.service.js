/**
 * La forme d'un athlète, pour l'écran Statistiques du coach.
 *
 * Tout part de ce qu'on stocke déjà : les km Strava (allure, FC, dénivelé), la
 * durée des séances, le ressenti, les séries de muscu (charge × répétitions ×
 * RPE) et les séances planifiées. Rien n'est demandé en plus à l'athlète.
 *
 * Le calcul est fait à la demande, pour un athlète à la fois : quelques
 * centaines de documents au plus, c'est rapide. La partie calcul est faite de
 * fonctions pures (pas de base) pour qu'elle se teste avec des données
 * fabriquées : voir scripts/formCheck.js.
 *
 * Unité de charge : le « point ». Une minute en endurance vaut 1 point, une
 * minute à allure seuil 2, une minute en VMA 3. La muscu vaut sa durée × RPE / 4
 * (une heure à RPE 8 pèse comme une heure au seuil). Ce n'est pas une mesure
 * physiologique, c'est une échelle commune pour comparer une semaine à ses
 * voisines.
 */
const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const PlannedRun = require('../models/plannedRun.model');
const Competition = require('../models/competition.model');
const User = require('../models/user.model');

const DAY = 24 * 60 * 60 * 1000;
const WEEK = 7 * DAY;

// ---------------------------------------------------------------------------
// Réglages. Regroupés ici pour qu'on les retrouve, et qu'on les ajuste avec
// des vraies données plutôt qu'au fil du code.
// ---------------------------------------------------------------------------
const SETTINGS = {
  // Zones d'intensité, en % de VMA : endurance < 72 % ≤ seuil < 88 % ≤ VMA.
  zoneTempo: 72,
  zoneVma: 88,
  zoneFactor: { easy: 1, tempo: 2, hard: 3 },
  // Plage d'allure qui sert de référence pour la FC « en endurance ».
  easyHrMin: 58,
  easyHrMax: 68,
  easyHrMaxElevation: 10, // m de dénivelé par km au-delà duquel le km est écarté
  easyHrMinSplits: 3, // km par semaine pour qu'un point compte
  // Forme : charge des 7 derniers jours / charge hebdo habituelle (28 jours).
  ratioRested: 0.8,
  ratioLoaded: 1.3,
  ratioOverreached: 1.5,
  minHistoryDays: 21, // en dessous, on n'annonce rien
  // La forme se juge toujours sur les 12 dernières semaines, quelle que soit la
  // période affichée : la liste et la fiche doivent dire la même chose.
  formHistoryWeeks: 12,
  inactiveDays: 10,
  // Signaux qui font monter la forme d'un cran.
  hrDriftBpm: 4,
  feelingDrop: 1.5,
  feelingLow: 5,
  // Muscu
  e1rmMaxReps: 10, // au-delà, l'estimation de charge max n'est plus fiable
  trendPercent: 2, // ±2 % sur 4 semaines : sous ce seuil, ça stagne
  strengthDefaultRpe: 6,
  strengthDefaultMinutes: 45,
  deloadPercent: 15
};

// Facteur d'intensité d'une séance sans détail au km, d'après son type.
const SESSION_TYPE_FACTOR = {
  endurance: 1,
  recuperation: 0.8,
  sortie_longue: 1.1,
  tempo: 1.8,
  fartlek: 1.8,
  cotes: 2,
  fractionne: 2.2
};

// ---------------------------------------------------------------------------
// Petits outils
// ---------------------------------------------------------------------------
const round = (value, digits = 0) => {
  if (value == null || !isFinite(value)) return null;
  const f = 10 ** digits;
  return Math.round(value * f) / f;
};

const median = (values) => {
  const list = values.filter((v) => v != null && isFinite(v)).sort((a, b) => a - b);
  if (!list.length) return null;
  const mid = Math.floor(list.length / 2);
  return list.length % 2 ? list[mid] : (list[mid - 1] + list[mid]) / 2;
};

const mean = (values) => {
  const list = values.filter((v) => v != null && isFinite(v));
  return list.length ? list.reduce((s, v) => s + v, 0) / list.length : null;
};

/** "5:30" → 330 secondes par km. */
const paceToSeconds = (pace) => {
  if (!pace || typeof pace !== 'string') return null;
  const [m, s] = pace.split(':').map(Number);
  if (!isFinite(m)) return null;
  return m * 60 + (isFinite(s) ? s : 0);
};

/** Durée libre (« 1min30 », « 90s », « 2 min », « 1:30 ») → minutes. */
const freeDurationToMinutes = (text) => {
  if (!text) return null;
  const t = String(text).toLowerCase().replace(/\s/g, '');
  if (/^\d+:\d{1,2}$/.test(t)) {
    const [m, s] = t.split(':').map(Number);
    return m + s / 60;
  }
  // « 1min30 » : les chiffres collés après « min » sont des secondes.
  const min = t.match(/(\d+(?:[.,]\d+)?)(?:min|mn|m(?!s))(\d{1,2})?/);
  const sec = min?.[2] ? null : t.match(/(\d+)(?:s|sec|")/);
  const minutes = (min ? Number(min[1].replace(',', '.')) + (min[2] ? Number(min[2]) / 60 : 0) : 0) + (sec ? Number(sec[1]) / 60 : 0);
  if (minutes) return minutes;
  const bare = Number(t.replace(',', '.'));
  return isFinite(bare) && bare > 0 ? (bare > 20 ? bare / 60 : bare) : null; // « 90 » = secondes, « 3 » = minutes
};

/** Lundi 0 h (heure locale du serveur) de la semaine qui contient `date`. */
const mondayOf = (date) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
};

/** AAAA-MM-JJ en heure locale : toISOString décalerait les lundis 0 h d'un jour. */
const localDay = (date) => {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const isoWeekLabel = (monday) => {
  const thursday = new Date(monday);
  thursday.setDate(monday.getDate() + 3);
  const year = thursday.getFullYear();
  const jan1 = new Date(year, 0, 1);
  const week = Math.ceil(((thursday - jan1) / DAY + 1) / 7);
  return `S${week}`;
};

/** Les lundis de `count` semaines, la dernière étant celle de `now`. */
const weekStarts = (now, count) => {
  const last = mondayOf(now);
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(last);
    d.setDate(last.getDate() - (count - 1 - i) * 7);
    return d;
  });
};

const weekIndexOf = (starts, date) => {
  const t = new Date(date).getTime();
  for (let i = starts.length - 1; i >= 0; i--) {
    if (t >= starts[i].getTime()) return t < starts[i].getTime() + WEEK ? i : -1;
  }
  return -1;
};

// ---------------------------------------------------------------------------
// Course : intensité et charge
// ---------------------------------------------------------------------------

/** Zone d'un km couru à `speed` m/s pour une VMA en km/h. */
const zoneOfSpeed = (speed, vma) => {
  if (!speed || !vma) return null;
  const pct = ((speed * 3.6) / vma) * 100;
  if (pct >= SETTINGS.zoneVma) return 'hard';
  if (pct >= SETTINGS.zoneTempo) return 'tempo';
  return 'easy';
};

const zoneOfSessionType = (type) => {
  const f = SESSION_TYPE_FACTOR[type];
  if (f == null) return 'easy';
  return f >= 2 ? 'hard' : f >= 1.5 ? 'tempo' : 'easy';
};

/**
 * Ce qu'une sortie apporte : sa charge, ses km par zone, et les km qui servent
 * à mesurer la FC en endurance.
 */
function runContribution(run, vma) {
  const splits = run.stravaData?.splits || [];
  const usable = vma ? splits.filter((s) => s.averageSpeed > 0 && (s.movingTime || s.elapsedTime)) : [];
  const km = { easy: 0, tempo: 0, hard: 0 };
  let load = 0;
  const easyHr = [];

  if (usable.length) {
    for (const s of usable) {
      const zone = zoneOfSpeed(s.averageSpeed, vma);
      const minutes = (s.movingTime || s.elapsedTime) / 60;
      load += minutes * SETTINGS.zoneFactor[zone];
      km[zone] += (s.distance || 1000) / 1000;
      const pct = ((s.averageSpeed * 3.6) / vma) * 100;
      if (
        s.averageHeartrate &&
        pct >= SETTINGS.easyHrMin &&
        pct <= SETTINGS.easyHrMax &&
        Math.abs(s.elevationDifference || 0) <= SETTINGS.easyHrMaxElevation
      ) {
        easyHr.push(s.averageHeartrate);
      }
    }
    // Les splits ne couvrent pas toujours la fin (le dernier bout < 1 km).
    const splitKm = km.easy + km.tempo + km.hard;
    if (run.distance && run.distance > splitKm + 0.3) km.easy += run.distance - splitKm;
  } else {
    // Pas de détail au km : l'allure moyenne, sinon le type de séance.
    const minutes = run.duration || (run.distance && paceToSeconds(run.averagePace) ? (run.distance * paceToSeconds(run.averagePace)) / 60 : 0);
    let zone = zoneOfSessionType(run.sessionType);
    let factor = SESSION_TYPE_FACTOR[run.sessionType] ?? 1.2;
    const pace = paceToSeconds(run.averagePace) || (run.distance && run.duration ? (run.duration * 60) / run.distance : null);
    if (pace && vma && !SESSION_TYPE_FACTOR[run.sessionType]) {
      zone = zoneOfSpeed(1000 / pace, vma);
      factor = SETTINGS.zoneFactor[zone];
    }
    load = minutes * factor;
    km[zone] += run.distance || 0;
  }

  return { load, km, easyHr, hasSplits: usable.length > 0 };
}

/** Durée d'une séance muscu en minutes, estimée si l'athlète ne l'a pas notée. */
const strengthMinutes = (session) => {
  if (session.duration) return session.duration;
  const sets = (session.exercises || []).reduce((n, e) => n + (e.sets?.length || 0), 0);
  return sets ? Math.max(15, sets * 2.5) : SETTINGS.strengthDefaultMinutes;
};

const sessionRpe = (session) => {
  const rpes = (session.exercises || []).flatMap((e) => (e.sets || []).map((s) => s.rpe)).filter((v) => v);
  return mean(rpes);
};

function strengthContribution(session) {
  const rpe = sessionRpe(session) ?? SETTINGS.strengthDefaultRpe;
  return { load: (strengthMinutes(session) * rpe) / 4, rpe };
}

// ---------------------------------------------------------------------------
// Séances planifiées : ce qu'elles pèseront
// ---------------------------------------------------------------------------

function stepMinutes(step, fallbackPace) {
  if (step.mode === 'duration' && step.duration) return step.duration;
  const pace = paceToSeconds(step.pace) || fallbackPace;
  if (step.distance && pace) return (step.distance * pace) / 60;
  return 0;
}

function stepLoad(step, vma, fallbackPace) {
  const minutes = stepMinutes(step, fallbackPace);
  const pace = paceToSeconds(step.pace);
  const zone = pace && vma ? zoneOfSpeed(1000 / pace, vma) : step.role === 'main' ? 'tempo' : 'easy';
  let load = minutes * SETTINGS.zoneFactor[zone];
  // Récupération entre deux répétitions : du trot, compté en endurance.
  let recovery = 0;
  if (step.recoveryMode === 'duration') recovery = freeDurationToMinutes(step.recoveryDuration) || 0;
  else if (step.recoveryMode === 'distance' && step.recoveryDistance) recovery = (step.recoveryDistance * (paceToSeconds(step.recoveryPace) || fallbackPace || 390)) / 60;
  return { load, minutes, recovery };
}

/** La charge qu'une séance planifiée représentera une fois faite. */
function plannedLoad(plan, vma) {
  if (plan.activityType === 'strength') {
    const minutes = plan.strengthPlan?.estimatedDuration || SETTINGS.strengthDefaultMinutes;
    return { load: (minutes * SETTINGS.strengthDefaultRpe) / 4, intense: false, sport: 'strength' };
  }
  // Allure d'endurance par défaut pour les blocs sans allure : 62 % de VMA.
  const fallbackPace = vma ? 3600 / (vma * 0.62) : 390;
  let load = 0;
  let hardMinutes = 0;
  for (const block of plan.runBlocks || []) {
    const reps = block.repetitions || 1;
    const steps = block.children?.length ? block.children : [block];
    for (const step of steps) {
      const { load: l, minutes, recovery } = stepLoad(step, vma, fallbackPace);
      load += l * reps + recovery * Math.max(0, reps - 1);
      const pace = paceToSeconds(step.pace);
      if (pace && vma && zoneOfSpeed(1000 / pace, vma) !== 'easy') hardMinutes += minutes * reps;
    }
  }
  if (!load) {
    const pace = paceToSeconds(plan.targetPace) || fallbackPace;
    const minutes = plan.targetDuration || (plan.targetDistance ? (plan.targetDistance * pace) / 60 : 45);
    load = minutes * (SESSION_TYPE_FACTOR[plan.sessionType] ?? 1.2);
  }
  const intense = hardMinutes >= 8 || ['fractionne', 'tempo', 'cotes', 'fartlek'].includes(plan.sessionType);
  return { load, intense, sport: 'run' };
}

// ---------------------------------------------------------------------------
// Forme du moment
// ---------------------------------------------------------------------------

const STATES = ['rested', 'optimal', 'loaded', 'overreached'];

/**
 * La forme d'après la charge : 7 derniers jours face à la moyenne hebdo des
 * 28 derniers jours, puis un cran de plus si la FC dérive ET que le ressenti
 * baisse (un seul signal ne suffit pas : une journée chaude fait monter la FC).
 */
function formState({ acute, chronicWeekly, historyDays, daysSinceActivity, hrDrift, feelingNow, feelingBefore }) {
  if (daysSinceActivity != null && daysSinceActivity >= SETTINGS.inactiveDays) {
    return { state: 'inactive', ratio: null, position: null, signals: [] };
  }
  if (historyDays < SETTINGS.minHistoryDays || !chronicWeekly) {
    return { state: 'unknown', ratio: null, position: null, signals: [] };
  }
  const ratio = acute / chronicWeekly;
  let index = ratio < SETTINGS.ratioRested ? 0 : ratio <= SETTINGS.ratioLoaded ? 1 : ratio <= SETTINGS.ratioOverreached ? 2 : 3;

  const signals = [];
  if (hrDrift != null && hrDrift >= SETTINGS.hrDriftBpm) signals.push('hr');
  if (feelingNow != null && (feelingNow <= SETTINGS.feelingLow || (feelingBefore != null && feelingBefore - feelingNow >= SETTINGS.feelingDrop))) {
    signals.push('feeling');
  }
  if (signals.length >= 2 && index >= 1 && index < 3) index += 1;

  // Position du curseur sur la jauge (0 → 1). Les quatre segments ont des
  // largeurs fixes à l'écran ; on interpole le rapport entre leurs bornes.
  const points = [[0, 0], [SETTINGS.ratioRested, 0.22], [SETTINGS.ratioLoaded, 0.58], [SETTINGS.ratioOverreached, 0.82], [2, 1]];
  let position = 1;
  for (let i = 1; i < points.length; i++) {
    const [r0, p0] = points[i - 1];
    const [r1, p1] = points[i];
    if (ratio <= r1) {
      position = p0 + ((ratio - r0) / (r1 - r0)) * (p1 - p0);
      break;
    }
  }
  // Si les signaux ont fait monter d'un cran, le curseur suit dans le segment.
  const bounds = [[0, 0.22], [0.22, 0.58], [0.58, 0.82], [0.82, 1]][index];
  position = Math.min(bounds[1] - 0.02, Math.max(bounds[0] + 0.02, position));

  return { state: STATES[index], ratio: round(ratio, 2), position: round(position, 3), signals };
}

// ---------------------------------------------------------------------------
// Muscu : charge max estimée et tendances
// ---------------------------------------------------------------------------

/** Formule d'Epley : charge × (1 + répétitions / 30). */
const e1rm = (weight, reps) => (weight > 0 && reps > 0 && reps <= SETTINGS.e1rmMaxReps ? weight * (1 + reps / 30) : null);

const trendOf = (older, recent) => {
  if (older == null || recent == null || !older) return null;
  const pct = ((recent - older) / older) * 100;
  return { pct: round(pct, 1), direction: pct > SETTINGS.trendPercent ? 'up' : pct < -SETTINGS.trendPercent ? 'down' : 'flat' };
};

/**
 * Par exercice : meilleure série de chaque séance, charge max estimée semaine
 * par semaine, tendance sur 4 semaines. Un exercice au poids du corps suit ses
 * répétitions à la place.
 */
function exerciseProgress(sessions, starts, now) {
  const byExercise = new Map();
  for (const session of sessions) {
    const w = weekIndexOf(starts, session.date);
    for (const entry of session.exercises || []) {
      const id = entry.exercise?._id?.toString() || entry.exercise?.toString();
      if (!id) continue;
      const sets = (entry.sets || []).filter((s) => s.reps > 0);
      if (!sets.length) continue;
      const weighted = sets.some((s) => s.weight > 0);
      let best = null;
      for (const s of sets) {
        const score = weighted ? e1rm(s.weight, s.reps) : s.reps;
        if (score == null) continue;
        if (!best || score > best.score) best = { score, weight: s.weight || 0, reps: s.reps, rpe: s.rpe ?? null };
      }
      // Série la plus lourde : c'est son RPE qui dit si la charge passe encore.
      const heaviest = weighted ? sets.reduce((a, b) => ((b.weight || 0) > (a.weight || 0) ? b : a)) : null;
      if (!byExercise.has(id)) {
        byExercise.set(id, { id, name: entry.exercise?.name || 'Exercice', weighted, sessions: [] });
      }
      byExercise.get(id).sessions.push({ date: new Date(session.date), week: w, best, heaviest });
    }
  }

  const fourWeeksAgo = now.getTime() - 4 * WEEK;
  const twoWeeksAgo = now.getTime() - 2 * WEEK;
  const out = [];
  for (const ex of byExercise.values()) {
    const done = ex.sessions.filter((s) => s.best);
    if (done.length < 3) continue;
    done.sort((a, b) => a.date - b.date);
    const weekly = starts.map((_, i) => {
      const scores = done.filter((s) => s.week === i).map((s) => s.best.score);
      return scores.length ? round(Math.max(...scores), 1) : null;
    });
    const recent = done.filter((s) => s.date.getTime() >= twoWeeksAgo).map((s) => s.best.score);
    const older = done.filter((s) => s.date.getTime() >= fourWeeksAgo && s.date.getTime() < twoWeeksAgo).map((s) => s.best.score);
    const last = done[done.length - 1];
    const heavyRpe = starts.map((_, i) => mean(done.filter((s) => s.week === i && s.heaviest?.rpe).map((s) => s.heaviest.rpe)));
    out.push({
      id: ex.id,
      name: ex.name,
      weighted: ex.weighted,
      count: done.length,
      last: { weight: last.best.weight, reps: last.best.reps, rpe: last.best.rpe, date: last.date },
      lastHeaviest: last.heaviest ? { weight: last.heaviest.weight, reps: last.heaviest.reps, rpe: last.heaviest.rpe ?? null } : null,
      current: ex.weighted ? round(Math.max(...done.slice(-3).map((s) => s.best.score)), 1) : null,
      trend: trendOf(older.length ? Math.max(...older) : null, recent.length ? Math.max(...recent) : null),
      weekly,
      heavyRpe: heavyRpe.map((v) => round(v, 1)),
      // Semaines d'affilée sans nouveau meilleur score, jusqu'à aujourd'hui.
      flatWeeks: (() => {
        const filled = weekly.filter((v) => v != null);
        if (filled.length < 2) return 0;
        const top = Math.max(...filled);
        const firstTop = weekly.findIndex((v) => v != null && v >= top * 0.99);
        return weekly.length - 1 - firstTop;
      })()
    });
  }
  // Les plus pratiqués d'abord : ce sont eux qui disent quelque chose.
  return out.sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// Repères : des règles fixes, lisibles, et toujours avec leur raison
// ---------------------------------------------------------------------------

const fmtPts = (n) => `${Math.round(n)} pts`;
const roundTo = (value, step) => Math.round(value / step) * step;
const fmtKg = (kg) => `${String(roundTo(kg, 0.5)).replace('.', ',')} kg`;

function runCues({ form, band, nextWeek, raceInDays, firstName }) {
  const cues = [];
  const who = firstName || 'l’athlète';
  if (form.state === 'unknown' || form.state === 'inactive' || !band) return cues;

  if (!nextWeek.count) {
    cues.push({
      kind: 'keep',
      title: 'Rien de planifié la semaine prochaine',
      detail: `Pour rester dans la zone de progression : entre ${fmtPts(band.low)} et ${fmtPts(band.high)}.`
    });
  } else if (nextWeek.load > band.high) {
    const cut = Math.round((1 - band.high / nextWeek.load) * 100 / 5) * 5 || 5;
    cues.push({
      kind: 'down',
      title: `Baisser le volume d’environ ${cut} %`,
      detail: `Prévue à ${fmtPts(nextWeek.load)}, la zone de progression va de ${fmtPts(band.low)} à ${fmtPts(band.high)}.`
    });
  } else if (nextWeek.load < band.low && form.state !== 'loaded' && form.state !== 'overreached' && !(raceInDays != null && raceInDays <= 10)) {
    cues.push({
      kind: 'up',
      title: 'Marge pour charger un peu plus',
      detail: `Prévue à ${fmtPts(nextWeek.load)} : jusqu’à ${fmtPts(band.high)} reste dans la zone de progression.`
    });
  }

  if ((form.state === 'loaded' || form.state === 'overreached') && nextWeek.intense >= 2) {
    cues.push({
      kind: 'keep',
      title: 'Une seule séance intense',
      detail: `${nextWeek.intense} séances intenses sont prévues. En garder une, passer les autres en endurance.`
    });
  }

  if (form.signals.includes('hr')) {
    cues.push({
      kind: 'down',
      title: 'Sa FC en endurance dérive',
      detail: 'À allure égale, le cœur travaille plus. Privilégier l’endurance quelques jours, puis revérifier.'
    });
  }

  if (form.signals.includes('feeling')) {
    cues.push({
      kind: 'keep',
      title: `Prendre des nouvelles de ${who}`,
      detail: 'Son ressenti après séance baisse. Un message avant de pousser la charge.'
    });
  }

  if (form.state === 'rested' && raceInDays != null && raceInDays <= 10) {
    cues.push({ kind: 'keep', title: 'Affûtage en cours', detail: `Course dans ${raceInDays} jours : une charge basse est normale.` });
  }

  return cues.slice(0, 4);
}

function strengthCues({ exercises, rpeNow, form }) {
  const cues = [];
  for (const ex of exercises) {
    if (cues.length >= 3) break;
    const rpes = ex.heavyRpe.filter((v) => v != null);
    const rpeRising = rpes.length >= 3 && rpes[rpes.length - 1] - rpes[rpes.length - 3] >= 1;
    if (ex.weighted && ex.flatWeeks >= 3 && (rpeRising || (ex.trend && ex.trend.direction !== 'up'))) {
      const base = ex.lastHeaviest?.weight || ex.last.weight;
      cues.push({
        kind: 'down',
        title: `${ex.name} : séance de décharge`,
        detail: `Pas de progrès depuis ${ex.flatWeeks} semaines${rpeRising ? ' et un effort perçu qui monte' : ''} : une séance à ${fmtKg(base * (1 - SETTINGS.deloadPercent / 100))} (−${SETTINGS.deloadPercent} %).`
      });
    }
  }
  for (const ex of exercises) {
    if (cues.length >= 3) break;
    const rpe = ex.lastHeaviest?.rpe ?? ex.last.rpe;
    if (ex.weighted && ex.trend?.direction === 'up' && rpe != null && rpe <= 7) {
      const base = ex.lastHeaviest?.weight || ex.last.weight;
      cues.push({ kind: 'up', title: `${ex.name} : +2,5 kg`, detail: `Dernière série lourde validée à RPE ${String(rpe).replace('.', ',')} : essayer ${fmtKg(base + 2.5)}.` });
    }
  }
  if (cues.length < 3 && rpeNow != null && rpeNow >= 8.5 && (form.state === 'loaded' || form.state === 'overreached')) {
    cues.push({ kind: 'keep', title: 'Une série de moins partout', detail: 'Effort moyen très haut alors que la charge globale l’est aussi : garder les exercices, alléger le volume.' });
  }
  return cues;
}

// ---------------------------------------------------------------------------
// Assemblage : la réponse de GET /api/coach/athletes/:id/form
// ---------------------------------------------------------------------------

/**
 * @param {object} input  { athlete, runs, strength, planned, competition, now, weeks }
 *   runs / strength / planned couvrent `weeks + 4` semaines (l'historique qu'il
 *   faut pour la charge habituelle de la première semaine affichée), planned
 *   couvre aussi la semaine suivante.
 */
function buildForm({ athlete, runs, strength, planned, competition, activity = null, now = new Date(), weeks = 8 }) {
  const vma = athlete.vma || null;
  const extra = 4;
  const allStarts = weekStarts(now, weeks + extra);
  const starts = allStarts.slice(extra);
  const nextMonday = new Date(allStarts[allStarts.length - 1].getTime() + WEEK);

  // --- Contributions séance par séance
  const runItems = runs.map((r) => ({ date: new Date(r.date), feeling: r.feeling ?? null, distance: r.distance || 0, ...runContribution(r, vma) }));
  const strengthItems = strength.map((s) => ({ date: new Date(s.date), feeling: s.feeling ?? null, ...strengthContribution(s) }));

  // --- Charge par semaine (toutes semaines, historique compris)
  const loadRun = allStarts.map(() => 0);
  const loadStrength = allStarts.map(() => 0);
  for (const r of runItems) {
    const i = weekIndexOf(allStarts, r.date);
    if (i >= 0) loadRun[i] += r.load;
  }
  for (const s of strengthItems) {
    const i = weekIndexOf(allStarts, s.date);
    if (i >= 0) loadStrength[i] += s.load;
  }
  const loadTotal = loadRun.map((v, i) => v + loadStrength[i]);

  // Charge habituelle d'une semaine = moyenne des 4 semaines qui la précèdent.
  const habitual = allStarts.map((_, i) => (i >= 4 ? mean(loadTotal.slice(i - 4, i)) : null));

  // --- Ce qui reste prévu cette semaine, et la semaine prochaine
  const nowT = now.getTime();
  const thisMonday = allStarts[allStarts.length - 1].getTime();
  let remaining = 0;
  const next = { load: 0, count: 0, intense: 0 };
  for (const p of planned) {
    if (p.status !== 'planned') continue;
    const t = new Date(p.date).getTime();
    const { load, intense } = plannedLoad(p, vma);
    if (t >= thisMonday && t < nextMonday.getTime() && t >= nowT - DAY / 2) remaining += load;
    else if (t >= nextMonday.getTime() && t < nextMonday.getTime() + WEEK) {
      next.load += load;
      next.count += 1;
      if (intense) next.intense += 1;
    }
  }
  // Semaine prochaine : sa zone vient des 4 dernières semaines complètes. La
  // semaine en cours n'y entre pas : un jeudi, elle n'est qu'à moitié faite et
  // ferait baisser la zone à tort.
  const nextHabitual = mean(loadTotal.slice(-5, -1));
  const band = nextHabitual ? { low: round(nextHabitual * SETTINGS.ratioRested), high: round(nextHabitual * SETTINGS.ratioLoaded) } : null;

  // --- Forme du moment
  const acuteStart = nowT - WEEK;
  const acute = [...runItems, ...strengthItems].filter((x) => x.date.getTime() > acuteStart && x.date.getTime() <= nowT).reduce((s, x) => s + x.load, 0);
  const chronicWeekly = [...runItems, ...strengthItems].filter((x) => x.date.getTime() > nowT - 4 * WEEK && x.date.getTime() <= nowT).reduce((s, x) => s + x.load, 0) / 4;
  const everything = [...runItems, ...strengthItems].sort((a, b) => a.date - b.date);
  const firstDate = everything.length ? everything[0].date : null;
  const lastDate = everything.length ? everything[everything.length - 1].date : null;
  // `activity` : première et dernière séance de tout l'historique, quand on les
  // connaît (les séances chargées ne couvrent que quelques semaines).
  const first = activity?.first ? new Date(activity.first) : firstDate;
  const last = activity?.last ? new Date(activity.last) : lastDate;
  const historyDays = first ? (nowT - first.getTime()) / DAY : 0;
  const daysSinceActivity = last ? Math.floor((nowT - last.getTime()) / DAY) : null;

  // FC à allure d'endurance, semaine par semaine. L'habitude se prend sur la
  // fenêtre fixe de la forme, pas sur la période affichée.
  const hrWeeklyOver = (weekList) => {
    const byWeek = weekList.map(() => []);
    for (const r of runItems) {
      const i = weekIndexOf(weekList, r.date);
      if (i >= 0) byWeek[i].push(...r.easyHr);
    }
    return byWeek.map((list) => (list.length >= SETTINGS.easyHrMinSplits ? round(median(list)) : null));
  };
  const hrWeekly = hrWeeklyOver(allStarts);
  const hrForm = hrWeeklyOver(weekStarts(now, SETTINGS.formHistoryWeeks));
  // Habitude = médiane des semaines d'avant les 3 dernières.
  const hrBaseline = median(hrForm.slice(0, -3).filter((v) => v != null));
  const hrRecent = mean(hrForm.slice(-2).filter((v) => v != null));
  const hrDrift = hrBaseline != null && hrRecent != null ? round(hrRecent - hrBaseline, 1) : null;

  // Ressenti : 7 derniers jours face aux 21 jours d'avant
  const feelings = everything.filter((x) => x.feeling != null);
  const feelingNow = mean(feelings.filter((x) => x.date.getTime() > nowT - WEEK).map((x) => x.feeling));
  const feelingBefore = mean(feelings.filter((x) => x.date.getTime() > nowT - 4 * WEEK && x.date.getTime() <= nowT - WEEK).map((x) => x.feeling));

  const form = formState({ acute, chronicWeekly, historyDays, daysSinceActivity, hrDrift, feelingNow, feelingBefore });
  form.acute = round(acute);
  form.habitual = round(chronicWeekly);
  form.daysSinceActivity = daysSinceActivity;
  form.historyDays = Math.floor(historyDays);

  // --- Ressenti, point par point sur la période affichée, et moyenne glissante
  const periodStart = starts[0].getTime();
  const feelingPoints = feelings
    .filter((x) => x.date.getTime() >= periodStart)
    .map((x) => ({ date: x.date.toISOString(), value: x.feeling, sport: runItems.includes(x) ? 'run' : 'strength' }));
  const feelingAverage = feelingPoints.map((p) => {
    const t = new Date(p.date).getTime();
    return { date: p.date, value: round(mean(feelings.filter((x) => x.date.getTime() > t - WEEK && x.date.getTime() <= t).map((x) => x.feeling)), 1) };
  });

  // --- Course : km par zone et chiffres de la période
  const kmByWeek = starts.map(() => ({ easy: 0, tempo: 0, hard: 0 }));
  let longest = 0;
  for (const r of runItems) {
    const i = weekIndexOf(starts, r.date);
    if (i < 0) continue;
    for (const z of ['easy', 'tempo', 'hard']) kmByWeek[i][z] += r.km[z];
    longest = Math.max(longest, r.distance);
  }
  const kmTotals = kmByWeek.reduce((s, w) => ({ easy: s.easy + w.easy, tempo: s.tempo + w.tempo, hard: s.hard + w.hard }), { easy: 0, tempo: 0, hard: 0 });
  const kmSum = kmTotals.easy + kmTotals.tempo + kmTotals.hard;
  const completedWeeks = Math.max(1, starts.length - 1);

  // --- Muscu
  const exercises = exerciseProgress(strength, starts, now);
  const tonnage = starts.map(() => 0);
  for (const s of strength) {
    const i = weekIndexOf(starts, s.date);
    if (i < 0) continue;
    for (const e of s.exercises || []) for (const set of e.sets || []) tonnage[i] += (set.weight || 0) * (set.reps || 0);
  }
  const rpeNow = mean(strength.filter((s) => new Date(s.date).getTime() > nowT - WEEK).map(sessionRpe));
  const rpeBefore = mean(strength.filter((s) => { const t = new Date(s.date).getTime(); return t > nowT - 4 * WEEK && t <= nowT - WEEK; }).map(sessionRpe));
  const tonnageAvg = mean(tonnage.slice(0, -1).filter((v) => v > 0));
  // Les 7 derniers jours plutôt que la semaine en cours : un mardi, la semaine
  // n'a souvent pas encore de séance et afficherait 0.
  const tonnage7d = strength
    .filter((s) => new Date(s.date).getTime() > nowT - WEEK)
    .reduce((sum, s) => sum + (s.exercises || []).reduce((a, e) => a + (e.sets || []).reduce((b, set) => b + (set.weight || 0) * (set.reps || 0), 0), 0), 0);

  // --- Objectif
  const raceInDays = competition ? Math.ceil((new Date(competition.date).getTime() - nowT) / DAY) : null;

  const labels = starts.map(isoWeekLabel);
  const shown = (arr) => arr.slice(extra);

  return {
    generatedAt: now.toISOString(),
    athlete: { id: String(athlete._id), firstName: athlete.firstName, lastName: athlete.lastName, vma },
    goal: competition ? { name: competition.name, date: competition.date, daysLeft: raceInDays } : null,
    sports: { run: runItems.length > 0, strength: strengthItems.length > 0 },
    form: { ...form, hrDrift, feelingNow: round(feelingNow, 1), feelingBefore: round(feelingBefore, 1) },
    load: {
      weeks: labels.map((label, i) => ({
        label,
        start: localDay(starts[i]),
        run: round(shown(loadRun)[i]),
        strength: round(shown(loadStrength)[i]),
        total: round(shown(loadTotal)[i]),
        habitual: round(shown(habitual)[i]),
        low: shown(habitual)[i] ? round(shown(habitual)[i] * SETTINGS.ratioRested) : null,
        high: shown(habitual)[i] ? round(shown(habitual)[i] * SETTINGS.ratioLoaded) : null
      })),
      currentRemaining: round(remaining),
      next: { label: isoWeekLabel(nextMonday), start: localDay(nextMonday), load: round(next.load), sessions: next.count, intense: next.intense, habitual: round(nextHabitual), ...(band || { low: null, high: null }) }
    },
    run: {
      hasSplits: runItems.some((r) => r.hasSplits),
      easyHr: {
        paceRange: vma ? { from: 3600 / (vma * SETTINGS.easyHrMax / 100), to: 3600 / (vma * SETTINGS.easyHrMin / 100) } : null,
        weeks: labels.map((label, i) => ({ label, value: shown(hrWeekly)[i] })),
        baseline: round(hrBaseline),
        drift: hrDrift
      },
      km: {
        weeks: labels.map((label, i) => ({ label, easy: round(kmByWeek[i].easy, 1), tempo: round(kmByWeek[i].tempo, 1), hard: round(kmByWeek[i].hard, 1) })),
        averagePerWeek: round(kmSum / completedWeeks, 1),
        easyShare: kmSum ? round((kmTotals.easy / kmSum) * 100) : null,
        hardShare: kmSum ? round((kmTotals.hard / kmSum) * 100) : null,
        longest: longest ? round(longest, 1) : null
      },
      cues: runCues({ form, band, nextWeek: next, raceInDays, firstName: athlete.firstName })
    },
    strength: {
      tonnage: labels.map((label, i) => ({ label, value: round(tonnage[i]) })),
      tonnageAverage: round(tonnageAvg),
      tonnage7d: round(tonnage7d),
      rpeNow: round(rpeNow, 1),
      rpeBefore: round(rpeBefore, 1),
      exercises: exercises.slice(0, 8),
      progressing: exercises.filter((e) => e.trend?.direction === 'up').length,
      cues: strengthCues({ exercises, rpeNow, form })
    },
    feeling: { points: feelingPoints, average: feelingAverage, now: round(feelingNow, 1), before: round(feelingBefore, 1) }
  };
}

// ---------------------------------------------------------------------------
// Accès base
// ---------------------------------------------------------------------------

const RUN_FIELDS = 'date distance duration averagePace sessionType feeling stravaData.splits';
const STRENGTH_FIELDS = 'date duration feeling exercises.exercise exercises.sets';

async function computeAthleteForm(athleteId, { weeks = 8, now = new Date() } = {}) {
  const athlete = await User.findById(athleteId).select('firstName lastName vma').lean();
  if (!athlete) return null;
  const from = weekStarts(now, Math.max(weeks + 4, SETTINGS.formHistoryWeeks))[0];
  const until = new Date(mondayOf(now).getTime() + 2 * WEEK);

  const [runs, strength, planned, competition, [activity]] = await Promise.all([
    Run.find({ user: athleteId, date: { $gte: from, $lte: now } }).select(RUN_FIELDS).lean(),
    StrengthSession.find({ user: athleteId, date: { $gte: from, $lte: now } }).select(STRENGTH_FIELDS).populate('exercises.exercise', 'name').lean(),
    PlannedRun.find({ user: athleteId, date: { $gte: mondayOf(now), $lt: until } })
      .select('date status activityType sessionType targetDistance targetDuration targetPace runBlocks strengthPlan.estimatedDuration')
      .lean(),
    Competition.findOne({ user: athleteId, status: 'upcoming', date: { $gte: now } }).sort({ priority: 1, date: 1 }).select('name date').lean(),
    activitySpans([athlete._id], now)
  ]);

  return buildForm({ athlete, runs, strength, planned, competition, activity, now, weeks });
}

/** Première et dernière séance (course ou muscu) de chaque athlète, sur tout l'historique. */
async function activitySpans(athleteIds, now) {
  const group = { $group: { _id: '$user', first: { $min: '$date' }, last: { $max: '$date' } } };
  const match = { $match: { user: { $in: athleteIds }, date: { $lte: now } } };
  const [runs, strength] = await Promise.all([Run.aggregate([match, group]), StrengthSession.aggregate([match, group])]);
  return athleteIds.map((id) => {
    const rows = [...runs, ...strength].filter((row) => String(row._id) === String(id));
    if (!rows.length) return { first: null, last: null };
    return {
      first: new Date(Math.min(...rows.map((row) => new Date(row.first).getTime()))),
      last: new Date(Math.max(...rows.map((row) => new Date(row.last).getTime())))
    };
  });
}

/**
 * La forme de plusieurs athlètes d'un coup, pour la liste de l'écran : les
 * séances de tout le monde en deux requêtes, puis exactement le même calcul
 * que la fiche, pour que la liste et la fiche ne se contredisent jamais.
 */
async function computeFormSummaries(athleteIds, now = new Date()) {
  if (!athleteIds.length) return [];
  const from = weekStarts(now, SETTINGS.formHistoryWeeks)[0];
  const [athletes, runs, strength, spans] = await Promise.all([
    User.find({ _id: { $in: athleteIds } }).select('firstName lastName vma').lean(),
    Run.find({ user: { $in: athleteIds }, date: { $gte: from, $lte: now } }).select('user ' + RUN_FIELDS).lean(),
    StrengthSession.find({ user: { $in: athleteIds }, date: { $gte: from, $lte: now } }).select('user ' + STRENGTH_FIELDS).lean(),
    activitySpans(athleteIds, now)
  ]);
  const byId = new Map(athletes.map((a) => [String(a._id), a]));
  const recent = now.getTime() - 4 * WEEK;

  return athleteIds.map((id, index) => {
    const key = String(id);
    const athlete = byId.get(key) || { _id: id, vma: null };
    const mine = runs.filter((r) => String(r.user) === key);
    const lifts = strength.filter((s) => String(s.user) === key);
    const { form } = buildForm({ athlete, runs: mine, strength: lifts, planned: [], competition: null, activity: spans[index], now, weeks: 4 });
    return {
      athleteId: key,
      state: form.state,
      ratio: form.ratio,
      daysSinceActivity: form.daysSinceActivity,
      sports: {
        run: mine.some((r) => new Date(r.date).getTime() >= recent),
        strength: lifts.some((s) => new Date(s.date).getTime() >= recent)
      }
    };
  });
}

module.exports = {
  SETTINGS,
  computeAthleteForm,
  computeFormSummaries,
  // exportés pour les tests
  buildForm,
  formState,
  runContribution,
  strengthContribution,
  plannedLoad,
  e1rm,
  exerciseProgress,
  freeDurationToMinutes,
  weekStarts,
  isoWeekLabel
};
