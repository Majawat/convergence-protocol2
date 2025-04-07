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
  getCurrentRound,
  // State Updaters
  updateModelStateValue,
  updateUnitStateValue,
  incrementCurrentRound,
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js";
import { findTargetModelForWound, checkHalfStrength } from "./gameLogic.js";
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
} from "./ui.js";
import { showToast, populateAndShowSpellModal } from "./uiHelpers.js";

// --- Placeholder for a more robust interactive toast/modal system ---
/**
 * Shows a message with interactive buttons and returns a Promise resolving with the clicked button's value.
 * Replace this with your actual modal/toast implementation.
 * @param {string} message - The message to display.
 * @param {string[]} buttons - An array of button labels (e.g., ["Yes", "No"], ["Pass", "Fail"], ["Win", "Lose", "Tie"]).
 * @param {string} [title='Input Needed'] - Optional title.
 * @returns {Promise<string|null>} A promise resolving with the text of the clicked button, or null if cancelled.
 */
async function showInteractivePrompt(
  message,
  buttons = ["OK"],
  title = "Input Needed"
) {
  console.warn(
    "Using placeholder showInteractivePrompt. Implement a real modal/toast system."
  );
  // Simple prompt for now, replace with UI
  let choice = null;
  if (buttons.length === 2 && buttons[0] === "Yes" && buttons[1] === "No") {
    choice = confirm(`${title}\n\n${message}`) ? "Yes" : "No";
  } else if (
    buttons.length === 2 &&
    buttons[0] === "Pass" &&
    buttons[1] === "Fail"
  ) {
    choice = confirm(`${title}\n\n${message}\n\nOK for Pass, Cancel for Fail`)
      ? "Pass"
      : "Fail";
  } else if (
    buttons.length === 3 &&
    buttons[0] === "Win" &&
    buttons[1] === "Lose" &&
    buttons[2] === "Tie"
  ) {
    let validInput = false;
    while (!validInput) {
      const input = prompt(`${title}\n\n${message}\n\nEnter W, L, or T:`);
      if (input === null) {
        choice = null;
        validInput = true;
      } else {
        const upperInput = input.toUpperCase();
        if (["W", "L", "T"].includes(upperInput)) {
          choice =
            upperInput === "W" ? "Win" : upperInput === "L" ? "Lose" : "Tie";
          validInput = true;
        } else {
          alert("Invalid input. Please enter W, L, or T.");
        }
      }
    }
  } else {
    alert(`${title}\n\n${message}`);
    choice = buttons[0] || null;
  }
  return Promise.resolve(choice);
}

// --- Internal Helper Functions ---

function _clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) highlighted.classList.remove("target-model");
}

function _highlightNextAutoTargetModel(unitSelectionId, modelId) {
  _clearTargetHighlight(unitSelectionId);
  if (!modelId) return;
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
  }
}

function _findActualCaster(cardUnitId) {
  const unitData = getUnitData(cardUnitId);
  if (unitData?.casterLevel > 0) return unitData;
  const heroData = getJoinedHeroData(cardUnitId);
  if (heroData?.casterLevel > 0) return heroData;
  return null;
}

// --- Action Functions ---

