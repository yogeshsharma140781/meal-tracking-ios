# Fix dSYM Upload Warnings

## The Problem

When uploading to App Store Connect, you're seeing warnings about missing dSYM files for:
- `React.framework`
- `ReactNativeDependencies.framework`
- `hermes.framework`

dSYM files are needed for **crash symbolication** - converting crash reports into readable stack traces with file names and line numbers.

## Solution: Configure Xcode to Include dSYMs

### Method 1: Xcode Build Settings (Recommended)

1. **Open Xcode**: `open ios/Joul.xcworkspace`

2. **Select Project**:
   - Click "Joul" project in left sidebar
   - Select "Joul" target
   - Go to "Build Settings" tab

3. **Enable Debug Information**:
   - Search for "Debug Information Format"
   - Set to **"DWARF with dSYM File"** for **Release** configuration
   - Should already be set, but verify

4. **Enable dSYM Generation**:
   - Search for "Generate Debug Symbols"
   - Ensure it's set to **"Yes"** for Release

5. **Copy dSYMs Script** (Most Important):
   - Go to "Build Phases" tab
   - Click "+" → "New Run Script Phase"
   - Name it "Copy dSYMs"
   - Add this script:
   ```bash
   # Copy dSYMs to archive
   if [ "$CONFIGURATION" == "Release" ]; then
     cp -R "${BUILT_PRODUCTS_DIR}/../dSYMs" "${ARCHIVE_DSYMS_PATH}" 2>/dev/null || true
   fi
   ```
   - Move this script to run **after** "Embed Frameworks" phase
   - Uncheck "For install builds only"

### Method 2: Add to app.plugin.js (Expo Config Plugin)

Update your Expo config plugin to ensure dSYMs are generated:

```javascript
const { withXcodeProject } = require("@expo/config-plugins");

module.exports = function withDSYMGeneration(config) {
  return withXcodeProject(config, async (config) => {
    const { modResults } = config;
    const project = modResults;
    
    // Ensure DEBUG_INFORMATION_FORMAT is set for Release
    const configurations = project.pbxXCBuildConfigurationSection();
    Object.keys(configurations).forEach((configId) => {
      if (configId.includes("Release")) {
        const buildSettings = configurations[configId].buildSettings;
        if (buildSettings) {
          buildSettings.DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
          buildSettings.GCC_GENERATE_DEBUGGING_SYMBOLS = "YES";
        }
      }
    });
    
    return config;
  });
};
```

### Method 3: Manual dSYM Upload (Workaround)

If you can't fix the build settings immediately:

1. **After archiving**, find dSYMs:
   - Right-click archive in Xcode Organizer
   - "Show in Finder"
   - Right-click `.xcarchive` → "Show Package Contents"
   - Navigate to `dSYMs` folder

2. **Upload manually**:
   - Go to App Store Connect
   - Your App → TestFlight → Builds
   - Select your build
   - Go to "Crash Reports" or "dSYMs" section
   - Upload dSYM files manually

## Verify dSYMs Are Included

### Check Archive Contents

1. **After archiving in Xcode**:
   - Window → Organizer
   - Right-click your archive → "Show in Finder"
   - Right-click `.xcarchive` → "Show Package Contents"
   - Check `dSYMs` folder contains:
     - `Joul.app.dSYM`
     - `React.framework.dSYM` (if available)
     - `ReactNativeDependencies.framework.dSYM` (if available)
     - `hermes.framework.dSYM` (if available)

### Check Build Log

When building, look for:
```
GenerateDSYMFile /path/to/Joul.app.dSYM
```

## Why This Happens

React Native frameworks (React, Hermes) are often:
- Pre-compiled binaries
- Don't include dSYMs by default
- Need to be configured to generate symbols

## Quick Fix Steps

1. **Open Xcode**: `open ios/Joul.xcworkspace`
2. **Select Joul target** → Build Settings
3. **Search "Debug Information Format"**
4. **Set Release to "DWARF with dSYM File"**
5. **Add Run Script Phase** (see Method 1 above)
6. **Rebuild archive**

## Testing

After fixing:
1. Create a new archive (Product → Archive)
2. Upload to App Store Connect
3. Check upload logs - warnings should be gone
4. Verify dSYMs appear in App Store Connect

## Note

Some frameworks (like React Native dependencies) may not generate dSYMs even with correct settings. This is often acceptable if:
- Your main app dSYM is included
- You can still symbolicate most crashes
- Framework crashes are less common

The warnings won't prevent app submission, but fixing them improves crash reporting.
