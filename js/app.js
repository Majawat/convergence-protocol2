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
  setLoadedArmyData,
  setArmyWoundStates,
  setArmyComponentStates,
  // State Getters
  getCampaignData,
  getCommonRulesData,
  getArmyWoundStates,
  getArmyComponentStates,
  getLoadedArmyData,
  getCurrentArmyHeroTargets,
  getCurrentArmyUnitMap,
  getUnitData,
  getJoinedHeroData,
  updateGlobalWoundState,
} from "./state.js";
import {
  loadWoundState,
  loadComponentState,
  saveComponentState,
} from "./storage.js";
import { displayArmyUnits } from "./ui.js";
import { displayArmySelection, populateArmyInfoModal } from "./uiHelpers.js";
import { setupEventListeners } from "./eventHandlers.js";
import { findTargetModelForWound } from "./gameLogic.js";

// --- Helper Functions ---

/**
 * Initializes the highlighting for the next model to take a wound on each unit card.
 * Should be called after `displayArmyUnits`.
 * @param {object} processedArmy - The fully processed army data.
 * @private
 */
function _initializeWoundHighlights(processedArmy) {
  if (!processedArmy || !processedArmy.units) return;
  const armyId = processedArmy.meta.id;

  console.log("Initializing wound highlights...");

  // Iterate through units that are displayed as cards (not joined heroes)
  processedArmy.units
    .filter(
      (u) => !(u.isHero && getCurrentArmyHeroTargets(armyId)?.[u.selectionId])
    )
    .forEach((baseUnit) => {
      const cardUnitId = baseUnit.selectionId;
      const heroData = getJoinedHeroData(armyId, cardUnitId);

      // Find the initial target model using game logic
      const initialTargetModel = findTargetModelForWound(baseUnit, heroData);

      if (initialTargetModel) {
        // Find the corresponding DOM element on the card
        const targetModelElement = document.querySelector(
          `#unit-card-${cardUnitId} [data-model-id="${initialTargetModel.modelId}"]`
        );
        if (targetModelElement) {
          // Clear any existing highlight first (safety)
          const card = targetModelElement.closest(".unit-card");
          card
            ?.querySelectorAll(".model-display.target-model")
            .forEach((el) => el.classList.remove("target-model"));
          // Add the highlight class
          targetModelElement.classList.add("target-model");
          console.log(
            `Initial highlight set for model ${initialTargetModel.modelId} on card ${cardUnitId}`
          );
        } else {
          console.warn(
            `Could not find element for initial target model ${initialTargetModel.modelId} on card ${cardUnitId}`
          );
        }
      } else {
        console.log(`No initial target model found for card ${cardUnitId}`);
      }
    });
}

/**
 * Initializes the component state (e.g., tokens) for an army if not already present in loaded state.
 * @param {string} armyId - The ID of the army.
 * @param {object} processedArmy - The processed army data.
 * @private
 */
function _initializeComponentStateIfNeeded(armyId, processedArmy) {
  let stateChanged = false;
  const currentArmyStates = getArmyComponentStates(); // Get current global component state

  // Ensure army entry exists in the state
  if (!currentArmyStates[armyId]) {
    currentArmyStates[armyId] = {};
    stateChanged = true; // State structure changed
  }

  processedArmy.units.forEach((unit) => {
    // Ensure unit entry exists for this army
    if (!currentArmyStates[armyId][unit.selectionId]) {
      currentArmyStates[armyId][unit.selectionId] = {};
      stateChanged = true; // State structure changed
    }

    // Initialize tokens to 0 only if the unit is a caster AND tokens are not already set
    if (
      unit.casterLevel > 0 &&
      currentArmyStates[armyId][unit.selectionId].tokens === undefined
    ) {
      console.log(
        `Initializing tokens for caster ${unit.selectionId} in army ${armyId}`
      );
      currentArmyStates[armyId][unit.selectionId].tokens = 0;
      stateChanged = true; // State value changed
    }
    // Add initialization for other component states here if needed
  });

  // Save the state back to storage only if something was actually initialized
  if (stateChanged) {
    console.log("Saving initialized/updated component state.");
    saveComponentState(currentArmyStates);
  }
}

/**
 * Initializes or applies wound state from storage to the processed army data.
 * Ensures every model in the processed army has a corresponding entry in the global wound state.
 * @param {string} armyId - The ID of the army.
 * @param {object} processedArmy - The processed army data (models will be updated with currentHp).
 * @private
 */
