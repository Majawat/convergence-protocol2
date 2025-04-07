/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 */

import { config, UI_ICONS, ACTION_BUTTON_CONFIG } from "./config.js"; // Configuration constants
import { calculateMovement } from "./gameLogic.js"; // Import the new function
import { getUnitStateValue, getCurrentArmyId, getUnitData } from "./state.js"; // Import state functions

// --- Helper Functions ---

/**
 * Formats a rule object into a display string, optionally filtering out Tough/Caster.
 * @param {object} rule - The rule object { name, label, rating }.
 * @param {boolean} filterCaster - Whether to filter out the 'Caster' rule display.
 * @returns {string|null} The formatted rule string (e.g., "Fear(2)", "Ambush") or null if filtered.
 * @private
 */
function _formatRule(rule, filterCaster) {
  const baseName = rule.name || rule.label;
  if (!baseName) return null;

  // Filter out rules handled explicitly by UI elements
  if (rule.name === "Tough") return null;
  if (filterCaster && rule.name === "Caster") return null;

  // Format with rating if present
  if (
    rule.rating !== null &&
    rule.rating !== undefined &&
    String(rule.rating).trim().length > 0
  ) {
    return `${baseName}(${rule.rating})`;
  }
  return baseName;
}

/**
 * Creates the HTML string for a weapon table.
 * @param {Array<object>} loadout - Array of weapon objects from processed unit data.
 * @param {function} formatRuleFn - Function to format individual special rules.
 * @returns {string} HTML string for the weapon table.
 * @private
 */
