/**
 * Authorize Platform Admin middleware.
 *
 * Gates cross-workspace privileged operations (currently: GDPR deletion
 * fulfillment endpoints) by checking membership in the public.platform_admins
 * table. Source of truth is the table — bootstrap the first admin row by
 * SQL insert from a service-role context (no UI for this).
 *
 * Must run after `authenticate` so req.user is populated.
 */

'use strict';

const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

async function authorizePlatformAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.id || req.user.id === 'anonymous') {
      return res.status(401).json({
        error: 'Unauthorized',
        message: 'Authentication required'
      });
    }

    if (!supabaseAdmin) {
      return res.status(500).json({
        error: 'platform_admin_check_unavailable',
        message: 'Service-role client not configured'
      });
    }

    const { data, error } = await supabaseAdmin
      .from('platform_admins')
      .select('user_id')
      .eq('user_id', req.user.id)
      .maybeSingle();

    if (error) {
      log.error('platform_admins lookup failed', { error: error.message });
      return res.status(500).json({
        error: 'platform_admin_check_failed',
        message: error.message
      });
    }

    if (!data) {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Platform admin role required'
      });
    }

    req.isPlatformAdmin = true;
    next();
  } catch (err) {
    log.error('authorizePlatformAdmin error', { error: err.message });
    return res.status(500).json({
      error: 'platform_admin_check_failed',
      message: err.message
    });
  }
}

module.exports = { authorizePlatformAdmin };
