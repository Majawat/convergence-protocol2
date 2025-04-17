/**
 * @fileoverview Logic for the Rules Reference page.
 * Handles fetching and displaying Random Events and Doctrines.
 * Initializes definition popovers.
 */

// *** MODIFIED Imports ***
import {
  loadRandomEventsData,
  loadDoctrinesData,
  loadGameData, // <-- IMPORT loadGameData
} from "./dataLoader.js";
import { showToast } from "./uiHelpers.js";
import { UI_ICONS, config } from "./config.js"; // <-- IMPORT config if needed by loadGameData implicitly
import { initializeDefinitionsSystem } from "./definitions.js";
// import { getCampaignData } from "./state.js"; // <-- Probably don't need campaignData here directly

// --- UI Element References ---
// (Keep existing code here)
let randomEventsDisplayElement;
let doctrinesDisplayElement;
let glossaryContentDisplayElement;

// --- Functions ---
// (Keep existing initializeUIReferences, formatTextToParagraphs, renderHTML, displayRandomEvents, displayDoctrines here)
// ... (previous functions) ...

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  randomEventsDisplayElement = document.getElementById("random-events-display");
  doctrinesDisplayElement = document.getElementById("doctrines-display");
  glossaryContentDisplayElement = document.getElementById(
    "glossary-content-display"
  );
}

/** Formats text to paragraphs */
function formatTextToParagraphs(text = "") {
  if (!text) return "";
  const sanitizedText = text.replace(/<script.*?>.*?<\/script>/gi, "");
  let paragraphs = sanitizedText.split("\n\n");
  if (paragraphs.length <= 1) {
    paragraphs = sanitizedText.split("\n");
  }
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${renderHTML(paragraph)}</p>`)
    .join("");
}

/** Safely renders HTML */
function renderHTML(content) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content || "";
  tempDiv.querySelectorAll("script").forEach((script) => script.remove());
  return tempDiv.innerHTML;
}

/** Renders Random Events */
function displayRandomEvents(eventsData) {
  if (!randomEventsDisplayElement) {
    console.error("Random Events display element not found.");
    return;
  }
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
  if (!doctrinesDisplayElement) {
    console.error("Doctrines display element not found.");
    return;
  }
  // Use the passed-in data
  if (
    !doctrinesData ||
    !Array.isArray(doctrinesData.doctrines) ||
    doctrinesData.doctrines.length === 0
  ) {
    // Display error if data is invalid/null after loading attempt
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

// --- Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Rules JS loaded.");
  initializeUIReferences();

  try {
    // --- MODIFIED Data Loading ---
    // Note: loadGameData needs campaignData. If campaignData isn't loaded globally
    // before this script runs, you might need to load it first or pass null/empty.
    // Assuming campaignData might not be strictly needed just for definitions caching part:
    const dummyCampaignDataForDefinitions = { armies: [] }; // Pass dummy data if books aren't needed

    // Fetch essential data concurrently
    const eventsDataPromise = loadRandomEventsData();
    const doctrinesDataPromise = loadDoctrinesData(); // Uses its own cache
    // ** ADDED **: Ensure definitions are loaded/cached
    const definitionsLoadPromise = loadGameData(
      dummyCampaignDataForDefinitions
    ); // Uses sessionStorage for definitions

    // Wait for all necessary data
    // We specifically need definitionsLoadPromise to finish before initializing popovers.
    const [eventsData, doctrinesData, gameDataResult] = await Promise.all([
      eventsDataPromise,
      doctrinesDataPromise,
      definitionsLoadPromise,
    ]);

    // Display dynamic sections using the fetched/cached data
    displayRandomEvents(eventsData);
    displayDoctrines(doctrinesData);
    initializeDefinitionsSystem();

  } catch (error) {
    console.error("Error loading rules page data:", error);
    showToast("Failed to load some rules data.", "Error");
    // Update specific display areas if possible
    if (
      randomEventsDisplayElement &&
      !randomEventsDisplayElement.innerHTML.includes("card")
    ) {
      // Check if not already populated
      randomEventsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading random events. Check console.</div>`;
    }
    if (
      doctrinesDisplayElement &&
      !doctrinesDisplayElement.innerHTML.includes("card")
    ) {
      // Check if not already populated
      doctrinesDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading doctrines. Check console.</div>`;
    }
  }
});
