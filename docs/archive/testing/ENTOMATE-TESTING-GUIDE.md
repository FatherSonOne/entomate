# Entomate Application Testing Guide

**For Claude (Chrome Extension) - Complete Testing Protocol**

---

## CRITICAL: Project Structure Confusion

This project has **fragmented codebases** that have caused confusion:

### The REAL Application Structure

| Location | Purpose | Status |
|----------|---------|--------|
| `F:\entomate\frontend\` | **PRIMARY FRONTEND** - React app with routing, pages, full UI | ACTIVE - Use this |
| `F:\entomate\backend\` | **PRIMARY BACKEND** - Express server, API routes, services | ACTIVE - Use this |
| `F:\entomate\index.tsx` | Outdated monolithic file (67KB single file) | DEPRECATED - Ignore |
| `F:\entomate\src\` | TypeScript components, some used by index.tsx | MIXED - Some used by frontend |

### Recommended Single Entry Points

**Frontend:** `F:\entomate\frontend\`
- Entry: `src/main.jsx` -> `src/App.jsx`
- Start: `cd frontend && npm run dev` (runs on port 5173)

**Backend:** `F:\entomate\backend\`
- Entry: `server.js`
- Start: `cd backend && npm run dev` (runs on port 3000)

---

## CRITICAL FIX: Wrong Backend Running

**KNOWN ISSUE:** Port 3000 may be running a different application (e.g., "Pulse AI Companion") instead of the Entomate backend.

### How to Detect This Problem

1. Visit `http://localhost:3000/api/health`
2. If you see **HTML** instead of **JSON**, the wrong app is running
3. Correct response: `{"status":"ok","services":{...}}`
4. Wrong response: HTML page (different app)

### How to Fix

**Option 1: Use the startup scripts**
```cmd
# Kill wrong process and start correct backend
F:\entomate\scripts\start-backend.bat

# In another terminal
F:\entomate\scripts\start-frontend.bat
```

**Option 2: Manual fix**
```cmd
# Step 1: Find and kill process on port 3000
netstat -ano | findstr :3000
# Note the PID (last column)
taskkill /PID <PID> /F

# Step 2: Start the CORRECT backend
cd F:\entomate\backend
npm run dev

# Step 3: Verify it's correct
curl http://localhost:3000/api/health
# Should return JSON, not HTML
```

---

## Pre-Test Setup

### 1. Database Setup (CRITICAL - Run First!)

The application requires Supabase database tables. If you get errors like `Could not find the table 'public.meetings'`, you need to run the schema setup.

**Steps:**
1. Go to your Supabase Dashboard: https://supabase.com/dashboard
2. Open SQL Editor
3. Copy the contents of `F:\entomate\database\FULL-SCHEMA-SETUP.sql`
4. Run the SQL script

**Verify tables exist:**
```sql
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
ORDER BY table_name;
```

Expected tables: `meetings`, `projects`, `automations`, `workflows`, `action_items`, `tasks`, etc.

### 2. Environment Check

```bash
# Check if .env files exist
ls F:/entomate/.env*
ls F:/entomate/frontend/.env*
ls F:/entomate/backend/.env*

# Required environment variables (backend/.env):
# - SUPABASE_URL
# - SUPABASE_ANON_KEY
# - SUPABASE_SERVICE_KEY
# - OPENAI_API_KEY or GEMINI_API_KEY
```

### 3. Start Services (IMPORTANT: Use correct directories!)

```bash
# Terminal 1 - Backend (MUST be from F:\entomate\backend)
cd F:\entomate\backend
npm install
npm run dev
# Verify: curl http://localhost:3000/api/health returns JSON

# Terminal 2 - Frontend (from F:\entomate\frontend)
cd F:\entomate\frontend
npm install
npm run dev
```

### 4. Verify Services Running CORRECTLY

- Frontend: http://localhost:5173 (should show Entomate app)
- Backend API: http://localhost:3000/api/health (should return JSON, NOT HTML)

