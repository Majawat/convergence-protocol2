/**
 * @fileoverview Contains helper functions for updating specific UI parts
 * not directly related to the main unit display (e.g., modals, toasts, selection lists).
 */

// Import constants if needed (e.g., from config)
import { config, UI_ICONS } from "./config.js";
import { getCurrentArmyId } from "./state.js"; // Import needed to get armyId

// Variable to store the element that triggered the spell modal
let spellModalTriggerElement = null;

/**
 * Displays a list of armies from the campaign data for selection when no armyId is provided.
 * @param {Array} armies - The list of army objects from campaignData.
 * @param {HTMLElement} container - The HTML element to display the list in.
 */
export function displayArmySelection(armies, container) {
  if (!container) return;
  container.innerHTML = ""; // Clear previous content (like spinner)

  const prompt = document.createElement("div");
  prompt.className = "col-12 text-center mb-4";
  prompt.innerHTML = `<h2>Select an Army</h2><p>No specific army was requested via URL. Please choose an army below to view its details.</p>`;
  container.appendChild(prompt);

  const listContainer = document.createElement("div");
  listContainer.className = "col-12 col-md-8 col-lg-6 mx-auto"; // Center the list

  const listGroup = document.createElement("div");
  listGroup.className = "list-group";

  if (armies && armies.length > 0) {
    armies.forEach((army) => {
      if (!army.armyForgeID) return; // Skip if armyForgeID is missing
      const link = document.createElement("a");
      link.href = `army.html?armyId=${army.armyForgeID}`; // Link to same page with parameter
      link.className =
        "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      link.innerHTML = `
                <span>
                    <strong class="me-2">${
                      army.armyName || "Unnamed Army"
                    }</strong>
                    <small class="text-muted">(${
                      army.player || "Unknown Player"
                    })</small>
                </span>
                <i class="bi bi-chevron-right"></i>
            `;
      listGroup.appendChild(link);
    });
  } else {
    listGroup.innerHTML =
      '<p class="text-center text-muted">No armies found in campaign data.</p>';
  }

  listContainer.appendChild(listGroup);
  container.appendChild(listContainer);
}

/**
 * Populates the Army Info Modal (#armyInfoModal) with data.
 * @param {object} armyInfo - The army info object from campaignData.
 */
export function populateArmyInfoModal(armyInfo) {
  if (!armyInfo) return;

  const modalLabel = document.getElementById("armyInfoModalLabel");
  const img = document.getElementById("armyInfoImage");
  const tagline = document.getElementById("armyInfoTagline");
  const summary = document.getElementById("armyInfoSummary");
  const backstory = document.getElementById("armyInfoBackstory");
  const infoButton = document.getElementById("army-info-button"); // Button to enable

  if (modalLabel)
    modalLabel.textContent = armyInfo.armyName || "Army Information";
  if (tagline) tagline.textContent = armyInfo.tagline || "";
  if (summary) summary.textContent = armyInfo.summary || "";
  // Use innerHTML for backstory as it contains HTML tags from campaign.json
  if (backstory)
    backstory.innerHTML =
      armyInfo.backstory || "<p>No backstory available.</p>";

  if (img) {
    if (armyInfo.image) {
      img.src = armyInfo.image;
      img.alt = armyInfo.armyName || "Army Image";
      img.style.display = "block"; // Ensure it's visible
      // Apply image positioning if specified
      img.style.objectPosition = armyInfo.imagePosition || "center center"; // Default
      // Add error handling
      img.onerror = () => {
        console.warn(`Failed to load image: ${armyInfo.image}`);
        img.style.display = "none"; // Hide if image fails
      };
    } else {
      img.style.display = "none"; // Hide if no image URL
    }
  }
  // Enable the info button now that data is ready
  if (infoButton) infoButton.disabled = false;
}

/**
 * Shows a Bootstrap Toast message using the #themeToast element.
 * Reuses the theme toast element for simplicity.
 * @param {string} message - The message to display.
 * @param {string} [title='Update'] - Optional title for the toast.
 */
export function showToast(message, title = "Update") {
  // Added optional title parameter
  const toastElement = document.getElementById("themeToast"); // Reusing theme toast element
  if (!toastElement) {
    console.warn("Toast element #themeToast not found.");
    return;
  }
  const toastBody = toastElement.querySelector(".toast-body");
  const toastHeader = toastElement.querySelector(".toast-header strong"); // Get the title element

  if (!toastBody || !toastHeader) {
    console.warn(
      "Toast body or header strong element not found in #themeToast."
    );
    return;
  }

  // Update title and body
  toastHeader.textContent = title; // Use the provided title
  toastBody.textContent = message; // Set the message
  // Ensure white-space style allows line breaks for multi-line messages
  toastBody.style.whiteSpace = "pre-wrap";

  // Ensure Bootstrap object exists
  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    try {
      const toastInstance = bootstrap.Toast.getOrCreateInstance(toastElement); // Use getOrCreateInstance
      toastInstance.show();
    } catch (error) {
      console.error("Error showing Bootstrap toast:", error);
    }
  } else {
    console.warn("Bootstrap Toast component not found. Cannot display toast.");
  }
}

/**
 * Populates and shows the spell list modal (#viewSpellsModal).
 * Also sets up listeners to handle focus management on hide.
 * @param {object} casterUnit - The processed caster unit data (hero or base unit).
 * @param {Array | null} spellList - The list of spell objects from the army book, or null.
 * @param {number} currentTokens - The caster's current token count.
 */
export function populateAndShowSpellModal(
  casterUnit,
  spellList,
  currentTokens
) {
  const modalElement = document.getElementById("viewSpellsModal");
  if (!modalElement) {
    console.error("Spell modal element #viewSpellsModal not found!");
    return;
  }

  // --- Focus Management Setup ---
  modalElement.removeEventListener("show.bs.modal", handleSpellModalShow);
  modalElement.removeEventListener("hidden.bs.modal", handleSpellModalHidden);
  modalElement.addEventListener("show.bs.modal", handleSpellModalShow, {
    once: true,
  });
  modalElement.addEventListener("hidden.bs.modal", handleSpellModalHidden, {
    once: true,
  });

  const modalTitle = document.getElementById("viewSpellsModalLabel");
  const tokenDisplay = document.getElementById("modalCasterTokenDisplay");
  const spellListContainer = document.getElementById("spellListContainer");
  const noSpellsMessage = document.getElementById("noSpellsMessage");

  // Update modal title and token count
  if (modalTitle)
    modalTitle.textContent = `Spells for ${
      casterUnit.customName || casterUnit.originalName
    }`;
  if (tokenDisplay) {
    tokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${currentTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
  }

  // Clear previous spell list and hide no spells message
  if (spellListContainer) spellListContainer.innerHTML = "";
  if (noSpellsMessage) noSpellsMessage.style.display = "none";

  // Get current army ID (needed for data attributes on buttons)
  const armyId = getCurrentArmyId(); // Hacky way to get current army ID

  // Populate spell list
  if (spellList && spellList.length > 0 && spellListContainer) {
    spellList.forEach((spell) => {
      const listItem = document.createElement("li");
      // Use flexbox for better alignment
      listItem.className =
        "list-group-item d-flex justify-content-between align-items-start flex-wrap"; // Added flex-wrap

      const spellCost = spell.threshold || 0;
      const canCast = currentTokens >= spellCost;
      const spellName = spell.name || "Unnamed Spell";

      // ****** START MODIFIED CODE for list item content ******
      listItem.innerHTML = `
                <div class="me-auto mb-1"> <span class="fw-bold spell-name">${spellName}</span>
                    <small class="spell-effect d-block text-muted">${
                      spell.effect || "No description."
                    }</small>
                </div>
                <div class="d-flex align-items-center gap-2"> <span class="badge bg-info rounded-pill spell-cost-badge" title="Token Cost">${spellCost}</span>
                    <button type="button"
                            class="btn btn-sm btn-success cast-spell-btn"
                            title="Cast ${spellName}"
                            data-spell-cost="${spellCost}"
                            data-spell-name="${encodeURIComponent(spellName)}"
                            data-caster-id="${casterUnit.selectionId}"
                            data-army-id="${armyId}"
                            ${!canCast ? "disabled" : ""}>
                        <i class="bi bi-magic"></i> Cast
                    </button>
                </div>
                `;
      // ****** END MODIFIED CODE ******
      spellListContainer.appendChild(listItem);
    });
  } else if (noSpellsMessage) {
    // Show message if no spells are available
    noSpellsMessage.style.display = "block";
  }

  // Show the modal
  if (typeof bootstrap !== "undefined" && bootstrap.Modal) {
    try {
      const modalInstance = bootstrap.Modal.getOrCreateInstance(modalElement);
      modalInstance.show();
    } catch (error) {
      console.error("Error showing spell modal:", error);
      modalElement.removeEventListener("show.bs.modal", handleSpellModalShow);
      modalElement.removeEventListener(
        "hidden.bs.modal",
        handleSpellModalHidden
      );
    }
  } else {
    console.warn("Bootstrap Modal component not found.");
    modalElement.removeEventListener("show.bs.modal", handleSpellModalShow);
    modalElement.removeEventListener("hidden.bs.modal", handleSpellModalHidden);
  }
}

/**
 * Event handler for when the spell modal is about to be shown.
 * Stores the triggering element.
 * @param {Event} event The Bootstrap modal event.
 */
function handleSpellModalShow(event) {
  if (event.relatedTarget) {
    spellModalTriggerElement = event.relatedTarget;
  } else {
    spellModalTriggerElement = document.activeElement;
  }
}

/**
 * Event handler for when the spell modal has finished hiding.
 * Returns focus to the triggering element if possible.
 */
function handleSpellModalHidden() {
  if (
    spellModalTriggerElement &&
    typeof spellModalTriggerElement.focus === "function"
  ) {
    requestAnimationFrame(() => {
      try {
        spellModalTriggerElement.focus();
      } catch (e) {
        console.warn("Could not focus stored trigger element:", e);
      }
      spellModalTriggerElement = null;
    });
  } else {
    spellModalTriggerElement = null;
  }
}
