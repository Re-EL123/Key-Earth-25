const express = require('express');
const router = express.Router();
const {
  createAppointment,
  getAppointment,
  getMyAppointments,
  getStoreAppointments,
  updateAppointmentStatus,
  confirmAppointment,
  completeAppointment,
  cancelAppointment,
  rescheduleAppointment,
  getAvailableTimeSlots,
} = require('../controllers/appointmentController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireStoreOwnership } = require('../middleware/roleMiddleware');
const { validateAppointmentBooking, validateObjectId, validatePagination } = require('../middleware/validationMiddleware');

// Public routes
router.get('/available-slots/:storeId', getAvailableTimeSlots);

// Customer routes
router.post('/', authenticate, validateAppointmentBooking, createAppointment);
router.get('/my/all', authenticate, validatePagination, getMyAppointments);
router.get('/:id', authenticate, validateObjectId('id'), getAppointment);
router.put('/:id/cancel', authenticate, validateObjectId('id'), cancelAppointment);
router.put('/:id/reschedule', authenticate, validateObjectId('id'), rescheduleAppointment);

// Store owner routes
router.get(
  '/store/:storeId',
  authenticate,
  requireStoreOwnership('storeId'),
  validatePagination,
  getStoreAppointments
);

router.put(
  '/:id/status',
  authenticate,
  validateObjectId('id'),
  updateAppointmentStatus
);

router.put(
  '/:id/confirm',
  authenticate,
  validateObjectId('id'),
  confirmAppointment
);

router.put(
  '/:id/complete',
  authenticate,
  validateObjectId('id'),
  completeAppointment
);

module.exports = router;