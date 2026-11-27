const { supabase } = require('../config/supabase');

const MONTHLY_QUESTION = /^what(?:\s+has|['’]s)?\s+changed(?:\s+(?:in|across)\s+(?:our\s+)?meetings)?\s+(?:so\s+far\s+)?this\s+month[?!.]*$/i;

function isMonthlyRecap(question) {
  return typeof question === 'string' && MONTHLY_QUESTION.test(question.trim());
}

async function loadMonthlyRecap({ orgId, timeZone, meetingIds }) {
  const { data, error } = await supabase.rpc('get_ask_monthly_recap', {
    p_org_id: orgId,
    p_time_zone: timeZone,
    p_meeting_ids: meetingIds?.length ? meetingIds : null,
  });
  if (error || !data?.recap || !Array.isArray(data.passages)) {
    throw new Error('Could not retrieve the monthly recap evidence', { cause: error });
  }
  return data;
}

const MONTHLY_INSTRUCTIONS = [
  'Summarize significant decisions and changes recorded in these meetings this month. Group related changes under the same short topic. Include schedule, ownership, approvals and blockers when supported.',
  'Return JSON only in this form: {"claims":[{"topic":"Launch","text":"One plain-text claim.","kind":"comparison","evidence":[{"id":"p1","quote":"Verbatim excerpt.","role":"before"},{"id":"p2","quote":"Verbatim excerpt.","role":"after"}]}]}',
  'Use kind "comparison" only for a supported change across two meetings. Give exactly one "before" and one "after" citation with the later meeting supporting the new state. A later comment alone does not establish that an earlier decision was overturned.',
  'Use kind "recorded" and role "source" for an explicit change stated in a meeting, a recorded decision with no earlier state, or an unresolved conflict. Only describe what the quotes demonstrate.',
];

module.exports = { isMonthlyRecap, loadMonthlyRecap, MONTHLY_INSTRUCTIONS };
