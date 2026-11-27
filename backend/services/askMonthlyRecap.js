const { supabase } = require('../config/supabase');

const MONTHLY_QUESTION = /^what(?: has|['’]s)? changed(?: (?:in|across) (?:our )?meetings)? (?:so far )?this month$/i;
const CURRENT_MONTH = 'this month(?: to date| so far)?';
const PREVIOUS_MONTH = '(?:all of )?(?:last|the previous) month';
const CONNECTOR = '(?:with|to|against|and|vs\\.?|versus)';
const COMPARISON_QUESTIONS = [
  new RegExp(`^(?:please )?compare (?:${CURRENT_MONTH} ${CONNECTOR} ${PREVIOUS_MONTH}|${PREVIOUS_MONTH} ${CONNECTOR} ${CURRENT_MONTH})$`, 'i'),
  new RegExp(`^how (?:does|did) ${CURRENT_MONTH} compare ${CONNECTOR} ${PREVIOUS_MONTH}$`, 'i'),
  new RegExp(`^what(?: has|['’]s)? changed (?:from ${PREVIOUS_MONTH} to ${CURRENT_MONTH}|between (?:${PREVIOUS_MONTH} and ${CURRENT_MONTH}|${CURRENT_MONTH} and ${PREVIOUS_MONTH}))$`, 'i'),
  new RegExp(`^what(?: has|['’]s)? changed ${CURRENT_MONTH} compared (?:with|to) ${PREVIOUS_MONTH}$`, 'i'),
  new RegExp(`^${CURRENT_MONTH} (?:vs\\.?|versus) ${PREVIOUS_MONTH}$`, 'i'),
];

function monthlyRecapMode(question) {
  if (typeof question !== 'string') return null;
  const normalized = question.trim().replace(/\s+/g, ' ').replace(/[?!.]+$/, '').trimEnd();
  if (COMPARISON_QUESTIONS.some((pattern) => pattern.test(normalized))) return 'comparison';
  return MONTHLY_QUESTION.test(normalized) ? 'monthly' : null;
}

function validCalendarDate(value) {
  if (typeof value !== 'string' || !/^(?!0000)\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function validComparisonRanges(ranges) {
  const previous = ranges?.previous;
  const current = ranges?.current;
  return [previous?.startDate, previous?.endDate, current?.startDate, current?.endDate].every(validCalendarDate)
    && previous.startDate <= previous.endDate && previous.endDate < current.startDate && current.startDate <= current.endDate;
}

async function loadMonthlyRecap({ orgId, timeZone, meetingIds, mode, comparisonRanges }) {
  const comparing = mode === 'comparison';
  const rpc = comparisonRanges ? 'get_ask_date_comparison' : comparing ? 'get_ask_monthly_comparison' : 'get_ask_monthly_recap';
  const { data, error } = await supabase.rpc(rpc, {
    p_org_id: orgId,
    p_time_zone: timeZone,
    p_meeting_ids: meetingIds?.length ? meetingIds : null,
    ...(comparisonRanges ? {
      p_previous_start: comparisonRanges.previous.startDate,
      p_previous_end: comparisonRanges.previous.endDate,
      p_current_start: comparisonRanges.current.startDate,
      p_current_end: comparisonRanges.current.endDate,
    } : {}),
  });
  if (!error && comparing && data?.comparison?.previous && data.comparison.current
    && Array.isArray(data.previousPassages) && Array.isArray(data.currentPassages)) {
    return {
      coverage: { comparison: data.comparison },
      passages: [
        ...data.previousPassages.map((passage) => ({ ...passage, period: 'previous' })),
        ...data.currentPassages.map((passage) => ({ ...passage, period: 'current' })),
      ],
    };
  }
  if (!error && !comparing && data?.recap && Array.isArray(data.passages)) {
    return { coverage: { recap: data.recap }, passages: data.passages };
  }
  throw new Error('Could not retrieve Ask evidence for the requested dates', { cause: error });
}

const CLAIM_FORMAT = 'Return JSON only in this form: {"claims":[{"topic":"Launch","text":"One plain-text claim.","kind":"comparison","evidence":[{"id":"p1","quote":"Verbatim excerpt.","role":"before"},{"id":"p2","quote":"Verbatim excerpt.","role":"after"}]}]}';

const MONTHLY_INSTRUCTIONS = [
  'Summarize significant decisions and changes recorded in these meetings this month. Group related changes under the same short topic. Include schedule, ownership, approvals and blockers when supported.',
  CLAIM_FORMAT,
  'Use kind "comparison" only for a supported change across two meetings. Give exactly one "before" and one "after" citation with the later meeting supporting the new state. A later comment alone does not establish that an earlier decision was overturned.',
  'Use kind "recorded" and role "source" for an explicit change stated in a meeting, a recorded decision with no earlier state, or an unresolved conflict. Only describe what the quotes demonstrate.',
];

const COMPARISON_INSTRUCTIONS = [
  'Compare confirmed decisions and commitments about the same subject in the two labeled periods. Group related claims under short topics. Use the dates and change evidence, never raw activity counts, to describe changes.',
  CLAIM_FORMAT,
  'For kind "comparison", cite one "before" passage in the previous period and one "after" passage in the current period that demonstrate the changed state. Repeated commitments are not changes. A later comment alone does not establish that the earlier decision was overturned.',
  'For kind "conflict", use the same two citations and describe the unresolved disagreement without implying either decision prevailed.',
  'For kind "recorded", use role "source" and explicitly name the period whose evidence supports the statement. If evidence exists on only one side, report what was recorded and do not infer a change or absence in the other period.',
];

module.exports = { monthlyRecapMode, validComparisonRanges, loadMonthlyRecap, MONTHLY_INSTRUCTIONS, COMPARISON_INSTRUCTIONS };
