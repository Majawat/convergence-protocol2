// SVG Icons constant
const STAT_ICONS = {
  quality: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;">
          <path style="fill: #ad3e25" d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/>
          <path style="fill: #f9ddb7" d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/>
      </svg>`,
  defense: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;">
          <path style="fill: #005f83" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/>
      </svg>`,
  tough: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor" width="1em" height="1em" style="vertical-align: -0.125em; margin-right: 0.2em;">
          <path style="fill: #dc3545" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/>
      </svg>`,
};

/**
 * Displays the army units as Bootstrap cards with detailed information.
 * Aggregates identical weapons, uses Bootstrap Icons for bases,
 * Shows XP, hides Tough(1), formats Tough display, uses icons.
 * @param {object} processedArmy - The structured army data object.
 * @param {HTMLElement} displayContainer - The HTML element to inject the cards into.
 */
function displayArmyUnits(processedArmy, displayContainer) {
  if (!displayContainer) {
    console.error(`Display container not provided.`);
    return;
  }
  displayContainer.innerHTML = ""; // Clear container for this army

  // Add Army Title
  const armyTitle = document.createElement("h2");
  armyTitle.className = "mt-4 mb-3 border-bottom pb-2";
  armyTitle.textContent = `${processedArmy.meta.name} (${processedArmy.meta.listPoints} pts)`; // Use actual list points
  displayContainer.appendChild(armyTitle);

  // Create row for unit cards
  const unitRow = document.createElement("div");
  unitRow.className = "row row-cols-1 row-cols-md-2 row-cols-lg-3 g-4";
  displayContainer.appendChild(unitRow);

  if (!processedArmy.units || processedArmy.units.length === 0) {
    unitRow.innerHTML =
      '<p class="text-muted col">No units found in this army list.</p>';
    return;
  }

  // Helper function to format rules
  const formatRule = (rule) => {
    const baseName = rule.name || rule.label;
    if (
      rule.rating !== null &&
      rule.rating !== undefined &&
      String(rule.rating).length > 0
    ) {
      return `${baseName}(${rule.rating})`;
    }
    return baseName;
  };

  // Loop through units
  processedArmy.units.forEach((unit) => {
    const colDiv = document.createElement("div");
    colDiv.className = "col";
    const cardDiv = document.createElement("div");
    cardDiv.id = `unit-card-${unit.selectionId}`;
    cardDiv.className = "card h-100 unit-card shadow-sm";

    // Card Header
    const cardHeader = document.createElement("div");
    cardHeader.className =
      "card-header bg-light d-flex justify-content-between align-items-center";
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
    const pointsBadge = document.createElement("span");
    pointsBadge.className = "badge bg-primary rounded-pill points-badge fs-6";
    pointsBadge.textContent = `${unit.cost} pts`;
    cardHeader.appendChild(headerTextDiv);
    cardHeader.appendChild(pointsBadge);

    // Card Body
    const cardBody = document.createElement("div");
    cardBody.className = "card-body small";

    // Stats Row
    const statsRow = document.createElement("div");
    statsRow.className = "row mb-2 text-center";
    const createStatCol = (iconHtml, value, label = "") => {
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
    const toughness = unit.models.length > 0 ? unit.models[0].maxHp : 1;
    if (toughness > 1) {
      // Only display if Toughness > 1
      statsRow.appendChild(
        createStatCol(STAT_ICONS.tough || "Tough", `${toughness}`, "Tough")
      ); // No parentheses
    }
    statsRow.appendChild(createStatCol(null, unit.size, "Models"));
    statsRow.appendChild(createStatCol(null, unit.xp, "XP"));
    cardBody.appendChild(statsRow);

    // Base Size
    if (unit.bases) {
      const baseSizeDiv = document.createElement("div");
      baseSizeDiv.className = "mb-2 text-muted text-center small";
      let baseHtml = "";
      if (unit.bases.round) {
        // Use Bootstrap Icons
        baseHtml += `<i class="bi bi-circle-fill"></i> ${unit.bases.round}${
          unit.bases.round.includes("mm") ? "" : "mm"
        }`;
      }
      if (unit.bases.square) {
        // Use Bootstrap Icons
        baseHtml +=
          (baseHtml ? " | " : "") +
          `<i class="bi bi-square-fill"></i> ${unit.bases.square}${
            unit.bases.square.includes("mm") ? "" : "mm"
          }`;
      }
      baseSizeDiv.innerHTML = `Base: ${baseHtml || "N/A"}`;
      cardBody.appendChild(baseSizeDiv);
    }

    // Rules Section
    if (unit.rules && unit.rules.length > 0) {
      const rulesDiv = document.createElement("div");
      rulesDiv.className = "mb-2";
      rulesDiv.innerHTML = `<strong class="d-block border-bottom mb-1 pb-1">Rules:</strong>`;
      const rulesList = document.createElement("span");
      rulesList.className = "text-muted";
      rulesList.textContent = unit.rules
        .filter((rule) => rule.name !== "Tough")
        .map(formatRule)
        .sort()
        .join(", ");
      rulesDiv.appendChild(rulesList);
      cardBody.appendChild(rulesDiv);
    }

    // Weapons Section (with Aggregation)
    if (unit.loadout && unit.loadout.length > 0) {
      const weaponsDiv = document.createElement("div");
      weaponsDiv.className = "mb-2";
      weaponsDiv.innerHTML = `<strong class="d-block border-bottom mb-1 pb-1">Weapons:</strong>`;
      const table = document.createElement("table");
      table.className = "table table-sm table-borderless mb-0";
      const thead = table.createTHead();
      const headerRow = thead.insertRow();
      const headers = ["Weapon", "RNG", "ATK", "AP", "Special"];
      headers.forEach((text) => {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = text;
        th.className = "py-0";
        if (["RNG", "ATK", "AP"].includes(text)) th.style.textAlign = "center";
        if (text === "Weapon") th.style.width = "40%";
        headerRow.appendChild(th);
      });
      const tbody = table.createTBody();

      // Weapon Aggregation Logic
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
            apValue: !isNaN(apValue) && apValue > 0 ? apValue : "-",
            otherRulesString: otherRules || "-",
          };
        }
      });

      // Build table rows from aggregated weapons
      Object.values(aggregatedWeapons).forEach((aggWeapon) => {
        const weapon = aggWeapon.data;
        const row = tbody.insertRow();
        row.className = "align-middle";
        const weaponName = `${
          aggWeapon.count > 1 ? aggWeapon.count + "x " : ""
        }${weapon.name}`; // Use .name
        row.insertCell().textContent = weaponName;
        const rangeCell = row.insertCell();
        rangeCell.textContent = weapon.range ? `${weapon.range}"` : "-";
        rangeCell.style.textAlign = "center";
        const attacksCell = row.insertCell();
        attacksCell.textContent = weapon.attacks ? `A${weapon.attacks}` : "-";
        attacksCell.style.textAlign = "center";
        const apCell = row.insertCell();
        apCell.textContent = aggWeapon.apValue;
        apCell.style.textAlign = "center"; // Use precalc AP value ('-' or number)
        row.insertCell().textContent = aggWeapon.otherRulesString;
      });

      weaponsDiv.appendChild(table);
      cardBody.appendChild(weaponsDiv);
    }

    // Items/Upgrades Section
    if (unit.items && unit.items.length > 0) {
      const itemsDiv = document.createElement("div");
      itemsDiv.className = "mb-0";
      itemsDiv.innerHTML = `<strong class="d-block border-bottom mb-1 pb-1">Upgrades/Items:</strong>`;
      const itemList = document.createElement("ul");
      itemList.className = "list-unstyled mb-0";
      unit.items.forEach((item) => {
        const li = document.createElement("li");
        li.className = "mb-1";
        let itemText = `<strong>${item.name}${
          item.count > 1 ? ` (x${item.count})` : ""
        }</strong>`; // Use .name
        const contentRules = (item.content || [])
          .map(formatRule)
          .sort()
          .join(", ");
        if (contentRules)
          itemText += `: <span class="text-muted">${contentRules}</span>`;
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
    unitRow.appendChild(colDiv); // Add card column to the unit row for this army
  });
}

// Export the function and constants to make them available for import
export { displayArmyUnits, STAT_ICONS };
