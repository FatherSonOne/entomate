text
# Entomate — Phase 2 — Advanced Search + RAG Specs (Ask Assistant)
**Goal:** Expand “Ask Assistant” from meetings-only into a cross-system search experience that answers questions using meetings + projects/tasks + Logos Vision CRM + Pulse context, and always shows citations.

---

## What we’re building (plain English)
Users should be able to type a question like:
- “What did we promise ACME in the last call?”
- “Which deals are at risk because tasks are overdue?”
- “What are the next steps for the Johnson onboarding?”

Entomate will:
1) search the most relevant records
2) assemble a “context pack”
3) ask Gemini to answer using only that context
4) show **sources** (citations) for trust

This is called RAG: Retrieval-Augmented Generation.

---

## Non-negotiables (Phase 2 MVP rules)
- **Citations are mandatory.** If it can’t cite, it should say “I can’t find that.”
- **Never hallucinate.** If no source supports an answer, the answer must be “Not found.”
- **Fast retrieval first.** Goal: < 500ms retrieval (AI generation excluded).
- **Backend-first.** UI is thin; backend does retrieval + citations.

---

## Data sources (Phase 2)
Entomate Search must be able to retrieve from:

1) Meetings
- transcript text
- summary
- decisions
- action items

2) Projects + Tasks
- project name/description
- task title/description/status/assignee/due date

3) Logos Vision CRM (external)
- deals (name, stage, value, notes)
- contacts (name, email, company)
- tasks (if CRM stores them)

4) Pulse (external)
- messages in relevant channels
- DMs if accessible
- message threads if supported

---

## UX: Search UI requirements
### Screen: Ask Assistant
Minimum UI features:
- question input
- “Filters” drawer:
  - time range
  - deal/customer
  - owner/assignee
  - source types (meetings/tasks/crm/pulse)
- answer panel
- citations panel (clickable items)

---

## Retrieval strategy (backend)
### Step 1: Normalize the question
- Trim whitespace
- Detect filters (optional):
  - date phrases (last week / last month)
  - deal name (ACME / Johnson)
  - entity type (deal/task/meeting)

### Step 2: Embed the question
Use Gemini embeddings (or your embeddings provider) and store vectors in Postgres (pgvector recommended MVP).

### Step 3: Retrieve top-K chunks from each source
Example:
- top 6 meeting chunks
- top 6 tasks chunks
- top 4 CRM deal note chunks
- top 4 Pulse message chunks

Then merge results by score and remove duplicates.

### Step 4: Build the “Context Pack”
Context pack is a JSON array with:
- `sourceType`
- `sourceId`
- `title`
- `snippet`
- `url` (internal link)
- `metadata`
- `score`

### Step 5: Generate answer with Gemini (RAG prompt)
Gemini prompt must:
- instruct model to cite sources explicitly
- forbid adding unsupported claims
- enforce “Not found” behavior

---

## Embeddings + schema (recommended MVP)
### Option A (recommended): pgvector in Postgres
You will store embeddings for each searchable “document chunk.”

Create table: `search_documents`
- `id` uuid
- `source_type` text (meeting | task | crm_deal | pulse_message | project | crm_contact)
- `source_id` text/uuid (the external or internal ID)
- `title` text
- `content` text (chunk text)
- `metadata` jsonb (dealId, projectId, participants, timestamps, channelId, etc.)
- `embedding` vector(768)  (adjust dim to provider output)
- `created_at` timestamp

Index:
- ivfflat cosine index on embedding
- btree index on source_type
- btree index on metadata fields you filter on (optional)

### Chunking rules
- Meetings: chunk transcript into ~600–1200 tokens with overlap
- Tasks: usually single chunk per task
- CRM deals: chunk notes + key fields
- Pulse: chunk per message (or per thread summary later)

---

## Ingestion (how data gets into search_documents)
### Meetings ingestion
When a meeting is processed:
- store transcript + summary + decisions + action items
- generate chunks
- embed chunks
- upsert into `search_documents`

### Tasks/projects ingestion
On task/project create/update:
- generate a text representation (title + description + status)
- embed and upsert

