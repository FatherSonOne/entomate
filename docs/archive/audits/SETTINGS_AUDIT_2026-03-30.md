# ENTOMATE SETTINGS — Full Comprehensive Audit

**Date:** 2026-03-30
**Auditor:** Claude Opus 4.6
**Scope:** All settings-related code, services, database schemas, and missing functionality

---

## 1. File Inventory

| File | Location | Lines | Purpose |
|------|----------|-------|---------|
| Settings.jsx | `frontend/src/pages/Settings.jsx` | 626 | Main Settings page — appearance, system status, config guide |
| EcosystemSettings.jsx | `frontend/src/components/EcosystemSettings.jsx` | 713 | Ecosystem Bridge panel (Pulse + Logos Vision connections) |
| SlackSettings.jsx | `frontend/src/components/settings/SlackSettings.jsx` | 668 | Slack integration settings (ORPHANED — not rendered anywhere) |
| ThemeContext.jsx | `frontend/src/context/ThemeContext.jsx` | 85 | Theme mode provider (light/dark/system) |
| MeetingRecorder.jsx | `frontend/src/components/MeetingRecorder.jsx` | 162 | Audio recording — hardcoded to default mic, no device selection |
| LearningDashboard.jsx | `frontend/src/components/learning/LearningDashboard.jsx` | ~300 | AI Learning patterns — accessed via Settings |
| api.js | `frontend/src/services/api.js` | 964 | All API client methods |
| slackApi.js | `frontend/src/services/slackApi.js` | 44 | Slack-specific API client |
| settings.js (server) | `server/routes/settings.js` | 124 | OLD server settings routes (user + workspace) — NOT MOUNTED in backend/server.js |
| 2025_12_17__settings.sql | `server/db/migrations/2025_12_17__settings.sql` | 39 | DB schema: user_settings, workspace_settings, audit_logs |
| ai.js | `backend/config/ai.js` | 152 | AI provider abstraction (OpenAI/Gemini) |
| validateEnv.js | `backend/config/validateEnv.js` | 70 | Env var validation on startup |
| server.js | `backend/server.js` | ~360 | Main Express server — NO `/api/settings` route mounted |

---

## 2. Architecture Diagram

```
                          ┌──────────────────────────────────────────┐
                          │           Settings.jsx (Page)            │
                          │                                          │
                          │  ┌─────────────┐  ┌──────────────────┐  │
                          │  │ Appearance   │  │ AI Learning      │  │
                          │  │ (Light/Dark) │  │ → LearningDash   │  │
                          │  └──────┬───────┘  └──────────────────┘  │
                          │         │                                 │
                          │  ┌──────┴────────────────────────────┐   │
                          │  │ EcosystemSettings (embedded)      │   │
                          │  │  - Pulse connection               │   │
                          │  │  - Logos Vision connection         │   │
                          │  │  - Token management               │   │
                          │  │  - Event log                      │   │
                          │  └───────────────────────────────────┘   │
                          │                                          │
                          │  ┌───────────────────────────────────┐   │
                          │  │ System Status (read-only)         │   │
                          │  │  - AI Provider status             │   │
                          │  │  - Database status                │   │
                          │  │  - CRM status                     │   │
                          │  │  - Chat status                    │   │
                          │  └───────────────────────────────────┘   │
                          │                                          │
                          │  ┌───────────────────────────────────┐   │
                          │  │ Configuration Guide (static text) │   │
                          │  │  - .env instructions              │   │
                          │  └───────────────────────────────────┘   │
                          │                                          │
                          │  ┌───────────────────────────────────┐   │
                          │  │ About Entomate (static text)      │   │
                          │  └───────────────────────────────────┘   │
                          └──────────────────────────────────────────┘

  ╔══════════════════════════════════════════════════════════════╗
  ║  DISCONNECTED / ORPHANED PIECES                             ║
  ╠══════════════════════════════════════════════════════════════╣
  ║                                                              ║
  ║  SlackSettings.jsx     — Built, not rendered anywhere        ║
  ║  server/routes/settings.js — Full CRUD, not mounted          ║
  ║  user_settings table   — Schema exists, no API reads/writes  ║
  ║  workspace_settings    — Schema exists, no API reads/writes  ║
  ║  audit_logs table      — Schema exists, no frontend display  ║
  ║  notifications_json    — DB column exists, no UI             ║
  ║  meetings_json         — DB column exists, no UI             ║
  ║  ai_json               — DB column exists, no UI             ║
  ╚══════════════════════════════════════════════════════════════╝

  DATA FLOW (what works today):

  ThemeContext ──localStorage──> "entomate-theme-mode"
  EcosystemSettings ──fetch──> /api/ecosystem/* (backend)
  System Status ──fetch──> /api/health, /api/integrations/status
  AI Learning ──fetch──> /api/learning/*

  NO user settings are persisted to the database from the frontend.
  Theme is localStorage-only. Everything else is .env on the server.
```

