/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 * **MODIFIED:** V15 - Includes Caster UI elements (V4 mockup style).
 * Fixed normal unit stat display. Filtered Caster rule from list.
 * Fixed hero icon bug, refined model naming, added 'mm' to base size.
 * Adjusted font sizes, weapon table styling.
 */

// SVG Icons constant (Added titles for accessibility/tooltips)
const STAT_ICONS = {
  quality: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Quality</title><path style="fill: #ad3e25" d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/><path style="fill: #f9ddb7" d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/></svg>`,
  defense: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Defense</title><path style="fill: #005f83" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/></svg>`,
  tough: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Tough</title><path style="fill: #dc3545" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`,
  hero: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Hero/Model</title><path fill-rule="evenodd" d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`,
  base: `<i class="bi bi-circle-fill stat-icon" title="Base Size"></i>`,
  tokens: `<svg class="token-icon stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>Tokens</title><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.58 5.48l-.386 1.161a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 2.806 4.22l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/></svg>`,
};
import { config } from "./config.js"; // Configuration constants
const MAX_SPELL_TOKENS = config.MAX_SPELL_TOKENS;

/**
 * Creates the HTML for displaying individual models within a unit card.
 * Includes refined model naming logic and hero icon fix.
 * @param {object} unit - The processed unit data for the base unit.
 * @param {object | null} hero - The processed hero data if joined, otherwise null.
 * @returns {string} HTML string for the models section.
 */
