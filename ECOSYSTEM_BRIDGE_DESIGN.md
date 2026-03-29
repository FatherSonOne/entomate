# Ecosystem Bridge Design — Logos Vision × Pulse × Entomate
*Architecture document for the QNTMECOS Trifecta Integration Layer*
*Created 2026-03-26 by Rune*

---

## 1. Problem Statement

Logos Vision, Pulse, and Entomate are **three separate Supabase projects**. They need to:
- Share authentication (SSO)
- Route events between apps in real-time
- Enable cross-app search
- Support both bundle (all 3) and à la carte (1 or 2) deployment
- Scale without tight coupling

## 2. Architecture: The Ecosystem Bridge

The bridge is NOT a monolithic middleware. It's a **pattern implemented across all three apps** using:
- **Supabase Edge Functions** (per-project, handles inbound/outbound events)
- **Shared event schema** (consistent payload format)
- **Service tokens** (app-to-app authentication)
- **Feature detection** (graceful degradation when an app isn't present)

```
┌──────────────────────────────────────────────────────────────┐
│                    ECOSYSTEM BRIDGE PATTERN                   │
│                                                              │
│  Each app has:                                               │
│  ┌─────────────────────────────────────────────┐            │
│  │  ecosystem-outbound (Edge Function)          │            │
│  │  - Publishes events when local data changes  │            │
│  │  - Calls other apps' inbound endpoints       │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │  ecosystem-inbound (Edge Function)           │            │
│  │  - Receives events from other apps           │            │
│  │  - Validates service tokens                  │            │
│  │  - Routes to local handlers                  │            │
│  └─────────────────────────────────────────────┘            │
│                                                              │
│  ┌─────────────────────────────────────────────┐            │
│  │  ecosystem-config table                      │            │
│  │  - Stores URLs + tokens for connected apps   │            │
│  │  - Feature flags per integration             │            │
│  └─────────────────────────────────────────────┘            │
└──────────────────────────────────────────────────────────────┘
```

### Why NOT a Central Hub Server?

- Extra infrastructure to maintain and deploy
- Single point of failure
- Adds latency (event → hub → destination vs event → destination)
- The Edge Function pattern means each app handles its own events — simpler, faster, more resilient

### Flow Example: Meeting Processed in Entomate

```
1. Entomate processes meeting
2. Entomate's DB trigger fires → calls ecosystem-outbound Edge Function
3. ecosystem-outbound checks ecosystem_config:
   - Pulse configured? → POST to Pulse's ecosystem-inbound with event
   - Logos Vision configured? → POST to LV's ecosystem-inbound with event
4. Pulse's ecosystem-inbound receives event:
   - Creates bot message in meeting channel
   - Sends notifications to mentioned users
5. LV's ecosystem-inbound receives event:
   - Creates Activity record
   - Creates Tasks from action items
   - Links to existing contacts
```

## 3. Shared Event Schema

All cross-app events follow this format:

```typescript
interface EcosystemEvent {
  // Identity
  id: string;                    // UUID
  source: 'entomate' | 'pulse' | 'logos_vision';
  timestamp: string;             // ISO 8601

  // Authentication
  serviceToken: string;          // App-to-app token

  // Event
  eventType: string;             // e.g., 'meeting.processed', 'task.completed'
  entityType: string;            // e.g., 'meeting', 'task', 'contact', 'message'
  entityId: string;              // Source app's ID for the entity

  // Payload
  data: Record<string, any>;     // Event-specific data

  // Routing
  targetApp?: string;            // If directed to specific app (otherwise broadcast)
  replyTo?: string;              // For request-response patterns
}
```

### Core Event Types

| Event Type | Source | Description |
|---|---|---|
| `meeting.processed` | Entomate | Meeting transcribed, summarized, action items extracted |
| `meeting.action_items_extracted` | Entomate | Action items ready for CRM sync |
| `task.created` | Entomate/LV | New task created |
| `task.completed` | Entomate/LV | Task marked done |
| `task.updated` | Entomate/LV | Task status/assignment changed |
| `project.created` | Entomate/LV | New project created |
| `project.linked` | Entomate | Entomate project linked to LV project |
| `contact.updated` | LV | Contact info changed |
| `contact.created` | LV | New contact added |
| `donation.received` | LV | New donation recorded |
| `message.bot_post` | Entomate | Request to post bot message in Pulse |
| `notification.send` | Entomate/LV | Cross-app notification |
| `agent.action_completed` | Entomate | AI agent completed an action |
| `automation.triggered` | Entomate | Automation workflow triggered |
| `search.query` | Any | Cross-app search request |

## 4. Database Tables (per app)

Each app adds these tables:

```sql
-- Stores connection config for other ecosystem apps
CREATE TABLE ecosystem_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  app_name TEXT NOT NULL UNIQUE,          -- 'entomate', 'pulse', 'logos_vision'
  api_url TEXT NOT NULL,                   -- Base URL for the app's ecosystem-inbound
  service_token TEXT NOT NULL,             -- Token this app uses to call that app
  inbound_token TEXT NOT NULL,             -- Token that app uses to call us
  enabled BOOLEAN DEFAULT true,
  features JSONB DEFAULT '{}',             -- Feature flags: { "sync_tasks": true, "bot_messages": true }
  last_heartbeat TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Logs all cross-app events (audit trail)
CREATE TABLE ecosystem_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id TEXT NOT NULL,                  -- Original event UUID
  source TEXT NOT NULL,
  event_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  direction TEXT NOT NULL,                 -- 'inbound' or 'outbound'
  status TEXT DEFAULT 'received',          -- 'received', 'processed', 'failed', 'ignored'
  payload JSONB,
  error_message TEXT,
  processing_time_ms INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Maps entity IDs across apps (e.g., Entomate task ID ↔ LV task ID)
CREATE TABLE ecosystem_entity_map (
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

## 5. Authentication: SSO via Shared JWT

### Approach: Federated Supabase Auth

Since all three apps use Supabase Auth, we use **JWT cross-validation**:

1. **Designate auth authority:** One Supabase project (Pulse is the natural choice — it's the comms hub, every user has an account) is the auth source.
2. **Share the JWT secret:** Configure all three Supabase projects to accept JWTs signed by the auth authority's secret.
3. **User linking:** Each app maintains a `ecosystem_users` table mapping the auth user ID to local user records.

```sql
-- In each app
CREATE TABLE ecosystem_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  auth_user_id UUID NOT NULL UNIQUE,      -- From the auth authority (Pulse)
  local_user_id UUID,                      -- This app's user record
  email TEXT,
  name TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);
