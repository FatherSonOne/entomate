/**
 * SecretsVault Service Tests
 *
 * Tests encryption/decryption logic, name validation, and scope checking.
 * Mocks Supabase but tests real crypto operations.
 */

// Mock supabase before requiring the module
jest.mock('../config/supabase', () => ({
  supabase: null,
  supabaseAdmin: null
}));

const crypto = require('crypto');

// We need a fresh instance for each test to control initialization
const { SecretsVault, SCOPES, ENVIRONMENTS, VALUE_TYPES } = require('../services/secretsVault');

describe('SecretsVault', () => {
  let vault;

  beforeEach(() => {
    vault = new SecretsVault();
    // Set a deterministic key for testing
    process.env.SECRETS_MASTER_KEY = crypto.randomBytes(32).toString('hex');
    vault.initialize();
  });

  afterEach(() => {
    delete process.env.SECRETS_MASTER_KEY;
  });

  describe('initialize()', () => {
    it('should initialize with a 64-char hex master key', () => {
      const v = new SecretsVault();
      process.env.SECRETS_MASTER_KEY = 'a'.repeat(64);
      v.initialize();
      expect(v.initialized).toBe(true);
    });

    it('should initialize with a 32-byte raw master key', () => {
      const v = new SecretsVault();
      process.env.SECRETS_MASTER_KEY = 'a'.repeat(32);
      v.initialize();
      expect(v.initialized).toBe(true);
    });

    it('should derive key from arbitrary-length master key', () => {
      const v = new SecretsVault();
      process.env.SECRETS_MASTER_KEY = 'short-key';
      v.initialize();
      expect(v.initialized).toBe(true);
    });

    it('should fall back to JWT_SECRET when no master key set', () => {
      const v = new SecretsVault();
      delete process.env.SECRETS_MASTER_KEY;
      process.env.JWT_SECRET = 'test-jwt-secret';
      v.initialize();
      expect(v.initialized).toBe(true);
      delete process.env.JWT_SECRET;
    });

    it('should fall back to development key when nothing is set', () => {
      const v = new SecretsVault();
      delete process.env.SECRETS_MASTER_KEY;
      delete process.env.JWT_SECRET;
      v.initialize();
      expect(v.initialized).toBe(true);
    });
  });

  describe('encrypt() / decrypt() round-trip', () => {
    it('should encrypt and decrypt a simple string', () => {
      const plaintext = 'my-secret-api-key-12345';
      const encrypted = vault.encrypt(plaintext);
      const decrypted = vault.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt an empty string', () => {
      const plaintext = '';
      const encrypted = vault.encrypt(plaintext);
      const decrypted = vault.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should encrypt and decrypt JSON content', () => {
      const plaintext = JSON.stringify({ token: 'abc123', refresh: 'xyz789' });
      const encrypted = vault.encrypt(plaintext);
      const decrypted = vault.decrypt(encrypted);
      expect(JSON.parse(decrypted)).toEqual({ token: 'abc123', refresh: 'xyz789' });
    });

    it('should encrypt and decrypt unicode content', () => {
      const plaintext = 'secret with unicode: \u00e9\u00e0\u00fc \u2603 \ud83d\udd11';
      const encrypted = vault.encrypt(plaintext);
      const decrypted = vault.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it('should produce different ciphertexts for the same plaintext (random IV)', () => {
      const plaintext = 'same-secret-value';
      const encrypted1 = vault.encrypt(plaintext);
      const encrypted2 = vault.encrypt(plaintext);
      expect(encrypted1).not.toBe(encrypted2);
      // Both should decrypt to the same value
      expect(vault.decrypt(encrypted1)).toBe(plaintext);
      expect(vault.decrypt(encrypted2)).toBe(plaintext);
    });

    it('should produce encrypted output in iv:authTag:ciphertext format', () => {
      const encrypted = vault.encrypt('test');
      const parts = encrypted.split(':');
      expect(parts).toHaveLength(3);
      // Each part should be valid base64
      parts.forEach(part => {
        expect(() => Buffer.from(part, 'base64')).not.toThrow();
      });
    });
  });

  describe('decrypt() error handling', () => {
    it('should throw on invalid format (missing parts)', () => {
      expect(() => vault.decrypt('invalid')).toThrow('Invalid encrypted value format');
      expect(() => vault.decrypt('part1:part2')).toThrow('Invalid encrypted value format');
    });

    it('should throw on tampered ciphertext', () => {
      const encrypted = vault.encrypt('secret');
      const parts = encrypted.split(':');
      // Tamper with the ciphertext
      parts[2] = Buffer.from('tampered-data').toString('base64');
      expect(() => vault.decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on tampered auth tag', () => {
      const encrypted = vault.encrypt('secret');
      const parts = encrypted.split(':');
      // Replace auth tag with random bytes of correct length
      parts[1] = crypto.randomBytes(16).toString('base64');
      expect(() => vault.decrypt(parts.join(':'))).toThrow();
    });

    it('should throw on wrong key', () => {
      const encrypted = vault.encrypt('secret');
      // Re-initialize with a different key
      process.env.SECRETS_MASTER_KEY = crypto.randomBytes(32).toString('hex');
      vault.initialize();
      expect(() => vault.decrypt(encrypted)).toThrow();
    });
  });

  describe('validateSecretName()', () => {
    it('should accept valid names', () => {
      expect(vault.validateSecretName('MY_API_KEY')).toBe(true);
      expect(vault.validateSecretName('slack-token')).toBe(true);
      expect(vault.validateSecretName('ApiKey123')).toBe(true);
      expect(vault.validateSecretName('a')).toBe(true);
    });

    it('should reject names starting with a number', () => {
      expect(vault.validateSecretName('123_KEY')).toBe(false);
    });

    it('should reject names starting with underscore', () => {
      expect(vault.validateSecretName('_KEY')).toBe(false);
    });

    it('should reject names starting with hyphen', () => {
      expect(vault.validateSecretName('-KEY')).toBe(false);
    });

    it('should reject empty strings', () => {
      expect(vault.validateSecretName('')).toBe(false);
    });

    it('should reject names with special characters', () => {
      expect(vault.validateSecretName('MY.KEY')).toBe(false);
      expect(vault.validateSecretName('MY KEY')).toBe(false);
      expect(vault.validateSecretName('MY@KEY')).toBe(false);
    });

    it('should reject names exceeding 255 characters', () => {
      const longName = 'A' + 'B'.repeat(255);
      expect(vault.validateSecretName(longName)).toBe(false);
    });

    it('should accept names up to 255 characters', () => {
      const maxName = 'A' + 'B'.repeat(254);
      expect(vault.validateSecretName(maxName)).toBe(true);
    });
  });

  describe('create() validation', () => {
    const baseParams = {
      name: 'TEST_SECRET',
      value: 'secret-value',
      userId: 'user-123'
    };

    it('should throw when name is missing', async () => {
      await expect(vault.create({ ...baseParams, name: '' }))
        .rejects.toThrow('Name and value are required');
    });

    it('should throw when value is missing', async () => {
      await expect(vault.create({ ...baseParams, value: '' }))
        .rejects.toThrow('Name and value are required');
    });

    it('should throw when userId is missing', async () => {
      await expect(vault.create({ ...baseParams, userId: '' }))
        .rejects.toThrow('User ID is required');
    });

    it('should throw on invalid secret name', async () => {
      await expect(vault.create({ ...baseParams, name: '123_BAD' }))
        .rejects.toThrow('Invalid secret name');
    });

    it('should throw on invalid scope', async () => {
      await expect(vault.create({ ...baseParams, scope: 'invalid' }))
        .rejects.toThrow('Invalid scope');
    });

    it('should throw on invalid environment', async () => {
      await expect(vault.create({ ...baseParams, environment: 'invalid' }))
        .rejects.toThrow('Invalid environment');
    });

    it('should throw when organization scope used without organizationId', async () => {
      await expect(vault.create({ ...baseParams, scope: SCOPES.ORGANIZATION }))
        .rejects.toThrow('Organization ID required');
    });

    it('should throw when workflow scope used without workflowId', async () => {
      await expect(vault.create({ ...baseParams, scope: SCOPES.WORKFLOW }))
        .rejects.toThrow('Workflow ID required');
    });

    it('should return mock secret when database not configured', async () => {
      const result = await vault.create(baseParams);
      expect(result).toHaveProperty('id');
      expect(result.name).toBe('TEST_SECRET');
      expect(result.encrypted_value).toBe('[ENCRYPTED]');
      expect(result.scope).toBe('user');
    });
  });

  describe('constants', () => {
    it('should export valid SCOPES', () => {
      expect(SCOPES).toEqual({
        USER: 'user',
        ORGANIZATION: 'organization',
        WORKFLOW: 'workflow'
      });
    });

    it('should export valid ENVIRONMENTS', () => {
      expect(ENVIRONMENTS).toEqual({
        DEVELOPMENT: 'development',
        STAGING: 'staging',
        PRODUCTION: 'production'
      });
    });

    it('should export valid VALUE_TYPES', () => {
      expect(VALUE_TYPES).toHaveProperty('STRING', 'string');
      expect(VALUE_TYPES).toHaveProperty('JSON', 'json');
      expect(VALUE_TYPES).toHaveProperty('API_KEY', 'api_key');
    });
  });
});
