const { PACE_ZONES } = require('../constants/paceZones');

function secondsToPaceString(seconds) {
  if (seconds == null || !isFinite(seconds) || seconds <= 0) return null;
  const total = Math.round(seconds);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function speedToPaceString(speedKmh) {
  if (!speedKmh || speedKmh <= 0) return null;
  const secondsPerKm = 3600 / speedKmh;
  return secondsToPaceString(secondsPerKm);
}

function resolvePaceFromVma(vmaPercent, vma) {
  if (!vma || !vmaPercent) return null;
  const speed = vma * (vmaPercent / 100);
  return speedToPaceString(speed);
}

function resolveBlockPace(paceConfig, vma) {
  if (!paceConfig || !paceConfig.mode) return null;

  if (paceConfig.mode === 'absolute') {
    return paceConfig.absolute || null;
  }

  let percent = null;
  if (paceConfig.mode === 'vmaPercent') {
    percent = paceConfig.vmaPercent;
  } else if (paceConfig.mode === 'zone') {
    percent = paceConfig.vmaPercent || PACE_ZONES[paceConfig.zone]?.defaultPercent;
  }

  if (!percent) return null;
  return resolvePaceFromVma(percent, vma);
}

module.exports = {
  secondsToPaceString,
  speedToPaceString,
  resolvePaceFromVma,
  resolveBlockPace
};
