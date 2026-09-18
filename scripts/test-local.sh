#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# test-local.sh — Run azure-deploy-action locally without GitHub Actions runner
#
# Prerequisites:
#   - Azure CLI installed and authenticated (az login)
#   - Docker installed and running
#   - jq installed
#   - AZURE_CREDENTIALS env var set (JSON from az ad sp create-for-rbac)
#
# Usage:
#   export AZURE_CREDENTIALS='{"clientId":"...","clientSecret":"...","subscriptionId":"...","tenantId":"..."}'
#   export APP_NAME=my-test-app
#   ./scripts/test-local.sh
# ─────────────────────────────────────────────────────────────────────────────
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Validate prerequisites ────────────────────────────────────────────────
echo "🔍 Checking prerequisites..."

for cmd in az docker node npm jq; do
  if ! command -v "$cmd" &>/dev/null; then
    echo "❌ Required command not found: $cmd"
    exit 1
  fi
done

echo "✅ All prerequisites found"

# ── Validate environment ──────────────────────────────────────────────────
if [[ -z "${AZURE_CREDENTIALS:-}" ]]; then
  echo "❌ AZURE_CREDENTIALS environment variable is not set"
  echo ""
  echo "Create a service principal with:"
  echo "  az ad sp create-for-rbac \\"
  echo "    --name my-github-action-sp \\"
  echo "    --role contributor \\"
  echo "    --scopes /subscriptions/<subscription-id> \\"
  echo "    --sdk-auth"
  exit 1
fi

APP_NAME="${APP_NAME:-test-app-$(date +%s)}"
LOCATION="${LOCATION:-eastus}"
RESOURCE_GROUP="${RESOURCE_GROUP:-rg-${APP_NAME}-prod}"

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🚀 Local test run"
echo "   App name:       $APP_NAME"
echo "   Location:       $LOCATION"
echo "   Resource group: $RESOURCE_GROUP"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""

# ── Build if dist/ is stale ───────────────────────────────────────────────
if [[ ! -f "$PROJECT_DIR/dist/main.js" ]]; then
  echo "📦 dist/main.js not found — building..."
  cd "$PROJECT_DIR" && npm run build
fi

# ── Simulate GitHub Actions environment ──────────────────────────────────
export GITHUB_WORKSPACE="${GITHUB_WORKSPACE:-$(pwd)}"
export GITHUB_TOKEN="${GITHUB_TOKEN:-}"
export GITHUB_REPOSITORY="${GITHUB_REPOSITORY:-local/test}"
export GITHUB_SHA="${GITHUB_SHA:-$(git rev-parse HEAD 2>/dev/null || echo 'abc1234')}"
export GITHUB_REF="${GITHUB_REF:-refs/heads/main}"
export GITHUB_RUN_ID="${GITHUB_RUN_ID:-99999}"

# Simulate @actions/core INPUT_ convention
export INPUT_AZURE_CREDENTIALS="$AZURE_CREDENTIALS"
export INPUT_APP_NAME="$APP_NAME"
export INPUT_RESOURCE_GROUP="$RESOURCE_GROUP"
export INPUT_LOCATION="$LOCATION"
export INPUT_STACK="${STACK:-auto}"
export INPUT_POSTGRES="${POSTGRES:-false}"
export INPUT_CPU="${CPU:-0.5}"
export INPUT_MEMORY="${MEMORY:-1Gi}"
export INPUT_MIN_REPLICAS="${MIN_REPLICAS:-1}"
export INPUT_MAX_REPLICAS="${MAX_REPLICAS:-3}"
export INPUT_ENVIRONMENT="${ENVIRONMENT:-production}"
export INPUT_DOCKER_FILE="${DOCKER_FILE:-Dockerfile}"
export INPUT_NOTIFY_SLACK="${NOTIFY_SLACK:-}"
export INPUT_CUSTOM_DOMAIN="${CUSTOM_DOMAIN:-}"
export INPUT_ACR_NAME="${ACR_NAME:-}"
export INPUT_ENV_VARS="${ENV_VARS:-}"
export INPUT_POSTGRES_SKU="${POSTGRES_SKU:-Burstable_B1ms}"

# ── Run ───────────────────────────────────────────────────────────────────
echo "🏃 Running action..."
node "$PROJECT_DIR/dist/main.js"
EXIT_CODE=$?

echo ""
if [[ $EXIT_CODE -eq 0 ]]; then
  echo "✅ Action completed successfully!"
else
  echo "❌ Action failed with exit code $EXIT_CODE"
fi

exit $EXIT_CODE
