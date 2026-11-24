const { getOrgTeam } = require('./agents/orgTeam');
const { correctionScope, normalize, preferenceStore } = require('./meetingAgentPreferences');

const store = preferenceStore({
  table: 'owner_preferences',
  correctionColumn: 'owner_correction',
  correctionValue: 'memberId',
  storedValue: 'member_id',
  getLabels: async (orgId, db) => new Map((await getOrgTeam(orgId, db)).map(member => [member.user_id, member.name]))
});

async function correctionForEdit(db, item, changes, correctedAt) {
  const note = item.agent_notes?.assignment;
  const from = normalize(note?.recommended);
  const to = normalize(changes.assigned_to_name);
  if (!note?.applied || !from || from !== normalize(item.assigned_to_name) || !to || from === to) return null;

  const [scope, team] = await Promise.all([
    correctionScope(db, item, changes), getOrgTeam(item.org_id, db)
  ]);
  const email = normalize(changes.assigned_to_email);
  const candidates = team.filter(member => member.user_id && normalize(member.name) === to && (!email || normalize(member.email) === email));
  if (!scope || candidates.length !== 1) return null;

  return { ...scope, memberId: candidates[0].user_id, from: note.recommended, to: candidates[0].name, correctedAt };
}

async function list(db, orgId, key) {
  const { suggested, active, previous } = await store.list(db, orgId, key);
  const asOwner = ({ value, label, ...preference }) => ({ ...preference, memberId: value, memberName: label });
  return { suggested: suggested.map(asOwner), active: active.map(asOwner), previous };
}

function decide(db, orgId, userId, { memberId, ...decision }) {
  return store.decide(db, orgId, userId, { ...decision, value: memberId });
}

async function approvedMember(db, orgId, meetingTitle, itemTitle, team) {
  if (!team.length) return null;
  const memberId = await store.approved(db, orgId, meetingTitle, itemTitle);
  return memberId ? team.find(member => member.user_id === memberId) || null : null;
}

module.exports = { correctionForEdit, list, decide, approvedMember };
