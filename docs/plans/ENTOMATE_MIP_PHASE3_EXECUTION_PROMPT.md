# MIP Phase 3: Smart Suggestions + UI — Execution Prompt

## Mission

Build the **Suggestion Engine** and the full **Meeting Intelligence Panel UI**. This phase makes MIP visible and usable — users will see profile suggestions, pick/customize profiles, preview assembled context, and configure intelligence before meetings start.

## What Phase 1 & 2 Already Built (DO NOT recreate)

| File | What It Does |
|------|-------------|
| `src/intelligence/types.ts` | All MIP types — `IntelligenceProfile`, `ProfileSuggestion`, `SuggestionRule`, `AssembledContext`, `MeetingIntelligenceConfig`, `CustomFieldDef`, `FocusArea`, etc. |
| `src/intelligence/profileService.ts` | CRUD: `getActiveProfiles()`, `getProfileBySlug()`, `getProfileById()`, `getBuiltinProfiles()`, `createProfile()`, `updateProfile()`, `deleteProfile()`, `getMeetingIntelligenceConfig()`, `saveMeetingIntelligenceConfig()` |
| `src/intelligence/profileRegistry.ts` | `getDefaultProfiles()`, `seedBuiltinProfiles()` |
| `src/intelligence/promptBuilder.ts` | `buildMeetingPrompt()`, `buildDefaultPrompt()` |
| `src/intelligence/contextAssembler.ts` | `assembleContext()`, `getCachedContext()`, `setCachedContext()`, `clearExpiredCache()` |
| `src/intelligence/pulseFetcher.ts` | Pulse REST query helper |
| `src/intelligence/templates/` | 7 built-in profiles with `suggestWhen` rules defined |
| `src/intelligence/index.ts` | Barrel exports for all of the above |
| `src/agents/actions/prepareContext.ts` | Agent action for context assembly |
| `src/agents/triggers/meetingUpcoming.ts` | Trigger handler + `findUpcomingMeetingsNeedingContext()` |
| `src/agents/agentRegistry.ts` | Both trigger and action registered |
| `src/agents/agentTriggerService.ts` | `fireMeetingUpcomingTrigger()` + `fireMeetingCompletedTrigger()` (passes intelligence config) |
| `src/services/geminiService.ts` | `summarizeMeeting()`, `extractActionItems()`, `askAboutMeeting()` — all accept optional `systemPrompt` |
| DB tables | `intelligence_profiles`, `meeting_intelligence_config`, `intelligence_context_cache` (with RLS, indexes, seed data) |

## What You're Building

### 1. `src/intelligence/suggestionEngine.ts` — Auto-Suggest Profiles

**Purpose:** Given a meeting's metadata (title, description, tags, participants), match against all active profiles' `suggestWhen` rules and return ranked suggestions.

```typescript
export async function suggestProfiles(meeting: {
  title: string;
  description?: string;
  tags?: string[];
  participants?: string[];
  attendees?: string[];
}): Promise<ProfileSuggestion[]>
```

**Algorithm:**

1. Load all active profiles via `getActiveProfiles()`
2. For each profile, evaluate its `suggestWhen` rules against the meeting:

   - **`keyword` rule:** Check if any `match` words appear in the meeting's title or description (case-insensitive). Partial word match is fine (e.g., "grant" matches "Grant Proposal Review").
   
   - **`participant` rule:** Check if any `match` values appear in the participant list.
   
   - **`tag` rule:** Check if any `match` values appear in the meeting's tags array.
   
   - **`recurring` rule:** Check if the meeting title/description contains recurrence keywords like "weekly", "daily", "biweekly", "monthly".
   
   - **`org_type` rule:** If participant data includes org info (from CRM), match against org type. For now, this can be a keyword match against description/title as a heuristic (e.g., "nonprofit" in meeting context → matches org_type rule).

3. For each profile, calculate a composite confidence score:
   - Start with 0
   - For each matched rule, add `rule.confidence * ruleWeight`
   - `ruleWeight` for keyword matches: number of keywords matched / total keywords in rule
   - Cap at 1.0
   - If multiple rules match, use the highest single-rule confidence as a floor, then boost slightly for each additional match

4. Filter out profiles with confidence < 0.3
5. Sort by confidence descending
6. Return as `ProfileSuggestion[]` with `reason` explaining why (e.g., "Title contains 'grant proposal'")

**Also export:**

```typescript
export function evaluateRule(
  rule: SuggestionRule,
  meeting: { title: string; description?: string; tags?: string[]; participants?: string[] }
): { matched: boolean; confidence: number; reason: string }
```

