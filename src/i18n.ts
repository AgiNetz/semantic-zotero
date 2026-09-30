/**
 * UI strings of the windows and the settings pane (the context menu uses Fluent,
 * locale/<lang>/semanticzotero.ftl). English is the plugin's language, German a translation
 * of the same keys. The locale follows Zotero's UI language and can be forced with
 * the pref extensions.zotero.semanticzotero.locale ("en", "de").
 */

const EN = {
  'refs.title': 'References – {title}',
  'refs.loading': 'Loading references from Semantic Scholar …',
  'refs.none': 'Semantic Scholar lists no references for this item.',
  'refs.count': '{n} references',
  'refs.colTitle': 'Title',
  'refs.colAuthor': 'First author',
  'refs.colYear': 'Year',
  'refs.colPdf': 'PDF',
  'refs.colCitations': 'Citations',
  'refs.colAction': 'Action',
  'refs.yes': 'Yes',
  'refs.no': 'No',
  'refs.add': 'Add',
  'refs.added': 'Added',
  'refs.inLibrary': 'In library',
  'refs.notAvailable': 'Not available',
  'refs.authors': 'Authors: {authors}',
  'refs.abstract': 'Abstract',
  'refs.contexts': 'Citation contexts',
  'refs.etAl': 'et al.',
  'err.notFound': 'The item was not found on Semantic Scholar.',
  'err.forbidden': 'Semantic Scholar rejected the API key (403). Check it in the settings, or leave it empty.',
  'err.other': 'Semantic Scholar request failed: {message}',
  'err.readOnly': 'This library is read-only.',
  'add.title': 'Add reference',
  'add.collections': 'Collections',
  'add.tags': 'Tags',
  'add.noCollections': 'No collections in this library.',
  'add.noTags': 'No tags in this library.',
  'add.button': 'Add to Zotero',
  'add.cancel': 'Cancel',
  'add.adding': 'Adding …',
  'prefs.api': 'Semantic Scholar',
  'prefs.baseUrl': 'API address',
  'prefs.baseUrlHelp': 'Default: {url}. Behind the institute proxy, enter its address instead; the proxy adds the key.',
  'prefs.reset': 'Default',
  'prefs.apiKey': 'API key (optional)',
  'prefs.apiKeyHelp': 'A personal key from semanticscholar.org avoids the shared quota. It is stored in plain text in the Zotero profile.',
  'prefs.options': 'Options',
  'prefs.relateItems': 'Mark added references as related to the citing item',
  'prefs.privacy': 'Privacy: title, DOI, arXiv ID and URL of the selected item are sent to Semantic Scholar (Allen Institute for AI, USA) or to the proxy set above.',
};

export type Key = keyof typeof EN;

const DE: Record<Key, string> = {
  'refs.title': 'Referenzen – {title}',
  'refs.loading': 'Referenzen werden bei Semantic Scholar abgefragt …',
  'refs.none': 'Semantic Scholar kennt keine Referenzen zu diesem Eintrag.',
  'refs.count': '{n} Referenzen',
  'refs.colTitle': 'Titel',
  'refs.colAuthor': 'Erstautor/in',
  'refs.colYear': 'Jahr',
  'refs.colPdf': 'PDF',
  'refs.colCitations': 'Zitationen',
  'refs.colAction': 'Aktion',
  'refs.yes': 'Ja',
  'refs.no': 'Nein',
  'refs.add': 'Hinzufügen',
  'refs.added': 'Hinzugefügt',
  'refs.inLibrary': 'In der Bibliothek',
  'refs.notAvailable': 'Nicht verfügbar',
  'refs.authors': 'Autor/innen: {authors}',
  'refs.abstract': 'Zusammenfassung',
  'refs.contexts': 'Zitierkontexte',
  'refs.etAl': 'u. a.',
  'err.notFound': 'Der Eintrag wurde bei Semantic Scholar nicht gefunden.',
  'err.forbidden': 'Semantic Scholar lehnt den API-Key ab (403). Bitte in den Einstellungen prüfen oder leer lassen.',
  'err.other': 'Anfrage an Semantic Scholar fehlgeschlagen: {message}',
  'err.readOnly': 'Diese Bibliothek ist schreibgeschützt.',
  'add.title': 'Referenz hinzufügen',
  'add.collections': 'Sammlungen',
  'add.tags': 'Tags',
  'add.noCollections': 'Keine Sammlungen in dieser Bibliothek.',
  'add.noTags': 'Keine Tags in dieser Bibliothek.',
  'add.button': 'Zu Zotero hinzufügen',
  'add.cancel': 'Abbrechen',
  'add.adding': 'Wird hinzugefügt …',
  'prefs.api': 'Semantic Scholar',
  'prefs.baseUrl': 'API-Adresse',
  'prefs.baseUrlHelp': 'Standard: {url}. Hinter dem Instituts-Proxy dessen Adresse eintragen; der Proxy hängt den Key an.',
  'prefs.reset': 'Standard',
  'prefs.apiKey': 'API-Key (optional)',
  'prefs.apiKeyHelp': 'Ein persönlicher Key von semanticscholar.org umgeht das gemeinsame Kontingent. Er steht im Klartext im Zotero-Profil.',
  'prefs.options': 'Optionen',
  'prefs.relateItems': 'Hinzugefügte Referenzen mit dem zitierenden Eintrag verknüpfen',
  'prefs.privacy': 'Datenschutz: Titel, DOI, arXiv-ID und URL des ausgewählten Eintrags gehen an Semantic Scholar (Allen Institute for AI, USA) bzw. an den oben eingetragenen Proxy.',
};

let forced: 'en' | 'de' | null = null;

export function setLocale(locale: 'en' | 'de' | null): void {
  forced = locale;
}

export function currentLocale(): 'en' | 'de' {
  if (forced) return forced;
  let pref = '';
  let zotero = '';
  try {
    pref = String(Zotero.Prefs.get('semanticzotero.locale') || '');
    zotero = String(Zotero.locale || '');
  } catch {
    // unit tests: no Zotero
  }
  if (pref === 'de' || pref === 'en') return pref;
  return zotero.toLowerCase().startsWith('de') ? 'de' : 'en';
}

export function t(key: Key, params: Record<string, string | number> = {}): string {
  const table: Record<string, string> = currentLocale() === 'de' ? DE : EN;
  return (table[key] ?? EN[key]).replace(/\{(\w+)\}/g, (m, name) => (name in params ? String(params[name]) : m));
}
