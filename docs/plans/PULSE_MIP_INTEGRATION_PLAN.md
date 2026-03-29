# Pulse × Meeting Intelligence Profiles — Integration Plan

## Overview

With MIP live in Entomate, Pulse needs to become a **first-class intelligence provider and consumer** in the ecosystem. Right now Pulse receives meeting summaries and action items from Entomate via bot messages — that's the "dumb pipe" version. The MIP integration makes Pulse a *thinking participant*: it feeds conversation context into MIP's pre-meeting briefings, surfaces intelligence-enriched meeting outputs in smarter ways, and lets users interact with MIP profiles directly from Pulse.

## What Exists Today

### Pulse → Entomate (already works)
- Entomate's `contextAssembler.ts` queries Pulse's `chat_messages` table via REST for conversation history related to meeting participants
- Uses `pulseFetcher.ts` (direct Supabase REST calls)
- Returns `ConversationContext[]` for the assembled context

### Entomate → Pulse (already works)
- `ecosystem-inbound` Edge Function in Pulse handles:
  - `meeting.processed` → Creates meeting recap bot message
  - `meeting.action_items_extracted` → Creates task assignment messages
  - `task.created/updated/completed` → Status updates
  - `agent.action_completed` → Agent notifications
  - `automation.triggered` → Automation alerts
- Bot messages go into dedicated channels (entomate-meetings, entomate-tasks, etc.)

### What's Missing
- Pulse doesn't know about intelligence profiles
- Meeting recaps are generic (no profile-shaped output)
- No way to view/configure MIP from Pulse
- Conversation Intelligence service exists but doesn't feed into MIP
- No pre-meeting briefing surfaces in Pulse
- No feedback loop from Pulse back to Entomate's analytics

---

## Integration Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    PULSE × MIP INTEGRATION                       │
│                                                                  │
│  ┌─── PULSE PROVIDES ────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  1. Conversation Context API (new endpoint)                │  │
│  │     - Topic summaries per participant                      │  │
│  │     - Sentiment trends from recent conversations           │  │
│  │     - Key discussion threads relevant to meeting           │  │
│  │     - Response via ecosystem bridge                        │  │
│  │                                                            │  │
│  │  2. Pre-Meeting Briefing Cards (new UI)                    │  │
│  │     - Shows assembled context in Pulse channels            │  │
│  │     - "Upcoming meeting with Ford Foundation in 30 min"    │  │
│  │     - Participant context, open items, profile info        │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌─── PULSE CONSUMES ────────────────────────────────────────┐  │
│  │                                                            │  │
│  │  3. Intelligence-Enriched Meeting Recaps (enhanced)        │  │
│  │     - Profile-shaped summaries (not generic)               │  │
│  │     - Custom sections from profile output format           │  │
│  │     - Profile badge + effectiveness in recap card          │  │
│  │                                                            │  │
│  │  4. MIP Quick Actions (new UI)                             │  │
│  │     - View/assign profiles from Pulse meeting channels     │  │
│  │     - Rate meeting output (feeds analytics)                │  │
│  │     - "Prepare for meeting" button → triggers context      │  │
│  │                                                            │  │
│  └────────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Structured Context API

**Goal:** Replace Entomate's raw `chat_messages` query with a proper context endpoint that returns pre-processed, summarized conversation intelligence.

### 1a. New Ecosystem Event: `context.request` / `context.response`

**Entomate sends** `context.request`:
```json
{
  "eventType": "context.request",
  "data": {
    "requestId": "uuid",
    "meetingId": "uuid",
    "profileSlug": "grant-specialist",
    "participants": ["Sarah Chen", "James Ford"],
    "participantEmails": ["sarah@ford.org"],
    "contextDepth": "standard",
    "lookbackDays": 30,
    "topics": ["grant", "Q3 deliverables"]
  }
}
```

