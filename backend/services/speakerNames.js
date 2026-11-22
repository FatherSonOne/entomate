/**
 * Speaker names (feature audit 2026-11-22, rec 11).
 *
 * The browser recorder's transcript labels voices "Speaker 1", "Speaker 2".
 * Carry-forward, owners and search need real names, so after transcription
 * we guess who each speaker is from what was said, and only rename when the
 * evidence is strong:
 *
 *   1. Self-introductions in the speaker's own lines ("I'm Priya", "my name is").
 *   2. Being addressed: "Thanks, Priya" right before that speaker talks.
 *   3. An AI read of the transcript against the people we expect (attendees,
 *      the person who recorded, org members), with a quoted line as evidence.
 *
 * Each name is used once. Confidence >= AUTO_APPLY renames automatically;
 * weaker guesses are saved as suggestions the meeting page can accept.
 * Pure functions below are tested; load/apply do the reads and the AI call.
 */

'use strict';

const { supabase } = require('../config/supabase');
const ai = require('../config/ai');
const log = require('../utils/log');

const AUTO_APPLY = 0.85;
const SUGGEST = 0.5;
const MAX_CANDIDATES = 60;
const MAX_EXCERPT_CHARS = 12000;
const GENERIC = /^speaker(\s*\d+)?$/i;
const NOT_A_PERSON = /^(speaker|participant|guest|unknown)\s*\d*$/i;
// Words that follow "I'm" / "this is" far more often than a name does.
const NOT_NAMES = new Set(['sure', 'sorry', 'good', 'fine', 'here', 'going', 'not', 'just', 'back', 'happy', 'glad', 'great', 'okay', 'ok', 'it', 'that', 'the', 'a', 'so', 'really', 'also', 'still', 'done', 'ready', 'on', 'in']);

const isGeneric = (speaker) => GENERIC.test(String(speaker || '').trim());
const norm = (s) => String(s || '').toLowerCase().replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
const firstName = (name) => norm(name).split(' ')[0] || '';

/**
 * Distinct real names we might expect in this meeting.
 * @param {...unknown[]} lists names, emails, or { name, email } objects
 * @returns {string[]}
 */
function candidateNames(...lists) {
  const out = new Map();
  for (const list of lists) {
    for (const raw of Array.isArray(list) ? list : []) {
      let name = typeof raw === 'object' && raw ? (raw.name || raw.full_name || raw.displayName || '') : String(raw || '');
      name = name.replace(/<[^>]*>/g, '').trim();
      if (!name || name.includes('@') || NOT_A_PERSON.test(name) || name.length > 60) continue;
      const key = norm(name);
      if (key && !out.has(key)) out.set(key, name);
      if (out.size >= MAX_CANDIDATES) break;
    }
  }
  return [...out.values()];
}

/** The candidate a spoken name refers to: full name, or a unique first name. */
function matchCandidate(spoken, candidates) {
  const s = norm(spoken);
  if (!s) return null;
  const full = candidates.find((c) => norm(c) === s);
  if (full) return full;
  const byFirst = candidates.filter((c) => firstName(c) === s.split(' ')[0]);
  return byFirst.length === 1 ? byFirst[0] : null;
}

