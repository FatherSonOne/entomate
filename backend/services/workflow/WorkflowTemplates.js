/**
 * Workflow Templates
 *
 * Pre-built workflow templates for common use cases
 */

const WorkflowTemplates = {
  /**
   * Meeting Processing Pipeline
   * Processes meetings with AI agents and posts recap
   */
  meetingProcessing: {
    id: 'template-meeting-processing',
    name: 'Meeting Processing Pipeline',
    description: 'Automatically process meetings: extract action items, assign, prioritize, and notify team',
    category: 'meetings',
    icon: 'file-text',
    nodes: [
      {
        id: 'trigger-1',
        type: 'trigger',
        subtype: 'meeting_processed',
        position: { x: 100, y: 100 },
        config: {}
      },
      {
        id: 'ai-priority',
        type: 'ai',
        subtype: 'ai_agent',
        position: { x: 100, y: 220 },
        config: { agent: 'priority', autoApply: true }
      },
      {
        id: 'ai-deadline',
        type: 'ai',
        subtype: 'ai_agent',
        position: { x: 100, y: 340 },
        config: { agent: 'deadline', autoApply: true }
      },
      {
        id: 'ai-assign',
        type: 'ai',
        subtype: 'ai_agent',
        position: { x: 100, y: 460 },
        config: { agent: 'assignment', autoApply: true }
      },
      {
        id: 'detect-followups',
        type: 'ai',
        subtype: 'detect_followups',
        position: { x: 100, y: 580 },
        config: { autoCreate: true }
      },
      {
        id: 'notify-pulse',
        type: 'action',
        subtype: 'send_pulse',
        position: { x: 100, y: 700 },
        config: {
          channel: 'meetings',
          message: '✨ Meeting "{{title}}" processed!\n\n📋 {{actionItems.length}} action items extracted\n🔄 {{followups.detected}} follow-ups detected',
          mentionOwner: true
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger-1', sourceOutput: 'main', targetNodeId: 'ai-priority', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'ai-priority', sourceOutput: 'main', targetNodeId: 'ai-deadline', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'ai-deadline', sourceOutput: 'main', targetNodeId: 'ai-assign', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'ai-assign', sourceOutput: 'main', targetNodeId: 'detect-followups', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'detect-followups', sourceOutput: 'main', targetNodeId: 'notify-pulse', targetInput: 'main' }
    ]
  },

  /**
   * Webhook to Slack
   * Simple webhook that posts to Slack
   */
  webhookToSlack: {
    id: 'template-webhook-slack',
    name: 'Webhook to Slack',
    description: 'Receive webhook data and post to Slack channel',
    category: 'integrations',
    icon: 'message-square',
    nodes: [
      {
        id: 'webhook-trigger',
        type: 'trigger',
        subtype: 'webhook',
        position: { x: 100, y: 100 },
        config: {
          method: 'POST',
          authentication: { type: 'none' },
          responseMode: 'immediate'
        }
      },
      {
        id: 'slack-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 100, y: 220 },
        config: {
          channel: '#notifications',
          message: '📩 Webhook received:\n```{{JSON.stringify(body, null, 2)}}```'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'webhook-trigger', sourceOutput: 'main', targetNodeId: 'slack-notify', targetInput: 'main' }
    ]
  },

  /**
   * Webhook to Pulse
   * Receive webhook and post to Pulse channel
   */
  webhookToPulse: {
    id: 'template-webhook-pulse',
    name: 'Webhook to Pulse',
    description: 'Receive webhook data and post to a Pulse channel',
    category: 'integrations',
    icon: 'radio',
    nodes: [
      {
        id: 'webhook-trigger',
        type: 'trigger',
        subtype: 'webhook',
        position: { x: 100, y: 100 },
        config: {
          method: 'POST',
          authentication: { type: 'none' },
          responseMode: 'immediate'
        }
      },
      {
        id: 'pulse-notify',
        type: 'action',
        subtype: 'send_pulse',
        position: { x: 100, y: 220 },
        config: {
          channel: 'general',
          message: '📩 Webhook received:\n{{JSON.stringify(body, null, 2)}}',
          mentionOwner: false
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'webhook-trigger', sourceOutput: 'main', targetNodeId: 'pulse-notify', targetInput: 'main' }
    ]
  },

  /**
   * Daily Digest
   * Send daily summary at scheduled time
   */
  dailyDigest: {
    id: 'template-daily-digest',
    name: 'Daily Team Digest',
    description: 'Send daily summary of meetings and tasks to team',
    category: 'notifications',
    icon: 'calendar',
    nodes: [
      {
        id: 'schedule-trigger',
        type: 'trigger',
        subtype: 'schedule',
        position: { x: 100, y: 100 },
        config: {
          cron: '0 9 * * 1-5',
          timezone: 'America/New_York'
        }
      },
      {
        id: 'send-digest',
        type: 'action',
        subtype: 'send_pulse',
        position: { x: 100, y: 220 },
        config: {
          channel: 'general',
          message: '📊 Daily Digest - {{date}}\n\nGood morning team! Here\'s your daily summary.'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'schedule-trigger', sourceOutput: 'main', targetNodeId: 'send-digest', targetInput: 'main' }
    ]
  },

  /**
   * Conditional Action Item Processing
   * Different handling based on priority
   */
  conditionalActionItems: {
    id: 'template-conditional-actions',
    name: 'Smart Action Item Router',
    description: 'Route action items to different channels based on priority',
    category: 'automation',
    icon: 'git-branch',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'action_item_created',
        position: { x: 200, y: 100 },
        config: {}
      },
      {
        id: 'check-priority',
        type: 'logic',
        subtype: 'switch',
        position: { x: 200, y: 220 },
        config: {
          field: 'priority',
          cases: [
            { value: 'urgent', output: 0 },
            { value: 'high', output: 1 },
            { value: 'medium', output: 2 },
            { value: 'low', output: 3 }
          ]
        }
      },
      {
        id: 'urgent-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 380 },
        config: {
          channel: '#urgent',
          message: '🚨 *URGENT* action item: {{task}}\nAssigned to: {{assignee}}'
        }
      },
      {
        id: 'high-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 200, y: 380 },
        config: {
          channel: '#high-priority',
          message: '⚠️ High priority: {{task}}'
        }
      },
      {
        id: 'standard-log',
        type: 'action',
        subtype: 'set_variable',
        position: { x: 350, y: 380 },
        config: {
          variables: { logged: true }
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'check-priority', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'check-priority', sourceOutput: '0', targetNodeId: 'urgent-notify', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'check-priority', sourceOutput: '1', targetNodeId: 'high-notify', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'check-priority', sourceOutput: '2', targetNodeId: 'standard-log', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'check-priority', sourceOutput: '3', targetNodeId: 'standard-log', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'check-priority', sourceOutput: 'default', targetNodeId: 'standard-log', targetInput: 'main' }
    ]
  },

  /**
   * CRM Sync Pipeline
   * Sync meeting data to CRM
   */
  crmSync: {
    id: 'template-crm-sync',
    name: 'Meeting to CRM Sync',
    description: 'Automatically sync meeting action items to your CRM',
    category: 'integrations',
    icon: 'database',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'meeting_processed',
        position: { x: 100, y: 100 },
        config: {}
      },
      {
        id: 'check-deal',
        type: 'logic',
        subtype: 'if',
        position: { x: 100, y: 220 },
        config: {
          conditions: [
            { field: 'crm_deal_id', operator: 'exists' }
          ]
        }
      },
      {
        id: 'sync-crm',
        type: 'action',
        subtype: 'sync_crm',
        position: { x: 50, y: 380 },
        config: {
          objectType: 'task',
          operation: 'create',
          fieldMapping: {
            title: '{{task}}',
            description: '{{context}}',
            due_date: '{{dueDate}}'
          }
        }
      },
      {
        id: 'notify-success',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 500 },
        config: {
          channel: '#crm-sync',
          message: '✅ Synced {{actionItems.length}} tasks to CRM for deal {{crm_deal_id}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'check-deal', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'check-deal', sourceOutput: 'true', targetNodeId: 'sync-crm', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'sync-crm', sourceOutput: 'main', targetNodeId: 'notify-success', targetInput: 'main' }
    ]
  },

  /**
   * Error Handler Workflow
   * Standard error handling template
   */
  errorHandler: {
    id: 'template-error-handler',
    name: 'Error Notification Handler',
    description: 'Notify team when any workflow fails',
    category: 'system',
    icon: 'alert-triangle',
    nodes: [
      {
        id: 'error-trigger',
        type: 'trigger',
        subtype: 'error',
        position: { x: 100, y: 100 },
        config: {
          listenTo: 'all'
        }
      },
      {
        id: 'notify-error',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 100, y: 220 },
        config: {
          channel: '#alerts',
          message: '🚨 *Workflow Error*\n\nWorkflow: {{workflow.name}}\nError: {{error.message}}\nNode: {{execution.failedNodeId}}'
        }
      },
      {
        id: 'send-email',
        type: 'action',
        subtype: 'send_email',
        position: { x: 100, y: 340 },
        config: {
          to: 'admin@example.com',
          subject: 'Workflow Error: {{workflow.name}}',
          body: 'Error details:\n\n{{error.message}}\n\nStack:\n{{error.stack}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'error-trigger', sourceOutput: 'main', targetNodeId: 'notify-error', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'notify-error', sourceOutput: 'main', targetNodeId: 'send-email', targetInput: 'main' }
    ]
  },

  /**
   * API Integration Template
   * Call external API and process response
   */
  apiIntegration: {
    id: 'template-api-integration',
    name: 'External API Integration',
    description: 'Call an external API, process response, and take action',
    category: 'integrations',
    icon: 'globe',
    nodes: [
      {
        id: 'webhook-trigger',
        type: 'trigger',
        subtype: 'webhook',
        position: { x: 100, y: 100 },
        config: {
          method: 'POST',
          responseMode: 'last_node'
        }
      },
      {
        id: 'api-call',
        type: 'action',
        subtype: 'http_request',
        position: { x: 100, y: 220 },
        config: {
          method: 'GET',
          url: 'https://api.example.com/data/{{body.id}}',
          headers: {
            'Authorization': 'Bearer {{$secrets.API_TOKEN}}'
          },
          responseField: 'apiResponse'
        }
      },
      {
        id: 'check-success',
        type: 'logic',
        subtype: 'if',
        position: { x: 100, y: 340 },
        config: {
          conditions: [
            { field: 'apiResponse.statusCode', operator: 'equals', value: 200 }
          ]
        }
      },
      {
        id: 'process-data',
        type: 'data',
        subtype: 'transform',
        position: { x: 50, y: 460 },
        config: {
          mappings: [
            { source: 'apiResponse.data.result', target: 'processedData' }
          ]
        }
      },
      {
        id: 'respond-success',
        type: 'action',
        subtype: 'respond_webhook',
        position: { x: 50, y: 580 },
        config: {
          statusCode: 200,
          body: { success: true, data: '{{processedData}}' }
        }
      },
      {
        id: 'respond-error',
        type: 'action',
        subtype: 'respond_webhook',
        position: { x: 200, y: 460 },
        config: {
          statusCode: 500,
          body: { success: false, error: 'API call failed' }
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'webhook-trigger', sourceOutput: 'main', targetNodeId: 'api-call', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'api-call', sourceOutput: 'main', targetNodeId: 'check-success', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'check-success', sourceOutput: 'true', targetNodeId: 'process-data', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'check-success', sourceOutput: 'false', targetNodeId: 'respond-error', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'process-data', sourceOutput: 'main', targetNodeId: 'respond-success', targetInput: 'main' }
    ]
  },

  /**
   * Batch Processing Template
   * Process items in batches with rate limiting
   */
  batchProcessing: {
    id: 'template-batch-processing',
    name: 'Batch Item Processor',
    description: 'Process large lists in batches with built-in rate limiting',
    category: 'automation',
    icon: 'layers',
    nodes: [
      {
        id: 'manual-trigger',
        type: 'trigger',
        subtype: 'manual',
        position: { x: 100, y: 100 },
        config: {}
      },
      {
        id: 'split-batches',
        type: 'logic',
        subtype: 'split_batches',
        position: { x: 100, y: 220 },
        config: {
          batchSize: 10,
          inputField: 'items'
        }
      },
      {
        id: 'process-batch',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 50, y: 380 },
        config: {
          prompt: 'Process these items: {{JSON.stringify(batch)}}',
          outputField: 'batchResult'
        }
      },
      {
        id: 'wait',
        type: 'logic',
        subtype: 'wait',
        position: { x: 50, y: 500 },
        config: {
          duration: 1,
          unit: 'seconds'
        }
      },
      {
        id: 'complete',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 200, y: 380 },
        config: {
          channel: '#batch-jobs',
          message: '✅ Batch processing complete!\nProcessed: {{results.totalProcessed}} items'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'manual-trigger', sourceOutput: 'main', targetNodeId: 'split-batches', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'split-batches', sourceOutput: 'loop', targetNodeId: 'process-batch', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'process-batch', sourceOutput: 'main', targetNodeId: 'wait', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'wait', sourceOutput: 'main', targetNodeId: 'split-batches', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'split-batches', sourceOutput: 'done', targetNodeId: 'complete', targetInput: 'main' }
    ]
  },

  // ========================================
  // QUICK WIN 5: Ready-to-Use Templates
  // ========================================

  /**
   * Post-Demo Follow-up
   * Extract actions from demo, send follow-up, create CRM tasks
   */
  postDemoFollowup: {
    id: 'template-post-demo-followup',
    name: 'Post-Demo Follow-up',
    description: 'Automatically extract action items from demo meetings, send personalized follow-up emails, and create CRM tasks',
    category: 'sales',
    icon: 'presentation',
    tags: ['demo', 'follow-up', 'sales', 'crm'],
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'meeting_processed',
        position: { x: 100, y: 100 },
        config: {
          filter: { type: 'demo' }
        }
      },
      {
        id: 'extract-actions',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 220 },
        config: {
          prompt: 'Extract key action items, next steps, and follow-up requirements from this demo meeting. Focus on: pricing requests, feature requests, technical requirements, stakeholder introductions needed.',
          outputField: 'demoActions'
        }
      },
      {
        id: 'generate-followup',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 340 },
        config: {
          prompt: 'Generate a personalized follow-up email based on the demo discussion. Include: thank you for time, recap of key points discussed, next steps, and proposed timeline. Tone: professional but warm.',
          outputField: 'followupEmail'
        }
      },
      {
        id: 'send-email',
        type: 'action',
        subtype: 'send_email',
        position: { x: 100, y: 460 },
        config: {
          to: '{{attendees[0].email}}',
          subject: 'Thank you for the demo - Next steps for {{company}}',
          body: '{{followupEmail}}'
        }
      },
      {
        id: 'create-tasks',
        type: 'action',
        subtype: 'sync_crm',
        position: { x: 100, y: 580 },
        config: {
          objectType: 'task',
          operation: 'create_bulk',
          data: '{{demoActions.actionItems}}'
        }
      },
      {
        id: 'notify-sales',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 100, y: 700 },
        config: {
          channel: '#sales-team',
          message: '📧 Demo follow-up sent to {{company}}\n\n✅ {{demoActions.actionItems.length}} tasks created in CRM\n📅 Next meeting: {{demoActions.nextMeeting || "Not scheduled"}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'extract-actions', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'extract-actions', sourceOutput: 'main', targetNodeId: 'generate-followup', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'generate-followup', sourceOutput: 'main', targetNodeId: 'send-email', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'send-email', sourceOutput: 'main', targetNodeId: 'create-tasks', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'create-tasks', sourceOutput: 'main', targetNodeId: 'notify-sales', targetInput: 'main' }
    ]
  },

  /**
   * New Lead Onboarding
   * Enrich leads with AI, score, and send welcome sequence
   */
  newLeadOnboarding: {
    id: 'template-new-lead-onboarding',
    name: 'New Lead Onboarding',
    description: 'Automatically enrich new leads with AI insights, calculate lead score, and trigger personalized welcome sequence',
    category: 'sales',
    icon: 'user-plus',
    tags: ['leads', 'onboarding', 'scoring', 'enrichment'],
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'webhook',
        position: { x: 100, y: 100 },
        config: {
          method: 'POST',
          authentication: { type: 'api_key' },
          description: 'Receives new lead data from CRM or forms'
        }
      },
      {
        id: 'enrich-lead',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 220 },
        config: {
          prompt: 'Analyze this lead and provide enrichment data: company size estimate, industry, likely use cases, potential deal size, and recommended approach. Lead: {{JSON.stringify(body)}}',
          outputField: 'enrichedData'
        }
      },
      {
        id: 'calculate-score',
        type: 'data',
        subtype: 'transform',
        position: { x: 100, y: 340 },
        config: {
          mappings: [
            { source: 'enrichedData.companySize', target: 'sizeScore', transform: 'map:small=10,medium=25,large=40,enterprise=50' },
            { source: 'enrichedData.urgency', target: 'urgencyScore', transform: 'map:low=5,medium=15,high=30' },
            { source: 'enrichedData.budget', target: 'budgetScore', transform: 'map:unknown=5,limited=10,adequate=15,strong=20' }
          ],
          computed: {
            totalScore: '{{sizeScore + urgencyScore + budgetScore}}'
          }
        }
      },
      {
        id: 'check-score',
        type: 'logic',
        subtype: 'switch',
        position: { x: 100, y: 460 },
        config: {
          field: 'totalScore',
          cases: [
            { condition: '>=70', output: 0, label: 'hot' },
            { condition: '>=40', output: 1, label: 'warm' },
            { condition: '<40', output: 2, label: 'cold' }
          ]
        }
      },
      {
        id: 'hot-lead',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 600 },
        config: {
          channel: '#hot-leads',
          message: '🔥 *HOT LEAD* - Score: {{totalScore}}/100\n\n👤 {{body.name}} at {{body.company}}\n📧 {{body.email}}\n💡 {{enrichedData.recommendedApproach}}'
        }
      },
      {
        id: 'warm-lead',
        type: 'action',
        subtype: 'send_email',
        position: { x: 200, y: 600 },
        config: {
          to: '{{body.email}}',
          subject: 'Welcome to {{$env.COMPANY_NAME}} - Let\'s explore how we can help',
          template: 'warm_lead_welcome'
        }
      },
      {
        id: 'cold-lead',
        type: 'action',
        subtype: 'send_email',
        position: { x: 350, y: 600 },
        config: {
          to: '{{body.email}}',
          subject: 'Resources to help you get started',
          template: 'cold_lead_nurture'
        }
      },
      {
        id: 'update-crm',
        type: 'action',
        subtype: 'sync_crm',
        position: { x: 200, y: 720 },
        config: {
          objectType: 'contact',
          operation: 'update',
          data: {
            lead_score: '{{totalScore}}',
            enrichment_data: '{{enrichedData}}',
            lead_status: '{{scoreCategory}}'
          }
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'enrich-lead', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'enrich-lead', sourceOutput: 'main', targetNodeId: 'calculate-score', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'calculate-score', sourceOutput: 'main', targetNodeId: 'check-score', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'check-score', sourceOutput: '0', targetNodeId: 'hot-lead', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'check-score', sourceOutput: '1', targetNodeId: 'warm-lead', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'check-score', sourceOutput: '2', targetNodeId: 'cold-lead', targetInput: 'main' },
      { id: 'c7', sourceNodeId: 'hot-lead', sourceOutput: 'main', targetNodeId: 'update-crm', targetInput: 'main' },
      { id: 'c8', sourceNodeId: 'warm-lead', sourceOutput: 'main', targetNodeId: 'update-crm', targetInput: 'main' },
      { id: 'c9', sourceNodeId: 'cold-lead', sourceOutput: 'main', targetNodeId: 'update-crm', targetInput: 'main' }
    ]
  },

  /**
   * QBR Preparation
   * Gather metrics, analyze health, generate report
   */
  qbrPreparation: {
    id: 'template-qbr-preparation',
    name: 'QBR Preparation',
    description: 'Automatically gather customer metrics, analyze account health, and generate comprehensive QBR report',
    category: 'customer_success',
    icon: 'bar-chart-2',
    tags: ['qbr', 'reports', 'customer-success', 'analytics'],
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'schedule',
        position: { x: 100, y: 100 },
        config: {
          cron: '0 9 1 */3 *',
          timezone: 'America/New_York',
          description: 'Run quarterly on the 1st'
        }
      },
      {
        id: 'fetch-metrics',
        type: 'action',
        subtype: 'http_request',
        position: { x: 100, y: 220 },
        config: {
          method: 'GET',
          url: '{{$env.ANALYTICS_API}}/customer/{{customerId}}/metrics',
          headers: { 'Authorization': 'Bearer {{$secrets.ANALYTICS_TOKEN}}' },
          responseField: 'metrics'
        }
      },
      {
        id: 'fetch-meetings',
        type: 'data',
        subtype: 'query',
        position: { x: 100, y: 340 },
        config: {
          source: 'meetings',
          filter: {
            customer_id: '{{customerId}}',
            date: { $gte: '{{quarterStart}}' }
          },
          outputField: 'quarterMeetings'
        }
      },
      {
        id: 'analyze-health',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 460 },
        config: {
          prompt: 'Analyze customer health based on these metrics and meeting history. Identify: achievements, areas of concern, growth opportunities, and risk factors.\n\nMetrics: {{JSON.stringify(metrics)}}\nMeetings: {{quarterMeetings.length}} meetings held\nSentiment trend: {{metrics.sentimentTrend}}',
          outputField: 'healthAnalysis'
        }
      },
      {
        id: 'generate-report',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 580 },
        config: {
          prompt: 'Generate a professional QBR report document with sections: Executive Summary, Key Metrics, Achievements, Areas for Improvement, Recommendations, and Next Quarter Goals. Use the health analysis and metrics provided.',
          outputField: 'qbrReport',
          format: 'markdown'
        }
      },
      {
        id: 'save-report',
        type: 'action',
        subtype: 'http_request',
        position: { x: 100, y: 700 },
        config: {
          method: 'POST',
          url: '{{$env.DOCS_API}}/create',
          body: {
            title: 'QBR Report - {{customer.name}} - Q{{quarter}} {{year}}',
            content: '{{qbrReport}}',
            folder: 'qbr-reports'
          }
        }
      },
      {
        id: 'notify-csm',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 100, y: 820 },
        config: {
          channel: '#customer-success',
          message: '📊 *QBR Report Ready*\n\n👤 Customer: {{customer.name}}\n📈 Health Score: {{healthAnalysis.score}}/100\n⚠️ Risk Level: {{healthAnalysis.riskLevel}}\n\n📄 Report: {{reportUrl}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'fetch-metrics', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'fetch-metrics', sourceOutput: 'main', targetNodeId: 'fetch-meetings', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'fetch-meetings', sourceOutput: 'main', targetNodeId: 'analyze-health', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'analyze-health', sourceOutput: 'main', targetNodeId: 'generate-report', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'generate-report', sourceOutput: 'main', targetNodeId: 'save-report', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'save-report', sourceOutput: 'main', targetNodeId: 'notify-csm', targetInput: 'main' }
    ]
  },

  /**
   * Churn Risk Alert
   * Analyze sentiment, detect risk, alert and create tasks
   */
  churnRiskAlert: {
    id: 'template-churn-risk-alert',
    name: 'Churn Risk Alert',
    description: 'Automatically detect churn risk signals from meeting sentiment and engagement patterns, then alert team and create intervention tasks',
    category: 'customer_success',
    icon: 'alert-octagon',
    tags: ['churn', 'risk', 'sentiment', 'alerts'],
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'meeting_processed',
        position: { x: 100, y: 100 },
        config: {}
      },
      {
        id: 'analyze-sentiment',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 100, y: 220 },
        config: {
          prompt: 'Analyze this meeting for churn risk indicators. Look for: frustration signals, competitor mentions, budget concerns, reduced engagement, escalation language, contract/renewal hesitation. Rate risk 1-10 and explain.',
          outputField: 'riskAnalysis'
        }
      },
      {
        id: 'check-risk-level',
        type: 'logic',
        subtype: 'if',
        position: { x: 100, y: 340 },
        config: {
          conditions: [
            { field: 'riskAnalysis.riskScore', operator: '>=', value: 7 }
          ]
        }
      },
      {
        id: 'high-risk-alert',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 480 },
        config: {
          channel: '#churn-alerts',
          message: '🚨 *HIGH CHURN RISK DETECTED*\n\n🏢 Customer: {{customer.name}}\n📊 Risk Score: {{riskAnalysis.riskScore}}/10\n📝 Meeting: {{meeting.title}}\n\n*Risk Signals:*\n{{riskAnalysis.signals.join("\\n")}}\n\n*Recommended Actions:*\n{{riskAnalysis.recommendations.join("\\n")}}'
        }
      },
      {
        id: 'create-intervention',
        type: 'action',
        subtype: 'sync_crm',
        position: { x: 50, y: 600 },
        config: {
          objectType: 'task',
          operation: 'create',
          data: {
            title: '🚨 Churn intervention required - {{customer.name}}',
            description: '{{riskAnalysis.recommendations.join("\\n")}}',
            priority: 'urgent',
            due_date: '{{$date.add(2, "days")}}',
            assigned_to: '{{customer.csm_id}}'
          }
        }
      },
      {
        id: 'notify-manager',
        type: 'action',
        subtype: 'send_email',
        position: { x: 50, y: 720 },
        config: {
          to: '{{customer.csm_manager_email}}',
          subject: '🚨 High Churn Risk - {{customer.name}} requires immediate attention',
          body: 'A high churn risk has been detected for {{customer.name}}.\n\nRisk Score: {{riskAnalysis.riskScore}}/10\n\nPlease review the account and coordinate with the CSM on intervention strategy.\n\nMeeting transcript and analysis: {{meetingUrl}}'
        }
      },
      {
        id: 'log-risk',
        type: 'action',
        subtype: 'set_variable',
        position: { x: 200, y: 480 },
        config: {
          variables: {
            riskLogged: true,
            riskLevel: '{{riskAnalysis.riskScore < 7 ? "moderate" : "low"}}'
          }
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'analyze-sentiment', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'analyze-sentiment', sourceOutput: 'main', targetNodeId: 'check-risk-level', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'check-risk-level', sourceOutput: 'true', targetNodeId: 'high-risk-alert', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'high-risk-alert', sourceOutput: 'main', targetNodeId: 'create-intervention', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'create-intervention', sourceOutput: 'main', targetNodeId: 'notify-manager', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'check-risk-level', sourceOutput: 'false', targetNodeId: 'log-risk', targetInput: 'main' }
    ]
  },

  /**
   * Deal Stage Automation
   * Track stage changes, update probability, notify team
   */
  dealStageAutomation: {
    id: 'template-deal-stage-automation',
    name: 'Deal Stage Automation',
    description: 'Automatically track deal stage changes, update win probability, trigger stage-specific actions, and notify relevant team members',
    category: 'operations',
    icon: 'trending-up',
    tags: ['deals', 'pipeline', 'automation', 'notifications'],
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'webhook',
        position: { x: 200, y: 100 },
        config: {
          method: 'POST',
          authentication: { type: 'api_key' },
          description: 'Receives deal stage change events from CRM'
        }
      },
      {
        id: 'stage-router',
        type: 'logic',
        subtype: 'switch',
        position: { x: 200, y: 220 },
        config: {
          field: 'body.new_stage',
          cases: [
            { value: 'discovery', output: 0 },
            { value: 'demo', output: 1 },
            { value: 'proposal', output: 2 },
            { value: 'negotiation', output: 3 },
            { value: 'closed_won', output: 4 },
            { value: 'closed_lost', output: 5 }
          ]
        }
      },
      {
        id: 'discovery-actions',
        type: 'data',
        subtype: 'transform',
        position: { x: 50, y: 380 },
        config: {
          computed: {
            probability: 20,
            next_action: 'Schedule discovery call',
            notification: '🔍 {{deal.name}} moved to Discovery'
          }
        }
      },
      {
        id: 'demo-actions',
        type: 'data',
        subtype: 'transform',
        position: { x: 150, y: 380 },
        config: {
          computed: {
            probability: 40,
            next_action: 'Prepare demo environment',
            notification: '🎯 {{deal.name}} ready for demo!'
          }
        }
      },
      {
        id: 'proposal-actions',
        type: 'data',
        subtype: 'transform',
        position: { x: 250, y: 380 },
        config: {
          computed: {
            probability: 60,
            next_action: 'Generate proposal document',
            notification: '📄 {{deal.name}} in proposal stage - ${{deal.value}}'
          }
        }
      },
      {
        id: 'negotiation-actions',
        type: 'data',
        subtype: 'transform',
        position: { x: 350, y: 380 },
        config: {
          computed: {
            probability: 80,
            next_action: 'Review contract terms',
            notification: '🤝 {{deal.name}} in final negotiation!'
          }
        }
      },
      {
        id: 'won-celebration',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 450, y: 380 },
        config: {
          channel: '#wins',
          message: '🎉🎉🎉 *DEAL WON!*\n\n💰 {{deal.name}}\n💵 Value: ${{deal.value}}\n👤 Owner: {{deal.owner}}\n🏢 Customer: {{deal.company}}\n\nCongratulations team! 🚀'
        }
      },
      {
        id: 'lost-analysis',
        type: 'ai',
        subtype: 'ai_prompt',
        position: { x: 550, y: 380 },
        config: {
          prompt: 'Analyze why this deal was lost based on meeting history and notes. Identify: primary loss reason, competitor if any, lessons learned, and recommendations for similar deals.',
          outputField: 'lossAnalysis'
        }
      },
      {
        id: 'merge-updates',
        type: 'logic',
        subtype: 'merge',
        position: { x: 200, y: 520 },
        config: {
          mode: 'wait_all',
          timeout: 5000
        }
      },
      {
        id: 'update-crm',
        type: 'action',
        subtype: 'sync_crm',
        position: { x: 200, y: 640 },
        config: {
          objectType: 'deal',
          operation: 'update',
          data: {
            probability: '{{probability}}',
            next_action: '{{next_action}}',
            stage_changed_at: '{{$date.now()}}'
          }
        }
      },
      {
        id: 'notify-team',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 200, y: 760 },
        config: {
          channel: '#sales-pipeline',
          message: '{{notification}}\n\n📊 Probability: {{probability}}%\n📌 Next: {{next_action}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'stage-router', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'stage-router', sourceOutput: '0', targetNodeId: 'discovery-actions', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'stage-router', sourceOutput: '1', targetNodeId: 'demo-actions', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'stage-router', sourceOutput: '2', targetNodeId: 'proposal-actions', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'stage-router', sourceOutput: '3', targetNodeId: 'negotiation-actions', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'stage-router', sourceOutput: '4', targetNodeId: 'won-celebration', targetInput: 'main' },
      { id: 'c7', sourceNodeId: 'stage-router', sourceOutput: '5', targetNodeId: 'lost-analysis', targetInput: 'main' },
      { id: 'c8', sourceNodeId: 'discovery-actions', sourceOutput: 'main', targetNodeId: 'merge-updates', targetInput: 'main' },
      { id: 'c9', sourceNodeId: 'demo-actions', sourceOutput: 'main', targetNodeId: 'merge-updates', targetInput: 'main' },
      { id: 'c10', sourceNodeId: 'proposal-actions', sourceOutput: 'main', targetNodeId: 'merge-updates', targetInput: 'main' },
      { id: 'c11', sourceNodeId: 'negotiation-actions', sourceOutput: 'main', targetNodeId: 'merge-updates', targetInput: 'main' },
      { id: 'c12', sourceNodeId: 'merge-updates', sourceOutput: 'main', targetNodeId: 'update-crm', targetInput: 'main' },
      { id: 'c13', sourceNodeId: 'update-crm', sourceOutput: 'main', targetNodeId: 'notify-team', targetInput: 'main' }
    ]
  },

  // ========================================
  // CRM WORKFLOW TEMPLATES (Logos Vision)
  // ========================================

  /**
   * Deal Stage Change Handler
   * Trigger actions when deals move through pipeline stages
   */
  dealStageChangeHandler: {
    id: 'template-deal-stage-handler',
    name: 'Deal Stage Change Handler',
    description: 'Automatically trigger actions when deals move through pipeline stages in Logos Vision CRM',
    category: 'crm',
    icon: 'trending-up',
    tags: ['crm', 'deals', 'pipeline', 'logos-vision'],
    estimatedTime: '5 min setup',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'deal_stage_changed',
        position: { x: 200, y: 100 },
        config: {
          toStages: ['proposal', 'negotiation', 'closed_won', 'closed_lost']
        }
      },
      {
        id: 'stage-router',
        type: 'logic',
        subtype: 'switch',
        position: { x: 200, y: 220 },
        config: {
          field: 'deal.toStage',
          cases: [
            { value: 'proposal', output: 0 },
            { value: 'negotiation', output: 1 },
            { value: 'closed_won', output: 2 },
            { value: 'closed_lost', output: 3 }
          ]
        }
      },
      {
        id: 'proposal-task',
        type: 'crm',
        subtype: 'create_crm_task',
        position: { x: 50, y: 380 },
        config: {
          title: 'Send proposal to {{deal.name}}',
          description: 'Deal moved to proposal stage. Prepare and send pricing proposal.',
          priority: 'high',
          dueDate: '{{$date.add(2, "days")}}',
          relatedDealId: '{{deal.id}}'
        }
      },
      {
        id: 'negotiation-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 150, y: 380 },
        config: {
          channel: '#sales-team',
          message: '🤝 *Deal in Negotiation*\n\n💰 {{deal.name}}\n💵 Value: ${{deal.value}}\n👤 Owner: {{deal.owner}}\n\nFinal stretch! Review contract terms.'
        }
      },
      {
        id: 'won-celebration',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 250, y: 380 },
        config: {
          channel: '#wins',
          message: '🎉🎉🎉 *DEAL WON!*\n\n💰 {{deal.name}}\n💵 Value: ${{deal.value}}\n👤 Closed by: {{deal.owner}}\n\nCongratulations! 🚀'
        }
      },
      {
        id: 'won-onboarding',
        type: 'crm',
        subtype: 'create_crm_task',
        position: { x: 250, y: 500 },
        config: {
          title: 'Start onboarding for {{deal.name}}',
          description: 'Deal closed! Begin customer onboarding process.',
          priority: 'high',
          dueDate: '{{$date.add(1, "days")}}',
          assignee: '{{$env.ONBOARDING_TEAM}}',
          relatedDealId: '{{deal.id}}'
        }
      },
      {
        id: 'lost-log',
        type: 'crm',
        subtype: 'log_activity',
        position: { x: 350, y: 380 },
        config: {
          activityType: 'note',
          subject: 'Deal Lost: {{deal.name}}',
          description: 'Reason: {{deal.lossReason || "Not specified"}}\n\nNext steps: Review and learn.',
          relatedDealId: '{{deal.id}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'stage-router', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'stage-router', sourceOutput: '0', targetNodeId: 'proposal-task', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'stage-router', sourceOutput: '1', targetNodeId: 'negotiation-notify', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'stage-router', sourceOutput: '2', targetNodeId: 'won-celebration', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'won-celebration', sourceOutput: 'main', targetNodeId: 'won-onboarding', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'stage-router', sourceOutput: '3', targetNodeId: 'lost-log', targetInput: 'main' }
    ]
  },

  /**
   * Stale Deal Alert
   * Find and alert on deals with no recent activity
   */
  staleDealAlert: {
    id: 'template-stale-deal-alert',
    name: 'Stale Deal Alert',
    description: 'Daily check for deals with no activity in the past 7 days and alert owners',
    category: 'crm',
    icon: 'alert-triangle',
    tags: ['crm', 'deals', 'alerts', 'logos-vision'],
    estimatedTime: '3 min setup',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'schedule',
        position: { x: 100, y: 100 },
        config: {
          cron: '0 9 * * 1-5',
          timezone: 'America/New_York',
          description: 'Run weekdays at 9 AM'
        }
      },
      {
        id: 'get-stale',
        type: 'crm',
        subtype: 'get_stale_deals',
        position: { x: 100, y: 220 },
        config: {
          staleDays: 7,
          stages: ['qualification', 'discovery', 'demo', 'proposal'],
          limit: 50
        }
      },
      {
        id: 'check-any',
        type: 'logic',
        subtype: 'if',
        position: { x: 100, y: 340 },
        config: {
          conditions: [
            { field: 'staleDeals.length', operator: 'greater_than', value: 0 }
          ]
        }
      },
      {
        id: 'loop-deals',
        type: 'logic',
        subtype: 'loop',
        position: { x: 50, y: 480 },
        config: {
          arrayField: 'staleDeals',
          itemVariable: 'deal'
        }
      },
      {
        id: 'create-followup',
        type: 'crm',
        subtype: 'create_crm_task',
        position: { x: 50, y: 600 },
        config: {
          title: 'Follow up on stale deal: {{deal.name}}',
          description: 'No activity in {{deal.daysSinceActivity}} days. Re-engage or update status.',
          priority: 'medium',
          dueDate: '{{$date.add(1, "days")}}',
          assignee: '{{deal.owner_id}}',
          relatedDealId: '{{deal.id}}'
        }
      },
      {
        id: 'notify-slack',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 200, y: 480 },
        config: {
          channel: '#sales-pipeline',
          message: '⚠️ *Stale Deals Alert*\n\n{{staleDeals.length}} deals have no activity in 7+ days:\n\n{{staleDeals.slice(0,5).map(d => `• ${d.name} (${d.daysSinceActivity} days)`).join("\\n")}}\n\nFollow-up tasks have been created.'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'get-stale', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'get-stale', sourceOutput: 'main', targetNodeId: 'check-any', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'check-any', sourceOutput: 'true', targetNodeId: 'loop-deals', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'loop-deals', sourceOutput: 'loop', targetNodeId: 'create-followup', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'create-followup', sourceOutput: 'main', targetNodeId: 'loop-deals', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'loop-deals', sourceOutput: 'done', targetNodeId: 'notify-slack', targetInput: 'main' }
    ]
  },

  /**
   * Lead Scoring and Routing
   * Score new contacts and route to appropriate team member
   */
  leadScoringAndRouting: {
    id: 'template-lead-scoring-routing',
    name: 'Lead Scoring & Routing',
    description: 'Automatically score new contacts and route to the right sales rep based on score and territory',
    category: 'crm',
    icon: 'bar-chart-2',
    tags: ['crm', 'leads', 'scoring', 'routing', 'logos-vision'],
    estimatedTime: '5 min setup',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'contact_created',
        position: { x: 200, y: 100 },
        config: {
          sources: ['website_form', 'api', 'import']
        }
      },
      {
        id: 'calculate-score',
        type: 'crm',
        subtype: 'calculate_lead_score',
        position: { x: 200, y: 220 },
        config: {
          contactIdField: 'contact.id'
        }
      },
      {
        id: 'score-router',
        type: 'logic',
        subtype: 'switch',
        position: { x: 200, y: 340 },
        config: {
          field: 'leadScore.tier',
          cases: [
            { value: 'hot', output: 0 },
            { value: 'warm', output: 1 },
            { value: 'cool', output: 2 },
            { value: 'cold', output: 3 }
          ]
        }
      },
      {
        id: 'hot-lead-assign',
        type: 'crm',
        subtype: 'assign_owner',
        position: { x: 50, y: 480 },
        config: {
          objectType: 'contact',
          objectIdField: 'contact.id',
          newOwnerId: '{{$env.SENIOR_REP_ID}}'
        }
      },
      {
        id: 'hot-lead-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 600 },
        config: {
          channel: '#hot-leads',
          message: '🔥 *HOT LEAD*\n\n👤 {{contact.name}}\n🏢 {{contact.company}}\n📊 Score: {{leadScore.score}}/100\n\nAssigned to senior rep for immediate follow-up!'
        }
      },
      {
        id: 'warm-lead-task',
        type: 'crm',
        subtype: 'create_crm_task',
        position: { x: 150, y: 480 },
        config: {
          title: 'Qualify warm lead: {{contact.name}}',
          description: 'Lead score: {{leadScore.score}}/100\nCompany: {{contact.company}}\n\nSchedule discovery call.',
          priority: 'medium',
          dueDate: '{{$date.add(2, "days")}}',
          relatedContactId: '{{contact.id}}'
        }
      },
      {
        id: 'cool-lead-nurture',
        type: 'crm',
        subtype: 'update_contact',
        position: { x: 250, y: 480 },
        config: {
          contactIdField: 'contact.id',
          updates: {
            lead_status: 'nurture',
            nurture_sequence: 'standard_sequence'
          }
        }
      },
      {
        id: 'cold-lead-tag',
        type: 'crm',
        subtype: 'update_contact',
        position: { x: 350, y: 480 },
        config: {
          contactIdField: 'contact.id',
          updates: {
            lead_status: 'cold',
            tags: '["needs_enrichment"]'
          }
        }
      },
      {
        id: 'update-score',
        type: 'crm',
        subtype: 'update_contact',
        position: { x: 200, y: 700 },
        config: {
          contactIdField: 'contact.id',
          updates: {
            lead_score: '{{leadScore.score}}',
            lead_tier: '{{leadScore.tier}}',
            scored_at: '{{$date.now()}}'
          }
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'calculate-score', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'calculate-score', sourceOutput: 'main', targetNodeId: 'score-router', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'score-router', sourceOutput: '0', targetNodeId: 'hot-lead-assign', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'hot-lead-assign', sourceOutput: 'main', targetNodeId: 'hot-lead-notify', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'hot-lead-notify', sourceOutput: 'main', targetNodeId: 'update-score', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'score-router', sourceOutput: '1', targetNodeId: 'warm-lead-task', targetInput: 'main' },
      { id: 'c7', sourceNodeId: 'warm-lead-task', sourceOutput: 'main', targetNodeId: 'update-score', targetInput: 'main' },
      { id: 'c8', sourceNodeId: 'score-router', sourceOutput: '2', targetNodeId: 'cool-lead-nurture', targetInput: 'main' },
      { id: 'c9', sourceNodeId: 'cool-lead-nurture', sourceOutput: 'main', targetNodeId: 'update-score', targetInput: 'main' },
      { id: 'c10', sourceNodeId: 'score-router', sourceOutput: '3', targetNodeId: 'cold-lead-tag', targetInput: 'main' },
      { id: 'c11', sourceNodeId: 'cold-lead-tag', sourceOutput: 'main', targetNodeId: 'update-score', targetInput: 'main' }
    ]
  },

  /**
   * Meeting to CRM Sync
   * Sync meeting outcomes to CRM deals and contacts
   */
  meetingToCrmSync: {
    id: 'template-meeting-crm-sync',
    name: 'Meeting to CRM Sync',
    description: 'Automatically sync meeting outcomes, action items, and notes to Logos Vision CRM',
    category: 'crm',
    icon: 'refresh-cw',
    tags: ['crm', 'meetings', 'sync', 'logos-vision'],
    estimatedTime: '5 min setup',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'meeting_processed',
        position: { x: 100, y: 100 },
        config: {}
      },
      {
        id: 'lookup-contact',
        type: 'crm',
        subtype: 'lookup_contact',
        position: { x: 100, y: 220 },
        config: {
          searchBy: 'email',
          searchValueField: 'meeting.attendees[0].email'
        }
      },
      {
        id: 'check-contact',
        type: 'logic',
        subtype: 'if',
        position: { x: 100, y: 340 },
        config: {
          conditions: [
            { field: 'contact', operator: 'exists' }
          ]
        }
      },
      {
        id: 'lookup-deal',
        type: 'crm',
        subtype: 'lookup_deal',
        position: { x: 50, y: 480 },
        config: {
          searchBy: 'contact_id',
          searchValueField: 'contact.id',
          includeActivities: true
        }
      },
      {
        id: 'log-meeting',
        type: 'crm',
        subtype: 'log_activity',
        position: { x: 50, y: 600 },
        config: {
          activityType: 'meeting',
          subject: '{{meeting.title}}',
          description: 'Duration: {{meeting.duration}} minutes\n\nSummary:\n{{meeting.summary}}\n\nKey Points:\n{{meeting.keyPoints.join("\\n")}}',
          duration: '{{meeting.duration}}',
          relatedContactId: '{{contact.id}}',
          relatedDealId: '{{deal.id}}'
        }
      },
      {
        id: 'has-action-items',
        type: 'logic',
        subtype: 'if',
        position: { x: 50, y: 720 },
        config: {
          conditions: [
            { field: 'meeting.actionItems.length', operator: 'greater_than', value: 0 }
          ]
        }
      },
      {
        id: 'loop-actions',
        type: 'logic',
        subtype: 'loop',
        position: { x: 50, y: 840 },
        config: {
          arrayField: 'meeting.actionItems',
          itemVariable: 'actionItem'
        }
      },
      {
        id: 'create-task',
        type: 'crm',
        subtype: 'create_crm_task',
        position: { x: 50, y: 960 },
        config: {
          title: '{{actionItem.task_description}}',
          description: 'From meeting: {{meeting.title}}\n\nContext: {{actionItem.context}}',
          priority: '{{actionItem.priority}}',
          dueDate: '{{actionItem.due_date}}',
          assignee: '{{actionItem.assigned_to}}',
          relatedDealId: '{{deal.id}}',
          relatedContactId: '{{contact.id}}'
        }
      },
      {
        id: 'create-contact',
        type: 'crm',
        subtype: 'create_contact',
        position: { x: 200, y: 480 },
        config: {
          name: '{{meeting.attendees[0].name}}',
          email: '{{meeting.attendees[0].email}}',
          source: 'meeting'
        }
      },
      {
        id: 'notify-complete',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 100, y: 1100 },
        config: {
          channel: '#crm-sync',
          message: '✅ *Meeting synced to CRM*\n\n📝 {{meeting.title}}\n👤 Contact: {{contact.name || meeting.attendees[0].name}}\n💼 Deal: {{deal.name || "No linked deal"}}\n📋 Tasks created: {{meeting.actionItems.length}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'lookup-contact', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'lookup-contact', sourceOutput: 'found', targetNodeId: 'check-contact', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'lookup-contact', sourceOutput: 'not_found', targetNodeId: 'create-contact', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'check-contact', sourceOutput: 'true', targetNodeId: 'lookup-deal', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'create-contact', sourceOutput: 'main', targetNodeId: 'lookup-deal', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'lookup-deal', sourceOutput: 'found', targetNodeId: 'log-meeting', targetInput: 'main' },
      { id: 'c7', sourceNodeId: 'lookup-deal', sourceOutput: 'not_found', targetNodeId: 'log-meeting', targetInput: 'main' },
      { id: 'c8', sourceNodeId: 'log-meeting', sourceOutput: 'main', targetNodeId: 'has-action-items', targetInput: 'main' },
      { id: 'c9', sourceNodeId: 'has-action-items', sourceOutput: 'true', targetNodeId: 'loop-actions', targetInput: 'main' },
      { id: 'c10', sourceNodeId: 'loop-actions', sourceOutput: 'loop', targetNodeId: 'create-task', targetInput: 'main' },
      { id: 'c11', sourceNodeId: 'create-task', sourceOutput: 'main', targetNodeId: 'loop-actions', targetInput: 'main' },
      { id: 'c12', sourceNodeId: 'loop-actions', sourceOutput: 'done', targetNodeId: 'notify-complete', targetInput: 'main' },
      { id: 'c13', sourceNodeId: 'has-action-items', sourceOutput: 'false', targetNodeId: 'notify-complete', targetInput: 'main' }
    ]
  },

  /**
   * Task Overdue Escalation
   * Escalate overdue CRM tasks
   */
  taskOverdueEscalation: {
    id: 'template-task-overdue-escalation',
    name: 'Task Overdue Escalation',
    description: 'Automatically escalate overdue tasks and notify managers after configurable time periods',
    category: 'crm',
    icon: 'alert-circle',
    tags: ['crm', 'tasks', 'escalation', 'logos-vision'],
    estimatedTime: '3 min setup',
    nodes: [
      {
        id: 'trigger',
        type: 'trigger',
        subtype: 'task_overdue',
        position: { x: 200, y: 100 },
        config: {
          minDaysOverdue: 1
        }
      },
      {
        id: 'check-severity',
        type: 'logic',
        subtype: 'switch',
        position: { x: 200, y: 220 },
        config: {
          field: 'daysOverdue',
          cases: [
            { condition: '>=7', output: 0, label: 'critical' },
            { condition: '>=3', output: 1, label: 'warning' },
            { condition: '>=1', output: 2, label: 'notice' }
          ]
        }
      },
      {
        id: 'critical-escalation',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 50, y: 380 },
        config: {
          channel: '#management',
          message: '🚨 *CRITICAL: Task 7+ Days Overdue*\n\n📋 {{task.title}}\n👤 Assigned: {{task.assignee}}\n📅 Due: {{task.dueDate}}\n⏰ Overdue: {{daysOverdue}} days\n\nImmediate attention required!'
        }
      },
      {
        id: 'warning-notify',
        type: 'action',
        subtype: 'send_slack',
        position: { x: 200, y: 380 },
        config: {
          channel: '#sales-team',
          message: '⚠️ *Task Overdue Warning*\n\n📋 {{task.title}}\n👤 {{task.assignee}}\n⏰ {{daysOverdue}} days overdue\n\nPlease complete or update status.'
        }
      },
      {
        id: 'notice-reminder',
        type: 'action',
        subtype: 'send_email',
        position: { x: 350, y: 380 },
        config: {
          to: '{{task.assignee_email}}',
          subject: 'Reminder: Task overdue - {{task.title}}',
          body: 'Hi,\n\nYour task "{{task.title}}" is now {{daysOverdue}} day(s) overdue.\n\nPlease complete it as soon as possible or update the due date if needed.\n\nThanks!'
        }
      },
      {
        id: 'log-escalation',
        type: 'crm',
        subtype: 'log_activity',
        position: { x: 200, y: 520 },
        config: {
          activityType: 'note',
          subject: 'Task escalation: {{task.title}}',
          description: 'Task overdue by {{daysOverdue}} days. Escalation level: {{escalationLevel}}',
          relatedDealId: '{{task.deal_id}}',
          relatedContactId: '{{task.contact_id}}'
        }
      }
    ],
    connections: [
      { id: 'c1', sourceNodeId: 'trigger', sourceOutput: 'main', targetNodeId: 'check-severity', targetInput: 'main' },
      { id: 'c2', sourceNodeId: 'check-severity', sourceOutput: '0', targetNodeId: 'critical-escalation', targetInput: 'main' },
      { id: 'c3', sourceNodeId: 'check-severity', sourceOutput: '1', targetNodeId: 'warning-notify', targetInput: 'main' },
      { id: 'c4', sourceNodeId: 'check-severity', sourceOutput: '2', targetNodeId: 'notice-reminder', targetInput: 'main' },
      { id: 'c5', sourceNodeId: 'critical-escalation', sourceOutput: 'main', targetNodeId: 'log-escalation', targetInput: 'main' },
      { id: 'c6', sourceNodeId: 'warning-notify', sourceOutput: 'main', targetNodeId: 'log-escalation', targetInput: 'main' },
      { id: 'c7', sourceNodeId: 'notice-reminder', sourceOutput: 'main', targetNodeId: 'log-escalation', targetInput: 'main' }
    ]
  }
};

