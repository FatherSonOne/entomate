/**
 * Trigger Node Handlers
 *
 * These are entry points for workflows - they don't "execute" in the traditional sense
 * but provide the input data format for the workflow
 */

const BaseNode = require('./BaseNode');

/**
 * Webhook Trigger - Receives HTTP requests
 */
class WebhookTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    // Webhook trigger passes through the received data
    return {
      output: 'main',
      data: {
        headers: inputData.headers || {},
        query: inputData.query || {},
        body: inputData.body || inputData,
        method: inputData.method || 'POST',
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      headers: { 'content-type': 'application/json' },
      query: { test: 'true' },
      body: { message: 'Test webhook data' },
      method: 'POST'
    };
  }
}

/**
 * Schedule Trigger - Cron-based execution
 */
class ScheduleTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    return {
      output: 'main',
      data: {
        scheduledTime: inputData.scheduledTime || new Date().toISOString(),
        cron: config.cron,
        timezone: config.timezone || 'UTC',
        executionCount: inputData.executionCount || 1
      }
    };
  }

  static getTestData() {
    return {
      scheduledTime: new Date().toISOString(),
      executionCount: 1
    };
  }
}

/**
 * Meeting Processed Trigger
 */
class MeetingProcessedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    // Pass through meeting data
    return {
      output: 'main',
      data: {
        meeting: inputData.meeting || inputData,
        meetingId: inputData.meeting_id || inputData.id,
        title: inputData.title,
        transcript: inputData.transcript,
        summary: inputData.summary,
        actionItems: inputData.action_items || inputData.actionItems || [],
        attendees: inputData.attendees || [],
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      meeting_id: 'test-meeting-123',
      title: 'Test Meeting',
      transcript: 'This is a test meeting transcript. We need to follow up with the client next week.',
      summary: 'Discussed project timeline and next steps.',
      action_items: [
        { task: 'Follow up with client', assignee: 'John', priority: 'high' }
      ],
      attendees: ['john@example.com', 'jane@example.com']
    };
  }
}

/**
 * Action Item Created Trigger
 */
class ActionItemCreatedTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    return {
      output: 'main',
      data: {
        actionItem: inputData,
        id: inputData.id,
        task: inputData.task_description || inputData.task,
        assignee: inputData.assigned_to_name || inputData.assignee,
        assigneeEmail: inputData.assigned_to_email,
        priority: inputData.priority || 'medium',
        dueDate: inputData.due_date || inputData.dueDate,
        meetingId: inputData.meeting_id,
        meetingTitle: inputData.meeting_title,
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      id: 'test-action-item-123',
      task_description: 'Complete the project proposal',
      assigned_to_name: 'Jane Doe',
      assigned_to_email: 'jane@example.com',
      priority: 'high',
      due_date: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      meeting_id: 'test-meeting-123',
      meeting_title: 'Project Kickoff'
    };
  }
}

/**
 * Error Trigger - Receives error context from failed workflows
 */
class ErrorTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    return {
      output: 'main',
      data: {
        error: inputData.error || {},
        workflow: inputData.workflow || {},
        execution: inputData.execution || {},
        timestamp: new Date().toISOString()
      }
    };
  }

  static getTestData() {
    return {
      error: {
        message: 'Test error message',
        stack: 'Error: Test error\n    at TestNode.execute'
      },
      workflow: {
        id: 'test-workflow-123',
        name: 'Test Workflow'
      },
      execution: {
        id: 'test-execution-123',
        startedAt: new Date().toISOString(),
        failedNodeId: 'node-456'
      }
    };
  }
}

/**
 * Manual Trigger - User-initiated execution
 */
class ManualTrigger extends BaseNode {
  static async execute(config, inputData, context) {
    return {
      output: 'main',
      data: {
        ...inputData,
        manuallyTriggered: true,
        triggeredAt: new Date().toISOString(),
        triggeredBy: context.userId || 'unknown'
      }
    };
  }

  static getTestData() {
    return {
      testData: true,
      message: 'Manual trigger test'
    };
  }
}

module.exports = {
  WebhookTrigger,
  ScheduleTrigger,
  MeetingProcessedTrigger,
  ActionItemCreatedTrigger,
  ErrorTrigger,
  ManualTrigger
};
