/**
 * Détaille la charge d'un athlète, séance par séance — lecture seule.
 *
 *   npm run form:explain -- julien@x.fr        → les 8 dernières semaines
 *   npm run form:explain -- julien@x.fr 12     → les 12 dernières
 *
 * Pour chaque semaine : sa charge (course + muscu), puis chaque séance avec
 * ce qui la compose (km par zone quand il y a les splits Strava, sinon la
 * durée × le facteur du type de séance). Sert à répondre à « pourquoi cette
 * semaine pèse moins que la précédente ? ». N'écrit rien en base.
 */
require('dotenv').config();
const mongoose = require('mongoose');

const User = require('../models/user.model');
const Run = require('../models/run.model');
const StrengthSession = require('../models/strengthSession.model');
const { runContribution, strengthContribution, weekStarts, isoWeekLabel, computeAthleteForm, SETTINGS } = require('../services/athleteForm.service');

const WEEK = 7 * 24 * 60 * 60 * 1000;
const out = (line = '') => process.stdout.write(line + '\n');
const n = (v, d = 0) => (v == null || !isFinite(v) ? '—' : Number(v).toFixed(d).replace('.', ','));
const day = (d) => new Date(d).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' });

async function main() {
  const email = process.argv[2];
  const weeks = Math.min(26, Math.max(2, Number(process.argv[3]) || 8));
  if (!email) {
    out('Usage : npm run form:explain -- <email> [semaines]');
    return;
  }
  await mongoose.connect(process.env.MONGODB_URI);

  const user = await User.findOne({ email: email.toLowerCase() }).select('firstName lastName vma role').lean();
  if (!user) {
    out(`Aucun utilisateur avec l'adresse ${email}.`);
    return;
  }
  const now = new Date();
  const starts = weekStarts(now, weeks);
  const [runs, strength] = await Promise.all([
    Run.find({ user: user._id, date: { $gte: starts[0], $lte: now } }).sort({ date: 1 }).lean(),
    StrengthSession.find({ user: user._id, date: { $gte: starts[0], $lte: now } }).sort({ date: 1 }).populate('exercises.exercise', 'name').lean()
  ]);

  out(`\n${user.firstName} ${user.lastName} · VMA ${user.vma ?? 'non renseignée'} km/h`);
  out(`Zones : endurance < ${SETTINGS.zoneTempo} % VMA ≤ seuil < ${SETTINGS.zoneVma} % ≤ VMA · facteurs ×1 / ×2 / ×3 par minute · muscu = minutes × RPE / 4`);
  out(`${runs.length} sorties et ${strength.length} séances de muscu sur ${weeks} semaines.\n`);

  for (let i = 0; i < starts.length; i++) {
    const from = starts[i].getTime();
    const to = from + WEEK;
    const inWeek = (d) => new Date(d).getTime() >= from && new Date(d).getTime() < to;
    const wr = runs.filter((r) => inWeek(r.date));
    const ws = strength.filter((s) => inWeek(s.date));
    const rc = wr.map((r) => ({ r, c: runContribution(r, user.vma) }));
    const sc = ws.map((s) => ({ s, c: strengthContribution(s) }));
    const runLoad = rc.reduce((a, x) => a + x.c.load, 0);
    const strLoad = sc.reduce((a, x) => a + x.c.load, 0);
    const km = rc.reduce((a, x) => a + (x.r.distance || 0), 0);
    const min = rc.reduce((a, x) => a + (x.r.duration || 0), 0);
    const current = i === starts.length - 1 ? ' (en cours)' : '';

    out(`━━ ${isoWeekLabel(starts[i])}${current} · du ${day(from)} · ${n(runLoad + strLoad)} pts  (course ${n(runLoad)} · muscu ${n(strLoad)})  ·  ${n(km, 1)} km en ${n(min)} min`);
    for (const { r, c } of rc) {
      const detail = c.hasSplits
        ? `splits : ${n(c.km.easy, 1)} km endurance, ${n(c.km.tempo, 1)} km seuil, ${n(c.km.hard, 1)} km VMA`
        : `sans splits → ${n(r.duration)} min × facteur « ${r.sessionType || 'inconnu'} »`;
      const hr = c.easyHr.length ? ` · FC endurance ${Math.round(c.easyHr.reduce((a, b) => a + b, 0) / c.easyHr.length)} bpm sur ${c.easyHr.length} km` : '';
      out(`   course  ${day(r.date).padEnd(14)} ${n(r.distance, 1).padStart(5)} km ${n(r.duration).padStart(4)} min  ${n(c.load).padStart(4)} pts  · ${detail}${hr}${r.feeling ? ` · ressenti ${r.feeling}/10` : ''}`);
    }
    for (const { s, c } of sc) {
      const sets = (s.exercises || []).reduce((a, e) => a + (e.sets?.length || 0), 0);
      out(`   muscu   ${day(s.date).padEnd(14)} ${String(sets).padStart(3)} séries ${n(s.duration || null).padStart(4)} min  ${n(c.load).padStart(4)} pts  · RPE moyen ${n(c.rpe, 1)}${s.duration ? '' : ' (durée estimée)'}${s.feeling ? ` · ressenti ${s.feeling}/10` : ''}`);
    }
    if (!wr.length && !ws.length) out('   (rien)');
    out();
  }

  const form = await computeAthleteForm(user._id, { weeks });
  out(`Forme calculée : ${form.form.state} · 7 j = ${form.form.acute} pts · habitude = ${form.form.habitual} pts/sem. · rapport ${form.form.ratio ?? '—'} · dérive FC ${form.form.hrDrift ?? '—'} bpm`);
}

main()
  .catch((error) => {
    process.stderr.write(`${error.stack || error}\n`);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