**Pulse responds** via `context.response` (callback to Entomate's inbound):
```json
{
  "eventType": "context.response",
  "data": {
    "requestId": "uuid",
    "conversations": [
      {
        "channelId": "uuid",
        "channelName": "ford-foundation",
        "participants": ["Sarah Chen"],
        "messageCount": 23,
        "lastActivity": "2026-03-27T14:30:00Z",
        "topicSummary": "Discussion about Q3 deliverable timeline, budget reallocation for Phase 2",
        "sentiment": "neutral",
        "keyMessages": [
          { "content": "Sarah mentioned the deadline moved to June 30", "date": "2026-03-25", "sender": "Sarah Chen" },
          { "content": "Budget concern flagged for Phase 2 equipment", "date": "2026-03-26", "sender": "James Ford" }
        ],
        "openThreads": 2
      }
    ],
    "participantActivity": [
      {
        "name": "Sarah Chen",
        "totalMessages": 45,
        "lastActive": "2026-03-27T16:00:00Z",
        "engagementScore": 78,
        "recentTopics": ["grant deliverables", "budget", "timeline"]
      }
    ]
  }
}
```

### 1b. Pulse-Side Implementation

**New handler in `ecosystem-inbound/index.ts`:**

Add `case 'context.request':` to the event router.

**Handler: `handleContextRequest()`**
1. Extract participant names/emails and lookback window from event data
2. Query `chat_messages` for messages mentioning participants or in channels they're active in
3. Use `conversationIntelligenceService.ts` (already exists!) to get:
   - Topic detection per channel
   - Sentiment analysis
   - Engagement metrics per participant
4. Summarize key messages using Gemini (via existing `geminiService.ts`) — short summaries, not raw messages
5. Package into the `context.response` format
6. POST back to Entomate's ecosystem-inbound endpoint

**New file: `supabase/functions/ecosystem-inbound/contextHandler.ts`**
```typescript
export async function handleContextRequest(
  supabase: any,
  event: EcosystemEvent
): Promise<void>
```

### 1c. Entomate-Side Changes

**Modify `src/intelligence/contextAssembler.ts`:**

Replace the raw `gatherPulseHistory()` function (which does a basic `chat_messages` query) with an ecosystem bridge call:

1. Instead of querying Pulse's DB directly, send a `context.request` event via the ecosystem bridge
2. Wait for the `context.response` (or fall back to direct query if bridge isn't configured)
3. Map the structured response to `ConversationContext[]`

This is a **non-breaking change** — the fallback keeps the direct query working for setups where the bridge isn't configured yet.

---

## Phase 2: Intelligence-Enriched Meeting Recaps

**Goal:** When Entomate sends meeting results to Pulse, include the intelligence profile metadata so Pulse can render richer, profile-shaped recap cards.

### 2a. Enhanced `meeting.processed` Event

**Add to event data:**
```json
{
  "eventType": "meeting.processed",
  "data": {
    // ... existing fields ...
    "intelligenceProfile": {
      "name": "Grant Specialist",
      "icon": "📋",
      "slug": "grant-specialist",
      "tone": "formal"
    },
    "profileSections": [
      { "title": "Grant Status Update", "content": "The Ford Foundation Q3 grant is on track..." },
      { "title": "Compliance Items", "content": "Annual reporting due by June 30..." },
      { "title": "Budget Impact", "content": "Phase 2 equipment costs may exceed allocation..." }
    ],
    "contextUsed": {
      "participantCount": 3,
      "pastMeetingsReferenced": 2,
      "conversationThreadsUsed": 1,
      "tokensBudget": 1200
    },
    "outputQualityScore": 0.82
  }
}
```

### 2b. Pulse-Side: Enhanced Recap Rendering

**Modify `handleMeetingProcessed()` in `ecosystem-inbound/index.ts`:**

When `intelligenceProfile` is present in the event data, render a richer bot message:

```markdown
## 📋 Grant Specialist — Meeting Summary: Q3 Grant Review

**Profile:** 📋 Grant Specialist | **Quality:** ★★★★☆

### Grant Status Update
The Ford Foundation Q3 grant is on track...

### Compliance Items
Annual reporting due by June 30...

### Budget Impact
Phase 2 equipment costs may exceed allocation...

### Action Items (4)
• Submit Phase 2 budget revision → Sarah Chen (due Apr 5)
• Schedule compliance review → James Ford (due Apr 10)
• ...

---
*Processed by Entomate with Grant Specialist intelligence profile*
*Context: 3 contacts, 2 past meetings, 1 Pulse thread referenced*
```

When no profile is present, fall back to the existing generic format (backward compatible).

### 2c. Bot Message Actions for MIP

Add interactive actions to the recap bot message:

```typescript
actions: [
  { label: 'View Full Meeting', action: 'open_meeting', url: entomate_url },
  { label: 'Rate This Summary', action: 'rate_meeting', meetingId: event.entityId },
  { label: 'View Profile', action: 'view_profile', profileSlug: profile.slug },
]
```

The `rate_meeting` action would send a `meeting.feedback` event back to Entomate when clicked — feeding the analytics loop.

---

## Phase 3: Pre-Meeting Briefing Cards

**Goal:** Surface pre-meeting context in Pulse channels so team members see intelligence briefings where they already communicate.

### 3a. New Event: `meeting.briefing`

When Entomate's `meeting.upcoming` trigger fires and context is assembled, send a briefing event to Pulse:

```json
{
  "eventType": "meeting.briefing",
  "data": {
    "workspaceId": "uuid",
    "meetingId": "uuid",
    "meetingTitle": "Q3 Grant Review — Ford Foundation",
    "scheduledAt": "2026-03-28T15:00:00Z",
    "profileName": "Grant Specialist",
    "profileIcon": "📋",
    "participants": [
      { "name": "Sarah Chen", "role": "Grant Manager", "meetingCount": 5 }
    ],
    "contextHighlights": [
      "2 open action items from last meeting (Mar 15)",
      "Budget concern flagged in Pulse thread 3 days ago",
      "Ford Foundation contact updated email last week"
    ],
    "openActionItems": [
      { "description": "Submit Phase 1 final report", "assignee": "Sarah Chen", "dueDate": "2026-03-30" }
    ]
  }
}
```

### 3b. Pulse-Side: Briefing Card Handler

**New handler: `handleMeetingBriefing()`**

Posts a briefing card to the meetings bot channel:

```markdown
## 🔮 Meeting Briefing: Q3 Grant Review — Ford Foundation
**Starting in 28 minutes** | 📋 Grant Specialist profile active

### Participants
• Sarah Chen — Grant Manager (5 previous meetings)

### Context Highlights
• 2 open action items from last meeting (Mar 15)
• Budget concern flagged in Pulse thread 3 days ago
• Ford Foundation contact updated email last week

### Open Items Going In
• Submit Phase 1 final report → Sarah Chen (due Mar 30) ⚠️

---
*Intelligence assembled by Entomate • [Open in Entomate](url)*
```

### 3c. Pulse UI: Briefing Widget (Optional Enhancement)

A small widget in Pulse's sidebar or channel header that shows upcoming meetings with briefings. This is a frontend component, not just a bot message.

**Component: `MeetingBriefingWidget.tsx`**
- Shows next 1-2 upcoming meetings with intelligence profiles
- Compact card format
- Click to expand full briefing
- "Prepare Context" button to manually trigger context assembly

---

## Phase 4: Feedback Loop & Cross-App Analytics

**Goal:** Close the loop — let Pulse users rate meeting outputs and surface intelligence effectiveness.

### 4a. New Event: `meeting.feedback`

**Pulse sends to Entomate:**
```json
{
  "eventType": "meeting.feedback",
  "data": {
    "meetingId": "uuid",
    "userId": "uuid",
    "rating": 4,
    "feedback": "Great compliance tracking, missed some budget details"
  }
}
```

**Entomate handler:** Routes to `trackFeedback()` in `analyticsService.ts`.

### 4b. Rate Meeting Action in Pulse

When a user clicks "Rate This Summary" on a recap bot message:
1. Show a simple star rating UI (inline in chat or modal)
2. Optional text feedback
3. Send `meeting.feedback` event to Entomate

**Implementation:** Add a message action handler in Pulse's message component that recognizes the `rate_meeting` action type and renders the rating UI inline.

### 4c. Ecosystem Intelligence Dashboard Widget

A widget for Pulse's dashboard showing cross-app intelligence stats:
- "X meetings processed with intelligence profiles this week"
- "Most used profile: Grant Specialist (12 meetings)"
- "Average meeting quality score: 4.2/5"

Data source: Query Entomate's `intelligence_profile_effectiveness` table via ecosystem bridge, or cache stats locally from events.

---

## Implementation Order

| Phase | Priority | Effort | Description |
|-------|----------|--------|-------------|
| **2** | 🔴 High | Small | Enhanced meeting recaps with profile data — highest ROI, mostly event payload changes |
| **1** | 🟡 Medium | Medium | Structured context API — improves context quality but existing direct queries work |
| **3** | 🟡 Medium | Medium | Pre-meeting briefings in Pulse — very cool, depends on meeting.upcoming trigger timing |
| **4** | 🟢 Low | Small | Feedback loop — nice to have, builds on Phase 2 actions |

**Recommended start: Phase 2** — it's the smallest change with the biggest visible impact. The meeting recaps are already flowing; making them profile-aware is mostly a payload enhancement on both sides.

---

## Files Reference

### Pulse-Side (modify/create)

| File | Action |
|------|--------|
| `supabase/functions/ecosystem-inbound/index.ts` | MODIFY — add `context.request`, `meeting.briefing` handlers, enhance `meeting.processed` handler |
| `supabase/functions/ecosystem-inbound/contextHandler.ts` | CREATE — structured context assembly using conversationIntelligenceService |
| `src/services/entomateService.ts` | MODIFY — add types for MIP events |
| `src/services/conversationIntelligenceService.ts` | READ — existing service, used by contextHandler |
| `src/services/geminiService.ts` | READ — used for summarizing conversation context |
| `src/components/MeetingBriefingWidget.tsx` | CREATE (Phase 3) — sidebar/channel briefing widget |

### Entomate-Side (modify)

| File | Action |
|------|--------|
| `src/intelligence/contextAssembler.ts` | MODIFY — use structured context API (with fallback) |
| `src/intelligence/pulseFetcher.ts` | MODIFY — add bridge-based context request |
| `backend/services/ecosystemBridge.js` | MODIFY — add `meeting.briefing` event emission |
| `src/agents/agentTriggerService.ts` | MODIFY — send briefing event after context assembly |

### Shared Event Types (both apps)

New event types to register:
- `context.request` — Entomate → Pulse
- `context.response` — Pulse → Entomate
- `meeting.briefing` — Entomate → Pulse
- `meeting.feedback` — Pulse → Entomate

---

## Key Principles

1. **Non-breaking** — Every change falls back gracefully. If Pulse isn't configured, Entomate works fine. If Entomate sends an old-format event, Pulse handles it.
2. **No tight coupling** — Apps communicate via events, not shared code. Each side owns its own rendering/processing.
3. **Conversation Intelligence is the multiplier** — Pulse's existing `conversationIntelligenceService.ts` (sentiment, topics, engagement) is the gold mine. Exposing it to MIP via the context API is where the real value is.
4. **Bot channels are the UI surface** — Pulse users live in channels. Meeting briefings and enriched recaps should show up where people already are, not buried in a settings page.
