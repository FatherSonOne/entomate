# Entomate Projects — standalone tracker audit and roadmap

Date: 2026-11-23 (America/New_York). The audit and first five implementation sweeps are complete in source.

Prepared with `/app-dev` audit, Ponytail review/audit, and Huashu design critique. Scope: the whole Projects feature and direct dependencies, not an audit of unrelated Entomate modules.

## Evidence boundary

- Source inspected: `F:/entomate-command-release`, commit `cef0718a321810e671b539a3434ab08f87b460d4`.
- `git ls-remote origin refs/heads/main` matched that SHA during this review. This establishes current remote source, not deployed runtime.
- `F:/entomate` remains an older main checkout; this new document is saved there for continuity. Implementation and subsequent sweeps are tracked with the application source.
- No production UI, live API, database ledger, RLS enforcement, or ecosystem delivery was tested in this review. Schema statements below describe repository migrations, not a new live introspection.
- The initial audit changed documentation only. See PRJ-01 below for the subsequent code and verification.
- Existing unrelated work, including modified graph artifacts, was left alone.

## 1. Product decision and protected foundation

Recommended: Projects is a usable standalone Entomate workspace for planning, commitments, decisions, and meeting context. Logos Vision/Pulse connections add destinations; they are not a prerequisite for saving or completing work.

Protect these working structures:

1. One project record, with direct tasks and linked meetings.
2. Meeting action items remain their original records; Projects reads them rather than making duplicate task copies.
3. Shared Tasks/Projects work-item adapter and inspector, source meeting links, and recording timestamps.
4. Existing List/Lanes, subtasks, owner/due/priority fields, completion, and explicit meeting link/unlink.
5. Existing Ento AI confirmable writes, multi-step project/task proposals, action log, undo guards, and saved personal conversations.
6. Existing private/team meeting-note boundaries; no automatic publication of private notes into a shared project.
7. Existing navigation. No new top-level Planning or Gathering module is required.

The central missing product object is a durable, shared project plan. An AI proposal batch is not the same thing as a maintained project plan.

## 2. Where the information lives today

| Information | Current storage / connection | What users can do today | Gap |
|---|---|---|---|
| Project identity and outline | `projects`: name, description, status, dates, tags, owner/team fields, settings, deal metadata | Create/edit outline; activate, complete, archive | Description is the only substantial planning text; accountable-owner/team editing is not exposed |
| Directly entered or AI-created project tasks | `tasks.project_id` | Manage through Projects and Tasks; subtasks in shared inspector | No phases/milestones in Projects; estimates exist in schema but not current task write contract |
| Meeting connection | `meetings.project_id` | Link/unlink a meeting | One project association per meeting; current picker only considers 50 recent meetings |
| Meeting commitments | `action_items.meeting_id` -> linked meeting -> project | Show alongside direct tasks; complete/change status; source playback; eligible reminder | Owner/date/text correction is not available in the project inspector for action items |
| Decisions | `meetings.decisions`; timestamps from `summary_moments` | Collected decision list with source and date | No maintained project-level decision state, supersession, or resulting plan-change workflow |
| Personal planning conversation | `ento_ai_threads` | Reopen saved conversations in Ask Entomate history | Not a shared project brief; prose is not automatically a saved task or project update |
| Proposed/confirmed AI changes | `ento_ai_action_log`, plan ID + ordered steps | Confirm a batch, see result links, inspect partial failure, guarded undo | Project page has no planning-history/brief entry point |
| Personal research clips | Private `search_notes` | Keep personal research | Must not silently become shared project knowledge |
| Notes about a meeting | `meeting_notes`, author-private by default, explicit team visibility | Write/read permitted meeting notes | Not a general project notebook; private content requires deliberate sharing |

**No export required:** project/task writes and meeting/action-item persistence are native Entomate operations. Meeting post-processing invokes external delivery conditionally and asynchronously; connection failure is not a reason to discard native work. A proposed standalone tracker should remain fully usable with both ecosystem destinations disconnected.

### Confirmed AI plan versus conversation prose

`propose_plan` already supports 2–8 actions, for example `create_project` then tasks whose project IDs bind to the created project. Nothing executes before Confirm. Confirmed results become ordinary `projects` and `tasks`; the action log records each step. Execution is sequential and partial failure is possible: preserve already-created records and show the exact remaining steps. A long narrative draft in chat remains conversation text unless deliberately saved or converted.

