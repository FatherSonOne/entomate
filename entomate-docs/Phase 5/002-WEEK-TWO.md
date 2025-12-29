📄 WEEK 2: MEETING RECORDING & TRANSCRIPTION
Complete Implementation Guide
Version: 1.0
Timeline: 5 business days (Monday-Friday)
Status: Ready to Build
Total Tasks: 48 items
Prerequisite: Week 1 complete and deployed locally

🎯 WEEK 2 OVERVIEW
Goal: Users can record meetings, AI transcribes them, and extracts summaries + action items

By Friday EOD, you should have:

✅ Meeting recorder component working (start/stop recording)

✅ Real-time audio streaming to backend

✅ Gemini transcription generating transcripts

✅ Summary generated from transcript

✅ Action items extracted automatically

✅ UI displays all results to user

✅ Audio stored in Supabase Storage

✅ All data saved to database

✅ Error handling for failed transcriptions

✅ Processing time < 2 minutes for 30-minute meetings

Time Commitment: 40 hours total (3 backend + 3 frontend + 1 QA)

Success Metric: End-to-end meeting recording → transcription → display in < 2 minutes

📋 TASK BREAKDOWN BY DAY
🔵 MONDAY: Planning & Architecture (8 hours)
Morning (9am-12pm): Architecture Review
Tech Lead & PM (with all developers):

 Team Standup - Week 2 Kickoff (15 mins)

Review Week 2 goals

Explain architecture

Answer questions

 Architecture Review (30 mins)

Discuss recording flow:

text
User records → Browser captures audio → Send to backend
→ Gemini transcribes → Gemini summarizes → Extract action items
→ Save to database → Return to UI → Display results
Discuss error handling

Discuss retry logic

 Review Recording API (20 mins)

Open File 1: Implementation Plan, Week 2 section

Review expected endpoint: POST /api/meetings/process

Review expected request body

Review expected response

 Database Review (15 mins)

Verify meetings table exists

Verify action_items table exists

Check field names match

Afternoon (1pm-5pm): Component Planning
Frontend Developer:

 Create Component Structure (20 mins)

Create: frontend/src/components/MeetingRecorder.jsx

Create: frontend/src/components/TranscriptDisplay.jsx

Create: frontend/src/components/ActionItemsList.jsx

Create: frontend/src/services/recordingService.js

 Create Styles (20 mins)

Create: frontend/src/styles/MeetingRecorder.css

Plan layout (recorder, transcript, action items)

 Design UI Mockup (text-based)** (20 mins)

text
┌─────────────────────────────────────────┐
│  🎙️ MEETING RECORDER                    │
├─────────────────────────────────────────┤
│  Title: [________________]               │
│  Attendees: [________________]           │
│                                          │
│        [🎙️ START RECORDING]             │
│                                          │
│  Transcript:                             │
│  ┌──────────────────────────────────┐   │
│  │ Recording started... listening   │   │
│  │                                  │   │
│  └──────────────────────────────────┘   │
└─────────────────────────────────────────┘
 Create Test Plan (30 mins)

Test 1: Record 10 seconds, transcribe

Test 2: Record 1 minute, get summary

Test 3: Record 5 minutes, extract action items

Test 4: Error handling (network fail, API fail)

Backend Developer:

 Create Routes (20 mins)

Create: backend/routes/meetings.js

Plan endpoints:

POST /api/meetings/process - Upload audio, process, return results

GET /api/meetings - List meetings

GET /api/meetings/:id - Get meeting details

 Create Services (20 mins)

Create: backend/services/geminiService.js

Plan functions:

transcribeAudio(buffer) - Use Gemini

generateSummary(transcript) - Use Gemini

extractActionItems(transcript) - Use Gemini

 Create Storage Handler (20 mins)

Plan audio storage to Supabase

Plan file naming convention

Plan cleanup strategy

 Review Gemini Prompts (20 mins)

Review transcription prompt

Review summary prompt

Review action item extraction prompt

Optimize for quality + speed

🟢 TUESDAY: Backend Implementation (8 hours)
Morning (9am-12pm): Gemini Service
Backend Developer:

 Create Gemini Service File (30 mins)

Create: backend/services/geminiService.js

Copy code from "SECTION: BACKEND CODE - geminiService.js" below

Paste into file

 Test Transcription (20 mins)

