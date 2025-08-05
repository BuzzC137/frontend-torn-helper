const express = require('express');
const app = express();
const path = require('path');
const fs = require('fs');

// ——— helpers for assignments.json ———
const ASSIGN_FILE = path.join(__dirname, 'assignments.json');
function loadAssignments() {
  if (!fs.existsSync(ASSIGN_FILE)) fs.writeFileSync(ASSIGN_FILE, '{}');
  return JSON.parse(fs.readFileSync(ASSIGN_FILE));
}
function saveAssignments(data) {
  fs.writeFileSync(ASSIGN_FILE, JSON.stringify(data, null, 2));
}
// ————————————————————————————————

// serve frontend
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());            // parse JSON bodies

// basic health-check
app.get('/api/status', (req, res) =>
  res.json({ message: 'Chain bot is running.' })
);

// mini-Yata stats endpoint
app.get('/api/stats', (req, res) => {
  const assignments = loadAssignments();
  res.json({ queueLength: Object.keys(assignments).length });
});

// mini-Yata “get next” endpoint
app.post('/api/next', (req, res) => {
  const assignments = loadAssignments();
  let next = 1;
  while (Object.values(assignments).includes(next)) next++;
  assignments['public'] = next;
  saveAssignments(assignments);
  res.json({ assignedNumber: next });
});

app.listen(3000, () => {
  console.log('Bot + UI running at http://localhost:3000');
});

