#!/bin/bash

# Hetzner VPS Deployment Script for Leave Management
# Usage: ./deploy-hetzner.sh [uat|staging|production]

set -e  # Exit on any error

# Configuration
PROJECT_DIR="/opt/leave-management/leave"
BACKUP_DIR="/opt/leave-management/configs"
ENVIRONMENT=${1:-uat}

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🚀 Starting deployment for ${ENVIRONMENT^^} environment...${NC}"

# Validate environment
if [[ ! "$ENVIRONMENT" =~ ^(uat|staging|production)$ ]]; then
    echo -e "${RED}❌ Error: Environment must be uat, staging, or production${NC}"
    exit 1
fi

# Change to project directory
cd "$PROJECT_DIR"

echo -e "${YELLOW}📁 Working in: $(pwd)${NC}"

# Backup current credentials if they exist
COMPOSE_FILE="docker-compose.${ENVIRONMENT}.yml"
BACKUP_FILE="${BACKUP_DIR}/${ENVIRONMENT}-credentials-$(date +%Y%m%d-%H%M%S).yml"

if [[ -f "$COMPOSE_FILE" ]]; then
    echo -e "${YELLOW}💾 Backing up current credentials...${NC}"
    mkdir -p "$BACKUP_DIR"
    cp "$COMPOSE_FILE" "$BACKUP_FILE"
    echo -e "${GREEN}✅ Backed up to: $BACKUP_FILE${NC}"
fi

# Pull latest changes
echo -e "${YELLOW}📡 Pulling latest changes from GitHub...${NC}"
git stash push -m "Auto-stash before deployment $(date)" || true
git pull origin develop
echo -e "${GREEN}✅ Code updated${NC}"

# Restore credentials if backup exists
LATEST_BACKUP=$(ls -t ${BACKUP_DIR}/${ENVIRONMENT}-credentials-*.yml 2>/dev/null | head -1)
if [[ -f "$LATEST_BACKUP" ]]; then
    echo -e "${YELLOW}🔐 Restoring credentials from backup...${NC}"
    
    # Extract just the credential values from backup
    NEXTAUTH_URL=$(grep "NEXTAUTH_URL=" "$LATEST_BACKUP" | cut -d'=' -f2-)
    AZURE_CLIENT_ID=$(grep "AZURE_AD_CLIENT_ID=" "$LATEST_BACKUP" | cut -d'=' -f2-)
    AZURE_CLIENT_SECRET=$(grep "AZURE_AD_CLIENT_SECRET=" "$LATEST_BACKUP" | cut -d'=' -f2-)
    AZURE_TENANT_ID=$(grep "AZURE_AD_TENANT_ID=" "$LATEST_BACKUP" | cut -d'=' -f2-)
    
    # Update the new compose file with real credentials
    if [[ -n "$NEXTAUTH_URL" ]]; then
        sed -i "s|NEXTAUTH_URL=.*|NEXTAUTH_URL=$NEXTAUTH_URL|g" "$COMPOSE_FILE"
    fi
    if [[ -n "$AZURE_CLIENT_ID" ]]; then
        sed -i "s|AZURE_AD_CLIENT_ID=.*|AZURE_AD_CLIENT_ID=$AZURE_CLIENT_ID|g" "$COMPOSE_FILE"
    fi
    if [[ -n "$AZURE_CLIENT_SECRET" ]]; then
        sed -i "s|AZURE_AD_CLIENT_SECRET=.*|AZURE_AD_CLIENT_SECRET=$AZURE_CLIENT_SECRET|g" "$COMPOSE_FILE"
    fi
    if [[ -n "$AZURE_TENANT_ID" ]]; then
        sed -i "s|AZURE_AD_TENANT_ID=.*|AZURE_AD_TENANT_ID=$AZURE_TENANT_ID|g" "$COMPOSE_FILE"
    fi
    
    echo -e "${GREEN}✅ Credentials restored${NC}"
else
    echo -e "${YELLOW}⚠️  No credential backup found. You may need to edit $COMPOSE_FILE manually.${NC}"
fi

# Deploy the application
echo -e "${YELLOW}🐳 Deploying ${ENVIRONMENT^^} environment...${NC}"
docker compose -f "$COMPOSE_FILE" up -d --build

# Check deployment status
echo -e "${YELLOW}🔍 Checking deployment status...${NC}"
sleep 5
docker compose -f "$COMPOSE_FILE" ps

# Show service URLs
echo -e "${GREEN}✅ Deployment complete!${NC}"
echo -e "${BLUE}📱 Service URLs:${NC}"

case $ENVIRONMENT in
    uat)
        echo -e "  • Application: http://$(hostname -I | awk '{print $1}'):9001"
        echo -e "  • Adminer:     http://$(hostname -I | awk '{print $1}'):8181"
        echo -e "  • Minio Console: http://$(hostname -I | awk '{print $1}'):9102"
        ;;
    staging)
        echo -e "  • Application: http://$(hostname -I | awk '{print $1}'):8082"
        echo -e "  • Adminer:     http://$(hostname -I | awk '{print $1}'):8182"
        echo -e "  • Minio Console: http://$(hostname -I | awk '{print $1}'):9202"
        ;;
    production)
        echo -e "  • Application: http://$(hostname -I | awk '{print $1}'):8083"
        echo -e "  • Adminer:     http://$(hostname -I | awk '{print $1}'):8183"
        echo -e "  • Minio Console: http://$(hostname -I | awk '{print $1}'):9203"
        ;;
esac

echo -e "${BLUE}📊 View logs: docker compose -f $COMPOSE_FILE logs -f app${NC}"
echo -e "${BLUE}🛑 Stop services: docker compose -f $COMPOSE_FILE down${NC}"