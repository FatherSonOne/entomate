# Entomate Phase 2 - Support Runbook

## Overview
This document provides step-by-step guidance for handling production issues in Phase 2 features:
- Agents Framework
- Search/RAG (Ask Assistant)
- Knowledge Graph
- Predictive Analytics

---

## Emergency Contacts
| Role | Contact |
|------|---------|
| On-Call Engineer | [TBD] |
| Product Owner | [TBD] |
| DevOps | [TBD] |

---

## Quick Health Check

Run health check in browser console or via API:
```typescript
import { runAllHealthChecks, formatHealthResults } from './src/utils/healthCheck';

const health = await runAllHealthChecks();
console.log(formatHealthResults(health));
```

Expected output:
```
System Health: HEALTHY
Timestamp: 2025-01-15T12:00:00.000Z
---
✓ database: healthy (50ms)
✓ knowledge_graph: healthy (30ms)
✓ predictions: healthy (25ms)
✓ agents: healthy (40ms)
✓ project_tasks: healthy (35ms)
```

---

## Issue: Agents Causing Spam

### Symptoms
- Multiple Pulse messages appearing rapidly
- Duplicate CRM tasks being created
- `agent_runs` table showing many recent entries

### Immediate Actions

**1. Disable All Agents (Kill Switch)**
```sql
-- In Supabase SQL Editor
UPDATE agents SET enabled = false WHERE enabled = true;
```

**2. Check Recent Agent Runs**
```sql
SELECT
  a.name as agent_name,
  ar.status,
  ar.error,
  ar.started_at,
  ar.finished_at
FROM agent_runs ar
JOIN agents a ON ar.agent_id = a.id
WHERE ar.started_at > NOW() - INTERVAL '1 hour'
ORDER BY ar.started_at DESC
LIMIT 50;
```

**3. Identify Problematic Agent**
```sql
SELECT
  a.name,
  COUNT(*) as run_count,
  COUNT(CASE WHEN ar.status = 'failed' THEN 1 END) as failures
FROM agent_runs ar
JOIN agents a ON ar.agent_id = a.id
WHERE ar.started_at > NOW() - INTERVAL '1 hour'
GROUP BY a.name
ORDER BY run_count DESC;
```

### Recovery Steps
1. Identify and fix the root cause (trigger conditions, guardrails)
2. Re-enable agents one at a time
3. Monitor for 30 minutes before enabling next agent

---

## Issue: Agents Failing Silently

### Symptoms
- Expected actions not happening
- No visible errors in UI
- `agent_runs` showing status='failed'

### Diagnostic Steps

**1. Check Agent Run Errors**
```sql
SELECT
  ar.id,
  a.name,
  ar.status,
  ar.error,
  ar.input,
  ar.output
FROM agent_runs ar
JOIN agents a ON ar.agent_id = a.id
WHERE ar.status = 'failed'
AND ar.started_at > NOW() - INTERVAL '24 hours'
ORDER BY ar.started_at DESC;
```

**2. Check Agent Step Failures**
```sql
SELECT
  ars.step_type,
  ars.status,
  ars.error,
  ars.input
FROM agent_run_steps ars
JOIN agent_runs ar ON ars.agent_run_id = ar.id
WHERE ar.status = 'failed'
AND ar.started_at > NOW() - INTERVAL '24 hours';
```

### Common Failure Causes

| Error Message | Cause | Fix |
|---------------|-------|-----|
| "Guardrail exceeded" | Too many actions attempted | Review agent logic, increase limits if safe |
| "Rate limit" (429) | API throttling | Implement backoff, reduce frequency |
| "Auth failed" (401/403) | Invalid credentials | Check API keys in env vars |
| "Not found" (404) | Missing entity | Verify trigger data exists |

---

## Issue: CRM/Pulse API Down

### Symptoms
- Agent runs failing with network errors
- 503/504 errors in logs
- "Connection refused" messages

### Immediate Actions

**1. Verify External Service Status**
- Check Logos Vision status page
- Check Pulse status page

**2. Disable Affected Agents**
```sql
-- Disable agents that use CRM
UPDATE agents
SET enabled = false
WHERE actions::text LIKE '%sync_to_crm%';

-- Disable agents that use Pulse
UPDATE agents
SET enabled = false
WHERE actions::text LIKE '%post_to_pulse%';
```

**3. Wait and Retry**
- Services usually recover within 15-30 minutes
- Re-enable agents gradually after recovery

---

## Issue: Search/RAG Hallucinations

### Symptoms
- Answers don't match cited sources
- Citations point to non-existent data
- Confident-sounding but wrong answers

### Diagnostic Steps

**1. Check Citation Validity**
For a given search response, verify each citation:
```sql
-- For meeting citations
SELECT id, title, transcript FROM entomate_meetings
WHERE id = '[cited_meeting_id]';

-- For task citations
SELECT id, title, description FROM entomate_project_tasks
WHERE id = '[cited_task_id]';
```

