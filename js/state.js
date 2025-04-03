/**
 * @fileoverview Manages the global application state.
 */

// --- State Variables ---
let campaignData = null;
let armyBooksData = {}; // { factionId: data }
let commonRulesData = {}; // { gameSystemId: data }
let loadedArmiesData = {}; // { armyId: processedArmy } - Stores the currently loaded army
let armyWoundStates = {}; // { armyId: { unitId: { modelId: currentHp, ... }, ... }, ... }
let armyComponentStates = {}; // { armyId: { unitId: { tokens: T, ... }, ... }, ... }

// --- Getters ---
export function getCampaignData() {
  return campaignData;
}
export function getArmyBooksData() {
  return armyBooksData;
}
export function getCommonRulesData() {
  return commonRulesData;
}
export function getLoadedArmyData(armyId) {
  // Return specific army data if ID is provided and exists
  if (armyId && loadedArmiesData[armyId]) {
    return loadedArmiesData[armyId];
  }
  // If no specific ID, or ID not found, maybe return null or the first one?
  // For safety, let's return null if the specific ID isn't found.
  // The original intent might have been to get *any* loaded army if no ID specified,
  // but the current structure holds only one.
  return loadedArmiesData[armyId] || null; // Return null if armyId doesn't match
}
export function getArmyWoundStates() {
  return armyWoundStates;
}
export function getArmyComponentStates() {
  return armyComponentStates;
}

/** Gets a specific component state value, returning a default if not found. */
export function getComponentStateValue(armyId, unitId, key, defaultValue) {
  return armyComponentStates[armyId]?.[unitId]?.[key] ?? defaultValue;
}

// ****** START NEW FUNCTION ******
/** Gets the ID of the currently loaded army, if any */
export function getCurrentArmyId() {
  const keys = Object.keys(loadedArmiesData);
  return keys.length > 0 ? keys[0] : null; // Return the first (only) key, or null if empty
}
// ****** END NEW FUNCTION ******

// --- Setters ---
export function setCampaignData(data) {
  campaignData = data;
}
export function setArmyBooksData(data) {
  armyBooksData = data;
}
export function setCommonRulesData(data) {
  commonRulesData = data;
}
export function setLoadedArmyData(armyId, data) {
  loadedArmiesData = {}; // Clear previous armies
  if (armyId && data) {
    // Only set if valid ID and data provided
    loadedArmiesData[armyId] = data;
  }
}
export function setArmyWoundStates(data) {
  armyWoundStates = data || {};
}
export function setArmyComponentStates(data) {
  armyComponentStates = data || {};
}

/** Updates the global component state object (e.g., for tokens). */
export function updateGlobalComponentState(armyId, unitId, key, value) {
  if (!armyComponentStates[armyId]) armyComponentStates[armyId] = {};
  if (!armyComponentStates[armyId][unitId])
    armyComponentStates[armyId][unitId] = {};
  armyComponentStates[armyId][unitId][key] = value;
}

/** Updates the global wound state object */
export function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
  if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
  if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
  armyWoundStates[armyId][unitId][modelId] = currentHp;
}

/** Gets the unitMap for the currently loaded army */
export function getCurrentArmyUnitMap(armyId) {
  const currentId = armyId || getCurrentArmyId(); // Use provided ID or get current
  return currentId ? loadedArmiesData[currentId]?.unitMap : null;
}

/** Gets the heroJoinTargets for the currently loaded army */
export function getCurrentArmyHeroTargets(armyId) {
  const currentId = armyId || getCurrentArmyId(); // Use provided ID or get current
  return currentId ? loadedArmiesData[currentId]?.heroJoinTargets : null;
}

/** Gets all units for the currently loaded army */
export function getCurrentArmyUnits(armyId) {
  const currentId = armyId || getCurrentArmyId(); // Use provided ID or get current
  return currentId ? loadedArmiesData[currentId]?.units : null;
}

/** Gets a specific unit from the loaded army */
export function getUnitData(armyId, unitId) {
  const currentId = armyId || getCurrentArmyId(); // Use provided ID or get current
  return currentId ? loadedArmiesData[currentId]?.unitMap?.[unitId] : null;
}

/** Gets a specific hero unit if joined to the given base unit */
export function getJoinedHeroData(armyId, baseUnitId) {
  const currentId = armyId || getCurrentArmyId(); // Use provided ID or get current
  const armyData = currentId ? loadedArmiesData[currentId] : null;

  if (!armyData || !armyData.heroJoinTargets) return null;

  // Find the hero ID whose target value matches the baseUnitId
  const heroId = Object.keys(armyData.heroJoinTargets).find(
    (key) => armyData.heroJoinTargets[key] === baseUnitId
  );

  return heroId ? armyData.unitMap[heroId] : null;
}
