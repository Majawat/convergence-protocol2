//@ts-check
/**
 * @fileoverview Handles fetching army data from the OPR Army Forge API,
 * implementing client-side caching using sessionStorage.
 * Uses HEAD request for Last-Modified timestamp, then GET for data.
 * Validates cache using HEAD request and Last-Modified header.
 */

import { config } from "./config.js";
import { showToast } from "./uiHelpers.js"; // For cache notifications

/**
 * Fetches army LIST data from the One Page Rules Army Forge API, using sessionStorage for caching.
 * Validates cache using HEAD request and Last-Modified header.
 * Can also load from local JSON files if config.USE_LOCAL_ARMY_DATA is enabled.
 *
 * @param {string} armyId - The specific ID of the army list on Army Forge.
 * @param {string} [armyURL] - Optional: The army URL slug for loading local files (e.g., "the-ashen-pact").
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 */
async function fetchArmyData(armyId, armyURL = null) {
  if (!armyId) {
    console.error("[Cache] No armyId provided for army list fetch.");
    return null;
  }

  // --- LOCAL MODE: Load from local JSON file ---
  if (config.USE_LOCAL_ARMY_DATA && armyURL) {
    console.log(`[Local] Loading army data from local file for ${armyURL}`);
    const localPath = `${config.LOCAL_ARMY_DATA_PATH}${armyURL}.json`;
    try {
      const response = await fetch(localPath);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log(`[Local] Successfully loaded army data from ${localPath}`);
      return data;
    } catch (error) {
      console.error(`[Local] Failed to load army data from ${localPath}:`, error);
      console.log(`[Local] Falling back to Army Forge API...`);
      // Fall through to API fetch below
    }
  }

  // --- API MODE: Fetch from Army Forge API ---
  const apiUrl = `${config.ARMYFORGE_LIST_API_URL_BASE}${armyId}`;
  // Use updated prefixes from config.js
  const cacheKey = `${config.ARMY_LIST_DATA_PREFIX}${armyId}`;
  const timestampKey = `${config.ARMY_LIST_TIMESTAMP_PREFIX}${armyId}`;
  const logIdentifier = `List ${armyId}`;

  console.log(`[Cache] Attempting to fetch data for ${logIdentifier}`);

  // 1. Check Session Storage
  const cachedDataJSON = sessionStorage.getItem(cacheKey);
  const cachedTimestamp = sessionStorage.getItem(timestampKey);

  if (cachedDataJSON && cachedTimestamp) {
    console.log(
      `[Cache] Found cached data and timestamp for ${logIdentifier}. Validating...`,
    );
    try {
      // 2. Make HEAD request for validation
      const headResponse = await fetch(apiUrl, { method: "HEAD" });

      if (!headResponse.ok) {
        console.warn(
          `[Cache] Validation HEAD request failed for ${logIdentifier} (Status: ${headResponse.status}). Fetching fresh data.`,
        );
        return await _fetchFreshListDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      }

      const serverLastModified = headResponse.headers.get("Last-Modified");

      // 3. Compare Last-Modified timestamps
      if (serverLastModified && serverLastModified === cachedTimestamp) {
        console.log(
          `[Cache] Cache is valid for ${logIdentifier}. Returning cached data.`,
        );
        try {
          return JSON.parse(cachedDataJSON);
        } catch (parseError) {
          console.error(
            `[Cache] Error parsing cached JSON for ${logIdentifier}:`,
            parseError,
          );
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
          return await _fetchFreshListDataWithHeadGet(
            apiUrl,
            cacheKey,
            timestampKey,
            logIdentifier,
          );
        }
      } else if (!serverLastModified) {
        console.warn(
          `[Cache] No Last-Modified header found during validation HEAD for ${logIdentifier}. Fetching fresh data.`,
        );
        return await _fetchFreshListDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      } else {
        console.log(
          `[Cache] Cache outdated for ${logIdentifier} (Server: ${serverLastModified}, Cached: ${cachedTimestamp}). Fetching fresh data.`,
        );
        return await _fetchFreshListDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      }
    } catch (error) {
      console.error(
        `[Cache] Error during HEAD request validation for ${logIdentifier}:`,
        error,
      );
      return await _fetchFreshListDataWithHeadGet(
        apiUrl,
        cacheKey,
        timestampKey,
        logIdentifier,
      );
    }
  } else {
    console.log(
      `[Cache] No valid cache found for ${logIdentifier}. Fetching fresh data.`,
    );
    // 4. Fetch fresh data (if no cache)
    return await _fetchFreshListDataWithHeadGet(
      apiUrl,
      cacheKey,
      timestampKey,
      logIdentifier,
    );
  }
}

