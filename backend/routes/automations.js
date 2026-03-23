const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { supabase } = require('../config/supabase');
const automationScheduler = require('../services/automationScheduler');
const { authenticate, authorize, optionalAuth, apiKeyAuth } = require('../middleware/auth');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/automations');
const log = require('../utils/log');

const router = express.Router();

// Initialize scheduler on module load
automationScheduler.initialize().catch(err => {
  log.error('Failed to initialize automation scheduler:', { error: err.message || err });
});

// Automation trigger types
const TRIGGER_TYPES = {
  MEETING_ENDED: 'meeting_ended',
  DEAL_CREATED: 'deal_created',
  TASK_COMPLETED: 'task_completed',
  ACTION_ITEM_CREATED: 'action_item_created',
  SCHEDULED: 'scheduled',
  WEBHOOK: 'webhook',
  // Workflow template trigger types
  TRIGGER: 'trigger',
  MANUAL: 'manual',
  CRM_TRIGGER: 'crm_trigger',
  DEAL_STAGE_CHANGED: 'deal_stage_changed',
  CONTACT_CREATED: 'contact_created',
  TASK_OVERDUE: 'task_overdue'
};

// Automation action types
const ACTION_TYPES = {
  CREATE_TASK: 'create_task',
  CREATE_PROJECT: 'create_project',
  UPDATE_CRM: 'update_crm',
  POST_TO_CHAT: 'post_to_chat',
  SEND_EMAIL: 'send_email',
  SYNC_ACTION_ITEMS: 'sync_action_items',
  NOTIFY_USER: 'notify_user'
};

/**
 * POST /api/automations
 * Create a new automation
 * Uses optionalAuth to allow creation without login during development
 */