Evidence: `backend/services/entoAi/writeTools.js:99,414,582`; `actionLog.js:336,412`; `frontend/src/components/EntoAssistant/PlanCard.tsx:81`; `supabase/migrations/20261122100000_ento_ai_threads.sql:19`; `frontend/src/App.jsx:85`.

## 3. Surface area and operation contracts

| Surface | Main files | Responsibility |
|---|---|---|
| Portfolio/detail | `frontend/src/pages/Projects.tsx`, `ProjectDetail.tsx` | Load portfolio and project; work lanes/list; link meetings; edit project |
| Project presentation | `frontend/src/services/projectsView.ts`, `styles/themes/bench-swiss.css` | Dates, signals, timeline, meeting tape, decisions, owner counts |
| Shared work UI | `services/tasksView.ts`, `components/tasks/TaskDetail.jsx`, `components/TaskEditModal.jsx` | Adapt tasks and actions, inspect source, status, subtasks, task editing |
| Native persistence | `backend/routes/projects.js`, `tasks.js`, `meetings.js`, `schemas/projects.js`, `tasks.js` | Authenticated writes and org-filtered reads |
| Aggregate/report | `backend/services/projectRollup.js`, `projectReport.js`, `routes/reports.js` | Progress/late/meeting/decision totals and project export |
| Planning assistant | `backend/services/entoAi/tools.js`, `writeTools.js`, `actionLog.js`; assistant PlanCard/history | Lookup, propose, confirm, persist, undo |
| Reuse candidates | meeting notes, carry-forward, follow-up, action-item tracker/dependencies | Authoring boundaries, meeting continuity, blockers |

| Operation | Chain and input/output contract | Failure / completeness concern |
|---|---|---|
| Create project | Drawer -> `projectsApi.create` -> `POST /projects` -> `projects`; returns created project -> navigate | No complete shared-plan contract; create fields differ from update naming |
| Add direct task | Project task form -> `tasksApi.create({projectId,...})` -> `tasks`; reload project | Preserve project and parent context for subtasks; verify reload across screens |
| Change commitment status | Shared inspector -> task endpoint OR action-item endpoint selected by kind | Preserve original entity ID/source; optimistic UI reloads after failure |
| Link meeting | Picker -> `meetingsApi.update({project_id})` -> project reload | Partial multi-link success possible; overwrites previous association; not a many-to-many share |
| Read portfolio/project | Project routes -> tasks + linked meetings + their action items -> rollup/work adapter | Child read errors discarded; detail history cap changes work population |
| Plan through AI | Assistant -> proposal/action log -> Confirm -> sequential project/task writes -> result links | Conversation is private; proposal execution is not an atomic maintained project plan |

## 4. Ranked audit findings

### P0A — measurements must not hide partial data

`backend/routes/projects.js:113–125,165–191` discards child query errors and substitutes empty arrays. A failed action-item load can make a project appear to have less work and fewer late items. Detail loads only the newest 50 linked meetings and then loads actions only for those IDs; portfolio aggregation uses a different population.

Fix: a failed required read returns an explicit error or visibly incomplete state. Separate paginated meeting display from complete work/decision/count queries. Define one metric population for portfolio, detail, AI answers, and reports.

### P0B — re-extraction must preserve commitment identity

`backend/routes/meetings.js:995–1027,1252–1284` creates fresh IDs and inserts extracted actions again when reprocessing. Insert errors are returned using unsaved in-memory objects. Source inspection shows a duplicate/false-success path; this was not reproduced against production.

Fix: explicit reconciliation contract that preserves user edits, completion, and source identity. Do not delete old action items or auto-merge similar records as an audit shortcut. Verify repeated extraction and partial failure before changing this shared pipeline.

### P1 — time display lacks actionable measurements

`Projects.tsx:132–174`, `projectsView.ts:204–266`: month labels only; no exact start/end, duration, remaining/overdue days, range control, tooltip, focus target, or row navigation inside the chart. At most six dated live projects are drawn. Missing starts are inferred from today/end; that is display fallback, not a user-approved start date.

