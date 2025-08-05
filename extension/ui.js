// ui.js
"use strict";

const h = window.helpers;
const q = window.queue;

// --- DOM Setup ---
function createChainPanel() {
  // Main panel
  const panel = document.createElement("div");
  panel.id = "chainPanel";
  panel.style.cssText = `
    position: fixed; top: 100px; left: 30px; width: 500px;
    background: rgba(24,24,24,0.95); color: #eee;
    font-family: Verdana,sans-serif; font-size: 13px;
    border: 1px solid #444; border-radius: 10px; z-index: 9999;
    box-shadow: 0 0 24px rgba(0,0,0,0.8); overflow: hidden;
    transition: all .2s;
  `;
  // Panel inner HTML
  panel.innerHTML = `
    <div id="dragHeader" style="display:flex;align-items:center;justify-content:space-between;background:#1f1f1f;padding:8px 12px;gap:8px;cursor:grab;">
      <div style="display:flex;gap:8px;align-items:center;flex:1;">
        <button id="topGetChain" style="background:#ff9800;padding:6px 14px;border:none;border-radius:5px;font-size:12px;font-weight:600;color:#fff;cursor:pointer;">Get My #</button>
        <span id="countdown" style="font-weight:700;color:#00ffff;margin-left:6px;">--:--</span>
      </div>
      <div style="display:flex;gap:10px;align-items:center;">
        <div class="toggle" style="cursor:pointer;font-size:12px;color:#0ff;user-select:none;">▲ Collapse</div>
      </div>
    </div>
    <div class="tab-bar" style="display:flex;background:#262626;gap:6px;padding:6px 8px;">
      <button class="tab" data-tab="settings" style="flex:1;background:#2f2f2f;border:none;border-radius:6px;padding:8px;cursor:pointer;color:#eee;font-weight:600;">Settings</button>
      <button class="tab" data-tab="alerts" style="flex:1;background:#2f2f2f;border:none;border-radius:6px;padding:8px;cursor:pointer;color:#eee;font-weight:600;">Alerts</button>
      <button class="tab" data-tab="yata" style="flex:1;background:#2f2f2f;border:none;border-radius:6px;padding:8px;cursor:pointer;color:#eee;font-weight:600;">YATA</button>
      <button class="tab" data-tab="admin" style="flex:1;background:#2f2f2f;border:none;border-radius:6px;padding:8px;cursor:pointer;color:#eee;font-weight:600;">Admin</button>
      <button class="tab" data-tab="discord" style="flex:1;background:#2f2f2f;border:none;border-radius:6px;padding:8px;cursor:pointer;color:#eee;font-weight:600;">Discord</button>
    </div>
    <div id="tab-content" style="padding:10px;background:#1f1f1f;min-height:260px;display:flex;gap:12px;"></div>
  `;
  document.body.appendChild(panel);

  // Style for scrollable queue
  if (!document.getElementById("queue-commander-scroll-style")) {
    const qStyle = document.createElement("style");
    qStyle.id = "queue-commander-scroll-style";
    qStyle.textContent = `
      #persistentQueue { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.3) transparent; }
      #persistentQueue::-webkit-scrollbar { width: 8px; }
      #persistentQueue::-webkit-scrollbar-track { background: transparent; }
      #persistentQueue::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.25); border-radius: 4px; }
    `;
    document.head.appendChild(qStyle);
  }
  return panel;
}

// --- Tab system, queue rendering, and events ---
// (Stub below, expand as you migrate logic)
function initChainPanelUI() {
  const panel = createChainPanel();
  // TODO: Restore position, make draggable, set up tab switching, event listeners, etc.
  // TODO: Hook up with queue, storage, helpers modules

  // Example: render the default tab
  // renderTab("settings");
}

// Export
window.ui = {
  createChainPanel,
  initChainPanelUI,
};
