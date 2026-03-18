# Finding dSYM Settings in Xcode - Step by Step

## Step-by-Step Instructions

### 1. Open Xcode Project
```bash
cd meal-tracking-ios/app
open ios/Joul.xcworkspace
```

### 2. Navigate to Build Settings

**Method A: Via Project Navigator**
1. In the **left sidebar**, click on **"Joul"** (blue project icon at the top)
2. In the **main area**, you'll see "PROJECT" and "TARGETS" sections
3. Under **"TARGETS"**, click on **"Joul"** (the app target, not the project)
4. Click the **"Build Settings"** tab at the top
5. Make sure **"All"** is selected (not "Basic" or "Customized")

**Method B: Via Menu**
1. Select **Joul** target in left sidebar
2. Menu: **View** → **Navigators** → **Show Project Navigator** (if not visible)
3. Click **"Joul"** project → **"Joul"** target → **"Build Settings"** tab

### 3. Find "Debug Information Format"

**Option 1: Search Box**
1. At the top of Build Settings, there's a **search box**
2. Type: `debug information format` (or just `debug`)
3. You should see **"Debug Information Format"** appear
4. Make sure you're looking at the **Release** column (not Debug)

**Option 2: Manual Navigation**
1. Scroll down to find **"Code Generation"** section
2. Look for **"Debug Information Format"**
3. Or look under **"Build Options"** section

**What to Set:**
- **Debug**: `DWARF` (default, fine)
- **Release**: `DWARF with dSYM File` ← **This is what you need**

### 4. Find "Generate Debug Symbols"

**Search for:**
- Type in search box: `generate debug symbols` or `gcc_generate`
- Look for **"GCC_GENERATE_DEBUGGING_SYMBOLS"** or **"Generate Debug Symbols"**

**What to Set:**
- Should be **"Yes"** for Release

### 5. Find "Copy Phase Strip"

**Search for:**
- Type: `copy phase strip` or `strip`
- Look for **"COPY_PHASE_STRIP"** or **"Copy Phase Strip"**

**What to Set:**
- **Release**: `NO` (prevents symbol stripping)

## Visual Guide

When you're in Build Settings, you should see columns like:
```
Setting Name          | Debug | Release
----------------------|-------|--------
Debug Information... | DWARF | [SET THIS]
```

## If You Still Can't Find Them

### Alternative: Edit project.pbxproj Directly

If the settings don't appear in Xcode UI, you can edit the project file directly:

1. **Close Xcode** (important!)
2. Open `ios/Joul.xcodeproj/project.pbxproj` in a text editor
3. Find the Release configuration (search for `Release`)
4. Add these lines to the Release buildSettings:
   ```
   DEBUG_INFORMATION_FORMAT = "dwarf-with-dsym";
   GCC_GENERATE_DEBUGGING_SYMBOLS = YES;
   COPY_PHASE_STRIP = NO;
   ```
5. Save and reopen Xcode

### Or Use Terminal Command

You can also set these via command line:

```bash
cd meal-tracking-ios/app/ios

# Set Debug Information Format for Release
xcodebuild -workspace Joul.xcworkspace \
  -scheme Joul \
  -configuration Release \
  -showBuildSettings | grep DEBUG_INFORMATION_FORMAT

# To set it (requires editing project.pbxproj or using xcconfig)
```

## Verify Settings Are Applied

After setting:
1. **Clean Build Folder**: Product → Clean Build Folder (`Cmd + Shift + K`)
2. **Build**: Product → Build (`Cmd + B`)
3. Check build log for: `GenerateDSYMFile` messages
4. **Archive**: Product → Archive
5. Check archive contents for `dSYMs` folder

## Quick Check: Are Settings Already Set?

Run this to check current settings:

```bash
cd meal-tracking-ios/app/ios
xcodebuild -workspace Joul.xcworkspace \
  -scheme Joul \
  -configuration Release \
  -showBuildSettings | grep -E "DEBUG_INFORMATION_FORMAT|GCC_GENERATE|COPY_PHASE_STRIP"
```

You should see:
- `DEBUG_INFORMATION_FORMAT = dwarf-with-dsym`
- `GCC_GENERATE_DEBUGGING_SYMBOLS = YES`
- `COPY_PHASE_STRIP = NO`

## Troubleshooting

### Settings Don't Appear
- Make sure you're looking at **"All"** settings (not "Basic")
- Try switching between "Combined" and "Levels" view (buttons at top)
- Make sure you selected the **target** (Joul), not the project

### Settings Are Grayed Out
- They might be inherited from project-level settings
- Check PROJECT settings (above TARGETS) as well
- You may need to click the arrow to expand and set at target level

### Still Can't Find
- The settings might have different names in your Xcode version
- Try searching for: `dwarf`, `dsym`, `symbol`, `strip`
- Check Xcode version: Xcode → About Xcode

## What If I Skip This?

**You can still submit to App Store** - these warnings won't block submission.

However:
- ❌ Crash reports will be harder to debug
- ❌ You'll see memory addresses instead of file names/line numbers
- ✅ But the app will work fine

**Recommendation**: Try to fix it, but don't let it block your launch if it's too difficult. You can always upload dSYMs manually later or fix it in a future update.
