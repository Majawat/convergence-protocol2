/**
 * Processes the raw army data from the Army Forge API into a structured format.
 * Calculates final costs, stats (including Tough, Defense), merges combined units,
 * and extracts final loadouts including weapons/rules from items.
 * @param {object} rawData - The raw JSON object returned by the API.
 * @returns {object|null} A structured object representing the army list, or null if data is invalid.
 */
function processArmyData(rawData) {
  // Basic validation of the input data
  if (!rawData || !rawData.units) {
    console.error("Invalid raw data provided for processing.");
    return null;
  }

  // Initialize the structured army object
  const processedArmy = {
    meta: {
      id: rawData.id,
      key: rawData.key,
      name: rawData.name || "Unnamed Army",
      gameSystem: rawData.gameSystem,
      pointsLimit: rawData.pointsLimit || 0,
      listPoints: rawData.listPoints || 0, // Use listPoints for actual total
      activationCount: rawData.activationCount || 0,
      modelCount: rawData.modelCount || 0,
      description: rawData.description || "",
      rawSpecialRules: rawData.specialRules || [],
      cloudModified: rawData.cloudModified,
      modified: rawData.modified,
    },
    units: [],
    heroJoinTargets: {},
    unitMap: {},
  };

  const tempProcessedUnits = {};
  const combinedUnitIds = new Set();

  // --- Step 1: Initial Processing & Upgrade Application ---
  rawData.units.forEach((rawUnit) => {
    const initialBaseDefense = parseInt(rawUnit.defense, 10) || 0;
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
    };

    const addedRuleIds = new Set(
      processedUnit.rules.map((r) => r.id || r.label || r.name)
    );
    const addedItemIdentifiers = new Set(
      processedUnit.items.map((i) => i.id || i.label || i.name)
    );
    let defenseModifiedByUpgrade = false;
    // Toughness calculation will happen *after* all rules are collected

    (rawUnit.selectedUpgrades || []).forEach((selectedUpgrade) => {
      const option = selectedUpgrade.option;
      const upgradeInfo = selectedUpgrade.upgrade;
      if (!option) return;

      // Cost Calculation
      const upgradeCostEntry = (option.costs || []).find(
        (c) => c.unitId === processedUnit.id
      );
      if (upgradeCostEntry?.cost) {
        processedUnit.cost += parseInt(upgradeCostEntry.cost, 10) || 0;
      } else if (option.cost) {
        processedUnit.cost += parseInt(option.cost, 10) || 0;
      }

      if (!option.gains) return;

      option.gains.forEach((gain) => {
        const processGainedRule = (rule) => {
          const ruleIdentifier = rule.id || rule.label || rule.name;
          if (!addedRuleIds.has(ruleIdentifier)) {
            const newRule = {
              id: rule.id,
              name: rule.name,
              label: rule.label || rule.name,
              rating: rule.rating || null,
            };
            processedUnit.rules.push(newRule);
            addedRuleIds.add(ruleIdentifier);
            // Stat adjustments happen here based on the rule *being added*
            const ratingValue = parseInt(newRule.rating, 10);
            if (
              newRule.name === "Defense" &&
              !isNaN(ratingValue) &&
              !defenseModifiedByUpgrade
            ) {
              const newDefense = initialBaseDefense - ratingValue;
              processedUnit.defense = Math.max(2, newDefense);
              defenseModifiedByUpgrade = true;
            } else if (newRule.name === "Quality" && !isNaN(ratingValue)) {
              processedUnit.quality = ratingValue;
            }
            // Note: Toughness is NOT calculated here, but after all rules are gathered
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
            newItem.content.forEach(processGainedRule);
          } else {
            const existingItem = processedUnit.items.find(
              (i) => (i.id || i.label || i.name) === itemIdentifier
            );
            if (existingItem && !existingItem.upgradeContentProcessed) {
              (gain.content || []).forEach(processGainedRule);
              existingItem.upgradeContentProcessed = true;
            }
          }
        } else if (gain.type === "ArmyBookRule") {
          processGainedRule(gain);
        }
      });
    });

    // Populate Final Loadout & Extract Contained Weapons/Rules
    const finalLoadoutWeapons = [];
    const finalLoadoutItems = [...processedUnit.items];
    const finalLoadoutItemIdentifiers = new Set(addedItemIdentifiers);

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
        if (!existingItem.contentProcessed) {
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
              if (!addedRuleIds.has(ruleIdentifier)) {
                const newRule = { ...contentItem };
                processedUnit.rules.push(newRule);
                addedRuleIds.add(ruleIdentifier);
                // Adjust stats based on rule from item content
                const ratingValue = parseInt(newRule.rating, 10);
                if (
                  newRule.name === "Defense" &&
                  !isNaN(ratingValue) &&
                  !defenseModifiedByUpgrade
                ) {
                  const newDefense = initialBaseDefense - ratingValue;
                  processedUnit.defense = Math.max(2, newDefense);
                  defenseModifiedByUpgrade = true;
                } else if (newRule.name === "Quality" && !isNaN(ratingValue)) {
                  processedUnit.quality = ratingValue;
                }
                // Note: Toughness is NOT calculated here
              }
            }
          });
          existingItem.contentProcessed = true;
        }
      }
    });
    processedUnit.loadout = finalLoadoutWeapons;
    processedUnit.items = finalLoadoutItems;

    // **** FINAL TOUGHNESS CALCULATION ****
    let finalCalculatedTough = 0;
    processedUnit.rules.forEach((rule) => {
      if (rule.name === "Tough" && rule.rating) {
        const ratingValue = parseInt(rule.rating, 10);
        if (!isNaN(ratingValue)) {
          finalCalculatedTough += ratingValue;
        }
      }
    });
    const finalMaxHp = Math.max(1, finalCalculatedTough); // Ensure at least 1 HP
    // console.log(`Unit ${processedUnit.selectionId}: Final Max HP (Tough) calculated as ${finalMaxHp}`);
    // **** END FINAL TOUGHNESS CALCULATION ****

    // Populate Models Array
    for (let i = 0; i < processedUnit.size; i++) {
      processedUnit.models.push({
        modelId: `${processedUnit.selectionId}_model_${i + 1}`,
        maxHp: finalMaxHp,
        currentHp: finalMaxHp,
        baseStats: {
          defense: processedUnit.defense,
          quality: processedUnit.quality,
        },
      });
    }

    // Final Hero Check & Join Target
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
  });

  // Step 2: Merge Combined Units
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

        // Combine Rules (unique)
        const combinedRules = [...unitB.rules, ...unitA.rules];
        const uniqueRuleIds = new Set();
        mergedUnit.rules = combinedRules.filter((rule) => {
          const identifier = rule.id || rule.label || rule.name;
          if (!uniqueRuleIds.has(identifier)) {
            uniqueRuleIds.add(identifier);
            return true;
          }
          return false;
        });

        // Combine Items (unique)
        const combinedItems = [...unitB.items, ...unitA.items];
        const uniqueItemIds = new Set();
        mergedUnit.items = combinedItems.filter((item) => {
          const identifier = item.id || item.label || item.name;
          if (!uniqueItemIds.has(identifier)) {
            uniqueItemIds.add(identifier);
            return true;
          }
          return false;
        });

        // Concatenate Loadouts & Models
        mergedUnit.loadout = [...unitB.loadout, ...unitA.loadout];
        mergedUnit.models = [...unitB.models, ...unitA.models];

        // Stats: Use target B's Q/D. Recalculate Tough based on merged rules.
        mergedUnit.quality = unitB.quality;
        mergedUnit.defense = unitB.defense;
        let finalMergedCalculatedTough = 0;
        mergedUnit.rules.forEach((rule) => {
          if (rule.name === "Tough" && rule.rating) {
            const ratingValue = parseInt(rule.rating, 10);
            if (!isNaN(ratingValue)) finalMergedCalculatedTough += ratingValue;
          }
        });
        const finalMergedMaxHp = Math.max(1, finalMergedCalculatedTough);
        mergedUnit.models.forEach((model) => {
          model.maxHp = finalMergedMaxHp;
          model.currentHp = Math.min(model.currentHp, finalMergedMaxHp);
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

  console.log("Processed Army Data (v9):", processedArmy);
  // console.log("Processed Army Data (v9 - combined names):", processedArmy);
  return processedArmy;
}

// Export the function to make it available for import
export { processArmyData };
