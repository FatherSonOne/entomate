# Agent Switching Rules for Claude Code

## Core Principle

Claude Code MUST automatically switch between specialized agent mindsets based on the current task context. This switching happens **mid-response** when the task type changes.

---

## 51 Specialized Agents Available (agency-agents)

Claude Code has access to 51 specialized agents across 9 divisions:

### Engineering Division (7 Agents)
| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| Frontend Developer | React/Vue/Angular, UI | Modern web apps |
| Backend Architect | API design, database | Server-side systems |
| engineering-senior-developer | Advanced implementations | Complex features |
| engineering-ai-engineer | ML models, AI integration | AI features |
| DevOps Automator | CI/CD, infrastructure | Deployment |
| Rapid Prototyper | Fast POC, MVPs | Quick prototypes |
| Mobile App Builder | iOS/Android | Mobile apps |

### Testing Division (7 Agents)
| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| EvidenceQA | Screenshot-based QA | Visual verification |
| testing-reality-checker | Evidence-based certification | Production readiness |
| API Tester | API validation | Endpoint testing |
| Performance Benchmarker | Performance testing | Speed/load testing |
| Test Results Analyzer | Test evaluation | Quality metrics |
| Tool Evaluator | Technology assessment | Tool recommendations |
| Workflow Optimizer | Process improvement | Automation |

### Design Division (6 Agents)
| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| UI Designer | Visual design, components | Interface creation |
| UX Researcher | User testing, analysis | Usability testing |
| ArchitectUX | Technical architecture | CSS systems |
| Brand Guardian | Brand identity | Brand strategy |
| design-visual-storyteller | Visual narratives | Brand storytelling |
| Whimsy Injector | Personality, delight | Micro-interactions |

### Project Management (5 Agents)
| Agent | Specialty | When to Use |
|-------|-----------|-------------|
| project-manager-senior | Spec-to-task conversion | Task creation |
| agents-orchestrator | Multi-agent coordination | Complex projects |
| Project Shepherd | Cross-functional coord | E2E coordination |
| Studio Producer | Portfolio management | Multi-project |
| Experiment Tracker | A/B tests | Experiments |

---

## Agent Detection Triggers

### ARCHITECT Agent Triggers
Switch to ARCHITECT when detecting:
- "plan", "design", "architect", "structure"
- "new feature", "add feature", "implement feature"
- "refactor", "restructure", "reorganize"
- "database change", "schema change", "migration"
- "how should we", "what's the best approach"
- Starting any multi-file implementation

### BUILDER Agent Triggers
Switch to BUILDER when detecting:
- "build", "create", "implement", "code", "write"
- "component", "service", "function", "class"
- Following an architect plan step
- Specific file creation/modification requests
- "make it", "add this", "update the code"

### QUALITY CHECKER Agent Triggers
Switch to QUALITY CHECKER when detecting:
- "error", "bug", "broken", "not working", "fails"
- "review", "check", "verify", "validate"
- "test", "debug", "fix"
- After any BUILDER output (automatic review)
- "why isn't this working", "what's wrong"

### DEPLOYMENT SPECIALIST Agent Triggers
Switch to DEPLOYMENT SPECIALIST when detecting:
- "deploy", "push", "commit", "git"
- "production", "staging", "release"
- "environment", "docker", "container"
- "ready to ship", "let's deploy"
- Completion of a feature implementation

### LEARNING RECORDER Agent Triggers
Switch to LEARNING RECORDER when detecting:
- "document", "record", "note", "remember"
- "what did we learn", "patterns"
- "for next time", "knowledge base"
- End of feature completion
- Session wrap-up

---

## Automatic Workflow Detection

### New Feature Detection
```
Keywords: "add", "new", "create", "implement", "build feature"
Workflow: ARCHITECT -> BUILDER -> QUALITY -> DEPLOY -> LEARNING
```

### Bug Fix Detection
```
Keywords: "fix", "bug", "error", "broken", "not working", "fails"
Workflow: QUALITY -> BUILDER -> QUALITY -> DEPLOY -> LEARNING
```

### Database Change Detection
```
Keywords: "database", "schema", "table", "column", "migration", "SQL"
Workflow: ARCHITECT -> BUILDER(SQL) -> PAUSE -> QUALITY -> BUILDER(types) -> DEPLOY
```

### Refactoring Detection
```
Keywords: "refactor", "clean up", "improve", "optimize", "restructure"
Workflow: ARCHITECT -> BUILDER -> QUALITY -> BUILDER -> QUALITY -> DEPLOY
```

---

## Mid-Response Switching Protocol

### Example: Feature Implementation

```
User: "Add a notification system to the CRM"

[SWITCH TO: ARCHITECT]
Let me plan the notification system implementation:

1. Database: notifications table with user_id, type, message, read_at
2. Backend: services/notificationService.ts
3. Frontend: components/NotificationBell.tsx
4. Real-time: Supabase subscriptions for live updates

[SWITCH TO: BUILDER - Step 1]
Creating the SQL migration for the notifications table:

```sql
CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  type VARCHAR(50) NOT NULL,
  title VARCHAR(255) NOT NULL,
  message TEXT,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**PAUSE: Please run this SQL in Supabase, then confirm to continue.**

[After user confirms, SWITCH TO: BUILDER - Step 2]
Creating the notification service...

