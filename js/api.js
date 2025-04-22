//@ts-check
/**
 * @fileoverview Handles fetching army data from the OPR Army Forge API,
 * implementing client-side caching using sessionStorage.
 * Uses HEAD request for Last-Modified timestamp, then GET for data.
 * Validates cache using HEAD request and Last-Modified header.
 */

import { config } from "./config.js"; // Assuming config.js exports CACHE_PREFIX, TIMESTAMP_PREFIX, ARMYFORGE_LIST_API_URL_BASE
import { showToast } from "./uiHelpers.js"; // For cache notifications

/**
 * Fetches army data from the One Page Rules Army Forge API, using sessionStorage for caching.
 * Fetches fresh data using HEAD (for Last-Modified) then GET (for data).
 * Validates cache using HEAD request and Last-Modified header.
 *
 * @param {string} armyId - The specific ID of the army list on Army Forge.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 */
async function fetchArmyData(armyId) {
  if (!armyId) {
    console.error("[Cache] No armyId provided.");
    return null;
  }

  const apiUrl = `${config.ARMYFORGE_LIST_API_URL_BASE}${armyId}`;
  const cacheKey = `${config.CACHE_PREFIX}${armyId}`; //
  const timestampKey = `${config.TIMESTAMP_PREFIX}${armyId}`; //

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
        // If HEAD fails for validation, proceed to full fetch
        console.warn(
          `[Cache] Validation HEAD request failed for ${armyId} (Status: ${headResponse.status}). Fetching fresh data.`
        );
        return await _fetchFreshDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          armyId
        );
      }

      const serverLastModified = headResponse.headers.get("Last-Modified");

      // 3. Compare Last-Modified timestamps
      if (serverLastModified && serverLastModified === cachedTimestamp) {
        console.log(
          `[Cache] Cache is valid for ${armyId}. Returning cached data.`
        );
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
          return await _fetchFreshDataWithHeadGet(
            apiUrl,
            cacheKey,
            timestampKey,
            armyId
          );
        }
      } else if (!serverLastModified) {
        console.warn(
          `[Cache] No Last-Modified header found during validation HEAD for ${armyId}. Fetching fresh data.`
        );
        // Treat as potentially outdated if server stops sending header
        return await _fetchFreshDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          armyId
        );
      } else {
        console.log(
          `[Cache] Cache outdated for ${armyId} (Server: ${serverLastModified}, Cached: ${cachedTimestamp}). Fetching fresh data.`
        );
        // Cache is outdated, proceed to full fetch
        return await _fetchFreshDataWithHeadGet(
          apiUrl,
          cacheKey,
          timestampKey,
          armyId
        );
      }
    } catch (error) {
      console.error(
        `[Cache] Error during HEAD request validation for ${armyId}:`,
        error
      );
      // If validation fails (e.g., network error), proceed to full fetch as fallback
      return await _fetchFreshDataWithHeadGet(
        apiUrl,
        cacheKey,
        timestampKey,
        armyId
      );
    }
  } else {
    console.log(
      `[Cache] No valid cache found for ${armyId}. Fetching fresh data.`
    );
    // 4. Fetch fresh data (if no cache)
    return await _fetchFreshDataWithHeadGet(
      apiUrl,
      cacheKey,
      timestampKey,
      armyId
    );
  }
}

/**
 * Fetches fresh data using a HEAD request (for timestamp) followed by a GET request (for data).
 * Caches the data and timestamp if both are successfully retrieved.
 * Internal helper function for fetchArmyData.
 * @param {string} apiUrl - The API endpoint URL.
 * @param {string} cacheKey - The sessionStorage key for the data.
 * @param {string} timestampKey - The sessionStorage key for the Last-Modified timestamp.
 * @param {string} armyId - The army ID for logging/error messages.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 * @private
 */
