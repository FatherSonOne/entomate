# Search Section Audit — Entomate

**Date:** 2026-03-31
**Auditor:** Claude Opus 4.6
**Scope:** All Search-related code, services, routes, types, migrations, and components

---

## 1. File Inventory

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Search.jsx` | 1,562 | Main search page (keyword, semantic, Ask AI, analytics) |
| `frontend/src/components/CrossAppSearch.jsx` | 484 | Cmd/Ctrl+K cross-app search modal |
| `src/components/SearchView.tsx` | 476 | RAG search view (TypeScript, root src/) |
| `src/search/types.ts` | 95 | TypeScript type definitions |
| `src/search/index.ts` | 11 | Module re-exports |
| `src/search/embedder.ts` | 127 | Gemini embedding generation |
| `src/search/retriever.ts` | 179 | Vector similarity search |
| `src/search/citations.ts` | 150 | Citation management for RAG |
| `src/search/ragAnswer.ts` | 164 | RAG answer generation with Gemini |
| `src/search/indexer.ts` | 498 | Document indexing for all source types |
| `backend/routes/search.js` | 1,038 | Backend search API routes (17 endpoints) |
| `backend/routes/crossAppSearch.js` | 207 | Backend cross-app search routes (4 endpoints) |
| `backend/services/crossAppSearch.js` | 715 | Cross-app search service (hub + local) |
| `backend/services/askService.js` | 551 | AI question answering service |
| `backend/services/embeddingService.js` | 347 | Embedding service (OpenAI/Gemini) |
| `backend/services/vectorStore.js` | 873 | Vector store service (unused by search routes) |
| `supabase/migrations/20251219_001_week6_search_tables.sql` | 188 | DB migration: embeddings, search_history, saved_searches, conversations |
| `docs/migrations/week6-search-indexes.sql` | 261 | Search optimization indexes |
| `docs/phase2/search-test-questions.md` | 209 | RAG test questions (25 Q&A tests) |

**Total:** ~7,135 lines across 19 files

---

## 2. Architecture Diagram

```
                              FRONTEND
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  Search.jsx (1562 lines)       CrossAppSearch.jsx      │
  │  ├─ Keyword Search             ├─ Cmd/Ctrl+K modal     │
  │  ├─ Semantic Search            ├─ Hub search            │
  │  ├─ Ask AI (streaming)         └─ Deep links            │
  │  ├─ Autocomplete/Suggestions       NOT MOUNTED          │
  │  ├─ Search History                                      │
  │  ├─ Saved Searches            SearchView.tsx            │
  │  ├─ Export (CSV/JSON)          ├─ RAG-powered Ask       │
  │  └─ Analytics Dashboard        ├─ Citations sidebar     │
  │       │                        └─ Reindex button        │
  │       │ searchApi                    NOT MOUNTED         │
  └───────┼────────────────────────────────────────────────┘
          │
          ▼
                              BACKEND
  ┌────────────────────────────────────────────────────────┐
  │                                                        │
  │  /api/search (search.js)      /api/cross-search        │
  │  ├─ POST /               (crossAppSearch.js)           │
  │  ├─ POST /semantic        ├─ GET /                     │
  │  ├─ POST /ask             ├─ GET /recent               │
  │  ├─ POST /ask/stream      ├─ GET /status               │
  │  ├─ POST /ask/follow-up   └─ GET /suggestions          │
  │  ├─ GET  /conversations                                │
  │  ├─ GET  /conversations/:id    ┌──────────────────┐    │
  │  ├─ DELETE /conversations/:id  │ crossAppSearch.js │    │
  │  ├─ GET  /history              │ ├─ Hub client     │    │
  │  ├─ DELETE /history            │ ├─ searchContacts │    │
  │  ├─ POST /save                 │ ├─ searchEvents   │    │
  │  ├─ GET  /saved                │ ├─ searchMeetings │    │
  │  ├─ DELETE /saved/:id          │ └─ searchActions   │    │
  │  ├─ GET  /suggestions          └──────────────────┘    │
  │  ├─ GET  /recent                                       │
  │  ├─ GET  /analytics         ┌──────────────────────┐   │
  │  ├─ POST /export            │ askService.js        │   │
  │  ├─ GET  /cache/stats       │ ├─ answerQuestion    │   │
  │  └─ POST /cache/invalidate  │ ├─ streaming answer  │   │
  │                              │ ├─ conversations    │   │
  │                              │ └─ follow-ups       │   │
  │                              └──────────────────────┘   │
  │                                        │               │
  │                              ┌──────────────────────┐   │
  │                              │ embeddingService.js  │   │
  │                              │ ├─ generateEmbedding │   │
  │                              │ ├─ semanticSearch    │   │
  │                              │ └─ storeEmbedding    │   │
  │                              └──────────────────────┘   │
  └────────────────────────────────────────────────────────┘

                          ROOT src/search/ (TypeScript)
  ┌────────────────────────────────────────────────────────┐
  │  SearchView.tsx imports from:                          │
  │  ├─ embedder.ts  → Gemini embeddings                  │
  │  ├─ retriever.ts → search_documents_by_embedding RPC  │
  │  ├─ citations.ts → Citation ID generation             │
  │  ├─ ragAnswer.ts → RAG answer with Gemini             │
  │  └─ indexer.ts   → Full reindex of all sources        │
  │                                                        │
  │  Uses: search_documents table (NOT IN MIGRATION)       │
  │  Uses: search_documents_by_embedding RPC (NOT CREATED) │
  └────────────────────────────────────────────────────────┘

                            DATABASE
  ┌────────────────────────────────────────────────────────┐
  │  embeddings         (pgvector, 1536-dim)               │
  │  search_history     (query, type, results, time)       │
  │  saved_searches     (name, query, type)                │
  │  conversations      (user conversations)               │
  │  conversation_messages (chat messages)                  │
  │                                                        │
  │  MISSING: search_documents table (used by indexer.ts)  │
  │  MISSING: search_documents_by_embedding RPC            │
  └────────────────────────────────────────────────────────┘
