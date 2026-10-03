import { test } from 'node:test';
import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import { base64url, codeChallenge, jwtClaims, randomString } from '../src/auth/pkce';
import { apiConfig } from '../src/s2/connection';
import type { SemanticZoteroPrefs } from '../src/prefs';

const crypto = webcrypto as unknown as Crypto;

test('base64url matches Node', () => {
  for (const n of [0, 1, 2, 3, 31, 32, 33]) {
    const b = crypto.getRandomValues(new Uint8Array(n));
    assert.equal(base64url(b), Buffer.from(b).toString('base64url'));
  }
  assert.equal(randomString(crypto, 32).length, 43);
});

test('PKCE S256 challenge (RFC 7636 appendix B)', async () => {
  assert.equal(await codeChallenge(crypto, 'dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
});

test('jwtClaims', () => {
  const payload = Buffer.from(JSON.stringify({ preferred_username: 'erika', exp: 1 })).toString('base64url');
  assert.equal(jwtClaims(`h.${payload}.s`).preferred_username, 'erika');
  assert.deepEqual(jwtClaims('garbage'), {});
});

const prefs = (p: Partial<SemanticZoteroPrefs>): SemanticZoteroPrefs => ({
  connection: 'direct', baseUrl: 'https://api.semanticscholar.org/graph/v1', apiKey: '', bridgeUrl: 'https://bridge/graph/v1',
  bridgeAuth: 'oidc', zoteroKey: '', oidcIssuer: 'https://kc/realms/r', oidcClientId: 'semantic-zotero', relateItems: true, ...p,
});
const fakeOidc = { accessToken: async () => 'AT', invalidate: () => {} } as any;
const noFetch = (async () => { throw new Error('unused'); }) as any;

test('connection: direct sends the personal key only', async () => {
  assert.deepEqual(await apiConfig(prefs({ apiKey: 'K' }), fakeOidc, noFetch).headers(), { 'x-api-key': 'K' });
  assert.deepEqual(await apiConfig(prefs({}), fakeOidc, noFetch).headers(), {});
});

test('connection: bridge with Zotero key or OIDC token, never the S2 key', async () => {
  const z = apiConfig(prefs({ connection: 'bridge', bridgeAuth: 'zotero', zoteroKey: 'ZK', apiKey: 'K' }), fakeOidc, noFetch);
  assert.equal(z.baseUrl, 'https://bridge/graph/v1');
  assert.deepEqual(await z.headers(), { 'Zotero-API-Key': 'ZK' });
  const o = apiConfig(prefs({ connection: 'bridge', apiKey: 'K' }), fakeOidc, noFetch);
  assert.deepEqual(await o.headers(), { Authorization: 'Bearer AT' });
  await assert.rejects(apiConfig(prefs({ connection: 'bridge', bridgeAuth: 'zotero' }), fakeOidc, noFetch).headers(), { name: 'NotLoggedIn' });
  assert.throws(() => apiConfig(prefs({ connection: 'bridge', bridgeUrl: '' }), fakeOidc, noFetch), { name: 'NotLoggedIn' });
});
