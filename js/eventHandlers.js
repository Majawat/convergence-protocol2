/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
 */

// Imports from other modules
import { config } from "./config.js";
import {
  // State Getters
  getLoadedArmyData,
  getUnitData, // Assumes current army
  getJoinedHeroData, // Assumes current army
  getComponentStateValue, // Needs armyId
  getArmyBooksData,
  getCurrentArmyHeroTargets, // Assumes current army
  // State Updaters (These now handle load/save implicitly)
  updateArmyWoundState,
  updateArmyComponentState,
} from "./state.js";
// ****** REMOVED saveWoundState, saveComponentState imports ******
// import { saveWoundState, saveComponentState } from "./storage.js";
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
  // Use state functions that assume current army context or pass ID if needed
  const unitData = getUnitData(cardUnitId); // Assumes current army context
  if (unitData?.casterLevel > 0) {
    return unitData;
  }
  const heroData = getJoinedHeroData(cardUnitId); // Assumes current army context
  if (heroData?.casterLevel > 0) {
    return heroData;
  }
  return null;
}

// --- Action Functions ---

/**
 * Applies a wound to a specific model or uses auto-target logic.
 * Updates state (implicitly saving) and UI.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card where the interaction occurred.
 * @param {string | null} [specificModelId=null] - The modelId to wound directly, or null for auto-target.
 */
function applyWound(armyId, cardUnitId, specificModelId = null) {
  // Get data using functions that assume current army context
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) {
    console.error(
      `Base unit data not found for applyWound: unit ${cardUnitId}`
    );
    return;
  }
  const heroData = getJoinedHeroData(cardUnitId);

  let targetModel = null;
  let modelUnitId = null; // The actual selectionId of the unit the target model belongs to

  if (specificModelId) {
    // Manual Targeting
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
    // Auto Targeting
    targetModel = findTargetModelForWound(baseUnitData, heroData);
    if (targetModel) {
      modelUnitId = targetModel.isHero ? heroData.selectionId : cardUnitId;
    }
  }

  // Apply Wound if Target Found
  if (targetModel && modelUnitId) {
    targetModel.currentHp -= 1; // Apply wound to the model object in memory

    // Update the state (this now also handles saving)
    updateArmyWoundState(
      armyId, // Pass armyId here
      modelUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );

    // Update the UI display
    updateModelDisplay(
      cardUnitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );

    // ****** REMOVED explicit save call ******
    // saveWoundState(getArmyWoundStates());

    // Highlight the next model
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
  const currentArmy = getLoadedArmyData(armyId); // Get specific army
  if (!currentArmy || !currentArmy.units) {
    showToast("Error: Army data not loaded.");
    return;
  }

  let stateChanged = false;
  const casterUpdates = [];
  const heroTargets = getCurrentArmyHeroTargets(); // Assumes current army

  currentArmy.units.forEach((unit) => {
    if (unit.casterLevel > 0) {
      const casterUnitId = unit.selectionId;
      const currentTokens = getComponentStateValue(
        armyId,
        casterUnitId,
        "tokens",
        0
      ); // Pass armyId
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );
      const actualTokensAdded = newTokens - currentTokens;

      if (actualTokensAdded > 0) {
        // Update state (this now also handles saving)
        updateArmyComponentState(armyId, casterUnitId, "tokens", newTokens); // Pass armyId

        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
        });
        const cardUnitId = heroTargets?.[casterUnitId] || casterUnitId; // Use optional chaining
        updateTokenDisplay(cardUnitId, newTokens, unit.casterLevel);
        stateChanged = true;
      }
    }
  });

  // ****** REMOVED explicit save call ******
  // if (stateChanged) {
  //   saveComponentState(getArmyComponentStates());
  // }

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
  showToast(toastMessage, "Round Start");
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
  // Get data assuming current army context
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(cardUnitId);
  const heroId = heroData ? heroData.selectionId : null;

  console.log(
    `Resetting wounds for card unit ${cardUnitId}` +
      (heroId ? ` (and joined hero ${heroId})` : "")
  );

  let stateChanged = false; // Track if any changes were made

  // Reset base unit models
  baseUnitData.models.forEach((model) => {
    if (model.currentHp !== model.maxHp) {
      model.currentHp = model.maxHp; // Update model in memory first
      // Update state (this now saves implicitly)
      updateArmyWoundState(armyId, cardUnitId, model.modelId, model.currentHp);
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
        model.currentHp = model.maxHp; // Update model in memory first
        // Update state (this now saves implicitly)
        updateArmyWoundState(armyId, heroId, model.modelId, model.currentHp); // Use HERO's ID for state update
        updateModelDisplay(
          cardUnitId,
          model.modelId,
          model.currentHp,
          model.maxHp
        ); // UI update uses CARD ID
        stateChanged = true;
      }
    });
  }

  if (stateChanged) {
    // ****** REMOVED explicit save call ******
    // saveWoundState(getArmyWoundStates());
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
  ); // Pass armyId

  if (currentTokens < config.MAX_SPELL_TOKENS) {
    const newTokens = currentTokens + 1;
    // Update state (this now saves implicitly)
    updateArmyComponentState(armyId, casterUnitId, "tokens", newTokens); // Pass armyId
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
    // ****** REMOVED explicit save call ******
    // saveComponentState(getArmyComponentStates());
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
  ); // Pass armyId

  if (currentTokens > 0) {
    const newTokens = currentTokens - 1;
    // Update state (this now saves implicitly)
    updateArmyComponentState(armyId, casterUnitId, "tokens", newTokens); // Pass armyId
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
    // ****** REMOVED explicit save call ******
    // saveComponentState(getArmyComponentStates());
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
  ); // Pass armyId

  populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
}

