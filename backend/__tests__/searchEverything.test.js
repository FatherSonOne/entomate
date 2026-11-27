const { search, terms, hitRanges, snippet, findSegmentHit, matchMeeting, orFilter, agentCall } = require('../services/searchEverything');
const { cleanInput, SearchNotesError } = require('../services/searchNotesService');

describe('searchEverything helpers', () => {
  test('interactive Search uses the archive RPC and returns a revision-scoped passage link', async () => {
    const db = { from: jest.fn(), rpc: jest.fn().mockResolvedValue({ data: {
      records: [{ id: 'old', title: 'Planning', decisions: ['Keep zircon funding'] }],
      passages: [{ meeting_id: 'old', title: 'Planning', source_line: 73, chunk_start: 1,
        at_ms: 3_000_000, speaker: 'Ana', body: 'We kept zircon funding through December', revision: 'rev-1', rank: 1.2 }],
    } }) };
    const response = await search({ query: 'zircon', types: ['meetings', 'decisions'], orgIds: ['org-a'], db, includePassages: true });
    expect(db.from).not.toHaveBeenCalled();
    expect(db.rpc).toHaveBeenCalledTimes(1);
    expect(db.rpc).toHaveBeenCalledWith('search_meeting_history', {
      p_org_ids: ['org-a'], p_terms: ['zircon'], p_limit: 24, p_find_passages: true,
    });
    expect(response.groups.meetings[0]).toMatchObject({ id: 'old', snippet: 'We kept zircon funding through December', meta: {
      atMs: 3_000_000, speaker: 'Ana', passage: { revision: 'rev-1', kind: 'segment', position: 73 },
    } });
    expect(response.groups.decisions).toHaveLength(1);
  });

  test('untimed archive results carry their Unicode offset and empty results do not rescan transcripts', async () => {
    const rpc = jest.fn().mockResolvedValueOnce({ data: { records: [], passages: [] } }).mockResolvedValueOnce({ data: {
      records: [], passages: [{ meeting_id: 'upload', title: 'Imported notes', source_line: 0, chunk_start: 1001,
        at_ms: null, body: 'Legacy transcript', revision: 'rev-2', rank: 1 }],
    } });
    const db = { rpc, from: jest.fn() };
    const options = { query: 'legacy', types: ['meetings'], orgIds: ['org-a'], db, includePassages: true };
    expect((await search(options)).groups.meetings).toEqual([]);
    expect((await search(options)).groups.meetings[0].meta).toMatchObject({ atMs: null, passage: { kind: 'text', position: 1001 } });
    expect(db.from).not.toHaveBeenCalled();
  });

  test('meeting name typos preserve the actual title and rank below exact words', () => {
    const fuzzy = matchMeeting({ id: 'm1', title: 'Pricing pilot' }, ['pricnig']).meeting;
    expect(fuzzy.title).toBe('Pricing pilot');
    expect(fuzzy.meta.spellingMatch).toBe(true);
    expect(fuzzy.titleHits).toEqual([]);
    expect(fuzzy.score).toBeLessThan(matchMeeting({ id: 'm2', title: 'Pricnig pilot' }, ['pricnig']).meeting.score);
    expect(matchMeeting({ id: 'm1', title: 'Pricing pilot' }, ['zzzzzzzz']).meeting).toBeNull();
  });

  test('spelling fallbacks retain org and private-note boundaries and cap their scans', async () => {
    const calls = [];
    const fixtures = {
      action_items: [{ id: 'own-action', org_id: 'org-a', task_description: 'Pricing' }, { id: 'other-action', org_id: 'org-b', task_description: 'Pricing' }],
      tasks: [{ id: 'own-task', org_id: 'org-a', title: 'Pricing' }, { id: 'other-task', org_id: 'org-b', title: 'Pricing' }],
      projects: [{ id: 'own-project', org_id: 'org-a', name: 'Pricing' }],
      search_notes: [{ id: 'mine', org_id: 'org-a', user_id: 'me', body: 'Pricing' }, { id: 'private', org_id: 'org-a', user_id: 'other', body: 'Pricing' }],
      meeting_notes: [
        { id: 'team', org_id: 'org-a', author_id: 'other', body: 'Pricing', visibility: 'team', meetings: { org_id: 'org-a' } },
        { id: 'hidden', org_id: 'org-a', author_id: 'other', body: 'Pricing', visibility: 'private', meetings: { org_id: 'org-a' } },
        { id: 'foreign-parent', org_id: 'org-a', author_id: 'me', body: 'Pricing', visibility: 'team', meetings: { org_id: 'org-b' } },
      ],
    };
    const db = { from(table) {
      let data = fixtures[table];
      let exact = false;
      const call = { table, scope: false, limit: null };
      calls.push(call);
      const builder = {
        select() { return this; }, order() { return this; },
        in(field, values) { data = data.filter(row => values.includes(field === 'meetings.org_id' ? row.meetings?.org_id : row[field])); if (field === 'org_id') call.scope = true; return this; },
        eq(field, value) { data = data.filter(row => row[field] === value); return this; },
        or(filter) {
          if (filter === 'visibility.eq.team,author_id.eq.me') data = data.filter(row => row.visibility === 'team' || row.author_id === 'me');
          else exact = true;
          return this;
        },
        limit(value) { call.limit = value; return this; },
        then(resolve) { return Promise.resolve({ data: exact ? [] : data, error: null }).then(resolve); },
      };
      return builder;
    } };
    const r = await search({ query: 'pricnig', types: ['action_items', 'tasks', 'projects', 'notes'], orgIds: ['org-a'], userId: 'me', db });
    expect(r.groups.action_items.map(x => x.id)).toEqual(['own-action']);
    expect(r.groups.tasks.map(x => x.id)).toEqual(['own-task']);
    expect(r.groups.projects.map(x => x.id)).toEqual(['own-project']);
    expect(r.groups.notes.map(x => x.id).sort()).toEqual(['mine', 'team']);
    expect(calls.every(c => c.scope && c.limit <= 100)).toBe(true);
    expect(calls).toHaveLength(10);
  });

  test('exact records keep the original query budget; an empty org scope performs no reads', async () => {
    const from = jest.fn(() => {
      const builder = {
        select() { return this; }, in() { return this; }, order() { return this; }, or() { return this; }, limit() { return this; },
        then(resolve) { return Promise.resolve({ data: [{ id: 't1', title: 'Pricing plan' }], error: null }).then(resolve); },
      };
      return builder;
    });
    const r = await search({ query: 'pricing', types: ['tasks'], orgIds: ['org-a'], userId: 'me', db: { from } });
    expect(r.groups.tasks[0].meta.spellingMatch).toBe(false);
    expect(from).toHaveBeenCalledTimes(1);
    from.mockClear();
    expect((await search({ query: 'pricnig', orgIds: [], userId: 'me', db: { from } })).total).toBe(0);
    expect(from).not.toHaveBeenCalled();
  });
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
