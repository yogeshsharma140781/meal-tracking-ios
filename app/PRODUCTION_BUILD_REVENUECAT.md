# Production Release Build with RevenueCat

## What Happens with Production Builds

### Key Differences: Debug vs Release

**Debug Build (Current):**
- ✅ Can use StoreKit Configuration file (`Joul.storekit`)
- ✅ Tests purchases locally without App Store approval
- ✅ Works with `READY_TO_SUBMIT` products
- ✅ No need for App Store Connect approval for testing

**Release/Production Build:**
- ❌ **Cannot use StoreKit Configuration file**
- ❌ **Must connect to App Store Connect (real store)**
- ❌ **Products MUST be approved in App Store Connect**
- ❌ **`READY_TO_SUBMIT` status will cause failures**

## What You Need for Production

### 1. Approved Products in App Store Connect

Your products (`joul_pro_monthly`, `joul_pro_yearly`) currently have status `READY_TO_SUBMIT`. For production, they need to be:

1. **Created in App Store Connect**
2. **All metadata filled in** (descriptions, pricing, etc.)
3. **Submitted for review**
4. **Approved by Apple** ✅

**Status progression:**
- `READY_TO_SUBMIT` → Submit for review
- `IN_REVIEW` → Apple reviewing
- `APPROVED` ✅ → Ready for production

### 2. Remove StoreKit Configuration

Production builds ignore StoreKit files. You should:

1. **Remove StoreKit from scheme** (optional, but cleaner):
   - Xcode → Scheme → Edit Scheme
   - Run → Options → StoreKit Configuration = `None`
   - Or leave it - it won't be used in Release builds anyway

2. **Build in Release mode:**
   ```bash
   npx expo run:ios --device --configuration Release
   ```

### 3. RevenueCat Will Use App Store Connect

In production:
- RevenueCat SDK connects to App Store Connect
- Validates products against real App Store
- Processes real purchases
- Requires approved products

## Current Status Check

**Your products:**
- ✅ Exist in RevenueCat dashboard
- ✅ Exist in StoreKit file
- ⚠️ Status: `READY_TO_SUBMIT` in App Store Connect
- ❌ **Not approved** - will fail in production

## What Happens If You Build Production Now

If you build a Release/Production build right now:

1. **StoreKit file will be ignored** (only works in Debug)
2. **RevenueCat will try App Store Connect**
3. **Products will fail validation** (status `READY_TO_SUBMIT`)
4. **You'll see the same error:**
   ```
   Error fetching offerings - None of the products could be fetched
   ```
5. **Purchases won't work** until products are approved

## Steps to Prepare for Production

### Step 1: Complete Product Setup in App Store Connect

1. Go to https://appstoreconnect.apple.com
2. Your App → Features → In-App Purchases
3. For each product (`joul_pro_monthly`, `joul_pro_yearly`):
   - Complete all required fields:
     - Display name
     - Description
     - Pricing (all territories or specific)
     - Review information (screenshot, review notes)
   - Click "Submit for Review"

### Step 2: Wait for Approval

- Apple typically reviews in-app purchases within 24-48 hours
- You'll receive email notifications about status changes
- Check status in App Store Connect

### Step 3: Verify in RevenueCat

Once approved:
1. Go to RevenueCat dashboard
2. Products should show as "Active" or "Available"
3. Health report should show no warnings

### Step 4: Build Production Release

```bash
# Build Release configuration
npx expo run:ios --device --configuration Release

# Or for App Store submission:
npx expo run:ios --configuration Release
```

## Testing Production Build Locally

**You can't fully test production builds locally** because:
- They require approved products
- They connect to real App Store
- Purchases are real (even in TestFlight)

**Options:**
1. **Use TestFlight** - Upload build, test with sandbox accounts
2. **Use Debug build** - Test with StoreKit until products are approved
3. **Wait for approval** - Then test production build

## Recommendation

**For now (development/testing):**
- ✅ Continue using **Debug builds** with StoreKit
- ✅ Test subscription flow locally
- ✅ Work on app features while products are being reviewed

**For production:**
- ⏳ Submit products for review in App Store Connect
- ⏳ Wait for approval
- ✅ Then build Release/Production version

## Quick Answer

**If you build production release now:**
- ❌ RevenueCat will fail (products not approved)
- ❌ Purchases won't work
- ❌ Same error you're seeing now

**You need:**
- ✅ Products approved in App Store Connect first
- ✅ Then production builds will work

**Best approach:**
- Keep using Debug + StoreKit for development
- Submit products for review
- Build production after approval
