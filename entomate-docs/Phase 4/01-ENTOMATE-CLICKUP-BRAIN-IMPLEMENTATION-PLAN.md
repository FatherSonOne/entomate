# Entomate: ClickUp Brain Feature Implementation Plan
## Complete Step-by-Step Guide for Private Team Automation

**Version:** 1.0  
**Created:** December 17, 2025  
**Status:** Ready for Implementation  
**Target Timeline:** 16 Weeks (2 Phases)  
**Tech Stack:** React | Node.js/Express | Supabase (PostgreSQL) | Gemini API  

---

## 📋 TABLE OF CONTENTS

1. **Project Overview**
2. **Feature Analysis (From ClickUp Brain Images)**
3. **Architecture & Technology Stack**
4. **Phase 1: Core Features (Weeks 1-8)**
5. **Phase 2: Advanced Features (Weeks 9-16)**
6. **Database Schema**
7. **API Endpoints**
8. **Implementation Instructions**
9. **Testing & Deployment**
10. **Files & Markdowns for Download**

---

## 🎯 PROJECT OVERVIEW

### What You're Building
An **AI-powered meeting, project, and automation hub** that connects your internal team systems. Unlike ClickUp Brain (generic SaaS), your Entomate will be:
- **Private** - Only your team
- **Integrated** - Native connection to your CRM and Communication apps
- **Context-Aware** - Understands full team communication and project history
- **Intelligent** - Powered by Gemini AI

### Core Value Proposition
"Meeting intelligence that becomes actionable work—automatically synced across your team's entire workspace."

### Success Metrics (Phase 1)
- ✅ Meetings recorded and transcribed with 95%+ accuracy
- ✅ Action items extracted with 90%+ accuracy
- ✅ Tasks auto-created in CRM without manual intervention
- ✅ Team receives meeting recaps in chat instantly
- ✅ Can ask AI questions about any past meeting
- ✅ Basic automations running (meeting → CRM → Chat)
- ✅ Zero downtime, 99.9% uptime

---

## 🔍 FEATURE ANALYSIS FROM CLICKUP BRAIN IMAGES

Based on the 12 images you provided, here are the key ClickUp Brain features and how they map to Entomate:

### IMAGE 1-2: Dashboard & Settings Overview
**ClickUp Shows:**
- Centralized settings hub (General, People, Teams, Integrations)
- Workspace configuration
- AI settings and usage tracking

**Entomate Implementation:**
- Admin panel for workspace settings
- User/team management
- Gemini API quota tracking
- Integration status dashboard

---

### IMAGE 3: AI Features Overview
**ClickUp Shows:**
- Agents (NEW) - "Delegate your work entirely"
- BrainGPT - "One AI app to rule them all"
- Talk to Text - "Write 4x faster than you type"
- Notetaker - "Intelligent meeting notes and summaries"
- Enterprise Search - "Find anything across your workspace"

**Entomate Mapping:**
| ClickUp Feature | Entomate Equivalent | Priority | Timeline |
|---|---|---|---|
| Agents | Custom AI Agents | TIER 1 | Weeks 7-8 |
| BrainGPT | Ask Assistant | TIER 1 | Week 6 |
| Talk to Text | Voice-to-Task | TIER 2 | Phase 2 |
| Notetaker | Meeting Transcription | TIER 1 | Weeks 2-3 |
| Enterprise Search | Cross-App Search | TIER 2 | Phase 2 |

---

### IMAGE 4-5: Agents & Automations
**ClickUp Shows:**
- Create Autopilot Agent interface
- Trigger-based workflows
- Custom agent builder
- Pre-built agent templates

**Entomate Implementation:**
**Phase 1 (Basic):**
1. **Meeting → Task Automation**
   - Trigger: Meeting ends
   - Actions: Extract action items → Create tasks in CRM → Post to chat
   
2. **Deal → Project Automation**
   - Trigger: New deal created
   - Actions: Create project → Auto-assign tasks → Schedule kickoff

3. **Chat → Escalation Automation**
   - Trigger: Keywords in Pulse chat
   - Actions: Create urgent task → Notify manager → Update CRM

**Phase 2 (Advanced):**
- Custom agent creation interface
- Complex multi-trigger workflows
- AI-powered agent suggestions
- Agent performance analytics

---

### IMAGE 6: Brain Features Panel
**ClickUp Shows:**
- Platform Overview
- Agents (NEW label)
- BrainGPT
- Talk to Text
- Notetaker
- Enterprise Search

