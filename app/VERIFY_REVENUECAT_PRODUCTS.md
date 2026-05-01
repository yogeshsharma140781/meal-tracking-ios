# Verify RevenueCat Products Match StoreKit

## Your StoreKit Products

Your `Joul.storekit` file has these Product IDs:
- ✅ `joul_pro_monthly` (Monthly - $5.99)
- ✅ `joul_pro_yearly` (Annual - $49.99)

## Check RevenueCat Dashboard

1. **Go to RevenueCat Dashboard:** https://app.revenuecat.com
2. **Select your project**
3. **Go to Products** (left sidebar)
4. **Verify Product IDs match exactly:**
   - Should have: `joul_pro_monthly`
   - Should have: `joul_pro_yearly`
   - **Must match exactly** (case-sensitive, no spaces)

## If Products Don't Match

### Option 1: Update RevenueCat (Recommended)

1. In RevenueCat dashboard → Products
2. Add/edit products to match StoreKit:
   - Product ID: `joul_pro_monthly`
   - Product ID: `joul_pro_yearly`
3. Ensure they're linked to an **Offering**
4. The Offering should have the entitlement: `Pro`

### Option 2: Update StoreKit to Match RevenueCat

If RevenueCat has different Product IDs (e.g., `pro_monthly` instead of `joul_pro_monthly`):

1. Open Xcode → `ios/Joul.xcworkspace`
2. Open `Joul.storekit`
3. Edit each product's Product ID to match RevenueCat
4. Save

## Verify Entitlement

Your app uses entitlement ID: `Pro`

In RevenueCat:
1. Go to **Entitlements**
2. Ensure there's an entitlement named `Pro` (exact match, case-sensitive)
3. Both products (`joul_pro_monthly` and `joul_pro_yearly`) should be linked to this entitlement

## Test After Fixing

1. **Rebuild the app:**
   ```bash
   npx expo run:ios --device
   ```

2. **Check console logs:**
   - The app logs detailed RevenueCat info
   - Look for: "Available offerings:", "Packages in current offering"
   - Should show your products if configured correctly

## Common Issues

1. **Product IDs don't match exactly**
   - StoreKit: `joul_pro_monthly`
   - RevenueCat: `joul_pro_monthly` ✅ (must be identical)

2. **Products not in an Offering**
   - Products must be added to an Offering in RevenueCat
   - The Offering must be set as "Current"

3. **Entitlement mismatch**
   - App expects: `Pro`
   - RevenueCat must have: `Pro` (exact match)

4. **Bundle Identifier mismatch**
   - RevenueCat project settings → Bundle ID
   - Should match: `com.anonymous.meal-tracking`
