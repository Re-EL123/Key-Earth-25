const { validationResult, body, param, query } = require('express-validator');

/**
 * Handle validation errors
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);

  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array().map(err => ({
        field: err.param,
        message: err.msg,
        value: err.value,
      })),
    });
  }

  next();
};

/**
 * Validation rules for user registration
 * - Allow storeOwner, distributor, driver, customer, superAdmin (if needed)
 * - Require distributorCode for storeOwner/distributor
 */
const validateRegistration = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Name must be between 2 and 100 characters'),
  body('phone')
    .trim()
    .notEmpty()
    .withMessage('Phone number is required')
    .matches(/^[0-9+\-\s()]+$/)
    .withMessage('Invalid phone number format'),
  body('role')
    .isIn(['customer', 'distributor', 'driver', 'storeOwner'])
    .withMessage('Invalid role'),
  body('distributorCode')
    .if(
      body('role').custom(value => value === 'distributor' || value === 'storeOwner')
    )
    .trim()
    .notEmpty()
    .withMessage('Distributor code is required for store owner/distributor registration'),
  handleValidationErrors,
];

/**
 * Validation rules for store creation
 */
const validateStoreCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Store name is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Store name must be between 2 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must not exceed 1000 characters'),
  body('contactInfo.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Valid email is required'),
  body('contactInfo.phone')
    .trim()
    .notEmpty()
    .withMessage('Contact phone is required'),
  body('address.city')
    .trim()
    .notEmpty()
    .withMessage('City is required'),
  body('address.state')
    .trim()
    .notEmpty()
    .withMessage('State is required'),
  handleValidationErrors,
];

/**
 * Validation rules for product creation
 */
const validateProductCreation = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required'),
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .isLength({ min: 2, max: 50 })
    .withMessage('SKU must be between 2 and 50 characters'),
  body('basePrice')
    .isFloat({ min: 0 })
    .withMessage('Valid base price is required'),
  body('category')
    .trim()
    .notEmpty()
    .withMessage('Category is required'),
  handleValidationErrors,
];

/**
 * Validation rules for order creation
 */
const validateOrderCreation = [
  body('storeId')
    .notEmpty()
    .withMessage('Store ID is required')
    .isMongoId()
    .withMessage('Invalid store ID'),
  body('items')
    .isArray({ min: 1 })
    .withMessage('At least one item is required'),
  body('items.*.productId')
    .isMongoId()
    .withMessage('Invalid product ID'),
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be at least 1'),
  body('addressId')
    .notEmpty()
    .withMessage('Delivery address is required')
    .isMongoId()
    .withMessage('Invalid address ID'),
  body('paymentMethod')
    .isIn(['cash', 'card', 'transfer', 'wallet'])
    .withMessage('Invalid payment method'),
  handleValidationErrors,
];

/**
 * Validation rules for appointment booking
 */
const validateAppointmentBooking = [
  body('storeId')
    .notEmpty()
    .withMessage('Store ID is required')
    .isMongoId()
    .withMessage('Invalid store ID'),
  body('serviceType')
    .isIn(['health_scan', 'wellness_check', 'consultation', 'follow_up', 'other'])
    .withMessage('Invalid service type'),
  body('appointmentDate')
    .isISO8601()
    .withMessage('Valid date is required')
    .custom((value) => {
      const appointmentDate = new Date(value);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (appointmentDate < today) {
        throw new Error('Appointment date cannot be in the past');
      }
      return true;
    }),
  body('appointmentTime')
    .matches(/^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/)
    .withMessage('Valid time is required (HH:MM format)'),
  body('customerInfo.name')
    .trim()
    .notEmpty()
    .withMessage('Customer name is required'),
  body('customerInfo.phone')
    .trim()
    .notEmpty()
    .withMessage('Customer phone is required'),
  handleValidationErrors,
];

/**
 * Validation rules for pagination
 */
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  handleValidationErrors,
];

/**
 * Validation rules for MongoDB ObjectId
 */
const validateObjectId = (paramName = 'id') => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName}`),
  handleValidationErrors,
];

/**
 * Validation rules for date range
 */
const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Valid start date is required'),
  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('Valid end date is required')
    .custom((endDate, { req }) => {
      if (req.query.startDate && new Date(endDate) < new Date(req.query.startDate)) {
        throw new Error('End date must be after start date');
      }
      return true;
    }),
  handleValidationErrors,
];

module.exports = {
  handleValidationErrors,
  validateRegistration,
  validateStoreCreation,
  validateProductCreation,
  validateOrderCreation,
  validateAppointmentBooking,
  validatePagination,
  validateObjectId,
  validateDateRange,
  // Export validators for custom use
  body,
  param,
  query,
  validationResult,
};
