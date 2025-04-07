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
  setDoctrinesData, // <-- ADDED
  setLoadedArmyData, // This now initializes/updates points & base structure in storage
  // State Getters
  getCampaignData,
  getCommonRulesData,
  getCurrentRound,
  getUnitStateValue, // Use new specific getters
  getModelStateValue, // Use new specific getters
  getLoadedArmyData,
  getCurrentArmyHeroTargets,
  getCurrentArmyUnitMap,
  getUnitData,
  getJoinedHeroData,
  getCurrentArmyId,
  // <-- ADDED CP Getters -->
  getCommandPoints,
  getMaxCommandPoints,
  // State Updaters (Generic updaters handle load/save implicitly)
  updateUnitStateValue,
  updateModelStateValue,
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js"; // Use new storage functions
import { displayArmyUnits } from "./ui.js";
import {
  displayArmySelection,
  populateArmyInfoModal,
  updateRoundUI,
  // <-- ADDED CP UI Helper -->
  updateCommandPointsDisplay,
} from "./uiHelpers.js";
import { setupEventListeners } from "./eventHandlers.js";
import { findTargetModelForWound } from "./gameLogic.js";

// --- Helper Functions ---

/**
 * Initializes the highlighting for the next model to take a wound on each unit card.
 * Should be called after `displayArmyUnits`.
 * @param {string} armyId - The ID of the currently loaded army.
 * @private
 */
function _initializeWoundHighlights(armyId) {
  const processedArmy = getLoadedArmyData(); // Assumes current army is loaded
  if (!processedArmy || !processedArmy.units) return;

  console.log(`Initializing wound highlights for army ${armyId}...`);

  processedArmy.units
    .filter((u) => !(u.isHero && getCurrentArmyHeroTargets()?.[u.selectionId]))
    .forEach((baseUnit) => {
      const cardUnitId = baseUnit.selectionId;
      const heroData = getJoinedHeroData(cardUnitId); // Assumes current army
      const baseUnitData = getUnitData(cardUnitId); // Assumes current army

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
            `Could not find element for initial target model ${initialTargetModel.modelId} on card ${cardUnitId}`
          );
        }
      }
    });
}

/**
 * Initializes the persisted state for an army based on processed data.
 * Ensures all units and models from processed data have corresponding entries
 * in the localStorage state, setting defaults if missing.
 * Updates the `currentHp` of models in the *in-memory* `processedArmy` object
 * based on the loaded/initialized state.
 * Saves the potentially updated state back to storage.
 * @param {string} armyId - The ID of the army.
 * @param {object} processedArmy - The processed army data (models will be updated with currentHp).
 * @private
 */
