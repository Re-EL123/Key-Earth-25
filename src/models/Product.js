const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  shortDescription: {
    type: String,
    trim: true,
    maxlength: 200,
  },
  basePrice: {
    type: Number,
    required: true,
    min: 0,
  },
  category: {
    type: String,
    required: true,
    trim: true,
    index: true,
  },
  subCategory: {
    type: String,
    trim: true,
  },
  imageUrl: {
    type: String,
  },
  images: [{
    url: String,
    isPrimary: {
      type: Boolean,
      default: false,
    },
  }],
  specifications: {
    type: Map,
    of: String,
  },
  weight: {
    value: Number,
    unit: {
      type: String,
      enum: ['g', 'kg', 'ml', 'l', 'oz', 'lb'],
    },
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: {
      type: String,
      enum: ['cm', 'in', 'm'],
    },
  },
  tags: [{
    type: String,
    trim: true,
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  isFeatured: {
    type: Boolean,
    default: false,
  },
  stockStatus: {
    type: String,
    enum: ['in_stock', 'out_of_stock', 'discontinued'],
    default: 'in_stock',
  },
  metadata: {
    manufacturer: String,
    brand: String,
    origin: String,
    barcode: String,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ category: 1, subCategory: 1 });
productSchema.index({ sku: 1 }, { unique: true });
productSchema.index({ isActive: 1 });

// Methods
productSchema.methods.toJSON = function() {
  const product = this.toObject();
  delete product.__v;
  return product;
};

// Statics
productSchema.statics.findBySku = function(sku) {
  return this.findOne({ sku: sku.toUpperCase() });
};

productSchema.statics.findByCategory = function(category) {
  return this.find({ category, isActive: true });
};

productSchema.statics.searchProducts = function(query) {
  return this.find({
    $text: { $search: query },
    isActive: true,
  }).sort({ score: { $meta: 'textScore' } });
};

module.exports = mongoose.model('Product', productSchema);