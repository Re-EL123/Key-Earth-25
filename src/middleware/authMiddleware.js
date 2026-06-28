const { verifyFirebaseToken } = require('../config/firebase');
const User = require('../models/User');

/**
 * Verify Firebase token and attach user to request
 */
const authenticate = async (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'No token provided. Authorization header must be in format: Bearer <token>',
      });
    }

    const token = authHeader.substring(7);

    // Verify Firebase token
    const decodedToken = await verifyFirebaseToken(token);

    // Find user in database
    const user = await User.findByFirebaseUid(decodedToken.uid);

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'User not found. Please register first.',
      });
    }

    // Check if user is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.',
      });
    }

    // Attach user to request
    req.user = user;
    req.firebaseUser = decodedToken;

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    next();
  } catch (error) {
    console.error('Authentication error:', error);
    
    if (error.message === 'Invalid Firebase token') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token. Please login again.',
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Authentication failed',
      error: error.message,
    });
  }
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyFirebaseToken(token);
    const user = await User.findByFirebaseUid(decodedToken.uid);

    if (user && user.isActive) {
      req.user = user;
      req.firebaseUser = decodedToken;
    }

    next();
  } catch (error) {
    // Continue without authentication
    next();
  }
};

module.exports = {
  authenticate,
  optionalAuth,
};