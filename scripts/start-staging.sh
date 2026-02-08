#!/bin/bash

# Start Staging Environment
# This script starts the isolated staging environment for testing

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "==================================================="
echo "  Leave Management - Staging Environment"
echo "==================================================="
echo ""

# Check if .env.staging exists
if [ ! -f ".env.staging" ]; then
    echo "Warning: .env.staging not found."
    echo "Creating from template. Please configure before use."
    echo ""
fi

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "Error: Docker is not running. Please start Docker first."
    exit 1
fi

# Parse arguments
BUILD_FLAG=""
DETACH_FLAG="-d"
FOLLOW_LOGS=""

while [[ "$#" -gt 0 ]]; do
    case $1 in
        --build) BUILD_FLAG="--build" ;;
        --foreground|-f) DETACH_FLAG="" ;;
        --logs|-l) FOLLOW_LOGS="true" ;;
        --down)
            echo "Stopping staging environment..."
            docker-compose -f docker-compose.staging.yml down
            echo "Staging environment stopped."
            exit 0
            ;;
        --clean)
            echo "Stopping and removing staging environment (including volumes)..."
            docker-compose -f docker-compose.staging.yml down -v
            echo "Staging environment cleaned."
            exit 0
            ;;
        --status)
            echo "Staging environment status:"
            docker-compose -f docker-compose.staging.yml ps
            exit 0
            ;;
        --help|-h)
            echo "Usage: $0 [options]"
            echo ""
            echo "Options:"
            echo "  --build       Rebuild containers before starting"
            echo "  --foreground  Run in foreground (don't detach)"
            echo "  --logs, -l    Follow logs after starting"
            echo "  --down        Stop staging environment"
            echo "  --clean       Stop and remove volumes (data loss!)"
            echo "  --status      Show container status"
            echo "  --help, -h    Show this help message"
            echo ""
            echo "Ports:"
            echo "  App:      http://localhost:8082"
            echo "  Database: localhost:5482"
            echo "  Redis:    localhost:6382"
            echo "  MinIO:    http://localhost:9103 (API), http://localhost:9104 (Console)"
            echo "  Adminer:  http://localhost:8182"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            echo "Use --help for usage information"
            exit 1
            ;;
    esac
    shift
done

echo "Starting staging containers..."
echo ""

docker-compose -f docker-compose.staging.yml up $BUILD_FLAG $DETACH_FLAG

if [ -n "$DETACH_FLAG" ]; then
    echo ""
    echo "==================================================="
    echo "  Staging environment started!"
    echo "==================================================="
    echo ""
    echo "Services:"
    echo "  App:      http://localhost:8082"
    echo "  Database: localhost:5482 (PostgreSQL)"
    echo "  Redis:    localhost:6382"
    echo "  MinIO:    http://localhost:9103 (API)"
    echo "            http://localhost:9104 (Console)"
    echo "  Adminer:  http://localhost:8182"
    echo ""
    echo "Commands:"
    echo "  View logs:  docker-compose -f docker-compose.staging.yml logs -f"
    echo "  Stop:       ./scripts/start-staging.sh --down"
    echo "  Status:     ./scripts/start-staging.sh --status"
    echo ""

    if [ "$FOLLOW_LOGS" = "true" ]; then
        echo "Following logs (Ctrl+C to stop)..."
        docker-compose -f docker-compose.staging.yml logs -f
    fi
fi
