const Store = require('../models/Store');
const Subscription = require('../models/Subscription');
const Product = require('../models/Product');
const StoreProduct = require('../models/StoreProduct');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { calculateSubscriptionExpiry } = require('../utils/helpers');
const config = require('../config/env');

/**
 * Create new store
 * @route POST /api/stores
 * @access Private (Distributor/Store Owner)
 */
const createStore = asyncHandler(async (req, res) => {
  const storeData = {
    ...req.body,
    distributorId: req.user._id,
    subscriptionExpiry: calculateSubscriptionExpiry(
      new Date(),
      config.platform.subscriptionDurationMonths
    ),
  };

  const store = await Store.create(storeData);

  // Create initial subscription record
  await Subscription.create({
    storeId: store._id,
    startDate: new Date(),
    expiryDate: store.subscriptionExpiry,
    amount: config.platform.subscriptionYearlyFee,
    durationMonths: config.platform.subscriptionDurationMonths,
    status: 'pending',
    paymentStatus: 'pending',
  });

  res.status(201).json({
    success: true,
    message: 'Store created successfully',
    data: { store },
  });
});

/**
 * Get store by ID or slug
 * @route GET /api/stores/:identifier
 * @access Public
 */
const getStore = asyncHandler(async (req, res) => {
  const { identifier } = req.params;

  let store;
  
  // Check if identifier is MongoDB ObjectId
  if (identifier.match(/^[0-9a-fA-F]{24}$/)) {
    store = await Store.findById(identifier).populate('distributorId', 'name email phone');
  } else {
    store = await Store.findBySlug(identifier).populate('distributorId', 'name email phone');
  }

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  res.json({
    success: true,
    data: { store },
  });
});

/**
 * Get my stores
 * @route GET /api/stores/my/all
 * @access Private (Distributor/Store Owner)
 */
const getMyStores = asyncHandler(async (req, res) => {
  const stores = await Store.findByDistributor(req.user._id);

  res.json({
    success: true,
    data: { stores, count: stores.length },
  });
});

/**
 * Update store
 * @route PUT /api/stores/:id
 * @access Private (Store Owner)
 */
const updateStore = asyncHandler(async (req, res) => {
  const store = req.store; // Attached by requireStoreOwnership middleware

  // Update allowed fields
  const allowedUpdates = [
    'name', 'description', 'logo', 'bannerImage', 'contactInfo',
    'address', 'businessHours', 'settings', 'paymentMethods'
  ];

  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      store[field] = req.body[field];
    }
  });

  await store.save();

  res.json({
    success: true,
    message: 'Store updated successfully',
    data: { store },
  });
});

/**
 * Get store products
 * @route GET /api/stores/:storeId/products
 * @access Public
 */
const getStoreProducts = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { category, search, inStockOnly } = req.query;

  let query = { storeId, isActive: true, isVisible: true };

  if (inStockOnly === 'true') {
    query.stock = { $gt: 0 };
  }

  let storeProducts = await StoreProduct.find(query)
    .populate('productId')
    .sort({ displayOrder: 1, createdAt: -1 });

  // Filter by category
  if (category) {
    storeProducts = storeProducts.filter(sp => 
      sp.productId?.category?.toLowerCase() === category.toLowerCase()
    );
  }

  // Filter by search
  if (search) {
    const searchLower = search.toLowerCase();
    storeProducts = storeProducts.filter(sp =>
      sp.productId?.name?.toLowerCase().includes(searchLower) ||
      sp.productId?.description?.toLowerCase().includes(searchLower) ||
      sp.customDescription?.toLowerCase().includes(searchLower)
    );
  }

  res.json({
    success: true,
    data: { products: storeProducts, count: storeProducts.length },
  });
});

/**
 * Add product to store
 * @route POST /api/stores/:storeId/products
 * @access Private (Store Owner)
 */
