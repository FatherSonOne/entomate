/**
 * Services read the caller's orgs from requestOrgIds(); it must carry the
 * value set by attachOrgIds through async work, and be empty outside a request.
 */
jest.mock('../config/supabase', () => {
  const rows = [{ user_id: 'u1', org_id: 'org-1' }, { user_id: 'u1', org_id: 'org-2' }];
  const q = (filters = []) => ({
    select: () => q(filters),
    eq: (c, v) => q([...filters, (r) => r[c] === v]),
    then: (res) => res({ data: rows.filter((r) => filters.every((f) => f(r))), error: null })
  });
  const client = { from: () => q() };
  return { supabase: client, supabaseAdmin: client, supabaseAnon: client };
});

const { attachOrgIds, requestOrgIds } = require('../utils/orgContext');

test('outside a request there are no org ids (fail closed)', () => {
  expect(requestOrgIds()).toEqual([]);
});

test('inside a request, services see the caller\'s orgs after awaits', async () => {
  const req = { user: { id: 'u1' } };
  const seen = await new Promise((resolve) => {
    attachOrgIds(req, {}, async () => {
      await new Promise((r) => setTimeout(r, 5));
      resolve(requestOrgIds());
    });
  });
  expect(seen.sort()).toEqual(['org-1', 'org-2']);
  expect(req.orgIds.sort()).toEqual(['org-1', 'org-2']);
});