**Entomate Feature Rollout:**
- **Week 1-2:** Notetaker (transcription, summarization)
- **Week 3:** CRM Sync (create tasks)
- **Week 4:** Chat Integration (post recaps)
- **Week 5:** Project Management (basic CRUD)
- **Week 6:** Ask Assistant (search, QA)
- **Week 7:** Basic Automations
- **Week 8:** Polish & Deploy

---

### IMAGE 7-8: Dashboard & Task Management
**ClickUp Shows:**
- Dashboard templates (Task Management, AI Team Center, Time Tracking, etc.)
- Widget-based layout
- Real-time progress visualization
- Status tracking

**Entomate Implementation:**
- **Main Dashboard:**
  - Today's meetings scheduled
  - Action items due today
  - Recent activity feed
  - Team performance metrics
  
- **Project Dashboard:**
  - Task list with status
  - Progress visualization
  - Milestone tracking
  - Team workload view

---

### IMAGE 9: Whiteboards & Collaboration
**ClickUp Shows:**
- Whiteboards for collaboration
- Templates (Organizational Chart, Action Plan, Customer Journey Map, Flow Chart)
- Visual planning tools

**Entomate Implementation (Phase 2):**
- Meeting preparation boards
- Action item visual mapping
- Deal roadmap visualization
- Team capacity planning

---

### IMAGE 10: Goals & Tracking
**ClickUp Shows:**
- "Make your goals a reality"
- Goal creation interface
- Progress tracking UI
- Visual goal breakdown

**Entomate Implementation (Phase 2):**
- Team goals synced from CRM
- Goal-to-task mapping
- Progress dashboard
- Milestone tracking

---

### IMAGE 11: Documentation & Docs
**ClickUp Shows:**
- Doc templates (Getting Started, Project Overview, Meeting Notes, Campaign Plan)
- Rich text editor
- Knowledge base organization

**Entomate Implementation:**
- Auto-generated meeting docs
- Meeting templates
- Knowledge base searchable by Gemini
- Doc library by meeting/project

---

### IMAGE 12: Chat & Communication
**ClickUp Shows:**
- Native chat interface
- Channel organization
- Message threads
- App connector integration

**Entomate Implementation (Phase 1):**
- Pulse chat integration
- Message posting for meeting recaps
- Action item notifications
- Cross-app mentions

---

## 🏗️ ARCHITECTURE & TECHNOLOGY STACK

### System Architecture Diagram

┌─────────────────────────────────────────────────────────────┐
│ ENTOMATE FRONTEND (React) │
│ ┌──────────┬──────────┬──────────┬──────────────────────┐ │
│ │ Meeting │ Projects │ Ask AI │ Automations UI │ │
│ │ Recorder │ Manager │ Assistant│ │ │
│ └──────────┴──────────┴──────────┴──────────────────────┘ │
└────────────────────────────┬────────────────────────────────┘
│ HTTP/WebSocket
▼
┌─────────────────────────────────────────────────────────────┐
│ API LAYER (Node.js/Express) │
│ ┌──────────┬──────────┬──────────┬──────────────────────┐ │
│ │ /meetings│ /projects│ /tasks │ /automations │ │
│ │ /search │ /ask │ /agents │ /integrations │ │
│ └──────────┴──────────┴──────────┴──────────────────────┘ │
└────────┬─────────────┬─────────────┬────────────────────────┘
│ │ │
┌────▼──┐ ┌─────▼────┐ ┌────▼──────┐
│Gemini │ │ Supabase │ │ External │
│ API │ │ (PG DB) │ │ APIs │
└───────┘ └──────────┘ └───────────┘
│ │ │
Transcribe Store Data CRM Sync
Summarize Vector DB Chat Sync
Extract AI Real-time Webhooks

External Integrations:
├─ Your CRM API (Deal management, task creation)
├─ Your Chat App API (Message posting, notifications)
└─ Google Meet/Zoom APIs (Recording, transcription)

text

### Technology Stack Decision Matrix

