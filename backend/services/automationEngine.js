/**
 * Automation Engine Service
 * Executes trigger-based workflows
 */

const { supabase } = require('../config/supabase');
const crmService = require('./crmService');
const chatService = require('./chatService');
const geminiService = require('../config/gemini');
const agentOrchestrator = require('./agentOrchestrator');

class AutomationEngine {
  constructor() {
    this.actionHandlers = {
      'create_task': this.handleCreateTask.bind(this),
      'create_crm_task': this.handleCreateCRMTask.bind(this),
      'sync_to_crm': this.handleSyncToCRM.bind(this),
      'post_to_chat': this.handlePostToChat.bind(this),
      'send_notification': this.handleSendNotification.bind(this),
      'create_project': this.handleCreateProject.bind(this),
      'update_status': this.handleUpdateStatus.bind(this),
      'extract_action_items': this.handleExtractActionItems.bind(this),
      'generate_summary': this.handleGenerateSummary.bind(this),
      'send_email': this.handleSendEmail.bind(this),
      // Slack webhook action
      'send_slack': this.handleSendSlack.bind(this),
      // Agent-based actions
      'run_agent': this.handleRunAgent.bind(this),
      'auto_assign': this.handleAutoAssign.bind(this),
      'auto_prioritize': this.handleAutoPrioritize.bind(this),
      'suggest_deadline': this.handleSuggestDeadline.bind(this),
      'detect_followups': this.handleDetectFollowups.bind(this)
    };

    // Retry configuration
    this.retryConfig = {
      maxRetries: 3,
      retryDelay: 1000, // ms
      retryableActions: ['sync_to_crm', 'post_to_chat', 'send_slack', 'send_email']
    };
  }

  /**
   * Execute action with retry logic
   */
  async executeWithRetry(action, triggerData, attempt = 1) {
    try {
      const result = await this.executeAction(action, triggerData);

      if (!result.success && this.retryConfig.retryableActions.includes(action.type)) {
        if (attempt < this.retryConfig.maxRetries) {
          console.log(`Retrying action ${action.type}, attempt ${attempt + 1}/${this.retryConfig.maxRetries}`);
          await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelay * attempt));
          return this.executeWithRetry(action, triggerData, attempt + 1);
        }
      }

