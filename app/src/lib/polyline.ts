/**
 * Décodage du format « encoded polyline » de Google, utilisé par Strava pour
 * transporter le tracé d'une activité dans une simple chaîne.
 * Référence : https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */
export type LatLng = { lat: number; lng: number };

export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    // Chaque coordonnée est une différence par rapport à la précédente,
    // écrite sur des groupes de 5 bits, décalés de 63 pour rester imprimables.
    for (const axis of ['lat', 'lng'] as const) {
      let result = 0;
      let shift = 0;
      let byte: number;

      do {
        byte = encoded.charCodeAt(index++) - 63;
        if (Number.isNaN(byte)) return points;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);

      const delta = result & 1 ? ~(result >> 1) : result >> 1;
      if (axis === 'lat') lat += delta;
      else lng += delta;
    }

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }

  return points;
}

/**
 * Projette un tracé dans une boîte en pixels, en gardant les proportions.
 * La longitude est resserrée par le cosinus de la latitude, sinon un parcours
 * paraît étiré en largeur dès qu'on s'éloigne de l'équateur.
 */
export function projectPolyline(points: LatLng[], width: number, height: number, padding = 10): string | null {
  if (points.length < 2) return null;

  const midLat = (points.reduce((sum, point) => sum + point.lat, 0) / points.length) * (Math.PI / 180);
  const scaleX = Math.cos(midLat) || 1;
  const xs = points.map((point) => point.lng * scaleX);
  const ys = points.map((point) => -point.lat);

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  if (spanX === 0 && spanY === 0) return null;

  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const scale = Math.min(spanX > 0 ? usableWidth / spanX : Infinity, spanY > 0 ? usableHeight / spanY : Infinity);
  const offsetX = padding + (usableWidth - spanX * scale) / 2;
  const offsetY = padding + (usableHeight - spanY * scale) / 2;

  return xs
    .map((x, index) => {
      const px = offsetX + (x - minX) * scale;
      const py = offsetY + (ys[index] - minY) * scale;
      return `${index ? 'L' : 'M'}${px.toFixed(1)} ${py.toFixed(1)}`;
    })
    .join(' ');
}
