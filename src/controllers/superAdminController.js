const User = require('../models/User');

const DistributorCode = require('../models/DistributorCode');

const Store = require('../models/Store');

const Product = require('../models/Product');

const Order = require('../models/Order');

const Driver = require('../models/Driver');

const Subscription = require('../models/Subscription');

const { asyncHandler } = require('../middleware/errorMiddleware');

const { getPagination, formatPaginationResponse } = require('../utils/helpers');

const { sendDistributorVerificationEmail, sendDriverApprovalEmail } = require('../utils/emailService');

const csv = require('csv-parser');

const fs = require('fs');



/**

 * Get dashboard statistics

 * @route GET /api/admin/dashboard

 * @access Private (Super Admin)

 */

const getDashboardStats = asyncHandler(async (req, res) => {

  const [

    totalUsers,

    totalDistributors,

    totalStores,

    totalProducts,

    totalOrders,

    totalDrivers,

    activeStores,

    pendingVerifications,

  ] = await Promise.all([

    User.countDocuments(),

    User.countDocuments({ role: { $in: ['distributor', 'storeOwner'] } }),

    Store.countDocuments(),

    Product.countDocuments(),

    Order.countDocuments(),

    Driver.countDocuments(),

    Store.countDocuments({ isActive: true, subscriptionStatus: 'active' }),

    User.countDocuments({ verificationStatus: 'pending', role: { $in: ['distributor', 'storeOwner'] } }),

  ]);



  const revenueStats = await Order.aggregate([

    { $match: { paymentStatus: 'paid' } },

    {

      $group: {

        _id: null,

        totalRevenue: { $sum: '$total' },

        totalDeliveryFees: { $sum: '$deliveryFee' },

      },

    },

  ]);



  const recentOrders = await Order.find()

    .sort({ createdAt: -1 })

    .limit(10)

    .populate('customerId', 'name email')

    .populate('storeId', 'name');



  res.json({

    success: true,

    data: {

      statistics: {

        totalUsers,

        totalDistributors,

        totalStores,

        totalProducts,

        totalOrders,

        totalDrivers,

        activeStores,

        pendingVerifications,

        totalRevenue: revenueStats[0]?.totalRevenue || 0,

        totalDeliveryFees: revenueStats[0]?.totalDeliveryFees || 0,

      },

      recentOrders,

    },

  });

});



/**

 * Get all users with filters

 * @route GET /api/admin/users

 * @access Private (Super Admin)

 */

const getAllUsers = asyncHandler(async (req, res) => {

  const { page, limit, role, verificationStatus, search } = req.query;

  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);



  const query = {};



  if (role) query.role = role;

  if (verificationStatus) query.verificationStatus = verificationStatus;

  if (search) {

    query.$or = [

      { name: { $regex: search, $options: 'i' } },

      { email: { $regex: search, $options: 'i' } },

      { phone: { $regex: search, $options: 'i' } },

    ];

  }



  const [users, total] = await Promise.all([

    User.find(query)

      .skip(skip)

      .limit(pageLimit)

      .sort({ createdAt: -1 }),

    User.countDocuments(query),

  ]);



  res.json({

    success: true,

    ...formatPaginationResponse(users, total, pageNum, pageLimit),

  });

});



/**

 * Get single user details

 * @route GET /api/admin/users/:id

 * @access Private (Super Admin)

 */

