const { createClient } = require('@supabase/supabase-js');
const log = require('../utils/log');

// Initialize Supabase admin client for server-side auth verification
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

/**
 * Authentication Middleware
 * Verifies Supabase JWT access token
 */
const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header'
      });
    }

    const token = authHeader.split(' ')[1];

    // Verify the JWT and get user from Supabase
    const { data: { user }, error } = await supabase.auth.getUser(token);

    if (error || !user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.email || null,
      firstName: user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || null,
      lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
      role: user.user_metadata?.role || 'member',
      teamId: user.user_metadata?.team_id || 'default',
      avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
    };

    next();
  } catch (error) {
    log.error('Authentication error:', error.message);
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid or expired token'
    });
  }
};

/**
 * Optional Authentication
 * Allows requests without auth but attaches user if present
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = { id: 'anonymous', email: null, role: 'guest', teamId: 'default' };
      return next();
    }

    const token = authHeader.split(' ')[1];

    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        req.user = { id: 'anonymous', email: null, role: 'guest', teamId: 'default' };
        return next();
      }

      req.user = {
        id: user.id,
        email: user.email || null,
        firstName: user.user_metadata?.full_name?.split(' ')[0] || user.user_metadata?.name?.split(' ')[0] || null,
        lastName: user.user_metadata?.full_name?.split(' ').slice(1).join(' ') || null,
        role: user.user_metadata?.role || 'member',
        teamId: user.user_metadata?.team_id || 'default',
        avatar_url: user.user_metadata?.avatar_url || user.user_metadata?.picture || null
      };
    } catch (error) {
      // Token invalid or expired, treat as anonymous
      log.debug('Optional auth failed:', error.message);
      req.user = { id: 'anonymous', email: null, role: 'guest', teamId: 'default' };
    }

    next();
  } catch (error) {
    req.user = { id: 'anonymous', email: null, role: 'guest', teamId: 'default' };
    next();
  }
};

/**
 * Role-based Authorization
 * @param {string[]} allowedRoles - Array of allowed roles
 */
const authorize = (allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Insufficient permissions'
      });
    }

    next();
  };
};

/**
 * Team Access Check
 * Ensures user can only access their team's resources
 */
const teamAccess = async (req, res, next) => {
  try {
    const resourceTeamId = req.params.teamId || req.body.teamId || req.query.teamId;

    if (!resourceTeamId) {
      return next();
    }

    if (req.user.role === 'admin') {
      return next();
    }

    if (req.user.teamId !== resourceTeamId) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied to this team resource'
      });
    }

    next();
  } catch (error) {
    return res.status(500).json({
      error: 'Authorization check failed',
      message: error.message
    });
  }
};

/**
 * API Key Authentication
 * For service-to-service communication
 */
const apiKeyAuth = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  const validApiKey = process.env.INTERNAL_API_KEY;

  if (!validApiKey) {
    return next();
  }

  if (!apiKey || apiKey !== validApiKey) {
    return res.status(401).json({
      error: 'Unauthorized',
      message: 'Invalid API key'
    });
  }

  req.isServiceRequest = true;
  next();
};

module.exports = {
  authenticate,
  optionalAuth,
  authorize,
  teamAccess,
  apiKeyAuth
};
