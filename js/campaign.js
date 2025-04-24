/**
 * @fileoverview Logic for the Campaign Status page.
 * Fetches campaign data, mission data, battle reports, calculates leaderboard,
 * and updates the UI. Includes logic to handle anchor links after dynamic load.
 */

// Import necessary functions from other modules
import { config } from "./config.js"; // Configuration constants
import {
  loadCampaignData,
  loadMissionsData,
  loadBattleReport,
} from "./dataLoader.js";
import { showToast } from "./uiHelpers.js"; // For notifications

// --- Global Variables ---
let missionsDataCache = null; // Cache fetched missions data
let battleReportsCache = {}; // Cache fetched battle reports { missionId: data }

// --- UI Element References ---
let campaignTitleElement;
let currentMissionDisplayElement;
let leaderboardDisplayElement;
let pastMissionsDisplayElement;
let upcomingMissionsDisplayElement;
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
  upcomingMissionsDisplayElement = document.getElementById(
    "upcoming-missions-display"
  );
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
 * Uses cached missions data if available. Fetches battle reports listed in missions data.
 * @returns {Promise<object|null>} An object containing campaignData, missionsData, and battleReportsData, or null on error.
 */
async function loadAllCampaignPageData() {
  try {
    const campaignData = await loadCampaignData();
    if (!campaignData) {
      throw new Error("Failed to load essential campaign data.");
    }

    if (!missionsDataCache) {
      missionsDataCache = await loadMissionsData();
    }
    const missionsData = missionsDataCache;

    const completedMissions =
      missionsData?.missions?.filter(
        (m) => m.status === "completed" && m.battleReportFile
      ) || [];

    const battleReportPromises = completedMissions.map((mission) =>
      loadBattleReport(mission.battleReportFile)
        .then((report) => {
          if (report && !report.missionId) {
            report.missionId = mission.number;
          }
          return report;
        })
        .catch((err) => {
          console.warn(
            `Failed to load battle report ${mission.battleReportFile}:`,
            err
          );
          return null;
        })
    );

    const battleReportsData = (await Promise.all(battleReportPromises)).filter(
      (report) => report !== null
    );

    battleReportsData.forEach((report) => {
      if (report.missionId) {
        battleReportsCache[report.missionId] = report;
      }
    });

    return { campaignData, missionsData, battleReportsData };
  } catch (error) {
    console.error("Error loading campaign page data:", error);
    // Use showToast if available
    if (typeof showToast === "function") {
      showToast(`Error loading campaign page: ${error.message}`, "Error");
    }
    // Display error state in UI elements
    if (campaignTitleElement)
      campaignTitleElement.textContent = "Error Loading Campaign";
    if (currentMissionDisplayElement)
      currentMissionDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load mission data.</div>`;
    if (leaderboardDisplayElement)
      leaderboardDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load leaderboard data.</div>`;
    if (pastMissionsDisplayElement)
      pastMissionsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load battle reports.</div>`;
    if (upcomingMissionsDisplayElement)
      upcomingMissionsDisplayElement.innerHTML = `<div class="alert alert-danger" role="alert">Could not load upcoming missions.</div>`;
    return null;
  }
}

// --- UI Rendering Functions ---

/**
 * Helper to safely render potentially HTML content within text.
 * @param {string} content - Text content, potentially containing HTML.
 * @returns {string} Sanitized or original HTML string.
 */
function renderHTML(content) {
  const tempDiv = document.createElement("div");
  tempDiv.innerHTML = content || "";
  tempDiv.querySelectorAll("script").forEach((script) => script.remove());
  return tempDiv.innerHTML;
}

/**
 * Renders the current mission details based on the 'status' field in missions.json.
 * @param {object | null} missionsData - The loaded missions data (e.g., from missions.json).
 */
function displayCurrentMission(missionsData) {
  if (!currentMissionDisplayElement) return;
  const currentMission = missionsData?.missions?.find(
    (m) => m.status === "current"
  );
  // ... (rest of function remains the same as previous version) ...
  if (currentMission) {
    let missionHTML = ` <div class="card shadow-sm">
      <div class="card-header bg-primary text-white">
        <h5 class="mb-0">
          Mission ${currentMission.number}:
          ${renderHTML(currentMission.title) || "Upcoming Mission"}
        </h5>
      </div>
      <div class="card-body">
        ${
          currentMission.overview
            ? `<p class="card-text lead">${renderHTML(
                currentMission.overview
              )}</p><hr>`
            : ""
        }
        ${
          currentMission.objective?.primary
            ? `<h6>Primary Objective:</h6><p>${renderHTML(
                currentMission.objective.primary
              )}</p>`
            : ""
        }
        ${
          currentMission.objective?.secondary &&
          currentMission.objective.secondary.length > 0
            ? `<h6>Secondary Objectives:</h6>
                         <ul>${currentMission.objective.secondary
                           .map(
                             (obj) =>
                               `<li><strong>${renderHTML(
                                 obj.name
                               )}:</strong> ${renderHTML(obj.description)}</li>`
                           )
                           .join("")}</ul>`
            : ""
        }
        ${
          currentMission.specialRules && currentMission.specialRules.length > 0
            ? `<h6>Special Rules:</h6>
                         <ul>${currentMission.specialRules
                           .map(
                             (rule) =>
                               `<li><strong>${renderHTML(
                                 rule.name
                               )}:</strong> ${renderHTML(
                                 rule.description
                               )}</li>`
                           )
                           .join("")}</ul>`
            : ""
        }
        ${
          currentMission.deployment
            ? `<h6 class="mt-3">Deployment:</h6><p>${renderHTML(
                currentMission.deployment
              )}</p>`
            : ""
        }
        ${
          currentMission.victoryConditions?.primary
            ? `<h6 class="mt-3">Victory Conditions:</h6><p>${renderHTML(
                currentMission.victoryConditions.primary
              )}</p>`
            : ""
        }
        ${
          currentMission.scoringSystem?.points &&
          currentMission.scoringSystem.points.length > 0
            ? `<h6 class="mt-3">Scoring:</h6>
                         <ul>${currentMission.scoringSystem.points
                           .map((pt) => `<li>${renderHTML(pt)}</li>`)
                           .join("")}</ul>`
            : ""
        }
        ${
          currentMission.terrainSuggestions &&
          currentMission.terrainSuggestions.length > 0
            ? `<h6 class="mt-3">Terrain Suggestions:</h6>
                         <ul>${currentMission.terrainSuggestions
                           .map(
                             (terrain) =>
                               `<li><strong>${renderHTML(
                                 terrain.name
                               )}:</strong> ${renderHTML(
                                 terrain.description
                               )}</li>`
                           )
                           .join("")}</ul>`
            : ""
        }
      </div>
      <div class="card-footer text-muted">
        ${currentMission.points ? `Base Points: ${currentMission.points}` : ""}
        ${
          currentMission.datetime
            ? `| Scheduled: ${new Date(
                currentMission.datetime
              ).toLocaleString()}`
            : ""
        }
      </div>
    </div>`;
    currentMissionDisplayElement.innerHTML = missionHTML;
  } else {
    currentMissionDisplayElement.innerHTML = `<div class="alert alert-info" role="alert">
      No current mission found. Check missions.json or the campaign may be complete.
    </div>`;
  }
}

/**
 * Calculates and renders the leaderboard.
 * Uses the Max Army Points calculation provided by the user.
 * @param {object} campaignData - The main campaign data.
 */
function displayLeaderboard(campaignData) {
  if (!leaderboardDisplayElement || !campaignData || !campaignData.armies) {
    if (leaderboardDisplayElement)
      leaderboardDisplayElement.innerHTML = `<div class="alert alert-warning" role="alert">
        Could not display leaderboard.
      </div>`;
    return;
  }
  // ... (rest of function remains the same as previous version) ...
  const basePoints = campaignData.basePoints || 0;
  const armies = campaignData.armies;
  const leaderboardData = armies.map((army) => {
    const wins = army.wins || 0;
    const losses = army.losses || 0;
    const earnedVP = army.earnedVP || 0;
    const objectives = army.objectives || 0;
    const earnedPts = army.earnedPts || 0;
    const totalVP = wins * 2 + earnedVP;
    const totalGames = wins + losses;
    const positionScore = totalGames > 0 ? totalVP / totalGames : 0;
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
      positionScore: positionScore,
    };
  });
  leaderboardData.sort((a, b) => {
    if (b.positionScore !== a.positionScore)
      return b.positionScore - a.positionScore;
    if (b.vp !== a.vp) return b.vp - a.vp;
    return b.wins - a.wins;
  });
  let tableHTML = `
    <table class="table table-striped table-hover table-sm leaderboard-table">
      <thead class="table-dark">
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
      <tbody></tbody>
    </table>
  `;
  leaderboardData.forEach((army, index) => {
    tableHTML += `
            <tr>
                <td>${index + 1}</td>
                <td>${renderHTML(army.player)}</td>
                <td>${renderHTML(army.armyName)}</td>
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
 * Renders the list of past missions/battle reports based on missions.json.
 * @param {object | null} missionsData - The loaded missions data.
 */
function displayPastMissions(missionsData) {
  if (!pastMissionsDisplayElement) return;
  // ... (rest of function remains the same as previous version) ...
  const completedMissions =
    missionsData?.missions?.filter(
      (m) => m.status === "completed" && m.battleReportFile
    ) || [];
  if (completedMissions.length === 0) {
    pastMissionsDisplayElement.innerHTML = `<p class="text-muted">No completed missions with battle reports found.</p>`;
    return;
  }
  completedMissions.sort((a, b) => (b.number || 0) - (a.number || 0));
  let reportsHTML = '<div class="list-group">';
  completedMissions.forEach((mission) => {
    reportsHTML += `
      <button
        type="button"
        class="list-group-item list-group-item-action view-report-btn"
        data-mission-id="${mission.number}"
        data-report-path="${mission.battleReportFile}">
        <div class="d-flex w-100 justify-content-between">
          <h5 class="mb-1">
            Mission ${mission.number}: ${
      renderHTML(mission.title) || "Completed Mission"
    }
          </h5>
          <small>Winner: ${renderHTML(mission.winner) || "N/A"}</small>
        </div>
        <p class="mb-1 text-muted small">
          ${mission.winningArmy ? `(${renderHTML(mission.winningArmy)})` : ""}
        </p>
        <small class="text-muted">Click to view details</small>
      </button>
    `;
  });
  reportsHTML += "</div>";
  pastMissionsDisplayElement.innerHTML = reportsHTML;
  document.querySelectorAll(".view-report-btn").forEach((button) => {
    button.addEventListener("click", handleViewReportClick);
  });
}

/**
 * Renders the list of upcoming missions based on missions.json.
 * @param {object | null} missionsData - The loaded missions data.
 */
function displayUpcomingMissions(missionsData) {
  if (!upcomingMissionsDisplayElement) return;
  // ... (rest of function remains the same as previous version) ...
  const upcomingMissions =
    missionsData?.missions?.filter((m) => m.status === "upcoming") || [];
  if (upcomingMissions.length === 0) {
    upcomingMissionsDisplayElement.innerHTML = `<p class="text-muted">No upcoming missions scheduled.</p>`;
    return;
  }
  upcomingMissions.sort((a, b) => (a.number || 0) - (b.number || 0));
  let upcomingHTML = '<div class="list-group">';
  upcomingMissions.forEach((mission) => {
    upcomingHTML += `
      <div class="list-group-item upcoming-mission-item">
        <div class="d-flex w-100 justify-content-between">
          <h6 class="mb-1">
            Mission ${mission.number}: ${
      renderHTML(mission.title) || "Upcoming Mission"
    }
          </h6>
          <small class="text-muted"
            >${renderHTML(mission.month) || ""}${
      mission.points ? ` | ${mission.points}pts` : ""
    }</small
          >
        </div>
        ${
          mission.overview
            ? `<p class="mb-1 small">${renderHTML(mission.overview)}</p>`
            : ""
        }
      </div>
    `;
  });
  upcomingHTML += "</div>";
  upcomingMissionsDisplayElement.innerHTML = upcomingHTML;
}

/**
 * Formats a block of text into HTML paragraphs based on newline characters.
 * @param {string} text - The text to format.
 * @returns {string} HTML string with paragraphs.
 */
function formatTextToParagraphs(text = "") {
  if (!text) return "<p>No description.</p>";
  const sanitizedText = text.replace(/<script.*?>.*?<\/script>/gi, "");
  let paragraphs = sanitizedText.split("\n\n");
  if (paragraphs.length <= 1) {
    paragraphs = sanitizedText.split("\n");
  }
  return paragraphs
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0)
    .map((paragraph) => `<p>${renderHTML(paragraph)}</p>`)
    .join("");
}

/**
 * Populates and shows the battle report modal using cached data.
 * @param {number|string} missionId - The ID of the mission report to show.
 */
function showBattleReportModal(missionId) {
  const reportData = battleReportsCache[missionId];
  // ... (rest of function remains the same as previous version) ...
  if (
    !battleReportModal ||
    !battleReportModalBodyElement ||
    !battleReportModalLabelElement ||
    !reportData
  ) {
    // Use showToast if available
    if (typeof showToast === "function") {
      showToast(
        `Could not display details for Mission ${missionId}. Report data missing.`,
        "Error"
      );
    } else {
      console.error(
        `Could not display details for Mission ${missionId}. Report data missing.`
      );
    }
    if (battleReportModal) battleReportModal.hide();
    return;
  }
  battleReportModalLabelElement.textContent =
    renderHTML(reportData.title) || `Mission ${reportData.missionId} Report`;
  let bodyHTML = `<p><strong>Participants:</strong> ${
    reportData.participants
      ?.map(
        (p) =>
          `${renderHTML(p.player)} (${renderHTML(p.army)})${
            p.result === "winner"
              ? " - Winner <i class='bi bi-trophy-fill text-warning'></i>"
              : ""
          }`
      )
      .join(", ") || "N/A"
  }</p><hr>`;
  if (reportData.rounds && reportData.rounds.length > 0) {
    bodyHTML += "<h4>Round Summaries</h4>";
    reportData.rounds.forEach((round) => {
      const formattedDescription = formatTextToParagraphs(round.description);
      bodyHTML += `
        <div class="mb-3 p-3 border rounded bg-body-tertiary shadow-sm">
          <h6>Round ${round.number}: ${renderHTML(round.title) || ""}</h6>
          ${formattedDescription}
          ${
            round.image
              ? `<figure class="figure text-center mt-2"> <img src="${
                  round.image
                }" alt="Round ${
                  round.number
                } image" class="img-fluid battle-report-img figure-img" onerror="this.style.display='none'; this.parentElement.style.display='none'; console.warn('Failed to load report image: ${
                  round.image
                }')"> ${
                  round.image_caption
                    ? `<figcaption class="figure-caption">${renderHTML(
                        round.image_caption
                      )}</figcaption>`
                    : ""
                } </figure>`
              : ""
          }
        </div>
      `;
    });
    bodyHTML += "<hr>";
  }
  if (reportData.keyMoments && reportData.keyMoments.length > 0) {
    bodyHTML += "<h4>Key Moments</h4><ul class='list-unstyled'>";
    reportData.keyMoments.forEach((moment) => {
      bodyHTML += `<li class="mb-2 p-2 border-start border-3 border-info"><strong>${
        renderHTML(moment.title) || "Moment"
      }:</strong> ${renderHTML(moment.description) || ""}</li>`;
    });
    bodyHTML += "</ul><hr>";
  }
  bodyHTML += `<h5>Conclusion</h5>${formatTextToParagraphs(
    reportData.conclusion
  )}`;
  battleReportModalBodyElement.innerHTML = bodyHTML;
  if (battleReportModal) battleReportModal.show();
}

