/* Semantic Zotero bootstrap: registers chrome, loads the bundle, delegates to Zotero.SemanticZotero. */
var chromeHandle;

function install() {}

async function startup({ id, version, rootURI }) {
  await Zotero.initializationPromise;

  const aomStartup = Components.classes["@mozilla.org/addons/addon-manager-startup;1"]
    .getService(Components.interfaces.amIAddonManagerStartup);
  const manifestURI = Services.io.newURI(rootURI + "manifest.json");
  chromeHandle = aomStartup.registerChrome(manifestURI, [
    ["content", "semanticzotero", rootURI + "content/"],
    ["locale", "semanticzotero", "en-US", rootURI + "locale/en-US/"],
    ["locale", "semanticzotero", "de", rootURI + "locale/de/"],
  ]);

  const ctx = { rootURI, Zotero };
  ctx._globalThis = ctx;
  try {
    Services.scriptloader.loadSubScript(rootURI + "content/scripts/semanticzotero.js", ctx);
    await Zotero.SemanticZotero.startup({ id, version, rootURI });
  } catch (e) {
    Zotero.debug("[SemanticZotero] startup failed: " + e);
    Zotero.logError(e);
  }
}

function onMainWindowLoad({ window }) {
  Zotero.SemanticZotero?.onMainWindowLoad(window);
}

function onMainWindowUnload({ window }) {
  Zotero.SemanticZotero?.onMainWindowUnload(window);
}

function shutdown(data, reason) {
  if (reason === APP_SHUTDOWN) return;
  try {
    Zotero.SemanticZotero?.shutdown();
  } catch (e) {
    Zotero.logError(e);
  }
  delete Zotero.SemanticZotero;
  if (chromeHandle) {
    chromeHandle.destruct();
    chromeHandle = null;
  }
}

function uninstall() {}