// Template categories metadata
const TEMPLATE_CATEGORIES = {
  crm: {
    id: 'crm',
    label: 'CRM (Logos Vision)',
    description: 'Templates for Logos Vision CRM workflows',
    icon: 'users',
    color: '#8b5cf6'
  },
  sales: {
    name: 'Sales',
    description: 'Templates for sales automation and follow-ups',
    icon: 'dollar-sign',
    color: '#10b981'
  },
  customer_success: {
    name: 'Customer Success',
    description: 'Templates for customer health and retention',
    icon: 'heart',
    color: '#8b5cf6'
  },
  operations: {
    name: 'Operations',
    description: 'Templates for business operations and pipelines',
    icon: 'settings',
    color: '#f59e0b'
  },
  meetings: {
    name: 'Meetings',
    description: 'Templates for meeting processing and follow-ups',
    icon: 'video',
    color: '#6366f1'
  },
  integrations: {
    name: 'Integrations',
    description: 'Templates for connecting external services',
    icon: 'plug',
    color: '#ec4899'
  },
  notifications: {
    name: 'Notifications',
    description: 'Templates for alerts and notifications',
    icon: 'bell',
    color: '#14b8a6'
  },
  automation: {
    name: 'Automation',
    description: 'General purpose automation templates',
    icon: 'zap',
    color: '#f97316'
  },
  system: {
    name: 'System',
    description: 'System and error handling templates',
    icon: 'shield',
    color: '#64748b'
  }
};

/**
 * Get all templates
 */
function getAllTemplates() {
  return Object.values(WorkflowTemplates);
}

/**
 * Get templates by category
 */
function getTemplatesByCategory(category) {
  return getAllTemplates().filter(t => t.category === category);
}

/**
 * Get template by ID
 */
function getTemplateById(id) {
  return getAllTemplates().find(t => t.id === id);
}

/**
 * Get available categories
 */
function getCategories() {
  const categories = new Set();
  for (const template of getAllTemplates()) {
    categories.add(template.category);
  }
  return Array.from(categories);
}

/**
 * Get category metadata
 */
function getCategoryMetadata() {
  return TEMPLATE_CATEGORIES;
}

module.exports = {
  templates: WorkflowTemplates,
  categories: TEMPLATE_CATEGORIES,
  getAllTemplates,
  getTemplatesByCategory,
  getTemplateById,
  getCategories,
  getCategoryMetadata
};
