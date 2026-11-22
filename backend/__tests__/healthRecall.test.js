/** Audit finding 5: a missing Recall signing secret shows up in /health/status. */
const express = require('express');
const request = require('supertest');

describe('/health/status reports Recall webhook config', () => {
  const saved = { ...process.env };
  afterEach(() => { process.env = { ...saved }; });
  const app = () => { const a = express(); a.use('/health', require('../routes/health')); return a; };

  test('degraded when bots are enabled but webhooks cannot be verified', async () => {
    process.env.RECALL_API_KEY = 'k';
    delete process.env.RECALL_WEBHOOK_SIGNING_SECRET;
    const res = await request(app()).get('/health/status');
    expect(res.body.services.recall.status).toBe('error');
    expect(res.body.status).toBe('degraded');
  });

  test('healthy recall when the secret is set', async () => {
    process.env.RECALL_API_KEY = 'k';
    process.env.RECALL_WEBHOOK_SIGNING_SECRET = 'whsec_x';
    const res = await request(app()).get('/health/status');
    expect(res.body.services.recall.status).toBe('healthy');
  });
});
