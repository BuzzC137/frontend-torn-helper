// server.js
const express = require('express');
const path    = require('path');
const fs      = require('fs');
const http    = require('http');
const { Server } = require('socket.io');

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

// find lowest positive integer not yet taken
function getNextChainNumber() {
  const assignments = loadAssignments();
  let next = 1;
  while (Object.values(assignments).includes(next)) {
    next++;
  }
  return next;
}

// assign and persist a new chain number under "public"
function storeNextChain() {
  const assignments = loadAssignments();
  const next = getNextChainNumber();
  assignments['public'] = next;
  saveAssignments(assignments);
  return next;
}
// ————————————————————————————————

// serve static frontend from /public
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json()); // parse JSON bodies

// — health check
app.get('/api/status', (req, res) => {
  res.json({ message: 'Chain bot is running.' });
});

// — queue stats
app.get('/api/stats', (req, res) => {
  const assignments = loadAssignments();
  res.json({ queueLength: Object.keys(assignments).length });
});

// — assign “next” chain via HTTP GET or POST
app.get('/api/next',  (req, res) => {
  const num = storeNextChain();
  res.json({ assignedNumber: num });
});
app.post('/api/next', (req, res) => {
  const num = storeNextChain();
  res.json({ assignedNumber: num });
});

// — set up real-time via Socket.IO
const server = http.createServer(app);
const io = new Server(server);

io.on('connection', socket => {
  console.log('📡 Client connected');

  // client asks for next chain
  socket.on('getNext', () => {
    const num = storeNextChain();
    // broadcast to everyone
    io.emit('newChain', num);
  });

  socket.on('disconnect', () => {
    console.log('❌ Client disconnected');
  });
});

// start HTTP + WebSocket server
server.listen(PORT, () => {
  console.log(`Bot + UI + real-time running at http://localhost:${PORT}`);
});
