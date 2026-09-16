// Options du profil coach (identiques au web : web-app/src/app/pages/coach/coach-profile).

export const DISCIPLINE_OPTIONS = [
  { value: 'running', label: 'Course à pied' },
  { value: 'trail', label: 'Trail' },
  { value: 'triathlon', label: 'Triathlon' },
  { value: 'marathon', label: 'Marathon' },
  { value: 'ultra', label: 'Ultra-trail' },
  { value: 'track', label: 'Piste / Athlétisme' },
  { value: 'cross', label: 'Cross-country' },
  { value: 'fitness', label: 'Fitness / Renforcement' },
  { value: 'hyrox', label: 'Hyrox' },
  { value: 'prep_physique', label: 'Prépa physique' },
  { value: 'cycling', label: 'Cyclisme' },
  { value: 'swimming', label: 'Natation' },
] as const;

export const DIPLOMA_OPTIONS = [
  { value: 'bpjeps', label: 'BPJEPS' },
  { value: 'dejeps', label: 'DEJEPS' },
  { value: 'desjeps', label: 'DESJEPS' },
  { value: 'staps', label: 'Licence/Master STAPS' },
  { value: 'ffa', label: 'Diplôme FFA' },
  { value: 'fftri', label: 'Diplôme FFTri' },
  { value: 'cqp', label: 'CQP ALS' },
  { value: 'other', label: 'Autre certification' },
] as const;

export const optionLabel = (options: readonly { value: string; label: string }[], value: string) => options.find((option) => option.value === value)?.label ?? value;
