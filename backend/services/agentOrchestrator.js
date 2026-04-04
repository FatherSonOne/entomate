/**
 * Agent Orchestrator
 * Coordinates multiple AI agents to work together
 * Features: guardrails, idempotency, DB-persisted logs
 */

const { getAgent, getAllAgents, hasAgent } = require('./agents');
const { supabase, supabaseAdmin } = require('../config/supabase');
const log = require('../utils/log');

// Use admin client to bypass RLS for server-side orchestration
const db = supabaseAdmin || supabase;

// Guardrail limits (ported from TS agent framework)
const GUARDRAILS = {
  maxActionsPerRun: 25,
  maxPulseMessagesPerRun: 3,
  maxCrmTasksPerRun: 10
};

class AgentOrchestrator {
  constructor() {
    this.executionLogs = []; // In-memory fallback
    this._agentIdCache = {};
    this._runActionCount = 0;
  }

  /**
   * Resolve an agent name to its DB UUID (cached)
   */
  async _resolveAgentDbId(agentName) {
    if (this._agentIdCache[agentName]) {
      return this._agentIdCache[agentName];
    }

    if (!db) return null;

    try {
      const { data } = await db
        .from('agents')
        .select('id')
        .ilike('name', `%${agentName}%`)
        .limit(1)
        .single();

      if (data?.id) {
        this._agentIdCache[agentName] = data.id;
        return data.id;
      }
    } catch (error) {
      // Agent may not exist in DB yet — that's fine
    }
    return null;
  }

  /**
   * Check idempotency — has this trigger already been processed?
   */
  async _checkIdempotency(agentName, triggerEventId) {
    if (!triggerEventId || !db) return false;

    try {
      const agentDbId = await this._resolveAgentDbId(agentName);
      if (!agentDbId) return false;

      const { data } = await db
        .from('agent_runs')
        .select('id')
        .eq('agent_id', agentDbId)
        .eq('trigger_event_id', triggerEventId)
        .eq('status', 'success')
        .limit(1);

      return (data?.length || 0) > 0;
    } catch (error) {
      log.error('Idempotency check failed:', { error: error.message || error });
      return false;
    }
  }

  /**
   * Enforce guardrails — throw if limits exceeded
   */
  _checkGuardrails() {
    if (this._runActionCount >= GUARDRAILS.maxActionsPerRun) {
      throw new Error(`Guardrail exceeded: maxActionsPerRun (${this._runActionCount}/${GUARDRAILS.maxActionsPerRun})`);
    }
  }

  /**
   * Run a single agent
   */
  async runAgent(agentName, context, automation = {}) {
    const startTime = Date.now();

    try {
      // Guardrail check
      this._checkGuardrails();
      this._runActionCount++;

      // Idempotency check
      if (context.triggerEventId) {
        const alreadyRan = await this._checkIdempotency(agentName, context.triggerEventId);
        if (alreadyRan) {
          log.info(`Skipping agent ${agentName}: already ran for ${context.triggerEventId}`);
          const result = {
            agent: agentName,
            skipped: true,
            reason: 'Already ran successfully for this trigger event',
            executionTime: Date.now() - startTime,
            success: true
          };
          await this._persistLog(result);
          return result;
        }
      }

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

      await this._persistLog(result);
      return result;

    } catch (error) {
      log.error(`Agent error (${agentName}):`, { error: error.message || error });

      const result = {
        agent: agentName,
        error: error.message,
        executionTime: Date.now() - startTime,
        success: false
      };

      await this._persistLog(result);
      return result;
    }
  }

  /**
   * Run multiple agents in sequence, passing context between them
   */
  async orchestrate(agentNames, context, automation = {}) {
    log.info(`Orchestrating ${agentNames.length} agents`);
    const startTime = Date.now();
    this._runActionCount = 0; // Reset guardrail counter

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
    this._runActionCount = 0; // Reset guardrail counter

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
        triggerEventId: `meeting:${meeting.id}:item:${item.id}`,
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
   * Persist execution log to DB + in-memory fallback
   */
  async _persistLog(result) {
    const logEntry = {
      ...result,
      timestamp: new Date().toISOString()
    };

    // In-memory fallback (always available)
    this.executionLogs.push(logEntry);
    if (this.executionLogs.length > 100) {
      this.executionLogs = this.executionLogs.slice(-100);
    }

    // Persist to agent_runs table
    if (!db) return;

    try {
      const agentDbId = await this._resolveAgentDbId(result.agent);
      if (!agentDbId) return; // No DB record for this agent

      await db
        .from('agent_runs')
        .insert({
          agent_id: agentDbId,
          status: result.skipped ? 'skipped' : (result.success ? 'success' : 'failed'),
          trigger_event_id: null,
          input: { agent: result.agent, context: 'orchestrator' },
          output: result.suggestion ? { suggestion: result.suggestion } : null,
          error: result.error || null,
          attempt: 1,
          finished_at: new Date().toISOString()
        });
    } catch (error) {
      // DB persistence is best-effort; don't break the orchestrator
      log.error('Failed to persist orchestrator log:', { error: error.message || error });
    }
  }

  /**
   * Get recent execution logs (from DB with in-memory fallback)
   */
  async getExecutionLogs(limit = 20) {
    if (!db) {
      return this.executionLogs.slice(-limit).reverse();
    }

    try {
      const { data, error } = await db
        .from('agent_runs')
        .select('id, agent_id, status, trigger_event_id, input, output, error, attempt, started_at, finished_at')
        .order('started_at', { ascending: false })
        .limit(limit);

      if (error) throw error;
      return data || [];
    } catch (error) {
      log.error('Failed to read orchestrator logs from DB:', { error: error.message || error });
      return this.executionLogs.slice(-limit).reverse();
    }
  }

  /**
   * Clear execution logs
   */
  clearLogs() {
    this.executionLogs = [];
  }
}

module.exports = new AgentOrchestrator();
