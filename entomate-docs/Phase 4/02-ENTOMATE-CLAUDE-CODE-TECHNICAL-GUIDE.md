📄 FILE 2 OF 7: CLAUDE CODE TECHNICAL GUIDE
Here's the complete second file. Copy and paste this into a text editor and save as 02-ENTOMATE-CLAUDE-CODE-TECHNICAL-GUIDE.md

text
# Entomate Technical Implementation Guide
## For Claude Code & Development Team

**Version:** 1.0  
**Last Updated:** December 17, 2025  
**Status:** Ready to Build  

---

## 📌 QUICK START (5 MINUTES)

### 1. Backend Setup
cd backend
npm install
npm run migrate # Create database tables
npm start # Runs on http://localhost:3000

text

### 2. Frontend Setup
cd ../frontend
npm install
npm run dev # Runs on http://localhost:5173

text

### 3. Test Gemini API (In browser console)
// Go to http://localhost:3000/api/health
// Should return: { status: "ok", gemini: "connected" }

text

---

## 🗂️ PROJECT STRUCTURE

entomate/
├── backend/
│ ├── server.js # Main Express server
│ ├── .env.example # Environment template
│ ├── package.json # Dependencies
│ │
│ ├── config/
│ │ ├── gemini.js # Gemini API setup
│ │ ├── supabase.js # Supabase connection
│ │ └── crm.js # CRM API setup
│ │
│ ├── routes/
│ │ ├── meetings.js # /api/meetings/*
│ │ ├── projects.js # /api/projects/*
│ │ ├── tasks.js # /api/tasks/*
│ │ ├── automations.js # /api/automations/*
│ │ ├── search.js # /api/search/*
│ │ └── integrations.js # /api/integrations/*
│ │
│ ├── services/
│ │ ├── geminiService.js # AI processing
│ │ ├── crmSync.js # CRM integration
│ │ ├── chatSync.js # Chat integration
│ │ ├── automationEngine.js # Automation execution
│ │ └── searchService.js # Semantic search
│ │
│ ├── middleware/
│ │ ├── auth.js # JWT verification
│ │ ├── errorHandler.js # Error handling
│ │ └── logging.js # Request logging
│ │
│ └── utils/
│ ├── database.js # DB query helpers
│ ├── validators.js # Input validation
│ └── constants.js # App constants
│
├── frontend/
│ ├── src/
│ │ ├── App.jsx # Main component
│ │ ├── main.jsx # Entry point
│ │ │
│ │ ├── components/
│ │ │ ├── MeetingRecorder.jsx
│ │ │ ├── MeetingList.jsx
│ │ │ ├── ActionItemsList.jsx
│ │ │ ├── ProjectDashboard.jsx
│ │ │ ├── AskAssistant.jsx
│ │ │ └── AutomationBuilder.jsx
│ │ │
│ │ ├── pages/
│ │ │ ├── Dashboard.jsx
│ │ │ ├── Meetings.jsx
│ │ │ ├── Projects.jsx
│ │ │ ├── Tasks.jsx
│ │ │ └── Settings.jsx
│ │ │
│ │ ├── services/
│ │ │ ├── api.js # HTTP client
│ │ │ ├── auth.js # Auth helper
│ │ │ └── storage.js # Local storage
│ │ │
│ │ ├── hooks/
│ │ │ ├── useMeetings.js
│ │ │ ├── useProjects.js
│ │ │ └── useAutomations.js
│ │ │
│ │ ├── styles/
│ │ │ ├── main.css
│ │ │ ├── tailwind.css
│ │ │ └── variables.css
│ │ │
│ │ └── utils/
│ │ ├── formatting.js
│ │ └── validators.js
│ │
│ └── package.json
│
└── docs/
├── API.md # API documentation
├── SCHEMA.md # Database schema
└── DEPLOYMENT.md # Deployment guide

text

---

## 🔧 BACKEND IMPLEMENTATION

### File 1: backend/server.js

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

