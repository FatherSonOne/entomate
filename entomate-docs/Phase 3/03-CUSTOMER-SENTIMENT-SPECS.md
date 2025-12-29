# Customer Sentiment Tracking Specification

**Phase 3 - Weeks 3-4**
**Priority:** High (enterprise value)

---

## Overview

Customer Sentiment Tracking provides a unified view of customer health across all touchpoints: meetings, Pulse messages, CRM activities, and task completion. This enables proactive account management and churn prevention.

### Business Value
- Identify at-risk customers before they churn
- Prioritize accounts that need attention
- Track sentiment trends over time
- Enable data-driven customer success

---

## Feature Requirements

### Core Features

| Feature | Description | Priority |
|---------|-------------|----------|
| Sentiment Analysis | Analyze tone of meetings/messages | P0 |
| Health Score | Composite score 0-100 | P0 |
| Trend Tracking | Track sentiment over time | P0 |
| At-Risk Alerts | Alert when customer health drops | P0 |
| Health Dashboard | Overview of all customer health | P1 |
| Churn Prediction | Predict likelihood of churn | P1 |
| Sentiment Factors | Explain what drives the score | P1 |

### Data Sources

| Source | Sentiment Signal |
|--------|-----------------|
| Meeting transcripts | Tone, keywords, questions asked |
| Pulse messages | Message tone, response times |
| CRM activities | Deal stage, activity frequency |
| Task completion | On-time vs delayed, quality |
| Support tickets | Volume, severity, resolution |

---

## Architecture

### System Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Sentiment Pipeline                        │
│                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │ Data Sources │  │ Sentiment    │  │ Health Score     │  │
│  │              │──│ Analyzer     │──│ Calculator       │  │
│  │ - Meetings   │  │              │  │                  │  │
│  │ - Pulse      │  │ (Gemini API) │  │ (Weighted avg)   │  │
│  │ - CRM        │  │              │  │                  │  │
│  └──────────────┘  └──────────────┘  └────────┬─────────┘  │
│                                               │             │
│                                     ┌─────────▼─────────┐  │
│                                     │ Alert Engine      │  │
│                                     │                   │  │
│                                     │ - Threshold       │  │
│                                     │ - Trend detection │  │
│                                     │ - Notifications   │  │
│                                     └───────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

---

## Data Models

### Database Schema

```sql
-- Individual sentiment measurements
CREATE TABLE customer_sentiment (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  source_type TEXT NOT NULL,  -- meeting, pulse_message, crm_activity
  source_id TEXT NOT NULL,
  sentiment_score DOUBLE PRECISION NOT NULL,  -- -1.0 to 1.0
  sentiment_label TEXT NOT NULL,  -- very_negative, negative, neutral, positive, very_positive
  confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  key_phrases JSONB NOT NULL DEFAULT '[]',
  emotional_signals JSONB NOT NULL DEFAULT '{}',
  analyzed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(source_type, source_id)
);

-- Aggregated customer health scores
CREATE TABLE customer_health (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL UNIQUE,
  health_score INT NOT NULL,  -- 0-100
  health_label TEXT NOT NULL,  -- healthy, needs_attention, at_risk, critical

  -- Factor scores (each 0-100)
  sentiment_factor INT NOT NULL DEFAULT 50,
  engagement_factor INT NOT NULL DEFAULT 50,
  responsiveness_factor INT NOT NULL DEFAULT 50,
  deal_progress_factor INT NOT NULL DEFAULT 50,
  task_completion_factor INT NOT NULL DEFAULT 50,

  -- Trend
  sentiment_trend TEXT NOT NULL DEFAULT 'stable',  -- improving, stable, declining
  trend_direction INT NOT NULL DEFAULT 0,  -- -2 to +2

  -- Metadata
  last_interaction TIMESTAMPTZ,
  interaction_count_30d INT NOT NULL DEFAULT 0,
  calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Health score history for trend analysis
CREATE TABLE customer_health_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  health_score INT NOT NULL,
  factors JSONB NOT NULL,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Alerts for at-risk customers
CREATE TABLE customer_alerts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,  -- score_drop, declining_trend, no_interaction, repeated_negative
  severity TEXT NOT NULL,  -- warning, critical
  message TEXT NOT NULL,
  suggested_action TEXT,
  context JSONB NOT NULL DEFAULT '{}',
  acknowledged_at TIMESTAMPTZ,
  acknowledged_by UUID,
  resolved_at TIMESTAMPTZ,
  resolved_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_customer_sentiment_customer ON customer_sentiment (customer_id, analyzed_at DESC);
CREATE INDEX idx_customer_sentiment_source ON customer_sentiment (source_type, source_id);
CREATE INDEX idx_customer_health_score ON customer_health (health_score);
CREATE INDEX idx_customer_health_label ON customer_health (health_label);
CREATE INDEX idx_customer_alerts_active ON customer_alerts (customer_id)
  WHERE resolved_at IS NULL;
CREATE INDEX idx_customer_health_history ON customer_health_history (customer_id, recorded_at DESC);
```

