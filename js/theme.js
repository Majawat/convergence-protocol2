/*!
 * Color mode toggler for Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2024 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 * Modified to default to dark and simplify.
 */

(() => {
  "use strict";

  const THEME_STORAGE_KEY = "theme";

  /**
   * Gets the theme stored in localStorage.
   * @returns {string|null} The stored theme ('light', 'dark') or null.
   */
  const getStoredTheme = () => localStorage.getItem(THEME_STORAGE_KEY);

  /**
   * Stores the theme preference in localStorage.
   * @param {string} theme - The theme to store ('light', 'dark').
   */
  const setStoredTheme = (theme) =>
    localStorage.setItem(THEME_STORAGE_KEY, theme);

  /**
   * Determines the preferred theme based on storage or OS preference.
   * Defaults to 'dark'.
   * @returns {string} 'light' or 'dark'.
   */
  const getPreferredTheme = () => {
    const storedTheme = getStoredTheme();
    if (storedTheme) {
      return storedTheme;
    }
    // Default to dark if no preference or storage found
    // Check if OS preference is explicitly light, otherwise default dark
    return window.matchMedia("(prefers-color-scheme: light)").matches
      ? "light"
      : "dark";
  };

  /**
   * Sets the theme on the <html> element.
   * @param {string} theme - The theme to set ('light', 'dark').
   */
  const setTheme = (theme) => {
    if (theme === "auto") {
      theme = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }
    document.documentElement.setAttribute("data-bs-theme", theme);
    console.log("Theme set to:", theme);
  };

  // --- Initial Theme Application ---
  // Apply theme immediately on script load
  setTheme(getPreferredTheme());

  // --- Event Listeners (Run after DOM is ready) ---
  window.addEventListener("DOMContentLoaded", () => {
    // Add listeners for theme change buttons
    document.querySelectorAll("[data-bs-theme-value]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const theme = toggle.getAttribute("data-bs-theme-value");
        if (theme === "auto") {
          localStorage.removeItem(THEME_STORAGE_KEY);
        } else {
          setStoredTheme(theme);
        }
        setTheme(theme); // Apply the theme immediately
        // Optional: Update active state on buttons if needed here
      });
    });

    // Add listener for OS preference changes
    window
      .matchMedia("(prefers-color-scheme: dark)")
      .addEventListener("change", () => {
        const storedTheme = getStoredTheme();
        // Only update if no theme is explicitly stored (i.e., user wants 'auto')
        if (!storedTheme) {
          setTheme("auto");
        }
      });
  });
})(); // Immediately Invoked Function Expression (IIFE)
