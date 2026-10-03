// Mock of the Semantic Scholar Graph API for the E2E tests, on 127.0.0.1:8765.
// Answers under /graph/v1 (direct) and /s2/graph/v1 (like a proxy). Key "bad" gets 403.
// GET /__requests lists the requests seen (path, x-api-key); POST /__reset clears them.
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

function send(res, status, body, type = 'application/json') {
  res.writeHead(status, { 'content-type': type });
  res.end(type === 'application/json' ? JSON.stringify(body) : body);
}

http.createServer((req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname === '/__requests') return send(res, 200, requests);
  if (url.pathname === '/__reset') { requests.length = 0; return send(res, 200, {}); }
  if (url.pathname.startsWith('/pdf/')) return send(res, 200, PDF, 'application/pdf');

  const m = url.pathname.match(/^(\/s2)?\/graph\/v1(\/.*)$/);
  if (!m) return send(res, 404, { error: 'not found' });
  const key = req.headers['x-api-key'] || '';
  requests.push({ path: decodeURIComponent(url.pathname), query: url.search, key, proxy: !!m[1] });
  if (key === 'bad') return send(res, 403, { message: 'Forbidden' });
  const path = decodeURIComponent(m[2]);

  if (path === '/paper/search') {
    const q = url.searchParams.get('query');
    return send(res, 200, q === 'Fallback Title' ? { total: 1, data: [{ paperId: 'FB1', title: 'Fallback Title' }] } : { total: 0, data: [] });
  }
  const refs = path.match(/^\/paper\/(.+)\/references$/);
  if (refs) {
    if (refs[1] === 'DOI:10.1000/elided') {
      return send(res, 200, { offset: 0, data: null, disclaimer: "fields have been elided by the publisher: {'references'}" });
    }
    if (REFERENCES[refs[1]]) return send(res, 200, { offset: 0, data: REFERENCES[refs[1]] });
    return send(res, 404, { error: 'Paper not found' });
  }
  send(res, 404, { error: 'not found' });
}).listen(PORT, '127.0.0.1', () => console.log(`mock-s2 on ${PORT}`));