function _createWeaponTableHTML(loadout, formatRuleFn) {
  if (!loadout || loadout.length === 0) {
    return '<p class="text-muted small mb-0">No weapons listed.</p>';
  }

  // Aggregate identical weapons
  const aggregatedWeapons = {};
  loadout.forEach((weapon) => {
    const apRule = (weapon.specialRules || []).find((r) => r.name === "AP");
    const apValue = apRule ? parseInt(apRule.rating, 10) : 0;
    const otherRules = (weapon.specialRules || [])
      .filter((r) => r.name !== "AP") // Filter AP rule itself
      .map((rule) => formatRuleFn(rule, false)) // Format remaining rules (don't filter caster here)
      .filter(Boolean) // Remove nulls if any rule was filtered
      .sort()
      .join(", ");

    // Create a unique key based on weapon properties
    const weaponKey = `${weapon.name}|${weapon.range || "-"}|${
      weapon.attacks || "-"
    }|${apValue}|${otherRules}`;

    if (aggregatedWeapons[weaponKey]) {
      aggregatedWeapons[weaponKey].count += weapon.count || 1;
    } else {
      aggregatedWeapons[weaponKey] = {
        data: weapon,
        count: weapon.count || 1,
        apValue: !isNaN(apValue) && apValue > 0 ? `${apValue}` : "-", // Display AP value or '-'
        otherRulesString: otherRules || "-", // Display rules string or '-'
      };
    }
  });

  // Build HTML table
  let tableHtml =
    '<table class="table table-sm table-borderless table-striped mb-0">';
  tableHtml += `<thead><tr><th>Weapon</th><th class="text-center">RNG</th><th class="text-center">ATK</th><th class="text-center">AP</th><th>Special</th></tr></thead><tbody>`;

  Object.values(aggregatedWeapons).forEach((aggWeapon) => {
    const weapon = aggWeapon.data;
    const weaponName = `${aggWeapon.count > 1 ? aggWeapon.count + "x " : ""}${
      weapon.name
    }`;
    tableHtml += `<tr class="align-middle">
            <td>${weaponName}</td>
            <td class="text-center">${
              weapon.range ? `${weapon.range}"` : "-"
            }</td>
            <td class="text-center">${
              weapon.attacks ? `A${weapon.attacks}` : "-"
            }</td>
            <td class="text-center">${aggWeapon.apValue}</td>
            <td>${aggWeapon.otherRulesString}</td>
        </tr>`;
  });

  tableHtml += "</tbody></table>";
  return tableHtml;
}

/**
 * Creates the HTML string for the caster control section.
 * @param {number} casterLevel - The Caster(X) level.
 * @param {number} initialTokens - The starting token count.
 * @returns {string} HTML string for the caster controls, or empty string if not a caster.
 * @private
 */
function _createCasterControlsHTML(casterLevel, initialTokens) {
  if (casterLevel <= 0) return "";

  const currentTokens = Math.min(initialTokens, config.MAX_SPELL_TOKENS); // Ensure initial doesn't exceed max
  const addDisabled =
    currentTokens >= config.MAX_SPELL_TOKENS ? "disabled" : "";
  const removeDisabled = currentTokens <= 0 ? "disabled" : "";

  return `
        <div class="caster-section">
             <div class="caster-controls">
                 <span class="caster-level-badge me-2">Caster(${casterLevel})</span>
                 <div class="token-controls">
                     <button type="button" class="btn btn-sm btn-outline-info token-remove-btn" title="Spend Token" ${removeDisabled}>${UI_ICONS.tokenRemove}</button>
                     <span class="token-count-display" title="Spell Tokens">
                         ${UI_ICONS.spellTokens}
                         <span class="token-count">${currentTokens} / ${config.MAX_SPELL_TOKENS}</span>
                     </span>
                     <button type="button" class="btn btn-sm btn-outline-info token-add-btn" title="Add Token" ${addDisabled}>${UI_ICONS.tokenAdd}</button>
                 </div>
                 <button type="button" class="btn btn-sm btn-outline-info view-spells-btn" title="View Spells">${UI_ICONS.viewSpells} View Spells</button>
             </div>
        </div>
    `;
}

/**
 * Creates the HTML string for the unit card header. Includes status indicator placeholders.
 * @param {object} baseUnit - The processed base unit data.
 * @param {object | null} hero - The processed hero data if joined.
 * @returns {string} HTML string for the card header.
 * @private
 */
function _createUnitCardHeaderHTML(baseUnit, hero) {
  const title = hero
    ? `${hero.customName || hero.originalName} w/ ${
        baseUnit.customName || baseUnit.originalName
      }`
    : baseUnit.customName || baseUnit.originalName;
  const subtitle = hero
    ? `${hero.originalName} and ${baseUnit.originalName}`
    : baseUnit.originalName;
  const totalModels = baseUnit.size + (hero ? hero.size : 0);
  const totalPoints = baseUnit.cost + (hero ? hero.cost : 0);

  // Meta info (Models, Points, XP, Base Size)
  let metaHtml = `<span class="info-item">${totalModels} Models</span><span class="info-separator">|</span><span class="info-item">${totalPoints} pts</span>`;
  if (!hero) {
    const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
    metaHtml += `<span class="info-separator">|</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
      baseUnit.xp || 0
    }</span></span>`;
    metaHtml += `<span class="info-separator">|</span><span class="info-item base-info">${
      UI_ICONS.base
    } ${unitBase ? unitBase + "mm" : "N/A"}</span>`;
  }

  // --- ADDED Status Indicator Placeholders ---
  const statusIndicatorHTML = `
        <span class="header-status-indicators ms-2 small" data-unit-id="${baseUnit.selectionId}">
            <span class="fatigue-indicator text-warning" style="display: none;" title="Fatigued"><i class="bi bi-clock-history fs-6"></i></span>
            <span class="shaken-indicator text-warning" style="display: none;" title="Shaken"><i class="bi bi-exclamation-triangle-fill fs-6"></i></span>
        </span>
    `;
  // --- END ADDED ---

  return `
        <div class="card-header bg-body-tertiary">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-1">
                <div class="unit-card-header-content">
                    <h5 class="mb-0 card-title d-flex align-items-center">
                        ${title}
                        ${statusIndicatorHTML}
                    </h5>
                    <small class="text-muted d-block">${subtitle}</small>
                    <div class="header-meta-info text-muted mt-1">${metaHtml}</div>
                </div>
            </div>
            <div class="btn-group btn-group-sm header-button-group">
                <button type="button" class="btn btn-outline-danger wound-apply-btn" title="Apply Wound (Auto-Target)">${UI_ICONS.woundApply}</button>
                <button type="button" class="btn btn-outline-secondary unit-reset-btn" title="Reset Unit State (HP, Status, Action)">${UI_ICONS.woundReset}</button>
            </div>
        </div>
    `;
}

/**
 * Creates the HTML string for the effective stats bar (Quality/Defense).
 * @param {object} baseUnit - The processed base unit data.
 * @param {object | null} hero - The processed hero data if joined.
 * @returns {string} HTML string for the effective stats bar.
 * @private
 */
function _createEffectiveStatsHTML(baseUnit, hero) {
  // Use hero's quality if joined, otherwise base unit's
  const effectiveQuality = hero ? hero.quality : baseUnit.quality;
  // Defense is typically determined by the base unit (as heroes join them)
  const effectiveDefense = baseUnit.defense;

  return `
        <div class="effective-stats">
            <div class="stat-item" title="Effective Quality (Used for Morale)">
                ${UI_ICONS.quality}<span>${effectiveQuality}+</span>
            </div>
            <div class="stat-item" title="Effective Defense">
                ${UI_ICONS.defense}<span>${effectiveDefense}+</span>
            </div>
        </div>
    `;
}

/**
 * Creates the HTML string for the unit action controls.
 * Uses ACTION_BUTTON_CONFIG and UI_ICONS. Includes hidden Recover button.
 * @param {object} baseUnit - The processed base unit data.
 * @param {object | null} hero - The processed hero data if joined.
 * @returns {string} HTML string for the action controls.
 * @private
 */
function _createActionControlsHTML(baseUnit, hero) {
  const movementUnit = hero || baseUnit;

  const actionNames = ["Hold", "Advance", "Rush", "Charge"];
  let buttonsHTML = "";

  actionNames.forEach((actionName) => {
    const config = ACTION_BUTTON_CONFIG[actionName];
    if (!config) return; // Skip if action not configured

    const icon = UI_ICONS[config.iconKey] || ""; // Get icon SVG from UI_ICONS
    let text = config.baseText;

    // Add dynamic movement value for relevant actions
    if (
      actionName === "Advance" ||
      actionName === "Rush" ||
      actionName === "Charge"
    ) {
      const moveValue = calculateMovement(movementUnit, actionName);
      text += ` (${moveValue}")`;
    }

    buttonsHTML += `<button type="button" class="btn btn-outline-${config.colorTheme} action-btn" data-action="${actionName}" title="${actionName}">
                        ${icon}
                        <span class="action-text">${text}</span>
                    </button>`;
  });

  // Add the Recover button (initially hidden)
  buttonsHTML += `<button type="button" class="btn btn-warning action-btn recover-btn" data-action="Recover" title="Recover from Shaken" style="display: none;">
                      <i class="bi bi-bandaid"></i>
                      <span class="action-text">Recover</span>
                   </button>`;

  return `
        <div class="action-controls">
            <div class="btn-group w-100" role="group" aria-label="Unit Actions">
                ${buttonsHTML}
            </div>
        </div>
    `;
}

