//@ts-check
/**
 * @fileoverview Handles saving and loading game state to localStorage using per-army keys and a global game state key.
 */

import { config } from "./config.js";
import { showToast } from "./uiHelpers.js";

// --- Army State ---

/**
 * Creates the localStorage key for a specific army's state.
 * @param {string} armyId - The ID of the army.
 * @returns {string | null} The localStorage key, or null if armyId is invalid.
 */
function getArmyStateKey(armyId) {
  if (!armyId || typeof armyId !== "string" || armyId.trim() === "") {
    console.error("Cannot generate army state key: Invalid armyId provided.");
    return null;
  }
  return `${config.ARMY_STATE_KEY_PREFIX}${armyId}`;
}

/**
 * Saves the state object for a specific army to localStorage.
 * @param {string} armyId - The ID of the army whose state is being saved.
 * @param {object} armyState - The complete state object for the army (structure defined in comments/docs).
 */
function saveArmyState(armyId, armyState) {
  const key = getArmyStateKey(armyId);
  if (!key) return; // Error handled in getArmyStateKey

  // Basic validation of the state object before saving
  if (
    !armyState ||
    typeof armyState !== "object" ||
    !armyState.units ||
    typeof armyState.units !== "object"
  ) {
    console.error(
      `Attempted to save invalid state structure for army ${armyId}. Aborting save.`,
      armyState
    );
    // Optionally, could throw an error or return false
    return;
  }

  try {
    localStorage.setItem(key, JSON.stringify(armyState));
    // console.log(`Saved state for army ${armyId}.`);
  } catch (error) {
    console.error(
      `Error saving state for army ${armyId} to localStorage:`,
      error
    );
    // Consider potential quota exceeded errors
    if (error.name === "QuotaExceededError") {
      // *** CHANGE: Use showToast instead of alert ***
      showToast(
        "Error: Local storage quota exceeded. Cannot save army state.",
        "Save Error"
      );
      // *** END CHANGE ***
    }
  }
}

/**
 * Loads the state object for a specific army from localStorage.
 * Performs basic validation on the loaded structure.
 * @param {string} armyId - The ID of the army whose state is being loaded.
 * @returns {object | null} The loaded state object, or null if not found, invalid, or error occurs.
 */
function loadArmyState(armyId) {
  const key = getArmyStateKey(armyId);
  if (!key) return null;

  try {
    const storedState = localStorage.getItem(key);
    if (storedState) {
      const parsedState = JSON.parse(storedState);

      // Validate the basic structure
      if (
        typeof parsedState === "object" &&
        parsedState !== null &&
        typeof parsedState.listPoints === "number" && // Check for listPoints
        typeof parsedState.units === "object" && // Check units is an object
        parsedState.units !== null
      ) {
        // Further validation could be added here (e.g., check structure of units/models)
        // console.log(`Loaded state for army ${armyId}.`);
        return parsedState;
      } else {
        console.warn(
          `Invalid state data structure found for army ${armyId}. Removing from storage.`,
          parsedState
        );
        localStorage.removeItem(key);
        return null;
      }
    }
    // console.log(`No state found in storage for army ${armyId}.`);
    return null; // No state found for this army
  } catch (error) {
    console.error(
      `Error loading or parsing state for army ${armyId} from localStorage:`,
      error
    );
    // Attempt to remove potentially corrupted data
    try {
      localStorage.removeItem(key);
    } catch (removeError) {
      console.error(`Failed to remove corrupted key ${key}`, removeError);
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

// --- Global Game State ---

/**
 * Loads the global game state from localStorage.
 * @returns {object} The loaded game state object, or a default object if not found/invalid.
 */
function loadGameState() {
  try {
    const storedState = localStorage.getItem(config.GAME_STATE_KEY);
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      // Basic validation
      if (
        typeof parsedState === "object" &&
        parsedState !== null &&
        typeof parsedState.currentRound === "number"
      ) {
        return parsedState;
      } else {
        console.warn(
          "Invalid global game state data found. Resetting to default."
        );
        localStorage.removeItem(config.GAME_STATE_KEY);
        return { currentRound: 0 }; // Default state
      }
    }
    return { currentRound: 0 }; // Default state if nothing stored
  } catch (error) {
    console.error("Error loading global game state:", error);
    return { currentRound: 0 }; // Default on error
  }
}

/**
 * Saves the global game state to localStorage.
 * @param {object} gameState - The game state object (e.g., { currentRound: number }).
 */
function saveGameState(gameState) {
  if (
    !gameState ||
    typeof gameState !== "object" ||
    typeof gameState.currentRound !== "number"
  ) {
    console.error("Attempted to save invalid global game state:", gameState);
    return;
  }
  try {
    localStorage.setItem(config.GAME_STATE_KEY, JSON.stringify(gameState));
  } catch (error) {
    console.error("Error saving global game state:", error);
  }
}

// --- Exports ---
export {
  saveArmyState,
  loadArmyState,
  resetArmyState,
  getArmyStateKey,
  loadGameState,
  saveGameState,
};
