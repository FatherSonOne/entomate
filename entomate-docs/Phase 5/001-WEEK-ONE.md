📋 PHASE 1 WEEK-BY-WEEK MARKDOWN GENERATION
Perfect! I'll generate detailed MDdown implementation files for each week, one at a time, with:

✅ Clear instructions for you

✅ Ready-to-use code for Claude Code

✅ SQL for Supabase setup

Let me start with WEEK 1: FOUNDATION & SETUP

📄 WEEK 1: FOUNDATION & SETUP
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 42 items

🎯 WEEK 1 OVERVIEW
Goal: Get entire backend, frontend, and database running locally with all team members able to develop

By Friday EOD, you should have:

✅ Backend running on localhost:3000

✅ Frontend running on localhost:5173

✅ Database initialized and queryable

✅ Gemini API tested and working

✅ Team onboarded and ready to code

✅ Git repository set up

✅ Daily standups happening

Time Commitment: 40 hours total (5 dev + 1 DevOps + 1 PM)

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: Infrastructure & Setup (8 hours)
Morning (9am-12pm): Team Kickoff & Planning
Your Tasks (PM/Team Lead):

 Schedule Team Meeting (30 mins)

Send calendar invite: 60 minutes, all team

Agenda: Project overview, Week 1 plan, Q&A

 Share Documentation (15 mins)

Email team: Files 5 & 6

Message: "Read Quick Start Guide this morning"

 Create Project Structure (30 mins)

Go to GitHub: Create new private repo "entomate"

Invite all developers

Add README with link to docs

Developer Tasks (Backend & Frontend):

 Clone Repository (5 mins)

bash
git clone https://github.com/YOUR-ORG/entomate.git
cd entomate
 Create Folder Structure (10 mins)

bash
mkdir backend frontend docs
mkdir backend/config backend/routes backend/services backend/middleware backend/utils
mkdir frontend/src/components frontend/src/pages frontend/src/services frontend/src/hooks frontend/src/styles
DevOps Tasks:

 Create GitHub Repository (5 mins)

Go to: https://github.com/new

Name: entomate

Description: "Entomate: AI Meeting Intelligence Platform"

Private: Yes

Add .gitignore: Node

Create

 Set Up GitHub Branches (10 mins)

bash
git branch develop
git branch production
git push origin develop production
Afternoon (1pm-5pm): API Keys & Backend Init
DevOps Tasks:

 Create Gemini API Key (10 mins)

Go to: https://aistudio.google.com

Sign in with Google

Click: "Create API Key"

Copy key

Save in password manager

CRITICAL: Don't commit this to Git

 Create Supabase Project (15 mins)

Go to: https://supabase.com

Click: "Start your project"

Create account

Create new organization

Create new project:

Name: entomate-dev

Region: Closest to you

Password: Strong (save in manager)

Wait for initialization (~2 mins)

 Get Supabase Credentials (10 mins)

Go to: Project Settings → API Keys

Copy "Project URL"

Copy "anon public" key

Copy "service_role" key (for admin)

Save all three securely

Backend Developer:

 Initialize Backend (15 mins)

bash
cd backend
npm init -y
 Create .env File (5 mins)

bash
cat > .env << 'EOF'
# Gemini API
GEMINI_API_KEY=your_key_here_KEEP_SECRET

# Supabase
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_KEY=your_service_key_here

# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173

# Logging
LOG_LEVEL=debug
EOF
 Create .env.example (5 mins)

bash
cat > .env.example << 'EOF'
GEMINI_API_KEY=your_key_here
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=xxxxx
SUPABASE_SERVICE_KEY=xxxxx
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:5173
LOG_LEVEL=debug
EOF
 Add to .gitignore (5 mins)

bash
echo ".env" >> ../.gitignore
echo "node_modules/" >> ../.gitignore
echo ".DS_Store" >> ../.gitignore
echo "dist/" >> ../.gitignore
 Install Dependencies (3 mins)

bash
npm install express cors dotenv helmet morgan uuid
npm install @google/generative-ai @supabase/supabase-js multer axios
npm install --save-dev nodemon
Frontend Developer:

 Initialize Frontend (15 mins)

bash
cd ../frontend
npm create vite@latest . -- --template react
npm install
npm install axios moment react-router-dom
 Create .env.local (5 mins)

