/**
 * @fileoverview Logic for the Campaign Status page.
 * Fetches campaign data, mission data, battle reports, calculates leaderboard,
 * and updates the UI.
 */

// Import necessary functions from other modules
import { config } from "./config.js"; // Configuration constants
import {
  loadCampaignData,
  loadMissionsData, // Assuming this function will be added to dataLoader.js
  loadBattleReport, // Assuming this function will be added to dataLoader.js
} from "./dataLoader.js";
import { showToast } from "./uiHelpers.js"; // For notifications

// --- Constants ---
// Example: Assuming mission IDs for battle reports available
const BATTLE_REPORT_IDS = [1, 2]; // Replace with dynamic logic later

// --- UI Element References ---
let campaignTitleElement;
let currentMissionDisplayElement;
let leaderboardDisplayElement;
let pastMissionsDisplayElement;
let battleReportModalBodyElement;
let battleReportModalLabelElement;
let battleReportModal; // Bootstrap Modal instance

/**
 * Initializes UI element references.
 */
function initializeUIReferences() {
  campaignTitleElement = document.getElementById("campaign-title");
  currentMissionDisplayElement = document.getElementById(
    "current-mission-display"
  );
  leaderboardDisplayElement = document.getElementById("leaderboard-display");
  pastMissionsDisplayElement = document.getElementById("past-missions-display");
  battleReportModalBodyElement = document.getElementById(
    "battleReportModalBody"
  );
  battleReportModalLabelElement = document.getElementById(
    "battleReportModalLabel"
  );
  const modalEl = document.getElementById("battleReportModal");
  if (modalEl) {
    battleReportModal = new bootstrap.Modal(modalEl);
  } else {
    console.error("Battle Report Modal element not found!");
  }
}

// --- Data Loading and Processing ---

/**
 * Fetches all necessary data for the campaign page.
 * @returns {Promise<object|null>} An object containing campaignData, missionsData, and battleReportsData, or null on error.
 */