// --- Event Handlers ---

/**
 * Handles clicking the 'View Report' button. Fetches if needed, then shows modal.
 * @param {Event} event - The click event.
 */
async function handleViewReportClick(event) {
  const button = event.currentTarget;
  const missionId = button.dataset.missionId;
  const reportPath = button.dataset.reportPath;
  // ... (rest of function remains the same as previous version) ...
  if (!missionId || !reportPath) {
    // Use showToast if available
    if (typeof showToast === "function") {
      showToast(
        "Could not determine which report to view (missing ID or path).",
        "Error"
      );
    } else {
      console.error(
        "Could not determine which report to view (missing ID or path)."
      );
    }
    return;
  }
  if (battleReportsCache[missionId]) {
    console.log(`Showing cached report for Mission ${missionId}`);
    showBattleReportModal(missionId);
    return;
  }
  console.log(`Fetching report for Mission ${missionId} from ${reportPath}`);
  if (battleReportModalBodyElement)
    battleReportModalBodyElement.innerHTML = `<div class="text-center p-4">
      <div class="spinner-border" role="status">
        <span class="visually-hidden">Loading...</span>
      </div>
      <p class="mt-2">Loading report...</p>
    </div>`;
  if (battleReportModalLabelElement)
    battleReportModalLabelElement.textContent = "Loading...";
  if (battleReportModal) battleReportModal.show();
  try {
    const reportData = await loadBattleReport(reportPath);
    if (reportData) {
      if (!reportData.missionId) reportData.missionId = parseInt(missionId, 10);
      battleReportsCache[reportData.missionId] = reportData;
      showBattleReportModal(reportData.missionId);
    } else {
      if (battleReportModal) battleReportModal.hide();
      if (typeof showToast === "function") {
        showToast(
          `Could not load details for Mission ${missionId}. File not found or invalid.`,
          "Error"
        );
      } else {
        console.error(
          `Could not load details for Mission ${missionId}. File not found or invalid.`
        );
      }
    }
  } catch (error) {
    if (battleReportModal) battleReportModal.hide();
    console.error(`Error loading battle report ${reportPath}:`, error);
    if (typeof showToast === "function") {
      showToast(`Error loading report: ${error.message}`, "Error");
    }
  }
}

