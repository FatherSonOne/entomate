📄 WEEK 7: AUTOMATIONS & BASIC AGENTS
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 58 items
Prerequisite: Week 6 complete with AI search working

🎯 WEEK 7 OVERVIEW
Goal: Create workflow automations and basic AI agents to handle recurring tasks automatically

By Friday EOD, you should have:

✅ Automation workflow builder (drag-and-drop)

✅ Trigger types (on meeting end, on action item creation, on deadline, on sentiment, on keywords)

✅ Action types (create task, send notification, update CRM, post to chat, create calendar event)

✅ Conditional logic (if/then/else)

✅ Basic agent: Auto-assign action items (AI determines best person)

✅ Basic agent: Auto-prioritize (AI sets priority based on impact)

✅ Basic agent: Deadline estimation (AI suggests due dates)

✅ Automation execution engine with logging

✅ Enable/disable automations

✅ Automation history and debugging

Time Commitment: 40 hours total (2 backend + 2 frontend + 1 AI specialist)

Success Metric: 95%+ of automations execute without errors

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: Automation Architecture & Design (8 hours)
Morning (9am-12pm): Automation Strategy & Data Model
PM / Product Lead + Tech Lead:

 Define Automation Types (20 mins)

Type 1: Simple triggers (one trigger → one action)

Type 2: Conditional flows (if condition → action A, else action B)

Type 3: Multi-step workflows (trigger → action 1 → decision → action 2 → action 3)

Type 4: Scheduled automations (run daily/weekly)

MVP: Types 1 & 2

 Define Trigger Types (20 mins)

Trigger 1: On meeting completion (+ filter by sentiment, keywords)

Trigger 2: On action item created (+ filter by priority, assignee)

Trigger 3: On action item due soon (X days before due date)

Trigger 4: On action item overdue

Trigger 5: Scheduled (daily, weekly, monthly)

Trigger 6: Manual (user clicks button)

 Define Action Types (20 mins)

Action 1: Create task in CRM

Action 2: Send Slack message

Action 3: Send email notification

Action 4: Update action item (status, priority, due date)

Action 5: Create calendar event

Action 6: Assign to person (AI-assisted)

Action 7: Tag meeting/action item

Action 8: Run AI agent

 Define Agent Types (20 mins)

Agent 1: Auto-assign (determines best person for task)

Agent 2: Auto-prioritize (sets priority based on impact/deadline)

Agent 3: Deadline estimator (suggests due dates)

Agent 4: Follow-up detector (identifies tasks needing follow-up)

 Design Database Schema (15 mins)

sql
automations (
  id, user_id, name, description, enabled,
  trigger_type, trigger_config (JSON),
  actions (JSON array), conditions (JSON),
  created_at, updated_at, last_run, next_run
)

automation_runs (
  id, automation_id, status, input, output,
  error_message, execution_time, created_at
)

automation_templates (
  id, name, description, trigger_type,
  actions, icon, category, popular_count
)
 Design UI Flow (15 mins)

text
Dashboard → Automations section
→ List of automations (enable/disable toggle)
→ Create automation button
→ Builder interface:
   1. Choose trigger
   2. Configure trigger
   3. Add actions
   4. Configure each action
   5. Add conditions (optional)
   6. Test automation
   7. Save & activate
Afternoon (1pm-5pm): Backend Architecture
Backend Lead:

 Design Automation Engine (25 mins)

Trigger listener (checks conditions)

Action executor (runs actions in sequence)

Error handler (logs failures, retries)

Scheduler (for scheduled automations)

text
Trigger fires
↓
Check conditions
↓
Build context
↓
Execute actions sequentially
↓
Log execution
↓
Retry on failure (up to 3 times)
 Design Agent System (20 mins)

Agent interface (consistent API)

Each agent implements:

analyze() - understand context

suggest() - generate suggestions

execute() - apply changes

Chain agents (one agent's output → next agent's input)

 Plan Execution Flow (20 mins)

Webhook from meeting completion → trigger check

Database query for matching automations

