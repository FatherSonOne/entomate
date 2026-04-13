# Phase 7: Production Deployment & Monitoring

**Enhanced Intelligence Dashboard - Production Hardening Guide**

---

## 🎯 Overview

This guide covers deploying the Enhanced Intelligence Dashboard to production with proper monitoring, logging, and performance tracking.

---

## ✅ Pre-Deployment Checklist

### 1. Environment Configuration

**Backend Environment Variables** (`backend/.env.production`):

```bash
# Node Environment
NODE_ENV=production
PORT=3000

# Database
SUPABASE_URL=https://your-prod-project.supabase.co
SUPABASE_ANON_KEY=eyJhbGci...  # Production anon key
SUPABASE_SERVICE_KEY=eyJhbGci...  # Production service key

# AI Services
OPENAI_API_KEY=sk-prod-...  # Production OpenAI key

# Authentication
CLERK_PUBLISHABLE_KEY=pk_live_...
CLERK_SECRET_KEY=sk_live_...

# Monitoring & Error Tracking
SENTRY_DSN=https://...@sentry.io/...
SENTRY_TRACES_SAMPLE_RATE=0.1  # 10% of transactions

# Security
JWT_SECRET=your-production-jwt-secret
SESSION_SECRET=your-production-session-secret
CORS_ORIGIN=https://your-domain.com

# Feature Flags
ENABLE_AI_FEATURES=true
ENABLE_INTELLIGENCE_DASHBOARD=true
```

**Frontend Environment Variables** (`frontend/.env.production`):

```bash
VITE_API_URL=https://api.your-domain.com
VITE_CLERK_PUBLISHABLE_KEY=pk_live_...
VITE_SENTRY_DSN=https://...@sentry.io/...
```

---

### 2. Database Migration Verification

Run the migration in production Supabase:

```sql
-- Verify all 4 tables exist
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
);

-- Expected: All 4 tables listed

-- Verify RLS policies
SELECT tablename, policyname, permissive
FROM pg_policies
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
);

-- Expected: Multiple policies per table

-- Verify indexes
SELECT tablename, indexname FROM pg_indexes
WHERE tablename IN (
  'deal_risk_scores',
  'stakeholder_intelligence',
  'action_item_dependencies',
  'intelligence_preferences'
);

-- Expected: Indexes on user_id, deal_id, calculated_at columns
```

---

### 3. Dependencies Audit

```bash
# Backend
cd backend
npm audit fix
npm outdated

# Frontend
cd frontend
npm audit fix
npm outdated
```

---

### 4. Build Verification

```bash
# Frontend build
cd frontend
npm run build

# Verify build output
ls -lh dist/

# Backend - no build needed for Node.js, but verify
cd backend
npm test  # If tests are configured
```

---

## 🔧 Monitoring Setup

### 1. Sentry Integration

Install Sentry SDK:

```bash
cd backend
npm install @sentry/node @sentry/integrations

cd frontend
npm install @sentry/react @sentry/tracing
```

**Backend Sentry Configuration** (`backend/server.js`):

```javascript
// Add at the top of server.js
const Sentry = require('@sentry/node');
const errorMonitoring = require('./services/monitoring/ErrorMonitoring');

if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: parseFloat(process.env.SENTRY_TRACES_SAMPLE_RATE) || 0.1
  });

  // Request handler must be the first middleware
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.tracingHandler());
}

// ... rest of server setup ...

// Error handler must be before any other error middleware
if (process.env.SENTRY_DSN) {
  app.use(Sentry.Handlers.errorHandler());
}
```

**Frontend Sentry Configuration** (`frontend/src/main.jsx`):

```javascript
import * as Sentry from '@sentry/react';
import { BrowserTracing } from '@sentry/tracing';

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [new BrowserTracing()],
    tracesSampleRate: 0.1,
    environment: import.meta.env.MODE
  });
}
```

---

### 2. Analytics Tracking

**Intelligence Dashboard Events to Track:**

```javascript
// Example: Track when users view the dashboard
errorMonitoring.trackFeatureUsage('intelligence_dashboard_view', {
  userId: user.id,
  cardsVisible: ['meeting_prep', 'deal_risks', 'action_items'],
  timestamp: new Date().toISOString()
});

// Track when AI features are used
errorMonitoring.trackFeatureUsage('ai_meeting_brief_generated', {
  userId: user.id,
  meetingId: meeting.id,
  briefLength: brief.length
});

// Track deal risk calculations
errorMonitoring.trackFeatureUsage('deal_risk_calculated', {
  userId: user.id,
  dealId: deal.id,
  riskLevel: riskScore.level,
  score: riskScore.score
});
```

