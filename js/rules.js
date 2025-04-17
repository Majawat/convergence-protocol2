/**
 * @fileoverview Logic for the Rules Reference page.
 * Handles fetching and displaying Random Events, Doctrines, and a searchable Glossary.
 * Initializes definition popovers.
 */

import {
  loadRandomEventsData,
  loadDoctrinesData,
  loadGameData,
  loadCampaignData,
} from "./dataLoader.js";
import { showToast } from "./uiHelpers.js";
import { config } from "./config.js";
import { initializeDefinitionsSystem } from "./definitions.js";
import { getDefinitions } from "./state.js";

// --- UI Element References ---
let randomEventsDisplayElement;
let doctrinesDisplayElement;
let glossarySearchInput;
let glossaryItemsContainer;
let glossaryNoResultsElement;

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  randomEventsDisplayElement = document.getElementById("random-events-display");
  doctrinesDisplayElement = document.getElementById("doctrines-display");
  glossarySearchInput = document.getElementById("glossary-search");
  glossaryItemsContainer = document.getElementById("glossary-items-container");
  glossaryNoResultsElement = document.getElementById("glossary-no-results");

  if (!randomEventsDisplayElement)
    console.error("Element #random-events-display not found.");
  if (!doctrinesDisplayElement)
    console.error("Element #doctrines-display not found.");
  if (!glossarySearchInput)
    console.error("Element #glossary-search not found.");
  if (!glossaryItemsContainer)
    console.error("Element #glossary-items-container not found.");
  if (!glossaryNoResultsElement)
    console.error("Element #glossary-no-results not found.");
}

// --- Utility Functions ---

/** Basic HTML escaping function. */
function escapeHtml(unsafe) {
  if (typeof unsafe !== "string") return "";
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/** Formats text block into HTML paragraphs. */
function formatTextToParagraphs(text = "") {
  if (!text) return "";
  const sanitizedText = text
    .toString()
    .replace(/<script.*?>.*?<\/script>/gi, "");
  let paragraphs = sanitizedText.split("\n\n");
  if (paragraphs.length <= 1 && sanitizedText.includes("\n")) {
    paragraphs = sanitizedText.split("\n");
  }
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p class="mb-2">${renderHTML(paragraph)}</p>`)
    .join("");
}

/** Safely renders potentially unsafe HTML content. */
function renderHTML(content) {
  if (typeof content !== "string") return "";
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content || "";
  tempDiv.querySelectorAll("script").forEach((script) => script.remove());
  return tempDiv.innerHTML;
}

// --- UI Rendering Functions ---

/** Renders Random Events */
function displayRandomEvents(eventsData) {
  // ... (function content remains the same) ...
  if (!randomEventsDisplayElement) return; // Already checked in init
  if (
    !eventsData ||
    !Array.isArray(eventsData.events) ||
    eventsData.events.length === 0
  ) {
    randomEventsDisplayElement.innerHTML = `<div class="alert alert-warning" role="alert">Could not load or find random events data.</div>`;
    return;
  }
  const events = eventsData.events;
  events.sort((a, b) => (a.id || "").localeCompare(b.id || ""));
  let gridHTML = '<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">';
  events.forEach((event) => {
    const formattedEffect = event.effect
      ? formatTextToParagraphs(event.effect)
      : "";
    gridHTML += `
            <div class="col d-flex align-items-stretch">
                <div class="card event-card shadow-sm w-100">
                    <div class="card-header">
                       <span class="badge bg-secondary me-2">${renderHTML(
                         event.id
                       )}</span> ${renderHTML(event.title)}
                    </div>
                    <div class="card-body d-flex flex-column">
                        <p class="text-muted fst-italic mb-2">${renderHTML(
                          event.description
                        )}</p>
                        ${
                          formattedEffect
                            ? `<div class="effect-section allow-definitions"><strong>Effect:</strong> ${formattedEffect}</div>`
                            : ""
                        }
                    </div>
                </div>
            </div>
        `;
  });
  gridHTML += "</div>";
  randomEventsDisplayElement.innerHTML = gridHTML;
}

/** Renders Doctrines and Stratagems */
function displayDoctrines(doctrinesData) {
  // ... (function content remains the same) ...
  if (!doctrinesDisplayElement) return; // Already checked in init
  if (
    !doctrinesData ||
    !Array.isArray(doctrinesData.doctrines) ||
    doctrinesData.doctrines.length === 0
  ) {
    doctrinesDisplayElement.innerHTML = `<div class="alert alert-warning" role="alert">Could not load or find doctrines data.</div>`;
    return;
  }

  let doctrinesHTML = "";
  const universalDoctrine = doctrinesData.doctrines.find(
    (d) => d.id === "universal"
  );
  const selectableDoctrines = doctrinesData.doctrines.filter(
    (d) => d.id !== "universal"
  );

  const createStratagemListHTML = (doctrine) => {
    if (!doctrine || !doctrine.stratagems || doctrine.stratagems.length === 0) {
      return `<p class="text-muted small mb-0">No stratagems listed.</p>`;
    }
    let listHTML = '<ul class="list-group list-group-flush">';
    doctrine.stratagems.forEach((strat) => {
      const cost = strat.cost || 0;
      const stratName = strat.name || "Unnamed Stratagem";
      const stratDesc = strat.description || "No description available.";
      listHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-start flex-wrap px-0 py-1">
                    <div class="me-auto">
                        <strong>${renderHTML(stratName)}</strong>
                        <small class="d-block text-muted allow-definitions">${renderHTML(
                          stratDesc
                        )}</small>
                    </div>
                    <div class="stratagem-actions d-flex align-items-center gap-2">
                        <span class="badge bg-warning text-dark rounded-pill" title="Command Point Cost">${cost} CP</span>
                    </div>
                </li>
                `;
    });
    listHTML += "</ul>";
    return listHTML;
  };

  if (universalDoctrine) {
    doctrinesHTML += `
            <div class="rule-subsection mb-3">
                <h5><i class="bi bi-infinity me-1"></i> Universal Doctrine</h5>
                ${createStratagemListHTML(universalDoctrine)}
            </div>
            `;
  } else {
    doctrinesHTML +=
      '<p class="text-warning">Universal doctrine data not found.</p>';
  }

  doctrinesHTML += '<h4 class="mt-4">Selectable Doctrines</h4>';
  doctrinesHTML +=
    "<p>Choose ONE of the following Doctrines before the game begins:</p>";
  doctrinesHTML += '<div class="row row-cols-1 row-cols-md-2 g-3">';

  selectableDoctrines.forEach((doctrine) => {
    const iconClass = doctrine.icon || "bi-question-circle-fill";
    const iconHTML = `<i class="bi ${iconClass} me-1"></i>`;
    const cardHeaderBg = doctrine.color
      ? `bg-${doctrine.color}-subtle`
      : "bg-secondary-subtle";

    doctrinesHTML += `
                <div class="col d-flex">
                    <div class="card h-100 doctrine-card shadow-sm w-100">
                        <div class="card-header ${cardHeaderBg}">
                            <h5 class="mb-0">${iconHTML} ${renderHTML(
      doctrine.name
    )}</h5>
                        </div>
                        <div class="card-body">
                            ${createStratagemListHTML(doctrine)}
                        </div>
                    </div>
                </div>
                `;
  });

  doctrinesHTML += "</div>";
  doctrinesDisplayElement.innerHTML = doctrinesHTML;
}

