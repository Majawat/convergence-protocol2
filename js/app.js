// Import functions from other modules
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
import { displayArmyUnits, updateModelDisplay } from "./ui.js";
import { saveWoundState, loadWoundState, resetWoundState } from "./storage.js";

// --- Global State ---
let loadedArmiesData = {};
let armyWoundStates = {};

// --- Constants ---
const ARMY_IDS_TO_LOAD = [
  "PzfU8vxUivqn", // Galdoo'o naahlk wildigitkw
  "Xo19MAwQPGbs", // van Louen's Roughnecks
  "Un3_pRTu2xBO", // Hive Fleet Tarvos
  "vMzljLVC6ZGv", // The Ashen Pact
];

// --- Wound Allocation Logic ---
function findTargetModelForWound(unit) {
  /* ... (same as V10) ... */
  if (!unit || !unit.models) return null;
  const activeModels = unit.models.filter((m) => m.currentHp > 0);
  if (activeModels.length === 0) return null;
  const nonHeroNonTough = activeModels.filter((m) => !m.isHero && !m.isTough);
  if (nonHeroNonTough.length > 0) return nonHeroNonTough[0];
  const nonHeroTough = activeModels.filter((m) => !m.isHero && m.isTough);
  if (nonHeroTough.length > 0) {
    nonHeroTough.sort((a, b) => a.currentHp - b.currentHp);
    return nonHeroTough[0];
  }
  const heroes = activeModels.filter((m) => m.isHero);
  if (heroes.length > 0) {
    heroes.sort((a, b) => a.currentHp - b.currentHp);
    return heroes[0];
  }
  return null;
}
// Removed findTargetModelForHeal

function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
  /* ... (same as V10) ... */
  if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
  if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
  armyWoundStates[armyId][unitId][modelId] = currentHp;
}
function clearTargetHighlight(unitSelectionId) {
  /* ... (same as V10) ... */
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
  /* ... (same as V10) ... */
  clearTargetHighlight(unitSelectionId);
  if (!modelId) return;
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const modelElement = card.querySelector(`[data-model-id="${modelId}"]`);
  if (modelElement) {
    modelElement.classList.add("target-model");
  }
}

function applyWound(armyId, unitId, specificModelId = null) {
  /* ... (same as V10) ... */
  const unitData = loadedArmiesData[armyId]?.unitMap[unitId];
  if (!unitData) {
    console.error(
      `Unit data not found for applyWound: army ${armyId}, unit ${unitId}`
    );
    return;
  }
  let targetModel = null;
  if (specificModelId) {
    targetModel = unitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      targetModel = null;
    }
  } else {
    targetModel = findTargetModelForWound(unitData);
  }
  if (targetModel) {
    targetModel.currentHp -= 1;
    updateGlobalWoundState(
      armyId,
      unitId,
      targetModel.modelId,
      targetModel.currentHp
    );
    updateModelDisplay(
      unitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );
    saveWoundState(armyWoundStates);
    const nextAutoTarget = findTargetModelForWound(unitData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    console.log(`No models available to wound in unit ${unitId}`);
    clearTargetHighlight(unitId);
  }
}
// Removed healWound

