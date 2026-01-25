# Gemini API Integration: Technical Architecture & Developer Guide

**For Claude Code / Gemini Studio Development**

---

## PART 1: SYSTEM ARCHITECTURE OVERVIEW

### Component Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        FRONTEND (Pulse/CRM)                     │
├─────────────────────────────────────────────────────────────────┤
│  • Meeting recorder UI                                          │
│  • Action item manager                                          │
│  • Ask Assistant widget                                         │
│  • Meeting recap viewer                                         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/WebSocket
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                     API GATEWAY / ROUTER                        │
│  Endpoints:                                                     │
│  • POST /api/meetings/process                                   │
│  • GET  /api/meetings/{id}                                      │
│  • POST /api/ask-assistant                                      │
│  • POST /api/action-items/sync-crm                              │
└────────────────────────┬────────────────────────────────────────┘
                         │
         ┌───────────────┼───────────────┐
         │               │               │
         ▼               ▼               ▼
    ┌────────────┐  ┌──────────────┐  ┌──────────────┐
    │ Audio      │  │ Gemini       │  │ CRM/Pulse    │
    │ Processing │  │ Integration  │  │ Sync         │
    │ Service    │  │ Service      │  │ Service      │
    └──────┬─────┘  └──────┬───────┘  └──────┬───────┘
           │                │                 │
           ▼                ▼                 ▼
    ┌────────────────────────────────────────────────┐
    │           Core Database Layer                  │
    │  • meetings table                              │
    │  • action_items table                          │
    │  • meeting_embeddings (vector storage)         │
    │  • meeting_audit_log                           │
    └────────────────────────────────────────────────┘
           │                │                 │
           ▼                ▼                 ▼
    ┌────────────┐  ┌──────────────┐  ┌──────────────┐
    │ File       │  │ Gemini API   │  │ CRM/Pulse    │
    │ Storage    │  │ (Google)     │  │ APIs         │
    │ (GCS)      │  │ (Streaming)  │  │ (External)   │
    └────────────┘  └──────────────┘  └──────────────┘
```

---

## PART 2: GEMINI API INTEGRATION DETAILS

### 2.1 Model Selection

**Recommended Model: `gemini-2.5-flash`**

| Feature | Value |
|---------|-------|
| **Model** | gemini-2.5-flash |
| **Input tokens** | 1,000,000 |
| **Audio support** | Yes (up to 8.4 hours) |
| **Output tokens** | 4,096 (expandable) |
| **Latency** | ~500ms for typical requests |
| **Cost** | $0.075/MTok input, $0.30/MTok output |
| **Speed** | Fastest Gemini model |

**Why Flash not Pro?**
- Sufficient intelligence for meeting analysis
- 2.5-3x faster
- 90% cheaper
- Best for real-time/streaming use cases

---

### 2.2 Authentication Setup

#### API Key Management

```javascript
// .env file (NEVER commit this)
GEMINI_API_KEY=your_api_key_here
GEMINI_MODEL=gemini-2.5-flash
GEMINI_API_VERSION=v1beta

// config.js
const GEMINI_CONFIG = {
  apiKey: process.env.GEMINI_API_KEY,
  model: process.env.GEMINI_MODEL,
  apiEndpoint: `https://generativelanguage.googleapis.com/${process.env.GEMINI_API_VERSION}`,
  requestTimeout: 30000,
  maxRetries: 3,
  retryDelay: 1000
};
```

#### Rate Limiting Strategy

```javascript
class GeminiRateLimiter {
  constructor() {
    this.requestsPerMinute = 60;
    this.queue = [];
    this.lastRequestTime = 0;
  }

