# Learning System Integration Guide

**Feature:** Agent Feedback Loop & Learning System
**Version:** 1.0
**Date:** 2026-01-24

---

## Table of Contents

1. [Overview](#overview)
2. [Phase 1 Completion Status](#phase-1-completion-status)
3. [Integration Points](#integration-points)
4. [Usage Examples](#usage-examples)
5. [API Reference](#api-reference)
6. [Next Steps](#next-steps)

---

## Overview

The Learning System captures user feedback when they override AI agent recommendations, detects patterns, and improves AI accuracy over time.

### System Components

**Backend:**
- `FeedbackService.js` - Captures and manages user overrides
- `PatternDetectionService.js` - Detects patterns from overrides (Phase 2)
- `LearningEngine.js` - Applies learned patterns to recommendations (Phase 4)
- Learning API routes (`/api/learning/*`)

**Frontend:**
- `FeedbackPrompt.jsx` - Modal for collecting user feedback
- `useFeedbackPrompt` hook - React hook for managing feedback prompts
- Learning API client (`api.learning.*`)
- Learning Dashboard (Phase 3)

**Database:**
- `agent_overrides` table - Stores user corrections
- `learning_patterns` table - Stores detected patterns
- `user_learning_preferences` table - Stores user preferences

---

## Phase 1 Completion Status

### ✅ Completed

1. **Database Schema**
   - Created `agent_overrides`, `learning_patterns`, and `user_learning_preferences` tables
   - Set up RLS policies
   - Created indexes

2. **Backend Services**
   - `FeedbackService.js` - Capture overrides, manage preferences, get stats
   - Learning API routes - 9 endpoints for feedback and pattern management

3. **Frontend Components**
   - `FeedbackPrompt.jsx` - Full-featured feedback modal
   - `useFeedbackPrompt` hook - React hook for easy integration
   - Learning API client - Complete API wrapper

4. **Server Integration**
   - Learning routes registered in `server.js`
   - API endpoint documentation

### 🚧 Pending (Next Phases)

- Phase 2: Pattern Detection Service
- Phase 3: Learning Dashboard
- Phase 4: Learning Engine & Pattern Application
- Phase 5: Validation & Tracking

---

## Integration Points

### Where to Add Feedback Prompts

The feedback prompt should appear when users override AI recommendations in these locations:

#### 1. Task Assignment Changes (Assignment Agent)

**Location:** Task edit/update forms, inline task editors
**Trigger:** User changes `assigned_to` field
**Example context:**
- Task details
- Original assignee recommended by AI
- New assignee chosen by user

#### 2. Priority Changes (Priority Agent)

**Location:** Task priority selectors, project priority settings
**Trigger:** User changes `priority` field
**Example context:**
- Task/project details
- Original priority recommended by AI
- New priority chosen by user

#### 3. Deadline Changes (Deadline Agent)

**Location:** Due date pickers, deadline editors
**Trigger:** User changes `due_date` or `deadline` field
**Example context:**
- Task/project details
- Original deadline suggested by AI
- New deadline chosen by user

#### 4. Follow-up Actions (Follow-up Agent)

**Location:** Meeting recap editors, action item creators
**Trigger:** User modifies AI-generated follow-up actions
**Example context:**
- Meeting details
- Original follow-up suggested by AI
- Modified follow-up action

---

## Usage Examples

### Example 1: Task Assignment Override

```jsx
import React, { useState } from 'react';
import { useFeedbackPrompt, createContextSnapshot } from '../hooks/useFeedbackPrompt';
import api from '../services/api';

function TaskAssignmentEditor({ task, agentExecutionId }) {
  const [assignedTo, setAssignedTo] = useState(task.assigned_to);
  const { showFeedbackPrompt, FeedbackPromptComponent } = useFeedbackPrompt();

  const handleAssignmentChange = async (newAssignee) => {
    // Check if this is an override of AI recommendation
    const aiRecommendation = task.ai_recommendations?.assignment;

    if (aiRecommendation && aiRecommendation.id !== newAssignee.id) {
      // User is overriding AI - show feedback prompt
      showFeedbackPrompt({
        agentType: 'assignment',
        agentExecutionId: agentExecutionId,
        originalRecommendation: {
          id: aiRecommendation.id,
          name: aiRecommendation.name
        },
        userChoice: {
          id: newAssignee.id,
          name: newAssignee.name
        },
        context: createContextSnapshot(task)
      });
    }

    // Update the assignment
    setAssignedTo(newAssignee);
    await api.tasks.update(task.id, { assigned_to: newAssignee.id });
  };

  return (
    <div>
      {/* Assignment selector */}
      <select
        value={assignedTo?.id}
        onChange={(e) => {
          const newAssignee = teamMembers.find(m => m.id === e.target.value);
          handleAssignmentChange(newAssignee);
        }}
      >
        {teamMembers.map(member => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>

      {/* Render feedback prompt when shown */}
      <FeedbackPromptComponent />
    </div>
  );
}
```

### Example 2: Priority Override

```jsx
import { useFeedbackPrompt, createContextSnapshot } from '../hooks/useFeedbackPrompt';

function PrioritySelector({ task, onUpdate }) {
  const { showFeedbackPrompt, FeedbackPromptComponent } = useFeedbackPrompt();

  const handlePriorityChange = async (newPriority) => {
    // Check if AI recommended a different priority
    const aiRecommendation = task.ai_recommendations?.priority;

    if (aiRecommendation && aiRecommendation !== newPriority) {
      showFeedbackPrompt({
        agentType: 'priority',
        agentExecutionId: task.ai_execution_id,
        originalRecommendation: {
          value: aiRecommendation,
          label: aiRecommendation.charAt(0).toUpperCase() + aiRecommendation.slice(1)
        },
        userChoice: {
          value: newPriority,
          label: newPriority.charAt(0).toUpperCase() + newPriority.slice(1)
        },
        context: createContextSnapshot(task)
      });
    }

    // Update priority
    onUpdate({ ...task, priority: newPriority });
  };

  return (
    <>
      <div className="priority-selector">
        <button onClick={() => handlePriorityChange('high')}>High</button>
        <button onClick={() => handlePriorityChange('medium')}>Medium</button>
        <button onClick={() => handlePriorityChange('low')}>Low</button>
      </div>

      <FeedbackPromptComponent />
    </>
  );
}
```

### Example 3: Deadline Override

```jsx
import { useFeedbackPrompt, createContextSnapshot } from '../hooks/useFeedbackPrompt';

function DeadlinePicker({ task, onUpdate }) {
  const { showFeedbackPrompt, FeedbackPromptComponent } = useFeedbackPrompt();

  const handleDeadlineChange = async (newDeadline) => {
    const aiRecommendation = task.ai_recommendations?.deadline;

    if (aiRecommendation && aiRecommendation !== newDeadline) {
      showFeedbackPrompt({
        agentType: 'deadline',
        agentExecutionId: task.ai_execution_id,
        originalRecommendation: {
          date: aiRecommendation,
          formatted: new Date(aiRecommendation).toLocaleDateString()
        },
        userChoice: {
          date: newDeadline,
          formatted: new Date(newDeadline).toLocaleDateString()
        },
        context: createContextSnapshot(task)
      });
    }

    onUpdate({ ...task, due_date: newDeadline });
  };

  return (
    <>
      <input
        type="date"
        onChange={(e) => handleDeadlineChange(e.target.value)}
      />

      <FeedbackPromptComponent />
    </>
  );
}
```

### Example 4: Silent Override Capture

For cases where you don't want to show a prompt but still want to capture the override:

```jsx
import { captureOverrideSilently, createContextSnapshot } from '../hooks/useFeedbackPrompt';

async function handleBulkAssignment(tasks, assignee) {
  for (const task of tasks) {
    const aiRecommendation = task.ai_recommendations?.assignment;

    if (aiRecommendation && aiRecommendation.id !== assignee.id) {
      // Capture silently (no prompt for bulk operations)
      await captureOverrideSilently({
        agentType: 'assignment',
        agentExecutionId: task.ai_execution_id,
        originalRecommendation: {
          id: aiRecommendation.id,
          name: aiRecommendation.name
        },
        userChoice: {
          id: assignee.id,
          name: assignee.name
        },
        context: createContextSnapshot(task)
      });
    }

    // Update task
    await api.tasks.update(task.id, { assigned_to: assignee.id });
  }
}
```

---

## API Reference

### Frontend Hook: `useFeedbackPrompt()`

```javascript
const {
  showFeedbackPrompt,      // Function to show the prompt
  hideFeedbackPrompt,      // Function to hide the prompt
  FeedbackPromptComponent, // Component to render
  isShowing                // Boolean indicating if prompt is visible
} = useFeedbackPrompt();
```

### Helper Functions

#### `createContextSnapshot(task, deal, meeting, additionalContext)`

Creates a standardized context object for learning.

**Parameters:**
- `task` - Task object (optional)
- `deal` - Deal/CRM object (optional)
- `meeting` - Meeting object (optional)
- `additionalContext` - Any additional context data (optional)

**Returns:** Context object with normalized structure

#### `captureOverrideSilently(data)`

Captures an override without showing the feedback prompt.

**Parameters:**
- `data.agentType` - Agent type (assignment, priority, deadline, followup)
- `data.agentExecutionId` - Agent execution ID (optional)
- `data.originalRecommendation` - AI's recommendation
- `data.userChoice` - User's choice
- `data.context` - Context snapshot

### Backend API Endpoints

#### POST `/api/learning/feedback/override`

Capture user override with optional feedback.

**Request Body:**
```json
{
  "agentType": "assignment",
  "agentExecutionId": "uuid",
  "originalRecommendation": { "id": "user-1", "name": "John" },
  "userChoice": { "id": "user-2", "name": "Jane" },
  "feedbackReason": "more_experience",
  "feedbackText": "Jane has more experience in this area",
  "context": { "task": {...}, "deal": {...} }
}
```

#### GET `/api/learning/feedback/should-prompt?agentType=assignment`

Check if user wants feedback prompts.

**Response:**
```json
{
  "success": true,
  "data": { "shouldPrompt": true }
}
```

#### PUT `/api/learning/feedback/preference`

Update user feedback preference.

**Request Body:**
```json
{
  "agentType": "assignment",
  "enabled": false
}
```

#### GET `/api/learning/overrides/recent?agentType=assignment&limit=10`

Get recent overrides for the user.

#### GET `/api/learning/overrides/stats?days=30`

Get override statistics.

**Response:**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "byAgentType": {
      "assignment": 8,
      "priority": 5,
      "deadline": 2
    },
    "withFeedback": 10,
    "feedbackRate": 67
  }
}
```

#### GET `/api/learning/patterns?status=active&agentType=assignment`

Get learning patterns (Phase 2+).

#### POST `/api/learning/patterns/:patternId/approve`

Approve a detected pattern (Phase 2+).

#### POST `/api/learning/patterns/:patternId/reject`

Reject a detected pattern (Phase 2+).

#### POST `/api/learning/patterns/:patternId/deactivate`

Deactivate an active pattern (Phase 2+).

#### GET `/api/learning/report?period=month`

Get learning effectiveness report (Phase 5).

---

## Next Steps

### Phase 2: Pattern Detection (In Progress)

1. Implement `PatternDetectionService.js`:
   - Context clustering algorithm
   - Preference pattern detection
   - Boost pattern detection
   - Constraint pattern detection
   - Confidence scoring

2. Background job for pattern detection:
   - Triggered after each override capture
   - Runs asynchronously
   - Creates patterns when confidence threshold met

3. Pattern notification system:
   - Notify users when new patterns detected
   - Request approval before activation

### Phase 3: Learning Dashboard

1. Create `LearningDashboard.jsx`:
   - View active patterns
   - View pending patterns for approval
   - Pattern effectiveness metrics
   - Override statistics

2. Create `PatternCard.jsx`:
   - Display pattern details
   - Show supporting evidence
   - Approve/reject actions
   - Customization options

3. Create `PatternApprovalModal.jsx`:
   - Detailed pattern review
   - Customization interface
   - Evidence display
   - Approval/rejection flow

### Phase 4: Learning Engine

1. Create `LearningEngine.js`:
   - Apply active patterns to agent decisions
   - Boost/adjust scoring factors
   - Apply constraints
   - Track pattern effectiveness

2. Integrate with existing agents:
   - Assignment Agent
   - Priority Agent
   - Deadline Agent
   - Follow-up Agent

3. Pattern application testing:
   - Verify patterns improve accuracy
   - Monitor for negative effects
   - Auto-deprecate ineffective patterns

### Phase 5: Validation & Tracking

1. Outcome tracking system:
   - Link overrides to task completion
   - Track success rates
   - Measure time savings
   - Calculate AI accuracy improvement

2. Effectiveness reporting:
   - Monthly learning reports
   - Pattern performance metrics
   - User satisfaction tracking
   - ROI calculations

3. Auto-optimization:
   - Pattern refinement based on outcomes
   - Confidence score updates
   - Pattern deprecation for poor performers
   - Continuous learning improvement

---

## Integration Checklist

When integrating feedback prompts into a component:

- [ ] Import `useFeedbackPrompt` hook
- [ ] Import `createContextSnapshot` helper
- [ ] Detect when user overrides AI recommendation
- [ ] Call `showFeedbackPrompt()` with override data
- [ ] Render `<FeedbackPromptComponent />` in JSX
- [ ] Test feedback capture flow
- [ ] Verify data appears in `agent_overrides` table

---

## Testing

### Manual Testing Steps

1. **Feedback Prompt Display:**
   - Override an AI recommendation
   - Verify feedback prompt appears
   - Verify prompt auto-closes after 30 seconds

2. **Feedback Submission:**
   - Select a feedback reason
   - Submit feedback
   - Verify data saved in database
   - Verify prompt closes

3. **Skip Functionality:**
   - Override a recommendation
   - Click "Skip" on prompt
   - Verify override still captured (without feedback)
   - Verify prompt closes

4. **Don't Ask Again:**
   - Check "Don't ask again" checkbox
   - Submit or skip feedback
   - Override again for same agent type
   - Verify prompt does not appear
   - Verify override still captured

5. **Preference Management:**
   - Use API to reset preference
   - Verify prompts appear again

### Database Verification

```sql
-- Check recent overrides
SELECT * FROM agent_overrides
ORDER BY created_at DESC
LIMIT 10;

-- Check feedback preferences
SELECT * FROM user_learning_preferences
WHERE preference_key LIKE 'feedback_prompt_%';

-- Check override stats by agent type
SELECT
  agent_type,
  COUNT(*) as total_overrides,
  COUNT(feedback_reason) as with_feedback,
  ROUND(COUNT(feedback_reason)::numeric / COUNT(*)::numeric * 100, 2) as feedback_rate
FROM agent_overrides
GROUP BY agent_type;
```

---

**End of Integration Guide**

For questions or issues, refer to the main design document: `AGENT-FEEDBACK-LOOP-LEARNING-DESIGN.md`
