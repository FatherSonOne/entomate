📄 WEEK 5: PROJECT MANAGEMENT DASHBOARD
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 54 items
Prerequisite: Week 4 complete with chat integration working

🎯 WEEK 5 OVERVIEW
Goal: Create a visual dashboard showing all projects, their progress, action items status, and team collaboration metrics

By Friday EOD, you should have:

✅ Project list with filtering and search

✅ Project detail view with timeline

✅ Action items grouped by project/owner/status

✅ Progress tracking (% complete)

✅ Team members and their assignments

✅ Upcoming deadlines view

✅ Charts/graphs for insights (completion rate, sentiment trends)

✅ Kanban board (drag-and-drop action items)

✅ Real-time updates when items change

✅ Export/reporting functionality

Time Commitment: 40 hours total (2 backend + 3 frontend + 1 data specialist)

Success Metric: Dashboard displays all data accurately and updates in real-time

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: Dashboard Planning & Architecture (8 hours)
Morning (9am-12pm): Dashboard Design & Data Model
PM / Product Lead + Full Team:

 Define Dashboard Views (20 mins)

View 1: Projects Overview (list with stats)

View 2: Project Detail (timeline, action items, team)

View 3: Action Items Board (Kanban)

View 4: Team Workload (who has what)

View 5: Insights (charts, trends, metrics)

Decision: Which views are MVP? (recommend: 1, 2, 3)

 Design Data Aggregation Needs (25 mins)

What data to show per project:

Total action items

Completed action items

Overdue items

Team members assigned

Next deadline

Last update

Sentiment trend

What data to show per team member:

Assigned items count

Completion rate

Overdue items

Workload (number of items)

 Design UI Mockups (text-based) (20 mins)

text
PROJECTS OVERVIEW
┌──────────────────────────────────────────┐
│ 📊 Projects Dashboard                    │
├──────────────────────────────────────────┤
│ [Search] [Filter by status] [Sort]       │
│                                          │
│ Project Name    Progress  Items  Team    │
│ Q1 Planning     45%       12     5       │
│ Product Launch  78%       8      3       │
│ Bug Fixes       100%      5      2       │
└──────────────────────────────────────────┘

ACTION ITEMS KANBAN
┌───────────┬───────────┬───────────┐
│ Pending   │ In Progress│ Complete │
├───────────┼───────────┼───────────┤
│ [Item 1]  │ [Item 3]   │ [Item 5] │
│ [Item 2]  │ [Item 4]   │ [Item 6] │
│           │           │          │
└───────────┴───────────┴───────────┘
 Create Data Flow Diagram (20 mins)

text
Meetings
   ↓
Action Items
   ↓
Project aggregation query
   ↓
Dashboard cache (Redis)
   ↓
WebSocket push to frontend
   ↓
Frontend updates charts
 Plan Real-Time Updates (10 mins)

When action item changes:

Emit event via WebSocket

Update project stats

Update team workload

Push to all connected dashboards

Afternoon (1pm-5pm): Backend Architecture
Backend Lead:

 Design Dashboard Queries (25 mins)

Query 1: Get all projects with stats

Query 2: Get project detail with timeline

Query 3: Get action items by status

Query 4: Get team workload

Query 5: Get overdue items

Optimize for performance (use views/materialized queries)

 Plan Caching Strategy (20 mins)

Cache project stats (update every 5 mins)

Cache team workload (update every 5 mins)

Cache trends/charts (update hourly)

Invalidate cache on action item changes

 Create Database Views (20 mins)

Create view: project_statistics

sql
SELECT 
  meetings.id,
  COUNT(*) as total_items,
  COUNT(CASE WHEN status='open') as open_items,
  COUNT(CASE WHEN status='complete') as complete_items,
  AVG(priority) as avg_priority
FROM meetings
LEFT JOIN action_items ON meetings.id = action_items.meeting_id
GROUP BY meetings.id
 Plan WebSocket Implementation (20 mins)

Use Socket.io for real-time updates

Emit on action item status change

Emit on new action item

Emit on action item completion

Broadcast to all connected clients

 Create API Endpoints Plan (15 mins)

GET /api/dashboard/projects

GET /api/dashboard/projects/:id

GET /api/dashboard/action-items

GET /api/dashboard/team-workload

