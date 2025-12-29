/**
 * Secrets API Routes
 *
 * Secure endpoints for managing encrypted secrets.
 * All routes require authentication and are rate-limited.
 *
 * Security measures:
 * - Authentication required for all operations
 * - Rate limiting on all endpoints
 * - Audit logging for all access
 * - Never returns decrypted values in list operations
 */

const express = require('express');
const { v4: uuidv4 } = require('uuid');
const secretsVault = require('../services/secretsVault');
const { SCOPES, ENVIRONMENTS, VALUE_TYPES } = require('../services/secretsVault');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

// Rate limiter configuration (secrets require stricter limits)
const RATE_LIMITS = {
  list: { windowMs: 60000, max: 30 },
  read: { windowMs: 60000, max: 20 },
  create: { windowMs: 60000, max: 10 },
  update: { windowMs: 60000, max: 10 },
  delete: { windowMs: 60000, max: 5 }
};

// Simple in-memory rate limiter for secrets (more restrictive than global)
const rateLimiters = new Map();

const secretsRateLimit = (action) => {
  return (req, res, next) => {
    const userId = req.user?.id || 'anonymous';
    const key = `${action}:${userId}`;
    const limit = RATE_LIMITS[action];
    const now = Date.now();

    let entry = rateLimiters.get(key);

    if (!entry || now - entry.windowStart > limit.windowMs) {
      entry = { windowStart: now, count: 0 };
    }

    entry.count++;
    rateLimiters.set(key, entry);

    if (entry.count > limit.max) {
      return res.status(429).json({
        error: 'Too Many Requests',
        message: `Rate limit exceeded for ${action} operations`,
        retryAfter: Math.ceil((entry.windowStart + limit.windowMs - now) / 1000)
      });
    }

    next();
  };
};

// Clean up rate limiter periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimiters.entries()) {
    if (now - entry.windowStart > 300000) { // 5 minutes
      rateLimiters.delete(key);
    }
  }
}, 60000);

/**
 * POST /api/secrets
 * Create a new secret
 *
 * Body:
 * - name: string (required) - Secret name (used as {{secrets.NAME}})
 * - value: string (required) - Secret value (will be encrypted)
 * - description: string (optional) - Description
 * - scope: string (optional) - user, organization, workflow
 * - environment: string (optional) - development, staging, production
 * - valueType: string (optional) - string, json, api_key, etc.
 * - workflowId: string (optional) - For workflow-scoped secrets
 * - organizationId: string (optional) - For org-scoped secrets
 * - expiresAt: string (optional) - ISO date for expiration
 */
router.post('/', authenticate, secretsRateLimit('create'), async (req, res) => {
  try {
    const {
      name,
      value,
      description,
      scope = SCOPES.USER,
      environment = ENVIRONMENTS.PRODUCTION,
      valueType = VALUE_TYPES.STRING,
      workflowId,
      organizationId,
      expiresAt
    } = req.body;

    // Validation
    if (!name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Secret name is required'
      });
    }

    if (!value) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Secret value is required'
      });
    }

    // Create secret
    const secret = await secretsVault.create({
      name,
      value,
      description,
      scope,
      environment,
      valueType,
      userId: req.user.id,
      organizationId,
      workflowId,
      expiresAt: expiresAt ? new Date(expiresAt) : null
    });

    // Log success (never log the value)
    console.log(`[Secrets API] Created secret: ${secret.name} by user ${req.user.id}`);

    res.status(201).json({
      success: true,
      secret: {
        id: secret.id,
        name: secret.name,
        description: secret.description,
        scope: secret.scope,
        environment: secret.environment,
        valueType: secret.value_type,
        reference: `{{secrets.${secret.name}}}`,
        createdAt: secret.created_at
      }
    });

  } catch (error) {
    console.error('[Secrets API] Create error:', error.message);

    if (error.message.includes('already exists')) {
      return res.status(409).json({
        error: 'Conflict',
        message: error.message
      });
    }

    if (error.message.includes('Invalid')) {
      return res.status(400).json({
        error: 'Validation Error',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to create secret'
    });
  }
});

/**
 * GET /api/secrets
 * List secrets (names only, not values)
 *
 * Query params:
 * - scope: string - Filter by scope
 * - environment: string - Filter by environment
 * - workflowId: string - Filter by workflow
 * - search: string - Search in name/description
 * - limit: number - Max results (default 100)
 * - offset: number - Pagination offset
 */
