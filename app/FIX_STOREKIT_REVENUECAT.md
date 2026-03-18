# Fix: RevenueCat "Error fetching offerings" with StoreKit Configuration

## The Problem

You're seeing: `[RevenueCat] Error fetching offerings - None of the products registered in the RevenueCat dashboard could be fetched from App Store Connect (or the StoreKit Configuration file)`

This happens because:
1. The StoreKit configuration file exists but isn't configured in the Xcode scheme
2. OR the products in StoreKit don't match what's in RevenueCat dashboard

## Solution: Configure StoreKit in Xcode Scheme

### Step 1: Open Xcode Workspace
```bash
open ios/Joul.xcworkspace
```

### Step 2: Configure the Scheme

1. **Open Scheme Editor:**
   - Click on the scheme dropdown (next to the play/stop buttons at the top)
   - Select "Edit Scheme..." (or press `Cmd+<`)

2. **Select Run Configuration:**
   - In the left sidebar, make sure "Run" is selected
   - Click on the "Options" tab at the top

3. **Set StoreKit Configuration:**
   - Scroll down to find "StoreKit Configuration"
   - Click the dropdown next to it
   - Select `Joul.storekit` (or `Products.storekit` if that's what you named it)
   - Click "Close"

### Step 3: Verify StoreKit File Has Products

1. **In Xcode Project Navigator:**
   - Find `Joul.storekit` (or `Products.storekit`)
   - Double-click to open it
   - You should see a list of products

2. **Check Product IDs:**
   - The Product IDs in StoreKit **must match** what's configured in RevenueCat dashboard
   - Common names: `pro_monthly`, `pro_yearly`, `pro_annual`, etc.

### Step 4: Match RevenueCat Dashboard

1. **Go to RevenueCat Dashboard:** https://app.revenuecat.com
2. **Check Products:**
   - Go to your project → Products
   - Note the Product IDs (e.g., `pro_monthly`, `pro_yearly`)
3. **Update StoreKit if needed:**
   - If Product IDs don't match, either:
     - Update StoreKit file to match RevenueCat, OR
     - Update RevenueCat to match StoreKit

### Step 5: Rebuild and Test

```bash
# Clean build folder
cd ios
xcodebuild clean -workspace Joul.xcworkspace -scheme Joul

# Rebuild
cd ..
npx expo run:ios --device
```

## Quick Checklist

- [ ] StoreKit file exists: `ios/Joul.storekit`
- [ ] Scheme is configured: Run → Options → StoreKit Configuration = `Joul.storekit`
- [ ] Products exist in StoreKit file
- [ ] Product IDs match RevenueCat dashboard
- [ ] App rebuilt after configuration

## Alternative: Use App Store Connect (Production)

If you don't want to use StoreKit for local testing:
1. Remove StoreKit configuration from scheme
2. Configure products in App Store Connect
3. RevenueCat will fetch from App Store Connect instead

## Still Not Working?

1. **Check RevenueCat API Key:**
   - Ensure `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` is set correctly
   - Use the **public** API key (not secret)

2. **Verify Bundle Identifier:**
   - RevenueCat dashboard → Project Settings
   - Bundle ID should match: `com.anonymous.meal-tracking`

3. **Check Network:**
   - Ensure device/simulator has internet connection
   - RevenueCat needs to fetch product info

4. **Test with Debug Logs:**
   - The app already has verbose logging enabled
   - Check console for detailed RevenueCat messages
