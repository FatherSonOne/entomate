# Entomate Enhancement Plan: N8N-Inspired Workflow Automation Features

**Document Version:** 1.0
**Created:** 2024-12-24
**Status:** Planning Phase

---

## Executive Summary

This document outlines a comprehensive plan to enhance Entomate's workflow automation capabilities by incorporating proven patterns and features from N8N, the leading open-source workflow automation platform. The goal is to transform Entomate from a meeting intelligence platform with basic automation into a full-featured AI-powered workflow automation engine.

---

## Part 1: Feature Gap Analysis

### Current Entomate Capabilities

| Feature | Status | Implementation |
|---------|--------|----------------|
| Trigger-based workflows | ✅ Basic | 6 trigger types |
| Sequential action execution | ✅ Implemented | Linear chain |
| AI agent integration | ✅ Strong | 4 built-in agents |
| Retry logic | ✅ Basic | Exponential backoff |
| Condition evaluation | ✅ Basic | 7 operators |
| Execution logging | ✅ Implemented | Full audit trail |
| Dry-run testing | ✅ Implemented | Preview mode |
| Cron scheduling | ✅ Implemented | node-cron |
| Variable interpolation | ✅ Basic | `{{variable}}` syntax |

### N8N Features NOT in Entomate

| Feature | Priority | Complexity | Impact |
|---------|----------|------------|--------|
| **Visual Node Canvas** | HIGH | High | Core UX improvement |
| **Branching/Conditional Flows** | HIGH | Medium | Logic flexibility |
| **Sub-workflows** | HIGH | Medium | Modularity/reuse |
| **Error Workflow Handler** | HIGH | Medium | Reliability |
| **Webhook Triggers** | HIGH | Low | External integrations |
| **HTTP Request Node** | HIGH | Low | Universal connectivity |
| **Loop/Batch Processing** | HIGH | Medium | Data scaling |
| **Merge Node** | MEDIUM | Medium | Data aggregation |
| **Data Pinning (Dev Mode)** | MEDIUM | Low | Developer experience |
| **Workflow Version History** | MEDIUM | Medium | Safety/rollback |
| **External Secrets Manager** | MEDIUM | Medium | Security |
| **Custom Node SDK** | LOW | High | Extensibility |
| **Community Node Marketplace** | LOW | High | Ecosystem |
| **RAG/Vector Store Integration** | MEDIUM | High | AI enhancement |
| **Expression Editor** | MEDIUM | Medium | Power user features |

---

## Part 2: Foundational Principles of Workflow Automation

Based on N8N's architecture and industry best practices, these are the core principles to implement:

### Principle 1: Node-Based Architecture
- Everything is a node (triggers, actions, logic)
- Nodes have typed inputs and outputs
- Data flows through connections between nodes
- Nodes are independently testable

### Principle 2: Visual-First Design
- Drag-and-drop canvas for workflow building
- Real-time data preview at each node
- Visual debugging with execution highlighting
- Zoom, pan, and organize capabilities

### Principle 3: Composability
- Workflows can call other workflows (sub-workflows)
- Nodes can be grouped and reused
- Templates as first-class citizens
- Parameterized workflows for flexibility

### Principle 4: Resilience by Design
- Every workflow has error handling
- Automatic retry with configurable backoff
- Error workflows for failure notification
- Partial execution recovery

### Principle 5: Developer Experience
- Data pinning for faster iteration
- Step-by-step execution mode
- Rich execution logs with timing
- Version control integration

---

## Part 3: Detailed Feature Specifications

### Feature 1: Visual Node Canvas

**Priority:** HIGH
**Estimated Effort:** 3-4 weeks
**Dependencies:** React Flow or similar library

#### Description
Replace the current 3-step wizard with a full visual canvas where users can drag, drop, and connect nodes to create workflows.

#### Technical Design

```
┌─────────────────────────────────────────────────────────────────┐
│  Toolbar: [Save] [Test] [Deploy] [Undo] [Redo] [Zoom] [Fit]    │
├───────────────┬─────────────────────────────────────────────────┤
│               │                                                 │
│  Node Panel   │              Canvas Area                        │
│               │                                                 │
│  ┌─────────┐  │    ┌──────┐      ┌──────┐      ┌──────┐       │
│  │Triggers │  │    │Webhook├─────►│ IF   ├─────►│Slack │       │
│  ├─────────┤  │    └──────┘      └──┬───┘      └──────┘       │
│  │ Actions │  │                     │                          │
│  ├─────────┤  │                     ▼                          │
│  │  Logic  │  │              ┌──────────┐                      │
│  ├─────────┤  │              │AI Agent  │                      │
│  │   AI    │  │              └──────────┘                      │
│  └─────────┘  │                                                 │
│               │                                                 │
├───────────────┴─────────────────────────────────────────────────┤
│  Node Properties Panel (appears when node selected)             │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Node: Slack | Config: Channel, Message, etc.                ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### Data Model

```javascript
// New workflow schema
{
  id: 'uuid',
  name: 'string',
  description: 'string',
  version: 'number',
  nodes: [
    {
      id: 'node_uuid',
      type: 'trigger|action|logic|ai',
      subtype: 'webhook|http|if|switch|slack|...',
      position: { x: 100, y: 200 },
      config: { /* node-specific */ },
      inputs: ['connection_ids'],
      outputs: ['connection_ids']
    }
  ],
  connections: [
    {
      id: 'conn_uuid',
      sourceNodeId: 'node_uuid',
      sourceOutput: 'main|true|false|0|1',
      targetNodeId: 'node_uuid',
      targetInput: 'main'
    }
  ],
  settings: {
    errorWorkflowId: 'uuid|null',
    saveExecutionProgress: true,
    timezone: 'UTC'
  }
}
```

#### Implementation Files

| File | Purpose |
|------|---------|
| `frontend/src/components/workflow/WorkflowCanvas.jsx` | Main canvas component |
| `frontend/src/components/workflow/NodePanel.jsx` | Draggable node list |
| `frontend/src/components/workflow/NodeRenderer.jsx` | Individual node display |
| `frontend/src/components/workflow/ConnectionLine.jsx` | SVG connection lines |
| `frontend/src/components/workflow/PropertiesPanel.jsx` | Node configuration |
| `frontend/src/hooks/useWorkflowCanvas.js` | Canvas state management |
| `backend/services/workflowExecutor.js` | Graph-based execution engine |

---

### Feature 2: Branching & Conditional Flows

**Priority:** HIGH
**Estimated Effort:** 1-2 weeks
**Dependencies:** Visual Canvas (or can be done standalone)

#### Description
Add logic nodes (IF, Switch) that allow workflows to branch based on conditions, enabling complex decision trees.

#### New Node Types

```javascript
// IF Node - Binary branching
{
  type: 'logic',
  subtype: 'if',
  config: {
    conditions: [
      {
        field: 'data.priority',
        operator: 'equals',
        value: 'high',
        combineWith: 'AND|OR'
      }
    ]
  },
  outputs: ['true', 'false']  // Two output branches
}

