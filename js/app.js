// Import functions from other modules
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
// Import UI functions, including the new updateModelDisplay
import { displayArmyUnits, updateModelDisplay } from "./ui.js";
// Import localStorage functions
import { saveWoundState, loadWoundState, resetWoundState } from "./storage.js";

// --- Global State ---
let loadedArmiesData = {}; // Stores full processed army data { armyId: processedArmy }
let armyWoundStates = {}; // Stores just wound states for localStorage { armyId: { unitId: { modelId: currentHp, ... }, ... }, ... }

// --- Constants ---
const ARMY_IDS_TO_LOAD = [
  "PzfU8vxUivqn", // Galdoo'o naahlk wildigitkw
  "Xo19MAwQPGbs", // van Louen's Roughnecks
  "Un3_pRTu2xBO", // Hive Fleet Tarvos
  "vMzljLVC6ZGv", // The Ashen Pact
];

// --- Wound Allocation Logic ---

/**
 * Finds the next model in the unit to apply a wound to automatically, following OPR rules.
 * @param {object} unit - The processed unit data object.
 * @returns {object | null} The model object to wound, or null if none available.
 */
function findTargetModelForWound(unit) {
  if (!unit || !unit.models) return null;
  const activeModels = unit.models.filter(m => m.currentHp > 0);
  if (activeModels.length === 0) return null;

  // 1. Target non-Hero, non-Tough models first
  const nonHeroNonTough = activeModels.filter(m => !m.isHero && !m.isTough);
  if (nonHeroNonTough.length > 0) return nonHeroNonTough[0];

  // 2. Target non-Hero, Tough models (most wounded first)
  const nonHeroTough = activeModels.filter(m => !m.isHero && m.isTough);
  if (nonHeroTough.length > 0) {
    nonHeroTough.sort((a, b) => a.currentHp - b.currentHp);
    return nonHeroTough[0];
  }

  // 3. Target Hero models last (most wounded first)
  const heroes = activeModels.filter(m => m.isHero);
  if (heroes.length > 0) {
    heroes.sort((a, b) => a.currentHp - b.currentHp);
    return heroes[0];
  }
  return null;
}

/**
 * Finds the next model in the unit to heal a wound from automatically.
 * **MODIFIED:** Prioritizes healing removed models (Hero > Tough > Regular),
 * then wounded models (Hero > Tough > Regular), healing most wounded first in each group.
 * @param {object} unit - The processed unit data object.
 * @returns {object | null} The model object to heal, or null if none can be healed.
 */
function findTargetModelForHeal(unit) {
    if (!unit || !unit.models) return null;

    const models = unit.models;
    const removed = models.filter(m => m.currentHp <= 0);
    const woundedActive = models.filter(m => m.currentHp > 0 && m.currentHp < m.maxHp);

    // Sort function: lowest HP first
    const sortByLowestHp = (a, b) => a.currentHp - b.currentHp;
    // Sort function: highest negative HP first (closest to 0)
    const sortByClosestToZero = (a, b) => b.currentHp - a.currentHp;

    // 1. Heal Removed Heroes (closest to 0)
    const removedHeroes = removed.filter(m => m.isHero).sort(sortByClosestToZero);
    if (removedHeroes.length > 0) return removedHeroes[0];

    // 2. Heal Removed Tough non-Heroes (closest to 0)
    const removedTough = removed.filter(m => !m.isHero && m.isTough).sort(sortByClosestToZero);
    if (removedTough.length > 0) return removedTough[0];

    // 3. Heal Removed Regular non-Heroes (closest to 0)
    const removedRegular = removed.filter(m => !m.isHero && !m.isTough).sort(sortByClosestToZero);
    if (removedRegular.length > 0) return removedRegular[0];

    // 4. Heal Wounded Active Heroes (lowest HP)
    const woundedHeroes = woundedActive.filter(m => m.isHero).sort(sortByLowestHp);
    if (woundedHeroes.length > 0) return woundedHeroes[0];

    // 5. Heal Wounded Active Tough non-Heroes (lowest HP)
    const woundedTough = woundedActive.filter(m => !m.isHero && m.isTough).sort(sortByLowestHp);
    if (woundedTough.length > 0) return woundedTough[0];

    // 6. Heal Wounded Active Regular non-Heroes (lowest HP)
    const woundedRegular = woundedActive.filter(m => !m.isHero && !m.isTough).sort(sortByLowestHp);
    if (woundedRegular.length > 0) return woundedRegular[0];

    // No models eligible for healing
    return null;
}


