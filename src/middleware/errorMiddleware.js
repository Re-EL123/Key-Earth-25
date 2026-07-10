/**

 * Global error handler

 */

const errorHandler = (err, req, res, next) => {

  console.error('Error:', err);



  // Mongoose validation error

  if (err && err.name === 'ValidationError') {

    const errors = Object.values(err.errors || {}).map(e => ({

      field: e.path,

      message: e.message,

    }));



    return res.status(400).json({

      success: false,

      message: 'Validation failed',

      errors,

    });

  }



  // Mongoose duplicate key error

  if (err && err.code === 11000) {

    const field = Object.keys(err.keyPattern || err.keyValue || {})[0] || 'field';

    return res.status(400).json({

      success: false,

      message: `${field} already exists`,

      field,

    });

  }



  // Mongoose cast error (invalid ObjectId)

  if (err && err.name === 'CastError') {

    return res.status(400).json({

      success: false,

      message: `Invalid ${err.path}: ${err.value}`,

    });

  }



  // JWT errors

  if (err && err.name === 'JsonWebTokenError') {

    return res.status(401).json({

      success: false,

      message: 'Invalid token',

    });

  }



  if (err && err.name === 'TokenExpiredError') {

    return res.status(401).json({

      success: false,

      message: 'Token expired',

    });

  }



  // Default error

  const statusCode = err && err.statusCode ? err.statusCode : 500;

  const message = (err && err.message) || 'Internal server error';



  res.status(statusCode).json({

    success: false,

    message,

    ...(process.env.NODE_ENV === 'development' && {

      stack: err?.stack,

      error: err,

    }),

  });

};



/**

 * Handle 404 errors

 */

const notFound = (req, res, next) => {

  const error = new Error(`Not found - ${req.originalUrl}`);

  error.statusCode = 404;

  next(error);

};



/**

 * Async handler wrapper

 */

const asyncHandler = (fn) => (req, res, next) => {

  // Ensure fn is actually a function

  if (typeof fn !== 'function') {

    return next(new Error('asyncHandler received a non-function'));

  }



  Promise.resolve(fn(req, res, next)).catch(next);

};



module.exports = {

  errorHandler,

  notFound,

  asyncHandler,

};
