/**
 * Web APIs for the plugin sandbox.
 *
 * The bootstrap sandbox lacks some DOM globals (AbortController in particular,
 * see ZotSeek). Each accessor uses the sandbox global if present and otherwise
 * borrows it from Zotero's main window.
 */
function mainWindow(): any {
  const win = Zotero.getMainWindow?.();
  if (!win) throw new Error('Zotero main window not available');
  return win;
}

export function getFetch(): typeof fetch {
  if (typeof fetch !== 'undefined') return fetch;
  const win = mainWindow();
  return win.fetch.bind(win);
}

export function newAbortController(): AbortController {
  if (typeof AbortController !== 'undefined') return new AbortController();
  return new (mainWindow().AbortController)();
}

export function newTextDecoder(): TextDecoder {
  if (typeof TextDecoder !== 'undefined') return new TextDecoder();
  return new (mainWindow().TextDecoder)();
}
