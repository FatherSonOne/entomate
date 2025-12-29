📄 WEEK 3: CRM SYNC (AUTO-CREATE TASKS)
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 52 items
Prerequisite: Week 2 complete with meeting recording working

🎯 WEEK 3 OVERVIEW
Goal: Action items from meetings automatically sync to your CRM (HubSpot, Salesforce, or Pipedrive)

By Friday EOD, you should have:

✅ CRM API integration configured (HubSpot/Salesforce/Pipedrive)

✅ Task creation in CRM working automatically

✅ Correct task assignment (to right person)

✅ Due dates and priorities synced

✅ Sync status visible in UI (Synced ✅ / Pending ⏳)

✅ Manual sync button for re-sync

✅ Error handling with retry logic

✅ Sync history/logs visible

✅ No duplicate tasks created

✅ Handles edge cases (unknown email, invalid priority)

Time Commitment: 40 hours total (3 backend + 2 frontend + 1 QA + 1 integration specialist)

Success Metric: 95%+ of action items sync to CRM without manual intervention

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: CRM Setup & Planning (8 hours)
Morning (9am-12pm): CRM Integration Planning
DevOps / Integration Lead + Backend Lead:

 Choose Your CRM (5 mins) - REQUIRED

 HubSpot (easiest integration, recommended)

 Salesforce (more complex, powerful)

 Pipedrive (sales-focused)

 Custom API (if using different CRM)

Recommendation for Week 3: Use HubSpot (easiest)

 Get CRM API Credentials (30 mins)

For HubSpot:

text
1. Go to: https://app.hubspot.com/
2. Settings (gear icon) → Integrations → Private Apps
3. Click: "Create app"
4. Name: "Entomate"
5. Scopes needed:
   - crm.objects.contacts.read
   - crm.objects.contacts.write
   - crm.objects.deals.read
   - crm.objects.deals.write
6. Copy: Private App Access Token
7. Save in .env: CRM_API_KEY=xxxxx
For Salesforce:

text
1. Go to: https://login.salesforce.com/
2. Setup → Apps → App Manager
3. "New Connected App"
4. Name: Entomate
5. Enable: OAuth Settings
6. Scopes: api, web, refresh_token
7. Copy: Client ID and Client Secret
8. Save in .env: 
   CRM_CLIENT_ID=xxxxx
   CRM_CLIENT_SECRET=xxxxx
For Pipedrive:

text
1. Go to: https://app.pipedrive.com/
2. Settings → Personal Preferences
3. API → Copy API Token
4. Save in .env: CRM_API_KEY=xxxxx
 Test CRM API Connection (15 mins)

Create test script to verify credentials work

Should be able to list contacts/deals

Document any API limitations (rate limits, etc.)

 Create Task Schema (10 mins)

Document CRM task structure

Map action_items fields to CRM task fields:

text
Entomate → CRM
task_description → task_title
assigned_to_email → assignee_email
due_date → due_date
priority → priority
meeting_id → (store in description/notes)
Afternoon (1pm-5pm): Backend Architecture
Backend Lead:

 Create CRM Service Structure (20 mins)

Create: backend/services/crmService.js (abstract base)

Create: backend/integrations/hubspot.js (HubSpot specific)

Create: backend/integrations/salesforce.js (Salesforce specific - optional)

Create: backend/integrations/pipedrive.js (Pipedrive specific - optional)

 Design CRM Sync Flow (20 mins)

text
Action item created
→ Check if auto-sync enabled
→ Get CRM assignee ID (by email)
→ Create task in CRM
→ Store CRM task ID
→ Mark as "synced"
→ Log success

If error:
→ Mark as "failed"
→ Store error message
→ Schedule retry (5 mins later)
→ Log error
 Create CRM Sync Endpoint (20 mins)

Plan: POST /api/integrations/crm/sync-action-items

Body: { actionItemIds: [...] }

Response: { synced: 5, failed: 0, errors: [] }

 Update Database Schema (20 mins)

