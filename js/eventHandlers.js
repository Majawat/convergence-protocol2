/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
 * Refactored to delegate clicks to specific handler functions for clarity.
 * Added JSDoc comments and inline explanations.
 */

// Imports from other modules
import { config } from "./config.js";
import {
  getLoadedArmyData,
  getUnitData,
  getJoinedHeroData,
  updateGlobalWoundState,
  updateGlobalComponentState,
  getComponentStateValue,
  getArmyComponentStates,
  getArmyBooksData,
  getArmyWoundStates,
  getCurrentArmyHeroTargets,
} from "./state.js";
import { saveWoundState, saveComponentState } from "./storage.js";
import { findTargetModelForWound } from "./gameLogic.js";
import { updateModelDisplay, updateTokenDisplay } from "./ui.js";
import { showToast, populateAndShowSpellModal } from "./uiHelpers.js";

// --- Internal Helper Functions ---

/**
 * Removes the highlight from any previously targeted model in a unit card.
 * @param {string} unitSelectionId - The selectionId of the unit card.
 * @private
 */
function _clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}

/**
 * Adds a highlight to the next model that will take a wound (auto-target).
 * @param {string} unitSelectionId - The selectionId of the unit card where the highlight should appear.
 * @param {string | null} modelId - The specific modelId to highlight, or null to clear.
 * @private
 */
function _highlightNextAutoTargetModel(unitSelectionId, modelId) {
  _clearTargetHighlight(unitSelectionId); // Clear previous highlight first
  if (!modelId) return; // If no model ID, just clear

  // Find the model element using its unique ID
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);

  // Ensure the found model is within the correct card before highlighting
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
    // console.log(`Highlighting model ${modelId} on card ${unitSelectionId}`);
  } else {
    console.warn(
      `Could not find model ${modelId} within card ${unitSelectionId} to highlight.`
    );
  }
}

/**
 * Finds the actual caster unit (base or joined hero) associated with a unit card.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card.
 * @returns {object | null} The processed unit data for the caster, or null if none found.
 * @private
 */
function _findActualCaster(armyId, cardUnitId) {
  const unitData = getUnitData(armyId, cardUnitId);
  // This check might be redundant if cardUnitId always refers to a base unit,
  // but it's safer to handle the case where the card ID *could* be a hero ID directly.
  if (unitData?.casterLevel > 0) {
    return unitData;
  }

  // If the base unit isn't the caster, check for a joined hero
  const heroData = getJoinedHeroData(armyId, cardUnitId);
  if (heroData?.casterLevel > 0) {
    return heroData;
  }

  return null; // No caster found for this card
}

// --- Action Functions ---

/**
 * Applies a wound to a specific model or uses auto-target logic.
 * Updates state and UI.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card where the interaction occurred.
 * @param {string | null} [specificModelId=null] - The modelId to wound directly, or null for auto-target.
 */
function applyWound(armyId, cardUnitId, specificModelId = null) {
  const armyData = getLoadedArmyData(armyId);
  if (!armyData) {
    console.error(`Army data not found for applyWound: army ${armyId}`);
    return;
  }
  const baseUnitData = getUnitData(armyId, cardUnitId); // Get base unit data from the card
  if (!baseUnitData) {
    console.error(
      `Base unit data not found for applyWound: army ${armyId}, unit ${cardUnitId}`
    );
    return;
  }
  const heroData = getJoinedHeroData(armyId, cardUnitId); // Get joined hero data, if any

  let targetModel = null;
  let modelUnitId = null; // The actual selectionId of the unit the target model belongs to

  if (specificModelId) {
    // --- Manual Targeting ---
    // Search in base unit first
    targetModel = baseUnitData.models.find(
      (m) => m.modelId === specificModelId
    );
    if (targetModel) {
      modelUnitId = cardUnitId; // Model found in the base unit
    }
    // If not found in base unit, check hero (if hero exists)
    else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelUnitId = heroData.selectionId; // Model found in the hero unit
      }
    }

    // Check if the manually targeted model is already removed (HP <= 0)
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      showToast(
        `Model ${targetModel.modelId.split("_").pop()} is already removed.`
      );
      targetModel = null; // Don't proceed
      modelUnitId = null;
    }
  } else {
    // --- Auto Targeting ---
    targetModel = findTargetModelForWound(baseUnitData, heroData); // Use game logic
    if (targetModel) {
      // Determine which unit the auto-targeted model belongs to for state update
      modelUnitId = targetModel.isHero ? heroData.selectionId : cardUnitId;
    }
  }

  // --- Apply Wound if Target Found ---
  if (targetModel && modelUnitId) {
    targetModel.currentHp -= 1; // Apply wound to the model object in memory

    // Update the global state object using the model's actual unit ID
    updateGlobalWoundState(
      armyId,
      modelUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );

    // Update the UI display for that specific model on the card (identified by cardUnitId)
    updateModelDisplay(
      cardUnitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );

    // Save the entire updated wound state to storage
    saveWoundState(getArmyWoundStates());

    // Highlight the next model that *would* be targeted automatically
    const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
    _highlightNextAutoTargetModel(
      cardUnitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    // Log if no valid target found
    console.log(
      `No models available to wound in unit ${cardUnitId} (or specific model ${specificModelId} not found/valid).`
    );
    showToast("All models in unit removed.");
    _clearTargetHighlight(cardUnitId); // Clear any existing highlight
  }
}

