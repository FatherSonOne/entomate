/**
 * NodeRegistry - Registry of all available node types
 *
 * Manages node handlers and provides node metadata
 */

// Node handlers
const TriggerNodes = require('./nodes/TriggerNodes');
const LogicNodes = require('./nodes/LogicNodes');
const ActionNodes = require('./nodes/ActionNodes');
const AINodes = require('./nodes/AINodes');
const DataNodes = require('./nodes/DataNodes');
const RAGNodes = require('./nodes/RAGNodes');
const CRMNodes = require('./nodes/CRMNodes');

class NodeRegistry {
  constructor() {
    this.handlers = new Map();
    this.nodeDefinitions = new Map();

    // Register all node types
    this.registerBuiltinNodes();
  }

  /**
   * Register built-in node types
   */
  registerBuiltinNodes() {
    // ========================================
    // TRIGGER NODES
    // ========================================
    this.register('trigger', 'webhook', {
      name: 'Webhook',
      description: 'Trigger workflow from HTTP request',
      icon: 'webhook',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {
        path: { type: 'string', required: true },
        method: { type: 'enum', values: ['GET', 'POST', 'PUT', 'DELETE'], default: 'POST' },
        authentication: { type: 'object', default: { type: 'none' } },
        responseMode: { type: 'enum', values: ['immediate', 'last_node', 'custom'], default: 'immediate' }
      },
      handler: TriggerNodes.WebhookTrigger
    });

    this.register('trigger', 'schedule', {
      name: 'Schedule',
      description: 'Trigger workflow on a schedule',
      icon: 'clock',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {
        cron: { type: 'string', required: true },
        timezone: { type: 'string', default: 'UTC' }
      },
      handler: TriggerNodes.ScheduleTrigger
    });

    this.register('trigger', 'meeting_processed', {
      name: 'Meeting Processed',
      description: 'When a meeting is transcribed and analyzed',
      icon: 'file-text',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {
        conditions: { type: 'array', default: [] }
      },
      handler: TriggerNodes.MeetingProcessedTrigger
    });

    this.register('trigger', 'action_item_created', {
      name: 'Action Item Created',
      description: 'When an action item is extracted from a meeting',
      icon: 'check-square',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {
        conditions: { type: 'array', default: [] }
      },
      handler: TriggerNodes.ActionItemCreatedTrigger
    });

    this.register('trigger', 'error', {
      name: 'Error Trigger',
      description: 'Triggered when another workflow fails',
      icon: 'alert-triangle',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {
        listenTo: { type: 'enum', values: ['all', 'specific'], default: 'all' },
        workflowIds: { type: 'array', default: [] }
      },
      handler: TriggerNodes.ErrorTrigger
    });

    this.register('trigger', 'manual', {
      name: 'Manual Trigger',
      description: 'Manually trigger workflow',
      icon: 'play',
      category: 'trigger',
      inputs: [],
      outputs: ['main'],
      configSchema: {},
      handler: TriggerNodes.ManualTrigger
    });

    // ========================================
    // LOGIC NODES
    // ========================================
    this.register('logic', 'if', {
      name: 'IF',
      description: 'Branch based on conditions',
      icon: 'git-branch',
      category: 'logic',
      inputs: ['main'],
      outputs: ['true', 'false'],
      configSchema: {
        conditions: {
          type: 'array',
          items: {
            field: { type: 'string', required: true },
            operator: { type: 'enum', values: ['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'exists', 'not_exists', 'regex', 'starts_with', 'ends_with'], required: true },
            value: { type: 'any' },
            combineWith: { type: 'enum', values: ['AND', 'OR'], default: 'AND' }
          }
        }
      },
      handler: LogicNodes.IfNode
    });

    this.register('logic', 'switch', {
      name: 'Switch',
      description: 'Route to multiple branches based on value',
      icon: 'shuffle',
      category: 'logic',
      inputs: ['main'],
      outputs: ['0', '1', '2', '3', 'default'],
      configSchema: {
        field: { type: 'string', required: true },
        cases: {
          type: 'array',
          items: {
            value: { type: 'any', required: true },
            output: { type: 'number', required: true }
          }
        }
      },
      handler: LogicNodes.SwitchNode
    });

    this.register('logic', 'merge', {
      name: 'Merge',
      description: 'Combine multiple branches',
      icon: 'git-merge',
      category: 'logic',
      inputs: ['input1', 'input2', 'input3'],
      outputs: ['main'],
      configSchema: {
        mode: { type: 'enum', values: ['wait_all', 'pass_through', 'combine'], default: 'wait_all' },
        combineStrategy: { type: 'enum', values: ['merge', 'append', 'zip'], default: 'merge' }
      },
      handler: LogicNodes.MergeNode
    });

    this.register('logic', 'split_batches', {
      name: 'Split in Batches',
      description: 'Process items in batches',
      icon: 'layers',
      category: 'logic',
      inputs: ['main'],
      outputs: ['loop', 'done'],
      configSchema: {
        batchSize: { type: 'number', default: 10 },
        inputField: { type: 'string', default: 'items' }
      },
      handler: LogicNodes.SplitBatchesNode
    });

    this.register('logic', 'loop', {
      name: 'Loop',
      description: 'Iterate over items',
      icon: 'repeat',
      category: 'logic',
      inputs: ['main'],
      outputs: ['each', 'done'],
      configSchema: {
        inputField: { type: 'string', default: 'items' },
        itemVariable: { type: 'string', default: 'item' },
        indexVariable: { type: 'string', default: 'index' }
      },
      handler: LogicNodes.LoopNode
    });

    this.register('logic', 'aggregate', {
      name: 'Aggregate',
      description: 'Collect results from loop',
      icon: 'archive',
      category: 'logic',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        operation: { type: 'enum', values: ['collect', 'sum', 'count', 'first', 'last', 'flatten'], default: 'collect' },
        outputField: { type: 'string', default: 'results' }
      },
      handler: LogicNodes.AggregateNode
    });

    this.register('logic', 'filter', {
      name: 'Filter',
      description: 'Filter items based on condition',
      icon: 'filter',
      category: 'logic',
      inputs: ['main'],
      outputs: ['matches', 'no_match'],
      configSchema: {
        field: { type: 'string', required: true },
        operator: { type: 'enum', values: ['equals', 'not_equals', 'contains', 'greater_than', 'less_than', 'exists'], required: true },
        value: { type: 'any' }
      },
      handler: LogicNodes.FilterNode
    });

    this.register('logic', 'wait', {
      name: 'Wait',
      description: 'Pause execution for a duration',
      icon: 'clock',
      category: 'logic',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        duration: { type: 'number', required: true },
        unit: { type: 'enum', values: ['ms', 'seconds', 'minutes', 'hours'], default: 'seconds' }
      },
      handler: LogicNodes.WaitNode
    });

    this.register('logic', 'stop_error', {
      name: 'Stop and Error',
      description: 'Stop execution and trigger error workflow',
      icon: 'alert-octagon',
      category: 'logic',
      inputs: ['main'],
      outputs: [],
      configSchema: {
        errorMessage: { type: 'string', default: 'Workflow stopped by Stop and Error node' }
      },
      handler: LogicNodes.StopErrorNode
    });

    // ========================================
    // ACTION NODES
    // ========================================
    this.register('action', 'http_request', {
      name: 'HTTP Request',
      description: 'Make HTTP requests to any API',
      icon: 'globe',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        method: { type: 'enum', values: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], default: 'GET' },
        url: { type: 'string', required: true },
        headers: { type: 'object', default: {} },
        queryParams: { type: 'object', default: {} },
        body: { type: 'object', default: null },
        authentication: { type: 'object', default: { type: 'none' } },
        timeout: { type: 'number', default: 30000 },
        responseField: { type: 'string', default: 'response' }
      },
      handler: ActionNodes.HttpRequestNode
    });

    this.register('action', 'execute_workflow', {
      name: 'Execute Workflow',
      description: 'Execute another workflow (sub-workflow)',
      icon: 'play-circle',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        workflowId: { type: 'string', required: true },
        waitForCompletion: { type: 'boolean', default: true },
        timeout: { type: 'number', default: 60000 },
        inputMapping: { type: 'object', default: {} }
      },
      handler: ActionNodes.ExecuteWorkflowNode
    });

    this.register('action', 'send_slack', {
      name: 'Send to Slack',
      description: 'Post message to Slack channel',
      icon: 'message-square',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        channel: { type: 'string', required: true },
        message: { type: 'string', required: true },
        blocks: { type: 'array', default: null }
      },
      handler: ActionNodes.SendSlackNode
    });

    this.register('action', 'send_pulse', {
      name: 'Send to Pulse',
      description: 'Post message to Pulse channel (preferred comm app)',
      icon: 'radio',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        channel: { type: 'string', default: 'general' },
        message: { type: 'string', required: true },
        title: { type: 'string' },
        mentionOwner: { type: 'boolean', default: false },
        mentionAssignee: { type: 'boolean', default: false },
        includeLink: { type: 'boolean', default: false }
      },
      handler: ActionNodes.SendPulseNode
    });

    this.register('action', 'send_email', {
      name: 'Send Email',
      description: 'Send email notification',
      icon: 'mail',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        to: { type: 'string', required: true },
        subject: { type: 'string', required: true },
        body: { type: 'string', required: true },
        html: { type: 'boolean', default: false }
      },
      handler: ActionNodes.SendEmailNode
    });

    this.register('action', 'create_task', {
      name: 'Create Task',
      description: 'Create a new task',
      icon: 'plus-square',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        title: { type: 'string', required: true },
        description: { type: 'string' },
        priority: { type: 'enum', values: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        dueDate: { type: 'string' },
        assignedTo: { type: 'string' }
      },
      handler: ActionNodes.CreateTaskNode
    });

    this.register('action', 'sync_crm', {
      name: 'Sync to CRM',
      description: 'Sync data to CRM system',
      icon: 'database',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        objectType: { type: 'enum', values: ['deal', 'contact', 'task', 'note'], default: 'task' },
        operation: { type: 'enum', values: ['create', 'update', 'upsert'], default: 'create' },
        fieldMapping: { type: 'object', default: {} }
      },
      handler: ActionNodes.SyncCrmNode
    });

    this.register('action', 'respond_webhook', {
      name: 'Respond to Webhook',
      description: 'Send response back to webhook caller',
      icon: 'arrow-left',
      category: 'action',
      inputs: ['main'],
      outputs: [],
      configSchema: {
        statusCode: { type: 'number', default: 200 },
        headers: { type: 'object', default: {} },
        body: { type: 'any' }
      },
      handler: ActionNodes.RespondWebhookNode
    });

    this.register('action', 'set_variable', {
      name: 'Set Variable',
      description: 'Set a variable for use in later nodes',
      icon: 'edit-3',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        variables: { type: 'object', required: true }
      },
      handler: ActionNodes.SetVariableNode
    });

    this.register('action', 'code', {
      name: 'Code',
      description: 'Execute custom JavaScript code',
      icon: 'code',
      category: 'action',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        code: { type: 'string', required: true },
        language: { type: 'enum', values: ['javascript'], default: 'javascript' }
      },
      handler: ActionNodes.CodeNode
    });

    // ========================================
    // AI NODES
    // ========================================
    this.register('ai', 'ai_agent', {
      name: 'AI Agent',
      description: 'Run built-in AI agent',
      icon: 'cpu',
      category: 'ai',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        agent: { type: 'enum', values: ['assignment', 'priority', 'deadline', 'followup'], required: true },
        autoApply: { type: 'boolean', default: false }
      },
      handler: AINodes.AIAgentNode
    });

    this.register('ai', 'ai_prompt', {
      name: 'AI Prompt',
      description: 'Send custom prompt to LLM',
      icon: 'message-circle',
      category: 'ai',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        prompt: { type: 'string', required: true },
        model: { type: 'string', default: 'gemini-pro' },
        temperature: { type: 'number', default: 0.7 },
        outputField: { type: 'string', default: 'aiResponse' }
      },
      handler: AINodes.AIPromptNode
    });

    this.register('ai', 'ai_extract', {
      name: 'AI Extract',
      description: 'Extract structured data using AI',
      icon: 'file-search',
      category: 'ai',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        inputField: { type: 'string', required: true },
        schema: { type: 'object', required: true },
        outputField: { type: 'string', default: 'extracted' }
      },
      handler: AINodes.AIExtractNode
    });

    this.register('ai', 'ai_classify', {
      name: 'AI Classify',
      description: 'Classify content using AI',
      icon: 'tag',
      category: 'ai',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        inputField: { type: 'string', required: true },
        categories: { type: 'array', required: true },
        outputField: { type: 'string', default: 'category' }
      },
      handler: AINodes.AIClassifyNode
    });

    this.register('ai', 'detect_followups', {
      name: 'Detect Follow-ups',
      description: 'Detect follow-up opportunities in content',
      icon: 'refresh-cw',
      category: 'ai',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        inputField: { type: 'string', default: 'transcript' },
        autoCreate: { type: 'boolean', default: false }
      },
      handler: AINodes.DetectFollowupsNode
    });

    // ========================================
    // DATA NODES
    // ========================================
    this.register('data', 'transform', {
      name: 'Transform Data',
      description: 'Transform data structure',
      icon: 'shuffle',
      category: 'data',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        mappings: { type: 'array', required: true }
      },
      handler: DataNodes.TransformNode
    });

    this.register('data', 'split', {
      name: 'Split',
      description: 'Split a single item into multiple items',
      icon: 'scissors',
      category: 'data',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        field: { type: 'string', required: true },
        delimiter: { type: 'string', default: ',' }
      },
      handler: DataNodes.SplitNode
    });

    this.register('data', 'set', {
      name: 'Set',
      description: 'Set or modify data fields',
      icon: 'edit',
      category: 'data',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        values: { type: 'object', required: true },
        mode: { type: 'enum', values: ['set', 'append', 'remove'], default: 'set' }
      },
      handler: DataNodes.SetNode
    });

    this.register('data', 'date_time', {
      name: 'Date & Time',
      description: 'Format and manipulate dates',
      icon: 'calendar',
      category: 'data',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        operation: { type: 'enum', values: ['format', 'add', 'subtract', 'diff', 'now'], default: 'format' },
        inputField: { type: 'string' },
        format: { type: 'string', default: 'YYYY-MM-DD' },
        outputField: { type: 'string', default: 'date' }
      },
      handler: DataNodes.DateTimeNode
    });

    // ========================================
    // RAG / VECTOR NODES
    // ========================================
    this.register('rag', 'vector_store', {
      name: 'Vector Store',
      description: 'Store documents with embeddings in vector database',
      icon: 'database',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        collectionName: { type: 'string', required: true, default: 'default' },
        inputField: { type: 'string', default: 'content' },
        chunkSize: { type: 'number', default: 1000, min: 100, max: 10000 },
        overlap: { type: 'number', default: 200, min: 0 },
        chunkingStrategy: { type: 'enum', values: ['overlap', 'paragraph', 'none'], default: 'overlap' },
        metadataFields: { type: 'array', default: [] }
      },
      handler: RAGNodes.VectorStoreNode
    });

    this.register('rag', 'vector_search', {
      name: 'Vector Search',
      description: 'Search for similar documents using semantic similarity',
      icon: 'search',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        queryField: { type: 'string', default: 'query' },
        query: { type: 'string' },
        collectionName: { type: 'string' },
        topK: { type: 'number', default: 5, min: 1, max: 100 },
        threshold: { type: 'number', default: 0.5, min: 0, max: 1 },
        searchType: { type: 'enum', values: ['similarity', 'hybrid'], default: 'similarity' },
        metric: { type: 'enum', values: ['cosine', 'euclidean', 'inner_product'], default: 'cosine' },
        vectorWeight: { type: 'number', default: 0.7, min: 0, max: 1 },
        keywordWeight: { type: 'number', default: 0.3, min: 0, max: 1 },
        filters: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'searchResults' }
      },
      handler: RAGNodes.VectorSearchNode
    });

    this.register('rag', 'rag_query', {
      name: 'RAG Query',
      description: 'Retrieve relevant documents and generate answer using LLM',
      icon: 'message-circle',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        queryField: { type: 'string', default: 'query' },
        query: { type: 'string' },
        collectionName: { type: 'string' },
        topK: { type: 'number', default: 5, min: 1, max: 20 },
        threshold: { type: 'number', default: 0.5, min: 0, max: 1 },
        systemPrompt: { type: 'string', default: 'You are a helpful assistant. Answer based on the provided context.' },
        model: { type: 'string', default: 'default' },
        temperature: { type: 'number', default: 0.7, min: 0, max: 2 },
        maxContextLength: { type: 'number', default: 8000, min: 500 },
        includeSourceReferences: { type: 'boolean', default: true },
        outputField: { type: 'string', default: 'ragResponse' }
      },
      handler: RAGNodes.RAGQueryNode
    });

    this.register('rag', 'document_loader', {
      name: 'Document Loader',
      description: 'Load documents from various sources (text, URL, file)',
      icon: 'file-plus',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        sourceType: { type: 'enum', values: ['text', 'url', 'file', 'json'], default: 'text' },
        sourceField: { type: 'string', default: 'source' },
        source: { type: 'string' },
        outputField: { type: 'string', default: 'loadedContent' },
        extractText: { type: 'boolean', default: true },
        parseJSON: { type: 'boolean', default: false }
      },
      handler: RAGNodes.DocumentLoaderNode
    });

    this.register('rag', 'embedding', {
      name: 'Generate Embedding',
      description: 'Generate vector embedding for text',
      icon: 'hash',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        inputField: { type: 'string', default: 'text' },
        text: { type: 'string' },
        outputField: { type: 'string', default: 'embedding' }
      },
      handler: RAGNodes.EmbeddingNode
    });

    this.register('rag', 'chunk_text', {
      name: 'Chunk Text',
      description: 'Split text into smaller chunks for processing',
      icon: 'scissors',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        inputField: { type: 'string', default: 'text' },
        text: { type: 'string' },
        chunkSize: { type: 'number', default: 1000, min: 50, max: 20000 },
        overlap: { type: 'number', default: 200, min: 0 },
        strategy: { type: 'enum', values: ['overlap', 'paragraph'], default: 'overlap' },
        outputField: { type: 'string', default: 'chunks' }
      },
      handler: RAGNodes.ChunkTextNode
    });

    this.register('rag', 'semantic_compare', {
      name: 'Semantic Compare',
      description: 'Compare semantic similarity between two texts',
      icon: 'git-compare',
      category: 'rag',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        text1Field: { type: 'string', default: 'text1' },
        text2Field: { type: 'string', default: 'text2' },
        text1: { type: 'string' },
        text2: { type: 'string' },
        outputField: { type: 'string', default: 'comparison' }
      },
      handler: RAGNodes.SemanticCompareNode
    });

    // ========================================
    // CRM NODES (Logos Vision Integration)
    // ========================================

    // CRM Trigger Nodes
    this.register('trigger', 'deal_stage_changed', {
      name: 'Deal Stage Changed',
      description: 'Trigger when a deal moves to a different pipeline stage',
      icon: 'trending-up',
      category: 'crm',
      inputs: [],
      outputs: ['main', 'skip'],
      configSchema: {
        fromStages: { type: 'array', default: [] },
        toStages: { type: 'array', default: [] }
      },
      handler: CRMNodes.DealStageChangedTrigger
    });

    this.register('trigger', 'contact_created', {
      name: 'Contact Created',
      description: 'Trigger when a new contact is added to CRM',
      icon: 'user-plus',
      category: 'crm',
      inputs: [],
      outputs: ['main', 'skip'],
      configSchema: {
        sources: { type: 'array', default: [] }
      },
      handler: CRMNodes.ContactCreatedTrigger
    });

    this.register('trigger', 'deal_closed', {
      name: 'Deal Closed',
      description: 'Trigger when a deal is won or lost',
      icon: 'check-circle',
      category: 'crm',
      inputs: [],
      outputs: ['won', 'lost'],
      configSchema: {
        outcomes: { type: 'array', default: ['won', 'lost'] }
      },
      handler: CRMNodes.DealClosedTrigger
    });

    this.register('trigger', 'task_overdue', {
      name: 'Task Overdue',
      description: 'Trigger when a CRM task passes its due date',
      icon: 'alert-circle',
      category: 'crm',
      inputs: [],
      outputs: ['main', 'skip'],
      configSchema: {
        minDaysOverdue: { type: 'number', default: 1 }
      },
      handler: CRMNodes.TaskOverdueTrigger
    });

    this.register('trigger', 'activity_logged', {
      name: 'Activity Logged',
      description: 'Trigger when a call, email, or meeting is logged',
      icon: 'activity',
      category: 'crm',
      inputs: [],
      outputs: ['main', 'skip'],
      configSchema: {
        activityTypes: { type: 'array', default: ['call', 'email', 'meeting', 'note'] }
      },
      handler: CRMNodes.ActivityLoggedTrigger
    });

    // CRM Action Nodes
    this.register('crm', 'create_deal', {
      name: 'Create Deal',
      description: 'Create a new deal/opportunity in CRM',
      icon: 'dollar-sign',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        name: { type: 'string', required: true },
        value: { type: 'number', default: 0 },
        stage: { type: 'string', default: 'new' },
        contactId: { type: 'string' },
        ownerId: { type: 'string' },
        customFields: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'createdDeal' }
      },
      handler: CRMNodes.CreateDealNode
    });

    this.register('crm', 'update_deal', {
      name: 'Update Deal',
      description: 'Update an existing deal in CRM',
      icon: 'edit',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        dealId: { type: 'string' },
        dealIdField: { type: 'string', default: 'deal.id' },
        stage: { type: 'string' },
        value: { type: 'number' },
        updates: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'updatedDeal' }
      },
      handler: CRMNodes.UpdateDealNode
    });

    this.register('crm', 'create_contact', {
      name: 'Create Contact',
      description: 'Create a new contact in CRM',
      icon: 'user-plus',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        name: { type: 'string', required: true },
        email: { type: 'string', required: true },
        phone: { type: 'string' },
        company: { type: 'string' },
        title: { type: 'string' },
        source: { type: 'string', default: 'workflow' },
        customFields: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'createdContact' }
      },
      handler: CRMNodes.CreateContactNode
    });

    this.register('crm', 'update_contact', {
      name: 'Update Contact',
      description: 'Update an existing contact in CRM',
      icon: 'user-check',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        contactId: { type: 'string' },
        contactIdField: { type: 'string', default: 'contact.id' },
        updates: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'updatedContact' }
      },
      handler: CRMNodes.UpdateContactNode
    });

    this.register('crm', 'create_crm_task', {
      name: 'Create CRM Task',
      description: 'Create a task in CRM',
      icon: 'check-square',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        title: { type: 'string', required: true },
        description: { type: 'string' },
        dueDate: { type: 'string' },
        priority: { type: 'enum', values: ['low', 'medium', 'high', 'urgent'], default: 'medium' },
        assignee: { type: 'string' },
        relatedDealId: { type: 'string' },
        relatedContactId: { type: 'string' },
        outputField: { type: 'string', default: 'createdTask' }
      },
      handler: CRMNodes.CreateCRMTaskNode
    });

    this.register('crm', 'log_activity', {
      name: 'Log Activity',
      description: 'Log a call, email, or meeting in CRM',
      icon: 'phone-call',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        activityType: { type: 'enum', values: ['call', 'email', 'meeting', 'note'], default: 'note' },
        subject: { type: 'string', required: true },
        description: { type: 'string' },
        outcome: { type: 'string' },
        duration: { type: 'number' },
        relatedDealId: { type: 'string' },
        relatedContactId: { type: 'string' },
        outputField: { type: 'string', default: 'loggedActivity' }
      },
      handler: CRMNodes.LogActivityNode
    });

    this.register('crm', 'assign_owner', {
      name: 'Assign Owner',
      description: 'Change the owner of a deal or contact',
      icon: 'user-check',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        objectType: { type: 'enum', values: ['deal', 'contact'], required: true },
        objectId: { type: 'string' },
        objectIdField: { type: 'string' },
        newOwnerId: { type: 'string' },
        newOwnerIdField: { type: 'string' },
        outputField: { type: 'string', default: 'assignmentResult' }
      },
      handler: CRMNodes.AssignOwnerNode
    });

    // CRM Data Nodes
    this.register('crm', 'lookup_contact', {
      name: 'Lookup Contact',
      description: 'Find a contact by email, phone, or other criteria',
      icon: 'search',
      category: 'crm',
      inputs: ['main'],
      outputs: ['found', 'not_found'],
      configSchema: {
        searchBy: { type: 'enum', values: ['email', 'phone', 'name', 'id'], default: 'email' },
        searchValue: { type: 'string' },
        searchValueField: { type: 'string' },
        outputField: { type: 'string', default: 'contact' }
      },
      handler: CRMNodes.LookupContactNode
    });

    this.register('crm', 'lookup_deal', {
      name: 'Lookup Deal',
      description: 'Find a deal by name, ID, or contact',
      icon: 'search',
      category: 'crm',
      inputs: ['main'],
      outputs: ['found', 'not_found'],
      configSchema: {
        searchBy: { type: 'enum', values: ['id', 'name', 'contact_id'], default: 'id' },
        searchValue: { type: 'string' },
        searchValueField: { type: 'string' },
        includeActivities: { type: 'boolean', default: false },
        outputField: { type: 'string', default: 'deal' }
      },
      handler: CRMNodes.LookupDealNode
    });

    this.register('crm', 'get_pipeline', {
      name: 'Get Pipeline',
      description: 'Retrieve pipeline stages for deal management',
      icon: 'git-branch',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        pipelineId: { type: 'string', default: 'default' },
        outputField: { type: 'string', default: 'pipeline' }
      },
      handler: CRMNodes.GetPipelineNode
    });

    this.register('crm', 'calculate_lead_score', {
      name: 'Calculate Lead Score',
      description: 'AI-powered lead scoring based on various factors',
      icon: 'bar-chart-2',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        contactIdField: { type: 'string', default: 'contact.id' },
        factors: { type: 'object', default: {} },
        outputField: { type: 'string', default: 'leadScore' }
      },
      handler: CRMNodes.CalculateLeadScoreNode
    });

    this.register('crm', 'search_crm', {
      name: 'Search CRM',
      description: 'Search across deals, contacts, and activities',
      icon: 'search',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        query: { type: 'string' },
        queryField: { type: 'string' },
        objectTypes: { type: 'array', default: ['deals', 'contacts'] },
        limit: { type: 'number', default: 10 },
        outputField: { type: 'string', default: 'searchResults' }
      },
      handler: CRMNodes.SearchCRMNode
    });

    this.register('crm', 'get_stale_deals', {
      name: 'Get Stale Deals',
      description: 'Find deals with no recent activity',
      icon: 'alert-triangle',
      category: 'crm',
      inputs: ['main'],
      outputs: ['main'],
      configSchema: {
        staleDays: { type: 'number', default: 7 },
        stages: { type: 'array', default: [] },
        limit: { type: 'number', default: 50 },
        outputField: { type: 'string', default: 'staleDeals' }
      },
      handler: CRMNodes.GetStaleDealsNode
    });
  }

  /**
   * Register a node type
   */
  register(type, subtype, definition) {
    const key = `${type}:${subtype}`;
    this.nodeDefinitions.set(key, {
      type,
      subtype,
      ...definition
    });

    if (definition.handler) {
      this.handlers.set(key, definition.handler);
    }
  }

  /**
   * Get handler for a node type
   */
  getHandler(type, subtype) {
    const key = `${type}:${subtype}`;
    return this.handlers.get(key);
  }

  /**
   * Get node definition
   */
  getDefinition(type, subtype) {
    const key = `${type}:${subtype}`;
    return this.nodeDefinitions.get(key);
  }

  /**
   * Get all node definitions
   */
  getAllDefinitions() {
    return Array.from(this.nodeDefinitions.values());
  }

  /**
   * Get definitions by category
   */
  getDefinitionsByCategory(category) {
    return this.getAllDefinitions().filter(def => def.category === category);
  }

  /**
   * Get available categories
   */
  getCategories() {
    const categories = new Set();
    for (const def of this.nodeDefinitions.values()) {
      categories.add(def.category);
    }
    return Array.from(categories);
  }
}

module.exports = NodeRegistry;
