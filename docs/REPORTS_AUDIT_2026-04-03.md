# Reports Section Audit

**Date:** 2026-04-03
**Auditor:** Claude Code (Opus 4.6)
**Section:** Reports & Export
**Verdict:** Mostly functional with one critical auth flaw in downloads

---

## 1. File Inventory

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Reports.jsx` | 460 | Main Reports page UI |
| `frontend/src/services/api.js` (L555-598) | 44 | `reportsApi` frontend API layer |
| `backend/routes/reports.js` | 490 | Express route handlers (7 GET, 2 POST) |
| `backend/services/reportService.js` | 433 | PDF generation (pdfkit) + CSV generation (json2csv) |
| `backend/services/schedulerService.js` | 364 | Cron-based weekly summary & overdue alerts |
| `backend/services/emailService.js` | 394 | Nodemailer email sending (recap, summary, goal update) |
| `frontend/src/components/learning/EffectivenessReport.jsx` | 337 | Learning effectiveness report (separate subsystem) |
| **Total** | **2,478** | |

**Cross-references (other pages consuming reportsApi):**
- `frontend/src/pages/Analytics.jsx` — uses `reportsApi.downloadMeetingsCSV()`, `downloadActionItemsCSV()`
- `frontend/src/pages/Goals.jsx` — uses `reportsApi.downloadGoalsPDF()`, `downloadGoalsCSV()`

---

## 2. Architecture

```
Frontend (React)                       Backend (Express)                    External
=========================              ===========================          ===========

Reports.jsx ─────────────┐
  loadData() ────────────┼─── GET /api/meetings ──────────┐
                         │    GET /api/goals ──────────────┤
                         │                                 │
  handleDownload() ──────┼─── window.open(url) ───────────┼──> GET /api/reports/...
                         │    (no auth header!)            │
                         │                                 v
                         │                           ┌──────────────┐
reportsApi ──────────────┘                           │  Supabase DB │
  .downloadMeetingPDF(id) ──> returns URL string     │  - meetings  │
  .downloadGoalsPDF(q)   ──> returns URL string      │  - action_   │
  .downloadWeeklyPDF()   ──> returns URL string      │    items     │
  .downloadMeetingsCSV() ──> returns URL string      │  - goals     │
  .downloadActionItemsCSV()                          │  - tasks     │
  .downloadGoalsCSV()                                └──────────────┘
                                                           │
                                       reportService.js    │
                                         .generateMeetingRecapPDF()
                                         .generateGoalsReportPDF()
                                         .generateProjectReportPDF()
                                         .generateWeeklySummaryPDF()
                                         .generateMeetingsCSV()
                                         .generateActionItemsCSV()
                                         .generateGoalsCSV()
                                                           │
                                       schedulerService.js │
                                         cron: weekly summary (Mon 9AM)
                                         cron: overdue check (daily 8AM)
                                         cron: overdue tasks (daily 9AM)
                                                  │
                                       emailService.js
                                         nodemailer -> SMTP
                                         .sendWeeklySummary()
                                         .sendMeetingRecap()
                                         .sendGoalUpdate()
                                         .sendOverdueAlert()