**2. Check Retrieval Quality**
Review what chunks were retrieved vs. what was cited.

### Recovery Steps
1. If citations are invalid, check embedding pipeline
2. If answers don't match sources, review RAG prompt
3. Enable stricter citation validation

---

## Issue: Predictions Not Updating

### Symptoms
- Same prediction shown repeatedly
- Predictions table not growing
- Stale model_version

### Diagnostic Steps

**1. Check Recent Predictions**
```sql
SELECT
  prediction_type,
  entity_type,
  entity_id,
  model_version,
  created_at
FROM predictions
ORDER BY created_at DESC
LIMIT 20;
```

**2. Check Prediction Errors**
Look for console errors containing `[DealProbability]` or `[TaskEta]`.

**3. Verify Data Exists**
```sql
-- For deal predictions
SELECT COUNT(*) FROM relationships
WHERE source_type = 'deal' OR target_type = 'deal';

-- For task predictions
SELECT COUNT(*) FROM entomate_project_tasks
WHERE status IN ('todo', 'in_progress');
```

---

## Issue: Database Performance Degraded

### Symptoms
- Slow page loads
- Health check showing >1000ms latency
- Queries timing out

### Diagnostic Steps

**1. Check Slow Queries (via Supabase)**
Use Supabase dashboard > Database > Query Performance

**2. Check Table Sizes**
```sql
SELECT
  relname as table,
  n_live_tup as row_count
FROM pg_stat_user_tables
ORDER BY n_live_tup DESC;
```

**3. Check Index Usage**
```sql
SELECT
  indexrelname as index,
  idx_scan as scans,
  idx_tup_read as rows_read
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
```

### Recovery Steps
1. Check if missing indexes (see migration files)
2. Consider adding pagination to large queries
3. Review and optimize slow queries

---

## Issue: Knowledge Graph Inconsistencies

### Symptoms
- Linked records not appearing
- Duplicate relationships
- Missing relationships

### Diagnostic Steps

**1. Check Relationship Counts**
```sql
SELECT
  source_type,
  target_type,
  relationship_type,
  COUNT(*) as count
FROM relationships
GROUP BY source_type, target_type, relationship_type
ORDER BY count DESC;
```

**2. Find Duplicates**
```sql
SELECT
  source_id,
  target_id,
  relationship_type,
  COUNT(*) as duplicates
FROM relationships
GROUP BY source_id, target_id, relationship_type
HAVING COUNT(*) > 1;
```

**3. Clean Duplicates**
```sql
-- Keep only the first relationship, delete duplicates
DELETE FROM relationships
WHERE id NOT IN (
  SELECT MIN(id)
  FROM relationships
  GROUP BY source_id, target_id, relationship_type
);
```

---

## Rollback Procedures

### Code Rollback
1. Identify last stable release tag
2. Deploy previous version
3. Verify health checks pass

### Database Rollback (Last Resort)
1. Stop application
2. Restore from backup/snapshot
3. Verify data integrity
4. Restart application

**WARNING**: Database rollback loses data created after snapshot.

---

## Monitoring Checklist (First 24 Hours Post-Release)

### Every Hour
- [ ] Check agent_runs for failures
- [ ] Verify Pulse message volume is normal
- [ ] Verify CRM task creation rate is normal

### Every 4 Hours
- [ ] Review error logs
- [ ] Check prediction storage
- [ ] Verify search is returning citations

### Daily
- [ ] Review agent success rate (target: >98%)
- [ ] Check retrieval latency (target: <500ms)
- [ ] Review user feedback/issues

---

## Escalation Matrix

| Severity | Response Time | Who to Contact |
|----------|---------------|----------------|
| P0 (System Down) | 15 minutes | On-call + Product Owner |
| P1 (Feature Broken) | 1 hour | On-call |
| P2 (Degraded) | 4 hours | Engineering Team |
| P3 (Minor Issue) | Next business day | Engineering Team |

---

## Useful Queries

### Agent Run Summary (Last 24h)
```sql
SELECT
  DATE_TRUNC('hour', started_at) as hour,
  status,
  COUNT(*) as count
FROM agent_runs
WHERE started_at > NOW() - INTERVAL '24 hours'
GROUP BY hour, status
ORDER BY hour DESC;
```

### Prediction Summary (Last 24h)
```sql
SELECT
  prediction_type,
  COUNT(*) as count,
  AVG((predicted_value->>'probability')::numeric) as avg_probability
FROM predictions
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY prediction_type;
```

### Relationship Growth
```sql
SELECT
  DATE(created_at) as date,
  COUNT(*) as new_relationships
FROM relationships
WHERE created_at > NOW() - INTERVAL '7 days'
GROUP BY date
ORDER BY date;
```