The portfolio bar fill means completed-item percentage. The detail tape fill means elapsed calendar time. Similar visuals have different semantics. Neither supports schedule prediction. A dated task-count ratio is not earned-value or hours-complete measurement.

Fix: measured date scale, explicit dates/durations, labelled progress units, clickable/focusable rows, visible limits and undated bucket. Details in the design proposal below.

### P2 — planning and accountability have no maintained shared home

Project edit exposes description, dates, status, tags and deal value (`ProjectDetail.tsx:204–223,586–627`). Storage contains owner/team fields, but there is no accountable-owner/member workflow here and `owner_id` is not an allowed project update field. No structured outcome/success criteria, phase/milestone plan, shared project update history or resource collection is surfaced.

Fix: compact Brief and milestone organization, author/time-stamped updates, visible accountable owner, supporting resource links. Start with plain text/structured fields and links. File hosting and a general document editor are separate needs, not prerequisites.

### P2 — native meeting commitments are harder to maintain than direct tasks

`TaskDetail.jsx:112–114,166–176` displays owner/date/priority read-only and exposes Edit/Delete only for direct tasks. A meeting commitment can be completed or nudged, but its mistaken assignment/date/text cannot be corrected in Projects.

Fix: extend the existing inspector and correct original action records through the proper endpoint. Preserve the distinction between an AI suggestion and an accepted commitment when adding a review workflow. Do not create a third task store.

### P2 — project search and meeting selection have misleading coverage

`Projects.tsx:31,58–80,224` searches only the loaded first 100 rows yet suggests search can narrow a larger collection. Readouts and late queue cover that page. `ProjectDetail.tsx:104–116` considers only 50 recent meetings and maps picker fetch failure to an empty list.

Fix: server search/pagination; honest total/coverage labels; distinct empty and failed states. Show source/destination explicitly before moving an already-linked meeting. Existing one-project membership should remain explicit until a separate many-project association design is approved.

### P2 — AI/project/report definitions disagree

`backend/services/entoAi/tools.js:316–413` counts direct tasks in project answers; it does not include linked actions/decisions in the same shape as the project page. AI lookup also has independent caps. `projectReport.js:27` includes task subtasks while rollup skips them.

Fix: share the metric definition and completeness metadata. Keep source records separate. A user asking the assistant what remains must receive the same population as the UI, or an explicitly narrower answer.

### P3 — project history and deletion need protection

Deletion in `routes/projects.js:271–299` is several independent operations, with child errors ignored. Use archive as the normal way to retire work. Transactional deletion hardening is separate, explicitly scoped work. Decision summaries are regenerated on meeting reprocessing, so a permanent approved decision log would require deliberate snapshot/version semantics.

## 5. Existing capability to reuse

- Baseline `tasks` already has `start_date`, `estimated_hours`, `actual_hours` (`00000000000000_baseline.sql:2076–2086`). Task editing already supports start dates; current task write schemas do not accept hour estimates. Surface valid existing fields before designing a time-tracking subsystem.
- `action_item_dependencies` and `ActionItemTrackerService.detectBlockingChains` already exist, as does `BlockingChainDiagram`. Their presence is not evidence of an end-to-end dependency editor in Projects.
- `carryForward.js`, `followUp.js`, `CarryForward.tsx`, `FollowUpPanel.tsx` already support meeting continuity. Project next-meeting context should reuse them; its current open-item count alone does not prepare or populate an agenda.
- `MeetingIntelligencePanel` and MIP configuration exist. Projects currently derives generic decisions/actions; profile-specific deliverables and risks are not automatically maintained as project milestones or approved plan changes.
- `meeting_notes` provides private/team access patterns. Never use private meeting/search notes or private AI conversations as a shared project brief without an explicit save/share operation.
- Existing project report builder reads tasks and linked meeting actions; export is optional and should use the same totals as native views.

## 6. Huashu critique and concrete design proposal

Review basis: user-supplied Projects screenshot plus current JSX/TSX/CSS. Scores are design judgments, not usability-study results: philosophy consistency 7/10; hierarchy 7/10; craft 7/10; functionality 4/10; originality 7/10. Overall 6.4/10. Fine alignment/contrast across full viewports has not been visually reverified.

