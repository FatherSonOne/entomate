// ─── Entomate User Guide Data ─────────────────────────────────────────────
// Version tracking — update these when guide content changes

export const guideVersion = '2026-11-22e'
export const guideUpdated = '2026-11-22'

// ─── Version key for localStorage new-feature detection ───────────────────
export const GUIDE_VERSION_KEY = 'entomate_guide_version'

// ─── Contents: grouped like the app nav (Bench Swiss rail) ────────────────

export const CATEGORIES = [
  { label: 'Start',           ids: ['introduction', 'getting-started', 'organizations', 'billing'] },
  { label: 'Meetings',        ids: ['dashboard', 'meetings', 'meeting-details', 'meeting-intelligence', 'calendar'] },
  { label: 'Work',            ids: ['tasks', 'projects'] },
  { label: 'Follow-through',  ids: ['automations', 'analytics'] },
  { label: 'Tools',           ids: ['search', 'ento-assistant', 'ecosystem'] },
  { label: 'Settings & help', ids: ['settings', 'keyboard-shortcuts', 'troubleshooting'] },
]

// ─── What's new: newest first. Each change links to its section. ─────────
// Add a line here (and bump guideVersion) whenever a section changes.

export const GUIDE_CHANGES = [
  { date: '2026-11-22', section: 'tasks', text: 'Tasks is one list with meeting action items, an inspector and lanes.' },
  { date: '2026-11-22', section: 'search', text: 'One search for the Search page and the ⌘K palette, plus Notes.' },
  { date: '2026-11-22', section: 'automations', text: 'Automations, Workflows and meeting agents are one module.' },
  { date: '2026-11-22', section: 'analytics', text: 'Insights replaces Analytics and Reports: follow-through, owners and exports.' },
  { date: '2026-11-22', section: 'meeting-details', text: 'Real names on speaker labels, summary templates per meeting type, and “From last time”.' },
  { date: '2026-11-22', section: 'calendar', text: 'Bots can join your calendar meetings on their own.' },
  { date: '2026-11-22', section: 'dashboard', text: 'Today shows the live call or next meeting, open items and agent calls.' },
  { date: '2026-11-22', section: 'keyboard-shortcuts', text: 'The shortcut list now shows only the keys that work.' },
  { date: '2026-11-21', section: 'meetings', text: 'Live captions while recording; a pressed timecode plays the recording.' },
]

// ─── Shortcuts: only keys Layout, Tasks, Search and the palette register ──

export const SHORTCUTS = [
  { keys: ['⌘', 'K'], label: 'Open the palette: search, ask, go to a page', top: true },
  { keys: ['⌘', '/'], label: 'Ask Entomate', top: true },
  { keys: ['⌘', '?'], label: 'Show all shortcuts', top: true },
  { keys: ['⌘', 'M'], label: 'New meeting', top: true },
  { keys: ['⌘', ','], label: 'Settings', top: true },
  { keys: ['Esc'], label: 'Close a drawer or dialog' },
  { keys: ['/'], label: 'Search on Tasks, Search and this guide' },
  { keys: ['N'], label: 'New task, on Tasks' },
  { keys: ['Tab'], label: 'Ask from the palette' },
  { keys: ['⌘', 'S'], label: 'Keep a palette result in Notes' },
  { keys: ['⌘', '↵'], label: 'Open the palette query in Search' },
]

// ─── Section definitions ──────────────────────────────────────────────────