Verify fields exist in action_items table:

 crm_sync_status (pending, synced, failed)

 crm_task_id (store CRM's task ID)

 last_sync_attempt (timestamp)

 last_sync_error (error message)

If missing, create migration in Supabase

 Create Test Plan (10 mins)

Test 1: Sync 1 action item, verify in CRM

Test 2: Sync 10 action items at once

Test 3: Retry failed syncs

Test 4: Handle invalid emails

Test 5: Handle network errors

🟢 TUESDAY: CRM Service Implementation (8 hours)
Morning (9am-12pm): Abstract CRM Service
Backend Developer:

 Create Abstract CRM Service (30 mins)

Create: backend/services/crmService.js

Copy code from "SECTION: BACKEND CODE - crmService.js" below

Paste into file

 Create HubSpot Integration (30 mins)

Create: backend/integrations/hubspot.js

Copy code from "SECTION: BACKEND CODE - hubspot.js" below

Paste into file

 Test HubSpot Connection (15 mins)

bash
node -e "
const hubspot = require('./integrations/hubspot');
hubspot.test().then(console.log).catch(console.error);
"
Expected: Returns list of contacts or success message

 Get HubSpot Contact IDs (15 mins)

Test creating a test contact in HubSpot

Get their email address

Verify can look up by email

Document the flow

Afternoon (1pm-5pm): CRM Routes Implementation
Backend Developer:

 Create Integrations Routes (30 mins)

Create: backend/routes/integrations.js

Copy code from "SECTION: BACKEND CODE - integrations.js" below

Paste into file

 Register Routes (10 mins)

Open: backend/server.js

Add after existing routes:

javascript
app.use('/api/integrations', require('./routes/integrations'));
 Test Sync Endpoint (20 mins)

bash
# First, create an action item manually in database
# Then test sync endpoint
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"actionItemIds": ["<action-item-id>"]}' \
  http://localhost:3000/api/integrations/crm/sync-action-items
Expected response:

json
{
  "synced": 1,
  "failed": 0,
  "errors": []
}
 Test Error Handling (15 mins)

Test with invalid action item ID

Test with invalid email

Test network timeout

Document error responses

 Test Sync Status API (10 mins)

bash
curl http://localhost:3000/api/integrations/crm/status
Expected: Shows integration status and recent syncs

 Add Retry Logic (15 mins)

Implement: Retry failed syncs after 5 minutes

Test: Simulate network error, verify retry happens

Document retry behavior

🟡 WEDNESDAY: Frontend Sync UI (8 hours)
Morning (9am-12pm): Sync Status Display
Frontend Developer:

 Update Action Items Component (30 mins)

Open: frontend/src/components/ActionItemsList.jsx

Add sync status badge (✅ Synced / ⏳ Pending / ❌ Failed)

Copy code from "SECTION: FRONTEND CODE - ActionItemsList.jsx" below

Replace existing file

 Create Sync Service (20 mins)

Create: frontend/src/services/crmService.js

Copy code from "SECTION: FRONTEND CODE - crmService.js" below

Paste into file

 Add Manual Sync Button (20 mins)

Add button next to each action item: "Sync to CRM"

Button only shows if status = "pending"

Shows spinner while syncing

Updates status badge when complete

 Test UI Rendering (10 mins)

Frontend should load without errors

Action items should show sync status

Sync button should be clickable

Afternoon (1pm-5pm): UI Integration & Testing
Frontend Developer:

 Create Sync History Component (25 mins)

Create: frontend/src/components/SyncHistory.jsx

Shows recent syncs

Shows sync status for each

Shows error messages if failed

Shows timestamps

 Update Meeting Detail View (20 mins)

Add "Sync to CRM" button at top

Syncs ALL action items at once

Shows summary: "5 synced, 0 failed"

Shows errors if any

 Test Full Sync Flow (20 mins)

Record a test meeting

See action items extracted

Click "Sync to CRM"

Verify status changes to "Synced"

Log into CRM and verify tasks created

 Test Error Display (15 mins)

Try syncing with invalid email

Should show error message

Should allow retry

Should not lose action item

 Add Loading States (15 mins)

Show spinner while syncing

Disable button while loading

Show success/error messages

Auto-dismiss after 3 seconds

 Create Styles (15 mins)

Create: frontend/src/styles/SyncStatus.css

Style badges (synced, pending, failed)

Style buttons and loading states

Mobile responsive

🔵 THURSDAY: End-to-End Testing (8 hours)
Morning (9am-12pm): Integration Testing
QA & Backend Developer:

 Full Sync Flow Test #1: Single Action Item (30 mins)

Record test meeting

Extract action item (known person)

Trigger sync

Verify task appears in CRM

Check all fields (title, assigned, due date, priority)

Database shows crm_task_id

 Full Sync Flow Test #2: Multiple Action Items (25 mins)

