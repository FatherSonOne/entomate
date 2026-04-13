# ENTOMATE DASHBOARD AUDIT — 2026-03-30

## Executive Summary

The Entomate Dashboard (`frontend/src/pages/Dashboard.jsx`, ~450 lines) is a clean, focused command center with a striking dark theme, neon ring gauges, typewriter greeting, intelligence briefing, meeting recorder, and real-time stats. The **visual design is excellent** — void-crimson aesthetic, gradient hero, animated ring gauges, and the overall layout is sharp and purposeful.

However, the dashboard operates at roughly **40-50% of its potential**. There are **3 critical wiring bugs** (hardcoded automation count, non-functional task checkboxes, unused dashboard API endpoints), and **15+ backend services** (ecosystem bridge, CRM integration, deal probability, customer health, coaching, alerts, etc.) that are completely absent from the dashboard despite being production-ready. The backend has a dedicated `dashboardApi` with 6 endpoints (summary, projects, action items, team workload, overdue, insights) that the frontend Dashboard.jsx **never calls**.

**Verdict:** Visually stunning, functionally incomplete. The biggest wins are wiring the existing `dashboardApi` endpoints and surfacing the rich intelligence/analytics service layer.

---

## 1. File Inventory

### Frontend Dashboard Files
| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Dashboard.jsx` | 450 | Main dashboard page |
| `frontend/src/pages/ProjectDashboard.jsx` | 573 | Per-project dashboard |
| `frontend/src/components/intelligence/IntelligenceDashboard.jsx` | 573 | AI intelligence widget (4 card types) |
| `frontend/src/components/intelligence/MeetingPrepCard.jsx` | ~200 | Meeting prep intelligence card |
| `frontend/src/components/intelligence/DealRiskAlertCard.jsx` | ~200 | Deal risk alert card |
| `frontend/src/components/intelligence/ActionItemStatusCard.jsx` | ~200 | Action item tracking card |
| `frontend/src/components/intelligence/RelationshipInsightCard.jsx` | ~200 | Relationship insight card |
| `frontend/src/components/intelligence/QuickScheduleModal.jsx` | ~150 | Quick schedule modal |
| `frontend/src/components/intelligence/QuickTaskModal.jsx` | ~150 | Quick task creation modal |
| `frontend/src/components/intelligence/ReassignModal.jsx` | ~150 | Task reassignment modal |
| `frontend/src/components/intelligence/LearningInsightsWidget.jsx` | ~200 | AI learning patterns widget |
| `frontend/src/components/learning/LearningDashboard.jsx` | 383 | Full learning dashboard |
| `frontend/src/components/MeetingRecorder.jsx` | ~400 | Meeting recorder component |
| `frontend/src/services/api.js` | 985 | API client (dashboardApi lines 509-533) |

### Backend Dashboard Files
| File | Lines | Role |
|------|-------|------|
| `backend/routes/dashboard.js` | 530 | Dashboard API (6 endpoints) |
| `backend/routes/intelligence.js` | 421 | Intelligence API |
| `backend/routes/analytics.js` | 501 | Analytics API |
| `backend/services/intelligenceService.js` | 786 | Core intelligence engine |
| `backend/services/intelligence/DealRiskService.js` | 686 | Deal risk scoring |
| `backend/services/intelligence/MeetingPrepService.js` | 625 | Meeting prep intelligence |
| `backend/services/intelligence/RelationshipIntelligenceService.js` | 574 | Stakeholder classification |
| `backend/services/intelligence/ActionItemTrackerService.js` | 567 | Action item tracking + nudges |
| `backend/services/learning/PatternDetectionService.js` | 529 | AI learning patterns |
| `backend/services/learning/LearningEngine.js` | 375 | Learning engine core |

**Total dashboard-related code: ~8,000+ lines across 24+ files**

---

## 2. Architecture Map

```
Dashboard.jsx (450 lines)
├── [Hook] useTypewriter — animated greeting rotation
│
├── [Hero] DashboardHero
│   ├── Greeting panel (typewriter + date)
│   ├── IntelligenceBriefCard (meetings/tasks/projects bullet summary)
│   └── 2x2 RingGauge grid
│       ├── Meetings (crimson) — from meetingsApi.list().count
│       ├── Tasks (amber) — from tasksApi.list().count
│       ├── Projects (mint) — from projectsApi.list().count
│       └── Automations (phosphor) — HARDCODED value:3 !!!
│
├── [Bar] QuickActionsBar
│   ├── Start Meeting → scroll to recorder
│   ├── New Task → /tasks
│   ├── New Project → /projects
│   ├── AI Insights → /reports
│   └── Automations → /automations
│
├── [Widget] IntelligenceDashboard (embedded, self-loading)
│   ├── api.intelligence.getDashboard() → backend
│   ├── MeetingPrepCard(s) — upcoming meeting intelligence
│   ├── DealRiskAlertCard(s) — deal risk alerts
│   ├── ActionItemStatusCard — action item tracking
│   ├── RelationshipInsightCard(s) — stakeholder insights
│   ├── CustomizationModal — toggle card types, filters
│   ├── QuickScheduleModal, QuickTaskModal, ReassignModal
│   └── Auto-refresh every 5 minutes
│
├── [Widget] LearningInsightsWidget (conditional on data)
│   └── learningApi.getInsights()
│
├── [Bar] SystemStatus
│   └── checkHealth() → AI (gemini) + DB status dots
│
└── [Grid] Main Content (3-column)
    ├── MeetingRecorder — audio recording component
    ├── Recent Meetings — meetingsApi.list(limit:5) with sentiment badges
    └── Open Tasks — tasksApi.list(limit:5, status:'open')
        └── Checkboxes have NO onChange handler !!!

