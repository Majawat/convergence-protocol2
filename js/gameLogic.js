/**
 * @fileoverview Contains game rule specific logic functions.
 */

/**
 * Finds the next model in the combined unit (base + hero) to apply a wound to automatically.
 * @param {object} baseUnit - The processed base unit data object.
 * @param {object | null} heroUnit - The processed hero unit data object, if joined.
 * @returns {object | null} The model object to wound, or null if none available.
 */
export function findTargetModelForWound(baseUnit, heroUnit = null) {
  if (!baseUnit || !baseUnit.models) return null;

  // Combine models from base unit and hero (if present)
  const combinedModels = heroUnit
    ? [...baseUnit.models, ...heroUnit.models]
    : [...baseUnit.models];
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

  // Check for Fast/Slow rules [cite: 224, 253]
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

// Add other game logic functions here later (e.g., morale checks)
