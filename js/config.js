/**
 * @fileoverview Configuration constants for the OPR Army Tracker.
 */

export const config = {
  // Storage Keys
  ARMY_BOOKS_CACHE_KEY: "oprArmyBooksCache",
  COMMON_RULES_CACHE_KEY_PREFIX: "oprCommonRulesCache_", // Append game system ID
  WOUND_STATE_KEY: "oprArmyTracker_woundState",
  COMPONENT_STATE_KEY: "oprArmyTracker_componentState",

  // Game Rules
  MAX_SPELL_TOKENS: 6,

  // API Endpoints (using relative paths or full URLs if needed)
  CAMPAIGN_DATA_URL: "./data/campaign.json",
  ARMYFORGE_LIST_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/tts?id=",
  ARMYFORGE_BOOK_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/army-books/", // Append {factionId}?gameSystem={gameSystemId}
  ARMYFORGE_COMMON_RULES_API_URL_BASE:
    "https://army-forge.onepagerules.com/api/rules/common/", // Append {gameSystemId}

  // Other settings
  DEFAULT_GAME_SYSTEM: 2, // Default to Grimdark Future if not specified
};
