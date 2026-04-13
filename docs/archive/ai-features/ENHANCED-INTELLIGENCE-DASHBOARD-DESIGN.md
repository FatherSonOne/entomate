# Enhanced Intelligence Dashboard - Design Document

**Project:** Entomate AI-Powered Meeting Intelligence Platform
**Feature:** Enhanced Intelligence Dashboard (Tier 1 AI Enhancement)
**Version:** 1.0
**Date:** 2026-01-24
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [User Experience Design](#user-experience-design)
3. [Intelligence Card Specifications](#intelligence-card-specifications)
4. [Technical Architecture](#technical-architecture)
5. [API Contracts](#api-contracts)
6. [Implementation Plan](#implementation-plan)
7. [Success Metrics](#success-metrics)

---

## Executive Summary

### Purpose

Transform Entomate's "Today's Intelligence" from a basic briefing into a **proactive, predictive intelligence dashboard** that surfaces actionable insights before users need to search for them.

### Current State

**Existing Implementation:** [frontend/src/components/TodaysIntelligence.jsx](../frontend/src/components/TodaysIntelligence.jsx)

Current features:
- Basic upcoming meetings list
- Overdue items count
- Recent activity summary
- Static, non-personalized intelligence

### Desired State

**Enhanced Intelligence Dashboard** with 4 AI-powered card types:

1. **Meeting Prep Cards** - Context-rich preparation for upcoming meetings
2. **Deal Risk Alerts** - Proactive identification of at-risk deals
3. **Action Item Tracking** - Follow-up status with completion analytics
4. **Relationship Insights** - Stakeholder intelligence and coverage analysis

### Design Principles

1. **Proactive, Not Reactive** - Surface insights before users search
2. **Actionable** - Every card includes clear next steps
3. **Adaptive UI** - Concise by default, expandable for details
4. **Context-Aware** - Personalized to user's role and priorities
5. **Mobile-First** - Responsive design for on-the-go access

---

## User Experience Design

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────────┐
│  📊 Today's Intelligence                    [⚙ Customize]       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📅 UPCOMING MEETINGS (3)                    [View All →]  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ 📅 Client Call - Acme Corp                 2:00 PM   │ │  │
│  │  │ Last contact: 14 days ago • Deal: $50k in Proposal  │ │  │
│  │  │                                                       │ │  │
│  │  │ 💡 Key Context:                                      │ │  │
│  │  │  • Sentiment declined (Positive → Neutral)          │ │  │
│  │  │  • 2 action items overdue                           │ │  │
│  │  │  • Competitor mentioned: CompetitorX                │ │  │
│  │  │                                                       │ │  │
│  │  │ 📋 Suggested Talking Points:                         │ │  │
│  │  │  • Follow up on Q4 pricing concerns                 │ │  │
│  │  │  • Address competitive comparison                   │ │  │
│  │  │  • Discuss implementation timeline                  │ │  │
│  │  │                                                       │ │  │
│  │  │ [Prepare Brief] [Reschedule] [Show More ▼]          │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 🚨 DEAL RISK ALERTS (3)                     [View All →]  │  │
│  │                                                            │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Acme Corp - $50k                    Risk: 67/100 🟡  │ │  │
│  │  │                                                       │ │  │
│  │  │ Risk Factors:                                        │ │  │
│  │  │  🔴 No contact in 21 days (High Impact)              │ │  │
│  │  │  🟡 Sentiment trend: Positive → Neutral → Neutral   │ │  │
│  │  │  🟡 2 overdue action items                           │ │  │
│  │  │  🟢 Engagement velocity down 40%                     │ │  │
│  │  │                                                       │ │  │
│  │  │ 💡 Recommended Actions:                              │ │  │
│  │  │  1. Schedule check-in call this week                │ │  │
│  │  │  2. Send value-add content (case study)             │ │  │
│  │  │  3. Engage additional stakeholders                  │ │  │
│  │  │                                                       │ │  │
│  │  │ [Schedule Call] [Create Task] [Show Details ▼]      │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 📋 ACTION ITEM STATUS                      [View All →]   │  │
│  │                                                            │  │
│  │  From Last Week's Meetings:                              │  │
│  │  ┌────────────────┬──────────────────────────────────┐   │  │
│  │  │ ✅ Completed   │ ████████████░░░░░░  12/18 (67%) │   │  │
│  │  │ ⚠ Overdue      │ ███░░░░░░░░░░░░░░░   4 items    │   │  │
│  │  │ 🚫 Blocked     │ ██░░░░░░░░░░░░░░░░   2 items    │   │  │
│  │  └────────────────┴──────────────────────────────────┘   │  │
│  │                                                            │  │
│  │  ⚠ Critical Overdue:                                      │  │
│  │  • "Send proposal to Acme Corp" - 5 days overdue          │  │
│  │    Assigned: John Doe | Blocking: "Schedule demo"        │  │
│  │    [Nudge John] [Reassign] [Mark Complete]               │  │
│  │                                                            │  │
│  │  • "Get legal approval for contract" - 3 days overdue    │  │
│  │    Assigned: Legal Team | Blocking: "Sign contract"      │  │
│  │    [Follow Up] [Escalate]                                 │  │
│  │                                                            │  │
│  │  [Show All Overdue] [Show Blocking Chain ▼]              │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
│  ┌───────────────────────────────────────────────────────────┐  │
│  │ 👥 RELATIONSHIP INSIGHTS                   [View All →]   │  │
│  │                                                            │  │
│  │  🆕 New Champion Identified:                              │  │
│  │  ┌──────────────────────────────────────────────────────┐ │  │
│  │  │ Sarah Chen - CTO, Acme Corp           Influence: ⭐⭐⭐⭐⭐│ │  │
│  │  │                                                       │ │  │
│  │  │ Signals:                                              │ │  │
│  │  │  • Mentioned 8 times in last meeting                 │ │  │
│  │  │  • Sentiment: Positive (92%)                         │ │  │
│  │  │  • Key decision maker for technical stack            │ │  │
│  │  │  • Influences: Mike Johnson (CEO), Tom Lee (VP Eng)  │ │  │
│  │  │                                                       │ │  │
│  │  │ 💡 Next Steps:                                        │ │  │
│  │  │  • Build relationship: Schedule 1:1 technical deep dive│ │  │
│  │  │  • Share technical case studies                      │ │  │
│  │  │                                                       │ │  │
│  │  │ [Add to CRM] [Schedule Meeting] [Show More ▼]        │ │  │
│  │  └──────────────────────────────────────────────────────┘ │  │
│  │                                                            │  │
│  │  ⚠ Coverage Gaps Detected:                                │  │
│  │  • No CFO involvement - Budget approval may be at risk   │  │
│  │  • Economic buyer not identified                         │  │
│  │    [Get Introduction] [Learn More]                        │  │
│  └────────────────────────────────────────────────────────────┘  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Interaction Patterns

#### 1. Adaptive Expansion (User Selected)

**Default State (Concise):**
```
┌─────────────────────────────────────────────────┐
│ Acme Corp - $50k          Risk: 67/100 🟡      │
│                                                 │
│ Top Risk Factors:                               │
│  🔴 No contact in 21 days                       │
│  🟡 Sentiment declined                          │
│  🟡 2 overdue action items                      │
│                                                 │
│ [Schedule Call] [Show Details ▼]               │
└─────────────────────────────────────────────────┘
```

**Expanded State (On Click "Show Details"):**
```
┌─────────────────────────────────────────────────┐
│ Acme Corp - $50k          Risk: 67/100 🟡      │
│                                                 │
│ All Risk Factors (Weighted):                    │
│  🔴 Engagement Velocity (35% weight): 45/100    │
│     - Meeting frequency down 60% (last 30d)    │
│     - Email response time: 2d avg (was 4h)     │
│                                                 │
│  🟡 Sentiment Trend (25% weight): 60/100        │
│     - Jan 20: Positive (85%)                   │
│     - Jan 15: Neutral (62%)                    │
│     - Jan 10: Neutral (58%)                    │
│                                                 │
│  🟡 Action Items (20% weight): 55/100           │
│     - 2 overdue (Send proposal, Legal review)  │
│     - Completion rate: 60% (team avg: 85%)     │
│                                                 │
│  🟢 Stakeholder Health (20% weight): 75/100     │
│     - Champion: Strong (Sarah Chen engaged)    │
│     - Coverage: Medium (missing CFO)           │
│                                                 │
│ Predictions:                                    │
│  • Churn risk: 35% in next 90 days             │
│  • Close probability: 52%                      │
│  • Expected close: March 15, 2026              │
│  • Confidence: 74%                             │
│                                                 │
│ [Schedule Call] [Create Recovery Plan]         │
│ [Hide Details ▲]                                │
└─────────────────────────────────────────────────┘
```

#### 2. Personalization & Filtering

```
┌─────────────────────────────────────────────────┐
│ ⚙ Customize Intelligence Dashboard             │
├─────────────────────────────────────────────────┤
│                                                 │
│ Show Cards:                                     │
│  ☑ Meeting Prep (3 upcoming)                   │
│  ☑ Deal Risk Alerts (Show only: Medium/High)  │
│  ☑ Action Item Tracking (My items only)        │
│  ☑ Relationship Insights (New only)            │
│                                                 │
│ Priority:                                       │
│  ○ All Deals                                   │
│  ⦿ My Deals Only                               │
│  ○ My Team's Deals                             │
│                                                 │
│ Time Horizon:                                   │
│  Meetings: [Next 24 hours ▼]                   │
│  Risks: [Next 7 days ▼]                        │
│                                                 │
│ [Save Preferences] [Reset to Default]          │
└─────────────────────────────────────────────────┘
```

#### 3. Quick Actions

Every intelligence card includes **contextual quick actions**:

**Meeting Prep:**
- `[Prepare Brief]` → Generates AI meeting brief document
- `[Reschedule]` → Opens calendar integration
- `[Add Attendee]` → CRM contact picker

**Deal Risk:**
- `[Schedule Call]` → Calendar integration pre-filled
- `[Create Task]` → Task creation with context
- `[Create Recovery Plan]` → Multi-step workflow automation

**Action Items:**
- `[Nudge Owner]` → Sends reminder via Slack/Pulse
- `[Reassign]` → Opens assignment dialog
- `[Mark Complete]` → Direct completion

**Relationships:**
- `[Add to CRM]` → Syncs stakeholder to Logos Vision
- `[Schedule Meeting]` → Calendar integration
- `[Get Introduction]` → Creates task for introduction request

---

## Intelligence Card Specifications

### 1. Meeting Prep Cards

#### Purpose
Provide comprehensive context for upcoming meetings to maximize preparedness and meeting effectiveness.

#### Data Requirements

**Primary Data:**
- Meeting details (title, time, attendees, location/link)
- CRM deal association (if applicable)
- Last interaction date
- Deal status and value

**AI-Generated Insights:**
- Sentiment trend analysis
- Outstanding action items
- Competitor mentions from past meetings
- Relationship changes
- Suggested talking points (AI-generated)

#### Intelligence Signals

| Signal | Source | Calculation |
|--------|--------|-------------|
| Last Contact | Meeting history | Days since last meeting with this contact/company |
| Deal Status | CRM integration | Current stage, value, probability |
| Sentiment Trend | Meeting summaries | Sentiment trajectory (last 3 meetings) |
| Overdue Items | Tasks/action items | Count of overdue items related to this meeting |
| Competitor Mentions | Meeting transcripts | Named entity recognition for competitors |
| Talking Points | AI generation | Based on: past discussions, deal stage, overdue items, relationship status |

#### UI Components

**Compact View:**
```jsx
<MeetingPrepCard
  meeting={{
    title: "Client Call - Acme Corp",
    time: "2:00 PM",
    attendees: ["John Smith", "Sarah Chen"],
    dealValue: "$50k",
    dealStage: "Proposal"
  }}
  context={{
    lastContact: "14 days ago",
    sentimentTrend: "declining", // "improving" | "stable" | "declining"
    overdueItems: 2,
    competitors: ["CompetitorX"]
  }}
  talkingPoints={[
    "Follow up on Q4 pricing concerns",
    "Address competitive comparison",
    "Discuss implementation timeline"
  ]}
  actions={[
    { label: "Prepare Brief", handler: generateBrief },
    { label: "Reschedule", handler: openCalendar },
    { label: "Show More", handler: expand }
  ]}
/>
```

**Expanded View Additions:**
- Full attendee list with roles and influence scores
- Complete meeting history timeline
- Related deals and projects
- Document attachments from past meetings
- AI-generated meeting brief (full document)

#### API Requirements

**Endpoint:** `GET /api/intelligence/meeting-prep/:meetingId`

**Response:**
```typescript
interface MeetingPrepIntelligence {
  meeting: {
    id: string;
    title: string;
    scheduledAt: string; // ISO 8601
    attendees: Attendee[];
    location?: string;
    meetingLink?: string;
  };
  dealContext?: {
    id: string;
    name: string;
    value: number;
    stage: string;
    probability: number;
  };
  history: {
    lastContactDate: string;
    meetingCount: number;
    daysSinceLastContact: number;
  };
  sentiment: {
    current: "positive" | "neutral" | "negative";
    trend: "improving" | "stable" | "declining";
    history: Array<{
      date: string;
      sentiment: string;
      score: number; // 0-100
    }>;
  };
  actionItems: {
    total: number;
    overdue: number;
    items: Array<{
      id: string;
      task: string;
      owner: string;
      dueDate: string;
      status: string;
    }>;
  };
  insights: {
    competitorMentions: string[];
    keyTopics: string[];
    relationshipChanges: string[];
  };
  talkingPoints: string[];
  briefDocument?: string; // AI-generated full brief
}
```

---

### 2. Deal Risk Alerts

#### Purpose
Proactively identify at-risk deals using AI-powered risk scoring and provide actionable recovery recommendations.

#### Data Requirements

**Primary Data:**
- Deal information (value, stage, expected close date)
- Engagement history (meetings, emails, calls)
- Action item completion rates
- Stakeholder engagement levels

**AI-Generated Insights:**
- Risk score (0-100)
- Risk factors with weighted impact
- Trend analysis
- Predictive analytics (churn probability, close probability)
- Recommended recovery actions

#### Risk Scoring Algorithm

```javascript
// Weighted Risk Score Calculation
function calculateDealRiskScore(deal) {
  const factors = {
    engagementVelocity: {
      weight: 0.35,
      score: calculateEngagementScore(deal),
      impact: getImpactLevel(score)
    },
    sentimentTrend: {
      weight: 0.25,
      score: calculateSentimentScore(deal),
      impact: getImpactLevel(score)
    },
    actionItemHealth: {
      weight: 0.20,
      score: calculateActionItemScore(deal),
      impact: getImpactLevel(score)
    },
    stakeholderHealth: {
      weight: 0.20,
      score: calculateStakeholderScore(deal),
      impact: getImpactLevel(score)
    }
  };

  // Weighted average
  const totalScore = Object.values(factors).reduce(
    (sum, factor) => sum + (factor.score * factor.weight),
    0
  );

  return {
    score: Math.round(totalScore),
    risk: getRiskLevel(totalScore), // "low" | "medium" | "high"
    factors: factors
  };
}

function calculateEngagementScore(deal) {
  const currentFrequency = getMeetingFrequency(deal, 30); // last 30 days
  const historicalAvg = getHistoricalAverage(deal);
  const velocityChange = (currentFrequency - historicalAvg) / historicalAvg;

  // Score: 100 = no drop, 0 = 100% drop
  return Math.max(0, 100 + (velocityChange * 100));
}

function calculateSentimentScore(deal) {
  const recentSentiments = getRecentSentiments(deal, 3); // last 3 meetings
  const trend = calculateTrend(recentSentiments);
  const currentSentiment = recentSentiments[0].score;

  // Combine current sentiment and trend
  return (currentSentiment * 0.7) + (trend * 0.3);
}
```

#### Risk Levels & Thresholds

| Risk Level | Score Range | Color | Action |
|------------|-------------|-------|--------|
| Low | 75-100 | 🟢 Green | Monitor |
| Medium | 50-74 | 🟡 Yellow | Proactive outreach |
| High | 25-49 | 🟠 Orange | Recovery plan required |
| Critical | 0-24 | 🔴 Red | Immediate escalation |

#### Predictive Analytics

```typescript
interface DealPredictions {
  churnRisk: number;        // 0-1 probability of churn in next 90 days
  closeProbability: number; // 0-1 probability of successful close
  expectedCloseDate: string; // ISO 8601
  confidence: number;       // 0-1 confidence in predictions
  riskFactors: string[];    // Primary risk drivers
}
```

**Prediction Model Inputs:**
- Engagement velocity (meetings/week)
- Sentiment trajectory (improving/declining)
- Action item completion rate
- Stakeholder coverage (multi-threading)
- Deal age vs. average sales cycle
- Competitive pressure
- Budget confirmation status

#### Recommended Actions

AI-generated action recommendations based on risk factors:

**High Engagement Risk:**
- Schedule check-in call within 48 hours
- Send value-add content (case study, ROI calculator)
- Engage additional stakeholders

**High Sentiment Risk:**
- Address specific concerns raised in last meeting
- Executive involvement (bring in VP/C-level)
- Customer success story share

**High Action Item Risk:**
- Nudge owners of overdue items
- Offer to help unblock
- Escalate if blocking deal progress

**High Stakeholder Risk:**
- Map stakeholder coverage gaps
- Request introductions to missing personas
- Multi-thread across organization

#### API Requirements

**Endpoint:** `GET /api/intelligence/deal-risks`

**Query Parameters:**
- `riskLevel`: "medium,high,critical" (filter)
- `ownerId`: user ID (filter to user's deals)
- `limit`: number of results (default: 10)

**Response:**
```typescript
interface DealRiskAlert {
  deal: {
    id: string;
    name: string;
    value: number;
    stage: string;
    expectedCloseDate: string;
    owner: string;
  };
  riskScore: {
    score: number; // 0-100
    level: "low" | "medium" | "high" | "critical";
    trend: "improving" | "stable" | "worsening";
  };
  riskFactors: Array<{
    factor: string;
    weight: number;
    score: number;
    impact: "low" | "medium" | "high";
    detail: string;
  }>;
  predictions: {
    churnRisk: number;
    closeProbability: number;
    expectedCloseDate: string;
    confidence: number;
  };
  recommendedActions: Array<{
    action: string;
    priority: "low" | "medium" | "high";
    effort: "low" | "medium" | "high";
  }>;
  lastUpdated: string; // ISO 8601
}
```

---

### 3. Action Item Tracking

#### Purpose
Provide visibility into action item completion, identify blockers, and drive accountability through intelligent nudges.

#### Data Requirements

**Primary Data:**
- Action items from meetings (extracted via AI)
- Task completion status
- Assignments and due dates
- Dependency relationships

**AI-Generated Insights:**
- Completion rate trends
- Blocking relationship detection
- At-risk items (likely to miss deadline)
- Team performance benchmarks

#### Metrics Displayed

**Aggregate Metrics:**
```
From Last Week's Meetings:
  ✅ Completed:   12/18 (67%)
  ⏰ In Progress:  2/18 (11%)
  ⚠ Overdue:      4/18 (22%)
  🚫 Blocked:      2/18 (11%)
```

**Trends:**
```
Week-over-Week:
  Completion Rate: 67% (↓ 8% from last week)
  Avg Time to Complete: 3.2 days (↑ 0.5 days)
```

**Team Benchmarks:**
```
Your Completion Rate: 67%
Team Average: 82%
Top Performer: Jane Smith (95%)
```

#### Blocking Chain Detection

AI detects dependency relationships from natural language:

**Example:**
```
Action Item 1: "Send proposal to Acme Corp"
  Status: Overdue (5 days)
  Blocks: "Schedule demo" (can't demo without proposal)

Action Item 2: "Get legal approval for contract"
  Status: Overdue (3 days)
  Blocks: "Sign contract" → "Onboard customer" → "Start implementation"
```

**Visualization:**
```
Send proposal (⚠ 5d overdue)
    ↓ blocks
Schedule demo (⏸ waiting)


Get legal approval (⚠ 3d overdue)
    ↓ blocks
Sign contract (⏸ waiting)
    ↓ blocks
Onboard customer (⏸ waiting)
    ↓ blocks
Start implementation (⏸ waiting)
```

#### Intelligent Nudges

**Nudge Logic:**
```javascript
function shouldNudge(actionItem) {
  const rules = [
    {
      condition: actionItem.daysOverdue >= 3,
      nudgeType: "overdue_reminder",
      recipient: actionItem.owner,
      message: "This item is 3 days overdue"
    },
    {
      condition: actionItem.isBlocking && actionItem.daysOverdue >= 1,
      nudgeType: "blocking_alert",
      recipient: actionItem.owner,
      message: "This item is blocking 2 other tasks"
    },
    {
      condition: actionItem.daysUntilDue === 1 && actionItem.status === "todo",
      nudgeType: "due_tomorrow",
      recipient: actionItem.owner,
      message: "Due tomorrow - need help?"
    },
    {
      condition: actionItem.meetingInNextHour && actionItem.status !== "done",
      nudgeType: "meeting_prep",
      recipient: actionItem.owner,
      message: "Upcoming meeting - complete this first?"
    }
  ];

  return rules.find(rule => rule.condition);
}
```

**Nudge Channels:**
- In-app notification
- Slack/Pulse message
- Email (configurable threshold)

#### API Requirements

**Endpoint:** `GET /api/intelligence/action-items`

**Response:**
```typescript
interface ActionItemIntelligence {
  summary: {
    total: number;
    completed: number;
    inProgress: number;
    overdue: number;
    blocked: number;
    completionRate: number; // 0-1
  };
  trends: {
    weekOverWeek: {
      completionRate: number; // delta
      avgTimeToComplete: number; // delta in days
    };
  };
  benchmarks: {
    userCompletionRate: number;
    teamAverage: number;
    topPerformer: {
      name: string;
      rate: number;
    };
  };
  criticalOverdue: Array<{
    id: string;
    task: string;
    owner: string;
    assignedTo: string;
    dueDate: string;
    daysOverdue: number;
    isBlocking: boolean;
    blockedTasks: string[];
    relatedDeal?: {
      id: string;
      name: string;
      value: number;
    };
  }>;
  blockingChains: Array<{
    rootTask: string;
    chainLength: number;
    totalBlocked: number;
    nodes: Array<{
      task: string;
      status: string;
      owner: string;
    }>;
  }>;
}
```

---

### 4. Relationship Insights

#### Purpose
Surface stakeholder intelligence to improve relationship coverage, identify champions, and detect coverage gaps.

#### Data Requirements

**Primary Data:**
- Contact information from CRM
- Meeting participation history
- Mentions in meeting transcripts
- Sentiment toward each stakeholder

**AI-Generated Insights:**
- Role classification (champion, influencer, blocker, unknown)
- Influence score (0-100)
- Relationship strength
- Coverage gap analysis

#### Stakeholder Role Detection

**AI Classification Logic:**
```javascript
function classifyStakeholderRole(stakeholder, meetings) {
  const signals = {
    mentionFrequency: countMentions(stakeholder, meetings),
    sentiment: avgSentiment(stakeholder, meetings),
    meetingParticipation: participationRate(stakeholder, meetings),
    decisionMaking: detectDecisionMaking(stakeholder, meetings),
    advocacy: detectAdvocacy(stakeholder, meetings)
  };

  // Champion: High mentions, positive sentiment, advocates for solution
  if (signals.advocacy > 0.7 && signals.sentiment > 0.7) {
    return "champion";
  }

  // Influencer: Participates often, influences decisions
  if (signals.decisionMaking > 0.6 && signals.mentionFrequency > 5) {
    return "influencer";
  }

  // Blocker: Negative sentiment, decision-making power
  if (signals.sentiment < 0.4 && signals.decisionMaking > 0.5) {
    return "blocker";
  }

  // Economic Buyer: Budget approval signals
  if (detectBudgetAuthority(stakeholder, meetings)) {
    return "economic_buyer";
  }

  return "unknown";
}
```

#### Influence Score Calculation

```javascript
function calculateInfluenceScore(stakeholder, meetings) {
  const factors = {
    title: getTitleScore(stakeholder.title), // C-level = 100, VP = 80, etc.
    decisionMaking: detectDecisionMaking(stakeholder, meetings) * 100,
    networkSize: estimateNetworkSize(stakeholder, meetings),
    mentionFrequency: Math.min(countMentions(stakeholder, meetings) * 10, 100)
  };

  // Weighted average
  return (
    factors.title * 0.3 +
    factors.decisionMaking * 0.4 +
    factors.networkSize * 0.2 +
    factors.mentionFrequency * 0.1
  );
}
```

#### Coverage Gap Analysis

**Personas to Track:**
- Executive Sponsor (C-level champion)
- Economic Buyer (budget authority)
- Technical Champion (implementation advocate)
- End User Representative
- Legal/Procurement (deal execution)

**Gap Detection:**
```typescript
interface CoverageGap {
  missingPersona: string;
  importance: "critical" | "high" | "medium" | "low";
  risk: string; // What could go wrong
  recommendation: string; // How to fill gap
}

// Example gaps:
{
  missingPersona: "CFO / Economic Buyer",
  importance: "critical",
  risk: "Budget approval may be delayed or denied",
  recommendation: "Request introduction from current champion (Sarah Chen)"
}
```

#### Champion Health Score

```javascript
function calculateChampionHealth(champion, meetings) {
  const factors = {
    engagementRecency: daysSinceLastContact(champion),
    sentimentTrend: getSentimentTrend(champion, meetings),
    advocacyLevel: detectAdvocacy(champion, meetings),
    influence: champion.influenceScore
  };

  // Red flags:
  // - No contact in 14+ days
  // - Sentiment declining
  // - Reduced advocacy
  // - Influence decreasing

  let healthScore = 100;
  if (factors.engagementRecency > 14) healthScore -= 30;
  if (factors.sentimentTrend === "declining") healthScore -= 25;
  if (factors.advocacyLevel < 0.5) healthScore -= 25;
  if (factors.influence < 70) healthScore -= 20;

  return {
    score: Math.max(0, healthScore),
    status: healthScore > 70 ? "healthy" : healthScore > 40 ? "at_risk" : "critical",
    redFlags: getRedFlags(factors)
  };
}
```

#### API Requirements

**Endpoint:** `GET /api/intelligence/relationships/:dealId`

**Response:**
```typescript
interface RelationshipIntelligence {
  deal: {
    id: string;
    name: string;
  };
  stakeholders: Array<{
    id: string;
    name: string;
    title: string;
    company: string;
    role: "champion" | "influencer" | "blocker" | "economic_buyer" | "unknown";
    influenceScore: number; // 0-100
    relationshipStrength: {
      score: number; // 0-100
      trend: "growing" | "stable" | "declining";
    };
    engagement: {
      meetingCount: number;
      lastContactDate: string;
      daysSinceLastContact: number;
      mentionFrequency: number;
    };
    sentiment: {
      current: "positive" | "neutral" | "negative";
      score: number; // 0-100
      trend: "improving" | "stable" | "declining";
    };
    influences: string[]; // IDs of other stakeholders they influence
  }>;
  coverage: {
    hasChampion: boolean;
    hasEconomicBuyer: boolean;
    multiThreaded: boolean; // 3+ stakeholders engaged
    coverageScore: number; // 0-100
    gaps: CoverageGap[];
  };
  insights: {
    newChampions: Array<{
      stakeholder: string;
      detectedOn: string;
      signals: string[];
    }>;
    atRiskChampions: Array<{
      stakeholder: string;
      healthScore: number;
      redFlags: string[];
    }>;
    recommendations: string[];
  };
}
```

---

## Technical Architecture

### Backend Architecture

#### New Service Layer

**File:** `backend/services/intelligenceService.js` (Enhanced)

```javascript
class IntelligenceService {
  constructor() {
    this.meetingPrepService = new MeetingPrepService();
    this.dealRiskService = new DealRiskService();
    this.actionItemService = new ActionItemTrackerService();
    this.relationshipService = new RelationshipIntelligenceService();
  }

  /**
   * Get comprehensive intelligence dashboard for user
   * @param {string} userId - User ID
   * @param {Object} options - Filters and preferences
   */
  async getDashboardIntelligence(userId, options = {}) {
    // Fetch all intelligence cards in parallel
    const [meetingPrep, dealRisks, actionItems, relationships] =
      await Promise.all([
        this.meetingPrepService.getUpcomingMeetingPrep(userId, options),
        this.dealRiskService.getAtRiskDeals(userId, options),
        this.actionItemService.getActionItemStatus(userId, options),
        this.relationshipService.getRelationshipInsights(userId, options)
      ]);

    return {
      meetingPrep: {
        cards: meetingPrep,
        count: meetingPrep.length
      },
      dealRisks: {
        cards: dealRisks,
        count: dealRisks.length
      },
      actionItems: {
        summary: actionItems.summary,
        criticalItems: actionItems.criticalOverdue
      },
      relationships: {
        insights: relationships.insights,
        count: relationships.insights.length
      },
      lastUpdated: new Date().toISOString()
    };
  }
}

module.exports = new IntelligenceService();
```

#### Service Breakdown

**1. MeetingPrepService**
- `getUpcomingMeetingPrep(userId, options)` - Fetch upcoming meetings with context
- `generateTalkingPoints(meetingId)` - AI-generated talking points
- `generateMeetingBrief(meetingId)` - Full AI brief document

**2. DealRiskService**
- `getAtRiskDeals(userId, options)` - Calculate risk scores for all deals
- `calculateRiskScore(dealId)` - Detailed risk scoring algorithm
- `getPredictiveAnalytics(dealId)` - Churn/close predictions
- `getRecommendedActions(dealId, riskFactors)` - AI action recommendations

**3. ActionItemTrackerService**
- `getActionItemStatus(userId, options)` - Aggregate metrics
- `detectBlockingChains()` - Dependency analysis
- `getIntelligentNudges(userId)` - Nudge recommendations
- `sendNudge(actionItemId, channel)` - Execute nudge

**4. RelationshipIntelligenceService**
- `getRelationshipInsights(dealId)` - Stakeholder intelligence
- `classifyStakeholderRole(stakeholderId, dealId)` - Role detection
- `calculateInfluenceScore(stakeholderId)` - Influence scoring
- `detectCoverageGaps(dealId)` - Gap analysis
- `getChampionHealth(stakeholderId, dealId)` - Champion health

### Frontend Architecture

#### Component Structure

```
frontend/src/
├── components/
│   ├── intelligence/
│   │   ├── IntelligenceDashboard.jsx         # Main dashboard container
│   │   ├── MeetingPrepCard.jsx               # Meeting prep card
│   │   ├── DealRiskAlertCard.jsx             # Deal risk card
│   │   ├── ActionItemStatusCard.jsx          # Action item card
│   │   ├── RelationshipInsightCard.jsx       # Relationship card
│   │   ├── ExpandableCard.jsx                # Reusable adaptive expansion
│   │   ├── RiskScoreBadge.jsx                # Risk score visualization
│   │   ├── SentimentTrend.jsx                # Sentiment chart
│   │   └── BlockingChainVisualizer.jsx       # Dependency graph
│   └── TodaysIntelligence.jsx                # Legacy (to be replaced)
└── services/
    └── api.js                                 # API client (add intelligence endpoints)
```

#### Main Dashboard Component

**File:** `frontend/src/components/intelligence/IntelligenceDashboard.jsx`

```jsx
import React, { useState, useEffect } from 'react';
import api from '../../services/api';
import MeetingPrepCard from './MeetingPrepCard';
import DealRiskAlertCard from './DealRiskAlertCard';
import ActionItemStatusCard from './ActionItemStatusCard';
import RelationshipInsightCard from './RelationshipInsightCard';

export default function IntelligenceDashboard() {
  const [intelligence, setIntelligence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [preferences, setPreferences] = useState({
    showMeetingPrep: true,
    showDealRisks: true,
    showActionItems: true,
    showRelationships: true,
    dealRiskFilter: ['medium', 'high', 'critical'],
    timeHorizon: {
      meetings: 24, // hours
      risks: 7      // days
    }
  });

  useEffect(() => {
    loadIntelligence();

    // Refresh every 5 minutes
    const interval = setInterval(loadIntelligence, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [preferences]);

  const loadIntelligence = async () => {
    try {
      setLoading(true);
      const response = await api.intelligence.getDashboard(preferences);
      setIntelligence(response.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  if (loading && !intelligence) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorState error={error} retry={loadIntelligence} />;
  }

  return (
    <div className="intelligence-dashboard">
      <div className="dashboard-header">
        <h1>📊 Today's Intelligence</h1>
        <button onClick={() => setShowCustomize(true)}>
          ⚙ Customize
        </button>
      </div>

      <div className="intelligence-cards">
        {/* Meeting Prep Cards */}
        {preferences.showMeetingPrep && intelligence.meetingPrep.count > 0 && (
          <section className="card-section">
            <h2>📅 Upcoming Meetings ({intelligence.meetingPrep.count})</h2>
            {intelligence.meetingPrep.cards.map(meeting => (
              <MeetingPrepCard
                key={meeting.meeting.id}
                data={meeting}
                onAction={handleMeetingAction}
              />
            ))}
          </section>
        )}

        {/* Deal Risk Alerts */}
        {preferences.showDealRisks && intelligence.dealRisks.count > 0 && (
          <section className="card-section">
            <h2>🚨 Deal Risk Alerts ({intelligence.dealRisks.count})</h2>
            {intelligence.dealRisks.cards.map(risk => (
              <DealRiskAlertCard
                key={risk.deal.id}
                data={risk}
                onAction={handleRiskAction}
              />
            ))}
          </section>
        )}

        {/* Action Item Status */}
        {preferences.showActionItems && (
          <section className="card-section">
            <h2>📋 Action Item Status</h2>
            <ActionItemStatusCard
              data={intelligence.actionItems}
              onAction={handleActionItemAction}
            />
          </section>
        )}

        {/* Relationship Insights */}
        {preferences.showRelationships && intelligence.relationships.count > 0 && (
          <section className="card-section">
            <h2>👥 Relationship Insights</h2>
            {intelligence.relationships.insights.map(insight => (
              <RelationshipInsightCard
                key={insight.id}
                data={insight}
                onAction={handleRelationshipAction}
              />
            ))}
          </section>
        )}
      </div>

      {showCustomize && (
        <CustomizationModal
          preferences={preferences}
          onSave={setPreferences}
          onClose={() => setShowCustomize(false)}
        />
      )}
    </div>
  );
}
```

#### Adaptive Card Component

**File:** `frontend/src/components/intelligence/ExpandableCard.jsx`

```jsx
import React, { useState } from 'react';

export default function ExpandableCard({
  title,
  compactContent,
  expandedContent,
  actions
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className={`expandable-card ${expanded ? 'expanded' : ''}`}>
      <div className="card-header">
        <h3>{title}</h3>
      </div>

      <div className="card-content">
        {compactContent}

        {expanded && (
          <div className="expanded-content">
            {expandedContent}
          </div>
        )}
      </div>

      <div className="card-actions">
        {actions.map((action, index) => (
          <button
            key={index}
            onClick={action.handler}
            className={`action-btn ${action.primary ? 'primary' : 'secondary'}`}
          >
            {action.label}
          </button>
        ))}

        <button
          onClick={() => setExpanded(!expanded)}
          className="expand-toggle"
        >
          {expanded ? 'Hide Details ▲' : 'Show Details ▼'}
        </button>
      </div>
    </div>
  );
}
```

### API Endpoints

**Route:** `backend/routes/intelligence.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, rateLimit } = require('../middleware');
const intelligenceService = require('../services/intelligenceService');

// Get comprehensive dashboard intelligence
router.get(
  '/dashboard',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const options = {
        dealRiskFilter: req.query.riskFilter?.split(',') || ['medium', 'high', 'critical'],
        timeHorizon: {
          meetings: parseInt(req.query.meetingHours) || 24,
          risks: parseInt(req.query.riskDays) || 7
        }
      };

      const intelligence = await intelligenceService.getDashboardIntelligence(userId, options);
      res.json({ success: true, data: intelligence });
    } catch (error) {
      console.error('[Intelligence] Dashboard error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get meeting prep for specific meeting
router.get(
  '/meeting-prep/:meetingId',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { meetingId } = req.params;
      const prep = await intelligenceService.meetingPrepService
        .getMeetingPrep(meetingId);
      res.json({ success: true, data: prep });
    } catch (error) {
      console.error('[Intelligence] Meeting prep error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Generate meeting brief (AI)
router.post(
  '/meeting-prep/:meetingId/brief',
  authenticateToken,
  rateLimit('ai'),
  async (req, res) => {
    try {
      const { meetingId } = req.params;
      const brief = await intelligenceService.meetingPrepService
        .generateMeetingBrief(meetingId);
      res.json({ success: true, data: brief });
    } catch (error) {
      console.error('[Intelligence] Brief generation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get deal risk analysis
router.get(
  '/deal-risks',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const options = {
        riskLevel: req.query.riskLevel?.split(','),
        limit: parseInt(req.query.limit) || 10
      };

      const risks = await intelligenceService.dealRiskService
        .getAtRiskDeals(userId, options);
      res.json({ success: true, data: risks });
    } catch (error) {
      console.error('[Intelligence] Deal risks error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get action item status
router.get(
  '/action-items',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const status = await intelligenceService.actionItemService
        .getActionItemStatus(userId);
      res.json({ success: true, data: status });
    } catch (error) {
      console.error('[Intelligence] Action items error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Send nudge for action item
router.post(
  '/action-items/:itemId/nudge',
  authenticateToken,
  rateLimit('strict'),
  async (req, res) => {
    try {
      const { itemId } = req.params;
      const { channel } = req.body; // 'slack' | 'email' | 'in_app'

      await intelligenceService.actionItemService
        .sendNudge(itemId, channel);
      res.json({ success: true });
    } catch (error) {
      console.error('[Intelligence] Nudge error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get relationship insights for deal
router.get(
  '/relationships/:dealId',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { dealId } = req.params;
      const insights = await intelligenceService.relationshipService
        .getRelationshipInsights(dealId);
      res.json({ success: true, data: insights });
    } catch (error) {
      console.error('[Intelligence] Relationships error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
```

### Database Schema Requirements

**New Tables:**

```sql
-- ========================================
-- Intelligence Dashboard Schema
-- ========================================

-- Deal risk scores (cached for performance)
CREATE TABLE deal_risk_scores (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  deal_id UUID NOT NULL REFERENCES deals(id) ON DELETE CASCADE,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  risk_level TEXT NOT NULL CHECK (risk_level IN ('low', 'medium', 'high', 'critical')),
  factors JSONB NOT NULL, -- Risk factor breakdown
  predictions JSONB, -- Churn/close predictions
  recommended_actions JSONB, -- AI-generated actions
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_deal_risk_scores_deal ON deal_risk_scores(deal_id);
CREATE INDEX idx_deal_risk_scores_level ON deal_risk_scores(risk_level);
CREATE INDEX idx_deal_risk_scores_calculated ON deal_risk_scores(calculated_at);

-- Stakeholder intelligence
CREATE TABLE stakeholder_intelligence (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  stakeholder_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
  deal_id UUID REFERENCES deals(id) ON DELETE CASCADE,
  role TEXT CHECK (role IN ('champion', 'influencer', 'blocker', 'economic_buyer', 'unknown')),
  influence_score INTEGER CHECK (influence_score >= 0 AND influence_score <= 100),
  relationship_strength INTEGER CHECK (relationship_strength >= 0 AND relationship_strength <= 100),
  sentiment_score INTEGER CHECK (sentiment_score >= 0 AND sentiment_score <= 100),
  engagement_metrics JSONB, -- Meeting count, last contact, etc.
  influences JSONB, -- Array of stakeholder IDs they influence
  calculated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_stakeholder_intel_stakeholder ON stakeholder_intelligence(stakeholder_id);
CREATE INDEX idx_stakeholder_intel_deal ON stakeholder_intelligence(deal_id);
CREATE INDEX idx_stakeholder_intel_role ON stakeholder_intelligence(role);

-- Action item dependencies
CREATE TABLE action_item_dependencies (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  blocks_action_item_id UUID NOT NULL REFERENCES action_items(id) ON DELETE CASCADE,
  detected_via TEXT CHECK (detected_via IN ('manual', 'ai_nlp', 'explicit')),
  confidence FLOAT, -- AI confidence if detected via NLP
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(action_item_id, blocks_action_item_id)
);

CREATE INDEX idx_dependencies_blocker ON action_item_dependencies(action_item_id);
CREATE INDEX idx_dependencies_blocked ON action_item_dependencies(blocks_action_item_id);

-- Intelligence preferences (user customization)
CREATE TABLE intelligence_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preferences JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id)
);

-- RLS Policies
ALTER TABLE deal_risk_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE stakeholder_intelligence ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_item_dependencies ENABLE ROW LEVEL SECURITY;
ALTER TABLE intelligence_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view risk scores for their deals"
  ON deal_risk_scores FOR SELECT
  USING (
    deal_id IN (
      SELECT id FROM deals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view stakeholder intelligence for their deals"
  ON stakeholder_intelligence FOR SELECT
  USING (
    deal_id IN (
      SELECT id FROM deals WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can view dependencies for their action items"
  ON action_item_dependencies FOR SELECT
  USING (
    action_item_id IN (
      SELECT id FROM action_items WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "Users can manage their own preferences"
  ON intelligence_preferences FOR ALL
  USING (user_id = auth.uid());
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Week 1)

**ARCHITECT + DB-ENGINEER**

#### Tasks:
1. Create database schema (SQL migration above)
2. Create new service files:
   - `backend/services/intelligence/MeetingPrepService.js`
   - `backend/services/intelligence/DealRiskService.js`
   - `backend/services/intelligence/ActionItemTrackerService.js`
   - `backend/services/intelligence/RelationshipIntelligenceService.js`
3. Enhance `backend/services/intelligenceService.js` with orchestration
4. Create API routes in `backend/routes/intelligence.js`
5. Write unit tests for risk scoring algorithm

**Deliverables:**
- SQL migration script (user runs in Supabase)
- Backend services with core logic
- API endpoints (tested with Postman/Thunder Client)

---

### Phase 2: Meeting Prep Cards (Week 1-2)

**BE-BUILDER → FE-BUILDER → FE-QA**

#### Backend Tasks:
1. Implement `MeetingPrepService.getUpcomingMeetingPrep()`
2. Implement `MeetingPrepService.generateTalkingPoints()` (AI)
3. Implement `MeetingPrepService.generateMeetingBrief()` (AI)
4. Create API endpoint: `GET /api/intelligence/meeting-prep/:meetingId`

#### Frontend Tasks:
1. Create `MeetingPrepCard.jsx` component
2. Implement adaptive expansion UI
3. Integrate with API
4. Add quick actions (Prepare Brief, Reschedule)

**Test Cases:**
- Meeting with associated CRM deal shows deal context
- Meeting without CRM association shows basic context
- Sentiment trend displays correctly (improving/stable/declining)
- Overdue action items are highlighted
- Talking points are relevant and actionable
- Brief generation completes within 10 seconds

---

### Phase 3: Deal Risk Alerts (Week 2)

**BE-BUILDER → FE-BUILDER → FE-QA**

#### Backend Tasks:
1. Implement risk scoring algorithm (all 4 factors)
2. Implement predictive analytics (churn/close probability)
3. Implement recommended actions generator
4. Create background job to calculate risk scores daily
5. Create API endpoint: `GET /api/intelligence/deal-risks`

#### Frontend Tasks:
1. Create `DealRiskAlertCard.jsx` component
2. Create `RiskScoreBadge.jsx` component (color-coded)
3. Implement factor breakdown visualization
4. Add quick actions (Schedule Call, Create Recovery Plan)

**Test Cases:**
- Risk score accuracy (validate against historical data)
- Risk level thresholds trigger correctly
- Factor weights sum to 1.0
- Predictions have reasonable confidence scores
- Recommended actions match risk factors
- Background job runs without errors

---

### Phase 4: Action Item Tracking (Week 2-3)

**BE-BUILDER → FE-BUILDER → FE-QA**

#### Backend Tasks:
1. Implement action item aggregation and metrics
2. Implement blocking chain detection (NLP or explicit)
3. Implement intelligent nudge logic
4. Integrate with Slack/Pulse for nudges
5. Create API endpoint: `GET /api/intelligence/action-items`

#### Frontend Tasks:
1. Create `ActionItemStatusCard.jsx` component
2. Create `BlockingChainVisualizer.jsx` component
3. Implement completion rate progress bars
4. Add nudge buttons with confirmation

**Test Cases:**
- Completion rate calculates correctly
- Blocking chains detect dependencies accurately
- Nudges send successfully via Slack/email
- Benchmark calculations (user vs. team average)
- Overdue items sorted by priority

---

### Phase 5: Relationship Insights (Week 3)

**BE-BUILDER → FE-BUILDER → FE-QA**

#### Backend Tasks:
1. Implement stakeholder role classification (AI)
2. Implement influence score calculation
3. Implement coverage gap analysis
4. Implement champion health scoring
5. Create API endpoint: `GET /api/intelligence/relationships/:dealId`

#### Frontend Tasks:
1. Create `RelationshipInsightCard.jsx` component
2. Create stakeholder role badges
3. Implement influence visualization (star ratings)
4. Display coverage gaps with recommendations

**Test Cases:**
- Role classification accuracy (champion, influencer, blocker)
- Influence scores correlate with actual influence
- Coverage gaps identify missing personas
- Champion health detects at-risk champions
- Recommendations are actionable

---

### Phase 6: Dashboard Integration (Week 3-4)

**FE-BUILDER → UI-POLISH → INTEGRATION-TESTER**

#### Tasks:
1. Create `IntelligenceDashboard.jsx` main component
2. Integrate all 4 card types
3. Implement customization modal
4. Add auto-refresh (5-minute intervals)
5. Implement responsive design (mobile/tablet/desktop)
6. Add loading skeletons and error states
7. Integrate with navigation (replace old TodaysIntelligence)

**Polish:**
- Smooth animations for card expansion
- Color-coded risk levels (green/yellow/orange/red)
- Micro-interactions (hover states, button feedback)
- Accessibility (ARIA labels, keyboard navigation)

**Test Cases:**
- Dashboard loads all cards in <2 seconds
- Auto-refresh works without flickering
- Customization preferences persist
- Mobile responsive (cards stack vertically)
- All quick actions work end-to-end

---

### Phase 7: Deployment & Monitoring (Week 4)

**DEPLOYMENT-SPECIALIST → LEARNING-RECORDER**

#### Tasks:
1. Run SQL migration in Supabase production
2. Deploy backend services
3. Deploy frontend components
4. Configure monitoring (Sentry for errors)
5. Set up analytics (track card engagement)
6. Create user documentation
7. Update CLAUDE.md with new patterns

**Monitoring Metrics:**
- Dashboard load time (p95 <2s)
- API response times (p95 <500ms)
- Risk score calculation success rate (>95%)
- User engagement (clicks per card type)
- Quick action completion rates

---

## Success Metrics

### User Engagement

**Week 1 Targets:**
- Dashboard views: 100+ per day
- Card expansions: 30% of cards expanded
- Quick actions: 20% of cards trigger action
- Customization: 40% of users customize preferences

**Week 4 Targets:**
- Dashboard views: 500+ per day (primary landing page)
- Card expansions: 50% expanded
- Quick actions: 35% trigger action
- Customization: 60% customize

### Business Impact

**Measured After 30 Days:**
- Meeting preparedness: 80% of users review prep cards before meetings
- Deal recovery: 15% of at-risk deals recovered via proactive outreach
- Action item completion: 10% improvement in completion rates
- Stakeholder coverage: 25% reduction in single-threaded deals

### Quality Metrics

**Technical:**
- API success rate: >99%
- Dashboard load time: <2s (p95)
- Risk score accuracy: >85% correlation with outcomes
- Zero P0/P1 bugs in first 2 weeks

**AI Quality:**
- Talking points relevance: >80% user approval
- Risk factor accuracy: >85% validated by users
- Role classification accuracy: >80% correct
- Recommended actions: >70% helpful rating

---

## Appendix

### Visual Design Assets

**Color Palette:**
```css
/* Risk Levels */
--risk-low: #10B981;      /* Green */
--risk-medium: #F59E0B;   /* Yellow */
--risk-high: #F97316;     /* Orange */
--risk-critical: #EF4444; /* Red */

/* Sentiment */
--sentiment-positive: #10B981;
--sentiment-neutral: #6B7280;
--sentiment-negative: #EF4444;

/* UI Elements */
--card-bg: #FFFFFF;
--card-border: #E5E7EB;
--card-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
--primary-action: #3B82F6;
--secondary-action: #6B7280;
```

### Example API Responses

**Meeting Prep Response:**
```json
{
  "success": true,
  "data": {
    "meeting": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Client Call - Acme Corp",
      "scheduledAt": "2026-01-24T14:00:00Z",
      "attendees": [
        {
          "id": "attendee-1",
          "name": "John Smith",
          "title": "CEO",
          "email": "john@acme.com"
        },
        {
          "id": "attendee-2",
          "name": "Sarah Chen",
          "title": "CTO",
          "email": "sarah@acme.com"
        }
      ],
      "meetingLink": "https://zoom.us/j/123456789"
    },
    "dealContext": {
      "id": "deal-123",
      "name": "Acme Corp - Enterprise Plan",
      "value": 50000,
      "stage": "Proposal",
      "probability": 60
    },
    "history": {
      "lastContactDate": "2026-01-10",
      "meetingCount": 8,
      "daysSinceLastContact": 14
    },
    "sentiment": {
      "current": "neutral",
      "trend": "declining",
      "history": [
        {
          "date": "2026-01-20",
          "sentiment": "positive",
          "score": 85
        },
        {
          "date": "2026-01-15",
          "sentiment": "neutral",
          "score": 62
        },
        {
          "date": "2026-01-10",
          "sentiment": "neutral",
          "score": 58
        }
      ]
    },
    "actionItems": {
      "total": 5,
      "overdue": 2,
      "items": [
        {
          "id": "action-1",
          "task": "Send proposal",
          "owner": "John Doe",
          "dueDate": "2026-01-19",
          "status": "overdue"
        },
        {
          "id": "action-2",
          "task": "Get legal approval",
          "owner": "Legal Team",
          "dueDate": "2026-01-21",
          "status": "overdue"
        }
      ]
    },
    "insights": {
      "competitorMentions": ["CompetitorX"],
      "keyTopics": ["pricing", "implementation timeline", "security"],
      "relationshipChanges": ["Sarah Chen identified as champion"]
    },
    "talkingPoints": [
      "Follow up on Q4 pricing concerns raised in last meeting",
      "Address competitive comparison with CompetitorX",
      "Discuss implementation timeline and resource requirements",
      "Clarify security requirements and compliance needs"
    ]
  }
}
```

---

**End of Design Document**

This design provides a comprehensive blueprint for implementing the Enhanced Intelligence Dashboard as the first Tier 1 AI enhancement for Entomate.