### CRM ingestion
Pick one MVP method:
1) Polling (every 15 minutes) OR
2) Webhooks (preferred if Logos Vision supports it)

For MVP, polling is acceptable:
- fetch changed deals/contacts/tasks since last sync time
- embed and upsert

### Pulse ingestion
Same: polling or webhooks.
MVP:
- ingest recent messages from selected channels
- store messages
- embed and upsert

---

## Citations model (must-have)
Every retrieved context item must map to a citation object:
- citationId (short)
- sourceType
- sourceId
- title
- snippet
- url (deep link in Entomate UI)
- timestamp (if available)

The final answer must include citations like:
- “We promised delivery by Jan 12 [M3].”
Where [M3] is a citation label that maps to a meeting chunk.

---

## Backend endpoints (minimum)
### Ask endpoint
`POST /api/search/ask`

Request:
{
"question": "What did we promise ACME in the last call?",
"filters": {
"sourceTypes": ["meeting", "task", "crm_deal", "pulse_message"],
"dateFrom": "2025-11-01",
"dateTo": "2025-12-16",
"dealId": "optional"
}
}

text

Response:
{
"question": "...",
"answer": "We promised to deliver ... [M3] [P2].",
"citations": [
{ "id": "M3", "sourceType": "meeting", "title": "ACME Weekly", "url": "/meetings/...", "snippet": "..." },
{ "id": "P2", "sourceType": "pulse_message", "title": "#sales message", "url": "/pulse/...", "snippet": "..." }
],
"retrieval": {
"count": 12,
"topSources": [
{ "sourceType": "meeting", "count": 6 },
{ "sourceType": "task", "count": 4 }
]
}
}

text

### Admin endpoints (optional but useful)
- `POST /api/search/reindex` (rebuild embeddings)
- `GET /api/search/stats` (counts per source type)

---

## Node.js reference modules (backend-first)
Create these files (Phase 2 naming convention):

### `src/search/embedder.js`
Responsibilities:
- call embedding API
- return vector

### `src/search/retriever.js`
Responsibilities:
- run vector search
- apply filters (source types, date ranges, dealId, projectId)
- return ranked context items

### `src/search/citations.js`
Responsibilities:
- create citation IDs (M1, T1, D1, P1)
- build citations array
- ensure snippets are short and safe

### `src/search/ragAnswer.js`
Responsibilities:
- build final RAG prompt
- call Gemini
- validate output format (citations present)
- if model fails citations rules → return “Not found”

---

## RAG Prompt (recommended template)
Use a prompt like this (backend constructs it):

System / Developer Instruction:
- You are an assistant for Entomate.
- Answer only using provided CONTEXT.
- Every factual sentence must include citations like [M1] or [T2].
- If not in CONTEXT, respond: "I couldn't find that information in your data."

User:
- QUESTION: ...
- CONTEXT:
  - (items with citation labels + text)

---

## Quality guardrails (anti-hallucination)
Implement post-processing:
- If answer contains zero citations → reject and return Not found
- If answer references a citation ID that doesn't exist → reject
- If answer is extremely long without citations → reject

---

## Testing (Phase 2 acceptance)
Create a fixed test set:
- 25 questions written down
- expected answer type:
  - found with citations
  - not found
- at least 10 questions must reference:
  - CRM + meeting combined
  - Pulse + meeting combined
- log quality scores weekly (1–5)

---

## Gemini Studio prompts (copy/paste)
### Prompt A — Search UI wireframe
Design a "Ask Assistant" search page for Entomate.
Must include: question input, filters (date range, deal/customer, owner, source type), answer panel, citations panel with clickable sources.
Style: minimalist enterprise.
Show empty state, loading state, and "not found" state.

text

### Prompt B — Citations UX
Design a citations panel UX for an AI assistant.
Each citation should show: source type icon, title, timestamp, snippet, and a button to open the source record.
Include a compact "sources used" summary at the top.
Style: clean enterprise UI.

text

---

## Next file to request
Reply: **“Show file 05”** for the Knowledge Graph MVP spec (relationships model + minimal UI for linked records).