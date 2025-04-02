// Import functions from other modules
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
import {
  displayArmyUnits,
  updateModelDisplay,
  updateTokenDisplay, // Added updateTokenDisplay
} from "./ui.js";
import {
  saveWoundState,
  loadWoundState,
  resetWoundState,
  saveComponentState,
  loadComponentState,
  resetComponentState, // Added component state functions
} from "./storage.js";

// --- Global State ---
let campaignData = null; // To store loaded campaign info
let armyBooksData = {}; // To store loaded/cached army book data { factionId: data }
let commonRulesData = {}; // Stores loaded/cached common rules { gameSystemId: data }
let loadedArmiesData = {}; // Stores the single loaded army { armyId: processedArmy }
let armyWoundStates = {}; // Stores wound states { armyId: { unitId: { modelId: currentHp, ... }, ... }, ... }
let armyComponentStates = {}; // Added for tokens { armyId: { unitId: { tokens: T } } }

// --- Constants ---
const ARMY_BOOKS_CACHE_KEY = "oprArmyBooksCache"; // sessionStorage key
const COMMON_RULES_CACHE_KEY_PREFIX = "oprCommonRulesCache_"; // Prefix + gameSystemId

// --- Data Loading Functions ---

/**
 * Fetches the main campaign data file.
 * @returns {Promise<object|null>} The parsed campaign data or null on error.
 */
async function loadCampaignData() {
  try {
    const response = await fetch("./data/campaign.json"); // Fetch from /data/ folder
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Campaign data loaded successfully.");
    return data;
  } catch (error) {
    console.error("Error loading campaign data:", error);
    const mainContainer = document.getElementById("army-units-container");
    if (mainContainer) {
      // Clear potential spinner
      mainContainer.innerHTML = "";
      // Display error directly
      const errorDiv = document.createElement("div");
      errorDiv.className = "col-12";
      errorDiv.innerHTML =
        '<div class="alert alert-danger m-4" role="alert">Could not load campaign data (./data/campaign.json). Please ensure the file exists and is accessible in the /data/ folder.</div>';
      mainContainer.appendChild(errorDiv);
    }
    return null;
  }
}

/**
 * Fetches Army Book data AND Common Rules data, utilizing sessionStorage.
 * Includes detailed logging for debugging cache issues.
 * @param {object} campaignData - The loaded campaign data.
 * @returns {Promise<{armyBooks: object, commonRules: object}>} Object containing the loaded data.
 */