/**
 * Handles the 'Start New Round' button click, generating spell tokens for casters.
 * @param {string} armyId - The ID of the current army.
 */
function handleStartRoundClick(armyId) {
  console.log("--- Starting New Round (Generating Tokens) ---");
  const currentArmy = getLoadedArmyData(armyId);
  if (!currentArmy || !currentArmy.units) {
    console.warn("Cannot start round: Army data not loaded.");
    showToast("Error: Army data not loaded.");
    return;
  }

  let stateChanged = false;
  const casterUpdates = []; // Array to store info for the toast
  const heroTargets = getCurrentArmyHeroTargets(armyId) || {}; // Get hero targets for UI lookup

  // Iterate over ALL units in the processed data (including joined heroes not directly on cards)
  currentArmy.units.forEach((unit) => {
    // Check if the unit itself has caster level > 0
    if (unit.casterLevel > 0) {
      const casterUnitId = unit.selectionId; // Use the caster's actual unit ID for state
      const currentTokens = getComponentStateValue(
        armyId,
        casterUnitId,
        "tokens",
        0 // Default to 0 if not found
      );
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );
      const actualTokensAdded = newTokens - currentTokens; // Calculate how many were actually added

      if (actualTokensAdded > 0) {
        // Check if tokens actually changed
        console.log(
          `Adding ${actualTokensAdded} tokens to ${
            unit.customName || unit.originalName
          } (${casterUnitId}). New total: ${newTokens}`
        );
        // Update state using the caster's actual ID
        updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);

        // Store details for the toast message
        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
        });

        // Find the card ID to update the UI
        // If this caster is a hero joined to another unit, find the base unit's ID
        const cardUnitId = heroTargets[casterUnitId] || casterUnitId;
        updateTokenDisplay(cardUnitId, newTokens, unit.casterLevel); // Update UI on correct card

        stateChanged = true;
      }
    }
  });

  if (stateChanged) {
    saveComponentState(getArmyComponentStates()); // Save updated tokens
  }

  // Format the toast message
  let toastMessage = "";
  if (casterUpdates.length > 0) {
    casterUpdates.forEach((update) => {
      // Use non-breaking space for "+X" to prevent awkward wrapping
      toastMessage += `${update.name}: +${update.added
        .toString()
        .padStart(1, "\u00A0")}, now ${update.total}\n`;
    });
  } else {
    toastMessage = "No casters required token updates.";
  }
  // Use the showToast helper function
  showToast(toastMessage, "Spell Tokens Generated");
}

// --- Specific Click Handlers ---

/**
 * Handles clicks on individual model display elements.
 * @param {HTMLElement} targetElement - The clicked model element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card containing the model.
 * @private
 */
function _handleModelWoundClick(targetElement, armyId, cardUnitId) {
  const modelId = targetElement.dataset.modelId;
  if (modelId) {
    applyWound(armyId, cardUnitId, modelId); // Apply wound to the specific model
  } else {
    console.warn("Clicked model element missing data-model-id attribute.");
  }
}

