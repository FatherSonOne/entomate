# Entomate — Logos Vision Context API Migration

## Overview

Logos Vision now exposes a **Structured Contact Context API** via its `ecosystem-inbound` edge function (`context.request` event). This replaces the current pattern where Entomate's `contextAssembler.ts` makes 5+ separate Supabase queries directly against LV's tables.

This document is the implementation prompt for the Entomate side of the integration.

## What Changed in Logos Vision

### New Event: `context.request` / `context.response`

LV's `ecosystem-inbound/index.ts` now handles `context.request` events. Send participant data, get back enriched context:

**Request payload:**
```typescript
{
  eventType: 'context.request',
  data: {
    participants: [{ name: string, email: string }],
    contextDepth: 'minimal' | 'standard' | 'deep',  // controls activity limit
    meetingTitle?: string,
  }
}
```

**Response payload:**
```typescript
{
  success: true,
  participants: [{
    name: string,
    email: string | null,
    role: string | null,
    organization: string | null,
    orgType: string | null,                    // NEW: org classification
    relationship: string,                       // NEW: donor, client, team member, etc.
    engagement: {
      totalActivities: number,                  // NEW: engagement scoring
      lastInteraction: string | null,
      meetingCount: number,
    },
    recentActivities: [{
      type: string,
      title: string,
      date: string,
      notes: string | null,                     // truncated to 200 chars
    }],
    openTasks: [{
      description: string,
      status: string,
      dueDate: string | null,
      priority: string,
    }],
    activeProjects: [{                          // NEW: active projects for contact
      name: string,
      status: string,
      description: string | null,
    }],
    donationContext?: {                          // NEW: nonprofit donation history
      totalDonated: number,
      lastDonation: string | null,
      donationCount: number,
      averageDonation: number,
    },
  }],
  organization: {
    organizations: string[],
    participantCount: number,
    hasNonprofitContext: boolean,                // NEW: flags nonprofit data availability
    aggregateDonations?: number,
  },
  meetingTitle: string | null,
  responseType: 'context.response',
}
```

### Enhanced `meeting.processed` Event

LV now expects an optional `intelligenceProfile` field in `meeting.processed` events:

```typescript
{
  eventType: 'meeting.processed',
  data: {
    meeting: { id, title, summary, meeting_date, key_points, decisions, attendees },
    actionItems: [...],
    teamMemberId?: string,
    intelligenceProfile?: {                     // NEW: MIP profile metadata
      name: string,                             // e.g., "Grant Specialist"
      icon?: string,                            // e.g., "📋"
      slug?: string,                            // e.g., "grant-specialist"
      category?: string,                        // e.g., "nonprofit"
      sections?: [{ heading: string, content: string }],
      outputQualityScore?: number,              // 0-100
      contextSources?: [{ type: string, count: number }],
    },
  }
}
```

When `intelligenceProfile` is present, LV creates activities with:
- Profile-enhanced titles: "📋 Grant Specialist — Q3 Grant Review"
- Structured notes with profile sections, quality score, context sources
- Tasks tagged with profile name and category

### New Event: `meeting.briefing`

LV now handles `meeting.briefing` events (from MIP Phase 3 pre-meeting briefings):

```typescript
{
  eventType: 'meeting.briefing',
  data: {
    meetingId: string,
    meetingTitle?: string,
    participants?: [{ name, email }],
    briefingData?: {
      suggestedProfile?: string,
      contextSummary?: string,
    },
    scheduledTime?: string,
  }
}
```

LV creates a scheduled Activity and sends notifications to matched team members.

---

## Implementation Tasks

### Task 1: Update contextAssembler.ts — Use Bridge API

**File:** `src/services/contextAssembler.ts`

**Current flow:**
```
gatherContacts() → 5+ direct Supabase queries to LV tables
gatherOrgInfo() → more direct queries
gatherDeals() → more direct queries
enrichParticipantsWithNotes() → more direct queries
```

**New flow:**
```
1. Check if LV bridge is configured (ecosystem_config for logos_vision)
2. If yes: Send context.request via ecosystem bridge → parse context.response
3. Map response to ParticipantContext[] and OrgContext
4. Fall back to direct Supabase queries if bridge unavailable
```

**Changes:**

```typescript
// New function in contextAssembler.ts
async function gatherContextViaBridge(
  participants: { name: string; email: string }[],
  meetingTitle: string,
  contextDepth: 'minimal' | 'standard' | 'deep' = 'standard'
): Promise<{ participants: ParticipantContext[]; orgContext: OrgContext } | null> {
  try {
    // Use ecosystemBridge to send context.request to logos_vision
    const response = await ecosystemBridge.sendEvent('logos_vision', {
      eventType: 'context.request',
      payload: { participants, contextDepth, meetingTitle },
    });

    if (!response?.success) return null;

    // Map LV response → Entomate's ParticipantContext format
    const mappedParticipants = response.participants.map(mapLvParticipant);
    const orgContext = mapLvOrgContext(response.organization);

    return { participants: mappedParticipants, orgContext };
  } catch (err) {
    console.warn('[contextAssembler] Bridge context request failed, falling back:', err);
    return null;
  }
}
```

