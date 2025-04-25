/**
 * @fileoverview Contains helper functions for updating specific UI parts
 * not directly related to the main unit display (e.g., modals, toasts, selection lists, offcanvas).
 */

// Import constants if needed (e.g., from config)
import { config, UI_ICONS } from "./config.js";
// Import state functions
import {
  getCurrentArmyId,
  getDoctrinesData,
  getArmyNameById,
  getSelectedDoctrine,
  getCommandPoints,
  getMaxCommandPoints,
  getUnderdogPoints,
  getMaxUnderdogPoints,
  getUnitStateValue,
  getCurrentArmyHeroTargets,
} from "./state.js";

// --- Focus Management State ---
// Variable to store the element that triggered the modal/toast/offcanvas
// Kept internal to this module, managed by exported functions.
let elementToFocusAfterClose = null;

/**
 * Stores the element that should receive focus when the next modal/toast/offcanvas closes.
 * Should be called from the 'show.bs.modal' or equivalent event listener.
 * @param {HTMLElement|null} element - The element to focus, or null.
 */
export function setElementToFocusAfterClose(element) {
  if (element && typeof element.focus === "function") {
    elementToFocusAfterClose = element;
    // console.log("DEBUG: Storing element to focus after close:", element);
  } else {
    elementToFocusAfterClose = null; // Clear if invalid element provided
    // console.log("DEBUG: Clearing element to focus after close (invalid element provided).");
  }
}

/**
 * Returns focus to the element stored by setElementToFocusAfterClose.
 * Should be called from the 'hidden.bs.modal' or 'hidden.bs.toast' or 'hidden.bs.offcanvas' event listener.
 */
