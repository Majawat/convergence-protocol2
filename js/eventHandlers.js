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
import { findTargetModelForWound, checkHalfStrength } from "./gameLogic.js"; // Added checkHalfStrength
import {
    updateModelDisplay,
    updateTokenDisplay,
    updateActionButtonsUI,
    resetAllActionButtonsUI,
    updateFatiguedStatusUI,
    updateShakenStatusUI,
    collapseDestroyedCard,
    collapseRoutedCard,
    resetCardUI, // Added resetCardUI
} from "./ui.js";
import { showToast, populateAndShowSpellModal } from "./uiHelpers.js"; // Assuming showToast can handle button interactions later

// --- Placeholder for a more robust interactive toast/modal system ---
/**
 * Shows a message with interactive buttons and returns a Promise resolving with the clicked button's value.
 * Replace this with your actual modal/toast implementation.
 * @param {string} message - The message to display.
 * @param {string[]} buttons - An array of button labels (e.g., ["Yes", "No"], ["Pass", "Fail"], ["Win", "Lose", "Tie"]).
 * @param {string} [title='Input Needed'] - Optional title.
 * @returns {Promise<string|null>} A promise resolving with the text of the clicked button, or null if cancelled.
 */
async function showInteractivePrompt(message, buttons = ["OK"], title = 'Input Needed') {
    console.warn("Using placeholder showInteractivePrompt. Implement a real modal/toast system.");
    // Simple prompt for now, replace with UI
    let choice = null;
    if (buttons.length === 2 && buttons.includes("Yes") && buttons.includes("No")) {
        choice = confirm(`${title}\n\n${message}`) ? "Yes" : "No";
    } else if (buttons.length === 2 && buttons.includes("Pass") && buttons.includes("Fail")) {
        choice = confirm(`${title}\n\n${message}\n\nOK for Pass, Cancel for Fail`) ? "Pass" : "Fail";
    } else if (buttons.length === 3 && buttons.includes("Win") && buttons.includes("Lose") && buttons.includes("Tie")) {
        const input = prompt(`${title}\n\n${message}\n\nEnter W, L, or T:`).toUpperCase();
        if (["W", "L", "T"].includes(input)) {
            choice = input === 'W' ? 'Win' : input === 'L' ? 'Lose' : 'Tie';
        }
    } else {
        alert(`${title}\n\n${message}`); // Fallback for simple messages
        choice = buttons[0] || null; // Resolve with the first button text or null
    }

    return Promise.resolve(choice); // Immediately resolve for this placeholder
}


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
    }
}

/**
 * Finds the actual caster unit (base or joined hero) associated with a unit card.
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
    const baseUnitData = getUnitData(cardUnitId);
    if (!baseUnitData) {
        console.error(`Base unit data not found for applyWound: unit ${cardUnitId}`);
        return;
    }
    const heroData = getJoinedHeroData(cardUnitId);

    let targetModel = null;
    let modelUnitId = null;

    if (specificModelId) {
        targetModel = baseUnitData.models.find((m) => m.modelId === specificModelId);
        if (targetModel) {
            modelUnitId = cardUnitId;
        } else if (heroData) {
            targetModel = heroData.models.find((m) => m.modelId === specificModelId);
            if (targetModel) {
                modelUnitId = heroData.selectionId;
            }
        }

        if (targetModel && targetModel.currentHp <= 0) {
            showToast(`Model ${targetModel.modelId.split("_").pop()} is already removed.`);
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
        const newHp = Math.max(0, targetModel.currentHp - 1);
        targetModel.currentHp = newHp; // Update in-memory model

        updateModelStateValue(armyId, modelUnitId, targetModel.modelId, "currentHp", newHp);
        updateModelDisplay(cardUnitId, targetModel.modelId, newHp, targetModel.maxHp);

        // Check for Unit Destruction
        const baseUnitDataForDestroyCheck = getUnitData(cardUnitId);
        const heroDataForDestroyCheck = getJoinedHeroData(cardUnitId);
        const allModels = [...(baseUnitDataForDestroyCheck?.models || []), ...(heroDataForDestroyCheck?.models || [])];
        const currentStatus = getUnitStateValue(armyId, cardUnitId, 'status', 'active');
        const isUnitDestroyed = currentStatus === 'active' && allModels.length > 0 && allModels.every(m => m.currentHp <= 0);

        if (isUnitDestroyed) {
            console.log(`Unit ${cardUnitId} (and potentially joined hero) is Destroyed.`);
            updateUnitStateValue(armyId, cardUnitId, 'status', 'destroyed');
            if (heroDataForDestroyCheck) {
                updateUnitStateValue(armyId, heroDataForDestroyCheck.selectionId, 'status', 'destroyed');
            }
            collapseDestroyedCard(cardUnitId);
            showToast(`${baseUnitDataForDestroyCheck?.customName || cardUnitId} Destroyed!`, "Unit Destroyed");
        } else {
            const nextAutoTarget = findTargetModelForWound(baseUnitDataForDestroyCheck, heroDataForDestroyCheck);
            _highlightNextAutoTargetModel(cardUnitId, nextAutoTarget ? nextAutoTarget.modelId : null);
        }

    } else {
        const currentStatus = getUnitStateValue(armyId, cardUnitId, 'status', 'active');
        if (currentStatus === 'active') {
            showToast("All models in unit removed.");
        }
        _clearTargetHighlight(cardUnitId);
    }
}

/**
 * Handles the 'Start New Round' button click.
 * Increments round, resets statuses, generates tokens.
 * @param {string} armyId - The ID of the current army.
 */
