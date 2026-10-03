/** ApiConfig for the current settings: direct (optional personal key) or bridge (Zotero key or OIDC). */
import { NotLoggedIn, type OidcSession } from '../auth/oidc';
import type { SemanticZoteroPrefs } from '../prefs';
import type { ApiConfig, FetchFn } from './client';

export function apiConfig(p: SemanticZoteroPrefs, oidc: OidcSession, fetch: FetchFn, onWait?: (sec: number) => void): ApiConfig {
  const base = { fetch, onWait };
  if (p.connection === 'direct') {
    return { ...base, baseUrl: p.baseUrl, headers: async (): Promise<Record<string, string>> => (p.apiKey ? { 'x-api-key': p.apiKey } : {}) };
  }
  if (!p.bridgeUrl) throw new NotLoggedIn('no bridge address');
  if (p.bridgeAuth === 'zotero') {
    return {
      ...base,
      baseUrl: p.bridgeUrl,
      headers: async () => {
        if (!p.zoteroKey) throw new NotLoggedIn('no Zotero key');
        return { 'Zotero-API-Key': p.zoteroKey };
      },
    };
  }
  const s = { issuer: p.oidcIssuer, clientId: p.oidcClientId };
  return {
    ...base,
    baseUrl: p.bridgeUrl,
    headers: async () => ({ Authorization: `Bearer ${await oidc.accessToken(s)}` }),
    onUnauthorized: async () => {
      oidc.invalidate();
      return true;
    },
  };
}
