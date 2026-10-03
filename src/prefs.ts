/** Typed access to extensions.zotero.semanticzotero.* (defaults in prefs.js). */

export const DEFAULT_BASE_URL = 'https://api.semanticscholar.org/graph/v1';

export interface SemanticZoteroPrefs {
  /** Graph API base without trailing slash: Semantic Scholar directly or a proxy. */
  baseUrl: string;
  apiKey: string;
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

function str(key: string, fallback = ''): string {
  const v = getPref(key);
  return typeof v === 'string' ? v.trim() : fallback;
}

export function readPrefs(): SemanticZoteroPrefs {
  const v = getPref('relateItems');
  return {
    baseUrl: (str('baseUrl') || DEFAULT_BASE_URL).replace(/\/+$/, ''),
    apiKey: str('apiKey'),
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