```

### Alternative (Simpler): Service Token Auth Only

If full SSO is too complex for phase 1, use service tokens for app-to-app communication and keep separate logins per app. SSO can be added later.

**Recommendation:** Start with service tokens (Phase 1), add SSO later (Phase 3).

## 6. Feature Detection Pattern

Each app checks what's connected on startup:

```typescript
// In any app
async function getEcosystemStatus(): Promise<EcosystemStatus> {
  const configs = await supabase.from('ecosystem_config').select('*').eq('enabled', true);

  return {
    entomate: configs.find(c => c.app_name === 'entomate') || null,
    pulse: configs.find(c => c.app_name === 'pulse') || null,
    logosVision: configs.find(c => c.app_name === 'logos_vision') || null,
    isBundle: configs.length === 2, // This app + 2 others
  };
}

// Then in UI components:
const ecosystem = useEcosystemStatus();
{ecosystem.pulse && <PulseIntegrationWidget />}
{ecosystem.logosVision && <CRMSyncButton />}
```

This ensures à la carte apps work perfectly alone and unlock features when bundled.

## 7. Edge Function Templates

### ecosystem-inbound (receives events from other apps)

```typescript
// supabase/functions/ecosystem-inbound/index.ts
import { serve } from 'https://deno.land/std/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js';

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // Validate service token
  const token = req.headers.get('X-Ecosystem-Token');
  const { data: config } = await supabase
    .from('ecosystem_config')
    .select('*')
    .eq('inbound_token', token)
    .eq('enabled', true)
    .single();

  if (!config) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
  }

  const event = await req.json();

  // Log the event
  await supabase.from('ecosystem_events').insert({
    event_id: event.id,
    source: event.source,
    event_type: event.eventType,
    entity_type: event.entityType,
    entity_id: event.entityId,
    direction: 'inbound',
    payload: event.data,
  });

  // Route to handler
  try {
    await routeEvent(supabase, event);
    return new Response(JSON.stringify({ received: true }), { status: 200 });
  } catch (error) {
    await supabase.from('ecosystem_events').update({
      status: 'failed',
      error_message: error.message,
    }).eq('event_id', event.id);
    return new Response(JSON.stringify({ error: error.message }), { status: 500 });
  }
});

async function routeEvent(supabase, event) {
  // Each app implements its own routing logic
  switch (event.eventType) {
    case 'meeting.processed':
      return handleMeetingProcessed(supabase, event);
    case 'task.completed':
      return handleTaskCompleted(supabase, event);
    // ... more handlers
  }
}
```

## 8. Setup Flow (for bundle customers)

1. Admin goes to Settings → Ecosystem in any app
2. Enters the API URLs for the other apps
3. System generates service tokens and exchanges them
4. Health check verifies connectivity
5. Feature flags auto-enable based on connected apps
6. "Test Connection" button sends a ping event

This can be done via a setup wizard in the Settings page of each app.

---

## 9. Implementation Priority

| Priority | Component | Effort |
|---|---|---|
| P0 | `ecosystem_config` table in all 3 apps | 1 day |
| P0 | `ecosystem_events` log table in all 3 apps | 1 day |
| P0 | `ecosystem-inbound` Edge Function in all 3 apps | 2 days |
| P0 | `ecosystem-outbound` Edge Function in Entomate | 2 days |
| P1 | Entity mapping table + ID resolution | 1 day |
| P1 | Settings UI for ecosystem configuration | 2 days |
| P1 | Health check + connection testing | 1 day |
| P2 | SSO / JWT cross-validation | 3-5 days |
| P2 | Cross-app search aggregation | 2-3 days |

**Total Phase 1 (service tokens + event routing): ~10 days**

---

*This document defines the integration pattern. See PULSE_INTEGRATION_REDESIGN.md and ENTOMATE_INTEGRATION_PLAN.md for app-specific implementation details.*
