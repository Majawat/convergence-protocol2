// Import functions from other modules
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
import { displayArmyUnits, updateModelDisplay } from "./ui.js";
import { saveWoundState, loadWoundState, resetWoundState } from "./storage.js";

// --- Global State ---
let campaignData = null;
let armyBooksData = {}; // Will be populated from cache or fetch
let loadedArmiesData = {};
let armyWoundStates = {};

// --- Constants ---
const ARMY_BOOKS_CACHE_KEY = "oprArmyBooksCache"; // sessionStorage key

// --- Data Loading Functions ---

/**
 * Fetches the main campaign data file.
 */
async function loadCampaignData() {
  /* ... (same as V15) ... */
  try {
    const response = await fetch("./data/campaign.json");
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
      mainContainer.innerHTML = "";
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
 * Fetches Army Book data for all unique factions listed in the campaign data,
 * utilizing sessionStorage for caching.
 * @param {object} campaignData - The loaded campaign data.
 * @returns {Promise<object>} An object containing the fetched/cached army book data, keyed by faction ID.
 */
async function loadArmyBooks(campaignData) {
  if (!campaignData || !campaignData.armies) return {};

  let cachedBooks = {};
  // 1. Try loading from sessionStorage
  try {
    const cachedData = sessionStorage.getItem(ARMY_BOOKS_CACHE_KEY);
    if (cachedData) {
      cachedBooks = JSON.parse(cachedData);
      console.log("Loaded Army Books data from sessionStorage.");
    }
  } catch (error) {
    console.warn(
      "Could not load or parse Army Books data from sessionStorage:",
      error
    );
    cachedBooks = {}; // Start fresh if cache is invalid
  }

  const uniqueFactions = new Map();
  campaignData.armies.forEach((army) => {
    if (army.faction) {
      army.faction.forEach((fac) => {
        if (fac.id && fac.gameSystem) {
          // Only consider factions NOT already in the cache
          if (!cachedBooks[fac.id]) {
            if (!uniqueFactions.has(fac.id)) {
              // Ensure we only queue fetch once
              uniqueFactions.set(fac.id, fac.gameSystem);
            }
          }
        }
      });
    }
  });

  if (uniqueFactions.size > 0) {
    console.log("Factions to fetch:", Array.from(uniqueFactions.keys()));
    const bookFetchPromises = [];
    uniqueFactions.forEach((gameSystem, factionId) => {
      const url = `https://army-forge.onepagerules.com/api/army-books/${factionId}?gameSystem=${gameSystem}`;
      console.log(
        `Queueing fetch for Army Book: ${factionId} (System: ${gameSystem})`
      );
      bookFetchPromises.push(
        fetch(url)
          .then((response) => {
            if (!response.ok) {
              throw new Error(
                `HTTP error! Status: ${response.status} for ${factionId}`
              );
            }
            return response.json();
          })
          .then((bookData) => ({ factionId, bookData, status: "fulfilled" }))
          .catch((error) => {
            console.error(`Failed to fetch army book ${factionId}:`, error);
            return { factionId, status: "rejected", reason: error };
          })
      );
    });

    const results = await Promise.allSettled(bookFetchPromises);

    // Merge newly fetched books into our cache object
    results.forEach((result) => {
      if (
        result.status === "fulfilled" &&
        result.value.status === "fulfilled"
      ) {
        cachedBooks[result.value.factionId] = result.value.bookData; // Add new book to cache object
        console.log(
          `Successfully fetched Army Book: ${result.value.factionId}`
        );
      } else if (
        result.status === "fulfilled" &&
        result.value.status === "rejected"
      ) {
        console.warn(
          `Army Book fetch rejected for ${result.value.factionId}: ${result.value.reason}`
        );
      }
    });

    // 3. Save updated cache to sessionStorage
    try {
      sessionStorage.setItem(ARMY_BOOKS_CACHE_KEY, JSON.stringify(cachedBooks));
      console.log("Updated Army Books cache in sessionStorage.");
    } catch (error) {
      console.error("Error saving Army Books cache to sessionStorage:", error);
    }
  } else {
    console.log("All required Army Books found in sessionStorage cache.");
  }

  return cachedBooks; // Return the complete set (cached + newly fetched)
}

// --- Wound Allocation Logic --- (Same as V14)
function findTargetModelForWound(baseUnit, heroUnit = null) {
  /* ... */
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
function updateGlobalWoundState(armyId, unitId, modelId, currentHp) {
  /* ... */
  if (!armyWoundStates[armyId]) armyWoundStates[armyId] = {};
  if (!armyWoundStates[armyId][unitId]) armyWoundStates[armyId][unitId] = {};
  armyWoundStates[armyId][unitId][modelId] = currentHp;
}
function clearTargetHighlight(unitSelectionId) {
  /* ... */
  const card = document.getElementById(`unit-card-${unitSelectionId}`);
  if (!card) return;
  const highlighted = card.querySelector(".model-display.target-model");
  if (highlighted) {
    highlighted.classList.remove("target-model");
  }
}
function highlightNextAutoTargetModel(unitSelectionId, modelId) {
  /* ... */
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
function applyWound(armyId, unitId, specificModelId = null) {
  /* ... (same as V14) ... */
  const armyData = loadedArmiesData[armyId];
  if (!armyData) {
    return;
  }
  const unitData = armyData.unitMap[unitId];
  if (!unitData) {
    return;
  }
  const heroId = Object.keys(armyData.heroJoinTargets).find(
    (key) => armyData.heroJoinTargets[key] === unitId
  );
  const heroData = heroId ? armyData.unitMap[heroId] : null;
  let targetModel = null;
  let modelFoundInUnitId = null;
  if (specificModelId) {
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
      targetModel = null;
      modelFoundInUnitId = null;
    }
  } else {
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

// --- Event Handlers ---
function handleUnitInteractionClick(event) {
  /* ... (same as V14) ... */
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
}

/** Displays army selection list */
function displayArmySelection(armies, container) {
  /* ... (same as V14) ... */
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
  /* ... (same as V14) ... */
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

  campaignData = await loadCampaignData();
  if (!campaignData) return;

  const urlParams = new URLSearchParams(window.location.search);
  const armyIdToLoad = urlParams.get("armyId");
  const armyInfo = armyIdToLoad
    ? campaignData.armies.find((a) => a.armyForgeID === armyIdToLoad)
    : null;

  if (!armyIdToLoad || !armyInfo) {
    displayArmySelection(campaignData.armies, mainListContainer);
    document.title = "Select Army - OPR Army Tracker";
    titleH1.textContent = "Select Army";
    const infoButton = document.getElementById("army-info-button");
    if (infoButton) infoButton.disabled = true;
    return;
  }

  console.log(`Valid armyId found: ${armyIdToLoad}. Loading data...`);
  mainListContainer.innerHTML =
    '<div class="col-12"><div class="d-flex justify-content-center align-items-center mt-5" style="min-height: 200px;"><div class="spinner-border text-success" role="status"><span class="visually-hidden">Loading Data...</span></div></div></div>';
  titleH1.textContent = `Loading ${armyInfo.armyName}...`;

  // Load Army Books (using cache)
  armyBooksData = await loadArmyBooks(campaignData);

  // Load persisted states
  armyWoundStates = loadWoundState() || {};

  // Fetch and Process Army Data
  mainListContainer.innerHTML = "";
  loadedArmiesData = {};

  try {
    const rawData = await fetchArmyData(armyIdToLoad);
    if (rawData) {
      const processedArmy = processArmyData(rawData);
      if (processedArmy) {
        loadedArmiesData[armyIdToLoad] = processedArmy;
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
        displayArmyUnits(processedArmy, mainListContainer);
        // Highlight initial targets...
        processedArmy.units
          .filter(
            (u) => !(u.isHero && processedArmy.heroJoinTargets[u.selectionId])
          )
          .forEach((unit) => {
            const baseUnit = processedArmy.unitMap[unit.selectionId];
            if (baseUnit) {
              const heroId = Object.keys(processedArmy.heroJoinTargets).find(
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
        mainListContainer.addEventListener("click", handleUnitInteractionClick);
      } else {
        /* Error processing */
      }
    } else {
      /* Error fetching army list */
    }
  } catch (error) {
    /* Catch all */
  }
}); // End DOMContentLoaded
