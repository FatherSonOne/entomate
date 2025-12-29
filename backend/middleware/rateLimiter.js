/**
 * Rate Limiter Middleware
 * Prevents abuse by limiting request rates
 */

// Simple in-memory store (use Redis in production)
const requestCounts = new Map();

/**
 * Clean up old entries periodically
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of requestCounts.entries()) {
    if (now - data.windowStart > 60000) {
      requestCounts.delete(key);
    }
  }
}, 60000);

/**
 * Rate Limiter Factory
 * @param {Object} options - Configuration options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when rate limited
 * @param {Function} options.keyGenerator - Function to generate rate limit key
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60000, // 1 minute
    max = 100, // 100 requests per minute
    message = 'Too many requests, please try again later',
    keyGenerator = (req) => req.ip || req.headers['x-forwarded-for'] || 'anonymous'
  } = options;

  return (req, res, next) => {
    const key = keyGenerator(req);
    const now = Date.now();

    // Get or create request data
    let data = requestCounts.get(key);

    if (!data || now - data.windowStart > windowMs) {
      data = {
        count: 0,
        windowStart: now
      };
    }

    data.count++;
    requestCounts.set(key, data);

    // Set rate limit headers
    res.setHeader('X-RateLimit-Limit', max);
    res.setHeader('X-RateLimit-Remaining', Math.max(0, max - data.count));
    res.setHeader('X-RateLimit-Reset', new Date(data.windowStart + windowMs).toISOString());

    if (data.count > max) {
      return res.status(429).json({
        success: false,
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfter: Math.ceil((data.windowStart + windowMs - now) / 1000)
        }
      });
    }

    next();
  };
};

/**
 * Pre-configured rate limiters
 */

// General API rate limit
const apiLimiter = rateLimiter({
  windowMs: 60000,
  max: 100,
  message: 'Too many API requests'
});

// Stricter limit for authentication endpoints
const authLimiter = rateLimiter({
  windowMs: 900000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts, please try again later'
});

// Limit for AI/processing endpoints (expensive operations)
const aiLimiter = rateLimiter({
  windowMs: 60000,
  max: 10,
  message: 'Too many AI processing requests, please wait'
});

// Per-user rate limiter
const userLimiter = rateLimiter({
  windowMs: 60000,
  max: 50,
  keyGenerator: (req) => req.user?.id || req.ip
});

module.exports = {
  rateLimiter,
  apiLimiter,
  authLimiter,
  aiLimiter,
  userLimiter
};
