const Product = require('../models/Product');
const StoreProduct = require('../models/StoreProduct');
const Store = require('../models/Store');
const Address = require('../models/Address');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getPagination, formatPaginationResponse } = require('../utils/helpers');

/**
 * Browse all products
 * @route GET /api/products
 * @access Public
 */
const browseProducts = asyncHandler(async (req, res) => {
  const { page, limit, category, search, featured } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = { isActive: true };

  if (category) query.category = category;
  if (featured === 'true') query.isFeatured = true;
  if (search) {
    query.$text = { $search: search };
  }

  const [products, total] = await Promise.all([
    Product.find(query)
      .skip(skip)
      .limit(pageLimit)
      .sort(search ? { score: { $meta: 'textScore' } } : { createdAt: -1 }),
    Product.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(products, total, pageNum, pageLimit),
  });
});

/**
 * Get product details
 * @route GET /api/products/:id
 * @access Public
 */
const getProductDetails = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || !product.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }

  // Find stores selling this product
  const storesSellingProduct = await StoreProduct.find({
    productId: product._id,
    isActive: true,
    isVisible: true,
    stock: { $gt: 0 },
  })
    .populate('storeId', 'name slug logo address')
    .limit(10);

  res.json({
    success: true,
    data: {
      product,
      availableStores: storesSellingProduct,
    },
  });
});

/**
 * Get product categories
 * @route GET /api/products/categories/all
 * @access Public
 */
const getCategories = asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isActive: true });

  // Get count for each category
  const categoriesWithCount = await Promise.all(
    categories.map(async (category) => {
      const count = await Product.countDocuments({ category, isActive: true });
      return { name: category, count };
    })
  );

  res.json({
    success: true,
    data: { categories: categoriesWithCount },
  });
});

/**
 * Browse stores
 * @route GET /api/stores
 * @access Public
 */
const browseStores = asyncHandler(async (req, res) => {
  const { page, limit, city, state, search } = req.query;
  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);

  const query = {
    isActive: true,
    subscriptionStatus: 'active',
  };

  if (city) query['address.city'] = { $regex: city, $options: 'i' };
  if (state) query['address.state'] = { $regex: state, $options: 'i' };
  if (search) {
    query.$or = [
      { name: { $regex: search, $options: 'i' } },
      { description: { $regex: search, $options: 'i' } },
    ];
  }

  const [stores, total] = await Promise.all([
    Store.find(query)
      .select('-settings -metadata')
      .skip(skip)
      .limit(pageLimit)
      .sort({ 'stats.averageRating': -1, createdAt: -1 }),
    Store.countDocuments(query),
  ]);

  res.json({
    success: true,
    ...formatPaginationResponse(stores, total, pageNum, pageLimit),
  });
});

/**
 * Get my addresses
 * @route GET /api/addresses
 * @access Private (Customer)
 */
const getMyAddresses = asyncHandler(async (req, res) => {
  const addresses = await Address.findByUser(req.user._id);

  res.json({
    success: true,
    data: { addresses, count: addresses.length },
  });
});

/**
 * Create address
 * @route POST /api/addresses
 * @access Private (Customer)
 */
const createAddress = asyncHandler(async (req, res) => {
  const addressData = {
    ...req.body,
    userId: req.user._id,
  };

  const address = await Address.create(addressData);

  res.status(201).json({
    success: true,
    message: 'Address created successfully',
    data: { address },
  });
});

/**
 * Update address
 * @route PUT /api/addresses/:id
 * @access Private (Customer)
 */
const updateAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found',
    });
  }

  Object.assign(address, req.body);
  await address.save();

  res.json({
    success: true,
    message: 'Address updated successfully',
    data: { address },
  });
});

/**
 * Delete address
 * @route DELETE /api/addresses/:id
 * @access Private (Customer)
 */
const deleteAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found',
    });
  }

  await address.deleteOne();

  res.json({
    success: true,
    message: 'Address deleted successfully',
  });
});

/**
 * Set default address
 * @route PUT /api/addresses/:id/set-default
 * @access Private (Customer)
 */
const setDefaultAddress = asyncHandler(async (req, res) => {
  const address = await Address.findOne({
    _id: req.params.id,
    userId: req.user._id,
  });

  if (!address) {
    return res.status(404).json({
      success: false,
      message: 'Address not found',
    });
  }

  await address.setAsDefault();

  res.json({
    success: true,
    message: 'Default address set successfully',
    data: { address },
  });
});

module.exports = {
  browseProducts,
  getProductDetails,
  getCategories,
  browseStores,
  getMyAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
  setDefaultAddress,
};