  async executeWithRateLimit(fn) {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    const minTimeBetweenRequests = 60000 / this.requestsPerMinute;

    if (timeSinceLastRequest < minTimeBetweenRequests) {
      await new Promise(resolve =>
        setTimeout(resolve, minTimeBetweenRequests - timeSinceLastRequest)
      );
    }

    this.lastRequestTime = Date.now();
    return await fn();
  }
}
```

---

### 2.3 Audio Processing Pipeline

#### Step 1: Receive & Validate Audio

```javascript
async function receiveAndValidateAudio(audioFile, meetingData) {
  /**
   * Input: Audio file from meeting recorder + metadata
   * Output: Validated audio buffer ready for Gemini
   */

  const validAudioFormats = ['audio/wav', 'audio/mp3', 'audio/webm', 'audio/ogg'];
  const maxFileSize = 100 * 1024 * 1024; // 100MB

  // Validate format
  if (!validAudioFormats.includes(audioFile.mimetype)) {
    throw new Error(`Invalid audio format: ${audioFile.mimetype}`);
  }

  // Validate size
  if (audioFile.size > maxFileSize) {
    throw new Error(`Audio file too large: ${audioFile.size / 1024 / 1024}MB`);
  }

  // Convert to base64 if needed (for API transmission)
  const audioBuffer = audioFile.buffer || await fs.promises.readFile(audioFile.path);
  const base64Audio = audioBuffer.toString('base64');

  return {
    data: base64Audio,
    mimeType: audioFile.mimetype,
    sizeBytes: audioFile.size,
    duration: meetingData.durationSeconds,
    attendees: meetingData.attendees,
    meetingId: meetingData.id
  };
}
```

#### Step 2: Send to Gemini for Transcription

```javascript
async function transcribeWithGemini(audioData) {
  /**
   * Send audio to Gemini with structured prompt
   * Returns: Full transcript with speaker identification
   */

  const transcriptionPrompt = `You are a professional meeting transcriber. Transcribe this audio meeting with the following requirements:

1. Identify each speaker by name if possible (use provided attendee list)
2. Include timestamps at regular intervals (every 30 seconds)
3. Preserve all dialogue, even tangential comments
4. Mark inaudible or unclear sections as [inaudible]
5. Include speaker pauses or emotional cues if relevant
6. Format as:
[MM:SS] SPEAKER: "dialogue text"

Attendee reference list:
${audioData.attendees.map(a => a.name).join(', ')}

Transcribe the complete audio:`;

  const response = await callGeminiAPI({
    model: GEMINI_CONFIG.model,
    contents: [
      {
        parts: [
          {
            text: transcriptionPrompt
          },
          {
            inlineData: {
              mimeType: audioData.mimeType,
              data: audioData.data
            }
          }
        ]
      }
    ]
  });

  return {
    meetingId: audioData.meetingId,
    transcript: response.text,
    durationSeconds: audioData.duration,
    attendees: audioData.attendees,
    transcriptionTime: new Date()
  };
}

async function callGeminiAPI(payload) {
  const url = `${GEMINI_CONFIG.apiEndpoint}/models/${GEMINI_CONFIG.model}:generateContent?key=${GEMINI_CONFIG.apiKey}`;

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      timeout: GEMINI_CONFIG.requestTimeout
    });

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    return data.candidates[0].content.parts[0];
  } catch (error) {
    console.error('Gemini API call failed:', error);
    throw error;
  }
}
```

---

### 2.4 Prompt Chain Execution

#### Architecture: Parallel vs Sequential Processing

```javascript
class MeetingProcessor {
  constructor(transcript) {
    this.transcript = transcript;
    this.results = {};
  }

  async processAllPrompts() {
    /**
     * Strategy: Run summarization and action extraction in parallel
     * Sequential: Ask Assistant (uses results from prior prompts)
     */

    // Phase 1: Parallel processing (faster)
    const [summary, actionItems, sentiment] = await Promise.all([
      this.runPrompt('summarization', PROMPTS.summarization),
      this.runPrompt('actionExtraction', PROMPTS.actionExtraction),
      this.runPrompt('sentiment', PROMPTS.sentiment)
    ]);

    this.results.summary = summary;
    this.results.actionItems = actionItems;
    this.results.sentiment = sentiment;

    // Phase 2: Structured extraction (uses raw transcript)
    const structured = await this.runPrompt(
      'structuredJSON',
      this.buildStructuredPrompt()
    );
    this.results.structured = structured;

    return this.results;
  }

  async runPrompt(promptName, promptText) {
    /**
     * Execute a single prompt against transcript
     * Includes error handling and retry logic
     */

    let lastError;

    for (let attempt = 0; attempt < GEMINI_CONFIG.maxRetries; attempt++) {
      try {
        const response = await callGeminiAPI({
          model: GEMINI_CONFIG.model,
          contents: [
            {
              parts: [
                {
                  text: promptText + '\n\n' + this.transcript
                }
              ]
            }
          ]
        });

        return response.text;
      } catch (error) {
        lastError = error;
        if (attempt < GEMINI_CONFIG.maxRetries - 1) {
          await new Promise(resolve =>
            setTimeout(resolve, GEMINI_CONFIG.retryDelay * Math.pow(2, attempt))
          );
        }
      }
    }

    throw new Error(`Prompt ${promptName} failed after ${GEMINI_CONFIG.maxRetries} retries: ${lastError.message}`);
  }

