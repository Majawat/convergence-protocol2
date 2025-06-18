/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
 * Includes logic for applying wounds, managing tokens, actions, morale,
 * stratagems, and resetting state.
 */

// Imports from other modules
import { config, UI_ICONS } from "./config.js";
import {
  // State Getters
  getLoadedArmyData,
  getUnitData,
  getJoinedHeroData,
  getUnitStateValue,
  getArmyBooksData,
  getArmyNameById,
  getCurrentArmyHeroTargets,
  getCurrentArmyId,
  getAllLoadedArmyData,
  setKilledByStatus,
  getCurrentRound,
  getCommandPoints,
  getMaxCommandPoints,
  getSelectedDoctrine,
  getDoctrinesData,
  getUnderdogPoints,
  getMaxUnderdogPoints,
  getIsGameFinished,
  // State Updaters
  updateModelStateValue,
  updateUnitStateValue,
  incrementCurrentRound,
  addRecordedKill,
  setIsGameFinished,
  setCasualtyOutcome,
  setCommandPoints,
  setSelectedDoctrine,
  setUnderdogPoints,
} from "./state.js";
import { loadArmyState, saveArmyState, resetArmyState } from "./storage.js";
import { findTargetModelForWound, calculateArmyXP, checkHalfStrength } from "./gameLogic.js";
import {
  updateModelDisplay,
  updateTokenDisplay,
  updateActionButtonsUI,
  resetAllActionButtonsUI,
  updateFatiguedStatusUI,
  updateShakenStatusUI,
  collapseDestroyedCard,
  collapseRoutedCard,
  resetCardUI,
  createOpponentSelectionModal,
  populateOpponentUnitDropdown,
  updateKillCountBadge,
  updateKilledByStatusDisplay,
} from "./ui.js";
import {
  showToast,
  showInteractiveToast,
  populateAndShowSpellModal,
  updateRoundUI,
  updateCommandPointsDisplay,
  showResultsModal,
  populateDoctrineSelector,
  displayStratagems,
  handleFocusReturn,
  updateUnderdogPointsDisplay,
  setElementToFocusAfterClose,
  updateOffcanvasUnitStatus,
} from "./uiHelpers.js";

// --- Internal Helper Functions ---

/**
 * Clears the target highlight from models within a specific unit card.
 * @param {string} unitSelectionId - The selectionId of the unit card.
 * @private
 */
function _clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) highlighted.classList.remove("target-model");
}

/**
 * Highlights the specified model element within a unit card as the next auto-target.
 * @param {string} unitSelectionId - The selectionId of the unit card.
 * @param {string | null} modelId - The ID of the model to highlight, or null to clear.
 * @private
 */
