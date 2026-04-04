// ─── Entomate User Guide Data ─────────────────────────────────────────────
// Version tracking — update these when guide content changes

export const guideVersion = '1.2.0'
export const guideUpdated = 'April 4, 2026'

// ─── Version key for localStorage new-feature detection ───────────────────
export const GUIDE_VERSION_KEY = 'entomate_guide_version'

// ─── Categories (sidebar grouping) ────────────────────────────────────────

export const CATEGORIES = [
  { label: 'Start Here',         ids: ['introduction', 'getting-started', 'dashboard'] },
  { label: 'Meetings & Time',    ids: ['meetings', 'meeting-details', 'calendar'] },
  { label: 'Work Management',    ids: ['tasks', 'projects', 'goals'] },
  { label: 'Automation & AI',    ids: ['workflows', 'automations', 'agents'] },
  { label: 'Intelligence',       ids: ['search', 'analytics', 'reports'] },
  { label: 'Ecosystem',           ids: ['ecosystem', 'meeting-intelligence'] },
  { label: 'Configuration',      ids: ['settings', 'keyboard-shortcuts', 'troubleshooting'] },
]

// ─── Section definitions ──────────────────────────────────────────────────

export const guideSections = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: '\u{1F4D6}',
    summary: 'What Entomate is and how it helps your team turn meetings into action.',
    steps: [
      'Entomate is an AI-powered meeting intelligence platform.',
      'It records and transcribes meetings, then extracts action items, priorities, and follow-ups automatically.',
      'AI agents learn from your feedback over time to improve suggestions.',
      'Use workflows and automations to connect meeting outcomes to your tools.',
    ],
    subsections: [
      {
        id: 'intro-concepts',
        title: 'Key Concepts',
        description: 'The core building blocks of Entomate.',
        steps: [
          'Meetings \u2014 Recorded sessions with AI-generated transcripts, summaries, and sentiment analysis.',
          'Action Items \u2014 Tasks automatically extracted from meetings, with AI-suggested assignments and deadlines.',
          'Workflows \u2014 Visual, node-based automations that connect meeting events to actions.',
          'Agents \u2014 AI bots that run continuously, handling assignment, priority, and follow-up detection.',
          'Goals \u2014 OKR-style goal hierarchies with key results and progress tracking.',
        ],
      },
      {
        id: 'intro-who',
        title: 'Who Is It For?',
        steps: [
          'Teams who want to spend less time on meeting notes and more time executing.',
          'Managers who need visibility into action items and follow-ups across meetings.',
          'Organizations tracking OKRs and project progress with real-time intelligence.',
        ],
      },
    ],
    tips: [
      'Use the Command Palette (Ctrl+K) for instant navigation to any page or action.',
      'The sidebar groups features by category \u2014 Intelligence, Work, Automation, and Output.',
    ],
  },

  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '\u{1F680}',
    summary: 'Create your account, sign in, and find your way around.',
    steps: [
      'Visit the Entomate landing page and click Get Started.',
      'Sign in with your Google account through Supabase OAuth.',
      'You will be redirected to the Dashboard automatically.',
      'The sidebar on the left provides links to every section of the app.',
    ],
    subsections: [
      {
        id: 'gs-navigation',
        title: 'Navigating the App',
        description: 'The sidebar is organized into four groups.',
        steps: [
          'Intelligence \u2014 Dashboard, Meetings, Calendar, Search.',
          'Work \u2014 Projects, Project Board, Tasks, Goals.',
          'Automation \u2014 Workflows, Automations, AI Agents.',
          'Output \u2014 Analytics, Reports.',
          'Settings and your user profile are at the bottom of the sidebar.',
        ],
        note: 'Use keyboard shortcut Ctrl+K to open the Command Palette for quick navigation.',
      },
    ],
    tips: [
      'The top bar shows breadcrumbs so you always know where you are.',
      'Toggle dark/light mode with the sun/moon icon in the top bar, or choose System to match your OS.',
    ],
  },

  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '\u{1F4CA}',
    badge: 'Updated',
    summary: 'Your home screen with real-time intelligence, new widgets, quick actions, and system status.',
    steps: [
      'Navigate to Dashboard from the sidebar (it\'s your landing page after sign-in).',
      'Review the ring gauges showing Meetings, Tasks, Projects, and Automations counts.',
      'Check the Intelligence Briefing card for a system snapshot.',
      'Monitor the new Overdue Alert Banner, Team Workload, and Insights panels.',
      'Use the Quick Actions bar at the bottom for common tasks.',
    ],
    subsections: [
      {
        id: 'dash-gauges',
        title: 'Ring Gauges',
        description: 'Four interactive metric rings at the top of the Dashboard.',
        steps: [
          'Each ring shows a count for Meetings, Tasks, Projects, or Automations.',
          'Click any ring to navigate directly to that section.',
          'Gauges update in real-time as you add data.',
        ],
      },
      {
        id: 'dash-overdue',
        title: 'Overdue Alert Banner',
        description: 'Expandable alert showing overdue tasks.',
        steps: [
          'Appears when you have overdue items.',
          'Click to expand and see each overdue task with assignee name.',
          'Shows how many days late each item is.',
        ],
      },
      {
        id: 'dash-workload',
        title: 'Team Workload Widget',
        description: 'Stacked bar chart showing work distribution.',
        steps: [
          'Each bar represents a team member.',
          'Segments show Done, In Progress, and Pending task counts.',
          'Helps you spot who is overloaded at a glance.',
        ],
      },
      {
        id: 'dash-insights',
        title: 'Insights & Trends Panel',
        description: 'Three-column layout with charts.',
        steps: [
          'Sentiment Donut \u2014 Positive, Neutral, and Negative distribution.',
          'Priority Bars \u2014 High, Medium, and Low priority breakdown.',
          'Completion Ring \u2014 Overall task completion rate.',
        ],
      },
      {
        id: 'dash-automation-feed',
        title: 'Automation Activity Feed',
        description: 'Live feed of running automations.',
        steps: [
          'Lists all running automations with status badges.',
          'Active and Paused statuses shown.',
          'Monitor automation health without leaving the Dashboard.',
        ],
      },
      {
        id: 'dash-quick',
        title: 'Quick Actions',
        description: 'A docked toolbar at the bottom of the Dashboard for instant access.',
        steps: [
          'Start Meeting \u2014 Opens the meeting recorder.',
          'New Task \u2014 Creates a task instantly.',
          'New Project \u2014 Starts a new project.',
          'AI Insights \u2014 Jumps to the Intelligence Dashboard.',
          'Automations \u2014 Goes to the Automations page.',
        ],
      },
      {
        id: 'dash-intelligence',
        title: 'Intelligence Dashboard',
        description: 'AI-generated insights embedded in the Dashboard.',
        steps: [
          'Action item status cards show outstanding work.',
          'Stakeholder cards highlight key people from your meetings.',
          'Sentiment trend charts show meeting mood over time.',
          'Relationship insight cards surface connection patterns.',
        ],
      },
      {
        id: 'dash-status',
        title: 'System Status',
        steps: [
          'AI Provider indicator shows whether OpenAI or Gemini is connected.',
          'Database status confirms your Supabase connection is healthy.',
          'CRM status via Ecosystem Bridge (Logos Vision).',
          'Pulse notification status via Ecosystem Bridge.',
          'Color-coded dots: green (connected), orange (not configured), red (disconnected).',
        ],
      },
    ],
    tips: [
      'The greeting uses a typewriter animation and changes based on time of day.',
      'Sentiment emojis: Positive, Neutral, Negative.',
    ],
  },

  {
    id: 'meetings',
    title: 'Meetings',
    icon: '\u{1F399}\uFE0F',
    badge: 'Updated',
    summary: 'Record, transcribe, search, and manage all your meetings with bulk operations.',
    steps: [
      'Navigate to Meetings from the sidebar.',
      'Browse meeting cards showing title, sentiment, summary, date, duration, and attendee count.',
      'Use the search bar to filter meetings by title or summary (server-side with auto-filtering).',
      'Click any meeting card to open its full detail view.',
      'Click New Meeting to open the recorder and start a new session.',
    ],
    subsections: [
      {
        id: 'mtg-recording',
        title: 'Recording a Meeting',
        steps: [
          'Click the New Meeting button at the top of the page.',
          'The Meeting Recorder component will appear.',
          'Follow the on-screen prompts to start and stop recording.',
          'When finished, the recording is transcribed and analyzed automatically by AI.',
        ],
      },
      {
        id: 'mtg-bulk',
        title: 'Bulk Operations',
        description: 'Select and manage multiple meetings at once.',
        steps: [
          'Toggle selection mode with the checkbox icon.',
          'Use Select All or Deselect All for quick selection.',
          'Bulk Delete \u2014 Remove selected meetings (with confirmation).',
          'Bulk Export \u2014 Export selected meetings as a Markdown file.',
        ],
      },
      {
        id: 'mtg-sentiment',
        title: 'Sentiment Indicators',
        description: 'Each meeting has an AI-detected sentiment badge.',
        steps: [
          'Positive \u2014 shown in mint/green.',
          'Neutral \u2014 shown in gray.',
          'Negative \u2014 shown in crimson/red.',
          'Sentiment is determined by AI analysis of the transcript tone.',
        ],
      },
      {
        id: 'mtg-delete',
        title: 'Deleting a Meeting',
        steps: [
          'Click the delete button on any meeting card.',
          'Confirm the deletion in the dialog that appears.',
          'This action is permanent and cannot be undone.',
        ],
      },
    ],
    tips: [
      'You can also start a meeting directly from the Dashboard using the Quick Actions bar.',
      'Your preferred microphone is remembered between sessions. Set it in Settings > Audio & Recording.',
    ],
  },

  {
    id: 'meeting-details',
    title: 'Meeting Details',
    icon: '\u{1F4DD}',
    badge: 'Updated',
    summary: 'Deep dive into a single meeting with inline editing, transcripts, AI analysis, intelligence profiles, and action items.',
    steps: [
      'Click any meeting from the Meetings list to open its detail view.',
      'Review the AI-generated summary, key points timeline, and decisions timeline.',
      'Click any text field (title, summary, key points) to edit it inline.',
      'Manage action items in the right-side panel \u2014 mark complete, delete, or create new ones.',
    ],
    subsections: [
      {
        id: 'md-inline',
        title: 'Inline Editing',
        description: 'Edit meeting content directly on the detail page.',
        steps: [
          'Click the meeting title, summary, or key points to enter edit mode.',
          'Make your changes in the text field.',
          'Click the checkmark to save, or press Escape to cancel.',
          'Changes are saved to the database immediately.',
        ],
      },
      {
        id: 'md-ask-ai',
        title: 'Ask AI',
        description: 'Ask natural-language questions about the meeting content.',
        steps: [
          'Type your question in the input field (e.g., "What did we decide about the timeline?").',
          'Click Send.',
          'The AI responds with an answer and a confidence score.',
          'Ask follow-up questions for deeper insights.',
        ],
      },
      {
        id: 'md-share',
        title: 'Sharing & Syncing',
        steps: [
          'Share to Chat \u2014 Send a meeting recap to a connected chat channel (e.g., Slack).',
          'Sync to CRM \u2014 Push action items and meeting data to Logos Vision.',
          'Sync to Calendar \u2014 Add the meeting to your Google Calendar.',
          'Select a channel from the channel selector dialog before sharing.',
        ],
      },
      {
        id: 'md-actions',
        title: 'Action Items Panel',
        steps: [
          'View all action items extracted from the meeting.',
          'Click the checkbox to mark an item as complete or incomplete.',
          'Click delete to remove an action item.',
          'Action items are synced across your Tasks page automatically.',
        ],
      },
      {
        id: 'md-intelligence',
        title: 'Intelligence Profile Panel',
        description: 'AI suggests the best analysis profile for your meeting.',
        steps: [
          'The panel appears when AI detects a matching intelligence profile.',
          'A confidence score shows how well the profile fits.',
          'Accept the suggestion or choose a different profile.',
          'Fill in any custom fields the profile requires.',
          'The summary, focus areas, and action item extraction are shaped by the profile.',
        ],
        note: 'See the Meeting Intelligence Profiles section for the full list of built-in profiles.',
      },
    ],
    tips: [
      'The Ask AI feature understands the full meeting context \u2014 try follow-up questions.',
      'Key Points and Decisions are displayed on visual timelines for quick scanning.',
      'Intelligence profiles enrich analysis with external context from contacts, CRM, and past meetings.',
    ],
  },

  {
    id: 'calendar',
    title: 'Calendar',
    icon: '\u{1F4C5}',
    summary: 'Unified calendar view combining Google Calendar events, tasks, and goal deadlines.',
    steps: [
      'Navigate to Calendar from the sidebar.',
      'Connect Google Calendar if not already connected.',
      'Navigate months using the arrow buttons or click Today to jump to current date.',
      'Click any date to see its details in the sidebar panel.',
    ],
    subsections: [
      {
        id: 'cal-connect',
        title: 'Connecting Google Calendar',
        steps: [
          'Click Connect Google Calendar.',
          'Complete the Google OAuth authorization flow.',
          'Your calendar events will sync automatically.',
          'To disconnect, click Disconnect Google Calendar.',
        ],
      },
      {
        id: 'cal-upcoming',
        title: 'Upcoming Items',
        description: 'A 14-day look-ahead list below the calendar grid.',
        steps: [
          'Action Items \u2014 Tasks with due dates, shown with a task icon.',
          'Goal Deadlines \u2014 Key result and goal deadlines, shown with a target icon.',
          'Calendar Events \u2014 Synced events from Google Calendar, shown with a calendar icon.',
          'Each item shows priority color and a link to its source.',
        ],
      },
      {
        id: 'cal-quick-schedule',
        title: 'Quick Schedule',
        description: 'Create calendar events on the fly.',
        steps: [
          'Open the Quick Schedule modal from the Calendar or Intelligence Dashboard.',
          'Enter a title, date, time, and duration (15, 30, 45, or 60 minutes).',
          'Optionally add notes.',
          'Click Schedule to create the event.',
        ],
      },
      {
        id: 'cal-stats',
        title: 'Quick Stats',
        steps: [
          'Calendar Events count.',
          'Due Tasks count.',
          'Goal Deadlines count.',
          'Overdue count (highlighted when non-zero).',
        ],
      },
    ],
    tips: [
      'Click Sync Tasks to push your Entomate action items to Google Calendar as events.',
      'External calendar event links open in Google Calendar directly.',
    ],
  },

  {
    id: 'tasks',
    title: 'Tasks',
    icon: '\u2705',
    summary: 'Create, prioritize, and track action items with AI-powered recommendations.',
    steps: [
      'Navigate to Tasks from the sidebar.',
      'A guided 3-step wizard appears: Create \u2192 Prioritize \u2192 Complete.',
      'Fill in the task form with title, priority, and due date.',
      'Review the AI Recommendations panel for assignment, priority, and deadline suggestions.',
      'Accept or override any AI suggestion, then save.',
    ],
    subsections: [
      {
        id: 'task-ai',
        title: 'AI Recommendations',
        description: 'The AI suggests assignments, priorities, and deadlines for each task.',
        steps: [
          'Assignment Suggestions \u2014 Who should own this task based on meeting context.',
          'Priority Predictions \u2014 AI-recommended priority level.',
          'Deadline Suggestions \u2014 Recommended due dates based on project timelines.',
          'Each recommendation includes an Explainability Card showing the reasoning.',
        ],
        note: 'The AI learns from your decisions over time. The more you accept or override, the better it gets.',
      },
      {
        id: 'task-manage',
        title: 'Managing Tasks',
        steps: [
          'Filter tasks by status: All, Open, In Progress, or Done.',
          'Search tasks by title using the search bar.',
          'Complete a task by clicking the animated checkbox.',
          'Delete a task using the delete button on any row.',
        ],
      },
      {
        id: 'task-indicators',
        title: 'Task Indicators',
        steps: [
          'Priority badges are color-coded: High (crimson), Medium (amber), Low (neutral).',
          'Overdue tasks are highlighted for immediate attention.',
          'Project links show which project a task belongs to.',
        ],
      },
    ],
    tips: [
      'Click the Explainability Card on any recommendation to see why the AI made that suggestion.',
      'Tasks created from meetings are automatically linked back to the source meeting.',
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    icon: '\u{1F4C1}',
    summary: 'Organize tasks, meetings, and goals into project workspaces.',
    steps: [
      'Navigate to Projects from the sidebar.',
      'Follow the 3-step wizard: Create \u2192 Organize \u2192 Track.',
      'Enter a project name and optional description, then click Create.',
      'Browse project cards in a grid layout \u2014 each shows status, deal value, and end date.',
    ],
    subsections: [
      {
        id: 'proj-detail',
        title: 'Project Details',
        description: 'Click any project card to open its detail view.',
        steps: [
          'Stats Cards \u2014 Total Tasks, Completed, In Progress, and Open counts.',
          'Tasks Section \u2014 Add tasks directly with title and priority.',
          'Manage tasks with checkboxes and delete buttons.',
          'Related Meetings \u2014 Meetings linked to this project with clickable links.',
        ],
      },
      {
        id: 'proj-status',
        title: 'Status Indicators',
        steps: [
          'Active \u2014 shown in mint/green.',
          'Planning \u2014 shown in amber.',
          'Completed \u2014 shown in gray.',
          'Archived \u2014 shown in gray (dimmed).',
        ],
      },
    ],
    tips: [
      'Use the search bar on the Projects page to filter by name.',
      'The Project Board (Kanban) view offers a drag-and-drop alternative.',
    ],
  },

  {
    id: 'goals',
    title: 'Goals & OKRs',
    icon: '\u{1F3AF}',
    summary: 'Create and track Objectives and Key Results at Company, Team, and Individual levels.',
    steps: [
      'Navigate to Goals from the sidebar.',
      'Click New Goal and fill in the title, description, type, quarter, and optional parent goal.',
      'View goals in Hierarchy (Company \u2192 Team \u2192 Individual) or List mode.',
      'Click any goal to open the Detail Panel on the right.',
    ],
    subsections: [
      {
        id: 'goals-kr',
        title: 'Key Results',
        description: 'Measurable outcomes that define goal progress.',
        steps: [
          'Each goal can have multiple key results.',
          'Update progress by entering new values in the Detail Panel.',
          'Add new key results using the form at the bottom of the panel.',
          'Progress percentage is calculated automatically from key results.',
        ],
      },
      {
        id: 'goals-hierarchy',
        title: 'Goal Hierarchy',
        steps: [
          'Company Goals sit at the top level.',
          'Team Goals roll up to Company Goals.',
          'Individual Goals roll up to Team Goals.',
          'Expand any goal to see its children in the hierarchy view.',
        ],
      },
      {
        id: 'goals-stats',
        title: 'Stats Overview',
        steps: [
          'Total Goals \u2014 all goals across all levels.',
          'Average Progress \u2014 mean completion percentage.',
          'On Track \u2014 goals progressing as expected.',
          'At Risk \u2014 goals behind schedule.',
        ],
      },
    ],
    tips: [
      'Link goals to a parent to build cascading OKR trees.',
      'Switch between Hierarchy and List view using the toggle at the top.',
    ],
  },

  {
    id: 'workflows',
    title: 'Workflows',
    icon: '\u{1F500}',
    badge: 'Updated',
    summary: 'Visual, node-based automations with debug panel, version history, and execution tracing.',
    steps: [
      'Navigate to Workflows from the sidebar.',
      'Browse existing workflows or click New Workflow.',
      'Choose a Quick Start Template or start from scratch.',
      'Edit workflows in the full-screen Workflow Builder.',
    ],
    subsections: [
      {
        id: 'wf-templates',
        title: 'Quick Start Templates',
        steps: [
          'Meeting Processing \u2014 Automatically process new meeting recordings.',
          'Webhook to Slack \u2014 Route incoming webhooks to Slack channels.',
          'Daily Digest \u2014 Generate and send daily summary reports.',
        ],
      },
      {
        id: 'wf-builder',
        title: 'Workflow Builder',
        description: 'A full-screen visual editor for designing automations.',
        steps: [
          'Add nodes from the Node Palette on the left.',
          'Connect nodes by dragging from output to input ports.',
          'Click any node to configure its settings.',
          'Use the toolbar to Save, Test (dry run), Execute, Duplicate, or Delete the workflow.',
        ],
        note: 'Always use Test (dry run) before activating a workflow to verify behavior.',
      },
      {
        id: 'wf-debug',
        title: 'Debug & Trace Tools',
        description: 'Advanced tools for inspecting workflow execution.',
        steps: [
          'Debug Panel \u2014 Inspect execution traces and see what happened at each step.',
          'Execution Trace Viewer \u2014 Step through a run node by node with inputs, outputs, and timing.',
          'Version History \u2014 Review previous versions of a workflow and roll back if needed.',
        ],
      },
      {
        id: 'wf-manage',
        title: 'Managing Workflows',
        steps: [
          'Activate/Pause \u2014 Toggle a workflow on or off.',
          'Execute \u2014 Run a workflow immediately.',
          'Duplicate \u2014 Create a copy for modification.',
          'View History \u2014 See past execution logs.',
          'Delete \u2014 Remove a workflow permanently.',
        ],
      },
    ],
    tips: [
      'The Workflow Builder supports the Expression Editor for dynamic data mapping.',
      'Use the Debug Panel to inspect execution traces and pinpoint issues.',
    ],
  },

  {
    id: 'automations',
    title: 'Automations',
    icon: '\u26A1',
    summary: 'Template-based automation rules with triggers, actions, and monitoring.',
    steps: [
      'Navigate to Automations from the sidebar.',
      'Follow the 3-step wizard: Choose Template \u2192 Configure \u2192 Monitor.',
      'Browse templates by category: AI-Powered, CRM, or Integration.',
      'Click Custom Build to create your own from scratch.',
    ],
    subsections: [
      {
        id: 'auto-templates',
        title: 'Template Categories',
        steps: [
          'AI-Powered \u2014 Automations using AI agents (amber badge).',
          'CRM \u2014 Automations syncing with your CRM (mint badge).',
          'Integration \u2014 Cross-platform automations (crimson badge).',
        ],
      },
      {
        id: 'auto-test',
        title: 'Testing Automations',
        steps: [
          'Click Test on any automation to perform a dry run.',
          'The test result panel shows what the automation would do, without executing.',
          'Review results before enabling the automation for production.',
        ],
      },
      {
        id: 'auto-history',
        title: 'Execution History',
        steps: [
          'Expand the Execution History panel to see past runs.',
          'Each entry shows success/failure, timestamp, and duration.',
          'Error messages are displayed for failed executions.',
        ],
      },
    ],
    tips: [
      'Automations with the AI badge use intelligent agents for dynamic behavior.',
      'Use the Play/Pause toggle to quickly enable or disable any automation.',
    ],
  },

  {
    id: 'agents',
    title: 'AI Agents',
    icon: '\u{1F916}',
    summary: 'Deploy and manage intelligent bots for assignment, priority, and follow-up detection.',
    steps: [
      'Navigate to Agents from the sidebar.',
      'Follow the 3-step wizard: Select Template \u2192 Customize \u2192 Monitor.',
      'Browse templates by category (Sales, Meetings, Operations).',
      'Click Deploy on a template, customize name/trigger/actions, then activate.',
    ],
    subsections: [
      {
        id: 'agent-fleet',
        title: 'Active Fleet',
        description: 'All your deployed agents and their status.',
        steps: [
          'Each agent card shows name, status, execution count, success rate, and last run.',
          'Use the Play/Pause toggle to enable or disable an agent.',
          'Click Delete to remove an agent from your fleet.',
        ],
      },
      {
        id: 'agent-detail',
        title: 'Agent Details',
        steps: [
          'Click an agent to open its detail panel.',
          'Execution Logs \u2014 See what the agent has done recently.',
          'Explanations \u2014 Understand why the agent made specific decisions.',
          'Performance Metrics \u2014 Track success rates and execution counts.',
        ],
      },
      {
        id: 'agent-explain',
        title: 'Explainability',
        steps: [
          'Every agent decision comes with an explanation of contributing factors.',
          'Factor bars show the weight of each factor in the decision.',
          'This transparency helps you trust and tune agent behavior.',
        ],
      },
    ],
    tips: [
      'Agents use the same explainability system as task recommendations.',
      'Filter templates by category to find the right agent for your use case.',
    ],
  },

  {
    id: 'search',
    title: 'Search',
    icon: '\u{1F50D}',
    summary: 'Find anything across your workspace with semantic and keyword search plus AI Q&A.',
    steps: [
      'Navigate to Search from the sidebar, or press Ctrl+/ to jump there.',
      'Type your query in the search bar.',
      'Choose Semantic (AI understands meaning) or Keyword (exact text matching) mode.',
      'Click any result to navigate to that item.',
    ],
    subsections: [
      {
        id: 'search-ai',
        title: 'Ask AI',
        description: 'Ask natural-language questions about your entire workspace.',
        steps: [
          'Type a question below the search results (e.g., "What were the main decisions from last week?").',
          'The AI responds with an answer, citations, and follow-up suggestions.',
          'Continue the conversation with follow-up questions.',
        ],
      },
      {
        id: 'search-saved',
        title: 'Saved Searches & History',
        steps: [
          'View Search History in the sidebar to re-run previous queries.',
          'Save frequently used queries to Saved Searches for quick access.',
          'Trending topics show popular queries across your workspace.',
        ],
      },
      {
        id: 'search-export',
        title: 'Exporting Results',
        steps: [
          'Download search results as CSV or JSON.',
          'Exports include result type, title, and metadata.',
        ],
      },
    ],
    tips: [
      'Semantic search is great for questions like "meetings about budget concerns".',
      'Use Ctrl+Enter to submit, Tab to switch search type, Ctrl+S to save a search.',
    ],
  },

  {
    id: 'analytics',
    title: 'Analytics',
    icon: '\u{1F4C8}',
    badge: 'Updated',
    summary: 'Performance metrics with Recharts visualizations, CSV export, sentiment trends, and team performance tables.',
    steps: [
      'Navigate to Analytics from the sidebar.',
      'Select a time period: 7 days, 30 days, 90 days, or 1 year.',
      'Browse tabs: Overview, Meetings, Tasks, AI, and Team.',
      'Click Refresh to update data, or Export to download as CSV.',
    ],
    subsections: [
      {
        id: 'ana-overview',
        title: 'Overview Tab',
        steps: [
          'Key metric cards: Meetings Processed, Tasks Completed, Action Items, Automations Run.',
          'Time Saved breakdown showing savings from transcription, summarization, action items, and automations.',
          'Task Status breakdown: Completed, In Progress, Open, and Blocked.',
          'Meeting Sentiment distribution: Positive, Neutral, and Negative.',
          'Projects Overview: Total, Active, Completed, Planning, and total Deal Value.',
        ],
      },
      {
        id: 'ana-meetings',
        title: 'Meetings Tab',
        description: 'Charts and metrics focused on meeting activity.',
        steps: [
          'Total meetings count, total and average duration.',
          'Average action items per meeting.',
          'Sentiment Over Time \u2014 Area chart showing positive, neutral, and negative trends.',
          'Meetings Over Time \u2014 Bar chart with daily meeting counts.',
        ],
      },
      {
        id: 'ana-team',
        title: 'Team Tab',
        description: 'A performance table for each team member.',
        steps: [
          'Tasks created and completed by each member.',
          'Completion rate with color-coded badge.',
          'High priority task count.',
          'Average days to complete tasks.',
        ],
      },
    ],
    tips: [
      'Check the Time Saved card to see exactly how much time AI is saving your team.',
      'The AI tab shows transcription accuracy and action item extraction rates.',
      'Export analytics data as CSV for use in spreadsheets or BI tools.',
    ],
  },

  {
    id: 'reports',
    title: 'Reports & Exports',
    icon: '\u{1F4C4}',
    summary: 'Generate PDF reports and export data as CSV.',
    steps: [
      'Navigate to Reports from the sidebar.',
      'Select a report type: Meeting Recap, Goals & OKRs, or Weekly Summary.',
      'Click Download to generate the PDF.',
      'Use the CSV Export section to download raw data for meetings, action items, or goals.',
    ],
    subsections: [
      {
        id: 'rep-pdf',
        title: 'PDF Reports',
        steps: [
          'Meeting Recap \u2014 Select a meeting from the dropdown and download a formatted PDF.',
          'Goals & OKRs \u2014 Select a quarter and download a goals progress PDF.',
          'Weekly Summary \u2014 Download a 7-day overview as a PDF.',
        ],
      },
      {
        id: 'rep-csv',
        title: 'CSV Exports',
        steps: [
          'Meetings \u2014 Export all meeting data.',
          'Action Items \u2014 Export all action items across all statuses.',
          'Goals \u2014 Export all goals and key results.',
        ],
      },
    ],
    tips: [
      'Use CSV exports to bring data into spreadsheets or BI tools for custom analysis.',
      'Quick Stats cards at the top show total meetings, goals, completed goals, and avg progress.',
    ],
  },

  {
    id: 'ecosystem',
    title: 'Ecosystem Integration',
    icon: '\u{1F310}',
    summary: 'Connect Entomate with Pulse and Logos Vision for cross-app meeting sync and intelligence sharing.',
    steps: [
      'Navigate to Settings and open the Ecosystem section.',
      'Connect Pulse and/or Logos Vision by entering the API URL and service token.',
      'Click Test Connection to verify the link is working.',
      'Once connected, meeting recaps and action items sync automatically.',
    ],
    subsections: [
      {
        id: 'eco-pulse',
        title: 'Pulse Integration',
        description: 'Sync meeting intelligence with the Pulse communication app.',
        steps: [
          'Meeting recaps are posted to the #entomate-meetings bot channel in Pulse.',
          'High-priority action items are posted to #entomate-tasks.',
          'Pulse can auto-export recordings to Entomate for AI processing.',
          'Pull recordings from Pulse on-demand or on a schedule.',
        ],
      },
      {
        id: 'eco-logos',
        title: 'Logos Vision Integration',
        description: 'Sync action items and contacts with the Logos Vision CRM.',
        steps: [
          'Action items sync as CRM tasks automatically.',
          'Meeting attendees are synced as CRM contacts.',
          'Task completion status syncs back to Logos Vision.',
          'Meeting intelligence provides context for CRM deal management.',
        ],
      },
      {
        id: 'eco-events',
        title: 'Event Log & Monitoring',
        steps: [
          'View all inbound and outbound events in the Ecosystem Settings.',
          'Each event shows direction, status, timestamp, and processing time.',
          'Failed events can be retried with one click.',
          'Event stats show delivery rates and error counts.',
        ],
      },
      {
        id: 'eco-auto-sync',
        title: 'Auto-Sync & Recording Pull',
        steps: [
          'Enable auto-sync to periodically check Pulse for new recordings.',
          'Recordings are imported and processed through the AI pipeline automatically.',
          'The recordings list is posted to the Pulse bot channel with an Export All option.',
          'Individual recordings can be requested on-demand.',
        ],
      },
    ],
    tips: [
      'Test connections regularly from the Ecosystem Settings page to catch issues early.',
      'The event log is your best tool for diagnosing sync failures.',
    ],
  },

  {
    id: 'meeting-intelligence',
    title: 'Meeting Intelligence Profiles',
    icon: '\u{1F9E0}',
    summary: 'AI profiles that customize how your meetings are analyzed, summarized, and followed up.',
    steps: [
      'Open a meeting or start a new one \u2014 the AI will suggest a matching intelligence profile.',
      'Accept the suggested profile or choose a different one from the list.',
      'Fill in any custom fields the profile requires (e.g., grant name, deal stage).',
      'The AI uses the profile to shape its summary, focus areas, and action item extraction.',
    ],
    subsections: [
      {
        id: 'mip-builtin',
        title: 'Built-In Profiles',
        description: 'Ready-to-use profiles for common meeting types.',
        steps: [
          'Grant Specialist \u2014 Optimized for grant review and compliance meetings.',
          'Sales Discovery \u2014 Focuses on pain points, budget signals, and next steps.',
          'Client Check-In \u2014 Tracks relationship health and satisfaction.',
          'Board Meeting \u2014 Captures governance decisions and strategic direction.',
          'Internal Standup \u2014 Quick daily sync with blockers and progress.',
          'Strategic Planning \u2014 Long-term goals, market analysis, and roadmap.',
          'Vendor Negotiation \u2014 Contract terms, pricing, and commitments.',
        ],
      },
      {
        id: 'mip-suggest',
        title: 'How Suggestions Work',
        steps: [
          'The AI analyzes meeting title, attendees, and content keywords.',
          'It matches against profile suggestion rules (keywords, recurring patterns, org type).',
          'A confidence score indicates how well the profile fits.',
          'You can always override or dismiss a suggestion.',
        ],
      },
      {
        id: 'mip-context',
        title: 'Context Sources',
        description: 'Profiles pull in external context to enrich analysis.',
        steps: [
          'Contacts \u2014 Attendee history, roles, and relationship data.',
          'CRM Deals \u2014 Active deal status, stage, and value.',
          'Past Meetings \u2014 Previous meetings with same attendees for continuity.',
          'Pulse Threads \u2014 Relevant conversations from the Pulse communication app.',
        ],
      },
      {
        id: 'mip-analytics',
        title: 'Profile Analytics',
        steps: [
          'Track which profiles are used most often.',
          'See acceptance rates for profile suggestions.',
          'Monitor output quality scores from user feedback.',
          'View average action items extracted per profile.',
        ],
      },
    ],
    tips: [
      'The AI learns which profiles work best for your meetings over time.',
      'Rate meeting summaries to help the AI improve profile effectiveness.',
    ],
  },

  {
    id: 'settings',
    title: 'Settings',
    icon: '\u2699\uFE0F',
    badge: 'Updated',
    summary: 'Configure appearance, audio, permissions, notifications, Slack, AI learning, and system connections.',
    steps: [
      'Navigate to Settings from the sidebar.',
      'Choose Light, Dark, or System theme under Appearance.',
      'Configure audio devices and recording quality under Audio & Recording.',
      'Manage browser permissions, notifications, and Slack integration.',
      'Access the AI Learning Dashboard to manage patterns and feedback.',
    ],
    subsections: [
      {
        id: 'set-appearance',
        title: 'Appearance',
        steps: [
          'Choose Light, Dark, or System theme with visual previews.',
          'Enable Reduce Motion for accessibility (disables animations).',
        ],
      },
      {
        id: 'set-audio',
        title: 'Audio & Recording',
        description: 'Configure microphone, speakers, quality, and transcription.',
        steps: [
          'Select your microphone from the dropdown. Click refresh to re-scan.',
          'Select your speakers or headphones.',
          'Choose recording quality: Standard (64 kbps), High (128 kbps), or Maximum (256 kbps).',
          'Choose transcription language from 14 options or Auto-Detect.',
          'Toggle Auto-Sync to Calendar to add meetings to Google Calendar.',
        ],
      },
      {
        id: 'set-permissions',
        title: 'Permissions',
        description: 'View and manage browser permissions.',
        steps: [
          'Microphone (required), Camera, Notifications, and Clipboard.',
          'Each shows its state: Granted (green), Denied (red), Not Granted (amber).',
          'Click Grant Access or Retry to request permissions.',
          'For denied permissions, follow browser instructions to re-enable.',
        ],
      },
      {
        id: 'set-notifications',
        title: 'Notifications',
        description: 'Control how and when Entomate notifies you.',
        steps: [
          'Email: Meeting Summaries, Overdue Reminders, Weekly Digest.',
          'In-App: Task Assignments, Meeting Ready, Agent Suggestions.',
          'Browser Push Notifications toggle.',
          'Quiet Hours with configurable start and end times.',
        ],
      },
      {
        id: 'set-slack',
        title: 'Slack Integration',
        description: 'Connect Slack for automated notifications.',
        steps: [
          'View connection status and workspace name.',
          'Test connection and select a default channel.',
          'Toggle events: Meeting Completed, Deal Won, Overdue Reminders, New Action Items.',
          'Save settings and send a test message to verify.',
        ],
      },
      {
        id: 'set-ai',
        title: 'AI & Learning',
        steps: [
          'Summary Detail Level: Brief, Standard, or Detailed.',
          'Auto-Assign Confidence Threshold slider (0.3 to 1.0, default 0.75).',
          'Sentiment Analysis toggle.',
          'Open the Learning Dashboard to review, approve, or reject AI-learned patterns.',
        ],
      },
      {
        id: 'set-connections',
        title: 'System Status',
        steps: [
          'AI Provider \u2014 Whether OpenAI or Gemini is connected and working.',
          'Database \u2014 Whether Supabase connection is active.',
          'CRM Integration \u2014 Logos Vision via Ecosystem Bridge.',
          'Chat Integration \u2014 Pulse via Ecosystem Bridge.',
          'Click Test All to verify all connections at once.',
        ],
      },
      {
        id: 'set-ecosystem',
        title: 'Ecosystem Connections',
        description: 'Manage cross-app connections with Pulse and Logos Vision.',
        steps: [
          'Open the Ecosystem Settings section.',
          'Add or edit connection details for Pulse and Logos Vision.',
          'Generate secure tokens for authentication.',
          'Test connections and view recent sync events.',
        ],
      },
      {
        id: 'set-config',
        title: 'Configuration Guide',
        steps: [
          'Each integration includes required environment variables.',
          'Links to provider documentation for setup.',
          'Step-by-step configuration instructions.',
        ],
      },
    ],
    tips: [
      'The About section shows your current Entomate version and tech stack.',
      'Test connections regularly to catch integration issues early.',
    ],
  },

  {
    id: 'keyboard-shortcuts',
    title: 'Keyboard Shortcuts',
    icon: '\u2328\uFE0F',
    badge: 'New',
    summary: 'Full list of keyboard shortcuts for navigation, actions, and search.',
    steps: [
      'Press Ctrl+? to show the keyboard shortcuts help overlay at any time.',
      'General: Ctrl+K (Command Palette), Ctrl+/ (Search), Escape (close dialogs).',
      'Navigation: G then D (Dashboard), G then M (Meetings), G then P (Projects), G then T (Tasks), G then S (Search).',
      'Actions: Ctrl+M (New Meeting), Ctrl+P (New Project), Ctrl+T (New Task).',
      'Search: Ctrl+Enter (submit), Tab (switch type), Ctrl+S (save search).',
    ],
    tips: [
      'Navigation shortcuts use a two-key sequence: press G first, then the letter.',
      'Shortcuts are platform-aware: Cmd on Mac, Ctrl on Windows.',
    ],
  },

  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '\u{1F527}',
    summary: 'Common issues, fixes, and frequently asked questions.',
    steps: [
      'Check this section when you encounter problems with Entomate.',
      'Most issues can be resolved by testing connections in Settings.',
      'For AI-related issues, verify your AI provider status.',
    ],
    subsections: [
      {
        id: 'ts-auth',
        title: 'Sign-In Issues',
        steps: [
          'Entomate uses Google sign-in through Supabase.',
          'Make sure you are using a Google account.',
          'Ensure pop-ups are not blocked in your browser.',
          'Try clearing cookies and signing in again.',
        ],
      },
      {
        id: 'ts-meetings',
        title: 'Meeting & Transcription Issues',
        steps: [
          'Check the AI Provider status on the Settings page.',
          'Make sure your AI provider (OpenAI or Gemini) is connected.',
          'Click Test All to verify connections.',
          'Check Settings > Permissions to ensure microphone access is granted.',
          'If no action items appear, the meeting may not have a transcript yet.',
        ],
      },
      {
        id: 'ts-audio',
        title: 'Audio & Microphone Issues',
        steps: [
          'Go to Settings > Audio & Recording and verify the correct microphone is selected.',
          'Click the refresh button to re-scan for audio devices.',
          'Check that your microphone is not muted at the operating system level.',
          'Ensure microphone permission is Granted in Settings > Permissions.',
        ],
      },
      {
        id: 'ts-calendar',
        title: 'Calendar Issues',
        steps: [
          'Verify Google Calendar is connected in the Calendar page.',
          'Try disconnecting and reconnecting to refresh authorization.',
          'Check that your Google account has calendar access permissions.',
        ],
      },
      {
        id: 'ts-workflows',
        title: 'Workflow Issues',
        steps: [
          'Check that the workflow is set to Active (not Paused).',
          'Use the Test (dry run) feature to verify logic.',
          'Check execution history for error messages.',
          'Verify that connected integrations are working in Settings.',
        ],
      },
      {
        id: 'ts-slack',
        title: 'Slack Issues',
        steps: [
          'Go to Settings > Integrations > Slack and click Test Connection.',
          'Verify a default channel is selected.',
          'Use Send Test Message to verify the integration.',
          'Check that notification event toggles are enabled.',
        ],
      },
      {
        id: 'ts-notifications',
        title: 'Notification Issues',
        steps: [
          'Check Settings > Permissions to ensure Notifications permission is Granted.',
          'Verify desired notification types are enabled in Settings > Notifications.',
          'Check that Quiet Hours is not currently active.',
        ],
      },
    ],
    useCases: [
      {
        id: 'faq-no-record',
        title: 'Can I use Entomate without recording meetings?',
        scenario: 'You want to use Tasks, Projects, Goals, Workflows, and Agents independently.',
        steps: [
          'Yes \u2014 all features work independently of meeting recordings.',
          'Create tasks, projects, and goals directly from their respective pages.',
          'Workflows and automations can be triggered by events other than meetings.',
        ],
      },
      {
        id: 'faq-ai-learn',
        title: 'How does the AI learn from my feedback?',
        scenario: 'You want to understand how accepting or overriding recommendations improves the AI.',
        steps: [
          'When you accept, modify, or override AI recommendations, the system tracks these decisions.',
          'Over time, it detects patterns in your preferences.',
          'You can review and approve these patterns in the Learning Dashboard under Settings.',
        ],
      },
      {
        id: 'faq-export',
        title: 'Can I export my data?',
        scenario: 'You need to get your data out of Entomate for external analysis.',
        steps: [
          'Go to the Reports page for PDF reports and CSV data exports.',
          'Export analytics data as CSV from the Analytics page.',
          'Bulk export meetings as Markdown from the Meetings page.',
        ],
      },
      {
        id: 'faq-security',
        title: 'Is my data secure?',
        scenario: 'You want to understand Entomate\'s data security model.',
        steps: [
          'Entomate uses Supabase with Row-Level Security (RLS) policies.',
          'Each user can only access their own data.',
          'All connections use encrypted protocols.',
          'API keys and secrets are managed through environment variables, never stored in code.',
        ],
      },
      {
        id: 'faq-languages',
        title: 'What languages does transcription support?',
        scenario: 'You need to transcribe meetings in a language other than English.',
        steps: [
          '14 languages are supported: English, Spanish, French, German, Portuguese, Italian, Dutch, Japanese, Korean, Chinese, Arabic, Hindi, and Russian.',
          'Choose Auto-Detect to let the AI determine the language automatically.',
          'Set your preferred language in Settings > Audio & Recording.',
        ],
      },
      {
        id: 'faq-quality',
        title: 'Can I choose my recording quality?',
        scenario: 'You want higher quality recordings for important meetings.',
        steps: [
          'Go to Settings > Audio & Recording.',
          'Choose Standard (64 kbps), High (128 kbps), or Maximum (256 kbps).',
          'Higher quality produces larger files but better transcription accuracy.',
        ],
      },
    ],
    tips: [
      'Most issues can be diagnosed by clicking Test All in Settings > System Status.',
      'The AI Learning Dashboard lets you fine-tune AI behavior by approving or rejecting patterns.',
    ],
  },
]
