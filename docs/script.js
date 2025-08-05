fetch('/api/status')
  .then(res => res.json())
  .then(data => {
    document.getElementById('status').innerText = data.message;
  })
  .catch(() => {
    document.getElementById('status').innerText = 'Error connecting to bot.';
  });
