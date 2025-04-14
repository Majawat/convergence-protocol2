/**
 * @fileoverview Logic for the Rules Reference page.
 * Handles fetching and displaying Random Events and Doctrines.
 */

// *** UPDATED: Import loadDoctrinesData ***
import { loadRandomEventsData, loadDoctrinesData } from "./dataLoader.js";
import { showToast } from "./uiHelpers.js";
// *** NEW: Import UI_ICONS for doctrine headers ***
import { UI_ICONS } from "./config.js";

// --- UI Element References ---
let randomEventsDisplayElement;
// *** NEW: Reference for doctrines display ***
let doctrinesDisplayElement;

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  randomEventsDisplayElement = document.getElementById("random-events-display");
  // *** NEW: Get doctrines display element ***
  doctrinesDisplayElement = document.getElementById("doctrines-display");
}

// --- UI Rendering Functions ---

/**
 * Formats a block of text into HTML paragraphs based on newline characters.
 * Prefers double newlines, falls back to single newlines.
 * @param {string} text - The text to format.
 * @returns {string} HTML string with paragraphs.
 */
function formatTextToParagraphs(text = "") {
  if (!text) return "";
  // Basic sanitization: remove script tags
  const sanitizedText = text.replace(/<script.*?>.*?<\/script>/gi, "");

  // Prefer splitting by double newline, then single newline
  let paragraphs = sanitizedText.split("\n\n");
  if (paragraphs.length <= 1) {
    paragraphs = sanitizedText.split("\n");
  }

  // Filter empty lines and wrap in <p> tags
  return (
    paragraphs
      .map((paragraph) => paragraph.trim())
      .filter((paragraph) => paragraph.length > 0)
      // Render potential HTML within paragraphs safely
      .map((paragraph) => `<p>${renderHTML(paragraph)}</p>`)
      .join("")
  );
}

/**
 * Helper to safely render potentially HTML content within text.
 * Currently just returns the text, but could be expanded for sanitization.
 * @param {string} content - Text content, potentially containing HTML.
 * @returns {string} Sanitized or original HTML string.
 */
function renderHTML(content) {
  // More robust sanitization could be added here if needed
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content || "";
  tempDiv.querySelectorAll("script").forEach((script) => script.remove());
  return tempDiv.innerHTML;
}

/**
 * Renders the Random Events as a grid of cards.
 * @param {object | null} eventsData - The loaded random events data.
 */
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

  // Sort events by ID
  events.sort((a, b) => (a.id || "").localeCompare(b.id || ""));

  // Start Bootstrap row for the grid
  let gridHTML = '<div class="row row-cols-1 row-cols-md-2 row-cols-lg-3 g-3">';

  events.forEach((event) => {
    // Format the effect text into paragraphs using newlines in the JSON
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
                            ? `<div class="effect-section"><strong>Effect:</strong> ${formattedEffect}</div>`
                            : ""
                        }
                    </div>
                </div>
            </div>
        `;
  });

  gridHTML += "</div>"; // End row

  randomEventsDisplayElement.innerHTML = gridHTML;
}

/**
 * *** NEW FUNCTION ***
 * Renders the Doctrines and Stratagems into the designated display area.
 * @param {object | null} doctrinesData - The loaded doctrines data.
 */
function displayDoctrines(doctrinesData) {
  if (!doctrinesDisplayElement) {
    console.error("Doctrines display element not found.");
    return;
  }

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

  // Helper function to create HTML for a list of stratagems
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
                    <small class="d-block text-muted">${renderHTML(
                      stratDesc
                    )}</small>
                </div>
                <div class="stratagem-actions d-flex align-items-center gap-2"> <span class="badge bg-warning text-dark rounded-pill" title="Command Point Cost">${cost} CP</span>
                </div>
            </li>
            `;
    });
    listHTML += "</ul>";
    return listHTML;
  };

  // Render Universal Doctrine
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

  // Render Selectable Doctrines
  doctrinesHTML += '<h4 class="mt-4">Selectable Doctrines</h4>';
  doctrinesHTML +=
    "<p>Choose ONE of the following Doctrines before the game begins:</p>";
  doctrinesHTML += '<div class="row row-cols-1 row-cols-md-2 g-3">'; // Start grid

  selectableDoctrines.forEach((doctrine) => {
    // Use the icon name from JSON to find the icon HTML in UI_ICONS
    const iconHTML =
      `<i class="bi ${doctrine.icon} me-1"></i>` ||
      `<i class="bi bi-question-circle-fill me-1"></i>`; // Fallback icon
    const cardHeaderBg = doctrine.color
      ? `bg-${doctrine.color}-subtle`
      : "bg-secondary-subtle"; // Use color for background

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

  doctrinesHTML += "</div>"; // End grid

  doctrinesDisplayElement.innerHTML = doctrinesHTML;
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Rules JS loaded.");
  initializeUIReferences();

  // Load both Random Events and Doctrines in parallel
  try {
    const [eventsData, doctrinesData] = await Promise.all([
      loadRandomEventsData(),
      loadDoctrinesData(), // Fetch doctrines
    ]);

    // Display Random Events
    displayRandomEvents(eventsData);

    // Display Doctrines ***
    displayDoctrines(doctrinesData);
  } catch (error) {
    // This catch block might be less useful now if individual loaders handle errors,
    // but keep it as a fallback.
    console.error("Error loading rules page data:", error);
    showToast("Failed to load some rules data.", "Error");
    if (randomEventsDisplayElement) {
      randomEventsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading random events. Check console.</div>`;
    }
    if (doctrinesDisplayElement) {
      doctrinesDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading doctrines. Check console.</div>`;
    }
  }
});
