const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getAllUsers,
  getUserDetails,
  verifyDistributor,
  uploadDistributorCodes,
  createDistributorCode,
  getDistributorCodes,
  getAllStores,
  toggleStoreStatus,
  getAllDrivers,
  approveDriver,
  createProduct,
  updateProduct,
  deleteProduct,
  getAllSubscriptions,
} = require('../controllers/superAdminController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { 
  validatePagination, 
  validateObjectId,
  validateProductCreation,
  body,
  handleValidationErrors,
} = require('../middleware/validationMiddleware');
const { uploadSingle, handleUploadError } = require('../middleware/uploadMiddleware');

// All routes require super admin role
router.use(authenticate, requireRole('superAdmin'));

// Dashboard
router.get('/dashboard', getDashboardStats);

// Users management
router.get('/users', validatePagination, getAllUsers);
router.get('/users/:id', validateObjectId('id'), getUserDetails);

// Distributor verification
router.put(
  '/distributors/:id/verify',
  validateObjectId('id'),
  body('status').isIn(['verified', 'rejected']),
  handleValidationErrors,
  verifyDistributor
);

// Distributor codes
router.post(
  '/distributor-codes/upload',
  uploadSingle('file'),
  handleUploadError,
  uploadDistributorCodes
);
router.post('/distributor-codes', createDistributorCode);
router.get('/distributor-codes', validatePagination, getDistributorCodes);

// Stores management
router.get('/stores', validatePagination, getAllStores);
router.put('/stores/:id/toggle-status', validateObjectId('id'), toggleStoreStatus);

// Drivers management
router.get('/drivers', validatePagination, getAllDrivers);
router.put(
  '/drivers/:id/approve',
  validateObjectId('id'),
  body('status').isIn(['approved', 'rejected']),
  handleValidationErrors,
  approveDriver
);

// Products management
router.post('/products', validateProductCreation, createProduct);
router.put('/products/:id', validateObjectId('id'), updateProduct);
router.delete('/products/:id', validateObjectId('id'), deleteProduct);

// Subscriptions
router.get('/subscriptions', validatePagination, getAllSubscriptions);

module.exports = router;