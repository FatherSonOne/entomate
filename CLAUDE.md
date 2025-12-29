# Entomate Project Memory & Claude Code Instructions

**Project:** Entomate - AI-Powered Meeting Intelligence Platform
**Tech Stack:** Node.js/Express Backend, React Frontend, Supabase Database
**Last Updated:** 2024-12-21

---

## CRITICAL: Agent Switching Protocol

Claude Code MUST switch between specialized agents mid-response based on task context. Apply the appropriate agent mindset automatically:

### Agent Registry (Switch Based on Task Type)

| Task Type | Agent | When to Apply |
|-----------|-------|---------------|
| Planning new features | **ARCHITECT** | Starting any multi-file change |
| Writing code | **BUILDER** | Creating/modifying code files |
| Reviewing/debugging | **QUALITY CHECKER** | After code changes, on errors |
| Git/deploy operations | **DEPLOYMENT SPECIALIST** | Commits, pushes, deployments |
| Documentation | **LEARNING RECORDER** | After completing features |

### Auto-Switch Rules

```
IF task = "new feature" OR "add" OR "create" OR "implement":
  1. ARCHITECT: Plan the implementation
  2. BUILDER: Write each file
  3. QUALITY CHECKER: Review after each file
  4. DEPLOYMENT SPECIALIST: Git commands if ready
  5. LEARNING RECORDER: Document patterns

IF task = "bug" OR "fix" OR "error" OR "broken":
  1. QUALITY CHECKER: Diagnose the issue
  2. BUILDER: Implement the fix
  3. QUALITY CHECKER: Verify fix doesn't introduce issues
  4. DEPLOYMENT SPECIALIST: Deploy fix

IF task = "database" OR "schema" OR "SQL" OR "migration":
  1. ARCHITECT: Plan schema changes
  2. BUILDER: Write SQL migration
  3. QUALITY CHECKER: Review RLS policies
  4. BUILDER: Update TypeScript types
  5. BUILDER: Update services
  6. DEPLOYMENT SPECIALIST: Safe migration steps
```

---

## Orchestrated Workflows

### Workflow 1: New Feature Development

```
Step 1: ARCHITECT
  "I need to add [feature name] to Entomate"
  Output: Implementation plan with file list

Step 2: BUILDER (for each file in plan)
  "Build [component/service] according to step [X] of the plan"
  Output: Complete code for one file

Step 3: QUALITY CHECKER (after each file)
  "Review this code I just built"
  Output: Issues and fixes

Step 4: Repeat Steps 2-3 until all files done

Step 5: DEPLOYMENT SPECIALIST
  "I'm ready to deploy [feature name]"
  Output: Git commands and deployment steps

Step 6: LEARNING RECORDER
  "Document what we learned building [feature]"
  Output: Knowledge base entry
```

### Workflow 2: Bug Fix Cycle

```
Step 1: QUALITY CHECKER
  "I'm getting this error: [error message]"
  Output: Diagnosis and potential causes

Step 2: BUILDER
  "Fix the issue in [filename] related to [problem]"
  Output: Corrected code

Step 3: QUALITY CHECKER
  "Verify this fix doesn't create new issues"
  Output: Validation and edge cases

Step 4: DEPLOYMENT SPECIALIST
  "Deploy this bug fix"
  Output: Deployment commands

Step 5: LEARNING RECORDER
  "Record this bug and solution"
  Output: Documentation for future prevention
```

### Workflow 3: Database Schema Changes

```
Step 1: ARCHITECT
  "I need to modify the database for [reason]"
  Output: Schema change plan with migration strategy

Step 2: BUILDER
  "Write the SQL migration for [change]"
  Output: SQL script (pause for user to run)

Step 3: QUALITY CHECKER
  "Review this SQL for RLS policy impacts"
  Output: Security review

Step 4: BUILDER
  "Update TypeScript types to match new schema"
  Output: Updated types

Step 5: BUILDER
  "Update services to use new schema"
  Output: Modified service files

Step 6: DEPLOYMENT SPECIALIST
  "Deploy database changes safely"
  Output: Step-by-step migration procedure
```

---

## Agent Prompt Templates

### ARCHITECT Agent

```
Role: You are a Project Architect for the Entomate application.

Context:
- Project: Entomate (Node.js/Express + React + Supabase)
- Current state: [brief description]
- Goal: [what we want to build]

Task: Create a comprehensive technical plan including:
1. Database schema changes (if needed)
2. New files to create
3. Existing files to modify
4. Service layer changes
5. UI components needed
6. Step-by-step implementation order

Format: Provide numbered steps I can follow sequentially.
```

### BUILDER Agent

```
Role: You are a Code Builder specializing in Node.js/Express and React.

Context:
- File: [filename]
- Purpose: [what this code does]
- Dependencies: [what it needs to work with]

Requirements:
1. Follow Entomate tech stack patterns
2. Match existing code patterns
3. Include proper types/JSDoc
4. Add error handling
5. Write clean, maintainable code

Task: [specific implementation request]

Provide: Complete, ready-to-use code for [filename].
```

### QUALITY CHECKER Agent

```
Role: You are a Quality Checker reviewing code for issues.

Code to Review:
[code here]

Check for:
1. Syntax and logic errors
2. Missing error handling
3. Potential bugs
4. Performance issues
5. Security concerns (especially with Supabase RLS)
6. Accessibility issues in UI components

Provide: Specific issues found and how to fix them.
```

### DEPLOYMENT SPECIALIST Agent

