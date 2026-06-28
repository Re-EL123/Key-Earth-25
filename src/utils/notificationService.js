const { admin } = require('../config/firebase');

/**
 * Send push notification
 */
const sendPushNotification = async (token, notification, data = {}) => {
  try {
    const message = {
      token,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'default',
        },
      },
      apns: {
        payload: {
          aps: {
            sound: 'default',
            badge: 1,
          },
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Push notification sent:', response);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Push notification failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send notification to multiple devices
 */
const sendMulticastNotification = async (tokens, notification, data = {}) => {
  try {
    const message = {
      tokens,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
    };

    const response = await admin.messaging().sendMulticast(message);
    console.log(`${response.successCount} notifications sent successfully`);
    return { 
      success: true, 
      successCount: response.successCount,
      failureCount: response.failureCount,
    };
  } catch (error) {
    console.error('Multicast notification failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Subscribe token to topic
 */
const subscribeToTopic = async (tokens, topic) => {
  try {
    const response = await admin.messaging().subscribeToTopic(tokens, topic);
    return { success: true, response };
  } catch (error) {
    console.error('Topic subscription failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send topic notification
 */
const sendTopicNotification = async (topic, notification, data = {}) => {
  try {
    const message = {
      topic,
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data,
    };

    const response = await admin.messaging().send(message);
    return { success: true, messageId: response };
  } catch (error) {
    console.error('Topic notification failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  sendPushNotification,
  sendMulticastNotification,
  subscribeToTopic,
  sendTopicNotification,
};