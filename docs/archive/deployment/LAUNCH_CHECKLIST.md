# Launch Checklist

## Entomate Production Launch
**Version:** 1.0
**Target Date:** _______________

---

## Pre-Launch Requirements

### Security (CRITICAL)

- [ ] Security audit completed (see SECURITY_CHECKLIST.md)
- [ ] All high/critical vulnerabilities fixed
- [ ] HTTPS enabled with valid SSL certificate
- [ ] API rate limiting active and tested
- [ ] SQL injection prevention verified
- [ ] XSS prevention verified
- [ ] CSRF protection enabled
- [ ] Secrets secured in environment variables
- [ ] Database encryption enabled
- [ ] No debug mode in production
- [ ] Dependency vulnerabilities scanned and fixed

### Performance

- [ ] Response times < 500ms (95th percentile)
- [ ] Load tested with 100+ concurrent users
- [ ] Core Web Vitals optimized (LCP < 2.5s, FID < 100ms, CLS < 0.1)
- [ ] Database queries optimized
- [ ] Caching strategy implemented
- [ ] CDN configured (if applicable)
- [ ] Static assets minified and compressed
- [ ] Bundle size < 500KB (JavaScript)

### Infrastructure

- [ ] Docker images built and tested
- [ ] Docker Compose verified
- [ ] Production environment variables set
- [ ] Load balancer configured (if applicable)
- [ ] Auto-scaling configured (if applicable)
- [ ] Health checks configured and passing
- [ ] SSL certificates valid (check expiry)

### Monitoring & Logging

- [ ] Sentry error tracking configured
- [ ] Error tracking verified (test error sent)
- [ ] Winston logging configured
- [ ] Log rotation set up
- [ ] Alert rules configured
- [ ] Monitoring dashboards created
- [ ] On-call schedule set up

### Backups & Disaster Recovery

- [ ] Daily backups automated (Supabase)
- [ ] Backup encryption enabled
- [ ] Point-in-time recovery tested
- [ ] Restore procedures documented and tested
- [ ] RTO/RPO defined (target: 1 hour)
- [ ] Disaster recovery plan documented
- [ ] Rollback plan ready

### Testing

- [ ] All unit tests passing
- [ ] All integration tests passing
- [ ] Smoke test suite passing (tests/smoke-test.yml)
- [ ] Staging deployment successful
- [ ] Load testing passed (tests/load-test.yml)
- [ ] Security testing passed

### Documentation

- [ ] Getting started guide complete
- [ ] Feature documentation complete
- [ ] API documentation complete
- [ ] FAQ complete
- [ ] Troubleshooting guide complete
- [ ] Admin guide complete
- [ ] Release notes written

### Team Preparation

- [ ] Support team trained
- [ ] Support processes documented
- [ ] On-call schedule confirmed
- [ ] Incident response plan reviewed
- [ ] Rollback procedures reviewed

---

## Deployment Day

### Pre-Deployment (1 hour before)

- [ ] Team briefing completed
- [ ] All sign-offs obtained
- [ ] Communication plan ready
- [ ] Rollback plan reviewed
- [ ] Monitoring dashboards open

### Deployment Steps

1. [ ] Announce maintenance window (if any)
2. [ ] Deploy backend services
3. [ ] Verify backend health checks
4. [ ] Deploy frontend
5. [ ] Verify frontend accessible
6. [ ] Run smoke tests
7. [ ] Verify monitoring data flowing
8. [ ] Check error tracking (no new errors)

### Post-Deployment (First hour)

- [ ] All health checks passing
- [ ] No errors in Sentry
- [ ] Response times normal
- [ ] Database connections stable
- [ ] First user traffic successful
- [ ] Quick load test (10 concurrent users)

### Launch Announcement

- [ ] Send launch email
- [ ] Post in-app welcome message
- [ ] Update status page
- [ ] Social media announcements
- [ ] Notify stakeholders

---

## Sign-Off

| Role | Name | Status | Date |
|------|------|--------|------|
| Tech Lead | | GO / NO-GO | |
| Security Lead | | GO / NO-GO | |
| DevOps Lead | | GO / NO-GO | |
| Product Manager | | GO / NO-GO | |
| QA Lead | | GO / NO-GO | |

**Final Decision:** _______________
**Deployment Time:** _______________
**On-Call Lead:** _______________

---

## Post-Launch Monitoring

### First 24 Hours

- [ ] Monitor error rates (target: < 0.1%)
- [ ] Monitor response times (target: < 500ms p95)
- [ ] Monitor CPU/memory usage
- [ ] Daily standups: 9am, 12pm, 5pm
- [ ] Collect user feedback
- [ ] Document any issues

### First Week

- [ ] Daily metric reviews
- [ ] Performance tuning as needed
- [ ] Bug fixes deployed
- [ ] User support active
- [ ] Retrospective scheduled

---

## Emergency Contacts

| Role | Name | Phone | Email |
|------|------|-------|-------|
| Tech Lead | | | |
| DevOps Lead | | | |
| Product Manager | | | |
| Support Lead | | | |

**Rollback Decision Point:** 1 hour post-launch
**Rollback Command:** `docker-compose down && docker-compose -f docker-compose.rollback.yml up -d`
