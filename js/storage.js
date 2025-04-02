/**
 * @fileoverview Handles saving and loading game state (like wounds) to localStorage.
 */

const WOUND_STATE_KEY = "oprArmyTracker_woundState";

/**
 * Saves the entire wound state for all armies to localStorage.
 * @param {object} woundState - An object where keys are army IDs, and values are
 * objects mapping unit IDs to model wound states.
 * Example: { armyId1: { unitId1: { modelId1: currentHp, ... }, ... }, ... }
 */
function saveWoundState(woundState) {
  try {
    localStorage.setItem(WOUND_STATE_KEY, JSON.stringify(woundState));
    // console.log('Wound state saved:', woundState);
  } catch (error) {
    console.error("Error saving wound state to localStorage:", error);
    // Optionally: notify the user if storage fails (e.g., quota exceeded)
  }
}

/**
 * Loads the entire wound state from localStorage.
 * @returns {object | null} The loaded wound state object, or null if none exists or an error occurs.
 */
function loadWoundState() {
  try {
    const storedState = localStorage.getItem(WOUND_STATE_KEY);
    if (storedState) {
      const parsedState = JSON.parse(storedState);
      // console.log('Wound state loaded:', parsedState);
      return parsedState;
    }
    // console.log('No saved wound state found.');
    return null;
  } catch (error) {
    console.error("Error loading wound state from localStorage:", error);
    return null;
  }
}

/**
 * Resets (clears) the saved wound state from localStorage.
 */
function resetWoundState() {
  try {
    localStorage.removeItem(WOUND_STATE_KEY);
    console.log("Saved wound state reset.");
  } catch (error) {
    console.error("Error resetting wound state in localStorage:", error);
  }
}

// Export the functions
export { saveWoundState, loadWoundState, resetWoundState };
