#!/bin/bash
# Fast rollback to latest savepoint
set -e
cd "$(git rev-parse --show-toplevel)"

echo "Reverting uncommitted changes to clean savepoint..."
git restore .
git clean -fd

echo "Working tree restored to clean state."
npm run build --silent || true
