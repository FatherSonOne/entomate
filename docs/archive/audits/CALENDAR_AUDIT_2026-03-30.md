# CALENDAR SECTION AUDIT

**Date:** 2026-03-30
**Auditor:** Claude Opus 4.6
**Scope:** Calendar page, Meetings page, MeetingDetail page, related backend services, Google Calendar integration

---

## 1. File Inventory

| File | Lines | Role |
|------|-------|------|
| `frontend/src/pages/Calendar.jsx` | 556 | Main calendar page — month grid, sidebar, Google Calendar integration |
| `frontend/src/pages/Meetings.jsx` | 400 | Meetings list page — search, bulk ops, recorder |
| `frontend/src/pages/MeetingDetail.jsx` | 647 | Single meeting detail — summary, key points, action items, AI Q&A |
| `frontend/src/components/MeetingRecorder.jsx` | 200 | Audio recording + processing component |
| `frontend/src/components/ActionItemsList.jsx` | 247 | Action items with CRM sync, priority groups |
| `frontend/src/components/intelligence/QuickScheduleModal.jsx` | 119 | Quick event scheduling modal from Intelligence Dashboard |
| `frontend/src/components/settings/AudioSettings.jsx` | 263 | Audio device + auto-sync-to-calendar toggle |
| `frontend/src/services/api.js` (calendar section) | ~45 | `calendarApi` — 12 methods |
| `frontend/src/services/api.js` (meetings section) | ~45 | `meetingsApi` — 9 methods |
| `backend/routes/calendar.js` | 540 | Calendar REST routes — OAuth, events CRUD, sync, upcoming |
| `backend/routes/meetings.js` | 920 | Meetings REST routes — process, CRUD, ask, recap, reprocess |
| `backend/services/calendarService.js` | 407 | Google Calendar API wrapper service |
| `backend/schemas/calendar.js` | 26 | Zod validation for calendar event create/update |
| **Total** | **~4,325** | |

---

## 2. Architecture Map

```
Frontend                                    Backend                         External
========                                    =======                         ========

Calendar.jsx ─────────────────┐
  ├─ calendarApi.getStatus()  │
  ├─ calendarApi.getEvents()  │
  ├─ calendarApi.getUpcoming()│
  ├─ meetingsApi.list()       │
  └─ calendarApi.syncAll..()  │
                              │
Meetings.jsx ─────────────────┤       routes/calendar.js
  ├─ meetingsApi.list()       │──────►  ├─ GET  /status
  ├─ meetingsApi.delete()     │         ├─ GET  /auth          ──────► Google OAuth2
  └─ MeetingRecorder          │         ├─ GET  /callback       ◄────── Google callback
       └─ meetingsApi.process │         ├─ POST /disconnect
                              │         ├─ GET  /calendars     ──────► Google Calendar API
MeetingDetail.jsx ────────────┤         ├─ GET  /events        ──────► Google Calendar API
  ├─ meetingsApi.get()        │         ├─ POST /events        ──────► Google Calendar API
  ├─ meetingsApi.update()     │         ├─ PATCH/events/:id    ──────► Google Calendar API
  ├─ meetingsApi.ask()        │         ├─ DELETE/events/:id   ──────► Google Calendar API
  ├─ calendarApi.syncMeeting()│         ├─ POST /sync/action-item/:id
  ├─ integrationsApi.crm.*    │         ├─ POST /sync/action-items
  └─ integrationsApi.chat.*   │         ├─ POST /sync/goal/:id
                              │         ├─ POST /sync/meeting/:id
QuickScheduleModal.jsx ───────┤         └─ GET  /upcoming
  └─ api.calendar.createEvent │
                              │       routes/meetings.js
AudioSettings.jsx ────────────┤         ├─ POST /process (audio)
  └─ auto_sync_meetings flag  │         ├─ POST /transcript
                              │         ├─ GET  / (list)
                              │         ├─ GET  /:id
                              │         ├─ PUT  /:id
                              │         ├─ DELETE /:id
                              │         ├─ PATCH /action-items/:id
                              │         ├─ POST /:id/ask
                              │         ├─ GET  /:id/recap
                              │         └─ POST /:id/reprocess
                              │
                              │       services/calendarService.js
                              │         ├─ OAuth2 init/auth/tokens
                              │         ├─ listCalendars()
                              │         ├─ getEvents() / createEvent() / updateEvent() / deleteEvent()
                              │         ├─ createEventFromActionItem()
                              │         ├─ createEventFromMeeting()
                              │         ├─ createEventFromGoal()
                              │         └─ syncActionItemsToCalendar()

Database (Supabase):
  ├─ meetings (id, title, transcript, summary, key_points, decisions,
  │            sentiment_label, sentiment_score, topics, attendees,
  │            duration_minutes, start_time, end_time, audio_file_url,
  │            project_id, crm_deal_id, created_by, transcript_embedding)
  ├─ action_items (id, meeting_id, task_description, context,
  │                assigned_to_name, assigned_to_email, due_date,
  │                priority, status, crm_sync_status)
  ├─ goals (id, title, target_date, goal_type, status, progress, key_results)
  └─ user_settings (user_id, meetings_json)

State Management: Local useState only (no Zustand/Redux for calendar)
Token Storage: Session + httpOnly cookie (calendar_tokens)
```

