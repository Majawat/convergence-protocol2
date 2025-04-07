/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 */

import { config, UI_ICONS, ACTION_BUTTON_CONFIG } from "./config.js"; // Configuration constants
import { calculateMovement } from "./gameLogic.js"; // Import the new function
import { getUnitStateValue, getCurrentArmyId, getUnitData } from "./state.js"; // Import state functions

// --- Helper Functions ---

function _formatRule(rule, filterCaster) {
    const baseName = rule.name || rule.label;
    if (!baseName || rule.name === "Tough" || (filterCaster && rule.name === "Caster")) return null;
    if (rule.rating !== null && rule.rating !== undefined && String(rule.rating).trim().length > 0) return `${baseName}(${rule.rating})`;
    return baseName;
}

function _createWeaponTableHTML(loadout, formatRuleFn) {
    if (!loadout || loadout.length === 0) return '<p class="text-muted small mb-0">No weapons listed.</p>';
    const aggregatedWeapons = {};
    loadout.forEach((weapon) => {
        const apRule = (weapon.specialRules || []).find((r) => r.name === "AP");
        const apValue = apRule ? parseInt(apRule.rating, 10) : 0;
        const otherRules = (weapon.specialRules || []).filter((r) => r.name !== "AP").map((rule) => formatRuleFn(rule, false)).filter(Boolean).sort().join(", ");
        const weaponKey = `${weapon.name}|${weapon.range || "-"}|${weapon.attacks || "-"}|${apValue}|${otherRules}`;
        if (aggregatedWeapons[weaponKey]) aggregatedWeapons[weaponKey].count += weapon.count || 1;
        else aggregatedWeapons[weaponKey] = { data: weapon, count: weapon.count || 1, apValue: !isNaN(apValue) && apValue > 0 ? `${apValue}` : "-", otherRulesString: otherRules || "-" };
    });
    let tableHtml = '<table class="table table-sm table-borderless table-striped mb-0">';
    tableHtml += `<thead><tr><th>Weapon</th><th class="text-center">RNG</th><th class="text-center">ATK</th><th class="text-center">AP</th><th>Special</th></tr></thead><tbody>`;
    Object.values(aggregatedWeapons).forEach((aggWeapon) => {
        const weapon = aggWeapon.data;
        const weaponName = `${aggWeapon.count > 1 ? aggWeapon.count + "x " : ""}${weapon.name}`;
        tableHtml += `<tr class="align-middle"><td>${weaponName}</td><td class="text-center">${weapon.range ? `${weapon.range}"` : "-"}</td><td class="text-center">${weapon.attacks ? `A${weapon.attacks}` : "-"}</td><td class="text-center">${aggWeapon.apValue}</td><td>${aggWeapon.otherRulesString}</td></tr>`;
    });
    tableHtml += "</tbody></table>";
    return tableHtml;
}

function _createCasterControlsHTML(casterLevel, initialTokens) {
    if (casterLevel <= 0) return "";
    const currentTokens = Math.min(initialTokens, config.MAX_SPELL_TOKENS);
    const addDisabled = currentTokens >= config.MAX_SPELL_TOKENS ? "disabled" : "";
    const removeDisabled = currentTokens <= 0 ? "disabled" : "";
    return `<div class="caster-section"><div class="caster-controls"><span class="caster-level-badge me-2">Caster(${casterLevel})</span><div class="token-controls"><button type="button" class="btn btn-sm btn-outline-info token-remove-btn" title="Spend Token" ${removeDisabled}>${UI_ICONS.tokenRemove}</button><span class="token-count-display" title="Spell Tokens">${UI_ICONS.spellTokens}<span class="token-count">${currentTokens} / ${config.MAX_SPELL_TOKENS}</span></span><button type="button" class="btn btn-sm btn-outline-info token-add-btn" title="Add Token" ${addDisabled}>${UI_ICONS.tokenAdd}</button></div><button type="button" class="btn btn-sm btn-outline-info view-spells-btn" title="View Spells">${UI_ICONS.viewSpells} View Spells</button></div></div>`;
}

