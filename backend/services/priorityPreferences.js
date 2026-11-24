const { correctionScope, preferenceStore } = require('./meetingAgentPreferences');

const VALUES = ['high', 'medium', 'low'];
const labels = new Map([['high', 'High'], ['medium', 'Medium'], ['low', 'Low']]);
const store = preferenceStore({
  table: 'priority_preferences',
  correctionColumn: 'priority_correction',
  correctionValue: 'to',
  storedValue: 'priority',
  getLabels: () => labels
});

async function correctionForEdit(db, item, changes, correctedAt) {
  const note = item.agent_notes?.priority;
  const from = item.priority;
  const to = changes.priority;
  if (!note?.applied || note.recommended !== from || !VALUES.includes(from) || !VALUES.includes(to) || from === to) return null;
  const scope = await correctionScope(db, item, changes);
  return scope ? { ...scope, from, to, correctedAt } : null;
}

module.exports = { ...store, VALUES, correctionForEdit };
