/** A cited paper as returned by /paper/{id}/references (citedPaper plus the citation contexts). */
export interface Reference {
  paperId: string | null;
  title: string | null;
  year?: number | null;
  publicationDate?: string | null;
  abstract?: string | null;
  url?: string | null;
  externalIds?: Record<string, string> | null;
  authors?: { name: string }[] | null;
  isOpenAccess?: boolean;
  openAccessPdf?: { url?: string | null } | null;
  citationCount?: number | null;
  contexts?: string[] | null;
}

export const REFERENCE_FIELDS = 'title,publicationDate,year,abstract,url,externalIds,authors,isOpenAccess,openAccessPdf,citationCount,contexts';

export function arxivId(ref: Reference): string | null {
  return ref.externalIds?.ArXiv || null;
}

/** arXiv PDF if the paper is on arXiv, otherwise the open-access PDF, if any. */
export function pdfUrl(ref: Reference): string | null {
  const arxiv = arxivId(ref);
  if (arxiv) return `https://arxiv.org/pdf/${arxiv}.pdf`;
  return (ref.isOpenAccess && ref.openAccessPdf?.url) || null;
}

export function firstAuthor(ref: Reference, etAl: string): string {
  const a = ref.authors || [];
  if (!a.length) return '';
  return a.length > 1 ? `${a[0].name} ${etAl}` : a[0].name;
}

export function authorList(ref: Reference, etAl: string, max = 5): string {
  const a = ref.authors || [];
  const shown = a.slice(0, max).map((x) => x.name).join(', ');
  return a.length > max ? `${shown}, ${etAl}` : shown;
}

/** Response of /references: null `data` (publisher withholds the list) counts as no references. */
export function parseReferences(json: any): Reference[] {
  const data = Array.isArray(json?.data) ? json.data : [];
  return data.filter((r: any) => r?.citedPaper).map((r: any) => ({ ...r.citedPaper, contexts: r.contexts ?? [] }));
}
