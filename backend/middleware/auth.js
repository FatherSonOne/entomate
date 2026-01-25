const { verifyToken } = require('@clerk/clerk-sdk-node');
const { createClerkClient } = require('@clerk/clerk-sdk-node');

// Initialize Clerk client for user lookups
const clerkClient = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY
});

/**
 * Authentication Middleware
 * Verifies JWT token from Clerk
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

    // Verify the JWT token with Clerk
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY
    });

    if (!payload || !payload.sub) {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Invalid or expired token'
      });
    }

    const userId = payload.sub;
    const sessionId = payload.sid;

    // Get user details from Clerk
    const user = await clerkClient.users.getUser(userId);

    // Attach user to request object
    req.user = {
      id: user.id,
      email: user.emailAddresses[0]?.emailAddress || null,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.publicMetadata?.role || 'member',
      teamId: user.publicMetadata?.team_id || 'default',
      sessionId: sessionId
    };

    next();
  } catch (error) {
    console.error('Authentication error:', error.message);
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
      const payload = await verifyToken(token, {
        secretKey: process.env.CLERK_SECRET_KEY
      });

      if (!payload || !payload.sub) {
        req.user = { id: 'anonymous', email: null, role: 'guest', teamId: 'default' };
        return next();
      }

      const userId = payload.sub;
      const sessionId = payload.sid;

      // Get user details from Clerk
      const user = await clerkClient.users.getUser(userId);

      req.user = {
        id: user.id,
        email: user.emailAddresses[0]?.emailAddress || null,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.publicMetadata?.role || 'member',
        teamId: user.publicMetadata?.team_id || 'default',
        sessionId: sessionId
      };
    } catch (error) {
      // Token invalid or expired, treat as anonymous
      console.debug('Optional auth failed:', error.message);
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
