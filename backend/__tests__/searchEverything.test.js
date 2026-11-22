const { terms, hitRanges, snippet, findSegmentHit, matchMeeting, orFilter, agentCall } = require('../services/searchEverything');
const { cleanInput, SearchNotesError } = require('../services/searchNotesService');

describe('searchEverything helpers', () => {
  test('terms drops stop words and punctuation, keeps order, dedupes', () => {
    expect(terms('What did we decide about pricing? Pricing!')).toEqual(['decide', 'pricing']);
    expect(terms('  ')).toEqual([]);
    // Only stop words: fall back to the whole query.
    expect(terms('who')).toEqual(['who']);
  });

  test('hitRanges merges overlapping hits', () => {
    expect(hitRanges('Pricing pricing', ['pricing'])).toEqual([[0, 7], [8, 15]]);
    expect(hitRanges('abcdef', ['abc', 'bcd'])).toEqual([[0, 4]]);
  });

  test('snippet centres on the first hit and offsets ranges', () => {
    const long = 'x '.repeat(100) + 'the pricing floor stays at forty' + ' y'.repeat(100);
    const s = snippet(long, ['pricing'], 20);
    expect(s.text.startsWith('…')).toBe(true);
    expect(s.text.endsWith('…')).toBe(true);
    const [a, b] = s.hits[0];
    expect(s.text.slice(a, b)).toBe('pricing');
  });

  test('snippet without a hit returns the start of the text', () => {
    expect(snippet('short text', ['zzz'])).toEqual({ text: 'short text', hits: [] });
  });

  test('findSegmentHit returns the best segment with context', () => {
    const segs = [
      { atMs: 1000, speaker: 'A', text: 'hello' },
      { atMs: 2000, speaker: 'B', text: 'about pricing' },
      { atMs: 3000, speaker: 'A', text: 'pricing floor at forty' },
      { atMs: 4000, speaker: 'B', text: 'ok' },
    ];
    const hit = findSegmentHit(segs, ['pricing', 'floor']);
    expect(hit.atMs).toBe(3000);
    expect(hit.context.map((c) => c.atMs)).toEqual([1000, 2000, 3000, 4000]);
    expect(hit.context.find((c) => c.hit).atMs).toBe(3000);
    expect(findSegmentHit(null, ['x'])).toBeNull();
  });

  test('matchMeeting returns the meeting with a timecode and decisions as their own results', () => {
    const m = {
      id: 'm1', title: 'Acme call', summary: 'Talked terms', created_at: '2026-11-12T10:00:00Z',
      transcript_segments: [{ atMs: 895000, speaker: 'Ana', text: 'the pricing floor stays at $40' }],
      decisions: ['Pilot pricing floor stays at $40/seat', 'Hire a designer'],
      summary_moments: { decisions: [895000, 120000] },
    };
    const r = matchMeeting(m, ['pricing']);
    expect(r.meeting.meta.atMs).toBe(895000);
    expect(r.meeting.snippet).toContain('pricing');
    expect(r.decisions).toHaveLength(1);
    expect(r.decisions[0]).toMatchObject({ type: 'decision', id: 'm1:0', meta: { atMs: 895000, meetingId: 'm1' } });
    expect(matchMeeting(m, ['nothinghere'])).toEqual({ meeting: null, decisions: [] });
  });

  test('orFilter strips characters that break the PostgREST grammar', () => {
    expect(orFilter(['title'], ['a,b', 'c(d)'])).toBe('title.ilike.%ab%,title.ilike.%cd%');
  });

  test('agentCall only reports applied calls, as a percentage', () => {
    expect(agentCall({ priority: { applied: false, confidence: 0.3 } })).toBeNull();
    expect(agentCall({ reviewed_at: 'x', owner: { applied: true, confidence: 0.92 } })).toEqual({ field: 'owner', confidence: 92 });
    expect(agentCall(null)).toBeNull();
  });
});

describe('searchNotes cleanInput', () => {
  test('requires text and normalises unknown values', () => {
    expect(() => cleanInput({ body: '  ' })).toThrow(SearchNotesError);
    const c = cleanInput({ body: ' hi ', kind: 'weird', origin: 'nope', atMs: '1200' });
    expect(c).toMatchObject({ body: 'hi', kind: 'note', origin: 'other', at_ms: 1200 });
    expect(cleanInput({ body: 'x', atMs: -5 }).at_ms).toBeNull();
    expect(cleanInput({ body: 'x', atMs: null }).at_ms).toBeNull();
  });
});