function applyWound(armyId, cardUnitId, specificModelId = null) {
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) {
    console.error(
      `Base unit data not found for applyWound: unit ${cardUnitId}`
    );
    return;
  }
  const heroData = getJoinedHeroData(cardUnitId);
  let targetModel = null;
  let modelUnitId = null;

  if (specificModelId) {
    targetModel = baseUnitData.models.find(
      (m) => m.modelId === specificModelId
    );
    if (targetModel) modelUnitId = cardUnitId;
    else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) modelUnitId = heroData.selectionId;
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
    if (targetModel)
      modelUnitId = targetModel.isHero ? heroData.selectionId : cardUnitId;
  }

  if (targetModel && modelUnitId) {
    const newHp = Math.max(0, targetModel.currentHp - 1);
    targetModel.currentHp = newHp; // Update in-memory model
    updateModelStateValue(
      armyId,
      modelUnitId,
      targetModel.modelId,
      "currentHp",
      newHp
    );
    updateModelDisplay(
      cardUnitId,
      targetModel.modelId,
      newHp,
      targetModel.maxHp
    );

    const baseUnitDataForDestroyCheck = getUnitData(cardUnitId);
    const heroDataForDestroyCheck = getJoinedHeroData(cardUnitId);
    const allModels = [
      ...(baseUnitDataForDestroyCheck?.models || []),
      ...(heroDataForDestroyCheck?.models || []),
    ];
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
      if (heroDataForDestroyCheck)
        updateUnitStateValue(
          armyId,
          heroDataForDestroyCheck.selectionId,
          "status",
          "destroyed"
        );
      collapseDestroyedCard(cardUnitId);
      showToast(
        `${baseUnitDataForDestroyCheck?.customName || cardUnitId} Destroyed!`,
        "Unit Destroyed"
      );
    } else {
      const nextAutoTarget = findTargetModelForWound(
        baseUnitDataForDestroyCheck,
        heroDataForDestroyCheck
      );
      _highlightNextAutoTargetModel(
        cardUnitId,
        nextAutoTarget ? nextAutoTarget.modelId : null
      );
    }
  } else {
    const currentStatus = getUnitStateValue(
      armyId,
      cardUnitId,
      "status",
      "active"
    );
    if (currentStatus === "active") showToast("All models in unit removed.");
    _clearTargetHighlight(cardUnitId);
  }
}

