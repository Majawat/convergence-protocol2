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
  return loadedArmiesData[armyId];
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
  loadedArmiesData = {};
  loadedArmiesData[armyId] = data;
} // Store only one army
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
  return loadedArmiesData[armyId]?.unitMap;
}

/** Gets the heroJoinTargets for the currently loaded army */
export function getCurrentArmyHeroTargets(armyId) {
  return loadedArmiesData[armyId]?.heroJoinTargets;
}

/** Gets all units for the currently loaded army */
export function getCurrentArmyUnits(armyId) {
  return loadedArmiesData[armyId]?.units;
}

/** Gets a specific unit from the loaded army */
export function getUnitData(armyId, unitId) {
  return loadedArmiesData[armyId]?.unitMap?.[unitId];
}

/** Gets a specific hero unit if joined to the given base unit */
export function getJoinedHeroData(armyId, baseUnitId) {
  const armyData = loadedArmiesData[armyId];
  if (!armyData || !armyData.heroJoinTargets) return null;
  const heroId = Object.keys(armyData.heroJoinTargets).find(
    (key) => armyData.heroJoinTargets[key] === baseUnitId
  );
  return heroId ? armyData.unitMap[heroId] : null;
}
