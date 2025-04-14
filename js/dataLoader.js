/**
 * @fileoverview Handles fetching campaign data, army books, common rules, doctrines,
 * custom definitions, and consolidating rule/term definitions.
 */
import { config } from "./config.js";

// --- Public Fetch Functions ---

/**
 * Fetches the main campaign data file.
 * @returns {Promise<object|null>} The parsed campaign data or null on error.
 */
export async function loadCampaignData() {
  try {
    const response = await fetch(config.CAMPAIGN_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();
    console.log("Campaign data loaded successfully.");
    return data;
  } catch (error) {
    console.error("Error loading campaign data:", error);
    return null;
  }
}

/**
 * Fetches the random events data file.
 * @returns {Promise<object|null>} The parsed random events data or null on error.
 */
export async function loadRandomEventsData() {
  const eventsUrl = "./data/rules/random-events.json";
  try {
    console.log(`Fetching random events data from: ${eventsUrl}`);
    const response = await fetch(eventsUrl);
    if (!response.ok) {
      throw new Error(
        `HTTP error loading random events! status: ${response.status}`
      );
    }
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

/**
 * Fetches the missions data file.
 * @returns {Promise<object|null>} The parsed missions data or null on error.
 */
export async function loadMissionsData() {
  const missionsUrl = "./data/missions.json";
  try {
    console.log(`Fetching missions data from: ${missionsUrl}`);
    const response = await fetch(missionsUrl);
    if (!response.ok) {
      if (response.status === 404) {
        console.warn(
          "missions.json not found. Proceeding without mission details."
        );
        return null;
      }
      throw new Error(
        `HTTP error loading missions! status: ${response.status}`
      );
    }
    const data = await response.json();
    if (data && Array.isArray(data.missions)) {
      console.log("Missions data loaded successfully.");
      return data;
    } else {
      console.warn(
        "Invalid or empty missions data structure found in missions.json."
      );
      return null;
    }
  } catch (error) {
    console.error("Error loading missions data:", error);
    return null;
  }
}

/**
 * Fetches a specific battle report JSON file.
 * @param {string} reportPath - The direct path to the JSON file.
 * @returns {Promise<object|null>} The parsed battle report data or null on error.
 */
export async function loadBattleReport(reportPath) {
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
      if (match) {
        data.missionId = parseInt(match[1], 10);
      }
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
    return null;
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
    // Basic validation
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

/** Fetches army book data from API. */
async function _loadArmyBookDataInternal(factionId, gameSystem, factionName) {
  const url = `${config.ARMYFORGE_BOOK_API_URL_BASE}${factionId}?gameSystem=${gameSystem}`;
  try {
    // console.log(`Fetching army book: ${factionName} (${factionId})`); // Reduce console noise
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP error ${response.status}`);
    const bookData = await response.json();
    // console.log(`Successfully fetched army book: ${factionName}`); // Reduce console noise
    return { factionId, bookData, factionName };
  } catch (error) {
    console.error(
      `Failed to fetch army book ${factionName} (${factionId}):`,
      error
    );
    return null; // Return null for failed fetches
  }
}

/**
 * *** UPDATED ***
 * Fetches Army Book data, Common Rules/Traits, Custom Definitions, AND Doctrines data.
 * Consolidates all rule/term definitions into a single object, using sessionStorage for caching definitions.
 * @param {object} campaignData - The loaded campaign data.
 * @returns {Promise<{
 * armyBooks: object,
 * commonRules: object,
 * doctrines: object|null,
 * definitions: object
 * }>} Object containing the loaded data and the consolidated definitions.
 */
export async function loadGameData(campaignData) {
  const requiredGsId = config.GAME_SYSTEM_ID;
  const definitionsCacheKey = config.DEFINITIONS_CACHE_KEY;
  let definitions = {};
  let armyBooks = {};
  let commonRulesResult = null;
  let doctrinesDataResult = null;

  // --- Step 1: Check Definitions Cache ---
  try {
    const cachedDefinitions = sessionStorage.getItem(definitionsCacheKey);
    if (cachedDefinitions) {
      const parsedDefs = JSON.parse(cachedDefinitions);
      // Basic validation: check if it's a non-empty object
      if (
        parsedDefs &&
        typeof parsedDefs === "object" &&
        Object.keys(parsedDefs).length > 0
      ) {
        console.log(
          `Definitions loaded from sessionStorage cache (${
            Object.keys(parsedDefs).length
          } terms).`
        );
        definitions = parsedDefs;
        // If definitions are cached, we still need to load army books and doctrines (which might also be cached)
        // We can skip loading common rules/traits and custom defs as they are part of the definitions cache
        const doctrinesPromise = _loadDoctrinesDataInternal();
        // Load only army books
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
          uniqueFactions.forEach((faction) => {
            factionPromises.push(
              _loadArmyBookDataInternal(
                faction.id,
                faction.gameSystem,
                faction.name || faction.id
              )
            );
          });
        }
        const [doctrinesResult, ...bookResults] = await Promise.all([
          doctrinesPromise,
          ...factionPromises,
        ]);
        doctrinesDataResult = doctrinesResult;
        bookResults.forEach((result) => {
          if (result && result.bookData) {
            armyBooks[result.factionId] = result.bookData;
          }
        });

        // Return cached definitions and freshly loaded (or cached) books/doctrines
        return {
          armyBooks: armyBooks,
          commonRules: {}, // Indicate common rules were not fetched this time
          doctrines: doctrinesDataResult,
          definitions: definitions,
        };
      } else {
        console.warn(
          "Invalid definitions data found in cache. Clearing and fetching fresh."
        );
        sessionStorage.removeItem(definitionsCacheKey);
      }
    }
  } catch (e) {
    console.error("Error reading definitions cache:", e);
    sessionStorage.removeItem(definitionsCacheKey); // Clear potentially corrupt cache
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
  doctrinesDataResult = doctrinesResult; // Store loaded/cached doctrines

  // --- Step 3: Process Base Definitions (Custom > Common) ---
  // Process Custom Definitions first
  if (customDefsData) {
    (customDefsData.rules || []).forEach((rule) => {
      if (rule.name && rule.description) {
        definitions[rule.name] = {
          description: rule.description,
          type: "rules",
          source: "Custom",
        };
      }
    });
    (customDefsData.traits || []).forEach((trait) => {
      if (trait.name && trait.description) {
        definitions[trait.name] = {
          description: trait.description,
          type: "traits",
          source: "Custom",
        };
      }
    });
  }
  // Process Common Rules & Traits (only add if not already defined by custom)
  if (commonData) {
    commonRulesResult = { [requiredGsId]: commonData }; // Store raw data
    (commonData.rules || []).forEach((rule) => {
      if (rule.name && rule.description && !definitions[rule.name]) {
        definitions[rule.name] = {
          description: rule.description,
          type: "rules",
          source: "Common",
        };
      }
    });
    (commonData.traits || []).forEach((trait) => {
      if (trait.name && trait.description && !definitions[trait.name]) {
        definitions[trait.name] = {
          description: trait.description,
          type: "traits",
          source: "Common",
        };
      }
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
    uniqueFactions.forEach((faction) => {
      factionPromises.push(
        _loadArmyBookDataInternal(
          faction.id,
          faction.gameSystem,
          faction.name || faction.id
        )
      );
    });
  }
  const bookResults = await Promise.all(factionPromises);

  // --- Step 5: Process Faction Definitions (Rules & Spells) ---
  bookResults.forEach((result) => {
    if (result && result.bookData) {
      const { factionId, bookData, factionName } = result;
      armyBooks[factionId] = bookData; // Store raw book data

      (bookData.specialRules || []).forEach((rule) => {
        if (rule.name && rule.description && !definitions[rule.name]) {
          definitions[rule.name] = {
            description: rule.description,
            type: "special-rules",
            source: factionName,
          };
        }
      });
      (bookData.spells || []).forEach((spell) => {
        if (spell.name && spell.effect) {
          const spellKey = `${spell.name} (${factionName})`;
          if (!definitions[spellKey]) {
            definitions[spellKey] = {
              description: spell.effect,
              type: "spells",
              source: factionName,
              threshold: spell.threshold || 0,
            };
          }
        }
      });
    }
  });

  // --- Step 6: Cache Consolidated Definitions ---
  try {
    if (Object.keys(definitions).length > 0) {
      sessionStorage.setItem(definitionsCacheKey, JSON.stringify(definitions));
      console.log(
        `Saved ${
          Object.keys(definitions).length
        } definitions to sessionStorage cache.`
      );
    }
  } catch (e) {
    console.error("Error saving definitions to sessionStorage cache:", e);
    // Potentially show a warning to the user if storage is full
    if (e.name === "QuotaExceededError") {
      // Consider using showToast here if available/imported
      console.error("SessionStorage quota exceeded. Definitions not cached.");
    }
  }

  console.log(
    `Finished loading game data. Total unique definitions: ${
      Object.keys(definitions).length
    }`
  );
  return {
    armyBooks: armyBooks,
    commonRules: commonRulesResult || {},
    doctrines: doctrinesDataResult,
    definitions: definitions,
  };
}