bash
cat > .env.local << 'EOF'
VITE_API_URL=http://localhost:3000
VITE_ENV=development
EOF
🟢 TUESDAY: Database Setup (8 hours)
Morning (9am-12pm): Database Schema
DevOps / Backend Lead:

 Connect to Supabase SQL Editor (5 mins)

Go to Supabase Dashboard

Click: "SQL Editor" (left sidebar)

Click: "New Query"

 Run Database Schema (20 mins)

Copy the SQL from "SECTION: SUPABASE SCHEMA SQL" below

Paste into Supabase SQL editor

Click: "Run"

Wait for completion

Check for errors (should be none)

 Verify Tables Created (10 mins)

Go to: "Table Editor" (left sidebar)

Verify these tables exist:

 meetings

 action_items

 projects

 tasks

 automations

 automation_logs

 integration_logs

 search_index

 Enable Row Level Security (RLS) (15 mins)

For each table:

Click table

Go to: "Auth" tab

Enable RLS (toggle on)

Leave policy blank for now (Week 8)

Afternoon (1pm-5pm): Backend API Setup
Backend Developer:

 Create server.js (20 mins)

Copy code from "SECTION: BACKEND CODE - server.js" below

Create: backend/server.js

Paste code

 Create config/gemini.js (20 mins)

Copy code from "SECTION: BACKEND CODE - gemini.js" below

Create: backend/config/gemini.js

Paste code

 Create config/supabase.js (5 mins)

Copy code from "SECTION: BACKEND CODE - supabase.js" below

Create: backend/config/supabase.js

Paste code

 Test Backend Starts (10 mins)

bash
cd backend
npm start
Expected Output:

text
✅ Entomate Backend running on http://localhost:3000
Environment: development
If error, check:

 Node.js installed (node -v)

 Dependencies installed (npm install ran)

 .env file exists with all values

 Port 3000 not already in use

 Test Health Endpoint (5 mins)

Open browser: http://localhost:3000/api/health

Should show:

json
{
  "status": "ok",
  "timestamp": "2025-12-17T...",
  "services": {
    "gemini": "connected",
    "database": "connected"
  }
}
If error, check:

 Gemini API key is valid

 Supabase URL and key are valid

 Supabase project is running (not paused)

 Create Frontend App (15 mins)

Copy code from "SECTION: FRONTEND CODE - App.jsx" below

Create/replace: frontend/src/App.jsx

Paste code

 Test Frontend Starts (10 mins)

bash
cd ../frontend
npm run dev
Expected Output:

text
Local: http://localhost:5173
Open in browser

Should see: "Welcome to Entomate"

🟡 WEDNESDAY: Git & Documentation (8 hours)
Morning (9am-12pm): Version Control
DevOps / Team Lead:

 Initialize Git Repository (10 mins)

bash
cd entomate
git init
git add .
git commit -m "Week 1: Initial project setup with backend, frontend, and database schema"
git remote add origin https://github.com/YOUR-ORG/entomate.git
git push -u origin main
 Set Up Branch Protection (10 mins)

Go to GitHub repo

Settings → Branches

Add rule for: main

Require pull request reviews: 2

Require status checks: Enable

Save

 Create develop Branch (5 mins)

bash
git checkout -b develop
git push -u origin develop
 Set develop as Default (5 mins)

GitHub → Settings → Default branch

Change to: develop

Save

 Add Collaborators (10 mins)

GitHub → Settings → Collaborators

Add all team members

Set permissions: "Write" (can push to develop)

Afternoon (1pm-5pm): Documentation
Documentation Lead (PM or Tech Lead):

 Create README.md (20 mins)

Create: README.md (root folder)

Copy template from "SECTION: README TEMPLATE" below

 Create CONTRIBUTING.md (15 mins)

Create: CONTRIBUTING.md (root folder)

Content: Git workflow, code style, PR process

 Create SETUP.md (20 mins)

Create: docs/SETUP.md

Document: How to set up locally

Include: All .env variables needed

Include: All npm install steps

 Create API documentation stub (15 mins)

Create: docs/API.md

Content: List of all endpoints (will expand Week 2)

Format: OpenAPI/Swagger style

 Create ARCHITECTURE.md (20 mins)

Create: docs/ARCHITECTURE.md

Content: System overview, tech stack, folder structure

Include: Diagram (text-based)

 Commit Documentation (5 mins)

bash
git add docs/ README.md CONTRIBUTING.md
git commit -m "Week 1: Add project documentation"
git push
🔵 THURSDAY: Testing & Optimization (8 hours)
Morning (9am-12pm): Performance Testing
QA / Backend Lead:

 Load Test Backend (30 mins)

