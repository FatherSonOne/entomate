/**
 * Rate Limiter Middleware (audit finding 4)
 *
 * Each limiter has its own counter (express-rate-limit memory store), so a
 * page that makes many ordinary API calls no longer uses up the small AI
 * allowance. A limiter applied twice to one request (e.g. app-level
 * apiLimiter plus a route-level apiLimiter) counts the request once.
 * Signed-in requests are counted per user; others per client IP.
 */
const { rateLimit } = require('express-rate-limit');

const keyByUserOrIp = (req) =>
  (req.user?.id && req.user.id !== 'anonymous' ? `user:${req.user.id}` : `ip:${req.ip}`);

/**
 * Rate Limiter Factory
 * @param {Object} options
 * @param {number} [options.windowMs=60000] - Time window in milliseconds
 * @param {number} [options.max=100] - Maximum requests per window
 * @param {string} [options.message] - Error message when rate limited
 * @param {Function} [options.keyGenerator] - Function to generate rate limit key
 */
const rateLimiter = (options = {}) => {
  const {
    windowMs = 60000,
    max = 100,
    message = 'Too many requests, please try again later',
    keyGenerator = keyByUserOrIp,
  } = options;

  const mark = Symbol('rateLimited');

  const limiter = rateLimit({
    windowMs,
    limit: max,
    keyGenerator,
    standardHeaders: 'draft-7',
    legacyHeaders: true,
    // Keys are prefixed strings (user:/ip:), so skip the IP-format checks.
    validate: false,
    handler: (req, res, _next, opts) => {
      const resetTime = req.rateLimit?.resetTime;
      const retryAfter = resetTime
        ? Math.max(1, Math.ceil((resetTime.getTime() - Date.now()) / 1000))
        : Math.ceil(windowMs / 1000);
      res.status(opts.statusCode).json({
        success: false,
        error: { message, code: 'RATE_LIMIT_EXCEEDED', retryAfter },
      });
    },
  });

  return (req, res, next) => {
    if (req[mark]) return next(); // already counted by this limiter
    req[mark] = true;
    return limiter(req, res, next);
  };
};

// General API rate limit
const apiLimiter = rateLimiter({ windowMs: 60000, max: 100, message: 'Too many API requests' });

// Stricter limit for authentication endpoints
const authLimiter = rateLimiter({
  windowMs: 900000, // 15 minutes
  max: 10,
  message: 'Too many authentication attempts, please try again later',
  keyGenerator: (req) => `ip:${req.ip}`,
});

// Limit for AI/processing endpoints (expensive operations)
const aiLimiter = rateLimiter({ windowMs: 60000, max: 10, message: 'Too many AI processing requests, please wait' });

// Per-user rate limiter
const userLimiter = rateLimiter({ windowMs: 60000, max: 50 });

module.exports = {
  rateLimiter,
  apiLimiter,
  authLimiter,
  aiLimiter,
  userLimiter,
};
