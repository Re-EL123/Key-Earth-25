/**
 * Role-based access control middleware
 */
const requireRole = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${allowedRoles.join(', ')}`,
        userRole: req.user.role,
      });
    }

    next();
  };
};

/**
 * Check if user is verified distributor
 */
const requireVerifiedDistributor = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
  }

  if (!['distributor', 'storeOwner'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'Distributor or store owner access required',
    });
  }

  if (req.user.verificationStatus !== 'verified') {
    return res.status(403).json({
      success: false,
      message: 'Your distributor account is not verified yet',
      verificationStatus: req.user.verificationStatus,
    });
  }

  next();
};

/**
 * Check if user owns the resource (store)
 */
const requireStoreOwnership = (storeIdParam = 'storeId') => {
  return async (req, res, next) => {
    try {
      const storeId = req.params[storeIdParam] || req.body[storeIdParam];
      
      if (!storeId) {
        return res.status(400).json({
          success: false,
          message: 'Store ID is required',
        });
      }

      const Store = require('../models/Store');
      const store = await Store.findById(storeId);

      if (!store) {
        return res.status(404).json({
          success: false,
          message: 'Store not found',
        });
      }

      // Super admin can access all stores
      if (req.user.role === 'superAdmin') {
        req.store = store;
        return next();
      }

      // Check ownership
      if (store.distributorId.toString() !== req.user._id.toString()) {
        return res.status(403).json({
          success: false,
          message: 'You do not have permission to access this store',
        });
      }

      req.store = store;
      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error verifying store ownership',
        error: error.message,
      });
    }
  };
};

/**
 * Check if store subscription is active
 */
const requireActiveSubscription = async (req, res, next) => {
  try {
    if (!req.store) {
      return res.status(400).json({
        success: false,
        message: 'Store context required',
      });
    }

    if (!req.store.isSubscriptionActive()) {
      return res.status(403).json({
        success: false,
        message: 'Store subscription is not active. Please renew your subscription.',
        subscriptionStatus: req.store.subscriptionStatus,
        subscriptionExpiry: req.store.subscriptionExpiry,
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Error checking subscription status',
      error: error.message,
    });
  }
};

module.exports = {
  requireRole,
  requireVerifiedDistributor,
  requireStoreOwnership,
  requireActiveSubscription,
};