  buildStructuredPrompt() {
    /**
     * Build JSON extraction prompt with schema
     * Ensures machine-readable output
     */

    return `${PROMPTS.structuredJSON}

Return ONLY valid JSON matching this schema:
{
  "meeting": {
    "title": "string",
    "date": "YYYY-MM-DD",
    "duration_minutes": number,
    "attendees": [{"name": "string", "role": "string"}],
    "sentiment": "positive|neutral|negative",
    "summary": "string"
  },
  "action_items": [
    {
      "task": "string",
      "owner": "string",
      "due_date": "YYYY-MM-DD",
      "priority": "High|Medium|Low",
      "description": "string",
      "status": "Not Started"
    }
  ],
  "decisions": [
    {
      "decision": "string",
      "owner": "string",
      "impact": "string"
    }
  ],
  "next_steps": [
    {
      "step": "string",
      "owner": "string",
      "target_date": "YYYY-MM-DD"
    }
  ]
}`;
  }
}
```

---

## PART 3: DATABASE SCHEMA

### 3.1 Core Tables

#### meetings table
```sql
CREATE TABLE meetings (
  id UUID PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  date TIMESTAMP NOT NULL,
  duration_minutes INT,
  attendees JSONB, -- array of {name, email, role}
  transcript TEXT, -- full meeting transcript
  transcript_vector vector(1536), -- OpenAI embeddings for semantic search
  summary TEXT,
  sentiment VARCHAR(20), -- positive, neutral, negative
  raw_audio_path VARCHAR(255), -- reference to stored audio file
  audio_size_bytes BIGINT,
  processed_at TIMESTAMP,
  processed_by VARCHAR(100), -- 'gemini-2.5-flash' or other model
  sync_status VARCHAR(50), -- pending, completed, failed
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_date (date),
  INDEX idx_attendees (attendees),
  INDEX idx_sync_status (sync_status)
);

CREATE TABLE action_items (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  task VARCHAR(255) NOT NULL,
  description TEXT,
  owner_name VARCHAR(100),
  owner_email VARCHAR(255),
  owner_crm_id VARCHAR(100), -- reference to CRM contact
  due_date DATE,
  priority VARCHAR(20), -- High, Medium, Low
  status VARCHAR(50), -- Not Started, In Progress, Completed, Blocked
  crm_task_id VARCHAR(100), -- reference to CRM system task ID
  crm_sync_status VARCHAR(50), -- pending, completed, failed
  crm_sync_error TEXT,
  assigned_from_ai BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meeting_id (meeting_id),
  INDEX idx_owner_email (owner_email),
  INDEX idx_due_date (due_date),
  INDEX idx_crm_sync_status (crm_sync_status)
);

CREATE TABLE meeting_embeddings (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  content_type VARCHAR(50), -- 'transcript', 'summary', 'action_item'
  content_chunk TEXT,
  embedding vector(1536), -- vector representation for semantic search
  chunk_index INT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meeting_id (meeting_id)
);

CREATE TABLE pulse_posts (
  id UUID PRIMARY KEY,
  meeting_id UUID REFERENCES meetings(id),
  channel_id VARCHAR(100),
  message_id VARCHAR(100),
  content TEXT,
  posted_at TIMESTAMP,
  status VARCHAR(50), -- sent, failed, deleted
  error_message TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_meeting_id (meeting_id)
);

CREATE TABLE audit_log (
  id UUID PRIMARY KEY,
  entity_type VARCHAR(50), -- 'meeting', 'action_item', 'crm_sync'
  entity_id UUID,
  action VARCHAR(50), -- 'created', 'updated', 'processed', 'synced'
  details JSONB,
  created_by VARCHAR(100),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_entity (entity_type, entity_id),
  INDEX idx_created_at (created_at)
);
```

---

## PART 4: API ENDPOINTS

### 4.1 Process Meeting Endpoint

```javascript
/**
 * POST /api/meetings/process
 * 
 * Receives audio file, transcribes with Gemini, extracts data,
 * and initiates CRM/Pulse sync
 */

