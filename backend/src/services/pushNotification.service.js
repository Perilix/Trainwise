const admin = require('firebase-admin');
const User = require('../models/user.model');

// Initialiser Firebase Admin (sera configuré plus tard avec les credentials)
let firebaseInitialized = false;

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  try {
    // Vérifier si les credentials Firebase sont configurés
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      console.warn('⚠️  Firebase credentials not configured. Push notifications will not work.');
      console.warn('   Set FIREBASE_SERVICE_ACCOUNT environment variable with your Firebase service account JSON.');
      return;
    }

    admin.initializeApp({
      credential: admin.credential.cert(JSON.parse(serviceAccount))
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized for push notifications');
  } catch (error) {
    console.error('❌ Error initializing Firebase Admin:', error.message);
  }
}

// Initialiser Firebase au chargement du module
initializeFirebase();

/**
 * Envoie une notification push à un utilisateur
 * @param {string} userId - ID de l'utilisateur
 * @param {Object} notification - Objet de notification
 * @param {string} notification.title - Titre de la notification
 * @param {string} notification.body - Corps de la notification
 * @param {Object} notification.data - Données additionnelles (optionnel)
 */
async function sendPushNotification(userId, notification) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    // Récupérer l'utilisateur pour obtenir son push token
    const user = await User.findById(userId).select('pushToken pushPlatform');

    if (!user || !user.pushToken) {
      console.log(`No push token found for user ${userId}`);
      return { success: false, error: 'No push token' };
    }

    const message = {
      token: user.pushToken,
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      // Configuration spécifique iOS
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1
          }
        }
      },
      // Configuration spécifique Android
      android: {
        notification: {
          sound: 'default',
          channelId: 'runiq_notifications'
        }
      }
    };

    const response = await admin.messaging().send(message);
    console.log('✅ Push notification sent successfully:', response);
    return { success: true, response };

  } catch (error) {
    console.error('❌ Error sending push notification:', error);

    // Si le token est invalide, le supprimer de la base de données
    if (error.code === 'messaging/invalid-registration-token' ||
        error.code === 'messaging/registration-token-not-registered') {
      await User.findByIdAndUpdate(userId, {
        pushToken: null,
        pushPlatform: null
      });
      console.log(`Invalid token removed for user ${userId}`);
    }

    return { success: false, error: error.message };
  }
}

/**
 * Envoie une notification push à plusieurs utilisateurs
 * @param {Array<string>} userIds - IDs des utilisateurs
 * @param {Object} notification - Objet de notification
 */
async function sendPushNotificationToMultiple(userIds, notification) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notifications');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    // Récupérer les tokens de tous les utilisateurs
    const users = await User.find({
      _id: { $in: userIds },
      pushToken: { $ne: null }
    }).select('pushToken');

    const tokens = users.map(u => u.pushToken);

    if (tokens.length === 0) {
      console.log('No push tokens found for the provided users');
      return { success: false, error: 'No push tokens' };
    }

    const message = {
      notification: {
        title: notification.title,
        body: notification.body
      },
      data: notification.data || {},
      tokens
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    console.log(`✅ Sent ${response.successCount} notifications, ${response.failureCount} failed`);
    return { success: true, response };

  } catch (error) {
    console.error('❌ Error sending push notifications:', error);
    return { success: false, error: error.message };
  }
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple
};
