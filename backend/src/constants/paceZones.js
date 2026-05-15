const PACE_ZONES = {
  recovery: {
    key: 'recovery',
    label: 'Récupération passive',
    defaultPercent: 50,
    minPercent: 45,
    maxPercent: 55
  },
  endurance: {
    key: 'endurance',
    label: 'Endurance fondamentale',
    defaultPercent: 60,
    minPercent: 55,
    maxPercent: 63
  },
  recoveryActive: {
    key: 'recoveryActive',
    label: 'Récupération active',
    defaultPercent: 65,
    minPercent: 62,
    maxPercent: 68
  },
  marathon: {
    key: 'marathon',
    label: 'Allure marathon',
    defaultPercent: 75,
    minPercent: 72,
    maxPercent: 78
  },
  semi: {
    key: 'semi',
    label: 'Allure semi-marathon',
    defaultPercent: 80,
    minPercent: 78,
    maxPercent: 82
  },
  threshold: {
    key: 'threshold',
    label: 'Seuil',
    defaultPercent: 83,
    minPercent: 81,
    maxPercent: 84
  },
  tenK: {
    key: 'tenK',
    label: 'Allure 10K',
    defaultPercent: 85,
    minPercent: 84,
    maxPercent: 87
  },
  fiveK: {
    key: 'fiveK',
    label: 'Allure 5K',
    defaultPercent: 90,
    minPercent: 88,
    maxPercent: 92
  },
  vma: {
    key: 'vma',
    label: 'VMA',
    defaultPercent: 95,
    minPercent: 90,
    maxPercent: 100
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
