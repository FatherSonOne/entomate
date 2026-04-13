# AI Explainability Layer - Design Document

**Project:** Entomate AI-Powered Meeting Intelligence Platform
**Feature:** AI Explainability Layer (Tier 1 AI Enhancement)
**Version:** 1.0
**Date:** 2026-01-24
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Design Principles](#design-principles)
4. [User Experience Design](#user-experience-design)
5. [Technical Architecture](#technical-architecture)
6. [Implementation Plan](#implementation-plan)
7. [Success Metrics](#success-metrics)

---

## Executive Summary

### Purpose

Add transparent, user-friendly explanations to all AI agent decisions in Entomate, helping users understand **WHY** agents made specific recommendations and building trust in AI-powered automation.

### Current State

**Problem:**
- AI agents (Assignment, Priority, Deadline, Follow-up) make recommendations
- Users see the **WHAT** (the recommendation) but not the **WHY**
- No visibility into decision factors, weights, or alternatives considered
- Users can't learn from AI reasoning or validate recommendations
- Low trust leads to frequent overrides and manual decision-making

**Example Current Experience:**
```
✅ Assigned to: John Doe
[Accept] [Change Assignment]
```

### Desired State

**Adaptive Explainability UI** (based on user selection):

**Concise View (Default):**
```
✅ Recommended: John Doe (87% confidence)

Top Factors:
  • Skill Match: 90% ✓ Has API integration experience
  • Workload: 85% ✓ 3 tasks vs team avg 5
  • Availability: 75% ⚠ Available after 2PM

[Accept] [Change Assignment] [Show More Details ▼]
```

**Expanded View (On Click):**
```
✅ Recommended: John Doe (87% confidence)

All Decision Factors (Weighted):
  1. Skill Match (40% weight): 90/100
     • Has API integration experience (5 past projects)
     • Completed similar tasks with 94% success rate
     • Domain expertise: CRM integrations, Node.js

  2. Current Workload (30% weight): 85/100
     • Active tasks: 3 vs team average: 5
     • Est. capacity: 15 hours this week
     • Recent completion rate: 96%

  3. Availability (20% weight): 75/100
     • Calendar: Available after 2PM today
     • No PTO scheduled in next 2 weeks
     • Recent response time: 2 hours avg

  4. Past Performance (10% weight): 92/100
     • On-time delivery: 96%
     • Quality score: 4.8/5.0
     • Client satisfaction: Positive feedback

Alternatives Considered:
  • Jane Smith (72%) - Qualified but higher current workload (7 tasks)
  • Mike Johnson (68%) - Available but less API experience
  • Sarah Chen (45%) - On vacation next week

Why Not Higher Ranked Alternatives?
  • Jane: Workload score 60/100 (too many active tasks)
  • Mike: Skill match 65/100 (no CRM integration experience)

[Accept] [Assign to Jane Instead] [Hide Details ▲]
```

### Design Decisions (User Selected)

1. **UI Pattern:** Adaptive (concise default, expandable for details)
2. **Transparency:** Show all factors, weights, and alternatives
3. **Actionability:** Include alternative recommendations
4. **Learning:** Surface patterns users can learn from

---

## Problem Statement

### User Pain Points

**1. Trust Deficit**
> "I don't know why the AI assigned this to John. Is it considering that Jane has the client relationship?"

**Impact:** Users override AI recommendations without understanding reasoning

**2. No Learning Opportunity**
> "I can't learn from the AI's logic because I don't see how it thinks."

**Impact:** Users don't improve their own decision-making over time

**3. Hidden Biases**
> "What if the AI is biased toward certain team members? I can't tell."

**Impact:** Fairness concerns and reduced adoption

**4. Debugging Difficulty**
> "When the AI is wrong, I can't tell what went wrong or how to fix it."

**Impact:** Poor AI quality persists without visibility into failure modes

### Business Impact

- **Low AI Adoption:** Only 40% of users trust AI recommendations
- **High Override Rate:** 35% of AI recommendations are manually overridden
- **Reduced Efficiency:** Users spend time second-guessing AI instead of acting
- **Missed Learning:** AI doesn't improve because users can't provide targeted feedback

---

## Design Principles

### 1. Transparency Without Overwhelm

**Principle:** Show enough to build trust, not so much that users are paralyzed.

**Implementation:**
- Default to concise view (3 top factors)
- Expand on demand for full details
- Progressive disclosure of complexity

### 2. Factor-Based Explanations

**Principle:** Explain decisions through discrete, measurable factors.

**Implementation:**
- Each factor has a clear name, score, and weight
- Factors map to understandable concepts (Skill, Workload, Availability)
- Scores are normalized (0-100) for consistency

### 3. Show Alternatives, Not Just Winner

**Principle:** Context comes from comparing options.

**Implementation:**
- Show top 3-5 alternatives with scores
- Explain why they ranked lower
- Make it easy to choose an alternative

### 4. Humanize AI Reasoning

**Principle:** Use natural language, not technical jargon.

**Implementation:**
- "John has API integration experience" not "Feature vector match: 0.94"
- "3 tasks vs team avg 5" not "Workload coefficient: 0.60"
- Visual indicators (✓ ⚠ ✗) for quick scanning

### 5. Consistent Across All Agents

**Principle:** Same explanation format for all AI agents.

**Implementation:**
- Standardized factor structure
- Reusable UI components
- Shared ExplainabilityService

---

## User Experience Design

### UI Components

#### 1. Concise Explanation (Default State)

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Recommended: John Doe                  Confidence: 87%   │
│                                                              │
│ Top Factors:                                                │
│  • Skill Match: 90%        ✓ Has API integration experience │
│  • Workload: 85%           ✓ 3 tasks vs team avg 5          │
│  • Availability: 75%       ⚠ Available after 2PM            │
│                                                              │
│ [✓ Accept] [↻ Change] [▼ Show More Details]                │
└─────────────────────────────────────────────────────────────┘
```

**Design Specs:**
- **Card Style:** Subtle border, light background (#F9FAFB)
- **Confidence Badge:** Green (>80%), Yellow (60-80%), Red (<60%)
- **Factor Icons:** ✓ (strong), ⚠ (moderate), ✗ (weak)
- **Spacing:** 16px padding, 8px between factors
- **Typography:** Factor name (bold), score (medium), detail (regular)

#### 2. Expanded Explanation (On Demand)

**Visual Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ ✅ Recommended: John Doe                  Confidence: 87%   │
│                                                              │
│ All Decision Factors (Weighted):                            │
│                                                              │
│  1. Skill Match (40% weight)                    90/100 ✓   │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━    │
│     • Has API integration experience (5 past projects)      │
│     • Completed similar tasks with 94% success rate         │
│     • Domain expertise: CRM integrations, Node.js           │
│                                                              │
│  2. Current Workload (30% weight)               85/100 ✓   │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━         │
│     • Active tasks: 3 vs team average: 5                    │
│     • Est. capacity: 15 hours this week                     │
│     • Recent completion rate: 96%                           │
│                                                              │
│  3. Availability (20% weight)                   75/100 ⚠   │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━                │
│     • Calendar: Available after 2PM today                   │
│     • No PTO scheduled in next 2 weeks                      │
│     • Recent response time: 2 hours avg                     │
│                                                              │
│  4. Past Performance (10% weight)               92/100 ✓   │
│     ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━      │
│     • On-time delivery: 96%                                 │
│     • Quality score: 4.8/5.0                                │
│     • Client satisfaction: Positive feedback                │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Alternatives Considered:                                    │
│                                                              │
│  2. Jane Smith                                  72/100      │
│     Why lower: Higher workload (7 active tasks)            │
│     [Assign to Jane Instead]                                │
│                                                              │
│  3. Mike Johnson                                68/100      │
│     Why lower: Less API integration experience             │
│     [Assign to Mike Instead]                                │
│                                                              │
│  4. Sarah Chen                                  45/100      │
│     Why lower: On vacation next week                       │
│                                                              │
│ [✓ Accept John] [↻ Pick Different] [▲ Hide Details]        │
└─────────────────────────────────────────────────────────────┘
```

**Design Specs:**
- **Progress Bars:** Filled to score percentage, color-coded (green >80, yellow 60-80, red <60)
- **Factor Details:** Indented bullet points, 14px font
- **Alternatives:** Collapsible list, quick action buttons
- **Animation:** Smooth expand/collapse (300ms ease-in-out)

#### 3. Explanation for Different Agent Types

**Assignment Agent:**
```
Factors:
  • Skill Match (40%)
  • Current Workload (30%)
  • Availability (20%)
  • Past Performance (10%)
```

**Priority Agent:**
```
Factors:
  • Business Impact (40%) - Revenue impact, strategic importance
  • Urgency (30%) - Due date, blocking relationships
  • Effort Estimation (20%) - Complexity, time required
  • Risk Level (10%) - Technical risk, dependency risk
```

**Deadline Agent:**
```
Factors:
  • Task Complexity (35%) - Estimated hours, dependencies
  • Team Velocity (30%) - Historical completion rates
  • Buffer Calculation (25%) - Risk buffer, quality buffer
  • Business Constraints (10%) - Hard deadlines, milestones
```

**Follow-up Agent:**
```
Factors:
  • Follow-up Likelihood (40%) - Pattern detection score
  • Context Importance (30%) - Deal value, stage, sentiment
  • Time Sensitivity (20%) - Days since commitment, urgency
  • Relationship Health (10%) - Engagement level, sentiment
```

#### 4. Confidence Indicators

**Confidence Score Calculation:**
```javascript
function calculateConfidence(factors, alternatives) {
  // Base confidence from factor scores
  const avgFactorScore = weightedAverage(factors);

  // Reduce confidence if alternatives are close
  const topAlternativeScore = alternatives[0]?.score || 0;
  const scoreSeparation = recommendedScore - topAlternativeScore;

  // Confidence decreases if separation < 15 points
  const separationPenalty = Math.max(0, (15 - scoreSeparation) * 2);

  // Reduce confidence if any critical factor is low
  const criticalFactorPenalty = factors
    .filter(f => f.weight >= 0.3 && f.score < 60)
    .reduce((sum, f) => sum + (60 - f.score), 0);

  return Math.max(0, Math.min(100,
    avgFactorScore - separationPenalty - criticalFactorPenalty
  ));
}
```

**Confidence Badges:**
- **High Confidence (80-100%):** 🟢 Green badge, "Highly Confident"
- **Medium Confidence (60-79%):** 🟡 Yellow badge, "Moderately Confident"
- **Low Confidence (<60%):** 🔴 Red badge, "Low Confidence - Review Carefully"

---

## Technical Architecture

### Backend Architecture

#### Explainability Service

**File:** `backend/services/explainability/ExplainabilityService.js`

```javascript
class ExplainabilityService {
  /**
   * Generate explanation for any AI agent decision
   * @param {string} agentType - Type of agent (assignment, priority, deadline, followup)
   * @param {Object} recommendation - The agent's recommendation
   * @param {Object} context - Full decision context
   * @returns {Object} Structured explanation
   */
  async generateExplanation(agentType, recommendation, context) {
    // Get factor definitions for this agent type
    const factorDefinitions = this.getFactorDefinitions(agentType);

    // Calculate scores for each factor
    const factors = await this.calculateFactors(
      factorDefinitions,
      recommendation,
      context
    );

    // Calculate alternatives
    const alternatives = await this.calculateAlternatives(
      agentType,
      recommendation,
      context
    );

    // Calculate confidence
    const confidence = this.calculateConfidence(factors, alternatives);

    // Generate natural language details
    const naturalLanguage = await this.generateNaturalLanguage(
      factors,
      alternatives,
      context
    );

    return {
      recommendation: recommendation,
      confidence: confidence,
      factors: factors.map(f => ({
        name: f.name,
        weight: f.weight,
        score: f.score,
        impact: this.getImpactLevel(f.score),
        details: f.details,
        naturalLanguage: f.naturalLanguage
      })),
      alternatives: alternatives.map(alt => ({
        option: alt.option,
        score: alt.totalScore,
        whyLower: alt.whyLower,
        factors: alt.factors
      })),
      metadata: {
        agentType: agentType,
        executedAt: new Date().toISOString(),
        version: '1.0'
      }
    };
  }

  /**
   * Get factor definitions for agent type
   */
  getFactorDefinitions(agentType) {
    const definitions = {
      assignment: [
        {
          name: 'Skill Match',
          weight: 0.40,
          calculator: 'calculateSkillMatch'
        },
        {
          name: 'Current Workload',
          weight: 0.30,
          calculator: 'calculateWorkload'
        },
        {
          name: 'Availability',
          weight: 0.20,
          calculator: 'calculateAvailability'
        },
        {
          name: 'Past Performance',
          weight: 0.10,
          calculator: 'calculatePerformance'
        }
      ],
      priority: [
        {
          name: 'Business Impact',
          weight: 0.40,
          calculator: 'calculateBusinessImpact'
        },
        {
          name: 'Urgency',
          weight: 0.30,
          calculator: 'calculateUrgency'
        },
        {
          name: 'Effort Estimation',
          weight: 0.20,
          calculator: 'calculateEffort'
        },
        {
          name: 'Risk Level',
          weight: 0.10,
          calculator: 'calculateRisk'
        }
      ],
      deadline: [
        {
          name: 'Task Complexity',
          weight: 0.35,
          calculator: 'calculateComplexity'
        },
        {
          name: 'Team Velocity',
          weight: 0.30,
          calculator: 'calculateVelocity'
        },
        {
          name: 'Buffer Calculation',
          weight: 0.25,
          calculator: 'calculateBuffer'
        },
        {
          name: 'Business Constraints',
          weight: 0.10,
          calculator: 'calculateConstraints'
        }
      ],
      followup: [
        {
          name: 'Follow-up Likelihood',
          weight: 0.40,
          calculator: 'calculateFollowupLikelihood'
        },
        {
          name: 'Context Importance',
          weight: 0.30,
          calculator: 'calculateContextImportance'
        },
        {
          name: 'Time Sensitivity',
          weight: 0.20,
          calculator: 'calculateTimeSensitivity'
        },
        {
          name: 'Relationship Health',
          weight: 0.10,
          calculator: 'calculateRelationshipHealth'
        }
      ]
    };

    return definitions[agentType] || [];
  }

  /**
   * Calculate all factors with scores and details
   */
  async calculateFactors(factorDefinitions, recommendation, context) {
    const results = [];

    for (const def of factorDefinitions) {
      const calculator = this[def.calculator];
      if (!calculator) {
        console.warn(`Calculator not found: ${def.calculator}`);
        continue;
      }

      const result = await calculator.call(this, recommendation, context);

      results.push({
        name: def.name,
        weight: def.weight,
        score: result.score,
        details: result.details,
        naturalLanguage: result.naturalLanguage
      });
    }

    return results;
  }

  /**
   * Calculate skill match score (for Assignment Agent)
   */
  async calculateSkillMatch(recommendation, context) {
    const { task, candidate } = recommendation;

    // Extract required skills from task
    const requiredSkills = await this.extractRequiredSkills(task);

    // Get candidate's skill profile
    const candidateSkills = await this.getCandidateSkills(candidate);

    // Calculate overlap
    const matchedSkills = requiredSkills.filter(req =>
      candidateSkills.some(cs => cs.skill === req.skill && cs.level >= req.level)
    );

    // Score calculation
    const score = (matchedSkills.length / requiredSkills.length) * 100;

    // Generate details
    const details = [
      `Matched ${matchedSkills.length}/${requiredSkills.length} required skills`,
      ...matchedSkills.slice(0, 3).map(s =>
        `${s.skill}: ${s.experienceYears} years experience`
      )
    ];

    // Natural language
    const topSkills = matchedSkills.slice(0, 2).map(s => s.skill).join(', ');
    const naturalLanguage = matchedSkills.length > 0
      ? `Has ${topSkills} experience`
      : 'Limited relevant experience';

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate workload score (for Assignment Agent)
   */
  async calculateWorkload(recommendation, context) {
    const { candidate } = recommendation;

    // Get current workload
    const activeTasks = await this.getActiveTasks(candidate.id);
    const totalHours = activeTasks.reduce((sum, t) => sum + t.estimatedHours, 0);

    // Get team average
    const teamAvg = await this.getTeamAverageWorkload(candidate.teamId);

    // Score: 100 = no load, 0 = maxed out (40 hours)
    const score = Math.max(0, 100 - (totalHours / 40) * 100);

    const details = [
      `Active tasks: ${activeTasks.length} vs team avg: ${Math.round(teamAvg.avgTasks)}`,
      `Estimated capacity: ${40 - totalHours} hours this week`,
      `Recent completion rate: ${candidate.recentCompletionRate}%`
    ];

    const naturalLanguage = totalHours < teamAvg.avgHours
      ? `${activeTasks.length} tasks vs team avg ${Math.round(teamAvg.avgTasks)}`
      : `Higher workload (${activeTasks.length} tasks)`;

    return {
      score: Math.round(score),
      details: details,
      naturalLanguage: naturalLanguage
    };
  }

  /**
   * Calculate alternatives with reasoning
   */
  async calculateAlternatives(agentType, recommendation, context) {
    // Get all possible options
    const allOptions = await this.getAllOptions(agentType, context);

    // Score each option
    const scoredOptions = await Promise.all(
      allOptions.map(async option => {
        const factors = await this.calculateFactors(
          this.getFactorDefinitions(agentType),
          { ...recommendation, candidate: option },
          context
        );

        const totalScore = this.calculateWeightedScore(factors);

        return {
          option: option,
          factors: factors,
          totalScore: totalScore
        };
      })
    );

    // Sort by score
    scoredOptions.sort((a, b) => b.totalScore - a.totalScore);

    // Top recommendation
    const recommended = scoredOptions[0];

    // Top alternatives (excluding recommended)
    const alternatives = scoredOptions.slice(1, 4).map(alt => {
      // Find weakest factor
      const weakestFactor = alt.factors
        .sort((a, b) => a.score - b.score)[0];

      return {
        option: alt.option,
        totalScore: Math.round(alt.totalScore),
        whyLower: `${weakestFactor.name}: ${weakestFactor.naturalLanguage}`,
        factors: alt.factors
      };
    });

    return alternatives;
  }

  /**
   * Calculate weighted total score
   */
  calculateWeightedScore(factors) {
    return factors.reduce((sum, f) => sum + (f.score * f.weight), 0);
  }

  /**
   * Calculate confidence score
   */
  calculateConfidence(factors, alternatives) {
    const avgFactorScore = this.calculateWeightedScore(factors);

    // Penalty if top alternative is close
    const topAltScore = alternatives[0]?.totalScore || 0;
    const separation = avgFactorScore - topAltScore;
    const separationPenalty = Math.max(0, (15 - separation) * 2);

    // Penalty if critical factors are weak
    const criticalFactorPenalty = factors
      .filter(f => f.weight >= 0.3 && f.score < 60)
      .reduce((sum, f) => sum + (60 - f.score), 0);

    const confidence = Math.max(0, Math.min(100,
      avgFactorScore - separationPenalty - criticalFactorPenalty
    ));

    return Math.round(confidence);
  }

  /**
   * Get impact level from score
   */
  getImpactLevel(score) {
    if (score >= 80) return 'strong';
    if (score >= 60) return 'moderate';
    return 'weak';
  }
}

module.exports = new ExplainabilityService();
```

#### Integration with AI Agents

**Enhanced Agent Response Format:**

```javascript
// Before (without explainability):
{
  recommendation: "John Doe",
  confidence: 0.87
}

// After (with explainability):
{
  recommendation: "John Doe",
  confidence: 87,
  explanation: {
    factors: [
      {
        name: "Skill Match",
        weight: 0.40,
        score: 90,
        impact: "strong",
        details: [
          "Matched 4/5 required skills",
          "API integration: 5 years experience",
          "Node.js: 3 years experience"
        ],
        naturalLanguage: "Has API integration experience"
      },
      // ... more factors
    ],
    alternatives: [
      {
        option: { id: "user-2", name: "Jane Smith" },
        totalScore: 72,
        whyLower: "Current Workload: Higher workload (7 active tasks)",
        factors: [...]
      },
      // ... more alternatives
    ],
    metadata: {
      agentType: "assignment",
      executedAt: "2026-01-24T10:30:00Z",
      version: "1.0"
    }
  }
}
```

**Modified Agent Execution:**

```javascript
// backend/services/aiAgentService.js

class AIAgentService {
  async executeAgent(agentType, context) {
    // Get base recommendation (existing logic)
    const recommendation = await this.getRecommendation(agentType, context);

    // Generate explanation
    const explanation = await explainabilityService.generateExplanation(
      agentType,
      recommendation,
      context
    );

    // Return recommendation with explanation
    return {
      ...recommendation,
      explanation: explanation
    };
  }
}
```

### Frontend Architecture

#### Component Structure

```
frontend/src/components/explainability/
├── ExplanationCard.jsx              # Adaptive explanation container
├── FactorList.jsx                   # List of decision factors
├── FactorDetail.jsx                 # Individual factor with score
├── ProgressBar.jsx                  # Visual score bar
├── AlternativesList.jsx             # Alternative recommendations
├── ConfidenceBadge.jsx              # Confidence indicator
└── ExplanationModal.jsx             # Full-screen explanation view
```

#### Explanation Card Component

**File:** `frontend/src/components/explainability/ExplanationCard.jsx`

```jsx
import React, { useState } from 'react';
import FactorList from './FactorList';
import AlternativesList from './AlternativesList';
import ConfidenceBadge from './ConfidenceBadge';

export default function ExplanationCard({
  recommendation,
  explanation,
  onAccept,
  onChangeRecommendation
}) {
  const [expanded, setExpanded] = useState(false);

  if (!explanation) {
    return (
      <div className="explanation-card">
        <div className="recommendation-header">
          ✅ Recommended: {recommendation.label}
          <button onClick={onAccept}>Accept</button>
          <button onClick={() => onChangeRecommendation(null)}>Change</button>
        </div>
      </div>
    );
  }

  const { factors, alternatives, confidence } = explanation;

  // Top 3 factors for concise view
  const topFactors = factors.slice(0, 3);

  return (
    <div className={`explanation-card ${expanded ? 'expanded' : ''}`}>
      {/* Header */}
      <div className="recommendation-header">
        <div className="recommendation-title">
          ✅ Recommended: {recommendation.label}
        </div>
        <ConfidenceBadge confidence={confidence} />
      </div>

      {/* Concise View (Always Visible) */}
      <div className="factors-concise">
        <h4>Top Factors:</h4>
        <FactorList
          factors={topFactors}
          compact={true}
          showWeights={false}
        />
      </div>

      {/* Expanded View (On Demand) */}
      {expanded && (
        <div className="explanation-expanded">
          <div className="factors-detailed">
            <h4>All Decision Factors (Weighted):</h4>
            <FactorList
              factors={factors}
              compact={false}
              showWeights={true}
              showProgressBars={true}
            />
          </div>

          <div className="divider" />

          <div className="alternatives">
            <h4>Alternatives Considered:</h4>
            <AlternativesList
              alternatives={alternatives}
              onSelect={onChangeRecommendation}
            />
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="explanation-actions">
        <button
          onClick={onAccept}
          className="btn-primary"
        >
          ✓ Accept {recommendation.label}
        </button>

        <button
          onClick={() => onChangeRecommendation(null)}
          className="btn-secondary"
        >
          ↻ Pick Different
        </button>

        <button
          onClick={() => setExpanded(!expanded)}
          className="btn-expand"
        >
          {expanded ? '▲ Hide Details' : '▼ Show More Details'}
        </button>
      </div>
    </div>
  );
}
```

#### Factor List Component

**File:** `frontend/src/components/explainability/FactorList.jsx`

```jsx
import React from 'react';
import FactorDetail from './FactorDetail';

export default function FactorList({
  factors,
  compact = false,
  showWeights = false,
  showProgressBars = false
}) {
  return (
    <div className={`factor-list ${compact ? 'compact' : 'detailed'}`}>
      {factors.map((factor, index) => (
        <FactorDetail
          key={index}
          factor={factor}
          rank={index + 1}
          compact={compact}
          showWeight={showWeights}
          showProgressBar={showProgressBars}
        />
      ))}
    </div>
  );
}
```

#### Factor Detail Component

**File:** `frontend/src/components/explainability/FactorDetail.jsx`

```jsx
import React from 'react';
import ProgressBar from './ProgressBar';

export default function FactorDetail({
  factor,
  rank,
  compact = false,
  showWeight = false,
  showProgressBar = false
}) {
  const { name, weight, score, impact, details, naturalLanguage } = factor;

  // Impact icon
  const impactIcon = {
    strong: '✓',
    moderate: '⚠',
    weak: '✗'
  }[impact];

  if (compact) {
    return (
      <div className="factor-compact">
        <span className="factor-name">{name}: {score}%</span>
        <span className={`impact-icon impact-${impact}`}>{impactIcon}</span>
        <span className="factor-summary">{naturalLanguage}</span>
      </div>
    );
  }

  return (
    <div className="factor-detailed">
      <div className="factor-header">
        <span className="factor-rank">{rank}.</span>
        <span className="factor-name">{name}</span>
        {showWeight && (
          <span className="factor-weight">({Math.round(weight * 100)}% weight)</span>
        )}
        <span className="factor-score">
          {score}/100 <span className={`impact-icon impact-${impact}`}>{impactIcon}</span>
        </span>
      </div>

      {showProgressBar && (
        <ProgressBar value={score} max={100} />
      )}

      <div className="factor-details">
        {details.map((detail, i) => (
          <div key={i} className="detail-item">• {detail}</div>
        ))}
      </div>
    </div>
  );
}
```

#### Alternatives List Component

**File:** `frontend/src/components/explainability/AlternativesList.jsx`

```jsx
import React from 'react';

export default function AlternativesList({ alternatives, onSelect }) {
  return (
    <div className="alternatives-list">
      {alternatives.map((alt, index) => (
        <div key={index} className="alternative-item">
          <div className="alternative-header">
            <span className="alternative-rank">{index + 2}.</span>
            <span className="alternative-name">{alt.option.label}</span>
            <span className="alternative-score">{alt.totalScore}/100</span>
          </div>

          <div className="alternative-reason">
            Why lower: {alt.whyLower}
          </div>

          <button
            onClick={() => onSelect(alt.option)}
            className="btn-select-alternative"
          >
            Assign to {alt.option.label} Instead
          </button>
        </div>
      ))}
    </div>
  );
}
```

### API Endpoints

**Route:** `backend/routes/agents.js` (Enhanced)

```javascript
// Execute agent with explanation
router.post(
  '/:agentType/execute',
  authenticateToken,
  rateLimit('ai'),
  async (req, res) => {
    try {
      const { agentType } = req.params;
      const context = req.body;

      // Execute agent (now includes explanation)
      const result = await aiAgentService.executeAgent(agentType, context);

      res.json({ success: true, data: result });
    } catch (error) {
      console.error('[Agents] Execute error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get explanation for past agent execution
router.get(
  '/executions/:executionId/explanation',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { executionId } = req.params;

      // Retrieve stored explanation
      const explanation = await aiAgentService.getExplanation(executionId);

      res.json({ success: true, data: explanation });
    } catch (error) {
      console.error('[Agents] Explanation retrieval error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);
```

### Database Schema

**New Tables:**

```sql
-- ========================================
-- Explainability Schema
-- ========================================

-- Store agent execution explanations
CREATE TABLE agent_explanations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_execution_id UUID NOT NULL REFERENCES agent_executions(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  recommendation JSONB NOT NULL, -- The recommended option
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  factors JSONB NOT NULL, -- Array of factor objects
  alternatives JSONB NOT NULL, -- Array of alternative options
  metadata JSONB, -- Execution metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(agent_execution_id)
);

CREATE INDEX idx_agent_explanations_execution ON agent_explanations(agent_execution_id);
CREATE INDEX idx_agent_explanations_type ON agent_explanations(agent_type);
CREATE INDEX idx_agent_explanations_created ON agent_explanations(created_at);

-- Enable RLS
ALTER TABLE agent_explanations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view explanations for their agent executions"
  ON agent_explanations FOR SELECT
  USING (
    agent_execution_id IN (
      SELECT id FROM agent_executions WHERE user_id = auth.uid()
    )
  );
```

---

## Implementation Plan

### Phase 1: Backend Foundation (Week 1)

**BE-ARCHITECT + BE-BUILDER**

#### Tasks:
1. Create `ExplainabilityService.js` with core logic
2. Implement factor calculators for Assignment Agent
3. Implement alternative calculation logic
4. Modify `aiAgentService.js` to include explanations
5. Create database schema (SQL migration)
6. Write unit tests for scoring algorithms

**Deliverables:**
- Explainability service with full documentation
- Modified AI agent service
- Database migration script
- API endpoints returning explanations

**Test Cases:**
- Factor scores sum correctly with weights
- Confidence calculation is accurate
- Alternatives are properly ranked
- Natural language generation is clear

---

### Phase 2: Assignment Agent Integration (Week 1-2)

**BE-BUILDER → BE-QA**

#### Tasks:
1. Implement all 4 factor calculators (Skill, Workload, Availability, Performance)
2. Create skill extraction logic
3. Implement workload calculation
4. Test with real assignment scenarios
5. Validate explanation quality

**Test Cases:**
- Skill match accurately identifies relevant experience
- Workload correctly counts active tasks
- Availability considers calendar and PTO
- Performance metrics reflect historical data
- Explanations make sense to non-technical users

---

### Phase 3: Frontend Components (Week 2)

**FE-BUILDER → FE-QA**

#### Tasks:
1. Create `ExplanationCard.jsx` with adaptive UI
2. Create `FactorList.jsx` and `FactorDetail.jsx`
3. Create `AlternativesList.jsx`
4. Create `ProgressBar.jsx` visual component
5. Create `ConfidenceBadge.jsx`
6. Integrate with existing agent execution UI

**Test Cases:**
- Expand/collapse animation is smooth
- Progress bars accurately reflect scores
- Confidence badge colors are correct
- Alternative selection works
- Mobile responsive design

---

### Phase 4: Priority, Deadline, Follow-up Agents (Week 3)

**BE-BUILDER → FE-BUILDER**

#### Tasks:
1. Implement factor calculators for Priority Agent
2. Implement factor calculators for Deadline Agent
3. Implement factor calculators for Follow-up Agent
4. Update frontend to support all agent types
5. Create agent-specific factor definitions

**Test Cases:**
- Business impact calculation is accurate
- Urgency considers blocking relationships
- Deadline buffer calculations are reasonable
- Follow-up likelihood detection works
- All 4 agent types have clear explanations

---

### Phase 5: Polish & Testing (Week 3-4)

**UI-POLISH → INTEGRATION-TESTER → BE-QA**

#### Tasks:
1. Refine natural language generation
2. Add animations and micro-interactions
3. Improve factor detail quality
4. Add tooltips and help text
5. Conduct user testing
6. Gather feedback and iterate

**Polish:**
- Smooth expand/collapse transitions
- Hover states on factors
- Color-coded impact indicators
- Clear typography hierarchy
- Accessibility (screen readers, keyboard nav)

**Test Cases:**
- Users understand explanations without help
- Explanations build trust (survey)
- Override rate decreases
- Users learn from AI reasoning

---

### Phase 6: Deployment & Monitoring (Week 4)

**DEPLOYMENT-SPECIALIST → LEARNING-RECORDER**

#### Tasks:
1. Deploy database migration
2. Deploy backend services
3. Deploy frontend components
4. Monitor explanation quality
5. Track user engagement metrics
6. Update documentation

**Monitoring:**
- Explanation generation time (<200ms)
- User expansion rate (% who click "Show More")
- Override rate change (before/after)
- User satisfaction surveys

---

## Success Metrics

### Engagement Metrics

**Week 1 Targets:**
- Explanation view rate: 80% of agent executions
- Expansion rate: 30% of users expand details
- Alternative selection: 10% select an alternative

**Week 4 Targets:**
- Explanation view rate: 95%
- Expansion rate: 50%
- Alternative selection: 15%

### Trust & Quality Metrics

**Measured After 30 Days:**
- AI trust score: +25% increase (survey)
- Override rate: -15% decrease (from 35% to 20%)
- User understanding: 85% report understanding AI decisions
- Explanation quality: >80% rate explanations as "helpful"

### Business Impact

**Measured After 60 Days:**
- AI adoption rate: +30% increase
- Time saved per user: 2 hours/week (less second-guessing)
- Assignment accuracy: +10% improvement (fewer reassignments)
- User satisfaction: +20% NPS increase

### Technical Metrics

**Performance:**
- Explanation generation: <200ms (p95)
- API success rate: >99%
- Zero P0/P1 bugs in first 2 weeks

**Quality:**
- Factor calculation accuracy: >90%
- Confidence correlation: >85% (confidence matches actual correctness)
- Natural language clarity: >80% user approval

---

## Appendix

### Factor Calculator Examples

#### Skill Match Calculator (Detailed)

```javascript
async calculateSkillMatch(recommendation, context) {
  const { task, candidate } = recommendation;

  // 1. Extract required skills from task
  const requiredSkills = await this.extractRequiredSkills(task);
  // Example: [
  //   { skill: "API Integration", level: "intermediate", importance: "critical" },
  //   { skill: "Node.js", level: "beginner", importance: "important" },
  //   { skill: "CRM Systems", level: "beginner", importance: "nice-to-have" }
  // ]

  // 2. Get candidate skills
  const candidateSkills = await this.getCandidateSkills(candidate.id);
  // Example: [
  //   { skill: "API Integration", level: "expert", experienceYears: 5, projects: 12 },
  //   { skill: "Node.js", level: "intermediate", experienceYears: 3, projects: 8 }
  // ]

  // 3. Match skills with weighted importance
  let totalWeight = 0;
  let matchedWeight = 0;
  const matchDetails = [];

  for (const req of requiredSkills) {
    const weight = {
      'critical': 1.0,
      'important': 0.6,
      'nice-to-have': 0.3
    }[req.importance];

    totalWeight += weight;

    const match = candidateSkills.find(cs => cs.skill === req.skill);

    if (match && match.level >= req.level) {
      matchedWeight += weight;
      matchDetails.push({
        skill: req.skill,
        matched: true,
        experience: `${match.experienceYears} years, ${match.projects} projects`
      });
    } else {
      matchDetails.push({
        skill: req.skill,
        matched: false,
        experience: null
      });
    }
  }

  // 4. Calculate score
  const score = (matchedWeight / totalWeight) * 100;

  // 5. Generate details
  const details = matchDetails
    .filter(m => m.matched)
    .slice(0, 3)
    .map(m => `${m.skill}: ${m.experience}`);

  if (details.length === 0) {
    details.push('No direct skill matches found');
  }

  // 6. Natural language summary
  const topSkill = matchDetails.find(m => m.matched);
  const naturalLanguage = topSkill
    ? `Has ${topSkill.skill} experience`
    : 'Limited relevant experience';

  return {
    score: Math.round(score),
    details: details,
    naturalLanguage: naturalLanguage
  };
}
```

### CSS Styling

**File:** `frontend/src/styles/explainability.css`

```css
/* Explanation Card */
.explanation-card {
  background: #F9FAFB;
  border: 1px solid #E5E7EB;
  border-radius: 8px;
  padding: 16px;
  margin: 16px 0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
}

.explanation-card.expanded {
  background: #FFFFFF;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
}

/* Header */
.recommendation-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}

.recommendation-title {
  font-size: 16px;
  font-weight: 600;
  color: #111827;
}

/* Factors */
.factors-concise {
  margin-bottom: 16px;
}

.factors-concise h4 {
  font-size: 14px;
  font-weight: 500;
  color: #6B7280;
  margin-bottom: 8px;
}

.factor-compact {
  display: flex;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #E5E7EB;
}

.factor-compact:last-child {
  border-bottom: none;
}

.factor-name {
  font-weight: 500;
  margin-right: 8px;
}

.impact-icon {
  margin: 0 8px;
  font-size: 18px;
}

.impact-icon.impact-strong {
  color: #10B981;
}

.impact-icon.impact-moderate {
  color: #F59E0B;
}

.impact-icon.impact-weak {
  color: #EF4444;
}

.factor-summary {
  color: #6B7280;
  font-size: 14px;
}

/* Detailed Factors */
.factor-detailed {
  margin: 16px 0;
  padding: 12px;
  background: #F9FAFB;
  border-radius: 6px;
}

.factor-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.factor-rank {
  font-weight: 600;
  margin-right: 8px;
  color: #6B7280;
}

.factor-weight {
  color: #9CA3AF;
  font-size: 14px;
  margin-left: 8px;
}

.factor-score {
  margin-left: auto;
  font-weight: 600;
  font-size: 16px;
}

.factor-details {
  margin-top: 8px;
  padding-left: 24px;
}

.detail-item {
  font-size: 14px;
  color: #4B5563;
  padding: 4px 0;
}

/* Progress Bar */
.progress-bar {
  width: 100%;
  height: 8px;
  background: #E5E7EB;
  border-radius: 4px;
  overflow: hidden;
  margin: 8px 0;
}

.progress-bar-fill {
  height: 100%;
  border-radius: 4px;
  transition: width 0.3s ease;
}

.progress-bar-fill.high {
  background: #10B981;
}

.progress-bar-fill.medium {
  background: #F59E0B;
}

.progress-bar-fill.low {
  background: #EF4444;
}

/* Alternatives */
.alternative-item {
  padding: 12px;
  background: #F9FAFB;
  border-radius: 6px;
  margin: 8px 0;
}

.alternative-header {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.alternative-rank {
  font-weight: 600;
  margin-right: 8px;
  color: #6B7280;
}

.alternative-name {
  font-weight: 500;
}

.alternative-score {
  margin-left: auto;
  color: #6B7280;
}

.alternative-reason {
  font-size: 14px;
  color: #6B7280;
  margin-bottom: 8px;
}

/* Confidence Badge */
.confidence-badge {
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 14px;
  font-weight: 500;
}

.confidence-badge.high {
  background: #D1FAE5;
  color: #065F46;
}

.confidence-badge.medium {
  background: #FEF3C7;
  color: #92400E;
}

.confidence-badge.low {
  background: #FEE2E2;
  color: #991B1B;
}

/* Actions */
.explanation-actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
}

.btn-primary {
  background: #3B82F6;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
  font-weight: 500;
}

.btn-primary:hover {
  background: #2563EB;
}

.btn-secondary {
  background: #6B7280;
  color: white;
  padding: 8px 16px;
  border-radius: 6px;
  border: none;
  cursor: pointer;
}

.btn-secondary:hover {
  background: #4B5563;
}

.btn-expand {
  background: transparent;
  color: #3B82F6;
  padding: 8px 16px;
  border: 1px solid #3B82F6;
  border-radius: 6px;
  cursor: pointer;
  margin-left: auto;
}

.btn-expand:hover {
  background: #EFF6FF;
}

/* Animations */
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

/* Responsive */
@media (max-width: 768px) {
  .explanation-actions {
    flex-direction: column;
  }

  .btn-expand {
    margin-left: 0;
  }
}
```

---

**End of AI Explainability Layer Design Document**

This design provides a complete blueprint for implementing transparent, adaptive AI explanations across all Entomate agents.
