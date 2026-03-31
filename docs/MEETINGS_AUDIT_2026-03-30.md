# Meetings Section — Full Audit

**Date:** 2026-03-30
**Auditor:** Claude Opus 4.6
**Project:** Entomate (f:\entomate)

---

## 1. File Inventory

| File | Lines | Layer | Role |
|------|-------|-------|------|
| `frontend/src/pages/Meetings.jsx` | 249 | Frontend Page | Meeting list, search, delete, recorder toggle |
| `frontend/src/pages/MeetingDetail.jsx` | 459 | Frontend Page | Single meeting view: summary, transcript, action items, share, ask AI |
| `frontend/src/components/MeetingRecorder.jsx` | 167 | Frontend Component | Audio recording with visualizer + backend upload |
| `frontend/src/components/ActionItemsList.jsx` | 217 | Frontend Component | Action items with CRM sync status + retry |
| `frontend/src/components/ChatChannelSelector.jsx` | 167 | Frontend Component | Chat channel picker for share-to-chat |
| `frontend/src/components/EcosystemSyncStatus.jsx` | 139 | Frontend Component | Pulse/Logos Vision sync badges |
| `frontend/src/components/intelligence/MeetingPrepCard.jsx` | 225 | Frontend Component | Meeting prep card with sentiment, talking points |
| `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` | 435 | Frontend Component (JSX) | Self-contained intelligence profile config (queries Supabase directly) |
| `frontend/src/components/workflow/MeetingSummaryWidget.jsx` | 433 | Frontend Component | AI summary widget with CRM publish |
| `src/components/MeetingsView.tsx` | 727 | Frontend Component (TSX) | Full meeting flow: record, process, history, CRM sync, Pulse sync |
| `src/components/intelligence/MeetingIntelligencePanel.tsx` | 399 | Frontend Component (TSX) | Intelligence panel with sub-components (SuggestionBanner, ProfileSelector, etc.) |
| `src/services/meetingService.ts` | 196 | Service (TS) | CRUD on `entomate_meetings` + `entomate_action_items` tables + Knowledge Graph hooks |
| `backend/routes/meetings.js` | 1007 | Backend Route | Full REST API: process, transcript, list, get, update, delete, ask, recap, reprocess |
| `backend/routes/meetingSummary.js` | 313 | Backend Route | Summary widget API: get summary, regenerate, publish-crm |
| `backend/schemas/meetings.js` | 64 | Backend Schema | Zod validation for meetings endpoints |
| `backend/services/intelligence/MeetingPrepService.js` | 625 | Backend Service | Meeting prep intelligence: upcoming meetings, talking points, sentiment history |
| `backend/services/calendarService.js` | 407 | Backend Service | Google Calendar integration: events CRUD, sync action items/meetings/goals |
| `backend/routes/calendar.js` | — | Backend Route | Calendar OAuth + event routes (exists but not read) |
| `src/agents/triggers/meetingCompleted.ts` | 130 | Agent Trigger | Fires when meeting is completed with transcript |
| `src/agents/triggers/meetingUpcoming.ts` | 142 | Agent Trigger | Fires before meeting to assemble intelligence context |
| `src/agents/templates/meetingOutcomeProcessor.ts` | 88 | Agent Template | Post-meeting: extract action items, sync CRM, post to Pulse |
| `src/agents/templates/meetingInsightsAgent.ts` | 97 | Agent Template | Post-meeting: extract insights, sentiment, share in Pulse |
| `src/intelligence/templates/boardMeeting.ts` | 82 | Intelligence Template | Board meeting profile template (TypeScript version) |
| `supabase/migrations/20260328_001_meeting_intelligence_profiles.sql` | 296 | Database | Intelligence profiles, meeting config, context cache tables + 7 seed profiles |
| `output/meetings-redesign-playground.html` | — | Design Artifact | Playground file (design exploration) |

**Total: 24 files, ~6,300+ lines of code**

---

## 2. Architecture Diagram