For each matching automation:

Evaluate conditions

Build execution plan

Execute actions

Log result

Handle partial failures

 Plan Scheduling (15 mins)

Use: Bull queue (Redis-based job queue)

Install: npm install bull redis

Schedule jobs at specific times

Retry failed jobs

Track execution history

 Create Test Plan (15 mins)

Test 1: Simple automation (trigger → action)

Test 2: Conditional automation (if/else)

Test 3: Multi-step automation

Test 4: Scheduled automation

Test 5: Agent-based automation

Test 6: Error handling

 Create Template Library (15 mins)

Template 1: "Post meeting summary to Slack"

Template 2: "Create CRM tasks from action items"

Template 3: "Auto-assign to team lead"

Template 4: "Alert on overdue items"

Template 5: "Weekly digest email"

🟢 TUESDAY: Automation Engine Backend (8 hours)
Morning (9am-12pm): Automation Service & Database
Backend Developer:

 Create Database Tables (25 mins)

Run migration: Create automations table

Run migration: Create automation_runs table

Run migration: Create automation_templates table

Add indexes for performance

Test queries

 Create Automation Service (30 mins)

Create: backend/services/automationService.js

Copy code from "SECTION: BACKEND CODE - automationService.js" below

Paste into file

 Create Action Executor (20 mins)

Create: backend/services/actionExecutor.js

Implement each action type

Error handling

Logging

 Test Service (10 mins)

Create test automation

Trigger it

Verify actions execute

Check logs

Afternoon (1pm-5pm): Agent Implementation
Backend Developer / AI Specialist:

 Create Agent Framework (25 mins)

Create: backend/services/agents/baseAgent.js

Create: backend/services/agents/assignmentAgent.js

Create: backend/services/agents/priorityAgent.js

Create: backend/services/agents/deadlineAgent.js

Copy code from "SECTION: BACKEND CODE - Agents" below

 Create Agent Orchestrator (20 mins)

Create: backend/services/agentOrchestrator.js

Runs agents in sequence

Passes context between agents

Aggregates results

Handles failures

 Create Automation Routes (25 mins)

Create: backend/routes/automations.js

GET /api/automations

POST /api/automations

PATCH /api/automations/:id

DELETE /api/automations/:id

POST /api/automations/:id/test

POST /api/automations/:id/run

 Register Routes (10 mins)

Add to backend/server.js

javascript
app.use('/api/automations', require('./routes/automations'));
 Setup Job Queue (15 mins)

Install Bull: npm install bull redis

Setup Redis connection

Create job processors

Start queue workers

 Test Routes & Agents (15 mins)

Test creating automation

Test running automation manually

Test agent suggestions

Verify all working

🟡 WEDNESDAY: Frontend Automation Builder (8 hours)
Morning (9am-12pm): Automation Builder UI
Frontend Developer:

 Create Automations List Component (25 mins)

Create: frontend/src/components/AutomationsList.jsx

Show all automations

Toggle enable/disable

Edit, duplicate, delete buttons

Show last run status

Copy code from "SECTION: FRONTEND CODE - AutomationsList.jsx" below

 Create Automation Builder Component (30 mins)

Create: frontend/src/components/AutomationBuilder.jsx

Step 1: Choose trigger

Step 2: Configure trigger

Step 3: Add actions

Step 4: Configure actions

Step 5: Add conditions

Step 6: Test/Save

 Create Trigger Configurator (15 mins)

Create: frontend/src/components/TriggerConfigurator.jsx

UI for each trigger type

Dropdowns, text inputs, date pickers

Help text for each option

 Create Action Builder (20 mins)

Create: frontend/src/components/ActionBuilder.jsx

Add action button

UI for each action type

Drag to reorder actions

Delete action button

Afternoon (1pm-5pm): Templates & Integration
Frontend Developer:

 Create Template Library Component (20 mins)

Create: frontend/src/components/TemplateLibrary.jsx

Show pre-built templates

One-click to use template

Show description and preview

 Create Automation Tester (20 mins)

