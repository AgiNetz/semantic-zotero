/**
 * Semantic Zotero: references of a paper from Semantic Scholar, added to Zotero with one click.
 * Entry point; bootstrap.js calls startup()/shutdown().
 */
import { migrateLegacyPrefs } from './prefs';
import type { Reference } from './s2/reference';
import { AddDialogs } from './ui/add-dialog';
import { addLegacyMenu, registerMenus, removeLegacyMenu, unregisterMenus } from './ui/context-menu';
import { onPrefsLoad } from './ui/preferences';
import { ReferencesWindows } from './ui/references-window';
import { log, logError } from './util/log';

const FTL = 'semanticzotero.ftl';

class SemanticZoteroPlugin {
  info = { id: '', version: '', rootURI: '' };
  paneID: string | null = null;
  references = new ReferencesWindows({ addReference: (item, ref) => this.addDialogs.show(item, ref) });
  addDialogs = new AddDialogs({ added: (item, ref) => ref.paperId && this.references.markAdded(item.id, ref.paperId) });

  get icon(): string {
    return `${this.info.rootURI}content/icons/semanticzotero.svg`;
  }

  async startup(info: { id: string; version: string; rootURI: string }): Promise<void> {
    this.info = info;
    migrateLegacyPrefs();
    registerMenus(info.id, this.icon, (item) => this.showReferences(item));
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
    this.references.closeAll();
    this.addDialogs.closeAll();
    for (const win of Zotero.getMainWindows()) this.onMainWindowUnload(win);
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

  addReference(item: any, reference: Reference): any {
    return this.addDialogs.show(item, reference);
  }

  onReferencesWindowLoad = (win: any): void => this.references.onLoad(win);
  onAddDialogLoad = (win: any): void => this.addDialogs.onLoad(win);
  onPrefsLoad = (win: Window): void => onPrefsLoad(win);
}

Zotero.SemanticZotero = new SemanticZoteroPlugin();
