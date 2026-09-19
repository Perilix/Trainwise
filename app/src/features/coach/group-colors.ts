import type { GroupColor } from '@/lib/api-types';

/**
 * Les couleurs proposées pour un groupe. Elles restent en dehors du code
 * couleur de l'app (violet = coach, orange = Strava, rouge = alerte,
 * vert = fait) : un groupe est un repère, pas un statut.
 *
 * Mêmes valeurs que le web (web-app/src/app/pages/coach/dashboard.page.ts).
 */
export const GROUP_TINT: Record<GroupColor, { soft: string; ink: string }> = {
  bleu: { soft: '#E1F1FB', ink: '#0077B6' },
  indigo: { soft: '#E7E9FA', ink: '#4F5BD5' },
  turquoise: { soft: '#DEF2F1', ink: '#0E8F8C' },
  rose: { soft: '#FAE7F0', ink: '#C0547F' },
  sable: { soft: '#F3EBDC', ink: '#96702F' },
  ardoise: { soft: '#E8ECEF', ink: '#4C5B66' },
};

export const GROUP_COLORS = (Object.keys(GROUP_TINT) as GroupColor[]).map((id) => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
  dot: GROUP_TINT[id].ink,
}));

export const tintOf = (color: GroupColor) => GROUP_TINT[color] ?? GROUP_TINT.bleu;
