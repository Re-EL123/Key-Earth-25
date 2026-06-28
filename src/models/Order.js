const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    unique: true,
    required: true,
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  buyerType: {
    type: String,
    enum: ['customer', 'distributor'],
    required: true,
    index: true,
  },
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  distributorCode: {
    type: String,
    index: true,
  },
  items: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true,
    },
    storeProductId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'StoreProduct',
    },
    name: String,
    sku: String,
    price: {
      type: Number,
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 1,
    },
    subtotal: {
      type: Number,
      required: true,
    },
  }],
  subtotal: {
    type: Number,
    required: true,
  },
  deliveryFee: {
    type: Number,
    default: 0,
  },
  tax: {
    type: Number,
    default: 0,
  },
  discount: {
    type: Number,
    default: 0,
  },
  total: {
    type: Number,
    required: true,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'wallet'],
    required: true,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
    index: true,
  },
  paymentReference: {
    type: String,
  },
  orderStatus: {
    type: String,
    enum: ['pending', 'confirmed', 'processing', 'ready', 'in_transit', 'delivered', 'cancelled'],
    default: 'pending',
    index: true,
  },
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    index: true,
  },
  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
  },
  deliveryAddress: {
    fullName: String,
    phone: String,
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
    coordinates: {
      latitude: Number,
      longitude: Number,
    },
  },
  statusHistory: [{
    status: String,
    timestamp: {
      type: Date,
      default: Date.now,
    },
    note: String,
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
  }],
  notes: {
    customer: String,
    store: String,
    driver: String,
  },
  estimatedDeliveryTime: {
    type: Date,
  },
  actualDeliveryTime: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
}, {
  timestamps: true,
});

// Indexes
orderSchema.index({ orderNumber: 1 }, { unique: true });
orderSchema.index({ customerId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ driverId: 1, orderStatus: 1 });
orderSchema.index({ distributorCode: 1 });
orderSchema.index({ orderStatus: 1, createdAt: -1 });

// Pre-save middleware to generate order number
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.orderNumber = `ORD-${timestamp}-${random}`;
  }
  next();
});

// Methods
orderSchema.methods.updateStatus = function(status, note, userId) {
  this.orderStatus = status;
  this.statusHistory.push({
    status,
    note,
    updatedBy: userId,
    timestamp: new Date(),
  });

  if (status === 'delivered') {
    this.actualDeliveryTime = new Date();
  } else if (status === 'cancelled') {
    this.cancelledAt = new Date();
  }

  return this.save();
};

orderSchema.methods.assignDriver = function(driverId) {
  this.driverId = driverId;
  return this.updateStatus('in_transit', 'Driver assigned');
};

orderSchema.methods.markAsDelivered = function() {
  this.actualDeliveryTime = new Date();
  return this.updateStatus('delivered', 'Order delivered successfully');
};

orderSchema.methods.cancel = function(reason, userId) {
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.updateStatus('cancelled', reason, userId);
};

orderSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed', 'processing'].includes(this.orderStatus);
};

orderSchema.methods.calculateDeliveryFeeSplit = function() {
  const driverPercentage = parseFloat(process.env.DRIVER_FEE_PERCENTAGE || 75);
  const platformPercentage = parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || 25);

  return {
    total: this.deliveryFee,
    driverAmount: (this.deliveryFee * driverPercentage) / 100,
    platformAmount: (this.deliveryFee * platformPercentage) / 100,
  };
};

// Statics
orderSchema.statics.findByOrderNumber = function(orderNumber) {
  return this.findOne({ orderNumber });
};

orderSchema.statics.findByCustomer = function(customerId, options = {}) {
  const query = { customerId };
  return this.find(query)
    .sort({ createdAt: -1 })
    .limit(options.limit || 50);
};

orderSchema.statics.findByStore = function(storeId, options = {}) {
  const query = { storeId };
  if (options.status) {
    query.orderStatus = options.status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

orderSchema.statics.findByDriver = function(driverId, options = {}) {
  const query = { driverId };
  if (options.status) {
    query.orderStatus = options.status;
  }
  return this.find(query).sort({ createdAt: -1 });
};

orderSchema.statics.findPendingOrders = function(storeId) {
  return this.find({
    storeId,
    orderStatus: { $in: ['pending', 'confirmed'] },
  }).sort({ createdAt: 1 });
};

module.exports = mongoose.model('Order', orderSchema);