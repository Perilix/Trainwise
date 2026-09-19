// Formats français (dates, durées, distances) sans dépendre du support Intl du moteur JS.

const DAYS_SHORT = ['Dim.', 'Lun.', 'Mar.', 'Mer.', 'Jeu.', 'Ven.', 'Sam.'];
const DAYS_LONG = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const MONTHS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
const MONTHS_SHORT = ['janv.', 'févr.', 'mars', 'avr.', 'mai', 'juin', 'juil.', 'août', 'sept.', 'oct.', 'nov.', 'déc.'];

export const WEEKDAY_INITIALS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;

const pad = (value: number) => String(value).padStart(2, '0');

/** "2026-09-13" → Date locale à minuit. */
export function parseDay(isoDay: string) {
  const [year, month, day] = isoDay.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}

export const toIsoDay = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;

/** "Dim. 31 août" */
export function formatDayShort(isoDay: string) {
  const date = parseDay(isoDay);
  return `${DAYS_SHORT[date.getDay()]} ${date.getDate()} ${MONTHS_SHORT[date.getMonth()]}`;
}

/** "Dimanche 13 septembre" */
export function formatDayLong(isoDay: string) {
  const date = parseDay(isoDay);
  return `${DAYS_LONG[date.getDay()]} ${date.getDate()} ${MONTHS[date.getMonth()]}`;
}

/** "MAR" (tuile de date) */
export const formatWeekdayTile = (isoDay: string) => DAYS_SHORT[parseDay(isoDay).getDay()].replace('.', '').toUpperCase();

/** "Septembre 2026" */
export function formatMonthYear(year: number, monthIndex: number) {
  const month = MONTHS[monthIndex];
  return `${month.charAt(0).toUpperCase()}${month.slice(1)} ${year}`;
}

export const formatMonthShort = (monthIndex: number) => MONTHS_SHORT[monthIndex];

/** 6760 s → "1:52:40" ; 2890 s → "48:10" */
export function formatClock(totalSeconds: number) {
  const sec = Math.round(totalSeconds);
  const hours = Math.floor(sec / 3600);
  const minutes = Math.floor((sec % 3600) / 60);
  const seconds = sec % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** 9360 s → "2 h 36" ; 3000 s → "50 min" */
export function formatHoursMinutes(totalSeconds: number) {
  const minutesTotal = Math.round(totalSeconds / 60);
  const hours = Math.floor(minutesTotal / 60);
  return hours > 0 ? `${hours} h ${pad(minutesTotal % 60)}` : `${minutesTotal} min`;
}

/** 21.1 → "21,1" */
export const formatDecimal = (value: number, digits = 1) => value.toFixed(digits).replace('.', ',');

/** "juin" */
export const formatMonthName = (monthIndex: number) => MONTHS[monthIndex];

/** "08:12" */
export const formatTime = (date: Date) => `${pad(date.getHours())}:${pad(date.getMinutes())}`;

/** "2 juin 2026" */
export const formatDayMonthYear = (date: Date) => `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;

/** Saisie numérique à la française : "12,5" → 12.5 ; vide ou invalide → undefined */
export function parseDecimal(value: string) {
  const parsed = Number(value.trim().replace(',', '.'));
  return value.trim() !== '' && Number.isFinite(parsed) ? parsed : undefined;
}

/** 320 s/km → "5:20" */
export const formatPace = (secondsPerKm: number) => `${Math.floor(secondsPerKm / 60)}:${pad(Math.round(secondsPerKm % 60))}`;

/** "5:20" → 320 s/km */
export function paceToSeconds(pace?: string | null) {
  if (!pace) return undefined;
  const [minutes, seconds] = pace.split(':').map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : undefined;
}

/** "il y a 2 h", "hier", "le 3 sept." — pour les horodatages de liste. */
export function formatRelative(iso: string) {
  const date = new Date(iso);
  const minutes = Math.round((Date.now() - date.getTime()) / 60_000);
  if (minutes < 1) return "à l'instant";
  if (minutes < 60) return `il y a ${minutes} min`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `il y a ${hours} h`;
  const days = Math.round(hours / 24);
  if (days === 1) return 'hier';
  if (days < 7) return `il y a ${days} jours`;
  return `le ${date.getDate()} ${formatMonthShort(date.getMonth())}`;
}

/** Distance en km → "19,6 km" (ou "—" si absente). */
export const formatKm = (km?: number | null) => (km == null ? '—' : `${formatDecimal(km, 1)} km`);

/** Durée en minutes → "1 h 25" ou "50 min". */
export const formatMinutes = (minutes?: number | null) => (minutes == null ? '—' : formatHoursMinutes(minutes * 60));

/** Initiales d'un nom : « Camille Roux » → « CR ». */
export const initialsOf = (firstName?: string | null, lastName?: string | null) =>
  `${firstName?.[0] ?? ''}${lastName?.[0] ?? ''}`.toUpperCase();