Create: frontend/src/components/AutomationTester.jsx

Dry-run automation

Show what would happen

Confirm before running

Show results/errors

 Create Execution History (20 mins)

Create: frontend/src/components/ExecutionHistory.jsx

Show automation runs

Filter by status (success, failed, pending)

Show execution time

Show error messages

 Create Automation Service (20 mins)

Create: frontend/src/services/automationService.js

Fetch automations

Create/update/delete automations

Test automation

Get templates

Get execution history

 Create Styles (20 mins)

Create: frontend/src/styles/Automations.css

Style builder interface

Style action/trigger selectors

Mobile responsive

Dark mode support

 Test Components (15 mins)

Components render

Can create automation

Can select triggers/actions

Can save automation

🔵 THURSDAY: Integration Testing & Refinement (8 hours)
Morning (9am-12pm): End-to-End Automation Testing
QA & Backend Developer:

 Test #1: Simple Automation (25 mins)

Create automation: "On meeting end → Post to Slack"

Complete a meeting

Verify Slack message posted

Check execution log

 Test #2: Conditional Automation (25 mins)

Create automation: "If sentiment=negative → alert owner"

Complete negative sentiment meeting

Verify alert sent

Test with positive sentiment (should not trigger)

 Test #3: Agent-Based Automation (25 mins)

Create automation: "On action item → Auto-assign"

Create action item

Verify assigned to best person

Check AI reasoning in logs

 Test #4: Multi-Step Automation (15 mins)

Create automation with 3 actions

Trigger it

Verify all actions execute in order

Check each action completed

 Test #5: Scheduled Automation (10 mins)

Create scheduled automation (run in 1 minute)

Wait for execution

Verify it ran at correct time

Afternoon (1pm-5pm): Performance & Edge Cases
QA & Backend Developer:

 Performance Test (20 mins)

Create 100 automations

Trigger matching automations

Measure execution time (target: < 5 sec total)

Check no memory leaks

Monitor database queries

 Error Handling Tests (20 mins)

Test: CRM API fails during execution

Test: Slack API timeout

Test: Invalid trigger config

Test: Missing required fields

Verify: Proper error messages, retries

 Edge Cases (20 mins)

Test: No automations match trigger

Test: Automation with 0 actions

Test: Circular trigger (avoid infinite loops)

Test: Automation disabled mid-execution

Test: User deletes automation during run

 Agent Testing (20 mins)

Test: Assignment agent with one team member

Test: Priority agent with conflicting criteria

Test: Deadline agent with same-day deadline

Test: Agents with insufficient data

Verify: Graceful degradation

 Create Test Report (15 mins)

Document all tests

Performance metrics

Issues found

Recommendations

Sign-off

🟢 FRIDAY: Code Review & Production Prep (8 hours)
Morning (9am-12pm): Code Quality & Optimization
Tech Lead & Developers:

 Code Review: Automation Service (25 mins)

Review: backend/services/automationService.js

Review: backend/services/actionExecutor.js

Checklist:

 Error handling comprehensive

 Logging detailed

 Performance optimized

 Security checks (injection, authorization)

 Comments clear

 Code Review: Agents (20 mins)

Review: Agent implementations

Checklist:

 AI prompts optimized

 Fallback strategies

 Error handling

 Consistent interface

 Well documented

 Code Review: Frontend (20 mins)

Review: Builder component

Review: Templates component

Checklist:

 Responsive design

 Accessible

 Error messages clear

 Loading states

 No memory leaks

 Performance Optimization (20 mins)

Optimize database queries

Add missing indexes

Cache template library

Optimize animation/rendering

Lazy load heavy components

 Security Audit (15 mins)

Verify no automation can access unauthorized data

Check SQL injection prevention

Verify authorization on all endpoints

Check for rate limiting

Review error messages (no sensitive info)

Afternoon (1pm-5pm): Documentation & Deployment
Tech Lead & Developers:

 Update API Documentation (20 mins)

text
## POST /api/automations

Create new automation

