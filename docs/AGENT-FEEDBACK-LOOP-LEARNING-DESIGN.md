# Agent Feedback Loop & Learning - Design Document

**Project:** Entomate AI-Powered Meeting Intelligence Platform
**Feature:** Agent Feedback Loop & Learning System (Tier 1 AI Enhancement)
**Version:** 1.0
**Date:** 2026-01-24
**Status:** Design Phase

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Problem Statement](#problem-statement)
3. [Design Principles](#design-principles)
4. [Learning Architecture](#learning-architecture)
5. [User Experience Design](#user-experience-design)
6. [Technical Architecture](#technical-architecture)
7. [Implementation Plan](#implementation-plan)
8. [Success Metrics](#success-metrics)

---

## Executive Summary

### Purpose

Enable AI agents to **learn from user feedback and corrections**, continuously improving recommendation accuracy and adapting to team-specific patterns and preferences.

### Current State

**Problem:**
- AI agents make the same mistakes repeatedly
- No feedback mechanism for user corrections
- Agents don't adapt to team-specific preferences
- No visibility into what patterns AI has learned
- Users can't influence or correct AI learning

**Example Current Experience:**
```
User: *Assigns task to Jane instead of John*
System: *Makes no note of this, may suggest John again tomorrow*
```

### Desired State

**Feedback Capture (On Override Only):**
```
🤔 You assigned this to Jane instead of John.
   Help the AI learn by sharing why:

   [ ] Jane has the client relationship
   [ ] Jane requested this project
   [ ] John is on vacation
   [✓] Other: Jane has more domain expertise in this area

   [Skip] [Submit Feedback]
```

**Learning Transparency & Control:**
```
🧠 AI LEARNING INSIGHTS

The Assignment Agent learned a new pattern:

Pattern: "When assigning API integration tasks,
         prefer Jane Smith over John Doe"

Based on: 4 overrides in last 2 weeks
Reason: User noted "Jane has more domain expertise"

Confidence: Medium (60%)
Impact: Will adjust Skill Match factor +15% for Jane on API tasks

[ ] ✓ Accept and apply this learning
[ ] Reject this pattern
[ ] Apply only to API integration tasks (customize)

[Why did the AI learn this?]
```

**Silent Learning (Background):**
- Pattern detection from overrides
- Performance tracking (did override lead to better outcome?)
- Team preference modeling
- Context-based learning

### Design Decisions (User Selected)

1. **Feedback Trigger:** On override only (non-intrusive)
2. **Learning Approach:** Transparency & Control (users approve/reject learned behaviors)
3. **Pattern Detection:** Both explicit feedback and implicit behavior analysis
4. **Trust Model:** Human-in-the-loop approval for pattern activation

---

## Problem Statement

### User Pain Points

**1. Repetitive AI Mistakes**
> "The AI keeps assigning CRM tasks to John, but Jane always handles those because she knows the system better."

**Impact:** Users waste time correcting the same mistakes repeatedly

**2. No Adaptation to Team Context**
> "Our team has specific preferences (Sarah handles all legal reviews), but the AI doesn't know this."

**Impact:** AI feels generic and unhelpful rather than context-aware

**3. No Improvement Over Time**
> "I've been using this for 3 months but the AI hasn't gotten any better at understanding what I want."

**Impact:** Low perceived value, AI feels static

**4. Hidden Learning (If Any)**
> "I don't know if the AI is learning from my corrections or just ignoring them."

**Impact:** Users lose trust in AI capability

### Business Impact

- **High Override Rate:** 35% of AI recommendations manually changed
- **Wasted Time:** 15 minutes/day correcting AI mistakes
- **Low AI Accuracy:** Same mistakes repeated across weeks
- **Poor Adoption:** Users bypass AI agents entirely

### Success Criteria

**After Learning System:**
- Override rate: <20% (from 35%)
- Time saved: 10 minutes/day (fewer corrections)
- AI accuracy: +25% improvement
- User satisfaction: +30% increase

---

## Design Principles

### 1. Non-Intrusive Feedback Collection

**Principle:** Only ask for feedback when user takes corrective action.

**Implementation:**
- Trigger feedback prompt on override
- Make feedback optional (always include "Skip" option)
- Keep prompts short (5 seconds to complete)
- Remember user preference ("Don't ask again")

### 2. Transparency & Control

**Principle:** Users see what AI learned and can approve/reject patterns.

**Implementation:**
- Show detected patterns before activation
- Explain why pattern was detected
- Allow users to customize or reject
- Provide "Unlearn" option for active patterns

### 3. Contextual Learning

**Principle:** Learn patterns specific to context (task type, deal stage, team).

**Implementation:**
- Detect when overrides cluster by context
- Apply learning only to matching contexts
- Avoid over-generalization
- Allow scoped pattern application

### 4. Performance Validation

**Principle:** Validate that learned patterns actually improve outcomes.

**Implementation:**
- Track outcome metrics (task completion, on-time delivery)
- Compare override outcomes vs. AI recommendations
- Confidence scoring based on validation
- Automatic pattern deprecation if ineffective

### 5. Explainable Learning

**Principle:** Users understand why AI learned what it learned.

**Implementation:**
- Clear pattern descriptions in natural language
- Show supporting evidence (e.g., "Based on 4 overrides")
- Link to specific feedback/overrides
- Confidence scoring

---

## Learning Architecture

### Learning Lifecycle

```
┌──────────────────────────────────────────────────────────────┐
│                    LEARNING LIFECYCLE                         │
└──────────────────────────────────────────────────────────────┘

1. FEEDBACK CAPTURE
   ├─ User overrides AI recommendation
   ├─ System prompts for feedback (optional)
   └─ Store override with context snapshot

2. PATTERN DETECTION (Background Process)
   ├─ Analyze overrides for patterns
   ├─ Cluster similar contexts
   ├─ Calculate pattern confidence
   └─ Generate pattern hypothesis

3. PATTERN VALIDATION
   ├─ Track outcomes of overrides
   ├─ Compare vs. AI recommendations
   ├─ Calculate accuracy improvement
   └─ Assign confidence score

4. USER APPROVAL (Human-in-the-Loop)
   ├─ Present pattern to user
   ├─ Explain detection reasoning
   ├─ User accepts/rejects/customizes
   └─ Activate approved patterns

5. ACTIVE LEARNING
   ├─ Apply pattern to future decisions
   ├─ Monitor effectiveness
   ├─ Re-validate periodically
   └─ Deprecate if ineffective

6. CONTINUOUS IMPROVEMENT
   ├─ Collect more overrides
   ├─ Refine patterns
   ├─ Increase confidence
   └─ Expand to similar contexts
```

### Pattern Types

**1. Preference Patterns**
- User prefers option A over option B in context C
- Example: "Prefer Jane for API tasks"

**2. Constraint Patterns**
- Never recommend option X in context Y
- Example: "Never assign to John on Fridays"

**3. Boost Patterns**
- Increase score for option A by N% in context B
- Example: "+15% for Sarah on legal reviews"

**4. Context-Specific Patterns**
- Apply rule only when conditions match
- Example: "Assign to Jane if task involves CRM AND deal > $50k"

### Confidence Scoring

```javascript
function calculatePatternConfidence(pattern) {
  const factors = {
    sampleSize: pattern.overrideCount,
    consistency: pattern.consistencyRate, // % of times user makes same choice
    recentness: pattern.daysSinceLastOverride,
    validation: pattern.outcomeSuccessRate,
    contextClarity: pattern.contextSpecificity
  };

  // Base confidence from sample size
  let confidence = Math.min(100, (factors.sampleSize / 5) * 100);

  // Boost if highly consistent
  confidence *= factors.consistency;

  // Reduce if old
  if (factors.recentness > 30) {
    confidence *= 0.8;
  }

  // Boost if validated
  if (factors.validation > 0.85) {
    confidence *= 1.2;
  }

  // Reduce if context unclear
  if (factors.contextClarity < 0.5) {
    confidence *= 0.7;
  }

  return Math.min(100, Math.round(confidence));
}
```

**Confidence Levels:**
- **High (80-100%):** Strong evidence, consistent pattern, validated
- **Medium (60-79%):** Moderate evidence, some validation
- **Low (<60%):** Weak evidence, needs more data

**Activation Threshold:** Require user approval for Medium/Low confidence patterns

---

## User Experience Design

### 1. Feedback Capture (On Override)

**Trigger:** User changes AI recommendation

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🤔 You assigned this to Jane instead of John.              │
│    Help the AI learn by sharing why:                        │
│                                                              │
│    Reason (optional):                                       │
│    [ ] Jane has the client relationship                     │
│    [ ] Jane requested this project                          │
│    [ ] John is on vacation                                  │
│    [ ] Jane has more experience in this area                │
│    [✓] Other: ___________________________________           │
│                                                              │
│    [ ] Don't ask me again                                   │
│                                                              │
│    [Skip] [Submit Feedback]                                 │
└─────────────────────────────────────────────────────────────┘
```

**Design Specs:**
- **Timing:** Appear immediately after override action
- **Position:** Modal overlay or inline card (non-blocking)
- **Dismissal:** Auto-dismiss after 30 seconds if no interaction
- **Frequency:** Respect "Don't ask again" preference
- **Storage:** Save preference per agent type

**Feedback Options (Contextual):**

For **Assignment Agent:**
- Has the client relationship
- Requested this project
- More experience in this area
- Currently available
- Better skill match
- Team preference
- Other (free text)

For **Priority Agent:**
- Higher business impact than AI thinks
- More urgent than AI calculated
- Blocking other work
- Strategic importance
- Customer commitment
- Other (free text)

For **Deadline Agent:**
- More complex than estimated
- Team is slower on this type of work
- External dependency
- Quality buffer needed
- Other (free text)

### 2. Learning Insights Dashboard

**Location:** Settings → AI Learning OR Agents Page

**UI Design:**
```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 AI LEARNING INSIGHTS                                     │
│                                                              │
│ Active Patterns (3)        Pending Approval (2)             │
│ ───────────────────────────────────────────────────────────│
│                                                              │
│ 📊 ACTIVE PATTERNS                                          │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Assignment Agent: API Integration Tasks                  ││
│ │                                                           ││
│ │ Pattern: Prefer Jane Smith over John Doe                ││
│ │                                                           ││
│ │ Based on:                                                ││
│ │  • 4 overrides in last 2 weeks                           ││
│ │  • User noted: "Jane has more domain expertise"         ││
│ │  • Consistency: 100% (4/4 times)                         ││
│ │  • Success rate: 100% (all completed on time)           ││
│ │                                                           ││
│ │ Confidence: Medium (65%)                                 ││
│ │ Impact: Skill Match factor +15% for Jane on API tasks   ││
│ │ Active since: Jan 20, 2026                               ││
│ │                                                           ││
│ │ [View Details] [Edit Pattern] [Deactivate]              ││
│ └─────────────────────────────────────────────────────────┘│
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Priority Agent: Customer Commitments                     ││
│ │                                                           ││
│ │ Pattern: Boost priority for items with customer commits││
│ │                                                           ││
│ │ Based on:                                                ││
│ │  • 6 overrides in last month                             ││
│ │  • User increased priority on customer-facing items     ││
│ │  • Success rate: 83% (5/6 resolved customer issues)     ││
│ │                                                           ││
│ │ Confidence: High (82%)                                   ││
│ │ Impact: Business Impact factor +20% for customer items  ││
│ │ Active since: Jan 15, 2026                               ││
│ │                                                           ││
│ │ [View Details] [Edit Pattern] [Deactivate]              ││
│ └─────────────────────────────────────────────────────────┘│
│                                                              │
│ 📋 PENDING APPROVAL                                         │
│                                                              │
│ ┌─────────────────────────────────────────────────────────┐│
│ │ Assignment Agent: Legal Reviews                          ││
│ │                                                           ││
│ │ Pattern: Always assign legal tasks to Sarah Chen        ││
│ │                                                           ││
│ │ Based on:                                                ││
│ │  • 3 overrides in last week                              ││
│ │  • All legal review tasks reassigned to Sarah           ││
│ │  • Consistency: 100% (3/3 times)                         ││
│ │                                                           ││
│ │ Confidence: Medium (55%)                                 ││
│ │ Impact: Skill Match factor +25% for Sarah on legal tasks││
│ │                                                           ││
│ │ ⚠ Needs approval before activation                      ││
│ │                                                           ││
│ │ [✓ Accept & Apply] [Customize] [✗ Reject]               ││
│ │ [Why did AI learn this?]                                 ││
│ └─────────────────────────────────────────────────────────┘│
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 3. Pattern Approval Flow

**Step 1: Pattern Detection Notification**
```
┌─────────────────────────────────────────────────────────────┐
│ 🔔 New Pattern Detected                                     │
│                                                              │
│ The Assignment Agent detected a pattern in your task       │
│ assignments. Review and approve to improve AI accuracy.     │
│                                                              │
│ [Review Pattern] [Dismiss]                                  │
└─────────────────────────────────────────────────────────────┘
```

**Step 2: Pattern Review Modal**
```
┌─────────────────────────────────────────────────────────────┐
│ 🧠 Review Detected Pattern                             [✗] │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Pattern Name: API Integration → Jane Smith                 │
│                                                              │
│ Pattern Description:                                        │
│ When assigning API integration tasks, prefer Jane Smith    │
│ over John Doe                                                │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Evidence:                                                    │
│  • 4 overrides in last 14 days                              │
│  • User feedback: "Jane has more domain expertise" (2x)    │
│  • Consistency: 100% (reassigned to Jane every time)       │
│  • Task completion rate: 100% (4/4 completed on time)      │
│                                                              │
│ Confidence: Medium (65%)                                    │
│ Reason: Consistent pattern but limited sample size         │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ How will this improve AI?                                   │
│  • Skill Match factor: +15% for Jane on API tasks          │
│  • Reduces future overrides: Estimated 80% accuracy        │
│  • Time saved: ~2 minutes per week                          │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Supporting Overrides:                                       │
│  1. Jan 22: "Integrate CRM API" → John → Jane              │
│     Feedback: "Jane has more domain expertise"             │
│  2. Jan 20: "Build API endpoint" → John → Jane             │
│     Feedback: (skipped)                                     │
│  3. Jan 18: "API authentication flow" → Mike → Jane        │
│     Feedback: "Jane has more experience in this area"      │
│  4. Jan 15: "REST API design" → John → Jane                │
│     Feedback: (skipped)                                     │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Action:                                                      │
│  ○ Accept and apply this pattern                           │
│  ○ Customize pattern (choose contexts)                     │
│  ○ Reject this pattern                                     │
│                                                              │
│ [ ] Don't show me patterns below 70% confidence            │
│                                                              │
│ [Cancel] [Save Decision]                                    │
└─────────────────────────────────────────────────────────────┘
```

**Step 3: Customization (Optional)**
```
┌─────────────────────────────────────────────────────────────┐
│ Customize Pattern: API Integration → Jane Smith            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Apply this pattern when:                                    │
│  ☑ Task type contains "API"                                 │
│  ☑ Task type contains "integration"                         │
│  ☐ Task type contains "backend"                             │
│  ☐ Deal value > $50,000                                     │
│  ☐ Client is enterprise                                     │
│                                                              │
│ Boost amount:                                                │
│  [━━━━━━━━━━●────────] +15%                                │
│  (Skill Match factor increase for Jane)                    │
│                                                              │
│ Expiration:                                                  │
│  ○ Never (permanent pattern)                               │
│  ○ 30 days (re-validate after)                             │
│  ● 90 days (re-validate after)                             │
│                                                              │
│ [Cancel] [Save Custom Pattern]                              │
└─────────────────────────────────────────────────────────────┘
```

### 4. Pattern Effectiveness Tracking

**Monthly Learning Report:**
```
┌─────────────────────────────────────────────────────────────┐
│ 📊 AI Learning Report - January 2026                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│ Active Patterns: 5                                          │
│ Override Rate: 22% (↓ 13% from last month)                 │
│ AI Accuracy: 78% (↑ 18% from last month)                   │
│ Time Saved: 8 minutes/day                                   │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Top Performing Patterns:                                    │
│                                                              │
│  1. API Integration → Jane Smith                            │
│     Accuracy: 90% | Overrides prevented: 12                │
│                                                              │
│  2. Customer Commitments Priority Boost                     │
│     Accuracy: 85% | Overrides prevented: 8                 │
│                                                              │
│  3. Legal Reviews → Sarah Chen                              │
│     Accuracy: 100% | Overrides prevented: 6                │
│                                                              │
│ ─────────────────────────────────────────────────────────── │
│                                                              │
│ Patterns Needing Attention:                                 │
│                                                              │
│  ⚠ Deadline Buffer Calculation                              │
│     Accuracy: 55% | Still being overridden frequently      │
│     [Review Pattern] [Deactivate]                           │
│                                                              │
│ [View Full Report]                                           │
└─────────────────────────────────────────────────────────────┘
```

---

## Technical Architecture

### Backend Architecture

#### 1. Feedback Service

**File:** `backend/services/learning/FeedbackService.js`

```javascript
class FeedbackService {
  /**
   * Capture user override with optional feedback
   */
  async captureOverride(override) {
    const {
      userId,
      agentType,
      agentExecutionId,
      originalRecommendation,
      userChoice,
      feedbackReason,
      feedbackText,
      context
    } = override;

    // Store override
    const overrideRecord = await db.agent_overrides.insert({
      id: uuid(),
      user_id: userId,
      agent_type: agentType,
      agent_execution_id: agentExecutionId,
      original_recommendation: originalRecommendation,
      user_choice: userChoice,
      feedback_reason: feedbackReason,
      feedback_text: feedbackText,
      context_snapshot: context,
      created_at: new Date()
    });

    // Trigger pattern detection (async)
    this.triggerPatternDetection(userId, agentType);

    return overrideRecord;
  }

  /**
   * Check if user wants feedback prompts
   */
  async shouldPromptForFeedback(userId, agentType) {
    const prefs = await db.user_preferences.findOne({
      user_id: userId,
      preference_key: `feedback_prompt_${agentType}`
    });

    // Default: true (prompt for feedback)
    return prefs?.preference_value !== 'disabled';
  }

  /**
   * Update user feedback preference
   */
  async setFeedbackPreference(userId, agentType, enabled) {
    await db.user_preferences.upsert({
      user_id: userId,
      preference_key: `feedback_prompt_${agentType}`,
      preference_value: enabled ? 'enabled' : 'disabled'
    });
  }
}

module.exports = new FeedbackService();
```

#### 2. Pattern Detection Service

**File:** `backend/services/learning/PatternDetectionService.js`

```javascript
class PatternDetectionService {
  /**
   * Detect patterns from user overrides
   */
  async detectPatterns(userId, agentType) {
    // Get recent overrides (last 90 days)
    const overrides = await db.agent_overrides.find({
      user_id: userId,
      agent_type: agentType,
      created_at: { $gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
    });

    if (overrides.length < 3) {
      // Need minimum 3 overrides to detect pattern
      return [];
    }

    // Group overrides by similar context
    const contextClusters = this.clusterByContext(overrides);

    const detectedPatterns = [];

    for (const cluster of contextClusters) {
      if (cluster.overrides.length < 3) continue;

      // Check for preference pattern (user always chooses same option)
      const preferencePattern = this.detectPreferencePattern(cluster);
      if (preferencePattern) {
        detectedPatterns.push(preferencePattern);
      }

      // Check for constraint pattern (user never chooses certain option)
      const constraintPattern = this.detectConstraintPattern(cluster);
      if (constraintPattern) {
        detectedPatterns.push(constraintPattern);
      }

      // Check for boost pattern (user consistently boosts certain factors)
      const boostPattern = this.detectBoostPattern(cluster);
      if (boostPattern) {
        detectedPatterns.push(boostPattern);
      }
    }

    // Store detected patterns
    for (const pattern of detectedPatterns) {
      await this.storePattern(userId, agentType, pattern);
    }

    return detectedPatterns;
  }

  /**
   * Cluster overrides by context similarity
   */
  clusterByContext(overrides) {
    // Use simple keyword-based clustering for now
    const clusters = {};

    for (const override of overrides) {
      const context = override.context_snapshot;
      const keywords = this.extractContextKeywords(context);

      for (const keyword of keywords) {
        if (!clusters[keyword]) {
          clusters[keyword] = {
            keyword: keyword,
            overrides: []
          };
        }
        clusters[keyword].overrides.push(override);
      }
    }

    // Return clusters with at least 3 overrides
    return Object.values(clusters).filter(c => c.overrides.length >= 3);
  }

  /**
   * Extract keywords from context
   */
  extractContextKeywords(context) {
    const keywords = [];

    // Task-based keywords
    if (context.task) {
      const taskText = context.task.title + ' ' + (context.task.description || '');
      const taskKeywords = taskText.toLowerCase()
        .match(/\b(api|integration|crm|legal|frontend|backend|database|design|testing|security)\b/g);
      if (taskKeywords) keywords.push(...taskKeywords);
    }

    // Deal-based keywords
    if (context.deal) {
      if (context.deal.value > 50000) keywords.push('high_value_deal');
      if (context.deal.stage === 'proposal') keywords.push('proposal_stage');
    }

    return [...new Set(keywords)]; // Deduplicate
  }

  /**
   * Detect preference pattern (A > B in context C)
   */
  detectPreferencePattern(cluster) {
    const { keyword, overrides } = cluster;

    // Count user choices
    const choiceCounts = {};
    const originalCounts = {};

    for (const override of overrides) {
      const choice = override.user_choice.id;
      const original = override.original_recommendation.id;

      choiceCounts[choice] = (choiceCounts[choice] || 0) + 1;
      originalCounts[original] = (originalCounts[original] || 0) + 1;
    }

    // Find most common choice
    const topChoice = Object.keys(choiceCounts)
      .sort((a, b) => choiceCounts[b] - choiceCounts[a])[0];

    // Find most common original (what AI recommended)
    const topOriginal = Object.keys(originalCounts)
      .sort((a, b) => originalCounts[b] - originalCounts[a])[0];

    // Consistency rate
    const consistency = choiceCounts[topChoice] / overrides.length;

    // Only create pattern if consistency > 70%
    if (consistency < 0.7) return null;

    // Get user feedback reasons
    const feedbackReasons = overrides
      .filter(o => o.feedback_reason || o.feedback_text)
      .map(o => o.feedback_reason || o.feedback_text);

    return {
      type: 'preference',
      context: keyword,
      preferredOption: topChoice,
      alternativeOption: topOriginal,
      consistency: consistency,
      sampleSize: overrides.length,
      feedbackReasons: feedbackReasons,
      supportingOverrides: overrides.map(o => o.id)
    };
  }

  /**
   * Calculate pattern confidence
   */
  calculateConfidence(pattern) {
    const { sampleSize, consistency, daysSinceLastOverride } = pattern;

    // Base confidence from sample size
    let confidence = Math.min(100, (sampleSize / 5) * 100);

    // Boost for high consistency
    confidence *= consistency;

    // Reduce if old
    if (daysSinceLastOverride > 30) {
      confidence *= 0.8;
    }

    return Math.round(confidence);
  }

  /**
   * Store detected pattern (pending approval)
   */
  async storePattern(userId, agentType, pattern) {
    const confidence = this.calculateConfidence(pattern);

    return await db.learning_patterns.insert({
      id: uuid(),
      user_id: userId,
      agent_type: agentType,
      pattern_type: pattern.type,
      pattern_data: pattern,
      confidence: confidence,
      status: 'pending_approval', // pending_approval | active | rejected
      created_at: new Date()
    });
  }
}

module.exports = new PatternDetectionService();
```

#### 3. Learning Engine

**File:** `backend/services/learning/LearningEngine.js`

```javascript
class LearningEngine {
  /**
   * Apply active learning patterns to agent decision
   */
  async applyLearning(userId, agentType, recommendation, context) {
    // Get active patterns for this user and agent type
    const patterns = await db.learning_patterns.find({
      user_id: userId,
      agent_type: agentType,
      status: 'active'
    });

    if (patterns.length === 0) {
      return recommendation; // No learning to apply
    }

    // Clone recommendation to avoid mutation
    const learnedRecommendation = JSON.parse(JSON.stringify(recommendation));

    // Apply each pattern
    for (const pattern of patterns) {
      const patternData = pattern.pattern_data;

      // Check if pattern applies to current context
      if (!this.contextMatches(patternData.context, context)) {
        continue;
      }

      // Apply pattern based on type
      switch (patternData.type) {
        case 'preference':
          this.applyPreferencePattern(learnedRecommendation, patternData);
          break;

        case 'constraint':
          this.applyConstraintPattern(learnedRecommendation, patternData);
          break;

        case 'boost':
          this.applyBoostPattern(learnedRecommendation, patternData);
          break;
      }
    }

    return learnedRecommendation;
  }

  /**
   * Check if pattern context matches current context
   */
  contextMatches(patternContext, currentContext) {
    // Simple keyword matching for now
    const currentKeywords = this.extractContextKeywords(currentContext);
    return currentKeywords.includes(patternContext);
  }

  /**
   * Apply preference pattern (boost preferred option)
   */
  applyPreferencePattern(recommendation, pattern) {
    const { preferredOption, consistency } = pattern;

    // If preferred option exists in candidates, boost its score
    if (recommendation.candidates) {
      const preferred = recommendation.candidates.find(c => c.id === preferredOption);
      if (preferred && preferred.explanation) {
        // Boost skill match factor by 15%
        const skillFactor = preferred.explanation.factors.find(f => f.name === 'Skill Match');
        if (skillFactor) {
          const boost = Math.round(15 * consistency); // Scale boost by consistency
          skillFactor.score = Math.min(100, skillFactor.score + boost);
          skillFactor.learningApplied = {
            pattern: 'preference',
            boost: boost,
            reason: 'User historically prefers this option'
          };
        }
      }
    }
  }

  /**
   * Track pattern effectiveness
   */
  async trackOutcome(overrideId, outcome) {
    const override = await db.agent_overrides.findOne({ id: overrideId });

    // Update outcome
    await db.agent_overrides.update(
      { id: overrideId },
      {
        outcome_success: outcome.success,
        outcome_metrics: outcome.metrics,
        outcome_tracked_at: new Date()
      }
    );

    // Find associated patterns
    const patterns = await db.learning_patterns.find({
      'pattern_data.supportingOverrides': overrideId,
      status: 'active'
    });

    // Update pattern validation metrics
    for (const pattern of patterns) {
      await this.updatePatternValidation(pattern.id, outcome);
    }
  }

  /**
   * Update pattern validation with outcome
   */
  async updatePatternValidation(patternId, outcome) {
    const pattern = await db.learning_patterns.findOne({ id: patternId });

    const validation = pattern.validation_metrics || {
      totalOutcomes: 0,
      successfulOutcomes: 0,
      successRate: 0
    };

    validation.totalOutcomes += 1;
    if (outcome.success) {
      validation.successfulOutcomes += 1;
    }
    validation.successRate = validation.successfulOutcomes / validation.totalOutcomes;

    // Re-calculate confidence with validation
    let confidence = pattern.confidence;
    if (validation.successRate > 0.85) {
      confidence = Math.min(100, confidence * 1.2);
    } else if (validation.successRate < 0.5) {
      confidence *= 0.7;
    }

    // Deactivate if consistently ineffective
    if (validation.totalOutcomes >= 5 && validation.successRate < 0.4) {
      await db.learning_patterns.update(
        { id: patternId },
        {
          status: 'deprecated',
          deprecated_reason: 'Low success rate',
          validation_metrics: validation,
          confidence: confidence
        }
      );
    } else {
      await db.learning_patterns.update(
        { id: patternId },
        {
          validation_metrics: validation,
          confidence: Math.round(confidence)
        }
      );
    }
  }
}

module.exports = new LearningEngine();
```

### Frontend Architecture

#### Component Structure

```
frontend/src/components/learning/
├── FeedbackPrompt.jsx           # Override feedback modal
├── LearningDashboard.jsx        # Learning insights page
├── PatternCard.jsx              # Pattern display card
├── PatternApprovalModal.jsx    # Pattern review & approval
├── PatternCustomizer.jsx        # Pattern customization UI
└── LearningReport.jsx           # Monthly effectiveness report
```

### API Endpoints

**Route:** `backend/routes/learning.js`

```javascript
const express = require('express');
const router = express.Router();
const { authenticateToken, rateLimit } = require('../middleware');
const feedbackService = require('../services/learning/FeedbackService');
const patternDetectionService = require('../services/learning/PatternDetectionService');
const learningEngine = require('../services/learning/LearningEngine');

// Capture override feedback
router.post(
  '/feedback/override',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const override = { ...req.body, userId };

      const record = await feedbackService.captureOverride(override);

      res.json({ success: true, data: record });
    } catch (error) {
      console.error('[Learning] Override capture error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get learning patterns for user
router.get(
  '/patterns',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { status, agentType } = req.query;

      const query = { user_id: userId };
      if (status) query.status = status;
      if (agentType) query.agent_type = agentType;

      const patterns = await db.learning_patterns.find(query);

      res.json({ success: true, data: patterns });
    } catch (error) {
      console.error('[Learning] Patterns retrieval error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Approve pattern
router.post(
  '/patterns/:patternId/approve',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { patternId } = req.params;
      const { customization } = req.body;

      // Update pattern to active
      await db.learning_patterns.update(
        { id: patternId },
        {
          status: 'active',
          activated_at: new Date(),
          customization: customization
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Learning] Pattern approval error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Reject pattern
router.post(
  '/patterns/:patternId/reject',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { patternId } = req.params;
      const { reason } = req.body;

      await db.learning_patterns.update(
        { id: patternId },
        {
          status: 'rejected',
          rejected_at: new Date(),
          rejection_reason: reason
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Learning] Pattern rejection error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Deactivate pattern
router.post(
  '/patterns/:patternId/deactivate',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const { patternId } = req.params;

      await db.learning_patterns.update(
        { id: patternId },
        {
          status: 'deactivated',
          deactivated_at: new Date()
        }
      );

      res.json({ success: true });
    } catch (error) {
      console.error('[Learning] Pattern deactivation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

// Get learning report
router.get(
  '/report',
  authenticateToken,
  rateLimit('standard'),
  async (req, res) => {
    try {
      const userId = req.user.id;
      const { period } = req.query; // 'week', 'month', 'quarter'

      const report = await learningEngine.generateReport(userId, period);

      res.json({ success: true, data: report });
    } catch (error) {
      console.error('[Learning] Report generation error:', error);
      res.status(500).json({ success: false, error: error.message });
    }
  }
);

module.exports = router;
```

### Database Schema

```sql
-- ========================================
-- Learning System Schema
-- ========================================

-- Agent overrides (user corrections)
CREATE TABLE agent_overrides (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  agent_execution_id UUID REFERENCES agent_executions(id) ON DELETE SET NULL,
  original_recommendation JSONB NOT NULL,
  user_choice JSONB NOT NULL,
  feedback_reason TEXT,
  feedback_text TEXT,
  context_snapshot JSONB NOT NULL,
  outcome_success BOOLEAN,
  outcome_metrics JSONB,
  outcome_tracked_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_agent_overrides_user ON agent_overrides(user_id);
CREATE INDEX idx_agent_overrides_type ON agent_overrides(agent_type);
CREATE INDEX idx_agent_overrides_created ON agent_overrides(created_at);

-- Learning patterns
CREATE TABLE learning_patterns (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  agent_type TEXT NOT NULL CHECK (agent_type IN ('assignment', 'priority', 'deadline', 'followup')),
  pattern_type TEXT NOT NULL CHECK (pattern_type IN ('preference', 'constraint', 'boost', 'context')),
  pattern_data JSONB NOT NULL,
  confidence INTEGER NOT NULL CHECK (confidence >= 0 AND confidence <= 100),
  status TEXT NOT NULL CHECK (status IN ('pending_approval', 'active', 'rejected', 'deactivated', 'deprecated')),
  customization JSONB,
  validation_metrics JSONB,
  activated_at TIMESTAMP WITH TIME ZONE,
  rejected_at TIMESTAMP WITH TIME ZONE,
  rejection_reason TEXT,
  deactivated_at TIMESTAMP WITH TIME ZONE,
  deprecated_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_patterns_user ON learning_patterns(user_id);
CREATE INDEX idx_learning_patterns_type ON learning_patterns(agent_type);
CREATE INDEX idx_learning_patterns_status ON learning_patterns(status);

-- User preferences
CREATE TABLE user_learning_preferences (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  preference_key TEXT NOT NULL,
  preference_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, preference_key)
);

-- RLS Policies
ALTER TABLE agent_overrides ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_learning_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own overrides"
  ON agent_overrides FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own patterns"
  ON learning_patterns FOR ALL
  USING (user_id = auth.uid());

CREATE POLICY "Users can manage their own preferences"
  ON user_learning_preferences FOR ALL
  USING (user_id = auth.uid());
```

---

## Implementation Plan

### Phase 1: Feedback Capture (Week 1)

**BE-BUILDER → FE-BUILDER**

#### Tasks:
1. Create `FeedbackService.js`
2. Create database schema (SQL migration)
3. Create feedback capture API endpoints
4. Build `FeedbackPrompt.jsx` component
5. Integrate with agent execution flow

**Test Cases:**
- Feedback prompt appears on override
- User can skip or submit feedback
- "Don't ask again" preference persists
- Override data captured correctly

---

### Phase 2: Pattern Detection (Week 1-2)

**BE-BUILDER**

#### Tasks:
1. Create `PatternDetectionService.js`
2. Implement context clustering algorithm
3. Implement preference pattern detection
4. Create background job for pattern detection
5. Store detected patterns in database

**Test Cases:**
- Patterns detected from 3+ overrides
- Context clustering groups similar overrides
- Confidence scoring is accurate
- Patterns stored with supporting evidence

---

### Phase 3: Learning Dashboard (Week 2)

**FE-BUILDER → FE-QA**

#### Tasks:
1. Create `LearningDashboard.jsx`
2. Create `PatternCard.jsx`
3. Display active and pending patterns
4. Show pattern details and evidence
5. Integrate with Settings page

**Test Cases:**
- Active patterns display correctly
- Pending patterns show approval UI
- Pattern details are clear and understandable
- Evidence (overrides) are linked

---

### Phase 4: Pattern Approval & Application (Week 2-3)

**BE-BUILDER → FE-BUILDER**

#### Tasks:
1. Create `PatternApprovalModal.jsx`
2. Implement pattern customization UI
3. Create `LearningEngine.js`
4. Integrate learning with agent execution
5. Apply patterns to recommendations

**Test Cases:**
- User can approve/reject patterns
- Customization options work
- Approved patterns activate
- Learning applied to future recommendations
- Override rate decreases

---

### Phase 5: Validation & Tracking (Week 3)

**BE-BUILDER**

#### Tasks:
1. Implement outcome tracking
2. Update pattern validation metrics
3. Create effectiveness reports
4. Auto-deprecate ineffective patterns
5. Build monthly learning report

**Test Cases:**
- Outcomes tracked correctly
- Pattern confidence updated with validation
- Ineffective patterns deprecated
- Learning report shows improvements

---

### Phase 6: Deployment & Monitoring (Week 4)

**DEPLOYMENT-SPECIALIST → LEARNING-RECORDER**

#### Tasks:
1. Deploy database migration
2. Deploy backend services
3. Deploy frontend components
4. Set up monitoring
5. Create user documentation

**Monitoring:**
- Override rate change
- Pattern activation rate
- Learning effectiveness (AI accuracy improvement)
- User satisfaction

---

## Success Metrics

### Adoption Metrics

**Week 4 Targets:**
- Feedback submission rate: 60% (users provide feedback on overrides)
- Pattern approval rate: 70% (approved patterns / detected patterns)
- Active patterns per user: 3-5 patterns

### Effectiveness Metrics

**After 60 Days:**
- Override rate: <20% (from 35%)
- AI accuracy: +25% improvement
- Pattern success rate: >80% (validated outcomes)
- Time saved: 10 minutes/day per user

### User Satisfaction

**After 90 Days:**
- User trust in AI: +40% increase
- NPS improvement: +25 points
- AI adoption rate: +50% increase
- User sentiment: 85% report "AI is learning and improving"

---

**End of Agent Feedback Loop & Learning Design Document**

This design provides a complete blueprint for implementing a transparent, user-controlled learning system that continuously improves AI agent recommendations.