      return { ...result, attempts: attempt };
    } catch (error) {
      if (attempt < this.retryConfig.maxRetries && this.retryConfig.retryableActions.includes(action.type)) {
        console.log(`Retrying action ${action.type} after error, attempt ${attempt + 1}/${this.retryConfig.maxRetries}`);
        await new Promise(resolve => setTimeout(resolve, this.retryConfig.retryDelay * attempt));
        return this.executeWithRetry(action, triggerData, attempt + 1);
      }
      return { success: false, error: error.message, attempts: attempt };
    }
  }

  /**
   * Trigger automations for an event
   */
  async trigger(triggerType, triggerData) {
    console.log(`🤖 Automation triggered: ${triggerType}`);

    try {
      // Find enabled automations for this trigger
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('enabled', true);

      if (error) throw error;

      if (!automations || automations.length === 0) {
        console.log(`No automations found for trigger: ${triggerType}`);
        return { executed: 0, results: [] };
      }

      console.log(`Found ${automations.length} automations to execute`);

      // Execute each automation
      const results = [];
      for (const automation of automations) {
        const result = await this.execute(automation, triggerData);
        results.push(result);
      }

      return { executed: results.length, results };
    } catch (error) {
      console.error('Automation trigger error:', error);
      return { executed: 0, error: error.message };
    }
  }

  /**
   * Execute a single automation
   */
  async execute(automation, triggerData) {
    const startTime = Date.now();
    const executionLog = {
      automation_id: automation.id,
      triggered_at: new Date().toISOString(),
      trigger_data: triggerData,
      actions_executed: [],
      success: true,
      error_message: null
    };

    try {
      console.log(`Executing automation: ${automation.name}`);

      // Check conditions if present
      if (automation.trigger_config?.conditions) {
        const conditionsMet = this.evaluateConditions(
          automation.trigger_config.conditions,
          triggerData
        );
        if (!conditionsMet) {
          console.log(`Conditions not met for automation: ${automation.name}`);
          executionLog.success = true;
          executionLog.error_message = 'Conditions not met';
          await this.logExecution(executionLog, startTime);
          return { automation: automation.name, skipped: true, reason: 'Conditions not met' };
        }
      }

      // Execute each action (with retry for retryable actions)
      for (const action of automation.actions) {
        const isRetryable = this.retryConfig.retryableActions.includes(action.type);
        const actionResult = isRetryable
          ? await this.executeWithRetry(action, triggerData)
          : await this.executeAction(action, triggerData);

        executionLog.actions_executed.push({
          type: action.type,
          success: actionResult.success,
          result: actionResult,
          attempts: actionResult.attempts || 1
        });

        if (!actionResult.success && action.stopOnFailure) {
          throw new Error(`Action ${action.type} failed: ${actionResult.error}`);
        }
      }

      // Update automation stats
      await supabase
        .from('automations')
        .update({
          execution_count: automation.execution_count + 1,
          last_executed_at: new Date().toISOString()
        })
        .eq('id', automation.id);

      await this.logExecution(executionLog, startTime);

      return {
        automation: automation.name,
        success: true,
        actionsExecuted: executionLog.actions_executed.length
      };

    } catch (error) {
      console.error(`Automation execution error:`, error);
      executionLog.success = false;
      executionLog.error_message = error.message;
      await this.logExecution(executionLog, startTime);

      return {
        automation: automation.name,
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Evaluate trigger conditions
   */
  evaluateConditions(conditions, data) {
    for (const condition of conditions) {
      const value = this.getNestedValue(data, condition.field);

      switch (condition.operator) {
        case 'equals':
          if (value !== condition.value) return false;
          break;
        case 'not_equals':
          if (value === condition.value) return false;
          break;
        case 'contains':
          if (!String(value).includes(condition.value)) return false;
          break;
        case 'greater_than':
          if (Number(value) <= Number(condition.value)) return false;
          break;
        case 'less_than':
          if (Number(value) >= Number(condition.value)) return false;
          break;
        case 'exists':
          if (value === undefined || value === null) return false;
          break;
        case 'not_exists':
          if (value !== undefined && value !== null) return false;
          break;
        default:
          console.warn(`Unknown operator: ${condition.operator}`);
      }
    }
    return true;
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((curr, key) => curr?.[key], obj);
  }

  /**
   * Execute a single action
   */
  async executeAction(action, triggerData) {
    const handler = this.actionHandlers[action.type];

    if (!handler) {
      console.warn(`Unknown action type: ${action.type}`);
      return { success: false, error: `Unknown action type: ${action.type}` };
    }

    return handler(action.config || {}, triggerData);
  }

  /**
   * Action Handlers
   */

  async handleCreateTask(config, data) {
    try {
      const { data: task, error } = await supabase
        .from('tasks')
        .insert({
          title: this.interpolate(config.title, data),
          description: this.interpolate(config.description, data),
          project_id: config.project_id || data.project_id,
          assigned_to: config.assigned_to || data.assigned_to,
          priority: config.priority || 'medium',
          status: 'open',
          due_date: config.due_date || this.calculateDueDate(config.due_in_days)
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, taskId: task.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleCreateCRMTask(config, data) {
    const taskData = {
      title: this.interpolate(config.title, data),
      description: this.interpolate(config.description, data),
      priority: config.priority || data.priority || 'medium',
      due_date: config.due_date || data.due_date,
      assigned_to_email: config.assigned_to_email || data.assigned_to_email
    };

    return crmService.createTask(taskData);
  }

  async handleSyncToCRM(config, data) {
    if (data.action_items && data.action_items.length > 0) {
      const results = [];
      for (const item of data.action_items) {
        const result = await crmService.createTask(item);
        results.push(result);

        if (result.success) {
          await supabase
            .from('action_items')
            .update({
              crm_sync_status: 'synced',
              crm_task_id: result.taskId,
              last_sync_attempt: new Date().toISOString()
            })
            .eq('id', item.id);
        }
      }
      return { success: true, synced: results.filter(r => r.success).length };
    }
    return { success: true, synced: 0 };
  }

  async handlePostToChat(config, data) {
    const channelId = config.channel_id || process.env.SLACK_DEFAULT_CHANNEL;

    if (data.meeting) {
      return chatService.postMeetingRecap(data.meeting, data.action_items || [], channelId);
    }

    const message = this.interpolate(config.message, data);
    return chatService.postMessage(channelId, message);
  }

  async handleSendNotification(config, data) {
    // For now, notifications go through chat
    return this.handlePostToChat(config, data);
  }

  async handleCreateProject(config, data) {
    try {
      const { data: project, error } = await supabase
        .from('projects')
        .insert({
          name: this.interpolate(config.name, data),
          description: this.interpolate(config.description, data),
          crm_deal_id: data.deal_id || data.crm_deal_id,
          deal_value: data.deal_value || config.deal_value,
          status: 'planning',
          owner_id: config.owner_id || data.owner_id
        })
        .select()
        .single();

      if (error) throw error;
      return { success: true, projectId: project.id };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleUpdateStatus(config, data) {
    try {
      const table = config.table || 'tasks';
      const id = config.id || data.id;

      const { error } = await supabase
        .from(table)
        .update({
          status: config.status,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);

      if (error) throw error;
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleExtractActionItems(config, data) {
    try {
      if (!data.transcript) {
        return { success: false, error: 'No transcript provided' };
      }

      const actionItems = await geminiService.extractActionItems(data.transcript);

      // Store action items
      for (const item of actionItems) {
        await supabase
          .from('action_items')
          .insert({
            meeting_id: data.meeting_id,
            task_description: item.task,
            assigned_to_name: item.owner,
            assigned_to_email: item.ownerEmail,
            due_date: item.dueDate,
            priority: item.priority?.toLowerCase() || 'medium',
            status: 'open'
          });
      }

      return { success: true, count: actionItems.length };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleGenerateSummary(config, data) {
    try {
      if (!data.transcript) {
        return { success: false, error: 'No transcript provided' };
      }

      const summary = await geminiService.generateSummary(data.transcript);

      // Update meeting with summary
      if (data.meeting_id) {
        await supabase
          .from('meetings')
          .update({
            summary: summary.summary,
            key_points: summary.keyPoints,
            decisions: summary.decisions,
            sentiment_label: summary.sentiment
          })
          .eq('id', data.meeting_id);
      }

      return { success: true, summary };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async handleSendEmail(config, data) {
    try {
      const to = this.interpolate(config.to, data);
      const subject = this.interpolate(config.subject, data);
      const body = this.interpolate(config.body, data);

      // Check for SendGrid API key
      if (process.env.SENDGRID_API_KEY) {
        // SendGrid integration
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        const msg = {
          to,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@entomate.com',
          subject,
          text: body,
          html: body.replace(/\n/g, '<br>')
        };

        await sgMail.send(msg);
        console.log(`Email sent to ${to}`);
        return { success: true, to, subject };
      }

      // Fallback: Log email (would be sent in production)
      console.log(`📧 Email would be sent:
        To: ${to}
        Subject: ${subject}
        Body: ${body.substring(0, 100)}...`);

      return {
        success: true,
        message: 'Email logged (SendGrid not configured)',
        to,
        subject
      };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Send message to Slack via webhook
   */
  async handleSendSlack(config, data) {
    try {
      const channel = config.channel || process.env.SLACK_DEFAULT_CHANNEL;
      const message = this.interpolate(config.message, data);

      // First try using the chatService (which may use webhook)
      if (chatService && typeof chatService.postMessage === 'function') {
        const result = await chatService.postMessage(channel, message);
        return result;
      }

      // Direct webhook fallback
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;

      if (!webhookUrl) {
        console.log(`📢 Slack message would be sent:
          Channel: ${channel}
          Message: ${message.substring(0, 100)}...`);
        return {
          success: true,
          message: 'Slack message logged (webhook not configured)',
          channel
        };
      }

      // Send via webhook
      const response = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel,
          text: message,
          unfurl_links: false
        })
      });

      if (!response.ok) {
        throw new Error(`Slack webhook failed: ${response.statusText}`);
      }

      console.log(`Slack message sent to ${channel}`);
      return { success: true, channel, message: 'Message sent' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Detect follow-up opportunities using the followup agent
   */
  async handleDetectFollowups(config, data) {
    try {
      const context = {
        transcript: data.transcript,
        summary: data.summary,
        actionItems: data.action_items || data.actionItems,
        meetingTitle: data.title || data.meeting_title,
        meetingDate: data.created_at || data.meeting_date
      };

      const result = await agentOrchestrator.runAgent('followup', context);

      if (result.success && result.suggestion?.followups?.length > 0) {
        const followups = result.suggestion.followups;

        // Optionally create follow-up tasks automatically
        if (config.autoCreate && supabase) {
          for (const followup of followups.filter(f => f.confidence >= 0.7)) {
            await supabase
              .from('action_items')
              .insert({
                meeting_id: data.meeting_id,
                task_description: followup.suggestedTask,
                due_date: followup.suggestedDate,
                priority: followup.priority || 'medium',
                status: 'pending',
                source: 'followup_agent'
              });
          }
        }

        return {
          success: true,
          followups: followups.length,
          created: config.autoCreate ? followups.filter(f => f.confidence >= 0.7).length : 0,
          suggestions: followups
        };
      }

      return { success: true, followups: 0, suggestions: [] };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agent-based action: Run a specific agent
   */
  async handleRunAgent(config, data) {
    try {
      const agentNames = config.agents || [config.agent];
      const result = await agentOrchestrator.orchestrate(agentNames, data);

      // Apply suggestions if configured
      if (config.autoApply && data.actionItemId) {
        await agentOrchestrator.applyAgentSuggestions(
          data.actionItemId,
          result.aggregated
        );
      }

      return { success: true, agents: result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agent-based action: Auto-assign action items
   */
  async handleAutoAssign(config, data) {
    try {
      const context = {
        task: data.task_description || data.task,
        priority: data.priority,
        meetingTitle: data.meeting_title,
        team: config.team || data.team || [],
        actionItemId: data.action_item_id || data.id
      };

      const result = await agentOrchestrator.runAgent('assignment', context);

      if (result.success && result.suggestion?.recommended) {
        // Update the action item
        if (context.actionItemId && supabase) {
          await supabase
            .from('action_items')
            .update({
              assigned_to_name: result.suggestion.recommended,
              updated_at: new Date().toISOString()
            })
            .eq('id', context.actionItemId);
        }

        return {
          success: true,
          assignedTo: result.suggestion.recommended,
          confidence: result.suggestion.confidence,
          reason: result.suggestion.reason
        };
      }

      return { success: false, error: 'No assignment suggestion' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agent-based action: Auto-prioritize action items
   */
  async handleAutoPrioritize(config, data) {
    try {
      const context = {
        task: data.task_description || data.task,
        meetingTitle: data.meeting_title,
        sentiment: data.sentiment,
        actionItemId: data.action_item_id || data.id
      };

      const result = await agentOrchestrator.runAgent('priority', context);

      if (result.success && result.suggestion?.recommended) {
        // Update the action item
        if (context.actionItemId && supabase) {
          await supabase
            .from('action_items')
            .update({
              priority: result.suggestion.recommended,
              updated_at: new Date().toISOString()
            })
            .eq('id', context.actionItemId);
        }

        return {
          success: true,
          priority: result.suggestion.recommended,
          confidence: result.suggestion.confidence,
          reason: result.suggestion.reason
        };
      }

      return { success: false, error: 'No priority suggestion' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Agent-based action: Suggest deadline for action items
   */
  async handleSuggestDeadline(config, data) {
    try {
      const context = {
        task: data.task_description || data.task,
        priority: data.priority,
        meetingDate: data.meeting_date || data.created_at,
        actionItemId: data.action_item_id || data.id
      };

      const result = await agentOrchestrator.runAgent('deadline', context);

      if (result.success && result.suggestion?.recommended) {
        // Update the action item
        if (context.actionItemId && supabase) {
          await supabase
            .from('action_items')
            .update({
              due_date: result.suggestion.recommended,
              updated_at: new Date().toISOString()
            })
            .eq('id', context.actionItemId);
        }

        return {
          success: true,
          dueDate: result.suggestion.recommended,
          confidence: result.suggestion.confidence,
          reason: result.suggestion.reason
        };
      }

      return { success: false, error: 'No deadline suggestion' };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  /**
   * Helper: Interpolate variables in strings
   */
  interpolate(template, data) {
    if (!template) return template;
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (match, path) => {
      return this.getNestedValue(data, path) || match;
    });
  }

  /**
   * Helper: Calculate due date from days
   */
  calculateDueDate(daysFromNow) {
    if (!daysFromNow) return null;
    const date = new Date();
    date.setDate(date.getDate() + parseInt(daysFromNow));
    return date.toISOString().split('T')[0];
  }

  /**
   * Log automation execution
   */
  async logExecution(executionLog, startTime) {
    try {
      await supabase
        .from('automation_logs')
        .insert({
          ...executionLog,
          duration_ms: Date.now() - startTime
        });
    } catch (error) {
      console.error('Failed to log automation execution:', error);
    }
  }

  /**
   * Get automation templates
   */
  getTemplates() {
    return [
      {
        id: 'meeting-to-crm',
        name: 'Meeting to CRM Sync',
        description: 'When a meeting ends, extract action items and sync to CRM',
        trigger_type: 'meeting_ended',
        trigger_config: {},
        actions: [
          { type: 'extract_action_items', config: {} },
          { type: 'sync_to_crm', config: {} },
          { type: 'post_to_chat', config: { message: 'Meeting processed and synced!' } }
        ]
      },
      {
        id: 'deal-kickoff',
        name: 'Deal Kickoff',
        description: 'When a deal is created, create a project with default tasks',
        trigger_type: 'deal_created',
        trigger_config: {
          conditions: [
            { field: 'deal_value', operator: 'greater_than', value: 10000 }
          ]
        },
        actions: [
          {
            type: 'create_project',
            config: {
              name: '{{deal_name}} - Implementation',
              description: 'Project for deal: {{deal_name}}'
            }
          },
          {
            type: 'create_task',
            config: {
              title: 'Schedule kickoff meeting',
              description: 'Schedule initial kickoff with {{contact_name}}',
              due_in_days: 2
            }
          },
          {
            type: 'post_to_chat',
            config: {
              message: '🎉 New deal kickoff: {{deal_name}} (${{deal_value}})'
            }
          }
        ]
      },
      {
        id: 'task-notification',
        name: 'Task Due Notification',
        description: 'Notify team when high-priority tasks are overdue',
        trigger_type: 'task_overdue',
        trigger_config: {
          conditions: [
            { field: 'priority', operator: 'equals', value: 'high' }
          ]
        },
        actions: [
          {
            type: 'post_to_chat',
            config: {
              message: '⚠️ Overdue task: {{title}} (assigned to {{assigned_to_name}})'
            }
          }
        ]
      },
      {
        id: 'meeting-recap',
        name: 'Auto Meeting Recap',
        description: 'Automatically post meeting recap to team chat',
        trigger_type: 'meeting_processed',
        trigger_config: {},
        actions: [
          { type: 'post_to_chat', config: {} }
        ]
      },
      {
        id: 'weekly-digest',
        name: 'Weekly Team Digest',
        description: 'Send weekly summary of meetings and tasks',
        trigger_type: 'scheduled',
        trigger_config: {
          schedule: '0 9 * * 1' // Monday 9am
        },
        actions: [
          {
            type: 'post_to_chat',
            config: {
              message: '📊 Weekly digest: {{meetings_count}} meetings, {{tasks_completed}} tasks completed'
            }
          }
        ]
      },
      // Agent-based automation templates
      {
        id: 'auto-assign-tasks',
        name: 'Auto-Assign Action Items',
        description: 'Use AI to automatically assign action items to the best team member',
        trigger_type: 'action_item_created',
        trigger_config: {},
        actions: [
          {
            type: 'auto_assign',
            config: {}
          }
        ],
        icon: '🤖',
        category: 'ai'
      },
      {
        id: 'smart-prioritization',
        name: 'Smart Priority Setting',
        description: 'AI analyzes meeting context to set appropriate priorities',
        trigger_type: 'action_item_created',
        trigger_config: {},
        actions: [
          {
            type: 'auto_prioritize',
            config: {}
          }
        ],
        icon: '📊',
        category: 'ai'
      },
      {
        id: 'deadline-suggestions',
        name: 'AI Deadline Suggestions',
        description: 'AI suggests realistic due dates based on task complexity',
        trigger_type: 'action_item_created',
        trigger_config: {},
        actions: [
          {
            type: 'suggest_deadline',
            config: {}
          }
        ],
        icon: '📅',
        category: 'ai'
      },
      {
        id: 'full-ai-processing',
        name: 'Full AI Processing',
        description: 'Run all AI agents: assign, prioritize, and set deadlines automatically',
        trigger_type: 'action_item_created',
        trigger_config: {},
        actions: [
          {
            type: 'run_agent',
            config: {
              agents: ['priority', 'deadline', 'assignment'],
              autoApply: true
            }
          }
        ],
        icon: '✨',
        category: 'ai'
      },
      {
        id: 'followup-detector',
        name: 'Follow-up Detector',
        description: 'AI scans meeting content to identify and create follow-up tasks automatically',
        trigger_type: 'meeting_processed',
        trigger_config: {},
        actions: [
          {
            type: 'detect_followups',
            config: {
              autoCreate: true
            }
          }
        ],
        icon: '🔄',
        category: 'ai'
      },
      {
        id: 'complete-meeting-processing',
        name: 'Complete Meeting Processing',
        description: 'Full AI processing: extract items, assign, prioritize, set deadlines, and detect follow-ups',
        trigger_type: 'meeting_processed',
        trigger_config: {},
        actions: [
          {
            type: 'run_agent',
            config: {
              agents: ['priority', 'deadline', 'assignment'],
              autoApply: true
            }
          },
          {
            type: 'detect_followups',
            config: {
              autoCreate: true
            }
          },
          {
            type: 'post_to_chat',
            config: {
              message: '✨ Meeting {{title}} processed with AI: Action items assigned, prioritized, and follow-ups detected!'
            }
          }
        ],
        icon: '🚀',
        category: 'ai'
      }
    ];
  }
}

module.exports = new AutomationEngine();
