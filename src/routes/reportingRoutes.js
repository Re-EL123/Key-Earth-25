const express = require('express');
const router = express.Router();
const {
  generateDistributorPurchasesReport,
  generateStoreSalesReport,
  generateDriverEarningsReport,
  generateSubscriptionReport,
  generateAppointmentReport,
  getMyReports,
  downloadReport,
} = require('../controllers/reportingController');
const { authenticate } = require('../middleware/authMiddleware');
const { requireRole } = require('../middleware/roleMiddleware');
const { validateObjectId, validateDateRange, body, handleValidationErrors } = require('../middleware/validationMiddleware');

// All routes require authentication
router.use(authenticate);

// Report generation - Super Admin only
router.post(
  '/distributor-purchases',
  requireRole('superAdmin'),
  validateDateRange,
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  handleValidationErrors,
  generateDistributorPurchasesReport
);

router.post(
  '/driver-earnings',
  requireRole('superAdmin'),
  validateDateRange,
  generateDriverEarningsReport
);

router.post(
  '/subscriptions',
  requireRole('superAdmin'),
  validateDateRange,
  generateSubscriptionReport
);

// Store owners can generate their own reports
router.post(
  '/store-sales',
  body('storeId').isMongoId(),
  body('startDate').isISO8601(),
  body('endDate').isISO8601(),
  handleValidationErrors,
  generateStoreSalesReport
);

router.post(
  '/appointments',
  validateDateRange,
  generateAppointmentReport
);

// Get and download reports
router.get('/my/all', getMyReports);
router.get('/:id/download', validateObjectId('id'), downloadReport);

module.exports = router;