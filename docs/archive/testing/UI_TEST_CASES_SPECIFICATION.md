# ENTOMATE UI TEST CASES - DETAILED SPECIFICATION

**Test Suite:** Comprehensive UI & Functionality Testing
**Total Test Cases:** 130
**Application:** Entomate Meeting Intelligence Platform
**QA Framework:** Evidence-Based Testing with Screenshot Validation

---

## TEST EXECUTION REQUIREMENTS

### Prerequisites
1. Application running and accessible (both frontend and backend)
2. Database populated with test data
3. Screenshot capture tool ready
4. Test user account configured
5. Browser: Chrome (latest), Firefox (latest)
6. Screen resolution: 1920x1080 (desktop), 768x1024 (tablet), 375x667 (mobile)

### Evidence Standards
- **Every test case requires screenshot evidence**
- **Pass:** Green checkmark + screenshot showing expected behavior
- **Fail:** Red X + screenshot showing issue + steps to reproduce
- **Format:** test-case-id-description.png (e.g., M-001-audio-upload-success.png)

---

## M: MEETINGS FUNCTIONALITY (35 Test Cases)

### M-001: Audio Upload - WAV Format
**Priority:** P0
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Click file upload (if available) or recording area
4. Upload test.wav file (10MB)
5. Enter title "Test WAV Upload"
6. Click process/upload

**Expected Result:**
- File uploads successfully
- Progress indicator shows
- Transcription begins
- Success message displays

**Screenshots Required:**
- m-001-before-upload.png
- m-001-uploading.png
- m-001-processing.png
- m-001-success.png

**Pass Criteria:**
- File accepted
- Transcription completes within 30 seconds
- Meeting appears in list

---

### M-002: Audio Upload - MP3 Format
**Priority:** P0
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Upload test.mp3 file (5MB)
4. Enter title "Test MP3 Upload"

**Expected Result:**
- MP3 file accepted and processed

**Screenshots Required:**
- m-002-file-selected.png
- m-002-success.png

---

### M-003: Audio Upload - M4A Format
**Priority:** P0
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Upload test.m4a file (8MB)

**Expected Result:**
- M4A file accepted and processed

**Screenshots Required:**
- m-003-file-selected.png
- m-003-success.png

---

### M-004: Audio Upload - Invalid Format Rejection
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Try to upload test.txt file

**Expected Result:**
- Error message: "Invalid file format. Please upload .wav, .mp3, .m4a, or .webm"
- File not uploaded

**Screenshots Required:**
- m-004-invalid-file.png
- m-004-error-message.png

---

### M-005: Audio Upload - File Size Limit (Over 100MB)
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Try to upload 150MB audio file

**Expected Result:**
- Error message: "File too large. Maximum size is 100MB"
- Upload prevented

**Screenshots Required:**
- m-005-large-file.png
- m-005-error-message.png

---

### M-006: Live Audio Recording
**Priority:** P0
**Steps:**
1. Navigate to /meetings
2. Click "New Meeting" button
3. Click "Start Recording"
4. Grant microphone permission
5. Speak for 10 seconds
6. Click "Stop Recording"

**Expected Result:**
- Recording indicator shows
- Timer counts up
- Audio visualizer animates
- Recording saves successfully

**Screenshots Required:**
- m-006-before-recording.png
- m-006-permission-prompt.png
- m-006-recording-active.png
- m-006-after-stop.png
- m-006-processing.png

---

### M-007: Meeting List Display
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Verify meeting list loads

**Expected Result:**
- All meetings display in cards
- Each card shows: title, date, duration, attendee count, sentiment emoji
- Cards are clickable

**Screenshots Required:**
- m-007-meeting-list.png
- m-007-meeting-card-details.png

---

### M-008: Meeting Search - Exact Match
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Enter "Sprint Planning" in search box

**Expected Result:**
- Only meetings with "Sprint Planning" in title or summary appear
- Other meetings filtered out

**Screenshots Required:**
- m-008-before-search.png
- m-008-search-results.png

---

### M-009: Meeting Search - Partial Match
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Enter "plan" in search box

**Expected Result:**
- All meetings containing "plan" (case-insensitive) appear

**Screenshots Required:**
- m-009-partial-search.png

---

### M-010: Meeting Search - No Results
**Priority:** P2
**Steps:**
1. Navigate to /meetings
2. Enter "xyz123nonexistent" in search box

**Expected Result:**
- Empty state message: "No meetings found. Try a different search term"
- Helpful icon displayed

**Screenshots Required:**
- m-010-no-results.png

---

### M-011: Meeting Detail - Navigation
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Click on first meeting card

**Expected Result:**
- Redirects to /meetings/{id}
- Meeting detail page loads
- Back arrow visible

**Screenshots Required:**
- m-011-meeting-detail.png

---

### M-012: Meeting Detail - Summary Display
**Priority:** P1
**Steps:**
1. Navigate to meeting detail page

**Expected Result:**
- Summary section visible
- Summary text readable
- Sentiment emoji displayed

**Screenshots Required:**
- m-012-summary-section.png

---

### M-013: Meeting Detail - Key Points
**Priority:** P1
**Steps:**
1. Navigate to meeting detail page
2. Scroll to Key Points section

**Expected Result:**
- Key points listed with numbers
- Each point readable
- Numbered badges visible

**Screenshots Required:**
- m-013-key-points.png

---

