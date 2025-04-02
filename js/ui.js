/**
 * @fileoverview Handles displaying army data and UI elements for interaction.
 */

// SVG Icons constant
// **MODIFIED:** Replaced 'model' icon with 'hero' icon.
const STAT_ICONS = {
  quality: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;">
            <path style="fill: #ad3e25" d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/>
            <path style="fill: #f9ddb7" d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/>
        </svg>`,
  defense: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;">
            <path style="fill: #005f83" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/>
        </svg>`,
  tough: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;" title="Tough Model">
            <path style="fill: #dc3545" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/>
        </svg>`, // Heart icon for Tough
  hero: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;" title="Hero/Model">
           <path fill-rule="evenodd" d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/>
         </svg>`, // User icon for Hero AND Regular models
  // Removed the old 'model' icon
};

/**
 * Creates the HTML for displaying individual models within a unit card.
 * **MODIFIED:** Uses Hero icon for non-Tough, Tough icon for Tough.
 * @param {object} unit - The processed unit data.
 * @returns {string} HTML string for the models section.
 */
function createModelsDisplay(unit) {
  if (!unit.models || unit.models.length === 0) {
    return '<p class="text-muted small">No model data available.</p>';
  }

  let modelsHtml =
    '<div class="unit-models-grid mt-2 pt-2 border-top border-secondary-subtle">'; // Grid container

  unit.models.forEach((model, index) => {
    const isRemoved = model.currentHp <= 0;
    const hpPercentage = (model.currentHp / model.maxHp) * 100;
    let bgColorClass = "bg-success"; // Full HP
    if (hpPercentage < 75 && hpPercentage >= 50) bgColorClass = "bg-warning";
    else if (hpPercentage < 50) bgColorClass = "bg-danger";
    if (isRemoved) bgColorClass = "bg-secondary";

    // Use Tough icon if model.isTough, otherwise use Hero icon
    const modelTypeIcon = model.isTough ? STAT_ICONS.tough : STAT_ICONS.hero;
    const modelTypeText = model.isHero
      ? "Hero"
      : model.isTough
      ? "Tough"
      : "Model"; // Keep title text descriptive

    modelsHtml += `
            <div class="model-display clickable-model ${
              isRemoved ? "model-removed" : ""
            }" data-model-id="${
      model.modelId
    }" title="Click to apply wound. ${modelTypeText} ${index + 1} - HP: ${
      model.currentHp
    }/${model.maxHp}">
                <div class="model-icon">${modelTypeIcon}</div>
                <div class="model-hp-bar-container">
                    <div class="model-hp-bar ${bgColorClass}" style="width: ${
      isRemoved ? 0 : hpPercentage
    }%;"></div>
                </div>
                <div class="model-hp-text small">${model.currentHp}/${
      model.maxHp
    }</div>
            </div>
        `;
  });

  modelsHtml += "</div>"; // Close grid container
  return modelsHtml;
}

/**
 * Updates the visual representation of a single model's HP.
 * @param {string} unitSelectionId - The selectionId of the unit.
 * @param {string} modelId - The ID of the model to update.
 * @param {number} currentHp - The model's current HP.
 * @param {number} maxHp - The model's max HP.
 */
function updateModelDisplay(unitSelectionId, modelId, currentHp, maxHp) {
  const modelElement = document.querySelector(
    `#unit-card-${unitSelectionId} [data-model-id="${modelId}"]`
  );
  if (!modelElement) return;

  const hpBar = modelElement.querySelector(".model-hp-bar");
  const hpText = modelElement.querySelector(".model-hp-text");

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

  // Update title attribute for tooltip
  const modelIconElement = modelElement.querySelector(".model-icon svg");
  const modelType = modelIconElement
    ? modelIconElement.getAttribute("title") || "Model"
    : "Model"; // Title now comes from SVG
  const modelIndex =
    Array.from(modelElement.parentNode.children).indexOf(modelElement) + 1;
  modelElement.title = `Click to apply wound. ${modelType} ${modelIndex} - HP: ${Math.max(
    0,
    currentHp
  )}/${maxHp}`;
}

/**
 * Displays the army units as Bootstrap cards with detailed information and wound tracking.
 * **MODIFIED:** Removed Heal button. Updated Wound button title.
 * @param {object} processedArmy - The structured army data object.
 * @param {HTMLElement} displayContainer - The HTML element to inject the cards into.
 */
