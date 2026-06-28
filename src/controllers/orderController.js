const Order = require('../models/Order');
const Store = require('../models/Store');
const StoreProduct = require('../models/StoreProduct');
const Address = require('../models/Address');
const DriverEarning = require('../models/DriverEarning');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { calculateOrderTotal, calculateDeliveryFeeSplit, getPagination, formatPaginationResponse } = require('../utils/helpers');
const { sendOrderConfirmationEmail } = require('../utils/emailService');

/**
 * Create new order
 * @route POST /api/orders
 * @access Private (Customer/Distributor)
 */
const createOrder = asyncHandler(async (req, res) => {
  const { storeId, items, addressId, paymentMethod, notes } = req.body;

  // Verify store exists and is active
  const store = await Store.findById(storeId);
  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  if (!store.canAcceptOrders()) {
    return res.status(400).json({
      success: false,
      message: 'Store is not accepting orders at the moment',
      reason: store.subscriptionStatus !== 'active' ? 'Subscription expired' : 'Store temporarily closed',
    });
  }

  // Verify address
  const deliveryAddress = await Address.findById(addressId);
  if (!deliveryAddress || deliveryAddress.userId.toString() !== req.user._id.toString()) {
    return res.status(404).json({
      success: false,
      message: 'Delivery address not found',
    });
  }

  // Process and validate items
  const processedItems = [];
  let subtotal = 0;

  for (const item of items) {
    const storeProduct = await StoreProduct.findOne({
      storeId,
      productId: item.productId,
      isActive: true,
    }).populate('productId');

    if (!storeProduct) {
      return res.status(404).json({
        success: false,
        message: `Product ${item.productId} not found in store`,
      });
    }

    if (!storeProduct.isInStock()) {
      return res.status(400).json({
        success: false,
        message: `Product ${storeProduct.productId.name} is out of stock`,
      });
    }

    if (storeProduct.stock < item.quantity) {
      return res.status(400).json({
        success: false,
        message: `Insufficient stock for ${storeProduct.productId.name}. Available: ${storeProduct.stock}`,
      });
    }

    const price = storeProduct.getDiscountedPrice();
    const itemSubtotal = price * item.quantity;

    processedItems.push({
      productId: item.productId,
      storeProductId: storeProduct._id,
      name: storeProduct.productId.name,
      sku: storeProduct.productId.sku,
      price,
      quantity: item.quantity,
      subtotal: itemSubtotal,
    });

    subtotal += itemSubtotal;
  }

  // Calculate totals
  const deliveryFee = store.settings.deliveryFee || 0;
  const tax = (subtotal * (store.settings.taxRate || 0)) / 100;
  const total = subtotal + deliveryFee + tax;

  // Check minimum order amount
  if (store.settings.minimumOrderAmount && subtotal < store.settings.minimumOrderAmount) {
    return res.status(400).json({
      success: false,
      message: `Minimum order amount is ${store.settings.minimumOrderAmount}`,
    });
  }

  // Determine buyer type
  const buyerType = req.user.role === 'distributor' ? 'distributor' : 'customer';

  // Create order
  const order = await Order.create({
    customerId: req.user._id,
    buyerType,
    storeId,
    distributorCode: req.user.distributorCode,
    items: processedItems,
    subtotal,
    deliveryFee,
    tax,
    total,
    paymentMethod,
    addressId,
    deliveryAddress: {
      fullName: deliveryAddress.fullName,
      phone: deliveryAddress.phone,
      street: deliveryAddress.street,
      city: deliveryAddress.city,
      state: deliveryAddress.state,
      country: deliveryAddress.country,
      postalCode: deliveryAddress.postalCode,
      coordinates: deliveryAddress.coordinates,
    },
    notes: {
      customer: notes,
    },
  });

  // Decrease stock for each item
  for (const item of processedItems) {
    const storeProduct = await StoreProduct.findById(item.storeProductId);
    await storeProduct.decreaseStock(item.quantity);
  }

  // Update store stats
  await store.incrementOrderStats(total);

  // Send confirmation email
  await sendOrderConfirmationEmail(order, req.user);

  await order.populate('storeId', 'name logo');

  res.status(201).json({
    success: true,
    message: 'Order created successfully',
    data: { order },
  });
});

/**
 * Get order by ID
 * @route GET /api/orders/:id
 * @access Private
 */
const getOrder = asyncHandler(async (req, res) => {
  const order = await Order.findById(req.params.id)
    .populate('customerId', 'name email phone')
    .populate('storeId', 'name logo contactInfo')
    .populate('driverId');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Authorization check
  const isAuthorized = 
    req.user._id.toString() === order.customerId._id.toString() ||
    req.user._id.toString() === order.storeId.distributorId.toString() ||
    req.user.role === 'superAdmin' ||
    (order.driverId && req.user._id.toString() === order.driverId.userId.toString());

  if (!isAuthorized) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to view this order',
    });
  }

  res.json({
    success: true,
    data: { order },
  });
});

/**
 * Get order by order number
 * @route GET /api/orders/track/:orderNumber
 * @access Public
 */