Record test meeting

Extract 5 action items

Sync all at once

Verify all 5 appear in CRM

Verify no duplicates created

Check each has crm_task_id

 Accuracy Test: Field Mapping (20 mins)

Create action item with:

Task: "Review Q1 budget"

Owner: "john@company.com"

Due: 5 days from now

Priority: High

Sync to CRM

Verify in CRM:

Title matches

Assigned to John

Due date correct

Priority correct (maps to CRM priority)

 Error Handling Test #1: Invalid Email (15 mins)

Create action item with fake email: "nonexistent@fake.com"

Try to sync

Expected: Error message, item marked "failed"

Should not crash

User can see error

 Error Handling Test #2: Network Failure (10 mins)

Simulate network down (disconnect internet)

Try to sync

Expected: Error message

Retry logic should queue it

When network back, should retry automatically

Afternoon (1pm-5pm): Performance & Edge Cases
QA & Backend Developer:

 Performance Test: Sync 100 Items (30 mins)

Create 100 action items (or use existing)

Trigger bulk sync

Measure time (target: < 2 minutes)

Check no timeouts

Verify all synced

 Edge Case #1: Duplicate Sync (15 mins)

Sync action item to CRM (already synced)

Try syncing again

Expected: Should use existing crm_task_id, not create new

Verify no duplicate in CRM

 Edge Case #2: Update After Sync (15 mins)

Sync action item to CRM

Edit action item (change due date)

Sync again

Expected: CRM task should update (if feature implemented)

Document if not supported in MVP

 Edge Case #3: Different Priority Formats (15 mins)

Test action items with:

Priority: "High" (our format)

Priority: "high" (lowercase)

Priority: "CRITICAL" (different format)

Expected: All should map correctly to CRM format

 Edge Case #4: CRM User Not Found (15 mins)

Try syncing to person not in CRM

Expected: Clear error message

Should suggest creating user in CRM

Should not crash system

 Create Test Report (20 mins)

Document all tests passed/failed

Performance metrics

Error handling verification

Edge cases covered

Recommendations

🟢 FRIDAY: Code Review & Deployment (8 hours)
Morning (9am-12pm): Code Quality
Tech Lead & Developers:

 Code Review: CRM Service (30 mins)

Review: backend/services/crmService.js

Review: backend/integrations/hubspot.js

Checklist:

 Error handling comprehensive

 API rate limits respected

 Credentials never logged

 Retry logic correct

 Comments clear

 No hardcoded values

 Code Review: Frontend (25 mins)

Review: frontend/src/components/ActionItemsList.jsx

Review: frontend/src/services/crmService.js

Review: frontend/src/components/SyncHistory.jsx

Checklist:

 Error messages user-friendly

 Loading states obvious

 No console.logs

 Responsive design

 Accessible (keyboard nav)

 Run Linter & Formatter (15 mins)

bash
npx eslint backend/integrations/hubspot.js
npx prettier --write backend/integrations/hubspot.js
npx eslint frontend/src/components/ActionItemsList.jsx
npx prettier --write frontend/src/components/ActionItemsList.jsx
 Security Audit (20 mins)

Verify API keys not in code

Verify environment variables used

Check for SQL injection vulnerabilities

Check for XSS vulnerabilities

Verify CORS settings

Afternoon (1pm-5pm): Documentation & Deployment
PM & Tech Lead:

 Update API Documentation (20 mins)

Open: docs/API.md

Add endpoints:

text
## POST /api/integrations/crm/sync-action-items

Sync action items to CRM

Request body:
{
"actionItemIds": ["uuid1", "uuid2"]
}

text

Response:
{
"synced": 2,
"failed": 0,
"errors": []
}

text

## GET /api/integrations/crm/status

Get CRM integration status

Response:
{
"connected": true,
"provider": "hubspot",
"lastSync": "2025-12-17T12:00:00Z",
"stats": {
"totalSynced": 42,
"totalFailed": 2
}
}

text
undefined
 Create CRM Setup Guide (20 mins)

Create: docs/CRM_SETUP.md

Include:

Step-by-step for each CRM

How to get API keys

How to test connection

Troubleshooting

 Create User Guide (15 mins)

Create: docs/USER_GUIDE_WEEK3.md

Include:

How to auto-sync action items

How to manually sync

Understanding sync status

Handling sync errors

 Commit & Push (10 mins)

