const express = require('express');
const { authenticate, authorizeOrgRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

const router = express.Router();

const ADMIN_ROLES = ['owner', 'admin'];
const orgFromBody = (req) => req.body?.workspaceId || null;
const orgFromQuery = (req) => req.query?.workspaceId || null;

// P1.7 Slices 3+4 — workspace data_controls_json validation.
//   retention_days: 30 / 90 / 365 (Slice 3)
//   consent_jurisdiction: 'permissive' / 'two_party' / 'gdpr' (Slice 4)
// Allow null to mean "use the default" downstream. Anything else in the
// blob is allowed through unchanged so adjacent settings can ride along.
const ALLOWED_RETENTION_DAYS = [30, 90, 365];
const ALLOWED_JURISDICTIONS = ['permissive', 'two_party', 'gdpr'];

function validateDataControls(blob) {
  if (blob === undefined || blob === null) return { ok: true };
  if (typeof blob !== 'object' || Array.isArray(blob)) {
    return { ok: false, error: 'data_controls_json must be an object' };
  }
  if (Object.prototype.hasOwnProperty.call(blob, 'retention_days')) {
    const v = blob.retention_days;
    if (v !== null && !ALLOWED_RETENTION_DAYS.includes(Number(v))) {
      return {
        ok: false,
        error: `retention_days must be one of ${ALLOWED_RETENTION_DAYS.join(', ')} (got ${v})`
      };
    }
  }
  if (Object.prototype.hasOwnProperty.call(blob, 'consent_jurisdiction')) {
    const v = blob.consent_jurisdiction;
    if (v !== null && !ALLOWED_JURISDICTIONS.includes(v)) {
      return {
        ok: false,
        error: `consent_jurisdiction must be one of ${ALLOWED_JURISDICTIONS.join(', ')} (got ${v})`
      };
    }
  }
  return { ok: true };
}

// ========================================
// USER SETTINGS
// ========================================

/**
 * GET /api/settings/user
 * Fetch current user's settings (creates default row if missing)
 */
router.get('/user', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    let { data, error } = await supabaseAdmin
      .from('user_settings')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error && error.code === 'PGRST116') {
      // Row not found — create defaults
      const { data: created, error: createError } = await supabaseAdmin
        .from('user_settings')
        .insert({ user_id: userId })
        .select()
        .single();

      if (createError) {
        log.error('[Settings] Failed to create user settings:', createError.message);
        return res.status(500).json({ error: 'Failed to create settings' });
      }
      data = created;
    } else if (error) {
      log.error('[Settings] Failed to fetch user settings:', error.message);
      return res.status(500).json({ error: 'Failed to fetch settings' });
    }

    res.json({ success: true, settings: data });
  } catch (error) {
    log.error('[Settings] GET /user error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/settings/user
 * Update current user's settings (partial update via COALESCE)
 */
router.put('/user', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;
    const {
      theme_mode,
      accent_mode,
      accent_color,
      reduce_motion,
      notifications_json,
      meetings_json,
      ai_json
    } = req.body || {};

    // Build update object — only include fields that were sent
    const updates = { updated_at: new Date().toISOString() };
    if (theme_mode !== undefined) updates.theme_mode = theme_mode;
    if (accent_mode !== undefined) updates.accent_mode = accent_mode;
    if (accent_color !== undefined) updates.accent_color = accent_color;
    if (reduce_motion !== undefined) updates.reduce_motion = reduce_motion;
    if (notifications_json !== undefined) updates.notifications_json = notifications_json;
    if (meetings_json !== undefined) updates.meetings_json = meetings_json;
    if (ai_json !== undefined) updates.ai_json = ai_json;

    // Upsert: create row if it doesn't exist yet
    const { data, error } = await supabaseAdmin
      .from('user_settings')
      .upsert({ user_id: userId, ...updates }, { onConflict: 'user_id' })
      .select()
      .single();

    if (error) {
      log.error('[Settings] Failed to update user settings:', error.message);
      return res.status(500).json({ error: 'Failed to update settings' });
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        workspace_id: req.user.teamId || 'default',
        actor_user_id: userId,
        action: 'settings.user.update',
        entity_type: 'user_settings',
        entity_id: userId,
        metadata: { changed: Object.keys(req.body || {}) }
      });
    } catch (auditErr) {
      log.warn('[Settings] Audit log failed:', auditErr.message);
    }

    res.json({ success: true, settings: data });
  } catch (error) {
    log.error('[Settings] PUT /user error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// WORKSPACE SETTINGS (admin only)
// ========================================

/**
 * GET /api/settings/workspace?workspaceId=<org-uuid>
 * Caller must be owner/admin of the workspace.
 */
router.get('/workspace', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromQuery), async (req, res) => {
  try {
    const workspaceId = req.orgId;

    let { data, error } = await supabaseAdmin
      .from('workspace_settings')
      .select('*')
      .eq('workspace_id', workspaceId)
      .single();

    if (error && error.code === 'PGRST116') {
      const { data: created, error: createError } = await supabaseAdmin
        .from('workspace_settings')
        .insert({ workspace_id: workspaceId })
        .select()
        .single();

      if (createError) {
        return res.status(500).json({ error: 'Failed to create workspace settings' });
      }
      data = created;
    } else if (error) {
      return res.status(500).json({ error: 'Failed to fetch workspace settings' });
    }

    res.json({ success: true, settings: data });
  } catch (error) {
    log.error('[Settings] GET /workspace error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * PUT /api/settings/workspace
 * Body: { workspaceId, integrations_json?, security_json?, data_controls_json? }
 * Caller must be owner/admin of the workspace.
 */
router.put('/workspace', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  try {
    const workspaceId = req.orgId;
    const { integrations_json, security_json, data_controls_json } = req.body || {};

    const validation = validateDataControls(data_controls_json);
    if (!validation.ok) {
      return res.status(400).json({ error: 'invalid_settings', message: validation.error });
    }

    const updates = { updated_at: new Date().toISOString() };
    if (integrations_json !== undefined) updates.integrations_json = integrations_json;
    if (security_json !== undefined) updates.security_json = security_json;
    if (data_controls_json !== undefined) updates.data_controls_json = data_controls_json;

    const { data, error } = await supabaseAdmin
      .from('workspace_settings')
      .upsert({ workspace_id: workspaceId, ...updates }, { onConflict: 'workspace_id' })
      .select()
      .single();

    if (error) {
      return res.status(500).json({ error: 'Failed to update workspace settings' });
    }

    // Audit log
    try {
      await supabaseAdmin.from('audit_logs').insert({
        workspace_id: workspaceId,
        actor_user_id: req.user.id,
        action: 'settings.workspace.update',
        entity_type: 'workspace_settings',
        entity_id: workspaceId,
        metadata: { changed: Object.keys(req.body || {}) }
      });
    } catch (auditErr) {
      log.warn('[Settings] Audit log failed:', auditErr.message);
    }

    res.json({ success: true, settings: data });
  } catch (error) {
    log.error('[Settings] PUT /workspace error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// AUDIT LOGS (admin only)
// ========================================

/**
 * GET /api/settings/audit-logs?workspaceId=<org-uuid>&limit=<n>
 * Caller must be owner/admin of the workspace.
 */
router.get('/audit-logs', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromQuery), async (req, res) => {
  try {
    const workspaceId = req.orgId;
    const limit = Math.min(Number(req.query.limit) || 100, 500);

    const { data, error } = await supabaseAdmin
      .from('audit_logs')
      .select('*')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }

    res.json({ success: true, logs: data || [] });
  } catch (error) {
    log.error('[Settings] GET /audit-logs error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
module.exports._internal = {
  validateDataControls,
  ALLOWED_RETENTION_DAYS,
  ALLOWED_JURISDICTIONS
};