function _highlightNextAutoTargetModel(unitSelectionId, modelId) {
  _clearTargetHighlight(unitSelectionId);
  if (!modelId) return;
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (modelElement && modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`) {
    modelElement.classList.add("target-model");
  }
}

/**
 * Finds the actual caster unit (either base or joined hero) for a given card ID.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @returns {object | null} The processed caster unit data, or null if not a caster.
 * @private
 */
function _findActualCaster(cardUnitId) {
  const unitData = getUnitData(cardUnitId);
  if (unitData?.casterLevel > 0) return unitData;
  const heroData = getJoinedHeroData(cardUnitId);
  if (heroData?.casterLevel > 0) return heroData;
  return null;
}

// --- Action Functions ---

/**
 * Applies a wound to a model in the unit.
 * Handles auto-targeting or specific model targeting.
 * Updates model HP, checks for unit destruction, and updates UI.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @param {string | null} [specificModelId=null] - The ID of the specific model to wound, or null for auto-target.
 */
function applyWound(armyId, cardUnitId, specificModelId = null) {
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) {
    console.error(`Base unit data not found for applyWound: unit ${cardUnitId}`);
    return;
  }
  const heroData = getJoinedHeroData(cardUnitId);
  let targetModel = null;
  let modelUnitId = null; // The ID of the unit the target model belongs to (base or hero)

  // --- Determine Target Model ---
  if (specificModelId) {
    // Find the specific model in base or hero unit
    targetModel = baseUnitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel) {
      modelUnitId = cardUnitId;
    } else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) modelUnitId = heroData.selectionId;
    }
    // Check if the specifically targeted model is already removed
    if (targetModel && targetModel.currentHp <= 0) {
      showToast(`Model ${targetModel.modelId.split("_").pop()} is already removed.`);
      targetModel = null; // Don't proceed with wounding
      modelUnitId = null;
    }
  } else {
    // Auto-target: Find the next model according to rules
    targetModel = findTargetModelForWound(baseUnitData, heroData);
    if (targetModel) {
      modelUnitId = targetModel.isHero ? heroData.selectionId : cardUnitId;
    }
  }

  // --- Apply Wound if Target Found ---
  if (targetModel && modelUnitId) {
    const newHp = Math.max(0, targetModel.currentHp - 1);
    targetModel.currentHp = newHp; // Update in-memory model (important for subsequent calls)
    updateModelStateValue(armyId, modelUnitId, targetModel.modelId, "currentHp", newHp);
    updateModelDisplay(cardUnitId, targetModel.modelId, newHp, targetModel.maxHp);

    // --- Check for Unit Destruction ---
    // Re-fetch data to ensure we have the latest HP values after potential updates
    const baseUnitDataForDestroyCheck = getUnitData(cardUnitId);
    const heroDataForDestroyCheck = getJoinedHeroData(cardUnitId);
    const allModels = [
      ...(baseUnitDataForDestroyCheck?.models || []),
      ...(heroDataForDestroyCheck?.models || []),
    ];
    const currentStatus = getUnitStateValue(armyId, cardUnitId, "status", "active");
    const isUnitDestroyed =
      currentStatus === "active" && // Only destroy if currently active
      allModels.length > 0 &&
      allModels.every((m) => m.currentHp <= 0);

    if (isUnitDestroyed) {
      console.log(`Unit ${cardUnitId} (and potentially joined hero) is Destroyed.`);
      // Update state for base unit
      updateUnitStateValue(armyId, cardUnitId, "status", "destroyed");
      // Update state for hero unit if present
      if (heroDataForDestroyCheck) {
        updateUnitStateValue(armyId, heroDataForDestroyCheck.selectionId, "status", "destroyed");
      }

      // Update UI
      collapseDestroyedCard(cardUnitId);
      updateOffcanvasUnitStatus(armyId, cardUnitId);
      showToast(
        `${baseUnitDataForDestroyCheck?.customName || cardUnitId} Destroyed!`,
        "Unit Destroyed"
      );
      _clearTargetHighlight(cardUnitId); // Clear highlight on destruction
      console.log(`Triggering 'Set Killed By' modal for destroyed unit ${cardUnitId}`);
      createOpponentSelectionModal(cardUnitId, armyId, "setKilledBy");
    } else {
      // Highlight the next model to be wounded if the unit is not destroyed
      const nextAutoTarget = findTargetModelForWound(
        baseUnitDataForDestroyCheck,
        heroDataForDestroyCheck
      );
      _highlightNextAutoTargetModel(cardUnitId, nextAutoTarget ? nextAutoTarget.modelId : null);
    }
  } else {
    // No valid target model found (either none left or specific target invalid)
    const currentStatus = getUnitStateValue(armyId, cardUnitId, "status", "active");
    if (currentStatus === "active") {
      showToast("All models in unit removed.");
    }
    _clearTargetHighlight(cardUnitId); // Clear highlight if no models left
  }
}

/**
 * Handles the 'Start New Round' button click.
 * Increments round, updates UI, resets statuses, generates tokens.
 * @param {string} armyId - The ID of the current army.
 */
function handleStartRoundClick(armyId) {
  console.log(`--- Starting New Round for Army ${armyId} ---`);
  const newRound = incrementCurrentRound();
  console.log(`Round incremented to ${newRound}`);

  // Update Round Display and Button using the helper function
  updateRoundUI(newRound);

  const currentArmyProcessedData = getLoadedArmyData();
  if (!currentArmyProcessedData || !currentArmyProcessedData.units) {
    showToast("Error: Army data not loaded.", "Error");
    return;
  }
  let armyState = loadArmyState(armyId);
  if (!armyState) {
    console.error(`Could not load state for army ${armyId} to start round.`);
    showToast("Error loading army state.", "Error");
    return;
  }
  if (!armyState.units) armyState.units = {};

  let stateChanged = false;
  const casterUpdates = [];
  const heroTargets = getCurrentArmyHeroTargets();
  const unitsToUpdateOffcanvas = new Set(); // Track units needing offcanvas update

  currentArmyProcessedData.units.forEach((unit) => {
    const unitId = unit.selectionId;
    if (!armyState.units[unitId]) {
      // Initialize state if missing (shouldn't happen often after app.js init)
      armyState.units[unitId] = {
        status: "active",
        shaken: false,
        fatigued: false,
        attackedInMeleeThisRound: false,
        action: null,
        limitedWeaponUsed: false,
        tokens: 0,
        models: {},
        killsRecorded: [],
        killedBy: null,
      };
      stateChanged = true;
    }
    const unitState = armyState.units[unitId];
    // Skip updates for units already removed from play
    if (unitState.status === "destroyed" || unitState.status === "routed") {
      return;
    }

    // Determine the card ID (could be the base unit or the hero if joined)
    const cardId = heroTargets?.[unitId] || unitId;

    // Reset action
    if (unitState.action !== null) {
      unitState.action = null;
      stateChanged = true;
      unitsToUpdateOffcanvas.add(cardId); // Mark for offcanvas update
    }
    // Reset fatigue
    if (unitState.fatigued !== false) {
      unitState.fatigued = false;
      updateFatiguedStatusUI(cardId, false); // Update card indicator
      stateChanged = true;
      unitsToUpdateOffcanvas.add(cardId); // Mark for offcanvas update
    }
    // Reset melee attack flag
    if (unitState.attackedInMeleeThisRound !== false) {
      unitState.attackedInMeleeThisRound = false;
      stateChanged = true;
    }

    // Generate spell tokens for casters
    if (unit.casterLevel > 0) {
      const currentTokens = unitState.tokens || 0;
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(config.MAX_SPELL_TOKENS, currentTokens + tokensToAdd);
      const actualTokensAdded = newTokens - currentTokens;
      if (actualTokensAdded > 0) {
        unitState.tokens = newTokens;
        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
          unitId: unitId, // Use actual caster unit ID
          casterLevel: unit.casterLevel,
        });
        stateChanged = true;
      }
    }
  });

  if (stateChanged) {
    saveArmyState(armyId, armyState);
    console.log(`State updated and saved for start of round ${newRound} for army ${armyId}.`);
  }

  // Update UI after state is saved
  resetAllActionButtonsUI(); // Resets buttons on cards

  // Update offcanvas for units whose state changed
  unitsToUpdateOffcanvas.forEach((id) => updateOffcanvasUnitStatus(armyId, id));

  updateGameControlButtons(); // Update button text/visibility/listeners

  // Display toast message
  let toastMessage = `Round ${newRound} Started!\nAll Unit Actions & Fatigue reset.`;
  if (casterUpdates.length > 0) {
    toastMessage += "\nSpell Tokens Generated:";
    casterUpdates.forEach((update) => {
      const cardUnitId = heroTargets?.[update.unitId] || update.unitId; // Find the card ID
      updateTokenDisplay(cardUnitId, update.total, update.casterLevel); // Update card display
      toastMessage += `\n- ${update.name}: +${update.added.toString().padStart(1, "\u00A0")}, now ${
        update.total
      }`;
    });
  } else {
    toastMessage += "\nNo casters required token updates.";
  }
  showToast(toastMessage, `Round ${newRound}`);
}

// --- Specific Click Handlers ---

/**
 * Handles clicking on a specific model display element to apply a wound.
 * @param {HTMLElement} targetElement - The clicked model element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
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
 * Handles clicking the auto-wound button in the card header.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
function _handleAutoWoundButtonClick(targetElement, armyId, cardUnitId) {
  applyWound(armyId, cardUnitId, null); // Pass null for auto-target
}

/**
 * Handles clicking the reset button in the card header.
 * Prompts for confirmation, then resets the unit's state (HP, status, action).
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
async function _handleResetUnitClick(targetElement, armyId, cardUnitId) {
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(cardUnitId);
  const heroId = heroData ? heroData.selectionId : null;

  // Confirmation prompt
  const confirmReset = await showInteractiveToast(
    `Reset ${baseUnitData.customName || baseUnitData.originalName} (HP, Status, Action)?`,
    "Confirm Reset",
    [
      { text: "Reset", value: "reset", style: "danger" },
      { text: "Cancel", value: "cancel", style: "secondary" },
    ]
  );

  if (confirmReset !== "reset") {
    console.log("Unit reset cancelled.");
    return;
  }

  console.log(
    `Resetting unit state for card unit ${cardUnitId}` +
      (heroId ? ` (and joined hero ${heroId})` : "")
  );

  let stateChanged = false;
  let armyState = loadArmyState(armyId);
  if (!armyState || !armyState.units) {
    console.error(`Cannot reset unit: State not found for army ${armyId}`);
    return;
  }

  // Helper function to reset state for a single unit (base or hero)
  const resetUnitState = (unitId, unitData) => {
    if (!armyState.units[unitId]) return false; // Skip if state doesn't exist

    const unitState = armyState.units[unitId];
    let unitModified = false;

    // Reset statuses
    if (unitState.shaken !== false) {
      unitState.shaken = false;
      unitModified = true;
    }
    if (unitState.fatigued !== false) {
      unitState.fatigued = false;
      unitModified = true;
    }
    if (unitState.attackedInMeleeThisRound !== false) {
      unitState.attackedInMeleeThisRound = false;
      unitModified = true;
    }
    if (unitState.action !== null) {
      unitState.action = null;
      unitModified = true;
    }
    if (unitState.status !== "active") {
      unitState.status = "active";
      unitModified = true;
    }

    // Reset model HP
    unitData.models.forEach((model) => {
      if (!unitState.models) unitState.models = {}; // Ensure models object exists
      if (!unitState.models[model.modelId]) unitState.models[model.modelId] = {}; // Ensure model object exists

      if (unitState.models[model.modelId].currentHp !== model.maxHp) {
        unitState.models[model.modelId].currentHp = model.maxHp;
        // Update in-memory data as well
        const targetModel = (getUnitData(unitId)?.models || []).find(
          (m) => m.modelId === model.modelId
        );
        if (targetModel) targetModel.currentHp = model.maxHp;
        // Update display for this specific model
        updateModelDisplay(cardUnitId, model.modelId, model.maxHp, model.maxHp);
        unitModified = true;
      }
    });

    // Reset killedBy
    if (unitState.killedBy) {
      unitState.killedBy = null;
      unitModified = true;
    }
    return unitModified;
  };

  // Reset state for base unit and hero (if applicable)
  if (resetUnitState(cardUnitId, baseUnitData)) stateChanged = true;
  if (heroData && heroId && resetUnitState(heroId, heroData)) stateChanged = true;

  // Save state if changes were made
  if (stateChanged) {
    saveArmyState(armyId, armyState);
    showToast(
      `Unit state reset for ${baseUnitData.customName || baseUnitData.originalName}.`,
      "Unit Reset"
    );
    // Update the offcanvas after saving the reset state
    updateOffcanvasUnitStatus(armyId, cardUnitId);
  }

  // Reset the card's overall UI appearance
  resetCardUI(cardUnitId);

  // Re-highlight the next target model
  const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
  _highlightNextAutoTargetModel(cardUnitId, nextAutoTarget ? nextAutoTarget.modelId : null);
}

/**
 * Handles click on the "End Game" button. Calculates XP, shows results, marks game as finished.
 */
async function _handleEndGameClick() {
  console.log("End Game button clicked.");
  const armyId = getCurrentArmyId();
  if (!armyId) {
    showToast("No active army found.", "Error");
    return;
  }
  const armyName = getArmyNameById(armyId);

  // Confirmation
  const confirmEnd = await showInteractiveToast(
    `End the game and calculate final XP for ${armyName}?`,
    "Confirm End Game",
    [
      {
        text: "End Game",
        value: "end",
        style: "warning",
      },
      {
        text: "Cancel",
        value: "cancel",
        style: "secondary",
      },
    ]
  );

  if (confirmEnd !== "end") {
    console.log("End game cancelled.");
    return;
  }

  // Calculate XP
  const xpResults = calculateArmyXP(armyId);
  if (!xpResults) {
    showToast("Failed to calculate XP results.", "Error");
    return;
  }

  // Show Results Modal (Make sure showResultsModal is imported correctly)
  showResultsModal(xpResults, armyId);

  // Mark Game as Finished in State
  setIsGameFinished(true);

  // Update Control Buttons UI to reflect finished state
  updateGameControlButtons();
}

/**
 * Handles click on the main control button WHEN it's in the "Show Results" state.
 */
function _handleShowResultsClick() {
  console.log("Show Results button clicked.");
  const armyId = getCurrentArmyId();
  if (!armyId) {
    showToast("No active army found.", "Error");
    return;
  }

  // Calculate XP (in case state changed since game ended via casualty outcome selection)
  const xpResults = calculateArmyXP(armyId);
  if (!xpResults) {
    showToast("Failed to calculate XP results.", "Error");
    return;
  }

  // Show Results Modal
  showResultsModal(xpResults, armyId);
}

/**
 * Handles changes to the Casualty Outcome dropdown inside the results modal.
 * @param {Event} event - The change event object.
 */
function _handleCasualtyOutcomeChange(event) {
  const selectElement = event.target;
  const { armyId, unitId } = selectElement.dataset;
  const selectedValue = selectElement.value;

  if (!armyId || !unitId) {
    console.error("Casualty dropdown missing data attributes.");
    return;
  }

  console.log(`Casualty outcome changed for ${unitId}: ${selectedValue}`);
  setCasualtyOutcome(armyId, unitId, selectedValue); // Update state (saves automatically)
  showToast(`Outcome for unit ${unitId} saved.`, "Casualty Update", 2000);
}

/**
 * Handles clicking the add token button for a caster unit.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
function _handleAddTokenClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(cardUnitId);
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }
  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0);
  if (currentTokens < config.MAX_SPELL_TOKENS) {
    const newTokens = currentTokens + 1;
    updateUnitStateValue(armyId, casterUnitId, "tokens", newTokens);
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
  } else {
    showToast(`Cannot exceed maximum tokens (${config.MAX_SPELL_TOKENS}).`);
  }
}

/**
 * Handles clicking the remove token button for a caster unit.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
function _handleRemoveTokenClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(cardUnitId);
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }
  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0);
  if (currentTokens > 0) {
    const newTokens = currentTokens - 1;
    updateUnitStateValue(armyId, casterUnitId, "tokens", newTokens);
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
  }
}

/**
 * Handles clicking the view spells button for a caster unit.
 * Populates and shows the spell modal.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
function _handleViewSpellsClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(cardUnitId);
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }
  const casterUnitId = actualCasterUnit.selectionId;
  const casterFactionId = actualCasterUnit.factionId; // Use stored faction ID
  const armyBooks = getArmyBooksData();
  const spellList = armyBooks[casterFactionId]?.spells || null; // Get spells for the caster's faction
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0);

  populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
}

/**
 * Handles clicking the cast spell button within the spell modal.
 * Reduces tokens, updates UI, and shows a confirmation toast.
 * @param {HTMLButtonElement} buttonElement - The clicked cast button.
 * @private
 */
function _handleCastSpellClick(buttonElement) {
  const spellCost = parseInt(buttonElement.dataset.spellCost, 10);
  const spellName = decodeURIComponent(buttonElement.dataset.spellName);
  const casterId = buttonElement.dataset.casterId; // This is the actual caster unit's ID
  const armyId = buttonElement.dataset.armyId;

  if (isNaN(spellCost) || !casterId || !armyId) {
    console.error("Cast button missing required data attributes.");
    showToast("Error casting spell: Missing data.", "Error");
    return;
  }

  const currentTokens = getUnitStateValue(armyId, casterId, "tokens", 0);

  if (currentTokens >= spellCost) {
    const newTokens = currentTokens - spellCost;
    updateUnitStateValue(armyId, casterId, "tokens", newTokens);

    // Find the card ID this caster belongs to (could be hero joined to another unit)
    const heroTargets = getCurrentArmyHeroTargets();
    let cardUnitId = casterId; // Assume caster is the base unit initially
    // Check if this caster ID is a hero joined to another unit
    const targetUnitId = heroTargets?.[casterId];
    if (targetUnitId) {
      cardUnitId = targetUnitId; // The card ID is the unit the hero joined
    }

    // Update the token display on the correct card
    const casterUnitData = getUnitData(casterId); // Get data for the actual caster
    if (casterUnitData) {
      updateTokenDisplay(cardUnitId, newTokens, casterUnitData.casterLevel);
    }

    // Update token count in the modal
    const modalTokenDisplay = document.getElementById("modalCasterTokenDisplay");
    if (modalTokenDisplay) {
      modalTokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${newTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
    }

    // Update button disabled states in the modal
    const modalElement = document.getElementById("viewSpellsModal");
    if (modalElement) {
      modalElement.querySelectorAll(".cast-spell-btn").forEach((btn) => {
        const cost = parseInt(btn.dataset.spellCost, 10);
        if (!isNaN(cost)) {
          btn.disabled = newTokens < cost;
        }
      });
    }

    // Show confirmation toast
    showToast(
      `Casting ${spellName}! Player rolls 4+ to succeed.\nCasters within 18" may spend a Spell Token to modify the roll.`,
      "Spell Cast"
    );
  } else {
    showToast(`Not enough tokens to cast ${spellName}.`, "Cast Failed");
  }
}