function _initializeArmyStateFromStorage(armyId, processedArmy) {
  console.log(`Initializing state from storage for army ${armyId}...`);
  let armyState = loadArmyState(armyId); // Load this specific army's state
  let stateChanged = false;

  // Calculate initial/max CP based on processed data
  const initialCommandPoints =
    Math.floor(processedArmy.meta.listPoints / 1000) *
    config.COMMAND_POINTS_PER_1000;

  // If no state exists, create a default structure (setLoadedArmyData already did basic init)
  if (!armyState) {
    armyState = {
      listPoints: processedArmy.meta.listPoints || 0,
      units: {},
      commandPoints: initialCommandPoints, // <-- Initialize CP
      selectedDoctrine: null, // <-- Initialize Doctrine
      maxCommandPoints: initialCommandPoints, // <-- Initialize Max CP
    };
    stateChanged = true;
    console.log(
      `No existing state found for ${armyId}, creating default structure with ${initialCommandPoints} CP.`
    );
  } else {
    // Ensure units object exists if it was missing in old data
    if (!armyState.units) {
      armyState.units = {};
      stateChanged = true;
    }
    // Ensure listPoints matches processed data
    if (armyState.listPoints !== processedArmy.meta.listPoints) {
      armyState.listPoints = processedArmy.meta.listPoints || 0;
      stateChanged = true;
    }
    // <-- Ensure CP/Doctrine fields exist and initialize max CP -->
    if (armyState.commandPoints === undefined) {
      armyState.commandPoints = initialCommandPoints;
      stateChanged = true;
    }
    if (armyState.selectedDoctrine === undefined) {
      armyState.selectedDoctrine = null;
      stateChanged = true;
    }
    // Initialize or update maxCommandPoints based on current list points
    if (armyState.maxCommandPoints !== initialCommandPoints) {
      armyState.maxCommandPoints = initialCommandPoints;
      // Optionally clamp current CP if max decreased (unlikely for fixed generation)
      if (armyState.commandPoints > armyState.maxCommandPoints) {
        armyState.commandPoints = armyState.maxCommandPoints;
      }
      stateChanged = true;
      console.log(
        `Updated maxCommandPoints for ${armyId} to ${initialCommandPoints}.`
      );
    }
  }

  // Iterate through all units (including joined heroes) in the processed data
  processedArmy.units.forEach((unit) => {
    const unitId = unit.selectionId;

    // --- Ensure Unit Entry Exists in State ---
    if (!armyState.units[unitId]) {
      armyState.units[unitId] = {
        status: "active",
        shaken: false,
        fatigued: false,
        action: null,
        limitedWeaponUsed: false,
        tokens: unit.casterLevel > 0 ? 0 : 0, // Initialize tokens if caster
        models: {},
      };
      stateChanged = true;
      console.log(`Initialized state entry for unit ${unitId}`);
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

    // --- Ensure Model Entries Exist in State & Sync HP ---
    const unitStateModels = armyState.units[unitId].models;
    unit.models.forEach((model) => {
      const modelId = model.modelId;
      if (!unitStateModels[modelId]) {
        // Model not found in saved state - initialize it
        unitStateModels[modelId] = {
          currentHp: model.maxHp, // Start at max HP
          name: null, // Default name is null
        };
        model.currentHp = model.maxHp; // Sync in-memory model
        stateChanged = true;
        // console.log(`Initialized state for model ${modelId} in unit ${unitId}`);
      } else {
        // Model found, ensure currentHp exists and sync in-memory model
        if (unitStateModels[modelId].currentHp === undefined) {
          unitStateModels[modelId].currentHp = model.maxHp;
          stateChanged = true;
        }
        // Ensure name field exists
        if (unitStateModels[modelId].name === undefined) {
          unitStateModels[modelId].name = null;
          stateChanged = true;
        }
        // Apply saved HP to the model object in memory
        model.currentHp = unitStateModels[modelId].currentHp;
      }
    });
  });

  // Save the state back to storage only if something was actually initialized or changed
  if (stateChanged) {
    console.log(`Saving initialized/updated state for army ${armyId}.`);
    saveArmyState(armyId, armyState);
  } else {
    console.log(
      `No state changes detected during initialization for army ${armyId}, skipping save.`
    );
  }
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    console.error("Essential HTML elements not found!");
    document.body.innerHTML =
      '<div class="alert alert-danger m-5">Critical Error: Page structure missing.</div>';
    return;
  }

  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // Step 1: Load Campaign Data
  const campaignDataResult = await loadCampaignData();
  setCampaignData(campaignDataResult);
  if (!getCampaignData()) {
    titleH1.textContent = "Error Loading Campaign";
    mainListContainer.innerHTML =
      '<div class="col-12"><div class="alert alert-danger m-4">Failed to load campaign data.</div></div>';
    return;
  }

  // Step 2: Determine Army to Load
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const campaignArmies = getCampaignData()?.armies || [];
  const armyInfo = armyIdToLoad
    ? campaignArmies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;

  // Step 3: Display Selection or Proceed
  if (!armyIdToLoad || !armyInfo) {
    displayArmySelection(campaignArmies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true;
    return;
  }

  // Valid armyId found
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  try {
    // Step 4: Load Static Game Data (Books/Rules/Doctrines) // <-- UPDATED
    const gameData = await loadGameData(getCampaignData());
    setArmyBooksData(gameData.armyBooks);
    setCommonRulesData(gameData.commonRules);
    setDoctrinesData(gameData.doctrines); // <-- ADDED

    // Step 5: Fetch and Process Army List
    mainListContainer.innerHTML = ""; // Clear spinner
    const rawData = await fetchArmyData(armyIdToLoad);
    if (!rawData)
      throw new Error(`Could not fetch army list data for ID: ${armyIdToLoad}`);
    const processedArmy = processArmyData(rawData);
    if (!processedArmy)
      throw new Error(
        `Failed to process army list data for ${armyInfo.armyName}.`
      );

    // Store processed data in memory AND initialize/update base state in localStorage
    // This now also calculates and stores initial/max CP
    setLoadedArmyData(armyIdToLoad, processedArmy);

    // Step 6: Initialize Full State & Update UI
    // Load full state from storage, initialize missing parts, apply HP to models in memory
    // This now also ensures CP/Doctrine fields exist in loaded state
    _initializeArmyStateFromStorage(armyIdToLoad, processedArmy);

    // Update page elements
    document.title = `${armyInfo.armyName} - OPR Army Tracker`;
    titleH1.textContent = armyInfo.armyName;
    populateArmyInfoModal(armyInfo);

    // Display units, passing the component state *for this specific army*
    const currentArmyState = loadArmyState(armyIdToLoad) || { units: {} };
    const displayComponentState = {};
    Object.entries(currentArmyState.units).forEach(([unitId, unitState]) => {
      displayComponentState[unitId] = {
        tokens: unitState.tokens, // Add other components if needed
      };
    });

    displayArmyUnits(
      processedArmy, // Contains models with updated currentHp
      mainListContainer,
      displayComponentState // Pass reconstructed component state for display
    );

    // Set initial wound target highlights
    _initializeWoundHighlights(armyIdToLoad); // Pass armyId

    // Step 7: Setup Event Listeners
    setupEventListeners(armyIdToLoad);

    // Update Round UI
    updateRoundUI(getCurrentRound());
    // <-- ADDED: Update Command Points UI -->
    updateCommandPointsDisplay(
      armyIdToLoad,
      getCommandPoints(armyIdToLoad),
      getMaxCommandPoints(armyIdToLoad)
    );

    // Handle enabling the button separately
    const startRoundButton = document.getElementById("start-round-button");
    startRoundButton.disabled = false;

    console.log("Application initialization complete.");
  } catch (error) {
    console.error(
      `An error occurred during initialization for army ${armyIdToLoad}:`,
      error
    );
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An error occurred while loading the army (${
      armyInfo?.armyName || armyIdToLoad
    }). Check console. Error: ${error.message}</div></div>`;
    titleH1.textContent = "Error Loading Army";
  }
}); // End DOMContentLoaded
