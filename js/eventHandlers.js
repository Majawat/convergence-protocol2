/**
 * @fileoverview Handles user interactions and events.
 */
import { config } from "./config.js";
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
  getArmyWoundStates, // Added getArmyWoundStates
} from "./state.js";
import { saveWoundState, saveComponentState } from "./storage.js";
import { findTargetModelForWound } from "./gameLogic.js";
import { updateModelDisplay, updateTokenDisplay } from "./ui.js";
import { showToast } from "./uiHelpers.js";

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
  let modelFoundInUnitId = null;

  if (specificModelId) {
    // Manual target
    targetModel = unitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel) {
      modelFoundInUnitId = unitId;
    } else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelFoundInUnitId = heroData.selectionId;
      }
    } // Use hero's ID
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      targetModel = null;
      modelFoundInUnitId = null;
    }
  } else {
    // Auto target
    targetModel = findTargetModelForWound(unitData, heroData);
    if (targetModel) {
      modelFoundInUnitId = targetModel.isHero ? heroData.selectionId : unitId;
    } // Use hero's ID
  }

  if (targetModel && modelFoundInUnitId) {
    targetModel.currentHp -= 1;
    updateGlobalWoundState(
      armyId,
      modelFoundInUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );
    updateModelDisplay(
      unitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    ); // UI uses base unit ID for card
    saveWoundState(getArmyWoundStates()); // Save the entire state object
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    console.log(
      `No models available to wound in unit ${unitId} (or specific model ${specificModelId} not found/valid).`
    );
    clearTargetHighlight(unitId);
  }
}

// --- Event Handlers ---

/** Handles clicks within the army units container */
function handleUnitInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return;
  const unitId = unitCard.dataset.unitId; // Base unit ID
  const armyId = unitCard.dataset.armyId;
  const clickedModelElement = event.target.closest(".clickable-model");

  // Wound application on model click
  if (clickedModelElement && event.type === "click") {
    const modelId = clickedModelElement.dataset.modelId;
    applyWound(armyId, unitId, modelId);
    return;
  }
  // Wound application via button
  if (event.target.closest(".wound-apply-btn")) {
    applyWound(armyId, unitId, null);
  }
  // Reset wounds
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
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp);
        updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
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
  // Add Token
  else if (event.target.closest(".token-add-btn")) {
    const unitData = getUnitData(armyId, unitId);
    if (!unitData) return;
    const heroData = getJoinedHeroData(armyId, unitId);
    const actualCasterUnit =
      heroData?.casterLevel > 0
        ? heroData
        : unitData?.casterLevel > 0
        ? unitData
        : null; // Find the actual caster

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
        updateTokenDisplay(unitId, newTokens, actualCasterUnit.casterLevel); // Update UI on the card
        saveComponentState(getArmyComponentStates());
      }
    } else {
      console.warn("Target unit/hero is not a caster:", unitId);
    }
  }
  // Remove Token
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
        saveComponentState(getArmyComponentStates());
      }
    } else {
      console.warn("Target unit/hero is not a caster:", unitId);
    }
  }
  // View Spells Button
  else if (event.target.closest(".view-spells-btn")) {
    console.log(`View Spells clicked for unit ${unitId}`);
    alert("Spell list display not yet implemented!");
    // TODO: Implement spell list modal/display
  }
}

/** Handles the 'Start New Round' button click */
function handleStartRoundClick(armyId) {
  console.log("--- Starting New Round (Generating Tokens) ---");
  const currentArmy = getLoadedArmyData(armyId);
  if (!currentArmy || !currentArmy.units) return;

  let stateChanged = false;
  let castersAffected = 0;
  // Iterate over ALL units in the processed data, including heroes not directly displayed
  currentArmy.units.forEach((unit) => {
    if (unit.casterLevel > 0) {
      const unitId = unit.selectionId; // Use the caster's actual unit ID
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
        updateGlobalComponentState(armyId, unitId, "tokens", newTokens);
        // Find the card ID (which is the base unit ID if the caster is a joined hero)
        const heroTargets = getCurrentArmyHeroTargets(armyId) || {};
        const cardUnitId = Object.keys(heroTargets).find(
          (heroKey) => heroKey === unitId
        )
          ? heroTargets[unitId] // Find the unit the hero is joined to
          : unitId; // Otherwise, it's the unit itself
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

/** Sets up the main event listeners */
export function setupEventListeners(armyId) {
  const mainListContainer = document.getElementById("army-units-container");
  if (mainListContainer) {
    // Use capturing phase to potentially override other listeners if needed, but false is standard
    mainListContainer.addEventListener(
      "click",
      handleUnitInteractionClick,
      false
    );
  } else {
    console.error("Could not find mainListContainer to attach listeners.");
  }

  // Add listener for temporary "Start Round" button
  const startRoundButton = document.getElementById("start-round-button");
  if (startRoundButton) {
    // Remove previous listener if any to prevent duplicates on potential re-renders
    startRoundButton.replaceWith(startRoundButton.cloneNode(true)); // Simple way to remove listeners
    document
      .getElementById("start-round-button")
      .addEventListener("click", () => handleStartRoundClick(armyId));
  } else {
    console.warn("Start Round button not found.");
  }
}
