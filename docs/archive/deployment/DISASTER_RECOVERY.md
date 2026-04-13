# Disaster Recovery Plan

## Entomate Disaster Recovery
**Version:** 1.0
**Last Updated:** Week 8

---

## Recovery Objectives

| Metric | Target | Description |
|--------|--------|-------------|
| **RTO** (Recovery Time Objective) | 1 hour | Maximum acceptable downtime |
| **RPO** (Recovery Point Objective) | 1 hour | Maximum acceptable data loss |

---

## Backup Strategy

### Database Backups (Supabase)

- **Automatic Backups:** Daily, 7-day retention
- **Point-in-Time Recovery:** Enabled (if on paid plan)
- **Location:** Supabase managed storage
- **Encryption:** AES-256 at rest

#### Verify Backups
1. Log into Supabase Dashboard
2. Go to Settings > Backups
3. Verify daily backups are running
4. Check last successful backup time

### Application Backups

- **Docker Images:** Stored in ECR/Docker Hub
- **Configuration:** In version control (git)
- **Secrets:** In AWS Secrets Manager / environment

---

## Disaster Scenarios

### Scenario 1: Database Corruption

**Symptoms:**
- Data inconsistencies
- Query errors
- Application errors related to data

**Recovery Steps:**
1. Identify corruption scope
2. Stop write operations (put app in read-only mode)
3. Log into Supabase Dashboard
4. Navigate to Settings > Backups
5. Select backup before corruption occurred
6. Initiate restore
7. Verify data integrity
8. Resume normal operations

**Estimated Recovery Time:** 30-60 minutes

### Scenario 2: Complete Service Outage

**Symptoms:**
- Application unreachable
- Health checks failing
- No response from any endpoint

**Recovery Steps:**
1. Check infrastructure status (AWS/hosting provider)
2. Check container status: `docker-compose ps`
3. Check logs: `docker-compose logs --tail=100`
4. If containers down, restart: `docker-compose up -d`
5. If infrastructure issue, failover to backup region
6. Verify health checks passing
7. Run smoke tests

**Estimated Recovery Time:** 15-30 minutes

### Scenario 3: Security Breach

**Symptoms:**
- Unauthorized access detected
- Unusual activity in logs
- Data exfiltration alerts

**Recovery Steps:**
1. **CONTAIN:** Immediately revoke compromised credentials
2. **ISOLATE:** Take affected systems offline
3. **ASSESS:** Determine breach scope
4. **NOTIFY:** Alert security team and stakeholders
5. **REMEDIATE:**
   - Rotate all API keys and secrets
   - Reset user passwords if needed
   - Patch vulnerabilities
6. **RESTORE:** From known-good backup if needed
7. **REVIEW:** Conduct post-incident analysis

**Estimated Recovery Time:** Variable (2-24 hours)

### Scenario 4: Accidental Data Deletion

**Symptoms:**
- Missing records
- User reports data loss
- Unexpected empty responses

**Recovery Steps:**
1. Stop further writes to affected tables
2. Identify what was deleted and when
3. Use PITR to restore to point before deletion
4. Or restore specific tables from backup
5. Verify data restored correctly
6. Resume operations

**Estimated Recovery Time:** 30-60 minutes

---

## Failover Procedures

### Database Failover
Supabase handles database failover automatically with read replicas.

### Application Failover

If primary region fails:
1. Update DNS to point to backup region
2. Deploy containers in backup region
3. Configure backup region to use same database
4. Verify connectivity and health

### Manual Rollback

If new deployment causes issues:
```bash
# Stop current containers
docker-compose down

# Deploy previous version
docker-compose -f docker-compose.rollback.yml up -d

# Verify health
curl http://localhost:3000/health
```

---

## Communication Plan

### Internal Notification

| Severity | Response Time | Notification |
|----------|---------------|--------------|
| Critical | 15 minutes | Phone + Slack + Email |
| High | 1 hour | Slack + Email |
| Medium | 4 hours | Email |

### External Communication

1. Update status page (status.yourdomain.com)
2. Send email to affected users
3. Post on social media if widespread
4. Provide regular updates every 30 minutes during incident

---

## Contact List

| Role | Name | Phone | Email | On-Call |
|------|------|-------|-------|---------|
| Tech Lead | | | | Primary |
| DevOps Lead | | | | Secondary |
| Product Manager | | | | Escalation |
| Supabase Support | | | support@supabase.com | |

---

## Recovery Testing

### Monthly Tests
- [ ] Verify backup accessibility
- [ ] Test backup restore to staging
- [ ] Review and update contact list

### Quarterly Tests
- [ ] Full disaster recovery drill
- [ ] Failover test to backup region
- [ ] Update recovery documentation

### Test Log

| Date | Test Type | Result | Notes |
|------|-----------|--------|-------|
| | | | |

---

## Post-Incident Process

1. **Incident Report:** Document what happened
2. **Timeline:** Create detailed timeline of events
3. **Root Cause:** Identify underlying cause
4. **Impact:** Assess user/business impact
5. **Action Items:** Define preventive measures
6. **Review:** Share findings with team
7. **Update:** Revise this document as needed
