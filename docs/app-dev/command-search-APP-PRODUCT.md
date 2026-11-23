# Command search and navigation keys

## Status and scope

2026-11-23: S9 / Search access sweep implemented and verified locally. The user authorized a scoped commit in the isolated checkout as an exception to the main-only rule. Source integration and release are pending. Review checkout: `F:/entomate-command-search`, based on `e30eb41` from `origin/main`. No branch was created and nothing was pushed or deployed. The original `F:/entomate` checkout was left untouched: its `main` was 229 commits behind the refreshed remote and had unrelated local changes.

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
| CS-01: toolbar palette, key peek, commands and shared spelling fallback | VERIFIED LOCALLY | Integrate scoped source into main while preserving unrelated edits; release frontend and backend together. |
| CS-02: release acceptance | PENDING | After authorized deployment, repeat authenticated Search, private Notes, record links and keyboard behavior against production. |
| CS-03: larger workspace search | FUTURE | Measure fuzzy misses and latency before replacing the bounded fallback with an indexed database search. |

Teaching: one catalog prevents hints from advertising keys that do nothing; one Search engine keeps record permissions and matching consistent across surfaces. Next level: measure query latency and missed old-record searches before widening scans. Try `>proejcts`, then Right Arrow, then Enter; hold Ctrl to inspect the available navigation keys.
