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

// Add other game logic functions here later (e.g., morale checks, activation logic)
