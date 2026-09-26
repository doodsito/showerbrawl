#!/usr/bin/env bash
# Run on the VM from ~/showerbrawl: pulls main, rebuilds and restarts the app.
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only
docker compose up -d --build

for i in $(seq 1 15); do
  if curl -fsS http://127.0.0.1:3000/health; then
    echo && echo "Deployed: https://showerbrawl.doodsito.com"
    exit 0
  fi
  sleep 1
done
echo "Health check failed" >&2
docker compose logs --tail=50 app
exit 1