const INTRO = /\b(?:[Ii]['’]?m|[Ii] am|[Tt]his is|[Ii]t['’]?s|[Mm]y name(?: is|['’]s))\s+([A-Z][\p{L}'-]+(?:\s+[A-Z][\p{L}'-]+)?)/gu;

/**
 * Self-introductions: a speaker naming themselves.
 * @returns {Array<{speaker: string, name: string, confidence: number, evidence: string}>}
 */
function selfIntroductions(segments, candidates) {
  const out = [];
  for (const seg of segments) {
    if (!isGeneric(seg.speaker)) continue;
    const text = String(seg.text || '');
    for (const m of text.matchAll(INTRO)) {
      const spoken = m[1];
      if (NOT_NAMES.has(firstName(spoken))) continue;
      const cand = matchCandidate(spoken, candidates);
      // Without a candidate, only the unambiguous "my name is X" counts.
      const name = cand || (/^my name/i.test(m[0]) ? spoken : null);
      if (name) out.push({ speaker: seg.speaker, name, confidence: cand ? 0.95 : 0.85, evidence: text.slice(0, 200), source: 'intro' });
    }
  }
  return out;
}

/**
 * Being addressed by name right before speaking: "Thanks, Priya." then Speaker 2 talks.
 * Each such hand-over is one vote; two or more votes for the same speaker make it strong.
 */
function addressed(segments, candidates) {
  if (!candidates.length) return [];
  const firsts = new Map();
  for (const c of candidates) {
    const f = firstName(c);
    if (f) firsts.set(f, firsts.has(f) ? null : c); // ambiguous first names are dropped
  }
  const votes = new Map(); // speaker -> name -> { n, evidence }
  for (let i = 0; i < segments.length - 1; i++) {
    const cur = segments[i];
    const next = segments.slice(i + 1).find((s) => s.speaker !== cur.speaker);
    if (!next || !isGeneric(next.speaker)) continue;
    const text = String(cur.text || '');
    // "Priya, can you..." at the start, or "..., Priya?" / "thanks Priya." at the end.
    const ends = [text.match(/^\s*([A-Z][\p{L}'-]+)\s*,/u), text.match(/[,\s]([A-Z][\p{L}'-]+)\s*[?.!]?\s*$/u)];
    for (const m of ends) {
      if (!m) continue;
      const cand = firsts.get(norm(m[1]));
      if (!cand) continue;
      const byName = votes.get(next.speaker) || new Map();
      const v = byName.get(cand) || { n: 0, evidence: text.slice(0, 200) };
      v.n++;
      byName.set(cand, v);
      votes.set(next.speaker, byName);
    }
  }
  const out = [];
  for (const [speaker, byName] of votes) {
    const total = [...byName.values()].reduce((s, v) => s + v.n, 0);
    for (const [name, v] of byName) {
      const share = v.n / total;
      out.push({ speaker, name, confidence: Math.min(0.9, (0.45 + 0.15 * v.n) * share), evidence: v.evidence, source: 'addressed' });
    }
  }
  return out;
}

/**
 * Check an AI answer: known speakers only, a name we expect or one said aloud,
 * and an evidence quote that really is in the transcript.
 */
function validateAI(raw, segments, candidates) {
  const speakers = new Set(segments.map((s) => s.speaker).filter(isGeneric));
  const text = norm(segments.map((s) => s.text).join(' '));
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.speakers) ? raw.speakers : [];
  const out = [];
  for (const r of list) {
    if (!r || !speakers.has(r.speaker) || typeof r.name !== 'string') continue;
    const name = matchCandidate(r.name, candidates) || (text.includes(norm(r.name)) ? r.name.trim() : null);
    if (!name || NOT_A_PERSON.test(name) || /[:\r\n]/.test(name) || name.length > 60) continue;
    const evidence = typeof r.evidence === 'string' ? r.evidence.trim() : '';
    if (!evidence || !text.includes(norm(evidence))) continue;
    const c = Number(r.confidence);
    out.push({ speaker: r.speaker, name, confidence: Math.max(0, Math.min(0.9, Number.isFinite(c) ? c : 0)), evidence: evidence.slice(0, 200), source: 'ai' });
  }
  return out;
}

/**
 * Merge guesses into one name per speaker and one speaker per name.
 * Agreeing sources raise confidence a little.
 * @returns {{ apply: Record<string,string>, applied: object[], suggestions: Array<{speaker,name,confidence,evidence,source}> }}
 */
function resolveNames(guesses) {
  const best = new Map(); // "speaker\u0000name" -> guess
  for (const g of guesses) {
    const key = `${g.speaker}\u0000${norm(g.name)}`;
    const prev = best.get(key);
    if (!prev) best.set(key, { ...g });
    else best.set(key, { ...(g.confidence > prev.confidence ? g : prev), confidence: Math.min(0.97, Math.max(g.confidence, prev.confidence) + 0.05), source: `${prev.source}+${g.source}` });
  }
  const sorted = [...best.values()].sort((a, b) => b.confidence - a.confidence);
  const usedSpeakers = new Set();
  const usedNames = new Set();
  const apply = {};
  const applied = [];
  const suggestions = [];
  for (const g of sorted) {
    if (g.confidence < SUGGEST || usedSpeakers.has(g.speaker) || usedNames.has(norm(g.name))) continue;
    usedSpeakers.add(g.speaker);
    usedNames.add(norm(g.name));
    const rounded = { ...g, confidence: Math.round(g.confidence * 100) / 100 };
    if (g.confidence >= AUTO_APPLY) {
      apply[g.speaker] = g.name;
      applied.push(rounded);
    } else suggestions.push(rounded);
  }
  return { apply, applied, suggestions };
}

/** Rename speakers in segments. */
function applyNames(segments, mapping) {
  return segments.map((s) => (mapping[s.speaker] ? { ...s, speaker: mapping[s.speaker] } : s));
}

/** Replace names in an attendee list (strings or objects), keeping order and dropping duplicates. */
function renameAttendees(attendees, mapping) {
  if (!Array.isArray(attendees)) return attendees;
  const seen = new Set();
  const out = [];
  for (const a of attendees) {
    const next = typeof a === 'string' && mapping[a] ? mapping[a] : a;
    const key = norm(typeof next === 'object' && next ? (next.email || next.name) : next);
    if (key && seen.has(key)) continue;
    if (key) seen.add(key);
    out.push(next);
  }
  return out;
}

/** Lines worth showing the AI: each speaker's first lines and any line naming someone. */
function excerpt(segments, candidates) {
  const firsts = candidates.map(firstName).filter(Boolean);
  const perSpeaker = new Map();
  const keep = new Set();
  segments.forEach((s, i) => {
    const n = perSpeaker.get(s.speaker) || 0;
    if (n < 3) keep.add(i);
    perSpeaker.set(s.speaker, n + 1);
    const t = norm(s.text);
    if (/\b(i'?m|my name|this is|thanks|thank you)\b/.test(t) || firsts.some((f) => t.split(' ').includes(f))) {
      keep.add(i);
      if (i + 1 < segments.length) keep.add(i + 1);
    }
  });
  let out = '';
  for (const i of [...keep].sort((a, b) => a - b)) {
    const line = `${segments[i].speaker}: ${segments[i].text}\n`;
    if (out.length + line.length > MAX_EXCERPT_CHARS) break;
    out += line;
  }
  return out;
}

async function askAI(segments, candidates) {
  if (!ai.isConfigured() || typeof ai.chat !== 'function') return [];
  const speakers = [...new Set(segments.map((s) => s.speaker).filter(isGeneric))];
  if (!speakers.length) return [];
  const prompt = `Work out who each unnamed speaker in this meeting transcript is.

Unnamed speakers: ${speakers.join(', ')}
People expected in the meeting (may be incomplete): ${candidates.length ? candidates.join(', ') : 'unknown'}

Only name a speaker when the transcript shows it: they introduce themselves, someone addresses them by name just before they speak, or they are clearly referred to. Never guess from voice or topic alone. Each person can be only one speaker.

Return ONLY JSON:
{"speakers": [{"speaker": "Speaker 1", "name": "Full Name", "confidence": 0.0-1.0, "evidence": "exact words copied from the transcript that show it"}]}
Leave a speaker out when unsure.

TRANSCRIPT EXCERPT:
${excerpt(segments, candidates)}`;
  try {
    const text = await ai.chat(prompt, { temperature: 0 });
    const m = String(text || '').match(/\{[\s\S]*\}/);
    return m ? validateAI(JSON.parse(m[0]), segments, candidates) : [];
  } catch (err) {
    log.warn('[SpeakerNames] AI step failed', { error: err.message });
    return [];
  }
}

/**
 * Guess names for a transcript's generic speakers.
 * @param {Array<{speaker: string, text: string}>} segments
 * @param {string[]} candidates
 * @param {{ useAI?: boolean }} [opts]
 */
async function suggestNames(segments, candidates, { useAI = true } = {}) {
  const list = Array.isArray(segments) ? segments.filter((s) => s && typeof s.speaker === 'string') : [];
  if (!list.some((s) => isGeneric(s.speaker))) return { apply: {}, applied: [], suggestions: [] };
  const guesses = [...selfIntroductions(list, candidates), ...addressed(list, candidates)];
  if (useAI) guesses.push(...(await askAI(list, candidates)));
  return resolveNames(guesses);
}

/**
 * People we expect: the meeting's attendees, who recorded it, and org members.
 * @param {{ org_id?: string, created_by?: string, attendees?: unknown[] }} meeting
 */
async function loadCandidates(meeting) {
  const lists = [meeting.attendees];
  if (supabase && meeting.org_id) {
    try {
      const { data: members } = await supabase.from('org_members').select('user_id').eq('org_id', meeting.org_id).limit(MAX_CANDIDATES);
      const ids = [...new Set([meeting.created_by, ...(members || []).map((m) => m.user_id)].filter((id) => typeof id === 'string' && /^[0-9a-f-]{36}$/i.test(id)))];
      if (ids.length) {
        const { data: users } = await supabase.from('users').select('id, full_name').in('id', ids);
        const byId = new Map((users || []).map((u) => [u.id, u.full_name]));
        // The person who recorded goes first: they were almost certainly there.
        lists.push([byId.get(meeting.created_by), ...ids.map((id) => byId.get(id))].filter(Boolean));
      }
    } catch (err) {
      log.warn('[SpeakerNames] could not load org members', { error: err.message });
    }
  }
  return candidateNames(...lists);
}

module.exports = {
  AUTO_APPLY,
  suggestNames,
  loadCandidates,
  applyNames,
  renameAttendees,
  isGeneric,
  _internal: { candidateNames, matchCandidate, selfIntroductions, addressed, validateAI, resolveNames, excerpt },
};