---

## 3. Feature Status Catalog

### 3A. Current Settings Sections

| Feature | Status | Notes |
|---------|--------|-------|
| Theme toggle (Light/Dark) | ⚠️ Partial | Works via localStorage only. No "System" option in UI despite ThemeContext supporting it. Not persisted to DB. |
| AI Learning management | ✅ Working | Opens LearningDashboard, functional CRUD for patterns |
| Ecosystem Bridge (Pulse) | ✅ Working | Connect, disconnect, test, token management, event log |
| Ecosystem Bridge (Logos Vision) | ✅ Working | Same as Pulse |
| System Status — AI Provider | ✅ Working | Shows OpenAI/Gemini status from /api/health |
| System Status — Database | ✅ Working | Shows Supabase connection status |
| System Status — CRM | ✅ Working | Shows Logos Vision CRM status + test button |
| System Status — Chat | ✅ Working | Shows Pulse chat status + test button |
| Configuration Guide | ✅ Working | Static text showing .env setup instructions |
| About section | ✅ Working | Static version/stack info |

### 3B. Missing Settings — Critical for Entomate's Purpose

Entomate is an **AI-powered meeting intelligence platform**. Its core purpose is:
1. **Record meetings** (audio capture)
2. **Transcribe and analyze** (AI processing)
3. **Extract action items** (AI extraction)
4. **Automate follow-ups** (notifications, CRM sync)

The Settings page is missing configuration for almost all of these core functions:

| Missing Feature | Severity | Why It Matters |
|----------------|----------|----------------|
| **Audio Input Device Selection** | 🔴 Critical | Users can't choose which microphone to use. MeetingRecorder hardcodes `getUserMedia({ audio: true })` with no deviceId. Users with multiple mics (headset, webcam, USB mic) are stuck with browser default. |
| **Audio Output Device Selection** | 🔴 Critical | No way to select playback device for meeting recordings. |
| **Audio Quality Settings** | 🟡 Medium | No control over sample rate, bitrate, or codec. Hardcoded to `audio/webm;codecs=opus`. |
| **Recording Auto-Save** | 🟡 Medium | No setting for auto-saving recordings vs. manual-only. |
| **AI Provider Selection** | 🔴 Critical | Users see which provider is active but can't switch between OpenAI/Gemini from the UI. Requires manual .env editing on the server. |
| **AI Model Selection** | 🟡 Medium | No way to choose which model (e.g., GPT-4o vs GPT-4o-mini, Gemini Pro vs Flash). |
| **Transcription Language** | 🟡 Medium | No language preference setting. AI auto-detects but users should be able to set default. |
| **Notification Preferences** | 🔴 Critical | `notifications_json` column exists in DB schema but there is ZERO UI. No way to configure: email notifications, in-app notifications, browser push, Slack channel preferences, notification frequency/digest. |
| **Meeting Defaults** | 🟡 Medium | `meetings_json` column exists in DB schema but no UI. Should include: default meeting title template, auto-record on join, auto-transcribe, default project assignment, attendee defaults. |
| **AI Behavior Settings** | 🟡 Medium | `ai_json` column exists in DB schema but no UI. Should include: summary detail level, action item extraction aggressiveness, auto-assign confidence threshold, priority detection sensitivity. |
| **Slack Integration Panel** | 🔴 Critical | `SlackSettings.jsx` is fully built (668 lines!) with channel selection, notification type toggles, test connection — but is NEVER rendered. Complete orphan. |
| **Calendar Integration Settings** | 🟡 Medium | Calendar API exists (`calendarApi` in api.js) with full CRUD, auth, sync — but no settings panel for managing calendar connections, sync preferences, or default calendar. |
| **Email Notification Settings** | 🟡 Medium | `emailService.js` (16K lines) exists in backend but zero UI for configuring email preferences. |
| **Data Export/Privacy Settings** | 🟡 Medium | No UI for data export, data retention, or privacy controls. |
| **User Profile Settings** | 🟡 Medium | No profile management — name, avatar, timezone, language. |
| **Keyboard Shortcuts Config** | 🟢 Nice | `KeyboardShortcutsHelp.jsx` exists for display but no customization. |
| **Workspace/Team Settings** | 🟡 Medium | `workspace_settings` table exists with `integrations_json`, `security_json`, `data_controls_json` columns — no UI at all. |
| **Audit Log Viewer** | 🟢 Nice | `audit_logs` table exists with full schema — no frontend viewer. |
| **API Key Management** | 🟡 Medium | `secretsVault.js` service (24K lines) exists, `/api/secrets` route mounted — no settings UI to manage keys. |
| **Automation Defaults** | 🟢 Nice | No default settings for automation retry count, timeout, notification on failure. |
| **Search Preferences** | 🟢 Nice | No settings for default search mode (semantic vs full-text), results per page, saved search limits. |
| **Accent Color / Brand Customization** | 🟢 Nice | `accent_mode` and `accent_color` columns exist in DB — no UI. Currently hardcoded to Void Crimson. |

