# Entomate Integration Plan — Ecosystem Bridge + Hero Workflow
*Standalone plan for Entomate changes — can be worked on in parallel with Pulse*
*Created 2026-03-26 by Rune*

---

## 1. Current State Summary

Entomate has strong integration scaffolding that needs updating:

| Component | Status | Action Needed |
|---|---|---|
| `pulseChatService.ts` | ❌ Broken (targets old Pulse schema) | Rewrite to use Ecosystem Bridge |
| `crmSyncService.ts` | ✅ Functional | Update to use bridge events instead of direct Supabase calls |
| `logosVisionClient.ts` | ✅ Functional | Keep, add bridge fallback |
| Agent actions (5) | ✅ Functional | Update `post_to_pulse` action |
| Cross-app search | ✅ Partially working | Expand to include Pulse messages |
| Knowledge graph | ✅ Working | Add cross-app entity linking |
| Intelligence dashboard | ✅ Working | Add cross-app data sources |

---

## 2. The Hero Workflow: "Meeting to Action"

### Why This Workflow?

This is Entomate's **killer demo**. It shows the complete value chain in one flow:

```
MEETING OCCURS
     │
     ▼
ENTOMATE RECORDS & TRANSCRIBES
     │
     ▼
AI EXTRACTS: Summary, Key Points, Decisions, Action Items, Sentiment
     │
     ├──▶ ACTION ITEMS created in Entomate
     │         │
     │         ├──▶ AUTO-SYNCED to Logos Vision as CRM Tasks
     │         │         (linked to contacts, projects, organizations)
     │         │
     │         └──▶ ASSIGNEES NOTIFIED in Pulse
     │                   (bot message in #entomate-tasks channel)
     │
     ├──▶ MEETING RECAP posted to Pulse
     │         (#entomate-meetings channel, rich card format)
     │
     ├──▶ ACTIVITY CREATED in Logos Vision
     │         (meeting record linked to attendee contacts)
     │
     ├──▶ CROSS-APP SEARCH indexed
     │         (meeting searchable from any app)
     │
     └──▶ INTELLIGENCE UPDATED
              (deal risk recalculated, relationship scores updated)
```

### What Users See

**In Entomate (the recorder):**
1. Click "New Meeting" → record/upload audio
2. AI processes in ~30 seconds
3. See summary, action items, sentiment
4. Green checkmarks appear: "✅ Synced to CRM" "✅ Posted to Pulse" "✅ Team notified"

**In Pulse (the communicator):**
1. `#entomate-meetings` channel shows a rich meeting recap card
2. `#entomate-tasks` channel shows individual task assignments
3. Assigned users get notifications: "You have 2 new tasks from 'Q1 Board Meeting'"
4. Click "View in Entomate" to see full meeting detail

**In Logos Vision (the CRM):**
1. New Activity appears: "Meeting: Q1 Board Meeting" linked to attendee contacts
2. New Tasks appear: assigned to team members, linked to projects
3. Contact timelines update: "Had meeting on 3/25, sentiment: Positive"
4. Dashboard widgets reflect new data

### What Makes This Powerful for Nonprofits

- **Board meetings:** Record the meeting → every commitment, follow-up, and decision is captured and tracked
- **Donor meetings:** Meeting notes auto-link to donor profiles → fundraising team sees full context
- **Client intake:** New client meeting → auto-create project in CRM, assign onboarding tasks, notify team
- **Grant reviews:** Meeting with grant officer → action items become grant milestones

---

## 3. Implementation: Rewrite pulseChatService.ts

Replace the current direct-insert approach with the Ecosystem Bridge pattern:

### New File: `src/services/ecosystemBridge.ts`