```

**State Management:** Local `useState` only (no global store). Data loaded on mount via `useEffect`.

---

## 3. Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| Meeting Recap PDF | ⚠️ Partial | Backend works, but `window.open()` bypasses auth — 401 |
| Goals & OKRs PDF | ⚠️ Partial | Same auth issue; quarter filter works in backend |
| Weekly Summary PDF | ⚠️ Partial | Same auth issue |
| Project Report PDF | 🔇 Stub | Backend route exists (`/project/:id/pdf`), no UI for it |
| Meetings CSV Export | ⚠️ Partial | Same `window.open()` auth bypass |
| Action Items CSV Export | ⚠️ Partial | Same auth issue; backend supports `status`/`meetingId` filters, UI sends no params |
| Goals CSV Export | ⚠️ Partial | Same auth issue; backend supports `quarter`/`type` filters, UI sends no params |
| Quick Stats (counts) | ✅ Working | Renders meeting count, goal count, completed count, avg progress |
| Meeting selector dropdown | ✅ Working | Populated from `meetingsApi.list()` |
| Quarter selector dropdown | ✅ Working | Generates dynamic Q options |
| Scheduler: weekly summary email | ⚠️ Partial | Code complete, requires env vars `ENABLE_WEEKLY_SUMMARY=true` + SMTP config |
| Scheduler: overdue action items alert | ⚠️ Partial | Code complete, requires env vars `ENABLE_OVERDUE_ALERTS=true` + SMTP config |
| Scheduler: overdue tasks alert | ⚠️ Partial | Runs by default but only logs — email sending stubbed out |
| Send meeting recap via email | ⚠️ Partial | Backend route exists (`POST /send-meeting-recap`), no UI |
| Available reports endpoint | ✅ Working | `GET /api/reports/available` returns metadata |
| Scheduler status endpoint | ✅ Working | `GET /api/reports/scheduler/status` |
| Manual trigger endpoints | ✅ Working | POST routes for testing scheduler jobs |
| EffectivenessReport component | ✅ Working | Separate subsystem for learning patterns — not part of Reports page |

---

## 4. Issues Found

### 4.1 Critical (Red)

#### R1: `window.open()` downloads bypass authentication — all downloads return 401
**Files:** `frontend/src/pages/Reports.jsx:72`, `frontend/src/services/api.js:557-597`
**Details:** The `reportsApi` methods return raw URL strings. The frontend calls `window.open(url, '_blank')` which opens a new tab with **no Authorization header**. The backend `authenticate` middleware requires `Bearer` token in the Authorization header. Result: **every PDF/CSV download fails with 401 Unauthorized**.

**Fix:** Use `fetch()` with the auth token, receive the blob, then trigger download via `URL.createObjectURL()` + programmatic `<a>` click.

---

#### R2: No RLS / user-scoping on Supabase queries — any authenticated user can export all data
**Files:** `backend/routes/reports.js:29-33, 75-80, 126-130, 204-208, 241-246, 271-280, 303-316`
**Details:** All backend routes query Supabase tables without filtering by `user_id` or `team_id`. Any authenticated user can download all meetings, action items, and goals for every user in the system. The `req.user` object (containing `id`, `teamId`) is never used in queries.

---

### 4.2 Medium (Yellow)

#### Y1: Error state loaded but never shown on Reports page
**File:** `frontend/src/pages/Reports.jsx:18,28-41`
**Details:** `setError(null)` is set, and the `catch` block logs but never calls `setError(error)`. The `ErrorState` component is imported but never rendered. The `error` state variable is dead.

#### Y2: `ErrorState` import is unused
**File:** `frontend/src/pages/Reports.jsx:11`
**Details:** `ErrorState` is imported from `../components/vc/ErrorState` but never used in JSX.

#### Y3: Action Items CSV filter params never sent from UI
**File:** `frontend/src/pages/Reports.jsx:63`
**Details:** `handleDownload('action-items-csv')` is called with no params. The backend supports `status` and `meetingId` query params but the UI provides no way to set them.

#### Y4: Goals CSV filter params never sent from UI
**File:** `frontend/src/pages/Reports.jsx:66`
**Details:** Same issue — backend supports `quarter` and `type` filters but UI doesn't expose them.

#### Y5: Project Report PDF has backend but no UI
**Files:** `backend/routes/reports.js:116-187`, `backend/services/reportService.js:205-291`
**Details:** Full `generateProjectReportPDF()` implementation and `/project/:id/pdf` route exist. The `reportsApi` has `downloadProjectPDF()`. But no UI card exists on the Reports page to trigger it.

#### Y6: Send Meeting Recap Email has backend but no UI
**File:** `backend/routes/reports.js:450-488`
**Details:** `POST /api/reports/send-meeting-recap` is fully wired but there's no "Email this recap" button anywhere in the frontend.

#### Y7: `generating` state clears on fixed timeout, not on completion
**File:** `frontend/src/pages/Reports.jsx:78`
**Details:** `setTimeout(() => setGenerating(null), 1000)` — the spinner disappears after 1 second regardless of whether the download succeeded or failed. Since `window.open()` is fire-and-forget, there's no way to know. With a proper `fetch()` approach, this could be tied to actual completion.

#### Y8: Scheduler overdue tasks check only logs, doesn't actually notify
**File:** `backend/services/schedulerService.js:130-143`
**Details:** The `checkOverdueTasks()` method has a comment "Email integration can be added later" — it groups tasks by assignee but never sends notifications, just logs.

#### Y9: `Buildings2` and `Users` icons imported but unused
**File:** `frontend/src/pages/Reports.jsx:5`
**Details:** `Users` and `Building2` are imported from lucide-react but never rendered.

#### Y10: `ChevronDown` icon imported but unused
**File:** `frontend/src/pages/Reports.jsx:5`
**Details:** Imported but never used.

---

### 4.3 Nice-to-Have (Green)

#### G1: No date-range filtering for reports
The Reports page offers no date range picker. Weekly PDF is always "past 7 days". Would be useful to generate reports for custom periods.

#### G2: No preview before download
Users must download PDFs to see content. An in-browser preview (via `<iframe>` or PDF.js) would improve UX.

#### G3: No download history or recent reports list
There's no record of previously generated reports. Users can't re-download without re-generating.

#### G4: No loading skeleton during initial data fetch
The loading state is a simple centered spinner. A skeleton layout matching the card grid would feel more polished.

#### G5: Quick Stats section shows only top-level counts
Could show trend data (vs last week/month), overdue counts, or action-item completion rates.

#### G6: No export for tasks (only action items)
The backend has a `tasks` table (used by schedulerService) but no CSV export for it. Only `action_items` are exportable.

#### G7: EffectivenessReport component is isolated
`EffectivenessReport.jsx` in `components/learning/` is a self-contained report for the learning subsystem. It's not linked from the Reports page — could be surfaced there for discoverability.

---

## 5. Code Quality Checks

| Check | Result |
|-------|--------|
| Dead code / unused imports | `ErrorState`, `Users`, `Building2`, `ChevronDown` all unused (Y2, Y9, Y10) |
| State initialized but never rendered | `error` state (Y1) |
| Services that exist but aren't called | `downloadProjectPDF()` in api.js, `sendGoalUpdate()` in emailService.js |
| Duplicate logic | Overdue checking exists in both `checkOverdueItems()` (action_items) and `checkOverdueTasks()` (tasks) with slightly different logic |
| God components | Reports.jsx at 460 lines is manageable but could split PDF/CSV/Stats into sub-components |
| Missing error handling | Frontend swallows all download errors (window.open is fire-and-forget) |
| Hardcoded values | PDF colors hardcoded to blue theme (`#1e40af`), not Entomate brand colors; `margin: 50` in all PDFs |
| TypeScript `any` | N/A — all files are `.jsx`/`.js`, no TypeScript |
| Accessibility | CSV download buttons have `aria-label` (good); PDF download buttons do not; no keyboard navigation for select dropdowns beyond native |
| Performance | No memoization needed — simple page with one data load; `getQuarterOptions()` recreated on every render but trivial cost |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues

**P1-1: Fix authenticated downloads (R1)**
- Replace `window.open(url)` with `fetch()` using auth token
- Create a `downloadBlob()` utility function
- Trigger browser download via `URL.createObjectURL()` + `<a>` click
- Handle errors properly and show toast on failure
- Files: `frontend/src/pages/Reports.jsx`, `frontend/src/services/api.js`

**P1-2: Add user/team scoping to all backend queries (R2)**
- Add `.eq('user_id', req.user.id)` or `.eq('team_id', req.user.teamId)` to all Supabase queries in `backend/routes/reports.js`
- Determine correct scoping model (per-user vs per-team) based on app requirements

### Phase 2: Wire Up Partial/Stub Functionality

**P2-1: Add Project Report PDF card to UI (Y5)**
- Add a card to the PDF Reports grid with project selector dropdown
- Wire to `reportsApi.downloadProjectPDF(projectId)`

**P2-2: Add "Email Recap" button to Meeting Recap card (Y6)**
- Add email input + send button to the Meeting Recap card
- Wire to `POST /api/reports/send-meeting-recap`

**P2-3: Add CSV filter controls (Y3, Y4)**
- Add status filter dropdown for Action Items CSV
- Add quarter/type filter dropdowns for Goals CSV
- Pass params through `handleDownload()`

**P2-4: Fix error state handling (Y1, Y2)**
- Actually call `setError(error)` in catch block
- Render `ErrorState` component when `error` is set
- Add retry button

**P2-5: Clean up unused imports (Y2, Y9, Y10)**
- Remove `ErrorState`, `Users`, `Building2`, `ChevronDown` imports

### Phase 3: Refactor and Improve

**P3-1: Replace timeout-based spinner with completion-based (Y7)**
- Since downloads now use `fetch()` (after P1-1), tie `setGenerating(null)` to actual response completion

**P3-2: Wire overdue tasks notifications (Y8)**
- Extend `checkOverdueTasks()` to send emails using `emailService`
- Add user notification preferences

**P3-3: Extract sub-components from Reports.jsx**
- `PDFReportsSection` — the 3 PDF download cards
- `CSVExportSection` — the 3 CSV export cards
- `ReportsQuickStats` — the 4 stat boxes
- Keep Reports.jsx as orchestrator

**P3-4: Brand-align PDF colors**
- Replace hardcoded `#1e40af` blue with Entomate brand colors
- Consider a PDF theme config object

### Phase 4: New Features and Polish

**P4-1: Date range picker for reports**
- Add date range selector for custom reporting periods
- Pass date params to backend endpoints

**P4-2: In-browser PDF preview**
- Fetch PDF blob and render in `<iframe>` or PDF.js viewer
- "Preview" button alongside "Download"

