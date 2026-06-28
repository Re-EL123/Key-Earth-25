const mongoose = require('mongoose');

const appointmentSchema = new mongoose.Schema({
  appointmentNumber: {
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
  storeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Store',
    required: true,
    index: true,
  },
  serviceType: {
    type: String,
    enum: ['health_scan', 'wellness_check', 'consultation', 'follow_up', 'other'],
    required: true,
  },
  serviceDetails: {
    type: String,
    trim: true,
  },
  appointmentDate: {
    type: Date,
    required: true,
    index: true,
  },
  appointmentTime: {
    type: String,
    required: true,
  },
  duration: {
    type: Number,
    default: 30, // in minutes
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'],
    default: 'pending',
    index: true,
  },
  customerInfo: {
    name: String,
    email: String,
    phone: String,
    age: Number,
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
    },
  },
  healthInfo: {
    allergies: [String],
    medications: [String],
    conditions: [String],
    notes: String,
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'failed', 'refunded', 'not_required'],
    default: 'not_required',
  },
  amount: {
    type: Number,
    default: 0,
  },
  paymentReference: {
    type: String,
  },
  notes: {
    customer: String,
    store: String,
    internal: String,
  },
  results: {
    summary: String,
    recommendations: [String],
    attachments: [{
      name: String,
      url: String,
      type: String,
    }],
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
  reminderSent: {
    type: Boolean,
    default: false,
  },
  reminderSentAt: {
    type: Date,
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
  completedAt: {
    type: Date,
  },
}, {
  timestamps: true,
});

// Indexes
appointmentSchema.index({ appointmentNumber: 1 }, { unique: true });
appointmentSchema.index({ customerId: 1, appointmentDate: -1 });
appointmentSchema.index({ storeId: 1, appointmentDate: 1 });
appointmentSchema.index({ status: 1, appointmentDate: 1 });

// Pre-save middleware to generate appointment number
appointmentSchema.pre('save', async function(next) {
  if (!this.appointmentNumber) {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 6).toUpperCase();
    this.appointmentNumber = `APT-${timestamp}-${random}`;
  }
  next();
});

// Methods
appointmentSchema.methods.updateStatus = function(status, note, userId) {
  this.status = status;
  this.statusHistory.push({
    status,
    note,
    updatedBy: userId,
    timestamp: new Date(),
  });

  if (status === 'completed') {
    this.completedAt = new Date();
  } else if (status === 'cancelled') {
    this.cancelledAt = new Date();
  }

  return this.save();
};

appointmentSchema.methods.confirm = function(userId) {
  return this.updateStatus('confirmed', 'Appointment confirmed', userId);
};

appointmentSchema.methods.complete = function(results, userId) {
  this.results = results;
  this.completedAt = new Date();
  return this.updateStatus('completed', 'Appointment completed', userId);
};

appointmentSchema.methods.cancel = function(reason, userId) {
  this.cancelledAt = new Date();
  this.cancellationReason = reason;
  return this.updateStatus('cancelled', reason, userId);
};

appointmentSchema.methods.canBeCancelled = function() {
  return ['pending', 'confirmed'].includes(this.status);
};

appointmentSchema.methods.canBeRescheduled = function() {
  return ['pending', 'confirmed'].includes(this.status);
};

// Statics
appointmentSchema.statics.findByAppointmentNumber = function(appointmentNumber) {
  return this.findOne({ appointmentNumber });
};

appointmentSchema.statics.findByCustomer = function(customerId, options = {}) {
  const query = { customerId };
  if (options.status) {
    query.status = options.status;
  }
  return this.find(query).sort({ appointmentDate: -1 });
};

appointmentSchema.statics.findByStore = function(storeId, options = {}) {
  const query = { storeId };
  if (options.status) {
    query.status = options.status;
  }
  if (options.date) {
    const startOfDay = new Date(options.date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(options.date);
    endOfDay.setHours(23, 59, 59, 999);
    query.appointmentDate = { $gte: startOfDay, $lte: endOfDay };
  }
  return this.find(query).sort({ appointmentDate: 1, appointmentTime: 1 });
};

appointmentSchema.statics.findUpcoming = function(storeId, days = 7) {
  const now = new Date();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + days);

  return this.find({
    storeId,
    appointmentDate: { $gte: now, $lte: futureDate },
    status: { $in: ['pending', 'confirmed'] },
  }).sort({ appointmentDate: 1 });
};

appointmentSchema.statics.findAppointmentsNeedingReminder = function() {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);
  
  const endOfTomorrow = new Date(tomorrow);
  endOfTomorrow.setHours(23, 59, 59, 999);

  return this.find({
    appointmentDate: { $gte: tomorrow, $lte: endOfTomorrow },
    status: { $in: ['pending', 'confirmed'] },
    reminderSent: false,
  });
};

module.exports = mongoose.model('Appointment', appointmentSchema);