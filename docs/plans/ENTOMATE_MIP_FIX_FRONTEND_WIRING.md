# MIP Fix: Wire Phase 4 Components into Live Frontend

## Problem

The MIP Phase 4 components were created as TypeScript (`.tsx`) files in `src/components/intelligence/`, but the live Entomate frontend runs from `frontend/src/` using JSX. As a result, these components exist but are **invisible in the UI**:

- `ProfileManagementPanel` — not in Settings
- `ProfileFeedbackPrompt` — not shown after meeting completion
- `CreateProfileModal` — only consumed by ProfileManagementPanel (which is itself invisible)
- `ProfileEffectivenessCard` — same

The MeetingIntelligencePanel was correctly ported to JSX in `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` and is visible. The same needs to happen for the Phase 4 components.

## Architecture Context

**Two component trees exist:**
- `src/` — TypeScript modules (intelligence services, types, agent framework)
- `frontend/src/` — Live JSX frontend (pages, components, routing, Vite build)

**The frontend JSX components query Supabase directly** — they use `import { supabase } from '../../services/supabaseClient'` and make inline queries. They do NOT import from `src/intelligence/` because those are TypeScript modules outside the frontend build.

**Reference:** `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` shows exactly how to do this — it has inline suggestion logic and direct Supabase queries. Follow this pattern.

## Tasks

### 1. Create `frontend/src/components/intelligence/ProfileManagementPanel.jsx`

Port `src/components/intelligence/ProfileManagementPanel.tsx` to JSX.

**Key changes from TSX → JSX:**
- Remove all TypeScript types/interfaces
- Import `supabase` from `../../services/supabaseClient` instead of from `../../intelligence/profileService`
- Replace `getActiveProfiles()` with inline: `supabase.from('intelligence_profiles').select('*').eq('is_active', true).order('name')`
- Replace `getAllProfileEffectiveness()` with inline: `supabase.from('intelligence_profile_effectiveness').select('*')`
- Replace `deleteProfile(id)` with inline: `supabase.from('intelligence_profiles').update({ is_active: false }).eq('id', id)`
- Profile export: inline `downloadProfile()` — serialize profile to JSON, create blob URL, trigger download
- Profile import: inline `validateImport()` + `importProfile()` — validate JSON shape, insert via `supabase.from('intelligence_profiles').insert()`
- Import `CreateProfileModal` and `ProfileEffectivenessCard` from local directory (once created)
- Use Lucide icons: `import { Plus, Download, Upload, Edit3, Copy, Trash2, Star } from 'lucide-react'`

**Map ProfileEffectiveness from DB row:**
```javascript
// DB column names (snake_case) → JS usage
const eff = {
  profileId: row.profile_id,
  timesSuggested: row.times_suggested,
  timesAccepted: row.times_accepted,
  timesDismissed: row.times_dismissed,
  timesManuallySelected: row.times_manually_selected,
  timesCompleted: row.times_completed,
  acceptanceRate: row.acceptance_rate,
  completionRate: row.completion_rate,
  avgUserRating: row.avg_user_rating,
  avgOutputQuality: row.avg_output_quality,
  lastUsedAt: row.last_used_at,
}
```

### 2. Create `frontend/src/components/intelligence/CreateProfileModal.jsx`

Port `src/components/intelligence/CreateProfileModal.tsx` to JSX.

**Key changes:**
- Remove types
- Replace `createProfile()` / `updateProfile()` with inline Supabase queries:
  - Create: `supabase.from('intelligence_profiles').insert([{...}]).select().single()`
  - Update: `supabase.from('intelligence_profiles').update({...}).eq('id', id).select().single()`
- Slug auto-generation: keep the inline `generateSlug()` function as-is
- The modal backdrop, form fields, dynamic custom field editor, focus area editor — all port directly, just strip types

### 3. Create `frontend/src/components/intelligence/ProfileEffectivenessCard.jsx`

Port `src/components/intelligence/ProfileEffectivenessCard.tsx` to JSX.

