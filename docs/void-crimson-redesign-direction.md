# Void × Crimson Redesign Direction
## Entomate AI Meeting Intelligence Platform

**Authored:** 2026-03-20
**Status:** Active design direction — pre-implementation
**Palette Reference:** `brand/brand-void-crimson.html`

---

## 1. Executive Summary — What Needs to Change and Why

Entomate is a war-room intelligence platform. It transcribes meetings, extracts action items, runs AI agents, tracks goals, and automates workflows. The current UI does not reflect any of this power — it reads as a generic SaaS admin panel.

**The core problems:**

| Problem | Impact |
|---------|--------|
| 10 competing brand themes create identity confusion | No consistent visual signature — the app looks like it's still in prototype |
| Hardcoded Tailwind hex values (`text-green-500`, `bg-yellow-500`, `border-primary-600`) bypass the design token system | Colors break across dark/light, theme changes, and future updates |
| Native `alert()`, `confirm()`, `window.open()` calls in 4+ pages | Jarring browser UI intrusions that shatter the product experience |
| No visual hierarchy between AI-surfaced insights and raw data | Users can't tell what's human-entered vs what the AI detected |
| 13-item flat sidebar nav with no grouping | Cognitive overload — all items feel equal weight |
| Charts (Recharts) use hardcoded hex that ignores dark mode | Analytics/ProjectDashboard break visually in dark mode |
| Logo uses `--highlight-color` (legacy var) not `--accent-primary` | Inconsistency at the most prominent brand touchpoint |

**The opportunity:** Void × Crimson is already the default theme and already has a complete, well-structured CSS variable system. The redesign is less about inventing a new design system and more about **enforcing the one that already exists** and building the missing components that make it sing.

**North Star:** Every screen should feel like a mission control terminal — information-dense, signal-driven, with crimson as the action color, mint as confirmation, amber as AI intelligence markers, and the void as the canvas that makes everything else glow.

---

## 2. Theme Removal Plan — Exact Files, Order, Approach

### Strategy: Preserve Dark/Light — Eliminate Brand Switcher

The `void-crimson` theme is already the default. `main.css` `:root` block is already Void × Crimson values. The brand switcher is a late-stage experiment that introduces complexity without product value at this stage.

### Execution Order (zero-breakage sequence)

```
Step 1 — Lock brand attribute
  File: frontend/index.html
  Change: Add data-brand="void-crimson" to <html> tag
  Risk: None — this is already the default via localStorage

Step 2 — Strip ThemeContext to mode-only
  File: frontend/src/context/ThemeContext.jsx
  Remove: BRAND_THEMES, DESIGN_THEMES, HIGHLIGHT_COLORS constants
  Remove: setBrandTheme, enablePreview, confirmPreview, cancelPreview functions
  Remove: brandTheme, previewTheme, activeTheme, isPreviewMode state
  Remove: font lazy-loading effect block
  Keep: mode, resolvedMode, isDark, isLight, setThemeMode, toggleMode
  Keep: ThemeProvider, useTheme hook
  Risk: Low — only 7 files import ThemeContext

Step 3 — Remove brand selector from Layout header
  File: frontend/src/components/Layout.jsx
  Remove: import ThemeToggle from './ThemeToggle'
  Remove: <ThemeToggle compact /> at line 173
  Add: inline dark/light toggle (Moon/Sun icon button, calls toggleMode)
  Risk: Low — visible change but no functional breakage

Step 4 — Delete BrandExplorer
  File: frontend/src/components/settings/BrandExplorer.jsx
  Action: Delete file
  Risk: Low — ThemeToggle was the only consumer

Step 5 — Delete ThemeToggle.jsx
  File: frontend/src/components/ThemeToggle.jsx
  Action: Delete file
  Risk: None after Step 3 removes its usage

Step 6 — Remove theme section from Settings
  File: frontend/src/pages/Settings.jsx
  Remove: import { Palette, Sun, Moon } usage
  Remove: THEME_MODES import (or keep just for setThemeMode calls)
  Remove: any brand theme UI sections
  Risk: Low — Settings will just have fewer sections

Step 7 — Clean up MeetingRecorder
  File: frontend/src/components/MeetingRecorder.jsx
  Remove: useTheme() call (or keep just isDark if needed for recorder UI)
  Risk: Minimal

Step 8 — Delete 10 non-void-crimson theme CSS files
  Files: frontend/src/styles/themes/aurora.css, blueprint.css, horizon.css,
         monolith.css, neon-district.css, pastel-zen.css, playground.css,
         serif-scholar.css, synapse.css, velocity.css
  Keep: void-crimson.css
  Risk: None after brand switcher is gone

Step 9 — Verify
  Run: npm run dev
  Check: dark/light toggle works, brand is always Void × Crimson
  Check: no console errors from removed exports
```

