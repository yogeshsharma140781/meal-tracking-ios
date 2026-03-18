# Fix: RevenueCat Using App Store Connect Instead of StoreKit

## The Problem

RevenueCat is finding your products (`joul_pro_monthly`, `joul_pro_yearly`) but:
- They have status `READY_TO_SUBMIT` (not approved in App Store Connect)
- RevenueCat is trying to validate against App Store Connect instead of using StoreKit
- This causes the "Error fetching offerings" error

## Why This Happens

RevenueCat SDK tries to fetch product information from:
1. **App Store Connect** (production)
2. **StoreKit Configuration file** (local testing)

Even though your StoreKit file is configured in the scheme, RevenueCat might still try App Store Connect first if:
- The app is running in Release mode
- StoreKit isn't properly initialized
- Products aren't being loaded from StoreKit

## Solutions

### Solution 1: Ensure Debug Build with StoreKit (Recommended)

1. **Verify Scheme Configuration:**
   - Xcode → Product → Scheme → Edit Scheme
   - Run → Options → StoreKit Configuration = `Joul.storekit`
   - Make sure "Run" is set to **Debug** configuration (not Release)

2. **Build in Debug Mode:**
   ```bash
   npx expo run:ios --device --configuration Debug
   ```

3. **Verify StoreKit is Active:**
   - When the app launches, StoreKit should load products from the local file
   - Check Xcode console for StoreKit-related messages

### Solution 2: Approve Products in App Store Connect (For Production)

If you want to use App Store Connect instead of StoreKit:

1. **Go to App Store Connect:** https://appstoreconnect.apple.com
2. **Select your app**
3. **Go to Features → In-App Purchases**
4. **For each product (`joul_pro_monthly`, `joul_pro_yearly`):**
   - Ensure they're created
   - Fill in all required metadata
   - Submit for review
   - Wait for approval

5. **Once approved**, RevenueCat will fetch from App Store Connect

### Solution 3: Use Sandbox Testing Account

For local testing without StoreKit:

1. **Create Sandbox Tester** in App Store Connect:
   - Users and Access → Sandbox Testers
   - Create a test Apple ID

2. **Sign out of App Store on device:**
   - Settings → App Store → Sign Out

3. **When prompted during purchase**, use the sandbox tester account

### Solution 4: Verify StoreKit File is Being Used

Check if StoreKit is actually loading:

1. **Add logging** to see if StoreKit products are available
2. **Check Xcode console** for StoreKit initialization messages
3. **Verify the scheme** is using Debug configuration

## Current Status

✅ **Working:**
- StoreKit file exists: `ios/Joul.storekit`
- Products defined: `joul_pro_monthly`, `joul_pro_yearly`
- Scheme configured: StoreKit Configuration = `Joul.storekit`
- RevenueCat finds products

❌ **Issue:**
- Products are `READY_TO_SUBMIT` status
- RevenueCat trying App Store Connect instead of StoreKit
- Need Debug build with StoreKit active

## Quick Fix

**Most likely solution:** Ensure you're running a **Debug build** with StoreKit configured:

```bash
# Clean and rebuild in Debug mode
cd ios
xcodebuild clean -workspace Joul.xcworkspace -scheme Joul -configuration Debug
cd ..
npx expo run:ios --device
```

Then verify in Xcode console that StoreKit is loading products locally.

## Note

The `READY_TO_SUBMIT` status means products exist in App Store Connect but aren't approved. For local testing, StoreKit should bypass this, but only if:
- Running in Debug mode
- StoreKit configuration is active
- Products match exactly between StoreKit and RevenueCat
