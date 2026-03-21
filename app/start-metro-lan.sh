#!/usr/bin/env bash
# No global npm required — uses bundled Node in meal-tracking-ios/.tools/
# Always stops any existing Metro on :8081, then starts with a clean cache.
cd "$(dirname "$0")"
bash scripts/kill-metro-if-running.sh
# Cursor / CI often sets CI=true — that disables Metro Fast Refresh; strip it for local dev.
exec env -u CI bash scripts/with-bundled-node.sh npx expo start --lan --clear --port 8081