### TypeScript Interfaces

```typescript
// src/sentiment/types.ts

export interface SentimentResult {
  score: number;  // -1.0 to 1.0
  label: SentimentLabel;
  confidence: number;
  keyPhrases: string[];
  emotionalSignals: {
    frustration: number;
    satisfaction: number;
    urgency: number;
    enthusiasm: number;
  };
}

export type SentimentLabel =
  | 'very_negative'
  | 'negative'
  | 'neutral'
  | 'positive'
  | 'very_positive';

export interface CustomerHealth {
  customerId: string;
  healthScore: number;  // 0-100
  healthLabel: HealthLabel;
  factors: HealthFactors;
  trend: TrendInfo;
  lastInteraction: Date | null;
  interactionCount30d: number;
  calculatedAt: Date;
}

export type HealthLabel =
  | 'healthy'        // 80-100
  | 'needs_attention' // 60-79
  | 'at_risk'        // 40-59
  | 'critical';      // 0-39

export interface HealthFactors {
  sentiment: number;       // Average sentiment score
  engagement: number;      // Interaction frequency
  responsiveness: number;  // Response time
  dealProgress: number;    // Deal movement
  taskCompletion: number;  // Task on-time rate
}

export interface TrendInfo {
  direction: 'improving' | 'stable' | 'declining';
  changePercent: number;
  periodDays: number;
}

export interface CustomerAlert {
  id: string;
  customerId: string;
  alertType: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  suggestedAction: string | null;
  context: Record<string, any>;
  acknowledgedAt: Date | null;
  resolvedAt: Date | null;
  createdAt: Date;
}

export type AlertType =
  | 'score_drop'        // Score dropped significantly
  | 'declining_trend'   // Trend declining for 2+ weeks
  | 'no_interaction'    // No interaction in X days
  | 'repeated_negative'; // Multiple negative interactions
```

---

## Sentiment Analysis

### Gemini Prompt for Sentiment

```typescript
// src/sentiment/analyzer.ts

const SENTIMENT_PROMPT = `
Analyze the sentiment of the following text from a business communication.

Return a JSON object with:
{
  "score": <number from -1.0 to 1.0>,
  "label": <"very_negative" | "negative" | "neutral" | "positive" | "very_positive">,
  "confidence": <number from 0.0 to 1.0>,
  "key_phrases": [<up to 5 phrases that indicate sentiment>],
  "emotional_signals": {
    "frustration": <0-100>,
    "satisfaction": <0-100>,
    "urgency": <0-100>,
    "enthusiasm": <0-100>
  }
}

Score guide:
- -1.0 to -0.6: Very negative (anger, severe frustration, threats to cancel)
- -0.6 to -0.2: Negative (complaints, disappointment, concern)
- -0.2 to 0.2: Neutral (informational, business-as-usual)
- 0.2 to 0.6: Positive (satisfaction, appreciation, engagement)
- 0.6 to 1.0: Very positive (enthusiasm, praise, strong endorsement)

Context: This is a business communication between a customer and our sales/support team.

TEXT TO ANALYZE:
---
{text}
---

JSON response:
`;

export async function analyzeSentiment(text: string): Promise<SentimentResult> {
  const prompt = SENTIMENT_PROMPT.replace('{text}', text);

  const response = await gemini.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.1,
      responseMimeType: 'application/json'
    }
  });

  const result = JSON.parse(response.response.text());

  return {
    score: Math.max(-1, Math.min(1, result.score)),
    label: result.label,
    confidence: result.confidence,
    keyPhrases: result.key_phrases || [],
    emotionalSignals: result.emotional_signals || {
      frustration: 0,
      satisfaction: 50,
      urgency: 0,
      enthusiasm: 50
    }
  };
}
```

