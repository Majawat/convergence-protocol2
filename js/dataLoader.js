/**
 * @fileoverview Handles fetching campaign data, army books, and common rules.
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

/**
 * Fetches Army Book data AND Common Rules data, utilizing sessionStorage.
 * @param {object} campaignData - The loaded campaign data.
 * @returns {Promise<{armyBooks: object, commonRules: object}>} Object containing the loaded data.
 */
export async function loadGameData(campaignData) {
  if (!campaignData || !campaignData.armies)
    return { armyBooks: {}, commonRules: {} };

  let cachedBooks = {};
  let cachedCommonRules = {};

  // 1. Try loading ALL caches from sessionStorage first
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

  const gfRulesKey = config.COMMON_RULES_CACHE_KEY_PREFIX + "2"; // Hardcoding GF for now
  try {
    const cachedGfRules = sessionStorage.getItem(gfRulesKey);
    if (cachedGfRules) {
      const parsedRules = JSON.parse(cachedGfRules);
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
      console.log("No GF Common Rules found in sessionStorage.");
    }
  } catch (e) {
    console.warn("Could not parse GF Common Rules cache.", e);
  }

  const factionsToFetch = new Map();
  const requiredGameSystems = new Set();

  // 2. Determine required factions and game systems
  campaignData.armies.forEach((army) => {
    if (army.faction) {
      army.faction.forEach((fac) => {
        if (fac.id && fac.gameSystem) {
          if (!cachedBooks[fac.id]) {
            if (!factionsToFetch.has(fac.id)) {
              factionsToFetch.set(fac.id, fac.gameSystem);
            }
          }
          if (fac.gameSystem === 2) {
            requiredGameSystems.add(2);
          }
        }
      });
    }
  });

  const fetchPromises = [];

  // 3. Queue Army Book fetches
  if (factionsToFetch.size > 0) {
    console.log("Army Books to fetch:", Array.from(factionsToFetch.keys()));
    factionsToFetch.forEach((gameSystem, factionId) => {
      const url = `${config.ARMYFORGE_BOOK_API_URL_BASE}${factionId}?gameSystem=${gameSystem}`;
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

  // 4. Queue Common Rules fetches
  let fetchedRulesSystems = new Set();
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
    if (!cachedCommonRules[gsId]) {
      console.log(
        `Common Rules for System ${gsId} not cached or invalid. Queueing fetch.`
      );
      const url = `${config.ARMYFORGE_COMMON_RULES_API_URL_BASE}${gsId}`;
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
      fetchedRulesSystems.add(gsId);
    } else {
      console.log(`Valid Common Rules for System ${gsId} found in cache.`);
    }
  });
  console.log(
    `[DEBUG] Finished checking required game systems. Promises to run: ${fetchPromises.length}`
  );

  // 5. Execute fetches
  if (fetchPromises.length > 0) {
    console.log("[DEBUG] Executing fetches...");
    const results = await Promise.allSettled(fetchPromises);
    console.log("[DEBUG] Fetches complete. Processing results...");
    results.forEach((result) => {
      console.log("[DEBUG] Processing fetch result:", result);
      if (result.status === "fulfilled" && result.value) {
        if (result.value.status === "fulfilled") {
          if (result.value.type === "book") {
            cachedBooks[result.value.factionId] = result.value.bookData;
            console.log(
              `Successfully fetched Army Book: ${result.value.factionId}`
            );
          } else if (result.value.type === "rules") {
            if (
              result.value.rulesData &&
              result.value.rulesData.rules &&
              Array.isArray(result.value.rulesData.rules)
            ) {
              cachedCommonRules[result.value.gameSystemId] =
                result.value.rulesData;
              console.log(
                `Successfully fetched Common Rules: System ${result.value.gameSystemId}`
              );
            } else {
              console.warn(
                `Fetched Common Rules for System ${result.value.gameSystemId} appear invalid. Data:`,
                result.value.rulesData
              );
              fetchedRulesSystems.delete(result.value.gameSystemId);
            }
          }
        } else {
          console.warn(
            `[DEBUG] Fetch promise fulfilled but inner status rejected:`,
            result.value
          );
          if (result.value.type === "rules")
            fetchedRulesSystems.delete(result.value.gameSystemId);
        }
      } else if (result.status === "rejected") {
        console.error(`[DEBUG] Fetch promise rejected:`, result.reason);
      }
    });

    // 6. Save updated caches
    try {
      if (factionsToFetch.size > 0) {
        sessionStorage.setItem(
          config.ARMY_BOOKS_CACHE_KEY,
          JSON.stringify(cachedBooks)
        );
        console.log("Updated Army Books cache in sessionStorage.");
      }
      fetchedRulesSystems.forEach((gsId) => {
        if (cachedCommonRules[gsId] && cachedCommonRules[gsId].rules) {
          sessionStorage.setItem(
            config.COMMON_RULES_CACHE_KEY_PREFIX + gsId,
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

  // 7. Return data
  console.log(
    "[DEBUG] Returning from loadGameData. Common Rules object:",
    cachedCommonRules
  );
  return { armyBooks: cachedBooks, commonRules: cachedCommonRules };
}
