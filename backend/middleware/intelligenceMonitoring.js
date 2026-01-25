/**
 * Intelligence Dashboard Monitoring Middleware
 * Tracks usage, performance, and errors for Enhanced Intelligence features
 */

const errorMonitoring = require('../services/monitoring/ErrorMonitoring');

/**
 * Middleware to track Intelligence API endpoint usage
 */
function trackIntelligenceUsage(req, res, next) {
  const startTime = Date.now();
  const originalJson = res.json;

  // Override res.json to capture response
  res.json = function(data) {
    const duration = Date.now() - startTime;
    const success = res.statusCode >= 200 && res.statusCode < 400;

    // Track endpoint usage
    errorMonitoring.trackFeatureUsage('intelligence_api', {
      endpoint: req.path,
      method: req.method,
      userId: req.user?.id,
      duration,
      success,
      statusCode: res.statusCode
    });

    // Track performance
    errorMonitoring.trackPerformance(`intelligence${req.path}`, duration, success);

    // Call original json method
    return originalJson.call(this, data);
  };

  next();
}

/**
 * Middleware to track AI-powered features specifically
 */
function trackAIFeatureUsage(featureName) {
  return (req, res, next) => {
    const startTime = Date.now();

    // Track feature initiation
    errorMonitoring.trackFeatureUsage(featureName, {
      userId: req.user?.id,
      params: req.params,
      query: req.query,
      initiated: true
    });

    // Track completion
    const originalJson = res.json;
    res.json = function(data) {
      const duration = Date.now() - startTime;

      errorMonitoring.trackFeatureUsage(featureName, {
        userId: req.user?.id,
        duration,
        completed: true,
        success: res.statusCode >= 200 && res.statusCode < 400
      });

      return originalJson.call(this, data);
    };

    next();
  };
}

/**
 * Error handler middleware for Intelligence routes
 */
function intelligenceErrorHandler(err, req, res, next) {
  // Capture error with context
  errorMonitoring.captureException(err, {
    userId: req.user?.id,
    service: 'intelligence-dashboard',
    operation: req.path,
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body
  });

  // Send error response
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

module.exports = {
  trackIntelligenceUsage,
  trackAIFeatureUsage,
  intelligenceErrorHandler
};
