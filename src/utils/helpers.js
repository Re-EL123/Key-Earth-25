/**
 * Generate random string
 */
const generateRandomString = (length = 10) => {
  return Math.random().toString(36).substring(2, length + 2).toUpperCase();
};

/**
 * Generate order number
 */
const generateOrderNumber = () => {
  const timestamp = Date.now();
  const random = generateRandomString(6);
  return `ORD-${timestamp}-${random}`;
};

/**
 * Generate appointment number
 */
const generateAppointmentNumber = () => {
  const timestamp = Date.now();
  const random = generateRandomString(6);
  return `APT-${timestamp}-${random}`;
};

/**
 * Calculate pagination
 */
const getPagination = (page = 1, limit = 20) => {
  const pageNum = parseInt(page) || 1;
  const limitNum = parseInt(limit) || 20;
  const maxLimit = parseInt(process.env.MAX_PAGE_SIZE || 100);
  
  const finalLimit = Math.min(limitNum, maxLimit);
  const skip = (pageNum - 1) * finalLimit;
  
  return {
    page: pageNum,
    limit: finalLimit,
    skip,
  };
};

/**
 * Format pagination response
 */
const formatPaginationResponse = (data, total, page, limit) => {
  const totalPages = Math.ceil(total / limit);
  
  return {
    data,
    pagination: {
      total,
      page,
      limit,
      totalPages,
      hasNextPage: page < totalPages,
      hasPrevPage: page > 1,
    },
  };
};

/**
 * Calculate delivery fee split
 */
const calculateDeliveryFeeSplit = (deliveryFee) => {
  const driverPercentage = parseFloat(process.env.DRIVER_FEE_PERCENTAGE || 75);
  const platformPercentage = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || 25);

  return {
    total: deliveryFee,
    driverAmount: (deliveryFee * driverPercentage) / 100,
    platformAmount: (deliveryFee * platformPercentage) / 100,
    driverPercentage,
    platformPercentage,
  };
};

/**
 * Calculate subscription expiry date
 */
const calculateSubscriptionExpiry = (startDate = new Date(), months = 12) => {
  const expiryDate = new Date(startDate);
  expiryDate.setMonth(expiryDate.getMonth() + months);
  return expiryDate;
};

/**
 * Format currency
 */
const formatCurrency = (amount, currency = 'NGN') => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: currency,
  }).format(amount);
};

/**
 * Sanitize filename
 */
const sanitizeFilename = (filename) => {
  return filename
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_{2,}/g, '_')
    .toLowerCase();
};

/**
 * Generate slug from string
 */
const generateSlug = (text) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

/**
 * Calculate order total
 */
const calculateOrderTotal = (items, deliveryFee = 0, tax = 0, discount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const total = subtotal + deliveryFee + tax - discount;
  
  return {
    subtotal,
    deliveryFee,
    tax,
    discount,
    total,
  };
};

/**
 * Check if date is in the past
 */
const isPastDate = (date) => {
  return new Date(date) < new Date();
};

/**
 * Check if date is in the future
 */
const isFutureDate = (date) => {
  return new Date(date) > new Date();
};

/**
 * Get date range for reports
 */
const getDateRange = (period = 'week') => {
  const endDate = new Date();
  const startDate = new Date();

  switch (period) {
    case 'today':
      startDate.setHours(0, 0, 0, 0);
      break;
    case 'week':
      startDate.setDate(startDate.getDate() - 7);
      break;
    case 'month':
      startDate.setMonth(startDate.getMonth() - 1);
      break;
    case 'quarter':
      startDate.setMonth(startDate.getMonth() - 3);
      break;
    case 'year':
      startDate.setFullYear(startDate.getFullYear() - 1);
      break;
    default:
      startDate.setDate(startDate.getDate() - 7);
  }

  return { startDate, endDate };
};

/**
 * Validate email format
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Validate phone format
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^[0-9+\-\s()]+$/;
  return phoneRegex.test(phone) && phone.replace(/\D/g, '').length >= 10;
};

/**
 * Mask sensitive data
 */
const maskEmail = (email) => {
  const [username, domain] = email.split('@');
  const maskedUsername = username.substring(0, 2) + '***' + username.substring(username.length - 1);
  return `${maskedUsername}@${domain}`;
};

const maskPhone = (phone) => {
  const cleaned = phone.replace(/\D/g, '');
  return cleaned.substring(0, 3) + '***' + cleaned.substring(cleaned.length - 2);
};

/**
 * Generate random code
 */
const generateCode = (length = 6) => {
  const characters = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code = '';
  for (let i = 0; i < length; i++) {
    code += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return code;
};

/**
 * Sleep/delay function
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

module.exports = {
  generateRandomString,
  generateOrderNumber,
  generateAppointmentNumber,
  getPagination,
  formatPaginationResponse,
  calculateDeliveryFeeSplit,
  calculateSubscriptionExpiry,
  formatCurrency,
  sanitizeFilename,
  generateSlug,
  calculateOrderTotal,
  isPastDate,
  isFutureDate,
  getDateRange,
  isValidEmail,
  isValidPhone,
  maskEmail,
  maskPhone,
  generateCode,
  sleep,
};