// Switch Node - Multi-way branching
{
  type: 'logic',
  subtype: 'switch',
  config: {
    field: 'data.status',
    cases: [
      { value: 'open', output: 0 },
      { value: 'in_progress', output: 1 },
      { value: 'completed', output: 2 }
    ],
    defaultOutput: 3
  },
  outputs: ['0', '1', '2', 'default']
}

// Merge Node - Combine branches
{
  type: 'logic',
  subtype: 'merge',
  config: {
    mode: 'wait_all|pass_through|combine'
  },
  inputs: ['branch1', 'branch2', 'branch3']
}
```

#### Execution Logic

```javascript
// In workflowExecutor.js
async executeNode(node, inputData) {
  switch (node.subtype) {
    case 'if':
      const result = this.evaluateConditions(node.config.conditions, inputData);
      return {
        output: result ? 'true' : 'false',
        data: inputData
      };

    case 'switch':
      const value = this.getNestedValue(inputData, node.config.field);
      const matchedCase = node.config.cases.find(c => c.value === value);
      return {
        output: matchedCase ? String(matchedCase.output) : 'default',
        data: inputData
      };

    case 'merge':
      // Wait for all inputs or pass through
      return this.handleMerge(node, inputData);
  }
}
```

---

### Feature 3: Sub-Workflows (Execute Workflow Node)

**Priority:** HIGH
**Estimated Effort:** 1-2 weeks
**Dependencies:** None

#### Description
Allow workflows to call other workflows, enabling modular and reusable automation components.

#### Node Definition

```javascript
{
  type: 'action',
  subtype: 'execute_workflow',
  config: {
    workflowId: 'uuid',
    waitForCompletion: true,
    timeout: 30000,  // ms
    inputMapping: {
      // Map parent data to child workflow input
      'childField': '{{parentField}}'
    },
    outputMapping: {
      // Map child output back to parent
      'parentField': '{{childOutput}}'
    }
  }
}
```

#### API Changes

```javascript
// New endpoint
POST /api/workflows/:id/execute
{
  inputData: { /* passed to workflow */ },
  waitForCompletion: true,
  calledBy: 'workflow_uuid|api|manual'
}

// Response
{
  executionId: 'uuid',
  status: 'completed|running|failed',
  output: { /* workflow output data */ },
  duration_ms: 1234
}
```

#### Use Cases

1. **Reusable Notification Workflow**
   - Create once: Slack + Email + In-app notification
   - Call from any workflow with message parameter

2. **Standard Processing Pipeline**
   - Meeting → Extract → Prioritize → Assign
   - Reuse across different trigger types

3. **Error Handling Workflow**
   - Centralized error notification
   - Called by error handlers in other workflows

---

### Feature 4: Error Workflow Handler

**Priority:** HIGH
**Estimated Effort:** 1 week
**Dependencies:** None

#### Description
When a workflow fails, automatically trigger a designated error workflow for notification and recovery.

#### Implementation

```javascript
// Workflow settings
{
  settings: {
    errorWorkflowId: 'uuid',  // Workflow to run on failure
    saveFailedExecutions: true,
    retryOnFailure: {
      enabled: true,
      maxRetries: 3,
      backoffMs: [1000, 5000, 15000]
    }
  }
}

