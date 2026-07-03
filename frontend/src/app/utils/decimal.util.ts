export function parseDecimalInput(raw: string | null | undefined): number | undefined {
  if (raw === null || raw === undefined) return undefined;
  const normalized = String(raw).trim().replace(',', '.');
  if (normalized === '') return undefined;
  const value = parseFloat(normalized);
  if (isNaN(value) || value < 0) return undefined;
  return Math.round(value * 100) / 100;
}