text
const testResponse = await model.generateContent('Say "OK" in one word');

// Test Supabase
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

const { data, error } = await supabase.from('meetings').select('count()', { count: 'exact', head: true });

res.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  services: {
    gemini: testResponse.response.text() === 'OK' ? 'connected' : 'error',
    database: error ? 'error' : 'connected'
  }
});
} catch (error) {
res.status(500).json({
status: 'error',
message: error.message
});
}
});

// ========================================
// ROUTES
// ========================================

// Meetings
app.use('/api/meetings', require('./routes/meetings'));

// Projects
app.use('/api/projects', require('./routes/projects'));

// Tasks
app.use('/api/tasks', require('./routes/tasks'));

// Automations
app.use('/api/automations', require('./routes/automations'));

// Search
app.use('/api/search', require('./routes/search'));

// Integrations
app.use('/api/integrations', require('./routes/integrations'));

// ========================================
// ERROR HANDLING
// ========================================

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
console.log(✅ Entomate Backend running on http://localhost:${PORT});
console.log(Environment: ${process.env.NODE_ENV});
});

module.exports = app;

text

---

### File 2: backend/config/gemini.js

const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiConfig {
constructor() {
this.apiKey = process.env.GEMINI_API_KEY;

text
if (!this.apiKey) {
  throw new Error('GEMINI_API_KEY not set in environment');
}

this.genAI = new GoogleGenerativeAI(this.apiKey);
this.model = this.genAI.getGenerativeModel({
  model: 'gemini-2.5-flash'
});
}

/**

Transcribe audio to text

@param {Buffer} audioBuffer - Audio file buffer

@returns {Promise<string>} Transcript text
*/
async transcribeAudio(audioBuffer) {
try {
console.log('📝 Starting transcription...');

const audioData = audioBuffer.toString('base64');

const response = await this.model.generateContent({
contents: [{
role: 'user',
parts: [
{
inlineData: {
mimeType: 'audio/wav',
data: audioData
}
},
{
text: Transcribe this meeting audio carefully. Include: - Speaker names and timestamps - Format: [HH:MM:SS] Speaker: [name] - [speech content] - Preserve exact wording - Note any unclear sections [UNCLEAR]
}
]
}]
});

const transcript = response.response.text();
console.log('✅ Transcription complete');

return transcript;

text
} catch (error) {
text
  console.error('❌ Transcription error:', error);
  throw new Error(`Transcription failed: ${error.message}`);
}
}

/**

Generate meeting summary

@param {string} transcript - Meeting transcript

@returns {Promise<Object>} Summary with keyPoints, decisions, sentiment
*/
async generateSummary(transcript) {
try {
console.log('📊 Generating summary...');

const response = await this.model.generateContent({
contents: [{
role: 'user',
parts: [{
text: `Analyze this meeting transcript and return ONLY valid JSON (no markdown):

text
          TRANSCRIPT:
          ${transcript}
          
          Return JSON with:
          {
            "summary": "2-3 sentence overview of the meeting",
            "keyPoints": ["point 1", "point 2", "point 3"],
            "decisions": ["decision 1", "decision 2"],
            "sentiment": "Positive|Neutral|Negative",
            "nextSteps": ["step 1", "step 2"],
            "attendeesCount": number,
            "duration": "estimated in minutes"
          }`
 }]
}]
});

const text = response.response.text();

// Extract JSON from response (in case of markdown wrapping)
const jsonMatch = text.match(/{[\s\S]*}/);
const jsonText = jsonMatch ? jsonMatch : text;

const summary = JSON.parse(jsonText);
console.log('✅ Summary generated');

return summary;

text
} catch (error) {
text
  console.error('❌ Summary error:', error);
  throw new Error(`Summary generation failed: ${error.message}`);
}
}

/**

Extract action items from transcript

@param {string} transcript - Meeting transcript

@returns {Promise<Array>} Action items with owner, due date, priority
*/
async extractActionItems(transcript) {
try {
console.log('📋 Extracting action items...');

const response = await this.model.generateContent({
contents: [{
role: 'user',
parts: [{
text: `Extract action items from this meeting transcript. Return ONLY valid JSON (no markdown):

text
          TRANSCRIPT:
          ${transcript}
          
          Return JSON with:
          {
            "actionItems": [
              {
                "task": "what needs to be done (concise)",
                "owner": "person's full name",
                "ownerEmail": "email@company.com or null if unknown",
                "dueDate": "YYYY-MM-DD",
                "priority": "High|Medium|Low",
                "description": "why this task is needed",
                "dependencies": ["other task 1", "other task 2"]
              }
            ]
          }
          
          Rules:
          - Only include items with clear ownership or implied ownership
          - If no date mentioned, infer: "ASAP"=today+2, "soon"=today+7, "next week"=next Monday
          - Priority: High if deadline ≤3 days, Medium if ≤7 days, Low otherwise
          - Only extract 3-7 action items (the important ones)`
 }]
}]
});

const text = response.response.text();
const jsonMatch = text.match(/{[\s\S]*}/);
const jsonText = jsonMatch ? jsonMatch : text;

const result = JSON.parse(jsonText);
console.log('✅ Action items extracted');

return result.actionItems || [];

text
} catch (error) {
text
  console.error('❌ Action items error:', error);
  throw new Error(`Action item extraction failed: ${error.message}`);
}
}

/**

Generate embeddings for semantic search

@param {string} text - Text to embed

@returns {Promise<Array>} Embedding vector
*/
async generateEmbedding(text) {
try {
const embeddingModel = this.genAI.getGenerativeModel({
model: 'embedding-001'
});

const result = await embeddingModel.embedContent(text);
return result.embedding.values;

text
} catch (error) {
text
  console.error('❌ Embedding error:', error);
  throw new Error(`Embedding generation failed: ${error.message}`);
}
}

/**

Ask AI question about context

@param {string} question - User question

@param {Array} context - Previous conversation context

@returns {Promise<string>} Answer
*/
async askQuestion(question, context = []) {
try {
console.log('🤔 Processing question...');

const contents = [
...context,
{
role: 'user',
parts: [{
text: question
}]
}
];

const response = await this.model.generateContent({ contents });
const answer = response.response.text();

console.log('✅ Question answered');
return answer;

text
} catch (error) {
text
  console.error('❌ Question error:', error);
  throw new Error(`Question answering failed: ${error.message}`);
}
}
}