router.get('/', authenticate, secretsRateLimit('list'), async (req, res) => {
  try {
    const {
      scope,
      environment,
      workflowId,
      organizationId,
      search,
      limit = 100,
      offset = 0
    } = req.query;

    const result = await secretsVault.list(req.user.id, {
      scope,
      environment,
      workflowId,
      organizationId,
      search,
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      secrets: result.secrets.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        scope: s.scope,
        environment: s.environment,
        valueType: s.valueType,
        reference: `{{secrets.${s.name}}}`,
        workflowId: s.workflowId,
        expiresAt: s.expiresAt,
        isExpired: s.isExpired,
        lastAccessedAt: s.lastAccessedAt,
        accessCount: s.accessCount,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      })),
      total: result.total,
      scopes: Object.values(SCOPES),
      environments: Object.values(ENVIRONMENTS),
      valueTypes: Object.values(VALUE_TYPES)
    });

  } catch (error) {
    console.error('[Secrets API] List error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to list secrets'
    });
  }
});

/**
 * GET /api/secrets/:id
 * Get a secret (includes decrypted value)
 *
 * SECURITY NOTE: This endpoint returns the decrypted value.
 * It is rate-limited and fully audited.
 */
router.get('/:id', authenticate, secretsRateLimit('read'), async (req, res) => {
  try {
    const { id } = req.params;

    // Get request context for audit
    const context = {
      accessMethod: 'api',
      ipAddress: req.ip || req.connection?.remoteAddress,
      userAgent: req.get('User-Agent')
    };

    const secret = await secretsVault.get(id, req.user.id, context);

    res.json({
      success: true,
      secret: {
        id: secret.id,
        name: secret.name,
        description: secret.description,
        value: secret.value,
        scope: secret.scope,
        environment: secret.environment,
        valueType: secret.valueType,
        reference: `{{secrets.${secret.name}}}`,
        expiresAt: secret.expiresAt,
        lastAccessedAt: secret.lastAccessedAt,
        accessCount: secret.accessCount,
        createdAt: secret.createdAt
      }
    });

  } catch (error) {
    console.error('[Secrets API] Get error:', error.message);

    if (error.message === 'Secret not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Secret not found'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this secret'
      });
    }

    if (error.message === 'Secret has expired') {
      return res.status(410).json({
        error: 'Gone',
        message: 'Secret has expired'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve secret'
    });
  }
});

/**
 * PUT /api/secrets/:id
 * Update a secret
 *
 * Body:
 * - value: string (optional) - New secret value
 * - description: string (optional) - New description
 * - expiresAt: string (optional) - New expiration date
 */
router.put('/:id', authenticate, secretsRateLimit('update'), async (req, res) => {
  try {
    const { id } = req.params;
    const { value, description, expiresAt } = req.body;

    // At least one field must be provided
    if (value === undefined && description === undefined && expiresAt === undefined) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'At least one field must be provided for update'
      });
    }

    const updates = {};
    if (value !== undefined) updates.value = value;
    if (description !== undefined) updates.description = description;
    if (expiresAt !== undefined) updates.expiresAt = expiresAt ? new Date(expiresAt) : null;

    const secret = await secretsVault.update(id, updates, req.user.id);

    console.log(`[Secrets API] Updated secret: ${secret.name} by user ${req.user.id}`);

    res.json({
      success: true,
      secret: {
        id: secret.id,
        name: secret.name,
        description: secret.description,
        scope: secret.scope,
        environment: secret.environment,
        valueType: secret.value_type,
        reference: `{{secrets.${secret.name}}}`,
        expiresAt: secret.expires_at,
        updatedAt: secret.updated_at
      }
    });

  } catch (error) {
    console.error('[Secrets API] Update error:', error.message);

    if (error.message === 'Secret not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Secret not found'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this secret'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to update secret'
    });
  }
});

/**
 * DELETE /api/secrets/:id
 * Delete a secret (soft delete)
 */
router.delete('/:id', authenticate, secretsRateLimit('delete'), async (req, res) => {
  try {
    const { id } = req.params;

    await secretsVault.delete(id, req.user.id);

    console.log(`[Secrets API] Deleted secret: ${id} by user ${req.user.id}`);

    res.json({
      success: true,
      message: 'Secret deleted successfully'
    });

  } catch (error) {
    console.error('[Secrets API] Delete error:', error.message);

    if (error.message === 'Secret not found') {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Secret not found'
      });
    }

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this secret'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to delete secret'
    });
  }
});

