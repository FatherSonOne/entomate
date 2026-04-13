# AI Explainability Layer - Integration Guide

**Feature:** AI Explainability Layer (Tier 1 AI Enhancement)
**Version:** 1.0
**Date:** 2026-01-24

---

## Table of Contents

1. [Overview](#overview)
2. [Implementation Status](#implementation-status)
3. [Database Setup](#database-setup)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Usage Examples](#usage-examples)
7. [API Reference](#api-reference)

---

## Overview

The AI Explainability Layer provides transparent explanations for all AI agent decisions, showing users:

- **Why** the AI made its recommendation
- **What factors** influenced the decision
- **How** each factor was scored and weighted
- **What alternatives** were considered
- **Confidence level** in the recommendation

### Key Benefits

- ✅ **Transparency**: Users see exactly how AI decisions are made
- ✅ **Trust**: Clear explanations build confidence in AI recommendations
- ✅ **Learning**: Users understand AI logic and can provide better feedback
- ✅ **Debugging**: Developers can quickly identify why AI made certain decisions

---

## Implementation Status

### ✅ Completed

1. **Database Schema** - `agent_explanations` table with RLS policies
2. **ExplanationService.js** - Generate and store explanations
3. **API Routes** - 5 endpoints for explanation management
4. **FactorBreakdown.jsx** - Visual factor display component
5. **ExplanationCard.jsx** - Inline explanation card (compact view)
6. **ExplanationModal.jsx** - Full-screen detailed explanation
7. **API Client** - Frontend wrapper for explainability endpoints

### 🚧 Remaining

1. **Database Migration** - Run SQL migration in Supabase
2. **Agent Integration** - Connect existing AI agents to generate explanations
3. **UI Integration** - Add explanation components to agent pages

---

## Database Setup

### Step 1: Run Migration

**File:** `docs/migrations/001_agent_explanations.sql`

Run this SQL script in your Supabase SQL Editor:

```sql
-- Copy contents from docs/migrations/001_agent_explanations.sql
-- and execute in Supabase dashboard
```

This creates:
- `agent_explanations` table
- Indexes for performance
- RLS policies for security
- Sample data structure comments

### Step 2: Verify Tables

```sql
-- Check if table exists
SELECT * FROM agent_explanations LIMIT 1;

-- Verify RLS is enabled
SELECT relname, relrowsecurity
FROM pg_class
WHERE relname = 'agent_explanations';
```

---

## Backend Integration

### Using ExplanationService

The `ExplanationService` handles all explanation generation and storage.

#### Basic Usage

```javascript
const ExplanationService = require('../services/explainability/ExplanationService');

// Generate and store explanation
const explanation = await ExplanationService.createExplanation({
  agentExecutionId: 'agent-exec-123',
  agentType: 'assignment',
  recommendation: {
    id: 'user-1',
    name: 'Jane Smith'
  },
  confidence: 85,
  factors: [
    {
      name: 'Skill Match',
      weight: 0.40,
      score: 90,
      impact: 'strong',
      details: [
        'Matched 4/5 required skills',
        'API integration: 5 years experience'
      ],
      naturalLanguage: 'Has API integration experience'
    },
    {
      name: 'Current Workload',
      weight: 0.30,
      score: 85,
      impact: 'strong',
      details: [
        'Active tasks: 3 vs team avg: 5',
        'Estimated capacity: 15 hours this week'
      ],
      naturalLanguage: '3 tasks vs team avg 5'
    },
    {
      name: 'Availability',
      weight: 0.20,
      score: 100,
      impact: 'strong',
      details: ['No time off scheduled'],
      naturalLanguage: 'Fully available'
    },
    {
      name: 'Past Performance',
      weight: 0.10,
      score: 95,
      impact: 'strong',
      details: ['On-time delivery: 95%'],
      naturalLanguage: 'Excellent track record'
    }
  ],
  alternatives: [
    {
      option: { id: 'user-2', name: 'John Doe' },
      score: 72,
      whyLower: 'Current Workload: Higher workload (7 active tasks)',
      factors: [/* ... */]
    }
  ],
  metadata: {
    taskId: 'task-456',
    dealId: 'deal-789'
  }
});
```

### Integrating with AI Agents

Add explanation generation to your agent execution:

```javascript
// Example: Assignment Agent
async function executeAssignmentAgent(taskId) {
  // 1. Run AI logic to get recommendation
  const recommendation = await getAssignmentRecommendation(taskId);

  // 2. Calculate factors
  const factors = calculateAssignmentFactors(task, teamMembers);

  // 3. Get alternatives
  const alternatives = getAlternativeAssignments(task, teamMembers);

  // 4. Generate explanation
  const explanation = await ExplanationService.createExplanation({
    agentExecutionId: executionId,
    agentType: 'assignment',
    recommendation: recommendation,
    confidence: calculateConfidence(factors),
    factors: factors,
    alternatives: alternatives,
    metadata: {
      taskId: taskId,
      executedAt: new Date().toISO String()
    }
  });

  // 5. Return both recommendation and explanation
  return {
    recommendation,
    explanation
  };
}
```

---

## Frontend Integration

### Using ExplanationCard (Inline)

Add to task/project detail pages for quick explanations:

```jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';
import ExplanationCard from '../components/explainability/ExplanationCard';

function TaskDetail({ taskId }) {
  const [explanation, setExplanation] = useState(null);

  useEffect(() => {
    loadExplanation();
  }, [taskId]);

  const loadExplanation = async () => {
    try {
      // Assuming you have the agent execution ID
      const response = await api.explainability.getExplanation(executionId);
      setExplanation(response.data);
    } catch (error) {
      console.error('Failed to load explanation:', error);
    }
  };

  return (
    <div>
      {/* Task details */}

      {/* AI Explanation */}
      {explanation && (
        <ExplanationCard
          explanation={explanation}
          onViewDetails={() => setShowModal(true)}
          showFullDetails={false}
          className="mt-4"
        />
      )}
    </div>
  );
}
```

### Using ExplanationModal (Full Details)

Show detailed explanation in a modal:

```jsx
import React, { useState } from 'react';
import ExplanationModal from '../components/explainability/ExplanationModal';

function AgentRecommendation({ agentType, recommendation, explanation }) {
  const [showModal, setShowModal] = useState(false);

  return (
    <div>
      {/* Recommendation UI */}
      <div className="recommendation">
        <h3>AI Recommends: {recommendation.name}</h3>
        <button onClick={() => setShowModal(true)}>
          View Explanation
        </button>
      </div>

      {/* Explanation Modal */}
      {showModal && (
        <ExplanationModal
          explanation={explanation}
          agentType={agentType}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
```

### Using FactorBreakdown (Standalone)

Display factors independently:

```jsx
import FactorBreakdown from '../components/explainability/FactorBreakdown';

function FactorAnalysis({ factors }) {
  return (
    <div>
      <h3>Decision Factors</h3>
      <FactorBreakdown
        factors={factors}
        showDetails={true}
        compact={false}
      />
    </div>
  );
}
```

---

## Usage Examples

### Example 1: Assignment Agent with Explanation

```javascript
// Backend: Agent execution
const result = await assignmentAgent.execute(taskId);

// Store explanation
await ExplanationService.createExplanation({
  agentExecutionId: result.executionId,
  agentType: 'assignment',
  recommendation: result.assignee,
  confidence: result.confidence,
  factors: result.factors,
  alternatives: result.alternatives
});

// Frontend: Display recommendation with explanation
const explanation = await api.explainability.getExplanation(result.executionId);
```

### Example 2: Priority Agent with Explanation

```javascript
// Backend
await ExplanationService.createExplanation({
  agentExecutionId: executionId,
  agentType: 'priority',
  recommendation: { value: 'high', label: 'High Priority' },
  confidence: 78,
  factors: [
    {
      name: 'Business Impact',
      weight: 0.50,
      score: 85,
      impact: 'strong',
      details: ['Revenue impact: $50,000'],
      naturalLanguage: 'High revenue impact'
    },
    {
      name: 'Urgency',
      weight: 0.30,
      score: 70,
      impact: 'moderate',
      details: ['Deadline: 3 days'],
      naturalLanguage: 'Moderate urgency'
    },
    {
      name: 'Dependencies',
      weight: 0.20,
      score: 80,
      impact: 'strong',
      details: ['Blocks 2 other tasks'],
      naturalLanguage: 'Blocks other work'
    }
  ],
  alternatives: [
    {
      option: { value: 'medium', label: 'Medium Priority' },
      score: 65,
      whyLower: 'Business Impact: Lower revenue impact estimate'
    }
  ]
});
```

---

## API Reference

### Frontend API

**Get Explanation**
```javascript
const explanation = await api.explainability.getExplanation(executionId);
```

**Get Recent Explanations**
```javascript
const explanations = await api.explainability.getRecentExplanations('assignment', 10);
```

**Get Statistics**
```javascript
const stats = await api.explainability.getStats(30); // last 30 days
```

**Generate Summary**
```javascript
const summary = await api.explainability.generateSummary(executionId);
```

### Backend API Endpoints

**POST /api/explainability/explanations**
- Create new explanation
- Body: `{ agentExecutionId, agentType, recommendation, confidence, factors, alternatives, metadata }`

**GET /api/explainability/explanations/:executionId**
- Get explanation by execution ID

**GET /api/explainability/explanations/recent?agentType=assignment&limit=10**
- Get recent explanations

**GET /api/explainability/stats?days=30**
- Get explanation statistics

**POST /api/explainability/explanations/:executionId/summary**
- Generate natural language summary

### Data Structures

**Factor Object**
```javascript
{
  name: 'Skill Match',
  weight: 0.40,              // 0.0 to 1.0 (importance)
  score: 90,                 // 0 to 100 (performance)
  impact: 'strong',          // 'strong', 'moderate', 'weak', 'minimal'
  details: ['...'],          // Array of detail strings
  naturalLanguage: '...',    // Human-readable description
  learningApplied: {         // Optional: if learning was applied
    pattern: 'preference',
    boost: 15,
    reason: '...'
  }
}
```

**Alternative Object**
```javascript
{
  option: { id: '...', name: '...' },
  score: 72,
  whyLower: '...',
  factors: [/* factor objects */]
}
```

---

## Integration Checklist

### Backend Integration

- [ ] Run database migration in Supabase
- [ ] Import ExplanationService in agent files
- [ ] Generate factors in agent logic
- [ ] Calculate alternatives
- [ ] Call `ExplanationService.createExplanation()` after agent execution
- [ ] Store `agentExecutionId` with recommendations

### Frontend Integration

- [ ] Import explanation components
- [ ] Fetch explanation using API
- [ ] Display ExplanationCard in task/project views
- [ ] Add "View Explanation" button
- [ ] Show ExplanationModal on click
- [ ] Handle loading and error states

---

## Best Practices

### Factor Design

1. **Keep factors focused** - Each factor should measure one thing
2. **Use clear names** - "Skill Match" not "Factor 1"
3. **Provide details** - Give specific evidence for each score
4. **Natural language** - Write human-readable descriptions
5. **Consistent weights** - Weights should sum to 1.0

### Confidence Scoring

- **High (80-100%)**: Strong evidence, all factors align
- **Medium (60-79%)**: Moderate evidence, some uncertainty
- **Low (<60%)**: Weak evidence, high uncertainty

### Performance

- Explanation generation is **async** and non-blocking
- Cache explanations on frontend
- Use pagination for large lists
- Index `agent_execution_id` for fast lookups

---

## Troubleshooting

**Explanation not showing:**
- Check if `agentExecutionId` is correctly passed
- Verify explanation was created in database
- Check console for API errors

**Factors not rendering:**
- Ensure factors array is not empty
- Check factor objects have required fields (name, weight, score)
- Verify impact values are valid ('strong', 'moderate', 'weak', 'minimal')

**Confidence score incorrect:**
- Verify weights sum to 1.0
- Check all scores are 0-100
- Review confidence calculation logic

---

**End of Integration Guide**

For the complete design document, see `docs/AI-EXPLAINABILITY-LAYER-DESIGN.md`
