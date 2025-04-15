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
  getCommandPoints,
  getMaxCommandPoints,
  getSelectedDoctrine,
  getDoctrinesData,
  getUnderdogPoints,
  getMaxUnderdogPoints,
  // State Updaters
  updateModelStateValue,
  updateUnitStateValue,
  incrementCurrentRound,
  setCommandPoints,
  setSelectedDoctrine,
  setUnderdogPoints,
} from "./state.js";
import { loadArmyState, saveArmyState, resetArmyState } from "./storage.js";
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
import {
  showToast,
  showInteractiveToast,
  populateAndShowSpellModal,
  updateRoundUI,
  updateCommandPointsDisplay,
  populateDoctrineSelector,
  displayStratagems,
  handleFocusReturn, // Keep importing this
  updateUnderdogPointsDisplay,
  setElementToFocusAfterClose, // Import the setter
} from "./uiHelpers.js";

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

  const confirmReset = await showInteractiveToast(
    `Reset ${
      baseUnitData.customName || baseUnitData.originalName
    } (HP, Status, Action)?`,
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
      const outcome = await showInteractiveToast(
        `Did ${
          unitData.customName || cardUnitId
        } (the Charger) WIN, LOSE, or TIE the melee?`,
        "Melee: Charger Outcome?",
        [
          { text: "Win", value: "Win", style: "success" },
          { text: "Lose", value: "Lose", style: "danger" },
          { text: "Tie", value: "Tie", style: "warning" },
        ]
      );

      if (outcome === "Lose") {
        console.log(`Charging unit ${cardUnitId} lost melee. Checking morale.`);
        const quality = unitData.quality;
        // 2. Ask for Morale Result
        const moraleResult = await showInteractiveToast(
          `MELEE MORALE TEST (Quality ${quality}+): Did ${
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

async function _handleResolveMeleeClick(targetElement, armyId, cardUnitId) {
  console.log(`Resolving melee outcome for ${cardUnitId}`);
  const unitData = getUnitData(cardUnitId);
  if (!unitData) return;

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
  const outcome = await showInteractiveToast(
    `Did ${
      unitData.customName || unitData.originalName
    } WIN, LOSE, or TIE the melee?`,
    "Melee: Outcome?",
    [
      { text: "Win", value: "Win", style: "success" },
      { text: "Lose", value: "Lose", style: "danger" },
      { text: "Tie", value: "Tie", style: "warning" },
    ]
  );

  if (outcome === "Lose") {
    console.log(`Unit ${cardUnitId} lost melee. Checking morale.`);
    const quality = unitData.quality;
    // 3. Ask for Morale Result
    const moraleResult = await showInteractiveToast(
      `MELEE MORALE TEST (Quality ${quality}+): Did the unit PASS or FAIL?`,
      "Melee: Morale Test",
      [
        { text: "Pass", value: "Pass", style: "success" },
        { text: "Fail", value: "Fail", style: "danger" },
      ]
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

  const moraleResult = await showInteractiveToast(
    `WOUNDS MORALE TEST (Quality ${quality}+): Did the unit PASS or FAIL?`,
    "Wounds: Morale Test",
    [
      { text: "Pass", value: "Pass", style: "success" },
      { text: "Fail", value: "Fail", style: "danger" },
    ]
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
    `WARNING!\n\nThis will permanently delete all saved progress (HP, status, CP, UP, doctrine selection) for "${armyName}" and reload its data from scratch.\n\nAre you absolutely sure you want to proceed?`,
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
    showToast(
      `Resetting data for ${armyName}... Page will reload.`,
      "Resetting",
      3000
    );
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
    `EXTREME WARNING!\n\nThis will permanently delete ALL saved progress for ALL armies, campaign data, cached rules, theme settings, etc. Everything will be wiped from browser storage.\n\nThis action cannot be undone.\n\nAre you absolutely, positively sure?`,
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
    showToast(
      `Resetting ALL application data... Page will reload.`,
      "Full Reset",
      3000
    );
    // Use setTimeout to allow toast to show before reload potentially interrupts it
    setTimeout(() => {
      // Reload to the base page without any army selected
      window.location.href = "army.html";
    }, 500); // Short delay
  } else {
    console.log("Full data reset cancelled by user.");
  }
}

// --- *** ADDED: Stratagem and CP/UP Handlers *** ---

/**
 * Handles clicking the activate button for a stratagem.
 * @param {HTMLButtonElement} buttonElement - The button that was clicked.
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
    showToast(
      `Not enough Command Points for ${stratName}.`,
      "Activation Failed"
    );
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

// --- Main Event Listener & Setup ---

function handleInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  const spellModal = event.target.closest("#viewSpellsModal");
  const stratagemModal = event.target.closest("#stratagemModal");
  const upDisplay = event.target.closest("#underdog-points-display"); // Target the display div
  const resetArmyButton = event.target.closest("#reset-army-data-button");
  const resetAllButton = event.target.closest("#reset-all-data-button");

  if (resetAllButton) {
    _handleResetAllDataClick();
  } else if (resetArmyButton) {
    _handleResetArmyDataClick();
  } else if (unitCard) {
    const cardUnitId = unitCard.dataset.unitId;
    const armyId = unitCard.dataset.armyId;
    if (!cardUnitId || !armyId) return;
    // Check if unit is inactive before processing clicks on its elements
    const unitStatus = getUnitStateValue(
      armyId,
      cardUnitId,
      "status",
      "active"
    );
    if (unitStatus === "destroyed" || unitStatus === "routed") {
      // Only allow the reset button on inactive cards
      const resetButton = event.target.closest(".unit-reset-btn");
      if (resetButton) {
        _handleResetUnitClick(resetButton, armyId, cardUnitId);
      }
      return; // Prevent other interactions on inactive cards
    }

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
  } else if (stratagemModal) {
    const activateButton = event.target.closest(".activate-stratagem-btn");
    const removeCpButton = event.target.closest("#manual-cp-remove");
    const addCpButton = event.target.closest("#manual-cp-add");

    if (activateButton) {
      console.log(
        "Activate Stratagem Clicked:",
        activateButton.dataset.stratagemName
      );
      _handleActivateStratagemClick(activateButton);
    } else if (removeCpButton) {
      console.log("Manual CP Remove Clicked");
      _handleManualCpAdjustClick(-1);
    } else if (addCpButton) {
      console.log("Manual CP Add Clicked");
      _handleManualCpAdjustClick(1);
    }
  } else if (upDisplay) {
    // Check clicks within the UP display area
    const removeUpButton = event.target.closest("#manual-up-remove");
    const addUpButton = event.target.closest("#manual-up-add");

    if (removeUpButton) {
      _handleUnderdogPointAdjustClick(-1); // Call handler with -1
    } else if (addUpButton) {
      _handleUnderdogPointAdjustClick(1); // Call handler with +1
    }
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

  // --- Stratagem Modal Listener ---
  const stratagemModalElement = document.getElementById("stratagemModal");
  if (stratagemModalElement) {
    stratagemModalElement.addEventListener("show.bs.modal", (event) => {
      // *** UPDATED: Use the imported setter ***
      setElementToFocusAfterClose(
        event.relatedTarget || document.activeElement
      );

      // Populate selector when modal opens
      populateDoctrineSelector(armyId);
      // Update CP display in modal header
      updateCommandPointsDisplay(
        armyId,
        getCommandPoints(armyId),
        getMaxCommandPoints(armyId)
      );
      // Display stratagems on modal open
      const currentDoctrine = getSelectedDoctrine(armyId);
      displayStratagems(armyId, currentDoctrine);
      console.log(
        `Stratagem modal opened, populating selector and displaying stratagems for doctrine: ${
          currentDoctrine || "None"
        }.`
      );
    });
    // Add listener to return focus when modal is hidden
    stratagemModalElement.removeEventListener(
      "hidden.bs.modal",
      handleFocusReturn // Use the imported handler
    );
    stratagemModalElement.addEventListener(
      "hidden.bs.modal",
      handleFocusReturn, // Use the imported handler
      { once: true }
    );

    // Add listener for doctrine selection change
    const doctrineSelector = document.getElementById("doctrineSelector");
    if (doctrineSelector) {
      doctrineSelector.addEventListener("change", (event) => {
        const selectedDoctrineId = event.target.value;
        setSelectedDoctrine(armyId, selectedDoctrineId || null); // Save selection (null if default selected)
        console.log(`Doctrine selected: ${selectedDoctrineId}`);
        // Trigger display of stratagems on change
        displayStratagems(armyId, selectedDoctrineId || null);
      });
      console.log("Doctrine selector change listener attached.");
    } else {
      console.warn("Doctrine selector element not found.");
    }
  } else {
    console.warn("Stratagem modal element not found.");
  }

  // --- *** ADDED: Army Info Modal Listeners *** ---
  const armyInfoModalElement = document.getElementById("armyInfoModal");
  if (armyInfoModalElement) {
    armyInfoModalElement.addEventListener("show.bs.modal", (event) => {
      // Store the trigger element for focus return
      setElementToFocusAfterClose(
        event.relatedTarget || document.activeElement
      );
      console.log("Army Info modal opened.");
    });
    // Add listener to return focus when modal is hidden
    armyInfoModalElement.removeEventListener(
      "hidden.bs.modal",
      handleFocusReturn // Use the imported handler
    );
    armyInfoModalElement.addEventListener(
      "hidden.bs.modal",
      handleFocusReturn, // Use the imported handler
      { once: true }
    );
    console.log("Army Info modal listeners attached.");
  } else {
    console.warn("Army Info modal element not found.");
  }
  // --- *** END ADDED *** ---

  const initialRound = getCurrentRound();
  const roundDisplayElement = document.getElementById("round-display");
  // Ensure round display element exists before setting text content
  if (roundDisplayElement) {
    roundDisplayElement.textContent =
      initialRound >= 1 ? `Round ${initialRound}` : "";
  } else {
    // Attempt to create it if missing (logic moved to updateRoundUI)
    updateRoundUI(initialRound);
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