### Batch Processing

```typescript
// src/sentiment/batchProcessor.ts

export async function processNewContent(): Promise<number> {
  let processed = 0;

  // Process new meetings
  const unanalyzedMeetings = await getUnanalyzedMeetings();
  for (const meeting of unanalyzedMeetings) {
    const sentiment = await analyzeSentiment(meeting.transcript);
    await saveSentiment({
      customerId: meeting.customerId,
      sourceType: 'meeting',
      sourceId: meeting.id,
      ...sentiment
    });
    processed++;
  }

  // Process new Pulse messages
  const unanalyzedMessages = await getUnanalyzedPulseMessages();
  for (const message of unanalyzedMessages) {
    const sentiment = await analyzeSentiment(message.content);
    await saveSentiment({
      customerId: message.customerId,
      sourceType: 'pulse_message',
      sourceId: message.id,
      ...sentiment
    });
    processed++;
  }

  return processed;
}

// Run as a scheduled job
export async function sentimentBatchJob(): Promise<void> {
  console.log('Starting sentiment batch processing...');

  try {
    const processed = await processNewContent();
    console.log(`Processed ${processed} items`);

    // Recalculate health scores for affected customers
    const affectedCustomers = await getCustomersWithNewSentiment();
    for (const customerId of affectedCustomers) {
      await recalculateHealthScore(customerId);
    }

    // Check for new alerts
    await evaluateAlerts();

  } catch (error) {
    console.error('Sentiment batch job failed:', error);
    throw error;
  }
}
```

---

## Health Score Calculation

### Score Formula

```typescript
// src/sentiment/healthScore.ts

const FACTOR_WEIGHTS = {
  sentiment: 0.30,      // 30%
  engagement: 0.25,     // 25%
  responsiveness: 0.15, // 15%
  dealProgress: 0.15,   // 15%
  taskCompletion: 0.15  // 15%
};

export async function calculateHealthScore(
  customerId: string
): Promise<CustomerHealth> {
  const factors = await calculateFactors(customerId);

  const weightedScore = Math.round(
    factors.sentiment * FACTOR_WEIGHTS.sentiment +
    factors.engagement * FACTOR_WEIGHTS.engagement +
    factors.responsiveness * FACTOR_WEIGHTS.responsiveness +
    factors.dealProgress * FACTOR_WEIGHTS.dealProgress +
    factors.taskCompletion * FACTOR_WEIGHTS.taskCompletion
  );

  const healthScore = Math.max(0, Math.min(100, weightedScore));
  const healthLabel = getHealthLabel(healthScore);
  const trend = await calculateTrend(customerId, healthScore);

  return {
    customerId,
    healthScore,
    healthLabel,
    factors,
    trend,
    lastInteraction: await getLastInteraction(customerId),
    interactionCount30d: await getInteractionCount(customerId, 30),
    calculatedAt: new Date()
  };
}

async function calculateFactors(customerId: string): Promise<HealthFactors> {
  return {
    sentiment: await calculateSentimentFactor(customerId),
    engagement: await calculateEngagementFactor(customerId),
    responsiveness: await calculateResponsivenessFactor(customerId),
    dealProgress: await calculateDealProgressFactor(customerId),
    taskCompletion: await calculateTaskCompletionFactor(customerId)
  };
}

// Sentiment Factor (0-100)
async function calculateSentimentFactor(customerId: string): Promise<number> {
  const sentiments = await getRecentSentiments(customerId, 30);

  if (sentiments.length === 0) return 50; // Neutral if no data

  // Weighted average (recent = more weight)
  let weightedSum = 0;
  let totalWeight = 0;

  sentiments.forEach((s, index) => {
    const weight = sentiments.length - index; // Most recent = highest weight
    weightedSum += ((s.score + 1) / 2 * 100) * weight; // Convert -1..1 to 0..100
    totalWeight += weight;
  });

  return Math.round(weightedSum / totalWeight);
}

// Engagement Factor (0-100)
async function calculateEngagementFactor(customerId: string): Promise<number> {
  const interactionCount = await getInteractionCount(customerId, 30);
  const daysSinceLastInteraction = await getDaysSinceLastInteraction(customerId);

  // Expected: at least 2 interactions per week = ~8 per month
  const frequencyScore = Math.min(100, (interactionCount / 8) * 100);

  // Penalize long gaps
  let recencyScore = 100;
  if (daysSinceLastInteraction > 14) recencyScore = 50;
  if (daysSinceLastInteraction > 30) recencyScore = 25;
  if (daysSinceLastInteraction > 60) recencyScore = 0;

  return Math.round((frequencyScore + recencyScore) / 2);
}

// Responsiveness Factor (0-100)
async function calculateResponsivenessFactor(customerId: string): Promise<number> {
  const avgResponseTime = await getAverageResponseTime(customerId);

  // Response time targets (in hours)
  if (avgResponseTime === null) return 50; // No data
  if (avgResponseTime < 2) return 100;     // Excellent
  if (avgResponseTime < 8) return 80;      // Good
  if (avgResponseTime < 24) return 60;     // Okay
  if (avgResponseTime < 48) return 40;     // Slow
  return 20;                                // Very slow
}

// Deal Progress Factor (0-100)
async function calculateDealProgressFactor(customerId: string): Promise<number> {
  const deals = await getActiveDeals(customerId);

  if (deals.length === 0) return 50; // No deals

  let totalScore = 0;
  for (const deal of deals) {
    // Score based on stage and movement
    const stageScore = getStageScore(deal.stage);
    const movementScore = await getMovementScore(deal.id);
    totalScore += (stageScore + movementScore) / 2;
  }

  return Math.round(totalScore / deals.length);
}

// Task Completion Factor (0-100)
async function calculateTaskCompletionFactor(customerId: string): Promise<number> {
  const tasks = await getCustomerTasks(customerId, 30);

  if (tasks.length === 0) return 50; // No tasks

  const completed = tasks.filter(t => t.status === 'completed');
  const onTime = completed.filter(t =>
    !t.dueDate || new Date(t.completedAt) <= new Date(t.dueDate)
  );

  const completionRate = (completed.length / tasks.length) * 100;
  const onTimeRate = completed.length > 0
    ? (onTime.length / completed.length) * 100
    : 50;

  return Math.round((completionRate + onTimeRate) / 2);
}

function getHealthLabel(score: number): HealthLabel {
  if (score >= 80) return 'healthy';
  if (score >= 60) return 'needs_attention';
  if (score >= 40) return 'at_risk';
  return 'critical';
}
```

