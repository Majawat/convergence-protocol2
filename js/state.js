/**
 * @fileoverview Manages application state, interacting with per-army and global storage.
 */
import {
  loadArmyState,
  saveArmyState,
  loadGameState,
  saveGameState,
} from "./storage.js";
import { config } from "./config.js"; // Import config for defaults like MAX_SPELL_TOKENS

// --- Global Non-Persistent State ---
let campaignData = null;
let armyBooksData = {}; // { factionId: data } - Still global cache
let commonRulesData = {}; // { gameSystemId: data } - Still global cache
let loadedArmiesData = {}; // { armyId: processedArmy } - Stores the *processed* data for the currently loaded army

// --- Global Persistent State (Managed via storage functions) ---
// Game state like currentRound is loaded/saved directly when needed

// --- Getters ---

export function getCampaignData() {
  return campaignData;
}
export function getArmyBooksData() {
  return armyBooksData;
}
export function getCommonRulesData() {
  return commonRulesData; // Assumes loadGameData populates this correctly
}

/** Gets the processed data object for the currently loaded army */
export function getLoadedArmyData() {
  // Removed armyId param - only one army loaded
  const currentId = getCurrentArmyId();
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
 * Returns a default structure if no state is found.
 * @param {string} [armyId] - The ID of the army. Defaults to current army.
 * @returns {object} The army's state object (never null, provides default).
 */
function getArmyState(armyId) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId) return { listPoints: 0, units: {} }; // Return default if no ID

  const state = loadArmyState(armyId);
  // Return loaded state or a default structure if null/undefined
  return state || { listPoints: 0, units: {} };
}

/**
 * Gets a specific unit's state object from a specific army's state.
 * Returns a default structure if the unit is not found.
 * @param {string} armyId - The ID of the army.
 * @param {string} unitId - The ID of the unit.
 * @returns {object} The unit's state object.
 */
function getUnitState(armyId, unitId) {
  const armyState = getArmyState(armyId);
  // Return existing unit state or a default structure
  return (
    armyState.units?.[unitId] || {
      status: "active", // Keep existing status
      shaken: false,
      fatigued: false,
      attackedInMeleeThisRound: false, // <-- Added default
      action: null,
      limitedWeaponUsed: false,
      tokens: 0,
      models: {},
    }
  );
}

/**
 * Gets a specific model's state object from a specific unit's state.
 * Returns a default structure if the model is not found.
 * @param {string} armyId - The ID of the army.
 * @param {string} unitId - The ID of the unit.
 * @param {string} modelId - The ID of the model.
 * @returns {object} The model's state object.
 */
function getModelState(armyId, unitId, modelId) {
  const unitState = getUnitState(armyId, unitId);
  // Return existing model state or a default structure
  return (
    unitState.models?.[modelId] || {
      currentHp: 1, // Default to 1 HP if not found? Or look up maxHP? Needs thought.
      // Let's assume initialization handles setting correct HP. Default needed if accessed before init.
      name: null,
    }
  );
}

/** Gets the list points for a specific army from its saved state. */
export function getArmyListPoints(armyId) {
  // Keep armyId param for potential external use
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId) return 0;
  const state = getArmyState(armyId); // getArmyState provides default
  return state.listPoints;
}

/** Gets a specific unit state value (e.g., shaken, fatigued, tokens, action). */
export function getUnitStateValue(armyId, unitId, key, defaultValue) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || !unitId || !key) return defaultValue;
  const unitState = getUnitState(armyId, unitId); // getUnitState provides default
  return unitState.hasOwnProperty(key) ? unitState[key] : defaultValue;
}

/** Gets a specific model state value (e.g., currentHp, name). */
export function getModelStateValue(armyId, unitId, modelId, key, defaultValue) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || !unitId || !modelId || !key) return defaultValue;
  const modelState = getModelState(armyId, unitId, modelId); // getModelState provides default
  return modelState.hasOwnProperty(key) ? modelState[key] : defaultValue;
}

// --- Global Game State Getters/Setters ---

/** Gets the current round number from global game state. */
export function getCurrentRound() {
  const gameState = loadGameState();
  return gameState.currentRound;
}

/** Sets the current round number in global game state. */
export function setCurrentRound(roundNumber) {
  if (typeof roundNumber !== "number" || roundNumber < 0) {
    console.error("Invalid round number provided to setCurrentRound.");
    return;
  }
  const gameState = loadGameState(); // Load current state
  gameState.currentRound = roundNumber;
  saveGameState(gameState); // Save updated state
}

/** Increments the current round number and saves it. */
export function incrementCurrentRound() {
  const currentRound = getCurrentRound();
  setCurrentRound(currentRound + 1);
  return currentRound + 1; // Return the new round number
}

