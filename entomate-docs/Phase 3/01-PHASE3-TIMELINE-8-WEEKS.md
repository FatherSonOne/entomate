# Entomate — Phase 3 Timeline (8 Weeks)

**Start:** Feb 10, 2026 (post-Phase 2 release)
**Release Target:** April 7, 2026
**Release Style:** Single release (ship everything together)
**Build Style:** Backend-first, then UI
**Goal:** Enterprise-grade intelligence platform with real-time coaching, sentiment tracking, and compliance features

---

## Phase 3 Weekly Overview

| Week | Dates | Focus | Must-Ship Outcome by Friday |
|------|-------|-------|-----------------------------|
| 1 | Feb 10–16 | Real-time Coaching Foundation | WebSocket infrastructure + coaching agent skeleton |
| 2 | Feb 17–23 | Real-time Coaching Features | Live prompts, objection handling, talk-time tracking |
| 3 | Feb 24–Mar 2 | Customer Sentiment Engine | Sentiment analysis + health score calculation |
| 4 | Mar 3–9 | Sentiment UI + Alerts | Health dashboard + at-risk alerts |
| 5 | Mar 10–16 | Enterprise RBAC | Role-based access control + permission system |
| 6 | Mar 17–23 | Enterprise SSO + Compliance | SSO integration + audit logs + data retention |
| 7 | Mar 24–30 | Advanced Integrations | CRM connectors + video platform connectors + webhooks |
| 8 | Mar 31–Apr 7 | Stabilize + Ship | Performance, security review, production launch |

---

## Week 1 (Feb 10–16): Real-time Coaching Foundation

### Outcome by Friday
- WebSocket infrastructure deployed
- Coaching agent skeleton running
- Basic real-time message delivery working

### Backend (Node.js) — Tasks

**WebSocket Infrastructure:**
```
src/realtime/
├── wsServer.ts         # WebSocket server setup
├── roomManager.ts      # Meeting room management
├── messageRouter.ts    # Route messages to handlers
└── coachingAgent.ts    # Real-time coaching logic
```

- Set up Socket.IO or ws library
- Implement meeting room concept (users join a "room" per meeting)
- Create message types: `coaching_prompt`, `context_update`, `talk_time_alert`
- Add authentication for WebSocket connections

**Database:**
```sql
CREATE TABLE coaching_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL,
  user_id UUID NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  prompts_shown INT NOT NULL DEFAULT 0,
  prompts_used INT NOT NULL DEFAULT 0
);

CREATE TABLE coaching_prompts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID REFERENCES coaching_sessions(id),
  prompt_type TEXT NOT NULL,
  prompt_text TEXT NOT NULL,
  context JSONB NOT NULL DEFAULT '{}',
  shown_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  used_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ
);
```

### Frontend — Tasks
- Add WebSocket client connection logic
- Create coaching prompt component (toast/card style)
- Wire up to meeting recording UI

### QA / Validation
- WebSocket connects and receives test messages
- Prompts appear in UI within 500ms of being sent
- Connection handles reconnect gracefully

---

## Week 2 (Feb 17–23): Real-time Coaching Features

### Outcome by Friday
- Full coaching feature set working:
  - Deal context prompts
  - Objection handling suggestions
  - Competitor mention alerts
  - Talk-time balance warnings

### Backend (Node.js) — Tasks

**Coaching Logic:**
```typescript
// src/realtime/coachingAgent.ts
interface CoachingContext {
  meetingId: string;
  dealId: string | null;
  participants: string[];
  dealStage: string | null;
  openObjections: string[];
  competitorMentions: string[];
  talkTimeByParticipant: Record<string, number>;
}

// Trigger coaching prompts based on:
// 1. Keywords detected in live transcript
// 2. Deal context from knowledge graph
// 3. Talk-time imbalance
// 4. Competitor names mentioned
```