const trackOrder = asyncHandler(async (req, res) => {
  const order = await Order.findByOrderNumber(req.params.orderNumber)
    .populate('storeId', 'name logo contactInfo')
    .populate('driverId');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Return limited information for public tracking
  res.json({
    success: true,
    data: {
      orderNumber: order.orderNumber,
      orderStatus: order.orderStatus,
      createdAt: order.createdAt,
      estimatedDeliveryTime: order.estimatedDeliveryTime,
      statusHistory: order.statusHistory,
      store: {
        name: order.storeId.name,
        logo: order.storeId.logo,
      },
    },
  });
});

/**
 * Get my orders
 * @route GET /api/orders/my/all
 * @access Private (Customer)
 */
const getMyOrders = asyncHandler(async (req, res) => {
  const { page, limit, status } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { customerId: req.user._id };
  if (status) query.orderStatus = status;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('storeId', 'name logo')
      .skip(skip)
      .limit(pageLimit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(orders, total, pageNum, pageLimit),
  });
});

/**
 * Get store orders
 * @route GET /api/orders/store/:storeId
 * @access Private (Store Owner)
 */
const getStoreOrders = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { page, limit, status, buyerType } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { storeId };
  if (status) query.orderStatus = status;
  if (buyerType) query.buyerType = buyerType;

  const [orders, total] = await Promise.all([
    Order.find(query)
      .populate('customerId', 'name email phone')
      .populate('driverId')
      .skip(skip)
      .limit(pageLimit)
      .sort({ createdAt: -1 }),
    Order.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(orders, total, pageNum, pageLimit),
  });
});

/**
 * Update order status
 * @route PUT /api/orders/:id/status
 * @access Private (Store Owner/Admin)
 */
const updateOrderStatus = asyncHandler(async (req, res) => {
  const { status, note } = req.body;

  const order = await Order.findById(req.params.id)
    .populate('storeId')
    .populate('customerId');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Authorization check
  const isStoreOwner = order.storeId.distributorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'superAdmin';

  if (!isStoreOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to update this order',
    });
  }

  await order.updateStatus(status, note, req.user._id);

  res.json({
    success: true,
    message: 'Order status updated successfully',
    data: { order },
  });
});

/**
 * Assign driver to order
 * @route PUT /api/orders/:id/assign-driver
 * @access Private (Store Owner/Admin)
 */
const assignDriver = asyncHandler(async (req, res) => {
  const { driverId } = req.body;

  const order = await Order.findById(req.params.id).populate('storeId');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  const Driver = require('../models/Driver');
  const driver = await Driver.findById(driverId);

  if (!driver) {
    return res.status(404).json({
      success: false,
      message: 'Driver not found',
    });
  }

  if (driver.availability !== 'available') {
    return res.status(400).json({
      success: false,
      message: 'Driver is not available',
      driverStatus: driver.availability,
    });
  }

  await order.assignDriver(driverId);
  await driver.setBusy();

  // Create driver earning record
  const feeSplit = calculateDeliveryFeeSplit(order.deliveryFee);
  
  await DriverEarning.create({
    driverId,
    orderId: order._id,
    deliveryFee: order.deliveryFee,
    driverAmount: feeSplit.driverAmount,
    platformAmount: feeSplit.platformAmount,
    deliveryDate: new Date(),
  });

  res.json({
    success: true,
    message: 'Driver assigned successfully',
    data: { order },
  });
});

/**
 * Cancel order
 * @route PUT /api/orders/:id/cancel
 * @access Private (Customer/Store Owner)
 */
const cancelOrder = asyncHandler(async (req, res) => {
  const { reason } = req.body;

  const order = await Order.findById(req.params.id)
    .populate('storeId')
    .populate('items.storeProductId');

  if (!order) {
    return res.status(404).json({
      success: false,
      message: 'Order not found',
    });
  }

  // Authorization check
  const isCustomer = order.customerId.toString() === req.user._id.toString();
  const isStoreOwner = order.storeId.distributorId.toString() === req.user._id.toString();
  const isAdmin = req.user.role === 'superAdmin';

  if (!isCustomer && !isStoreOwner && !isAdmin) {
    return res.status(403).json({
      success: false,
      message: 'Not authorized to cancel this order',
    });
  }

  if (!order.canBeCancelled()) {
    return res.status(400).json({
      success: false,
      message: 'Order cannot be cancelled in its current status',
      currentStatus: order.orderStatus,
    });
  }

  // Restore stock
  for (const item of order.items) {
    const storeProduct = await StoreProduct.findById(item.storeProductId);
    if (storeProduct) {
      await storeProduct.increaseStock(item.quantity);
    }
  }

  await order.cancel(reason, req.user._id);

  // If driver was assigned, make them available
  if (order.driverId) {
    const Driver = require('../models/Driver');
    const driver = await Driver.findById(order.driverId);
    if (driver) {
      await driver.goOnline();
    }
  }

  res.json({
    success: true,
    message: 'Order cancelled successfully',
    data: { order },
  });
});

module.exports = {
  createOrder,
  getOrder,
  trackOrder,
  getMyOrders,
  getStoreOrders,
  updateOrderStatus,
  assignDriver,
  cancelOrder,
};