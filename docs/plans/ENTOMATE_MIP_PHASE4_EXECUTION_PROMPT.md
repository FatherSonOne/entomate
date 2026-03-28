# MIP Phase 4: Learning & Polish — Execution Prompt

## Mission

Build the **learning and self-improvement layer** for Meeting Intelligence Profiles. This phase makes the system smarter over time — tracking which profiles get used vs. dismissed, letting users create custom profiles, measuring profile effectiveness, and enabling profile export/import.

## What Phases 1–3 Already Built (DO NOT recreate)

**Phase 1 — Foundation:**
- `src/intelligence/types.ts` — All MIP types
- `src/intelligence/profileService.ts` — CRUD for profiles + meeting configs
- `src/intelligence/profileRegistry.ts` — Built-in profile templates + DB seeding
- `src/intelligence/promptBuilder.ts` — Dynamic prompt composition
- `src/intelligence/templates/` — 7 built-in profile templates
- `src/services/geminiService.ts` — Accepts optional `systemPrompt`
- DB: `intelligence_profiles`, `meeting_intelligence_config`, `intelligence_context_cache`

**Phase 2 — Context Assembly:**
- `src/intelligence/contextAssembler.ts` — Cross-app context gathering
- `src/intelligence/pulseFetcher.ts` — Pulse REST helper
- `src/agents/actions/prepareContext.ts` — Agent action
- `src/agents/triggers/meetingUpcoming.ts` — Trigger handler + `findUpcomingMeetingsNeedingContext()`
- Agent registry and trigger service wired

**Phase 3 — UI + Suggestions:**
- `src/intelligence/suggestionEngine.ts` — `suggestProfiles()`, `evaluateRule()`
- `src/components/intelligence/MeetingIntelligencePanel.tsx` — Main orchestrator panel
- `src/components/intelligence/ProfileSelector.tsx` — Grid picker
- `src/components/intelligence/ProfileCustomizer.tsx` — Dynamic form (all 7 field types)
- `src/components/intelligence/ContextPreview.tsx` — Assembled context display
- `src/components/intelligence/SuggestionBanner.tsx` — Auto-suggestion banner
- `src/components/MeetingsView.tsx` — Intelligence panel integrated

## What You're Building

### 1. Database Migration: Profile Analytics

Create `supabase/migrations/20260328_002_mip_analytics.sql`:

```sql
-- =====================================================
-- PROFILE USAGE ANALYTICS TABLE
-- Tracks suggestion → selection → completion pipeline
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_profile_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES intelligence_profiles(id),
    meeting_id UUID,
    
    -- Suggestion tracking
    was_suggested BOOLEAN DEFAULT false,
    suggestion_confidence REAL,              -- 0-1 confidence when suggested
    suggestion_accepted BOOLEAN,             -- Did user accept the suggestion?
    suggestion_dismissed BOOLEAN DEFAULT false,
    
    -- Usage tracking
    was_manually_selected BOOLEAN DEFAULT false,
    custom_fields_filled INTEGER DEFAULT 0,  -- How many custom fields user filled
    custom_fields_total INTEGER DEFAULT 0,
    additional_instructions_provided BOOLEAN DEFAULT false,
    
    -- Context assembly
    context_assembled BOOLEAN DEFAULT false,
    context_sources_count INTEGER DEFAULT 0,
    context_token_count INTEGER DEFAULT 0,
    
    -- Outcome metrics
    meeting_completed BOOLEAN DEFAULT false,
    meeting_duration_seconds INTEGER,
    action_items_extracted INTEGER DEFAULT 0,
    
    -- User feedback (optional post-meeting)
    user_rating INTEGER,                     -- 1-5 stars
    user_feedback TEXT,
    output_quality_score REAL,               -- Computed: based on action item count, summary length, etc.
    
    -- Timestamps
    suggested_at TIMESTAMPTZ,
    selected_at TIMESTAMPTZ,
    context_assembled_at TIMESTAMPTZ,
    meeting_completed_at TIMESTAMPTZ,
    feedback_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- PROFILE EFFECTIVENESS SUMMARY (materialized view-like)
-- Aggregated stats per profile for dashboard display
-- =====================================================
CREATE TABLE IF NOT EXISTS intelligence_profile_effectiveness (
    profile_id UUID PRIMARY KEY REFERENCES intelligence_profiles(id),
    
    -- Usage counts
    times_suggested INTEGER DEFAULT 0,
    times_accepted INTEGER DEFAULT 0,
    times_dismissed INTEGER DEFAULT 0,
    times_manually_selected INTEGER DEFAULT 0,
    times_completed INTEGER DEFAULT 0,
    
    -- Rates
    acceptance_rate REAL DEFAULT 0,           -- accepted / suggested
    completion_rate REAL DEFAULT 0,           -- completed / (accepted + manually_selected)
    
    -- Quality
    avg_user_rating REAL,
    avg_output_quality REAL,
    avg_action_items REAL,
    
    -- Context
    avg_context_sources REAL,
    avg_context_tokens REAL,
    
    last_used_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- =====================================================
-- INDEXES
-- =====================================================
CREATE INDEX idx_profile_analytics_profile ON intelligence_profile_analytics(profile_id);
CREATE INDEX idx_profile_analytics_meeting ON intelligence_profile_analytics(meeting_id);
CREATE INDEX idx_profile_analytics_created ON intelligence_profile_analytics(created_at);

-- =====================================================
-- RLS
-- =====================================================
ALTER TABLE intelligence_profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_profile_effectiveness ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view analytics"
    ON intelligence_profile_analytics FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Users can insert analytics"
    ON intelligence_profile_analytics FOR INSERT WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Users can update analytics"
    ON intelligence_profile_analytics FOR UPDATE USING (auth.role() = 'authenticated');

CREATE POLICY "Users can view effectiveness"
    ON intelligence_profile_effectiveness FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Service can manage effectiveness"
    ON intelligence_profile_effectiveness FOR ALL USING (auth.role() = 'authenticated');
```