---

## 3. Feature Status Catalog

### 3.1 Calendar Page

| Feature | Status | Notes |
|---------|--------|-------|
| Month grid with navigation | ✅ Working | Prev/next month, Today button |
| Day cell event indicators | ✅ Working | Shows up to 3 items with "+N more" overflow |
| Selected date sidebar | ✅ Working | Shows events, meetings, upcoming items for selected day |
| Google Calendar OAuth connect | ✅ Working | Full flow: auth URL -> callback -> token storage |
| Google Calendar disconnect | ✅ Working | Clears session + cookie |
| Fetch Google Calendar events | ✅ Working | 30-day window |
| Upcoming items (14 days) | ✅ Working | Combines calendar events + action items + goals |
| Quick stats panel | ✅ Working | Events, due tasks, goal deadlines, overdue, meetings |
| Sync all action items | ✅ Working | Bulk sync to Google Calendar |
| Meetings overlay toggle | ✅ Working | Toggle to show/hide meetings on calendar |
| Event creation modal | ❌ Broken | `showEventModal` state declared (line 28) but **never rendered** — no create-event UI exists on this page |
| Week/day view | ❌ Missing | Only month view implemented |
| Drag-and-drop rescheduling | ❌ Missing | No interaction beyond date selection |
| Recurring event support | ❌ Missing | No recurrence UI or API |
| Event editing from calendar | ❌ Missing | No edit/delete from the calendar grid |
| Not-connected fallback | ⚠️ Partial | Shows meetings but upcoming sidebar requires Google Calendar connection (returns empty) |

### 3.2 Meetings Page

| Feature | Status | Notes |
|---------|--------|-------|
| List meetings with pagination | ✅ Working | PAGE_SIZE=20, Load More button |
| Search/filter meetings | ✅ Working | Client-side filter on title + summary |
| New meeting recording | ✅ Working | Audio recorder with visualizer |
| Delete meeting | ✅ Working | With confirmation dialog |
| Bulk select mode | ✅ Working | Select all, bulk delete, bulk export |
| Bulk export as Markdown | ✅ Working | Downloads .md file |
| Selection mode UX | ✅ Working | Clean enter/exit with checkbox UI |
| Sort/filter by date, sentiment | ❌ Missing | No sort controls, no sentiment filter |
| Meeting tags/labels | ❌ Missing | Tags exist in schema but no UI |

### 3.3 Meeting Detail Page