GET /api/dashboard/insights

GET /api/dashboard/overdue

WS /socket.io (WebSocket)

 Design Frontend State (15 mins)

React Context for dashboard data

Real-time updates via WebSocket

Local state for filters/sorting

Optimistic updates (update UI before server confirms)

🟢 TUESDAY: Backend Dashboard APIs (8 hours)
Morning (9am-12pm): Database Views & Queries
Backend Developer / Data Specialist:

 Create Database Views in Supabase (40 mins)

Create: project_statistics view

Create: team_workload view

Create: overdue_items view

Create: action_item_trends view

Copy SQL from "SECTION: DATABASE - Views" below

Execute in Supabase SQL editor

 Test Views (15 mins)

Query each view

Verify data accuracy

Check performance (< 100ms)

Test with filters

 Create Materialized Query Helper (20 mins)

Create: backend/utils/dashboardQueries.js

Functions to:

getProjectStats()

getTeamWorkload()

getOverdueItems()

getActionItemTrends()

Afternoon (1pm-5pm): Dashboard API Endpoints
Backend Developer:

 Create Dashboard Routes (30 mins)

Create: backend/routes/dashboard.js

Copy code from "SECTION: BACKEND CODE - dashboard.js" below

Paste into file

 Register Routes (10 mins)

Open: backend/server.js

Add:

javascript
app.use('/api/dashboard', require('./routes/dashboard'));
 Implement WebSocket (30 mins)

Install: npm install socket.io

Setup Socket.io in server.js:

javascript
const io = require('socket.io')(server, {
  cors: { origin: process.env.FRONTEND_URL }
});

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Subscribe to dashboard updates
  socket.on('subscribe-dashboard', (projectId) => {
    socket.join(`dashboard-${projectId}`);
  });
  
  socket.on('disconnect', () => {
    console.log('User disconnected');
  });
});
 Emit Events on Changes (20 mins)

In meetings route, when action item updated:

javascript
io.to(`dashboard-${meetingId}`).emit('action-item-updated', {
  actionItemId: item.id,
  status: item.status,
  timestamp: new Date()
});
 Test Endpoints (15 mins)

bash
# Get projects with stats
curl http://localhost:3000/api/dashboard/projects

# Get specific project
curl http://localhost:3000/api/dashboard/projects/[project-id]

# Get action items
curl http://localhost:3000/api/dashboard/action-items

# Get team workload
curl http://localhost:3000/api/dashboard/team-workload
 Add Caching (15 mins)

Install: npm install redis

Cache project stats (5 min TTL)

Invalidate on action item update

Monitor cache hits

🟡 WEDNESDAY: Frontend Dashboard UI (8 hours)
Morning (9am-12pm): Dashboard Components
Frontend Developer:

 Create Dashboard Layout Component (25 mins)

Create: frontend/src/components/Dashboard.jsx

Shows header with filters

Shows tabs for different views

Copy code from "SECTION: FRONTEND CODE - Dashboard.jsx" below

 Create Projects List Component (25 mins)

Create: frontend/src/components/ProjectsList.jsx

Shows table with projects

Sortable columns

Clickable rows (navigate to detail)

Search/filter functionality

 Create Project Detail Component (20 mins)

Create: frontend/src/components/ProjectDetail.jsx

Shows project name, description

Shows action items list

Shows team members

Shows timeline

 Test Components Render (10 mins)

Components load without errors

Can switch between tabs

Can click projects

Afternoon (1pm-5pm): Kanban & Charts
Frontend Developer:

 Create Kanban Board Component (30 mins)

Create: frontend/src/components/KanbanBoard.jsx

Columns: Pending, In Progress, Complete

Drag-and-drop action items

Update status on drop

Show item count per column

Copy code from "SECTION: FRONTEND CODE - KanbanBoard.jsx" below

 Create Charts Component (20 mins)

Create: frontend/src/components/DashboardCharts.jsx

Chart 1: Project completion % (pie chart)

Chart 2: Team workload (bar chart)

Chart 3: Action item trends (line chart)

Use Recharts library (install: npm install recharts)

 Create Team Workload Component (15 mins)

Create: frontend/src/components/TeamWorkload.jsx

Shows team members

Shows items assigned to each

Shows completion rate