function handleStartRoundClick(armyId) {
  console.log(`--- Starting New Round for Army ${armyId} ---`);
  const newRound = incrementCurrentRound();
  console.log(`Round incremented to ${newRound}`);
  const roundDisplayElement = document.getElementById("round-display");
  if (roundDisplayElement)
    roundDisplayElement.textContent = `Round ${newRound}`;
  else {
    const titleH1 = document.getElementById("army-title-h1");
    if (titleH1) {
      let displaySpan = document.getElementById("round-display");
      if (!displaySpan) {
        displaySpan = document.createElement("h3");
        displaySpan.id = "round-display";
        displaySpan.className = "ms-3 align-middle";
        titleH1.parentNode.insertBefore(displaySpan, titleH1.nextSibling);
      }
      displaySpan.textContent = `Round ${newRound}`;
    }
  }

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

  currentArmyProcessedData.units.forEach((unit) => {
    const unitId = unit.selectionId;
    if (!armyState.units[unitId]) {
      armyState.units[unitId] = {
        status: "active",
        shaken: false,
        fatigued: false,
        attackedInMeleeThisRound: false,
        action: null,
        limitedWeaponUsed: false,
        tokens: 0,
        models: {},
      };
      stateChanged = true;
    }
    const unitState = armyState.units[unitId];
    if (unitState.status === "destroyed" || unitState.status === "routed")
      return;
    const cardId = heroTargets?.[unitId] || unitId;
    if (unitState.action !== null) {
      unitState.action = null;
      stateChanged = true;
    }
    if (unitState.fatigued !== false) {
      unitState.fatigued = false;
      updateFatiguedStatusUI(cardId, false);
      stateChanged = true;
    }
    if (unitState.attackedInMeleeThisRound !== false) {
      unitState.attackedInMeleeThisRound = false;
      stateChanged = true;
    }
    if (unit.casterLevel > 0) {
      const currentTokens = unitState.tokens || 0;
      const tokensToAdd = unit.casterLevel;
      const newTokens = Math.min(
        config.MAX_SPELL_TOKENS,
        currentTokens + tokensToAdd
      );
      const actualTokensAdded = newTokens - currentTokens;
      if (actualTokensAdded > 0) {
        unitState.tokens = newTokens;
        casterUpdates.push({
          name: unit.customName || unit.originalName,
          added: actualTokensAdded,
          total: newTokens,
          unitId: unitId,
          casterLevel: unit.casterLevel,
        });
        stateChanged = true;
      }
    }
  });

  if (stateChanged) saveArmyState(armyId, armyState);
  console.log(
    `State updated and saved for start of round ${newRound} for army ${armyId}.`
  );
  resetAllActionButtonsUI();

  let toastMessage = `Round ${newRound} Started!\nAll Unit Actions & Fatigue reset.`;
  if (casterUpdates.length > 0) {
    toastMessage += "\nSpell Tokens Generated:";
    casterUpdates.forEach((update) => {
      const cardUnitId = heroTargets?.[update.unitId] || update.unitId;
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

function _handleModelWoundClick(targetElement, armyId, cardUnitId) {
  const modelId = targetElement.dataset.modelId;
  if (modelId) applyWound(armyId, cardUnitId, modelId);
  else console.warn("Clicked model element missing data-model-id attribute.");
}

function _handleAutoWoundButtonClick(targetElement, armyId, cardUnitId) {
  applyWound(armyId, cardUnitId, null);
}

async function _handleResetUnitClick(targetElement, armyId, cardUnitId) {
  const baseUnitData = getUnitData(cardUnitId);
  if (!baseUnitData) return;
  const heroData = getJoinedHeroData(cardUnitId);
  const heroId = heroData ? heroData.selectionId : null;

  const confirmReset = await showInteractivePrompt(
    `Fully reset ${
      baseUnitData.customName || baseUnitData.originalName
    } (HP, Status, Action)?`,
    ["Reset", "Cancel"],
    "Confirm Reset"
  );
  if (confirmReset !== "Reset") return;

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

  const resetUnitState = (unitId, unitData) => {
    if (!armyState.units[unitId]) return false;
    const unitState = armyState.units[unitId];
    let unitModified = false;
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
    unitData.models.forEach((model) => {
      if (unitState.models?.[model.modelId]?.currentHp !== model.maxHp) {
        if (!unitState.models) unitState.models = {};
        if (!unitState.models[model.modelId])
          unitState.models[model.modelId] = {};
        unitState.models[model.modelId].currentHp = model.maxHp;
        const targetModel = (getUnitData(unitId)?.models || []).find(
          (m) => m.modelId === model.modelId
        );
        if (targetModel) targetModel.currentHp = model.maxHp;
        updateModelDisplay(cardUnitId, model.modelId, model.maxHp, model.maxHp);
        unitModified = true;
      }
    });
    return unitModified;
  };

  if (resetUnitState(cardUnitId, baseUnitData)) stateChanged = true;
  if (heroData && heroId && resetUnitState(heroId, heroData))
    stateChanged = true;

  if (stateChanged) {
    saveArmyState(armyId, armyState);
    showToast(
      `Unit state reset for ${
        baseUnitData.customName || baseUnitData.originalName
      }.`,
      "Unit Reset"
    );
  }
  resetCardUI(cardUnitId);
  const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
  _highlightNextAutoTargetModel(
    cardUnitId,
    nextAutoTarget ? nextAutoTarget.modelId : null
  );
}

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

function _handleViewSpellsClick(targetElement, armyId, cardUnitId) {
  const actualCasterUnit = _findActualCaster(cardUnitId);
  if (!actualCasterUnit) {
    showToast("This unit is not a caster.");
    return;
  }
  const casterUnitId = actualCasterUnit.selectionId;
  const casterFactionId = actualCasterUnit.factionId;
  const armyBooks = getArmyBooksData();
  const spellList = armyBooks[casterFactionId]?.spells || null;
  const currentTokens = getUnitStateValue(armyId, casterUnitId, "tokens", 0);
  populateAndShowSpellModal(actualCasterUnit, spellList, currentTokens);
}

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
  const currentTokens = getUnitStateValue(armyId, casterId, "tokens", 0);
  if (currentTokens >= spellCost) {
    const newTokens = currentTokens - spellCost;
    updateUnitStateValue(armyId, casterId, "tokens", newTokens);
    const heroTargets = getCurrentArmyHeroTargets();
    const cardUnitId = heroTargets?.[casterId] || casterId;
    const casterUnitData = getUnitData(casterId);
    if (casterUnitData)
      updateTokenDisplay(cardUnitId, newTokens, casterUnitData.casterLevel);
    const modalTokenDisplay = document.getElementById(
      "modalCasterTokenDisplay"
    );
    if (modalTokenDisplay)
      modalTokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${newTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
    const modalElement = document.getElementById("viewSpellsModal");
    if (modalElement) {
      modalElement.querySelectorAll(".cast-spell-btn").forEach((btn) => {
        const cost = parseInt(btn.dataset.spellCost, 10);
        if (!isNaN(cost)) btn.disabled = newTokens < cost;
      });
    }
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
 * Charge action applies fatigue and triggers melee resolution prompts for the charger.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
async function _handleActionButtonClick(targetElement, armyId, cardUnitId) {
  const actionType = targetElement.dataset.action;
  if (!actionType) return;

  const isShaken = getUnitStateValue(armyId, cardUnitId, "shaken", false);
  const currentAction = getUnitStateValue(armyId, cardUnitId, "action", null);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return; // Need unit data

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
    return;
  }

  let newAction = null;
  if (currentAction === actionType) {
    newAction = null; // Deactivate
    console.log(`Unit ${cardUnitId} deactivated.`);
    // Update state and UI immediately for deactivation
    updateUnitStateValue(armyId, cardUnitId, "action", newAction);
    updateActionButtonsUI(cardUnitId, newAction, false);
  } else {
    newAction = actionType; // Activate
    console.log(`Unit ${cardUnitId} activated with action: ${newAction}`);

    // Update state and UI first
    updateUnitStateValue(armyId, cardUnitId, "action", newAction);
    updateActionButtonsUI(cardUnitId, newAction, false); // Pass isShaken = false

    // --- CHARGE ACTION: Apply fatigue and RESOLVE MELEE for the CHARGER ---
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
        updateUnitStateValue(
          armyId,
          cardUnitId,
          "attackedInMeleeThisRound",
          true
        );
        updateFatiguedStatusUI(cardUnitId, true);
        console.log(`Unit ${cardUnitId} is now Fatigued from charging.`);
      }

      // --- Immediately trigger melee resolution flow for the CHARGER ---
      console.log(`Resolving melee outcome for charger ${cardUnitId}`);

      // 1. Ask for Melee Outcome (for the CHARGING unit)
      const outcome = await showInteractivePrompt(
        `Did ${
          unitData.customName || cardUnitId
        } (the Charger) WIN, LOSE, or TIE the melee?`,
        ["Win", "Lose", "Tie"],
        "Melee: Charger Outcome?"
      );

      if (outcome === "Lose") {
        console.log(`Charging unit ${cardUnitId} lost melee. Checking morale.`);
        const quality = unitData.quality;
        // 2. Ask for Morale Result
        const moraleResult = await showInteractivePrompt(
          `MELEE MORALE TEST (Quality ${quality}+): Did ${
            unitData.customName || cardUnitId
          } PASS or FAIL?`,
          ["Pass", "Fail"],
          "Melee: Charger Morale"
        );

        if (moraleResult === "Fail") {
          // 3. Check half strength for Routing
          const isHalf = checkHalfStrength(unitData);

          if (isHalf) {
            console.log(
              `Unit ${cardUnitId} fails morale at half strength -> ROUTED!`
            );
            updateUnitStateValue(armyId, cardUnitId, "status", "routed");
            collapseRoutedCard(cardUnitId);
            showToast(
              `${unitData.customName || cardUnitId} Routed!`,
              "Melee Outcome"
            );
          } else {
            console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
            updateUnitStateValue(armyId, cardUnitId, "shaken", true);
            updateShakenStatusUI(cardUnitId, true);
            showToast(
              `${unitData.customName || cardUnitId} became Shaken!`,
              "Melee Outcome"
            );
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
 * Handles clicks on the "Resolve Melee Outcome" button (for the unit involved, likely defender).
 * Prompts user if THIS unit struck back (for fatigue), then win/loss/tie, then morale result if lost. Applies Shaken/Routed.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card (this is the unit involved in the melee).
 * @private
 */
async function _handleResolveMeleeClick(targetElement, armyId, cardUnitId) {
  console.log(`Resolving melee outcome for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;

  // 1. Ask if THIS unit Struck Back (for fatigue)
  const didStrikeBack = await showInteractivePrompt(
    `Did ${unitData.customName || cardUnitId} Strike Back in this melee?`,
    ["Yes", "No"],
    "Melee: Strike Back?"
  );

  if (didStrikeBack === "Yes") {
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
      console.log(`Unit ${cardUnitId} is now Fatigued from striking back.`);
    }
  } else if (didStrikeBack === null) {
    console.log("Strike back prompt cancelled.");
    return; // Cancelled
  }

  // 2. Ask for Melee Outcome for THIS unit
  const outcome = await showInteractivePrompt(
    `Did ${
      unitData.customName || unitData.originalName
    } WIN, LOSE, or TIE the melee?`,
    ["Win", "Lose", "Tie"],
    "Melee: Outcome?"
  );

  if (outcome === "Lose") {
    console.log(`Unit ${cardUnitId} lost melee. Checking morale.`);
    const quality = unitData.quality;
    // 3. Ask for Morale Result
    const moraleResult = await showInteractivePrompt(
      `MELEE MORALE TEST (Quality ${quality}+): Did the unit PASS or FAIL?`,
      ["Pass", "Fail"],
      "Melee: Morale Test"
    );

    if (moraleResult === "Fail") {
      // 4. Check half strength for Routing
      const isHalf = checkHalfStrength(unitData);

      if (isHalf) {
        console.log(
          `Unit ${cardUnitId} fails morale at half strength -> ROUTED!`
        );
        updateUnitStateValue(armyId, cardUnitId, "status", "routed");
        collapseRoutedCard(cardUnitId);
        showToast(
          `${unitData.customName || cardUnitId} Routed!`,
          "Melee Outcome"
        );
      } else {
        console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
        updateUnitStateValue(armyId, cardUnitId, "shaken", true);
        updateShakenStatusUI(cardUnitId, true);
        showToast(
          `${unitData.customName || cardUnitId} became Shaken!`,
          "Melee Outcome"
        );
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

async function _handleMoraleWoundsClick(targetElement, armyId, cardUnitId) {
  console.log(`Manual morale check for wounds for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;
  const quality = unitData.quality;
  const isHalf = checkHalfStrength(unitData);
  if (!isHalf) {
    showToast(
      `Unit is not at half strength or less. Morale check not required for wounds.`,
      "Morale Check"
    );
    return;
  }

  const moraleResult = await showInteractivePrompt(
    `WOUNDS MORALE TEST (Quality ${quality}+): Did the unit PASS or FAIL?`,
    ["Pass", "Fail"],
    "Wounds: Morale Test"
  );
  if (moraleResult === "Fail") {
    console.log(`Unit ${cardUnitId} fails morale from wounds -> SHAKEN!`);
    updateUnitStateValue(armyId, cardUnitId, "shaken", true);
    updateShakenStatusUI(cardUnitId, true);
    showToast(
      `${unitData.customName || cardUnitId} became Shaken!`,
      "Morale Check"
    );
  } else if (moraleResult === "Pass") {
    console.log(`Unit ${cardUnitId} passed wounds morale test.`);
    showToast("Morale test passed.", "Morale Check");
  } else {
    console.log("Wounds morale prompt cancelled or invalid.");
  }
}

// --- Main Event Listener & Setup ---

function handleInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  const spellModal = event.target.closest("#viewSpellsModal");

  if (unitCard) {
    const cardUnitId = unitCard.dataset.unitId;
    const armyId = unitCard.dataset.armyId;
    if (!cardUnitId || !armyId) return;
    if (
      unitCard.classList.contains("unit-destroyed") ||
      unitCard.classList.contains("unit-routed")
    )
      return;

    const modelElement = event.target.closest(".clickable-model");
    const woundButton = event.target.closest(".wound-apply-btn");
    const resetButton = event.target.closest(".unit-reset-btn");
    const addTokenButton = event.target.closest(".token-add-btn");
    const removeTokenButton = event.target.closest(".token-remove-btn");
    const viewSpellsButton = event.target.closest(".view-spells-btn");
    const actionButton = event.target.closest(".action-btn");
    const resolveMeleeButton = event.target.closest(".resolve-melee-btn");
    const moraleWoundsButton = event.target.closest(".morale-wounds-btn");

    if (modelElement) _handleModelWoundClick(modelElement, armyId, cardUnitId);
    else if (woundButton)
      _handleAutoWoundButtonClick(woundButton, armyId, cardUnitId);
    else if (resetButton)
      _handleResetUnitClick(resetButton, armyId, cardUnitId);
    else if (addTokenButton)
      _handleAddTokenClick(addTokenButton, armyId, cardUnitId);
    else if (removeTokenButton)
      _handleRemoveTokenClick(removeTokenButton, armyId, cardUnitId);
    else if (viewSpellsButton)
      _handleViewSpellsClick(viewSpellsButton, armyId, cardUnitId);
    else if (actionButton)
      _handleActionButtonClick(actionButton, armyId, cardUnitId);
    else if (resolveMeleeButton)
      _handleResolveMeleeClick(resolveMeleeButton, armyId, cardUnitId);
    else if (moraleWoundsButton)
      _handleMoraleWoundsClick(moraleWoundsButton, armyId, cardUnitId);
  } else if (spellModal) {
    const castButton = event.target.closest(".cast-spell-btn");
    if (castButton) _handleCastSpellClick(castButton);
  }
}

/**
 * Updates the screen diagnostic display element.
 */
function updateScreenDiagnostics() {
  const widthDisplay = document.getElementById("screenWidthDisplay");
  const heightDisplay = document.getElementById("screenHeightDisplay");
  const themeDisplay = document.getElementById("screenThemeDisplay");

  if (widthDisplay) widthDisplay.textContent = `Width: ${window.innerWidth}px`;
  if (heightDisplay)
    heightDisplay.textContent = `Height: ${window.innerHeight}px`;
  if (themeDisplay) {
    const currentTheme =
      document.documentElement.getAttribute("data-bs-theme") || "auto";
    themeDisplay.textContent = `Theme: ${currentTheme}`;
  }
}

export function setupEventListeners(armyId) {
  document.body.removeEventListener("click", handleInteractionClick);
  document.body.addEventListener("click", handleInteractionClick);
  console.log("Global interaction click listener attached.");

  const startRoundButton = document.getElementById("start-round-button");
  if (startRoundButton) {
    const newButton = startRoundButton.cloneNode(true);
    startRoundButton.parentNode.replaceChild(newButton, startRoundButton);
    newButton.addEventListener("click", () => handleStartRoundClick(armyId));
    console.log("Start Round button listener attached.");
  } else {
    console.warn("Start Round button not found.");
  }

  const initialRound = getCurrentRound();
  const roundDisplayElement = document.getElementById("round-display");
  if (roundDisplayElement)
    roundDisplayElement.textContent = `Round ${initialRound}`;
  else {
    const titleH1 = document.getElementById("army-title-h1");
    if (titleH1) {
      let displaySpan = document.getElementById("round-display");
      if (!displaySpan) {
        displaySpan = document.createElement("h3");
        displaySpan.id = "round-display";
        displaySpan.className = "ms-3 align-middle";
        titleH1.parentNode.insertBefore(displaySpan, titleH1.nextSibling);
      }
      displaySpan.textContent = `Round ${initialRound}`;
    }
  }

  // --- Screen Diagnostics ---
  updateScreenDiagnostics(); // Initial display
  window.addEventListener("resize", updateScreenDiagnostics); // Update on resize
  const themeDropdown = document.getElementById("themeDropdown");
  if (themeDropdown) {
    // Use setTimeout to ensure the theme attribute has updated after the click event finishes
    document.querySelectorAll("[data-bs-theme-value]").forEach((toggle) => {
      toggle.addEventListener("click", () =>
        setTimeout(updateScreenDiagnostics, 50)
      );
    });
    // Also update if OS preference changes (for 'auto' theme)
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        // Only update if theme is auto or not set
        const storedTheme = localStorage.getItem(config.THEME_STORAGE_KEY);
        if (!storedTheme || storedTheme === "auto") {
          setTimeout(updateScreenDiagnostics, 50);
        }
      });
  }
  console.log("Screen diagnostic listeners attached.");
  // --- End Screen Diagnostics ---
}
