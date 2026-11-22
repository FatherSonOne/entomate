/** Audit finding 4: limiters have separate counters and do not double count. */
const express = require('express');
const request = require('supertest');

function freshLimiters() {
  jest.resetModules();
  return require('../middleware/rateLimiter');
}

test('ordinary API calls do not use up the AI allowance', async () => {
  const { apiLimiter, aiLimiter } = freshLimiters();
  const app = express();
  app.use(apiLimiter);
  app.get('/page', (req, res) => res.json({ ok: true }));
  app.post('/ai', aiLimiter, (req, res) => res.json({ ok: true }));
  for (let i = 0; i < 15; i++) await request(app).get('/page').expect(200);
  await request(app).post('/ai').expect(200);
});

test('a limiter applied twice counts a request once', async () => {
  const { rateLimiter } = freshLimiters();
  const lim = rateLimiter({ max: 3 });
  const app = express();
  app.use(lim);
  app.get('/x', lim, (req, res) => res.json({ ok: true }));
  for (let i = 0; i < 3; i++) await request(app).get('/x').expect(200);
  const res = await request(app).get('/x');
  expect(res.status).toBe(429);
  expect(res.body.error.code).toBe('RATE_LIMIT_EXCEEDED');
});

test('signed-in users are counted separately', async () => {
  const { rateLimiter } = freshLimiters();
  const lim = rateLimiter({ max: 1 });
  const app = express();
  app.use((req, _res, next) => { req.user = { id: req.headers['x-user'] }; next(); });
  app.get('/x', lim, (req, res) => res.json({ ok: true }));
  await request(app).get('/x').set('x-user', 'a').expect(200);
  await request(app).get('/x').set('x-user', 'b').expect(200);
  await request(app).get('/x').set('x-user', 'a').expect(429);
});