Shows overdue count

 Create Real-Time WebSocket Hook (15 mins)

Create: frontend/src/hooks/useDashboardSocket.js

Connects to WebSocket

Listens for updates

Updates component state

Handles disconnection

 Create Dashboard Service (15 mins)

Create: frontend/src/services/dashboardService.js

Fetch projects

Fetch action items

Fetch team workload

Fetch charts data

 Create Styles (15 mins)

Create: frontend/src/styles/Dashboard.css

Style dashboard layout

Style cards/tables

Style Kanban columns

Responsive design

🔵 THURSDAY: Real-Time Integration & Testing (8 hours)
Morning (9am-12pm): WebSocket & Real-Time
Frontend Developer + Backend:

 Integrate WebSocket in Dashboard (30 mins)

Use useDashboardSocket hook

Subscribe to project updates

Listen for action-item-updated events

Update component state in real-time

 Test Real-Time Updates (20 mins)

Open 2 browser windows

Change action item status in one

Verify updates in other window immediately

Test with multiple users

 Add Optimistic Updates (20 mins)

Update UI immediately when user changes item

Confirm with server

Revert if error

Show loading indicator

 Test Drag-and-Drop (15 mins)

Drag item between columns

Verify status updates

Verify reflects in real-time

Test error handling (network fail)

 Add Filtering & Sorting (15 mins)

Filter by status (pending, complete)

Filter by priority (high, medium, low)

Filter by team member

Sort by due date, priority, etc.

Afternoon (1pm-5pm): Testing & Polish
QA & Frontend Developer:

 End-to-End Test #1: View Projects (20 mins)

Load dashboard

See list of projects

See correct stats

Click project → see detail

Verify all data displayed

 End-to-End Test #2: Kanban Board (20 mins)

Open Kanban view

See action items in columns

Drag item to different column

Verify status updates

Check in database

 End-to-End Test #3: Charts (15 mins)

View charts on dashboard

Verify data accuracy

Check responsive (mobile, tablet, desktop)

Charts update when data changes

 Real-Time Test (20 mins)

Open dashboard in 2 tabs

Change action item in one tab

Verify updates in other tab (< 1 sec)

Test with multiple tabs

 Performance Test (15 mins)

Load dashboard with 100 projects

Measure load time (target: < 2 sec)

Measure chart render time

Check for memory leaks

 Edge Cases (15 mins)

Test with no projects

Test with no action items

Test with team member with no items

Test with very long project names

 Create Test Report (10 mins)

Document all tests

Note performance metrics

Note any issues

🟢 FRIDAY: Code Review & Deployment (8 hours)
Morning (9am-12pm): Code Quality & Optimization
Tech Lead & Developers:

 Code Review: Backend (25 mins)

Review: backend/routes/dashboard.js

Review: backend/utils/dashboardQueries.js

Checklist:

 Queries optimized (indexes used)

 Caching implemented

 Error handling

 Comments clear

 No N+1 queries

 Code Review: Frontend (25 mins)

Review: frontend/src/components/Dashboard.jsx

Review: frontend/src/components/KanbanBoard.jsx

Review: frontend/src/hooks/useDashboardSocket.js

Checklist:

 No unnecessary re-renders

 WebSocket cleanup

 Error handling

 Accessible

 Mobile responsive

 Performance Optimization (25 mins)

Add React.memo() to components

Optimize chart rendering

Lazy load images/data

Check bundle size

Use production build

 Run Linter & Formatter (15 mins)

bash
npx eslint backend/routes/dashboard.js
npx prettier --write backend/routes/dashboard.js
npx eslint frontend/src/components/Dashboard.jsx
npx prettier --write frontend/src/components/Dashboard.jsx
Afternoon (1pm-5pm): Documentation & Demo
PM & Tech Lead:

 Update API Documentation (20 mins)

Open: docs/API.md

Document endpoints:

text
## GET /api/dashboard/projects

Get all projects with statistics

Query params:
- status: open|closed|all (default: all)
- sort: name|progress|updated (default: updated)

Response:
{
"projects": [
{
"id": "uuid",
"title": "Q1 Planning",
"progress": 45,
"total_items": 12,
"completed_items": 5,
"team_size": 5,
"next_deadline": "2025-12-20"
}
]
}

text

