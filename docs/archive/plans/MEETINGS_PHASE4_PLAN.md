# Phase 4: Meetings — New Features & Polish

## Context

Phases 1-3 of the Meetings revisal fixed critical issues (auth, dual tables, SQL injection), wired up partial features (AI provider, pagination, audio playback), and cleaned up architecture (shared helpers, VC styling, safe async). Phase 4 adds the remaining new features and connects existing but disconnected systems.

Key discovery: The Calendar page (`Calendar.jsx`) and Agents page (`Agents.jsx`) are **already fully functional** — they just aren't wired to the Meetings flow. This phase is mostly about connecting existing pieces, not building from scratch.

---

## Plan Items

### 4.1 Meeting Edit UI
**Goal:** Allow editing title, summary, key points from MeetingDetail page.
**Effort:** Small

- **File:** `frontend/src/pages/MeetingDetail.jsx`
- Add inline-edit mode for title (click to edit, Enter to save)
- Add edit button on Summary and Key Points sections that opens editable textareas
- Wire save to existing `meetingsApi.update(id, data)` — backend `PUT /api/meetings/:id` already exists and allows `title`, `summary`, `key_points`, `decisions`
- Show toast on success/error via existing `useToast()`

### 4.2 Sync Meeting to Calendar Button
**Goal:** One-click sync from MeetingDetail to Google Calendar.
**Effort:** Small

- **File:** `frontend/src/pages/MeetingDetail.jsx`
- Add "Add to Calendar" button in the header actions (next to Share and Sync to CRM)
- Call existing `POST /api/calendar/sync/meeting/:id` endpoint
- Show success/error toast
- **Backend route already exists** in `backend/routes/calendar.js` and `calendarService.createEventFromMeeting()` is implemented

### 4.3 Meeting Edit UI for Action Items
**Goal:** Toggle action item status (open/completed) from MeetingDetail.
**Effort:** Small

- **File:** `frontend/src/components/ActionItemsList.jsx`
- Add checkbox click handler that calls a new `meetingsApi.updateActionItem(id, { status })`
- **Backend:** Add `PATCH /api/meetings/action-items/:id` route to `backend/routes/meetings.js` for status toggling
- Currently action items are read-only in the UI despite having a `status` field

### 4.4 Bulk Meeting Operations
**Goal:** Multi-select delete and export.
**Effort:** Medium

- **File:** `frontend/src/pages/Meetings.jsx`
- Add selection mode: checkbox on each meeting row, "Select All" toggle
- Bulk delete: calls `meetingsApi.delete(id)` for each selected (or add a `POST /api/meetings/bulk-delete` endpoint)
- Export: generate markdown summary of selected meetings, trigger browser download
- Selection state resets after action

### 4.5 Connect Calendar Page to Meetings
**Goal:** Show Entomate meetings on the Calendar grid.
**Effort:** Medium

- **File:** `frontend/src/pages/Calendar.jsx`
- The calendar already shows Google Calendar events. Add a second data source: fetch meetings from `meetingsApi.list()` and render them on their `start_time` date cells with a distinct badge color
- Add a "Meetings" filter toggle in the sidebar to show/hide meeting events
- Clicking a meeting event navigates to `/meetings/:id` (Link)
- The `GET /api/calendar/upcoming` endpoint already merges calendar events + action items + goals — consider adding meetings to this aggregate endpoint too

### 4.6 Auto-Sync Meetings to Calendar
**Goal:** Optionally auto-sync new meetings to Google Calendar after processing.
**Effort:** Small

- **File:** `backend/routes/meetings.js` (in `firePostProcessing`)
- After ecosystem sync, check if user has Google Calendar connected (via `calendarService.isConfigured()` + user tokens)
- If connected, call `calendarService.createEventFromMeeting(tokens, savedMeeting)`
- Add a user setting `auto_sync_meetings_to_calendar` in settings (default: false)
- **File:** `frontend/src/components/settings/AudioSettings.jsx` or a new MeetingsSettings section — add toggle

---

## Files to Modify

| File | Changes |
|------|---------|
| `frontend/src/pages/MeetingDetail.jsx` | Inline edit for title/summary/key_points, calendar sync button |
| `frontend/src/pages/Meetings.jsx` | Bulk select UI, bulk delete, export |
| `frontend/src/pages/Calendar.jsx` | Fetch + render meetings on calendar grid, meeting filter toggle |
| `frontend/src/components/ActionItemsList.jsx` | Status toggle checkbox |
| `backend/routes/meetings.js` | Action item status PATCH endpoint, optional calendar auto-sync in firePostProcessing |
| `frontend/src/services/api.js` | Add `updateActionItem`, `calendarSyncMeeting` methods to `meetingsApi` |

## Verification

- Edit a meeting title from detail page — verify it persists on reload
- Toggle an action item to completed — verify status updates
- Click "Add to Calendar" — verify event appears in Google Calendar
- Select multiple meetings, bulk delete — verify they're removed
- Open Calendar page — verify meetings appear on their dates
- Record a new meeting with auto-sync enabled — verify it auto-appears in Google Calendar