| Feature | Status | Notes |
|---------|--------|-------|
| View meeting summary | ✅ Working | With inline edit |
| View key points | ✅ Working | Timeline display with inline edit |
| View decisions | ✅ Working | Timeline display (read-only) |
| View transcript | ✅ Working | Scrollable code block |
| Audio playback | ✅ Working | Native audio player |
| Action items list | ✅ Working | Grouped by priority with toggle done/open |
| CRM sync (per-item + bulk) | ✅ Working | Via ActionItemsList component |
| Ask AI about meeting | ✅ Working | Question → AI answer with confidence |
| Share to chat (Slack) | ✅ Working | Channel selector + post recap |
| Add to Google Calendar | ✅ Working | Creates calendar event from meeting |
| Inline edit title | ✅ Working | Click-to-edit with save/cancel |
| Inline edit summary | ✅ Working | Textarea with save/cancel |
| Inline edit key points | ✅ Working | One-per-line textarea |
| Ecosystem sync status | ✅ Working | Shows Pulse/LogosVision sync status |
| Meeting Intelligence Panel | ✅ Working | Separate intelligence component |
| Edit decisions | ❌ Missing | No inline edit for decisions (unlike summary/key points) |
| Attendee management | ❌ Missing | Attendees shown read-only, no add/remove |

### 3.4 QuickScheduleModal

| Feature | Status | Notes |
|---------|--------|-------|
| Create event from Intelligence | ⚠️ Partial | Calls `api.calendar.createEvent` with `summary`/`start`/`end` fields — but the backend route expects `title`/`startDate`/`endDate` fields. **Field name mismatch will cause 400 error.** |
| Duration presets | ✅ Working | 15/30/45/60 min buttons |
| Date/time picker | ✅ Working | Native HTML inputs |

### 3.5 Backend Calendar Service

| Feature | Status | Notes |
|---------|--------|-------|
| OAuth2 initialization | ✅ Working | Reads env vars, creates OAuth2 client |
| Token exchange | ✅ Working | Code → tokens |
| List calendars | ✅ Working | Full calendar list with metadata |
| CRUD events | ✅ Working | Create, read, update, delete via Google API |
| Sync action item → event | ✅ Working | With priority colors and reminders |
| Sync goal → event | ✅ Working | With goal-type colors and 1-week reminder |
| Sync meeting → event | ✅ Working | With full description builder |
| Bulk sync action items | ✅ Working | Iterates with error collection |
| Token refresh handling | ❌ Missing | No automatic token refresh when access_token expires. Service creates new OAuth2 client per request but never calls `refreshAccessToken()`. |
| Idempotent sync | ❌ Missing | No tracking of already-synced items — re-syncing creates **duplicate events** every time |
| Rate limiting | ❌ Missing | Google Calendar API rate limits not handled (429 responses) |

### 3.6 Auto-Sync Setting

| Feature | Status | Notes |
|---------|--------|-------|
| Toggle in AudioSettings | ✅ Working | Persists to `user_settings.meetings_json.auto_sync_meetings_to_calendar` |
| Backend consumption | ✅ Working | `firePostProcessing` checks the flag and auto-syncs if enabled |

---

## 4. Issues Found

### 4.1 Critical (Red)

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| C1 | **QuickScheduleModal field name mismatch** — sends `summary`, `start`, `end` but backend expects `title`, `startDate`, `endDate`. Zod validation will reject the request with 400. | `QuickScheduleModal.jsx` | 33-39 | Events created from Intelligence Dashboard will always fail |
| C2 | **No OAuth token refresh** — Google access tokens expire after 1 hour. Service never refreshes them. After 1hr, all calendar operations fail with 401 until user re-authenticates. | `calendarService.js` | 79-91 | Calendar breaks after 1 hour of use |
| C3 | **Duplicate events on re-sync** — No dedup tracking. Each "Sync Tasks" click creates duplicate Google Calendar events for already-synced items. | `calendarService.js:377-404`, `calendar.js:321-359` | N/A | User's calendar gets spammed with duplicates |
| C4 | **Calendar routes missing authentication** — Calendar routes don't use the `authenticate` middleware (unlike meetings routes). Any unauthenticated user with a valid session cookie could access another user's calendar. | `calendar.js` | All routes | Security: unauthorized calendar access |

