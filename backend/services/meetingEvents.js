/**
 * Meeting Events
 *
 * Runs once a meeting has been processed and its action items saved
 * (called from firePostProcessing in routes/meetings.js). Two steps:
 *
 *   1. Agents — Priority, Deadline and (for unassigned items) Assignment
 *      agents review every action item. Their
 *      suggestions are applied conservatively (see decideUpdates). What each
 *      agent recommended, why, and whether it was applied is saved to
 *      action_items.agent_notes and shown under the item ("Why").
 *   2. Workflow triggers — active workflows in the meeting's org that start
 *      with a `meeting_processed` or `action_item_created` trigger are run.
 *
 * Which agents run, and how confident they must be, is set per workspace in
 * Settings › Meeting agents (services/meetingAgentConfig.js).
 *
 * Safety:
 *   - Workflow triggers are ON by default (they are how Automations run after
 *     a meeting). Expressions are evaluated by a small interpreter, not
 *     eval (a50f04d). Set MEETING_WORKFLOW_TRIGGERS_ENABLED=false to stop them.
 *   - Workflows containing a Code node are never auto-fired.
 *   - Only workflows switched on (active = true) fire.
 *   - Workflow lookup is scoped to the meeting's org_id; meetings without an
 *     org_id fire nothing.
 *   - Assignment picks only from the meeting's org (agents/orgTeam.js) and
 *     only fills items nobody owns yet.
 *   - Nothing here throws; failures are logged and the pipeline continues.
 */

const log = require('../utils/log');

const PRIORITIES = ['high', 'medium', 'low'];

const DEFAULTS = {
  priorityMinConfidence: 0.75,
  assignMinConfidence: 0.7,
  maxActionItems: 25,   // matches the orchestrator's maxActionsPerRun guardrail
  maxWorkflows: 10
};

function flagEnabled(name, defaultValue) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') return defaultValue;
  return raw === 'true';
}

/**
 * Decide which agent suggestions to write back to an action item.
 * Pure function: no I/O.
 *
 *  - due_date: filled only when the item has none and the agent proposed a
 *    new date (never overwrites a date someone set or the meeting stated).
 *  - priority: changed only when the agent is confident enough and the
 *    value is valid and different.
 *  - owner: filled only when nobody owns the item, the agent is confident
 *    enough, and the person matched a member of the org's team.
 */
function decideUpdates(item, suggestions = {}, opts = {}) {
  const minConfidence = opts.priorityMinConfidence ?? DEFAULTS.priorityMinConfidence;
  const updates = {};

  const deadline = suggestions.deadline;
  if (
    !item.due_date &&
    deadline?.recommended &&
    !deadline.isExisting &&
    /^\d{4}-\d{2}-\d{2}/.test(String(deadline.recommended))
  ) {
    updates.due_date = String(deadline.recommended).slice(0, 10);
  }

  const priority = suggestions.priority;
  const recommended = typeof priority?.recommended === 'string'
    ? priority.recommended.toLowerCase()
    : null;
  if (
    recommended &&
    PRIORITIES.includes(recommended) &&
    recommended !== item.priority &&
    typeof priority.confidence === 'number' &&
    priority.confidence >= minConfidence
  ) {
    updates.priority = recommended;
  }

  const assignment = suggestions.assignment;
  const member = assignment?.recommendedMember;
  const assignMin = opts.assignMinConfidence ?? DEFAULTS.assignMinConfidence;
  if (
    !item.assigned_to_name &&
    !item.assigned_to_email &&
    !item.assigned_to_id &&
    member?.name &&
    typeof assignment.confidence === 'number' &&
    assignment.confidence >= assignMin
  ) {
    updates.assigned_to_name = member.name;
    if (member.email) updates.assigned_to_email = member.email;
    if (member.user_id) updates.assigned_to_id = member.user_id;
  }

  return updates;
}

/**
 * What each agent recommended and why, for action_items.agent_notes.
 * Pure function. A deadline the meeting already stated is left out: the
 * agent only echoed it back.
 */
