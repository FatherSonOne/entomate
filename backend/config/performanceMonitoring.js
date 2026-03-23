/**
 * Performance Monitoring Configuration
 * Tracks and alerts on performance metrics for Enhanced Intelligence Dashboard
 */

const errorMonitoring = require('../services/monitoring/ErrorMonitoring');
const log = require('../utils/log');

class PerformanceMonitor {
  constructor() {
    this.metrics = {
      apiEndpoints: {},
      databaseQueries: {},
      cacheHitRate: {
        hits: 0,
        misses: 0,
        total: 0
      },
      aiApiCalls: {
        totalCalls: 0,
        totalDuration: 0,
        failures: 0
      }
    };

    // Performance thresholds (in milliseconds)
    this.thresholds = {
      '/api/intelligence/dashboard': 2000,
      '/api/intelligence/meeting-prep/:id': 1000,
      '/api/intelligence/deal-risks': 3000,
      '/api/intelligence/action-items': 1000,
      '/api/intelligence/relationships/:dealId': 1500,
      'database_query': 500,
      'ai_api_call': 5000
    };
  }

  /**
   * Track API endpoint performance
   * @param {string} endpoint - Endpoint path
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether request succeeded
   */
  trackEndpoint(endpoint, duration, success) {
    if (!this.metrics.apiEndpoints[endpoint]) {
      this.metrics.apiEndpoints[endpoint] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        minDuration: Infinity,
        maxDuration: 0,
        failures: 0,
        slowRequests: 0
      };
    }

    const metric = this.metrics.apiEndpoints[endpoint];
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;
    metric.minDuration = Math.min(metric.minDuration, duration);
    metric.maxDuration = Math.max(metric.maxDuration, duration);

    if (!success) {
      metric.failures++;
    }

    // Check if request exceeded threshold
    const threshold = this.thresholds[endpoint] || 2000;
    if (duration > threshold) {
      metric.slowRequests++;

      log.warn('[Performance] Slow request detected:', {
        endpoint,
        duration: `${duration}ms`,
        threshold: `${threshold}ms`,
        exceeded: `${duration - threshold}ms`
      });

      // Alert if consistently slow
      if (metric.slowRequests > 10 && metric.slowRequests / metric.count > 0.2) {
        errorMonitoring.captureMessage(
          `Performance degradation on ${endpoint}`,
          'warning',
          {
            avgDuration: metric.avgDuration,
            maxDuration: metric.maxDuration,
            slowRequestRate: (metric.slowRequests / metric.count * 100).toFixed(1) + '%'
          }
        );
      }
    }

