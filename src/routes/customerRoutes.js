const express = require('express');
const router = express.Router();
const {
  browseProducts,
  getProductDetails,
  getCategories,
  browseStores,
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
} = require('../controllers/customerController');
const { authenticate } = require('../middleware/authMiddleware');
const { validatePagination, validateObjectId } = require('../middleware/validationMiddleware');

// Public routes
router.get('/products', validatePagination, browseProducts);
router.get('/products/categories/all', getCategories);
router.get('/products/:id', validateObjectId('id'), getProductDetails);
router.get('/stores', validatePagination, browseStores);

// Protected routes - Addresses
router.get('/addresses', authenticate, getMyAddresses);
router.post('/addresses', authenticate, createAddress);
router.put('/addresses/:id', authenticate, validateObjectId('id'), updateAddress);
router.delete('/addresses/:id', authenticate, validateObjectId('id'), deleteAddress);
router.put('/addresses/:id/set-default', authenticate, validateObjectId('id'), setDefaultAddress);

module.exports = router;