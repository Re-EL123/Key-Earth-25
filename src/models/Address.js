const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },
  label: {
    type: String,
    enum: ['home', 'work', 'other'],
    default: 'home',
  },
  fullName: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    trim: true,
  },
  street: {
    type: String,
    required: true,
    trim: true,
  },
  city: {
    type: String,
    required: true,
    trim: true,
  },
  state: {
    type: String,
    required: true,
    trim: true,
  },
  country: {
    type: String,
    required: true,
    trim: true,
    default: 'Nigeria',
  },
  postalCode: {
    type: String,
    trim: true,
  },
  coordinates: {
    latitude: {
      type: Number,
    },
    longitude: {
      type: Number,
    },
  },
  isDefault: {
    type: Boolean,
    default: false,
  },
  deliveryInstructions: {
    type: String,
    trim: true,
  },
}, {
  timestamps: true,
});

// Indexes
addressSchema.index({ userId: 1 });
addressSchema.index({ userId: 1, isDefault: 1 });

// Pre-save middleware to ensure only one default address per user
addressSchema.pre('save', async function(next) {
  if (this.isDefault) {
    await this.constructor.updateMany(
      { userId: this.userId, _id: { $ne: this._id } },
      { $set: { isDefault: false } }
    );
  }
  next();
});

// Methods
addressSchema.methods.setAsDefault = async function() {
  await this.constructor.updateMany(
    { userId: this.userId },
    { $set: { isDefault: false } }
  );
  this.isDefault = true;
  return this.save();
};

addressSchema.virtual('fullAddress').get(function() {
  return `${this.street}, ${this.city}, ${this.state}, ${this.country}`;
});

// Statics
addressSchema.statics.findByUser = function(userId) {
  return this.find({ userId }).sort({ isDefault: -1, createdAt: -1 });
};

addressSchema.statics.findDefaultAddress = function(userId) {
  return this.findOne({ userId, isDefault: true });
};

module.exports = mongoose.model('Address', addressSchema);