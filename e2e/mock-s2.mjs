// Mock of the Semantic Scholar Graph API for the E2E tests, on 127.0.0.1:8765.
// Answers under /graph/v1 (direct), /s2/graph/v1 (a plain proxy) and /bridge/graph/v1 (like the
// Semantic Scholar Bridge: OIDC bearer token or Zotero key required). Key "bad" gets 403.
// /oidc/realms/test is a small OIDC provider (authorization code + PKCE, refresh tokens).
// GET /__requests lists the requests seen; POST /__reset clears them; /__oidc?lifetime=N sets the
// access token lifetime, /__oidc/stats counts token requests.
import crypto from 'node:crypto';
import http from 'node:http';

const PORT = 8765;
const requests = [];

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n' +
  '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n');

const ref = (paperId, title, extra = {}) => ({
  paperId, title, year: 2020, publicationDate: '2020-05-01', abstract: `Abstract of ${title}.`,
  url: paperId ? `https://www.semanticscholar.org/paper/${paperId}` : null, externalIds: {},
  authors: [{ name: 'Erika Muster' }, { name: 'Max Beispiel' }], isOpenAccess: false, openAccessPdf: null,
  citationCount: 42, ...extra,
});

const REFERENCES = {
  'DOI:10.1000/known': [
    { contexts: ['as shown in [1]'], citedPaper: ref('R1', 'Open Paper With PDF', { isOpenAccess: true, openAccessPdf: { url: `http://127.0.0.1:${PORT}/pdf/r1.pdf` } }) },
    { contexts: [], citedPaper: ref('R2', 'Existing Paper') },
    { contexts: [], citedPaper: ref(null, 'Unresolved Reference') },
  ],
  'FB1': [{ contexts: [], citedPaper: ref('R9', 'Found Via Title') }],
};