// Error workflow receives context
{
  error: {
    message: 'Action failed: API timeout',
    code: 'ETIMEDOUT',
    stack: '...'
  },
  workflow: {
    id: 'uuid',
    name: 'Meeting Processor'
  },
  execution: {
    id: 'exec_uuid',
    startedAt: 'ISO date',
    failedNode: 'node_uuid',
    inputData: { /* original trigger data */ }
  }
}
```

#### Error Trigger Node

```javascript
{
  type: 'trigger',
  subtype: 'error',
  config: {
    listenTo: 'all|specific_workflows',
    workflowIds: ['uuid1', 'uuid2']  // If specific
  }
}
```

---

### Feature 5: Webhook Trigger Node

**Priority:** HIGH
**Estimated Effort:** 1 week
**Dependencies:** None

#### Description
Create webhook endpoints that external services can call to trigger workflows.

#### Node Definition

```javascript
{
  type: 'trigger',
  subtype: 'webhook',
  config: {
    path: '/hooks/my-webhook',  // Auto-generated or custom
    method: 'POST|GET|PUT',
    authentication: {
      type: 'none|header|basic|jwt',
      config: { /* auth-specific */ }
    },
    responseMode: 'immediate|last_node|custom',
    responseData: { /* if custom */ }
  }
}
```

#### Implementation

```javascript
// backend/routes/webhooks.js
router.all('/hooks/:webhookId', async (req, res) => {
  const { webhookId } = req.params;

  // Find workflow with this webhook
  const { data: webhook } = await supabase
    .from('webhooks')
    .select('*, workflows(*)')
    .eq('id', webhookId)
    .single();

  if (!webhook) {
    return res.status(404).json({ error: 'Webhook not found' });
  }

  // Validate authentication
  if (!validateAuth(webhook.config.authentication, req)) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Prepare trigger data
  const triggerData = {
    headers: req.headers,
    query: req.query,
    body: req.body,
    method: req.method,
    timestamp: new Date().toISOString()
  };

  // Execute workflow
  const execution = await workflowExecutor.execute(
    webhook.workflow,
    triggerData
  );

  // Response based on mode
  if (webhook.config.responseMode === 'immediate') {
    return res.json({ received: true, executionId: execution.id });
  } else {
    return res.json(execution.output);
  }
});
```

#### Database Schema

```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  path VARCHAR(255) UNIQUE NOT NULL,
  method VARCHAR(10) DEFAULT 'POST',
  authentication JSONB DEFAULT '{"type": "none"}',
  response_mode VARCHAR(20) DEFAULT 'immediate',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ
);

-- RLS Policy
CREATE POLICY "Users can manage own webhooks"
  ON webhooks FOR ALL
  USING (workflow_id IN (
    SELECT id FROM workflows WHERE user_id = auth.uid()
  ));
```

---

### Feature 6: HTTP Request Node

**Priority:** HIGH
**Estimated Effort:** 1 week
**Dependencies:** Credential management

#### Description
Universal node for making HTTP requests to any API, enabling integration with any web service.

#### Node Definition

```javascript
{
  type: 'action',
  subtype: 'http_request',
  config: {
    method: 'GET|POST|PUT|PATCH|DELETE',
    url: 'https://api.example.com/endpoint',
    authentication: {
      type: 'none|basic|bearer|api_key|oauth2',
      credentialId: 'cred_uuid'  // Reference stored credential
    },
    headers: {
      'Content-Type': 'application/json',
      'X-Custom': '{{variable}}'
    },
    queryParams: {
      'filter': '{{data.filter}}'
    },
    body: {
      type: 'json|form|raw',
      data: { /* or string */ }
    },
    options: {
      timeout: 30000,
      followRedirects: true,
      rejectUnauthorized: true
    },
    responseHandling: {
      outputField: 'response',
      parseJson: true
    }
  }
}
```

#### Implementation

```javascript
// backend/services/nodes/httpRequestNode.js
class HttpRequestNode {
  async execute(config, inputData, credentials) {
    const { method, url, headers, queryParams, body, options } = config;

    // Interpolate variables
    const resolvedUrl = this.interpolate(url, inputData);
    const resolvedHeaders = this.interpolateObject(headers, inputData);
    const resolvedBody = this.interpolateObject(body?.data, inputData);

    // Apply authentication
    const authHeaders = await this.applyAuth(config.authentication, credentials);

    // Make request
    const response = await fetch(resolvedUrl + this.buildQuery(queryParams, inputData), {
      method,
      headers: { ...resolvedHeaders, ...authHeaders },
      body: body ? JSON.stringify(resolvedBody) : undefined,
      timeout: options.timeout
    });

    // Parse response
    let responseData;
    const contentType = response.headers.get('content-type');
    if (config.responseHandling.parseJson && contentType?.includes('json')) {
      responseData = await response.json();
    } else {
      responseData = await response.text();
    }

    return {
      success: response.ok,
      statusCode: response.status,
      headers: Object.fromEntries(response.headers),
      [config.responseHandling.outputField || 'response']: responseData
    };
  }
}
```

---

### Feature 7: Loop/Batch Processing Node

**Priority:** HIGH
**Estimated Effort:** 1-2 weeks
**Dependencies:** Visual canvas (for full UX)

#### Description
Process arrays of items in batches, with configurable batch size and loop controls.

#### Node Types

```javascript
// Split In Batches Node
{
  type: 'logic',
  subtype: 'split_batches',
  config: {
    batchSize: 10,
    inputField: 'items',  // Array field to split
    continueOnError: true
  },
  outputs: ['loop', 'done']  // Loop output for each batch, done when complete
}

// Loop Node (for each item)
{
  type: 'logic',
  subtype: 'loop',
  config: {
    inputField: 'items',
    itemVariable: 'currentItem',
    indexVariable: 'currentIndex'
  }
}

// Aggregate Node (collect loop results)
{
  type: 'logic',
  subtype: 'aggregate',
  config: {
    operation: 'collect|sum|count|first|last',
    outputField: 'results'
  }
}
```

#### Execution Example

```javascript
// Processing 100 action items in batches of 10
const workflow = {
  nodes: [
    { id: 'trigger', type: 'trigger', subtype: 'meeting_processed' },
    { id: 'split', type: 'logic', subtype: 'split_batches',
      config: { batchSize: 10, inputField: 'action_items' } },
    { id: 'process', type: 'action', subtype: 'ai_agent',
      config: { agent: 'priority' } },
    { id: 'collect', type: 'logic', subtype: 'aggregate',
      config: { operation: 'collect' } },
    { id: 'notify', type: 'action', subtype: 'slack' }
  ],
  connections: [
    { source: 'trigger', target: 'split' },
    { source: 'split', output: 'loop', target: 'process' },
    { source: 'process', target: 'split' },  // Back to split for next batch
    { source: 'split', output: 'done', target: 'collect' },
    { source: 'collect', target: 'notify' }
  ]
};
```

---

### Feature 8: Data Pinning (Development Mode)

**Priority:** MEDIUM
**Estimated Effort:** 1 week
**Dependencies:** Visual canvas

#### Description
Save node output data for reuse during development, avoiding repeated API calls or trigger simulations.

#### Implementation

```javascript
// Pin data to a node
POST /api/workflows/:workflowId/nodes/:nodeId/pin
{
  data: { /* the output data to pin */ }
}