function buildAgentNotes(suggestions = {}, updates = {}, now = new Date()) {
  const note = (s, field, value) => s && {
    recommended: value ?? null,
    reason: typeof s.reason === 'string' ? s.reason.slice(0, 500) : null,
    confidence: typeof s.confidence === 'number' ? Math.round(s.confidence * 100) / 100 : null,
    applied: field in updates
  };

  const notes = {};
  if (suggestions.priority?.recommended) {
    notes.priority = note(suggestions.priority, 'priority', String(suggestions.priority.recommended).toLowerCase());
  }
  if (suggestions.deadline?.recommended && !suggestions.deadline.isExisting) {
    notes.deadline = note(suggestions.deadline, 'due_date', String(suggestions.deadline.recommended).slice(0, 10));
  }
  if (suggestions.assignment && (suggestions.assignment.recommendedMember?.name || suggestions.assignment.reason)) {
    notes.assignment = note(suggestions.assignment, 'assigned_to_name', suggestions.assignment.recommendedMember?.name || null);
  }
  if (Object.keys(notes).length === 0) return null;
  return { reviewed_at: now.toISOString(), ...notes };
}

/** True if a workflow contains a node of the given trigger subtype. */
function hasTrigger(workflow, subtype) {
  return Array.isArray(workflow?.nodes) &&
    workflow.nodes.some(n => n?.type === 'trigger' && n?.subtype === subtype);
}

/** True if a workflow contains a Code node (runs user JS, not sandboxed). */
function hasCodeNode(workflow) {
  return Array.isArray(workflow?.nodes) &&
    workflow.nodes.some(n => n?.subtype === 'code');
}

class MeetingEvents {
  /**
   * @param {object} deps - injectable for tests
   * @param {object} [deps.db] - supabase client
   * @param {object} [deps.orchestrator] - agentOrchestrator
   * @param {object} [deps.executor] - WorkflowExecutor instance
   */
  constructor(deps = {}) {
    this._deps = deps;
  }

  get db() {
    if (!this._deps.db) {
      const { supabase, supabaseAdmin } = require('../config/supabase');
      this._deps.db = supabaseAdmin || supabase;
    }
    return this._deps.db;
  }

  get orchestrator() {
    if (!this._deps.orchestrator) {
      this._deps.orchestrator = require('./agentOrchestrator');
    }
    return this._deps.orchestrator;
  }

  get agentConfig() {
    if (!this._deps.agentConfig) {
      this._deps.agentConfig = require('./meetingAgentConfig');
    }
    return this._deps.agentConfig;
  }

  get executor() {
    if (!this._deps.executor) {
      const WorkflowExecutor = require('./workflow/WorkflowExecutor');
      this._deps.executor = new WorkflowExecutor();
    }
    return this._deps.executor;
  }

  /**
   * Entry point. Never throws.
   * @returns {Promise<{agents: object, workflows: object}>}
   */
  async handleMeetingProcessed(meeting, actionItems = []) {
    const summary = { agents: { skipped: true }, workflows: { skipped: true } };
    if (!meeting?.id) return summary;

    let items = Array.isArray(actionItems) ? actionItems : [];

    if (flagEnabled('MEETING_AGENTS_ENABLED', true)) {
      try {
        const result = await this.runAgents(meeting, items);
        summary.agents = result.summary;
        items = result.items;
      } catch (error) {
        log.warn('[MeetingEvents] Agent step failed (non-blocking):', error.message);
        summary.agents = { error: error.message };
      }
    }

    if (flagEnabled('MEETING_WORKFLOW_TRIGGERS_ENABLED', true)) {
      try {
        summary.workflows = await this.fireWorkflowTriggers(meeting, items);
      } catch (error) {
        log.warn('[MeetingEvents] Workflow trigger step failed (non-blocking):', error.message);
        summary.workflows = { error: error.message };
      }
    }

    return summary;
  }

