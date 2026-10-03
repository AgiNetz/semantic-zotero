/** Typed access to extensions.zotero.semanticzotero.* (defaults in prefs.js). */

export const DEFAULT_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

export type Connection = 'direct' | 'bridge';
export type BridgeAuth = 'oidc' | 'zotero';

export interface SemanticZoteroPrefs {
  /** direct: Semantic Scholar with an optional personal key; bridge: a Semantic Scholar Bridge. */
  connection: Connection;
  /** Graph API base without trailing slash (direct). */
  baseUrl: string;
  apiKey: string;
  /** Graph API base of the bridge, e.g. https://bridge.example.org/graph/v1. */
  bridgeUrl: string;
  bridgeAuth: BridgeAuth;
  /** Zotero API key for bridges that check Zotero group membership. */
  zoteroKey: string;
  oidcIssuer: string;
  oidcClientId: string;
  relateItems: boolean;
}

// Without the `global` flag Zotero prepends "extensions.zotero.", matching prefs.js.
const PREFIX = 'semanticzotero.';

export function getPref(key: string): any {
  return Zotero.Prefs.get(PREFIX + key);
}

export function setPref(key: string, value: string | number | boolean): void {
  Zotero.Prefs.set(PREFIX + key, value);
}

export function clearPref(key: string): void {
  try {
    Zotero.Prefs.clear(PREFIX + key);
  } catch {
    // not set
  }
}

function str(key: string, fallback = ''): string {
  const v = getPref(key);
  return typeof v === 'string' ? v.trim() : fallback;
}

const trimSlash = (u: string) => u.replace(/\/+$/, '');

export function readPrefs(): SemanticZoteroPrefs {
  const v = getPref('relateItems');
  return {
    connection: str('connection') === 'bridge' ? 'bridge' : 'direct',
    baseUrl: trimSlash(str('baseUrl') || DEFAULT_BASE_URL),
    apiKey: str('apiKey'),
    bridgeUrl: trimSlash(str('bridgeUrl')),
    bridgeAuth: str('bridgeAuth') === 'zotero' ? 'zotero' : 'oidc',
    zoteroKey: str('zoteroKey'),
    oidcIssuer: trimSlash(str('oidcIssuer')),
    oidcClientId: str('oidcClientId'),
    relateItems: typeof v === 'boolean' ? v : true,
  };
}

/** Zotero 6 versions stored under extensions.zotero.SemanticZotero.*; carry the settings over once. */
export function migrateLegacyPrefs(): void {
  const oldKey = Zotero.Prefs.get('SemanticZotero.apiKey');
  if (typeof oldKey === 'string' && oldKey.trim() && !str('apiKey')) setPref('apiKey', oldKey.trim());
  const oldRelate = Zotero.Prefs.get('SemanticZotero.relateItems');
  if (typeof oldRelate === 'boolean') setPref('relateItems', oldRelate);
  for (const k of ['apiKey', 'relateItems']) {
    try {
      Zotero.Prefs.clear('SemanticZotero.' + k);
    } catch {
      // not set
    }
  }
}