Keep: main navigation, strong project title/table, compact source-aware work rows, the visual date comparison, late-work queue. The schedule graphic earns its space only if it helps answer when, how long, how late, and what to do next.

Design assumptions: a desktop team-work screen, used at laptop distance; calm, precise, information-first; retain the current Bench/Swiss system. Preserve compact mobile work rows and provide text-equivalent schedule information. No navigation restructure or production component replacement was performed.

### Before / recommended after

| Current | Recommended after | Gain / risk |
|---|---|---|
| Months and glowing NOW line | Day/week ticks, full range/year, Today date, exact row start/due dates | Date precision; guard label collisions at narrow widths |
| Unlabelled mixed fill | Separate `8/12 items complete` from `21/35 calendar days elapsed` | Honest units; do not infer health from percentage difference |
| End dot | `Due Dec 5 · 12 calendar days left` or `3 days overdue`; explicit legend | Actionable urgency without color-only meaning |
| Six dated tracks | Range controls, visible `6 of N`/show-all handling, No dates group | No hidden projects or fabricated dates |
| Static tracks | Keyboard/click opens project or schedule detail; hover/focus gives dates, duration, overdue count | Gives chart a useful action; no drag scheduling in first pass |
| Everything on one long project screen | Keep work/decision/meeting sections; add compact Brief and collapsible Plan/Updates sections | Adds planning without replacing working navigation |
| Conversation-only planning | `Plan with Entomate` opens existing assistant in project context; explicit `Save to brief` and confirmed task results | Shared durable plan without a second planning engine; sharing must be deliberate |

Illustrative row content, not real project dates:

```text
Bluepine pilot       Owner: Alex      Active
Nov 10 → Dec 5       25 days          12 days left
8 of 12 items done   2 overdue        Next milestone: Pilot review · Dec 1

Schedule range: [Weeks] [Months]    [Today]    Nov 2026 → Jan 2027
                 Nov 16   Nov 23   Nov 30   Dec 7   Dec 14
Bluepine pilot   ━━━━━━━━━━━│━━━━━━━━◆━━│
                           Today   review  due

Brief: outcome, success criteria, scope, owner, target dates, resources
Plan: phases / milestones with the existing task and action-item records
Open work: List / Lanes; owner, due, status, priority, blocker, source
Meeting record: decisions and source moments; next meeting and follow-ups
Updates: what changed, by whom, when, and why
```

Timeline v1 must distinguish calendar duration from effort. Use calendar days consistently; business-day calculations require a real work-calendar policy. No automatic forecast, critical path, or schedule dragging is needed to make the first version useful.

Alternative A: measured deadline view + brief + shared work (recommended). Smallest path to an independent tracker.

Alternative B: full Gantt/capacity/budget system. More powerful for complex delivery but adds dependency editing, work calendars, scheduling/reconciliation, permissions and new maintenance. Defer until actual users require those capabilities.

### Standalone project workflow

1. Define outcome, scope, accountable owner and target dates; save the shared brief.
2. Add work manually or ask Ento AI to propose initial tasks; confirm the exact records to create.
3. Link relevant meetings. Review newly extracted commitments and proposed plan changes with their source moments; do not silently rewrite approved dates or decisions.
4. Work from Tasks or Projects against the same underlying records. Show owner/date/blocker/source and allow corrections.
5. Prepare the next meeting from open commitments, unresolved decisions and milestone changes using existing continuity tools.
6. Save a short status update; complete/archive the project with an accessible record of outcomes.
7. Optionally publish selected outcomes externally. Native saving and completion keep working without connections. Only label external delivery success when verified by the actual integration.

## 7. Fellow and project-tracker comparison

Current official sources checked 2026-11-23; details and links in `projects-review/product-facts.md`.

Fellow's documented pattern is a meeting workspace: channels organize meeting recaps, action items aggregate across meetings or custom groups, and Ask Fellow can focus on a channel. Users can make standalone action items and edit owners/dates; accepted AI suggestions enter regular work and carry-forward. These are useful without a project-management export.

Fellow's Asana integration separately links individual items or a meeting series to an Asana project and synchronizes selected fields/completion bidirectionally. Do not assume Entomate's ecosystem exports already implement that sync contract.

