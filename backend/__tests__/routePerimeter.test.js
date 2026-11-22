/**
 * Audit finding 14: every route in routes/*.js must reject a request with no
 * token (401/403), unless it is listed below as public on purpose. A new
 * route without `authenticate` fails this test until it is added here with a
 * reason.
 */
process.env.SUPABASE_URL = 'http://127.0.0.1:9'; // unreachable: no real DB calls
process.env.SUPABASE_ANON_KEY = 'test-anon';
process.env.SUPABASE_SERVICE_KEY = 'test-service';
process.env.NODE_ENV = 'test';
process.env.INTERNAL_API_KEY = 'test-internal-key';

const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');

// file -> "METHOD path" entries that are public by design.
const PUBLIC = {
  'health.js': ['GET /', 'GET /live', 'GET /ready', 'GET /status', 'GET /metrics'], // probes
  'assistant.js': ['GET /health'],
  'bots.js': ['POST /recall-webhook'], // Svix signature checked in the handler
  'calendar.js': ['GET /status', 'GET /auth', 'GET /callback'], // Google OAuth flow
  'consent.js': ['GET /opt-out/:token', 'POST /opt-out/:token'], // emailed opt-out links
  'dataDeletion.js': ['POST /'], // public GDPR request form
  'slack.js': ['GET /status'],
  'templates.js': ['GET /', 'GET /categories', 'GET /:id', 'GET /:id/preview', 'GET /stats/popular'], // public catalog
  'webhooks.js': ['_ALL /:webhookIdentifier'], // per-webhook auth (validateAuthentication)
  'workflows.js': ['GET /templates', 'GET /templates/:templateId', 'GET /nodes/types', 'GET /nodes/:type/:subtype/schema'], // static catalog
};

const UUID = '00000000-0000-4000-8000-000000000000';
const routesDir = path.join(__dirname, '..', 'routes');
const cases = [];
for (const file of fs.readdirSync(routesDir).filter((f) => f.endsWith('.js'))) {
  const router = require(path.join(routesDir, file));
  for (const layer of (router.stack || []).filter((l) => l.route)) {
    for (const method of Object.keys(layer.route.methods)) {
      const key = `${method.toUpperCase()} ${layer.route.path}`;
      if ((PUBLIC[file] || []).includes(key)) continue;
      cases.push([file, key, router, method === '_all' ? 'get' : method, layer.route.path]);
    }
  }
}

test('found routes to check', () => {
  expect(cases.length).toBeGreaterThan(100);
});

test.each(cases)('%s %s needs a token', async (_file, _key, router, method, routePath) => {
  const app = express();
  app.use(express.json());
  app.use('/x', router);
  const res = await request(app)[method]('/x' + routePath.replace(/:[A-Za-z_]+/g, UUID)).send({});
  expect([401, 403]).toContain(res.status);
}, 10000);