async function loadGameData(campaignData) {
  if (!campaignData || !campaignData.armies)
    return { armyBooks: {}, commonRules: {} };

  let cachedBooks = {};
  let cachedCommonRules = {};

  // 1. Try loading ALL caches from sessionStorage first
  try {
    const cachedBooksData = sessionStorage.getItem(ARMY_BOOKS_CACHE_KEY);
    if (cachedBooksData) {
      cachedBooks = JSON.parse(cachedBooksData) || {}; // Ensure object even if parse fails slightly
      console.log("Loaded Army Books cache.");
    }
  } catch (e) {
    console.warn("Could not parse Army Books cache.", e);
    cachedBooks = {};
  }

  // Try loading GF rules specifically (assuming only GF system '2' is needed for rules now)
  const gfRulesKey = COMMON_RULES_CACHE_KEY_PREFIX + "2";
  try {
    const cachedGfRules = sessionStorage.getItem(gfRulesKey);
    if (cachedGfRules) {
      const parsedRules = JSON.parse(cachedGfRules);
      // **VALIDATION:** Check if parsed data looks valid before accepting it
      if (
        parsedRules &&
        parsedRules.rules &&
        Array.isArray(parsedRules.rules)
      ) {
        cachedCommonRules["2"] = parsedRules;
        console.log("Loaded valid GF Common Rules cache.");
      } else {
        console.log("Cached GF Common Rules data was invalid or empty.");
      }
    } else {
      console.log("No GF Common Rules found in sessionStorage."); // Added log
    }
  } catch (e) {
    console.warn("Could not parse GF Common Rules cache.", e);
  }

  const factionsToFetch = new Map();
  const requiredGameSystems = new Set(); // Identify systems needed for rules (only '2' currently)

  // 2. Determine ALL required factions and game systems from campaign
  campaignData.armies.forEach((army) => {
    if (army.faction) {
      army.faction.forEach((fac) => {
        if (fac.id && fac.gameSystem) {
          // Check if book needs fetching
          if (!cachedBooks[fac.id]) {
            if (!factionsToFetch.has(fac.id)) {
              factionsToFetch.set(fac.id, fac.gameSystem);
            }
          }
          // Note required game systems for common rules (only GF '2' currently)
          if (fac.gameSystem === 2) {
            requiredGameSystems.add(2);
          }
          // Add other game systems here if needed later
        }
      });
    }
  });

  const fetchPromises = [];

  // 3. Queue Army Book fetches for missing ones
  if (factionsToFetch.size > 0) {
    console.log("Army Books to fetch:", Array.from(factionsToFetch.keys()));
    factionsToFetch.forEach((gameSystem, factionId) => {
      const url = `https://army-forge.onepagerules.com/api/army-books/${factionId}?gameSystem=${gameSystem}`;
      fetchPromises.push(
        fetch(url)
          .then((response) => {
            if (!response.ok)
              throw new Error(`Book ${factionId}: ${response.status}`);
            return response.json();
          })
          .then((bookData) => ({
            type: "book",
            factionId,
            bookData,
            status: "fulfilled",
          }))
          .catch((error) => {
            console.error(`Fetch failed for Book ${factionId}:`, error);
            return {
              type: "book",
              factionId,
              status: "rejected",
              reason: error,
            };
          })
      );
    });
  } else {
    console.log("All required Army Books already cached.");
  }

  // 4. Queue Common Rules fetches for required systems if missing from VALID cache
  let fetchedRulesSystems = new Set(); // Track which systems we actually fetched
  console.log(
    `[DEBUG] Checking required game systems for rules: ${Array.from(
      requiredGameSystems
    )}`
  );
  requiredGameSystems.forEach((gsId) => {
    console.log(`[DEBUG] Processing required system: ${gsId}`);
    console.log(
      `[DEBUG] Value of cachedCommonRules[${gsId}]:`,
      cachedCommonRules[gsId]
    );
    // Fetch if not present in the validated cache object
    if (!cachedCommonRules[gsId]) {
      console.log(
        `Common Rules for System ${gsId} not cached or invalid. Queueing fetch.`
      );
      const url = `https://army-forge.onepagerules.com/api/rules/common/${gsId}`;
      fetchPromises.push(
        fetch(url)
          .then((response) => {
            if (!response.ok)
              throw new Error(`Common Rules ${gsId}: ${response.status}`);
            return response.json();
          })
          .then((rulesData) => ({
            type: "rules",
            gameSystemId: gsId,
            rulesData,
            status: "fulfilled",
          }))
          .catch((error) => {
            console.error(`Fetch failed for Common Rules ${gsId}:`, error);
            return {
              type: "rules",
              gameSystemId: gsId,
              status: "rejected",
              reason: error,
            };
          })
      );
      fetchedRulesSystems.add(gsId); // Mark that we are attempting to fetch
    } else {
      console.log(`Valid Common Rules for System ${gsId} found in cache.`);
    }
  });
  console.log(
    `[DEBUG] Finished checking required game systems. Promises to run: ${fetchPromises.length}`
  );

  // 5. Execute all necessary fetches
  if (fetchPromises.length > 0) {
    console.log("[DEBUG] Executing fetches...");
    const results = await Promise.allSettled(fetchPromises);
    console.log("[DEBUG] Fetches complete. Processing results...");

    // Process results and update in-memory caches
    results.forEach((result) => {
      console.log("[DEBUG] Processing fetch result:", result); // Detailed log

      if (result.status === "fulfilled" && result.value) {
        if (result.value.status === "fulfilled") {
          if (result.value.type === "book") {
            cachedBooks[result.value.factionId] = result.value.bookData;
            console.log(
              `Successfully fetched Army Book: ${result.value.factionId}`
            );
          } else if (result.value.type === "rules") {
            // **VALIDATION:** Only add if fetched data looks valid
            if (
              result.value.rulesData &&
              result.value.rulesData.rules &&
              Array.isArray(result.value.rulesData.rules)
            ) {
              cachedCommonRules[result.value.gameSystemId] =
                result.value.rulesData; // Update in-memory cache
              console.log(
                `Successfully fetched Common Rules: System ${result.value.gameSystemId}`
              );
            } else {
              console.warn(
                `Fetched Common Rules for System ${result.value.gameSystemId} appear invalid. Data:`,
                result.value.rulesData
              );
              fetchedRulesSystems.delete(result.value.gameSystemId); // Don't try to save invalid data
            }
          }
        } else {
          console.warn(
            `[DEBUG] Fetch promise fulfilled but inner status rejected:`,
            result.value
          );
          if (result.value.type === "rules")
            fetchedRulesSystems.delete(result.value.gameSystemId); // Don't save if fetch failed internally
        }
      } else if (result.status === "rejected") {
        console.error(`[DEBUG] Fetch promise rejected:`, result.reason);
        // Could try to determine if it was a rules fetch to remove from fetchedRulesSystems, but complex.
      }
    });

    // 6. Save updated caches to sessionStorage
    try {
      if (factionsToFetch.size > 0) {
        sessionStorage.setItem(
          ARMY_BOOKS_CACHE_KEY,
          JSON.stringify(cachedBooks)
        );
        console.log("Updated Army Books cache in sessionStorage.");
      }
      fetchedRulesSystems.forEach((gsId) => {
        // Save only if we successfully fetched and validated the data (i.e., it exists in cachedCommonRules now)
        if (cachedCommonRules[gsId] && cachedCommonRules[gsId].rules) {
          sessionStorage.setItem(
            COMMON_RULES_CACHE_KEY_PREFIX + gsId,
            JSON.stringify(cachedCommonRules[gsId])
          );
          console.log(
            `Updated Common Rules cache for System ${gsId} in sessionStorage.`
          );
        } else {
          console.log(
            `[DEBUG] Skipping saving rules cache for System ${gsId} as data is missing or invalid in memory.`
          );
        }
      });
    } catch (error) {
      console.error("Error saving data cache to sessionStorage:", error);
    }
  } else {
    console.log("[DEBUG] No fetches needed (all data cached).");
  }

  // 7. Return the complete data
  console.log(
    "[DEBUG] Returning from loadGameData. Common Rules object:",
    cachedCommonRules
  );
  return { armyBooks: cachedBooks, commonRules: cachedCommonRules };
}

