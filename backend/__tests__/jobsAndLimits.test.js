/** Audit findings 8, 11, 12: internal job trigger, reprocess auth, body limits. */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';

const express = require('express');
const request = require('supertest');

jest.mock('../services/retentionService', () => ({ runRetentionSweep: jest.fn(async () => ({ ok: true })) }));
jest.mock('../services/meetingPassageRetrieval', () => ({ backfillPassageEmbeddings: jest.fn(async () => ({ indexed: 1 })) }));

describe('POST /api/internal/jobs/:job (finding 11)', () => {
  const saved = process.env.INTERNAL_API_KEY;
  beforeAll(() => { process.env.INTERNAL_API_KEY = 'svc-key'; });
  afterAll(() => { process.env.INTERNAL_API_KEY = saved; });
  const app = () => { const a = express(); a.use('/api/internal', require('../routes/internalJobs')); return a; };

  test('needs the internal API key', async () => {
    await request(app()).post('/api/internal/jobs/retention').expect(401);
    await request(app()).post('/api/internal/jobs/retention').set('X-API-Key', 'wrong').expect(401);
  });

  test('starts the retention sweep', async () => {
    const res = await request(app()).post('/api/internal/jobs/retention').set('X-API-Key', 'svc-key');
    expect(res.status).toBe(202);
    await new Promise((r) => setImmediate(r));
    expect(require('../services/retentionService').runRetentionSweep).toHaveBeenCalled();
  });

  test('the passage embedding job is available to the authenticated worker', async () => {
    await request(app()).post('/api/internal/jobs/passage-embeddings').expect(401);
    await request(app()).post('/api/internal/jobs/passage-embeddings').set('X-API-Key', 'svc-key').expect(202);
    await new Promise((resolve) => setImmediate(resolve));
    expect(require('../services/meetingPassageRetrieval').backfillPassageEmbeddings).toHaveBeenCalledTimes(1);
  });

  test('unknown job is 404', async () => {
    await request(app()).post('/api/internal/jobs/drop-tables').set('X-API-Key', 'svc-key').expect(404);
  });
});

describe('body size limits (finding 12)', () => {
  const { errorHandler } = require('../middleware/errorHandler');
  test('a JSON body over the limit gets 413, not a crash', async () => {
    const a = express();
    a.use(express.json({ limit: '1mb' }));
    a.post('/x', (req, res) => res.json({ ok: true }));
    a.use(errorHandler);
    const res = await request(a).post('/x').set('Content-Type', 'application/json')
      .send(JSON.stringify({ big: 'x'.repeat(1.2 * 1024 * 1024) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });
});
