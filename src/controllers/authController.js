const User = require('../models/User');
const DistributorCode = require('../models/DistributorCode');
const Driver = require('../models/Driver');
const { createFirebaseUser, deleteFirebaseUser } = require('../config/firebase');
const { sendWelcomeEmail } = require('../utils/emailService');
const { asyncHandler } = require('../middleware/errorMiddleware');

/**
 * Register new user
 * @route POST /api/auth/register
 * @access Public
 */
const register = asyncHandler(async (req, res) => {
  const { email, password, name, phone, role, distributorCode, ...otherData } = req.body;

  // Check if user already exists
  const existingUser = await User.findByEmail(email);
  if (existingUser) {
    return res.status(400).json({
      success: false,
      message: 'User with this email already exists',
    });
  }

  // Validate distributor code if role is distributor
  if (role === 'distributor') {
    if (!distributorCode) {
      return res.status(400).json({
        success: false,
        message: 'Distributor code is required for distributor registration',
      });
    }

    const code = await DistributorCode.findByCode(distributorCode);
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Invalid distributor code',
      });
    }

    if (!code.isValid()) {
      return res.status(400).json({
        success: false,
        message: 'This distributor code is not valid or has already been used',
        codeStatus: {
          isUsed: code.isUsed,
          status: code.status,
          expiryDate: code.expiryDate,
        },
      });
    }
  }

  try {
    // Create Firebase user
    const firebaseUser = await createFirebaseUser(email, password, name);

    // Create user in database
    const userData = {
      firebaseUid: firebaseUser.uid,
      email,
      name,
      phone,
      role,
      verificationStatus: role === 'distributor' ? 'pending' : 'verified',
    };

    if (role === 'distributor') {
      userData.distributorCode = distributorCode;
    }

    const user = await User.create(userData);

    // Mark distributor code as used
    if (role === 'distributor') {
      const code = await DistributorCode.findByCode(distributorCode);
      await code.markAsUsed(user._id);
    }

    // Create driver profile if role is driver
    if (role === 'driver' && otherData.driverInfo) {
      await Driver.create({
        userId: user._id,
        ...otherData.driverInfo,
      });
    }

    // Send welcome email
    await sendWelcomeEmail(user);

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          name: user.name,
          role: user.role,
          verificationStatus: user.verificationStatus,
          distributorCode: user.distributorCode,
        },
        firebaseUid: firebaseUser.uid,
      },
    });
  } catch (error) {
    // Rollback: delete Firebase user if database creation fails
    if (error.firebaseUid) {
      await deleteFirebaseUser(error.firebaseUid);
    }
    throw error;
  }
});

/**
 * Get current user profile
 * @route GET /api/auth/me
 * @access Private
 */
const getMe = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('-__v');

  // Get additional data based on role
  let additionalData = {};

  if (user.role === 'driver') {
    const driver = await Driver.findByUserId(user._id);
    additionalData.driverProfile = driver;
  }

  if (user.role === 'storeOwner' || user.role === 'distributor') {
    const Store = require('../models/Store');
    const stores = await Store.findByDistributor(user._id);
    additionalData.stores = stores;
  }

  res.json({
    success: true,
    data: {
      user,
      ...additionalData,
    },
  });
});

/**
 * Update user profile
 * @route PUT /api/auth/profile
 * @access Private
 */
const updateProfile = asyncHandler(async (req, res) => {
  const { name, phone, address, profileImage } = req.body;

  const user = await User.findById(req.user._id);

  if (name) user.name = name;
  if (phone) user.phone = phone;
  if (address) user.address = address;
  if (profileImage) user.profileImage = profileImage;

  await user.save();

  res.json({
    success: true,
    message: 'Profile updated successfully',
    data: { user },
  });
});

/**
 * Delete user account
 * @route DELETE /api/auth/account
 * @access Private
 */
const deleteAccount = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id);

  // Delete from Firebase
  await deleteFirebaseUser(user.firebaseUid);

  // Soft delete: deactivate user
  user.isActive = false;
  await user.save();

  res.json({
    success: true,
    message: 'Account deleted successfully',
  });
});

/**
 * Verify distributor code (public endpoint for validation)
 * @route POST /api/auth/verify-distributor-code
 * @access Public
 */
const verifyDistributorCode = asyncHandler(async (req, res) => {
  const { code } = req.body;

  if (!code) {
    return res.status(400).json({
      success: false,
      message: 'Distributor code is required',
    });
  }

  const distributorCode = await DistributorCode.findByCode(code);

  if (!distributorCode) {
    return res.status(404).json({
      success: false,
      message: 'Distributor code not found',
    });
  }

  const isValid = distributorCode.isValid();

  res.json({
    success: true,
    data: {
      isValid,
      code: distributorCode.code,
      status: distributorCode.status,
      isUsed: distributorCode.isUsed,
      expiryDate: distributorCode.expiryDate,
      ...(isValid && {
        distributorName: distributorCode.distributorName,
      }),
    },
  });
});

module.exports = {
  register,
  getMe,
  updateProfile,
  deleteAccount,
  verifyDistributorCode,
};