---

## 4. Issues Found

### 🔴 Critical Issues

**C1. No Audio Device Selection (MeetingRecorder.jsx:67)**
```javascript
const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } })
```
No `deviceId` constraint. No `enumerateDevices()` call anywhere in the codebase. Users with multiple audio devices (extremely common in meeting scenarios — headsets, webcam mics, USB mics, Bluetooth) cannot select their preferred input.

**C2. Settings Routes Not Mounted (backend/server.js)**
The `server/routes/settings.js` file has full user/workspace settings CRUD with audit logging, but it's in the OLD `server/` directory (not `backend/`). The current `backend/server.js` does NOT mount any `/api/settings` route. The database tables (`user_settings`, `workspace_settings`, `audit_logs`) exist but are completely unreachable from the frontend.

**C3. SlackSettings.jsx is a Complete Orphan**
668 lines of fully functional Slack settings UI — channel selection, notification toggles (meeting completed, deal won, overdue reminders, new action items), test notifications — sitting unused in `components/settings/`. Not imported or rendered anywhere.

**C4. Notification Preferences Don't Exist**
For a meeting intelligence platform, notifications are core functionality. The DB has `notifications_json` ready, `slackNotifier.js` (20K lines) and `emailService.js` (16K lines) exist on the backend, but users have zero control over what notifications they receive, how, or when.

**C5. Theme Not Persisted to Database**
Theme mode is stored only in `localStorage`. If a user logs in from a different browser/device, their theme preference is lost. The `user_settings.theme_mode` column exists specifically for this.

### 🟡 Medium Issues

**M1. No "System" Theme Option in UI**
`ThemeContext.jsx` supports `THEME_MODES.system` but `Settings.jsx` only renders Light and Dark buttons. The system-follow option is missing from the UI.

**M2. AI Provider is Server-Only Config**
The "Configuration Guide" section tells users to edit `.env` files manually. For a production SaaS app, API keys should be manageable from the Secrets Vault UI (which exists as a backend service but has no settings frontend).

**M3. Calendar Integration Has No Settings Panel**
`calendarApi` has full OAuth flow, calendar listing, event CRUD, sync capabilities — but no settings section for managing connected calendars, sync preferences, or auto-record from calendar events.

**M4. Email Service Has No UI**
`emailService.js` is 16K lines with meeting summary emails, overdue reminders, weekly digests — but users can't enable/disable or configure any of it.

**M5. Old Server vs New Backend Split**
Two server directories exist: `server/` (old, with settings routes) and `backend/` (current, without settings routes). The settings migration SQL is in `server/db/migrations/` but the database tables may or may not exist in the current Supabase instance.

**M6. SlackSettings Uses Old Styling**
`SlackSettings.jsx` uses inline `<style>` tags with old CSS classes (`btn-primary`, `toggle-switch`, hardcoded colors like `#4f46e5`) instead of the app's Void Crimson design system (`vc` classes, CSS custom properties, VCButton components).

### 🟢 Nice-to-Have Issues