app.post('/api/meetings/process', async (req, res) => {
  try {
    const { audioFile, attendees, meetingMetadata } = req.body;

    // Step 1: Validate and prep audio
    const audioData = await receiveAndValidateAudio(audioFile, meetingMetadata);

    // Step 2: Transcribe with Gemini
    const transcriptionResult = await transcribeWithGemini(audioData);

    // Step 3: Process with prompt chain
    const processor = new MeetingProcessor(transcriptionResult.transcript);
    const analysisResults = await processor.processAllPrompts();

    // Step 4: Store in database
    const meeting = await saveMeetingToDB({
      title: analysisResults.summary.title,
      date: meetingMetadata.date,
      attendees: audioData.attendees,
      transcript: transcriptionResult.transcript,
      summary: analysisResults.summary.text,
      sentiment: analysisResults.sentiment,
      rawAudioPath: audioData.path,
      structured: analysisResults.structured
    });

    // Step 5: Extract and store action items
    const actionItems = JSON.parse(analysisResults.structured).action_items;
    const savedActionItems = await saveActionItemsToDB(meeting.id, actionItems);

    // Step 6: Queue CRM sync (async, non-blocking)
    queueCRMSync(meeting.id, savedActionItems);

    // Step 7: Queue Pulse notification (async, non-blocking)
    queuePulseNotification(meeting.id, analysisResults.summary);

    res.json({
      success: true,
      meetingId: meeting.id,
      transcriptLength: transcriptionResult.transcript.length,
      actionItemsCount: savedActionItems.length,
      processingTimeMs: Date.now() - startTime
    });

  } catch (error) {
    console.error('Meeting processing error:', error);
    res.status(500).json({ error: error.message });
  }
});
```

### 4.2 Get Meeting Details Endpoint

```javascript
/**
 * GET /api/meetings/:meetingId
 * 
 * Returns full meeting details including transcript, summary,
 * action items, and CRM sync status
 */

app.get('/api/meetings/:meetingId', async (req, res) => {
  try {
    const { meetingId } = req.params;

    const meeting = await db.query(
      'SELECT * FROM meetings WHERE id = $1',
      [meetingId]
    );

    if (!meeting.rows.length) {
      return res.status(404).json({ error: 'Meeting not found' });
    }

    const actionItems = await db.query(
      'SELECT * FROM action_items WHERE meeting_id = $1 ORDER BY due_date ASC',
      [meetingId]
    );

    const pulsePost = await db.query(
      'SELECT * FROM pulse_posts WHERE meeting_id = $1',
      [meetingId]
    );

    res.json({
      meeting: meeting.rows[0],
      actionItems: actionItems.rows,
      pulsePost: pulsePost.rows[0] || null,
      syncStatus: {
        crm: actionItems.rows.every(ai => ai.crm_sync_status === 'completed'),
        pulse: pulsePost.rows[0]?.status === 'sent'
      }
    });

  } catch (error) {
    console.error('Error fetching meeting:', error);
    res.status(500).json({ error: error.message });
  }
});
```

---

## PART 5: CRM INTEGRATION

### 5.1 Salesforce Sync Example

```javascript
async function syncActionItemsToSalesforce(meetingId, actionItems) {
  /**
   * Maps action items to Salesforce Tasks
   * Creates task records with proper field mapping
   */

  const sfConn = await salesforce.authenticate({
    clientId: process.env.SF_CLIENT_ID,
    clientSecret: process.env.SF_CLIENT_SECRET
  });

  const createdTasks = [];

  for (const actionItem of actionItems) {
    try {
      // Find the Salesforce contact/user for owner
      const ownerRecord = await sfConn.query(
        `SELECT Id FROM User WHERE Email = '${actionItem.owner_email}' LIMIT 1`
      );

      if (!ownerRecord.records.length) {
        throw new Error(`Salesforce user not found for ${actionItem.owner_email}`);
      }

      // Create task in Salesforce
      const taskRecord = await sfConn.sobject('Task').create({
        Subject: actionItem.task,
        Description: actionItem.description,
        OwnerId: ownerRecord.records[0].Id,
        DueDate: actionItem.due_date,
        Priority: mapPriorityToSalesforce(actionItem.priority),
        Status: 'Not Started',
        Type: 'Meeting Action Item',
        Comments: `Auto-created from meeting: ${meetingId}`
      });

      // Update database with Salesforce ID
      await db.query(
        'UPDATE action_items SET crm_task_id = $1, crm_sync_status = $2 WHERE id = $3',
        [taskRecord.id, 'completed', actionItem.id]
      );

      createdTasks.push({
        actionItemId: actionItem.id,
        salesforceTaskId: taskRecord.id
      });

    } catch (error) {
      console.error(`Failed to sync action item ${actionItem.id}:`, error);
      await db.query(
        'UPDATE action_items SET crm_sync_status = $1, crm_sync_error = $2 WHERE id = $3',
        ['failed', error.message, actionItem.id]
      );
    }
  }

  return createdTasks;
}