This helper is useful for testing and for showing users _why_ a profile was suggested.

### 2. UI Components

All UI components use the **Void × Crimson** brand design system. Key reference:

- **Brand colors:** Electric Crimson `#FF2D6B`, Neon Mint `#00F5D4`, Amber `#FFB800`
- **Backgrounds:** True black voids — `var(--bg-base)`, `var(--bg-surface)`, `var(--bg-elevated)`
- **Fonts:** `var(--font-display)` for headings (Syne), `var(--font-body)` for text (Space Grotesk), `var(--font-mono)` for labels
- **Radius:** `var(--radius-md)` = 8px, `var(--radius-lg)` = 12px
- **Existing components in `frontend/src/components/vc/`:** `ConfirmDialog.jsx`, `ErrorState.jsx`, `ToastProvider.jsx`, `VCCanvas.jsx` — follow these patterns for consistency
- **Use CSS variables** from `frontend/src/styles/themes/void-crimson.css`, NOT hardcoded hex values
- **Component location:** New components go in `frontend/src/components/intelligence/` (NOT in `src/components/` — that's a different directory)

Wait — actually let me clarify the directory structure. There are TWO component trees:

- **`src/components/`** — Contains `MeetingsView.tsx` and other TypeScript components (this is the main app)
- **`frontend/src/components/`** — Contains VC components and JSX files

Since `MeetingsView.tsx` lives in `src/components/`, the new intelligence UI components should also live in `src/components/intelligence/` to stay co-located. Use `.tsx` extension to match the existing pattern.

However, **use the Void × Crimson CSS variables** from the theme — they're available globally.

#### 2a. `src/components/intelligence/MeetingIntelligencePanel.tsx`

The main panel component. Renders on meeting detail views.

**Props:**
```typescript
interface MeetingIntelligencePanelProps {
  meetingId: string;
  meetingTitle: string;
  meetingDescription?: string;
  meetingTags?: string[];
  meetingParticipants?: string[];
  onConfigSaved?: (config: MeetingIntelligenceConfig) => void;
}
```

**Behavior:**

1. On mount, load `getMeetingIntelligenceConfig(meetingId)`
2. If no config exists, run `suggestProfiles()` to get suggestions
3. Display the panel with these sections:

**Layout (top to bottom):**

```
┌─────────────────────────────────────────────────┐
│ 🤖 Meeting Intelligence                    [?]  │
│                                                  │
│ ┌─ Suggestion Banner (if suggestions exist) ──┐ │
│ │ 📋 Grant Specialist — 92% match             │ │
│ │ "Title contains 'grant proposal'"           │ │
│ │ [Accept] [Customize] [Dismiss]              │ │
│ └─────────────────────────────────────────────┘ │
│                                                  │
│ Or choose a profile:                             │
│ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐  │
│ │ 📋   │ │ 🎯   │ │ 🤝   │ │ 🏛️   │ │ ⚡   │  │
│ │Grant │ │Sales │ │Client│ │Board │ │Stand │  │
│ └──────┘ └──────┘ └──────┘ └──────┘ └──────┘  │
│                                                  │
│ ─── Profile Details (when selected) ──────────  │
│ Description text...                              │
│                                                  │
│ ─── Custom Fields ────────────────────────────  │
│ (ProfileCustomizer renders here)                 │
│                                                  │
│ ─── Context Preview ─────────────────────────── │
│ (ContextPreview renders here when assembled)     │
│                                                  │
│ Additional Instructions: (optional)              │
│ [                                           ]    │
│                                                  │
│ [Save & Prepare Context]  [Clear Profile]        │
└─────────────────────────────────────────────────┘
```

**States:**
- **No profile selected** — Show suggestions + profile grid
- **Profile selected, config pending** — Show custom fields form + "Save & Prepare Context" button
- **Config saved, context pending** — Show loading spinner on context section
- **Context ready** — Show full context preview + composed prompt preview (collapsible)
- **Dismissed** — Minimized to a small "Configure Intelligence" link

**Save flow:**
1. User selects profile + fills custom fields
2. Click "Save & Prepare Context"
3. Call `saveMeetingIntelligenceConfig()` with profile_id, custom_field_values, additional_instructions
4. Then call `assembleContext(meetingId, profile)` (or just update status to 'pending' and let the trigger handle it)
5. Show assembled context when ready
6. Compose prompt via `buildMeetingPrompt()` and save to config

#### 2b. `src/components/intelligence/ProfileSelector.tsx`

Grid of profile cards for selection.

**Props:**
```typescript
interface ProfileSelectorProps {
  profiles: IntelligenceProfile[];
  selectedProfileId?: string | null;
  suggestions?: ProfileSuggestion[];
  onSelect: (profile: IntelligenceProfile) => void;
}
```

**Renders:**
- Grid of cards (responsive: 2 cols on small, 3-4 on large)
- Each card shows: icon, name, short description
- Suggested profiles have a glow border + confidence badge
- Selected profile has an accent border (crimson)
- Hover effect with subtle scale/glow

#### 2c. `src/components/intelligence/ProfileCustomizer.tsx`

Dynamic form that renders the selected profile's `customFields`.

**Props:**
```typescript
interface ProfileCustomizerProps {
  profile: IntelligenceProfile;
  values: Record<string, any>;
  onChange: (values: Record<string, any>) => void;
}
```

**Renders each field based on `CustomFieldDef.type`:**
- `text` → Single-line input
- `textarea` → Multi-line textarea
- `select` → Dropdown select
- `multiselect` → Multi-select (checkboxes or tag-style)
- `date` → Date picker input
- `number` → Number input
- `toggle` → Toggle switch

**Show:**
- Field label + optional required indicator
- Placeholder text from field def
- Help text tooltip (if `helpText` exists)
- Validation: highlight required fields that are empty on save attempt

#### 2d. `src/components/intelligence/ContextPreview.tsx`

Shows the assembled context in a readable format.

**Props:**
```typescript
interface ContextPreviewProps {
  context: AssembledContext | null;
  isLoading?: boolean;
  onRefresh?: () => void;
}
```

**Renders (when context is available):**
- Source badges: "👤 3 contacts from CRM" / "📧 5 Pulse threads" / "📅 2 past meetings" / "✅ 4 open tasks"
- Collapsible sections for each context type:
  - **Participants:** Name, role, org, meeting count, notes
  - **Organization:** Name, active deals, total meetings
  - **Past Meetings:** Title, date, summary snippet, open items count
  - **Conversations:** Channel, message count, last activity
  - **Tasks:** Title, status, assignee, due date, priority badge
- Token budget indicator: "~1,200 / 4,000 tokens"
- "Refresh Context" button
- Loading state: skeleton/pulse animation

**When context is null / loading:**
- Show skeleton placeholders
- Or "Context will be assembled when you save the profile configuration"

#### 2e. `src/components/intelligence/SuggestionBanner.tsx`

The top suggestion banner that appears when auto-suggest finds a match.

**Props:**
```typescript
interface SuggestionBannerProps {
  suggestion: ProfileSuggestion;
  onAccept: () => void;
  onCustomize: () => void;
  onDismiss: () => void;
}
```

**Renders:**
- Profile icon + name + confidence percentage
- Reason text (why it was suggested)
- Three action buttons: Accept (fills defaults), Customize (selects profile, opens form), Dismiss (hides banner)
- Subtle animated entrance (fade-in + slide-down)
- Accent glow on high-confidence suggestions (>80%)

### 3. Integration into `src/components/MeetingsView.tsx`

**Modify MeetingsView.tsx to include the MeetingIntelligencePanel:**

1. Import `MeetingIntelligencePanel` from `./intelligence/MeetingIntelligencePanel`
2. In the `renderMeetingDetails()` function (line ~323), add the panel between the meeting title/metadata and the summary section
3. Also add it in the "record" view — after a meeting title is set but before recording starts, show a collapsed version ("Set up intelligence profile for this meeting")
4. Pass through: `meetingId`, `meetingTitle`, `meetingDescription`, `meetingTags`, `meetingParticipants`

**Where exactly to insert:**

In `renderMeetingDetails()` (used for both past meetings and just-processed meetings), add after the title/date header and before the summary section:

```tsx
{/* Meeting Intelligence Panel */}
<MeetingIntelligencePanel
  meetingId={meeting.id}
  meetingTitle={meeting.title}
  meetingTags={meeting.tags}
  meetingParticipants={meeting.attendees || meeting.participants}
/>
```

### 4. Update `src/intelligence/index.ts`

Add new exports:

```typescript
// Suggestion Engine
export {
  suggestProfiles,
  evaluateRule,
} from './suggestionEngine';
```

## Styling Guidelines

**DO use Void × Crimson CSS variables:**
```css
/* Backgrounds */
var(--bg-base)          /* Deepest void */
var(--bg-surface)       /* Card backgrounds */
var(--bg-elevated)      /* Elevated surfaces */

/* Accent colors */
var(--accent-primary)        /* #FF2D6B — Electric Crimson */
var(--accent-primary-dim)    /* Subtle crimson tint for backgrounds */
var(--accent-primary-glow)   /* Glow effects */
var(--accent-secondary)      /* #00F5D4 — Neon Mint (success, context ready) */
var(--accent-secondary-dim)  /* Subtle mint backgrounds */
var(--accent-tertiary)       /* #FFB800 — Amber (warnings, confidence scores) */

/* Text */
var(--text-primary)     /* Main text */
var(--text-secondary)   /* Muted text */
var(--text-tertiary)    /* Very muted */

/* Borders */
var(--border-subtle)    /* Default borders */
var(--border-emphasis)  /* Emphasized borders */
```

**Component patterns to follow:**
- Use Tailwind utility classes for layout (flex, grid, spacing, responsive)
- Use CSS variables for colors via inline styles or custom classes: `style={{ background: 'var(--bg-surface)' }}`
- Or use Tailwind's arbitrary value syntax: `bg-[var(--bg-surface)]`
- Cards: `rounded-xl` or `rounded-2xl` with subtle borders
- Labels: `font-mono text-xs uppercase tracking-wider` (matches existing pattern)
- Buttons: rounded-full for pill buttons, rounded-lg for rectangular
- Transitions: `transition-all duration-200` for hover effects
- Hover glow: `hover:shadow-[0_0_20px_var(--accent-primary-glow)]`

**Responsive:**
- Profile grid: `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3`
- Panel: full width, stacks vertically on mobile
- Context sections: collapsible on mobile

## Key Types Reference (from `src/intelligence/types.ts`)

```typescript
interface ProfileSuggestion {
  profile: IntelligenceProfile;
  confidence: number;        // 0-1
  reason: string;            // "Meeting title contains 'grant'"
  matchedRules: SuggestionRule[];
}

interface SuggestionRule {
  type: 'keyword' | 'participant' | 'tag' | 'recurring' | 'org_type';
  match: string | string[];
  confidence: number;        // 0-1
}

type CustomFieldType = 'text' | 'textarea' | 'select' | 'multiselect' | 'date' | 'number' | 'toggle';

interface CustomFieldDef {
  key: string;
  label: string;
  type: CustomFieldType;
  required: boolean;
  placeholder?: string;
  helpText?: string;
  options?: { value: string; label: string }[];
  defaultValue?: any;
}
```

## Files to READ for patterns (don't modify unless specified)

| File | Why |
|------|-----|
| `src/components/MeetingsView.tsx` | Integration target — understand the layout and state management |
| `frontend/src/components/vc/ConfirmDialog.jsx` | VC component pattern reference |
| `frontend/src/components/vc/ToastProvider.jsx` | VC toast pattern |
| `frontend/src/components/vc/ErrorState.jsx` | VC error state pattern |
| `frontend/src/styles/themes/void-crimson.css` | All CSS variables |
| `frontend/src/styles/vc-components.css` | VC component base styles |
| `frontend/src/components/intelligence/IntelligenceDashboard.jsx` | Existing intelligence UI — follow similar patterns |

## Definition of Done

- [ ] `src/intelligence/suggestionEngine.ts` exists with `suggestProfiles()` and `evaluateRule()`
- [ ] `src/components/intelligence/MeetingIntelligencePanel.tsx` — main panel component
- [ ] `src/components/intelligence/ProfileSelector.tsx` — profile grid picker
- [ ] `src/components/intelligence/ProfileCustomizer.tsx` — dynamic custom field form
- [ ] `src/components/intelligence/ContextPreview.tsx` — assembled context display
- [ ] `src/components/intelligence/SuggestionBanner.tsx` — auto-suggestion banner
- [ ] `src/components/MeetingsView.tsx` — updated with intelligence panel integration
- [ ] `src/intelligence/index.ts` — updated with suggestion engine exports
- [ ] All components use Void × Crimson CSS variables (no hardcoded colors)
- [ ] Suggestion engine correctly evaluates all 5 rule types
- [ ] Custom field form renders all 7 field types
- [ ] Context preview shows all context types with collapsible sections
- [ ] Save flow works: select profile → fill fields → save → assemble context → show preview
- [ ] Graceful handling when no profiles exist or context assembly fails
- [ ] Responsive layout (works on both desktop and mobile widths)
