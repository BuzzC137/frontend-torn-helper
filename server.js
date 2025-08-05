// server.js
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 3000;
const ASSIGN_FILE = path.join(__dirname, 'assignments.json');

// ——— helpers for assignments.json ———
function loadAssignments() {
  if (!fs.existsSync(ASSIGN_FILE)) {
    fs.writeFileSync(ASSIGN_FILE, '{}');
  }
  return JSON.parse(fs.readFileSync(ASSIGN_FILE));
}

function saveAssignments(data) {
  fs.writeFileSync(ASSIGN_FILE, JSON.stringify(data, null, 2));
}
// ————————————————————————————————

// serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));
// enable JSON bodies (if you ever POST JSON)
app.use(express.json());

// — health check
app.get('/api/status', (req, res) => {
  res.json({ message: 'Chain bot is running.' });
});

// — queue stats
app.get('/api/stats', (req, res) => {
  const assignments = loadAssignments();
  res.json({ queueLength: Object.keys(assignments).length });
});

// — assign “next” chain (shared logic)
function assignNextChain(req, res) {
  const assignments = loadAssignments();
  // find lowest positive integer not yet taken
  let next = 1;
  while (Object.values(assignments).includes(next)) {
    next++;
  }
  // store it under the key "public"
  assignments['public'] = next;
  saveAssignments(assignments);
  res.json({ assignedNumber: next });
}

// support both GET and POST for “next”
app.get('/api/next',  assignNextChain);
app.post('/api/next', assignNextChain);

// start server
app.listen(PORT, () => {
  console.log(`Bot + UI running at http://localhost:${PORT}`);
});
