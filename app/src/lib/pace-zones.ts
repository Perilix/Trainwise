// Zones d'allure en % de VMA, identiques à l'API (api/src/constants/paceZones.js).
export const PACE_ZONES: Record<string, { label: string; percent: number; min: number; max: number }> = {
  recovery: { label: 'Récupération passive', percent: 50, min: 45, max: 55 },
  endurance: { label: 'Endurance fondamentale', percent: 60, min: 55, max: 63 },
  recoveryActive: { label: 'Récupération active', percent: 65, min: 62, max: 68 },
  marathon: { label: 'Allure marathon', percent: 75, min: 72, max: 78 },
  semi: { label: 'Allure semi-marathon', percent: 80, min: 78, max: 82 },
  threshold: { label: 'Seuil', percent: 83, min: 81, max: 84 },
  tenK: { label: 'Allure 10K', percent: 85, min: 84, max: 87 },
  fiveK: { label: 'Allure 5K', percent: 90, min: 88, max: 92 },
  vma: { label: 'VMA', percent: 95, min: 90, max: 100 },
  speed: { label: 'Vitesse', percent: 110, min: 105, max: 120 },
};