- Implement keyword detection for objections (price, timeline, competitor, budget)
- Implement competitor name detection (from deal record or config)
- Implement talk-time tracking (aim for balanced conversation)
- Add prompt prioritization (don't flood user with prompts)

**Prompt Templates:**
```typescript
const PROMPT_TEMPLATES = {
  objection_price: {
    text: "Price concern detected. Consider: Value proposition, ROI calculation, payment terms",
    priority: "high"
  },
  competitor_mentioned: {
    text: "Competitor {{name}} mentioned. Key differentiators: {{diff}}",
    priority: "medium"
  },
  talk_time_imbalance: {
    text: "You've been speaking 70%+ of the time. Try asking an open question.",
    priority: "low"
  }
};
```

### Frontend — Tasks
- Style coaching prompts (non-intrusive but visible)
- Add dismiss/use tracking
- Show talk-time indicator
- Add "coaching off" toggle for users who don't want it

### QA / Validation
- Simulate a meeting with objection keywords → prompts appear
- Verify talk-time is calculated correctly
- Confirm prompts don't spam (max 1 per 30 seconds)

---

## Week 3 (Feb 24–Mar 2): Customer Sentiment Engine

### Outcome by Friday
- Sentiment analysis running on all meetings and messages
- Customer health score calculation working
- Historical sentiment stored and queryable

### Backend (Node.js) — Tasks

**Sentiment Analysis:**
```
src/sentiment/
├── analyzer.ts         # Gemini-powered sentiment analysis
├── healthScore.ts      # Composite health score calculation
├── trendTracker.ts     # Track sentiment over time
└── types.ts            # Sentiment types and interfaces
```

**Database:**
```sql
CREATE TABLE customer_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- meeting, pulse_message, email
  source_id TEXT NOT NULL,
  sentiment_score DOUBLE PRECISION NOT NULL,  -- -1.0 to 1.0
  sentiment_label TEXT NOT NULL,  -- positive, neutral, negative
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  key_phrases JSONB NOT NULL DEFAULT '[]',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE customer_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL UNIQUE,
  health_score INT NOT NULL,  -- 0-100
  health_label TEXT NOT NULL,  -- healthy, at_risk, critical
  factors JSONB NOT NULL DEFAULT '{}',
  last_interaction TIMESTAMPTZ,
  sentiment_trend TEXT,  -- improving, stable, declining
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

**Health Score Formula:**
```typescript
function calculateHealthScore(customerId: string): number {
  const factors = {
    recentSentiment: getAverageSentiment(customerId, 30), // last 30 days
    interactionFrequency: getInteractionScore(customerId),
    responseTime: getResponseTimeScore(customerId),
    dealProgress: getDealProgressScore(customerId),
    taskCompletion: getTaskCompletionScore(customerId)
  };

  return weightedAverage(factors, HEALTH_WEIGHTS);
}
```

### Frontend — Tasks
- Create sentiment analysis results display
- Add sentiment badges to meeting/message lists

### QA / Validation
- Analyze 50 test transcripts, verify sentiment accuracy
- Confirm health scores change appropriately with new data
- Test edge cases (no interactions, all negative, etc.)

---

## Week 4 (Mar 3–9): Sentiment UI + Alerts

### Outcome by Friday
- Customer health dashboard live
- At-risk customer alerts working
- Churn prediction signals visible

### Backend (Node.js) — Tasks

**Alert System:**
```typescript
// Trigger alerts when:
// 1. Health score drops below threshold
// 2. Sentiment trend is "declining" for 2+ weeks
// 3. No interaction in X days (configurable)
// 4. Multiple negative interactions in a row

interface HealthAlert {
  customerId: string;
  alertType: 'score_drop' | 'declining_trend' | 'no_interaction' | 'repeated_negative';
  severity: 'warning' | 'critical';
  message: string;
  suggestedAction: string;
}
```

- Create alert evaluation job (runs hourly)
- Integrate with Pulse for alert notifications
- Add alert acknowledgment and resolution tracking

### Frontend — Tasks
- Build customer health dashboard:
  - Health score distribution chart
  - At-risk customer list
  - Trend indicators
- Add health score to customer/deal views
- Create alert center UI

### QA / Validation
- Simulate declining customer → alerts fire correctly
- Verify alerts don't spam (deduplication working)
- Confirm dashboard loads quickly with 100+ customers

---

## Week 5 (Mar 10–16): Enterprise RBAC

### Outcome by Friday
- Role-based access control fully implemented
- Four roles: Admin, Manager, Member, Viewer
- All resources protected by permissions

### Backend (Node.js) — Tasks

**RBAC System:**
```
src/rbac/
├── roles.ts            # Role definitions
├── permissions.ts      # Permission definitions
├── middleware.ts       # Express/route middleware
├── service.ts          # RBAC service
└── types.ts            # Types
```

**Database:**
```sql
CREATE TABLE roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  permissions JSONB NOT NULL DEFAULT '[]',
  is_system BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  role_id UUID REFERENCES roles(id),
  granted_by UUID,
  granted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  UNIQUE(user_id, role_id)
);

