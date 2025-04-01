// Import functions from other modules
// Note: Assuming api.js, dataProcessor.js, ui.js are in the same 'js/' folder
import { fetchArmyData } from "./api.js";
import { processArmyData } from "./dataProcessor.js";
import { displayArmyUnits } from "./ui.js";

// --- Main Application Logic ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM fully loaded and parsed");

  // Array of Army Forge IDs to load
  const ARMY_IDS_TO_LOAD = [
    "PzfU8vxUivqn", // Galdoo'o naahlk wildigitkw
    "Xo19MAwQPGbs", // van Louen's Roughnecks
    "Un3_pRTu2xBO", // Hive Fleet Tarvos
    "vMzljLVC6ZGv", // The Ashen Pact
  ];

  // Get the main container element where all army lists will be placed sequentially.
  const mainListContainer = document.getElementById("army-units-container");
  if (!mainListContainer) {
    console.error(
      "Main container #army-units-container not found! Cannot display armies."
    );
    // Display error prominently if container is missing
    document.body.insertAdjacentHTML(
      "afterbegin",
      '<div class="alert alert-danger m-5">Error: Page setup incorrect. Missing main container #army-units-container.</div>'
    );
    return;
  }
  // Set initial loading message
  mainListContainer.innerHTML =
    '<p class="m-4 text-center">Loading army data...</p>';

  try {
    // Fetch all armies concurrently using Promise.all
    console.log("Fetching data for armies:", ARMY_IDS_TO_LOAD);
    const armyDataPromises = ARMY_IDS_TO_LOAD.map((id) => fetchArmyData(id));
    const allRawData = await Promise.all(armyDataPromises);
    console.log("Finished fetching data.");

    // Clear loading message only after fetches complete
    mainListContainer.innerHTML = "";

    let armiesDisplayed = 0; // Count successfully displayed armies

    // Process and display each army sequentially
    allRawData.forEach((rawData, index) => {
      const armyId = ARMY_IDS_TO_LOAD[index];
      console.log(`Processing Army ID: ${armyId}`);

      // Create a dedicated container div for this army's display
      const armyDisplayBlock = document.createElement("div");
      armyDisplayBlock.id = `army-display-${armyId}`;
      armyDisplayBlock.className = "army-list-block mb-5"; // Add margin between army blocks
      mainListContainer.appendChild(armyDisplayBlock); // Add this army's block to the main container

      if (rawData) {
        const processedArmy = processArmyData(rawData);
        if (processedArmy) {
          // Pass the specific army's container block to the display function.
          displayArmyUnits(processedArmy, armyDisplayBlock);
          armiesDisplayed++;
        } else {
          // Display processing error within the army's block
          armyDisplayBlock.innerHTML = `<h2 class="mt-4 mb-3 text-warning">${
            rawData.name || `Army ${armyId}`
          }</h2><div class="alert alert-danger" role="alert">Error processing data for this army. Check console.</div>`;
        }
      } else {
        // Display loading error within the army's block
        armyDisplayBlock.innerHTML = `<h2 class="mt-4 mb-3 text-danger">Army ${armyId}</h2><div class="alert alert-warning" role="alert">Could not load data for this army from server. Check Army ID and network.</div>`;
      }

      // Add HR separator between army blocks
      if (index < allRawData.length - 1) {
        // Don't add after the last army
        const hr = document.createElement("hr");
        hr.className = "my-4"; // Add vertical margin to the separator
        mainListContainer.appendChild(hr);
      }
    });

    // If no armies were successfully loaded/processed, show a message
    if (armiesDisplayed === 0 && ARMY_IDS_TO_LOAD.length > 0) {
      mainListContainer.innerHTML =
        '<div class="alert alert-danger m-4" role="alert">Failed to load or process data for all requested armies. Please check Army IDs and network connection.</div>';
    }
  } catch (error) {
    // Catch any unexpected errors during the Promise.all or processing loop
    console.error("An error occurred during army loading/processing:", error);
    mainListContainer.innerHTML =
      '<div class="alert alert-danger m-4" role="alert">An unexpected error occurred. Please check the console for details.</div>';
  }
}); // End DOMContentLoaded