const getUserDetails = asyncHandler(async (req, res) => {

  const user = await User.findById(req.params.id);



  if (!user) {

    return res.status(404).json({

      success: false,

      message: 'User not found',

    });

  }



  let additionalData = {};



  if (user.role === 'driver') {

    additionalData.driverProfile = await Driver.findByUserId(user._id);

  }



  if (user.role === 'storeOwner' || user.role === 'distributor') {

    additionalData.stores = await Store.findByDistributor(user._id);

    additionalData.orders = await Order.find({ customerId: user._id })

      .sort({ createdAt: -1 })

      .limit(10);

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

 * Verify/Reject distributor or store owner

 * @route PUT /api/admin/distributors/:id/verify

 * @access Private (Super Admin)

 */

const verifyDistributor = asyncHandler(async (req, res) => {

  const { status, reason } = req.body; // status: 'verified' or 'rejected'



  const user = await User.findById(req.params.id);



  if (!user) {

    return res.status(404).json({

      success: false,

      message: 'User not found',

    });

  }



  if (user.role !== 'storeOwner' && user.role !== 'distributor') {

    return res.status(400).json({

      success: false,

      message: 'User is not a distributor or store owner',

    });

  }



  user.verificationStatus = status;

  if (status === 'rejected' && reason) {

    user.metadata = user.metadata || new Map();

    user.metadata.set('rejectionReason', reason);

  }



  await user.save();



  await sendDistributorVerificationEmail(user, status);



  res.json({

    success: true,

    message: `Distributor/store owner ${status} successfully`,

    data: { user },

  });

});



/**

 * Upload distributor codes from CSV

 * @route POST /api/admin/distributor-codes/upload

 * @access Private (Super Admin)

 */

const uploadDistributorCodes = asyncHandler(async (req, res) => {

  if (!req.file) {

    return res.status(400).json({

      success: false,

      message: 'CSV file is required',

    });

  }



  const codes = [];



  fs.createReadStream(req.file.path)

    .pipe(csv())

    .on('data', (row) => {

      if (row.code) {

        codes.push({

          code: row.code.toUpperCase().trim(),

          distributorName: row.name?.trim(),

          distributorEmail: row.email?.trim(),

          distributorPhone: row.phone?.trim(),

        });

      }

    })

    .on('end', async () => {

      try {

        const result = await DistributorCode.bulkCreate(codes, req.user._id);

        fs.unlinkSync(req.file.path);



        res.json({

          success: true,

          message: `${result.length} distributor codes uploaded successfully`,

          data: {

            uploaded: result.length,

            total: codes.length,

            failed: codes.length - result.length,

          },

        });

      } catch (error) {

        fs.unlinkSync(req.file.path);



        if (error.code === 11000) {

          return res.status(400).json({

            success: false,

            message: 'Some distributor codes already exist',

            error: error.message,

          });

        }

        throw error;

      }

    })

    .on('error', (error) => {

      fs.unlinkSync(req.file.path);

      throw error;

    });

});



/**

 * Create single distributor code

 * @route POST /api/admin/distributor-codes

 * @access Private (Super Admin)

 */

const createDistributorCode = asyncHandler(async (req, res) => {

  const { code, distributorName, distributorEmail, distributorPhone, metadata } = req.body;



  const existingCode = await DistributorCode.findByCode(code);

  if (existingCode) {

    return res.status(400).json({

      success: false,

      message: 'This distributor code already exists',

    });

  }



  const distributorCode = await DistributorCode.create({

    code: code.toUpperCase(),

    distributorName,

    distributorEmail,

    distributorPhone,

    metadata,

    uploadedBy: req.user._id,

  });



  res.status(201).json({

    success: true,

    message: 'Distributor code created successfully',

    data: { distributorCode },

  });

});



/**

 * Get all distributor codes

 * @route GET /api/admin/distributor-codes

 * @access Private (Super Admin)

 */

const getDistributorCodes = asyncHandler(async (req, res) => {

  const { page, limit, status, isUsed, search } = req.query;

  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);



  const query = {};

  if (status) query.status = status;

  if (isUsed !== undefined) query.isUsed = isUsed === 'true';

  if (search) {

    query.$or = [

      { code: { $regex: search, $options: 'i' } },

      { distributorName: { $regex: search, $options: 'i' } },

    ];

  }



  const [codes, total] = await Promise.all([

    DistributorCode.find(query)

      .populate('assignedTo', 'name email')

      .skip(skip)

      .limit(pageLimit)

      .sort({ createdAt: -1 }),

    DistributorCode.countDocuments(query),

  ]);



  res.json({

    success: true,

    ...formatPaginationResponse(codes, total, pageNum, pageLimit),

  });

});



/**

 * Get all stores

 * @route GET /api/admin/stores

 * @access Private (Super Admin)

 */

const getAllStores = asyncHandler(async (req, res) => {

  const { page, limit, subscriptionStatus, isActive, search } = req.query;

  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);



  const query = {};

  if (subscriptionStatus) query.subscriptionStatus = subscriptionStatus;

  if (isActive !== undefined) query.isActive = isActive === 'true';

  if (search) {

    query.$or = [

      { name: { $regex: search, $options: 'i' } },

      { slug: { $regex: search, $options: 'i' } },

    ];

  }



  const [stores, total] = await Promise.all([

    Store.find(query)

      .populate('distributorId', 'name email phone')

      .skip(skip)

      .limit(pageLimit)

      .sort({ createdAt: -1 }),

    Store.countDocuments(query),

  ]);



  res.json({

    success: true,

    ...formatPaginationResponse(stores, total, pageNum, pageLimit),

  });

});



/**

 * Toggle store status

 * @route PUT /api/admin/stores/:id/toggle-status

 * @access Private (Super Admin)

 */

const toggleStoreStatus = asyncHandler(async (req, res) => {

  const store = await Store.findById(req.params.id);



  if (!store) {

    return res.status(404).json({

      success: false,

      message: 'Store not found',

    });

  }



  store.isActive = !store.isActive;

  await store.save();



  res.json({

    success: true,

    message: `Store ${store.isActive ? 'activated' : 'deactivated'} successfully`,

    data: { store },

  });

});



/**

 * Get all drivers

 * @route GET /api/admin/drivers

 * @access Private (Super Admin)

 */

const getAllDrivers = asyncHandler(async (req, res) => {

  const { page, limit, status, availability, search } = req.query;

  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);



  const query = {};

  if (status) query.status = status;

  if (availability) query.availability = availability;



  const [drivers, total] = await Promise.all([

    Driver.find(query)

      .populate('userId', 'name email phone')

      .skip(skip)

      .limit(pageLimit)

      .sort({ createdAt: -1 }),

    Driver.countDocuments(query),

  ]);



  let filteredDrivers = drivers;

  if (search) {

    filteredDrivers = drivers.filter(

      (driver) =>

        driver.userId?.name?.toLowerCase().includes(search.toLowerCase()) ||

        driver.vehicleNumber?.toLowerCase().includes(search.toLowerCase()) ||

        driver.licenseNumber?.toLowerCase().includes(search.toLowerCase())

    );

  }



  res.json({

    success: true,

    ...formatPaginationResponse(

      filteredDrivers,

      search ? filteredDrivers.length : total,

      pageNum,

      pageLimit

    ),

  });

});