### Trend Calculation

```typescript
async function calculateTrend(
  customerId: string,
  currentScore: number
): Promise<TrendInfo> {
  // Get score from 14 days ago
  const historicalScore = await getHistoricalScore(customerId, 14);

  if (historicalScore === null) {
    return { direction: 'stable', changePercent: 0, periodDays: 14 };
  }

  const change = currentScore - historicalScore;
  const changePercent = (change / historicalScore) * 100;

  let direction: 'improving' | 'stable' | 'declining';
  if (change > 5) direction = 'improving';
  else if (change < -5) direction = 'declining';
  else direction = 'stable';

  return {
    direction,
    changePercent: Math.round(changePercent),
    periodDays: 14
  };
}
```

---

## Alert System

### Alert Evaluation

```typescript
// src/sentiment/alertEngine.ts

interface AlertRule {
  type: AlertType;
  evaluate: (health: CustomerHealth) => AlertCandidate | null;
}

interface AlertCandidate {
  alertType: AlertType;
  severity: 'warning' | 'critical';
  message: string;
  suggestedAction: string;
  context: Record<string, any>;
}

const ALERT_RULES: AlertRule[] = [
  {
    type: 'score_drop',
    evaluate: (health) => {
      const drop = health.trend.changePercent;
      if (drop < -20) {
        return {
          alertType: 'score_drop',
          severity: 'critical',
          message: `Health score dropped ${Math.abs(drop)}% in 14 days`,
          suggestedAction: 'Schedule a check-in call immediately',
          context: { previousScore: health.healthScore - drop }
        };
      }
      if (drop < -10) {
        return {
          alertType: 'score_drop',
          severity: 'warning',
          message: `Health score dropped ${Math.abs(drop)}% in 14 days`,
          suggestedAction: 'Review recent interactions for issues',
          context: { previousScore: health.healthScore - drop }
        };
      }
      return null;
    }
  },
  {
    type: 'declining_trend',
    evaluate: async (health) => {
      if (health.trend.direction !== 'declining') return null;

      // Check if declining for 2+ consecutive periods
      const isLongDecline = await hasConsecutiveDecline(health.customerId, 2);
      if (isLongDecline) {
        return {
          alertType: 'declining_trend',
          severity: 'warning',
          message: 'Customer health has been declining for 2+ weeks',
          suggestedAction: 'Investigate root cause and plan intervention',
          context: { trendDirection: health.trend.direction }
        };
      }
      return null;
    }
  },
  {
    type: 'no_interaction',
    evaluate: (health) => {
      const daysSince = health.lastInteraction
        ? Math.floor((Date.now() - health.lastInteraction.getTime()) / (1000 * 60 * 60 * 24))
        : 999;

      if (daysSince > 30) {
        return {
          alertType: 'no_interaction',
          severity: 'critical',
          message: `No interaction in ${daysSince} days`,
          suggestedAction: 'Reach out to re-engage the customer',
          context: { daysSinceInteraction: daysSince }
        };
      }
      if (daysSince > 14) {
        return {
          alertType: 'no_interaction',
          severity: 'warning',
          message: `No interaction in ${daysSince} days`,
          suggestedAction: 'Schedule a check-in',
          context: { daysSinceInteraction: daysSince }
        };
      }
      return null;
    }
  },
  {
    type: 'repeated_negative',
    evaluate: async (health) => {
      const recentSentiments = await getRecentSentiments(health.customerId, 7);
      const negativeCount = recentSentiments.filter(s => s.score < -0.2).length;

      if (negativeCount >= 3) {
        return {
          alertType: 'repeated_negative',
          severity: 'critical',
          message: `${negativeCount} negative interactions in the past week`,
          suggestedAction: 'Escalate to customer success manager',
          context: { negativeCount, recentSentiments }
        };
      }
      return null;
    }
  }
];

export async function evaluateAlerts(): Promise<void> {
  const customers = await getAllCustomersWithHealth();

  for (const health of customers) {
    for (const rule of ALERT_RULES) {
      const candidate = await rule.evaluate(health);

      if (candidate) {
        // Check if similar alert already exists
        const existingAlert = await findActiveAlert(
          health.customerId,
          candidate.alertType
        );

        if (!existingAlert) {
          await createAlert({
            customerId: health.customerId,
            ...candidate
          });

          // Send notification
          await sendAlertNotification(health.customerId, candidate);
        }
      }
    }
  }
}

async function sendAlertNotification(
  customerId: string,
  alert: AlertCandidate
): Promise<void> {
  // Get customer owner
  const owner = await getCustomerOwner(customerId);
  const customer = await getCustomer(customerId);

  // Post to Pulse
  await pulseClient.sendMessage({
    channelId: owner.pulseChannelId,
    text: `⚠️ **Customer Alert: ${customer.name}**\n\n${alert.message}\n\n**Suggested Action:** ${alert.suggestedAction}`
  });
}
```

