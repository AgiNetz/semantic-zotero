var SemanticZotero = {
    APIError: class extends Error {
		constructor(statusCode, statusMessage) {
			super(`Status: ${statusCode}, Message: ${statusMessage}`);
			this.statusCode = statusCode;
			this.statusMessage = statusMessage;
		}
	},
	
	determineItemId: function(item) {
		let id;

		id = this.getItemIdFromUrl(item);
		if (id) return id;

		id = this.getItemIdFromArxiv(item);
		if (id) return id;

		return this.getItemIdFromDOI(item);
	},
	
	getItemIdFromUrl: function(item) {
		const url = item.getField('url');
		const validUrls = ["semanticscholar.org", "arxiv.org", "aclweb.org", "acm.org", "biorxiv.org"];
		if (url && validUrls.some(v => url.includes(v))) {
			return "URL:" + url;
		}
		return null;
	},

	getItemIdFromArxiv: function(item) {
		if (item.getField('repository').toLowerCase() === "arxiv" && item.getField('archiveID')) {
			return item.getField('archiveID');
		}
		return null;
	},

	getItemIdFromDOI: function(item) {
		let doi = item.getField('DOI');
		return doi ? "DOI:" + doi : null;
	},
	
	getS2ApiRequestHeaders: function() {
		let apiKey = Zotero.Prefs.get('SemanticZotero.apiKey');
		if (apiKey) {
			return { 'x-api-key': apiKey }
		} else {
			return {}
		}
	},

	getItemIdFromTitleSearch: async function(item) {
		const title = item.getField('title');
		const results = await this.searchSemanticScholarByTitle(title);
		if (results[0] && results[0].title.toLowerCase() === title.toLowerCase()) {
			return results[0].paperId;
		}
		return null;
	},

	searchSemanticScholarByTitle: async function(title) {
		const apiEndpoint = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(title)}&limit=1`;
		let response = await fetch(apiEndpoint, {
			method: 'GET',
			headers: this.getS2ApiRequestHeaders()
		});

		if (!response.ok) {
			throw new this.APIError(response.status, response.statusText);
		}

		let data = await response.json();
		return data.data;
	},
	
    showReferences: async function() {
		let width = screen.width * 0.75;
		let height = screen.height * 0.75;
		var win = window.open("chrome://semanticZotero/content/references.html", "references", `chrome,centerscreen,resizable,scrollbars,width=${width},height=${height}`);
		this.refWindow = win;
        
        if (ZoteroPane.canEdit()) {
            let items = ZoteroPane.getSelectedItems();
            if (items.length > 0) {
				let item = items[0];
				let id = this.determineItemId(item);
				let references = null;
				
				try {
					references = await this.fetchReferences(id);
				} catch (error) {
					if (error instanceof this.APIError) {
						if (error.statusCode == 404) {
							//If something goes wrong with id from metadata, fall back to search by title
							try {
								id = await this.getItemIdFromTitleSearch(item);
								if (id) {
									references = await this.fetchReferences(id);
								} else {
									alert("Couldn't find the selected paper on SemanticScholar.");
								}
							} catch (nestedError) {
								alert("Unknown internal error occured.");
								console.error("Failed to fetch references: " + nestedError.message);
							}
						} else if(error.statusCode == 403) {
							alert("Provided Semantic Scholar key is invalid. If you do not have a key, you can leave the option empty");
							console.error(error);
						}
					} else {
						console.error("Unknown error fetching references: " + error.message);
						alert("Unknown internal error occured.");
					}
				}
				if (references) {
					await this.populateReferences(win, item, references);
				} else {
					win.close();
					return;
				}
            }
        }
    },

    fetchReferences: async function(id) {
        var apiUrl = "https://api.semanticscholar.org/graph/v1/paper/" + id + "/references";
		apiUrl += "?limit=1000&fields=title,publicationDate,year,abstract,url,externalIds,authors,isOpenAccess,openAccessPdf,citationCount,contexts";

		let response = await fetch(apiUrl, {
			method: 'GET',
			headers: this.getS2ApiRequestHeaders()
		});

		if (!response.ok) {
			throw new this.APIError(response.status, response.statusText);
		}

		let data = await response.json();
		return data["data"].map((item) => {
			item["citedPaper"].contexts = item.contexts;
			return item["citedPaper"];
		});
    },
	
	buildLibraryMap: async function() {
		var libraryTitleMap = {};
		var items = await Zotero.Items.getAll(ZoteroPane.getSelectedLibraryID());
		for (let item of items) {
			if (item.isRegularItem() && !item.isCollection()) {
				let title = item.getField('title').toLowerCase();
				libraryTitleMap[title] = true;
			}
		}
		return libraryTitleMap;
	},

	populateReferences: async function(win, item, references) {
		var rootDiv = win.document.getElementById("rootDiv");
		
		while (rootDiv.firstChild) {
			rootDiv.removeChild(rootDiv.firstChild);
		}
		
		var libraryTitleMap = await this.buildLibraryMap();

		for(let reference of references) {
			let isInCollection = libraryTitleMap[reference.title.toLowerCase()] ? true : false;

			// Create an HTML details element for each reference
			let referenceDetails = win.document.createElement("details");
			referenceDetails.className = "reference";
			referenceDetails.setAttribute("id", "reference-det-" + reference.paperId);
			
			let summary = win.document.createElement("summary");

			// Title
			let titleDiv = win.document.createElement("div");
			titleDiv.className = "summary-content reference-title";
			titleDiv.textContent = reference.title;
			summary.appendChild(titleDiv);
			
			// First Author
			let firstAuthorDiv = win.document.createElement("div");
			firstAuthorDiv.className = "summary-content reference-first-author";
			if (reference.authors && reference.authors.length > 0) {
				firstAuthorDiv.textContent = reference.authors[0].name;
				if (reference.authors.length > 1) {
					firstAuthorDiv.textContent += " et al.";
				}
			}
			summary.appendChild(firstAuthorDiv);
			
			// Publication Year
			let pubYearDiv = win.document.createElement("div");
			pubYearDiv.className = "summary-content reference-year";
			if (reference.year) {
				pubYearDiv.textContent = reference.year;
			} else {
				pubYearDiv.textContent = "-";
			}
			summary.appendChild(pubYearDiv);
			
			// PDF available
			let pdfAvailableDiv = win.document.createElement("div");
			pdfAvailableDiv.className = "summary-content reference-pdf";
			var arxivID = reference.externalIds ? reference.externalIds["ArXiv"] : null;
			var pdfUrl = undefined;
			if(arxivID) {
				pdfUrl = "https://arxiv.org/pdf/" + arxivID + '.pdf';
			} else if(reference.isOpenAccess) {
				pdfUrl = reference.openAccessPdf.url;
			}
			if (pdfUrl) {
				pdfAvailableDiv.textContent = "Yes";
			} else {
				pdfAvailableDiv.textContent = "No";
			}
			summary.appendChild(pdfAvailableDiv);
			
			// Citation count
			let citationCountDiv = win.document.createElement("div");
			citationCountDiv.className = "summary-content citation-count";
			citationCountDiv.textContent = reference.citationCount;
			summary.appendChild(citationCountDiv);
			
			
			//Action
			let actionDiv = win.document.createElement("div");
			actionDiv.className = "summary-content action-box";
			
			if (reference.paperId === null) {
				actionDiv.textContent = "Not available";
				summary.style.opacity = "0.5"; 
				summary.style.pointerEvents = "none";
			} else if (!isInCollection) {
				let addButton = win.document.createElement("button");
				addButton.textContent = "Add";
				addButton.addEventListener('click', (event) => {
					event.stopPropagation();
					this.showAddPaperDialog(item, reference)
				});
				actionDiv.appendChild(addButton);
			} else {
				let statusSpan = win.document.createElement("span");
				statusSpan.textContent = "Already in Collection";
				actionDiv.appendChild(statusSpan);
			}

			summary.appendChild(actionDiv);

			referenceDetails.appendChild(summary);

			// Details when clicked
			let detailsDiv = win.document.createElement("div");
			detailsDiv.className = "reference-details";
			
			// Authors in detail
			let authorsDiv = win.document.createElement("div");
			if (reference.authors && reference.authors.length > 0) {
				let displayedAuthors = reference.authors.slice(0, 5).map(a => a.name).join(', ');
				if (reference.authors.length > 5) {
					displayedAuthors += ', et al.';
				}
				authorsDiv.textContent = `Authors: ${displayedAuthors}`;
			} else {
				authorsDiv.textContent = "Authors: Not available";
			}
			detailsDiv.appendChild(authorsDiv);

			// Abstract
			let abstractDiv = win.document.createElement("div");
			
			let abstractTitle = win.document.createElement("h4");
			abstractTitle.textContent = "Abstract:";
			abstractDiv.appendChild(abstractTitle);
			
			let abstractContent = win.document.createElement("p");
			abstractContent.textContent = reference.abstract;
			abstractDiv.appendChild(abstractContent);
			
			detailsDiv.appendChild(abstractDiv);
			
			// Citation contexts
			let citationContextsDiv = win.document.createElement("div");
			citationContextsDiv.className = "citation-contexts";

			let citationContextsTitle = win.document.createElement("h4");
			citationContextsTitle.textContent = "Citation Contexts:";
			citationContextsDiv.appendChild(citationContextsTitle);

			if (reference.contexts && reference.contexts.length > 0) {
				let citationContextsList = win.document.createElement("ul");
				
				for (let context of reference.contexts) {
					let listItem = win.document.createElement("li");
					listItem.textContent = context;
					citationContextsList.appendChild(listItem);
				}
				
				citationContextsDiv.appendChild(citationContextsList);
			} else {
				let notAvailableText = win.document.createElement("p");
				notAvailableText.textContent = "Not available";
				citationContextsDiv.appendChild(notAvailableText);
			}

			detailsDiv.appendChild(citationContextsDiv);

			referenceDetails.appendChild(detailsDiv);
			rootDiv.appendChild(referenceDetails);
		}
	},
	
	showAddPaperDialog: function(item, reference) {
		const features = "width=500,height=400,scrollbars=yes,resizable=yes";
		const win = window.openDialog("chrome://semanticZotero/content/addPaperDialog.html", "Add Paper", features, item, reference);
	},
	
	handleReferenceAdded: function(reference) {
		// Locate the corresponding reference in the view
		const referenceElement = this.refWindow.document.getElementById("reference-det-" + reference.paperId);
		if (referenceElement) {
			const addButton = referenceElement.querySelector("button");
			if (addButton) {
				addButton.textContent = "Added to collection";
				addButton.disabled = true;
			}
		}
	}
};