// Node execution checks for pinned data
async executeNode(node, inputData, executionContext) {
  // In development mode, check for pinned data
  if (executionContext.mode === 'development') {
    const pinnedData = await this.getPinnedData(node.id);
    if (pinnedData) {
      return {
        output: 'main',
        data: pinnedData,
        pinned: true
      };
    }
  }

  // Normal execution
  return this.actualExecute(node, inputData);
}
```

#### UI Component

```jsx
// In NodeRenderer.jsx
function NodeOutput({ node, output, onPin }) {
  const [isPinned, setIsPinned] = useState(node.pinnedData !== null);

  return (
    <div className="node-output">
      <div className="output-header">
        <span>Output</span>
        <button
          onClick={() => onPin(node.id, output)}
          className={isPinned ? 'pinned' : ''}
        >
          {isPinned ? '📌 Pinned' : 'Pin Data'}
        </button>
      </div>
      <pre className="output-data">
        {JSON.stringify(output, null, 2)}
      </pre>
    </div>
  );
}
```

---

### Feature 9: Workflow Version History

**Priority:** MEDIUM
**Estimated Effort:** 1-2 weeks
**Dependencies:** None

#### Description
Track all changes to workflows with ability to view history and restore previous versions.

#### Database Schema

```sql
CREATE TABLE workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_summary TEXT,

  UNIQUE(workflow_id, version_number)
);

-- Auto-increment version on workflow update
CREATE OR REPLACE FUNCTION save_workflow_version()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO workflow_versions (
    workflow_id, version_number, name, description,
    nodes, connections, settings, created_by, change_summary
  )
  SELECT
    OLD.id,
    COALESCE((SELECT MAX(version_number) FROM workflow_versions WHERE workflow_id = OLD.id), 0) + 1,
    OLD.name,
    OLD.description,
    OLD.nodes,
    OLD.connections,
    OLD.settings,
    auth.uid(),
    NEW.change_summary
  ;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER workflow_version_trigger
  BEFORE UPDATE ON workflows
  FOR EACH ROW
  EXECUTE FUNCTION save_workflow_version();
```

#### API Endpoints

```javascript
// List versions
GET /api/workflows/:id/versions
Response: [
  { version: 5, createdAt: '...', createdBy: '...', summary: 'Added Slack notification' },
  { version: 4, createdAt: '...', createdBy: '...', summary: 'Fixed condition logic' },
  ...
]

// Get specific version
GET /api/workflows/:id/versions/:version
Response: { /* full workflow definition at that version */ }

// Restore version
POST /api/workflows/:id/versions/:version/restore
Response: { success: true, newVersion: 6 }

// Compare versions
GET /api/workflows/:id/versions/compare?from=3&to=5
Response: {
  nodesAdded: [...],
  nodesRemoved: [...],
  nodesModified: [...],
  connectionsChanged: [...]
}
```

---

### Feature 10: External Secrets Manager

**Priority:** MEDIUM
**Estimated Effort:** 1-2 weeks
**Dependencies:** None

#### Description
Integrate with external secret management systems (HashiCorp Vault, AWS Secrets Manager, etc.) for secure credential storage.

#### Configuration

```javascript
// Environment configuration
SECRETS_PROVIDER=vault|aws|azure|gcp|infisical
VAULT_URL=https://vault.example.com
VAULT_TOKEN=hvs.xxx
// or
AWS_SECRETS_REGION=us-east-1
AWS_ACCESS_KEY_ID=xxx
AWS_SECRET_ACCESS_KEY=xxx
```

#### Service Implementation

```javascript
// backend/services/secretsManager.js
class SecretsManager {
  constructor() {
    this.provider = this.initProvider(process.env.SECRETS_PROVIDER);
  }

  initProvider(type) {
    switch (type) {
      case 'vault':
        return new VaultProvider(process.env.VAULT_URL, process.env.VAULT_TOKEN);
      case 'aws':
        return new AWSSecretsProvider();
      case 'azure':
        return new AzureKeyVaultProvider();
      default:
        return new LocalProvider();  // Encrypted local storage
    }
  }

  async getSecret(path) {
    return this.provider.get(path);
  }

  async setSecret(path, value) {
    return this.provider.set(path, value);
  }

  // Use in workflows via expression: $secrets.api_key
  async resolveSecretExpression(expression) {
    const match = expression.match(/\$secrets\.(\w+)/);
    if (match) {
      return this.getSecret(match[1]);
    }
    return expression;
  }
}
```

#### Credential Types

```javascript
// Predefined credential types with required fields
const CREDENTIAL_TYPES = {
  slack: {
    fields: ['bot_token', 'signing_secret'],
    secretFields: ['bot_token', 'signing_secret']
  },
  openai: {
    fields: ['api_key', 'organization'],
    secretFields: ['api_key']
  },
  http_basic: {
    fields: ['username', 'password'],
    secretFields: ['password']
  },
  oauth2: {
    fields: ['client_id', 'client_secret', 'access_token', 'refresh_token'],
    secretFields: ['client_secret', 'access_token', 'refresh_token']
  },
  custom: {
    fields: [],  // User-defined
    secretFields: []
  }
};
```

---

### Feature 11: Expression Editor

**Priority:** MEDIUM
**Estimated Effort:** 1-2 weeks
**Dependencies:** None

#### Description
Rich expression editor for dynamic values with autocomplete, validation, and preview.

#### Expression Syntax

```javascript
// Variable access
{{data.field}}
{{$input.body.name}}
{{$node['Webhook'].output.data}}