/**
 * Handles clicks on the "Cast" button within the spell modal.
 * @param {HTMLElement} buttonElement - The clicked button element.
 * @private
 */
function _handleCastSpellClick(buttonElement) {
  const spellCost = parseInt(buttonElement.dataset.spellCost, 10);
  const spellName = decodeURIComponent(buttonElement.dataset.spellName);
  const casterId = buttonElement.dataset.casterId;
  const armyId = buttonElement.dataset.armyId; // Get armyId from button

  if (isNaN(spellCost) || !casterId || !armyId) {
    console.error("Cast button missing required data attributes.");
    showToast("Error casting spell: Missing data.", "Error");
    return;
  }

  const currentTokens = getComponentStateValue(armyId, casterId, "tokens", 0); // Pass armyId

  if (currentTokens >= spellCost) {
    const newTokens = currentTokens - spellCost;

    // 1. Update State (this now saves implicitly)
    updateArmyComponentState(armyId, casterId, "tokens", newTokens); // Pass armyId

    // 2. Update UI
    const heroTargets = getCurrentArmyHeroTargets(); // Assumes current army context
    const cardUnitId = heroTargets?.[casterId] || casterId; // Use optional chaining

    const casterUnitData = getUnitData(casterId); // Assumes current army context
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

    // Update buttons within the modal
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
      `Casting "${spellName}"! Roll 4+ to succeed (modifiers may apply).`,
      "Spell Cast"
    );
  } else {
    showToast(`Not enough tokens to cast ${spellName}.`, "Cast Failed");
  }
}

// --- Main Event Listener & Setup ---

/**
 * Handles clicks delegated from the main unit container or the spell modal.
 * Dispatches to specific handlers based on the clicked element.
 * @param {Event} event - The click event object.
 */
function handleInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  const spellModal = event.target.closest("#viewSpellsModal");

  if (unitCard) {
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
    const castButton = event.target.closest(".cast-spell-btn");
    if (castButton) {
      _handleCastSpellClick(castButton); // Pass the button itself
    }
  }
}

/**
 * Sets up the main event listeners for the page.
 * @param {string} armyId - The ID of the currently loaded army, needed for the start round button.
 */
export function setupEventListeners(armyId) {
  // Use event delegation on the document body
  document.body.removeEventListener("click", handleInteractionClick);
  document.body.addEventListener("click", handleInteractionClick);
  console.log("Global interaction click listener attached to document body.");

  // Add listener for the global "Start Round" button
  const startRoundButton = document.getElementById("start-round-button");
  if (startRoundButton) {
    const newButton = startRoundButton.cloneNode(true);
    startRoundButton.parentNode.replaceChild(newButton, startRoundButton);
    newButton.addEventListener("click", () => handleStartRoundClick(armyId)); // Pass armyId here
    console.log("Start Round button listener attached.");
  } else {
    console.warn("Start Round button not found.");
  }
}