Backend API (dashboard.js — 530 lines, 6 endpoints):
├── GET /api/dashboard/summary — quick stats (meetings, items, overdue)
├── GET /api/dashboard/projects — project list with statistics
├── GET /api/dashboard/projects/:id — project detail
├── GET /api/dashboard/action-items — filterable action items
├── PATCH /api/dashboard/action-items/:id — update status
├── GET /api/dashboard/team-workload — team member workload
├── GET /api/dashboard/overdue — overdue items with days count
└── GET /api/dashboard/insights — trends, sentiment, priorities, status counts

Frontend dashboardApi (api.js lines 509-533):
├── getSummary() ─── NEVER CALLED by Dashboard.jsx
├── getProjects() ─── NEVER CALLED
├── getProject(id) ── NEVER CALLED
├── getActionItems() ── NEVER CALLED
├── updateActionItemStatus() ── NEVER CALLED
├── getTeamWorkload() ── NEVER CALLED
├── getOverdue() ─── NEVER CALLED
└── getInsights() ── NEVER CALLED
```

---

## 3. Feature Status Catalog

| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Typewriter Greeting | ✅ Working | Animated phrase rotation, time-aware |
| 2 | Ring Gauges (Meetings) | ✅ Working | Real count from `meetingsApi.list()` |
| 3 | Ring Gauges (Tasks) | ✅ Working | Real count from `tasksApi.list()` |
| 4 | Ring Gauges (Projects) | ✅ Working | Real count from `projectsApi.list()` |
| 5 | Ring Gauges (Automations) | ❌ Hardcoded | `value: 3` on line 201 — never fetched |
| 6 | Intelligence Brief Card | ✅ Working | Dynamic bullets based on real stats |
| 7 | Quick Actions Bar | ✅ Working | 5 actions, all navigate correctly |
| 8 | Intelligence Dashboard | ✅ Working | Self-loading via `api.intelligence.getDashboard()` |
| 9 | Meeting Prep Cards | ✅ Working | Shows upcoming meetings with AI context |
| 10 | Deal Risk Alerts | ✅ Working | Risk scoring with action buttons |
| 11 | Action Item Tracking | ✅ Working | Status tracking with nudge/reassign |
| 12 | Relationship Insights | ✅ Working | Stakeholder classification + actions |
| 13 | Intelligence Customization | ✅ Working | Toggle cards, filter risk levels, time horizon |
| 14 | Learning Insights Widget | ✅ Working | Shows if `learningApi.getInsights()` returns data |
| 15 | System Status Bar | ✅ Working | AI + DB connection status |
| 16 | Meeting Recorder | ✅ Working | Audio recording with callback |
| 17 | Recent Meetings List | ✅ Working | Last 5 meetings with sentiment badges |
| 18 | Open Tasks List | ⚠️ Partial | Shows tasks but **checkboxes do nothing** |
| 19 | Dashboard Summary API | ❌ Not Wired | `dashboardApi.getSummary()` exists, never called |
| 20 | Team Workload Widget | ❌ Not Wired | `dashboardApi.getTeamWorkload()` exists, no UI |
| 21 | Overdue Items Widget | ❌ Not Wired | `dashboardApi.getOverdue()` exists, no UI |
| 22 | Dashboard Insights/Trends | ❌ Not Wired | `dashboardApi.getInsights()` exists, no UI |
| 23 | Ecosystem Bridge Status | ❌ Missing | `ecosystemBridge.js` (478 lines) not shown |
| 24 | CRM Integration Status | ❌ Missing | `crmService.js` (421 lines) not shown |
| 25 | Deal Probability Predictions | ❌ Missing | `dealProbability.ts` (362 lines) not shown |
| 26 | Task ETA Predictions | ❌ Missing | `taskEta.ts` (250 lines) not shown |
| 27 | Customer Health Scores | ❌ Missing | `healthService.ts` (560 lines) not shown |
| 28 | Meeting Coaching Status | ❌ Missing | `coachingService.ts` (711 lines) not shown |
| 29 | Sentiment Trends | ❌ Missing | `sentimentService.ts` (479 lines) not shown |
| 30 | Alert System Widget | ❌ Missing | `alertsService.ts` (625 lines) not shown |
| 31 | Report Generation | ❌ Missing | `reportService.js` (433 lines) not shown |
| 32 | Goals Progress | ❌ Missing | Goals page exists, no dashboard summary |
| 33 | Workflow Status | ❌ Missing | Workflow engine exists, no dashboard widget |
| 34 | Agent Activity Feed | ❌ Missing | 20+ agent templates, no activity on dashboard |
| 35 | Cross-App Search | ❌ Missing | `crossAppSearch.js` (715 lines) not shown |

**Score: 15 working / 2 partial / 18 missing = 35 total features**

---

## 4. Issues Found

### 🔴 Critical (Broken Functionality)

**C1. Automations Ring Gauge is Hardcoded**
- Line 201: `{ label:'Auto', value:3, max:10, ... }`
- The value `3` is a static number, never fetched from any API
- Should call `automationsApi.list()` or equivalent and use `count`
- **Fix:** Add automations count to `loadData()` and wire it

**C2. Task Checkboxes Have No onChange Handler**
- Line 425-427: `<input type="checkbox" />` with no onChange or onClick
- Clicking the checkbox does nothing — task cannot be completed from dashboard
- **Fix:** Add `onChange` that calls `tasksApi.complete(task.id)` then reloads

**C3. Entire dashboardApi is Never Called**
- `frontend/src/services/api.js` lines 509-533 defines 6 dashboard endpoints
- `backend/routes/dashboard.js` (530 lines) implements them all
- Dashboard.jsx imports from `meetingsApi, tasksApi, projectsApi` instead
- **These endpoints provide**: summary stats, team workload, overdue items, insights/trends, action item kanban
- **Fix:** Wire `dashboardApi.getSummary()`, `dashboardApi.getOverdue()`, `dashboardApi.getTeamWorkload()`, `dashboardApi.getInsights()` into the dashboard

### 🟡 Medium (Missing Wiring, Feature Gaps)

**M1. No Overdue Items Alert**
- Backend has `GET /api/dashboard/overdue` returning items with `days_overdue` counts
- Dashboard shows no overdue warning — this is critical operational data
- **Fix:** Add an overdue items banner/widget below the hero section

**M2. No Team Workload Widget**
- Backend has `GET /api/dashboard/team-workload` returning per-member stats
- Dashboard has no team workload visibility
- **Fix:** Add a team workload bar chart or member cards widget

**M3. No Insights/Trends Charts**
- Backend has `GET /api/dashboard/insights` returning: sentiment counts, priority breakdown, status counts, trend data, aggregate metrics (avg progress, completion rate)
- Dashboard has no charts or trend visualization
- **Fix:** Add a trends section using Recharts (already in dependencies!)

**M4. No Ecosystem Bridge Status**
- `ecosystemBridge.js` (478 lines) + `ecosystemScheduler.js` (106 lines) handle cross-app communication
- Dashboard shows AI + DB status but no ecosystem connection status
- **Fix:** Add Pulse/Logos Vision connection indicators to SystemStatus bar

**M5. No Goals Progress Summary**
- Goals page exists at `/goals` with full API support
- Dashboard has no goals summary or progress indicator
- **Fix:** Add a goals mini-widget or ring gauge row

**M6. No Workflow/Automation Activity**
- Rich workflow engine (WorkflowExecutor, WorkflowScheduler, 1,748-line templates)
- Dashboard shows only a hardcoded "3" for automations
- **Fix:** Show recent automation runs, success/failure rates, active workflow count

**M7. No Agent Activity Feed**
- 20+ agent templates (followup, deadline, priority, assignment, deal risk, etc.)
- Agent orchestrator and runner services exist
- No agent activity or recommendations visible on dashboard
- **Fix:** Add an "Agent Activity" feed showing recent agent actions

**M8. No Deal Probability / Task ETA Predictions**
- `dealProbability.ts` (362 lines) and `taskEta.ts` (250 lines) exist in `src/analytics/`
- Dashboard shows no predictive data
- **Fix:** Add prediction indicators to meetings list and task list items

**M9. No Customer Health Indicators**
- `healthService.ts` (560 lines) calculates composite health scores
- `alertsService.ts` (625 lines) monitors health and triggers alerts
- None surfaced on dashboard
- **Fix:** Add a customer health summary card or alert banner

**M10. Intelligence Brief Automation Line is Semi-Hardcoded**
- Line 118: `{ dot:'var(--p)', text:'3 automation workflows running — follow-up detection enabled' }`
- Always shows "3 automation workflows" regardless of actual count
- **Fix:** Pass actual automation count and generate dynamic text

**M11. No CRM Integration Status**
- `crmService.js` (421 lines) supports HubSpot, Salesforce, Pipedrive
- Dashboard has no CRM sync status or recent CRM activity
- **Fix:** Add CRM sync indicator to system status or as its own widget

**M12. Intelligence Dashboard Preferences Not Persisted**
- `IntelligenceDashboard.jsx` stores preferences in component state
- Lost on page navigation — should persist to localStorage or Supabase
- **Fix:** Save/load preferences from localStorage

### 🟢 Nice-to-Have (Polish, Optimizations)

**N1. SentimentTrendMini Component Exists But Unused on Dashboard**
- `SentimentTrendMini.jsx` exists in the intelligence folder
- Could add inline sentiment trend sparklines to the meetings list

**N2. PredictionGauge Component Exists But Unused on Dashboard**
- `PredictionGauge.jsx` exists — could show deal close probability

**N3. BlockingChainDiagram Exists But Unused on Dashboard**
- Visual diagram for blocked task chains — could enhance action item view

**N4. No Keyboard Shortcuts on Dashboard**
- `useKeyboardShortcuts` hook exists but not used on dashboard
- R = refresh, N = new meeting, T = new task would be useful

**N5. Report Generation Not Accessible from Dashboard**
- `reportService.js` can generate PDF/CSV reports
- No "Export" or "Generate Report" action on dashboard

**N6. No Real-Time Updates**
- Dashboard loads data once on mount, no WebSocket/polling for live updates
- Could use Supabase realtime subscriptions for instant task/meeting updates

---

## 5. Envisioned New Dashboard Widgets

### 5A. Overdue Alert Banner
Red/amber banner below hero showing overdue items count with urgency indicator. Clicking expands to show the list with assignees and days overdue. Uses `dashboardApi.getOverdue()`.

### 5B. Insights & Trends Panel
Recharts-powered section showing: task completion trends (area chart), sentiment breakdown (donut), priority distribution (bar chart), overall completion rate. Uses `dashboardApi.getInsights()`.

### 5C. Team Workload Bars
Horizontal bar chart showing each team member's assigned items, in-progress count, and high-priority items. Visual overload indicators. Uses `dashboardApi.getTeamWorkload()`.

### 5D. Ecosystem Connections
Extend SystemStatus bar: show Pulse (rose dot), Entomate (crimson), Logos Vision (teal) connection status with last-sync timestamps. Uses `ecosystemBridge.js`.

### 5E. Active Goals Ring
Add a 5th ring gauge or a mini goals section: show top 3 goals with progress, linked to `/goals` page.

### 5F. Automation Activity Feed
Replace hardcoded "3" with real-time automation data: active workflow count, last 3 run results (success/fail), next scheduled run. Uses automation APIs.

### 5G. Agent Recommendations Panel
Surface top 3 agent recommendations (from followup, priority, deadline agents) as actionable cards. "Accept" applies the recommendation, "Dismiss" logs feedback.

### 5H. Customer Health Summary
Top 5 at-risk customers with health scores, trend arrows, and one-click action buttons (schedule call, send follow-up). Uses `healthService.ts`.

### 5I. Predictive Insights Mini
Small panel showing: highest-probability deal to close, most-likely-to-slip task, suggested focus for today. Uses `dealProbability.ts` + `taskEta.ts`.

### 5J. Quick Keyboard Shortcuts
Floating indicator or footer showing: `R` refresh, `N` new meeting, `T` new task, `K` search, making the dashboard keyboard-navigable.

---

## 6. Phased Revisal Plan

### Phase 1: Fix Critical Wiring Bugs (1 session)
1. **Wire automations count** — Add `automationsApi.list({ limit: 1 })` to `loadData()`, use count for ring gauge
2. **Fix task checkboxes** — Add `onChange` handler that calls `tasksApi.complete(task.id)` then reloads
3. **Fix intelligence brief automation text** — Pass actual count instead of hardcoded "3"
4. **Persist intelligence preferences** — Save to localStorage in `IntelligenceDashboard.jsx`

### Phase 2: Wire Existing Dashboard API (2-3 sessions)
5. **Wire `dashboardApi.getSummary()`** — Replace individual API calls with the summary endpoint for hero stats
6. **Add Overdue Alert Banner** — Call `dashboardApi.getOverdue()`, render red banner with count + expandable list
7. **Add Team Workload Widget** — Call `dashboardApi.getTeamWorkload()`, render horizontal bars
8. **Add Insights & Trends Panel** — Call `dashboardApi.getInsights()`, render Recharts (already a dependency) with sentiment donut, priority bars, completion trend
9. **Wire action item completion** — Use `dashboardApi.updateActionItemStatus()` for task checkboxes

### Phase 3: Integrate Existing Services (3-4 sessions)
10. **Add Ecosystem Status** — Wire `ecosystemBridge.js`, show Pulse + Logos Vision connection dots in SystemStatus
11. **Add Goals Progress** — Wire goals API, add ring gauge or mini progress section
12. **Add Automation Activity Feed** — Wire automation APIs, replace hardcoded data with real workflow runs
13. **Add Agent Activity Panel** — Surface agent recommendations and recent actions
14. **Add CRM Sync Status** — Wire `crmService.js`, show connected CRM provider + last sync
15. **Surface existing components** — Wire `SentimentTrendMini`, `PredictionGauge` into meetings/tasks lists

### Phase 4: New Intelligence Features (4-5 sessions)
16. **Customer Health Summary** — Wire `healthService.ts` + `alertsService.ts`, show at-risk customers
17. **Predictive Insights** — Wire `dealProbability.ts` + `taskEta.ts`, show predictions
18. **Coaching Status** — Wire `coachingService.ts`, show coaching availability indicator
19. **Cross-App Search** — Add search bar that uses `crossAppSearch.js` for ecosystem-wide search
20. **Keyboard shortcuts** — Wire `useKeyboardShortcuts` hook for dashboard navigation
21. **Real-time updates** — Add Supabase realtime subscriptions for live task/meeting updates

---

## 7. Claude Agent Execution Prompt

```markdown
# Entomate Dashboard Enhancement Execution Plan

