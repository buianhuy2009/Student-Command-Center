#!/bin/bash
# Fast git savepoint creator for vibe coders
set -e
cd "$(git rev-parse --show-toplevel)"

TAG="${1:-checkpoint}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
MESSAGE="savepoint_${TIMESTAMP}_${TAG}"

git stash push -m "$MESSAGE" --include-untracked
git stash apply --quiet

echo "Savepoint created: $MESSAGE"
echo "To restore at any time: ./scripts/revert.sh or git stash pop"