```typescript
/**
 * Ecosystem Bridge Service
 * Handles all cross-app communication via the bridge pattern.
 * Replaces direct Supabase calls to other apps.
 */

import { supabase } from '../lib/supabase';

interface EcosystemConfig {
  appName: string;
  apiUrl: string;
  serviceToken: string;
  enabled: boolean;
  features: Record<string, boolean>;
}

interface EcosystemEvent {
  id: string;
  source: 'entomate';
  timestamp: string;
  eventType: string;
  entityType: string;
  entityId: string;
  data: Record<string, any>;
  targetApp?: string;
}

export class EcosystemBridge {
  private configs: Map<string, EcosystemConfig> = new Map();
  private initialized = false;

  /**
   * Load ecosystem configuration from database
   */
  async initialize(): Promise<void> {
    const { data, error } = await supabase
      .from('ecosystem_config')
      .select('*')
      .eq('enabled', true);

    if (error) {
      console.error('[EcosystemBridge] Failed to load config:', error);
      return;
    }

    (data || []).forEach(config => {
      this.configs.set(config.app_name, config);
    });

    this.initialized = true;
    console.log(`[EcosystemBridge] Initialized with ${this.configs.size} connected apps`);
  }

  /**
   * Check if an app is connected
   */
  isConnected(appName: string): boolean {
    return this.configs.has(appName);
  }

  /**
   * Get connected app status
   */
  getStatus(): { pulse: boolean; logosVision: boolean; isBundle: boolean } {
    return {
      pulse: this.configs.has('pulse'),
      logosVision: this.configs.has('logos_vision'),
      isBundle: this.configs.size === 2,
    };
  }

  /**
   * Check if a specific feature is enabled for an app
   */
  hasFeature(appName: string, feature: string): boolean {
    const config = this.configs.get(appName);
    return config?.features?.[feature] === true;
  }

  /**
   * Send event to a specific app
   */
  async sendEvent(targetApp: string, event: Omit<EcosystemEvent, 'id' | 'source' | 'timestamp'>): Promise<boolean> {
    const config = this.configs.get(targetApp);
    if (!config) {
      console.warn(`[EcosystemBridge] ${targetApp} not connected, skipping event`);
      return false;
    }

    const fullEvent: EcosystemEvent = {
      ...event,
      id: crypto.randomUUID(),
      source: 'entomate',
      timestamp: new Date().toISOString(),
      targetApp,
    };

    // Log outbound event
    await supabase.from('ecosystem_events').insert({
      event_id: fullEvent.id,
      source: 'entomate',
      event_type: event.eventType,
      entity_type: event.entityType,
      entity_id: event.entityId,
      direction: 'outbound',
      payload: event.data,
    });

    try {
      const response = await fetch(`${config.apiUrl}/api/ecosystem/inbound`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Ecosystem-Token': config.serviceToken,
        },
        body: JSON.stringify(fullEvent),
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.text()}`);
      }

      // Update event status
      await supabase.from('ecosystem_events')
        .update({ status: 'processed' })
        .eq('event_id', fullEvent.id);

      return true;
    } catch (error) {
      console.error(`[EcosystemBridge] Failed to send to ${targetApp}:`, error);

      await supabase.from('ecosystem_events')
        .update({ status: 'failed', error_message: error.message })
        .eq('event_id', fullEvent.id);

      return false;
    }
  }

  /**
   * Broadcast event to all connected apps
   */
  async broadcast(event: Omit<EcosystemEvent, 'id' | 'source' | 'timestamp'>): Promise<Record<string, boolean>> {
    const results: Record<string, boolean> = {};

    for (const [appName] of this.configs) {
      results[appName] = await this.sendEvent(appName, event);
    }

    return results;
  }

  // ==================== CONVENIENCE METHODS ====================

  /**
   * Post a bot message to Pulse
   */
  async postToPulse(params: {
    workspaceId: string;
    channelPurpose?: string;
    content: string;
    messageType: string;
    metadata?: Record<string, any>;
    actions?: Array<{ label: string; action: string; url?: string }>;
    notifyUsers?: string[];
  }): Promise<boolean> {
    return this.sendEvent('pulse', {
      eventType: 'message.bot_post',
      entityType: 'bot_message',
      entityId: crypto.randomUUID(),
      data: params,
    });
  }

  /**
   * Sync a meeting to Logos Vision
   */
  async syncMeetingToLogosVision(params: {
    meetingId: string;
    title: string;
    summary: string;
    keyPoints: string[];
    decisions: string[];
    sentiment: string;
    attendees: Array<{ name: string; email?: string }>;
    actionItems: Array<{
      description: string;
      assigneeName?: string;
      priority: string;
      dueDate?: string;
    }>;
  }): Promise<boolean> {
    return this.sendEvent('logos_vision', {
      eventType: 'meeting.processed',
      entityType: 'meeting',
      entityId: params.meetingId,
      data: params,
    });
  }

  /**
   * Sync task completion
   */
  async syncTaskCompleted(taskId: string, crmTaskId?: string): Promise<boolean> {
    return this.sendEvent('logos_vision', {
      eventType: 'task.completed',
      entityType: 'task',
      entityId: taskId,
      data: { taskId, crmTaskId },
    });
  }
}

