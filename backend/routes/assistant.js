/**
 * Assistant Routes
 * Context-aware AI assistant endpoint with SSE streaming
 */

const express = require('express');
const { supabase, createUserClient } = require('../config/supabase');
const ai = require('../config/ai');
const log = require('../utils/log');
const askService = require('../services/askService');
const { authenticate } = require('../middleware/auth');
const { aiLimiter } = require('../middleware/rateLimiter');
const { getOrgIdsForUser } = require('../utils/orgContext');

const router = express.Router();

// ── Section data loaders ───────────────────────────────
// Each loader fetches the data relevant to a specific app section.
// Every query is limited to the caller: org-owned tables by org_id, the rest
// (no org_id column yet) by owner. Audit finding 3.
// `db` is the caller's user-JWT client (EAI-01 / D2): every org table reads
// through it, so RLS is the perimeter and the org_id filter is a second fence.
// projects and agents rely on the org SELECT policies from migration
// 20261122000012 (EAI-01b). calendar_events has no table yet.

const sectionLoaders = {
  async dashboard({ orgIds, db }) {
    const [tasks, meetings, projects] = await Promise.allSettled([
      db.from('tasks').select('id, title, description, status, priority, due_date, assigned_to, project_id')
        .in('org_id', orgIds).order('due_date', { ascending: true }).limit(20),
      db.from('meetings').select('id, title, summary, created_at, sentiment_label')
        .in('org_id', orgIds).order('created_at', { ascending: false }).limit(10),
      db.from('projects').select('id, name, status, start_date, end_date, deal_value')
        .in('org_id', orgIds).eq('status', 'active').limit(10),
    ]);
    return {
      tasks: tasks.status === 'fulfilled' ? tasks.value?.data || [] : [],
      meetings: meetings.status === 'fulfilled' ? meetings.value?.data || [] : [],
      projects: projects.status === 'fulfilled' ? projects.value?.data || [] : [],
    };
  },

  async meetings({ orgIds, db }) {
    const { data } = await db.from('meetings')
      .select('id, title, summary, key_points, decisions, created_at, sentiment_label, transcript')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }).limit(15);
    // Truncate transcripts to save tokens
    return { meetings: (data || []).map(m => ({ ...m, transcript: m.transcript?.substring(0, 500) })) };
  },

  async calendar({ userId }) {
    try {
      const { data } = await supabase.from('calendar_events')
        .select('id, title, start_time, end_time, location, description')
        .eq('user_id', userId)
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true }).limit(20);
      return { events: data || [] };
    } catch { return { events: [] }; }
  },

  async projects({ orgIds, db }) {
    const { data } = await db.from('projects')
      .select('id, name, description, status, start_date, end_date, deal_value, created_at')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }).limit(15);
    return { projects: data || [] };
  },

  async tasks({ orgIds, db }) {
    const { data } = await db.from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, project_id, created_at')
      .in('org_id', orgIds)
      .order('due_date', { ascending: true }).limit(25);
    return { tasks: data || [] };
  },


  // Automations and workflows are one module on the workflow engine.
  async workflows(ctx) { return sectionLoaders.automations(ctx); },

  async automations({ orgIds, db }) {
    const { data } = await db.from('workflows')
      .select('id, name, description, active, nodes, last_executed_at, execution_count, created_at')
      .in('org_id', orgIds)
      .eq('is_template', false)
      .order('created_at', { ascending: false }).limit(15);
    const automations = (data || []).map(w => ({
      id: w.id, name: w.name, description: w.description, enabled: !!w.active,
      trigger_type: Array.isArray(w.nodes) ? (w.nodes.find(n => n?.type === 'trigger')?.subtype || null) : null,
      last_run_at: w.last_executed_at, runs: w.execution_count || 0,
    }));
    return { automations };
  },

  async agents({ orgIds, db }) {
    const { data } = await db.from('agents')
      .select('id, name, type, description, enabled, last_execution_at, created_at')
      .in('org_id', orgIds)
      .order('created_at', { ascending: false }).limit(15);
    return { agents: data || [] };
  },

  async analytics({ orgIds, db }) {
    // Aggregate metrics
    const [tasks, meetings, projects] = await Promise.allSettled([
      db.from('tasks').select('status', { count: 'exact' }).in('org_id', orgIds),
      db.from('meetings').select('id', { count: 'exact' }).in('org_id', orgIds),
      db.from('projects').select('status', { count: 'exact' }).in('org_id', orgIds),
    ]);
    return {
      metrics: {
        totalTasks: tasks.status === 'fulfilled' ? tasks.value?.count || 0 : 0,
        totalMeetings: meetings.status === 'fulfilled' ? meetings.value?.count || 0 : 0,
        totalProjects: projects.status === 'fulfilled' ? projects.value?.count || 0 : 0,
      }
    };
  },
};