bash
git add backend/services/crmService.js
git add backend/integrations/hubspot.js
git add backend/routes/integrations.js
git add frontend/src/components/ActionItemsList.jsx
git add frontend/src/services/crmService.js
git add docs/
git commit -m "Week 3: CRM integration and auto-sync complete"
git push origin develop
 Weekly Demo (45 mins)

Demo 1: Record meeting with 3 action items

Demo 2: Show action items auto-sync status

Demo 3: Click sync button, show tasks appear in CRM

Demo 4: Show error handling (invalid email)

Demo 5: Show database records with crm_task_id

Q&A

 Retrospective (15 mins)

What went well?

What was challenging?

Improvements for next week

Team feedback

🔧 BACKEND CODE - crmService.js
javascript
/**
 * Abstract CRM Service
 * Base class for all CRM integrations
 */
class CRMService {
  constructor(provider) {
    this.provider = provider;
    this.authenticated = false;
  }
  
  /**
   * Test connection to CRM
   */
  async test() {
    throw new Error('test() must be implemented by subclass');
  }
  
  /**
   * Get contact by email
   */
  async getContactByEmail(email) {
    throw new Error('getContactByEmail() must be implemented by subclass');
  }
  
  /**
   * Create task in CRM
   */
  async createTask(taskData) {
    throw new Error('createTask() must be implemented by subclass');
  }
  
  /**
   * Update task in CRM
   */
  async updateTask(taskId, taskData) {
    throw new Error('updateTask() must be implemented by subclass');
  }
  
  /**
   * Map priority level
   */
  mapPriority(entomate_priority) {
    const mapping = {
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return mapping[entomate_priority.toLowerCase()] || 'MEDIUM';
  }
  
  /**
   * Format due date
   */
  formatDueDate(dateString) {
    if (!dateString) return null;
    return new Date(dateString).toISOString().split('T')[0];
  }
}

module.exports = CRMService;
🔧 BACKEND CODE - hubspot.js
javascript
const axios = require('axios');
const CRMService = require('../services/crmService');

class HubSpotIntegration extends CRMService {
  constructor() {
    super('hubspot');
    this.apiKey = process.env.CRM_API_KEY;
    this.baseUrl = 'https://api.hubapi.com';
    
    if (!this.apiKey) {
      throw new Error('CRM_API_KEY not set for HubSpot');
    }
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });
    
    console.log('✅ HubSpot integration initialized');
  }
  
  /**
   * Test connection to HubSpot
   */
  async test() {
    try {
      const response = await this.client.get('/crm/v3/objects/contacts');
      console.log('✅ HubSpot connection successful');
      return { success: true, contactCount: response.data.paging?.total || 0 };
    } catch (error) {
      console.error('❌ HubSpot connection failed:', error.message);
      throw new Error(`HubSpot test failed: ${error.message}`);
    }
  }
  
  /**
   * Get contact by email
   */
  async getContactByEmail(email) {
    try {
      const response = await this.client.get(
        `/crm/v3/objects/contacts/search`,
        {
          data: {
            filterGroups: [
              {
                filters: [
                  {
                    propertyName: 'email',
                    operator: 'EQ',
                    value: email
                  }
                ]
              }
            ],
            limit: 1
          }
        }
      );
      
      if (response.data.results && response.data.results.length > 0) {
        return response.data.results[0].id;
      }
      
      throw new Error(`Contact not found: ${email}`);
    } catch (error) {
      console.error('Error getting contact:', error.message);
      throw error;
    }
  }
  
  /**
   * Create task in HubSpot
   */
  async createTask(taskData) {
    try {
      // Get contact ID if email provided
      let ownerId = null;
      if (taskData.assignedToEmail) {
        try {
          ownerId = await this.getContactByEmail(taskData.assignedToEmail);
        } catch (error) {
          console.warn(`Could not find contact: ${taskData.assignedToEmail}`);
          // Continue without owner
        }
      }
      
      const payload = {
        properties: {
          hs_task_body: taskData.task_description,
          hs_task_subject: taskData.task_description,
          hs_task_priority: this.mapPriority(taskData.priority),
          hs_task_status: 'NOT_STARTED'
        }
      };
      
      // Add due date if provided
      if (taskData.due_date) {
        payload.properties.hs_task_due_date = this.formatDueDate(taskData.due_date);
      }
      
      // Add owner if found
      if (ownerId) {
        payload.properties.hubspot_owner_id = ownerId;
      }
      
      const response = await this.client.post(
        '/crm/v3/objects/tasks',
        payload
      );
      
      console.log('✅ Task created in HubSpot:', response.data.id);
      
      return {
        taskId: response.data.id,
        url: response.data.properties.hs_task_link || null
      };
    } catch (error) {
      console.error('Error creating task in HubSpot:', error.message);
      throw new Error(`Failed to create HubSpot task: ${error.message}`);
    }
  }
  
  /**
   * Update task in HubSpot
   */
  async updateTask(taskId, taskData) {
    try {
      const payload = {
        properties: {
          hs_task_body: taskData.task_description,
          hs_task_priority: this.mapPriority(taskData.priority),
          hs_task_status: taskData.status || 'NOT_STARTED'
        }
      };
      
      if (taskData.due_date) {
        payload.properties.hs_task_due_date = this.formatDueDate(taskData.due_date);
      }
      
      await this.client.patch(
        `/crm/v3/objects/tasks/${taskId}`,
        payload
      );
      
      console.log('✅ Task updated in HubSpot:', taskId);
      
      return true;
    } catch (error) {
      console.error('Error updating task in HubSpot:', error.message);
      throw error;
    }
  }
  
  /**
   * Map Entomate priority to HubSpot priority
   */
  mapPriority(priority) {
    const mapping = {
      'high': 'HIGH',
      'medium': 'MEDIUM',
      'low': 'LOW'
    };
    return mapping[priority.toLowerCase()] || 'MEDIUM';
  }
}