/**
 * GET /api/secrets/:id/audit
 * Get audit log for a secret
 *
 * Query params:
 * - limit: number - Max results (default 50)
 * - offset: number - Pagination offset
 */
router.get('/:id/audit', authenticate, secretsRateLimit('list'), async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const result = await secretsVault.getAuditLog(id, req.user.id, {
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    res.json({
      success: true,
      logs: result.logs,
      total: result.total
    });

  } catch (error) {
    console.error('[Secrets API] Audit log error:', error.message);

    if (error.message === 'Access denied') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'You do not have access to this secret'
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to retrieve audit log'
    });
  }
});

/**
 * POST /api/secrets/validate
 * Validate a secret name format
 *
 * Body:
 * - name: string - Secret name to validate
 */
router.post('/validate', authenticate, async (req, res) => {
  try {
    const { name } = req.body;

    if (!name) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Name is required'
      });
    }

    const isValid = secretsVault.validateSecretName(name);
    const exists = await secretsVault.exists(name, req.user.id);

    res.json({
      success: true,
      valid: isValid,
      exists,
      reference: isValid ? `{{secrets.${name.toUpperCase()}}}` : null,
      message: !isValid
        ? 'Invalid name format. Use alphanumeric characters, underscores, and hyphens. Must start with a letter.'
        : exists
          ? 'A secret with this name already exists'
          : 'Name is valid and available'
    });

  } catch (error) {
    console.error('[Secrets API] Validate error:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to validate secret name'
    });
  }
});

/**
 * POST /api/secrets/resolve
 * Resolve secret expressions in a template (for testing)
 * WARNING: This returns decrypted values - use with caution
 *
 * Body:
 * - template: string - Template containing {{secrets.NAME}} expressions
 * - environment: string - Environment to resolve from
 */
router.post('/resolve', authenticate, secretsRateLimit('read'), async (req, res) => {
  try {
    const { template, environment = ENVIRONMENTS.PRODUCTION, workflowId } = req.body;

    if (!template) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Template is required'
      });
    }

    // Find secret references in template
    const secretPattern = /\{\{secrets\.([A-Z0-9_-]+)\}\}/gi;
    const matches = [...template.matchAll(secretPattern)];
    const secretNames = [...new Set(matches.map(m => m[1].toUpperCase()))];

    if (secretNames.length === 0) {
      return res.json({
        success: true,
        resolved: template,
        secretsFound: 0,
        secrets: []
      });
    }

    // Resolve secrets
    const resolved = await secretsVault.resolveSecrets(template, req.user.id, {
      environment,
      workflowId,
      context: {
        accessMethod: 'api',
        ipAddress: req.ip
      }
    });

    res.json({
      success: true,
      resolved,
      secretsFound: secretNames.length,
      secrets: secretNames
    });

  } catch (error) {
    console.error('[Secrets API] Resolve error:', error.message);

    if (error.message.includes('not found')) {
      return res.status(404).json({
        error: 'Not Found',
        message: error.message
      });
    }

    res.status(500).json({
      error: 'Internal Server Error',
      message: 'Failed to resolve secrets'
    });
  }
});

/**
 * GET /api/secrets/environments
 * Get available environments
 */
router.get('/meta/environments', authenticate, (req, res) => {
  res.json({
    success: true,
    environments: Object.values(ENVIRONMENTS).map(env => ({
      value: env,
      label: env.charAt(0).toUpperCase() + env.slice(1)
    }))
  });
});

/**
 * GET /api/secrets/scopes
 * Get available scopes
 */
router.get('/meta/scopes', authenticate, (req, res) => {
  res.json({
    success: true,
    scopes: Object.values(SCOPES).map(scope => ({
      value: scope,
      label: scope.charAt(0).toUpperCase() + scope.slice(1),
      description: scope === 'user'
        ? 'Private to you'
        : scope === 'organization'
          ? 'Shared with organization members'
          : 'Specific to a workflow'
    }))
  });
});

/**
 * GET /api/secrets/value-types
 * Get available value types
 */
router.get('/meta/value-types', authenticate, (req, res) => {
  res.json({
    success: true,
    valueTypes: Object.values(VALUE_TYPES).map(type => ({
      value: type,
      label: type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
    }))
  });
});

module.exports = router;
