/**
 * Agent Orchestrator
 * Coordinates multiple AI agents to work together
 * Week 7: Automations & Basic Agents
 */

const { getAgent, getAllAgents, hasAgent } = require('./agents');
const { supabase } = require('../config/supabase');
const log = require('../utils/log');

class AgentOrchestrator {
  constructor() {
    this.executionLogs = [];
  }

  /**
   * Run a single agent
   */
  async runAgent(agentName, context, automation = {}) {
    const startTime = Date.now();

    try {
      log.info(`Running agent: ${agentName}`);

      const agent = getAgent(agentName);
      if (!agent) {
        throw new Error(`Agent not found: ${agentName}`);
      }

      // Generate suggestion
      const suggestion = await agent.suggest(context, automation);

      const result = {
        agent: agentName,
        suggestion,
        executionTime: Date.now() - startTime,
        success: true
      };

      this.logExecution(result);
      return result;

    } catch (error) {
      log.error(`Agent error (${agentName}):`, { error: error.message || error });

      const result = {
        agent: agentName,
        error: error.message,
        executionTime: Date.now() - startTime,
        success: false
      };

      this.logExecution(result);
      return result;
    }
  }

  /**
   * Run multiple agents in sequence, passing context between them
   */
  async orchestrate(agentNames, context, automation = {}) {
    log.info(`Orchestrating ${agentNames.length} agents`);
    const startTime = Date.now();

    const results = {
      agents: [],
      aggregated: {},
      totalTime: 0,
      success: true
    };

    // Build up context as we go
    let enrichedContext = { ...context };

    for (const agentName of agentNames) {
      const agentResult = await this.runAgent(agentName, enrichedContext, automation);
      results.agents.push(agentResult);

      if (!agentResult.success) {
        results.success = false;
        continue;
      }

      // Add suggestion to aggregated results
      results.aggregated[agentName] = agentResult.suggestion;

      // Enrich context for next agent
      if (agentResult.suggestion) {
        switch (agentName) {
          case 'assignment':
            enrichedContext.assignedTo = agentResult.suggestion.recommended;
            break;
          case 'priority':
            enrichedContext.priority = agentResult.suggestion.recommended;
            break;
          case 'deadline':
            enrichedContext.dueDate = agentResult.suggestion.recommended;
            break;
        }
      }
    }

    results.totalTime = Date.now() - startTime;
    log.info(`Orchestration complete in ${results.totalTime}ms`);

    return results;
  }

  /**
   * Run agents in parallel (when they don't depend on each other)
   */
  async orchestrateParallel(agentNames, context, automation = {}) {
    log.info(`Orchestrating ${agentNames.length} agents in parallel`);
    const startTime = Date.now();

    const promises = agentNames.map(agentName =>
      this.runAgent(agentName, context, automation)
    );

    const agentResults = await Promise.all(promises);

    const results = {
      agents: agentResults,
      aggregated: {},
      totalTime: Date.now() - startTime,
      success: agentResults.every(r => r.success)
    };

    // Aggregate results
    for (const result of agentResults) {
      if (result.success && result.suggestion) {
        results.aggregated[result.agent] = result.suggestion;
      }
    }

    log.info(`Parallel orchestration complete in ${results.totalTime}ms`);
    return results;
  }

  /**
   * Process a meeting with all relevant agents
   */
  async processMeetingWithAgents(meeting, actionItems) {
    log.info(`Processing meeting with agents: ${meeting.id}`);

    const results = {
      meeting: meeting.id,
      actionItems: [],
      totalTime: 0
    };

    const startTime = Date.now();

    // Process each action item with agents
    for (const item of actionItems) {
      const context = {
        task: item.task_description,
        meetingTitle: meeting.title,
        meetingDate: meeting.created_at,
        sentiment: meeting.sentiment_label,
        priority: item.priority,
        actionItemId: item.id,
        team: [] // Would come from user's team settings
      };

      // Run priority and deadline agents in parallel (they don't depend on each other)
      const suggestions = await this.orchestrateParallel(
        ['priority', 'deadline'],
        context
      );

      results.actionItems.push({
        id: item.id,
        original: {
          task: item.task_description,
          priority: item.priority,
          dueDate: item.due_date
        },
        suggestions: suggestions.aggregated
      });
    }

    results.totalTime = Date.now() - startTime;
    log.info(`Meeting processed with agents in ${results.totalTime}ms`);

    return results;
  }

  /**
   * Apply agent suggestions to action items
   */
  async applyAgentSuggestions(actionItemId, suggestions, options = {}) {
    log.info(`Applying agent suggestions to action item: ${actionItemId}`);

    if (!supabase) {
      return { applied: false, reason: 'Database not configured' };
    }

    const updates = {};

    // Apply priority suggestion
    if (suggestions.priority?.recommended && options.applyPriority !== false) {
      updates.priority = suggestions.priority.recommended;
    }

    // Apply deadline suggestion
    if (suggestions.deadline?.recommended && options.applyDeadline !== false) {
      updates.due_date = suggestions.deadline.recommended;
    }

    // Apply assignment suggestion
    if (suggestions.assignment?.recommended && options.applyAssignment !== false) {
      updates.assigned_to_name = suggestions.assignment.recommended;
    }

    if (Object.keys(updates).length === 0) {
      return { applied: false, reason: 'No suggestions to apply' };
    }

    updates.updated_at = new Date().toISOString();

    try {
      const { data, error } = await supabase
        .from('action_items')
        .update(updates)
        .eq('id', actionItemId)
        .select()
        .single();

      if (error) throw error;

      log.info(`Applied suggestions to action item: ${actionItemId}`);
      return { applied: true, updates, data };

    } catch (error) {
      log.error('Failed to apply suggestions:', { error: error.message || error });
      return { applied: false, error: error.message };
    }
  }

  /**
   * Get available agents
   */
  getAvailableAgents() {
    return getAllAgents();
  }

  /**
   * Log execution for debugging
   */
  logExecution(result) {
    this.executionLogs.push({
      ...result,
      timestamp: new Date().toISOString()
    });

    // Keep only last 100 logs in memory
    if (this.executionLogs.length > 100) {
      this.executionLogs = this.executionLogs.slice(-100);
    }
  }

  /**
   * Get recent execution logs
   */
  getExecutionLogs(limit = 20) {
    return this.executionLogs.slice(-limit).reverse();
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.executionLogs = [];
  }
}

module.exports = new AgentOrchestrator();