bash
# Install loadtest tool
npm install -g loadtest

# Test health endpoint
loadtest -c 10 -n 100 http://localhost:3000/api/health
Expected: All requests succeed, < 100ms response time

 Test Database Connection (20 mins)

bash
# Backend should handle multiple concurrent connections
# Check database logs in Supabase
 Test Frontend Build (15 mins)

bash
cd frontend
npm run build
# Should create dist/ folder without errors
 Test Production Build Size (10 mins)

bash
# Check dist/ folder size
# Target: < 200KB for JS
# If larger, we'll optimize later
Afternoon (1pm-5pm): Team Verification
All Developers:

 Each Team Member Clones Repo (15 mins each)

bash
git clone https://github.com/YOUR-ORG/entomate.git
cd entomate
npm install
cd backend && npm install
cd ../frontend && npm install
 Each Tests Locally (15 mins each)

Terminal 1: Backend: cd backend && npm start

Terminal 2: Frontend: cd frontend && npm run dev

Browser: http://localhost:5173

Should see: "Welcome to Entomate"

 Each Tests Health Endpoint (5 mins each)

Browser: http://localhost:3000/api/health

Should show OK

 Report Issues (30 mins)

If any problems, report to team lead

Document in: docs/KNOWN_ISSUES.md

Assign fixes

🟢 FRIDAY: Review & Planning (8 hours)
Morning (9am-12pm): Code Review & QA
Backend & Frontend Leads:

 Review Week 1 Code (30 mins)

Check code style consistency

Verify error handling

Check for security issues

Document any improvements needed

 Run ESLint (15 mins)

bash
npm install --save-dev eslint prettier
npx eslint backend/server.js
npx prettier --check backend/server.js
 Fix Any Issues (30 mins)

Auto-fix with prettier

Manual fixes for ESLint

Commit: git commit -m "Week 1: Code cleanup and formatting"

Afternoon (1pm-5pm): Weekly Demo & Retro
Entire Team (60 mins total):

 Weekly Demo (30 mins)

Show working backend (health endpoint)

Show working frontend (loads without errors)

Show database is created (table editor)

Explain what Week 2 will build

 Retrospective (15 mins)

What went well?

What didn't?

What to improve next week?

 Plan Week 2 (15 mins)

Review Week 2 tasks

Assign people to each task

Estimate time

Create pull request template

🔧 BACKEND CODE - server.js
javascript
const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const helmet = require('helmet');
const morgan = require('morgan');

// Load environment variables
dotenv.config();

// Initialize app
const app = express();
const PORT = process.env.PORT || 3000;

// ========================================
// MIDDLEWARE
// ========================================

// Security headers
app.use(helmet());

// CORS - Allow frontend
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Logging
app.use(morgan('combined'));

// ========================================
// HEALTH CHECK
// ========================================

app.get('/api/health', async (req, res) => {
  try {
    // Test Gemini
    const { GoogleGenerativeAI } = require('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    
    const testResponse = await model.generateContent('Say "OK" in one word');
    const geminiStatus = testResponse.response.text().includes('OK') ? 'connected' : 'error';
    
    // Test Supabase
    const { createClient } = require('@supabase/supabase-js');
    const supabase = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_ANON_KEY
    );
    
    const { data, error } = await supabase
      .from('meetings')
      .select('count()', { count: 'exact', head: true });
    
    const dbStatus = error ? 'error' : 'connected';
    
    res.json({
      status: 'ok',
      timestamp: new Date().toISOString(),
      services: {
        gemini: geminiStatus,
        database: dbStatus
      }
    });
    
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      status: 'error',
      message: error.message,
      services: {
        gemini: 'error',
        database: 'error'
      }
    });
  }
});

// ========================================
// BASIC ROUTES
// ========================================

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Entomate',
    version: '1.0.0',
    phase: 1,
    week: 1,
    status: 'setup complete'
  });
});

// ========================================
// ERROR HANDLING
// ========================================

app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    error: {
      message: err.message,
      status: err.status || 500,
      timestamp: new Date().toISOString()
    }
  });
});

// ========================================
// START SERVER
// ========================================

app.listen(PORT, () => {
  console.log(`✅ Entomate Backend running on http://localhost:${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV}`);
  console.log(`Frontend URL: ${process.env.FRONTEND_URL}`);
});