async function loadAllCampaignPageData() {
  try {
    // Fetch campaign data (essential)
    const campaignData = await loadCampaignData();
    if (!campaignData) {
      throw new Error("Failed to load essential campaign data.");
    }

    // Fetch missions data (optional, handle gracefully if missing)
    let missionsData = null;
    try {
      missionsData = await loadMissionsData(); // Needs implementation in dataLoader.js
    } catch (missionsError) {
      console.warn("Could not load missions data:", missionsError);
      showToast("Could not load mission details.", "Warning");
    }

    // Fetch available battle reports (using predefined IDs for now)
    const battleReportPromises = BATTLE_REPORT_IDS.map((id) =>
      loadBattleReport(id).catch((err) => {
        // Catch individual report load errors
        console.warn(`Failed to load battle report for mission ${id}:`, err);
        return null; // Return null for failed reports
      })
    );
    const battleReportsData = (await Promise.all(battleReportPromises)).filter(
      (report) => report !== null
    ); // Filter out nulls from failed loads

    return { campaignData, missionsData, battleReportsData };
  } catch (error) {
    console.error("Error loading campaign page data:", error);
    showToast(`Error loading campaign page: ${error.message}`, "Error");
    // Display error state in UI elements
    if (campaignTitleElement)
      campaignTitleElement.textContent = "Error Loading Campaign";
    if (currentMissionDisplayElement)
      currentMissionDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load mission data.</div>`;
    if (leaderboardDisplayElement)
      leaderboardDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load leaderboard data.</div>`;
    if (pastMissionsDisplayElement)
      pastMissionsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load battle reports.</div>`;
    return null;
  }
}

// --- UI Rendering Functions (Placeholders - To be implemented) ---

/**
 * Renders the current mission details.
 * @param {object} campaignData - The main campaign data.
 * @param {object | null} missionsData - The loaded missions data (e.g., from missions.json).
 * @param {Array} battleReportsData - Array of loaded battle report objects.
 */
function displayCurrentMission(campaignData, missionsData, battleReportsData) {
  if (!currentMissionDisplayElement) return;

  // --- Logic to determine the current mission ---
  // Example: Assume current mission is the one after the latest battle report
  const latestReportId = battleReportsData.reduce(
    (maxId, report) => Math.max(maxId, report?.missionId || 0),
    0
  );
  const currentMissionId = latestReportId + 1;
  const currentMission = missionsData?.missions?.find(
    (m) => m.id === currentMissionId
  );

  if (currentMission) {
    // TODO: Implement detailed HTML rendering for the mission card
    // Include: Title, Overview/Description, Objectives (Primary/Special), Special Rules
    let missionHTML = `
            <div class="card">
                <div class="card-header">
                    <h5 class="mb-0">${
                      currentMission.title || `Mission ${currentMissionId}`
                    }</h5>
                </div>
                <div class="card-body">
                    <p class="card-text">${
                      currentMission.overview || "No overview available."
                    }</p>
                    <h6>Objectives:</h6>
                    <ul>
                        ${
                          currentMission.objectives?.primary
                            ? `<li><strong>Primary:</strong> ${currentMission.objectives.primary}</li>`
                            : ""
                        }
                        ${
                          currentMission.objectives?.special
                            ? `<li><strong>Special:</strong> ${currentMission.objectives.special}</li>`
                            : ""
                        }
                        ${
                          !(
                            currentMission.objectives?.primary ||
                            currentMission.objectives?.special
                          )
                            ? "<li>No objectives specified.</li>"
                            : ""
                        }
                    </ul>
                    ${
                      currentMission.specialRules &&
                      currentMission.specialRules.length > 0
                        ? `<h6>Special Rules:</h6><ul>${currentMission.specialRules
                            .map(
                              (rule) =>
                                `<li><strong>${rule.name}:</strong> ${rule.description}</li>`
                            )
                            .join("")}</ul>`
                        : ""
                    }
                </div>
            </div>`;
    currentMissionDisplayElement.innerHTML = missionHTML;
  } else {
    currentMissionDisplayElement.innerHTML = `<div class="alert alert-info" role="alert">No current mission details found or campaign may be complete.</div>`;
  }
}

/**
 * Calculates and renders the leaderboard.
 * @param {object} campaignData - The main campaign data.
 */
function displayLeaderboard(campaignData) {
  if (!leaderboardDisplayElement || !campaignData || !campaignData.armies) {
    if (leaderboardDisplayElement)
      leaderboardDisplayElement.innerHTML = `<div class="alert alert-warning" role="alert">Could not display leaderboard.</div>`;
    return;
  }

  const basePoints = campaignData.basePoints || 0;
  const armies = campaignData.armies;

  // 1. Calculate stats for each army
  const leaderboardData = armies.map((army) => {
    const wins = army.wins || 0;
    const losses = army.losses || 0;
    const earnedVP = army.earnedVP || 0;
    const objectives = army.objectives || 0;
    const earnedPts = army.earnedPts || 0; // Assuming this exists for point calculation

    const totalVP = wins * 2 + earnedVP;
    const totalGames = wins + losses;
    // Handle division by zero for position calculation
    const positionScore = totalGames > 0 ? totalVP / totalGames : 0;

    // Calculate Max Army Points based on user's formula
    const maxArmyPoints =
      basePoints + 150 * wins + 300 * losses + earnedPts + 75 * objectives;

    return {
      player: army.player || "N/A",
      armyName: army.armyName || "Unnamed Army",
      vp: totalVP,
      wins: wins,
      losses: losses,
      objectives: objectives,
      maxPoints: maxArmyPoints,
      positionScore: positionScore, // For sorting
    };
  });

  // 2. Sort the leaderboard (by positionScore desc, then VP desc, then Wins desc)
  leaderboardData.sort((a, b) => {
    if (b.positionScore !== a.positionScore) {
      return b.positionScore - a.positionScore;
    }
    if (b.vp !== a.vp) {
      return b.vp - a.vp;
    }
    return b.wins - a.wins; // Tie-breaker
  });

  // 3. Generate HTML Table
  let tableHTML = `
        <table class="table table-striped table-hover leaderboard-table">
            <thead>
                <tr>
                    <th>Pos</th>
                    <th>Player</th>
                    <th>Army</th>
                    <th>VP</th>
                    <th>W-L</th>
                    <th>Spec. Obj</th>
                    <th>Max Pts</th>
                </tr>
            </thead>
            <tbody>
    `;

  leaderboardData.forEach((army, index) => {
    tableHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${army.player}</td>
                <td>${army.armyName}</td>
                <td>${army.vp}</td>
                <td>${army.wins}-${army.losses}</td>
                <td>${army.objectives}</td>
                <td>${army.maxPoints}</td>
            </tr>
        `;
  });

  tableHTML += `
            </tbody>
        </table>
    `;

  leaderboardDisplayElement.innerHTML = tableHTML;
}

/**
 * Renders the list of past missions/battle reports.
 * @param {Array} battleReportsData - Array of loaded battle report objects.
 */
function displayPastMissions(battleReportsData) {
  if (!pastMissionsDisplayElement) return;

  if (!battleReportsData || battleReportsData.length === 0) {
    pastMissionsDisplayElement.innerHTML = `<p class="text-muted">No battle reports available yet.</p>`;
    return;
  }

  // Sort reports by missionId descending (most recent first)
  battleReportsData.sort((a, b) => (b.missionId || 0) - (a.missionId || 0));

  let reportsHTML = '<div class="list-group">';

  battleReportsData.forEach((report) => {
    const winner = report.participants?.find((p) => p.result === "winner");
    reportsHTML += `
            <button type="button" class="list-group-item list-group-item-action view-report-btn" data-mission-id="${
              report.missionId
            }">
                <div class="d-flex w-100 justify-content-between">
                    <h5 class="mb-1">${
                      report.title || `Mission ${report.missionId}`
                    }</h5>
                    <small>Winner: ${winner?.player || "N/A"}</small>
                </div>
                <small class="text-muted">Click to view details</small>
            </button>
        `;
  });

  reportsHTML += "</div>";
  pastMissionsDisplayElement.innerHTML = reportsHTML;

  // Add event listeners to the newly created buttons
  document.querySelectorAll(".view-report-btn").forEach((button) => {
    button.addEventListener("click", handleViewReportClick);
  });
}