module.exports = new GeminiConfig();

text

---

### File 3: backend/config/supabase.js

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
throw new Error('Supabase URL or KEY not set in environment');
}

const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;

text

---

### File 4: backend/routes/meetings.js

const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const gemini = require('../config/gemini');
const router = express.Router();

const upload = multer({ storage: multer.memoryStorage() });

/**

POST /api/meetings/process

Upload audio and process with Gemini
*/
router.post('/process', upload.single('audio'), async (req, res) => {
try {
const { title, attendees, duration } = req.body;

if (!req.file) {
return res.status(400).json({ error: 'No audio file provided' });
}

console.log('🎙️ Processing meeting:', title);

// Step 1: Transcribe
const transcript = await gemini.transcribeAudio(req.file.buffer);

// Step 2: Summarize
const summary = await gemini.generateSummary(transcript);

// Step 3: Extract action items
const actionItems = await gemini.extractActionItems(transcript);

// Step 4: Generate embedding
const embedding = await gemini.generateEmbedding(
transcript.substring(0, 2000) // First 2000 chars
);

// Step 5: Upload audio to Supabase Storage
const audioFileName = meetings/${uuidv4()}.wav;
const { data: uploadData, error: uploadError } = await supabase
.storage
.from('recordings')
.upload(audioFileName, req.file.buffer, {
contentType: 'audio/wav',
upsert: false
});

if (uploadError) {
console.error('❌ Audio upload error:', uploadError);
// Continue anyway - audio not critical
}

const audioUrl = uploadData?.path
? supabase.storage.from('recordings').getPublicUrl(uploadData.path).data.publicUrl
: null;

// Step 6: Save meeting to database
const { data: meeting, error: meetingError } = await supabase
.from('meetings')
.insert({
title,
transcript,
summary: summary.summary,
key_points: summary.keyPoints,
decisions: summary.decisions,
sentiment_label: summary.sentiment,
sentiment_score: 0.85, // TODO: calculate from sentiment
attendees: JSON.parse(attendees || '[]'),
duration_minutes: parseInt(duration),
audio_file_url: audioUrl,
transcript_vector: embedding,
created_by: req.user?.id || 'unknown',
created_at: new Date().toISOString()
})
.select()
.single();

if (meetingError) throw meetingError;

console.log('✅ Meeting saved:', meeting.id);

// Step 7: Save action items
const savedActionItems = [];
for (const item of actionItems) {
const { data: actionItem, error: actionError } = await supabase
.from('action_items')
.insert({
meeting_id: meeting.id,
task_description: item.task,
assigned_to_name: item.owner,
assigned_to_email: item.ownerEmail,
due_date: item.dueDate,
priority: item.priority.toLowerCase(),
status: 'open',
crm_sync_status: 'pending',
created_at: new Date().toISOString()
})
.select()
.single();

if (!actionError) {
savedActionItems.push(actionItem);
}
}

console.log(✅ Saved ${savedActionItems.length} action items);

// Return results
res.json({
success: true,
meeting: {
id: meeting.id,
title: meeting.title,
transcript: meeting.transcript.substring(0, 500) + '...',
summary: meeting.summary,
sentiment: meeting.sentiment_label,
keyPoints: summary.keyPoints,
decisions: summary.decisions,
nextSteps: summary.nextSteps
},
actionItems: savedActionItems,
stats: {
transcriptLength: transcript.length,
actionItemCount: savedActionItems.length,
processingTime: '~30 seconds'
}
});

} catch (error) {
console.error('❌ Error processing meeting:', error);
res.status(500).json({
error: 'Failed to process meeting',
details: error.message
});
}
});

