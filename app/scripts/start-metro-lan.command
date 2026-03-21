#!/usr/bin/env bash
# Double-click in Finder (macOS) to start Metro with bundled Node + LAN.
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/.."
exec bash "$DIR/with-bundled-node.sh" npx expo start --lan --clear
