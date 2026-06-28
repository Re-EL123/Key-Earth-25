const mongoose = require('mongoose');

const driverSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    unique: true,
  },
  vehicleType: {
    type: String,
    enum: ['bicycle', 'motorcycle', 'car', 'van', 'truck'],
    required: true,
  },
  vehicleNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  vehicleModel: {
    type: String,
    trim: true,
  },
  vehicleColor: {
    type: String,
    trim: true,
  },
  licenseNumber: {
    type: String,
    required: true,
    trim: true,
    uppercase: true,
  },
  licenseExpiry: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'active', 'inactive', 'suspended', 'rejected'],
    default: 'pending',
    index: true,
  },
  availability: {
    type: String,
    enum: ['available', 'busy', 'offline'],
    default: 'offline',
  },
  currentLocation: {
    type: {
      type: String,
      enum: ['Point'],
      default: 'Point',
    },
    coordinates: {
      type: [Number], // [longitude, latitude]
      default: [0, 0],
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  documents: {
    profilePhoto: String,
    licensePhoto: String,
    vehiclePhoto: String,
    insuranceDocument: String,
  },
  bankDetails: {
    accountName: String,
    accountNumber: String,
    bankName: String,
    bankCode: String,
  },
  stats: {
    totalDeliveries: {
      type: Number,
      default: 0,
    },
    completedDeliveries: {
      type: Number,
      default: 0,
    },
    cancelledDeliveries: {
      type: Number,
      default: 0,
    },
    totalEarnings: {
      type: Number,
      default: 0,
    },
    pendingPayout: {
      type: Number,
      default: 0,
    },
    averageRating: {
      type: Number,
      default: 0,
      min: 0,
      max: 5,
    },
    totalRatings: {
      type: Number,
      default: 0,
    },
  },
  workingHours: [{
    day: {
      type: String,
      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],
    },
    isWorking: {
      type: Boolean,
      default: true,
    },
    startTime: String,
    endTime: String,
  }],
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  approvedAt: {
    type: Date,
  },
  rejectionReason: {
    type: String,
  },
  isVerified: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Indexes
driverSchema.index({ userId: 1 }, { unique: true });
driverSchema.index({ status: 1 });
driverSchema.index({ availability: 1 });
driverSchema.index({ currentLocation: '2dsphere' });

// Methods
driverSchema.methods.approve = function(adminId) {
  this.status = 'approved';
  this.approvedBy = adminId;
  this.approvedAt = new Date();
  this.isVerified = true;
  return this.save();
};

driverSchema.methods.reject = function(reason) {
  this.status = 'rejected';
  this.rejectionReason = reason;
  return this.save();
};

driverSchema.methods.goOnline = function() {
  this.availability = 'available';
  this.status = 'active';
  return this.save();
};

driverSchema.methods.goOffline = function() {
  this.availability = 'offline';
  return this.save();
};

driverSchema.methods.setBusy = function() {
  this.availability = 'busy';
  return this.save();
};

driverSchema.methods.updateLocation = function(longitude, latitude) {
  this.currentLocation = {
    type: 'Point',
    coordinates: [longitude, latitude],
    lastUpdated: new Date(),
  };
  return this.save();
};

driverSchema.methods.incrementDeliveryStats = function(earnings) {
  this.stats.totalDeliveries += 1;
  this.stats.completedDeliveries += 1;
  this.stats.totalEarnings += earnings;
  this.stats.pendingPayout += earnings;
  return this.save();
};

driverSchema.methods.updateRating = function(rating) {
  const totalRatings = this.stats.totalRatings;
  const currentAverage = this.stats.averageRating;
  
  this.stats.totalRatings += 1;
  this.stats.averageRating = ((currentAverage * totalRatings) + rating) / this.stats.totalRatings;
  
  return this.save();
};

// Statics
driverSchema.statics.findAvailableDrivers = function(coordinates, maxDistance = 10000) {
  return this.find({
    status: 'active',
    availability: 'available',
    currentLocation: {
      $near: {
        $geometry: {
          type: 'Point',
          coordinates: coordinates, // [longitude, latitude]
        },
        $maxDistance: maxDistance, // in meters
      },
    },
  });
};

driverSchema.statics.findByUserId = function(userId) {
  return this.findOne({ userId });
};

module.exports = mongoose.model('Driver', driverSchema);