**CRITICAL CHECK:**
```bash
curl http://localhost:3000/api/health
```
- GOOD: `{"status":"ok",...}` (JSON response)
- BAD: `<!DOCTYPE html>...` (Wrong app running!)

---

## Testing Checklist

### Phase 1: Backend API Tests

#### Health & Core Endpoints

| Endpoint | Method | Expected | Test Command |
|----------|--------|----------|--------------|
| `/api/health` | GET | `{"status":"ok"}` | `curl http://localhost:3000/api/health` |
| `/api/meetings` | GET | 200 + meetings array | `curl http://localhost:3000/api/meetings` |
| `/api/projects` | GET | 200 + projects array | `curl http://localhost:3000/api/projects` |
| `/api/workflows` | GET | 200 + workflows array | `curl http://localhost:3000/api/workflows` |
| `/api/templates` | GET | 200 + templates array | `curl http://localhost:3000/api/templates` |
| `/api/templates/categories` | GET | 200 + categories | `curl http://localhost:3000/api/templates/categories` |

#### Authentication (if implemented)

| Endpoint | Method | Expected |
|----------|--------|----------|
| `/api/auth/login` | POST | 200 + token |
| `/api/auth/register` | POST | 201 + user |
| `/api/auth/me` | GET | 200 + user (requires token) |

#### CRM/Workflows (New Features)

| Endpoint | Method | Expected |
|----------|--------|----------|
| `/api/templates` | GET | All templates (incl. CRM) |
| `/api/templates?category=crm` | GET | CRM templates only |
| `/api/templates/categories` | GET | Categories (incl. CRM) |
| `/api/workflows` | GET | List workflows |
| `/api/workflows` | POST | Create workflow |
| `/api/workflows/:id/execute` | POST | Execute workflow |

**Test CRM Templates Exist:**
```bash
curl http://localhost:3000/api/templates?category=crm
```

Expected templates in response:
- `template-deal-stage-handler` - Deal Stage Change Handler
- `template-stale-deal-alert` - Stale Deal Alert
- `template-lead-scoring-routing` - Lead Scoring & Routing
- `template-meeting-crm-sync` - Meeting to CRM Sync
- `template-task-overdue-escalation` - Task Overdue Escalation

### Phase 2: Frontend UI Tests

#### Navigation

- [ ] App loads at http://localhost:5173
- [ ] Sidebar navigation works
- [ ] All menu items clickable
- [ ] Active state shows correctly

#### Pages to Test

| Page | Route | Key Elements |
|------|-------|--------------|
| Dashboard | `/` or `/dashboard` | Stats cards, recent activity |
| Meetings | `/meetings` | Meeting list, create button |
| Projects | `/projects` | Project cards, filters |
| Automations | `/automations` | Workflow list, template gallery |
| Settings | `/settings` | User preferences, API keys |

#### Automations/Workflows Page (Critical)

1. **Template Gallery**
   - [ ] Categories display (including "CRM")
   - [ ] Templates load with icons
   - [ ] Click template shows preview
   - [ ] "Use Template" button works

2. **Workflow Builder**
   - [ ] Canvas renders
   - [ ] Nodes can be added
   - [ ] Connections can be made
   - [ ] Save workflow works

3. **CRM Templates** (New)
   - [ ] "Deal Stage Change Handler" template visible
   - [ ] "Stale Deal Alert" template visible
   - [ ] "Lead Scoring & Routing" template visible
   - [ ] "Meeting to CRM Sync" template visible
   - [ ] "Task Overdue Escalation" template visible

### Phase 3: Integration Tests

#### Meeting -> CRM Flow

1. Create a meeting
2. Process meeting (AI summary)
3. Check if CRM contact lookup triggers
4. Verify activity logged in CRM

#### Automation Execution

1. Create workflow from template
2. Trigger workflow manually
3. Check execution logs
4. Verify Slack/email notifications (if configured)

---

## Console Error Checklist

Open browser DevTools (F12) and check for:

| Error Type | Location | Action |
|------------|----------|--------|
| `get_health_distribution` RPC error | Dashboard | Fixed - returns empty data |
| Permission denied | Settings | Fixed - returns true |
| `query_audit_logs` error | Settings | Fixed - returns empty |
| 404 on API calls | Any page | Check backend running |
| CORS errors | Any page | Check backend CORS config |