// Built-in functions
{{$now()}}                    // Current timestamp
{{$today()}}                  // Today's date
{{$uuid()}}                   // Generate UUID
{{$json(data)}}               // Stringify JSON
{{$if(condition, then, else)}}

// String functions
{{$lowercase(text)}}
{{$uppercase(text)}}
{{$trim(text)}}
{{$replace(text, find, replace)}}
{{$substring(text, start, end)}}

// Math functions
{{$round(number, decimals)}}
{{$abs(number)}}
{{$min(a, b, c)}}
{{$max(a, b, c)}}

// Date functions
{{$dateAdd(date, amount, unit)}}  // unit: days, weeks, months
{{$dateDiff(date1, date2, unit)}}
{{$formatDate(date, format)}}

// Array functions
{{$length(array)}}
{{$first(array)}}
{{$last(array)}}
{{$filter(array, condition)}}
{{$map(array, expression)}}
{{$join(array, separator)}}

// Secret access
{{$secrets.API_KEY}}
{{$env.NODE_ENV}}
```

#### UI Component

```jsx
// ExpressionEditor.jsx
function ExpressionEditor({ value, onChange, context }) {
  const [preview, setPreview] = useState(null);
  const [error, setError] = useState(null);

  const evaluatePreview = useCallback(
    debounce(async (expr) => {
      try {
        const result = await api.evaluateExpression(expr, context);
        setPreview(result);
        setError(null);
      } catch (e) {
        setError(e.message);
        setPreview(null);
      }
    }, 300),
    [context]
  );

  return (
    <div className="expression-editor">
      <div className="editor-container">
        <CodeMirror
          value={value}
          onChange={(val) => {
            onChange(val);
            evaluatePreview(val);
          }}
          extensions={[
            expressionLanguage(),  // Custom syntax highlighting
            autocompletion({ override: [expressionCompletions] })
          ]}
        />
      </div>

      {preview && (
        <div className="preview success">
          <label>Preview:</label>
          <code>{JSON.stringify(preview)}</code>
        </div>
      )}

      {error && (
        <div className="preview error">
          <label>Error:</label>
          <code>{error}</code>
        </div>
      )}

      <VariableExplorer
        context={context}
        onSelect={(path) => insertAtCursor(`{{${path}}}`)}
      />
    </div>
  );
}
```

---

### Feature 12: RAG/Vector Store Integration

**Priority:** MEDIUM
**Estimated Effort:** 2-3 weeks
**Dependencies:** Supabase pgvector or external vector DB

#### Description
Enable AI agents to use Retrieval-Augmented Generation with knowledge bases for more accurate and contextual responses.

#### Node Types

```javascript
// Vector Store Insert Node
{
  type: 'ai',
  subtype: 'vector_insert',
  config: {
    vectorStore: 'supabase|pinecone|qdrant',
    collection: 'meeting_knowledge',
    embeddingModel: 'openai|cohere',
    documentField: 'data.transcript',
    metadataFields: ['meeting_id', 'date', 'participants'],
    chunkSize: 500,
    chunkOverlap: 50
  }
}

// Vector Store Query Node (for Agents)
{
  type: 'ai',
  subtype: 'vector_query',
  config: {
    vectorStore: 'supabase',
    collection: 'meeting_knowledge',
    queryField: 'data.question',
    topK: 5,
    minScore: 0.7,
    outputField: 'relevant_context'
  }
}

// AI Agent with RAG
{
  type: 'ai',
  subtype: 'agent',
  config: {
    agentType: 'rag_assistant',
    vectorStoreId: 'vs_uuid',
    systemPrompt: 'Use the provided context to answer questions about past meetings.',
    model: 'gpt-4',
    temperature: 0.3
  }
}
```

#### Implementation

```javascript
// backend/services/vectorStore.js
class VectorStoreService {
  async insertDocuments(config, documents) {
    // 1. Chunk documents
    const chunks = this.chunkDocuments(documents, config.chunkSize, config.chunkOverlap);

    // 2. Generate embeddings
    const embeddings = await this.generateEmbeddings(chunks, config.embeddingModel);

    // 3. Store in vector database
    const { error } = await supabase.from('documents').insert(
      chunks.map((chunk, i) => ({
        content: chunk.text,
        embedding: embeddings[i],
        metadata: chunk.metadata,
        collection: config.collection
      }))
    );

    return { success: !error, inserted: chunks.length };
  }

