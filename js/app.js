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

/**
 * Finds the next model in the combined unit (base + hero) to apply a wound to automatically.
 * **MODIFIED:** Accepts base unit and optional hero unit.
 * @param {object} baseUnit - The processed base unit data object.
 * @param {object | null} heroUnit - The processed hero unit data object, if joined.
 * @returns {object | null} The model object to wound, or null if none available.
 */
function findTargetModelForWound(baseUnit, heroUnit = null) {
  if (!baseUnit || !baseUnit.models) return null;

  // Combine models from base unit and hero (if present)
  const combinedModels = heroUnit
    ? [...baseUnit.models, ...heroUnit.models]
    : [...baseUnit.models];
  const activeModels = combinedModels.filter((m) => m.currentHp > 0);

  if (activeModels.length === 0) return null; // No models left to wound

  // 1. Target non-Hero, non-Tough models first
  const nonHeroNonTough = activeModels.filter((m) => !m.isHero && !m.isTough);
  if (nonHeroNonTough.length > 0) {
    // Find one within the baseUnit first if possible (arbitrary tie-break)
    const target = nonHeroNonTough.find((m) =>
      baseUnit.models.some((bm) => bm.modelId === m.modelId)
    );
    return target || nonHeroNonTough[0];
  }

  // 2. Target non-Hero, Tough models (most wounded first)
  const nonHeroTough = activeModels.filter((m) => !m.isHero && m.isTough);
  if (nonHeroTough.length > 0) {
    nonHeroTough.sort((a, b) => a.currentHp - b.currentHp);
    return nonHeroTough[0];
  }

  // 3. Target Hero models last (most wounded first)
  const heroes = activeModels.filter((m) => m.isHero);
  if (heroes.length > 0) {
    heroes.sort((a, b) => a.currentHp - b.currentHp);
    return heroes[0];
  }

  return null; // Fallback
}

/**
 * Updates the global wound state object used for saving.
 */
function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
  if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
  if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
  armyWoundStates[armyId][unitId][modelId] = currentHp;
}

/**
 * Removes the highlight from any previously targeted model in a unit card.
 */
function clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}

/**
 * Adds a highlight to the next model that will take a wound (auto-target).
 */
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
  clearTargetHighlight(unitSelectionId);
  if (!modelId) return;
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  // Need to potentially find the model display using just the modelId,
  // as the card might only have the base unit's ID.
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  // Ensure the found model is within the correct card before highlighting
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
  }
}

/**
 * Applies a wound to a specific model or uses auto-target logic.
 * **MODIFIED:** Correctly finds clicked hero model and uses combined list for auto-target next highlight.
 * @param {string} armyId
 * @param {string} unitId - The ID of the BASE unit associated with the card.
 * @param {string | null} specificModelId - ID of the model clicked, or null if auto-target button used.
 */
function applyWound(armyId, unitId, specificModelId = null) {
  const armyData = loadedArmiesData[armyId];
  if (!armyData) {
    console.error(`Army data not found for applyWound: army ${armyId}`);
    return;
  }

  const unitData = armyData.unitMap[unitId]; // Base unit data
  if (!unitData) {
    console.error(
      `Base unit data not found for applyWound: army ${armyId}, unit ${unitId}`
    );
    return;
  }

  // Find the joined hero, if any
  const heroId = Object.keys(armyData.heroJoinTargets).find(
    (key) => armyData.heroJoinTargets[key] === unitId
  );
  const heroData = heroId ? armyData.unitMap[heroId] : null;

  let targetModel = null;
  let modelFoundInUnitId = null; // Track which unit the found model belongs to

  if (specificModelId) {
    // Manual target: Search in base unit first
    targetModel = unitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel) {
      modelFoundInUnitId = unitId;
    } else if (heroData) {
      // If not found in base unit, check hero
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelFoundInUnitId = heroId;
      }
    }

    // Check if the manually targeted model is already removed
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      targetModel = null; // Don't wound an already removed model
      modelFoundInUnitId = null;
    }
  } else {
    // Auto target: Use the allocation logic on combined models
    targetModel = findTargetModelForWound(unitData, heroData);
    if (targetModel) {
      // Determine which unit this auto-targeted model belongs to
      modelFoundInUnitId = targetModel.isHero ? heroId : unitId;
    }
  }

  if (targetModel && modelFoundInUnitId) {
    targetModel.currentHp -= 1;

    // Update state using the ID of the unit the model actually belongs to
    updateGlobalWoundState(
      armyId,
      modelFoundInUnitId,
      targetModel.modelId,
      targetModel.currentHp
    );

    // Update UI using the base unit ID (for card ID) and specific model ID
    updateModelDisplay(
      unitId,
      targetModel.modelId,
      targetModel.currentHp,
      targetModel.maxHp
    );

    saveWoundState(armyWoundStates); // Save updated state

    // Highlight the *next* model for AUTO targetting using combined logic
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    console.log(
      `No models available to wound in unit ${unitId} (or specific model ${specificModelId} not found/valid).`
    );
    clearTargetHighlight(unitId); // Ensure highlight is cleared
  }
}

