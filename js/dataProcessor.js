/**
 * Processes the raw army data from the Army Forge API into a structured format.
 * **MODIFIED:** Stores unit's original factionId.
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
      /* ... (same as before) ... */
    },
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
  const unitsMergedInto = new Set();

  // --- Step 1: Initial Processing & Upgrade Application ---
  rawData.units.forEach((rawUnit) => {
    const initialBaseDefense = parseInt(rawUnit.defense, 10) || 0;
    let baseToughValue = 1;
    const baseToughRule = (rawUnit.rules || []).find((r) => r.name === "Tough");
    if (baseToughRule && baseToughRule.rating) {
      const parsedTough = parseInt(baseToughRule.rating, 10);
      if (!isNaN(parsedTough)) baseToughValue = parsedTough;
    }
    const unitIsHero = (rawUnit.rules || []).some(
      (rule) => rule.name === "Hero"
    );

    const processedUnit = {
      // Basic Info
      id: rawUnit.id,
      selectionId: rawUnit.selectionId,
      factionId: rawUnit.armyId, // <<< STORE FACTION ID HERE
      originalName: rawUnit.name,
      customName: rawUnit.customName || rawUnit.name,
      cost: rawUnit.cost || 0,
      size: rawUnit.size || 1,
      // Stats
      defense: initialBaseDefense,
      quality: rawUnit.quality || 0,
      // Details
      rules: (rawUnit.rules || []).map((rule) => ({ ...rule })),
      items: (rawUnit.items || []).map((item) => ({ ...item })),
      bases: rawUnit.bases ? { ...rawUnit.bases } : null,
      xp: rawUnit.xp || 0,
      notes: rawUnit.notes || null,
      traits: rawUnit.traits || [],
      loadout: [],
      models: [],
      // Flags & Relations
      isHero: unitIsHero,
      canJoinUnitId: null,
      isCombined: rawUnit.combined || false,
      joinToUnitId: rawUnit.joinToUnit || null,
      toughnessUpgrades: [], // Stores upgrades granting Toughness
      casterLevel: 0, // Initialize caster level (will be set later if applicable)
    };

    // Calculate Caster Level
    const casterRule = processedUnit.rules.find((r) => r.name === "Caster");
    processedUnit.casterLevel = casterRule
      ? parseInt(casterRule.rating, 10) || 0
      : 0;

    // --- Stat Accumulation & Upgrade Processing ---
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
    (rawUnit.selectedUpgrades || []).forEach((selectedUpgrade) => {
      /* ... (upgrade processing logic same as V16) ... */
      const option = selectedUpgrade.option;
      if (!option) return;
      const upgradeCostEntry = (option.costs || []).find(
        (c) => c.unitId === processedUnit.id
      );
      if (upgradeCostEntry?.cost)
        processedUnit.cost += parseInt(upgradeCostEntry.cost, 10) || 0;
      else if (option.cost)
        processedUnit.cost += parseInt(option.cost, 10) || 0;
      if (!option.gains) return;
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
              optionGrantsTough = true;
              optionToughValue = ratingValue;
              statProcessedRuleInstances.add(instanceKey);
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
        };
        if (gain.type === "ArmyBookItem") {
          const itemIdentifier = gain.id || gain.label || gain.name;
          if (gain.bases) processedUnit.bases = { ...gain.bases };
          if (!addedItemIdentifiers.has(itemIdentifier)) {
            const newItem = {
              id: gain.id,
              name: gain.name,
              label: gain.label,
              count: gain.count || 1,
              content: (gain.content || []).map((rule) => ({ ...rule })),
              bases: gain.bases ? { ...gain.bases } : null,
            };
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
      });
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
    });
    processedUnit.toughnessUpgrades.forEach((upg) => {
      upg.count = toughUpgradeOptionCounts[upg.optionUid] || 0;
    });

    // --- Loadout Processing ---
    const finalLoadoutWeapons = [];
    const finalLoadoutItems = [...processedUnit.items];
    const finalLoadoutItemIdentifiers = new Set(
      processedUnit.items.map((i) => i.id || i.label || i.name)
    );
    (rawUnit.loadout || []).forEach((loadoutItem) => {
      /* ... (loadout processing logic same as V16) ... */
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
          }
        });
      }
    });
    processedUnit.loadout = finalLoadoutWeapons;
    processedUnit.items = finalLoadoutItems;

    // --- Finalize Stats & Create Models ---
    processedUnit.quality = finalQuality;
    processedUnit.defense = finalDefense;
    const models = [];
    const totalToughModelsNeeded = processedUnit.toughnessUpgrades.reduce(
      (sum, upg) => sum + upg.count,
      0
    );
    const upgradeToughValue =
      processedUnit.toughnessUpgrades.length > 0
        ? processedUnit.toughnessUpgrades[0].toughValue
        : baseToughValue;
    for (let i = 0; i < processedUnit.size; i++) {
      /* ... (model creation logic same as V16) ... */
      let modelMaxHp = baseToughValue;
      let modelIsTough = baseToughValue > 1;
      if (i < totalToughModelsNeeded) {
        modelIsTough = true;
        if (
          processedUnit.size === 1 &&
          processedUnit.toughnessUpgrades.length > 0
        ) {
          modelMaxHp = baseToughValue + upgradeToughValue;
        } else {
          modelMaxHp = upgradeToughValue;
        }
      } else {
        modelMaxHp = baseToughValue;
      }
      models.push({
        modelId: `${processedUnit.selectionId}_model_${i + 1}`,
        maxHp: Math.max(1, modelMaxHp),
        currentHp: Math.max(1, modelMaxHp),
        isHero: processedUnit.isHero,
        isTough: modelIsTough,
        baseStats: {
          defense: processedUnit.defense,
          quality: processedUnit.quality,
        },
      });
    }
    processedUnit.models = models;

    // --- Final Hero Check & Join Target ---
    if (processedUnit.isHero && rawUnit.joinToUnit) {
      processedUnit.canJoinUnitId = rawUnit.joinToUnit;
      processedArmy.heroJoinTargets[processedUnit.selectionId] =
        rawUnit.joinToUnit;
    }

    tempProcessedUnits[processedUnit.selectionId] = processedUnit;
  }); // End loop through rawUnits

  // --- Step 2: Merge Combined Units ---
  Object.values(tempProcessedUnits).forEach((unitA) => {
    /* ... (merge logic same as V16) ... */
    if (unitA.isCombined && unitA.joinToUnitId) {
      const unitB = tempProcessedUnits[unitA.joinToUnitId];
      if (
        unitB &&
        unitB.isCombined &&
        !unitsMergedInto.has(unitB.selectionId)
      ) {
        const mergedUnit = unitB;
        mergedUnit.customName = unitA.customName;
        mergedUnit.originalName = unitA.originalName;
        mergedUnit.cost += unitA.cost;
        mergedUnit.size += unitA.size;
        mergedUnit.xp += unitA.xp;
        mergedUnit.notes = [unitB.notes, unitA.notes]
          .filter(Boolean)
          .join("; ");
        mergedUnit.traits = [...new Set([...unitB.traits, ...unitA.traits])];
        mergedUnit.bases = unitB.bases ? { ...unitB.bases } : null;
        mergedUnit.rules = [...unitB.rules, ...unitA.rules];
        const combinedItemsMap = new Map();
        [...unitB.items, ...unitA.items].forEach((item) => {
          const identifier = item.id || item.label || item.name;
          if (combinedItemsMap.has(identifier)) {
            const existing = combinedItemsMap.get(identifier);
            existing.count = (existing.count || 1) + (item.count || 1);
          } else {
            combinedItemsMap.set(identifier, {
              ...item,
              count: item.count || 1,
            });
          }
        });
        mergedUnit.items = Array.from(combinedItemsMap.values());
        mergedUnit.loadout = [...unitB.loadout, ...unitA.loadout];
        mergedUnit.models = [...unitB.models, ...unitA.models];
        mergedUnit.quality = unitB.quality;
        mergedUnit.defense = unitB.defense;
        mergedUnit.models.forEach((model) => {
          model.baseStats = {
            defense: mergedUnit.defense,
            quality: mergedUnit.quality,
          };
          model.isHero = false;
        });
        mergedUnit.isCombined = true;
        mergedUnit.joinToUnitId = null;
        mergedUnit.isHero = false;
        mergedUnit.canJoinUnitId = null;
        unitsMergedInto.add(unitA.selectionId);
      } else if (!unitB || !unitB.isCombined) {
        console.warn(
          `Combined unit ${unitA.customName} (${unitA.selectionId}) points to invalid target ${unitA.joinToUnitId}. Treating as separate.`
        );
      }
    }
  });

  // --- Step 3: Add Final Units to Army ---
  Object.values(tempProcessedUnits).forEach((unit) => {
    /* ... (add final units logic same as V16) ... */
    if (!unitsMergedInto.has(unit.selectionId)) {
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

  return processedArmy;
}

// Export the function
export { processArmyData };
