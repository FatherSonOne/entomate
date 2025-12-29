# Gemini AI Studio: App Connector Assistant - Phase 1 Implementation Guide

**For Non-Technical Builders Using Gemini AI Studio**

---

## SECTION 1: UNDERSTANDING WHAT WE'RE BUILDING

### What is Gemini AI?
Gemini is Google's most advanced AI model. Think of it like a super-smart assistant that can:
- Listen to audio and convert it to text (transcription)
- Read and understand long documents
- Answer questions about content
- Extract important information (like action items from meetings)
- Generate summaries and reports
- Understand context across multiple conversations

**In simple terms:** Gemini is the "brain" that will power your app connector assistant.

### What is Google AI Studio?
Google AI Studio is an **easy-to-use interface** (no coding required to start) where you can:
1. Write instructions for Gemini
2. Test those instructions with sample data
3. See results in real-time
4. Copy working code when you're ready

**Think of it like:** A playground where you write prompts, test them, and then hand them to developers to build into your app.

### The MVP We're Building (Phase 1)
```
Meeting Happens
    ↓
Gemini transcribes & summarizes
    ↓
Gemini extracts action items
    ↓
Pulse chat gets notified
    ↓
CRM gets updated with tasks
```

---

## SECTION 2: GETTING STARTED WITH GOOGLE AI STUDIO

### Step 1: Create Your API Key

