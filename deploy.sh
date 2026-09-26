#!/usr/bin/env bash
# Run on the VM from ~/showerbrawl: pulls main, rebuilds and restarts the app.
set -euo pipefail
cd "$(dirname "$0")"

git pull --ff-only
# SHA du commit deploye, injecte dans l'image puis expose sur /health.
export GIT_SHA="$(git rev-parse --short HEAD)"
export DOCKER_BUILDKIT=1 COMPOSE_DOCKER_CLI_BUILD=1
docker compose up -d --build
# Nettoie les anciennes images pendantes (le cache de build est garde).
docker image prune -f >/dev/null 2>&1 || true

for i in $(seq 1 30); do
  if curl -fsS http://127.0.0.1:3000/health | grep -q "\"sha\":\"$GIT_SHA\""; then
    curl -fsS http://127.0.0.1:3000/health
    echo && echo "Deployed $GIT_SHA: https://showerbrawl.doodsito.com"
    exit 0
  fi
  sleep 1
done
echo "Health check failed (sha attendu $GIT_SHA)" >&2
curl -sS http://127.0.0.1:3000/health >&2 || true
docker compose logs --tail=50 app
exit 1
