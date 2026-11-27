const express = require('express');
const request = require('supertest');

jest.mock('../config/supabase', () => ({
  supabase: { from: jest.fn(() => ({ select: jest.fn().mockResolvedValue({ count: 1 }) })) },
}));
jest.mock('../config/ai', () => ({}));
jest.mock('../utils/cache', () => ({}));
jest.mock('../services/askService', () => ({}));
jest.mock('../services/aiUsage', () => ({ meterAi: (req, res, next) => next() }));
jest.mock('../utils/orgContext', () => ({
  attachOrgIds: (req, res, next) => { req.orgIds = ['fixture-workspace']; next(); },
}));
jest.mock('../middleware/auth', () => ({
  authenticate: (req, res, next) => { req.user = { id: 'fixture-user' }; next(); },
}));
jest.mock('../services/searchEverything', () => ({ search: jest.fn() }));
jest.mock('../services/searchNotesService', () => ({}));
jest.mock('../services/embeddingService', () => ({ semanticSearch: jest.fn() }));

const { semanticSearch } = require('../services/embeddingService');
const { search } = require('../services/searchEverything');
const app = express();
app.use(express.json());
app.use('/search', require('../routes/search'));

beforeEach(() => {
  jest.clearAllMocks();
  search.mockImplementation(async ({ query }) => ({ query, groups: { meetings: [] }, counts: { meetings: 0 }, total: 0 }));
  semanticSearch.mockResolvedValue({
    searchType: 'vector',
    results: [{ source_type: 'meeting', source_id: 'meeting-1', meeting: { title: 'Budget review' } }],
  });
});

test('an explicit word search returns no matches without invoking semantic search', async () => {
  const res = await request(app).post('/search/everything').send({ query: 'financial planning', meaning: false });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({ engine: 'words', total: 0, groups: { meetings: [] } });
  expect(search).toHaveBeenCalledWith(expect.objectContaining({ orgIds: ['fixture-workspace'], includePassages: true }));
  expect(semanticSearch).not.toHaveBeenCalled();
});

test.each([{ meaning: true }, {}])('includes and labels meaning matches with options %j', async (options) => {
  const res = await request(app).post('/search/everything').send({ query: 'financial planning', ...options });
  expect(res.status).toBe(200);
  expect(res.body).toMatchObject({
    engine: 'words+meaning',
    total: 1,
    groups: { meetings: [{ id: 'meeting-1', meta: { byMeaning: true } }] },
  });
  expect(semanticSearch).toHaveBeenCalledTimes(1);
});