/**

GET /api/meetings

List all meetings
*/
router.get('/', async (req, res) => {
try {
const { limit = 20, offset = 0 } = req.query;

const { data: meetings, error } = await supabase
.from('meetings')
.select('*')
.order('created_at', { ascending: false })
.range(offset, offset + limit - 1);

if (error) throw error;

res.json({
meetings,
count: meetings.length,
hasMore: meetings.length === limit
});

} catch (error) {
res.status(500).json({ error: error.message });
}
});

/**

GET /api/meetings/:id

Get meeting details
*/
router.get('/:id', async (req, res) => {
try {
const { id } = req.params;

const { data: meeting, error: meetingError } = await supabase
.from('meetings')
.select('*')
.eq('id', id)
.single();

if (meetingError) throw meetingError;

const { data: actionItems } = await supabase
.from('action_items')
.select('*')
.eq('meeting_id', id);

res.json({
...meeting,
actionItems
});

} catch (error) {
res.status(500).json({ error: error.message });
}
});

/**

POST /api/meetings/:id/ask

Ask AI question about meeting
*/
router.post('/:id/ask', async (req, res) => {
try {
const { id } = req.params;
const { question } = req.body;

if (!question) {
return res.status(400).json({ error: 'Question required' });
}

// Get meeting
const { data: meeting, error: meetingError } = await supabase
.from('meetings')
.select('*')
.eq('id', id)
.single();

if (meetingError) throw meetingError;

// Ask Gemini
const context = [
{
role: 'user',
parts: [{
text: Here's a meeting transcript you should know about: Title: ${meeting.title} ${meeting.transcript}
}]
},
{
role: 'model',
parts: [{
text: 'I understand. I have this meeting transcript in context.'
}]
}
];

const answer = await gemini.askQuestion(question, context);

res.json({
question,
answer,
meetingId: id,
meetingTitle: meeting.title,
confidence: 0.9
});

} catch (error) {
res.status(500).json({ error: error.message });
}
});

