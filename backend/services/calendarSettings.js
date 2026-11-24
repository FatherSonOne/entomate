const { supabase } = require('../config/supabase');

async function readCalendarSettings(userId, client = supabase) {
  const { data, error } = await client.from('user_settings')
    .select('user_id, calendar_json, updated_at').eq('user_id', userId).maybeSingle();
  if (error) throw error;
  return data;
}

// Calendar consent, OAuth refreshes and scheduler health share one JSON column.
async function updateCalendarSettings(userId, change, { client = supabase, create = false } = {}) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const row = await readCalendarSettings(userId, client);
    const calendarJson = await change(row?.calendar_json || {});
    if (!calendarJson || (!row && !create)) return null;
    if (!row) {
      const { data, error } = await client.from('user_settings')
        .insert({ user_id: userId, calendar_json: calendarJson }).select('user_id').maybeSingle();
      if (error?.code === '23505') continue;
      if (error) throw error;
      if (data) return calendarJson;
      break;
    }
    // Use the row timestamp as the compare-and-swap token, keeping credentials out of query URLs.
    const previous = Date.parse(row.updated_at.endsWith('Z') ? row.updated_at : row.updated_at + 'Z');
    const updatedAt = new Date(Math.max(Date.now(), (previous || 0) + 1)).toISOString();
    const { data, error } = await client.from('user_settings')
      .update({ calendar_json: calendarJson, updated_at: updatedAt })
      .eq('user_id', userId).eq('updated_at', row.updated_at).select('user_id').maybeSingle();
    if (error) throw error;
    if (data) return calendarJson;
  }
  throw new Error('Calendar settings changed while saving. Try again.');
}

module.exports = { readCalendarSettings, updateCalendarSettings };
