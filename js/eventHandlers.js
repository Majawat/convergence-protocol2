/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
 */

// Imports from other modules
import { config } from "./config.js"; // Configuration constants
import {
  getLoadedArmyData,
  getCurrentArmyUnitMap,
  getCurrentArmyHeroTargets,
  getUnitData,
  getJoinedHeroData,
  updateGlobalWoundState,
  updateGlobalComponentState,
  getComponentStateValue,
  getArmyComponentStates,
  getArmyBooksData,
  getArmyWoundStates,
} from "./state.js"; // State accessors and mutators
import { saveWoundState, saveComponentState } from "./storage.js"; // Local/Session storage interaction
import { findTargetModelForWound } from "./gameLogic.js"; // Game rule logic
import { updateModelDisplay, updateTokenDisplay } from "./ui.js"; // Core UI update functions
import { showToast, populateAndShowSpellModal } from "./uiHelpers.js"; // Helper UI functions like toasts

// --- Internal Helper Functions ---

/** Removes the highlight from any previously targeted model in a unit card. */
function clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}

/** Adds a highlight to the next model that will take a wound (auto-target). */
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
  clearTargetHighlight(unitSelectionId); // Clear previous highlight first
  if (!modelId) return; // If no model ID, just clear
  // Need to potentially find the model display using just the modelId,
  // as the card might only have the base unit's ID.
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  // Ensure the found model is within the correct card before highlighting
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
  }
}

// --- Action Functions ---

/** Applies a wound to a specific model or uses auto-target logic. */
function applyWound(armyId, unitId, specificModelId = null) {
  const armyData = getLoadedArmyData(armyId);
  if (!armyData) {
    console.error(`Army data not found for applyWound: army ${armyId}`);
    return;
  }
  const unitData = getUnitData(armyId, unitId); // Base unit data
  if (!unitData) {
    console.error(
      `Base unit data not found for applyWound: army ${armyId}, unit ${unitId}`
    );
    return;
  }
  const heroData = getJoinedHeroData(armyId, unitId); // Get joined hero data
  let targetModel = null;
  let modelFoundInUnitId = null; // Track the actual unit ID the model belongs to

  if (specificModelId) {
    // Manual target
    // Search in base unit first
    targetModel = unitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel) {
      modelFoundInUnitId = unitId;
    }
    // If not found in base unit, check hero (if hero exists)
    else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelFoundInUnitId = heroData.selectionId; // Use hero's ID for state update
      }
    }
    // Check if the manually targeted model is already removed
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      targetModel = null;
      modelFoundInUnitId = null;
    }
  } else {
    // Auto target
    targetModel = findTargetModelForWound(unitData, heroData); // Use game logic function
    if (targetModel) {
      // Determine which unit the auto-targeted model belongs to for state update
      modelFoundInUnitId = targetModel.isHero ? heroData.selectionId : unitId;
    }
  }

  // Proceed if a valid, active target model was found
  if (targetModel && modelFoundInUnitId) {
    targetModel.currentHp -= 1; // Apply wound to the model object in memory

    // Update the global state object using the correct unit ID
    updateGlobalWoundState(
      armyId,
      modelFoundInUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );

    // Update the UI display for that specific model on the card (identified by base unit ID)
    updateModelDisplay(
      unitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );

    // Save the entire updated wound state to storage
    saveWoundState(getArmyWoundStates());

    // Highlight the next model that *would* be targeted automatically
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    // Log if no target found (either auto or manual invalid)
    console.log(
      `No models available to wound in unit ${unitId} (or specific model ${specificModelId} not found/valid).`
    );
    clearTargetHighlight(unitId); // Clear any existing highlight
  }
}

/** Handles the 'Start New Round' button click */
function handleStartRoundClick(armyId) {
  console.log("--- Starting New Round (Generating Tokens) ---");
  const currentArmy = getLoadedArmyData(armyId);
  if (!currentArmy || !currentArmy.units) {
    console.warn("Cannot start round: Army data not loaded.");
    return;
  }

  let stateChanged = false;
  let castersAffected = 0;
  const heroTargets = getCurrentArmyHeroTargets(armyId) || {}; // Get hero targets for lookup

  // Iterate over ALL units in the processed data, including heroes not directly displayed
  currentArmy.units.forEach((unit) => {
    if (unit.casterLevel > 0) {
      const unitId = unit.selectionId; // Use the caster's actual unit ID for state
      const currentTokens = getComponentStateValue(armyId, unitId, "tokens", 0);
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );

      if (newTokens !== currentTokens) {
        console.log(
          `Adding ${tokensToAdd} tokens to ${
            unit.customName || unit.originalName
          } (${unitId}). New total: ${newTokens}`
        );
        updateGlobalComponentState(armyId, unitId, "tokens", newTokens); // Update state

        // Find the card ID to update the UI
        // If this caster is a hero joined to another unit, find the base unit's ID
        const cardUnitId = heroTargets[unitId] || unitId;
        updateTokenDisplay(cardUnitId, newTokens, unit.casterLevel); // Update UI on correct card

        stateChanged = true;
        castersAffected++;
      }
    }
  });
  if (stateChanged) {
    saveComponentState(getArmyComponentStates()); // Save updated tokens
  }
  showToast(
    castersAffected > 0
      ? `Spell tokens generated for ${castersAffected} caster(s) (max ${config.MAX_SPELL_TOKENS}).`
      : "No casters found to generate tokens for."
  );
}

