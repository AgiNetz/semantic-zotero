/** Semantic Scholar paper ID of a Zotero item: URL, arXiv or DOI (in that order), as in version 0.2. */
export interface ItemFields {
  url?: string;
  repository?: string;
  archiveID?: string;
  DOI?: string;
}

const S2_URL_HOSTS = ['semanticscholar.org', 'arxiv.org', 'aclweb.org', 'acm.org', 'biorxiv.org'];

export function paperIdOf(f: ItemFields): string | null {
  if (f.url && S2_URL_HOSTS.some((h) => f.url!.includes(h))) return `URL:${f.url}`;
  if ((f.repository || '').toLowerCase() === 'arxiv' && f.archiveID) return f.archiveID;
  if (f.DOI) return `DOI:${f.DOI}`;
  return null;
}

/** Fields of a Zotero item (getField throws for fields its type does not have). */
export function itemFields(item: any): ItemFields & { title: string } {
  const get = (name: string): string => {
    try {
      return String(item.getField(name) || '').trim();
    } catch {
      return '';
    }
  };
  return { url: get('url'), repository: get('repository'), archiveID: get('archiveID'), DOI: get('DOI'), title: get('title') };
}