---

### 3. OpenAI API Usage Monitoring

Update services to track AI costs:

```javascript
// In MeetingPrepService.js
const errorMonitoring = require('../monitoring/ErrorMonitoring');

// After OpenAI API call
const completion = await this.openai.chat.completions.create({
  model: 'gpt-4-turbo-preview',
  messages: [...]
});

// Track usage
const tokens = completion.usage.total_tokens;
const estimatedCost = (tokens / 1000) * 0.01; // GPT-4 pricing

errorMonitoring.trackAIUsage(
  'gpt-4-turbo-preview',
  tokens,
  estimatedCost,
  {
    operation: 'meeting_brief_generation',
    meetingId: meetingId,
    userId: userId
  }
);
```

---

### 4. Performance Monitoring

**Key Metrics to Monitor:**

1. **API Response Times**
   - `/api/intelligence/dashboard` - Target: < 2s
   - `/api/intelligence/meeting-prep/:id` - Target: < 1s
   - `/api/intelligence/deal-risks` - Target: < 3s
   - `/api/intelligence/action-items` - Target: < 1s

2. **Database Query Performance**
   - Risk score cache hit rate
   - Average query time for intelligence endpoints

3. **AI API Performance**
   - OpenAI API latency
   - Token consumption rate
   - Daily AI cost

**CloudWatch/Logging Configuration:**

```javascript
// Add to backend/server.js
const winston = require('winston');

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' })
  ]
});

if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple()
  }));
}

// Log all intelligence API calls
app.use('/api/intelligence', (req, res, next) => {
  logger.info('Intelligence API request', {
    path: req.path,
    method: req.method,
    userId: req.user?.id,
    timestamp: new Date().toISOString()
  });
  next();
});
```

---

## 🚀 Deployment Process

### Option 1: Docker Deployment

**Create Docker Configuration** (`Dockerfile`):

```dockerfile
FROM node:18-alpine

# Backend
WORKDIR /app/backend
COPY backend/package*.json ./
RUN npm ci --only=production
COPY backend/ ./

# Frontend build
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

# Serve frontend static files from backend
WORKDIR /app/backend
RUN mkdir -p public
RUN cp -r /app/frontend/dist/* public/

EXPOSE 3000

CMD ["node", "server.js"]
```

**Build and Deploy:**

```bash
# Build image
docker build -t entomate-intelligence:latest .

# Run locally to test
docker run -p 3000:3000 --env-file backend/.env.production entomate-intelligence:latest

# Push to registry
docker tag entomate-intelligence:latest your-registry/entomate-intelligence:latest
docker push your-registry/entomate-intelligence:latest
```

---

### Option 2: Traditional Server Deployment

```bash
# On production server
git clone https://github.com/your-org/entomate.git
cd entomate

# Backend setup
cd backend
npm ci --only=production
cp .env.example .env.production
# Edit .env.production with production values

# Frontend build
cd ../frontend
npm ci
npm run build

# Copy frontend build to backend public folder
cp -r dist/* ../backend/public/

# Start with PM2
cd ../backend
npm install -g pm2
pm2 start server.js --name entomate-backend
pm2 save
pm2 startup  # Enable auto-start on reboot
```

---

### Option 3: Serverless (AWS Lambda + API Gateway)

*Note: Requires refactoring for serverless architecture*

---

## 📊 Post-Deployment Verification

### 1. Health Checks

```bash
# Backend health
curl https://api.your-domain.com/health

# Intelligence dashboard endpoint
curl https://api.your-domain.com/api/intelligence/dashboard \
  -H "Authorization: Bearer PRODUCTION_TOKEN"
```

---

### 2. Smoke Tests

```bash
# Install Artillery for load testing
npm install -g artillery

# Run smoke tests
artillery run tests/smoke-test-intelligence.yml
```

**Create** `tests/smoke-test-intelligence.yml`:

```yaml
config:
  target: "https://api.your-domain.com"
  phases:
    - duration: 60
      arrivalRate: 5
  variables:
    authToken: "{{ $processEnvironment.PROD_AUTH_TOKEN }}"

scenarios:
  - name: "Intelligence Dashboard Flow"
    flow:
      - get:
          url: "/api/intelligence/dashboard"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
            - contentType: json

      - get:
          url: "/api/intelligence/action-items"
          headers:
            Authorization: "Bearer {{ authToken }}"
          expect:
            - statusCode: 200
```

---

### 3. Monitor Error Rates

**First 24 Hours Checklist:**

