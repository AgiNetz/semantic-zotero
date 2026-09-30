/**
 * "Add reference" dialog: choose collections and tags of the citing item's library,
 * then create the reference as a Zotero item (with PDF if one is available).
 * The dialog's root carries data-state="ready|adding|done|error" (used by the E2E tests).
 */
import { t } from '../i18n';
import { readPrefs } from '../prefs';
import { pdfUrl, arxivId, type Reference } from '../s2/reference';
import { logError } from '../util/log';
import { el } from './dom';

const URL = 'chrome://semanticzotero/content/addReference.xhtml';

export interface AddDialogBackend {
  added(item: any, reference: Reference, newItem: any): void;
}

export class AddDialogs {
  private open = new Set<any>();

  constructor(private backend: AddDialogBackend) {}

  show(item: any, reference: Reference): any {
    const win = Zotero.getMainWindow().openDialog(URL, '', 'chrome,resizable,centerscreen,dialog=no', { itemID: item.id, reference });
    this.open.add(win);
    return win;
  }

  /** Called by the dialog's onload. */
  onLoad(win: any): void {
    const { itemID, reference } = win.arguments?.[0] || {};
    const item = itemID && Zotero.Items.get(itemID);
    if (!item || !reference) return;
    win.addEventListener('unload', () => this.open.delete(win));
    void this.fill(win, item, reference).catch(logError);
  }

  private async fill(win: any, item: any, reference: Reference): Promise<void> {
    const doc = win.document;
    const root = doc.documentElement;
    doc.title = t('add.title');
    for (const h of Array.from(doc.querySelectorAll('[data-i18n]')) as any[]) h.textContent = t(h.dataset.i18n);
    doc.getElementById('semanticzotero-add-reference').textContent = reference.title || '';
    const collections = Zotero.Collections.getByLibrary(item.libraryID, true);
    const tags = (await Zotero.Tags.getAll(item.libraryID)).map((x: any) => x.tag).sort((a: string, b: string) => a.localeCompare(b));
    const checkboxes = (box: any, entries: [string, string][], empty: string) => {
      if (!entries.length) {
        box.append(el(doc, 'p', { className: 'empty', text: empty }));
        return;
      }
      entries.forEach(([value, label], i) => {
        const input = el(doc, 'input');
        input.type = 'checkbox';
        input.value = value;
        input.id = `${box.id}-${i}`;
        const l = el(doc, 'label', { text: label });
        l.htmlFor = input.id;
        box.append(el(doc, 'div', {}, input, l));
      });
    };
    checkboxes(doc.getElementById('semanticzotero-add-collections'),
      collections.map((c: any) => [c.key, c.name] as [string, string]), t('add.noCollections'));
    checkboxes(doc.getElementById('semanticzotero-add-tags'), tags.map((x: string) => [x, x] as [string, string]), t('add.noTags'));
    const checked = (id: string) => Array.from(doc.querySelectorAll(`#${id} input:checked`)).map((i: any) => i.value);
    const status = doc.getElementById('semanticzotero-add-status');
    const button = doc.getElementById('semanticzotero-add-button');
    doc.getElementById('semanticzotero-add-cancel').addEventListener('click', () => win.close());
    button.addEventListener('click', async () => {
      button.disabled = true;
      root.dataset.state = 'adding';
      status.textContent = t('add.adding');
      try {
        const newItem = await addReference(item, reference, checked('semanticzotero-add-collections'), checked('semanticzotero-add-tags'), readPrefs().relateItems);
        this.backend.added(item, reference, newItem);
        root.dataset.state = 'done';
        win.close();
      } catch (e: any) {
        logError(e);
        status.textContent = String(e?.message || e);
        button.disabled = false;
        root.dataset.state = 'error';
      }
    });
    root.dataset.state = 'ready';
  }

  closeAll(): void {
    for (const w of this.open) if (!w.closed) w.close();
    this.open.clear();
  }
}

/** Creates the reference as a preprint in the citing item's library, as in 0.2. */
export async function addReference(item: any, reference: Reference, collectionKeys: string[], tags: string[], relate: boolean): Promise<any> {
  const newItem = new Zotero.Item('preprint');
  newItem.libraryID = item.libraryID;
  const arxiv = arxivId(reference);
  newItem.setField('title', reference.title || '');
  newItem.setField('date', reference.publicationDate || (reference.year ? String(reference.year) : ''));
  if (reference.abstract) newItem.setField('abstractNote', reference.abstract);
  if (arxiv) {
    newItem.setField('repository', 'arXiv');
    newItem.setField('archiveID', `arXiv:${arxiv}`);
  }
  if (reference.url) newItem.setField('url', reference.url);
  if (reference.authors?.length) {
    newItem.setCreators(reference.authors.map((a) => {
      const parts = a.name.split(' ');
      return { firstName: parts.slice(0, -1).join(' '), lastName: parts[parts.length - 1], creatorType: 'author' };
    }));
  }
  for (const tag of tags) newItem.addTag(tag);
  newItem.setCollections(collectionKeys);
  await newItem.saveTx();

  if (relate) {
    item.addRelatedItem(newItem);
    await item.saveTx();
    newItem.addRelatedItem(item);
    await newItem.saveTx();
  }

  const pdf = pdfUrl(reference);
  if (pdf) {
    try {
      await Zotero.Attachments.importFromURL({ url: pdf, parentItemID: newItem.id, contentType: 'application/pdf', libraryID: item.libraryID });
    } catch (e) {
      // The item stays; the PDF may be behind a paywall or gone.
      logError(e);
    }
  }
  return newItem;
}