```
                                     ┌─────────────────────────────┐
                                     │     Supabase Database       │
                                     │                             │
                                     │  meetings                   │
                                     │  action_items               │
                                     │  entomate_meetings          │
                                     │  entomate_action_items      │
                                     │  intelligence_profiles      │
                                     │  meeting_intelligence_config│
                                     │  intelligence_context_cache │
                                     └─────────┬──────┬────────────┘
                                               │      │
                         ┌─────────────────────┤      ├─────────────────────┐
                         │                     │      │                     │
                    Backend (Express)      TS Services            Direct Supabase
                         │                     │                        │
          ┌──────────────┼──────────────┐      │              ┌─────────┴──────────┐
          │              │              │      │              │                    │
   meetings.js   meetingSummary.js  calendar.js │    MeetingIntelligencePanel.jsx  │
   (REST API)     (Widget API)    (GCal)  │    │      (queries Supabase directly) │
          │              │              │      │                                  │
          └──────────────┼──────────────┘      │                                  │
                         │                     │                                  │
                    ┌────┴────┐          ┌─────┴──────┐                           │
                    │         │          │            │                           │
               ai config   MeetingPrep  meetingService.ts                        │
               (Gemini/    Service.js   (entomate_meetings)                      │
                OpenAI)                                                          │
                         │                                                       │
                    ┌────┴─────────────────┐                                     │
                    │   Ecosystem Bridge    │                                     │
                    │                       │                                     │
                    │  Pulse ◄──► Entomate  │                                     │
                    │  Logos Vision ◄──►    │                                     │
                    │  Hub (legacy)         │                                     │
                    └──────────────────────┘                                      │
                                                                                 │
          FRONTEND                                                               │
          ┌──────────────────────────────────────────────────────────────────────┐│
          │                                                                      ││
          │  Meetings.jsx ──── MeetingRecorder.jsx ──── backend /process         ││
          │       │                                                              ││
          │  MeetingDetail.jsx                                                   ││
          │       ├── MeetingIntelligencePanel.jsx (JSX, queries Supabase)  ◄────┘│
          │       ├── ActionItemsList.jsx ──── integrationsApi.crm                │
          │       ├── EcosystemSyncStatus.jsx ──── /api/ecosystem/sync-status     │
          │       ├── ChatChannelSelector.jsx ──── integrationsApi.chat            │
          │       └── Ask AI (inline) ──── meetingsApi.ask                         │
          │                                                                       │
          │  MeetingsView.tsx (SEPARATE, src/components/)                          │
          │       ├── MeetingIntelligencePanel.tsx (TSX, sub-components)           │
          │       ├── CoachingPanel + SentimentAnalysisCard (phase3)               │
          │       ├── LinkedRecordsPanel (Knowledge Graph)                         │
          │       └── Uses: meetingService.ts, geminiService.ts, crmSyncService   │
          │                                                                       │
          │  MeetingPrepCard.jsx (Intelligence Dashboard widget)                   │
          │  MeetingSummaryWidget.jsx (Workflow widget)                             │
          └────────────────────────────────────────────────────────────────────────┘

          AGENT LAYER
          ┌────────────────────────────────────────┐
          │  meetingCompleted trigger ───► Agent    │
          │  meetingUpcoming trigger  ───► Agent    │
          │                                        │
          │  Templates:                            │
          │    meetingOutcomeProcessor (disabled)   │
          │    meetingInsightsAgent (disabled)      │
          └────────────────────────────────────────┘
```

---

## 3. Feature Status Catalog

### 3.1 Core Meeting Features

| Feature | Status | Notes |
|---------|--------|-------|
| Meeting list page | ✅ Working | Fetches from backend, search, delete with confirm dialog |
| Audio recording | ✅ Working | WebM/Opus, audio visualizer, device selection from settings |
| AI transcription (Gemini/OpenAI) | ✅ Working | Multi-provider via `ai` config module |
| AI summary generation | ✅ Working | Summary, key points, decisions, sentiment, topics |
| AI action item extraction | ✅ Working | Task, owner, priority, due date extraction |
| Embedding generation | ✅ Working | Semantic search embeddings via `embeddingService` |
| Meeting detail page | ✅ Working | Summary, key points, decisions, transcript, action items |
| Ask AI about meeting | ✅ Working | Question → context + transcript → AI answer with confidence |
| Meeting delete | ✅ Working | Cascading delete of action items + meeting |
| Meeting update | ✅ Working | Title, summary, key_points, decisions, project_id, crm_deal_id |
| Text transcript processing | ✅ Working | `/transcript` endpoint — skip audio, process text directly |
| Meeting reprocess | ✅ Working | Re-run AI pipeline on existing meetings (ecosystem import flow) |
| Audio upload to Supabase Storage | ✅ Working | Stored in `recordings` bucket |
| Formatted chat recap | ✅ Working | AI-formatted or fallback recap |

