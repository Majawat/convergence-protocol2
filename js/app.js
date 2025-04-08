/**
 * @fileoverview Main application entry point and orchestration.
 * Loads data, initializes state, sets up UI, and attaches event listeners.
 */

// Core Imports
import { config } from "./config.js";
import { loadCampaignData, loadGameData } from "./dataLoader.js";
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
import {
  // State Setters
  setCampaignData,
  setArmyBooksData,
  setCommonRulesData,
  setDoctrinesData,
  setLoadedArmyData,
  setUnderdogPoints,
  setMaxUnderdogPoints,
  // State Getters
  getCampaignData,
  getCommonRulesData,
  getDoctrinesData,
  getCurrentRound,
  getUnitStateValue,
  getModelStateValue,
  getLoadedArmyData,
  getCurrentArmyHeroTargets,
  getCurrentArmyUnitMap,
  getUnitData,
  getJoinedHeroData,
  getCurrentArmyId,
  getCommandPoints,
  getMaxCommandPoints,
  getUnderdogPoints,
  getMaxUnderdogPoints,
  getArmyListPoints,
  // State Updaters
  updateUnitStateValue,
  updateModelStateValue,
  updateArmyListPoints,
  setCommandPoints,
  setSelectedDoctrine,
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js";
import { displayArmyUnits } from "./ui.js";
import {
  displayArmySelection,
  populateArmyInfoModal,
  updateRoundUI,
  updateCommandPointsDisplay,
  updateUnderdogPointsDisplay,
  showToast,
} from "./uiHelpers.js";
import { setupEventListeners } from "./eventHandlers.js";
import { findTargetModelForWound } from "./gameLogic.js";

// --- Helper Functions ---

/**
 * Initializes wound highlights on unit cards.
 * @param {string} armyId
 */
function _initializeWoundHighlights(armyId) {
  const processedArmy = getLoadedArmyData(); // Gets in-memory processed data
  if (!processedArmy || !processedArmy.units) return;
  console.log(`DEBUG: Initializing wound highlights for army ${armyId}...`);
  processedArmy.units
    .filter(
      (u) => !(u.isHero && processedArmy.heroJoinTargets?.[u.selectionId])
    )
    .forEach((baseUnit) => {
      const cardUnitId = baseUnit.selectionId;
      // Get data directly from the in-memory processedArmy object
      const heroData = Object.keys(processedArmy.heroJoinTargets || {})
        .map((heroId) => processedArmy.unitMap[heroId])
        .find((hero) => hero?.joinToUnitId === cardUnitId);
      const baseUnitData = processedArmy.unitMap[cardUnitId];

      const initialTargetModel = findTargetModelForWound(
        baseUnitData,
        heroData
      );
      if (initialTargetModel) {
        const targetModelElement = document.querySelector(
          `#unit-card-${cardUnitId} [data-model-id="${initialTargetModel.modelId}"]`
        );
        if (targetModelElement) {
          const card = targetModelElement.closest(".unit-card");
          card
            ?.querySelectorAll(".model-display.target-model")
            .forEach((el) => el.classList.remove("target-model"));
          targetModelElement.classList.add("target-model");
        } else {
          console.warn(
            `DEBUG: Could not find element for initial target model ${initialTargetModel.modelId} on card ${cardUnitId}`
          );
        }
      }
    });
}

/**
 * Loads state from localStorage and syncs the in-memory processedArmy's model HP.
 * Also initializes/updates CP based on the *currently processed* army data.
 * Assumes the basic state structure exists due to the upfront initialization.
 * @param {string} armyId - The ID of the army being loaded.
 * @param {object} processedArmy - The freshly processed data for the army being loaded.
 */
function _loadStateAndSyncHp(armyId, processedArmy) {
  console.log(`DEBUG: Loading state and syncing HP for army ${armyId}...`);
  let armyState = loadArmyState(armyId); // Load existing state

  // Calculate CP based on the *currently viewed* processed list
  const currentListPoints = processedArmy.meta.listPoints || 0;
  const currentMaxCommandPoints =
    Math.floor(currentListPoints / 1000) * config.COMMAND_POINTS_PER_1000;

  if (!armyState) {
    // This should ideally not happen if the upfront init worked, but handle defensively
    console.error(
      `DEBUG: State for ${armyId} was unexpectedly missing during sync! Creating default.`
    );
    armyState = {
      listPoints: currentListPoints,
      units: {},
      commandPoints: currentMaxCommandPoints,
      selectedDoctrine: null,
      maxCommandPoints: currentMaxCommandPoints,
      underdogPoints: 0,
      maxUnderdogPoints: 0,
    };
    // Attempt to save this minimal state
    saveArmyState(armyId, armyState);
  } else {
    // State exists, ensure CP/MaxCP/ListPoints are up-to-date based on the just-processed data
    let stateNeedsSave = false;
    if (armyState.listPoints !== currentListPoints) {
      armyState.listPoints = currentListPoints;
      stateNeedsSave = true;
    }
    if (armyState.maxCommandPoints !== currentMaxCommandPoints) {
      armyState.maxCommandPoints = currentMaxCommandPoints;
      // Clamp current CP if max decreased
      if (armyState.commandPoints > armyState.maxCommandPoints) {
        armyState.commandPoints = armyState.maxCommandPoints;
      }
      stateNeedsSave = true;
    }
    // Ensure other fields exist just in case
    if (armyState.commandPoints === undefined) {
      armyState.commandPoints = currentMaxCommandPoints;
      stateNeedsSave = true;
    }
    if (armyState.selectedDoctrine === undefined) {
      armyState.selectedDoctrine = null;
      stateNeedsSave = true;
    }
    if (armyState.underdogPoints === undefined) {
      armyState.underdogPoints = 0;
      stateNeedsSave = true;
    }
    if (armyState.maxUnderdogPoints === undefined) {
      armyState.maxUnderdogPoints = 0;
      stateNeedsSave = true;
    }
    if (!armyState.units) {
      armyState.units = {};
      stateNeedsSave = true;
    }

    if (stateNeedsSave) {
      saveArmyState(armyId, armyState);
      console.log(`DEBUG: Synced CP/MaxCP/ListPoints in state for ${armyId}.`);
    }
  }

  // Sync in-memory model HP with loaded state HP
  processedArmy.units.forEach((unit) => {
    const unitState = armyState.units?.[unit.selectionId];
    unit.models.forEach((model) => {
      const modelState = unitState?.models?.[model.modelId];
      // Use stored HP if available and valid, otherwise default to maxHp
      model.currentHp =
        modelState?.currentHp !== undefined && modelState.currentHp >= 0
          ? modelState.currentHp
          : model.maxHp;
    });
  });
  console.log(`DEBUG: Finished loading state and syncing HP for ${armyId}.`);
}

// --- Synchronous UP Calculation Function ---
/**
 * Calculates Underdog Points for the loaded army by reading listPoints
 * from the localStorage state of all campaign armies.
 * Saves the result to the loaded army's state and updates the UI.
 * @param {string} armyIdToLoad - The ID of the army currently being viewed.
 * @param {Array} campaignArmies - Array of army info from campaign data.
 */
function calculateAndSetUP(armyIdToLoad, campaignArmies) {
  console.log(`DEBUG: Calculating UP for ${armyIdToLoad}...`);
  try {
    const allArmyIds = campaignArmies.map((a) => a.armyForgeID).filter(Boolean);
    const armyPointsData = [];
    let dataLoadErrors = 0;

    // Load points from each army's localStorage state
    console.log("DEBUG: Loading points from localStorage for UP calc...");
    allArmyIds.forEach((id) => {
      const state = loadArmyState(id);
      // Check if state and listPoints exist and are valid numbers
      if (
        state &&
        typeof state.listPoints === "number" &&
        state.listPoints >= 0
      ) {
        armyPointsData.push({ armyId: id, points: state.listPoints });
      } else {
        console.warn(
          `DEBUG: Could not load valid state or listPoints for army ${id} during UP calculation. State found:`,
          state
        );
        dataLoadErrors++;
      }
    });

    if (dataLoadErrors > 0) {
      // Use showToast - ensure it's available in this scope (imported at top level)
      showToast(
        `Warning: Could not load point data for ${dataLoadErrors} armies. UP calculation may be inaccurate. Ensure all armies were processed.`,
        "UP Calc Warning"
      );
    }

    if (armyPointsData.length <= 1) {
      console.log(
        "DEBUG: Not enough valid army point totals found to calculate Underdog Points."
      );
      setUnderdogPoints(armyIdToLoad, 0);
      setMaxUnderdogPoints(armyIdToLoad, 0);
      updateUnderdogPointsDisplay(armyIdToLoad, 0, 0);
      return;
    }

    // Find the highest points total among all loaded armies
    const maxPoints = Math.max(...armyPointsData.map((a) => a.points));

    // Find the points for the currently viewed army
    const currentArmyPointsData = armyPointsData.find(
      (a) => a.armyId === armyIdToLoad
    );
    // If current army's state failed loading, points might be 0 - calculation will still work
    const currentArmyPoints = currentArmyPointsData
      ? currentArmyPointsData.points
      : 0;

    let calculatedUP = 0;
    if (currentArmyPoints < maxPoints) {
      const difference = maxPoints - currentArmyPoints;
      calculatedUP = Math.floor(difference / config.UNDERDOG_POINTS_PER_DELTA);
    }

    console.log(
      `DEBUG: UP Calculation: Max Points = ${maxPoints}, Current Army Points = ${currentArmyPoints}, Calculated UP = ${calculatedUP}`
    );

    // Save calculated UP to state for the current army
    setMaxUnderdogPoints(armyIdToLoad, calculatedUP);
    setUnderdogPoints(armyIdToLoad, calculatedUP); // Start with max UP

    // Update the UI display
    console.log("DEBUG: Updating UP display with calculated value.");
    updateUnderdogPointsDisplay(armyIdToLoad, calculatedUP, calculatedUP);
  } catch (error) {
    console.error("DEBUG: Error during UP calculation:", error);
    showToast(
      "Error calculating Underdog Points. Please track manually.",
      "Error"
    );
    updateUnderdogPointsDisplay(armyIdToLoad, 0, 0); // Show 0/0 on error
    setMaxUnderdogPoints(armyIdToLoad, 0);
    setUnderdogPoints(armyIdToLoad, 0);
  }
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DEBUG: DOM fully loaded and parsed");

  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    /* Error handling... */ return;
  }

  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // Step 1: Load Campaign Data
  const campaignDataResult = await loadCampaignData();
  setCampaignData(campaignDataResult);
  if (!getCampaignData()) {
    /* Error handling... */ return;
  }
  const campaignArmies = getCampaignData()?.armies || [];
  console.log("DEBUG: Campaign data loaded.");

  // Step 2: Determine Army to Load
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const armyInfo = armyIdToLoad
    ? campaignArmies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;
  console.log(`DEBUG: Army ID to load: ${armyIdToLoad}`);

  // Step 3: Display Selection or Proceed
  if (!armyIdToLoad || !armyInfo) {
    console.log("DEBUG: No valid army ID provided, displaying selection.");
    displayArmySelection(campaignArmies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    // Disable buttons
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true;
    const stratButton = document.getElementById("stratagems-button");
    if (stratButton) stratButton.disabled = true;
    const startRoundButton = document.getElementById("start-round-button");
    if (startRoundButton) startRoundButton.disabled = true;

    // REMOVED: Background pre-initialization - now happens on army load if needed.

    return; // Stop execution
  }

  // --- Code below only runs if a valid armyId IS found ---
  console.log(
    `DEBUG: Proceeding to load army: ${armyInfo.armyName} (${armyIdToLoad})`
  );
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading All Army Data...</span></div></div></div>'; // Updated spinner text
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  try {
    // Step 4: Load Static Game Data
    console.log("DEBUG: Loading game data (books, rules, doctrines)...");
    const gameData = await loadGameData(getCampaignData());
    setArmyBooksData(gameData.armyBooks);
    setCommonRulesData(gameData.commonRules);
    setDoctrinesData(gameData.doctrines);
    console.log("DEBUG: Game data loaded.");

    // --- Step 5: Fetch and Process ALL Army Lists (Upfront) ---
    console.log("DEBUG: Fetching and processing ALL campaign armies...");
    const allArmyIds = campaignArmies.map((a) => a.armyForgeID).filter(Boolean);
    const armyDataPromises = allArmyIds.map((id) => fetchArmyData(id));
    const allRawDataResults = await Promise.allSettled(armyDataPromises);

    const allProcessedArmies = {}; // Store successfully processed armies { armyId: processedData }
    let fetchProcessErrors = 0;

    for (let i = 0; i < allRawDataResults.length; i++) {
      const result = allRawDataResults[i];
      const armyId = allArmyIds[i];
      if (result.status === "fulfilled" && result.value) {
        const processed = processArmyData(result.value);
        if (processed) {
          allProcessedArmies[armyId] = processed;
          console.log(
            `DEBUG: Successfully processed army ${armyId} (Points: ${processed.meta.listPoints})`
          );
        } else {
          console.warn(`DEBUG: Failed to process data for army ID: ${armyId}.`);
          fetchProcessErrors++;
        }
      } else {
        console.warn(
          `DEBUG: Failed to fetch data for army ID: ${armyId}. Reason:`,
          result.reason
        );
        fetchProcessErrors++;
      }
    }
    console.log(
      `DEBUG: Finished processing all armies. Success: ${
        Object.keys(allProcessedArmies).length
      }, Errors: ${fetchProcessErrors}`
    );
    if (fetchProcessErrors > 0) {
      showToast(
        `Warning: Failed to load/process data for ${fetchProcessErrors} armies. UP calculation may be affected.`,
        "Data Load Warning"
      );
    }
    // Check if the currently viewed army failed to load/process
    const processedArmy = allProcessedArmies[armyIdToLoad];
    if (!processedArmy) {
      throw new Error(
        `Failed to load or process required army data for ${armyInfo.armyName} (${armyIdToLoad}). Cannot proceed.`
      );
    }
    // --- END Step 5 ---

    // --- Step 5.5: Initialize/Update ALL Army States in localStorage ---
    console.log(
      "DEBUG: Initializing/Updating states for all processed armies in localStorage..."
    );
    for (const armyId in allProcessedArmies) {
      const processed = allProcessedArmies[armyId];
      const listPoints = processed.meta.listPoints || 0;
      const maxCommandPoints =
        Math.floor(listPoints / 1000) * config.COMMAND_POINTS_PER_1000;

      let existingState = loadArmyState(armyId);
      let stateChanged = false;

      if (!existingState) {
        existingState = {
          listPoints,
          units: {},
          commandPoints: maxCommandPoints,
          selectedDoctrine: null,
          maxCommandPoints,
          underdogPoints: 0,
          maxUnderdogPoints: 0,
        };
        stateChanged = true;
      } else {
        if (existingState.listPoints !== listPoints) {
          existingState.listPoints = listPoints;
          stateChanged = true;
        }
        if (existingState.maxCommandPoints !== maxCommandPoints) {
          existingState.maxCommandPoints = maxCommandPoints;
          if (existingState.commandPoints > maxCommandPoints)
            existingState.commandPoints = maxCommandPoints;
          stateChanged = true;
        }
        // Ensure other fields exist
        if (existingState.commandPoints === undefined) {
          existingState.commandPoints = maxCommandPoints;
          stateChanged = true;
        }
        if (existingState.selectedDoctrine === undefined) {
          existingState.selectedDoctrine = null;
          stateChanged = true;
        }
        if (existingState.underdogPoints === undefined) {
          existingState.underdogPoints = 0;
          stateChanged = true;
        }
        if (existingState.maxUnderdogPoints === undefined) {
          existingState.maxUnderdogPoints = 0;
          stateChanged = true;
        }
        if (!existingState.units) {
          existingState.units = {};
          stateChanged = true;
        }
      }

      // Carefully merge unit/model structure (add missing, don't reset existing HP/status)
      processed.units.forEach((unit) => {
        const unitId = unit.selectionId;
        if (!existingState.units[unitId]) {
          existingState.units[unitId] = {
            status: "active",
            shaken: false,
            fatigued: false,
            action: null,
            limitedWeaponUsed: false,
            tokens: unit.casterLevel > 0 ? 0 : 0,
            models: {},
          };
          unit.models.forEach((model) => {
            existingState.units[unitId].models[model.modelId] = {
              currentHp: model.maxHp,
              name: null,
            };
          });
          stateChanged = true;
        } else {
          if (!existingState.units[unitId].models) {
            existingState.units[unitId].models = {};
            stateChanged = true;
          }
          unit.models.forEach((model) => {
            if (!existingState.units[unitId].models[model.modelId]) {
              existingState.units[unitId].models[model.modelId] = {
                currentHp: model.maxHp,
                name: null,
              };
              stateChanged = true;
            }
          });
        }
      });

      if (stateChanged) {
        saveArmyState(armyId, existingState);
        console.log(`DEBUG: Saved initial/updated state for ${armyId}.`);
      }
    }
    console.log("DEBUG: Finished initializing/updating all army states.");
    // --- END Step 5.5 ---

    // Set the *currently viewed* processed data in memory
    setLoadedArmyData(armyIdToLoad, processedArmy);

    // Step 6: Sync HP for the current army's in-memory data
    _loadStateAndSyncHp(armyIdToLoad, processedArmy);

    // Step 6.5: Calculate and Set Underdog Points (Synchronously)
    calculateAndSetUP(armyIdToLoad, campaignArmies); // Reads listPoints from updated localStorage

    // Step 7: Update UI
    mainListContainer.innerHTML = ""; // Clear spinner now that all data is ready
    document.title = `${armyInfo.armyName} - OPR Army Tracker`;
    titleH1.textContent = armyInfo.armyName;
    populateArmyInfoModal(armyInfo);
    console.log("DEBUG: Displaying army units...");
    displayArmyUnits(processedArmy, mainListContainer, {});
    _initializeWoundHighlights(armyIdToLoad);
    console.log("DEBUG: Units displayed.");

    // Update Round, CP, UP displays
    console.log("DEBUG: Updating Round, CP, and UP displays...");
    updateRoundUI(getCurrentRound());
    updateCommandPointsDisplay(
      armyIdToLoad,
      getCommandPoints(armyIdToLoad),
      getMaxCommandPoints(armyIdToLoad)
    );
    // UP display was already updated by calculateAndSetUP

    // Step 8: Setup Event Listeners
    console.log("DEBUG: Setting up event listeners...");
    setupEventListeners(armyIdToLoad);
    console.log("DEBUG: Event listeners set up.");

    // Enable Start Round button
    const startRoundButton = document.getElementById("start-round-button");
    if (startRoundButton) {
      startRoundButton.disabled = false;
      console.log("DEBUG: Start Round button enabled.");
    } else {
      console.warn("DEBUG: Start Round button not found after main load!");
    }

    // --- REMOVED Background UP Calculation ---

    console.log("DEBUG: Application initialization complete.");
  } catch (error) {
    // Catch errors during the main initialization sequence
    console.error(
      `DEBUG: An error occurred during initialization for army ${armyIdToLoad}:`,
      error
    );
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An error occurred while loading the army (${
      armyInfo?.armyName || armyIdToLoad
    }). Check console. Error: ${error.message}</div></div>`;
    titleH1.textContent = "Error Loading Army";
    // Ensure buttons that might rely on successful load are disabled
    const startRoundButton = document.getElementById("start-round-button");
    if (startRoundButton) startRoundButton.disabled = true;
    const stratButton = document.getElementById("stratagems-button");
    if (stratButton) stratButton.disabled = true;
  }
}); // End DOMContentLoaded
