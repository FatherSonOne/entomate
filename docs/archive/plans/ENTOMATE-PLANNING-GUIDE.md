# Entomate Planning & Development Guide

**Last Updated:** December 2024  
**Purpose:** Comprehensive overview and planning document for Entomate development

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Application Overview](#application-overview)
3. [Architecture & Tech Stack](#architecture--tech-stack)
4. [Integration with Logos Vision & Pulse](#integration-with-logos-vision--pulse)
5. [Core Features & Capabilities](#core-features--capabilities)
6. [Project Structure](#project-structure)
7. [How to Run Entomate](#how-to-run-entomate)
8. [Development Workflow](#development-workflow)
9. [Key Components & Services](#key-components--services)
10. [API Endpoints Overview](#api-endpoints-overview)
11. [Database Schema](#database-schema)
12. [Future Development Priorities](#future-development-priorities)
13. [Quick Reference](#quick-reference)

---

## Executive Summary

**Entomate** is an AI-powered meeting intelligence and automation platform that serves as the **automation/assistance layer** connecting:

- **Logos Vision CRM** (`F:\logos-vision-crm`) - Customer relationship management
- **Pulse** (`F:\pulse1`) - Team communication platform

### The Three-App Ecosystem

```
┌─────────────────┐
│  Logos Vision   │  ← CRM: Deals, Contacts, Tasks
│      (CRM)      │
└────────┬────────┘
         │
         │ Syncs action items
         │ Creates tasks
         │ Updates deals
         │
┌────────▼────────────────────────┐
│         ENTOMATE                │  ← AI Brain: Meeting Intelligence
│  (Automation & Assistance)     │     Workflows, Agents, Analytics
└────────┬────────────────────────┘
         │
         │ Posts recaps
         │ Sends notifications
         │ Shares insights
         │
┌────────▼────────┐
│     Pulse      │  ← Communication: Team Chat, Channels
│  (Communication)│
└────────────────┘
```

**Entomate's Role:** The intelligent automation layer that:
- Processes meetings with AI (Gemini)
- Extracts actionable insights
- Syncs data bidirectionally with Logos Vision CRM
- Notifies teams via Pulse chat
- Automates workflows and task assignments
- Provides analytics and intelligence dashboards

---

## Application Overview

### What Entomate Does

1. **Meeting Intelligence**
   - Records and transcribes meetings (audio → text)
   - AI-powered summarization and analysis
   - Extracts action items, decisions, key points
   - Sentiment analysis
   - Searchable meeting library

2. **Task & Project Management**
   - Kanban boards for projects
   - Task assignment and tracking
   - Project creation from CRM deals
   - Progress tracking

3. **Automation & Workflows**
   - Rule-based automations (if/then logic)
   - Visual workflow builder (node-based editor)
   - AI agents (auto-assignment, priority, deadlines, follow-ups)
   - Scheduled tasks and triggers

4. **CRM Integration**
   - Syncs action items → Logos Vision tasks
   - Creates projects from CRM deals
   - Updates deal stages based on meeting outcomes
   - Bidirectional sync

5. **Communication Integration**
   - Posts meeting recaps to Pulse channels
   - Sends notifications about action items
   - Cross-references chat history in meeting analysis

6. **Intelligence & Analytics**
   - Daily briefing dashboard
   - Cross-app search (meetings, tasks, projects)
   - Team performance metrics
   - AI-powered insights

---

## Architecture & Tech Stack

### Backend (`backend/`)
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini API (primary), OpenAI (fallback)
- **Authentication:** Clerk (optional auth middleware)
- **Logging:** Winston
- **Error Tracking:** Sentry
- **Port:** 3000 (default)

### Frontend (`frontend/`)
- **Framework:** React 18
- **Build Tool:** Vite 6
- **Routing:** React Router v6
- **Styling:** Tailwind CSS
- **Icons:** Lucide React
- **Auth:** Clerk React
- **State Management:** React hooks (useState, useEffect)
- **Port:** 5173 (default)

### Database
- **Provider:** Supabase (PostgreSQL)
- **Features Used:**
  - Row Level Security (RLS)
  - Real-time subscriptions
  - Vector storage (for semantic search)
  - Migrations

### Key Dependencies

**Backend:**
- `express` - Web framework
- `@supabase/supabase-js` - Database client
- `@google/generative-ai` - Gemini AI
- `openai` - OpenAI API (fallback)
- `@clerk/clerk-sdk-node` - Authentication
- `winston` - Logging
- `@sentry/node` - Error tracking
- `node-cron` - Scheduled tasks
- `axios` - HTTP client

**Frontend:**
- `react` + `react-dom`
- `react-router-dom`
- `@clerk/clerk-react`
- `axios`
- `@xyflow/react` - Workflow canvas
- `recharts` - Charts
- `lucide-react` - Icons

---

## Integration with Logos Vision & Pulse

### Logos Vision CRM Integration

**Purpose:** Sync meeting insights to CRM tasks, deals, and activities

**Key Files:**
- `src/lib/logosVisionClient.ts` - CRM API client
- `src/services/crmSyncService.ts` - Sync service
- `backend/services/crmService.js` - Backend CRM service

**Integration Points:**
1. **Action Items → CRM Tasks**
   - Meeting action items automatically create tasks in Logos Vision
   - Tasks linked to deals/contacts
   - Assignees mapped from Entomate users to CRM users

2. **Meetings → CRM Activities**
   - Meeting records stored as activities in CRM
   - Linked to relevant deals and contacts
   - Sentiment and key points included

3. **Projects → CRM Projects**
   - Projects can be created from CRM deals
   - Bidirectional sync of project status
   - Deal value and metadata synced

4. **Deal Updates**
   - Meeting outcomes can trigger deal stage changes
   - Automated deal progression based on meeting sentiment/outcomes

**API Endpoints:**
- `POST /api/integrations/crm/sync-action-items`
- `GET /api/integrations/crm/deals`
- `GET /api/integrations/crm/contacts`
- `GET /api/integrations/crm/status`

### Pulse Chat Integration

**Purpose:** Post meeting recaps and notifications to team channels

**Key Files:**
- `backend/services/slackNotifier.js` - Chat notification service
- `backend/services/slackEventListener.js` - Listen for chat events

**Integration Points:**
1. **Meeting Recaps**
   - Automatic posting of meeting summaries to Pulse channels
   - Formatted with action items, decisions, key points
   - Includes links back to Entomate meeting detail

2. **Action Item Notifications**
   - Notifications when action items are created/assigned
   - Posted to relevant team channels
   - Includes task details and due dates

3. **Cross-Reference**
   - Meeting analysis considers Pulse chat history
   - Full conversation context (meeting + chat) for AI insights

**API Endpoints:**
- `POST /api/integrations/chat/post-recap`
- `POST /api/integrations/chat/post`
- `GET /api/integrations/chat/channels`
- `GET /api/integrations/chat/status`

---

## Core Features & Capabilities

### 1. Meeting Management

**Pages:**
- `/meetings` - List all meetings
- `/meetings/:id` - Meeting detail with transcript, summary, action items

**Features:**
- Audio recording (upload or record)
- Real-time transcription (Gemini API)
- AI summarization
- Action item extraction
- Sentiment analysis (Positive/Neutral/Negative)
- Key points extraction
- "Ask AI" - Q&A about meeting content
- Searchable meeting library

**API:**
- `GET /api/meetings` - List meetings
- `POST /api/meetings` - Create meeting
- `GET /api/meetings/:id` - Get meeting details
- `POST /api/meetings/:id/process` - Process audio/transcript
- `POST /api/meetings/:id/ask` - Ask AI question

### 2. Project Management

**Pages:**
- `/projects` - Project list
- `/projects/:id` - Project detail
- `/projects/:id/dashboard` - Project dashboard

**Features:**
- Create projects from CRM deals
- Kanban board view
- Task management within projects
- Progress tracking
- Project statistics

**API:**
- `GET /api/projects`
- `POST /api/projects`
- `POST /api/projects/from-deal` - Create from CRM deal
- `GET /api/projects/:id/stats`

### 3. Task Management

**Pages:**
- `/tasks` - Task list with filters

**Features:**
- Task creation from meetings
- Status tracking (open, in_progress, done, blocked)
- Priority levels (low, medium, high)
- Assignment to team members
- Due date tracking
- Bulk operations

**API:**
- `GET /api/tasks`
- `POST /api/tasks`
- `PUT /api/tasks/:id`
- `POST /api/tasks/:id/complete`
- `POST /api/tasks/bulk`

### 4. Automations

**Pages:**
- `/automations` - Automation list and builder

**Features:**
- Rule-based automation builder (3-step wizard)
- Triggers: meeting_ended, task_created, deal_created, scheduled
- Actions: create_task, sync_to_crm, post_to_chat, etc.
- Dry-run testing
- Execution logs

**API:**
- `GET /api/automations`
- `POST /api/automations`
- `POST /api/automations/:id/execute`
- `GET /api/automations/:id/logs`

### 5. Workflows (Visual Builder)

**Pages:**
- `/workflows` - Workflow list
- `/workflows/:id` - Visual workflow editor

**Features:**
- Node-based visual editor (React Flow)
- Node types: Triggers, Actions, Logic, AI, Data
- Drag-and-drop interface
- Node configuration panel
- Execution trace viewer
- Version control

**API:**
- `GET /api/workflows`
- `POST /api/workflows`
- `PUT /api/workflows/:id`
- `POST /api/workflows/:id/execute`

### 6. AI Agents

**Pages:**
- `/agents` - Agent configuration

**Agents:**
1. **Assignment Agent** - Auto-assigns tasks to team members
2. **Priority Agent** - Sets task priorities based on content
3. **Deadline Agent** - Suggests due dates
4. **Follow-up Agent** - Detects follow-up needs from meetings

**API:**
- `GET /api/agents`
- `POST /api/agents/:id/configure`
- `POST /api/agents/:id/execute`

### 7. Intelligence & Search

**Pages:**
- `/dashboard` - Daily briefing
- `/search` - Cross-app search

**Features:**
- Daily intelligence briefing
- Cross-app semantic search (meetings, tasks, projects)
- AI-powered Q&A
- Team performance metrics

**API:**
- `POST /api/search` - Full-text search
- `POST /api/search/semantic` - Semantic search
- `POST /api/search/ask` - AI Q&A
- `GET /api/intelligence` - Daily briefing

### 8. Analytics & Reports

**Pages:**
- `/analytics` - Charts and metrics
- `/reports` - Generated reports

**Features:**
- Meeting statistics
- Task completion rates
- Team performance
- Project progress
- Export capabilities

**API:**
- `GET /api/analytics/*`
- `GET /api/reports`
- `POST /api/reports/generate`

### 9. Goals & OKRs

**Pages:**
- `/goals` - Goal tracking

**Features:**
- Goal creation and tracking
- OKR management
- Progress visualization

**API:**
- `GET /api/goals`
- `POST /api/goals`

### 10. Calendar

**Pages:**
- `/calendar` - Calendar view

**Features:**
- Meeting calendar
- Task deadlines
- Project milestones
- Google Calendar integration

**API:**
- `GET /api/calendar/*`

---

## Project Structure

```
entomate/
├── backend/                    # Node.js/Express API
│   ├── config/                 # Configuration files
│   │   ├── ai.js              # AI provider config (Gemini/OpenAI)
│   │   ├── gemini.js          # Gemini-specific config
│   │   ├── openai.js           # OpenAI-specific config
│   │   └── supabase.js         # Supabase config
│   ├── database/              # SQL schemas and migrations
│   │   ├── dashboard-views.sql
│   │   └── goals-schema.sql
│   ├── middleware/            # Express middleware
│   │   ├── auth.js             # Authentication
│   │   ├── errorHandler.js     # Error handling
│   │   └── rateLimiter.js     # Rate limiting
│   ├── migrations/             # Database migrations
│   ├── routes/                 # API route handlers
│   │   ├── agents.js
│   │   ├── analytics.js
│   │   ├── automations.js
│   │   ├── calendar.js
│   │   ├── crossAppSearch.js
│   │   ├── dashboard.js
│   │   ├── goals.js
│   │   ├── health.js
│   │   ├── integrations.js
│   │   ├── intelligence.js
│   │   ├── meetings.js
│   │   ├── meetingSummary.js
│   │   ├── projects.js
│   │   ├── reports.js
│   │   ├── search.js
│   │   ├── secrets.js
│   │   ├── slack.js
│   │   ├── tasks.js
│   │   ├── templates.js
│   │   ├── webhooks.js
│   │   └── workflows.js
│   ├── services/              # Business logic
│   │   ├── agents/            # AI agent implementations
│   │   ├── workflow/          # Workflow engine
│   │   ├── agentOrchestrator.js
│   │   ├── agents.js
│   │   ├── agentTemplates.js
│   │   ├── aiAgentService.js
│   │   ├── askService.js
│   │   ├── automationEngine.js
│   │   ├── automationScheduler.js
│   │   ├── calendarService.js
│   │   ├── chatService.js
│   │   ├── crmService.js
│   │   ├── emailService.js
│   │   ├── embeddingService.js
│   │   ├── errorTracking.js
│   │   ├── intelligenceService.js
│   │   ├── logger.js
│   │   ├── reportService.js
│   │   ├── schedulerService.js
│   │   ├── secretsVault.js
│   │   ├── slackEventListener.js
│   │   ├── slackNotifier.js
│   │   └── vectorStore.js
│   ├── utils/                 # Utility functions
│   │   ├── cache.js
│   │   └── validators.js
│   ├── server.js              # Main server entry point
│   └── package.json
│
├── frontend/                   # React application
│   ├── src/
│   │   ├── components/        # Reusable components
│   │   ├── pages/             # Page components
│   │   │   ├── Dashboard.jsx
│   │   │   ├── Meetings.jsx
│   │   │   ├── MeetingDetail.jsx
│   │   │   ├── Projects.jsx
│   │   │   ├── Tasks.jsx
│   │   │   ├── Automations.jsx
│   │   │   ├── Workflows.jsx
│   │   │   ├── WorkflowBuilder.jsx
│   │   │   ├── Agents.jsx
│   │   │   ├── Goals.jsx
│   │   │   ├── Analytics.jsx
│   │   │   ├── Reports.jsx
│   │   │   ├── Calendar.jsx
│   │   │   ├── Search.jsx
│   │   │   └── Settings.jsx
│   │   ├── services/          # API client services
│   │   └── App.jsx            # Main app component
│   ├── public/
│   ├── package.json
│   └── vite.config.js
│
├── src/                        # Shared TypeScript code
│   ├── agents/                # Agent implementations
│   ├── analytics/
│   ├── components/
│   ├── services/
│   │   └── crmSyncService.ts  # Logos Vision sync
│   ├── lib/
│   │   └── logosVisionClient.ts # CRM client
│   └── ...
│
├── docs/                       # Documentation
│   ├── API.md
│   ├── ENTOMATE_UNDER_THE_HOOD.md
│   └── ...
│
├── scripts/                    # Utility scripts
│   ├── start-backend.bat      # Windows backend startup
│   ├── start-frontend.bat     # Windows frontend startup
│   └── deploy.ps1
│
├── tests/                      # Test files
├── docker-compose.yml          # Docker setup
└── README.md
```

---

## How to Run Entomate

### ✅ Yes, you run both backend and frontend servers

### Quick Start (Windows)

**Option 1: Using Batch Scripts**

1. **Start Backend:**
   ```bash
   # Double-click or run:
   scripts\start-backend.bat
   ```
   - Starts on `http://localhost:3000`
   - Health check: `http://localhost:3000/health`

2. **Start Frontend:**
   ```bash
   # Double-click or run:
   scripts\start-frontend.bat
   ```
   - Starts on `http://localhost:5173`
   - Opens in browser automatically

**Option 2: Manual Start**

1. **Backend:**
   ```bash
   cd backend
   npm install  # First time only
   npm run dev  # or npm start
   ```

2. **Frontend (new terminal):**
   ```bash
   cd frontend
   npm install  # First time only
   npm run dev
   ```

### Environment Setup

**Backend** (`backend/.env`):
```env
# Server
PORT=3000
NODE_ENV=development

# Database (Supabase)
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-key

# AI
GEMINI_API_KEY=your-gemini-key
# or
OPENAI_API_KEY=sk-...

# Integrations
LOGOS_VISION_API_URL=https://api.logosvision.com
LOGOS_VISION_API_KEY=your-key
PULSE_API_URL=https://api.pulse.com
PULSE_API_KEY=your-key

# Auth (optional)
CLERK_SECRET_KEY=sk_...

# Security
SESSION_SECRET=your-secret
JWT_SECRET=your-secret

# Monitoring
SENTRY_DSN=your-sentry-dsn
```

**Frontend** (`frontend/.env`):
```env
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```

### Verification

1. **Backend Health:**
   - Visit: `http://localhost:3000/health`
   - Should return JSON with service status

2. **Frontend:**
   - Visit: `http://localhost:5173`
   - Should show login or dashboard

---

## Development Workflow

### Agent-Based Development (from CLAUDE.md)

The project uses specialized "agents" for different tasks:

1. **ARCHITECT** - Plans new features
2. **BUILDER** - Writes code
3. **QUALITY CHECKER** - Reviews code
4. **DEPLOYMENT SPECIALIST** - Handles git/deploy
5. **LEARNING RECORDER** - Documents patterns

### Typical Feature Development Flow

```
1. ARCHITECT → Plan implementation
2. BUILDER → Write code files
3. QUALITY CHECKER → Review each file
4. Repeat 2-3 until complete
5. DEPLOYMENT SPECIALIST → Git commit/push
6. LEARNING RECORDER → Document patterns
```

### Code Patterns

**API Route:**
```javascript
// backend/routes/[resource].js
const express = require('express');
const router = express.Router();

router.get('/', async (req, res) => {
  try {
    // Implementation
    res.json({ success: true, data });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});
```

**Service:**
```javascript
// backend/services/[service].js
class ServiceName {
  async methodName(params) {
    try {
      // Implementation
      return { success: true, data };
    } catch (error) {
      throw error;
    }
  }
}
module.exports = new ServiceName();
```

**React Component:**
```jsx
// frontend/src/components/ComponentName.jsx
import React, { useState, useEffect } from 'react';
import api from '../services/api';

export default function ComponentName() {
  const [data, setData] = useState(null);
  // Implementation
}
```

---

## Key Components & Services

### Backend Services

**AI Services:**
- `aiAgentService.js` - AI agent orchestration
- `askService.js` - Q&A about meetings
- `embeddingService.js` - Vector embeddings for search
- `intelligenceService.js` - Daily intelligence briefing

**Integration Services:**
- `crmService.js` - Logos Vision CRM integration
- `chatService.js` - Pulse chat integration
- `slackNotifier.js` - Slack/Pulse notifications
- `calendarService.js` - Calendar integration

**Automation Services:**
- `automationEngine.js` - Rule-based automation execution
- `automationScheduler.js` - Scheduled automation triggers
- `agentOrchestrator.js` - AI agent coordination

**Workflow Services:**
- `workflow/WorkflowScheduler.js` - Workflow execution
- `workflow/WorkflowEngine.js` - Node execution engine
- `workflow/ExpressionEvaluator.js` - Expression evaluation

**Data Services:**
- `vectorStore.js` - Vector database operations
- `reportService.js` - Report generation
- `logger.js` - Structured logging

### Frontend Components

**Layout:**
- `Layout.jsx` - Main app shell (sidebar, header, content)
- `ProtectedRoute.jsx` - Auth protection
- `ClerkAuthProvider.jsx` - Auth context

**Pages:**
- `Dashboard.jsx` - Home dashboard
- `Meetings.jsx` - Meeting list
- `MeetingDetail.jsx` - Meeting analysis view
- `WorkflowBuilder.jsx` - Visual workflow editor
- `Projects.jsx` - Project management
- `Tasks.jsx` - Task list

**Workflow Components:**
- `WorkflowCanvas.jsx` - Node-based editor
- `NodePalette.jsx` - Draggable nodes
- `NodeConfigPanel.jsx` - Node configuration

---

## API Endpoints Overview

### Core Resources

| Resource | Endpoints |
|----------|-----------|
| **Meetings** | `GET/POST /api/meetings`<br>`GET /api/meetings/:id`<br>`POST /api/meetings/:id/process`<br>`POST /api/meetings/:id/ask` |
| **Projects** | `GET/POST /api/projects`<br>`GET /api/projects/:id`<br>`POST /api/projects/from-deal` |
| **Tasks** | `GET/POST /api/tasks`<br>`PUT /api/tasks/:id`<br>`POST /api/tasks/:id/complete` |
| **Automations** | `GET/POST /api/automations`<br>`POST /api/automations/:id/execute` |
| **Workflows** | `GET/POST /api/workflows`<br>`PUT /api/workflows/:id` |
| **Agents** | `GET /api/agents`<br>`POST /api/agents/:id/configure` |
| **Search** | `POST /api/search`<br>`POST /api/search/semantic`<br>`POST /api/search/ask` |

### Integration Endpoints

| Integration | Endpoints |
|------------|-----------|
| **CRM** | `POST /api/integrations/crm/sync-action-items`<br>`GET /api/integrations/crm/deals`<br>`GET /api/integrations/crm/status` |
| **Chat** | `POST /api/integrations/chat/post-recap`<br>`POST /api/integrations/chat/post`<br>`GET /api/integrations/chat/channels` |

### Intelligence

- `GET /api/intelligence` - Daily briefing
- `POST /api/cross-search` - Cross-app search
- `GET /api/dashboard` - Dashboard data

See `docs/API.md` for complete API documentation.

---

## Database Schema

### Core Tables

**meetings**
- `id`, `title`, `summary`, `transcript`
- `sentiment_score`, `sentiment_label`
- `duration_minutes`, `attendees`
- `created_at`, `updated_at`

**tasks**
- `id`, `title`, `description`
- `status`, `priority`, `due_date`
- `assigned_to`, `project_id`, `meeting_id`
- `created_at`, `completed_at`

**projects**
- `id`, `name`, `description`
- `status`, `progress`
- `crm_deal_id`, `deal_value`
- `created_at`

**workflows**
- `id`, `name`, `description`
- `nodes` (JSON), `connections` (JSON)
- `active`, `version`
- `execution_count`, `last_executed_at`

**automations**
- `id`, `name`, `description`
- `trigger_type`, `trigger_config`
- `action_type`, `action_config`
- `active`, `trigger_count`

See `backend/database/` and `backend/schema.sql` for full schema.

---

## Future Development Priorities

### High Priority

1. **Enhanced CRM Sync**
   - Real-time bidirectional sync
   - Conflict resolution
   - Field mapping configuration

2. **Advanced Workflow Builder**
   - More node types
   - Conditional branching
   - Error handling nodes
   - Workflow templates

3. **AI Improvements**
   - Better action item extraction
   - Context-aware summaries
   - Predictive task assignment
   - Sentiment trend analysis

4. **Mobile App**
   - React Native app
   - Meeting recording on mobile
   - Push notifications

### Medium Priority

5. **Advanced Analytics**
   - Custom dashboards
   - Export to PDF/CSV
   - Team performance insights

6. **Integration Expansion**
   - More calendar providers
   - Email integration
   - Additional chat platforms

7. **Collaboration Features**
   - Real-time collaboration
   - Comments and annotations
   - Team workspaces

### Low Priority

8. **Customization**
   - Custom themes
   - User preferences
   - Custom fields

9. **Enterprise Features**
   - SSO/SAML
   - Advanced permissions
   - Audit logs

---

## Quick Reference

### Ports
- **Backend:** `http://localhost:3000`
- **Frontend:** `http://localhost:5173`

### Key Commands

```bash
# Backend
cd backend
npm install      # Install dependencies
npm run dev      # Development mode
npm start        # Production mode

# Frontend
cd frontend
npm install      # Install dependencies
npm run dev      # Development server
npm run build    # Production build
```

### Important Files

- `backend/server.js` - Main server entry
- `frontend/src/App.jsx` - React app entry
- `backend/.env` - Backend environment variables
- `frontend/.env` - Frontend environment variables
- `CLAUDE.md` - Development workflow guide
- `docs/API.md` - API documentation
- `docs/ENTOMATE_UNDER_THE_HOOD.md` - Design system

### Integration Configuration

**Logos Vision CRM:**
- Configure in `backend/.env`: `LOGOS_VISION_API_URL`, `LOGOS_VISION_API_KEY`
- Client: `src/lib/logosVisionClient.ts`
- Service: `src/services/crmSyncService.ts`

**Pulse Chat:**
- Configure in `backend/.env`: `PULSE_API_URL`, `PULSE_API_KEY`
- Service: `backend/services/slackNotifier.js`

### Health Checks

- Backend: `http://localhost:3000/health`
- API: `http://localhost:3000/api/health`
- Frontend: `http://localhost:5173`

---

## Summary

**Entomate** is your AI-powered automation layer connecting Logos Vision CRM and Pulse chat. It processes meetings, extracts insights, syncs with CRM, and notifies teams—all while providing powerful workflow automation and analytics.

**To run:** Start both backend (port 3000) and frontend (port 5173) servers.

**Key Differentiator:** Native deep integration with your existing CRM and communication tools, not generic third-party connectors.

Use this document as your planning reference for new development work!
