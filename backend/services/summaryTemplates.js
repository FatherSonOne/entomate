/**
 * Summary templates per meeting type (feature audit 2026-11-22, rec 7).
 *
 * Every summary keeps the same core (summary, key points, decisions, next
 * steps). A template adds a focus line and a few named sections that matter
 * for that kind of meeting, e.g. a 1:1 gets Wins / Blockers / Feedback.
 *
 * The template is picked from the meeting title (and a two-person attendee
 * list for 1:1s) unless someone chose one on the meeting page. The choice and
 * the sections are stored on meetings.summary_template / summary_sections.
 */

'use strict';

const DEFAULT_ID = 'general';
const MAX_SECTION_ITEMS = 8;
const MAX_ITEM_CHARS = 400;

/** @typedef {{ id: string, label: string, focus: string, sections: string[], match?: RegExp }} SummaryTemplate */

/** @type {SummaryTemplate[]} Order matters: the first title match wins. */
const TEMPLATES = [
  {
    id: 'standup',
    label: 'Stand-up',
    match: /\b(stand[\s-]?up|daily sync|daily scrum|scrum)\b/i,
    focus: 'A short status meeting. Keep it tight: progress, plans and blockers per person.',
    sections: ['Done since last time', 'Next up', 'Blockers'],
  },
  {
    id: 'one_on_one',
    label: '1:1',
    match: /\b(1[:\s-]?on[:\s-]?1|1:1|one[\s-]on[\s-]one|check[\s-]?in with)\b/i,
    focus: 'A one-to-one between a manager and a report, or two peers. Capture how the person is doing, not just tasks.',
    sections: ['Wins', 'Blockers and concerns', 'Feedback given', 'Growth and goals'],
  },
  {
    id: 'sales',
    label: 'Sales call',
    match: /\b(sales|discovery|demo|prospect|pitch|deal|pricing call|intro call)\b/i,
    focus: 'A call with a prospect or customer about buying. Write from the seller\'s side.',
    sections: ['Customer needs', 'Objections and risks', 'Budget, timeline and decision makers', 'Agreed next step'],
  },
  {
    id: 'client',
    label: 'Client review',
    match: /\b(client|customer|account review|qbr|check[\s-]?in|kickoff|kick[\s-]off|status review)\b/i,
    focus: 'A meeting with an existing client or partner about ongoing work.',
    sections: ['Client feedback', 'Commitments we made', 'Commitments they made', 'Risks to the relationship'],
  },
  {
    id: 'interview',
    label: 'Interview',
    match: /\b(interview|screen(ing)?|hiring panel|candidate)\b/i,
    focus: 'A job interview. Be fair and specific; quote evidence, avoid judging personal traits.',
    sections: ['Strengths with evidence', 'Concerns with evidence', 'Open questions', 'Recommendation'],
  },
  {
    id: 'planning',
    label: 'Planning',
    match: /\b(planning|roadmap|sprint|retro(spective)?|strategy|offsite|okr|quarterly)\b/i,
    focus: 'A planning or review meeting about priorities and scope.',
    sections: ['Priorities agreed', 'Out of scope or deferred', 'Risks and dependencies', 'Open questions'],
  },
  {
    id: DEFAULT_ID,
    label: 'General',
    focus: '',
    sections: [],
  },
];

const BY_ID = new Map(TEMPLATES.map((t) => [t.id, t]));

/** @returns {SummaryTemplate} */
function getTemplate(id) {
  return BY_ID.get(id) || BY_ID.get(DEFAULT_ID);
}

function isTemplateId(id) {
  return typeof id === 'string' && BY_ID.has(id);
}

/** Real people in an attendee list (speaker labels and blanks don't count). */
function countPeople(attendees) {
  if (!Array.isArray(attendees)) return 0;
  const seen = new Set();
  for (const a of attendees) {
    const raw = typeof a === 'object' && a ? (a.email || a.name || '') : String(a || '');
    const key = raw.trim().toLowerCase();
    if (key && !/^(speaker|participant|guest|unknown)\s*\d*$/.test(key)) seen.add(key);
  }
  return seen.size;
}

/**
 * Pick a template for a meeting.
 * @param {{ title?: string|null, attendees?: unknown[]|null, chosen?: string|null }} meeting
 * @returns {string} template id
 */
function detectTemplate({ title, attendees, chosen } = {}) {
  if (isTemplateId(chosen)) return chosen;
  const t = String(title || '');
  for (const tpl of TEMPLATES) {
    if (tpl.match && tpl.match.test(t)) return tpl.id;
  }
  return countPeople(attendees) === 2 ? 'one_on_one' : DEFAULT_ID;
}

/**
 * Extra prompt text for a template, appended to the base summary prompt.
 * Empty for General, so the default prompt is unchanged.
 */
function sectionTitles(tpl, extraSections) {
  const sections = new Map(tpl.sections.map(title => [title.toLowerCase(), title]));
  for (const title of extraSections) {
    if (!sections.has(title.toLowerCase())) sections.set(title.toLowerCase(), title);
  }
  return [...sections.values()];
}

function promptAddon(id, extraSections = []) {
  const tpl = getTemplate(id);
  const sections = sectionTitles(tpl, extraSections);
  if (!sections.length) return '';
  const meetingType = tpl.focus ? `MEETING TYPE: ${tpl.label}. ${tpl.focus}\n` : '';
  const shape = sections.map((s) => `    { "title": ${JSON.stringify(s)}, "items": ["..."] }`).join(',\n');
  return `

${meetingType}Also include a "sections" array with exactly these titles, in this order. Each item is one short sentence taken from the transcript. Use an empty items array when the meeting did not cover a section; never invent content.
"sections": [
${shape}
]`;
}

/**
 * Keep only the template's sections, in its order, with tidy items.
 * @returns {{ title: string, items: string[] }[]}
 */
function normalizeSections(raw, id, extraSections = []) {
  const tpl = getTemplate(id);
  const sections = sectionTitles(tpl, extraSections);
  const given = new Map();
  for (const s of Array.isArray(raw) ? raw : []) {
    if (!s || typeof s.title !== 'string') continue;
    given.set(s.title.trim().toLowerCase(), s);
  }
  return sections.map((title) => {
    const s = given.get(title.toLowerCase());
    const items = (Array.isArray(s?.items) ? s.items : [])
      .filter((x) => typeof x === 'string' && x.trim())
      .map((x) => x.trim().slice(0, MAX_ITEM_CHARS))
      .slice(0, MAX_SECTION_ITEMS);
    return { title, items };
  });
}

/** Columns to save with a summary. */
function summaryFields(summaryData) {
  return {
    summary_template: summaryData?.template || DEFAULT_ID,
    summary_sections: Array.isArray(summaryData?.sections) ? summaryData.sections : [],
  };
}

/** Public list for the meeting page picker. */
function listTemplates() {
  return TEMPLATES.map(({ id, label, sections }) => ({ id, label, sections }));
}

module.exports = { DEFAULT_ID, detectTemplate, getTemplate, isTemplateId, listTemplates, normalizeSections, promptAddon, summaryFields, countPeople };
