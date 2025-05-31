//@ts-check
/**
 * @fileoverview Contains game rule specific logic functions.
 */

// --- IMPORTS ---

import { getArmyState, getUnitState, getAllLoadedArmyData, getArmyNameById } from "./state.js"; // Adjust path if needed

/**
 * Finds the next model in the combined unit (base + hero) to apply a wound to automatically.
 * @param {object} baseUnit - The processed base unit data object.
 * @param {object | null} heroUnit - The processed hero unit data object, if joined.
 * @returns {object | null} The model object to wound, or null if none available.
 */
export function findTargetModelForWound(baseUnit, heroUnit = null) {
  if (!baseUnit || !baseUnit.models) return null;

  // Combine models from base unit and hero (if present)
  const combinedModels = heroUnit ? [...baseUnit.models, ...heroUnit.models] : [...baseUnit.models];
  const activeModels = combinedModels.filter((m) => m.currentHp > 0);

  if (activeModels.length === 0) return null; // No models left to wound

  // 1. Target non-Hero, non-Tough models first
  const nonHeroNonTough = activeModels.filter((m) => !m.isHero && !m.isTough);
  if (nonHeroNonTough.length > 0) {
    // Find one within the baseUnit first if possible (arbitrary tie-break)
    const target = nonHeroNonTough.find((m) =>
      baseUnit.models.some((bm) => bm.modelId === m.modelId)
    );
    return target || nonHeroNonTough[0];
  }

  // 2. Target non-Hero, Tough models (most wounded first)
  const nonHeroTough = activeModels.filter((m) => !m.isHero && m.isTough);
  if (nonHeroTough.length > 0) {
    nonHeroTough.sort((a, b) => a.currentHp - b.currentHp);
    return nonHeroTough[0];
  }

  // 3. Target Hero models last (most wounded first)
  const heroes = activeModels.filter((m) => m.isHero);
  if (heroes.length > 0) {
    heroes.sort((a, b) => a.currentHp - b.currentHp);
    return heroes[0];
  }

  return null; // Fallback
}

/**
 * Calculates the movement distance for a unit based on the action type and unit rules.
 * Considers Fast/Slow rules. Base movement speeds: Hold=0", Advance=6", Rush/Charge=12".
 * @param {object} unitData - The processed unit data (either base unit or joined hero if applicable for movement).
 * @param {'Hold' | 'Advance' | 'Rush' | 'Charge'} actionType - The type of action being taken.
 * @returns {number} The calculated movement distance in inches.
 */
export function calculateMovement(unitData, actionType) {
  if (!unitData) return 0;

  let baseMovement = 0;
  switch (actionType) {
    case "Advance":
      baseMovement = 6;
      break;
    case "Rush":
    case "Charge":
      baseMovement = 12;
      break;
    case "Hold":
    default:
      baseMovement = 0;
      break;
  }

  if (baseMovement === 0) return 0; // No modifiers for Hold

  // Check for Fast/Slow rules
  const hasFast = unitData.rules?.some((rule) => rule.name === "Fast");
  const hasSlow = unitData.rules?.some((rule) => rule.name === "Slow");

  if (hasFast) {
    return baseMovement === 6 ? baseMovement + 2 : baseMovement + 4; // Advance +2", Rush/Charge +4"
  } else if (hasSlow) {
    return baseMovement === 6 ? baseMovement - 2 : baseMovement - 4; // Advance -2", Rush/Charge -4"
  } else {
    return baseMovement;
  }
}

/**
 * Calculates the XP earned for each unit in an army based on the final game state.
 * @param {string} armyId - The ID of the army to calculate XP for.
 * @returns {object | null} An object where keys are unit IDs and values contain
 * unit name, final status, kill details, XP breakdown, total XP,
 * casualty outcome, and killedBy info. Returns null if data is missing.
 */
export function calculateArmyXP(armyId) {
  console.debug(`DEBUG: Calculating XP for army ${armyId}`);
  const armyState = getArmyState(armyId); // Gets the final state from localStorage
  const allProcessedArmies = getAllLoadedArmyData();
  const processedArmyData = allProcessedArmies ? allProcessedArmies[armyId] : null;

  if (!armyState || !processedArmyData || !processedArmyData.units) {
    console.error(`Cannot calculate XP: Missing state or processed data for army ${armyId}`);
    return null;
  }

  const xpResults = {};

  // Iterate through the units defined in the processed data (original army list)
  processedArmyData.units.forEach((unitData) => {
    const unitId = unitData.selectionId;
    const unitState = getUnitState(armyId, unitId); // Get final state, ensuring defaults
    const unitName = unitData.customName || unitData.originalName;

    const finalStatus = unitState.status || "active"; // Default to active if somehow missing
    const survived = finalStatus !== "destroyed" && finalStatus !== "routed";

    let unitTotalXP = 0;
    const xpBreakdown = {
      survived: 0,
      standardKills: 0, // Count of non-hero kills
      heroKills: 0, // Count of hero kills
      // We calculate total from these counts
    };

    // 1. Survival XP
    if (survived) {
      xpBreakdown.survived = 1;
      unitTotalXP += 1;
    }

    // 2. Kill XP
    const killsMade = unitState.killsRecorded || [];
    killsMade.forEach((kill) => {
      if (kill.victimIsHero) {
        xpBreakdown.heroKills += 1;
        unitTotalXP += 2; // +2 total XP for killing a Hero
      } else {
        xpBreakdown.standardKills += 1;
        unitTotalXP += 1; // +1 total XP for killing a standard unit
      }
    });

    // 3. Get Casualty Outcome and Killed By info for display
    const casualtyOutcome = unitState.casualtyOutcome || null;
    let killedByInfo = null;
    if (unitState.killedBy) {
      killedByInfo = {
        attackerUnitName: unitState.killedBy.attackerUnitName || "Unknown Unit",
        attackerArmyName: getArmyNameById(unitState.killedBy.attackerArmyId) || "Unknown Army",
      };
    }

    // Store results for this unit
    xpResults[unitId] = {
      id: unitId, // Include ID for reference
      name: unitName,
      finalStatus: finalStatus,
      survived: survived,
      killsRecorded: killsMade, // Pass full kill list if needed for display
      killedBy: killedByInfo, // Pass formatted info
      casualtyOutcome: casualtyOutcome,
      xpBreakdown: xpBreakdown,
      totalXpEarned: unitTotalXP,
    };
  });

  console.debug(`DEBUG: XP Calculation Results for ${armyId}:`, xpResults);
  return xpResults;
}

/**
 * Checks if a unit is at half strength or less based on current HP.
 * NOTE: This needs access to the unit's STARTING size/toughness for accuracy.
 * Currently uses processed data size, which might be inaccurate if size changes mid-game.
 * @param {object} unitData - Processed unit data.
 * @returns {boolean} True if at half strength or less.
 */
export function checkHalfStrength(unitData) {
  if (!unitData) return false;
  // TODO: Get starting size/toughness reliably (e.g., from initial load or state)
  const startingSize = unitData.size; // Placeholder - needs actual starting size
  const currentModels = unitData.models.filter((m) => m.currentHp > 0).length;
  // TODO: Handle Tough(X) models correctly if needed for single-model units
  return currentModels * 2 <= startingSize;
}
