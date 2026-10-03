/**
 * Semantic Scholar Graph API, directly or through a Semantic Scholar Bridge. Headers
 * (x-api-key, Zotero-API-Key or an OIDC bearer token) come from the connection
 * (connection.ts). Busy answers (429, 503) are retried after Retry-After, else 2 s, 4 s, 8 s.
 */
import { REFERENCE_FIELDS, parseReferences, type Reference } from './reference';
import { paperIdOf, type ItemFields } from './ids';

export type FetchFn = (url: string, init?: any) => Promise<{ ok: boolean; status: number; statusText: string; headers: { get(name: string): string | null }; json(): Promise<any>; text(): Promise<string> }>;

export interface ApiConfig {
  baseUrl: string;
  headers: () => Promise<Record<string, string>>;
  fetch: FetchFn;
  /** Retries after 429/503 (default 3). */
  retries?: number;
  /** Longest single wait in seconds (default 60). */
  maxWaitSec?: number;
  /** Called before waiting for a retry. */
  onWait?: (seconds: number) => void;
  /** After a 401: e.g. drop a cached access token; true = try once more. */
  onUnauthorized?: () => Promise<boolean>;
  sleep?: (ms: number) => Promise<void>;
}

export class ApiError extends Error {
  constructor(readonly status: number, statusText: string, readonly serverMessage = '') {
    super(`HTTP ${status}${statusText ? ` ${statusText}` : ''}${serverMessage ? `: ${serverMessage}` : ''}`);
  }
}

/** The server could not be reached at all. */
export class NetworkError extends Error {}

export function apiUrl(baseUrl: string, path: string): string {
  return baseUrl.replace(/\/+$/, '') + path;
}

export function waitSeconds(retryAfter: string | null, attempt: number, maxSec: number): number {
  const sec = retryAfter === null ? NaN : Number(retryAfter);
  const wait = Number.isFinite(sec) && sec >= 0 ? sec : 2 ** (attempt + 1);
  return Math.min(Math.max(wait, 1), maxSec);
}

async function messageOf(resp: { json(): Promise<any> }): Promise<string> {
  try {
    const body = await resp.json();
    return String(body?.message || body?.error || '');
  } catch {
    return '';
  }
}

export async function apiGet(cfg: ApiConfig, path: string): Promise<any> {
  const retries = cfg.retries ?? 3;
  const sleep = cfg.sleep ?? ((ms: number) => Zotero.Promise.delay(ms));
  let retriedAuth = false;
  for (let attempt = 0; ; attempt++) {
    let resp;
    try {
      resp = await cfg.fetch(apiUrl(cfg.baseUrl, path), { method: 'GET', headers: await cfg.headers() });
    } catch (e: any) {
      if (e instanceof ApiError) throw e;
      if (e?.name === 'NotLoggedIn') throw e;
      throw new NetworkError(e?.message || String(e));
    }
    if (resp.ok) return resp.json();
    if ((resp.status === 429 || resp.status === 503) && attempt < retries) {
      const sec = waitSeconds(resp.headers.get('retry-after'), attempt, cfg.maxWaitSec ?? 60);
      cfg.onWait?.(sec);
      await sleep(sec * 1000);
      continue;
    }
    if (resp.status === 401 && !retriedAuth && cfg.onUnauthorized && await cfg.onUnauthorized()) {
      retriedAuth = true;
      attempt--;
      continue;
    }
    throw new ApiError(resp.status, resp.statusText, await messageOf(resp));
  }
}

export function referencesPath(paperId: string): string {
  return `/paper/${paperId}/references?limit=1000&fields=${REFERENCE_FIELDS}`;
}

export function searchPath(title: string): string {
  return `/paper/search?query=${encodeURIComponent(title)}&limit=1`;
}

/** paperId of the first search hit whose title matches exactly (case-insensitive). */
export async function searchByTitle(cfg: ApiConfig, title: string): Promise<string | null> {
  if (!title) return null;
  const json = await apiGet(cfg, searchPath(title));
  const hit = json?.data?.[0];
  return hit?.paperId && String(hit.title || '').toLowerCase() === title.toLowerCase() ? hit.paperId : null;
}

/**
 * References of an item: by its identifier, falling back to a title search when
 * there is none or Semantic Scholar does not know it (404). null: paper not found.
 */
export async function loadReferences(cfg: ApiConfig, item: ItemFields & { title: string }): Promise<Reference[] | null> {
  const id = paperIdOf(item);
  if (id) {
    try {
      return parseReferences(await apiGet(cfg, referencesPath(id)));
    } catch (e) {
      if (!(e instanceof ApiError && e.status === 404)) throw e;
    }
  }
  const found = await searchByTitle(cfg, item.title);
  return found ? parseReferences(await apiGet(cfg, referencesPath(found))) : null;
}