module.exports = new HubSpotIntegration();
🔧 BACKEND CODE - integrations.js
javascript
const express = require('express');
const supabase = require('../config/supabase');
const hubspot = require('../integrations/hubspot');
const router = express.Router();

/**
 * POST /api/integrations/crm/sync-action-items
 * Sync action items to CRM
 */
router.post('/crm/sync-action-items', async (req, res) => {
  try {
    const { actionItemIds } = req.body;
    
    if (!actionItemIds || !Array.isArray(actionItemIds)) {
      return res.status(400).json({ 
        error: 'actionItemIds must be an array' 
      });
    }
    
    console.log(`🔄 Syncing ${actionItemIds.length} action items to CRM...`);
    
    // Get action items
    const { data: actionItems, error: fetchError } = await supabase
      .from('action_items')
      .select('*')
      .in('id', actionItemIds)
      .eq('crm_sync_status', 'pending');
    
    if (fetchError) throw fetchError;
    
    const results = {
      synced: 0,
      failed: 0,
      errors: []
    };
    
    // Sync each action item
    for (const item of actionItems) {
      try {
        console.log(`Syncing: ${item.task_description}`);
        
        // Create task in CRM
        const crmResult = await hubspot.createTask({
          task_description: item.task_description,
          assigned_to_email: item.assigned_to_email,
          due_date: item.due_date,
          priority: item.priority
        });
        
        // Update action item with CRM task ID
        const { error: updateError } = await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'synced',
            crm_task_id: crmResult.taskId,
            last_sync_attempt: new Date().toISOString(),
            last_sync_error: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        if (updateError) throw updateError;
        
        results.synced++;
        console.log(`✅ Synced: ${item.task_description}`);
        
      } catch (error) {
        results.failed++;
        results.errors.push({
          itemId: item.id,
          task: item.task_description,
          error: error.message
        });
        
        // Mark as failed
        await supabase
          .from('action_items')
          .update({
            crm_sync_status: 'failed',
            last_sync_attempt: new Date().toISOString(),
            last_sync_error: error.message,
            updated_at: new Date().toISOString()
          })
          .eq('id', item.id);
        
        console.error(`❌ Failed to sync: ${item.task_description}`, error.message);
      }
    }
    
    res.json(results);
    
  } catch (error) {
    console.error('❌ Sync error:', error);
    res.status(500).json({
      error: 'Failed to sync action items',
      details: error.message
    });
  }
});

/**
 * POST /api/integrations/crm/test
 * Test CRM connection
 */
router.post('/crm/test', async (req, res) => {
  try {
    const result = await hubspot.test();
    res.json({
      success: true,
      provider: 'hubspot',
      ...result
    });
  } catch (error) {
    res.status(500).json({
      error: 'CRM test failed',
      details: error.message
    });
  }
});

/**
 * GET /api/integrations/crm/status
 * Get CRM integration status
 */
