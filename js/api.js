/**
 * @fileoverview Handles fetching army data from the OPR Army Forge API,
 * implementing client-side caching using sessionStorage and Last-Modified headers.
 */

import { config } from "./config.js";
import { showToast } from "./uiHelpers.js"; // For cache notifications

/**
 * Fetches army data from the One Page Rules Army Forge API, using sessionStorage for caching.
 * Validates cache using the Last-Modified header.
 *
 * @param {string} armyId - The specific ID of the army list on Army Forge.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 */
async function fetchArmyData(armyId) {
  const apiUrl = `${config.ARMYFORGE_LIST_API_URL_BASE}${armyId}`;
  const cacheKey = `${config.CACHE_PREFIX}${armyId}`;
  const timestampKey = `${config.TIMESTAMP_PREFIX}${armyId}`;

  console.log(`[Cache] Attempting to fetch data for armyId: ${armyId}`);

  // 1. Check Session Storage
  const cachedDataJSON = sessionStorage.getItem(cacheKey);
  const cachedTimestamp = sessionStorage.getItem(timestampKey);

  if (cachedDataJSON && cachedTimestamp) {
    console.log(
      `[Cache] Found cached data and timestamp for ${armyId}. Validating...`
    );
    try {
      // 2. Make HEAD request for validation
      const headResponse = await fetch(apiUrl, { method: "HEAD" });

      if (!headResponse.ok) {
        // If HEAD fails, proceed to full fetch (maybe API changed or issue occurred)
        console.warn(
          `[Cache] HEAD request failed for ${armyId} (Status: ${headResponse.status}). Fetching fresh data.`
        );
        return await _fetchAndCacheData(apiUrl, cacheKey, timestampKey, armyId);
      }

      const serverLastModified = headResponse.headers.get("Last-Modified");

      // 3. Compare Last-Modified timestamps
      if (serverLastModified && serverLastModified === cachedTimestamp) {
        console.log(
          `[Cache] Cache is valid for ${armyId}. Returning cached data.`
        );
        showToast(`Using cached army data for ${armyId}.`, "Cache Hit", 2000);
        // Parse and return cached data
        try {
          return JSON.parse(cachedDataJSON);
        } catch (parseError) {
          console.error(
            `[Cache] Error parsing cached JSON for ${armyId}:`,
            parseError
          );
          // If parsing fails, treat cache as invalid and fetch fresh
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
          return await _fetchAndCacheData(
            apiUrl,
            cacheKey,
            timestampKey,
            armyId
          );
        }
      } else {
        console.log(
          `[Cache] Cache outdated for ${armyId} (Server: ${serverLastModified}, Cached: ${cachedTimestamp}). Fetching fresh data.`
        );
        // Cache is outdated, proceed to full fetch
      }
    } catch (error) {
      console.error(
        `[Cache] Error during HEAD request validation for ${armyId}:`,
        error
      );
      // If validation fails (e.g., network error), proceed to full fetch as fallback
    }
  } else {
    console.log(
      `[Cache] No valid cache found for ${armyId}. Fetching fresh data.`
    );
  }

  // 4. Fetch fresh data (if no cache, cache outdated, or validation failed)
  return await _fetchAndCacheData(apiUrl, cacheKey, timestampKey, armyId);
}

/**
 * Performs a GET request to fetch data, caches it, and returns the data.
 * Internal helper function for fetchArmyData.
 * @param {string} apiUrl - The API endpoint URL.
 * @param {string} cacheKey - The sessionStorage key for the data.
 * @param {string} timestampKey - The sessionStorage key for the Last-Modified timestamp.
 * @param {string} armyId - The army ID for logging/error messages.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 * @private
 */
async function _fetchAndCacheData(apiUrl, cacheKey, timestampKey, armyId) {
  console.log(
    `[Cache] Fetching fresh data via GET for ${armyId} from ${apiUrl}`
  );
  try {
    const response = await fetch(apiUrl); // Default is GET

    if (!response.ok) {
      throw new Error(
        `HTTP error! status: ${response.status} - ${response.statusText}`
      );
    }

    const data = await response.json();
    console.log(`[Cache] Headers for ${armyId}:`, response.headers);
    const lastModified = response.headers.get("Last-Modified");

    // 5. Store fetched data and timestamp in sessionStorage
    if (lastModified) {
      try {
        sessionStorage.setItem(cacheKey, JSON.stringify(data));
        sessionStorage.setItem(timestampKey, lastModified);
        console.log(`[Cache] Stored fresh data and timestamp for ${armyId}.`);
      } catch (storageError) {
        console.error(
          `[Cache] Error saving to sessionStorage for ${armyId}:`,
          storageError
        );
        // Consider potential QuotaExceededError
        if (storageError.name === "QuotaExceededError") {
          showToast(
            "Cache storage full. Could not save army data.",
            "Cache Warning"
          );
        }
      }
    } else {
      console.warn(
        `[Cache] No Last-Modified header found in GET response for ${armyId}. Cannot cache effectively.`
      );
      // Optionally clear old cache if timestamp is missing now
      sessionStorage.removeItem(cacheKey);
      sessionStorage.removeItem(timestampKey);
    }

    console.log(`[Cache] Successfully fetched fresh data for ${armyId}.`);
    return data;
  } catch (error) {
    console.error(`[Cache] Could not fetch army data for ${armyId}:`, error);
    showToast(`Failed to fetch army data for ${armyId}.`, "Fetch Error");
    // Attempt to clear potentially inconsistent cache entries on error
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(timestampKey);
    return null; // Return null to indicate failure
  }
}

// Export the main function
export { fetchArmyData };