## GET /api/dashboard/projects/:id

Get project details

Response:
{
"id": "uuid",
"title": "...",
"description": "...",
"progress": 45,
"actionItems": [...],
"team": [...],
"timeline": [...]
}

text

## WS /socket.io

WebSocket events:
- subscribe-dashboard
- action-item-updated
- action-item-created
- action-item-completed
 Create Dashboard User Guide (20 mins)

Create: docs/USER_GUIDE_WEEK5.md

Include:

How to view projects

How to use Kanban board

How to filter/sort

How to interpret charts

Keyboard shortcuts

 Create Admin Guide (15 mins)

Document database views

Document caching strategy

Document WebSocket events

Troubleshooting

 Commit & Push (10 mins)

bash
git add backend/routes/dashboard.js
git add backend/utils/dashboardQueries.js
git add backend/socket.io setup
git add frontend/src/components/Dashboard.jsx
git add frontend/src/components/KanbanBoard.jsx
git add frontend/src/hooks/useDashboardSocket.js
git add frontend/src/services/dashboardService.js
git add docs/
git commit -m "Week 5: Project management dashboard complete"
git push origin develop
 Weekly Demo (45 mins)

Demo 1: Show projects list with stats

Demo 2: Click project → show detail view

Demo 3: Show Kanban board

Demo 4: Drag item between columns

Demo 5: Show real-time update (2 tabs)

Demo 6: Show charts with data

Demo 7: Show team workload view

Q&A

 Retrospective (15 mins)

What went well?

Challenges faced?

Improvements for next week?

Team feedback?

🔧 DATABASE - Views
sql
-- View 1: Project Statistics
CREATE VIEW project_statistics AS
SELECT 
  m.id,
  m.title,
  m.created_at,
  m.updated_at,
  COUNT(ai.id) as total_items,
  COUNT(CASE WHEN ai.status = 'open' THEN 1 END) as open_items,
  COUNT(CASE WHEN ai.status = 'complete' THEN 1 END) as complete_items,
  ROUND(
    COUNT(CASE WHEN ai.status = 'complete' THEN 1 END)::numeric / 
    NULLIF(COUNT(ai.id), 0) * 100
  , 2) as progress_percent,
  COUNT(CASE WHEN ai.due_date < NOW() AND ai.status != 'complete' THEN 1 END) as overdue_items,
  COUNT(DISTINCT ai.assigned_to_name) as team_size,
  MIN(CASE WHEN ai.status != 'complete' THEN ai.due_date END) as next_deadline,
  AVG(
    CASE 
      WHEN ai.priority = 'high' THEN 3
      WHEN ai.priority = 'medium' THEN 2
      ELSE 1
    END
  ) as avg_priority_score,
  m.sentiment_label
FROM meetings m
LEFT JOIN action_items ai ON m.id = ai.meeting_id
GROUP BY m.id, m.title, m.created_at, m.updated_at, m.sentiment_label;

-- View 2: Team Workload
CREATE VIEW team_workload AS
SELECT 
  ai.assigned_to_name as team_member,
  ai.assigned_to_email,
  COUNT(ai.id) as total_assigned,
  COUNT(CASE WHEN ai.status = 'open' THEN 1 END) as open_items,
  COUNT(CASE WHEN ai.status = 'in_progress' THEN 1 END) as in_progress,
  COUNT(CASE WHEN ai.status = 'complete' THEN 1 END) as completed,
  ROUND(
    COUNT(CASE WHEN ai.status = 'complete' THEN 1 END)::numeric / 
    NULLIF(COUNT(ai.id), 0) * 100
  , 2) as completion_rate,
  COUNT(CASE WHEN ai.due_date < NOW() AND ai.status != 'complete' THEN 1 END) as overdue_count,
  MIN(CASE WHEN ai.status != 'complete' THEN ai.due_date END) as next_deadline
FROM action_items ai
WHERE ai.assigned_to_name IS NOT NULL
GROUP BY ai.assigned_to_name, ai.assigned_to_email;

-- View 3: Overdue Items
CREATE VIEW overdue_items AS
SELECT 
  ai.id,
  ai.task_description,
  ai.assigned_to_name,
  ai.assigned_to_email,
  ai.due_date,
  ai.priority,
  m.title as meeting_title,
  m.id as meeting_id,
  DATE_PART('day', NOW() - ai.due_date) as days_overdue
