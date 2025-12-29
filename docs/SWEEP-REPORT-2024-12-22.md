# Entomate Codebase Sweep Report
**Date:** 2024-12-22
**Scope:** App-wide sweep for errors, broken handlers, and documentation review

---

## Executive Summary

A comprehensive sweep of the Entomate codebase identified **60+ issues** across 6 major areas:

| Area | Critical | High | Medium | Low |
|------|----------|------|--------|-----|
| Backend Routes & Services | 4 | 15+ | 10+ | 5+ |
| Frontend Components | 1 | 3 | 5 | 5 |
| Agent/Automation Services | 6 | 5 | 0 | 0 |
| Phase3 Services | 3 | 7 | 10 | 5 |
| Database Integration | 2 | 3 | 2 | 0 |
| Documentation (.claude) | 0 | 4 | 5 | 3 |

---

## 1. BACKEND ROUTES & SERVICES

### Critical Issues

1. **Missing Agent Service Import** - `backend/routes/agents.js:5`
   - `require('../services/agents')` references file that doesn't exist
   - Will cause runtime crash on agent routes

2. **Route Conflict** - `backend/routes/agents.js:309,327`
   - GET and POST routes share same path `/api/agents/run/:agentName`
   - Creates routing ambiguity

3. **Module Initialization Failure** - `backend/routes/automations.js:9-11`
   - `automationScheduler.initialize()` can fail silently
   - Scheduler won't run but app continues

4. **Dead Code/Unused Variables** - `backend/routes/agents.js:169-182`
   - AIAgent imported via both `import()` and `require()`
   - Variables created but never used

### High Severity Issues

- **Missing error handling** in 25+ database operations across:
  - automations.js (lines 312, 431, 434-440, 535-544)
  - integrations.js (lines 93-102, 113-121, 156-165, 289-298, 307-314)
  - search.js (lines 185, 985)

- **Missing authentication** on 7 endpoints:
  - `/api/agents` (GET)
  - `/api/agents/templates` (GET)
  - `/api/agents/available` (GET)
  - `/api/agents/orchestrator/logs` (GET)
  - `/api/search/suggestions` (GET)
  - `/api/search/cache/stats` (GET)
  - `/api/integrations/status` (GET)

- **Missing authorization** checks on 8+ data modification routes

### Security Concerns

- SQL-like string construction in search queries
- No input length validation on search parameters
- Integration status endpoint exposes connected systems

---

## 2. FRONTEND COMPONENTS

### Critical Issue

1. **Props Mismatch - CoachingPanel** - `src/components/MeetingsView.tsx:639-643`
   ```tsx
   // INCORRECT - These props don't match CoachingPanel definition
   <CoachingPanel
     isLive={true}
     currentTranscript=""
     onCoachingTip={(tip) => console.log('Coaching tip:', tip)}
   />

   // EXPECTED - From CoachingPanel.tsx:6-11
   interface CoachingPanelProps {
     meetingId: string      // MISSING
     userId: string         // MISSING
   }
   ```

### High Severity Issues

1. **Missing useEffect Dependencies** - Multiple settings panels
   - `AboutDiagnosticsPanel.tsx:8` - `api` not in deps
   - `AuditLogsPanel.tsx:10-12` - `api` not in deps
   - `IntegrationsPanel.tsx:8-10` - `api` not in deps

### Medium Severity

- Unhandled fire-and-forget promises in MeetingsView
- No error boundaries on critical components (AgentsView, AutomationsView, MeetingsView)
- Unsafe `as any` type coercions in ProjectsView
- Missing null checks in SearchView citation handling

---

## 3. AGENT & AUTOMATION SERVICES

### Critical Issues

1. **Table Name Mismatch** - `src/agents/agentTriggerService.ts:26`
   - Uses `entomate_meetings` but triggers expect `meetings`
   - All meeting triggers will fail

2. **Guardrail Logic Inverted** - `src/agents/agentRunner.ts:132,136,140`
   ```typescript
   // WRONG - Uses < instead of >
   if ((g.maxPulseMessagesPerRun ?? 3) < counters.pulseMessages) {
   // CORRECT
   if (counters.pulseMessages > (g.maxPulseMessagesPerRun ?? 3)) {
   ```
   - Guardrails completely ineffective

3. **Missing started_at Timestamp** - `src/agents/agentRunner.ts:114`
   - recordStep() never sets `started_at` field
   - Database inserts may fail

4. **Race Condition in Idempotency** - `src/agents/agentRunner.ts:20-38`
   - Check and insert not atomic
   - Same trigger can execute multiple times

5. **Inconsistent sourceId Format** - `src/agents/agentTriggerService.ts:50,78,117,209,286`
   - Meeting: `meeting:${meetingId}` (no timestamp)
   - Deal: `deal_stage:${dealId}:${Date.now()}`
   - Task: `task_overdue:${taskId}:${date}`
   - Breaks idempotency

