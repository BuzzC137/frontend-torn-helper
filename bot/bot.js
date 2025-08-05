// bot.js

// ── deps ────────────────────────────────────────────────────────────────────────
const fs           = require('fs');
const path         = require('path');
require('dotenv').config();

const { Client, GatewayIntentBits } = require('discord.js');
const express      = require('express');
const cors         = require('cors');
const http         = require('http');
const { Server: IOServer } = require('socket.io');

// ── Discord “helper” bot setup ───────────────────────────────────────────────────
const client      = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});
const ASSIGN_FILE = path.join(__dirname, 'assignments.json');

function loadAssignments() {
  if (!fs.existsSync(ASSIGN_FILE)) {
    fs.writeFileSync(ASSIGN_FILE, '{}');
  }
  return JSON.parse(fs.readFileSync(ASSIGN_FILE, 'utf8'));
}

let io;  // forward-declare for saveAssignments
function saveAssignments(data) {
  fs.writeFileSync(ASSIGN_FILE, JSON.stringify(data, null, 2));
  if (io) io.emit('queueUpdate', data);
}

client.on('messageCreate', msg => {
  if (!msg.content.startsWith('!')) return;
  const user = msg.author.tag.toLowerCase();
  const a    = loadAssignments();

  switch (msg.content) {
    case '!joinchain': {
      if (a[user]) {
        return msg.reply(`You already have chain #${a[user]}`);
      }
      const taken = Object.values(a);
      let next = 1;
      while (taken.includes(next)) next++;
      a[user] = next;
      saveAssignments(a);
      return msg.reply(`You’ve been assigned chain #${next}`);
    }
    case '!leavechain': {
      if (!a[user]) {
        return msg.reply(`You have no chain assigned.`);
      }
      const left = a[user];
      delete a[user];
      saveAssignments(a);
      return msg.reply(`You left chain #${left}`);
    }
    case '!me': {
      if (a[user]) {
        return msg.reply(`Your chain number is #${a[user]}`);
      }
      return msg.reply(`You don’t have one yet. Use !joinchain`);
    }
    case '!chain': {
      const list = Object.entries(a)
        .map(([u, num]) => `${u}: #${num}`)
        .join('\n') || 'No assignments yet.';
      return msg.reply(`Current chain assignments:\n${list}`);
    }
  }
});

client.login(process.env.BOT_TOKEN);

// ── Express + HTTP + Socket.IO setup ────────────────────────────────────────────
const app    = express();
const server = http.createServer(app);
io = new IOServer(server, { cors: { origin: '*' } });
const PORT   = process.env.PORT || 3000;

// allow CORS + JSON bodies
app.use(cors());
app.use(express.json());

// static-serve your GitHub UI:
const FRONTEND_DIR = path.resolve(
  __dirname,
  '..',                   // up from /bot
  'server',
  'frontend',
  'frontend-torn-helper',
  'public'
);
app.use(express.static(FRONTEND_DIR));

// ── HTTP API ────────────────────────────────────────────────────────────────────

// 0) status ping for your front-end
app.get('/api/status', (req, res) => {
  res.json({ message: 'Chain bot API & UI are running.' });
});

// 1) health-check + serve index.html on “/”
app.get('/', (req, res) => {
  res.sendFile(path.join(FRONTEND_DIR, 'index.html'));
});

// 2) single lookup
app.get('/chain/:username', (req, res) => {
  const a = loadAssignments();
  const n = a[req.params.username.toLowerCase()] || null;
  res.json({ chain: n });
});

// 3) full queue dump
app.get('/chain/assignments.json', (req, res) => {
  const a = loadAssignments();
  const queue = Object.entries(a)
    .map(([user, assignedNumber]) => ({ user, assignedNumber }));
  res.json({ queue });
});

// 4a) mini-YATA stats
app.get('/api/stats', (req, res) => {
  const qlen = Object.keys(loadAssignments()).length;
  res.json({ queueLength: qlen });
});

// 4b) mini-YATA “next” (GET & POST)
function assignNext(req, res) {
  const a = loadAssignments();
  let nxt = 1;
  while (Object.values(a).includes(nxt)) nxt++;
  a['public'] = nxt;
  saveAssignments(a);
  res.json({ assignedNumber: nxt });
}
app.get('/api/next',  assignNext);
app.post('/api/next', assignNext);

// ── Socket.IO real-time layer ──────────────────────────────────────────────────
io.on('connection', socket => {
  // on connect, send current queue
  socket.emit('queueUpdate', loadAssignments());

  // optional WS shortcut to “getNext”
  socket.on('getNext', () => {
    const a = loadAssignments();
    let nxt = 1;
    while (Object.values(a).includes(nxt)) nxt++;
    a['public'] = nxt;
    saveAssignments(a);
    socket.emit('nextAssigned', nxt);
  });
});

// ── start everything ───────────────────────────────────────────────────────────
server.listen(PORT, () => {
  console.log(`API, UI & real-time WS running on http://localhost:${PORT}`);
});