---

## 3. Design System Tokens — The Void × Crimson CSS Variable Set

The full token set to replace ThemeContext's dynamic brand system. These should live permanently in `main.css` `:root` (light) and `.dark` (dark).

```css
/* ── FOUNDATIONS ── */
:root {
  /* Typography */
  --font-display: 'Syne', 'Space Grotesk', system-ui, sans-serif;
  --font-body:    'Space Grotesk', 'Inter', system-ui, sans-serif;
  --font-mono:    'JetBrains Mono', 'Fira Code', monospace;

  /* Radius */
  --radius-sm:   4px;
  --radius-md:   8px;
  --radius-lg:   12px;
  --radius-xl:   20px;
  --radius-full: 9999px;

  /* Spacing (base 4px grid) */
  --space-1: 4px;   --space-2: 8px;   --space-3: 12px;
  --space-4: 16px;  --space-5: 20px;  --space-6: 24px;
  --space-8: 32px;  --space-10: 40px; --space-12: 48px;

  /* Animation */
  --duration-fast:   150ms;
  --duration-normal: 250ms;
  --duration-slow:   400ms;
  --ease-out:        cubic-bezier(0.4, 0, 0.2, 1);
}

/* ── LIGHT MODE (Rose-tinted warm neutral) ── */
:root {
  --bg-base:     #FFF8FA;
  --bg-surface:  #FFFFFF;
  --bg-elevated: #FFF0F4;
  --bg-muted:    #FFE5EC;
  --bg-overlay:  rgba(255, 248, 250, 0.95);

  --text-primary:   #08080A;
  --text-secondary: #4A3840;
  --text-tertiary:  #7A6870;
  --text-muted:     #ADA0A8;
  --text-inverse:   #FFF8FA;

  --border-subtle:  rgba(8, 8, 10, 0.06);
  --border-default: rgba(8, 8, 10, 0.10);
  --border-strong:  rgba(8, 8, 10, 0.18);
  --border-active:  #CC0044;

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.08), 0 0 0 1px rgba(8,8,10,0.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.10);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.12);
  --shadow-glow: 0 4px 16px rgba(204, 0, 68, 0.22);

  /* Accent — Electric Crimson (light variant) */
  --accent-primary:       #CC0044;
  --accent-primary-light: #E8005A;
  --accent-primary-dim:   rgba(204, 0, 68, 0.08);
  --accent-primary-glow:  rgba(204, 0, 68, 0.22);

  /* Accent — Neon Mint (light variant) */
  --accent-secondary:      #008C7A;
  --accent-secondary-light: #00B89E;
  --accent-secondary-dim:  rgba(0, 140, 122, 0.08);

  /* Accent — Amber (light variant) */
  --accent-tertiary:       #9B6800;
  --accent-tertiary-light: #CC8800;
  --accent-tertiary-dim:   rgba(155, 104, 0, 0.08);

  /* Phosphor (live data) */
  --accent-phosphor:     #5A9B00;
  --accent-phosphor-dim: rgba(90, 155, 0, 0.08);

  /* Semantic */
  --semantic-success:      #059669;
  --semantic-success-dim:  rgba(5, 150, 105, 0.08);
  --semantic-warning:      #D97706;
  --semantic-warning-dim:  rgba(217, 119, 6, 0.08);
  --semantic-error:        #DC2626;
  --semantic-error-dim:    rgba(220, 38, 38, 0.08);
  --semantic-info:         #2563EB;
  --semantic-info-dim:     rgba(37, 99, 235, 0.08);
}

/* ── DARK MODE (True Void) ── */
.dark {
  --bg-base:     #080808;
  --bg-surface:  #101010;
  --bg-elevated: #181818;
  --bg-muted:    #202020;
  --bg-overlay:  rgba(8, 8, 8, 0.95);

  --text-primary:   #F8F0F2;
  --text-secondary: #968890;
  --text-tertiary:  #585055;
  --text-muted:     #383035;
  --text-inverse:   #080808;

  --border-subtle:  rgba(248, 240, 242, 0.06);
  --border-default: rgba(248, 240, 242, 0.10);
  --border-strong:  rgba(248, 240, 242, 0.16);
  --border-active:  #FF2D6B;

  --shadow-sm:  0 1px 3px rgba(0,0,0,0.6), 0 0 0 1px rgba(248,240,242,0.06);
  --shadow-md:  0 4px 12px rgba(0,0,0,0.7);
  --shadow-lg:  0 8px 32px rgba(0,0,0,0.75);
  --shadow-glow: 0 0 20px rgba(255,45,107,0.32), 0 0 48px rgba(255,45,107,0.10);

  /* Accent — Electric Crimson (dark variant) */
  --accent-primary:       #FF2D6B;
  --accent-primary-light: #FF6699;
  --accent-primary-dim:   rgba(255, 45, 107, 0.12);
  --accent-primary-glow:  rgba(255, 45, 107, 0.32);

  /* Accent — Neon Mint (dark variant) */
  --accent-secondary:       #00F5D4;
  --accent-secondary-light: #40FFE4;
  --accent-secondary-dim:   rgba(0, 245, 212, 0.12);

  /* Accent — Amber (dark variant) */
  --accent-tertiary:       #FFB800;
  --accent-tertiary-light: #FFD040;
  --accent-tertiary-dim:   rgba(255, 184, 0, 0.12);

  /* Phosphor (live data) */
  --accent-phosphor:     #A0FF32;
  --accent-phosphor-dim: rgba(160, 255, 50, 0.10);

  /* Semantic */
  --semantic-success:     #10b981;
  --semantic-success-dim: rgba(16, 185, 129, 0.10);
  --semantic-warning:     #f59e0b;
  --semantic-warning-dim: rgba(245, 158, 11, 0.10);
  --semantic-error:       #ef4444;
  --semantic-error-dim:   rgba(239, 68, 68, 0.10);
  --semantic-info:        #3b82f6;
  --semantic-info-dim:    rgba(59, 130, 246, 0.10);
}
```

