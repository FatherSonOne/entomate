/**
 * /api/agents — the four built-in meeting agents (assignment, priority,
 * deadline, follow-up) and the orchestrator that runs them.
 *
 * The custom-agent builder (ai_agents table, aiAgentService, agent templates)
 * was removed when Automations, Workflows and Agents merged (feature audit
 * 2026-11-22, F6/F7). Which agents run on meeting end is set per workspace in
 * Settings › Meeting agents (/api/settings/meeting-agents).
 */
const express = require('express');
const router = express.Router();
const agentOrchestrator = require('../services/agentOrchestrator');
const { getAllAgents, getAgent } = require('../services/agents');
const { authenticate } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { aiLimiter } = require('../middleware/rateLimiter');
const { getOrgIdForUser } = require('../utils/orgContext');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/agents');

// ========================================
// Built-in meeting agents
// ========================================

/**
 * GET /api/agents/available
 * Get available AI agents (assignment, priority, deadline)
 */
router.get('/available', authenticate, (req, res) => {
  try {
    const agents = getAllAgents();
    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * POST /api/agents/run/:agentName
 * Run a specific AI agent with context
 */
router.post('/run/:agentName', authenticate, aiLimiter, validate(schemas.run), asyncHandler(async (req, res) => {
  const { agentName } = req.params;
  // orgId is always derived server-side; a client-supplied one is ignored
  const context = { ...req.body, orgId: await getOrgIdForUser(req.user?.id) };

  const agent = getAgent(agentName);
  if (!agent) {
    return res.status(404).json({
      success: false,
      error: `Agent not found: ${agentName}`
    });
  }

  const result = await agentOrchestrator.runAgent(agentName, context);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/agents/orchestrate
 * Run multiple agents in sequence or parallel
 */
router.post('/orchestrate', authenticate, aiLimiter, validate(schemas.orchestrate), asyncHandler(async (req, res) => {
  const { agents, context, parallel = false } = req.body;

  if (!agents || !Array.isArray(agents) || agents.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'agents array is required'
    });
  }

  const scopedContext = { ...(context || {}), orgId: await getOrgIdForUser(req.user?.id) };
  const result = parallel
    ? await agentOrchestrator.orchestrateParallel(agents, scopedContext)
    : await agentOrchestrator.orchestrate(agents, scopedContext);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/agents/process-meeting
 * Process meeting action items with AI agents
 */
router.post('/process-meeting', authenticate, aiLimiter, validate(schemas.processMeeting), asyncHandler(async (req, res) => {
  const { meeting, actionItems } = req.body;

  if (!meeting || !actionItems) {
    return res.status(400).json({
      success: false,
      error: 'meeting and actionItems are required'
    });
  }

  const result = await agentOrchestrator.processMeetingWithAgents(
    { ...meeting, org_id: await getOrgIdForUser(req.user?.id) },
    actionItems
  );

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/agents/apply-suggestions
 * Apply AI agent suggestions to an action item
 */
router.post('/apply-suggestions', authenticate, validate(schemas.applySuggestions), asyncHandler(async (req, res) => {
  const { actionItemId, suggestions, options } = req.body;

  if (!actionItemId || !suggestions) {
    return res.status(400).json({
      success: false,
      error: 'actionItemId and suggestions are required'
    });
  }

  const result = await agentOrchestrator.applyAgentSuggestions(
    actionItemId,
    suggestions,
    options || {}
  );

  res.json({
    success: true,
    data: result
  });
}));

/**
 * GET /api/agents/orchestrator/logs
 * Get recent agent orchestration logs
 */
router.get('/orchestrator/logs', authenticate, asyncHandler(async (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const logs = await agentOrchestrator.getExecutionLogs(limit);

  res.json({
    success: true,
    data: logs,
    count: logs.length
  });
}));

module.exports = router;