```

---

## 3. Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| **Search.jsx — Keyword Search** | ✅ Working | Full-text ILIKE across meetings, projects, tasks, action_items |
| **Search.jsx — Semantic Search** | ⚠️ Partial | Calls embeddingService which falls back to text search if pgvector not set up |
| **Search.jsx — Ask AI Chat** | ⚠️ Partial | Works if AI is configured; conversation persistence depends on tables existing |
| **Search.jsx — Streaming Ask** | ⚠️ Partial | SSE implementation exists but no AbortController for cleanup |
| **Search.jsx — Autocomplete** | ✅ Working | Debounced suggestions from meetings, projects, history |
| **Search.jsx — Trending Searches** | ✅ Working | Top queries from search_history |
| **Search.jsx — Search History** | ⚠️ Partial | Works but not user-scoped — all users see all history |
| **Search.jsx — Saved Searches** | ⚠️ Partial | Works but not user-scoped |
| **Search.jsx — Export CSV/JSON** | ✅ Working | Backend generates proper CSV with escaping |
| **Search.jsx — Analytics Dashboard** | ✅ Working | Metrics, daily trend chart, top queries, zero-results, peak hour |
| **Search.jsx — Cache Management** | ✅ Working | In-memory cache with TTL, pattern invalidation |
| **CrossAppSearch — Cmd/K Modal** | ❌ Not Mounted | Component exists, hook exists, but NOT imported in Layout.jsx or App.jsx |
| **CrossAppSearch — Hub Search** | ⚠️ Partial | Requires HUB_SUPABASE_URL + HUB_SUPABASE_SERVICE_KEY env vars |
| **CrossAppSearch — Deep Links** | ✅ Working | Generates proper deep links per source app |
| **CrossAppSearch — Keyboard Nav** | ✅ Working | Arrow keys, Enter, Escape all wired |
| **SearchView.tsx — RAG Search** | ❌ Not Mounted | Lives in root `src/` not `frontend/src/`, not in app router |
| **SearchView.tsx — Citation Sidebar** | ✅ Implemented | Clickable citations with source badges |
| **SearchView.tsx — Reindex** | ⚠️ Partial | Calls indexer which needs `search_documents` table (not in migration) |
| **src/search/ — Embedder** | ✅ Working | Gemini text-embedding-004 with chunking + batching |
| **src/search/ — Retriever** | ❌ Broken | Calls `search_documents_by_embedding` RPC which doesn't exist in migrations |
| **src/search/ — RAG Answer** | ✅ Implemented | Anti-hallucination validation, citation checking |
| **src/search/ — Indexer** | ❌ Broken | Writes to `search_documents` table not created by any migration |
| **Backend — /api/search routes** | ⚠️ Partial | 17 endpoints implemented, most lack auth middleware |
| **Backend — /api/cross-search** | ⚠️ Partial | Works but hub requires env vars, no auth on main endpoint |
| **DB — Embeddings table** | ✅ Migrated | pgvector with fallback to JSONB |
| **DB — Search history** | ✅ Migrated | With indexes |
| **DB — Saved searches** | ✅ Migrated | With indexes |
| **DB — Conversations** | ✅ Migrated | With messages table |
| **DB — search_documents** | ❌ Missing | Required by `src/search/indexer.ts` but not in any migration |
| **DB — search_documents_by_embedding RPC** | ❌ Missing | Required by `src/search/retriever.ts` |
| **DB — RLS Policies** | ❌ Disabled | Commented out in migration |

---

## 4. Issues Found

### 🔴 Critical

**C1. CrossAppSearch Not Mounted**
`CrossAppSearch.jsx` and its `useCrossAppSearch()` hook are fully implemented (484 lines) but never imported in `Layout.jsx` or `App.jsx`. The Cmd/Ctrl+K search feature is completely inaccessible to users.

**C2. `search_documents` Table Missing from Migrations**
`src/search/indexer.ts` writes to a `search_documents` table. `src/search/retriever.ts` calls a `search_documents_by_embedding` RPC function. Neither exist in any migration file. The entire `src/search/` TypeScript RAG pipeline is non-functional at the database level.

**C3. SearchView.tsx Not Routed**
`SearchView.tsx` lives in root `src/components/` (not `frontend/src/`), is a complete RAG search UI with filters, citations sidebar, history, and reindex — but is not mounted in any router. It represents ~476 lines of dead code in the app.

**C4. Most Search API Routes Lack Authentication**
In `backend/routes/search.js`, only `GET /suggestions` uses the `authenticate` middleware. All other 16 endpoints (POST /search, POST /semantic, POST /ask, DELETE /history, etc.) are unprotected. Any unauthenticated request can:
- Search all data
- Delete all search history
- Delete saved searches
- Delete conversations
- Trigger reindexing
- View analytics

**C5. RLS Disabled on Search Tables**
The migration comments out all RLS policies. Combined with `anon` role having `DELETE` permissions on `saved_searches` and `conversations`, any anonymous Supabase client can delete user data.

### 🟡 Medium

**M1. Three Overlapping Search UIs**
There are three separate search interfaces:
1. `Search.jsx` — Full page with keyword + semantic + Ask AI
2. `CrossAppSearch.jsx` — Modal with cross-app search
3. `SearchView.tsx` — RAG-powered search with citations

They share no code, have different styling approaches, and use different backend services. This is a maintenance burden and confusing architecture.

**M2. Two Duplicate Embedding Systems**
- `backend/services/embeddingService.js` — Node.js service using AI config (OpenAI or Gemini)
- `src/search/embedder.ts` — TypeScript module using Gemini directly

Both generate embeddings, both store them, both do semantic search. They should be consolidated.

**M3. Search History Not User-Scoped**
`backend/routes/search.js` — `GET /history`, `DELETE /history`, `GET /analytics` all operate on the entire `search_history` table without filtering by `user_id`. Every user sees every other user's search history. The table has a `user_id` column but it's never populated or filtered.

**M4. Search.jsx is a 1562-line God Component**
The main search page handles: search input, autocomplete dropdown, trending, keyboard navigation, search results, Ask AI chat with streaming, search history panel, saved searches panel, save modal, export, and analytics dashboard — all in one component with 55+ state variables.

**M5. SearchView.tsx Hardcoded Light-Mode Colors**
Uses `bg-white`, `text-gray-*`, `bg-gray-50`, `border-gray-200` etc. No dark mode support. Inconsistent with Entomate's void-crimson design system.

**M6. CrossAppSearch Requires Hub Env Vars**
Without `HUB_SUPABASE_URL` and `HUB_SUPABASE_SERVICE_KEY`, the cross-app search silently returns empty results with no user-facing feedback about the missing configuration.

**M7. vectorStore.js (873 lines) Appears Orphaned**
`backend/services/vectorStore.js` exists but is not imported by any search route. It's only used by `RAGNodes.js` (workflow) and `ragHandler.js` (agents). Should either be integrated or documented as workflow-specific.

**M8. `embeddings` Table Dimension Mismatch**
Migration creates `embedding vector(1536)` (OpenAI dimension). But `src/search/embedder.ts` uses Gemini's `text-embedding-004` which produces 768-dim embeddings. The backend `embeddingService.js` also mentions "Gemini are 768-dim" in a comment. Inserting 768-dim vectors into a 1536-dim column will fail.

**M9. No Abort/Cleanup for Streaming Ask**
`Search.jsx` uses `fetch` with ReadableStream for SSE but has no AbortController. If the user navigates away mid-stream, the connection leaks.

**M10. `DELETE /history` Deletes All Records**
The route uses `.neq('id', '00000000-0000-0000-0000-000000000000')` to delete ALL records, not just the current user's. This is a data loss risk in multi-user environments.

### 🟢 Nice-to-Have

**N1. No Search Result Highlighting**
Query terms are not highlighted/bolded in search result titles or previews.

**N2. No Pagination**
Both Search.jsx and CrossAppSearch use a fixed `limit` with no pagination or infinite scroll.

**N3. `reindexAll()` is Sequential**
The indexer processes each source type sequentially. Could run meetings, tasks, projects, deals in parallel for faster reindexing.

**N4. No Type-Ahead Filter Chips**
Search.jsx has no ability to filter by source type (meetings, tasks, projects) before searching. The backend supports `types` parameter but the UI doesn't expose it.

**N5. Analytics Renders Bar Charts as Divs**
Daily trend chart uses `div` elements with inline heights. Could use a proper charting library for better UX.

**N6. Missing Keyboard Shortcut for Search Page**
CrossAppSearch has Cmd+K but the main Search page has no keyboard shortcut to focus the input.

**N7. Citation Validation Rejects Valid Answers**
`ragAnswer.ts` rejects any answer without citations, even if the AI correctly says "I couldn't find that information." The fallback logic checks for keywords but is fragile.

---

## 5. Dead Code / Unused Imports

| Item | Location | Issue |
|------|----------|-------|
| `searchStats` state | `CrossAppSearch.jsx:100` | Set but never rendered in the UI (footer stats section only shows when `searchStats` is truthy but it's only set after search) — actually this IS rendered in footer, so this is OK |
| `Building2` import | `CrossAppSearch.jsx:22` | Imported but never used |
| `vectorStore.js` | `backend/services/` | 873 lines, not used by any search route |
| `SearchView.tsx` | `src/components/` | 476 lines, not mounted in router |
| `search-test-questions.md` | `docs/phase2/` | Test plan with no results filled in |

---

## 6. Security Concerns

1. **No auth on 16/17 search endpoints** — Anyone can search, delete, and view analytics
2. **RLS disabled** on all search tables
3. **`anon` role has DELETE** on saved_searches and conversations
4. **Search history exposes all users' queries** — No user scoping
5. **ILIKE pattern injection** — While Supabase parameterizes, the `%${query}%` pattern allows users to craft LIKE patterns (e.g., `%` returns all records)
6. **No rate limiting on cross-search suggestions** endpoint
7. **Error messages expose internal details** — `res.status(500).json({ error: error.message })` leaks stack info

---

## 7. Revisal Plan

### Phase 1: Fix Critical Issues (Security + Broken Functionality)

1. **Add `authenticate` middleware to all search routes**
   - File: `backend/routes/search.js`
   - Add `authenticate` to every route, scope history/saved/conversations by `req.user.id`

2. **Enable RLS on search tables**
   - New migration: Enable RLS, create policies scoping by `user_id`
   - Remove `DELETE` from `anon` grants

3. **Create `search_documents` table + RPC migration**
   - Create `search_documents` table with proper schema
   - Create `search_documents_by_embedding` RPC function
   - Fix embedding dimension (768 for Gemini, or make configurable)

4. **Mount CrossAppSearch in Layout**
   - Import `useCrossAppSearch` and `CrossAppSearch` in `Layout.jsx`
   - Wire Cmd/Ctrl+K shortcut

5. **Fix search history user scoping**
   - Filter by `user_id` in all history/saved/conversation queries
   - Populate `user_id` on insert

### Phase 2: Consolidate and Wire Up

6. **Decide on SearchView.tsx vs Search.jsx**
   - Option A: Port SearchView.tsx's RAG features into Search.jsx (recommended)
   - Option B: Mount SearchView.tsx in the frontend router
   - Either way, eliminate the duplicate

7. **Consolidate embedding systems**
   - Choose one: `backend/services/embeddingService.js` OR `src/search/embedder.ts`
   - Standardize on Gemini 768-dim OR OpenAI 1536-dim embeddings
   - Fix migration dimension to match

8. **Add AbortController to streaming Ask**
   - Create an abort controller in `handleAskQuestion`
   - Cancel on unmount or new question

9. **Wire `logSearch` with user_id**
   - Pass `req.user.id` to all `logSearch()` calls

### Phase 3: Refactor and Improve

10. **Split Search.jsx into sub-components**
    - `SearchInput.jsx` — Search bar + autocomplete + type selector
    - `AskAIPanel.jsx` — Chat interface with streaming
    - `SearchResults.jsx` — Results list with type icons
    - `SearchAnalytics.jsx` — Analytics dashboard
    - `SearchHistoryPanel.jsx` — History + saved searches

11. **Add dark mode to SearchView.tsx**
    - Replace hardcoded `bg-white`, `text-gray-*` with design system variables

12. **Remove or document vectorStore.js**
    - If it's workflow-specific, move it or add clear documentation

13. **Error message sanitization**
    - Don't expose `error.message` to clients in production

### Phase 4: New Features and Polish

14. **Search result highlighting**
    - Highlight query terms in titles and previews

15. **Pagination / infinite scroll**
    - Add `offset` parameter to search results

16. **Source type filter chips**
    - Add toggleable filter chips for meetings/tasks/projects/contacts

17. **Fill in RAG test results**
    - Run the 25 test questions from `search-test-questions.md`
    - Document pass rate and latency

18. **Keyboard shortcut to focus Search page input**
    - Add `/` key shortcut similar to GitHub

---

## 8. Claude Agent Prompt

```
You are implementing the Search section revisal for the Entomate project (f:\entomate).

