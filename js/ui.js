/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 * Refactored for clarity by breaking down card generation into smaller functions.
 * Added JSDoc comments and inline explanations.
 */

import { config, STAT_ICONS } from "./config.js"; // Configuration constants

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
                     <button type="button" class="btn btn-sm btn-outline-info token-remove-btn" title="Spend Token" ${removeDisabled}><i class="bi bi-dash"></i></button>
                     <span class="token-count-display" title="Spell Tokens">
                         ${STAT_ICONS.tokens}
                         <span class="token-count">${currentTokens} / ${config.MAX_SPELL_TOKENS}</span>
                     </span>
                     <button type="button" class="btn btn-sm btn-outline-info token-add-btn" title="Add Token" ${addDisabled}><i class="bi bi-plus"></i></button>
                 </div>
                 <button type="button" class="btn btn-sm btn-outline-info view-spells-btn" title="View Spells"><i class="bi bi-book"></i> View Spells</button>
             </div>
        </div>
    `;
}

/**
 * Creates the HTML string for the unit card header.
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

  // Meta info (Models, Points, XP, Base Size) - only show XP/Base for non-joined units for simplicity
  let metaHtml = `<span class="info-item">${totalModels} Models</span><span class="info-separator">|</span><span class="info-item">${totalPoints} pts</span>`;
  if (!hero) {
    const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
    metaHtml += `<span class="info-separator">|</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
      baseUnit.xp || 0
    }</span></span>`;
    metaHtml += `<span class="info-separator">|</span><span class="info-item base-info">${
      STAT_ICONS.base
    } ${unitBase ? unitBase + "mm" : "N/A"}</span>`;
  }

  return `
        <div class="card-header bg-body-tertiary">
            <div class="d-flex justify-content-between align-items-start flex-wrap gap-1">
                <div class="unit-card-header-content">
                    <h5 class="mb-0 card-title">${title}</h5>
                    <small class="text-muted d-block">${subtitle}</small>
                    <div class="header-meta-info text-muted mt-1">${metaHtml}</div>
                </div>
            </div>
            <div class="btn-group btn-group-sm header-button-group">
                <button type="button" class="btn btn-outline-danger wound-apply-btn" title="Apply Wound (Auto-Target)"><i class="bi bi-heartbreak"></i></button>
                <button type="button" class="btn btn-outline-secondary wound-reset-btn" title="Reset Wounds"><i class="bi bi-arrow-clockwise"></i></button>
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
                ${STAT_ICONS.quality}<span>${effectiveQuality}+</span>
            </div>
            <div class="stat-item" title="Effective Defense">
                ${STAT_ICONS.defense}<span>${effectiveDefense}+</span>
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
      ? STAT_ICONS.hero
      : model.isTough
      ? STAT_ICONS.tough
      : STAT_ICONS.hero; // Default icon
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
 * @param {string} unitSelectionId - The selectionId of the unit card containing the model. (Used for potential context, though modelId should be unique).
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

// --- Main Display Function ---

/**
 * Displays the army units by creating and appending unit cards to the container.
 * @param {object} processedArmy - The structured army data object from processArmyData.
 * @param {HTMLElement} displayContainerRow - The HTML ROW element to inject the card columns into.
 * @param {object} initialComponentStates - The loaded component states { armyId: { unitId: { tokens: T } } }
 */