// --- Event Handlers ---
function handleUnitInteractionClick(event) {
  /* ... (same as V10, but no heal logic) ... */
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return;
  const unitId = unitCard.dataset.unitId;
  const armyId = unitCard.dataset.armyId;

  const clickedModelElement = event.target.closest(".clickable-model");
  if (clickedModelElement && event.type === "click") {
    const modelId = clickedModelElement.dataset.modelId;
    applyWound(armyId, unitId, modelId);
    return;
  }

  if (event.target.closest(".wound-apply-btn")) {
    applyWound(armyId, unitId, null);
  } else if (event.target.closest(".wound-reset-btn")) {
    const unitData = loadedArmiesData[armyId]?.unitMap[unitId];
    if (!unitData) return;
    console.log(`Resetting wounds for unit ${unitId}`);
    unitData.models.forEach((model) => {
      model.currentHp = model.maxHp;
      updateGlobalWoundState(armyId, unitId, model.modelId, model.currentHp);
      updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
    });
    saveWoundState(armyWoundStates);
    const nextAutoTarget = findTargetModelForWound(unitData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  }
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  armyWoundStates = loadWoundState() || {};

  // Get the main container ROW element ONCE
  const mainListContainer = document.getElementById("army-units-container");
  if (!mainListContainer) {
    /* ... error handling ... */ return;
  }

  // Clear loading spinner
  mainListContainer.innerHTML = "";
  // Add initial loading message back if desired
  // mainListContainer.innerHTML = '<div class="col-12"><p class="text-center mt-5">Loading army data...</p></div>';

  try {
    console.log("Fetching data for armies:", ARMY_IDS_TO_LOAD);
    const armyDataPromises = ARMY_IDS_TO_LOAD.map((id) => fetchArmyData(id));
    const allRawData = await Promise.all(armyDataPromises);
    console.log("Finished fetching data.");

    // Clear loading message/spinner if it was added
    mainListContainer.innerHTML = "";

    let armiesDisplayed = 0;
    loadedArmiesData = {};

    // Process and display each army
    allRawData.forEach((rawData, index) => {
      const armyId = ARMY_IDS_TO_LOAD[index];
      console.log(`Processing Army ID: ${armyId}`);

      // Add HR separator *before* processing the next army (if not the first)
      // Ensure HR spans full width using col-12 or specific styling if needed
      if (index > 0 && armiesDisplayed > 0) {
        const hrContainer = document.createElement("div");
        hrContainer.className = "col-12"; // Make HR container span full width
        const hr = document.createElement("hr");
        hr.className = "my-4"; // Standard Bootstrap margin
        hrContainer.appendChild(hr);
        mainListContainer.appendChild(hrContainer);
      }

      if (rawData) {
        const processedArmy = processArmyData(rawData);
        if (processedArmy) {
          loadedArmiesData[armyId] = processedArmy;

          // Initialize or apply wound state (same as V10)
          const savedArmyWounds = armyWoundStates[armyId];
          if (!savedArmyWounds) armyWoundStates[armyId] = {};
          processedArmy.units.forEach((unit) => {
            const savedUnitWounds = armyWoundStates[armyId]?.[unit.selectionId];
            if (!savedUnitWounds)
              armyWoundStates[armyId][unit.selectionId] = {};
            unit.models.forEach((model) => {
              if (savedUnitWounds?.hasOwnProperty(model.modelId)) {
                model.currentHp = savedUnitWounds[model.modelId];
              } else {
                armyWoundStates[armyId][unit.selectionId][model.modelId] =
                  model.currentHp;
              }
            });
          });
          saveWoundState(armyWoundStates); // Save potentially initialized state

          // Display the army units, passing the MAIN container
          // ui.js will append .col divs for each unit into this container
          displayArmyUnits(processedArmy, mainListContainer); // Pass the main row container
          armiesDisplayed++;

          // Highlight initial auto-target models (after display)
          processedArmy.units
            .filter(
              (u) => !(u.isHero && processedArmy.heroJoinTargets[u.selectionId])
            ) // Filter out joined heroes
            .forEach((unit) => {
              const baseUnit = processedArmy.unitMap[unit.selectionId]; // Get potentially merged unit data
              if (baseUnit) {
                const initialTarget = findTargetModelForWound(baseUnit);
                highlightNextAutoTargetModel(
                  baseUnit.selectionId,
                  initialTarget ? initialTarget.modelId : null
                );
              }
            });
        } else {
          // Display error message within the main container
          const errorDiv = document.createElement("div");
          errorDiv.className = "col-12"; // Span full width
          errorDiv.innerHTML = `<div class="alert alert-danger" role="alert">Error processing data for ${
            rawData.name || `Army ${armyId}`
          }.</div>`;
          mainListContainer.appendChild(errorDiv);
        }
      } else {
        // Display error message within the main container
        const errorDiv = document.createElement("div");
        errorDiv.className = "col-12"; // Span full width
        errorDiv.innerHTML = `<div class="alert alert-warning" role="alert">Could not load data for Army ${armyId}.</div>`;
        mainListContainer.appendChild(errorDiv);
      }
    });

    if (armiesDisplayed === 0 && ARMY_IDS_TO_LOAD.length > 0) {
      mainListContainer.innerHTML =
        '<div class="col-12"><div class="alert alert-danger m-4" role="alert">Failed to load or process data for all requested armies.</div></div>';
    }

    // --- Setup Event Listeners (Delegate on main container) ---
    mainListContainer.addEventListener("click", handleUnitInteractionClick);
    // Removed contextmenu listener
  } catch (error) {
    console.error("An error occurred during army loading/processing:", error);
    mainListContainer.innerHTML =
      '<div class="col-12"><div class="alert alert-danger m-4" role="alert">An unexpected error occurred. Please check the console for details.</div></div>';
  }
}); // End DOMContentLoaded