/**

 * Approve/Reject driver

 * @route PUT /api/admin/drivers/:id/approve

 * @access Private (Super Admin)

 */

const approveDriver = asyncHandler(async (req, res) => {

  const { status, reason } = req.body; // status: 'approved' or 'rejected'



  const driver = await Driver.findById(req.params.id).populate('userId');



  if (!driver) {

    return res.status(404).json({

      success: false,

      message: 'Driver not found',

    });

  }



  if (status === 'approved') {

    await driver.approve(req.user._id);

    await sendDriverApprovalEmail(driver, driver.userId);

  } else if (status === 'rejected') {

    await driver.reject(reason);

  }



  res.json({

    success: true,

    message: `Driver ${status} successfully`,

    data: { driver },

  });

});



/**

 * Create product (global catalog)

 * @route POST /api/admin/products

 * @access Private (Super Admin)

 */

const createProduct = asyncHandler(async (req, res) => {

  const productData = {

    ...req.body,

    createdBy: req.user._id,

  };



  const product = await Product.create(productData);



  res.status(201).json({

    success: true,

    message: 'Product created successfully',

    data: { product },

  });

});



/**

 * Update product

 * @route PUT /api/admin/products/:id

 * @access Private (Super Admin)

 */

const updateProduct = asyncHandler(async (req, res) => {

  const product = await Product.findById(req.params.id);



  if (!product) {

    return res.status(404).json({

      success: false,

      message: 'Product not found',

    });

  }



  Object.assign(product, req.body);

  await product.save();



  res.json({

    success: true,

    message: 'Product updated successfully',

    data: { product },

  });

});



/**

 * Delete product

 * @route DELETE /api/admin/products/:id

 * @access Private (Super Admin)

 */

const deleteProduct = asyncHandler(async (req, res) => {

  const product = await Product.findById(req.params.id);



  if (!product) {

    return res.status(404).json({

      success: false,

      message: 'Product not found',

    });

  }



  product.isActive = false;

  product.stockStatus = 'discontinued';

  await product.save();



  res.json({

    success: true,

    message: 'Product deleted successfully',

  });

});



/**

 * Get all subscriptions

 * @route GET /api/admin/subscriptions

 * @access Private (Super Admin)

 */

const getAllSubscriptions = asyncHandler(async (req, res) => {

  const { page, limit, status, paymentStatus } = req.query;

  const { skip, limit: pageLimit, page: pageNum } = getPagination(page, limit);



  const query = {};

  if (status) query.status = status;

  if (paymentStatus) query.paymentStatus = paymentStatus;



  const [subscriptions, total] = await Promise.all([

    Subscription.find(query)

      .populate('storeId', 'name slug')

      .populate('processedBy', 'name email')

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



module.exports = {

  getDashboardStats,

  getAllUsers,

  getUserDetails,

  verifyDistributor,

  uploadDistributorCodes,

  createDistributorCode,

  getDistributorCodes,

  getAllStores,

  toggleStoreStatus,

  getAllDrivers,

  approveDriver,

  createProduct,

  updateProduct,

  deleteProduct,

  getAllSubscriptions,

};