### M-014: Meeting Detail - Decisions Display
**Priority:** P1
**Steps:**
1. Navigate to meeting detail page
2. Scroll to Decisions section

**Expected Result:**
- Decisions listed with checkmarks
- Clear formatting

**Screenshots Required:**
- m-014-decisions.png

---

### M-015: Meeting Detail - Full Transcript
**Priority:** P1
**Steps:**
1. Navigate to meeting detail page
2. Scroll to Full Transcript section

**Expected Result:**
- Transcript visible in monospace font
- Scrollable area
- Readable text

**Screenshots Required:**
- m-015-transcript.png
- m-015-transcript-scrolled.png

---

### M-016: Ask AI - Question Submission
**Priority:** P0
**Steps:**
1. Navigate to meeting detail page
2. In "Ask About This Meeting" section, enter: "What were the action items?"
3. Click send button

**Expected Result:**
- Loading spinner shows
- Answer appears in response box
- Confidence score displayed

**Screenshots Required:**
- m-016-question-entered.png
- m-016-loading.png
- m-016-answer-received.png

---

### M-017: Ask AI - Empty Question
**Priority:** P2
**Steps:**
1. Navigate to meeting detail page
2. Click send button without entering question

**Expected Result:**
- Send button disabled
- No API call made

**Screenshots Required:**
- m-017-empty-question.png

---

### M-018: Sentiment Analysis - Positive
**Priority:** P1
**Steps:**
1. Create/view meeting with positive sentiment

**Expected Result:**
- Happy emoji (😊) displayed
- Green "Positive" badge
- Badge readable

**Screenshots Required:**
- m-018-positive-sentiment.png

---

### M-019: Sentiment Analysis - Negative
**Priority:** P1
**Steps:**
1. Create/view meeting with negative sentiment

**Expected Result:**
- Sad emoji (😟) displayed
- Red "Negative" badge

**Screenshots Required:**
- m-019-negative-sentiment.png

---

### M-020: Sentiment Analysis - Neutral
**Priority:** P1
**Steps:**
1. Create/view meeting with neutral sentiment

**Expected Result:**
- Neutral emoji (😐) displayed
- Gray "Neutral" badge

**Screenshots Required:**
- m-020-neutral-sentiment.png

---

### M-021: Sync to CRM - Success
**Priority:** P0
**Steps:**
1. Navigate to meeting detail page
2. Click "Sync to CRM" button
3. Wait for response

**Expected Result:**
- Loading spinner on button
- Success message appears
- Action items marked as synced

**Screenshots Required:**
- m-021-before-sync.png
- m-021-syncing.png
- m-021-after-sync.png

---

### M-022: Sync to CRM - No Action Items
**Priority:** P2
**Steps:**
1. Navigate to meeting with 0 action items
2. Click "Sync to CRM" button

**Expected Result:**
- Error or info message: "No action items to sync"

**Screenshots Required:**
- m-022-no-action-items.png

---

### M-023: Post to Chat - Channel Selection
**Priority:** P0
**Steps:**
1. Navigate to meeting detail page
2. Click "Share" button
3. Modal opens

**Expected Result:**
- Modal displays with title "Share Meeting Recap"
- Channel selector dropdown visible
- Channels populated

**Screenshots Required:**
- m-023-share-modal.png
- m-023-channel-dropdown.png

---

### M-024: Post to Chat - Success
**Priority:** P0
**Steps:**
1. Open share modal
2. Select channel "#general"
3. Click "Post Recap"

**Expected Result:**
- Loading state on button
- Success message appears
- Modal closes after 2 seconds

**Screenshots Required:**
- m-024-channel-selected.png
- m-024-posting.png
- m-024-success-message.png

---

### M-025: Post to Chat - Already Posted Indicator
**Priority:** P2
**Steps:**
1. Navigate to meeting that was already posted
2. Check Share button

**Expected Result:**
- Green dot indicator on Share button
- Tooltip: "Already posted"

**Screenshots Required:**
- m-025-already-posted.png

---

### M-026: Delete Meeting - Confirmation
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Click delete button on meeting card
3. Browser confirmation dialog appears

**Expected Result:**
- Confirmation dialog: "Are you sure you want to delete this meeting?"
- Meeting not deleted until confirmed

**Screenshots Required:**
- m-026-delete-button-hover.png
- m-026-confirmation-dialog.png

---

### M-027: Delete Meeting - Success
**Priority:** P1
**Steps:**
1. Navigate to /meetings
2. Click delete button
3. Click "OK" in confirmation

**Expected Result:**
- Meeting removed from list immediately
- No error message

**Screenshots Required:**
- m-027-before-delete.png
- m-027-after-delete.png

---

### M-028: Delete Meeting - Cancel
**Priority:** P2
**Steps:**
1. Navigate to /meetings
2. Click delete button
3. Click "Cancel" in confirmation

**Expected Result:**
- Meeting not deleted
- Still visible in list

**Screenshots Required:**
- m-028-cancelled-delete.png

---

### M-029: Action Items Display
**Priority:** P1
**Steps:**
1. Navigate to meeting detail page
2. Check Action Items sidebar

**Expected Result:**
- Action items count displayed
- List of action items visible
- Each item shows task description

**Screenshots Required:**
- m-029-action-items-list.png

---

### M-030: Meeting List - Loading State
**Priority:** P2
**Steps:**
1. Navigate to /meetings
2. Observe loading animation