| Layer | Technology | Why | Alternative |
|-------|-----------|-----|-------------|
| **Frontend** | React + TypeScript | Type safety, large ecosystem, team familiarity | Vue.js, Svelte |
| **Backend** | Node.js + Express | JavaScript throughout, fast development | Python/Django, Go |
| **Database** | Supabase (PostgreSQL) | Built-in Auth, Real-time, REST API, Vector support | Firebase, MongoDB |
| **AI** | Google Gemini API | Free tier, powerful, works with audio | OpenAI GPT-4, Claude |
| **Vector DB** | PostgreSQL pgvector | Integrated with Supabase, no extra infrastructure | Pinecone, Weaviate |
| **Authentication** | Supabase Auth | Built-in, OAuth support, JWT | Auth0, Firebase Auth |
| **File Storage** | Supabase Storage (S3) | Integrated, simple API | AWS S3, Google Cloud Storage |
| **Hosting** | Vercel (Frontend) + Render (Backend) | Easy deployment, auto-scaling | AWS, DigitalOcean, Heroku |

---

## 📊 PHASE 1: CORE FEATURES (WEEKS 1-8)

### Week-by-Week Breakdown

#### WEEK 1: Foundation & Setup
**Objective:** Get backend running, Gemini API working, database initialized

**What Gets Done:**
- Backend environment setup (Node.js, Express, Supabase)
- Gemini API configuration and testing
- Database schema creation
- Frontend project structure
- Team alignment on API contracts

**Key Deliverables:**
- ✅ Backend running on `localhost:3000`
- ✅ Gemini API tested with 3 core prompts
- ✅ PostgreSQL database with tables (meetings, action_items, projects, tasks)
- ✅ Frontend starter components built
- ✅ API documentation (OpenAPI/Swagger)

**Gemini Setup (5 minutes):**
Go to https://aistudio.google.com

Create free account

Click "Create API Key"

Copy key, save in .env as GEMINI_API_KEY

Test: Paste a meeting transcript, ask Gemini to summarize

text

**Backend Quick Start:**
Create project
mkdir entomate-backend
cd entomate-backend
npm init -y

Install dependencies
npm install express cors dotenv @google/generative-ai pg supabase-js uuid

Create .env file
GEMINI_API_KEY=your_key_here
DATABASE_URL=your_supabase_url
SUPABASE_KEY=your_supabase_anon_key
NODE_ENV=development
PORT=3000

Create server.js
(See code section below)
Start
npm start

text

**Database Initialization (Supabase):**
-- Run this in Supabase SQL Editor