  async query(config, query) {
    // 1. Generate query embedding
    const queryEmbedding = await this.generateEmbeddings([query], config.embeddingModel);

    // 2. Semantic search
    const { data } = await supabase.rpc('match_documents', {
      query_embedding: queryEmbedding[0],
      match_count: config.topK,
      filter: { collection: config.collection }
    });

    return data.filter(d => d.similarity >= config.minScore);
  }
}
```

---

## Part 4: Implementation Roadmap

### Phase 1: Core Infrastructure (Weeks 1-4)

| Week | Tasks |
|------|-------|
| 1 | Set up new workflow data model, update database schema |
| 1 | Implement graph-based workflow executor |
| 2 | Add branching nodes (IF, Switch, Merge) |
| 2 | Implement sub-workflow execution |
| 3 | Add error workflow handling |
| 3 | Create webhook trigger system |
| 4 | Build HTTP request node |
| 4 | Add loop/batch processing |

### Phase 2: Visual Canvas (Weeks 5-7)

| Week | Tasks |
|------|-------|
| 5 | Integrate React Flow library |
| 5 | Build node panel with all node types |
| 6 | Implement drag-drop node placement |
| 6 | Create connection drawing system |
| 7 | Add properties panel for node configuration |
| 7 | Implement canvas controls (zoom, pan, fit) |

### Phase 3: Developer Experience (Weeks 8-9)

| Week | Tasks |
|------|-------|
| 8 | Add data pinning functionality |
| 8 | Implement step-by-step execution |
| 9 | Build workflow version history |
| 9 | Create visual diff viewer |

### Phase 4: Advanced Features (Weeks 10-12)

| Week | Tasks |
|------|-------|
| 10 | Integrate external secrets manager |
| 10 | Build expression editor with autocomplete |
| 11 | Add vector store integration |
| 11 | Create RAG-enabled AI agent nodes |
| 12 | Polish, testing, documentation |
| 12 | Migration tools for existing automations |

---

## Part 5: Database Migrations

### Migration 1: Enhanced Workflows Table

```sql
-- Migration: 001_enhanced_workflows
-- Up
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS
  nodes JSONB DEFAULT '[]';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS
  connections JSONB DEFAULT '[]';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS
  settings JSONB DEFAULT '{}';
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS
  version INTEGER DEFAULT 1;
ALTER TABLE workflows ADD COLUMN IF NOT EXISTS
  is_template BOOLEAN DEFAULT false;

-- Create workflow versions table
CREATE TABLE IF NOT EXISTS workflow_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  version_number INTEGER NOT NULL,
  nodes JSONB NOT NULL,
  connections JSONB NOT NULL,
  settings JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  change_summary TEXT,
  UNIQUE(workflow_id, version_number)
);

-- Down
ALTER TABLE workflows DROP COLUMN IF EXISTS nodes;
ALTER TABLE workflows DROP COLUMN IF EXISTS connections;
ALTER TABLE workflows DROP COLUMN IF EXISTS settings;
ALTER TABLE workflows DROP COLUMN IF EXISTS version;
ALTER TABLE workflows DROP COLUMN IF EXISTS is_template;
DROP TABLE IF EXISTS workflow_versions;
```

### Migration 2: Webhooks Table

```sql
-- Migration: 002_webhooks
-- Up
CREATE TABLE IF NOT EXISTS webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workflow_id UUID REFERENCES workflows(id) ON DELETE CASCADE,
  path VARCHAR(255) UNIQUE NOT NULL,
  method VARCHAR(10) DEFAULT 'POST',
  authentication JSONB DEFAULT '{"type": "none"}',
  response_mode VARCHAR(20) DEFAULT 'immediate',
  enabled BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_triggered_at TIMESTAMPTZ,
  trigger_count INTEGER DEFAULT 0
);

CREATE INDEX idx_webhooks_path ON webhooks(path);

-- RLS
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own webhooks" ON webhooks
  FOR ALL USING (
    workflow_id IN (SELECT id FROM workflows WHERE user_id = auth.uid())
  );

-- Down
DROP TABLE IF EXISTS webhooks;
```

### Migration 3: Credentials Table

```sql
-- Migration: 003_credentials
-- Up
CREATE TABLE IF NOT EXISTS credentials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  type VARCHAR(50) NOT NULL,  -- slack, openai, http_basic, etc.
  data JSONB NOT NULL,  -- Encrypted at application level
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

CREATE INDEX idx_credentials_user ON credentials(user_id);
CREATE INDEX idx_credentials_type ON credentials(type);

-- RLS
ALTER TABLE credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own credentials" ON credentials
  FOR ALL USING (user_id = auth.uid());

-- Down
DROP TABLE IF EXISTS credentials;
```

### Migration 4: Vector Store Tables

```sql
-- Migration: 004_vector_store
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Document storage with embeddings
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  collection VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  embedding vector(1536),  -- OpenAI embedding dimension
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Similarity search function
CREATE OR REPLACE FUNCTION match_documents(
  query_embedding vector(1536),
  match_count INT,
  filter JSONB DEFAULT '{}'
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  metadata JSONB,
  similarity FLOAT
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    documents.id,
    documents.content,
    documents.metadata,
    1 - (documents.embedding <=> query_embedding) as similarity
  FROM documents
  WHERE
    documents.collection = filter->>'collection'
    AND documents.user_id = auth.uid()
  ORDER BY documents.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Index for fast similarity search
CREATE INDEX ON documents USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);

-- Down
DROP FUNCTION IF EXISTS match_documents;
DROP TABLE IF EXISTS documents;
DROP EXTENSION IF EXISTS vector;
```

---

## Part 6: API Specifications

### New API Endpoints

```yaml
# Workflows v2
POST   /api/v2/workflows              # Create workflow with nodes/connections
GET    /api/v2/workflows              # List all workflows
GET    /api/v2/workflows/:id          # Get workflow details
PUT    /api/v2/workflows/:id          # Update workflow
DELETE /api/v2/workflows/:id          # Delete workflow
POST   /api/v2/workflows/:id/execute  # Execute workflow
POST   /api/v2/workflows/:id/test     # Test workflow (dry run)
GET    /api/v2/workflows/:id/executions # List executions

# Workflow Versions
GET    /api/v2/workflows/:id/versions           # List versions
GET    /api/v2/workflows/:id/versions/:version  # Get specific version
POST   /api/v2/workflows/:id/versions/:version/restore # Restore version