// --- Wound Allocation Logic ---
/**
 * Finds the next model in the combined unit (base + hero) to apply a wound to automatically.
 * @param {object} baseUnit - The processed base unit data object.
 * @param {object | null} heroUnit - The processed hero unit data object, if joined.
 * @returns {object | null} The model object to wound, or null if none available.
 */
function findTargetModelForWound(baseUnit, heroUnit = null) {
  if (!baseUnit || !baseUnit.models) return null;
  const combinedModels = heroUnit
    ? [...baseUnit.models, ...heroUnit.models]
    : [...baseUnit.models];
  const activeModels = combinedModels.filter((m) => m.currentHp > 0);
  if (activeModels.length === 0) return null;
  const nonHeroNonTough = activeModels.filter((m) => !m.isHero && !m.isTough);
  if (nonHeroNonTough.length > 0) {
    const target = nonHeroNonTough.find((m) =>
      baseUnit.models.some((bm) => bm.modelId === m.modelId)
    );
    return target || nonHeroNonTough[0];
  }
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

/** Updates the global wound state object used for saving. */
function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
  if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
  if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
  armyWoundStates[armyId][unitId][modelId] = currentHp;
}

/** Removes the highlight from any previously targeted model in a unit card. */
function clearTargetHighlight(unitSelectionId) {
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}

/** Adds a highlight to the next model that will take a wound (auto-target). */
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
  clearTargetHighlight(unitSelectionId);
  if (!modelId) return;
  const modelElement = document.querySelector(`[data-model-id="${modelId}"]`);
  if (
    modelElement &&
    modelElement.closest(".unit-card")?.id === `unit-card-${unitSelectionId}`
  ) {
    modelElement.classList.add("target-model");
  }
}

