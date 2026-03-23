/**
 * Error Monitoring Service
 * Centralized error tracking and reporting for Enhanced Intelligence Dashboard
 * Integrates with Sentry for production error monitoring
 */

class ErrorMonitoringService {
  constructor() {
    this.sentryEnabled = process.env.SENTRY_DSN && process.env.NODE_ENV === 'production';
    this.sentry = null;

    if (this.sentryEnabled) {
      this.initializeSentry();
    }
  }

  /**
   * Initialize Sentry SDK
   */
  initializeSentry() {
    try {
      const Sentry = require('@sentry/node');
const log = require('../../utils/log');

      Sentry.init({
        dsn: process.env.SENTRY_DSN,
        environment: process.env.NODE_ENV || 'development',

        // Performance Monitoring
        tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1,

        // Enhanced context
        beforeSend(event, hint) {
          // Filter out sensitive data
          if (event.request) {
            delete event.request.cookies;
            if (event.request.headers) {
              delete event.request.headers.authorization;
              delete event.request.headers.cookie;
            }
          }
          return event;
        },

        // Integrations
        integrations: [
          new Sentry.Integrations.Http({ tracing: true }),
          new Sentry.Integrations.Express({ app: require('../../server').app })
        ]
      });

      this.sentry = Sentry;
      log.info('[ErrorMonitoring] Sentry initialized successfully');
    } catch (error) {
      log.error('[ErrorMonitoring] Failed to initialize Sentry:', { error: error.message || error });
    }
  }

  /**
   * Capture an exception with context
   * @param {Error} error - The error to capture
   * @param {Object} context - Additional context
   */
  captureException(error, context = {}) {
    // Log to console in all environments
    log.error('[ErrorMonitoring] Exception:', { error: error.message || error });
    log.error('[ErrorMonitoring] Context:', context);

    if (this.sentryEnabled && this.sentry) {
      this.sentry.withScope(scope => {
        // Add context tags
        if (context.userId) {
          scope.setUser({ id: context.userId });
        }

        if (context.service) {
          scope.setTag('service', context.service);
        }

        if (context.operation) {
          scope.setTag('operation', context.operation);
        }

        // Add extra context
        Object.keys(context).forEach(key => {
          if (!['userId', 'service', 'operation'].includes(key)) {
            scope.setExtra(key, context[key]);
          }
        });

        this.sentry.captureException(error);
      });
    }
  }

  /**
   * Capture a message with severity level
   * @param {string} message - The message to capture
   * @param {string} level - Severity level (info, warning, error)
   * @param {Object} context - Additional context
   */
  captureMessage(message, level = 'info', context = {}) {
    log.info(`[ErrorMonitoring] [${level.toUpperCase()}] ${message}`, context);

    if (this.sentryEnabled && this.sentry) {
      this.sentry.withScope(scope => {
        Object.keys(context).forEach(key => {
          scope.setExtra(key, context[key]);
        });

        this.sentry.captureMessage(message, level);
      });
    }
  }

  /**
   * Track AI API usage for cost monitoring
   * @param {string} model - AI model used
   * @param {number} tokens - Tokens consumed
   * @param {number} cost - Estimated cost
   * @param {Object} metadata - Additional metadata
   */
  trackAIUsage(model, tokens, cost, metadata = {}) {
    const usageData = {
      timestamp: new Date().toISOString(),
      model,
      tokens,
      estimatedCost: cost,
      ...metadata
    };

    log.info('[ErrorMonitoring] AI Usage:', usageData);

    if (this.sentryEnabled && this.sentry) {
      this.sentry.addBreadcrumb({
        category: 'ai-usage',
        message: `${model} used ${tokens} tokens`,
        level: 'info',
        data: usageData
      });
    }

    // TODO: Send to analytics service or cost tracking database
    this.logToAnalytics('ai_usage', usageData);
  }

  /**
   * Track Intelligence Dashboard feature usage
   * @param {string} feature - Feature name
   * @param {Object} metadata - Additional metadata
   */
  trackFeatureUsage(feature, metadata = {}) {
    const featureData = {
      timestamp: new Date().toISOString(),
      feature,
      ...metadata
    };

    if (this.sentryEnabled && this.sentry) {
      this.sentry.addBreadcrumb({
        category: 'feature-usage',
        message: `Feature used: ${feature}`,
        level: 'info',
        data: featureData
      });
    }

    this.logToAnalytics('feature_usage', featureData);
  }

  /**
   * Log to analytics service
   * @param {string} eventType - Type of event
   * @param {Object} data - Event data
   */
  logToAnalytics(eventType, data) {
    // TODO: Integrate with your analytics service (Mixpanel, Amplitude, etc.)
    // For now, just log to console in development
    if (process.env.NODE_ENV === 'development') {
      log.info('[Analytics]', eventType, data);
    }
  }

  /**
   * Measure performance of async operations
   * @param {string} operation - Operation name
   * @param {Function} fn - Async function to measure
   * @returns {Promise} Result of the function
   */
  async measurePerformance(operation, fn) {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      this.trackPerformance(operation, duration, true);

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      this.trackPerformance(operation, duration, false);
      throw error;
    }
  }

  /**
   * Track performance metrics
   * @param {string} operation - Operation name
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether operation succeeded
   */
  trackPerformance(operation, duration, success) {
    const performanceData = {
      operation,
      duration,
      success,
      timestamp: new Date().toISOString()
    };

    log.info('[Performance]', performanceData);

    if (this.sentryEnabled && this.sentry) {
      this.sentry.addBreadcrumb({
        category: 'performance',
        message: `${operation} took ${duration}ms`,
        level: success ? 'info' : 'warning',
        data: performanceData
      });
    }

    this.logToAnalytics('performance', performanceData);
  }
}

module.exports = new ErrorMonitoringService();