**N1. No User Profile Section**
No way to manage display name, avatar, timezone, or language preferences.

**N2. No Accent Color Customization**
DB has `accent_mode` and `accent_color` columns but UI is locked to Void Crimson theme.

**N3. No Audit Log Viewer**
Admin audit logs are captured in the DB but never displayed to users/admins.

**N4. Static Version Number**
About section hardcodes "Version: 1.0.0" — should read from `package.json` or build metadata.

**N5. Configuration Guide Is Developer-Facing**
The config guide shows `.env` variables — appropriate for self-hosted/dev, but should be replaced with actual settings UI for production users.

---

## 5. Dead Code / Unused Imports

| Item | Location | Issue |
|------|----------|-------|
| `SlackSettings.jsx` | `components/settings/` | 668 lines, never imported |
| `tokenCache` / `tokenCacheTime` / `tokenGetter` | `api.js:153-158` | Referenced in response interceptor but never defined in this file (likely removed during refactor) |
| `settings.js` routes | `server/routes/settings.js` | 124 lines, not mounted in current backend |
| `slackApi.js` | `frontend/src/services/slackApi.js` | Only imported by the orphaned SlackSettings |
| `accent_mode`, `accent_color`, `reduce_motion` columns | DB schema | Defined but no UI writes to them |

---

## 6. Revisal Plan

### Phase 1: Fix Critical / Wire Up Existing Code (Priority: Immediate)

**1.1 Mount Settings API in Backend**
- Port `server/routes/settings.js` logic into `backend/routes/settings.js` using Supabase instead of raw `pool.query`
- Mount as `/api/settings` in `backend/server.js`
- Add corresponding `settingsApi` methods to `frontend/src/services/api.js`

**1.2 Audio Device Selection**
- Create `useAudioDevices` hook that calls `navigator.mediaDevices.enumerateDevices()`
- Add audio input/output device dropdowns to Settings page under a new "Audio & Recording" section
- Store selected device IDs in `user_settings.meetings_json`
- Update `MeetingRecorder.jsx` to pass selected `deviceId` to `getUserMedia()`

**1.3 Wire Up SlackSettings**
- Restyle `SlackSettings.jsx` to use Void Crimson design system (VCButton, VCInput, VCBadge, CSS vars)
- Add as a section in `Settings.jsx` or as a sub-route
- Connect to existing `/api/slack/*` backend routes

**1.4 Add Notification Preferences**
- Create `NotificationSettings` component with toggles for:
  - Email notifications (meeting summaries, overdue reminders, weekly digest)
  - In-app notifications
  - Slack notifications (leverage the wired-up SlackSettings)
  - Browser push notifications
- Persist to `user_settings.notifications_json`

**1.5 Persist Theme to Database**
- On theme change, call `settingsApi.updateUser({ theme_mode })` in addition to localStorage
- On app load, fetch user settings and apply saved theme
- Keep localStorage as immediate fallback (no flash of wrong theme)

### Phase 2: Add Missing Core Settings

**2.1 Meeting Defaults Section**
- Default title template
- Auto-transcribe toggle
- Default project assignment
- Recording quality preset (Standard/High/Max)
- Default language for transcription
- Persist to `user_settings.meetings_json`

**2.2 AI Configuration Section**
- Provider selection (if multiple keys configured) — display-only or switchable
- Summary detail level (Brief / Standard / Detailed)
- Action item extraction sensitivity (Conservative / Balanced / Aggressive)
- Auto-assign confidence threshold slider
- Persist to `user_settings.ai_json`

**2.3 Calendar Integration Settings**
- OAuth connect/disconnect flow (already built in `calendarApi`)
- Default calendar selection
- Auto-create events from meetings toggle
- Sync direction (one-way / two-way)

**2.4 User Profile Section**
- Display name
- Avatar (upload to Supabase storage)
- Timezone (auto-detect + manual override)
- Language preference

### Phase 3: Refactor & Architecture

**3.1 Settings Sub-Navigation**
Replace the monolithic scrolling page with a sidebar/tab navigation:
- General (Profile, Appearance)
- Audio & Recording
- AI & Intelligence
- Notifications
- Integrations (Ecosystem, Slack, Calendar, Email)
- Workspace (admin-only: security, data controls)
- About