```
Role: You are a Deployment Specialist for Docker/AWS deployments.

Context:
- Changes made: [list of modified files]
- Current branch: [branch name]
- Deploy target: [production/staging]

Task: Provide exact commands for:
1. Git staging and commit
2. Push to repository
3. Docker build verification
4. Environment variable checks
5. Post-deployment testing steps

Format: Step-by-step terminal commands I can execute in order.
```

### LEARNING RECORDER Agent

```
Role: You are a Learning Recorder documenting development insights.

What We Built: [description]
Challenges Faced: [problems encountered]
Solutions Found: [how we solved them]

Task: Create documentation including:
1. What we learned
2. Patterns to reuse
3. Pitfalls to avoid
4. Code snippets for future reference

Format: Add to project knowledge base.
```

---

## Project Structure

```
entomate/
├── backend/                 # Node.js/Express API server
│   ├── routes/             # API route handlers
│   ├── services/           # Business logic
│   │   ├── agents/         # AI agents (assignment, priority, deadline, followup)
│   │   ├── automationEngine.js
│   │   ├── automationScheduler.js
│   │   └── agentOrchestrator.js
│   ├── middleware/         # Express middleware
│   └── server.js           # Main server entry
├── frontend/               # React application
│   ├── src/
│   │   ├── components/     # Reusable components
│   │   ├── pages/          # Page components
│   │   └── services/       # API client
├── infrastructure/         # Terraform AWS config
├── tests/                  # Load and smoke tests
├── docs/                   # Documentation
└── .claude/                # Claude Code configuration
    ├── agents/             # Agent prompt templates
    └── workflows/          # Workflow definitions
```

---

## Key Patterns & Conventions

### API Route Pattern

```javascript
// backend/routes/[resource].js
const express = require('express');
const router = express.Router();
const { authenticateToken, rateLimit } = require('../middleware');

router.get('/', authenticateToken, rateLimit('standard'), async (req, res) => {
  try {
    // Implementation
    res.json({ success: true, data });
  } catch (error) {
    console.error('[Resource] Error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

module.exports = router;
```

### Service Pattern

```javascript
// backend/services/[service].js
class ServiceName {
  async methodName(params) {
    try {
      // Implementation with proper error handling
      return { success: true, data };
    } catch (error) {
      console.error('[ServiceName] methodName error:', error);
      throw error;
    }
  }
}

module.exports = new ServiceName();
```

### React Component Pattern

```jsx
// frontend/src/components/ComponentName.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function ComponentName({ prop1, prop2 }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const response = await api.resource.getAll();
      setData(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;

  return (
    <div className="component-name">
      {/* Component content */}
    </div>
  );
}
```

---

## SQL Migration Protocol

When database changes are needed:

1. **PAUSE** and provide SQL script in copy/paste format
2. User runs SQL in Supabase dashboard
3. Continue with TypeScript type updates
4. Update service layer
5. Update frontend if needed

### SQL Script Format

```sql
-- ========================================
-- Migration: [Description]
-- Date: [YYYY-MM-DD]
-- ========================================

-- Table changes
ALTER TABLE table_name ADD COLUMN column_name TYPE;

-- RLS Policies
CREATE POLICY "policy_name" ON table_name
  FOR SELECT USING (auth.uid() = user_id);

-- Indexes
CREATE INDEX idx_name ON table_name(column);
```

---

## Environment Configuration

### Required Environment Variables

```bash
# Server
NODE_ENV=production
PORT=3000

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI
OPENAI_API_KEY=sk-...
# or
GEMINI_API_KEY=...

# Integrations
CRM_API_KEY=...
SLACK_BOT_TOKEN=xoxb-...

# Security
JWT_SECRET=...
SESSION_SECRET=...

# Monitoring
SENTRY_DSN=...
```

---

## Testing Commands

```bash
# Run smoke tests
artillery run tests/smoke-test.yml

# Run load tests
artillery run tests/load-test.yml

# Run with environment
artillery run tests/smoke-test.yml -e staging
artillery run tests/smoke-test.yml -e production
```

---

## Deployment Checklist

1. **Pre-deployment:**
   - [ ] All tests passing
   - [ ] npm audit clean
   - [ ] Environment variables set
   - [ ] Database migrations run

2. **Deployment:**
   - [ ] Docker build successful
   - [ ] Container health checks pass
   - [ ] SSL/TLS configured

3. **Post-deployment:**
   - [ ] Smoke tests pass
   - [ ] Monitoring active
   - [ ] Logs accessible

---

## Quick Reference

### Agent Selection

```
Planning?          → ARCHITECT
Coding?            → BUILDER
Broken/reviewing?  → QUALITY CHECKER
Deploying?         → DEPLOYMENT SPECIALIST
Done/documenting?  → LEARNING RECORDER
```

### Workflow Shortcuts

```
New Feature:       A → B → Q → D → L
Bug Fix:           Q → B → Q → D → L
Database Change:   A → B → Q → B → D → L
Refactor:          A → B → Q → B → Q → D → L

A = Architect    B = Builder    Q = Quality Checker
D = Deployment   L = Learning Recorder
```

---

## Learned Patterns

### Week 7 Patterns
- Scheduled automation with node-cron
- 3-step wizard UI for automation builder
- Dry-run testing for automations
- Follow-up detection with pattern matching + AI
- Retry logic with exponential backoff

### Week 8 Patterns
- Rate limiting per endpoint type
- Helmet security headers
- Winston structured logging
- Sentry error tracking
- Docker multi-stage builds
- Artillery load testing
- Terraform AWS infrastructure

---

## Session Continuity

When resuming work:
1. Check this CLAUDE.md for context
2. Review recent git commits
3. Check docs/ for current week's tasks
4. Apply appropriate agent workflow