bash
# Get a sample audio file (or record one)
# Test the transcribe function
node -e "
const geminiService = require('./services/geminiService');
const fs = require('fs');
const audio = fs.readFileSync('test.wav');
geminiService.transcribeAudio(audio).then(console.log).catch(console.error);
"
Expected: Returns transcript text

 Test Summarization (15 mins)

bash
# Test the summarize function
const testTranscript = "We discussed Q1 budget. John needs approval by Friday. Sarah will prepare proposal.";
geminiService.generateSummary(testTranscript).then(console.log).catch(console.error);
Expected: Returns summary object with summary, keyPoints, decisions

 Test Action Item Extraction (15 mins)

Test extractActionItems function

Verify returns array of action items

Check accuracy (should be 90%+)

Afternoon (1pm-5pm): API Endpoints
Backend Developer:

 Create Meetings Routes (30 mins)

Create: backend/routes/meetings.js

Copy code from "SECTION: BACKEND CODE - meetings.js" below

Paste into file

 Register Routes (10 mins)

Open: backend/server.js

Add after CORS middleware:

javascript
// Routes
app.use('/api/meetings', require('./routes/meetings'));
 Test Endpoint Exists (10 mins)

bash
curl http://localhost:3000/api/meetings
# Should return: { meetings: [], count: 0, hasMore: false }
 Test POST Endpoint (30 mins)

Create test audio file (10 seconds of speech)

Test upload:

bash
curl -X POST \
  -F "audio=@test.wav" \
  -F "title=Test Meeting" \
  -F "attendees=[\"John\", \"Sarah\"]" \
  -F "duration=10" \
  http://localhost:3000/api/meetings/process
Should return meeting object with transcript, summary, action items

If error, check logs and troubleshoot

 Implement Error Handling (15 mins)

Add try-catch blocks

Add validation

Add meaningful error messages

Test with invalid input

 Add Logging (10 mins)

Add console logs for debugging

Log at each step:

"🎙️ Processing meeting: [title]"

"✅ Transcription complete"

"✅ Summary generated"

"✅ Action items extracted"

🟡 WEDNESDAY: Frontend Implementation (8 hours)
Morning (9am-12pm): Recording Component
Frontend Developer:

 Create MeetingRecorder Component (40 mins)

Create: frontend/src/components/MeetingRecorder.jsx

Copy code from "SECTION: FRONTEND CODE - MeetingRecorder.jsx" below

Paste into file

 Create Recording Service (20 mins)

Create: frontend/src/services/recordingService.js

Copy code from "SECTION: FRONTEND CODE - recordingService.js" below

Paste into file

 Test Component Renders (10 mins)

Add to App.jsx:

jsx
import MeetingRecorder from './components/MeetingRecorder';

function App() {
  return <MeetingRecorder />;
}
Frontend should load without errors

Should see: Recording button, title input, attendees input

Afternoon (1pm-5pm): UI & Integration
Frontend Developer:

 Create Styles (30 mins)

Create: frontend/src/styles/MeetingRecorder.css

Copy code from "SECTION: FRONTEND CODE - MeetingRecorder.css" below

Paste into file

 Test Recording Button (20 mins)

Click "Start Recording" button

Browser asks for microphone permission

Click "Allow"

Should see: Red dot, recording timer, "🎙️ LIVE" badge

Say something (test: "This is a test meeting")

Click "Stop Recording"

 Test Upload (20 mins)

After recording stops, should see:

⏳ Loading spinner

"Processing with Gemini AI..."

~30 second wait

Should receive transcript in UI

 Debug Issues (30 mins)

If no audio recorded: Check microphone permissions

If upload fails: Check backend is running

If slow: Check internet connection

If error: Check browser console (F12)

🔵 THURSDAY: Testing & Integration (8 hours)
Morning (9am-12pm): End-to-End Testing
QA & Backend Developer:

 Full Flow Test - 10 Second Recording (30 mins)

Record 10 seconds of speech

Submit to backend

Verify:

 Transcript appears in UI

 Summary shows in UI

 Action items appear in UI

 Processing time logged

 Full Flow Test - 1 Minute Recording (30 mins)

Record 1 minute of meeting-like speech

Verify all steps above

Check database:

bash
# In Supabase SQL editor
SELECT * FROM meetings ORDER BY created_at DESC LIMIT 1;
SELECT * FROM action_items WHERE meeting_id = '[id]';
 Accuracy Testing (20 mins)

Record clear audio (good microphone)