function createModelsDisplay(unit, hero = null) {
  const displayModels = hero ? [...hero.models, ...unit.models] : unit.models;
  if (!displayModels || displayModels.length === 0)
    return '<p class="text-muted small">No model data.</p>';

  let modelsHtml = '<div class="unit-models-grid">';
  let toughCounter = 1;
  let modelCounter = 1;

  displayModels.forEach((model) => {
    const isRemoved = model.currentHp <= 0;
    const hpPercentage = (model.currentHp / model.maxHp) * 100;
    let bgColorClass = "bg-success";
    if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
    else if (hpPercentage < 50) bgColorClass = "bg-danger";
    if (isRemoved) bgColorClass = "bg-secondary";

    const isHeroModel = model.isHero;
    // **FIXED ICON LOGIC:** Prioritize Hero icon if model.isHero is true
    const modelIcon = isHeroModel
      ? STAT_ICONS.hero
      : model.isTough
      ? STAT_ICONS.tough
      : STAT_ICONS.hero;
    const heroColorClass = isHeroModel ? "hero-icon-color" : ""; // Color only if hero

    // **REFINED NAMING LOGIC:**
    let modelBaseName;
    const sourceUnit = isHeroModel ? hero || unit : unit; // Get the unit this model belongs to

    if (!sourceUnit) {
      modelBaseName = "Error"; // Safety check
    } else if (isHeroModel) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName; // Hero's name
    } else if (sourceUnit.size === 1 && !hero) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName; // Single-model unit's name
    } else if (model.isTough) {
      modelBaseName = `Tough ${toughCounter++}`; // Tough model in multi-model unit
    } else {
      modelBaseName = `Model ${modelCounter++}`; // Regular model in multi-model unit
    }

    modelsHtml += `
            <div class="model-display clickable-model ${
              isRemoved ? "model-removed" : ""
            } ${isHeroModel ? "hero-model" : ""}" data-model-id="${
      model.modelId
    }" title="Click to apply wound. ${modelBaseName} - HP: ${model.currentHp}/${
      model.maxHp
    }">
                <div class="model-icon ${heroColorClass}">${modelIcon}</div>
                <div class="model-hp-bar-container"><div class="model-hp-bar ${bgColorClass}" style="width: ${
      isRemoved ? 0 : hpPercentage
    }%;"></div></div>
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
 * Updates the visual representation of a single model's HP.
 */
function updateModelDisplay(unitSelectionId, modelId, currentHp, maxHp) {
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (!modelElement) return;
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
  hpBar.className = `model-hp-bar ${bgColorClass}`;
  hpBar.style.width = `${isRemoved ? 0 : hpPercentage}%`;
  hpText.textContent = `${Math.max(0, currentHp)}/${maxHp}`;
  const modelName = modelNameElement ? modelNameElement.textContent : "Model";
  modelElement.title = `Click to apply wound. ${modelName} - HP: ${Math.max(
    0,
    currentHp
  )}/${maxHp}`;
}

/**
 * Creates the HTML for a standard weapon table.
 * Includes striping, centered columns, no AP parens.
 */
function createWeaponTable(loadout, formatRuleFn) {
  if (!loadout || loadout.length === 0) {
    return '<p class="text-muted small mb-0">No weapons listed.</p>';
  }
  const aggregatedWeapons = {};
  loadout.forEach((weapon) => {
    const apRule = (weapon.specialRules || []).find((r) => r.name === "AP");
    const apValue = apRule ? parseInt(apRule.rating, 10) : 0;
    const otherRules = (weapon.specialRules || [])
      .filter((r) => r.name !== "AP")
      .map(formatRuleFn)
      .sort()
      .join(",");
    const weaponKey = `${weapon.name}|${weapon.range || "-"}|${
      weapon.attacks || "-"
    }|${apValue}|${otherRules}`;
    if (aggregatedWeapons[weaponKey]) {
      aggregatedWeapons[weaponKey].count += weapon.count || 1;
    } else {
      aggregatedWeapons[weaponKey] = {
        data: weapon,
        count: weapon.count || 1,
        apValue: !isNaN(apValue) && apValue > 0 ? `${apValue}` : "-",
        otherRulesString: otherRules || "-",
      };
    }
  });
  let tableHtml =
    '<table class="table table-sm table-borderless table-striped mb-0">';
  tableHtml += `<thead><tr><th>Weapon</th><th class="text-center">RNG</th><th class="text-center">ATK</th><th class="text-center">AP</th><th>Special</th></tr></thead><tbody>`;
  Object.values(aggregatedWeapons).forEach((aggWeapon) => {
    const weapon = aggWeapon.data;
    const weaponName = `${aggWeapon.count > 1 ? aggWeapon.count + "x " : ""}${
      weapon.name
    }`;
    tableHtml += `<tr class="align-middle"><td>${weaponName}</td><td class="text-center">${
      weapon.range ? `${weapon.range}"` : "-"
    }</td><td class="text-center">${
      weapon.attacks ? `A${weapon.attacks}` : "-"
    }</td><td class="text-center">${aggWeapon.apValue}</td><td>${
      aggWeapon.otherRulesString
    }</td></tr>`;
  });
  tableHtml += "</tbody></table>";
  return tableHtml;
}

/**
 * Updates the displayed token count and button states for a unit.
 * Uses constant MAX_SPELL_TOKENS.
 * @param {string} unitId - The selectionId of the unit *card* to update.
 * @param {number} currentTokens - The current token count.
 * @param {number} casterLevel - The caster level (X).
 */
function updateTokenDisplay(unitId, currentTokens, casterLevel) {
  const tokenCountElement = document.querySelector(
    `#unit-card-${unitId} .token-count`
  );
  if (tokenCountElement) {
    // Display current / max (always 6)
    tokenCountElement.textContent = `${currentTokens} / ${MAX_SPELL_TOKENS}`;
  }
  const addButton = document.querySelector(
    `#unit-card-${unitId} .token-add-btn`
  );
  const removeButton = document.querySelector(
    `#unit-card-${unitId} .token-remove-btn`
  );

  // Disable buttons based on 0 and MAX_SPELL_TOKENS limit
  if (addButton) addButton.disabled = currentTokens >= MAX_SPELL_TOKENS;
  if (removeButton) removeButton.disabled = currentTokens <= 0;
}

/**
 * Creates the HTML for the caster controls section.
 * Uses constant MAX_SPELL_TOKENS.
 * @param {number} casterLevel - The Caster(X) level.
 * @param {number} initialTokens - The starting token count.
 * @returns {string} HTML string for the caster controls.
 */
