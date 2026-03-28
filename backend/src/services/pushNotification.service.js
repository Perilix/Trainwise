const admin = require('firebase-admin');
const axios = require('axios');
const User = require('../models/user.model');

let firebaseInitialized = false;
let projectId = null;

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

    admin.initializeApp({
      credential: admin.credential.cert(parsed),
      projectId: parsed.project_id
    });

    firebaseInitialized = true;
    console.log('✅ Firebase Admin initialized for push notifications');
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
      console.log(`No push token found for user ${userId}`);
      return { success: false, error: 'No push token' };
    }

    const tokenData = await admin.app().options.credential.getAccessToken();

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
            channelId: 'runiq_notifications'
          }
        }
      }
    };

    const response = await axios.post(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      message,
      {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log('✅ Push notification sent successfully:', response.data);
    return { success: true, response: response.data };

  } catch (error) {
    const errData = error.response?.data || error.message;
    console.error('❌ Error sending push notification:', errData);

    if (error.response?.data?.error?.details?.some(d =>
      d.errorCode === 'INVALID_ARGUMENT' || d.errorCode === 'UNREGISTERED'
    )) {
      await User.findByIdAndUpdate(userId, { pushToken: null, pushPlatform: null });
      console.log(`Invalid token removed for user ${userId}`);
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
  console.log(`✅ Sent ${successCount}/${userIds.length} notifications`);
  return { success: true, successCount, failureCount: userIds.length - successCount };
}

module.exports = {
  sendPushNotification,
  sendPushNotificationToMultiple
};