export const guideSections = [
  {
    id: 'introduction',
    title: 'Introduction',
    summary: 'What Entomate is and how it helps your team turn meetings into action.',
    steps: [
      'Entomate is an AI-powered meeting intelligence platform.',
      'It records and transcribes meetings, then extracts action items, priorities, and follow-ups automatically.',
      'AI agents learn from your feedback over time to improve suggestions.',
      'Use automations to send meeting outcomes to your tools.',
    ],
    subsections: [
      {
        id: 'intro-concepts',
        title: 'Key Concepts',
        description: 'The core building blocks of Entomate.',
        steps: [
          'Meetings: Recorded sessions with AI-generated transcripts, summaries, and sentiment analysis.',
          'Action Items: Tasks automatically extracted from meetings, with AI-suggested assignments and deadlines.',
          'Automations: Recipes that run after a meeting, on a schedule or from a webhook.',
          'Meeting agents: Set the owner, priority and due date of each action item, and say why.',
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
      'Press \u2318K for the palette: search, ask, or jump to any page.',
      'The rail groups modules the way you work: Meetings, Work, Follow-through, Tools.',
    ],
  },

  {
    id: 'getting-started',
    title: 'Getting Started',
    summary: 'Create your account, sign in, set up your organization, and find your way around.',
    steps: [
      'Visit the Entomate landing page and click Get Started.',
      'Sign in with your Google account through Supabase OAuth.',
      'A branded loading screen tracks your session setup progress.',
      'If this is your first time, you will be guided through organization setup.',
      'If you have a team invitation, accept it from the banner that appears.',
      'Once your organization is ready, you land on Today.',
    ],
    subsections: [
      {
        id: 'gs-navigation',
        title: 'Navigating the App',
        description: 'The sidebar has six numbered modules, then Tools.',
        steps: [
          'Meetings: 01 Today, 02 Meetings.',
          'Work: 03 Tasks, 04 Projects (switch Projects to Board view for the kanban).',
          'Follow-through: 05 Automations, 06 Insights.',
          'Tools: Search, Ask Entomate, User Guide. Admins send bots from Meetings or Today.',
          'Your calendar lives on Today: the schedule, the countdown to the next meeting, and Connect calendar.',
          'Settings and your profile are in the toolbar above the page.',
        ],
        note: 'Press \u2318K (Ctrl+K on Windows) to open the palette from anywhere.',
      },
    ],
    tips: [
      'The browser tab shows the module number and name, for example 03 Tasks.',
      'Switch Light and Dark in the toolbar, or choose System in Settings \u203a Appearance.',
    ],
  },

  {
    id: 'organizations',
    title: 'Organizations & Teams',
    summary: 'Create organizations, invite team members, manage roles, and handle archiving or deletion.',
    steps: [
      'After your first sign-in, a two-step wizard guides you through creating an organization.',
      'Name your organization and choose a plan (Free, Starter, Pro, Business, or Ecosystem).',
      'Invite team members from Settings. They see a banner on sign-in with one-click acceptance.',
      'Manage member roles: Owner, Admin, or Member.',
    ],
    subsections: [
      {
        id: 'org-create',
        title: 'Creating an Organization',
        description: 'A two-step wizard for new users.',
        steps: [
          'Step 1: Enter a name (2–100 characters). A URL-safe slug is generated automatically.',
          'Step 2: Choose a plan. Each card shows pricing, team limits, run limits, and features.',
          'Plans marked Popular or Full Suite are highlighted for easy comparison.',
        ],
      },
      {
        id: 'org-invite',
        title: 'Accepting an Invitation',
        description: 'Join an existing organization through a team invite.',
        steps: [
          'A highlighted banner shows your invited role and the expiration date.',
          'Click Accept Invitation to join immediately.',
          'You land on Today with full team access.',
        ],
      },
      {
        id: 'org-archive',
        title: 'Archiving & Deleting',
        description: 'Soft-delete with a 30-day recovery window.',
        steps: [
          'Archive from Settings to soft-delete the organization.',
          'Members lose access immediately; invitations stop working.',
          'A recovery screen shows days remaining before permanent deletion.',
          'Restore, permanently delete, or start fresh from the recovery screen.',
          'Permanent deletion requires typing the organization name to confirm.',
        ],
      },
    ],
    tips: [
      'Your personal account is never affected when an organization is archived or deleted.',
      'You can restore an archived organization at any time during the 30-day window.',
    ],
  },

  {
    id: 'billing',
    title: 'Billing & Plans',
    summary: 'Manage your subscription, monitor usage, compare plans, and view invoices.',
    steps: [
      'Go to Settings > Billing to view your current plan, usage, and invoices.',
      'Toggle between Monthly and Yearly billing (yearly saves two months).',
      'Compare plans side by side and click Upgrade to change tiers.',
      'Click Manage to open the Stripe billing portal for payment details.',
    ],
    subsections: [
      {
        id: 'bill-plans',
        title: 'Plan Tiers',
        description: 'Five plans from Free to Ecosystem.',
        steps: [
          'Free: 3 members, 100 runs/month, basic features.',
          'Starter: 5 members, 500 runs/month, basic integrations.',
          'Pro: 15 members, 5,000 runs/month, webhooks and scheduling (Popular).',
          'Business: Unlimited members, 50,000 runs/month, API access.',
          'Ecosystem: Same as Business, plus Pulse and Logos Vision apps (Full Suite).',
        ],
      },
      {
        id: 'bill-usage',
        title: 'Usage Meters',
        description: 'Track your consumption against plan limits.',
        steps: [
          'Three progress bars: Workflows, Runs/month, and Integrations.',
          'Bars change color from green to yellow to red as you approach limits.',
          'An upgrade prompt appears when you hit a limit.',
        ],
      },
      {
        id: 'bill-invoices',
        title: 'Invoice History',
        steps: [
          'View past invoices with date, amount, and status.',
          'Download individual invoices for your records.',
        ],
      },
    ],
    tips: [
      'Watch the usage meters. When a bar turns yellow, consider upgrading.',
      'Yearly billing saves you two months compared to monthly.',
    ],
  },

  {
    id: 'dashboard',
    title: 'Today',
    summary: 'Your home screen with real-time intelligence, new widgets, quick actions, and system status.',
    steps: [
      'Navigate to Today from the sidebar (it\'s your landing page after sign-in).',
      'Review the ring gauges showing Meetings, Tasks, Projects, and Automations counts.',
      'Check the Intelligence Briefing card for a system snapshot.',
      'Monitor the new Overdue Alert Banner, Team Workload, and Insights panels.',
      'Use the Quick Actions bar at the bottom for common tasks.',
    ],
    subsections: [
      {
        id: 'dash-gauges',
        title: 'Ring Gauges',
        description: 'Four interactive metric rings at the top of Today.',
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
          'Sentiment Donut: Positive, Neutral, and Negative distribution.',
          'Priority Bars: High, Medium, and Low priority breakdown.',
          'Completion Ring: Overall task completion rate.',
        ],
      },
      {
        id: 'dash-automation-feed',
        title: 'Automation Activity Feed',
        description: 'Live feed of running automations.',
        steps: [
          'Lists all running automations with status badges.',
          'Active and Paused statuses shown.',
          'Monitor automation health without leaving Today.',
        ],
      },
      {
        id: 'dash-quick',
        title: 'Quick Actions',
        description: 'A docked toolbar at the bottom of Today for instant access.',
        steps: [
          'Start Meeting: Opens the meeting recorder.',
          'New Task: Creates a task instantly.',
          'New Project: Starts a new project.',
          'AI Insights: Jumps to the Intelligence Dashboard.',
          'Automations: Goes to the Automations page.',
        ],
      },
      {
        id: 'dash-intelligence',
        title: 'Intelligence Dashboard',
        description: 'AI-generated insights embedded in Today.',
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
          'Bulk Delete: Remove selected meetings (with confirmation).',
          'Bulk Export: Export selected meetings as a Markdown file.',
        ],
      },
      {
        id: 'mtg-speakers',
        title: 'Speaker names',
        description: 'Recordings label voices "Speaker 1", "Speaker 2". Entomate puts real names on them where the transcript shows who spoke.',
        steps: [
          'After a recording, a speaker is renamed automatically only when the evidence is strong, for example they say "I\'m Priya" or are handed over to by name more than once.',
          'Weaker guesses appear under Speakers on the Transcript tab with the words that suggest them. Press Use name to accept, or dismiss them.',
          'On older meetings press Suggest names to get guesses. You can always rename a speaker by hand.',
          'A rename also updates the attendee list and the owner of any action item given to that speaker, so carry-forward and Insights see the real person.',
        ],
      },
      {
        id: 'mtg-templates',
        title: 'Summaries by meeting type',
        description: 'Each summary is written for the kind of meeting it was.',
        steps: [
          'Entomate picks a type from the title: Stand-up, 1:1, Sales call, Client review, Interview, Planning, or General. A meeting with exactly two people counts as a 1:1.',
          'Typed meetings get extra sections under the summary, e.g. a 1:1 shows Wins, Blockers and concerns, Feedback given, Growth and goals.',
          'To change it, open the meeting, pick a Meeting type under the summary and press Rewrite summary. This replaces the summary, key points and decisions; the type is kept for later reprocessing.',
        ],
      },
      {
        id: 'mtg-sentiment',
        title: 'Sentiment Indicators',
        description: 'Each meeting has an AI-detected sentiment badge.',
        steps: [
          'Positive: shown in mint/green.',
          'Neutral: shown in gray.',
          'Negative: shown in crimson/red.',
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
      'You can also start a meeting directly from Today using the Quick Actions bar.',
      'Your preferred microphone is remembered between sessions. Set it in Settings > Audio & Recording.',
    ],
  },

  {
    id: 'meeting-details',
    title: 'Meeting Details',
    summary: 'Deep dive into a single meeting with inline editing, transcripts, AI analysis, intelligence profiles, and action items.',
    steps: [
      'Click any meeting from the Meetings list to open its detail view.',
      'Review the AI-generated summary, key points timeline, and decisions timeline.',
      'Click any text field (title, summary, key points) to edit it inline.',
      'Manage action items in the right-side panel: mark complete, delete, or create new ones.',
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
          'Share to Chat: Send a meeting recap to a connected chat channel (e.g., Slack).',
          'Sync to CRM: Push action items and meeting data to Logos Vision.',
          'Sync to Calendar: Add the meeting to your Google Calendar.',
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
      'The Ask AI feature understands the full meeting context: try follow-up questions.',
      'Key Points and Decisions are displayed on visual timelines for quick scanning.',
      'Intelligence profiles enrich analysis with external context from contacts, CRM, and past meetings.',
    ],
  },

  {
    id: 'calendar',
    title: 'Calendar',
    summary: 'Unified calendar view combining Google Calendar events, tasks, and goal deadlines.',
    steps: [
      'Open Calendar from the Google Calendar link in the Schedule section of Today.',
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
          'Action Items: Tasks with due dates, shown with a task icon.',
          'Goal Deadlines: Key result and goal deadlines, shown with a target icon.',
          'Calendar Events: Synced events from Google Calendar, shown with a calendar icon.',
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
    summary: 'One work list for your tasks and the action items from meetings, grouped by when they are due.',
    steps: [
      'Open 03 Tasks from the rail, or Tasks in the dock on phone.',
      'Items are grouped Overdue, Due today, Next 7 days, Later, No date and Done.',
      'Tick the box to complete an item. An action item completes in its meeting too.',
      'Click a row to open it in the inspector. Below 1200px and on phone it opens as a drawer.',
      'Press N for a new task and / to search the list.',
    ],
    subsections: [
      {
        id: 'task-inspector',
        title: 'The inspector',
        steps: [
          'Set the status: Open, Doing, Review, Blocked or Done.',
          'Change owner, due date, priority, project and tags.',
          'Press \u25b6 on the source meeting to hear the moment the task came from.',
          'Read the agent\u2019s call: who, when and why, with its confidence.',
          'Add subtasks at the bottom.',
        ],
        note: 'Amber means an agent made the call. Override it and the agent learns from you.',
      },
      {
        id: 'task-lanes',
        title: 'Lanes',
        steps: [
          'Switch to Lanes to see five status lanes.',
          'Drag a task between lanes on desktop.',
          'On phone, lanes are the default view and turn into tabs.',
        ],
      },
      {
        id: 'task-bulk',
        title: 'Select and bulk changes',
        steps: [
          'Press Select. The boxes turn into round pickers.',
          'Pick items, then Mark done, In progress, Blocked or Delete.',
          'Delete skips action items, because they belong to their meeting.',
        ],
      },
      {
        id: 'task-filter',
        title: 'Filter and sort',
        steps: [
          'Show Open, From meetings, Done or All.',
          'Filter \u00b7 sort opens a drawer with sort order and tags.',
          'The view lives in the link, so you can share a filtered list.',
        ],
      },
    ],
    tips: [
      'The box completes and the row opens. Neither does the other\u2019s job.',
      'A task made from a meeting remembers the moment it came from.',
    ],
  },

  {
    id: 'projects',
    title: 'Projects',
    summary: 'Organize tasks and meetings into project workspaces.',
    steps: [
      'Navigate to Projects from the sidebar.',
      'Follow the 3-step wizard: Create \u2192 Organize \u2192 Track.',
      'Enter a project name and optional description, then click Create.',
      'Browse project cards in a grid layout: each shows status, deal value, and end date.',
    ],
    subsections: [
      {
        id: 'proj-detail',
        title: 'Project Details',
        description: 'Click any project card to open its detail view.',
        steps: [
          'Stats Cards: Total Tasks, Completed, In Progress, and Open counts.',
          'Tasks Section: Add tasks directly with title and priority.',
          'Manage tasks with checkboxes and delete buttons.',
          'Related Meetings: Meetings linked to this project with clickable links.',
        ],
      },
      {
        id: 'proj-status',
        title: 'Status Indicators',
        steps: [
          'Active: shown in mint/green.',
          'Planning: shown in amber.',
          'Completed: shown in gray.',
          'Archived: shown in gray (dimmed).',
        ],
      },
    ],
    tips: [
      'Use the search bar on the Projects page to filter by name.',
      'The Project Board (Kanban) view offers a drag-and-drop alternative.',
    ],
  },


  {
    id: 'automations',
    title: 'Automations',
    summary: 'Recipes that run after a meeting, on a schedule or from a webhook. Workflows and meeting agents live here now.',
    steps: [
      'Open 05 Automations from the rail.',
      'Automations are grouped: After a meeting, and On a schedule or webhook.',
      'Use the toggle on a row to turn it on or off.',
      'Press New automation, or Browse recipes and pick one.',
      'Click a row to rename it, see its runs, open it in the builder or delete it.',
    ],
    subsections: [
      {
        id: 'auto-builder',
        title: 'The builder',
        description: 'A full-screen visual editor for the steps of an automation.',
        steps: [
          'Press Open in builder, or Blank in the builder from the templates.',
          'Drag steps onto the canvas and connect them.',
          'Use Test (dry run) to check what it would do before turning it on.',
          'Version history lets you roll back to an earlier version.',
        ],
        note: 'Always run Test before you turn an automation on.',
      },
      {
        id: 'auto-agents',
        title: 'Meeting agents',
        steps: [
          'Assignment, priority, deadline and follow-up agents run on every meeting.',
          'Turn each one on or off in Settings \u203a Meeting agents, and set the confidence they need before applying a change.',
          'Every call shows its reason and confidence on the action item.',
          'The Meeting agents list on the right of Automations links to those settings.',
        ],
      },
      {
        id: 'auto-runs',
        title: 'Recent runs',
        steps: [
          'Recent runs on the right lists the latest runs with their result.',
          'A row whose last run failed says so in red.',
        ],
      },
    ],
    tips: [
      'Workflows and AI Agents used to be separate pages. Both old links bring you here.',
    ],
  },


  {
    id: 'ento-assistant',
    title: 'Ask Entomate',
    summary: 'A context-aware AI chat assistant available from every page. Ask questions, get proactive suggestions, and work faster.',
    steps: [
      'Press \u2318/ (Ctrl+/ on Windows), or Ask Entomate in the rail, to open the assistant.',
      'Type a question or request and press Enter to get a streaming AI response.',
      'Ento understands which page you are on and uses that context to give relevant answers.',
      'Your conversation is preserved during the browser session (up to 50 messages).',
      'A notification badge appears on the assistant button when you have overdue tasks or upcoming meetings.',
    ],
    subsections: [
      {
        id: 'ento-context',
        title: 'Context Awareness',
        description: 'Ento automatically knows what you are working on.',
        steps: [
          'On a Meeting Detail page, Ento has access to the transcript, summary, and action items.',
          'On the Tasks page, Ento knows about your current tasks and priorities.',
          'On any other page, Ento uses the section context to tailor its responses.',
        ],
      },
      {
        id: 'ento-proactive',
        title: 'Proactive Suggestions',
        description: 'Ento monitors your workspace in the background and alerts you when something needs attention.',
        steps: [
          'Overdue tasks: alerts when tasks pass their due date.',
          'Upcoming meetings: notifies you about meetings within the next hour.',
          'Alerts appear as a badge on the assistant button: no pop-ups.',
        ],
        note: 'Proactive checks run every 10 minutes in the background.',
      },
      {
        id: 'ento-conversation',
        title: 'Conversation & History',
        steps: [
          'Ento remembers your earlier messages within the same session.',
          'Ask follow-up questions naturally (e.g., "Tell me more about that").',
          'Click the stop button to abort a response mid-stream.',
          'Conversation history clears when you start a new browser session.',
        ],
      },
    ],
    tips: [
      'You can ask Ento to summarize meetings, draft follow-ups, or explain action items.',
      'The assistant is available from every page: you never need to navigate away.',
      'Responses are streamed in real time so you can start reading immediately.',
    ],
  },

  {
    id: 'search',
    title: 'Search',
    summary: 'One search for meetings, decisions, action items, tasks, projects and your notes. The \u2318K palette runs the same search.',
    steps: [
      'Press \u2318K anywhere for the palette, or open Search from the rail.',
      'Type a few words. Results group by type and show the words that matched.',
      'Press \u25b6 on a meeting result to jump to that moment.',
      'Press Tab in the palette, or Ask on the page, for an answer with sources.',
      'Press \u2318S or + Notes to keep a result.',
    ],
    subsections: [
      {
        id: 'search-notes',
        title: 'Notes',
        steps: [
          'Notes collect what you clip from searches, decisions and transcript lines.',
          'Notes are private to you. Edit them in place.',
          'Copy as Markdown to paste them anywhere.',
        ],
      },
      {
        id: 'search-meaning',
        title: 'Matches by meaning',
        steps: [
          'Once meetings are indexed, search also finds matches by meaning, not only exact words.',
          'There is no switch: both run and the results merge.',
        ],
      },
    ],
    tips: [
      '\u2318\u21b5 in the palette opens the same query on the Search page.',
      'On the Search page, / puts the cursor in the search field.',
    ],
  },

  {
    id: 'analytics',
    title: 'Insights',
    summary: 'Is what you agree in meetings getting done, and who is behind? Follow-through, who owes what, weekly trend, agent calls and every export in one place.',
    steps: [
      'Open Insights from the sidebar (Follow-through group).',
      'Pick a period in the title: 7, 30 or 90 days.',
      'Read follow-through on the display: the share of action items that fell due in the period and were done by their due date. The bars show the last six weeks (crimson is under 70%).',
      'Click an owner in Who owes what to see their open and late items, with a link to the meeting each came from.',
      'Press Export (or a PDF / CSV key in the side column) to download a report.',
    ],
    subsections: [
      {
        id: 'ins-readouts',
        title: 'Readouts',
        steps: [
          'Meetings captured and the decisions recorded in them.',
          'Action items created in the period and how many are done.',
          'Agent calls kept: owner, due date and priority changes the agents made that nobody changed back.',
        ],
      },
      {
        id: 'ins-export',
        title: 'Export',
        steps: [
          'PDF: Meeting recap (pick a meeting), Weekly summary (your last 7 days), Project report (pick a project). Preview a PDF in the drawer before downloading.',
          'CSV: Meetings, Action items (all or one status), Tasks.',
          'To email a recap, open the meeting and use Share recap.',
        ],
      },
    ],
    tips: [
      'Overdue in the title counts open items whose due date has passed, whenever they were created.',
      'Learning effectiveness moved to Settings, under the learning panel.',
    ],
  },

  {
    id: 'ecosystem',
    title: 'Ecosystem Integration',
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
    summary: 'AI profiles that customize how your meetings are analyzed, summarized, and followed up.',
    steps: [
      'Open a meeting or start a new one: the AI will suggest a matching intelligence profile.',
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
          'Grant Specialist: Optimized for grant review and compliance meetings.',
          'Sales Discovery: Focuses on pain points, budget signals, and next steps.',
          'Client Check-In: Tracks relationship health and satisfaction.',
          'Board Meeting: Captures governance decisions and strategic direction.',
          'Internal Standup: Quick daily sync with blockers and progress.',
          'Strategic Planning: Long-term goals, market analysis, and roadmap.',
          'Vendor Negotiation: Contract terms, pricing, and commitments.',
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
          'Contacts: Attendee history, roles, and relationship data.',
          'CRM Deals: Active deal status, stage, and value.',
          'Past Meetings: Previous meetings with same attendees for continuity.',
          'Pulse Threads: Relevant conversations from the Pulse communication app.',
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
    summary: 'Configure appearance, audio, permissions, notifications, Slack, AI learning, billing, organization, and system connections.',
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
          'AI Provider: Whether OpenAI or Gemini is connected and working.',
          'Database: Whether Supabase connection is active.',
          'CRM Integration: Logos Vision via Ecosystem Bridge.',
          'Chat Integration: Pulse via Ecosystem Bridge.',
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
    summary: 'The keys that work today. Cmd on Mac, Ctrl on Windows.',
    steps: [
      'Press \u2318? on any page to see this list as an overlay.',
      'Shortcuts don\u2019t fire while you are typing in a field, except Esc.',
    ],
    tips: [],
  },

  {
    id: 'troubleshooting',
    title: 'Troubleshooting',
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
        title: 'Automation Issues',
        steps: [
          'Check that the automation\u2019s toggle is on.',
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
        scenario: 'You want to use Tasks, Projects and Automations on their own.',
        steps: [
          'Yes: all features work independently of meeting recordings.',
          'Create tasks and projects directly from their pages.',
          'Automations can run on a schedule or from a webhook, not only after meetings.',
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
          'Open Insights and press Export for PDF reports and CSV data exports.',
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
      {
        id: 'faq-org-archive',
        title: 'What happens if I archive my organization?',
        scenario: 'You need to understand the soft-delete recovery window.',
        steps: [
          'Archiving soft-deletes the organization. Members lose access immediately.',
          'You have 30 days to restore it from the recovery screen.',
          'After 30 days the organization and its data are permanently deleted.',
          'Your personal account and profile are not affected.',
        ],
      },
      {
        id: 'faq-plan-change',
        title: 'Can I change my plan later?',
        scenario: 'You want to upgrade, downgrade, or switch billing cycles.',
        steps: [
          'Go to Settings > Billing at any time.',
          'Toggle between Monthly and Yearly billing.',
          'Click Upgrade on the plan you want. Changes take effect immediately.',
        ],
      },
    ],
    tips: [
      'Most issues can be diagnosed by clicking Test All in Settings > System Status.',
      'The AI Learning Dashboard lets you fine-tune AI behavior by approving or rejecting patterns.',
    ],
  },
]
