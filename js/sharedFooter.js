document.addEventListener("DOMContentLoaded", () => {
  const footer = document.querySelector("footer");
  if (footer) {
    footer.innerHTML = `
      <div id="resetButtonsContainer" style="display: none;">
        <div class="text-center my-3 d-flex justify-content-center gap-2 flex-wrap">
          <button type="button" id="reset-army-data-button" class="btn btn-sm btn-outline-danger">
            <i class="bi bi-exclamation-triangle"></i> Reset Current Army Data
          </button>
          <button type="button" id="reset-all-data-button" class="btn btn-sm btn-outline-warning">
            <i class="bi bi-trash3-fill"></i> Reset ALL Data
          </button>
        </div>
      </div>
      <p class="text-center text-muted mb-1">&copy; 2025 OPR Army Tracker</p>
      <div id="screenDiagnostics">
        <span id="screenWidthDisplay"></span>|
        <span id="screenHeightDisplay"></span>|
        <span id="screenThemeDisplay"></span>|
        <a href="army.html?armyId=IJ1JM_m-jmka">Dev Testerson</a>
      </div>
    `;

    // Show reset buttons only on army pages
    if (window.location.pathname.includes("army.html")) {
      document.getElementById("resetButtonsContainer").style.display = "block";
    }

    // Initialize screen diagnostics
    updateScreenDiagnostics();
    window.addEventListener("resize", updateScreenDiagnostics);
  }
});

/**
 * Updates the screen diagnostic display element with current window dimensions and theme.
 */
function updateScreenDiagnostics() {
  const widthDisplay = document.getElementById("screenWidthDisplay");
  const heightDisplay = document.getElementById("screenHeightDisplay");
  const themeDisplay = document.getElementById("screenThemeDisplay");

  if (widthDisplay) widthDisplay.textContent = `Width: ${window.innerWidth}px`;
  if (heightDisplay)
    heightDisplay.textContent = `Height: ${window.innerHeight}px`;
  if (themeDisplay) {
    const currentTheme =
      document.documentElement.getAttribute("data-bs-theme") || "auto";
    themeDisplay.textContent = `Theme: ${currentTheme}`;
  }
}
