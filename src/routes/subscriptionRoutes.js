const express = require('express');
const router = express.Router();
const {
  createSubscription,
  confirmSubscriptionPayment,
  renewSubscription,
  getSubscription,
  getStoreSubscriptions,
  getMySubscriptions,
  cancelSubscription,
  getExpiringSubscriptions,
} = require('../controllers/subscriptionController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole, requireStoreOwnership } = require('../middleware/roleMiddleware');
const { validateObjectId, validatePagination } = require('../middleware/validationMiddleware');

// All routes require authentication
router.use(authenticate);

// Subscription management
router.post('/', createSubscription);
router.get('/my/all', getMySubscriptions);
router.get('/:id', validateObjectId('id'), getSubscription);
router.put('/:id/confirm-payment', confirmSubscriptionPayment);
router.post('/:storeId/renew', renewSubscription);
router.put('/:id/cancel', validateObjectId('id'), cancelSubscription);

// Store subscriptions
router.get(
  '/store/:storeId',
  requireStoreOwnership('storeId'),
  validatePagination,
  getStoreSubscriptions
);

// Admin only
router.get(
  '/expiring/soon',
  requireRole('superAdmin'),
  getExpiringSubscriptions
);

module.exports = router;