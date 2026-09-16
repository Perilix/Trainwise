// Séances structurées sur le modèle Trainwise (échauffement, étapes, blocs à répéter, récupération, retour au calme)
// et calculs d'allure depuis la VMA.

export type PaceStep = {
  dist?: number; // mètres
  dur?: number; // secondes
  pct: number; // % VMA
  zone?: string;
};

export type SessionBlock =
  | ({ type: 'warmup' | 'cooldown' | 'steady' } & PaceStep)
  | { type: 'repeat'; reps: number; work: PaceStep; rest?: PaceStep };

export type Segment = {
  kind: 'warmup' | 'cooldown' | 'steady' | 'work' | 'rest';
  sec: number;
  pct: number;
  dist: number;
  block: number;
};

/** Allure en secondes par km pour un pourcentage de VMA (km/h). */
export const paceFor = (vma: number, pct: number) => 3600 / ((vma * pct) / 100);

export const formatPace = (secondsPerKm: number) =>
  `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, '0')}`;

export const formatKm = (meters: number) => `${(meters / 1000).toFixed(1).replace('.', ',')} km`;

export function formatDuration(totalSeconds: number) {
  const sec = Math.round(totalSeconds);
  if (sec >= 3600) return `${Math.floor(sec / 3600)} h ${String(Math.round((sec % 3600) / 60)).padStart(2, '0')}`;
  if (sec < 60) return `${sec} s`;
  if (sec % 60 === 0 || sec >= 600) return `${Math.round(sec / 60)} min`;
  return `${Math.floor(sec / 60)}′${String(sec % 60).padStart(2, '0')}″`;
}

/** Déplie une structure en segments (répétitions comprises) pour une VMA donnée. */
export function expand(structure: readonly SessionBlock[], vma: number): Segment[] {
  const segments: Segment[] = [];
  const push = (kind: Segment['kind'], step: PaceStep, block: number) => {
    const sec = step.dur ?? ((step.dist ?? 0) / 1000) * paceFor(vma, step.pct);
    segments.push({ kind, sec, pct: step.pct, dist: step.dist ?? (sec / paceFor(vma, step.pct)) * 1000, block });
  };
  structure.forEach((block, index) => {
    if (block.type !== 'repeat') {
      push(block.type, block, index);
      return;
    }
    for (let rep = 0; rep < block.reps; rep++) {
      push('work', block.work, index);
      if (block.rest && rep < block.reps - 1) push('rest', block.rest, index);
    }
  });
  return segments;
}

export const totals = (segments: readonly Segment[]) =>
  segments.reduce((sum, segment) => ({ sec: sum.sec + segment.sec, dist: sum.dist + segment.dist }), { sec: 0, dist: 0 });

/** Couleur d'intensité dans la rampe du thème (5 paliers). */
export function intensityColor(pct: number, ramp: readonly string[]) {
  if (pct >= 95) return ramp[4];
  if (pct >= 84) return ramp[3];
  if (pct >= 78) return ramp[2];
  if (pct >= 68) return ramp[1];
  return ramp[0];
}

export const intensityHeight = (pct: number, height: number) => Math.max(4, ((pct - 40) / 75) * height);

export const INTENSITY_LEVELS = ['Endurance, récup', 'Marathon', 'Semi, seuil', '10K, 5K', 'VMA, vitesse'] as const;

// Exemples utilisés par l'écran système (en attendant les données de l'API).
export const SAMPLE_STRUCTURES = {
  vma12x400: [
    { type: 'warmup', dur: 1200, pct: 60, zone: 'Endurance fondamentale' },
    { type: 'repeat', reps: 12, work: { dist: 400, pct: 100, zone: 'VMA' }, rest: { dur: 75, pct: 50, zone: 'Récupération passive' } },
    { type: 'cooldown', dur: 600, pct: 60, zone: 'Endurance fondamentale' },
  ],
  seuil3x3: [
    { type: 'warmup', dur: 1200, pct: 60, zone: 'Endurance fondamentale' },
    { type: 'repeat', reps: 3, work: { dist: 3000, pct: 83, zone: 'Seuil' }, rest: { dur: 180, pct: 50, zone: 'Récupération passive' } },
    { type: 'cooldown', dur: 600, pct: 60, zone: 'Endurance fondamentale' },
  ],
} satisfies Record<string, SessionBlock[]>;
