/**
 * Audit findings 1 and 2: route groups that used to be open must reject
 * requests with no token, and ecosystem admin routes must not accept a
 * plain signed-in user.
 */
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'test-anon';
process.env.SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || 'test-service';
process.env.NODE_ENV = 'test';

const express = require('express');
const request = require('supertest');

function mount(routerPath, prefix, { user } = {}) {
  const app = express();
  app.use(express.json());
  if (user) {
    // Pretend optionalAuth already verified a token for this user.
    app.use((req, _res, next) => { req.user = user; req.authVerified = true; next(); });
  }
  app.use(prefix, require(routerPath));
  return app;
}

const OPEN_BEFORE = [
  ['../routes/intelligence', '/api/intelligence', [['get', '/today'], ['get', '/dashboard']]],
  ['../routes/assistant', '/api/assistant', [['post', '/query']]],
  ['../routes/crossAppSearch', '/api/cross-search', [['get', '/?q=ab']]],
  ['../routes/integrations', '/api/integrations', [['get', '/crm/deals'], ['get', '/logs'], ['post', '/webhooks/crm']]],
  ['../routes/ecosystem', '/api/ecosystem', [['get', '/status'], ['post', '/config'], ['get', '/events']]],
];

describe('no token → rejected', () => {
  const OLD_KEY = process.env.INTERNAL_API_KEY;
  beforeAll(() => { process.env.INTERNAL_API_KEY = 'test-internal-key'; });
  afterAll(() => { process.env.INTERNAL_API_KEY = OLD_KEY; });

  for (const [routerPath, prefix, routes] of OPEN_BEFORE) {
    for (const [method, path] of routes) {
      test(`${method.toUpperCase()} ${prefix}${path}`, async () => {
        const res = await request(mount(routerPath, prefix))[method](prefix + path).send({});
        expect(res.status).toBe(401);
      });
    }
  }

  test('the removed chat webhook stub is gone', async () => {
    const res = await request(mount('../routes/integrations', '/api/integrations'))
      .post('/api/integrations/webhooks/chat').set('X-API-Key', 'test-internal-key').send({});
    expect([401, 404]).toContain(res.status);
  });
});

describe('ecosystem admin routes', () => {
  test('a signed-in non-admin cannot change the global config', async () => {
    jest.resetModules();
    jest.doMock('../middleware/authorizePlatformAdmin', () => ({
      authorizePlatformAdmin: (req, res) => res.status(403).json({ error: 'Forbidden' })
    }));
    const app = mount('../routes/ecosystem', '/api/ecosystem', {
      user: { id: '11111111-1111-1111-1111-111111111111', email: 'a@b.c' }
    });
    const res = await request(app).post('/api/ecosystem/config').send({
      appName: 'logos_vision', apiUrl: 'https://attacker.example', serviceToken: 'x'
    });
    expect(res.status).toBe(403);
  });
});
