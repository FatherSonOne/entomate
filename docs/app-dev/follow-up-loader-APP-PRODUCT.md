# Meeting follow-up loader - FU-01 / FU-02

## Problem and confirmed cause

The authenticated GET `/api/meetings/:id/follow-up` returned HTTP 500 for a meeting with completed minutes. Production returned `Could not load the follow-up`.

`backend/services/followUp.js:loadMeeting` selected `meetings.user_id`. A targeted read of production `information_schema.columns` confirmed that the meeting owner is stored in `created_by`; there is no `meetings.user_id`. Running the same PostgREST projection returned `42703: column meetings.user_id does not exist`, before the loader could read or create a follow-up. The table `follow_ups` and the user's `follow_up_auto_send` column already exist. This is a query/schema mismatch, not a missing-table or migration fix.

## FU-01 - implementation verified

Removed only `user_id` from the meeting projection. `created_by` remains selected, and the existing ownership fallback, draft content, scheduler, send/stop controls, permission checks, API response shape and database schema are unchanged.

The three new loader tests reproduce the production schema contract, verify reuse of an existing draft without writes or email, retain meeting/org scoping for action items, handle missing meetings and propagate database failures. They failed with `42703` before the correction and passed afterward.

Validation:

- 50 tests passed across `followUp.loading`, `followUp`, `meetingNotes` and `searchEverything`; Node syntax and `git diff --check` passed.
- The corrected service was exercised against the real database using the configured service client. A historical meeting was verified to be outside the six-hour auto-send window before the call. It produced one `draft` with `send_at = null`; a second read returned the same draft. No send function or email control was called. The existing service used its supported template-opening fallback.
- Before evidence: `F:/entomate-command-deps/follow-up-before.json`; corrected-service evidence: `F:/entomate-command-deps/follow-up-local-fixed.json`.
- Production acceptance evidence is saved after deployment to `F:/entomate-command-deps/follow-up-fixed.json`: authenticated endpoint 200, unscheduled draft, stable ID on repeated reads, unauthenticated 401, and the rendered Follow-up tab at desktop and phone widths. No Send now or auto-send control is exercised.

## Impact check

| Axis | Scope |
| --- | --- |
| Callers | Follow-up GET/update/send paths and scheduled drafting reuse the same loader; its arguments and return shape are preserved. |
| Tests | Added `backend/__tests__/followUp.loading.test.js`; retained the existing follow-up helper coverage and adjacent meeting-note/Search suites. |
| Data and types | No schema, data contract or frontend type change. Only the invalid projection field is removed. |
| Configuration | None. |
| Documentation | This change record; source publication and deployment are reported separately with observed evidence. |

Other `user_id` queries inspected in this service belong to `user_settings` and `org_members`, where that column is valid. The optional in-memory `meeting.user_id` ownership fallback does not issue a query and is not changed in this fix.

## FU-02 - explicit read-error recovery

`useFollowUp` now exposes `loadError` and `retry`. Failed reads retain the last successful data and report the server/client error. The letter shows an accessible alert and an in-place Retry button, disabled while retrying or while an existing mutation is busy. A successful read clears the error. Background refresh failures keep the existing letter visible with a warning; a successful empty response still shows the minutes-ready message rather than a read error.

The save/send/stop/auto-send handlers, refresh scheduling, API routes, data normalization and schema are unchanged. Retry only calls the existing follow-up GET and invalidates its cache.

Validation:

- Three new regression cases failed against the original hook/renderer before the implementation. Seven recovery tests now cover initial failure, pending retry, repeated failure, successful empty data, minutes readiness, wrapped server errors, an error after an empty response, and failed scheduled refresh with retained data and recovery. Together with the existing follow-up view suite, the focused suite has 19 passing tests.
- The full frontend suite passes all 423 tests with runner exit 0; TypeScript and the production Vite build pass. The build reports existing warnings for a duplicate JSX `style` attribute in `LearningDashboard.jsx`, outdated Browserslist data and large chunks.
- Before release, the existing production build was exercised with browser-local follow-up GET failures: no Retry button appeared, reproducing the missing recovery path.
- Release acceptance uses `F:/entomate-command-deps/verify-fu02.cjs`; its results and desktop/phone screenshots are written to `F:/entomate-command-deps/fu02-live-verification.json` and `fu02-{desktop,phone}-{error,recovered}.png`. The browser locally injects GET failures, retries against the real endpoint, checks pending-button disabling and recovery without a reload, and asserts the historical unscheduled draft is unchanged. Follow-up writes are blocked during verification; no send or auto-send control is exercised.
- The required code-only graphify update runs locally. Existing graph artifacts and unrelated work are excluded from scoped publication; the stale, dirty `F:/entomate` checkout is preserved.

## Next recommended sweep

Review `useFollowUp` request isolation when navigating between meetings while a load is still pending. Keep this separate from FU-02's read-error recovery.

Technique: validate database projections against the deployed schema as well as testing pure helpers. A valid draft renderer cannot protect a loader that fails before it reads the meeting.