function createCasterControls(casterLevel, initialTokens) {
  if (casterLevel <= 0) return "";
  const currentTokens = Math.min(initialTokens, MAX_SPELL_TOKENS); // Ensure initial doesn't exceed max

  return `
        <div class="caster-section">
             <div class="caster-controls">
                 <span class="caster-level-badge me-2">Caster(${casterLevel})</span>
                 <div class="token-controls">
                     <button type="button" class="btn btn-sm btn-outline-info token-remove-btn" title="Spend Token" ${
                       currentTokens <= 0 ? "disabled" : ""
                     }><i class="bi bi-dash"></i></button>
                     <span class="token-count-display" title="Spell Tokens">
                         ${STAT_ICONS.tokens}
                         <span class="token-count">${currentTokens} / ${MAX_SPELL_TOKENS}</span>
                     </span>
                     <button type="button" class="btn btn-sm btn-outline-info token-add-btn" title="Add Token" ${
                       currentTokens >= MAX_SPELL_TOKENS ? "disabled" : ""
                     }><i class="bi bi-plus"></i></button>
                 </div>
                 <button type="button" class="btn btn-sm btn-outline-info view-spells-btn" title="View Spells"><i class="bi bi-book"></i> View Spells</button>
             </div>
        </div>
    `;
}

/**
 * Displays the army units using the V11 layout. Appends columns to the provided container row.
 * @param {object} processedArmy - The structured army data object.
 * @param {HTMLElement} displayContainerRow - The HTML ROW element to inject the card columns into.
 * @param {object} initialComponentStates - The loaded component states { armyId: { unitId: { tokens: T } } }
 */
