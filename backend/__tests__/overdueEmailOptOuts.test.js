jest.mock('node-cron', () => ({ schedule: jest.fn(() => ({ stop: jest.fn() })) }));
jest.mock('../config/supabase', () => ({ supabase: null }));

const { overdueEmailOptOuts } = require('../services/schedulerService');

describe('overdueEmailOptOuts', () => {
  it('collects only users who switched the email off', () => {
    const out = overdueEmailOptOuts([
      { user_id: 'a', notifications_json: { email_overdue_reminder: false } },
      { user_id: 'b', notifications_json: { email_overdue_reminder: true } },
      { user_id: 'c', notifications_json: {} },
      { user_id: 'd', notifications_json: null },
    ]);
    expect([...out]).toEqual(['a']);
  });

  it('treats missing rows as on', () => {
    expect(overdueEmailOptOuts(null).size).toBe(0);
    expect(overdueEmailOptOuts(undefined).size).toBe(0);
  });
});
