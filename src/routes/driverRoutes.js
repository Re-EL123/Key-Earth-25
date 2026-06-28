const express = require('express');
const router = express.Router();
const {
  registerDriver,
  getMyDriverProfile,
  updateDriverProfile,
  updateLocation,
  updateAvailability,
  getAvailableDeliveries,
  getMyDeliveries,
  acceptDelivery,
  updateDeliveryStatus,
  completeDelivery,
  getEarnings,
  getEarningsSummary,
} = require('../controllers/driverController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validatePagination, validateObjectId, body, handleValidationErrors } = require('../middleware/validationMiddleware');

// All routes require authentication
router.use(authenticate);

// Driver registration and profile
router.post('/register', requireRole('driver'), registerDriver);
router.get('/me', requireRole('driver'), getMyDriverProfile);
router.put('/me', requireRole('driver'), updateDriverProfile);

// Location and availability
router.put(
  '/location',
  requireRole('driver'),
  body('longitude').isFloat(),
  body('latitude').isFloat(),
  handleValidationErrors,
  updateLocation
);

router.put(
  '/availability',
  requireRole('driver'),
  body('status').isIn(['online', 'offline']),
  handleValidationErrors,
  updateAvailability
);

// Deliveries
router.get('/deliveries/available', requireRole('driver'), getAvailableDeliveries);
router.get('/deliveries/mine', requireRole('driver'), getMyDeliveries);
router.post('/deliveries/:orderId/accept', requireRole('driver'), validateObjectId('orderId'), acceptDelivery);
router.put('/deliveries/:orderId/status', requireRole('driver'), validateObjectId('orderId'), updateDeliveryStatus);
router.post('/deliveries/:orderId/complete', requireRole('driver'), validateObjectId('orderId'), completeDelivery);

// Earnings
router.get('/earnings', requireRole('driver'), validatePagination, getEarnings);
router.get('/earnings/summary', requireRole('driver'), getEarningsSummary);

module.exports = router;