/**
 * Creates the HTML string for displaying individual models within a unit card.
 * @param {object} unit - The processed unit data for the base unit.
 * @param {object | null} hero - The processed hero data if joined, otherwise null.
 * @returns {string} HTML string for the models section.
 */
function createModelsDisplay(unit, hero = null) {
  // Combine models if a hero is joined
  const displayModels = hero ? [...hero.models, ...unit.models] : unit.models;
  if (!displayModels || displayModels.length === 0) {
    return '<p class="text-muted small">No model data.</p>';
  }

  let modelsHtml = '<div class="unit-models-grid">';
  let toughCounter = 1; // Counter for naming tough models
  let modelCounter = 1; // Counter for naming regular models

  displayModels.forEach((model) => {
    const isRemoved = model.currentHp <= 0;
    const hpPercentage = (model.currentHp / model.maxHp) * 100;

    // Determine background color based on HP percentage
    let bgColorClass = "bg-success";
    if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
    else if (hpPercentage < 50) bgColorClass = "bg-danger";
    if (isRemoved) bgColorClass = "bg-secondary";

    // Determine icon and color
    const isHeroModel = model.isHero;
    const modelIcon = isHeroModel
      ? UI_ICONS.hero
      : model.isTough
      ? UI_ICONS.tough
      : UI_ICONS.hero; // Default icon
    const heroColorClass = isHeroModel ? "hero-icon-color" : "";

    // Determine model name
    let modelBaseName;
    const sourceUnit = isHeroModel ? hero || unit : unit; // Find the unit this model belongs to

    if (!sourceUnit) {
      modelBaseName = "Error";
    } else if (isHeroModel) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName; // Hero uses its own name
    } else if (sourceUnit.size === 1 && !hero) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName; // Single non-hero model unit
    } else if (model.isTough) {
      modelBaseName = `Tough ${toughCounter++}`; // Numbered tough model
    } else {
      modelBaseName = `Model ${modelCounter++}`; // Numbered regular model
    }

    // Build model HTML
    modelsHtml += `
            <div class="model-display clickable-model ${
              isRemoved ? "model-removed" : ""
            } ${isHeroModel ? "hero-model" : ""}"
                 data-model-id="${model.modelId}"
                 title="Click to apply wound. ${modelBaseName} - HP: ${
      model.currentHp
    }/${model.maxHp}">
                <div class="model-icon ${heroColorClass}">${modelIcon}</div>
                <div class="model-hp-bar-container">
                    <div class="model-hp-bar ${bgColorClass}" style="width: ${
      isRemoved ? 0 : hpPercentage
    }%;"></div>
                </div>
                <div class="model-hp-text small">${model.currentHp}/${
      model.maxHp
    }</div>
                <div class="model-name text-muted text-truncate">${modelBaseName}</div>
            </div>
        `;
  });

  modelsHtml += "</div>";
  return modelsHtml;
}