Asana's documented project overview adds the missing maintained-plan layer: brief, roles, resources, milestones and status updates. This is a useful completeness checklist, not a requirement to reproduce its whole platform.

Product inference: Entomate can combine meeting continuity with a modest native plan. Copy the coherent loop, not the number of features or the appearance of a Gantt chart. Fellow's published navigation is not evidence that it has no other project-related features.

## 8. Ponytail review and audit

No implementation diff was created, so review inspected the existing feature and the proposed direction. Whole-feature audit searched production consumers before marking candidates.

1. `delete:` `frontend/src/pages/ProjectDashboard.jsx:26`, 555 lines; unreachable because former routes redirect in `App.jsx:67–68` and no production import remains. Replacement: existing project page and active Tasks/Projects Lanes.
2. `delete:` `frontend/src/components/KanbanBoard.jsx:43`, 399 lines; only imported by the unreachable dashboard. Replacement: existing active Lanes.
3. `yagni:` old stats/dashboard API wrappers/routes maintain another metric path. Retirement candidates only: external API clients have not been checked, so no endpoint deletion is recommended here.
4. Protect the task/action union and adapters. They represent two real persisted entities and preserve provenance. A new gathering store, generic planning engine, duplicate task copies, or new Gantt dependency would add complexity without closing the present gaps.

**net: -954 lines, -0 deps possible.** No deletions made. Recharts is still used elsewhere. Cleanup is not the first product priority; any removal needs the required explicit Before/After approval.

## 9. Source-level structural assessment

| Dimension | Score | Evidence / limitation |
|---|---|---|
| Cohesion | 7/10 | Pure view/rollup helpers are useful; detail page coordinates many concerns; legacy dashboard remains |
| Coupling | 7/10 | Reuses shared inspector and adapters; meeting processing changes affect project records and metrics |
| Complexity | 7/10 | Direct CRUD and two-source adapter are reasonable; multiple independent metric definitions add drift |
| Error surface | 4 → 6/10 | PRJ-01 surfaces required read failures and loads older meeting work. Multi-link, deletion and meeting save failures remain open. |
| Type safety | 6/10 | Current project TSX helpers typed; mixed JS/API casts; broad runtime validation; no typecheck run here |

No overall production-hardening score is assigned: live permissions, migrations, multi-user behavior and runtime were not tested in this audit.

## 10. Proposed sweep roadmap

| ID | One verifiable outcome | Acceptance evidence | Status |
|---|---|---|---|
| PRJ-00 | Audit / product direction / competitor facts | Source baseline and scoped findings recorded | DONE (this report; local, uncommitted) |
| PRJ-01 | Trustworthy project reads and counts | Failed child reads surface a retry. Portfolio and detail agree for a fixture with 251 meetings. Portfolio totals and search state their page scope. | DONE locally, 2026-11-23 |
| PRJ-02 | A measured, actionable timeline | Exact dates and calendar days, adaptive day/week/month ticks, keyboard links, separate work counts, visible preview and undated coverage | DONE locally, 2026-11-23 |
| PRJ-03 | Durable shared project brief and lead | Outcome, scope, success criteria, lead, and resource links save on the project. Workspace access and stale edits are checked. | DONE locally, 2026-11-23 |
| PRJ-04 | Maintain every project commitment in place | Edit the original action owner, date, and wording. Verify the same record in Projects, Tasks, and its source meeting. | DONE locally, 2026-11-23 |
| PRJ-05 | Safe repeated meeting extraction | Retrying extraction on the same meeting preserves saved commitments. Failed writes leave the transcript available for recovery. | DONE locally, 2026-11-23 |
| PRJ-06 | Meeting-to-plan review and continuity | Existing AI planning/carry-forward reused; deliberate save to brief; sourced proposed changes; next-meeting context | NEXT |
| PRJ-07 | Milestones and concise project updates | Milestone owner/date/completion and attributable status updates; align AI/report metric definitions | PROPOSED |
| PRJ-08 | Safe retirement and optional integration handoff | Archive first; separately approved cleanup/deletion; explicit external status, verified destination behavior | LATER |

Decided as recommended for the proposal: standalone native storage, preserve navigation and existing records, measure calendar time first, reuse Ento AI/continuity tools, defer a full PM engine. These are design recommendations; application behavior is unchanged.