### 2. `src/intelligence/analyticsService.ts` — Usage Tracking

Track profile usage events through the suggestion → selection → completion pipeline.

```typescript
// ==================== EVENT TRACKING ====================

/** Call when suggestion engine runs for a meeting */
export async function trackSuggestion(
  meetingId: string,
  profileId: string,
  confidence: number
): Promise<string>  // returns analytics record ID

/** Call when user accepts a suggested profile */
export async function trackAccepted(
  analyticsId: string
): Promise<void>

/** Call when user dismisses a suggestion */
export async function trackDismissed(
  analyticsId: string
): Promise<void>

/** Call when user manually selects a profile (not from suggestion) */
export async function trackManualSelection(
  meetingId: string,
  profileId: string
): Promise<string>

/** Call when context is assembled */
export async function trackContextAssembled(
  analyticsId: string,
  sourcesCount: number,
  tokenCount: number
): Promise<void>

/** Call when meeting completes with an intelligence profile */
export async function trackMeetingCompleted(
  meetingId: string,
  durationSeconds: number,
  actionItemCount: number
): Promise<void>

/** Call when user provides post-meeting feedback */
export async function trackFeedback(
  meetingId: string,
  rating: number,       // 1-5
  feedback?: string
): Promise<void>

// ==================== EFFECTIVENESS AGGREGATION ====================

/** Recompute effectiveness stats for a profile */
export async function updateProfileEffectiveness(
  profileId: string
): Promise<void>

/** Recompute effectiveness for ALL profiles */
export async function updateAllProfileEffectiveness(): Promise<void>

/** Get effectiveness summary for a profile */
export async function getProfileEffectiveness(
  profileId: string
): Promise<ProfileEffectiveness | null>

/** Get effectiveness for all profiles (dashboard) */
export async function getAllProfileEffectiveness(): Promise<ProfileEffectiveness[]>

/** Compute an output quality score from meeting results */
export function computeOutputQuality(meeting: {
  summary?: string;
  actionItemCount: number;
  keyPointsCount: number;
  decisionsCount: number;
  durationSeconds: number;
}): number  // 0-1 score
```

**Output quality scoring heuristic:**
- Base score: 0.5
- +0.1 if summary exists and > 100 chars
- +0.1 if action items > 0
- +0.05 for each additional action item (cap at +0.15)
- +0.05 if key points > 2
- +0.05 if decisions > 0
- +0.05 if meeting duration > 5 min (indicates real content)
- Cap at 1.0

