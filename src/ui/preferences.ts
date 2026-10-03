/** Settings pane: fields <-> prefs, connection sections, OIDC login. */
import type { OidcSession } from '../auth/oidc';
import { t, type Key } from '../i18n';
import { DEFAULT_BASE_URL, getPref, readPrefs, setPref } from '../prefs';

const TEXT_PREFS = ['baseUrl', 'apiKey', 'bridgeUrl', 'zoteroKey', 'oidcIssuer', 'oidcClientId'];

export function onPrefsLoad(win: Window, oidc: OidcSession): void {
  const doc = win.document;
  // The pane's onload can fire more than once (Zotero 10): initialise once, or buttons get two handlers.
  const root = doc.getElementById('semanticzotero-preferences') as HTMLElement | null;
  if (!root || root.dataset.initialized) return;
  root.dataset.initialized = '1';
  for (const e of Array.from(doc.querySelectorAll('#semanticzotero-preferences [data-i18n]')) as HTMLElement[]) {
    e.textContent = t(e.dataset.i18n as Key);
  }
  const $ = <T extends HTMLElement>(id: string) => doc.getElementById(`semanticzotero-${id}`) as T | null;
  const help = $('baseUrl-help');
  if (help) help.textContent = t('prefs.baseUrlHelp', { url: DEFAULT_BASE_URL });

  const loginStatus = (text?: string) => {
    const p = readPrefs();
    const user = oidc.user({ issuer: p.oidcIssuer, clientId: p.oidcClientId });
    const el = $('login-status');
    if (el) el.textContent = text ?? (user ? t('prefs.loggedIn', { user }) : t('prefs.loggedOut'));
    const logout = $<HTMLButtonElement>('logout');
    if (logout) logout.disabled = !user;
  };
  const sections = () => {
    const p = readPrefs();
    $('section-direct')!.hidden = p.connection !== 'direct';
    $('section-bridge')!.hidden = p.connection !== 'bridge';
    $('section-oidc')!.hidden = p.bridgeAuth !== 'oidc';
    $('section-zotero')!.hidden = p.bridgeAuth !== 'zotero';
    loginStatus();
  };

  for (const key of TEXT_PREFS) {
    const input = $<HTMLInputElement>(key);
    if (!input) continue;
    input.value = String(getPref(key) ?? '');
    input.addEventListener('change', () => {
      setPref(key, input.value.trim());
      loginStatus();
    });
  }
  for (const value of ['direct', 'bridge']) {
    const radio = $<HTMLInputElement>(`connection-${value}`);
    if (!radio) continue;
    radio.checked = readPrefs().connection === value;
    radio.addEventListener('change', () => {
      if (radio.checked) setPref('connection', value);
      sections();
    });
  }
  const auth = $<HTMLSelectElement>('bridgeAuth');
  if (auth) {
    auth.value = readPrefs().bridgeAuth;
    auth.addEventListener('change', () => {
      setPref('bridgeAuth', auth.value);
      sections();
    });
  }
  $('baseUrl-reset')?.addEventListener('click', () => {
    setPref('baseUrl', DEFAULT_BASE_URL);
    const input = $<HTMLInputElement>('baseUrl');
    if (input) input.value = DEFAULT_BASE_URL;
  });
  $('login')?.addEventListener('click', async () => {
    const p = readPrefs();
    const button = $<HTMLButtonElement>('login')!;
    button.disabled = true;
    loginStatus(t('prefs.loggingIn'));
    try {
      await oidc.login({ issuer: p.oidcIssuer, clientId: p.oidcClientId });
      loginStatus();
    } catch (e: any) {
      loginStatus(t('prefs.loginFailed', { message: e?.message || String(e) }));
    } finally {
      button.disabled = false;
    }
  });
  $('logout')?.addEventListener('click', () => {
    oidc.logout();
    loginStatus();
  });
  const relate = $<HTMLInputElement>('relateItems');
  if (relate) {
    relate.checked = getPref('relateItems') !== false;
    relate.addEventListener('change', () => setPref('relateItems', relate.checked));
  }
  sections();
}
