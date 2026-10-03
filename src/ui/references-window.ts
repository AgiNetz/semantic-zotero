/**
 * References window: one per item. Loads the item's references from Semantic Scholar
 * and lists them (title, first author, year, PDF, citations); each row opens to the
 * authors, abstract and citation contexts. References not yet in the library can be added.
 * The window's root carries data-state="loading|ready|error" (used by the E2E tests).
 */
import { t } from '../i18n';
import { readPrefs } from '../prefs';
import { ApiError, loadReferences } from '../s2/client';
import { itemFields } from '../s2/ids';
import { authorList, firstAuthor, pdfUrl, type Reference } from '../s2/reference';
import { getFetch } from '../util/env';
import { logError, logger } from '../util/log';
import { el } from './dom';

const URL = 'chrome://semanticzotero/content/references.xhtml';
const log = logger('references');

export interface ReferencesBackend {
  addReference(item: any, reference: Reference): void;
}

export class ReferencesWindows {
  private open = new Map<number, any>();

  constructor(private backend: ReferencesBackend) {}

  show(item: any): any {
    const existing = this.open.get(item.id);
    if (existing && !existing.closed) {
      existing.focus();
      return existing;
    }
    const win = Zotero.getMainWindow().openDialog(URL, `semanticzotero-refs-${item.id}`, 'chrome,resizable,centerscreen,dialog=no', { itemID: item.id });
    this.open.set(item.id, win);
    return win;
  }

  get(itemID: number): any {
    const w = this.open.get(itemID);
    return w && !w.closed ? w : null;
  }

  /** Called by the window's onload. */
  onLoad(win: any): void {
    const itemID = win.arguments?.[0]?.itemID;
    const item = itemID && Zotero.Items.get(itemID);
    if (!item) return;
    win.addEventListener('unload', () => {
      if (this.open.get(itemID) === win) this.open.delete(itemID);
    });
    void this.load(win, item);
  }

  private async load(win: any, item: any): Promise<void> {
    const doc = win.document;
    const root = doc.documentElement;
    const fields = itemFields(item);
    doc.title = t('refs.title', { title: fields.title });
    const status = doc.getElementById('semanticzotero-refs-status');
    const list = doc.getElementById('semanticzotero-refs-list');
    for (const h of Array.from(doc.querySelectorAll('[data-i18n]')) as any[]) h.textContent = t(h.dataset.i18n);
    root.dataset.state = 'loading';
    status.textContent = t('refs.loading');
    try {
      const refs = await log.time(`references of ${item.key}`, () => loadReferences(readPrefs(), fields, getFetch()), (r) => `${r?.length ?? 'not found'}`);
      if (win.closed) return;
      if (refs === null) throw new ApiError(404, '');
      const known = await libraryTitles(item.libraryID);
      const editable = Zotero.Libraries.get(item.libraryID)?.editable !== false;
      list.replaceChildren(...refs.map((r) => this.row(doc, item, r, known.has((r.title || '').toLowerCase()), editable)));
      status.textContent = refs.length ? t('refs.count', { n: refs.length }) + (editable ? '' : ` – ${t('err.readOnly')}`) : t('refs.none');
      root.dataset.state = 'ready';
    } catch (e: any) {
      if (win.closed) return;
      status.textContent = e instanceof ApiError && e.status === 404 ? t('err.notFound')
        : e instanceof ApiError && e.status === 403 ? t('err.forbidden')
          : t('err.other', { message: e?.message || String(e) });
      status.classList.add('error');
      root.dataset.state = 'error';
      if (!(e instanceof ApiError)) logError(e);
    }
  }

  private row(doc: any, item: any, ref: Reference, inLibrary: boolean, editable: boolean): any {
    const etAl = t('refs.etAl');
    const action = el(doc, 'div', { className: 'cell action' });
    if (!ref.paperId) {
      action.textContent = t('refs.notAvailable');
    } else if (inLibrary) {
      action.textContent = t('refs.inLibrary');
    } else {
      const add = el(doc, 'button', { text: t('refs.add') });
      add.disabled = !editable;
      add.addEventListener('click', (e: any) => {
        e.preventDefault();
        e.stopPropagation();
        this.backend.addReference(item, ref);
      });
      action.append(add);
    }
    const summary = el(doc, 'summary', {},
      el(doc, 'div', { className: 'cell title', text: ref.title || '–' }),
      el(doc, 'div', { className: 'cell author', text: firstAuthor(ref, etAl) }),
      el(doc, 'div', { className: 'cell year', text: ref.year ?? '–' }),
      el(doc, 'div', { className: 'cell pdf', text: pdfUrl(ref) ? t('refs.yes') : t('refs.no') }),
      el(doc, 'div', { className: 'cell citations', text: ref.citationCount ?? '–' }),
      action,
    );
    const contexts = ref.contexts?.length
      ? el(doc, 'ul', {}, ...ref.contexts.map((c) => el(doc, 'li', { text: c })))
      : el(doc, 'p', { text: t('refs.notAvailable') });
    const details = el(doc, 'details', { className: 'reference' }, summary,
      el(doc, 'div', { className: 'details' },
        el(doc, 'div', { text: t('refs.authors', { authors: authorList(ref, etAl) || t('refs.notAvailable') }) }),
        el(doc, 'h4', { text: t('refs.abstract') }),
        el(doc, 'p', { text: ref.abstract || t('refs.notAvailable') }),
        el(doc, 'h4', { text: t('refs.contexts') }),
        contexts,
      ));
    if (ref.paperId) details.dataset.paperId = ref.paperId;
    else details.classList.add('unavailable');
    return details;
  }

  /** After adding: the row's button becomes "Added". */
  markAdded(itemID: number, paperId: string): void {
    const win = this.get(itemID);
    const row = win?.document.querySelector(`details[data-paper-id="${paperId}"]`);
    const button = row?.querySelector('button');
    if (button) {
      button.textContent = t('refs.added');
      button.disabled = true;
    }
  }

  closeAll(): void {
    for (const w of this.open.values()) if (!w.closed) w.close();
    this.open.clear();
  }
}

/** Lower-cased titles of the regular items in a library (as in 0.2). */
async function libraryTitles(libraryID: number): Promise<Set<string>> {
  const items = await Zotero.Items.getAll(libraryID, true);
  const titles = new Set<string>();
  for (const i of items) if (i.isRegularItem()) titles.add(String(i.getField('title') || '').toLowerCase());
  return titles;
}
