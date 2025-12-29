/**
 * Centralized Logging Service
 * Week 8: Production Deployment
 *
 * Provides structured logging with:
 * - Console output (colored for development)
 * - File logging (error.log, combined.log)
 * - JSON format for production (easy parsing)
 * - Request/response logging
 * - Error tracking integration
 */

const winston = require('winston');
const path = require('path');

// Define log levels
const levels = {
  error: 0,
  warn: 1,
  info: 2,
  http: 3,
  debug: 4
};

// Define colors for each level
const colors = {
  error: 'red',
  warn: 'yellow',
  info: 'green',
  http: 'magenta',
  debug: 'blue'
};

winston.addColors(colors);

// Determine log level based on environment
const level = () => {
  const env = process.env.NODE_ENV || 'development';
  const configuredLevel = process.env.LOG_LEVEL;

  if (configuredLevel) return configuredLevel;
  return env === 'development' ? 'debug' : 'info';
};

// Custom format for development (readable)
const devFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.colorize({ all: true }),
  winston.format.printf(
    (info) => `${info.timestamp} ${info.level}: ${info.message}${info.meta ? ' ' + JSON.stringify(info.meta) : ''}`
  )
);

// Custom format for production (JSON)
const prodFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Determine format based on environment
const format = process.env.NODE_ENV === 'production' ? prodFormat : devFormat;

// Define transports
const transports = [
  // Console output
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production'
      ? prodFormat
      : devFormat
  })
];

// Add file transports in production
if (process.env.NODE_ENV === 'production') {
  const logsDir = process.env.LOGS_DIR || path.join(__dirname, '..', 'logs');

  // Error logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5,
      tailable: true
    })
  );

  // Combined logs
  transports.push(
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 10,
      tailable: true
    })
  );
}

// Create logger instance
const logger = winston.createLogger({
  level: level(),
  levels,
  format,
  transports,
  exitOnError: false
});

/**
 * Log an HTTP request
 */
logger.logRequest = (req, res, duration) => {
  const meta = {
    method: req.method,
    url: req.originalUrl,
    status: res.statusCode,
    duration: `${duration}ms`,
    ip: req.ip,
    userAgent: req.get('user-agent'),
    requestId: req.requestId
  };

  if (res.statusCode >= 400) {
    logger.warn(`${req.method} ${req.originalUrl} ${res.statusCode}`, { meta });
  } else {
    logger.http(`${req.method} ${req.originalUrl} ${res.statusCode}`, { meta });
  }
};

/**
 * Log an error with context
 */
logger.logError = (error, context = {}) => {
  const meta = {
    name: error.name,
    message: error.message,
    stack: error.stack,
    ...context
  };

  logger.error(error.message, { meta });
};

/**
 * Log an API call to external service
 */
logger.logExternalCall = (service, method, duration, success, details = {}) => {
  const meta = {
    service,
    method,
    duration: `${duration}ms`,
    success,
    ...details
  };

  if (success) {
    logger.info(`External call: ${service}.${method}`, { meta });
  } else {
    logger.warn(`External call failed: ${service}.${method}`, { meta });
  }
};

/**
 * Log a business event
 */
logger.logEvent = (event, data = {}) => {
  logger.info(`Event: ${event}`, { meta: data });
};

/**
 * Log security-related events
 */
logger.logSecurity = (event, details = {}) => {
  logger.warn(`Security: ${event}`, { meta: details });
};

/**
 * Log performance metrics
 */
logger.logPerformance = (operation, duration, details = {}) => {
  const meta = {
    operation,
    duration: `${duration}ms`,
    ...details
  };

  if (duration > 1000) {
    logger.warn(`Slow operation: ${operation}`, { meta });
  } else {
    logger.debug(`Performance: ${operation}`, { meta });
  }
};

/**
 * Create a child logger with additional context
 */
logger.child = (context) => {
  return {
    info: (msg, meta = {}) => logger.info(msg, { meta: { ...context, ...meta } }),
    warn: (msg, meta = {}) => logger.warn(msg, { meta: { ...context, ...meta } }),
    error: (msg, meta = {}) => logger.error(msg, { meta: { ...context, ...meta } }),
    debug: (msg, meta = {}) => logger.debug(msg, { meta: { ...context, ...meta } })
  };
};

module.exports = logger;