/**
 * Updates the global wound state object used for saving.
 * @param {string} armyId
 * @param {string} unitId
 * @param {string} modelId
 * @param {number} currentHp
 */
function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
    if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
    if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
    armyWoundStates[armyId][unitId][modelId] = currentHp;
}

/**
 * Removes the highlight from any previously targeted model in a unit.
 * @param {string} unitSelectionId
 */
function clearTargetHighlight(unitSelectionId) {
    const card = document.getElementById(`unit-card-${unitSelectionId}`);
    if (!card) return;
    const highlighted = card.querySelector('.model-display.target-model');
    if (highlighted) {
        highlighted.classList.remove('target-model');
    }
}

/**
 * Adds a highlight to the next model that will take a wound (auto-target).
 * @param {string} unitSelectionId
 * @param {string | null} modelId - The ID of the model to highlight, or null to clear.
 */
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
    clearTargetHighlight(unitSelectionId); // Clear previous highlight first
    if (!modelId) return; // If no model ID, just clear

    const card = document.getElementById(`unit-card-${unitSelectionId}`);
    if (!card) return;
    const modelElement = card.querySelector(`[data-model-id="${modelId}"]`);
    if (modelElement) {
        modelElement.classList.add('target-model');
    }
}

/**
 * Applies a wound to a specific model or uses auto-target logic.
 * @param {string} armyId
 * @param {string} unitId
 * @param {string | null} specificModelId - ID of the model clicked, or null if auto-target button used.
 */
function applyWound(armyId, unitId, specificModelId = null) {
    const unitData = loadedArmiesData[armyId]?.unitMap[unitId];
    if (!unitData) {
        console.error(`Unit data not found for applyWound: army ${armyId}, unit ${unitId}`);
        return;
    }

    let targetModel = null;
    if (specificModelId) {
        // Manual target: Find the specific model
        targetModel = unitData.models.find(m => m.modelId === specificModelId);
        if (targetModel && targetModel.currentHp <= 0) {
            console.log(`Model ${specificModelId} is already removed.`);
            targetModel = null; // Don't wound an already removed model
        }
    } else {
        // Auto target: Use the allocation logic
        targetModel = findTargetModelForWound(unitData);
    }

    if (targetModel) {
        targetModel.currentHp -= 1;
        updateGlobalWoundState(armyId, unitId, targetModel.modelId, targetModel.currentHp);
        updateModelDisplay(unitId, targetModel.modelId, targetModel.currentHp, targetModel.maxHp);
        saveWoundState(armyWoundStates);

        // Highlight the *next* model for AUTO targetting
        const nextAutoTarget = findTargetModelForWound(unitData);
        highlightNextAutoTargetModel(unitId, nextAutoTarget ? nextAutoTarget.modelId : null);
    } else {
        console.log(`No models available to wound in unit ${unitId}`);
        clearTargetHighlight(unitId); // Ensure highlight is cleared
    }
}

/**
 * Heals a wound from a specific model or uses auto-target logic.
 * @param {string} armyId
 * @param {string} unitId
 * @param {string | null} specificModelId - ID of the model clicked, or null if auto-target button used.
 */
