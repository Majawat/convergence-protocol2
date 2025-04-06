/**
 * @fileoverview Handles user interactions and events for the OPR Army Tracker.
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
  getCurrentArmyHeroTargets,
  getCurrentArmyId,
  getCurrentRound, // Import new getter
  // State Updaters
  updateModelStateValue,
  updateUnitStateValue,
  incrementCurrentRound, // Import new updater
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js"; // Keep for round start reset logic
import { findTargetModelForWound } from "./gameLogic.js"; // Removed performMoraleCheck import
import {
  updateModelDisplay,
  updateTokenDisplay,
  updateActionButtonsUI, // Import new UI updater
  resetAllActionButtonsUI, // Import new UI resetter
  // Added Imports
  updateFatiguedStatusUI,
  updateShakenStatusUI,
  collapseDestroyedCard,
  collapseRoutedCard,
} from "./ui.js";
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
  _clearTargetHighlight(unitSelectionId);
  if (!modelId) return;

  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
  } else {
    // console.warn(`Could not find model ${modelId} within card ${unitSelectionId} to highlight.`);
  }
}

/**
 * Finds the actual caster unit (base or joined hero) associated with a unit card.
 * Assumes the current army context.
 * @param {string} cardUnitId - The selectionId of the unit card.
 * @returns {object | null} The processed unit data for the caster, or null if none found.
 * @private
 */
function _findActualCaster(cardUnitId) {
  const unitData = getUnitData(cardUnitId); // Assumes current army
  if (unitData?.casterLevel > 0) {
    return unitData;
  }
  const heroData = getJoinedHeroData(cardUnitId); // Assumes current army
  if (heroData?.casterLevel > 0) {
    return heroData;
  }
  return null;
}

// --- Action Functions ---

/**
 * Applies a wound to a specific model or uses auto-target logic.
 * Updates state (implicitly saving) and UI. Checks for unit destruction.
 * @param {string} armyId - The ID of the current army.
 * @param {string} cardUnitId - The selectionId of the unit card where the interaction occurred.
 * @param {string | null} [specificModelId=null] - The modelId to wound directly, or null for auto-target.
 */
function applyWound(armyId, cardUnitId, specificModelId = null) {
  // Get data assuming current army context
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
    const newHp = Math.max(0, targetModel.currentHp - 1); // Calculate new HP
    targetModel.currentHp = newHp; // Update model object in memory (important for findTargetModelForWound)

    // Update the state (this now also handles saving)
    updateModelStateValue(
      armyId,
      modelUnitId,
      targetModel.modelId,
      "currentHp",
      newHp
    );

    // Update the UI display
    updateModelDisplay(
      cardUnitId,
      targetModel.modelId,
      newHp,
      targetModel.maxHp
    );

    // --- Check for Unit Destruction ---
    // Re-fetch data in case state update changed something (unlikely but safe)
    const baseUnitDataForDestroyCheck = getUnitData(cardUnitId);
    const heroDataForDestroyCheck = getJoinedHeroData(cardUnitId);
    const allModels = [
      ...(baseUnitDataForDestroyCheck?.models || []),
      ...(heroDataForDestroyCheck?.models || []),
    ];
    // Ensure we only check if the unit wasn't already destroyed/routed
    const currentStatus = getUnitStateValue(
      armyId,
      cardUnitId,
      "status",
      "active"
    );
    const isUnitDestroyed =
      currentStatus === "active" &&
      allModels.length > 0 &&
      allModels.every((m) => m.currentHp <= 0);

    if (isUnitDestroyed) {
      console.log(
        `Unit ${cardUnitId} (and potentially joined hero) is Destroyed.`
      );
      updateUnitStateValue(armyId, cardUnitId, "status", "destroyed");
      if (heroDataForDestroyCheck) {
        updateUnitStateValue(
          armyId,
          heroDataForDestroyCheck.selectionId,
          "status",
          "destroyed"
        );
      }
      collapseDestroyedCard(cardUnitId); // Collapse the card UI
      showToast(
        `${baseUnitDataForDestroyCheck?.customName || cardUnitId} Destroyed!`,
        "Unit Destroyed"
      );
    } else {
      // Highlight the next model ONLY if unit not destroyed
      const nextAutoTarget = findTargetModelForWound(
        baseUnitDataForDestroyCheck,
        heroDataForDestroyCheck
      );
      _highlightNextAutoTargetModel(
        cardUnitId,
        nextAutoTarget ? nextAutoTarget.modelId : null
      );
    }
    // --- End Destruction Check ---
  } else {
    // Only show toast if the unit isn't already destroyed/routed
    const currentStatus = getUnitStateValue(
      armyId,
      cardUnitId,
      "status",
      "active"
    );
    if (currentStatus === "active") {
      showToast("All models in unit removed.");
    }
    _clearTargetHighlight(cardUnitId);
  }
}

