/**
 * Action Node Handlers
 *
 * Nodes that perform actions: HTTP requests, notifications, database operations
 */

const BaseNode = require('./BaseNode');
const { supabase } = require('../../../config/supabase');
const log = require('../../../utils/log');

/**
 * HTTP Request Node - Make HTTP requests to any API
 */
class HttpRequestNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      method = 'GET',
      url,
      headers = {},
      queryParams = {},
      body = null,
      authentication = { type: 'none' },
      timeout = 30000,
      responseField = 'response'
    } = config;

    // Interpolate URL and other config values
    const resolvedUrl = this.interpolate(url, inputData);
    const resolvedHeaders = this.interpolateObject(headers, inputData);
    const resolvedBody = body ? this.interpolateObject(body, inputData) : null;

    // Build query string
    const queryString = this.buildQueryString(queryParams, inputData);
    const fullUrl = queryString ? `${resolvedUrl}?${queryString}` : resolvedUrl;

    log.info(`[HttpRequestNode] ${method} ${fullUrl}`);

    // Apply authentication
    const authHeaders = await this.applyAuthentication(authentication, context);
    const allHeaders = { ...resolvedHeaders, ...authHeaders };

    // Set content type for body
    if (resolvedBody && !allHeaders['Content-Type']) {
      allHeaders['Content-Type'] = 'application/json';
    }

    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const fetchOptions = {
        method,
        headers: allHeaders,
        signal: controller.signal
      };

      if (resolvedBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
        fetchOptions.body = JSON.stringify(resolvedBody);
      }

      const response = await fetch(fullUrl, fetchOptions);
      clearTimeout(timeoutId);

      // Parse response
      let responseData;
      const contentType = response.headers.get('content-type');

      if (contentType?.includes('application/json')) {
        responseData = await response.json();
      } else {
        responseData = await response.text();
      }

      log.info(`[HttpRequestNode] Response: ${response.status} ${response.statusText}`);

      return {
        output: 'main',
        data: {
          ...inputData,
          [responseField]: {
            statusCode: response.status,
            statusText: response.statusText,
            headers: Object.fromEntries(response.headers),
            data: responseData
          }
        }
      };

    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error(`HTTP request timed out after ${timeout}ms`);
      }
      throw error;
    }
  }

  static interpolateObject(obj, data) {
    if (!obj) return obj;

    const result = {};
    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        result[key] = this.interpolate(value, data);
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.interpolateObject(value, data);
      } else {
        result[key] = value;
      }
    }
    return result;
  }

  static buildQueryString(params, data) {
    const interpolated = this.interpolateObject(params, data);
    const entries = Object.entries(interpolated).filter(([_, v]) => v !== undefined && v !== null);
    if (entries.length === 0) return '';
    return entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
  }

  static async applyAuthentication(auth, context) {
    const headers = {};

    switch (auth.type) {
      case 'basic':
        const credentials = Buffer.from(`${auth.username}:${auth.password}`).toString('base64');
        headers['Authorization'] = `Basic ${credentials}`;
        break;

      case 'bearer':
        headers['Authorization'] = `Bearer ${auth.token}`;
        break;

      case 'api_key':
        if (auth.addTo === 'header') {
          headers[auth.name || 'X-API-Key'] = auth.value;
        }
        break;

      case 'credential':
        // Load credential from database
        if (auth.credentialId) {
          try {
            const { data: cred } = await supabase
              .from('credentials')
              .select('data')
              .eq('id', auth.credentialId)
              .single();

            if (cred?.data) {
              // Apply credential based on its type
              return this.applyAuthentication({ ...auth, ...cred.data }, context);
            }
          } catch (err) {
            log.warn('[HttpRequestNode] Failed to load credential:', err);
          }
        }
        break;
    }

    return headers;
  }
}

/**
 * Execute Workflow Node - Run a sub-workflow
 */
class ExecuteWorkflowNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      workflowId,
      waitForCompletion = true,
      timeout = 60000,
      inputMapping = {}
    } = config;

    log.info(`[ExecuteWorkflowNode] Executing sub-workflow: ${workflowId}`);

    // Get the workflow
    const { data: workflow, error } = await supabase
      .from('workflows')
      .select('*')
      .eq('id', workflowId)
      .single();

    if (error || !workflow) {
      throw new Error(`Sub-workflow not found: ${workflowId}`);
    }

    // Map input data
    let mappedInput = inputData;
    if (Object.keys(inputMapping).length > 0) {
      mappedInput = {};
      for (const [targetField, sourceExpr] of Object.entries(inputMapping)) {
        mappedInput[targetField] = this.interpolate(sourceExpr, inputData);
      }
    }

    // Get workflow executor (avoid circular dependency)
    const WorkflowExecutor = require('../WorkflowExecutor');
    const executor = new WorkflowExecutor();

    if (waitForCompletion) {
      // Execute and wait
      const result = await Promise.race([
        executor.execute(workflow, mappedInput, {
          mode: 'sub_workflow',
          triggeredBy: 'sub_workflow',
          calledByWorkflowId: context.workflowId,
          calledByExecutionId: context.executionId
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Sub-workflow timeout')), timeout)
        )
      ]);

      log.info(`[ExecuteWorkflowNode] Sub-workflow completed: ${result.success ? 'success' : 'failed'}`);

      return {
        output: 'main',
        data: {
          ...inputData,
          subWorkflow: {
            workflowId,
            executionId: result.executionId,
            success: result.success,
            output: result.output,
            error: result.error
          }
        }
      };
    } else {
      // Fire and forget
      executor.execute(workflow, mappedInput, {
        mode: 'sub_workflow',
        triggeredBy: 'sub_workflow'
      }).catch(err => {
        log.error('[ExecuteWorkflowNode] Background sub-workflow failed:', { error: err.message || err });
      });

      return {
        output: 'main',
        data: {
          ...inputData,
          subWorkflow: {
            workflowId,
            started: true,
            waitForCompletion: false
          }
        }
      };
    }
  }
}

/**
 * Send Slack Node - Post to Slack
 */
class SendSlackNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { channel, message, blocks = null } = config;

    const resolvedChannel = this.interpolate(channel, inputData);
    const resolvedMessage = this.interpolate(message, inputData);

    log.info(`[SendSlackNode] Posting to channel: ${resolvedChannel}`);

    // Try to use chat service
    try {
      const chatService = require('../../chatService');

      if (blocks) {
        await chatService.postBlocks(resolvedChannel, blocks, resolvedMessage);
      } else {
        await chatService.postMessage(resolvedChannel, resolvedMessage);
      }

      return {
        output: 'main',
        data: {
          ...inputData,
          slack: {
            success: true,
            channel: resolvedChannel,
            message: resolvedMessage
          }
        }
      };
    } catch (err) {
      // Fallback to webhook if available
      const webhookUrl = process.env.SLACK_WEBHOOK_URL;

      if (webhookUrl) {
        const response = await fetch(webhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channel: resolvedChannel,
            text: resolvedMessage,
            blocks
          })
        });

        if (!response.ok) {
          throw new Error(`Slack webhook failed: ${response.statusText}`);
        }

        return {
          output: 'main',
          data: {
            ...inputData,
            slack: { success: true, channel: resolvedChannel }
          }
        };
      }

      log.warn('[SendSlackNode] Slack not configured, logging message');
      return {
        output: 'main',
        data: {
          ...inputData,
          slack: { success: false, logged: true, message: resolvedMessage }
        }
      };
    }
  }
}

/**
 * Send Pulse Node - Post to Pulse channels (preferred Entomate comm app)
 *
 * Routes via Ecosystem Bridge API, falls back to direct pulse_messages insert.
 * Supports auto-channel routing, {{template}} variables, and @mentions.
 */
