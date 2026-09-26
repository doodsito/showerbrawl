#!/usr/bin/env bash
# Run on the VM from ~/showerbrawl: updates the code, rebuilds and restarts the app.
#   ./deploy.sh          -> deploie le dernier main (usage normal, push sur main)
#   ./deploy.sh <sha>    -> rollback: redeploie ce commit precis
# Via la cle SSH restreinte (commande forcee), le sha arrive dans SSH_ORIGINAL_COMMAND.
set -euo pipefail

# Le checkout d'un autre commit peut reecrire ce fichier pendant qu'il tourne:
# on s'execute depuis une copie temporaire.
if [ -z "${SB_DEPLOY_COPY:-}" ]; then
  export SB_DEPLOY_DIR="$(cd "$(dirname "$0")" && pwd)"
  copy="$(mktemp /tmp/sb-deploy.XXXXXX)"
  cp "$0" "$copy"
  SB_DEPLOY_COPY="$copy" exec bash "$copy" "$@"
fi
trap 'rm -f "$SB_DEPLOY_COPY"' EXIT
cd "$SB_DEPLOY_DIR"

# SHA demande: argument explicite (doit etre un sha valide), sinon dernier mot de la commande SSH
# d'origine s'il ressemble a un sha (sinon ignore: deploiement normal).
REQ="${1:-}"
if [ -n "$REQ" ] && ! [[ "$REQ" =~ ^[0-9a-f]{7,40}$ ]]; then echo "SHA invalide: $REQ" >&2; exit 2; fi
if [ -z "$REQ" ] && [ -n "${SSH_ORIGINAL_COMMAND:-}" ]; then
  last="${SSH_ORIGINAL_COMMAND##* }"
  [[ "$last" =~ ^[0-9a-f]{7,40}$ ]] && REQ="$last"
fi

git fetch --quiet origin main
if [ -n "$REQ" ]; then
  echo "Rollback vers $REQ"
  git cat-file -e "$REQ^{commit}" 2>/dev/null || git fetch --quiet origin "$REQ"
  git checkout --quiet --detach "$REQ"
else
  # Revient sur main meme apres un rollback (HEAD detache).
  git checkout --quiet main
  git merge --ff-only --quiet origin/main
fi

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
