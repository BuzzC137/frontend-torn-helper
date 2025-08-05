// helpers.js
"use strict";

// --- Constants / keys ---
const STORAGE_KEY_USER = "chainDiscordUser";
const STORAGE_KEY_PIN = "chainAdminPin";
const STORAGE_KEY_SETTINGS = "chainSettings";
const STORAGE_KEY_QUEUE = "chainQueue";
const ADMIN_UNLOCK_KEY = "chainAdminUnlock";
const POSITION_KEY = "chainPanelPosition";
const AUTH_TOKEN_KEY = "chainAuthToken";
const DEFAULT_PIN = "2580";
const DEFAULT_SETTINGS = {
  volume: 0.5,
  sound: "beep",
  flashing: true,
  flashInterval: 500,
  alertThresholds: { "30": true, "60": true, "90": false, "120": false },
  alertCooldownMs: 5000,
};

const BONUS_THRESHOLDS = [
  25, 50, 100, 250, 500,
  1000, 2500, 5000, 10000,
  25000, 50000, 100000
];

// Returns the next bonus threshold strictly greater than currentChain.
function getNextBonus(chain) {
  for (const b of BONUS_THRESHOLDS) {
    if (b > chain) return b;
  }
  return null;
}

// Export for use in other files (if using modules), else attach to window/global
window.helpers = {
  STORAGE_KEY_USER,
  STORAGE_KEY_PIN,
  STORAGE_KEY_SETTINGS,
  STORAGE_KEY_QUEUE,
  ADMIN_UNLOCK_KEY,
  POSITION_KEY,
  AUTH_TOKEN_KEY,
  DEFAULT_PIN,
  DEFAULT_SETTINGS,
  BONUS_THRESHOLDS,
  getNextBonus,
};