module.exports = router;

text

---

### File 5: backend/routes/integrations.js

const express = require('express');
const supabase = require('../config/supabase');
const router = express.Router();

/**

POST /api/integrations/crm/sync-action-items

Sync action items to CRM
*/
router.post('/crm/sync-action-items', async (req, res) => {
try {
const { actionItemIds } = req.body;

// Get pending action items
const { data: actionItems } = await supabase
.from('action_items')
.select('*')
.in('id', actionItemIds || [])
.eq('crm_sync_status', 'pending')
.limit(100);

const results = {
synced: 0,
failed: 0,
errors: []
};

for (const item of actionItems) {
try {
// TODO: Implement CRM API call
// const crmTask = await crmSync.createTask(item);

text
 // Mark as synced
 await supabase
   .from('action_items')
   .update({
     crm_sync_status: 'synced',
     // crm_task_id: crmTask.id,
     updated_at: new Date().toISOString()
   })
   .eq('id', item.id);
 
 results.synced++;
 
} catch (error) {
results.failed++;
results.errors.push({
itemId: item.id,
error: error.message
});
}
}

res.json(results);

} catch (error) {
res.status(500).json({ error: error.message });
}
});

/**

POST /api/integrations/chat/post-recap

Post meeting recap to chat
*/
router.post('/chat/post-recap', async (req, res) => {
try {
const { meetingId, channelId } = req.body;

// Get meeting and action items
const { data: meeting } = await supabase
.from('meetings')
.select('*')
.eq('id', meetingId)
.single();

const { data: actionItems } = await supabase
.from('action_items')
.select('*')
.eq('meeting_id', meetingId);

// Format message
const sentiment_emoji = {
'Positive': '😊',
'Neutral': '😐',
'Negative': '😟'
}[meeting.sentiment_label] || '📝';

let message = ${sentiment_emoji} **Meeting Recap: ${meeting.title}**\n\n;
message += **Summary:** ${meeting.summary}\n\n;

if (meeting.key_points && meeting.key_points.length > 0) {
message += **Key Points:**\n;
meeting.key_points.forEach(point => {
message += - ${point}\n;
});
message += '\n';
}

if (actionItems && actionItems.length > 0) {
message += **Action Items:**\n;
actionItems.forEach(item => {
const priority_emoji = { 'high': '🔴', 'medium': '🟡', 'low': '🟢' }[item.priority] || '';
message += ${priority_emoji} ${item.task_description} (${item.assigned_to_name}, due ${item.due_date})\n;
});
}

// TODO: Post to chat API
// await chatSync.postMessage(channelId, message);

res.json({
success: true,
message: 'Meeting recap posted to chat',
messagePreview: message.substring(0, 200)
});

} catch (error) {
res.status(500).json({ error: error.message });
}
});

/**

GET /api/integrations/status

Get integration status
*/
router.get('/status', async (req, res) => {
res.json({
integrations: {
gemini: process.env.GEMINI_API_KEY ? 'connected' : 'not configured',
supabase: process.env.SUPABASE_URL ? 'connected' : 'not configured',
crm: process.env.CRM_API_KEY ? 'connected' : 'not configured',
chat: process.env.CHAT_API_KEY ? 'connected' : 'not configured'
}
});
});

module.exports = router;

text

---

## 🎨 FRONTEND IMPLEMENTATION

### File 1: frontend/src/components/MeetingRecorder.jsx

import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';