router.get('/crm/status', async (req, res) => {
  try {
    const { data: stats } = await supabase
      .from('action_items')
      .select('crm_sync_status', { count: 'exact' });
    
    const synced = stats?.filter(s => s.crm_sync_status === 'synced').length || 0;
    const failed = stats?.filter(s => s.crm_sync_status === 'failed').length || 0;
    const pending = stats?.filter(s => s.crm_sync_status === 'pending').length || 0;
    
    res.json({
      connected: true,
      provider: 'hubspot',
      stats: {
        totalSynced: synced,
        totalFailed: failed,
        totalPending: pending
      }
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Could not get status',
      details: error.message
    });
  }
});

/**
 * GET /api/integrations/crm/sync-logs
 * Get recent sync logs
 */
router.get('/crm/sync-logs', async (req, res) => {
  try {
    const { limit = 50 } = req.query;
    
    const { data: logs } = await supabase
      .from('action_items')
      .select('id, task_description, crm_sync_status, last_sync_attempt, last_sync_error, crm_task_id')
      .not('last_sync_attempt', 'is', null)
      .order('last_sync_attempt', { ascending: false })
      .limit(limit);
    
    res.json({
      logs: logs || [],
      count: logs?.length || 0
    });
    
  } catch (error) {
    res.status(500).json({
      error: 'Could not fetch logs',
      details: error.message
    });
  }
});

module.exports = router;
🔧 FRONTEND CODE - ActionItemsList.jsx
jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import '../styles/ActionItemsList.css';

