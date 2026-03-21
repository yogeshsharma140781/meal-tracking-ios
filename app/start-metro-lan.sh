#!/usr/bin/env bash
# No global npm required — uses bundled Node in meal-tracking-ios/.tools/
cd "$(dirname "$0")"
exec bash scripts/with-bundled-node.sh npx expo start --lan --clear
