/**
 * @fileoverview Main application entry point and orchestration.
 * Loads data, initializes state, sets up UI, and attaches event listeners.
 * **MODIFIED:** Fixed missing import for getCommonRulesData.
 */

// Core Imports
import { config } from "./config.js"; // Configuration constants
import { loadCampaignData, loadGameData } from "./dataLoader.js"; // Data fetching functions
import { fetchArmyData } from "./api.js"; // Specific army list fetching
import { processArmyData } from "./dataProcessor.js"; // Army list processing
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
  getCommonRulesData, // <<< Added missing import
  getArmyWoundStates,
  getArmyComponentStates,
  getLoadedArmyData,
  getCurrentArmyHeroTargets,
  getCurrentArmyUnitMap,
  getUnitData,
  getJoinedHeroData,
  updateGlobalWoundState,
} from "./state.js"; // State management functions
import {
  loadWoundState,
  loadComponentState,
  saveWoundState,
  saveComponentState, // Storage interaction
} from "./storage.js";
import { displayArmyUnits } from "./ui.js"; // Core UI rendering function
import { displayArmySelection, populateArmyInfoModal } from "./uiHelpers.js"; // Helper UI functions
import { setupEventListeners } from "./eventHandlers.js"; // Event listener setup function
import { findTargetModelForWound } from "./gameLogic.js"; // Game logic helper
// Note: highlightNextAutoTargetModel is now internal to eventHandlers.js

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  // Get essential HTML elements
  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    console.error(
      "Essential HTML elements (#army-units-container or #army-title-h1) not found!"
    );
    document.body.innerHTML =
      '<div class="alert alert-danger m-5">Critical Error: Page structure is missing essential elements. Cannot initialize application.</div>';
    return;
  }

  // Initial loading indicator
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // --- Step 1: Load Campaign Data ---
  const campaignDataResult = await loadCampaignData();
  setCampaignData(campaignDataResult); // Store in state module
  if (!getCampaignData()) {
    // Use the getter now
    // loadCampaignData already displays an error message in the container
    titleH1.textContent = "Error Loading Campaign";
    return; // Stop if campaign data failed to load
  }

  // --- Step 2: Determine Army to Load from URL ---
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  // Use the getter to access campaign data
  const armyInfo = armyIdToLoad
    ? getCampaignData().armies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;

  // --- Step 3: Display Army Selection or Proceed ---
  if (!armyIdToLoad || !armyInfo) {
    // If no valid army ID, show the selection list
    displayArmySelection(getCampaignData().armies, mainListContainer); // Use getter
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true; // Disable info button if no army selected
    return; // Stop further execution
  }

  // --- Valid armyId found, proceed with loading ---
  console.log(`Valid armyId found: ${armyIdToLoad}. Loading game data...`);
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  // --- Step 4: Load Army Books AND Common Rules (using cache) ---
  const gameData = await loadGameData(getCampaignData()); // Use getter
  setArmyBooksData(gameData.armyBooks);
  setCommonRulesData(gameData.commonRules);
  console.log("Common Rules Loaded (Global State):", getCommonRulesData()); // Use getter

  // --- Step 5: Load Persisted States (Wounds, Tokens, etc.) ---
  setArmyWoundStates(loadWoundState());
  setArmyComponentStates(loadComponentState());

  // --- Step 6: Fetch and Process the Selected Army's List Data ---
  mainListContainer.innerHTML = ""; // Clear spinner AFTER loading game data
  setLoadedArmyData(armyIdToLoad, null); // Clear any previous army data from state

  try {
    console.log(`Fetching Army List data for ${armyIdToLoad}...`);
    const rawData = await fetchArmyData(armyIdToLoad); // Fetch from api.js

    if (rawData) {
      console.log(`Processing Army List data for ${armyIdToLoad}...`);
      const processedArmy = processArmyData(rawData); // Process using dataProcessor.js

      if (processedArmy) {
        setLoadedArmyData(armyIdToLoad, processedArmy); // Store processed army in state

        // Add casterLevel property and initialize component state (tokens)
        processedArmy.units.forEach((unit) => {
          const casterRule = unit.rules.find((r) => r.name === "Caster");
          unit.casterLevel = casterRule
            ? parseInt(casterRule.rating, 10) || 0
            : 0;
          // Initialize component state if needed
          const currentArmyStates = getArmyComponentStates(); // Get current state object
          if (!currentArmyStates[armyIdToLoad])
            currentArmyStates[armyIdToLoad] = {};
          if (!currentArmyStates[armyIdToLoad][unit.selectionId])
            currentArmyStates[armyIdToLoad][unit.selectionId] = {};
          // Default tokens to 0 ONLY if not already present in loaded state
          if (
            unit.casterLevel > 0 &&
            currentArmyStates[armyIdToLoad][unit.selectionId].tokens ===
              undefined
          ) {
            currentArmyStates[armyIdToLoad][unit.selectionId].tokens = 0;
          }
        });
        saveComponentState(getArmyComponentStates()); // Save potentially initialized state

        // Initialize/apply wound state from storage
        const currentWoundStates = getArmyWoundStates(); // Get current state object
        const savedArmyWounds = currentWoundStates[armyIdToLoad];
        if (!savedArmyWounds) currentWoundStates[armyIdToLoad] = {}; // Ensure army entry exists
        processedArmy.units.forEach((unit) => {
          const unitSpecificId = unit.selectionId;
          const savedUnitWounds =
            currentWoundStates[armyIdToLoad]?.[unitSpecificId];
          if (!savedUnitWounds)
            currentWoundStates[armyIdToLoad][unitSpecificId] = {}; // Ensure unit entry exists
          unit.models.forEach((model) => {
            if (savedUnitWounds?.hasOwnProperty(model.modelId)) {
              model.currentHp = savedUnitWounds[model.modelId]; // Apply saved HP
            } else {
              // If not in saved state, initialize it in the state object AND apply to model
              model.currentHp = model.maxHp; // Ensure model starts at max HP if not saved
              updateGlobalWoundState(
                armyIdToLoad,
                unitSpecificId,
                model.modelId,
                model.currentHp
              );
            }
          });
        });
        saveWoundState(getArmyWoundStates()); // Save potentially initialized wound state

        // --- Step 7: Update UI ---
        document.title = `${armyInfo.armyName} - OPR Army Tracker`;
        titleH1.textContent = armyInfo.armyName;
        populateArmyInfoModal(armyInfo); // Populate the info modal

        console.log(`Displaying units for ${armyIdToLoad}...`);
        // Pass the main container, processed army, and component states to the UI function
        displayArmyUnits(
          processedArmy,
          mainListContainer,
          getArmyComponentStates()
        );

        // Highlight initial wound targets
        processedArmy.units
          .filter(
            (u) =>
              !(
                u.isHero &&
                getCurrentArmyHeroTargets(armyIdToLoad)?.[u.selectionId]
              )
          ) // Filter out joined heroes
          .forEach((unit) => {
            const baseUnit =
              getCurrentArmyUnitMap(armyIdToLoad)?.[unit.selectionId];
            if (baseUnit) {
              const heroData = getJoinedHeroData(
                armyIdToLoad,
                baseUnit.selectionId
              );
              const initialTarget = findTargetModelForWound(baseUnit, heroData);
              // Call the highlight function (now internal to eventHandlers, but we need initial highlight)
              const targetModelElement = initialTarget
                ? document.querySelector(
                    `[data-model-id="${initialTarget.modelId}"]`
                  )
                : null;
              if (
                targetModelElement &&
                targetModelElement.closest(".unit-card")?.id ===
                  `unit-card-${baseUnit.selectionId}`
              ) {
                const card = document.getElementById(
                  `unit-card-${baseUnit.selectionId}`
                );
                card
                  ?.querySelectorAll(".model-display.target-model")
                  .forEach((el) => el.classList.remove("target-model"));
                targetModelElement.classList.add("target-model");
              }
            }
          });

        // --- Step 8: Setup Event Listeners ---
        setupEventListeners(armyIdToLoad); // Initialize event handlers
      } else {
        // Handle error during processing
        mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">Error processing army list data for ${armyInfo.armyName}.</div></div>`;
        titleH1.textContent = "Error Processing Army";
      }
    } else {
      // Handle error fetching raw army list
      mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning m-4" role="alert">Could not load army list data for ${armyInfo.armyName} (ID: ${armyIdToLoad}). Check Army Forge ID and network connection.</div></div>`;
      titleH1.textContent = "Error Loading Army List";
    }
  } catch (error) {
    // Catch any unexpected errors during fetch/process/display
    console.error(
      `An unexpected error occurred loading/processing army ${armyIdToLoad}:`,
      error
    );
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An unexpected error occurred while loading the army (${armyInfo.armyName}). Please check the console for details.</div></div>`;
    titleH1.textContent = "Unexpected Error";
  }
}); // End DOMContentLoaded