**Expected Result:**
- Spinner visible
- "Loading meetings..." text
- Smooth transition when loaded

**Screenshots Required:**
- m-030-loading-state.png

---

### M-031: Meeting List - Empty State
**Priority:** P2
**Steps:**
1. Navigate to /meetings with no meetings in database

**Expected Result:**
- Empty state message
- "Record your first meeting to get started"
- MessageSquare icon

**Screenshots Required:**
- m-031-empty-state.png

---

### M-032: Meeting Detail - 404 Error
**Priority:** P2
**Steps:**
1. Navigate to /meetings/nonexistent-id

**Expected Result:**
- "Meeting not found" message
- "Back to meetings" link

**Screenshots Required:**
- m-032-meeting-not-found.png

---

### M-033: Audio Visualizer Animation
**Priority:** P2
**Steps:**
1. Start live recording
2. Speak into microphone

**Expected Result:**
- Visualizer bars animate with audio input
- Responsive to volume changes

**Screenshots Required:**
- m-033-visualizer-silent.png
- m-033-visualizer-speaking.png

---

### M-034: Recording Timer Accuracy
**Priority:** P2
**Steps:**
1. Start recording
2. Wait exactly 60 seconds
3. Check timer display

**Expected Result:**
- Timer shows 01:00
- Format: MM:SS

**Screenshots Required:**
- m-034-timer-60-seconds.png

---

### M-035: Meeting Processing Error
**Priority:** P1
**Steps:**
1. Upload corrupt audio file or trigger backend error

**Expected Result:**
- Error message displayed
- User-friendly text
- Red alert icon

**Screenshots Required:**
- m-035-processing-error.png

---

## A: AGENTS PAGE (25 Test Cases)

### A-001: Agent List Display
**Priority:** P1
**Steps:**
1. Navigate to /agents

**Expected Result:**
- All deployed agents listed
- Each agent shows name, description, status
- Execution count and success rate visible

**Screenshots Required:**
- a-001-agents-list.png

---

### A-002: Agent List - Empty State
**Priority:** P2
**Steps:**
1. Navigate to /agents with no agents deployed

**Expected Result:**
- Empty state with Bot icon
- "No active agents" message
- "Deploy First Agent" button

**Screenshots Required:**
- a-002-empty-state.png

---

### A-003: View Agent Templates Modal
**Priority:** P0
**Steps:**
1. Navigate to /agents
2. Click "From Template" button

**Expected Result:**
- Modal opens with title "Agent Templates"
- Category tabs visible: All, Sales, Meetings, Operations, etc.
- Templates displayed in grid

**Screenshots Required:**
- a-003-templates-modal.png
- a-003-templates-grid.png

---

### A-004: Template Count Verification
**Priority:** P0
**Steps:**
1. Open templates modal
2. Count total templates

**Expected Result:**
- 17 templates visible (per spec)
- All templates have icon, name, description

**Screenshots Required:**
- a-004-template-count.png

---

### A-005: Template Categories - AI
**Priority:** P1
**Steps:**
1. Open templates modal
2. Click "AI" category tab

**Expected Result:**
- Only AI-powered templates visible
- Bot icon and "AI Agent" badge displayed

**Screenshots Required:**
- a-005-ai-templates.png

---

### A-006: Template Categories - Sales
**Priority:** P1
**Steps:**
1. Open templates modal
2. Click "Sales" category tab

**Expected Result:**
- Sales-related templates visible
- Appropriate icons (💰, 🎯)

**Screenshots Required:**
- a-006-sales-templates.png

---

### A-007: Quick Deploy - Success
**Priority:** P0
**Steps:**
1. Open templates modal
2. Find "Lead Enrichment Agent" template
3. Click "Quick Deploy" button

**Expected Result:**
- Loading spinner on button
- "Deploying..." text
- Agent appears in active fleet after deployment

**Screenshots Required:**
- a-007-before-deploy.png
- a-007-deploying.png
- a-007-deployed-agent.png

---

### A-008: Quick Deploy - Error Handling
**Priority:** P1
**Steps:**
1. Open templates modal
2. Trigger deployment error (disconnect network or invalid config)
3. Click "Quick Deploy"

**Expected Result:**
- Red error banner appears
- Error message: "Deployment Failed"
- Details shown

**Screenshots Required:**
- a-008-deployment-error.png

---

### A-009: Customize Agent - Open Modal
**Priority:** P0
**Steps:**
1. Open templates modal
2. Click "Customize" button on any template

**Expected Result:**
- Customize modal opens
- Title: "Customize Agent Logic"
- Form fields populated with template defaults

**Screenshots Required:**
- a-009-customize-modal.png

---

### A-010: Customize Agent - Edit Name
**Priority:** P1
**Steps:**
1. Open customize modal
2. Change agent name to "My Custom Agent"

**Expected Result:**
- Name updates in preview section
- Character limit enforced (if any)

**Screenshots Required:**
- a-010-name-edited.png

---

### A-011: Customize Agent - Edit Description
**Priority:** P1
**Steps:**
1. Open customize modal
2. Edit description field

**Expected Result:**
- Description updates in preview

**Screenshots Required:**
- a-011-description-edited.png

---

### A-012: Customize Agent - View Triggers
**Priority:** P1
**Steps:**
1. Open customize modal
2. Check Triggers section

**Expected Result:**
- Triggers listed with type
- Remove button (X) for each trigger

**Screenshots Required:**
- a-012-triggers-list.png

