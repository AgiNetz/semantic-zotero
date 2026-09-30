/**
 * Entry point of the E2E build: the normal plugin plus the harness. When the
 * pref semanticzotero.e2e.resultsPath is set (only in the E2E profile), the harness
 * runs all scenarios after the first startup, writes the results and quits Zotero.
 */
import '../../src/index';
import { runAll } from './harness';

const plugin = Zotero.SemanticZotero;
const startup = plugin.startup.bind(plugin);
plugin.startup = async (info: any) => {
  await startup(info);
  // A scenario disables and re-enables the plugin; the new instance must not run the harness again.
  if (Zotero.semanticZoteroE2EStarted) return;
  Zotero.semanticZoteroE2EStarted = true;
  const results = Zotero.Prefs.get('semanticzotero.e2e.resultsPath');
  Zotero.debug(`[SemanticZotero E2E] harness installed, resultsPath=${results}`);
  if (results) void runAll();
};
