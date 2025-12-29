text
# Entomate — Phase 2 — Knowledge Graph MVP
**Goal:** Create an accurate “linked records” system so Entomate can show relationships like:  
- This meeting is about this deal  
- These action items became these tasks  
- This deal created this project  
- These Pulse messages relate to this customer  

**Important:** MVP does NOT require a fancy visual graph. MVP requires accurate relationships + a usable UI panel.

---

## What a “Knowledge Graph” means (plain English)
A Knowledge Graph is just a way to store and query **connections** between things.

Think of it like:
- a spreadsheet of “A is connected to B”
- plus a UI that lets users click through those connections

Example connections:
- Meeting → Deal
- Meeting → Task
- Deal → Project
- Deal → Contact
- Pulse message → Deal

This becomes the foundation for:
- better Search/RAG (retrieve the right context faster)
- better Agents (know where to write updates)
- better Analytics (predictions based on connected data)

---

## MVP non-negotiables
- Relationships must be **traceable** (why does this link exist?).
- Relationships must be **deduped** (same link isn’t stored 50 times).
- Relationships must be **queryable quickly** (indexes matter).
- UI must show linked records even if visualization is simple.

---

## What to build first (backend-first order)
1) Relationships table (single generic table)
2) Relationship creation rules (from your existing data flows)
3) Relationship query endpoints
4) UI: Linked Records panel (graph visualization optional)

---

## Database schema (Postgres)
### Table: `relationships`
This is the core of the Knowledge Graph MVP.

Recommended columns:
- `id` uuid primary key
- `source_type` text (examples: `meeting`, `deal`, `task`, `project`, `contact`, `pulse_message`)
- `source_id` text (uuid or external crm id)
- `target_type` text
- `target_id` text
- `relationship_type` text (examples below)
- `confidence` float (0.0–1.0) (optional but recommended)
- `evidence` jsonb (store “why we linked it”)
- `created_at` timestamp

### Relationship types (recommended MVP list)
- `meeting_mentions_deal`
- `meeting_created_action_item`
- `action_item_created_task`
- `deal_created_project`
- `deal_has_contact`
- `pulse_message_mentions_deal`
- `task_belongs_to_project`
- `meeting_related_to_project`

### Indexes (important)
Add indexes so queries are fast:
- index on (source_type, source_id)
- index on (target_type, target_id)
- unique constraint to prevent duplicates:
  - (source_type, source_id, target_type, target_id, relationship_type)

---

## How relationships get created (MVP rules)
### Rule 1: Meeting → Deal
When a meeting is processed:
- If the meeting is created from a deal context (ex: scheduled from deal page), link it directly.
- OR if transcript mentions the deal name / customer name, link with confidence.

Evidence example:
{
"method": "transcript_match",
"matchedText": "Acme Corp",
"meetingId": "m_123",
"dealId": "d_456"
}

text

### Rule 2: Meeting → Action Item → Task
When Gemini extracts action items:
- Create `meeting_created_action_item` links.
When tasks are created from action items:
- Create `action_item_created_task` links.

### Rule 3: Deal → Project
When you create a project from a deal:
- Create `deal_created_project`.

### Rule 4: Pulse message → Deal (optional but valuable)
If your Pulse ingestion pipeline tags messages with a dealId/customerId:
- Store relationship `pulse_message_mentions_deal`.

---

## API endpoints (minimum)
### Create / upsert relationships (internal use)
- `POST /api/relationships/upsert`
Payload:
{
"sourceType": "meeting",
"sourceId": "m_123",
"targetType": "deal",
"targetId": "d_456",
"relationshipType": "meeting_mentions_deal",
"confidence": 0.8,
"evidence": { "method": "transcript_match", "matchedText": "Acme" }
}

text

### Fetch relationships for an entity
- `GET /api/relationships/:entityType/:entityId`
Returns:
- outgoing links (source → target)
- incoming links (target ← source)

