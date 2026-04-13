# Entomate — Production Readiness Plan

**Created:** 2026-03-23
**Author:** Rune ᚱ + Claude Code Team
**Status:** Ready for execution
**Prerequisite:** All 8 phases of the UI/UX audit plan are complete.

---

## Table of Contents

1. [Sprint 1 — Security Critical](#sprint-1--security-critical)
2. [Sprint 2 — Stability & Error Handling](#sprint-2--stability--error-handling)
3. [Sprint 3 — Performance](#sprint-3--performance)
4. [Sprint 4 — Polish](#sprint-4--polish)
5. [Sprint 5 — Testing & Quality](#sprint-5--testing--quality)
6. [Execution Prompt](#execution-prompt)

---

## Current State Summary

| Metric | Value |
|--------|-------|
| Frontend bundle | 1,577 KB (needs code splitting) |
| CSS bundle | 96.98 KB |
| Backend services | 70+ files, 726 console.log statements |
| Test coverage | 0% (only artillery load tests) |
| alert()/confirm() | 0 (all replaced with VC components) |
| Hardcoded Tailwind colors | 0 (all replaced with CSS variables) |
| React Error Boundary | None |
| Input validation | None (no zod/joi/express-validator) |
| 404 page | None |
| Code splitting | None (all routes eagerly imported) |

### Positive Infrastructure Already in Place
- Helmet security headers (partially configured)
- Rate limiting on API + auth endpoints
- Winston logger (exists but not fully adopted)
- Sentry error tracking configured
- Docker multi-stage builds
- Health check endpoints
- Toast + ConfirmDialog system
- Supabase RLS architecture

---

## Sprint 1 — Security Critical

> **BLOCKING: Nothing ships to production until Sprint 1 is complete.**

### 1.1 Rotate All Exposed API Keys (MANUAL — User Action Required)

**Problem:** `.env` file was committed to git with live API keys.

**Keys to rotate immediately:**
- [ ] OpenAI API key (`sk-proj-...`)
- [ ] Google Gemini API key (`AIzaSy...`)
- [ ] Supabase Anon Key (both hub and app)
- [ ] Supabase Service Key (both hub and app)
- [ ] Gmail app password
- [ ] Admin API key

**Where to rotate:**
- OpenAI: https://platform.openai.com/api-keys
- Google AI Studio: https://aistudio.google.com/apikey
- Supabase: Project Settings → API → Regenerate keys
- Gmail: Google Account → Security → App passwords

**After rotating:** Update `.env` locally (never commit again).

### 1.2 Remove `.env` from Git History

**Problem:** Even if `.env` is in `.gitignore` now, it exists in git history.

```bash
# Install BFG Repo-Cleaner (faster than git filter-branch)
# Then run:
bfg --delete-files .env
git reflog expire --expire=now --all
git gc --prune=now --aggressive
git push --force
```

**Also ensure `.gitignore` has:**
```
.env
.env.local
.env.*.local
```

### 1.3 Add Input Validation (zod) to All Backend Routes

**Problem:** Zero input validation on 23 API routes. Any payload shape is accepted.

**Approach:**
- Install `zod` in backend
- Create validation middleware factory
- Add schemas for every route that accepts user input

**Files to create:**
- `backend/middleware/validate.js` — Generic zod validation middleware
- `backend/schemas/meetings.js` — Meeting route schemas
- `backend/schemas/tasks.js` — Task route schemas
- `backend/schemas/projects.js` — Project route schemas
- `backend/schemas/goals.js` — Goal route schemas
- `backend/schemas/automations.js` — Automation route schemas
- `backend/schemas/integrations.js` — Integration route schemas
- `backend/schemas/workflows.js` — Workflow route schemas
- `backend/schemas/secrets.js` — Secrets route schemas

**Validation middleware pattern:**
```javascript
// backend/middleware/validate.js
const { z } = require('zod');

function validate(schema) {
  return (req, res, next) => {
    try {
      req.validated = schema.parse({
        body: req.body,
        query: req.query,
        params: req.params
      });
      next();
    } catch (err) {
      res.status(400).json({
        error: 'Validation failed',
        details: err.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message
        }))
      });
    }
  };
}
```

**Priority routes (handle user input directly):**
1. `POST /api/meetings/process` — file upload + body params
2. `POST /api/tasks` — task creation
3. `POST /api/projects` — project creation
4. `POST /api/goals` — goal creation
5. `POST /api/automations` — automation creation
6. `POST /api/secrets` — secret storage
7. `POST /api/workflows` — workflow creation
8. `POST /api/integrations/crm/*` — CRM sync operations

### 1.4 Harden Server Startup

**Problem:** Server starts with weak defaults if env vars are missing.

**Changes to `backend/server.js`:**
- Require `SESSION_SECRET` in production (fail if not set)
- Add `process.on('unhandledRejection')` handler
- Add `process.on('uncaughtException')` handler
- Validate required env vars before starting

**Required env vars for production:**
```
SUPABASE_URL (required)
SUPABASE_SERVICE_KEY (required)
SESSION_SECRET (required, must be 32+ chars)
NODE_ENV (required, must be 'production')
```

### 1.5 Enable CSP Headers in Production

**Problem:** Content Security Policy is disabled in production (Helmet config).

**Change in `backend/server.js`:**
```javascript
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],  // Tighten after testing
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'", process.env.SUPABASE_URL, "https://*.supabase.co"],
    }
  }
}));
```

---

## Sprint 2 — Stability & Error Handling

### 2.1 Add React Error Boundary

**Problem:** Any component error crashes the entire app (white screen).

**Create:** `frontend/src/components/ErrorBoundary.jsx`

**Behavior:**
- Catch render errors in component tree
- Show friendly "Something went wrong" UI with VC styling
- "Reload" button to recover
- Log errors to console (Sentry will pick them up)
- Wrap `<App>` in `main.jsx`

### 2.2 Create Reusable ErrorState Component

**Problem:** 11 pages catch API errors but show nothing to the user.

**Create:** `frontend/src/components/vc/ErrorState.jsx`

**Props:**
- `message` — Error description
- `onRetry` — Retry callback (shows Retry button if provided)
- `icon` — Optional custom icon (defaults to AlertTriangle)

**Design:** Uses `vc` card surface, `vc-text-warning` icon, `VCButton` for retry.

### 2.3 Add Error States to All 11 Pages

**For each page, add:**
1. `error` state variable
2. Set error in catch block
3. Clear error on successful retry
4. Render `<ErrorState>` when `error` is truthy

**Pages to update:**
1. `Dashboard.jsx` — wrap `Promise.all` in error handler
2. `Tasks.jsx` — loadTasks error state
3. `Projects.jsx` — loadProjects error state
4. `Goals.jsx` — loadGoals error state
5. `Automations.jsx` — loadAutomations error state
6. `Calendar.jsx` — loadEvents error state
7. `Reports.jsx` — loadReports error state
8. `Agents.jsx` — loadAgents error state
9. `Analytics.jsx` — loadAnalytics error state + empty state CTA
10. `Workflows.jsx` — loadWorkflows error state
11. `Search.jsx` — search error state

**Note:** Meetings.jsx already has error state (added in earlier session).

### 2.4 Add 404 Page

**Create:** `frontend/src/pages/NotFound.jsx`

**Design:**
- Large "404" heading
- "Page not found" message
- VCButton to go home (`/dashboard`)
- Uses `vc` card surface with `VCCanvas` background

**Wire in:** `frontend/src/App.jsx` — add `<Route path="*" element={<NotFound />} />`

### 2.5 Add Env Var Validation on Server Startup

**Create:** `backend/config/validateEnv.js`

**Behavior:**
- Check all required env vars exist
- Warn on optional missing vars
- Fail fast with clear error messages in production
- Print startup config summary (redacted)

---

## Sprint 3 — Performance

### 3.1 Route-Based Code Splitting

**Problem:** 1,577 KB JS bundle loaded for every page.

**Changes to `frontend/src/App.jsx`:**
```javascript
const Dashboard = React.lazy(() => import('./pages/Dashboard'))
const Meetings = React.lazy(() => import('./pages/Meetings'))
const Tasks = React.lazy(() => import('./pages/Tasks'))
// ... all pages
```

**Wrap routes in `<Suspense>`:**
```javascript
<Suspense fallback={<PageLoader />}>
  <Route path="/dashboard" element={<Dashboard />} />
</Suspense>
```

**Create:** `frontend/src/components/PageLoader.jsx` — Full-page loading spinner using VC styling.

**Expected result:** Initial bundle drops to ~400-500 KB, each page loads ~100-200 KB on demand.

### 3.2 Standardize Logging

**Problem:** 726 `console.log/warn/error` statements across 70 backend files, mixed with Winston logger.

**Approach:**
1. Create `backend/utils/log.js` — thin wrapper around Winston
2. Export `log.info()`, `log.warn()`, `log.error()`, `log.debug()`
3. Replace all `console.log/warn/error` in backend with `log.*`
4. Configure log levels per environment:
   - Development: debug
   - Production: info
5. Remove emoji prefixes (✅ ❌ ⚠️) from log messages

**This is a mechanical find-and-replace task. Deploy parallel agents per directory:**
- `backend/routes/` (~10 files)
- `backend/services/` (~20 files)
- `backend/services/intelligence/` (~5 files)
- `backend/services/agents/` (~5 files)
- `backend/middleware/` (~5 files)
- `backend/utils/` (~5 files)

### 3.3 Client-Side Caching

**Problem:** Every page navigation re-fetches all data from API.

**Approach:** Add a simple TTL cache to the API service.

**Create:** `frontend/src/services/apiCache.js`

**Features:**
- Cache GET responses by URL + params
- Configurable TTL per endpoint (default 30s)
- Auto-invalidate on mutations (POST/PUT/DELETE to same resource)
- `cache.invalidate('/api/tasks')` for manual invalidation

**Alternative:** Install `swr` or `@tanstack/react-query` if more robust caching is needed.

---

## Sprint 4 — Polish

### 4.1 Form Validation Error Messages

**Problem:** Forms accept empty/invalid input and only show "failed" after server rejects.

**Pages to update:**
1. `Tasks.jsx` — title required, due date format
2. `Projects.jsx` — name required
3. `Goals.jsx` — title required, target value numeric
4. `Automations.jsx` — name required, trigger config validation
5. `Calendar.jsx` — sync validation

**Pattern:**
```javascript
const [errors, setErrors] = useState({})

const validate = () => {
  const errs = {}
  if (!form.title.trim()) errs.title = 'Title is required'
  if (form.dueDate && isNaN(Date.parse(form.dueDate))) errs.dueDate = 'Invalid date'
  setErrors(errs)
  return Object.keys(errs).length === 0
}
```

**Display errors inline below each field:**
```jsx
{errors.title && <span className="vc-text-error" style={{ fontSize: 12 }}>{errors.title}</span>}
```

### 4.2 Accessibility Pass

**Issues found:**
- 15+ buttons/inputs missing `aria-label`
- Images missing `alt` text
- Heading hierarchy jumps (h1 → h3 skipping h2)

**Fix approach:**
- Add `aria-label` to all icon-only buttons
- Add `alt` text to all `<img>` tags
- Fix heading hierarchy on Analytics.jsx and other pages
- Ensure all form inputs have associated labels

### 4.3 Analytics Empty State

**Problem:** Analytics page shows blank content when no data exists.

**Fix:** Add CTA card when analytics data is empty:
- "No analytics data yet"
- "Record your first meeting to start seeing insights"
- Button to navigate to Meetings page

---

## Sprint 5 — Testing & Quality

### 5.1 Test Infrastructure Setup

**Install:**
```bash
cd backend && npm install --save-dev jest @types/jest
cd ../frontend && npm install --save-dev vitest @testing-library/react @testing-library/jest-dom
```

**Create:**
- `backend/jest.config.js`
- `frontend/vitest.config.js`
- `backend/__tests__/` directory
- `frontend/src/__tests__/` directory

### 5.2 Priority Test Targets (Backend)

Start with the most critical services:
1. `backend/services/hubClient.js` — Hub connection logic
2. `backend/services/hubEventPublisher.js` — Event publishing
3. `backend/services/logosVisionService.js` — Contact lookup, upsert
4. `backend/services/secretsVault.js` — Encryption, access control
5. `backend/middleware/auth.js` — Token validation
6. `backend/middleware/validate.js` — Input validation (after Sprint 1)

**Target:** 50% coverage on critical paths.

### 5.3 Priority Test Targets (Frontend)

1. `ToastProvider.jsx` — Toast creation, auto-dismiss, stacking
2. `ConfirmDialog.jsx` — Promise resolution, escape key
3. `Logo.jsx` — Both variants render correctly
4. `useAuthToken.js` — Token retrieval logic

### 5.4 Pre-Commit Hook

**Install:**
```bash
npm install --save-dev husky lint-staged
npx husky init
```

**Configure `.husky/pre-commit`:**
```bash
npx lint-staged
```

**Configure `package.json`:**
```json
"lint-staged": {
  "frontend/src/**/*.{js,jsx}": ["eslint --fix"],
  "backend/**/*.js": ["eslint --fix"]
}
```

### 5.5 Refactor Large Service Files

Files over 1000 lines that should be split:
- `WorkflowTemplates.js` (1,748 lines) → Split by template category
- `agentTemplates.js` (1,545 lines) → Split by agent type
- `NodeRegistry.js` (1,030 lines) → Split by node category
- `CRMNodes.js` (1,018 lines) → Split by CRM provider
- `ExplainabilityService.js` (1,012 lines) → Split by feature

---

## Execution Prompt

The following prompt can be used with Claude Code's `/team-plan` command to execute any sprint:

---

### Sprint Execution Prompt

```
/team-plan

# Production Readiness — Sprint [N] Execution

Execute Sprint [N] from the Production Readiness Plan at:
docs/PRODUCTION_READINESS_PLAN.md

## Rules
1. Read the plan document FIRST before doing anything
2. Follow the exact approach specified for each task
3. Create reusable components/middleware — don't duplicate code
4. Preserve all existing functionality
5. Use VC design system tokens for any UI work
6. Run `npm run build` in frontend/ after UI changes
7. Run `node -e "require('./services/[changed-service]')"` after backend changes
8. Report progress after each task with file links

## Sprint [N] Tasks
[Paste the specific sprint section here]

## Design System Reference
- Toast: `useToast()` from `components/vc/ToastProvider`
- Confirm: `useConfirm()` from `components/vc/ConfirmDialog`
- Buttons: `<VCButton variant="primary|secondary|ghost|danger|mint|amber" />`
- Badges: `<VCBadge color="crimson|mint|amber|phosphor|neutral" />`
- Cards: `<div className="vc">` or `<VCCard>`
- Colors: var(--c), var(--m), var(--a), var(--p), var(--t0-t2), var(--bg0-bg3)
- Error icon: AlertTriangle with className="vc-text-warning"
- Success icon: CheckCircle2 with className="vc-text-success"

## Validation
After completing all tasks:
1. Frontend builds clean: `cd frontend && npx vite build`
2. Backend services load: `cd backend && node -e "require('./server')"`
3. Zero new hardcoded colors
4. Zero new alert()/confirm() calls
5. All new components use VC design system
```

---

### Quick Execution Commands

```bash
# Sprint 1 — Security
/team-plan [paste Sprint 1 section]

# Sprint 2 — Stability
/team-plan [paste Sprint 2 section]

# Sprint 3 — Performance
/team-plan [paste Sprint 3 section]

# Sprint 4 — Polish
/team-plan [paste Sprint 4 section]

# Sprint 5 — Testing
/team-plan [paste Sprint 5 section]
```

---

## Completion Criteria

| Sprint | Done When |
|--------|-----------|
| Sprint 1 | All keys rotated, .env removed from history, zod validation on all routes, CSP enabled, session hardened |
| Sprint 2 | Error boundary wraps app, all 11 pages have error+retry UI, 404 page exists, env validation on startup |
| Sprint 3 | Bundle < 500KB initial, 0 console.log in backend, API caching layer active |
| Sprint 4 | Form errors shown inline, 0 missing aria-labels, Analytics has empty CTA |
| Sprint 5 | 50%+ backend test coverage, pre-commit hook active, no files over 1000 lines |

---

_This document is the execution plan for bringing Entomate to production readiness._
_The audit findings are the source of truth for what needs fixing._
_Update this document as sprints complete._
