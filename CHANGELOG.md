# Changelog

## Unreleased

- Connection setting: directly to Semantic Scholar (optional personal key) or through a Semantic Scholar Bridge.
- Bridge login with an institution account (OIDC, authorization code + PKCE in the browser, redirect to Zotero's
  local server, refresh tokens) or with a Zotero key (member of the bridge's Zotero group).
- Busy answers (429/503) are retried after Retry-After (up to three times) with a waiting message in the window.
- Clear messages for: not logged in, bridge refused/unreachable, Semantic Scholar busy or unreachable.

## 0.3.0 (03.10.2026)

- Rebuilt for Zotero 7–10 (bootstrap plugin, `manifest.json`).
- Context menu via MenuManager (Zotero 8+) or DOM (Zotero 7); only for a single regular item.
- Settings in Zotero's settings window: API address (Semantic Scholar or a proxy), optional API key, relate items. Zotero 6 settings are carried over.
- English/German texts; errors shown in the window instead of alerts.
- Add dialog lists all collections of the library, subcollections with their parent path.
- Fixes on the way: references without title, open-access papers without PDF URL, publisher-withheld reference lists, labels of the collection checkboxes, new items land in the citing item's library, tags only from that library.
