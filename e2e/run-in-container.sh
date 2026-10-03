#!/usr/bin/env bash
# Runs inside the E2E image: fresh profile with the E2E build of Semantic Zotero,
# mock Semantic Scholar server, Zotero under Xvfb. The harness in the plugin runs the
# scenarios, writes /out/results.json and quits Zotero.
set -uo pipefail

XPI=$(ls -t /dist/semantic-zotero-*-e2e.xpi | head -1)
WORK=$(mktemp -d)
export HOME=$WORK/home
PROFILE=$WORK/profile
mkdir -p "$HOME" "$PROFILE/extensions" "$WORK/data" /out
rm -f /out/results.json /out/screenshot-*.png
cp "$XPI" "$PROFILE/extensions/tomasdanis26@gmail.com.xpi"

cat > "$PROFILE/user.js" <<PREFS
user_pref("extensions.autoDisableScopes", 0);
user_pref("extensions.enabledScopes", 15);
user_pref("xpinstall.signatures.required", false);
user_pref("app.update.enabled", false);
user_pref("extensions.update.enabled", false);
user_pref("extensions.zotero.dataDir", "$WORK/data");
user_pref("extensions.zotero.useDataDir", true);
user_pref("extensions.zotero.sync.autoSync", false);
user_pref("extensions.zotero.semanticzotero.e2e.resultsPath", "/out/results.json");
user_pref("extensions.zotero.semanticzotero.e2e.outDir", "/out");
user_pref("extensions.zotero.semanticzotero.locale", "de");
user_pref("extensions.zotero.semanticzotero.baseUrl", "http://127.0.0.1:8765/graph/v1");
// Zotero 6 setting of version 0.2: migrated on startup
user_pref("extensions.zotero.SemanticZotero.apiKey", "legacy-key");
user_pref("extensions.zotero.SemanticZotero.relateItems", true);
PREFS

node /e2e/mock-s2.mjs > /out/mock-s2.log 2>&1 &

# Fail fast when the plugin does not load at all (e.g. invalid manifest): no harness, no results.
(sleep 30; grep -q "harness installed" /out/zotero.log 2>/dev/null \
  || { echo "E2E: plugin not loaded after 30 s (check manifest.json)" >&2; pkill -f zotero-bin; }) &

timeout "${E2E_TIMEOUT:-240}" xvfb-run -a -s "-screen 0 1600x1000x24" \
  /opt/zotero/zotero -profile "$PROFILE" -ZoteroDebugText > /out/zotero.log 2>&1
status=$?

if [ ! -f /out/results.json ]; then
  echo "E2E: no results (Zotero exit $status). See e2e/out/zotero.log" >&2
  grep -i "semanticzotero" /out/zotero.log | tail -20 >&2
  exit 1
fi

node -e '
const r = require("/out/results.json");
for (const t of r.results) console.log(`${t.skipped ? "skip" : t.ok ? "ok  " : "FAIL"} ${t.name} (${t.ms} ms)${t.skipped ? " - " + t.skipped : t.ok ? "" : "\n     " + t.error}`);
const failed = r.results.filter((t) => !t.ok).length;
console.log(`\n${r.results.length - failed}/${r.results.length} passed (Zotero ${r.zoteroVersion})`);
process.exit(failed ? 1 : 0);
'
