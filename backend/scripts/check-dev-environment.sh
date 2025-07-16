#!/bin/bash
set -euo pipefail

# Safety script to ensure we're not running dev-only commands against production
# This script should be called before any dev-only database operations

# Check if we're explicitly in production mode
if [[ "${WRANGLER_ENV:-}" == "production" ]]; then
    echo "❌ ERROR: Cannot run dev-only commands in production environment!"
    echo "   WRANGLER_ENV is set to 'production'"
    exit 1
fi

# Check if --remote flag is being used
if [[ "${@}" == *"--remote"* ]]; then
    echo "❌ ERROR: Cannot run dev-only commands with --remote flag!"
    echo "   This would affect real Cloudflare resources"
    exit 1
fi

# Check if --env production is being used
if [[ "${@}" == *"--env production"* ]]; then
    echo "❌ ERROR: Cannot run dev-only commands with --env production!"
    exit 1
fi

# Additional safety: Check if .wrangler directory exists (indicates local dev)
if [[ ! -d ".wrangler" ]]; then
    echo "⚠️  WARNING: No .wrangler directory found."
    echo "   This might indicate you're not in a local development environment."
    echo "   Proceeding with caution..."
fi

echo "✅ Safe to proceed - running in local development mode"