You are enhancing the Entomate Dashboard at `frontend/src/pages/Dashboard.jsx` (~450 lines).
The project is at `f:\entomate`, a React/Express/Supabase app.
Frontend: React 18, React Router 6, Tailwind CSS, Recharts, Lucide icons
Backend: Express.js, Supabase, Google Gemini, OpenAI

## CRITICAL STYLE CONSTRAINT
The user explicitly loves the current dashboard visual design. DO NOT change the aesthetic.
Preserve: void-crimson dark theme, neon ring gauges, gradient hero, typewriter animation,
vc card class, VCBadge component, CSS custom properties (--c, --m, --a, --p, --t0, --t1, --t2),
neo-morphism shadows, system status monospace font, all existing color palette.
All new widgets must use the `vc` card class and match existing visual patterns EXACTLY.

## Phase 1: Fix Critical Wiring Bugs

### Task 1.1: Wire Automations Ring Gauge
File: `frontend/src/pages/Dashboard.jsx`
- In `loadData()`, add automations count fetch:
  ```javascript
  const automations = await automationsApi.list({ limit: 1 }).catch(() => ({ count: 0 }))
  ```
- Add to stats: `automations: automations.count || 0`
- Line 201: Change `value:3` to `value:stats.automations`
- Line 201: Change `max:10` to `max:Math.max(stats.automations, 10)`
- Import `automationsApi` is already done (line 10)