### 4.2 Medium (Yellow)

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| M1 | **`showEventModal` state is dead code** — declared on line 28 but never used or rendered. No event creation UI on the Calendar page. | `Calendar.jsx` | 28 | Dead code, missing feature |
| M2 | **`isBefore` imported but unused** in the `/upcoming` route's inline require | `calendar.js` | 450 | Dead import |
| M3 | **Token stored in cookie as plain JSON** — `calendar_tokens` cookie contains the full Google refresh_token in a JSON string. Even with httpOnly, this is sensitive data stored unencrypted. | `calendar.js` | 77-81 | Security concern — refresh token in cookie |
| M4 | **No loading state when disconnecting calendar** — `handleDisconnect` has no loading indicator | `Calendar.jsx` | 93-104 | Minor UX — user might double-click |
| M5 | **Upcoming sidebar requires Google Calendar** — the `/upcoming` route uses `requireCalendar` middleware, so users without Google Calendar connected see no upcoming action items or goal deadlines even though those are Entomate-native data | `calendar.js` | 447 | Users without Google Calendar lose the upcoming view |
| M6 | **No error toast on OAuth failure** — the `searchParams.get('error')` check on line 39 only logs to console, doesn't show user-facing feedback | `Calendar.jsx` | 38-40 | Silent failure on OAuth error |
| M7 | **Calendar grid only renders 42 days (6 weeks)** — months that start on Saturday with 31 days need 6 rows, which works, but the fixed 42 is fragile and renders extra trailing days | `Calendar.jsx` | 148 | Minor: extra empty row sometimes shown |
| M8 | **`schemas/calendar.js` and `schemas/meetings.js` referenced but meetings schema file not found** — the `require('../schemas/calendar')` works but `validate(schemas.createEvent)` uses `.passthrough()` which defeats most validation | `schemas/calendar.js` | All | Weak validation — almost anything passes |
| M9 | **No calendar picker** — user can't choose which Google Calendar to sync to (always uses 'primary'). `getCalendars` route exists but is never called from frontend. | `Calendar.jsx` | N/A | Feature gap |
| M10 | **Meeting date display uses `created_at` fallback** — `getMeetingsForDate` falls back to `created_at` if `start_time` is null, which means meetings show on the wrong date | `Calendar.jsx` | 176-177 | Data accuracy issue |

### 4.3 Nice-to-Have (Green)

| # | Issue | File | Line(s) | Impact |
|---|-------|------|---------|--------|
| N1 | No week or day view — only month grid | `Calendar.jsx` | N/A | Feature gap |
| N2 | No drag-and-drop to reschedule events | `Calendar.jsx` | N/A | Feature gap |
| N3 | No recurring event support | Backend + Frontend | N/A | Feature gap |
| N4 | No keyboard navigation in calendar grid | `Calendar.jsx` | N/A | Accessibility |
| N5 | No calendar event color coding visible in the grid (all events share same pink/teal) | `Calendar.jsx` | 372-378 | Visual polish |
| N6 | `ActionItemsList` uses old class-based CSS tokens (`text-content-tertiary`, `bg-surface-muted`) mixed with CSS variable approach | `ActionItemsList.jsx` | Multiple | Style inconsistency |
| N7 | No "Add Event" button on Calendar page (despite `showEventModal` being stubbed) | `Calendar.jsx` | N/A | Feature gap |
| N8 | Meetings page search is client-side only — won't find meetings beyond loaded page | `Meetings.jsx` | 165-168 | Limited search |
| N9 | MeetingRecorder has no attendee input — attendees must be added later | `MeetingRecorder.jsx` | N/A | UX gap |
| N10 | No timezone handling — all dates treated as UTC/local with no explicit timezone support | Multiple | N/A | Can cause date display issues for remote teams |

---

## 5. Dead Code & Unused Items