### 3.2 Intelligence System

| Feature | Status | Notes |
|---------|--------|-------|
| Intelligence profiles (DB) | ✅ Working | 7 seeded profiles: Grant, Sales, Client, Board, Standup, Strategic, Vendor |
| Profile suggestion engine (JSX) | ✅ Working | Keyword/recurring/org_type matching in inline JSX panel |
| Profile suggestion engine (TSX) | ✅ Working | Uses `suggestProfiles()` from intelligence service layer |
| Profile selection UI | ✅ Working | Grid with confidence badges, selection, customization |
| Custom fields form | ✅ Working | text, textarea, select, date inputs |
| Context assembly | ⚠️ Partial | TSX version calls `assembleContext()` — depends on intelligence service layer availability |
| Prompt composition | ⚠️ Partial | TSX version calls `buildMeetingPrompt()` — template system exists but execution depends on Gemini call |
| Meeting intelligence config save | ✅ Working | Upserts to `meeting_intelligence_config` table |

### 3.3 Ecosystem Integration

| Feature | Status | Notes |
|---------|--------|-------|
| Post meeting to Pulse | ✅ Working | Via ecosystem bridge, auto-posts recap + high-priority task alerts |
| Sync to Logos Vision CRM | ✅ Working | Meeting + action items + contact discovery |
| Action item CRM sync (per-item) | ✅ Working | ActionItemsList has retry per-item and bulk sync |
| Ecosystem sync status display | ✅ Working | Shows Pulse + Logos Vision sync badges with retry |
| Share to chat (Slack/Teams/Discord) | ✅ Working | Channel selector, post recap, track posted status |
| Hub event publishing (legacy) | ✅ Working | Fallback `hubEventPublisher.meetingCompleted()` |
| MeetingSummaryWidget CRM publish | ✅ Working | Widget-specific publish via `/meeting-summary/:id/publish-crm` |

### 3.4 Calendar Integration

| Feature | Status | Notes |
|---------|--------|-------|
| Google Calendar OAuth | ✅ Working | Full OAuth2 flow in calendarService |
| Create events from meetings | ✅ Working | `createEventFromMeeting()` |
| Create events from action items | ✅ Working | `createEventFromActionItem()` with priority colors |
| Sync action items to calendar | ✅ Working | `syncActionItemsToCalendar()` bulk sync |
| Calendar UI in frontend | ⚠️ Partial | `Calendar.jsx` page exists but not audited — unclear if it wires to calendarService |

### 3.5 Agent System

| Feature | Status | Notes |
|---------|--------|-------|
| `meetingCompleted` trigger | ✅ Working | Evaluates meeting status, transcript, duration |
| `meetingUpcoming` trigger | ✅ Working | Checks intelligence config status, time window |
| Meeting Outcome Processor template | 🔇 Stub | Template defined but `enabled: false`, `dryRunDefault: true` |
| Meeting Insights Agent template | 🔇 Stub | Template defined but `enabled: false`, `dryRunDefault: true` |

### 3.6 Meeting Prep Intelligence

| Feature | Status | Notes |
|---------|--------|-------|
| Upcoming meeting prep | ⚠️ Partial | Queries `start_time` field — meetings table may not have this column populated from recording flow |
| Related action items | ✅ Working | Fetches by meeting_id |
| Sentiment history | ✅ Working | Cross-participant matching from past meetings |
| Deal context from CRM | ✅ Working | Via hub cross_app_events |
| AI talking points | ⚠️ Partial | Requires OpenAI key; falls back to rule-based if unavailable |
| Meeting brief generation | ⚠️ Partial | Same OpenAI dependency |
| Competitor mention extraction | ⚠️ Partial | Simplistic keyword matching — not NER |

---

## 4. Issues Found

### 4.1 🔴 Critical