/**
 * Fetches fresh army LIST data using HEAD then GET. Caches data and timestamp.
 * Internal helper function for fetchArmyData.
 * @param {string} apiUrl - The API endpoint URL.
 * @param {string} cacheKey - The sessionStorage key for the data (using ARMY_LIST_DATA_PREFIX).
 * @param {string} timestampKey - The sessionStorage key for the Last-Modified timestamp (using ARMY_LIST_TIMESTAMP_PREFIX).
 * @param {string} logIdentifier - Identifier for logging (e.g., "List X").
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 * @private
 */
async function _fetchFreshListDataWithHeadGet(
  apiUrl,
  cacheKey,
  timestampKey,
  logIdentifier,
) {
  console.log(
    `[Cache] Fetching fresh list data via HEAD+GET for ${logIdentifier} from ${apiUrl}`,
  );
  let lastModifiedFromHead = null;
  let dataFromGet = null;

  try {
    // --- HEAD Request ---
    try {
      console.log(`[Cache] Performing HEAD request for ${logIdentifier}...`);
      const headResponse = await fetch(apiUrl, { method: "HEAD" });
      if (headResponse.ok) {
        lastModifiedFromHead = headResponse.headers.get("Last-Modified");
        if (lastModifiedFromHead) {
          console.log(
            `[Cache] HEAD successful for ${logIdentifier}, Last-Modified: ${lastModifiedFromHead}`,
          );
        } else {
          console.warn(
            `[Cache] HEAD successful but no Last-Modified header found for ${logIdentifier}.`,
          );
        }
      } else {
        console.warn(
          `[Cache] HEAD request failed for ${logIdentifier} (Status: ${headResponse.status}). Proceeding with GET.`,
        );
      }
    } catch (headError) {
      console.error(
        `[Cache] Error during initial HEAD request for ${logIdentifier}:`,
        headError,
      );
    }

    // --- GET Request ---
    console.log(`[Cache] Performing GET request for ${logIdentifier}...`);
    const getResponse = await fetch(apiUrl); // Default is GET
    if (!getResponse.ok) {
      throw new Error(
        `GET request failed! status: ${getResponse.status} - ${getResponse.statusText}`,
      );
    }
    dataFromGet = await getResponse.json();
    console.log(`[Cache] GET request successful for ${logIdentifier}.`);

    // --- Cache and Return ---
    if (dataFromGet) {
      if (lastModifiedFromHead) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(dataFromGet));
          sessionStorage.setItem(timestampKey, lastModifiedFromHead);
          console.log(
            `[Cache] Stored fresh list data and timestamp for ${logIdentifier}.`,
          );
        } catch (storageError) {
          console.error(
            `[Cache] Error saving list data to sessionStorage for ${logIdentifier}:`,
            storageError,
          );
          if (storageError.name === "QuotaExceededError") {
            showToast(
              "Cache storage full. Could not save army list data.",
              "Cache Warning",
            );
          }
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
        }
      } else {
        console.warn(
          `[Cache] Fetched list data via GET but failed to get Last-Modified via HEAD for ${logIdentifier}. Cannot cache timestamp.`,
        );
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(timestampKey);
      }
      return dataFromGet;
    } else {
      throw new Error("GET request succeeded but returned no data.");
    }
  } catch (error) {
    console.error(
      `[Cache] Could not fetch fresh army list data via HEAD+GET for ${logIdentifier}:`,
      error,
    );
    showToast(
      `Failed to fetch army list data for ${logIdentifier}.`,
      "Fetch Error",
    );
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(timestampKey);
    return null;
  }
}