---

## API Endpoints

### Sentiment Endpoints

```typescript
// GET /api/sentiment/customer/:customerId
// Returns all sentiment data for a customer
// Query params: limit, startDate, endDate, sourceType

// GET /api/sentiment/customer/:customerId/summary
// Returns aggregated sentiment summary

// POST /api/sentiment/analyze
// Manually trigger sentiment analysis
// Body: { sourceType, sourceId }
```

### Health Score Endpoints

```typescript
// GET /api/health/customer/:customerId
// Returns current health score with factors

// GET /api/health/customer/:customerId/history
// Returns health score history
// Query params: startDate, endDate, interval (daily|weekly)

// GET /api/health/dashboard
// Returns health overview for all customers
// Query params: filter (healthy|needs_attention|at_risk|critical)

// POST /api/health/recalculate/:customerId
// Force recalculation of health score
```

### Alert Endpoints

```typescript
// GET /api/alerts
// Returns all active alerts
// Query params: customerId, severity, acknowledged

// POST /api/alerts/:alertId/acknowledge
// Acknowledge an alert

// POST /api/alerts/:alertId/resolve
// Mark alert as resolved
// Body: { resolution: string }

// GET /api/alerts/statistics
// Returns alert statistics
```

---

## Frontend Components

### Health Dashboard

