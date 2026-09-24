/**
 * Vérifie le calcul de forme sur des données fabriquées — sans base.
 *
 *   npm run form:check           → contrôles, puis un résumé lisible
 *   npm run form:check -- --json → la réponse complète de l'API, en JSON
 *
 * Trois athlètes types : une qui s'est surchargée (charge qui grimpe, FC qui
 * dérive, ressenti en baisse, squat qui plafonne), un régulier, et une qui
 * vient d'arriver (pas assez d'historique pour conclure).
 */
const assert = require('assert');
const { buildForm, formState, e1rm, freeDurationToMinutes, plannedLoad } = require('../services/athleteForm.service');

const NOW = new Date('2026-09-24T18:00:00');
const DAY = 24 * 60 * 60 * 1000;
const VMA = 15; // km/h

const daysAgo = (n, hour = 8) => {
  const d = new Date(NOW.getTime() - n * DAY);
  d.setHours(hour, 0, 0, 0);
  return d;
};

/** Une sortie au km près : `pcts` = % de VMA de chaque km, `hr` = FC de chaque km. */
const run = (date, pcts, hr, feeling, sessionType = 'endurance') => {
  const splits = pcts.map((pct, i) => {
    const speed = (VMA * pct) / 100 / 3.6;
    return { split: i + 1, distance: 1000, movingTime: 1000 / speed, averageSpeed: speed, averageHeartrate: hr[i] ?? null, elevationDifference: 2 };
  });
  const seconds = splits.reduce((s, x) => s + x.movingTime, 0);
  return { date, distance: pcts.length, duration: seconds / 60, sessionType, feeling, stravaData: { splits } };
};

const strength = (date, exercises, feeling, duration = 60) => ({ date, duration, feeling, exercises });
const ex = (id, name, sets) => ({ exercise: { _id: id, name }, sets: sets.map(([weight, reps, rpe]) => ({ weight, reps, rpe })) });

// --- Léa : prépa semi, se surcharge sur les 2 dernières semaines -----------
function lea() {
  const runs = [];
  const sessions = [];
  for (let week = 11; week >= 0; week--) {
    const base = week * 7 + 1;
    const ramp = week <= 1 ? 1.45 : 1; // les deux dernières semaines montent fort
    const drift = week <= 2 ? (3 - week) * 2.5 : 0; // FC en endurance qui monte
    const km = Math.round(8 * ramp);
    runs.push(run(daysAgo(base + 5), Array(km).fill(62), Array(km).fill(146 + drift), week <= 1 ? 4 : 7));
    runs.push(run(daysAgo(base + 3), [62, 62, 90, 90, 90, 90, 62, 62], [145, 147, 170, 172, 173, 174, 150, 148], week <= 1 ? 5 : 8, 'fractionne'));
    runs.push(run(daysAgo(base + 1), Array(Math.round(14 * ramp)).fill(64), Array(Math.round(14 * ramp)).fill(148 + drift), week <= 1 ? 4 : 7, 'sortie_longue'));
    const squat = week >= 3 ? 70 + (11 - week) * 2.5 : 90; // plafonne à 90 kg
    const rpe = week >= 3 ? 7 : 7.5 + (3 - week) * 0.5;
    sessions.push(strength(daysAgo(base + 4, 18), [
      ex('squat', 'Squat', [[squat, 5, rpe], [squat, 5, rpe], [squat, 5, rpe + 0.5]]),
      ex('bench', 'Développé couché', [[35 + (11 - week), 6, 7], [35 + (11 - week), 6, 7]]),
      ex('pullup', 'Tractions', [[0, 4 + Math.floor((11 - week) / 4), 8]])
    ], week <= 1 ? 5 : 7));
  }
  // Semaine prochaine : trop chargée
  const nextMonday = new Date('2026-09-28T08:00:00');
  const planned = [
    { date: new Date(nextMonday.getTime() + DAY), status: 'planned', activityType: 'running', sessionType: 'fractionne', runBlocks: [
      { role: 'warmup', mode: 'duration', duration: 20, pace: '6:25' },
      { role: 'main', mode: 'distance', distance: 0.4, pace: '4:15', repetitions: 10, recoveryMode: 'duration', recoveryDuration: '1min30' },
      { role: 'cooldown', mode: 'duration', duration: 15, pace: '6:30' }
    ] },
    { date: new Date(nextMonday.getTime() + 3 * DAY), status: 'planned', activityType: 'running', sessionType: 'tempo', targetDuration: 60 },
    { date: new Date(nextMonday.getTime() + 4 * DAY), status: 'planned', activityType: 'running', sessionType: 'endurance', targetDuration: 60 },
    { date: new Date(nextMonday.getTime() + 6 * DAY), status: 'planned', activityType: 'running', sessionType: 'sortie_longue', targetDuration: 120 },
    { date: new Date(nextMonday.getTime() + 2 * DAY), status: 'planned', activityType: 'strength', sessionType: 'lower_body', strengthPlan: { estimatedDuration: 60 } }
  ];
  return {
    athlete: { _id: 'lea', firstName: 'Léa', lastName: 'Martin', vma: VMA },
    runs,
    strength: sessions,
    planned,
    competition: { name: 'Semi-marathon de Lyon', date: new Date('2026-10-26T09:00:00') }
  };
}

// --- Thomas : régulier ---------------------------------------------------
function thomas() {
  const runs = [];
  for (let week = 11; week >= 0; week--) {
    const base = week * 7 + 1;
    runs.push(run(daysAgo(base + 4), Array(10).fill(62), Array(10).fill(144), 8));
    runs.push(run(daysAgo(base + 1), Array(12).fill(63), Array(12).fill(145), 8, 'sortie_longue'));
  }
  return { athlete: { _id: 'thomas', firstName: 'Thomas', lastName: 'Bernard', vma: 16 }, runs, strength: [], planned: [], competition: null };
}

