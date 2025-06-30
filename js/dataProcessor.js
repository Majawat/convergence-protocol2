//@ts-check
/**
 * @fileoverview Processes raw army data from the Army Forge API into a structured format.
 * Handles units, heroes, weapons, rules, items, upgrades, and unit merging.
 */

// --- Constants ---

// Whitelist of rules that should accumulate ratings when multiple instances are found
const ADDITIVE_RULES = new Set([
  "Impact",
  "Defense", // Keep existing Defense handling
  "AP",
  "Blast",
  "Tough",
  "Rending",
]);

// --- Helper Functions ---

/**
 * Accumulates rules with ratings for whitelisted additive rules.
 * @param {Array} rules - Array of rule objects to process
 * @returns {Array} Processed rules with accumulated ratings
 * @private
 */
function _accumulateAdditiveRules(rules) {
  const ruleMap = new Map();
  const nonAdditiveRules = [];

  rules.forEach((rule) => {
    const identifier = rule.id || rule.name || rule.label;
    const ruleName = rule.name;

    if (!identifier) {
      nonAdditiveRules.push(rule);
      return;
    }

    // Check if this is an additive rule with a rating
    if (ADDITIVE_RULES.has(ruleName) && rule.rating !== undefined) {
      const rating = parseInt(rule.rating, 10) || 0;

      if (ruleMap.has(identifier)) {
        // Accumulate rating
        const existing = ruleMap.get(identifier);
        existing.rating = (existing.rating || 0) + rating;
        existing.label = `${ruleName}(${existing.rating})`;
      } else {
        // First instance
        ruleMap.set(identifier, {
          ...rule,
          rating: rating,
          label: `${ruleName}(${rating})`,
        });
      }
    } else {
      // Non-additive rule or rule without rating
      if (ruleMap.has(identifier)) {
        // Keep existing (don't duplicate)
        return;
      } else {
        ruleMap.set(identifier, { ...rule });
      }
    }
  });

  // Combine accumulated rules with non-additive rules
  return [...Array.from(ruleMap.values()), ...nonAdditiveRules];
}

/**
 * Initializes a processed unit object from raw unit data.
 * @param {object} rawUnit - The raw unit data object.
 * @returns {object} The initialized processed unit object.
 * @private
 */
function _initializeProcessedUnit(rawUnit) {
  return {
    selectionId: rawUnit.selectionId,
    id: rawUnit.id,
    originalName: rawUnit.name,
    customName: rawUnit.customName || null,
    size: rawUnit.size || 1,
    quality: rawUnit.quality || 4,
    defense: rawUnit.defense || 5,
    _initialBaseDefense: rawUnit.defense || 5,
    cost: rawUnit.cost || 0,
    bases: rawUnit.bases ? { ...rawUnit.bases } : null,
    rules: (rawUnit.rules || []).map((r) => ({ ...r })),
    items: (rawUnit.items || []).map((i) => ({ ...i })),
    loadout: [],
    models: [],
    traits: rawUnit.traits || [],
    skills: rawUnit.skills || [],
    injuries: rawUnit.injuries || [],
    talents: rawUnit.talents || [],
    isHero: (rawUnit.rules || []).some((rule) => rule.name === "Hero"),
    isCombined: rawUnit.combined || false,
    joinToUnitId: rawUnit.joinToUnit || null,
    canJoinUnitId: null,
    casterLevel: 0,
    xp: rawUnit.xp || 0,
    toughnessUpgrades: [],
    _baseToughValue: (rawUnit.rules || []).find((rule) => rule.name === "Tough")?.rating
      ? parseInt((rawUnit.rules || []).find((rule) => rule.name === "Tough").rating, 10) || 0
      : 0,
  };
}

/**
 * Applies selected upgrades to a processed unit, modifying its stats, rules, items, and cost.
 * @param {object} processedUnit - The unit object being processed (mutated directly).
 * @param {object} rawUnit - The raw unit data containing `selectedUpgrades`.
 * @private
 */