```tsx
// src/pages/CustomerHealthDashboard.tsx

import React from 'react';
import { useCustomerHealth } from '../hooks/useCustomerHealth';
import { HealthScoreCard } from '../components/health/HealthScoreCard';
import { HealthDistributionChart } from '../components/health/HealthDistributionChart';
import { AtRiskCustomersList } from '../components/health/AtRiskCustomersList';
import { TrendIndicator } from '../components/health/TrendIndicator';

export function CustomerHealthDashboard() {
  const { customers, distribution, loading } = useCustomerHealth();

  if (loading) return <LoadingSpinner />;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Customer Health</h1>

      {/* Distribution overview */}
      <div className="grid grid-cols-4 gap-4">
        <HealthScoreCard
          label="Healthy"
          count={distribution.healthy}
          color="green"
        />
        <HealthScoreCard
          label="Needs Attention"
          count={distribution.needsAttention}
          color="yellow"
        />
        <HealthScoreCard
          label="At Risk"
          count={distribution.atRisk}
          color="orange"
        />
        <HealthScoreCard
          label="Critical"
          count={distribution.critical}
          color="red"
        />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-2 gap-6">
        <HealthDistributionChart distribution={distribution} />
        <TrendChart customers={customers} />
      </div>

      {/* At-risk list */}
      <AtRiskCustomersList
        customers={customers.filter(c =>
          c.healthLabel === 'at_risk' || c.healthLabel === 'critical'
        )}
      />
    </div>
  );
}
```

### Health Score Badge

```tsx
// src/components/health/HealthBadge.tsx

interface Props {
  score: number;
  label: HealthLabel;
  showScore?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

export function HealthBadge({ score, label, showScore = true, size = 'md' }: Props) {
  const colors = {
    healthy: 'bg-green-100 text-green-800 border-green-300',
    needs_attention: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    at_risk: 'bg-orange-100 text-orange-800 border-orange-300',
    critical: 'bg-red-100 text-red-800 border-red-300'
  };

  const sizes = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-3 py-1',
    lg: 'text-base px-4 py-2'
  };

  return (
    <span className={`
      inline-flex items-center rounded-full border font-medium
      ${colors[label]} ${sizes[size]}
    `}>
      {showScore && <span className="mr-1 font-bold">{score}</span>}
      {label.replace('_', ' ')}
    </span>
  );
}
```

---

## Testing Plan

### Unit Tests
- Sentiment score parsing and normalization
- Health score calculation with various inputs
- Trend calculation accuracy
- Alert rule evaluation

### Integration Tests
- Full pipeline: content → sentiment → health → alert
- API endpoint responses
- Database persistence

### Accuracy Tests
- Manually label 100 communications
- Compare against Gemini sentiment analysis
- Target: >85% accuracy on sentiment labels

### Performance Tests
- Batch processing 1000 items
- Dashboard load time with 500+ customers
- Alert evaluation time

---

## Gemini Studio Mockups

### Prompt 1: Health Dashboard
```
Design a "Customer Health Dashboard" for an enterprise sales platform.

Requirements:
- Summary cards at top (Healthy: X, Needs Attention: X, At Risk: X, Critical: X)
- Distribution chart (pie or donut)
- Trend chart (health scores over time)
- List of at-risk customers with health scores, trend arrows, last interaction date
- Each customer row has: avatar, name, company, health badge, trend indicator, owner

Style: Clean enterprise dashboard, data-focused.
```

### Prompt 2: Customer Health Detail
```
Design a "Customer Health Detail" view for an individual customer.

Sections:
1. Health score prominently displayed (0-100 with color indicator)
2. Factor breakdown (5 factors as progress bars)
3. Trend chart (14-day history)
4. Recent sentiment events (list with icons)
5. Active alerts (if any)
6. Quick actions (Schedule call, Send message, etc.)

Style: Enterprise, clean, actionable.
```

---

## Next Steps After MVP

1. **Churn prediction model** - ML model trained on historical churn data
2. **Sentiment drill-down** - Link sentiment to specific topics discussed
3. **Automated interventions** - Auto-create tasks when health drops
4. **Custom alerts** - User-configurable alert thresholds
5. **Sentiment comparison** - Compare customer A vs B, or vs industry average

---

## Next File

Reply: **"Show file 04"** for Enterprise Features specification.