function _createUnitCardHeaderHTML(baseUnit, hero) {
    const title = hero ? `${hero.customName || hero.originalName} w/ ${baseUnit.customName || baseUnit.originalName}` : baseUnit.customName || baseUnit.originalName;
    const subtitle = hero ? `${hero.originalName} and ${baseUnit.originalName}` : baseUnit.originalName;
    const totalModels = baseUnit.size + (hero ? hero.size : 0);
    const totalPoints = baseUnit.cost + (hero ? hero.cost : 0);
    let metaHtml = `<span class="info-item">${totalModels} Models</span><span class="info-separator">|</span><span class="info-item">${totalPoints} pts</span>`;
    if (!hero) {
        const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
        metaHtml += `<span class="info-separator">|</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${baseUnit.xp || 0}</span></span>`;
        metaHtml += `<span class="info-separator">|</span><span class="info-item base-info">${UI_ICONS.base} ${unitBase ? unitBase + "mm" : "N/A"}</span>`;
    }
    const statusIndicatorHTML = `<span class="header-status-indicators ms-2 small" data-unit-id="${baseUnit.selectionId}"><span class="fatigue-indicator text-warning" style="display: none;" title="Fatigued"><i class="bi bi-clock-history fs-6"></i></span><span class="shaken-indicator text-warning" style="display: none;" title="Shaken"><i class="bi bi-exclamation-triangle-fill fs-6"></i></span></span>`;
    return `<div class="card-header bg-body-tertiary"><div class="d-flex justify-content-between align-items-start flex-wrap gap-1"><div class="unit-card-header-content"><h5 class="mb-0 card-title d-flex align-items-center">${title}${statusIndicatorHTML}</h5><small class="text-muted d-block">${subtitle}</small><div class="header-meta-info text-muted mt-1">${metaHtml}</div></div></div><div class="btn-group btn-group-sm header-button-group"><button type="button" class="btn btn-outline-danger wound-apply-btn" title="Apply Wound (Auto-Target)">${UI_ICONS.woundApply}</button><button type="button" class="btn btn-outline-secondary unit-reset-btn" title="Reset Unit State (HP, Status, Action)">${UI_ICONS.woundReset}</button></div></div>`;
}

function _createEffectiveStatsHTML(baseUnit, hero) {
    const effectiveQuality = hero ? hero.quality : baseUnit.quality;
    const effectiveDefense = baseUnit.defense;
    return `<div class="effective-stats"><div class="stat-item" title="Effective Quality (Used for Morale)">${UI_ICONS.quality}<span>${effectiveQuality}+</span></div><div class="stat-item" title="Effective Defense">${UI_ICONS.defense}<span>${effectiveDefense}+</span></div></div>`;
}

function _createActionControlsHTML(baseUnit, hero) {
    const movementUnit = hero || baseUnit;
    const actionNames = ["Hold", "Advance", "Rush", "Charge"];
    let buttonsHTML = "";
    actionNames.forEach((actionName) => {
        const config = ACTION_BUTTON_CONFIG[actionName];
        if (!config) return;
        const icon = UI_ICONS[config.iconKey] || "";
        let text = config.baseText;
        if (actionName === "Advance" || actionName === "Rush" || actionName === "Charge") {
            const moveValue = calculateMovement(movementUnit, actionName);
            text += ` (${moveValue}")`;
        }
        buttonsHTML += `<button type="button" class="btn btn-outline-${config.colorTheme} action-btn" data-action="${actionName}" title="${actionName}">${icon}<span class="action-text">${text}</span></button>`;
    });
    buttonsHTML += `<button type="button" class="btn btn-warning action-btn recover-btn" data-action="Recover" title="Recover from Shaken" style="display: none;"><i class="bi bi-bandaid"></i><span class="action-text">Recover</span></button>`;
    return `<div class="action-controls"><div class="btn-group w-100" role="group" aria-label="Unit Actions">${buttonsHTML}</div></div>`;
}