// --- Glossary Functions ---

/**
 * Renders the glossary items into the container using a footer for metadata.
 * @param {object} defs - The definitions object from state.
 * @param {HTMLElement} container - The container element for glossary items.
 */
function renderGlossary(defs, container) {
  // Renamed from previous version
  if (!defs || !container) return;

  const terms = Object.keys(defs).sort((a, b) => a.localeCompare(b));
  let html = "";

  if (terms.length === 0) {
    container.innerHTML = '<p class="text-muted">No definitions loaded.</p>';
    return;
  }

  terms.forEach((term) => {
    const definition = defs[term];
    if (
      !definition ||
      !definition.description ||
      !Array.isArray(definition.sources)
    )
      return;

    const lowerTerm = escapeHtml((term || "").toLowerCase());
    const lowerDescriptionAndSources = escapeHtml(
      `${(definition.description || "").toLowerCase()} ${definition.sources
        .join(" ")
        .toLowerCase()}`
    );

    // Generate source badges HTML
    let sourceBadges = "";
    if (definition.sources && definition.sources.length > 0) {
      sourceBadges = definition.sources
        .map((source) => {
          let badgeClass =
            "bg-secondary-subtle border-secondary-subtle text-secondary-emphasis"; // Default
          if (source === "Common") {
            badgeClass =
              "bg-primary-subtle border-primary-subtle text-primary-emphasis";
          } else if (source === "Custom") {
            badgeClass =
              "bg-success-subtle border-success-subtle text-success-emphasis";
          }
          // Add margin-bottom for wrapping behavior if needed in footer
          return `<span class="badge ${badgeClass} border rounded-pill me-1 small">${escapeHtml(
            source
          )}</span>`;
        })
        .join("");
    }

    // Generate type badge HTML
    const typeBadge = definition.type
      ? `<span class="badge bg-info-subtle border border-info-subtle text-info-emphasis rounded-pill me-1 small">${escapeHtml(
          definition.type
        )}</span>`
      : "";

    // --- Card Structure with Footer ---
    html += `
        <div class="col glossary-item" data-term="${lowerTerm}" data-description="${lowerDescriptionAndSources}">
            <div class="card h-100 shadow-sm glossary-card">
                <div class="card-header p-2">
                    <h6 class="mb-0 glossary-term">${escapeHtml(term)}</h6>
                </div>
                <div class="card-body p-2 glossary-description small allow-definitions">
                    ${formatTextToParagraphs(definition.description)}
                </div>
                <div class="card-footer p-1 small text-muted d-flex flex-wrap align-items-center">
                    ${typeBadge} ${sourceBadges}
                </div>
            </div>
        </div>`;
  });

  container.innerHTML = html;
  console.log(`Rendered ${terms.length} glossary items.`);
}

