import { test } from 'node:test';
import assert from 'node:assert/strict';
import { paperIdOf } from '../src/s2/ids';
import { authorList, firstAuthor, parseReferences, pdfUrl } from '../src/s2/reference';
import { ApiError, apiUrl, loadReferences, type FetchFn } from '../src/s2/client';

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

test('apiUrl: base with or without trailing slash (direct or proxy)', () => {
  assert.equal(apiUrl({ baseUrl: 'https://p.local/s2/graph/v1/', apiKey: '' }, '/paper/x'), 'https://p.local/s2/graph/v1/paper/x');
});

function fakeFetch(routes: Record<string, [number, any]>, seen: { url: string; headers: any }[] = []): FetchFn {
  return async (url, init) => {
    seen.push({ url, headers: init?.headers });
    const path = url.replace('https://api', '').split('?')[0];
    const [status, body] = routes[path] ?? [404, {}];
    return { ok: status < 300, status, statusText: '', json: async () => body };
  };
}

test('loadReferences: by DOI, with key header', async () => {
  const seen: any[] = [];
  const refs = await loadReferences({ baseUrl: 'https://api', apiKey: 'k' }, { DOI: '10.1/x', title: 'T' },
    fakeFetch({ '/paper/DOI:10.1/x/references': [200, { data: [{ citedPaper: { paperId: 'r' } }] }] }, seen));
  assert.equal(refs?.[0].paperId, 'r');
  assert.equal(seen[0].headers['x-api-key'], 'k');
});

test('loadReferences: 404 falls back to the title search; unknown title is null', async () => {
  const routes: Record<string, [number, any]> = {
    '/paper/search': [200, { data: [{ paperId: 'S', title: 'my title' }] }],
    '/paper/S/references': [200, { data: [] }],
  };
  const seen: any[] = [];
  assert.deepEqual(await loadReferences({ baseUrl: 'https://api', apiKey: '' }, { DOI: '10.1/gone', title: 'My Title' }, fakeFetch(routes, seen)), []);
  assert.deepEqual(seen[0].headers, {});
  assert.equal(await loadReferences({ baseUrl: 'https://api', apiKey: '' }, { title: 'Other' }, fakeFetch(routes)), null);
});

test('loadReferences: 403 is raised', async () => {
  await assert.rejects(loadReferences({ baseUrl: 'https://api', apiKey: 'bad' }, { DOI: '1', title: '' },
    fakeFetch({ '/paper/DOI:1/references': [403, {}] })), (e: any) => e instanceof ApiError && e.status === 403);
});
