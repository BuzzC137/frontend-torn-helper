// background.js

chrome.runtime.onInstalled.addListener(() => {
  console.log("Background service worker installed and running");
});

// --- Configuration & In-Memory State ---
const RATE_LIMIT_WINDOW_MS = 10_000; // 10 seconds
const MAX_PER_WINDOW = 5;

// User request log: Map<user, { action: [timestamps] }>
const userRequestLog = new Map();

// Queue: [{ user: string, assignedNumber: number, addedAt: number }]
let queue = [];

// Target hit timestamp (ms since epoch), set by admin
let targetHitTimestamp = null;

// --- Helpers ---

/**
 * Rate limit check for user + action.
 */
function allowRequestForUser(user, action) {
  const now = Date.now();
  const userLog = userRequestLog.get(user) || {};
  const actionLog = userLog[action] || [];
  // Keep only recent entries
  const filtered = actionLog.filter(ts => now - ts <= RATE_LIMIT_WINDOW_MS);
  if (filtered.length >= MAX_PER_WINDOW) {
    userLog[action] = filtered;
    userRequestLog.set(user, userLog);
    return false;
  }
  filtered.push(now);
  userLog[action] = filtered;
  userRequestLog.set(user, userLog);
  return true;
}

/**
 * (Stub) Validate auth token. Replace with real validation as needed.
 */
async function validateAuthToken(token, user) {
  return typeof token === "string" && token.trim().length > 0;
}

/**
 * Get next available assigned number (max+1).
 */
function getNextAssignedNumber() {
  let max = 0;
  queue.forEach(q => {
    if (typeof q.assignedNumber === "number" && !isNaN(q.assignedNumber)) {
      max = Math.max(max, q.assignedNumber);
    }
  });
  return max + 1;
}

/**
 * Find queue position for user (1-based, sorted by assignedNumber).
 */
function getQueuePositionForUser(user) {
  const sorted = queue.slice().sort((a, b) => {
    if (a.assignedNumber == null && b.assignedNumber == null) return 0;
    if (a.assignedNumber == null) return 1;
    if (b.assignedNumber == null) return -1;
    return a.assignedNumber - b.assignedNumber;
  });
  const idx = sorted.findIndex(q => q.user.toLowerCase() === user.toLowerCase());
  return idx === -1 ? null : idx + 1;
}

/**
 * Get sorted snapshot of the queue.
 */
function getSortedQueue() {
  return queue
    .slice()
    .sort((a, b) => {
      if (a.assignedNumber == null && b.assignedNumber == null) return 0;
      if (a.assignedNumber == null) return 1;
      if (b.assignedNumber == null) return -1;
      return a.assignedNumber - b.assignedNumber;
    })
    .map(q => ({
      user: q.user,
      assignedNumber: q.assignedNumber
    }));
}

// --- Message Handling ---

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  (async () => {
    const { action } = request;
    if (!action) {
      sendResponse({ error: true, message: "Missing action" });
      return;
    }

    const user = request.user ? decodeURIComponent(request.user) : null;

    // Rate limit where applicable
    if (user && !allowRequestForUser(user, action)) {
      sendResponse({ error: true, message: "Rate limit exceeded" });
      return;
    }

    switch (action) {
      case "getChainNumber": {
        if (!request.user) {
          sendResponse({ error: true, message: "Missing user" });
          return;
        }
        const discordUser = request.user; // already encoded by caller

        // Optional: Uncomment for real auth token validation
        // const token = request.authToken || "";
        // if (!(await validateAuthToken(token, user))) {
        //   sendResponse({ error: true, message: "Unauthorized" });
        //   return;
        // }

        const endpoint = `https://checkout-forty-assured-groove.trycloudflare.com/chain/${discordUser}`;
        const controller = new AbortController();
        const timeoutMs = 5000;
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
          const resp = await fetch(endpoint, { signal: controller.signal });
          if (!resp.ok) {
            console.warn(`Chain endpoint returned non-OK: ${resp.status} ${resp.statusText}`);
            sendResponse({ error: true, message: "Failed to fetch chain number" });
            return;
          }
          const data = await resp.json();
          if (data && typeof data.chain !== "undefined") {
            sendResponse({
              chain: data.chain,
              queuePosition: getQueuePositionForUser(user),
              targetHitTimestamp,
              queue: getSortedQueue()
            });
          } else {
            console.warn("Unexpected response payload from chain endpoint:", data);
            sendResponse({ error: true, message: "Invalid response format" });
          }
        } catch (err) {
          if (err.name === "AbortError") {
            console.error("Fetch timed out for chain number request.");
            sendResponse({ error: true, message: "Request timed out" });
          } else {
            console.error("Error fetching chain number:", err);
            sendResponse({ error: true, message: "Network error" });
          }
        } finally {
          clearTimeout(timeoutId);
        }
        break;
      }

      case "enqueueUser": {
        if (!request.user) {
          sendResponse({ error: true, message: "Missing user to enqueue" });
          return;
        }
        const normalized = user.toLowerCase();
        let existing = queue.find(q => q.user.toLowerCase() === normalized);
        if (existing) {
          if (existing.assignedNumber == null) {
            existing.assignedNumber = getNextAssignedNumber();
          }
        } else {
          const assignedNumber = getNextAssignedNumber();
          queue.push({
            user: request.user,
            assignedNumber,
            addedAt: Date.now()
          });
        }
        const queuePosition = getQueuePositionForUser(user);
        sendResponse({
          success: true,
          queuePosition,
          assignedNumber: queue.find(q => q.user.toLowerCase() === normalized).assignedNumber,
          queue: getSortedQueue(),
          targetHitTimestamp
        });
        break;
      }

      case "kickUser": {
        if (!request.user) {
          sendResponse({ error: true, message: "Missing user to kick" });
          return;
        }
        const before = queue.length;
        queue = queue.filter(q => q.user.toLowerCase() !== user.toLowerCase());
        const after = queue.length;
        sendResponse({
          success: true,
          removed: before !== after,
          queue: getSortedQueue()
        });
        break;
      }

      case "getQueue": {
        sendResponse({
          queue: getSortedQueue(),
          targetHitTimestamp
        });
        break;
      }

      case "setTargetHitTimestamp": {
        // Optionally validate admin via token
        // const token = request.authToken || "";
        // if (!(await validateAuthToken(token, user))) {
        //   sendResponse({ error: true, message: "Unauthorized" });
        //   return;
        // }
        if (typeof request.timestamp !== "number") {
          sendResponse({ error: true, message: "Invalid timestamp" });
          return;
        }
        targetHitTimestamp = request.timestamp;
        sendResponse({ success: true, targetHitTimestamp });
        break;
      }

      case "getTargetHitTimestamp": {
        sendResponse({ targetHitTimestamp });
        break;
      }

      default: {
        sendResponse({ error: true, message: `Unknown action: ${action}` });
      }
    }
  })();

  // Keep channel open for async response
  return true;
});