**Usage conventions:**
- `--accent-primary` = all CTAs, active states, primary actions (crimson)
- `--accent-secondary` = success, confirmation, data signals (mint)
- `--accent-tertiary` = AI-generated content markers, warnings (amber)
- `--accent-phosphor` = live/real-time data, recording in progress (phosphor)
- Never use raw Tailwind color utilities (`text-green-500`, `bg-yellow-500`) — always use semantic or accent vars

---

## 4. Navigation Architecture — New Sidebar Structure

### Sidebar Specs
- **Width**: 240px (full) / 52px (collapsed icon mode, future)
- **Background**: `--bg-surface` (light) / `--bg-elevated` (dark)
- **Border right**: 1px solid `--border-default`

### Grouped Navigation Structure

```
┌──────────────────────────────┐
│  [E] entomate                │  ← Logo area, 64px tall
├──────────────────────────────┤
│  INTELLIGENCE                │  ← Section label: 10px Syne uppercase, --text-muted
│  ⬥ Dashboard                 │
│  ⬥ Meetings                  │
│  ⬥ Calendar                  │
│  ⬥ Search                    │
├──────────────────────────────┤
│  WORK                        │
│  ⬥ Projects                  │
│  ⬥ Project Board             │
│  ⬥ Tasks                     │
│  ⬥ Goals                     │
├──────────────────────────────┤
│  AUTOMATION                  │
│  ⬥ Workflows                 │
│  ⬥ Automations               │
│  ⬥ AI Agents                 │
├──────────────────────────────┤
│  OUTPUT                      │
│  ⬥ Analytics                 │
│  ⬥ Reports                   │
├──────────────────────────────┤
│  ─────────────────────────── │
│  ⬥ Settings                  │  ← Footer section
│                              │
│  ┌──────────────────────┐    │  ← User area
│  │ [avatar] Alex Torres │    │
│  │ Free plan · Upgrade  │    │
│  └──────────────────────┘    │
└──────────────────────────────┘
```

