#!/usr/bin/env bash
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js is not installed. Install the LTS version from https://nodejs.org then run this again."; exit 1
fi
[ -d node_modules ] || { echo "Installing for the first time (1-2 minutes)..."; npm install; }
echo "Starting Punch Prime on http://localhost:3000  (press Ctrl+C to stop)"
( sleep 8; (command -v open >/dev/null && open http://localhost:3000) || (command -v xdg-open >/dev/null && xdg-open http://localhost:3000) ) >/dev/null 2>&1 &
npm run dev
