# Entomate Frontend UI - Comprehensive Feature Guide

**Purpose:** Complete reference for frontend designers planning UI redesign
**Created:** 2026-01-24
**Scope:** All AI features, intelligence systems, and core functionality

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Architecture Overview](#application-architecture-overview)
3. [Enhanced Intelligence Dashboard](#enhanced-intelligence-dashboard)
4. [AI Explainability Layer](#ai-explainability-layer)
5. [Learning System](#learning-system)
6. [Core Application Features](#core-application-features)
7. [Design System & UI Patterns](#design-system--ui-patterns)
8. [Integration Points](#integration-points)
9. [Mobile & Responsive Considerations](#mobile--responsive-considerations)
10. [Accessibility Requirements](#accessibility-requirements)
11. [Implementation Priorities](#implementation-priorities)

---

## Executive Summary

### The Three-Layer Intelligence Stack

Entomate is built on three layers of AI intelligence:

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: LEARNING SYSTEM (Continuous Improvement)          │
│  - Learns from user feedback and corrections                │
│  - Detects patterns in user behavior                        │
│  - Adapts recommendations over time                         │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: EXPLAINABILITY (Trust & Transparency)             │
│  - Shows WHY AI made each recommendation                    │
│  - Factor-based scoring with alternatives                   │
│  - Confidence indicators                                    │
└─────────────────────────────────────────────────────────────┘
                           ↕
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: INTELLIGENCE DASHBOARD (Proactive Insights)       │
│  - Meeting prep with AI talking points                      │
│  - Deal risk scoring and predictions                        │
│  - Action item tracking and blocking chains                 │
│  - Relationship intelligence and stakeholder analysis       │
└─────────────────────────────────────────────────────────────┘
```

### What Makes Entomate Unique

1. **Proactive, Not Reactive** - AI surfaces insights before users search
2. **Transparent & Explainable** - Every recommendation shows its reasoning
3. **Continuously Learning** - System improves from user feedback
4. **Context-Aware** - Personalized to user role and team patterns
5. **Actionable** - Every insight includes clear next steps

---

## Application Architecture Overview

### Tech Stack

**Frontend:**
- React 18 with Vite 6
- Tailwind CSS for styling
- React Router v6 for navigation
- Clerk for authentication
- Lucide React for icons

**Backend:**
- Node.js/Express
- Supabase (PostgreSQL)
- Google Gemini AI + OpenAI (fallback)
- Clerk authentication

### Component Architecture

```
frontend/src/
├── components/
│   ├── intelligence/           # Enhanced Intelligence Dashboard
│   │   ├── IntelligenceDashboard.jsx
│   │   ├── MeetingPrepCard.jsx
│   │   ├── DealRiskAlertCard.jsx
│   │   ├── ActionItemStatusCard.jsx
│   │   └── RelationshipInsightCard.jsx
│   │
│   ├── explainability/         # AI Explainability Layer
│   │   ├── ExplanationCard.jsx
│   │   ├── FactorList.jsx
│   │   ├── AlternativesList.jsx
│   │   └── ConfidenceBadge.jsx
│   │
│   ├── learning/               # Learning System
│   │   ├── FeedbackPrompt.jsx
│   │   ├── LearningDashboard.jsx
│   │   ├── PatternCard.jsx
│   │   └── EffectivenessReport.jsx
│   │
│   ├── workflow/               # Workflow Builder
│   │   ├── WorkflowCanvas.jsx
│   │   └── NodeEditor.jsx
│   │
│   └── [existing components]   # Meetings, Tasks, Projects, etc.
│
├── pages/
│   ├── Dashboard.jsx           # Main dashboard
│   ├── Agents.jsx              # AI agents management
│   ├── Meetings.jsx            # Meeting list
│   ├── Tasks.jsx               # Task management
│   ├── Projects.jsx            # Project boards
│   ├── Automations.jsx         # Workflow automations
│   └── Settings.jsx            # User settings
│
├── services/
│   └── api.js                  # API client (unified)
│
└── styles/
    ├── main.css                # Global styles
    └── explainability.css      # Explainability-specific
```

---

## Enhanced Intelligence Dashboard

### 1. Overview

**Purpose:** Transform the basic "Today's Intelligence" into a proactive, predictive dashboard with 4 AI-powered card types.

**Location:** Main dashboard page or dedicated `/intelligence` route

**Design File:** [ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md](./ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md)

### 2. Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  📊 Today's Intelligence                    [⚙ Customize]   │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📅 UPCOMING MEETINGS (3)                [View All →]   │ │
│  │  [Meeting Prep Cards]                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 🚨 DEAL RISK ALERTS (5)                 [View All →]   │ │
│  │  [Risk Alert Cards]                                     │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 📋 ACTION ITEM STATUS                   [View All →]   │ │
│  │  [Completion Metrics + Critical Items]                  │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  ┌────────────────────────────────────────────────────────┐ │
│  │ 👥 RELATIONSHIP INSIGHTS               [View All →]    │ │
│  │  [Stakeholder Intelligence Cards]                       │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Card Types

#### A. Meeting Prep Cards

**Purpose:** Provide context-rich preparation for upcoming meetings

**UI Components:**
- Meeting title, time, attendees
- Deal context (value, stage, probability)
- Last contact date
- Sentiment trend (improving/stable/declining)
- Overdue action items count
- AI-generated talking points (3-5 bullet points)
- Competitor mentions
- Quick actions: [Prepare Brief] [Reschedule]

**Expandable Details:**
- Full attendee list with roles
- Meeting history timeline
- Related deals/projects
- AI-generated full meeting brief

**Data Source:** `GET /api/intelligence/meeting-prep/:meetingId`

**Component:** `frontend/src/components/intelligence/MeetingPrepCard.jsx`

#### B. Deal Risk Alerts

**Purpose:** Proactively identify at-risk deals with AI scoring

**UI Components:**
- Deal name and value
- Risk score (0-100) with color-coded badge
  - 🟢 Low (75-100): Green
  - 🟡 Medium (50-74): Yellow
  - 🟠 High (25-49): Orange
  - 🔴 Critical (0-24): Red
- Top 3 risk factors with icons
- Quick actions: [Schedule Call] [Create Task] [Create Recovery Plan]

**Expandable Details:**
- All 4 risk factors with weighted breakdown:
  1. **Engagement Velocity (35%)** - Meeting frequency trends
  2. **Sentiment Trend (25%)** - Meeting sentiment trajectory
  3. **Action Item Health (20%)** - Completion rates
  4. **Stakeholder Health (20%)** - Champion engagement
- Predictive analytics:
  - Churn risk probability (next 90 days)
  - Close probability
  - Expected close date
  - Confidence score
- AI-recommended recovery actions

**Data Source:** `GET /api/intelligence/deal-risks`

**Component:** `frontend/src/components/intelligence/DealRiskAlertCard.jsx`

#### C. Action Item Tracking

**Purpose:** Visibility into action item completion and blocking chains

**UI Components:**
- Aggregate completion metrics:
  - ✅ Completed: 12/18 (67%)
  - ⚠ Overdue: 4/18 (22%)
  - 🚫 Blocked: 2/18 (11%)
- Week-over-week trends (↑↓ indicators)
- Team benchmarks (user vs. team average)
- Critical overdue items (top 3)
- Quick actions: [Nudge Owner] [Reassign] [Mark Complete]

**Expandable Details:**
- Blocking chain visualization (dependency graph)
- All overdue items grouped by priority
- Team performance comparison charts
- Nudge history

**Blocking Chain Visualization:**
```
Send proposal (⚠ 5d overdue)
    ↓ blocks
Schedule demo (⏸ waiting)

Get legal approval (⚠ 3d overdue)
    ↓ blocks
Sign contract (⏸ waiting)
    ↓ blocks
Onboard customer (⏸ waiting)
```

**Data Source:** `GET /api/intelligence/action-items`

**Component:** `frontend/src/components/intelligence/ActionItemStatusCard.jsx`

#### D. Relationship Insights

**Purpose:** Stakeholder intelligence and coverage analysis

**UI Components:**
- New champions identified
- Stakeholder role classification:
  - 🌟 Champion
  - 💼 Economic Buyer
  - 🔑 Influencer
  - 🚫 Blocker
  - ❓ Unknown
- Influence score (0-100 with star visualization)
- Relationship strength (Strong/Moderate/Weak/New)
- Coverage gaps detected
- Quick actions: [Add to CRM] [Schedule Meeting] [Get Introduction]

**Expandable Details:**
- Full stakeholder list with details
- Engagement metrics (meeting count, last contact, mentions)
- Sentiment trends per stakeholder
- Influence network (who influences whom)
- Coverage gap recommendations

**Data Source:** `GET /api/intelligence/relationships/:dealId`

**Component:** `frontend/src/components/intelligence/RelationshipInsightCard.jsx`

### 4. Adaptive Expansion Pattern

**Default State (Concise):**
- Show top 3 items/factors
- 1-2 line summaries
- Primary quick actions visible

**Expanded State (On Click):**
- Smooth height transition (300ms ease-in-out)
- All factors/items shown
- Detailed breakdowns
- Additional context
- More action buttons

**Button Text:**
- Collapsed: "Show More Details ▼"
- Expanded: "Hide Details ▲"

### 5. Customization Modal

**Trigger:** [⚙ Customize] button in dashboard header

**Options:**
- Toggle card visibility (☑ checkboxes)
- Card order (drag-to-reorder)
- Risk filter levels (Low/Medium/High/Critical)
- Time horizons:
  - Meetings: Hours ahead (default: 24)
  - Risks: Days ahead (default: 7)
- Auto-refresh interval (default: 5 minutes)

**Actions:** [Save Preferences] [Reset to Default]

### 6. Color Palette

```css
/* Risk Levels */
--risk-low: #10B981;         /* Green */
--risk-medium: #F59E0B;      /* Yellow */
--risk-high: #F97316;        /* Orange */
--risk-critical: #EF4444;    /* Red */

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

---

## AI Explainability Layer

### 1. Overview

**Purpose:** Show transparent, understandable explanations for all AI agent decisions

**Design Principle:** "Show the WHY, not just the WHAT"

**Design File:** [AI-EXPLAINABILITY-LAYER-DESIGN.md](./AI-EXPLAINABILITY-LAYER-DESIGN.md)

### 2. When Explainability Appears

**Trigger:** Any AI agent recommendation:
- Assignment Agent (task assignments)
- Priority Agent (task prioritization)
- Deadline Agent (due date recommendations)
- Follow-up Agent (follow-up detection)

**Location:** Inline with the recommendation

### 3. Explanation Card UI

#### Concise View (Default)

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Recommended: John Doe              Confidence: 87%   │
│                                                          │
│ Top Factors:                                            │
│  • Skill Match: 90%      ✓ Has API integration exp     │
│  • Workload: 85%         ✓ 3 tasks vs team avg 5       │
│  • Availability: 75%     ⚠ Available after 2PM         │
│                                                          │
│ [✓ Accept] [↻ Change] [▼ Show More Details]            │
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- Recommendation header with option name
- Confidence badge (color-coded by score)
- Top 3 factors with:
  - Factor name
  - Score (0-100)
  - Impact icon (✓ strong, ⚠ moderate, ✗ weak)
  - Natural language summary (1 line)
- Action buttons

#### Expanded View (On Demand)

```
┌─────────────────────────────────────────────────────────┐
│ ✅ Recommended: John Doe              Confidence: 87%   │
│                                                          │
│ All Decision Factors (Weighted):                        │
│                                                          │
│  1. Skill Match (40% weight)              90/100 ✓     │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━     │
│     • Has API integration experience (5 projects)       │
│     • Completed similar tasks: 94% success rate         │
│     • Domain expertise: CRM integrations, Node.js       │
│                                                          │
│  2. Current Workload (30% weight)         85/100 ✓     │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│     • Active tasks: 3 vs team average: 5                │
│     • Est. capacity: 15 hours this week                 │
│     • Recent completion rate: 96%                       │
│                                                          │
│  [... more factors ...]                                 │
│                                                          │
│ Alternatives Considered:                                │
│                                                          │
│  2. Jane Smith                            72/100        │
│     Why lower: Higher workload (7 active tasks)        │
│     [Assign to Jane Instead]                            │
│                                                          │
│  3. Mike Johnson                          68/100        │
│     Why lower: Less API integration experience         │
│     [Assign to Mike Instead]                            │
│                                                          │
│ [✓ Accept John] [↻ Pick Different] [▲ Hide Details]    │
└─────────────────────────────────────────────────────────┘
```

**Elements:**
- All factors with full details:
  - Factor rank and name
  - Weight percentage
  - Score with progress bar
  - 3-5 supporting details
- Alternatives section:
  - Top 3 alternatives with scores
  - Explanation of why each ranked lower
  - Quick action buttons to choose alternative
- Expanded action buttons

### 4. Factor Definitions by Agent

#### Assignment Agent Factors

1. **Skill Match (40%)**
   - Required skills vs. candidate skills
   - Years of experience
   - Past project success rates
   - Domain expertise

2. **Current Workload (30%)**
   - Active task count vs. team average
   - Estimated capacity (hours)
   - Recent completion rate

3. **Availability (20%)**
   - Calendar availability
   - PTO/vacation schedule
   - Average response time

4. **Past Performance (10%)**
   - On-time delivery rate
   - Quality scores
   - Client satisfaction ratings

#### Priority Agent Factors

1. **Business Impact (40%)**
   - Revenue impact
   - Strategic importance
   - Customer commitment

2. **Urgency (30%)**
   - Due date proximity
   - Blocking relationships
   - External dependencies

3. **Effort Estimation (20%)**
   - Task complexity
   - Estimated time
   - Resource requirements

4. **Risk Level (10%)**
   - Technical risk
   - Dependency risk
   - Deadline risk

#### Deadline Agent Factors

1. **Task Complexity (35%)**
   - Estimated hours
   - Dependencies count
   - Technical difficulty

2. **Team Velocity (30%)**
   - Historical completion rates
   - Average time per complexity level
   - Team capacity

3. **Buffer Calculation (25%)**
   - Risk buffer (15%)
   - Quality buffer (10%)
   - Contingency time

4. **Business Constraints (10%)**
   - Hard deadlines (client commitments)
   - Milestone dates
   - External dependencies

#### Follow-up Agent Factors

1. **Follow-up Likelihood (40%)**
   - Pattern detection score
   - Keyword matching
   - Historical accuracy

2. **Context Importance (30%)**
   - Deal value
   - Deal stage
   - Relationship sentiment

3. **Time Sensitivity (20%)**
   - Days since commitment
   - Meeting urgency
   - Customer expectations

4. **Relationship Health (10%)**
   - Engagement level
   - Response patterns
   - Sentiment trend

### 5. Confidence Indicators

**Confidence Score Calculation:**
```javascript
confidence = avgFactorScore
           - separationPenalty    // If alternatives are close
           - criticalFactorPenalty // If critical factors are weak
```

**Confidence Badges:**

🟢 **High Confidence (80-100%)**
- Background: `#D1FAE5` (light green)
- Text: `#065F46` (dark green)
- Message: "Highly Confident"

🟡 **Medium Confidence (60-79%)**
- Background: `#FEF3C7` (light yellow)
- Text: `#92400E` (dark yellow)
- Message: "Moderately Confident"

🔴 **Low Confidence (<60%)**
- Background: `#FEE2E2` (light red)
- Text: `#991B1B` (dark red)
- Message: "Low Confidence - Review Carefully"

### 6. Component Structure

```jsx
<ExplanationCard
  recommendation={recommendation}
  explanation={explanation}
  onAccept={handleAccept}
  onChangeRecommendation={handleChange}
>
  {/* Header */}
  <div className="recommendation-header">
    <span>✅ Recommended: {recommendation.label}</span>
    <ConfidenceBadge confidence={explanation.confidence} />
  </div>

  {/* Concise Factors */}
  <FactorList
    factors={explanation.factors.slice(0, 3)}
    compact={true}
    showWeights={false}
  />

  {/* Expanded (conditional) */}
  {expanded && (
    <>
      <FactorList
        factors={explanation.factors}
        compact={false}
        showWeights={true}
        showProgressBars={true}
      />
      <AlternativesList
        alternatives={explanation.alternatives}
        onSelect={onChangeRecommendation}
      />
    </>
  )}

  {/* Actions */}
  <div className="explanation-actions">
    <button onClick={onAccept}>✓ Accept</button>
    <button onClick={() => onChangeRecommendation(null)}>↻ Change</button>
    <button onClick={() => setExpanded(!expanded)}>
      {expanded ? '▲ Hide' : '▼ Show More'}
    </button>
  </div>
</ExplanationCard>
```

### 7. CSS Styling

**File:** `frontend/src/styles/explainability.css`

Key styles:
- `.explanation-card` - Card container
- `.factor-compact` - Concise factor display
- `.factor-detailed` - Expanded factor display
- `.progress-bar` - Score visualization
- `.alternative-item` - Alternative option card
- `.confidence-badge` - Confidence indicator

**Animations:**
```css
.explanation-expanded {
  animation: expandIn 0.3s ease-in-out;
}

@keyframes expandIn {
  from {
    opacity: 0;
    max-height: 0;
  }
  to {
    opacity: 1;
    max-height: 1000px;
  }
}
```

---

## Learning System

### 1. Overview

**Purpose:** Enable AI to learn from user feedback and continuously improve

**Design Principle:** "Transparency & Control" - Users approve patterns before activation

**Design File:** [AGENT-FEEDBACK-LOOP-LEARNING-DESIGN.md](./AGENT-FEEDBACK-LOOP-LEARNING-DESIGN.md)

### 2. Learning Lifecycle

```
User Override → Feedback Prompt → Pattern Detection →
User Approval → Pattern Activation → Outcome Tracking →
Pattern Validation → Auto-Deprecation (if ineffective)
```

### 3. Feedback Prompt (On Override)

**Trigger:** User changes AI recommendation

**UI Design:**
```
┌─────────────────────────────────────────────────────────┐
│ 🤔 You assigned this to Jane instead of John.          │
│    Help the AI learn by sharing why:                    │
│                                                          │
│    Reason (optional):                                   │
│    [ ] Jane has the client relationship                 │
│    [ ] Jane requested this project                      │
│    [ ] John is on vacation                              │
│    [✓] Other: Jane has more domain expertise           │
│                                                          │
│    [ ] Don't ask me again                               │
│                                                          │
│    [Skip] [Submit Feedback]                             │
└─────────────────────────────────────────────────────────┘
```

**Behavior:**
- Appears immediately after override
- Modal overlay or inline card (non-blocking)
- Auto-dismiss after 30 seconds if no interaction
- Respects "Don't ask again" preference per agent type
- Optional - user can always skip

**Component:** `frontend/src/components/learning/FeedbackPrompt.jsx`

**Hook:** `frontend/src/hooks/useFeedbackPrompt.js`

### 4. Learning Dashboard

**Location:** Settings → AI Learning OR dedicated `/learning` route

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 AI LEARNING INSIGHTS                                 │
│                                                          │
│ [Active Patterns (3)] [Pending Approval (2)]           │
│   [Statistics]        [Effectiveness Report]            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ 📊 ACTIVE PATTERNS                                      │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Assignment Agent: API Integration Tasks           │  │
│ │                                                    │  │
│ │ Pattern: Prefer Jane Smith over John Doe         │  │
│ │                                                    │  │
│ │ Based on:                                         │  │
│ │  • 4 overrides in last 2 weeks                    │  │
│ │  • User noted: "Jane has more domain expertise"  │  │
│ │  • Consistency: 100% (4/4 times)                  │  │
│ │  • Success rate: 100% (all completed on time)    │  │
│ │                                                    │  │
│ │ Confidence: Medium (65%)                          │  │
│ │ Impact: Skill Match factor +15% for Jane on API  │  │
│ │ Active since: Jan 20, 2026                        │  │
│ │                                                    │  │
│ │ [View Details] [Edit Pattern] [Deactivate]       │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ 📋 PENDING APPROVAL                                     │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ Assignment Agent: Legal Reviews                   │  │
│ │                                                    │  │
│ │ Pattern: Always assign legal tasks to Sarah Chen │  │
│ │                                                    │  │
│ │ Based on:                                         │  │
│ │  • 3 overrides in last week                       │  │
│ │  • All legal review tasks reassigned to Sarah    │  │
│ │  • Consistency: 100% (3/3 times)                  │  │
│ │                                                    │  │
│ │ Confidence: Medium (55%)                          │  │
│ │                                                    │  │
│ │ ⚠ Needs approval before activation               │  │
│ │                                                    │  │
│ │ [✓ Accept & Apply] [Customize] [✗ Reject]        │  │
│ │ [Why did AI learn this?]                          │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Component:** `frontend/src/components/learning/LearningDashboard.jsx`

**Sub-components:**
- `PatternCard.jsx` - Individual pattern display
- `PatternApprovalModal.jsx` - Detailed pattern review
- `EffectivenessReport.jsx` - Performance metrics

### 5. Pattern Types

#### A. Preference Pattern
**What it does:** Boosts preferred options based on user history

**Example:**
- User consistently assigns "backend" tasks to "Alice"
- Pattern: Prefer Alice for backend tasks
- Application: Alice's skill match score boosted by +15%

**UI Badge:** 🔵 Preference

#### B. Constraint Pattern
**What it does:** Filters out excluded options

**Example:**
- User never assigns "legal" tasks to "Bob"
- Pattern: Exclude Bob from legal tasks
- Application: Bob removed from legal task candidates

**UI Badge:** 🚫 Constraint

#### C. Boost Pattern
**What it does:** Adjusts factor weights

**Example:**
- User consistently increases priority for "client" tasks
- Pattern: Boost priority for client-related tasks
- Application: Priority factor increased by +20%

**UI Badge:** ⬆️ Boost

### 6. Pattern Approval Flow

**Step 1: Notification**
```
┌─────────────────────────────────────────────────────────┐
│ 🔔 New Pattern Detected                                 │
│                                                          │
│ The Assignment Agent detected a pattern in your task   │
│ assignments. Review and approve to improve AI accuracy. │
│                                                          │
│ [Review Pattern] [Dismiss]                              │
└─────────────────────────────────────────────────────────┘
```

**Step 2: Review Modal**
```
┌─────────────────────────────────────────────────────────┐
│ 🧠 Review Detected Pattern                         [✗] │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Pattern Name: API Integration → Jane Smith             │
│                                                          │
│ Pattern Description:                                    │
│ When assigning API integration tasks, prefer Jane      │
│ Smith over John Doe                                     │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Evidence:                                               │
│  • 4 overrides in last 14 days                          │
│  • User feedback: "Jane has more domain expertise"     │
│  • Consistency: 100% (reassigned to Jane every time)   │
│  • Task completion rate: 100% (4/4 on time)            │
│                                                          │
│ Confidence: Medium (65%)                                │
│ Reason: Consistent pattern but limited sample size     │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ How will this improve AI?                               │
│  • Skill Match factor: +15% for Jane on API tasks      │
│  • Reduces future overrides: Estimated 80% accuracy    │
│  • Time saved: ~2 minutes per week                      │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Action:                                                  │
│  ○ Accept and apply this pattern                       │
│  ○ Customize pattern (choose contexts)                 │
│  ○ Reject this pattern                                 │
│                                                          │
│ [Cancel] [Save Decision]                                │
└─────────────────────────────────────────────────────────┘
```

**Step 3: Customization (Optional)**
```
┌─────────────────────────────────────────────────────────┐
│ Customize Pattern: API Integration → Jane Smith        │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Apply this pattern when:                                │
│  ☑ Task type contains "API"                             │
│  ☑ Task type contains "integration"                     │
│  ☐ Task type contains "backend"                         │
│  ☐ Deal value > $50,000                                 │
│                                                          │
│ Boost amount:                                            │
│  [━━━━━━━━━━●────────] +15%                            │
│                                                          │
│ Expiration:                                              │
│  ○ Never (permanent pattern)                           │
│  ● 90 days (re-validate after)                         │
│                                                          │
│ [Cancel] [Save Custom Pattern]                          │
└─────────────────────────────────────────────────────────┘
```

### 7. Effectiveness Report

**Component:** `frontend/src/components/learning/EffectivenessReport.jsx`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ 📊 AI Learning Report - January 2026                    │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Active Patterns: 5                                      │
│ Override Rate: 22% (↓ 13% from last month)             │
│ AI Accuracy: 78% (↑ 18% from last month)               │
│ Time Saved: 8 minutes/day                               │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Top Performing Patterns:                                │
│                                                          │
│  1. API Integration → Jane Smith                        │
│     Accuracy: 90% | Overrides prevented: 12            │
│                                                          │
│  2. Customer Commitments Priority Boost                 │
│     Accuracy: 85% | Overrides prevented: 8             │
│                                                          │
│ ─────────────────────────────────────────────────────── │
│                                                          │
│ Patterns Needing Attention:                             │
│                                                          │
│  ⚠ Deadline Buffer Calculation                          │
│     Accuracy: 55% | Still being overridden frequently  │
│     [Review Pattern] [Deactivate]                       │
│                                                          │
│ [View Full Report]                                       │
└─────────────────────────────────────────────────────────┘
```

**Metrics:**
- Active pattern count
- Override rate trend
- AI accuracy improvement
- Time saved estimation
- Top performing patterns
- Low performing patterns (needing attention)

### 8. Auto-Deprecation Indicators

**When pattern performs poorly:**
- Minimum 5 tracked outcomes
- Success rate < 40%
- Status changed to "deprecated"

**UI Indicator:**
```
⚠ Pattern Auto-Deprecated
   This pattern was deactivated due to low success rate (35%).
   [View Details] [Delete Pattern]
```

---

## Core Application Features

### 1. Dashboard Page

**Route:** `/` or `/dashboard`

**Layout:**
```
┌─────────────────────────────────────────────────────────┐
│ 👤 Welcome, [User Name]                   [🔔 Alerts]  │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌──────────────────┐  ┌──────────────────┐            │
│ │ Daily Briefing   │  │ Today's          │            │
│ │ - Meetings: 3    │  │ Intelligence     │            │
│ │ - Tasks Due: 5   │  │ [Enhanced        │            │
│ │ - At Risk: 2     │  │  Intelligence    │            │
│ └──────────────────┘  │  Dashboard]      │            │
│                        └──────────────────┘            │
│                                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Recent Activity                                      ││
│ │ - Meeting completed: Client Call                    ││
│ │ - Task assigned: API Integration                    ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
│ ┌─────────────────────────────────────────────────────┐│
│ │ Quick Actions                                        ││
│ │ [New Meeting] [New Task] [New Project]              ││
│ └─────────────────────────────────────────────────────┘│
│                                                          │
└─────────────────────────────────────────────────────────┘
```

**Components:**
- Daily briefing summary
- Enhanced Intelligence Dashboard (expandable)
- Recent activity feed
- Quick action buttons
- Upcoming meetings widget
- Task completion metrics

### 2. Meetings Page

**Route:** `/meetings`

**Features:**
- Meeting list with search and filters
- AI-powered meeting summaries
- Action item extraction
- Sentiment analysis
- Transcript view
- "Ask AI" Q&A about meeting content

**Meeting Detail UI:**
```
┌─────────────────────────────────────────────────────────┐
│ Meeting: Client Call - Acme Corp          Jan 24, 2:00PM│
├─────────────────────────────────────────────────────────┤
│                                                          │
│ [Summary] [Transcript] [Action Items] [Insights]       │
│                                                          │
│ 📝 AI Summary:                                          │
│ Discussed Q4 pricing, implementation timeline, and     │
│ technical requirements. Client expressed concerns      │
│ about integration complexity.                           │
│                                                          │
│ 🎯 Key Points:                                          │
│  • Pricing approved for Q4                             │
│  • Implementation starts Feb 1                          │
│  • Integration with existing CRM required              │
│                                                          │
│ 📋 Action Items (3):                                    │
│  ☐ Send proposal (John Doe, Due: Jan 26)              │
│  ☐ Schedule technical deep dive (Jane, Due: Jan 28)   │
│  ☐ Get legal approval (Legal Team, Due: Jan 30)       │
│                                                          │
│ 😊 Sentiment: Positive (85%)                            │
│                                                          │
│ 💬 Ask AI:                                              │
│ [What were the main concerns?]                          │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 3. Tasks Page

**Route:** `/tasks`

**Features:**
- Task list with multiple views (list, kanban)
- Filters (status, priority, assignee, due date)
- Bulk operations
- AI-suggested assignments
- Task dependencies
- Time tracking

**Task Card:**
```
┌─────────────────────────────────────────┐
│ 📌 Integrate CRM API                    │
│ Priority: 🔴 High                       │
│ Status: In Progress                     │
│ Assigned: Jane Smith                    │
│ Due: Jan 28                             │
│                                          │
│ [✓ Complete] [✏ Edit] [⋯ More]         │
└─────────────────────────────────────────┘
```

### 4. Projects Page

**Route:** `/projects`

**Features:**
- Project list and kanban view
- Create project from CRM deal
- Project dashboard with statistics
- Task management within projects
- Team collaboration
- Progress tracking

**Project Dashboard:**
```
┌─────────────────────────────────────────────────────────┐
│ Project: Acme Corp Implementation                       │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ Progress: ████████░░ 80%                                │
│                                                          │
│ Stats:                                                   │
│  Tasks: 12 total (8 done, 3 in progress, 1 blocked)    │
│  Team: 4 members                                        │
│  Due: Feb 28                                            │
│                                                          │
│ [To Do] [In Progress] [Done] [Blocked]                 │
│                                                          │
│ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│ │ Task 1   │ │ Task 4   │ │ Task 8   │ │ Task 12  │  │
│ │ Task 2   │ │ Task 5   │ │ Task 9   │ └──────────┘  │
│ │ Task 3   │ │ Task 6   │ │ Task 10  │               │
│ └──────────┘ │ Task 7   │ │ Task 11  │               │
│               └──────────┘ └──────────┘               │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 5. Agents Page

**Route:** `/agents`

**Features:**
- AI agent configuration
- Agent performance metrics
- Execution history
- Learning patterns (links to Learning Dashboard)

**Agent List:**
```
┌─────────────────────────────────────────────────────────┐
│ 🤖 AI Agents                                            │
├─────────────────────────────────────────────────────────┤
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 👤 Assignment Agent                  [✓ Enabled]  │  │
│ │ Automatically suggests task assignments           │  │
│ │                                                    │  │
│ │ Performance:                                       │  │
│ │  Accuracy: 78% | Overrides: 22%                   │  │
│ │  Active Patterns: 3                               │  │
│ │                                                    │  │
│ │ [Configure] [View History] [View Learning]       │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
│ ┌───────────────────────────────────────────────────┐  │
│ │ 🎯 Priority Agent                    [✓ Enabled]  │  │
│ │ Recommends task prioritization                    │  │
│ │                                                    │  │
│ │ Performance:                                       │  │
│ │  Accuracy: 82% | Overrides: 18%                   │  │
│ │  Active Patterns: 2                               │  │
│ │                                                    │  │
│ │ [Configure] [View History] [View Learning]       │  │
│ └───────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 6. Automations Page

**Route:** `/automations`

**Features:**
- Workflow builder (visual node-based editor)
- Rule-based automations
- Scheduled tasks
- Trigger configuration
- Action templates

**Workflow Builder:**
```
┌─────────────────────────────────────────────────────────┐
│ Workflow: New Deal Kickoff                    [Save]   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌─────────┐      ┌─────────┐      ┌─────────┐        │
│  │ Trigger │──────│ Action  │──────│ Action  │        │
│  │ New     │      │ Create  │      │ Notify  │        │
│  │ Deal    │      │ Project │      │ Team    │        │
│  └─────────┘      └─────────┘      └─────────┘        │
│                                                          │
│ Trigger: When deal stage changes to "Won"              │
│ Action 1: Create project from deal                     │
│ Action 2: Notify team in Pulse channel                 │
│                                                          │
│ [Add Trigger] [Add Action] [Add Condition]             │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### 7. Settings Page

**Route:** `/settings`

**Features:**
- User profile settings
- AI Learning preferences (link to Learning Dashboard)
- Integration settings (Logos Vision, Pulse)
- Notification preferences
- API keys management

**Tabs:**
- [Profile]
- [AI Learning]
- [Integrations]
- [Notifications]
- [Security]

---

## Design System & UI Patterns

### 1. Typography

```css
/* Headings */
h1: 24px, font-weight: 600 (Dashboard titles)
h2: 20px, font-weight: 600 (Card section headers)
h3: 18px, font-weight: 500 (Card titles)
h4: 16px, font-weight: 500 (Subsection headers)

/* Body */
body: 14px, font-weight: 400 (Regular text)
small: 12px, font-weight: 400 (Captions, meta info)

/* Font Family */
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', ...
```

### 2. Color System

```css
/* Primary Colors */
--primary-blue: #3B82F6;      /* Primary actions */
--primary-blue-dark: #2563EB; /* Hover state */
--primary-blue-light: #EFF6FF; /* Background */

/* Semantic Colors */
--success: #10B981;   /* Green - Success, positive, low risk */
--warning: #F59E0B;   /* Yellow - Warning, moderate risk */
--danger: #EF4444;    /* Red - Error, critical, high risk */
--info: #3B82F6;      /* Blue - Information */

/* Neutral Colors */
--gray-50: #F9FAFB;   /* Backgrounds */
--gray-100: #F3F4F6;  /* Subtle backgrounds */
--gray-200: #E5E7EB;  /* Borders */
--gray-300: #D1D5DB;  /* Dividers */
--gray-400: #9CA3AF;  /* Disabled text */
--gray-500: #6B7280;  /* Secondary text */
--gray-600: #4B5563;  /* Body text */
--gray-700: #374151;  /* Headings */
--gray-800: #1F2937;  /* Dark headings */
--gray-900: #111827;  /* Darkest text */

/* Sentiment Colors */
--sentiment-positive: #10B981;
--sentiment-neutral: #6B7280;
--sentiment-negative: #EF4444;
```

### 3. Spacing Scale

```css
/* Spacing (4px base unit) */
--spacing-1: 4px;    /* xs - tight spacing */
--spacing-2: 8px;    /* sm - compact spacing */
--spacing-3: 12px;   /* md - default spacing */
--spacing-4: 16px;   /* lg - comfortable spacing */
--spacing-5: 20px;   /* xl - loose spacing */
--spacing-6: 24px;   /* 2xl - section spacing */
--spacing-8: 32px;   /* 3xl - large gaps */
--spacing-12: 48px;  /* 4xl - major sections */
```

### 4. Border Radius

```css
--radius-sm: 4px;    /* Small elements (badges, pills) */
--radius-md: 6px;    /* Buttons, inputs */
--radius-lg: 8px;    /* Cards, modals */
--radius-xl: 12px;   /* Large cards */
--radius-full: 9999px; /* Pills, avatars */
```

### 5. Shadows

```css
--shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.05);
--shadow-md: 0 1px 3px rgba(0, 0, 0, 0.1);
--shadow-lg: 0 4px 6px rgba(0, 0, 0, 0.1);
--shadow-xl: 0 10px 15px rgba(0, 0, 0, 0.1);
```

### 6. Common UI Patterns

#### Card Pattern

```jsx
<div className="card">
  <div className="card-header">
    <h3>Card Title</h3>
    <button>Action</button>
  </div>
  <div className="card-content">
    {/* Content */}
  </div>
  <div className="card-footer">
    <button>Primary</button>
    <button>Secondary</button>
  </div>
</div>
```

```css
.card {
  background: var(--gray-50);
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-lg);
  padding: var(--spacing-4);
  box-shadow: var(--shadow-md);
}
```

#### Badge Pattern

```jsx
<span className="badge badge-success">Active</span>
<span className="badge badge-warning">Pending</span>
<span className="badge badge-danger">Critical</span>
```

```css
.badge {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: var(--radius-full);
  font-size: 12px;
  font-weight: 500;
}

.badge-success {
  background: #D1FAE5;
  color: #065F46;
}
```

#### Button Pattern

```jsx
<button className="btn btn-primary">Primary Action</button>
<button className="btn btn-secondary">Secondary</button>
<button className="btn btn-outline">Outline</button>
```

```css
.btn {
  padding: 8px 16px;
  border-radius: var(--radius-md);
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
}

.btn-primary {
  background: var(--primary-blue);
  color: white;
  border: none;
}

.btn-primary:hover {
  background: var(--primary-blue-dark);
}
```

---

## Integration Points

### 1. API Integration

**Base URL:** `http://localhost:3000/api`

**Authentication:** Clerk tokens via `Authorization: Bearer {token}` header

**Key Endpoints:**

```javascript
// Intelligence Dashboard
GET  /api/intelligence/dashboard
GET  /api/intelligence/meeting-prep/:meetingId
POST /api/intelligence/meeting-prep/:meetingId/brief
GET  /api/intelligence/deal-risks
GET  /api/intelligence/action-items
POST /api/intelligence/action-items/:itemId/nudge
GET  /api/intelligence/relationships/:dealId

// Explainability
GET  /api/agents/:agentType/execute (returns with explanation)
GET  /api/agents/executions/:executionId/explanation

// Learning
POST /api/learning/feedback/override
GET  /api/learning/patterns
POST /api/learning/patterns/:patternId/approve
POST /api/learning/patterns/:patternId/reject
GET  /api/learning/effectiveness-report
POST /api/learning/outcomes/:overrideId

// Core Features
GET  /api/meetings
POST /api/meetings
GET  /api/tasks
POST /api/tasks
GET  /api/projects
POST /api/projects
```

### 2. API Client Structure

**File:** `frontend/src/services/api.js`

```javascript
const api = {
  // Intelligence
  intelligenceApi: {
    getDashboard: (params) => axios.get('/intelligence/dashboard', { params }),
    getMeetingPrep: (meetingId) => axios.get(`/intelligence/meeting-prep/${meetingId}`),
    getDealRisks: (params) => axios.get('/intelligence/deal-risks', { params }),
    // ...
  },

  // Explainability
  explainabilityApi: {
    getExplanation: (executionId) => axios.get(`/agents/executions/${executionId}/explanation`),
    // ...
  },

  // Learning
  learningApi: {
    captureOverride: (override) => axios.post('/learning/feedback/override', override),
    getPatterns: (params) => axios.get('/learning/patterns', { params }),
    approvePattern: (patternId, customization) => axios.post(`/learning/patterns/${patternId}/approve`, { customization }),
    // ...
  },

  // Core features
  meetings: { /* ... */ },
  tasks: { /* ... */ },
  projects: { /* ... */ },
  // ...
};
```

### 3. Real-time Updates

**Supabase Realtime Subscriptions:**

```javascript
// Example: Real-time task updates
useEffect(() => {
  const subscription = supabase
    .channel('tasks')
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'tasks'
    }, (payload) => {
      // Update local state
      handleTaskUpdate(payload.new);
    })
    .subscribe();

  return () => subscription.unsubscribe();
}, []);
```

---

## Mobile & Responsive Considerations

### 1. Breakpoints

```css
/* Mobile First Approach */
@media (min-width: 640px) {  /* sm */}
@media (min-width: 768px) {  /* md - tablets */}
@media (min-width: 1024px) { /* lg - laptops */}
@media (min-width: 1280px) { /* xl - desktops */}
```

### 2. Responsive Dashboard

**Desktop (lg+):**
- 2-column grid for intelligence cards
- Side-by-side card layout
- Expanded details visible by default

**Tablet (md):**
- 1-column stacked layout
- Cards full width
- Expandable details on demand

**Mobile (sm):**
- Single column
- Compact card views
- Simplified quick actions
- Bottom sheet modals instead of sidebars

### 3. Touch Targets

- Minimum 44x44px for all interactive elements
- Increased padding on mobile buttons
- Swipe gestures for card navigation
- Pull-to-refresh on lists

---

## Accessibility Requirements

### 1. WCAG 2.1 AA Compliance

- **Color Contrast:** 4.5:1 minimum for text
- **Keyboard Navigation:** All interactive elements focusable
- **Screen Readers:** ARIA labels on all icons and controls
- **Focus Indicators:** Visible focus states

### 2. ARIA Labels

```jsx
<button
  aria-label="Expand meeting details"
  onClick={handleExpand}
>
  {expanded ? '▲' : '▼'}
</button>

<div
  role="region"
  aria-label="AI-generated explanation"
>
  {/* Explanation content */}
</div>
```

### 3. Semantic HTML

- Use `<nav>`, `<main>`, `<section>`, `<article>`
- Proper heading hierarchy (h1 → h2 → h3)
- Form labels associated with inputs
- Button vs. link usage (buttons for actions, links for navigation)

### 4. Focus Management

```javascript
// Trap focus in modals
useFocusTrap(modalRef, isOpen);

// Return focus after modal close
useEffect(() => {
  if (!isOpen && previousFocusRef.current) {
    previousFocusRef.current.focus();
  }
}, [isOpen]);
```

---

## Implementation Priorities

### Phase 1: Core Intelligence (Weeks 1-2)
1. **Enhanced Intelligence Dashboard**
   - IntelligenceDashboard.jsx container
   - ExpandableCard.jsx reusable component
   - MeetingPrepCard.jsx
   - DealRiskAlertCard.jsx
   - API integration

**Success Criteria:**
- Dashboard loads in <2 seconds
- Auto-refresh every 5 minutes
- Cards expand/collapse smoothly
- Mobile responsive

### Phase 2: Explainability Layer (Weeks 2-3)
1. **AI Explainability Components**
   - ExplanationCard.jsx
   - FactorList.jsx with progress bars
   - AlternativesList.jsx
   - ConfidenceBadge.jsx
   - Integration with all 4 agents

**Success Criteria:**
- Users understand AI decisions (>80% in survey)
- Explanations load in <200ms
- Alternatives selectable
- Confidence badges accurate

### Phase 3: Learning System (Weeks 3-4)
1. **Learning Components**
   - FeedbackPrompt.jsx modal
   - LearningDashboard.jsx with tabs
   - PatternCard.jsx
   - PatternApprovalModal.jsx
   - EffectivenessReport.jsx

**Success Criteria:**
- Feedback prompts appear on override
- Patterns detected after 3+ overrides
- Approval workflow functional
- Effectiveness metrics accurate

### Phase 4: Action Items & Relationships (Week 4-5)
1. **Remaining Intelligence Cards**
   - ActionItemStatusCard.jsx
   - RelationshipInsightCard.jsx
   - Blocking chain visualizer
   - Coverage gap indicators

**Success Criteria:**
- Blocking chains display correctly
- Stakeholder roles classified
- Coverage gaps detected
- Quick actions functional

### Phase 5: Polish & Optimization (Week 5-6)
1. **UI/UX Refinement**
   - Animations and transitions
   - Loading states and skeletons
   - Error handling
   - Performance optimization
   - Accessibility audit

**Success Criteria:**
- No layout shifts (CLS score <0.1)
- All interactions smooth (60fps)
- Lighthouse accessibility score >90
- Zero console errors

---

## Success Metrics

### User Engagement
- Dashboard daily active users: >80%
- Card expansion rate: >50%
- Quick action usage: >35%
- Time on dashboard: 5-10 minutes/day

### AI Effectiveness
- Override rate: <20% (from 35%)
- Pattern approval rate: >70%
- Learning system adoption: >60%
- User trust in AI: +40% (survey)

### Performance
- Dashboard load time: <2 seconds (p95)
- API response time: <500ms (p95)
- Explainability generation: <200ms (p95)
- Pattern detection: <1 second

### Quality
- Bug-free deployment
- Accessibility score: >90
- Mobile usability: 100%
- User satisfaction: NPS >50

---

## Appendix: Quick Reference

### Component Naming Conventions

```
[Feature][Type][Variant].jsx

Examples:
- MeetingPrepCard.jsx
- DealRiskAlertCard.jsx
- ExplanationCardExpanded.jsx
- FeedbackPromptModal.jsx
```

### CSS Class Naming (BEM)

```
.block__element--modifier

Examples:
- .intelligence-card
- .intelligence-card__header
- .intelligence-card--expanded
- .explanation-factor
- .explanation-factor__score
- .explanation-factor--strong
```

### State Management Pattern

```javascript
// Standard pattern for all components
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
```

### Error Handling Pattern

```javascript
// Show user-friendly error messages
if (error) {
  return (
    <div className="error-state">
      <p>😕 Something went wrong</p>
      <p className="error-message">{error}</p>
      <button onClick={loadData}>Try Again</button>
    </div>
  );
}
```

### Loading State Pattern

```javascript
// Show skeleton loaders during loading
if (loading) {
  return (
    <div className="loading-skeleton">
      <div className="skeleton-header" />
      <div className="skeleton-content" />
      <div className="skeleton-footer" />
    </div>
  );
}
```

---

**Document Version:** 1.0
**Created:** 2026-01-24
**Status:** Complete
**Next Review:** Before UI redesign kickoff

**Related Documents:**
- [ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md](./ENHANCED-INTELLIGENCE-DASHBOARD-DESIGN.md)
- [AI-EXPLAINABILITY-LAYER-DESIGN.md](./AI-EXPLAINABILITY-LAYER-DESIGN.md)
- [AGENT-FEEDBACK-LOOP-LEARNING-DESIGN.md](./AGENT-FEEDBACK-LOOP-LEARNING-DESIGN.md)
- [ENHANCED-INTELLIGENCE-COMPLETE.md](./ENHANCED-INTELLIGENCE-COMPLETE.md)
- [LEARNING-SYSTEM-COMPLETE.md](./LEARNING-SYSTEM-COMPLETE.md)
- [ENTOMATE-PLANNING-GUIDE.md](./ENTOMATE-PLANNING-GUIDE.md)

---

**For Questions or Clarification:**
Refer to the design documents above or consult the implementation code in:
- `frontend/src/components/intelligence/`
- `frontend/src/components/explainability/`
- `frontend/src/components/learning/`
- `backend/services/intelligence/`
- `backend/services/explainability/`
- `backend/services/learning/`
