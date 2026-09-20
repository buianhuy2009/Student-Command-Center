#!/bin/bash
# Pre-flight check before shipping/pushing code
set -e
cd "$(git rev-parse --show-toplevel)"

echo "=== 1/4 Multi-Agent Sync Check ==="
git fetch origin
BEHIND=$(git log --oneline HEAD..origin/main | wc -l | tr -d ' ')
if [ "$BEHIND" -gt 0 ]; then
    echo "Warning: Local branch is behind origin/main by $BEHIND commits."
    echo "Run: git pull --no-rebase origin main first."
    exit 1
fi
echo "Local branch is up to date with origin/main."

echo "=== 2/4 TypeScript Strict Lint ==="
npm run lint

echo "=== 3/4 Unit Tests ==="
npm test

echo "=== 4/4 Production Bundle Build ==="
npm run build

echo "Pre-flight checks passed! Safe to ship."
