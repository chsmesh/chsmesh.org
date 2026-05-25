#!/usr/bin/env bash
set -euo pipefail

# Host-level updater for chsmesh.org.
# Run on the Docker host (not inside a container).

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="docker-compose.server.yml"

cd "$PROJECT_ROOT"

if ! docker compose -f "$COMPOSE_FILE" pull chsmesh; then
  echo "Failed to pull the pinned chsmesh image." >&2
  exit 1
fi

image_ref="$(docker compose -f "$COMPOSE_FILE" config --images | head -n 1)"
if [[ -z "$image_ref" ]]; then
  echo "Unable to determine the chsmesh image reference from $COMPOSE_FILE." >&2
  exit 1
fi

if ! docker image inspect "$image_ref" >/dev/null 2>&1; then
  echo "Pulled chsmesh image is not available locally: $image_ref" >&2
  exit 1
fi

docker compose -f "$COMPOSE_FILE" up -d chsmesh

echo "Updated chsmesh container via host-level deploy flow."
