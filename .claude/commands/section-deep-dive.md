# Section Deep Dive — Discover, Diagnose, Evolve

Perform a comprehensive deep dive on the specified section: **$ARGUMENTS**

This is a multi-phase session that goes beyond auditing. You will study the section to understand its purpose, diagnose every issue, benchmark it against real-world productivity, work-management, and AI-assistant competitors, identify the feature gap, brainstorm evolution ideas, and then implement all fixes and improvements — leaving the section in a hardened, polished state.

---

## Phase 1: Discovery — What Is This Section?

Before touching any code, build a complete mental model of the section.

1. **Locate all files** belonging to this section — pages, components, sub-components, services, hooks, contexts, types, utilities, styles, tests, edge functions, and database schema. Entomate has both `src/` (root, Vite app) and `frontend/src/` (legacy/parallel surface) plus `backend/services/` — search both. List every file with its line count.

2. **Read every file completely.** Do not skim. Understand the full implementation.

3. **Answer these questions in writing:**
   - What is the core purpose of this section? What user problem does it solve?
   - Who is the primary user persona (knowledge worker, team lead, founder, PM, etc.)?
   - What are the main workflows a user follows through this section?
   - What data entities does it operate on? Where does the data come from and go?
   - Which Gemini / `@google/genai` calls does it make, and how is the AI output used?
   - What external services does it integrate with (Supabase, Google Calendar, Gmail, ecosystem bridge, Meet Mate bot, etc.)?
   - How does it fit into the broader Entomate navigation, and how does it interact with sibling sections (Meetings ↔ Tasks ↔ Projects ↔ Goals ↔ Calendar ↔ Agents ↔ Automations)?

4. **Produce an architecture map** (ASCII diagram) showing:
   - Component tree and hierarchy
   - Data flow (Supabase tables → services → contexts → components → UI)
   - State management approach (contexts, local state, derived state, query caching)
   - AI/LLM call sites and prompt assembly points
   - External integrations and API boundaries

Output: Write a `## Section Profile` with the answers and diagram.

---

## Phase 2: Health Check — What Works, What Doesn't

Systematically evaluate every feature and sub-feature in the section.

### Feature Inventory

Create a feature table covering every capability the section offers:

| # | Feature / Sub-feature | Status | Evidence | Notes |
|---|----------------------|--------|----------|-------|
| 1 | ... | Working / Partial / Broken / Stub / Dead Code | File:line | Details |

### Code Quality Scan

Check for each of these — report only actual findings, not clean passes:

- **Errors & Bugs**: Runtime errors, logic errors, broken workflows, race conditions
- **TypeScript Issues**: `any` types, missing types, incorrect type assertions, unsafe casts. Note: `frontend/src` is `.jsx` (untyped) — flag spots that would benefit from migration to `.tsx`.
- **Dead Code**: Unused imports, unreachable branches, commented-out blocks, initialized-but-never-used state, abandoned `frontend/src` mirrors of `src/` features (or vice versa)
- **Stub/Fake Functionality**: Mock data presented as real, hardcoded values, placeholder UI that looks functional but isn't wired up, AI features that return canned responses
- **State Management Problems**: Prop drilling, unnecessary re-renders, stale closures, missing dependency arrays, context overuse
- **Error Handling Gaps**: Missing try/catch around async operations, unhandled promise rejections, silent failures, no user-facing error states for failed Gemini calls or Supabase queries
- **Security Concerns**: Exposed keys (`GEMINI_API_KEY`, Supabase service role), missing input validation, XSS vectors, unprotected routes, missing RLS on workspace-scoped tables
- **Performance Issues**: Unnecessary re-renders, missing memoization, large inline objects, N+1 query patterns, unbounded list rendering, oversized Gemini prompts that should be chunked
- **Accessibility Gaps**: Missing ARIA labels, keyboard navigation issues (especially for Command Palette / Kanban / Calendar), color contrast problems, missing focus management
- **UX Friction**: Confusing flow, missing loading states, missing empty states, jarring transitions, unclear CTAs, AI features without "thinking" indicators or undo
- **Database/Backend**: Missing RLS policies, unoptimized queries, missing indexes, schema inconsistencies with TypeScript types, edge functions without auth checks
- **Ecosystem Integration**: Cross-app flows (QntmEcos bridge, Meet Mate bot, Pulse handoffs) that fail silently or miss the two-header auth pattern