| # | Issue | Location | Details |
|---|-------|----------|---------|
| C1 | **Dual table architecture** | `meetingService.ts` vs `backend/routes/meetings.js` | TS service uses `entomate_meetings` + `entomate_action_items`. Backend routes use `meetings` + `action_items`. These are **different tables**. Data created by the JSX frontend (via backend API) is invisible to the TSX components, and vice versa. |
| C2 | **Dual component architecture** | `frontend/src/` vs `src/components/` | Two completely independent meeting UIs exist: `Meetings.jsx`/`MeetingDetail.jsx` (JSX, uses backend REST API) and `MeetingsView.tsx` (TSX, uses direct Supabase via meetingService.ts). They share no state, no data, and target different DB tables. |
| C3 | **Two MeetingIntelligencePanel implementations** | `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` + `src/components/intelligence/MeetingIntelligencePanel.tsx` | JSX version inlines the suggestion engine and queries Supabase directly. TSX version imports from dedicated intelligence services. Both are used in different contexts. They can diverge in behavior. |
| C4 | **No auth on meetings routes** | `backend/routes/meetings.js` | `req.user` is checked for `created_by` but routes have no auth middleware. Any unauthenticated request can list, read, delete, or process meetings. The `delete` endpoint is unprotected. |
| C5 | **SQL injection vector in search** | `backend/routes/meetings.js:452` | `query.or(\`title.ilike.%${search}%,summary.ilike.%${search}%\`)` — the `search` param is interpolated directly into the PostgREST filter string. While Supabase's client library provides some protection, this pattern is risky. |

### 4.2 🟡 Medium

| # | Issue | Location | Details |
|---|-------|----------|---------|
| M1 | **`runAIPipeline` + `saveActionItems` + `firePostProcessing` defined but not used in `/process` and `/transcript`** | `backend/routes/meetings.js:723-853` | The refactored helper functions exist at the bottom of the file but the `/process` and `/transcript` routes still inline their own duplicate logic. Only `/reprocess` uses them. |
| M2 | **Hardcoded `gpt-4-turbo-preview` in MeetingPrepService** | `backend/services/intelligence/MeetingPrepService.js:432` | The rest of the app uses the generic `ai` module supporting multiple providers. This service hardcodes OpenAI's model directly. |
| M3 | **MeetingPrepService only initializes OpenAI** | `MeetingPrepService.js:22` | Even when `GEMINI_API_KEY` is set but `OPENAI_API_KEY` is not, the service falls back to rule-based talking points rather than using Gemini. Inconsistent with the rest of the codebase. |
| M4 | **`EntoamteActionItem` typo** | `src/services/meetingService.ts:1` | `EntoamteActionItem` instead of `EntoamateActionItem`. This typo is in the Supabase type definition being imported. |
| M5 | **MeetingRecorder uses old class-based styling** | `MeetingRecorder.jsx:124-165` | Uses `card`, `btn-highlight`, `bg-semantic-error-dim`, `text-semantic-error` — a different design system from the VC design system used by Meetings.jsx and MeetingDetail.jsx. |
| M6 | **Meeting prep queries `start_time` column** | `MeetingPrepService.js:68` | The recording flow doesn't populate `start_time` — it only sets `created_at`. Upcoming meeting prep will return no results for recorded meetings. |
| M7 | **No pagination in meetings list UI** | `Meetings.jsx:33` | Fetches with `limit: 50` but no "load more" or pagination UI. Users with >50 meetings see a truncated list. |
| M8 | **`setTimeout(async () => {}, 0)` for post-processing** | `meetings.js:172,252,388` | Used three times for async fire-and-forget. Errors are logged but unhandled rejections in `setTimeout` callbacks can crash Node.js in some configurations. |
| M9 | **Share modal doesn't use VC design system consistently** | `MeetingDetail.jsx:365` | Uses raw `bg-black bg-opacity-70` overlay instead of a VC modal component. Inline styles mixed with Tailwind. |
| M10 | **`useEffect` with missing dependency** | `MeetingDetail.jsx:28` | `useEffect` depends on `id` but `loadMeeting` is referenced without being in the dependency array. Works because `loadMeeting` closes over `id`, but triggers React warnings. |

### 4.3 🟢 Nice-to-Have

