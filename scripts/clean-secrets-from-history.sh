#!/bin/bash
# Script to remove secrets from git history
# Run this AFTER committing the .gitignore changes

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

echo "=== Secret Cleanup Script ==="
echo "Repository: $REPO_DIR"
echo ""

# Files to remove from history
FILES_TO_REMOVE=(
    "docker-compose.yml"
    "docker-compose.uat.yml"
    "docker-compose.staging.yml"
    "docker-compose.production.yml"
    "docker-compose.prod.yml"
    "docker-compose.uat.local.yml"
    "docker-compose.uat.backup.yml"
    "docker-compose.reportportal.yml"
    ".env.staging"
)

# Use local git-filter-repo
FILTER_REPO="$SCRIPT_DIR/git-filter-repo"

if [ ! -f "$FILTER_REPO" ]; then
    echo "Downloading git-filter-repo..."
    curl -sL https://raw.githubusercontent.com/newren/git-filter-repo/main/git-filter-repo -o "$FILTER_REPO"
    chmod +x "$FILTER_REPO"
fi

echo "Using git-filter-repo from: $FILTER_REPO"
echo ""

# Build paths argument
PATHS_ARGS=""
for file in "${FILES_TO_REMOVE[@]}"; do
    PATHS_ARGS="$PATHS_ARGS --path $file"
done

echo "Files to remove from history:"
for file in "${FILES_TO_REMOVE[@]}"; do
    echo "  - $file"
done
echo ""

read -p "This will REWRITE git history. Continue? (y/N) " -n 1 -r
echo
if [[ ! $REPLY =~ ^[Yy]$ ]]; then
    echo "Aborted."
    exit 1
fi

cd "$REPO_DIR"

echo ""
echo "Running git-filter-repo..."
python3 "$FILTER_REPO" $PATHS_ARGS --invert-paths --force

echo ""
echo "=== DONE ==="
echo ""
echo "Now force push to remote:"
echo "  git push origin --force --all"
echo "  git push origin --force --tags"
echo ""
echo "=== IMPORTANT ==="
echo "After force pushing, all team members must:"
echo "  git fetch --all"
echo "  git reset --hard origin/<branch>"
echo ""
echo "ROTATE THESE SECRETS ASAP:"
echo "  - NEXTAUTH_SECRET"
echo "  - RESEND_API_KEY (re_Yu65NPxp_...)"
echo "  - CRON_SECRET"
echo "  - AZURE_AD credentials if concerned"