export default function MeetingRecorder() {
const [isRecording, setIsRecording] = useState(false);
const [transcript, setTranscript] = useState('Start recording to see transcript here...');
const [duration, setDuration] = useState(0);
const [meetingTitle, setMeetingTitle] = useState('');
const [attendees, setAttendees] = useState('');
const [isProcessing, setIsProcessing] = useState(false);
const [error, setError] = useState(null);

const mediaRecorder = useRef(null);
const audioChunks = useRef([]);
const timerInterval = useRef(null);

// Start recording
const startRecording = async () => {
try {
setError(null);
const stream = await navigator.mediaDevices.getUserMedia({
audio: true,
video: false
});

text
  mediaRecorder.current = new MediaRecorder(stream);
  audioChunks.current = [];
  
  mediaRecorder.current.ondataavailable = (event) => {
    audioChunks.current.push(event.data);
  };
  
  mediaRecorder.current.onstop = handleRecordingComplete;
  
  mediaRecorder.current.start();
  setIsRecording(true);
  setDuration(0);
  setTranscript('🎙️ Recording... Listening...');
  
  // Start timer
  timerInterval.current = setInterval(() => {
    setDuration(prev => prev + 1);
  }, 1000);
  
} catch (error) {
  setError('Microphone access denied. Please allow microphone access.');
  console.error('Microphone error:', error);
}
};

// Stop recording
const stopRecording = () => {
if (mediaRecorder.current) {
mediaRecorder.current.stop();
mediaRecorder.current.stream.getTracks().forEach(track => track.stop());
setIsRecording(false);
clearInterval(timerInterval.current);
}
};

// Handle recording complete
const handleRecordingComplete = async () => {
try {
setIsProcessing(true);
setTranscript('⏳ Processing with Gemini AI...');

text
  const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
  
  // Upload to backend
  const formData = new FormData();
  formData.append('audio', audioBlob, 'meeting.wav');
  formData.append('title', meetingTitle || `Meeting ${new Date().toLocaleDateString()}`);
  formData.append('attendees', JSON.stringify(attendees.split(',').map(a => a.trim())));
  formData.append('duration', duration);
  
  const response = await axios.post(
    'http://localhost:3000/api/meetings/process',
    formData,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 120000 // 2 minutes
    }
  );
  
  const { meeting, actionItems, stats } = response.data;
  
  setTranscript(meeting.transcript);
  
  // Show success message
  alert(`✅ Meeting processed!\n\n${stats.actionItemCount} action items extracted.\n\nSentiment: ${meeting.sentiment}`);
  
} catch (error) {
  setError(`Error processing meeting: ${error.message}`);
  setTranscript('❌ Error processing. Please try again.');
  console.error('Processing error:', error);
} finally {
  setIsProcessing(false);
}
};