// --- Army Book Fetching ---

/**
 * Fetches army BOOK data from the One Page Rules Army Forge API, using sessionStorage for caching.
 * Validates cache using HEAD request and Last-Modified header.
 *
 * @param {string} factionId - The specific ID of the army book faction.
 * @param {string|number} gameSystem - The game system ID for the army book.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 */
async function fetchArmyBookData(factionId, gameSystem) {
  if (!factionId || gameSystem === undefined || gameSystem === null) {
    console.error(
      "[Cache] No factionId or gameSystem provided for army book fetch.",
    );
    return null;
  }

  const apiUrl = `${config.ARMYFORGE_BOOK_API_URL_BASE}${factionId}?gameSystem=${gameSystem}`;
  // Use updated prefixes from config.js
  const cacheKey = `${config.ARMY_BOOKS_DATA_PREFIX}${factionId}_${gameSystem}`;
  const timestampKey = `${config.ARMY_BOOKS_TIMESTAMP_PREFIX}${factionId}_${gameSystem}`;
  const logIdentifier = `Book ${factionId} (GS:${gameSystem})`;

  console.log(
    `[Cache] Attempting to fetch data for ${logIdentifier} using keys: Data='${cacheKey}', Timestamp='${timestampKey}'`,
  );

  // 1. Check Session Storage
  const cachedDataJSON = sessionStorage.getItem(cacheKey);
  const cachedTimestamp = sessionStorage.getItem(timestampKey);

  if (cachedDataJSON && cachedTimestamp) {
    console.log(
      `[Cache] Found cached data and timestamp for ${logIdentifier}. Validating...`,
    );
    try {
      // 2. Make HEAD request for validation
      const headResponse = await fetch(apiUrl, { method: "HEAD" });

      if (!headResponse.ok) {
        console.warn(
          `[Cache] Validation HEAD request failed for ${logIdentifier} (Status: ${headResponse.status}). Fetching fresh data.`,
        );
        return await _fetchFreshBookDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      }

      const serverLastModified = headResponse.headers.get("Last-Modified");

      // 3. Compare Last-Modified timestamps
      if (serverLastModified && serverLastModified === cachedTimestamp) {
        console.log(
          `[Cache] Cache is valid for ${logIdentifier}. Returning cached data.`,
        );
        try {
          return JSON.parse(cachedDataJSON);
        } catch (parseError) {
          console.error(
            `[Cache] Error parsing cached JSON for ${logIdentifier}:`,
            parseError,
          );
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
          return await _fetchFreshBookDataWithHeadGet(
            apiUrl,
            cacheKey,
            timestampKey,
            logIdentifier,
          );
        }
      } else if (!serverLastModified) {
        console.warn(
          `[Cache] No Last-Modified header found during validation HEAD for ${logIdentifier}. Fetching fresh data.`,
        );
        return await _fetchFreshBookDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      } else {
        console.log(
          `[Cache] Cache outdated for ${logIdentifier} (Server: ${serverLastModified}, Cached: ${cachedTimestamp}). Fetching fresh data.`,
        );
        return await _fetchFreshBookDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          logIdentifier,
        );
      }
    } catch (error) {
      console.error(
        `[Cache] Error during HEAD request validation for ${logIdentifier}:`,
        error,
      );
      return await _fetchFreshBookDataWithHeadGet(
        apiUrl,
        cacheKey,
        timestampKey,
        logIdentifier,
      );
    }
  } else {
    console.log(
      `[Cache] No valid cache found for ${logIdentifier}. Fetching fresh data.`,
    );
    // 4. Fetch fresh data (if no cache)
    return await _fetchFreshBookDataWithHeadGet(
      apiUrl,
      cacheKey,
      timestampKey,
      logIdentifier,
    );
  }
}

