const express = require('express');
const { z } = require('zod');
const { authenticate, authorizeOrgRole } = require('../middleware/auth');
const { supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');
const { getOrgIdForUser } = require('../utils/orgContext');

/**
 * Write one row to public.audit_log (the table that exists; the old code
 * wrote to a missing audit_logs table, so nothing was ever recorded).
 * The org comes from org_members, never from user-editable metadata
 * (audit finding 15).
 */
async function writeAudit({ orgId, userId, action, resourceType, resourceId, changed }) {
  try {
    const { error } = await supabaseAdmin.from('audit_log').insert({
      organization_id: orgId || null,
      user_id: userId || null,
      app_name: 'entomate',
      action,
      resource_type: resourceType,
      resource_id: resourceId || null,
      new_values: { changed: changed || [] },
    });
    if (error) log.warn('[Settings] Audit log failed:', error.message);
  } catch (auditErr) {
    log.warn('[Settings] Audit log failed:', auditErr.message);
  }
}

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

    await writeAudit({
      orgId: await getOrgIdForUser(userId),
      userId,
      action: 'settings.user.update',
      resourceType: 'user_settings',
      resourceId: userId,
      changed: Object.keys(req.body || {}),
    });

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

    await writeAudit({
      orgId: workspaceId,
      userId: req.user.id,
      action: 'settings.workspace.update',
      resourceType: 'workspace_settings',
      resourceId: workspaceId,
      changed: Object.keys(req.body || {}),
    });

    res.json({ success: true, settings: data });
  } catch (error) {
    log.error('[Settings] PUT /workspace error:', error.message);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ========================================
// MEETING AGENTS (Settings › Meeting agents)
// ========================================

const meetingAgentConfig = require('../services/meetingAgentConfig');
const ownerPreferences = require('../services/ownerPreferences');
const MEMBER_ROLES = ['owner', 'admin', 'manager', 'member', 'viewer'];

router.get('/owner-preferences', authenticate, authorizeOrgRole(MEMBER_ROLES, orgFromQuery), async (req, res) => {
  try {
    const { suggested, active } = await ownerPreferences.list(supabaseAdmin, req.orgId);
    res.json({ suggested, active });
  } catch (error) {
    log.error('[Owner preferences] List failed:', error.message);
    res.status(500).json({ error: 'Could not load Owner preferences.' });
  }
});

const ownerPreferenceDecision = z.object({
  scopeKey: z.string().regex(/^[0-9a-f]{64}$/),
  memberId: z.uuid(),
  decision: z.enum(['approve', 'dismiss', 'disable'])
});

router.patch('/owner-preferences', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  const input = ownerPreferenceDecision.safeParse(req.body);
  if (!input.success) return res.status(400).json({ error: 'Invalid Owner preference decision.' });
  try {
    const updated = await ownerPreferences.decide(supabaseAdmin, req.orgId, req.user.id, input.data);
    if (!updated) return res.status(409).json({ error: 'This preference changed. Refresh and try again.' });
    res.json({ success: true });
  } catch (error) {
    log.error('[Owner preferences] Decision failed:', error.message);
    res.status(500).json({ error: 'Could not update the Owner preference.' });
  }
});

/**
 * GET /api/settings/meeting-agents?workspaceId=<org-uuid>
 * Which meeting agents run on meeting end, and their confidence bars.
 * Any member can read; defaults are returned when nothing is saved.
 */
router.get('/meeting-agents', authenticate, authorizeOrgRole(MEMBER_ROLES, orgFromQuery), async (req, res) => {
  try {
    const settings = await meetingAgentConfig.load(req.orgId, supabaseAdmin);
    res.json({ success: true, settings, defaults: meetingAgentConfig.normalize() });
  } catch (error) {
    log.error('[Settings] GET /meeting-agents error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

/**
 * PUT /api/settings/meeting-agents
 * Body: { workspaceId, settings: { assignment?, priority?, deadline? } }
 * Owner/admin only. Values are normalised (confidence 50–95%).
 */
router.put('/meeting-agents', authenticate, authorizeOrgRole(ADMIN_ROLES, orgFromBody), async (req, res) => {
  try {
    const input = req.body?.settings;
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      return res.status(400).json({ success: false, error: 'invalid_settings' });
    }
    const settings = await meetingAgentConfig.save(req.orgId, input, supabaseAdmin);

    await writeAudit({
      orgId: req.orgId,
      userId: req.user.id,
      action: 'settings.meeting_agents.update',
      resourceType: 'tenant_organizations',
      resourceId: req.orgId,
      changed: Object.keys(input),
    });

    res.json({ success: true, settings });
  } catch (error) {
    log.error('[Settings] PUT /meeting-agents error:', error.message);
    res.status(500).json({ success: false, error: 'Internal server error' });
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
      .from('audit_log')
      .select('*')
      .eq('organization_id', workspaceId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return res.status(500).json({ error: 'Failed to fetch audit logs' });
    }

    // Keep the response shape the client has always been promised.
    const logs = (data || []).map((r) => ({
      id: r.id,
      workspace_id: r.organization_id,
      actor_user_id: r.user_id,
      action: r.action,
      entity_type: r.resource_type,
      entity_id: r.resource_id,
      metadata: r.new_values,
      created_at: r.created_at,
    }));
    res.json({ success: true, logs });
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