Check transcript accuracy (target: 95%+)

If < 90%: Note for improvement

Create test cases for different accents/speeds

Afternoon (1pm-5pm): Performance & Error Handling
QA & Backend Developer:

 Performance Benchmarking (30 mins)

Record 5-minute meeting

Measure processing time:

Transcription time: _____ secs

Summary generation: _____ secs

Action item extraction: _____ secs

Total: _____ secs (target: < 300 secs)

If slow, identify bottleneck

 Error Handling Tests (30 mins)

Test 1: Network failure during upload

Expected: Retry logic, user sees error message

Test 2: Gemini API timeout

Expected: Retry, timeout message if persistent

Test 3: Invalid audio format

Expected: User-friendly error

Test 4: Microphone denied

Expected: Clear instruction to enable

Document all error paths

 UI Polish (30 mins)

Check responsive design (mobile, tablet, desktop)

Check accessibility (keyboard navigation, screen reader)

Test loading states

Test error states

 Create Test Report (15 mins)

Document:

Tests passed: ___

Tests failed: ___

Issues found: ___

Performance metrics

Accuracy metrics

🟢 FRIDAY: Polish & Code Review (8 hours)
Morning (9am-12pm): Code Quality
Tech Lead & Developers:

 Code Review (60 mins)

Review backend/services/geminiService.js

Review backend/routes/meetings.js

Review frontend/components/MeetingRecorder.jsx

Review frontend/services/recordingService.js

Checklist:

 No console.logs (or marked for removal)

 Error handling everywhere

 Consistent code style

 Comments on complex logic

 No hardcoded values

 No security issues

 Add JSDoc Comments (30 mins)

javascript
/**
 * Transcribe audio to text using Gemini
 * @param {Buffer} audioBuffer - Audio file buffer
 * @returns {Promise<string>} Transcript text
 * @throws {Error} If transcription fails
 */
async transcribeAudio(audioBuffer) { ... }
 Run Linter (15 mins)

bash
npm install --save-dev eslint
npx eslint backend/services/geminiService.js
npx eslint frontend/src/components/MeetingRecorder.jsx
 Run Prettier (15 mins)

bash
npm install --save-dev prettier
npx prettier --write backend/services/geminiService.js
npx prettier --write frontend/src/components/MeetingRecorder.jsx
Afternoon (1pm-5pm): Documentation & Demo
PM & Tech Lead:

 Update API Documentation (30 mins)

Open: docs/API.md

Add endpoint:

text
## POST /api/meetings/process

Upload audio and process meeting

### Request
- Form data:
  - audio: (file) WAV audio file
  - title: (string) Meeting title
  - attendees: (JSON array) Attendee names
  - duration: (number) Duration in minutes

### Response
{
"success": true,
"meeting": {
"id": "...",
"title": "...",
"transcript": "...",
"summary": "...",
"sentiment": "Positive|Neutral|Negative",
"keyPoints": ["...", "..."],
"decisions": ["..."]
},
"actionItems": [
{
"task": "...",
"owner": "...",
"dueDate": "...",
"priority": "High|Medium|Low"
}
]
}

text
undefined
 Create User Guide (20 mins)

Create: docs/USER_GUIDE_WEEK2.md

Content:

How to record a meeting

What happens during processing

How to understand results

Troubleshooting tips

 Commit Code (15 mins)

text
git add backend/services/geminiService.js
git add backend/routes/meetings.js
git add frontend/src/components/MeetingRecorder.jsx
git add frontend/src/services/recordingService.js
git add frontend/src/styles/MeetingRecorder.css
git add docs/API.md
git add docs/USER_GUIDE_WEEK2.md
git commit -m "Week 2: Meeting recording & transcription complete"
git push origin develop
 Weekly Demo (45 mins)

Entire team watches

Demo 1: Record 20-second meeting (clear speech)

Demo 2: Show results (transcript, summary, action items)

Demo 3: Show database records

Demo 4: Show performance metrics

Q&A: 10 minutes

 Retrospective (15 mins)

What went well?

What was hard?

What to improve?

Rate week 1-5: ___

