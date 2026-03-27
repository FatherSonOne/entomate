// ─── Entomate User Guide Data ─────────────────────────────────────────────
// Version tracking — update these when guide content changes

export const guideVersion = '1.0.0'
export const guideUpdated = 'March 25, 2026'

// ─── Version key for localStorage new-feature detection ───────────────────
export const GUIDE_VERSION_KEY = 'entomate_guide_version'

// ─── Categories (sidebar grouping) ────────────────────────────────────────

export const CATEGORIES = [
  { label: 'Start Here',         ids: ['introduction', 'getting-started', 'dashboard'] },
  { label: 'Meetings & Time',    ids: ['meetings', 'meeting-details', 'calendar'] },
  { label: 'Work Management',    ids: ['tasks', 'projects', 'goals'] },
  { label: 'Automation & AI',    ids: ['workflows', 'automations', 'agents'] },
  { label: 'Intelligence',       ids: ['search', 'analytics', 'reports'] },
  { label: 'Configuration',      ids: ['settings', 'troubleshooting'] },
]

// ─── Section definitions ──────────────────────────────────────────────────

export const guideSections = [
  {
    id: 'introduction',
    title: 'Introduction',
    icon: '📖',
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
          'Meetings — Recorded sessions with AI-generated transcripts, summaries, and sentiment analysis.',
          'Action Items — Tasks automatically extracted from meetings, with AI-suggested assignments and deadlines.',
          'Workflows — Visual, node-based automations that connect meeting events to actions.',
          'Agents — AI bots that run continuously, handling assignment, priority, and follow-up detection.',
          'Goals — OKR-style goal hierarchies with key results and progress tracking.',
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
      'The sidebar groups features by category — Intelligence, Work, Automation, and Output.',
    ],
  },

  {
    id: 'getting-started',
    title: 'Getting Started',
    icon: '🚀',
    badge: 'Updated',
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
          'Intelligence — Dashboard, Meetings, Calendar, Search.',
          'Work — Projects, Project Board, Tasks, Goals.',
          'Automation — Workflows, Automations, AI Agents.',
          'Output — Analytics, Reports.',
          'Settings and your user profile are at the bottom of the sidebar.',
        ],
        note: 'Use keyboard shortcut Ctrl+K to open the Command Palette for quick navigation.',
      },
    ],
    tips: [
      'The top bar shows breadcrumbs so you always know where you are.',
      'Toggle dark/light mode with the sun/moon icon in the top bar.',
    ],
  },

  {
    id: 'dashboard',
    title: 'Dashboard',
    icon: '📊',
    badge: 'Updated',
    summary: 'Your home screen with real-time intelligence, quick actions, and system status.',
    steps: [
      'Navigate to Dashboard from the sidebar (it\'s your landing page after sign-in).',
      'Review the ring gauges showing Meetings, Tasks, Projects, and Automations counts.',
      'Check the Intelligence Briefing card for a system snapshot.',
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
        id: 'dash-quick',
        title: 'Quick Actions',
        description: 'A docked toolbar at the bottom of the Dashboard for instant access.',
        steps: [
          'Start Meeting — Opens the meeting recorder.',
          'New Task — Creates a task instantly.',
          'New Project — Starts a new project.',
          'AI Insights — Jumps to the Intelligence Dashboard.',
          'Automations — Goes to the Automations page.',
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
          'Recent Meetings list shows your latest sessions with sentiment badges.',
          'Open Tasks list highlights outstanding action items with priority indicators.',
        ],
      },
    ],
    tips: [
      'The greeting uses a typewriter animation and changes based on time of day.',
      'Sentiment emojis: 😊 Positive, 😐 Neutral, 😟 Negative.',
    ],
  },

  {
    id: 'meetings',
    title: 'Meetings',
    icon: '🎙️',
    badge: 'Updated',
    summary: 'Record, transcribe, search, and manage all your meetings.',
    steps: [
      'Navigate to Meetings from the sidebar.',
      'Browse meeting cards showing title, sentiment, summary, date, duration, and attendee count.',
      'Use the search bar to filter meetings by title or summary content.',
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
        id: 'mtg-sentiment',
        title: 'Sentiment Indicators',
        description: 'Each meeting has an AI-detected sentiment badge.',
        steps: [
          '😊 Positive — shown in mint/green.',
          '😐 Neutral — shown in gray.',
          '😟 Negative — shown in crimson/red.',
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
      'Meetings are sorted by date with the most recent first.',
    ],
  },

  {
    id: 'meeting-details',
    title: 'Meeting Details',
    icon: '📝',
    summary: 'Deep dive into a single meeting with transcripts, AI analysis, and action items.',
    steps: [
      'Click any meeting from the Meetings list to open its detail view.',
      'Review the AI-generated summary, key points timeline, and decisions timeline.',
      'Scroll the full transcript in the transcript viewer.',
      'Manage action items in the right-side panel — mark complete, delete, or create new ones.',
    ],
    subsections: [
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
          'Share to Chat — Send a meeting recap to a connected chat channel (e.g., Slack).',
          'Sync to CRM — Push action items and meeting data to your connected CRM.',
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
    ],
    tips: [
      'The Ask AI feature understands the full meeting context — try follow-up questions.',
      'Key Points and Decisions are displayed on visual timelines for quick scanning.',
    ],
  },

  {
    id: 'calendar',
    title: 'Calendar',
    icon: '📅',
    badge: 'Updated',
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
          'Action Items — Tasks with due dates, shown with a task icon.',
          'Goal Deadlines — Key result and goal deadlines, shown with a target icon.',
          'Calendar Events — Synced events from Google Calendar, shown with a calendar icon.',
          'Each item shows priority color and a link to its source.',
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
    icon: '✅',
    badge: 'New',
    summary: 'Create, prioritize, and track action items with AI-powered recommendations.',
    steps: [
      'Navigate to Tasks from the sidebar.',
      'A guided 3-step wizard appears: Create → Prioritize → Complete.',
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
          'Assignment Suggestions — Who should own this task based on meeting context.',
          'Priority Predictions — AI-recommended priority level.',
          'Deadline Suggestions — Recommended due dates based on project timelines.',
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
    icon: '📁',
    summary: 'Organize tasks, meetings, and goals into project workspaces.',
    steps: [
      'Navigate to Projects from the sidebar.',
      'Follow the 3-step wizard: Create → Organize → Track.',
      'Enter a project name and optional description, then click Create.',
      'Browse project cards in a grid layout — each shows status, deal value, and end date.',
    ],
    subsections: [
      {
        id: 'proj-detail',
        title: 'Project Details',
        description: 'Click any project card to open its detail view.',
        steps: [
          'Stats Cards — Total Tasks, Completed, In Progress, and Open counts.',
          'Tasks Section — Add tasks directly with title and priority.',
          'Manage tasks with checkboxes and delete buttons.',
          'Related Meetings — Meetings linked to this project with clickable links.',
        ],
      },
      {
        id: 'proj-status',
        title: 'Status Indicators',
        steps: [
          'Active — shown in mint/green.',
          'Planning — shown in amber.',
          'Completed — shown in gray.',
          'Archived — shown in gray (dimmed).',
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
    icon: '🎯',
    badge: 'New',
    summary: 'Create and track Objectives and Key Results at Company, Team, and Individual levels.',
    steps: [
      'Navigate to Goals from the sidebar.',
      'Click New Goal and fill in the title, description, type, quarter, and optional parent goal.',
      'View goals in Hierarchy (Company → Team → Individual) or List mode.',
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
          'Total Goals — all goals across all levels.',
          'Average Progress — mean completion percentage.',
          'On Track — goals progressing as expected.',
          'At Risk — goals behind schedule.',
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
    icon: '🔀',
    badge: 'New',
    summary: 'Visual, node-based automations connecting triggers, conditions, and actions.',
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
          'Meeting Processing — Automatically process new meeting recordings.',
          'Webhook to Slack — Route incoming webhooks to Slack channels.',
          'Daily Digest — Generate and send daily summary reports.',
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
          'Use the toolbar to Save, Test (dry run), Execute, or manage the workflow.',
        ],
        note: 'Always use Test (dry run) before activating a workflow to verify behavior.',
      },
      {
        id: 'wf-manage',
        title: 'Managing Workflows',
        steps: [
          'Activate/Pause — Toggle a workflow on or off.',
          'Execute — Run a workflow immediately.',
          'Duplicate — Create a copy for modification.',
          'View History — See past execution logs.',
          'Delete — Remove a workflow permanently.',
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
    icon: '⚡',
    summary: 'Template-based automation rules with triggers, actions, and monitoring.',
    steps: [
      'Navigate to Automations from the sidebar.',
      'Follow the 3-step wizard: Choose Template → Configure → Monitor.',
      'Browse templates by category: AI-Powered, CRM, or Integration.',
      'Click Custom Build to create your own from scratch.',
    ],
    subsections: [
      {
        id: 'auto-templates',
        title: 'Template Categories',
        steps: [
          'AI-Powered — Automations using AI agents (amber badge).',
          'CRM — Automations syncing with your CRM (mint badge).',
          'Integration — Cross-platform automations (crimson badge).',
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
    icon: '🤖',
    badge: 'New',
    summary: 'Deploy and manage intelligent bots for assignment, priority, and follow-up detection.',
    steps: [
      'Navigate to Agents from the sidebar.',
      'Follow the 3-step wizard: Select Template → Customize → Monitor.',
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
          'Execution Logs — See what the agent has done recently.',
          'Explanations — Understand why the agent made specific decisions.',
          'Performance Metrics — Track success rates and execution counts.',
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
    icon: '🔍',
    badge: 'Updated',
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
      'Keyword search is faster for exact term matching.',
    ],
  },

  {
    id: 'analytics',
    title: 'Analytics',
    icon: '📈',
    summary: 'Performance metrics, AI effectiveness tracking, and team performance tables.',
    steps: [
      'Navigate to Analytics from the sidebar.',
      'Select a time period: 7 days, 30 days, 90 days, or 1 year.',
      'Browse tabs: Overview, Meetings, Tasks, AI, and Team.',
      'Click Refresh to update data for the selected period.',
    ],
    subsections: [
      {
        id: 'ana-overview',
        title: 'Overview Tab',
        steps: [
          'Key metric cards show meeting count, task count, and more.',
          'Time Saved breakdown shows savings from transcription, summarization, action items, and automations.',
          'Automation and AI agent performance stats are displayed below.',
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
    ],
  },

  {
    id: 'reports',
    title: 'Reports & Exports',
    icon: '📄',
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
          'Meeting Recap — Select a meeting from the dropdown and download a formatted PDF.',
          'Goals & OKRs — Select a quarter and download a goals progress PDF.',
          'Weekly Summary — Download a 7-day overview as a PDF.',
        ],
      },
      {
        id: 'rep-csv',
        title: 'CSV Exports',
        steps: [
          'Meetings — Export all meeting data.',
          'Action Items — Export all action items across all statuses.',
          'Goals — Export all goals and key results.',
        ],
      },
    ],
    tips: [
      'Use CSV exports to bring data into spreadsheets or BI tools for custom analysis.',
      'Quick Stats cards at the top show total meetings, goals, completed goals, and avg progress.',
    ],
  },

  {
    id: 'settings',
    title: 'Settings',
    icon: '⚙️',
    badge: 'Updated',
    summary: 'Configure appearance, integrations, AI learning, and system connections.',
    steps: [
      'Navigate to Settings from the sidebar.',
      'Toggle between Light and Dark mode under Appearance.',
      'Access the AI Learning Dashboard to manage patterns and feedback.',
      'Click Test Connections to verify all integrations.',
    ],
    subsections: [
      {
        id: 'set-ai',
        title: 'AI Learning',
        steps: [
          'Open the Learning Dashboard to see what the AI has learned from your patterns.',
          'Review detected patterns and approve or reject them.',
          'The AI adjusts its suggestions based on your feedback.',
        ],
      },
      {
        id: 'set-connections',
        title: 'System Status',
        steps: [
          'AI Provider — Whether OpenAI or Gemini is connected and working.',
          'Database — Whether Supabase connection is active.',
          'CRM Integration — Test your CRM connection.',
          'Chat Integration — Test your Slack or chat platform connection.',
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
    id: 'troubleshooting',
    title: 'Troubleshooting',
    icon: '🔧',
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
          'Click Test Connections to verify.',
          'If no action items appear, the meeting may not have a transcript yet.',
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
    ],
    useCases: [
      {
        id: 'faq-no-record',
        title: 'Can I use Entomate without recording meetings?',
        scenario: 'You want to use Tasks, Projects, Goals, Workflows, and Agents independently.',
        steps: [
          'Yes — all features work independently of meeting recordings.',
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
          'Go to the Reports page.',
          'Download PDF reports for meeting recaps, goals, or weekly summaries.',
          'Download CSV exports for meetings, action items, or goals.',
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
    ],
    tips: [
      'Most issues can be diagnosed by clicking Test Connections in Settings.',
      'The AI Learning Dashboard lets you fine-tune AI behavior by approving or rejecting patterns.',
    ],
  },
]
