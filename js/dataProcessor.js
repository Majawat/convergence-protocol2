/**
 * Processes the raw army data from the Army Forge API into a structured format.
 * **MODIFIED:** Added heuristic for Additive vs Replacement Toughness upgrades.
 * @param {object} rawData - The raw JSON object returned by the API.
 * @returns {object|null} A structured object representing the army list, or null if data is invalid.
 */
function processArmyData(rawData) {
  // Basic validation
  if (!rawData || !rawData.units) {
    console.error("Invalid raw data provided for processing.");
    return null;
  }

  // Initialize army object
  const processedArmy = {
    meta: {
      /* ... */
    }, // Metadata as before
    units: [],
    heroJoinTargets: {},
    unitMap: {},
  };
  processedArmy.meta = {
    id: rawData.id,
    key: rawData.key,
    name: rawData.name || "Unnamed Army",
    gameSystem: rawData.gameSystem,
    pointsLimit: rawData.pointsLimit || 0,
    listPoints: rawData.listPoints || 0,
    activationCount: rawData.activationCount || 0,
    modelCount: rawData.modelCount || 0,
    description: rawData.description || "",
    rawSpecialRules: rawData.specialRules || [],
    cloudModified: rawData.cloudModified,
    modified: rawData.modified,
  };

  const tempProcessedUnits = {};
  const combinedUnitIds = new Set();

  // --- Step 1: Initial Processing & Upgrade Application ---
  rawData.units.forEach((rawUnit) => {
    const initialBaseDefense = parseInt(rawUnit.defense, 10) || 0;
    // Find base Toughness value
    let baseToughValue = 1;
    const baseToughRule = (rawUnit.rules || []).find(
      (rule) => rule.name === "Tough"
    );
    if (baseToughRule && baseToughRule.rating) {
      const parsedTough = parseInt(baseToughRule.rating, 10);
      if (!isNaN(parsedTough)) baseToughValue = parsedTough;
    }

    const processedUnit = {
      id: rawUnit.id,
      selectionId: rawUnit.selectionId,
      originalName: rawUnit.name,
      customName: rawUnit.customName || rawUnit.name,
      cost: rawUnit.cost || 0,
      size: rawUnit.size || 1,
      defense: initialBaseDefense,
      quality: rawUnit.quality || 0,
      rules: (rawUnit.rules || []).map((rule) => ({ ...rule })),
      items: (rawUnit.items || []).map((item) => ({ ...item })),
      bases: rawUnit.bases ? { ...rawUnit.bases } : null,
      xp: rawUnit.xp || 0,
      notes: rawUnit.notes || null,
      traits: rawUnit.traits || [],
      loadout: [],
      models: [],
      isHero: false,
      canJoinUnitId: null,
      isCombined: rawUnit.combined || false,
      joinToUnitId: rawUnit.joinToUnit || null,
      // Store upgrades that grant Toughness for per-model assignment
      toughnessUpgrades: [], // Format: { optionUid: string, count: N, toughValue: T }
    };

    // --- Stat Accumulation Setup ---
    let finalQuality = processedUnit.quality;
    let finalDefense = processedUnit.defense;
    let defenseModifiedByUpgrade = false;

    const addedRuleIdentifiers = new Set(
      processedUnit.rules.map((r) => r.id || r.label || r.name)
    );
    const addedItemIdentifiers = new Set(
      processedUnit.items.map((i) => i.id || i.label || i.name)
    );
    const statProcessedRuleInstances = new Set();
    const toughUpgradeOptionCounts = {};

    // --- Pass 1: Process selectedUpgrades ---
    (rawUnit.selectedUpgrades || []).forEach((selectedUpgrade) => {
      const option = selectedUpgrade.option;
      const upgradeInfo = selectedUpgrade.upgrade;
      if (!option) return;

      // 1a. Add Cost
      const upgradeCostEntry = (option.costs || []).find(
        (c) => c.unitId === processedUnit.id
      );
      if (upgradeCostEntry?.cost)
        processedUnit.cost += parseInt(upgradeCostEntry.cost, 10) || 0;
      else if (option.cost)
        processedUnit.cost += parseInt(option.cost, 10) || 0;

      if (!option.gains) return;

      // 1b. Process Gains
      let optionGrantsTough = false;
      let optionToughValue = 0;

      option.gains.forEach((gain) => {
        const gainInstanceKey = `upg_${selectedUpgrade.instanceId}_opt_${
          option.uid
        }_gain_${gain.name || gain.label}`;

        const processGainedRule = (rule, instanceKey) => {
          const ruleIdentifier = rule.id || rule.label || rule.name;
          if (!addedRuleIdentifiers.has(ruleIdentifier)) {
            processedUnit.rules.push({ ...rule });
            addedRuleIdentifiers.add(ruleIdentifier);
          }
          if (!statProcessedRuleInstances.has(instanceKey)) {
            const ratingValue = parseInt(rule.rating, 10);
            if (rule.name === "Tough" && !isNaN(ratingValue)) {
              optionGrantsTough = true; // Flag that this option grants Tough
              optionToughValue = ratingValue; // Store the value
              statProcessedRuleInstances.add(instanceKey);
              // Note: Actual Tough calculation deferred to model creation
            } else if (
              rule.name === "Defense" &&
              !isNaN(ratingValue) &&
              !defenseModifiedByUpgrade
            ) {
              finalDefense = Math.max(2, initialBaseDefense - ratingValue);
              defenseModifiedByUpgrade = true;
              statProcessedRuleInstances.add(instanceKey);
            } else if (rule.name === "Quality" && !isNaN(ratingValue)) {
              finalQuality = ratingValue;
              statProcessedRuleInstances.add(instanceKey);
            }
          }
        }; // End processGainedRule

        if (gain.type === "ArmyBookItem") {
          const itemIdentifier = gain.id || gain.label || gain.name;
          if (gain.bases) processedUnit.bases = { ...gain.bases };
          if (!addedItemIdentifiers.has(itemIdentifier)) {
            const newItem = {
              /* ... create item ... */
            };
            newItem.id = gain.id;
            newItem.name = gain.name;
            newItem.label = gain.label;
            newItem.count = gain.count || 1;
            newItem.content = (gain.content || []).map((rule) => ({ ...rule }));
            newItem.bases = gain.bases ? { ...gain.bases } : null;
            processedUnit.items.push(newItem);
            addedItemIdentifiers.add(itemIdentifier);
            newItem.content.forEach((rule, idx) =>
              processGainedRule(rule, `${gainInstanceKey}_content_${idx}`)
            );
          } else {
            const existingItem = processedUnit.items.find(
              (i) => (i.id || i.label || i.name) === itemIdentifier
            );
            if (existingItem) {
              (gain.content || []).forEach((rule, idx) =>
                processGainedRule(rule, `${gainInstanceKey}_content_${idx}`)
              );
            }
          }
        } else if (gain.type === "ArmyBookRule") {
          processGainedRule(gain, gainInstanceKey);
        }
      }); // End loop through gains

      if (optionGrantsTough) {
        toughUpgradeOptionCounts[option.uid] =
          (toughUpgradeOptionCounts[option.uid] || 0) + 1;
        if (
          !processedUnit.toughnessUpgrades.some(
            (upg) => upg.optionUid === option.uid
          )
        ) {
          processedUnit.toughnessUpgrades.push({
            optionUid: option.uid,
            count: 0,
            toughValue: optionToughValue,
          });
        }
      }
    }); // End loop through selectedUpgrades

    processedUnit.toughnessUpgrades.forEach((upg) => {
      upg.count = toughUpgradeOptionCounts[upg.optionUid] || 0;
    });

    // --- Pass 2: Process rawUnit.loadout ---
    const finalLoadoutWeapons = [];
    const finalLoadoutItems = [...processedUnit.items];
    const finalLoadoutItemIdentifiers = new Set(
      processedUnit.items.map((i) => i.id || i.label || i.name)
    );

    (rawUnit.loadout || []).forEach((loadoutItem) => {
      if (loadoutItem.type === "ArmyBookWeapon") {
        finalLoadoutWeapons.push({
          ...loadoutItem,
          specialRules: (loadoutItem.specialRules || []).map((r) => ({ ...r })),
        });
      } else if (loadoutItem.type === "ArmyBookItem") {
        const itemIdentifier =
          loadoutItem.id || loadoutItem.label || loadoutItem.name;
        if (loadoutItem.bases) processedUnit.bases = { ...loadoutItem.bases };
        let existingItem = finalLoadoutItems.find(
          (i) => (i.id || i.label || i.name) === itemIdentifier
        );
        if (!existingItem) {
          existingItem = {
            ...loadoutItem,
            content: (loadoutItem.content || []).map((r) => ({ ...r })),
          };
          finalLoadoutItems.push(existingItem);
          finalLoadoutItemIdentifiers.add(itemIdentifier);
        }
        // Process content rules from loadout item instance, only adding new rules
        (loadoutItem.content || []).forEach((contentItem) => {
          if (contentItem.type === "ArmyBookWeapon") {
            finalLoadoutWeapons.push({
              ...contentItem,
              specialRules: (contentItem.specialRules || []).map((r) => ({
                ...r,
              })),
            });
          } else if (contentItem.type === "ArmyBookRule") {
            const ruleIdentifier =
              contentItem.id || contentItem.label || contentItem.name;
            if (!addedRuleIdentifiers.has(ruleIdentifier)) {
              processedUnit.rules.push({ ...contentItem });
              addedRuleIdentifiers.add(ruleIdentifier);
            }
            // DO NOT ADJUST STATS HERE IN PASS 2
          }
        });
      }
    });
    processedUnit.loadout = finalLoadoutWeapons;
    processedUnit.items = finalLoadoutItems;

    // --- Finalize Stats & Create Models ---
    processedUnit.quality = finalQuality;
    processedUnit.defense = finalDefense;

    // Populate Models Array with potentially varying Toughness
    const models = [];
    const totalToughModelsNeeded = processedUnit.toughnessUpgrades.reduce(
      (sum, upg) => sum + upg.count,
      0
    );
    // Use the first upgrade's tough value as the representative one for assignment (heuristic)
    const upgradeToughValue =
      processedUnit.toughnessUpgrades.length > 0
        ? processedUnit.toughnessUpgrades[0].toughValue
        : baseToughValue;

    console.log(
      `Unit ${processedUnit.selectionId}: BaseTough=${baseToughValue}, Needs ${totalToughModelsNeeded} models with Tough modification (value: ${upgradeToughValue})`
    );

    for (let i = 0; i < processedUnit.size; i++) {
      let modelMaxHp = baseToughValue; // Default to base

      // Assign upgraded Tough to the first N models
      if (i < totalToughModelsNeeded) {
        // **** HEURISTIC for Additive vs Replacement ****
        if (
          processedUnit.size === 1 &&
          processedUnit.toughnessUpgrades.length > 0
        ) {
          // Single model unit: Assume additive (Mounts, etc.)
          // Sum base + all Tough upgrades found (take first value as representative)
          modelMaxHp = baseToughValue + upgradeToughValue;
          console.log(
            `Unit ${processedUnit.selectionId}: Model index ${i} (single model unit) applying ADDITIVE Tough: ${baseToughValue} + ${upgradeToughValue} = ${modelMaxHp}`
          );
        } else {
          // Multi-model unit: Assume replacement (Weapon Teams, etc.)
          modelMaxHp = upgradeToughValue;
          console.log(
            `Unit ${processedUnit.selectionId}: Model index ${i} (multi-model unit) applying REPLACEMENT Tough: ${modelMaxHp}`
          );
        }
      } else {
        // This model gets base toughness
        modelMaxHp = baseToughValue;
        // console.log(`Unit ${processedUnit.selectionId}: Model index ${i} gets base Tough: ${modelMaxHp}`);
      }

      models.push({
        modelId: `${processedUnit.selectionId}_model_${i + 1}`,
        maxHp: Math.max(1, modelMaxHp), // Ensure HP is at least 1
        currentHp: Math.max(1, modelMaxHp),
        baseStats: {
          defense: processedUnit.defense,
          quality: processedUnit.quality,
        },
      });
    }
    processedUnit.models = models;

    // --- Final Hero Check & Join Target ---
    processedUnit.isHero = processedUnit.rules.some(
      (rule) => rule.name === "Hero"
    );
    if (processedUnit.isHero && rawUnit.joinToUnit) {
      processedUnit.canJoinUnitId = rawUnit.joinToUnit;
      processedArmy.heroJoinTargets[processedUnit.selectionId] =
        rawUnit.joinToUnit;
    }

    tempProcessedUnits[processedUnit.selectionId] = processedUnit;
    if (processedUnit.isCombined && processedUnit.joinToUnitId) {
      combinedUnitIds.add(processedUnit.selectionId);
      combinedUnitIds.add(processedUnit.joinToUnitId);
    }
  }); // End loop through rawUnits

  // --- Step 2: Merge Combined Units ---
  const mergedUnitIds = new Set();
  Object.values(tempProcessedUnits).forEach((unitA) => {
    if (
      unitA.isCombined &&
      unitA.joinToUnitId &&
      !mergedUnitIds.has(unitA.selectionId)
    ) {
      const unitB = tempProcessedUnits[unitA.joinToUnitId];
      if (unitB && unitB.isCombined && !mergedUnitIds.has(unitB.selectionId)) {
        const mergedUnit = unitB; // Modify B

        // Combine properties (Use single name)
        mergedUnit.customName = unitA.customName;
        mergedUnit.originalName = unitA.originalName;
        mergedUnit.cost = unitA.cost + unitB.cost;
        mergedUnit.size = unitA.size + unitB.size;
        mergedUnit.xp = unitA.xp + unitB.xp;
        mergedUnit.notes = [unitB.notes, unitA.notes]
          .filter(Boolean)
          .join("; ");
        mergedUnit.traits = [...new Set([...unitB.traits, ...unitA.traits])];
        mergedUnit.bases = unitB.bases ? { ...unitB.bases } : null;

        // Combine Rules (keep all instances for now)
        mergedUnit.rules = [...unitB.rules, ...unitA.rules];

        // Aggregate Item Counts
        const combinedItemsMap = new Map();
        unitB.items.forEach((item) => {
          const identifier = item.id || item.label || item.name;
          combinedItemsMap.set(identifier, { ...item });
        });
        unitA.items.forEach((item) => {
          const identifier = item.id || item.label || item.name;
          if (combinedItemsMap.has(identifier)) {
            const existing = combinedItemsMap.get(identifier);
            existing.count = (existing.count || 1) + (item.count || 1);
          } else {
            combinedItemsMap.set(identifier, { ...item });
          }
        });
        mergedUnit.items = Array.from(combinedItemsMap.values());

        // Concatenate Loadouts & Models (Models keep their assigned maxHp)
        mergedUnit.loadout = [...unitB.loadout, ...unitA.loadout];
        mergedUnit.models = [...unitB.models, ...unitA.models]; // Preserves individual maxHp

        // Stats: Use target B's Q/D. Toughness is per-model.
        mergedUnit.quality = unitB.quality;
        mergedUnit.defense = unitB.defense;
        // Update baseStats ref in all merged models
        mergedUnit.models.forEach((model) => {
          model.baseStats = {
            defense: mergedUnit.defense,
            quality: mergedUnit.quality,
          };
        });

        // Update flags
        mergedUnit.isCombined = true;
        mergedUnit.joinToUnitId = null;
        mergedUnit.isHero = false;
        mergedUnit.canJoinUnitId = null;

        mergedUnitIds.add(unitA.selectionId);
        mergedUnitIds.add(unitB.selectionId);
        processedArmy.units.push(mergedUnit);
        processedArmy.unitMap[mergedUnit.selectionId] = mergedUnit;
      } else if (!unitB || !unitB.isCombined) {
        console.warn(
          `Combined unit ${unitA.customName} (${unitA.selectionId}) points to invalid target ${unitA.joinToUnitId}. Adding as separate unit.`
        );
        mergedUnitIds.add(unitA.selectionId);
        processedArmy.units.push(unitA);
        processedArmy.unitMap[unitA.selectionId] = unitA;
      }
    }
  });

  // Step 3: Add remaining non-combined/unmerged units
  Object.values(tempProcessedUnits).forEach((unit) => {
    if (!mergedUnitIds.has(unit.selectionId)) {
      if (!processedArmy.unitMap[unit.selectionId]) {
        processedArmy.units.push(unit);
        processedArmy.unitMap[unit.selectionId] = unit;
      }
    }
  });

  // Final Adjustments
  processedArmy.meta.modelCount = processedArmy.units.reduce(
    (sum, unit) => sum + unit.size,
    0
  );
  processedArmy.meta.activationCount = processedArmy.units.length;

  // console.log("Processed Army Data (v15 - tough heuristic):", processedArmy);
  return processedArmy;
}

// Export the function to make it available for import
export { processArmyData };
