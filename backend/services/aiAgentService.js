/**
 * AI Agent Service
 * Autonomous agents that listen, decide, and act
 */

const { supabase } = require('../config/supabase');
const geminiService = require('../config/gemini');
const crmService = require('./crmService');
const chatService = require('./chatService');
const automationEngine = require('./automationEngine');

class AIAgent {
  constructor(agentData) {
    this.id = agentData.id;
    this.name = agentData.name;
    this.description = agentData.description;
    this.agentType = agentData.agent_type;
    this.triggers = agentData.triggers || [];
    this.actions = agentData.actions || [];
    this.memory = agentData.memory || {};
    this.config = agentData.config || {};
    this.enabled = agentData.enabled;
  }

  /**
   * Execute the agent with given context
   */
  async execute(triggerEvent) {
    const startTime = Date.now();
    const execution = {
      agent_id: this.id,
      trigger_event: triggerEvent,
      trigger_type: triggerEvent.type,
      context_gathered: {},
      decisions: [],
      actions_executed: [],
      success: true,
      error_message: null
    };

    try {
      console.log(`🤖 Agent "${this.name}" executing...`);

      // Step 1: Gather context
      execution.context_gathered = await this.gatherContext(triggerEvent);

      // Step 2: Make decisions using AI
      execution.decisions = await this.makeDecisions(execution.context_gathered, triggerEvent);

      // Step 3: Execute decided actions
      for (const decision of execution.decisions) {
        if (decision.shouldExecute) {
          const result = await this.executeAction(decision.action, {
            ...triggerEvent.data,
            ...execution.context_gathered
          });
          execution.actions_executed.push({
            action: decision.action,
            reasoning: decision.reasoning,
            result
          });
        }
      }

      // Step 4: Update memory for learning
      await this.updateMemory(triggerEvent, execution);

      // Step 5: Update agent stats
      await this.updateStats(true);

      execution.duration_ms = Date.now() - startTime;
      await this.logExecution(execution);

      return {
        success: true,
        agent: this.name,
        actionsExecuted: execution.actions_executed.length,
        decisions: execution.decisions
      };

    } catch (error) {
      console.error(`Agent "${this.name}" error:`, error);
      execution.success = false;
      execution.error_message = error.message;
      execution.duration_ms = Date.now() - startTime;

      await this.logExecution(execution);
      await this.updateStats(false);

      return {
        success: false,
        agent: this.name,
        error: error.message
      };
    }
  }

  /**
   * Gather relevant context for decision making
   */
  async gatherContext(triggerEvent) {
    const context = {
      timestamp: new Date().toISOString(),
      triggerType: triggerEvent.type,
      triggerData: triggerEvent.data
    };

    try {
      // Gather context based on trigger type
      switch (triggerEvent.type) {
        case 'deal_created':
        case 'deal_updated':
          // Get deal details from CRM
          const crmDeals = await crmService.getDeals(5);
          context.recentDeals = crmDeals.deals;
          break;

        case 'meeting_ended':
        case 'meeting_processed':
          // Get meeting context
          if (triggerEvent.data.meeting_id) {
            const { data: meeting } = await supabase
              .from('meetings')
              .select('*, action_items(*)')
              .eq('id', triggerEvent.data.meeting_id)
              .single();
            context.meeting = meeting;
          }
          break;

        case 'task_completed':
        case 'task_overdue':
          // Get task and project context
          if (triggerEvent.data.task_id) {
            const { data: task } = await supabase
              .from('tasks')
              .select('*, projects(*)')
              .eq('id', triggerEvent.data.task_id)
              .single();
            context.task = task;
          }
          break;
      }

      // Get agent's past decisions from memory
      context.pastDecisions = this.memory.recentDecisions || [];

    } catch (error) {
      console.error('Context gathering error:', error);
    }

    return context;
  }

  /**
   * Use AI to make decisions based on context
   */
  async makeDecisions(context, triggerEvent) {
    const decisions = [];

    // Build decision prompt
    const prompt = this.buildDecisionPrompt(context, triggerEvent);

    try {
      // Ask Gemini to analyze and decide
      const response = await geminiService.generateContent(prompt);
      const aiDecisions = this.parseAIDecisions(response);

      // Map AI decisions to actions
      for (const aiDecision of aiDecisions) {
        const action = this.actions.find(a => a.type === aiDecision.actionType);
        if (action) {
          decisions.push({
            action: { ...action, ...aiDecision.config },
            shouldExecute: aiDecision.confidence > 0.7,
            reasoning: aiDecision.reasoning,
            confidence: aiDecision.confidence
          });
        }
      }

    } catch (error) {
      console.error('AI decision error:', error);
      // Fall back to rule-based decisions
      decisions.push(...this.makeRuleBasedDecisions(context, triggerEvent));
    }

    return decisions;
  }

