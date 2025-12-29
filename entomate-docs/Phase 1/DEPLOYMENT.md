FILE 8: DEPLOYMENT.md
text
# Entomate: Comprehensive Deployment Guide

**Production-Ready Deployment Instructions for Multiple Environments**

**Version:** 1.0  
**Last Updated:** December 15, 2025

---

## Table of Contents

1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Development Environment](#development-environment)
3. [Testing Environment](#testing-environment)
4. [Production Environment](#production-environment)
5. [Deployment Procedures](#deployment-procedures)
6. [Monitoring & Troubleshooting](#monitoring--troubleshooting)
7. [Rollback Procedures](#rollback-procedures)
8. [Security Checklist](#security-checklist)

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All tests passing (`npm run test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code formatted (`npm run format`)
- [ ] No console.log() in production code
- [ ] No hardcoded API keys or secrets
- [ ] Security audit completed
- [ ] Dependencies updated to latest secure versions
- [ ] Error handling on all endpoints

### Functional Testing

- [ ] Record meeting → transcription works
- [ ] Action items extracted correctly
- [ ] CRM sync working (Logos Vision)
- [ ] Pulse notifications sent
- [ ] Ask Assistant returning answers
- [ ] Projects and tasks manageable
- [ ] Automations triggering
- [ ] No critical bugs open

### Documentation

- [ ] README.md updated
- [ ] API documentation current
- [ ] Environment variables documented
- [ ] Deployment procedures written
- [ ] Rollback procedures written
- [ ] Team trained on deployment

### Data

- [ ] Database schema finalized
- [ ] Migrations tested
- [ ] Backup procedures tested
- [ ] Data migration plan ready (if needed)

---

## Development Environment

### Purpose
Local development on your machine. For building and testing features.

### Setup

**1. Clone and Install**

git clone https://github.com/yourorg/entomate.git
cd entomate

Backend
npm install

Frontend
cd frontend
npm install
cd ..

text

**2. Database Setup**

Using Docker (recommended)
docker-compose up -d postgres

Or local PostgreSQL
createdb entomate_dev

Run migrations
npm run migrate

text

**3. Environment Configuration**

cp .env.example .env

text

Edit `.env` with development values:

NODE_ENV=development
PORT=3000
DATABASE_URL=postgresql://user:password@localhost:5432/entomate_dev

Use free/test API keys
GEMINI_API_KEY=your_dev_key_here
LOGOS_VISION_API_URL=http://localhost:8001 # Local mock or dev instance
PULSE_API_URL=http://localhost:8002

text

**4. Start Development Servers**

Terminal 1: Backend
npm start

Terminal 2: Frontend
cd frontend
npm run dev

Terminal 3: PostgreSQL (if not using Docker)
Skip if using docker-compose
text

### Testing in Development

Unit tests (watch mode)
npm run test -- --watch

Integration tests
npm run test:integration

Manual testing
Open http://localhost:5173
Test recording, processing, etc.
text

### Tips

- Use real test data (actual meeting recordings) early
- Test CRM/Pulse integrations against test instances
- Keep database backed up (`npm run db:backup`)
- Use `npm run seed` to populate test data

---

## Testing Environment

### Purpose
Test environment shared by QA team. For comprehensive testing before production.

### Setup on AWS EC2

**1. Launch EC2 Instance**

Instance type: t3.medium (good for testing)
OS: Ubuntu 22.04 LTS
Storage: 50 GB
Security Group: Allow SSH (your IP), HTTP, HTTPS
Connect
ssh -i your-key.pem ubuntu@your-instance-ip

text

**2. Install System Dependencies**

sudo apt update
sudo apt install -y nodejs postgresql postgresql-contrib git docker.io

Add user to docker group
sudo usermod -aG docker ubuntu

Install Node
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

text

**3. Clone and Setup**

cd /home/ubuntu
git clone https://github.com/yourorg/entomate.git
cd entomate

npm install
cd frontend && npm install && cd ..

Copy environment config
cp .env.example .env

text

**4. Configure Environment for Testing**

Edit .env
nano .env

text
undefined
NODE_ENV=testing
PORT=3000
DATABASE_URL=postgresql://entomate:password@localhost:5432/entomate_test

Use TEST Logos Vision/Pulse instances
GEMINI_API_KEY=your_test_key_here
LOGOS_VISION_API_URL=https://test-api.logosvis.com
LOGS_VISION_API_KEY=test_key_here
PULSE_API_URL=https://test-api.pulse.com
PULSE_API_KEY=test_key_here

Enable verbose logging
LOG_LEVEL=debug

text

**5. Database Setup**

Start PostgreSQL
sudo systemctl start postgresql

Create database
sudo -u postgres createdb entomate_test
sudo -u postgres psql -d entomate_test -c "ALTER SCHEMA public OWNER TO entomate;"

Run migrations
npm run migrate

text

**6. Start Services**

Using PM2 for process management
sudo npm install -g pm2

Start backend
pm2 start npm --name "entomate-api" -- start

Start frontend
cd frontend
pm2 start npm --name "entomate-web" -- run dev
cd ..

Save PM2 process list
pm2 save

Make PM2 start on boot
pm2 startup

text

**7. Access Testing Environment**

Backend API: http://your-instance-ip:3000
Frontend: http://your-instance-ip:5173

text

### Testing Procedures

**Daily QA Testing:**

Login to testing instance
ssh -i your-key.pem ubuntu@your-instance-ip

Check logs
pm2 logs entomate-api
pm2 logs entomate-web

Run test suite
npm run test:integration

Manual tests
1. Record meeting
2. Verify transcription
3. Check action items
4. Verify CRM sync
5. Check Pulse notification
6. Test Ask Assistant
7. Check for errors in logs
text

### Scaling Testing

If testing with multiple concurrent users:

Load testing with Apache Bench
ab -n 1000 -c 10 http://your-instance-ip:3000/api/health

Or using wrk
wrk -t4 -c100 -d30s http://your-instance-ip:3000/api/health

text

---

## Production Environment

### Architecture

text
                ┌─ Load Balancer ─┐
                │    (Heroku)     │
                └────────┬────────┘
                         │
    ┌────────────────────┼────────────────────┐
    ▼                    ▼                    ▼
┌─────────┐ ┌─────────┐ ┌─────────┐
│ Dyno 1 │ │ Dyno 2 │ │ Dyno 3 │
│ (App) │ │ (App) │ │ (App) │
└────┬────┘ └────┬────┘ └────┬────┘
│ │ │
└───────────────────┼───────────────────┘
│
┌───────────┴───────────┐
▼ ▼
┌──────────────┐ ┌──────────────┐
│ PostgreSQL │ │ Redis Cache │
│ (AWS RDS) │ │ (optional) │
└──────────────┘ └──────────────┘

text

### Deployment Options

Choose one based on your infrastructure:

#### Option A: Heroku (Easiest)

**Pros:** Easiest setup, minimal ops, good for startups  
**Cons:** Less control, can be expensive at scale

**Setup:**

1. Create Heroku app
heroku create entomate-prod
heroku config:set NODE_ENV=production

2. Add PostgreSQL
heroku addons:create heroku-postgresql:standard-0

Note the DATABASE_URL that's set automatically
3. Set environment variables
heroku config:set GEMINI_API_KEY=your_key_here
heroku config:set LOGOS_VISION_API_KEY=your_key_here
heroku config:set PULSE_API_KEY=your_key_here
heroku config:set JWT_SECRET=$(openssl rand -hex 32)
heroku config:set SESSION_SECRET=$(openssl rand -hex 32)

4. Create Procfile
cat > Procfile << EOF
web: npm start
release: npm run migrate
EOF

5. Deploy
git push heroku main

6. Run migrations
heroku run npm run migrate

7. Check logs
heroku logs --tail

text

#### Option B: AWS (More Control)

**Pros:** Full control, scales well, flexible  
**Cons:** More setup, requires DevOps knowledge

**Setup with Elastic Beanstalk:**

1. Install EB CLI
pip install awsebcli

2. Initialize
eb init -p node.js-18 entomate --region us-east-1

3. Create environment
eb create entomate-prod

4. Set environment variables
eb setenv NODE_ENV=production
eb setenv GEMINI_API_KEY=your_key_here
eb setenv DATABASE_URL=your_rds_url_here

5. Deploy
eb deploy

6. Check health
eb status
eb health

text

#### Option C: DigitalOcean App Platform

**Pros:** Simple, affordable, good docs  
**Cons:** Smaller ecosystem than AWS/Heroku

**Setup:**

1. Create app.yaml
cat > app.yaml << EOF
name: entomate
services:

name: api
github:
repo: yourorg/entomate
branch: main
build_command: npm install && npm run build
run_command: npm start
envs:

key: NODE_ENV
value: production

key: GEMINI_API_KEY
scope: RUN_AND_BUILD_TIME
value: ${GEMINI_API_KEY}
databases:

name: db
engine: PG
version: "14"
EOF

2. Deploy
doctl apps create --spec app.yaml

3. Monitor
doctl apps list
doctl apps get <app-id>

text

---

## Deployment Procedures

### Pre-Deployment (2 hours before)

**1. Final Checks**

Verify all tests pass
npm run test
npm run test:integration

Check linting
npm run lint

Build locally first
npm run build
cd frontend && npm run build && cd ..

Check no uncommitted changes
git status

text

**2. Communication**

- [ ] Notify team that deployment happening
- [ ] Post in #entomate-deploy Slack channel
- [ ] Get approval from tech lead
- [ ] Alert customer support in case of issues

**3. Backup Database**

Heroku
heroku pg:backups:capture

AWS
Use AWS RDS snapshots
aws rds create-db-snapshot
--db-instance-identifier entomate-prod
--db-snapshot-identifier entomate-prod-$(date +%Y%m%d-%H%M%S)

DigitalOcean
doctl databases backup create <db-id>

text

### Deployment (30 minutes)

**1. Deploy Code**

Heroku
git push heroku main

AWS Elastic Beanstalk
eb deploy

DigitalOcean
git push

Self-hosted
Pull latest, rebuild, restart
text

**2. Run Migrations**

Heroku
heroku run npm run migrate

AWS EB
eb ssh
npm run migrate
exit

DigitalOcean
Migrations run automatically on deploy
Self-hosted
npm run migrate

text

**3. Verify Deployment**

Check health endpoint
curl https://entomate.app/api/health

Expected response:
{ "status": "ok", "version": "1.0.0", "timestamp": "2025-12-16T..." }
Check logs for errors
Heroku
heroku logs --tail

AWS EB
eb logs

DigitalOcean
doctl apps logs <app-id>

text

### Post-Deployment (1 hour after)

**1. Smoke Testing**

Test critical paths
curl -X POST https://entomate.app/api/meetings
-H "Content-Type: application/json"
-d '{"title":"Test Meeting"}'

Verify CRM sync working
curl https://entomate.app/api/action-items

Check Ask Assistant
curl -X POST https://entomate.app/api/ask-assistant
-H "Content-Type: application/json"
-d '{"question":"What did we discuss?"}'

text

**2. Monitor Metrics**

Heroku
heroku metrics

AWS
Check CloudWatch metrics
DigitalOcean
Check app metrics in dashboard
text

**3. Verify External Integrations**

- [ ] Check Logos Vision CRM (action items created)
- [ ] Check Pulse Chat (notifications sent)
- [ ] Verify Gemini API calls working
- [ ] Check database connectivity

**4. Announce Success**

- [ ] Post success message to #entomate-deploy
- [ ] Alert support that deployment complete
- [ ] Update status page if applicable
- [ ] Send email to stakeholders

---

## Monitoring & Troubleshooting

### Key Metrics to Monitor

Response Time

Target: < 1 second for API endpoints

Alert if: > 5 seconds

Error Rate

Target: < 0.1%

Alert if: > 1%

Database Connections

Target: < 80% of pool

Alert if: > 90%

API Quota Usage (Gemini)

Monitor: Daily API calls

Alert if: > 80% of quota

Memory Usage

Target: < 70% of available

Alert if: > 85%

Disk Usage

Target: < 70% full

Alert if: > 85% full

text

### Setting Up Monitoring (Sentry)

1. Create Sentry account
Go to https://sentry.io and create project
2. Install Sentry
npm install @sentry/node

3. Initialize in app
In index.js:
const Sentry = require("@sentry/node");

Sentry.init({
dsn: process.env.SENTRY_DSN,
environment: process.env.NODE_ENV,
tracesSampleRate: 1.0,
});

app.use(Sentry.Handlers.requestHandler());
app.use(Sentry.Handlers.errorHandler());

4. Set Sentry DSN in environment
heroku config:set SENTRY_DSN=https://...

5. Now errors automatically reported to Sentry
text

### Common Issues & Solutions

**Issue: "Database connection failed"**
Check database URL is correct
echo $DATABASE_URL

Verify PostgreSQL is running
heroku pg:info

Restart database connection
heroku dyno:restart web

text

**Issue: "Gemini API key invalid"**
Verify API key is set
heroku config | grep GEMINI

Test API key in AI Studio
https://aistudio.google.com
Update if needed
heroku config:set GEMINI_API_KEY=new_key_here

text

**Issue: "High memory usage"**
Check what's using memory
heroku metrics

Increase dyno size
heroku dyno:type:set Hobby

Or add more dynos
heroku ps:scale web=2

text

**Issue: "Logs not showing errors"**
Increase log level
heroku config:set LOG_LEVEL=debug

Tail logs
heroku logs --tail

Search logs
heroku logs --grep ERROR

text

### Performance Optimization

Add Redis cache
heroku addons:create heroku-redis:premium-0

Enable compression
npm install compression

In app.js:
const compression = require('compression');
app.use(compression());

Add database indexes
npm run migrate:add-indexes

text

---

## Rollback Procedures

### Scenario: Bug Deployed to Production

**Option 1: Rollback to Previous Version (5 minutes)**

Heroku
heroku rollback

AWS EB
eb appversion list
eb deploy <previous-version-id>

DigitalOcean
git revert <commit-hash>
git push

text

**Option 2: Database Restore (15 minutes)**

If data corruption occurred
Heroku
heroku pg:backups
heroku pg:backups:restore <backup-id>

AWS RDS
aws rds restore-db-instance-from-db-snapshot
--db-instance-identifier entomate-prod-restored
--db-snapshot-identifier <snapshot-id>

DigitalOcean
doctl databases restore <db-id> <backup-id>

text

### Post-Rollback

1. Notify team immediately
2. Investigate root cause
3. Create incident report
4. Fix bug locally
5. Test thoroughly before re-deploying
6. Deploy fix
text

---

## Security Checklist

### Before Production Deploy

- [ ] No API keys in code (use .env)
- [ ] HTTPS enabled everywhere
- [ ] Environment variables reviewed
- [ ] Database encrypted at rest
- [ ] Database backups encrypted
- [ ] CORS configured correctly
- [ ] Input validation on all endpoints
- [ ] SQL injection prevention (parameterized queries)
- [ ] Authentication required on sensitive endpoints
- [ ] Rate limiting enabled
- [ ] Secrets rotated (API keys, JWT secrets)
- [ ] Security headers set (HSTS, CSP, X-Frame-Options)

### Production Configuration

Heroku / Environment
NODE_ENV=production
LOG_LEVEL=info # NOT debug

Security
HTTPS_ONLY=true
CORS_ORIGIN=https://entomate.app

Rate Limiting
RATE_LIMIT_WINDOW=15 # minutes
RATE_LIMIT_MAX=100 # requests

Authentication
JWT_EXPIRY=24h
SESSION_TIMEOUT=30m # minutes

Database
DB_POOL_SIZE=10
DB_POOL_TIMEOUT=30000

API Keys (secure!)
GEMINI_API_KEY=xxx # Rotate monthly
LOGOS_VISION_API_KEY=xxx # Rotate quarterly
PULSE_API_KEY=xxx # Rotate quarterly

text

---

## Maintenance Schedule

### Daily
- [ ] Monitor error rates
- [ ] Check API quota usage (Gemini)
- [ ] Review logs for issues

### Weekly
- [ ] Full backup verification
- [ ] Performance metrics review
- [ ] Security update check
- [ ] User-reported issues review

### Monthly
- [ ] Rotate API keys
- [ ] Database maintenance (analyze, vacuum)
- [ ] Certificate renewal check (if self-hosted)
- [ ] Disaster recovery drill

### Quarterly
- [ ] Security audit
- [ ] Performance optimization review
- [ ] Capacity planning (upgrade if needed)
- [ ] Dependency updates

---

## Disaster Recovery Plan

### Database Loss Scenario

**Time: Immediately**
1. Alert team
2. Disable writes to minimize data loss
3. Stop application
3. Restore from most recent backup
heroku pg:backups:restore

4. Verify data integrity
npm run db:integrity-check

5. Restart application
heroku dyno:restart web

6. Notify users
text

### Entire System Loss Scenario

1. Alert team and leadership
2. Create new infrastructure
heroku create entomate-prod-new

3. Restore database
heroku pg:backups:restore --recovery-target-timeline latest

4. Deploy application
git push heroku-new main

5. Switch DNS/load balancer to new system
6. Verify everything working
7. Document incident
text

---

## Support & Escalation

### If Something Goes Wrong

**Level 1: Check Logs**
heroku logs --tail
heroku logs --grep ERROR

text

**Level 2: Restart Services**
heroku dyno:restart web
heroku ps:scale web=1

text

**Level 3: Check Integrations**
Test Gemini API
Test Logos Vision API
Test Pulse API
curl https://entomate.app/api/integrations/status

text

**Level 4: Escalate**
- [ ] Alert tech lead
- [ ] Create incident ticket
- [ ] Start incident timeline
- [ ] Notify affected users

---

## Contact & Resources

| Role | Contact | Availability |
|------|---------|--------------|
| DevOps | [Name] | 24/7 on-call |
| Backend Lead | [Name] | Business hours |
| Database Admin | [Name] | Business hours |
| Security Team | [Name] | Business hours |

**Emergency Contact:** [Escalation Phone Number]

**Documentation:**
- [README.md](../README.md) - Project overview
- [API.md](./API.md) - API documentation
- [DEVELOPMENT.md](./DEVELOPMENT.md) - Development guide

---

*Last Updated: December 15, 2025*  
*Review Schedule: Monthly*  
*Next Review: January 15, 2026*