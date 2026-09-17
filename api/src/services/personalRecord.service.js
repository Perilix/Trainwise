const Run = require('../models/run.model');
const { createNotification } = require('../controllers/notification.controller');

// Records personnels, annoncés à l'athlète quand une sortie arrive.
// Deux records seulement, ceux qu'on peut affirmer sans se tromper à partir des
// totaux d'une sortie : la plus longue, et la plus rapide sur une distance
// comparable. Un « record sur 10 km » demanderait les temps de passage, pas la
// moyenne d'une sortie de 15 km.

// En dessous, une allure moyenne rapide ne dit rien : c'est un footing court ou du fractionné.
const MIN_PACE_RECORD_KM = 5;

const paceSeconds = (pace) => {
  if (!pace) return null;
  const [minutes, seconds] = String(pace).split(':').map(Number);
  return Number.isFinite(minutes) && Number.isFinite(seconds) ? minutes * 60 + seconds : null;
};

const formatKm = (km) => String(Math.round(km * 10) / 10).replace('.', ',');

/**
 * Compare la sortie à l'historique de l'athlète et notifie si elle établit un record.
 * Silencieux (et sans notification) si la sortie n'a pas les données nécessaires.
 */
async function notifyRecords(run) {
  if (!run || !run.user) return null;

  const previous = await Run.find({ user: run.user, _id: { $ne: run._id } })
    .select('distance averagePace')
    .lean();
  // Un premier enregistrement n'est pas un record : il n'y a rien à battre.
  if (previous.length < 3) return null;

  if (run.distance) {
    const longest = Math.max(...previous.map(item => item.distance || 0));
    if (run.distance > longest) {
      await createNotification({
        recipient: run.user,
        type: 'achievement',
        action: 'personal_record',
        title: 'Nouveau record 🏆',
        message: `${formatKm(run.distance)} km : c'est ta plus longue sortie, tu bats ${formatKm(longest)} km.`,
        actionUrl: `/run/${run._id}`
      });
      return 'distance';
    }
  }

  const pace = paceSeconds(run.averagePace);
  if (pace && run.distance >= MIN_PACE_RECORD_KM) {
    const comparable = previous
      .filter(item => (item.distance || 0) >= MIN_PACE_RECORD_KM)
      .map(item => paceSeconds(item.averagePace))
      .filter(Boolean);

    if (comparable.length >= 3 && pace < Math.min(...comparable)) {
      await createNotification({
        recipient: run.user,
        type: 'achievement',
        action: 'personal_record',
        title: 'Nouveau record 🏆',
        message: `${run.averagePace} /km sur ${formatKm(run.distance)} km : ta meilleure allure moyenne sur une sortie de ${MIN_PACE_RECORD_KM} km ou plus.`,
        actionUrl: `/run/${run._id}`
      });
      return 'pace';
    }
  }

  return null;
}

module.exports = { notifyRecords };
