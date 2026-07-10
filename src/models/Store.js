const mongoose = require('mongoose');

const slugify = require('slugify');



const storeSchema = new mongoose.Schema({

  distributorId: {

    type: mongoose.Schema.Types.ObjectId,

    ref: 'User',

    required: true,

    index: true,

  },

  name: {

    type: String,

    required: true,

    trim: true,

  },

  slug: {

    type: String,

    unique: true,

    lowercase: true,

    index: true,

  },

  description: {

    type: String,

    trim: true,

  },

  logo: {

    type: String,

  },

  bannerImage: {

    type: String,

  },

  contactInfo: {

    email: {

      type: String,

      lowercase: true,

      trim: true,

    },

    phone: {

      type: String,

      trim: true,

    },

    whatsapp: {

      type: String,

      trim: true,

    },

  },

  address: {

    street: String,

    city: String,

    state: String,

    country: String,

    postalCode: String,

    coordinates: {

      latitude: Number,

      longitude: Number,

    },

  },

  businessHours: [{

    day: {

      type: String,

      enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'],

    },

    isOpen: {

      type: Boolean,

      default: true,

    },

    openTime: String,

    closeTime: String,

  }],

  subscriptionStatus: {

    type: String,

    enum: ['active', 'expired', 'suspended', 'cancelled'],

    default: 'active',

  },

  subscriptionExpiry: {

    type: Date,

    required: true,

  },

  isActive: {

    type: Boolean,

    default: true,

  },

  settings: {

    acceptOrders: {

      type: Boolean,

      default: true,

    },

    acceptAppointments: {

      type: Boolean,

      default: true,

    },

    minimumOrderAmount: {

      type: Number,

      default: 0,

    },

    deliveryFee: {

      type: Number,

      default: 0,

    },

    freeDeliveryThreshold: {

      type: Number,

      default: 0,

    },

    taxRate: {

      type: Number,

      default: 0,

    },

  },

  stats: {

    totalOrders: {

      type: Number,

      default: 0,

    },

    totalRevenue: {

      type: Number,

      default: 0,

    },

    totalCustomers: {

      type: Number,

      default: 0,

    },

    averageRating: {

      type: Number,

      default: 0,

    },

  },

  paymentMethods: [{

    type: String,

    enum: ['cash', 'card', 'transfer', 'wallet'],

  }],

  isVerified: {

    type: Boolean,

    default: false,

  },

  verifiedAt: {

    type: Date,

  },

}, {

  timestamps: true,

});



// Indexes

storeSchema.index({ distributorId: 1 });

storeSchema.index({ slug: 1 }, { unique: true });

storeSchema.index({ subscriptionStatus: 1 });

storeSchema.index({ isActive: 1 });

storeSchema.index({ 'address.city': 1 });

storeSchema.index({ 'address.state': 1 });



// Pre-save middleware to generate slug (async without next)

storeSchema.pre('save', async function () {

  if (this.isModified('name') && !this.slug) {

    const baseSlug = slugify(this.name, { lower: true, strict: true });

    let slug = baseSlug;

    let counter = 1;



    // Ensure unique slug

    while (await this.constructor.findOne({ slug })) {

      slug = `${baseSlug}-${counter}`;

      counter++;

    }



    this.slug = slug;

  }

});



// Check if subscription is expired (sync, uses next)

storeSchema.pre('save', function (next) {

  if (this.subscriptionExpiry && this.subscriptionExpiry < new Date()) {

    this.subscriptionStatus = 'expired';

    this.isActive = false;

  }

  next();

});



// Methods

storeSchema.methods.isSubscriptionActive = function () {

  return this.subscriptionStatus === 'active' &&

         this.subscriptionExpiry > new Date() &&

         this.isActive;

};



storeSchema.methods.canAcceptOrders = function () {

  return this.isSubscriptionActive() &&

         this.settings.acceptOrders &&

         this.isActive;

};



storeSchema.methods.canAcceptAppointments = function () {

  return this.isSubscriptionActive() &&

         this.settings.acceptAppointments &&

         this.isActive;

};



storeSchema.methods.renewSubscription = function (months = 12) {

  const now = new Date();

  const expiryDate = new Date(now);

  expiryDate.setMonth(expiryDate.getMonth() + months);



  this.subscriptionExpiry = expiryDate;

  this.subscriptionStatus = 'active';

  this.isActive = true;



  return this.save();

};



storeSchema.methods.incrementOrderStats = function (orderAmount) {

  this.stats.totalOrders += 1;

  this.stats.totalRevenue += orderAmount;

  return this.save();

};



// Virtuals

storeSchema.virtual('url').get(function () {

  return `/store/${this.slug}`;

});



storeSchema.virtual('daysUntilExpiry').get(function () {

  if (!this.subscriptionExpiry) return 0;

  const diff = this.subscriptionExpiry - new Date();

  return Math.ceil(diff / (1000 * 60 * 60 * 24));

});



// Statics

storeSchema.statics.findBySlug = function (slug) {

  return this.findOne({ slug: slug.toLowerCase() });

};



storeSchema.statics.findByDistributor = function (distributorId) {

  return this.find({ distributorId });

};



storeSchema.statics.findActiveStores = function () {

  return this.find({

    isActive: true,

    subscriptionStatus: 'active',

    subscriptionExpiry: { $gt: new Date() },

  });

};



storeSchema.statics.findExpiringStores = function (days = 30) {

  const futureDate = new Date();

  futureDate.setDate(futureDate.getDate() + days);



  return this.find({

    subscriptionExpiry: {

      $gte: new Date(),

      $lte: futureDate,

    },

    subscriptionStatus: 'active',

  });

};



module.exports = mongoose.model('Store', storeSchema);
