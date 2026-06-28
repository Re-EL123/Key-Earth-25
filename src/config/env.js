const dotenv = require('dotenv');
const path = require('path');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });

const config = {
  // Server
  port: process.env.PORT || 5000,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  // Database
  mongodbUri: process.env.MONGODB_URI,
  mongodbTestUri: process.env.MONGODB_TEST_URI,
  
  // Firebase
  firebase: {
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY,
  },
  
  // JWT
  jwt: {
    secret: process.env.JWT_SECRET,
    expire: process.env.JWT_EXPIRE || '7d',
  },
  
  // Email
  email: {
    host: process.env.EMAIL_HOST,
    port: parseInt(process.env.EMAIL_PORT || '587'),
    user: process.env.EMAIL_USER,
    password: process.env.EMAIL_PASSWORD,
    from: process.env.EMAIL_FROM,
  },
  
  // Platform
  platform: {
    feePercentage: parseFloat(process.env.PLATFORM_FEE_PERCENTAGE || '25'),
    driverFeePercentage: parseFloat(process.env.DRIVER_FEE_PERCENTAGE || '75'),
    subscriptionYearlyFee: parseFloat(process.env.SUBSCRIPTION_YEARLY_FEE || '50000'),
    subscriptionDurationMonths: parseInt(process.env.SUBSCRIPTION_DURATION_MONTHS || '12'),
  },
  
  // File Upload
  upload: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '5242880'), // 5MB
    uploadPath: process.env.UPLOAD_PATH || './uploads',
  },
  
  // Frontend URLs
  frontendUrls: {
    superAdmin: process.env.SUPER_ADMIN_URL,
    storeOwner: process.env.STORE_OWNER_URL,
    customer: process.env.CUSTOMER_URL,
    driverApp: process.env.DRIVER_APP_URL,
  },
  
  // Pagination
  pagination: {
    defaultPageSize: parseInt(process.env.DEFAULT_PAGE_SIZE || '20'),
    maxPageSize: parseInt(process.env.MAX_PAGE_SIZE || '100'),
  },
};

// Validate required environment variables
const requiredEnvVars = [
  'MONGODB_URI',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'JWT_SECRET',
];

requiredEnvVars.forEach((varName) => {
  if (!process.env[varName]) {
    console.error(`Missing required environment variable: ${varName}`);
    process.exit(1);
  }
});

module.exports = config;