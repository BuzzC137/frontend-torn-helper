(function () {
  "use strict";
  if (window._chainPanelInit) return;
  window._chainPanelInit = true;

  // --- Constants / keys ---
  const STORAGE_KEY_USER = "chainDiscordUser";
  const STORAGE_KEY_PIN = "chainAdminPin";
  const STORAGE_KEY_SETTINGS = "chainSettings";
  const STORAGE_KEY_QUEUE = "chainQueue";
  const ADMIN_UNLOCK_KEY = "chainAdminUnlock";
  const POSITION_KEY = "chainPanelPosition";
  const AUTH_TOKEN_KEY = "chainAuthToken"; // simple gate token (presence check)
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

  // --- State ---
  let delaySeconds = 10;
  let timerInterval = null;
  let currentChainNumber = null; // latest known chain number
  let discordUsername = localStorage.getItem(STORAGE_KEY_USER) || "";
  let adminPin = localStorage.getItem(STORAGE_KEY_PIN) || DEFAULT_PIN;
  if (!localStorage.getItem(STORAGE_KEY_PIN)) localStorage.setItem(STORAGE_KEY_PIN, adminPin);
  let settings = JSON.parse(localStorage.getItem(STORAGE_KEY_SETTINGS) || JSON.stringify(DEFAULT_SETTINGS));
  let queue = JSON.parse(localStorage.getItem(STORAGE_KEY_QUEUE) || "[]");
  let lastAlertedThreshold = null;
  let alertTimestamps = {};
  const originalTitle = document.title;
  let collapsed = false; // collapse state

  // --- Helpers ---
  function saveSettings() {
    localStorage.setItem(STORAGE_KEY_SETTINGS, JSON.stringify(settings));
  }
  function saveQueue() {
    localStorage.setItem(STORAGE_KEY_QUEUE, JSON.stringify(queue));
  }

  function isAdminCurrentlyUnlocked() {
    return sessionStorage.getItem(ADMIN_UNLOCK_KEY) === "1";
  }
  function setAdminUnlocked() {
    sessionStorage.setItem(ADMIN_UNLOCK_KEY, "1");
  }
  function clearAdminUnlocked() {
    sessionStorage.removeItem(ADMIN_UNLOCK_KEY);
  }

  function hasAuthToken() {
    return !!localStorage.getItem(AUTH_TOKEN_KEY);
  }
  function setAuthToken(t) {
    localStorage.setItem(AUTH_TOKEN_KEY, t);
  }
  function clearAuthToken() {
    localStorage.removeItem(AUTH_TOKEN_KEY);
  }

  function setTabBadge(active) {
    if (active) {
      if (!document.title.startsWith("! ")) document.title = "! " + originalTitle;
    } else {
      document.title = originalTitle;
    }
  }

  function playAlertSound() {
    const vol = Math.min(Math.max(settings.volume, 0), 1);
    const src = settings.sound === "chirp"
      ? "https://www.soundjay.com/buttons/sounds/button-3.mp3"
      : "https://www.soundjay.com/button/sounds/beep-07.mp3";
    const audio = new Audio(src);
    audio.volume = vol;
    audio.play();
  }

  function flashSequence() {
    if (!settings.flashing) return;
    const colors = ["#fffa65", "#65fffa", "#fa65ff", "#ff6565"];
    let i = 0;
    const orig = panel?.style?.boxShadow || "";
    const interval = setInterval(() => {
      if (panel) panel.style.boxShadow = `0 0 20px ${colors[i % colors.length]}`;
      i++;
    }, 100);
    setTimeout(() => {
      clearInterval(interval);
      if (panel) panel.style.boxShadow = orig;
    }, settings.flashInterval);
  }

  function refreshOnExternalHit(newChain) {
    currentChainNumber = newChain;
    const display = document.getElementById("currentChainDisplay");
    if (display) display.textContent = newChain;
    const activeTab = document.querySelector('.tab[style*="#3f8fff"]');
    if (activeTab && activeTab.dataset.tab === "admin") {
      renderTab("admin");
    }
  }

  // YATA fetch helper
  async function fetchFactionMembersFromYata(tornApiKey) {
    if (!tornApiKey) throw new Error("Torn API key missing");
    const url = `https://yata.yt/api/v1/faction/members/?key=${encodeURIComponent(tornApiKey)}`;
    const resp = await fetch(url);
    if (!resp.ok) {
      const text = await resp.text();
      throw new Error(`Yata fetch failed: ${resp.status} ${text}`);
    }
    const data = await resp.json();
    console.log("Raw YATA faction members response:", data);

    if (!data || typeof data.members !== "object") {
      throw new Error("Unexpected Yata response structure");
    }

    return Object.values(data.members).map((member) => {
      if (typeof member.name !== "string" || typeof member.status !== "string") {
        console.warn("Member missing name/status:", member);
      }
      return {
        torn_id: member.id,
        torn_name: typeof member.name === "string" ? member.name : "unknown",
        status: typeof member.status === "string" ? member.status : "unknown",
        last_action: member.last_action,
        days_in_faction: member.dif,
        crimes_rank: member.crimes_rank,
        bonus_score: member.bonus_score,
        nnb_share: member.nnb_share,
        nnb: member.nnb,
        energy_share: member.energy_share,
        energy: member.energy,
        refill: member.refill,
        drug_cd: member.drug_cd,
        revive: member.revive,
        carnage: member.carnage,
        stats_share: member.stats_share,
        stats_dexterity: member.stats_dexterity,
        stats_defense: member.stats_defense,
        stats_speed: member.stats_speed,
        stats_strength: member.stats_strength,
        stats_total: member.stats_total,
        raw: member,
      };
    });
  }

  // --- Build UI ---
  const panel = document.createElement("div");
  panel.id = "chainPanel";
  panel.style.cssText = `
    position: fixed;
    top: 100px;
    left: 30px;
    width: 500px;
    background: rgba(24,24,24,0.95);
    color: #eee;
    font-family: Verdana, sans-serif;
    font-size: 13px;
    border: 1px solid #444;
    border-radius: 10px;
    z-index: 9999;
    box-shadow: 0 0 24px rgba(0,0,0,0.8);
    overflow: hidden;
    transition: all .2s ease;
  `;
  panel.innerHTML = `
    <div id="dragHeader" style="display:flex; align-items:center; justify-content:space-between; background:#1f1f1f; padding:8px 12px; gap:8px; cursor:grab;">
      <div style="display:flex; gap:8px; align-items:center; flex:1;">
        <button id="topGetChain" style="background:#ff9800; padding:6px 14px; border:none; border-radius:5px; font-size:12px; font-weight:600; color:#fff; cursor:pointer;">Get My #</button>
        <span id="countdown" style="font-weight:700; color:#00ffff; margin-left:6px;">--:--</span>
      </div>
      <div style="display:flex; gap:10px; align-items:center;">
        <div class="toggle" style="cursor:pointer; font-size:12px; color:#0ff; user-select:none;">▲ Collapse</div>
      </div>
    </div>
    <div class="tab-bar" style="display:flex; background:#262626; gap:6px; padding:6px 8px;">
      <button class="tab" data-tab="settings" style="flex:1; background:#2f2f2f; border:none; border-radius:6px; padding:8px; cursor:pointer; color:#eee; font-weight:600;">Settings</button>
      <button class="tab" data-tab="alerts" style="flex:1; background:#2f2f2f; border:none; border-radius:6px; padding:8px; cursor:pointer; color:#eee; font-weight:600;">Alerts</button>
      <button class="tab" data-tab="yata" style="flex:1; background:#2f2f2f; border:none; border-radius:6px; padding:8px; cursor:pointer; color:#eee; font-weight:600;">YATA</button>
      <button class="tab" data-tab="admin" style="flex:1; background:#2f2f2f; border:none; border-radius:6px; padding:8px; cursor:pointer; color:#eee; font-weight:600;">Admin</button>
      <button class="tab" data-tab="discord" style="flex:1; background:#2f2f2f; border:none; border-radius:6px; padding:8px; cursor:pointer; color:#eee; font-weight:600;">discord</button>
    </div>
    <div id="tab-content" style="padding:10px; background:#1f1f1f; min-height:260px; display:flex; gap:12px;"></div>
  `;
  document.body.appendChild(panel);

  // scrollable queue styling (once)
  if (!document.getElementById("queue-commander-scroll-style")) {
    const qStyle = document.createElement("style");
    qStyle.id = "queue-commander-scroll-style";
    qStyle.textContent = `
      #persistentQueue {
        scrollbar-width: thin;
        scrollbar-color: rgba(255,255,255,0.3) transparent;
      }
      #persistentQueue::-webkit-scrollbar {
        width: 8px;
      }
      #persistentQueue::-webkit-scrollbar-track {
        background: transparent;
      }
      #persistentQueue::-webkit-scrollbar-thumb {
        background: rgba(255,255,255,0.25);
        border-radius: 4px;
      }
    `;
    document.head.appendChild(qStyle);
  }

  // restore panel position
  try {
    const stored = JSON.parse(localStorage.getItem(POSITION_KEY) || "{}");
    if (stored.top) panel.style.top = stored.top;
    if (stored.left) panel.style.left = stored.left;
  } catch {}

  // key element refs
  const tabContent = panel.querySelector("#tab-content");
  const tabs = panel.querySelectorAll(".tab");
  const toggle = panel.querySelector(".toggle");
  const countdownEl = panel.querySelector("#countdown");
  const topGetChainBtn = panel.querySelector("#topGetChain");
  const dragHeader = panel.querySelector("#dragHeader");

  // Dragging
  let isDragging = false;
  let dragOffsetX = 0;
  let dragOffsetY = 0;
  dragHeader.addEventListener("mousedown", (e) => {
    isDragging = true;
    dragHeader.style.cursor = "grabbing";
    const rect = panel.getBoundingClientRect();
    dragOffsetX = e.clientX - rect.left;
    dragOffsetY = e.clientY - rect.top;
    document.body.style.userSelect = "none";
  });
  window.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    panel.style.left = e.clientX - dragOffsetX + "px";
    panel.style.top = e.clientY - dragOffsetY + "px";
  });
  window.addEventListener("mouseup", () => {
    if (isDragging) {
      isDragging = false;
      dragHeader.style.cursor = "grab";
      document.body.style.userSelect = "";
      localStorage.setItem(POSITION_KEY, JSON.stringify({ top: panel.style.top, left: panel.style.left }));
    }
  });

  // Tab logic
  function setActiveTab(clicked) {
    tabs.forEach((t) => {
      if (t === clicked) {
        t.style.background = "#3f8fff";
        t.style.color = "#fff";
      } else {
        t.style.background = "#2f2f2f";
        t.style.color = "#eee";
      }
    });
  }
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      setActiveTab(tab);
      renderTab(tab.dataset.tab);
    });
  });

  // Collapse / expand (vertical when collapsed) with wider collapsed pill so timer isn't clipped
