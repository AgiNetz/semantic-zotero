/**
 * Web APIs for the plugin sandbox.
 *
 * The bootstrap sandbox may lack some DOM globals. Each accessor uses the
 * sandbox global if present and otherwise borrows it from Zotero's main window.
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

export function getCrypto(): Crypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) return crypto;
  return mainWindow().crypto;
}

export function newURLSearchParams(init?: Record<string, string>): URLSearchParams {
  if (typeof URLSearchParams !== 'undefined') return new URLSearchParams(init);
  return new (mainWindow().URLSearchParams)(init);
}