function createModelsDisplay(unit, hero = null) {
    const displayModels = hero ? [...hero.models, ...unit.models] : unit.models;
    if (!displayModels || displayModels.length === 0) return '<p class="text-muted small">No model data.</p>';
    let modelsHtml = '<div class="unit-models-grid">';
    let toughCounter = 1, modelCounter = 1;
    displayModels.forEach((model) => {
        const isRemoved = model.currentHp <= 0;
        const hpPercentage = (model.currentHp / model.maxHp) * 100;
        let bgColorClass = "bg-success";
        if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
        else if (hpPercentage < 50) bgColorClass = "bg-danger";
        if (isRemoved) bgColorClass = "bg-secondary";
        const isHeroModel = model.isHero;
        const modelIcon = isHeroModel ? UI_ICONS.hero : model.isTough ? UI_ICONS.tough : UI_ICONS.hero;
        const heroColorClass = isHeroModel ? "hero-icon-color" : "";
        let modelBaseName;
        const sourceUnit = isHeroModel ? hero || unit : unit;
        if (!sourceUnit) modelBaseName = "Error";
        else if (isHeroModel) modelBaseName = sourceUnit.customName || sourceUnit.originalName;
        else if (sourceUnit.size === 1 && !hero) modelBaseName = sourceUnit.customName || sourceUnit.originalName;
        else if (model.isTough) modelBaseName = `Tough ${toughCounter++}`;
        else modelBaseName = `Model ${modelCounter++}`;
        modelsHtml += `<div class="model-display clickable-model ${isRemoved ? "model-removed" : ""} ${isHeroModel ? "hero-model" : ""}" data-model-id="${model.modelId}" title="Click to apply wound. ${modelBaseName} - HP: ${model.currentHp}/${model.maxHp}"><div class="model-icon ${heroColorClass}">${modelIcon}</div><div class="model-hp-bar-container"><div class="model-hp-bar ${bgColorClass}" style="width: ${isRemoved ? 0 : hpPercentage}%;"></div></div><div class="model-hp-text small">${model.currentHp}/${model.maxHp}</div><div class="model-name text-muted text-truncate">${modelBaseName}</div></div>`;
    });
    modelsHtml += "</div>";
    return modelsHtml;
}

function updateModelDisplay(unitSelectionId, modelId, currentHp, maxHp) {
    const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
    if (!modelElement) { console.warn(`Model element not found for update: ${modelId}`); return; }
    const hpBar = modelElement.querySelector(".model-hp-bar");
    const hpText = modelElement.querySelector(".model-hp-text");
    const modelNameElement = modelElement.querySelector(".model-name");
    const isRemoved = currentHp <= 0;
    const hpPercentage = Math.max(0, (currentHp / maxHp) * 100);
    let bgColorClass = "bg-success";
    if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
    else if (hpPercentage < 50) bgColorClass = "bg-danger";
    if (isRemoved) bgColorClass = "bg-secondary";
    modelElement.classList.toggle("model-removed", isRemoved);
    if (hpBar) { hpBar.className = `model-hp-bar ${bgColorClass}`; hpBar.style.width = `${isRemoved ? 0 : hpPercentage}%`; }
    if (hpText) hpText.textContent = `${Math.max(0, currentHp)}/${maxHp}`;
    const modelName = modelNameElement ? modelNameElement.textContent : "Model";
    modelElement.title = `Click to apply wound. ${modelName} - HP: ${Math.max(0, currentHp)}/${maxHp}`;
}

function updateTokenDisplay(unitId, currentTokens, casterLevel) {
    const cardElement = document.getElementById(`unit-card-${unitId}`);
    if (!cardElement) { console.warn(`Card element not found for token update: ${unitId}`); return; }
    const tokenCountElement = cardElement.querySelector(".token-count");
    if (tokenCountElement) tokenCountElement.textContent = `${currentTokens} / ${config.MAX_SPELL_TOKENS}`;
    const addButton = cardElement.querySelector(".token-add-btn");
    const removeButton = cardElement.querySelector(".token-remove-btn");
    if (addButton) addButton.disabled = currentTokens >= config.MAX_SPELL_TOKENS;
    if (removeButton) removeButton.disabled = currentTokens <= 0;
}