**In the main `assembleContext()` function:**
```typescript
// Try bridge first
const bridgeContext = await gatherContextViaBridge(participants, meetingTitle);
if (bridgeContext) {
  return bridgeContext;
}

// Fallback: existing direct queries
const contacts = await gatherContacts(participants);
// ... existing flow
```

**Key enrichments to map from LV response:**
- `donationContext` → map to a new section in `ParticipantContext` (or a new field)
- `relationship` → map to participant relationship type
- `engagement.meetingCount` → useful for "meeting frequency" context
- `activeProjects` → map to deals/projects context
- `organization.hasNonprofitContext` → influences org_type in MIP profile suggestion rules

### Task 2: Include intelligenceProfile in meeting.processed Events

**File:** `src/services/meetingProcessingService.ts` (or wherever meeting.processed events are dispatched)

After MIP generates a profiled meeting output, include the profile metadata in the ecosystem event:

```typescript
// When sending meeting.processed to LV via ecosystem bridge
await ecosystemBridge.sendEvent('logos_vision', {
  eventType: 'meeting.processed',
  payload: {
    meeting: { id, title, summary, meeting_date, key_points, decisions, attendees },
    actionItems: processedActionItems,
    teamMemberId: resolvedTeamMemberId,
    // NEW: Include intelligence profile if one was used
    intelligenceProfile: profileUsed ? {
      name: profileUsed.name,
      icon: profileUsed.icon,
      slug: profileUsed.slug,
      category: profileUsed.category,
      sections: generatedSections,  // The custom sections MIP generated
      outputQualityScore: qualityScore,
      contextSources: contextSourceSummary,
    } : undefined,
  },
});
```

### Task 3: Send meeting.briefing Events (MIP Phase 3)

When MIP generates a pre-meeting briefing, also send it to LV:

```typescript
// After generating briefing in MIP Phase 3
await ecosystemBridge.sendEvent('logos_vision', {
  eventType: 'meeting.briefing',
  payload: {
    meetingId: meeting.id,
    meetingTitle: meeting.title,
    participants: meeting.participants.map(p => ({ name: p.name, email: p.email })),
    briefingData: {
      suggestedProfile: suggestedProfile?.name,
      contextSummary: briefingSummary,
    },
    scheduledTime: meeting.scheduledTime,
  },
});
```

### Task 4: Handle meeting.feedback Events from LV

LV now sends `meeting.feedback` events when users rate meeting summaries:

```typescript
{
  eventType: 'meeting.feedback',
  data: {
    meetingId: string,
    rating: number,       // 1-5
    feedback?: string,
    source: 'logos_vision',
  }
}
```

Add handler in Entomate's ecosystem-inbound:

```typescript
case 'meeting.feedback':
  // Store feedback for MIP analytics
  // Update meeting_intelligence_config quality tracking
  result = await handleMeetingFeedback(supabase, data);
  break;
```

---

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/contextAssembler.ts` | Add `gatherContextViaBridge()`, integrate as primary path with fallback |
| `src/services/meetingProcessingService.ts` | Include `intelligenceProfile` in `meeting.processed` events |
| `src/services/ecosystemBridge.ts` | Ensure `sendEvent('logos_vision', ...)` is supported |
| `supabase/functions/ecosystem-inbound/index.ts` | Add `meeting.feedback` handler |
| MIP briefing service (Phase 3) | Send `meeting.briefing` events to LV |

## Testing Strategy

1. **Context API**: Mock a `context.request` call with sample participants → verify enriched response maps correctly to `ParticipantContext[]`
2. **Profiled meeting.processed**: Send a meeting with `intelligenceProfile` → verify LV creates activity with profile-enhanced title and notes
3. **Fallback**: Disable LV bridge → verify contextAssembler falls back to direct Supabase queries
4. **Feedback loop**: Rate a meeting in LV → verify Entomate receives and stores the feedback

## Dependency

This plan depends on the LV-side changes being deployed first. The LV changes are in:
- `supabase/functions/ecosystem-inbound/index.ts` — new handlers
- `src/services/ecosystemBridge.ts` — new convenience methods
- `src/config/ecosystem.ts` — canonical app registry

All LV changes are non-breaking and additive. Existing sync continues working unchanged.
