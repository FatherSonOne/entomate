# Entomate — Full Audit & Execution Plan

**Audited by:** Rune ᚱ  
**Date:** 2026-03-21 (Updated: 2026-03-22 20:07 — Post-pull scan, no new commits)  
**Repo:** `/mnt/d/Dev/entomate`  
**Codebase:** ~72K lines (28K frontend JSX, 44K backend JS) + ~8K new lines  
**Stack:** React 18 + Vite (frontend) | Node.js + Express (backend) | Supabase (DB) | Supabase OAuth (auth) | Gemini (AI) | React Flow (workflows)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Void × Crimson Design System — Current State](#2-void--crimson-design-system--current-state)
3. [What's Been Built (2026-03-21 Commit)](#3-whats-been-built-2026-03-21-commit)
4. [Remaining Work — Incomplete Development](#4-remaining-work--incomplete-development)
5. [Native Dialog Violations (alert/confirm/window.open)](#5-native-dialog-violations)
6. [Hardcoded Colors & Design System Drift](#6-hardcoded-colors--design-system-drift)
7. [Theme System Bloat — Still Needs Cleanup](#7-theme-system-bloat--still-needs-cleanup)
8. [Feature Gaps](#8-feature-gaps)
9. [Architecture Issues](#9-architecture-issues)
10. [Backend TODOs & Stubs](#10-backend-todos--stubs)
11. [Ecosystem Integration Gaps (Logos Vision + Pulse)](#11-ecosystem-integration-gaps)
12. [Landing Page & Deployment](#12-landing-page--deployment)
13. [Prioritized Execution Plan](#13-prioritized-execution-plan)
14. [Claude Code Execution — /rebuild-ui Command](#14-claude-code-execution--rebuild-ui-command)

---

## 1. Executive Summary

Entomate is an AI-powered meeting intelligence and project automation platform. The core architecture is solid with deep AI features (explainability, learning engine, agent orchestration, RAG, workflow builder).

**🎨 MAJOR UPDATE (2026-03-21 — Two Commits):**

1. **Design Playground** — `output/void-crimson-playground.html` (3,363 lines) — fully interactive design system with all component patterns, 7 style modes, 9 canvas backgrounds, dark/light themes, and live export.

2. **Implementation Commit** — 40 files changed, ~8K lines added. Frankie built:
   - **`vc-components.css`** (928 lines) — complete CSS component library extracted from playground
   - **`components/vc/index.jsx`** — 18 React components (VCCard, VCButton, VCBadge, VCInput, VCMetricCard, VCMeetingCard, VCToast, VCTable, VCAvatar, VCTimeline, VCCommandPalette, VCTopbar, VCCanvas, VCIconBox, VCAIDot, VCProgress, VCTextarea, VCAvatarGroup)
   - **`VCCanvas.jsx`** — full animated background engine (7 modes: neural, waves, orbital, particles, vortex, matrix, constellation)
   - **`.claude/commands/rebuild-ui.md`** — 7-wave agent deployment strategy for Claude Code
   - **`docs/entomate-component-assets.md`** — extracted SVG assets from playground (hand logos, circuit animations)
   - **`output/entomate-hands-playground.html`** — dedicated hands/logo playground
   - **Brand assets** — 5 new logo variants (logo-c-hero, horizontal, icon, light, refined)
   - **Brand reveal videos** — `entomate-brand-reveal.mp4` + `entomate-hero-cinematic.mp4`
   - **Page updates** — Dashboard, Meetings, MeetingDetail, Calendar, Goals, Projects, ProjectDetail, ProjectDashboard, Reports, Search, Settings, Tasks, WorkflowBuilder, Workflows all modified

**🆕 UPDATE (2026-03-22 — Two Commits):**

3. **Clerk → Supabase OAuth** (`4465bac`) — Full auth migration. Clerk completely removed from frontend + backend. New `AuthContext.jsx` with Supabase session management, `AuthCallback.jsx` for OAuth redirect, `authService.js` + `supabaseClient.js` for Supabase integration. `LandingPage.jsx` (2,254 lines!) added as public route before auth gate. SignUp page removed (Google OAuth only now).

4. **Favicon Redesign** (`e0dfaa6`) — Replaced the hexagonal node-graph favicon with a clean **E lettermark** on a dark rounded-square background. White bold E bars + amber dot accent top-right + crimson border. Much cleaner brand presence in browser tabs.

5. **Dashboard Hero Overhaul** (`3808f8a`) — `Dashboard.jsx` went from 190 → 447 lines. Major new components:
   - **`useTypewriter()` hook** — animated rotating greeting phrases with typing/deleting effect + blinking cursor
   - **`RingGauge` component** — animated SVG ring gauges (crimson/mint/amber/phosphor) replacing the old `VCMetricCard` grid
   - **`IntelligenceBriefCard`** — live system snapshot with AI-generated bullet summaries per data category
   - **`QuickActionsBar`** — docked neumorphic action strip (Start Meeting, New Task, New Project, AI Insights, Automations)
   - **`DashboardHero`** — 2-column hero layout: greeting+intelligence brief (left) + 2×2 ring gauge grid (right)
   - **`SystemStatus`** — refactored to standalone component using shorthand token vars (`--t0`, `--t2`, `--b0`, etc.)
   - **`vc-cursor-blink` keyframe** added to `vc-components.css` for the typewriter cursor
   - Dashboard no longer uses `VCMetricCard` — switched to the RingGauge visual system
   - `loadData` extracted as reusable async function (was inline in useEffect)
   - All hardcoded long-form variable names (`--accent-primary`, `--text-primary`, etc.) replaced with shorthand tokens (`--c`, `--t0`, etc.)

**The plan has fundamentally shifted.** The design system and component library are built. The `/rebuild-ui` Claude command defines a 7-wave agent deployment strategy. What remains is:
1. Finishing the component integration across all pages
2. Cleaning up dead code (themes, ThemeContext bloat)
3. Replacing all alert/confirm calls with VCToast/ConfirmDialog
4. Fixing hardcoded colors
5. Backend completion
6. Ecosystem integration

---

## 2. Void × Crimson Design System — Current State

### 2.1 Design Tokens

Full token system defined in `vc-components.css` `:root`:

| Token | Purpose | Dark Value |
|---|---|---|
| `--c` / `--accent-primary` | Crimson (CTA/Action) | `#FF2D6B` |
| `--cd` / `--accent-primary-dim` | Crimson dim | `rgba(255,45,107,.12)` |
| `--cg` / `--accent-primary-glow` | Crimson glow | `rgba(255,45,107,.32)` |
| `--m` / `--accent-secondary` | Mint (Success) | `#00F5D4` |
| `--a` / `--accent-tertiary` | Amber (AI/Warning) | `#FFB800` |
| `--p` / `--accent-phosphor` | Phosphor (Live) | `#A0FF32` |
| `--bg0`–`--bg3` | Background scale | `#080808` → `#202020` |
| `--t0`–`--t3` | Text scale | `#F8F0F2` → `#383035` |
| `--b0`–`--b2` | Border scale | `6%` → `16%` opacity |
| `--neo-base/l/d` | Neumorphic surface | `#141414` / `#1E1E1E` / `#0C0C0C` |

### 2.2 Selected Style: Neo+Cinema
- Neumorphic depth shadows + cinematic crimson glow
- Blur: 16px, Radius: 13px, Extrusion: 7px, Glow: 0.47
- Hover: glow effect, Transition: slow (500ms)
- Font: Syne (display), Space Grotesk (body), JetBrains Mono (code)

### 2.3 Design Playground
**File:** `output/void-crimson-playground.html` (3,363 lines)
- 22 component sections with live interactive examples
- 7 style modes (Glass, Neo, Cinema, G+N, G+C, N+C, Fusion)
- 9 canvas backgrounds (Neural, Waves, Orbital, Particles, Vortex, Matrix, Plasma, Constellation, DNA)
- Dark/light toggle, typography controls, export/copy prompt features
- **This is the visual source of truth** — open in browser during development

### 2.4 Additional Playgrounds
- **`output/entomate-hands-playground.html`** (2,076 lines) — dedicated hand logo variations and animation playground

---

## 3. What's Been Built (2026-03-21 Commit)

### 3.1 React Component Library (`components/vc/index.jsx`)

| Component | Props | Status |
|---|---|---|
| `VCCard` | children, className, style, onClick | ✅ Built |
| `VCButton` | variant (primary/secondary/ghost/mint/amber/danger/icon), size (sm/lg) | ✅ Built |
| `VCBadge` | color (crimson/mint/amber/phosphor/neutral/error), live | ✅ Built |
| `VCInput` | icon, ...inputProps | ✅ Built |
| `VCTextarea` | ...textareaProps | ✅ Built |
| `VCMetricCard` | label, value, delta, deltaDir, icon, color, onClick, href | ✅ Built |
| `VCMeetingCard` | title, meta, badge, status, progress, progressColor, actions, onClick | ✅ Built |
| `VCToast` | title, message, color, icon | ✅ Built (static — needs toast manager for auto-dismiss/stacking) |
| `VCTable` | columns, rows | ✅ Built |
| `VCAvatar` | initials, src, color, size | ✅ Built |
| `VCAvatarGroup` | avatars[], max | ✅ Built |
| `VCAIDot` | color | ✅ Built |
| `VCProgress` | value, color | ✅ Built |
| `VCTopbar` | title, breadcrumb, onSearch, onCommandPalette, rightSlot | ✅ Built |
| `VCCommandPalette` | isOpen, onClose, groups, query, onQueryChange, selectedIndex, onSelectIndex | ✅ Built |
| `VCTimeline` | events[] (title, time, body, color) | ✅ Built |
| `VCIconBox` | children, color, size | ✅ Built |
| `VCCanvas` | mode (7 modes), speed, density, opacity | ✅ Built |

### 3.2 CSS Component Library (`vc-components.css` — 928 lines)

Full CSS for all components including:
- Surface styles (`.vc` with Neo+Cinema variant)
- Buttons (`.vbtn` + 7 variants)
- Badges (`.vbadge` + 6 color variants + live dot animation)
- Inputs, textareas, form groups
- Sidebar navigation (`.nl` system)
- Topbar (`.vc-topbar`)
- Metric cards (`.mc`)
- Meeting cards (`.mtg`)
- Data tables (`.vtbl`)
- Toast notifications (`.vtoast` + 4 color variants)
- Chat widget (`.vc-chat-*`)
- Avatars (`.vc-av`)
- Progress bars (`.vc-progress`)
- Typography scale (`.ty-*`)
- Grid layouts (`.vc-grid-2/3/4` with responsive breakpoints)
- Logo animations (breathe, pulse)
- Workflow nodes (`.wf-node`, trigger/action/condition)
- Timeline (`.tl-*`)
- Sidebar (`.nl-sidebar`)
- Hand logo & circuit animations (keyframes)
- Hero section (`.hero-*`)
- Kanban cards (`.kcard`)
- Command palette (`.cmd-*`)
- Entry animations (fadeUp, slideRight, scaleIn)
- Icon containers (`.vc-icon` + 5 color variants + sm/lg sizes)

### 3.3 VCCanvas Background Engine (`VCCanvas.jsx`)

Full animated canvas with 7 modes:
- **Neural** — interconnected nodes with crimson/mint/amber connections
- **Waves** — flowing sine waves
- **Orbital** — planetary orbit system
- **Particles** — floating particle field
- **Vortex** — spiral vortex pattern
- **Matrix** — falling code columns
- **Constellation** — star field with connections

### 3.4 Claude Code Integration

**`.claude/commands/rebuild-ui.md`** — A comprehensive 7-wave agent deployment strategy:
- Wave 1: CSS Foundation + VC Library (parallel)
- Wave 2: Layout Shell (after Wave 1)
- Wave 3: Dashboard + Meetings (parallel after Wave 1)
- Wave 4: SharedUI + Forms (parallel after Wave 1)
- Wave 5: CommandPalette + Kanban + Logo (after Wave 2)
- Wave 6: Icon System (after Wave 1)
- Wave 7: QA + Build Verification (after all)

Includes complete design token reference, component→file mapping, and strict rules (no hardcoded hex, preserve routing/auth, dark mode first).

### 3.5 Brand Assets

- 5 new logo PNG variants in `brand/logos/` (hero, horizontal, icon, light, refined)
- SVG asset extraction doc (`docs/entomate-component-assets.md`) — hand logos at multiple sizes, circuit animations, workflow node SVG
- 2 brand videos in `output/` — reveal animation + hero cinematic

### 3.6 Dashboard-Local Components (2026-03-22)

These are defined inline in `Dashboard.jsx` (not in the shared `vc/` library):

| Component | Purpose | Notes |
|---|---|---|
| `useTypewriter()` | Rotating animated greeting text | Type/hold/delete cycle with configurable speed/pause |
| `RingGauge` | SVG ring gauge with animated fill | 4 color variants, replaces `VCMetricCard` on dashboard |
| `IntelligenceBriefCard` | AI briefing bullet list | Dynamic bullets based on meeting/task/project counts |
| `QuickActionsBar` | Docked action strip | 5 buttons, neumorphic styling, scrolls to recorder |
| `DashboardHero` | Hero layout (greeting + gauges) | 2-col grid, typewriter left, 2×2 rings right |
| `SystemStatus` | AI + DB status bar | Green dot = connected, amber = checking |

**Note:** `VCMetricCard` is still in the shared library but no longer used by Dashboard. Other pages may still reference it.

### 3.7 Page Updates (Partial Integration)

All major pages were modified in the 2026-03-21 commit. The changes started applying VC styles, though full integration is the job of the `/rebuild-ui` waves.

| Page | Lines Changed | Notes |
|---|---|---|
| Dashboard.jsx | 447 total (rewritten 2026-03-22) | Hero, RingGauge, typewriter, QuickActions |
| Meetings.jsx | 75 ± | Meeting card integration |
| MeetingDetail.jsx | 198 ± | Timeline, detail layout |
| Calendar.jsx | 165 ± | Calendar event styling |
| Goals.jsx | 355 ± | Heavy rework |
| Projects.jsx | 101 ± | Project card styling |
| ProjectDetail.jsx | 186 ± | Detail layout |
| ProjectDashboard.jsx | 219 ± | Dashboard metrics |
| Reports.jsx | 282 ± | Table and report styling |
| Search.jsx | 743 ± | Major rework (was 1,225 lines) |
| Settings.jsx | 382 ± | Form styling |
| Tasks.jsx | 164 ± | Task card styling |
| WorkflowBuilder.jsx | 75 ± | Node styling |
| Workflows.jsx | 178 ± | List styling |

---

## 4. Remaining Work — Incomplete Development

### 4.1 IntelligenceDashboard — 7 Stubbed Actions
**File:** `frontend/src/components/intelligence/IntelligenceDashboard.jsx`
Still has 7 `alert('... coming soon!')` stubs for calendar, task creation, reassignment, CRM, and introduction features.

### 4.2 Toast Manager
`VCToast` is built as a static component but needs a **toast manager** for:
- Auto-dismiss with configurable timeout
- Stacking multiple toasts
- `useToast()` hook for easy invocation from any component
- Position (bottom-right recommended)

### 4.3 ConfirmDialog
Still needs to be built — a modal confirmation dialog for destructive actions. Use the glass card + danger button patterns from the playground.

### 4.4 Learning System — Pattern Customization
`PatternApprovalModal.jsx:252` — still "Coming Soon"

### 4.5 SignUp Page — Legacy Styling
Still uses `--highlight-color` (dead variable)

### 4.6 MeetingRecorder AudioVisualizer
Still uses `--highlight-color-rgb` (dead variable)

---

## 5. Native Dialog Violations

**Still need replacing** (unless the page updates in this commit already fixed some):

### alert() — 18 total
IntelligenceDashboard (8), FeedbackPrompt (1), LearningDashboard (3), Automations (2), Calendar (3), Reports (2)

### confirm() — 12 total
LearningDashboard, DataPinningPanel, VersionHistoryPanel, Automations, Calendar, Goals, Meetings, ProjectDetail, Projects, Tasks, WorkflowBuilder, Workflows (1 each)

### window.open() — 3 total
CommandPalette, CrossAppSearch, Reports

**Resolution:** Build toast manager wrapper around `VCToast`. Build `VCConfirmDialog`. Replace all instances.

---

## 6. Hardcoded Colors & Design System Drift

**127 hardcoded Tailwind color classes** were identified. The page updates in this commit may have fixed some, but a full audit pass is still needed.

**Mapping:**
| Hardcoded | Replace With |
|---|---|
| `bg/text-green-*` | `--m` / `--md` (mint) |
| `bg/text-yellow-*` | `--a` / `--ad` (amber) |
| `bg/text-red-*` | `--c` / `--cd` (crimson) |
| `bg/text-blue-*` | `--m` (mint) or semantic-info |
| `border-primary-*` | `--b1` / `--b2` / `--c` |
| `bg-gray-*`, `text-gray-*` | `--bg2` / `--t2` |

---

## 7. Theme System Bloat — Still Needs Cleanup

### 10 Unused Theme CSS Files (DELETE)
```
frontend/src/styles/themes/aurora.css
frontend/src/styles/themes/blueprint.css
frontend/src/styles/themes/horizon.css
frontend/src/styles/themes/monolith.css
frontend/src/styles/themes/neon-district.css
frontend/src/styles/themes/pastel-zen.css
frontend/src/styles/themes/playground.css
frontend/src/styles/themes/serif-scholar.css
frontend/src/styles/themes/synapse.css
frontend/src/styles/themes/velocity.css
```

### ThemeContext.jsx — 530 Lines → ~80 Lines
Strip to: `mode` (dark/light), `toggleMode`, `isDark`/`isLight`.

### Files to Delete
- `frontend/src/components/settings/BrandExplorer.jsx`
- `frontend/src/components/ThemeToggle.jsx`

---

## 8. Feature Gaps

### 8.1 Components — Status After This Commit

| Component | Status | Notes |
|---|---|---|
| `<Toast />` | ✅ Built (needs manager) | `VCToast` exists, needs auto-dismiss/stacking/hook |
| `<ConfirmDialog />` | ❌ Still missing | Build using glass card + danger button patterns |
| `<UserMenu />` | ⚠️ Partially built | Topbar has avatar slot, needs dropdown |
| `<Breadcrumb />` | ✅ Built | Part of `VCTopbar` |
| `<DarkToggle />` | ❌ Still missing | Simple toggle component |
| `<StatusBadge />` | ✅ Built | `VCBadge` with 6 variants |
| `<EmptyState />` | ❌ Still missing | Design & build |
| `<PriorityChip />` | ✅ Covered | Use `VCBadge` variants |
| `<AIBadge />` | ✅ Built | Amber `.ai-badge` in CSS |
| `<LiveIndicator />` | ✅ Built | `VCAIDot` + `.vbadge-live` |
| `<MetricCard />` | ✅ Built | `VCMetricCard` |
| `<MeetingCard />` | ✅ Built | `VCMeetingCard` |
| `<Timeline />` | ✅ Built | `VCTimeline` |
| `<CommandPalette />` | ✅ Built | `VCCommandPalette` |
| `<SearchPanel />` | ⚠️ Updated | Search.jsx had 743 lines changed |
| `<AIChatWidget />` | ⚠️ CSS only | `.vc-chat-*` styles exist, no React component |
| `<KanbanColumn />` | ⚠️ CSS only | `.kcard` styles exist |
| `<WorkflowNode />` | ⚠️ CSS only | `.wf-node` styles exist |
| `<NavSidebar />` | ⚠️ CSS only | `.nl-sidebar` styles exist, no React wrapper |
| `<CanvasBackground />` | ✅ Built | `VCCanvas` with 7 modes |
| `<IconBox />` | ✅ Built | `VCIconBox` with 5 colors + 3 sizes |

### 8.2 Still Needs Design & Build
- Error Boundary wrapper
- Loading skeletons (content-shaped) — **Dashboard now has inline skeleton loading (pulse animation), but no reusable Skeleton component yet**
- Recharts ChartTheme provider
- Notification center / bell dropdown
- Mobile/responsive sidebar collapse

### 8.3 Auth Migration: Clerk → Supabase OAuth (✅ Committed)
The Clerk → Supabase OAuth migration was committed in `4465bac`. Files affected:
- `AuthContext.jsx`, `ProtectedRoute.jsx`, `useAuthToken.js`, `authService.js`, `supabaseClient.js`
- `backend/middleware/auth.js`
- `App.jsx`, `main.jsx`, `SignIn.jsx`, `AuthCallback.jsx`
- `api.js` (token handling)
- Package changes (frontend + backend — Clerk deps removed)

**Status:** Committed but needs end-to-end testing with real Supabase Google OAuth flow.

### 8.4 Uncommitted Local Changes (as of 2026-03-22 20:00)
40 files show as modified locally, but **actual code changes are near-zero:**
- **Line-ending normalization** (CRLF → LF) across ~35 files — causes large diffs but zero functional change
- **File permission changes** (100644 → 100755) on many files — likely from WSL/Windows cross-filesystem
- **Only real change:** 6 lines removed from `vc-components.css` — the `vc-cursor-blink` keyframe was deleted (cursor blink animation for the typewriter). Dashboard.jsx likely defines this inline now or no longer needs it.
- **Recommendation:** Commit with message like `chore: normalize line endings and file permissions` to clean up the dirty tree, or add a `.gitattributes` with `* text=auto eol=lf` to prevent recurrence.

---

## 9. Architecture Issues

### 9.1 Dual Package.json
Root `package.json` (TypeScript, React 19) vs `frontend/package.json` (JSX, React 18). Still needs reconciliation.

### 9.2 Hardcoded API URLs
`CrossAppSearch.jsx`, `TodaysIntelligence.jsx`, `SecretsManager.jsx` hardcode `localhost:3000`.

### 9.3 Dead File
`backend/services/workflow/NodeRegistry.js.bak` — delete.

### 9.4 Vercel Build Pipeline
Complex `index.html` → `app.html` swap. May have routing issues.

### 9.5 CRM Service
`crmService.js` integrates third-party CRMs but not Logos Vision.

---

## 10. Backend TODOs & Stubs

| File | TODO | Priority |
|------|------|----------|
| `agents/ragHandler.js:693` | PDF parsing not implemented | Medium |
| `intelligence/ActionItemTrackerService.js:490` | Slack notifications | Medium |
| `intelligence/ActionItemTrackerService.js:495` | Email notifications | Medium |
| `intelligence/MeetingPrepService.js:321` | Query shared hub | High |
| `monitoring/ErrorMonitoring.js:142` | Analytics/cost tracking | Low |
| `monitoring/ErrorMonitoring.js:176` | Mixpanel/Amplitude | Low |
| `secretsVault.js:305` | Org/team access checks | High (security) |
| `workflow/nodes/LogicNodes.js:94` | Expected inputs detection | Medium |
| `utils/aiUsageLogger.js:189` | Usage database logging | Medium |

---

## 11. Ecosystem Integration Gaps

### 11.1 Logos Vision ↔ Entomate
- No actual Logos Vision sync service in backend
- IntelligenceDashboard CRM button is a stub
- No contact lookup, task pipeline, or timeline sync

### 11.2 Pulse ↔ Entomate
- No Pulse notification service
- No meeting summary → Pulse channel posting

### 11.3 Shared Hub
- Schema not defined in repo, no migration scripts

---

## 12. Landing Page & Deployment

### 12.1 Landing Page
Beautiful Void × Crimson design. Issues: standalone HTML, logo showcase needs commitment, no pricing, no screenshots.

### 12.2 Logo & Favicon Progress
Multiple variants still floating: `brand/logos/` has original concepts + 5 new "logo-c" variants. The hand logo (two wireframe hands + amber node + E letterform bars) appears to be the winner based on the playground and assets doc. **Need to commit and delete alternatives.**

**Favicon (Updated 2026-03-22):** Now uses a clean E lettermark — dark rounded-rect background (`#1a0810` → `#0d0408` gradient), white 3-bar E, amber dot accent top-right, crimson border. No longer the hexagonal node-graph. This is a strong direction for the final icon mark.

### 12.3 Brand Videos
- `output/entomate-brand-reveal.mp4` (12MB)
- `output/entomate-hero-cinematic.mp4` (41MB)

---

## 13. Prioritized Execution Plan

> **The `/rebuild-ui` Claude Code command handles the bulk of UI work. This plan covers everything including what's outside that scope.**

### Phase 1: Run /rebuild-ui Waves (5-7 days)
_Use the `.claude/commands/rebuild-ui.md` strategy to deploy agent waves:_

1. **Wave 1** — CSS Foundation + VC Library finalization (verify `vc-components.css` imported, tokens complete)
2. **Wave 2** — Layout Shell (sidebar → `.nl` system, topbar → `.vc-topbar`)
3. **Wave 3** — Dashboard + Meetings (VCMetricCard, VCMeetingCard integration)
4. **Wave 4** — SharedUI + Forms (VCButton everywhere, VCBadge everywhere, VCInput for forms)
5. **Wave 5** — CommandPalette + Kanban + Logo (hand SVG as primary logo)
6. **Wave 6** — Icon System (VCIconBox wrapping all Lucide icons)
7. **Wave 7** — QA + Build Verification

### Phase 2: Toast Manager + ConfirmDialog (1 day)
_Components that aren't in the current library:_

1. **Build `useToast()` hook** — wrapper around VCToast with auto-dismiss, stacking, positioning
2. **Build `VCConfirmDialog`** — modal with title, message, confirm (danger) + cancel (ghost) buttons
3. **Replace all 18 `alert()` calls** → `toast.error()` / `toast.success()` / `toast.info()`
4. **Replace all 12 `confirm()` calls** → `VCConfirmDialog`
5. **Replace 3 `window.open()` calls** → proper navigation/download

### Phase 3: Dead Code Cleanup (0.5 day)
1. Delete 10 unused theme CSS files
2. Strip ThemeContext.jsx → ~80 lines
3. Delete BrandExplorer.jsx, ThemeToggle.jsx
4. Delete NodeRegistry.js.bak
5. Fix SignUp.jsx dead variable
6. Fix MeetingRecorder dead variable
7. Fix 3 hardcoded API URLs → api.js

### Phase 4: Hardcoded Color Purge (1-2 days)
1. Audit all remaining hardcoded Tailwind colors after /rebuild-ui
2. Replace with CSS variables
3. Build ChartTheme for Recharts
4. Test dark mode + light mode on every page

### Phase 5: IntelligenceDashboard Stubs (2-3 days)
Wire the 7 "coming soon" features to real functionality:
- Calendar integration (event creation, sync, follow-up scheduling)
- Task creation dialog
- Reassignment UI
- CRM push to Logos Vision
- Introduction email draft generation

### Phase 6: Ecosystem Integration (3-5 days)
1. Build LogosVisionService in backend
2. Action item → Logos Vision task pipeline
3. Meeting → Logos Vision activity sync
4. Contact lookup during meeting processing
5. Define shared hub schema + migrations
6. Pulse notification integration

### Phase 7: Backend Completion (2-3 days)
1. Install pdf-parse for RAG handler
2. Wire Slack + email notifications for action items
3. Implement deal query in MeetingPrepService
4. Add org/team access checks to SecretsVault
5. Implement AI usage database logging

### Phase 8: Logo Commitment + Landing Page (1-2 days)
1. Commit to hand logo as primary mark
2. Delete alternative logo files
3. Integrate CanvasBackground into landing page
4. Add pricing/beta section
5. Add product screenshots
6. Fix Vercel routing

**Estimated total: 16-24 days**

---

## 14. Claude Code Execution — /rebuild-ui Command

The full `/rebuild-ui` deployment strategy is defined in:
```
.claude/commands/rebuild-ui.md
```

**Usage:**
```
/rebuild-ui              # Full 7-wave rebuild
/rebuild-ui layout       # Only Layout.jsx
/rebuild-ui dashboard    # Only Dashboard
/rebuild-ui css          # Only CSS foundation
/rebuild-ui icons        # Only icon system
/rebuild-ui logo         # Only Logo.jsx
/rebuild-ui qa           # Only QA verification
```

**Key rules for all agents:**
1. Never hardcode hex colors — use CSS custom properties
2. Never break routing or auth
3. Preserve all existing props
4. Reference the playground for any ambiguity
5. Dark mode only (primary), light mode secondary
6. No new dependencies

---

_This document is the single source of truth for Entomate's development roadmap._  
_The playground (`output/void-crimson-playground.html`) is the single source of truth for design._  
_The `/rebuild-ui` command is the execution engine._  
_Update all three as phases complete._
