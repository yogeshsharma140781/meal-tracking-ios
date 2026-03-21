#!/usr/bin/env bash
# Double-click in Finder (macOS) to start Metro with bundled Node + LAN.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/.."
bash "$DIR/kill-metro-if-running.sh"
exec env -u CI bash "$DIR/with-bundled-node.sh" npx expo start --lan --clear --port 8081