## Context

Entomate has THREE separate search systems that need consolidation:

1. **Main Search Page** — `frontend/src/pages/Search.jsx` (1562 lines)
   - JSX, uses `searchApi` from `frontend/src/services/api.js`
   - Calls `/api/search` backend routes at `backend/routes/search.js`
   - Features: keyword search, semantic search, Ask AI (streaming SSE), autocomplete, trending, search history, saved searches, export CSV/JSON, analytics dashboard
   - PROBLEM: 1562-line god component, no auth on routes, history not user-scoped

2. **CrossAppSearch Modal** — `frontend/src/components/CrossAppSearch.jsx` (484 lines)
   - Cmd/Ctrl+K triggered modal searching across ecosystem apps
   - Calls `/api/cross-search` routes at `backend/routes/crossAppSearch.js`
   - Service: `backend/services/crossAppSearch.js` — searches hub + local DB
   - PROBLEM: **Not mounted** — never imported in Layout.jsx or App.jsx

3. **SearchView (TypeScript RAG)** — `src/components/SearchView.tsx` (476 lines)
   - Uses `src/search/` modules: embedder.ts, retriever.ts, citations.ts, ragAnswer.ts, indexer.ts
   - PROBLEM: **Not mounted**, lives in root src/ not frontend/src/, requires missing DB table

