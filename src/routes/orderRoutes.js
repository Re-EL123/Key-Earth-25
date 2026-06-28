const express = require('express');
const router = express.Router();
const {
  createOrder,
  getOrder,
  trackOrder,
  getMyOrders,
  getStoreOrders,
  updateOrderStatus,
  assignDriver,
  cancelOrder,
} = require('../controllers/orderController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireStoreOwnership } = require('../middleware/roleMiddleware');
const { validateOrderCreation, validateObjectId, validatePagination } = require('../middleware/validationMiddleware');

// Public routes
router.get('/track/:orderNumber', trackOrder);

// Customer routes
router.post('/', authenticate, validateOrderCreation, createOrder);
router.get('/my/all', authenticate, validatePagination, getMyOrders);
router.get('/:id', authenticate, validateObjectId('id'), getOrder);
router.put('/:id/cancel', authenticate, validateObjectId('id'), cancelOrder);

// Store owner routes
router.get(
  '/store/:storeId',
  authenticate,
  requireStoreOwnership('storeId'),
  validatePagination,
  getStoreOrders
);

router.put(
  '/:id/status',
  authenticate,
  validateObjectId('id'),
  updateOrderStatus
);

router.put(
  '/:id/assign-driver',
  authenticate,
  validateObjectId('id'),
  assignDriver
);

module.exports = router;