This is a simple presentational component — straightforward port. Just strip TypeScript types. It receives `profileName`, `profileIcon`, `effectiveness` as props. The `MetricBar` sub-component ports directly.

### 4. Create `frontend/src/components/intelligence/ProfileFeedbackPrompt.jsx`

Port `src/components/intelligence/ProfileFeedbackPrompt.tsx` to JSX.

Simple presentational component — strip types. Receives `meetingId`, `profileName`, `profileIcon`, `onSubmit`, `onDismiss`.

### 5. Wire `ProfileManagementPanel` into Settings

**Modify `frontend/src/pages/Settings.jsx`:**

1. Add import at top:
```javascript
import ProfileManagementPanel from '../components/intelligence/ProfileManagementPanel'
```

2. Add a new `activeSection === 'intelligence-profiles'` handler, following the exact same pattern as the `ai-learning` section (around line 119):
```javascript
if (activeSection === 'intelligence-profiles') {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <VCButton variant="ghost" size="sm" onClick={() => setActiveSection('settings')}>
          <ArrowLeft className="w-4 h-4" />
          Back to Settings
        </VCButton>
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)', fontFamily: 'var(--font-display)' }}>
            Meeting Intelligence Profiles
          </h1>
          <p style={{ color: 'var(--text-secondary)' }}>Manage and customize AI meeting profiles</p>
        </div>
      </div>
      <ProfileManagementPanel />
    </div>
  )
}
```

3. Add a new section card in the main settings view (after the "AI Learning" section, around line 200), following the same card pattern:
```jsx
{/* Meeting Intelligence Profiles */}
<div className="vc">
  <div className="p-4" style={{ borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))' }}>
    <div className="flex items-center gap-2">
      <Brain className="w-5 h-5" style={{ color: 'var(--accent-primary, #FF2D6B)' }} />
      <h2 className="font-semibold" style={{ fontFamily: 'var(--font-display)', fontWeight: 600, color: 'var(--text-primary)', fontSize: 14 }}>
        Meeting Intelligence
      </h2>
    </div>
    <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
      Configure AI specialization profiles for different meeting types
    </p>
  </div>
  <div className="p-5">
    <p className="text-sm mb-4" style={{ color: 'var(--text-secondary)' }}>
      Create, customize, and manage intelligence profiles that shape how Entomate's AI processes meetings. Built-in profiles for grants, sales, board meetings, and more.
    </p>
    <VCButton variant="primary" onClick={() => setActiveSection('intelligence-profiles')}>
      <Brain className="w-4 h-4" />
      Manage Profiles
    </VCButton>
  </div>
</div>
```

### 6. Wire `ProfileFeedbackPrompt` into `MeetingDetail.jsx`

**Modify `frontend/src/pages/MeetingDetail.jsx`:**

1. Add import:
```javascript
import ProfileFeedbackPrompt from '../components/intelligence/ProfileFeedbackPrompt'
```

2. Add state for feedback:
```javascript
const [showFeedback, setShowFeedback] = useState(false)
const [feedbackProfile, setFeedbackProfile] = useState(null)
```

3. After the meeting loads, check if it has an intelligence config with status `'completed'` and no feedback yet:
```javascript
// In the useEffect that loads meeting data, after setting the meeting:
const { data: intelligenceConfig } = await supabase
  .from('meeting_intelligence_config')
  .select('profile_id, status')
  .eq('meeting_id', id)
  .single()

if (intelligenceConfig?.status === 'completed' && intelligenceConfig?.profile_id) {
  // Check if feedback already submitted
  const { data: existingAnalytics } = await supabase
    .from('intelligence_profile_analytics')
    .select('user_rating')
    .eq('meeting_id', id)
    .not('user_rating', 'is', null)
    .limit(1)

  if (!existingAnalytics || existingAnalytics.length === 0) {
    const { data: profile } = await supabase
      .from('intelligence_profiles')
      .select('name, icon')
      .eq('id', intelligenceConfig.profile_id)
      .single()

    if (profile) {
      setFeedbackProfile(profile)
      setShowFeedback(true)
    }
  }
}
```

