/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 * **MODIFIED:** V12 - Fixed TypeError in model naming logic for standalone heroes.
 * **MODIFIED:** V13 - Adjusted weapon table style (striped, centered cols, no AP parens).
 */

// SVG Icons constant (Added titles for accessibility/tooltips)
const STAT_ICONS = {
  quality: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Quality</title><path style="fill: #ad3e25" d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/><path style="fill: #f9ddb7" d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/></svg>`,
  defense: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Defense</title><path style="fill: #005f83" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/></svg>`,
  tough: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Tough</title><path style="fill: #dc3545" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`,
  hero: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Hero/Model</title><path fill-rule="evenodd" d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`,
  base: `<i class="bi bi-circle-fill stat-icon" title="Base Size"></i>`, // Base icon
};

/**
 * Creates the HTML for displaying individual models within a unit card.
 */
function createModelsDisplay(unit, hero = null) {
  // ... (Function remains the same as V12) ...
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
    const modelIcon = isHeroModel
      ? STAT_ICONS.hero
      : model.isTough
      ? STAT_ICONS.tough
      : STAT_ICONS.hero;
    const heroColorClass = isHeroModel ? "hero-icon-color" : "";
    let modelBaseName;
    const sourceUnit = isHeroModel ? hero || unit : unit;
    if (!sourceUnit) {
      modelBaseName = "Error";
    } else if (isHeroModel) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName;
    } else if (sourceUnit.size === 1 && !hero) {
      modelBaseName = sourceUnit.customName || sourceUnit.originalName;
    } else if (model.isTough) {
      modelBaseName = `Tough ${toughCounter++}`;
    } else {
      modelBaseName = `Model ${modelCounter++}`;
    }
    modelsHtml += `<div class="model-display clickable-model ${
      isRemoved ? "model-removed" : ""
    } ${isHeroModel ? "hero-model" : ""}" data-model-id="${
      model.modelId
    }" title="Click to apply wound. ${modelBaseName} - HP: ${model.currentHp}/${
      model.maxHp
    }"><div class="model-icon ${heroColorClass}">${modelIcon}</div><div class="model-hp-bar-container"><div class="model-hp-bar ${bgColorClass}" style="width: ${
      isRemoved ? 0 : hpPercentage
    }%;"></div></div><div class="model-hp-text small">${model.currentHp}/${
      model.maxHp
    }</div><div class="model-name text-muted text-truncate">${modelBaseName}</div></div>`;
  });
  modelsHtml += "</div>";
  return modelsHtml;
}

/**
 * Updates the visual representation of a single model's HP.
 */
