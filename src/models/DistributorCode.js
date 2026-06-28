const mongoose = require('mongoose');

const distributorCodeSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
    index: true,
  },
  isUsed: {
    type: Boolean,
    default: false,
  },
  assignedTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  distributorName: {
    type: String,
    trim: true,
  },
  distributorEmail: {
    type: String,
    trim: true,
    lowercase: true,
  },
  distributorPhone: {
    type: String,
    trim: true,
  },
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  expiryDate: {
    type: Date,
  },
  metadata: {
    region: String,
    level: String,
    notes: String,
  },
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  usedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
distributorCodeSchema.index({ code: 1 }, { unique: true });
distributorCodeSchema.index({ isUsed: 1 });
distributorCodeSchema.index({ status: 1 });

// Methods
distributorCodeSchema.methods.markAsUsed = function(userId) {
  this.isUsed = true;
  this.assignedTo = userId;
  this.usedAt = new Date();
  return this.save();
};

distributorCodeSchema.methods.isValid = function() {
  if (this.status !== 'active') return false;
  if (this.isUsed) return false;
  if (this.expiryDate && this.expiryDate < new Date()) return false;
  return true;
};

// Statics
distributorCodeSchema.statics.findByCode = function(code) {
  return this.findOne({ code: code.toUpperCase() });
};

distributorCodeSchema.statics.findUnusedCodes = function() {
  return this.find({ isUsed: false, status: 'active' });
};

distributorCodeSchema.statics.bulkCreate = async function(codes, uploadedBy) {
  const codeDocuments = codes.map(code => ({
    code: typeof code === 'string' ? code.toUpperCase() : code.code.toUpperCase(),
    distributorName: code.distributorName,
    distributorEmail: code.distributorEmail,
    distributorPhone: code.distributorPhone,
    uploadedBy,
    status: 'active',
  }));

  return this.insertMany(codeDocuments, { ordered: false });
};

module.exports = mongoose.model('DistributorCode', distributorCodeSchema);