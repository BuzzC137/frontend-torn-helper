const express = require('express');
const app = express();
const path = require('path');

// Serve frontend
app.use(express.static(path.join(__dirname, 'public')));

// Basic API endpoint
app.get('/api/status', (req, res) => {
  res.json({ message: 'Chain bot is running.' });
});

app.listen(3000, () => {
  console.log('Bot + UI running at http://localhost:3000');
});