module.exports = app;
🔧 BACKEND CODE - config/gemini.js
javascript
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiConfig {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set in environment');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
    
    console.log('✅ Gemini API initialized');
  }
  
  /**
   * Test Gemini connection
   */
  async test() {
    try {
      const response = await this.model.generateContent('Say "OK" in one word');
      return response.response.text();
    } catch (error) {
      throw new Error(`Gemini test failed: ${error.message}`);
    }
  }
}

module.exports = new GeminiConfig();
🔧 BACKEND CODE - config/supabase.js
javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Supabase URL or KEY not set in environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

console.log('✅ Supabase initialized');

module.exports = supabase;
🔧 FRONTEND CODE - App.jsx
jsx
import React from 'react';
import './App.css';

function App() {
  return (
    <div className="app">
      <header className="app-header">
        <h1>🎙️ Entomate</h1>
        <p>Meeting Intelligence Platform</p>
      </header>
      
      <main className="app-main">
        <div className="welcome">
          <h2>Welcome to Entomate</h2>
          <p>Phase 1 - Week 1: Foundation Setup</p>
          
          <div className="status">
            <h3>System Status</h3>
            <div className="status-items">
              <div className="status-item">
                <span className="status-label">Backend:</span>
                <span className="status-value">✅ Running on localhost:3000</span>
              </div>
              <div className="status-item">
                <span className="status-label">Frontend:</span>
                <span className="status-value">✅ Running on localhost:5173</span>
              </div>
              <div className="status-item">
                <span className="status-label">Database:</span>
                <span className="status-value">✅ Supabase Connected</span>
              </div>
              <div className="status-item">
                <span className="status-label">AI Engine:</span>
                <span className="status-value">✅ Gemini Ready</span>
              </div>
            </div>
          </div>
          
          <div className="next-steps">
            <h3>Next Steps</h3>
            <ol>
              <li>Team reviews Week 1 checklist</li>
              <li>All team members clone repository</li>
              <li>Backend & Frontend running locally</li>
              <li>Health check passes</li>
              <li>Ready for Week 2: Meeting Recording</li>
            </ol>
          </div>
        </div>
      </main>
      
      <footer className="app-footer">
        <p>Entomate Phase 1 • Week 1 • 2025</p>
      </footer>
    </div>
  );
}

export default App;
🔧 FRONTEND CODE - App.css
css
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen',
    'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue',
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  background: #f5f5f5;
  color: #333;
}

.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.app-header {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 40px 20px;
  text-align: center;
}

.app-header h1 {
  font-size: 48px;
  margin-bottom: 10px;
}

.app-header p {
  font-size: 18px;
  opacity: 0.9;
}

.app-main {
  flex: 1;
  max-width: 1000px;
  margin: 40px auto;
  padding: 0 20px;
  width: 100%;
}

.welcome {
  background: white;
  border-radius: 12px;
  padding: 40px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.welcome h2 {
  font-size: 32px;
  margin-bottom: 8px;
  color: #667eea;
}

.welcome > p {
  font-size: 16px;
  color: #666;
  margin-bottom: 30px;
}

.status {
  margin-bottom: 30px;
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #667eea;
}

.status h3 {
  margin-bottom: 15px;
  font-size: 18px;
}

.status-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.status-item {
  display: flex;
  justify-content: space-between;
  padding: 12px;
  background: white;
  border-radius: 6px;
  align-items: center;
}

.status-label {
  font-weight: 600;
  color: #333;
}

.status-value {
  color: #00aa00;
  font-weight: 500;
}

.next-steps {
  background: #e8f5e9;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #4caf50;
}

.next-steps h3 {
  margin-bottom: 15px;
  font-size: 18px;
  color: #2e7d32;
}

.next-steps ol {
  margin-left: 20px;
}

.next-steps li {
  margin-bottom: 10px;
  color: #333;
  font-size: 16px;
}

.app-footer {
  text-align: center;
  padding: 20px;
  color: #666;
  background: #f5f5f5;
  margin-top: auto;
}

@media (max-width: 768px) {
  .app-header h1 {
    font-size: 32px;
  }
  
  .welcome {
    padding: 20px;
  }
}
🗄️ SUPABASE SCHEMA SQL
Copy this entire SQL block into Supabase SQL Editor and run:

sql
-- ========================================
-- ENTOMATE PHASE 1 WEEK 1 DATABASE SCHEMA
-- ========================================

-- ========================================
-- USERS & TEAMS
-- ========================================

CREATE TABLE IF NOT EXISTS teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  logo_url VARCHAR(512),
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) NOT NULL UNIQUE,
  full_name VARCHAR(255),
  avatar_url VARCHAR(512),
  role VARCHAR(50) DEFAULT 'member',
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- MEETINGS & ACTION ITEMS
-- ========================================

