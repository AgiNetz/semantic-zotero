/**
 * Semantic Scholar Graph API. The base URL is either the API itself or a proxy
 * that forwards /paper/... (and may add the key server-side); the personal key,
 * if set, goes along as x-api-key either way.
 */
import { REFERENCE_FIELDS, parseReferences, type Reference } from './reference';
import { paperIdOf, type ItemFields } from './ids';

export interface ApiConfig {
  baseUrl: string;
  apiKey: string;
}

export type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status: number; statusText: string; json(): Promise<any> }>;

export class ApiError extends Error {
  constructor(readonly status: number, statusText: string) {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}`);
  }
}

export function apiUrl(cfg: ApiConfig, path: string): string {
  return cfg.baseUrl.replace(/\/+$/, '') + path;
}

export async function apiGet(cfg: ApiConfig, path: string, fetchFn: FetchFn): Promise<any> {
  const headers: Record<string, string> = cfg.apiKey ? { 'x-api-key': cfg.apiKey } : {};
  const resp = await fetchFn(apiUrl(cfg, path), { method: 'GET', headers });
  if (!resp.ok) throw new ApiError(resp.status, resp.statusText);
  return resp.json();
}

export function referencesPath(paperId: string): string {
  return `/paper/${paperId}/references?limit=1000&fields=${REFERENCE_FIELDS}`;
}

export function searchPath(title: string): string {
  return `/paper/search?query=${encodeURIComponent(title)}&limit=1`;
}

/** paperId of the first search hit whose title matches exactly (case-insensitive). */
export async function searchByTitle(cfg: ApiConfig, title: string, fetchFn: FetchFn): Promise<string | null> {
  if (!title) return null;
  const json = await apiGet(cfg, searchPath(title), fetchFn);
  const hit = json?.data?.[0];
  return hit?.paperId && String(hit.title || '').toLowerCase() === title.toLowerCase() ? hit.paperId : null;
}

/**
 * References of an item: by its identifier, falling back to a title search when
 * there is none or Semantic Scholar does not know it (404). null: paper not found.
 */
export async function loadReferences(cfg: ApiConfig, item: ItemFields & { title: string }, fetchFn: FetchFn): Promise<Reference[] | null> {
  const id = paperIdOf(item);
  if (id) {
    try {
      return parseReferences(await apiGet(cfg, referencesPath(id), fetchFn));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const found = await searchByTitle(cfg, item.title, fetchFn);
  return found ? parseReferences(await apiGet(cfg, referencesPath(found), fetchFn)) : null;
}
