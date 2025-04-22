//@ts-check
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

// NOTE: performMoraleCheck function is removed as the logic is now handled
// by player prompts within the event handlers (_handleResolveMeleeClick, _handleMoraleWoundsClick).
// You could keep a function here just to calculate if a unit is <= half strength
// if that logic becomes complex (e.g., handling Tough values for single models).

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