FROM action_items ai
JOIN meetings m ON ai.meeting_id = m.id
WHERE ai.due_date < NOW() 
  AND ai.status != 'complete'
ORDER BY ai.due_date ASC;

-- View 4: Action Item Trends (for charts)
CREATE VIEW action_item_trends AS
SELECT 
  DATE_TRUNC('day', m.created_at)::DATE as date,
  m.sentiment_label,
  COUNT(ai.id) as total_items,
  COUNT(CASE WHEN ai.status = 'complete' THEN 1 END) as completed_items,
  COUNT(CASE WHEN ai.priority = 'high' THEN 1 END) as high_priority_items,
  ROUND(
    COUNT(CASE WHEN ai.status = 'complete' THEN 1 END)::numeric / 
    NULLIF(COUNT(ai.id), 0) * 100
  , 2) as completion_rate
FROM meetings m
LEFT JOIN action_items ai ON m.id = ai.meeting_id
GROUP BY DATE_TRUNC('day', m.created_at), m.sentiment_label
ORDER BY date DESC;
🔧 BACKEND CODE - dashboard.js
javascript
const express = require('express');
const supabase = require('../config/supabase');
const { 
  getProjectStats,
  getTeamWorkload,
  getOverdueItems,
  getActionItemTrends
} = require('../utils/dashboardQueries');
const router = express.Router();

/**
 * GET /api/dashboard/projects
 * Get all projects with statistics
 */