/**
 * Handles clicks on the auto-wound button in the card header.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleAutoWoundButtonClick(targetElement, armyId, cardUnitId) {
  applyWound(armyId, cardUnitId, null); // Pass null for auto-target
}

/**
 * Handles clicks on the reset wounds button in the card header.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleResetWoundsClick(targetElement, armyId, cardUnitId) {
  const armyData = getLoadedArmyData(armyId);
  if (!armyData) return;
  const baseUnitData = getUnitData(armyId, cardUnitId);
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(armyId, cardUnitId);
  const heroId = heroData ? heroData.selectionId : null;

  console.log(
    `Resetting wounds for card unit ${cardUnitId}` +
      (heroId ? ` (and joined hero ${heroId})` : "")
  );

  let stateChanged = false;

  // Reset base unit models
  baseUnitData.models.forEach((model) => {
    if (model.currentHp !== model.maxHp) {
      model.currentHp = model.maxHp;
      // Update state using base unit ID
      updateGlobalWoundState(
        armyId,
        cardUnitId,
        model.modelId,
        model.currentHp
      );
      // Update UI on the card
      updateModelDisplay(
        cardUnitId,
        model.modelId,
        model.currentHp,
        model.maxHp
      );
      stateChanged = true;
    }
  });

  // Reset hero models if joined
  if (heroData) {
    heroData.models.forEach((model) => {
      if (model.currentHp !== model.maxHp) {
        model.currentHp = model.maxHp;
        // Update state using the HERO's ID
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp);
        // Update UI on the card (using cardUnitId)
        updateModelDisplay(
          cardUnitId,
          model.modelId,
          model.currentHp,
          model.maxHp
        );
        stateChanged = true;
      }
    });
  }

  if (stateChanged) {
    saveWoundState(getArmyWoundStates()); // Save the entire wound state
    showToast(
      `Wounds reset for ${
        baseUnitData.customName || baseUnitData.originalName
      }.`,
      "Wounds Reset"
    );
  }

  // Highlight next target after reset
  const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
  _highlightNextAutoTargetModel(
    cardUnitId,
    nextAutoTarget ? nextAutoTarget.modelId : null
  );
}

/**
 * Handles clicks on the add token button.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleAddTokenClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(armyId, cardUnitId);
  if (!actualCasterUnit) {
    console.warn("Add token clicked on non-caster card:", cardUnitId);
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId; // ID for state
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  if (currentTokens < config.MAX_SPELL_TOKENS) {
    const newTokens = currentTokens + 1;
    // Update state using caster's actual ID
    updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);
    // Update UI on the card using card's ID
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
    saveComponentState(getArmyComponentStates());
  } else {
    showToast(`Cannot exceed maximum tokens (${config.MAX_SPELL_TOKENS}).`);
  }
}

/**
 * Handles clicks on the remove token button.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleRemoveTokenClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(armyId, cardUnitId);
  if (!actualCasterUnit) {
    console.warn("Remove token clicked on non-caster card:", cardUnitId);
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId; // ID for state
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  if (currentTokens > 0) {
    const newTokens = currentTokens - 1;
    // Update state using caster's actual ID
    updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);
    // Update UI on the card using card's ID
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
    saveComponentState(getArmyComponentStates());
  }
}

/**
 * Handles clicks on the view spells button.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleViewSpellsClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(armyId, cardUnitId);
  if (!actualCasterUnit) {
    console.warn("View spells clicked for non-caster card:", cardUnitId);
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId; // ID for state
  const casterFactionId = actualCasterUnit.factionId;
  const armyBooks = getArmyBooksData(); // Get loaded army book data from state
  const spellList = armyBooks[casterFactionId]?.spells || null; // Find spells for the caster's faction
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  console.log(
    `Caster: ${actualCasterUnit.customName}, Faction: ${casterFactionId}, Tokens: ${currentTokens}`
  );

  // Call the UI helper function to populate and show the modal
  populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
}

// --- Main Event Listener & Setup ---

/**
 * Handles clicks delegated from the main unit container, dispatching to specific handlers.
 * @param {Event} event - The click event object.
 */
function handleUnitInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return; // Exit if click wasn't inside a unit card

  // Extract IDs from the card's dataset
  const cardUnitId = unitCard.dataset.unitId; // This is always the base unit ID from the card
  const armyId = unitCard.dataset.armyId;

  if (!cardUnitId || !armyId) {
    console.error("Card missing data-unit-id or data-army-id");
    return;
  }

  // Delegate based on the clicked element
  const modelElement = event.target.closest(".clickable-model");
  const woundButton = event.target.closest(".wound-apply-btn");
  const resetButton = event.target.closest(".wound-reset-btn");
  const addTokenButton = event.target.closest(".token-add-btn");
  const removeTokenButton = event.target.closest(".token-remove-btn");
  const viewSpellsButton = event.target.closest(".view-spells-btn");

  if (modelElement) {
    _handleModelWoundClick(modelElement, armyId, cardUnitId);
  } else if (woundButton) {
    _handleAutoWoundButtonClick(woundButton, armyId, cardUnitId);
  } else if (resetButton) {
    _handleResetWoundsClick(resetButton, armyId, cardUnitId);
  } else if (addTokenButton) {
    _handleAddTokenClick(addTokenButton, armyId, cardUnitId);
  } else if (removeTokenButton) {
    _handleRemoveTokenClick(removeTokenButton, armyId, cardUnitId);
  } else if (viewSpellsButton) {
    _handleViewSpellsClick(viewSpellsButton, armyId, cardUnitId);
  }
}

/**
 * Sets up the main event listeners for the page.
 * @param {string} armyId - The ID of the currently loaded army, needed for the start round button.
 */
export function setupEventListeners(armyId) {
  const mainListContainer = document.getElementById("army-units-container");
  if (mainListContainer) {
    // Use event delegation for unit card interactions
    // Remove listener first to prevent duplicates if called multiple times
    mainListContainer.removeEventListener(
      "click",
      handleUnitInteractionClick,
      false
    );
    // Add the listener
    mainListContainer.addEventListener(
      "click",
      handleUnitInteractionClick,
      false
    );
    console.log("Main unit interaction listener attached.");
  } else {
    console.error("Could not find mainListContainer to attach listeners.");
  }

  // Add listener for the global "Start Round" button
  const startRoundButton = document.getElementById("start-round-button");
  if (startRoundButton) {
    // Clone and replace to remove any previous listeners safely
    const newButton = startRoundButton.cloneNode(true);
    startRoundButton.parentNode.replaceChild(newButton, startRoundButton);
    // Add the new listener
    newButton.addEventListener("click", () => handleStartRoundClick(armyId));
    console.log("Start Round button listener attached.");
  } else {
    console.warn("Start Round button not found.");
  }
}
