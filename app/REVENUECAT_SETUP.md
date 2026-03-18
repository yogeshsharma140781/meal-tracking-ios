# RevenueCat Setup Guide

## Error: "Error fetching offerings - None of the products registered in the RevenueCat dashboard could be fetched"

This error occurs when RevenueCat can't find products configured in App Store Connect or a local StoreKit Configuration file.

## Solution Options

### Option 1: StoreKit Configuration File (Recommended for Local Testing)

For local development and testing, create a StoreKit Configuration file:

1. **Open Xcode**
2. **Open your project**: `ios/Joul.xcworkspace`
3. **Create StoreKit Configuration File**:
   - File → New → File
   - Choose "StoreKit Configuration File"
   - Name it `Products.storekit`
   - Save it in the `ios` folder

4. **Add Products to StoreKit Configuration**:
   - In Xcode, open `Products.storekit`
   - Click the "+" button to add products
   - Add your subscription product(s) with:
     - **Product ID**: Must match what's in RevenueCat dashboard (e.g., `pro_monthly`, `pro_yearly`)
     - **Type**: Auto-Renewable Subscription
     - **Price**: Set test prices
     - **Duration**: Monthly/Yearly as needed

5. **Configure the Scheme**:
   - Product → Scheme → Edit Scheme
   - Select "Run" → "Options" tab
   - Under "StoreKit Configuration", select `Products.storekit`

6. **Rebuild the app**: `npx expo run:ios`

### Option 2: Configure Products in App Store Connect (For Production)

1. **Go to App Store Connect**: https://appstoreconnect.apple.com
2. **Select your app**
3. **Go to Features → In-App Purchases**
4. **Create subscription products**:
   - Product IDs must match what's configured in RevenueCat dashboard
   - Set up subscription groups, pricing, etc.

5. **Link in RevenueCat Dashboard**:
   - Go to https://app.revenuecat.com
   - Select your project
   - Go to Products → Add products
   - Enter the same Product IDs from App Store Connect
   - RevenueCat will sync with App Store Connect

### Option 3: Check RevenueCat Dashboard Configuration

1. **Verify API Key**:
   - Ensure `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` is set correctly
   - Use the **public** API key (not the secret key)
   - For development: Use the test/sandbox key
   - For production: Use the live key

2. **Verify Products in RevenueCat**:
   - Go to https://app.revenuecat.com
   - Select your project
   - Go to Products
   - Ensure products are created with correct Product IDs
   - Ensure they're linked to an Offering

3. **Verify Offerings**:
   - Go to Offerings in RevenueCat dashboard
   - Ensure you have at least one offering configured
   - Ensure products are added to packages in the offering

4. **Verify Bundle Identifier**:
   - RevenueCat dashboard → Project Settings
   - Ensure bundle identifier matches: `com.anonymous.meal-tracking`

## Quick Fix for Development

If you just want to test the app without setting up products:

1. The error is non-fatal - the app will still work
2. Subscription features won't be available until products are configured
3. You can temporarily suppress the error by catching it in `SubscriptionContext.tsx`

## Testing Checklist

- [ ] StoreKit Configuration file created (for local testing)
- [ ] Products added to StoreKit Configuration
- [ ] Scheme configured to use StoreKit Configuration
- [ ] Products created in RevenueCat dashboard
- [ ] Products added to an Offering in RevenueCat
- [ ] Bundle identifier matches in RevenueCat
- [ ] API key is correct and set in environment variables

## Common Issues

1. **Product IDs don't match**: Product IDs in RevenueCat, App Store Connect, and StoreKit Configuration must all match exactly
2. **Wrong API key**: Using secret key instead of public key, or wrong environment (test vs live)
3. **Bundle identifier mismatch**: Bundle ID in RevenueCat doesn't match your app's bundle ID
4. **No offerings configured**: Products exist but aren't added to an offering
