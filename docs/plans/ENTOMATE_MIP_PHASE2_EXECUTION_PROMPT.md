# MIP Phase 2: Context Assembly — Execution Prompt

## Mission

Build the **Context Assembly** layer for Meeting Intelligence Profiles. This is the layer that reaches across the ecosystem (Logos Vision CRM, Pulse, and Entomate's own data) to gather pre-meeting context, assemble it into a structured object, and feed it into the prompt builder from Phase 1.

You're also wiring the `meeting.upcoming` trigger and `prepare_context` action into the existing agent framework so context assembly can fire automatically before meetings.

## What Phase 1 Already Built (DO NOT recreate)

These files exist and are complete — read them to understand the patterns:

| File | What It Does |
|------|-------------|
| `src/intelligence/types.ts` | All MIP types including `AssembledContext`, `ParticipantContext`, `OrgContext`, `DealContext`, `PastMeetingContext`, `ConversationContext`, `TaskContext`, `ContextSource` |
| `src/intelligence/profileService.ts` | CRUD for profiles + meeting intelligence configs |
| `src/intelligence/profileRegistry.ts` | Built-in profile loading + DB seeding |
| `src/intelligence/promptBuilder.ts` | `buildMeetingPrompt()` — accepts `AssembledContext` and substitutes it into profile templates |
| `src/intelligence/templates/` | 7 built-in profile templates, each with `contextSources` and `contextDepth` defined |
| `src/intelligence/index.ts` | Public API barrel export |
| `src/services/geminiService.ts` | Already accepts optional `systemPrompt` param on `summarizeMeeting()`, `extractActionItems()`, `askAboutMeeting()` |
| `src/agents/actions/extractActionItems.ts` | Already reads `triggerPayload.intelligenceConfig.composedPrompt` |
| `src/agents/types.ts` | Already has `'meeting.upcoming'` in `TriggerType` and `'prepare_context'` in `ActionType` |
| `supabase/migrations/20260328_001_meeting_intelligence_profiles.sql` | Tables: `intelligence_profiles`, `meeting_intelligence_config`, `intelligence_context_cache` |

## What You're Building

### 1. `src/intelligence/contextAssembler.ts` — The Core Service

This is the main service. It gathers context from multiple sources based on a profile's `contextSources` and `contextDepth` config.

**Inputs:**
- `meetingId: string` — the meeting to gather context for
- `profileId: string` — the intelligence profile (determines which sources to query and depth)
- OR pass the full `IntelligenceProfile` object directly

**Outputs:**
- `AssembledContext` (defined in `types.ts`) — structured context object

**Implementation Details:**

```typescript
export async function assembleContext(
  meetingId: string,
  profile: IntelligenceProfile
): Promise<AssembledContext>
```

**Flow:**

1. **Load meeting data** from `entomate_meetings` table — get title, participants, tags, description
2. **Extract participant identifiers** — emails, names from the meeting's participant list
3. **For each `contextSource` in `profile.contextSources`**, run the appropriate gatherer:

   - **`'contacts'`** → Query Logos Vision for participant contact records
     - Use `logosVisionSupabase` from `src/lib/logosVisionClient.ts`
     - Query: match participants by email or name against Logos Vision's contacts/clients tables
     - Map to `ParticipantContext[]`
   
   - **`'org_info'`** → Query Logos Vision for organization data
     - Look up the organization(s) associated with matched contacts
     - Query the `clients` table (Logos Vision uses "clients" as orgs)
     - Map to `OrgContext`
   
   - **`'crm_deals'`** → Query Logos Vision for active deals/projects
     - Look up `projects` table where `client_id` matches any participant's org
     - Filter for active/in-progress status
     - Map to `DealContext[]`
   
   - **`'past_meetings'`** → Query Entomate's own `entomate_meetings` table
     - Find previous meetings where any of the same participants were present
     - Order by date descending, limit based on `contextDepth`:
       - `minimal`: 1 meeting
       - `standard`: 3 meetings
       - `deep`: 5 meetings
     - Include summary, key decisions, open action items from `entomate_meeting_summaries` if available
     - Map to `PastMeetingContext[]`
   
   - **`'pulse_history'`** → Query Pulse for recent conversation threads
     - Use `pulseChatService.ts` patterns (it queries via Supabase REST)
     - Look for messages/threads mentioning participant names or related to the meeting topic
     - Limit: last 7 days for `minimal`, 30 days for `standard`, 90 days for `deep`
     - Map to `ConversationContext[]`
   
   - **`'tasks'`** → Query Entomate's `entomate_action_items` table
     - Find open action items assigned to or related to meeting participants
     - Also check Logos Vision `tasks` via the CRM client
     - Map to `TaskContext[]`
   
   - **`'notes'`** → Query Logos Vision for notes/activities
     - Query the `activities` table for type='Note' related to participant contacts
     - Map as additional context into participant notes

4. **Estimate token count** — rough estimate at ~4 chars per token, sum the serialized context
5. **If over budget (4000 tokens)**, trim:
   - Truncate conversation history first
   - Then past meeting summaries
   - Then notes
   - Never trim participant names/roles (core identity data)
6. **Cache the result** in `intelligence_context_cache` table with a 2-hour TTL
7. **Update the `meeting_intelligence_config` record:**
   - Set `assembled_context` = the `AssembledContext` JSON
   - Set `context_assembled_at` = now
   - Set `status` = `'context_ready'`
   - Compose the prompt via `buildMeetingPrompt()` and save to `composed_prompt`

**Error Handling:**
- Each source gatherer is independent — wrap each in try/catch
- If a source fails, log the error and continue with remaining sources
- Track which sources succeeded in `assembledContext.sources`
- If Logos Vision isn't configured (`logosVisionClient.getConnectionInfo().isConfigured === false`), skip CRM sources gracefully
- If Pulse isn't configured, skip pulse_history gracefully

**Cache:**
```typescript
export async function getCachedContext(
  entityType: string,
  entityId: string,
  sourceApp: string
): Promise<any | null>

export async function setCachedContext(
  entityType: string,
  entityId: string,
  sourceApp: string,
  data: any,
  ttlHours: number = 2
): Promise<void>

export async function clearExpiredCache(): Promise<number>
```

### 2. `src/agents/actions/prepareContext.ts` — Agent Action

Follow the exact pattern from `src/agents/actions/extractActionItems.ts`.

```typescript
export const type = 'prepare_context';
export const description = 'Assembles cross-app context for a meeting intelligence profile';

export async function execute(params: {
  agent: Agent;
  step: ActionStep;
  triggerPayload: Record<string, any>;
  dryRun?: boolean;
}): Promise<{ result: any; countersDelta?: { pulseMessages?: number; crmTasks?: number } }>
```

**What it does:**
1. Read `triggerPayload.meeting` and `triggerPayload.intelligenceConfig`
2. If no intelligence config exists for the meeting, check if suggestion engine should run (Phase 3 — for now, just skip)
3. Load the profile via `getProfileById(config.profileId)`
4. Call `assembleContext(meetingId, profile)`
5. Return the assembled context as the action result
6. If `dryRun`, log what would be assembled but don't write to DB

### 3. `src/agents/triggers/meetingUpcoming.ts` — Trigger Handler

This trigger fires before a meeting starts to assemble context.

```typescript
export const type = 'meeting.upcoming';
export const description = 'Fires before a meeting to prepare intelligence context';

export async function evaluate(
  config: Record<string, any>,
  context: Record<string, any>
): Promise<boolean>
```

**Evaluation logic:**
- Check that the meeting has a `meeting_intelligence_config` record with a profile assigned
- Check that `status` is `'pending'` (context not yet assembled)
- Check that the meeting hasn't already passed
- Optional: `config.minutesBefore` — only trigger if meeting is within N minutes (default: 30)

### 4. Wire Into Agent Registry

**Modify `src/agents/agentRegistry.ts`:**

- Import `prepareContext` action handler from `./actions/prepareContext`
- Add it to the `ACTIONS` record
- Import the `meetingUpcoming` trigger handler from `./triggers/meetingUpcoming`
- Add it to the `TRIGGERS` record

### 5. Update `src/agents/agentTriggerService.ts`

Add a new function:

```typescript
export async function fireMeetingUpcomingTrigger(
  meetingId: string,
  options: { dryRun?: boolean } = {}
): Promise<AgentRunResult[]>
```

**Flow:**
1. Load the meeting from `entomate_meetings`
2. Load `meeting_intelligence_config` for that meeting
3. Build trigger event with `type: 'meeting.upcoming'`
4. Include `intelligenceConfig` in the trigger payload
5. Call `runAgentForTrigger()` (same pattern as `fireMeetingCompletedTrigger`)

Also: In `fireMeetingCompletedTrigger` (already partially wired from Phase 1), make sure the `intelligenceConfig` is passed through completely, including the `composedPrompt`. Verify the existing code loads it — it appears to already do this, but confirm it passes through to the agent runner's `triggerPayload`.

### 6. Update `src/intelligence/index.ts`

Add the new exports:

```typescript
// Context Assembly
export {
  assembleContext,
  getCachedContext,
  setCachedContext,
  clearExpiredCache,
} from './contextAssembler';
```

### 7. Integration Hook in Meeting Service

**Modify `src/services/meetingService.ts`** (or wherever meetings are processed):

Look for where `fireMeetingCompletedTrigger` is called. Before that call:
1. Load the `meeting_intelligence_config` for the meeting
2. If one exists with `status === 'pending'`, call `assembleContext()` first
3. This ensures context is ready even if the upcoming trigger didn't fire (manual meetings, recordings uploaded after the fact)

This is a **fallback path** — the primary path is the upcoming trigger firing before the meeting.

## Key Files to READ (don't modify unless specified above)

| File | Why |
|------|-----|
| `src/agents/actions/extractActionItems.ts` | Pattern reference for action handlers |
| `src/agents/agentRunner.ts` | Understand how triggers → actions execute |
| `src/agents/templates/meetingInsightsAgent.ts` | Pattern reference for agent templates |
| `src/lib/logosVisionClient.ts` | Logos Vision Supabase client — use `logosVisionSupabase` and types |
| `src/services/pulseChatService.ts` | Pattern for querying Pulse data via REST |
| `src/lib/supabase.ts` | Main Supabase client + types for Entomate tables |
| `backend/services/ecosystemBridge.js` | Backend ecosystem bridge (for reference on how cross-app calls work) |

## Important Patterns

1. **Supabase queries in `src/`** use the frontend client (`src/lib/supabase.ts`) with `import { supabase } from '../lib/supabase'`
2. **Logos Vision queries** use `logosVisionSupabase` from `src/lib/logosVisionClient.ts` — this may be a separate Supabase instance or the shared one
3. **Backend services** (in `backend/`) use `supabaseAdmin` from `backend/config/supabase.js` — the context assembler lives in `src/` (frontend/shared), not `backend/`
4. **Error resilience** is critical — cross-app queries can fail, and that's OK. Never let a failed context lookup block meeting processing
5. **All Entomate meeting data** lives in tables prefixed with `entomate_` (e.g., `entomate_meetings`, `entomate_action_items`)
6. **Logos Vision tables** are NOT prefixed — they use names like `clients`, `team_members`, `tasks`, `activities`, `projects`

## Logos Vision Table Reference (for context queries)

Based on the client types in `logosVisionClient.ts`:

- **`clients`** — Organizations (has: `name`, `contact_person`, `email`, `phone`, `location`)
- **`team_members`** — People (has: `name`, `email`, `role`)
- **`tasks`** — Tasks/todos (has: `description`, `team_member_id`, `due_date`, `status`, `priority`, `notes`, `entomate_action_item_id`, `entomate_meeting_id`)
- **`activities`** — Interactions (has: `type` [Call/Email/Meeting/Note], `title`, `project_id`, `client_id`, `activity_date`, `status`, `notes`, `entomate_meeting_id`)
- **`projects`** — Projects/deals (has: `name`, `description`, `client_id`, `status`, `start_date`, `end_date`, `entomate_project_id`, `entomate_deal_id`)

## Entomate Table Reference

- **`entomate_meetings`** — Meetings (has: `id`, `title`, `transcript`, `summary`, `participants`, `tags`, `scheduled_at`, `duration_seconds`, etc.)
- **`entomate_meeting_summaries`** — AI-generated summaries (linked to meetings)
- **`entomate_action_items`** — Action items extracted from meetings
- **`meeting_intelligence_config`** — Phase 1 table, links meetings to profiles
- **`intelligence_context_cache`** — Phase 1 table for caching context lookups

## Testing Notes

- All context gathering should work with the Logos Vision connection both configured AND unconfigured (graceful fallback)
- Test with a meeting that has no intelligence config — should be a no-op
- Test with a meeting that has a config but no participants match in CRM — should return partial context
- The `clearExpiredCache()` function should be safe to call anytime (DELETE WHERE expires_at < now())

## Definition of Done

- [ ] `src/intelligence/contextAssembler.ts` exists and exports `assembleContext`, `getCachedContext`, `setCachedContext`, `clearExpiredCache`
- [ ] `src/agents/actions/prepareContext.ts` exists and follows the action handler pattern
- [ ] `src/agents/triggers/meetingUpcoming.ts` exists and follows the trigger handler pattern
- [ ] `src/agents/agentRegistry.ts` registers both the new trigger and action
- [ ] `src/agents/agentTriggerService.ts` exports `fireMeetingUpcomingTrigger()`
- [ ] `src/intelligence/index.ts` updated with new exports
- [ ] Meeting processing flow has fallback context assembly before the completed trigger
- [ ] All cross-app queries are wrapped in try/catch with graceful degradation
- [ ] Token budget enforcement on assembled context
- [ ] Context caching works with TTL expiry
- [ ] No changes to Phase 1 files except `index.ts` (adding exports)