Request:
{
"name": "Post meeting summary to Slack",
"trigger": {
"type": "meeting_completed",
"config": { "minSentiment": "neutral" }
},
"actions": [
{
"type": "slack_message",
"config": {
"channel": "#meetings",
"template": "meeting_summary"
}
}
],
"conditions": [],
"enabled": true
}

text

Response:
{
"id": "uuid",
"name": "...",
"trigger": {...},
"actions": [...],
"createdAt": "2025-12-17T...",
"lastRun": null
}

text

## POST /api/automations/:id/test

Test automation with sample data

Request:
{
"sampleData": {
"meetingId": "uuid",
"summary": "...",
"sentiment": "positive"
}
}

text

Response:
{
"wouldExecute": true,
"actions": [
{
"type": "slack_message",
"preview": "Message that would be sent..."
}
],
"agents": [
{
"name": "assignmentAgent",
"suggestion": "Assign to Sarah",
"confidence": 0.92
}
]
}

text
undefined
 Create Automation Guide (20 mins)

Create: docs/AUTOMATIONS_GUIDE.md

Include:

What are automations?

Getting started

Trigger types explained

Action types explained

Agents explained

Template library

Troubleshooting

 Create Administrator Guide (15 mins)

Document automation execution logs

How to debug automations

Performance considerations

Resource usage

Best practices

 Create User Guide (15 mins)

Create: docs/USER_GUIDE_WEEK7.md

Include:

How to create automations

Using templates

Testing automations

Enabling/disabling

Viewing execution history

Common use cases

 Commit & Push (10 mins)

bash
git add backend/services/automationService.js
git add backend/services/actionExecutor.js
git add backend/services/agents/
git add backend/routes/automations.js
git add frontend/src/components/AutomationBuilder.jsx
git add frontend/src/components/TemplateLibrary.jsx
git add frontend/src/services/automationService.js
git add docs/
git commit -m "Week 7: Automations and AI agents complete"
git push origin develop
 Weekly Demo (45 mins)

Demo 1: Show automation list

Demo 2: Create simple automation from template

Demo 3: Manually trigger automation

Demo 4: Show execution in Slack

Demo 5: Create conditional automation

Demo 6: Show agent suggestions (assignment)

Demo 7: Show execution history and logs

Q&A

 Retrospective & Planning (20 mins)

Week 7 retrospective

What's working well?

What needs improvement?

Preview Week 8: Production deployment

Team feedback

Next steps

🔧 BACKEND CODE - automationService.js
javascript
const supabase = require('../config/supabase');
const actionExecutor = require('./actionExecutor');
const agentOrchestrator = require('./agentOrchestrator');
const Bull = require('bull');

class AutomationService {
  constructor() {
    this.automationQueue = new Bull('automations', {
      redis: {
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379
      }
    });
    
    // Start processing jobs
    this.automationQueue.process(async (job) => {
      return await this.executeAutomation(job.data);
    });
    
    console.log('✅ Automation service initialized');
  }
  