  /**
   * Build prompt for AI decision making
   */
  buildDecisionPrompt(context, triggerEvent) {
    return `
You are an AI agent named "${this.name}".
Your purpose: ${this.description}

Available actions you can take:
${this.actions.map(a => `- ${a.type}: ${a.description || a.type}`).join('\n')}

Current trigger event:
- Type: ${triggerEvent.type}
- Data: ${JSON.stringify(triggerEvent.data, null, 2)}

Context gathered:
${JSON.stringify(context, null, 2)}

Past decisions (for consistency):
${JSON.stringify(this.memory.recentDecisions?.slice(-5) || [], null, 2)}

Based on this information, decide which actions to take.
For each action, provide:
1. Action type (from available actions)
2. Confidence score (0-1)
3. Reasoning (brief explanation)
4. Any configuration overrides

Respond in JSON format:
{
  "decisions": [
    {
      "actionType": "action_name",
      "confidence": 0.95,
      "reasoning": "Brief explanation",
      "config": {}
    }
  ]
}
`;
  }

  /**
   * Parse AI response into decisions
   */
  parseAIDecisions(response) {
    try {
      // Extract JSON from response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        return parsed.decisions || [];
      }
    } catch (error) {
      console.error('Failed to parse AI decisions:', error);
    }
    return [];
  }

  /**
   * Fallback rule-based decisions
   */
  makeRuleBasedDecisions(context, triggerEvent) {
    const decisions = [];

    // Execute all configured actions by default
    for (const action of this.actions) {
      // Check action conditions if present
      let shouldExecute = true;

      if (action.conditions) {
        for (const condition of action.conditions) {
          const value = this.getNestedValue(triggerEvent.data, condition.field);
          shouldExecute = shouldExecute && this.evaluateCondition(condition, value);
        }
      }

      decisions.push({
        action,
        shouldExecute,
        reasoning: 'Rule-based decision',
        confidence: 1.0
      });
    }

    return decisions;
  }

  /**
   * Execute a single action
   */
  async executeAction(action, data) {
    return automationEngine.executeAction(action, data);
  }

  /**
   * Update agent memory for learning
   */
  async updateMemory(triggerEvent, execution) {
    // Add to recent decisions
    const recentDecisions = this.memory.recentDecisions || [];
    recentDecisions.push({
      timestamp: new Date().toISOString(),
      trigger: triggerEvent.type,
      decisions: execution.decisions.map(d => ({
        action: d.action.type,
        executed: d.shouldExecute,
        success: execution.success
      }))
    });

    // Keep only last 100 decisions
    this.memory.recentDecisions = recentDecisions.slice(-100);

    // Update success patterns
    if (!this.memory.patterns) {
      this.memory.patterns = {};
    }

    const patternKey = `${triggerEvent.type}_${execution.success}`;
    this.memory.patterns[patternKey] = (this.memory.patterns[patternKey] || 0) + 1;

    // Save memory to database
    await supabase
      .from('ai_agents')
      .update({ memory: this.memory, updated_at: new Date().toISOString() })
      .eq('id', this.id);
  }

  /**
   * Update agent statistics
   */
  async updateStats(success) {
    const { data: agent } = await supabase
      .from('ai_agents')
      .select('execution_count, success_rate')
      .eq('id', this.id)
      .single();

    if (agent) {
      const newCount = (agent.execution_count || 0) + 1;
      const oldSuccessRate = agent.success_rate || 0;
      const newSuccessRate = ((oldSuccessRate * (newCount - 1)) + (success ? 1 : 0)) / newCount;

      await supabase
        .from('ai_agents')
        .update({
          execution_count: newCount,
          success_rate: newSuccessRate,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', this.id);
    }
  }

  /**
   * Log execution to database
   */
  async logExecution(execution) {
    await supabase.from('agent_executions').insert(execution);
  }

  /**
   * Helper: Get nested value from object
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Helper: Evaluate condition
   */
  evaluateCondition(condition, value) {
    switch (condition.operator) {
      case 'equals':
      case 'eq':
        return value === condition.value;
      case 'not_equals':
      case 'ne':
        return value !== condition.value;
      case 'greater_than':
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'less_than':
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(condition.value);
      case 'exists':
        return value !== undefined && value !== null;
      default:
        return true;
    }
  }
}

/**
 * AI Agent Service - Manages all agents
 */
class AIAgentService {
  constructor() {
    this.predefinedAgents = this.getPredefinedAgents();
  }

  /**
   * Get pre-defined agent templates
   */
  getPredefinedAgents() {
    return [
      {
        id: 'deal-kickoff-coordinator',
        name: 'Deal Kickoff Coordinator',
        description: 'Automatically sets up projects, tasks, and notifications when a new high-value deal is created',
        agent_type: 'predefined',
        icon: 'rocket',
        triggers: [
          {
            type: 'deal_created',
            conditions: [
              { field: 'deal_value', operator: 'gt', value: 50000 }
            ]
          }
        ],
        actions: [
          {
            type: 'create_project',
            description: 'Create implementation project',
            config: {
              name: '{{deal_name}} - Implementation',
              description: 'Project created from deal: {{deal_name}}'
            }
          },
          {
            type: 'create_task',
            description: 'Schedule kickoff meeting',
            config: {
              title: 'Schedule kickoff meeting with {{contact_name}}',
              priority: 'high',
              due_in_days: 2
            }
          },
          {
            type: 'create_task',
            description: 'Prepare discovery questions',
            config: {
              title: 'Prepare discovery questions for {{deal_name}}',
              priority: 'medium',
              due_in_days: 1
            }
          },
          {
            type: 'post_to_chat',
            description: 'Announce new deal',
            config: {
              message: '🎉 New deal created: {{deal_name}} (${{deal_value}}) - Kickoff scheduled!'
            }
          }
        ]
      },
      {
        id: 'meeting-followup-bot',
        name: 'Meeting Follow-up Bot',
        description: 'Sends recaps, creates tasks from action items, and tracks completion after meetings',
        agent_type: 'predefined',
        icon: 'message-circle',
        triggers: [
          { type: 'meeting_processed' }
        ],
        actions: [
          {
            type: 'sync_to_crm',
            description: 'Sync action items to CRM'
          },
          {
            type: 'post_to_chat',
            description: 'Post meeting recap to team channel'
          },
          {
            type: 'create_task',
            description: 'Create follow-up reminder',
            config: {
              title: 'Follow up on meeting: {{meeting_title}}',
              priority: 'medium',
              due_in_days: 3
            }
          }
        ]
      },
      {
        id: 'project-health-monitor',
        name: 'Project Health Monitor',
        description: 'Monitors project health and alerts on delays, budget overruns, or risks',
        agent_type: 'predefined',
        icon: 'activity',
        triggers: [
          { type: 'task_overdue' },
          { type: 'scheduled', config: { schedule: '0 9 * * 1' } } // Monday 9am
        ],
        actions: [
          {
            type: 'post_to_chat',
            description: 'Alert on overdue tasks',
            config: {
              message: '⚠️ Project alert: {{task_count}} overdue tasks in {{project_name}}'
            }
          },
          {
            type: 'create_task',
            description: 'Create escalation task',
            config: {
              title: 'Review overdue items in {{project_name}}',
              priority: 'high',
              due_in_days: 1
            }
          }
        ]
      },
      {
        id: 'lead-nurture-agent',
        name: 'Lead Nurture Agent',
        description: 'Tracks leads, schedules follow-ups, and suggests content to share',
        agent_type: 'predefined',
        icon: 'user-plus',
        triggers: [
          { type: 'deal_created', conditions: [{ field: 'stage', operator: 'equals', value: 'lead' }] }
        ],
        actions: [
          {
            type: 'create_task',
            description: 'Initial follow-up call',
            config: {
              title: 'Initial follow-up call with {{contact_name}}',
              priority: 'high',
              due_in_days: 1
            }
          },
          {
            type: 'create_task',
            description: 'Send introduction email',
            config: {
              title: 'Send introduction email to {{contact_email}}',
              priority: 'medium',
              due_in_days: 0
            }
          }
        ]
      },
      {
        id: 'sales-forecast-agent',
        name: 'Sales Forecast Agent',
        description: 'Analyzes deal pipeline and predicts revenue, identifies at-risk deals',
        agent_type: 'predefined',
        icon: 'trending-up',
        triggers: [
          { type: 'scheduled', config: { schedule: '0 8 * * 5' } } // Friday 8am
        ],
        actions: [
          {
            type: 'post_to_chat',
            description: 'Weekly forecast summary',
            config: {
              message: '📊 Weekly Sales Forecast:\n- Pipeline: ${{pipeline_value}}\n- Forecast: ${{forecast_value}}\n- At-risk: {{at_risk_count}} deals'
            }
          }
        ]
      }
    ];
  }

  /**
   * Trigger agents for an event
   */
  async trigger(triggerType, triggerData) {
    console.log(`🤖 AI Agent trigger: ${triggerType}`);

    try {
      // Find enabled agents for this trigger
      const { data: agents, error } = await supabase
        .from('ai_agents')
        .select('*')
        .eq('enabled', true);

      if (error) throw error;

      const matchingAgents = agents.filter(agent => {
        return agent.triggers.some(t => {
          if (t.type !== triggerType) return false;

          // Check conditions
          if (t.conditions) {
            for (const condition of t.conditions) {
              const value = this.getNestedValue(triggerData, condition.field);
              if (!this.evaluateCondition(condition, value)) {
                return false;
              }
            }
          }
          return true;
        });
      });

      if (matchingAgents.length === 0) {
        console.log(`No agents matched trigger: ${triggerType}`);
        return { executed: 0, results: [] };
      }

      console.log(`Found ${matchingAgents.length} agents to execute`);

      // Execute each agent
      const results = [];
      for (const agentData of matchingAgents) {
        const agent = new AIAgent(agentData);
        const result = await agent.execute({ type: triggerType, data: triggerData });
        results.push(result);
      }

      return { executed: results.length, results };

    } catch (error) {
      console.error('AI Agent trigger error:', error);
      return { executed: 0, error: error.message };
    }
  }

  /**
   * Create a new agent
   */
  async createAgent(agentData, userId) {
    const { data, error } = await supabase
      .from('ai_agents')
      .insert({
        name: agentData.name,
        description: agentData.description,
        agent_type: agentData.agent_type || 'custom',
        icon: agentData.icon || 'bot',
        triggers: agentData.triggers || [],
        actions: agentData.actions || [],
        config: agentData.config || {},
        enabled: agentData.enabled !== false,
        created_by: userId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Create agent from predefined template
   */
  async createFromTemplate(templateId, userId, customizations = {}) {
    const template = this.predefinedAgents.find(a => a.id === templateId);
    if (!template) {
      throw new Error(`Template not found: ${templateId}`);
    }

    const agentData = {
      ...template,
      ...customizations,
      agent_type: 'predefined'
    };

    return this.createAgent(agentData, userId);
  }

  /**
   * Get agent by ID
   */
  async getAgent(agentId) {
    const { data, error } = await supabase
      .from('ai_agents')
      .select('*')
      .eq('id', agentId)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * List all agents
   */
  async listAgents(filters = {}) {
    let query = supabase.from('ai_agents').select('*');

    if (filters.enabled !== undefined) {
      query = query.eq('enabled', filters.enabled);
    }
    if (filters.agent_type) {
      query = query.eq('agent_type', filters.agent_type);
    }
    if (filters.team_id) {
      query = query.eq('team_id', filters.team_id);
    }

    const { data, error } = await query.order('created_at', { ascending: false });

    if (error) throw error;
    return data;
  }

  /**
   * Update agent
   */
  async updateAgent(agentId, updates) {
    const { data, error } = await supabase
      .from('ai_agents')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', agentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Delete agent
   */
  async deleteAgent(agentId) {
    const { error } = await supabase
      .from('ai_agents')
      .delete()
      .eq('id', agentId);

    if (error) throw error;
    return { success: true };
  }

  /**
   * Toggle agent enabled status
   */
  async toggleAgent(agentId) {
    const agent = await this.getAgent(agentId);
    return this.updateAgent(agentId, { enabled: !agent.enabled });
  }

  /**
   * Get agent execution logs
   */
  async getExecutionLogs(agentId, limit = 50) {
    const { data, error } = await supabase
      .from('agent_executions')
      .select('*')
      .eq('agent_id', agentId)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) throw error;
    return data;
  }

  /**
   * Provide feedback on agent execution
   */
  async provideFeedback(executionId, rating, notes) {
    const { data, error } = await supabase
      .from('agent_executions')
      .update({
        feedback_rating: rating,
        feedback_notes: notes
      })
      .eq('id', executionId)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Helper methods
   */
  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  evaluateCondition(condition, value) {
    switch (condition.operator) {
      case 'equals':
      case 'eq':
        return value === condition.value;
      case 'gt':
        return Number(value) > Number(condition.value);
      case 'lt':
        return Number(value) < Number(condition.value);
      case 'contains':
        return String(value).includes(condition.value);
      default:
        return true;
    }
  }
}

module.exports = new AIAgentService();