🔧 BACKEND CODE - geminiService.js
text
const { GoogleGenerativeAI } = require('@google/generative-ai');

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    
    if (!this.apiKey) {
      throw new Error('GEMINI_API_KEY not set in environment');
    }
    
    this.genAI = new GoogleGenerativeAI(this.apiKey);
    this.model = this.genAI.getGenerativeModel({
      model: 'gemini-2.5-flash'
    });
    
    console.log('✅ Gemini Service initialized');
  }
  
  /**
   * Transcribe audio to text
   * @param {Buffer} audioBuffer - Audio file buffer
   * @returns {Promise<string>} Transcript text
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
              text: `Transcribe this meeting audio carefully. Include:
                     - Speaker identification if possible
                     - Timestamps in [MM:SS] format
                     - Exact wording (preserve quotes)
                     - Note any unclear sections [UNCLEAR]
                     - Natural paragraph breaks
                     
                     Format: [MM:SS] Speaker (if known): [speech content]
                     
                     Start transcription:`
            }
          ]
        }]
      });
      
      const transcript = response.response.text();
      console.log('✅ Transcription complete');
      
      return transcript;
      
    } catch (error) {
      console.error('❌ Transcription error:', error);
      throw new Error(`Transcription failed: ${error.message}`);
    }
  }
  
  /**
   * Generate meeting summary
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Object>} Summary with keyPoints, decisions, sentiment
   */
  async generateSummary(transcript) {
    try {
      console.log('📊 Generating summary...');
      
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Analyze this meeting transcript and return ONLY valid JSON (no markdown, no extra text):
                   
                   TRANSCRIPT:
                   ${transcript}
                   
                   Return ONLY this JSON structure:
                   {
                     "summary": "2-3 sentence overview of the meeting in past tense",
                     "keyPoints": ["point 1", "point 2", "point 3"],
                     "decisions": ["decision 1", "decision 2"],
                     "sentiment": "Positive",
                     "nextSteps": ["step 1", "step 2"],
                     "duration": "estimated minutes"
                   }
                   
                   IMPORTANT: Return ONLY the JSON object, nothing else.`
          }]
        }]
      });
      
      const text = response.response.text();
      
      // Extract JSON from response (handle potential markdown wrapping)
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch : text;
      
      const summary = JSON.parse(jsonText);
      console.log('✅ Summary generated');
      
      return summary;
      
    } catch (error) {
      console.error('❌ Summary error:', error);
      // Return default summary on error
      return {
        summary: 'Meeting summary unavailable',
        keyPoints: [],
        decisions: [],
        sentiment: 'Neutral',
        nextSteps: [],
        duration: 'unknown'
      };
    }
  }
  
  /**
   * Extract action items from transcript
   * @param {string} transcript - Meeting transcript
   * @returns {Promise<Array>} Action items with owner, due date, priority
   */
  async extractActionItems(transcript) {
    try {
      console.log('📋 Extracting action items...');
      
      const response = await this.model.generateContent({
        contents: [{
          role: 'user',
          parts: [{
            text: `Extract action items from this meeting transcript. Return ONLY valid JSON (no markdown, no extra text):
                   
                   TRANSCRIPT:
                   ${transcript}
                   
                   Return ONLY this JSON structure:
                   {
                     "actionItems": [
                       {
                         "task": "specific action (concise, 5-10 words)",
                         "owner": "person's full name or 'TBD'",
                         "ownerEmail": "email@company.com or null",
                         "dueDate": "YYYY-MM-DD or 'ASAP'",
                         "priority": "High|Medium|Low",
                         "description": "why this task matters (1-2 sentences)"
                       }
                     ]
                   }
                   
                   Rules:
                   - Only extract clear action items (not vague discussions)
                   - If no date mentioned: High priority = due tomorrow, Medium = due in 3 days, Low = due in 7 days
                   - Extract 3-7 items max (only the important ones)
                   - Owner must be mentioned or clearly implied in meeting
                   - IMPORTANT: Return ONLY the JSON object, nothing else.`
          }]
        }]
      });
      
      const text = response.response.text();
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const jsonText = jsonMatch ? jsonMatch : text;
      
      const result = JSON.parse(jsonText);
      console.log(`✅ Action items extracted: ${result.actionItems.length} items`);
      
      return result.actionItems || [];
      
    } catch (error) {
      console.error('❌ Action items error:', error);
      // Return empty array on error
      return [];
    }
  }
  
  /**
   * Generate embeddings for semantic search (Week 6)
   * @param {string} text - Text to embed
   * @returns {Promise<Array>} Embedding vector
   */
  async generateEmbedding(text) {
    try {
      const embeddingModel = this.genAI.getGenerativeModel({
        model: 'embedding-001'
      });
      
      const result = await embeddingModel.embedContent(text);
      return result.embedding.values;
      
    } catch (error) {
      console.error('❌ Embedding error:', error);
      throw new Error(`Embedding generation failed: ${error.message}`);
    }
  }
}

module.exports = new GeminiService();
🔧 BACKEND CODE - routes/meetings.js
text
const express = require('express');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const supabase = require('../config/supabase');
const geminiService = require('../services/geminiService');
const router = express.Router();

// Configure multer for in-memory storage
const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB max
});

/**
 * POST /api/meetings/process
 * Upload audio and process meeting
 */
router.post('/process', upload.single('audio'), async (req, res) => {
  try {
    const { title, attendees, duration } = req.body;
    
    // Validate input
    if (!req.file) {
      return res.status(400).json({ error: 'No audio file provided' });
    }
    
    if (!title) {
      return res.status(400).json({ error: 'Meeting title required' });
    }
    
    console.log('🎙️ Processing meeting:', title);
    
    // Parse attendees
    let attendeesList = [];
    try {
      attendeesList = JSON.parse(attendees || '[]');
    } catch (e) {
      attendeesList = attendees ? attendees.split(',').map(a => a.trim()) : [];
    }
    
    // ========== STEP 1: Transcribe Audio ==========
    let transcript;
    try {
      transcript = await geminiService.transcribeAudio(req.file.buffer);
    } catch (error) {
      console.error('Transcription failed:', error);
      return res.status(500).json({
        error: 'Transcription failed',
        details: error.message
      });
    }
    
    // ========== STEP 2: Generate Summary ==========
    const summary = await geminiService.generateSummary(transcript);
    
    // ========== STEP 3: Extract Action Items ==========
    const actionItems = await geminiService.extractActionItems(transcript);
    
    // ========== STEP 4: Upload Audio to Storage ==========
    const audioFileName = `meetings/${uuidv4()}.wav`;
    let audioUrl = null;
    
    try {
      const { data: uploadData, error: uploadError } = await supabase
        .storage
        .from('recordings')
        .upload(audioFileName, req.file.buffer, {
          contentType: 'audio/wav',
          upsert: false
        });
      
      if (!uploadError && uploadData) {
        const { data: { publicUrl } } = supabase
          .storage
          .from('recordings')
          .getPublicUrl(uploadData.path);
        audioUrl = publicUrl;
      }
    } catch (error) {
      console.error('Audio upload warning (non-critical):', error.message);
      // Continue anyway - audio not critical for MVP
    }
    
    // ========== STEP 5: Save Meeting to Database ==========
    const { data: meeting, error: meetingError } = await supabase
      .from('meetings')
      .insert({
        title,
        transcript,
        summary: summary.summary,
        key_points: summary.keyPoints,
        decisions: summary.decisions,
        sentiment_label: summary.sentiment,
        sentiment_score: 0.85, // TODO: calculate properly
        attendees: attendeesList,
        duration_minutes: parseInt(duration) || 0,
        audio_file_url: audioUrl,
        created_by: req.user?.id || 'anonymous',
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (meetingError) {
      console.error('Meeting save error:', meetingError);
      throw meetingError;
    }
    
    console.log('✅ Meeting saved:', meeting.id);
    
    // ========== STEP 6: Save Action Items ==========
    const savedActionItems = [];
    
    for (const item of actionItems) {
      try {
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
        
        if (!actionError && actionItem) {
          savedActionItems.push(actionItem);
        }
      } catch (error) {
        console.error('Action item save error:', error);
        // Continue with next item
      }
    }
    
    console.log(`✅ Saved ${savedActionItems.length} action items`);
    
    // ========== STEP 7: Return Results ==========
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
        processingTime: 'complete'
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
 * GET /api/meetings
 * List all meetings
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
    console.error('Error listing meetings:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/meetings/:id
 * Get meeting details
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
    
    if (!meeting) {
      return res.status(404).json({ error: 'Meeting not found' });
    }
    
    const { data: actionItems } = await supabase
      .from('action_items')
      .select('*')
      .eq('meeting_id', id);
    
    res.json({
      ...meeting,
      actionItems
    });
    
  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
🔧 FRONTEND CODE - MeetingRecorder.jsx
text
import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import '../styles/MeetingRecorder.css';

export default function MeetingRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [transcript, setTranscript] = useState('Press the microphone button to start recording...');
  const [duration, setDuration] = useState(0);
  const [meetingTitle, setMeetingTitle] = useState('');
  const [attendees, setAttendees] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [summary, setSummary] = useState(null);
  const [actionItems, setActionItems] = useState([]);
  
  const mediaRecorder = useRef(null);
  const audioChunks = useRef([]);
  const timerInterval = useRef(null);
  
  // Request microphone access on component mount
  useEffect(() => {
    return () => {
      // Cleanup: stop recording if component unmounts
      if (mediaRecorder.current && isRecording) {
        mediaRecorder.current.stop();
      }
    };
  }, [isRecording]);
  
  // Start recording
  const startRecording = async () => {
    try {
      setError(null);
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: true,
        video: false 
      });
      
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
      setSummary(null);
      setActionItems([]);
      
      // Start timer
      timerInterval.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
      
    } catch (error) {
      setError('Microphone access denied. Please allow microphone access in browser settings.');
      console.error('Microphone error:', error);
    }
  };
  
  // Stop recording
  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
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
      setTranscript('⏳ Processing with Gemini AI...\n\nThis typically takes 30 seconds per minute of audio.');
      
      const audioBlob = new Blob(audioChunks.current, { type: 'audio/wav' });
      
      // Upload to backend
      const formData = new FormData();
      formData.append('audio', audioBlob, 'meeting.wav');
      formData.append('title', meetingTitle || `Meeting ${new Date().toLocaleDateString()}`);
      formData.append('attendees', JSON.stringify(attendees.split(',').map(a => a.trim()).filter(a => a)));
      formData.append('duration', duration);
      
      const response = await axios.post(
        `${import.meta.env.VITE_API_URL}/api/meetings/process`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000 // 5 minutes
        }
      );
      
      const { meeting, actionItems: items, stats } = response.data;
      
      setTranscript(meeting.transcript);
      setSummary({
        summary: meeting.summary,
        sentiment: meeting.sentiment,
        keyPoints: meeting.keyPoints,
        decisions: meeting.decisions,
        nextSteps: meeting.nextSteps
      });
      setActionItems(items);
      
      setError(null);
      
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
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  
  return (
    <div className="meeting-recorder">
      <div className="recorder-header">
        <h1>🎙️ Meeting Recorder</h1>
        <p>Record, transcribe, and extract action items automatically with AI</p>
      </div>
      
      {error && (
        <div className="error-banner">
          ⚠️ {error}
        </div>
      )}
      
      <div className="meeting-form">
        <div className="form-group">
          <label htmlFor="title">Meeting Title (optional)</label>
          <input
            id="title"
            type="text"
            placeholder="e.g., Q1 Budget Review"
            value={meetingTitle}
            onChange={(e) => setMeetingTitle(e.target.value)}
            disabled={isRecording || isProcessing}
            className="form-input"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="attendees">Attendees (comma-separated, optional)</label>
          <input
            id="attendees"
            type="text"
            placeholder="e.g., John, Sarah, Mike"
            value={attendees}
            onChange={(e) => setAttendees(e.target.value)}
            disabled={isRecording || isProcessing}
            className="form-input"
          />
        </div>
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
      
      {summary && (
        <div className="summary-section">
          <h3>📊 Meeting Summary</h3>
          <div className="summary-content">
            <p className="summary-text">{summary.summary}</p>
            
            <div className="sentiment">
              <strong>Sentiment:</strong> {summary.sentiment}
            </div>
            
            {summary.keyPoints && summary.keyPoints.length > 0 && (
              <div className="key-points">
                <strong>Key Points:</strong>
                <ul>
                  {summary.keyPoints.map((point, idx) => (
                    <li key={idx}>{point}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {summary.decisions && summary.decisions.length > 0 && (
              <div className="decisions">
                <strong>Decisions:</strong>
                <ul>
                  {summary.decisions.map((decision, idx) => (
                    <li key={idx}>{decision}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div className="transcript-display">
        <h3>Transcript</h3>
        <div className="transcript-content">
          {isProcessing ? (
            <div className="loading">
              <div className="spinner"></div>
              Processing with Gemini AI... (This takes ~30 seconds)
            </div>
          ) : (
            <pre>{transcript}</pre>
          )}
        </div>
      </div>
      
      {actionItems && actionItems.length > 0 && (
        <div className="action-items-section">
          <h3>📋 Action Items ({actionItems.length})</h3>
          <div className="action-items">
            {actionItems.map((item, idx) => (
              <div key={idx} className="action-item">
                <div className="item-header">
                  <strong>{item.task_description}</strong>
                  <span className={`priority priority-${item.priority}`}>
                    {item.priority}
                  </span>
                </div>
                <div className="item-details">
                  {item.assigned_to_name && (
                    <span>👤 {item.assigned_to_name}</span>
                  )}
                  {item.due_date && (
                    <span>📅 {item.due_date}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
🔧 FRONTEND CODE - recordingService.js
text
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

class RecordingService {
  /**
   * Process meeting recording
   */
  static async processMeeting(audioBlob, title, attendees, duration) {
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'meeting.wav');
      formData.append('title', title);
      formData.append('attendees', JSON.stringify(attendees));
      formData.append('duration', duration);
      
      const response = await axios.post(
        `${API_URL}/api/meetings/process`,
        formData,
        {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 300000 // 5 minutes
        }
      );
      
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get all meetings
   */
  static async getMeetings(limit = 20, offset = 0) {
    try {
      const response = await axios.get(
        `${API_URL}/api/meetings?limit=${limit}&offset=${offset}`
      );
      return response.data;
    } catch (error) {
      throw error;
    }
  }
  
  /**
   * Get meeting details
   */
  static async getMeeting(id) {
    try {
      const response = await axios.get(`${API_URL}/api/meetings/${id}`);
      return response.data;
    } catch (error) {
      throw error;
    }
  }
}

export default RecordingService;
🔧 FRONTEND CODE - MeetingRecorder.css
text
.meeting-recorder {
  max-width: 1200px;
  margin: 20px auto;
  padding: 24px;
  background: white;
  border-radius: 12px;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.1);
}

.recorder-header {
  margin-bottom: 32px;
  text-align: center;
}

.recorder-header h1 {
  margin: 0 0 8px 0;
  font-size: 32px;
  color: #667eea;
}

.recorder-header p {
  margin: 0;
  color: #666;
  font-size: 16px;
}

.error-banner {
  background: #fee;
  border: 1px solid #fcc;
  color: #c00;
  padding: 12px 16px;
  border-radius: 6px;
  margin-bottom: 20px;
  font-size: 14px;
}

.meeting-form {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
  margin-bottom: 24px;
}

.form-group {
  display: flex;
  flex-direction: column;
}

.form-group label {
  margin-bottom: 6px;
  font-weight: 500;
  font-size: 14px;
  color: #333;
}

.form-input {
  padding: 12px;
  border: 1px solid #ddd;
  border-radius: 6px;
  font-size: 14px;
  font-family: inherit;
}

.form-input:focus {
  outline: none;
  border-color: #667eea;
  box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
}

.form-input:disabled {
  background: #f5f5f5;
  cursor: not-allowed;
  color: #999;
}

.recorder-controls {
  display: flex;
  align-items: center;
  gap: 24px;
  margin-bottom: 32px;
  justify-content: center;
}

.btn-record {
  padding: 14px 28px;
  border: none;
  border-radius: 8px;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  transition: all 0.3s ease;
}

.btn-record:hover:not(:disabled) {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(102, 126, 234, 0.4);
}

.btn-record:active:not(:disabled) {
  transform: translateY(0);
}

.btn-record.recording {
  background: #ff4444;
  animation: pulse 1.5s ease-in-out infinite;
}

@keyframes pulse {
  0%, 100% {
    opacity: 1;
  }
  50% {
    opacity: 0.7;
  }
}

.btn-record:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.recording-status {
  display: flex;
  gap: 12px;
  align-items: center;
  padding: 12px 16px;
  background: #ffe4e4;
  border-radius: 8px;
}

.live-badge {
  font-weight: 600;
  color: #ff4444;
  font-size: 14px;
}

.duration {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 18px;
  font-weight: 600;
  min-width: 80px;
  color: #333;
}

.summary-section {
  background: #f0f7ff;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 24px;
  border-left: 4px solid #667eea;
}

.summary-section h3 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 16px;
}

.summary-content {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.summary-text {
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  margin: 0;
}

.sentiment {
  font-size: 14px;
  color: #666;
}

.key-points,
.decisions {
  font-size: 14px;
  color: #666;
}

.key-points ul,
.decisions ul {
  margin: 8px 0 0 20px;
  padding: 0;
  list-style: disc;
}

.key-points li,
.decisions li {
  margin: 4px 0;
}

.transcript-display {
  background: #f9f9f9;
  padding: 20px;
  border-radius: 8px;
  margin-bottom: 24px;
}

.transcript-display h3 {
  margin: 0 0 12px 0;
  color: #666;
  text-transform: uppercase;
  font-size: 12px;
  letter-spacing: 0.5px;
}

.transcript-content {
  font-family: 'Monaco', 'Courier New', monospace;
  font-size: 14px;
  line-height: 1.6;
  color: #333;
  min-height: 200px;
  max-height: 400px;
  overflow-y: auto;
  white-space: pre-wrap;
  word-break: break-word;
}

.transcript-content pre {
  margin: 0;
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
  color: inherit;
  white-space: pre-wrap;
}

.loading {
  display: flex;
  align-items: center;
  gap: 12px;
  color: #666;
  min-height: 100px;
  justify-content: center;
}

.spinner {
  width: 20px;
  height: 20px;
  border: 2px solid #ddd;
  border-top: 2px solid #667eea;
  border-radius: 50%;
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.action-items-section {
  background: #f0fff4;
  padding: 20px;
  border-radius: 8px;
  border-left: 4px solid #00aa00;
}

.action-items-section h3 {
  margin: 0 0 16px 0;
  color: #333;
  font-size: 16px;
}

.action-items {
  display: grid;
  grid-template-columns: 1fr;
  gap: 12px;
}

.action-item {
  padding: 12px;
  background: white;
  border-radius: 6px;
  border-left: 4px solid #667eea;
}

.item-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 8px;
  gap: 12px;
}

.item-header strong {
  font-size: 14px;
  color: #333;
  flex: 1;
}

.priority {
  display: inline-block;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  font-weight: 600;
  white-space: nowrap;
}

.priority-high {
  background: #ffcccc;
  color: #cc0000;
}

.priority-medium {
  background: #ffe6cc;
  color: #ff8800;
}

.priority-low {
  background: #ccffcc;
  color: #00cc00;
}

.item-details {
  display: flex;
  gap: 16px;
  font-size: 13px;
  color: #666;
}

@media (max-width: 768px) {
  .meeting-form {
    grid-template-columns: 1fr;
  }
  
  .recorder-controls {
    flex-direction: column;
    gap: 12px;
  }
  
  .recording-status {
    width: 100%;
    justify-content: center;
  }
  
  .meeting-recorder {
    padding: 16px;
  }
  
  .recorder-header h1 {
    font-size: 24px;
  }
}
📋 WEEK 2 TASKS SUMMARY
Total Tasks: 48

Monday: 8 tasks

Tuesday: 10 tasks

Wednesday: 10 tasks

Thursday: 12 tasks

Friday: 8 tasks

✅ WEEK 2 SIGN-OFF CHECKLIST
Complete ALL items before moving to Week 3:

Functionality
 Recording button works

 Microphone access works

 Audio uploads to backend

 Transcription completes

 Summary generated

 Action items extracted

 All results display in UI

 Audio saved to Supabase Storage

 Meeting saved to database

 Action items saved to database

Quality
 Transcript accuracy ≥ 95%

 Processing time ≤ 2 minutes per 30-min meeting

 No console errors

 Error messages helpful

 Mobile responsive

 Code reviewed (2+ reviewers)

 No security issues

Testing
 10-second recording test: PASS

 1-minute recording test: PASS

 5-minute recording test: PASS

 Error handling tests: PASS

 Performance benchmarks: PASS

 Load testing: PASS

Documentation
 API.md updated

 USER_GUIDE_WEEK2.md created

 Code commented

 Commit message clear

Database
 Meetings table has data

 Action_items table has data

 No orphaned records

 Query performance good

📊 WEEK 2 SUCCESS METRICS
Metric	Target	Actual
Transcription accuracy	95%+	___
Processing time	< 2 min	___
End-to-end success rate	99%+	___
User satisfaction	4+/5	___
Code coverage	70%+	___
Uptime	99%+	___
🚀 READY FOR WEEK 3?
When all checkboxes above are complete:

✅ Commit all Week 2 code

✅ Create branch: feature/week-3-crm-sync

✅ Review Week 3 plan (File 1)

✅ Assign Week 3 tasks

End of WEEK 2 Guide

Ready for WEEK 3: CRM SYNC (AUTO-CREATE TASKS)?

Reply: "Send WEEK 3"