**Simple Path (No Setup Required):**
1. Go to [Google AI Studio](https://aistudio.google.com)
2. Click "Create new" → "New API key"
3. Select "Create API key in existing project" or "Create new project"
4. **Copy and save this key** - you'll need it later
5. Keep it SECRET (like a password)

**What you now have:** A unique code that lets your app talk to Gemini

### Step 2: Access Google AI Studio

1. Still at [Google AI Studio](https://aistudio.google.com)
2. Click "Create new" → "New chat"
3. You'll see a prompt box at the bottom

**This is your testing ground.** You'll write instructions here first.

---

## SECTION 3: BUILDING THE CORE PROMPTS

### Understanding Prompts
A "prompt" is like giving Gemini instructions. Good prompts are:
- **Clear** - specific about what you want
- **Contextual** - explain what the data is
- **Structured** - ask for organized output (like lists, JSON)

---

## PROMPT #1: Meeting Transcription & Summarization

**Where this runs:** After a meeting ends, the audio file is sent to Gemini

### Test This In AI Studio First

**In the AI Studio prompt box, paste this:**

```
You are an intelligent meeting assistant for a sales and team collaboration platform.

Your task is to process a meeting transcript and create a comprehensive summary.

INPUT: A meeting transcript with speaker names and timestamps
OUTPUT: A structured summary with the following format:

**MEETING OVERVIEW**
- Duration: [minutes]
- Attendees: [list names]
- Main Topic: [one-line summary]

**KEY DISCUSSION POINTS**
1. [Point 1]
2. [Point 2]
3. [Point 3]

**SENTIMENT ANALYSIS**
- Overall Sentiment: [Positive/Neutral/Negative]
- Key Emotional Moments: [describe if any tensions or celebrations]

**DECISIONS MADE**
- [Decision 1]
- [Decision 2]

**ACTION ITEMS** (extracted in next prompt)

Be concise but comprehensive. Focus on business-critical information.
```

**To test it:**
1. Paste the prompt above
2. Then paste a sample meeting transcript (or use this example):

```
Speaker: Sarah
Time: 0:00
We're here to discuss Q1 budget allocation for the marketing team.

Speaker: John
Time: 0:45
I think we should increase digital advertising by 25% given our conversion rates have improved.

Speaker: Sarah
Time: 2:15
I agree. Let's also allocate 15K for content creation. We're seeing good engagement with blog posts.

Speaker: Mike
Time: 3:30
That makes sense. I'll own the vendor selection for the ad platform by Friday.

Speaker: Sarah
Time: 4:45
Great. So to recap: increase digital ads 25%, add 15K for content, Mike owns vendor selection. Next week we review results.
```

**Hit Send** and watch Gemini summarize it.

---

## PROMPT #2: Action Item Extraction

**Where this runs:** Right after summary, to pull out specific tasks

### Test This In AI Studio

**In the AI Studio, use this prompt:**

```
You are an action item extraction specialist for a business collaboration platform.

Your task: Extract clear, assignable action items from a meeting transcript.

For each action item, identify:
1. **TASK**: What needs to be done (imperative verb: "Review", "Create", "Send", etc.)
2. **OWNER**: Who is responsible (name or role)
3. **DUE_DATE**: When it's due (next day, Friday, specific date if mentioned)
4. **PRIORITY**: High/Medium/Low based on business impact
5. **DESCRIPTION**: 2-3 sentence detail about what the task entails

OUTPUT FORMAT (as a numbered list):

1. TASK: [action]
   OWNER: [name]
      DUE_DATE: [date]
         PRIORITY: [level]
            DESCRIPTION: [details]

            2. TASK: [action]
               OWNER: [name]
                  DUE_DATE: [date]
                     PRIORITY: [level]
                        DESCRIPTION: [details]

                        Rules:
                        - Only extract items with clear ownership (not "we should consider")
                        - If no specific date mentioned, use "This week" or "ASAP"
                        - If owner is unclear, use the role mentioned
                        - Tasks should be specific enough to act on immediately
                        ```

**Then paste the transcript again.** Gemini will extract action items like:

```
1. TASK: Select vendor for digital advertising platform
   OWNER: Mike
   DUE_DATE: Friday
   PRIORITY: High
   DESCRIPTION: Choose and recommend an ad platform vendor based on our conversion rate improvements. This will support the 25% increase in digital advertising spend approved in this meeting.

2. TASK: Review Q1 budget allocation results
   OWNER: Sarah
   DUE_DATE: Next week
   PRIORITY: Medium
   DESCRIPTION: Meet to review how the increased digital advertising and content creation budget performed against our conversion targets.
```

**Save this prompt - you'll use it.**

---

## PROMPT #3: Meeting Prep Brief from CRM Context

**Where this runs:** Before a meeting, Gemini reads CRM data about the attendees/company

### Test This In AI Studio

```
You are a meeting preparation specialist. Your role is to help salespeople and team members walk into meetings fully informed.

You will receive:
1. Meeting details (attendees, time, purpose)
2. CRM data about the company/people

Your task: Generate a 2-minute pre-meeting brief.

OUTPUT FORMAT:

**MEETING BRIEF: [Company Name]**

**WHO YOU'RE MEETING**
- [Name], [Title], [Background from CRM]
- [Name], [Title], [Background from CRM]

**RELATIONSHIP HISTORY**
- Last meeting: [date and outcome]
- Open opportunities: [$ amount and status]
- Known challenges: [pain points from notes]

**TALKING POINTS TO LEAD WITH**
1. [Reference a past win or shared goal]
2. [Address known pain point]
3. [Relevant product/service capability]

**THINGS TO AVOID**
- [Previous objection or sensitive topic]
- [Competitor mentioned before]

**NEXT STEPS TO PROPOSE**
- [Suggested action based on pipeline stage]

---

Keep it brief and actionable. The person reading this has 2 minutes before walking into the meeting.
```

---

## SECTION 4: STRUCTURING OUTPUT FOR YOUR APPS

### What is JSON?
JSON is a way to format information so computers can read it easily. Think of it like organizing data into labeled boxes.

**Example:**
```json
{
  "action_item": {
    "task": "Select vendor for advertising",
    "owner": "Mike",
    "due_date": "2025-12-19",
    "priority": "High"
  }
}
```

### PROMPT #4: Extracting Structured JSON for CRM

**This is the crucial one** - it tells Gemini to give you data you can push into your CRM

```
You are a data extraction specialist. Extract information from meeting transcripts in a structured JSON format that can be directly inserted into a CRM system.

INPUT: A meeting transcript
OUTPUT: JSON with the following structure:

{
  "meeting": {
    "title": "string - brief meeting name",
    "date": "YYYY-MM-DD",
    "duration_minutes": number,
    "attendees": [
      {
        "name": "string",
        "role": "string"
      }
    ],
    "sentiment": "positive|neutral|negative",
    "summary": "string - 2-3 sentences"
  },
  "action_items": [
    {
      "task": "string - specific action",
      "owner": "string - person name",
      "due_date": "YYYY-MM-DD or 'ASAP'",
      "priority": "High|Medium|Low",
      "description": "string",
      "status": "Not Started"
    }
  ],
  "decisions": [
    {
      "decision": "string",
      "owner": "string - who made/owns it",
      "impact": "string - why it matters"
    }
  ],
  "next_steps": [
    {
      "step": "string",
      "owner": "string",
      "target_date": "YYYY-MM-DD"
    }
  ]
}

Rules:
1. Date format must be YYYY-MM-DD (example: 2025-12-19)
2. If date not mentioned, use "ASAP"
3. Only include items with clear ownership
4. Sentiment should reflect overall tone of meeting
5. Return ONLY valid JSON, no extra text

Example input transcript:
[transcript here]

Return only the JSON, no markdown formatting.
```

**After you test this and it works, save it.**

---

## SECTION 5: ASKING GEMINI QUESTIONS ("Ask Assistant")

### PROMPT #5: Q&A About Meeting Content

**Where this runs:** In Pulse chat, when someone asks "What did we agree on with Acme?"

```
You are a meeting intelligence assistant. Users will ask questions about meeting content.

You have access to:
1. The meeting transcript
2. The extracted summary
3. The action items
4. Previous meeting notes with this company

Your task: Answer the user's question with specific references.

RESPONSE GUIDELINES:
- Answer directly and concisely
- Reference the meeting date and specific speaker if relevant
- If information isn't in the meeting, say "This wasn't discussed in the meeting"
- Provide context from previous meetings only if it clarifies the current question
- Suggest next steps if relevant

User question: [question from chat]
Meeting data: [transcript + summary + action items]

Provide a response suitable for posting in a team chat (under 200 words).
```

---

## SECTION 6: IMPLEMENTATION WORKFLOW (HOW IT ALL CONNECTS)

### The Complete Flow for Phase 1

```
┌─────────────────────────────────────────────────────────────┐
│ 1. MEETING HAPPENS                                          │
│    - Zoom/Teams/Google Meet is recorded                     │
│    - Meeting ID and participants tracked                    │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 2. AUDIO CAPTURED & SENT TO GEMINI                          │
│    - Your backend service receives meeting audio            │
│    - Audio file sent to Gemini API (we'll show code)        │
│    - Gemini returns full transcript                         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 3. GEMINI PROCESSES WITH PROMPTS #1-4                       │
│    - Summarization (Prompt #1)                              │
│    - Action item extraction (Prompt #2)                     │
│    - Sentiment analysis (embedded in #4)                    │
│    - Structured JSON output (Prompt #4)                     │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 4. DATA STORED IN YOUR DATABASE                             │
│    - Raw transcript stored                                  │
│    - Summary cached                                         │
│    - Action items saved with owner/due date                 │
│    - JSON stored for quick retrieval                        │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 5. CRM SYNC HAPPENS                                         │
│    - Action items → Create tasks in CRM                     │
│    - Attendees → Link to their contact records              │
│    - Meeting summary → Add to company activity log          │
│    - Meeting linked to deal/opportunity if relevant         │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 6. PULSE NOTIFICATION SENT                                  │
│    - Bot posts meeting recap in relevant channel            │
│    - Tags owners of action items                            │
│    - Provides link back to full meeting record              │
│    - Highlights critical decisions                          │
└────────────┬────────────────────────────────────────────────┘
             │
             ▼
┌─────────────────────────────────────────────────────────────┐
│ 7. USERS CAN NOW:                                           │
│    - Ask the assistant about meeting content                │
│    - Update action item status in CRM                       │
│    - Search meeting history                                 │
│    - Track team performance from dashboard                  │
└─────────────────────────────────────────────────────────────┘
```

---

## SECTION 7: YOUR DEVELOPMENT CHECKLIST FOR PHASE 1

### Week 1: Prompts & Testing
- [ ] Sign up for Google AI Studio
- [ ] Create API key
- [ ] Test all 5 prompts with sample meeting transcripts
- [ ] Refine each prompt based on output
- [ ] Document what works for your use case
- [ ] Create sample output JSON for your developers

### Week 2: Backend Integration
- [ ] Developers integrate Gemini API into your backend
- [ ] Set up audio processing pipeline (capture → upload → Gemini)
- [ ] Create database tables for:
  - meetings (id, date, transcript, summary)
  - action_items (id, task, owner, due_date, crm_sync_status)
  - meeting_embeddings (for semantic search later)
- [ ] Test full pipeline end-to-end with sample meeting

### Week 3: CRM Sync
- [ ] Map action items to CRM task creation
- [ ] Test creating 10 tasks in CRM from a single meeting
- [ ] Set up attendee linking (meeting participants → CRM contacts)
- [ ] Add meeting to company activity timeline

### Week 4: Pulse Integration
- [ ] Build Pulse bot that posts meeting recaps
- [ ] Format recap message (summary + action items)
- [ ] Tag action item owners
- [ ] Add link to full meeting details

---

## SECTION 8: EXAMPLE CODE (FOR YOUR DEVELOPERS)

### What Your Developers Will Build

This is **pseudocode** (simplified instructions) showing how everything connects. Actual code will vary by language (Python, Node.js, etc.).

#### Step 1: Upload Meeting Audio to Gemini

```
Function: ProcessMeetingAudio

Input: 
  - audio_file (MP3 or WAV from meeting recording)
  - meeting_id (unique identifier)
  - attendees (list of people in meeting)

Steps:
1. Read the audio file
2. Send to Gemini API with this instruction:
   "Transcribe this meeting and provide a detailed transcript with speaker identification"
3. Store returned transcript in database
4. Return transcript to next function

Gemini will give back:
[00:00] Sarah: "We're here to discuss Q1 budget..."
[00:45] John: "I think we should increase digital advertising..."
```

#### Step 2: Extract Summary (Using Prompt #1)

```
Function: SummarizeMeeting

Input:
  - transcript (from Step 1)

Steps:
1. Send transcript to Gemini with Prompt #1 (summarization)
2. Gemini returns structured summary
3. Store summary in database
4. Return to next function

Output example:
{
  "title": "Q1 Budget Discussion",
  "duration": "5 minutes",
  "key_points": ["Increase digital ads 25%", "Add 15K for content creation"],
  "sentiment": "positive"
}
```

#### Step 3: Extract Action Items (Using Prompt #4)

```
Function: ExtractActionItems

Input:
  - transcript (from Step 1)

Steps:
1. Send transcript to Gemini with Prompt #4 (JSON extraction)
2. Gemini returns structured JSON with action items
3. Parse the JSON
4. For each action item:
   - Store in database
   - Identify CRM owner by name
   - Calculate due date
   - Mark as "Not Started"
5. Return action items list

Output example:
[
  {
    "task": "Select vendor for digital advertising",
    "owner": "Mike",
    "due_date": "2025-12-19",
    "priority": "High"
  }
]
```

#### Step 4: Sync to CRM

```
Function: SyncActionItemsToCRM

Input:
  - action_items (from Step 3)
  - crm_config (your CRM login credentials)

Steps:
1. For each action item:
   - Find the owner in CRM by name
   - Create a new Task in CRM with:
     * Title: the task name
     * Owner: the person
     * Due Date: calculated date
     * Description: detailed description
     * Link back to this meeting
   - Mark as synced in database
2. Log which items were created
3. Alert on any failed syncs

Result: Tasks appear in CRM, assigned to correct person
```

#### Step 5: Post to Pulse Chat

```
Function: PostMeetingRecapToPulse

Input:
  - summary (from Step 2)
  - action_items (from Step 3)
  - channel_id (where to post in Pulse)

Steps:
1. Format message for Pulse:
   "🎯 Meeting Recap: [Meeting Title]
   
   **Summary**
   [3-4 sentence summary]
   
   **Action Items**
   • [Task 1] - @[Owner] due [Date]
   • [Task 2] - @[Owner] due [Date]
   
   [Link to full meeting details]"
   
2. Send formatted message to Pulse channel
3. Verify it posted successfully

Result: Entire team sees recap in Pulse, action item owners get tagged
```

---

## SECTION 9: TESTING YOUR SETUP

### How to Validate Phase 1 Works

**Test Scenario:**

1. **Prepare a sample meeting recording** (even just voice memo, 2-3 minutes)
   - Or use YouTube video with subtitles

2. **In AI Studio, paste the transcript** and run through prompts

3. **Check outputs:**
   - ✅ Summary is accurate and concise
   - ✅ Action items have clear owner and due date
   - ✅ Sentiment analysis makes sense
   - ✅ JSON is valid (can copy/paste into [jsonlint.com](https://jsonlint.com) to verify)

4. **After developers build the backend:**
   - ✅ Upload a real meeting recording
   - ✅ Verify transcript appears in database
   - ✅ Verify action items created in CRM
   - ✅ Verify Pulse message posted correctly

**Success Criteria for Phase 1:**
- Transcription accuracy > 95%
- Action items extracted with 100% accuracy (test with 3 meetings)
- CRM sync has 0 failures
- Pulse notifications deliver within 5 seconds

---

## SECTION 10: NEXT STEPS AFTER PHASE 1 WORKS

Once Phase 1 is solid, you'll build Phase 2 (Weeks 5-8) with:
- CRM context retrieval for meeting prep
- Real-time sentiment tracking
- Automated task assignment optimization
- "Ask Assistant" Q&A feature in Pulse

But first, **get Phase 1 deployed and working with real meetings.**

---

## QUICK REFERENCE: YOUR PROMPTS

**Save all 5 prompts in a shared document for your developers:**

1. **Summarization** - Create overview of meeting
2. **Action Item Extraction** - Pull out tasks with owners
3. **Meeting Prep** - Brief before meeting starts
4. **Structured JSON** - Format data for CRM sync
5. **Q&A Assistant** - Answer questions about meetings

Each prompt is self-contained and can be tested independently in Google AI Studio.

---

## SUPPORT & LEARNING RESOURCES

- **Google AI Studio docs:** https://ai.google.dev
- **Gemini API reference:** https://ai.google.dev/gemini-api/docs
- **Test your JSON:** https://jsonlint.com
- **Sample transcripts for testing:** [Will provide examples]

---

**Remember:** You don't need to code. Your job is to:
1. ✅ Understand what each prompt does
2. ✅ Test prompts in AI Studio with real meeting data
3. ✅ Provide feedback to developers
4. ✅ Guide refinement until output quality is perfect
5. ✅ Validate end-to-end integration works