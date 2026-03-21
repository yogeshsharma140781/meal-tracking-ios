#!/usr/bin/env bash
# Prepends the repo's bundled Node (meal-tracking-ios/.tools/...) to PATH so npm/npx work
# even when your shell doesn't load nvm/Homebrew.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# app/scripts -> app -> meal-tracking-ios
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TOOLS_BIN="$REPO_ROOT/.tools/node-v20.20.1-darwin-arm64/bin"
if [[ ! -x "$TOOLS_BIN/node" ]]; then
  echo "Bundled Node not found at:"
  echo "  $TOOLS_BIN"
  echo "Restore the folder meal-tracking-ios/.tools/node-v20.20.1-darwin-arm64 or install Node from https://nodejs.org"
  exit 1
fi
export PATH="$TOOLS_BIN:$PATH"
cd "$(cd "$SCRIPT_DIR/.." && pwd)"
exec "$@"
