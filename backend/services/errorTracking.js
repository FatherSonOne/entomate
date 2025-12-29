/**
 * Error Tracking Service
 * Week 8: Production Deployment
 *
 * Integrates with Sentry for error tracking and monitoring.
 * Falls back gracefully if Sentry is not configured.
 */

const logger = require('./logger');

let Sentry = null;
let isInitialized = false;

/**
 * Initialize error tracking (call once at app startup)
 */
function initialize(app) {
  const dsn = process.env.SENTRY_DSN;

  if (!dsn) {
    logger.info('Sentry DSN not configured - error tracking disabled');
    return false;
  }

  try {
    Sentry = require('@sentry/node');

    Sentry.init({
      dsn,
      environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || 'development',
      tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE || '0.1'),
      integrations: [
        // Enable HTTP calls tracing
        new Sentry.Integrations.Http({ tracing: true }),
        // Enable Express.js middleware tracing
        ...(app ? [new Sentry.Integrations.Express({ app })] : [])
      ],
      // Filter out sensitive data
      beforeSend(event, hint) {
        // Remove sensitive headers
        if (event.request && event.request.headers) {
          delete event.request.headers.authorization;
          delete event.request.headers.cookie;
          delete event.request.headers['x-api-key'];
        }

        // Remove sensitive data from request body
        if (event.request && event.request.data) {
          const data = typeof event.request.data === 'string'
            ? JSON.parse(event.request.data)
            : event.request.data;

          if (data.password) data.password = '[REDACTED]';
          if (data.token) data.token = '[REDACTED]';
          if (data.apiKey) data.apiKey = '[REDACTED]';

          event.request.data = JSON.stringify(data);
        }

        return event;
      },
      // Ignore certain errors
      ignoreErrors: [
        // Browser errors
        'ResizeObserver loop limit exceeded',
        // Network errors that are expected
        'Network request failed',
        // Rate limit errors (handled separately)
        'Too many requests'
      ]
    });

    isInitialized = true;
    logger.info('Sentry error tracking initialized');
    return true;
  } catch (error) {
    logger.warn('Failed to initialize Sentry:', error.message);
    return false;
  }
}

/**
 * Get Sentry request handler middleware
 */
function requestHandler() {
  if (!Sentry || !isInitialized) {
    return (req, res, next) => next();
  }
  return Sentry.Handlers.requestHandler();
}

/**
 * Get Sentry tracing handler middleware
 */
function tracingHandler() {
  if (!Sentry || !isInitialized) {
    return (req, res, next) => next();
  }
  return Sentry.Handlers.tracingHandler();
}

/**
 * Get Sentry error handler middleware
 */
function errorHandler() {
  if (!Sentry || !isInitialized) {
    return (err, req, res, next) => next(err);
  }
  return Sentry.Handlers.errorHandler();
}

/**
 * Capture an exception
 */
function captureException(error, context = {}) {
  logger.logError(error, context);

  if (!Sentry || !isInitialized) {
    return null;
  }

  return Sentry.captureException(error, {
    extra: context
  });
}

/**
 * Capture a message
 */
function captureMessage(message, level = 'info', context = {}) {
  logger[level](message, context);

  if (!Sentry || !isInitialized) {
    return null;
  }

  return Sentry.captureMessage(message, {
    level,
    extra: context
  });
}

/**
 * Set user context for error tracking
 */
function setUser(user) {
  if (!Sentry || !isInitialized) return;

  Sentry.setUser({
    id: user.id,
    email: user.email,
    username: user.name
  });
}

/**
 * Clear user context
 */
function clearUser() {
  if (!Sentry || !isInitialized) return;
  Sentry.setUser(null);
}

/**
 * Add breadcrumb for debugging
 */
function addBreadcrumb(message, category = 'custom', data = {}) {
  if (!Sentry || !isInitialized) return;

  Sentry.addBreadcrumb({
    message,
    category,
    data,
    level: 'info'
  });
}

/**
 * Start a transaction for performance monitoring
 */
function startTransaction(name, op) {
  if (!Sentry || !isInitialized) {
    return {
      finish: () => { },
      setStatus: () => { },
      startChild: () => ({
        finish: () => { }
      })
    };
  }

  return Sentry.startTransaction({
    name,
    op
  });
}

/**
 * Check if error tracking is enabled
 */
function isEnabled() {
  return isInitialized && Sentry !== null;
}

/**
 * Flush pending events (call before shutdown)
 */
async function flush(timeout = 2000) {
  if (!Sentry || !isInitialized) return;

  try {
    await Sentry.flush(timeout);
  } catch (error) {
    logger.warn('Error flushing Sentry events:', error.message);
  }
}

module.exports = {
  initialize,
  requestHandler,
  tracingHandler,
  errorHandler,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  startTransaction,
  isEnabled,
  flush
};
