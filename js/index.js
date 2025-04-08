/**
 * @fileoverview Logic for the Index/Homepage.
 * Fetches campaign and mission data to display dashboard snapshots.
 */

import { loadCampaignData, loadMissionsData } from "./dataLoader.js";
import { showToast } from "./uiHelpers.js"; // Optional: For error notifications

// --- UI Element References ---
let missionSnapshotElement;
let leaderboardSnapshotElement;

// --- Helper Functions ---

/**
 * Basic sanitization helper to prevent script injection.
 * Renders potentially HTML content safely.
 * @param {string} content - Text content, potentially containing HTML.
 * @returns {string} Sanitized HTML string.
 */
const renderHTML = (content) => {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content || ""; // Use innerHTML to parse potential tags
  // Basic sanitization (remove script tags) - consider a more robust library if needed
  tempDiv.querySelectorAll("script").forEach((script) => script.remove());
  return tempDiv.innerHTML;
};

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  missionSnapshotElement = document.getElementById("dashboard-current-mission");
  leaderboardSnapshotElement = document.getElementById(
    "dashboard-leaderboard-snapshot"
  );
}

// --- Data Loading ---
// Re-fetching data for simplicity on the index page.
async function loadDashboardData() {
  try {
    const campaignData = await loadCampaignData();
    const missionsData = await loadMissionsData(); // Assumes missions.json exists
    return { campaignData, missionsData };
  } catch (error) {
    console.error("Error loading dashboard data:", error);
    // Use showToast if available and appropriate
    if (typeof showToast === "function") {
      showToast("Could not load dashboard data.", "Error");
    }
    return null;
  }
}

// --- UI Rendering Functions ---

/**
 * Renders a snapshot of the current mission.
 * @param {object | null} missionsData - The loaded missions data.
 */
function displayMissionSnapshot(missionsData) {
  if (!missionSnapshotElement) return;

  const currentMission = missionsData?.missions?.find(
    (m) => m.status === "current"
  );

  if (currentMission) {
    // Now calls the globally accessible renderHTML helper
    missionSnapshotElement.innerHTML = `
            <h6 class="card-subtitle mb-2 text-muted">Mission ${
              currentMission.number || "?"
            } - ${renderHTML(currentMission.month) || "TBD"}</h6>
            <p class="card-text"><strong>${
              renderHTML(currentMission.title) || "Title Missing"
            }</strong></p>
            ${
              currentMission.overview
                ? `<p class="small">${renderHTML(
                    currentMission.overview.substring(0, 150)
                  )}...</p>`
                : ""
            }
            ${
              currentMission.objective?.primary
                ? `<p class="small"><strong>Objective:</strong> ${renderHTML(
                    currentMission.objective.primary.substring(0, 100)
                  )}...</p>`
                : ""
            }
        `;
  } else {
    missionSnapshotElement.innerHTML = `<p class="text-muted">No current mission data available.</p>`;
  }
}

/**
 * Renders a snapshot of the top players on the leaderboard.
 * @param {object | null} campaignData - The loaded campaign data.
 */
function displayLeaderboardSnapshot(campaignData) {
  if (!leaderboardSnapshotElement) return;

  if (
    !campaignData ||
    !campaignData.armies ||
    campaignData.armies.length === 0
  ) {
    leaderboardSnapshotElement.innerHTML = `<p class="text-muted">No campaign data available for leaderboard.</p>`;
    return;
  }

  const basePoints = campaignData.basePoints || 0;
  const armies = campaignData.armies;

  // Calculate leaderboard data (same logic as campaign.js)
  const leaderboardData = armies.map((army) => {
    const wins = army.wins || 0;
    const losses = army.losses || 0;
    const earnedVP = army.earnedVP || 0;
    const objectives = army.objectives || 0;
    const earnedPts = army.earnedPts || 0;
    const totalVP = wins * 2 + earnedVP;
    const totalGames = wins + losses;
    const positionScore = totalGames > 0 ? totalVP / totalGames : 0;
    // Note: maxArmyPoints calculation is not needed for snapshot display, only for sorting logic used previously
    // const maxArmyPoints = basePoints + (150 * wins) + (300 * losses) + earnedPts + (75 * objectives);

    return {
      player: army.player || "N/A",
      armyName: army.armyName || "Unnamed Army",
      vp: totalVP,
      wins: wins, // Needed for sorting tie-breaker
      positionScore: positionScore,
    };
  });

  // Sort
  leaderboardData.sort((a, b) => {
    if (b.positionScore !== a.positionScore)
      return b.positionScore - a.positionScore;
    if (b.vp !== a.vp) return b.vp - a.vp;
    return b.wins - a.wins;
  });

  // Display top 3 (or fewer if less than 3 players)
  const topPlayers = leaderboardData.slice(0, 3);

  if (topPlayers.length === 0) {
    leaderboardSnapshotElement.innerHTML = `<p class="text-muted">No players on leaderboard yet.</p>`;
    return;
  }

  let listHTML = '<ul class="list-group list-group-flush">';
  topPlayers.forEach((player, index) => {
    // Now calls the globally accessible renderHTML helper
    listHTML += `
            <li class="list-group-item d-flex justify-content-between align-items-center">
                <span>
                    <span class="badge bg-secondary rounded-pill me-2">${
                      index + 1
                    }</span>
                    <strong>${renderHTML(player.player)}</strong> (${renderHTML(
      player.armyName
    )})
                </span>
                <span class="badge bg-primary rounded-pill">${
                  player.vp
                } VP</span>
            </li>
        `;
  });
  listHTML += "</ul>";

  leaderboardSnapshotElement.innerHTML = listHTML;
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Index JS Loaded");
  initializeUIReferences();

  const dashboardData = await loadDashboardData();

  if (dashboardData) {
    displayMissionSnapshot(dashboardData.missionsData);
    displayLeaderboardSnapshot(dashboardData.campaignData);
  } else {
    // Handle cases where data loading failed (error shown in loadDashboardData)
    if (missionSnapshotElement)
      missionSnapshotElement.innerHTML = `<p class="text-danger">Could not load mission data.</p>`;
    if (leaderboardSnapshotElement)
      leaderboardSnapshotElement.innerHTML = `<p class="text-danger">Could not load leaderboard data.</p>`;
  }
});
