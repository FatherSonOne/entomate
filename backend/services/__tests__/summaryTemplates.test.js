const t = require('../summaryTemplates');

describe('detectTemplate', () => {
  it('matches titles by meeting type', () => {
    expect(t.detectTemplate({ title: 'Daily standup' })).toBe('standup');
    expect(t.detectTemplate({ title: 'Frankie / Priya 1:1' })).toBe('one_on_one');
    expect(t.detectTemplate({ title: 'Acme discovery call' })).toBe('sales');
    expect(t.detectTemplate({ title: 'Northwind QBR' })).toBe('client');
    expect(t.detectTemplate({ title: 'Interview: backend candidate' })).toBe('interview');
    expect(t.detectTemplate({ title: 'Q1 roadmap planning' })).toBe('planning');
    expect(t.detectTemplate({ title: 'Recording' })).toBe('general');
  });

  it('treats two real attendees as a 1:1, ignoring speaker labels', () => {
    expect(t.detectTemplate({ title: 'Catch up', attendees: ['Ana', { email: 'jon@x.io' }] })).toBe('one_on_one');
    expect(t.detectTemplate({ title: 'Catch up', attendees: ['Speaker 1', 'Speaker 2'] })).toBe('general');
  });

  it('honours a valid chosen template and ignores an unknown one', () => {
    expect(t.detectTemplate({ title: 'Daily standup', chosen: 'interview' })).toBe('interview');
    expect(t.detectTemplate({ title: 'Daily standup', chosen: 'nope' })).toBe('standup');
  });
});

describe('promptAddon', () => {
  it('is empty for General so the default prompt is unchanged', () => {
    expect(t.promptAddon('general')).toBe('');
    expect(t.promptAddon('unknown')).toBe('');
  });

  it('names the sections for a typed meeting', () => {
    const p = t.promptAddon('one_on_one');
    expect(p).toContain('MEETING TYPE: 1:1');
    expect(p).toContain('"Wins"');
    expect(p).toContain('never invent');
  });
});

describe('normalizeSections', () => {
  it('keeps the template order, matches titles loosely, trims and caps items', () => {
    const out = t.normalizeSections([
      { title: 'blockers', items: ['  CI is slow  ', '', 42] },
      { title: 'Done since last time', items: Array.from({ length: 12 }, (_, i) => `item ${i}`) },
      { title: 'Made up', items: ['x'] },
    ], 'standup');
    expect(out.map((s) => s.title)).toEqual(['Done since last time', 'Next up', 'Blockers']);
    expect(out[0].items).toHaveLength(8);
    expect(out[1].items).toEqual([]);
    expect(out[2].items).toEqual(['CI is slow']);
  });

  it('returns no sections for General', () => {
    expect(t.normalizeSections([{ title: 'Wins', items: ['a'] }], 'general')).toEqual([]);
  });
});

describe('summaryFields', () => {
  it('defaults safely when the AI step failed', () => {
    expect(t.summaryFields({})).toEqual({ summary_template: 'general', summary_sections: [] });
  });
});
