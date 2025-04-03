/**
 * @fileoverview Main application entry point and orchestration.
 * Loads data, initializes state, sets up UI, and attaches event listeners.
 * Refactored for clarity, added comments, and isolated initial highlighting.
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
  setLoadedArmyData, // This now also initializes/updates points in storage
  // State Getters
  getCampaignData,
  getCommonRulesData,
  getArmyWoundStates, // Now gets state for the current army from storage
  getArmyComponentStates, // Now gets state for the current army from storage
  getLoadedArmyData,
  getCurrentArmyHeroTargets,
  getCurrentArmyUnitMap,
  getUnitData, // Now assumes current army
  getJoinedHeroData, // Now assumes current army
  getCurrentArmyId, // New getter
  // State Updaters (These now handle load/save implicitly)
  // updateArmyWoundState, // Not directly needed here, but used by event handlers
  // updateArmyComponentState // Not directly needed here, but used by event handlers
} from "./state.js";
import { loadArmyState, saveArmyState } from "./storage.js"; // Use new storage functions
import { displayArmyUnits } from "./ui.js";
import { displayArmySelection, populateArmyInfoModal } from "./uiHelpers.js";
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
  const processedArmy = getLoadedArmyData(armyId); // Get data for the specific army
  if (!processedArmy || !processedArmy.units) return;

  console.log(`Initializing wound highlights for army ${armyId}...`);

  // Iterate through units that are displayed as cards (not joined heroes)
  processedArmy.units
    .filter(
      (u) => !(u.isHero && getCurrentArmyHeroTargets()?.[u.selectionId]) // Use getter without armyId
    )
    .forEach((baseUnit) => {
      const cardUnitId = baseUnit.selectionId;
      const heroData = getJoinedHeroData(cardUnitId); // Use getter without armyId

      // Find the initial target model using game logic
      // Need to pass the actual unit data objects
      const initialTargetModel = findTargetModelForWound(
          getUnitData(cardUnitId), // Pass base unit data
          heroData // Pass hero data (can be null)
      );

      if (initialTargetModel) {
        // Find the corresponding DOM element on the card
        const targetModelElement = document.querySelector(
          `#unit-card-${cardUnitId} [data-model-id="${initialTargetModel.modelId}"]`
        );
        if (targetModelElement) {
          const card = targetModelElement.closest(".unit-card");
          card
            ?.querySelectorAll(".model-display.target-model")
            .forEach((el) => el.classList.remove("target-model"));
          targetModelElement.classList.add("target-model");
          // console.log(`Initial highlight set for model ${initialTargetModel.modelId} on card ${cardUnitId}`);
        } else {
          console.warn(`Could not find element for initial target model ${initialTargetModel.modelId} on card ${cardUnitId}`);
        }
      } else {
        // console.log(`No initial target model found for card ${cardUnitId}`);
      }
    });
}

/**
 * Initializes or applies state (wounds, components) from storage to the processed army data.
 * Ensures every model in the processed army has a corresponding entry in the army's state.
 * Saves the potentially updated state back to storage.
 * @param {string} armyId - The ID of the army.
 * @param {object} processedArmy - The processed army data (models will be updated with currentHp).
 * @private
 */
function _initializeArmyStateFromStorage(armyId, processedArmy) {
    console.log(`Initializing state from storage for army ${armyId}...`);
    let armyState = loadArmyState(armyId); // Load this specific army's state
    let stateChanged = false;

    // If no state exists, create a default structure
    if (!armyState) {
        armyState = {
            listPoints: processedArmy.meta.listPoints || 0,
            woundState: {},
            componentState: {}
        };
        stateChanged = true; // New state created
        console.log(`No existing state found for ${armyId}, creating default.`);
    } else {
        // Ensure substates exist
        if (!armyState.woundState) armyState.woundState = {};
        if (!armyState.componentState) armyState.componentState = {};
        // Update list points just in case it changed in the source data
        if (armyState.listPoints !== processedArmy.meta.listPoints) {
             armyState.listPoints = processedArmy.meta.listPoints || 0;
             stateChanged = true;
        }
    }

    // Iterate through all units (including joined heroes) in the processed data
    processedArmy.units.forEach((unit) => {
        const unitId = unit.selectionId;

        // --- Initialize Wound State ---
        if (!armyState.woundState[unitId]) {
            armyState.woundState[unitId] = {};
            stateChanged = true;
        }
        unit.models.forEach((model) => {
            if (armyState.woundState[unitId]?.hasOwnProperty(model.modelId)) {
                // Apply saved HP to the model object in memory
                model.currentHp = armyState.woundState[unitId][model.modelId];
            } else {
                // Model not found in saved state - initialize it
                model.currentHp = model.maxHp; // Start at max HP
                armyState.woundState[unitId][model.modelId] = model.currentHp;
                stateChanged = true;
                // console.log(`Initializing wound state for model ${model.modelId} in unit ${unitId}`);
            }
        });

        // --- Initialize Component State (Tokens) ---
         if (!armyState.componentState[unitId]) {
            armyState.componentState[unitId] = {};
            stateChanged = true;
        }
        // Initialize tokens only if the unit is a caster AND tokens are not already set
        if (unit.casterLevel > 0 && armyState.componentState[unitId].tokens === undefined) {
            armyState.componentState[unitId].tokens = 0; // Default to 0 tokens
            stateChanged = true;
            // console.log(`Initializing tokens for caster ${unitId} in army ${armyId}`);
        }
        // Add initialization for other component states here if needed
    });

    // Save the state back to storage only if something was actually initialized or changed
    if (stateChanged) {
        console.log(`Saving initialized/updated state for army ${armyId}.`);
        saveArmyState(armyId, armyState);
    } else {
         console.log(`No state changes detected for army ${armyId}, skipping save.`);
    }
}


// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  // --- Get Essential HTML Elements ---
  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    console.error("Essential HTML elements not found!");
    document.body.innerHTML = '<div class="alert alert-danger m-5">Critical Error: Page structure missing.</div>';
    return;
  }

  // Initial loading indicator
  mainListContainer.innerHTML = '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // --- Step 1: Load Campaign Data ---
  console.log("Step 1: Loading campaign data...");
  const campaignDataResult = await loadCampaignData();
  setCampaignData(campaignDataResult);
  if (!getCampaignData()) {
    titleH1.textContent = "Error Loading Campaign";
    mainListContainer.innerHTML = '<div class="col-12"><div class="alert alert-danger m-4">Failed to load campaign data.</div></div>';
    return;
  }
  console.log("Campaign data loaded.");

  // --- Step 2: Determine Army to Load from URL ---
  console.log("Step 2: Determining army to load...");
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const campaignArmies = getCampaignData()?.armies || [];
  const armyInfo = armyIdToLoad ? campaignArmies.find((a) => a.armyForgeID === armyIdToLoad) : null;

  // --- Step 3: Display Army Selection or Proceed ---
  if (!armyIdToLoad || !armyInfo) {
    console.log("Step 3: No valid army ID found, displaying selection list.");
    displayArmySelection(campaignArmies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true;
    return;
  }

  // --- Valid armyId found, proceed with loading ---
  console.log(`Step 3: Valid armyId found (${armyIdToLoad}). Proceeding...`);
  mainListContainer.innerHTML = '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  try {
    // --- Step 4: Load Army Books AND Common Rules (using cache) ---
    console.log("Step 4: Loading game data (Army Books & Common Rules)...");
    const gameData = await loadGameData(getCampaignData()); // loadGameData is already simplified
    setArmyBooksData(gameData.armyBooks);
    setCommonRulesData(gameData.commonRules); // This now only contains the required system's rules
    console.log("Game data loaded.");

    // --- Step 5: Fetch and Process the Selected Army's List Data ---
    console.log(`Step 5: Fetching and processing army list for ${armyIdToLoad}...`);
    mainListContainer.innerHTML = ""; // Clear spinner

    const rawData = await fetchArmyData(armyIdToLoad);
    if (!rawData) throw new Error(`Could not fetch army list data for ID: ${armyIdToLoad}`);

    const processedArmy = processArmyData(rawData);
    if (!processedArmy) throw new Error(`Failed to process army list data for ${armyInfo.armyName}.`);

    // Store processed data in memory AND initialize/update state in localStorage
    setLoadedArmyData(armyIdToLoad, processedArmy);
    console.log(`Army list processed and stored in memory for ${armyInfo.armyName}.`);

    // --- Step 6: Initialize State & Update UI ---
    console.log("Step 6: Initializing state from storage and updating UI...");

    // Load state from storage, initialize missing parts, apply HP to models in memory
    _initializeArmyStateFromStorage(armyIdToLoad, processedArmy);

    // Update page title and header
    document.title = `${armyInfo.armyName} - OPR Army Tracker`;
    titleH1.textContent = armyInfo.armyName;

    // Populate the info modal
    populateArmyInfoModal(armyInfo);

    // Display the processed units on the page
    console.log(`Displaying units for ${armyIdToLoad}...`);
    // Pass the component state *for this specific army*
    displayArmyUnits(
      processedArmy,
      mainListContainer,
      getArmyComponentStates(armyIdToLoad) // Get state for current army
    );

    // Set initial wound target highlights after rendering
    _initializeWoundHighlights(armyIdToLoad);

    console.log("UI updated.");

    // --- Step 7: Setup Event Listeners ---
    console.log("Step 7: Setting up event listeners...");
    setupEventListeners(armyIdToLoad); // Pass armyId for context if needed by listeners
    console.log("Event listeners attached.");

    console.log("Application initialization complete.");
  } catch (error) {
    console.error(`An error occurred during initialization for army ${armyIdToLoad}:`, error);
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An error occurred while loading the army (${armyInfo?.armyName || armyIdToLoad}). Check console. Error: ${error.message}</div></div>`;
    titleH1.textContent = "Error Loading Army";
  }
}); // End DOMContentLoaded