/**
 * Updates the visual representation of a single model's HP on its display element.
 * @param {string} unitSelectionId - The selectionId of the unit card containing the model.
 * @param {string} modelId - The unique ID of the model element (`data-model-id`).
 * @param {number} currentHp - The model's current HP.
 * @param {number} maxHp - The model's maximum HP.
 */
function updateModelDisplay(unitSelectionId, modelId, currentHp, maxHp) {
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (!modelElement) {
    console.warn(`Model element not found for update: ${modelId}`);
    return;
  }

  const hpBar = modelElement.querySelector(".model-hp-bar");
  const hpText = modelElement.querySelector(".model-hp-text");
  const modelNameElement = modelElement.querySelector(".model-name");

  const isRemoved = currentHp <= 0;
  const hpPercentage = Math.max(0, (currentHp / maxHp) * 100); // Ensure percentage is not negative

  // Determine background color
  let bgColorClass = "bg-success";
  if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
  else if (hpPercentage < 50) bgColorClass = "bg-danger";
  if (isRemoved) bgColorClass = "bg-secondary";

  // Update classes and styles
  modelElement.classList.toggle("model-removed", isRemoved);
  if (hpBar) {
    hpBar.className = `model-hp-bar ${bgColorClass}`; // Update color class
    hpBar.style.width = `${isRemoved ? 0 : hpPercentage}%`; // Update width
  }
  if (hpText) {
    hpText.textContent = `${Math.max(0, currentHp)}/${maxHp}`; // Update HP text (ensure currentHp >= 0)
  }

  // Update tooltip
  const modelName = modelNameElement ? modelNameElement.textContent : "Model";
  modelElement.title = `Click to apply wound. ${modelName} - HP: ${Math.max(
    0,
    currentHp
  )}/${maxHp}`;
}

/**
 * Updates the displayed token count and button states for a unit card.
 * @param {string} unitId - The selectionId of the unit *card* to update.
 * @param {number} currentTokens - The current token count for the caster associated with this card.
 * @param {number} casterLevel - The caster level (X) of the caster associated with this card.
 */
function updateTokenDisplay(unitId, currentTokens, casterLevel) {
  const cardElement = document.getElementById(`unit-card-${unitId}`);
  if (!cardElement) {
    console.warn(`Card element not found for token update: ${unitId}`);
    return;
  }

  const tokenCountElement = cardElement.querySelector(".token-count");
  if (tokenCountElement) {
    tokenCountElement.textContent = `${currentTokens} / ${config.MAX_SPELL_TOKENS}`;
  }

  // Update button states based on token limits
  const addButton = cardElement.querySelector(".token-add-btn");
  const removeButton = cardElement.querySelector(".token-remove-btn");
  if (addButton) addButton.disabled = currentTokens >= config.MAX_SPELL_TOKENS;
  if (removeButton) removeButton.disabled = currentTokens <= 0;
}

/**
 * Updates the UI state of the action buttons on a unit card. Handles Shaken state.
 * @param {string} unitId - The selectionId of the unit card to update.
 * @param {string | null} activeAction - The currently active action ('Hold', 'Advance', etc.), or null if deactivated.
 * @param {boolean} [isShaken=false] - Whether the unit is currently Shaken.
 */