---

### A-013: Customize Agent - Remove Trigger
**Priority:** P2
**Steps:**
1. Open customize modal
2. Click X button on trigger

**Expected Result:**
- Trigger removed from list
- Count updates

**Screenshots Required:**
- a-013-trigger-removed.png

---

### A-014: Customize Agent - View Actions
**Priority:** P1
**Steps:**
1. Open customize modal
2. Check Actions section

**Expected Result:**
- Actions listed with numbered badges
- Action type displayed

**Screenshots Required:**
- a-014-actions-list.png

---

### A-015: Customize Agent - Deploy Custom Agent
**Priority:** P0
**Steps:**
1. Customize agent (name, triggers, actions)
2. Click "Deploy Agent" button

**Expected Result:**
- Loading state
- Agent appears in fleet
- Customizations applied

**Screenshots Required:**
- a-015-deploy-custom.png
- a-015-custom-deployed.png

---

### A-016: Select Agent - View Diagnostics
**Priority:** P1
**Steps:**
1. Navigate to /agents
2. Click on agent card

**Expected Result:**
- Agent Diagnostics panel appears on right
- Configuration details shown
- Live Logs terminal visible

**Screenshots Required:**
- a-016-agent-selected.png
- a-016-diagnostics-panel.png

---

### A-017: Agent Toggle - Pause Agent
**Priority:** P1
**Steps:**
1. Select running agent
2. Click Pause button in diagnostics panel

**Expected Result:**
- Agent status changes to paused
- Icon changes from Play to Pause
- Animated pulse stops

**Screenshots Required:**
- a-017-before-pause.png
- a-017-after-pause.png

---

### A-018: Agent Toggle - Resume Agent
**Priority:** P1
**Steps:**
1. Select paused agent
2. Click Play button

**Expected Result:**
- Agent status changes to active
- Green pulse animation starts

**Screenshots Required:**
- a-018-resumed-agent.png

---

### A-019: Agent Configuration Display
**Priority:** P2
**Steps:**
1. Select agent
2. View Configuration section in diagnostics

**Expected Result:**
- Trigger type displayed
- Action count displayed

**Screenshots Required:**
- a-019-configuration.png

---

### A-020: Live Logs Display
**Priority:** P1
**Steps:**
1. Select agent with execution history
2. View Live Logs terminal

**Expected Result:**
- Logs displayed in terminal style
- Green text on black background
- Timestamps shown

**Screenshots Required:**
- a-020-live-logs.png

---

### A-021: Live Logs - Empty State
**Priority:** P2
**Steps:**
1. Select agent with no executions
2. View Live Logs

**Expected Result:**
- Gray text: "// Waiting for execution..."

**Screenshots Required:**
- a-021-logs-empty.png

---

### A-022: Performance Analytics Panel
**Priority:** P1
**Steps:**
1. Select agent
2. View Performance Analytics section

**Expected Result:**
- 4 metric cards displayed:
  - Total Runs
  - Success Rate (%)
  - Avg Duration
  - Status

**Screenshots Required:**
- a-022-performance-metrics.png

---

### A-023: Execution Count Display
**Priority:** P2
**Steps:**
1. Select agent
2. Check "Total Runs" metric

**Expected Result:**
- Number displayed in monospace font
- Activity icon visible

**Screenshots Required:**
- a-023-execution-count.png

---

### A-024: Success Rate Display
**Priority:** P2
**Steps:**
1. Select agent
2. Check "Success Rate" metric

**Expected Result:**
- Percentage displayed (0-100%)
- Green color
- TrendingUp icon

**Screenshots Required:**
- a-024-success-rate.png

---

### A-025: Agent Search Filter
**Priority:** P2
**Steps:**
1. Navigate to /agents
2. Enter agent name in "Filter agents..." search box

**Expected Result:**
- Agents filtered by name
- Only matching agents visible

**Screenshots Required:**
- a-025-agent-search.png

---

## AU: AUTOMATIONS PAGE (40 Test Cases)

### AU-001: Automations List Display
**Priority:** P1
**Steps:**
1. Navigate to /automations

**Expected Result:**
- List of active automations displayed
- Each shows name, status, trigger type, action count
- "Active/Paused" badge visible

**Screenshots Required:**
- au-001-automations-list.png

---

### AU-002: Automations Empty State
**Priority:** P2
**Steps:**
1. Navigate to /automations with no automations

**Expected Result:**
- Empty state with Zap icon
- "No automations yet" message
- "Create Automation" button

**Screenshots Required:**
- au-002-empty-state.png

---

### AU-003: Wizard Guide Card - Step 0
**Priority:** P1
**Steps:**
1. Navigate to /automations
2. Check guide card at top

**Expected Result:**
- "Automation Workflow" title
- 3 steps: Choose Template, Configure Actions, Monitor Performance
- Step 0 active (highlighted)

**Screenshots Required:**
- au-003-wizard-step-0.png

---

### AU-004: Open Template Selection
**Priority:** P0
**Steps:**
1. Navigate to /automations
2. Click "Template" button

**Expected Result:**
- Template selection card expands
- Category filters visible: All, AI, Integration, CRM
- Templates displayed by category

**Screenshots Required:**
- au-004-templates-expanded.png

---

### AU-005: Template Categories - AI Section
**Priority:** P1
**Steps:**
1. Open template selection
2. View AI-Powered Automations section