6. **Silent Error Swallowing** - `src/agents/agentRunner.ts:117-119`
   - recordStep errors logged but not thrown
   - Audit trail unreliable

### High Severity

- All 5 action handlers are TODO stubs (agentRegistry.ts:127-172)
- Missing Logos Vision API integration (syncToCrm.ts:156-157)
- Missing error handling in finishRun()
- Trigger context missing entity data

---

## 4. PHASE3 SERVICES

### Critical Issues

1. **Placeholder Implementations** - `src/phase3/integrationsService.ts`
   - `syncCRMContacts()` - Returns hardcoded zeros (lines 540-551)
   - `pushActivityToCRM()` - Returns mock data (lines 595-603)
   - `syncCalendarEvents()` - Returns empty array (lines 627-634)
   - `createCalendarEvent()` - Returns mock event (lines 653-664)
   - All video meeting operations are stubs (lines 688-735)

2. **Async Retry Not Awaited** - `src/phase3/webhookService.ts:350-352`
   - setTimeout with async callback not awaited
   - Retries execute but caller doesn't wait

3. **Window.location.reload** - `src/phase3/components/RolesManagement.tsx:97`
   - Hard page reload instead of proper state management

### High Severity

- Missing null check in useCoachingSession (hooks.ts:380)
- Incorrect substring matching for customer queries (healthService.ts:114-118, 175-178)
- Type mismatch in getCoachingStats (coachingService.ts:173-175)
- Non-functional Edit/Delete role buttons (RolesManagement.tsx:299-305)

### Medium Severity

- Missing error handling in multiple hooks
- Incomplete responsiveness calculation (always returns 70)
- No validation in batch sentiment analysis
- Missing View History implementation

---

## 5. DATABASE/SUPABASE INTEGRATION

### Critical Issues

1. **Table Reference Mismatch**
   - agentTriggerService uses `entomate_meetings`
   - meetingCompleted trigger uses `meetings`
   - One or the other is wrong

2. **Missing Field** - agent_run_steps table
   - recordStep() doesn't set `started_at`
   - May violate NOT NULL constraint

### High Severity

- No connection cleanup on app shutdown (supabase.js)
- Inconsistent error handling after database operations
- Missing RLS policy validation in tests

---

## 6. DOCUMENTATION (.claude)

### High Severity Issues

1. **Deployment Specialist Prompt Wrong**
   - References Vercel (should be AWS ECS/Docker)
   - Missing Supabase migration steps

2. **Tech Stack Misalignment**
   - Prompts reference "Logos Vision CRM / PULSE"
   - Should reference "Entomate"
   - Missing Express backend patterns

3. **Duplicate Files**
   - agent-switching-rules.md exists in two locations
   - Creates confusion about canonical version

4. **Nearly Empty File**
   - `Practical Implementation.md` - Only 1 line

### Medium Severity

- Missing refactoring workflow definition
- No cross-references between files
- Outdated timestamps
- Missing MCP server documentation

---

## TODO Comments Found

Location | Line | Comment
---------|------|--------
src/analytics/dealProbability.ts | 45 | Replace with actual Logos Vision CRM fetch
src/analytics/dealProbability.ts | 63 | Implement actual stats fetching
src/agents/agentRegistry.ts | 128 | Implement using geminiService
src/agents/agentRegistry.ts | 138 | Implement using crmSyncService
src/agents/agentRegistry.ts | 148 | Implement using pulseChatService
src/agents/agentRegistry.ts | 158 | Implement using projectService
src/agents/agentRegistry.ts | 168 | Implement task assignment logic
src/agents/actions/syncToCrm.ts | 156 | Call Logos Vision API

---

## Recommended Fix Priority

### Immediate (P0)
1. Fix CoachingPanel props mismatch in MeetingsView
2. Fix table name mismatch in agentTriggerService
3. Fix inverted guardrail logic in agentRunner
4. Fix missing agents service import

### This Week (P1)
1. Add missing error handling to database operations
2. Add authentication to unprotected endpoints
3. Fix started_at timestamp in recordStep
4. Implement actual action handlers (replace stubs)
5. Fix useEffect dependencies in settings panels

### Next Sprint (P2)
1. Replace placeholder implementations in integrationsService
2. Add authorization checks to data modification routes
3. Update .claude documentation for Entomate context
4. Add error boundaries to critical components
5. Consolidate duplicate documentation

---

## Files Modified Today
- Created: src/context/ThemeContext.tsx
- Created: src/components/ThemeToggle.tsx
- Modified: index.tsx (theme provider, toggle)
- Modified: index.html (dark mode CSS)
- Modified: src/components/SettingsView.tsx (appearance section)

---

*Report generated by Claude Code app-wide sweep*
