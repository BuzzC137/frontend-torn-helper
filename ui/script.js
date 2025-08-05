// —————————————————————————————————————————————
// Server-status checker
// —————————————————————————————————————————————
async function checkServer() {
  try {
    const res  = await fetch('/api/status');
    const data = await res.json();
    document.getElementById('status').innerText = data.message;
  } catch (err) {
    console.error('Status check failed:', err);
    document.getElementById('status').innerText = 'Error connecting to bot.';
  }
}

// —————————————————————————————————————————————
// Queue-stats fetcher
// —————————————————————————————————————————————
async function fetchStats() {
  try {
    const res  = await fetch('/api/stats');
    const data = await res.json();
    document.getElementById('chain-stats').innerText =
      `In queue: ${data.queueLength}`;
  } catch (err) {
    console.error('Stats fetch failed:', err);
    document.getElementById('chain-stats').innerText =
      'Unable to load stats.';
  }
}

// —————————————————————————————————————————————
// Full-queue fetcher
// —————————————————————————————————————————————
async function fetchQueue() {
  try {
    const res   = await fetch('/chain/assignments.json');
    const json  = await res.json();
    const list  = json.queue;
    const el    = document.getElementById('full-queue');
    if (!el) return;

    if (list.length === 0) {
      el.innerText = 'No one in queue.';
    } else {
      el.innerHTML = list
        .map(item => `<li>${item.user}: #${item.assignedNumber}</li>`)
        .join('');
    }
  } catch (err) {
    console.error('Queue fetch failed:', err);
  }
}

// —————————————————————————————————————————————
// “Get Next” helper
// —————————————————————————————————————————————
async function assignNext() {
  try {
    const res  = await fetch('/api/next', { method: 'POST' });
    const data = await res.json();
    alert(`You’ve been assigned chain #${data.assignedNumber}`);
    fetchStats();
    fetchQueue();
  } catch (err) {
    console.error('Assign-next failed:', err);
    alert('Could not get next chain number.');
  }
}

// —————————————————————————————————————————————
// Initialize & auto-refresh loops
// —————————————————————————————————————————————
window.addEventListener('DOMContentLoaded', () => {
  checkServer();
  fetchStats();
  fetchQueue();

  setInterval(checkServer, 30_000);
  setInterval(fetchStats, 15_000);
  setInterval(fetchQueue, 20_000);

  const btn = document.getElementById('get-next-btn');
  if (btn) btn.addEventListener('click', assignNext);
});
