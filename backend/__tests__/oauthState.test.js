const { createState, verifyState, TTL_MS } = require('../utils/oauthState');

describe('signed OAuth state', () => {
  test('round-trips the user and return path', () => {
    expect(verifyState(createState({ userId: 'u1', returnUrl: '/settings' }))).toEqual({ userId: 'u1', returnUrl: '/settings' });
  });
  test('rejects a tampered or expired state', () => {
    const s = createState({ userId: 'u1', returnUrl: '/settings' }, 0);
    expect(verifyState(s, TTL_MS + 1)).toBeNull();
    const fresh = createState({ userId: 'u1' });
    const [body, mac] = fresh.split('.');
    const forged = Buffer.from(JSON.stringify({ u: 'attacker', r: '/', e: Date.now() + 1e6 })).toString('base64url');
    expect(verifyState(`${forged}.${mac}`)).toBeNull();
    expect(verifyState(body)).toBeNull();
    expect(verifyState('/calendar')).toBeNull();
  });
  test('never returns an off-site path', () => {
    expect(verifyState(createState({ userId: 'u1', returnUrl: '//evil.com' })).returnUrl).toBe('/calendar');
  });
});
