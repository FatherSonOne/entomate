/**
 * Writing the minutes: the one finishing step for every way a meeting is captured.
 *
 * Entomate hears a meeting two ways, with two transcription engines:
 *   - the Recall bot, transcribed by Deepgram (services/transcriptIngest.js), and
 *   - the browser recorder, transcribed by Gemini (services/meetingRecorder.js).
 * Each turns its audio into timed lines, [{ atMs, endMs?, speaker, text }]. From there
 * the work is the same, and it lives here so the two cannot drift apart again:
 *
 *   speakers  real names for "Speaker N" labels (services/speakerNames.js); names the
 *             call platform already gave are kept as they are
 *   summary   the AI pipeline with the meeting's summary template, decisions, action items,
 *             embedding; a failure keeps the transcript and records why (`summaryError`)
 *   moments   each summary point and action item linked to the line it came from
 *   publish   action items saved once per meeting, followed by
 *             the usual post-processing (search, ecosystem sync, agents, workflows)
 *
 * `onStage` is called as each stage starts (transcript is the caller's own), so the
 * meeting page's writing loader shows real progress for both engines.
 */

'use strict';

const ai = require('../config/ai');
const log = require('../utils/log');
const summaryTemplates = require('./summaryTemplates');
const { seedBotProfile } = require('./meetingIntelligenceProfile');
const speakerNames = require('./speakerNames');
const transcriptMoments = require('./transcriptMoments');

const EMPTY_SUMMARY = { summary: null, keyPoints: [], decisions: [], topics: [], sentiment: null, sentimentScore: null };

/** The meetings route owns the AI pipeline; required lazily so load order never matters. */
function pipeline() {
  return require('../routes/meetings')._pipeline;
}

function buildTranscriptText(segments) {
  return segments.map((s) => `${s.speaker}: ${s.text}`).join('\n');
}

/**
 * Speakers, summary and timecodes for a transcript.
 *
 * @param {object} opts
 * @param {object} opts.meeting  { id, org_id, created_by, attendees, summary_template }; used for
 *   speaker candidates and the template. Fields may be missing for a meeting not saved yet.
 * @param {Array} opts.segments  timed lines; may be empty when only flat text exists
 * @param {string} [opts.transcript]  flat text, when there are no timed lines
 * @param {string} opts.title
 * @param {Array} [opts.attendees]  people for the summary prompt and template guess
 * @param {object} [opts.botSession]  resolved session for a bot transcript
 * @param {(stage: string) => Promise<void>} [opts.onStage]
 * @returns {Promise<{ segments: Array, transcript: string, summaryData: object, actionItems: Array,
 *   speakerSuggestions: Array, summaryError: string|null, fields: object }>}
 *   `fields` are the meetings columns the minutes fill.
 */
async function writeMinutes({ meeting, segments, transcript, title, attendees, botSession, onStage = async () => {} }) {
  let lines = Array.isArray(segments) ? segments : [];
  let text = lines.length ? buildTranscriptText(lines) : String(transcript || '').trim();

  // Real names for "Speaker N" before the summary, so owners and carry-forward use them.
  // Strong evidence renames; weaker guesses wait on the meeting page as suggestions.
  let speakerSuggestions = [];
  if (lines.some((s) => speakerNames.isGeneric(s.speaker))) {
    await onStage('speakers');
    try {
      const candidates = await speakerNames.loadCandidates({ ...meeting, attendees: meeting?.attendees ?? attendees });
      const { apply, suggestions } = await speakerNames.suggestNames(lines, candidates);
      if (Object.keys(apply).length) {
        lines = speakerNames.applyNames(lines, apply);
        text = buildTranscriptText(lines);
      }
      speakerSuggestions = suggestions;
    } catch (err) {
      log.warn('Minutes: speaker naming failed, keeping Speaker labels', { meetingId: meeting?.id, error: err.message });
    }
  }

  let summaryData = EMPTY_SUMMARY;
  let actionItems = [];
  let embedding = null;
  // Saved on the job so a missing summary can be diagnosed from the database.
  let summaryError = null;
  await onStage('summary');
  try {
    await seedBotProfile(meeting, botSession);
    if (!ai.isConfigured()) {
      summaryError = 'AI provider not configured';
    } else {
      ({ summaryData, actionItems, embedding } = await pipeline().runAIPipeline(text, title, {
        attendees,
        template: meeting?.summary_template,
        meetingId: meeting?.id,
      }));
    }
  } catch (err) {
    // The transcript is the valuable part; the summary can be rebuilt with Reprocess.
    summaryError = String(err?.message || err).slice(0, 500);
    log.warn('Minutes: AI pipeline failed, saving transcript only', { meetingId: meeting?.id, error: err.message });
  }

  actionItems = transcriptMoments.withActionItemMoments(lines, actionItems);
  const keyPoints = summaryData.keyPoints || [];
  const decisions = summaryData.decisions || [];
  const fields = {
    transcript: text,
    transcript_segments: lines.length ? lines : null,
    summary: summaryData.summary || null,
    key_points: keyPoints,
    decisions,
    summary_moments: lines.length ? transcriptMoments.summaryMoments(lines, keyPoints, decisions) : null,
    topics: summaryData.topics || [],
    ...summaryTemplates.summaryFields(summaryData),
    sentiment_label: summaryData.sentiment || null,
    sentiment_score: summaryData.sentimentScore ?? null,
  };
  if (embedding) fields.transcript_embedding = embedding;

  return { segments: lines, transcript: text, summaryData, actionItems, speakerSuggestions, summaryError, fields };
}

/**
 * Save commitments before marking the minutes complete. On failure the callers
 * still save the transcript, and the meeting page can retry from that transcript.
 */
async function saveMinutesActions(meeting, minutes) {
  if (minutes.summaryError) return null;
  try {
    return await pipeline().saveActionItems(meeting, minutes.actionItems);
  } catch (err) {
    log.error('Minutes: could not save action items', { meetingId: meeting.id, error: err.message });
    minutes.summaryError = 'Could not save the meeting action items';
    minutes.fields.summary = null;
    return null;
  }
}

function publishMinutes(saved, minutes, savedActions, { userId = null } = {}) {
  if (savedActions === null) return;
  pipeline().firePostProcessing(saved, minutes.summaryData, savedActions.items, { userId, actionsCreated: savedActions.created });
}

module.exports = { writeMinutes, saveMinutesActions, publishMinutes, buildTranscriptText, EMPTY_SUMMARY };
