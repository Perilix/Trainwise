const axios = require('axios');
const { JWT } = require('google-auth-library');
const User = require('../models/user.model');

// Deux canaux d'envoi selon le jeton enregistré par l'appareil :
// - jeton Expo (app Expo) → service push d'Expo ;
// - jeton FCM (ancienne app Capacitor encore installée) → Firebase Cloud Messaging.

const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

let firebaseInitialized = false;
let projectId = null;
let jwtClient = null;

function initializeFirebase() {
  if (firebaseInitialized) {
    return;
  }

  try {
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;

    if (!serviceAccount) {
      console.warn('Firebase credentials not configured. Push notifications to legacy FCM tokens will not work.');
      return;
    }

    const parsed = JSON.parse(Buffer.from(serviceAccount, 'base64').toString('utf8'));
    projectId = parsed.project_id;

    jwtClient = new JWT({
      email: parsed.client_email,
      key: parsed.private_key,
      scopes: ['https://www.googleapis.com/auth/firebase.messaging']
    });

    firebaseInitialized = true;
  } catch (error) {
    console.error('Error initializing Firebase Admin:', error.message);
  }
}

initializeFirebase();

const isExpoPushToken = (token) => /^Expo(nent)?PushToken\[.+\]$/.test(token);

// Ne retire le jeton que s'il n'a pas été remplacé entre-temps par un autre appareil
const clearPushToken = (userId, token) =>
  User.updateOne({ _id: userId, pushToken: token }, { pushToken: null, pushPlatform: null });

async function sendExpoPush(userId, token, notification) {
  const headers = { Accept: 'application/json', 'Content-Type': 'application/json' };
  // Optionnel : à renseigner si l'envoi sécurisé est activé dans le tableau de bord EAS
  if (process.env.EXPO_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${process.env.EXPO_ACCESS_TOKEN}`;
  }

  const response = await axios.post(EXPO_PUSH_URL, {
    to: token,
    title: notification.title,
    body: notification.body,
    data: notification.data || {},
    sound: 'default',
    badge: 1,
    priority: 'high',
    channelId: 'default'
  }, { headers });

  const tickets = response.data?.data;
  const ticket = Array.isArray(tickets) ? tickets[0] : tickets;

  if (ticket?.status === 'error') {
    console.error('Expo push error:', ticket.message, ticket.details);
    if (ticket.details?.error === 'DeviceNotRegistered') {
      await clearPushToken(userId, token);
    }
    return { success: false, error: ticket.message };
  }

  return { success: true, response: ticket };
}

async function sendFcmPush(userId, token, notification) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const tokenData = await jwtClient.getAccessToken();

    const message = {
      message: {
        token,
        notification: {
          title: notification.title,
          body: notification.body
        },
        data: notification.data || {},
        apns: {
          payload: {
            aps: {
              sound: 'default',
              badge: 1
            }
          }
        },
        android: {
          notification: {
            sound: 'default',
            channelId: 'trainwise_notifications'
          }
        }
      }
    };

    const fcmUrl = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`;
    const response = await axios.post(fcmUrl, message, {
      headers: {
        Authorization: `Bearer ${tokenData.token}`,
        'Content-Type': 'application/json'
      }
    });

    return { success: true, response: response.data };
  } catch (error) {
    if (error.response?.data?.error?.details?.some(d =>
      d.errorCode === 'INVALID_ARGUMENT' || d.errorCode === 'UNREGISTERED'
    )) {
      await clearPushToken(userId, token);
    }
    throw error;
  }
}

async function sendPushNotification(userId, notification) {
  try {
    const user = await User.findById(userId).select('pushToken pushPlatform');

    if (!user || !user.pushToken) {
      // Silencieux jusqu'ici : impossible de distinguer « appareil jamais enregistré »
      // d'un envoi qui échoue plus loin.
      console.warn(`[push] aucun jeton pour ${userId} — appareil jamais enregistré, ou autorisation refusée`);
      return { success: false, error: 'No push token' };
    }

    if (isExpoPushToken(user.pushToken)) {
      return await sendExpoPush(userId, user.pushToken, notification);
    }
    return await sendFcmPush(userId, user.pushToken, notification);
  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('Error sending push notification:', errData);
    return { success: false, error: errData };
  }
}

async function sendPushNotificationToMultiple(userIds, notification) {
  const results = await Promise.all(
    userIds.map(userId => sendPushNotification(userId, notification))
  );

  const successCount = results.filter(r => r.success).length;
  return { success: true, successCount, failureCount: userIds.length - successCount };
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple
};