/**
 * Populates and shows the battle report modal.
 * @param {object} reportData - The specific battle report data object.
 */
function showBattleReportModal(reportData) {
  if (
    !battleReportModal ||
    !battleReportModalBodyElement ||
    !battleReportModalLabelElement ||
    !reportData
  ) {
    showToast("Could not display battle report details.", "Error");
    return;
  }

  battleReportModalLabelElement.textContent =
    reportData.title || `Mission ${reportData.missionId} Report`;

  // Build modal body HTML
  let bodyHTML = `<p><strong>Participants:</strong> ${
    reportData.participants
      ?.map(
        (p) =>
          `${p.player} (${p.army})${p.result === "winner" ? " - Winner" : ""}`
      )
      .join(", ") || "N/A"
  }</p><hr>`;

  if (reportData.rounds && reportData.rounds.length > 0) {
    bodyHTML += "<h4>Round Summaries</h4>";
    reportData.rounds.forEach((round) => {
      bodyHTML += `
                <div class="mb-3">
                    <h6>Round ${round.number}: ${round.title || ""}</h6>
                    <p>${round.description || "No summary."}</p>
                    ${
                      round.image
                        ? `<img src="${round.image}" alt="Round ${round.number} image" class="img-fluid battle-report-img mb-2" onerror="this.style.display='none'; console.warn('Failed to load report image: ${round.image}')">`
                        : ""
                    }
                    ${
                      round.image_caption
                        ? `<figcaption class="figure-caption text-center">${round.image_caption}</figcaption>`
                        : ""
                    }
                </div>
            `;
    });
    bodyHTML += "<hr>";
  }

  if (reportData.keyMoments && reportData.keyMoments.length > 0) {
    bodyHTML += "<h4>Key Moments</h4><ul>";
    reportData.keyMoments.forEach((moment) => {
      bodyHTML += `<li><strong>${moment.title}:</strong> ${moment.description}</li>`;
      // TODO: Add image support for key moments if desired
    });
    bodyHTML += "</ul><hr>";
  }

  bodyHTML += `<h5>Conclusion</h5><p>${
    reportData.conclusion || "No conclusion provided."
  }</p>`;

  battleReportModalBodyElement.innerHTML = bodyHTML;
  battleReportModal.show();
}

// --- Event Handlers ---

/**
 * Handles clicking the 'View Report' button.
 * @param {Event} event - The click event.
 */
async function handleViewReportClick(event) {
  const button = event.currentTarget;
  const missionId = button.dataset.missionId;

  if (!missionId) {
    showToast("Could not determine which report to view.", "Error");
    return;
  }

  // Show loading state in modal temporarily
  if (battleReportModalBodyElement)
    battleReportModalBodyElement.innerHTML = "Loading report...";
  if (battleReportModalLabelElement)
    battleReportModalLabelElement.textContent = "Loading...";
  if (battleReportModal) battleReportModal.show(); // Show modal while loading

  try {
    const reportData = await loadBattleReport(missionId); // Fetch the specific report
    if (reportData) {
      showBattleReportModal(reportData); // Populate and ensure modal is shown
    } else {
      if (battleReportModal) battleReportModal.hide(); // Hide modal if report fails
      showToast(`Could not load details for Mission ${missionId}.`, "Error");
    }
  } catch (error) {
    if (battleReportModal) battleReportModal.hide(); // Hide modal on error
    console.error(`Error loading battle report ${missionId}:`, error);
    showToast(`Error loading report: ${error.message}`, "Error");
  }
}

// --- Initialization ---

document.addEventListener("DOMContentLoaded", async () => {
  console.log("Campaign JS loaded.");
  initializeUIReferences();

  const pageData = await loadAllCampaignPageData();

  if (pageData) {
    const { campaignData, missionsData, battleReportsData } = pageData;

    // Set campaign title
    if (campaignTitleElement && campaignData.campaignName) {
      campaignTitleElement.textContent = campaignData.campaignName;
    } else if (campaignTitleElement) {
      campaignTitleElement.textContent = "Campaign Status"; // Default title
    }

    // Render UI sections
    displayCurrentMission(campaignData, missionsData, battleReportsData);
    displayLeaderboard(campaignData);
    displayPastMissions(battleReportsData);
  }
  // Error handling is done within loadAllCampaignPageData
});