### Issue Registry

Catalog every issue found, categorized by severity:

| # | Severity | Category | Issue | Location | Impact | Proposed Fix |
|---|----------|----------|-------|----------|--------|--------------|
| 1 | Critical | ... | ... | file:line | ... | ... |
| 2 | Medium | ... | ... | file:line | ... | ... |
| 3 | Low | ... | ... | file:line | ... | ... |

Every issue MUST have a proposed fix — no orphan problems.

---

## Phase 3: Competitive Benchmarking — How Does It Compare?

Research how comparable features work in established productivity, AI-assistant, and work-management tools. The goal is to understand what best-in-class looks like so you can identify gaps.

### Identify Comparables

Based on the section's purpose, identify 4-6 comparable products. Consider:

**Work Management & PM**: Notion, Linear, ClickUp, Asana, Monday.com, Trello, Height, Basecamp
**Task & Time**: Todoist, Things, TickTick, Motion, Reclaim, Sunsama, Akiflow, Amie
**Calendar & Scheduling**: Google Calendar, Cron/Notion Calendar, Fantastical, Calendly, Cal.com
**Meeting Intelligence**: Otter, Fireflies, Granola, Fathom, tl;dv, Read.ai, Krisp, Zoom AI Companion
**AI Assistants & Agents**: ChatGPT, Claude, Gemini app, Copilot, Mem, Reflect, Glean, Dust, Lindy, Relay.app
**Automation**: Zapier, Make, n8n, Pipedream, Workato
**Analytics/Reporting**: Geckoboard, Databox, Rows
**Knowledge & Notes**: Notion, Obsidian, Mem, Reflect, Capacities

### Feature Comparison Matrix

Build a matrix comparing your section's features against what these competitors offer:

| Feature | Entomate | Competitor A | Competitor B | Competitor C | Industry Standard? |
|---------|----------|-------------|-------------|-------------|-------------------|
| ... | Has/Partial/Missing | Has/Missing | Has/Missing | Has/Missing | Yes/No/Emerging |

Mark features as:
- Has it and it works well
- Has it but incomplete or rough
- Missing entirely
- Has it and it's better than competitors (differentiator)

### Gap Analysis

From the matrix, extract:
1. **Table-stakes gaps** — Features that every competitor has that we're missing. These are credibility gaps that could cause users to dismiss the section as incomplete.
2. **Competitive gaps** — Features that most competitors have and that would meaningfully improve the section.
3. **Differentiator opportunities** — Features that few competitors have but that align with Entomate's AI-native, agent-driven, ecosystem-connected positioning and could become unique selling points.
4. **Over-engineering check** — Features we have that competitors don't and that nobody seems to need. Candidates for simplification.

---

## Phase 4: Evolution Brainstorm — Where Should This Section Go?

Based on everything learned in Phases 1-3, brainstorm how to evolve this section. Think in three horizons:

### Horizon 1: Foundation Hardening (implement now)
Things that make the existing features reliable, complete, and professional:
- Fix every issue from the Issue Registry
- Complete every stub/partial feature
- Add missing error handling, loading states, empty states
- Harden the database layer (RLS, indexes, constraints)
- Fill table-stakes feature gaps
- Reconcile `src/` ↔ `frontend/src/` divergence where it exists

### Horizon 2: Competitive Parity (implement next)
Features that bring the section up to industry standard:
- Competitive gap features from the matrix
- UX improvements inspired by best-in-class competitors
- Data model extensions needed to support these features
- Integration points with other Entomate sections (Meetings → Tasks, Goals → Projects, etc.)

### Horizon 3: Differentiation (plan for later)
Ideas that could make this section uniquely valuable:
- Differentiator opportunities from the gap analysis
- Agent-driven workflows that leverage the Agents/Automations primitives
- Deeper Gemini integration (multi-step reasoning, tool use, structured outputs)
- Cross-app synergies through the QntmEcos ecosystem (Meet Mate bot, Pulse handoffs, shared identity)
- Predictive/proactive features (anticipating what the user will do next)