function updateActionButtonsUI(unitId, activeAction, isShaken = false) {
  const cardElement = document.getElementById(`unit-card-${unitId}`);
  if (!cardElement) {
    return;
  }

  const actionButtons = cardElement.querySelectorAll(
    ".action-btn:not(.recover-btn)"
  ); // Select non-recover buttons
  const recoverButton = cardElement.querySelector(".recover-btn");

  cardElement.classList.toggle("unit-activated", !!activeAction && !isShaken); // Only activated if not shaken
  cardElement.classList.toggle("unit-shaken", isShaken); // Add/remove class for visual styling

  if (isShaken) {
    // Shaken: Hide normal actions, show Recover
    actionButtons.forEach((button) => {
      button.style.display = "none"; // Hide normal actions
      button.disabled = true;
      // Reset any selection classes if needed
      const buttonAction = button.dataset.action;
      const colorTheme =
        ACTION_BUTTON_CONFIG[buttonAction]?.colorTheme || "secondary";
      button.classList.remove(
        "action-selected",
        `btn-${colorTheme}`,
        `btn-outline-${colorTheme}`
      );
      button.classList.add(`btn-outline-${colorTheme}`); // Keep outline style for consistency if shown later
    });
    if (recoverButton) {
      recoverButton.style.display = "inline-block"; // Show Recover button
      recoverButton.disabled = false;
      // Highlight recover if it's the 'active' action conceptually
      recoverButton.classList.toggle(
        "action-selected",
        activeAction === "Recover"
      );
      recoverButton.classList.toggle("btn-warning", activeAction === "Recover");
      recoverButton.classList.toggle(
        "btn-outline-warning",
        activeAction !== "Recover"
      );
    }
  } else {
    // Not Shaken: Show normal actions, hide Recover
    actionButtons.forEach((button) => {
      button.style.display = "inline-block"; // Show normal actions
      const buttonAction = button.dataset.action;
      const colorTheme =
        ACTION_BUTTON_CONFIG[buttonAction]?.colorTheme || "secondary";

      // Reset classes first
      button.classList.remove(
        "action-selected",
        `btn-${colorTheme}`,
        `btn-outline-${colorTheme}`
      );

      if (activeAction) {
        if (buttonAction === activeAction) {
          button.classList.add("action-selected", `btn-${colorTheme}`); // Solid background
          button.disabled = false;
        } else {
          button.classList.add(`btn-outline-${colorTheme}`); // Outline background
          button.disabled = true;
        }
      } else {
        button.classList.add(`btn-outline-${colorTheme}`); // Outline background
        button.disabled = false;
      }
    });
    if (recoverButton) {
      recoverButton.style.display = "none"; // Hide Recover button
      recoverButton.disabled = true;
    }
  }
}

/**
 * Resets the action buttons UI for all cards on the page.
 * Used typically at the start of a round.
 */
function resetAllActionButtonsUI() {
  const allCards = document.querySelectorAll(".unit-card");
  allCards.forEach((card) => {
    const unitId = card.dataset.unitId;
    if (
      unitId &&
      !card.classList.contains("unit-destroyed") &&
      !card.classList.contains("unit-routed")
    ) {
      // Check if not destroyed/routed
      // Fetch current shaken state to pass to update function
      const isShaken = getUnitStateValue(
        getCurrentArmyId(),
        unitId,
        "shaken",
        false
      );
      updateActionButtonsUI(unitId, null, isShaken); // Call update with null action, respecting shaken status
    }
  });
}

/**
 * Updates the visual indicator for Fatigue status in the header.
 * @param {string} cardUnitId - The selectionId of the unit card.
 * @param {boolean} isFatigued - Whether the unit is fatigued.
 */
function updateFatiguedStatusUI(cardUnitId, isFatigued) {
  const indicator = document.querySelector(
    `.header-status-indicators[data-unit-id="${cardUnitId}"] .fatigue-indicator`
  );
  if (indicator) {
    indicator.style.display = isFatigued ? "inline" : "none"; // Use inline for header
  }
}

/**
 * Updates the visual indicator for Shaken status in the header and button states.
 * @param {string} cardUnitId - The selectionId of the unit card.
 * @param {boolean} isShaken - Whether the unit is shaken.
 */
function updateShakenStatusUI(cardUnitId, isShaken) {
  const indicator = document.querySelector(
    `.header-status-indicators[data-unit-id="${cardUnitId}"] .shaken-indicator`
  );
  if (indicator) {
    indicator.style.display = isShaken ? "inline" : "none"; // Use inline for header
  }
  // Also update action buttons via the modified updateActionButtonsUI
  const currentAction = getUnitStateValue(
    getCurrentArmyId(),
    cardUnitId,
    "action",
    null
  ); // Need state access or pass it in
  updateActionButtonsUI(cardUnitId, currentAction, isShaken);
}

