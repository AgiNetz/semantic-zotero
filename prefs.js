// Semantic Zotero default preferences (extensions.zotero.semanticzotero.*).

// Semantic Scholar Graph API. Direct: https://api.semanticscholar.org/graph/v1;
// behind a proxy (e.g. the portal's, which adds the key server-side) its base URL instead.
pref("extensions.zotero.semanticzotero.baseUrl", "https://api.semanticscholar.org/graph/v1");
// Personal key, sent as x-api-key. Empty: shared anonymous quota (or the proxy's key).
pref("extensions.zotero.semanticzotero.apiKey", "");
// Mark a newly added reference and the citing item as related.
pref("extensions.zotero.semanticzotero.relateItems", true);
// UI language: "" = follow Zotero, or "en" / "de".
pref("extensions.zotero.semanticzotero.locale", "");
