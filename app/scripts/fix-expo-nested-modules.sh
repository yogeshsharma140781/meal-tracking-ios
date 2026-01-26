#!/bin/sh
set -e

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EXPO_DIR="$ROOT_DIR/node_modules/expo"

if [ ! -d "$EXPO_DIR" ]; then
  echo "Expo not installed; skipping nested module fixes."
  exit 0
fi

link_module() {
  MODULE="$1"
  if [ -d "$ROOT_DIR/node_modules/$MODULE" ]; then
    MODULE_DIR=$(dirname "$MODULE")
    MODULE_NAME=$(basename "$MODULE")
    if [ "$MODULE_DIR" != "." ]; then
      # Scoped package (e.g., @react-native-async-storage/async-storage)
      mkdir -p "$EXPO_DIR/node_modules/$MODULE_DIR"
      rm -rf "$EXPO_DIR/node_modules/$MODULE"
      ln -sf "../../../$MODULE" "$EXPO_DIR/node_modules/$MODULE"
    else
      # Regular package
      mkdir -p "$EXPO_DIR/node_modules"
      rm -rf "$EXPO_DIR/node_modules/$MODULE"
      ln -sf "../../$MODULE" "$EXPO_DIR/node_modules/$MODULE"
    fi
  fi
}

link_module "expo-constants"
link_module "expo-asset"
link_module "expo-file-system"
link_module "expo-font"
link_module "expo-keep-awake"
link_module "babel-preset-expo"
link_module "@react-native-async-storage/async-storage"

echo "Expo nested module symlinks ensured."
