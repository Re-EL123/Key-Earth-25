const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const { errorHandler, notFound } = require('./middleware/errorMiddleware');

// Import routes
const authRoutes = require('./routes/authRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');
const storeRoutes = require('./routes/storeRoutes');
const productRoutes = require('./routes/productRoutes');
const orderRoutes = require('./routes/orderRoutes');
const customerRoutes = require('./routes/customerRoutes');
const driverRoutes = require('./routes/driverRoutes');
const appointmentRoutes = require('./routes/appointmentRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const reportingRoutes = require('./routes/reportingRoutes');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const allowedOrigins = [
  // Config-based frontends
  config.frontendUrls?.superAdmin,
  config.frontendUrls?.storeOwner,
  config.frontendUrls?.customer,
  config.frontendUrls?.driverApp,

  // Local dev frontends
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',

  // GitHub Codespaces / external frontends
  'https://bug-free-spork-g4q96vvr7g9v39wr7-3000.app.github.dev',
  'https://bug-free-spork-g4q96vvr7g9v39wr7-3001.app.github.dev', // current origin
  'https://bug-free-spork-g4q96vvr7g9v39wr7-3002.app.github.dev',
  'https://bug-free-spork-g4q96vvr7g9v39wr7-8081.app.github.dev',
  'https://crispy-space-enigma-v6v4wjjrqxw9hxr44-3002.app.github.dev',
].filter(Boolean);

const corsOptions = {
  origin(origin, callback) {
    // Allow non-browser tools (no origin) and allowed browser origins
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`Not allowed by CORS: ${origin}`));
    }
  },
  credentials: true,            // allow cookies / Authorization headers
  optionsSuccessStatus: 200,    // some legacy browsers choke on 204
};

// Apply CORS to all routes
app.use(cors(corsOptions));

// Explicitly handle preflight OPTIONS for all routes
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,                 // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
});

app.use('/api/', limiter);

// Serve static files
app.use('/uploads', express.static('uploads'));

// Health check route
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Green World API is running',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', superAdminRoutes);
app.use('/api/stores', storeRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/drivers', driverRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/reports', reportingRoutes);

// API documentation route
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'Green World API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      admin: '/api/admin',
      stores: '/api/stores',
      products: '/api/products',
      orders: '/api/orders',
      customers: '/api/customers',
      drivers: '/api/drivers',
      appointments: '/api/appointments',
      subscriptions: '/api/subscriptions',
      reports: '/api/reports',
    },
    documentation: 'See README.md for full API documentation',
  });
});

// 404 handler
app.use(notFound);

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;
