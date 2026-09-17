/**
 * Milliers séparés, à la française — « 1 208 ».
 *
 * Le pipe `number` d'Angular en locale `fr` sépare avec une espace fine
 * insécable (U+202F) que Poppins ne dessine pas : le nombre revient collé.
 * On repasse donc sur l'espace insécable classique (U+00A0), présente dans
 * la fonte, qui n'autorise pas non plus la coupure en fin de ligne.
 */
export function formatCount(value: number | null | undefined): string {
  return (value ?? 0).toLocaleString('fr-FR').replace(/ /g, ' ');
}
