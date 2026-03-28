# Claude Code Execution Prompt — Meeting Intelligence Profiles (Phase 1)

> **Copy this entire prompt into Claude Code in the Entomate project directory (`/mnt/d/Dev/entomate/`)**

---

## Prompt

I need you to implement **Phase 1 of Meeting Intelligence Profiles (MIP)** for Entomate. This is a new feature that allows users to assign AI specialization profiles to meetings, so the Gemini-powered bot processes each meeting through a specialized lens (e.g., "Grant Specialist" for grant meetings, "Sales Discovery" for sales calls).

### Read These Files First

Before writing any code, read and understand these files (they are your architectural context):

**Core architecture:**
- `src/agents/types.ts` — Agent type definitions (you'll extend these)
- `src/agents/agentRegistry.ts` — How triggers and actions are registered
- `src/agents/agentRunner.ts` — How agents execute (READ ONLY)
- `src/agents/actions/extractActionItems.ts` — Gemini extraction action (you'll modify)
- `src/agents/templates/meetingInsightsAgent.ts` — Example template (pattern reference)

**Services you'll modify:**
- `src/services/geminiService.ts` — Gemini API wrapper (you'll add prompt override support)
- `src/services/meetingService.ts` — Meeting CRUD (you'll hook in intelligence config)
- `src/lib/supabase.ts` — Supabase types (you'll add new table types)

**Ecosystem context (READ ONLY):**
- `src/lib/logosVisionClient.ts` — CRM client patterns
- `src/services/pulseChatService.ts` — Pulse bridge patterns
- `supabase/migrations/20260326_001_create_ecosystem_tables.sql` — Ecosystem table patterns
- `supabase/migrations/20251219_002_week7_automations_tables.sql` — Agent/automation table patterns

**UI context (READ ONLY for Phase 1):**
- `src/components/MeetingsView.tsx` — Meeting UI (you'll integrate the panel here later)

### What to Build (Phase 1 Scope)

Phase 1 is the **foundation** — types, database, profile templates, prompt builder, and wiring into existing Gemini calls. NO UI components in Phase 1 (that's Phase 3).

#### 1. Database Migration

Create file: `supabase/migrations/20260328_001_meeting_intelligence_profiles.sql`

Create three tables following the exact patterns from the existing migrations:

**`intelligence_profiles`** — Stores profile templates (built-in + user-created)
- `id` UUID PK
- `name` TEXT NOT NULL
- `slug` TEXT NOT NULL UNIQUE
- `description` TEXT
- `icon` TEXT DEFAULT '🤖'
- `category` TEXT NOT NULL DEFAULT 'general'
- `system_prompt_template` TEXT NOT NULL — Prompt template with `{{variable}}` placeholders
- `custom_fields` JSONB NOT NULL DEFAULT '[]' — Array of field definitions
- `focus_areas` JSONB NOT NULL DEFAULT '[]' — Array of focus area configs
- `tone` TEXT NOT NULL DEFAULT 'balanced'
- `output_format` JSONB DEFAULT '{}'
- `context_sources` JSONB NOT NULL DEFAULT '["contacts"]'
- `context_depth` TEXT NOT NULL DEFAULT 'standard'
- `suggest_when` JSONB DEFAULT '{}'
- `is_builtin` BOOLEAN NOT NULL DEFAULT false
- `is_active` BOOLEAN NOT NULL DEFAULT true
- `created_by` UUID
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- `updated_at` TIMESTAMPTZ NOT NULL DEFAULT now()

**`meeting_intelligence_config`** — Links a meeting to a profile + user inputs
- `id` UUID PK
- `meeting_id` UUID NOT NULL — References entomate_meetings
- `profile_id` UUID REFERENCES intelligence_profiles(id)
- `custom_field_values` JSONB DEFAULT '{}'
- `assembled_context` JSONB DEFAULT '{}'
- `context_assembled_at` TIMESTAMPTZ
- `composed_prompt` TEXT
- `tone_override` TEXT
- `focus_override` JSONB
- `additional_instructions` TEXT
- `status` TEXT NOT NULL DEFAULT 'pending'
- `suggestion_dismissed` BOOLEAN DEFAULT false
- `created_at` / `updated_at` TIMESTAMPTZ
- UNIQUE(meeting_id)

**`intelligence_context_cache`** — Cache for cross-app lookups
- `id` UUID PK
- `entity_type` TEXT NOT NULL
- `entity_id` TEXT NOT NULL
- `source_app` TEXT NOT NULL
- `context_data` JSONB NOT NULL
- `expires_at` TIMESTAMPTZ NOT NULL
- `created_at` TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(entity_type, entity_id, source_app)

Add indexes, RLS policies (match patterns from ecosystem tables), and update triggers.

**Seed the built-in profiles** — INSERT 7 profiles (grant-specialist, sales-discovery, client-check-in, board-meeting, internal-standup, strategic-planning, vendor-negotiation) with their full configurations. Use the profile definitions below for the system_prompt_template and custom_fields.

#### 2. Type Definitions

Create file: `src/intelligence/types.ts`

Define these TypeScript interfaces and types:

```typescript
// CustomFieldDef — defines a user-configurable field in a profile
// CustomFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'toggle'
// FocusArea — { key, label, description, weight (0-1), extractionHint }
// SuggestionRule — { type: 'keyword'|'participant'|'tag'|'recurring'|'org_type', match, confidence }
// OutputFormatConfig — { summaryStyle, includeRecommendations, includeRiskAssessment, ... }
// IntelligenceProfile — full profile definition
// ContextSource = 'contacts' | 'pulse_history' | 'crm_deals' | 'past_meetings' | 'org_info' | 'tasks' | 'notes'
// AssembledContext — { participants[], organization?, relatedDeals?, pastMeetings?, ... }
// ParticipantContext, OrgContext, DealContext, PastMeetingContext, etc.
// MeetingIntelligenceConfig — links meeting to profile + user values
// ProfileSuggestion — { profile, confidence, reason }
```

See the plan document at `workspace/ENTOMATE_MEETING_INTELLIGENCE_PROFILES.md` for full type definitions.

#### 3. Profile Templates

Create directory: `src/intelligence/templates/`

Create 7 built-in profile template files + `index.ts`:
- `grantSpecialist.ts` — Grant proposals, funding, compliance
- `salesDiscovery.ts` — Sales meetings, demos, discovery calls
- `clientCheckIn.ts` — Client status meetings, QBRs
- `boardMeeting.ts` — Board meetings, governance
- `internalStandup.ts` — Daily standups, team syncs
- `strategicPlanning.ts` — Strategy sessions, roadmapping
- `vendorNegotiation.ts` — Vendor/contract negotiations

Each template exports a profile object following the `IntelligenceProfile` type (minus id/timestamps). Include:
- Meaningful `systemPromptTemplate` with `{{variable}}` placeholders matching the custom fields
- Appropriate `customFields` array with field definitions
- Relevant `focusAreas` with extraction hints for Gemini
- `suggestWhen` rules for auto-detection
- Appropriate `tone` and `outputFormat`

Use the Grant Specialist template from the plan document as the gold standard — other templates should match that level of detail.

#### 4. Profile Service

Create file: `src/intelligence/profileService.ts`

CRUD operations using Supabase:
- `getActiveProfiles()` — List all active profiles
- `getProfileBySlug(slug)` — Get profile by slug
- `getProfileById(id)` — Get profile by ID
- `createProfile(profile)` — Create a custom profile
- `updateProfile(id, updates)` — Update a profile
- `deleteProfile(id)` — Soft-delete (set is_active = false)
- `getMeetingIntelligenceConfig(meetingId)` — Get config for a meeting
- `saveMeetingIntelligenceConfig(config)` — Create/update (upsert on meeting_id)
- `getBuiltinProfiles()` — Get only built-in profiles

Follow the patterns in `src/services/meetingService.ts` for Supabase query style.

#### 5. Profile Registry

Create file: `src/intelligence/profileRegistry.ts`

- Loads built-in templates from `templates/`
- Provides `getDefaultProfiles()` — returns the 7 built-in templates
- Provides `seedBuiltinProfiles()` — inserts built-in templates into DB if not already present (idempotent)

#### 6. Prompt Builder

Create file: `src/intelligence/promptBuilder.ts`

This is the core engine that composes the final system prompt:

```typescript
export function buildMeetingPrompt(
  profile: IntelligenceProfile,
  customFieldValues: Record<string, any>,
  assembledContext: AssembledContext | null,
  overrides?: {
    toneOverride?: string;
    focusOverride?: FocusArea[];
    additionalInstructions?: string;
  }
): string
```

**How it works:**
1. Start with `profile.systemPromptTemplate`
2. Replace all `{{variable}}` placeholders with values from `customFieldValues`
3. Replace `{{participant_context}}` with formatted participant data from `assembledContext`
4. Replace `{{past_meeting_context}}` with formatted past meeting summaries
5. Replace `{{focus_areas}}` with comma-separated focus area labels
6. Replace `{{tone}}` with the tone value (or override)
7. Replace `{{output_style}}` with the output format description
8. Append any `additionalInstructions`
9. Handle `{{#if variable}}...{{/if}}` conditional blocks (simple presence check — not full Handlebars, just basic conditionals)
10. Trim total prompt to a token budget (estimate ~4 chars per token, cap at 4000 tokens / ~16000 chars for the system prompt, leaving room for the transcript)

Also provide a simpler function for backward compat:
```typescript
export function buildDefaultPrompt(type: 'summarize' | 'extract'): string
```
Returns the current hardcoded prompts from `geminiService.ts` — so the default behavior is unchanged.

#### 7. Wire Into Existing Gemini Calls

**Modify `src/services/geminiService.ts`:**

- `summarizeMeeting()` — Add optional parameter `systemPrompt?: string`. If provided, prepend it to the prompt. If not, use the existing hardcoded prompt (backward compat).
- `extractActionItems()` — Same pattern: optional `systemPrompt` parameter.
- `askAboutMeeting()` — Same pattern: optional `systemPrompt` parameter.
- `processMeetingAudio()` — Accept optional `meetingIntelligenceConfig?: MeetingIntelligenceConfig`. If provided, load the profile, build the prompt, and pass it to `summarizeMeeting()` and `extractActionItems()`.

**Modify `src/agents/actions/extractActionItems.ts`:**

- The `execute()` function should check `triggerPayload.intelligenceConfig` for a `MeetingIntelligenceConfig`. If present, use the `composedPrompt` from it. If not, use the existing behavior.

**Modify `src/agents/agentTriggerService.ts`:**

- `fireMeetingCompletedTrigger()` — Before creating the trigger event, check if the meeting has a `meeting_intelligence_config` record. If so, load it and include it in `triggerPayload.intelligenceConfig`.

#### 8. Update Agent Types

**Modify `src/agents/types.ts`:**

- Add `'meeting.upcoming'` to the `TriggerType` union
- Add `'prepare_context'` to the `ActionType` union

#### 9. Update Supabase Types

**Modify `src/lib/supabase.ts`:**

Add TypeScript interfaces for the 3 new tables:
- `IntelligenceProfileRow`
- `MeetingIntelligenceConfigRow`  
- `IntelligenceContextCacheRow`

#### 10. Index File

Create file: `src/intelligence/index.ts`

Export all public APIs from the intelligence module.

### Style & Patterns

- **TypeScript:** Strict types, no `any` unless wrapping external JSON
- **Supabase queries:** Follow the exact patterns in `meetingService.ts` and `agentService.ts`
- **Error handling:** Console.error + return null/empty (don't throw from service functions, match existing patterns)
- **Console logging:** Use `[Intelligence:component]` prefix, matching `[AgentRunner]` pattern
- **File organization:** Each file has a header comment block explaining its purpose
- **SQL migrations:** Follow exact patterns from `20260326_001_create_ecosystem_tables.sql` — RLS, indexes, comments, safe IF NOT EXISTS

### What NOT to Do

- Do NOT create UI components (that's Phase 3)
- Do NOT modify `MeetingsView.tsx` yet (Phase 3)
- Do NOT implement the context assembler (that's Phase 2 — it needs ecosystem bridge work)
- Do NOT implement the suggestion engine (that's Phase 3)
- Do NOT break backward compatibility — ALL existing behavior must work unchanged when no intelligence profile is assigned to a meeting
- Do NOT change the Gemini model or API usage patterns
- Do NOT touch Pulse or Logos Vision codebases

### Verification

After implementation, verify:
1. The migration SQL is valid and creates all 3 tables with indexes + RLS
2. All 7 built-in profiles are seeded correctly
3. `profileService.ts` can CRUD profiles and meeting intelligence configs
4. `promptBuilder.ts` correctly substitutes variables, handles conditionals, and respects token budget
5. `geminiService.ts` still works with no prompt override (backward compat)
6. `geminiService.ts` correctly uses override prompt when provided
7. `extractActionItems.ts` action checks for and uses intelligence config from trigger payload
8. `agentTriggerService.ts` loads meeting intelligence config and includes it in trigger payload
9. All new types compile without errors
10. No existing tests break

---

**Reference document with full type definitions, template examples, and architecture details:**
`/home/qntmecos/.openclaw/workspace/ENTOMATE_MEETING_INTELLIGENCE_PROFILES.md`

Read that file for the complete specification including all type definitions, the full Grant Specialist template, and architectural decisions.