For each brainstormed feature, note:
- **What**: One-line description
- **Why**: The user problem it solves or the value it adds
- **Complexity**: Low / Medium / High
- **Dependencies**: What else needs to exist first

---

## Phase 5: Implementation — Fix, Build, Polish

Now execute. Work through improvements systematically.

### Execution Order

1. **Critical fixes first** — Anything broken, any security issue, any data integrity risk
2. **Stub completion** — Wire up any fake/placeholder functionality to real data and services (especially AI features returning canned output)
3. **Error handling & resilience** — Add try/catch, loading states, empty states, error boundaries, retries for Gemini/Supabase calls
4. **TypeScript hardening** — Replace `any` types, add missing interfaces, fix type safety; consider migrating critical `.jsx` to `.tsx`
5. **Dead code removal** — Remove unused imports, unreachable code, commented-out blocks, abandoned parallel implementations
6. **UX polish** — Loading indicators, AI "thinking" states, transitions, empty states, responsive fixes, keyboard shortcuts
7. **Table-stakes features** — Implement the most critical gap features from Phase 3
8. **Performance** — Memoization, virtualization, query optimization, prompt-size optimization
9. **Accessibility** — ARIA labels, keyboard navigation, focus management

### Implementation Rules

- Fix one issue at a time. Verify each fix before moving to the next.
- Run `npm run typecheck` and `npm run build` periodically to catch TypeScript errors early.
- When adding new features, follow existing patterns in the codebase — don't introduce new paradigms.
- If a fix requires database changes, document the migration SQL clearly.
- If a fix is too large or risky for this session, document it as a follow-up item with full context instead of attempting a half-measure.
- Keep a running log of every change made.
- Respect ecosystem auth patterns — cross-app calls use the gateway+token two-header convention.

### After Each Change

Briefly note:
- What was changed and why
- Which Issue Registry item it resolves (by number)
- Any new issues discovered during the fix

---

## Phase 6: Session Report

After all implementation work is complete, produce a final report.

### Summary

- Section analyzed: [name]
- Files read: [count]
- Issues found: [count by severity]
- Issues fixed: [count]
- Issues deferred: [count, with reasons]
- New features added: [list]
- Competitors benchmarked: [list]

### Changes Made

| # | Change | Files Modified | Issue # Resolved | Type |
|---|--------|---------------|-----------------|------|
| 1 | ... | ... | #X | Fix / Enhancement / New Feature |

### Deferred Items

For any issues or features not addressed in this session, provide full context so they can be picked up later:

| # | Item | Why Deferred | Suggested Approach | Priority |
|---|------|-------------|-------------------|----------|
| 1 | ... | ... | ... | High/Medium/Low |

### Evolution Roadmap

Summarize the Horizon 2 and Horizon 3 items as a prioritized backlog for future sessions.

### Output

Save the full report to: `docs/deep-dives/<SECTION_NAME>_DEEP_DIVE_<DATE>.md`

Use today's date in YYYY-MM-DD format. Use kebab-case for the section name.

---

## Guiding Principles

- **Honesty over politeness.** If something is broken, say it plainly. If a feature is a stub, call it a stub. If a Gemini call returns mock data, call it out. The value of this session depends on accurate diagnosis.
- **Fix, don't just flag.** The difference between this and a static audit is that you actually implement solutions. Every issue in the registry should either be fixed or have a clear reason why it was deferred.
- **Think like a user.** Imagine a busy professional or team lead using Entomate daily to run their meetings, tasks, projects, and agents. What would frustrate them? What would delight them? What would they expect from an "AI work OS" that isn't there?
- **Compete on purpose.** Don't copy every feature from Notion or ClickUp. Identify what matters for Entomate's specific positioning — AI-native, agent-driven, ecosystem-connected — and lean into that.
- **Leave it better than you found it.** The section should demonstrably work better, look better, and be more reliable at the end of this session than at the beginning.
