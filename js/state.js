/**
 * @fileoverview Manages application state, interacting with per-army storage.
 */
import { loadArmyState, saveArmyState } from "./storage.js";

// --- Global Non-Persistent State ---
let campaignData = null;
let armyBooksData = {}; // { factionId: data } - Still global cache
let commonRulesData = {}; // { gameSystemId: data } - Still global cache
let loadedArmiesData = {}; // { armyId: processedArmy } - Stores the *processed* data for the currently loaded army

// --- Getters ---

export function getCampaignData() {
  return campaignData;
}
export function getArmyBooksData() {
  return armyBooksData;
}
export function getCommonRulesData() {
  // Return the whole object, loadGameData ensures it only contains the required system
  return commonRulesData;
}

/** Gets the processed data object for the currently loaded army */
export function getLoadedArmyData(armyId) {
  const currentId = armyId || getCurrentArmyId();
  return currentId ? loadedArmiesData[currentId] : null;
}

/** Gets the ID of the currently loaded army, if any */
export function getCurrentArmyId() {
  const keys = Object.keys(loadedArmiesData);
  return keys.length > 0 ? keys[0] : null;
}

// --- Per-Army State Getters (Load from storage on demand) ---

/**
 * Gets the complete state object for a specific army from storage.
 * @param {string} armyId - The ID of the army.
 * @returns {object | null} The army's state object or null.
 */
function getArmyState(armyId) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId) return null;
  return loadArmyState(armyId);
}

/** Gets the wound state part for a specific army. */
export function getArmyWoundStates(armyId) {
  if (!armyId) armyId = getCurrentArmyId();
  const state = getArmyState(armyId);
  return state?.woundState || {}; // Return empty object if no state or no woundState
}

/** Gets the component state part for a specific army. */
export function getArmyComponentStates(armyId) {
  if (!armyId) armyId = getCurrentArmyId();
  const state = getArmyState(armyId);
  return state?.componentState || {}; // Return empty object if no state or no componentState
}

/** Gets a specific component state value for a specific army, returning a default if not found. */
export function getComponentStateValue(armyId, unitId, key, defaultValue) {
  if (!armyId) armyId = getCurrentArmyId();
  const components = getArmyComponentStates(armyId);
  return components[unitId]?.[key] ?? defaultValue;
}

/** Gets the list points for a specific army from its saved state. */
export function getArmyListPoints(armyId) {
  if (!armyId) armyId = getCurrentArmyId();
  const state = getArmyState(armyId);
  return state?.listPoints || 0; // Return 0 if not found
}

// --- Setters ---

export function setCampaignData(data) {
  campaignData = data;
}
export function setArmyBooksData(data) {
  armyBooksData = data;
}
export function setCommonRulesData(data) {
  // Assumes data is already structured correctly { requiredGsId: rulesData }
  commonRulesData = data || {};
}

/** Stores the processed army data in memory and initializes its state in localStorage */
export function setLoadedArmyData(armyId, processedData) {
  loadedArmiesData = {}; // Clear previous armies
  if (armyId && processedData) {
    loadedArmiesData[armyId] = processedData;

    // Initialize state in localStorage if it doesn't exist, or just update points
    let currentState = loadArmyState(armyId);
    if (!currentState) {
      // Create initial state structure
      currentState = {
        listPoints: processedData.meta.listPoints || 0,
        woundState: {},
        componentState: {},
        // Add other initial state fields here if needed
      };
      console.log(`Initializing new state for army ${armyId} in localStorage.`);
    } else {
      // Update list points in existing state
      currentState.listPoints =
        processedData.meta.listPoints || currentState.listPoints || 0;
      console.log(`Updating list points for army ${armyId} in localStorage.`);
    }
    saveArmyState(armyId, currentState);
  } else {
    console.warn("Attempted to set loaded army data with invalid ID or data.");
  }
}

// --- Per-Army State Updaters (Load, Modify, Save) ---

/** Updates a specific component state value for an army and saves. */
export function updateArmyComponentState(armyId, unitId, key, value) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId) return; // Cannot update without ID

  const currentState = loadArmyState(armyId) || {
    listPoints: getArmyListPoints(armyId),
    woundState: {},
    componentState: {},
  }; // Load or initialize

  // Ensure nested structure exists
  if (!currentState.componentState) currentState.componentState = {};
  if (!currentState.componentState[unitId])
    currentState.componentState[unitId] = {};

  // Update the value
  currentState.componentState[unitId][key] = value;

  // Save the entire updated state object
  saveArmyState(armyId, currentState);
}

/** Updates a specific model's wound state for an army and saves. */
export function updateArmyWoundState(armyId, unitId, modelId, currentHp) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId) return; // Cannot update without ID

  const currentState = loadArmyState(armyId) || {
    listPoints: getArmyListPoints(armyId),
    woundState: {},
    componentState: {},
  }; // Load or initialize

  // Ensure nested structure exists
  if (!currentState.woundState) currentState.woundState = {};
  if (!currentState.woundState[unitId]) currentState.woundState[unitId] = {};

  // Update the value
  currentState.woundState[unitId][modelId] = currentHp;

  // Save the entire updated state object
  saveArmyState(armyId, currentState);
}

/** Updates the list points for an army and saves. */
export function updateArmyListPoints(armyId, points) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || typeof points !== "number") return; // Cannot update without ID or valid points

  const currentState = loadArmyState(armyId) || {
    listPoints: 0,
    woundState: {},
    componentState: {},
  }; // Load or initialize
  currentState.listPoints = points;
  saveArmyState(armyId, currentState);
  console.log(`Updated list points for army ${armyId} to ${points}.`);
}

// --- Utility Getters using Current Army Context ---

/** Gets the unitMap for the currently loaded army */
export function getCurrentArmyUnitMap() {
  const currentId = getCurrentArmyId();
  return currentId ? loadedArmiesData[currentId]?.unitMap : null;
}

/** Gets the heroJoinTargets for the currently loaded army */
export function getCurrentArmyHeroTargets() {
  const currentId = getCurrentArmyId();
  return currentId ? loadedArmiesData[currentId]?.heroJoinTargets : null;
}

/** Gets all units (processed data) for the currently loaded army */
export function getCurrentArmyUnits() {
  const currentId = getCurrentArmyId();
  return currentId ? loadedArmiesData[currentId]?.units : null;
}

/** Gets a specific unit's processed data from the currently loaded army */
export function getUnitData(unitId) {
  // Removed armyId param, assumes current army
  const currentId = getCurrentArmyId();
  return currentId ? loadedArmiesData[currentId]?.unitMap?.[unitId] : null;
}

/** Gets a specific hero unit's processed data if joined to the given base unit in the currently loaded army */
export function getJoinedHeroData(baseUnitId) {
  // Removed armyId param
  const currentId = getCurrentArmyId();
  const armyData = currentId ? loadedArmiesData[currentId] : null;

  if (!armyData || !armyData.heroJoinTargets) return null;

  const heroId = Object.keys(armyData.heroJoinTargets).find(
    (key) => armyData.heroJoinTargets[key] === baseUnitId
  );

  return heroId ? armyData.unitMap[heroId] : null;
}
