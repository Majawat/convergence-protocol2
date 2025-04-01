/**
 * Fetches army data from the One Page Rules Army Forge API.
 * @param {string} armyId - The specific ID of the army list on Army Forge.
 * @returns {Promise<object|null>} A promise that resolves to the JSON data object, or null if the fetch fails.
 */
async function fetchArmyData(armyId) {
  // Construct the API URL using the provided army ID
  const apiUrl = `https://army-forge.onepagerules.com/api/tts?id=${armyId}`;
  console.log(`Fetching data from: ${apiUrl}`); // Log the URL for debugging
  try {
    // Perform the fetch request
    const response = await fetch(apiUrl);
    // Check if the request was successful (status code 200-299)
    if (!response.ok) {
      // Throw an error with the status text if the response is not ok
      throw new Error(
        `HTTP error! status: ${response.status} - ${response.statusText}`
      );
    }
    // Parse the JSON response body
    const data = await response.json();
    console.log(`Successfully fetched data for ${armyId}.`); // Log success
    return data; // Return the parsed JSON data
  } catch (error) {
    // Log any errors that occur during the fetch process
    console.error(`Could not fetch army data for ${armyId}:`, error);
    return null; // Return null to indicate failure
  }
}

// Export the function to make it available for import
export { fetchArmyData };
