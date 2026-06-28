const mongoose = require('mongoose');

const subscriptionSchema = new mongoose.Schema({
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  startDate: {
    type: Date,
    required: true,
    default: Date.now,
  },
  expiryDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['active', 'expired', 'cancelled', 'pending'],
    default: 'pending',
  },
  amount: {
    type: Number,
    required: true,
  },
  paymentReference: {
    type: String,
    unique: true,
    sparse: true,
  },
  paymentMethod: {
    type: String,
    enum: ['cash', 'card', 'transfer', 'wallet', 'other'],
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded'],
    default: 'pending',
  },
  paymentDate: {
    type: Date,
  },
  durationMonths: {
    type: Number,
    default: 12,
  },
  isAutoRenew: {
    type: Boolean,
    default: false,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  notes: {
    type: String,
  },
  invoiceNumber: {
    type: String,
    unique: true,
    sparse: true,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
subscriptionSchema.index({ storeId: 1 });
subscriptionSchema.index({ status: 1 });
subscriptionSchema.index({ expiryDate: 1 });
subscriptionSchema.index({ paymentStatus: 1 });

// Pre-save middleware
subscriptionSchema.pre('save', function(next) {
  // Auto-generate invoice number
  if (!this.invoiceNumber && this.paymentStatus === 'paid') {
    this.invoiceNumber = `INV-${Date.now()}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
  }

  // Update status based on expiry
  if (this.expiryDate < new Date() && this.status === 'active') {
    this.status = 'expired';
  }

  next();
});

// Methods
subscriptionSchema.methods.isActive = function() {
  return this.status === 'active' && 
         this.paymentStatus === 'paid' &&
         this.expiryDate > new Date();
};

subscriptionSchema.methods.markAsPaid = function(paymentRef, paymentMethod) {
  this.paymentStatus = 'paid';
  this.paymentDate = new Date();
  this.paymentReference = paymentRef;
  this.paymentMethod = paymentMethod;
  this.status = 'active';
  return this.save();
};

subscriptionSchema.methods.cancel = function(reason) {
  this.status = 'cancelled';
  this.notes = reason || 'Cancelled by user';
  return this.save();
};

subscriptionSchema.methods.renew = function(months = 12) {
  const newExpiryDate = new Date(this.expiryDate);
  newExpiryDate.setMonth(newExpiryDate.getMonth() + months);
  
  this.expiryDate = newExpiryDate;
  this.status = 'active';
  this.durationMonths = months;
  
  return this.save();
};

// Statics
subscriptionSchema.statics.findByStore = function(storeId) {
  return this.find({ storeId }).sort({ createdAt: -1 });
};

subscriptionSchema.statics.findActiveSubscriptions = function() {
  return this.find({
    status: 'active',
    paymentStatus: 'paid',
    expiryDate: { $gt: new Date() },
  });
};

subscriptionSchema.statics.findExpiringSubscriptions = function(days = 30) {
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);
  
  return this.find({
    status: 'active',
    expiryDate: {
      $gte: new Date(),
      $lte: futureDate,
    },
  }).populate('storeId');
};

subscriptionSchema.statics.findExpiredSubscriptions = function() {
  return this.find({
    status: 'active',
    expiryDate: { $lt: new Date() },
  });
};

module.exports = mongoose.model('Subscription', subscriptionSchema);