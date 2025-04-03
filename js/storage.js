/**
 * @fileoverview Handles saving and loading game state to localStorage.
 */

import { config } from "./config.js";

// --- Wound State ---

/**
 * Saves the entire wound state for all armies to localStorage.
 * @param {object} woundState - Example: { armyId1: { unitId1: { modelId1: currentHp, ... }, ... }, ... }
 */
function saveWoundState(woundState) {
  try {
    localStorage.setItem(config.WOUND_STATE_KEY, JSON.stringify(woundState));
  } catch (error) {
    console.error("Error saving wound state to localStorage:", error);
  }
}

/**
 * Loads the entire wound state from localStorage.
 * @returns {object | null} The loaded wound state object, or null.
 */
function loadWoundState() {
  try {
    const storedState = localStorage.getItem(config.WOUND_STATE_KEY);
    return storedState ? JSON.parse(storedState) : null;
  } catch (error) {
    console.error("Error loading wound state from localStorage:", error);
    return null;
  }
}

/** Resets (clears) the saved wound state from localStorage. */
function resetWoundState() {
  try {
    localStorage.removeItem(config.WOUND_STATE_KEY);
    console.log("Saved wound state reset.");
  } catch (error) {
    console.error("Error resetting wound state in localStorage:", error);
  }
}

// --- Component State (Tokens, etc.) ---

/**
 * Saves the entire component state (tokens, etc.) for all armies to localStorage.
 * @param {object} componentState - Example: { armyId1: { unitId1: { tokens: T }, ... }, ... }
 */
function saveComponentState(componentState) {
  try {
    localStorage.setItem(
      config.COMPONENT_STATE_KEY,
      JSON.stringify(componentState)
    );
    // console.log('Component state saved:', componentState);
  } catch (error) {
    console.error("Error saving component state to localStorage:", error);
  }
}

/**
 * Loads the entire component state from localStorage.
 * @returns {object | null} The loaded component state object, or null.
 */
function loadComponentState() {
  try {
    const storedState = localStorage.getItem(config.COMPONENT_STATE_KEY);
    // console.log('Loaded component state string:', storedState);
    const parsedState = storedState ? JSON.parse(storedState) : null;
    // console.log('Parsed component state:', parsedState);
    return parsedState;
  } catch (error) {
    console.error("Error loading component state from localStorage:", error);
    return null;
  }
}

/** Resets (clears) the saved component state from localStorage. */
function resetComponentState() {
  try {
    localStorage.removeItem(config.COMPONENT_STATE_KEY);
    console.log("Saved component state reset.");
  } catch (error) {
    console.error("Error resetting component state in localStorage:", error);
  }
}

// Export all functions
export {
  saveWoundState,
  loadWoundState,
  resetWoundState,
  saveComponentState,
  loadComponentState,
  resetComponentState,
};
