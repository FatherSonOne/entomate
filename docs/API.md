# Entomate API Documentation

**Version:** 1.0.0
**Base URL:** `http://localhost:3000/api`

## Authentication

All API endpoints support optional authentication via Bearer token:

```
Authorization: Bearer <supabase_jwt_token>
```

## Endpoints Overview

| Category | Endpoint | Description |
|----------|----------|-------------|
| Health | `GET /health` | System health check |
| Meetings | `GET/POST /meetings` | Meeting management |
| Projects | `GET/POST /projects` | Project management |
| Tasks | `GET/POST /tasks` | Task management |
| Automations | `GET/POST /automations` | Automation workflows |
| Search | `POST /search` | AI-powered search |
| Integrations | `POST /integrations/*` | CRM & Chat integrations |

---

## Health Check

### GET /api/health

Check system status and service connections.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2025-12-17T10:00:00.000Z",
  "environment": "development",
  "version": "1.0.0",
  "services": {
    "gemini": "connected",
    "database": "connected",
    "crm": "connected (hubspot)",
    "chat": "connected (slack)"
  }
}
```

---

## Meetings

### GET /api/meetings

List all meetings with optional filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| limit | number | Max results (default: 20, max: 100) |
| offset | number | Pagination offset |
| status | string | Filter by status |
| project_id | uuid | Filter by project |

**Response:**
```json
{
  "data": [
    {
      "id": "uuid",
      "title": "Weekly Standup",
      "summary": "Team discussed...",
      "sentiment_label": "Positive",
      "duration_minutes": 30,
      "created_at": "2025-12-17T10:00:00.000Z"
    }
  ],
  "total": 100,
  "limit": 20,
  "offset": 0
}
```

### POST /api/meetings

Create a new meeting record.

**Request Body:**
```json
{
  "title": "Team Standup",
  "description": "Weekly team sync",
  "attendees": ["john@example.com", "jane@example.com"]
}
```

### GET /api/meetings/:id

Get meeting details with action items.

### POST /api/meetings/:id/process

Process meeting audio and generate transcript.

**Request:** `multipart/form-data`
| Field | Type | Description |
|-------|------|-------------|
| audio | file | Audio file (wav, mp3, webm) |

**Response:**
```json
{
  "success": true,
  "meeting": {
    "id": "uuid",
    "transcript": "Full meeting transcript...",
    "summary": "Summary of the meeting...",
    "key_points": ["Point 1", "Point 2"],
    "decisions": ["Decision 1"],
    "sentiment_label": "Positive"
  },
  "actionItems": [
    {
      "id": "uuid",
      "task_description": "Follow up with client",
      "assigned_to_name": "John",
      "due_date": "2025-12-20",
      "priority": "high"
    }
  ]
}
```

### POST /api/meetings/:id/ask

Ask an AI question about the meeting.

**Request Body:**
```json
{
  "question": "What were the main action items?"
}
```

**Response:**
```json
{
  "answer": "The main action items discussed were...",
  "sources": ["Transcript segment..."]
}
```

### GET /api/meetings/:id/recap

Get formatted meeting recap for chat posting.

---

## Projects

### GET /api/projects

List all projects.

### POST /api/projects

Create a new project.

**Request Body:**
```json
{
  "name": "Website Redesign",
  "description": "Complete website overhaul",
  "status": "planning",
  "crm_deal_id": "deal_123",
  "deal_value": 50000,
  "start_date": "2025-01-01",
  "end_date": "2025-03-31"
}
```

### GET /api/projects/:id

Get project details with tasks and meetings.

### PUT /api/projects/:id

Update project.

### DELETE /api/projects/:id

Delete project.

### POST /api/projects/from-deal

Create project from CRM deal.

**Request Body:**
```json
{
  "deal_id": "crm_deal_id",
  "name": "Project Name",
  "deal_value": 50000
}
```

### GET /api/projects/:id/stats

Get project statistics.

---

## Tasks

### GET /api/tasks

List all tasks with filters.

**Query Parameters:**
| Parameter | Type | Description |
|-----------|------|-------------|
| project_id | uuid | Filter by project |
| status | string | Filter by status |
| priority | string | Filter by priority |
| assigned_to | uuid | Filter by assignee |

### POST /api/tasks

Create a new task.

**Request Body:**
```json
{
  "title": "Review proposal",
  "description": "Review and provide feedback",
  "project_id": "uuid",
  "assigned_to": "user_uuid",
  "priority": "high",
  "due_date": "2025-12-20"
}
```

### GET /api/tasks/:id

Get task details.

### PUT /api/tasks/:id

Update task.

### DELETE /api/tasks/:id

Delete task.

### POST /api/tasks/:id/complete

Mark task as completed.

### POST /api/tasks/:id/reopen

Reopen a completed task.

### POST /api/tasks/:id/assign

Assign task to user.

**Request Body:**
```json
{
  "user_id": "uuid"
}
```

### POST /api/tasks/bulk

Bulk operations on tasks.

**Request Body:**
```json
{
  "task_ids": ["uuid1", "uuid2"],
  "action": "complete" | "delete" | "update_priority",
  "value": "high"
}
```

---

## Automations

### GET /api/automations

List all automations.

### POST /api/automations

Create a new automation.

**Request Body:**
```json
{
  "name": "Meeting to CRM",
  "description": "Sync meeting action items to CRM",
  "trigger_type": "meeting_ended",
  "trigger_config": {
    "conditions": [
      {"field": "sentiment_label", "operator": "equals", "value": "Positive"}
    ]
  },
  "actions": [
    {"type": "extract_action_items", "config": {}},
    {"type": "sync_to_crm", "config": {}},
    {"type": "post_to_chat", "config": {"message": "Meeting synced!"}}
  ]
}
```

**Trigger Types:**
- `meeting_ended` - When meeting processing completes
- `meeting_created` - When a new meeting is created
- `action_item_created` - When action item is extracted
- `task_completed` - When a task is marked done
- `deal_created` - When CRM deal is created
- `scheduled` - Cron-based schedule

**Action Types:**
- `create_task` - Create internal task
- `create_crm_task` - Create CRM task
- `sync_to_crm` - Sync action items to CRM
- `post_to_chat` - Post message to chat
- `create_project` - Create new project
- `update_status` - Update resource status
- `extract_action_items` - Extract items from transcript
- `generate_summary` - Generate AI summary

### GET /api/automations/templates

Get pre-built automation templates.

### GET /api/automations/:id

Get automation details.

### PUT /api/automations/:id

Update automation.

### DELETE /api/automations/:id

Delete automation.

### POST /api/automations/:id/toggle

Enable/disable automation.

### POST /api/automations/:id/execute

Manually execute automation.

**Request Body:**
```json
{
  "trigger_data": {
    "meeting_id": "uuid"
  }
}
```

### POST /api/automations/trigger

Trigger automations by event type.

**Request Body:**
```json
{
  "trigger_type": "meeting_ended",
  "data": {
    "meeting": {...},
    "action_items": [...]
  }
}
```

### GET /api/automations/:id/logs

Get automation execution logs.

---

## Search

### POST /api/search

Full-text search across meetings.

**Request Body:**
```json
{
  "query": "quarterly budget",
  "type": "all",
  "limit": 20
}
```

### POST /api/search/semantic

AI-powered semantic search.

**Request Body:**
```json
{
  "query": "What did we decide about the pricing strategy?",
  "limit": 10
}
```

### POST /api/search/ask

Ask AI a question with context from meetings.

**Request Body:**
```json
{
  "question": "Who is responsible for the marketing campaign?"
}
```

### GET /api/search/suggestions

Get search suggestions based on history.

---

## Integrations

### CRM Endpoints

#### POST /api/integrations/crm/sync-action-items

Sync action items to CRM.

**Request Body:**
```json
{
  "action_item_ids": ["uuid1", "uuid2"]
}
```

#### GET /api/integrations/crm/deals

Get deals from CRM.

#### GET /api/integrations/crm/contacts

Get contacts from CRM.

#### GET /api/integrations/crm/status

Check CRM connection status.

### Chat Endpoints

#### POST /api/integrations/chat/post-recap

Post meeting recap to chat channel.

**Request Body:**
```json
{
  "meeting_id": "uuid",
  "channel_id": "C1234567"
}
```

#### POST /api/integrations/chat/post

Post custom message to chat.

**Request Body:**
```json
{
  "channel_id": "C1234567",
  "message": "Custom message text"
}
```

#### GET /api/integrations/chat/channels

List available chat channels (Slack only).

#### GET /api/integrations/chat/status

Check chat service connection status.

### Webhook Endpoints

#### POST /api/integrations/webhooks/receive

Receive webhooks from external services.

**Headers:**
```
X-Webhook-Source: crm | chat | calendar
X-Webhook-Event: deal.created | message.received | etc
```

#### GET /api/integrations/status

Get status of all integrations.

#### GET /api/integrations/logs

Get integration sync logs.

---

## Error Responses

All errors follow this format:

```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE",
    "statusCode": 400,
    "requestId": "req_123456",
    "timestamp": "2025-12-17T10:00:00.000Z"
  }
}
```

**Error Codes:**
| Code | Description |
|------|-------------|
| VALIDATION_ERROR | Invalid input data |
| NOT_FOUND | Resource not found |
| UNAUTHORIZED | Authentication required |
| FORBIDDEN | Insufficient permissions |
| RATE_LIMIT | Too many requests |
| EXTERNAL_SERVICE | Third-party service error |
| DATABASE_ERROR | Database operation failed |
| INTERNAL_ERROR | Server error |

---

## Rate Limits

| Endpoint Type | Limit |
|---------------|-------|
| General API | 100 req/min |
| Authentication | 10 req/15min |
| AI Processing | 10 req/min |

Rate limit headers:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 2025-12-17T10:01:00.000Z
```

---

## Webhooks

Entomate can send webhooks to your endpoints when events occur.

**Webhook Payload:**
```json
{
  "event": "meeting.processed",
  "timestamp": "2025-12-17T10:00:00.000Z",
  "data": {
    "meeting_id": "uuid",
    "title": "Weekly Standup",
    "action_items_count": 5
  }
}
```

**Events:**
- `meeting.created`
- `meeting.processed`
- `action_item.created`
- `task.completed`
- `automation.executed`
