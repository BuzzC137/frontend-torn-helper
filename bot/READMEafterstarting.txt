https://fountain-written-dressing-wayne.trycloudflare.com where all does this need to go to fix the disconnect?


To fix disconnects and make your Torn Chain Panel Chrome extension + bot work reliably with the current quick tunnel URL (https://fountain-written-dressing-wayne.trycloudflare.com), you need to update it in 3 places:



✅ 1. In your Chrome extension manifest.json
Update the host_permissions:

json
Copy
Edit
"host_permissions": [
  "https://www.torn.com/*",
  "https://fountain-written-dressing-wayne.trycloudflare.com/*"
]



✅ 2. In your extension's content.js (or wherever the fetch is called)
Update the fetch URL:

javascript
Copy
Edit
fetch("https://fountain-written-dressing-wayne.trycloudflare.com/chain/buzzc137")



✅ 3. (Optional) In any test Userscript (Tampermonkey) or fallback code
If you’re using a Tampermonkey fallback or testing in console, update it there too:

javascript
Copy
Edit
fetch("https://fountain-written-dressing-wayne.trycloudflare.com/chain/buzzc137")