  /**
   * Run Priority + Deadline agents over the action items and apply
   * the suggestions decideUpdates allows.
   */
  async runAgents(meeting, actionItems) {
    const items = actionItems.slice(0, DEFAULTS.maxActionItems);
    if (items.length === 0) {
      return { items: actionItems, summary: { reviewed: 0, updated: 0 } };
    }

    const config = await this.agentConfig.load(meeting.org_id || null, this._deps.db || null);
    const agents = {
      assignment: config.assignment.enabled,
      priority: config.priority.enabled,
      deadline: config.deadline.enabled
    };
    if (!agents.assignment && !agents.priority && !agents.deadline) {
      return { items: actionItems, summary: { reviewed: 0, updated: 0, disabled: true } };
    }
    const thresholds = {
      priorityMinConfidence: config.priority.minConfidence,
      assignMinConfidence: config.assignment.minConfidence
    };

    const result = await this.orchestrator.processMeetingWithAgents(meeting, items, {
      agents,
      assignMinConfidence: thresholds.assignMinConfidence
    });
    const byId = new Map((result?.actionItems || []).map(r => [r.id, r.suggestions || {}]));

    let updated = 0;
    const merged = [];
    for (const item of actionItems) {
      const suggestions = byId.get(item.id);
      const updates = suggestions ? decideUpdates(item, suggestions, thresholds) : {};
      const notes = suggestions ? buildAgentNotes(suggestions, updates) : null;
      if ((Object.keys(updates).length === 0 && !notes) || !this.db) {
        merged.push(item);
        continue;
      }

      const write = async (fields) => {
        let query = this.db
          .from('action_items')
          .update({ ...fields, updated_at: new Date().toISOString() })
          .eq('id', item.id);
        if (item.org_id) query = query.eq('org_id', item.org_id);
        return query;
      };

      let { error } = await write(notes ? { ...updates, agent_notes: notes } : updates);
      // Before the agent_notes migration runs, still apply the changes themselves.
      if (error && notes && /agent_notes/.test(error.message || '') && Object.keys(updates).length > 0) {
        ({ error } = await write(updates));
      }
      if (error) {
        log.warn(`[MeetingEvents] Could not apply agent suggestions to ${item.id}:`, error.message);
        merged.push(item);
      } else {
        if (Object.keys(updates).length > 0) updated++;
        merged.push({ ...item, ...updates });
      }
    }

    log.info(`[MeetingEvents] Agents reviewed ${items.length} action item(s), updated ${updated} for meeting ${meeting.id}`);
    return { items: merged, summary: { reviewed: items.length, updated } };
  }

  /** Active workflows in the org that start with the given trigger, minus unsafe ones. */
  async findWorkflows(orgId, subtype) {
    if (!orgId || !this.db) return [];

    const { data, error } = await this.db
      .from('workflows')
      .select('*')
      .eq('org_id', orgId)
      .eq('active', true);

    if (error) {
      log.warn('[MeetingEvents] Workflow lookup failed:', error.message);
      return [];
    }

    const matching = (data || []).filter(w => hasTrigger(w, subtype));
    const safe = matching.filter(w => {
      if (hasCodeNode(w)) {
        log.warn(`[MeetingEvents] Not auto-firing workflow ${w.id} ("${w.name}"): contains a Code node`);
        return false;
      }
      return true;
    });

    return safe.slice(0, DEFAULTS.maxWorkflows);
  }

  async _run(workflow, inputData, triggeredBy) {
    try {
      const result = await this.executor.execute(workflow, inputData, { triggeredBy });
      return Boolean(result?.success ?? true);
    } catch (error) {
      log.warn(`[MeetingEvents] Workflow ${workflow.id} failed:`, error.message);
      return false;
    }
  }

  /** Fire meeting_processed and action_item_created workflows for this meeting. */
  async fireWorkflowTriggers(meeting, actionItems) {
    const orgId = meeting.org_id;
    if (!orgId) {
      log.warn(`[MeetingEvents] Meeting ${meeting.id} has no org_id; not firing workflows`);
      return { fired: 0, failed: 0 };
    }

    let fired = 0;
    let failed = 0;
    const tally = ok => { ok ? fired++ : failed++; };

    const meetingPayload = {
      id: meeting.id,
      org_id: orgId,
      meeting_id: meeting.id,
      title: meeting.title,
      transcript: meeting.transcript,
      summary: meeting.summary,
      attendees: meeting.attendees || [],
      action_items: actionItems
    };

    for (const workflow of await this.findWorkflows(orgId, 'meeting_processed')) {
      tally(await this._run(workflow, meetingPayload, 'meeting_processed'));
    }

    const itemWorkflows = await this.findWorkflows(orgId, 'action_item_created');
    if (itemWorkflows.length > 0) {
      for (const item of actionItems.slice(0, DEFAULTS.maxActionItems)) {
        const itemPayload = { ...item, org_id: item.org_id || orgId, meeting_id: meeting.id, meeting_title: meeting.title };
        for (const workflow of itemWorkflows) {
          tally(await this._run(workflow, itemPayload, 'action_item_created'));
        }
      }
    }

    log.info(`[MeetingEvents] Workflows for meeting ${meeting.id}: ${fired} fired, ${failed} failed`);
    return { fired, failed };
  }
}

const meetingEvents = new MeetingEvents();

module.exports = meetingEvents;
module.exports.MeetingEvents = MeetingEvents;
module.exports.decideUpdates = decideUpdates;
module.exports.buildAgentNotes = buildAgentNotes;
module.exports.hasTrigger = hasTrigger;
module.exports.hasCodeNode = hasCodeNode;
