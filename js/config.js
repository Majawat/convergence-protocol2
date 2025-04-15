/**
 * @fileoverview Configuration constants for the OPR Army Tracker.
 */

// Main configuration settings
export const config = {
  // Storage Keys
  ARMY_BOOKS_CACHE_KEY: "oprArmyBooksCache",
  COMMON_RULES_CACHE_KEY_PREFIX: "oprCommonRulesCache_",
  ARMY_STATE_KEY_PREFIX: "oprArmyTracker_state_",
  GAME_STATE_KEY: "oprArmyTracker_gameState",
  THEME_STORAGE_KEY: "theme",
  DOCTRINES_CACHE_KEY: "oprDoctrinesCache",
  CAMPAIGN_POINTS_CACHE_KEY: "oprCampaignPointsCache",
  DEFINITIONS_CACHE_KEY: "oprDefinitionsCache",

  // Game Rules
  MAX_SPELL_TOKENS: 6,
  GAME_SYSTEM_ID: 2, // Assuming Grimdark Future = 2
  COMMAND_POINTS_PER_1000: 4,
  UNDERDOG_POINTS_PER_DELTA: 50,

  // API Endpoints & Data URLs
  CAMPAIGN_DATA_URL: "./data/campaign.json",
  DOCTRINES_DATA_URL: "./data/rules/doctrines.json",
  CUSTOM_DEFINITIONS_URL: "./data/rules/custom-definitions.json",
  ARMYFORGE_LIST_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/tts?id=",
  ARMYFORGE_BOOK_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/army-books/", // {factionId}?gameSystem={gameSystemId}
  ARMYFORGE_COMMON_RULES_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/rules/common/",
};

// Icons
export const UI_ICONS = {
  // Stats & Models
  quality: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Quality</title><path style="fill: #ad3e25" d="m8 0 1.669.864 1.858.282.842 1.68 1.337 1.32L13.4 6l.306 1.854-1.337 1.32-.842 1.68-1.858.282L8 12l-1.669-.864-1.858-.282-.842-1.68-1.337-1.32L2.6 6l-.306-1.854 1.337-1.32.842-1.68L6.331.864z"/><path style="fill: #f9ddb7" d="M4 11.794V16l4-1 4 1v-4.206l-2.018.306L8 13.126 6.018 12.1z"/></svg>`,
  defense: `<svg class="stat-icon lg-stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Defense</title><path style="fill: #005f83" d="M5.072.56C6.157.265 7.31 0 8 0s1.843.265 2.928.56c1.11.3 2.229.655 2.887.87a1.54 1.54 0 0 1 1.044 1.262c.596 4.477-.787 7.795-2.465 9.99a11.8 11.8 0 0 1-2.517 2.453 7 7 0 0 1-1.048.625c-.28.132-.581.24-.829.24s-.548-.108-.829-.24a7 7 0 0 1-1.048-.625 11.8 11.8 0 0 1-2.517-2.453C1.928 10.487.545 7.169 1.141 2.692A1.54 1.54 0 0 1 2.185 1.43 63 63 0 0 1 5.072.56"/></svg>`,
  tough: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Tough</title><path style="fill: #dc3545" d="M8 1.314C12.438-3.248 23.534 4.735 8 15-7.534 4.736 3.562-3.248 8 1.314"/></svg>`,
  hero: `<svg class="stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" fill="currentColor"><title>Hero/Model</title><path fill-rule="evenodd" d="M3 14s-1 0-1-1 1-4 6-4 6 3 6 4-1 1-1 1zm5-6a3 3 0 1 0 0-6 3 3 0 0 0 0 6"/></svg>`,
  base: `<i class="bi bi-circle-fill stat-icon" title="Base Size"></i>`,
  // Tokens & Points
  spellTokens: `<svg class="token-icon stat-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><title>Spell Tokens</title><path d="M7.657 6.247c.11-.33.576-.33.686 0l.645 1.937a2.89 2.89 0 0 0 1.829 1.828l1.936.645c.33.11.33.576 0 .686l-1.937.645a2.89 2.89 0 0 0-1.828 1.829l-.645 1.936a.361.361 0 0 1-.686 0l-.645-1.937a2.89 2.89 0 0 0-1.828-1.828l-1.937-.645a.361.361 0 0 1 0-.686l1.937-.645a2.89 2.89 0 0 0 1.828-1.828zM3.794 1.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387A1.73 1.73 0 0 0 4.58 5.48l-.386 1.161a.217.217 0 0 1-.412 0l-.387-1.162A1.73 1.73 0 0 0 2.806 4.22l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387A1.73 1.73 0 0 0 3.407 2.31zM10.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.16 1.16 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.16 1.16 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732z"/></svg>`,
  commandPoints: `<i class="bi bi-binoculars-fill" title="Command Points"></i>`,
  underdogPoints: `<i class="bi bi-shield-exclamation" title="Underdog Points"></i>`,
  // Action Icons
  actionHold: `<i class="bi bi-crosshair action-icon"></i>`,
  actionAdvance: `<i class="bi bi-bullseye action-icon"></i>`,
  actionRush: `<i class="bi bi-wind action-icon"></i>`,
  actionCharge: `<i class="bi bi-hammer action-icon"></i>`,
  // Other UI Icons
  woundApply: `<i class="bi bi-heartbreak"></i>`,
  woundReset: `<i class="bi bi-arrow-clockwise"></i>`,
  tokenAdd: `<i class="bi bi-plus"></i>`,
  tokenRemove: `<i class="bi bi-dash"></i>`,
  viewSpells: `<i class="bi bi-book"></i>`,
  castSpell: `<i class="bi bi-magic"></i>`,
  selectItem: `<i class="bi bi-chevron-right"></i>`,
  recover: `<i class="bi bi-bandaid"></i>`,
  stratagems: `<i class="bi bi-journal-bookmark-fill"></i>`,
};

// Static configuration for Action Buttons
export const ACTION_BUTTON_CONFIG = {
  Hold: {
    colorTheme: "info", // Bootstrap theme color name
    iconKey: "actionHold", // Key in UI_ICONS
    baseText: "Hold",
  },
  Advance: {
    colorTheme: "primary",
    iconKey: "actionAdvance",
    baseText: "Adv",
  },
  Rush: {
    colorTheme: "success",
    iconKey: "actionRush",
    baseText: "Rush",
  },
  Charge: {
    colorTheme: "danger",
    iconKey: "actionCharge",
    baseText: "Chg",
  },
};
