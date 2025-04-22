//@ts-check
/**
 * @fileoverview Handles fetching campaign data, army books, common rules, doctrines,
 * custom definitions, and consolidating rule/term definitions with multiple source tracking.
 */
import { fetchArmyBookData } from "./api.js";
import { config } from "./config.js";
import { setDefinitions } from "./state.js"; // Import setter to save definitions

// --- Public Fetch Functions ---

/** Fetches campaign data. */
async function loadCampaignData() {
  try {
    const response = await fetch(config.CAMPAIGN_DATA_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    console.log("Campaign data loaded successfully.");
    return data;
  } catch (error) {
    console.error("Error loading campaign data:", error);
    return null;
  }
}

/** Fetches random events data. */
async function loadRandomEventsData() {
  const eventsUrl = "./data/rules/random-events.json";
  try {
    console.log(`Fetching random events data from: ${eventsUrl}`);
    const response = await fetch(eventsUrl);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    const data = await response.json();
    if (data && Array.isArray(data.events)) {
      console.log("Random events data loaded successfully.");
      return data;
    } else {
      console.warn("Invalid or empty random events data structure found.");
      return null;
    }
  } catch (error) {
    console.error("Error loading random events data:", error);
    throw error;
  }
}

/** Fetches missions data. */
async function loadMissionsData() {
  const missionsUrl = "./data/missions.json";
  try {
    console.log(`Fetching missions data from: ${missionsUrl}`);
    const response = await fetch(missionsUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn("missions.json not found.");
        return null;
      }
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    if (data && Array.isArray(data.missions)) {
      console.log("Missions data loaded successfully.");
      return data;
    } else {
      console.warn("Invalid missions data structure found.");
      return null;
    }
  } catch (error) {
    console.error("Error loading missions data:", error);
    return null;
  }
}

/** Fetches a specific battle report. */
async function loadBattleReport(reportPath) {
  if (!reportPath) {
    console.error("Invalid path provided for loadBattleReport");
    return null;
  }
  console.log(`Fetching battle report from path: ${reportPath}`);
  try {
    const response = await fetch(reportPath);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(`Battle report not found at: ${reportPath}`);
        return null;
      }
      throw new Error(
        `HTTP error loading battle report ${reportPath}! status: ${response.status}`
      );
    }
    const data = await response.json();
    console.log(`Battle report loaded successfully from ${reportPath}.`);
    if (!data.missionId) {
      const match = reportPath.match(/mission(\d+)\.json$/);
      if (match) data.missionId = parseInt(match[1], 10);
    }
    return data;
  } catch (error) {
    console.error(`Error loading battle report from ${reportPath}:`, error);
    return null;
  }
}

// --- Internal Helper Functions for loadGameData ---

/** Fetches doctrines, using cache. */
async function _loadDoctrinesDataInternal() {
  const cacheKey = config.DOCTRINES_CACHE_KEY;
  try {
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      if (parsedData && Array.isArray(parsedData.doctrines)) {
        console.log("Doctrines data loaded from cache.");
        return parsedData;
      } else {
        console.warn("Invalid doctrines data found in cache. Removing.");
        sessionStorage.removeItem(cacheKey);
      }
    }
    console.log("Fetching doctrines data from URL...");
    const response = await fetch(config.DOCTRINES_DATA_URL);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    if (data && Array.isArray(data.doctrines)) {
      console.log("Doctrines data fetched successfully.");
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
      } catch (e) {
        console.error("Error caching doctrines:", e);
      }
      return data;
    } else {
      throw new Error("Fetched doctrines data is invalid");
    }
  } catch (error) {
    console.error("Error loading doctrines data:", error);
    return null; // Return null on error
  }
}