export function handleFocusReturn() {
  if (elementToFocusAfterClose) {
    // console.log("DEBUG: Attempting to return focus to:", elementToFocusAfterClose);
    // Use requestAnimationFrame for smoother focus transition, especially after CSS transitions
    requestAnimationFrame(() => {
      try {
        elementToFocusAfterClose.focus();
        // console.log("DEBUG: Focus returned successfully.");
      } catch (e) {
        console.warn("Could not focus stored trigger element:", e);
      }
      elementToFocusAfterClose = null; // Clear stored element after attempting focus
      // console.log("DEBUG: Cleared stored focus element.");
    });
  } else {
    // console.log("DEBUG: No element stored to return focus to.");
  }
}
// --- End Focus Management ---

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
                    <strong class="me-2">${army.armyName || "Unnamed Army"}</strong>
                    <small class="text-muted">(${army.player || "Unknown Player"})</small>
                </span>
                ${UI_ICONS.selectItem}
            `;
      listGroup.appendChild(link);
    });
  } else {
    listGroup.innerHTML = '<p class="text-center text-muted">No armies found in campaign data.</p>';
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

  if (modalLabel) modalLabel.textContent = armyInfo.armyName || "Army Information";
  if (tagline) tagline.textContent = armyInfo.tagline || "";
  if (summary) summary.textContent = armyInfo.summary || "";
  // Use innerHTML for backstory as it contains HTML tags from campaign.json
  if (backstory) backstory.innerHTML = armyInfo.backstory || "<p>No backstory available.</p>";

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
 * Generates and displays the End Game Results modal.
 * @param {object} xpResultsData - The object returned by calculateArmyXP, keyed by unitId.
 * Example entry: { id: 'unitId', name: 'Unit Name', finalStatus: 'active', survived: true,
 * killsRecorded: [{...}, ...], killedBy: { attackerUnitName: 'X', attackerArmyName: 'Y' } | null,
 * casualtyOutcome: 'Recovered (2-5)' | null, xpBreakdown: { survived: 1, standardKills: 1, heroKills: 0 },
 * totalXpEarned: 2 }
 * @param {string} armyId - The ID of the army whose results are being shown (needed for casualty dropdown).
 */
export function showResultsModal(xpResultsData, armyId) {
  const modalContainer = document.getElementById("game-results-modal-container");
  if (!modalContainer) {
    console.error("Modal container #game-results-modal-container not found.");
    showToast("Error: Cannot display results modal container.", "UI Error");
    return;
  }
  if (!xpResultsData || Object.keys(xpResultsData).length === 0) {
    showToast("No XP results data to display.", "Info");
    return;
  }

  const armyName = getArmyNameById(armyId);
  const modalId = "gameResultsModal";

  let tableRowsHTML = "";
  Object.values(xpResultsData)
    .sort((a, b) => a.name.localeCompare(b.name))
    .forEach((result) => {
      // Determine Status Display
      let statusDisplay = `<span class="text-success">${result.finalStatus}</span>`; // Default active styling
      if (result.finalStatus === "destroyed" || result.finalStatus === "routed") {
        statusDisplay = `<span class="text-danger text-decoration-line-through"
          >${result.finalStatus}</span
        >`;
        if (result.killedBy) {
          statusDisplay += `<br /><small class="text-muted fst-italic"
              >(by ${result.killedBy.attackerUnitName} - ${result.killedBy.attackerArmyName})</small
            >`;
        } else {
          statusDisplay += `<br /><small class="text-muted fst-italic"
              >(Killed by unknown)</small
            >`; // Fallback
        }
      }

      // Format Kills
      const totalKills = result.xpBreakdown.standardKills + result.xpBreakdown.heroKills;
      let killsDisplay = `${totalKills} Kill${totalKills !== 1 ? "s" : ""}`;
      if (result.xpBreakdown.heroKills > 0) {
        killsDisplay += ` (${result.xpBreakdown.heroKills} Hero${
          result.xpBreakdown.heroKills !== 1 ? "es" : ""
        })`;
      }

      // Optional: List names killed
      let killsDisplayList = result.killsRecorded.map((k) => k.victimUnitName).join(", ");
      killsDisplay = killsDisplayList || "None";

      // Format XP Breakdown
      const breakdownParts = [];
      if (result.xpBreakdown.survived > 0)
        breakdownParts.push(`Survived: +${result.xpBreakdown.survived}`);
      if (result.xpBreakdown.standardKills > 0)
        breakdownParts.push(`Kills: +${result.xpBreakdown.standardKills}`);
      if (result.xpBreakdown.heroKills > 0)
        breakdownParts.push(`Hero Kills: +${result.xpBreakdown.heroKills}`);
      const breakdownDisplay = breakdownParts.join(", ") || "None";

      // Casualty Outcome Dropdown
      let casualtyDropdownHTML = "";
      if (result.finalStatus === "destroyed" || result.finalStatus === "routed") {
        const outcomes = [
          { value: "", text: "Record D6 Roll..." },
          { value: "Dead (1)", text: "1: Dead (Remove)" },
          { value: "Recovered (2-5)", text: "2-5: Recovered" },
          { value: "Talent (6)", text: "6: Talent (+1 XP)" },
        ];
        let optionsHTML = outcomes
          .map(
            (opt) =>
              `<option
                value="${opt.value}"
                ${result.casualtyOutcome === opt.value ? "selected" : ""}>
                ${opt.text}
              </option>`
          )
          .join("");

        casualtyDropdownHTML = ` <select
          class="form-select form-select-sm casualty-outcome-select"
          data-army-id="${armyId}"
          data-unit-id="${result.id}"
          aria-label="Select Casualty Outcome">
          ${optionsHTML}
        </select>`;
      }

      // Build Table Row
      tableRowsHTML += `
        <tr>
          <td>${result.name}</td>
          <td>${statusDisplay}</td>
          <td class="text-center">${killsDisplay}</td>
          <td>${breakdownDisplay}</td>
          <td class="text-center fw-bold">${result.totalXpEarned}</td>
          <td>${casualtyDropdownHTML}</td>
        </tr>
      `;
    });

  // Full Modal HTML
  const modalHTML = `
    <div
      class="modal fade"
      id="${modalId}"
      tabindex="-1"
      aria-labelledby="${modalId}Label"
      aria-hidden="true">
      <div class="modal-dialog modal-xl modal-dialog-scrollable">
        {/* Use modal-xl for more space */}
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title" id="${modalId}Label">End Game Results: ${armyName}</h5>
            <button
              type="button"
              class="btn-close"
              data-bs-dismiss="modal"
              aria-label="Close"></button>
          </div>
          <div class="modal-body">
            <p class="text-muted small">
              Review XP earned and record casualty roll outcomes below. Changes to casualty outcomes
              are saved automatically.
            </p>
            <div class="table-responsive">
              <table class="table table-sm table-striped table-hover">
                <thead>
                  <tr>
                    <th>Unit</th>
                    <th>Final Status</th>
                    <th class="text-center">Kills Made</th>
                    <th>XP Breakdown</th>
                    <th class="text-center">Total XP Earned</th>
                    <th>Casualty Roll (D6)</th>
                  </tr>
                </thead>
                <tbody>
                  ${tableRowsHTML}
                </tbody>
              </table>
            </div>
          </div>
          <div class="modal-footer">
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
          </div>
        </div>
      </div>
    </div>
  `;

  // Inject and Show
  modalContainer.innerHTML = modalHTML;
  const modalElement = document.getElementById(modalId);
  if (modalElement) {
    const modalInstance = new bootstrap.Modal(modalElement);
    // Cleanup modal from DOM when hidden
    modalElement.addEventListener(
      "hidden.bs.modal",
      () => {
        modalContainer.innerHTML = "";
      },
      { once: true }
    );
    modalInstance.show();
  } else {
    console.error("Failed to find results modal element after creation.");
    showToast("Error displaying results modal.", "UI Error");
  }
}

/**
 * Shows a Bootstrap Toast message by cloning a template. Stacks toasts and auto-hides.
 * @param {string} message - The message to display.
 * @param {string} [title='Update'] - Optional title for the toast.
 * @param {number} [delay=5000] - Auto-hide delay in milliseconds.
 */
export function showToast(message, title = "Update", delay = 5000) {
  const toastContainer = document.querySelector(".toast-container");
  const toastTemplate = document.getElementById("toastTemplate");

  if (!toastContainer || !toastTemplate) {
    console.error("Toast container or template not found.");
    return;
  }

  // Clone the template
  const newToastElement = toastTemplate.content.firstElementChild.cloneNode(true);

  // Generate a unique ID (optional, but good practice)
  const toastId = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
  newToastElement.id = toastId;

  // Populate the new toast
  const toastTitleElement = newToastElement.querySelector(".toast-title");
  const toastBodyElement = newToastElement.querySelector(".toast-body");
  // Optional: Update timestamp if needed, otherwise 'Just now' is fine
  const toastTimestampElement = newToastElement.querySelector(".toast-timestamp");

  if (toastTitleElement) toastTitleElement.textContent = title;
  if (toastBodyElement) toastBodyElement.textContent = message;

  if (toastTimestampElement) {
    const now = new Date();
    toastTimestampElement.textContent = now.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    }); // Format time
  }

  // Append to container
  toastContainer.appendChild(newToastElement);

  // Initialize Bootstrap Toast
  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    try {
      const toast = new bootstrap.Toast(newToastElement, {
        autohide: true,
        delay: delay,
      });

      // Add event listener to remove the toast from DOM after it's hidden
      newToastElement.addEventListener(
        "hidden.bs.toast",
        () => {
          newToastElement.remove();
        },
        { once: true }
      ); // Use 'once' to auto-remove the listener

      toast.show();
    } catch (error) {
      console.error("Error showing Bootstrap toast:", error);
      // Clean up if initialization fails
      newToastElement.remove();
    }
  } else {
    console.warn("Bootstrap Toast component not found. Cannot display toast.");
    // Clean up if Bootstrap is missing
    newToastElement.remove();
  }
}

/**
 * Shows an interactive Bootstrap Toast message with buttons and returns a Promise.
 * @param {string} message - The message to display in the toast body.
 * @param {string} [title='Confirmation'] - The title for the toast header.
 * @param {Array<object>} buttons - Array of button objects, e.g., [{text: 'Yes', value: 'yes', style: 'primary'}, {text: 'No', value: 'no', style: 'secondary'}]
 * @returns {Promise<string|null>} A promise that resolves with the 'value' of the clicked button, or null if dismissed via the close button.
 */
export function showInteractiveToast(message, title = "Confirmation", buttons = []) {
  return new Promise((resolve) => {
    const toastContainer = document.querySelector(".toast-container");
    const toastTemplate = document.getElementById("interactiveToastTemplate");

    if (!toastContainer || !toastTemplate) {
      console.error("Interactive toast container or template not found.");
      resolve(null); // Resolve with null on error
      return;
    }

    // Store the currently focused element BEFORE showing the toast
    setElementToFocusAfterClose(
      document.activeElement && document.activeElement !== document.body
        ? document.activeElement
        : null
    );

    // Clone the template
    const newToastElement = toastTemplate.content.firstElementChild.cloneNode(true);
    const toastId = `interactive-toast-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    newToastElement.id = toastId;

    // Populate the new toast
    const toastTitleElement = newToastElement.querySelector(".toast-title");
    const toastBodyElement = newToastElement.querySelector(".toast-body");
    const buttonsContainer = newToastElement.querySelector(".toast-buttons-container");

    if (toastTitleElement) toastTitleElement.textContent = title;
    if (toastBodyElement) toastBodyElement.textContent = message;
    if (!buttonsContainer) {
      console.error("Buttons container not found in interactive toast template.");
      resolve(null);
      return;
    }

    // Add buttons dynamically
    buttons.forEach((buttonConfig) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `btn btn-sm btn-${buttonConfig.style || "secondary"} ms-1`; // Add margin between buttons
      button.textContent = buttonConfig.text;
      button.dataset.value = buttonConfig.value; // Store the value to resolve with
      button.addEventListener("click", () => {
        resolve(buttonConfig.value); // Resolve the promise with the button's value
        // Manually hide the toast since autohide is false
        const toastInstance = bootstrap.Toast.getInstance(newToastElement);
        if (toastInstance) {
          toastInstance.hide(); // This will trigger the 'hidden.bs.toast' event
        } else {
          newToastElement.remove(); // Fallback removal
          handleFocusReturn(); // Manually trigger focus return if instance is gone
        }
      });
      buttonsContainer.appendChild(button);
    });

    // Handle dismissal via the 'X' button
    const closeButton = newToastElement.querySelector(".btn-close");
    if (closeButton) {
      closeButton.addEventListener("click", () => {
        resolve(null); // Resolve with null if closed without button click
        // Bootstrap will hide it automatically on btn-close click, triggering 'hidden.bs.toast'
      });
    }

    // Append to container
    toastContainer.appendChild(newToastElement);

    // Initialize Bootstrap Toast
    if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
      try {
        const toast = new bootstrap.Toast(newToastElement, {
          autohide: false, // Ensure it doesn't autohide
        });

        // Add event listener to remove the toast from DOM and handle focus return
        newToastElement.addEventListener(
          "hidden.bs.toast",
          () => {
            newToastElement.remove();
            handleFocusReturn(); // Call focus return handler
          },
          { once: true }
        );

        toast.show();
      } catch (error) {
        console.error("Error showing interactive Bootstrap toast:", error);
        newToastElement.remove(); // Clean up
        handleFocusReturn(); // Attempt focus return even on error
        resolve(null);
      }
    } else {
      console.warn("Bootstrap Toast component not found. Cannot display interactive toast.");
      newToastElement.remove(); // Clean up
      handleFocusReturn(); // Attempt focus return
      resolve(null);
    }
  });
}