// Singleton
export const ecosystemBridge = new EcosystemBridge();
```

### Update Agent Action: `post_to_pulse`

```typescript
// src/agents/actions/postToPulse.ts — Updated

import { ecosystemBridge } from '../../services/ecosystemBridge';

export async function execute(params) {
  const { step, triggerPayload, dryRun } = params;
  const config = step.config;

  if (dryRun) {
    return { result: { posted: false, message: '[DRY RUN]' }, countersDelta: { pulseMessages: 0 } };
  }

  // Use ecosystem bridge instead of direct Supabase insert
  const success = await ecosystemBridge.postToPulse({
    workspaceId: triggerPayload.workspaceId || config.workspaceId,
    channelPurpose: config.channel === 'auto' ? resolveChannel(triggerPayload) : config.channel,
    content: buildMessage(config.messageTemplate, triggerPayload),
    messageType: 'text',
    metadata: {
      agent_name: params.agent.name,
      source: 'entomate_agent',
    },
  });

  return {
    result: { posted: success, channel: config.channel },
    countersDelta: { pulseMessages: success ? 1 : 0 },
  };
}
```

---

## 4. Hero Workflow: End-to-End Implementation

### Step 1: Meeting Processing (already works)

When a meeting is processed, the backend already:
1. Transcribes audio via Gemini
2. Generates summary, key points, decisions
3. Extracts action items with AI
4. Runs sentiment analysis
5. Saves to `entomate_meetings` + `entomate_action_items`

### Step 2: Post-Processing Hook (NEW)

After meeting processing, trigger ecosystem events:

```typescript
// backend/routes/meetings.js — After processing completes

async function onMeetingProcessed(meeting, actionItems) {
  const bridge = require('../services/ecosystemBridge');
  await bridge.initialize();

  // 1. Post recap to Pulse
  if (bridge.isConnected('pulse')) {
    await bridge.postToPulse({
      workspaceId: meeting.workspace_id,
      channelPurpose: 'meetings',
      content: formatMeetingRecap(meeting, actionItems),
      messageType: 'meeting_recap',
      metadata: { meetingId: meeting.id },
      actions: [
        { label: 'View Meeting', action: 'open', url: `/meetings/${meeting.id}` },
        { label: 'Sync to CRM', action: 'sync_crm' },
      ],
      notifyUsers: meeting.attendee_user_ids || [],
    });

    // Notify assignees about their action items
    for (const item of actionItems) {
      if (item.assigned_to_user_id) {
        await bridge.postToPulse({
          workspaceId: meeting.workspace_id,
          channelPurpose: 'action_items',
          content: formatTaskAssignment(item, meeting.title),
          messageType: 'action_items',
          metadata: { actionItemId: item.id, meetingId: meeting.id },
          notifyUsers: [item.assigned_to_user_id],
        });
      }
    }
  }

  // 2. Sync to Logos Vision
  if (bridge.isConnected('logos_vision')) {
    await bridge.syncMeetingToLogosVision({
      meetingId: meeting.id,
      title: meeting.title,
      summary: meeting.summary,
      keyPoints: meeting.key_points || [],
      decisions: meeting.decisions || [],
      sentiment: meeting.sentiment_label,
      attendees: meeting.attendees || [],
      actionItems: actionItems.map(item => ({
        description: item.task_description,
        assigneeName: item.assigned_to_name,
        priority: item.priority,
        dueDate: item.due_date,
      })),
    });
  }

  // 3. Update knowledge graph
  await updateKnowledgeGraph(meeting, actionItems);
}
```

### Step 3: UI Feedback (NEW)

Show sync status on the meeting detail page:

```tsx
// In MeetingDetail.jsx — Add sync status indicators

