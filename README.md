# Semantic Zotero Plugin

Semantic Zotero integrates Zotero with Semantic Scholar to fetch and display references related to a selected paper. You can then add them to your library directly from Zotero along with the full-text PDF. For now, the visuals are pretty barebones, I will update when I have time.

![refs](https://github.com/AgiNetz/semantic-zotero/assets/29703385/d99ca766-182e-4d10-8c5d-5ee5199615dd)

## Usage

### Show References:

To fetch references for a given paper, right click on it, select "Semantic Zotero" and then "Show references"
![show-ref](https://github.com/AgiNetz/semantic-zotero/assets/29703385/bb52135d-fa33-4f5f-b3c5-5c674b103d24)

### Configure options

In the Zotero Menu bar, choosing Tools -> Semantic Zotero Options allows you to configure options such as custom Semantic Scholar API key

## Installation

1. Download the .xpi file from one of the releases
2. In Zotero menu bar, select Tools -> Add-ons -> Settings icon on upper right -> Install add-on from file

## Development

Requires Zotero 7–10. Everything builds and runs in Docker:

- `./build.sh` – unit tests, typecheck, build, `dist/semantic-zotero-<version>.xpi`
- `./e2e/run.sh` – end-to-end tests in real Zotero 7.0.32 and 10.0.3 (headless, Xvfb) against a mock Semantic Scholar API

Settings (Zotero → Settings → Semantic Zotero): API address (Semantic Scholar or a proxy), optional API key, relate items.

## Development

Requires Zotero 7–10. Everything builds and runs in Docker:

- `./build.sh` – unit tests, typecheck, build, `dist/semantic-zotero-<version>.xpi`
- `./e2e/run.sh` – end-to-end tests in real Zotero 7.0.32 and 10.0.3 (headless, Xvfb) against a mock Semantic Scholar API

Settings (Zotero → Settings → Semantic Zotero): API address (Semantic Scholar or a proxy), optional API key, relate items.

