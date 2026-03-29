/**
 * WorkflowExecutor - Graph-based workflow execution engine
 *
 * Executes node-based workflows with support for:
 * - Branching (IF/Switch)
 * - Parallel execution
 * - Sub-workflows
 * - Error handling
 * - Loop/batch processing
 */

const { supabase } = require('../../config/supabase');
const NodeRegistry = require('./NodeRegistry');
const log = require('../../utils/log');

class WorkflowExecutor {
  constructor() {
    this.nodeRegistry = new NodeRegistry();
    this.activeExecutions = new Map();
  }

  /**
   * Execute a workflow
   * @param {Object} workflow - Workflow definition
   * @param {Object} inputData - Trigger data
   * @param {Object} options - Execution options
   * @returns {Object} Execution result
   */
  async execute(workflow, inputData = {}, options = {}) {
    const executionId = options.executionId || this.generateId();
    const mode = options.mode || 'production';

    log.info(`[WorkflowExecutor] Starting execution ${executionId} for workflow "${workflow.name}"`);

    // Create execution record
    const execution = {
      id: executionId,
      workflowId: workflow.id,
      status: 'running',
      mode,
      startedAt: new Date().toISOString(),
      inputData,
      nodeExecutions: [],
      output: null,
      error: null
    };

    this.activeExecutions.set(executionId, execution);

    try {
      // Save execution to database
      await this.saveExecution(execution);

      // Build execution graph
      const graph = this.buildExecutionGraph(workflow);

      // Find trigger node(s)
      const triggerNodes = this.findTriggerNodes(workflow.nodes);

      if (triggerNodes.length === 0) {
        throw new Error('Workflow has no trigger node');
      }

      // Execute from trigger node
      const context = {
        workflow,
        execution,
        inputData,
        nodeOutputs: new Map(),
        mode,
        depth: 0
      };

      // Start execution from trigger nodes
      for (const triggerNode of triggerNodes) {
        await this.executeNode(triggerNode, context, inputData);
      }

      // Get final output (from last executed node or designated output node)
      execution.output = this.collectOutput(context);
      execution.status = 'completed';
      execution.finishedAt = new Date().toISOString();
      execution.durationMs = Date.now() - new Date(execution.startedAt).getTime();

      await this.saveExecution(execution);

      log.info(`[WorkflowExecutor] Execution ${executionId} completed successfully`);

      return {
        success: true,
        executionId,
        output: execution.output,
        nodeExecutions: execution.nodeExecutions,
        durationMs: execution.durationMs
      };

    } catch (error) {
      log.error(`[WorkflowExecutor] Execution ${executionId} failed:`, { error: error.message || error });

      execution.status = 'failed';
      execution.error = error.message;
      execution.errorStack = error.stack;
      execution.finishedAt = new Date().toISOString();
      execution.durationMs = Date.now() - new Date(execution.startedAt).getTime();

      await this.saveExecution(execution);

      // Trigger error workflow if configured
      if (workflow.settings?.errorWorkflowId) {
        await this.triggerErrorWorkflow(workflow, execution, error);
      }

      return {
        success: false,
        executionId,
        error: error.message,
        nodeExecutions: execution.nodeExecutions,
        durationMs: execution.durationMs
      };

    } finally {
      this.activeExecutions.delete(executionId);
    }
  }