  /**
   * Get all automations for user
   */
  async getAutomations(userId) {
    try {
      const { data, error } = await supabase
        .from('automations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data || [];
    } catch (error) {
      console.error('Error fetching automations:', error);
      throw error;
    }
  }
  
  /**
   * Create automation
   */
  async createAutomation(userId, automationData) {
    try {
      const { data, error } = await supabase
        .from('automations')
        .insert({
          user_id: userId,
          name: automationData.name,
          description: automationData.description,
          trigger_type: automationData.trigger.type,
          trigger_config: automationData.trigger.config,
          actions: automationData.actions,
          conditions: automationData.conditions || [],
          enabled: automationData.enabled !== false
        })
        .select()
        .single();
      
      if (error) throw error;
      
      console.log(`✅ Created automation: ${data.id}`);
      return data;
    } catch (error) {
      console.error('Error creating automation:', error);
      throw error;
    }
  }
  
  /**
   * Trigger automation check (called when trigger event occurs)
   */
  async checkTriggers(triggerType, context) {
    try {
      console.log(`🔍 Checking ${triggerType} triggers...`);
      
      // Find automations matching this trigger
      const { data: automations, error } = await supabase
        .from('automations')
        .select('*')
        .eq('trigger_type', triggerType)
        .eq('enabled', true);
      
      if (error) throw error;
      
      // Check each automation
      const triggeredAutomations = [];
      for (const automation of automations || []) {
        const shouldExecute = await this.shouldExecute(automation, context);
        
        if (shouldExecute) {
          triggeredAutomations.push(automation);
          
          // Queue for execution
          await this.automationQueue.add(
            {
              automationId: automation.id,
              context
            },
            {
              delay: 1000, // 1 second delay
              attempts: 3,
              backoff: {
                type: 'exponential',
                delay: 2000
              }
            }
          );
        }
      }
      
      console.log(`⚡ Queued ${triggeredAutomations.length} automations`);
      return triggeredAutomations;
    } catch (error) {
      console.error('Error checking triggers:', error);
      throw error;
    }
  }
  
  /**
   * Evaluate if automation should execute
   */
  async shouldExecute(automation, context) {
    try {
      // Check trigger config matches context
      const triggerConfig = automation.trigger_config || {};
      
      // Example: if trigger requires sentiment=positive and context.sentiment=negative, don't execute
      if (triggerConfig.requiredSentiment) {
        if (context.sentiment !== triggerConfig.requiredSentiment) {
          return false;
        }
      }
      
      // Check conditions
      if (automation.conditions && automation.conditions.length > 0) {
        for (const condition of automation.conditions) {
          const conditionMet = await this.evaluateCondition(condition, context);
          if (!conditionMet) {
            return false;
          }
        }
      }
      
      return true;
    } catch (error) {
      console.error('Error evaluating execution:', error);
      return false;
    }
  }
  
  /**
   * Evaluate a condition
   */
  async evaluateCondition(condition, context) {
    // TODO: Implement condition evaluation
    // Example: { field: 'sentiment', operator: 'equals', value: 'positive' }
    
    const { field, operator, value } = condition;
    const contextValue = context[field];
    
    switch (operator) {
      case 'equals':
        return contextValue === value;
      case 'contains':
        return String(contextValue).includes(value);
      case 'greater_than':
        return contextValue > value;
      case 'less_than':
        return contextValue < value;
      default:
        return true;
    }
  }
  
  /**
   * Execute automation
   */
  async executeAutomation(job) {
    const { automationId, context } = job.data;
    const startTime = Date.now();
    
    try {
      console.log(`⚙️ Executing automation: ${automationId}`);
      
      // Get automation
      const { data: automation, error } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .single();
      
      if (error) throw error;
      
      const executionResult = {
        automation_id: automationId,
        status: 'pending',
        input: context,
        output: {},
        error_message: null,
        execution_time: 0
      };
      
      try {
        // Execute actions
        const actionResults = [];
        for (const action of automation.actions || []) {
          try {
            // Check if action uses agents
            if (action.useAgent) {
              // Get agent suggestions
              const agentSuggestions = await agentOrchestrator.orchestrate(
                action.agents,
                context,
                automation
              );
              
              // Merge suggestions into action context
              action.context = { ...action.context, ...agentSuggestions };
            }
            
            // Execute action
            const result = await actionExecutor.executeAction(action, context);
            actionResults.push(result);
          } catch (error) {
            console.error(`Error executing action:`, error);
            actionResults.push({
              action: action.type,
              status: 'failed',
              error: error.message
            });
          }
        }
        
        executionResult.status = 'success';
        executionResult.output = { actions: actionResults };
      } catch (error) {
        executionResult.status = 'failed';
        executionResult.error_message = error.message;
      }
      
      executionResult.execution_time = Date.now() - startTime;
      
      // Log execution
      await supabase
        .from('automation_runs')
        .insert(executionResult);
      
      // Update automation last run time
      await supabase
        .from('automations')
        .update({
          last_run: new Date(),
          updated_at: new Date()
        })
        .eq('id', automationId);
      
      console.log(`✅ Automation completed: ${automationId} (${executionResult.execution_time}ms)`);
      
      return executionResult;
    } catch (error) {
      console.error(`❌ Automation failed: ${automationId}`, error);
      
      // Log failure
      await supabase
        .from('automation_runs')
        .insert({
          automation_id: automationId,
          status: 'failed',
          error_message: error.message,
          execution_time: Date.now() - startTime
        })
        .catch(err => console.error('Error logging failure:', err));
      
      throw error;
    }
  }
  
  /**
   * Test automation with sample data
   */
  async testAutomation(automationId, sampleData) {
    try {
      const { data: automation } = await supabase
        .from('automations')
        .select('*')
        .eq('id', automationId)
        .single();
      
      // Check if should execute
      const shouldExecute = await this.shouldExecute(automation, sampleData);
      
      if (!shouldExecute) {
        return {
          wouldExecute: false,
          reason: 'Conditions not met'
        };
      }
      
      // Show what actions would execute (don't actually execute)
      const preview = {
        wouldExecute: true,
        actions: automation.actions.map(action => ({
          type: action.type,
          preview: this.getActionPreview(action, sampleData)
        }))
      };
      
      // If using agents, show suggestions
      if (automation.actions.some(a => a.useAgent)) {
        const agentSuggestions = await agentOrchestrator.orchestrate(
          [action for action in automation.actions if action.useAgent],
          sampleData,
          automation
        );
        preview.agents = agentSuggestions;
      }
      
      return preview;
    } catch (error) {
      console.error('Error testing automation:', error);
      throw error;
    }
  }
  
  /**
   * Get preview of what action would do
   */
  getActionPreview(action, context) {
    switch (action.type) {
      case 'slack_message':
        return `Would send Slack message to ${action.config.channel}`;
      case 'create_task':
        return `Would create task in CRM`;
      case 'send_email':
        return `Would send email to ${action.config.recipients}`;
      default:
        return `Would execute ${action.type}`;
    }
  }
}

module.exports = new AutomationService();
🔧 BACKEND CODE - Agents
javascript
// baseAgent.js
class BaseAgent {
  constructor(name) {
    this.name = name;
  }
  
