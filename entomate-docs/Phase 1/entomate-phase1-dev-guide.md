text
# Entomate Phase 1: Complete Development Guide

**For Claude Code & Gemini Studio Builders (With No-Code References)**

**Status:** Ready for Implementation  
**Duration:** 8 Weeks  
**Updated:** December 15, 2025

---

## TABLE OF CONTENTS

1. [Week-by-Week Breakdown](#week-by-week-breakdown)
2. [Technical Architecture](#technical-architecture)
3. [Gemini Studio Prompts](#gemini-studio-prompts)
4. [Claude Code Implementations](#claude-code-implementations)
5. [API Integration Guides](#api-integration-guides)
6. [Testing Checklist](#testing-checklist)

---

## WEEK-BY-WEEK BREAKDOWN

### WEEK 1: Foundation & Gemini API Setup

#### **Day 1-2: Project Setup (Do This First)**

**What to Build:**
- Backend project structure
- Environment configuration
- Gemini API key setup
- Database initialization

**Gemini Studio Task (For You - Non-Dev):**
- Go to [aistudio.google.com](https://aistudio.google.com)
- Create free API key (saves instantly)
- Test basic prompt: "Summarize this: [paste meeting transcript]"

**Claude Code Task (For Backend Dev):**

// File: config/gemini.js
// This is what your backend needs to communicate with Gemini

const GEMINI_CONFIG = {
apiKey: process.env.GEMINI_API_KEY,
model: 'gemini-2.5-flash',
apiEndpoint: 'https://generativelanguage.googleapis.com/v1beta',
requestTimeout: 30000,
maxRetries: 3,
retryDelay: 1000,
};

// Initialize Gemini Client
const { GoogleGenerativeAI } = require('@google/generative-ai');
const genAI = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
const model = genAI.getGenerativeModel({ model: GEMINI_CONFIG.model });

module.exports = { model, GEMINI_CONFIG };

text

**Database Setup (PostgreSQL):**

-- Create meetings table
CREATE TABLE meetings (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
title VARCHAR(255) NOT NULL,
description TEXT,
transcript TEXT,
summary TEXT,
sentiment_score FLOAT,
sentiment_label VARCHAR(20),
audio_file_url VARCHAR(512),
start_time TIMESTAMP,
end_time TIMESTAMP,
duration_minutes INT,
attendees JSONB DEFAULT '[]',
created_by UUID,
created_at TIMESTAMP DEFAULT NOW(),
updated_at TIMESTAMP DEFAULT NOW()
);

-- Create action items table
CREATE TABLE action_items (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
meeting_id UUID REFERENCES meetings(id) ON DELETE CASCADE,
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

-- Create indexes for performance
CREATE INDEX idx_meetings_created_at ON meetings(created_at);
CREATE INDEX idx_meetings_created_by ON meetings(created_by);
CREATE INDEX idx_action_items_meeting ON action_items(meeting_id);
CREATE INDEX idx_action_items_status ON action_items(status);

text

**Deliverable:** Project runs, Gemini API responds to test prompts

---

#### **Day 3-4: Gemini Prompts Testing**

**Gemini Studio: Test These Prompts**

**Prompt 1: Meeting Summarization**
You are an intelligent meeting summarizer for a business platform.

Your task: Read a meeting transcript and create a structured summary.

OUTPUT FORMAT:
MEETING OVERVIEW

Duration: [X minutes]

Attendees: [names]

Main Topic: [one sentence]

KEY DISCUSSION POINTS

Point 1

Point 2

Point 3

DECISIONS MADE

Decision 1

Decision 2

SENTIMENT

Overall: [Positive/Neutral/Negative]

Key moments: [if any]

ACTION ITEMS (extract below)

text

**Test with this transcript:**
Speaker: Sarah
Time: 0:00
We need to finalize the proposal for the Acme Corp deal. It's worth $500K.

Speaker: Mike
Time: 1:30
I'll have the technical specs ready by Friday. That's the main blocker.

Speaker: Sarah
Time: 3:00
Perfect. Mike, you own the technical doc. I'll handle the pricing section.
We need to send this to the customer by Monday.

Speaker: Lisa
Time: 4:45
I'll coordinate the final review. Let's all sync on Sunday evening to review.

Speaker: Sarah
Time: 6:00
Great. So: Mike - technical by Friday, me - pricing by Friday, Lisa - coordination.
Review on Sunday. Send Monday.

text

**Expected Output Example:**
MEETING OVERVIEW

Duration: 6 minutes

Attendees: Sarah, Mike, Lisa

Main Topic: Acme Corp $500K proposal finalization

KEY DISCUSSION POINTS

Proposal worth $500K for Acme Corp

Technical specs are main blocker (due Friday)

Three-section approach: technical, pricing, coordination

Sunday evening review meeting planned

Monday deadline for customer delivery

DECISIONS MADE

Mike owns technical specification section

Sarah owns pricing section

Lisa coordinates final review

Final submission to customer Monday

SENTIMENT

Overall: Positive

Team aligned and clear on next steps

ACTION ITEMS:

Prepare technical specs - Mike - Friday

Draft pricing section - Sarah - Friday

Coordinate final review - Lisa - Friday

Sync review meeting - All - Sunday 6PM

Send proposal to customer - Sarah - Monday

text

**Save this prompt template** - you'll use it in Claude Code.

---

**Prompt 2: Action Item Extraction**
You are an action item extraction specialist.

Extract action items from this meeting transcript.

For EACH action item, identify:

TASK: What needs to be done

OWNER: Who is responsible (name and email if available)

DUE_DATE: When it's due

PRIORITY: High/Medium/Low (based on impact and deadline urgency)

DESCRIPTION: 2-3 sentence detail

OUTPUT AS JSON:
{
"action_items": [
{
"task": "...",
"owner": "...",
"owner_email": "...",
"due_date": "...",
"priority": "...",
"description": "..."
}
]
}

RULES:

Only extract items with clear ownership

If no date mentioned, infer from context

If owner not mentioned, leave empty

Priority should be High if deadline < 3 days, Medium if < 1 week, Low otherwise

text

**Test with the same transcript above.**

**Save this prompt** - you'll use it in Claude Code.

---

**Prompt 3: Sentiment Analysis**
Analyze the meeting transcript for sentiment and tone.

OUTPUT JSON:
{
"overall_sentiment": "Positive|Neutral|Negative",
"confidence": 0.95,
"tone_description": "The team is aligned and moving forward with confidence",
"key_moments": [
{
"time": "1:30",
"speaker": "Mike",
"sentiment": "Positive",
"reason": "Clear ownership and commitment"
}
],
"risk_indicators": [],
"recommendations": "Team is well-organized. Ensure Sunday review happens as planned."
}

text

---

#### **Day 5: Deliverables & Testing**

**Checklist:**
- [ ] PostgreSQL database created and tested
- [ ] Gemini API key working (test in AI Studio)
- [ ] All 3 prompts tested and refined
- [ ] Backend can call Gemini API
- [ ] Meeting transcript successfully summarized
- [ ] Action items extracted as JSON
- [ ] Sentiment analysis working

**What you should have by end of Week 1:**
- Running Node.js/Python backend
- Connected to PostgreSQL
- Connected to Gemini API
- 3 core prompts ready to use
- Can process a test meeting transcript end-to-end

---

### WEEK 2: Frontend UI & Meeting Recorder

#### **Day 1-2: Gemini Studio - Design Meeting Recorder UI**

**Gemini Studio Prompt to Use:**

You are a UX/UI designer creating a meeting recorder interface.

Design specifications:

Minimalist, modern interface

Color scheme: Teal (#00A86B) + white + light gray

Desktop first, mobile responsive

SCREEN COMPONENTS:

Top bar: "Start Recording" button (prominent, teal)

Meeting details form:

Title field (auto-fill option from calendar)

Attendees list (multi-select)

Calendar integration (show current meeting)

Recording status:

Live indicator when recording

Duration counter

Pause/Resume buttons

Stop recording button

Meeting transcript live display:

Real-time speaker changes

Timestamp updates

Speaker identification

DESIGN REQUIREMENTS:

Recording controls always accessible (sticky header)

Transcript scrolls while recording continues

Visual feedback for active speakers

Professional appearance (enterprise software)

Create a wireframe showing desktop layout with labels.

text

**What You'll Get:**
UI wireframe showing the layout for your developers

---

#### **Day 3-4: Claude Code - Build Meeting Recorder Component**

**Frontend Component (React/Vue):**

// File: components/MeetingRecorder.jsx
// This is what users see and interact with

import React, { useState, useRef, useEffect } from 'react';

const MeetingRecorder = () => {
const [isRecording, setIsRecording] = useState(false);
const [duration, setDuration] = useState(0);
const [transcript, setTranscript] = useState('');
const [meetingTitle, setMeetingTitle] = useState('');
const [attendees, setAttendees] = useState([]);
const mediaRecorder = useRef(null);
const audioChunks = useRef([]);

// Start recording
const startRecording = async () => {
try {
const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
mediaRecorder.current = new MediaRecorder(stream);

text
  mediaRecorder.current.ondataavailable = (event) => {
    audioChunks.current.push(event.data);
  };

  mediaRecorder.current.onstop = () => {
    processRecording();
  };

  mediaRecorder.current.start();
  setIsRecording(true);
  startTimer();
} catch (error) {
  console.error('Error accessing microphone:', error);
}
};

// Stop recording
const stopRecording = () => {
if (mediaRecorder.current) {
mediaRecorder.current.stop();
setIsRecording(false);
}
};

// Timer for duration
const startTimer = () => {
const interval = setInterval(() => {
setDuration((prev) => prev + 1);
}, 1000);
return () => clearInterval(interval);
};

// Process the recording
const processRecording = async () => {
const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
audioChunks.current = [];

text
// Send to backend for Gemini processing
const formData = new FormData();
formData.append('audio', audioBlob);
formData.append('meeting_title', meetingTitle);
formData.append('attendees', JSON.stringify(attendees));

try {
  const response = await fetch('/api/meetings/process', {
    method: 'POST',
    body: formData,
  });
  
  const result = await response.json();
  console.log('Meeting processed:', result);
  // Show results to user
} catch (error) {
  console.error('Error processing recording:', error);
}
};

return (
<div className="meeting-recorder">
<div className="recorder-header">
<h2>Meeting Recorder</h2>
<button
onClick={isRecording ? stopRecording : startRecording}
className={record-btn ${isRecording ? 'recording' : ''}}
>
{isRecording ? '⏹ Stop Recording' : '🎤 Start Recording'}
</button>
</div>

text
  <div className="meeting-details">
    <input
      type="text"
      placeholder="Meeting Title"
      value={meetingTitle}
      onChange={(e) => setMeetingTitle(e.target.value)}
    />
    <input
      type="text"
      placeholder="Attendees (comma separated)"
      onChange={(e) => setAttendees(e.target.value.split(','))}
    />
  </div>

  {isRecording && (
    <div className="recording-status">
      <div className="live-indicator">🔴 LIVE</div>
      <div className="duration">{Math.floor(duration / 60)}:{String(duration % 60).padStart(2, '0')}</div>
    </div>
  )}

  <div className="transcript-display">
    <h3>Live Transcript</h3>
    <div className="transcript-content">
      {transcript || 'Transcript will appear here...'}
    </div>
  </div>
</div>
);
};

export default MeetingRecorder;

text

**CSS (Minimalist Design):**

/* File: styles/MeetingRecorder.css */

.meeting-recorder {
max-width: 1000px;
margin: 20px auto;
background: white;
border-radius: 8px;
box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
padding: 24px;
}

.recorder-header {
display: flex;
justify-content: space-between;
align-items: center;
margin-bottom: 24px;
border-bottom: 1px solid #e8e8e8;
padding-bottom: 16px;
}

.record-btn {
background: #00A86B;
color: white;
border: none;
padding: 12px 24px;
border-radius: 6px;
font-size: 16px;
font-weight: 600;
cursor: pointer;
transition: background 0.3s ease;
}

.record-btn:hover {
background: #008F5A;
}

.record-btn.recording {
background: #ff4444;
animation: pulse 1s infinite;
}

@keyframes pulse {
0%, 100% { opacity: 1; }
50% { opacity: 0.7; }
}

.meeting-details {
display: grid;
grid-template-columns: 1fr 1fr;
gap: 16px;
margin-bottom: 24px;
}

.meeting-details input {
padding: 12px;
border: 1px solid #ddd;
border-radius: 6px;
font-size: 14px;
}

.recording-status {
display: flex;
gap: 16px;
align-items: center;
background: #fff0f0;
padding: 16px;
border-radius: 6px;
margin-bottom: 24px;
}

.live-indicator {
font-size: 14px;
font-weight: 600;
color: #ff4444;
}

.duration {
font-size: 24px;
font-weight: 600;
font-family: 'Courier New', monospace;
color: #1a1a1a;
min-width: 80px;
}

.transcript-display {
background: #f5f5f5;
padding: 16px;
border-radius: 6px;
}

.transcript-display h3 {
margin: 0 0 12px 0;
font-size: 14px;
color: #666;
text-transform: uppercase;
letter-spacing: 0.5px;
}

.transcript-content {
font-family: 'Courier New', monospace;
font-size: 14px;
line-height: 1.6;
color: #333;
min-height: 200px;
max-height: 400px;
overflow-y: auto;
white-space: pre-wrap;
word-break: break-word;
}

text

**Deliverable:** Meeting recorder UI complete, audio can be recorded

---

#### **Day 5: Backend Meeting Processing**

**Backend API Endpoint:**

// File: routes/meetings.js

const express = require('express');
const { model } = require('../config/gemini');
const { Pool } = require('pg');

const router = express.Router();
const pool = new Pool();

// POST /api/meetings/process
// This endpoint receives audio, sends to Gemini, stores results
router.post('/meetings/process', async (req, res) => {
try {
const { meeting_title, attendees } = req.body;
const audioFile = req.files.audio;

text
// Step 1: Convert audio to text using Gemini
console.log('🎤 Transcribing audio with Gemini...');

const audioData = audioFile.data.toString('base64');
const transcriptResponse = await model.generateContent([
  {
    inlineData: {
      data: audioData,
      mimeType: 'audio/wav',
    },
  },
  'Please transcribe this audio with speaker names and timestamps. Format: Speaker: [name] Time: [MM:SS] [speech]',
]);

const transcript = transcriptResponse.response.text();
console.log('✅ Transcription complete');

// Step 2: Summarize using Gemini
console.log('📝 Generating summary...');

const summaryPrompt = `
You are a meeting summarizer. Create a structured summary:

TRANSCRIPT:
${transcript}

OUTPUT as JSON:
{
  "summary": "...",
  "key_points": [...],
  "decisions": [...],
  "sentiment": "Positive|Neutral|Negative"
}`;

const summaryResponse = await model.generateContent(summaryPrompt);
const summaryJSON = JSON.parse(summaryResponse.response.text());
console.log('✅ Summary complete');

// Step 3: Extract action items using Gemini
console.log('✓ Extracting action items...');

const actionItemsPrompt = `
Extract action items from this transcript. Return JSON.

TRANSCRIPT:
${transcript}

Return JSON with array of action items with: task, owner, due_date, priority`;

const actionResponse = await model.generateContent(actionItemsPrompt);
const actionJSON = JSON.parse(actionResponse.response.text());
console.log('✅ Action items extracted');

// Step 4: Store everything in database
console.log('💾 Storing in database...');

const meetingResult = await pool.query(
  `INSERT INTO meetings (title, transcript, summary, sentiment_label, attendees, created_at)
   VALUES ($1, $2, $3, $4, $5, NOW())
   RETURNING id`,
  [
    meeting_title,
    transcript,
    summaryJSON.summary,
    summaryJSON.sentiment,
    JSON.stringify(attendees),
  ]
);

const meetingId = meetingResult.rows.id;

// Store action items
for (const item of actionJSON.action_items) {
  await pool.query(
    `INSERT INTO action_items 
     (meeting_id, task_description, assigned_to_name, due_date, priority)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      meetingId,
      item.task,
      item.owner,
      item.due_date,
      item.priority,
    ]
  );
}

console.log('✅ All data stored');

// Return results to frontend
res.json({
  success: true,
  meeting: {
    id: meetingId,
    title: meeting_title,
    summary: summaryJSON.summary,
    key_points: summaryJSON.key_points,
    decisions: summaryJSON.decisions,
    sentiment: summaryJSON.sentiment,
    action_items: actionJSON.action_items,
  },
});
} catch (error) {
console.error('Error processing meeting:', error);
res.status(500).json({ error: 'Failed to process meeting' });
}
});

module.exports = router;

text

**Deliverable:** Meeting audio → Gemini processing → Database storage working

---

### WEEK 3: Action Items & CRM Sync

#### **Day 1-2: Action Items Display**

**Frontend Component:**

// File: components/ActionItemsList.jsx

import React, { useState, useEffect } from 'react';

const ActionItemsList = ({ meetingId }) => {
const [items, setItems] = useState([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
fetchActionItems();
}, [meetingId]);

const fetchActionItems = async () => {
try {
const response = await fetch(/api/action-items?meeting_id=${meetingId});
const data = await response.json();
setItems(data.action_items);
setLoading(false);
} catch (error) {
console.error('Error fetching action items:', error);
setLoading(false);
}
};

const getPriorityColor = (priority) => {
const colors = {
high: '#ff4444',
medium: '#ff9900',
low: '#00a86b',
};
return colors[priority.toLowerCase()] || '#666';
};

if (loading) return <div>Loading...</div>;

return (
<div className="action-items-list">
<h2>Action Items</h2>
{items.length === 0 ? (
<p>No action items</p>
) : (
<ul className="items">
{items.map((item) => (
<li key={item.id} className="item">
<div className="item-header">
<h3>{item.task_description}</h3>
<span
className="priority-badge"
style={{ background: getPriorityColor(item.priority) }}
>
{item.priority}
</span>
</div>
<div className="item-details">
<p><strong>Owner:</strong> {item.assigned_to_name}</p>
<p><strong>Due:</strong> {new Date(item.due_date).toLocaleDateString()}</p>
<p><strong>Status:</strong> {item.status}</p>
</div>
</li>
))}
</ul>
)}
</div>
);
};

export default ActionItemsList;

text

---

#### **Day 3-4: Logos Vision CRM Sync**

**Research Your Logos Vision API:**

Before coding, get from Logos Vision team:
- API endpoint base URL
- Authentication method (API key, OAuth, etc.)
- Task creation endpoint format
- Supported fields (title, description, assignee, due date, custom fields)

**Backend CRM Sync Service:**

// File: services/crmSync.js

const axios = require('axios');

const LOGOS_VISION_API = process.env.LOGOS_VISION_API_URL;
const LOGOS_VISION_API_KEY = process.env.LOGOS_VISION_API_KEY;

// Sync action items to Logos Vision CRM
const syncActionItemsToCRM = async (actionItems, meetingId) => {
console.log(📤 Syncing ${actionItems.length} action items to Logos Vision CRM...);

try {
for (const item of actionItems) {
const crmPayload = {
title: item.task_description,
description: Auto-created from meeting on ${new Date().toLocaleDateString()},
assigned_to: item.assigned_to_email, // Need to get email, not just name
due_date: item.due_date,
priority: item.priority.toUpperCase(),
custom_fields: {
source: 'entomate',
meeting_id: meetingId,
},
};

text
  try {
    const response = await axios.post(
      `${LOGOS_VISION_API}/tasks`,
      crmPayload,
      {
        headers: {
          'Authorization': `Bearer ${LOGOS_VISION_API_KEY}`,
          'Content-Type': 'application/json',
        },
      }
    );

    // Update database with CRM sync status
    await updateActionItemCRMStatus(item.id, 'synced', response.data.id);
    console.log(`✅ Synced item: ${item.task_description}`);
  } catch (error) {
    console.error(`❌ Failed to sync item: ${item.task_description}`, error);
    await updateActionItemCRMStatus(item.id, 'failed', null);
  }
}
} catch (error) {
console.error('Error in CRM sync:', error);
}
};

// Update sync status in database
const updateActionItemCRMStatus = async (actionItemId, status, crmTaskId) => {
const pool = require('../config/db');
await pool.query(
UPDATE action_items SET crm_sync_status = $1, crm_task_id = $2, updated_at = NOW() WHERE id = $3,
[status, crmTaskId, actionItemId]
);
};

module.exports = { syncActionItemsToCRM };

text

**Call the sync function after action items are created:**

// In your meeting processing endpoint, after saving action items:

const { syncActionItemsToCRM } = require('../services/crmSync');

// ... after storing action items ...

// Sync to CRM
await syncActionItemsToCRM(actionJSON.action_items, meetingId);

text

**Deliverable:** Action items sync to Logos Vision CRM automatically

---

#### **Day 5: Testing & Troubleshooting**

**Test Checklist:**
- [ ] Meeting recorded successfully
- [ ] Transcript generated with Gemini
- [ ] Action items extracted correctly
- [ ] Action items appear in UI
- [ ] Action items sync to Logos Vision
- [ ] CRM shows new tasks with correct details

**Common Issues:**
- If CRM sync fails: Check API key and endpoint
- If action items not extracted: Improve the extraction prompt
- If missing owner email: Update attendee tracking

---

### WEEK 4: Pulse Chat Integration

#### **Day 1-2: Get Pulse API Details**

**From your Pulse team, collect:**
- Chat API endpoint
- Authentication method
- Message creation format
- Channel structure
- User identification method

**Pulse Integration Service:**

// File: services/pulseIntegration.js

const axios = require('axios');

const PULSE_API = process.env.PULSE_API_URL;
const PULSE_API_KEY = process.env.PULSE_API_KEY;

const postMeetingSummaryToPulse = async (meeting, actionItems, channelId) => {
console.log(💬 Posting meeting summary to Pulse channel: ${channelId});

try {
// Format the message
const actionItemsList = actionItems
.map(item => - **${item.task_description}** - ${item.assigned_to_name} (Due: ${item.due_date}))
.join('\n');

text
const message = `
📋 Meeting Summary: ${meeting.title}

📝 Summary:
${meeting.summary}

🎯 Key Decisions:
${meeting.decisions.map(d => - ${d}).join('\n')}

✅ Action Items:
${actionItemsList}

😊 Sentiment: ${meeting.sentiment}

🔗 View Full Meeting
`;

text
// Post to Pulse
const response = await axios.post(
  `${PULSE_API}/channels/${channelId}/messages`,
  {
    text: message,
    type: 'meeting_summary',
    meeting_id: meeting.id,
  },
  {
    headers: {
      'Authorization': `Bearer ${PULSE_API_KEY}`,
      'Content-Type': 'application/json',
    },
  }
);

console.log('✅ Posted to Pulse');
return response.data;
} catch (error) {
console.error('Error posting to Pulse:', error);
}
};

const notifyAssigneesInPulse = async (actionItem) => {
console.log(💬 Notifying ${actionItem.assigned_to_name} in Pulse...);

try {
const message = `
👋 New Action Item Assigned

Task: ${actionItem.task_description}
Due: ${actionItem.due_date}
Priority: ${actionItem.priority}

View in Entomate
`;

text
// This would notify the individual, method depends on Pulse structure
// Could be DM, channel tag, or notification

console.log('✅ Notified assignee');
} catch (error) {
console.error('Error notifying assignee:', error);
}
};

module.exports = { postMeetingSummaryToPulse, notifyAssigneesInPulse };

text

**Call after meeting is processed:**

// In meeting processing endpoint:

const { postMeetingSummaryToPulse, notifyAssigneesInPulse } = require('../services/pulseIntegration');

// Determine channel (might come from meeting.channel_id or could be 'sales' for sales meetings)
const channelId = req.body.pulse_channel_id || 'general';

// Post summary
await postMeetingSummaryToPulse(meeting, actionJSON.action_items, channelId);

// Notify assignees
for (const item of actionJSON.action_items) {
await notifyAssigneesInPulse(item);
}

text

**Deliverable:** Meeting summaries post to Pulse, team notified

---

### WEEK 5: Project Management Foundation

#### **Days 1-3: Project CRUD (Create, Read, Update, Delete)**

**Backend API:**

// File: routes/projects.js

const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool();

// GET all projects
router.get('/', async (req, res) => {
try {
const result = await pool.query('SELECT * FROM projects ORDER BY created_at DESC');
res.json({ projects: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

// POST create project
router.post('/', async (req, res) => {
const { name, description, crm_deal_id, deal_value, owner_id, team_ids } = req.body;

try {
const result = await pool.query(
INSERT INTO projects (name, description, crm_deal_id, deal_value, owner_id, team_ids, status) VALUES ($1, $2, $3, $4, $5, $6, 'active') RETURNING *,
[name, description, crm_deal_id, deal_value, owner_id, team_ids]
);

text
res.json({ project: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

// GET single project
router.get('/:id', async (req, res) => {
try {
const result = await pool.query('SELECT * FROM projects WHERE id = $1', [req.params.id]);
res.json({ project: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

// PUT update project
router.put('/:id', async (req, res) => {
const { name, description, status, end_date } = req.body;

try {
const result = await pool.query(
UPDATE projects SET name = $1, description = $2, status = $3, end_date = $4, updated_at = NOW() WHERE id = $5 RETURNING *,
[name, description, status, end_date, req.params.id]
);

text
res.json({ project: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

module.exports = router;

text

**Frontend Component:**

// File: components/ProjectDashboard.jsx

import React, { useState, useEffect } from 'react';

const ProjectDashboard = () => {
const [projects, setProjects] = useState([]);
const [showForm, setShowForm] = useState(false);

useEffect(() => {
fetchProjects();
}, []);

const fetchProjects = async () => {
try {
const response = await fetch('/api/projects');
const data = await response.json();
setProjects(data.projects);
} catch (error) {
console.error('Error fetching projects:', error);
}
};

const createProject = async (formData) => {
try {
const response = await fetch('/api/projects', {
method: 'POST',
headers: { 'Content-Type': 'application/json' },
body: JSON.stringify(formData),
});

text
  const data = await response.json();
  setProjects([...projects, data.project]);
  setShowForm(false);
} catch (error) {
  console.error('Error creating project:', error);
}
};

return (
<div className="project-dashboard">
<div className="header">
<h1>Projects</h1>
<button onClick={() => setShowForm(!showForm)}>+ New Project</button>
</div>

text
  {showForm && <ProjectForm onSubmit={createProject} />}

  <div className="projects-grid">
    {projects.map(project => (
      <ProjectCard key={project.id} project={project} />
    ))}
  </div>
</div>
);
};

export default ProjectDashboard;

text

**Deliverable:** Can create and view projects

---

#### **Days 4-5: Tasks Within Projects**

**Database addition:**

CREATE TABLE tasks (
id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
title VARCHAR(255) NOT NULL,
description TEXT,
assigned_to UUID,
status VARCHAR(20) DEFAULT 'todo',
priority VARCHAR(20) DEFAULT 'medium',
due_date DATE,
created_at TIMESTAMP DEFAULT NOW()
);

text

**Task API:**

// File: routes/tasks.js

const express = require('express');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool();

// GET tasks for project
router.get('/project/:projectId', async (req, res) => {
try {
const result = await pool.query(
'SELECT * FROM tasks WHERE project_id = $1 ORDER BY created_at DESC',
[req.params.projectId]
);
res.json({ tasks: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

// POST create task
router.post('/', async (req, res) => {
const { project_id, title, description, assigned_to, due_date, priority } = req.body;

try {
const result = await pool.query(
INSERT INTO tasks (project_id, title, description, assigned_to, due_date, priority) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *,
[project_id, title, description, assigned_to, due_date, priority]
);

text
res.json({ task: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

// PUT update task status
router.put('/:id', async (req, res) => {
const { status, assigned_to } = req.body;

try {
const result = await pool.query(
UPDATE tasks SET status = $1, assigned_to = $2, updated_at = NOW() WHERE id = $3 RETURNING *,
[status, assigned_to, req.params.id]
);

text
res.json({ task: result.rows });
} catch (error) {
res.status(500).json({ error: error.message });
}
});

module.exports = router;

text

**Deliverable:** Projects have tasks, can update status

---

### WEEK 6: Ask Assistant (Q&A Feature)

#### **Days 1-3: Semantic Search Setup**

**Vector Database:**

You need a vector database. Options:
- **Pinecone** (cloud, easy)
- **Weaviate** (open source)
- **pgvector** (PostgreSQL extension, easiest)

**Using pgvector (simplest):**

-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Add to meetings table
ALTER TABLE meetings ADD COLUMN embedding vector(768);

-- Create index for faster search
CREATE INDEX ON meetings USING ivfflat (embedding vector_cosine_ops)
WITH (lists = 100);

text

**Service to embed meetings:**

// File: services/embedding.js

const { model } = require('../config/gemini');

const embedText = async (text) => {
try {
const result = await model.embedContent(text);
return result.embedding.values; // Returns array of 768 numbers
} catch (error) {
console.error('Error embedding:', error);
return null;
}
};

const storeMeetingEmbedding = async (meetingId, text) => {
const pool = require('../config/db');
const embedding = await embedText(text);

if (embedding) {
await pool.query(
'UPDATE meetings SET embedding = $1 WHERE id = $2',
[JSON.stringify(embedding), meetingId]
);
}
};

module.exports = { embedText, storeMeetingEmbedding };

text

---

#### **Days 4-5: Ask Assistant Endpoint**

// File: routes/ask-assistant.js

const express = require('express');
const { model } = require('../config/gemini');
const { embedText } = require('../services/embedding');
const { Pool } = require('pg');
const router = express.Router();
const pool = new Pool();

// POST /ask-assistant
router.post('/', async (req, res) => {
const { question } = req.body;

try {
console.log(🤖 Answering: "${question}");

text
// Step 1: Embed the question
const questionEmbedding = await embedText(question);

// Step 2: Search for similar meetings
const searchResult = await pool.query(
  `SELECT id, title, summary, transcript 
   FROM meetings 
   ORDER BY embedding <-> $1 
   LIMIT 5`,
  [JSON.stringify(questionEmbedding)]
);

const relevantMeetings = searchResult.rows;

// Step 3: Build context
const context = relevantMeetings
  .map(m => `Meeting: "${m.title}"\nSummary: ${m.summary}`)
  .join('\n\n');

// Step 4: Ask Gemini using RAG (Retrieval-Augmented Generation)
const ragPrompt = `
You are an assistant answering questions about meetings.

CONTEXT FROM RELEVANT MEETINGS:
${context}

USER QUESTION: "${question}"

Answer the question using the context provided. If you don't find the answer, say "I couldn't find that information in your meetings."
`;

text
const answerResponse = await model.generateContent(ragPrompt);
const answer = answerResponse.response.text();

res.json({
  question,
  answer,
  sources: relevantMeetings.map(m => ({ id: m.id, title: m.title })),
});
} catch (error) {
console.error('Error answering question:', error);
res.status(500).json({ error: 'Failed to answer question' });
}
});

module.exports = router;

text

**Frontend Component:**

// File: components/AskAssistant.jsx

import React, { useState } from 'react';

const AskAssistant = () => {
const [question, setQuestion] = useState('');
const [answer, setAnswer] = useState('');
const [loading, setLoading] = useState(false);

const handleAsk = async () => {
if (!question.trim()) return;

text
setLoading(true);
try {
  const response = await fetch('/api/ask-assistant', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question }),
  });

  const data = await response.json();
  setAnswer(data.answer);
} catch (error) {
  console.error('Error:', error);
  setAnswer('Error getting answer. Please try again.');
} finally {
  setLoading(false);
}
};

return (
<div className="ask-assistant">
<h2>Ask About Your Meetings</h2>
<div className="input-group">
<input
type="text"
value={question}
onChange={(e) => setQuestion(e.target.value)}
placeholder="What did we discuss about...?"
onKeyPress={(e) => e.key === 'Enter' && handleAsk()}
/>
<button onClick={handleAsk} disabled={loading}>
{loading ? 'Thinking...' : 'Ask'}
</button>
</div>

text
  {answer && (
    <div className="answer-display">
      <h3>Answer</h3>
      <p>{answer}</p>
    </div>
  )}
</div>
);
};

export default AskAssistant;

text

**Deliverable:** Ask Assistant working - users can ask questions about meetings

---

### WEEK 7-8: Automations & Polish

#### **Week 7: Automation Engine**

**Automation Framework:**

// File: services/automationEngine.js

class AutomationEngine {
constructor() {
this.triggers = {};
this.actions = {};
}

// Register a trigger
registerTrigger(name, fn) {
this.triggers[name] = fn;
}

// Register an action
registerAction(name, fn) {
this.actions[name] = fn;
}

// Execute automation
async execute(automation) {
try {
const triggerMet = await this.triggersautomation.trigger;

text
  if (triggerMet) {
    for (const action of automation.actions) {
      await this.actions[action.name](action.params);
    }
  }
} catch (error) {
  console.error('Automation error:', error);
}
}
}

// Example automation: When meeting ends, create action items
const engine = new AutomationEngine();

engine.registerTrigger('meeting_completed', async () => true);

engine.registerAction('create_action_items', async (params) => {
console.log('Creating action items...');
// Your logic here
});

engine.registerAction('sync_to_crm', async (params) => {
console.log('Syncing to CRM...');
// Your logic here
});

module.exports = AutomationEngine;

text

**Deliverable:** First automations working (meeting complete → actions created)

---

#### **Week 8: Testing & Deployment**

**Full Test Checklist:**

- [ ] Record meeting
- [ ] Transcription works
- [ ] Action items extract
- [ ] Items sync to Logos Vision
- [ ] Pulse notification sent
- [ ] Project created (optional)
- [ ] Ask Assistant answers questions
- [ ] Automations trigger

**Deployment:**

1. Push to GitHub
2. Set up CI/CD (GitHub Actions)
3. Deploy to production (Heroku, AWS, DigitalOcean, etc.)
4. Set environment variables (API keys, database URLs)
5. Monitor logs and errors

---

## TESTING CHECKLIST

### Unit Tests (Per Component)

// Example test file: tests/meetings.test.js

const request = require('supertest');
const app = require('../app');

describe('Meeting API', () => {
test('Should create meeting', async () => {
const response = await request(app)
.post('/api/meetings')
.send({
title: 'Test Meeting',
description: 'Test',
attendees: ['user1', 'user2'],
});

text
expect(response.status).toBe(200);
expect(response.body.meeting.title).toBe('Test Meeting');
});

test('Should extract action items', async () => {
// Test action item extraction
});
});

text

### Integration Tests

- [ ] Meeting recorded → Stored in DB
- [ ] Transcript → Gemini processed
- [ ] Action items → CRM synced
- [ ] Pulse → Message sent
- [ ] Ask Assistant → Correct answers

### Performance Tests

- [ ] Meeting processing < 2 minutes
- [ ] API response time < 1 second
- [ ] Search latency < 500ms

---

## APPENDIX: Environment Variables

Create `.env` file:

Gemini API
GEMINI_API_KEY=your_key_here
GEMINI_MODEL=gemini-2.5-flash

Database
DATABASE_URL=postgresql://user:pass@localhost/entomate_db

External APIs
LOGOS_VISION_API_URL=https://api.logosvis.app
LOGOS_VISION_API_KEY=your_key_here
PULSE_API_URL=https://api.pulse.app
PULSE_API_KEY=your_key_here

Server
PORT=3000
NODE_ENV=development

text

---

**End of Phase 1 Guide**

This guide takes you from zero to a working MVP in 8 weeks. Good luck!
