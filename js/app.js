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
  // State Updaters
  updateUnitStateValue,
  updateModelStateValue,
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js";
import { displayArmyUnits } from "./ui.js";
import {
  displayArmySelection,
  populateArmyInfoModal,
  updateRoundUI,
  updateCommandPointsDisplay,
  updateUnderdogPointsDisplay,
} from "./uiHelpers.js";
import { setupEventListeners } from "./eventHandlers.js";
import { findTargetModelForWound } from "./gameLogic.js";

// --- Helper Functions ---
function _initializeWoundHighlights(armyId) {
  const processedArmy = getLoadedArmyData();
  if (!processedArmy || !processedArmy.units) return;
  console.log(`DEBUG: Initializing wound highlights for army ${armyId}...`);
  processedArmy.units
    .filter((u) => !(u.isHero && getCurrentArmyHeroTargets()?.[u.selectionId]))
    .forEach((baseUnit) => {
      const cardUnitId = baseUnit.selectionId;
      const heroData = getJoinedHeroData(cardUnitId);
      const baseUnitData = getUnitData(cardUnitId);
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
function _initializeArmyStateFromStorage(armyId, processedArmy) {
  console.log(`DEBUG: Initializing state from storage for army ${armyId}...`);
  // This function ensures the state object in localStorage has all necessary fields,
  // including underdogPoints and maxUnderdogPoints, defaulting them to 0 if they don't exist.
  // It loads the state, adds defaults if needed, and saves it back.
  let armyState = loadArmyState(armyId);
  let stateChanged = false;
  const initialCommandPoints =
    Math.floor(processedArmy.meta.listPoints / 1000) *
    config.COMMAND_POINTS_PER_1000;

  // Default structure including UP fields
  const defaultState = {
    listPoints: processedArmy.meta.listPoints || 0,
    units: {},
    commandPoints: initialCommandPoints,
    selectedDoctrine: null,
    maxCommandPoints: initialCommandPoints,
    underdogPoints: 0,
    maxUnderdogPoints: 0,
  };

  if (!armyState) {
    armyState = defaultState;
    stateChanged = true;
    console.log(
      `DEBUG: No existing state found for ${armyId}, creating default structure.`
    );
  } else {
    // Ensure all fields exist, providing defaults from defaultState if missing
    let needsUpdate = false;
    for (const key in defaultState) {
      if (armyState[key] === undefined) {
        armyState[key] = defaultState[key];
        needsUpdate = true;
      }
    }
    // Update listPoints and maxCommandPoints based on current processed data
    if (armyState.listPoints !== (processedArmy.meta.listPoints || 0)) {
      armyState.listPoints = processedArmy.meta.listPoints || 0;
      needsUpdate = true;
    }
    if (armyState.maxCommandPoints !== initialCommandPoints) {
      armyState.maxCommandPoints = initialCommandPoints;
      if (armyState.commandPoints > armyState.maxCommandPoints) {
        armyState.commandPoints = armyState.maxCommandPoints;
      }
      needsUpdate = true;
    }
    // Note: We don't recalculate/reset UP/MaxUP here, we load whatever was stored.
    if (needsUpdate) {
      stateChanged = true;
      console.log(
        `DEBUG: Updated missing fields or points in existing state for ${armyId}.`
      );
    }
  }

  // Initialize unit/model states (ensure HP syncs with state)
  processedArmy.units.forEach((unit) => {
    const unitId = unit.selectionId;
    if (!armyState.units[unitId]) {
      armyState.units[unitId] = {
        status: "active",
        shaken: false,
        fatigued: false,
        action: null,
        limitedWeaponUsed: false,
        tokens: unit.casterLevel > 0 ? 0 : 0,
        models: {},
      };
      stateChanged = true;
    } else {
      // Ensure default fields exist if loading older state structure
      const unitState = armyState.units[unitId];
      if (unitState.status === undefined) {
        unitState.status = "active";
        stateChanged = true;
      }
      if (unitState.shaken === undefined) {
        unitState.shaken = false;
        stateChanged = true;
      }
      if (unitState.fatigued === undefined) {
        unitState.fatigued = false;
        stateChanged = true;
      }
      if (unitState.action === undefined) {
        unitState.action = null;
        stateChanged = true;
      }
      if (unitState.limitedWeaponUsed === undefined) {
        unitState.limitedWeaponUsed = false;
        stateChanged = true;
      }
      if (unitState.tokens === undefined) {
        unitState.tokens = unit.casterLevel > 0 ? 0 : 0;
        stateChanged = true;
      }
      if (!unitState.models) {
        unitState.models = {};
        stateChanged = true;
      }
    }

    const unitStateModels = armyState.units[unitId].models;
    unit.models.forEach((model) => {
      const modelId = model.modelId;
      if (!unitStateModels[modelId]) {
        unitStateModels[modelId] = { currentHp: model.maxHp, name: null };
        model.currentHp = model.maxHp; // Sync in-memory model
        stateChanged = true;
      } else {
        if (unitStateModels[modelId].currentHp === undefined) {
          unitStateModels[modelId].currentHp = model.maxHp;
          stateChanged = true;
        }
        if (unitStateModels[modelId].name === undefined) {
          unitStateModels[modelId].name = null;
          stateChanged = true;
        }
        // Apply saved HP to the model object in memory
        model.currentHp = unitStateModels[modelId].currentHp;
      }
    });
  });

  if (stateChanged) {
    console.log(`DEBUG: Saving initialized/updated state for army ${armyId}.`);
    saveArmyState(armyId, armyState);
  } else {
    console.log(
      `DEBUG: No state changes detected during initialization for army ${armyId}, skipping save.`
    );
  }
}

// --- Background Point Calculation Function ---
/**
 * Fetches and processes all campaign armies to calculate and cache their points.
 * @param {Array} campaignArmies - Array of army info from campaign data.
 * @returns {Promise<object|null>} The calculated points cache or null on error.
 */
async function calculateAndCacheAllArmyPoints(campaignArmies) {
  console.log("DEBUG: Starting background calculation of all army points..."); // Log start
  const allArmyIds = campaignArmies.map((a) => a.armyForgeID).filter(Boolean);
  if (allArmyIds.length === 0) {
    console.log(
      "DEBUG: No valid army IDs found in campaign data for pre-calculation."
    );
    return null;
  }

  let pointsCache = {};
  try {
    console.log(
      `DEBUG: Fetching data for ${allArmyIds.length} armies for cache...`
    );
    const armyDataPromises = allArmyIds.map((id) => fetchArmyData(id));
    const allRawData = await Promise.allSettled(armyDataPromises);

    let fetchErrors = 0;

    for (let i = 0; i < allRawData.length; i++) {
      const result = allRawData[i];
      const armyId = allArmyIds[i];

      if (result.status === "fulfilled" && result.value) {
        const raw = result.value;
        console.log(`DEBUG: Processing army ${armyId} for cache...`);
        const processed = processArmyData(raw);
        if (processed) {
          pointsCache[armyId] = processed.meta.listPoints || 0;
          console.log(
            `DEBUG: Processed ${armyId}, Points: ${pointsCache[armyId]}`
          );
        } else {
          console.warn(
            `DEBUG: Failed to process data for army ID: ${armyId} during pre-calculation.`
          );
          fetchErrors++;
        }
      } else {
        console.warn(
          `DEBUG: Failed to fetch data for army ID: ${armyId} during pre-calculation. Reason:`,
          result.reason
        );
        fetchErrors++;
      }
    }

    sessionStorage.setItem(
      config.CAMPAIGN_POINTS_CACHE_KEY,
      JSON.stringify(pointsCache)
    );
    console.log(
      "DEBUG: Finished background point calculation. Cached points:",
      pointsCache
    );
    if (fetchErrors > 0) {
      console.warn(
        `DEBUG: ${fetchErrors} errors occurred during point pre-calculation.`
      );
    }
    return pointsCache;
  } catch (error) {
    console.error("DEBUG: Error during background point calculation:", error);
    sessionStorage.removeItem(config.CAMPAIGN_POINTS_CACHE_KEY);
    return null;
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

    // Trigger background pre-calculation of points
    console.log("DEBUG: Triggering background point pre-calculation.");
    setTimeout(() => calculateAndCacheAllArmyPoints(campaignArmies), 100);

    return; // Stop execution
  }

  // --- Code below only runs if a valid armyId IS found ---
  console.log(
    `DEBUG: Proceeding to load army: ${armyInfo.armyName} (${armyIdToLoad})`
  );
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  try {
    // Step 4: Load Static Game Data
    console.log("DEBUG: Loading game data (books, rules, doctrines)...");
    const gameData = await loadGameData(getCampaignData());
    setArmyBooksData(gameData.armyBooks);
    setCommonRulesData(gameData.commonRules);
    setDoctrinesData(gameData.doctrines);
    console.log("DEBUG: Game data loaded.");

    // Step 5: Fetch and Process Army List (Current one)
    console.log(`DEBUG: Fetching army data for ${armyIdToLoad}...`);
    mainListContainer.innerHTML = ""; // Clear spinner
    const rawData = await fetchArmyData(armyIdToLoad);
    if (!rawData)
      throw new Error(`Could not fetch army list data for ID: ${armyIdToLoad}`);
    console.log(`DEBUG: Processing army data for ${armyIdToLoad}...`);
    const processedArmy = processArmyData(rawData);
    if (!processedArmy)
      throw new Error(
        `Failed to process army list data for ${armyInfo.armyName}.`
      );
    const currentArmyPoints = processedArmy.meta.listPoints || 0; // Store current army points
    console.log(`DEBUG: Army processed. Points: ${currentArmyPoints}`);

    setLoadedArmyData(armyIdToLoad, processedArmy); // Initializes state with points/CP

    // Step 6: Initialize Full State & Update UI
    _initializeArmyStateFromStorage(armyIdToLoad, processedArmy); // Ensures all state fields exist
    document.title = `${armyInfo.armyName} - OPR Army Tracker`;
    titleH1.textContent = armyInfo.armyName;
    populateArmyInfoModal(armyInfo);
    console.log("DEBUG: Displaying army units...");
    displayArmyUnits(processedArmy, mainListContainer, {});
    _initializeWoundHighlights(armyIdToLoad);
    console.log("DEBUG: Units displayed.");

    // Step 7: Setup Event Listeners
    console.log("DEBUG: Setting up event listeners...");
    setupEventListeners(armyIdToLoad);
    console.log("DEBUG: Event listeners set up.");

    // Update Round, CP UI
    console.log("DEBUG: Updating Round and CP display...");
    updateRoundUI(getCurrentRound());
    updateCommandPointsDisplay(
      armyIdToLoad,
      getCommandPoints(armyIdToLoad),
      getMaxCommandPoints(armyIdToLoad)
    );

    // --- UPDATED: Conditional UP Calculation/Display ---
    const initialUP = getUnderdogPoints(armyIdToLoad);
    const initialMaxUP = getMaxUnderdogPoints(armyIdToLoad);
    console.log(
      `DEBUG: Initializing UP display. Stored UP: ${initialUP}, Stored Max UP: ${initialMaxUP}`
    );

    if (initialMaxUP > 0) {
      // Values exist in state, display them directly
      console.log("DEBUG: Stored Max UP > 0. Displaying stored UP values.");
      updateUnderdogPointsDisplay(armyIdToLoad, initialUP, initialMaxUP);
    } else {
      // Values not calculated/stored yet, show "Calculating..." and trigger background task
      console.log(
        "DEBUG: Stored Max UP is 0. Displaying 'Calculating...' and starting background task."
      );
      updateUnderdogPointsDisplay(armyIdToLoad, "Calculating...", 0);

      setTimeout(async () => {
        console.log(
          "DEBUG: Background UP calculation task started (triggered by missing stored max UP)."
        );
        try {
          const allArmyIds = campaignArmies
            .map((a) => a.armyForgeID)
            .filter(Boolean);
          let pointsCache = null;
          let cachedPointsValid = false;
          let armyPointsData = [];

          // Try to load from cache first
          const cachedData = sessionStorage.getItem(
            config.CAMPAIGN_POINTS_CACHE_KEY
          );
          if (cachedData) {
            try {
              pointsCache = JSON.parse(cachedData);
              if (
                allArmyIds.every(
                  (id) => pointsCache && typeof pointsCache[id] === "number"
                )
              ) {
                cachedPointsValid = true;
                console.log("DEBUG: Using cached points for UP calculation.");
                allArmyIds.forEach((id) => {
                  armyPointsData.push({ armyId: id, points: pointsCache[id] });
                });
              } else {
                console.log(
                  "DEBUG: Points cache is incomplete or invalid. Re-fetching."
                );
                pointsCache = null;
              }
            } catch (e) {
              console.warn(
                "DEBUG: Could not parse points cache. Re-fetching.",
                e
              );
              sessionStorage.removeItem(config.CAMPAIGN_POINTS_CACHE_KEY);
              pointsCache = null;
            }
          }

          if (!cachedPointsValid) {
            // Fetch and process if cache not valid
            console.log(
              "DEBUG: Fetching/processing all armies for UP calculation (cache invalid/missing)..."
            );
            pointsCache = await calculateAndCacheAllArmyPoints(campaignArmies); // Reuse caching function
            if (pointsCache) {
              allArmyIds.forEach((id) => {
                if (typeof pointsCache[id] === "number") {
                  armyPointsData.push({ armyId: id, points: pointsCache[id] });
                }
              });
            } else {
              throw new Error("Failed to calculate and cache points.");
            }
          }

          // Proceed with UP calculation using armyPointsData
          if (armyPointsData.length <= 1) {
            console.log(
              "DEBUG: Not enough armies loaded/processed to calculate Underdog Points."
            );
            setUnderdogPoints(armyIdToLoad, 0);
            setMaxUnderdogPoints(armyIdToLoad, 0);
            updateUnderdogPointsDisplay(armyIdToLoad, 0, 0);
            return;
          }

          const maxPoints = Math.max(...armyPointsData.map((a) => a.points));
          // Use the points value we already processed for the current army
          // const currentArmyPointsData = armyPointsData.find(a => a.armyId === armyIdToLoad);
          // const currentArmyPoints = currentArmyPointsData ? currentArmyPointsData.points : 0;

          let calculatedUP = 0;
          if (currentArmyPoints < maxPoints) {
            const difference = maxPoints - currentArmyPoints;
            calculatedUP = Math.floor(
              difference / config.UNDERDOG_POINTS_PER_DELTA
            );
          }

          console.log(
            `DEBUG: UP Calculation: Max Points = ${maxPoints}, Current Army Points = ${currentArmyPoints}, Calculated UP = ${calculatedUP}`
          );

          // Save calculated UP to state
          setMaxUnderdogPoints(armyIdToLoad, calculatedUP);
          setUnderdogPoints(armyIdToLoad, calculatedUP);

          // Update the UI display
          console.log("DEBUG: Updating UP display with calculated value.");
          updateUnderdogPointsDisplay(armyIdToLoad, calculatedUP, calculatedUP);
          console.log(
            "DEBUG: Background UP calculation finished successfully."
          );
        } catch (error) {
          console.error(
            "DEBUG: Error during background Underdog Points calculation:",
            error
          );
          showToast(
            "Error calculating Underdog Points. Please track manually.",
            "Error"
          );
          updateUnderdogPointsDisplay(armyIdToLoad, 0, 0); // Show 0/0 on error
          setMaxUnderdogPoints(armyIdToLoad, 0);
          setUnderdogPoints(armyIdToLoad, 0);
          console.log("DEBUG: Background UP calculation finished with error.");
        }
      }, 100); // Small delay
    }
    // --- END UPDATED ---

    // Enable Start Round button
    const startRoundButton = document.getElementById("start-round-button");
    if (startRoundButton) {
      startRoundButton.disabled = false;
      console.log("DEBUG: Start Round button enabled.");
    } else {
      console.warn("DEBUG: Start Round button not found after main load!");
    }

    console.log("DEBUG: Application initialization promise resolved.");
  } catch (error) {
    console.error(
      `DEBUG: An error occurred during initialization for army ${armyIdToLoad}:`,
      error
    );
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An error occurred while loading the army (${
      armyInfo?.armyName || armyIdToLoad
    }). Check console. Error: ${error.message}</div></div>`;
    titleH1.textContent = "Error Loading Army";
  }
}); // End DOMContentLoaded
