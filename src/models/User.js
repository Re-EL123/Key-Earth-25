const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  role: {
    type: String,
    enum: ['superAdmin', 'storeOwner', 'distributor', 'customer', 'driver'],
    required: true,
    default: 'customer',
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  distributorCode: {
    type: String,
    sparse: true,
    index: true,
  },
  verificationStatus: {
    type: String,
    enum: ['pending', 'verified', 'rejected'],
    default: 'pending',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  profileImage: {
    type: String,
  },
  address: {
    street: String,
    city: String,
    state: String,
    country: String,
    postalCode: String,
  },
  lastLogin: {
    type: Date,
  },
  metadata: {
    type: Map,
    of: mongoose.Schema.Types.Mixed,
  },
}, {
  timestamps: true,
});

// Indexes
userSchema.index({ email: 1 });
userSchema.index({ role: 1 });
userSchema.index({ distributorCode: 1 });
userSchema.index({ verificationStatus: 1 });

// Virtual for full address
userSchema.virtual('fullAddress').get(function() {
  if (!this.address) return '';
  const { street, city, state, country, postalCode } = this.address;
  return [street, city, state, country, postalCode].filter(Boolean).join(', ');
});

// Methods
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.__v;
  return user;
};

userSchema.methods.hasRole = function(role) {
  return this.role === role;
};

userSchema.methods.isVerified = function() {
  return this.verificationStatus === 'verified';
};

// Statics
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ firebaseUid });
};

userSchema.statics.findByEmail = function(email) {
  return this.findOne({ email: email.toLowerCase() });
};

userSchema.statics.findByDistributorCode = function(distributorCode) {
  return this.find({ distributorCode });
};

module.exports = mongoose.model('User', userSchema);