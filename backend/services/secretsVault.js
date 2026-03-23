/**
 * SecretsVault Service
 *
 * Secure secrets management with AES-256-GCM encryption.
 * Provides CRUD operations for encrypted secrets with scoping,
 * audit logging, and workflow integration.
 *
 * Security features:
 * - AES-256-GCM encryption at rest
 * - Audit logging for all access
 * - Rate limiting (via middleware)
 * - Never logs secret values
 */

const crypto = require('crypto');
const { supabase, supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

// Encryption configuration
const ENCRYPTION_ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16; // 128 bits
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;
const KEY_LENGTH = 32; // 256 bits

// Secret scopes
const SCOPES = {
  USER: 'user',
  ORGANIZATION: 'organization',
  WORKFLOW: 'workflow'
};

// Environments
const ENVIRONMENTS = {
  DEVELOPMENT: 'development',
  STAGING: 'staging',
  PRODUCTION: 'production'
};

// Value types
const VALUE_TYPES = {
  STRING: 'string',
  JSON: 'json',
  CERTIFICATE: 'certificate',
  API_KEY: 'api_key',
  OAUTH_TOKEN: 'oauth_token'
};

class SecretsVault {
  constructor() {
    this.encryptionKey = null;
    this.initialized = false;
  }

  /**
   * Initialize the vault with encryption key
   * Key should be derived from environment or KMS
   */
  initialize() {
    const masterKey = process.env.SECRETS_MASTER_KEY;

    if (!masterKey) {
      log.warn('[SecretsVault] SECRETS_MASTER_KEY not set - using derived key (NOT FOR PRODUCTION)');
      // Derive a key from JWT_SECRET as fallback (for development only)
      const fallbackSource = process.env.JWT_SECRET || 'development-fallback-key';
      this.encryptionKey = crypto
        .createHash('sha256')
        .update(fallbackSource)
        .digest();
    } else {
      // Use provided master key (should be 32 bytes or hex-encoded 64 chars)
      if (masterKey.length === 64) {
        // Hex-encoded key
        this.encryptionKey = Buffer.from(masterKey, 'hex');
      } else if (masterKey.length === 32) {
        // Raw 32-byte key
        this.encryptionKey = Buffer.from(masterKey);
      } else {
        // Derive from provided key
        this.encryptionKey = crypto
          .createHash('sha256')
          .update(masterKey)
          .digest();
      }
    }

    if (this.encryptionKey.length !== KEY_LENGTH) {
      throw new Error('Invalid encryption key length');
    }

    this.initialized = true;
    log.info('[SecretsVault] Initialized with encryption');
  }

  /**
   * Encrypt a value using AES-256-GCM
   * @param {string} plaintext - Value to encrypt
   * @returns {string} Encrypted value in format: iv:authTag:ciphertext
   */
  encrypt(plaintext) {
    if (!this.initialized) {
      this.initialize();
    }

    // Generate random IV
    const iv = crypto.randomBytes(IV_LENGTH);

    // Create cipher
    const cipher = crypto.createCipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);

    // Encrypt
    let encrypted = cipher.update(plaintext, 'utf8', 'base64');
    encrypted += cipher.final('base64');

    // Get auth tag
    const authTag = cipher.getAuthTag();

    // Combine: iv:authTag:ciphertext (all base64)
    return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`;
  }

  /**
   * Decrypt a value using AES-256-GCM
   * @param {string} encryptedValue - Encrypted value in format: iv:authTag:ciphertext
   * @returns {string} Decrypted plaintext
   */
  decrypt(encryptedValue) {
    if (!this.initialized) {
      this.initialize();
    }

    // Parse components
    const parts = encryptedValue.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid encrypted value format');
    }

    const iv = Buffer.from(parts[0], 'base64');
    const authTag = Buffer.from(parts[1], 'base64');
    const ciphertext = parts[2];

    // Validate lengths
    if (iv.length !== IV_LENGTH) {
      throw new Error('Invalid IV length');
    }
    if (authTag.length !== AUTH_TAG_LENGTH) {
      throw new Error('Invalid auth tag length');
    }

    // Create decipher
    const decipher = crypto.createDecipheriv(ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
    decipher.setAuthTag(authTag);

    // Decrypt
    let decrypted = decipher.update(ciphertext, 'base64', 'utf8');
    decrypted += decipher.final('utf8');

    return decrypted;
  }

  /**
   * Validate secret name format
   * @param {string} name - Secret name to validate
   * @returns {boolean} Whether the name is valid
   */
  validateSecretName(name) {
    // Allow alphanumeric, underscores, hyphens, max 255 chars
    const pattern = /^[a-zA-Z][a-zA-Z0-9_-]{0,254}$/;
    return pattern.test(name);
  }

  /**
   * Create a new secret
   * @param {Object} params - Secret parameters
   * @param {string} params.name - Secret name (used in {{secrets.NAME}})
   * @param {string} params.value - Secret value (will be encrypted)
   * @param {string} params.description - Optional description
   * @param {string} params.scope - user, organization, or workflow
   * @param {string} params.environment - development, staging, or production
   * @param {string} params.valueType - string, json, api_key, etc.
   * @param {string} params.userId - Owner user ID
   * @param {string} params.organizationId - Organization ID (for org-scoped)
   * @param {string} params.workflowId - Workflow ID (for workflow-scoped)
   * @param {Date} params.expiresAt - Optional expiration date
   * @returns {Object} Created secret (without value)
   */
  async create({
    name,
    value,
    description = null,
    scope = SCOPES.USER,
    environment = ENVIRONMENTS.PRODUCTION,
    valueType = VALUE_TYPES.STRING,
    userId,
    organizationId = null,
    workflowId = null,
    expiresAt = null
  }) {
    // Validate inputs
    if (!name || !value) {
      throw new Error('Name and value are required');
    }

    if (!this.validateSecretName(name)) {
      throw new Error('Invalid secret name. Use alphanumeric characters, underscores, and hyphens. Must start with a letter.');
    }

    if (!userId) {
      throw new Error('User ID is required');
    }

    if (!Object.values(SCOPES).includes(scope)) {
      throw new Error(`Invalid scope. Must be one of: ${Object.values(SCOPES).join(', ')}`);
    }

    if (!Object.values(ENVIRONMENTS).includes(environment)) {
      throw new Error(`Invalid environment. Must be one of: ${Object.values(ENVIRONMENTS).join(', ')}`);
    }

    // Validate scope-specific requirements
    if (scope === SCOPES.ORGANIZATION && !organizationId) {
      throw new Error('Organization ID required for organization-scoped secrets');
    }
    if (scope === SCOPES.WORKFLOW && !workflowId) {
      throw new Error('Workflow ID required for workflow-scoped secrets');
    }

    // Encrypt the value
    const encryptedValue = this.encrypt(value);

    // Create secret record
    const secretData = {
      name: name.toUpperCase(), // Normalize to uppercase
      description,
      scope,
      environment,
      encrypted_value: encryptedValue,
      value_type: valueType,
      encryption_version: 1,
      user_id: userId,
      organization_id: organizationId,
      workflow_id: workflowId,
      expires_at: expiresAt
    };

    // Use admin client to bypass RLS for creation
    const client = supabaseAdmin || supabase;

    if (!client) {
      log.info('[SecretsVault] Database not configured, returning mock secret');
      return {
        id: crypto.randomUUID(),
        ...secretData,
        encrypted_value: '[ENCRYPTED]',
        created_at: new Date().toISOString(),
        access_count: 0
      };
    }

    const { data: secret, error } = await client
      .from('secrets')
      .insert(secretData)
      .select('id, name, description, scope, environment, value_type, user_id, organization_id, workflow_id, expires_at, created_at, access_count')
      .single();

    if (error) {
      if (error.code === '23505') {
        throw new Error(`Secret with name "${name}" already exists in this scope and environment`);
      }
      log.error('[SecretsVault] Create error:', { error: error.message || error });
      throw new Error(`Failed to create secret: ${error.message}`);
    }

    log.info(`[SecretsVault] Created secret: ${secret.name} (${secret.id})`);

    return secret;
  }

  /**
   * Get a secret by ID (includes decrypted value)
   * @param {string} secretId - Secret ID
   * @param {string} userId - Requesting user ID
   * @param {Object} context - Access context for audit
   * @returns {Object} Secret with decrypted value
   */
  async get(secretId, userId, context = {}) {
    const client = supabase;

    if (!client) {
      throw new Error('Database not configured');
    }

    const { data: secret, error } = await client
      .from('secrets')
      .select('*')
      .eq('id', secretId)
      .is('deleted_at', null)
      .single();

    if (error || !secret) {
      throw new Error('Secret not found');
    }

    // Check access permissions
    if (secret.user_id !== userId) {
      // Check organization-level access: if secret has an org_id and user belongs to same org
      let hasOrgAccess = false;
      if (secret.organization_id && context?.organizationId) {
        hasOrgAccess = secret.organization_id === context.organizationId &&
          (secret.scope === 'organization' || secret.scope === 'workflow');
      }
      if (!hasOrgAccess) {
        throw new Error('Access denied');
      }
    }

    // Check expiration
    if (secret.expires_at && new Date(secret.expires_at) < new Date()) {
      throw new Error('Secret has expired');
    }

    // Decrypt the value
    let decryptedValue;
    try {
      decryptedValue = this.decrypt(secret.encrypted_value);
    } catch (decryptError) {
      log.error('[SecretsVault] Decryption error:', decryptError.message);
      throw new Error('Failed to decrypt secret');
    }

    // Log access
    await this.logAccess(secretId, 'read', userId, context);

    // Update access stats
    await client
      .from('secrets')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: secret.access_count + 1
      })
      .eq('id', secretId);

    return {
      id: secret.id,
      name: secret.name,
      description: secret.description,
      value: decryptedValue,
      scope: secret.scope,
      environment: secret.environment,
      valueType: secret.value_type,
      expiresAt: secret.expires_at,
      createdAt: secret.created_at,
      lastAccessedAt: new Date().toISOString(),
      accessCount: secret.access_count + 1
    };
  }

  /**
   * Get a secret value by name (for workflow execution)
   * @param {string} name - Secret name
   * @param {string} userId - User ID
   * @param {Object} options - Lookup options
   * @returns {string} Decrypted value
   */
  async getValueByName(name, userId, options = {}) {
    const {
      scope = SCOPES.USER,
      environment = ENVIRONMENTS.PRODUCTION,
      workflowId = null,
      organizationId = null,
      context = {}
    } = options;

    const client = supabase;

    if (!client) {
      throw new Error('Database not configured');
    }

    // Build query based on scope
    let query = client
      .from('secrets')
      .select('*')
      .eq('name', name.toUpperCase())
      .eq('environment', environment)
      .is('deleted_at', null);

    // Apply scope-specific filters
    switch (scope) {
      case SCOPES.WORKFLOW:
        if (workflowId) {
          query = query.eq('workflow_id', workflowId);
        }
        break;
      case SCOPES.ORGANIZATION:
        if (organizationId) {
          query = query.eq('organization_id', organizationId);
        }
        break;
      case SCOPES.USER:
      default:
        query = query.eq('user_id', userId);
        break;
    }

    const { data: secret, error } = await query.single();

    if (error || !secret) {
      // Try fallback scopes
      if (scope === SCOPES.WORKFLOW) {
        return this.getValueByName(name, userId, { ...options, scope: SCOPES.USER });
      }
      throw new Error(`Secret "${name}" not found`);
    }

    // Check expiration
    if (secret.expires_at && new Date(secret.expires_at) < new Date()) {
      throw new Error(`Secret "${name}" has expired`);
    }

    // Decrypt
    const value = this.decrypt(secret.encrypted_value);

    // Log access
    await this.logAccess(secret.id, 'accessed', userId, {
      ...context,
      accessMethod: 'workflow'
    });

    // Update stats
    await client
      .from('secrets')
      .update({
        last_accessed_at: new Date().toISOString(),
        access_count: secret.access_count + 1
      })
      .eq('id', secret.id);

    return value;
  }

  /**
   * List secrets (without values)
   * @param {string} userId - User ID
   * @param {Object} options - Filter options
   * @returns {Array} List of secrets
   */
  async list(userId, options = {}) {
    const {
      scope = null,
      environment = null,
      workflowId = null,
      organizationId = null,
      limit = 100,
      offset = 0,
      search = null
    } = options;

    const client = supabase;

    if (!client) {
      return { secrets: [], total: 0 };
    }

    let query = client
      .from('secrets')
      .select('id, name, description, scope, environment, value_type, user_id, organization_id, workflow_id, expires_at, last_accessed_at, access_count, created_at, updated_at', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('name', { ascending: true });

    // Apply filters
    if (scope) {
      query = query.eq('scope', scope);
    }
    if (environment) {
      query = query.eq('environment', environment);
    }
    if (workflowId) {
      query = query.eq('workflow_id', workflowId);
    }
    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }
    if (search) {
      query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
    }

    // Pagination
    query = query.range(offset, offset + limit - 1);

    const { data: secrets, error, count } = await query;

    if (error) {
      log.error('[SecretsVault] List error:', { error: error.message || error });
      throw new Error('Failed to list secrets');
    }

    return {
      secrets: secrets.map(s => ({
        id: s.id,
        name: s.name,
        description: s.description,
        scope: s.scope,
        environment: s.environment,
        valueType: s.value_type,
        workflowId: s.workflow_id,
        organizationId: s.organization_id,
        expiresAt: s.expires_at,
        lastAccessedAt: s.last_accessed_at,
        accessCount: s.access_count,
        createdAt: s.created_at,
        updatedAt: s.updated_at,
        isExpired: s.expires_at ? new Date(s.expires_at) < new Date() : false
      })),
      total: count || 0
    };
  }

  /**
   * Update a secret
   * @param {string} secretId - Secret ID
   * @param {Object} updates - Fields to update
   * @param {string} userId - User ID
   * @returns {Object} Updated secret
   */
  async update(secretId, updates, userId) {
    const { value, description, expiresAt } = updates;

    const client = supabase;

    if (!client) {
      throw new Error('Database not configured');
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await client
      .from('secrets')
      .select('id, user_id, name')
      .eq('id', secretId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new Error('Secret not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('Access denied');
    }

    // Build update object
    const updateData = {
      updated_at: new Date().toISOString()
    };

    if (description !== undefined) {
      updateData.description = description;
    }

    if (expiresAt !== undefined) {
      updateData.expires_at = expiresAt;
    }

    // If value is being updated, encrypt it
    if (value !== undefined) {
      updateData.encrypted_value = this.encrypt(value);
    }

    const { data: secret, error } = await client
      .from('secrets')
      .update(updateData)
      .eq('id', secretId)
      .select('id, name, description, scope, environment, value_type, expires_at, updated_at')
      .single();

    if (error) {
      log.error('[SecretsVault] Update error:', { error: error.message || error });
      throw new Error('Failed to update secret');
    }

    log.info(`[SecretsVault] Updated secret: ${existing.name} (${secretId})`);

    return secret;
  }

  /**
   * Delete a secret (soft delete)
   * @param {string} secretId - Secret ID
   * @param {string} userId - User ID
   * @returns {boolean} Success
   */
  async delete(secretId, userId) {
    const client = supabase;

    if (!client) {
      throw new Error('Database not configured');
    }

    // Verify ownership
    const { data: existing, error: fetchError } = await client
      .from('secrets')
      .select('id, user_id, name')
      .eq('id', secretId)
      .is('deleted_at', null)
      .single();

    if (fetchError || !existing) {
      throw new Error('Secret not found');
    }

    if (existing.user_id !== userId) {
      throw new Error('Access denied');
    }

    // Soft delete
    const { error } = await client
      .from('secrets')
      .update({
        deleted_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', secretId);

    if (error) {
      log.error('[SecretsVault] Delete error:', { error: error.message || error });
      throw new Error('Failed to delete secret');
    }

    // Log deletion
    await this.logAccess(secretId, 'deleted', userId, { accessMethod: 'api' });

    log.info(`[SecretsVault] Deleted secret: ${existing.name} (${secretId})`);

    return true;
  }

  /**
   * Resolve secret expressions in a string
   * Replaces {{secrets.NAME}} with actual values
   * @param {string} template - String containing secret expressions
   * @param {string} userId - User ID
   * @param {Object} options - Resolution options
   * @returns {string} String with resolved secrets
   */
  async resolveSecrets(template, userId, options = {}) {
    if (!template || typeof template !== 'string') {
      return template;
    }

    // Find all secret references
    const secretPattern = /\{\{secrets\.([A-Z0-9_-]+)\}\}/gi;
    const matches = [...template.matchAll(secretPattern)];

    if (matches.length === 0) {
      return template;
    }

    let resolved = template;

    for (const match of matches) {
      const fullMatch = match[0];
      const secretName = match[1].toUpperCase();

      try {
        const value = await this.getValueByName(secretName, userId, options);
        resolved = resolved.replace(fullMatch, value);
      } catch (error) {
        log.warn(`[SecretsVault] Failed to resolve secret "${secretName}": ${error.message}`);
        // Leave placeholder or throw based on options
        if (options.throwOnMissing) {
          throw new Error(`Secret "${secretName}" not found or inaccessible`);
        }
        // Leave the placeholder as-is
      }
    }

    return resolved;
  }

  /**
   * Resolve secrets in an object recursively
   * @param {Object} obj - Object containing secret expressions
   * @param {string} userId - User ID
   * @param {Object} options - Resolution options
   * @returns {Object} Object with resolved secrets
   */
  async resolveSecretsInObject(obj, userId, options = {}) {
    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj === 'string') {
      return this.resolveSecrets(obj, userId, options);
    }

    if (Array.isArray(obj)) {
      return Promise.all(obj.map(item => this.resolveSecretsInObject(item, userId, options)));
    }

    if (typeof obj === 'object') {
      const resolved = {};
      for (const [key, value] of Object.entries(obj)) {
        resolved[key] = await this.resolveSecretsInObject(value, userId, options);
      }
      return resolved;
    }

    return obj;
  }

  /**
   * Log secret access for audit
   * @param {string} secretId - Secret ID
   * @param {string} action - Action performed
   * @param {string} userId - User ID
   * @param {Object} context - Additional context
   */
  async logAccess(secretId, action, userId, context = {}) {
    const client = supabaseAdmin || supabase;

    if (!client) {
      return;
    }

    try {
      // Get secret name (don't include in regular logs)
      const { data: secret } = await client
        .from('secrets')
        .select('name')
        .eq('id', secretId)
        .single();

      // Get user email
      const { data: user } = await client
        .from('users')
        .select('email')
        .eq('id', userId)
        .single();

      await client.from('secrets_audit_log').insert({
        secret_id: secretId,
        secret_name: secret?.name || 'unknown',
        action,
        user_id: userId,
        user_email: user?.email || null,
        access_method: context.accessMethod || 'api',
        workflow_id: context.workflowId || null,
        workflow_execution_id: context.executionId || null,
        ip_address: context.ipAddress || null,
        user_agent: context.userAgent || null,
        metadata: {
          environment: context.environment,
          scope: context.scope
        }
      });
    } catch (error) {
      // Don't fail the main operation if audit logging fails
      log.error('[SecretsVault] Audit log error:', error.message);
    }
  }

  /**
   * Get audit log for a secret
   * @param {string} secretId - Secret ID
   * @param {string} userId - User ID
   * @param {Object} options - Query options
   * @returns {Array} Audit log entries
   */
  async getAuditLog(secretId, userId, options = {}) {
    const { limit = 50, offset = 0 } = options;

    const client = supabase;

    if (!client) {
      return { logs: [], total: 0 };
    }

    // Verify ownership first
    const { data: secret } = await client
      .from('secrets')
      .select('user_id')
      .eq('id', secretId)
      .single();

    if (!secret || secret.user_id !== userId) {
      throw new Error('Access denied');
    }

    const { data: logs, error, count } = await client
      .from('secrets_audit_log')
      .select('*', { count: 'exact' })
      .eq('secret_id', secretId)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error('Failed to fetch audit log');
    }

    return {
      logs: logs.map(log => ({
        id: log.id,
        action: log.action,
        userId: log.user_id,
        userEmail: log.user_email,
        accessMethod: log.access_method,
        workflowId: log.workflow_id,
        timestamp: log.created_at
      })),
      total: count || 0
    };
  }

  /**
   * Check if a secret exists
   * @param {string} name - Secret name
   * @param {string} userId - User ID
   * @param {Object} options - Lookup options
   * @returns {boolean} Whether the secret exists
   */
  async exists(name, userId, options = {}) {
    const { environment = ENVIRONMENTS.PRODUCTION } = options;

    const client = supabase;

    if (!client) {
      return false;
    }

    const { data, error } = await client
      .from('secrets')
      .select('id')
      .eq('name', name.toUpperCase())
      .eq('user_id', userId)
      .eq('environment', environment)
      .is('deleted_at', null)
      .single();

    return !error && !!data;
  }
}

// Export singleton instance
const secretsVault = new SecretsVault();

// Initialize on module load
secretsVault.initialize();

module.exports = secretsVault;
module.exports.SecretsVault = SecretsVault;
module.exports.SCOPES = SCOPES;
module.exports.ENVIRONMENTS = ENVIRONMENTS;
module.exports.VALUE_TYPES = VALUE_TYPES;