| Item | Location | Type |
|------|----------|------|
| `showEventModal` / `setShowEventModal` state | `Calendar.jsx:28` | Unused state |
| `isBefore` import in `/upcoming` route | `calendar.js:450` | Unused import |
| `parseISO` import in `/upcoming` route | `calendar.js:450` | Unused import (dates come as strings, compared via `new Date()`) |
| `calendarApi.getCalendars()` | `api.js:598` | API method defined but never called from any frontend component |
| `calendarApi.updateEvent()` | `api.js:607` | API method defined but never called from frontend |
| `calendarApi.deleteEvent()` | `api.js:610` | API method defined but never called from frontend |
| `calendarApi.syncActionItem()` (single) | `api.js:614` | API method defined but never called from frontend |
| `calendarApi.syncGoal()` | `api.js:623` | API method defined but never called from frontend |

---

## 6. Revisal Plan

### Phase 1: Fix Critical Issues (Priority)

**1.1 Fix QuickScheduleModal field mismatch (C1)**
- File: `frontend/src/components/intelligence/QuickScheduleModal.jsx`
- Change: Map `summary` → `title`, `start` → `startDate`, `end` → `endDate` in the API call

**1.2 Add OAuth token refresh (C2)**
- File: `backend/services/calendarService.js`
- Change: In `getCalendar()`, set credentials with refresh_token, listen for `tokens` event to update stored tokens. Pass token-update callback from routes.

**1.3 Add sync tracking to prevent duplicates (C3)**
- Add `calendar_event_id` column to `action_items` and `goals` tables
- Before creating event, check if `calendar_event_id` already set → skip or update instead
- Add `calendar_event_id` column to `meetings` table for meeting sync tracking

**1.4 Add authentication to calendar routes (C4)**
- File: `backend/routes/calendar.js`
- Change: Add `authenticate` middleware to all routes (same pattern as meetings routes)

### Phase 2: Wire Up Partial/Stub Functionality

**2.1 Build the event creation modal (M1)**
- Remove dead `showEventModal` state
- Add "New Event" button to Calendar header
- Build a modal using the same pattern as `QuickScheduleModal` but integrated into the Calendar page
- Wire to `calendarApi.createEvent()`

**2.2 Fix upcoming view for non-Google users (M5)**
- Split `/upcoming` into two parts: Entomate-native data (action items + goals) doesn't need `requireCalendar`
- Create a new route or make calendar events optional within the existing route

**2.3 Show OAuth error to user (M6)**
- Add toast notification when `searchParams.get('error')` is present

**2.4 Wire up calendar picker (M9)**
- Call `calendarApi.getCalendars()` when connected
- Add dropdown to select target calendar
- Pass `calendarId` to sync operations

**2.5 Wire up single-item sync and goal sync from UI**
- Add "Sync to Calendar" button on action item rows (uses `calendarApi.syncActionItem()`)
- Add "Sync to Calendar" button on Goals page (uses `calendarApi.syncGoal()`)

### Phase 3: Refactor & Improve Architecture

**3.1 Encrypt/secure token storage (M3)**
- Store calendar tokens in Supabase `user_settings` table (encrypted) instead of cookies
- Remove cookie-based token storage
- Load tokens from DB in `getTokens()` middleware

**3.2 Strengthen validation schemas (M8)**
- Remove `.passthrough()` from calendar schemas
- Add proper field validation for all sync routes
- Add meetings schemas file

**3.3 Unify CSS token approach (N6)**
- Migrate `ActionItemsList.jsx` from old `text-content-*` / `bg-surface-*` classes to CSS variable approach used elsewhere

**3.4 Make search server-side (N8)**
- Pass search query to `meetingsApi.list()` as `search` param (backend already supports it)

**3.5 Add timezone support (N10)**
- Store user timezone in settings
- Pass timezone to calendar event creation
- Display dates in user's local timezone

### Phase 4: New Features & Polish

**4.1 Week and day views**
- Add view toggle (Month/Week/Day) to calendar header
- Implement week view with hourly time slots
- Implement day view with detailed time blocks

**4.2 Keyboard navigation**
- Arrow keys to navigate days
- Enter to select
- Escape to deselect

**4.3 Event color coding in grid**
- Use different colors for meetings (teal), action items (by priority), goals (amber), calendar events (blue)