  /**
   * Analyze context
   */
  async analyze(context, automation) {
    throw new Error('analyze() must be implemented');
  }
  
  /**
   * Generate suggestion
   */
  async suggest(context, automation) {
    throw new Error('suggest() must be implemented');
  }
  
  /**
   * Execute suggestion
   */
  async execute(suggestion, context) {
    throw new Error('execute() must be implemented');
  }
}

// assignmentAgent.js
const { GoogleGenerativeAI } = require('@google/generative-ai');
const BaseAgent = require('./baseAgent');

class AssignmentAgent extends BaseAgent {
  constructor() {
    super('assignmentAgent');
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
  }
  
  async analyze(context, automation) {
    // Analyze action item and team expertise
    return {
      taskType: context.taskType || 'unknown',
      teamSize: context.team?.length || 0,
      urgency: context.priority || 'medium',
      requiredSkills: context.requiredSkills || []
    };
  }
  
  async suggest(context, automation) {
    try {
      console.log(`🧠 Assignment agent analyzing...`);
      
      const analysis = await this.analyze(context, automation);
      
      // Build prompt for Gemini
      const teamInfo = context.team
        .map(m => `${m.name}: ${m.skills?.join(', ') || 'no skills listed'}`)
        .join('\n');
      
      const prompt = `Given this action item and team, who should be assigned?
      
Task: ${context.task}
Type: ${analysis.taskType}
Required skills: ${analysis.requiredSkills.join(', ')}
Priority: ${analysis.urgency}

Team:
${teamInfo}

Consider:
- Skill match
- Current workload
- Availability
- Expertise level

Return ONLY this JSON:
{
  "recommended": "person's name",
  "reason": "brief reason",
  "confidence": 0.0-1.0,
  "alternatives": ["name1", "name2"]
}`;
      
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });
      
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const suggestion = JSON.parse(jsonMatch ? jsonMatch[0] : text);
      
