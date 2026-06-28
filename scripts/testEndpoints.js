#!/usr/bin/env node

require('dotenv').config();

const http = require('http');
const mongoose = require('mongoose');
const app = require('../src/app');

const authRoutes = require('../src/routes/authRoutes');
const superAdminRoutes = require('../src/routes/superAdminRoutes');
const storeRoutes = require('../src/routes/storeRoutes');
const productRoutes = require('../src/routes/productRoutes');
const orderRoutes = require('../src/routes/orderRoutes');
const customerRoutes = require('../src/routes/customerRoutes');
const driverRoutes = require('../src/routes/driverRoutes');
const appointmentRoutes = require('../src/routes/appointmentRoutes');
const subscriptionRoutes = require('../src/routes/subscriptionRoutes');
const reportingRoutes = require('../src/routes/reportingRoutes');

const ROUTE_GROUPS = [
  { prefix: '/api/auth', router: authRoutes },
  { prefix: '/api/admin', router: superAdminRoutes },
  { prefix: '/api/stores', router: storeRoutes },
  { prefix: '/api/products', router: productRoutes },
  { prefix: '/api/orders', router: orderRoutes },
  { prefix: '/api/customers', router: customerRoutes },
  { prefix: '/api/drivers', router: driverRoutes },
  { prefix: '/api/appointments', router: appointmentRoutes },
  { prefix: '/api/subscriptions', router: subscriptionRoutes },
  { prefix: '/api/reports', router: reportingRoutes },
];

const SAMPLE_VALUES = {
  id: '507f1f77bcf86cd799439011',
  storeId: '507f1f77bcf86cd799439012',
  orderId: '507f1f77bcf86cd799439013',
  productId: '507f1f77bcf86cd799439014',
  identifier: 'demo-store',
  path: 'demo-store',
};

function replaceParams(path) {
  return path
    .replace(/:id/g, SAMPLE_VALUES.id)
    .replace(/:storeId/g, SAMPLE_VALUES.storeId)
    .replace(/:orderId/g, SAMPLE_VALUES.orderId)
    .replace(/:productId/g, SAMPLE_VALUES.productId)
    .replace(/:identifier/g, SAMPLE_VALUES.identifier)
    .replace(/:path/g, SAMPLE_VALUES.path);
}

function extractRoutes() {
  const routes = [];

  for (const group of ROUTE_GROUPS) {
    for (const layer of group.router.stack) {
      if (!layer.route) continue;

      const methods = Object.keys(layer.route.methods).filter(Boolean);
      const fullPath = `${group.prefix}${layer.route.path}`;

      for (const method of methods) {
        routes.push({
          method: method.toUpperCase(),
          path: replaceParams(fullPath),
          originalPath: fullPath,
        });
      }
    }
  }

  routes.push({ method: 'GET', path: '/health', originalPath: '/health' });
  routes.push({ method: 'GET', path: '/api', originalPath: '/api' });

  return routes;
}

function requestEndpoint({ method, path }) {
  return new Promise((resolve) => {
    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: process.env.PORT || 5000,
        path,
        method,
        headers: {
          'Content-Type': 'application/json',
        },
      },
      (res) => {
        let body = '';

        res.on('data', (chunk) => {
          body += chunk;
        });

        res.on('end', () => {
          resolve({
            statusCode: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      }
    );

    req.on('error', (error) => {
      resolve({
        statusCode: 0,
        error: error.message,
      });
    });

    req.setTimeout(5000, () => {
      req.destroy(new Error('Request timed out'));
    });

    req.end();
  });
}

async function checkDatabaseHealth() {
  const mongoUri = process.env.MONGODB_URI;

  if (!mongoUri) {
    return {
      status: 'unavailable',
      message: 'MONGODB_URI is not configured',
    };
  }

  try {
    const connection = await mongoose.connect(mongoUri, {
      serverSelectionTimeoutMS: 3000,
    });

    await mongoose.connection.db.admin().ping();

    return {
      status: 'healthy',
      host: connection.connection.host,
      name: connection.connection.name,
      readyState: connection.connection.readyState,
    };
  } catch (error) {
    return {
      status: 'unhealthy',
      message: error.message,
    };
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
}

function formatEndpointResult(result, endpoint) {
  const status = result.statusCode === 0 ? 'error' : 'ok';

  if (result.statusCode === 0) {
    return {
      status,
      code: 'ERR',
      detail: result.error,
    };
  }

  if (result.statusCode >= 200 && result.statusCode < 300) {
    return {
      status: 'ok',
      code: result.statusCode,
      detail: 'success',
    };
  }

  if (result.statusCode === 401 || result.statusCode === 403) {
    return {
      status: 'protected',
      code: result.statusCode,
      detail: 'authentication required',
    };
  }

  if (result.statusCode === 404 || result.statusCode === 400) {
    return {
      status: 'warn',
      code: result.statusCode,
      detail: 'route responded with client error',
    };
  }

  return {
    status: 'warn',
    code: result.statusCode,
    detail: 'non-2xx response',
  };
}

async function main() {
  const originalConsoleError = console.error;
  console.error = () => {};

  const dbHealth = await checkDatabaseHealth();

  const server = app.listen(process.env.PORT || 5000, '127.0.0.1');

  await new Promise((resolve) => server.once('listening', resolve));

  try {
    const routes = extractRoutes();
    const results = [];

    for (const route of routes) {
      const result = await requestEndpoint(route);
      const summary = formatEndpointResult(result, route);
      results.push({
        method: route.method,
        path: route.originalPath,
        status: summary.code,
        detail: summary.detail,
      });
    }

    console.log('🧪 Endpoint Test Report');
    console.log('======================');
    console.log(`Database health: ${dbHealth.status}`);

    if (dbHealth.status === 'healthy') {
      console.log(`Mongo host: ${dbHealth.host}`);
      console.log(`Database: ${dbHealth.name}`);
      console.log(`Ready state: ${dbHealth.readyState}`);
    } else {
      console.log(`Reason: ${dbHealth.message}`);
    }

    console.log('');
    console.log('Endpoint results:');
    for (const result of results) {
      console.log(`${result.method} ${result.path} -> ${result.status} (${result.detail})`);
    }

    const okCount = results.filter((r) => r.status === 'ok').length;
    const protectedCount = results.filter((r) => r.status === 'protected').length;
    const warnCount = results.filter((r) => r.status === 'warn').length;
    const errorCount = results.filter((r) => r.status === 'ERR').length;

    console.log('');
    console.log(`Summary: ${okCount} ok, ${protectedCount} protected, ${warnCount} warn, ${errorCount} errors`);
  } finally {
    console.error = originalConsoleError;

    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
        } else {
          resolve();
        }
      });
    });
  }
}

main().catch((error) => {
  console.error('❌ Endpoint test failed:', error.message);
  process.exitCode = 1;
});
