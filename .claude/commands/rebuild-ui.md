# /rebuild-ui — Entomate Full UI/UX Rebuild

Orchestrates a complete UI/UX rebuild of the Entomate frontend using the
Void × Crimson Design Playground as the authoritative visual source.

**Playground reference:** `f:/entomate/output/void-crimson-playground.html`
**Target frontend:** `f:/entomate/frontend/src/`
**Design style:** Neo+Cinema (dark, crimson borders, neumorphic depth + cinematic glow)

---

## BEFORE STARTING

Read these files silently before doing anything else:
1. `f:/entomate/output/void-crimson-playground.html` — playground source (all components, SVGs, CSS, JS)
2. `f:/entomate/frontend/src/styles/vc-components.css` — current VC styles
3. `f:/entomate/frontend/src/components/vc/index.jsx` — current VC components
4. `f:/entomate/frontend/src/components/Layout.jsx` — current shell

---

## DESIGN TOKENS (baked from playground — Neo+Cinema)

```css
/* Surface */
--c: #FF2D6B;  --cb: #FF6699;  --cd: rgba(255,45,107,.12);  --cg: rgba(255,45,107,.32);
--m: #00F5D4;  --md: rgba(0,245,212,.12);  --mg: rgba(0,245,212,.30);
--a: #FFB800;  --ad: rgba(255,184,0,.12);
--p: #A0FF32;  --pd: rgba(160,255,50,.10);
--bg0: #080808; --bg1: #101010; --bg2: #181818; --bg3: #202020;
--t0: #F8F0F2; --t1: #968890; --t2: #585055;
--b0: rgba(248,240,242,.06); --b1: rgba(248,240,242,.10); --b2: rgba(248,240,242,.16);
--neo-base: #141414; --neo-l: #1E1E1E; --neo-d: #0C0C0C;

/* Computed slider values */
--blur: 16px; --rad: 13px; --extr: 7px; --opa: 0.70; --glow-i: 0.60;
--font: 'Syne', system-ui, sans-serif;
--hw: 36px; --fw: 600; --trk: 0em; --lh: 1.4;

/* Neo+Cinema surface */
.vc {
  background: #141414;
  border: 1px solid rgba(255,45,107,.14);
  box-shadow: 7px 7px 14px #0C0C0C, -7px -7px 14px #1E1E1E,
              0 0 48px rgba(255,45,107,.15), 0 16px 48px rgba(0,0,0,.6);
  border-radius: 13px;
  transition: all 240ms cubic-bezier(.4,0,.2,1);
}
```

---

## COMPONENT → FILE MAPPING

| Playground Section | Entomate File(s) | CSS Classes |
|---|---|---|
| Navigation Sidebar | `components/Layout.jsx` | `.nl`, `.nl-item`, `.nl-badge` |
| Header Topbar | `components/Layout.jsx` | `.topbar`, `.topbar-search` |
| Metric Cards | `pages/Dashboard.jsx` | `.vc`, `.metric-card`, `.metric-value` |
| Meeting Cards | `pages/Meetings.jsx` `pages/Dashboard.jsx` | `.mtg-card`, `.mtg-progress-fill` |
| Buttons & Actions | `components/vc/index.jsx` | `.vbtn`, `.vbtn-*` |
| Form Elements | all pages with forms | `.vinput`, `.vselect`, `.vtextarea` |
| Badges & Indicators | `components/SharedUI.jsx` `components/vc/index.jsx` | `.vbadge`, `.vbadge-*` |
| Notifications/Toasts | `components/SharedUI.jsx` | `.toast`, `.toast-*` |
| Dropdown Menus | `components/Layout.jsx` + pages | `.ddi`, `.ddi-item` |
| Data Table | `pages/Reports.jsx` `pages/Analytics.jsx` | `.vtbl`, `.vtbl-wrap` |
| Kanban Board | `components/KanbanBoard.jsx` | `.kanban`, `.kanban-col`, `.kanban-card` |
| Command Palette | `components/CommandPalette.jsx` | `.cmd-box`, `.cmd-result` |
| Icon System | throughout (Lucide icons + `.vc-icon` containers) | `.vc-icon`, `.vc-icon-*` |
| Logo & Brand | `components/Logo.jsx` | SVG + animation classes |
| Canvas Animation | `components/vc/VCCanvas.jsx` | `<canvas>` engine |
| AI Chat Widget | `pages/Dashboard.jsx` (AI section) | `.chat-widget`, `.chat-msg` |
| Timeline | `pages/MeetingDetail.jsx` | `.tl`, `.tl-item` |
| Search Results | `pages/Search.jsx` | `.sr-result`, `.sr-highlight` |
| Workflow Nodes | `pages/WorkflowBuilder.jsx` | `.wf-node`, `.wf-canvas` |

