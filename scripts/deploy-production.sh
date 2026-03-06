#!/bin/bash
# Production deployment script — preserves logs across rebuilds
set -e

COMPOSE_FILE="docker-compose.production.yml"
CONTAINER="leave-management-app-production"
LOG_DIR="./logs/production"

mkdir -p "$LOG_DIR"

# Save current container logs before rebuilding
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER}$"; then
  TIMESTAMP=$(date +%Y%m%d-%H%M%S)
  echo "Saving logs from current container..."
  docker logs "$CONTAINER" > "${LOG_DIR}/app-${TIMESTAMP}.log" 2>&1 || true
  echo "Logs saved to ${LOG_DIR}/app-${TIMESTAMP}.log"

  # Keep only last 20 log files
  ls -t "${LOG_DIR}"/app-*.log 2>/dev/null | tail -n +21 | xargs -r rm --
fi

# Rebuild and deploy
echo "Building and deploying..."
docker compose -f "$COMPOSE_FILE" up -d --build app-production

echo "Waiting for container to start..."
sleep 5

# Verify
if docker ps --filter "name=${CONTAINER}" --filter "status=running" -q | grep -q .; then
  echo "Deployment successful. Container is running."
else
  echo "WARNING: Container may not be running. Check: docker ps"
  exit 1
fi
