#!/usr/bin/env bash
# Builds Semantic Zotero inside Docker; the host needs only Docker.
#
#   ./build.sh          install deps, test, typecheck, build and pack the .xpi (dist/)
#   ./build.sh test     tests only
#   ./build.sh build    build + pack only (no tests)
#   ./build.sh e2e      build the E2E variant (dist/semantic-zotero-<version>-e2e.xpi), see e2e/run.sh
#   ./build.sh shell    interactive shell in the build container
#
# Uses `docker` if the current user may, otherwise `sudo docker`. The container
# runs with the caller's uid/gid, so build output is not owned by root.
set -euo pipefail
cd "$(dirname "$0")"

# Full output of every run goes to logs/build.log (line-buffered via tee),
# so a long build can be followed with `tail -f logs/build.log`.
mkdir -p logs
exec > >(tee logs/build.log) 2>&1
echo "== $(date -Is) $0 $*"

DOCKER=(docker)
if ! docker info >/dev/null 2>&1; then DOCKER=(sudo docker); fi

IMAGE=semanticzotero-build:node22
"${DOCKER[@]}" build --progress=plain -t "$IMAGE" docker/

run() {
  "${DOCKER[@]}" run --rm "${TTY[@]}" \
    -u "$(id -u):$(id -g)" \
    -e HOME=/tmp -e npm_config_cache=/tmp/.npm -e npm_config_update_notifier=false \
    -v "$PWD":/src -w /src "$IMAGE" bash -c "$1"
}

TTY=()
DEPS='if [ -f package-lock.json ]; then npm ci --no-audit --no-fund; else npm install --no-audit --no-fund; fi'

case "${1:-all}" in
  all)   run "$DEPS && npm test && npm run typecheck && npm run build -- --pack" ;;
  test)  run "$DEPS && npm test" ;;
  build) run "$DEPS && npm run build -- --pack" ;;
  e2e)   run "$DEPS && npm run build -- --pack --e2e" ;;
  shell) TTY=(-it); run "$DEPS; bash" ;;
  *) echo "usage: $0 [all|test|build|e2e|shell]" >&2; exit 2 ;;
esac