## Backend Services

- `backend/routes/search.js` — 17 endpoints, most LACK `authenticate` middleware
- `backend/routes/crossAppSearch.js` — 4 endpoints with rate limiter
- `backend/services/crossAppSearch.js` — Hub search (shared_contacts, cross_app_events) + local (meetings, action_items)
- `backend/services/askService.js` — AI Q&A with conversation persistence
- `backend/services/embeddingService.js` — Vector embeddings (OpenAI/Gemini)
- `backend/services/vectorStore.js` — 873 lines, NOT used by search routes

## Database

Migration: `supabase/migrations/20251219_001_week6_search_tables.sql`
Tables: embeddings, search_history, saved_searches, conversations, conversation_messages
MISSING: `search_documents` table (needed by indexer.ts), `search_documents_by_embedding` RPC (needed by retriever.ts)
RLS: DISABLED on all search tables
SECURITY: `anon` has DELETE on saved_searches and conversations

## Phase 1 Tasks (Critical)

1. Add `authenticate` middleware to ALL routes in `backend/routes/search.js`. Scope all queries by `req.user.id`. Import: `const { authenticate } = require('../middleware/auth');`

2. Create a new migration `supabase/migrations/20260331_fix_search_security.sql`:
   - Enable RLS on search_history, saved_searches, conversations, conversation_messages
   - Create policies: users can only see/modify their own rows (WHERE user_id = auth.uid())
   - Revoke DELETE from anon on saved_searches and conversations
   - Create `search_documents` table with columns: id UUID, source_type TEXT, source_id TEXT, title TEXT, content TEXT, embedding vector(768), metadata JSONB, indexed_at TIMESTAMPTZ, chunk_index INT DEFAULT 0, UNIQUE(source_type, source_id)
   - Create `search_documents_by_embedding` RPC function matching the signature in retriever.ts

