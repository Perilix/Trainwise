import type { ChipTone } from '@/components/ui';

/**
 * La forme d'un athlète, telle que l'API la calcule (api/src/services/athleteForm.service.js).
 * Même fichier que web-app/src/app/domain/form.ts, aux teintes près : garder les deux alignés.
 * Charge en « points » : une minute d'endurance = 1, au seuil = 2, en VMA = 3.
 */

export type FormState = 'rested' | 'optimal' | 'loaded' | 'overreached' | 'inactive' | 'unknown';

export type FormCue = { kind: 'down' | 'keep' | 'up'; title: string; detail: string };

export type ApiFormSummary = {
  athleteId: string;
  state: FormState;
  ratio: number | null;
  daysSinceActivity: number | null;
  sports: { run: boolean; strength: boolean };
};

export type ApiFormExercise = {
  id: string;
  name: string;
  weighted: boolean;
  count: number;
  last: { weight: number; reps: number; rpe: number | null; date: string };
  lastHeaviest: { weight: number; reps: number; rpe: number | null } | null;
  current: number | null;
  trend: { pct: number; direction: 'up' | 'flat' | 'down' } | null;
  weekly: (number | null)[];
  heavyRpe: (number | null)[];
  flatWeeks: number;
};

export type ApiAthleteForm = {
  generatedAt: string;
  athlete: { id: string; firstName: string; lastName: string; vma: number | null };
  goal: { name: string; date: string; daysLeft: number } | null;
  sports: { run: boolean; strength: boolean };
  form: {
    state: FormState;
    ratio: number | null;
    position: number | null;
    signals: ('hr' | 'feeling')[];
    acute: number | null;
    habitual: number | null;
    daysSinceActivity: number | null;
    historyDays: number;
    hrDrift: number | null;
    feelingNow: number | null;
    feelingBefore: number | null;
  };
  load: {
    weeks: { label: string; start: string; run: number; strength: number; total: number; habitual: number | null; low: number | null; high: number | null }[];
    currentRemaining: number;
    next: { label: string; start: string; load: number; sessions: number; intense: number; habitual: number | null; low: number | null; high: number | null };
  };
  run: {
    hasSplits: boolean;
    easyHr: { paceRange: { from: number; to: number } | null; weeks: { label: string; value: number | null }[]; baseline: number | null; drift: number | null };
    km: {
      weeks: { label: string; easy: number; tempo: number; hard: number }[];
      averagePerWeek: number | null;
      easyShare: number | null;
      hardShare: number | null;
      longest: number | null;
    };
    cues: FormCue[];
  };
  strength: {
    tonnage: { label: string; value: number }[];
    tonnageAverage: number | null;
    tonnage7d: number;
    rpeNow: number | null;
    rpeBefore: number | null;
    exercises: ApiFormExercise[];
    progressing: number;
    cues: FormCue[];
  };
  feeling: {
    points: { date: string; value: number; sport: 'run' | 'strength' }[];
    average: { date: string; value: number | null }[];
    now: number | null;
    before: number | null;
  };
};

/** Libellé et teinte de chaque état, repris partout (liste, en-tête, carte). */
export const FORM_STATE_STYLE: Record<FormState, { label: string; tone: ChipTone; order: number }> = {
  overreached: { label: 'Surmené', tone: 'danger', order: 0 },
  loaded: { label: 'Chargé', tone: 'warning', order: 1 },
  inactive: { label: 'Inactif', tone: 'neutral', order: 2 },
  rested: { label: 'Reposé', tone: 'accent', order: 3 },
  optimal: { label: 'Dans la zone', tone: 'success', order: 4 },
  unknown: { label: 'À découvrir', tone: 'neutral', order: 5 },
};

/** Le verdict en une phrase, d'après l'état et ce qui l'explique. */
export function formHeadline(form: ApiAthleteForm['form']): { title: string; sentence: string } {
  const pct = form.ratio != null ? Math.round((form.ratio - 1) * 100) : null;
  const load =
    pct == null ? '' : pct > 5 ? `Sa charge des 7 derniers jours est ${pct} % au-dessus de son habitude` : pct < -5 ? `Sa charge des 7 derniers jours est ${-pct} % sous son habitude` : 'Sa charge des 7 derniers jours est dans son habitude';
  const extra: string[] = [];
  if (form.signals.includes('hr') && form.hrDrift != null) extra.push(`sa FC en endurance a pris ${fmt(form.hrDrift)} bpm`);
  if (form.signals.includes('feeling') && form.feelingNow != null) extra.push(`son ressenti est tombé à ${fmt(form.feelingNow)}/10`);
  const sentence = [load, extra.join(' et ')].filter(Boolean).join(', et ') + '.';

  switch (form.state) {
    case 'overreached':
      return { title: 'Surmené, à soulager tout de suite', sentence };
    case 'loaded':
      return { title: 'Chargé, à alléger quelques jours', sentence };
    case 'optimal':
      return { title: 'Dans la zone de progression', sentence };
    case 'rested':
      return { title: 'Reposé, il y a de la marge', sentence };
    case 'inactive':
      return { title: 'Plus d’activité récente', sentence: `Aucune séance depuis ${form.daysSinceActivity ?? '?'} jours.` };
    default:
      return {
        title: 'On apprend encore son rythme',
        sentence: `Il faut 3 semaines d’historique pour situer sa charge : on en a ${form.historyDays} jour${form.historyDays > 1 ? 's' : ''}.`,
      };
  }
}

/** 1.5 → « 1,5 » ; les entiers restent entiers. */
export function fmt(value: number | null | undefined, digits = 1): string {
  if (value == null || !isFinite(value)) return '—';
  const rounded = Number(value.toFixed(digits));
  return String(rounded).replace('.', ',');
}

/** Écart signé, « +6 » / « −2,9 ». */
export function signed(value: number | null | undefined, digits = 1): string {
  if (value == null || !isFinite(value)) return '—';
  const text = fmt(Math.abs(value), digits);
  return value > 0 ? `+${text}` : value < 0 ? `−${text}` : text;
}

/** 330 → « 5′30 ». */
export function paceLabel(secondsPerKm: number): string {
  const total = Math.round(secondsPerKm);
  return `${Math.floor(total / 60)}′${String(total % 60).padStart(2, '0')}`;
}
