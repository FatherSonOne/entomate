// ─── Entomate User Guide Data ─────────────────────────────────────────────
// Version tracking — update these when guide content changes

export const guideVersion = '2026-11-23b'
export const guideUpdated = '2026-11-23'

// ─── Version key for localStorage new-feature detection ───────────────────
export const GUIDE_VERSION_KEY = 'entomate_guide_version'

// ─── Contents: grouped like the app nav (Bench Swiss rail) ────────────────

export const CATEGORIES = [
  { label: 'Start',           ids: ['introduction', 'getting-started', 'organizations', 'billing'] },
  { label: 'Meetings',        ids: ['dashboard', 'meetings', 'meeting-details', 'upcoming', 'meeting-intelligence'] },
  { label: 'Work',            ids: ['tasks', 'projects'] },
  { label: 'Follow-through',  ids: ['automations', 'analytics'] },
  { label: 'Tools',           ids: ['search', 'ento-assistant', 'ecosystem'] },
  { label: 'Settings & help', ids: ['settings', 'keyboard-shortcuts', 'troubleshooting'] },
]

// ─── What's new: newest first. Each change links to its section. ─────────
// Add a line here (and bump guideVersion) whenever a section changes.

export const GUIDE_CHANGES = [
  { date: '2026-11-23', section: 'meeting-details', text: 'Follow-up tab: an email to the people who were there, sent on its own 20 minutes after the meeting unless you edit or stop it.' },
  { date: '2026-11-23', section: 'upcoming', text: 'Upcoming in Meetings replaces Calendar: 60 days, a month calendar and Skip or Join per meeting.' },
  { date: '2026-11-23', section: 'dashboard', text: 'Today rewritten for the current page: action items, agents, decisions and schedule.' },
  { date: '2026-11-23', section: 'settings', text: 'Settings is six sections: You, Appearance, Recording, Meeting agents, Connections, Workspace.' },
  { date: '2026-11-23', section: 'ento-assistant', text: 'Ask Entomate keeps your chat across reloads and devices, and shows what it is checking.' },
  { date: '2026-11-23', section: 'billing', text: 'Plans are counted in bot hours. New workspaces start on Free with 2 a month.' },
  { date: '2026-11-22', section: 'tasks', text: 'Tasks is one list with meeting action items, an inspector and lanes.' },
  { date: '2026-11-22', section: 'search', text: 'One search for the Search page and the ⌘K palette, plus Notes.' },
  { date: '2026-11-22', section: 'automations', text: 'Automations, Workflows and meeting agents are one module.' },
  { date: '2026-11-22', section: 'analytics', text: 'Insights replaces Analytics and Reports: follow-through, owners and exports.' },
  { date: '2026-11-22', section: 'meeting-details', text: 'Real names on speaker labels, summary templates per meeting type, and “From last time”.' },
  { date: '2026-11-22', section: 'upcoming', text: 'Bots can join your calendar meetings on their own.' },
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
  { keys: ['N'], label: 'New task on Tasks, new recording on Today' },
  { keys: ['R'], label: 'Refresh Today' },
  { keys: ['T'], label: 'Open Tasks, from Today' },
  { keys: ['?'], label: 'Today\u2019s keys, on Today' },
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
          'Teams tracking project progress across many meetings.',
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
    summary: 'Create your account, sign in, set up your workspace, and find your way around.',
    steps: [
      'Open Entomate and choose Continue with Google, or sign in with your email and password.',
      'New here? Choose Create account, enter your name, email and a password, then follow the link we email you.',
      'Forgot your password? Press Forgot password? and we email you a link to set a new one. If you signed up with Google there is no password: use Continue with Google.',
      'The first time, you name your workspace. If a teammate invited you, accept the invite instead.',
      'Once your workspace is ready, you land on Today.',
    ],
    subsections: [
      {
        id: 'gs-navigation',
        title: 'Navigating the App',
        description: 'The rail on the left has six numbered modules, then Tools.',
        steps: [
          'Meetings: 01 Today, 02 Meetings. Your calendar is the Upcoming tab in Meetings.',
          'Work: 03 Tasks, 04 Projects.',
          'Follow-through: 05 Automations, 06 Insights.',
          'Tools: Search, Bot (owners and admins), User Guide. Press \u2318/ for Ask Entomate.',
          'Settings (00) and your profile are in the toolbar above the page.',
          'On phone the rail becomes a dock along the bottom, with the record key in the middle.',
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
    title: 'Workspaces & Teams',
    summary: 'Create your workspace, invite your team, set roles, and archive or delete a workspace.',
    steps: [
      'After your first sign-in, give your workspace a name and press Create workspace. It starts on the Free plan.',
      'Invite people from Settings \u203a Workspace \u203a Team. They see an Invite waiting card when they sign in.',
      'Each member is an Owner, Admin or Member. Owners and admins can send the bot, change retention and consent, and manage billing.',
    ],
    subsections: [
      {
        id: 'org-invite',
        title: 'Accepting an Invitation',
        steps: [
          'Sign in with the email the invite was sent to.',
          'Press Accept and join on the Invite waiting card.',
          'You land on Today inside the team\u2019s workspace.',
        ],
      },
      {
        id: 'org-archive',
        title: 'Archiving & Deleting',
        description: 'Archive first, with a 30-day window to change your mind.',
        steps: [
          'Owners archive the workspace from Settings \u203a Workspace.',
          'Members lose access at once and open invitations stop working.',
          'A recovery screen shows the days left. Restore it, delete it for good, or start fresh.',
          'Deleting for good asks you to type the workspace name to confirm.',
        ],
      },
    ],
    tips: [
      'Your own account is never deleted with a workspace.',
      'You can restore an archived workspace any time in the 30 days.',
    ],
  },

  {
    id: 'billing',
    title: 'Billing & Plans',
    summary: 'Your plan, its bot hours, and invoices.',
    steps: [
      'Open Settings \u203a Workspace and press Plan and billing to see your plan, usage and invoices.',
      'Every new workspace starts on Free, which includes 2 bot hours a month.',
      'Paid plans add more bot hours: Solo has 15 a month and Team has 75, shared by the workspace.',
      'When the bot hours run out, the bot will not join until they reset at the start of the next period, or you upgrade.',
    ],
    subsections: [],
    tips: [
      'Recording in your own browser does not use bot hours.',
      'Only owners and admins can change the plan.',
    ],
  },

  {
    id: 'dashboard',
    title: 'Today',
    summary: 'Where you land: the live call or next meeting, open action items, agent calls, this week\u2019s decisions and today\u2019s schedule.',
    steps: [
      'Open 01 Today from the rail. It is where you land after sign-in.',
      'The top shows the meeting being recorded now, or a countdown to your next calendar meeting with Send a bot and Record here. With neither, it shows your latest meeting\u2019s summary.',
      'Beside it: meetings this week, items due today (and how many are overdue), and agent calls today.',
      'Press New recording to record in this browser, Ask Entomate to ask a question, or Briefings for meeting prep written by the agents.',
    ],
    subsections: [
      {
        id: 'dash-carry',
        title: 'From last time',
        steps: [
          'Under the top row, Entomate lists what is still open from earlier meetings with the same people as your next meeting, or your latest one when no calendar is connected.',
          'It shows how many items are still open and how many were done since.',
        ],
      },
      {
        id: 'dash-items',
        title: 'Action items',
        steps: [
          'Open action items from your meetings, grouped by when they are due.',
          'Tick the box to mark one done. Click the row to open its meeting.',
          'An amber line or an AI % tag means an agent set the owner, due date or priority.',
          'Press All work to open Tasks.',
        ],
      },
      {
        id: 'dash-agents',
        title: 'Agents',
        steps: [
          'The latest calls the meeting agents made, and whether each was applied or needs your OK.',
          'When the agents have learned patterns from your overrides, a Learning row asks you to Review them.',
        ],
      },
      {
        id: 'dash-decided',
        title: 'Decided this week',
        steps: [
          'Every decision recorded since Monday, with the meeting it came from.',
          'Press the \u25b6 timecode to hear the moment it was decided.',
        ],
      },
      {
        id: 'dash-schedule',
        title: 'Schedule',
        steps: [
          'Today\u2019s calendar events and recorded meetings in time order, with a Now line.',
          'No calendar yet? Press Connect calendar.',
        ],
      },
    ],
    tips: [
      'On Today, press R to refresh, N for a new recording, T for Tasks and ? for these keys.',
      'For the weeks ahead, open Meetings \u203a Upcoming.',
    ],
  },

  {
    id: 'meetings',
    title: 'Meetings',
    summary: 'Every meeting you recorded, and the ones coming up. Record in this browser or send a bot to a call.',
    steps: [
      'Open 02 Meetings from the rail. Past lists your meetings by week; Upcoming shows your calendar.',
      'Filter by All, Live, Ready or Needs you, or search titles, summaries and transcripts.',
      'Click a row to preview the meeting beside the list. Use \u2191 \u2193 to move through it and Enter to open the full meeting.',
      'Press Send a bot to send the bot to a Meet, Zoom or Teams call, or Record to record in this browser.',
    ],
    subsections: [
      {
        id: 'mtg-recording',
        title: 'Recording in this browser',
        steps: [
          'Press Record (or New recording on Today). The recorder opens above the list.',
          'Live captions show while you record.',
          'Stop when you are done. The transcript, summary, decisions and action items are written for you.',
        ],
      },
      {
        id: 'mtg-bot',
        title: 'Sending the bot',
        steps: [
          'Press Send a bot, paste the meeting link and tick the consent line.',
          'The bot joins, records and leaves when the call ends. The meeting then shows here like any other.',
          'To have it join on its own, turn on auto-join (see Upcoming meetings).',
        ],
        note: 'Only owners and admins can send the bot.',
      },
      {
        id: 'mtg-bulk',
        title: 'Select, export and delete',
        steps: [
          'Press Select, then pick meetings or Select all.',
          'Export downloads the picked meetings as a Markdown file.',
          'Delete removes them. You have 8 seconds to press Undo.',
          'Each row\u2019s menu also has Open meeting, Share recap and Delete.',
        ],
      },
      {
        id: 'mtg-speakers',
        title: 'Speaker names',
        description: 'Recordings label voices "Speaker 1", "Speaker 2". Entomate puts real names on them where the transcript shows who spoke.',
        steps: [
          'After a recording, a speaker is renamed automatically only when the evidence is strong, for example they say "I\'m Priya" or are handed over to by name more than once.',
          'Weaker guesses appear under Speakers with the words that suggest them. Press Use name to accept, or dismiss them.',
          'On older meetings press Suggest names to get guesses. You can always rename a speaker by hand.',
          'A rename also updates the attendee list and the owner of any action item given to that speaker.',
        ],
      },
      {
        id: 'mtg-templates',
        title: 'Summaries by meeting type',
        description: 'Each summary is written for the kind of meeting it was.',
        steps: [
          'Entomate picks a type from the title: Stand-up, 1:1, Sales call, Client review, Interview, Planning, or General. A meeting with exactly two people counts as a 1:1.',
          'Typed meetings get extra sections, e.g. a 1:1 shows Wins, Blockers and concerns, Feedback given, Growth and goals.',
          'To change it, open the meeting, open More actions and pick a type under Rewrite the summary as.',
        ],
      },
    ],
    tips: [
      'The bot transcribes most languages, and switches when people do.',
      'Your microphone choice is remembered. Change it in Settings \u203a Recording.',
    ],
  },

  {
    id: 'meeting-details',
    title: 'Meeting Details',
    summary: 'One meeting: its minutes, transcript, notes and action items, with the recording on a tape you can scrub.',
    steps: [
      'Open a meeting from Meetings, Today or Search.',
      'The tape at the top plays the recording. \u25c0\u25c0 Prev and Next \u25b6\u25b6 jump between decisions and action items.',
      'Minutes holds the summary, key points, decisions and action items. Notes are yours, private unless you share them.',
      'The transcript sits on the right (its own tab on phone). Press a timecode to play that moment.',
    ],
    subsections: [
      {
        id: 'md-inline',
        title: 'Editing',
        steps: [
          'Press Edit on the summary or key points (one key point per line), then Save.',
          'To rename the meeting, open More actions \u203a Rename.',
        ],
      },
      {
        id: 'md-ask-ai',
        title: 'Ask this meeting',
        steps: [
          'Type a question under Ask this meeting, for example "What did we decide about the timeline?"',
          'The answer comes from this meeting\u2019s transcript.',
        ],
      },
      {
        id: 'md-carry',
        title: 'From earlier meetings',
        steps: [
          'If you met the same people before, From earlier meetings lists what is still open from those meetings, and what got done.',
        ],
      },
      {
        id: 'md-follow-up',
        title: 'Follow-up email',
        steps: [
          'Open the Follow-up tab. When the minutes are ready, Entomate drafts an email to the people who were there: an opening line, what was decided, who is on what, and the next meeting with the same people.',
          'People come from the calendar invite, the bot\u2019s invitees and the owners of action items. Remove anyone with \u00d7, or type an email to add one.',
          'Click the subject, the opening or the sign-off to change them. The amber line marks the opening Entomate wrote.',
          'Sending: the agent sends it 20 minutes after the meeting ends. Editing it holds it for you; press Stop to keep it from going out. Send now sends it at once.',
          'Replies go to you, and Send me a copy puts a copy in your inbox. Private notes are never included.',
          'To stop follow-ups going out on their own, turn off Send on their own in the Follow-up tab.',
        ],
      },
      {
        id: 'md-share',
        title: 'Share recap',
        steps: [
          'Press Share recap. Post it to a chat channel, or Download PDF. Email the people who were there opens the Follow-up tab.',
          'Send to CRM pushes the action items to Logos Vision.',
          'More actions \u203a Add to calendar puts the meeting and its summary on your Google Calendar.',
        ],
      },
      {
        id: 'md-actions',
        title: 'Action items',
        steps: [
          'Tick an item to mark it done. It is done on Tasks too.',
          'An amber line shows an agent\u2019s call on the owner, due date or priority, with its reason.',
        ],
      },
      {
        id: 'md-intelligence',
        title: 'Intelligence profile',
        steps: [
          'Open More actions \u203a Intelligence profile to see or change how this meeting is analysed.',
        ],
        note: 'See Meeting Intelligence Profiles for the built-in profiles.',
      },
    ],
    tips: [
      'Clip a decision or transcript line to keep it in your Notes on Search.',
    ],
  },

  {
    id: 'upcoming',
    title: 'Upcoming meetings',
    summary: 'Your calendar for the next 60 days, and which meetings the bot will join. Replaces the old Calendar page.',
    steps: [
      'Open Meetings and choose Upcoming.',
      'Connect Google Calendar if you have not. Entomate reads your primary calendar and never changes your events.',
      'Meetings are listed by day. Each says what the bot will do, Bot joins or No bot, and why.',
      'Press Skip on a meeting to keep the bot out, or Join to send it to one auto-join would skip. Press it again to undo.',
      'Click a meeting to see its people, what is still open from last time, and a link to it in Google Calendar.',
    ],
    subsections: [
      {
        id: 'up-month',
        title: 'Month calendar',
        steps: [
          'The small calendar beside the list shows a dot for each meeting: filled when the bot joins, hollow when it does not.',
          'Click a day to jump the list there. Page months to look further ahead.',
          'On phone a week strip sits above the list instead.',
        ],
      },
      {
        id: 'up-week',
        title: 'Week view',
        steps: [
          'On desktop, switch Agenda to Week for seven days on a time grid.',
        ],
      },
      {
        id: 'up-autojoin',
        title: 'Auto-join',
        steps: [
          'Turn auto-join on in Settings \u203a Recording, or from the note on Upcoming.',
          'Choose which meetings: the ones you organise, or every meeting with a video link.',
          'Entomate checks your calendar every 10 minutes and books the bot ahead of each meeting.',
          'With auto-join off, the bot only goes where you send it.',
        ],
        note: 'Only owners and admins can send the bot or turn on auto-join.',
      },
    ],
    tips: [
      'To create or edit events, use Google Calendar. Changes show up here.',
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
    summary: 'Which project is slipping and what needs you. Projects gather tasks and the action items of their linked meetings.',
    steps: [
      'Open 04 Projects from the rail.',
      'Deadlines shows every active project as a track with a Now line. Give a project an end date to see it there.',
      'The table lists projects with their progress and how many items are late. Filter by Active, Planning, Done or All, or search.',
      'Needs you lists late items across all projects.',
      'Press New project, give it a name, and optionally a description, dates and tags.',
    ],
    subsections: [
      {
        id: 'proj-detail',
        title: 'A project',
        steps: [
          'Open items lists its tasks and the action items from its meetings. Switch List and Lanes.',
          'Add task adds one straight to the project.',
          'Who owes what shows the open items per owner.',
          'Link meetings to bring in their action items and decisions. Unlink removes them.',
          'Edit project changes name, status, dates and deal value. Delete project is in the same place.',
        ],
      },
    ],
    tips: [
      'Counts include the action items of each linked meeting, not only tasks you added.',
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
    summary: 'An assistant that answers from your own meetings, tasks, projects and calendar, from any page.',
    steps: [
      'Press \u2318/ (Ctrl+/ on Windows), or Ask Entomate on Today, to open it.',
      'Type a question, or press the mic and speak it.',
      'While it works you see what it is checking: meetings, tasks, projects, the calendar. The answer streams in.',
      'Your conversation is kept, so it is still there after a reload or on another device.',
      'Press New chat to start fresh.',
    ],
    subsections: [
      {
        id: 'ento-context',
        title: 'It knows the page you are on',
        steps: [
          'On a meeting, it can read that meeting\u2019s transcript, summary and action items.',
          'Elsewhere it offers questions that fit the page.',
          'A chat from another page, or older than 30 minutes, is set aside when you open it.',
        ],
      },
      {
        id: 'ento-proactive',
        title: 'Heads-ups',
        steps: [
          'When something needs you, such as an overdue task or action item, or a meeting within the hour, the Ask Entomate button says how many are waiting. No pop-ups.',
          'Open it to see them under Needs attention. Press one and Ask Entomate helps you deal with it.',
          'A heads-up goes away by itself when the task is done or its date moves.',
        ],
      },
    ],
    tips: [
      'Try "What did I promise this week?" or "What is still open from my last client call?"',
      'Drag the panel edge to make it wider. Double-click the edge to reset it.',
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
          'To email a recap to the people who were there, open the meeting\u2019s Follow-up tab.',
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
      'Open Settings \u203a Connections and press Manage on Logos Vision and Pulse.',
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
          'View inbound and outbound events in the same Logos Vision and Pulse drawer.',
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
      'Press Test all in Settings \u203a Connections to catch issues early.',
      'The event log is your best tool for diagnosing sync failures.',
    ],
  },

  {
    id: 'meeting-intelligence',
    title: 'Meeting Intelligence Profiles',
    summary: 'Profiles that shape how a meeting is analysed, summarised and followed up.',
    steps: [
      'Open a meeting, then More actions \u203a Intelligence profile.',
      'Entomate suggests a profile that fits, with how sure it is. Accept it or pick another.',
      'Fill in any fields the profile asks for, such as a grant name or deal stage.',
      'The profile shapes the summary, what the analysis focuses on and which action items are pulled out.',
    ],
    subsections: [
      {
        id: 'mip-builtin',
        title: 'Built-in profiles',
        steps: [
          'Grant Specialist: grant reviews and compliance.',
          'Sales Discovery: pain points, budget signals and next steps.',
          'Client Check-In: relationship health and satisfaction.',
          'Board Meeting: governance decisions and direction.',
          'Internal Standup: progress and blockers.',
          'Strategic Planning: long-term goals and the roadmap.',
          'Vendor Negotiation: terms, pricing and commitments.',
        ],
      },
      {
        id: 'mip-suggest',
        title: 'How suggestions work',
        steps: [
          'Entomate looks at the title, the attendees and words in the meeting.',
          'It matches them against each profile\u2019s rules and shows how sure it is.',
          'You can always choose a different profile.',
        ],
      },
    ],
    tips: [
      'Profiles are different from summary types: the type sets the summary\u2019s sections, the profile sets what the analysis looks for.',
    ],
  },

  {
    id: 'settings',
    title: 'Settings',
    summary: 'Six sections on one page: You, Appearance, Recording, Meeting agents, Connections and Workspace.',
    steps: [
      'Open Settings from the toolbar, or press \u2318,.',
      'Type in Find a setting to jump straight to one.',
      'The sections are numbered 01 to 06. Some parts open in a drawer.',
    ],
    subsections: [
      {
        id: 'set-you',
        title: '01 You',
        steps: [
          'Edit profile changes your name.',
          'Overdue task emails: one email a morning listing tasks assigned to you that are past due.',
          'Browser alerts: desktop alerts from this browser when Entomate is not in front.',
          'Sign out.',
        ],
      },
      {
        id: 'set-appearance',
        title: '02 Appearance',
        steps: [
          'Theme: Light, Dark or System.',
          'Design style and palette for this browser.',
          'Reduce motion for fewer animations.',
        ],
      },
      {
        id: 'set-recording',
        title: '03 Recording',
        steps: [
          'Pick your microphone and allow it in the browser.',
          'Add meetings to Google Calendar after they are processed, with the summary.',
          'Bot auto-join: connect Google Calendar, turn auto-join on and choose which meetings. The next 24 hours show what the bot will do.',
        ],
      },
      {
        id: 'set-agents',
        title: '04 Meeting agents',
        steps: [
          'Turn the Owner, Priority, Deadline and Follow-up agents on or off.',
          'Set how sure an agent must be before it applies a change.',
          'What the agents learned: approve or reject patterns taken from calls you overrode.',
        ],
      },
      {
        id: 'set-connections',
        title: '05 Connections',
        steps: [
          'The status of each service: AI, database, Google Calendar, Logos Vision, Pulse and Slack.',
          'Press Test all to check them at once, or Set up / Manage on one.',
          'Two-way Slack is on hold until each workspace can connect its own Slack.',
        ],
      },
      {
        id: 'set-workspace',
        title: '06 Workspace',
        steps: [
          'Team: invite people, change roles, revoke invites and remove members.',
          'Plan and billing.',
          'Data and privacy: how long recordings are kept, and the consent rules the bot follows.',
          'Archive the workspace (owners only).',
        ],
      },
    ],
    tips: [
      'Old links to a Settings tab still land on the right section.',
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
      'Check this section when something does not work as expected.',
      'Most issues can be found by pressing Test all in Settings \u203a Connections.',
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
          'Open Settings \u203a Connections and press Test all. AI must show Up.',
          'Check that the microphone is Allowed in Settings \u203a Recording.',
          'If no action items appear, the meeting may not have a transcript yet. It shows Being written until it lands.',
          'If the bot did not record, the meeting page says why: for example it was not let in, or the bot hours ran out.',
        ],
      },
      {
        id: 'ts-audio',
        title: 'Audio & Microphone Issues',
        steps: [
          'In Settings \u203a Recording, check the right microphone is picked and press Check.',
          'If it says Blocked, allow the microphone in your browser\u2019s site settings.',
          'Check that your microphone is not muted by your computer.',
        ],
      },
      {
        id: 'ts-calendar',
        title: 'Calendar and auto-join issues',
        steps: [
          'Open Meetings \u203a Upcoming. If it says No calendar, press Connect calendar.',
          'Each meeting says why the bot will or will not join: for example No video link, Someone else organises it, or Skipped.',
          'If the bot should join meetings other people organise, set auto-join to every meeting with a video link in Settings \u203a Recording.',
          'Auto-join needs an owner or admin.',
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
          'Two-way Slack is on hold until each workspace can connect its own Slack.',
          'Settings \u203a Connections shows its status.',
        ],
      },
      {
        id: 'ts-notifications',
        title: 'Notification Issues',
        steps: [
          'In Settings \u203a You, check Browser alerts says Allowed. If it is blocked, allow it in your browser\u2019s site settings.',
          'Overdue task emails are on the same section.',
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
          'Review and approve them in Settings \u203a Meeting agents \u203a What the agents learned, or from the Learning row on Today.',
        ],
      },
      {
        id: 'faq-export',
        title: 'Can I export my data?',
        scenario: 'You need to get your data out of Entomate for external analysis.',
        steps: [
          'Open Insights and press Export for PDF reports and CSV data exports.',
          'Export meetings as Markdown: Meetings \u203a Select, pick them, then Export.',
        ],
      },
      {
        id: 'faq-security',
        title: 'Is my data secure?',
        scenario: 'You want to understand Entomate\'s data security model.',
        steps: [
          'Each workspace only sees its own data, enforced by the database itself.',
          'All connections are encrypted.',
          'Settings \u203a Workspace sets how long recordings are kept and the consent rules the bot follows.',
        ],
      },
      {
        id: 'faq-languages',
        title: 'What languages does transcription support?',
        scenario: 'You need to transcribe meetings in a language other than English.',
        steps: [
          'The bot transcribes most major languages and follows along when people switch language mid-call.',
          'There is nothing to set.',
        ],
      },
      {
        id: 'faq-org-archive',
        title: 'What happens if I archive my workspace?',
        scenario: 'You need to understand the soft-delete recovery window.',
        steps: [
          'Members lose access at once.',
          'You have 30 days to restore it from the recovery screen.',
          'After 30 days the workspace and its data are deleted for good.',
          'Your personal account and profile are not affected.',
        ],
      },
      {
        id: 'faq-plan-change',
        title: 'Can I change my plan later?',
        scenario: 'You want to upgrade, downgrade, or switch billing cycles.',
        steps: [
          'Owners and admins can change it from Settings \u203a Workspace \u203a Plan and billing.',
        ],
      },
    ],
    tips: [
      'Most issues show up when you press Test all in Settings \u203a Connections.',
    ],
  },
]