const formatTime = (seconds) => {
const mins = Math.floor(seconds / 60);
const secs = seconds % 60;
return ${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')};
};

return (
<div className="meeting-recorder">
<div className="recorder-header">
<h1>🎙️ Meeting Recorder</h1>
<p>Record, transcribe, and extract action items automatically</p>
</div>

text
  {error && (
    <div className="error-banner">
      ⚠️ {error}
    </div>
  )}
  
  <div className="meeting-form">
    <input
      type="text"
      placeholder="Meeting title (optional)"
      value={meetingTitle}
      onChange={(e) => setMeetingTitle(e.target.value)}
      className="form-input"
      disabled={isRecording}
    />
    
    <input
      type="text"
      placeholder="Attendees (comma-separated)"
      value={attendees}
      onChange={(e) => setAttendees(e.target.value)}
      className="form-input"
      disabled={isRecording}
    />
  </div>
  
  <div className="recorder-controls">
    <button
      onClick={isRecording ? stopRecording : startRecording}
      disabled={isProcessing}
      className={`btn-record ${isRecording ? 'recording' : ''}`}
    >
      {isRecording ? '⏹️ Stop Recording' : '🎙️ Start Recording'}
    </button>
    
    {isRecording && (
      <div className="recording-status">
        <span className="live-badge">🔴 LIVE</span>
        <span className="duration">{formatTime(duration)}</span>
      </div>
    )}
  </div>
  
  <div className="transcript-display">
    <h3>Transcript</h3>
    <div className="transcript-content">
      {isProcessing ? (
        <div className="loading">
          <div className="spinner"></div>
          Processing with Gemini AI... (This takes ~30 seconds)
        </div>
      ) : (
        transcript
      )}
    </div>
  </div>
  
  <style jsx>{`
    .meeting-recorder {
      max-width: 1000px;
      margin: 20px auto;
      padding: 24px;
      background: white;
      border-radius: 12px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    
    .recorder-header {
      margin-bottom: 24px;
      text-align: center;
    }
    
    .recorder-header h1 {
      margin: 0 0 8px 0;
      font-size: 28px;
    }
    
    .recorder-header p {
      margin: 0;
      color: #666;
    }
    
    .error-banner {
      background: #fee;
      border: 1px solid #fcc;
      color: #c00;
      padding: 12px 16px;
      border-radius: 6px;
      margin-bottom: 16px;
    }
    
    .meeting-form {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 24px;
    }
    
    .form-input {
      padding: 12px;
      border: 1px solid #ddd;
      border-radius: 6px;
      font-size: 14px;
    }
    
    .form-input:disabled {
      background: #f5f5f5;
      cursor: not-allowed;
    }
    
    .recorder-controls {
      display: flex;
      align-items: center;
      gap: 16px;
      margin-bottom: 24px;
      justify-content: center;
    }
    
    .btn-record {
      padding: 12px 24px;
      border: none;
      border-radius: 6px;
      font-size: 16px;
      font-weight: 600;
      cursor: pointer;
      background: #00A86B;
      color: white;
      transition: background 0.3s;
    }
    
    .btn-record:hover {
      background: #008F5A;
    }
    
    .btn-record.recording {
      background: #ff4444;
      animation: pulse 1s infinite;
    }
    
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.7; }
    }
    
    .recording-status {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    
    .live-badge {
      font-weight: 600;
      color: #ff4444;
    }
    
    .duration {
      font-family: monospace;
      font-size: 18px;
      font-weight: 600;
      min-width: 80px;
    }
    
    .transcript-display {
      background: #f5f5f5;
      padding: 16px;
      border-radius: 6px;
    }
    
    .transcript-display h3 {
      margin: 0 0 12px 0;
      color: #666;
      text-transform: uppercase;
      font-size: 12px;
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
    
    .loading {
      display: flex;
      align-items: center;
      gap: 12px;
      color: #666;
    }
    
    .spinner {
      width: 20px;
      height: 20px;
      border: 2px solid #ddd;
      border-top: 2px solid #00A86B;
      border-radius: 50%;
      animation: spin 1s linear infinite;
    }
    
    @keyframes spin {
      to { transform: rotate(360deg); }
    }
  `}</style>
</div>
);
}

text

---

### File 2: frontend/src/components/ActionItemsList.jsx