// --- Nora : arrivée il y a 10 jours --------------------------------------
function nora() {
  return {
    athlete: { _id: 'nora', firstName: 'Nora', lastName: 'Diallo', vma: null },
    runs: [{ date: daysAgo(8), distance: 6, duration: 36, averagePace: '6:00', sessionType: 'endurance', feeling: 7 }, { date: daysAgo(3), distance: 7, duration: 42, feeling: 7 }],
    strength: [],
    planned: [],
    competition: null
  };
}

// ---------------------------------------------------------------------------
const results = { lea: buildForm({ ...lea(), now: NOW, weeks: 8 }), thomas: buildForm({ ...thomas(), now: NOW, weeks: 8 }), nora: buildForm({ ...nora(), now: NOW, weeks: 8 }) };

if (process.argv.includes('--json')) {
  process.stdout.write(JSON.stringify(results[process.argv[process.argv.indexOf('--json') + 1]] || results.lea, null, 2) + '\n');
  process.exit(0);
}

// Outils
assert.strictEqual(Math.round(e1rm(100, 5)), 117);
assert.strictEqual(e1rm(60, 15), null, 'au-delà de 10 répétitions, pas d’estimation');
assert.strictEqual(freeDurationToMinutes('1min30'), 1.5);
assert.strictEqual(freeDurationToMinutes('90s'), 1.5);
assert.strictEqual(freeDurationToMinutes('2 min'), 2);
assert.strictEqual(freeDurationToMinutes('1:30'), 1.5);
assert.ok(plannedLoad({ activityType: 'running', runBlocks: [{ mode: 'duration', duration: 60, pace: '6:25' }] }, VMA).load >= 55, 'une heure en endurance ≈ 60 pts');

// Forme : bornes
assert.strictEqual(formState({ acute: 100, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1 }).state, 'optimal');
assert.strictEqual(formState({ acute: 70, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1 }).state, 'rested');
assert.strictEqual(formState({ acute: 140, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1 }).state, 'loaded');
assert.strictEqual(formState({ acute: 160, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1 }).state, 'overreached');
assert.strictEqual(formState({ acute: 120, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1, hrDrift: 6, feelingNow: 4, feelingBefore: 7 }).state, 'loaded', 'deux signaux : un cran de plus');
assert.strictEqual(formState({ acute: 120, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 1, hrDrift: 6 }).state, 'optimal', 'un seul signal ne suffit pas');
assert.strictEqual(formState({ acute: 0, chronicWeekly: 100, historyDays: 60, daysSinceActivity: 12 }).state, 'inactive');
assert.strictEqual(formState({ acute: 50, chronicWeekly: 50, historyDays: 10, daysSinceActivity: 1 }).state, 'unknown');

// Léa
const L = results.lea;
assert.ok(['loaded', 'overreached'].includes(L.form.state), `Léa devrait être chargée, elle est ${L.form.state}`);
assert.ok(L.form.hrDrift >= 4, 'la FC de Léa dérive');
assert.ok(L.load.next.load > L.load.next.high, 'sa semaine prochaine dépasse la zone');
assert.ok(L.run.cues.some((c) => c.kind === 'down'), 'un repère pour baisser');
assert.ok(L.run.cues.some((c) => /séance intense/.test(c.title)), 'un repère sur les séances intenses');
const squat = L.strength.exercises.find((e) => e.id === 'squat');
assert.ok(squat && squat.trend.direction === 'flat', 'le squat stagne');
assert.ok(L.strength.cues.some((c) => /squat.*décharge/i.test(c.title)), 'un repère de décharge sur le squat');
const bench = L.strength.exercises.find((e) => e.id === 'bench');
assert.strictEqual(bench.trend.direction, 'up', 'le développé couché progresse');
assert.strictEqual(L.load.weeks.length, 8);
for (const weeks of [4, 13, 26]) {
  const other = buildForm({ ...lea(), now: NOW, weeks });
  assert.strictEqual(other.form.state, L.form.state, `la forme ne dépend pas de la période affichée (${weeks} sem.)`);
  assert.strictEqual(other.form.hrDrift, L.form.hrDrift);
}

// Thomas
assert.strictEqual(results.thomas.form.state, 'optimal');
assert.ok(results.thomas.run.cues.some((c) => /Rien de planifié/.test(c.title)));

// Nora
assert.strictEqual(results.nora.form.state, 'unknown');
assert.deepStrictEqual(results.nora.run.cues, []);

process.stdout.write('Tous les contrôles passent.\n\n');
for (const [key, r] of Object.entries(results)) {
  process.stdout.write(`${r.athlete.firstName} : ${r.form.state} (rapport ${r.form.ratio ?? '—'}, 7 j = ${r.form.acute} pts, habitude = ${r.form.habitual} pts/sem.)\n`);
  process.stdout.write(`  FC endurance : habitude ${r.run.easyHr.baseline ?? '—'} bpm, dérive ${r.run.easyHr.drift ?? '—'} · ressenti ${r.feeling.now ?? '—'} (avant ${r.feeling.before ?? '—'})\n`);
  process.stdout.write(`  Semaine prochaine ${r.load.next.label} : ${r.load.next.load} pts, zone ${r.load.next.low ?? '—'}–${r.load.next.high ?? '—'}\n`);
  for (const c of [...r.run.cues, ...r.strength.cues]) process.stdout.write(`  [${c.kind}] ${c.title} — ${c.detail}\n`);
  if (key !== 'nora') process.stdout.write('\n');
}