-- Insert default roles
INSERT INTO roles (name, description, permissions, is_system) VALUES
('admin', 'Full system access', '["*"]', true),
('manager', 'Team management + all member permissions',
  '["agents:*", "analytics:*", "meetings:*", "tasks:*", "customers:*", "team:read"]', true),
('member', 'Standard user access',
  '["meetings:own", "tasks:own", "customers:read", "analytics:read"]', true),
('viewer', 'Read-only access',
  '["meetings:read", "tasks:read", "customers:read", "analytics:read"]', true);
```

**Permission Format:**
```typescript
// resource:action or resource:scope
// Examples:
// "agents:create" - can create agents
// "meetings:own" - can access own meetings
// "tasks:*" - full access to tasks
// "*" - superadmin access

function hasPermission(user: User, permission: string): boolean {
  const userPermissions = getUserPermissions(user.id);
  return matchPermission(userPermissions, permission);
}
```

### Frontend — Tasks
- Add role management UI (admin only)
- Show user's role in settings
- Hide/disable UI elements based on permissions
- Add "access denied" handling

### QA / Validation
- Test each role can only access intended resources
- Verify permission inheritance works correctly
- Confirm admin can manage all roles

---

## Week 6 (Mar 17–23): Enterprise SSO + Compliance

### Outcome by Friday
- SSO integration working (at least one provider)
- Audit logs comprehensive
- Data retention policies configurable

### Backend (Node.js) — Tasks

**SSO Integration:**
```
src/sso/
├── saml.ts             # SAML 2.0 handler
├── oauth.ts            # OAuth 2.0 handler
├── providers/          # Provider-specific configs
│   ├── okta.ts
│   ├── azure.ts
│   └── google.ts
└── middleware.ts       # SSO middleware
```

- Implement SAML 2.0 authentication flow
- Implement OAuth 2.0 as fallback
- Support at least Okta or Azure AD for MVP
- Auto-provision users on first SSO login

**Enhanced Audit Logs:**
```sql
CREATE TABLE audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID,
  user_id UUID,
  action TEXT NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id TEXT,
  changes JSONB,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_tenant_time ON audit_logs (tenant_id, created_at DESC);
CREATE INDEX idx_audit_logs_user ON audit_logs (user_id, created_at DESC);
CREATE INDEX idx_audit_logs_resource ON audit_logs (resource_type, resource_id);
```

**Data Retention:**
```typescript
interface RetentionPolicy {
  resourceType: string;
  retentionDays: number;
  archiveFirst: boolean;
  notifyBeforeDelete: boolean;
}

