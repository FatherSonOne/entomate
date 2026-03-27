# Claude Code Execution Prompt — Entomate Ecosystem Integration

## Context

You are working on **Entomate**, an AI-powered meeting intelligence & project automation platform. It is part of a three-app ecosystem:
- **Logos Vision** — Nonprofit CRM (contacts, donations, projects, tasks)
- **Pulse** — Team communications (messaging, channels, notifications)
- **Entomate** — Meeting intelligence & automation (this app)

All three are **separate Supabase projects**. They communicate via an **Ecosystem Bridge** pattern: each app has an inbound/outbound API, service tokens for auth, and shared event schemas.

## Your Task

Implement the Entomate-side Ecosystem Bridge and Hero Workflow. The goal is:
1. Entomate can send events to Pulse and Logos Vision via HTTP
2. Entomate can receive events from Pulse and Logos Vision
3. When a meeting is processed, it automatically posts a recap to Pulse and syncs action items to Logos Vision

## Key Files to Read First

Read these files to understand the current codebase before making changes:
1. `ENTOMATE_INTEGRATION_PLAN.md` (in workspace root) — Full implementation plan with code samples
2. `ECOSYSTEM_BRIDGE_DESIGN.md` (in workspace root) — Architecture and shared schemas
3. `src/services/pulseChatService.ts` — CURRENT (broken) Pulse integration to be replaced
4. `src/services/crmSyncService.ts` — CURRENT Logos Vision sync (works but needs bridge update)
5. `src/agents/actions/index.ts` — Agent action registry
6. `src/agents/actions/postToPulse.ts` — Agent action to be updated
7. `backend/routes/integrations.js` — Backend integration endpoints
8. `backend/routes/meetings.js` — Meeting processing routes (add post-processing hook here)
9. `frontend/src/pages/Settings.jsx` — Settings page to add ecosystem config UI

## Implementation Order

### Step 1: Database Migrations
Create migration file `supabase/migrations/YYYYMMDD_create_ecosystem_tables.sql` with:
- `ecosystem_config` table (stores connected app URLs + tokens)
- `ecosystem_events` table (audit log of all cross-app events)
- `ecosystem_entity_map` table (maps entity IDs across apps)

See `ENTOMATE_INTEGRATION_PLAN.md` Section 5 for exact SQL.

### Step 2: Ecosystem Bridge Service
Create `src/services/ecosystemBridge.ts` with the `EcosystemBridge` class:
- `initialize()` — loads config from DB
- `isConnected(appName)` — checks if app is connected
- `getStatus()` — returns which apps are connected
- `sendEvent(targetApp, event)` — sends event to another app
- `broadcast(event)` — sends to all connected apps
- `postToPulse(params)` — convenience method for Pulse bot messages
- `syncMeetingToLogosVision(params)` — convenience for LV sync

See `ENTOMATE_INTEGRATION_PLAN.md` Section 3 for full implementation.

### Step 3: Ecosystem Inbound Edge Function
Create `supabase/functions/ecosystem-inbound/index.ts`:
- Validates `X-Ecosystem-Token` header against `ecosystem_config.inbound_token`
- Logs event to `ecosystem_events` table
- Routes to local handlers based on `eventType`
- Handles: `task.completed` (from LV), `contact.updated` (from LV), `notification.send` (from Pulse)

See `ECOSYSTEM_BRIDGE_DESIGN.md` Section 7 for template.

### Step 4: Post-Processing Hook
In `backend/routes/meetings.js`, after a meeting is processed (transcription + AI analysis complete):
- Call `ecosystemBridge.postToPulse()` with formatted meeting recap
- Call `ecosystemBridge.syncMeetingToLogosVision()` with meeting data + action items
- Both calls should be fire-and-forget (don't block the response)
- Log success/failure to `ecosystem_events`

See `ENTOMATE_INTEGRATION_PLAN.md` Section 4 for the `onMeetingProcessed()` function.

### Step 5: Update Agent Actions
Update `src/agents/actions/postToPulse.ts`:
- Import `ecosystemBridge` instead of directly inserting into Supabase
- Use `ecosystemBridge.postToPulse()` for all Pulse communication

### Step 6: Backend API Endpoints
Add to `backend/routes/integrations.js` (or new `backend/routes/ecosystem.js`):
- `GET /api/ecosystem/status` — Returns connected apps and feature flags
- `POST /api/ecosystem/config` — Save/update ecosystem config
- `DELETE /api/ecosystem/config/:appName` — Disconnect an app
- `POST /api/ecosystem/test/:appName` — Test connection
- `GET /api/ecosystem/events` — Recent sync events (for UI)
- `POST /api/ecosystem/retry/:eventId` — Retry failed event

### Step 7: Settings UI
Add ecosystem configuration section to `frontend/src/pages/Settings.jsx`:
- Connected Apps panel (Pulse URL + token, LV URL + token)
- Test Connection button per app
- Feature toggles per app
- Recent events log

### Step 8: Sync Status UI
Add sync indicators to `frontend/src/pages/MeetingDetail.jsx`:
- Show "✅ Synced to Pulse" / "✅ Synced to CRM" badges
- Show "⏳ Syncing..." during sync
- Show "❌ Sync failed — Retry" with retry button

## Important Notes

- **Do NOT modify Pulse or Logos Vision code** — this prompt is Entomate-only
- **Feature detection:** Always check `ecosystemBridge.isConnected('pulse')` before attempting Pulse operations. The app must work perfectly without any connected apps.
- **Error resilience:** Cross-app calls should never crash the local operation. If Pulse is down, the meeting still processes successfully — sync just logs a failure and can be retried.
- **The old `pulseChatService.ts` should be deprecated** — keep it for reference but all new code goes through `ecosystemBridge.ts`
- **Follow the Void × Crimson design system** for any new UI components (see `docs/void-crimson-redesign-direction.md`)
- **Use the VC component library** (`frontend/src/components/vc/`) for UI elements (VCButton, VCBadge, VCInput, etc.)