/** Applies a wound to a specific model or uses auto-target logic. */
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
  const heroId = Object.keys(armyData.heroJoinTargets || {}).find(
    (key) => armyData.heroJoinTargets[key] === unitId
  );
  const heroData = heroId ? armyData.unitMap[heroId] : null;
  let targetModel = null;
  let modelFoundInUnitId = null;

  if (specificModelId) {
    // Manual target
    targetModel = unitData.models.find((m) => m.modelId === specificModelId);
    if (targetModel) {
      modelFoundInUnitId = unitId;
    } else if (heroData) {
      targetModel = heroData.models.find((m) => m.modelId === specificModelId);
      if (targetModel) {
        modelFoundInUnitId = heroId;
      }
    }
    if (targetModel && targetModel.currentHp <= 0) {
      console.log(`Model ${specificModelId} is already removed.`);
      targetModel = null;
      modelFoundInUnitId = null;
    }
  } else {
    // Auto target
    targetModel = findTargetModelForWound(unitData, heroData);
    if (targetModel) {
      modelFoundInUnitId = targetModel.isHero ? heroId : unitId;
    }
  }

  if (targetModel && modelFoundInUnitId) {
    targetModel.currentHp -= 1;
    updateGlobalWoundState(
      armyId,
      modelFoundInUnitId,
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
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  } else {
    console.log(
      `No models available to wound in unit ${unitId} (or specific model ${specificModelId} not found/valid).`
    );
    clearTargetHighlight(unitId);
  }
}

// --- Component State Logic ---
/** Updates the global component state object (e.g., for tokens). */
function updateGlobalComponentState(armyId, unitId, key, value) {
  if (!armyComponentStates[armyId]) armyComponentStates[armyId] = {};
  if (!armyComponentStates[armyId][unitId])
    armyComponentStates[armyId][unitId] = {};
  armyComponentStates[armyId][unitId][key] = value;
}

/** Gets a specific component state value, returning a default if not found. */
function getComponentStateValue(armyId, unitId, key, defaultValue) {
  return armyComponentStates[armyId]?.[unitId]?.[key] ?? defaultValue;
}

