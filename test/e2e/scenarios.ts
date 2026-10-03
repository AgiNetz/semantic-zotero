/**
 * E2E scenarios, run in order inside a real Zotero (7 and 10) against the mock
 * Semantic Scholar server (e2e/mock-s2.mjs). Later scenarios use what earlier ones put in ctx.
 */
import { getPref, setPref } from '../../src/prefs';
import { MENU_ITEM_ID, menuTarget } from '../../src/ui/context-menu';
import { assert, delay, nextEvent, screenshot, waitFor, type E2EContext } from './harness';

type Scenario = [string, (ctx: E2EContext) => Promise<void>];

const MOCK = 'http://127.0.0.1:8765';
const DIRECT = `${MOCK}/graph/v1`;
const PROXY = `${MOCK}/s2/graph/v1`;

function plugin(): any {
  return Zotero.SemanticZotero;
}

function main(): any {
  return Zotero.getMainWindow();
}

async function mockRequests(): Promise<{ path: string; key: string; proxy: boolean }[]> {
  return (await main().fetch(`${MOCK}/__requests`)).json();
}

async function resetMock(): Promise<void> {
  await main().fetch(`${MOCK}/__reset`, { method: 'POST' });
}

async function newItem(fields: Record<string, string>, type = 'journalArticle'): Promise<any> {
  const item = new Zotero.Item(type);
  item.libraryID = Zotero.Libraries.userLibraryID;
  for (const [k, v] of Object.entries(fields)) item.setField(k, v);
  await item.saveTx();
  return item;
}

async function select(item: any): Promise<void> {
  const pane = main().ZoteroPane;
  await pane.collectionsView.selectLibrary(Zotero.Libraries.userLibraryID);
  await pane.selectItem(item.id);
  await waitFor('item selected', () => pane.getSelectedItems().length === 1 && pane.getSelectedItems()[0].id === item.id);
}

/** Opens the item context menu, waits for our entry to show (Zotero 8+ adds plugin entries asynchronously), closes it. */
async function contextMenuEntry(): Promise<{ visible: boolean; entry: any }> {
  const popup = main().document.getElementById('zotero-itemmenu');
  const shown = nextEvent(popup, 'popupshown');
  openItemMenu(popup);
  await shown;
  const isVisible = (e: any) => !!e && !e.hidden && e.getBoundingClientRect().height > 0;
  const entry = await waitFor('context menu entry', () => isVisible(findEntry(popup)) && findEntry(popup), 5000).catch(() => findEntry(popup));
  const visible = isVisible(entry);
  const hidden = nextEvent(popup, 'popuphidden');
  popup.hidePopup();
  await hidden;
  return { visible, entry };
}

/** Clicks the context menu entry for the selected item and waits for the references window to finish. */
async function openReferences(item: any, state = 'ready'): Promise<any> {
  await select(item);
  const doc = main().document;
  const popup = doc.getElementById('zotero-itemmenu');
  const shown = nextEvent(popup, 'popupshown');
  openItemMenu(popup);
  await shown;
  const entry = await waitFor('context menu entry', () => findEntry(popup), 5000);
  popup.activateItem(entry);
  const win = await waitFor('references window', () => plugin().references.get(item.id));
  await waitFor(`references window state ${state}`, () => {
    const s = win.document?.documentElement?.dataset.state;
    return s === state || (s && s !== 'loading' && s !== state && Promise.reject(new Error(`state ${s}: ${status(win)}`)));
  });
  return win;
}

/** Opens the item context menu like a right click (Zotero 8+ adds plugin entries in buildItemContextMenu). */
function openItemMenu(popup: any): void {
  const pane = main().ZoteroPane;
  if (pane.onItemsContextMenuOpen) void pane.onItemsContextMenuOpen({ target: null }, 200, 200);
  else popup.openPopupAtScreen(200, 200, true);
}

/** Our entry: by Fluent id (legacy), or by label (MenuManager may not keep the id attribute). */
function findEntry(popup: any): any {
  return popup.querySelector(`[data-l10n-id="${MENU_ITEM_ID}"]`)
    || Array.from(popup.querySelectorAll('menuitem')).find((m: any) => /Semantic Scholar/.test(m.getAttribute('label') || ''));
}

function menuLabels(popup: any): string {
  return Array.from(popup.querySelectorAll('menuitem')).map((m: any) => `${m.getAttribute('label') || m.getAttribute('data-l10n-id')}${m.hidden ? '(h)' : ''}`).join(' | ');
}

function status(win: any): string {
  return win.document.getElementById('semanticzotero-refs-status')?.textContent || '';
}

function rows(win: any): any[] {
  return Array.from(win.document.querySelectorAll('details.reference'));
}

function rowByTitle(win: any, title: string): any {
  return rows(win).find((r) => r.querySelector('.cell.title').textContent === title);
}