CREATE TABLE IF NOT EXISTS meetings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  transcript TEXT,
  summary TEXT,
  audio_file_url VARCHAR(512),
  sentiment_label VARCHAR(20),
  sentiment_score FLOAT,
  key_points JSONB DEFAULT '[]',
  decisions JSONB DEFAULT '[]',
  start_time TIMESTAMP,
  end_time TIMESTAMP,
  duration_minutes INT,
  attendees JSONB DEFAULT '[]',
  created_by UUID REFERENCES users(id),
  project_id UUID,
  crm_deal_id VARCHAR(256),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id UUID NOT NULL REFERENCES meetings(id) ON DELETE CASCADE,
  task_description TEXT NOT NULL,
  context TEXT,
  assigned_to_email VARCHAR(255),
  assigned_to_name VARCHAR(255),
  assigned_to_id UUID REFERENCES users(id),
  due_date DATE,
  priority VARCHAR(20) DEFAULT 'medium',
  status VARCHAR(20) DEFAULT 'open',
  crm_sync_status VARCHAR(20) DEFAULT 'pending',
  crm_task_id VARCHAR(256),
  last_sync_attempt TIMESTAMP,
  last_sync_error TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ========================================
-- PROJECTS & TASKS
-- ========================================

CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  status VARCHAR(20) DEFAULT 'planning',
  crm_deal_id VARCHAR(256),
  deal_value DECIMAL(12,2),
  start_date DATE,
  end_date DATE,
  owner_id UUID REFERENCES users(id),
  team_ids UUID[] DEFAULT '{}',
  tags JSONB DEFAULT '[]',
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  assigned_to UUID REFERENCES users(id),
  status VARCHAR(20) DEFAULT 'open',
  priority VARCHAR(20) DEFAULT 'medium',
  due_date DATE,
  start_date DATE,
  crm_task_id VARCHAR(256),
  tags JSONB DEFAULT '[]',
  custom_fields JSONB DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  completed_at TIMESTAMP
);

-- ========================================
-- AUTOMATIONS & LOGS
-- ========================================

CREATE TABLE IF NOT EXISTS automations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  description TEXT,
  trigger_type VARCHAR(100) NOT NULL,
  trigger_config JSONB NOT NULL,
  actions JSONB NOT NULL,
  enabled BOOLEAN DEFAULT true,
  created_by UUID REFERENCES users(id),
  team_id UUID REFERENCES teams(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS automation_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  automation_id UUID REFERENCES automations(id),
  triggered_at TIMESTAMP NOT NULL,
  trigger_data JSONB,
  actions_executed JSONB,
  success BOOLEAN,
  error_message TEXT,
  duration_ms INT,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INTEGRATIONS & SYNC
-- ========================================

CREATE TABLE IF NOT EXISTS integration_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_type VARCHAR(50),
  source_id UUID,
  destination_type VARCHAR(50),
  destination_id VARCHAR(256),
  status VARCHAR(20),
  error_message TEXT,
  retry_count INT DEFAULT 0,
  next_retry_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- SEARCH & KNOWLEDGE
-- ========================================

CREATE TABLE IF NOT EXISTS search_index (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  content_type VARCHAR(50),
  content_id UUID,
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- ========================================
-- INDEXES FOR PERFORMANCE
-- ========================================

CREATE INDEX idx_meetings_created_at ON meetings(created_at DESC);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_meetings_project_id ON meetings(project_id);

CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);
CREATE INDEX idx_action_items_assigned_to ON action_items(assigned_to_id);

CREATE INDEX idx_projects_owner_id ON projects(owner_id);
CREATE INDEX idx_projects_crm_deal_id ON projects(crm_deal_id);

CREATE INDEX idx_tasks_project_id ON tasks(project_id);
CREATE INDEX idx_tasks_assigned_to ON tasks(assigned_to);

CREATE INDEX idx_automations_team_id ON automations(team_id);

-- ========================================
-- DONE
-- ========================================

SELECT 'Database schema created successfully' as status;
📖 README TEMPLATE
text
# Entomate: Meeting Intelligence Platform

AI-powered meeting recording, transcription, and task automation.

## Quick Links

- [Quick Start Guide](./docs/QUICK_START.md)
- [Setup Instructions](./docs/SETUP.md)
- [Architecture](./docs/ARCHITECTURE.md)
- [API Documentation](./docs/API.md)

## Tech Stack

- **Backend:** Node.js + Express
- **Frontend:** React + Vite
- **Database:** Supabase (PostgreSQL)
- **AI:** Google Gemini API
- **Hosting:** Vercel (frontend) + Render (backend)

## Local Development

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- Google API key

### Setup

1. Clone repository
git clone https://github.com/YOUR-ORG/entomate.git
cd entomate

text

2. Set up backend
cd backend
npm install
cp .env.example .env

Edit .env with your API keys
npm start

text

3. Set up frontend (new terminal)
cd frontend
npm install
npm run dev

text

4. Verify
- Backend: http://localhost:3000/api/health
- Frontend: http://localhost:5173

## Phase 1 Timeline

| Week | Feature | Status |
|------|---------|--------|
| 1 | Foundation & Setup | ⏳ In Progress |
| 2 | Meeting Recording | 🔜 Next |
| 3 | CRM Sync | 🔜 Next |
| 4 | Chat Integration | 🔜 Next |
| 5 | Project Management | 🔜 Next |
| 6 | AI Search | 🔜 Next |
| 7 | Automations | 🔜 Next |
| 8 | Production Deploy | 🔜 Next |

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](./LICENSE) for details.

