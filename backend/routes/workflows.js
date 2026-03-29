/**
 * Workflow API Routes (v2)
 *
 * CRUD operations for node-based workflows
 */

const express = require('express');
const router = express.Router();
const { supabase } = require('../config/supabase');
const { authenticate } = require('../middleware/auth');
const { apiLimiter, aiLimiter } = require('../middleware/rateLimiter');
const WorkflowExecutor = require('../services/workflow/WorkflowExecutor');
const NodeRegistry = require('../services/workflow/NodeRegistry');
const log = require('../utils/log');
const { validate } = require('../middleware/validate');
const schemas = require('../schemas/workflows');

const workflowExecutor = new WorkflowExecutor();
const nodeRegistry = new NodeRegistry();

// ========================================
// WORKFLOW CRUD OPERATIONS
// ========================================

/**
 * GET /api/workflows
 * List all workflows for the authenticated user
 */
router.get('/', authenticate, async (req, res) => {
  try {
    const { active, template, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('workflows')
      .select('id, name, description, active, is_template, version, execution_count, last_executed_at, created_at, updated_at', { count: 'exact' })
      .order('updated_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Filter by user (RLS will also enforce this)
    if (req.user?.id) {
      query = query.eq('user_id', req.user.id);
    }

    // Apply filters
    if (active !== undefined) {
      query = query.eq('active', active === 'true');
    }
    if (template !== undefined) {
      query = query.eq('is_template', template === 'true');
    }

    const { data: workflows, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: workflows,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    log.error('[Workflows] List error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workflows/:id
 * Get a single workflow with full details
 */
router.get('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Get associated webhooks
    const { data: webhooks } = await supabase
      .from('webhooks')
      .select('id, path, method, enabled, trigger_count, last_triggered_at')
      .eq('workflow_id', id);

    // Get associated schedules
    const { data: schedules } = await supabase
      .from('workflow_schedules')
      .select('id, cron_expression, timezone, enabled, next_run_at, last_run_at')
      .eq('workflow_id', id);

    res.json({
      success: true,
      data: {
        ...workflow,
        webhooks: webhooks || [],
        schedules: schedules || []
      }
    });

  } catch (error) {
    log.error('[Workflows] Get error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows
 * Create a new workflow
 */
router.post('/', authenticate, validate(schemas.create), async (req, res) => {
  try {
    const {
      name,
      description,
      nodes = [],
      connections = [],
      settings = {},
      active = false,
      is_template = false
    } = req.body;

    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    // Validate nodes
    const validationResult = validateWorkflow({ nodes, connections });
    if (!validationResult.valid) {
      return res.status(400).json({
        success: false,
        error: 'Invalid workflow',
        details: validationResult.errors
      });
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .insert({
        name,
        description,
        nodes,
        connections,
        settings,
        active,
        is_template,
        user_id: req.user?.id,
        version: 1
      })
      .select()
      .single();

    if (error) throw error;

    // Create webhooks for webhook trigger nodes
    await createWebhooksForWorkflow(workflow);

    // Create schedules for schedule trigger nodes
    await createSchedulesForWorkflow(workflow);

    res.status(201).json({
      success: true,
      data: workflow
    });

  } catch (error) {
    log.error('[Workflows] Create error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * PUT /api/workflows/:id
 * Update an existing workflow
 */
router.put('/:id', authenticate, validate(schemas.update), async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      nodes,
      connections,
      settings,
      active,
      change_summary
    } = req.body;

    // Build update object
    const updateData = { updated_at: new Date().toISOString() };
    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;
    if (nodes !== undefined) updateData.nodes = nodes;
    if (connections !== undefined) updateData.connections = connections;
    if (settings !== undefined) {
      updateData.settings = { ...settings, change_summary };
    }
    if (active !== undefined) updateData.active = active;

    // Validate if nodes/connections changed
    if (nodes || connections) {
      const validationResult = validateWorkflow({
        nodes: nodes || [],
        connections: connections || []
      });
      if (!validationResult.valid) {
        return res.status(400).json({
          success: false,
          error: 'Invalid workflow',
          details: validationResult.errors
        });
      }
    }

    const { data: workflow, error } = await supabase
      .from('workflows')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Update webhooks if nodes changed
    if (nodes) {
      await updateWebhooksForWorkflow(workflow);
    }

    // Update schedules if nodes changed
    if (nodes) {
      await updateSchedulesForWorkflow(workflow);
    }

    res.json({
      success: true,
      data: workflow
    });

  } catch (error) {
    log.error('[Workflows] Update error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workflows/:id
 * Delete a workflow
 */
router.delete('/:id', authenticate, async (req, res) => {
  try {
    const { id } = req.params;

    const { error } = await supabase
      .from('workflows')
      .delete()
      .eq('id', id);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Workflow deleted'
    });

  } catch (error) {
    log.error('[Workflows] Delete error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// WORKFLOW EXECUTION
// ========================================

/**
 * POST /api/workflows/:id/execute
 * Execute a workflow manually
 */
router.post('/:id/execute', authenticate, aiLimiter, validate(schemas.execute), async (req, res) => {
  try {
    const { id } = req.params;
    const { inputData = {}, mode = 'production' } = req.body;

    // Get workflow
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Execute workflow
    const result = await workflowExecutor.execute(workflow, inputData, {
      mode,
      triggeredBy: 'manual',
      userId: req.user?.id
    });

    // Update stats
    await supabase
      .from('workflows')
      .update({
        execution_count: workflow.execution_count + 1,
        last_executed_at: new Date().toISOString()
      })
      .eq('id', id);

    res.json({
      success: result.success,
      executionId: result.executionId,
      output: result.output,
      error: result.error,
      nodeExecutions: result.nodeExecutions,
      durationMs: result.durationMs
    });

  } catch (error) {
    log.error('[Workflows] Execute error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows/:id/test
 * Test a workflow (dry run)
 */
router.post('/:id/test', authenticate, validate(schemas.test), async (req, res) => {
  try {
    const { id } = req.params;
    const { inputData = {} } = req.body;

    // Get workflow
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    if (!workflow) {
      return res.status(404).json({ success: false, error: 'Workflow not found' });
    }

    // Execute in test mode
    const result = await workflowExecutor.test(workflow, inputData);

    res.json({
      success: result.success,
      executionId: result.executionId,
      output: result.output,
      error: result.error,
      nodeExecutions: result.nodeExecutions,
      durationMs: result.durationMs
    });

  } catch (error) {
    log.error('[Workflows] Test error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows/:id/toggle
 * Activate or deactivate a workflow
 */
router.post('/:id/toggle', authenticate, validate(schemas.toggle), async (req, res) => {
  try {
    const { id } = req.params;
    const { active } = req.body;

    const { data: workflow, error } = await supabase
      .from('workflows')
      .update({
        active: active !== undefined ? active : null,
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    // If activating, ensure webhooks and schedules are enabled
    if (workflow.active) {
      await supabase
        .from('webhooks')
        .update({ enabled: true })
        .eq('workflow_id', id);

      await supabase
        .from('workflow_schedules')
        .update({ enabled: true })
        .eq('workflow_id', id);
    }

    res.json({
      success: true,
      data: workflow
    });

  } catch (error) {
    log.error('[Workflows] Toggle error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// WORKFLOW VERSIONS
// ========================================

/**
 * GET /api/workflows/:id/versions
 * Get version history for a workflow
 */
router.get('/:id/versions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 20 } = req.query;

    const { data: versions, error } = await supabase
      .from('workflow_versions')
      .select('id, version_number, change_summary, created_at, created_by')
      .eq('workflow_id', id)
      .order('version_number', { ascending: false })
      .limit(limit);

    if (error) throw error;

    res.json({
      success: true,
      data: versions
    });

  } catch (error) {
    log.error('[Workflows] Versions error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workflows/:id/versions/:version
 * Get a specific version
 */
router.get('/:id/versions/:version', authenticate, async (req, res) => {
  try {
    const { id, version } = req.params;

    const { data: versionData, error } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', id)
      .eq('version_number', parseInt(version))
      .single();

    if (error) throw error;
    if (!versionData) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }

    res.json({
      success: true,
      data: versionData
    });

  } catch (error) {
    log.error('[Workflows] Get version error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows/:id/versions/:version/restore
 * Restore a previous version
 */
router.post('/:id/versions/:version/restore', authenticate, async (req, res) => {
  try {
    const { id, version } = req.params;

    // Get the version to restore
    const { data: versionData, error: versionError } = await supabase
      .from('workflow_versions')
      .select('*')
      .eq('workflow_id', id)
      .eq('version_number', parseInt(version))
      .single();

    if (versionError) throw versionError;
    if (!versionData) {
      return res.status(404).json({ success: false, error: 'Version not found' });
    }

    // Update the workflow with the old version's data
    const { data: workflow, error } = await supabase
      .from('workflows')
      .update({
        nodes: versionData.nodes,
        connections: versionData.connections,
        settings: {
          ...versionData.settings,
          change_summary: `Restored from version ${version}`
        },
        updated_at: new Date().toISOString()
      })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data: workflow,
      message: `Restored to version ${version}`
    });

  } catch (error) {
    log.error('[Workflows] Restore error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// WORKFLOW EXECUTIONS
// ========================================

/**
 * GET /api/workflows/:id/executions
 * Get execution history for a workflow
 */
router.get('/:id/executions', authenticate, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, limit = 50, offset = 0 } = req.query;

    let query = supabase
      .from('workflow_executions')
      .select('id, status, mode, started_at, finished_at, duration_ms, error_message, triggered_by', { count: 'exact' })
      .eq('workflow_id', id)
      .order('started_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('status', status);
    }

    const { data: executions, error, count } = await query;

    if (error) throw error;

    res.json({
      success: true,
      data: executions,
      pagination: {
        total: count,
        limit: parseInt(limit),
        offset: parseInt(offset)
      }
    });

  } catch (error) {
    log.error('[Workflows] Executions error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workflows/:workflowId/executions/:executionId
 * Get details of a specific execution
 */
router.get('/:workflowId/executions/:executionId', authenticate, async (req, res) => {
  try {
    const { workflowId, executionId } = req.params;

    const { data: execution, error } = await supabase
      .from('workflow_executions')
      .select('*')
      .eq('id', executionId)
      .eq('workflow_id', workflowId)
      .single();

    if (error) throw error;
    if (!execution) {
      return res.status(404).json({ success: false, error: 'Execution not found' });
    }

    res.json({
      success: true,
      data: execution
    });

  } catch (error) {
    log.error('[Workflows] Get execution error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// NODE OPERATIONS
// ========================================

/**
 * GET /api/workflows/nodes
 * Get all available node types
 */
router.get('/nodes/types', async (req, res) => {
  try {
    const definitions = nodeRegistry.getAllDefinitions();

    // Group by category
    const grouped = {};
    for (const def of definitions) {
      if (!grouped[def.category]) {
        grouped[def.category] = [];
      }
      grouped[def.category].push({
        type: def.type,
        subtype: def.subtype,
        name: def.name,
        description: def.description,
        icon: def.icon,
        inputs: def.inputs,
        outputs: def.outputs
      });
    }

    res.json({
      success: true,
      data: grouped,
      categories: nodeRegistry.getCategories()
    });

  } catch (error) {
    log.error('[Workflows] Node types error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * GET /api/workflows/nodes/:type/:subtype/schema
 * Get configuration schema for a node type
 */
router.get('/nodes/:type/:subtype/schema', async (req, res) => {
  try {
    const { type, subtype } = req.params;

    const definition = nodeRegistry.getDefinition(type, subtype);

    if (!definition) {
      return res.status(404).json({ success: false, error: 'Node type not found' });
    }

    res.json({
      success: true,
      data: {
        type: definition.type,
        subtype: definition.subtype,
        name: definition.name,
        description: definition.description,
        configSchema: definition.configSchema,
        inputs: definition.inputs,
        outputs: definition.outputs
      }
    });

  } catch (error) {
    log.error('[Workflows] Node schema error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * POST /api/workflows/:id/nodes/:nodeId/pin
 * Pin data for a node (development feature)
 */
router.post('/:id/nodes/:nodeId/pin', authenticate, validate(schemas.pin), async (req, res) => {
  try {
    const { id, nodeId } = req.params;
    const { data: pinnedData } = req.body;

    const { data, error } = await supabase
      .from('node_pinned_data')
      .upsert({
        workflow_id: id,
        node_id: nodeId,
        pinned_data: pinnedData,
        pinned_by: req.user?.id,
        pinned_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) throw error;

    res.json({
      success: true,
      data
    });

  } catch (error) {
    log.error('[Workflows] Pin data error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

/**
 * DELETE /api/workflows/:id/nodes/:nodeId/pin
 * Unpin data for a node
 */
router.delete('/:id/nodes/:nodeId/pin', authenticate, async (req, res) => {
  try {
    const { id, nodeId } = req.params;

    const { error } = await supabase
      .from('node_pinned_data')
      .delete()
      .eq('workflow_id', id)
      .eq('node_id', nodeId);

    if (error) throw error;

    res.json({
      success: true,
      message: 'Data unpinned'
    });

  } catch (error) {
    log.error('[Workflows] Unpin data error:', { error: error.message || error });
    res.status(500).json({ success: false, error: error.message });
  }
});

// ========================================
// HELPER FUNCTIONS
// ========================================

/**
 * Validate workflow structure
 */
function validateWorkflow({ nodes, connections }) {
  const errors = [];

  // Check for at least one trigger node
  const triggerNodes = nodes.filter(n => n.type === 'trigger');
  if (triggerNodes.length === 0) {
    errors.push('Workflow must have at least one trigger node');
  }

  // Check node IDs are unique
  const nodeIds = new Set();
  for (const node of nodes) {
    if (!node.id) {
      errors.push('All nodes must have an ID');
    } else if (nodeIds.has(node.id)) {
      errors.push(`Duplicate node ID: ${node.id}`);
    } else {
      nodeIds.add(node.id);
    }
  }

  // Validate connections reference existing nodes
  for (const conn of connections) {
    if (!nodeIds.has(conn.sourceNodeId)) {
      errors.push(`Connection references non-existent source node: ${conn.sourceNodeId}`);
    }
    if (!nodeIds.has(conn.targetNodeId)) {
      errors.push(`Connection references non-existent target node: ${conn.targetNodeId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Create webhooks for webhook trigger nodes
 */
async function createWebhooksForWorkflow(workflow) {
  const webhookNodes = workflow.nodes.filter(n => n.subtype === 'webhook');

  for (const node of webhookNodes) {
    const path = node.config?.path || `wh-${workflow.id.slice(0, 8)}-${node.id.slice(0, 8)}`;

    await supabase
      .from('webhooks')
      .upsert({
        workflow_id: workflow.id,
        node_id: node.id,
        path: path.startsWith('/') ? path : `/${path}`,
        method: node.config?.method || 'POST',
        authentication: node.config?.authentication || { type: 'none' },
        response_mode: node.config?.responseMode || 'immediate',
        enabled: workflow.active
      });
  }
}

/**
 * Update webhooks when workflow changes
 */
async function updateWebhooksForWorkflow(workflow) {
  // Delete existing webhooks
  await supabase
    .from('webhooks')
    .delete()
    .eq('workflow_id', workflow.id);

  // Recreate
  await createWebhooksForWorkflow(workflow);
}

/**
 * Create schedules for schedule trigger nodes
 */
async function createSchedulesForWorkflow(workflow) {
  const scheduleNodes = workflow.nodes.filter(n => n.subtype === 'schedule');

  for (const node of scheduleNodes) {
    if (node.config?.cron) {
      await supabase
        .from('workflow_schedules')
        .upsert({
          workflow_id: workflow.id,
          node_id: node.id,
          cron_expression: node.config.cron,
          timezone: node.config.timezone || 'UTC',
          enabled: workflow.active
        });
    }
  }
}

/**
 * Update schedules when workflow changes
 */
async function updateSchedulesForWorkflow(workflow) {
  // Delete existing schedules
  await supabase
    .from('workflow_schedules')
    .delete()
    .eq('workflow_id', workflow.id);

  // Recreate
  await createSchedulesForWorkflow(workflow);
}

module.exports = router;
