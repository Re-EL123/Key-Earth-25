const express = require('express');
const router = express.Router();
const {
  register,
  getMe,
  updateProfile,
  deleteAccount,
  verifyDistributorCode,
} = require('../controllers/authController');
const { authenticate } = require('../middleware/authMiddleware');
const { validateRegistration } = require('../middleware/validationMiddleware');

// Public routes
router.post('/register', validateRegistration, register);
router.post('/verify-distributor-code', verifyDistributorCode);

// Protected routes
router.get('/me', authenticate, getMe);
router.put('/profile', authenticate, updateProfile);
router.delete('/account', authenticate, deleteAccount);

module.exports = router;