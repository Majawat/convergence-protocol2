/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
 * Refactored to delegate clicks to specific handler functions for clarity.
 * Added JSDoc comments and inline explanations.
 */

// Imports from other modules
import { config, STAT_ICONS } from "./config.js";
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
import { showToast, populateAndShowSpellModal } from "./uiHelpers.js"; // showToast is already imported

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

  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
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
  if (unitData?.casterLevel > 0) {
    return unitData;
  }
  const heroData = getJoinedHeroData(armyId, cardUnitId);
  if (heroData?.casterLevel > 0) {
    return heroData;
  }
  return null;
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
  if (!armyData) return;
  const baseUnitData = getUnitData(armyId, cardUnitId);
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(armyId, cardUnitId);

  let targetModel = null;
  let modelUnitId = null;

  if (specificModelId) {
    targetModel = baseUnitData.models.find(
      (m) => m.modelId === specificModelId
    );
    if (targetModel) {
      modelUnitId = cardUnitId;
    } else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelUnitId = heroData.selectionId;
      }
    }

    if (targetModel && targetModel.currentHp <= 0) {
      showToast(
        `Model ${targetModel.modelId.split("_").pop()} is already removed.`
      );
      targetModel = null;
      modelUnitId = null;
    }
  } else {
    targetModel = findTargetModelForWound(baseUnitData, heroData);
    if (targetModel) {
      modelUnitId = targetModel.isHero ? heroData.selectionId : cardUnitId;
    }
  }

  if (targetModel && modelUnitId) {
    targetModel.currentHp -= 1;
    updateGlobalWoundState(
      armyId,
      modelUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );
    updateModelDisplay(
      cardUnitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );
    saveWoundState(getArmyWoundStates());
    const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
    _highlightNextAutoTargetModel(
      cardUnitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    showToast("All models in unit removed.");
    _clearTargetHighlight(cardUnitId);
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
    showToast("Error: Army data not loaded.");
    return;
  }

  let stateChanged = false;
  const casterUpdates = [];
  const heroTargets = getCurrentArmyHeroTargets(armyId) || {};

  currentArmy.units.forEach((unit) => {
    if (unit.casterLevel > 0) {
      const casterUnitId = unit.selectionId;
      const currentTokens = getComponentStateValue(
        armyId,
        casterUnitId,
        "tokens",
        0
      );
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );
      const actualTokensAdded = newTokens - currentTokens;

      if (actualTokensAdded > 0) {
        updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);
        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
        });
        const cardUnitId = heroTargets[casterUnitId] || casterUnitId;
        updateTokenDisplay(cardUnitId, newTokens, unit.casterLevel);
        stateChanged = true;
      }
    }
  });

  if (stateChanged) {
    saveComponentState(getArmyComponentStates());
  }

  let toastMessage = "Spell Tokens Generated:";
  if (casterUpdates.length > 0) {
    casterUpdates.forEach((update) => {
      toastMessage += `\n- ${update.name}: +${update.added
        .toString()
        .padStart(1, "\u00A0")}, now ${update.total}`;
    });
  } else {
    toastMessage = "No casters required token updates.";
  }
  showToast(toastMessage, "Round Start"); // Use custom title
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
    applyWound(armyId, cardUnitId, modelId);
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
  applyWound(armyId, cardUnitId, null);
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

  let stateChanged = false;

  // Reset base unit models
  baseUnitData.models.forEach((model) => {
    if (model.currentHp !== model.maxHp) {
      model.currentHp = model.maxHp;
      updateGlobalWoundState(
        armyId,
        cardUnitId,
        model.modelId,
        model.currentHp
      );
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
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp);
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
    saveWoundState(getArmyWoundStates());
    showToast(
      `Wounds reset for ${
        baseUnitData.customName || baseUnitData.originalName
      }.`
    );
  }

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
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  if (currentTokens < config.MAX_SPELL_TOKENS) {
    const newTokens = currentTokens + 1;
    updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);
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
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  if (currentTokens > 0) {
    const newTokens = currentTokens - 1;
    updateGlobalComponentState(armyId, casterUnitId, "tokens", newTokens);
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
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const casterFactionId = actualCasterUnit.factionId;
  const armyBooks = getArmyBooksData();
  const spellList = armyBooks[casterFactionId]?.spells || null;
  const currentTokens = getComponentStateValue(
    armyId,
    casterUnitId,
    "tokens",
    0
  );

  populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
}

// ****** START NEW CODE ******
/**
 * Handles clicks on the "Cast" button within the spell modal.
 * @param {HTMLElement} buttonElement - The clicked button element.
 * @private
 */
function _handleCastSpellClick(buttonElement) {
  const spellCost = parseInt(buttonElement.dataset.spellCost, 10);
  const spellName = decodeURIComponent(buttonElement.dataset.spellName);
  const casterId = buttonElement.dataset.casterId;
  const armyId = buttonElement.dataset.armyId;

  if (isNaN(spellCost) || !casterId || !armyId) {
    console.error("Cast button missing required data attributes.");
    showToast("Error casting spell: Missing data.", "Error");
    return;
  }

  const currentTokens = getComponentStateValue(armyId, casterId, "tokens", 0);

  if (currentTokens >= spellCost) {
    const newTokens = currentTokens - spellCost;

    // 1. Update State
    updateGlobalComponentState(armyId, casterId, "tokens", newTokens);
    saveComponentState(getArmyComponentStates());

    // 2. Update UI
    // Find the card this caster belongs to (could be the caster itself or the unit it joined)
    const heroTargets = getCurrentArmyHeroTargets(armyId) || {};
    const cardUnitId = Object.keys(heroTargets).find(
      (hero) => hero === casterId
    )
      ? heroTargets[casterId] // If caster is a hero, find the unit it joined
      : casterId; // Otherwise, the caster is the base unit

    const casterUnitData = getUnitData(armyId, casterId); // Get caster data for level
    if (casterUnitData) {
      updateTokenDisplay(cardUnitId, newTokens, casterUnitData.casterLevel); // Update main card display
    }

    // Update token display inside the modal
    const modalTokenDisplay = document.getElementById(
      "modalCasterTokenDisplay"
    );
    if (modalTokenDisplay) {
      modalTokenDisplay.innerHTML = `${STAT_ICONS.spellTokens} Tokens: <span class="fw-bold">${newTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
    }

    // Update buttons within the modal (disable unaffordable ones)
    const modalElement = document.getElementById("viewSpellsModal");
    if (modalElement) {
      modalElement.querySelectorAll(".cast-spell-btn").forEach((btn) => {
        const cost = parseInt(btn.dataset.spellCost, 10);
        if (!isNaN(cost)) {
          btn.disabled = newTokens < cost;
        }
      });
    }

    // 3. Show Feedback Toast
    showToast(
      `Casting ${spellName}!\nRoll 4+ to succeed. Other Casters within 18" may spend a Spell Token to modify this roll.`,
      "Spell Cast"
    );
  } else {
    console.warn(`Attempted to cast ${spellName} but not enough tokens.`);
    showToast(`Not enough tokens to cast ${spellName}.`, "Cast Failed");
  }
}
// ****** END NEW CODE ******

// --- Main Event Listener & Setup ---

/**
 * Handles clicks delegated from the main unit container or the spell modal.
 * Dispatches to specific handlers based on the clicked element.
 * @param {Event} event - The click event object.
 */
function handleInteractionClick(event) {
  // Renamed for broader scope
  const unitCard = event.target.closest(".unit-card");
  const spellModal = event.target.closest("#viewSpellsModal"); // Check if click is inside spell modal

  if (unitCard) {
    // --- Handle Clicks within Unit Cards ---
    const cardUnitId = unitCard.dataset.unitId;
    const armyId = unitCard.dataset.armyId;
    if (!cardUnitId || !armyId) return;

    const modelElement = event.target.closest(".clickable-model");
    const woundButton = event.target.closest(".wound-apply-btn");
    const resetButton = event.target.closest(".wound-reset-btn");
    const addTokenButton = event.target.closest(".token-add-btn");
    const removeTokenButton = event.target.closest(".token-remove-btn");
    const viewSpellsButton = event.target.closest(".view-spells-btn");

    if (modelElement) _handleModelWoundClick(modelElement, armyId, cardUnitId);
    else if (woundButton)
      _handleAutoWoundButtonClick(woundButton, armyId, cardUnitId);
    else if (resetButton)
      _handleResetWoundsClick(resetButton, armyId, cardUnitId);
    else if (addTokenButton)
      _handleAddTokenClick(addTokenButton, armyId, cardUnitId);
    else if (removeTokenButton)
      _handleRemoveTokenClick(removeTokenButton, armyId, cardUnitId);
    else if (viewSpellsButton)
      _handleViewSpellsClick(viewSpellsButton, armyId, cardUnitId);
  } else if (spellModal) {
    // --- Handle Clicks within Spell Modal ---
    const castButton = event.target.closest(".cast-spell-btn");
    if (castButton) {
      _handleCastSpellClick(castButton);
    }
    // Add handlers for other modal interactions here if needed
  }
}

/**
 * Sets up the main event listeners for the page.
 * @param {string} armyId - The ID of the currently loaded army, needed for the start round button.
 */
export function setupEventListeners(armyId) {
  // Use event delegation on the document body for broader coverage,
  // including dynamically added modals.
  document.body.removeEventListener("click", handleInteractionClick); // Remove previous listener if any
  document.body.addEventListener("click", handleInteractionClick);
  console.log("Global interaction click listener attached to document body.");

  // Add listener for the global "Start Round" button (no change here)
  const startRoundButton = document.getElementById("start-round-button");
  if (startRoundButton) {
    const newButton = startRoundButton.cloneNode(true);
    startRoundButton.parentNode.replaceChild(newButton, startRoundButton);
    newButton.addEventListener("click", () => handleStartRoundClick(armyId));
    console.log("Start Round button listener attached.");
  } else {
    console.warn("Start Round button not found.");
  }
}