function mapPriorityToSalesforce(priority) {
  const mapping = {
    'High': 'High',
    'Medium': 'Normal',
    'Low': 'Low'
  };
  return mapping[priority] || 'Normal';
}
```

---

## PART 6: PULSE CHAT INTEGRATION

### 6.1 Post Meeting Recap

```javascript
async function postMeetingRecapToPulse(meetingId) {
  /**
   * Formats meeting data and posts to Pulse chat
   * Tags action item owners
   */

  const meeting = await db.query(
    'SELECT * FROM meetings WHERE id = $1',
    [meetingId]
  );

  const actionItems = await db.query(
    'SELECT * FROM action_items WHERE meeting_id = $1',
    [meetingId]
  );

  const pulseApiToken = process.env.PULSE_API_TOKEN;

  // Format message with Pulse markdown
  const message = `
🎯 **Meeting Recap: ${meeting.rows[0].title}**

📋 **Summary**
${meeting.rows[0].summary}

✅ **Action Items**
${actionItems.rows.map(ai =>
  `• **${ai.task}** - @${ai.owner_name} (Due: ${ai.due_date})`
).join('\n')}

📊 **Sentiment:** ${meeting.rows[0].sentiment}

[View Full Meeting Details](${process.env.APP_URL}/meetings/${meetingId})
  `;

  try {
    const response = await fetch('https://pulse-api.company.com/messages', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${pulseApiToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        channel_id: process.env.PULSE_DEFAULT_CHANNEL,
        content: message,
        metadata: {
          meeting_id: meetingId,
          type: 'meeting_recap'
        }
      })
    });

    const result = await response.json();

    // Log successful post
    await db.query(
      'INSERT INTO pulse_posts (meeting_id, message_id, content, posted_at, status) VALUES ($1, $2, $3, $4, $5)',
      [meetingId, result.message_id, message, new Date(), 'sent']
    );

  } catch (error) {
    console.error('Failed to post to Pulse:', error);
    await db.query(
      'INSERT INTO pulse_posts (meeting_id, content, status, error_message) VALUES ($1, $2, $3, $4)',
      [meetingId, message, 'failed', error.message]
    );
  }
}
```

---

## PART 7: ERROR HANDLING & MONITORING

### 7.1 Structured Error Handling

```javascript
class MeetingProcessingError extends Error {
  constructor(stage, message, originalError) {
    super(`[${stage}] ${message}`);
    this.stage = stage;
    this.originalError = originalError;
    this.timestamp = new Date();
  }
}