  /**
   * Execute a single node
   */
  async executeNode(node, context, inputData) {
    const { execution, workflow, mode } = context;
    const nodeExecution = {
      nodeId: node.id,
      type: node.type,
      subtype: node.subtype,
      status: 'running',
      startedAt: new Date().toISOString(),
      input: inputData
    };

    execution.nodeExecutions.push(nodeExecution);
    execution.currentNodeId = node.id;

    log.info(`[WorkflowExecutor] Executing node ${node.id} (${node.subtype})`);

    try {
      // Check for pinned data in development mode
      if (mode === 'test' || mode === 'development') {
        const pinnedData = await this.getPinnedData(workflow.id, node.id);
        if (pinnedData) {
          log.info(`[WorkflowExecutor] Using pinned data for node ${node.id}`);
          nodeExecution.output = pinnedData;
          nodeExecution.status = 'completed';
          nodeExecution.pinned = true;
          nodeExecution.finishedAt = new Date().toISOString();
          context.nodeOutputs.set(node.id, { output: 'main', data: pinnedData });

          // Continue to connected nodes
          await this.executeConnectedNodes(node, 'main', context, pinnedData);
          return pinnedData;
        }
      }

      // Get the node handler
      const handler = this.nodeRegistry.getHandler(node.type, node.subtype);

      if (!handler) {
        throw new Error(`Unknown node type: ${node.type}/${node.subtype}`);
      }

      // Execute the node
      const result = await handler.execute(node.config, inputData, {
        nodeId: node.id,
        workflowId: workflow.id,
        executionId: execution.id,
        context
      });

      nodeExecution.output = result.data;
      nodeExecution.status = 'completed';
      nodeExecution.finishedAt = new Date().toISOString();

      // Store output for potential merge nodes
      context.nodeOutputs.set(node.id, result);

      // Determine which output branch to follow
      const outputBranch = result.output || 'main';

      // Execute connected nodes based on output branch
      await this.executeConnectedNodes(node, outputBranch, context, result.data);

      return result.data;

    } catch (error) {
      nodeExecution.status = 'failed';
      nodeExecution.error = error.message;
      nodeExecution.finishedAt = new Date().toISOString();

      execution.errorNodeId = node.id;

      // Check if we should stop on error
      if (node.config?.stopOnError !== false) {
        throw error;
      }

      log.warn(`[WorkflowExecutor] Node ${node.id} failed but continuing:`, error.message);
      return null;
    }
  }

  /**
   * Execute nodes connected to a specific output
   */
  async executeConnectedNodes(sourceNode, outputBranch, context, inputData) {
    const { workflow } = context;

    // Find connections from this node's output
    const connections = workflow.connections.filter(
      conn => conn.sourceNodeId === sourceNode.id &&
              (conn.sourceOutput === outputBranch || conn.sourceOutput === 'main')
    );

    if (connections.length === 0) {
      log.info(`[WorkflowExecutor] No connections from node ${sourceNode.id} output "${outputBranch}"`);
      return;
    }

    // Group by target node for potential parallel execution
    const targetNodes = connections.map(conn => {
      return workflow.nodes.find(n => n.id === conn.targetNodeId);
    }).filter(Boolean);

    // Check if target nodes can be executed in parallel
    const canParallel = this.canExecuteInParallel(targetNodes, context);

    if (canParallel && targetNodes.length > 1) {
      // Parallel execution
      log.info(`[WorkflowExecutor] Executing ${targetNodes.length} nodes in parallel`);
      await Promise.all(
        targetNodes.map(targetNode => this.executeNode(targetNode, context, inputData))
      );
    } else {
      // Sequential execution
      for (const targetNode of targetNodes) {
        await this.executeNode(targetNode, context, inputData);
      }
    }
  }

  /**
   * Check if nodes can be executed in parallel
   */
  canExecuteInParallel(nodes, context) {
    // Don't parallelize if any node is a merge node (needs all inputs)
    return !nodes.some(node => node.subtype === 'merge');
  }

  /**
   * Find trigger nodes in workflow
   */
  findTriggerNodes(nodes) {
    return nodes.filter(node => node.type === 'trigger');
  }

  /**
   * Build execution graph from workflow
   */
  buildExecutionGraph(workflow) {
    const graph = {
      nodes: new Map(),
      edges: new Map()
    };

    // Index nodes by ID
    for (const node of workflow.nodes) {
      graph.nodes.set(node.id, node);
    }

    // Index edges by source node
    for (const conn of workflow.connections) {
      if (!graph.edges.has(conn.sourceNodeId)) {
        graph.edges.set(conn.sourceNodeId, []);
      }
      graph.edges.get(conn.sourceNodeId).push(conn);
    }

    return graph;
  }

  /**
   * Collect output from execution
   */
  collectOutput(context) {
    const { execution, workflow } = context;

    // Look for output node
    const outputNode = workflow.nodes.find(n => n.subtype === 'output' || n.subtype === 'respond_webhook');
    if (outputNode && context.nodeOutputs.has(outputNode.id)) {
      return context.nodeOutputs.get(outputNode.id).data;
    }

    // Return last executed node's output
    const lastExecution = execution.nodeExecutions[execution.nodeExecutions.length - 1];
    return lastExecution?.output || {};
  }