// --- Main Event Listener Logic ---

/** Handles clicks delegated from the main unit container */
function handleUnitInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return; // Exit if click wasn't inside a relevant card

  const unitId = unitCard.dataset.unitId; // This is always the base unit ID from the card
  const armyId = unitCard.dataset.armyId;
  const clickedModelElement = event.target.closest(".clickable-model");

  // 1. Wound application on model click
  if (clickedModelElement && event.type === "click") {
    const modelId = clickedModelElement.dataset.modelId;
    applyWound(armyId, unitId, modelId); // Pass specific model ID
    return; // Action handled
  }

  // 2. Wound application via header button
  if (event.target.closest(".wound-apply-btn")) {
    applyWound(armyId, unitId, null); // Pass null for auto-target
  }
  // 3. Reset wounds via header button
  else if (event.target.closest(".wound-reset-btn")) {
    const armyData = getLoadedArmyData(armyId);
    if (!armyData) return;
    const unitData = getUnitData(armyId, unitId);
    if (!unitData) return;
    const heroData = getJoinedHeroData(armyId, unitId);
    const heroId = heroData ? heroData.selectionId : null;
    console.log(
      `Resetting wounds for unit ${unitId}` +
        (heroId ? ` and hero ${heroId}` : "")
    );

    // Reset base unit models
    unitData.models.forEach((model) => {
      model.currentHp = model.maxHp;
      updateGlobalWoundState(armyId, unitId, model.modelId, model.currentHp);
      updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
    });
    // Reset hero models if joined
    if (heroData) {
      heroData.models.forEach((model) => {
        model.currentHp = model.maxHp;
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp); // Use heroId for state
        updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp); // UI uses base unitId
      });
    }
    saveWoundState(getArmyWoundStates()); // Save the entire wound state

    // Highlight next target after reset
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  }
  // 4. Add Token via button
  else if (event.target.closest(".token-add-btn")) {
    const unitData = getUnitData(armyId, unitId);
    if (!unitData) return;
    const heroData = getJoinedHeroData(armyId, unitId);
    // Determine which unit actually has the Caster(X) rule
    const actualCasterUnit =
      heroData?.casterLevel > 0
        ? heroData
        : unitData?.casterLevel > 0
        ? unitData
        : null;

    if (actualCasterUnit) {
      const currentTokens = getComponentStateValue(
        armyId,
        actualCasterUnit.selectionId,
        "tokens",
        0
      );
      if (currentTokens < config.MAX_SPELL_TOKENS) {
        const newTokens = currentTokens + 1;
        updateGlobalComponentState(
          armyId,
          actualCasterUnit.selectionId,
          "tokens",
          newTokens
        );
        updateTokenDisplay(unitId, newTokens, actualCasterUnit.casterLevel); // Update UI on the card (using base unitId)
        saveComponentState(getArmyComponentStates()); // Save entire component state
      }
    } else {
      console.warn("Target unit/hero is not a caster:", unitId);
    }
  }
  // 5. Remove Token via button
  else if (event.target.closest(".token-remove-btn")) {
    const unitData = getUnitData(armyId, unitId);
    if (!unitData) return;
    const heroData = getJoinedHeroData(armyId, unitId);
    const actualCasterUnit =
      heroData?.casterLevel > 0
        ? heroData
        : unitData?.casterLevel > 0
        ? unitData
        : null;

    if (actualCasterUnit) {
      const currentTokens = getComponentStateValue(
        armyId,
        actualCasterUnit.selectionId,
        "tokens",
        0
      );
      if (currentTokens > 0) {
        const newTokens = currentTokens - 1;
        updateGlobalComponentState(
          armyId,
          actualCasterUnit.selectionId,
          "tokens",
          newTokens
        );
        updateTokenDisplay(unitId, newTokens, actualCasterUnit.casterLevel); // Update UI on the card
        saveComponentState(getArmyComponentStates()); // Save entire component state
      }
    } else {
      console.warn("Target unit/hero is not a caster:", unitId);
    }
  }
  // 6. View Spells Button
  else if (event.target.closest(".view-spells-btn")) {
    console.log(`View Spells clicked for card unit ${unitId}`);
    const armyData = getLoadedArmyData(armyId);
    if (!armyData) return;
    const unitData = getUnitData(armyId, unitId);
    if (!unitData) return;
    const heroData = getJoinedHeroData(armyId, unitId);
    const actualCasterUnit =
      heroData?.casterLevel > 0
        ? heroData
        : unitData?.casterLevel > 0
        ? unitData
        : null;

    if (actualCasterUnit) {
      const casterFactionId = actualCasterUnit.factionId;
      const armyBooks = getArmyBooksData(); // Get from state
      const spellList = armyBooks[casterFactionId]?.spells || null;
      const currentTokens = getComponentStateValue(
        armyId,
        actualCasterUnit.selectionId,
        "tokens",
        0
      );

      console.log(
        `Caster: ${actualCasterUnit.customName}, Faction: ${casterFactionId}, Tokens: ${currentTokens}`
      );
      // Call the UI helper function to show the modal
      populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
    } else {
      console.warn("Tried to view spells for a non-caster unit:", unitId);
      showToast("This unit is not a caster.");
    }
  }
}

/** Sets up the main event listeners for the page */
export function setupEventListeners(armyId) {
  const mainListContainer = document.getElementById("army-units-container");
  if (mainListContainer) {
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

  // Add listener for temporary "Start Round" button
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