/**
 * Fetches fresh army BOOK data using HEAD then GET. Caches data and timestamp.
 * Internal helper function for fetchArmyBookData.
 * @param {string} apiUrl - The API endpoint URL.
 * @param {string} cacheKey - The sessionStorage key for the data (using ARMY_BOOKS_DATA_PREFIX).
 * @param {string} timestampKey - The sessionStorage key for the Last-Modified timestamp (using ARMY_BOOKS_TIMESTAMP_PREFIX).
 * @param {string} logIdentifier - Identifier for logging (e.g., "Book X (GS:Y)").
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 * @private
 */
async function _fetchFreshBookDataWithHeadGet(
  apiUrl,
  cacheKey,
  timestampKey,
  logIdentifier,
) {
  console.log(
    `[Cache] Fetching fresh book data via HEAD+GET for ${logIdentifier} from ${apiUrl}`,
  );
  let lastModifiedFromHead = null;
  let dataFromGet = null;

  try {
    // --- HEAD Request ---
    try {
      console.log(`[Cache] Performing HEAD request for ${logIdentifier}...`);
      const headResponse = await fetch(apiUrl, { method: "HEAD" });
      if (headResponse.ok) {
        lastModifiedFromHead = headResponse.headers.get("Last-Modified");
        if (lastModifiedFromHead) {
          console.log(
            `[Cache] HEAD successful for ${logIdentifier}, Last-Modified: ${lastModifiedFromHead}`,
          );
        } else {
          console.warn(
            `[Cache] HEAD successful but no Last-Modified header found for ${logIdentifier}.`,
          );
        }
      } else {
        console.warn(
          `[Cache] HEAD request failed for ${logIdentifier} (Status: ${headResponse.status}). Proceeding with GET.`,
        );
      }
    } catch (headError) {
      console.error(
        `[Cache] Error during initial HEAD request for ${logIdentifier}:`,
        headError,
      );
    }

    // --- GET Request ---
    console.log(`[Cache] Performing GET request for ${logIdentifier}...`);
    const getResponse = await fetch(apiUrl); // Default is GET
    if (!getResponse.ok) {
      throw new Error(
        `GET request failed! status: ${getResponse.status} - ${getResponse.statusText}`,
      );
    }
    dataFromGet = await getResponse.json();
    console.log(`[Cache] GET request successful for ${logIdentifier}.`);

    // --- Cache and Return ---
    if (dataFromGet) {
      if (lastModifiedFromHead) {
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(dataFromGet));
          sessionStorage.setItem(timestampKey, lastModifiedFromHead);
          console.log(
            `[Cache] Stored fresh book data and timestamp for ${logIdentifier}.`,
          );
        } catch (storageError) {
          console.error(
            `[Cache] Error saving book data to sessionStorage for ${logIdentifier}:`,
            storageError,
          );
          if (storageError.name === "QuotaExceededError") {
            showToast(
              "Cache storage full. Could not save army book data.",
              "Cache Warning",
            );
          }
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
        }
      } else {
        console.warn(
          `[Cache] Fetched book data via GET but failed to get Last-Modified via HEAD for ${logIdentifier}. Cannot cache timestamp.`,
        );
        sessionStorage.removeItem(cacheKey);
        sessionStorage.removeItem(timestampKey);
      }
      return dataFromGet; // Return data even if caching failed
    } else {
      throw new Error("GET request succeeded but returned no data.");
    }
  } catch (error) {
    console.error(
      `[Cache] Could not fetch fresh army book data via HEAD+GET for ${logIdentifier}:`,
      error,
    );
    showToast(
      `Failed to fetch army book data for ${logIdentifier}.`,
      "Fetch Error",
    );
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(timestampKey);
    return null;
  }
}

// Export all necessary functions
export { fetchArmyData, fetchArmyBookData };