router.get('/projects', async (req, res) => {
  try {
    const { status = 'all', sort = 'updated', limit = 50 } = req.query;
    
    console.log('📊 Fetching dashboard projects...');
    
    // Query view
    let query = supabase
      .from('project_statistics')
      .select('*');
    
    // Apply status filter
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    
    // Apply sorting
    const sortMap = {
      'name': 'title',
      'progress': 'progress_percent',
      'updated': 'updated_at'
    };
    const sortColumn = sortMap[sort] || 'updated_at';
    query = query.order(sortColumn, { ascending: sort === 'name' });
    
    // Limit results
    query = query.limit(limit);
    
    const { data: projects, error } = await query;
    
    if (error) throw error;
    
    console.log(`✅ Found ${projects.length} projects`);
    
    res.json({
      projects: projects || [],
      count: projects?.length || 0,
      total: projects?.length || 0
    });
    
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({
      error: 'Failed to fetch projects',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/projects/:id
 * Get project details
 */
router.get('/projects/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get project stats
    const { data: project, error: projectError } = await supabase
      .from('project_statistics')
      .select('*')
      .eq('id', id)
      .single();
    
    if (projectError) throw projectError;
    
    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }
    
    // Get action items for this project
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id)
      .order('due_date', { ascending: true });
    
    // Get team members
    const { data: teamMembers } = await supabase
      .from('action_items')
      .select('assigned_to_name, assigned_to_email')
      .eq('meeting_id', id)
      .not('assigned_to_name', 'is', null);
    
    const uniqueTeam = Array.from(
      new Map(
        (teamMembers || []).map(t => [t.assigned_to_email, t])
      ).values()
    );
    
    res.json({
      ...project,
      actionItems: actionItems || [],
      team: uniqueTeam || [],
      timeline: actionItems || []
    });
    
  } catch (error) {
    console.error('Error fetching project detail:', error);
    res.status(500).json({
      error: 'Failed to fetch project',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/action-items
 * Get action items with filtering and grouping
 */
router.get('/action-items', async (req, res) => {
  try {
    const { 
      status = 'all', 
      priority = 'all',
      assignee = 'all',
      sort = 'due_date',
      limit = 100
    } = req.query;
    
    console.log('📋 Fetching action items...');
    
    let query = supabase
      .from('action_items')
      .select('*');
    
    // Apply filters
    if (status !== 'all') {
      query = query.eq('status', status);
    }
    if (priority !== 'all') {
      query = query.eq('priority', priority);
    }
    if (assignee !== 'all') {
      query = query.eq('assigned_to_name', assignee);
    }
    
    // Sort
    query = query.order(sort, { ascending: sort !== 'priority' });
    query = query.limit(limit);
    
    const { data: items, error } = await query;
    
    if (error) throw error;
    
    // Group by status for Kanban
    const grouped = {
      pending: items?.filter(i => i.status === 'pending') || [],
      in_progress: items?.filter(i => i.status === 'in_progress') || [],
      complete: items?.filter(i => i.status === 'complete') || []
    };
    
    res.json({
      actionItems: items || [],
      grouped,
      count: items?.length || 0
    });
    
  } catch (error) {
    console.error('Error fetching action items:', error);
    res.status(500).json({
      error: 'Failed to fetch action items',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/team-workload
 * Get team member workload
 */
router.get('/team-workload', async (req, res) => {
  try {
    console.log('👥 Fetching team workload...');
    
    const { data: workload, error } = await supabase
      .from('team_workload')
      .select('*')
      .order('total_assigned', { ascending: false });
    
    if (error) throw error;
    
    res.json({
      workload: workload || [],
      count: workload?.length || 0
    });
    
  } catch (error) {
    console.error('Error fetching team workload:', error);
    res.status(500).json({
      error: 'Failed to fetch team workload',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/overdue
 * Get overdue action items
 */
router.get('/overdue', async (req, res) => {
  try {
    console.log('⚠️ Fetching overdue items...');
    
    const { data: overdue, error } = await supabase
      .from('overdue_items')
      .select('*')
      .limit(50);
    
    if (error) throw error;
    
    res.json({
      overdue: overdue || [],
      count: overdue?.length || 0,
      alert: overdue?.length > 0
    });
    
  } catch (error) {
    console.error('Error fetching overdue items:', error);
    res.status(500).json({
      error: 'Failed to fetch overdue items',
      details: error.message
    });
  }
});

/**
 * GET /api/dashboard/insights
 * Get dashboard insights and trends
 */
router.get('/insights', async (req, res) => {
  try {
    console.log('📈 Generating insights...');
    
    // Get trends
    const { data: trends } = await supabase
      .from('action_item_trends')
      .select('*')
      .order('date', { ascending: false })
      .limit(30);
    
    // Get overall stats
    const { data: stats } = await supabase
      .from('project_statistics')
      .select('*');
    
    // Calculate metrics
    const totalProjects = stats?.length || 0;
    const avgProgress = stats?.length > 0
      ? Math.round(stats.reduce((sum, p) => sum + p.progress_percent, 0) / stats.length)
      : 0;
    const totalItems = stats?.reduce((sum, p) => sum + p.total_items, 0) || 0;
    const completedItems = stats?.reduce((sum, p) => sum + p.complete_items, 0) || 0;
    const overallCompletion = totalItems > 0
      ? Math.round((completedItems / totalItems) * 100)
      : 0;
    
    res.json({
      metrics: {
        totalProjects,
        avgProgress,
        totalItems,
        completedItems,
        overallCompletion,
        positiveProjects: stats?.filter(p => p.sentiment_label === 'Positive').length || 0
      },
      trends: trends || []
    });
    
  } catch (error) {
    console.error('Error generating insights:', error);
    res.status(500).json({
      error: 'Failed to generate insights',
      details: error.message
    });
  }
});

module.exports = router;
🔧 FRONTEND CODE - Dashboard.jsx
jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import ProjectsList from './ProjectsList';
import KanbanBoard from './KanbanBoard';
import DashboardCharts from './DashboardCharts';
import TeamWorkload from './TeamWorkload';
import useDashboardSocket from '../hooks/useDashboardSocket';
import '../styles/Dashboard.css';

export default function Dashboard() {
  const [activeTab, setActiveTab] = useState('projects');
  const [projects, setProjects] = useState([]);
  const [actionItems, setActionItems] = useState([]);
  const [teamWorkload, setTeamWorkload] = useState([]);
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('updated');
  
  // Real-time updates
  const { subscribe, unsubscribe } = useDashboardSocket();
  
  useEffect(() => {
    loadDashboardData();
    
    // Subscribe to real-time updates
    subscribe('dashboard-main', handleUpdate);
    
    return () => unsubscribe('dashboard-main');
  }, []);
  
  const loadDashboardData = async () => {
    try {
      setLoading(true);
      setError(null);
      
      // Load all data in parallel
      const [projectsRes, itemsRes, workloadRes, insightsRes] = await Promise.all([
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/projects?status=${filterStatus}&sort=${sortBy}`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/action-items`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/team-workload`),
        axios.get(`${import.meta.env.VITE_API_URL}/api/dashboard/insights`)
      ]);
      
      setProjects(projectsRes.data.projects);
      setActionItems(itemsRes.data.actionItems);
      setTeamWorkload(workloadRes.data.workload);
      setInsights(insightsRes.data);
      
    } catch (err) {
      setError(`Failed to load dashboard: ${err.message}`);
      console.error('Dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };
  
  const handleUpdate = (data) => {
    console.log('📡 Real-time update:', data);
    // Refresh relevant data
    if (data.type === 'action-item-updated') {
      loadDashboardData();
    }
  };
  
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  
  const handleFilterChange = (status) => {
    setFilterStatus(status);
  };
  
  const handleSortChange = (sort) => {
    setSortBy(sort);
  };
  
  if (loading && !projects.length) {
    return <div className="dashboard-loading">Loading dashboard...</div>;
  }
  
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>📊 Project Dashboard</h1>
        
        <div className="dashboard-controls">
          <select
            value={filterStatus}
            onChange={(e) => handleFilterChange(e.target.value)}
            className="control-select"
          >
            <option value="all">All Status</option>
            <option value="open">Open</option>
            <option value="closed">Closed</option>
          </select>
          
          <select
            value={sortBy}
            onChange={(e) => handleSortChange(e.target.value)}
            className="control-select"
          >
            <option value="updated">Recently Updated</option>
            <option value="progress">By Progress</option>
            <option value="name">By Name</option>
          </select>
          
          <button
            onClick={loadDashboardData}
            className="btn-refresh"
            disabled={loading}
          >
            {loading ? '⏳' : '🔄'} Refresh
          </button>
        </div>
      </header>
      
      {error && <div className="error-message">{error}</div>}
      
      <div className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'projects' ? 'active' : ''}`}
          onClick={() => handleTabChange('projects')}
        >
          📋 Projects ({projects.length})
        </button>
        <button
          className={`tab ${activeTab === 'kanban' ? 'active' : ''}`}
          onClick={() => handleTabChange('kanban')}
        >
          📌 Kanban ({actionItems.length})
        </button>
        <button
          className={`tab ${activeTab === 'workload' ? 'active' : ''}`}
          onClick={() => handleTabChange('workload')}
        >
          👥 Team ({teamWorkload.length})
        </button>
        <button
          className={`tab ${activeTab === 'insights' ? 'active' : ''}`}
          onClick={() => handleTabChange('insights')}
        >
          📈 Insights
        </button>
      </div>
      
      <div className="dashboard-content">
        {activeTab === 'projects' && (
          <ProjectsList projects={projects} loading={loading} />
        )}
        
        {activeTab === 'kanban' && (
          <KanbanBoard items={actionItems} onUpdate={loadDashboardData} />
        )}
        
        {activeTab === 'workload' && (
          <TeamWorkload workload={teamWorkload} />
        )}
        
        {activeTab === 'insights' && (
          <DashboardCharts data={insights} />
        )}
      </div>
    </div>
  );
}
🔧 FRONTEND CODE - KanbanBoard.jsx
jsx
import React, { useState } from 'react';
import axios from 'axios';
import '../styles/Dashboard.css';

export default function KanbanBoard({ items, onUpdate }) {
  const [draggingItem, setDraggingItem] = useState(null);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState(null);
  
  const columns = {
    pending: { label: '📋 Pending', color: '#ff9800' },
    in_progress: { label: '⚙️ In Progress', color: '#2196f3' },
    complete: { label: '✅ Complete', color: '#4caf50' }
  };
  
  const itemsByStatus = {
    pending: items?.filter(i => i.status === 'pending') || [],
    in_progress: items?.filter(i => i.status === 'in_progress') || [],
    complete: items?.filter(i => i.status === 'complete') || []
  };
  
  const handleDragStart = (e, item) => {
    setDraggingItem(item);
    e.dataTransfer.effectAllowed = 'move';
  };
  
  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };
  
  const handleDrop = async (e, newStatus) => {
    e.preventDefault();
    
    if (!draggingItem) return;
    
    try {
      setUpdating(true);
      setError(null);
      
      // Update in database
      await axios.patch(
        `${import.meta.env.VITE_API_URL}/api/action-items/${draggingItem.id}`,
        { status: newStatus }
      );
      
      // Refresh dashboard
      onUpdate();
      setDraggingItem(null);
      
    } catch (err) {
      setError(`Failed to update status: ${err.message}`);
      console.error('Drag-drop error:', err);
    } finally {
      setUpdating(false);
    }
  };
  
  const getPriorityColor = (priority) => {
    const colors = {
      high: '#f44336',
      medium: '#ff9800',
      low: '#4caf50'
    };
    return colors[priority] || '#999';
  };
  
  return (
    <div className="kanban-container">
      {error && <div className="error-message">{error}</div>}
      
      <div className="kanban-board">
        {Object.entries(columns).map(([status, config]) => (
          <div
            key={status}
            className="kanban-column"
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, status)}
          >
            <div className="column-header" style={{ borderTopColor: config.color }}>
              <h3>{config.label}</h3>
              <span className="item-count">{itemsByStatus[status].length}</span>
            </div>
            
            <div className="column-items">
              {itemsByStatus[status].length === 0 ? (
                <div className="empty-column">No items</div>
              ) : (
                itemsByStatus[status].map(item => (
                  <div
                    key={item.id}
                    className="kanban-item"
                    draggable
                    onDragStart={(e) => handleDragStart(e, item)}
                  >
                    <div className="item-header">
                      <span
                        className="priority-indicator"
                        style={{ backgroundColor: getPriorityColor(item.priority) }}
                        title={item.priority}
                      />
                      <span className="item-title">{item.task_description}</span>
                    </div>
                    
                    <div className="item-meta">
                      {item.assigned_to_name && (
                        <span className="meta-tag">👤 {item.assigned_to_name}</span>
                      )}
                      {item.due_date && (
                        <span className="meta-tag">📅 {item.due_date}</span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        ))}
      </div>
      
      {updating && <div className="updating-indicator">Updating...</div>}
    </div>
  );
}
📋 WEEK 5 TASKS SUMMARY
Total Tasks: 54

Monday: 12 tasks (Planning & architecture)

Tuesday: 10 tasks (Backend APIs)

Wednesday: 12 tasks (Frontend UI)

Thursday: 12 tasks (Testing & integration)

Friday: 8 tasks (Code review & deployment)

✅ WEEK 5 SIGN-OFF CHECKLIST
Complete ALL before Week 6:

Dashboard Functionality
 Projects list displays correctly

 Project detail shows all data

 Kanban board drag-and-drop works

 Charts display and update

 Team workload shows all members

 Real-time updates work (< 1 sec)

Data Accuracy
 Project stats calculated correctly

 Progress percentage accurate

 Overdue items identified correctly

 Team workload counts accurate

 Charts data matches source

Quality
 Code reviewed (2+ reviewers)

 Performance optimized

 No console errors

 Mobile responsive

 Accessible (keyboard nav)

Testing
 Projects view test: PASS

 Project detail test: PASS

 Kanban board test: PASS

 Real-time test: PASS

 Charts test: PASS

 Performance test: PASS

Database
 Views created successfully

 Queries optimized

 Indexes present

 No N+1 queries

Documentation
 API.md updated

 USER_GUIDE_WEEK5.md created

 Admin guide created

 Code commented

📊 WEEK 5 SUCCESS METRICS
Metric	Target	Actual
Dashboard load time	< 2 sec	___
Real-time update latency	< 1 sec	___
Data accuracy	100%	___
Component re-render optimization	> 50% reduction	___
Mobile responsive	100%	___
🚀 READY FOR WEEK 6?
When all checkboxes complete:

✅ Commit all Week 5 code

✅ Create branch: feature/week-6-ai-search

✅ Review Week 6 plan

✅ Assign tasks

End of WEEK 5 Guide

You now have:

✅ Week 1: Foundation & Setup

✅ Week 2: Meeting Recording & Transcription

✅ Week 3: CRM Sync

✅ Week 4: Chat Integration

✅ Week 5: Project Dashboard

Ready for WEEK 6: AI SEARCH & SEMANTIC ASSISTANT?

Reply: "Send WEEK 6" (or take another break and build!)