4. Render the feedback prompt below the MeetingIntelligencePanel:
```jsx
{showFeedback && feedbackProfile && (
  <ProfileFeedbackPrompt
    meetingId={meeting.id}
    profileName={feedbackProfile.name}
    profileIcon={feedbackProfile.icon}
    onSubmit={async (rating, feedback) => {
      await supabase.from('intelligence_profile_analytics')
        .update({ user_rating: rating, user_feedback: feedback, feedback_at: new Date().toISOString() })
        .eq('meeting_id', meeting.id)
      setShowFeedback(false)
    }}
    onDismiss={() => setShowFeedback(false)}
  />
)}
```

### 7. Update `frontend/src/components/intelligence/index.js`

Add exports for the new components:

```javascript
// Meeting Intelligence Profiles (Phase 4)
export { default as ProfileManagementPanel } from './ProfileManagementPanel'
export { default as CreateProfileModal } from './CreateProfileModal'
export { default as ProfileEffectivenessCard } from './ProfileEffectivenessCard'
export { default as ProfileFeedbackPrompt } from './ProfileFeedbackPrompt'
```

## Files to READ for Patterns

| File | Why |
|------|-----|
| `frontend/src/components/intelligence/MeetingIntelligencePanel.jsx` | **Primary pattern reference** — shows how to make inline Supabase queries, inline suggestion logic, Void × Crimson styling in JSX |
| `frontend/src/pages/Settings.jsx` | Integration target — understand the section/tab pattern |
| `frontend/src/pages/MeetingDetail.jsx` | Integration target — where to add feedback prompt |
| `frontend/src/services/supabaseClient.js` | Supabase client import path |
| `frontend/src/components/vc/index.jsx` | Available VC components (VCButton, VCBadge, etc.) |
| `src/components/intelligence/ProfileManagementPanel.tsx` | Source to port from |
| `src/components/intelligence/CreateProfileModal.tsx` | Source to port from |
| `src/components/intelligence/ProfileEffectivenessCard.tsx` | Source to port from |
| `src/components/intelligence/ProfileFeedbackPrompt.tsx` | Source to port from |

## Important

- **Use `export default`** for all new JSX components (matches the frontend pattern)
- **Do NOT import from `src/intelligence/`** — those TypeScript modules are outside the frontend build
- **All Supabase queries go through `frontend/src/services/supabaseClient`**
- **Use Lucide React icons** (matches existing frontend components)
- **Use Void × Crimson CSS variables** — no hardcoded colors
- **DB column names are snake_case** (`profile_id`, `is_active`, `custom_fields`, `system_prompt_template`, etc.)
- **JS property names** in the TSX sources are camelCase — when porting, query Supabase with snake_case column names and map to camelCase in the component if needed, OR just use snake_case throughout (the existing `MeetingIntelligencePanel.jsx` uses snake_case from DB directly)

## Definition of Done

- [ ] `frontend/src/components/intelligence/ProfileManagementPanel.jsx` — working JSX port
- [ ] `frontend/src/components/intelligence/CreateProfileModal.jsx` — working JSX port with create/edit/clone
- [ ] `frontend/src/components/intelligence/ProfileEffectivenessCard.jsx` — working JSX port
- [ ] `frontend/src/components/intelligence/ProfileFeedbackPrompt.jsx` — working JSX port
- [ ] `frontend/src/components/intelligence/index.js` — updated with new exports
- [ ] `frontend/src/pages/Settings.jsx` — "Meeting Intelligence" section + sub-page with ProfileManagementPanel
- [ ] `frontend/src/pages/MeetingDetail.jsx` — ProfileFeedbackPrompt shown for completed profiled meetings
- [ ] All components query Supabase directly (no imports from `src/intelligence/`)
- [ ] Profile management accessible via Settings → Meeting Intelligence → Manage Profiles
- [ ] Create/edit/clone/export/import all functional
- [ ] Feedback prompt appears for meetings with completed intelligence configs
- [ ] All components use Void × Crimson CSS variables