/**
 * Collapses the card to show only the header, indicating Destroyed status.
 * @param {string} cardUnitId - The selectionId of the unit card.
 */
function collapseDestroyedCard(cardUnitId) {
  const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
  if (!cardElement || cardElement.classList.contains("unit-destroyed")) return; // Prevent multiple calls

  const cardBody = cardElement.querySelector(".card-body");
  const cardHeader = cardElement.querySelector(".card-header");

  if (cardBody) cardBody.style.display = "none"; // Hide body
  if (cardHeader) {
    cardHeader.classList.add("bg-danger", "text-white"); // Style header
    // Add "DESTROYED" text if not already present
    if (!cardHeader.querySelector(".status-overlay-text")) {
      const overlay = document.createElement("div");
      overlay.className =
        "status-overlay-text position-absolute top-50 start-50 translate-middle fw-bold h3";
      overlay.textContent = "DESTROYED";
      overlay.style.zIndex = "3"; // Ensure text is on top
      cardHeader.style.position = "relative"; // Needed for absolute positioning
      cardHeader.appendChild(overlay);
    }
  }
  cardElement.classList.add("unit-destroyed"); // Add class for general styling
  cardElement.style.opacity = "0.5";
  cardElement.style.filter = "grayscale(80%)"; // Add grayscale
  cardElement.style.pointerEvents = "none"; // Disable interactions
}

/**
 * Collapses the card to show only the header, indicating Routed status.
 * @param {string} cardUnitId - The selectionId of the unit card.
 */
function collapseRoutedCard(cardUnitId) {
  const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
  if (!cardElement || cardElement.classList.contains("unit-routed")) return; // Prevent multiple calls

  const cardBody = cardElement.querySelector(".card-body");
  const cardHeader = cardElement.querySelector(".card-header");

  if (cardBody) cardBody.style.display = "none"; // Hide body
  if (cardHeader) {
    cardHeader.classList.add("bg-secondary", "text-white"); // Style header differently?
    // Add "ROUTED" text if not already present
    if (!cardHeader.querySelector(".status-overlay-text")) {
      const overlay = document.createElement("div");
      overlay.className =
        "status-overlay-text position-absolute top-50 start-50 translate-middle fw-bold h3";
      overlay.textContent = "ROUTED";
      overlay.style.zIndex = "3"; // Ensure text is on top
      cardHeader.style.position = "relative"; // Needed for absolute positioning
      cardHeader.appendChild(overlay);
    }
  }
  cardElement.classList.add("unit-routed"); // Add class for general styling
  cardElement.style.opacity = "0.4";
  cardElement.style.filter = "grayscale(100%)"; // Make more gray than destroyed
  cardElement.style.pointerEvents = "none"; // Disable interactions
}

/**
 * Resets the card UI to its default state (e.g., after clicking Reset Unit).
 * @param {string} cardUnitId - The selectionId of the unit card.
 */
function resetCardUI(cardUnitId) {
  const cardElement = document.getElementById(`unit-card-${cardUnitId}`);
  if (!cardElement) return;

  const cardBody = cardElement.querySelector(".card-body");
  const cardHeader = cardElement.querySelector(".card-header");
  const overlayText = cardHeader?.querySelector(".status-overlay-text");

  // Restore body visibility
  if (cardBody) cardBody.style.display = "";

  // Reset header style
  if (cardHeader) {
    cardHeader.classList.remove("bg-danger", "bg-secondary", "text-white");
    if (overlayText) overlayText.remove(); // Remove status text
  }

  // Reset general card styles and classes
  cardElement.classList.remove(
    "unit-destroyed",
    "unit-routed",
    "unit-shaken",
    "unit-activated"
  );
  cardElement.style.opacity = "";
  cardElement.style.filter = "";
  cardElement.style.pointerEvents = "";

  // Reset status indicators
  updateFatiguedStatusUI(cardUnitId, false);
  updateShakenStatusUI(cardUnitId, false); // This also handles buttons via updateActionButtonsUI

  // Reset models (handled by _handleResetUnitClick calling updateModelDisplay)
}

// --- Main Display Function ---

/**
 * Displays the army units by creating and appending unit cards to the container.
 * @param {object} processedArmy - The structured army data object from processArmyData.
 * @param {HTMLElement} displayContainerRow - The HTML ROW element to inject the card columns into.
 */