function healWound(armyId, unitId, specificModelId = null) {
    const unitData = loadedArmiesData[armyId]?.unitMap[unitId];
    if (!unitData) {
        console.error(`Unit data not found for healWound: army ${armyId}, unit ${unitId}`);
        return;
    }

    let targetModel = null;
    if (specificModelId) {
        // Manual target: Find the specific model
        targetModel = unitData.models.find(m => m.modelId === specificModelId);
        if (targetModel && targetModel.currentHp >= targetModel.maxHp) {
             console.log(`Model ${specificModelId} is already at full HP.`);
            targetModel = null; // Don't heal a model at full HP
        }
    } else {
        // Auto target: Use the allocation logic
        targetModel = findTargetModelForHeal(unitData);
    }

    if (targetModel) {
        targetModel.currentHp = Math.min(targetModel.maxHp, targetModel.currentHp + 1);
        updateGlobalWoundState(armyId, unitId, targetModel.modelId, targetModel.currentHp);
        updateModelDisplay(unitId, targetModel.modelId, targetModel.currentHp, targetModel.maxHp);
        saveWoundState(armyWoundStates);

        // Highlight the *next* model for AUTO targetting wounds
        const nextAutoTarget = findTargetModelForWound(unitData);
        highlightNextAutoTargetModel(unitId, nextAutoTarget ? nextAutoTarget.modelId : null);
    } else {
        console.log(`No models eligible for healing in unit ${unitId}`);
    }
}


// --- Event Handlers ---

/**
 * Handles clicks within the army units container, delegating to appropriate actions.
 * @param {Event} event - The click event object.
 */
function handleUnitInteractionClick(event) {
    const unitCard = event.target.closest('.unit-card');
    if (!unitCard) return; // Click wasn't inside a unit card

    const unitId = unitCard.dataset.unitId;
    const armyId = unitCard.dataset.armyId;

    // Check for specific model click
    const clickedModelElement = event.target.closest('.clickable-model');
    if (clickedModelElement) {
        const modelId = clickedModelElement.dataset.modelId;
        // Determine if left (apply) or right (heal) click - using contextmenu for right click
        if (event.type === 'click') { // Left click
             applyWound(armyId, unitId, modelId);
        } else if (event.type === 'contextmenu') { // Right click
            event.preventDefault(); // Prevent browser context menu
            healWound(armyId, unitId, modelId);
        }
        return; // Stop further processing if model was clicked
    }

    // Check for header button clicks (auto-target)
    if (event.target.closest('.wound-apply-btn')) {
        applyWound(armyId, unitId, null); // null modelId signifies auto-target
    } else if (event.target.closest('.wound-heal-btn')) {
        healWound(armyId, unitId, null); // null modelId signifies auto-target
    } else if (event.target.closest('.wound-reset-btn')) {
        // Reset logic remains the same
        const unitData = loadedArmiesData[armyId]?.unitMap[unitId];
        if (!unitData) return;
        console.log(`Resetting wounds for unit ${unitId}`);
        unitData.models.forEach(model => {
            model.currentHp = model.maxHp;
            updateGlobalWoundState(armyId, unitId, model.modelId, model.currentHp);
            updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
        });
        saveWoundState(armyWoundStates);
        const nextAutoTarget = findTargetModelForWound(unitData);
        highlightNextAutoTargetModel(unitId, nextAutoTarget ? nextAutoTarget.modelId : null);
    }
}


// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  armyWoundStates = loadWoundState() || {}; // Load saved state

  const mainListContainer = document.getElementById("army-units-container");
  if (!mainListContainer) { /* ... error handling ... */
    console.error("Main container #army-units-container not found!");
    document.body.insertAdjacentHTML( "afterbegin", '<div class="alert alert-danger m-5">Error: Page setup incorrect. Missing main container #army-units-container.</div>');
    return;
  }

  try {
    console.log("Fetching data for armies:", ARMY_IDS_TO_LOAD);
    const armyDataPromises = ARMY_IDS_TO_LOAD.map((id) => fetchArmyData(id));
    const allRawData = await Promise.all(armyDataPromises);
    console.log("Finished fetching data.");

    mainListContainer.innerHTML = ""; // Clear loading spinner

    let armiesDisplayed = 0;
    loadedArmiesData = {}; // Reset global army data store

    allRawData.forEach((rawData, index) => {
      const armyId = ARMY_IDS_TO_LOAD[index];
      console.log(`Processing Army ID: ${armyId}`);

      const armyDisplayBlock = document.createElement("div");
      armyDisplayBlock.id = `army-display-${armyId}`;
      armyDisplayBlock.className = "army-list-block mb-5";
      mainListContainer.appendChild(armyDisplayBlock);

      if (rawData) {
        const processedArmy = processArmyData(rawData); // Process data
        if (processedArmy) {
          loadedArmiesData[armyId] = processedArmy; // Store full processed data

          // Initialize or apply wound state
          const savedArmyWounds = armyWoundStates[armyId];
          if (!savedArmyWounds) {
              armyWoundStates[armyId] = {}; // Ensure entry exists if loading for first time
          }
          processedArmy.units.forEach(unit => {
              const savedUnitWounds = armyWoundStates[armyId]?.[unit.selectionId];
              if (!savedUnitWounds) {
                   armyWoundStates[armyId][unit.selectionId] = {}; // Ensure unit entry exists
              }
              unit.models.forEach(model => {
                  if (savedUnitWounds?.hasOwnProperty(model.modelId)) {
                      model.currentHp = savedUnitWounds[model.modelId];
                  } else {
                      // If model not in saved state, initialize it
                      armyWoundStates[armyId][unit.selectionId][model.modelId] = model.currentHp;
                  }
              });
          });
          // Save potentially initialized state right away
          saveWoundState(armyWoundStates);

          // Display army UI
          displayArmyUnits(processedArmy, armyDisplayBlock);
          armiesDisplayed++;

          // Highlight initial auto-target models
           processedArmy.units.forEach(unit => {
               const initialTarget = findTargetModelForWound(unit);
               highlightNextAutoTargetModel(unit.selectionId, initialTarget ? initialTarget.modelId : null);
           });

        } else { /* ... error handling ... */
            armyDisplayBlock.innerHTML = `<h2 class="mt-4 mb-3 text-warning">${rawData.name || `Army ${armyId}`}</h2><div class="alert alert-danger" role="alert">Error processing data for this army. Check console.</div>`;
        }
      } else { /* ... error handling ... */
          armyDisplayBlock.innerHTML = `<h2 class="mt-4 mb-3 text-danger">Army ${armyId}</h2><div class="alert alert-warning" role="alert">Could not load data for this army from server. Check Army ID and network.</div>`;
      }

      // Add HR separator
      if (index < allRawData.length - 1 && armiesDisplayed > 0 && (allRawData[index+1] && processArmyData(allRawData[index+1]))) { // Add HR only if next army is valid
        const hr = document.createElement("hr");
        hr.className = "my-4";
        mainListContainer.appendChild(hr);
      }
    });

    if (armiesDisplayed === 0 && ARMY_IDS_TO_LOAD.length > 0) { /* ... error handling ... */
        mainListContainer.innerHTML = '<div class="alert alert-danger m-4" role="alert">Failed to load or process data for all requested armies. Please check Army IDs and network connection.</div>';
    }

    // --- Setup Event Listeners (using delegation) ---
    mainListContainer.addEventListener('click', handleUnitInteractionClick);
    mainListContainer.addEventListener('contextmenu', handleUnitInteractionClick); // Listen for right-clicks too

  } catch (error) { /* ... error handling ... */
      console.error("An error occurred during army loading/processing:", error);
      mainListContainer.innerHTML = '<div class="alert alert-danger m-4" role="alert">An unexpected error occurred. Please check the console for details.</div>';
  }
}); // End DOMContentLoaded