function updateActionButtonsUI(unitId, activeAction, isShaken = false) {
    const cardElement = document.getElementById(`unit-card-${unitId}`);
    if (!cardElement) return;
    const actionButtons = cardElement.querySelectorAll(".action-btn:not(.recover-btn)");
    const recoverButton = cardElement.querySelector(".recover-btn");
    cardElement.classList.toggle("unit-activated", !!activeAction && !isShaken);
    cardElement.classList.toggle("unit-shaken", isShaken);
    if (isShaken) {
        actionButtons.forEach(button => {
            button.style.display = 'none'; button.disabled = true;
            const buttonAction = button.dataset.action;
            const colorTheme = ACTION_BUTTON_CONFIG[buttonAction]?.colorTheme || "secondary";
            button.classList.remove('action-selected', `btn-${colorTheme}`, `btn-outline-${colorTheme}`);
            button.classList.add(`btn-outline-${colorTheme}`);
        });
        if (recoverButton) {
            recoverButton.style.display = 'inline-block'; recoverButton.disabled = false;
            recoverButton.classList.toggle("action-selected", activeAction === 'Recover');
            recoverButton.classList.toggle("btn-warning", activeAction === 'Recover');
            recoverButton.classList.toggle("btn-outline-warning", activeAction !== 'Recover');
        }
    } else {
        actionButtons.forEach(button => {
            button.style.display = 'inline-block';
            const buttonAction = button.dataset.action;
            const colorTheme = ACTION_BUTTON_CONFIG[buttonAction]?.colorTheme || "secondary";
            button.classList.remove('action-selected', `btn-${colorTheme}`, `btn-outline-${colorTheme}`);
            if (activeAction) {
                if (buttonAction === activeAction) { button.classList.add('action-selected', `btn-${colorTheme}`); button.disabled = false; }
                else { button.classList.add(`btn-outline-${colorTheme}`); button.disabled = true; }
            } else { button.classList.add(`btn-outline-${colorTheme}`); button.disabled = false; }
        });
        if (recoverButton) { recoverButton.style.display = 'none'; recoverButton.disabled = true; }
    }
}

function resetAllActionButtonsUI() {
    const allCards = document.querySelectorAll(".unit-card");
    allCards.forEach((card) => {
        const unitId = card.dataset.unitId;
        if (unitId && !card.classList.contains('unit-destroyed') && !card.classList.contains('unit-routed')) {
            const isShaken = getUnitStateValue(getCurrentArmyId(), unitId, 'shaken', false);
            updateActionButtonsUI(unitId, null, isShaken);
        }
    });
}

function updateFatiguedStatusUI(cardUnitId, isFatigued) {
    const indicator = document.querySelector(`.header-status-indicators[data-unit-id="${cardUnitId}"] .fatigue-indicator`);
    if (indicator) indicator.style.display = isFatigued ? 'inline' : 'none';
}

function updateShakenStatusUI(cardUnitId, isShaken) {
    const indicator = document.querySelector(`.header-status-indicators[data-unit-id="${cardUnitId}"] .shaken-indicator`);
    if (indicator) indicator.style.display = isShaken ? 'inline' : 'none';
    const currentAction = getUnitStateValue(getCurrentArmyId(), cardUnitId, 'action', null);
    updateActionButtonsUI(cardUnitId, currentAction, isShaken);
}

function collapseDestroyedCard(cardUnitId) {
    const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
    if (!cardElement || cardElement.classList.contains('unit-destroyed')) return;
    const cardBody = cardElement.querySelector('.card-body');
    const cardHeader = cardElement.querySelector('.card-header');
    if (cardBody) cardBody.style.display = 'none';
    if (cardHeader) {
        cardHeader.classList.add('bg-danger', 'text-white');
        if (!cardHeader.querySelector('.status-overlay-text')) {
            const overlay = document.createElement('div');
            overlay.className = 'status-overlay-text position-absolute top-50 start-50 translate-middle fw-bold h3';
            overlay.textContent = 'DESTROYED';
            overlay.style.zIndex = '3';
            cardHeader.style.position = 'relative';
            cardHeader.appendChild(overlay);
        }
    }
    cardElement.classList.add('unit-destroyed');
    cardElement.style.opacity = '0.5';
    cardElement.style.filter = 'grayscale(80%)';
    cardElement.style.pointerEvents = 'none';
}

function collapseRoutedCard(cardUnitId) {
    const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
    if (!cardElement || cardElement.classList.contains('unit-routed')) return;
    const cardBody = cardElement.querySelector('.card-body');
    const cardHeader = cardElement.querySelector('.card-header');
    //if (cardBody) cardBody.style.display = 'none'; // Hide body
    if (cardHeader) {
        cardBody.classList.add('bg-secondary-subtle'); // Use subtle background
        if (!cardBody.querySelector('.status-overlay-text')) {
            const overlay = document.createElement('div');
            overlay.className = 'status-overlay-text position-absolute top-50 start-50 translate-middle fw-bold h3 text-muted';
            overlay.textContent = 'ROUTED';
            overlay.style.zIndex = '3';
            cardBody.style.position = 'relative';
            cardBody.appendChild(overlay);
        }
    }
    cardElement.classList.add('unit-routed');
    cardElement.style.opacity = '0.6';
    // Keep header clickable for potential future actions (like rally?)
     cardElement.style.pointerEvents = 'none';
}