      return suggestion;
    } catch (error) {
      console.error('Error in assignment agent:', error);
      return {
        recommended: context.team[0]?.name || 'unassigned',
        reason: 'Error in assignment, using default',
        confidence: 0.3
      };
    }
  }
  
  async execute(suggestion, context) {
    // This would update the action item assignment
    // Return the execution result
    return {
      type: 'assignment',
      assignedTo: suggestion.recommended,
      confidence: suggestion.confidence,
      executed: true
    };
  }
}

// priorityAgent.js
class PriorityAgent extends BaseAgent {
  constructor() {
    super('priorityAgent');
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
  }
  
  async suggest(context, automation) {
    try {
      console.log(`🧠 Priority agent analyzing...`);
      
      const prompt = `Based on this meeting, what should the action item priorities be?

Meeting: ${context.meetingTitle}
Summary: ${context.summary}
Sentiment: ${context.sentiment}
Items to prioritize:
${context.actionItems.map(i => `- ${i.task}`).join('\n')}

Factors:
- Meeting sentiment (positive = less urgent, negative = more urgent)
- Stated importance in meeting
- Dependencies
- Timeline

Return ONLY this JSON:
{
  "priorities": {
    "item1": "high|medium|low",
    "item2": "high|medium|low"
  },
  "reasoning": "brief explanation"
}`;
      
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });
      
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (error) {
      console.error('Error in priority agent:', error);
      return { priorities: {}, reasoning: 'Error in analysis' };
    }
  }
}

// deadlineAgent.js
class DeadlineAgent extends BaseAgent {
  constructor() {
    super('deadlineAgent');
    this.genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
  }
  
  async suggest(context, automation) {
    try {
      console.log(`🧠 Deadline agent analyzing...`);
      
      const prompt = `Suggest realistic due dates for these action items:

Meeting context: ${context.meetingTitle}
Meeting date: ${context.meetingDate}
Items:
${context.actionItems.map(i => `- ${i.task} (priority: ${i.priority})`).join('\n')}

Consider:
- Priority (high = sooner, low = later)
- Typical project timelines
- Dependencies
- Realistic effort estimation

Return ONLY this JSON:
{
  "suggestions": {
    "item1": "YYYY-MM-DD",
    "item2": "YYYY-MM-DD"
  },
  "reasoning": "explanation"
}`;
      
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{ text: prompt }]
        }]
      });
      
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      return JSON.parse(jsonMatch ? jsonMatch[0] : text);
    } catch (error) {
      console.error('Error in deadline agent:', error);
      return { suggestions: {}, reasoning: 'Error in analysis' };
    }
  }
}

module.exports = {
  BaseAgent,
  AssignmentAgent,
  PriorityAgent,
  DeadlineAgent
};
🔧 FRONTEND CODE - AutomationsList.jsx
jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/Automations.css';

