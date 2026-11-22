jest.mock('../../config/supabase', () => ({ supabase: null }));
const mockChat = jest.fn();
jest.mock('../../config/ai', () => ({ isConfigured: () => true, chat: (...a) => mockChat(...a) }));

const sn = require('../speakerNames');
const { candidateNames, matchCandidate, selfIntroductions, addressed, validateAI, resolveNames } = sn._internal;

const seg = (speaker, text) => ({ speaker, text });
const CANDS = ['Priya Shah', 'Frankie Messana', 'Jon Bell'];

describe('candidateNames', () => {
  it('keeps real names once and drops emails and speaker labels', () => {
    expect(candidateNames(['Priya Shah', 'Speaker 1', 'jon@x.io', { name: 'Jon Bell' }], ['priya shah', 'Ana'])).toEqual(['Priya Shah', 'Jon Bell', 'Ana']);
  });
});

describe('matchCandidate', () => {
  it('matches full names and unique first names only', () => {
    expect(matchCandidate('Priya', CANDS)).toBe('Priya Shah');
    expect(matchCandidate('jon bell', CANDS)).toBe('Jon Bell');
    expect(matchCandidate('Jon', [...CANDS, 'Jon Ortiz'])).toBeNull();
  });
});

describe('selfIntroductions', () => {
  it('finds "I\'m <name>" for expected people and "my name is" for anyone', () => {
    const out = selfIntroductions([
      seg('Speaker 1', "Hi all, I'm Priya, I run ingestion."),
      seg('Speaker 2', 'My name is Dana Cole from Acme.'),
      seg('Speaker 3', "I'm Sure we can do it. This is Monday's plan."),
    ], CANDS)
    expect(out.map((o) => [o.speaker, o.name, o.confidence])).toEqual([
      ['Speaker 1', 'Priya Shah', 0.95],
      ['Speaker 2', 'Dana Cole', 0.85],
    ]);
  });

  it('ignores speakers that already have a name', () => {
    expect(selfIntroductions([seg('Frankie', "I'm Priya")], CANDS)).toEqual([]);
  });
});

describe('addressed', () => {
  it('votes for the next speaker when someone hands over by name', () => {
    const out = addressed([
      seg('Speaker 1', 'Priya, can you take the launch date?'),
      seg('Speaker 2', 'Yes, Friday works.'),
      seg('Speaker 1', 'Great, thanks Priya.'),
      seg('Speaker 2', 'Sure.'),
    ], CANDS);
    const p = out.find((o) => o.speaker === 'Speaker 2');
    expect(p.name).toBe('Priya Shah');
    expect(p.confidence).toBeGreaterThanOrEqual(0.75);
  });
});

describe('validateAI', () => {
  const segs = [seg('Speaker 1', 'Thanks Jon, over to you'), seg('Speaker 2', 'Thanks, so the budget is fine')];
  it('keeps answers with real evidence and a known or spoken name', () => {
    const out = validateAI({ speakers: [
      { speaker: 'Speaker 2', name: 'Jon', confidence: 0.99, evidence: 'Thanks Jon, over to you' },
      { speaker: 'Speaker 1', name: 'Zed', confidence: 0.9, evidence: 'Thanks Jon' },
      { speaker: 'Speaker 9', name: 'Jon', confidence: 0.9, evidence: 'Thanks Jon' },
      { speaker: 'Speaker 1', name: 'Priya Shah', confidence: 0.9, evidence: 'made up quote' },
    ] }, segs, CANDS);
    expect(out).toEqual([expect.objectContaining({ speaker: 'Speaker 2', name: 'Jon Bell', confidence: 0.9 })]);
  });
});

describe('resolveNames', () => {
  it('uses each name and speaker once, applies strong guesses and suggests weaker ones', () => {
    const r = resolveNames([
      { speaker: 'Speaker 1', name: 'Priya Shah', confidence: 0.95, source: 'intro' },
      { speaker: 'Speaker 2', name: 'Priya Shah', confidence: 0.8, source: 'ai' },
      { speaker: 'Speaker 2', name: 'Jon Bell', confidence: 0.6, source: 'ai' },
      { speaker: 'Speaker 3', name: 'Ana', confidence: 0.3, source: 'ai' },
    ]);
    expect(r.apply).toEqual({ 'Speaker 1': 'Priya Shah' });
    expect(r.suggestions).toEqual([expect.objectContaining({ speaker: 'Speaker 2', name: 'Jon Bell', confidence: 0.6 })]);
  });

  it('raises confidence when two sources agree', () => {
    const r = resolveNames([
      { speaker: 'Speaker 2', name: 'Jon Bell', confidence: 0.8, source: 'addressed' },
      { speaker: 'Speaker 2', name: 'Jon Bell', confidence: 0.8, source: 'ai' },
    ]);
    expect(r.apply).toEqual({ 'Speaker 2': 'Jon Bell' });
  });
});

describe('applyNames and renameAttendees', () => {
  it('renames lines and attendees, dropping duplicates', () => {
    expect(sn.applyNames([seg('Speaker 1', 'hi'), seg('Ana', 'yo')], { 'Speaker 1': 'Priya Shah' })).toEqual([seg('Priya Shah', 'hi'), seg('Ana', 'yo')]);
    expect(sn.renameAttendees(['Speaker 1', 'Priya Shah', 'Ana'], { 'Speaker 1': 'Priya Shah' })).toEqual(['Priya Shah', 'Ana']);
  });
});

describe('suggestNames', () => {
  beforeEach(() => mockChat.mockReset());

  it('skips work when every speaker already has a name', async () => {
    expect(await sn.suggestNames([seg('Priya', 'hi')], CANDS)).toEqual({ apply: {}, applied: [], suggestions: [] });
    expect(mockChat).not.toHaveBeenCalled();
  });

  it('combines rules and a validated AI answer', async () => {
    mockChat.mockResolvedValue('{"speakers":[{"speaker":"Speaker 2","name":"Jon Bell","confidence":0.7,"evidence":"over to you, Jon"}]}');
    const r = await sn.suggestNames([
      seg('Speaker 1', "I'm Frankie. Okay, over to you, Jon."),
      seg('Speaker 2', 'Thanks. Budget is fine.'),
    ], CANDS);
    expect(r.apply['Speaker 1']).toBe('Frankie Messana');
    // addressed vote + AI agree on Jon
    expect(r.apply['Speaker 2'] || r.suggestions[0]?.name).toBe('Jon Bell');
  });

  it('survives an AI failure', async () => {
    mockChat.mockRejectedValue(new Error('down'));
    const r = await sn.suggestNames([seg('Speaker 1', "I'm Priya.")], CANDS);
    expect(r.apply).toEqual({ 'Speaker 1': 'Priya Shah' });
  });
});