# Nodes
GET    /api/v2/nodes                  # List available node types
GET    /api/v2/nodes/:type/schema     # Get node config schema
POST   /api/v2/nodes/execute          # Execute single node (testing)
POST   /api/v2/workflows/:id/nodes/:nodeId/pin # Pin node data

# Webhooks
POST   /api/v2/webhooks               # Create webhook
GET    /api/v2/webhooks               # List webhooks
DELETE /api/v2/webhooks/:id           # Delete webhook
POST   /hooks/:webhookId              # Webhook endpoint (public)

# Credentials
POST   /api/v2/credentials            # Create credential
GET    /api/v2/credentials            # List credentials (no secrets)
PUT    /api/v2/credentials/:id        # Update credential
DELETE /api/v2/credentials/:id        # Delete credential
POST   /api/v2/credentials/test       # Test credential

# Expressions
POST   /api/v2/expressions/evaluate   # Evaluate expression
GET    /api/v2/expressions/functions  # List available functions

# Vector Store
POST   /api/v2/vectors/collections            # Create collection
POST   /api/v2/vectors/collections/:name/documents # Add documents
POST   /api/v2/vectors/collections/:name/query    # Query similar docs
DELETE /api/v2/vectors/collections/:name      # Delete collection
```

---

## Part 7: Migration Strategy

### Migrating Existing Automations

Existing Entomate automations use a simpler format. Here's how to migrate:

```javascript
// backend/scripts/migrateAutomations.js
async function migrateAutomation(oldAutomation) {
  // Convert trigger to trigger node
  const triggerNode = {
    id: generateId(),
    type: 'trigger',
    subtype: oldAutomation.trigger_type,
    position: { x: 100, y: 100 },
    config: oldAutomation.trigger_config
  };

  // Convert actions to action nodes
  const actionNodes = oldAutomation.actions.map((action, index) => ({
    id: generateId(),
    type: 'action',
    subtype: action.type,
    position: { x: 100, y: 200 + (index * 100) },
    config: action.config
  }));

  // Create sequential connections
  const connections = [];
  let prevNode = triggerNode;
  for (const actionNode of actionNodes) {
    connections.push({
      id: generateId(),
      sourceNodeId: prevNode.id,
      sourceOutput: 'main',
      targetNodeId: actionNode.id,
      targetInput: 'main'
    });
    prevNode = actionNode;
  }

  // Create new workflow
  return {
    id: oldAutomation.id,
    name: oldAutomation.name,
    description: oldAutomation.description,
    nodes: [triggerNode, ...actionNodes],
    connections,
    settings: {
      errorWorkflowId: null,
      enabled: oldAutomation.enabled
    },
    // Keep old fields for backward compatibility
    _migrated: true,
    _originalFormat: oldAutomation
  };
}
```

---

## Part 8: Testing Strategy

### Unit Tests

```javascript
// tests/unit/workflowExecutor.test.js
describe('WorkflowExecutor', () => {
  describe('Node Execution', () => {
    test('IF node routes to true branch when condition met', async () => {
      const node = createIfNode({ field: 'priority', operator: 'equals', value: 'high' });
      const result = await executor.executeNode(node, { priority: 'high' });
      expect(result.output).toBe('true');
    });

    test('Loop node processes all items', async () => {
      const node = createLoopNode({ inputField: 'items' });
      const result = await executor.executeNode(node, { items: [1, 2, 3] });
      expect(result.iterations).toBe(3);
    });
  });

  describe('Workflow Execution', () => {
    test('Executes nodes in correct order based on connections', async () => {
      const workflow = createTestWorkflow();
      const execution = await executor.execute(workflow, { trigger: 'data' });
      expect(execution.nodeOrder).toEqual(['trigger', 'action1', 'action2']);
    });

    test('Handles branching correctly', async () => {
      const workflow = createBranchingWorkflow();
      const execution = await executor.execute(workflow, { condition: true });
      expect(execution.executedNodes).toContain('trueBranch');
      expect(execution.executedNodes).not.toContain('falseBranch');
    });
  });
});
```

### Integration Tests

```javascript
// tests/integration/webhooks.test.js
describe('Webhook Integration', () => {
  test('Webhook triggers workflow and returns response', async () => {
    // Create workflow with webhook trigger
    const workflow = await createTestWorkflow({
      trigger: { type: 'webhook', config: { path: '/test-hook' } }
    });

    // Call webhook
    const response = await request(app)
      .post(`/hooks/${workflow.webhookId}`)
      .send({ data: 'test' });

    expect(response.status).toBe(200);
    expect(response.body.executionId).toBeDefined();

    // Verify execution
    const execution = await getExecution(response.body.executionId);
    expect(execution.status).toBe('completed');
  });
});
```

### E2E Tests

```javascript
// tests/e2e/workflowBuilder.test.js
describe('Workflow Builder E2E', () => {
  test('User can create workflow with visual canvas', async () => {
    await page.goto('/workflows/new');

    // Drag webhook trigger to canvas
    await page.dragAndDrop('[data-node="webhook"]', '[data-canvas]');

    // Drag Slack action to canvas
    await page.dragAndDrop('[data-node="slack"]', '[data-canvas]');

    // Connect nodes
    await page.click('[data-node-id="1"] [data-output="main"]');
    await page.click('[data-node-id="2"] [data-input="main"]');

    // Configure nodes
    await page.click('[data-node-id="2"]');
    await page.fill('[name="channel"]', '#general');
    await page.fill('[name="message"]', 'Hello from webhook!');

    // Save workflow
    await page.click('[data-action="save"]');

    // Verify saved
    expect(await page.textContent('.toast')).toContain('Workflow saved');
  });
});
```

---

## Part 9: Success Metrics

### Technical Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflow execution time | < 5s for simple workflows | P95 latency |
| Canvas load time | < 2s | FCP |
| Node execution reliability | 99.9% | Success rate |
| Webhook response time | < 500ms | P95 latency |
| Error recovery rate | > 95% | Retry success |

### User Adoption Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Workflows created per user | 5+ | Average |
| Workflow complexity | 5+ nodes avg | Node count |
| Template usage | 30%+ start from template | Template ratio |
| Sub-workflow adoption | 20%+ of workflows | Usage rate |
| Canvas vs wizard usage | 80%+ use canvas | UI preference |

---

## Appendix A: Node Type Registry

```javascript
// Complete list of planned nodes

