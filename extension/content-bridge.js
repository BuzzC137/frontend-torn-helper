// content-bridge.js
(() => {
  if (window.__tpda_comm_bridge_installed) return;
  window.__tpda_comm_bridge_installed = true;

  // Helper: normalize username field between 'user' and 'discordUsername'
  function getUsername(msg) {
    return msg.user || msg.discordUsername;
  }

  // From page → extension
  window.addEventListener("message", (e) => {
    if (e.source !== window) return;
    const msg = e.data;
    if (!msg || msg.source !== "tornPDA") return;

    switch (msg.type) {
      case "enqueueUser": {
        const username = getUsername(msg);
        chrome.runtime.sendMessage(
          { action: "enqueueUser", user: username },
          (resp) => {
            window.postMessage(
              {
                source: "extensionBridge",
                type: "chainResponse",
                ...resp,
              },
              "*"
            );
          }
        );
        break;
      }
      case "getChainNumber": {
        const username = getUsername(msg);
        chrome.runtime.sendMessage(
          { action: "getChainNumber", user: username },
          (resp) => {
            window.postMessage(
              {
                source: "extensionBridge",
                type: "chainResponse",
                ...resp,
              },
              "*"
            );
          }
        );
        break;
      }
      case "getQueue": {
        chrome.runtime.sendMessage(
          { action: "getQueue" },
          (resp) => {
            window.postMessage(
              {
                source: "extensionBridge",
                type: "queueUpdate",
                ...resp,
              },
              "*"
            );
          }
        );
        break;
      }
      case "kickUser": {
        const username = getUsername(msg);
        chrome.runtime.sendMessage(
          { action: "kickUser", user: username },
          (resp) => {
            window.postMessage(
              {
                source: "extensionBridge",
                type: "queueUpdate",
                ...resp,
              },
              "*"
            );
          }
        );
        break;
      }
      // Combined handler for legacy/future calls (optional)
      case "getChainAndEnqueue": {
        const username = getUsername(msg);
        // First enqueue, then get chain info
        chrome.runtime.sendMessage(
          { action: "enqueueUser", user: username },
          (resp) => {
            // Optionally chain getChainNumber if you want most up-to-date chain
            chrome.runtime.sendMessage(
              { action: "getChainNumber", user: username },
              (chainResp) => {
                window.postMessage(
                  {
                    source: "extensionBridge",
                    type: "chainResponse",
                    ...resp,
                    ...chainResp,
                  },
                  "*"
                );
              }
            );
          }
        );
        break;
      }
      // Add more request types as needed
    }
  });

  // Extension → page unsolicited broadcasts
  chrome.runtime.onMessage.addListener((msg) => {
    if (!msg || typeof msg !== "object") return;
    if (msg.type === "broadcastChainResponse") {
      window.postMessage(
        {
          source: "extensionBridge",
          type: "chainResponse",
          ...msg.payload,
        },
        "*"
      );
    } else if (msg.type === "broadcastQueueUpdate") {
      window.postMessage(
        {
          source: "extensionBridge",
          type: "queueUpdate",
          ...msg.payload,
        },
        "*"
      );
    }
  });
})();