**Integration points — wire tracking calls into existing code:**

1. **`src/intelligence/suggestionEngine.ts`** — After `suggestProfiles()` returns, call `trackSuggestion()` for the top suggestion
2. **`src/components/intelligence/MeetingIntelligencePanel.tsx`** — Call `trackAccepted()` on accept, `trackDismissed()` on dismiss, `trackManualSelection()` on manual select, `trackContextAssembled()` after context assembly
3. **`src/agents/agentTriggerService.ts`** — In `fireMeetingCompletedTrigger()`, after processing, call `trackMeetingCompleted()`

### 3. `src/components/intelligence/CreateProfileModal.tsx` — Custom Profile Creator

A modal/drawer for creating user-defined intelligence profiles.

**Props:**
```typescript
interface CreateProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreated: (profile: IntelligenceProfile) => void;
  templateProfile?: IntelligenceProfile;  // Optional: clone from existing
}
```

**Form fields:**

| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Name | text | ✅ | e.g., "Investor Update" |
| Slug | text (auto-generated) | ✅ | Auto-generates from name, editable |
| Icon | emoji picker | optional | Default: 🤖 — use a simple grid of ~20 common emojis |
| Category | select | ✅ | meetings, sales, operations, grants, hr, custom |
| Description | textarea | ✅ | Brief description of what this profile does |
| Tone | select | ✅ | formal, casual, balanced |
| System Prompt Template | textarea (large) | ✅ | With explanation of `{{variable}}` placeholders |
| Custom Fields | dynamic list | optional | Add/remove field definitions (key, label, type, required, placeholder) |
| Focus Areas | dynamic list | optional | Add/remove focus areas (label, description, weight slider) |
| Context Sources | multiselect | ✅ | contacts, org_info, crm_deals, past_meetings, pulse_history, tasks, notes |
| Context Depth | select | ✅ | minimal, standard, deep |
| Suggestion Keywords | tag input | optional | Keywords that trigger auto-suggestion |

**Layout:**
- Multi-step wizard OR scrollable modal with sections
- Section headers with the `font-mono text-xs uppercase tracking-wider` pattern
- "Clone from existing" option at top — pre-fills all fields from `templateProfile`
- Live preview panel showing how the system prompt template looks with sample values
- Save button calls `createProfile()` from `profileService.ts`

**Slug auto-generation:**
```typescript
function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
```

**Template variable help:**
Show a collapsible reference of available template variables:
- `{{participant_context}}` — Auto-filled with participant info
- `{{past_meeting_context}}` — Auto-filled with past meeting data
- `{{focus_areas}}` — Auto-filled from configured focus areas
- `{{tone}}` — Auto-filled from tone setting
- `{{output_style}}` — Auto-filled from output format
- `{{additional_instructions}}` — User-provided per-meeting
- `{{#if variable}}...{{/if}}` — Conditional blocks
- Any custom field key as `{{field_key}}`

### 4. `src/components/intelligence/ProfileEffectivenessCard.tsx` — Metrics Display

Shows effectiveness metrics for a single profile.

**Props:**
```typescript
interface ProfileEffectivenessCardProps {
  profileId: string;
  profileName: string;
  profileIcon: string;
  effectiveness: ProfileEffectiveness;
}
```

**Displays:**
- Acceptance rate as a percentage + mini bar
- Completion rate as a percentage + mini bar
- Average user rating as stars (1-5)
- Average output quality as a colored bar (red → yellow → green)
- Total uses count
- Last used date
- "Most common feedback" snippet (if feedback exists)

**Styling:**
- Compact card format, fits in a grid
- Use `var(--accent-secondary)` for positive metrics
- Use `var(--accent-tertiary)` for medium metrics
- Use `var(--semantic-error)` for low metrics
- Mini sparkline-style bars (CSS only, no charting library needed)

### 5. `src/components/intelligence/ProfileFeedbackPrompt.tsx` — Post-Meeting Feedback

A small inline prompt that appears after a meeting with an intelligence profile completes.