| # | Issue | Location | Details |
|---|-------|----------|---------|
| N1 | **No audio playback in meeting detail** | `MeetingDetail.jsx` | `audio_file_url` is stored and returned but never rendered as an audio player. |
| N2 | **No edit capability for meetings** | `Meetings.jsx` / `MeetingDetail.jsx` | Backend has PUT endpoint but no edit UI exists. Title/summary are read-only in the frontend. |
| N3 | **Agent templates disabled by default** | `meetingOutcomeProcessor.ts`, `meetingInsightsAgent.ts` | Both `enabled: false` and `dryRunDefault: true`. No UI to enable them. |
| N4 | **No real-time recording progress indicator** | `MeetingRecorder.jsx` | No waveform shown in the main list — only visible when recorder panel is expanded. |
| N5 | **No bulk meeting operations** | `Meetings.jsx` | Can only delete one at a time. No multi-select, bulk delete, or export. |
| N6 | **Calendar page not connected to meetings** | `Calendar.jsx` exists | The calendar page and `calendarService.js` exist but it's unclear if the calendar page shows meeting events or if it's standalone. |
| N7 | **No meeting scheduling** | Frontend | No way to create upcoming/scheduled meetings — only post-hoc recording and processing. |
| N8 | **Coaching panel during recording not functional** | `MeetingsView.tsx:647` | `CoachingPanel` rendered during recording but uses `processedMeeting?.id || 'live-recording'` — ID won't be real during recording. |
| N9 | **`getSentimentEmoji` duplicated** | `Meetings.jsx:78` + `MeetingDetail.jsx:138` | Same function copy-pasted in two files. |
| N10 | **No loading state for share modal channel list** | `MeetingDetail.jsx:400-410` | ChatChannelSelector handles its own loading, but no skeleton in the modal body while it loads. |

---

## 5. Dead Code & Unused Patterns

| Item | Location | Status |
|------|----------|--------|
| `runAIPipeline()` function | `meetings.js:723` | Defined but only used by `/reprocess`. `/process` and `/transcript` inline the same logic. |
| `saveActionItems()` function | `meetings.js:742` | Same — only used by `/reprocess`. |
| `firePostProcessing()` function | `meetings.js:778` | Same — only used by `/reprocess`. |
| `MeetingPrepCard.jsx` | `frontend/src/components/intelligence/` | Exists but unclear if wired into any page currently. Not imported in Meetings or MeetingDetail. |
| `MeetingSummaryWidget.jsx` | `frontend/src/components/workflow/` | Used in workflow context but not in main meetings pages. |
| `boardMeeting.ts` profile template | `src/intelligence/templates/` | TypeScript template duplicates what's already seeded in the SQL migration. |
| `meetings-redesign-playground.html` | `output/` | Design artifact — not part of the app. |

---

## 6. Phased Revisal Plan

### Phase 1: Fix Critical / Security Issues

1. **Unify the data model** — Decide: is the canonical table `meetings` or `entomate_meetings`? Migrate to one table. Update `meetingService.ts` OR `backend/routes/meetings.js` to point to the same table.
2. **Add auth middleware** to all meeting routes (`/api/meetings/*`, `/api/meeting-summary/*`). Filter queries by `created_by = req.user.id`.
3. **Fix the search filter** — Use parameterized filters instead of string interpolation for the `search` query in the list endpoint.
4. **Consolidate MeetingIntelligencePanel** — Pick JSX or TSX version as canonical. Remove the other. The JSX version is simpler and self-contained; the TSX version is more modular. Choose based on which frontend architecture is primary.

### Phase 2: Wire Up Partial / Stub Functionality

5. **Refactor `/process` and `/transcript`** to use `runAIPipeline()`, `saveActionItems()`, and `firePostProcessing()` — eliminate 200+ lines of duplicate code.
6. **Unify MeetingPrepService AI provider** — Replace hardcoded OpenAI with the generic `ai` module so it works with Gemini too.
7. **Populate `start_time`** for recorded meetings (set to recording start time) so MeetingPrepService queries return results.
8. **Add audio playback** to MeetingDetail — render `<audio>` element when `audio_file_url` exists.
9. **Add pagination** to meetings list (infinite scroll or "Load More" button).
10. **Fix `useEffect` dependency** in MeetingDetail.jsx.

### Phase 3: Refactor & Architecture Cleanup

11. **Decide on one frontend stack** — JSX (frontend/src/) vs TSX (src/components/). If JSX is primary, remove or mark TSX as deprecated. If TSX is primary, migrate routes to serve it.
12. **Extract `getSentimentEmoji`** and `getSentimentBadgeColor` to a shared utility.
13. **Standardize MeetingRecorder styling** to match VC design system.
14. **Convert share modal** to use a proper VC modal component.
15. **Replace `setTimeout(async …, 0)`** with proper job queue or at minimum `process.nextTick()` with error boundaries.