/**
 * Handles the 'Start New Round' button click.
 * Increments the round counter.
 * Resets 'action', 'fatigued', 'attackedInMeleeThisRound' status for all units.
 * Generates spell tokens for casters.
 * @param {string} armyId - The ID of the current army.
 */
function handleStartRoundClick(armyId) {
  console.log(`--- Starting New Round for Army ${armyId} ---`);

  // 1. Increment Round Counter
  const newRound = incrementCurrentRound();
  console.log(`Round incremented to ${newRound}`);

  // Update Round Display UI (Assume an element with id="round-display" exists)
  const roundDisplayElement = document.getElementById("round-display");
  if (roundDisplayElement) {
    roundDisplayElement.textContent = `Round ${newRound}`;
  } else {
    // Create the element if it doesn't exist (e.g., add it near the H1 title)
    const titleH1 = document.getElementById("army-title-h1");
    if (titleH1) {
      let displaySpan = document.getElementById("round-display");
      if (!displaySpan) {
        displaySpan = document.createElement("span");
        displaySpan.id = "round-display";
        displaySpan.className = "ms-3 badge bg-info align-middle"; // Style as a badge
        titleH1.parentNode.insertBefore(displaySpan, titleH1.nextSibling); // Insert after H1
      }
      displaySpan.textContent = `Round ${newRound}`;
    }
  }

  const currentArmyProcessedData = getLoadedArmyData(); // Get processed data for unit iteration
  if (!currentArmyProcessedData || !currentArmyProcessedData.units) {
    showToast("Error: Army data not loaded.", "Error");
    return;
  }

  // Load the entire current state for modification
  let armyState = loadArmyState(armyId);
  if (!armyState) {
    console.error(`Could not load state for army ${armyId} to start round.`);
    showToast("Error loading army state.", "Error");
    return; // Need state to modify
  }
  if (!armyState.units) armyState.units = {}; // Ensure units object exists

  let stateChanged = false;
  const casterUpdates = [];
  const heroTargets = getCurrentArmyHeroTargets(); // Get hero targets once

  // Iterate through ALL units defined in the *processed data* to ensure we cover everyone
  currentArmyProcessedData.units.forEach((unit) => {
    const unitId = unit.selectionId;

    // Ensure unit exists in state, initialize if not (should have been done by app.js, but safe check)
    if (!armyState.units[unitId]) {
      armyState.units[unitId] = {
        status: "active",
        shaken: false,
        fatigued: false,
        attackedInMeleeThisRound: false, // Initialize new flag
        action: null,
        limitedWeaponUsed: false,
        tokens: 0,
        models: {},
      };
      // Note: Models might be missing here if unit was added mid-campaign? Needs robust init.
      stateChanged = true;
    }

    const unitState = armyState.units[unitId];

    // Skip resets for destroyed/routed units
    if (unitState.status === "destroyed" || unitState.status === "routed") {
      return;
    }

    // Reset action, fatigue, and melee flag for the new round
    if (unitState.action !== null) {
      unitState.action = null;
      stateChanged = true;
    }
    if (unitState.fatigued !== false) {
      unitState.fatigued = false; // Reset fatigue
      // Update UI for fatigue removal
      const cardId = heroTargets?.[unitId] || unitId; // Find the card ID
      updateFatiguedStatusUI(cardId, false);
      stateChanged = true;
    }
    if (unitState.attackedInMeleeThisRound !== false) {
      // Reset new flag
      unitState.attackedInMeleeThisRound = false;
      stateChanged = true;
    }

    // Generate tokens for casters
    if (unit.casterLevel > 0) {
      const currentTokens = unitState.tokens || 0; // Use state value
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );
      const actualTokensAdded = newTokens - currentTokens;

      if (actualTokensAdded > 0) {
        unitState.tokens = newTokens; // Update state directly
        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
          unitId: unitId, // Store unitId for UI update later
          casterLevel: unit.casterLevel,
        });
        stateChanged = true;
      }
    }
  });

  // Save the entire modified state object ONCE after all updates
  if (stateChanged) {
    saveArmyState(armyId, armyState);
    console.log(
      `State updated and saved for start of round ${newRound} for army ${armyId}.`
    );
  }

  // Reset Action Button UI for all cards (respecting Shaken status)
  resetAllActionButtonsUI();

  // Format and show toast message
  let toastMessage = `Round ${newRound} Started!`; // Add confirmation
  toastMessage += "\nAll Unit Actions & Fatigue reset.";
  if (casterUpdates.length > 0) {
    toastMessage += "\nSpell Tokens Generated:";
    casterUpdates.forEach((update) => {
      // Find card ID for UI update
      const cardUnitId = heroTargets?.[update.unitId] || update.unitId;
      // Update token display on the card
      updateTokenDisplay(cardUnitId, update.total, update.casterLevel);

      toastMessage += `\n- ${update.name}: +${update.added
        .toString()
        .padStart(1, "\u00A0")}, now ${update.total}`;
    });
  } else {
    toastMessage += "\nNo casters required token updates.";
  }
  showToast(toastMessage, `Round ${newRound}`);
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
  const baseUnitData = getUnitData(cardUnitId); // Assumes current army
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(cardUnitId); // Assumes current army
  const heroId = heroData ? heroData.selectionId : null;

  console.log(
    `Resetting wounds for card unit ${cardUnitId}` +
      (heroId ? ` (and joined hero ${heroId})` : "")
  );

  let stateChanged = false; // Track if any changes were made

  // Load the current full state once
  let armyState = loadArmyState(armyId);
  if (!armyState || !armyState.units) {
    console.error(`Cannot reset wounds: State not found for army ${armyId}`);
    return;
  }

  // Function to reset a model's HP in the state object
  const resetModelHp = (unitId, modelId, maxHp) => {
    if (armyState.units[unitId]?.models?.[modelId]?.currentHp !== maxHp) {
      if (!armyState.units[unitId]) armyState.units[unitId] = { models: {} }; // Ensure unit exists
      if (!armyState.units[unitId].models) armyState.units[unitId].models = {}; // Ensure models exist
      if (!armyState.units[unitId].models[modelId])
        armyState.units[unitId].models[modelId] = {}; // Ensure model exists
      armyState.units[unitId].models[modelId].currentHp = maxHp;
      // Also update the in-memory processed data for highlighting
      const targetModel = (getUnitData(unitId)?.models || []).find(
        (m) => m.modelId === modelId
      );
      if (targetModel) targetModel.currentHp = maxHp;
      // Update UI
      updateModelDisplay(cardUnitId, modelId, maxHp, maxHp); // cardUnitId for UI element
      return true; // Indicate change occurred
    }
    return false;
  };

  // Reset base unit models
  baseUnitData.models.forEach((model) => {
    if (resetModelHp(cardUnitId, model.modelId, model.maxHp)) {
      stateChanged = true;
    }
  });

  // Reset hero models if joined
  if (heroData && heroId) {
    heroData.models.forEach((model) => {
      if (resetModelHp(heroId, model.modelId, model.maxHp)) {
        // Use heroId for state
        stateChanged = true;
      }
    });
  }

  // Save the entire state object ONCE if changes were made
  if (stateChanged) {
    saveArmyState(armyId, armyState);
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
  const actualCasterUnit = _findActualCaster(cardUnitId); // Assumes current army
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0); // Use new getter

  if (currentTokens < config.MAX_SPELL_TOKENS) {
    const newTokens = currentTokens + 1;
    // Update state (this now saves implicitly)
    updateUnitStateValue(armyId, casterUnitId, "tokens", newTokens);
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
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
  const actualCasterUnit = _findActualCaster(cardUnitId); // Assumes current army
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0); // Use new getter

  if (currentTokens > 0) {
    const newTokens = currentTokens - 1;
    // Update state (this now saves implicitly)
    updateUnitStateValue(armyId, casterUnitId, "tokens", newTokens);
    updateTokenDisplay(cardUnitId, newTokens, actualCasterUnit.casterLevel);
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
  const actualCasterUnit = _findActualCaster(cardUnitId); // Assumes current army
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }

  const casterUnitId = actualCasterUnit.selectionId;
  const casterFactionId = actualCasterUnit.factionId;
  const armyBooks = getArmyBooksData();
  const spellList = armyBooks[casterFactionId]?.spells || null;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0); // Use new getter

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

  const currentTokens = getUnitStateValue(armyId, casterId, "tokens", 0); // Use new getter

  if (currentTokens >= spellCost) {
    const newTokens = currentTokens - spellCost;

    // 1. Update State (this now saves implicitly)
    updateUnitStateValue(armyId, casterId, "tokens", newTokens); // Use new updater

    // 2. Update UI
    const heroTargets = getCurrentArmyHeroTargets(); // Assumes current army context
    const cardUnitId = heroTargets?.[casterId] || casterId;

    const casterUnitData = getUnitData(casterId); // Assumes current army context
    if (casterUnitData) {
      updateTokenDisplay(cardUnitId, newTokens, casterUnitData.casterLevel); // Update main card display
    }

    // Update token display inside the modal
    const modalTokenDisplay = document.getElementById(
      "modalCasterTokenDisplay"
    );
    if (modalTokenDisplay) {
      modalTokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${newTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
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

    // 3. Show Feedback Toast - MODIFIED: No dice roll mentioned
    showToast(
      `Casting ${spellName}! Player rolls 4+ to succeed.\nCasters within 18" may spend a Spell Token to modify the roll.`,
      "Spell Cast"
    );
  } else {
    showToast(`Not enough tokens to cast ${spellName}.`, "Cast Failed");
  }
}

/**
 * Handles clicks on the action buttons ("Hold", "Advance", etc.) and "Recover".
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleActionButtonClick(targetElement, armyId, cardUnitId) {
  const actionType = targetElement.dataset.action;
  if (!actionType) return;

  const isShaken = getUnitStateValue(armyId, cardUnitId, "shaken", false);
  const currentAction = getUnitStateValue(armyId, cardUnitId, "action", null);
  const unitData = getUnitData(cardUnitId); // Get unit data for name

  if (isShaken) {
    if (actionType === "Recover") {
      console.log(`Unit ${cardUnitId} recovering from Shaken.`);
      updateUnitStateValue(armyId, cardUnitId, "shaken", false);
      updateUnitStateValue(armyId, cardUnitId, "action", null); // Deactivate after recovery
      updateShakenStatusUI(cardUnitId, false); // Update indicator & buttons
      showToast(
        `${unitData?.customName || cardUnitId} recovered from Shaken.`,
        "Recovery"
      );
    } else {
      showToast("Shaken unit must Recover.", "Action Blocked");
    }
    return; // Stop further processing for shaken units unless recovering
  }

  // --- Normal Action Handling (Not Shaken) ---
  let newAction = null;
  if (currentAction === actionType) {
    newAction = null; // Deactivate
    console.log(`Unit ${cardUnitId} deactivated.`);
  } else {
    newAction = actionType; // Activate
    console.log(`Unit ${cardUnitId} activated with action: ${newAction}`);

    // --- CHARGE ACTION: Prompt for hits/wounds and apply fatigue ---
    if (newAction === "Charge") {
      // !!! Replace prompt with a modal or better UI input !!!
      const woundsCausedStr = prompt(
        `CHARGE: How many WOUNDS did ${
          unitData?.customName || cardUnitId
        } cause?`
      );
      const woundsCaused = parseInt(woundsCausedStr, 10);
      if (!isNaN(woundsCaused) && woundsCaused >= 0) {
        // Allow 0 wounds
        console.log(
          `Unit ${cardUnitId} caused ${woundsCaused} wounds on charge.`
        );
        // Apply fatigue if first melee attack this round
        const isFirstMelee = !getUnitStateValue(
          armyId,
          cardUnitId,
          "attackedInMeleeThisRound",
          false
        );
        if (isFirstMelee) {
          updateUnitStateValue(armyId, cardUnitId, "fatigued", true);
          updateUnitStateValue(
            armyId,
            cardUnitId,
            "attackedInMeleeThisRound",
            true
          );
          updateFatiguedStatusUI(cardUnitId, true);
          console.log(`Unit ${cardUnitId} is now Fatigued.`);
        }
      } else {
        console.warn("Invalid wound input for charge.");
      }
      // Note: Need to handle the defender striking back via the separate button
    }
    // --- END CHARGE ---
  }

  updateUnitStateValue(armyId, cardUnitId, "action", newAction);
  updateActionButtonsUI(cardUnitId, newAction, false); // Explicitly pass isShaken = false
}

// --- NEW: Specific Handlers for Manual Triggers ---

/**
 * Handles clicks on the "Defend Melee" button.
 * Prompts user if they strike back and how many wounds they caused. Applies fatigue.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleDefendMeleeClick(targetElement, armyId, cardUnitId) {
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;
  console.log(`Unit ${cardUnitId} reporting being attacked in melee.`);

  // !!! Replace confirm/prompt with modal/UI !!!
  const strikesBack = confirm(
    `Did ${unitData.customName || cardUnitId} Strike Back?`
  );

  if (strikesBack) {
    const woundsCausedStr = prompt(
      `STRIKE BACK: How many WOUNDS did ${
        unitData.customName || cardUnitId
      } cause?`
    );
    const woundsCaused = parseInt(woundsCausedStr, 10);
    if (!isNaN(woundsCaused) && woundsCaused >= 0) {
      // Allow 0 wounds
      console.log(
        `Unit ${cardUnitId} struck back causing ${woundsCaused} wounds.`
      );
      // Apply fatigue if first melee attack this round
      const isFirstMelee = !getUnitStateValue(
        armyId,
        cardUnitId,
        "attackedInMeleeThisRound",
        false
      );
      if (isFirstMelee) {
        updateUnitStateValue(armyId, cardUnitId, "fatigued", true);
        updateUnitStateValue(
          armyId,
          cardUnitId,
          "attackedInMeleeThisRound",
          true
        );
        updateFatiguedStatusUI(cardUnitId, true);
        console.log(`Unit ${cardUnitId} is now Fatigued.`);
      }
    } else {
      console.warn("Invalid wound input for strike back.");
    }
  } else {
    console.log(`Unit ${cardUnitId} did not strike back.`);
  }
  // Now the player should click "Resolve Melee Outcome"
  showToast(
    "Melee defense reported. Click 'Resolve Melee Outcome' next.",
    "Melee"
  );
}

/**
 * Handles clicks on the "Resolve Melee Outcome" button.
 * Prompts user for win/loss/tie, then morale result if lost. Applies Shaken/Routed.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleResolveMeleeClick(targetElement, armyId, cardUnitId) {
  console.log(`Resolving melee outcome for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;

  // !!! Replace prompt with modal/UI with buttons !!!
  const outcome = prompt(
    `Did ${
      unitData.customName || unitData.originalName
    } WIN, LOSE, or TIE the melee? (Enter W/L/T)`
  ).toUpperCase();

  if (outcome === "L") {
    console.log(`Unit ${cardUnitId} lost melee. Checking morale.`);
    const quality = unitData.quality;
    // !!! Replace confirm with modal/UI with Pass/Fail buttons !!!
    const passedMorale = confirm(
      `MELEE MORALE TEST (Quality ${quality}+): Did the unit PASS?`
    );

    if (!passedMorale) {
      // Check half strength for Routing
      // TODO: Need a reliable way to get STARTING size/toughness, maybe store in state?
      // For now, approximating with current processed data size.
      const startingSize = unitData.size;
      const currentModels = unitData.models.filter(
        (m) => m.currentHp > 0
      ).length;
      // TODO: Handle Tough(X) models appropriately for 'starting size' if needed
      const isHalfStrength = currentModels * 2 <= startingSize;

      if (isHalfStrength) {
        console.log(
          `Unit ${cardUnitId} fails morale at half strength -> ROUTED!`
        );
        updateUnitStateValue(armyId, cardUnitId, "status", "routed");
        collapseRoutedCard(cardUnitId); // Collapse the card UI
        showToast(
          `${unitData.customName || cardUnitId} Routed!`,
          "Melee Outcome"
        );
      } else {
        console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
        updateUnitStateValue(armyId, cardUnitId, "shaken", true);
        updateShakenStatusUI(cardUnitId, true); // Update UI
        showToast(
          `${unitData.customName || cardUnitId} became Shaken!`,
          "Melee Outcome"
        );
      }
    } else {
      console.log(`Unit ${cardUnitId} passed melee morale test.`);
      showToast("Melee Lost, Morale Passed.", "Melee Outcome");
    }
  } else if (outcome === "W" || outcome === "T") {
    console.log(
      `Unit ${cardUnitId} ${
        outcome === "W" ? "won" : "tied"
      } melee. No morale test from outcome.`
    );
    showToast(
      `Melee outcome: ${outcome === "W" ? "Win" : "Tie"}`,
      "Melee Resolved"
    );
  } else {
    showToast("Invalid input. Please enter W, L, or T.", "Error");
  }
}

/**
 * Handles clicks on the "Check Morale (Wounds)" button.
 * Checks if unit is <= half strength, then prompts for morale result. Applies Shaken.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
function _handleMoraleWoundsClick(targetElement, armyId, cardUnitId) {
  console.log(`Manual morale check for wounds for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;

  const quality = unitData.quality;
  // Check: is unit actually <= half strength?
  // TODO: Need reliable starting size/toughness
  const startingSize = unitData.size;
  const currentModels = unitData.models.filter((m) => m.currentHp > 0).length;
  const isHalfStrength = currentModels * 2 <= startingSize;

  if (!isHalfStrength) {
    showToast(
      `Unit is not at half strength or less. Morale check not required for wounds.`,
      "Morale Check"
    );
    return;
  }

  // !!! Replace confirm with modal/UI with Pass/Fail buttons !!!
  const passedMorale = confirm(
    `WOUNDS MORALE TEST (Quality ${quality}+): Did the unit PASS?`
  );

  if (!passedMorale) {
    console.log(`Unit ${cardUnitId} fails morale from wounds -> SHAKEN!`);
    updateUnitStateValue(armyId, cardUnitId, "shaken", true);
    updateShakenStatusUI(cardUnitId, true); // Update UI
    showToast(
      `${unitData.customName || cardUnitId} became Shaken!`,
      "Morale Check"
    );
  } else {
    console.log(`Unit ${cardUnitId} passed wounds morale test.`);
    showToast("Morale test passed.", "Morale Check");
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

    // Check if card is destroyed/routed first
    if (
      unitCard.classList.contains("unit-destroyed") ||
      unitCard.classList.contains("unit-routed")
    ) {
      return; // Ignore clicks on collapsed cards
    }

    const modelElement = event.target.closest(".clickable-model");
    const woundButton = event.target.closest(".wound-apply-btn");
    const resetButton = event.target.closest(".wound-reset-btn");
    const addTokenButton = event.target.closest(".token-add-btn");
    const removeTokenButton = event.target.closest(".token-remove-btn");
    const viewSpellsButton = event.target.closest(".view-spells-btn");
    const actionButton = event.target.closest(".action-btn"); // Includes Recover button now
    // New button selectors
    const defendMeleeButton = event.target.closest(".defend-melee-btn");
    const resolveMeleeButton = event.target.closest(".resolve-melee-btn");
    const moraleWoundsButton = event.target.closest(".morale-wounds-btn");

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
    else if (actionButton)
      _handleActionButtonClick(
        actionButton,
        armyId,
        cardUnitId
      ); // Handles actions AND recover
    // New button handlers
    else if (defendMeleeButton)
      _handleDefendMeleeClick(defendMeleeButton, armyId, cardUnitId);
    else if (resolveMeleeButton)
      _handleResolveMeleeClick(resolveMeleeButton, armyId, cardUnitId);
    else if (moraleWoundsButton)
      _handleMoraleWoundsClick(moraleWoundsButton, armyId, cardUnitId);
  } else if (spellModal) {
    const castButton = event.target.closest(".cast-spell-btn");
    if (castButton) {
      _handleCastSpellClick(castButton);
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
    const newButton = startRoundButton.cloneNode(true); // Clone to remove old listeners
    startRoundButton.parentNode.replaceChild(newButton, startRoundButton);
    newButton.addEventListener("click", () => handleStartRoundClick(armyId)); // Pass armyId here
    console.log("Start Round button listener attached.");
  } else {
    console.warn("Start Round button not found.");
  }

  // Initialize Round Display on load
  const initialRound = getCurrentRound();
  const roundDisplayElement = document.getElementById("round-display");
  if (roundDisplayElement) {
    roundDisplayElement.textContent = `Round ${initialRound}`;
  } else {
    // Create if doesn't exist
    const titleH1 = document.getElementById("army-title-h1");
    if (titleH1) {
      let displaySpan = document.getElementById("round-display");
      if (!displaySpan) {
        displaySpan = document.createElement("span");
        displaySpan.id = "round-display";
        displaySpan.className = "ms-3 badge bg-info align-middle"; // Style as a badge
        titleH1.parentNode.insertBefore(displaySpan, titleH1.nextSibling);
      }
      displaySpan.textContent = `Round ${initialRound}`;
    }
  }
}