**Props:**
```typescript
interface ProfileFeedbackPromptProps {
  meetingId: string;
  profileName: string;
  profileIcon: string;
  onSubmit: (rating: number, feedback?: string) => void;
  onDismiss: () => void;
}
```

**Renders:**
- "How helpful was the {profileName} profile for this meeting?"
- 5-star rating (clickable stars or emoji)
- Optional: short text feedback field (appears after rating)
- Submit + Dismiss buttons
- Subtle animation on entry

**Integration:** Show this in `MeetingsView.tsx` after a meeting with an intelligence config completes processing. Check if `meeting_intelligence_config.status === 'completed'` and no feedback exists yet in analytics.

### 6. `src/components/intelligence/ProfileManagementPanel.tsx` — Profile Library

A settings/admin panel for managing all intelligence profiles.

**Shows:**
- Grid/list of all profiles (built-in + custom)
- Each card shows: icon, name, category badge, usage count, effectiveness score
- Built-in profiles: view-only (can clone but not edit)
- Custom profiles: edit, delete (soft), duplicate
- "Create New Profile" button → opens `CreateProfileModal`
- Filter by category
- Sort by: name, usage count, effectiveness, last used

**Actions per profile:**
- **View/Edit** — Opens `CreateProfileModal` in edit mode (custom only)
- **Clone** — Opens `CreateProfileModal` with `templateProfile` pre-filled
- **Export** — Downloads profile as JSON
- **Delete** — Soft-delete via `deleteProfile()` (custom only, with confirmation)

**Integration:** This panel should be accessible from the app's Settings page. Add a "Meeting Intelligence" section/tab in `src/pages/Settings.tsx` (or wherever settings live).

### 7. Profile Export/Import

**Export** (`src/intelligence/profileExport.ts`):

```typescript
export interface ExportedProfile {
  version: 1;
  exportedAt: string;
  profile: Omit<IntelligenceProfile, 'id' | 'createdAt' | 'updatedAt' | 'createdBy'>;
}

/** Export a profile as a JSON object */
export function exportProfile(profile: IntelligenceProfile): ExportedProfile

/** Export a profile and trigger browser download */
export function downloadProfile(profile: IntelligenceProfile): void

/** Validate an imported profile JSON */
export function validateImport(data: unknown): { valid: boolean; errors: string[] }

/** Import a profile from JSON, creating it in the DB */
export async function importProfile(data: ExportedProfile): Promise<IntelligenceProfile | null>
```

**Export format:**
```json
{
  "version": 1,
  "exportedAt": "2026-03-28T12:00:00Z",
  "profile": {
    "name": "Grant Specialist",
    "slug": "grant-specialist-custom",
    "description": "...",
    "icon": "📋",
    "category": "grants",
    "systemPromptTemplate": "...",
    "customFields": [...],
    "focusAreas": [...],
    "tone": "formal",
    "outputFormat": {...},
    "contextSources": [...],
    "contextDepth": "deep",
    "suggestWhen": [...]
  }
}
```

**Import validation:**
- Check `version === 1`
- Check required fields exist (name, slug, systemPromptTemplate)
- Check slug doesn't conflict with existing profiles (append `-imported` if conflict)
- Check customFields are valid CustomFieldDef objects
- Check contextSources are valid ContextSource values

**Import UI:** An "Import Profile" button in `ProfileManagementPanel` that opens a file picker or drag-drop zone for JSON files.

### 8. Wire Feedback Loop into Suggestion Engine

**Modify `src/intelligence/suggestionEngine.ts`:**

After the basic rule-based scoring, apply a **boost/penalty based on historical effectiveness**:

```typescript
// After calculating base confidence from rules...

// Boost from effectiveness data
const effectiveness = await getProfileEffectiveness(profile.id);
if (effectiveness) {
  // Boost profiles with high acceptance rates
  if (effectiveness.acceptanceRate > 0.7 && effectiveness.timesCompleted > 3) {
    confidence = Math.min(1.0, confidence * 1.1);
  }
  
  // Penalize profiles that frequently get dismissed
  if (effectiveness.timesDismissed > effectiveness.timesAccepted && effectiveness.timesSuggested > 5) {
    confidence *= 0.8;
  }
  
  // Boost profiles with high user ratings
  if (effectiveness.avgUserRating && effectiveness.avgUserRating >= 4.0) {
    confidence = Math.min(1.0, confidence * 1.05);
  }
}
```