export default function AutomationsList() {
  const [automations, setAutomations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  useEffect(() => {
    loadAutomations();
  }, []);
  
  const loadAutomations = async () => {
    try {
      setLoading(true);
      const response = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/automations`
      );
      setAutomations(response.data || []);
    } catch (err) {
      setError(`Failed to load automations: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const handleToggle = async (automation) => {
    try {
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/automations/${automation.id}`,
        { enabled: !automation.enabled }
      );
      setAutomations(automations.map(a =>
        a.id === automation.id ? { ...a, enabled: !a.enabled } : a
      ));
    } catch (err) {
      setError(`Failed to toggle automation: ${err.message}`);
    }
  };
  
  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure?')) return;
    
    try {
      await axios.delete(
        `${import.meta.env.VITE_API_URL}/api/automations/${id}`
      );
      setAutomations(automations.filter(a => a.id !== id));
    } catch (err) {
      setError(`Failed to delete automation: ${err.message}`);
    }
  };
  
  if (loading) return <div>Loading automations...</div>;
  
  return (
    <div className="automations-list">
      <h2>⚙️ Automations</h2>
      
      {error && <div className="error-message">{error}</div>}
      
      <button className="btn-create-automation">
        + Create Automation
      </button>
      
      {automations.length === 0 ? (
        <div className="empty">
          No automations yet. Create one to get started!
        </div>
      ) : (
        <div className="automations-grid">
          {automations.map(automation => (
            <div key={automation.id} className="automation-card">
              <div className="card-header">
                <h3>{automation.name}</h3>
                <label className="toggle">
                  <input
                    type="checkbox"
                    checked={automation.enabled}
                    onChange={() => handleToggle(automation)}
                  />
                  <span className="toggle-slider"></span>
                </label>
              </div>
              
              <p className="description">{automation.description}</p>
              
              <div className="automation-details">
                <div className="detail">
                  <span className="label">Trigger:</span>
                  <span className="value">{automation.trigger_type}</span>
                </div>
                
                <div className="detail">
                  <span className="label">Actions:</span>
                  <span className="value">{automation.actions?.length || 0}</span>
                </div>
                
                <div className="detail">
                  <span className="label">Last run:</span>
                  <span className="value">
                    {automation.last_run
                      ? new Date(automation.last_run).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
              </div>
              
              <div className="card-actions">
                <button className="btn-edit">✏️ Edit</button>
                <button className="btn-test">🧪 Test</button>
                <button
                  onClick={() => handleDelete(automation.id)}
                  className="btn-delete"
                >
                  🗑️ Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
📋 WEEK 7 TASKS SUMMARY
Total Tasks: 58

Monday: 12 tasks (Architecture & design)

Tuesday: 10 tasks (Backend services & agents)

Wednesday: 12 tasks (Frontend builder)

Thursday: 12 tasks (Testing & refinement)

Friday: 12 tasks (Code review & deployment)

✅ WEEK 7 SIGN-OFF CHECKLIST
Complete ALL before Week 8 (Production):

Automation Engine
 Trigger system working

 Action executor executing all actions

 Error handling and retries

 Job queue processing jobs

 Execution logging complete

Agents
 Assignment agent suggesting correct people

 Priority agent setting appropriate priorities

 Deadline agent estimating realistic dates

 Agent orchestrator chaining agents

 Graceful degradation on errors

Frontend
 Automation list displays all automations

 Builder creates automations correctly

 Template library working

 Tester shows preview correctly

 Execution history displays

Testing
 Simple automation test: PASS

 Conditional automation test: PASS

 Agent automation test: PASS

 Multi-step automation test: PASS

 Error handling test: PASS

 Performance test: < 5 sec for 100 automations

Quality
 Code reviewed (2+ reviewers)

 Security audit passed

 Performance optimized

 No memory leaks

 Error messages helpful

Documentation
 API.md updated

 AUTOMATIONS_GUIDE.md created

 USER_GUIDE_WEEK7.md created

 Admin guide created

 Code commented

📊 WEEK 7 SUCCESS METRICS
Metric	Target	Actual
Automation success rate	95%+	___
Average execution time	< 2 sec	___
Agent suggestion accuracy	85%+	___
Error recovery rate	90%+	___
🚀 READY FOR WEEK 8?
When all checkboxes complete:

✅ Commit all Week 7 code

✅ Create branch: feature/week-8-production

✅ Review production deployment plan

✅ All systems ready

End of WEEK 7 Guide

You now have:

✅ Week 1: Foundation & Setup

✅ Week 2: Meeting Recording

✅ Week 3: CRM Sync

✅ Week 4: Chat Integration

✅ Week 5: Dashboard

✅ Week 6: AI Search

✅ Week 7: Automations

WEEK 8: PRODUCTION DEPLOYMENT IS NEXT!

This is your last development week before going live. Week 8 will cover:

✅ Security hardening

✅ Performance optimization

✅ Database backups & recovery

✅ Monitoring & logging

✅ Deployment to production

✅ User documentation

✅ Launch preparation

Ready to deploy?

Reply: "Send WEEK 8" (Final week!)