-- Meetings table
CREATE TABLE IF NOT EXISTS meetings (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
title VARCHAR(255) NOT NULL,
description TEXT,
transcript TEXT,
summary TEXT,
sentiment_label VARCHAR(20),
sentiment_score FLOAT,
audio_file_url VARCHAR(512),
start_time TIMESTAMP,
end_time TIMESTAMP,
duration_minutes INT,
attendees JSONB DEFAULT '[]',
created_by UUID NOT NULL,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Action items table
CREATE TABLE IF NOT EXISTS action_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
task_description TEXT NOT NULL,
assigned_to_email VARCHAR(255),
assigned_to_name VARCHAR(255),
due_date DATE,
priority VARCHAR(20) DEFAULT 'medium',
status VARCHAR(20) DEFAULT 'open',
crm_sync_status VARCHAR(20) DEFAULT 'pending',
crm_task_id VARCHAR(256),
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
description TEXT,
crm_deal_id VARCHAR(256),
status VARCHAR(20) DEFAULT 'planning',
deal_value DECIMAL(12,2),
start_date DATE,
end_date DATE,
owner_id UUID NOT NULL,
team_ids UUID[],
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Tasks table
CREATE TABLE IF NOT EXISTS tasks (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
title VARCHAR(255) NOT NULL,
description TEXT,
assigned_to UUID,
status VARCHAR(20) DEFAULT 'open',
priority VARCHAR(20) DEFAULT 'medium',
due_date DATE,
crm_task_id VARCHAR(256),
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Automations table (Week 7)
CREATE TABLE IF NOT EXISTS automations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
trigger_type VARCHAR(100) NOT NULL,
trigger_config JSONB,
actions JSONB NOT NULL,
enabled BOOLEAN DEFAULT true,
created_by UUID NOT NULL,
created_at TIMESTAMP DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_tasks_project ON tasks(project_id);
CREATE INDEX idx_tasks_status ON tasks(status);

text

---

#### WEEK 2: Meeting Recording & Transcription
**Objective:** Users can record meetings, Gemini transcribes instantly

**What Gets Done:**
- Frontend meeting recorder UI (start/stop, duration, transcript display)
- Backend endpoint to process audio
- Integration with Gemini Speech-to-Text API
- Live transcript display while recording
- Meeting summary generation

**Key Deliverables:**
- ✅ Meeting recorder component with working microphone access
- ✅ Real-time transcription display
- ✅ Audio file uploaded to Supabase Storage
- ✅ Transcript stored in database
- ✅ Meeting summary generated by Gemini
- ✅ Full end-to-end flow tested

---

#### WEEK 3: CRM Sync (Auto-Create Tasks)
**Objective:** Action items from meetings automatically create tasks in your CRM

**What Gets Done:**
- CRM API integration (list users, create tasks, update deals)
- Task mapping logic (Entomate → CRM format)
- Sync status tracking (pending/synced/failed)
- Error handling & retry logic
- Sync dashboard showing status

**Key Deliverables:**
- ✅ CRM API integration tested
- ✅ Action items synced to CRM automatically
- ✅ Sync status visible in UI
- ✅ Error handling with retry logic
- ✅ User can manually trigger sync

---

#### WEEK 4: Chat Integration (Pulse Notifications)
**Objective:** Meeting recaps automatically posted to team chat

**What Gets Done:**
- Chat API integration (post messages to channels)
- Beautiful meeting recap message formatting
- Smart channel routing (which team gets which recap)
- Notification preferences (digest vs real-time)
- Link back to full meeting details

**Key Deliverables:**
- ✅ Meeting recaps posted to chat automatically
- ✅ Formatted messages with action items, decisions, sentiment
- ✅ Links to full meeting details
- ✅ Team notification preferences working
- ✅ Full integration tested

---

#### WEEK 5: Project Management Basics
**Objective:** Create and manage projects with tasks

**What Gets Done:**
- Projects CRUD (Create, Read, Update, Delete)
- Link projects to CRM deals
- Task management within projects
- Project dashboard
- Team assignment

**Key Deliverables:**
- ✅ Create project from deal
- ✅ View project detail with tasks
- ✅ Add/edit/delete tasks
- ✅ Assign team members to tasks
- ✅ Project dashboard with progress

---

#### WEEK 6: Ask Assistant (AI Search)
**Objective:** Users can ask AI questions about any past meeting

**What Gets Done:**
- Vector embeddings for meetings (stored in Supabase pgvector)
- Semantic search implementation
- RAG (Retrieval-Augmented Generation) prompt
- Ask Assistant UI widget
- Citation tracking (which meetings were referenced)

**Key Deliverables:**
- ✅ Can ask natural language questions
- ✅ Get context-aware answers from past meetings
- ✅ See which meetings were referenced
- ✅ Links to full meeting transcripts

---

#### WEEK 7: Basic Automations
**Objective:** Define trigger-based workflows

**What Gets Done:**
- Automation framework (triggers, actions, conditions)
- UI to create automations (no-code)
- Pre-built automation templates:
  1. "Meeting ends → Create action items → Sync to CRM → Post to chat"
  2. "Deal created in CRM → Create project → Auto-assign tasks"
  3. "Chat mentions priority keyword → Create urgent task → Notify manager"

**Key Deliverables:**
- ✅ Automation engine running
- ✅ 3 pre-built automations working
- ✅ Can enable/disable automations
- ✅ Automation execution logs

---

#### WEEK 8: Polish & Deploy
**Objective:** Production-ready system

**What Gets Done:**
- Code review & refactoring
- Security audit (API keys, SQL injection, CORS)
- Performance optimization (database indexes, query optimization)
- Comprehensive testing
- Deployment to production
- Team training & documentation

**Key Deliverables:**
- ✅ All tests passing (unit + integration)
- ✅ Security scan clean
- ✅ Performance benchmarks met (< 2 second API responses)
- ✅ Deployed to production
- ✅ Team trained on using system
- ✅ Full documentation (user guide + dev guide)

---

## 📁 DATABASE SCHEMA (DETAILED)

-- ========================================
-- USERS & TEAMS
-- ========================================

CREATE TABLE IF NOT EXISTS users (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
email VARCHAR(255) NOT NULL UNIQUE,
full_name VARCHAR(255),
avatar_url VARCHAR(512),
role VARCHAR(50) DEFAULT 'member', -- admin, manager, member
team_id UUID NOT NULL REFERENCES teams(id),
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teams (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
name VARCHAR(255) NOT NULL,
description TEXT,
logo_url VARCHAR(512),
settings JSONB DEFAULT '{}',
created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- MEETINGS & ACTION ITEMS
-- ========================================

CREATE TABLE IF NOT EXISTS meetings (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Basic info
title VARCHAR(255) NOT NULL,
description TEXT,

-- Content
transcript TEXT,
summary TEXT,
audio_file_url VARCHAR(512),

-- Analysis results
sentiment_label VARCHAR(20), -- Positive, Neutral, Negative
sentiment_score FLOAT,
key_points JSONB DEFAULT '[]',
decisions JSONB DEFAULT '[]',

-- Metadata
start_time TIMESTAMP,
end_time TIMESTAMP,
duration_minutes INT,
attendees JSONB DEFAULT '[]', -- [{name, email}, ...]

-- References
created_by UUID NOT NULL REFERENCES users(id),
project_id UUID REFERENCES projects(id),
crm_deal_id VARCHAR(256),

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),

-- Vectors for semantic search
transcript_vector vector(1536) -- pgvector for embeddings
);

CREATE TABLE IF NOT EXISTS action_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Reference
meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,

-- Content
task_description TEXT NOT NULL,
context TEXT, -- why this task exists

-- Assignment
assigned_to_email VARCHAR(255),
assigned_to_name VARCHAR(255),
assigned_to_id UUID REFERENCES users(id),

-- Scheduling
due_date DATE,
priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low
status VARCHAR(20) DEFAULT 'open', -- open, in_progress, done, cancelled

-- CRM sync
crm_sync_status VARCHAR(20) DEFAULT 'pending', -- pending, synced, failed
crm_task_id VARCHAR(256),
last_sync_attempt TIMESTAMP,
last_sync_error TEXT,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP
);

-- ========================================
-- PROJECTS & TASKS
-- ========================================

CREATE TABLE IF NOT EXISTS projects (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Basic info
name VARCHAR(255) NOT NULL,
description TEXT,
status VARCHAR(20) DEFAULT 'planning', -- planning, active, completed, archived

-- CRM Link
crm_deal_id VARCHAR(256),
deal_value DECIMAL(12,2),

-- Dates
start_date DATE,
end_date DATE,

-- Team
owner_id UUID NOT NULL REFERENCES users(id),
team_ids UUID[] DEFAULT '{}',

-- Metadata
tags JSONB DEFAULT '[]',
settings JSONB DEFAULT '{}',

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Reference
project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,

-- Content
title VARCHAR(255) NOT NULL,
description TEXT,

-- Assignment
assigned_to UUID REFERENCES users(id),

-- Status & priority
status VARCHAR(20) DEFAULT 'open', -- open, in_progress, review, done, blocked
priority VARCHAR(20) DEFAULT 'medium', -- high, medium, low

-- Dates
due_date DATE,
start_date DATE,

-- CRM link
crm_task_id VARCHAR(256),

-- Metadata
tags JSONB DEFAULT '[]',
custom_fields JSONB DEFAULT '{}',

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW(),
completed_at TIMESTAMP
);

-- ========================================
-- AUTOMATIONS & LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS automations (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Basic info
name VARCHAR(255) NOT NULL,
description TEXT,

-- Trigger & Actions
trigger_type VARCHAR(100) NOT NULL, -- meeting_ended, deal_created, chat_message, etc.
trigger_config JSONB NOT NULL,
actions JSONB NOT NULL, -- [{type, config}, ...]

-- Status
enabled BOOLEAN DEFAULT true,

-- Metadata
created_by UUID NOT NULL REFERENCES users(id),
team_id UUID NOT NULL REFERENCES teams(id),

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Reference
automation_id UUID NOT NULL REFERENCES automations(id),

-- Execution
triggered_at TIMESTAMP NOT NULL,
trigger_data JSONB,
actions_executed JSONB, -- [{type, status, result}, ...]
success BOOLEAN,
error_message TEXT,

-- Duration
duration_ms INT,

-- Metadata
created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INTEGRATIONS & SYNC STATUS
-- ========================================

CREATE TABLE IF NOT EXISTS integration_logs (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- What was synced
source_type VARCHAR(50), -- meeting, action_item, project, task
source_id UUID,
destination_type VARCHAR(50), -- crm, chat
destination_id VARCHAR(256),

-- Status
status VARCHAR(20), -- pending, synced, failed, retrying
error_message TEXT,

-- Retry tracking
retry_count INT DEFAULT 0,
next_retry_at TIMESTAMP,

-- Timestamps
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- SEARCH & KNOWLEDGE
-- ========================================

CREATE TABLE IF NOT EXISTS search_index (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

-- Content
content_type VARCHAR(50), -- meeting, action_item, task, project
content_id UUID,
title VARCHAR(255),
content TEXT,

-- Metadata
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_meetings_project_id ON meetings(project_id);
CREATE INDEX idx_meetings_crm_deal_id ON meetings(crm_deal_id);
CREATE INDEX idx_meetings_transcript_vector ON meetings USING ivfflat (transcript_vector);

CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned_to ON action_items(assigned_to_id);
CREATE INDEX idx_action_items_crm_sync_status ON action_items(crm_sync_status);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_crm_deal_id ON projects(crm_deal_id);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);
CREATE INDEX idx_tasks_status ON tasks(status);

CREATE INDEX idx_automations_team_id ON automations(team_id);
CREATE INDEX idx_automations_enabled ON automations(enabled);

CREATE INDEX idx_integration_logs_source ON integration_logs(source_type, source_id);

text

---

## 🔌 API ENDPOINTS (CORE LIST)

### Meetings API
POST /api/meetings/process - Upload audio, get transcript, summary, action items
GET /api/meetings - List all meetings
GET /api/meetings/:id - Get meeting details
PUT /api/meetings/:id - Update meeting
POST /api/meetings/:id/ask - Ask AI question about meeting
GET /api/meetings/:id/download - Download meeting as PDF

text

### Action Items API
POST /api/action-items - Create action item
GET /api/action-items - List action items (with filtering)
PUT /api/action-items/:id - Update action item
DELETE /api/action-items/:id - Delete action item
POST /api/action-items/:id/sync-to-crm - Manually trigger CRM sync

text

### Projects API
POST /api/projects - Create project
GET /api/projects - List projects
GET /api/projects/:id - Get project details + tasks
PUT /api/projects/:id - Update project
DELETE /api/projects/:id - Delete project
POST /api/projects/:id/from-deal - Create project from CRM deal

text

### Tasks API
POST /api/projects/:projectId/tasks - Create task
GET /api/projects/:projectId/tasks - List tasks in project
PUT /api/tasks/:id - Update task
DELETE /api/tasks/:id - Delete task
POST /api/tasks/:id/complete - Mark task as complete

text

### Automations API
POST /api/automations - Create automation
GET /api/automations - List automations
PUT /api/automations/:id - Update automation
DELETE /api/automations/:id - Delete automation
POST /api/automations/:id/toggle - Enable/disable automation
GET /api/automations/:id/logs - Get execution logs

text

### Search API
POST /api/search - Full-text + semantic search
POST /api/search/semantic - Semantic search using embeddings

text

### Integrations API
GET /api/integrations/status - Get sync status for all integrations
POST /api/integrations/crm/sync - Manually trigger full CRM sync
POST /api/integrations/chat/send - Send message to chat channel
GET /api/integrations/logs - Get integration sync logs

text

---

## 💡 KEY INSIGHTS FOR IMPLEMENTATION

### Why This Architecture Works
1. **Modular** - Each feature independent, can be built in parallel
2. **Scalable** - Supabase handles growth, Gemini API scales
3. **Secure** - OAuth + JWT, encrypted data, rate limiting
4. **Fast** - Indexed queries, cached embeddings, async processing
5. **Maintainable** - Clear separation of concerns, well-documented APIs

### Critical Success Factors
1. **Gemini Prompt Quality** - Good prompts = accurate extraction
2. **Database Design** - Proper indexes = fast queries
3. **Error Handling** - Robust retry logic = reliable integrations
4. **Team Communication** - Clear APIs = fast development
5. **Testing Early** - Catch bugs before deployment

---

## 📚 LEARNING & REFERENCE

This plan includes everything needed for:
- **Backend Developers** - Node.js, Express, Gemini API, Supabase
- **Frontend Developers** - React, TypeScript, Tailwind, API integration
- **Project Managers** - Week-by-week plan, checklist, metrics
- **QA Engineers** - Testing procedures, verification criteria
- **DevOps/Infrastructure** - Deployment, monitoring, scaling

---

**End of FILE 1**

Ready for FILE 2? Let me know!
✅ How to Save This
Copy all the text above (starting from # Entomate:)

Open your text editor (VS Code, Notepad, etc.)

Paste it

Save as: 01-ENTOMATE-CLICKUP-BRAIN-IMPLEMENTATION-PLAN.md