PRJ-06 is next. Reuse Ento AI and Carry Forward to propose project brief changes from a linked meeting. Let the user inspect the source and approve what becomes part of the saved brief, then bring the relevant project context into the next meeting.

### PRJ-01 implementation and release state

The code is in `F:/entomate-projects-sweep`, a separate checkout based on `cef0718a321810e671b539a3434ab08f87b460d4`. The active list and detail routes now stop on failed task, meeting or action-item reads. Supporting queries page their results, and action-item lookups batch meeting IDs. Both views include linked work past the old 50-meeting limit.

The portfolio preserves the existing 100-project page size and adds Previous and Next controls. The visible summaries and search describe their current page. The broader server search and cross-surface AI/report metric alignment remain separate roadmap items.

The code is local and uncommitted. Remote `main` was still at the base SHA during verification. No deployment or schema change was made.

### PRJ-02 implementation and release state

The isolated checkout `F:/entomate-projects-sweep` advanced to `8cc6cce7e92b96ec5f6a4ff455f5359e987106a3` before the timeline changes. PRJ-01 remained in the working tree.

The portfolio shows a dated scale that adapts to the visible range. Each row shows the saved dates, calendar duration when both dates are present, days remaining or overdue, and a separate work count. A deadline can appear as a marker without a saved start. The preview shows its coverage and can expand to all dated projects on the current page. Projects without deadlines appear in a separate expandable group.

Project detail uses the same calendar scale and labels elapsed calendar days and work completion separately. It retains meeting markers in the visible date range. The meeting list remains available for meetings outside that range. Exact duration uses elapsed calendar days between the saved dates, with a separate label for same-day schedules. The guide now explains both views.

Verification used an America/New_York clock for 23 focused frontend tests, including daylight saving, reversed dates, and an end date without a start. Type checking and the frontend build passed. Chromium exercised the main Projects route and detail using controlled fixtures at 1440px, 1024px, and 390px. It verified keyboard opening, the preview and undated groups, the date editor, meeting markers, and separate schedule/work values. No page exceptions or overlapping tick labels were observed in the fixture. The changes remain local and uncommitted. No production deployment or schema change was made.

### PRJ-03 implementation and release state

The project page now includes an editable shared brief for the outcome, scope, success criteria, accountable lead, and up to ten resource links. The existing project schedule provides the dates. The brief uses `projects.settings.brief` in Entomate and does not call a Logos Vision or Pulse endpoint. The separate brief API lets a brief read fail without hiding the rest of the project.

Workspace members can read the brief. The project record owner and workspace admins or owners can edit it. The assigned lead must be a member of the project’s own workspace. This assignment records accountability and does not transfer the existing record owner’s access. Legacy projects show their record owner as the initial lead when that person is still in the workspace. Workspace admins can assign a lead for projects without a record owner. A departed lead remains identifiable as a former member until reassigned.

Saving preserves other project settings. A general settings save preserves the brief, and a concurrent update is rejected with `409` so the editor can load the current version. The UI retains pending text until the user chooses to reload. Resource links are limited to absolute HTTP(S) links without embedded credentials. No private meeting notes or assistant threads are included.

Verification passed 301 backend tests, 23 focused frontend tests, type checking, and the frontend build. Router tests used a database fixture to check project-owner and workspace-admin writes, reader access, tenant isolation, invalid leads and resource links, stale versions, and preservation of other settings. Chromium at 1440px and 390px verified lead selection, saving and reloading against a stateful API fixture, conflict recovery, and the reader view. The brief flow issued no Logos Vision or Pulse requests. Production persistence was not exercised.

Code for PRJ-01 through PRJ-03 is uncommitted in `F:/entomate-projects-sweep` at base `8cc6cce7e92b96ec5f6a4ff455f5359e987106a3`. No schema change, push, or production deployment was made.

### PRJ-04 implementation and release state

The same edit form is available in Projects, Tasks, and the source meeting. It updates the original Entomate action item and preserves its meeting link, transcript timestamp, and completion history. Changing the assignee clears the old email unless a new email is entered. A stale save keeps the user's draft visible and reports that the record changed.

