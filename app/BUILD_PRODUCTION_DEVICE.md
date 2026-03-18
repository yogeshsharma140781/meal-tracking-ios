# Building Production Release for Physical Device

## Method 1: Using Xcode (Recommended)

### Step 1: Open Xcode Project
```bash
cd meal-tracking-ios/app
open ios/Joul.xcworkspace
```

### Step 2: Configure for Production Build

1. **Select your device** in Xcode (top toolbar, next to scheme selector)
   - Connect your iPhone via USB
   - Select your device from the device list

2. **Select Release Scheme**
   - Click on the scheme dropdown (next to device selector)
   - Select "Joul" scheme
   - Go to: Product → Scheme → Edit Scheme
   - Select "Run" → Info → Build Configuration = **Release**

3. **Verify Signing**
   - Select "Joul" project in left sidebar
   - Select "Joul" target
   - Go to "Signing & Capabilities" tab
   - Ensure "Automatically manage signing" is checked
   - Select your Team
   - Verify Bundle Identifier: `com.anonymous.meal-tracking`

### Step 3: Build and Install

**Option A: Build and Run directly**
- Press `Cmd + R` or click the Play button
- Xcode will build in Release mode and install on your device
- You may need to trust the developer certificate on your device:
  - Settings → General → VPN & Device Management
  - Trust your developer certificate

**Option B: Archive and Install**
- Product → Archive
- Once archive completes, click "Distribute App"
- Select "Development" (for testing)
- Select your team and sign
- Click "Export" and save the .ipa file
- Install via Xcode → Window → Devices and Simulators → Your Device → + button

## Method 2: Using Command Line

### Build for Device
```bash
cd meal-tracking-ios/app

# Build Release configuration for device
npx expo run:ios --device --configuration Release
```

**Note**: This requires:
- Device connected via USB
- Device unlocked
- Trusted computer (if first time)

## Method 3: Using Expo EAS Build (Alternative)

If you want a true production build similar to App Store:

```bash
# Install EAS CLI (if not already installed)
npm install -g eas-cli

# Login to Expo
eas login

# Build for iOS device
eas build --platform ios --profile production
```

Then install the .ipa file on your device.

## Important Notes for Production Builds

### RevenueCat Behavior
- ✅ **Production builds connect to App Store Connect** (not StoreKit)
- ✅ **Requires approved products** in App Store Connect
- ⚠️ **Products with `READY_TO_SUBMIT` status will fail**
- ⚠️ **StoreKit configuration is ignored** in Release builds

### Before Testing Production Build

1. **Verify Products Status in App Store Connect**
   - Go to https://appstoreconnect.apple.com
   - Your App → Features → In-App Purchases
   - Check status of `joul_pro_monthly` and `joul_pro_yearly`
   - They should be **APPROVED** or at least **IN_REVIEW**

2. **If Products Are Not Approved**
   - Production build will show RevenueCat errors
   - Purchases won't work
   - You'll need to either:
     - Wait for approval, OR
     - Use Debug build with StoreKit for testing

### Testing Subscriptions in Production Build

**You have two options:**

**Option 1: Sandbox Testing (Recommended)**
- Sign out of App Store on your device
- Use a sandbox tester account
- Test purchases will be free but behave like real purchases
- Products must be approved in App Store Connect

**Option 2: Real Purchases**
- Use your real Apple ID
- Purchases will be real (charged)
- Products must be approved
- Can request refunds if needed

## Troubleshooting

### "No devices found"
- Ensure device is connected via USB
- Unlock device and trust computer
- Check Xcode → Window → Devices and Simulators

### "Code signing error"
- Verify your Apple Developer account is active
- Check Team ID in Xcode signing settings
- Ensure Bundle ID matches your App Store Connect app

### "RevenueCat errors in production"
- Products must be approved in App Store Connect
- Check product status and wait for approval if needed
- Or use Debug build with StoreKit for testing

### "App won't install"
- Check device storage space
- Verify device is trusted
- Try restarting device and Xcode

## Quick Command Reference

```bash
# Build Release for device (via Expo)
npx expo run:ios --device --configuration Release

# Build Release for device (via Xcode command line)
xcodebuild -workspace ios/Joul.xcworkspace \
  -scheme Joul \
  -configuration Release \
  -destination 'generic/platform=iOS' \
  -derivedDataPath ios/build \
  CODE_SIGN_IDENTITY="iPhone Developer" \
  build

# Open Xcode (then build manually)
open ios/Joul.xcworkspace
```
