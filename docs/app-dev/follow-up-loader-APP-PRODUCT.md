# Meeting follow-up loader - FU-01 / FU-02 / FU-03 / FU-04

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

## FU-03 - isolate pending requests by meeting

Confirmed: the hook retained the previous meeting's draft/error/busy state and accepted asynchronous results after navigation. A browser-local delayed GET against the deployed FU-02 renderer reproduced the previous meeting's subject appearing while the current meeting was still loading. Twelve regression cases also failed against the original hook before the fix.

The hook now retires its previous request scope on meeting/readiness changes and unmount. A layout effect clears the old draft, read error and busy/loading state before paint; a per-scope read sequence accepts only the newest read. Retired successes, errors and finalizers cannot replace the active meeting or finish its loading state. StrictMode effect replay creates a fresh scope. Retained callbacks do not start requests after unmount or while minutes are unavailable.

Save/send/stop/auto-send keep the same API calls and arguments. Their late responses and notifications are ignored after navigation, and an old finalizer cannot unlock a new meeting's operation. This does not cancel a mutation already requested by the user. The existing scheduled refresh timing, API contracts, backend, schema and mail controls are unchanged.

Validation:

- Fourteen isolation regressions cover old/new meeting result order, state clearing, readiness changes, overlapping reads, unmount, StrictMode replay, pending scheduled refresh and late mutation success/failure. All mutation tests use mocks; no email is sent.
- All 33 focused follow-up tests and all 437 frontend tests pass; the full runner exits 0. TypeScript, the production build and scoped `git diff --check` pass. Existing build warnings remain documented under FU-02.
- Browser acceptance: `F:/entomate-command-deps/verify-fu03.cjs` injects delayed successes/failures into the deployed app and navigates between meeting routes without reloading. The second meeting and its draft are browser-local fixtures, avoiding any server-side draft creation. Desktop checks an old success while the new read is pending; phone checks an old error after the new draft loads. Results: `F:/entomate-command-deps/fu03-live-verification.json`; screenshots: `fu03-desktop-{pending,settled}.png` and `fu03-phone-settled.png`. The historical real draft is checked unchanged before/after, and follow-up writes are blocked.
- Impact: the existing `MeetingDetail` caller and `FollowUpState` interface remain compatible; tests are extended in `FollowUpPanel.test.tsx`; there are no new dependencies, configuration, API or schema changes. This document records the change. The required code-only graphify update stays local and is excluded from scoped publication.

## FU-04 - preserve mutations against stale reads

Confirmed: FU-03 scoped reads to the current meeting but did not invalidate them when its draft changed. Eight new regression cases failed before the fix. The deployed renderer also reproduced a scheduled refresh replacing the edited subject while a browser-local save was still pending; no real save reached the backend.

Each mutation now invalidates prior reads and increments an in-flight write count. Read results cannot update data, errors or loading state while a write is pending. When a write settles, its read sequence advances again, rejecting reads that began during the write. Fresh reads after settlement continue normally. Busy state remains until all overlapping writes settle; a successful full-draft mutation clears an obsolete read error. Failed save/send/stop operations still perform their quiet recovery read after updating the write count.

Save/send/stop/auto-send keep their existing API calls, arguments and notifications for current requests. No mutation is cancelled or retried by this fix, and scheduled refresh requests retain their existing timing. Backend, schema, API contracts and mail controls are unchanged.

Validation:

- Eleven new tests cover old read successes/errors after save, reads completing during save, reads begun during save, fresh reads afterward, failed-save recovery, clearing a prior read error, overlapping busy state, mocked send/stop/auto-send responses and scheduled refresh ordering. All 448 frontend tests pass with runner exit 0; TypeScript, production build and scoped whitespace checks pass. Existing build warnings are unchanged.
- Browser acceptance uses `F:/entomate-command-deps/verify-fu04.cjs`. It supplies a browser-local scheduled draft, delays its read and intercepts the subject save without forwarding it. Desktop checks a stale success during the pending save; phone checks a stale error after the save reply. Results: `F:/entomate-command-deps/fu04-live-verification.json`; screenshots: `fu04-desktop-pending-save.png` and `fu04-{desktop,phone}-settled.png`. The real historical draft is compared unchanged before/after. No email, real follow-up write, send control or auto-send control is used.
- Impact: `MeetingDetail` and the `FollowUpState` interface remain compatible; `FollowUpPanel.test.tsx` is extended. There are no new dependencies, configuration, backend, API or schema changes. This document records the change, and the code-only graph update stays local outside scoped publication. `F:/entomate` remains untouched.

## Next recommended sweep

Review response ordering for overlapping saves from rapid edits to different fields. FU-04 guards reads around writes; it does not serialize writes or order their replies.

Technique: validate database projections against the deployed schema as well as testing pure helpers. A valid draft renderer cannot protect a loader that fails before it reads the meeting.