### Nav Item Active State
```css
.nav-item-active {
  color: var(--accent-primary);
  background: var(--accent-primary-dim);
  border-left: 3px solid var(--accent-primary);
  font-weight: 600;
}
```

### Header (top bar)
Remove: ThemeToggle brand switcher
Add: Breadcrumb (current section name)
Keep: Search shortcut, keyboard shortcut button, dark toggle (Moon icon only)
Add: User avatar button (top right, opens profile dropdown)

---

## 5. Section Priority Matrix

Scoring: **Impact** (how broken/off-brand is it) × **Effort** (complexity of fix)

| Section | Current Issues | Impact | Effort | Priority |
|---------|---------------|--------|--------|----------|
| **Layout / Sidebar** | Logo var bug, no grouping, ThemeToggle | 🔴 High | Low | **1st** |
| **SharedUI** | Old class names, missing Toast/Confirm | 🔴 High | Low | **1st** |
| **Dashboard** | Good bones, missing greeting/trend | 🟡 Med | Low | **2nd** |
| **Meetings** | alert(), emoji sentiment, no animation | 🟡 Med | Med | **2nd** |
| **Tasks** | confirm(), priority UX, AI not ambient | 🟡 Med | Med | **2nd** |
| **Projects** | Hardcoded Tailwind colors | 🟡 Med | Low | **3rd** |
| **Goals** | Hardcoded Tailwind colors | 🟡 Med | Low | **3rd** |
| **Analytics** | `border-primary-600`, chart dark mode | 🔴 High | Med | **3rd** |
| **ProjectDashboard** | Hardcoded hex palette, chart dark mode | 🔴 High | Med | **3rd** |
| **Automations** | Emoji icons, execution log UX | 🟢 Low | Med | **4th** |
| **AI Agents** | Emoji icons, loading UX | 🟢 Low | Med | **4th** |
| **Settings** | Triple theme location, AI learning widget | 🟡 Med | Med | **4th** |
| **Reports** | alert(), window.open | 🟢 Low | Low | **4th** |
| **Calendar** | alert(), empty state design | 🟢 Low | Med | **5th** |
| **Search** | Overloaded features | 🟢 Low | High | **5th** |
| **Workflows/Builder** | Unknown quality | Unknown | High | **5th** |

---

## 6. Component Inventory — New Components Needed

### Critical (blocking good UX)

| Component | Purpose | Replaces |
|-----------|---------|---------|
| `<Toast />` | In-app success/error notifications | `alert()` across 5 pages |
| `<ConfirmDialog />` | Designed confirmation modal | `confirm()` across 4 pages |
| `<DarkToggle />` | Simple moon/sun icon button | `<ThemeToggle compact />` |
| `<UserMenu />` | Avatar + dropdown (profile, sign out) | Nothing (missing) |
| `<Breadcrumb />` | Current section path in header | Empty flex-1 spacer |

