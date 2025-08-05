// storage.js
"use strict";

const h = window.helpers;

// --- Settings ---
function saveSettings(settings) {
  localStorage.setItem(h.STORAGE_KEY_SETTINGS, JSON.stringify(settings));
}
function loadSettings() {
  return JSON.parse(localStorage.getItem(h.STORAGE_KEY_SETTINGS) || JSON.stringify(h.DEFAULT_SETTINGS));
}

// --- Queue ---
function saveQueue(queue) {
  localStorage.setItem(h.STORAGE_KEY_QUEUE, JSON.stringify(queue));
}
function loadQueue() {
  return JSON.parse(localStorage.getItem(h.STORAGE_KEY_QUEUE) || "[]");
}

// --- Admin PIN ---
function getAdminPin() {
  let pin = localStorage.getItem(h.STORAGE_KEY_PIN) || h.DEFAULT_PIN;
  if (!localStorage.getItem(h.STORAGE_KEY_PIN)) localStorage.setItem(h.STORAGE_KEY_PIN, pin);
  return pin;
}
function setAdminPin(pin) {
  localStorage.setItem(h.STORAGE_KEY_PIN, pin);
}

// --- Admin Unlock (session) ---
function isAdminCurrentlyUnlocked() {
  return sessionStorage.getItem(h.ADMIN_UNLOCK_KEY) === "1";
}
function setAdminUnlocked() {
  sessionStorage.setItem(h.ADMIN_UNLOCK_KEY, "1");
}
function clearAdminUnlocked() {
  sessionStorage.removeItem(h.ADMIN_UNLOCK_KEY);
}

// --- Auth Token ---
function hasAuthToken() {
  return !!localStorage.getItem(h.AUTH_TOKEN_KEY);
}
function setAuthToken(t) {
  localStorage.setItem(h.AUTH_TOKEN_KEY, t);
}
function clearAuthToken() {
  localStorage.removeItem(h.AUTH_TOKEN_KEY);
}

// Export
window.storage = {
  saveSettings, loadSettings,
  saveQueue, loadQueue,
  getAdminPin, setAdminPin,
  isAdminCurrentlyUnlocked, setAdminUnlocked, clearAdminUnlocked,
  hasAuthToken, setAuthToken, clearAuthToken,
};
