# Sandbox Testing Setup for RevenueCat

## Why Sandbox Should Work

You're right - sandbox testing **should work** with `READY_TO_SUBMIT` products! The products don't need to be approved for sandbox testing.

## The Issue: StoreKit vs Sandbox

**The problem:** When StoreKit Configuration is set in the scheme, iOS uses the **local StoreKit file** instead of connecting to the **sandbox App Store**. This prevents RevenueCat from fetching products from App Store Connect (even sandbox).

## Solution: Disable StoreKit for Sandbox Testing

### Option 1: Remove StoreKit from Scheme (Recommended for Sandbox)

1. **Open Xcode:**
   ```bash
   open ios/Joul.xcworkspace
   ```

2. **Edit Scheme:**
   - Product → Scheme → Edit Scheme (or `Cmd+<`)
   - Select "Run" → "Options" tab
   - Under "StoreKit Configuration", select **"None"**
   - Click "Close"

3. **Build and Run:**
   ```bash
   npx expo run:ios --device
   ```

4. **Sign out of App Store on device:**
   - Settings → App Store → Sign Out
   - This ensures sandbox purchases are used

5. **When making a purchase:**
   - You'll be prompted to sign in
   - Use your **sandbox tester account** (not your real Apple ID)

### Option 2: Use Separate Schemes

Create two schemes:
- **Debug (with StoreKit)** - For local testing without network
- **Debug (Sandbox)** - For sandbox testing with App Store Connect

## Verify Sandbox Setup

### 1. Check Sandbox Testers

1. Go to App Store Connect: https://appstoreconnect.apple.com
2. Users and Access → Sandbox Testers
3. Ensure you have sandbox testers created
4. Note the email addresses

### 2. Sign Out on Device

**Critical step:**
- Settings → [Your Name] → Media & Purchases → Sign Out
- OR Settings → App Store → Sign Out
- This forces sandbox mode

### 3. Verify Products in App Store Connect

Even with `READY_TO_SUBMIT` status, products should be available for sandbox:
- Go to your app → Features → In-App Purchases
- Products should show as `READY_TO_SUBMIT`
- This is fine for sandbox testing

### 4. Test Purchase Flow

1. **Launch app** (with StoreKit = None)
2. **Try to purchase**
3. **Sign in with sandbox tester account** when prompted
4. **Complete purchase** - it will use sandbox environment

## Why It Worked Before But Not Now

**Possible reasons:**

1. **StoreKit was not configured before** - App used sandbox automatically
2. **You were signed out** - Sandbox mode was active
3. **Different build configuration** - Release vs Debug behavior
4. **Products were in different status** - Though `READY_TO_SUBMIT` should work

## Current Setup Check

**Your current configuration:**
- ✅ StoreKit file exists: `ios/Joul.storekit`
- ✅ StoreKit configured in scheme: `Joul.storekit`
- ✅ Products exist: `joul_pro_monthly`, `joul_pro_yearly`
- ⚠️ **This prevents sandbox testing**

**To enable sandbox:**
- ❌ Remove StoreKit from scheme (set to "None")
- ✅ Sign out of App Store on device
- ✅ Use sandbox tester account

## Quick Fix

**For sandbox testing right now:**

1. **Remove StoreKit from scheme:**
   - Xcode → Scheme → Edit Scheme → Run → Options
   - StoreKit Configuration = **None**

2. **Sign out on device:**
   - Settings → App Store → Sign Out

3. **Rebuild:**
   ```bash
   npx expo run:ios --device
   ```

4. **Test purchase** - Use sandbox tester account

## When to Use Each Method

**StoreKit (Local Testing):**
- ✅ No network required
- ✅ Instant testing
- ✅ No sandbox account needed
- ❌ Doesn't test real App Store flow
- ❌ RevenueCat validates against App Store Connect (may fail)

**Sandbox (Real Testing):**
- ✅ Tests real App Store flow
- ✅ RevenueCat works properly
- ✅ Tests actual purchase process
- ❌ Requires sandbox tester account
- ❌ Requires network connection
- ❌ Products must exist in App Store Connect (even if `READY_TO_SUBMIT`)

## Recommendation

**For development:**
- Use **StoreKit** when testing UI/flow quickly
- Accept that RevenueCat warnings are expected

**For pre-production testing:**
- Use **Sandbox** (remove StoreKit)
- Test full purchase flow
- Verify RevenueCat integration

**For production:**
- Products must be **approved**
- Use real App Store Connect
