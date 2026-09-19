import type { GroupColor } from '@/lib/api-types';

/**
 * Les couleurs proposées pour un groupe. Elles sont pastel : un groupe
 * étiquette, il ne signale pas. C'est ce qui leur permet de côtoyer le code
 * couleur de l'app (violet = coach, orange = Strava, rouge = alerte,
 * vert = fait) sans s'y confondre.
 *
 * Mêmes valeurs que le web (web-app/src/app/pages/coach/dashboard.page.ts).
 */
export const GROUP_TINT: Record<GroupColor, { soft: string; ink: string }> = {
  rouge: { soft: '#FBE4E2', ink: '#B4463D' },
  bleu: { soft: '#E2EFFA', ink: '#2F76AE' },
  vert: { soft: '#E4F1E6', ink: '#41815A' },
  jaune: { soft: '#FAF0D8', ink: '#96731C' },
  orange: { soft: '#FBE8D8', ink: '#B4662F' },
  violet: { soft: '#EDE6F8', ink: '#6F52A8' },
  rose: { soft: '#FAE4EE', ink: '#AE5081' },
};

export const GROUP_COLORS = (Object.keys(GROUP_TINT) as GroupColor[]).map((id) => ({
  id,
  label: id[0].toUpperCase() + id.slice(1),
}));

export const tintOf = (color: GroupColor) => GROUP_TINT[color] ?? GROUP_TINT.bleu;