function _applyUpgradesToUnit(processedUnit, rawUnit) {
  let finalQuality = processedUnit.quality;
  let finalDefense = processedUnit.defense;
  let defenseModifiedByUpgrade = false;
  const addedRuleIdentifiers = new Set(processedUnit.rules.map((r) => r.id || r.label || r.name));
  const addedItemIdentifiers = new Set(processedUnit.items.map((i) => i.id || i.label || i.name));
  const statProcessedRuleInstances = new Set();
  const toughUpgradeOptionCounts = {};
  const allRules = [...processedUnit.rules]; // Collect all rules for accumulation

  (rawUnit.selectedUpgrades || []).forEach((selectedUpgrade) => {
    const option = selectedUpgrade.option;
    if (!option) return;

    // --- Accumulate Cost ---
    const upgradeCostEntry = (option.costs || []).find((c) => c.unitId === processedUnit.id);
    if (upgradeCostEntry?.cost) {
      processedUnit.cost += parseInt(upgradeCostEntry.cost, 10) || 0;
    } else if (option.cost) {
      processedUnit.cost += parseInt(option.cost, 10) || 0;
    }

    if (!option.gains) return;

    let optionGrantsTough = false;
    let optionToughValue = 0;

    // --- Process Gains (Rules, Items, Stats) ---
    option.gains.forEach((gain) => {
      const gainInstanceKey = `upg_${selectedUpgrade.instanceId}_opt_${option.uid}_gain_${
        gain.name || gain.label || gain.id || Math.random()
      }`;

      /** Helper to process a gained rule */
      const processGainedRule = (rule, instanceKey) => {
        const ruleIdentifier = rule.id || rule.label || rule.name;
        if (!ruleIdentifier) return;

        // Add rule to collection for accumulation
        allRules.push({ ...rule });

        // Add to identifier set for tracking
        addedRuleIdentifiers.add(ruleIdentifier);

        // Process stat changes only once per instance
        if (!statProcessedRuleInstances.has(instanceKey)) {
          const ratingValue = parseInt(rule.rating, 10);

          if (rule.name === "Caster" && !isNaN(ratingValue)) {
            processedUnit.casterLevel = ratingValue;
            statProcessedRuleInstances.add(instanceKey);
            console.debug(`Applied Caster(${ratingValue}) upgrade to ${processedUnit.selectionId}`);
          } else if (rule.name === "Tough" && !isNaN(ratingValue)) {
            optionGrantsTough = true;
            optionToughValue = ratingValue;
            statProcessedRuleInstances.add(instanceKey);
          } else if (rule.name === "Defense" && !isNaN(ratingValue) && !defenseModifiedByUpgrade) {
            finalDefense = Math.max(2, processedUnit._initialBaseDefense - ratingValue);
            defenseModifiedByUpgrade = true;
            statProcessedRuleInstances.add(instanceKey);
          } else if (rule.name === "Quality" && !isNaN(ratingValue)) {
            finalQuality = ratingValue;
            statProcessedRuleInstances.add(instanceKey);
          }
        }
      };

      // Process based on gain type
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

          newItem.content.forEach((contentRule, idx) => {
            if (contentRule.type === "ArmyBookRule") {
              processGainedRule(contentRule, `${gainInstanceKey}_content_${idx}`);
            }
          });
        } else {
          (gain.content || []).forEach((contentRule, idx) => {
            if (contentRule.type === "ArmyBookRule") {
              processGainedRule(contentRule, `${gainInstanceKey}_content_${idx}`);
            }
          });
        }
      } else if (gain.type === "ArmyBookRule") {
        processGainedRule(gain, gainInstanceKey);
      }
    });

    // Track toughness upgrades
    if (optionGrantsTough) {
      toughUpgradeOptionCounts[option.uid] = (toughUpgradeOptionCounts[option.uid] || 0) + 1;
      if (!processedUnit.toughnessUpgrades.some((upg) => upg.optionUid === option.uid)) {
        processedUnit.toughnessUpgrades.push({
          optionUid: option.uid,
          count: 0,
          toughValue: optionToughValue,
        });
      }
    }
  });

  // Update toughness upgrade counts
  processedUnit.toughnessUpgrades.forEach((upg) => {
    upg.count = toughUpgradeOptionCounts[upg.optionUid] || 0;
  });

  // Apply rule accumulation
  processedUnit.rules = _accumulateAdditiveRules(allRules);

  // Apply final calculated stats
  processedUnit.quality = finalQuality;
  processedUnit.defense = finalDefense;

  console.debug(
    `Final Caster Level for ${processedUnit.selectionId}: ${processedUnit.casterLevel}`
  );
}