**Expected Result:**
- Section header with Bot icon
- AI templates displayed
- "AI Agent" badge on each

**Screenshots Required:**
- au-005-ai-templates.png

---

### AU-006: Template Categories - CRM Section
**Priority:** P1
**Steps:**
1. Open template selection
2. View CRM Workflows section

**Expected Result:**
- Section header with Users icon
- CRM templates displayed
- Node count shown

**Screenshots Required:**
- au-006-crm-templates.png

---

### AU-007: Template Categories - Integration Section
**Priority:** P1
**Steps:**
1. Open template selection
2. View Integration Automations section

**Expected Result:**
- Section header with RefreshCw icon
- Integration templates displayed
- Trigger type badges visible

**Screenshots Required:**
- au-007-integration-templates.png

---

### AU-008: Filter Templates - AI Only
**Priority:** P2
**Steps:**
1. Open template selection
2. Click "AI" filter button

**Expected Result:**
- Only AI templates visible
- Other categories hidden

**Screenshots Required:**
- au-008-ai-filter.png

---

### AU-009: Filter Templates - Integration Only
**Priority:** P2
**Steps:**
1. Open template selection
2. Click "Integration" filter button

**Expected Result:**
- Only Integration templates visible

**Screenshots Required:**
- au-009-integration-filter.png

---

### AU-010: Filter Templates - CRM Only
**Priority:** P2
**Steps:**
1. Open template selection
2. Click "CRM" filter button

**Expected Result:**
- Only CRM templates visible

**Screenshots Required:**
- au-010-crm-filter.png

---

### AU-011: Create from Template - Success
**Priority:** P0
**Steps:**
1. Open template selection
2. Click template card (e.g., "Meeting Summary to Slack")
3. Wait for creation

**Expected Result:**
- Wizard step advances to 1 (Configure)
- Automation appears in list
- Enabled by default

**Screenshots Required:**
- au-011-before-create.png
- au-011-after-create.png
- au-011-wizard-step-1.png

---

### AU-012: Custom Build - Open Builder
**Priority:** P0
**Steps:**
1. Navigate to /automations
2. Click "Custom Build" button

**Expected Result:**
- AutomationBuilder component displays
- Wizard advances to step 1
- Form fields visible

**Screenshots Required:**
- au-012-builder-opened.png

---

### AU-013: Automation Card - AI Badge
**Priority:** P2
**Steps:**
1. View automation with AI actions

**Expected Result:**
- Purple "AI" badge visible
- Bot icon in badge

**Screenshots Required:**
- au-013-ai-badge.png

---

### AU-014: Automation Card - Trigger Type
**Priority:** P2
**Steps:**
1. View automation card

**Expected Result:**
- Trigger type shown (e.g., "meeting ended")
- Clock icon
- Monospace font

**Screenshots Required:**
- au-014-trigger-type.png

---

### AU-015: Automation Card - Action Count
**Priority:** P2
**Steps:**
1. View automation card

**Expected Result:**
- Action count displayed (e.g., "3 actions")
- Correct pluralization

**Screenshots Required:**
- au-015-action-count.png

---

### AU-016: Automation Card - Execution Count
**Priority:** P2
**Steps:**
1. View automation that has run

**Expected Result:**
- Execution count shown with Activity icon
- Format: "{count}x"

**Screenshots Required:**
- au-016-execution-count.png

---

### AU-017: Automation Card - Last Executed
**Priority:** P2
**Steps:**
1. View automation that has run

**Expected Result:**
- "Last: {date}" displayed
- Date formatted correctly

**Screenshots Required:**
- au-017-last-executed.png

---

### AU-018: Toggle Automation - Pause
**Priority:** P1
**Steps:**
1. Click Pause button on active automation

**Expected Result:**
- Status changes to "Paused"
- Badge color changes to gray
- Pause icon becomes Play icon

**Screenshots Required:**
- au-018-before-pause.png
- au-018-after-pause.png

---

### AU-019: Toggle Automation - Resume
**Priority:** P1
**Steps:**
1. Click Play button on paused automation

**Expected Result:**
- Status changes to "Active"
- Badge color changes to green

**Screenshots Required:**
- au-019-after-resume.png

---

### AU-020: Test Automation - Dry Run
**Priority:** P0
**Steps:**
1. Click Eye (test) button on automation
2. Wait for test to complete

**Expected Result:**
- Loading spinner during test
- Test result card appears below automation
- Shows success/failure with green/red indicator

**Screenshots Required:**
- au-020-testing.png
- au-020-test-result-success.png

---

### AU-021: Test Automation - Failure
**Priority:** P1
**Steps:**
1. Test automation that will fail
2. View result

**Expected Result:**
- Red AlertCircle icon
- "Test failed" message
- Error details shown

**Screenshots Required:**
- au-021-test-result-failure.png

---

### AU-022: Test Result - Action Results
**Priority:** P2
**Steps:**
1. Test automation successfully
2. View action results in test result card

**Expected Result:**
- Each action result listed
- Shows action type and preview

**Screenshots Required:**
- au-022-action-results.png

---

### AU-023: Execute Automation - Manual Run
**Priority:** P0
**Steps:**
1. Click Zap (execute) button on automation
2. Confirm alert

**Expected Result:**
- Alert: "Automation executed! Success"
- Automation runs immediately

**Screenshots Required:**
- au-023-execute-confirm.png
- au-023-execution-result.png

---