function displayArmyUnits(
  processedArmy,
  displayContainerRow,
  initialComponentStates = {}
) {
  if (!displayContainerRow) {
    console.error("Display container row not provided.");
    return;
  }
  if (!processedArmy || !processedArmy.units) {
    console.warn("No processed army or units found.");
    return;
  }

  // Helper to format rules (excluding Tough and Caster if UI is present)
  const formatRule = (rule, hasCasterSection) => {
    const baseName = rule.name || rule.label;
    if (rule.name === "Tough") return null; // Filter out Tough rule display
    if (hasCasterSection && rule.name === "Caster") return null; // Filter out Caster if controls are shown

    if (
      rule.rating !== null &&
      rule.rating !== undefined &&
      String(rule.rating).trim().length > 0
    ) {
      return `${baseName}(${rule.rating})`;
    }
    return baseName;
  };

  processedArmy.units.forEach((currentUnit) => {
    let hero = null;
    let baseUnit = null;
    let casterLevel = 0;
    let unitIsCaster = false;
    let actualCasterUnitId = null; // ID of the unit that actually has the Caster rule

    // Determine hero/base unit and caster status
    if (
      currentUnit.isHero &&
      processedArmy.heroJoinTargets[currentUnit.selectionId]
    ) {
      return;
    } // Skip joined heroes
    const joinedHeroId = Object.keys(processedArmy.heroJoinTargets || {}).find(
      (key) => processedArmy.heroJoinTargets[key] === currentUnit.selectionId
    );
    if (joinedHeroId && processedArmy.unitMap[joinedHeroId]) {
      hero = processedArmy.unitMap[joinedHeroId];
      baseUnit = currentUnit;
      // Check if HERO is the caster
      if (hero.casterLevel > 0) {
        // Use pre-calculated casterLevel
        casterLevel = hero.casterLevel;
        unitIsCaster = true;
        actualCasterUnitId = hero.selectionId;
      }
    } else {
      hero = null;
      baseUnit = currentUnit;
      // Check if BASE UNIT is the caster
      if (baseUnit.casterLevel > 0) {
        // Use pre-calculated casterLevel
        casterLevel = baseUnit.casterLevel;
        unitIsCaster = true;
        actualCasterUnitId = baseUnit.selectionId;
      }
    }
    if (!baseUnit) {
      console.error("Could not determine base unit for display:", currentUnit);
      return;
    }

    // Get initial token count for the actual caster unit
    const initialTokens =
      initialComponentStates[processedArmy.meta.id]?.[actualCasterUnitId]
        ?.tokens ?? 0;

    // --- Create Card Structure ---
    const colDiv = document.createElement("div");
    colDiv.className = "col d-flex";
    const cardDiv = document.createElement("div");
    cardDiv.id = `unit-card-${baseUnit.selectionId}`;
    cardDiv.dataset.armyId = processedArmy.meta.id;
    cardDiv.dataset.unitId = baseUnit.selectionId;
    cardDiv.className =
      "card unit-card shadow-sm border-secondary-subtle flex-fill";

    // --- Card Header ---
    const cardHeader = document.createElement("div");
    cardHeader.className = "card-header bg-body-tertiary";
    cardHeader.style.position = "relative";
    const headerFlexContainer = document.createElement("div");
    headerFlexContainer.className =
      "d-flex justify-content-between align-items-start flex-wrap gap-1";
    cardHeader.appendChild(headerFlexContainer);
    const headerContent = document.createElement("div");
    headerContent.className = "unit-card-header-content";
    const cardTitle = document.createElement("h5");
    cardTitle.className = "mb-0 card-title";
    cardTitle.textContent = hero
      ? `${hero.customName || hero.originalName} w/ ${
          baseUnit.customName || baseUnit.originalName
        }`
      : baseUnit.customName || baseUnit.originalName;
    const cardSubtitle = document.createElement("small");
    cardSubtitle.className = "text-muted d-block";
    cardSubtitle.textContent = hero
      ? `${hero.originalName} and ${baseUnit.originalName}`
      : baseUnit.originalName;
    headerContent.appendChild(cardTitle);
    headerContent.appendChild(cardSubtitle);
    // Header Meta Info (includes XP/Base only for normal units now)
    const headerMeta = document.createElement("div");
    headerMeta.className = "header-meta-info text-muted mt-1";
    const totalModels = baseUnit.size + (hero ? hero.size : 0);
    const totalPoints = baseUnit.cost + (hero ? hero.cost : 0);
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
    headerMeta.innerHTML = metaHtml;
    headerContent.appendChild(headerMeta);
    headerFlexContainer.appendChild(headerContent);
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "btn-group btn-group-sm header-button-group";
    buttonGroup.innerHTML = `<button type="button" class="btn btn-outline-danger wound-apply-btn" title="Apply Wound (Auto-Target)"><i class="bi bi-heartbreak"></i></button><button type="button" class="btn btn-outline-secondary wound-reset-btn" title="Reset Wounds"><i class="bi bi-arrow-clockwise"></i></button>`;
    cardHeader.appendChild(buttonGroup);

    // --- Card Body ---
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    // Effective Stats
    const effectiveStatsDiv = document.createElement("div");
    effectiveStatsDiv.className = "effective-stats";
    const effectiveQuality = hero ? hero.quality : baseUnit.quality;
    const effectiveDefense = baseUnit.defense;
    effectiveStatsDiv.innerHTML = `<div class="stat-item" title="Effective Quality (Used for Morale)">${STAT_ICONS.quality}<span>${effectiveQuality}+</span></div><div class="stat-item" title="Effective Defense">${STAT_ICONS.defense}<span>${effectiveDefense}+</span></div>`;
    cardBody.appendChild(effectiveStatsDiv);
    // Details Section
    const detailsSection = document.createElement("div");
    detailsSection.className = "details-section";
    if (hero) {
      // --- Joined Unit Display ---
      const heroSection = document.createElement("div");
      heroSection.className = "sub-section";
      heroSection.innerHTML = `<h6>${
        hero.customName || hero.originalName
      }</h6>`;
      const heroStatsRow = document.createElement("div");
      heroStatsRow.className = "sub-stats-row";
      heroStatsRow.innerHTML = `<div class="stat-item">${
        STAT_ICONS.quality
      } <span>${hero.quality}+</span></div><div class="stat-item">${
        STAT_ICONS.defense
      } <span>${hero.defense}+</span></div>${
        hero.rules.find((r) => r.name === "Tough")
          ? `<div class="stat-item">${STAT_ICONS.tough} <span>${
              hero.rules.find((r) => r.name === "Tough").rating
            }</span></div>`
          : ""
      }`;
      heroSection.appendChild(heroStatsRow);
      const heroInfoLine = document.createElement("div");
      heroInfoLine.className = "info-line small text-muted";
      const heroBase = hero.bases?.round || hero.bases?.square;
      heroInfoLine.innerHTML = `<span class="info-item">${
        hero.cost
      } pts</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
        hero.xp || 0
      }</span></span><span class="info-item base-info">${STAT_ICONS.base} ${
        heroBase ? heroBase + "mm" : "N/A"
      }</span>`;
      heroSection.appendChild(heroInfoLine);
      // Add Caster Controls if Hero is the caster
      if (unitIsCaster && actualCasterUnitId === hero.selectionId) {
        heroSection.innerHTML += createCasterControls(
          casterLevel,
          initialTokens
        );
      }
      const heroRules = hero.rules
        .map((rule) =>
          formatRule(
            rule,
            unitIsCaster && actualCasterUnitId === hero.selectionId
          )
        )
        .filter(Boolean)
        .sort()
        .join(", ");
      heroSection.innerHTML += `<div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
        heroRules || "None"
      }</span></div>`;
      const heroWeaponsDiv = document.createElement("div");
      heroWeaponsDiv.className = "mt-2 flex-grow-1";
      heroWeaponsDiv.innerHTML = `<strong class="d-block">Weapons:</strong> ${createWeaponTable(
        hero.loadout,
        (rule) => formatRule(rule, false)
      )}`;
      heroSection.appendChild(heroWeaponsDiv);
      detailsSection.appendChild(heroSection);

      const unitSection = document.createElement("div");
      unitSection.className = "sub-section";
      unitSection.innerHTML = `<h6>${
        baseUnit.customName || baseUnit.originalName
      }</h6>`;
      const unitStatsRow = document.createElement("div");
      unitStatsRow.className = "sub-stats-row";
      unitStatsRow.innerHTML = `<div class="stat-item">${
        STAT_ICONS.quality
      } <span>${baseUnit.quality}+</span></div><div class="stat-item">${
        STAT_ICONS.defense
      } <span>${baseUnit.defense}+</span></div>${
        baseUnit.rules.find((r) => r.name === "Tough")
          ? `<div class="stat-item">${STAT_ICONS.tough} <span>${
              baseUnit.rules.find((r) => r.name === "Tough").rating
            }</span></div>`
          : ""
      }`;
      unitSection.appendChild(unitStatsRow);
      const unitInfoLine = document.createElement("div");
      unitInfoLine.className = "info-line small text-muted";
      const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
      unitInfoLine.innerHTML = `<span class="info-item">${
        baseUnit.cost
      } pts</span><span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
        baseUnit.xp || 0
      }</span></span><span class="info-item base-info">${STAT_ICONS.base} ${
        unitBase ? unitBase + "mm" : "N/A"
      }</span>`;
      unitSection.appendChild(unitInfoLine);
      const unitRules = baseUnit.rules
        .map((rule) => formatRule(rule, false))
        .filter(Boolean)
        .sort()
        .join(", ");
      unitSection.innerHTML += `<div class="mt-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
        unitRules || "None"
      }</span></div>`;
      const unitWeaponsDiv = document.createElement("div");
      unitWeaponsDiv.className = "mt-2 flex-grow-1";
      unitWeaponsDiv.innerHTML = `<strong class="d-block">Weapons:</strong> ${createWeaponTable(
        baseUnit.loadout,
        (rule) => formatRule(rule, false)
      )}`;
      unitSection.appendChild(unitWeaponsDiv);
      detailsSection.appendChild(unitSection);
    } else {
      // --- Normal Unit Display ---
      const normalDetails = document.createElement("div");
      normalDetails.className = "normal-unit-details";
      // Add Caster Controls if this unit is a caster
      if (unitIsCaster) {
        normalDetails.innerHTML += createCasterControls(
          casterLevel,
          initialTokens
        );
      }
      const unitRules = baseUnit.rules
        .map((rule) => formatRule(rule, unitIsCaster))
        .filter(Boolean)
        .sort()
        .join(", ");
      normalDetails.innerHTML += `<div class="mb-2"><strong class="d-block">Rules:</strong> <span class="text-body-secondary">${
        unitRules || "None"
      }</span></div>`;
      const unitWeaponsDiv = document.createElement("div");
      unitWeaponsDiv.className = "mb-0 flex-grow-1";
      unitWeaponsDiv.innerHTML = `<strong class="d-block">Weapons:</strong> ${createWeaponTable(
        baseUnit.loadout,
        (rule) => formatRule(rule, false)
      )}`;
      normalDetails.appendChild(unitWeaponsDiv);
      detailsSection.appendChild(normalDetails);
    }
    cardBody.appendChild(detailsSection);

    // Model Grid (Append Last)
    const modelsHtml = createModelsDisplay(baseUnit, hero);
    cardBody.insertAdjacentHTML("beforeend", modelsHtml);

    // Assemble Card and Append Column
    cardDiv.appendChild(cardHeader);
    cardDiv.appendChild(cardBody);
    colDiv.appendChild(cardDiv);
    displayContainerRow.appendChild(colDiv); // Append the column to the main row container
  });
}

// Export the function
export { displayArmyUnits, updateModelDisplay, updateTokenDisplay };