**P4-3: Surface EffectivenessReport on Reports page (G7)**
- Add a "Learning Effectiveness" section or tab on Reports page
- Embed `<EffectivenessReport />` component

**P4-4: Tasks CSV export (G6)**
- Add backend route for tasks CSV
- Add frontend card

**P4-5: Loading skeleton**
- Replace spinner with card-shaped skeletons matching the grid layout

---

## 7. Agent Prompt for Revisal Implementation

```
You are implementing the Reports section revisal for the Entomate app (f:/entomate).

## Context
- React + Vite frontend (JSX, no TypeScript)
- Express backend with Supabase
- Auth: Bearer token via Supabase JWT, middleware at backend/middleware/auth.js
- Design system: vc-* component library (VCButton, VCBadge, VCIconBox), CSS vars (--text-primary, --accent-primary, etc.)

## Critical Files
- frontend/src/pages/Reports.jsx (460 lines) — main page
- frontend/src/services/api.js (L555-598) — reportsApi
- backend/routes/reports.js (490 lines) — route handlers
- backend/services/reportService.js (433 lines) — PDF/CSV generation
- backend/services/schedulerService.js (364 lines) — cron jobs
- backend/services/emailService.js (394 lines) — email sending

## Phase 1: Fix Critical Issues

### Task 1: Fix authenticated downloads
The current approach uses `window.open(url, '_blank')` which opens URLs without auth headers. All downloads 401.

Fix:
1. In `frontend/src/services/api.js`, change reportsApi methods from returning URL strings to actual fetch calls:
   ```js
   downloadMeetingPDF: async (meetingId) => {
     const response = await api.get(`/reports/meeting/${meetingId}/pdf`, { responseType: 'blob' })
     return response
   }
   ```
2. In Reports.jsx, replace `window.open(url)` with:
   ```js
   const blob = await reportsApi.downloadMeetingPDF(meetingId)
   const url = URL.createObjectURL(new Blob([blob]))
   const a = document.createElement('a')
   a.href = url
   a.download = 'meeting-recap.pdf'
   a.click()
   URL.revokeObjectURL(url)
   ```
3. The api.js axios instance already attaches the Bearer token via interceptor, so this should work.
4. Handle errors with toast.error().

### Task 2: Add user scoping to backend queries
In backend/routes/reports.js, every Supabase query should filter by user or team:
- Add `.eq('user_id', req.user.id)` to meetings, action_items, goals queries
- Or use team scoping: `.eq('team_id', req.user.teamId)`
- The `req.user` object is populated by auth middleware with: id, email, teamId, role

## Phase 2: Wire Up Stubs

### Task 3: Fix error handling
- In Reports.jsx loadData() catch block, add `setError(error.message || 'Failed to load data')`
- Render ErrorState when error is set, with retry button calling loadData()
- Remove unused imports: ErrorState (if not using it, or wire it up), Users, Building2, ChevronDown

### Task 4: Add CSV filter controls
- Action Items CSV: add status dropdown (All, Open, In Progress, Done)
- Goals CSV: add quarter dropdown (reuse getQuarterOptions())
- Pass selected filters to handleDownload()

### Task 5: Add Project Report card
- Add a 4th card to PDF Reports grid
- Need a project selector (fetch projects list)
- Wire to reportsApi.downloadProjectPDF(projectId)

### Task 6: Add Email Recap button
- In Meeting Recap card, add "Email" button next to "Download PDF"
- Opens a small input for email address
- POST to /api/reports/send-meeting-recap with { meetingId, email }

## Phase 3: Refactor
- Extract PDFReportsSection, CSVExportSection, ReportsQuickStats components
- Replace setTimeout spinner clearing with fetch completion
- Replace hardcoded PDF colors with brand colors

## Important Notes
- Use the existing vc design system (VCButton, VCIconBox, VCBadge)
- Use CSS vars for theming (--text-primary, --accent-primary, etc.)
- Use toast (from useToast()) for user feedback
- The api.js axios instance at L72 already has baseURL and auth interceptor
- Keep the existing lazy-loading pattern (React.lazy in App.jsx)
- Do NOT add TypeScript — this project is JSX/JS only
```

---

## Summary

The Reports section has a **solid backend** (PDF generation, CSV export, email service, scheduler) but the **frontend download mechanism is fundamentally broken** due to `window.open()` bypassing auth headers. Every single download silently fails with 401. Additionally, there's **no user scoping** on any query — a data exposure risk.

Beyond those critical issues, there are several backend features (project reports, email recaps, goal update emails) that are fully implemented but have no frontend UI. The codebase is clean and well-structured, just needs the download plumbing fixed and the stub features wired up.
