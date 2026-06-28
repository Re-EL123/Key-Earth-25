const cron = require('node-cron');
const Subscription = require('../models/Subscription');
const Appointment = require('../models/Appointment');
const Store = require('../models/Store');
const { sendSubscriptionExpiryReminder, sendAppointmentReminderEmail } = require('../utils/emailService');

/**
 * Check for expiring subscriptions and send reminders
 * Runs daily at 9:00 AM
 */
const checkExpiringSubscriptions = cron.schedule('0 9 * * *', async () => {
  console.log('Running scheduled task: Check expiring subscriptions');

  try {
    // Find subscriptions expiring in 7 days
    const subscriptions = await Subscription.findExpiringSubscriptions(7);

    for (const subscription of subscriptions) {
      const store = await Store.findById(subscription.storeId);
      if (store) {
        const daysLeft = Math.ceil((subscription.expiryDate - new Date()) / (1000 * 60 * 60 * 24));
        await sendSubscriptionExpiryReminder(store, daysLeft);
      }
    }

    console.log(`✅ Sent ${subscriptions.length} subscription expiry reminders`);
  } catch (error) {
    console.error('❌ Error in checkExpiringSubscriptions:', error);
  }
}, {
  scheduled: false,
});

/**
 * Send appointment reminders for tomorrow
 * Runs daily at 6:00 PM
 */
const sendAppointmentReminders = cron.schedule('0 18 * * *', async () => {
  console.log('Running scheduled task: Send appointment reminders');

  try {
    const appointments = await Appointment.findAppointmentsNeedingReminder();

    for (const appointment of appointments) {
      const User = require('../models/User');
      const customer = await User.findById(appointment.customerId);
      
      if (customer) {
        await sendAppointmentReminderEmail(appointment, customer);
        appointment.reminderSent = true;
        appointment.reminderSentAt = new Date();
        await appointment.save();
      }
    }

    console.log(`✅ Sent ${appointments.length} appointment reminders`);
  } catch (error) {
    console.error('❌ Error in sendAppointmentReminders:', error);
  }
}, {
  scheduled: false,
});

/**
 * Update expired subscriptions
 * Runs daily at midnight
 */
const updateExpiredSubscriptions = cron.schedule('0 0 * * *', async () => {
  console.log('Running scheduled task: Update expired subscriptions');

  try {
    const expiredSubscriptions = await Subscription.findExpiredSubscriptions();

    for (const subscription of expiredSubscriptions) {
      subscription.status = 'expired';
      await subscription.save();

      // Update store status
      const store = await Store.findById(subscription.storeId);
      if (store) {
        store.subscriptionStatus = 'expired';
        store.isActive = false;
        await store.save();
      }
    }

    console.log(`✅ Updated ${expiredSubscriptions.length} expired subscriptions`);
  } catch (error) {
    console.error('❌ Error in updateExpiredSubscriptions:', error);
  }
}, {
  scheduled: false,
});

/**
 * Clean up old reports
 * Runs weekly on Sunday at 2:00 AM
 */
const cleanupOldReports = cron.schedule('0 2 * * 0', async () => {
  console.log('Running scheduled task: Cleanup old reports');

  try {
    const Report = require('../models/Report');
    const result = await Report.cleanupExpired();

    console.log(`✅ Cleaned up ${result.deletedCount} expired reports`);
  } catch (error) {
    console.error('❌ Error in cleanupOldReports:', error);
  }
}, {
  scheduled: false,
});

/**
 * Start all scheduled tasks
 */
const startScheduledTasks = () => {
  console.log('🕐 Starting scheduled tasks...');
  
  checkExpiringSubscriptions.start();
  sendAppointmentReminders.start();
  updateExpiredSubscriptions.start();
  cleanupOldReports.start();
  
  console.log('✅ All scheduled tasks started');
};

/**
 * Stop all scheduled tasks
 */
const stopScheduledTasks = () => {
  console.log('🛑 Stopping scheduled tasks...');
  
  checkExpiringSubscriptions.stop();
  sendAppointmentReminders.stop();
  updateExpiredSubscriptions.stop();
  cleanupOldReports.stop();
  
  console.log('✅ All scheduled tasks stopped');
};

module.exports = {
  startScheduledTasks,
  stopScheduledTasks,
  checkExpiringSubscriptions,
  sendAppointmentReminders,
  updateExpiredSubscriptions,
  cleanupOldReports,
};