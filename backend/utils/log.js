/**
 * Thin logging wrapper
 *
 * Re-exports the Winston logger from services/logger.js
 * for convenient import across the backend codebase.
 *
 * Usage:
 *   const log = require('../utils/log');
 *   log.info('Something happened');
 *   log.warn('Watch out');
 *   log.error('Something failed', { context: 'details' });
 *   log.debug('Debug info');
 */

const logger = require('../services/logger');

module.exports = logger;
