const mongoose = require('mongoose');

const storeProductSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true,
  },
  storePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  compareAtPrice: {
    type: Number,
    min: 0,
  },
  stock: {
    type: Number,
    required: true,
    default: 0,
    min: 0,
  },
  lowStockThreshold: {
    type: Number,
    default: 10,
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  isVisible: {
    type: Boolean,
    default: true,
  },
  customDescription: {
    type: String,
  },
  customImages: [{
    url: String,
    isPrimary: Boolean,
  }],
  displayOrder: {
    type: Number,
    default: 0,
  },
  stats: {
    totalSold: {
      type: Number,
      default: 0,
    },
    totalRevenue: {
      type: Number,
      default: 0,
    },
    viewCount: {
      type: Number,
      default: 0,
    },
  },
  promotions: [{
    type: {
      type: String,
      enum: ['percentage', 'fixed'],
    },
    value: Number,
    startDate: Date,
    endDate: Date,
    isActive: Boolean,
  }],
}, {
  timestamps: true,
});

// Compound indexes
storeProductSchema.index({ storeId: 1, productId: 1 }, { unique: true });
storeProductSchema.index({ storeId: 1, isActive: 1, isVisible: 1 });

// Methods
storeProductSchema.methods.isInStock = function() {
  return this.stock > 0 && this.isActive;
};

storeProductSchema.methods.isLowStock = function() {
  return this.stock <= this.lowStockThreshold && this.stock > 0;
};

storeProductSchema.methods.decreaseStock = function(quantity) {
  if (this.stock < quantity) {
    throw new Error('Insufficient stock');
  }
  this.stock -= quantity;
  return this.save();
};

storeProductSchema.methods.increaseStock = function(quantity) {
  this.stock += quantity;
  return this.save();
};

storeProductSchema.methods.updateSalesStats = function(quantity, amount) {
  this.stats.totalSold += quantity;
  this.stats.totalRevenue += amount;
  return this.save();
};

storeProductSchema.methods.getActivePromotion = function() {
  const now = new Date();
  return this.promotions.find(promo => 
    promo.isActive &&
    promo.startDate <= now &&
    promo.endDate >= now
  );
};

storeProductSchema.methods.getDiscountedPrice = function() {
  const promotion = this.getActivePromotion();
  if (!promotion) return this.storePrice;

  if (promotion.type === 'percentage') {
    return this.storePrice * (1 - promotion.value / 100);
  } else {
    return Math.max(0, this.storePrice - promotion.value);
  }
};

// Virtuals
storeProductSchema.virtual('stockStatus').get(function() {
  if (this.stock === 0) return 'out_of_stock';
  if (this.isLowStock()) return 'low_stock';
  return 'in_stock';
});

// Statics
storeProductSchema.statics.findByStore = function(storeId, options = {}) {
  const query = { storeId, isActive: true };
  if (options.isVisible !== undefined) {
    query.isVisible = options.isVisible;
  }
  return this.find(query).populate('productId').sort({ displayOrder: 1 });
};

storeProductSchema.statics.findLowStockItems = function(storeId) {
  return this.find({
    storeId,
    isActive: true,
  }).where('stock').lte(this.schema.path('lowStockThreshold').defaultValue);
};

module.exports = mongoose.model('StoreProduct', storeProductSchema);