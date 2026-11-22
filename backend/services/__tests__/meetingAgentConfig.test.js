jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));

const { normalize, clampConfidence, save } = require('../meetingAgentConfig');

describe('meetingAgentConfig.normalize', () => {
  it('returns defaults for nothing stored', () => {
    expect(normalize()).toEqual({
      assignment: { enabled: true, minConfidence: 0.7 },
      priority: { enabled: true, minConfidence: 0.75 },
      deadline: { enabled: true }
    });
  });

  it('keeps valid values and drops unknown keys', () => {
    expect(normalize({ priority: { enabled: false, minConfidence: 0.8 }, deadline: { enabled: false, minConfidence: 0.9 }, rogue: {} }))
      .toEqual({
        assignment: { enabled: true, minConfidence: 0.7 },
        priority: { enabled: false, minConfidence: 0.8 },
        deadline: { enabled: false }
      });
  });

  it('ignores non-boolean switches', () => {
    expect(normalize({ assignment: { enabled: 'no' } }).assignment.enabled).toBe(true);
  });
});

describe('clampConfidence', () => {
  it('accepts percentages and clamps to 50–95%', () => {
    expect(clampConfidence(80, 0.7)).toBe(0.8);
    expect(clampConfidence(0.2, 0.7)).toBe(0.5);
    expect(clampConfidence(1, 0.7)).toBe(0.95);
    expect(clampConfidence('x', 0.7)).toBe(0.7);
  });
});

describe('meetingAgentConfig.save', () => {
  it('merges into tenant_organizations.settings without dropping other keys', async () => {
    let written = null;
    const client = {
      from: () => ({
        select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { settings: { bot_announcement_message: 'hi' } }, error: null }) }) }),
        update: (values) => { written = values; return { eq: async () => ({ error: null }) }; }
      })
    };
    const out = await save('org-a', { priority: { enabled: false } }, client);
    expect(out.priority.enabled).toBe(false);
    expect(written.settings.bot_announcement_message).toBe('hi');
    expect(written.settings.meeting_agents.priority).toEqual({ enabled: false, minConfidence: 0.75 });
  });
});