function resetCardUI(cardUnitId) {
    const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
    if (!cardElement) return;
    const cardBody = cardElement.querySelector('.card-body');
    const cardHeader = cardElement.querySelector('.card-header');
    const overlayText = cardHeader?.querySelector('.status-overlay-text');
    if (cardBody) cardBody.style.display = '';
    if (cardHeader) {
        cardHeader.classList.remove('bg-danger', 'bg-secondary-subtle', 'text-white');
        if (overlayText) overlayText.remove();
    }
    cardElement.classList.remove('unit-destroyed', 'unit-routed', 'unit-shaken', 'unit-activated');
    cardElement.style.opacity = '';
    cardElement.style.filter = '';
    cardElement.style.pointerEvents = '';
    updateFatiguedStatusUI(cardUnitId, false);
    updateShakenStatusUI(cardUnitId, false); // Also resets buttons
}

// --- Main Display Function ---
function displayArmyUnits(processedArmy, displayContainerRow) {
    if (!displayContainerRow) { console.error("Display container row not provided."); return; }
    if (!processedArmy || !processedArmy.units) { displayContainerRow.innerHTML = '<div class="col-12"><p class="text-muted text-center">No units to display.</p></div>'; return; }
    displayContainerRow.innerHTML = "";
    const initialStatesToApply = [];

    processedArmy.units.forEach((currentUnit) => {
        if (currentUnit.isHero && processedArmy.heroJoinTargets?.[currentUnit.selectionId]) return;
        let hero = null;
        const joinedHeroId = Object.keys(processedArmy.heroJoinTargets || {}).find(key => processedArmy.heroJoinTargets[key] === currentUnit.selectionId);
        if (joinedHeroId && processedArmy.unitMap?.[joinedHeroId]) hero = processedArmy.unitMap[joinedHeroId];
        const baseUnit = currentUnit;
        let casterLevel = 0, unitIsCaster = false, actualCasterUnitId = null;
        if (hero?.casterLevel > 0) { casterLevel = hero.casterLevel; unitIsCaster = true; actualCasterUnitId = hero.selectionId; }
        else if (baseUnit.casterLevel > 0) { casterLevel = baseUnit.casterLevel; unitIsCaster = true; actualCasterUnitId = baseUnit.selectionId; }
        const armyId = processedArmy.meta.id;
        const initialTokens = getUnitStateValue(armyId, actualCasterUnitId || baseUnit.selectionId, 'tokens', 0);
        const initialAction = getUnitStateValue(armyId, baseUnit.selectionId, 'action', null);
        const initialShaken = getUnitStateValue(armyId, baseUnit.selectionId, 'shaken', false);
        const initialFatigued = getUnitStateValue(armyId, baseUnit.selectionId, 'fatigued', false);
        const initialStatus = getUnitStateValue(armyId, baseUnit.selectionId, 'status', 'active');
        initialStatesToApply.push({ unitId: baseUnit.selectionId, action: initialAction, isShaken: initialShaken, isFatigued: initialFatigued, status: initialStatus });

        const colDiv = document.createElement("div");
        colDiv.className = "col d-flex";
        const cardDiv = document.createElement("div");
        cardDiv.id = `unit-card-${baseUnit.selectionId}`;
        cardDiv.dataset.armyId = processedArmy.meta.id;
        cardDiv.dataset.unitId = baseUnit.selectionId;
        cardDiv.className = "card unit-card shadow-sm border-secondary-subtle flex-fill";
        const cardHeaderHTML = _createUnitCardHeaderHTML(baseUnit, hero);
        const effectiveStatsHTML = _createEffectiveStatsHTML(baseUnit, hero);
        const actionControlsHTML = _createActionControlsHTML(baseUnit, hero);
        const modelsHTML = createModelsDisplay(baseUnit, hero);
        // Manual Triggers - Removed Defend Melee button
        const manualTriggersHTML = `<div class="manual-triggers mt-2"> <button type="button" class="btn btn-sm btn-outline-danger resolve-melee-btn me-1" title="Report the outcome of a melee combat this unit was involved in.">Resolve Melee</button> <button type="button" class="btn btn-sm btn-outline-secondary morale-wounds-btn" title="Manually trigger a morale check due to taking wounds.">Check Morale (Wounds)</button></div><hr class="my-2">`;
        let cardBodyContentHTML = `<div class="details-section">`;
        if (hero) { // Joined unit display logic...
            const heroBase = hero.bases?.round || hero.bases?.square;
            const heroRules = hero.rules.map(rule => _formatRule(rule, unitIsCaster && actualCasterUnitId === hero.selectionId)).filter(Boolean).sort().join(", ");
            cardBodyContentHTML += `<div class="sub-section"><h6>${hero.customName || hero.originalName}</h6><div class="sub-stats-row"><div class="stat-item">${UI_ICONS.quality} <span>${hero.quality}+</span></div><div class="stat-item">${UI_ICONS.defense} <span>${hero.defense}+</span></div>${hero.rules.find(r => r.name === "Tough") ? `<div class="stat-item">${UI_ICONS.tough} <span>${hero.rules.find(r => r.name === "Tough")?.rating ?? "?"}</span></div>` : ""}</div><div class="info-line small text-muted"><span class="info-item">${hero.cost} pts</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${hero.xp || 0}</span></span><span class="info-item base-info">${UI_ICONS.base} ${heroBase ? heroBase + "mm" : "N/A"}</span></div>${unitIsCaster && actualCasterUnitId === hero.selectionId ? _createCasterControlsHTML(casterLevel, initialTokens) : ""}<div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${heroRules || "None"}</span></div><div class="mt-2 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(hero.loadout, _formatRule)}</div></div>`;
            const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
            const unitRules = baseUnit.rules.map(rule => _formatRule(rule, false)).filter(Boolean).sort().join(", ");
            cardBodyContentHTML += `<div class="sub-section"><h6>${baseUnit.customName || baseUnit.originalName}</h6><div class="sub-stats-row"><div class="stat-item">${UI_ICONS.quality} <span>${baseUnit.quality}+</span></div><div class="stat-item">${UI_ICONS.defense} <span>${baseUnit.defense}+</span></div>${baseUnit.rules.find(r => r.name === "Tough") ? `<div class="stat-item">${UI_ICONS.tough} <span>${baseUnit.rules.find(r => r.name === "Tough")?.rating ?? "?"}</span></div>` : ""}</div><div class="info-line small text-muted"><span class="info-item">${baseUnit.cost} pts</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${baseUnit.xp || 0}</span></span><span class="info-item base-info">${UI_ICONS.base} ${unitBase ? unitBase + "mm" : "N/A"}</span></div><div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${unitRules || "None"}</span></div><div class="mt-2 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(baseUnit.loadout, _formatRule)}</div></div>`;
        } else { // Normal unit display logic...
            const unitRules = baseUnit.rules.map(rule => _formatRule(rule, unitIsCaster)).filter(Boolean).sort().join(", ");
            cardBodyContentHTML += `<div class="normal-unit-details">${unitIsCaster ? _createCasterControlsHTML(casterLevel, initialTokens) : ""}<div class="mb-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${unitRules || "None"}</span></div><div class="mb-0 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(baseUnit.loadout, _formatRule)}</div></div>`;
        }
        cardBodyContentHTML += `</div>`;
        const cardBody = document.createElement("div");
        cardBody.className = "card-body";
        cardBody.innerHTML = effectiveStatsHTML + actionControlsHTML + manualTriggersHTML + cardBodyContentHTML + modelsHTML;
        cardDiv.innerHTML = cardHeaderHTML;
        cardDiv.appendChild(cardBody);
        colDiv.appendChild(cardDiv);
        displayContainerRow.appendChild(colDiv);
    });

    requestAnimationFrame(() => {
        initialStatesToApply.forEach(({ unitId, action, isShaken, isFatigued, status }) => {
            updateActionButtonsUI(unitId, action, isShaken);
            updateFatiguedStatusUI(unitId, isFatigued);
            if (status === 'destroyed') collapseDestroyedCard(unitId);
            else if (status === 'routed') collapseRoutedCard(unitId);
        });
    });
}

// Corrected Exports
export {
    displayArmyUnits,
    updateModelDisplay,
    updateTokenDisplay,
    createModelsDisplay,
    updateActionButtonsUI,
    resetAllActionButtonsUI,
    updateFatiguedStatusUI,
    updateShakenStatusUI,
    collapseDestroyedCard,
    collapseRoutedCard,
    resetCardUI,
};