3. Mount CrossAppSearch in Layout:
   - In `frontend/src/components/Layout.jsx`, import `CrossAppSearch, { useCrossAppSearch }` from '../components/CrossAppSearch'
   - Add the hook and component near the root of the layout

4. Fix user scoping in search routes:
   - `logSearch()` — add user_id parameter
   - GET /history — filter by user_id
   - DELETE /history — filter by user_id
   - POST /save — include user_id
   - GET /saved — filter by user_id
   - DELETE /saved/:id — verify ownership

## Phase 2 Tasks (Consolidation)

5. Port SearchView.tsx RAG features into Search.jsx OR mount it in the router. Recommended: Extract the citation rendering and RAG answer display patterns from SearchView.tsx and integrate them into the existing Ask AI panel in Search.jsx.

6. Consolidate embedding dimension: Update the migration to use vector(768) for Gemini embeddings. Or if using OpenAI, keep 1536 but update embedder.ts.

7. Add AbortController to streaming in Search.jsx handleAskQuestion.

## Phase 3 Tasks (Refactor)

8. Split Search.jsx into: SearchInput, AskAIPanel, SearchResults, SearchAnalytics, SearchHistoryPanel sub-components.

## Design System

Use Entomate's void-crimson design variables:
- `var(--bg-elevated)`, `var(--text-primary)`, `var(--accent-primary)` (crimson), `var(--accent-secondary)` (mint), `var(--accent-tertiary)` (amber)
- Card class: `vc` (void-crimson card)
- Input class: `vinput`
- Components: VCButton, VCBadge, VCSelect from `../components/vc`
```

---

*Audit complete. 19 files reviewed, ~7,135 lines of code, 5 critical issues, 10 medium issues, 7 nice-to-haves identified.*