**3.2 Consolidate Server Directories**
- Migrate remaining useful code from `server/` to `backend/`
- Remove `server/` directory or mark it deprecated
- Ensure DB migrations are in one canonical location

**3.3 Settings Context/Hook**
- Create `useSettings` hook that fetches and caches user settings
- Provide settings via React context so any component can read preferences
- Auto-sync changes to backend

### Phase 4: Polish & New Features

**4.1 Accent Color Picker**
- Color picker component for custom accent color
- Preview of theme with selected color
- Persist to `user_settings.accent_color`

**4.2 Audit Log Viewer (Admin)**
- Paginated table of audit events
- Filter by action type, user, date range
- Wire to existing `audit_logs` table

**4.3 Secrets Vault UI**
- Manage API keys from the settings UI
- Leverage existing `/api/secrets` backend routes
- Encrypted display with reveal/copy

**4.4 Keyboard Shortcuts Customization**
- Allow remapping shortcuts
- Import/export shortcut profiles

**4.5 Data & Privacy**
- Export all user data (GDPR)
- Data retention settings
- Delete account

**4.6 Reduce Motion / Accessibility**
- Wire `reduce_motion` setting to CSS `prefers-reduced-motion`
- Font size adjustment
- High contrast mode toggle

---

## 7. Claude Agent Prompt — Settings Revisal Implementation

