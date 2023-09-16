var SemanticZoteroOptions = {
    saveOptions: function() {
        let apiKey = document.getElementById('apiKey').value;
        let relateItems = document.getElementById('relateItemsCheckbox').checked;

        Zotero.Prefs.set('SemanticZotero.apiKey', apiKey);
        Zotero.Prefs.set('SemanticZotero.relateItems', relateItems);

        window.close();
    },

    cancel: function() {
        window.close();
    },

    loadOptions: function() {
        let apiKey = Zotero.Prefs.get('SemanticZotero.apiKey') || '';
		let relateItems = Zotero.Prefs.get('SemanticZotero.relateItems') === undefined ? true : Zotero.Prefs.get('SemanticZotero.relateItems');

        document.getElementById('apiKey').value = apiKey;
        document.getElementById('relateItemsCheckbox').checked = relateItems;
    }
}

window.onload = SemanticZoteroOptions.loadOptions;