/** Filters the glossary items based on the search query. */
function filterGlossary(query, container, noResultsEl) {
  // ... (function content remains the same) ...
  if (!container || !noResultsEl) return;

  const lowerQuery = query.toLowerCase().trim();
  const items = container.querySelectorAll(".glossary-item");
  let visibleCount = 0;

  items.forEach((item) => {
    // Check term and the combined description/sources data attribute
    const term = item.dataset.term || "";
    const descriptionAndSources = item.dataset.description || "";
    const isMatch =
      lowerQuery === "" ||
      term.includes(lowerQuery) ||
      descriptionAndSources.includes(lowerQuery);

    item.classList.toggle("d-none", !isMatch); // Hide if not a match
    if (isMatch) {
      visibleCount++;
    }
  });

  // Toggle the 'no results' message
  noResultsEl.classList.toggle("d-none", visibleCount > 0 || lowerQuery === "");
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  // ... (Initialization logic remains the same) ...
  console.log("Rules JS loaded.");
  initializeUIReferences(); // Get references to DOM elements

  // Check if essential elements are found before proceeding
  if (
    !randomEventsDisplayElement ||
    !doctrinesDisplayElement ||
    !glossaryItemsContainer ||
    !glossarySearchInput ||
    !glossaryNoResultsElement
  ) {
    console.error(
      "One or more essential UI elements for rules page not found. Aborting initialization."
    );
    showToast("Error initializing rules page UI.", "Error");
    return;
  }

  try {
    // --- Load campaign data first ---
    console.log("Loading campaign data for rules page...");
    const campaignData = await loadCampaignData();
    if (!campaignData) {
      console.warn(
        "Failed to load campaign data. Definitions might be incomplete."
      );
    }

    // Fetch other essential data concurrently, passing REAL campaign data
    const eventsDataPromise = loadRandomEventsData();
    const doctrinesDataPromise = loadDoctrinesData(); // Uses its own cache
    const definitionsLoadPromise = loadGameData(campaignData || { armies: [] }); // Pass loaded data or fallback

    // Wait for all necessary data
    const [eventsData, doctrinesData, gameDataResult] = await Promise.all([
      eventsDataPromise,
      doctrinesDataPromise,
      definitionsLoadPromise, // Make sure definitions are loaded/cached fully
    ]);

    // Display dynamic sections
    displayRandomEvents(eventsData);
    displayDoctrines(doctrinesData);

    // --- Glossary Initialization ---
    const definitions = getDefinitions(); // Get definitions AFTER loadGameData has run
    renderGlossary(definitions, glossaryItemsContainer); // Render the initial glossary list

    // Add search listener AFTER rendering
    glossarySearchInput.addEventListener("input", () => {
      filterGlossary(
        glossarySearchInput.value,
        glossaryItemsContainer,
        glossaryNoResultsElement
      );
    });

    // Initialize popovers on the whole page AFTER dynamic content (including glossary) is rendered
    initializeDefinitionsSystem();
  } catch (error) {
    console.error("Error loading rules page data:", error);
    showToast("Failed to load some rules data.", "Error");
    if (
      randomEventsDisplayElement &&
      !randomEventsDisplayElement.innerHTML.includes("card")
    ) {
      randomEventsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading random events. Check console.</div>`;
    }
    if (
      doctrinesDisplayElement &&
      !doctrinesDisplayElement.innerHTML.includes("card")
    ) {
      doctrinesDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading doctrines. Check console.</div>`;
    }
    if (
      glossaryItemsContainer &&
      !glossaryItemsContainer.innerHTML.includes("card")
    ) {
      glossaryItemsContainer.innerHTML = `<div class="alert alert-danger" role="alert">Error loading glossary. Check console.</div>`;
    }
  }
});