function displayArmyUnits(
  processedArmy,
  displayContainerRow,
  initialComponentStates = {}
) {
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

  // Clear previous content (like loading spinners or old cards)
  displayContainerRow.innerHTML = "";

  processedArmy.units.forEach((currentUnit) => {
    // Skip rendering heroes that are joined to another unit (they are rendered as part of the base unit's card)
    if (
      currentUnit.isHero &&
      processedArmy.heroJoinTargets[currentUnit.selectionId]
    ) {
      return;
    }

    // Determine if a hero is joined TO this unit
    let hero = null;
    const joinedHeroId = Object.keys(processedArmy.heroJoinTargets || {}).find(
      (key) => processedArmy.heroJoinTargets[key] === currentUnit.selectionId
    );
    if (joinedHeroId && processedArmy.unitMap[joinedHeroId]) {
      hero = processedArmy.unitMap[joinedHeroId];
    }
    const baseUnit = currentUnit; // The unit being iterated is always the base card unit

    // Determine caster status and initial tokens for the card
    let casterLevel = 0;
    let unitIsCaster = false;
    let actualCasterUnitId = null; // The selectionId of the unit that actually has the Caster rule

    if (hero && hero.casterLevel > 0) {
      casterLevel = hero.casterLevel;
      unitIsCaster = true;
      actualCasterUnitId = hero.selectionId;
    } else if (baseUnit.casterLevel > 0) {
      casterLevel = baseUnit.casterLevel;
      unitIsCaster = true;
      actualCasterUnitId = baseUnit.selectionId;
    }

    // Get initial token count for the actual caster unit
    const initialTokens =
      initialComponentStates[processedArmy.meta.id]?.[actualCasterUnitId]
        ?.tokens ?? 0;

    // --- Create Card Structure ---
    const colDiv = document.createElement("div");
    colDiv.className = "col d-flex"; // Use d-flex on col for equal height cards

    const cardDiv = document.createElement("div");
    cardDiv.id = `unit-card-${baseUnit.selectionId}`; // ID based on the base unit
    cardDiv.dataset.armyId = processedArmy.meta.id;
    cardDiv.dataset.unitId = baseUnit.selectionId; // Store base unit ID for event handling
    cardDiv.className =
      "card unit-card shadow-sm border-secondary-subtle flex-fill"; // flex-fill for equal height

    // --- Generate Card Content using Helpers ---
    const cardHeaderHTML = _createUnitCardHeaderHTML(baseUnit, hero);
    const effectiveStatsHTML = _createEffectiveStatsHTML(baseUnit, hero);
    const modelsHTML = createModelsDisplay(baseUnit, hero); // Use existing function

    // Build Card Body Content
    let cardBodyContentHTML = `<div class="details-section">`;
    if (hero) {
      // --- Joined Unit Display ---
      // Section for Hero
      const heroBase = hero.bases?.round || hero.bases?.square;
      const heroRules = hero.rules
        .map((rule) =>
          _formatRule(
            rule,
            unitIsCaster && actualCasterUnitId === hero.selectionId
          )
        ) // Filter Caster only if hero is the caster
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                <div class="sub-section">
                    <h6>${hero.customName || hero.originalName}</h6>
                    <div class="sub-stats-row">
                        <div class="stat-item">${STAT_ICONS.quality} <span>${
        hero.quality
      }+</span></div>
                        <div class="stat-item">${STAT_ICONS.defense} <span>${
        hero.defense
      }+</span></div>
                        ${
                          hero.rules.find((r) => r.name === "Tough")
                            ? `<div class="stat-item">${
                                STAT_ICONS.tough
                              } <span>${
                                hero.rules.find((r) => r.name === "Tough")
                                  .rating
                              }</span></div>`
                            : ""
                        }
                    </div>
                    <div class="info-line small text-muted">
                        <span class="info-item">${hero.cost} pts</span>
                        <span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
                          hero.xp || 0
                        }</span></span>
                        <span class="info-item base-info">${STAT_ICONS.base} ${
        heroBase ? heroBase + "mm" : "N/A"
      }</span>
                    </div>
                    ${
                      unitIsCaster && actualCasterUnitId === hero.selectionId
                        ? _createCasterControlsHTML(casterLevel, initialTokens)
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

      // Section for Base Unit
      const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
      const unitRules = baseUnit.rules
        .map((rule) => _formatRule(rule, false)) // Never filter Caster for base unit display here
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                <div class="sub-section">
                    <h6>${baseUnit.customName || baseUnit.originalName}</h6>
                    <div class="sub-stats-row">
                         <div class="stat-item">${STAT_ICONS.quality} <span>${
        baseUnit.quality
      }+</span></div>
                         <div class="stat-item">${STAT_ICONS.defense} <span>${
        baseUnit.defense
      }+</span></div>
                         ${
                           baseUnit.rules.find((r) => r.name === "Tough")
                             ? `<div class="stat-item">${
                                 STAT_ICONS.tough
                               } <span>${
                                 baseUnit.rules.find((r) => r.name === "Tough")
                                   .rating
                               }</span></div>`
                             : ""
                         }
                    </div>
                     <div class="info-line small text-muted">
                        <span class="info-item">${baseUnit.cost} pts</span>
                        <span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
                          baseUnit.xp || 0
                        }</span></span>
                        <span class="info-item base-info">${STAT_ICONS.base} ${
        unitBase ? unitBase + "mm" : "N/A"
      }</span>
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
        .map((rule) => _formatRule(rule, unitIsCaster)) // Filter Caster only if this unit is the caster
        .filter(Boolean)
        .sort()
        .join(", ");
      cardBodyContentHTML += `
                <div class="normal-unit-details">
                    ${
                      unitIsCaster
                        ? _createCasterControlsHTML(casterLevel, initialTokens)
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

    // --- Assemble Card Body ---
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    cardBody.innerHTML = effectiveStatsHTML + cardBodyContentHTML + modelsHTML; // Add models grid last

    // --- Append Header and Body to Card ---
    cardDiv.innerHTML = cardHeaderHTML; // Set header HTML
    cardDiv.appendChild(cardBody); // Append body element

    // --- Append Card Column to Row ---
    colDiv.appendChild(cardDiv);
    displayContainerRow.appendChild(colDiv);
  }); // End forEach unit
}

// Export the necessary functions
export { displayArmyUnits, updateModelDisplay, updateTokenDisplay };
