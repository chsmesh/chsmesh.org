#!/usr/bin/env bash
set -euo pipefail

# Host-level updater for chsmesh.org.
# Run on the Docker host (not inside a container).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_ROOT"

docker compose -f docker-compose.server.yml pull chsmesh
docker compose -f docker-compose.server.yml up -d chsmesh

echo "Updated chsmesh container via host-level deploy flow."
