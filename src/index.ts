/**
 * Semantic Zotero: references of a paper from Semantic Scholar, added to Zotero with one click.
 * Entry point; bootstrap.js calls startup()/shutdown().
 */
import { CALLBACK_PATH, OidcSession } from './auth/oidc';
import { migrateLegacyPrefs } from './prefs';
import { AddDialogs } from './ui/add-dialog';
import { addLegacyMenu, registerMenus, removeLegacyMenu, unregisterMenus } from './ui/context-menu';
import { onPrefsLoad } from './ui/preferences';
import { ReferencesWindows } from './ui/references-window';
import { getCrypto, getFetch, newURLSearchParams } from './util/env';
import { log, logError } from './util/log';

const FTL = 'semanticzotero.ftl';

class SemanticZoteroPlugin {
  info = { id: '', version: '', rootURI: '' };
  paneID: string | null = null;
  oidc = new OidcSession({
    fetch: (url, init) => getFetch()(url, init),
    crypto: getCrypto(),
    launch: (url) => Zotero.launchURL(url),
    redirectUri: () => `http://127.0.0.1:${Zotero.Server.port}${CALLBACK_PATH}`,
    form: (fields) => newURLSearchParams(fields),
  });
  references = new ReferencesWindows({ addReference: (item, ref) => this.addDialogs.show(item, ref), oidc: this.oidc });
  addDialogs = new AddDialogs({ added: (item, ref) => ref.paperId && this.references.markAdded(item.id, ref.paperId) });

  get icon(): string {
    return `${this.info.rootURI}content/icons/semanticzotero.svg`;
  }

  async startup(info: { id: string; version: string; rootURI: string }): Promise<void> {
    this.info = info;
    migrateLegacyPrefs();
    registerMenus(info.id, this.icon, (item) => this.showReferences(item));
    this.registerCallback();
    for (const win of Zotero.getMainWindows()) this.onMainWindowLoad(win);
    try {
      this.paneID = await Zotero.PreferencePanes.register({
        pluginID: info.id,
        src: `${info.rootURI}content/preferences.xhtml`,
        label: 'Semantic Zotero',
        image: this.icon,
      });
    } catch (e) {
      logError(e);
    }
    log(`started ${info.version}`);
  }

  shutdown(): void {
    if (this.paneID) Zotero.PreferencePanes.unregister?.(this.paneID);
    this.paneID = null;
    unregisterMenus();
    delete Zotero.Server?.Endpoints?.[CALLBACK_PATH];
    this.references.closeAll();
    this.addDialogs.closeAll();
    for (const win of Zotero.getMainWindows()) this.onMainWindowUnload(win);
  }

  /** Redirect target of the OIDC login in the browser (opts into browser requests; guarded by the login's state). */
  private registerCallback(): void {
    const oidc = this.oidc;
    const E: any = function () {};
    E.prototype = {
      supportedMethods: ['GET'],
      // Browser navigation must reach this endpoint: Zotero 8+ allows it with this flag, Zotero 7 for
      // endpoints whose data types are all non-"simple" (no form posts from web pages).
      allowRequestsFromUnsafeWebContent: true,
      supportedDataTypes: ['application/json'],
      init: async (req: any) => {
        const [status, message] = oidc.handleCallback(newURLSearchParams(Object.fromEntries(req.searchParams ?? [])));
        const html = `<!doctype html><meta charset="utf-8"><title>Semantic Zotero</title><body style="font-family:sans-serif;margin:3em"><h2>Semantic Zotero</h2><p>${message}</p>`;
        return [status, 'text/html; charset=utf-8', html];
      },
    };
    if (Zotero.Server?.Endpoints) Zotero.Server.Endpoints[CALLBACK_PATH] = E;
  }

  onMainWindowLoad(win: any): void {
    try {
      win.MozXULElement?.insertFTLIfNeeded(FTL);
      addLegacyMenu(win, this.icon);
    } catch (e) {
      logError(e);
    }
  }

  onMainWindowUnload(win: any): void {
    removeLegacyMenu(win);
    win.document.querySelector(`link[href="${FTL}"]`)?.remove();
  }

  async showReferences(item: any): Promise<void> {
    this.references.show(item);
  }

  onReferencesWindowLoad = (win: any): void => this.references.onLoad(win);
  onAddDialogLoad = (win: any): void => this.addDialogs.onLoad(win);
  onPrefsLoad = (win: Window): void => onPrefsLoad(win, this.oidc);
}

Zotero.SemanticZotero = new SemanticZoteroPlugin();