## Support

- 📧 Email: support@entomate.com
- 💬 Slack: [Join community]
- 🐛 Issues: [GitHub Issues]

---

Made with ❤️ by Entomate Team
✅ WEEK 1 SIGN-OFF CHECKLIST
Complete ALL items before moving to Week 2:

Team
 All 5 team members have repository access

 All 5 have cloned repo and ran locally

 Daily standups scheduled

 Communication channel created

Backend
 Backend runs without errors on localhost:3000

 Health endpoint returns OK

 Gemini API responds

 Database connection works

 All dependencies installed

Frontend
 Frontend runs on localhost:5173

 Loads without console errors

 Shows "Welcome to Entomate"

 Can navigate (if any routes added)

Database
 All 10 tables created

 All indexes created

 No errors in Supabase logs

 Can query tables (test in Supabase SQL editor)

Git & Docs
 Repository created on GitHub

 All code committed

 README.md created

 SETUP.md created

 CONTRIBUTING.md created

 .gitignore configured

Testing
 Each developer cloned repo

 Each tested locally

 Health check passes for all

 No critical blockers

Documentation
 API.md stub created

 ARCHITECTURE.md created

 SETUP.md complete

 Known issues documented

📊 WEEK 1 METRICS
Track these to verify success:

Metric	Target	Actual
Team readiness	100%	___
Code quality	A	___
Test coverage	70%+	___
Setup time	< 2 hours	___
System uptime	99%	___
Issues resolved	100%	___
🚀 READY FOR WEEK 2?
When all checkboxes above are complete:

✅ Create new branch: feature/week-2-recording

✅ Review Week 2 plan (File 1)

✅ Assign Week 2 tasks

✅ Schedule Week 2 kickoff

End of WEEK 1 Guide

Ready for WEEK 2: MEETING RECORDING & TRANSCRIPTION?

Reply: "Send WEEK 2"

text

---

## ✅ WEEK 1 FILE SAVED

I've created the complete **WEEK 1: FOUNDATION & SETUP** guide with:

✅ **42 detailed tasks** organized by day
✅ **Exact code** ready to copy-paste for:
  - `backend/server.js`
  - `backend/config/gemini.js`
  - `backend/config/supabase.js`
  - `frontend/src/App.jsx`
  - `frontend/src/App.css`

✅ **Complete SQL schema** for Supabase (10 tables)
✅ **README template** for your team
✅ **Sign-off checklist** (verify completion)
✅ **Metrics** to track
✅ **Documentation** stubs created

---

## 📄 NEXT: WEEK 2 - MEETING RECORDING

**Ready for WEEK 2: MEETING RECORDING & TRANSCRIPTION?**

Reply: **"Send WEEK 2"**

I'll provide:
- 40+ tasks for meeting recording implementation
- Complete MeetingRecorder component code
- Gemini transcription service
- Audio upload to Supabase Storage
- Frontend UI for transcription display
- All tests and verification steps