const Subscription = require('../models/Subscription');
const Store = require('../models/Store');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { calculateSubscriptionExpiry, getPagination, formatPaginationResponse } = require('../utils/helpers');
const config = require('../config/env');

/**
 * Create subscription (payment initiated)
 * @route POST /api/subscriptions
 * @access Private (Store Owner)
 */
const createSubscription = asyncHandler(async (req, res) => {
  const { storeId, durationMonths, paymentMethod } = req.body;

  const store = await Store.findById(storeId);

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  // Check ownership
  if (store.distributorId.toString() !== req.user._id.toString() && req.user.role !== 'superAdmin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to create subscription for this store',
    });
  }

  const duration = durationMonths || config.platform.subscriptionDurationMonths;
  const amount = config.platform.subscriptionYearlyFee * (duration / 12);

  const startDate = new Date();
  const expiryDate = calculateSubscriptionExpiry(startDate, duration);

  const subscription = await Subscription.create({
    storeId,
    startDate,
    expiryDate,
    amount,
    durationMonths: duration,
    paymentMethod,
    status: 'pending',
    paymentStatus: 'pending',
  });

  res.status(201).json({
    success: true,
    message: 'Subscription created. Please complete payment.',
    data: { subscription },
  });
});

/**
 * Confirm subscription payment
 * @route PUT /api/subscriptions/:id/confirm-payment
 * @access Private (Super Admin/Store Owner)
 */
const confirmSubscriptionPayment = asyncHandler(async (req, res) => {
  const { paymentReference, paymentMethod } = req.body;

  const subscription = await Subscription.findById(req.params.id).populate('storeId');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  // Mark subscription as paid
  await subscription.markAsPaid(paymentReference, paymentMethod);

  // Update store subscription status
  const store = await Store.findById(subscription.storeId._id);
  store.subscriptionExpiry = subscription.expiryDate;
  store.subscriptionStatus = 'active';
  store.isActive = true;
  await store.save();

  res.json({
    success: true,
    message: 'Subscription payment confirmed successfully',
    data: { subscription, store },
  });
});

/**
 * Renew subscription
 * @route POST /api/subscriptions/:storeId/renew
 * @access Private (Store Owner)
 */
const renewSubscription = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { durationMonths, paymentMethod } = req.body;

  const store = await Store.findById(storeId);

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  // Check ownership
  if (store.distributorId.toString() !== req.user._id.toString() && req.user.role !== 'superAdmin') {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to renew subscription for this store',
    });
  }

  const duration = durationMonths || config.platform.subscriptionDurationMonths;
  const amount = config.platform.subscriptionYearlyFee * (duration / 12);

  // Calculate new expiry date from current expiry or now
  const startDate = store.subscriptionExpiry > new Date() 
    ? store.subscriptionExpiry 
    : new Date();
  
  const expiryDate = calculateSubscriptionExpiry(startDate, duration);

  const subscription = await Subscription.create({
    storeId,
    startDate: new Date(),
    expiryDate,
    amount,
    durationMonths: duration,
    paymentMethod,
    status: 'pending',
    paymentStatus: 'pending',
  });

  res.status(201).json({
    success: true,
    message: 'Subscription renewal initiated. Please complete payment.',
    data: { subscription },
  });
});

/**
 * Get subscription by ID
 * @route GET /api/subscriptions/:id
 * @access Private
 */
const getSubscription = asyncHandler(async (req, res) => {
  const subscription = await Subscription.findById(req.params.id)
    .populate('storeId', 'name slug distributorId')
    .populate('processedBy', 'name email');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  // Authorization check
  const isStoreOwner = subscription.storeId.distributorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'superAdmin';

  if (!isStoreOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this subscription',
    });
  }

  res.json({
    success: true,
    data: { subscription },
  });
});

/**
 * Get store subscriptions
 * @route GET /api/subscriptions/store/:storeId
 * @access Private (Store Owner)
 */
const getStoreSubscriptions = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { page, limit, status } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { storeId };
  if (status) query.status = status;

  const [subscriptions, total] = await Promise.all([
    Subscription.find(query)
      .skip(skip)
      .limit(pageLimit)
      .sort({ createdAt: -1 }),
    Subscription.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(subscriptions, total, pageNum, pageLimit),
  });
});

/**
 * Get my store subscriptions
 * @route GET /api/subscriptions/my/all
 * @access Private (Store Owner)
 */
const getMySubscriptions = asyncHandler(async (req, res) => {
  const stores = await Store.find({ distributorId: req.user._id }).select('_id');
  const storeIds = stores.map(store => store._id);

  const subscriptions = await Subscription.find({ storeId: { $in: storeIds } })
    .populate('storeId', 'name slug')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { subscriptions, count: subscriptions.length },
  });
});

/**
 * Cancel subscription
 * @route PUT /api/subscriptions/:id/cancel
 * @access Private (Store Owner/Admin)
 */
const cancelSubscription = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const subscription = await Subscription.findById(req.params.id).populate('storeId');

  if (!subscription) {
    return res.status(404).json({
      success: false,
      message: 'Subscription not found',
    });
  }

  await subscription.cancel(reason);

  res.json({
    success: true,
    message: 'Subscription cancelled successfully',
    data: { subscription },
  });
});

/**
 * Get expiring subscriptions (Admin)
 * @route GET /api/subscriptions/expiring/soon
 * @access Private (Super Admin)
 */
const getExpiringSubscriptions = asyncHandler(async (req, res) => {
  const { days = 30 } = req.query;

  const expiringSubscriptions = await Subscription.findExpiringSubscriptions(parseInt(days));

  res.json({
    success: true,
    data: { subscriptions: expiringSubscriptions, count: expiringSubscriptions.length },
  });
});

module.exports = {
  createSubscription,
  confirmSubscriptionPayment,
  renewSubscription,
  getSubscription,
  getStoreSubscriptions,
  getMySubscriptions,
  cancelSubscription,
  getExpiringSubscriptions,
};