// Default policies
const DEFAULT_POLICIES: RetentionPolicy[] = [
  { resourceType: 'meeting_transcripts', retentionDays: 365, archiveFirst: true, notifyBeforeDelete: true },
  { resourceType: 'audit_logs', retentionDays: 730, archiveFirst: true, notifyBeforeDelete: false },
  { resourceType: 'agent_runs', retentionDays: 90, archiveFirst: false, notifyBeforeDelete: false }
];
```

### Frontend — Tasks
- Add SSO configuration UI (admin)
- Build audit log viewer with filters
- Add data retention settings UI
- Create GDPR data export/delete tools

### QA / Validation
- Complete SSO login flow with test provider
- Verify all actions logged to audit table
- Test data retention job (dry run mode)

---

## Week 7 (Mar 24–30): Advanced Integrations

### Outcome by Friday
- At least one additional CRM connector working
- At least one video platform connector working
- Webhook system deployed

### Backend (Node.js) — Tasks

**Integration Framework:**
```
src/integrations/
├── types.ts            # Integration interfaces
├── registry.ts         # Integration registry
├── webhooks/
│   ├── handler.ts      # Incoming webhook handler
│   ├── sender.ts       # Outgoing webhook sender
│   └── validator.ts    # Payload validation
├── crm/
│   ├── salesforce.ts   # Salesforce connector
│   ├── hubspot.ts      # HubSpot connector
│   └── base.ts         # CRM base class
├── video/
│   ├── zoom.ts         # Zoom connector
│   ├── teams.ts        # MS Teams connector
│   └── base.ts         # Video base class
└── calendar/
    ├── google.ts       # Google Calendar
    ├── outlook.ts      # Outlook Calendar
    └── base.ts         # Calendar base class
```

**Webhook System:**
```sql
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID NOT NULL,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  events TEXT[] NOT NULL,  -- ['meeting.completed', 'task.created', ...]
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  last_triggered_at TIMESTAMPTZ,
  failure_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE webhook_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  webhook_id UUID REFERENCES webhooks(id),
  event TEXT NOT NULL,
  payload JSONB NOT NULL,
  response_status INT,
  response_body TEXT,
  delivered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  success BOOLEAN NOT NULL
);
```

**Integration Priority:**
1. Salesforce CRM (highest enterprise value)
2. Zoom video (most common platform)
3. Google Calendar (scheduling)
4. Webhook system (custom integrations)

### Frontend — Tasks
- Build integrations management page
- Add OAuth flow for each integration
- Create webhook configuration UI
- Show integration status/health

### QA / Validation
- Complete OAuth flow for each connector
- Verify data syncs correctly
- Test webhook delivery and retry logic

---

## Week 8 (Mar 31–Apr 7): Stabilize + Ship

### Outcome by Release Day
- Production ready with 99.9% uptime architecture
- Security review passed
- Documentation complete
- All Phase 3 features working

### Backend (Node.js) — Tasks

**Performance:**
- Add caching layer (Redis) for frequent queries
- Optimize database queries (explain analyze)
- Add connection pooling
- Implement query result caching

**Reliability:**
- Add circuit breakers for external services
- Implement graceful degradation
- Add health check endpoints
- Set up monitoring and alerting

**Security Review:**
- Run OWASP security scan
- Review authentication flows
- Audit data encryption (at rest and in transit)
- Review RBAC implementation
- Check for SQL injection, XSS vulnerabilities

### Frontend — Tasks
- Performance optimization (bundle size, lazy loading)
- Error boundary implementation
- Loading state polish
- Accessibility review (WCAG 2.1 AA)

### QA / Validation
- Load test: 100+ concurrent users
- Failover test: simulate service outages
- Security penetration test
- End-to-end test suite passes
- Documentation review complete

---

## Phase 3 Release Checklist

### Pre-Release (2 days before)
- [ ] All tests passing
- [ ] Security review complete
- [ ] Performance benchmarks met
- [ ] Documentation updated
- [ ] Changelog written
- [ ] Rollback plan documented

### Release Day
- [ ] Database migrations applied
- [ ] Application deployed
- [ ] Health checks passing
- [ ] Smoke tests passing
- [ ] Monitoring active
- [ ] Team on standby

### Post-Release (48 hours)
- [ ] No critical issues
- [ ] Performance metrics normal
- [ ] User feedback collected
- [ ] Known issues documented

---

## Team Cadence

- **Daily standup:** 15 minutes
- **Weekly sign-off:** Friday
- **Security review:** Week 8 (dedicated session)
- **Rule:** Blockers escalated within 24 hours

---

## Next File

Reply: **"Show file 02"** for Real-time Coaching specifications.