This creates the learning loop: profiles that users consistently accept and rate highly get suggested more confidently. Profiles that get dismissed frequently get suggested less.

### 9. Update `src/intelligence/index.ts`

Add new exports:

```typescript
// Analytics & Learning
export {
  trackSuggestion,
  trackAccepted,
  trackDismissed,
  trackManualSelection,
  trackContextAssembled,
  trackMeetingCompleted,
  trackFeedback,
  updateProfileEffectiveness,
  getAllProfileEffectiveness,
  getProfileEffectiveness,
  computeOutputQuality,
} from './analyticsService';

// Profile Export/Import
export {
  exportProfile,
  downloadProfile,
  validateImport,
  importProfile,
} from './profileExport';
```

## Styling Guidelines (same as Phase 3)

Use Void × Crimson CSS variables throughout. Reference:
- `var(--bg-base)`, `var(--bg-surface)`, `var(--bg-elevated)` for backgrounds
- `var(--accent-primary)` (#FF2D6B) for primary actions
- `var(--accent-secondary)` (#00F5D4) for success/positive
- `var(--accent-tertiary)` (#FFB800) for warnings/medium
- `var(--text-primary)`, `var(--text-secondary)`, `var(--text-tertiary)` for text
- `var(--border-subtle)` for borders
- Labels: `font-mono text-xs uppercase tracking-wider`
- Buttons: `rounded-lg` or `rounded-full` with transitions

Follow patterns from existing Phase 3 components (`MeetingIntelligencePanel.tsx`, `ContextPreview.tsx`).

## Files to READ for Patterns

| File | Why |
|------|-----|
| `src/components/intelligence/MeetingIntelligencePanel.tsx` | Main panel — wire feedback prompt here |
| `src/components/intelligence/ProfileSelector.tsx` | Profile card pattern |
| `src/components/intelligence/ProfileCustomizer.tsx` | Dynamic form pattern for custom field editor |
| `src/intelligence/suggestionEngine.ts` | Where to add effectiveness boost |
| `src/intelligence/profileService.ts` | CRUD operations to use |
| `frontend/src/components/learning/LearningDashboard.jsx` | Existing learning/metrics UI patterns |
| `frontend/src/components/learning/FeedbackPrompt.jsx` | Existing feedback prompt pattern |
| `frontend/src/components/learning/EffectivenessReport.jsx` | Existing effectiveness display pattern |
| `frontend/src/components/vc/ConfirmDialog.jsx` | Confirmation dialog for delete actions |
| `frontend/src/components/vc/ToastProvider.jsx` | Toast notifications for save/import/export |

## Definition of Done

- [ ] `supabase/migrations/20260328_002_mip_analytics.sql` — Analytics tables + indexes + RLS
- [ ] `src/intelligence/analyticsService.ts` — Full tracking + effectiveness aggregation
- [ ] `src/intelligence/profileExport.ts` — Export/import with validation
- [ ] `src/components/intelligence/CreateProfileModal.tsx` — Custom profile creator with all field types
- [ ] `src/components/intelligence/ProfileEffectivenessCard.tsx` — Metrics display card
- [ ] `src/components/intelligence/ProfileFeedbackPrompt.tsx` — Post-meeting rating prompt
- [ ] `src/components/intelligence/ProfileManagementPanel.tsx` — Profile library with CRUD + export/import
- [ ] `src/intelligence/suggestionEngine.ts` — Updated with effectiveness-based boost/penalty
- [ ] `src/intelligence/index.ts` — Updated with all new exports
- [ ] Tracking calls wired into: suggestion engine, MeetingIntelligencePanel, agentTriggerService
- [ ] Feedback prompt appears after meetings with intelligence profiles complete
- [ ] Profile management accessible from Settings page
- [ ] Export downloads valid JSON; import validates and creates profile
- [ ] Clone from existing profile works (pre-fills create form)
- [ ] Built-in profiles are read-only (can clone but not edit/delete)
- [ ] Effectiveness data feeds back into suggestion confidence scoring
- [ ] All components use Void × Crimson CSS variables