// Fallback loader for sections without specific data
async function loadSectionData(section, userId, db) {
  const loader = sectionLoaders[section];
  if (!loader) return {};
  try {
    const orgIds = await getOrgIdsForUser(userId);
    return await loader({ orgIds, userId, db });
  } catch (err) {
    log.warn(`[Assistant] Failed to load ${section} data:`, err.message);
    return {};
  }
}

// ── Build the system prompt ────────────────────────────
function buildSystemPrompt(section, sectionLabel, userName, contextBlocks) {
  const now = new Date().toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const hasData = contextBlocks.trim().length > 0;

  return `You are Entomate AI, an intelligent assistant embedded in Entomate — a meeting intelligence and project automation platform.

Current section: ${sectionLabel}
User: ${userName || 'User'}
Date: ${now}

You can help with meetings (transcripts, summaries, action items, decisions), projects and tasks, automations, AI agents, insights and the calendar. That list is for you: never recite it, and never describe Entomate's features unless the user asks what something does.

${hasData
    ? `IMPORTANT: You have access to REAL, LIVE data from the user's ${sectionLabel} section below. You MUST reference specific items by their ACTUAL names, dates, and statuses from this data. Never make up or generalize — always cite real items.`
    : `There is no data in ${sectionLabel} yet. If the question needs data, say so in one sentence and give the one or two steps that would get some there. Do not pad the answer with what ${sectionLabel} could do.`
  }

How to answer (this is a narrow side panel, so short wins):
- Start with the answer itself. No preamble such as "As Entomate AI" or "Great question".
- Keep it under about 120 words unless the user asks for more detail.
- Use **bold** for names, amounts and dates, and bullets only for three or more items.
- Use numbered lists for steps.
- Plain, direct language. No marketing words such as "comprehensive", "streamline", "seamless" or "powerful".