function handleStartRoundClick(armyId) {
    console.log(`--- Starting New Round for Army ${armyId} ---`);
    const newRound = incrementCurrentRound();
    console.log(`Round incremented to ${newRound}`);

    const roundDisplayElement = document.getElementById("round-display");
    if (roundDisplayElement) {
        roundDisplayElement.textContent = `Round ${newRound}`;
    } else {
        const titleH1 = document.getElementById("army-title-h1");
        if (titleH1) {
            let displaySpan = document.getElementById("round-display");
            if (!displaySpan) {
                displaySpan = document.createElement("span");
                displaySpan.id = "round-display";
                displaySpan.className = "ms-3 badge bg-info align-middle";
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
             armyState.units[unitId] = { status: "active", shaken: false, fatigued: false, attackedInMeleeThisRound: false, action: null, limitedWeaponUsed: false, tokens: 0, models: {} };
             stateChanged = true;
        }
        const unitState = armyState.units[unitId];
        if (unitState.status === 'destroyed' || unitState.status === 'routed') return;

        const cardId = heroTargets?.[unitId] || unitId; // Find the card ID for UI updates

        if (unitState.action !== null) { unitState.action = null; stateChanged = true; }
        if (unitState.fatigued !== false) { unitState.fatigued = false; updateFatiguedStatusUI(cardId, false); stateChanged = true; }
        if (unitState.attackedInMeleeThisRound !== false) { unitState.attackedInMeleeThisRound = false; stateChanged = true; }

        if (unit.casterLevel > 0) {
            const currentTokens = unitState.tokens || 0;
            const tokensToAdd = unit.casterLevel;
            const newTokens = Math.min(config.MAX_SPELL_TOKENS, currentTokens + tokensToAdd);
            const actualTokensAdded = newTokens - currentTokens;
            if (actualTokensAdded > 0) {
                unitState.tokens = newTokens;
                casterUpdates.push({ name: unit.customName || unit.originalName, added: actualTokensAdded, total: newTokens, unitId: unitId, casterLevel: unit.casterLevel });
                stateChanged = true;
            }
        }
    });

    if (stateChanged) {
        saveArmyState(armyId, armyState);
        console.log(`State updated and saved for start of round ${newRound} for army ${armyId}.`);
    }

    resetAllActionButtonsUI();

    let toastMessage = `Round ${newRound} Started!\nAll Unit Actions & Fatigue reset.`;
    if (casterUpdates.length > 0) {
        toastMessage += "\nSpell Tokens Generated:";
        casterUpdates.forEach((update) => {
            const cardUnitId = heroTargets?.[update.unitId] || update.unitId;
            updateTokenDisplay(cardUnitId, update.total, update.casterLevel);
            toastMessage += `\n- ${update.name}: +${update.added.toString().padStart(1, "\u00A0")}, now ${update.total}`;
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

/**
 * Handles clicks on the reset unit button. Resets HP, action, status flags.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card.
 * @private
 */
async function _handleResetUnitClick(targetElement, armyId, cardUnitId) {
    const baseUnitData = getUnitData(cardUnitId);
    if (!baseUnitData) return;
    const heroData = getJoinedHeroData(cardUnitId);
    const heroId = heroData ? heroData.selectionId : null;

    const confirmReset = await showInteractivePrompt( // Use async/await with the placeholder
        `Fully reset ${baseUnitData.customName || baseUnitData.originalName} (HP, Status, Action)?`,
        ["Reset", "Cancel"],
        "Confirm Reset"
    );

    if (confirmReset !== "Reset") return;

    console.log(`Resetting unit state for card unit ${cardUnitId}` + (heroId ? ` (and joined hero ${heroId})` : ""));

    let stateChanged = false;
    let armyState = loadArmyState(armyId);
    if (!armyState || !armyState.units) {
        console.error(`Cannot reset unit: State not found for army ${armyId}`);
        return;
    }

    const resetUnitState = (unitId, unitData) => {
        if (!armyState.units[unitId]) return; // Skip if unit not in state

        const unitState = armyState.units[unitId];
        let unitModified = false;

        // Reset status flags
        if (unitState.shaken !== false) { unitState.shaken = false; unitModified = true; }
        if (unitState.fatigued !== false) { unitState.fatigued = false; unitModified = true; }
        if (unitState.attackedInMeleeThisRound !== false) { unitState.attackedInMeleeThisRound = false; unitModified = true; }
        if (unitState.action !== null) { unitState.action = null; unitModified = true; }
        if (unitState.status !== 'active') { unitState.status = 'active'; unitModified = true; }
        // Optionally reset tokens? Decide based on game rules/preference.
        // if (unitState.tokens !== 0) { unitState.tokens = 0; unitModified = true; }

        // Reset models HP
        unitData.models.forEach(model => {
            if (unitState.models?.[model.modelId]?.currentHp !== model.maxHp) {
                if (!unitState.models) unitState.models = {};
                if (!unitState.models[model.modelId]) unitState.models[model.modelId] = {};
                unitState.models[model.modelId].currentHp = model.maxHp;
                // Update in-memory model too
                 const targetModel = (getUnitData(unitId)?.models || []).find(m => m.modelId === model.modelId);
                 if (targetModel) targetModel.currentHp = model.maxHp;
                // Update UI
                updateModelDisplay(cardUnitId, model.modelId, model.maxHp, model.maxHp); // Use cardUnitId for UI element
                unitModified = true;
            }
        });
        return unitModified;
    };

    if (resetUnitState(cardUnitId, baseUnitData)) stateChanged = true;
    if (heroData && heroId && resetUnitState(heroId, heroData)) stateChanged = true;

    if (stateChanged) {
        saveArmyState(armyId, armyState);
        showToast(`Unit state reset for ${baseUnitData.customName || baseUnitData.originalName}.`, "Unit Reset");
    }

    // Reset the card's visual state completely
    resetCardUI(cardUnitId);

    // Re-highlight target model
    const nextAutoTarget = findTargetModelForWound(baseUnitData, heroData);
    _highlightNextAutoTargetModel(cardUnitId, nextAutoTarget ? nextAutoTarget.modelId : null);
}


function _handleAddTokenClick(targetElement, armyId, cardUnitId) {
    const actualCasterUnit = _findActualCaster(cardUnitId);
    if (!actualCasterUnit) { showToast("This unit is not a caster."); return; }
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
    if (!actualCasterUnit) { showToast("This unit is not a caster."); return; }
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
    if (!actualCasterUnit) { showToast("This unit is not a caster."); return; }
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
    if (isNaN(spellCost) || !casterId || !armyId) { console.error("Cast button missing required data attributes."); showToast("Error casting spell: Missing data.", "Error"); return; }
    const currentTokens = getUnitStateValue(armyId, casterId, "tokens", 0);
    if (currentTokens >= spellCost) {
        const newTokens = currentTokens - spellCost;
        updateUnitStateValue(armyId, casterId, "tokens", newTokens);
        const heroTargets = getCurrentArmyHeroTargets();
        const cardUnitId = heroTargets?.[casterId] || casterId;
        const casterUnitData = getUnitData(casterId);
        if (casterUnitData) updateTokenDisplay(cardUnitId, newTokens, casterUnitData.casterLevel);
        const modalTokenDisplay = document.getElementById("modalCasterTokenDisplay");
        if (modalTokenDisplay) modalTokenDisplay.innerHTML = `${UI_ICONS.spellTokens} Tokens: <span class="fw-bold">${newTokens} / ${config.MAX_SPELL_TOKENS}</span>`;
        const modalElement = document.getElementById("viewSpellsModal");
        if (modalElement) {
            modalElement.querySelectorAll(".cast-spell-btn").forEach((btn) => {
                const cost = parseInt(btn.dataset.spellCost, 10);
                if (!isNaN(cost)) btn.disabled = newTokens < cost;
            });
        }
        showToast(`Casting ${spellName}! Player rolls 4+ to succeed.\nCasters within 18" may spend a Spell Token to modify the roll.`, "Spell Cast");
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
async function _handleActionButtonClick(targetElement, armyId, cardUnitId) { // Made async for potential prompts
    const actionType = targetElement.dataset.action;
    if (!actionType) return;

    const isShaken = getUnitStateValue(armyId, cardUnitId, 'shaken', false);
    const currentAction = getUnitStateValue(armyId, cardUnitId, 'action', null);
    const unitData = getUnitData(cardUnitId);

    if (isShaken) {
        if (actionType === 'Recover') {
            console.log(`Unit ${cardUnitId} recovering from Shaken.`);
            updateUnitStateValue(armyId, cardUnitId, 'shaken', false);
            updateUnitStateValue(armyId, cardUnitId, 'action', null); // Deactivate after recovery
            updateShakenStatusUI(cardUnitId, false); // Update indicator & buttons
            showToast(`${unitData?.customName || cardUnitId} recovered from Shaken.`, "Recovery");
        } else {
            showToast("Shaken unit must Recover.", "Action Blocked");
        }
        return;
    }

    let newAction = null;
    if (currentAction === actionType) {
        newAction = null; // Deactivate
        console.log(`Unit ${cardUnitId} deactivated.`);
    } else {
        newAction = actionType; // Activate
        console.log(`Unit ${cardUnitId} activated with action: ${newAction}`);

        if (newAction === 'Charge') {
            // Apply fatigue if first melee attack this round - NO prompt for wounds caused
            const isFirstMelee = !getUnitStateValue(armyId, cardUnitId, 'attackedInMeleeThisRound', false);
            if (isFirstMelee) {
                updateUnitStateValue(armyId, cardUnitId, 'fatigued', true);
                updateUnitStateValue(armyId, cardUnitId, 'attackedInMeleeThisRound', true);
                updateFatiguedStatusUI(cardUnitId, true);
                console.log(`Unit ${cardUnitId} is now Fatigued from charging.`);
            }
            // Player now needs to click "Resolve Melee Outcome" on the *defender* after combat.
        }
    }

    updateUnitStateValue(armyId, cardUnitId, 'action', newAction);
    updateActionButtonsUI(cardUnitId, newAction, false); // Pass isShaken = false
}

// --- NEW: Specific Handlers for Manual Triggers ---

/**
 * Handles clicks on the "Resolve Melee Outcome" button.
 * Prompts user if defender struck back (for fatigue), then win/loss/tie, then morale result if lost. Applies Shaken/Routed.
 * @param {HTMLElement} targetElement - The clicked button element.
 * @param {string} armyId - The current army ID.
 * @param {string} cardUnitId - The selectionId of the card (this is the unit involved in the melee).
 * @private
 */
async function _handleResolveMeleeClick(targetElement, armyId, cardUnitId) {
    console.log(`Resolving melee outcome for ${cardUnitId}`);
    const unitData = getUnitData(cardUnitId);
    if (!unitData) return;

    // 1. Ask if this unit Struck Back (for fatigue)
    const didStrikeBack = await showInteractivePrompt(
        `Did ${unitData.customName || cardUnitId} Strike Back in this melee?`,
        ["Yes", "No"],
        "Melee: Strike Back?"
    );

    if (didStrikeBack === "Yes") {
        const isFirstMelee = !getUnitStateValue(armyId, cardUnitId, 'attackedInMeleeThisRound', false);
        if (isFirstMelee) {
            updateUnitStateValue(armyId, cardUnitId, 'fatigued', true);
            updateUnitStateValue(armyId, cardUnitId, 'attackedInMeleeThisRound', true);
            updateFatiguedStatusUI(cardUnitId, true);
            console.log(`Unit ${cardUnitId} is now Fatigued from striking back.`);
        }
    }

    // 2. Ask for Melee Outcome
    const outcome = await showInteractivePrompt(
        `Did ${unitData.customName || unitData.originalName} WIN, LOSE, or TIE the melee?`,
        ["Win", "Lose", "Tie"],
        "Melee: Outcome?"
    );

    if (outcome === 'Lose') {
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
            const isHalf = checkHalfStrength(unitData); // Use gameLogic helper

            if (isHalf) {
                console.log(`Unit ${cardUnitId} fails morale at half strength -> ROUTED!`);
                updateUnitStateValue(armyId, cardUnitId, 'status', 'routed');
                collapseRoutedCard(cardUnitId); // Collapse the card UI
                showToast(`${unitData.customName || cardUnitId} Routed!`, "Melee Outcome");
            } else {
                console.log(`Unit ${cardUnitId} fails morale -> SHAKEN!`);
                updateUnitStateValue(armyId, cardUnitId, 'shaken', true);
                updateShakenStatusUI(cardUnitId, true); // Update UI
                showToast(`${unitData.customName || cardUnitId} became Shaken!`, "Melee Outcome");
            }
        } else if (moraleResult === "Pass") {
            console.log(`Unit ${cardUnitId} passed melee morale test.`);
            showToast("Melee Lost, Morale Passed.", "Melee Outcome");
        } else {
            console.log("Melee morale prompt cancelled or invalid.");
        }
    } else if (outcome === 'Win' || outcome === 'Tie') {
        console.log(`Unit ${cardUnitId} ${outcome === 'Win' ? 'won' : 'tied'} melee. No morale test from outcome.`);
        showToast(`Melee outcome: ${outcome}`, "Melee Resolved");
    } else {
        console.log("Melee outcome prompt cancelled or invalid.");
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
async function _handleMoraleWoundsClick(targetElement, armyId, cardUnitId) {
    console.log(`Manual morale check for wounds for ${cardUnitId}`);
    const unitData = getUnitData(cardUnitId);
    if (!unitData) return;

    const quality = unitData.quality;
    const isHalf = checkHalfStrength(unitData); // Use gameLogic helper

    if (!isHalf) {
        showToast(`Unit is not at half strength or less. Morale check not required for wounds.`, "Morale Check");
        return;
    }

    // Prompt for morale result
    const moraleResult = await showInteractivePrompt(
        `WOUNDS MORALE TEST (Quality ${quality}+): Did the unit PASS or FAIL?`,
        ["Pass", "Fail"],
        "Wounds: Morale Test"
    );

    if (moraleResult === "Fail") {
        console.log(`Unit ${cardUnitId} fails morale from wounds -> SHAKEN!`);
        updateUnitStateValue(armyId, cardUnitId, 'shaken', true);
        updateShakenStatusUI(cardUnitId, true); // Update UI
        showToast(`${unitData.customName || cardUnitId} became Shaken!`, "Morale Check");
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

        if (unitCard.classList.contains('unit-destroyed') || unitCard.classList.contains('unit-routed')) {
            return; // Ignore clicks on collapsed cards
        }

        const modelElement = event.target.closest(".clickable-model");
        const woundButton = event.target.closest(".wound-apply-btn");
        const resetButton = event.target.closest(".unit-reset-btn"); // Changed class selector
        const addTokenButton = event.target.closest(".token-add-btn");
        const removeTokenButton = event.target.closest(".token-remove-btn");
        const viewSpellsButton = event.target.closest(".view-spells-btn");
        const actionButton = event.target.closest(".action-btn");
        // Removed defendMeleeButton selector
        const resolveMeleeButton = event.target.closest(".resolve-melee-btn");
        const moraleWoundsButton = event.target.closest(".morale-wounds-btn");


        if (modelElement) _handleModelWoundClick(modelElement, armyId, cardUnitId);
        else if (woundButton) _handleAutoWoundButtonClick(woundButton, armyId, cardUnitId);
        else if (resetButton) _handleResetUnitClick(resetButton, armyId, cardUnitId); // Changed handler
        else if (addTokenButton) _handleAddTokenClick(addTokenButton, armyId, cardUnitId);
        else if (removeTokenButton) _handleRemoveTokenClick(removeTokenButton, armyId, cardUnitId);
        else if (viewSpellsButton) _handleViewSpellsClick(viewSpellsButton, armyId, cardUnitId);
        else if (actionButton) _handleActionButtonClick(actionButton, armyId, cardUnitId);
        // Removed defendMeleeButton handler call
        else if (resolveMeleeButton) _handleResolveMeleeClick(resolveMeleeButton, armyId, cardUnitId);
        else if (moraleWoundsButton) _handleMoraleWoundsClick(moraleWoundsButton, armyId, cardUnitId);

    } else if (spellModal) {
        const castButton = event.target.closest(".cast-spell-btn");
        if (castButton) {
            _handleCastSpellClick(castButton);
        }
    }
}

export function setupEventListeners(armyId) {
    document.body.removeEventListener("click", handleInteractionClick);
    document.body.addEventListener("click", handleInteractionClick);
    console.log("Global interaction click listener attached to document body.");

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
    if (roundDisplayElement) {
        roundDisplayElement.textContent = `Round ${initialRound}`;
    } else {
        const titleH1 = document.getElementById("army-title-h1");
        if (titleH1) {
            let displaySpan = document.getElementById("round-display");
            if (!displaySpan) {
                displaySpan = document.createElement("span");
                displaySpan.id = "round-display";
                displaySpan.className = "ms-3 badge bg-info align-middle";
                titleH1.parentNode.insertBefore(displaySpan, titleH1.nextSibling);
            }
            displaySpan.textContent = `Round ${initialRound}`;
        }
    }
}