/**
 * Handles clicking an action button (Hold, Advance, Rush, Charge, Recover).
 * Updates the unit's action state, fatigue status (for Charge), and UI.
 * Triggers melee resolution flow immediately after a Charge action.
 * @param {HTMLElement} targetElement - The clicked action button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
async function _handleActionButtonClick(targetElement, armyId, cardUnitId) {
  const actionType = targetElement.dataset.action;
  if (!actionType) return;

  const isShaken = getUnitStateValue(armyId, cardUnitId, "shaken", false);
  const currentAction = getUnitStateValue(armyId, cardUnitId, "action", null);
  const unitData = getUnitData(cardUnitId); // Base unit data for the card
  if (!unitData) return; // Need unit data

  // --- Handle Shaken Units ---
  if (isShaken) {
    if (actionType === "Recover") {
      console.log(`Unit ${cardUnitId} recovering from Shaken.`);
      updateUnitStateValue(armyId, cardUnitId, "shaken", false);
      updateUnitStateValue(armyId, cardUnitId, "action", null); // Deactivate after recovery
      updateShakenStatusUI(cardUnitId, false); // Update card indicator & buttons
      updateOffcanvasUnitStatus(armyId, cardUnitId);
      showToast(`${unitData?.customName || cardUnitId} recovered from Shaken.`, "Recovery");
    } else {
      // Prevent other actions if shaken
      showToast("Shaken unit must Recover.", "Action Blocked");
    }
    return; // Stop further processing if shaken
  }

  // --- Handle Non-Shaken Units ---
  let newAction = null;
  if (currentAction === actionType) {
    // Deactivate if clicking the currently active action
    newAction = null;
    console.log(`Unit ${cardUnitId} deactivated.`);
    updateUnitStateValue(armyId, cardUnitId, "action", newAction);
    updateActionButtonsUI(cardUnitId, newAction, false); // Update card buttons
    updateOffcanvasUnitStatus(armyId, cardUnitId);
  } else {
    // Activate with the new action
    newAction = actionType;
    console.log(`Unit ${cardUnitId} activated with action: ${newAction}`);
    updateUnitStateValue(armyId, cardUnitId, "action", newAction);
    updateActionButtonsUI(cardUnitId, newAction, false); // Update card buttons
    updateOffcanvasUnitStatus(armyId, cardUnitId);

    // --- Specific Logic for Charge Action ---
    if (newAction === "Charge") {
      // Apply fatigue if first melee attack this round
      const isFirstMeleeCharge = !getUnitStateValue(
        armyId,
        cardUnitId,
        "attackedInMeleeThisRound",
        false
      );
      if (isFirstMeleeCharge) {
        updateUnitStateValue(armyId, cardUnitId, "fatigued", true);
        updateUnitStateValue(armyId, cardUnitId, "attackedInMeleeThisRound", true);
        updateFatiguedStatusUI(cardUnitId, true); // Update card indicator
        updateOffcanvasUnitStatus(armyId, cardUnitId);
        console.log(`Unit ${cardUnitId} is now Fatigued from charging.`);
      }

      // --- Immediately trigger melee resolution flow for the CHARGER ---
      console.log(`Resolving melee outcome for charger ${cardUnitId}`);
      const heroData = getJoinedHeroData(cardUnitId); // Get hero data if present
      const effectiveQuality = heroData ? heroData.quality : unitData.quality; // Use hero quality if joined

      // 1. Ask for Melee Outcome (for the CHARGING unit)
      const outcome = await showInteractiveToast(
        `Did ${unitData.customName || cardUnitId} (the Charger) WIN, LOSE, or TIE the melee?`,
        "Melee: Charger Outcome?",
        [
          { text: "Win", value: "Win", style: "success" },
          { text: "Lose", value: "Lose", style: "danger" },
          { text: "Tie", value: "Tie", style: "warning" },
        ]
      );

      if (outcome === "Lose") {
        console.log(`Charging unit ${cardUnitId} lost melee. Checking morale.`);
        // 2. Ask for Morale Result
        const moraleResult = await showInteractiveToast(
          `MELEE MORALE TEST (Quality ${effectiveQuality}+): Did ${
            unitData.customName || cardUnitId
          } PASS or FAIL?`,
          "Melee: Charger Morale",
          [
            { text: "Pass", value: "Pass", style: "success" },
            { text: "Fail", value: "Fail", style: "danger" },
          ]
        );

        if (moraleResult === "Fail") {
          // 3. Check half strength for Routing
          const isHalf = checkHalfStrength(unitData); // Check base unit strength

          if (isHalf) {
            console.log(`Unit ${cardUnitId} fails morale at half strength -> ROUTED!`);
            updateUnitStateValue(armyId, cardUnitId, "status", "routed");
            // Update hero status if joined
            if (heroData) updateUnitStateValue(armyId, heroData.selectionId, "status", "routed");
            collapseRoutedCard(cardUnitId); // Update card UI
            updateOffcanvasUnitStatus(armyId, cardUnitId);
            showToast(`${unitData.customName || cardUnitId} Routed!`, "Melee Outcome");
          } else {
            console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
            updateUnitStateValue(armyId, cardUnitId, "shaken", true);
            updateShakenStatusUI(cardUnitId, true); // Update card UI
            updateOffcanvasUnitStatus(armyId, cardUnitId);
            showToast(`${unitData.customName || cardUnitId} became Shaken!`, "Melee Outcome");
          }
        } else if (moraleResult === "Pass") {
          console.log(`Unit ${cardUnitId} passed melee morale test.`);
          showToast("Melee Lost, Morale Passed.", "Melee Outcome");
        } else {
          console.log("Charger melee morale prompt cancelled or invalid.");
        }
      } else if (outcome === "Win" || outcome === "Tie") {
        console.log(
          `Unit ${cardUnitId} ${
            outcome === "Win" ? "won" : "tied"
          } melee. No morale test needed from outcome.`
        );
        showToast(`Charger melee outcome: ${outcome}`, "Melee Resolved");
      } else {
        console.log("Charger melee outcome prompt cancelled or invalid.");
      }
      // --- End Charger Melee Resolution Flow ---
    }
    // --- END CHARGE ---
  }
}

/**
 * Handles clicking the "Resolve Melee" button.
 * Prompts the user for the outcome and updates unit state (fatigue, shaken, routed).
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
async function _handleResolveMeleeClick(targetElement, armyId, cardUnitId) {
  console.log(`Resolving melee outcome for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId); // Base unit data
  if (!unitData) return;
  const heroData = getJoinedHeroData(cardUnitId); // Get hero data if present
  const effectiveQuality = heroData ? heroData.quality : unitData.quality; // Use hero quality if joined

  // 1. Ask if THIS unit Struck Back (for fatigue)
  const didStrikeBack = await showInteractiveToast(
    `Did ${unitData.customName || cardUnitId} Strike Back in this melee?`,
    "Melee: Strike Back?",
    [
      { text: "Yes", value: "Yes", style: "primary" },
      { text: "No", value: "No", style: "secondary" },
    ]
  );

  if (didStrikeBack === "Yes") {
    // Apply fatigue if first melee attack this round
    const isFirstMelee = !getUnitStateValue(armyId, cardUnitId, "attackedInMeleeThisRound", false);
    if (isFirstMelee) {
      updateUnitStateValue(armyId, cardUnitId, "fatigued", true);
      updateUnitStateValue(armyId, cardUnitId, "attackedInMeleeThisRound", true);
      updateFatiguedStatusUI(cardUnitId, true); // Update card indicator
      updateOffcanvasUnitStatus(armyId, cardUnitId);
      console.log(`Unit ${cardUnitId} is now Fatigued from striking back.`);
    }
  } else if (didStrikeBack === null) {
    console.log("Strike back prompt cancelled.");
    return; // Cancelled
  }

  // 2. Ask for Melee Outcome for THIS unit
  const outcome = await showInteractiveToast(
    `Did ${unitData.customName || unitData.originalName} WIN, LOSE, or TIE the melee?`,
    "Melee: Outcome?",
    [
      { text: "Win", value: "Win", style: "success" },
      { text: "Lose", value: "Lose", style: "danger" },
      { text: "Tie", value: "Tie", style: "warning" },
    ]
  );

  if (outcome === "Lose") {
    console.log(`Unit ${cardUnitId} lost melee. Checking morale.`);
    // 3. Ask for Morale Result
    const moraleResult = await showInteractiveToast(
      `MELEE MORALE TEST (Quality ${effectiveQuality}+): Did the unit PASS or FAIL?`,
      "Melee: Morale Test",
      [
        { text: "Pass", value: "Pass", style: "success" },
        { text: "Fail", value: "Fail", style: "danger" },
      ]
    );

    if (moraleResult === "Fail") {
      // 4. Check half strength for Routing
      const isHalf = checkHalfStrength(unitData); // Check base unit strength

      if (isHalf) {
        console.log(`Unit ${cardUnitId} fails morale at half strength -> ROUTED!`);
        updateUnitStateValue(armyId, cardUnitId, "status", "routed");
        if (heroData) updateUnitStateValue(armyId, heroData.selectionId, "status", "routed"); // Update hero status
        collapseRoutedCard(cardUnitId); // Update card UI
        updateOffcanvasUnitStatus(armyId, cardUnitId);
        showToast(`${unitData.customName || cardUnitId} Routed!`, "Melee Outcome");

        console.log(`Triggering 'Set Killed By' modal for routed unit ${cardUnitId}`);
        createOpponentSelectionModal(cardUnitId, armyId, "setKilledBy");
      } else {
        console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
        updateUnitStateValue(armyId, cardUnitId, "shaken", true);
        updateShakenStatusUI(cardUnitId, true); // Update card UI
        updateOffcanvasUnitStatus(armyId, cardUnitId);
        showToast(`${unitData.customName || cardUnitId} became Shaken!`, "Melee Outcome");
      }
    } else if (moraleResult === "Pass") {
      console.log(`Unit ${cardUnitId} passed melee morale test.`);
      showToast("Melee Lost, Morale Passed.", "Melee Outcome");
    } else {
      console.log("Melee morale prompt cancelled or invalid.");
    }
  } else if (outcome === "Win" || outcome === "Tie") {
    console.log(
      `Unit ${cardUnitId} ${
        outcome === "Win" ? "won" : "tied"
      } melee. No morale test needed from outcome.`
    );
    showToast(`Melee outcome: ${outcome}`, "Melee Resolved");
  } else {
    console.log("Melee outcome prompt cancelled or invalid.");
  }
}

/**
 * Handles clicking the "Check Morale (Wounds)" button.
 * Only proceeds if unit is <= half strength. Prompts user for morale result.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card displayed.
 * @private
 */
