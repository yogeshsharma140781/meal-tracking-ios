#!/bin/bash
# Post-prebuild script to restore Xcode settings that get wiped by prebuild

echo "Running post-prebuild script..."

# Restore StoreKit Configuration
# Try backup first, then git, then check for existing file
if [ -f "Products.storekit.backup" ]; then
  cp Products.storekit.backup ios/Products.storekit
  echo "✓ Restored StoreKit configuration from backup"
elif [ -f "Joul.storekit.backup" ]; then
  cp Joul.storekit.backup ios/Joul.storekit
  echo "✓ Restored StoreKit configuration from backup (Joul.storekit)"
elif git ls-files --error-unmatch ios/Joul.storekit >/dev/null 2>&1; then
  git checkout ios/Joul.storekit
  echo "✓ Restored StoreKit configuration from git (Joul.storekit)"
elif git ls-files --error-unmatch ios/Products.storekit >/dev/null 2>&1; then
  git checkout ios/Products.storekit
  echo "✓ Restored StoreKit configuration from git (Products.storekit)"
fi

# Restore custom app icon assets if backup exists
if [ -d "ios-assets-backup" ]; then
  cp -r ios-assets-backup/* ios/Joul/Images.xcassets/ 2>/dev/null
  echo "✓ Restored custom app icon assets"
fi

echo "Post-prebuild script completed"
