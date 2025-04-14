/**
 * @fileoverview Logic for the Rules Reference page.
 * Handles fetching and displaying Random Events and Doctrines.
 * Initializes definition popovers.
 */

// *** UPDATED: Removed loadDoctrinesData import ***
import { loadRandomEventsData } from "./dataLoader.js";
import { showToast } from "./uiHelpers.js";
import { initializeDefinitionsSystem } from "./definitions.js";
import { getDoctrinesData } from "./state.js";

// --- UI Element References ---
let randomEventsDisplayElement;
let doctrinesDisplayElement;
let glossaryContentDisplayElement;

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

// --- UI Rendering Functions ---

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
                        <p class="text-muted fst-italic mb-2 allow-definitions">${renderHTML(
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
  // Use the passed-in data (which comes from getDoctrinesData in the state)
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

// --- Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Rules JS loaded.");
  initializeUIReferences();

  try {
    // Load data first
    // Definitions are assumed to be loaded into state by app.js calling loadGameData
    const eventsDataPromise = loadRandomEventsData();
    const doctrinesData = getDoctrinesData(); // Get doctrines from state

    // Display static/state-dependent content immediately
    displayDoctrines(doctrinesData);

    // Wait for events data and display it
    const eventsData = await eventsDataPromise;
    displayRandomEvents(eventsData);

    // Initialize popovers AFTER all dynamic content is rendered
    setTimeout(() => {
      initializeDefinitionsSystem();
    }, 100);
  } catch (error) {
    console.error("Error loading rules page data:", error);
    showToast("Failed to load some rules data.", "Error");
    if (randomEventsDisplayElement) {
      randomEventsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading random events. Check console.</div>`;
    }
    if (doctrinesDisplayElement) {
      // Check if doctrines failed specifically during state retrieval (though unlikely now)
      if (!getDoctrinesData()) {
        doctrinesDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading doctrines. Check console.</div>`;
      }
    }
  }
});