/**
 * Processes the unit's loadout (weapons and items directly equipped).
 * Adds weapons to the `loadout` array and potentially adds items/rules.
 * @param {object} processedUnit - The unit object being processed (mutated directly).
 * @param {object} rawUnit - The raw unit data containing `loadout`.
 * @private
 */
function _processUnitLoadout(processedUnit, rawUnit) {
  const finalLoadoutWeapons = [];
  const finalLoadoutItems = processedUnit.items;
  const finalLoadoutItemIdentifiers = new Set(
    processedUnit.items.map((i) => i.id || i.label || i.name)
  );
  const addedRuleIdentifiers = new Set(processedUnit.rules.map((r) => r.id || r.label || r.name));

  (rawUnit.loadout || []).forEach((loadoutItem) => {
    if (loadoutItem.type === "ArmyBookWeapon") {
      finalLoadoutWeapons.push({
        ...loadoutItem,
        specialRules: (loadoutItem.specialRules || []).map((r) => ({ ...r })),
      });
    } else if (loadoutItem.type === "ArmyBookItem") {
      const itemIdentifier = loadoutItem.id || loadoutItem.label || loadoutItem.name;
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
            specialRules: (contentItem.specialRules || []).map((r) => ({ ...r })),
          });
        } else if (contentItem.type === "ArmyBookRule") {
          const ruleIdentifier = contentItem.id || contentItem.label || contentItem.name;
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
}

/**
 * Creates the individual model objects for a unit based on its size and toughness upgrades.
 * Calculates maxHp for each model.
 * @param {object} processedUnit - The unit object being processed (mutated directly).
 * @private
 */
function _createModelsForUnit(processedUnit) {
  let totalModelsCreated = 0;
  let modelIdCounter = 1;

  // Base models (without toughness upgrades)
  const baseModelCount =
    processedUnit.size - processedUnit.toughnessUpgrades.reduce((sum, upg) => sum + upg.count, 0);
  for (let i = 0; i < baseModelCount; i++) {
    const maxHp = processedUnit._baseToughValue > 0 ? processedUnit._baseToughValue : 1;
    processedUnit.models.push({
      modelId: `model-${modelIdCounter++}`,
      maxHp: maxHp,
      currentHp: maxHp,
      baseStats: {
        defense: processedUnit.defense,
        quality: processedUnit.quality,
      },
      isHero: processedUnit.isHero,
      upgrades: [],
    });
    totalModelsCreated++;
  }

  // Models with toughness upgrades
  processedUnit.toughnessUpgrades.forEach((upgrade) => {
    for (let i = 0; i < upgrade.count; i++) {
      const maxHp = upgrade.toughValue > 0 ? upgrade.toughValue : 1;
      processedUnit.models.push({
        modelId: `model-${modelIdCounter++}`,
        maxHp: maxHp,
        currentHp: maxHp,
        baseStats: {
          defense: processedUnit.defense,
          quality: processedUnit.quality,
        },
        isHero: processedUnit.isHero,
        upgrades: [upgrade],
      });
      totalModelsCreated++;
    }
  });

  // Auto-detect caster level
  const casterRule = processedUnit.rules.find((rule) => rule.name === "Caster");
  processedUnit.casterLevel =
    casterRule && casterRule.rating ? parseInt(casterRule.rating, 10) || 0 : 0;

  return processedUnit;
}

/**
 * Merges two combined units into a single unit.
 * @param {object} unitA - The unit being merged away.
 * @param {object} unitB - The unit being merged into (modified directly).
 * @returns {object} The merged unit (same reference as unitB).
 * @private
 */
function _mergeCombinedUnits(unitA, unitB) {
  console.log(`Merging combined units: ${unitA.customName} into ${unitB.customName}`);

  const mergedUnit = unitB;

  // Combine names
  mergedUnit.customName = mergedUnit.customName
    ? `${mergedUnit.customName} & ${unitA.customName || unitA.originalName}`
    : `${mergedUnit.originalName} & ${unitA.customName || unitA.originalName}`;

  // Combine basic stats
  mergedUnit.size += unitA.size;
  mergedUnit.cost += unitA.cost;
  mergedUnit.casterLevel = Math.max(mergedUnit.casterLevel, unitA.casterLevel);
  mergedUnit.xp += unitA.xp;

  // Use better stats
  mergedUnit.quality = Math.min(mergedUnit.quality, unitA.quality);
  mergedUnit.defense = Math.max(mergedUnit.defense, unitA.defense);

  // Update base size if unitA has one
  if (unitA.bases) mergedUnit.bases = unitA.bases;

  // Combine arrays (traits, skills, etc.)
  mergedUnit.traits = [...(mergedUnit.traits || []), ...(unitA.traits || [])];
  mergedUnit.skills = [...(mergedUnit.skills || []), ...(unitA.skills || [])];
  mergedUnit.injuries = [...(mergedUnit.injuries || []), ...(unitA.injuries || [])];
  mergedUnit.talents = [...(mergedUnit.talents || []), ...(unitA.talents || [])];

  // Combine rules using accumulation
  const allCombinedRules = [...mergedUnit.rules, ...unitA.rules];
  mergedUnit.rules = _accumulateAdditiveRules(allCombinedRules);

  // Combine items, aggregating counts
  const combinedItemsMap = new Map();
  [...mergedUnit.items, ...unitA.items].forEach((item) => {
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

  // Combine loadouts and models
  mergedUnit.loadout = [...mergedUnit.loadout, ...unitA.loadout];
  mergedUnit.models = [...mergedUnit.models, ...unitA.models];

  // Ensure merged models have correct base stats
  mergedUnit.models.forEach((model) => {
    model.baseStats = {
      defense: mergedUnit.defense,
      quality: mergedUnit.quality,
    };
    model.isHero = false;
  });

  // Update flags
  mergedUnit.isCombined = true;
  mergedUnit.joinToUnitId = null;
  mergedUnit.isHero = false;
  mergedUnit.canJoinUnitId = null;

  return mergedUnit;
}

/**
 * Processes the raw army data from the Army Forge API into a structured format.
 * @param {object} rawData - The raw JSON data from the API.
 * @returns {object|null} The processed army object, or null if input is invalid.
 */
function processArmyData(rawData) {
  if (!rawData || !rawData.units) {
    console.error("Invalid raw data provided for processing.");
    return null;
  }

  const processedArmy = {
    meta: {
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
    },
    units: [],
    heroJoinTargets: {},
    unitMap: {},
  };

  const tempProcessedUnits = {};
  const unitsMergedInto = new Set();

  // Step 1: Initial Processing
  rawData.units.forEach((rawUnit) => {
    const processedUnit = _initializeProcessedUnit(rawUnit);
    _applyUpgradesToUnit(processedUnit, rawUnit);
    _processUnitLoadout(processedUnit, rawUnit);
    _createModelsForUnit(processedUnit);

    if (processedUnit.isHero && rawUnit.joinToUnit) {
      processedUnit.canJoinUnitId = rawUnit.joinToUnit;
      processedArmy.heroJoinTargets[processedUnit.selectionId] = rawUnit.joinToUnit;
    }

    tempProcessedUnits[processedUnit.selectionId] = processedUnit;
  });

  // Step 2: Merge Combined Units
  Object.values(tempProcessedUnits).forEach((unitA) => {
    if (unitA.isCombined && unitA.joinToUnitId) {
      const unitB = tempProcessedUnits[unitA.joinToUnitId];

      if (unitB && unitB.isCombined && !unitsMergedInto.has(unitB.selectionId)) {
        _mergeCombinedUnits(unitA, unitB);
        unitsMergedInto.add(unitA.selectionId);
      } else if (!unitB || !unitB.isCombined) {
        console.warn(
          `Combined unit ${unitA.customName} (${unitA.selectionId}) points to invalid target ${unitA.joinToUnitId}. Treating as separate.`
        );
        unitA.isCombined = false;
        unitA.joinToUnitId = null;
      }
    }
  });

  // Step 3: Add Final Units
  Object.values(tempProcessedUnits).forEach((unit) => {
    if (!unitsMergedInto.has(unit.selectionId)) {
      if (!processedArmy.unitMap[unit.selectionId]) {
        processedArmy.units.push(unit);
        processedArmy.unitMap[unit.selectionId] = unit;
      }
    }
  });

  // Step 4: Final Adjustments
  processedArmy.meta.modelCount = processedArmy.units.reduce((sum, unit) => sum + unit.size, 0);
  processedArmy.meta.activationCount = processedArmy.units.length;

  processedArmy.units.forEach((unit) => {
    delete unit._initialBaseDefense;
    delete unit._baseToughValue;
  });

  console.log("Army processing complete:", processedArmy);
  return processedArmy;
}

export { processArmyData };