// --- Setters ---

export function setCampaignData(data) {
  campaignData = data;
}
export function setArmyBooksData(data) {
  armyBooksData = data || {};
}
export function setCommonRulesData(data) {
  commonRulesData = data || {};
}

/** Stores the processed army data in memory and initializes/updates its state in localStorage */
export function setLoadedArmyData(armyId, processedData) {
  loadedArmiesData = {}; // Clear previous armies
  if (armyId && processedData) {
    loadedArmiesData[armyId] = processedData;

    // Initialize state in localStorage if it doesn't exist, or just update points
    let currentState = loadArmyState(armyId); // Load existing state if present
    const defaultState = {
      // Define default structure
      listPoints: processedData.meta.listPoints || 0,
      units: {},
    };

    if (!currentState) {
      currentState = defaultState;
      console.log(`Initializing new state for army ${armyId} in localStorage.`);
    } else {
      // Ensure listPoints is updated, keep existing units structure
      currentState.listPoints =
        processedData.meta.listPoints || currentState.listPoints || 0;
      // Ensure units object exists if it was missing in old data
      if (!currentState.units) currentState.units = {};
      console.log(
        `Loaded existing state for army ${armyId}, updated list points.`
      );
    }
    saveArmyState(armyId, currentState); // Save the initial/updated basic state
  } else {
    console.warn("Attempted to set loaded army data with invalid ID or data.");
  }
}

// --- Per-Army State Updaters (Load, Modify, Save) ---

/**
 * Updates a specific unit state value (e.g., shaken, fatigued, action, tokens, status) and saves.
 * @param {string} armyId - The ID of the army.
 * @param {string} unitId - The ID of the unit.
 * @param {string} key - The state key to update (e.g., 'shaken', 'tokens', 'action').
 * @param {*} value - The new value for the key.
 */
export function updateUnitStateValue(armyId, unitId, key, value) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || !unitId || !key) return;

  const currentState = getArmyState(armyId); // getArmyState loads or provides default

  // Ensure unit exists in state
  if (!currentState.units[unitId]) {
    // Initialize unit state if it doesn't exist
    currentState.units[unitId] = {
      status: "active",
      shaken: false,
      fatigued: false,
      attackedInMeleeThisRound: false, // <-- Added default
      action: null,
      limitedWeaponUsed: false,
      tokens: 0,
      models: {},
    };
    console.warn(`Initialized missing unit state for ${unitId} during update.`);
  }

  // Update the specific value
  currentState.units[unitId][key] = value;

  // Save the entire updated state object
  saveArmyState(armyId, currentState);
}

/**
 * Updates a specific model state value (e.g., currentHp, name) and saves.
 * @param {string} armyId - The ID of the army.
 * @param {string} unitId - The ID of the unit.
 * @param {string} modelId - The ID of the model.
 * @param {string} key - The state key to update (e.g., 'currentHp', 'name').
 * @param {*} value - The new value for the key.
 */
export function updateModelStateValue(armyId, unitId, modelId, key, value) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || !unitId || !modelId || !key) return;

  const currentState = getArmyState(armyId); // getArmyState loads or provides default

  // Ensure unit exists
  if (!currentState.units[unitId]) {
    currentState.units[unitId] = {
      status: "active",
      shaken: false,
      fatigued: false,
      attackedInMeleeThisRound: false, // <-- Added default
      action: null,
      limitedWeaponUsed: false,
      tokens: 0,
      models: {},
    };
  }
  // Ensure models object exists
  if (!currentState.units[unitId].models) {
    currentState.units[unitId].models = {};
  }
  // Ensure model exists
  if (!currentState.units[unitId].models[modelId]) {
    currentState.units[unitId].models[modelId] = { currentHp: 1, name: null }; // Provide default if missing
    console.warn(
      `Initialized missing model state for ${modelId} in unit ${unitId} during update.`
    );
    // Try to get maxHp if possible to set a better default currentHp
    const modelData = getLoadedArmyData()?.unitMap?.[unitId]?.models?.find(
      (m) => m.modelId === modelId
    );
    if (modelData) {
      currentState.units[unitId].models[modelId].currentHp = modelData.maxHp;
    }
  }

  // Update the specific value
  currentState.units[unitId].models[modelId][key] = value;

  // Save the entire updated state object
  saveArmyState(armyId, currentState);
}

/** Updates the list points for an army and saves. */
export function updateArmyListPoints(armyId, points) {
  if (!armyId) armyId = getCurrentArmyId();
  if (!armyId || typeof points !== "number") return;

  const currentState = getArmyState(armyId); // getArmyState loads or provides default
  currentState.listPoints = points;
  saveArmyState(armyId, currentState);
  // console.log(`Updated list points for army ${armyId} to ${points}.`);
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