async function _handleMoraleWoundsClick(targetElement, armyId, cardUnitId) {
  console.log(`Manual morale check for wounds for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId); // Base unit data
  if (!unitData) return;
  const heroData = getJoinedHeroData(cardUnitId); // Get hero data if present
  const effectiveQuality = heroData ? heroData.quality : unitData.quality; // Use hero quality if joined

  // Check if unit is at half strength or less
  const isHalf = checkHalfStrength(unitData);
  if (!isHalf) {
    showToast(
      `Unit is not at half strength or less. Morale check not required for wounds.`,
      "Morale Check"
    );
    return;
  }

  // Prompt for morale test result
  const moraleResult = await showInteractiveToast(
    `WOUNDS MORALE TEST (Quality ${effectiveQuality}+): Did the unit PASS or FAIL?`,
    "Wounds: Morale Test",
    [
      { text: "Pass", value: "Pass", style: "success" },
      { text: "Fail", value: "Fail", style: "danger" },
    ]
  );

  if (moraleResult === "Fail") {
    console.log(`Unit ${cardUnitId} fails morale from wounds -> SHAKEN!`);
    updateUnitStateValue(armyId, cardUnitId, "shaken", true);
    updateShakenStatusUI(cardUnitId, true); // Update card UI
    updateOffcanvasUnitStatus(armyId, cardUnitId);
    showToast(`${unitData.customName || cardUnitId} became Shaken!`, "Morale Check");
  } else if (moraleResult === "Pass") {
    console.log(`Unit ${cardUnitId} passed wounds morale test.`);
    showToast("Morale test passed.", "Morale Check");
  } else {
    console.log("Wounds morale prompt cancelled or invalid.");
  }
}

/**
 * Handles click on the "Reset Current Army Data" button.
 * Confirms with the user, clears storage for the CURRENT army, and reloads the page.
 * @private
 */
async function _handleResetArmyDataClick() {
  const armyId = getCurrentArmyId();
  if (!armyId) {
    showToast("Cannot reset: No army is currently loaded.", "Error");
    return;
  }
  const armyData = getLoadedArmyData(); // Get data for the name
  const armyName = armyData?.meta?.name || `Army (${armyId})`;

  // Confirmation Dialog using interactive toast
  const confirmed = await showInteractiveToast(
    `WARNING! This will permanently delete all saved progress (HP, status, CP, UP, doctrine
    selection) for "${armyName}" and reload its data from scratch. Are you absolutely sure you want
    to proceed?`,
    "Confirm Current Army Reset",
    [
      { text: "Reset Current Army", value: "reset", style: "danger" },
      { text: "Cancel", value: "cancel", style: "secondary" },
    ]
  );

  if (confirmed === "reset") {
    console.log(`Resetting data for army ${armyId}...`);

    // 1. Clear Persistent State for this army
    resetArmyState(armyId); // Clears localStorage item

    // 2. Clear Session Caches (Optional but recommended)
    // Clear points cache to force recalculation if user navigates back/forth
    sessionStorage.removeItem(config.CAMPAIGN_POINTS_CACHE_KEY);
    console.log("Cleared relevant session storage caches.");

    // 3. Show feedback and reload
    showToast(`Resetting data for ${armyName}... Page will reload.`, "Resetting", 3000);
    // Use setTimeout to allow toast to show before reload potentially interrupts it
    setTimeout(() => {
      window.location.reload();
    }, 500); // Short delay
  } else {
    console.log("Army data reset cancelled by user.");
  }
}

/**
 * Handles click on the "Reset ALL Data" button.
 * Confirms with the user, clears ALL localStorage and sessionStorage, and reloads the page.
 * @private
 */
async function _handleResetAllDataClick() {
  console.log("Reset ALL Data button clicked.");

  // Confirmation Dialog using interactive toast
  const confirmed = await showInteractiveToast(
    `EXTREME WARNING! This will permanently delete ALL saved progress for ALL armies, campaign
    data, cached rules, theme settings, etc. Everything will be wiped from browser storage. This
    action cannot be undone. Are you absolutely, positively sure?`,
    "Confirm FULL Data Reset",
    [
      { text: "DELETE EVERYTHING", value: "reset_all", style: "danger" },
      { text: "Cancel", value: "cancel", style: "secondary" },
    ]
  );

  if (confirmed === "reset_all") {
    console.warn(`RESETTING ALL BROWSER STORAGE FOR THIS SITE...`);

    // 1. Clear ALL localStorage
    try {
      localStorage.clear();
      console.log("Cleared ALL localStorage.");
    } catch (e) {
      console.error("Error clearing localStorage:", e);
      showToast("Error clearing local storage.", "Error");
      // Continue to session storage clear even if local fails
    }

    // 2. Clear ALL sessionStorage
    try {
      sessionStorage.clear();
      console.log("Cleared ALL sessionStorage.");
    } catch (e) {
      console.error("Error clearing sessionStorage:", e);
      showToast("Error clearing session storage.", "Error");
    }

    // 3. Show feedback and reload
    showToast(`Resetting ALL application data... Page will reload.`, "Full Reset", 3000);
    // Use setTimeout to allow toast to show before reload potentially interrupts it
    setTimeout(() => {
      // Reload to the base page without any army selected
      window.location.href = "army.html";
    }, 500); // Short delay
  } else {
    console.log("Full data reset cancelled by user.");
  }
}

// --- Stratagem and CP/UP Handlers ---

/**
 * Handles clicking the activate button for a stratagem in the modal.
 * @param {HTMLButtonElement} buttonElement - The button that was clicked.
 * @private
 */
async function _handleActivateStratagemClick(buttonElement) {
  const stratName = decodeURIComponent(buttonElement.dataset.stratagemName);
  const stratCost = parseInt(buttonElement.dataset.stratagemCost, 10);
  const armyId = buttonElement.dataset.armyId;

  if (isNaN(stratCost) || !stratName || !armyId) {
    console.error("Stratagem button missing required data attributes.");
    showToast("Error activating stratagem: Missing data.", "Error");
    return;
  }

  const currentCP = getCommandPoints(armyId);

  if (currentCP < stratCost) {
    showToast(`Not enough Command Points for ${stratName}.`, "Activation Failed");
    return;
  }

  // Confirmation (optional, but good for costly stratagems)
  const confirm = await showInteractiveToast(
    `Activate Stratagem "${stratName}" for ${stratCost} CP?`,
    "Confirm Stratagem",
    [
      {
        text: `Activate (${stratCost} CP)`,
        value: "activate",
        style: "success",
      },
      { text: "Cancel", value: "cancel", style: "secondary" },
    ]
  );

  if (confirm === "activate") {
    const newCP = currentCP - stratCost;
    setCommandPoints(armyId, newCP); // Update state
    updateCommandPointsDisplay(armyId, newCP, getMaxCommandPoints(armyId)); // Update main UI
    // Update modal UI (CP display and button states)
    displayStratagems(armyId, getSelectedDoctrine(armyId));
    // Show confirmation
    showToast(`Activated: ${stratName}`, "Stratagem Used");
    console.log(`Stratagem "${stratName}" activated for ${stratCost} CP.`);
  } else {
    console.log(`Stratagem "${stratName}" activation cancelled.`);
  }
}

/**
 * Handles manual adjustment of Command Points via modal buttons.
 * @param {number} adjustment - Amount to adjust by (+1 or -1).
 * @private
 */
function _handleManualCpAdjustClick(adjustment) {
  const armyId = getCurrentArmyId();
  if (!armyId) return;

  const currentCP = getCommandPoints(armyId);
  const maxCP = getMaxCommandPoints(armyId);
  const newCP = currentCP + adjustment;

  // Clamp value
  if (newCP >= 0 && newCP <= maxCP) {
    setCommandPoints(armyId, newCP); // Update state
    updateCommandPointsDisplay(armyId, newCP, maxCP); // Update main UI
    // Update modal UI (CP display and button states)
    displayStratagems(armyId, getSelectedDoctrine(armyId));
    console.log(`Manually adjusted CP by ${adjustment} to ${newCP}`);
  } else {
    console.warn(
      `Manual CP adjustment (${adjustment}) would exceed limits (0-${maxCP}). No change.`
    );
  }
}

/**
 * Handles manual adjustment of Underdog Points via header buttons.
 * @param {number} adjustment - Amount to adjust by (+1 or -1).
 * @private
 */
function _handleUnderdogPointAdjustClick(adjustment) {
  const armyId = getCurrentArmyId();
  if (!armyId) return;

  const currentUP = getUnderdogPoints(armyId);
  const maxUP = getMaxUnderdogPoints(armyId);
  const newUP = currentUP + adjustment;

  // Clamp value
  if (newUP >= 0 && newUP <= maxUP) {
    setUnderdogPoints(armyId, newUP); // Update state
    updateUnderdogPointsDisplay(armyId, newUP, maxUP); // Update UI display
    console.log(`Manually adjusted UP by ${adjustment} to ${newUP}`);
  } else {
    console.warn(
      `Manual UP adjustment (${adjustment}) would exceed limits (0-${maxUP}). No change.`
    );
  }
}

/**
 * Handles clicking the manual "Mark Removed" button. Prompts user for
 * Destroyed/Routed status, updates state/UI, then triggers the 'Set Killed By' modal.
 * @param {Event} event - The click event object.
 */
async function _handleMarkRemovedClick(event) {
  const button = event.target.closest(".btn-mark-removed");
  if (!button) return;

  const { armyId, unitId } = button.dataset;
  if (!armyId || !unitId) return;

  const unitData = getUnitData(unitId);
  const unitName = unitData?.customName || unitData?.originalName || unitId;

  // 1. Ask user for status
  const chosenStatus = await showInteractiveToast(
    `Mark "${unitName}" as Destroyed or Routed?`,
    "Confirm Unit Removal",
    [
      { text: "Destroyed", value: "destroyed", style: "danger" },
      { text: "Routed", value: "routed", style: "warning" },
      { text: "Cancel", value: "cancel", style: "secondary" },
    ]
  );

  if (chosenStatus === "destroyed" || chosenStatus === "routed") {
    console.log(`Manually marking unit ${unitId} as ${chosenStatus}`);
    const heroData = getJoinedHeroData(unitId);

    // 2. Update State
    updateUnitStateValue(armyId, unitId, "status", chosenStatus);
    if (heroData) updateUnitStateValue(armyId, heroData.selectionId, "status", chosenStatus);

    // 3. Update UI
    if (chosenStatus === "destroyed") collapseDestroyedCard(unitId);
    else collapseRoutedCard(unitId);
    updateOffcanvasUnitStatus(armyId, unitId);
    showToast(`${unitName} marked as ${chosenStatus}.`, "Unit Status Updated");

    // 4. Trigger 'Set Killed By' Modal
    console.log(`Triggering 'Set Killed By' modal for manually removed unit ${unitId}`);
    createOpponentSelectionModal(unitId, armyId, "setKilledBy");
  } else {
    console.log("Manual unit removal cancelled.");
  }
}

// --- Main Event Listener & Setup ---

/**
 * Global click handler for various interactions within the army tracker UI.
 * Delegates actions based on the clicked element's closest relevant parent or class.
 * @param {Event} event - The click event object.
 */
function handleInteractionClick(event) {
  const target = event.target;
  // --- Ignore Clicks on Main Control Buttons (handled by direct listeners now) ---
  if (target.closest("#start-round-button") || target.closest("#end-game-button")) {
    console.debug("DEBUG: Click on main control button ignored by delegation.");
    return;
  }
  const unitCard = event.target.closest(".unit-card");
  const spellModal = event.target.closest("#viewSpellsModal");
  const opponentModal = event.target.closest("#opponentSelectModal");
  const stratagemModal = event.target.closest("#stratagemModal");
  const upDisplay = event.target.closest("#underdog-points-display");
  const resetArmyButton = event.target.closest("#reset-army-data-button");
  const resetAllButton = event.target.closest("#reset-all-data-button");

  // --- Reset Buttons ---
  if (resetAllButton) {
    _handleResetAllDataClick();
    return; // Stop processing if reset all clicked
  }
  if (resetArmyButton) {
    _handleResetArmyDataClick();
    return; // Stop processing if reset army clicked
  }

  // --- Underdog Points Buttons ---
  if (upDisplay) {
    const removeUpButton = event.target.closest("#manual-up-remove");
    const addUpButton = event.target.closest("#manual-up-add");
    if (removeUpButton) {
      _handleUnderdogPointAdjustClick(-1);
      return;
    }
    if (addUpButton) {
      _handleUnderdogPointAdjustClick(1);
      return;
    }
  }

  // --- Unit Card Interactions ---
  if (unitCard) {
    const cardUnitId = unitCard.dataset.unitId;
    const armyId = unitCard.dataset.armyId;
    if (!cardUnitId || !armyId) return;

    // Check if unit is inactive before processing most clicks
    const unitStatus = getUnitStateValue(armyId, cardUnitId, "status", "active");
    const isInactive = unitStatus === "destroyed" || unitStatus === "routed";

    // Find the specific element clicked within the card
    const modelElement = event.target.closest(".clickable-model");
    const woundButton = event.target.closest(".wound-apply-btn");
    const resetButton = event.target.closest(".unit-reset-btn");
    const addTokenButton = event.target.closest(".token-add-btn");
    const removeTokenButton = event.target.closest(".token-remove-btn");
    const viewSpellsButton = event.target.closest(".view-spells-btn");
    const actionButton = event.target.closest(".action-btn");
    const resolveMeleeButton = event.target.closest(".resolve-melee-btn");
    const moraleWoundsButton = event.target.closest(".morale-wounds-btn");
    const recordKillButton = event.target.closest(".btn-record-kill");
    const markRemovedButton = event.target.closest(".btn-mark-removed");

    // Only allow reset button on inactive cards
    if (isInactive) {
      if (resetButton) {
        _handleResetUnitClick(resetButton, armyId, cardUnitId);
      }
      return; // Prevent other interactions on inactive cards
    }

    // Handle active card interactions
    if (modelElement) _handleModelWoundClick(modelElement, armyId, cardUnitId);
    else if (woundButton) _handleAutoWoundButtonClick(woundButton, armyId, cardUnitId);
    else if (resetButton) _handleResetUnitClick(resetButton, armyId, cardUnitId);
    else if (addTokenButton) _handleAddTokenClick(addTokenButton, armyId, cardUnitId);
    else if (removeTokenButton) _handleRemoveTokenClick(removeTokenButton, armyId, cardUnitId);
    else if (viewSpellsButton) _handleViewSpellsClick(viewSpellsButton, armyId, cardUnitId);
    else if (actionButton) _handleActionButtonClick(actionButton, armyId, cardUnitId);
    else if (resolveMeleeButton) _handleResolveMeleeClick(resolveMeleeButton, armyId, cardUnitId);
    else if (moraleWoundsButton) _handleMoraleWoundsClick(moraleWoundsButton, armyId, cardUnitId);
    else if (recordKillButton) {
      _handleRecordKillClick(event);
    } else if (markRemovedButton) {
      _handleMarkRemovedClick(event);
    }

    return; // Stop processing after handling card interaction
  }

  // --- Spell Modal Interactions ---
  if (spellModal) {
    const castButton = event.target.closest(".cast-spell-btn");
    if (castButton) {
      _handleCastSpellClick(castButton);
    }
    return; // Stop processing after handling spell modal interaction
  }

  // --- Stratagem Modal Interactions ---
  if (stratagemModal) {
    const activateButton = event.target.closest(".activate-stratagem-btn");
    const removeCpButton = event.target.closest("#manual-cp-remove");
    const addCpButton = event.target.closest("#manual-cp-add");

    if (activateButton) {
      _handleActivateStratagemClick(activateButton);
    } else if (removeCpButton) {
      _handleManualCpAdjustClick(-1);
    } else if (addCpButton) {
      _handleManualCpAdjustClick(1);
    }
    return;
  }

  // --- Opponent Selection Modal Interactions ---
  if (opponentModal) {
    const confirmOpponentButton = event.target.closest("#confirm-opponent-selection-btn");
    if (confirmOpponentButton) {
      console.debug("DEBUG: Click detected on confirm button via delegation.");
      _handleConfirmOpponentSelection(event);
      return;
    }
  }
}

/**
 * Handles clicks on the "Record Kill" button on a unit card.
 * @param {Event} event - The click event object.
 */
function _handleRecordKillClick(event) {
  const button = event.target.closest(".btn-record-kill");
  if (!button) return;

  const { armyId, unitId } = button.dataset;
  if (!armyId || !unitId) {
    console.error("Missing data attributes on record kill button.");
    return;
  }

  console.log(`Record Kill button clicked for Unit: ${unitId}, Army: ${armyId}`);
  createOpponentSelectionModal(unitId, armyId, "recordKill");
}

/**
 * Handles changes on the opponent army dropdown in the selection modal.
 * @param {Event} event - The change event object.
 */
function _handleOpponentArmyChange(event) {
  const armySelect = event.target;
  if (!armySelect || armySelect.id !== "modal-opponent-army-select") return;

  const selectedOpponentArmyId = armySelect.value;
  const modal = armySelect.closest(".modal");
  const unitSelect = modal ? modal.querySelector("#modal-opponent-unit-select") : null;

  if (unitSelect) {
    populateOpponentUnitDropdown(unitSelect, selectedOpponentArmyId);
  } else {
    console.error("Could not find victim unit select element in modal.");
  }
}

/**
 * Updates the state (text, visibility, listeners) of the main game control buttons
 * (#start-round-button, #end-game-button) based on the current game state.
 * NOTE: Uses .onclick assignment which replaces previous handlers.
 */
export function updateGameControlButtons() {
  const startRoundBtn = document.getElementById("start-round-button");
  const endGameBtn = document.getElementById("end-game-button");
  const showResultsBtnContainer = document.getElementById("show-results-button-container");

  if (!startRoundBtn || !endGameBtn || !showResultsBtnContainer) {
    console.warn("Control buttons or show results container not found for update.");
    return;
  }

  const isFinished = getIsGameFinished();
  const round = getCurrentRound();
  const armyId = getCurrentArmyId(); // Get current army ID for context

  // Clear previous listeners to avoid stacking
  startRoundBtn.onclick = null;
  endGameBtn.onclick = null;

  // Clear and hide the dedicated show results button initially
  showResultsBtnContainer.innerHTML = ""; // Clear any existing button
  showResultsBtnContainer.classList.add("d-none");

  if (isFinished) {
    console.debug("DEBUG: Game is finished. Setting up 'Show Results' button.");
    // Hide Start/Next Round and End Game buttons
    startRoundBtn.classList.add("d-none");
    startRoundBtn.disabled = true;
    endGameBtn.classList.add("d-none");
    endGameBtn.disabled = true;

    // Create and show the dedicated "Show Results" button
    const showResultsButton = document.createElement("button");
    showResultsButton.id = "show-game-results-button"; // Give it an ID
    showResultsButton.type = "button";
    showResultsButton.className = "btn btn-sm btn-info";
    showResultsButton.innerHTML = `<i class="bi bi-clipboard-data-fill"></i> Show Final Results`;
    showResultsButton.disabled = !armyId;
    showResultsButton.title = "View the final game results again";
    if (armyId) {
      showResultsButton.onclick = _handleShowResultsClick;
    }

    showResultsBtnContainer.appendChild(showResultsButton);
    showResultsBtnContainer.classList.remove("d-none"); // Make the container visible
  } else {
    console.debug("DEBUG: Game is in progress. Setting up Start/End game buttons.");
    // Game in progress or not started
    startRoundBtn.classList.remove("d-none");
    endGameBtn.classList.remove("d-none"); // Might be hidden again below if round 0

    startRoundBtn.classList.remove("btn-info");
    startRoundBtn.classList.add("btn-success");
    startRoundBtn.onclick = armyId ? () => handleStartRoundClick(armyId) : null;

    if (round === 0) {
      startRoundBtn.innerHTML = `<i class="bi bi-play-fill"></i> Start Game`;
      startRoundBtn.disabled = !armyId;
      endGameBtn.classList.add("d-none");
      endGameBtn.disabled = true;
    } else {
      startRoundBtn.innerHTML = `<i class="bi bi-arrow-repeat"></i> Next Round`;
      startRoundBtn.disabled = !armyId;
      endGameBtn.classList.remove("d-none");
      endGameBtn.disabled = !armyId;
      endGameBtn.onclick = armyId ? _handleEndGameClick : null;
    }
  }
  updateRoundUI(round);
  console.debug(`DEBUG: Control buttons updated. isFinished=${isFinished}, round=${round}`);
}

/**
 * Handles clicks on the "Confirm" button in the opponent selection modal.
 * @param {Event} event - The click event object.
 */
function _handleConfirmOpponentSelection(event) {
  console.log("Confirm opponent selection clicked.");
  const confirmButton = event.target;
  const modalElement = confirmButton.closest(".modal");
  if (!modalElement) return;

  const form = modalElement.querySelector("#opponent-select-form");
  if (!form) return;

  // Retrieve data stored in the modal
  const actionType = form.querySelector("#modal-action-type")?.value;
  const triggeringArmyId = form.querySelector("#modal-triggering-army-id")?.value;
  const triggeringUnitId = form.querySelector("#modal-triggering-unit-id")?.value;
  const opponentArmyId = form.querySelector("#modal-opponent-army-select")?.value;
  const selectedOpponentUnitId = form.querySelector("#modal-opponent-unit-select")?.value; // Renamed element ID in ui.js

  // Basic validation
  if (
    !actionType ||
    !triggeringArmyId ||
    !triggeringUnitId ||
    !opponentArmyId ||
    !selectedOpponentUnitId
  ) {
    showToast("Please select both an opponent army and a victim unit.", "Selection Incomplete");
    return;
  }

  const currentRound = getCurrentRound();
  const allArmies = getAllLoadedArmyData();

  let killRecorded = false;
  let killedBySet = false;
  let interactionProcessed = false;

  const getUnitDetails = (lookupArmyId, lookupUnitId) => {
    const unitData = allArmies?.[lookupArmyId]?.unitMap?.[lookupUnitId];
    if (!unitData) return null;
    return {
      id: lookupUnitId,
      name: unitData.customName || unitData.originalName,
      armyId: lookupArmyId,
      isHero: unitData.isHero || false,
      joinedPartnerId: null, // Will be populated if needed
    };
  };
  const getPartnerId = (armyId, unitId) => {
    const heroData = getJoinedHeroData(unitId); // Is unitId a base unit with a hero?
    if (heroData) return heroData.selectionId;
    const unitData = getUnitData(unitId); // Is unitId a hero joined to a base?
    if (unitData?.joinToUnitId) return unitData.joinToUnitId;
    return null;
  };

  // --- Logic for 'recordKill' action ---
  if (actionType === "recordKill") {
    const attackerArmyId = triggeringArmyId;
    const attackerUnitId = triggeringUnitId;
    const victimArmyId = opponentArmyId;
    const victimUnitId = selectedOpponentUnitId;

    // Get necessary details for state functions
    const allArmies = getAllLoadedArmyData();
    const victimUnitData = allArmies?.[opponentArmyId]?.unitMap?.[victimUnitId];
    const attackerUnitData = allArmies?.[attackerArmyId]?.unitMap?.[attackerUnitId];

    if (!victimUnitData || !attackerUnitData) {
      showToast("Error: Could not find unit data.", "Data Error");
      console.error("Missing unit data for kill record:", {
        victimUnitData,
        attackerUnitData,
      });
      return;
    }

    const victimDetails = {
      victimUnitId: victimUnitId,
      victimUnitName: victimUnitData.customName || victimUnitData.originalName,
      victimArmyId: opponentArmyId,
      victimIsHero: victimUnitData.isHero || false,
      round: currentRound,
    };

    const attackerDetails = {
      attackerUnitId: attackerUnitId,
      attackerUnitName: attackerUnitData.customName || attackerUnitData.originalName,
      attackerArmyId: attackerArmyId,
      round: currentRound,
    };

    // Call state functions (Handler calls both)
    const killRecorded = addRecordedKill(attackerArmyId, attackerUnitId, victimDetails);
    const killedBySet = setKilledByStatus(opponentArmyId, victimUnitId, attackerDetails);

    if (killRecorded && killedBySet) {
      // Update UI
      updateKillCountBadge(attackerArmyId, attackerUnitId);
      updateKilledByStatusDisplay(opponentArmyId, victimUnitId);
      interactionProcessed = true; // Mark as processed
    } else {
      showToast("Failed to update state for kill record.", "Error");
      // Optional: Add logic to revert partial state changes if one failed
    }
  } else if (actionType === "setKilledBy") {
    // Victim is the triggering unit, Attacker is selected in modal
    const victimArmyId = triggeringArmyId;
    const victimUnitId = triggeringUnitId;
    const attackerArmyId = opponentArmyId;
    const attackerUnitId = selectedOpponentUnitId;

    const victimBaseDetails = getUnitDetails(victimArmyId, victimUnitId);
    const attackerBaseDetails = getUnitDetails(attackerArmyId, attackerUnitId);
    console.debug(
      "DEBUG: Victim and attacker details:",
      {
        victimBaseDetails,
        attackerBaseDetails,
      },
      { victimArmyId, victimUnitId, attackerArmyId, attackerUnitId }
    );

    if (!victimBaseDetails || !attackerBaseDetails) {
      console.log("Error: Could not find unit details for KilledBy update.", {
        victimBaseDetails,
        attackerBaseDetails,
      });
      return;
    }

    // Prepare details objects
    const victimRecord = {
      victimUnitId,
      victimUnitName: victimBaseDetails.name,
      victimArmyId,
      victimIsHero: victimBaseDetails.isHero,
      round: currentRound,
    };
    const attackerRecord = {
      attackerUnitId,
      attackerUnitName: attackerBaseDetails.name,
      attackerArmyId,
      round: currentRound,
    };

    // -- Perform Updates --
    // 1. Victim is killed by (base + potentially joined hero)
    const victimHeroId = getPartnerId(victimArmyId, victimUnitId);
    killedBySet = setKilledByStatus(victimArmyId, victimUnitId, attackerRecord);
    if (victimHeroId) {
      setKilledByStatus(victimArmyId, victimHeroId, attackerRecord);
    }

    // 2. Attacker records kill (base + potentially joined hero)
    const attackerHeroId = getPartnerId(attackerArmyId, attackerUnitId);
    killRecorded = addRecordedKill(attackerArmyId, attackerUnitId, victimRecord);
    if (attackerHeroId) {
      addRecordedKill(attackerArmyId, attackerHeroId, victimRecord);
    }

    interactionProcessed = true;

    // Update UI
    if (killedBySet) updateKilledByStatusDisplay(victimArmyId, victimUnitId);
    if (victimHeroId && killedBySet) updateKilledByStatusDisplay(victimArmyId, victimHeroId);
    if (killRecorded) updateKillCountBadge(attackerArmyId, attackerUnitId);
    if (attackerHeroId && killRecorded) updateKillCountBadge(attackerArmyId, attackerHeroId);
  } else {
    console.error("Unknown action type in modal confirmation:", actionType);
  }

  // --- Final Steps ---
  if (interactionProcessed) {
    showToast(
      `${actionType === "recordKill" ? "Kill" : "Killer"} recorded successfully!`,
      "Success"
    );
  } else {
    showToast("Failed to update state completely.", "Error");
    // Optional: Add logic to revert partial state changes if needed
  }

  // Close the modal
  const modalInstance = bootstrap.Modal.getInstance(modalElement);
  if (modalInstance) {
    modalInstance.hide();
  }
}

// Helper for delegated change listener
function _handleDelegatedChange(event) {
  if (event.target) {
    if (event.target.classList.contains("casualty-outcome-select")) {
      _handleCasualtyOutcomeChange(event);
    } else if (event.target.id === "modal-opponent-army-select") {
      _handleOpponentArmyChange(event);
    }
    // Add other delegated change handlers if needed
  }
}

// --- Add Change Listener for Modal Dropdown ---
// It's often easier to add specific listeners for modals when they are shown,
// but for simplicity here, we can use delegation if the modal container exists permanently.
// If the container is cleared, this delegated listener might need adjustment.
document.addEventListener("change", (event) => {
  if (event.target && event.target.id === "modal-opponent-army-select") {
    _handleOpponentArmyChange(event);
  }
});

/**
 * Sets up all necessary event listeners for the application.
 * Should be called once after the initial UI is rendered.
 * @param {string} armyId - The ID of the currently loaded army.
 */
export function setupEventListeners(armyId) {
  // Main click delegation
  document.body.removeEventListener("click", handleInteractionClick); // Prevent duplicates
  document.body.addEventListener("click", handleInteractionClick);
  console.log("Global interaction click listener attached/updated.");

  // Delegated change listener for dynamic elements (casualty dropdowns, opponent select)
  document.body.removeEventListener("change", _handleDelegatedChange); // Prevent duplicates
  document.body.addEventListener("change", _handleDelegatedChange);
  console.log("Delegated change listener attached.");

  // --- Stratagem Modal Listeners ---
  const stratagemModalElement = document.getElementById("stratagemModal");
  if (stratagemModalElement) {
    // Listener for when the modal is about to be shown
    stratagemModalElement.addEventListener("show.bs.modal", (event) => {
      // Store the element that triggered the modal for focus return
      setElementToFocusAfterClose(event.relatedTarget || document.activeElement);
      // Populate the doctrine selector dropdown
      populateDoctrineSelector(armyId);
      // Update the Command Points display in the modal header
      updateCommandPointsDisplay(armyId, getCommandPoints(armyId), getMaxCommandPoints(armyId));
      // Display the stratagems based on the currently selected doctrine
      const currentDoctrine = getSelectedDoctrine(armyId);
      displayStratagems(armyId, currentDoctrine);
      console.log(
        `Stratagem modal opened, populating selector and displaying stratagems for doctrine: ${
          currentDoctrine || "None"
        }.`
      );
    });

    // Listener for when the modal has finished hiding
    stratagemModalElement.removeEventListener("hidden.bs.modal", handleFocusReturn); // Remove previous listener if any
    stratagemModalElement.addEventListener("hidden.bs.modal", handleFocusReturn, {
      once: true,
    }); // Add listener to return focus

    // Listener for changes in the doctrine selector dropdown
    const doctrineSelector = document.getElementById("doctrineSelector");
    if (doctrineSelector) {
      doctrineSelector.addEventListener("change", (event) => {
        const selectedDoctrineId = event.target.value;
        setSelectedDoctrine(armyId, selectedDoctrineId || null); // Save the selection
        console.log(`Doctrine selected: ${selectedDoctrineId}`);
        // Update the displayed stratagems when the selection changes
        displayStratagems(armyId, selectedDoctrineId || null);
      });
      console.log("Doctrine selector change listener attached.");
    } else {
      console.warn("Doctrine selector element not found.");
    }
  } else {
    console.warn("Stratagem modal element not found.");
  }

  // --- Army Info Modal Listeners ---
  const armyInfoModalElement = document.getElementById("armyInfoModal");
  if (armyInfoModalElement) {
    // Listener for when the modal is about to be shown
    armyInfoModalElement.addEventListener("show.bs.modal", (event) => {
      // Store the element that triggered the modal for focus return
      setElementToFocusAfterClose(event.relatedTarget || document.activeElement);
      console.log("Army Info modal opened.");
    });
    // Listener for when the modal has finished hiding
    armyInfoModalElement.removeEventListener("hidden.bs.modal", handleFocusReturn); // Remove previous listener if any
    armyInfoModalElement.addEventListener("hidden.bs.modal", handleFocusReturn, { once: true }); // Add listener to return focus
    console.log("Army Info modal listeners attached.");
  } else {
    console.warn("Army Info modal element not found.");
  }

  // --- Offcanvas Listeners ---
  const offcanvasElement = document.getElementById("unitListOffcanvas");
  if (offcanvasElement) {
    // Listener for when the offcanvas is about to be shown
    offcanvasElement.addEventListener("show.bs.offcanvas", (event) => {
      // Store the element that triggered the offcanvas for focus return
      setElementToFocusAfterClose(event.relatedTarget || document.activeElement);
      console.log("Unit list offcanvas opened.");
    });
    // Listener for when the offcanvas has finished hiding
    offcanvasElement.removeEventListener("hidden.bs.offcanvas", handleFocusReturn); // Remove previous listener if any
    offcanvasElement.addEventListener("hidden.bs.offcanvas", handleFocusReturn, { once: true }); // Add listener to return focus
    console.log("Offcanvas listeners attached.");
  } else {
    console.warn("Unit list offcanvas element not found.");
  }

  // --- Screen Diagnostics Listeners ---
  updateScreenDiagnostics(); // Initial display
  window.addEventListener("resize", updateScreenDiagnostics); // Update on resize
  const themeDropdown = document.getElementById("themeDropdown");
  if (themeDropdown) {
    // Use setTimeout to ensure the theme attribute has updated after the click event finishes
    document.querySelectorAll("[data-bs-theme-value]").forEach((toggle) => {
      toggle.addEventListener("click", () => setTimeout(updateScreenDiagnostics, 50));
    });
    // Also update if OS preference changes (for 'auto' theme)
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      // Only update if theme is auto or not set
      const storedTheme = localStorage.getItem(config.THEME_STORAGE_KEY);
      if (!storedTheme || storedTheme === "auto") {
        setTimeout(updateScreenDiagnostics, 50);
      }
    });
  }
  console.log("Screen diagnostic listeners attached.");
} // End setupEventListeners
