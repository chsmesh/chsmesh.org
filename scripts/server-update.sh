#!/usr/bin/env bash
set -euo pipefail

# Host-level updater for chsmesh.org.
# Run on the Docker host (not inside a container). Fast-forwards the checkout,
# rebuilds both images from it and restarts whatever changed.

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="docker-compose.server.yml"

cd "$PROJECT_ROOT"

if [[ ! -f .env ]]; then
  echo "Missing .env: copy .env.example to .env and fill it in first." >&2
  exit 1
fi

if [[ "${SKIP_GIT_PULL:-}" != 1 ]]; then
  if ! git pull --ff-only; then
    echo "git pull --ff-only failed; resolve the checkout or rerun with SKIP_GIT_PULL=1." >&2
    exit 1
  fi
fi

if ! docker compose -f "$COMPOSE_FILE" build; then
  echo "Failed to build the chsmesh images." >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d --remove-orphans

echo "Deployed $(git rev-parse --short HEAD) via host-level deploy flow."