---

## AGENT TEAM DEPLOYMENT

### Wave 1 — Foundation (run FIRST, in parallel)

**Agent: CSS Foundation**
- Read playground CSS from `<style>` block of playground HTML
- Fully rewrite `frontend/src/styles/vc-components.css` with all component classes
- Ensure `:root` contains all tokens above
- Add Neo+Cinema `.vc` surface rules
- Add all utility classes: `.vc-grid-*`, `.vc-flex`, `.vc-text-*`
- DO NOT touch `navigation.css` or `main.css` yet

**Agent: VC Component Library**
- Read `components/vc/index.jsx`
- Rewrite with full component set from playground React export:
  VCCard, VCButton (6 variants), VCBadge (5 variants), VCInput, VCSelect,
  VCTextarea, VCToast, VCDropdown, VCMetricCard, VCMeetingCard,
  VCCommandPalette, VCTimeline, VCSidebar, VCTopbar
- Keep existing `VCCanvas` export, do not modify VCCanvas.jsx
- Keep existing component API signatures where possible

---

### Wave 2 — Shell & Navigation (after Wave 1)

**Agent: Layout Shell**
- Read `components/Layout.jsx`
- Replace sidebar nav with `.nl` / `.nl-item` / `.nl-section` / `.nl-badge` classes
- Apply `.topbar` + `.topbar-search` to header
- Icon containers: wrap each Lucide icon in `.vc-icon` div with accent bg color
- Icon container style: `width:36px;height:36px;border-radius:8px;display:grid;place-items:center;background:var(--cd)`
- Active nav item: `background:var(--cd);color:var(--c)` (crimson active state)
- Sidebar width: 220px fixed
- Apply from playground: section headers get `.nl-section` class (9px uppercase)
- Notification badge on nav items: `.nl-badge` (crimson pill)
- Keep all existing routing, auth, keyboard shortcut logic intact

---

### Wave 3 — Dashboard & Cards (after Wave 1)

**Agent: Dashboard**
- Read `pages/Dashboard.jsx`
- Wrap all panels in `<VCCard>` or add `.vc` class
- Replace KPI stats with `<VCMetricCard>` component
- Replace meeting list items with `<VCMeetingCard>` structure
- Meeting progress bar: `.mtg-progress` + `.mtg-progress-fill` (crimson→mint gradient)
- Avatar stack: `.mtg-avatars` + `.mtg-avatar` (24px circles, -6px overlap)
- Import and use components from `../components/vc`

**Agent: Meetings & Detail**
- Read `pages/Meetings.jsx` and `pages/MeetingDetail.jsx`
- Apply `.vc` to all card containers
- Meeting list items → `.mtg-card` structure
- Meeting detail timeline → `.tl` / `.tl-item` / `.tl-dot` / `.tl-line`
- Timeline dot colors: crimson=recording, mint=AI summary, amber=action item
- Status badges → `<VCBadge variant="live|ai|success|error|neutral">`

---

### Wave 4 — Shared Components (after Wave 1)

**Agent: Buttons, Badges & SharedUI**
- Read `components/SharedUI.jsx`
- Replace all `<button>` elements site-wide with `<VCButton variant="...">`
- Variant mapping:
  - Primary actions (save, submit, join) → `variant="primary"`
  - Destructive actions (delete, cancel) → `variant="danger"`
  - Secondary options → `variant="secondary"`
  - Cancel/dismiss → `variant="ghost"`
  - AI/intelligence actions → `variant="mint"`
  - Export/amber actions → `variant="amber"`
- Replace status pills with `<VCBadge variant="...">`
- Badge variant mapping:
  - Live/active recording → `variant="live"` (phosphor pulse dot)
  - AI-generated content → `variant="ai"` (amber)
  - Completed/success → `variant="success"` (mint)
  - Error/failed → `variant="error"` (crimson)
  - Draft/pending/neutral → `variant="neutral"`

**Agent: Forms**
- Find all `<input>`, `<select>`, `<textarea>` elements in pages/
- Wrap with `<VCInput label="...">`, `<VCSelect>`, `<VCTextarea>`
- Apply `.vform-group` + `.vform-label` to form field groups
- Focus states: `border-color:var(--c)` + crimson glow ring
- Priority pages: `pages/Settings.jsx`, `pages/WorkflowBuilder.jsx`

---

### Wave 5 — Advanced Components (after Wave 2)

**Agent: Command Palette**
- Read `components/CommandPalette.jsx`
- Apply `.cmd-overlay` `.cmd-box` `.cmd-input-wrap` `.cmd-input` `.cmd-results` `.cmd-result`
- `.cmd-box` wraps with `.vc` surface (neo+cinema style)
- Result items: icon in 28px `.cmd-result-icon` container + title + subtitle + kbd shortcut
- Keyboard shortcut labels: `.cmd-kbd` class
- Keep existing search logic and keyboard bindings intact

