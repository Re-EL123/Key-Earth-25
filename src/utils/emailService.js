const nodemailer = require('nodemailer');
const config = require('../config/env');

// Create transporter
const transporter = nodemailer.createTransport({
  host: config.email.host,
  port: config.email.port,
  secure: false,
  auth: {
    user: config.email.user,
    pass: config.email.password,
  },
});

/**
 * Send email
 */
const sendEmail = async ({ to, subject, html, text }) => {
  try {
    const mailOptions = {
      from: config.email.from,
      to,
      subject,
      html,
      text: text || html.replace(/<[^>]*>/g, ''),
    };

    const info = await transporter.sendMail(mailOptions);
    console.log('Email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Email sending failed:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Send welcome email
 */
const sendWelcomeEmail = async (user) => {
  const subject = 'Welcome to Green World';
  const html = `
    <h1>Welcome to Green World, ${user.name}!</h1>
    <p>Thank you for joining our platform.</p>
    <p>Your account has been created successfully as a <strong>${user.role}</strong>.</p>
    ${user.role === 'distributor' ? `
      <p>Your distributor code: <strong>${user.distributorCode}</strong></p>
      <p>Your account is currently pending verification.</p>
    ` : ''}
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: user.email, subject, html });
};

/**
 * Send distributor verification email
 */
const sendDistributorVerificationEmail = async (user, status) => {
  const subject = `Distributor Account ${status === 'verified' ? 'Approved' : 'Rejected'}`;
  const html = `
    <h1>Distributor Account Update</h1>
    <p>Dear ${user.name},</p>
    ${status === 'verified' ? `
      <p>Congratulations! Your distributor account has been verified.</p>
      <p>You can now create stores and start selling on our platform.</p>
    ` : `
      <p>Unfortunately, your distributor account verification was not successful.</p>
      <p>Please contact support for more information.</p>
    `}
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: user.email, subject, html });
};

/**
 * Send subscription expiry reminder
 */
const sendSubscriptionExpiryReminder = async (store, daysLeft) => {
  const subject = `Store Subscription Expiring in ${daysLeft} Days`;
  const html = `
    <h1>Subscription Expiry Reminder</h1>
    <p>Dear Store Owner,</p>
    <p>Your subscription for <strong>${store.name}</strong> will expire in <strong>${daysLeft} days</strong>.</p>
    <p>Expiry Date: <strong>${store.subscriptionExpiry.toLocaleDateString()}</strong></p>
    <p>Please renew your subscription to continue accepting orders and appointments.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  const distributor = await require('../models/User').findById(store.distributorId);
  if (distributor) {
    return sendEmail({ to: distributor.email, subject, html });
  }
};

/**
 * Send order confirmation email
 */
const sendOrderConfirmationEmail = async (order, customer) => {
  const subject = `Order Confirmation - ${order.orderNumber}`;
  const html = `
    <h1>Order Confirmed!</h1>
    <p>Dear ${customer.name},</p>
    <p>Your order <strong>${order.orderNumber}</strong> has been confirmed.</p>
    <h3>Order Details:</h3>
    <ul>
      <li>Subtotal: ${order.subtotal}</li>
      <li>Delivery Fee: ${order.deliveryFee}</li>
      <li>Total: ${order.total}</li>
    </ul>
    <p>You will receive updates on your order status.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: customer.email, subject, html });
};

/**
 * Send appointment confirmation email
 */
const sendAppointmentConfirmationEmail = async (appointment, customer) => {
  const subject = `Appointment Confirmed - ${appointment.appointmentNumber}`;
  const html = `
    <h1>Appointment Confirmed!</h1>
    <p>Dear ${customer.name},</p>
    <p>Your appointment <strong>${appointment.appointmentNumber}</strong> has been confirmed.</p>
    <h3>Appointment Details:</h3>
    <ul>
      <li>Service: ${appointment.serviceType}</li>
      <li>Date: ${appointment.appointmentDate.toLocaleDateString()}</li>
      <li>Time: ${appointment.appointmentTime}</li>
    </ul>
    <p>Please arrive 10 minutes before your scheduled time.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: customer.email, subject, html });
};

/**
 * Send appointment reminder email
 */
const sendAppointmentReminderEmail = async (appointment, customer) => {
  const subject = `Appointment Reminder - Tomorrow`;
  const html = `
    <h1>Appointment Reminder</h1>
    <p>Dear ${customer.name},</p>
    <p>This is a reminder about your appointment tomorrow.</p>
    <h3>Appointment Details:</h3>
    <ul>
      <li>Appointment Number: ${appointment.appointmentNumber}</li>
      <li>Service: ${appointment.serviceType}</li>
      <li>Date: ${appointment.appointmentDate.toLocaleDateString()}</li>
      <li>Time: ${appointment.appointmentTime}</li>
    </ul>
    <p>Please arrive 10 minutes before your scheduled time.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: customer.email, subject, html });
};

/**
 * Send driver approval email
 */
const sendDriverApprovalEmail = async (driver, user) => {
  const subject = 'Driver Account Approved';
  const html = `
    <h1>Driver Account Approved!</h1>
    <p>Dear ${user.name},</p>
    <p>Congratulations! Your driver account has been approved.</p>
    <p>You can now start accepting deliveries on the Green World platform.</p>
    <p>Download the driver app to get started.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: user.email, subject, html });
};

/**
 * Send payout notification email
 */
const sendPayoutNotificationEmail = async (driver, user, amount) => {
  const subject = 'Payout Processed';
  const html = `
    <h1>Payout Processed</h1>
    <p>Dear ${user.name},</p>
    <p>Your payout of <strong>${amount}</strong> has been processed successfully.</p>
    <p>The funds should reflect in your account within 1-3 business days.</p>
    <p>Best regards,<br>Green World Team</p>
  `;

  return sendEmail({ to: user.email, subject, html });
};

module.exports = {
  sendEmail,
  sendWelcomeEmail,
  sendDistributorVerificationEmail,
  sendSubscriptionExpiryReminder,
  sendOrderConfirmationEmail,
  sendAppointmentConfirmationEmail,
  sendAppointmentReminderEmail,
  sendDriverApprovalEmail,
  sendPayoutNotificationEmail,
};