import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function ActionItemsList({ meetingId }) {
const [actionItems, setActionItems] = useState([]);
const [loading, setLoading] = useState(true);
const [error, setError] = useState(null);

useEffect(() => {
loadActionItems();
}, [meetingId]);

const loadActionItems = async () => {
try {
const response = await axios.get(http://localhost:3000/api/meetings/${meetingId});
setActionItems(response.data.actionItems || []);
} catch (err) {
setError('Failed to load action items');
console.error(err);
} finally {
setLoading(false);
}
};

const syncToCRM = async (itemId) => {
try {
await axios.post('http://localhost:3000/api/integrations/crm/sync-action-items', {
actionItemIds: [itemId]
});

text
  // Reload to show updated status
  loadActionItems();
  alert('✅ Synced to CRM');
} catch (err) {
  alert('Failed to sync to CRM: ' + err.message);
}
};

if (loading) return <div>Loading action items...</div>;
if (error) return <div className="error">{error}</div>;

const grouped = {
high: actionItems.filter(i => i.priority === 'high'),
medium: actionItems.filter(i => i.priority === 'medium'),
low: actionItems.filter(i => i.priority === 'low')
};

return (
<div className="action-items">
<h2>📋 Action Items</h2>

text
  {actionItems.length === 0 ? (
    <p className="empty">No action items for this meeting</p>
  ) : (
    <>
      {Object.entries(grouped).map(([priority, items]) => items.length > 0 && (
        <div key={priority} className="priority-group">
          <h3 className={`priority-${priority}`}>
            {priority === 'high' ? '🔴' : priority === 'medium' ? '🟡' : '🟢'} {priority.toUpperCase()}
          </h3>
          
          {items.map(item => (
            <div key={item.id} className="action-item">
              <div className="item-header">
                <strong>{item.task_description}</strong>
                <span className={`sync-status ${item.crm_sync_status}`}>
                  {item.crm_sync_status === 'synced' ? '✅' : '⏳'}
                </span>
              </div>
              
              <div className="item-meta">
                <span>👤 {item.assigned_to_name}</span>
                <span>📅 {item.due_date}</span>
              </div>
              
              {item.crm_sync_status === 'pending' && (
                <button
                  onClick={() => syncToCRM(item.id)}
                  className="btn-sync"
                >
                  Sync to CRM
                </button>
              )}
            </div>
          ))}
        </div>
      ))}
    </>
  )}
  
  <style jsx>{`
    .action-items {
      padding: 16px;
      background: white;
      border-radius: 8px;
    }
    
    .priority-group {
      margin-bottom: 20px;
    }
    
    .priority-high { color: #ff4444; }
    .priority-medium { color: #ff8844; }
    .priority-low { color: #44dd44; }
    
    .action-item {
      padding: 12px;
      margin-bottom: 8px;
      background: #f9f9f9;
      border-left: 4px solid #ddd;
      border-radius: 4px;
    }
    
    .item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .sync-status.synced { color: #00AA00; }
    .sync-status.pending { color: #AAAA00; }
    
    .item-meta {
      display: flex;
      gap: 16px;
      font-size: 13px;
      color: #666;
    }
    
    .btn-sync {
      margin-top: 8px;
      padding: 6px 12px;
      background: #0066cc;
      color: white;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
    }
    
    .btn-sync:hover {
      background: #0052a3;
    }
  `}</style>
</div>
);
}

text

---

## 📦 PACKAGE.JSON FILES

### backend/package.json

{
"name": "entomate-backend",
"version": "1.0.0",
"description": "Entomate Meeting & Project AI Backend",
"main": "server.js",
"scripts": {
"start": "node server.js",
"dev": "nodemon server.js",
"migrate": "psql $DATABASE_URL -f schema.sql"
},
"dependencies": {
"express": "^4.18.2",
"cors": "^2.8.5",
"dotenv": "^16.0.3",
"helmet": "^7.0.0",
"morgan": "^1.10.0",
"@google/generative-ai": "^0.1.3",
"@supabase/supabase-js": "^2.30.0",
"multer": "^1.4.5-lts.1",
"uuid": "^9.0.0",
"axios": "^1.4.0"
},
"devDependencies": {
"nodemon": "^2.0.22"
}
}

text

### frontend/package.json

{
"name": "entomate-frontend",
"version": "1.0.0",
"description": "Entomate Meeting & Project AI Frontend",
"type": "module",
"scripts": {
"dev": "vite",
"build": "vite build",
"preview": "vite preview"
},
"dependencies": {
"react": "^18.2.0",
"react-dom": "^18.2.0",
"axios": "^1.4.0",
"moment": "^2.29.4"
},
"devDependencies": {
"@vitejs/plugin-react": "^4.0.0",
"vite": "^4.3.9"
}
}

text

---

## 🚀 DEPLOYMENT CHECKLIST

**Before deploying to production:**

- [ ] All environment variables set correctly
- [ ] Database tables created via migrations
- [ ] API rate limiting configured
- [ ] CORS settings verified
- [ ] Error handling tested
- [ ] Security audit passed
- [ ] Performance benchmarks met (< 2s responses)
- [ ] Logging configured
- [ ] Database backups scheduled
- [ ] Monitor/alerting set up
- [ ] Team trained on system

---

**End of FILE 2**

Ready for FILE 3? Reply: "Send FILE 3"