**Agent: Kanban Board**
- Read `components/KanbanBoard.jsx`
- Apply `.kanban` wrapper + `.kanban-col` columns + `.kanban-card` cards
- Column headers: `.kanban-header` + `.kanban-count` pill
- Cards: `.vc` surface + `.kanban-tag` for category chips
- Tag colors: todo=neutral, in-progress=amber, review=mint, done=crimson

**Agent: Logo**
- Read `components/Logo.jsx`
- Extract the animated SVG from playground section "Logo & Brand Animations"
  (search `id="logo-svg"` in playground HTML)
- Implement the geometric wireframe hands SVG as the primary logo
- Left hand: `#FF2D6B` crimson strokes
- Right hand: `#00F5D4` mint strokes
- Center node: `#FFB800` amber
- E letterform: 3 horizontal bars above center
- Animation mode: `pulse` (default) — scale 1→1.04→1 at 2s interval
- Export 3 sizes: `size="sm"` (24px) `size="md"` (48px) `size="lg"` (80px)

---

### Wave 6 — Icon System

**Agent: Icons**
- The playground icon system shows styled containers with Lucide icons
- Apply `.vc-icon` class to all icon wrapper divs in the app
- Add to `vc-components.css`:
  ```css
  .vc-icon { width:36px; height:36px; border-radius:8px; display:grid; place-items:center; flex-shrink:0; }
  .vc-icon-crimson { background:var(--cd); color:var(--c); }
  .vc-icon-mint    { background:var(--md); color:var(--m); }
  .vc-icon-amber   { background:var(--ad); color:var(--a); }
  .vc-icon-neutral { background:var(--b1); color:var(--t1); }
  .vc-icon-sm  { width:28px; height:28px; border-radius:6px; font-size:12px; }
  .vc-icon-lg  { width:48px; height:48px; border-radius:10px; font-size:20px; }
  ```
- Icon color assignment for Entomate:
  - Meetings/Mic → `vc-icon-crimson`
  - AI/Bot/Sparkles → `vc-icon-amber`
  - Tasks/CheckSquare → `vc-icon-mint`
  - Analytics/BarChart → `vc-icon-mint`
  - Search → `vc-icon-neutral`
  - Settings → `vc-icon-neutral`
  - Goals/Target → `vc-icon-crimson`
  - Workflows/Zap → `vc-icon-amber`
  - Calendar → `vc-icon-neutral`
  - Projects/FolderKanban → `vc-icon-mint`

---

### Wave 7 — QA & Verification

**Agent: QA Checker**
After all other agents complete:
1. Check that `vc-components.css` is imported in `main.jsx`
2. Verify `.vc` class applied to all card/panel elements
3. Verify all `<button>` elements use `<VCButton>` or `.vbtn` class
4. Verify all status pills use `<VCBadge>` or `.vbadge` class
5. Verify no hardcoded hex colors in JSX (use CSS vars instead)
6. Run `npm run build` in `frontend/` and report any errors
7. Check for style conflicts between `navigation.css`, `main.css`, `vc-components.css`

---

## EXECUTION ORDER

```
Wave 1: CSS Foundation + VC Library        (parallel)
Wave 2: Layout Shell                       (after Wave 1)
Wave 3: Dashboard + Meetings               (after Wave 1, parallel)
Wave 4: SharedUI + Forms                   (after Wave 1, parallel)
Wave 5: CommandPalette + Kanban + Logo     (after Wave 2, parallel)
Wave 6: Icon System                        (after Wave 1)
Wave 7: QA + Build Verification            (after all waves)
```

---

## KEY RULES FOR ALL AGENTS

1. **Never hardcode hex colors** — always use CSS custom properties (`var(--c)`, `var(--m)`, etc.)
2. **Never break routing or auth** — only modify styles and layout, not React Router or Clerk logic
3. **Preserve all existing props** — only ADD className/style, don't remove existing functionality
4. **Reference the playground** — for any ambiguity, read the relevant section of `output/void-crimson-playground.html`
5. **Dark mode only** — `data-theme="dark"` is the default; light mode is secondary
6. **No new dependencies** — use only what's already in `package.json`

---

## INVOCATION

```
/rebuild-ui
/rebuild-ui layout        # only rebuild Layout.jsx
/rebuild-ui dashboard     # only rebuild Dashboard
/rebuild-ui css           # only rebuild CSS foundation
/rebuild-ui icons         # only rebuild icon system
/rebuild-ui logo          # only rebuild Logo.jsx
/rebuild-ui qa            # only run QA verification
```
