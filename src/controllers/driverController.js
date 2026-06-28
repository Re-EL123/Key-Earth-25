const Driver = require('../models/Driver');
const Order = require('../models/Order');
const DriverEarning = require('../models/DriverEarning');
const User = require('../models/User');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getPagination, formatPaginationResponse } = require('../utils/helpers');

/**
 * Register as driver
 * @route POST /api/drivers/register
 * @access Private (User with driver role)
 */
const registerDriver = asyncHandler(async (req, res) => {
  // Check if user already has driver profile
  const existingDriver = await Driver.findByUserId(req.user._id);
  
  if (existingDriver) {
    return res.status(400).json({
      success: false,
      message: 'Driver profile already exists',
    });
  }

  const driverData = {
    ...req.body,
    userId: req.user._id,
    status: 'pending',
  };

  const driver = await Driver.create(driverData);

  res.status(201).json({
    success: true,
    message: 'Driver registration submitted successfully. Awaiting approval.',
    data: { driver },
  });
});

/**
 * Get driver profile
 * @route GET /api/drivers/me
 * @access Private (Driver)
 */
const getMyDriverProfile = asyncHandler(async (req, res) => {
  const driver = await Driver.findByUserId(req.user._id).populate('userId', 'name email phone');

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  res.json({
    success: true,
    data: { driver },
  });
});

/**
 * Update driver profile
 * @route PUT /api/drivers/me
 * @access Private (Driver)
 */
const updateDriverProfile = asyncHandler(async (req, res) => {
  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  // Allowed updates
  const allowedUpdates = [
    'vehicleType', 'vehicleNumber', 'vehicleModel', 'vehicleColor',
    'licenseNumber', 'licenseExpiry', 'documents', 'bankDetails', 'workingHours'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      driver[field] = req.body[field];
    }
  });

  await driver.save();

  res.json({
    success: true,
    message: 'Driver profile updated successfully',
    data: { driver },
  });
});

/**
 * Update driver location
 * @route PUT /api/drivers/location
 * @access Private (Driver)
 */
const updateLocation = asyncHandler(async (req, res) => {
  const { longitude, latitude } = req.body;

  if (!longitude || !latitude) {
    return res.status(400).json({
      success: false,
      message: 'Longitude and latitude are required',
    });
  }

  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  await driver.updateLocation(longitude, latitude);

  res.json({
    success: true,
    message: 'Location updated successfully',
    data: {
      location: driver.currentLocation,
    },
  });
});

/**
 * Go online/offline
 * @route PUT /api/drivers/availability
 * @access Private (Driver)
 */
const updateAvailability = asyncHandler(async (req, res) => {
  const { status } = req.body; // 'online' or 'offline'

  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  if (driver.status !== 'approved' && driver.status !== 'active') {
    return res.status(403).json({
      success: false,
      message: 'Driver account is not approved',
    });
  }

  if (status === 'online') {
    await driver.goOnline();
  } else {
    await driver.goOffline();
  }

  res.json({
    success: true,
    message: `Driver is now ${status}`,
    data: { driver },
  });
});

/**
 * Get available deliveries
 * @route GET /api/drivers/deliveries/available
 * @access Private (Driver)
 */
const getAvailableDeliveries = asyncHandler(async (req, res) => {
  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  // Get orders ready for delivery without assigned driver
  const availableOrders = await Order.find({
    orderStatus: 'ready',
    driverId: null,
  })
    .populate('storeId', 'name logo address contactInfo')
    .populate('customerId', 'name phone')
    .sort({ createdAt: 1 })
    .limit(20);

  res.json({
    success: true,
    data: { orders: availableOrders, count: availableOrders.length },
  });
});

/**
 * Get my deliveries
 * @route GET /api/drivers/deliveries/mine
 * @access Private (Driver)
 */
const getMyDeliveries = asyncHandler(async (req, res) => {
  const { status } = req.query;
  
  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  const query = { driverId: driver._id };
  
  if (status) {
    query.orderStatus = status;
  } else {
    query.orderStatus = { $in: ['in_transit', 'ready'] };
  }

  const orders = await Order.find(query)
    .populate('storeId', 'name logo address contactInfo')
    .populate('customerId', 'name phone')
    .sort({ createdAt: -1 });

  res.json({
    success: true,
    data: { orders, count: orders.length },
  });
});

