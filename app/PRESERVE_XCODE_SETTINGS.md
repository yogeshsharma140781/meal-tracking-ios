# How to Preserve Xcode Settings

## The Problem

When you run `npx expo prebuild --clean`, Expo regenerates the entire iOS project, which **wipes out** any manual changes you made in Xcode, including:
- App icon changes in `Images.xcassets`
- Development Team ID
- StoreKit Configuration files
- Scheme settings (like StoreKit config selection)
- Other Xcode-specific configurations

## Solutions

### 1. **Avoid Using `--clean` Flag** (Easiest)

Instead of:
```bash
npx expo prebuild --platform ios --clean
```

Use:
```bash
npx expo prebuild --platform ios
```

The `--clean` flag deletes everything and regenerates from scratch. Without it, Expo will try to preserve existing files.

### 2. **Configure Settings in `app.json`** (Recommended)

Add iOS-specific settings to `app.json`:

```json
{
  "expo": {
    "ios": {
      "bundleIdentifier": "com.anonymous.meal-tracking",
      "icon": "./assets/icon.png",
      "buildNumber": "1",
      "config": {
        "usesNonExemptEncryption": false
      }
    }
  }
}
```

### 3. **Use Environment Variables for Team ID**

Set your development team ID via environment variable:

```bash
export EXPO_IOS_DEVELOPMENT_TEAM=UHY6Q34C63
npx expo prebuild --platform ios
```

Or add to your `.env` file:
```
EXPO_IOS_DEVELOPMENT_TEAM=UHY6Q34C63
```

### 4. **Preserve StoreKit Configuration**

StoreKit files (`.storekit`) are **NOT** preserved by Expo prebuild. To keep them:

**Option A: Keep StoreKit file outside `ios/` folder**
1. Create `Products.storekit` in the root `app/` folder
2. Manually copy it to `ios/` after each prebuild
3. Or create a script to copy it automatically

**Option B: Use a post-prebuild script**
Create `scripts/post-prebuild.sh`:
```bash
#!/bin/bash
# Copy StoreKit config if it exists
if [ -f "Products.storekit" ]; then
  cp Products.storekit ios/Products.storekit
  echo "Copied StoreKit configuration"
fi
```

Then run:
```bash
npx expo prebuild --platform ios && sh scripts/post-prebuild.sh
```

### 5. **Preserve App Icon Changes**

**Option A: Update source icon**
- Replace `./assets/icon.png` with your new icon
- Expo will use it during prebuild

**Option B: Manual copy after prebuild**
- Keep your modified `Images.xcassets` in a backup location
- Copy it back after prebuild

### 6. **Use Git to Track Changes**

1. **Commit your Xcode changes:**
   ```bash
   git add ios/
   git commit -m "Xcode settings: team ID, StoreKit config, app icon"
   ```

2. **After prebuild, restore if needed:**
   ```bash
   git checkout ios/Joul.xcodeproj/project.pbxproj  # Restore team ID
   git checkout ios/Products.storekit  # Restore StoreKit config
   ```

### 7. **Create a Custom Config Plugin** (Advanced)

I've created `app.plugin.js` that preserves the development team ID. To use it:

1. Add to `app.json` plugins array:
   ```json
   {
     "plugins": [
       "./app.plugin.js",
       // ... other plugins
     ]
   }
   ```

2. The plugin will automatically set the team ID during prebuild

## Best Practices

1. **Only use `--clean` when absolutely necessary** (e.g., major dependency changes)
2. **Configure as much as possible in `app.json`** instead of Xcode
3. **Keep Xcode-specific files in version control** (StoreKit configs, custom assets)
4. **Use environment variables** for sensitive settings like team IDs
5. **Document manual steps** needed after prebuild in a README

## Quick Reference

**To preserve settings:**
- ✅ Use `npx expo prebuild` (without `--clean`)
- ✅ Configure in `app.json`
- ✅ Use environment variables
- ✅ Keep custom files in git

**Will be lost:**
- ❌ StoreKit Configuration files (unless manually preserved)
- ❌ Scheme-specific settings (unless configured via plugin)
- ❌ Manual Xcode project edits (unless in config plugin)

## Practical Workflow

### After Making Xcode Changes:

1. **Backup your StoreKit config:**
   ```bash
   cp ios/Products.storekit Products.storekit.backup
   ```

2. **Backup custom assets:**
   ```bash
   cp -r ios/Joul/Images.xcassets ios-assets-backup
   ```

3. **Commit to git:**
   ```bash
   git add ios/
   git commit -m "Xcode settings: StoreKit config, custom assets"
   ```

### When Running Prebuild:

**Option 1: Without --clean (Recommended)**
```bash
npx expo prebuild --platform ios
# Then restore backups if needed:
sh scripts/post-prebuild.sh
```

**Option 2: With --clean (when necessary)**
```bash
npx expo prebuild --platform ios --clean
# Then restore backups:
sh scripts/post-prebuild.sh
# Or restore from git:
git checkout ios/Products.storekit
```

### Set Team ID via Environment Variable:

Add to your `.env` file:
```
EXPO_IOS_DEVELOPMENT_TEAM=UHY6Q34C63
```

The config plugin (`app.plugin.js`) will automatically apply this during prebuild.

## Current Setup

Your project has:
- ✅ **Config Plugin**: `app.plugin.js` preserves team ID automatically
- ✅ **Development Team ID**: `UHY6Q34C63` (will be preserved via plugin)
- ✅ **App icon**: Configured via `app.json` → `ios.icon`
- ⚠️ **StoreKit**: Use backup/restore workflow (see above)
- ✅ **Post-prebuild script**: `scripts/post-prebuild.sh` ready to use
