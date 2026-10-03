# Semantic Zotero (Zotero plugin)

Zotero 7–10 bootstrap plugin: item context menu "Show references (Semantic Scholar) …" → window listing the
references of the item → "Add" creates the reference in the item's library (collections, tags, relation, PDF).
Connects to Semantic Scholar directly (optional key, or a proxy) or through a Semantic Scholar Bridge.
The Zotero 6 version (0.2) is in the git history before 0.3.0.

## Commands

**Everything runs in Docker** via the scripts (no Node needed on the host).

| Task | Command | Log |
|---|---|---|
| Deps, unit tests, typecheck, build, `dist/semantic-zotero-<v>.xpi` | `./build.sh` | `logs/build.log` |
| E2E (real Zotero 7.0.32 and 10.0.3 under Xvfb + mock Semantic Scholar, ~20 s) | `./e2e/run.sh` | `logs/e2e.log`, `e2e/out/<version>/` |
| One Zotero version | `ZOTERO_VERSIONS=10.0.3 ./e2e/run.sh` | |

- Version only in `package.json`; `manifest.json` keeps `0.0.0` and is stamped at build. Tags `v<version>`.
- Release: `updates.json` (the `update_url`) lists the xpi of the GitHub release `v<version>`; add the new version there.
- Tests run against the mock (`e2e/mock-s2.mjs`), never against the real API unless asked.

## Layout

| Path | Purpose |
|---|---|
| `bootstrap.js`, `src/index.ts` | Plugin object `Zotero.SemanticZotero` (menu, prefs pane, windows) |
| `src/prefs.ts`, `prefs.js` | `extensions.zotero.semanticzotero.*`: `connection` (direct/bridge), `baseUrl`, `apiKey`, `bridgeUrl`, `bridgeAuth`, `zoteroKey`, `oidcIssuer`, `oidcClientId`, `relateItems`, `locale`; migrates the Zotero 6 prefs `SemanticZotero.*` |
| `src/s2/` | Pure API logic: item → paper ID (`ids.ts`), requests with 429/503 retries and title fallback (`client.ts`), headers per connection (`connection.ts`: direct / bridge with Zotero key / OIDC), reference helpers (`reference.ts`) |
| `src/auth/` | OIDC login for the bridge (`oidc.ts`: PKCE in the browser, callback `/semanticzotero/callback` on Zotero's local server, refresh token in prefs `oidc.*`), `pkce.ts` |
| `src/ui/context-menu.ts` | MenuManager on Zotero 8+, DOM entry in `#zotero-itemmenu` on Zotero 7 |
| `src/ui/references-window.ts`, `content/references.xhtml` | References window (`data-state` loading/ready/error) |
| `src/ui/add-dialog.ts`, `content/addReference.xhtml` | Add dialog and `addReference()` |
| `src/ui/preferences.ts`, `content/preferences.xhtml` | Settings pane |
| `src/i18n.ts`, `locale/*/semanticzotero.ftl` | Window texts (EN/DE via `t()`), menu label via Fluent |
| `test/*.test.ts`, `test/e2e/` | Unit tests; E2E harness and scenarios |

## Pitfalls

- MenuManager rejects top-level separators for `main/library/item`, and adds plugin entries in
  `ZoteroPane.buildItemContextMenu()` (async): tests must open the menu via `onItemsContextMenuOpen`, not `openPopup`.
- The Zotero 7 tarball is `.tar.bz2`, Zotero 8+ `.tar.xz` (e2e/Dockerfile tries both).
- Zotero 7+ silently ignores a plugin without `applications.zotero.update_url` (no error in the log); the E2E run
  aborts after 30 s when the harness did not start.
- Bridge: <https://github.com/ILS-Research/semantic-scholar-api-key-bridge-for-semantic-zotero> (SvelteKit). The E2E mock (`e2e/mock-s2.mjs`) imitates it under
  `/bridge/graph/v1` and runs a small OIDC provider under `/oidc/realms/test`; keep it in line with the real bridge.
- The OIDC callback endpoint must accept browser navigation: `allowRequestsFromUnsafeWebContent` (Zotero 8+) and
  non-simple `supportedDataTypes` (Zotero 7 blocks browser requests otherwise, 403).
- The prefs pane's onload can fire twice (Zotero 10): `onPrefsLoad` initialises once per document.
- Bootstrap sandbox lacks `fetch` sometimes: use `src/util/env.ts`.
