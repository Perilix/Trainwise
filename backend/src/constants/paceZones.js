const PACE_ZONES = {
  recovery: {
    key: 'recovery',
    label: 'Récupération active',
    defaultPercent: 60,
    minPercent: 50,
    maxPercent: 65
  },
  endurance: {
    key: 'endurance',
    label: 'Endurance fondamentale',
    defaultPercent: 57,
    minPercent: 55,
    maxPercent: 65
  },
  marathon: {
    key: 'marathon',
    label: 'Allure marathon',
    defaultPercent: 82,
    minPercent: 78,
    maxPercent: 85
  },
  semi: {
    key: 'semi',
    label: 'Allure semi-marathon',
    defaultPercent: 87,
    minPercent: 85,
    maxPercent: 89
  },
  threshold: {
    key: 'threshold',
    label: 'Seuil / 10K',
    defaultPercent: 90,
    minPercent: 88,
    maxPercent: 92
  },
  vma: {
    key: 'vma',
    label: 'VMA / 30-30',
    defaultPercent: 100,
    minPercent: 95,
    maxPercent: 105
  },
  speed: {
    key: 'speed',
    label: 'Vitesse',
    defaultPercent: 110,
    minPercent: 105,
    maxPercent: 120
  }
};

const ZONE_KEYS = Object.keys(PACE_ZONES);

module.exports = { PACE_ZONES, ZONE_KEYS };