class SendPulseNode extends BaseNode {
  static async execute(config, inputData, context) {
    const {
      channel = 'general',
      message,
      mentionOwner = false,
      mentionAssignee = false,
      includeLink = false
    } = config;

    const resolvedChannel = this.resolveChannel(
      this.interpolate(channel, inputData),
      inputData
    );
    let resolvedMessage = this.interpolate(message, inputData);

    // Add mentions
    const mentions = [];
    if (mentionOwner && inputData.ownerId) {
      mentions.push(`@${inputData.ownerName || inputData.ownerId}`);
    }
    if (mentionAssignee && inputData.assigneeId) {
      mentions.push(`@${inputData.assigneeName || inputData.assigneeId}`);
    }
    if (mentions.length > 0) {
      resolvedMessage = `${mentions.join(' ')} ${resolvedMessage}`;
    }

    // Add link if configured
    if (includeLink && inputData.link) {
      resolvedMessage += `\n🔗 ${inputData.link}`;
    }

    log.info(`[SendPulseNode] Posting to Pulse channel: ${resolvedChannel}`);

    // Post via Ecosystem Bridge — the only correct cross-app path.
    // Pulse's entomateService.handleBotMessage() resolves/creates bot channels
    // and inserts into chat_messages with bot_content, is_bot_message=true.
    // Direct Supabase inserts won't work (different database + wrong table schema).
    const apiBaseUrl = process.env.PULSE_API_URL || process.env.API_BASE_URL || '';
    if (!apiBaseUrl) {
      throw new Error('Pulse API URL not configured (set PULSE_API_URL or API_BASE_URL)');
    }

    try {
      // Map channel name to Pulse bot channel purpose
      const channelPurpose = this.mapChannelToPurpose(resolvedChannel);

      const response = await fetch(`${apiBaseUrl}/api/ecosystem/pulse`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: channelPurpose,
          message: resolvedMessage,
          title: config.title ? this.interpolate(config.title, inputData) : undefined,
          urgency: config.urgency || 'normal',
          metadata: {
            source: 'entomate_workflow',
            workflow_id: context.workflowId,
            execution_id: context.executionId,
            node_id: context.nodeId
          }
        })
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => response.statusText);
        throw new Error(`Pulse bridge returned ${response.status}: ${errorBody}`);
      }

      const data = await response.json();
      log.info('[SendPulseNode] Posted via Ecosystem Bridge');
      return {
        output: 'main',
        data: {
          ...inputData,
          pulse: {
            success: true,
            messageId: data.eventLogId || data.id || data.messageId,
            channel: resolvedChannel,
            channelPurpose,
            message: resolvedMessage,
            viaBridge: true
          }
        }
      };
    } catch (err) {
      log.error('[SendPulseNode] Failed to post:', { error: err.message || err });
      throw new Error(`Pulse message failed: ${err.message}`);
    }
  }

  /**
   * Resolve 'auto' channel based on input data context
   */
  static resolveChannel(channel, data) {
    if (channel === 'auto') {
      if (data.dealId || data.deal_id) return 'sales';
      if (data.projectId || data.project_id) return 'projects';
      if (data.customerId || data.customer_id) return 'customer-success';
      if (data.meetingId || data.meeting_id) return 'meetings';
      return 'general';
    }
    return channel;
  }

  /**
   * Map user-facing channel names to Pulse bot channel purposes.
   * Pulse's entomateService.resolveOrCreateBotChannel() uses these
   * to find or create entomate-* channels in the workspace.
   */
  static mapChannelToPurpose(channel) {
    const purposeMap = {
      'general': 'automations',
      'meetings': 'meetings',
      'sales': 'alerts',
      'projects': 'alerts',
      'customer-success': 'alerts',
      'alerts': 'alerts',
      'action-items': 'action_items',
      'automations': 'automations'
    };
    return purposeMap[channel] || 'automations';
  }

  static getTestData() {
    return {
      message: 'Test message from workflow',
      channel: 'general'
    };
  }

  static validate(config) {
    const errors = [];
    if (!config.message) {
      errors.push('Message is required');
    }
    return { valid: errors.length === 0, errors };
  }
}

/**
 * Send Email Node
 */
class SendEmailNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { to, subject, body, html = false } = config;

    const resolvedTo = this.interpolate(to, inputData);
    const resolvedSubject = this.interpolate(subject, inputData);
    const resolvedBody = this.interpolate(body, inputData);

    log.info(`[SendEmailNode] Sending email to: ${resolvedTo}`);

    try {
      const emailService = require('../../emailService');
      await emailService.send({
        to: resolvedTo,
        subject: resolvedSubject,
        body: resolvedBody,
        html
      });

      return {
        output: 'main',
        data: {
          ...inputData,
          email: { success: true, to: resolvedTo, subject: resolvedSubject }
        }
      };
    } catch (err) {
      log.warn('[SendEmailNode] Email service error:', err.message);

      // Fallback to SendGrid if configured
      if (process.env.SENDGRID_API_KEY) {
        const sgMail = require('@sendgrid/mail');
        sgMail.setApiKey(process.env.SENDGRID_API_KEY);

        await sgMail.send({
          to: resolvedTo,
          from: process.env.SENDGRID_FROM_EMAIL || 'noreply@entomate.com',
          subject: resolvedSubject,
          text: html ? undefined : resolvedBody,
          html: html ? resolvedBody : undefined
        });

        return {
          output: 'main',
          data: {
            ...inputData,
            email: { success: true, to: resolvedTo }
          }
        };
      }

      log.warn('[SendEmailNode] No email service configured, logging');
      return {
        output: 'main',
        data: {
          ...inputData,
          email: { success: false, logged: true }
        }
      };
    }
  }
}

/**
 * Create Task Node
 */
class CreateTaskNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { title, description, priority = 'medium', dueDate, assignedTo, projectId } = config;

    const resolvedTitle = this.interpolate(title, inputData);
    const resolvedDescription = description ? this.interpolate(description, inputData) : null;
    const resolvedDueDate = dueDate ? this.interpolate(dueDate, inputData) : null;
    const resolvedAssignedTo = assignedTo ? this.interpolate(assignedTo, inputData) : null;

    log.info(`[CreateTaskNode] Creating task: ${resolvedTitle}`);

    // TODO(S1c/S8): stamp org_id once the workflow engine threads org context
    // through inputData. This node is part of the half-done workflow-executor
    // refactor. After org_id is NOT NULL, an un-stamped insert fails closed.
    const { data: task, error } = await supabase
      .from('tasks')
      .insert({
        title: resolvedTitle,
        description: resolvedDescription,
        priority,
        due_date: resolvedDueDate,
        assigned_to: resolvedAssignedTo,
        project_id: projectId || inputData.project_id,
        org_id: inputData.org_id || null,
        status: 'open',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create task: ${error.message}`);
    }

    log.info(`[CreateTaskNode] Task created: ${task.id}`);

    return {
      output: 'main',
      data: {
        ...inputData,
        createdTask: task
      }
    };
  }
}

/**
 * Sync CRM Node
 */
class SyncCrmNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { objectType = 'task', operation = 'create', fieldMapping = {} } = config;

    log.info(`[SyncCrmNode] ${operation} ${objectType} in CRM`);

    try {
      const crmService = require('../../crmService');

      // Map fields
      const mappedData = {};
      for (const [crmField, sourceExpr] of Object.entries(fieldMapping)) {
        mappedData[crmField] = this.interpolate(sourceExpr, inputData);
      }

      let result;

      switch (operation) {
        case 'create':
          result = await crmService.create(objectType, mappedData);
          break;
        case 'update':
          result = await crmService.update(objectType, mappedData.id, mappedData);
          break;
        case 'upsert':
          result = await crmService.upsert(objectType, mappedData);
          break;
        default:
          throw new Error(`Unknown CRM operation: ${operation}`);
      }

      return {
        output: 'main',
        data: {
          ...inputData,
          crm: {
            success: true,
            operation,
            objectType,
            result
          }
        }
      };

    } catch (err) {
      log.error('[SyncCrmNode] CRM sync error:', { error: err.message || err });
      return {
        output: 'main',
        data: {
          ...inputData,
          crm: {
            success: false,
            error: err.message
          }
        }
      };
    }
  }
}

/**
 * Respond to Webhook Node - Send response back
 */
class RespondWebhookNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { statusCode = 200, headers = {}, body } = config;

    // Store response in context for webhook handler to use
    context.webhookResponse = {
      statusCode,
      headers,
      body: body ? this.interpolateObject(body, inputData) : inputData
    };

    log.info(`[RespondWebhookNode] Prepared response with status ${statusCode}`);

    return {
      output: 'main',
      data: inputData
    };
  }
}

/**
 * Set Variable Node
 */
class SetVariableNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { variables = {} } = config;

    const result = { ...inputData };

    for (const [key, value] of Object.entries(variables)) {
      const resolvedValue = typeof value === 'string'
        ? this.interpolate(value, inputData)
        : value;

      this.setNestedValue(result, key, resolvedValue);
    }

    log.info(`[SetVariableNode] Set ${Object.keys(variables).length} variables`);

    return {
      output: 'main',
      data: result
    };
  }
}

/**
 * Code Node - Execute custom JavaScript
 */
class CodeNode extends BaseNode {
  static async execute(config, inputData, context) {
    const { code, language = 'javascript' } = config;

    if (language !== 'javascript') {
      throw new Error(`Unsupported language: ${language}`);
    }

    log.info('[CodeNode] Executing custom code');

    try {
      // Create a sandboxed execution environment
      const AsyncFunction = Object.getPrototypeOf(async function(){}).constructor;

      // Allowed globals
      const sandbox = {
        console: {
          log: (...args) => log.info('[CodeNode]', ...args),
          warn: (...args) => log.warn('[CodeNode]', ...args),
          error: (...args) => log.error('[CodeNode]', ...args)
        },
        JSON,
        Date,
        Math,
        Array,
        Object,
        String,
        Number,
        Boolean,
        RegExp,
        Error,
        Promise,
        setTimeout: (fn, ms) => setTimeout(fn, Math.min(ms, 10000)), // Max 10s
        $input: inputData,
        $context: {
          nodeId: context.nodeId,
          workflowId: context.workflowId,
          executionId: context.executionId
        }
      };

      // Wrap code in async function that returns $output
      const wrappedCode = `
        const $input = this.$input;
        const $context = this.$context;
        let $output = {};

        ${code}

        return $output;
      `;

      const fn = new AsyncFunction(wrappedCode);
      const result = await fn.call(sandbox);

      log.info('[CodeNode] Code executed successfully');

      return {
        output: 'main',
        data: {
          ...inputData,
          ...result
        }
      };

    } catch (error) {
      log.error('[CodeNode] Execution error:', { error: error.message || error });
      throw new Error(`Code execution failed: ${error.message}`);
    }
  }
}

module.exports = {
  HttpRequestNode,
  ExecuteWorkflowNode,
  SendSlackNode,
  SendPulseNode,
  SendEmailNode,
  CreateTaskNode,
  SyncCrmNode,
  RespondWebhookNode,
  SetVariableNode,
  CodeNode
};
