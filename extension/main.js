// main.js
"use strict";

// Ensure all modules are loaded before bootstrapping UI
window.addEventListener("DOMContentLoaded", () => {
  // Initialize helpers, storage, queue, then UI
  if (window.helpers && window.queue && window.ui) {
    window.ui.initChainPanelUI();
  } else {
    // Wait for modules to be ready if loaded async (rare for basic Chrome extensions)
    const checkReady = setInterval(() => {
      if (window.helpers && window.queue && window.ui) {
        window.ui.initChainPanelUI();
        clearInterval(checkReady);
      }
    }, 50);
  }
});
