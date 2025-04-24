//@ts-check
/**
 * @fileoverview Configuration constants for the OPR Army Tracker.
 */

// Main configuration settings
export const config = {
  // Storage Keys
  ARMY_BOOKS_DATA_PREFIX: "oprArmyBooksCache_",
  ARMY_BOOKS_TIMESTAMP_PREFIX: "oprArmyBooksTimestamp_",
  COMMON_RULES_CACHE_KEY_PREFIX: "oprCommonRulesCache_",
  ARMY_STATE_KEY_PREFIX: "oprArmyTracker_state_",
  GAME_STATE_KEY: "oprArmyTracker_gameState",
  THEME_STORAGE_KEY: "theme",
  DOCTRINES_CACHE_KEY: "oprDoctrinesCache",
  CAMPAIGN_POINTS_CACHE_KEY: "oprCampaignPointsCache",
  DEFINITIONS_CACHE_KEY: "oprDefinitionsCache",
  ARMY_LIST_DATA_PREFIX: "oprArmyData_",
  ARMY_LIST_TIMESTAMP_PREFIX: "oprArmyTimestamp_",

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
  defense: `<i class="bi bi-shield-fill stat-icon lg-stat-icon" style="color: #005f83;" aria-label="Defense icon"></i>`,
  tough: `<i class="bi bi-heart-fill stat-icon" style="color: #dc3545;" aria-label="Tough icon"></i>`,
  hero: `<i class="bi bi-person-fill stat-icon" style="color: currentColor;" aria-label="Model icon"></i>`,
  base: `<i class="bi bi-circle-fill stat-icon" title="Base Size" aria-label="Base size icon"></i>`,
  // Tokens & Points
  spellTokens: `<i class="bi bi-stars token-icon stat-icon" style="color: currentColor;" aria-label="Spell Tokens"></i>`,
  commandPoints: `<i class="bi bi-binoculars-fill" aria-label="Command Points icon"></i>`,
  underdogPoints: `<i class="bi bi-shield-exclamation" aria-label="Underdog Points icon"></i>`,
  // Action Icons
  actionHold: `<i class="bi bi-crosshair action-icon" aria-label="Hold action icon"></i>`,
  actionAdvance: `<i class="bi bi-bullseye action-icon" aria-label="Advance action icon"></i>`,
  actionRush: `<i class="bi bi-wind action-icon" aria-label="Rush action icon"></i>`,
  actionCharge: `<i class="bi bi-hammer action-icon" aria-label="Charge actionicon"></i>`,
  // Other UI Icons
  woundApply: `<i class="bi bi-heartbreak" aria-label="Apply wounds icon"></i>`,
  woundReset: `<i class="bi bi-arrow-clockwise" aria-label="Reset unit icon"></i>`,
  tokenAdd: `<i class="bi bi-plus" aria-label="Add token icon"></i>`,
  tokenRemove: `<i class="bi bi-dash" aria-label="Remove token icon"></i>`,
  viewSpells: `<i class="bi bi-book" aria-label="View Spells icon"></i>`,
  castSpell: `<i class="bi bi-magic" aria-label="Cast Spell icon"</i>`,
  selectItem: `<i class="bi bi-chevron-right" aria-label="Select Item icon"></i>`,
  recover: `<i class="bi bi-bandaid" aria-label="Recover icon"></i>`,
  stratagems: `<i class="bi bi-journal-bookmark-fill" aria-label="Stratagems icon"></i>`,
  killCount: `<i class="bi bi-person-x-fill" aria-label="Kills Recorded"></i>`,
  markRemoved: `<i class="bi bi-x-octagon" title="Mark Removed"></i>`,
};

// Static configuration for Action Buttons
export const ACTION_BUTTON_CONFIG = {
  Hold: {
    colorTheme: "info", // Bootstrap theme color name
    iconKey: "actionHold", // Key in UI_ICONS
    baseText: " Hold",
  },
  Advance: {
    colorTheme: "primary",
    iconKey: "actionAdvance",
    baseText: " Adv",
  },
  Rush: {
    colorTheme: "success",
    iconKey: "actionRush",
    baseText: " Rush",
  },
  Charge: {
    colorTheme: "danger",
    iconKey: "actionCharge",
    baseText: " Chg",
  },
};
