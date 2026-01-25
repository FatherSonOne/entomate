const express = require('express');
const router = express.Router();
const aiAgentService = require('../services/aiAgentService');
const agentOrchestrator = require('../services/agentOrchestrator');
const { getAllAgents, getAgent } = require('../services/agents');
const { authenticate, authorize } = require('../middleware/auth');
const { asyncHandler } = require('../middleware/errorHandler');
const { aiLimiter } = require('../middleware/rateLimiter');
const explanationAnalytics = require('../services/explainability/ExplanationAnalytics');

/**
 * GET /api/agents
 * List all AI agents
 */
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { enabled, type, team_id } = req.query;

  const filters = {};
  if (enabled !== undefined) filters.enabled = enabled === 'true';
  if (type) filters.agent_type = type;
  if (team_id) filters.team_id = team_id;

  const agents = await aiAgentService.listAgents(filters);

  res.json({
    success: true,
    data: agents,
    count: agents.length
  });
}));

/**
 * GET /api/agents/templates
 * Get predefined agent templates
 */
router.get('/templates', authenticate, (req, res) => {
  try {
    // Force reload templates by clearing require cache if needed
    delete require.cache[require.resolve('../services/agentTemplates')];
    const agentTemplates = require('../services/agentTemplates');
    const templates = agentTemplates.getAllTemplates();
    
    console.log(`[Agents] Returning ${templates.length} templates`);
    console.log(`[Agents] Template IDs:`, templates.map(t => t.id).join(', '));
    
    const response = {
      success: true,
      data: templates,
      count: templates.length,
      _debug: {
        source: 'agentTemplates.getAllTemplates()',
        timestamp: new Date().toISOString()
      }
    };
    
    res.json(response);
  } catch (error) {
    console.error('[Agents] Error getting templates:', error);
    res.status(500).json({
      success: false,
      error: error.message,
      data: []
    });
  }
});

/**
 * POST /api/agents
 * Create a new AI agent
 */
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const userId = req.user?.id || 'anonymous';

  const agent = await aiAgentService.createAgent(req.body, userId);

  res.status(201).json({
    success: true,
    data: agent,
    message: 'Agent created successfully'
  });
}));

/**
 * POST /api/agents/from-template
 * Create agent from predefined template
 */
router.post('/from-template', authenticate, asyncHandler(async (req, res) => {
  const { templateId, customizations } = req.body;
  const userId = req.user?.id || 'anonymous';

  if (!templateId) {
    return res.status(400).json({
      success: false,
      error: 'Template ID is required'
    });
  }

  const agent = await aiAgentService.createFromTemplate(templateId, userId, customizations || {});

  res.status(201).json({
    success: true,
    data: agent,
    message: `Agent created from template: ${templateId}`
  });
}));

/**
 * GET /api/agents/:id
 * Get agent details
 */
router.get('/:id', authenticate, asyncHandler(async (req, res) => {
  const agent = await aiAgentService.getAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  res.json({
    success: true,
    data: agent
  });
}));

/**
 * PUT /api/agents/:id
 * Update agent
 */
router.put('/:id', authenticate, asyncHandler(async (req, res) => {
  const agent = await aiAgentService.updateAgent(req.params.id, req.body);

  res.json({
    success: true,
    data: agent,
    message: 'Agent updated successfully'
  });
}));

/**
 * DELETE /api/agents/:id
 * Delete agent
 */
router.delete('/:id', authenticate, asyncHandler(async (req, res) => {
  await aiAgentService.deleteAgent(req.params.id);

  res.json({
    success: true,
    message: 'Agent deleted successfully'
  });
}));

/**
 * POST /api/agents/:id/toggle
 * Enable/disable agent
 */
router.post('/:id/toggle', authenticate, asyncHandler(async (req, res) => {
  const agent = await aiAgentService.toggleAgent(req.params.id);

  res.json({
    success: true,
    data: agent,
    message: `Agent ${agent.enabled ? 'enabled' : 'disabled'}`
  });
}));

/**
 * POST /api/agents/:id/execute
 * Manually execute an agent
 */
router.post('/:id/execute', authenticate, aiLimiter, asyncHandler(async (req, res) => {
  const { trigger_type, trigger_data } = req.body;

  if (!trigger_type) {
    return res.status(400).json({
      success: false,
      error: 'trigger_type is required'
    });
  }

  const agentData = await aiAgentService.getAgent(req.params.id);

  if (!agentData) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  const result = await aiAgentService.trigger(trigger_type, {
    ...trigger_data,
    _specific_agent_id: req.params.id
  });

  res.json({
    success: true,
    data: result,
    message: 'Agent execution completed'
  });
}));

/**
 * POST /api/agents/trigger
 * Trigger all matching agents for an event
 */
router.post('/trigger', authenticate, aiLimiter, asyncHandler(async (req, res) => {
  const { trigger_type, data } = req.body;

  if (!trigger_type) {
    return res.status(400).json({
      success: false,
      error: 'trigger_type is required'
    });
  }

  const result = await aiAgentService.trigger(trigger_type, data || {});

  res.json({
    success: true,
    data: result,
    message: `Triggered ${result.executed} agents`
  });
}));

/**
 * GET /api/agents/:id/logs
 * Get agent execution logs
 */
router.get('/:id/logs', authenticate, asyncHandler(async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit) || 50, 100);

  const logs = await aiAgentService.getExecutionLogs(req.params.id, limit);

  res.json({
    success: true,
    data: logs,
    count: logs.length
  });
}));

/**
 * POST /api/agents/executions/:executionId/feedback
 * Provide feedback on agent execution
 */
