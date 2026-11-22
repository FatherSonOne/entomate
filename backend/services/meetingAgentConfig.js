/**
 * Meeting agent settings (per workspace)
 *
 * The four meeting agents (owner/assignment, priority, deadline, follow-up)
 * are code in services/agents/. What a workspace can change is whether each
 * runs on meeting end and, for the two that change fields, how confident the
 * agent must be before its call is applied.
 *
 * Stored at tenant_organizations.settings.meeting_agents (no new table).
 * Settings › Meeting agents reads and writes it through
 * GET/PUT /api/settings/meeting-agents.
 *
 * The follow-up agent doesn't run on meeting end; it runs as the
 * "Detect follow-ups" step inside an automation, so it has no switch here.
 */

const log = require('../utils/log');

const AGENT_KEYS = ['assignment', 'priority', 'deadline'];

const DEFAULTS = Object.freeze({
  assignment: Object.freeze({ enabled: true, minConfidence: 0.7 }),
  priority: Object.freeze({ enabled: true, minConfidence: 0.75 }),
  deadline: Object.freeze({ enabled: true })
});

const MIN_CONFIDENCE = 0.5;
const MAX_CONFIDENCE = 0.95;

function clampConfidence(value, fallback) {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  // Accept 0–1 or 0–100.
  const v = n > 1 ? n / 100 : n;
  return Math.round(Math.min(MAX_CONFIDENCE, Math.max(MIN_CONFIDENCE, v)) * 100) / 100;
}

/**
 * Merge stored settings over the defaults. Pure; unknown keys are dropped.
 * @param {object} [stored]
 * @returns {{assignment:{enabled:boolean,minConfidence:number}, priority:{enabled:boolean,minConfidence:number}, deadline:{enabled:boolean}}}
 */
function normalize(stored) {
  const src = stored && typeof stored === 'object' ? stored : {};
  const out = {};
  for (const key of AGENT_KEYS) {
    const d = DEFAULTS[key];
    const s = src[key] && typeof src[key] === 'object' ? src[key] : {};
    out[key] = { enabled: typeof s.enabled === 'boolean' ? s.enabled : d.enabled };
    if ('minConfidence' in d) {
      out[key].minConfidence = clampConfidence(s.minConfidence, d.minConfidence);
    }
  }
  return out;
}

function db() {
  const { supabase, supabaseAdmin } = require('../config/supabase');
  return supabaseAdmin || supabase;
}

/** Load a workspace's settings. Never throws; returns defaults on any failure. */
async function load(orgId, client = null) {
  if (!orgId) return normalize();
  try {
    const { data, error } = await (client || db())
      .from('tenant_organizations')
      .select('settings')
      .eq('id', orgId)
      .maybeSingle();
    if (error) throw error;
    return normalize(data?.settings?.meeting_agents);
  } catch (error) {
    log.warn('[meetingAgentConfig] load failed, using defaults:', error.message);
    return normalize();
  }
}

/** Save a workspace's settings, keeping the rest of tenant_organizations.settings. */
async function save(orgId, value, client = null) {
  const c = client || db();
  const next = normalize(value);
  const { data: row, error: readError } = await c
    .from('tenant_organizations')
    .select('settings')
    .eq('id', orgId)
    .maybeSingle();
  if (readError) throw readError;
  if (!row) throw new Error('Workspace not found');

  const settings = { ...(row.settings || {}), meeting_agents: next };
  const { error } = await c
    .from('tenant_organizations')
    .update({ settings, updated_at: new Date().toISOString() })
    .eq('id', orgId);
  if (error) throw error;
  return next;
}

module.exports = { AGENT_KEYS, DEFAULTS, normalize, load, save, clampConfidence };