/**
 * Populates and shows the spell list modal (#viewSpellsModal).
 * Also sets up listeners to handle focus management on hide.
 * @param {object} casterUnit - The processed caster unit data (hero or base unit).
 * @param {Array | null} spellList - The list of spell objects from the army book, or null.
 * @param {number} currentTokens - The caster's current token count.
 */
export function populateAndShowSpellModal(casterUnit, spellList, currentTokens) {
  const modalElement = document.getElementById("viewSpellsModal");
  if (!modalElement) {
    console.error("Spell modal element #viewSpellsModal not found!");
    return;
  }

  // --- Focus Management Setup ---
  setElementToFocusAfterClose(
    document.activeElement && document.activeElement !== document.body
      ? document.activeElement
      : null
  );
  // Add listener to return focus when modal is hidden
  modalElement.removeEventListener("hidden.bs.modal", handleFocusReturn); // Use generic handler
  modalElement.addEventListener("hidden.bs.modal", handleFocusReturn, {
    once: true,
  });
  // --- End Focus Management ---

  const modalTitle = document.getElementById("viewSpellsModalLabel");
  const tokenDisplay = document.getElementById("modalCasterTokenDisplay");
  const spellListContainer = document.getElementById("spellListContainer");
  const noSpellsMessage = document.getElementById("noSpellsMessage");

  // Update modal title and token count
  if (modalTitle)
    modalTitle.textContent = `Spells for ${casterUnit.customName || casterUnit.originalName}`;
  if (tokenDisplay) {
    tokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${currentTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
  }

  // Clear previous spell list and hide no spells message
  if (spellListContainer) spellListContainer.innerHTML = "";
  if (noSpellsMessage) noSpellsMessage.style.display = "none";

  // Get current army ID (needed for data attributes on buttons)
  const armyId = getCurrentArmyId(); // Use state getter

  // Populate spell list
  if (spellList && spellList.length > 0 && spellListContainer) {
    spellList.forEach((spell) => {
      const listItem = document.createElement("li");
      listItem.className =
        "list-group-item d-flex justify-content-between align-items-start flex-wrap";

      const spellCost = spell.threshold || 0;
      const canCast = currentTokens >= spellCost;
      const spellName = spell.name || "Unnamed Spell";

      listItem.innerHTML = `
                <div class="me-auto mb-1">
                    <span class="fw-bold spell-name">${spellName}</span>
                    <small class="spell-effect d-block text-muted">${
                      spell.effect || "No description."
                    }</small>
                </div>
                <div class="d-flex align-items-center gap-2">
                    <span class="badge bg-info rounded-pill spell-cost-badge" title="Token Cost">${spellCost}</span>
                    <button type="button"
                            class="btn btn-sm btn-success cast-spell-btn"
                            title="Cast ${spellName}"
                            data-spell-cost="${spellCost}"
                            data-spell-name="${encodeURIComponent(spellName)}"
                            data-caster-id="${casterUnit.selectionId}"
                            data-army-id="${armyId || ""}"
                            ${!canCast ? "disabled" : ""}>
                        ${UI_ICONS.castSpell} Cast
                    </button>
                </div>
                `;
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
      modalElement.removeEventListener("hidden.bs.modal", handleFocusReturn); // Clean up listener if show fails
    }
  } else {
    console.warn("Bootstrap Modal component not found.");
    modalElement.removeEventListener("hidden.bs.modal", handleFocusReturn); // Clean up listener if BS missing
  }
}

/**
 * Displays the Universal and selected Doctrine's stratagems in the modal.
 * @param {string} armyId - The ID of the currently loaded army.
 * @param {string | null} selectedDoctrineId - The ID of the doctrine selected by the user, or null.
 */
export function displayStratagems(armyId, selectedDoctrineId) {
  const displayArea = document.getElementById("stratagemDisplayArea");
  const doctrinesData = getDoctrinesData();
  const currentPoints = getCommandPoints(armyId); // Get current CP

  if (!displayArea || !doctrinesData || !doctrinesData.doctrines) {
    console.error("Stratagem display area or doctrines data not found.");
    if (displayArea)
      displayArea.innerHTML = '<p class="text-danger">Error loading stratagem data.</p>';
    return;
  }

  displayArea.innerHTML = ""; // Clear previous content

  const universalDoctrine = doctrinesData.doctrines.find((d) => d.id === "universal");
  const selectedDoctrine = selectedDoctrineId
    ? doctrinesData.doctrines.find((d) => d.id === selectedDoctrineId)
    : null;

  // Helper function to create HTML for a list of stratagems
  const createStratagemListHTML = (doctrine, title) => {
    if (!doctrine || !doctrine.stratagems || doctrine.stratagems.length === 0) {
      return `<p class="text-muted small">No stratagems found for ${title}.</p>`;
    }

    let listHTML = `<h6 class="mt-3 mb-2">${title}</h6>`;
    listHTML += '<ul class="list-group list-group-flush stratagem-list">'; // Added class

    doctrine.stratagems.forEach((strat) => {
      const cost = strat.cost || 0;
      const canAfford = currentPoints >= cost;
      const stratName = strat.name || "Unnamed Stratagem";
      const stratDesc = strat.description || "No description available.";
      // Use doctrine.id and strat.name as a unique identifier for data attribute
      const stratDataId = `${doctrine.id}-${strat.name.replace(/\s+/g, "-")}`;

      listHTML += `
                <li class="list-group-item d-flex justify-content-between align-items-start flex-wrap gap-2 px-0 py-2">
                    <div class="me-auto">
                        <strong class="stratagem-name">${stratName}</strong>
                        <small class="stratagem-description d-block text-muted">${stratDesc}</small>
                    </div>
                    <div class="d-flex align-items-center gap-2">
                        <span class="badge bg-warning text-dark rounded-pill stratagem-cost-badge" title="Command Point Cost">${cost} pt${
        cost !== 1 ? "s" : ""
      }</span>
                        <button type="button"
                                class="btn btn-sm btn-success activate-stratagem-btn"
                                title="Activate ${stratName}"
                                data-stratagem-id="${stratDataId}"
                                data-stratagem-name="${encodeURIComponent(stratName)}"
                                data-stratagem-cost="${cost}"
                                data-army-id="${armyId || ""}"
                                ${!canAfford ? "disabled" : ""}>
                            Activate
                        </button>
                    </div>
                </li>
            `;
    });

    listHTML += "</ul>";
    return listHTML;
  };

  // Display Universal Stratagems
  if (universalDoctrine) {
    displayArea.innerHTML += createStratagemListHTML(universalDoctrine, "Universal Stratagems");
  } else {
    displayArea.innerHTML += '<p class="text-warning">Universal stratagems not found.</p>';
  }

  // Display Selected Doctrine Stratagems
  if (selectedDoctrine) {
    displayArea.innerHTML += `<hr class="my-3">`; // Separator
    displayArea.innerHTML += createStratagemListHTML(
      selectedDoctrine,
      `${selectedDoctrine.name} Stratagems`
    );
  } else if (selectedDoctrineId) {
    displayArea.innerHTML += `<hr class="my-3">`;
    displayArea.innerHTML += `<p class="text-warning">Selected doctrine '${selectedDoctrineId}' not found.</p>`;
  } else {
    displayArea.innerHTML += `<hr class="my-3">`;
    displayArea.innerHTML += `<p class="text-muted">Select a doctrine from the dropdown above to see its specific stratagems.</p>`;
  }
}

/**
 * Updates the round display and start/next round button text.
 * Creates the round display element if it doesn't exist.
 * @param {number} roundNumber - The current round number (0 for pre-game).
 */
export function updateRoundUI(roundNumber) {
  const startRoundButton = document.getElementById("start-round-button");
  let roundDisplayElement = document.getElementById("round-display"); // Try to find existing

  // Create round display element if it doesn't exist
  if (!roundDisplayElement) {
    const titleH1 = document.getElementById("army-title-h1");
    if (titleH1 && titleH1.parentNode) {
      // Check parentNode exists
      roundDisplayElement = document.createElement("h3"); // Use h3 as in user code
      roundDisplayElement.id = "round-display";
      roundDisplayElement.className = "mb-0 order-1 order-md-0"; // Match classes from HTML
      // Insert before the CP display (which is order-2)
      const cpDisplay = document.getElementById("command-points-display");
      if (cpDisplay) {
        cpDisplay.parentNode.insertBefore(roundDisplayElement, cpDisplay);
      } else {
        // Fallback: insert after H1 if CP display isn't there yet
        titleH1.parentNode.insertBefore(roundDisplayElement, titleH1.nextSibling);
      }
      console.log("Created #round-display element.");
    } else {
      console.error("Cannot create round display: #army-title-h1 or its parent not found.");
      return; // Exit if we can't create it
    }
  }

  // Update Round Display Text
  if (roundNumber >= 1) {
    roundDisplayElement.textContent = `Round ${roundNumber}`;
  } else {
    roundDisplayElement.textContent = ""; // Clear display for round 0 or pre-game
  }

  // Update Start/Next Button Text/HTML
  if (startRoundButton) {
    if (roundNumber >= 1) {
      startRoundButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> Next Round`;
    } else {
      startRoundButton.innerHTML = `<i class="bi bi-arrow-repeat"></i> Start Game`;
    }
  } else {
    console.warn("Start/Next Round button not found for UI update.");
  }
}

/**
 * Updates the command points display elements (main header and modal header).
 * @param {string} armyId - The ID of the current army.
 * @param {number} currentPoints - The current command points.
 * @param {number} maxPoints - The maximum command points for the army.
 */
export function updateCommandPointsDisplay(armyId, currentPoints, maxPoints) {
  // Update main header display
  const cpValueElement = document.getElementById("command-points-value");
  const cpMaxElement = document.getElementById("command-points-max");
  const cpIconPlaceholder = document.querySelector("#command-points-display .cp-icon-placeholder"); // Use placeholder class

  if (cpValueElement) cpValueElement.textContent = currentPoints;
  if (cpMaxElement) cpMaxElement.textContent = maxPoints;

  // Update icon and color based on points
  if (cpIconPlaceholder) {
    // Set the icon HTML from config
    cpIconPlaceholder.innerHTML = UI_ICONS.commandPoints || '<i class="bi bi-question-circle"></i>'; // Fallback icon

    // Add/remove class for color styling based on points
    if (currentPoints <= 0) {
      cpIconPlaceholder.classList.add("text-secondary");
    } else {
      cpIconPlaceholder.classList.remove("text-secondary");
    }
  }

  // Update modal header display
  const modalCpValueElement = document.getElementById("modal-command-points-value");
  const modalCpMaxElement = document.getElementById("modal-command-points-max");
  const modalCpIconPlaceholder = document.querySelector(
    "#modal-command-points-display .cp-icon-placeholder"
  ); // Use placeholder class

  if (modalCpValueElement) modalCpValueElement.textContent = currentPoints;
  if (modalCpMaxElement) modalCpMaxElement.textContent = maxPoints;

  if (modalCpIconPlaceholder) {
    // Set the icon HTML from config
    modalCpIconPlaceholder.innerHTML =
      UI_ICONS.commandPoints || '<i class="bi bi-question-circle"></i>'; // Fallback icon

    // Add/remove class for color styling based on points
    if (currentPoints <= 0) {
      modalCpIconPlaceholder.classList.add("text-secondary");
    } else {
      modalCpIconPlaceholder.classList.remove("text-secondary");
    }
  }

  // Enable Stratagems button if army is loaded
  const stratButton = document.getElementById("stratagems-button");
  if (stratButton) stratButton.disabled = false;

  // Enable/disable manual adjust buttons based on current points
  const removeCpButton = document.getElementById("manual-cp-remove");
  const addCpButton = document.getElementById("manual-cp-add");
  if (removeCpButton) removeCpButton.disabled = currentPoints <= 0;
  if (addCpButton) addCpButton.disabled = currentPoints >= maxPoints;
}

/**
 * Updates the underdog points display element and its +/- buttons.
 * @param {string} armyId - The ID of the current army.
 * @param {number | string} currentPoints - The current underdog points, or a string like "Calculating...".
 * @param {number} maxPoints - The maximum underdog points for the army.
 */
export function updateUnderdogPointsDisplay(armyId, currentPoints, maxPoints) {
  const upValueElement = document.getElementById("underdog-points-value");
  const upIconPlaceholder = document.querySelector("#underdog-points-display .up-icon-placeholder");
  const removeUpButton = document.getElementById("manual-up-remove");
  const addUpButton = document.getElementById("manual-up-add");

  const isCalculating = typeof currentPoints === "string";

  if (upValueElement) {
    upValueElement.textContent = isCalculating ? currentPoints : `${currentPoints} / ${maxPoints}`;
  }

  if (upIconPlaceholder) {
    upIconPlaceholder.innerHTML =
      UI_ICONS.underdogPoints || '<i class="bi bi-question-circle"></i>'; // Fallback icon
    // Optionally change icon color based on points/state
    upIconPlaceholder.classList.toggle("text-secondary", !isCalculating && currentPoints <= 0);
    upIconPlaceholder.classList.toggle("text-info", !isCalculating && currentPoints > 0); // Use info color for UP
  }

  // Enable/disable manual adjust buttons
  if (removeUpButton) removeUpButton.disabled = isCalculating || currentPoints <= 0;
  if (addUpButton) addUpButton.disabled = isCalculating || currentPoints >= maxPoints;
}

/**
 * Populates the doctrine selector dropdown in the Stratagem modal.
 * @param {string} armyId - The ID of the currently loaded army.
 */
export function populateDoctrineSelector(armyId) {
  const selector = document.getElementById("doctrineSelector");
  const doctrines = getDoctrinesData()?.doctrines; // Use state getter
  const currentlySelected = getSelectedDoctrine(armyId); // Use state getter

  if (!selector || !doctrines) {
    console.error("Doctrine selector or doctrines data not found.");
    if (selector) selector.innerHTML = '<option value="">Error loading doctrines</option>';
    return;
  }

  // Clear existing options (except the default placeholder)
  selector.innerHTML = '<option selected value="">-- Select Doctrine --</option>';

  // Add options for each doctrine (excluding 'universal')
  doctrines.forEach((doctrine) => {
    if (doctrine.id !== "universal") {
      // Skip universal doctrine
      const option = document.createElement("option");
      option.value = doctrine.id;
      option.textContent = doctrine.name || doctrine.id; // Use name, fallback to id
      // Pre-select the option if it matches the stored state
      if (doctrine.id === currentlySelected) {
        option.selected = true;
      }
      selector.appendChild(option);
    }
  });

  // console.log(`Doctrine selector populated. Current selection: ${currentlySelected}`);
}

/**
 * *** NEW FUNCTION ***
 * Updates the status icon and styling for a specific unit in the off-canvas list.
 * @param {string} armyId - The ID of the current army.
 * @param {string} unitId - The selectionId of the unit to update.
 */
export function updateOffcanvasUnitStatus(armyId, unitId) {
  const listItem = document.querySelector(`#offcanvas-unit-list li[data-unit-id="${unitId}"]`);
  if (!listItem) {
    console.warn(`Offcanvas list item not found for unit ${unitId}. Cannot update status.`);
    return;
  }

  const iconContainer = listItem.querySelector(".unit-status-icons");
  if (!iconContainer) {
    console.warn(`Icon container not found for offcanvas unit ${unitId}.`);
    return;
  }

  // Get current state values
  const status = getUnitStateValue(armyId, unitId, "status", "active");
  const isShaken = getUnitStateValue(armyId, unitId, "shaken", false);
  const isFatigued = getUnitStateValue(armyId, unitId, "fatigued", false);
  const action = getUnitStateValue(armyId, unitId, "action", null);
  const isActivated = action !== null && !isShaken; // Activated only if action is set AND not shaken

  let iconHTML = "";
  let itemClass = "list-group-item list-group-item-action"; // Base class

  // Determine icon and class based on priority
  if (status === "destroyed" || status === "routed") {
    iconHTML = `<i class="bi bi-x-octagon-fill text-danger" title="${
      status === "destroyed" ? "Destroyed" : "Routed"
    }"></i>`;
    itemClass += " text-decoration-line-through text-muted"; // Style the item itself
  } else if (isShaken) {
    iconHTML = `<i class="bi bi-exclamation-triangle-fill text-warning" title="Shaken"></i>`;
  } else if (isFatigued) {
    iconHTML = `<i class="bi bi-clock-history text-info" title="Fatigued"></i>`;
  } else if (isActivated) {
    iconHTML = `<i class="bi bi-check-circle-fill text-success" title="Activated (${action})"></i>`;
  } else {
    iconHTML = `<i class="bi bi-circle" title="Ready"></i>`; // Placeholder for ready units
  }

  // Update the icon and the list item's class
  iconContainer.innerHTML = iconHTML;
  listItem.className = itemClass;
  listItem.dataset.unitId = unitId; // Ensure dataset attribute is present
}

/**
 * Simple identity tag function for template literals.
 * Primarily used to hint to formatters (like Prettier) that the content is HTML.
 * @param {TemplateStringsArray} strings Static string parts.
 * @param  {...any} values Embedded expression values.
 * @returns {string} The reconstructed string.
 */
export function html(strings, ...values) {
  let str = "";
  strings.forEach((string, i) => {
    str += string + (values[i] || "");
  });
  return str;
}