function updateModelDisplay(unitSelectionId, modelId, currentHp, maxHp) {
  // ... (Function remains the same as V12) ...
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
 * **MODIFIED:** Added table-striped, centered columns, removed AP parens.
 * @param {Array} loadout - The array of weapon objects.
 * @param {Function} formatRuleFn - Function to format special rules.
 * @returns {string} HTML string for the weapon table.
 */
function createWeaponTable(loadout, formatRuleFn) {
  if (!loadout || loadout.length === 0) {
    return '<p class="text-muted small mb-0">No weapons listed.</p>';
  }

  // Aggregate weapons
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
        // **MODIFIED:** Removed parentheses around AP value
        apValue: !isNaN(apValue) && apValue > 0 ? `${apValue}` : "-",
        otherRulesString: otherRules || "-",
      };
    }
  });

  // **MODIFIED:** Added table-striped class
  let tableHtml =
    '<table class="table table-sm table-borderless table-striped mb-0">';
  // **MODIFIED:** Added text-center class to relevant headers
  tableHtml += `<thead><tr>
                    <th>Weapon</th>
                    <th class="text-center">RNG</th>
                    <th class="text-center">ATK</th>
                    <th class="text-center">AP</th>
                    <th>Special</th>
                   </tr></thead><tbody>`;
  Object.values(aggregatedWeapons).forEach((aggWeapon) => {
    const weapon = aggWeapon.data;
    const weaponName = `${aggWeapon.count > 1 ? aggWeapon.count + "x " : ""}${
      weapon.name
    }`;
    // **MODIFIED:** Added text-center class to relevant cells
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
 * Displays the army units using the V11 layout. Appends columns to the provided container row.
 */
function displayArmyUnits(processedArmy, displayContainerRow) {
  if (!displayContainerRow) {
    console.error("Display container row not provided.");
    return;
  }
  if (!processedArmy || !processedArmy.units) {
    console.warn("No processed army or units found.");
    return;
  }

  const formatRule = (rule) => {
    /* ... (same as V11) ... */
    const baseName = rule.name || rule.label;
    if (rule.name === "Tough") return null;
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

    // Revised Logic for Hero/Base Unit Determination
    if (
      currentUnit.isHero &&
      processedArmy.heroJoinTargets[currentUnit.selectionId]
    ) {
      return;
    }
    const joinedHeroId = Object.keys(processedArmy.heroJoinTargets).find(
      (key) => processedArmy.heroJoinTargets[key] === currentUnit.selectionId
    );
    if (joinedHeroId && processedArmy.unitMap[joinedHeroId]) {
      hero = processedArmy.unitMap[joinedHeroId];
      baseUnit = currentUnit;
    } else {
      hero = null;
      baseUnit = currentUnit;
    }
    if (!baseUnit) {
      console.error(
        "Critical Error: Could not determine base unit for display:",
        currentUnit
      );
      return;
    }

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
    const headerMeta = document.createElement("div");
    headerMeta.className = "header-meta-info text-muted";
    const totalModels = baseUnit.size + (hero ? hero.size : 0);
    const totalPoints = baseUnit.cost + (hero ? hero.cost : 0);
    headerMeta.innerHTML = `<span>${totalModels} Models</span><span class="info-separator">|</span><span>${totalPoints} pts</span>`;
    headerContent.appendChild(cardTitle);
    headerContent.appendChild(cardSubtitle);
    headerContent.appendChild(headerMeta);
    headerFlexContainer.appendChild(headerContent);
    const buttonGroup = document.createElement("div");
    buttonGroup.className = "btn-group btn-group-sm header-button-group";
    buttonGroup.innerHTML = `<button type="button" class="btn btn-outline-danger wound-apply-btn" title="Apply Wound (Auto-Target)"><i class="bi bi-heartbreak"></i></button><button type="button" class="btn btn-outline-secondary wound-reset-btn" title="Reset Wounds"><i class="bi bi-arrow-clockwise"></i></button>`;
    cardHeader.appendChild(buttonGroup);

    // --- Card Body ---
    const cardBody = document.createElement("div");
    cardBody.className = "card-body"; // No .small

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
      // Joined Unit display
      const heroSection = document.createElement("div");
      heroSection.className = "sub-section";
      heroSection.innerHTML = `<h6>${
        hero.customName || hero.originalName
      }</h6>`;
      const heroStatsRow = document.createElement("div");
      heroStatsRow.className = "sub-stats-row";
      heroStatsRow.innerHTML = `<div class="stat-item" title="Quality">${
        STAT_ICONS.quality
      } <span>${
        hero.quality
      }+</span></div><div class="stat-item" title="Defense">${
        STAT_ICONS.defense
      } <span>${hero.defense}+</span></div>${
        hero.rules.find((r) => r.name === "Tough")
          ? `<div class="stat-item" title="Tough">${STAT_ICONS.tough} <span>${
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
      const heroRules = hero.rules
        .map(formatRule)
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
        formatRule
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
      unitStatsRow.innerHTML = `<div class="stat-item" title="Quality">${
        STAT_ICONS.quality
      } <span>${
        baseUnit.quality
      }+</span></div><div class="stat-item" title="Defense">${
        STAT_ICONS.defense
      } <span>${baseUnit.defense}+</span></div>${
        baseUnit.rules.find((r) => r.name === "Tough")
          ? `<div class="stat-item" title="Tough">${STAT_ICONS.tough} <span>${
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
        .map(formatRule)
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
        formatRule
      )}`;
      unitSection.appendChild(unitWeaponsDiv);
      detailsSection.appendChild(unitSection);
    } else {
      // Normal Unit display
      const normalDetails = document.createElement("div");
      normalDetails.className = "normal-unit-details";
      const unitStatsRow = document.createElement("div");
      unitStatsRow.className = "sub-stats-row";
      unitStatsRow.innerHTML = `<div class="stat-item" title="Quality">${
        STAT_ICONS.quality
      } <span>${
        baseUnit.quality
      }+</span></div><div class="stat-item" title="Defense">${
        STAT_ICONS.defense
      } <span>${baseUnit.defense}+</span></div>${
        baseUnit.rules.find((r) => r.name === "Tough")
          ? `<div class="stat-item" title="Tough">${STAT_ICONS.tough} <span>${
              baseUnit.rules.find((r) => r.name === "Tough").rating
            }</span></div>`
          : ""
      }`;
      normalDetails.appendChild(unitStatsRow);
      const unitInfoLine = document.createElement("div");
      unitInfoLine.className = "info-line small text-muted";
      const unitBase = baseUnit.bases?.round || baseUnit.bases?.square;
      unitInfoLine.innerHTML = `<span class="info-item xp-badge"><span class="badge bg-secondary text-dark-emphasis rounded-pill">XP: ${
        baseUnit.xp || 0
      }</span></span><span class="info-item base-info ms-auto">${
        STAT_ICONS.base
      } ${unitBase ? unitBase + "mm" : "N/A"}</span>`;
      normalDetails.appendChild(unitInfoLine);
      const unitRules = baseUnit.rules
        .map(formatRule)
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
        formatRule
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
    displayContainerRow.appendChild(colDiv);
  });
}

// Export the function
export { displayArmyUnits, updateModelDisplay };