function closeAll(): void {
  plugin().references.closeAll();
  plugin().addDialogs.closeAll();
}

export const scenarios: Scenario[] = [
  ['plugin is loaded, settings pane registered', async () => {
    assert(plugin(), 'Zotero.SemanticZotero missing');
    assert(plugin().paneID, 'preference pane not registered');
  }],

  ['Zotero 6 settings are migrated', async () => {
    assert(getPref('apiKey') === 'legacy-key', `apiKey = ${getPref('apiKey')}`);
    assert(Zotero.Prefs.get('SemanticZotero.apiKey') === undefined, 'old pref still set');
    setPref('apiKey', '');
  }],

  ['context menu: legacy on Zotero 7, MenuManager on 8+', async (ctx) => {
    const modern = !!Zotero.MenuManager;
    ctx.modern = modern;
    const doc = main().document;
    // Legacy entry has our id; MenuManager's entries do not.
    assert(!!doc.getElementById(MENU_ITEM_ID) === !modern, `legacy element present=${!!doc.getElementById(MENU_ITEM_ID)} on ${Zotero.version}`);
    ctx.paper = await newItem({ title: 'Citing Paper', DOI: '10.1000/known' });
    ctx.existing = await newItem({ title: 'Existing Paper' });
    const note = new Zotero.Item('note');
    note.libraryID = Zotero.Libraries.userLibraryID;
    await note.saveTx();
    // Not for notes (checked on the selection logic; waiting for an entry that must not appear would only cost time)
    assert(!menuTarget([note]) && menuTarget([ctx.paper]) === ctx.paper, 'menuTarget');
    await select(ctx.paper);
    const { visible, entry } = await contextMenuEntry();
    assert(visible, `entry not visible for a regular item: ${menuLabels(main().document.getElementById('zotero-itemmenu'))}`);
    // Label from Fluent in Zotero's UI language (English in the container)
    await waitFor('menu label', () => /Referenzen anzeigen|Show references/.test(entry.getAttribute('label') || ''));
    await screenshot(ctx, 'menu');
  }],

  ['references by DOI: list, library match, no key sent', async (ctx) => {
    await resetMock();
    const win = await openReferences(ctx.paper);
    ctx.win = win;
    assert(rows(win).length === 3, `rows: ${rows(win).length}`);
    assert(status(win).includes('3 Referenzen'), status(win));
    const existing = rowByTitle(win, 'Existing Paper');
    assert(existing.querySelector('.cell.action').textContent === 'In der Bibliothek', 'library match');
    assert(rowByTitle(win, 'Unresolved Reference').classList.contains('unavailable'), 'null paperId row');
    const open = rowByTitle(win, 'Open Paper With PDF');
    assert(open.querySelector('.cell.pdf').textContent === 'Ja', 'pdf column');
    assert(open.querySelector('.cell.author').textContent === 'Erika Muster u. a.', 'first author');
    const reqs = await mockRequests();
    assert(reqs.length === 1 && reqs[0].path === '/graph/v1/paper/DOI:10.1000/known/references', JSON.stringify(reqs));
    assert(reqs[0].key === '', 'key sent without one set');
    await screenshot(ctx, 'references', win);
  }],

  ['add a reference with collection, tag, relation and PDF', async (ctx) => {
    const collection = new Zotero.Collection();
    collection.libraryID = Zotero.Libraries.userLibraryID;
    collection.name = 'Sammlung A';
    await collection.saveTx();
    ctx.paper.addTag('Thema X');
    await ctx.paper.saveTx();

    const button = rowByTitle(ctx.win, 'Open Paper With PDF').querySelector('button');
    assert(button?.textContent === 'Hinzufügen', 'add button');
    button.click();
    const dialog = await waitFor('add dialog', () => Array.from(plugin().addDialogs.open as Set<any>)[0]);
    await waitFor('add dialog ready', () => dialog.document?.documentElement?.dataset.state === 'ready');
    const doc = dialog.document;
    const boxes = (id: string) => Array.from(doc.querySelectorAll(`#${id} input`)) as any[];
    const coll = boxes('semanticzotero-add-collections').find((i) => i.value === collection.key);
    const tag = boxes('semanticzotero-add-tags').find((i) => i.value === 'Thema X');
    assert(coll && tag, 'collection/tag checkbox missing');
    // Clicking the label ticks the box (0.2 had htmlFor = checkbox.key)
    doc.querySelector(`label[for="${coll.id}"]`).click();
    tag.click();
    assert(coll.checked && tag.checked, 'checkboxes');
    await screenshot(ctx, 'add-dialog', dialog);
    doc.getElementById('semanticzotero-add-button').click();
    await waitFor('dialog closed', () => dialog.closed, 30000);

    const s = new Zotero.Search();
    s.libraryID = Zotero.Libraries.userLibraryID;
    s.addCondition('title', 'is', 'Open Paper With PDF');
    const [id] = await s.search();
    assert(id, 'new item not found');
    const added = Zotero.Items.get(id);
    assert(added.itemType === 'preprint', added.itemType);
    assert(added.getCollections().includes(collection.id), 'collection');
    assert(added.hasTag('Thema X'), 'tag');
    assert(added.relatedItems.includes(ctx.paper.key) && ctx.paper.relatedItems.includes(added.key), 'relation');
    assert(added.getCreators().length === 2, 'creators');
    const atts = await waitFor('PDF attachment', () => added.getAttachments().length && added.getAttachments());
    assert(Zotero.Items.get(atts[0]).attachmentContentType === 'application/pdf', 'pdf type');
    const b = rowByTitle(ctx.win, 'Open Paper With PDF').querySelector('button');
    assert(b.disabled && b.textContent === 'Hinzugefügt', 'row not marked');
    closeAll();
  }],

  ['publisher withholds references: empty list, no error', async (ctx) => {
    const item = await newItem({ title: 'Elsevier Paper', DOI: '10.1000/elided' });
    const win = await openReferences(item);
    assert(rows(win).length === 0 && status(win).includes('keine Referenzen'), status(win));
    closeAll();
    ctx.elided = item;
  }],

  ['unknown DOI: falls back to the title search; unknown title: not found', async () => {
    const item = await newItem({ title: 'Fallback Title', DOI: '10.1000/missing' });
    const win = await openReferences(item);
    assert(rows(win).length === 1 && rowByTitle(win, 'Found Via Title'), 'fallback rows');
    closeAll();
    const lost = await newItem({ title: 'Nowhere To Be Found' });
    const win2 = await openReferences(lost, 'error');
    assert(status(win2).includes('nicht gefunden'), status(win2));
    closeAll();
  }],

  ['API key is sent; rejected key gives a clear message', async (ctx) => {
    await resetMock();
    setPref('apiKey', 'good-key');
    await openReferences(ctx.paper);
    closeAll();
    assert((await mockRequests()).every((r) => r.key === 'good-key'), 'key header');
    setPref('apiKey', 'bad');
    const win = await openReferences(ctx.paper, 'error');
    assert(status(win).includes('API-Key ab (403)'), status(win));
    closeAll();
    setPref('apiKey', '');
  }],

  ['proxy base URL', async (ctx) => {
    await resetMock();
    setPref('baseUrl', `${PROXY}/`);
    try {
      const win = await openReferences(ctx.paper);
      assert(rows(win).length === 3, 'rows via proxy');
    } finally {
      closeAll();
      setPref('baseUrl', DIRECT);
    }
    const reqs = await mockRequests();
    assert(reqs.length === 1 && reqs[0].proxy && reqs[0].key === '', JSON.stringify(reqs));
    setPref('baseUrl', DIRECT);
  }],

  ['settings pane shows and saves the prefs', async (ctx) => {
    await main().openPreferences?.(plugin().paneID) ?? Zotero.Utilities.Internal.openPreferences(plugin().paneID);
    const prefsWin = await waitFor('prefs window', () => Services.wm.getMostRecentWindow('zotero:pref'));
    const input = await waitFor('baseUrl field', () => prefsWin.document.getElementById('semanticzotero-baseUrl'), 20000);
    await waitFor('field filled', () => input.value === DIRECT || Promise.reject(new Error(`value "${input.value}"`)), 5000).catch(async (e) => {
      await screenshot(ctx, 'prefs', prefsWin);
      throw e;
    });
    input.value = PROXY;
    input.dispatchEvent(new prefsWin.Event('change'));
    assert(getPref('baseUrl') === PROXY, 'baseUrl not saved');
    prefsWin.document.getElementById('semanticzotero-baseUrl-reset').click();
    assert(getPref('baseUrl') === 'https://api.semanticscholar.org/graph/v1', 'reset');
    const relate = prefsWin.document.getElementById('semanticzotero-relateItems');
    assert(relate.checked, 'relateItems');
    prefsWin.close();
    setPref('baseUrl', DIRECT);
  }],

  ['disable removes the menu, enable restores it', async (ctx) => {
    const { AddonManager } = ChromeUtils.importESModule('resource://gre/modules/AddonManager.sys.mjs');
    const addon = await AddonManager.getAddonByID('tomasdanis26@gmail.com');
    await addon.disable();
    await waitFor('plugin gone', () => !Zotero.SemanticZotero);
    await select(ctx.paper);
    assert(!main().document.getElementById(MENU_ITEM_ID), 'legacy entry left after disable');
    await addon.enable();
    await waitFor('plugin back', () => Zotero.SemanticZotero?.paneID);
    const { visible } = await contextMenuEntry();
    assert(visible, 'entry missing after enable');
  }],
];