router.post('/', optionalAuth, validate(schemas.create), async (req, res) => {
  try {
    const {
      name,
      description,
      triggerType,
      triggerConfig,
      actions,
      enabled = true
    } = req.body;

    if (!name || !triggerType || !actions) {
      return res.status(400).json({
        error: 'Name, trigger type, and actions are required'
      });
    }

    if (!Object.values(TRIGGER_TYPES).includes(triggerType)) {
      return res.status(400).json({
        error: `Invalid trigger type. Must be one of: ${Object.values(TRIGGER_TYPES).join(', ')}`
      });
    }

    const automationData = {
      id: uuidv4(),
      name,
      description: description || null,
      trigger_type: triggerType,
      trigger_config: triggerConfig || {},
      actions: actions,
      enabled,
      created_by: req.user?.id || 'anonymous',
      team_id: req.user?.teamId || 'default',
      execution_count: 0,
      last_executed_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    if (!supabase) {
      return res.json({ success: true, automation: automationData });
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .insert(automationData)
      .select()
      .single();

    if (error) throw error;

    // Notify scheduler if this is a scheduled automation
    if (automation.trigger_type === 'scheduled' && automation.enabled) {
      automationScheduler.handleAutomationUpdate(automation);
    }

    res.status(201).json({
      success: true,
      automation
    });

  } catch (error) {
    log.error('Error creating automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations
 * List all automations
 */
router.get('/', validate(schemas.list), async (req, res) => {
  try {
    const { limit = 50, offset = 0, enabled, triggerType } = req.query;

    if (!supabase) {
      return res.json({ automations: [], count: 0 });
    }

    let query = supabase
      .from('automations')
      .select('*', { count: 'exact' })
      .order('created_at', { ascending: false });

    if (enabled !== undefined) {
      query = query.eq('enabled', enabled === 'true');
    }

    if (triggerType) {
      query = query.eq('trigger_type', triggerType);
    }

    query = query.range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    const { data: automations, error, count } = await query;

    if (error) throw error;

    res.json({
      automations: automations || [],
      count: count || 0,
      triggerTypes: TRIGGER_TYPES,
      actionTypes: ACTION_TYPES
    });

  } catch (error) {
    log.error('Error listing automations:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations/templates
 * Get pre-built automation templates (includes workflow templates)
 */
router.get('/templates', (req, res) => {
  const { category } = req.query;

  // Basic automation templates
  const basicTemplates = [
    {
      id: 'meeting-to-crm',
      name: 'Meeting → CRM Sync',
      description: 'When a meeting ends, extract action items and sync them to CRM',
      triggerType: TRIGGER_TYPES.MEETING_ENDED,
      triggerConfig: {},
      category: 'integration',
      icon: '🔄',
      actions: [
        { type: ACTION_TYPES.SYNC_ACTION_ITEMS, config: { syncAll: true } },
        { type: ACTION_TYPES.POST_TO_CHAT, config: { includeActionItems: true } }
      ]
    },
    {
      id: 'deal-kickoff',
      name: 'Deal → Project Kickoff',
      description: 'When a new deal is created, create a project with default tasks',
      triggerType: TRIGGER_TYPES.DEAL_CREATED,
      triggerConfig: { minDealValue: 0 },
      category: 'integration',
      icon: '💼',
      actions: [
        { type: ACTION_TYPES.CREATE_PROJECT, config: { fromDeal: true } },
        { type: ACTION_TYPES.NOTIFY_USER, config: { message: 'New project created from deal' } }
      ]
    },
    {
      id: 'task-notification',
      name: 'Task Completed → Notify',
      description: 'When a task is completed, notify the project owner',
      triggerType: TRIGGER_TYPES.TASK_COMPLETED,
      triggerConfig: {},
      category: 'integration',
      icon: '✅',
      actions: [
        { type: ACTION_TYPES.NOTIFY_USER, config: { notifyOwner: true } }
      ]
    },
    {
      id: 'action-item-task',
      name: 'Action Item → Task',
      description: 'When action items are extracted, create tasks automatically',
      triggerType: TRIGGER_TYPES.ACTION_ITEM_CREATED,
      triggerConfig: { priorityFilter: ['high', 'medium'] },
      category: 'integration',
      icon: '📋',
      actions: [
        { type: ACTION_TYPES.CREATE_TASK, config: { fromActionItem: true } }
      ]
    },
    {
      id: 'daily-digest',
      name: 'Daily Digest',
      description: 'Send a daily summary of meetings and tasks',
      triggerType: TRIGGER_TYPES.SCHEDULED,
      triggerConfig: { cron: '0 9 * * *' },
      category: 'integration',
      icon: '📅',
      actions: [
        { type: ACTION_TYPES.POST_TO_CHAT, config: { dailyDigest: true } }
      ]
    }
  ];

  // Try to load workflow templates (including CRM)
  let workflowTemplates = [];
  try {
    const WorkflowTemplates = require('../services/workflow/WorkflowTemplates');
    const allWorkflowTemplates = WorkflowTemplates.getAllTemplates();

    // Convert workflow templates to automation-compatible format
    workflowTemplates = allWorkflowTemplates.map(t => ({
      id: t.id,
      name: t.name,
      description: t.description,
      category: t.category || 'workflow',
      icon: t.icon || '⚡',
      triggerType: t.nodes?.find(n => n.type?.includes('trigger'))?.type || 'webhook',
      triggerConfig: {},
      isWorkflowTemplate: true,
      nodeCount: t.nodes?.length || 0,
      actions: t.nodes?.filter(n => !n.type?.includes('trigger')).map(n => ({
        type: n.type,
        config: n.parameters || {}
      })) || []
    }));
  } catch (err) {
    log.warn('Could not load workflow templates:', err.message);
  }

  // Combine all templates
  let allTemplates = [...basicTemplates, ...workflowTemplates];

  // Filter by category if specified
  if (category && category !== 'all') {
    allTemplates = allTemplates.filter(t => t.category === category);
  }

  res.json({
    templates: allTemplates,
    categories: ['all', 'integration', 'ai', 'crm', 'workflow']
  });
});

/**
 * GET /api/automations/:id
 * Get automation details
 */
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(404).json({ error: 'Database not configured' });
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json(automation);

  } catch (error) {
    log.error('Error getting automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * PUT /api/automations/:id
 * Update automation
 */
router.put('/:id', optionalAuth, validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const allowedFields = ['name', 'description', 'trigger_type', 'trigger_config',
                          'actions', 'enabled'];
    const filteredUpdates = {};
    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        filteredUpdates[field] = updates[field];
      }
    }
    filteredUpdates.updated_at = new Date().toISOString();

    const { data: automation, error } = await supabase
      .from('automations')
      .update(filteredUpdates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Notify scheduler about the update
    automationScheduler.handleAutomationUpdate(automation);

    res.json(automation);

  } catch (error) {
    log.error('Error updating automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * DELETE /api/automations/:id
 * Delete automation
 */
router.delete('/:id', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Cancel any scheduled jobs first
    automationScheduler.handleAutomationDelete(id);

    // Delete logs first
    await supabase
      .from('automation_logs')
      .delete()
      .eq('automation_id', id);

    // Delete automation
    const { error } = await supabase
      .from('automations')
      .delete()
      .eq('id', id);

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    res.json({ success: true, message: 'Automation deleted' });

  } catch (error) {
    log.error('Error deleting automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/:id/toggle
 * Enable or disable automation
 */
router.post('/:id/toggle', optionalAuth, validate(schemas.toggle), async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get current state if enabled not provided
    let newEnabled = enabled;
    if (enabled === undefined) {
      const { data: current } = await supabase
        .from('automations')
        .select('enabled')
        .eq('id', id)
        .single();
      newEnabled = !current?.enabled;
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .update({
        enabled: newEnabled,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Notify scheduler about the toggle
    automationScheduler.handleAutomationUpdate(automation);

    res.json(automation);

  } catch (error) {
    log.error('Error toggling automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/:id/execute
 * Manually execute an automation
 */
router.post('/:id/execute', optionalAuth, validate(schemas.execute), async (req, res) => {
  try {
    const { id } = req.params;
    const { triggerData } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    // Get automation
    const { data: automation, error: automationError } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single();

    if (automationError) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    const startTime = Date.now();
    const results = [];
    let success = true;
    let errorMessage = null;

    // Execute each action
    for (const action of automation.actions) {
      try {
        const result = await executeAction(action, triggerData, automation);
        results.push({ type: action.type, status: 'success', result });
      } catch (actionError) {
        results.push({ type: action.type, status: 'failed', error: actionError.message });
        success = false;
        errorMessage = actionError.message;
      }
    }

    const duration = Date.now() - startTime;

    // Log execution
    const logData = {
      id: uuidv4(),
      automation_id: id,
      triggered_at: new Date().toISOString(),
      trigger_data: triggerData || {},
      actions_executed: results,
      success,
      error_message: errorMessage,
      duration_ms: duration,
      created_at: new Date().toISOString()
    };

    await supabase.from('automation_logs').insert(logData);

    // Update automation stats
    await supabase
      .from('automations')
      .update({
        execution_count: (automation.execution_count || 0) + 1,
        last_executed_at: new Date().toISOString()
      })
      .eq('id', id);

    res.json({
      success,
      automation: automation.name,
      results,
      duration: `${duration}ms`,
      logId: logData.id
    });

  } catch (error) {
    log.error('Error executing automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/automations/:id/logs
 * Get automation execution logs
 */
router.get('/:id/logs', async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    if (!supabase) {
      return res.json({ logs: [], count: 0 });
    }

    const { data: logs, error, count } = await supabase
      .from('automation_logs')
      .select('*', { count: 'exact' })
      .eq('automation_id', id)
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

    if (error) throw error;

    res.json({
      logs: logs || [],
      count: count || 0
    });

  } catch (error) {
    log.error('Error getting automation logs:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/trigger
 * Trigger automations by event type (internal use)
 * Allows API key auth for service-to-service calls
 */
router.post('/trigger', apiKeyAuth, validate(schemas.trigger), async (req, res) => {
  try {
    const { triggerType, triggerData } = req.body;

    if (!triggerType) {
      return res.status(400).json({ error: 'Trigger type is required' });
    }

    if (!supabase) {
      return res.json({ triggered: 0, results: [] });
    }

    // Find matching automations
    const { data: automations } = await supabase
      .from('automations')
      .select('*')
      .eq('trigger_type', triggerType)
      .eq('enabled', true);

    const results = [];

    for (const automation of automations || []) {
      try {
        // Check trigger conditions
        if (shouldTrigger(automation.trigger_config, triggerData)) {
          const startTime = Date.now();
          const actionResults = [];
          let success = true;

          for (const action of automation.actions) {
            try {
              const result = await executeAction(action, triggerData, automation);
              actionResults.push({ type: action.type, status: 'success', result });
            } catch (actionError) {
              actionResults.push({ type: action.type, status: 'failed', error: actionError.message });
              success = false;
            }
          }

          const duration = Date.now() - startTime;

          // Log execution
          await supabase.from('automation_logs').insert({
            id: uuidv4(),
            automation_id: automation.id,
            triggered_at: new Date().toISOString(),
            trigger_data: triggerData,
            actions_executed: actionResults,
            success,
            duration_ms: duration,
            created_at: new Date().toISOString()
          });

          // Update stats
          await supabase
            .from('automations')
            .update({
              execution_count: (automation.execution_count || 0) + 1,
              last_executed_at: new Date().toISOString()
            })
            .eq('id', automation.id);

          results.push({
            automationId: automation.id,
            name: automation.name,
            success,
            actions: actionResults.length
          });
        }
      } catch (automationError) {
        results.push({
          automationId: automation.id,
          name: automation.name,
          success: false,
          error: automationError.message
        });
      }
    }

    res.json({
      triggered: results.length,
      results
    });

  } catch (error) {
    log.error('Error triggering automations:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// Helper function to check if automation should trigger
function shouldTrigger(config, data) {
  if (!config || Object.keys(config).length === 0) return true;

  // Check min deal value
  if (config.minDealValue !== undefined && data.dealValue !== undefined) {
    if (data.dealValue < config.minDealValue) return false;
  }

  // Check priority filter
  if (config.priorityFilter && data.priority) {
    if (!config.priorityFilter.includes(data.priority)) return false;
  }

  return true;
}

// Helper function to execute an action
async function executeAction(action, triggerData, automation) {
  log.info(`Executing action: ${action.type}`);

  switch (action.type) {
    case ACTION_TYPES.CREATE_TASK:
      return { message: 'Task creation queued', data: triggerData };

    case ACTION_TYPES.CREATE_PROJECT:
      return { message: 'Project creation queued', data: triggerData };

    case ACTION_TYPES.UPDATE_CRM:
      return { message: 'CRM update queued', data: triggerData };

    case ACTION_TYPES.POST_TO_CHAT:
      return { message: 'Chat message queued', data: triggerData };

    case ACTION_TYPES.SEND_EMAIL:
      return { message: 'Email queued', data: triggerData };

    case ACTION_TYPES.SYNC_ACTION_ITEMS:
      return { message: 'Action items sync queued', data: triggerData };

    case ACTION_TYPES.NOTIFY_USER:
      return { message: 'Notification queued', data: triggerData };

    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * GET /api/automations/scheduler/status
 * Get scheduled automations status
 */
router.get('/scheduler/status', (req, res) => {
  try {
    const status = automationScheduler.getScheduledStatus();
    res.json({
      scheduled: status,
      count: status.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/:id/schedule
 * Manually schedule/reschedule an automation
 */
router.post('/:id/schedule', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    if (automation.trigger_type !== 'scheduled') {
      return res.status(400).json({ error: 'Automation is not a scheduled type' });
    }

    await automationScheduler.handleAutomationUpdate(automation);

    res.json({
      success: true,
      status: automationScheduler.getAutomationStatus(id)
    });

  } catch (error) {
    log.error('Error scheduling automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/automations/:id/test
 * Test automation with sample data (dry-run)
 */
router.post('/:id/test', optionalAuth, validate(schemas.test), async (req, res) => {
  try {
    const { id } = req.params;
    const { sampleData = {} } = req.body;

    if (!supabase) {
      return res.status(503).json({ error: 'Database not configured' });
    }

    const { data: automation, error } = await supabase
      .from('automations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      return res.status(404).json({ error: 'Automation not found' });
    }

    // Check if conditions would be met
    const wouldTrigger = shouldTrigger(automation.trigger_config, sampleData);

    // Preview what actions would execute
    const actionPreviews = automation.actions.map(action => ({
      type: action.type,
      config: action.config,
      preview: getActionPreview(action, sampleData)
    }));

    res.json({
      wouldTrigger,
      automation: {
        id: automation.id,
        name: automation.name,
        triggerType: automation.trigger_type,
        enabled: automation.enabled
      },
      triggerConfig: automation.trigger_config,
      sampleData,
      actions: actionPreviews,
      message: wouldTrigger
        ? `Automation would execute ${actionPreviews.length} action(s)`
        : 'Automation would NOT trigger with this data (conditions not met)'
    });

  } catch (error) {
    log.error('Error testing automation:', { error: error.message || error });
    res.status(500).json({ error: error.message });
  }
});

// Helper function to preview what an action would do
function getActionPreview(action, sampleData) {
  switch (action.type) {
    case ACTION_TYPES.CREATE_TASK:
      return {
        description: 'Would create a new task',
        details: action.config?.fromActionItem
          ? 'Task created from action item data'
          : 'Task created with custom configuration'
      };

    case ACTION_TYPES.CREATE_PROJECT:
      return {
        description: 'Would create a new project',
        details: action.config?.fromDeal
          ? `Project created from deal: ${sampleData.dealName || 'Unknown'}`
          : 'Project created with custom configuration'
      };

    case ACTION_TYPES.UPDATE_CRM:
      return {
        description: 'Would update CRM records',
        details: 'Sync meeting data and action items to CRM'
      };

    case ACTION_TYPES.POST_TO_CHAT:
      return {
        description: 'Would post message to chat',
        details: action.config?.dailyDigest
          ? 'Daily digest summary'
          : action.config?.includeActionItems
            ? 'Meeting summary with action items'
            : 'Chat notification'
      };

    case ACTION_TYPES.SEND_EMAIL:
      return {
        description: 'Would send email notification',
        details: `Email to: ${action.config?.recipients || 'configured recipients'}`
      };

    case ACTION_TYPES.SYNC_ACTION_ITEMS:
      return {
        description: 'Would sync action items',
        details: action.config?.syncAll
          ? 'Sync all action items to external systems'
          : 'Sync selected action items'
      };

    case ACTION_TYPES.NOTIFY_USER:
      return {
        description: 'Would send user notification',
        details: action.config?.notifyOwner
          ? 'Notify project/task owner'
          : action.config?.message || 'Custom notification'
      };

    default:
      return {
        description: `Would execute ${action.type}`,
        details: 'Custom action'
      };
  }
}

module.exports = router;
