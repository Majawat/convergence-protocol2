/**
 * @fileoverview Processes raw army data from the Army Forge API into a structured format.
 * Refactored for clarity by breaking down the main function into smaller helpers.
 * Added JSDoc comments and inline explanations.
 */

// --- Helper Functions ---

/**
 * Initializes a basic processed unit object from raw unit data.
 * @param {object} rawUnit - The raw unit data from the API.
 * @returns {object} A partially processed unit object.
 * @private
 */
function _initializeProcessedUnit(rawUnit) {
  const initialBaseDefense = parseInt(rawUnit.defense, 10) || 0;
  let baseToughValue = 1;
  const baseToughRule = (rawUnit.rules || []).find((r) => r.name === "Tough");
  if (baseToughRule && baseToughRule.rating) {
    const parsedTough = parseInt(baseToughRule.rating, 10);
    if (!isNaN(parsedTough)) baseToughValue = parsedTough;
  }
  const unitIsHero = (rawUnit.rules || []).some((rule) => rule.name === "Hero");

  const processedUnit = {
    // Basic Info
    id: rawUnit.id,
    selectionId: rawUnit.selectionId,
    factionId: rawUnit.armyId, // Store original faction ID
    originalName: rawUnit.name,
    customName: rawUnit.customName || rawUnit.name,
    cost: rawUnit.cost || 0,
    size: rawUnit.size || 1,
    // Stats (Initial values, may be modified by upgrades)
    defense: initialBaseDefense,
    quality: rawUnit.quality || 0,
    // Details (Initial values, may be modified by upgrades/loadout)
    rules: (rawUnit.rules || []).map((rule) => ({ ...rule })),
    items: (rawUnit.items || []).map((item) => ({ ...item })),
    bases: rawUnit.bases ? { ...rawUnit.bases } : null,
    xp: rawUnit.xp || 0,
    notes: rawUnit.notes || null,
    traits: rawUnit.traits || [],
    skills: rawUnit.skills || [],
    injuries: rawUnit.injuries || [],
    talents: rawUnit.talents || [],
    skillSets: rawUnit.skillSets || [],
    skillTraits: rawUnit.skillTraits || [],
    injuries: rawUnit.injuries || [],
    talents: rawUnit.talents || [],
    loadout: [], // Will be populated by _processUnitLoadout
    models: [], // Will be populated by _createModelsForUnit
    // Flags & Relations
    isHero: unitIsHero,
    canJoinUnitId: null, // Set later if applicable
    isCombined: rawUnit.combined || false,
    joinToUnitId: rawUnit.joinToUnit || null,
    toughnessUpgrades: [], // Stores upgrades granting Toughness { optionUid, count, toughValue }
    casterLevel: 0, // Initialize caster level
    _initialBaseDefense: initialBaseDefense, // Store for reference during upgrade processing
    _baseToughValue: baseToughValue, // Store for reference
  };

  // Calculate Caster Level *from base rules* initially
  const casterRule = processedUnit.rules.find((r) => r.name === "Caster");
  processedUnit.casterLevel = casterRule ? parseInt(casterRule.rating, 10) || 0 : 0;

  return processedUnit;
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
  const statProcessedRuleInstances = new Set(); // Track rule instances already processed for stats
  const toughUpgradeOptionCounts = {}; // Track how many times each Tough upgrade option is applied

  (rawUnit.selectedUpgrades || []).forEach((selectedUpgrade) => {
    const option = selectedUpgrade.option;
    if (!option) return; // Skip if no option data

    // --- Accumulate Cost ---
    const upgradeCostEntry = (option.costs || []).find((c) => c.unitId === processedUnit.id);
    if (upgradeCostEntry?.cost) {
      processedUnit.cost += parseInt(upgradeCostEntry.cost, 10) || 0;
    } else if (option.cost) {
      processedUnit.cost += parseInt(option.cost, 10) || 0;
    }

    if (!option.gains) return; // Skip if option grants nothing

    let optionGrantsTough = false;
    let optionToughValue = 0;

    // --- Process Gains (Rules, Items, Stats) ---
    option.gains.forEach((gain) => {
      // Unique key for this specific gain instance to avoid double-counting stat changes from the same source
      const gainInstanceKey = `upg_${selectedUpgrade.instanceId}_opt_${option.uid}_gain_${
        gain.name || gain.label || gain.id || Math.random()
      }`; // Use unique identifier

      /** Helper to process a gained rule */
      const processGainedRule = (rule, instanceKey) => {
        const ruleIdentifier = rule.id || rule.label || rule.name;
        if (!ruleIdentifier) return; // Skip if rule has no identifier

        // Add rule to unit if not already present
        if (!addedRuleIdentifiers.has(ruleIdentifier)) {
          processedUnit.rules.push({ ...rule });
          addedRuleIdentifiers.add(ruleIdentifier);
          // console.log(`Added rule "${ruleIdentifier}" to ${processedUnit.selectionId}`);
        }

        // Process stat changes only once per instance
        if (!statProcessedRuleInstances.has(instanceKey)) {
          const ratingValue = parseInt(rule.rating, 10);

          if (rule.name === "Caster" && !isNaN(ratingValue)) {
            // Explicitly handle Caster rule from upgrades
            // This will overwrite the base caster level if an upgrade provides it.
            // Assumes only one Caster upgrade applies; adjust if stacking is possible.
            processedUnit.casterLevel = ratingValue;
            statProcessedRuleInstances.add(instanceKey); // Mark as processed
            console.log(`Applied Caster(${ratingValue}) upgrade to ${processedUnit.selectionId}`);
          } else if (rule.name === "Tough" && !isNaN(ratingValue)) {
            optionGrantsTough = true;
            optionToughValue = ratingValue;
            statProcessedRuleInstances.add(instanceKey);
          } else if (
            rule.name === "Defense" &&
            !isNaN(ratingValue) &&
            !defenseModifiedByUpgrade // Only apply the first Defense upgrade found
          ) {
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
        if (gain.bases) processedUnit.bases = { ...gain.bases }; // Update base size if provided

        // Add item if new, otherwise just process its rules
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
          // Process rules granted by the item
          newItem.content.forEach((contentRule, idx) => {
            if (contentRule.type === "ArmyBookRule") {
              // Ensure it's a rule before processing
              processGainedRule(contentRule, `${gainInstanceKey}_content_${idx}`);
            }
            // Handle other content types like weapons if needed
          });
        } else {
          // Item already exists, just process its rules (in case this upgrade adds rules not present before)
          (gain.content || []).forEach((contentRule, idx) => {
            if (contentRule.type === "ArmyBookRule") {
              // Ensure it's a rule before processing
              processGainedRule(contentRule, `${gainInstanceKey}_content_${idx}`);
            }
            // Handle other content types like weapons if needed
          });
        }
      } else if (gain.type === "ArmyBookRule") {
        processGainedRule(gain, gainInstanceKey);
      }
    }); // End loop through gains

    // Track toughness upgrades for model creation later
    if (optionGrantsTough) {
      toughUpgradeOptionCounts[option.uid] = (toughUpgradeOptionCounts[option.uid] || 0) + 1;
      // Store the details of the toughness upgrade if not already stored
      if (!processedUnit.toughnessUpgrades.some((upg) => upg.optionUid === option.uid)) {
        processedUnit.toughnessUpgrades.push({
          optionUid: option.uid,
          count: 0, // Count will be updated later
          toughValue: optionToughValue,
        });
      }
    }
  }); // End loop through selectedUpgrades

  // Update the counts for each toughness upgrade based on how many times they were selected
  processedUnit.toughnessUpgrades.forEach((upg) => {
    upg.count = toughUpgradeOptionCounts[upg.optionUid] || 0;
  });

  // Apply final calculated stats
  processedUnit.quality = finalQuality;
  processedUnit.defense = finalDefense;

  // Final check: Log the caster level after upgrades are applied
  console.log(`Final Caster Level for ${processedUnit.selectionId}: ${processedUnit.casterLevel}`);
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
  // Use existing items array and identifier set from upgrade processing
  const finalLoadoutItems = processedUnit.items;
  const finalLoadoutItemIdentifiers = new Set(
    processedUnit.items.map((i) => i.id || i.label || i.name)
  );
  const addedRuleIdentifiers = new Set(processedUnit.rules.map((r) => r.id || r.label || r.name));

  (rawUnit.loadout || []).forEach((loadoutItem) => {
    if (loadoutItem.type === "ArmyBookWeapon") {
      // Directly add weapons to the loadout list
      finalLoadoutWeapons.push({
        ...loadoutItem,
        specialRules: (loadoutItem.specialRules || []).map((r) => ({ ...r })),
      });
    } else if (loadoutItem.type === "ArmyBookItem") {
      const itemIdentifier = loadoutItem.id || loadoutItem.label || loadoutItem.name;
      if (loadoutItem.bases) processedUnit.bases = { ...loadoutItem.bases }; // Update base size

      // Check if item already exists (from upgrades)
      let existingItem = finalLoadoutItems.find(
        (i) => (i.id || i.label || i.name) === itemIdentifier
      );
      if (!existingItem) {
        // Add new item if it doesn't exist
        existingItem = {
          ...loadoutItem,
          content: (loadoutItem.content || []).map((r) => ({ ...r })),
        };
        finalLoadoutItems.push(existingItem);
        finalLoadoutItemIdentifiers.add(itemIdentifier);
      }

      // Process content of the item (weapons or rules)
      (loadoutItem.content || []).forEach((contentItem) => {
        if (contentItem.type === "ArmyBookWeapon") {
          // Add weapons granted by the item to the loadout list
          finalLoadoutWeapons.push({
            ...contentItem,
            specialRules: (contentItem.specialRules || []).map((r) => ({
              ...r,
            })),
          });
        } else if (contentItem.type === "ArmyBookRule") {
          // Add rules granted by the item if not already present
          const ruleIdentifier = contentItem.id || contentItem.label || contentItem.name;
          if (!addedRuleIdentifiers.has(ruleIdentifier)) {
            processedUnit.rules.push({ ...contentItem });
            addedRuleIdentifiers.add(ruleIdentifier);
          }
        }
      });
    }
  }); // End loop through rawUnit.loadout

  processedUnit.loadout = finalLoadoutWeapons;
  processedUnit.items = finalLoadoutItems; // Update items array (might have new items from loadout)
}

/**
 * Creates the individual model objects for a unit based on its size and toughness upgrades.
 * Calculates maxHp for each model.
 * @param {object} processedUnit - The unit object being processed (mutated directly).
 * @private
 */
function _createModelsForUnit(processedUnit) {
  const models = [];
  const baseToughValue = processedUnit._baseToughValue;

  // Calculate how many models should receive the Toughness upgrade benefit
  const totalToughModelsNeeded = processedUnit.toughnessUpgrades.reduce(
    (sum, upg) => sum + upg.count,
    0
  );

  // Determine the Tough value granted by the upgrade (assuming only one type of Tough upgrade per unit for simplicity here)
  const upgradeToughValue =
    processedUnit.toughnessUpgrades.length > 0
      ? processedUnit.toughnessUpgrades[0].toughValue
      : baseToughValue; // Fallback to base if no upgrade

  for (let i = 0; i < processedUnit.size; i++) {
    let modelMaxHp = baseToughValue;
    let modelIsTough = baseToughValue > 1; // Base toughness > 1 means model is inherently Tough

    // Check if this model index falls within the count of models receiving a Toughness upgrade
    if (i < totalToughModelsNeeded) {
      modelIsTough = true; // Mark as tough due to upgrade
      // Special case: If a single-model unit gets a Tough upgrade, add the value.
      // Otherwise, the upgrade *sets* the Tough value for that specific model.
      if (processedUnit.size === 1 && processedUnit.toughnessUpgrades.length > 0) {
        modelMaxHp = baseToughValue + upgradeToughValue; // Additive for single model units
      } else {
        modelMaxHp = upgradeToughValue; // Sets the value for multi-model units
      }
    } else {
      // Model does not get the upgrade, use base toughness
      modelMaxHp = baseToughValue;
    }

    // Ensure HP is at least 1
    modelMaxHp = Math.max(1, modelMaxHp);

    models.push({
      modelId: `${processedUnit.selectionId}_model_${i + 1}`, // Unique ID for the model
      maxHp: modelMaxHp,
      currentHp: modelMaxHp, // Start at full health
      isHero: processedUnit.isHero, // Inherit hero status from unit
      isTough: modelIsTough, // Mark if base tough or upgraded tough
      baseStats: {
        // Store base stats for reference if needed later
        defense: processedUnit.defense,
        quality: processedUnit.quality,
      },
    });
  }
  processedUnit.models = models;
}

/**
 * Merges two units marked as 'combined' into a single unit entry.
 * Assumes unitB is the primary unit to merge into.
 * @param {object} unitA - The first combined unit.
 * @param {object} unitB - The second combined unit (will be modified).
 * @returns {object} The merged unit (unitB modified).
 * @private
 */
function _mergeCombinedUnits(unitA, unitB) {
  console.log(`Merging combined unit ${unitA.selectionId} into ${unitB.selectionId}`);
  const mergedUnit = unitB; // Modify unitB in place

  // Combine basic properties
  mergedUnit.customName = unitA.customName; // Use name from the second part
  mergedUnit.originalName = unitA.originalName;
  mergedUnit.cost += unitA.cost;
  mergedUnit.size += unitA.size;
  mergedUnit.xp += unitA.xp;
  mergedUnit.notes = [unitB.notes, unitA.notes].filter(Boolean).join("; ");
  mergedUnit.traits = [...new Set([...unitB.traits, ...unitA.traits])];
  mergedUnit.skillSets = [...new Set([...unitB.skillSets, ...unitA.skillSets])];
  mergedUnit.skillTraits = [...new Set([...unitB.skillTraits, ...unitA.skillTraits])];
  mergedUnit.injuries = [...new Set([...unitB.injuries, ...unitA.injuries])];
  mergedUnit.talents = [...new Set([...unitB.talents, ...unitA.talents])];

  // Use base unit's base size (arbitrary choice, usually consistent)
  mergedUnit.bases = unitB.bases ? { ...unitB.bases } : null;

  // Combine rules and remove duplicates based on ID or name/label
  const combinedRules = [...unitB.rules, ...unitA.rules];
  mergedUnit.rules = combinedRules.filter(
    (rule, index, self) =>
      index ===
      self.findIndex(
        (r) =>
          // Prioritize ID for uniqueness, fall back to name or label
          (r.id && rule.id && r.id === rule.id) ||
          (!r.id && !rule.id && r.name && rule.name && r.name === rule.name) ||
          (!r.id &&
            !rule.id &&
            !r.name &&
            !rule.name &&
            r.label &&
            rule.label &&
            r.label === rule.label)
      )
  );

  // Combine items, aggregating counts
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

  // Combine loadouts (weapons)
  mergedUnit.loadout = [...unitB.loadout, ...unitA.loadout];

  // Combine models
  mergedUnit.models = [...unitB.models, ...unitA.models];

  // Use base unit's stats (arbitrary choice, usually consistent)
  mergedUnit.quality = unitB.quality;
  mergedUnit.defense = unitB.defense;

  // Ensure merged models have correct base stats and are not heroes
  mergedUnit.models.forEach((model) => {
    model.baseStats = {
      defense: mergedUnit.defense,
      quality: mergedUnit.quality,
    };
    model.isHero = false; // Combined units are never heroes
  });

  // Update flags
  mergedUnit.isCombined = true;
  mergedUnit.joinToUnitId = null; // No longer joining
  mergedUnit.isHero = false;
  mergedUnit.canJoinUnitId = null;

  return mergedUnit;
}

// --- Main Processing Function ---

/**
 * Processes the raw army data from the Army Forge API into a structured format.
 * @param {object} rawData - The raw JSON data from the API.
 * @returns {object|null} The processed army object, or null if input is invalid.
 */
function processArmyData(rawData) {
  // Basic validation
  if (!rawData || !rawData.units) {
    console.error("Invalid raw data provided for processing.");
    return null;
  }

  // Initialize final army object structure
  const processedArmy = {
    meta: {
      id: rawData.id,
      key: rawData.key,
      name: rawData.name || "Unnamed Army",
      gameSystem: rawData.gameSystem,
      pointsLimit: rawData.pointsLimit || 0,
      listPoints: rawData.listPoints || 0,
      activationCount: rawData.activationCount || 0, // Will be recalculated
      modelCount: rawData.modelCount || 0, // Will be recalculated
      description: rawData.description || "",
      rawSpecialRules: rawData.specialRules || [],
      cloudModified: rawData.cloudModified,
      modified: rawData.modified,
    },
    units: [], // Final list of units (after merging)
    heroJoinTargets: {}, // Map of { heroSelectionId: targetUnitSelectionId }
    unitMap: {}, // Map of { selectionId: processedUnit } for easy lookup
  };

  const tempProcessedUnits = {}; // Store units temporarily before merging
  const unitsMergedInto = new Set(); // Track units that have been merged away

  // --- Step 1: Initial Processing & Upgrade/Loadout Application ---
  rawData.units.forEach((rawUnit) => {
    // 1a. Initialize basic unit structure
    const processedUnit = _initializeProcessedUnit(rawUnit);

    // 1b. Apply upgrades (modifies stats, rules, items, cost)
    _applyUpgradesToUnit(processedUnit, rawUnit);

    // 1c. Process loadout (adds weapons, potentially items/rules)
    _processUnitLoadout(processedUnit, rawUnit);

    // 1d. Create models based on final size and toughness
    _createModelsForUnit(processedUnit);

    // 1e. Final Hero Check & Join Target Recording
    if (processedUnit.isHero && rawUnit.joinToUnit) {
      processedUnit.canJoinUnitId = rawUnit.joinToUnit;
      processedArmy.heroJoinTargets[processedUnit.selectionId] = rawUnit.joinToUnit;
    }

    // Store the fully processed unit temporarily
    tempProcessedUnits[processedUnit.selectionId] = processedUnit;
  }); // End loop through rawUnits

  // --- Step 2: Merge Combined Units ---
  Object.values(tempProcessedUnits).forEach((unitA) => {
    // Check if unitA is the second part of a combined pair
    if (unitA.isCombined && unitA.joinToUnitId) {
      const unitB = tempProcessedUnits[unitA.joinToUnitId]; // Find the unit it joins to

      // Ensure unitB exists, is also combined, and hasn't already been merged into
      if (unitB && unitB.isCombined && !unitsMergedInto.has(unitB.selectionId)) {
        // Merge unitA into unitB
        _mergeCombinedUnits(unitA, unitB);
        // Mark unitA as merged away, it won't be added to the final list
        unitsMergedInto.add(unitA.selectionId);
      } else if (!unitB || !unitB.isCombined) {
        // Log a warning if the target unit is invalid
        console.warn(
          `Combined unit ${unitA.customName} (${unitA.selectionId}) points to invalid target ${unitA.joinToUnitId}. Treating as separate.`
        );
        // Ensure unitA is not treated as combined if its partner is missing/invalid
        unitA.isCombined = false;
        unitA.joinToUnitId = null;
      }
    }
  });

  // --- Step 3: Add Final Units to Army ---
  Object.values(tempProcessedUnits).forEach((unit) => {
    // Only add units that were not merged away
    if (!unitsMergedInto.has(unit.selectionId)) {
      // Double-check map to prevent duplicates (shouldn't happen with Set logic)
      if (!processedArmy.unitMap[unit.selectionId]) {
        processedArmy.units.push(unit);
        processedArmy.unitMap[unit.selectionId] = unit;
      }
    }
  });

  // --- Step 4: Final Adjustments ---
  // Recalculate total models and activations based on the final unit list
  processedArmy.meta.modelCount = processedArmy.units.reduce((sum, unit) => sum + unit.size, 0);
  processedArmy.meta.activationCount = processedArmy.units.length;

  // Clean up temporary properties from unit objects
  processedArmy.units.forEach((unit) => {
    delete unit._initialBaseDefense;
    delete unit._baseToughValue;
  });

  console.log("Army processing complete:", processedArmy);
  return processedArmy;
}

// Export the main processing function
export { processArmyData };