function _initializeWoundState(armyId, processedArmy) {
  let stateChanged = false;
  const currentWoundStates = getArmyWoundStates(); // Get current global wound state

  // Ensure army entry exists
  if (!currentWoundStates[armyId]) {
    currentWoundStates[armyId] = {};
    stateChanged = true;
  }

  processedArmy.units.forEach((unit) => {
    const unitSpecificId = unit.selectionId;

    // Ensure unit entry exists for this army
    if (!currentWoundStates[armyId][unitSpecificId]) {
      currentWoundStates[armyId][unitSpecificId] = {};
      stateChanged = true;
    }

    // Iterate through models in the *processed* unit data
    unit.models.forEach((model) => {
      // Check if this model exists in the loaded state
      if (
        currentWoundStates[armyId][unitSpecificId]?.hasOwnProperty(
          model.modelId
        )
      ) {
        // Apply saved HP to the model object in memory
        model.currentHp =
          currentWoundStates[armyId][unitSpecificId][model.modelId];
      } else {
        // Model not found in saved state - initialize it
        console.log(
          `Initializing wound state for model ${model.modelId} in unit ${unitSpecificId}`
        );
        model.currentHp = model.maxHp; // Start at max HP
        // Update the global state object directly
        currentWoundStates[armyId][unitSpecificId][model.modelId] =
          model.currentHp;
        stateChanged = true;
      }
    });
  });

  // Save the state back to storage only if something was initialized or structure changed
  if (stateChanged) {
    console.log("Saving initialized/updated wound state.");
    saveWoundState(currentWoundStates);
  }
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  // --- Get Essential HTML Elements ---
  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    console.error(
      "Essential HTML elements (#army-units-container or #army-title-h1) not found!"
    );
    // Display critical error message to the user
    document.body.innerHTML =
      '<div class="alert alert-danger m-5">Critical Error: Page structure is missing essential elements. Cannot initialize application.</div>';
    return; // Stop execution
  }

  // Initial loading indicator
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // --- Step 1: Load Campaign Data ---
  console.log("Step 1: Loading campaign data...");
  const campaignDataResult = await loadCampaignData();
  setCampaignData(campaignDataResult); // Store in state module
  if (!getCampaignData()) {
    // loadCampaignData handles logging the error
    titleH1.textContent = "Error Loading Campaign";
    mainListContainer.innerHTML =
      '<div class="col-12"><div class="alert alert-danger m-4">Failed to load campaign data. Please check console and network connection.</div></div>';
    return; // Stop if campaign data failed to load
  }
  console.log("Campaign data loaded.");

  // --- Step 2: Determine Army to Load from URL ---
  console.log("Step 2: Determining army to load...");
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const campaignArmies = getCampaignData()?.armies || [];
  const armyInfo = armyIdToLoad
    ? campaignArmies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;
  console.log(
    `Army ID from URL: ${armyIdToLoad}`,
    armyInfo ? `(Found: ${armyInfo.armyName})` : "(Not found or no ID)"
  );

  // --- Step 3: Display Army Selection or Proceed ---
  if (!armyIdToLoad || !armyInfo) {
    console.log("Step 3: No valid army ID found, displaying selection list.");
    displayArmySelection(campaignArmies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true; // Disable info button
    return; // Stop further execution
  }

  // --- Valid armyId found, proceed with loading ---
  console.log(`Step 3: Valid armyId found (${armyIdToLoad}). Proceeding...`);
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  try {
    // --- Step 4: Load Army Books AND Common Rules (using cache) ---
    console.log("Step 4: Loading game data (Army Books & Common Rules)...");
    const gameData = await loadGameData(getCampaignData());
    setArmyBooksData(gameData.armyBooks);
    setCommonRulesData(gameData.commonRules);
    console.log("Game data loaded.", "Common Rules:", getCommonRulesData());

    // --- Step 5: Load Persisted States (Wounds, Components) ---
    console.log("Step 5: Loading persisted state from localStorage...");
    // Load existing states into the global state variables
    setArmyWoundStates(loadWoundState());
    setArmyComponentStates(loadComponentState());
    console.log("Persisted state loaded.");

    // --- Step 6: Fetch and Process the Selected Army's List Data ---
    console.log(
      `Step 6: Fetching and processing army list for ${armyIdToLoad}...`
    );
    mainListContainer.innerHTML = ""; // Clear spinner *before* processing
    setLoadedArmyData(armyIdToLoad, null); // Clear any previous army data from state

    const rawData = await fetchArmyData(armyIdToLoad); // Fetch from api.js
    if (!rawData) {
      throw new Error(`Could not fetch army list data for ID: ${armyIdToLoad}`);
    }
    console.log(`Raw army list data fetched for ${armyIdToLoad}.`);

    const processedArmy = processArmyData(rawData); // Process using dataProcessor.js
    if (!processedArmy) {
      throw new Error(
        `Failed to process army list data for ${armyInfo.armyName}.`
      );
    }
    console.log(`Army list processed for ${armyInfo.armyName}.`);

    // Store the fully processed army data in the state
    setLoadedArmyData(armyIdToLoad, processedArmy);

    // --- Step 7: Initialize State & Update UI ---
    console.log("Step 7: Initializing state and updating UI...");

    // Ensure component state (tokens) is initialized for casters if needed
    _initializeComponentStateIfNeeded(armyIdToLoad, processedArmy);

    // Initialize wound state (apply saved HP or set to maxHP)
    // This also updates the model objects in processedArmy
    _initializeWoundState(armyIdToLoad, processedArmy);

    // Update page title and header
    document.title = `${armyInfo.armyName} - OPR Army Tracker`;
    titleH1.textContent = armyInfo.armyName;

    // Populate the info modal (but don't show it)
    populateArmyInfoModal(armyInfo);

    // Display the processed units on the page
    console.log(`Displaying units for ${armyIdToLoad}...`);
    displayArmyUnits(
      processedArmy,
      mainListContainer,
      getArmyComponentStates() // Pass current component state for initial token display
    );

    // Set initial wound target highlights after rendering
    _initializeWoundHighlights(processedArmy);

    console.log("UI updated.");

    // --- Step 8: Setup Event Listeners ---
    console.log("Step 8: Setting up event listeners...");
    setupEventListeners(armyIdToLoad);
    console.log("Event listeners attached.");

    console.log("Application initialization complete.");
  } catch (error) {
    // Catch any errors during the loading/processing steps
    console.error(
      `An error occurred during initialization for army ${armyIdToLoad}:`,
      error
    );
    // Display error message to the user
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An error occurred while loading the army (${
      armyInfo?.armyName || armyIdToLoad
    }). Please check the console for details. Error: ${
      error.message
    }</div></div>`;
    titleH1.textContent = "Error Loading Army";
  }
}); // End DOMContentLoaded
