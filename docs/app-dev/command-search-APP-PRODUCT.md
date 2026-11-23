# Command search and navigation keys

## Status and scope

2026-11-23: S9 / Search access sweep released and verified in production. The user authorized the isolated commit and then the next integration/release step. Implementation commit: `ed9d911fb988c59dfeca8bdf202addf561bd6f8e`. Integrated with current remote main (`f4d3ad0`) without conflicts in `F:/entomate-command-release`; merge commit `9906ec04e17d7e7c5afd3ba640755810fc9e4e5b` was pushed to `origin/main`. The original `F:/entomate` checkout and its unrelated local edits remain untouched. No feature branch, reset, rebase, force push, or migration application was used.

This is one cross-cutting improvement to the existing Search module. The toolbar and Search page retain `searchEngine.ts`, `useSearch.ts`, `/api/search/everything`, and the existing notes store. No schema or migration changes.

## Observable behavior

- Bench Swiss moves the palette input from the rail into the top toolbar. It expands into an anchored panel, stays within the viewport, and works at phone width. Other themes retain the modal palette and gain the shared commands and spelling behavior.
- Opening settles through a small spring overshoot; closing has its own settle. OS reduced motion and the app's reduced-motion setting suppress travel.
- Hold Ctrl (or Cmd) to peek at navigation keys. Ctrl/Cmd+1 through 6 open Today, Meetings, Tasks, Projects, Automations and Insights; 7 opens Search, 8 the User Guide, 9 Bot for admins, 0 Notes, comma Settings. Ask Entomate keeps Ctrl/Cmd+/. Key release, window blur and document visibility changes clear the peek. Typing fields and dialogs do not run navigation keys.
- One command catalog powers matching, executable navigation shortcuts, visible hints and shortcut help. It includes pages, creation actions, notes, automation recipes, AI history, meeting agents, documentation and report exports. Documentation opens the existing User Guide.
- Command matching ranks exact labels before prefixes, aliases and close spelling, including adjacent letter swaps. Record results and recent searches also supply completion suggestions. Right Arrow at the input's end completes the prediction; Enter opens the selected row. Best record matches precede Ask; Tab still asks. `>` selects commands only. Filters, Clear, Escape, Ctrl/Cmd+Enter to full Search, and Ctrl/Cmd+S to clip records remain available.
- New Project uses its real `dr=new` receiver. New Task consumes `new=true` and opens the page's existing draft drawer. Neither creates data merely by selecting the command.
- Search drops stale and in-flight results when the query changes or the palette closes.

## Spelling fallback and protected boundaries

`backend/services/searchEverything.js` preserves the existing client, org filters and private-note rules. Meeting titles and decisions can match close spelling within the existing 300-meeting scan. For other groups, only an empty exact result triggers a second read of up to 100 recent scoped rows. Fuzzy comparison examines up to 2,000 characters, words up to 40 characters, and one edit for 4-5-letter words or two for longer words, including transpositions. It does not promise exhaustive fuzzy discovery of old records beyond those bounds. Exact queries retain their original query budget. Actual titles and links remain intact; approximate records say `Closest spelling`.

Protect: tenant isolation, own-or-team meeting-note visibility, private clips, transcript moment links, clip deduplication, Search URL state, existing themes, bot role restrictions, creation forms and unrelated Entomate AI work.

## Verification

- Full frontend Vitest run: 403 tests passed; focused commands, request lifecycle and navigation regressions included. JSON evidence: `F:/entomate-command-deps/frontend-results.json`.
- TypeScript check passed. Production Vite build passed. Existing build warnings remain for CSS import ordering, duplicate `style` in LearningDashboard and bundle size.
- Backend Search and meeting-note regression suites: 33 tests passed (12 Search), including workspace/private-note boundaries, spelling ranking, exact-query budget and empty-scope refusal. Existing backend lint error (`score` destructuring unused) was reproduced against the unchanged base version as well as the edited file.
- Playwright Chromium with controlled API fixtures exercised the real shell, palette, Tasks and Projects receivers at 1440x1000 and 390x844. Verified keyboard routes, typo prediction, record completion, Search handoff, draft drawers, filters, Clear, Escape, held-key hints, no horizontal phone overflow and reduced motion. No page exceptions in that run. Backend matching was also used to generate the misspelled-record fixture. This is local integration evidence, not authenticated production proof.
- Screenshots: `C:/ClaudeChrome/entomate-command-search-light.png`, `entomate-command-search-dark.png`, `entomate-command-search-mobile.png`, `entomate-command-search-results.png`, `entomate-shortcuts.png`.
- AST graph refresh ran locally. Machine-specific graph and cache changes are not part of the proposed source change.

## Roadmap

| Row | State | Next action |
| --- | --- | --- |
| CS-01: toolbar palette, key peek, commands and shared spelling fallback | RELEASED | Implemented in `ed9d911`; integrated and pushed in `9906ec0`; production verified below. |
| CS-02: release acceptance | VERIFIED | Vercel production READY and domain alias verified; authenticated desktop/phone controls, Search spelling fallback, Notes access and unauthenticated refusal passed. |
| CS-03: larger workspace search | FUTURE | Measure fuzzy misses and latency before replacing the bounded fallback with an indexed database search. |

Teaching: one catalog prevents hints from advertising keys that do nothing; one Search engine keeps record permissions and matching consistent across surfaces. Next level: measure query latency and missed old-record searches before widening scans. Try `>proejcts`, then Right Arrow, then Enter; hold Ctrl to inspect the available navigation keys.

## Production acceptance - 2026-11-23

- Integration checks on the current main baseline: **413 frontend tests passed**, **33 backend Search/meeting-note tests passed**, TypeScript and production build passed. Evidence: `F:/entomate-command-deps/integration-tests.json`, `integration-tests.log`, `integration-build.log`.
- Vercel production deployment `dpl_362zicGiddsMqYT7cVwn4XbdFqdT` is READY for `9906ec04e17d7e7c5afd3ba640755810fc9e4e5b`; `entomate.logosvision.org` resolves to that deployment. Source was deployed by the configured Git integration; no duplicate manual deployment was started.
- Render restarted after publication. `/health/live` and `/health/ready` returned 200. The authenticated production Search endpoint returns the new `spellingMatch` metadata and finds a real accessible meeting from a transposed-letter query; the live palette renders `Closest spelling` and completes its actual title. This directly verifies the new backend behavior; the Render commit identifier was not exposed by the health endpoint.
- Playwright used the configured test account against the production domain with no API fixtures. Passed: toolbar placement, Ctrl peek/release, misspelled command completion and routing, New Task draft drawer, Documentation routing, real record completion, readable Notes, viewport bounds at 390x844, Clear/Escape and reduced motion. Unauthenticated Search returns 401. No page exceptions. No records or notes were created or deleted.
- An anonymous `/api/settings/user` request during sign-in startup returned 401; the same endpoint with the signed-in test user's token returned 200. No authenticated API failures were observed in the verification run.
- Evidence: `F:/entomate-command-deps/live-verification.json`; screenshots `C:/ClaudeChrome/entomate-live-command-search-desktop.png` and `C:/ClaudeChrome/entomate-live-command-search-mobile.png`.
- Recommended next: CS-03, measure Search latency and misses in larger workspaces before widening the bounded spelling fallback.
- Final receiver verification exposed a timing edge: Enter immediately after Right Arrow completion could run Ask while refreshed records were loading. A regression test reproduced it; Enter now waits in that state, while the explicit Tab-to-Ask control remains available. The follow-up release contains this guard and the acceptance record.
