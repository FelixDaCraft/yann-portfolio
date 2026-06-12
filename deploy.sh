#!/usr/bin/env bash
# Deploy script — runs on the homelab.
# Usage (depuis Windows) :
#   ssh -i ~/.ssh/id_ed25519 root@192.168.1.122 "bash /opt/yann-portfolio/deploy.sh"

set -euo pipefail

cd "$(dirname "$0")"

# Secrets du backoffice (yann-api) — jamais dans Git.
if [[ ! -f .env ]]; then
  echo "✗ /opt/yann-portfolio/.env manquant (ADMIN_PASSWORD, SESSION_SECRET)" >&2
  echo "  À créer : printf 'ADMIN_PASSWORD=...\nSESSION_SECRET=%s\n' \"\$(openssl rand -hex 32)\" > .env" >&2
  exit 1
fi

echo "→ git pull"
git fetch --all
git reset --hard origin/main

echo "→ docker compose up -d --build"
docker compose up -d --build

echo "→ wait for healthcheck"
sleep 4
docker ps --filter "name=yann-" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
curl -fsS http://127.0.0.1:3019/api/health >/dev/null && echo "✓ api healthy" || { echo "✗ api KO"; exit 1; }

echo "✓ deployed · https://yann.aynn.fr"
