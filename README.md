# Semantic Zotero Plugin

Semantic Zotero integrates Zotero with Semantic Scholar to fetch and display references related to a selected paper. You can then add them to your library directly from Zotero along with the full-text PDF. For now, the visuals are pretty barebones, I will update when I have time.

![refs](https://github.com/AgiNetz/semantic-zotero/assets/29703385/d99ca766-182e-4d10-8c5d-5ee5199615dd)

## Usage

### Show references

To fetch references for a given paper, right click on it and select "Show references (Semantic Scholar) …". Expand a reference to see its authors, abstract and citation contexts, and click "Add" to add it to your library (with the PDF if one is available), choosing collections and tags.

### Configure options

In Zotero → Settings → Semantic Zotero you can set:

- a personal Semantic Scholar API key (optional, but without one Semantic Scholar often rejects requests due to the shared rate limit)
- the API address, if you access the Semantic Scholar API through a proxy
- whether added references are marked as related to the citing item

## Installation

Requires Zotero 7–10.

1. Download the .xpi file from one of the releases
2. In Zotero, select Tools → Plugins → gear icon in the upper right → Install Plugin From File…

## Development

Everything builds and runs in Docker:

- `./build.sh` – unit tests, typecheck, build, `dist/semantic-zotero-<version>.xpi`
- `./e2e/run.sh` – end-to-end tests in real Zotero 7.0.32 and 10.0.3 (headless, Xvfb) against a mock Semantic Scholar API

Without Docker, Node 22 and `zip` are enough: `npm ci && npm test && npm run build -- --pack`.