### High Value

| Component | Purpose |
|-----------|---------|
| `<StatusBadge />` | Pill/square/underline chip component using semantic vars |
| `<EmptyState />` | Consistent empty states with illustrations |
| `<PriorityChip />` | Color-coded priority indicator (crimson/amber/gray) |
| `<AIBadge />` | Amber "AI" indicator for AI-generated content |
| `<LiveIndicator />` | Phosphor pulsing dot for live/recording states |
| `<ProgressRing />` | SVG arc progress indicator for goals/projects |
| `<MetricCard />` | Stat card with number + trend arrow + sparkline |
| `<ChartTheme />` | Recharts custom theme provider for dark/light charts |

### Future

| Component | Purpose |
|-----------|---------|
| `<TimelineView />` | Horizontal timeline for meetings |
| `<MiniKanban />` | Compact kanban preview in project cards |
| `<ConversationThread />` | Ask AI chat panel (Search page) |
| `<WorkflowMinimap />` | Thumbnail preview of workflow graph |

---

## 7. Pulse Inspiration Notes

### What to Borrow from Pulse

| Pulse Pattern | How to Apply to Entomate |
|--------------|--------------------------|
| Contact cards with presence indicator | Meeting cards with recording status indicator |
| Waveform visualizer in audio messages | Recording thumbnail in meeting card list |
| Unread/read state visual distinction | Processed/unprocessed meeting distinction |
| Dark sidebar with section grouping | Entomate sidebar with grouped nav sections |
| Floating action button for quick record | "New Meeting" floating button on mobile |

### What to Invent Fresh (Entomate-specific)

- **AI signal layers**: Amber glow on any content that came from AI analysis — no Pulse equivalent
- **Intelligence Dashboard**: Meeting prep + deal risk is domain-specific to B2B sales intelligence
- **Goal hierarchy tree**: OKR visualization has no Pulse analog
- **Automation execution log**: Terminal-style feed unique to Entomate's automation engine
- **Workflow node canvas**: Builder interface has no Pulse equivalent

### Key Difference
Pulse is personal/social (real-time communication, relationships). Entomate is enterprise/analytical (historical intelligence, pattern detection). Pulse should feel warm and human. Entomate should feel precise and powerful — more like a Bloomberg terminal than a messaging app.

---

## 8. Build vs Cut Decision

For each feature/component currently in the app:

| Feature | Decision | Rationale |
|---------|----------|-----------|
| 10-brand theme switcher | **CUT** | Identity confusion, no product value right now |
| BrandExplorer component | **CUT** | Replaced by fixed Void × Crimson |
| ThemeToggle (brand part) | **CUT** | Keep only dark/light toggle |
| HIGHLIGHT_COLORS system | **CUT** | Replaced by --accent-primary |
| Emoji icons in Automations/Agents | **REDESIGN** | Replace with Lucide icon set |
| `alert()` / `confirm()` calls | **REDESIGN** | Replace with Toast + ConfirmDialog |
| GuideCard wizard steps | **REDESIGN** | Keep for empty state only, remove when data exists |
| IntelligenceDashboard | **KEEP** | Core value prop — redesign visual only |
| ExplanationCard (explainability) | **KEEP** | Great pattern, needs amber AI badge treatment |
| AgentRecommendationPanel | **KEEP** | Integrate more prominently into Tasks |
| LearningDashboard | **KEEP** | Move to Settings/AI section |
| Recharts charts | **REDESIGN** | Add ChartTheme provider, use CSS var colors |
| KanbanBoard | **KEEP** | Core workflow — needs Void × Crimson styling |
| CommandPalette | **KEEP** | Power feature — needs VC styling audit |
| MeetingRecorder | **KEEP** | Core feature — needs VC styling audit |
| AutomationBuilder | **KEEP** | Core feature — needs VC styling audit |
| WorkflowBuilder | **KEEP** | Core feature — needs VC styling audit |
| `window.open()` for reports | **FIX** | Use proper download link or fetch blob |
| hardcoded hex in components | **FIX** | All → CSS vars |