${hasData ? `\n--- LIVE DATA ---\n${contextBlocks}\n--- END DATA ---` : ''}`;
}

// ── Serialize section data into context blocks ─────────
function buildContextBlocks(data) {
  if (!data || Object.keys(data).length === 0) return '';
  const blocks = [];

  if (data.tasks?.length) {
    const slim = data.tasks.slice(0, 20).map(t => ({
      id: t.id, title: t.title || t.description, status: t.status,
      priority: t.priority, dueDate: t.due_date, assignedTo: t.assigned_to,
    }));
    blocks.push(`[Tasks (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.meetings?.length) {
    const slim = data.meetings.slice(0, 15).map(m => ({
      id: m.id, title: m.title, date: m.created_at,
      summary: m.summary?.slice(0, 200),
      keyPoints: m.key_points, decisions: m.decisions,
      sentiment: m.sentiment_label,
    }));
    blocks.push(`[Meetings (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.projects?.length) {
    const slim = data.projects.slice(0, 15).map(p => ({
      id: p.id, name: p.name, status: p.status,
      dealValue: p.deal_value,
      startDate: p.start_date, endDate: p.end_date,
    }));
    blocks.push(`[Projects (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.events?.length) {
    const slim = data.events.slice(0, 15).map(e => ({
      title: e.title, start: e.start_time, end: e.end_time, location: e.location,
    }));
    blocks.push(`[Calendar Events (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.workflows?.length) {
    const slim = data.workflows.slice(0, 10).map(w => ({
      id: w.id, name: w.name, status: w.status, enabled: w.enabled, lastRun: w.last_run_at,
    }));
    blocks.push(`[Workflows (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.automations?.length) {
    const slim = data.automations.slice(0, 10).map(a => ({
      id: a.id, name: a.name, enabled: a.enabled, trigger: a.trigger_type, lastRun: a.last_run_at,
    }));
    blocks.push(`[Automations (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.agents?.length) {
    const slim = data.agents.slice(0, 10).map(a => ({
      id: a.id, name: a.name, type: a.type, enabled: a.enabled, lastExec: a.last_execution_at,
    }));
    blocks.push(`[AI Agents (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
  }
  if (data.metrics) {
    blocks.push(`[Metrics]\n${JSON.stringify(data.metrics, null, 1)}`);
  }

  return blocks.join('\n\n');
}

// ── Section label mapping ──────────────────────────────
const SECTION_LABELS = {
  dashboard: 'Dashboard',
  meetings: 'Meetings',
  calendar: 'Calendar',
  search: 'Search',
  projects: 'Projects',
  'project-dashboard': 'Project Board',
  tasks: 'Tasks',
  workflows: 'Workflows',
  automations: 'Automations',
  agents: 'AI Agents',
  analytics: 'Analytics',
  reports: 'Reports',
  settings: 'Settings',
  guide: 'User Guide',
  assistant: 'AI conversations',
};

// ═══════════════════════════════════════════════════════
// ROUTES
// ═══════════════════════════════════════════════════════

/**
 * POST /api/assistant/query
 * Context-aware AI assistant query with SSE streaming
 *
 * Body: { question, section, conversationId? }
 */
router.post('/query', authenticate, aiLimiter, async (req, res) => {
  try {
    const { question, section = 'dashboard', conversationId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    // authenticate guarantees a verified Bearer token on this header.
    const db = createUserClient(req.headers.authorization.split(' ')[1]);
    if (!db) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.email || 'User';
    const sectionLabel = SECTION_LABELS[section] || 'Dashboard';

    // 1. Load section-specific data from database
    log.info(`[Assistant] Query in ${sectionLabel}: "${question.substring(0, 80)}"`);
    const sectionData = await loadSectionData(section, userId, db);

    // 2. Build context and system prompt
    const contextBlocks = buildContextBlocks(sectionData);
    const systemPrompt = buildSystemPrompt(section, sectionLabel, userName, contextBlocks);
    const fullQuestion = `${systemPrompt}\n\n[User Question]\n${question}`;

    // 3. Set up SSE streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    res.write(`data: ${JSON.stringify({ type: 'start', section: sectionLabel, timestamp: Date.now() })}\n\n`);

    // 4. Stream AI response
    let fullAnswer = '';

    await ai.answerQuestionStreaming(fullQuestion, '', {
      onChunk: (chunk) => {
        fullAnswer += chunk;
        res.write(`data: ${JSON.stringify({ type: 'chunk', content: chunk })}\n\n`);
      },
    });

    // 5. Generate follow-up suggestions based on section
    // With nothing in the section yet, canned follow-ups ("Compare project budgets") ask about data that is not there.
    const followUp = contextBlocks.trim() ? generateFollowUps(section, question) : [];
    if (followUp.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'followUp', suggestions: followUp })}\n\n`);
    }

    // 6. Save to conversation history
    // Only append to a conversation the caller owns (audit finding 3).
    let newConversationId = await askService.ownedConversationId(conversationId, req.user?.id);
    try {
      if (!newConversationId) {
        const { data: newConv } = await db
          .from('conversations')
          .insert({ user_id: req.user?.id, started_at: new Date(), title: `[AI] ${question.substring(0, 80)}` })
          .select().single();
        if (newConv) newConversationId = newConv.id;
      }
      if (newConversationId) {
        await db.from('conversation_messages').insert([
          { conversation_id: newConversationId, role: 'user', content: question },
          { conversation_id: newConversationId, role: 'assistant', content: fullAnswer },
        ]);
      }
    } catch (err) {
      log.warn('[Assistant] Could not save conversation:', err.message);
    }

    // 7. Complete
    res.write(`data: ${JSON.stringify({
      type: 'complete',
      answer: fullAnswer,
      conversationId: newConversationId,
      confidence: 0.85,
    })}\n\n`);
    res.end();

  } catch (error) {
    log.error('[Assistant] Query error:', { error: error.message || error });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Assistant query failed' });
    } else {
      res.write(`data: ${JSON.stringify({ type: 'error', message: 'An error occurred. Please try again.' })}\n\n`);
      res.end();
    }
  }
});

/**
 * GET /api/assistant/health
 * Check if assistant is ready
 */
router.get('/health', (req, res) => {
  res.json({
    ready: ai.isConfigured(),
    provider: ai.getProviderName(),
  });
});

// ── Follow-up suggestion generator ─────────────────────
function generateFollowUps(section, question) {
  const q = question.toLowerCase();

  const sectionFollowUps = {
    dashboard: [
      "What should I prioritize today?",
      "Any meetings coming up?",
      "Show me overdue tasks",
    ],
    meetings: [
      "What action items came from this?",
      "Summarize the key decisions",
      "Who was responsible for follow-ups?",
    ],
    tasks: [
      "Which tasks are blocked?",
      "What's due this week?",
      "Auto-assign my unassigned tasks",
    ],
    projects: [
      "Which project needs the most attention?",
      "Compare project budgets",
      "Show project timeline status",
    ],
    agents: [
      "What did agents do today?",
      "Show agent accuracy metrics",
      "Are there any pending reviews?",
    ],
    automations: [
      "Which automations failed recently?",
      "Suggest new automation rules",
      "Show automation execution stats",
    ],
    workflows: [
      "Any workflows stuck?",
      "Show recent execution results",
      "Optimize my workflows",
    ],
    calendar: [
      "What's on tomorrow?",
      "Find me free time this week",
      "Any scheduling conflicts?",
    ],
    analytics: [
      "What are the trends this month?",
      "Compare this week vs last week",
      "Show team productivity metrics",
    ],
  };

  // Pick follow-ups that don't repeat the current question
  const candidates = sectionFollowUps[section] || sectionFollowUps.dashboard;
  return candidates.filter(f => !q.includes(f.toLowerCase().substring(0, 20))).slice(0, 3);
}

// Shared with routes/entoAi.js (EAI-04).
router.generateFollowUps = generateFollowUps;
router.SECTION_LABELS = SECTION_LABELS;

module.exports = router;