### AU-024: Delete Automation - Confirmation
**Priority:** P1
**Steps:**
1. Click Trash button on automation
2. View confirmation dialog

**Expected Result:**
- Browser confirm: "Delete this automation?"
- Automation not deleted until confirmed

**Screenshots Required:**
- au-024-delete-confirm.png

---

### AU-025: Delete Automation - Success
**Priority:** P1
**Steps:**
1. Click delete and confirm

**Expected Result:**
- Automation removed from list immediately

**Screenshots Required:**
- au-025-after-delete.png

---

### AU-026: Execution History - Open Panel
**Priority:** P1
**Steps:**
1. Click "History" button

**Expected Result:**
- Execution History card appears
- Shows recent executions
- Each entry has timestamp, automation name, status

**Screenshots Required:**
- au-026-history-panel.png

---

### AU-027: Execution History - Success Entry
**Priority:** P2
**Steps:**
1. Open history panel
2. View successful execution

**Expected Result:**
- Green CheckCircle2 icon
- Automation name shown
- Timestamp and duration (ms)

**Screenshots Required:**
- au-027-success-entry.png

---

### AU-028: Execution History - Failure Entry
**Priority:** P2
**Steps:**
1. Open history panel
2. View failed execution

**Expected Result:**
- Red XCircle icon
- Error message truncated
- Timestamp shown

**Screenshots Required:**
- au-028-failure-entry.png

---

### AU-029: Execution History - Refresh
**Priority:** P2
**Steps:**
1. Open history panel
2. Click RefreshCw button

**Expected Result:**
- Loading spinner on button
- History reloads

**Screenshots Required:**
- au-029-refresh-logs.png

---

### AU-030: Execution History - Empty
**Priority:** P2
**Steps:**
1. Open history with no executions

**Expected Result:**
- "No execution history yet" message

**Screenshots Required:**
- au-030-history-empty.png

---

### AU-031: Scheduled Automations Panel
**Priority:** P2
**Steps:**
1. View automation with scheduled trigger
2. Check if scheduled panel appears

**Expected Result:**
- "Scheduled Automations" card visible
- Shows cron expression
- Shows next run time

**Screenshots Required:**
- au-031-scheduled-panel.png

---

### AU-032: Active Automation Count
**Priority:** P2
**Steps:**
1. View automations list card header

**Expected Result:**
- Shows "{X} active / {Y} total"
- Counts accurate

**Screenshots Required:**
- au-032-active-count.png

---

### AU-033: Template Icons Display
**Priority:** P2
**Steps:**
1. Open template selection
2. Verify all templates have icons

**Expected Result:**
- Each template has icon (emoji or Lucide icon)
- Icons rendered correctly

**Screenshots Required:**
- au-033-template-icons.png

---

### AU-034: Wizard Step Indicator
**Priority:** P2
**Steps:**
1. Create automation
2. Watch wizard step indicator

**Expected Result:**
- Active step highlighted
- Steps: 0 → 1 → 2

**Screenshots Required:**
- au-034-wizard-progress.png

---

### AU-035: Automation Builder - Cancel
**Priority:** P2
**Steps:**
1. Open custom builder
2. Click "Cancel" button

**Expected Result:**
- Builder closes
- No automation created

**Screenshots Required:**
- au-035-builder-cancelled.png

---

### AU-036: Close Test Result
**Priority:** P3
**Steps:**
1. Run test
2. Click X button on test result card

**Expected Result:**
- Test result card closes

**Screenshots Required:**
- au-036-close-test-result.png

---

### AU-037: Hover States - Automation Card
**Priority:** P3
**Steps:**
1. Hover over automation card

**Expected Result:**
- Background changes to surface-muted
- Smooth transition

**Screenshots Required:**
- au-037-card-hover.png

---

### AU-038: Trigger Icon Mapping
**Priority:** P2
**Steps:**
1. View different automation trigger types

**Expected Result:**
- Each trigger type has appropriate icon:
  - meeting_ended: Presentation
  - scheduled: Clock
  - deal_created: TrendingUp

**Screenshots Required:**
- au-038-trigger-icons.png

---

### AU-039: Template Close Button
**Priority:** P3
**Steps:**
1. Open template selection
2. Click "Cancel" button

**Expected Result:**
- Template selection card closes

**Screenshots Required:**
- au-039-close-templates.png

---

### AU-040: Deployment Error Banner
**Priority:** P1
**Steps:**
1. Trigger deployment error
2. View error banner

**Expected Result:**
- Red error banner in templates modal
- AlertCircle icon
- Error message displayed
- X button to dismiss

**Screenshots Required:**
- au-040-error-banner.png

---

## P: PROJECTS PAGE (15 Test Cases)

### P-001: Projects Grid Display
**Priority:** P1
**Steps:**
1. Navigate to /projects

**Expected Result:**
- Projects displayed in grid (1-3 columns responsive)
- Each card shows icon, status, name, description
- Deal value and end date visible

**Screenshots Required:**
- p-001-projects-grid.png

---

### P-002: Create Project - Open Form
**Priority:** P0
**Steps:**
1. Navigate to /projects
2. Click "New Project" button

**Expected Result:**
- Create form expands
- Name and description fields visible
- "Create Project" and "Cancel" buttons

**Screenshots Required:**
- p-002-create-form.png

---

### P-003: Create Project - Success
**Priority:** P0
**Steps:**
1. Open create form
2. Enter name: "Q1 Marketing Campaign"
3. Enter description: "Launch new product line"
4. Click "Create Project"

