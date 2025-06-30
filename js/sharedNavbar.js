//@ts-check
/**
 * @fileoverview Complete shared navigation component.
 * Generates entire navbar structure with proper active states.
 */

/**
 * Creates and injects the complete navbar structure.
 * @param {string} activePage - The current page identifier ('home', 'army', 'campaign', 'rules')
 */
function createNavbar(activePage = "") {
  const navContainer = document.getElementById("main-navbar");

  if (!navContainer) {
    console.error("Navbar container #main-navbar not found");
    return;
  }

  // Define navigation items
  const navItems = [
    { id: "home", text: "Home", href: "index.html" },
    { id: "army", text: "View Armies", href: "army.html" },
    { id: "campaign", text: "Campaign Status", href: "campaign.html" },
    { id: "rules", text: "Rules Reference", href: "rules.html" },
  ];

  // Build main nav items HTML
  const mainNavHTML = navItems
    .map((item) => {
      const isActive = item.id === activePage;
      const activeClass = isActive ? " active" : "";
      const ariaCurrent = isActive ? ' aria-current="page"' : "";

      return `
        <li class="nav-item">
          <a class="nav-link${activeClass}" href="${item.href}" ${ariaCurrent}>${item.text}</a>
        </li>
      `;
    })
    .join("");

  // Complete navbar HTML
  navContainer.innerHTML = `
    <div class="container-fluid">
      <a class="navbar-brand" href="index.html">Convergence Protocol</a>
      <button
        class="navbar-toggler"
        type="button"
        data-bs-toggle="collapse"
        data-bs-target="#navbarNav"
        aria-controls="navbarNav"
        aria-expanded="false"
        aria-label="Toggle navigation">
        <span class="navbar-toggler-icon"></span>
      </button>
      <div class="collapse navbar-collapse" id="navbarNav">
        <ul class="navbar-nav me-auto mb-2 mb-lg-0">
          ${mainNavHTML}
          <li class="nav-item dropdown">
            <a
              class="nav-link dropdown-toggle"
              href="#"
              role="button"
              data-bs-toggle="dropdown"
              aria-expanded="false">
              External Links
            </a>
            <ul class="dropdown-menu">
              <li>
                <a
                  class="dropdown-item"
                  href="https://army-forge.onepagerules.com/"
                  target="_blank">
                  <i
                    class="bi bi-box-arrow-up-right me-1 opacity-75"
                    role="img"
                    aria-label="external link icon"></i
                  >Army Forge
                </a>
              </li>
              <li><hr class="dropdown-divider" /></li>
              <li>
                <a
                  class="dropdown-item"
                  href="https://cdn.prod.website-files.com/636c3b6dcdb4eb2dce722889/671a88493d3bab9a55a9e004_GF%20-%20Core%20Rules%20v3.4.1%20-%20Print%20Friendly.pdf"
                  target="_blank">
                  <i class="bi bi-filetype-pdf me-1 opacity-75" role="img" aria-label="PDF icon"></i
                  >Core Rules v3.4.1
                </a>
              </li>
              <li>
                <a
                  class="dropdown-item"
                  href="https://cdn.prod.website-files.com/636c3b6dcdb4eb2dce722889/671a943e62a6cb93732e3371_GF%20-%20Beginner%27s%20Guide%20v3.4.1%20-%20Print-Friendly.pdf"
                  target="_blank">
                  <i class="bi bi-filetype-pdf me-1 opacity-75" role="img" aria-label="PDF icon"></i
                  >Beginner's Guide v3.4.1
                </a>
              </li>
              <li>
                <a
                  class="dropdown-item"
                  href="https://cdn.prod.website-files.com/636c3b6dcdb4eb2dce722889/66f684dc94f97125698755b6_GF%20-%20Campaign%20Rules%20v3.4.0.pdf"
                  target="_blank">
                  <i class="bi bi-filetype-pdf me-1 opacity-75" role="img" aria-label="PDF icon"></i
                  >Campaign Rules v3.4.0
                </a>
              </li>
            </ul>
          </li>
        </ul>
        <div class="dropdown">
          <button
            class="btn btn-sm btn-secondary dropdown-toggle"
            type="button"
            id="themeDropdown"
            data-bs-toggle="dropdown"
            aria-expanded="false">
            <i class="bi bi-circle-half theme-icon-active"></i> Theme
          </button>
          <ul class="dropdown-menu dropdown-menu-end" aria-labelledby="themeDropdown">
            <li>
              <button
                class="dropdown-item d-flex align-items-center"
                type="button"
                data-bs-theme-value="light">
                <i class="bi bi-sun-fill me-2"></i> Light
              </button>
            </li>
            <li>
              <button
                class="dropdown-item d-flex align-items-center"
                type="button"
                data-bs-theme-value="dark">
                <i class="bi bi-moon-stars-fill me-2"></i> Dark
              </button>
            </li>
            <li>
              <button
                class="dropdown-item d-flex align-items-center"
                type="button"
                data-bs-theme-value="auto">
                <i class="bi bi-circle-half me-2"></i> Auto
              </button>
            </li>
          </ul>
        </div>
      </div>
    </div>
  `;
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
  // Get page context from global variable if set
  const activePage = window.currentPage || "";
  createNavbar(activePage);
});