---

## 9. Implementation Phases — 4-Week Sprint Plan

### Week 1 — Foundation & Structural Fixes
**Goal:** Zero regressions, consistent token system, navigation transformed

```
Day 1-2: Theme removal (Steps 1-9 from Section 2)
Day 2-3: Fix all hardcoded hex values → CSS vars (Projects, Goals, Analytics, ProjectDashboard)
Day 3-4: Build Toast + ConfirmDialog components → replace all alert()/confirm() calls
Day 4-5: Sidebar redesign — grouped nav, logo fix (--highlight-color → --accent-primary), user area
Day 5:   Header cleanup — breadcrumb, remove BrandExplorer, add DarkToggle + UserMenu
```

**Deliverables:** App has consistent nav, no brand switcher, no native dialogs

---

### Week 2 — Dashboard + Meetings + Tasks
**Goal:** The three most-used sections feel like Void × Crimson

```
Day 1-2: Dashboard — greeting header, MetricCard with trend, IntelligenceDashboard spacing
Day 2-3: Meetings — StatusBadge, sentiment as 1-5 bar not emoji, recording LiveIndicator
Day 3-4: Meetings — animation on recorder panel expand, AI summary peek in cards
Day 4-5: Tasks — PriorityChip, AIBadge on AI-prioritized tasks, overdue crimson indicator
Day 5:   Tasks — AgentRecommendationPanel surfaced at list level, not just create flow
```

**Deliverables:** Core loop (meetings → tasks → dashboard) is production-quality

---

### Week 3 — Intelligence + Automation + Analytics
**Goal:** AI-powered sections feel distinct and powerful

```
Day 1-2: Recharts ChartTheme provider — dark mode charts across Analytics + ProjectDashboard
Day 2-3: Analytics — tab bar redesign, period selector redesign, AI insight callouts
Day 3-4: Automations — replace emoji icons, execution log as terminal feed, dry-run result display
Day 4-5: AI Agents — hex → status LED pattern, ExplanationCard integration, performance sparklines
Day 5:   Goals — progress rings (SVG), hierarchy tree visual, color by goal type
```

**Deliverables:** Analytics looks like war-room data. Agents/Automations feel like deployed intelligence

---

### Week 4 — Polish + Remaining Sections
**Goal:** Everything is consistent, no orphaned UI patterns

```
Day 1:   Reports — ConfirmDialog for download, in-app notification on success
Day 2:   Calendar — empty state design for disconnected, event cards redesign
Day 3:   Search — two-panel layout (results left, Ask AI right), terminal-style AI chat
Day 4:   Settings — remove triple-theme-location, 2-col layout, integration status LEDs
Day 5:   QA pass — check all pages in dark + light, verify CSS vars throughout, delete dead code
```

**Deliverables:** Full app is Void × Crimson compliant, zero native dialogs, zero hardcoded colors

---

## Appendix: Quick Reference

### Color Semantic Mapping

```
Action / CTA        → --accent-primary        (crimson)
Success / Confirmed → --accent-secondary      (mint)
AI Content / Warn   → --accent-tertiary       (amber)
Live / Recording    → --accent-phosphor       (phosphor)
Error / Overdue     → --semantic-error        (red)
Progress / Health   → --semantic-success      (green)
```

### When To Use Each Color

| Color | Use For |
|-------|---------|
| Crimson `#FF2D6B` | Buttons, active nav, recording dot, critical alerts |
| Mint `#00F5D4` | Processed/complete state, data confirmed by system |
| Amber `#FFB800` | AI-generated content badge, predictions, warnings |
| Phosphor `#A0FF32` | Live/real-time indicators, currently recording |
| White `#F8F0F2` | Primary text on dark backgrounds |
| Muted `#968890` | Secondary labels, metadata, timestamps |
