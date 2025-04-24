/*!
 * Color mode toggler for Bootstrap's docs (https://getbootstrap.com/)
 * Copyright 2011-2024 The Bootstrap Authors
 * Licensed under the Creative Commons Attribution 3.0 Unported License.
 * Modified to default to dark, simplify, and add theme change toast notification.
 */

import { config } from "./config.js";

(() => {
  "use strict";

  /**
   * Gets the theme stored in localStorage.
   * @returns {string|null} The stored theme ('light', 'dark') or null.
   */
  const getStoredTheme = () => localStorage.getItem(config.THEME_STORAGE_KEY);

  /**
   * Stores the theme preference in localStorage.
   * @param {string} theme - The theme to store ('light', 'dark').
   */
  const setStoredTheme = (theme) => localStorage.setItem(config.THEME_STORAGE_KEY, theme);

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
    return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
  };

  /**
   * Sets the theme on the <html> element.
   * @param {string} theme - The theme to set ('light', 'dark', 'auto').
   * @param {boolean} [triggeredByClick=false] - Flag to indicate if the change was triggered by a user click.
   */
  const setTheme = (theme, triggeredByClick = false) => {
    let effectiveTheme = theme;
    if (theme === "auto") {
      effectiveTheme = window.matchMedia("(prefers-color-scheme: light)").matches
        ? "light"
        : "dark";
    }

    document.documentElement.setAttribute("data-bs-theme", effectiveTheme);
    // console.log('Theme set to:', effectiveTheme, '(Chosen:', theme, ')');

    // --- Trigger Toast Notification on Click ---
    if (triggeredByClick && (theme === "light" || theme === "dark")) {
      showThemeToast(theme);
    }
  };

  /**
   * Shows the theme change toast notification.
   * @param {string} theme - The theme that was selected ('light' or 'dark').
   */
  const showThemeToast = (theme) => {
    const toastElement = document.getElementById("themeToast");
    if (!toastElement) {
      console.warn("Toast element #themeToast not found.");
      return;
    }

    const toastBody = toastElement.querySelector(".toast-body");
    if (!toastBody) {
      console.warn("Toast body not found in #themeToast.");
      return;
    }

    // Set the message based on the theme
    if (theme === "light") {
      toastBody.textContent = "Heretic! Your allegiance to the light mode shall not go unpunished!";
    } else if (theme === "dark") {
      toastBody.textContent = "Welcome to the dark mode, servant of the Emperor!";
    } else {
      return; // Don't show toast for 'auto' or other values
    }

    // Ensure Bootstrap object exists (it should if Bootstrap JS is loaded)
    if (typeof bootstrap !== "undefined" && bootstrap.Toast) {
      try {
        const toast = bootstrap.Toast.getOrCreateInstance(toastElement); // Use getOrCreateInstance
        toast.show();
      } catch (error) {
        console.error("Error showing Bootstrap toast:", error);
      }
    } else {
      console.warn("Bootstrap Toast component not found. Cannot display theme toast.");
    }
  };

  // --- Initial Theme Application ---
  // Apply theme immediately on script load (without triggering toast)
  setTheme(getPreferredTheme(), false);

  // --- Event Listeners (Run after DOM is ready) ---
  window.addEventListener("DOMContentLoaded", () => {
    // Add listeners for theme change buttons
    document.querySelectorAll("[data-bs-theme-value]").forEach((toggle) => {
      toggle.addEventListener("click", () => {
        const theme = toggle.getAttribute("data-bs-theme-value");
        if (theme === "auto") {
          localStorage.removeItem(config.THEME_STORAGE_KEY);
        } else {
          setStoredTheme(theme);
        }
        // Apply the theme AND indicate it was triggered by a click
        setTheme(theme, true);

        // Optional: Update active state/icon on the dropdown button itself
        const activeThemeIcon = document.querySelector(".theme-icon-active");
        const newIconClass = toggle.querySelector("i.bi")?.classList[1]; // Get icon class like bi-sun-fill
        if (activeThemeIcon && newIconClass) {
          // Simple update: replace the icon class - assumes structure like <i class="bi bi-icon theme-icon-active">
          activeThemeIcon.className = `bi ${newIconClass} theme-icon-active`;
        }
      });
    });

    // Add listener for OS preference changes
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
      const storedTheme = getStoredTheme();
      // Only update if no theme is explicitly stored (i.e., user wants 'auto')
      if (!storedTheme) {
        setTheme("auto", false); // OS change doesn't trigger toast
      }
    });
  });
})(); // Immediately Invoked Function Expression (IIFE)
