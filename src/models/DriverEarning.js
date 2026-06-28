const mongoose = require('mongoose');

const driverEarningSchema = new mongoose.Schema({
  driverId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Driver',
    required: true,
    index: true,
  },
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true,
  },
  deliveryFee: {
    type: Number,
    required: true,
    min: 0,
  },
  driverAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  platformAmount: {
    type: Number,
    required: true,
    min: 0,
  },
  tip: {
    type: Number,
    default: 0,
    min: 0,
  },
  totalEarning: {
    type: Number,
    required: true,
  },
  payoutStatus: {
    type: String,
    enum: ['pending', 'processing', 'paid', 'failed', 'cancelled'],
    default: 'pending',
    index: true,
  },
  payoutDate: {
    type: Date,
  },
  payoutReference: {
    type: String,
  },
  payoutMethod: {
    type: String,
    enum: ['bank_transfer', 'cash', 'wallet', 'other'],
  },
  deliveryDate: {
    type: Date,
    required: true,
  },
  processingFee: {
    type: Number,
    default: 0,
  },
  netAmount: {
    type: Number,
  },
  notes: {
    type: String,
  },
  processedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, {
  timestamps: true,
});

// Indexes
driverEarningSchema.index({ driverId: 1, deliveryDate: -1 });
driverEarningSchema.index({ orderId: 1 }, { unique: true });
driverEarningSchema.index({ payoutStatus: 1 });
driverEarningSchema.index({ payoutDate: 1 });

// Pre-save middleware
driverEarningSchema.pre('save', function(next) {
  // Calculate total earning
  this.totalEarning = this.driverAmount + (this.tip || 0);
  
  // Calculate net amount after processing fee
  this.netAmount = this.totalEarning - (this.processingFee || 0);
  
  next();
});

// Methods
driverEarningSchema.methods.markAsPaid = function(reference, method, userId) {
  this.payoutStatus = 'paid';
  this.payoutDate = new Date();
  this.payoutReference = reference;
  this.payoutMethod = method;
  this.processedBy = userId;
  return this.save();
};

driverEarningSchema.methods.cancel = function(reason) {
  this.payoutStatus = 'cancelled';
  this.notes = reason;
  return this.save();
};

// Statics
driverEarningSchema.statics.findByDriver = function(driverId, options = {}) {
  const query = { driverId };
  if (options.payoutStatus) {
    query.payoutStatus = options.payoutStatus;
  }
  return this.find(query).sort({ deliveryDate: -1 });
};

driverEarningSchema.statics.getPendingEarnings = function(driverId) {
  return this.find({
    driverId,
    payoutStatus: 'pending',
  });
};

driverEarningSchema.statics.getTotalPendingAmount = async function(driverId) {
  const result = await this.aggregate([
    {
      $match: {
        driverId: mongoose.Types.ObjectId(driverId),
        payoutStatus: 'pending',
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$netAmount' },
      },
    },
  ]);

  return result.length > 0 ? result[0].total : 0;
};

driverEarningSchema.statics.getEarningsReport = async function(driverId, startDate, endDate) {
  return this.aggregate([
    {
      $match: {
        driverId: mongoose.Types.ObjectId(driverId),
        deliveryDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate),
        },
      },
    },
    {
      $group: {
        _id: null,
        totalDeliveries: { $sum: 1 },
        totalEarnings: { $sum: '$totalEarning' },
        totalFees: { $sum: '$deliveryFee' },
        totalTips: { $sum: '$tip' },
        totalProcessingFees: { $sum: '$processingFee' },
        netEarnings: { $sum: '$netAmount' },
        paidEarnings: {
          $sum: {
            $cond: [{ $eq: ['$payoutStatus', 'paid'] }, '$netAmount', 0],
          },
        },
        pendingEarnings: {
          $sum: {
            $cond: [{ $eq: ['$payoutStatus', 'pending'] }, '$netAmount', 0],
          },
        },
      },
    },
  ]);
};

module.exports = mongoose.model('DriverEarning', driverEarningSchema);