function SyncStatus({ meetingId }) {
  const [status, setStatus] = useState({ pulse: null, crm: null });

  useEffect(() => {
    // Fetch sync events for this meeting
    api.get(`/ecosystem/events?entityId=${meetingId}`).then(setStatus);
  }, [meetingId]);

  return (
    <div className="sync-status">
      <SyncBadge app="Pulse" status={status.pulse} icon="💬" />
      <SyncBadge app="Logos Vision" status={status.crm} icon="📊" />
    </div>
  );
}
```

---

## 5. Database Changes for Entomate

```sql
-- Migration: create_ecosystem_tables.sql

CREATE TABLE IF NOT EXISTS ecosystem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL UNIQUE,
  api_url TEXT NOT NULL,
  service_token TEXT NOT NULL,
  inbound_token TEXT NOT NULL,
  enabled BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{}',
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ecosystem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  direction TEXT NOT NULL,
  status TEXT DEFAULT 'received',
  payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ecosystem_entity_map (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  local_entity_type TEXT NOT NULL,
  local_entity_id UUID NOT NULL,
  remote_app TEXT NOT NULL,
  remote_entity_type TEXT NOT NULL,
  remote_entity_id TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(local_entity_type, local_entity_id, remote_app)
);
```

---

## 6. Settings UI: Ecosystem Configuration

Add to Entomate's Settings page:

```
Settings → Ecosystem
├── Connected Apps
│   ├── Pulse: [URL] [Token] [Test Connection] [✅ Connected]
│   │   └── Features: ☑ Bot Messages ☑ Notifications ☑ Search
│   └── Logos Vision: [URL] [Token] [Test Connection] [✅ Connected]
│       └── Features: ☑ Sync Tasks ☑ Sync Meetings ☑ Sync Projects
├── Auto-Sync
│   ├── ☑ Auto-post meeting recaps to Pulse
│   ├── ☑ Auto-sync action items to Logos Vision
│   ├── ☑ Auto-create CRM activities from meetings
│   └── ☑ Notify assignees in Pulse
└── Event Log
    └── [View recent sync events] [Retry failed]
```

---

## 7. Implementation Checklist

### Phase 1: Bridge Foundation (Week 1)
- [ ] Create `ecosystem_config`, `ecosystem_events`, `ecosystem_entity_map` migrations
- [ ] Implement `ecosystemBridge.ts` service
- [ ] Create `ecosystem-inbound` Edge Function (receives events from Pulse/LV)
- [ ] Add ecosystem settings API endpoints
- [ ] Basic settings UI (connect/test/disconnect)

### Phase 2: Hero Workflow (Week 2)
- [ ] Implement `onMeetingProcessed()` post-processing hook
- [ ] Rewrite `post_to_pulse` agent action to use bridge
- [ ] Update `sync_to_crm` agent action to use bridge
- [ ] Add sync status indicators to MeetingDetail page
- [ ] Add sync status to action items list
- [ ] Format meeting recap + task assignment messages

### Phase 3: Intelligence + Polish (Week 3)
- [ ] Cross-app data in Dashboard ring gauges (LV metrics if connected)
- [ ] Meeting prep with LV contact context (if connected)
- [ ] Ecosystem status widget on Dashboard
- [ ] Event log viewer in Settings
- [ ] Retry failed syncs UI
- [ ] Error handling + offline resilience

---

*This plan is standalone — all changes are in the Entomate codebase. Pulse changes are in PULSE_INTEGRATION_REDESIGN.md.*