---

## Files to Verify Exist

### Backend (Critical Files)

```
F:\entomate\backend\
├── server.js                    # Main entry point
├── routes/
│   ├── meetings.js
│   ├── projects.js
│   ├── workflows.js
│   ├── templates.js             # Template browsing API
│   └── auth.js
├── services/
│   ├── workflow/
│   │   ├── WorkflowExecutor.js
│   │   ├── NodeRegistry.js      # Node type registry
│   │   ├── WorkflowTemplates.js # Template definitions
│   │   └── nodes/
│   │       ├── BaseNode.js
│   │       ├── TriggerNodes.js
│   │       ├── ActionNodes.js
│   │       ├── LogicNodes.js
│   │       ├── AINodes.js
│   │       ├── RAGNodes.js
│   │       └── CRMNodes.js      # NEW: Logos Vision CRM nodes
│   └── crmService.js
└── middleware/
    ├── auth.js
    └── rateLimiter.js
```

### Frontend (Critical Files)

```
F:\entomate\frontend\
├── src/
│   ├── main.jsx                 # Entry point
│   ├── App.jsx                  # Router & layout
│   ├── pages/
│   │   ├── Dashboard.jsx
│   │   ├── Meetings.jsx
│   │   ├── Projects.jsx
│   │   ├── Automations.jsx      # Workflow builder
│   │   └── Settings.jsx
│   ├── components/
│   │   └── workflow/            # Workflow builder components
│   └── services/
│       └── api.js               # API client
└── vite.config.js
```

---

## Common Issues & Fixes

### Issue: "Cannot find module './nodes/CRMNodes'"

**Fix:** Verify file exists at `backend/services/workflow/nodes/CRMNodes.js`

### Issue: Frontend shows blank page

**Fix:**
1. Check console for errors
2. Verify `npm install` completed
3. Check if backend is running (API calls failing)

### Issue: API returns 401 Unauthorized

**Fix:**
1. Check if auth middleware is correctly configured
2. Verify JWT token in localStorage
3. Check `optionalAuth` vs `authenticate` middleware usage

### Issue: Workflows don't execute

**Fix:**
1. Check `WorkflowExecutor.js` for errors
2. Verify node handlers are registered in `NodeRegistry.js`
3. Check Supabase connection for data persistence

---

## Test Results Template

Copy and fill out:

```markdown
## Entomate Test Results - [DATE]

### Environment
- Node version:
- npm version:
- Browser:
- Backend running: Yes/No
- Frontend running: Yes/No

### Backend API
- [ ] /api/health - PASS/FAIL
- [ ] /api/meetings - PASS/FAIL
- [ ] /api/projects - PASS/FAIL
- [ ] /api/workflows - PASS/FAIL
- [ ] /api/templates - PASS/FAIL
- [ ] /api/templates/categories - PASS/FAIL (includes CRM)

### Frontend Pages
- [ ] Dashboard loads - PASS/FAIL
- [ ] Meetings page - PASS/FAIL
- [ ] Projects page - PASS/FAIL
- [ ] Automations page - PASS/FAIL
- [ ] Settings page - PASS/FAIL

### CRM Workflow Features
- [ ] CRM templates visible - PASS/FAIL
- [ ] CRM nodes in registry - PASS/FAIL
- [ ] Lead scoring works - PASS/FAIL

### Console Errors
- List any errors found:

### Notes
-
```

---

## Recommended Testing Order

1. **Start backend** -> verify `/api/health`
2. **Start frontend** -> verify page loads
3. **Check console** -> fix any errors
4. **Test navigation** -> all pages accessible
5. **Test Automations** -> templates and workflows
6. **Test CRM features** -> new Logos Vision integration
7. **Document results** -> use template above

---

## Contact/Escalation

If tests fail, document:
1. Exact error message
2. File and line number (if available)
3. Steps to reproduce
4. Expected vs actual behavior

Then report back for fixes.
