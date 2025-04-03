/**
 * @fileoverview Handles saving and loading game state to localStorage using per-army keys.
 */

import { config } from "./config.js";

/**
 * Creates the localStorage key for a specific army's state.
 * @param {string} armyId - The ID of the army.
 * @returns {string} The localStorage key.
 */
function getArmyStateKey(armyId) {
  if (!armyId) {
    console.error("Cannot generate army state key without armyId.");
    return null; // Or throw an error
  }
  return `${config.ARMY_STATE_KEY_PREFIX}${armyId}`;
}

/**
 * Saves the state object for a specific army to localStorage.
 * The state object should contain listPoints, woundState, componentState, etc.
 * @param {string} armyId - The ID of the army whose state is being saved.
 * @param {object} armyState - The complete state object for the army.
 */
function saveArmyState(armyId, armyState) {
  const key = getArmyStateKey(armyId);
  if (!key || !armyState) {
    console.error("Missing armyId or armyState for saveArmyState.", {
      armyId,
      armyState,
    });
    return;
  }
  try {
    localStorage.setItem(key, JSON.stringify(armyState));
    // console.log(`Saved state for army ${armyId}:`, armyState);
  } catch (error) {
    console.error(
      `Error saving state for army ${armyId} to localStorage:`,
      error
    );
  }
}

/**
 * Loads the state object for a specific army from localStorage.
 * @param {string} armyId - The ID of the army whose state is being loaded.
 * @returns {object | null} The loaded state object, or null if not found or error occurs.
 */
function loadArmyState(armyId) {
  const key = getArmyStateKey(armyId);
  if (!key) return null;

  try {
    const storedState = localStorage.getItem(key);
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      // Basic validation - ensure it's an object
      if (typeof parsedState === "object" && parsedState !== null) {
        // console.log(`Loaded state for army ${armyId}:`, parsedState);
        return parsedState;
      } else {
        console.warn(`Invalid state data found for army ${armyId}. Removing.`);
        localStorage.removeItem(key);
        return null;
      }
    }
    return null; // No state found for this army
  } catch (error) {
    console.error(
      `Error loading state for army ${armyId} from localStorage:`,
      error
    );
    // Attempt to remove potentially corrupted data
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      /* Ignore */
    }
    return null;
  }
}

/**
 * Resets (clears) the saved state for a specific army from localStorage.
 * @param {string} armyId - The ID of the army whose state should be reset.
 * */
function resetArmyState(armyId) {
  const key = getArmyStateKey(armyId);
  if (!key) return;

  try {
    localStorage.removeItem(key);
    console.log(`Saved state reset for army ${armyId}.`);
  } catch (error) {
    console.error(
      `Error resetting state for army ${armyId} in localStorage:`,
      error
    );
  }
}

// Export the new functions
export {
  saveArmyState,
  loadArmyState,
  resetArmyState,
  getArmyStateKey, // Export helper if needed elsewhere, though maybe not
};