const NODE_REGISTRY = {
  // Triggers
  triggers: [
    { type: 'webhook', name: 'Webhook', icon: '🔗' },
    { type: 'schedule', name: 'Schedule', icon: '⏰' },
    { type: 'meeting_processed', name: 'Meeting Processed', icon: '📝' },
    { type: 'meeting_ended', name: 'Meeting Ended', icon: '🎙️' },
    { type: 'action_item_created', name: 'Action Item Created', icon: '📋' },
    { type: 'task_completed', name: 'Task Completed', icon: '✅' },
    { type: 'deal_created', name: 'Deal Created', icon: '💰' },
    { type: 'error', name: 'Error Trigger', icon: '⚠️' },
    { type: 'manual', name: 'Manual Trigger', icon: '👆' }
  ],

  // Logic
  logic: [
    { type: 'if', name: 'IF', icon: '🔀' },
    { type: 'switch', name: 'Switch', icon: '🔄' },
    { type: 'merge', name: 'Merge', icon: '🔗' },
    { type: 'split_batches', name: 'Split in Batches', icon: '📦' },
    { type: 'loop', name: 'Loop', icon: '🔁' },
    { type: 'aggregate', name: 'Aggregate', icon: '📊' },
    { type: 'filter', name: 'Filter', icon: '🔍' },
    { type: 'sort', name: 'Sort', icon: '📈' },
    { type: 'wait', name: 'Wait', icon: '⏳' },
    { type: 'stop_error', name: 'Stop and Error', icon: '🛑' }
  ],

  // Actions
  actions: [
    { type: 'http_request', name: 'HTTP Request', icon: '🌐' },
    { type: 'execute_workflow', name: 'Execute Workflow', icon: '▶️' },
    { type: 'create_task', name: 'Create Task', icon: '✏️' },
    { type: 'update_task', name: 'Update Task', icon: '📝' },
    { type: 'send_email', name: 'Send Email', icon: '📧' },
    { type: 'send_slack', name: 'Send to Slack', icon: '💬' },
    { type: 'sync_crm', name: 'Sync to CRM', icon: '🗄️' },
    { type: 'set_variable', name: 'Set Variable', icon: '📌' },
    { type: 'code', name: 'Code', icon: '💻' },
    { type: 'respond_webhook', name: 'Respond to Webhook', icon: '↩️' }
  ],

  // AI
  ai: [
    { type: 'ai_agent', name: 'AI Agent', icon: '🤖' },
    { type: 'ai_extract', name: 'AI Extract', icon: '🔮' },
    { type: 'ai_classify', name: 'AI Classify', icon: '🏷️' },
    { type: 'ai_summarize', name: 'AI Summarize', icon: '📄' },
    { type: 'vector_insert', name: 'Vector Store Insert', icon: '📥' },
    { type: 'vector_query', name: 'Vector Store Query', icon: '🔎' },
    { type: 'rag_agent', name: 'RAG Agent', icon: '🧠' }
  ],

  // Data
  data: [
    { type: 'transform', name: 'Transform Data', icon: '🔄' },
    { type: 'map', name: 'Map Fields', icon: '🗺️' },
    { type: 'parse_json', name: 'Parse JSON', icon: '📋' },
    { type: 'date_time', name: 'Date & Time', icon: '📅' },
    { type: 'crypto', name: 'Crypto', icon: '🔐' },
    { type: 'html_extract', name: 'HTML Extract', icon: '🌐' }
  ]
};
```

---

## Appendix B: Keyboard Shortcuts

```javascript
// Canvas keyboard shortcuts
const KEYBOARD_SHORTCUTS = {
  'Ctrl+S': 'Save workflow',
  'Ctrl+Z': 'Undo',
  'Ctrl+Y': 'Redo',
  'Ctrl+D': 'Duplicate selected nodes',
  'Delete': 'Delete selected nodes',
  'Ctrl+A': 'Select all nodes',
  'Ctrl+C': 'Copy selected nodes',
  'Ctrl+V': 'Paste nodes',
  'Ctrl+Enter': 'Execute workflow',
  'Ctrl+T': 'Test workflow (dry run)',
  'Escape': 'Deselect all',
  '+': 'Zoom in',
  '-': 'Zoom out',
  '0': 'Fit to screen',
  'Space': 'Pan canvas (hold)',
  'Tab': 'Focus next node',
  'F2': 'Rename selected node'
};
```

---

## Conclusion

This enhancement plan transforms Entomate from a meeting intelligence platform with basic automation into a powerful, N8N-inspired workflow automation engine. The phased approach ensures we can deliver value incrementally while building toward a complete solution.

Key differentiators from N8N:
1. **AI-First**: Deep integration with AI agents and RAG
2. **Meeting Intelligence**: Native understanding of meeting context
3. **Simplicity**: Focused feature set, not trying to be everything
4. **Integrated**: Built into the Entomate ecosystem, not standalone

The estimated total effort is 10-12 weeks for a full implementation, with the core functionality (branching, webhooks, sub-workflows) achievable in 4 weeks.
