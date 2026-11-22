/**
 * Search memory: vector hits outside the caller's orgs are dropped, a failing
 * embedding call falls back to keyword search (scoped to the caller's orgs),
 * and keyword search matches content words rather than the whole question.
 */

'use strict';

const tables = {};
let rpcRows = [];
const calls = [];

const mockDb = {
  rpc: jest.fn(async () => ({ data: rpcRows, error: null })),
  from(table) {
    const filters = [];
    let orTerms = null;
    const q = {
      select() { return q; },
      order() { return q; },
      limit() { return q; },
      eq(col, val) { filters.push(r => r[col] === val); return q; },
      in(col, vals) { filters.push(r => vals.includes(r[col])); calls.push([table, 'in', col, vals]); return q; },
      or(expr) { orTerms = expr; calls.push([table, 'or', expr]); return q; },
      _rows() {
        let rows = (tables[table] || []).filter(r => filters.every(f => f(r)));
        if (orTerms) {
          const words = [...new Set(orTerms.split(',').map(t => t.split('.ilike.%')[1].replace(/%$/, '')))];
          rows = rows.filter(r => words.some(w => `${r.title} ${r.summary} ${r.transcript}`.toLowerCase().includes(w)));
        }
        return rows;
      },
      maybeSingle() { return Promise.resolve({ data: q._rows()[0] || null, error: null }); },
      then(resolve) { resolve({ data: q._rows(), error: null }); },
    };
    return q;
  },
};

const mockAi = { isConfigured: () => true, generateEmbedding: jest.fn() };
jest.mock('../../config/supabase', () => ({ supabase: mockDb, supabaseAdmin: mockDb }));
jest.mock('../../config/ai', () => mockAi);
jest.mock('../../utils/log', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../utils/orgContext', () => ({ requestOrgIds: () => ['org-a'] }));

const embeddingService = require('../embeddingService');

beforeEach(() => {
  calls.length = 0;
  tables.meetings = [
    { id: 'm1', org_id: 'org-a', title: 'Q1 planning', summary: 'We agreed the new pricing tiers.', transcript: '' },
    { id: 'm2', org_id: 'org-b', title: 'Other company', summary: 'Pricing for their product.', transcript: '' },
    { id: 'm3', org_id: 'org-a', title: 'Standup', summary: 'Nothing about money.', transcript: '' },
  ];
  tables.action_items = [];
});

test('vector hits from another org are dropped', async () => {
  mockAi.generateEmbedding.mockResolvedValue([0.1]);
  rpcRows = [
    { source_id: 'm2', source_type: 'meeting', similarity: 0.9 },
    { source_id: 'm1', source_type: 'meeting', similarity: 0.8 },
  ];
  const { results, searchType } = await embeddingService.semanticSearch('pricing', 5);
  expect(searchType).toBe('vector');
  expect(results.map(r => r.source_id)).toEqual(['m1']);
});

test('embedding failure falls back to org-scoped keyword search on content words', async () => {
  mockAi.generateEmbedding.mockRejectedValue(new Error('model retired'));
  const { results, searchType } = await embeddingService.semanticSearch('What did we decide about pricing?', 5);
  expect(searchType).toBe('text_fallback');
  expect(results.map(r => r.source_id)).toEqual(['m1']);
  expect(calls).toContainEqual(['meetings', 'in', 'org_id', ['org-a']]);
});

test('no vector hits in the caller org falls back to keywords', async () => {
  mockAi.generateEmbedding.mockResolvedValue([0.1]);
  rpcRows = [{ source_id: 'm2', source_type: 'meeting', similarity: 0.9 }];
  const { results, searchType } = await embeddingService.semanticSearch('pricing tiers', 5);
  expect(searchType).toBe('text_fallback');
  expect(results.map(r => r.source_id)).toEqual(['m1']);
});

test('keywords drop stop words and characters that could break the filter', () => {
  expect(embeddingService.keywords('What did we decide about "pricing", (tiers)?')).toEqual(['decide', 'pricing', 'tiers']);
  expect(embeddingService.keywords('?? !!')).toEqual([]);
});
