import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperIdOf } from '../src/s2/ids';
import { authorList, firstAuthor, parseReferences, pdfUrl } from '../src/s2/reference';
import { ApiError, apiGet, apiUrl, loadReferences, NetworkError, waitSeconds, type ApiConfig, type FetchFn } from '../src/s2/client';

test('paperIdOf: URL, then arXiv, then DOI', () => {
  assert.equal(paperIdOf({ url: 'https://arxiv.org/abs/1', DOI: '10.1/x' }), 'URL:https://arxiv.org/abs/1');
  assert.equal(paperIdOf({ url: 'https://example.org', repository: 'arXiv', archiveID: 'arXiv:2101.1', DOI: '10.1/x' }), 'arXiv:2101.1');
  assert.equal(paperIdOf({ url: 'https://example.org', DOI: '10.1/x' }), 'DOI:10.1/x');
  assert.equal(paperIdOf({}), null);
});

test('parseReferences: citedPaper plus contexts; null data is empty', () => {
  const refs = parseReferences({ data: [{ contexts: ['a'], citedPaper: { paperId: 'p1', title: 'T' } }, { citedPaper: null }] });
  assert.deepEqual(refs, [{ paperId: 'p1', title: 'T', contexts: ['a'] }]);
  assert.deepEqual(parseReferences({ data: null, disclaimer: 'elided' }), []);
});

test('pdfUrl: arXiv first, open access only with a URL', () => {
  assert.equal(pdfUrl({ paperId: 'x', title: '', externalIds: { ArXiv: '1234.5' } }), 'https://arxiv.org/pdf/1234.5.pdf');
  assert.equal(pdfUrl({ paperId: 'x', title: '', isOpenAccess: true, openAccessPdf: { url: 'https://a/b.pdf' } }), 'https://a/b.pdf');
  assert.equal(pdfUrl({ paperId: 'x', title: '', isOpenAccess: true, openAccessPdf: null }), null);
});

test('authors', () => {
  const ref = { paperId: 'x', title: '', authors: ['A', 'B', 'C'].map((name) => ({ name })) };
  assert.equal(firstAuthor(ref, 'et al.'), 'A et al.');
  assert.equal(authorList(ref, 'et al.', 2), 'A, B, et al.');
  assert.equal(firstAuthor({ paperId: 'x', title: '' }, 'et al.'), '');
});

test('apiUrl: base with or without trailing slash (direct or bridge)', () => {
  assert.equal(apiUrl('https://p.local/graph/v1/', '/paper/x'), 'https://p.local/graph/v1/paper/x');
});

type Route = [number, any, Record<string, string>?];

function fakeFetch(routes: Record<string, Route | Route[]>, seen: { url: string; headers: any }[] = []): FetchFn {
  return async (url, init) => {
    seen.push({ url, headers: init?.headers });
    const path = url.replace('https://api', '').split('?')[0];
    let r = routes[path] ?? [404, {}];
    if (Array.isArray(r[0])) r = (r as Route[]).length > 1 ? (r as Route[]).shift()! : (r as Route[])[0];
    const [status, body, headers = {}] = r as Route;
    return { ok: status < 300, status, statusText: '', headers: { get: (n: string) => headers[n.toLowerCase()] ?? null }, json: async () => body, text: async () => JSON.stringify(body) };
  };
}

const cfg = (fetch: FetchFn, extra: Partial<ApiConfig> = {}): ApiConfig =>
  ({ baseUrl: 'https://api', headers: async () => ({ 'x-api-key': 'k' }), fetch, sleep: async () => {}, ...extra });

test('loadReferences: by DOI, with the connection headers', async () => {
  const seen: any[] = [];
  const refs = await loadReferences(cfg(fakeFetch({ '/paper/DOI:10.1/x/references': [200, { data: [{ citedPaper: { paperId: 'r' } }] }] }, seen)), { DOI: '10.1/x', title: 'T' });
  assert.equal(refs?.[0].paperId, 'r');
  assert.equal(seen[0].headers['x-api-key'], 'k');
});

test('loadReferences: 404 falls back to the title search; unknown title is null', async () => {
  const routes: Record<string, Route> = {
    '/paper/search': [200, { data: [{ paperId: 'S', title: 'my title' }] }],
    '/paper/S/references': [200, { data: [] }],
  };
  assert.deepEqual(await loadReferences(cfg(fakeFetch(routes)), { DOI: '10.1/gone', title: 'My Title' }), []);
  assert.equal(await loadReferences(cfg(fakeFetch(routes)), { title: 'Other' }), null);
});

test('apiGet: 429/503 retried after Retry-After, reported via onWait', async () => {
  const waits: number[] = [];
  const f = fakeFetch({ '/x': [[429, {}, { 'retry-after': '3' }], [503, {}], [200, { ok: 1 }]] });
  assert.deepEqual(await apiGet(cfg(f, { onWait: (s) => waits.push(s) }), '/x'), { ok: 1 });
  assert.deepEqual(waits, [3, 4]);
});

test('apiGet: gives up after the retries with the server message', async () => {
  const f = fakeFetch({ '/x': [503, { error: 'busy', message: 'Semantic Scholar is busy' }, { 'retry-after': '1' }] });
  await assert.rejects(apiGet(cfg(f, { retries: 2 }), '/x'), (e: any) => e instanceof ApiError && e.status === 503 && e.serverMessage === 'Semantic Scholar is busy');
});

test('apiGet: 401 once more after onUnauthorized; network errors are NetworkError', async () => {
  let refreshed = 0;
  const f = fakeFetch({ '/x': [[401, {}], [200, { ok: 1 }]] });
  assert.deepEqual(await apiGet(cfg(f, { onUnauthorized: async () => { refreshed++; return true; } }), '/x'), { ok: 1 });
  assert.equal(refreshed, 1);
  const down: FetchFn = async () => { throw new TypeError('NetworkError when attempting to fetch resource.'); };
  await assert.rejects(apiGet(cfg(down), '/x'), NetworkError);
});

test('waitSeconds', () => {
  assert.equal(waitSeconds('7', 0, 60), 7);
  assert.equal(waitSeconds(null, 0, 60), 2);
  assert.equal(waitSeconds(null, 2, 60), 8);
  assert.equal(waitSeconds('600', 0, 60), 60);
});
