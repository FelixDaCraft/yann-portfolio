#!/usr/bin/env bash
# Deploy script — runs on the homelab.
# Usage (depuis Windows) :
#   ssh -i ~/.ssh/id_ed25519 root@192.168.1.122 "bash /opt/yann-portfolio/deploy.sh"

set -euo pipefail

cd "$(dirname "$0")"

echo "→ git pull"
git fetch --all
git reset --hard origin/main

echo "→ docker compose up -d --build"
docker compose up -d --build

echo "→ wait for healthcheck"
sleep 4
docker ps --filter "name=yann-portfolio" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

echo "✓ deployed · https://yann.aynn.fr"