function send(res, status, body, type = 'application/json', headers = {}) {
  res.writeHead(status, { 'content-type': type, ...headers });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

const readBody = (req) => new Promise((r) => { const c = []; req.on('data', (d) => c.push(d)); req.on('end', () => r(Buffer.concat(c).toString())); });

// --- OIDC provider
const ISSUER = `http://127.0.0.1:${PORT}/oidc/realms/test`;
const codes = new Map();
const accessTokens = new Map();
const refreshTokens = new Set();
const oidcStats = { authorize: 0, code: 0, refresh: 0 };
let lifetime = 300;
let n = 0;
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
function issue() {
  n++;
  const access = `${b64({ alg: 'none' })}.${b64({ sub: 'user-1', preferred_username: 'erika', n })}.sig`;
  accessTokens.set(access, Date.now() + lifetime * 1000);
  const refresh = `rt-${n}`;
  refreshTokens.add(refresh);
  return { access_token: access, token_type: 'Bearer', expires_in: lifetime, refresh_token: refresh };
}

async function oidc(req, res, path, url) {
  if (path === '/.well-known/openid-configuration') {
    return send(res, 200, { issuer: ISSUER, authorization_endpoint: `${ISSUER}/auth`, token_endpoint: `${ISSUER}/token` });
  }
  if (path === '/auth') {
    oidcStats.authorize++;
    const q = url.searchParams;
    if (q.get('code_challenge_method') !== 'S256' || !q.get('code_challenge') || q.get('client_id') !== 'semantic-zotero') {
      return send(res, 400, { error: 'invalid_request' });
    }
    const code = `code-${crypto.randomUUID()}`;
    codes.set(code, { challenge: q.get('code_challenge'), redirect: q.get('redirect_uri') });
    return send(res, 302, '', 'text/plain', { location: `${q.get('redirect_uri')}?code=${code}&state=${encodeURIComponent(q.get('state'))}` });
  }
  if (path === '/token' && req.method === 'POST') {
    const f = new URLSearchParams(await readBody(req));
    if (f.get('grant_type') === 'authorization_code') {
      const c = codes.get(f.get('code'));
      codes.delete(f.get('code'));
      const challenge = crypto.createHash('sha256').update(f.get('code_verifier') || '').digest('base64url');
      if (!c || c.challenge !== challenge || c.redirect !== f.get('redirect_uri')) return send(res, 400, { error: 'invalid_grant' });
      oidcStats.code++;
      return send(res, 200, issue());
    }
    if (f.get('grant_type') === 'refresh_token') {
      if (!refreshTokens.delete(f.get('refresh_token'))) return send(res, 400, { error: 'invalid_grant' });
      oidcStats.refresh++;
      return send(res, 200, issue());
    }
    return send(res, 400, { error: 'unsupported_grant_type' });
  }
  send(res, 404, {});
}

/** Like the bridge: 401 without valid credentials, 403 for non-members. null = allowed. */
function bridgeAuth(req) {
  const bearer = /^Bearer (\S+)$/.exec(req.headers.authorization || '')?.[1];
  if (bearer) return (accessTokens.get(bearer) ?? 0) > Date.now() ? null : [401, 'token expired'];
  const key = req.headers['zotero-api-key'];
  if (key === 'memberkey0123456789') return null;
  if (key === 'otherkey0123456789') return [403, 'not a member of the required Zotero group'];
  if (key) return [401, 'invalid Zotero API key'];
  return [401, 'Authenticate with Authorization: Bearer <OIDC access token> or Zotero-API-Key'];
}

let busyCount = 0;

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/__requests') return send(res, 200, requests);
  if (url.pathname === '/__reset') { requests.length = 0; busyCount = 0; return send(res, 200, {}); }
  if (url.pathname === '/__oidc') { lifetime = Number(url.searchParams.get('lifetime') || 300); return send(res, 200, {}); }
  if (url.pathname === '/__oidc/stats') return send(res, 200, oidcStats);
  if (url.pathname.startsWith('/oidc/realms/test')) return oidc(req, res, url.pathname.slice('/oidc/realms/test'.length), url);
  if (url.pathname.startsWith('/pdf/')) return send(res, 200, PDF, 'application/pdf');

  const m = url.pathname.match(/^(\/s2|\/bridge)?\/graph\/v1(\/.*)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const key = req.headers['x-api-key'] || '';
  requests.push({ path: decodeURIComponent(url.pathname), query: url.search, key, proxy: m[1] === '/s2', bridge: m[1] === '/bridge',
    authorization: req.headers.authorization || '', zoteroKey: req.headers['zotero-api-key'] || '' });
  if (m[1] === '/bridge') {
    const refused = bridgeAuth(req);
    if (refused) return send(res, refused[0], { error: refused[0] === 401 ? 'unauthorized' : 'forbidden', message: refused[1] });
  }
  if (key === 'bad') return send(res, 403, { message: 'Forbidden' });
  const path = decodeURIComponent(m[2]);

  if (path === '/paper/search') {
    const q = url.searchParams.get('query');
    return send(res, 200, q === 'Fallback Title' ? { total: 1, data: [{ paperId: 'FB1', title: 'Fallback Title' }] } : { total: 0, data: [] });
  }
  const refs = path.match(/^\/paper\/(.+)\/references$/);
  if (refs && refs[1] === 'DOI:10.1000/busy' && busyCount++ === 0) {
    return send(res, 503, { error: 'busy', message: 'Semantic Scholar is busy; try again later.' }, 'application/json', { 'retry-after': '1' });
  }
  if (refs && refs[1] === 'DOI:10.1000/busy') return send(res, 200, { offset: 0, data: REFERENCES['DOI:10.1000/known'] });
  if (refs) {
    if (refs[1] === 'DOI:10.1000/elided') {
      return send(res, 200, { offset: 0, data: null, disclaimer: "fields have been elided by the publisher: {'references'}" });
    }
    if (REFERENCES[refs[1]]) return send(res, 200, { offset: 0, data: REFERENCES[refs[1]] });
    return send(res, 404, { error: 'Paper not found' });
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`mock-s2 on ${PORT}`));