// --- Event Handlers ---
/** Handles clicks within the army units container */
function handleUnitInteractionClick(event) {
  const unitCard = event.target.closest(".unit-card");
  if (!unitCard) return;
  const unitId = unitCard.dataset.unitId; // Base unit ID
  const armyId = unitCard.dataset.armyId;
  const clickedModelElement = event.target.closest(".clickable-model");

  // Wound application on model click
  if (clickedModelElement && event.type === "click") {
    const modelId = clickedModelElement.dataset.modelId;
    applyWound(armyId, unitId, modelId);
    return;
  }
  // Wound application via button
  if (event.target.closest(".wound-apply-btn")) {
    applyWound(armyId, unitId, null);
  }
  // Reset wounds
  else if (event.target.closest(".wound-reset-btn")) {
    const armyData = loadedArmiesData[armyId];
    if (!armyData) return;
    const unitData = armyData.unitMap[unitId];
    if (!unitData) return;
    const heroId = Object.keys(armyData.heroJoinTargets || {}).find(
      (key) => armyData.heroJoinTargets[key] === unitId
    );
    const heroData = heroId ? armyData.unitMap[heroId] : null;
    console.log(
      `Resetting wounds for unit ${unitId}` +
        (heroId ? ` and hero ${heroId}` : "")
    );
    unitData.models.forEach((model) => {
      model.currentHp = model.maxHp;
      updateGlobalWoundState(armyId, unitId, model.modelId, model.currentHp);
      updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
    });
    if (heroData) {
      heroData.models.forEach((model) => {
        model.currentHp = model.maxHp;
        updateGlobalWoundState(armyId, heroId, model.modelId, model.currentHp);
        updateModelDisplay(unitId, model.modelId, model.currentHp, model.maxHp);
      });
    }
    saveWoundState(armyWoundStates);
    const nextAutoTarget = findTargetModelForWound(unitData, heroData);
    highlightNextAutoTargetModel(
      unitId,
      nextAutoTarget ? nextAutoTarget.modelId : null
    );
  }
  // Add Token
  else if (event.target.closest(".token-add-btn")) {
    const armyData = loadedArmiesData[armyId];
    if (!armyData) return;
    const unitData = armyData.unitMap[unitId];
    if (!unitData) return;
    const heroId = Object.keys(armyData.heroJoinTargets || {}).find(
      (key) => armyData.heroJoinTargets[key] === unitId
    );
    const actualCasterUnit = heroId ? armyData.unitMap[heroId] : unitData; // Get the actual caster unit (hero or base)

    if (actualCasterUnit?.casterLevel > 0) {
      const currentTokens = getComponentStateValue(
        armyId,
        actualCasterUnit.selectionId,
        "tokens",
        0
      );
      const maxTokens = Math.min(6, actualCasterUnit.casterLevel * 2); // Max 6 rule
      if (currentTokens < maxTokens) {
        const newTokens = currentTokens + 1;
        updateGlobalComponentState(
          armyId,
          actualCasterUnit.selectionId,
          "tokens",
          newTokens
        );
        updateTokenDisplay(unitId, newTokens, actualCasterUnit.casterLevel); // Update UI on the card (using base unitId for card ID)
        saveComponentState(armyComponentStates);
      }
    } else {
      console.warn("Target unit is not a caster:", unitId);
    }
  }
  // Remove Token
  else if (event.target.closest(".token-remove-btn")) {
    const armyData = loadedArmiesData[armyId];
    if (!armyData) return;
    const unitData = armyData.unitMap[unitId];
    if (!unitData) return;
    const heroId = Object.keys(armyData.heroJoinTargets || {}).find(
      (key) => armyData.heroJoinTargets[key] === unitId
    );
    const actualCasterUnit = heroId ? armyData.unitMap[heroId] : unitData;

    if (actualCasterUnit?.casterLevel > 0) {
      const currentTokens = getComponentStateValue(
        armyId,
        actualCasterUnit.selectionId,
        "tokens",
        0
      );
      if (currentTokens > 0) {
        const newTokens = currentTokens - 1;
        updateGlobalComponentState(
          armyId,
          actualCasterUnit.selectionId,
          "tokens",
          newTokens
        );
        updateTokenDisplay(unitId, newTokens, actualCasterUnit.casterLevel); // Update UI on the card
        saveComponentState(armyComponentStates);
      }
    } else {
      console.warn("Target unit is not a caster:", unitId);
    }
  }
  // View Spells Button
  else if (event.target.closest(".view-spells-btn")) {
    // TODO: Implement spell list modal/display using armyBooksData
    console.log(`View Spells clicked for unit ${unitId}`);
    alert("Spell list display not yet implemented!");
  }
}