function displayArmyUnits(processedArmy, displayContainer) {
  if (!displayContainer) {
    /* ... error handling ... */ return;
  }
  displayContainer.innerHTML = "";

  const armyTitle = document.createElement("h2");
  armyTitle.className =
    "mt-4 mb-3 border-bottom pb-2 d-flex justify-content-between align-items-center";
  armyTitle.textContent = `${processedArmy.meta.name} (${processedArmy.meta.listPoints} pts)`;
  displayContainer.appendChild(armyTitle);

  const unitRow = document.createElement("div");
  unitRow.className = "row row-cols-1 row-cols-md-2 row-cols-xl-3 g-4";
  displayContainer.appendChild(unitRow);

  if (!processedArmy.units || processedArmy.units.length === 0) {
    /* ... no units message ... */ return;
  }

  const formatRule = (rule) => {
    /* ... (same as before) ... */
    const baseName = rule.name || rule.label;
    if (
      rule.rating !== null &&
      rule.rating !== undefined &&
      String(rule.rating).trim().length > 0
    ) {
      if (rule.name === "Tough") {
        return baseName;
      }
      return `${baseName}(${rule.rating})`;
    }
    return baseName;
  };

  processedArmy.units.forEach((unit) => {
    const colDiv = document.createElement("div");
    colDiv.className = "col d-flex";
    const cardDiv = document.createElement("div");
    cardDiv.id = `unit-card-${unit.selectionId}`;
    cardDiv.dataset.armyId = processedArmy.meta.id;
    cardDiv.dataset.unitId = unit.selectionId;
    cardDiv.className =
      "card unit-card shadow-sm border-secondary-subtle flex-fill";

    // --- Card Header ---
    const cardHeader = document.createElement("div");
    cardHeader.className =
      "card-header bg-body-tertiary d-flex justify-content-between align-items-center flex-wrap gap-2";
    const headerTextDiv = document.createElement("div");
    const cardTitle = document.createElement("h5");
    cardTitle.className = "mb-0 card-title";
    cardTitle.textContent = unit.customName || unit.originalName;
    const cardSubtitle = document.createElement("small");
    cardSubtitle.className = "text-muted d-block";
    if (unit.customName && unit.customName !== unit.originalName) {
      cardSubtitle.textContent = unit.originalName;
    } else {
      cardSubtitle.textContent = `ID: ${unit.selectionId}`;
    }
    headerTextDiv.appendChild(cardTitle);
    headerTextDiv.appendChild(cardSubtitle);

    const headerControlsDiv = document.createElement("div");
    headerControlsDiv.className = "d-flex align-items-center gap-2";
    const pointsBadge = document.createElement("span");
    pointsBadge.className = "badge bg-primary rounded-pill points-badge fs-6";
    pointsBadge.textContent = `${unit.cost} pts`;

    // Wound Buttons (Heal button removed)
    const woundBtnGroup = document.createElement("div");
    woundBtnGroup.className = "btn-group btn-group-sm";
    woundBtnGroup.setAttribute("role", "group");
    woundBtnGroup.ariaLabel = "Wound controls";

    const woundButton = document.createElement("button");
    woundButton.type = "button";
    woundButton.className = "btn btn-outline-danger wound-apply-btn";
    woundButton.innerHTML = '<i class="bi bi-heartbreak"></i>';
    woundButton.title = "Apply Wound (Auto-Target)"; // Updated title

    const resetButton = document.createElement("button");
    resetButton.type = "button";
    resetButton.className = "btn btn-outline-secondary wound-reset-btn";
    resetButton.innerHTML = '<i class="bi bi-arrow-clockwise"></i>';
    resetButton.title = "Reset Wounds";

    // Removed healButton append
    woundBtnGroup.appendChild(woundButton);
    woundBtnGroup.appendChild(resetButton);
    headerControlsDiv.appendChild(pointsBadge);
    headerControlsDiv.appendChild(woundBtnGroup);
    cardHeader.appendChild(headerTextDiv);
    cardHeader.appendChild(headerControlsDiv);

    // --- Card Body ---
    const cardBody = document.createElement("div");
    cardBody.className = "card-body small d-flex flex-column";

    // Stats Row
    const statsRow = document.createElement("div");
    statsRow.className = "row mb-2 text-center";
    const createStatCol = (iconHtml, value, label = "") => {
      /* ... (same as before) ... */
      const col = document.createElement("div");
      col.className = "col";
      let content = "";
      if (iconHtml)
        content += `<div class="stat-icon-wrapper d-inline-block" title="${label}">${iconHtml}</div>`;
      else if (label) content += `<div class="fw-bold">${label}</div>`;
      content += `<div class="d-inline-block ps-1">${value}</div>`;
      col.innerHTML = content;
      return col;
    };
    statsRow.appendChild(
      createStatCol(STAT_ICONS.quality || "Qua", `${unit.quality}+`, "Quality")
    );
    statsRow.appendChild(
      createStatCol(STAT_ICONS.defense || "Def", `${unit.defense}+`, "Defense")
    );
    // Use Hero icon for model count now
    statsRow.appendChild(
      createStatCol(STAT_ICONS.hero || "Models", unit.size, "Models")
    );
    statsRow.appendChild(createStatCol(null, unit.xp, "XP"));
    cardBody.appendChild(statsRow);

    // Base Size
    if (unit.bases) {
      /* ... (same as before) ... */
      const baseSizeDiv = document.createElement("div");
      baseSizeDiv.className = "mb-2 text-muted text-center small";
      let baseHtml = "";
      if (unit.bases.round) {
        baseHtml += `<i class="bi bi-circle-fill"></i> ${unit.bases.round}${
          unit.bases.round.includes("mm") ? "" : "mm"
        }`;
      }
      if (unit.bases.square) {
        baseHtml +=
          (baseHtml ? " | " : "") +
          `<i class="bi bi-square-fill"></i> ${unit.bases.square}${
            unit.bases.square.includes("mm") ? "" : "mm"
          }`;
      }
      baseSizeDiv.innerHTML = `Base: ${baseHtml || "N/A"}`;
      cardBody.appendChild(baseSizeDiv);
    }

    // Models Display (Wound Tracking UI)
    cardBody.innerHTML += createModelsDisplay(unit); // Function now uses updated icons

    // Rules Section
    if (unit.rules && unit.rules.length > 0) {
      /* ... (same as before) ... */
      const rulesDiv = document.createElement("div");
      rulesDiv.className = "mb-2 mt-auto";
      rulesDiv.innerHTML = `<strong class="d-block border-bottom border-secondary-subtle mb-1 pb-1">Rules:</strong>`;
      const rulesList = document.createElement("span");
      rulesList.className = "text-body-secondary";
      const rulesForDisplay = unit.rules.filter(
        (rule) => rule.name !== "Tough"
      );
      rulesList.textContent = rulesForDisplay
        .map(formatRule)
        .sort()
        .filter((value, index, self) => self.indexOf(value) === index)
        .join(", ");
      rulesDiv.appendChild(rulesList);
      cardBody.appendChild(rulesDiv);
    }

    // Weapons Section
    if (unit.loadout && unit.loadout.length > 0) {
      /* ... (same as before) ... */
      const weaponsDiv = document.createElement("div");
      weaponsDiv.className = "mb-2 mt-auto";
      weaponsDiv.innerHTML = `<strong class="d-block border-bottom border-secondary-subtle mb-1 pb-1">Weapons:</strong>`;
      const table = document.createElement("table");
      table.className = "table table-sm table-borderless mb-0";
      const thead = table.createTHead();
      const headerRow = thead.insertRow();
      const headers = ["Weapon", "RNG", "ATK", "AP", "Special"];
      headers.forEach((text) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = text;
        th.className = "py-0 fw-semibold";
        if (["RNG", "ATK", "AP"].includes(text)) th.style.textAlign = "center";
        if (text === "Weapon") th.style.width = "40%";
        headerRow.appendChild(th);
      });
      const tbody = table.createTBody();
      const aggregatedWeapons = {};
      unit.loadout.forEach((weapon) => {
        const apRule = (weapon.specialRules || []).find((r) => r.name === "AP");
        const apValue = apRule ? parseInt(apRule.rating, 10) : 0;
        const otherRules = (weapon.specialRules || [])
          .filter((r) => r.name !== "AP")
          .map(formatRule)
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
            apValue: !isNaN(apValue) && apValue > 0 ? `(${apValue})` : "-",
            otherRulesString: otherRules || "-",
          };
        }
      });
      Object.values(aggregatedWeapons).forEach((aggWeapon) => {
        const weapon = aggWeapon.data;
        const row = tbody.insertRow();
        row.className = "align-middle";
        const weaponName = `${
          aggWeapon.count > 1 ? aggWeapon.count + "x " : ""
        }${weapon.name}`;
        row.insertCell().textContent = weaponName;
        const rangeCell = row.insertCell();
        rangeCell.textContent = weapon.range ? `${weapon.range}"` : "-";
        rangeCell.style.textAlign = "center";
        const attacksCell = row.insertCell();
        attacksCell.textContent = weapon.attacks ? `A${weapon.attacks}` : "-";
        attacksCell.style.textAlign = "center";
        const apCell = row.insertCell();
        apCell.textContent = aggWeapon.apValue;
        apCell.style.textAlign = "center";
        row.insertCell().textContent = aggWeapon.otherRulesString;
      });
      weaponsDiv.appendChild(table);
      cardBody.appendChild(weaponsDiv);
    }

    // Items/Upgrades Section
    if (unit.items && unit.items.length > 0) {
      /* ... (same as before) ... */
      const itemsDiv = document.createElement("div");
      itemsDiv.className = "mb-0 mt-auto";
      itemsDiv.innerHTML = `<strong class="d-block border-bottom border-secondary-subtle mb-1 pb-1">Upgrades/Items:</strong>`;
      const itemList = document.createElement("ul");
      itemList.className = "list-unstyled mb-0 ps-2";
      unit.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "mb-1";
        let itemText = `<span class="fw-semibold">${
          item.count > 1 ? item.count + "x " : ""
        }${item.name}</span>`;
        const contentRules = (item.content || [])
          .map(formatRule)
          .sort()
          .join(", ");
        if (contentRules)
          itemText += `: <span class="text-body-secondary">${contentRules}</span>`;
        li.innerHTML = itemText;
        itemList.appendChild(li);
      });
      itemsDiv.appendChild(itemList);
      cardBody.appendChild(itemsDiv);
    }

    // Assemble Card
    cardDiv.appendChild(cardHeader);
    cardDiv.appendChild(cardBody);
    colDiv.appendChild(cardDiv);
    unitRow.appendChild(colDiv);
  });
}

// Export the functions and constants
export { displayArmyUnits, updateModelDisplay, STAT_ICONS };
