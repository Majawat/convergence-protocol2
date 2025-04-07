/**
 * @fileoverview Handles fetching campaign data, army books, common rules, and doctrines. // <-- UPDATED description
 */
import { config } from "./config.js";

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
    // Error display should be handled by the caller (app.js)
    return null;
  }
}

// <-- ADDED: Function to load doctrines -->
/**
 * Fetches the doctrines data file, utilizing sessionStorage.
 * @returns {Promise<object|null>} The parsed doctrines data or null on error.
 */
async function loadDoctrinesData() {
  const cacheKey = config.DOCTRINES_CACHE_KEY;
  try {
    // Try loading from cache first
    const cachedData = sessionStorage.getItem(cacheKey);
    if (cachedData) {
      const parsedData = JSON.parse(cachedData);
      // Basic validation
      if (parsedData && Array.isArray(parsedData.doctrines)) {
        console.log("Doctrines data loaded from cache.");
        return parsedData;
      } else {
        console.warn("Invalid doctrines data found in cache. Removing.");
        sessionStorage.removeItem(cacheKey);
      }
    }

    // Fetch from URL if not in cache or cache was invalid
    console.log("Fetching doctrines data from URL...");
    const response = await fetch(config.DOCTRINES_DATA_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    // Validate fetched data before caching
    if (data && Array.isArray(data.doctrines)) {
      console.log("Doctrines data fetched successfully.");
      // Cache the valid data
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        console.log("Cached doctrines data.");
      } catch (cacheError) {
        console.error("Error caching doctrines data:", cacheError);
      }
      return data;
    } else {
      console.error("Fetched doctrines data is invalid:", data);
      return null;
    }
  } catch (error) {
    console.error("Error loading doctrines data:", error);
    return null;
  }
}

/**
 * Fetches Army Book data, Common Rules data, AND Doctrines data, utilizing sessionStorage. // <-- UPDATED description
 * @param {object} campaignData - The loaded campaign data (used only for identifying army books).
 * @returns {Promise<{armyBooks: object, commonRules: object, doctrines: object|null}>} Object containing the loaded data. // <-- UPDATED return type
 */
