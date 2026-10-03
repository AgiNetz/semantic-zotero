/** Settings pane: fields <-> prefs. */
import { t, type Key } from '../i18n';
import { DEFAULT_BASE_URL, getPref, setPref } from '../prefs';

export function onPrefsLoad(win: Window): void {
  const doc = win.document;
  for (const e of Array.from(doc.querySelectorAll('#semanticzotero-preferences [data-i18n]')) as HTMLElement[]) {
    e.textContent = t(e.dataset.i18n as Key);
  }
  const $ = <T extends HTMLElement>(id: string) => doc.getElementById(`semanticzotero-${id}`) as T | null;
  const help = $('baseUrl-help');
  if (help) help.textContent = t('prefs.baseUrlHelp', { url: DEFAULT_BASE_URL });
  for (const key of ['baseUrl', 'apiKey']) {
    const input = $<HTMLInputElement>(key);
    if (!input) continue;
    input.value = String(getPref(key) ?? '');
    input.addEventListener('change', () => setPref(key, input.value.trim()));
  }
  $('baseUrl-reset')?.addEventListener('click', () => {
    setPref('baseUrl', DEFAULT_BASE_URL);
    const input = $<HTMLInputElement>('baseUrl');
    if (input) input.value = DEFAULT_BASE_URL;
  });
  const relate = $<HTMLInputElement>('relateItems');
  if (relate) {
    relate.checked = getPref('relateItems') !== false;
    relate.addEventListener('change', () => setPref('relateItems', relate.checked));
  }
}