### Task 1.2: Fix Task Checkboxes
File: `frontend/src/pages/Dashboard.jsx`
- Line 425-427: Add onChange handler to checkbox:
  ```javascript
  <input
    type="checkbox"
    onChange={async () => {
      try {
        await tasksApi.complete(task.id)
        loadData()
      } catch (err) {
        console.error('Failed to complete task:', err)
      }
    }}
    style={{ width:13, height:13, accentColor:'var(--c)', flexShrink:0, cursor:'pointer' }}
  />
  ```
- Verify `tasksApi.complete` exists in api.js. If not, check for equivalent method.

### Task 1.3: Fix Hardcoded Intelligence Brief Text
File: `frontend/src/pages/Dashboard.jsx`
- Line 118: Replace hardcoded automation text:
  ```javascript
  // Before:
  { dot:'var(--p)', text:'3 automation workflows running — follow-up detection enabled' }
  // After: (IntelligenceBriefCard receives automations prop)
  automations > 0
    ? { dot:'var(--p)', text:`${automations} automation workflow${automations !== 1 ? 's' : ''} running — follow-up detection enabled` }
    : { dot:'var(--t2)', text:'No automations configured — set up workflows to automate follow-ups' }
  ```
- Pass `automations` count to `IntelligenceBriefCard` as a new prop

