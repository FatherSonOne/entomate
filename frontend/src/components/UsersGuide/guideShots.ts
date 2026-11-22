/**
 * Screenshots in the User Guide, keyed by section or subsection id.
 * Files live in public/guide/<id>-light.webp and <id>-dark.webp, shot from the
 * seeded qntmecos workspace on production (Playwright, 1440x900 at 2x, cropped to
 * the faceplate, 1200px wide WebP). Only seed rows (ids 5eed2026-) are shown.
 */
export interface GuideShot {
  caption: string
  alt: string
  /** Intrinsic size, so the page doesn't jump while images load. */
  w: number
  h: number
}

export const GUIDE_SHOTS: Readonly<Record<string, GuideShot>> = {
  'getting-started': {
    caption: 'Sign in with Google or with your email to open your workspace.',
    alt: 'The Entomate sign-in page with a Welcome Back card offering Continue with Google and Sign in with Email.',
    w: 1200, h: 750,
  },
  dashboard: {
    caption: 'Today opens on your latest meeting, with overdue action items and agent calls beside it.',
    alt: 'The Today screen showing the Bluepine renewal prep meeting, counts for the week, an Action items table and an Agents list.',
    w: 1200, h: 857,
  },
  meetings: {
    caption: 'Meetings lists every recording by week, with its tape, length, decisions and status.',
    alt: 'The Meetings list with seed meetings grouped by week, each row showing a waveform, length, decision count and Ready status.',
    w: 1200, h: 857,
  },
  'meeting-details': {
    caption: 'A meeting opens on its minutes, with the transcript and speakers on the right.',
    alt: 'The Bluepine renewal prep meeting with a waveform player, the Minutes tab showing a summary and decisions, and the transcript.',
    w: 1200, h: 857,
  },
  'md-ask-ai': {
    caption: 'Ask a question on the Ask tab and the answer comes from the transcript, with a confidence score.',
    alt: 'The Ask tab of a meeting showing a question about the renewal and an AI answer naming the owners of the next steps.',
    w: 1200, h: 857,
  },
  calendar: {
    caption: 'The calendar shows meetings and due tasks by month, with the next two weeks listed on the right.',
    alt: 'The November month view of the calendar with meetings and tasks on their days, an Upcoming list and Quick Stats.',
    w: 1200, h: 857,
  },
  tasks: {
    caption: 'Tasks lists your own tasks and meeting action items together, overdue first.',
    alt: 'The Tasks list with overdue items at the top, each row showing source, due date, priority and status, and the inspector on the right.',
    w: 1200, h: 857,
  },
  'task-inspector': {
    caption: 'Select a task to open the inspector, where you can set its status and see the meeting it came from.',
    alt: 'The task inspector for an action item showing status buttons, owner, due date, priority, the source meeting and the agent call.',
    w: 1200, h: 857,
  },
  projects: {
    caption: 'Projects shows each deadline on a timeline, with progress, late items and what needs you.',
    alt: 'The Projects screen with a deadline timeline for three projects, a project table with progress bars and a Needs you list.',
    w: 1200, h: 857,
  },
  'proj-detail': {
    caption: 'A project page counts down to its end date and lists its open work and owners.',
    alt: 'The Entomate 1.0 launch project with a countdown to its end date, open and late counts, an Open work table and Who owes what.',
    w: 1200, h: 857,
  },
  automations: {
    caption: 'Automations lists what runs after a meeting, with each one switched on or paused.',
    alt: 'The Automations screen with a table of automations and their last run, Recent runs on the right and the Meeting agents list.',
    w: 1200, h: 857,
  },
  'auto-runs': {
    caption: 'Recent runs shows each run by meeting, and a step that failed is marked in red.',
    alt: 'The Recent runs column of Automations listing runs for seed meetings, with each step marked Sent or Failed.',
    w: 1200, h: 857,
  },
  'ento-assistant': {
    caption: 'Ask Entomate opens from any page and answers with what it can see in your workspace.',
    alt: 'The Ask Entomate panel open over Today, answering a question about overdue tasks with a list of four items.',
    w: 1200, h: 906,
  },
  search: {
    caption: 'Search finds a word across meetings, decisions, action items, tasks and projects at once.',
    alt: 'The Search screen with results for Bluepine grouped into Meetings and Action items, matches highlighted, and a Notes panel.',
    w: 1200, h: 857,
  },
  analytics: {
    caption: 'Insights shows how many action items were done on time and who still owes what.',
    alt: 'The Insights screen with an on-time chart for the last 30 days, a Who owes what table by owner and a list of exports.',
    w: 1200, h: 857,
  },
  ecosystem: {
    caption: 'Manage the Pulse and Logos Vision links from Connections in Settings.',
    alt: 'The Logos Vision and Pulse drawer in Settings showing the Ecosystem Bridge with both apps connected and delivery counts.',
    w: 1200, h: 906,
  },
  'meeting-intelligence': {
    caption: 'The Context tab of a meeting is where you choose its intelligence profile.',
    alt: 'The Context tab of a meeting showing Meeting Intelligence with profiles such as Board Meeting, Client Check-in and Sales Discovery.',
    w: 1200, h: 857,
  },
  settings: {
    caption: 'Settings keeps everything on one page, with a contents list on the right.',
    alt: 'The Settings screen showing the You section with notifications and appearance, and an On this page list of sections.',
    w: 1200, h: 857,
  },
  'set-appearance': {
    caption: 'Appearance sets the theme, reduced motion, design style and palette for this browser.',
    alt: 'The Appearance section of Settings with Light, Dark and System theme buttons, a Reduce motion switch, design styles and palettes.',
    w: 1200, h: 920,
  },
  organizations: {
    caption: 'Workspace in Settings lists your team and roles, with Invite to add people.',
    alt: 'The Workspace section of Settings showing the Quantum Ecosystems workspace, a Team list with Owner and Admin roles, and data and privacy options.',
    w: 1200, h: 902,
  },
  'keyboard-shortcuts': {
    caption: 'Press the question mark key on any page to see the shortcuts that work there.',
    alt: 'The Keyboard shortcuts drawer open over Today, listing keys to refresh, start recording, open Tasks, search and show shortcuts.',
    w: 1200, h: 906,
  },
}
