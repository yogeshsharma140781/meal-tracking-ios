#!/usr/bin/env bash
# Stop an existing Expo / Metro bundler on the default port so the next start is a true restart.
# Safe to run when nothing is listening (no-op).
#
# Override port: EXPO_METRO_PORT=8082 bash scripts/kill-metro-if-running.sh

PORT="${EXPO_METRO_PORT:-8081}"

if ! command -v lsof >/dev/null 2>&1; then
  exit 0
fi

PIDS=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -z "${PIDS}" ]; then
  exit 0
fi

echo "[metro] Stopping existing listener(s) on port ${PORT}: ${PIDS}"
kill ${PIDS} 2>/dev/null || true
sleep 0.75

PIDS2=$(lsof -tiTCP:"$PORT" -sTCP:LISTEN 2>/dev/null || true)
if [ -n "${PIDS2}" ]; then
  echo "[metro] Force stopping: ${PIDS2}"
  kill -9 ${PIDS2} 2>/dev/null || true
fi