### Task 1.4: Persist Intelligence Preferences
File: `frontend/src/components/intelligence/IntelligenceDashboard.jsx`
- Line 49: Load preferences from localStorage:
  ```javascript
  const [preferences, setPreferences] = useState(() => {
    try {
      const saved = localStorage.getItem('entomate_intelligence_prefs')
      return saved ? JSON.parse(saved) : { /* defaults */ }
    } catch { return { /* defaults */ } }
  })
  ```
- In CustomizationModal `handleSave`, add:
  ```javascript
  localStorage.setItem('entomate_intelligence_prefs', JSON.stringify(localPrefs))
  ```

## Phase 2: Wire Existing Dashboard API

### Task 2.1: Wire Dashboard Summary
File: `frontend/src/pages/Dashboard.jsx`
- Import `dashboardApi` from api.js (add to line 10)
- In `loadData()`, add: `const summary = await dashboardApi.getSummary().catch(() => ({ data: {} }))`
- Use summary data for ring gauges instead of individual list calls
- This provides: meetings count, actionItems count, openItems count, overdue count

### Task 2.2: Add Overdue Alert Banner
File: `frontend/src/pages/Dashboard.jsx`
- In `loadData()`, add: `const overdue = await dashboardApi.getOverdue().catch(() => ({ data: { overdue: [], count: 0 } }))`
- Add state: `const [overdueItems, setOverdueItems] = useState([])`
- Render below QuickActionsBar if count > 0:
  - Use `vc` card class with red left border (`borderLeft: '2px solid var(--c)'`)
  - Show: "{count} overdue items" with expand/collapse to see list
  - Each item: task description, assignee, days overdue badge (red VCBadge)
  - Click item → navigate to task detail

