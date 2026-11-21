/**
 * Landing page content (direction C, "Minutes").
 *
 * Every line here is checked against the code and the claims ledger in
 * landing-copy-revision-plan-2026-11-21.md (§4). Do not add a claim that is
 * not in that ledger. Status: 'ship' = works today, 'plan' = not built yet.
 *
 * Media lives in /public/landing (re-encoded from QNTM-Assets/entomate/assets).
 */

export const MEDIA = (name) => ({
  poster: `/landing/${name}.jpg`,
  video: `/landing/${name}.mp4`,
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
    head: 'Every recording, understood',
    tag: 'Upload a recording. Entomate transcribes it, summarizes it and pulls out the decisions.',
    features: [
      ['Audio upload, transcribed by Gemini or OpenAI', 'ship'],
      ['Summary, key points and decisions', 'ship'],
      ['Sentiment for each meeting', 'ship'],
      ['Ask questions of any meeting', 'ship'],
      ['Full-text and semantic search', 'ship'],
      ['Meet Mate notetaker for your video calls', 'ship'],
      ['Decisions and action items linked to the moment in the transcript', 'ship'],
    ],
    src: 'routes/meetings.js · routes/search.js · services/transcriptIngest.js',
  },
  {
    name: 'Assistant', sig: 'ai', kicker: 'AI · Ento Assistant', media: 'intelligence',
    head: 'Ask your work anything',
    tag: 'A chat assistant that knows your meetings, tasks and goals.',
    features: [
      ['Streaming chat', 'ship'],
      ['Context from meetings, tasks and goals', 'ship'],
      ['Meeting-prep briefs', 'ship'],
      ['Suggested follow-up questions', 'ship'],
    ],
    src: 'routes/assistant.js',
  },
  {
    name: 'Agents', sig: 'ai', kicker: 'AI · Action items', media: 'glyphs',
    head: 'From talk to owned tasks',
    tag: 'After every processed meeting, the agents set the priority and fill in a due date for each action item.',
    features: [
      ['4 specialized agents with explanations', 'ship'],
      ['Due dates and priority set after every meeting', 'ship'],
      ['Owner recommended automatically', 'plan'],
      ['Promised follow-ups detected', 'ship'],
      ['Send action items to your CRM in one click', 'ship'],
    ],
    src: 'services/agents/* · services/meetingEvents.js',
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
    tag: 'Agents attach a reason and a confidence score to every recommendation.',
    features: [
      ['Factor analysis with confidence', 'ship'],
      ['Learns your preferences from every override', 'ship'],
      ['Pattern detection and outcome tracking', 'ship'],
      ['Alerts for deal risk, relationship health and meeting prep', 'ship'],
    ],
    src: 'services/explainability/* · services/learning/*',
  },
  {
    name: 'Ecosystem', sig: 'brand', kicker: 'Integrations & Trifecto', media: 'bridge',
    head: 'Works with the tools you use',
    tag: 'Connects to your team’s tools, and to Logos Vision and Pulse when they are connected.',
    features: [
      ['Slack: post recaps and alerts', 'ship'],
      ['HubSpot or Salesforce: push tasks, pull deals and contacts', 'ship'],
      ['Google Calendar with OAuth', 'ship'],
      ['Email, and webhooks in and out', 'ship'],
      ['Logos Vision and Pulse bridge, when connected', 'ship'],
      ['Microsoft Teams', 'plan'],
    ],
    src: 'crmService.js · ecosystemBridge.js · slackNotifier.js',
  },
]

export const STATUS = {
  ship: { label: '✓ Shipped', cls: 'ship' },
  plan: { label: '○ Planned', cls: 'plan' },
}

export const AGENTS = [
  { n: '4.1 · Assignment', head: 'Finds the owner', body: 'Recommends an owner by skills and current workload when you run it.' },
  { n: '4.2 · Priority', head: 'Ranks the work', body: 'Weighs meeting sentiment, urgency language and due dates.' },
  { n: '4.3 · Deadline', head: 'Sets a date', body: 'Suggests realistic due dates from task complexity and priority.' },
  { n: '4.4 · Follow-up', head: 'Catches promises', body: 'Detects promised follow-ups in the conversation.' },
]

/** Section 05: the Meet Mate notetaker. Each line is checked against botOrchestrator.js, consent.js, transcriptIngest.js, transcriptMoments.js and dataDeletion.js. */
export const CAPTURE = [
  { n: '5.1 · Visible', head: 'Joins by name', body: 'Meet Mate joins as a named participant and announces itself in the meeting chat.' },
  { n: '5.2 · Asks first', head: 'One-click opt-out', body: 'Attendees get an email before the meeting and can opt out in one click. The organizer is told.' },
  { n: '5.3 · Linked', head: 'Back to the moment', body: 'The transcript keeps speaker names, and every decision and action item links to the moment it was said.' },
  { n: '5.4 · Yours', head: 'Ask to delete', body: 'Anyone can request that their data be deleted.' },
]

export const ECOSYSTEM_LINKS = [
  { href: 'https://crm.logosvision.org', label: 'Logos Vision' },
  { href: 'https://pulse.logosvision.org', label: 'Pulse' },
  { href: 'https://qntmecos.com', label: 'qntmecos.com' },
]
