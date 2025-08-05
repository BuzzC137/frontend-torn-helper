@echo off
REM — 1) Bot server window —
start "Bot Server" cmd /k ^
  "cd /d C:\Users\TFO\OneDrive\Desktop\torncity\torncityprojects\bot && node bot.js"

REM — 2) Cloudflare tunnel window —
start "Cloudflare Tunnel" cmd /k ^
  "cd /d C:\Users\TFO\OneDrive\Desktop\torncity\torncityprojects\server && ^
   cloudflared tunnel --config ""C:\Users\TFO\OneDrive\Desktop\torncity\torncityprojects\server\.cloudflared\config.yml"" run tornpanel"

pause
