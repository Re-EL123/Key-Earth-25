const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
  reportType: {
    type: String,
    enum: [
      'distributor_purchases',
      'store_sales',
      'driver_earnings',
      'subscriptions',
      'appointments',
      'inventory',
      'financial',
      'custom',
    ],
    required: true,
    index: true,
  },
  title: {
    type: String,
    required: true,
  },
  description: {
    type: String,
  },
  startDate: {
    type: Date,
    required: true,
  },
  endDate: {
    type: Date,
    required: true,
  },
  filters: {
    distributorCode: String,
    storeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Store',
    },
    driverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Driver',
    },
    status: String,
    category: String,
    customFilters: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
  },
  summary: {
    totalRecords: {
      type: Number,
      default: 0,
    },
    totalAmount: {
      type: Number,
      default: 0,
    },
    metrics: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
    },
  },
  fileUrl: {
    type: String,
  },
  fileFormat: {
    type: String,
    enum: ['excel', 'csv', 'pdf', 'json'],
    default: 'excel',
  },
  fileSize: {
    type: Number,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed'],
    default: 'pending',
  },
  error: {
    type: String,
  },
  expiresAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
reportSchema.index({ reportType: 1, createdAt: -1 });
reportSchema.index({ generatedBy: 1, createdAt: -1 });
reportSchema.index({ status: 1 });
reportSchema.index({ expiresAt: 1 });

// Auto-delete expired reports
reportSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Methods
reportSchema.methods.markAsCompleted = function(fileUrl, fileSize) {
  this.status = 'completed';
  this.fileUrl = fileUrl;
  this.fileSize = fileSize;
  
  // Set expiry to 30 days from now
  const expiryDate = new Date();
  expiryDate.setDate(expiryDate.getDate() + 30);
  this.expiresAt = expiryDate;
  
  return this.save();
};

reportSchema.methods.markAsFailed = function(error) {
  this.status = 'failed';
  this.error = error;
  return this.save();
};

// Statics
reportSchema.statics.findByUser = function(userId, options = {}) {
  const query = { generatedBy: userId, status: 'completed' };
  if (options.reportType) {
    query.reportType = options.reportType;
  }
  return this.find(query).sort({ createdAt: -1 });
};

reportSchema.statics.findByType = function(reportType) {
  return this.find({ reportType, status: 'completed' }).sort({ createdAt: -1 });
};

reportSchema.statics.cleanupExpired = function() {
  const now = new Date();
  return this.deleteMany({
    expiresAt: { $lt: now },
    status: 'completed',
  });
};

module.exports = mongoose.model('Report', reportSchema);