### Phase 4: New Features & Polish

16. **Meeting scheduling** — Create upcoming meetings, link to Google Calendar, trigger pre-meeting intelligence.
17. **Enable agent templates** — UI to toggle Meeting Outcome Processor and Meeting Insights Agent. Wire to agent execution engine.
18. **Meeting edit UI** — Allow editing title, summary, key points from the detail page.
19. **Bulk operations** — Multi-select delete, export meetings as PDF/markdown.
20. **Connect Calendar page** to meetings — show meeting events on the calendar view.

---

## 7. Claude Agent Prompt for Revisal

```
You are implementing the Meetings section revisal for the Entomate project at f:\entomate.

## Current State
The Meetings section has a dual-architecture problem:
- **JSX frontend** at `frontend/src/pages/Meetings.jsx` and `MeetingDetail.jsx` uses a backend REST API (`backend/routes/meetings.js`) that operates on `meetings` + `action_items` tables.
- **TSX frontend** at `src/components/MeetingsView.tsx` uses direct Supabase calls via `src/services/meetingService.ts` that operates on `entomate_meetings` + `entomate_action_items` tables.
- There are two independent MeetingIntelligencePanel implementations (JSX and TSX).

The backend REST API has no auth middleware. The search endpoint uses string interpolation.

## Files to Modify

### Phase 1 — Critical Fixes
1. `backend/routes/meetings.js` — Add auth middleware to all routes. Fix search query to use Supabase's built-in filtering safely. Refactor `/process` and `/transcript` to use the existing `runAIPipeline()`, `saveActionItems()`, and `firePostProcessing()` helpers (lines 723-853) instead of inline duplicate code.

2. `backend/routes/meetingSummary.js` — Add auth middleware.

3. `src/services/meetingService.ts` — Change table references from `entomate_meetings` → `meetings` and `entomate_action_items` → `action_items` (or vice versa, based on which schema is canonical). The migration at `supabase/migrations/20260328_001_meeting_intelligence_profiles.sql` references `entomate_meetings` in comments but the config table just says `meeting_id UUID NOT NULL`.

4. Decide which MeetingIntelligencePanel to keep:
   - `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` (self-contained, queries Supabase directly)
   - `src/components/intelligence/MeetingIntelligencePanel.tsx` (modular, uses dedicated services)
   Remove the other. Update imports in consuming pages.

### Phase 2 — Wire Up
5. `backend/services/intelligence/MeetingPrepService.js` — Replace direct OpenAI usage with the `ai` module from `backend/config/ai.js`.

6. `frontend/src/pages/MeetingDetail.jsx` — Add `<audio>` element for `meeting.audio_file_url`. Add pagination to Meetings.jsx. Fix useEffect dependency.

### Phase 3 — Cleanup
7. Extract `getSentimentEmoji()` to a shared utility imported by both Meetings.jsx and MeetingDetail.jsx.
8. Restyle `MeetingRecorder.jsx` to use VC design system (var(--text-primary), var(--bg-surface), etc.) instead of old class-based styles.

## Key Constraints
- The VC design system uses CSS custom properties: var(--text-primary), var(--bg-surface), var(--accent-primary), etc.
- VCButton, VCBadge, VCTimeline are the component library from `frontend/src/components/vc/`.
- Backend uses Express.js + multer + Supabase client + generic AI module supporting Gemini and OpenAI.
- Auth: use `req.user.id` from JWT middleware. The middleware likely exists elsewhere in the backend.
- Tables: `meetings`, `action_items`, `intelligence_profiles`, `meeting_intelligence_config`, `intelligence_context_cache`.
- The ecosystem bridge syncs to Pulse and Logos Vision CRM.
```

---

## Summary

The Meetings section is **feature-rich and functional** — recording, AI processing, CRM sync, ecosystem bridge, intelligence profiles, and agent triggers are all present. However, the biggest risk is the **dual-architecture split**: JSX frontend + Express backend operating on different tables than the TSX frontend + direct Supabase. This means data created through one path is invisible to the other.

**Priority 1:** Unify the data model and add auth.
**Priority 2:** De-duplicate the backend pipeline code and standardize the AI provider.
**Priority 3:** Pick one frontend architecture and consolidate.