    errorMonitoring.trackPerformance(endpoint, duration, success);
  }

  /**
   * Track database query performance
   * @param {string} queryType - Type of query
   * @param {number} duration - Duration in milliseconds
   */
  trackDatabaseQuery(queryType, duration) {
    if (!this.metrics.databaseQueries[queryType]) {
      this.metrics.databaseQueries[queryType] = {
        count: 0,
        totalDuration: 0,
        avgDuration: 0,
        slowQueries: 0
      };
    }

    const metric = this.metrics.databaseQueries[queryType];
    metric.count++;
    metric.totalDuration += duration;
    metric.avgDuration = metric.totalDuration / metric.count;

    if (duration > this.thresholds.database_query) {
      metric.slowQueries++;

      log.warn('[Performance] Slow database query:', {
        queryType,
        duration: `${duration}ms`,
        threshold: `${this.thresholds.database_query}ms`
      });
    }
  }

  /**
   * Track cache performance
   * @param {boolean} hit - Whether cache hit occurred
   */
  trackCache(hit) {
    this.metrics.cacheHitRate.total++;

    if (hit) {
      this.metrics.cacheHitRate.hits++;
    } else {
      this.metrics.cacheHitRate.misses++;
    }

    const hitRate = this.metrics.cacheHitRate.hits / this.metrics.cacheHitRate.total;

    // Alert if hit rate drops below 60%
    if (this.metrics.cacheHitRate.total > 100 && hitRate < 0.6) {
      log.warn('[Performance] Low cache hit rate:', {
        hitRate: `${(hitRate * 100).toFixed(1)}%`,
        hits: this.metrics.cacheHitRate.hits,
        misses: this.metrics.cacheHitRate.misses
      });
    }
  }

  /**
   * Track AI API call performance
   * @param {number} duration - Duration in milliseconds
   * @param {boolean} success - Whether call succeeded
   */
  trackAICall(duration, success) {
    this.metrics.aiApiCalls.totalCalls++;
    this.metrics.aiApiCalls.totalDuration += duration;

    if (!success) {
      this.metrics.aiApiCalls.failures++;
    }

    if (duration > this.thresholds.ai_api_call) {
      log.warn('[Performance] Slow AI API call:', {
        duration: `${duration}ms`,
        threshold: `${this.thresholds.ai_api_call}ms`
      });
    }

    // Alert if failure rate exceeds 5%
    const failureRate = this.metrics.aiApiCalls.failures / this.metrics.aiApiCalls.totalCalls;
    if (this.metrics.aiApiCalls.totalCalls > 10 && failureRate > 0.05) {
      errorMonitoring.captureMessage(
        'High AI API failure rate detected',
        'warning',
        {
          totalCalls: this.metrics.aiApiCalls.totalCalls,
          failures: this.metrics.aiApiCalls.failures,
          failureRate: `${(failureRate * 100).toFixed(1)}%`
        }
      );
    }
  }

  /**
   * Get performance summary
   * @returns {Object} Performance metrics summary
   */
  getSummary() {
    const cacheHitRate = this.metrics.cacheHitRate.total > 0
      ? this.metrics.cacheHitRate.hits / this.metrics.cacheHitRate.total
      : 0;

    const avgAICallDuration = this.metrics.aiApiCalls.totalCalls > 0
      ? this.metrics.aiApiCalls.totalDuration / this.metrics.aiApiCalls.totalCalls
      : 0;

    return {
      apiEndpoints: Object.entries(this.metrics.apiEndpoints).map(([endpoint, metrics]) => ({
        endpoint,
        avgDuration: Math.round(metrics.avgDuration),
        count: metrics.count,
        failureRate: (metrics.failures / metrics.count * 100).toFixed(1) + '%',
        slowRequestRate: (metrics.slowRequests / metrics.count * 100).toFixed(1) + '%'
      })),

      databaseQueries: Object.entries(this.metrics.databaseQueries).map(([type, metrics]) => ({
        type,
        avgDuration: Math.round(metrics.avgDuration),
        count: metrics.count,
        slowQueryRate: (metrics.slowQueries / metrics.count * 100).toFixed(1) + '%'
      })),

      cache: {
        hitRate: `${(cacheHitRate * 100).toFixed(1)}%`,
        hits: this.metrics.cacheHitRate.hits,
        misses: this.metrics.cacheHitRate.misses,
        total: this.metrics.cacheHitRate.total
      },

      aiApiCalls: {
        totalCalls: this.metrics.aiApiCalls.totalCalls,
        avgDuration: Math.round(avgAICallDuration),
        failures: this.metrics.aiApiCalls.failures,
        failureRate: this.metrics.aiApiCalls.totalCalls > 0
          ? `${(this.metrics.aiApiCalls.failures / this.metrics.aiApiCalls.totalCalls * 100).toFixed(1)}%`
          : '0%'
      }
    };
  }

  /**
   * Express middleware to track request performance
   */
  middleware() {
    return (req, res, next) => {
      const startTime = Date.now();

      // Override res.json to capture response
      const originalJson = res.json;
      res.json = function(data) {
        const duration = Date.now() - startTime;
        const success = res.statusCode >= 200 && res.statusCode < 400;

        performanceMonitor.trackEndpoint(req.path, duration, success);

        return originalJson.call(this, data);
      };

      next();
    };
  }

  /**
   * Measure async operation performance
   * @param {string} operation - Operation name
   * @param {Function} fn - Async function to measure
   * @returns {Promise} Result of the function
   */
  async measure(operation, fn) {
    const startTime = Date.now();

    try {
      const result = await fn();
      const duration = Date.now() - startTime;

      log.info('[Performance]', {
        operation,
        duration: `${duration}ms`,
        success: true
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;

      log.error('[Performance]', {
        operation,
        duration: `${duration}ms`,
        success: false,
        error: error.message
      });

      throw error;
    }
  }
}

const performanceMonitor = new PerformanceMonitor();

module.exports = performanceMonitor;