/**
 * Accept delivery
 * @route POST /api/drivers/deliveries/:orderId/accept
 * @access Private (Driver)
 */
const acceptDelivery = asyncHandler(async (req, res) => {
  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  if (driver.availability !== 'available') {
    return res.status(400).json({
      success: false,
      message: 'You must be available to accept deliveries',
    });
  }

  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.driverId) {
    return res.status(400).json({
      success: false,
      message: 'This delivery has already been assigned',
    });
  }

  await order.assignDriver(driver._id);
  await driver.setBusy();

  // Create driver earning record
  const { calculateDeliveryFeeSplit } = require('../utils/helpers');
  const feeSplit = calculateDeliveryFeeSplit(order.deliveryFee);
  
  await DriverEarning.create({
    driverId: driver._id,
    orderId: order._id,
    deliveryFee: order.deliveryFee,
    driverAmount: feeSplit.driverAmount,
    platformAmount: feeSplit.platformAmount,
    deliveryDate: new Date(),
  });

  res.json({
    success: true,
    message: 'Delivery accepted successfully',
    data: { order },
  });
});

/**
 * Update delivery status
 * @route PUT /api/drivers/deliveries/:orderId/status
 * @access Private (Driver)
 */
const updateDeliveryStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.driverId.toString() !== driver._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this delivery',
    });
  }

  await order.updateStatus(status, note, req.user._id);

  // If delivered, update driver stats and make available
  if (status === 'delivered') {
    const earning = await DriverEarning.findOne({ orderId: order._id });
    if (earning) {
      await driver.incrementDeliveryStats(earning.driverAmount);
    }
    await driver.goOnline();
  }

  res.json({
    success: true,
    message: 'Delivery status updated successfully',
    data: { order },
  });
});

/**
 * Complete delivery
 * @route POST /api/drivers/deliveries/:orderId/complete
 * @access Private (Driver)
 */
const completeDelivery = asyncHandler(async (req, res) => {
  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  const order = await Order.findById(req.params.orderId);

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  if (order.driverId.toString() !== driver._id.toString()) {
    return res.status(403).json({
      success: false,
      message: 'You are not assigned to this delivery',
    });
  }

  await order.markAsDelivered();

  const earning = await DriverEarning.findOne({ orderId: order._id });
  if (earning) {
    await driver.incrementDeliveryStats(earning.driverAmount);
  }

  await driver.goOnline();

  res.json({
    success: true,
    message: 'Delivery completed successfully',
    data: { order },
  });
});

/**
 * Get driver earnings
 * @route GET /api/drivers/earnings
 * @access Private (Driver)
 */
const getEarnings = asyncHandler(async (req, res) => {
  const { page, limit, payoutStatus } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  const query = { driverId: driver._id };
  if (payoutStatus) query.payoutStatus = payoutStatus;

  const [earnings, total] = await Promise.all([
    DriverEarning.find(query)
      .populate('orderId', 'orderNumber deliveryAddress')
      .skip(skip)
      .limit(pageLimit)
      .sort({ deliveryDate: -1 }),
    DriverEarning.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(earnings, total, pageNum, pageLimit),
    summary: {
      totalEarnings: driver.stats.totalEarnings,
      pendingPayout: driver.stats.pendingPayout,
      completedDeliveries: driver.stats.completedDeliveries,
    },
  });
});

/**
 * Get earnings summary
 * @route GET /api/drivers/earnings/summary
 * @access Private (Driver)
 */
const getEarningsSummary = asyncHandler(async (req, res) => {
  const { startDate, endDate } = req.query;

  const driver = await Driver.findByUserId(req.user._id);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver profile not found',
    });
  }

  const report = await DriverEarning.getEarningsReport(
    driver._id,
    startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    endDate || new Date()
  );

  res.json({
    success: true,
    data: {
      report: report[0] || {},
      driverStats: driver.stats,
    },
  });
});

module.exports = {
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
};