**Expected Result:**
- Loading state on button
- Form closes
- New project appears in grid
- Wizard advances to step 1

**Screenshots Required:**
- p-003-form-filled.png
- p-003-creating.png
- p-003-project-created.png

---

### P-004: Create Project - Validation
**Priority:** P2
**Steps:**
1. Open create form
2. Click "Create Project" without entering name

**Expected Result:**
- Browser validation prevents submission
- "Required" message shown

**Screenshots Required:**
- p-004-validation-error.png

---

### P-005: Create Project - Cancel
**Priority:** P2
**Steps:**
1. Open create form
2. Enter data
3. Click "Cancel"

**Expected Result:**
- Form closes
- No project created
- Data cleared

**Screenshots Required:**
- p-005-form-cancelled.png

---

### P-006: Search Projects
**Priority:** P1
**Steps:**
1. Enter "Marketing" in search box

**Expected Result:**
- Only projects with "Marketing" in name visible
- Other projects filtered out

**Screenshots Required:**
- p-006-search-results.png

---

### P-007: Search Projects - No Results
**Priority:** P2
**Steps:**
1. Enter non-existent project name

**Expected Result:**
- Empty state with FolderKanban icon
- "Try a different search term" message

**Screenshots Required:**
- p-007-no-search-results.png

---

### P-008: Project Status Badge - Active
**Priority:** P2
**Steps:**
1. View project with "active" status

**Expected Result:**
- Green badge with TrendingUp icon
- "active" text

**Screenshots Required:**
- p-008-active-status.png

---

### P-009: Project Status Badge - Planning
**Priority:** P2
**Steps:**
1. View project with "planning" status

**Expected Result:**
- Blue/accent badge with Target icon
- "planning" text

**Screenshots Required:**
- p-009-planning-status.png

---

### P-010: Project Status Badge - Completed
**Priority:** P2
**Steps:**
1. View project with "completed" status

**Expected Result:**
- Gray badge with Archive icon
- "completed" text

**Screenshots Required:**
- p-010-completed-status.png

---

### P-011: Project Card - Hover Effect
**Priority:** P3
**Steps:**
1. Hover over project card

**Expected Result:**
- Border changes to accent-primary
- Icon background transitions
- Delete button appears

**Screenshots Required:**
- p-011-card-hover.png

---

### P-012: Project Card - Deal Value Display
**Priority:** P2
**Steps:**
1. View project with deal_value

**Expected Result:**
- DollarSign icon
- Value formatted with commas (e.g., "$50,000")

**Screenshots Required:**
- p-012-deal-value.png

---

### P-013: Project Card - End Date Display
**Priority:** P2
**Steps:**
1. View project with end_date

**Expected Result:**
- Calendar icon
- Date formatted (e.g., "12/31/2026")

**Screenshots Required:**
- p-013-end-date.png

---

### P-014: Delete Project - Confirmation
**Priority:** P1
**Steps:**
1. Hover over project
2. Click delete button (trash icon)

**Expected Result:**
- Browser confirm: "Are you sure you want to delete this project?"

**Screenshots Required:**
- p-014-delete-confirm.png

---

### P-015: Delete Project - Success
**Priority:** P1
**Steps:**
1. Click delete and confirm

**Expected Result:**
- Project removed from grid immediately

**Screenshots Required:**
- p-015-after-delete.png

---

## T: TASKS PAGE (15 Test Cases)

### T-001: Tasks List Display
**Priority:** P1
**Steps:**
1. Navigate to /tasks

**Expected Result:**
- Tasks displayed in list
- Each row shows checkbox, title, priority, status, delete button
- Overdue tasks highlighted

**Screenshots Required:**
- t-001-tasks-list.png

---

### T-002: Create Task - Open Form
**Priority:** P0
**Steps:**
1. Navigate to /tasks
2. Click "New Task" button

**Expected Result:**
- Create form expands
- Fields: Title, Priority dropdown, Due Date picker
- "Create Task" and "Cancel" buttons

**Screenshots Required:**
- t-002-create-form.png

---

### T-003: Create Task - Success
**Priority:** P0
**Steps:**
1. Open create form
2. Enter title: "Review Q1 results"
3. Select priority: "High"
4. Select due date: tomorrow
5. Click "Create Task"

**Expected Result:**
- Loading state on button
- Form closes
- Task appears in list with red "high" badge

**Screenshots Required:**
- t-003-form-filled.png
- t-003-task-created.png

---

### T-004: Create Task - Validation
**Priority:** P2
**Steps:**
1. Open create form
2. Click "Create Task" without title

**Expected Result:**
- Browser validation prevents submission

**Screenshots Required:**
- t-004-validation-error.png

---

### T-005: Priority Badge - High
**Priority:** P2
**Steps:**
1. View task with "high" priority

**Expected Result:**
- Red badge with border
- "high" text

**Screenshots Required:**
- t-005-high-priority.png

---

### T-006: Priority Badge - Medium
**Priority:** P2
**Steps:**
1. View task with "medium" priority

**Expected Result:**
- Yellow badge
- "medium" text

**Screenshots Required:**
- t-006-medium-priority.png

---

### T-007: Priority Badge - Low
**Priority:** P2
**Steps:**
1. View task with "low" priority

**Expected Result:**
- Green badge
- "low" text

**Screenshots Required:**
- t-007-low-priority.png

---

