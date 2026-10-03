#!/usr/bin/env bash
# E2E tests: builds the E2E variant of Semantic Zotero (in the build container), then
# runs it in real Zotero versions under Xvfb against a mock Semantic Scholar server.
# Headless, Docker only. Output per version in e2e/out/<version>/.
#   ./e2e/run.sh                      Zotero 7 (legacy menu) and 10 (MenuManager)
#   ZOTERO_VERSIONS=10.0.3 ./e2e/run.sh
set -euo pipefail
cd "$(dirname "$0")/.."

mkdir -p logs
exec > >(tee logs/e2e.log) 2>&1
echo "== $(date -Is) $0 $*"

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then DOCKER=(sudo docker); fi

./build.sh e2e
failed=0
for v in ${ZOTERO_VERSIONS:-7.0.32 10.0.3}; do
  echo "== Zotero $v"
  "${DOCKER[@]}" build --progress=plain --build-arg ZOTERO_VERSION="$v" -t "semanticzotero-e2e:$v" e2e/
  mkdir -p "e2e/out/$v"
  "${DOCKER[@]}" run --rm -u "$(id -u):$(id -g)" \
    -v "$PWD/dist":/dist:ro -v "$PWD/e2e/out/$v":/out \
    -e E2E_TIMEOUT="${E2E_TIMEOUT:-90}" \
    "semanticzotero-e2e:$v" || failed=1
done
exit $failed
