async function populateDialog() {
    const subcollectionsDiv = document.getElementById("subcollections");
    const tagsDiv = document.getElementById("tags");

    // Fetch subcollections and tags from Zotero
	var zp = Zotero.getActiveZoteroPane();
    const subcollections = await Zotero.Collections.getByLibrary(zp.getSelectedLibraryID());
    const tags = await Zotero.Tags.getAll();

    // Populate subcollections
    for (let subcollection of subcollections) {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = subcollection.key;
        checkbox.id = "subcollection_" + subcollection.id;

        const label = document.createElement("label");
        label.htmlFor = checkbox.key;
        label.textContent = subcollection.name;

        subcollectionsDiv.appendChild(checkbox);
        subcollectionsDiv.appendChild(label);
        subcollectionsDiv.appendChild(document.createElement("br")); // New line
    }

    // Populate tags
    tags.forEach((tag, index) => {
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.value = tag.tag;
        checkbox.id = "tag_" + index;

        const label = document.createElement("label");
        label.htmlFor = checkbox.id;
        label.textContent = tag.tag;

        tagsDiv.appendChild(checkbox);
        tagsDiv.appendChild(label);
        tagsDiv.appendChild(document.createElement("br")); // New line
    });
}

async function onAddButtonClick() {
    const selectedTags = getSelectedTags();
    const selectedCollections = getSelectedCollections();

    const item = window.arguments[0];
	const reference = window.arguments[1];
	
	document.getElementById("statusMessage").style.display = "block";

	try {
		await addToCollection(reference, item, selectedCollections, selectedTags);
		window.opener.SemanticZotero.handleReferenceAdded(reference);
	} catch(error) {
		console.error("Failed to add item:", error);
        document.getElementById("statusMessage").innerText = error;
	}
    
    window.close();
}

function getSelectedTags() {
    const tagsDiv = document.getElementById("tags");
    const checkboxes = tagsDiv.querySelectorAll("input[type='checkbox']:checked");
    const selectedTags = Array.from(checkboxes).map(cb => cb.value);
    return selectedTags;
}

function getSelectedCollections() {
    const collectionsDiv = document.getElementById("subcollections");
    const checkboxes = collectionsDiv.querySelectorAll("input[type='checkbox']:checked");
    const selectedCollections = Array.from(checkboxes).map(cb => cb.value);
    return selectedCollections;
}

async function addToCollection(reference, item, selectedCollections, selectedTags) {
	var newItem = new Zotero.Item('preprint');
	var arxivID = reference.externalIds ? reference.externalIds["ArXiv"] : null;
	var pdfUrl = undefined;
	if(arxivID) {
		pdfUrl = "https://arxiv.org/pdf/" + arxivID + '.pdf';
	} else if(reference.isOpenAccess) {
		pdfUrl = reference.openAccessPdf.url;
	}
	// Set fields for the item using the provided reference data
	newItem.setField('title', reference.title);
	newItem.setField('date', reference.publicationDate || reference.year);
	newItem.setField('abstractNote', reference.abstract);
	if (arxivID) {
		newItem.setField('repository', "arXiv");
		newItem.setField('archiveID', "arXiv:" + arxivID);
	}
	newItem.setField('url', reference.url);

	// Set authors
	if (reference.authors && reference.authors.length) {
		let creators = reference.authors.map(author => ({ firstName: author.name.split(' ').slice(0, -1).join(' '), lastName: author.name.split(' ').slice(-1).join(' '), creatorType: "author" }));
		newItem.setCreators(creators);
	}
	
	// Once the paper is added, add tags
    for (let tag of selectedTags) {
        newItem.addTag(tag);
    }
	
	newItem.setCollections(selectedCollections);

	// Save the new item to the database
	await newItem.saveTx();
	
	//Make items related
	let relateItems = Zotero.Prefs.get('SemanticZotero.relateItems') === undefined ? true : Zotero.Prefs.get('SemanticZotero.relateItems');
    if (relateItems) {
		item.addRelatedItem(newItem);
		await item.saveTx();
		
		newItem.addRelatedItem(item);
		await newItem.saveTx();
    }

	// Attach the PDF if available
	if (pdfUrl) {
		var zp = Zotero.getActiveZoteroPane();
		var libraryID = zp.getSelectedLibraryID();
		await Zotero.Attachments.importFromURL({
			url: pdfUrl,
			parentItemID: newItem.id,
			contentType: 'application/pdf',
			libraryID: libraryID
		});
	}
	return newItem;
}

document.getElementById("addButton").addEventListener("click", onAddButtonClick);


window.onload = function() {
    populateDialog();
};