const addProductToStore = asyncHandler(async (req, res) => {
  const { storeId } = req.params;
  const { productId, storePrice, stock, customDescription } = req.body;

  // Check if product exists
  const product = await Product.findById(productId);
  if (!product) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }

  // Check if product already exists in store
  const existingStoreProduct = await StoreProduct.findOne({ storeId, productId });
  if (existingStoreProduct) {
    return res.status(400).json({
      success: false,
      message: 'Product already exists in store',
    });
  }

  const storeProduct = await StoreProduct.create({
    storeId,
    productId,
    storePrice,
    stock,
    customDescription,
  });

  await storeProduct.populate('productId');

  res.status(201).json({
    success: true,
    message: 'Product added to store successfully',
    data: { storeProduct },
  });
});

/**
 * Update store product
 * @route PUT /api/stores/:storeId/products/:productId
 * @access Private (Store Owner)
 */
const updateStoreProduct = asyncHandler(async (req, res) => {
  const { storeId, productId } = req.params;

  const storeProduct = await StoreProduct.findOne({ storeId, productId });

  if (!storeProduct) {
    return res.status(404).json({
      success: false,
      message: 'Product not found in store',
    });
  }

  // Update allowed fields
  const allowedUpdates = ['storePrice', 'stock', 'isActive', 'isVisible', 'customDescription', 'displayOrder'];
  
  allowedUpdates.forEach(field => {
    if (req.body[field] !== undefined) {
      storeProduct[field] = req.body[field];
    }
  });

  await storeProduct.save();
  await storeProduct.populate('productId');

  res.json({
    success: true,
    message: 'Store product updated successfully',
    data: { storeProduct },
  });
});

/**
 * Remove product from store
 * @route DELETE /api/stores/:storeId/products/:productId
 * @access Private (Store Owner)
 */
const removeProductFromStore = asyncHandler(async (req, res) => {
  const { storeId, productId } = req.params;

  const storeProduct = await StoreProduct.findOne({ storeId, productId });

  if (!storeProduct) {
    return res.status(404).json({
      success: false,
      message: 'Product not found in store',
    });
  }

  // Soft delete
  storeProduct.isActive = false;
  storeProduct.isVisible = false;
  await storeProduct.save();

  res.json({
    success: true,
    message: 'Product removed from store successfully',
  });
});

/**
 * Get store statistics
 * @route GET /api/stores/:storeId/stats
 * @access Private (Store Owner)
 */
const getStoreStats = asyncHandler(async (req, res) => {
  const { storeId } = req.params;

  const store = await Store.findById(storeId);

  if (!store) {
    return res.status(404).json({
      success: false,
      message: 'Store not found',
    });
  }

  const Order = require('../models/Order');
  const Appointment = require('../models/Appointment');

  // Get order statistics
  const orderStats = await Order.aggregate([
    { $match: { storeId: store._id } },
    {
      $group: {
        _id: '$orderStatus',
        count: { $sum: 1 },
        total: { $sum: '$total' },
      },
    },
  ]);

  // Get product count
  const productCount = await StoreProduct.countDocuments({ storeId, isActive: true });

  // Get appointment count
  const appointmentCount = await Appointment.countDocuments({ storeId });

  // Get low stock items
  const lowStockItems = await StoreProduct.find({
    storeId,
    isActive: true,
  }).where('stock').lte(10);

  res.json({
    success: true,
    data: {
      store: {
        stats: store.stats,
        subscriptionStatus: store.subscriptionStatus,
        subscriptionExpiry: store.subscriptionExpiry,
        daysUntilExpiry: store.daysUntilExpiry,
      },
      orders: orderStats,
      productCount,
      appointmentCount,
      lowStockCount: lowStockItems.length,
      lowStockItems: lowStockItems.slice(0, 5), // Top 5 low stock items
    },
  });
});

module.exports = {
  createStore,
  getStore,
  getMyStores,
  updateStore,
  getStoreProducts,
  addProductToStore,
  updateStoreProduct,
  removeProductFromStore,
  getStoreStats,
};