export async function loadGameData(campaignData) {
  if (!campaignData || !campaignData.armies) {
    console.warn("No campaign data or armies found for loading game data.");
    // <-- UPDATED return structure -->
    return { armyBooks: {}, commonRules: {}, doctrines: null };
  }

  let cachedBooks = {};
  let cachedCommonRules = {}; // Will only hold rules for the required system ID

  // --- Step 1: Load Army Books Cache ---
  try {
    const cachedBooksData = sessionStorage.getItem(config.ARMY_BOOKS_CACHE_KEY);
    if (cachedBooksData) {
      cachedBooks = JSON.parse(cachedBooksData) || {};
      console.log("Loaded Army Books cache.");
    }
  } catch (e) {
    console.warn("Could not parse Army Books cache.", e);
    cachedBooks = {};
  }

  // --- Step 2: Identify Required Factions (for Army Books) ---
  const factionsToFetch = new Map(); // { factionId: gameSystemId }
  campaignData.armies.forEach((army) => {
    if (army.faction) {
      army.faction.forEach((fac) => {
        if (fac.id && fac.gameSystem) {
          // Check if army book needs fetching
          if (!cachedBooks[fac.id]) {
            if (!factionsToFetch.has(fac.id)) {
              factionsToFetch.set(fac.id, fac.gameSystem);
            }
          }
        }
      });
    }
  });

  // --- Step 3: Load Required Common Rules Cache ---
  const requiredGsId = config.GAME_SYSTEM_ID;
  const rulesCacheKey = config.COMMON_RULES_CACHE_KEY_PREFIX + requiredGsId;
  let commonRulesNeedFetching = true; // Assume fetch is needed initially

  console.log(
    `Attempting to load Common Rules cache for System ${requiredGsId}...`
  );
  try {
    const cachedRulesData = sessionStorage.getItem(rulesCacheKey);
    if (cachedRulesData) {
      const parsedRules = JSON.parse(cachedRulesData);
      // Validate the cached data structure
      if (
        parsedRules &&
        parsedRules.rules &&
        Array.isArray(parsedRules.rules)
      ) {
        cachedCommonRules[requiredGsId] = parsedRules; // Store in the object with the correct key
        commonRulesNeedFetching = false; // Cache is valid, no fetch needed
        console.log(
          `Loaded valid Common Rules cache for System ${requiredGsId}.`
        );
      } else {
        console.log(
          `Cached Common Rules data for System ${requiredGsId} was invalid or empty.`
        );
        sessionStorage.removeItem(rulesCacheKey); // Remove invalid cache entry
      }
    } else {
      console.log(`No Common Rules cache found for System ${requiredGsId}.`);
    }
  } catch (e) {
    console.warn(
      `Could not parse Common Rules cache for System ${requiredGsId}.`,
      e
    );
    sessionStorage.removeItem(rulesCacheKey); // Remove potentially corrupted cache entry
  }

  // --- Step 4: Queue Fetches for Missing Data ---
  const fetchPromises = [];

  // Queue Army Book fetches
  if (factionsToFetch.size > 0) {
    console.log("Army Books to fetch:", Array.from(factionsToFetch.keys()));
    factionsToFetch.forEach((gameSystem, factionId) => {
      const url = `${config.ARMYFORGE_BOOK_API_URL_BASE}${factionId}?gameSystem=${gameSystem}`;
      fetchPromises.push(
        fetch(url)
          .then((response) => {
            if (!response.ok)
              throw new Error(
                `Book ${factionId}: ${response.statusText} (${response.status})`
              );
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

  // Queue Common Rules fetch (only if needed)
  let rulesWereFetched = false;
  if (commonRulesNeedFetching) {
    console.log(
      `Common Rules for System ${requiredGsId} not cached or invalid. Queueing fetch.`
    );
    const url = `${config.ARMYFORGE_COMMON_RULES_API_URL_BASE}${requiredGsId}`;
    fetchPromises.push(
      fetch(url)
        .then((response) => {
          if (!response.ok)
            throw new Error(
              `Common Rules ${requiredGsId}: ${response.statusText} (${response.status})`
            );
          return response.json();
        })
        .then((rulesData) => ({
          type: "rules",
          gameSystemId: requiredGsId,
          rulesData,
          status: "fulfilled",
        }))
        .catch((error) => {
          console.error(
            `Fetch failed for Common Rules ${requiredGsId}:`,
            error
          );
          return {
            type: "rules",
            gameSystemId: requiredGsId,
            status: "rejected",
            reason: error,
          };
        })
    );
    rulesWereFetched = true; // Mark that we attempted to fetch rules
  } else {
    console.log(
      `Valid Common Rules for System ${requiredGsId} already loaded.`
    );
  }

  // <-- ADDED: Queue Doctrines fetch (uses its own caching logic) -->
  // We always call loadDoctrinesData, it handles caching internally
  const doctrinesPromise = loadDoctrinesData().then((doctrines) => ({
    type: "doctrines",
    data: doctrines,
  }));
  fetchPromises.push(doctrinesPromise);

  // --- Step 5: Execute Fetches ---
  console.log(
    `Executing ${fetchPromises.length} fetches (including doctrines)...`
  ); // <-- UPDATED log
  const results = await Promise.allSettled(fetchPromises);
  console.log("Fetches complete. Processing results...");

  let fetchedRulesAreValid = false; // Track if the fetched rules (if any) are valid
  let fetchedDoctrinesData = null; // <-- ADDED: To store fetched doctrines

  results.forEach((result) => {
    if (result.status === "fulfilled" && result.value) {
      const data = result.value;

      // Handle doctrines separately
      if (data.type === "doctrines") {
        fetchedDoctrinesData = data.data; // Store the result of loadDoctrinesData
        if (fetchedDoctrinesData) {
          console.log("Doctrines data processed successfully.");
        } else {
          console.warn("Doctrines data failed to load or was invalid.");
        }
        return; // Skip the rest for doctrines
      }

      // Existing logic for books and rules
      if (data.status === "fulfilled") {
        if (data.type === "book") {
          cachedBooks[data.factionId] = data.bookData;
          console.log(`Successfully fetched Army Book: ${data.factionId}`);
        } else if (
          data.type === "rules" &&
          data.gameSystemId === requiredGsId
        ) {
          // Validate fetched rules data
          if (
            data.rulesData &&
            data.rulesData.rules &&
            Array.isArray(data.rulesData.rules)
          ) {
            cachedCommonRules[data.gameSystemId] = data.rulesData;
            fetchedRulesAreValid = true; // Mark fetched rules as valid
            console.log(
              `Successfully fetched Common Rules: System ${data.gameSystemId}`
            );
          } else {
            console.warn(
              `Fetched Common Rules for System ${data.gameSystemId} appear invalid. Data:`,
              data.rulesData
            );
          }
        }
      } else {
        console.warn(
          `Fetch promise fulfilled but operation failed for ${data.type} ${
            data.factionId || data.gameSystemId
          }:`,
          data.reason
        );
      }
    } else if (result.status === "rejected") {
      console.error(`Fetch promise rejected:`, result.reason);
    }
  });

  // --- Step 6: Save Updated Caches (Doctrines are cached within loadDoctrinesData) ---
  try {
    // Save Army Books if any were fetched
    if (factionsToFetch.size > 0) {
      sessionStorage.setItem(
        config.ARMY_BOOKS_CACHE_KEY,
        JSON.stringify(cachedBooks)
      );
      console.log("Updated Army Books cache in sessionStorage.");
    }
    // Save Common Rules ONLY if they were successfully fetched AND validated
    if (rulesWereFetched && fetchedRulesAreValid) {
      sessionStorage.setItem(
        rulesCacheKey,
        JSON.stringify(cachedCommonRules[requiredGsId])
      );
      console.log(
        `Updated Common Rules cache for System ${requiredGsId} in sessionStorage.`
      );
    } else if (rulesWereFetched && !fetchedRulesAreValid) {
      console.log(
        `Skipping saving rules cache for System ${requiredGsId} as fetched data was invalid.`
      );
    }
  } catch (error) {
    console.error("Error saving data cache to sessionStorage:", error);
  }

  // --- Step 7: Return Loaded Data ---
  // Ensure the returned object uses the specific required GsId as the key if rules exist
  const finalCommonRules = cachedCommonRules[requiredGsId]
    ? { [requiredGsId]: cachedCommonRules[requiredGsId] }
    : {};
  console.log("Returning game data. Common Rules object:", finalCommonRules);
  // <-- UPDATED return structure -->
  return {
    armyBooks: cachedBooks,
    commonRules: finalCommonRules,
    doctrines: fetchedDoctrinesData, // Return the loaded/cached doctrines
  };
}