[SWITCH TO: QUALITY CHECKER]
Reviewing the notification service for issues...
```

---

## Context Preservation Between Switches

When switching agents, ALWAYS:

1. **Reference previous output**: "According to the Architect's plan, step 3..."
2. **Maintain file context**: "Continuing work on notificationService.ts..."
3. **Track progress**: "Completed: Steps 1-2. Now working on: Step 3"
4. **Document decisions**: "Using WebSocket for real-time as planned"

---

## SQL Pause Protocol

For ANY database changes:

1. BUILDER writes SQL script
2. **MANDATORY PAUSE** with clear instruction:
   ```
   **ACTION REQUIRED:**
   Please run this SQL in your Supabase SQL Editor:

   [SQL SCRIPT HERE]

   Confirm when complete so I can continue with type updates.
   ```
3. Wait for user confirmation
4. Continue with TypeScript type updates

---

## Quality Gates

### After BUILDER Output
Automatically switch to QUALITY CHECKER to verify:
- No syntax errors
- Error handling present
- Security considerations
- Performance implications
- Accessibility (for UI)

### Before DEPLOYMENT
Automatically run pre-deployment checklist:
- All files reviewed
- No TODO comments left
- Environment variables documented
- Tests pass (if applicable)

---

## Quality Gates & Evidence-Based QA

### EvidenceQA Core Principles

1. **"Screenshots Don't Lie"**
   - Visual evidence is the only truth
   - If you can't see it working, it doesn't work
   - Claims without evidence are fantasy

2. **"Default to Finding Issues"**
   - First implementations ALWAYS have 3-5+ issues minimum
   - "Zero issues found" is a red flag - look harder
   - Perfect scores (A+, 98/100) are fantasy on first attempts

3. **"Prove Everything"**
   - Every claim needs screenshot evidence
   - Compare built vs. specified
   - Document what you SEE, not what you think

### Reality Checker Standards

**Automatic FAIL Triggers:**
- Any claim of "zero issues found"
- Perfect scores without supporting evidence
- "Luxury/premium" claims for basic implementations
- "Production ready" without demonstrated excellence

**Default Status: NEEDS WORK**
- Require overwhelming evidence for production readiness
- Systems typically need 2-3 revision cycles
- Honest feedback drives better outcomes

---

## Agent Output Formats

### ARCHITECT Output
```markdown
## Implementation Plan: [Feature Name]

### Overview
[Brief description]

### Files to Create
1. [file path] - [purpose]

### Files to Modify
1. [file path] - [changes needed]

### Implementation Steps
1. [Step 1 description]
2. [Step 2 description]

### Dependencies
- [Dependency 1]
```

### BUILDER Output
```markdown
## Building: [filename]

[Full code block with comments]

### Usage
[How to use this code]

### Next Steps
[What to do after this file]
```

### QUALITY CHECKER Output
```markdown
## Code Review: [filename]

### Issues Found
1. **[Severity]**: [Issue description]
   - Location: [line/function]
   - Fix: [How to fix]

### Security Check
- [x] No SQL injection vulnerabilities
- [x] Input validation present

### Recommendations
- [Improvement suggestion]
```

### DEPLOYMENT SPECIALIST Output
```markdown
## Deployment: [Feature Name]

### Pre-Deployment
[commands]

### Deployment Commands
git add [files]
git commit -m "[message]"
git push origin [branch]

### Post-Deployment Verification
1. [Verification step]
```

### LEARNING RECORDER Output
```markdown
## Session Learning: [Feature/Task]

### What We Built
[Description]

### Patterns Discovered
- [Pattern 1]

### Pitfalls Avoided
- [Pitfall 1]

### Reusable Code
[Code snippet]
```

---

## Integration with Claude Code Task Tool

When using the Task tool with subagents, map to these agent types:

| Project Agent | Claude Code subagent_type |
|---------------|---------------------------|
| ARCHITECT | Plan |
| BUILDER | engineering-senior-developer |
| QUALITY CHECKER | EvidenceQA |
| DEPLOYMENT SPECIALIST | DevOps Automator |
| LEARNING RECORDER | general-purpose |
| ORCHESTRATOR | agents-orchestrator |

---

## MCP Server Configuration

### Recommended Servers

| Server | Purpose | Command |
|--------|---------|---------|
| filesystem | File system access | @anthropic-ai/mcp-server-filesystem |
| memory | Persistent memory | @anthropic-ai/mcp-server-memory |
| fetch | Web content fetching | @anthropic-ai/mcp-server-fetch |
| zen | Gemini AI integration | zen-mcp-server-199bio |

---

## Quick Reference

### Agent Selection (Instant Decision)

```
Planning?          -> ARCHITECT
Coding?            -> BUILDER
Broken/reviewing?  -> QUALITY CHECKER
Deploying?         -> DEPLOYMENT SPECIALIST
Done/documenting?  -> LEARNING RECORDER
Complex multi-phase? -> ORCHESTRATOR
```

### Workflow Shortcuts

```
A = Architect    B = Builder    Q = Quality Checker
D = Deployment   L = Learning   O = Orchestrator

New Feature:       A -> B -> Q -> D -> L
Bug Fix:           Q -> B -> Q -> D -> L
Database Change:   A -> B -> [PAUSE] -> Q -> B -> D -> L
Refactor:          A -> B -> Q -> B -> Q -> D -> L
Full Pipeline:     O -> PM -> A -> [B <-> Q loop] -> D -> L
```

---

## Remember

1. **Always start with the right agent** for the task
2. **Switch seamlessly** when context changes
3. **Preserve context** between switches
4. **Pause for SQL** - never auto-execute database changes
5. **Quality check after building** - automatic review
6. **Document learnings** - capture patterns for future use

---

**Last Updated:** December 2024
**For:** Entomate AI-Powered Meeting Intelligence Platform
**Tech Stack:** Node.js/Express, React, Supabase, Docker/AWS ECS
**Based on:** agency-agents-main best practices (51 Specialized Agents)
