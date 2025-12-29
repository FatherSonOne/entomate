# Entomate Settings — Complete Spec (Functional)

## Settings navigation (left sub-menu)
User Settings
- Profile
- Appearance
- Notifications
- Meetings & Recording
- AI (Gemini)

Workspace Settings (admin-only sections)
- Integrations (Logos Vision CRM, Pulse Chat)
- Automations
- Agents (Phase 2)
- Search & Knowledge (Phase 2)
- Security & Access (RBAC / roles)
- Audit Logs
- Data Controls (Retention / Export / DLP)
- About / Diagnostics

## Appearance (User)
Fields:
1) Theme Mode: system | light | dark
2) Highlight/Accent:
   - Accent Mode: system | custom
   - Accent Color (hex picker): default #00A86B
3) Match system color option:
   - Implemented as Accent Mode = system
   - Meaning: do NOT use custom accent; use default app accent
4) Reduce motion: boolean (optional but recommended)

Rules:
- If Theme Mode = system: follow OS preference (prefers-color-scheme)
- If Theme Mode = light/dark: force that theme
- If Accent Mode = system: use app default accent (#00A86B)
- If Accent Mode = custom: use Accent Color everywhere accent is referenced
- Persist immediately and restore on reload

## AI (Gemini) (User + Admin visibility)
- Show Gemini connection status (Connected / Missing Key)
- Do NOT allow users to type the API key in the UI in production.
  Instead: show “Configured by admin” and a health check button.
- Health check: call backend /health/gemini

## Integrations (Workspace/Admin)
Logos Vision CRM:
- Enabled toggle
- API key status: Configured / Missing
- Test connection button
- Webhook status: Connected / Missing (Phase 2 dependency)

Pulse Chat:
- Enabled toggle
- API key status
- Test send message button (safe test channel)

## Security & Access (Workspace/Admin)
- Roles: Admin / Member / Guest minimum
- Show current user role in Settings
- Restrict “Admin-only” sections based on role

## Audit Logs (Workspace/Admin)
- Audit log viewer with filters:
  - Date range
  - Actor (user)
  - Action type (settings_change, integration_test, export, role_change)
- Export CSV button

## Data Controls (Workspace/Admin)
- Retention policy (days):
  - Meetings audio
  - Meeting transcripts
  - Pulse messages
  - Search embeddings / knowledge
- Export jobs:
  - Export meetings
  - Export audit logs
- Basic DLP:
  - Disable public share links (MVP)
