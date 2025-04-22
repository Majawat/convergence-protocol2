//@ts-check
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
 * Renders a snapshot of the leaderboard as a table.
 * @param {object | null} campaignData - The loaded campaign data.
 */
function displayLeaderboardSnapshot(campaignData) {
  if (!leaderboardSnapshotElement) return;

  if (
    !campaignData ||
    !campaignData.armies ||
    campaignData.armies.length === 0
  ) {
    leaderboardSnapshotElement.innerHTML = `<p class="text-muted p-3">No campaign data available for leaderboard.</p>`; // Added padding
    return;
  }

  const basePoints = campaignData.basePoints || 0;
  const armies = campaignData.armies;

  // Calculate leaderboard data
  const leaderboardData = armies.map((army) => {
    const wins = army.wins || 0;
    const losses = army.losses || 0;
    const earnedVP = army.earnedVP || 0;
    const objectives = army.objectives || 0; // Not displayed in snapshot, but needed for sorting potentially
    const totalVP = wins * 2 + earnedVP;
    const totalGames = wins + losses;
    const positionScore = totalGames > 0 ? totalVP / totalGames : 0;

    return {
      player: army.player || "N/A",
      armyName: army.armyName || "Unnamed Army",
      vp: totalVP,
      wins: wins,
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

  // --- UPDATED: Display ALL players in a table ---
  // const topPlayers = leaderboardData.slice(0, 3); // REMOVED slice

  if (leaderboardData.length === 0) {
    // Check leaderboardData instead of topPlayers
    leaderboardSnapshotElement.innerHTML = `<p class="text-muted p-3">No players on leaderboard yet.</p>`; // Added padding
    return;
  }

  // Use table instead of list group
  let tableHTML = `
        <table class="table table-sm table-hover leaderboard-snapshot-table mb-0">
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>Army</th>
                    <th>VP</th>
                </tr>
            </thead>
            <tbody>
    `;
  leaderboardData.forEach((player, index) => {
    // Iterate over leaderboardData
    tableHTML += `
            <tr>
                <td><span class="badge bg-secondary rounded-pill">${
                  index + 1
                }</span></td>
                <td>${renderHTML(player.player)}</td>
                <td>${renderHTML(player.armyName)}</td>
                <td><span class="badge bg-primary rounded-pill">${
                  player.vp
                }</span></td>
            </tr>
        `;
  });
  tableHTML += `
            </tbody>
        </table>`;

  leaderboardSnapshotElement.innerHTML = tableHTML;
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
    // Handle cases where data loading failed
    if (missionSnapshotElement)
      missionSnapshotElement.innerHTML = `<p class="text-danger p-3">Could not load mission data.</p>`; // Added padding
    if (leaderboardSnapshotElement)
      leaderboardSnapshotElement.innerHTML = `<p class="text-danger p-3">Could not load leaderboard data.</p>`; // Added padding
  }
});