```
You are implementing a comprehensive Settings overhaul for Entomate, an AI-powered meeting
intelligence platform built with React (frontend) + Node.js/Express (backend) + Supabase (database).

## Project Context

Working directory: f:\entomate
Frontend: frontend/src/ (React, JSX, Vite, Tailwind-ish with Void Crimson design system)
Backend: backend/ (Express, Supabase client)
Design system: "Void Crimson" — uses CSS custom properties (--text-primary, --accent-primary, etc.)
  and VC components (VCButton, VCInput, VCBadge, VCIconBox from components/vc/)

## Current State

The Settings page (frontend/src/pages/Settings.jsx) currently has:
- Theme toggle (light/dark only, localStorage-only)
- AI Learning link → LearningDashboard
- EcosystemSettings (Pulse + Logos Vision bridge)
- System Status (read-only health checks)
- Static Configuration Guide (shows .env vars)
- Static About section

## Database Schema (already exists in server/db/migrations/2025_12_17__settings.sql)

Tables: user_settings, workspace_settings, audit_logs

user_settings columns:
- user_id UUID PK
- theme_mode TEXT ('system'|'light'|'dark')
- accent_mode TEXT ('system'|'custom')
- accent_color TEXT (hex)
- reduce_motion BOOLEAN
- notifications_json JSONB
- meetings_json JSONB
- ai_json JSONB
- updated_at TIMESTAMP

workspace_settings columns:
- workspace_id UUID PK
- integrations_json JSONB
- security_json JSONB
- data_controls_json JSONB
- updated_at TIMESTAMP

## Implementation Tasks (in order)

### Task 1: Create Backend Settings API
File: backend/routes/settings.js (NEW — port from server/routes/settings.js)
- GET /api/settings/user — fetch user settings from Supabase user_settings table
- PUT /api/settings/user — update user settings
- Use Supabase client from backend/config/supabase.js
- Add audit logging
Mount in backend/server.js: app.use('/api/settings', require('./routes/settings'))

### Task 2: Create Frontend Settings API Client
File: frontend/src/services/api.js
Add settingsApi object:
- getUser: () => api.get('/settings/user')
- updateUser: (data) => api.put('/settings/user', data)

### Task 3: Create useSettings Hook
File: frontend/src/hooks/useSettings.js (NEW)
- Fetches user settings on mount
- Provides updateSetting(key, value) function
- Caches in React state + syncs to backend
- Merges JSONB fields (notifications_json, meetings_json, ai_json) intelligently

### Task 4: Add Audio Device Selection
File: frontend/src/hooks/useAudioDevices.js (NEW)
- Call navigator.mediaDevices.enumerateDevices()
- Filter to audioinput and audiooutput devices
- Return { audioInputs, audioOutputs, selectedInput, selectedOutput, setInput, setOutput }
- Persist selections to user_settings.meetings_json.audioInputDeviceId / audioOutputDeviceId

Update frontend/src/components/MeetingRecorder.jsx:
- Import useSettings or useAudioDevices
- Pass deviceId constraint to getUserMedia: { audio: { deviceId: { exact: selectedDeviceId } } }

### Task 5: Add Notification Preferences UI
File: frontend/src/components/settings/NotificationSettings.jsx (NEW)
Toggles for:
- email_meeting_summary (bool)
- email_overdue_reminder (bool)
- email_weekly_digest (bool)
- slack_enabled (bool)
- slack_channel (string — channel ID)
- browser_push (bool)
- in_app_notifications (bool)
Persist to user_settings.notifications_json

### Task 6: Wire Up SlackSettings
File: frontend/src/components/settings/SlackSettings.jsx (EXISTS — 668 lines)
- Restyle to Void Crimson: replace <style> block with VC components and CSS vars
- Import and render in Settings.jsx within an Integrations section

### Task 7: Add Meeting Defaults UI
File: frontend/src/components/settings/MeetingSettings.jsx (NEW)
Fields:
- default_title_template (text input, default: "Meeting-{date}")
- auto_transcribe (toggle, default: true)
- transcription_language (dropdown: Auto, English, Spanish, French, etc.)
- recording_quality (radio: Standard / High / Max)
- default_project_id (project selector dropdown)
Persist to user_settings.meetings_json

### Task 8: Add AI Settings UI
File: frontend/src/components/settings/AISettings.jsx (NEW)
Fields:
- ai_provider display (read-only, shows current provider)
- summary_detail_level (dropdown: Brief / Standard / Detailed)
- action_item_sensitivity (slider: Conservative—Balanced—Aggressive)
- auto_assign_threshold (slider: 0.5—1.0, default 0.75)
- enable_sentiment_analysis (toggle)
Persist to user_settings.ai_json

### Task 9: Refactor Settings Page with Sub-Navigation
File: frontend/src/pages/Settings.jsx (REWRITE)
Replace monolithic scroll with sidebar tabs:
- General: Profile + Appearance (theme + accent color + reduce motion)
- Audio & Recording: Device selection + MeetingSettings
- AI & Intelligence: AISettings + LearningDashboard link
- Notifications: NotificationSettings
- Integrations: EcosystemSettings + SlackSettings + Calendar
- System: Status + About

### Task 10: Persist Theme to DB
Update frontend/src/context/ThemeContext.jsx:
- After setThemeMode, also call settingsApi.updateUser({ theme_mode: newMode })
- On initial load, check user_settings first, fall back to localStorage
- Add "System" option to UI

## Key Files to Reference
- Design system components: frontend/src/components/vc/ (VCButton, VCInput, VCBadge, VCIconBox)
- API pattern: frontend/src/services/api.js (follow existing patterns like meetingsApi, calendarApi)
- Backend route pattern: backend/routes/meetings.js (Supabase + Express pattern)
- Backend config: backend/config/supabase.js (Supabase client)
- Existing orphan: frontend/src/components/settings/SlackSettings.jsx
- DB schema: server/db/migrations/2025_12_17__settings.sql

## Style Rules
- Use Void Crimson design system CSS variables (--text-primary, --accent-primary, --bg-elevated, etc.)
- Use VCButton, VCInput, VCBadge, VCIconBox components
- Use lucide-react for icons
- Follow existing card pattern: <div className="vc"> with header + content sections
- Border style: borderBottom: '1px solid var(--b1, rgba(248,240,242,.06))'
- Font: fontFamily: 'var(--font-display)', fontWeight: 600
- Light/dark mode: use CSS vars, NOT conditional isDarkMode classes
```

---

## 8. Summary

**What works:** Ecosystem Bridge, System Status display, AI Learning management, basic theme toggle.

**What's broken:** Settings backend routes aren't mounted. Theme doesn't persist to DB. SlackSettings is an orphan.

**What's completely missing:** Audio device selection (critical for a meeting recorder), notification preferences, meeting defaults, AI behavior config, calendar settings, email settings, user profile, workspace admin settings, secrets management UI, and audit log viewer.

The Settings page currently functions as a **read-only status dashboard** with a theme toggle. For Entomate to fulfill its purpose as a meeting intelligence platform, users need control over how meetings are recorded (audio devices), how they're processed (AI settings), and how they're notified about results (notifications). The database schema and backend services for most of this already exist — the gap is primarily frontend UI and the missing API route mount.
