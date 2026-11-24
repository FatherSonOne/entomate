/**
 * Landing page content (direction C, "Minutes").
 *
 * Check public claims against the current implementation and any access
 * requirements. Status: 'ship' = available, 'plan' = planned.
 */

export const LANDING_MEDIA_DIR = '/landing'

export const MEDIA = (name) => ({
  poster: `${LANDING_MEDIA_DIR}/${name}.jpg`,
  video: `${LANDING_MEDIA_DIR}/${name}.mp4`,
})

export const NAV_LINKS = [
  { href: '#modules', n: '02', label: 'Modules' },
  { href: '#work', n: '03', label: 'Shows its work' },
  { href: '#agents', n: '04', label: 'Agents' },
  { href: '#capture', n: '05', label: 'Notetaker' },
  { href: '#guide', n: '07', label: 'Guide' },
]

export const BAND = [
  { value: '4', label: 'Specialized AI agents' },
  { value: '60+', label: 'Workflow building blocks' },
  { value: '6', label: 'Workflow triggers' },
  { value: '3', label: 'Apps, one ecosystem', note: 'with Logos Vision and Pulse' },
]

/** sig: which signal colour marks the module. live = phosphor, ai = amber, brand = crimson. */
export const MODULES = [
  {
    name: 'Meetings', sig: 'live', kicker: 'Meeting intelligence', media: 'signal',
    head: 'From recording to minutes',
    tag: 'Capture a call with Meet Mate, record in your browser, or upload audio.',
    features: [
      ['Browser recording with live captions, pause and a pop-out recorder', 'ship'],
      ['Summaries, key points, decisions and action items', 'ship'],
      ['Timecodes that jump to the transcript or available recording', 'ship'],
      ['Private-by-default meeting notes', 'ship'],
      ['Editable follow-up emails', 'ship'],
    ],
    src: 'routes/meetings.js · services/transcriptIngest.js',
  },
  {
    name: 'Assistant', sig: 'ai', kicker: 'AI · Ask Entomate', media: 'intelligence',
    head: 'Get answers from your work',
    tag: 'Ask about your meetings, tasks and projects in a chat you can pick up later.',
    features: [
      ['Streaming answers and searchable chat history', 'ship'],
      ['Pre-meeting briefs using past decisions, open follow-ups and your connected calendar', 'ship'],
      ['Full-text and semantic search across meetings', 'ship'],
      ['Admin confirmation for Meet Mate auto-join rules in chat, where enabled', 'ship'],
    ],
    src: 'routes/entoAi.js · routes/search.js',
  },
  {
    name: 'Agents', sig: 'ai', kicker: 'AI · Action items', media: 'glyphs',
    head: 'From talk to owned tasks',
    tag: 'After every processed meeting, the agents set the priority, fill in a due date and suggest an owner from your team for anything unassigned.',
    features: [
      ['4 specialized agents with explanations', 'ship'],
      ['Due dates and priority set after every meeting', 'ship'],
      ['Owner suggested for unassigned items', 'ship'],
      ['Promised follow-ups detected', 'ship'],
      ['Send action items to your CRM in one click', 'ship'],
    ],
    src: 'services/agents/* · services/meetingEvents.js',
  },
  {
    name: 'Projects', sig: 'brand', kicker: 'Projects & tasks', media: 'project-lines',
    head: 'Keep projects on track',
    tag: 'Keep tasks and action items from linked meetings together in one project.',
    features: [
      ['Shared briefs with scope, success criteria, leads and resource links', 'ship'],
      ['Project deadlines, overdue work and schedule progress', 'ship'],
      ['Edit the same meeting action item from Projects, Tasks or its meeting', 'ship'],
    ],
    src: 'routes/projects.js · routes/meetings.js',
  },
  {
    name: 'Workflows', sig: 'brand', kicker: 'Visual workflow builder', media: 'workflow',
    head: 'Design what happens next',
    tag: 'A node-based canvas with 60+ building blocks, so the results go where your team works.',
    features: [
      ['Conditional branching and expressions', 'ship'],
      ['Schedule, webhook and manual triggers', 'ship'],
      ['Dry-run tests that never send, write or call out', 'ship'],
      ['Execution trace and debug logs', 'ship'],
      ['Version history with restore', 'ship'],
      ['Encrypted secrets vault', 'ship'],
    ],
    src: 'services/workflow/*',
  },
  {
    name: 'Explainable', sig: 'ai', kicker: 'AI · Shows its work', media: 'factors',
    head: 'Every decision explained',
    tag: 'Agents attach a reason and a confidence score to every recommendation, shown right under the action item.',
    features: [
      ['Factor analysis with confidence', 'ship'],
      ['Learns your preferences from every override', 'ship'],
      ['Pattern detection and outcome tracking', 'ship'],
      ['Alerts for deal risk, relationship health and meeting prep', 'ship'],
    ],
    src: 'services/explainability/* · services/learning/*',
  },
  {
    name: 'Ecosystem', sig: 'brand', kicker: 'Integrations & ecosystem', media: 'bridge',
    head: 'Works with the tools you use',
    tag: 'Connects to your team’s tools, and to Logos Vision and Pulse when they are connected.',
    features: [
      ['Slack: post recaps and alerts', 'ship'],
      ['HubSpot or Salesforce: push tasks, pull deals and contacts', 'ship'],
      ['Google Calendar with OAuth', 'ship'],
      ['Email, and webhooks in and out', 'ship'],
      ['Logos Vision and Pulse bridge, when connected', 'ship'],
      ['Microsoft Teams app integration', 'plan'],
    ],
    src: 'crmService.js · ecosystemBridge.js · slackNotifier.js',
  },
]

export const STATUS = {
  ship: { label: '✓ Shipped', cls: 'ship' },
  plan: { label: '○ Planned', cls: 'plan' },
}

export const AGENTS = [
  { n: '4.1 · Assignment', head: 'Finds the owner', body: 'Picks an owner from your own team by skills and current workload.' },
  { n: '4.2 · Priority', head: 'Ranks the work', body: 'Weighs meeting sentiment, urgency language and due dates.' },
  { n: '4.3 · Deadline', head: 'Sets a date', body: 'Suggests realistic due dates from complexity, priority and the owner\'s open work.' },
  { n: '4.4 · Follow-up', head: 'Catches promises', body: 'Detects promised follow-ups in the conversation.' },
]

/** Section 05: the Meet Mate notetaker. */
export const CAPTURE = [
  { n: '5.1 · Visible', head: 'Joins by name', body: 'Meet Mate joins as a named participant and announces itself in the meeting chat.' },
  { n: '5.2 · Consent', head: 'Notify attendees', body: 'Organizers confirm they’ll notify attendees before recording. When opt-out emails are sent, attendees can opt out in one click.' },
  { n: '5.3 · Linked', head: 'Back to the moment', body: 'Speaker names are kept when available. Timecodes take you back to the moments behind decisions and action items.' },
  { n: '5.4 · Yours', head: 'Ask to delete', body: 'Anyone can request that their data be deleted.' },
]

export const ECOSYSTEM_LINKS = [
  { href: 'https://crm.logosvision.org', label: 'Logos Vision' },
  { href: 'https://pulse.logosvision.org', label: 'Pulse' },
  { href: 'https://qntmecos.com', label: 'qntmecos.com' },
]
