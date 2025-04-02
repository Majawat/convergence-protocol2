/**
 * @fileoverview Contains helper functions for updating specific UI parts
 * not directly related to the main unit display (e.g., modals, toasts).
 */

/** Displays army selection list */
export function displayArmySelection(armies, container) {
  container.innerHTML = ""; // Clear previous content
  const prompt = document.createElement("div");
  prompt.className = "col-12 text-center mb-4";
  prompt.innerHTML = `<h2>Select an Army</h2><p>No specific army was requested via URL. Please choose an army below to view its details.</p>`;
  container.appendChild(prompt);

  const listContainer = document.createElement("div");
  listContainer.className = "col-12 col-md-8 col-lg-6 mx-auto";
  const listGroup = document.createElement("div");
  listGroup.className = "list-group";

  if (armies && armies.length > 0) {
    armies.forEach((army) => {
      const link = document.createElement("a");
      link.href = `army.html?armyId=${army.armyForgeID}`; // Link to same page with parameter
      link.className =
        "list-group-item list-group-item-action d-flex justify-content-between align-items-center";
      link.innerHTML = `
                <span>
                    <strong class="me-2">${
                      army.armyName || "Unnamed Army"
                    }</strong>
                    <small class="text-muted">(${
                      army.player || "Unknown Player"
                    })</small>
                </span>
                <i class="bi bi-chevron-right"></i>
            `;
      listGroup.appendChild(link);
    });
  } else {
    listGroup.innerHTML =
      '<p class="text-center text-muted">No armies found in campaign data.</p>';
  }

  listContainer.appendChild(listGroup);
  container.appendChild(listContainer);
}

/** Populates the Army Info Modal */
export function populateArmyInfoModal(armyInfo) {
  if (!armyInfo) return;
  const modalLabel = document.getElementById("armyInfoModalLabel");
  const img = document.getElementById("armyInfoImage");
  const tagline = document.getElementById("armyInfoTagline");
  const summary = document.getElementById("armyInfoSummary");
  const backstory = document.getElementById("armyInfoBackstory");
  const infoButton = document.getElementById("army-info-button");

  if (modalLabel)
    modalLabel.textContent = armyInfo.armyName || "Army Information";
  if (tagline) tagline.textContent = armyInfo.tagline || "";
  if (summary) summary.textContent = armyInfo.summary || "";
  if (backstory)
    backstory.innerHTML =
      armyInfo.backstory || "<p>No backstory available.</p>"; // Use innerHTML for HTML content
  if (img) {
    if (armyInfo.image) {
      img.src = armyInfo.image;
      img.alt = armyInfo.armyName || "Army Image";
      img.style.display = "block";
      img.style.objectPosition = armyInfo.imagePosition || "center center";
    } else {
      img.style.display = "none";
    }
  }
  if (infoButton) infoButton.disabled = false; // Enable button once data is loaded
}

/** Shows a Bootstrap Toast message */
export function showToast(message) {
  const toastElement = document.getElementById("themeToast"); // Reusing theme toast element
  if (!toastElement) {
    console.warn("Toast element #themeToast not found.");
    return;
  }
  const toastBody = toastElement.querySelector(".toast-body");
  if (!toastBody) {
    console.warn("Toast body not found in #themeToast.");
    return;
  }

  toastBody.textContent = message;

  if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
    try {
      const toastInstance = bootstrap.Toast.getOrCreateInstance(toastElement);
      toastInstance.show();
    } catch (error) {
      console.error("Error showing Bootstrap toast:", error);
    }
  } else {
    console.warn("Bootstrap Toast component not found.");
  }
}