### T-008: Status Badge - In Progress
**Priority:** P2
**Steps:**
1. View task with "in_progress" status

**Expected Result:**
- Blue/accent badge
- "In Progress" text

**Screenshots Required:**
- t-008-in-progress-status.png

---

### T-009: Status Badge - Done
**Priority:** P2
**Steps:**
1. View task with "done" status

**Expected Result:**
- Green badge
- "Done" text
- Task row has 60% opacity

**Screenshots Required:**
- t-009-done-status.png

---

### T-010: Complete Task
**Priority:** P1
**Steps:**
1. Click checkbox on open task

**Expected Result:**
- Checkbox fills with green
- CheckCircle2 icon appears
- Status changes to "done"
- Row opacity reduces

**Screenshots Required:**
- t-010-before-complete.png
- t-010-after-complete.png

---

### T-011: Reopen Task
**Priority:** P1
**Steps:**
1. Click checkbox on completed task

**Expected Result:**
- Checkbox unchecks
- Status changes to "open"
- Row opacity returns to 100%

**Screenshots Required:**
- t-011-reopened-task.png

---

### T-012: Overdue Task Highlighting
**Priority:** P1
**Steps:**
1. View task with due date in past and status not "done"

**Expected Result:**
- Red AlertCircle icon next to title
- Due date in red text

**Screenshots Required:**
- t-012-overdue-task.png

---

### T-013: Filter Tasks - Open Only
**Priority:** P2
**Steps:**
1. Click "Open" filter button

**Expected Result:**
- Only open tasks visible
- "Open" button highlighted

**Screenshots Required:**
- t-013-open-filter.png

---

### T-014: Filter Tasks - Done Only
**Priority:** P2
**Steps:**
1. Click "Done" filter button

**Expected Result:**
- Only completed tasks visible

**Screenshots Required:**
- t-014-done-filter.png

---

### T-015: Delete Task - Success
**Priority:** P1
**Steps:**
1. Hover over task
2. Click trash button
3. Confirm deletion

**Expected Result:**
- Confirmation dialog
- Task removed from list

**Screenshots Required:**
- t-015-delete-confirm.png
- t-015-after-delete.png

---

## RESPONSIVE DESIGN TESTS (CROSS-CUTTING)

### RD-001: Desktop View (1920x1080)
**Priority:** P1
**Steps:**
1. Test all pages at 1920x1080 resolution

**Expected Result:**
- Multi-column layouts work
- No horizontal scrolling
- Readable text

**Screenshots Required:**
- rd-001-desktop-meetings.png
- rd-001-desktop-agents.png
- rd-001-desktop-automations.png
- rd-001-desktop-projects.png
- rd-001-desktop-tasks.png

---

### RD-002: Tablet View (768x1024)
**Priority:** P1
**Steps:**
1. Test all pages at 768x1024 resolution

**Expected Result:**
- 2-column layouts
- Navigation responsive
- Buttons stack vertically

**Screenshots Required:**
- rd-002-tablet-*.png (all pages)

---

### RD-003: Mobile View (375x667)
**Priority:** P1
**Steps:**
1. Test all pages at 375x667 resolution

**Expected Result:**
- Single column layouts
- Mobile menu works
- Touch-friendly buttons

**Screenshots Required:**
- rd-003-mobile-*.png (all pages)

---

## DARK MODE TESTS (CROSS-CUTTING)

### DM-001: Toggle Dark Mode
**Priority:** P1
**Steps:**
1. Click theme toggle button

**Expected Result:**
- Dark theme applies
- All colors invert properly
- Text remains readable

**Screenshots Required:**
- dm-001-light-mode.png
- dm-001-dark-mode.png

---

### DM-002: Dark Mode Persistence
**Priority:** P2
**Steps:**
1. Enable dark mode
2. Refresh page

**Expected Result:**
- Dark mode persists

**Screenshots Required:**
- dm-002-persisted.png

---

## PERFORMANCE TESTS

### PERF-001: Page Load Time
**Priority:** P1
**Steps:**
1. Clear cache
2. Navigate to /meetings
3. Measure time to interactive

**Expected Result:**
- Page loads in <2 seconds

**Evidence:** DevTools Performance tab screenshot

---

### PERF-002: Search Debouncing
**Priority:** P2
**Steps:**
1. Type quickly in search box
2. Observe API calls in Network tab

**Expected Result:**
- API calls debounced (not on every keystroke)

**Evidence:** Network tab screenshot

---

## ACCESSIBILITY TESTS

### A11Y-001: Keyboard Navigation
**Priority:** P1
**Steps:**
1. Navigate pages using Tab key only

**Expected Result:**
- All interactive elements focusable
- Focus indicators visible

**Screenshots Required:**
- a11y-001-focus-states.png

---

### A11Y-002: Screen Reader Labels
**Priority:** P1
**Steps:**
1. Inspect buttons and inputs with screen reader

**Expected Result:**
- All elements have aria-labels
- Descriptive text present

**Evidence:** Accessibility tree screenshot

---

## TEST SUMMARY TEMPLATE

```
Total Test Cases: 130
Tests Executed: [X]
Pass: [X]
Fail: [X]
Blocked: [X]
Pass Rate: [X]%

Critical Blockers (P0): [X]
High Priority Issues (P1): [X]
Medium Priority Issues (P2): [X]
Low Priority Issues (P3): [X]
```

---

**END OF TEST SPECIFICATION**
