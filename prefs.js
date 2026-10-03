// Semantic Zotero default preferences (extensions.zotero.semanticzotero.*).

// "direct": Semantic Scholar Graph API (https://api.semanticscholar.org/graph/v1) or, when accessed
// through a proxy, the proxy's base URL, optionally with a personal key;
// "bridge": a Semantic Scholar Bridge that shares one key with a group (login via OIDC or Zotero key).
pref("extensions.zotero.semanticzotero.connection", "direct");
pref("extensions.zotero.semanticzotero.baseUrl", "https://api.semanticscholar.org/graph/v1");
// Personal key, sent as x-api-key (direct only).
pref("extensions.zotero.semanticzotero.apiKey", "");
// Bridge: Graph API base, e.g. https://bridge.example.org/graph/v1, and how to log in ("oidc" or "zotero").
pref("extensions.zotero.semanticzotero.bridgeUrl", "");
pref("extensions.zotero.semanticzotero.bridgeAuth", "oidc");
// Zotero API key of a member of the bridge's Zotero group (a separate key, not the sync key).
pref("extensions.zotero.semanticzotero.zoteroKey", "");
// OIDC provider of the bridge (e.g. https://keycloak.example.org/realms/example) and the public client ID.
pref("extensions.zotero.semanticzotero.oidcIssuer", "");
pref("extensions.zotero.semanticzotero.oidcClientId", "semantic-zotero");
// Mark a newly added reference and the citing item as related.
pref("extensions.zotero.semanticzotero.relateItems", true);
// UI language: "" = follow Zotero, or "en" / "de".
pref("extensions.zotero.semanticzotero.locale", "");