- [ ] Check Sentry for any new errors
- [ ] Monitor API response times in CloudWatch/logs
- [ ] Verify OpenAI API costs are within budget
- [ ] Check database query performance
- [ ] Verify cache hit rates for risk scores
- [ ] Monitor user adoption (how many dashboard views)

---

## 🔒 Security Hardening

### 1. Rate Limiting

```javascript
// In backend/routes/intelligence.js
const rateLimit = require('express-rate-limit');

const intelligenceLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each user to 100 requests per windowMs
  message: 'Too many intelligence requests, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

router.use(intelligenceLimiter);
```

---

### 2. Input Validation

```javascript
// Validate query parameters
router.get('/dashboard', (req, res, next) => {
  const { riskFilter, meetingHours, riskDays } = req.query;

  if (meetingHours && (isNaN(meetingHours) || meetingHours < 0 || meetingHours > 168)) {
    return res.status(400).json({
      success: false,
      error: 'Invalid meetingHours parameter'
    });
  }

  next();
});
```

---

### 3. CORS Configuration

```javascript
// In backend/server.js
const cors = require('cors');

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://your-domain.com',
  credentials: true,
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

---

## 📈 Cost Optimization

### 1. OpenAI API Cost Control

**Set monthly budget alerts:**

```javascript
// Track daily AI spending
const dailyAICost = {
  date: new Date().toISOString().split('T')[0],
  totalTokens: 0,
  totalCost: 0,
  requestCount: 0
};

// Alert if daily cost exceeds threshold
const DAILY_COST_THRESHOLD = 50; // $50/day

if (dailyAICost.totalCost > DAILY_COST_THRESHOLD) {
  errorMonitoring.captureMessage(
    `Daily AI cost threshold exceeded: $${dailyAICost.totalCost}`,
    'warning',
    { dailyAICost }
  );
}
```

---

### 2. Database Query Optimization

**Monitor slow queries:**

```sql
-- In Supabase SQL Editor
SELECT
  query,
  calls,
  total_time,
  mean_time
FROM pg_stat_statements
WHERE query LIKE '%intelligence%'
ORDER BY mean_time DESC
LIMIT 20;
```

---

### 3. Caching Strategy

**Verify cache effectiveness:**

```javascript
// Log cache hit rates
const cacheStats = {
  hits: 0,
  misses: 0,
  hitRate: 0
};

// After checking cache
if (cachedData) {
  cacheStats.hits++;
} else {
  cacheStats.misses++;
}

cacheStats.hitRate = cacheStats.hits / (cacheStats.hits + cacheStats.misses);

// Log every hour
setInterval(() => {
  console.log('[Cache Stats]', cacheStats);
}, 3600000);
```

---

## 🎯 Success Metrics

**Week 1 Targets:**

- [ ] 99.9% uptime
- [ ] < 2s average dashboard load time
- [ ] < $100 daily OpenAI costs
- [ ] 0 critical errors in Sentry
- [ ] > 60% cache hit rate for risk scores

**Month 1 Targets:**

- [ ] > 50% user adoption (% of users viewing intelligence dashboard)
- [ ] < 1s average API response time
- [ ] < $2000 monthly OpenAI costs
- [ ] < 5 errors per 1000 requests

---

## 🐛 Troubleshooting

### Issue: High OpenAI Costs

**Solution:**
- Reduce talking points generation frequency
- Implement request deduplication
- Cache brief results for 24 hours
- Add user quotas (X briefs per day)

---

### Issue: Slow Dashboard Load

**Solution:**
- Enable risk score caching
- Reduce parallel API calls
- Implement pagination for large datasets
- Use CDN for frontend assets

---

### Issue: High Error Rate

**Solution:**
- Check Sentry for specific error patterns
- Verify database connection pool settings
- Check OpenAI API rate limits
- Review RLS policy performance

---

## 📞 Support & Escalation

**Production Issues Escalation:**

1. **P0 (Critical):** Dashboard completely down
   - Check server health
   - Verify database connectivity
   - Review last deployment

2. **P1 (High):** AI features failing
   - Check OpenAI API status
   - Verify API key validity
   - Review recent error logs

3. **P2 (Medium):** Performance degradation
   - Review CloudWatch metrics
   - Check database query performance
   - Analyze cache hit rates

---

## ✅ Phase 7 Completion Checklist

- [x] Error monitoring configured (Sentry)
- [x] Analytics tracking implemented
- [x] Performance monitoring setup
- [x] OpenAI usage logging
- [ ] Production deployment completed
- [ ] Smoke tests passing
- [ ] First 24-hour monitoring complete

---

**Phase 7 Status:** Ready for Production Deployment 🚀

**Last Updated:** 2026-01-24