The focused backend suites passed 313 tests, including read-back through all three views, date clearing, tenant isolation, invalid input, and stale edits. The 23 focused frontend tests, type check, and production build passed. Chromium with a stateful API fixture at 1440px and 390px verified editing from all three surfaces, switching between views with warm caches, opening the source transcript timestamp, clearing the due date, and editing a direct task.

PRJ-01 through PRJ-04 are local and uncommitted in `F:/entomate-projects-sweep` at base `a106630470a575aabc3d6f20618dad924e4f0c03`. The sweep required no schema change. It was verified against local fixtures, with no production deployment.

### PRJ-05 implementation and release state

Meeting processing now saves commitments as one batch and reuses any action items already stored for the meeting. This preserves edits, completion, transcript links, and external references. Reusing saved rows skips action-created automation and exports for those rows. A meeting with a completed summary can legitimately have zero action items or key points.

The bot and browser recorder keep the transcript available when extraction or its action-item write fails. The meeting page offers to finish the minutes from that transcript. Audio and transcript import responses identify the saved meeting when its minutes remain incomplete, and the client lets users reopen that meeting to finish the minutes. Older action rows, including any pre-existing duplicates, were retained.

Nine backend suites passed 528 tests. They exercised competing requests, edited and completed action items, a rejected action batch, an interrupted summary write, import recovery, and workspace isolation. Four frontend suites passed 55 tests. Type checking and the production build passed. Chromium with local API fixtures at 1440px and 390px verified the visible retry failure, successful recovery, Projects and Tasks refresh, and a single import request after a partial save.

PRJ-01 through PRJ-05 are local and uncommitted in `F:/entomate-projects-sweep` at base `a106630470a575aabc3d6f20618dad924e4f0c03`. No schema change was needed. Production database, AI, and integration behavior were outside this verification.

### Source release for PRJ-01 through PRJ-05

The release combines all five sweeps on top of `a219aa637dcbf2fe10d91f1a4c9b55d1fb28c607`, including the upstream recorder changes. The scoped changes require no database migration. On this base, 528 focused backend tests and 57 frontend tests passed, together with type checking and the frontend build. Earlier sweep verification is recorded above.

## 11. Verification run and remaining checks

Passed: 9 no-dependency Node assertions against the actual release-checkout `backend/services/projectRollup.js`: combined population, completion aliases, open count, overdue count, held-meeting decisions, next meeting, empty project, overdue ordering and late total. Fixed test time: `2026-11-23T17:00:00Z`. No DB calls or writes. This confirms helper behavior for those inputs, not route error handling or production behavior.

Source searches covered active routes/imports, project/task schemas, baseline and note migrations, assistant reads/writes/history, existing estimates/dependencies, reporting and meeting continuity. No full test suite, typecheck, visual browser test, live DB query or external sync test ran.

Both new documents passed UTF-8, final-newline and trailing-whitespace checks. A whole-checkout `git diff --check` also reported pre-existing whitespace problems in unrelated branding/landing-page work; those files were not changed by this audit.

PRJ-01 verification: 290 backend tests and 21 frontend tests passed, including injected task/meeting/action read errors, a later meeting-page error, and consistent rollups with 251 linked meetings. Type checking, the frontend build, and scoped whitespace checks passed. The backend suite required Jest's force-exit option because a test dependency left open handles.

Chromium exercised the actual `/projects` and `/projects/:id` routes with controlled API fixtures at 1440px and 390px. It verified retry after failed reads, returning from a failed later page, navigation to project 101, final-page controls, and page-scope labels. Both widths passed with no horizontal overflow or page exceptions. The code graph was refreshed in the isolated checkout.

Remaining checks include server search across multiple project pages, older meetings in the link picker and production persistence with integrations disconnected. Verify private and shared note behavior before exposing any shared brief collection.

## Mentor note

What: distinguish saved native project work from private planning drafts and optional delivery.
Why: a tracker becomes useful when every commitment has a durable home and its numbers can be trusted.
How: one project, existing source records, explicit shared brief, consistent aggregation, measured dates and traceable changes.
Next level: close the meeting -> reviewed commitment -> execution -> next-meeting loop.
Pro tip: define the population and units before drawing a progress chart.
Suggested exercise: reopen one project without integrations and account for every displayed item by source and owner.

PRJ-01 through PRJ-05 are included in this source release. Production release and runtime verification are separate.
