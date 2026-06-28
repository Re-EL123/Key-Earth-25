const express = require('express');
const router = express.Router();
const {
  createStore,
  getStore,
  getMyStores,
  updateStore,
  getStoreProducts,
  addProductToStore,
  updateStoreProduct,
  removeProductFromStore,
  getStoreStats,
} = require('../controllers/storeController');
const { authenticate, optionalAuth } = require('../middleware/authMiddleware');
const { requireVerifiedDistributor, requireStoreOwnership } = require('../middleware/roleMiddleware');
const { validateStoreCreation, validateObjectId } = require('../middleware/validationMiddleware');

// Public routes
router.get('/:identifier', optionalAuth, getStore);
router.get('/:storeId/products', getStoreProducts);

// Protected routes - require verified distributor
router.post('/', authenticate, requireVerifiedDistributor, validateStoreCreation, createStore);
router.get('/my/all', authenticate, requireVerifiedDistributor, getMyStores);

// Store owner routes
router.put(
  '/:storeId',
  authenticate,
  requireStoreOwnership('storeId'),
  updateStore
);

router.get(
  '/:storeId/stats',
  authenticate,
  requireStoreOwnership('storeId'),
  getStoreStats
);

// Store products management
router.post(
  '/:storeId/products',
  authenticate,
  requireStoreOwnership('storeId'),
  addProductToStore
);

router.put(
  '/:storeId/products/:productId',
  authenticate,
  requireStoreOwnership('storeId'),
  updateStoreProduct
);

router.delete(
  '/:storeId/products/:productId',
  authenticate,
  requireStoreOwnership('storeId'),
  removeProductFromStore
);

module.exports = router;