/** Displays army selection list */
function displayArmySelection(armies, container) {
  container.innerHTML = "";
  const prompt = document.createElement("div");
  prompt.className = "col-12 text-center mb-4";
  prompt.innerHTML = `<h2>Select an Army</h2><p>No specific army was requested via URL. Please choose an army below to view its details.</p>`;
  container.appendChild(prompt);
  const listContainer = document.createElement("div");
  listContainer.className = "col-12 col-md-8 col-lg-6 mx-auto";
  const listGroup = document.createElement("div");
  listGroup.className = "list-group";
  if (armies && armies.length > 0) {
    armies.forEach((army) => {
      const link = document.createElement("a");
      link.href = `army.html?armyId=${army.armyForgeID}`;
      link.className =
        "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      link.innerHTML = `<span><strong class="me-2">${
        army.armyName || "Unnamed Army"
      }</strong><small class="text-muted">(${
        army.player || "Unknown Player"
      })</small></span><i class="bi bi-chevron-right"></i>`;
      listGroup.appendChild(link);
    });
  } else {
    listGroup.innerHTML =
      '<p class="text-center text-muted">No armies found in campaign data.</p>';
  }
  listContainer.appendChild(listGroup);
  container.appendChild(listContainer);
}

/** Populates the Army Info Modal */
function populateArmyInfoModal(armyInfo) {
  if (!armyInfo) return;
  const modalLabel = document.getElementById("armyInfoModalLabel");
  const img = document.getElementById("armyInfoImage");
  const tagline = document.getElementById("armyInfoTagline");
  const summary = document.getElementById("armyInfoSummary");
  const backstory = document.getElementById("armyInfoBackstory");
  const infoButton = document.getElementById("army-info-button");
  if (modalLabel)
    modalLabel.textContent = armyInfo.armyName || "Army Information";
  if (tagline) tagline.textContent = armyInfo.tagline || "";
  if (summary) summary.textContent = armyInfo.summary || "";
  if (backstory)
    backstory.innerHTML =
      armyInfo.backstory || "<p>No backstory available.</p>";
  if (img) {
    if (armyInfo.image) {
      img.src = armyInfo.image;
      img.alt = armyInfo.armyName || "Army Image";
      img.style.display = "block";
      if (armyInfo.imagePosition) {
        img.style.objectPosition = armyInfo.imagePosition;
      } else {
        img.style.objectPosition = "center center";
      }
    } else {
      img.style.display = "none";
    }
  }
  if (infoButton) infoButton.disabled = false;
}

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  const mainListContainer = document.getElementById("army-units-container");
  const titleH1 = document.getElementById("army-title-h1");
  if (!mainListContainer || !titleH1) {
    return;
  }
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-primary" role="status"><span class="visually-hidden">Loading Campaign...</span></div></div></div>';

  // 1. Load Campaign Data
  campaignData = await loadCampaignData();
  if (!campaignData) return;

  // 2. Determine Army to Load
  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const armyInfo = armyIdToLoad
    ? campaignData.armies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;

  // 3. Display Selection or Load Data
  if (!armyIdToLoad || !armyInfo) {
    displayArmySelection(campaignData.armies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true;
    return;
  }

  // --- Valid armyId found ---
  console.log(`Valid armyId found: ${armyIdToLoad}. Loading game data...`);
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Game Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  // 4. Load Army Books AND Common Rules (using cache)
  const gameData = await loadGameData(campaignData);
  armyBooksData = gameData.armyBooks;
  commonRulesData = gameData.commonRules;
  console.log("Common Rules Loaded (Global):", commonRulesData);

  // 5. Load persisted states
  armyWoundStates = loadWoundState() || {};
  armyComponentStates = loadComponentState() || {}; // Load component state

  // 6. Fetch and Process Army Data
  mainListContainer.innerHTML = "";
  loadedArmiesData = {};

  try {
    console.log(`Fetching Army List data for ${armyIdToLoad}...`);
    const rawData = await fetchArmyData(armyIdToLoad);
    if (rawData) {
      console.log(`Processing Army List data for ${armyIdToLoad}...`);
      const processedArmy = processArmyData(rawData);
      if (processedArmy) {
        loadedArmiesData[armyIdToLoad] = processedArmy;

        // Add casterLevel property to units for easier access
        processedArmy.units.forEach((unit) => {
          const casterRule = unit.rules.find((r) => r.name === "Caster");
          unit.casterLevel = casterRule
            ? parseInt(casterRule.rating, 10) || 0
            : 0;
          // Initialize component state if needed
          if (!armyComponentStates[armyIdToLoad])
            armyComponentStates[armyIdToLoad] = {};
          if (!armyComponentStates[armyIdToLoad][unit.selectionId])
            armyComponentStates[armyIdToLoad][unit.selectionId] = {};
          if (
            unit.casterLevel > 0 &&
            armyComponentStates[armyIdToLoad][unit.selectionId].tokens ===
              undefined
          ) {
            // Default to 0 tokens if not found in storage
            armyComponentStates[armyIdToLoad][unit.selectionId].tokens = 0;
          }
        });
        saveComponentState(armyComponentStates); // Save potentially initialized state

        // Initialize/apply wound state...
        const savedArmyWounds = armyWoundStates[armyIdToLoad];
        if (!savedArmyWounds) armyWoundStates[armyIdToLoad] = {};
        processedArmy.units.forEach((unit) => {
          const unitSpecificId = unit.selectionId;
          const savedUnitWounds =
            armyWoundStates[armyIdToLoad]?.[unitSpecificId];
          if (!savedUnitWounds)
            armyWoundStates[armyIdToLoad][unitSpecificId] = {};
          unit.models.forEach((model) => {
            if (savedUnitWounds?.hasOwnProperty(model.modelId)) {
              model.currentHp = savedUnitWounds[model.modelId];
            } else {
              armyWoundStates[armyIdToLoad][unitSpecificId][model.modelId] =
                model.currentHp;
            }
          });
        });
        saveWoundState(armyWoundStates);

        document.title = `${armyInfo.armyName} - OPR Army Tracker`;
        titleH1.textContent = armyInfo.armyName;
        populateArmyInfoModal(armyInfo);
        console.log(`Displaying units for ${armyIdToLoad}...`);
        // Pass component states to display function
        displayArmyUnits(processedArmy, mainListContainer, armyComponentStates);

        // Highlight initial targets...
        processedArmy.units
          .filter(
            (u) => !(u.isHero && processedArmy.heroJoinTargets[u.selectionId])
          )
          .forEach((unit) => {
            const baseUnit = processedArmy.unitMap[unit.selectionId];
            if (baseUnit) {
              const heroId = Object.keys(
                processedArmy.heroJoinTargets || {}
              ).find(
                (key) =>
                  processedArmy.heroJoinTargets[key] === baseUnit.selectionId
              );
              const heroData = heroId ? processedArmy.unitMap[heroId] : null;
              const initialTarget = findTargetModelForWound(baseUnit, heroData);
              highlightNextAutoTargetModel(
                baseUnit.selectionId,
                initialTarget ? initialTarget.modelId : null
              );
            }
          });

        // Setup Event Listeners
        mainListContainer.addEventListener("click", handleUnitInteractionClick);

        // Add listener for temporary "Start Round" button
        document
          .getElementById("start-round-button")
          ?.addEventListener("click", () => {
            console.log("--- Starting New Round (Generating Tokens) ---");
            const currentArmyId = armyIdToLoad;
            if (!loadedArmiesData[currentArmyId]) return;

            let stateChanged = false;
            // Iterate over ALL units in the processed data, including heroes not directly displayed
            loadedArmiesData[currentArmyId].units.forEach((unit) => {
              if (unit.casterLevel > 0) {
                const unitId = unit.selectionId; // Use the caster's actual unit ID
                const currentTokens = getComponentStateValue(
                  currentArmyId,
                  unitId,
                  "tokens",
                  0
                );
                const maxTokens = 6; // Max 6 rule
                const tokensToAdd = unit.casterLevel;
                const newTokens = Math.min(
                  maxTokens,
                  currentTokens + tokensToAdd
                );

                if (newTokens !== currentTokens) {
                  console.log(
                    `Adding ${tokensToAdd} tokens to ${
                      unit.customName || unit.originalName
                    } (${unitId}). New total: ${newTokens}`
                  );
                  updateGlobalComponentState(
                    currentArmyId,
                    unitId,
                    "tokens",
                    newTokens
                  );
                  // Find the card ID (which is the base unit ID if the caster is a joined hero)
                  const cardUnitId = Object.keys(
                    loadedArmiesData[currentArmyId].heroJoinTargets || {}
                  ).find((heroKey) => heroKey === unitId)
                    ? loadedArmiesData[currentArmyId].heroJoinTargets[unitId] // Find the unit the hero is joined to
                    : unitId; // Otherwise, it's the unit itself
                  updateTokenDisplay(cardUnitId, newTokens, unit.casterLevel);
                  stateChanged = true;
                }
              }
            });
            if (stateChanged) {
              saveComponentState(armyComponentStates);
            }
            alert("Spell tokens generated for casters (max 6).");
          });
      } else {
        /* Error processing */ mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">Error processing data for ${armyInfo.armyName}.</div></div>`;
        titleH1.textContent = "Error";
      }
    } else {
      /* Error fetching army list */ mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-warning m-4" role="alert">Could not load army list data for ${armyInfo.armyName} (ID: ${armyIdToLoad}).</div></div>`;
      titleH1.textContent = "Error";
    }
  } catch (error) {
    /* Catch all */ console.error(
      `An error occurred loading/processing army ${armyIdToLoad}:`,
      error
    );
    mainListContainer.innerHTML = `<div class="col-12"><div class="alert alert-danger m-4" role="alert">An unexpected error occurred loading army ${armyIdToLoad}. Check console.</div></div>`;
    titleH1.textContent = "Error";
  }
}); // End DOMContentLoaded