**4.4 Recurring events**
- Add recurrence rules to event creation
- Display recurring events across calendar

**4.5 Attendee input on MeetingRecorder**
- Add attendee chips/input to the recording form

---

## 7. Claude Agent Prompt for Revisal

```
You are performing a Calendar section revisal on the Entomate project at f:\entomate.

## Context

Entomate is a meeting intelligence + productivity app built with:
- Frontend: React (JSX, not TSX), Vite, Tailwind CSS, CSS custom properties
- Backend: Express.js, Supabase (Postgres), Google Calendar API (googleapis)
- UI Pattern: VCButton, VCBadge, VCInput components from `components/vc/`
- Theme: CSS variables (--text-primary, --accent-primary, --bg-elevated, etc.)
- Auth: `authenticate` middleware from `middleware/auth.js`

## Files to modify

### Phase 1 — Critical fixes

1. **QuickScheduleModal.jsx** (`frontend/src/components/intelligence/QuickScheduleModal.jsx`)
   - Line 33-39: Change `summary` → `title`, `start` → `startDate`, `end` → `endDate`
   - The backend POST /calendar/events expects: `{ title, startDate, endDate, description }`

2. **calendarService.js** (`backend/services/calendarService.js`)
   - In `getCalendar()` method (line 79-91): After `auth.setCredentials(tokens)`,
     add a `tokens` event listener to capture refreshed tokens:
     ```js
     auth.on('tokens', (newTokens) => {
       // Merge with existing tokens (refresh_token may not be re-issued)
       Object.assign(tokens, newTokens);
     });
     ```
   - Ensure refresh_token is included when setting credentials

3. **Duplicate sync prevention**
   - Add migration: ALTER TABLE action_items ADD COLUMN calendar_event_id TEXT;
   - ALTER TABLE goals ADD COLUMN calendar_event_id TEXT;
   - ALTER TABLE meetings ADD COLUMN calendar_event_id TEXT;
   - In `syncActionItemsToCalendar()`: Before creating event, check if item.calendar_event_id exists → skip
   - After creating event, UPDATE the row with the new event.id
   - Same pattern for `createEventFromGoal()` and `createEventFromMeeting()`

4. **calendar.js** (`backend/routes/calendar.js`)
   - Add `const { authenticate } = require('../middleware/auth');` at top
   - Add `authenticate` middleware to all routes that need it:
     - `/calendars`, `/events` (GET/POST/PATCH/DELETE), `/sync/*`, `/upcoming`
   - Keep `/status`, `/auth`, `/callback` without authenticate (they're part of the auth flow)

### Phase 2 — Wire stubs

5. **Calendar.jsx** (`frontend/src/pages/Calendar.jsx`)
   - Remove `showEventModal`/`setShowEventModal` dead state
   - Add "New Event" button to the header (next to Meetings toggle)
   - Build inline event creation modal with: title, date, time, duration, description
   - Wire to `calendarApi.createEvent()`
   - Add toast on OAuth error (line 38-40): `toast.error('Error', searchParams.get('error'))`
   - Add loading state to disconnect button

6. **calendar.js** — Fix `/upcoming` route
   - Remove `requireCalendar` from the route
   - Make calendar events section try/catch with fallback to empty array if no tokens
   - Action items and goals should always load from Supabase regardless of calendar connection

### Phase 3+ — Later

7. Store tokens in DB instead of cookies
8. Add calendar picker dropdown
9. Make ActionItemsList use CSS variables consistently
10. Make meetings search server-side
11. Add timezone support

## Important patterns to follow
- Use `VCButton`, `VCBadge` from `components/vc/` for all buttons
- Use inline `style={{ color: 'var(--text-primary)' }}` for theme colors
- Use `useToast()` for success/error notifications
- Use `useConfirm()` for destructive actions
- Keep components in JSX (not TSX)
- Backend uses `log` from `utils/log` for logging
```

---

*Audit complete. 4,325 lines across 13 files. 4 critical issues, 10 medium issues, 10 nice-to-haves identified.*