toggle.addEventListener("click", () => {
  collapsed = !collapsed;
  if (collapsed) {
    // collapsed: taller/narrower but wide enough to show timer
    panel.style.width = "100px";
    panel.style.height = "auto";
    panel.style.padding = "6px 8px";
    panel.style.transition = "width .2s, height .2s";
    // stack header items
    dragHeader.style.flexDirection = "column";
    dragHeader.style.alignItems = "stretch";
    dragHeader.style.gap = "6px";
    // shrink main button
    topGetChainBtn.style.padding = "4px 6px";
    topGetChainBtn.textContent = "Get #";
    // countdown prominent
    countdownEl.style.display = "block";
    countdownEl.style.whiteSpace = "nowrap";
    countdownEl.style.overflow = "visible";
    countdownEl.style.fontSize = "14px";
    countdownEl.style.fontWeight = "700";
    countdownEl.style.color = "#00ffff";
    countdownEl.style.background = "rgba(0,0,0,0.6)";
    countdownEl.style.padding = "2px 6px";
    countdownEl.style.borderRadius = "4px";
    countdownEl.style.marginTop = "4px";
    countdownEl.style.alignSelf = "flex-start";
    // hide full tabs/content
    document.querySelector(".tab-bar").style.display = "none";
    tabContent.style.display = "none";
    // toggle appearance
    toggle.innerText = "▶";
    toggle.style.alignSelf = "center";
  } else {
    // expanded: restore original
    panel.style.width = "500px";
    panel.style.height = "";
    panel.style.padding = "";
    dragHeader.style.flexDirection = "row";
    dragHeader.style.alignItems = "center";
    dragHeader.style.gap = "8px";
    topGetChainBtn.style.padding = "6px 14px";
    topGetChainBtn.textContent = "Get My #";
    // restore countdown styling
    countdownEl.style.display = "";
    countdownEl.style.whiteSpace = "";
    countdownEl.style.overflow = "";
    countdownEl.style.fontSize = "";
    countdownEl.style.fontWeight = "";
    countdownEl.style.color = "";
    countdownEl.style.background = "";
    countdownEl.style.padding = "";
    countdownEl.style.borderRadius = "";
    countdownEl.style.marginTop = "";
    countdownEl.style.alignSelf = "";
    document.querySelector(".tab-bar").style.display = "flex";
    tabContent.style.display = "flex";
    toggle.innerText = "▲ Collapse";
    toggle.style.alignSelf = "";
  }
});



  // --- Queue rendering helper ---
  function refreshQueueUI() {
    const queueListEl = panel.querySelector("#queueList");
    if (!queueListEl) return;
    queueListEl.textContent = "";
    queue.forEach((entry, idx) => {
      const item = document.createElement("div");
      item.setAttribute("data-idx", idx);
      item.style = "display:flex; gap:8px; align-items:center; background:#222; padding:6px; border-radius:4px;";

      const info = document.createElement("div");
      info.style.flex = "1";
      const strong = document.createElement("strong");
      strong.textContent = entry.user;
      info.appendChild(strong);
      const assigned = document.createElement("span");
      assigned.textContent = ` (#${entry.assignedNumber ?? "-"}${entry.status ? ` · ${entry.status}` : ""})`;
      info.appendChild(assigned);

      const controls = document.createElement("div");
      controls.style.display = "flex";
      controls.style.gap = "4px";

      const upBtn = document.createElement("button");
      upBtn.textContent = "↑";
      upBtn.disabled = idx === 0;
      upBtn.style.padding = "4px 6px";
      upBtn.title = "Move up";
      upBtn.addEventListener("click", () => {
        if (idx === 0) return;
        [queue[idx - 1], queue[idx]] = [queue[idx], queue[idx - 1]];
        saveQueue();
        refreshQueueUI();
      });

      const downBtn = document.createElement("button");
      downBtn.textContent = "↓";
      downBtn.disabled = idx === queue.length - 1;
      downBtn.style.padding = "4px 6px";
      downBtn.title = "Move down";
      downBtn.addEventListener("click", () => {
        if (idx === queue.length - 1) return;
        [queue[idx + 1], queue[idx]] = [queue[idx], queue[idx + 1]];
        saveQueue();
        refreshQueueUI();
      });

      const assignBtn = document.createElement("button");
      assignBtn.textContent = "Assign #";
      assignBtn.style.padding = "4px 8px";
      assignBtn.addEventListener("click", () => {
        const newNum = prompt("Set chain number for " + entry.user + ":", entry.assignedNumber ?? "");
        if (newNum !== null) {
          const parsed = parseInt(newNum);
          if (!isNaN(parsed)) {
            entry.assignedNumber = parsed;
            saveQueue();
            refreshQueueUI();
          }
        }
      });

      const kickBtn = document.createElement("button");
      kickBtn.textContent = "Kick";
      kickBtn.style.padding = "4px 8px";
      kickBtn.style.background = "#c0392b";
      kickBtn.style.color = "#fff";
      kickBtn.addEventListener("click", () => {
        queue.splice(idx, 1);
        saveQueue();
        refreshQueueUI();
      });

      controls.appendChild(upBtn);
      controls.appendChild(downBtn);
      controls.appendChild(assignBtn);
      controls.appendChild(kickBtn);

      item.appendChild(info);
      item.appendChild(controls);
      queueListEl.appendChild(item);
    });
  }

  // --- Tab rendering ---
  function renderTab(name) {
    // Early gate: require auth token to proceed beyond license acknowledgment
    if (!localStorage.getItem("chainPanelEulaAccepted")) {
      showEulaOverlay();
      return;
    }
    if (!hasAuthToken()) {
      tabContent.textContent = "";
      const container = document.createElement("div");
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "12px";
      container.style.width = "100%";
      const info = document.createElement("div");
      info.textContent = "Authorization token required to use the panel. Enter your token below.";
      const input = document.createElement("input");
      input.placeholder = "Auth token";
      input.style.padding = "6px";
      input.style.borderRadius = "4px";
      input.style.background = "#1f1f1f";
      input.style.border = "1px solid #555";
      input.style.color = "#eee";
      const btn = document.createElement("button");
      btn.textContent = "Set Token";
      btn.style.padding = "6px 12px";
      btn.style.border = "none";
      btn.style.borderRadius = "5px";
      btn.style.background = "#28a745";
      btn.style.color = "#fff";
      btn.addEventListener("click", () => {
        const v = input.value.trim();
        if (!v) return alert("Token empty");
        setAuthToken(v);
        renderTab(name);
      });
      container.appendChild(info);
      container.appendChild(input);
      container.appendChild(btn);
      tabContent.innerHTML = "";
      tabContent.appendChild(container);
      return;
    }

    // Normal tab rendering
    switch (name) {
      case "settings": {
        tabContent.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "12px";
        wrapper.style.width = "100%";

        // Volume
        const volContainer = document.createElement("div");
        volContainer.style.flex = "1";
        volContainer.style.minWidth = "160px";
        const volLabel = document.createElement("div");
        volLabel.textContent = "Volume";
        const volInput = document.createElement("input");
        volInput.type = "range";
        volInput.min = "0";
        volInput.max = "1";
        volInput.step = "0.01";
        volInput.value = settings.volume;
        volInput.addEventListener("input", (e) => {
          settings.volume = parseFloat(e.target.value);
          saveSettings();
        });
        volContainer.appendChild(volLabel);
        volContainer.appendChild(volInput);

        // Sound
        const soundContainer = document.createElement("div");
        soundContainer.style.flex = "1";
        soundContainer.style.minWidth = "160px";
        const soundLabel = document.createElement("div");
        soundLabel.textContent = "Sound";
        const soundSelect = document.createElement("select");
        soundSelect.style.width = "100%";
        soundSelect.style.padding = "6px";
        soundSelect.style.borderRadius = "4px";
        soundSelect.style.background = "#1f1f1f";
        soundSelect.style.color = "#eee";
        soundSelect.style.border = "1px solid #555";
        const optBeep = document.createElement("option");
        optBeep.value = "beep";
        optBeep.textContent = "Beep";
        const optChirp = document.createElement("option");
        optChirp.value = "chirp";
        optChirp.textContent = "Chirp";
        soundSelect.appendChild(optBeep);
        soundSelect.appendChild(optChirp);
        soundSelect.value = settings.sound;
        soundSelect.addEventListener("change", (e) => {
          settings.sound = e.target.value;
          saveSettings();
        });
        soundContainer.appendChild(soundLabel);
        soundContainer.appendChild(soundSelect);

        // Flashing
        const flashRow = document.createElement("div");
        flashRow.style.display = "flex";
        flashRow.style.gap = "10px";
        flashRow.style.flexWrap = "wrap";
        const flashToggleLabel = document.createElement("label");
        flashToggleLabel.style.display = "flex";
        flashToggleLabel.style.gap = "6px";
        flashToggleLabel.style.alignItems = "center";
        flashToggleLabel.style.fontSize = "12px";
        const flashCheckbox = document.createElement("input");
        flashCheckbox.type = "checkbox";
        flashCheckbox.checked = settings.flashing;
        flashCheckbox.addEventListener("change", (e) => {
          settings.flashing = e.target.checked;
          saveSettings();
        });
        flashToggleLabel.appendChild(flashCheckbox);
        flashToggleLabel.appendChild(document.createTextNode("Flashing lights"));

        const intervalDiv = document.createElement("div");
        const intervalLabel = document.createElement("label");
        intervalLabel.style.fontSize = "12px";
        intervalLabel.textContent = "Interval (ms): ";
        const intervalInput = document.createElement("input");
        intervalInput.type = "number";
        intervalInput.min = "100";
        intervalInput.step = "50";
        intervalInput.value = settings.flashInterval;
        intervalInput.style.width = "100px";
        intervalInput.style.marginLeft = "4px";
        intervalInput.style.padding = "4px";
        intervalInput.style.borderRadius = "4px";
        intervalInput.style.background = "#1f1f1f";
        intervalInput.style.color = "#eee";
        intervalInput.style.border = "1px solid #555";
        intervalInput.addEventListener("input", (e) => {
          settings.flashInterval = Math.max(100, parseInt(e.target.value) || 100);
          saveSettings();
        });
        intervalLabel.appendChild(intervalInput);
        intervalDiv.appendChild(intervalLabel);

        wrapper.appendChild(volContainer);
        wrapper.appendChild(soundContainer);
        wrapper.appendChild(flashToggleLabel);
        wrapper.appendChild(intervalDiv);
        tabContent.appendChild(wrapper);
        break;
      }

      case "alerts": {
        tabContent.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "12px";
        wrapper.style.width = "100%";

        const title = document.createElement("div");
        title.style.fontWeight = "600";
        title.textContent = "Alert thresholds (when countdown drops below):";
        wrapper.appendChild(title);

        const checks = document.createElement("div");
        checks.style.display = "flex";
        checks.style.gap = "8px";
        checks.style.flexWrap = "wrap";
        [30, 60, 90, 120].forEach((t) => {
          const label = document.createElement("label");
          label.style.display = "flex";
          label.style.gap = "4px";
          label.style.alignItems = "center";
          const cb = document.createElement("input");
          cb.type = "checkbox";
          cb.dataset.thresh = t.toString();
          cb.checked = !!settings.alertThresholds[t];
          cb.addEventListener("change", (e) => {
            settings.alertThresholds[t] = e.target.checked;
            saveSettings();
          });
          label.appendChild(cb);
          const text = document.createTextNode(t / 60 >= 1 ? t / 60 + "m" : t + "s");
          label.appendChild(text);
          checks.appendChild(label);
        });
        wrapper.appendChild(checks);

        const subtitle = document.createElement("div");
        subtitle.style.fontSize = "12px";
        subtitle.style.color = "#aaa";
        subtitle.textContent = `When the countdown goes below a selected value, you’ll get a sound + badge. Cooldown per threshold: ${settings.alertCooldownMs / 1000}s.`;
        wrapper.appendChild(subtitle);

        tabContent.appendChild(wrapper);
        break;
      }

      case "yata": {
        tabContent.innerHTML = "";
        const container = document.createElement("div");
        container.style.display = "flex";
        container.style.gap = "14px";
        container.style.width = "100%";

        const left = document.createElement("div");
        left.style.flex = "1";
        left.style.minWidth = "220px";
        left.style.display = "flex";
        left.style.flexDirection = "column";
        left.style.gap = "8px";

        const importedTitle = document.createElement("div");
        importedTitle.style.fontWeight = "600";
        importedTitle.textContent = "Imported Members";
        left.appendChild(importedTitle);

        const memberContainer = document.createElement("div");
        memberContainer.style.display = "flex";
        memberContainer.style.gap = "8px";

        const memberSelect = document.createElement("select");
        memberSelect.id = "yataMemberSelect";
        memberSelect.size = 10;
        memberSelect.style.flex = "1";
        memberSelect.style.padding = "6px";
        memberSelect.style.borderRadius = "4px";
        memberSelect.style.background = "#1f1f1f";
        memberSelect.style.color = "#eee";
        memberSelect.style.border = "1px solid #555";
        memberSelect.style.minWidth = "160px";
        memberSelect.style.overflow = "auto";

        const memberDetails = document.createElement("div");
        memberDetails.id = "memberDetails";
        memberDetails.style.flex = "2";
        memberDetails.style.background = "#222";
        memberDetails.style.padding = "8px";
        memberDetails.style.borderRadius = "6px";
        memberDetails.style.overflow = "auto";
        memberDetails.style.fontSize = "12px";
        memberDetails.style.maxHeight = "400px";
        memberDetails.textContent = "Select a member to see details.";

        memberContainer.appendChild(memberSelect);
        memberContainer.appendChild(memberDetails);
        left.appendChild(memberContainer);

        const statusEl = document.createElement("div");
        statusEl.id = "yataStatus";
        statusEl.style.fontSize = "12px";
        statusEl.style.color = "#ccc";
        statusEl.textContent = "Loaded data will appear above.";
        left.appendChild(statusEl);

        const keySection = document.createElement("div");
        keySection.style.marginTop = "6px";
        keySection.style.fontSize = "11px";
        keySection.style.color = "#aaa";
        const keyInfo = document.createElement("div");
        keyInfo.textContent = "Provide your Torn API key below (used with YATA). Data is pulled from YATA's faction member export.";
        keySection.appendChild(keyInfo);

        const keyControls = document.createElement("div");
        keyControls.style.display = "flex";
        keyControls.style.gap = "8px";
        keyControls.style.marginTop = "4px";

        const tornApiKeyInput = document.createElement("input");
        tornApiKeyInput.id = "tornApiKeyInput";
        tornApiKeyInput.type = "password";
        tornApiKeyInput.placeholder = "Your Torn API key";
        tornApiKeyInput.style.flex = "1";
        tornApiKeyInput.style.padding = "6px";
        tornApiKeyInput.style.borderRadius = "4px";
        tornApiKeyInput.style.border = "1px solid #555";
        tornApiKeyInput.style.background = "#1f1f1f";
        tornApiKeyInput.style.color = "#eee";
        const loadYataBtn = document.createElement("button");
        loadYataBtn.id = "loadYataBtn";
        loadYataBtn.textContent = "Load Members";
        loadYataBtn.style.padding = "6px 12px";
        loadYataBtn.style.border = "none";
        loadYataBtn.style.borderRadius = "5px";
        loadYataBtn.style.background = "#5a9cff";
        loadYataBtn.style.color = "#fff";
        loadYataBtn.style.cursor = "pointer";

        const clearKeyBtn = document.createElement("button");
        clearKeyBtn.id = "clearKeyBtn";
        clearKeyBtn.textContent = "Clear Key";
        clearKeyBtn.style.padding = "6px 12px";
        clearKeyBtn.style.border = "none";
        clearKeyBtn.style.borderRadius = "5px";
        clearKeyBtn.style.background = "#666";
        clearKeyBtn.style.color = "#fff";
        clearKeyBtn.style.cursor = "pointer";

        keyControls.appendChild(tornApiKeyInput);
        keyControls.appendChild(loadYataBtn);
        keyControls.appendChild(clearKeyBtn);

        const nsInfo = document.createElement("div");
        nsInfo.textContent = "Stored per Torn username; change Discord tab to namespace.";

        left.appendChild(keySection);
        left.appendChild(keyControls);
        left.appendChild(nsInfo);

        container.appendChild(left);
        tabContent.appendChild(container);

        // Load persisted key if any
        const storageName = `yata_torn_api_key_${(discordUsername || "anon").replace(/\s+/g, "_").toLowerCase()}`;
        const persistedKey = sessionStorage.getItem(storageName) || "";
        if (persistedKey) {
          tornApiKeyInput.value = persistedKey;
        }

        function renderMemberDetails(m) {
          memberDetails.textContent = ""; // clear
          const fields = [
            ["Name", m.torn_name],
            ["Status", m.status],
            ["Torn ID", m.torn_id],
            ["Last Action", new Date(m.last_action * 1000).toLocaleString()],
            ["Days in Faction", m.days_in_faction],
            ["Crimes Rank", m.crimes_rank],
            ["Bonus Score", m.bonus_score],
            ["NNB Share", `${m.nnb_share} (${m.nnb ?? "n/a"})`],
            ["Energy Share", `${m.energy_share} (${m.energy ?? "n/a"})`],
            ["Refill Available", m.refill],
            ["Drug CD", m.drug_cd],
            ["Revive", m.revive],
            ["Carnage", m.carnage],
            ["Stats Share", m.stats_share],
            ["Dexterity", m.stats_dexterity],
            ["Defense", m.stats_defense],
            ["Speed", m.stats_speed],
            ["Strength", m.stats_strength],
            ["Total", m.stats_total],
          ];
          fields.forEach(([label, val]) => {
            const row = document.createElement("div");
            const strong = document.createElement("strong");
            strong.textContent = `${label}: `;
            const span = document.createElement("span");
            span.textContent = val;
            row.appendChild(strong);
            row.appendChild(span);
            memberDetails.appendChild(row);
          });
        }

        loadYataBtn.addEventListener("click", async () => {
          const key = tornApiKeyInput.value.trim();
          if (!key) {
            alert("Enter your Torn API key.");
            return;
          }
          sessionStorage.setItem(storageName, key);
          statusEl.textContent = "Loading members from YATA...";
          try {
            const loadedMembers = await fetchFactionMembersFromYata(key);
            if (!Array.isArray(loadedMembers) || loadedMembers.length === 0) {
              statusEl.textContent = "No members returned.";
              return;
            }
            // Populate select
            memberSelect.textContent = "";
            loadedMembers.forEach((m) => {
              const opt = document.createElement("option");
              opt.value = m.torn_name;
              opt.textContent = `${m.torn_name} (${m.status})`;
              memberSelect.appendChild(opt);
            });
            panel._loadedYataMembers = loadedMembers;
            statusEl.textContent = `Loaded ${loadedMembers.length} members.`;
            memberSelect.addEventListener("change", () => {
              const sel = memberSelect.value;
              const member = (panel._loadedYataMembers || []).find((x) => x.torn_name === sel);
              if (member) renderMemberDetails(member);
            });
            // auto-select first
            if (loadedMembers[0]) {
              memberSelect.value = loadedMembers[0].torn_name;
              renderMemberDetails(loadedMembers[0]);
            }
          } catch (e) {
            console.error("Failed to load faction members from YATA:", e);
            statusEl.textContent = "Failed to load: " + (e.message || e);
          }
        });

        clearKeyBtn.addEventListener("click", () => {
          sessionStorage.removeItem(storageName);
          tornApiKeyInput.value = "";
          memberSelect.textContent = "";
          memberDetails.textContent = "Select a member to see details.";
          statusEl.textContent = "Cleared key. Enter a new Torn API key to load.";
          panel._loadedYataMembers = [];
        });
        break;
      }

      case "admin": {
  tabContent.innerHTML = "";

  // PIN gate
  if (!isAdminCurrentlyUnlocked()) {
    const promptWrapper = document.createElement("div");
    promptWrapper.style.display = "flex";
    promptWrapper.style.flexDirection = "column";
    promptWrapper.style.gap = "10px";
    promptWrapper.style.width = "100%";

    const promptText = document.createElement("div");
    promptText.textContent = "Enter 4-digit Admin PIN to unlock:";

    const row = document.createElement("div");
    row.style.display = "flex";
    row.style.gap = "6px";

    const pinInput = document.createElement("input");
    pinInput.type = "password";
    pinInput.maxLength = 4;
    pinInput.placeholder = "PIN";
    pinInput.style.width = "80px";
    pinInput.style.padding = "6px";
    pinInput.style.borderRadius = "4px";
    pinInput.style.border = "1px solid #555";
    pinInput.style.background = "#1f1f1f";
    pinInput.style.color = "#eee";

    const unlockBtn = document.createElement("button");
    unlockBtn.textContent = "Unlock";
    unlockBtn.style.padding = "6px 12px";
    unlockBtn.style.border = "none";
    unlockBtn.style.borderRadius = "5px";
    unlockBtn.style.background = "#ffc107";
    unlockBtn.style.cursor = "pointer";

    const info = document.createElement("div");
    info.style.fontSize = "11px";
    info.style.color = "#aaa";
    info.textContent = `Default PIN: ${adminPin}`;

    row.appendChild(pinInput);
    row.appendChild(unlockBtn);
    promptWrapper.appendChild(promptText);
    promptWrapper.appendChild(row);
    promptWrapper.appendChild(info);
    tabContent.appendChild(promptWrapper);

    unlockBtn.addEventListener("click", () => {
      if (pinInput.value.trim() === adminPin) {
        setAdminUnlocked();
        renderTab("admin");
      } else {
        alert("Wrong PIN");
      }
    });
    break; // locked, don't render the rest
  }

  // Unlocked view
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.gap = "14px";
  container.style.width = "100%";
  container.style.maxWidth = "900px";

  // Top controls: delay, start, lock
  const topRow = document.createElement("div");
  topRow.style.display = "flex";
  topRow.style.gap = "10px";
  topRow.style.flexWrap = "wrap";
  topRow.style.alignItems = "center";

  const delayLabel = document.createElement("label");
  delayLabel.style.display = "flex";
  delayLabel.style.gap = "6px";
  delayLabel.style.alignItems = "center";
  delayLabel.textContent = "Delay (0–30s):";

  const delayInput = document.createElement("input");
  delayInput.type = "number";
  delayInput.value = delaySeconds;
  delayInput.min = 0;
  delayInput.max = 30;
  delayInput.style.width = "70px";
  delayInput.style.marginLeft = "4px";
  delayInput.style.padding = "6px";
  delayInput.style.borderRadius = "4px";
  delayInput.style.background = "#1f1f1f";
  delayInput.style.color = "#eee";
  delayInput.style.border = "1px solid #555";
  delayLabel.appendChild(delayInput);

  const startBtn = document.createElement("button");
  startBtn.textContent = "Start Timer";
  startBtn.style.padding = "6px 14px";
  startBtn.style.border = "none";
  startBtn.style.borderRadius = "5px";
  startBtn.style.background = "#0069d9";
  startBtn.style.color = "#fff";
  startBtn.style.cursor = "pointer";

  const lockBtn = document.createElement("button");
  lockBtn.textContent = "Lock";
  lockBtn.style.padding = "6px 14px";
  lockBtn.style.border = "none";
  lockBtn.style.borderRadius = "5px";
  lockBtn.style.background = "#dc3545";
  lockBtn.style.color = "#fff";
  lockBtn.style.cursor = "pointer";

  topRow.appendChild(delayLabel);
  topRow.appendChild(startBtn);
  topRow.appendChild(lockBtn);
  container.appendChild(topRow);

  // Middle: queue commander + manual add
  const midRow = document.createElement("div");
  midRow.style.display = "flex";
  midRow.style.gap = "16px";
  midRow.style.flexWrap = "wrap";

  // Queue Commander panel
  const queuePanel = document.createElement("div");
  queuePanel.style.flex = "1";
  queuePanel.style.minWidth = "300px";
  queuePanel.style.border = "1px solid #333";
  queuePanel.style.padding = "10px";
  queuePanel.style.borderRadius = "6px";
  queuePanel.style.background = "#1f1f1f";

  const queueTitle = document.createElement("div");
  queueTitle.style.fontWeight = "600";
  queueTitle.style.marginBottom = "6px";
  queueTitle.textContent = "Queue Commander";
  queuePanel.appendChild(queueTitle);

  const persistentQueue = document.createElement("div");
persistentQueue.id = "persistentQueue";
persistentQueue.style.maxHeight = "220px";        // cap so it doesn't grow endlessly
persistentQueue.style.overflowY = "auto";         // vertical scrolling
persistentQueue.style.overflowX = "hidden";
persistentQueue.style.display = "flex";
persistentQueue.style.flexDirection = "column";
persistentQueue.style.gap = "6px";
queuePanel.appendChild(persistentQueue);

// allow queuePanel to flex/shrink if space is tight
queuePanel.style.flex = "1 1 300px";

  // Manual Add / Assign panel
  const manualPanel = document.createElement("div");
  manualPanel.style.flex = "1";
  manualPanel.style.minWidth = "300px";
  manualPanel.style.border = "1px solid #333";
  manualPanel.style.padding = "10px";
  manualPanel.style.borderRadius = "6px";
  manualPanel.style.background = "#1f1f1f";

  const manualTitle = document.createElement("div");
  manualTitle.style.fontWeight = "600";
  manualTitle.style.marginBottom = "6px";
  manualTitle.textContent = "Manual Add / Assign";
  manualPanel.appendChild(manualTitle);

  const memberSelect = document.createElement("select");
  memberSelect.size = 8;
  memberSelect.style.width = "100%";
  memberSelect.style.padding = "6px";
  memberSelect.style.borderRadius = "4px";
  memberSelect.style.background = "#1f1f1f";
  memberSelect.style.color = "#eee";
  memberSelect.style.border = "1px solid #555";
  manualPanel.appendChild(memberSelect);

  // username + chain assign row
  const assignRow = document.createElement("div");
  assignRow.style.display = "flex";
  assignRow.style.gap = "6px";
  assignRow.style.marginTop = "8px";
  assignRow.style.flexWrap = "wrap";

  const selectedUserInput = document.createElement("input");
  selectedUserInput.placeholder = "Username";
  selectedUserInput.style.flex = "1";
  selectedUserInput.style.padding = "6px";
  selectedUserInput.style.borderRadius = "4px";
  selectedUserInput.style.border = "1px solid #555";
  selectedUserInput.style.background = "#1f1f1f";
  selectedUserInput.style.color = "#eee";

  const chainNumberInput = document.createElement("input");
  chainNumberInput.placeholder = "Chain # / Bonus";
  chainNumberInput.type = "number";
  chainNumberInput.style.width = "110px";
  chainNumberInput.style.padding = "6px";
  chainNumberInput.style.borderRadius = "4px";
  chainNumberInput.style.border = "1px solid #555";
  chainNumberInput.style.background = "#1f1f1f";
  chainNumberInput.style.color = "#eee";

  const addAssignBtn = document.createElement("button");
  addAssignBtn.textContent = "Add / Assign";
  addAssignBtn.style.padding = "6px 12px";
  addAssignBtn.style.border = "none";
  addAssignBtn.style.borderRadius = "5px";
  addAssignBtn.style.background = "#28a745";
  addAssignBtn.style.color = "#fff";
  addAssignBtn.style.cursor = "pointer";

  assignRow.appendChild(selectedUserInput);
  assignRow.appendChild(chainNumberInput);
  assignRow.appendChild(addAssignBtn);
  manualPanel.appendChild(assignRow);

  midRow.appendChild(queuePanel);
  midRow.appendChild(manualPanel);
  container.appendChild(midRow);

  // Bottom: change PIN + chain status
  const bottomRow = document.createElement("div");
  bottomRow.style.display = "flex";
  bottomRow.style.gap = "20px";
  bottomRow.style.flexWrap = "wrap";

  // PIN change
  const pinSection = document.createElement("div");
  pinSection.style.flex = "1";
  pinSection.style.minWidth = "220px";
  pinSection.style.display = "flex";
  pinSection.style.flexDirection = "column";
  pinSection.style.gap = "6px";

  const pinHeader = document.createElement("div");
  pinHeader.style.fontWeight = "600";
  pinHeader.textContent = "Change Admin PIN";
  pinSection.appendChild(pinHeader);

  const pinInputs = document.createElement("div");
  pinInputs.style.display = "flex";
  pinInputs.style.gap = "6px";

  const currentPinInput = document.createElement("input");
  currentPinInput.type = "password";
  currentPinInput.maxLength = 4;
  currentPinInput.placeholder = "Current PIN";
  currentPinInput.style.width = "80px";
  currentPinInput.style.padding = "6px";
  currentPinInput.style.borderRadius = "4px";
  currentPinInput.style.border = "1px solid #555";
  currentPinInput.style.background = "#1f1f1f";
  currentPinInput.style.color = "#eee";

  const newPinInput = document.createElement("input");
  newPinInput.type = "password";
  newPinInput.maxLength = 4;
  newPinInput.placeholder = "New PIN";
  newPinInput.style.width = "80px";
  newPinInput.style.padding = "6px";
  newPinInput.style.borderRadius = "4px";
  newPinInput.style.border = "1px solid #555";
  newPinInput.style.background = "#1f1f1f";
  newPinInput.style.color = "#eee";

  const changePinBtnFinal = document.createElement("button");
  changePinBtnFinal.textContent = "Change PIN";
  changePinBtnFinal.style.padding = "6px 12px";
  changePinBtnFinal.style.border = "none";
  changePinBtnFinal.style.borderRadius = "5px";
  changePinBtnFinal.style.background = "#17a2b8";
  changePinBtnFinal.style.color = "#fff";
  changePinBtnFinal.style.cursor = "pointer";

  pinInputs.appendChild(currentPinInput);
  pinInputs.appendChild(newPinInput);
  pinInputs.appendChild(changePinBtnFinal);
  pinSection.appendChild(pinInputs);

  // Chain info
  const chainInfo = document.createElement("div");
  chainInfo.style.flex = "1";
  chainInfo.style.minWidth = "220px";
  chainInfo.innerHTML = `
    <div style="font-weight:600;">Chain Status</div>
    <div>Current chain: <strong id="currentChainDisplay">${currentChainNumber !== null ? currentChainNumber : "--"}</strong></div>
  `;

  bottomRow.appendChild(pinSection);
  bottomRow.appendChild(chainInfo);
  container.appendChild(bottomRow);

  tabContent.appendChild(container);

  // --- wiring ---

  delayInput.addEventListener("input", (e) => {
    delaySeconds = Math.min(Math.max(0, parseInt(e.target.value) || 0), 30);
  });
  startBtn.addEventListener("click", startCountdown);
  lockBtn.addEventListener("click", () => {
    clearAdminUnlocked();
    renderTab("admin");
  });

  changePinBtnFinal.addEventListener("click", () => {
    const current = currentPinInput.value.trim();
    const next = newPinInput.value.trim();
    if (current !== adminPin) return alert("Current PIN wrong");
    if (!/^\d{4}$/.test(next)) return alert("New PIN must be 4 digits");
    adminPin = next;
    localStorage.setItem(STORAGE_KEY_PIN, adminPin);
    alert("PIN udiscordted");
  });

  // queue rendering helper
  function renderPersistentQueue() {
    persistentQueue.innerHTML = "";

    if (!queue.length) {
      const empty = document.createElement("div");
      empty.style.color = "#888";
      empty.style.fontSize = "13px";
      empty.style.padding = "8px";
      empty.textContent = "No one is currently in the queue.";
      persistentQueue.appendChild(empty);
      return;
    }

    const sorted = queue.slice().sort((a, b) => {
      if (a.assignedNumber == null && b.assignedNumber == null) return 0;
      if (a.assignedNumber == null) return 1;
      if (b.assignedNumber == null) return -1;
      return a.assignedNumber - b.assignedNumber;
    });

    sorted.forEach((entry, idx) => {
      const row = document.createElement("div");
      row.style = "display:flex; gap:8px; align-items:center; background:#222; padding:8px; border-radius:4px;";

      if (
        typeof discordUsername === "string" &&
        entry.user.toLowerCase() === discordUsername.toLowerCase()
      ) {
        row.style.border = "2px solid #00ffdd";
      }

      const info = document.createElement("div");
      info.style.flex = "1";
      info.innerHTML = `<strong>${idx + 1}.</strong> ${entry.user} <span style="color:#aaa;">(#${entry.assignedNumber ?? "-"})</span>`;

      const kick = document.createElement("button");
      kick.textContent = "Kick";
      kick.style = "padding:4px 8px; border:none; border-radius:4px; cursor:pointer; background:#c0392b; color:#fff;";
      kick.addEventListener("click", () => {
        const removeIdx = queue.findIndex(
          q => q.user.toLowerCase() === entry.user.toLowerCase()
        );
        if (removeIdx !== -1) {
          queue.splice(removeIdx, 1);
          saveQueue();
          renderPersistentQueue();
        }
      });

      row.appendChild(info);
      row.appendChild(kick);
      persistentQueue.appendChild(row);
    });
  }
  renderPersistentQueue();

  // manual member list population & wiring
  function rebuildMemberOptions() {
    memberSelect.innerHTML = "";
    const members = (panel._loadedYataMembers || []).slice();
    members.sort((a, b) =>
      a.torn_name.localeCompare(b.torn_name, undefined, { sensitivity: "base" })
    );
    members.forEach((m) => {
      const opt = document.createElement("option");
      opt.value = m.torn_name;
      opt.textContent = `${m.torn_name} (${m.status})`;
      memberSelect.appendChild(opt);
    });
  }
  rebuildMemberOptions();

  memberSelect.addEventListener("change", () => {
    selectedUserInput.value = memberSelect.value;
  });
  memberSelect.addEventListener("dblclick", () => {
    selectedUserInput.value = memberSelect.value;
    chainNumberInput.focus();
  });

  addAssignBtn.addEventListener("click", () => {
    const user = selectedUserInput.value.trim();
    const numRaw = chainNumberInput.value.trim();
    if (!user || !numRaw) return alert("Provide both username and chain number");
    const assignedNumber = parseInt(numRaw, 10);
    if (isNaN(assignedNumber)) return alert("Invalid chain number");
    const existing = queue.find(q => q.user.toLowerCase() === user.toLowerCase());
    if (existing) {
      existing.assignedNumber = assignedNumber;
    } else {
      queue.push({ user, assignedNumber });
    }
    saveQueue();
    renderPersistentQueue();
    selectedUserInput.value = "";
    chainNumberInput.value = "";
  });

  break;
}

      case "discord": {
        tabContent.innerHTML = "";
        const wrapper = document.createElement("div");
        wrapper.style.display = "flex";
        wrapper.style.flexDirection = "column";
        wrapper.style.gap = "12px";
        wrapper.style.width = "100%";
		
		// --- discord Console Viewer ---
const discordConsole = document.createElement("div");
discordConsole.id = "discordConsole";
discordConsole.style.height = "90px";
discordConsole.style.background = "#18191b";
discordConsole.style.border = "1px solid #383838";
discordConsole.style.borderRadius = "8px";
discordConsole.style.color = "#42ffca";
discordConsole.style.fontFamily = "monospace";
discordConsole.style.fontSize = "12px";
discordConsole.style.padding = "8px";
discordConsole.style.overflowY = "auto";
discordConsole.style.marginBottom = "6px";
discordConsole.textContent = "(discord messages from mobile users will show here)";
wrapper.appendChild(discordConsole);

// Listen for postMessage events (TORNdiscord_MSG)
window.addEventListener("message", function (event) {
    if (!event.data || event.data.type !== "TORNdiscord_MSG") return;
    const line = `[${event.data.direction}] ${event.data.msg}`;
    if (discordConsole.textContent === "(discord message console will show here)") discordConsole.textContent = "";
    discordConsole.textContent += (discordConsole.textContent ? "\n" : "") + line;
    discordConsole.scrollTop = discordConsole.scrollHeight;
});

        const labelRow = document.createElement("div");
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.gap = "6px";
        label.style.alignItems = "center";
        label.style.fontSize = "12px";
        label.textContent = "Verified Torn Username:";
        const input = document.createElement("input");
        input.id = "discordUsernameInput";
        input.type = "text";
        input.placeholder = "Enter Torn username";
        input.value = discordUsername;
        input.style.flex = "1";
        input.style.padding = "6px";
        input.style.borderRadius = "4px";
        input.style.border = "1px solid #555";
        input.style.background = "#1f1f1f";
        input.style.color = "#eee";
        input.style.marginLeft = "6px";
        label.appendChild(input);
        labelRow.appendChild(label);
        wrapper.appendChild(labelRow);

        const buttonRow = document.createElement("div");
        buttonRow.style.display = "flex";
        buttonRow.style.gap = "8px";
        const saveBtn = document.createElement("button");
        saveBtn.id = "saveDiscordUserBtn";
        saveBtn.textContent = "Save Username";
        saveBtn.style.padding = "8px 12px";
        saveBtn.style.border = "none";
        saveBtn.style.borderRadius = "6px";
        saveBtn.style.background = "#17a2b8";
        saveBtn.style.color = "#fff";
        saveBtn.style.cursor = "pointer";
        const testBtn = document.createElement("button");
        testBtn.id = "testChainBtn";
        testBtn.textContent = "Get Chain #";
        testBtn.style.padding = "8px 12px";
        testBtn.style.border = "none";
        testBtn.style.borderRadius = "6px";
        testBtn.style.background = "#28a745";
        testBtn.style.color = "#fff";
        testBtn.style.cursor = "pointer";
        buttonRow.appendChild(saveBtn);
        buttonRow.appendChild(testBtn);
        wrapper.appendChild(buttonRow);

        const foot = document.createElement("div");
        foot.style.fontSize = "11px";
        foot.style.color = "#aaa";
        foot.textContent = "This Torn username is used for namespacing your API key and chain fetch.";
        wrapper.appendChild(foot);

        tabContent.appendChild(wrapper);

        saveBtn.addEventListener("click", () => {
          const val = input.value.trim();
          if (!val) return alert("Username empty");
          discordUsername = val;
          localStorage.setItem(STORAGE_KEY_USER, discordUsername);
          alert("Saved");
        });
        testBtn.addEventListener("click", requestChainNumber);
        break;
      }

      default: {
        tabContent.textContent = `Unknown tab: ${name}`;
      }
    }
  }

  // --- EULA overlay ---
  function showEulaOverlay() {
    if (document.getElementById("eulaOverlay")) return;
    const overlay = document.createElement("div");
    overlay.id = "eulaOverlay";
    overlay.style = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0.85);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 10001;
      padding: 16px;
      font-family: system-ui,-apple-system,BlinkMacSystemFont,Segoe UI;
    `;
    const box = document.createElement("div");
    box.style = `
      background: #1f1f1f;
      color: #eee;
      border-radius: 10px;
      max-width: 600px;
      width: 100%;
      padding: 18px;
      box-shadow: 0 0 24px rgba(0,0,0,0.9);
      position: relative;
    `;
    const title = document.createElement("h2");
    title.style.marginTop = "0";
    title.textContent = "Torn Chain Panel License Agreement";
    const body = document.createElement("div");
    body.style.maxHeight = "320px";
    body.style.overflow = "auto";
    body.style.fontSize = "13px";
    body.style.lineHeight = "1.3";
    body.style.marginBottom = "12px";
    body.innerHTML = `
      <p>You must have explicit, prior written authorization from the owner (BuzzC137) to use this extension. Unauthorized redistribution, sharing, or modification is prohibited. The admin PIN and any authorization tokens are non-transferable. The software is provided "AS IS" without warranty. Use constitutes agreement to these terms.</p>
      <p>To request authorization, contact the owner via the repository issues or your established channel. Unauthorized use may result in revocation and legal action.</p>
    `;
    const controls = document.createElement("div");
    controls.style = "display:flex; gap:10px; flex-wrap:wrap; align-items:center;";
    const label = document.createElement("label");
    label.style = "flex:1; font-size:12px; display:flex; gap:6px; align-items:center;";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.id = "acceptEulaCheckbox";
    label.appendChild(checkbox);
    label.appendChild(document.createTextNode("I have authorization and accept the license terms."));
    const acceptBtn = document.createElement("button");
    acceptBtn.id = "acceptEulaBtn";
    acceptBtn.textContent = "Accept & Continue";
    acceptBtn.disabled = true;
    acceptBtn.style = "padding:8px 14px; background:#28a745; border:none; border-radius:6px; cursor:pointer; color:#fff; font-weight:600;";
    checkbox.addEventListener("change", () => {
      acceptBtn.disabled = !checkbox.checked;
    });
    acceptBtn.addEventListener("click", () => {
      localStorage.setItem("chainPanelEulaAccepted", "1");
      overlay.remove();
      // re-render current active tab
      const active = Array.from(tabs).find((t) => t.style.background === "rgb(63, 143, 255)" || t.style.background === "#3f8fff");
      renderTab(active ? active.dataset.tab : "settings");
    });
    controls.appendChild(label);
    controls.appendChild(acceptBtn);

    const footer = document.createElement("div");
    footer.style = "margin-top:8px; font-size:11px; color:#aaa;";
    footer.innerHTML = `Visit <a href="https://github.com/BuzzC137/torn-chain-panel" target="_blank" style="color:#88cfff;">repository</a> for support or to request authorization.`;

    box.appendChild(title);
    box.appendChild(body);
    box.appendChild(controls);
    box.appendChild(footer);
    overlay.appendChild(box);
    document.body.appendChild(overlay);
  }

  // --- Chain fetch ---
function requestChainNumber() {
  if (!discordUsername) {
    alert("Set your Torn username first in discord tab.");
    return;
  }
  if (!hasAuthToken()) {
    alert("Missing authorization token.");
    return;
  }

  chrome.runtime.sendMessage(
    { action: "getChainNumber", user: encodeURIComponent(discordUsername) /*, authToken: localStorage.getItem(AUTH_TOKEN_KEY)*/ },
    (res) => {
      if (res?.error) {
        alert("Error fetching chain number: " + (res.message || "unknown"));
        return;
      }

      const chainNum = parseInt(res.chain, 10);
      if (isNaN(chainNum)) {
        alert("Received invalid chain number.");
        return;
      }

      // store latest chain number
      currentChainNumber = chainNum;

      // udiscordte display in admin UI if present
      const display = document.getElementById("currentChainDisplay");
      if (display) display.textContent = chainNum;

      // auto-add / udiscordte queue entry for current user
      // determine next available assignedNumber: highest existing +1
      let maxAssigned = 0;
      queue.forEach((q) => {
        if (typeof q.assignedNumber === "number" && !isNaN(q.assignedNumber)) {
          maxAssigned = Math.max(maxAssigned, q.assignedNumber);
        }
      });
      const nextNumber = maxAssigned + 1;

      const existing = queue.find(
        (q) => q.user.toLowerCase() === discordUsername.toLowerCase()
      );
      if (existing) {
        if (existing.assignedNumber == null) {
          existing.assignedNumber = nextNumber;
        }
      } else {
        queue.push({ user: discordUsername, assignedNumber: nextNumber });
      }
      saveQueue();

      // refresh UI if admin tab is active
      const activeTab = document.querySelector('.tab[style*="#3f8fff"]');
      if (activeTab && activeTab.dataset.tab === "admin") {
        renderTab("admin");
      } else if (typeof renderPersistentQueue === "function") {
        renderPersistentQueue();
      }

      // optionally prefill manual-add username input
      const manualNameInput = document.querySelector('input[placeholder="Username"]');
      if (manualNameInput) manualNameInput.value = discordUsername;

      alert(`Your chain number is: #${chainNum}`);
    }
  );
}

  // countdown starter (exposed)
  function startCountdown() {
    clearInterval(timerInterval);
    let total = getStartingTime() - delaySeconds;
    udiscordteCountdown(countdownEl, total);
    lastAlertedThreshold = null;
    timerInterval = setInterval(() => {
      total--;
      if (total <= 0) {
        clearInterval(timerInterval);
        countdownEl.textContent = "--:--";
        triggerAlert("done");
      } else {
        udiscordteCountdown(countdownEl, total);
        checkThresholds(total);
      }
    }, 1000);
  }

  window.chainPanelStartCountdown = startCountdown;
})();
