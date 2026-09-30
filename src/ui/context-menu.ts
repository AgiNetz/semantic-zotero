/**
 * Item context menu "Show references (Semantic Scholar) …", visible for exactly one
 * regular item. Zotero 8+ has Zotero.MenuManager (target "main/library/item");
 * Zotero 7 gets the same entry added to #zotero-itemmenu directly (legacy).
 */
import { logError } from '../util/log';

export const MENU_ITEM_ID = 'semanticzotero-menu-references';
const MENU_ID = 'semanticzotero-item-menu';

let showReferences: ((item: any) => Promise<void>) | null = null;
let menuRegistration: string | false = false;

function selectedItems(): any[] {
  return Zotero.getActiveZoteroPane?.()?.getSelectedItems?.() || [];
}

/** The item the menu acts on, or null if the selection does not qualify. */
export function menuTarget(items = selectedItems()): any {
  return items.length === 1 && items[0]?.isRegularItem?.() ? items[0] : null;
}

export function onShowReferences(items = selectedItems()): Promise<void> {
  const item = menuTarget(items);
  return item && showReferences ? showReferences(item) : Promise.resolve();
}

function run(): void {
  onShowReferences().catch(logError);
}

/** Zotero 8+: MenuManager. Returns false if the API is missing (Zotero 7). */
export function registerMenus(pluginID: string, icon: string, show: (item: any) => Promise<void>): boolean {
  showReferences = show;
  const mm = (Zotero as any).MenuManager;
  if (!mm) return false;
  try {
    menuRegistration = mm.registerMenu({
      menuID: MENU_ID,
      pluginID,
      target: 'main/library/item',
      menus: [
        {
          menuType: 'menuitem',
          l10nID: MENU_ITEM_ID,
          icon,
          onShowing: (_e: any, ctx: any) => ctx.setVisible(!!menuTarget()),
          onCommand: run,
        },
      ],
    }) || false;
  } catch (e) {
    logError(e);
    menuRegistration = false;
  }
  return menuRegistration !== false;
}

export function unregisterMenus(): void {
  if (menuRegistration) (Zotero as any).MenuManager?.unregisterMenu(menuRegistration);
  menuRegistration = false;
  showReferences = null;
}

export function usesMenuManager(): boolean {
  return menuRegistration !== false;
}

/** Zotero 7: the same entry, added to the item context menu of a main window. */
export function addLegacyMenu(win: any, icon: string): void {
  if (menuRegistration) return;
  const doc = win.document;
  const popup = doc.getElementById('zotero-itemmenu');
  if (!popup || doc.getElementById(MENU_ITEM_ID)) return;
  const sep = doc.createXULElement('menuseparator');
  sep.id = `${MENU_ID}-separator`;
  const entry = doc.createXULElement('menuitem');
  entry.id = MENU_ITEM_ID;
  entry.classList.add('menuitem-iconic');
  entry.setAttribute('image', icon);
  entry.setAttribute('data-l10n-id', MENU_ITEM_ID);
  entry.addEventListener('command', run);
  popup.append(sep, entry);
  const onShowing = (e: any) => {
    if (e.target !== popup) return;
    entry.hidden = sep.hidden = !menuTarget();
  };
  popup.addEventListener('popupshowing', onShowing);
  legacyListeners.set(win, () => popup.removeEventListener('popupshowing', onShowing));
}

const legacyListeners = new WeakMap<any, () => void>();

export function removeLegacyMenu(win: any): void {
  legacyListeners.get(win)?.();
  legacyListeners.delete(win);
  for (const id of [`${MENU_ID}-separator`, MENU_ITEM_ID]) win.document.getElementById(id)?.remove();
}