function displayArmyUnits(processedArmy, displayContainerRow) {
  if (!displayContainerRow) {
    console.error("Display container row not provided for displayArmyUnits.");
    return;
  }
  if (!processedArmy || !processedArmy.units) {
    console.warn("No processed army or units found for displayArmyUnits.");
    displayContainerRow.innerHTML =
      '<div class="col-12"><p class="text-muted text-center">No units to display.</p></div>';
    return;
  }

  // Clear previous content
  displayContainerRow.innerHTML = "";
  const initialStatesToApply = []; // Store initial states

  processedArmy.units.forEach((currentUnit) => {
    if (
      currentUnit.isHero &&
      processedArmy.heroJoinTargets?.[currentUnit.selectionId]
    ) {
      return; // Skip joined heroes
    }

    let hero = null;
    const joinedHeroId = Object.keys(processedArmy.heroJoinTargets || {}).find(
      (key) => processedArmy.heroJoinTargets[key] === currentUnit.selectionId
    );
    if (joinedHeroId && processedArmy.unitMap?.[joinedHeroId]) {
      hero = processedArmy.unitMap[joinedHeroId];
    }
    const baseUnit = currentUnit;

    let casterLevel = 0;
    let unitIsCaster = false;
    let actualCasterUnitId = null;
    if (hero?.casterLevel > 0) {
      casterLevel = hero.casterLevel;
      unitIsCaster = true;
      actualCasterUnitId = hero.selectionId;
    } else if (baseUnit.casterLevel > 0) {
      casterLevel = baseUnit.casterLevel;
      unitIsCaster = true;
      actualCasterUnitId = baseUnit.selectionId;
    }

    const armyId = processedArmy.meta.id;
    const initialTokens = getUnitStateValue(
      armyId,
      actualCasterUnitId || baseUnit.selectionId,
      "tokens",
      0
    );
    const initialAction = getUnitStateValue(
      armyId,
      baseUnit.selectionId,
      "action",
      null
    );
    const initialShaken = getUnitStateValue(
      armyId,
      baseUnit.selectionId,
      "shaken",
      false
    );
    const initialFatigued = getUnitStateValue(
      armyId,
      baseUnit.selectionId,
      "fatigued",
      false
    );
    const initialStatus = getUnitStateValue(
      armyId,
      baseUnit.selectionId,
      "status",
      "active"
    );

    initialStatesToApply.push({
      unitId: baseUnit.selectionId,
      action: initialAction,
      isShaken: initialShaken,
      isFatigued: initialFatigued,
      status: initialStatus,
    });

    const colDiv = document.createElement("div");
    colDiv.className = "col d-flex";

    const cardDiv = document.createElement("div");
    cardDiv.id = `unit-card-${baseUnit.selectionId}`;
    cardDiv.dataset.armyId = processedArmy.meta.id;
    cardDiv.dataset.unitId = baseUnit.selectionId;
    cardDiv.className =
      "card unit-card shadow-sm border-secondary-subtle flex-fill";

    const cardHeaderHTML = _createUnitCardHeaderHTML(baseUnit, hero); // Includes status icons now
    const effectiveStatsHTML = _createEffectiveStatsHTML(baseUnit, hero);
    const actionControlsHTML = _createActionControlsHTML(baseUnit, hero);
    const modelsHTML = createModelsDisplay(baseUnit, hero);

    // --- Manual Triggers --- Moved below actions
    const manualTriggersHTML = `
            <div class="manual-triggers mt-2">
                <button type="button" class="btn btn-sm btn-outline-danger resolve-melee-btn me-1" title="Report the outcome of a melee combat this unit was involved in.">Resolve Melee</button>
                <button type="button" class="btn btn-sm btn-outline-secondary morale-wounds-btn" title="Manually trigger a morale check due to taking wounds.">Check Morale (Wounds)</button>
            </div>
            <hr class="my-2">
        `;
    // --- END Manual Triggers ---

    // Build Card Body Content
    let cardBodyContentHTML = `<div class="details-section">`;
    // ... (rest of the sub-section / normal-unit-details logic remains the same) ...
    if (hero) {
      // --- Joined Unit Display ---
      const heroBase = hero.bases?.round || hero.bases?.square;
      const heroRules = hero.rules
        .map((rule) =>
          _formatRule(
            rule,
            unitIsCaster && actualCasterUnitId === hero.selectionId
          )
        )
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                     <div class="sub-section">
                         <h6>${hero.customName || hero.originalName}</h6>
                         <div class="sub-stats-row">
                             <div class="stat-item">${UI_ICONS.quality} <span>${
        hero.quality
      }+</span></div>
                             <div class="stat-item">${UI_ICONS.defense} <span>${
        hero.defense
      }+</span></div>
                             ${
                               hero.rules.find((r) => r.name === "Tough")
                                 ? `<div class="stat-item">${
                                     UI_ICONS.tough
                                   } <span>${
                                     hero.rules.find((r) => r.name === "Tough")
                                       ?.rating ?? "?"
                                   }</span></div>`
                                 : ""
                             }
                         </div>
                         <div class="info-line small text-muted">
                             <span class="info-item">${hero.cost} pts</span>
                             <span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
                               hero.xp || 0
                             }</span></span>
                             <span class="info-item base-info">${
                               UI_ICONS.base
                             } ${heroBase ? heroBase + "mm" : "N/A"}</span>
                         </div>
                         ${
                           unitIsCaster &&
                           actualCasterUnitId === hero.selectionId
                             ? _createCasterControlsHTML(
                                 casterLevel,
                                 initialTokens
                               )
                             : ""
                         }
                         <div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
                           heroRules || "None"
                         }</span></div>
                         <div class="mt-2 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(
                           hero.loadout,
                           _formatRule
                         )}</div>
                     </div>`;

      const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
      const unitRules = baseUnit.rules
        .map((rule) => _formatRule(rule, false))
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                     <div class="sub-section">
                         <h6>${
                           baseUnit.customName || baseUnit.originalName
                         }</h6>
                         <div class="sub-stats-row">
                              <div class="stat-item">${
                                UI_ICONS.quality
                              } <span>${baseUnit.quality}+</span></div>
                              <div class="stat-item">${
                                UI_ICONS.defense
                              } <span>${baseUnit.defense}+</span></div>
                              ${
                                baseUnit.rules.find((r) => r.name === "Tough")
                                  ? `<div class="stat-item">${
                                      UI_ICONS.tough
                                    } <span>${
                                      baseUnit.rules.find(
                                        (r) => r.name === "Tough"
                                      )?.rating ?? "?"
                                    }</span></div>`
                                  : ""
                              }
                         </div>
                          <div class="info-line small text-muted">
                             <span class="info-item">${baseUnit.cost} pts</span>
                             <span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
                               baseUnit.xp || 0
                             }</span></span>
                             <span class="info-item base-info">${
                               UI_ICONS.base
                             } ${unitBase ? unitBase + "mm" : "N/A"}</span>
                         </div>
                         <div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
                           unitRules || "None"
                         }</span></div>
                         <div class="mt-2 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(
                           baseUnit.loadout,
                           _formatRule
                         )}</div>
                     </div>`;
    } else {
      // --- Normal (Non-Joined) Unit Display ---
      const unitRules = baseUnit.rules
        .map((rule) => _formatRule(rule, unitIsCaster))
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                     <div class="normal-unit-details">
                         ${
                           unitIsCaster
                             ? _createCasterControlsHTML(
                                 casterLevel,
                                 initialTokens
                               )
                             : ""
                         }
                         <div class="mb-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
                           unitRules || "None"
                         }</span></div>
                         <div class="mb-0 flex-grow-1"><strong class="d-block">Weapons:</strong> ${_createWeaponTableHTML(
                           baseUnit.loadout,
                           _formatRule
                         )}</div>
                     </div>`;
    }
    cardBodyContentHTML += `</div>`; // Close details-section

    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    cardBody.innerHTML =
      effectiveStatsHTML +
      actionControlsHTML +
      manualTriggersHTML + // Add manual trigger buttons here
      cardBodyContentHTML +
      modelsHTML;

    cardDiv.innerHTML = cardHeaderHTML;
    cardDiv.appendChild(cardBody);

    colDiv.appendChild(cardDiv);
    displayContainerRow.appendChild(colDiv);
  }); // End forEach unit

  // Apply Initial States AFTER DOM insertion
  requestAnimationFrame(() => {
    initialStatesToApply.forEach(
      ({ unitId, action, isShaken, isFatigued, status }) => {
        updateActionButtonsUI(unitId, action, isShaken);
        updateFatiguedStatusUI(unitId, isFatigued);
        // Shaken indicator updated by updateActionButtonsUI
        if (status === "destroyed") {
          collapseDestroyedCard(unitId);
        } else if (status === "routed") {
          collapseRoutedCard(unitId);
        }
      }
    );
  });
} // End displayArmyUnits

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
