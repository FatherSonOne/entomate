/**
 * Transcript moments — where in the transcript a summary item was said.
 *
 * The AI summary returns decisions, key points and action items as plain text with no
 * timecodes. Rather than change both providers' prompts (and trust a model to report
 * times), this matches each item back to the transcript line that best supports it,
 * deterministically: weighted word overlap (IDF across the meeting's lines) against each
 * line plus the line after it, since a decision often spans two turns.
 *
 * A weak match returns null. A missing link is honest; a link to the wrong moment is not.
 */

'use strict';

const STOP = new Set((
  'the and for are but not you all any can had her was one our out has him his how its may new now ' +
  'old see two who did get got let put say she too use that with have this will your from they them ' +
  'then than what when where which while would could should about after again also been before being ' +
  'between both each few more most other over same some such only into just like make made very well ' +
  'there their these those here were does doing done going yeah okay sure think know want need really ' +
  'thing things something gonna wanna actually basically right look said says team meeting discuss ' +
  'discussed agreed agree decided decide decision will shall must'
).split(/\s+/));

/** Crude English stem: enough to match "launches"/"launch", "shipping"/"ship". */
function stem(word) {
  let w = word;
  if (w.length > 4 && w.endsWith('ies')) w = `${w.slice(0, -3)}y`;
  else if (w.length > 5 && w.endsWith('ing')) w = w.slice(0, -3);
  else if (w.length > 4 && w.endsWith('ed')) w = w.slice(0, -2);
  else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) w = w.slice(0, -1);
  // "move"/"moved", "launche(s)"/"launch": a trailing e is noise once suffixes are gone.
  if (w.length > 3 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}

function tokens(text) {
  if (typeof text !== 'string') return [];
  return text
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 3 && !STOP.has(w))
    .map(stem);
}

const MIN_SHARED_WORDS = 2;
const MIN_COVERAGE = 0.35;

/**
 * Build a matcher over one meeting's transcript lines.
 * @param {Array<{atMs: number, text: string}>} segments
 * @returns {(text: string) => number|null} ms of the best-supported line, or null.
 */
function createMatcher(segments) {
  const lines = Array.isArray(segments) ? segments.filter((s) => s && typeof s.text === 'string') : [];
  const sets = lines.map((s) => new Set(tokens(s.text)));
  const df = new Map();
  for (const set of sets) for (const t of set) df.set(t, (df.get(t) || 0) + 1);
  const n = Math.max(1, sets.length);
  // A word the transcript never uses counts as rare (df 1): AI paraphrase lowers coverage, it doesn't zero it.
  const idf = (t) => Math.log(1 + n / (df.get(t) || 1));

  return function momentFor(text) {
    const query = [...new Set(tokens(text))].filter((t) => df.has(t));
    const allQuery = new Set(tokens(text));
    if (query.length < MIN_SHARED_WORDS || allQuery.size === 0) return null;
    const totalWeight = [...allQuery].reduce((sum, t) => sum + idf(t), 0);

    let best = { score: 0, shared: 0, index: -1 };
    for (let i = 0; i < sets.length; i++) {
      const next = sets[i + 1];
      let score = 0;
      let shared = 0;
      for (const t of query) {
        if (sets[i].has(t)) {
          score += idf(t);
          shared += 1;
        } else if (next && next.has(t)) {
          // Spill-over into the next turn counts, at half weight, so the line that says
          // it outranks the line just before it.
          score += idf(t) / 2;
          shared += 1;
        }
      }
      // Ties go to the earlier line: the moment a thing was first said.
      if (score > best.score) best = { score, shared, index: i };
    }
    if (best.index < 0 || best.shared < MIN_SHARED_WORDS || best.score / totalWeight < MIN_COVERAGE) return null;
    const atMs = Number(lines[best.index].atMs);
    return Number.isFinite(atMs) && atMs >= 0 ? Math.round(atMs) : null;
  };
}

/**
 * Timecodes for the summary's lists, index-aligned with them.
 * @returns {{keyPoints: Array<number|null>, decisions: Array<number|null>} | null}
 *   null when the meeting has no timed transcript.
 */
function summaryMoments(segments, keyPoints, decisions) {
  if (!Array.isArray(segments) || segments.length === 0) return null;
  const momentFor = createMatcher(segments);
  const map = (list) => (Array.isArray(list) ? list.map((item) => momentFor(String(item ?? ''))) : []);
  return { keyPoints: map(keyPoints), decisions: map(decisions) };
}

/**
 * Annotate AI action items ({ task, context, ... }) with `transcriptAtMs`.
 * Returns new objects; the input is not mutated.
 */
function withActionItemMoments(segments, actionItems) {
  if (!Array.isArray(actionItems)) return [];
  if (!Array.isArray(segments) || segments.length === 0) return actionItems;
  const momentFor = createMatcher(segments);
  return actionItems.map((item) => {
    const atMs = momentFor(`${item?.task || ''} ${item?.context || ''}`);
    return atMs === null ? item : { ...item, transcriptAtMs: atMs };
  });
}

module.exports = { createMatcher, summaryMoments, withActionItemMoments, _internal: { tokens, stem } };