/** Fetches custom definitions. */
async function _loadCustomDefinitionsDataInternal() {
  try {
    console.log(
      `Fetching custom definitions from: ${config.CUSTOM_DEFINITIONS_URL}`
    );
    const response = await fetch(config.CUSTOM_DEFINITIONS_URL);
    if (!response.ok) {
      if (response.status === 404) {
        console.log("No custom definitions file found (optional).");
        return null;
      }
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    if (data && typeof data === "object") {
      console.log("Custom definitions data loaded successfully.");
      return data;
    } else {
      console.warn("Invalid or empty custom definitions data structure found.");
      return null;
    }
  } catch (error) {
    console.error("Error loading custom definitions data:", error);
    return null;
  }
}

/** Fetches common rules and traits from API. */
async function _loadCommonDataInternal(gameSystemId) {
  const commonRulesUrl = `${config.ARMYFORGE_COMMON_RULES_API_URL_BASE}${gameSystemId}`;
  try {
    console.log(`Fetching common rules/traits from: ${commonRulesUrl}`);
    const response = await fetch(commonRulesUrl);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const data = await response.json();
    if (data && (Array.isArray(data.rules) || Array.isArray(data.traits))) {
      console.log("Common rules/traits data fetched successfully.");
      return data;
    } else {
      console.warn("Fetched common rules/traits data seems invalid.");
      return null;
    }
  } catch (error) {
    console.error("Failed to fetch common rules/traits:", error);
    return null;
  }
}

/** Fetches army book data from API using the caching mechanism in api.js. */
async function _loadArmyBookDataInternal(factionId, gameSystem, factionName) {
  console.log(
    `Requesting army book data for ${factionName} (${factionId}) - GS: ${gameSystem}`
  );
  try {
    // Use the caching fetch function from api.js
    const bookData = await fetchArmyBookData(factionId, gameSystem); // <-- USE THE NEW FUNCTION

    if (!bookData) {
      // fetchArmyBookData returns null on failure and logs the error internally
      console.warn(
        `Failed to fetch or load cached army book ${factionName} (${factionId}) after fetch attempt.`
      );
      return null; // Propagate failure
    }

    console.log(
      `Successfully loaded army book data for ${factionName} (${factionId})`
    );
    // Add factionName to the result for easier access later if needed by the caller
    return { factionId, bookData, factionName };
  } catch (error) {
    // This catch might be redundant if fetchArmyBookData handles its errors,
    // but can catch unexpected issues during the call itself.
    console.error(
      `Unexpected error calling fetchArmyBookData for ${factionName} (${factionId}):`,
      error
    );
    return null;
  }
}

/**
 * Helper function to add or update a definition in the consolidated object.
 * Handles multiple sources. Assumes description/type are consistent if term exists.
 * @param {object} definitions - The master definitions object being built.
 * @param {string} term - The term (rule name, trait name, spell name).
 * @param {string} description - The term's description.
 * @param {string} type - The type of definition (e.g., 'rules', 'traits', 'spells').
 * @param {string} source - The source of this definition (e.g., 'Common', 'Custom', 'Army Book Name').
 */
function addOrUpdateDefinition(definitions, term, description, type, source) {
  if (!term || !description || !type || !source) {
    console.warn("Skipping definition due to missing info:", {
      term,
      description,
      type,
      source,
    });
    return;
  }

  // Use the term directly as the key
  const key = term;

  if (definitions[key]) {
    // Term exists, add source if not already present
    if (!definitions[key].sources.includes(source)) {
      definitions[key].sources.push(source);
      // Optional: Sort sources alphabetically for consistent display
      definitions[key].sources.sort();
    }
    // Optional: Could add logic here to verify description matches if needed
    // if (definitions[key].description !== description) {
    //     console.warn(`Definition mismatch for term "${key}" from source "${source}". Keeping original description.`);
    // }
  } else {
    // Term doesn't exist, create new entry
    definitions[key] = {
      description: description,
      type: type,
      sources: [source], // Initialize sources array
    };
  }
}

/**
 * Fetches Army Book data, Common Rules/Traits, Custom Definitions, AND Doctrines data.
 * Consolidates all rule/term definitions into a single object with multiple source tracking,
 * using sessionStorage for caching definitions.
 * @param {object} campaignData - The loaded campaign data.
 * @returns {Promise<{
 * armyBooks: object,
 * commonRules: object,
 * doctrines: object|null,
 * definitions: object
 * }>} Object containing the loaded data and the consolidated definitions.
 */
async function loadGameData(campaignData) {
  const requiredGsId = config.GAME_SYSTEM_ID;
  const definitionsCacheKey = config.DEFINITIONS_CACHE_KEY;
  let definitions = {}; // Initialize empty definitions object
  let armyBooks = {};
  let commonRulesResult = null;
  let doctrinesDataResult = null;

  // --- Step 1: Check Definitions Cache ---
  try {
    const cachedDefinitions = sessionStorage.getItem(definitionsCacheKey);
    if (cachedDefinitions) {
      const parsedDefs = JSON.parse(cachedDefinitions);
      // Add basic validation for the new structure (check for sources array)
      const firstKey = Object.keys(parsedDefs)[0];
      if (
        parsedDefs &&
        typeof parsedDefs === "object" &&
        Object.keys(parsedDefs).length > 0 &&
        (!firstKey ||
          (parsedDefs[firstKey] && Array.isArray(parsedDefs[firstKey].sources))) // Check if first item has sources array
      ) {
        console.log(
          `Definitions loaded from sessionStorage cache (${
            Object.keys(parsedDefs).length
          } terms).`
        );
        definitions = parsedDefs;

        // Still need to load army books and doctrines (which might also be cached)
        const doctrinesPromise = _loadDoctrinesDataInternal();
        const factionPromises = [];
        if (campaignData && campaignData.armies) {
          const uniqueFactions = new Map();
          campaignData.armies.forEach((army) => {
            (army.faction || []).forEach((fac) => {
              // Ensure faction has ID and gameSystem before adding
              if (fac.id && fac.gameSystem && !uniqueFactions.has(fac.id)) {
                uniqueFactions.set(fac.id, fac);
              }
            });
          });
          uniqueFactions.forEach((faction) =>
            factionPromises.push(
              _loadArmyBookDataInternal(
                faction.id,
                faction.gameSystem,
                faction.name || faction.id // Use name if available, fallback to id
              )
            )
          );
        }

        const [doctrinesResult, ...bookResults] = await Promise.all([
          doctrinesPromise,
          ...factionPromises,
        ]);
        doctrinesDataResult = doctrinesResult;
        bookResults.forEach((result) => {
          if (result && result.bookData)
            armyBooks[result.factionId] = result.bookData;
        });

        // Return cached definitions along with newly fetched books/doctrines
        return {
          armyBooks,
          commonRules: {}, // Common rules weren't fetched if definitions were cached
          doctrines: doctrinesDataResult,
          definitions,
        };
      } else {
        console.warn(
          "Invalid or outdated definitions data found in cache. Clearing and fetching fresh."
        );
        sessionStorage.removeItem(definitionsCacheKey);
        definitions = {}; // Reset definitions object
      }
    }
  } catch (e) {
    console.error("Error reading definitions cache:", e);
    sessionStorage.removeItem(definitionsCacheKey);
    definitions = {}; // Reset definitions object
  }

  // --- Step 2: Fetch Base Data (If Definitions Not Cached) ---
  console.log("Definitions not cached or invalid. Fetching all game data...");
  const doctrinesPromise = _loadDoctrinesDataInternal();
  const customDefsPromise = _loadCustomDefinitionsDataInternal();
  const commonDataPromise = _loadCommonDataInternal(requiredGsId);

  const [commonData, customDefsData, doctrinesResult] = await Promise.all([
    commonDataPromise,
    customDefsPromise,
    doctrinesPromise,
  ]);
  doctrinesDataResult = doctrinesResult;

  // --- Step 3: Process Base Definitions (Custom > Common) ---
  // Custom definitions take priority for description/type if names clash
  if (customDefsData) {
    (customDefsData.rules || []).forEach((rule) => {
      addOrUpdateDefinition(
        definitions,
        rule.name,
        rule.description,
        "Rules",
        "Custom"
      );
    });
    (customDefsData.traits || []).forEach((trait) => {
      addOrUpdateDefinition(
        definitions,
        trait.name,
        trait.description,
        "Traits",
        "Custom"
      );
    });
  }
  // Add common rules/traits, adding 'Common' source if term exists, creating if not
  if (commonData) {
    commonRulesResult = { [requiredGsId]: commonData }; // Store for return if needed
    (commonData.rules || []).forEach((rule) => {
      addOrUpdateDefinition(
        definitions,
        rule.name,
        rule.description,
        "Rules",
        "Common"
      );
    });
    (commonData.traits || []).forEach((trait) => {
      addOrUpdateDefinition(
        definitions,
        trait.name,
        trait.description,
        "Traits",
        "Common"
      );
    });
  }

  // --- Step 4: Load Faction Data (Army Books) ---
  const factionPromises = [];
  if (campaignData && campaignData.armies) {
    const uniqueFactions = new Map();
    campaignData.armies.forEach((army) => {
      (army.faction || []).forEach((fac) => {
        if (fac.id && fac.gameSystem && !uniqueFactions.has(fac.id)) {
          uniqueFactions.set(fac.id, fac);
        }
      });
    });
    uniqueFactions.forEach((faction) =>
      factionPromises.push(
        _loadArmyBookDataInternal(
          faction.id,
          faction.gameSystem,
          faction.name || faction.id // Use name for source tracking
        )
      )
    );
  }
  const bookResults = await Promise.all(factionPromises);

  // --- Step 5: Process Faction Definitions (Rules & Spells) ---
  bookResults.forEach((result) => {
    if (result && result.bookData) {
      const { factionId, bookData, factionName } = result;
      armyBooks[factionId] = bookData; // Store full book data

      // Process special rules
      (bookData.specialRules || []).forEach((rule) => {
        addOrUpdateDefinition(
          definitions,
          rule.name,
          rule.description,
          "Special Rules",
          factionName
        );
      });

      // Process spells
      (bookData.spells || []).forEach((spell) => {
        // Use spell name directly as the term for potential merging across factions
        addOrUpdateDefinition(
          definitions,
          spell.name,
          spell.effect,
          "Spells",
          factionName
        );
        // If threshold needs storing, add it to the definition object if creating new
        if (
          spell.threshold &&
          definitions[spell.name] &&
          definitions[spell.name].threshold === undefined
        ) {
          definitions[spell.name].threshold = spell.threshold;
        }
      });
    }
  });

  // --- Step 6: Cache Consolidated Definitions ---
  // Use the imported setter function from state.js
  setDefinitions(definitions); // setDefinitions handles logging and error catching

  console.log(
    `Finished loading game data. Total unique definitions: ${
      Object.keys(definitions).length
    }`
  );

  // Return all loaded data
  return {
    armyBooks: armyBooks,
    commonRules: commonRulesResult || {},
    doctrines: doctrinesDataResult,
    definitions: definitions, // Return the consolidated definitions
  };
}

// Export necessary functions
export {
  loadCampaignData,
  loadRandomEventsData,
  loadMissionsData,
  loadBattleReport,
  loadGameData,
  _loadDoctrinesDataInternal as loadDoctrinesData, // Export the internal function correctly
};
