const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { asyncHandler } = require('../middleware/errorMiddleware');
const { getPagination, formatPaginationResponse } = require('../utils/helpers');
const { validatePagination, validateObjectId } = require('../middleware/validationMiddleware');

/**
 * Get all products
 * @route GET /api/products
 * @access Public
 */
router.get('/', validatePagination, asyncHandler(async (req, res) => {
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
}));

/**
 * Get product by ID
 * @route GET /api/products/:id
 * @access Public
 */
router.get('/:id', validateObjectId('id'), asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product || !product.isActive) {
    return res.status(404).json({
      success: false,
      message: 'Product not found',
    });
  }

  res.json({
    success: true,
    data: { product },
  });
}));

/**
 * Get all categories
 * @route GET /api/products/categories/all
 * @access Public
 */
router.get('/categories/all', asyncHandler(async (req, res) => {
  const categories = await Product.distinct('category', { isActive: true });

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
}));

module.exports = router;