/**
 * Checks the URL hash and scrolls to the corresponding element if found.
 * Should be called after dynamic content is loaded.
 */
function handleFragmentIdentifierScroll() {
  const hash = window.location.hash;
  if (hash) {
    // Use requestAnimationFrame to ensure scrolling happens after paint
    requestAnimationFrame(() => {
      try {
        // Remove the '#' character
        const elementId = hash.substring(1);
        const targetElement = document.getElementById(elementId);

        if (targetElement) {
          console.log(`Scrolling to element: #${elementId}`);
          targetElement.scrollIntoView({
            behavior: "smooth", // Use smooth scrolling
            block: "start", // Align top of element with top of viewport
          });
        } else {
          console.warn(`Element with ID ${elementId} not found for scrolling.`);
        }
      } catch (e) {
        console.error("Error scrolling to fragment:", e);
      }
    });
  }
}

// --- Initialization ---
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Campaign JS loaded.");
  initializeUIReferences();

  const pageData = await loadAllCampaignPageData();

  if (pageData) {
    const { campaignData, missionsData, battleReportsData } = pageData;

    if (campaignTitleElement && campaignData.campaignName) {
      campaignTitleElement.textContent = campaignData.campaignName;
    } else if (campaignTitleElement) {
      campaignTitleElement.textContent = "Campaign Status";
    }

    // Render UI sections
    displayCurrentMission(missionsData);
    displayLeaderboard(campaignData);
    displayPastMissions(missionsData);
    displayUpcomingMissions(missionsData);

    // --- Call the scroll handler AFTER rendering ---
    handleFragmentIdentifierScroll();
  }
  // Error handling for data loading is done within loadAllCampaignPageData
});