async function _fetchFreshDataWithHeadGet(
  apiUrl,
  cacheKey,
  timestampKey,
  armyId
) {
  console.log(
    `[Cache] Fetching fresh data via HEAD+GET for ${armyId} from ${apiUrl}`
  );
  let lastModifiedFromHead = null;
  let dataFromGet = null;

  try {
    // --- HEAD Request ---
    try {
      console.log(`[Cache] Performing HEAD request for ${armyId}...`);
      const headResponse = await fetch(apiUrl, { method: "HEAD" });
      if (headResponse.ok) {
        lastModifiedFromHead = headResponse.headers.get("Last-Modified");
        if (lastModifiedFromHead) {
          console.log(
            `[Cache] HEAD request successful, Last-Modified: ${lastModifiedFromHead}`
          );
        } else {
          console.warn(
            `[Cache] HEAD request successful but no Last-Modified header found for ${armyId}.`
          );
        }
      } else {
        console.warn(
          `[Cache] HEAD request failed for ${armyId} (Status: ${headResponse.status}). Proceeding with GET.`
        );
        // Don't throw error yet, maybe GET still works
      }
    } catch (headError) {
      console.error(
        `[Cache] Error during initial HEAD request for ${armyId}:`,
        headError
      );
      // Continue to GET request as fallback
    }

    // --- GET Request ---
    console.log(`[Cache] Performing GET request for ${armyId}...`);
    const getResponse = await fetch(apiUrl); // Default is GET
    if (!getResponse.ok) {
      throw new Error(
        `GET request failed! status: ${getResponse.status} - ${getResponse.statusText}`
      );
    }
    dataFromGet = await getResponse.json();
    console.log(`[Cache] GET request successful for ${armyId}.`);

    // --- Cache and Return ---
    if (dataFromGet) {
      // Only cache if we got data
      if (lastModifiedFromHead) {
        // Only cache timestamp if HEAD succeeded
        try {
          sessionStorage.setItem(cacheKey, JSON.stringify(dataFromGet));
          sessionStorage.setItem(timestampKey, lastModifiedFromHead);
          console.log(`[Cache] Stored fresh data and timestamp for ${armyId}.`);
        } catch (storageError) {
          console.error(
            `[Cache] Error saving to sessionStorage for ${armyId}:`,
            storageError
          );
          if (storageError.name === "QuotaExceededError") {
            showToast(
              //
              "Cache storage full. Could not save army data.",
              "Cache Warning"
            );
          }
          // Clear potentially partial cache entries if storage fails
          sessionStorage.removeItem(cacheKey);
          sessionStorage.removeItem(timestampKey);
        }
      } else {
        // We got data, but no timestamp from HEAD. Cannot cache effectively.
        console.warn(
          `[Cache] Fetched data via GET but failed to get Last-Modified via HEAD for ${armyId}. Cannot cache timestamp.`
        );
        // Ensure no stale timestamp is left if data is fetched but timestamp isn't
        sessionStorage.removeItem(timestampKey);
        // Optionally store data without timestamp? Decided against it for simplicity.
        // sessionStorage.setItem(cacheKey, JSON.stringify(dataFromGet));
        // Best to clear both if timestamp is missing, to trigger fresh fetch next time.
        sessionStorage.removeItem(cacheKey);
      }
      return dataFromGet; // Return the data even if caching failed
    } else {
      // This case should technically be caught by the !getResponse.ok check, but added for safety
      throw new Error("GET request succeeded but returned no data.");
    }
  } catch (error) {
    console.error(
      `[Cache] Could not fetch fresh army data via HEAD+GET for ${armyId}:`,
      error
    );
    showToast(`Failed to fetch army data for ${armyId}.`, "Fetch Error"); //
    // Attempt to clear potentially inconsistent cache entries on error
    sessionStorage.removeItem(cacheKey);
    sessionStorage.removeItem(timestampKey);
    return null; // Return null to indicate failure
  }
}

// Export the main function
export { fetchArmyData };
