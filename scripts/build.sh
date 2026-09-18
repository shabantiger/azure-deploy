#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_DIR"

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🔨 Building azure-deploy-action"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

echo ""
echo "📦 Installing dependencies..."
npm ci

echo ""
echo "🔍 Type-checking..."
npm run lint

echo ""
echo "🧪 Running tests..."
npm test

echo ""
echo "🏗️  Compiling to dist/..."
npm run build

echo ""
echo "✅ Build complete!"
echo "   Entry point: dist/main.js"
echo "   $(du -sh dist/main.js | cut -f1) compiled bundle"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
