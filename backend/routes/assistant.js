/**
 * Assistant Routes
 * Context-aware AI assistant endpoint with SSE streaming
 */

const express = require('express');
const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const log = require('../utils/log');
const { optionalAuth } = require('../middleware/auth');

const router = express.Router();

// ── Section data loaders ───────────────────────────────
// Each loader fetches the data relevant to a specific app section

const sectionLoaders = {
  async dashboard(userId) {
    const [tasks, meetings, projects] = await Promise.allSettled([
      supabase.from('tasks').select('id, title, description, status, priority, due_date, assigned_to, project_id')
        .order('due_date', { ascending: true }).limit(20),
      supabase.from('meetings').select('id, title, summary, created_at, sentiment_label')
        .order('created_at', { ascending: false }).limit(10),
      supabase.from('projects').select('id, name, status, start_date, end_date, budget, budget_spent')
        .eq('status', 'active').limit(10),
    ]);
    return {
      tasks: tasks.status === 'fulfilled' ? tasks.value?.data || [] : [],
      meetings: meetings.status === 'fulfilled' ? meetings.value?.data || [] : [],
      projects: projects.status === 'fulfilled' ? projects.value?.data || [] : [],
    };
  },

  async meetings() {
    const { data } = await supabase.from('meetings')
      .select('id, title, summary, key_points, decisions, created_at, sentiment_label, transcript')
      .order('created_at', { ascending: false }).limit(15);
    // Truncate transcripts to save tokens
    return { meetings: (data || []).map(m => ({ ...m, transcript: m.transcript?.substring(0, 500) })) };
  },

  async calendar() {
    try {
      const { data } = await supabase.from('calendar_events')
        .select('id, title, start_time, end_time, location, description')
        .gte('start_time', new Date().toISOString())
        .order('start_time', { ascending: true }).limit(20);
      return { events: data || [] };
    } catch { return { events: [] }; }
  },

  async projects() {
    const { data } = await supabase.from('projects')
      .select('id, name, description, status, start_date, end_date, budget, budget_spent, created_at')
      .order('created_at', { ascending: false }).limit(15);
    return { projects: data || [] };
  },

  async tasks() {
    const { data } = await supabase.from('tasks')
      .select('id, title, description, status, priority, due_date, assigned_to, project_id, created_at')
      .order('due_date', { ascending: true }).limit(25);
    return { tasks: data || [] };
  },

  async goals() {
    try {
      const { data } = await supabase.from('goals')
        .select('id, title, description, status, progress, target_value, current_value, due_date')
        .order('due_date', { ascending: true }).limit(15);
      return { goals: data || [] };
    } catch { return { goals: [] }; }
  },

  async workflows() {
    const { data } = await supabase.from('workflows')
      .select('id, name, description, status, enabled, last_run_at, created_at')
      .order('created_at', { ascending: false }).limit(15);
    return { workflows: data || [] };
  },

  async automations() {
    const { data } = await supabase.from('automations')
      .select('id, name, description, enabled, trigger_type, last_run_at, created_at')
      .order('created_at', { ascending: false }).limit(15);
    return { automations: data || [] };
  },

  async agents() {
    const { data } = await supabase.from('agents')
      .select('id, name, type, description, enabled, last_execution_at, created_at')
      .order('created_at', { ascending: false }).limit(15);
    return { agents: data || [] };
  },

  async analytics() {
    // Aggregate metrics
    const [tasks, meetings, projects] = await Promise.allSettled([
      supabase.from('tasks').select('status', { count: 'exact' }),
      supabase.from('meetings').select('id', { count: 'exact' }),
      supabase.from('projects').select('status', { count: 'exact' }),
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
async function loadSectionData(section, userId) {
  const loader = sectionLoaders[section];
  if (!loader) return {};
  try {
    return await loader(userId);
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

Your expertise includes:
- Meeting intelligence: transcripts, summaries, action items, decisions, sentiment analysis
- Project management: task tracking, deadlines, budgets, milestones, team workload
- Workflow & automation: rules, triggers, scheduling, execution monitoring
- AI agents: autonomous task assignment, priority scoring, deadline prediction
- Analytics: productivity metrics, meeting patterns, team performance trends
- Calendar management: scheduling, event planning, time blocking, availability

${hasData
    ? `IMPORTANT: You have access to REAL, LIVE data from the user's ${sectionLabel} section below. You MUST reference specific items by their ACTUAL names, dates, and statuses from this data. Never make up or generalize — always cite real items.`
    : `No live data is currently available for this section. Give helpful general guidance about what ${sectionLabel} can do in Entomate.`
  }

Formatting rules:
- Use **bold** for names, amounts, dates, and key terms
- Use bullet lists for multiple items
- Use numbered lists for sequential steps
- Keep paragraphs short (2-3 sentences max)
- Lead with the direct answer, then expand with specifics
- Be concise but thorough

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
      budget: p.budget, budgetSpent: p.budget_spent,
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
  if (data.goals?.length) {
    const slim = data.goals.slice(0, 15).map(g => ({
      id: g.id, title: g.title, status: g.status,
      progress: g.progress, target: g.target_value, current: g.current_value,
    }));
    blocks.push(`[Goals (${slim.length})]\n${JSON.stringify(slim, null, 1)}`);
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
  goals: 'Goals',
  workflows: 'Workflows',
  automations: 'Automations',
  agents: 'AI Agents',
  analytics: 'Analytics',
  reports: 'Reports',
  settings: 'Settings',
  guide: 'User Guide',
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
router.post('/query', optionalAuth, async (req, res) => {
  try {
    const { question, section = 'dashboard', conversationId } = req.body;

    if (!question) {
      return res.status(400).json({ error: 'Question is required' });
    }

    if (!ai.isConfigured()) {
      return res.status(503).json({ error: 'AI service not configured' });
    }

    const userId = req.user?.id;
    const userName = req.user?.name || req.user?.email || 'User';
    const sectionLabel = SECTION_LABELS[section] || 'Dashboard';

    // 1. Load section-specific data from database
    log.info(`[Assistant] Query in ${sectionLabel}: "${question.substring(0, 80)}"`);
    const sectionData = await loadSectionData(section, userId);

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
    const followUp = generateFollowUps(section, question);
    if (followUp.length > 0) {
      res.write(`data: ${JSON.stringify({ type: 'followUp', suggestions: followUp })}\n\n`);
    }

    // 6. Save to conversation history
    let newConversationId = conversationId;
    if (supabase) {
      try {
        if (!conversationId) {
          const { data: newConv } = await supabase
            .from('conversations')
            .insert({ started_at: new Date(), title: `[AI] ${question.substring(0, 80)}` })
            .select().single();
          if (newConv) newConversationId = newConv.id;
        }
        if (newConversationId) {
          await supabase.from('conversation_messages').insert([
            { conversation_id: newConversationId, role: 'user', content: question },
            { conversation_id: newConversationId, role: 'assistant', content: fullAnswer },
          ]);
        }
      } catch (err) {
        log.warn('[Assistant] Could not save conversation:', err.message);
      }
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
    goals: [
      "Which goals are at risk?",
      "Update me on key results",
      "How can I accelerate progress?",
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

module.exports = router;
