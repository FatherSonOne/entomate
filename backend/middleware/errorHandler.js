/**
 * Global Error Handler Middleware
 * Catches all errors and returns consistent error responses
 */

class AppError extends Error {
  constructor(message, statusCode, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

// Common error types
const ErrorTypes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  CONFLICT: 'CONFLICT',
  RATE_LIMIT: 'RATE_LIMIT',
  EXTERNAL_SERVICE: 'EXTERNAL_SERVICE',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Not Found Handler
 * Catches requests to undefined routes
 */
const notFoundHandler = (req, res, next) => {
  const error = new AppError(
    `Route ${req.method} ${req.originalUrl} not found`,
    404,
    ErrorTypes.NOT_FOUND
  );
  next(error);
};

/**
 * Global Error Handler
 * Formats and sends error responses
 */
const errorHandler = (err, req, res, next) => {
  // Default values
  err.statusCode = err.statusCode || 500;
  err.code = err.code || ErrorTypes.INTERNAL_ERROR;

  // Log error (in production, send to logging service)
  if (process.env.NODE_ENV !== 'test') {
    log.error('Error:', {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode,
      stack: err.stack,
      path: req.path,
      method: req.method,
      user: req.user?.id || 'anonymous'
    });
  }

  // Handle specific error types
  let response = {
    success: false,
    error: {
      message: err.message,
      code: err.code,
      statusCode: err.statusCode
    }
  };

  // Handle Supabase errors
  if (err.message?.includes('duplicate key') || err.code === '23505') {
    response.error.message = 'Resource already exists';
    response.error.code = ErrorTypes.CONFLICT;
    err.statusCode = 409;
  }

  // Handle validation errors
  if (err.name === 'ValidationError') {
    response.error.message = err.message;
    response.error.code = ErrorTypes.VALIDATION_ERROR;
    err.statusCode = 400;
  }

  // Handle JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    response.error.message = 'Invalid or expired authentication token';
    response.error.code = ErrorTypes.UNAUTHORIZED;
    err.statusCode = 401;
  }

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
  }

  // Add request ID for tracking
  response.error.requestId = req.headers['x-request-id'] || `req_${Date.now()}`;
  response.error.timestamp = new Date().toISOString();

  res.status(err.statusCode).json(response);
};

/**
 * Async Handler Wrapper
 * Catches errors in async route handlers
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

/**
 * Validation Error Helper
 */
const validationError = (message, field = null) => {
  const error = new AppError(message, 400, ErrorTypes.VALIDATION_ERROR);
  if (field) error.field = field;
  return error;
};

/**
 * Not Found Error Helper
 */
const notFoundError = (resource = 'Resource') => {
  return new AppError(`${resource} not found`, 404, ErrorTypes.NOT_FOUND);
};

/**
 * Forbidden Error Helper
 */
const forbiddenError = (message = 'Access denied') => {
  return new AppError(message, 403, ErrorTypes.FORBIDDEN);
};

/**
 * External Service Error Helper
 */
const externalServiceError = (service, message) => {
  return new AppError(
    `${service} service error: ${message}`,
    502,
    ErrorTypes.EXTERNAL_SERVICE
  );
};

module.exports = {
  AppError,
  ErrorTypes,
  notFoundHandler,
  errorHandler,
  asyncHandler,
  validationError,
  notFoundError,
  forbiddenError,
  externalServiceError
};