  /**
   * Get pinned data for a node
   */
  async getPinnedData(workflowId, nodeId) {
    try {
      const { data, error } = await supabase
        .from('node_pinned_data')
        .select('pinned_data')
        .eq('workflow_id', workflowId)
        .eq('node_id', nodeId)
        .single();

      if (error || !data) return null;
      return data.pinned_data;
    } catch {
      return null;
    }
  }

  /**
   * Save execution to database
   */
  async saveExecution(execution) {
    try {
      const { error } = await supabase
        .from('workflow_executions')
        .upsert({
          id: execution.id,
          workflow_id: execution.workflowId,
          status: execution.status,
          mode: execution.mode,
          started_at: execution.startedAt,
          finished_at: execution.finishedAt,
          duration_ms: execution.durationMs,
          input_data: execution.inputData,
          output_data: execution.output,
          node_executions: execution.nodeExecutions,
          current_node_id: execution.currentNodeId,
          error_message: execution.error,
          error_node_id: execution.errorNodeId,
          error_stack: execution.errorStack,
          retry_count: execution.retryCount || 0,
          triggered_by: execution.triggeredBy,
          user_id: execution.userId
        });

      if (error) {
        log.error('[WorkflowExecutor] Failed to save execution:', { error: error.message || error });
      }
    } catch (err) {
      log.error('[WorkflowExecutor] Error saving execution:', { error: err.message || err });
    }
  }

  /**
   * Trigger error workflow
   */
  async triggerErrorWorkflow(workflow, execution, error) {
    try {
      log.info(`[WorkflowExecutor] Triggering error workflow for ${workflow.id}`);

      const { data: errorWorkflow } = await supabase
        .from('workflows')
        .select('*')
        .eq('id', workflow.settings.errorWorkflowId)
        .single();

      if (!errorWorkflow) {
        log.warn('[WorkflowExecutor] Error workflow not found');
        return;
      }

      // Execute error workflow with error context
      await this.execute(errorWorkflow, {
        error: {
          message: error.message,
          stack: error.stack
        },
        workflow: {
          id: workflow.id,
          name: workflow.name
        },
        execution: {
          id: execution.id,
          startedAt: execution.startedAt,
          failedNodeId: execution.errorNodeId,
          inputData: execution.inputData
        }
      }, {
        mode: 'error_handler',
        triggeredBy: 'error_handler'
      });

    } catch (err) {
      log.error('[WorkflowExecutor] Failed to trigger error workflow:', { error: err.message || err });
    }
  }

  /**
   * Test workflow (dry run)
   */
  async test(workflow, inputData = {}) {
    return this.execute(workflow, inputData, {
      mode: 'test',
      executionId: `test_${this.generateId()}`
    });
  }

  /**
   * Execute a single node for testing
   */
  async testNode(workflow, nodeId, inputData = {}) {
    const node = workflow.nodes.find(n => n.id === nodeId);
    if (!node) {
      throw new Error(`Node not found: ${nodeId}`);
    }

    const context = {
      workflow,
      execution: {
        id: `test_${this.generateId()}`,
        workflowId: workflow.id,
        status: 'running',
        mode: 'test',
        nodeExecutions: []
      },
      inputData,
      nodeOutputs: new Map(),
      mode: 'test',
      depth: 0
    };

    try {
      const result = await this.executeNode(node, context, inputData);
      return { success: true, output: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Get execution status
   */
  getExecutionStatus(executionId) {
    return this.activeExecutions.get(executionId);
  }

  /**
   * Cancel execution
   */
  async cancelExecution(executionId) {
    const execution = this.activeExecutions.get(executionId);
    if (execution) {
      execution.status = 'cancelled';
      execution.finishedAt = new Date().toISOString();
      await this.saveExecution(execution);
      this.activeExecutions.delete(executionId);
      return true;
    }
    return false;
  }

  /**
   * Generate unique ID
   */
  generateId() {
    return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
}

module.exports = WorkflowExecutor;
