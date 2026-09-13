const axios = require('axios');
const { JWT } = require('google-auth-library');
const User = require('../models/user.model');

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
      console.warn('⚠️  Firebase credentials not configured. Push notifications will not work.');
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
    console.error('❌ Error initializing Firebase Admin:', error.message);
  }
}

initializeFirebase();

async function sendPushNotification(userId, notification) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notification');
    return { success: false, error: 'Firebase not initialized' };
  }

  try {
    const user = await User.findById(userId).select('pushToken pushPlatform');

    if (!user || !user.pushToken) {
      return { success: false, error: 'No push token' };
    }

    const tokenData = await jwtClient.getAccessToken();

    const message = {
      message: {
        token: user.pushToken,
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
    const errData = error.response?.data || error.message;
    console.error('❌ Error sending push notification:', errData);

    if (error.response?.data?.error?.details?.some(d =>
      d.errorCode === 'INVALID_ARGUMENT' || d.errorCode === 'UNREGISTERED'
    )) {
      await User.findByIdAndUpdate(userId, { pushToken: null, pushPlatform: null });
    }

    return { success: false, error: errData };
  }
}

async function sendPushNotificationToMultiple(userIds, notification) {
  if (!firebaseInitialized) {
    console.warn('Firebase not initialized, skipping push notifications');
    return { success: false, error: 'Firebase not initialized' };
  }

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
