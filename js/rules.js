/**
 * @fileoverview Logic for the Rules Reference page.
 * Handles fetching and displaying Random Events using a card layout.
 */

import { loadRandomEventsData } from "./dataLoader.js";
import { showToast } from "./uiHelpers.js";

// --- UI Element References ---
let randomEventsDisplayElement;

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  randomEventsDisplayElement = document.getElementById("random-events-display");
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

// --- Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Rules JS loaded.");
  initializeUIReferences();

  try {
    const eventsData = await loadRandomEventsData(); // Fetch the data
    displayRandomEvents(eventsData); // Display the data
  } catch (error) {
    console.error("Failed to load or display random events:", error);
    showToast("Failed to load random events.", "Error");
    if (randomEventsDisplayElement) {
      randomEventsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Error loading random events. Check console.</div>`;
    }
  }
});