// --- Event Handlers ---
function handleUnitInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return;
  const unitId = unitCard.dataset.unitId; // This is always the base unit ID
  const armyId = unitCard.dataset.armyId;

  const clickedModelElement = event.target.closest(".clickable-model");
  if (clickedModelElement && event.type === "click") {
    const modelId = clickedModelElement.dataset.modelId;
    applyWound(armyId, unitId, modelId); // Pass specific model ID
    return;
  }

  if (event.target.closest(".wound-apply-btn")) {
    applyWound(armyId, unitId, null); // Pass null for auto-target
  } else if (event.target.closest(".wound-reset-btn")) {
    // Reset logic needs to handle both base unit and potentially joined hero
    const armyData = loadedArmiesData[armyId];
    if (!armyData) return;
    const unitData = armyData.unitMap[unitId];
    if (!unitData) return;

    const heroId = Object.keys(armyData.heroJoinTargets).find(
      (key) => armyData.heroJoinTargets[key] === unitId
    );
    const heroData = heroId ? armyData.unitMap[heroId] : null;

    console.log(
      `Resetting wounds for unit ${unitId}` +
        (heroId ? ` and hero ${heroId}` : "")
    );

    // Reset base unit models
    unitData.models.forEach((model) => {
      model.currentHp = model.maxHp;
      updateGlobalWoundState(armyId, unitId, model.modelId, model.currentHp);
      updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
    });
    // Reset hero models if joined
    if (heroData) {
      heroData.models.forEach((model) => {
        model.currentHp = model.maxHp;
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp);
        // UI update still uses base unit card ID and specific model ID
        updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
      });
    }

    saveWoundState(armyWoundStates); // Save updated state

    // Highlight the *next* model for AUTO targetting after reset
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
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

  const mainListContainer = document.getElementById("army-units-container");
  if (!mainListContainer) {
    /* error */ return;
  }
  mainListContainer.innerHTML = ""; // Clear loading

  try {
    console.log("Fetching data for armies:", ARMY_IDS_TO_LOAD);
    const armyDataPromises = ARMY_IDS_TO_LOAD.map((id) => fetchArmyData(id));
    const allRawData = await Promise.all(armyDataPromises);
    console.log("Finished fetching data.");
    mainListContainer.innerHTML = "";
    let armiesDisplayed = 0;
    loadedArmiesData = {};

    allRawData.forEach((rawData, index) => {
      const armyId = ARMY_IDS_TO_LOAD[index];
      console.log(`Processing Army ID: ${armyId}`);

      if (index > 0 && armiesDisplayed > 0) {
        /* Add HR separator */
        const hrContainer = document.createElement("div");
        hrContainer.className = "col-12";
        const hr = document.createElement("hr");
        hr.className = "my-4";
        hrContainer.appendChild(hr);
        mainListContainer.appendChild(hrContainer);
      }

      if (rawData) {
        const processedArmy = processArmyData(rawData);
        if (processedArmy) {
          loadedArmiesData[armyId] = processedArmy;

          // Initialize or apply wound state
          const savedArmyWounds = armyWoundStates[armyId];
          if (!savedArmyWounds) armyWoundStates[armyId] = {};
          processedArmy.units.forEach((unit) => {
            // Iterate ALL units including heroes
            const unitSpecificId = unit.selectionId; // Use the unit's own ID for state key
            const savedUnitWounds = armyWoundStates[armyId]?.[unitSpecificId];
            if (!savedUnitWounds) armyWoundStates[armyId][unitSpecificId] = {};
            unit.models.forEach((model) => {
              if (savedUnitWounds?.hasOwnProperty(model.modelId)) {
                model.currentHp = savedUnitWounds[model.modelId];
              } else {
                armyWoundStates[armyId][unitSpecificId][model.modelId] =
                  model.currentHp;
              }
            });
          });
          saveWoundState(armyWoundStates); // Save potentially initialized state

          // Display the army units, passing the MAIN container
          displayArmyUnits(processedArmy, mainListContainer);
          armiesDisplayed++;

          // Highlight initial auto-target models
          processedArmy.units
            .filter(
              (u) => !(u.isHero && processedArmy.heroJoinTargets[u.selectionId])
            ) // Filter out joined heroes
            .forEach((unit) => {
              const baseUnit = processedArmy.unitMap[unit.selectionId];
              if (baseUnit) {
                const heroId = Object.keys(processedArmy.heroJoinTargets).find(
                  (key) =>
                    processedArmy.heroJoinTargets[key] === baseUnit.selectionId
                );
                const heroData = heroId ? processedArmy.unitMap[heroId] : null;
                const initialTarget = findTargetModelForWound(
                  baseUnit,
                  heroData
                ); // Use combined logic
                highlightNextAutoTargetModel(
                  baseUnit.selectionId,
                  initialTarget ? initialTarget.modelId : null
                );
              }
            });
        } else {
          /* error handling */
        }
      } else {
        /* error handling */
      }
    });

    if (armiesDisplayed === 0 && ARMY_IDS_TO_LOAD.length > 0) {
      /* error handling */
    }

    // Setup Event Listeners
    mainListContainer.addEventListener("click", handleUnitInteractionClick);
  } catch (error) {
    /* error handling */
  }
}); // End DOMContentLoaded