### Fetch a “linked records” bundle (best for UI)
- `GET /api/graph/:entityType/:entityId`
Returns:
- nodes: entities
- edges: relationships

MVP can return max depth = 1 (direct links only).

---

## Node.js backend reference modules
Create:

### `src/graph/relationshipService.js`
Responsibilities:
- `upsertRelationship()`
- `getLinksForEntity()`
- `getGraphBundle(entityType, entityId)`

### `src/routes/relationships.js`
REST endpoints.

### `src/routes/graph.js`
Graph bundle endpoint.

---

## Node.js reference skeleton (safe + deduped)
### `src/graph/relationshipService.js`
const db = require("../db");

async function upsertRelationship({
sourceType,
sourceId,
targetType,
targetId,
relationshipType,
confidence = 1.0,
evidence = {}
}) {
// Unique constraint should enforce dedupe at DB level.
const q = INSERT INTO relationships (id, source_type, source_id, target_type, target_id, relationship_type, confidence, evidence, created_at) VALUES (gen_random_uuid(), $1,$2,$3,$4,$5,$6,$7, NOW()) ON CONFLICT (source_type, source_id, target_type, target_id, relationship_type) DO UPDATE SET confidence = GREATEST(relationships.confidence, EXCLUDED.confidence), evidence = COALESCE(relationships.evidence, '{}'::jsonb) || EXCLUDED.evidence RETURNING *; ;
const vals = [sourceType, sourceId, targetType, targetId, relationshipType, confidence, evidence];
const r = await db.query(q, vals);
return r.rows;
}

async function getLinksForEntity(entityType, entityId) {
const outgoing = await db.query(
SELECT * FROM relationships WHERE source_type=$1 AND source_id=$2 ORDER BY created_at DESC,
[entityType, entityId]
);
const incoming = await db.query(
SELECT * FROM relationships WHERE target_type=$1 AND target_id=$2 ORDER BY created_at DESC,
[entityType, entityId]
);
return { outgoing: outgoing.rows, incoming: incoming.rows };
}

async function getGraphBundle(entityType, entityId) {
const { outgoing, incoming } = await getLinksForEntity(entityType, entityId);

// Simple depth-1 bundle: center node + directly linked nodes.
const edges = [...outgoing, ...incoming];
const nodesMap = new Map();

nodesMap.set(${entityType}:${entityId}, { type: entityType, id: entityId });

for (const e of edges) {
nodesMap.set(${e.source_type}:${e.source_id}, { type: e.source_type, id: e.source_id });
nodesMap.set(${e.target_type}:${e.target_id}, { type: e.target_type, id: e.target_id });
}

return { nodes: Array.from(nodesMap.values()), edges };
}

module.exports = { upsertRelationship, getLinksForEntity, getGraphBundle };

text

---

## UI requirements (Gemini Studio first, then build)
### MVP UI: “Linked Records” panel
On these pages:
- Meeting detail page
- Deal detail page
- Project page
- Task detail page

Show:
- Linked Deals
- Linked Meetings
- Linked Tasks
- Linked Projects
- Linked Contacts
- Linked Pulse Messages

Each item must be clickable.

### Optional UI (only if time): simple graph
A basic node list or 2-column “Connections” view is acceptable.
Do NOT spend time on fancy D3 graph visuals unless relationships are already correct.

---

## QA validation (must pass)
- Randomly sample 20 meetings and verify:
  - Meeting → Deal link is correct
  - Action items → tasks are linked correctly
- Confirm no duplicates:
  - the same meeting→deal link appears only once
- Performance:
  - `GET /api/relationships/meeting/:id` responds quickly (< 200ms typical)

---

## Next steps after MVP (Phase 3 ideas)
- Depth-2 graph traversal (“show me tasks linked to this deal via meetings”)
- Confidence scoring improvements (NLP entity linking)
- Relationship explanations in UI (“linked because transcript mentions Acme”)
- Graph-based retrieval improvements for Search/RAG