async function processWithErrorHandling(audioFile, meetingMetadata) {
  try {
    // Stage 1: Audio validation
    const audioData = await receiveAndValidateAudio(audioFile, meetingMetadata);

    // Stage 2: Gemini transcription
    const transcription = await transcribeWithGemini(audioData);

    // Stage 3: Prompt processing
    const processor = new MeetingProcessor(transcription.transcript);
    const results = await processor.processAllPrompts();

    // Stage 4: Database storage
    const meeting = await saveMeetingToDB(results);

    // Stage 5: CRM sync (non-critical - can fail independently)
    try {
      await syncActionItemsToSalesforce(meeting.id, results.actionItems);
    } catch (crmError) {
      console.warn('CRM sync failed, will retry:', crmError);
      // Don't throw - CRM sync can happen later
    }

    return meeting;

  } catch (error) {
    // Log structured error
    await logError({
      stage: error.stage || 'unknown',
      message: error.message,
      originalError: error.originalError,
      audioSize: audioFile?.size,
      timestamp: new Date()
    });

    // Alert monitoring system
    await alertMonitoring({
      severity: 'error',
      service: 'meeting-processor',
      error: error.message
    });

    throw error;
  }
}
```

### 7.2 Monitoring & Logging

```javascript
class MeetingProcessingMonitor {
  async logMetrics(meetingId, results) {
    /**
     * Log performance metrics for monitoring/optimization
     */

    await db.query(
      `INSERT INTO processing_metrics 
       (meeting_id, transcript_length, action_items_count, 
        gemini_time_ms, db_write_time_ms, crm_sync_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        meetingId,
        results.transcript.length,
        results.actionItems.length,
        results.timings.gemini,
        results.timings.dbWrite,
        results.timings.crmSync
      ]
    );

    // Alert if processing took too long
    const totalTime = results.timings.gemini + results.timings.dbWrite + results.timings.crmSync;
    if (totalTime > 60000) { // > 1 minute
      await alertMonitoring({
        severity: 'warning',
        message: `Slow meeting processing: ${totalTime}ms`,
        meetingId
      });
    }
  }
}
```

---

## PART 8: TESTING STRATEGY

### 8.1 Unit Tests for Prompt Execution

```javascript
describe('MeetingProcessor', () => {
  it('should summarize meeting transcript', async () => {
    const transcript = `
      [00:00] Sarah: "We're discussing Q1 budget"
      [01:00] John: "I propose increasing digital ads by 25%"
      [02:00] Sarah: "Agreed, moving forward"
    `;

    const processor = new MeetingProcessor(transcript);
    const summary = await processor.runPrompt('summarization', PROMPTS.summarization);

    expect(summary).toContain('Q1 budget');
    expect(summary).toContain('digital ads');
    expect(summary.length).toBeGreaterThan(50);
  });

  it('should extract action items with owner and due date', async () => {
    const transcript = `
      [00:00] Sarah: "Mike, can you select the ad platform by Friday?"
      [00:30] Mike: "Sure, I'll have it done by Friday"
    `;

    const processor = new MeetingProcessor(transcript);
    const items = await processor.runPrompt('actionExtraction', PROMPTS.actionExtraction);

    expect(items).toContain('Mike');
    expect(items).toContain('ad platform');
    expect(items).toContain('Friday');
  });
});
```

### 8.2 Integration Test: Full Pipeline

```javascript
describe('Full Meeting Processing Pipeline', () => {
  it('should process meeting end-to-end', async () => {
    const testAudioFile = 'test_meeting.mp3';
    const meetingMetadata = {
      date: '2025-12-19',
      attendees: [
        { name: 'Sarah', email: 'sarah@company.com' },
        { name: 'John', email: 'john@company.com' }
      ],
      durationSeconds: 300
    };

    const result = await processWithErrorHandling(testAudioFile, meetingMetadata);

    expect(result.id).toBeDefined();
    expect(result.transcript).toBeDefined();
    expect(result.summary).toBeDefined();
    expect(result.actionItems.length).toBeGreaterThan(0);
    expect(result.actionItems[0]).toHaveProperty('owner');
    expect(result.actionItems[0]).toHaveProperty('due_date');
  });
});
```

---

## PART 9: DEPLOYMENT CHECKLIST

### Before Production Deploy:

- [ ] All 5 Gemini prompts tested with 10+ real meeting transcripts
- [ ] Error handling implemented for all 5 pipeline stages
- [ ] Database migrations applied (all tables created)
- [ ] CRM API credentials configured and tested
- [ ] Pulse API integration tested with test messages
- [ ] Rate limiting configured (60 req/min)
- [ ] Monitoring/alerting set up
- [ ] Logging structured and searchable
- [ ] Audio file storage configured (GCS or S3)
- [ ] API key rotation policy established
- [ ] Load testing completed (simulate 100 concurrent requests)
- [ ] Rollback plan documented

---

## PART 10: QUICK START CODE EXAMPLES

### Complete Node.js Setup

```javascript
// index.js
require('dotenv').config();
const express = require('express');
const { MeetingProcessor } = require('./services/meeting-processor');
const { CRMSync } = require('./services/crm-sync');
const { PulseIntegration } = require('./services/pulse-integration');

const app = express();
app.use(express.json());

// Meeting processing endpoint
app.post('/api/meetings/process', async (req, res) => {
  try {
    const meeting = await MeetingProcessor.processAudio(
      req.files.audio,
      req.body
    );
    
    // Async operations (non-blocking)
    CRMSync.syncActionItems(meeting);
    PulseIntegration.postRecap(meeting);

    res.json({ success: true, meetingId: meeting.id });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
```

---

**This guide is your reference for building the complete Phase 1 MVP with Gemini, your databases, and integrations.**