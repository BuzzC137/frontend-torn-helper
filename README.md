Torn Chain Panel
Overview
Fetch and manage Torn chain numbers with:

the root level doc file is a mock, and will not display real world data. its just a testing playground for the development team.

Countdown alerts (sound + flashing + tab badge)
Secure admin queue management (assign, reorder, kick)
YATA faction member import via your Torn API key
Persistent settings and draggable panel
Setup
Install the extension unpacked via chrome://extensions (or from Chrome Web Store once published).
In the Discord tab: enter your verified Torn username and save it.
In the API Key tab: enter your Torn API key and click "Load Members" to import faction data.
Unlock the Admin tab with the 4-digit PIN (default 2580) to manage the queue and timers.
Click Get My # to fetch your chain number.
Configure alerts, sounds, and flashing in Settings.
Security & Privacy
API key is used only in-session to query YATA; it is not exfiltrated elsewhere.
Admin PIN protects sensitive functions; unlock persists only until manually locked or page reload.
All other data is stored locally in your browser.
Troubleshooting
If chain number doesn't fetch: ensure your Torn username is saved and the background service worker is active (check chrome://extensions).
To reset stored data: clear relevant entries in the browser DevTools Application tab for the site.