### Task 2.3: Add Team Workload Widget
File: `frontend/src/pages/Dashboard.jsx`
- In `loadData()`, add: `const workload = await dashboardApi.getTeamWorkload().catch(() => ({ data: { workload: [] } }))`
- Add to main grid (or as a new row below):
  - `vc` card with header "Team Workload"
  - Horizontal bars for each team member showing assigned/in-progress/completed
  - Color code: crimson for high-priority, amber for medium, mint for completed
  - Use inline CSS widths matching existing vc pattern

### Task 2.4: Add Insights & Trends Panel
File: `frontend/src/pages/Dashboard.jsx`
- Import `{ BarChart, Bar, PieChart, Pie, Cell, ResponsiveContainer }` from 'recharts'
- In `loadData()`, add: `const insights = await dashboardApi.getInsights().catch(() => ({ data: {} }))`
- Render as a `vc` card with 3 mini-charts:
  - Sentiment donut (3 colors: mint=positive, amber=neutral, crimson=negative)
  - Priority bar chart (crimson=high, amber=medium, phosphor=low)
  - Completion rate ring (reuse RingGauge component!)
- Use RING_COLORS palette for consistency

### Task 2.5: Wire Action Item Completion
- When task checkbox is checked, also call `dashboardApi.updateActionItemStatus(task.id, 'done')`
- This updates the action_items table for the intelligence dashboard to pick up