router.post('/executions/:executionId/feedback', authenticate, asyncHandler(async (req, res) => {
  const { rating, notes } = req.body;

  if (!rating || rating < 1 || rating > 5) {
    return res.status(400).json({
      success: false,
      error: 'Rating must be between 1 and 5'
    });
  }

  const execution = await aiAgentService.provideFeedback(
    req.params.executionId,
    rating,
    notes
  );

  res.json({
    success: true,
    data: execution,
    message: 'Feedback submitted successfully'
  });
}));

/**
 * GET /api/agents/executions/:executionId/explanation
 * Get AI explanation for an agent execution
 */
router.get('/executions/:executionId/explanation', authenticate, asyncHandler(async (req, res) => {
  const explanation = await aiAgentService.getExplanation(req.params.executionId);

  if (!explanation) {
    return res.status(404).json({
      success: false,
      error: 'Explanation not found for this execution'
    });
  }

  // Track view
  if (req.user?.id) {
    explanationAnalytics.trackView(req.params.executionId, req.user.id);
  }

  res.json({
    success: true,
    data: explanation
  });
}));

/**
 * GET /api/agents/analytics/explanations
 * Get explanation analytics and metrics
 */
router.get('/analytics/explanations', authenticate, asyncHandler(async (req, res) => {
  const report = await explanationAnalytics.getAnalyticsReport();

  res.json({
    success: true,
    data: report
  });
}));

/**
 * POST /api/agents/analytics/track
 * Track user interaction with explanations
 */
router.post('/analytics/track', authenticate, asyncHandler(async (req, res) => {
  const { eventType, executionId, metadata } = req.body;
  const userId = req.user?.id;

  if (!eventType || !executionId) {
    return res.status(400).json({
      success: false,
      error: 'eventType and executionId are required'
    });
  }

  switch (eventType) {
    case 'expansion':
      await explanationAnalytics.trackExpansion(executionId, userId);
      break;
    case 'alternative_selected':
      await explanationAnalytics.trackAlternativeSelection(executionId, userId, metadata?.alternativeId);
      break;
    case 'acceptance':
      await explanationAnalytics.trackAcceptance(executionId, userId, metadata?.recommendationId);
      break;
    case 'override':
      await explanationAnalytics.trackOverride(executionId, userId, metadata?.originalId, metadata?.selectedId);
      break;
    default:
      return res.status(400).json({
        success: false,
        error: `Unknown event type: ${eventType}`
      });
  }

  res.json({
    success: true,
    message: 'Event tracked successfully'
  });
}));

/**
 * GET /api/agents/:id/stats
 * Get agent performance statistics
 */
router.get('/:id/stats', authenticate, asyncHandler(async (req, res) => {
  const agent = await aiAgentService.getAgent(req.params.id);

  if (!agent) {
    return res.status(404).json({
      success: false,
      error: 'Agent not found'
    });
  }

  // Get execution stats
  const logs = await aiAgentService.getExecutionLogs(req.params.id, 100);

  const stats = {
    totalExecutions: agent.execution_count || 0,
    successRate: agent.success_rate || 0,
    lastExecuted: agent.last_executed_at,
    recentExecutions: logs.length,
    recentSuccessRate: logs.length > 0
      ? logs.filter(l => l.success).length / logs.length
      : 0,
    averageDuration: logs.length > 0
      ? logs.reduce((sum, l) => sum + (l.duration_ms || 0), 0) / logs.length
      : 0,
    feedbackStats: {
      averageRating: logs.filter(l => l.feedback_rating).length > 0
        ? logs.reduce((sum, l) => sum + (l.feedback_rating || 0), 0) / logs.filter(l => l.feedback_rating).length
        : null,
      totalFeedback: logs.filter(l => l.feedback_rating).length
    }
  };

  res.json({
    success: true,
    data: stats
  });
}));

// ========================================
// NEW: AI Agent Orchestration Routes (Week 7)
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
router.post('/run/:agentName', authenticate, aiLimiter, asyncHandler(async (req, res) => {
  const { agentName } = req.params;
  const context = req.body;

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
router.post('/orchestrate', authenticate, aiLimiter, asyncHandler(async (req, res) => {
  const { agents, context, parallel = false } = req.body;

  if (!agents || !Array.isArray(agents) || agents.length === 0) {
    return res.status(400).json({
      success: false,
      error: 'agents array is required'
    });
  }

  const result = parallel
    ? await agentOrchestrator.orchestrateParallel(agents, context || {})
    : await agentOrchestrator.orchestrate(agents, context || {});

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/agents/process-meeting
 * Process meeting action items with AI agents
 */
router.post('/process-meeting', authenticate, aiLimiter, asyncHandler(async (req, res) => {
  const { meeting, actionItems } = req.body;

  if (!meeting || !actionItems) {
    return res.status(400).json({
      success: false,
      error: 'meeting and actionItems are required'
    });
  }

  const result = await agentOrchestrator.processMeetingWithAgents(meeting, actionItems);

  res.json({
    success: true,
    data: result
  });
}));

/**
 * POST /api/agents/apply-suggestions
 * Apply AI agent suggestions to an action item
 */
router.post('/apply-suggestions', authenticate, asyncHandler(async (req, res) => {
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
router.get('/orchestrator/logs', authenticate, (req, res) => {
  const limit = parseInt(req.query.limit) || 20;
  const logs = agentOrchestrator.getExecutionLogs(limit);

  res.json({
    success: true,
    data: logs,
    count: logs.length
  });
});

module.exports = router;
