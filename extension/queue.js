// queue.js
"use strict";

const h = window.helpers;
const storage = window.storage;

// Get queue (always fresh from storage)
function getQueue() {
  return storage.loadQueue();
}

// Save queue
function setQueue(q) {
  storage.saveQueue(q);
}

// Add or update a user in queue
function upsertQueueUser(queue, user, assignedNumber) {
  user = user.trim();
  let existing = queue.find(q => q.user.toLowerCase() === user.toLowerCase());
  if (existing) {
    existing.assignedNumber = assignedNumber;
  } else {
    queue.push({ user, assignedNumber });
  }
  setQueue(queue);
  return queue;
}

// Remove by username
function removeQueueUser(queue, user) {
  const idx = queue.findIndex(q => q.user.toLowerCase() === user.toLowerCase());
  if (idx !== -1) {
    queue.splice(idx, 1);
    setQueue(queue);
  }
  return queue;
}

// Sort queue by assigned number
function sortQueue(queue) {
  return queue.slice().sort((a, b) => {
    if (a.assignedNumber == null && b.assignedNumber == null) return 0;
    if (a.assignedNumber == null) return 1;
    if (b.assignedNumber == null) return -1;
    return a.assignedNumber - b.assignedNumber;
  });
}

// Export
window.queue = {
  getQueue,
  setQueue,
  upsertQueueUser,
  removeQueueUser,
  sortQueue,
};