export default function ActionItemsList({ meetingId, items }) {
  const [actionItems, setActionItems] = useState(items || []);
  const [loading, setLoading] = useState(false);
  const [syncing, setSyncing] = useState({});
  const [error, setError] = useState(null);
  
  useEffect(() => {
    if (items) {
      setActionItems(items);
    }
  }, [items]);
  
  // Sync single action item
  const syncToCSR = async (itemId) => {
    try {
      setSyncing(prev => ({ ...prev, [itemId]: true }));
      setError(null);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/integrations/crm/sync-action-items`,
        { actionItemIds: [itemId] }
      );
      
      if (response.data.synced === 1) {
        // Update local state
        setActionItems(items =>
          items.map(item =>
            item.id === itemId
              ? { ...item, crm_sync_status: 'synced' }
              : item
          )
        );
      } else if (response.data.failed > 0) {
        const errorMsg = response.data.errors[0]?.error || 'Sync failed';
        setError(`Failed to sync: ${errorMsg}`);
        
        // Mark as failed
        setActionItems(items =>
          items.map(item =>
            item.id === itemId
              ? { ...item, crm_sync_status: 'failed' }
              : item
          )
        );
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setSyncing(prev => ({ ...prev, [itemId]: false }));
    }
  };
  
  // Sync all pending items
  const syncAllToCRM = async () => {
    try {
      setLoading(true);
      setError(null);
      
      const pendingIds = actionItems
        .filter(i => i.crm_sync_status === 'pending')
        .map(i => i.id);
      
      if (pendingIds.length === 0) {
        setError('No pending items to sync');
        return;
      }
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/integrations/crm/sync-action-items`,
        { actionItemIds: pendingIds }
      );
      
      // Reload items
      const { data: updated } = await axios.get(
        `${import.meta.env.VITE_API_URL}/api/meetings/${meetingId}`
      );
      
      setActionItems(updated.actionItems);
      
      // Show summary
      if (response.data.synced > 0) {
        alert(`✅ Synced ${response.data.synced} items to CRM`);
      }
      if (response.data.failed > 0) {
        setError(`Failed to sync ${response.data.failed} items`);
      }
    } catch (err) {
      setError(`Error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };
  
  const getSyncBadge = (status) => {
    switch (status) {
      case 'synced':
        return <span className="sync-badge synced">✅ Synced</span>;
      case 'failed':
        return <span className="sync-badge failed">❌ Failed</span>;
      case 'pending':
        return <span className="sync-badge pending">⏳ Pending</span>;
      default:
        return null;
    }
  };
  
  const getPriorityClass = (priority) => {
    return `priority-${priority?.toLowerCase() || 'medium'}`;
  };
  
  if (!actionItems || actionItems.length === 0) {
    return <div className="empty">No action items for this meeting</div>;
  }
  
  // Group by priority
  const grouped = {
    high: actionItems.filter(i => i.priority === 'high'),
    medium: actionItems.filter(i => i.priority === 'medium'),
    low: actionItems.filter(i => i.priority === 'low')
  };
  
  const hasPending = actionItems.some(i => i.crm_sync_status === 'pending');
  
  return (
    <div className="action-items-container">
      <div className="action-items-header">
        <h2>📋 Action Items ({actionItems.length})</h2>
        
        {hasPending && (
          <button
            onClick={syncAllToCRM}
            disabled={loading}
            className="btn-sync-all"
          >
            {loading ? '⏳ Syncing...' : '🔄 Sync All to CRM'}
          </button>
        )}
      </div>
      
      {error && (
        <div className="error-message">
          ⚠️ {error}
        </div>
      )}
      
      <div className="action-items">
        {Object.entries(grouped).map(([priority, items]) =>
          items.length > 0 && (
            <div key={priority} className="priority-group">
              <h3 className={`priority-title priority-${priority}`}>
                {priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'}{' '}
                {priority.toUpperCase()} ({items.length})
              </h3>
              
              {items.map(item => (
                <div key={item.id} className="action-item">
                  <div className="item-main">
                    <div className="item-content">
                      <p className="item-task">{item.task_description}</p>
                      <div className="item-meta">
                        {item.assigned_to_name && (
                          <span className="meta-assigned">👤 {item.assigned_to_name}</span>
                        )}
                        {item.due_date && (
                          <span className="meta-due">📅 {item.due_date}</span>
                        )}
                      </div>
                    </div>
                    
                    <div className="item-status">
                      {getSyncBadge(item.crm_sync_status)}
                    </div>
                  </div>
                  
                  {item.crm_sync_status === 'pending' && (
                    <button
                      onClick={() => syncToCSR(item.id)}
                      disabled={syncing[item.id]}
                      className="btn-sync-item"
                    >
                      {syncing[item.id] ? '⏳' : '→'} Sync
                    </button>
                  )}
                  
                  {item.crm_sync_status === 'failed' && (
                    <div className="item-error">
                      <small>{item.last_sync_error}</small>
                      <button
                        onClick={() => syncToCSR(item.id)}
                        disabled={syncing[item.id]}
                        className="btn-retry"
                      >
                        🔄 Retry
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        )}
      </div>
      
      <div className="sync-summary">
        <small>
          Synced: {actionItems.filter(i => i.crm_sync_status === 'synced').length} •
          Pending: {actionItems.filter(i => i.crm_sync_status === 'pending').length} •
          Failed: {actionItems.filter(i => i.crm_sync_status === 'failed').length}
        </small>
      </div>
    </div>
  );
}
🔧 FRONTEND CODE - crmService.js
javascript
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class CRMService {
  /**
   * Sync action items to CRM
   */
  static async syncActionItems(actionItemIds) {
    try {
      const response = await axios.post(
        `${API_URL}/api/integrations/crm/sync-action-items`,
        { actionItemIds }
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Test CRM connection
   */
  static async testConnection() {
    try {
      const response = await axios.post(
        `${API_URL}/api/integrations/crm/test`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get CRM status
   */
  static async getStatus() {
    try {
      const response = await axios.get(
        `${API_URL}/api/integrations/crm/status`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get sync logs
   */
  static async getSyncLogs(limit = 50) {
    try {
      const response = await axios.get(
        `${API_URL}/api/integrations/crm/sync-logs?limit=${limit}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default CRMService;
🔧 FRONTEND CODE - ActionItemsList.css
css
.action-items-container {
  background: white;
  border-radius: 8px;
  padding: 20px;
  margin-top: 24px;
}

.action-items-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 20px;
}

.action-items-header h2 {
  margin: 0;
  font-size: 18px;
  color: #333;
}

.btn-sync-all {
  padding: 10px 16px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 500;
  transition: background 0.3s;
}

.btn-sync-all:hover:not(:disabled) {
  background: #0052a3;
}

.btn-sync-all:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error-message {
  background: #fee;
  border: 1px solid #fcc;
  color: #c00;
  padding: 12px;
  border-radius: 6px;
  margin-bottom: 16px;
  font-size: 14px;
}

.action-items {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.priority-group {
  background: #f9f9f9;
  padding: 16px;
  border-radius: 6px;
}

.priority-title {
  margin: 0 0 12px 0;
  font-size: 14px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.priority-title.priority-high {
  color: #cc0000;
}

.priority-title.priority-medium {
  color: #ff8800;
}

.priority-title.priority-low {
  color: #00cc00;
}

.action-item {
  background: white;
  padding: 12px;
  border-radius: 4px;
  border-left: 4px solid #667eea;
  margin-bottom: 8px;
}

.action-item:last-child {
  margin-bottom: 0;
}

.item-main {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 12px;
  margin-bottom: 8px;
}

.item-content {
  flex: 1;
}

.item-task {
  margin: 0 0 6px 0;
  font-size: 14px;
  color: #333;
  font-weight: 500;
}

.item-meta {
  display: flex;
  gap: 12px;
  font-size: 12px;
  color: #666;
  flex-wrap: wrap;
}

.meta-assigned,
.meta-due {
  display: inline-block;
}

.item-status {
  flex-shrink: 0;
}

.sync-badge {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.sync-badge.synced {
  background: #ccffcc;
  color: #00cc00;
}

.sync-badge.pending {
  background: #ffffcc;
  color: #ccaa00;
}

.sync-badge.failed {
  background: #ffcccc;
  color: #cc0000;
}

.btn-sync-item {
  display: inline-block;
  padding: 6px 12px;
  background: #0066cc;
  color: white;
  border: none;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-sync-item:hover:not(:disabled) {
  background: #0052a3;
}

.btn-sync-item:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.item-error {
  padding: 8px;
  background: #fee;
  border-radius: 4px;
  border-left: 3px solid #cc0000;
  font-size: 12px;
}

.item-error small {
  display: block;
  color: #c00;
  margin-bottom: 6px;
}

.btn-retry {
  padding: 4px 8px;
  background: #ff8800;
  color: white;
  border: none;
  border-radius: 3px;
  font-size: 11px;
  cursor: pointer;
  transition: background 0.3s;
}

.btn-retry:hover {
  background: #ff6600;
}

.sync-summary {
  margin-top: 12px;
  padding-top: 12px;
  border-top: 1px solid #ddd;
  text-align: center;
  color: #666;
}

@media (max-width: 768px) {
  .action-items-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 12px;
  }
  
  .item-main {
    flex-direction: column;
  }
}
📋 WEEK 3 TASKS SUMMARY
Total Tasks: 52

Monday: 10 tasks (CRM setup + planning)

Tuesday: 10 tasks (Backend implementation)

Wednesday: 12 tasks (Frontend UI)

Thursday: 12 tasks (Testing)

Friday: 8 tasks (Code review + deployment)

✅ WEEK 3 SIGN-OFF CHECKLIST
Complete ALL items before moving to Week 4:

CRM Integration
 CRM API credentials working

 Can connect to CRM

 Can list contacts/deals

 Can create tasks in CRM

 Can update tasks in CRM

Functionality
 Action items sync to CRM automatically

 Sync status visible in UI (✅ / ⏳ / ❌)

 Manual sync button works

 Bulk sync works (multiple items at once)

 Retry logic works

 No duplicate tasks created

 Sync history viewable

Quality
 Sync accuracy 95%+

 Error messages helpful

 Edge cases handled (invalid email, network error, etc.)

 Code reviewed (2+ reviewers)

 No security issues

 Performance acceptable (sync 100 items < 2 mins)

Testing
 Single item sync test: PASS

 Multiple items sync test: PASS

 Error handling tests: PASS

 Retry logic test: PASS

 Field mapping verification: PASS

 Duplicate prevention: PASS

Database
 crm_sync_status field populated

 crm_task_id stored correctly

 last_sync_attempt timestamp recorded

 last_sync_error captured

Documentation
 API.md updated

 CRM_SETUP.md created

 USER_GUIDE_WEEK3.md created

 Code commented

 Commit message clear

📊 WEEK 3 SUCCESS METRICS
Metric	Target	Actual
Sync success rate	95%+	___
Processing time	< 2 min for 100 items	___
CRM field accuracy	100%	___
Error handling coverage	90%+	___
User feedback	4+/5	___
🚀 READY FOR WEEK 4?
When all checkboxes above are complete:

✅ Commit all Week 3 code

✅ Create branch: feature/week-4-chat-integration

✅ Review Week 4 plan (File 1)

✅ Assign Week 4 tasks

✅ Celebrate: You now have automatic task creation! 🎉

End of WEEK 3 Guide

Ready for WEEK 4: CHAT INTEGRATION (PULSE NOTIFICATIONS)?

Reply: "Send WEEK 4"