## Phase 3: Integrate Existing Services

### Task 3.1: Add Ecosystem Status to SystemStatus
File: `frontend/src/pages/Dashboard.jsx`
- In SystemStatus component (line 264), add ecosystem app indicators:
  - Pulse (crimson dot), Entomate (mint dot), Logos Vision (teal dot)
  - Status from ecosystem health endpoint or config
  - Show last sync timestamp if available

### Task 3.2: Add Goals Progress Ring
- Fetch from goals API
- Add 5th ring gauge or a mini goals section below hero
- Show: active goals count, average progress percentage

### Task 3.3: Add Automation Activity Feed
- Replace hardcoded automation data with real workflow run history
- Small `vc` card showing last 3-5 automation runs with status badges
- Link to `/automations` for full view

### Task 3.4: Surface Existing UI Components
- Add `SentimentTrendMini` sparklines to recent meetings list items
- Add `PredictionGauge` to deals when available
- These components already exist in `frontend/src/components/intelligence/`

## Key Files Reference
- Dashboard: `frontend/src/pages/Dashboard.jsx`
- API Client: `frontend/src/services/api.js` (dashboardApi lines 509-533)
- Backend Dashboard Routes: `backend/routes/dashboard.js`
- Intelligence Dashboard: `frontend/src/components/intelligence/IntelligenceDashboard.jsx`
- Intelligence Cards: `frontend/src/components/intelligence/` (17 components)
- Learning Dashboard: `frontend/src/components/learning/LearningDashboard.jsx`
- Backend Intelligence: `backend/services/intelligence/` (4 services)
- Backend Learning: `backend/services/learning/` (4 services)
- Ecosystem Bridge: `backend/services/ecosystemBridge.js`
- Analytics: `src/analytics/` (dealProbability.ts, taskEta.ts)
- Phase 3 Services: `src/phase3/` (health, coaching, sentiment, alerts)
- VC Design System: Uses `vc` card class, CSS variables (--c, --m, --a, --p, --t0-t2)
- Ring Gauge Colors: crimson (#FF2D6B), mint (#00F5D4), amber (#FFB800), phosphor (#A0FF32)
```

---

## Appendix: Backend Services Available But Not on Dashboard

| Service | Lines | What It Does | Dashboard Opportunity |
|---------|-------|-------------|----------------------|
| `dashboardApi` (frontend) | 25 | Summary, workload, overdue, insights | **Wire all 6 endpoints** |
| `dashboard.js` (backend) | 530 | Full dashboard API with views | Already built, just needs frontend |
| `ecosystemBridge.js` | 478 | Cross-app HTTP communication | Ecosystem status dots |
| `crmService.js` | 421 | HubSpot/Salesforce/Pipedrive sync | CRM sync indicator |
| `reportService.js` | 433 | PDF/CSV report generation | Export button on dashboard |
| `DealRiskService.js` | 686 | AI deal risk scoring | Already in IntelligenceDashboard |
| `MeetingPrepService.js` | 625 | AI meeting prep intelligence | Already in IntelligenceDashboard |
| `RelationshipIntelligenceService.js` | 574 | Stakeholder classification | Already in IntelligenceDashboard |
| `ActionItemTrackerService.js` | 567 | Blocking chain detection + nudges | Already in IntelligenceDashboard |
| `PatternDetectionService.js` | 529 | AI learning pattern detection | In LearningInsightsWidget |
| `OutcomeTracker.js` | 424 | Outcome measurement | Could add outcome metrics |
| `healthService.ts` | 560 | Customer health scores | Health summary card |
| `coachingService.ts` | 711 | Real-time meeting coaching | Coaching status indicator |
| `sentimentService.ts` | 479 | AI sentiment analysis | Sentiment trend widget |
| `alertsService.ts` | 625 | Health monitoring + alerts | Alert banner |
| `dealProbability.ts` | 362 | Deal close probability model | Prediction indicators |
| `taskEta.ts` | 250 | Task completion ETA model | ETA badges on tasks |
| `crossAppSearch.js` | 715 | Ecosystem-wide search | Search bar enhancement |

**Total unused/unwired service code: ~8,000+ lines of production-ready functionality**
