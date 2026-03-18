# How to Give Users Free Pro Access

There are several ways to grant free Pro subscriptions to specific users. Here are the options:

## Method 1: Promotional Codes (Easiest - Recommended)

### Create Promotional Codes in RevenueCat

1. **Go to RevenueCat Dashboard**: https://app.revenuecat.com
2. **Select your project**
3. **Go to Promotional Codes** (left sidebar)
4. **Create a new promotional code**:
   - Code: e.g., `FREEPRO2024`, `BETAUSER`, etc.
   - Entitlement: `Pro`
   - Duration: Set expiration (e.g., 1 year, lifetime, etc.)
   - Usage limit: How many times it can be used
5. **Share the code with users**

### Users Redeem in App

Users can redeem codes through the Customer Center:
- In your app: Menu → Manage Subscription → Customer Center
- RevenueCat's Customer Center has a "Redeem Code" option
- Users enter the promotional code
- Pro access is granted immediately

**Pros:**
- ✅ Easy to create and manage
- ✅ Users can redeem themselves
- ✅ No code changes needed
- ✅ Trackable in RevenueCat dashboard

**Cons:**
- ⚠️ Users need to manually redeem
- ⚠️ Codes can be shared (if not limited)

---

## Method 2: Grant Entitlements via RevenueCat Dashboard

### Grant Access Manually

1. **Go to RevenueCat Dashboard** → **Customers**
2. **Find the user** (search by RevenueCat Customer ID or App User ID)
3. **Click on the customer**
4. **Go to "Entitlements" tab**
5. **Grant entitlement**:
   - Click "Grant Entitlement"
   - Select entitlement: `Pro`
   - Set expiration date (or leave blank for lifetime)
   - Click "Grant"

**How to find user's RevenueCat ID:**
- Check app logs when user opens the app
- RevenueCat logs the Customer ID on initialization
- Or use RevenueCat's Customer Lookup API

**Pros:**
- ✅ Immediate access
- ✅ Full control
- ✅ Can set expiration dates

**Cons:**
- ⚠️ Requires manual work per user
- ⚠️ Need to know user's RevenueCat ID

---

## Method 3: Grant via Backend API (Automated)

### Add Backend Endpoint to Grant Pro Access

Create a backend endpoint that grants entitlements via RevenueCat REST API:

**Backend Route** (`backend/src/routes/admin.ts`):
```typescript
import { Router } from "express";
import fetch from "node-fetch";

export const adminRouter = Router();

const REVENUECAT_SECRET_KEY = process.env.REVENUECAT_SECRET_KEY || "";

adminRouter.post("/grant-pro", async (req, res) => {
  try {
    const { appUserId, durationDays } = req.body;
    
    if (!appUserId) {
      return res.status(400).json({ error: "appUserId required" });
    }

    // Grant entitlement via RevenueCat API
    const response = await fetch(
      `https://api.revenuecat.com/v1/subscribers/${appUserId}/entitlements/Pro`,
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${REVENUECAT_SECRET_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          expires_date: durationDays 
            ? new Date(Date.now() + durationDays * 24 * 60 * 60 * 1000).toISOString()
            : null // null = lifetime
        })
      }
    );

    if (!response.ok) {
      const error = await response.text();
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    res.json({ success: true, entitlement: data });
  } catch (err) {
    console.error("Grant Pro error:", err);
    res.status(500).json({ error: "Failed to grant Pro access" });
  }
});
```

**Add to backend** (`backend/src/index.ts`):
```typescript
import { adminRouter } from "./routes/admin";
app.use("/v1/admin", adminRouter);
```

**Security**: Add authentication/authorization to this endpoint!

**Pros:**
- ✅ Automated
- ✅ Can integrate with your user system
- ✅ Can grant based on conditions

**Cons:**
- ⚠️ Requires backend code changes
- ⚠️ Need RevenueCat Secret Key (not public key)
- ⚠️ Need to identify users

---

## Method 4: Set User IDs and Grant via API

### Identify Users in App

First, set user IDs in the app so you can identify them:

**Update `SubscriptionContext.tsx`**:
```typescript
// After Purchases.configure()
await Purchases.logIn("user-email-or-id"); // Use email or unique ID
```

Then grant access via backend API (Method 3) using the same ID.

**Pros:**
- ✅ Can identify users by email/ID
- ✅ Automated granting

**Cons:**
- ⚠️ Requires code changes
- ⚠️ Users need to be identified first

---

## Method 5: Create Free/Lifetime Product (For Specific Users)

### Create a Special Product in RevenueCat

1. **Create a new product** in RevenueCat:
   - Product ID: `joul_pro_lifetime_free`
   - Price: $0.00
   - Link to `Pro` entitlement

2. **Create in App Store Connect**:
   - Create as "Non-Consumable" (one-time purchase)
   - Set price to Free
   - Submit for review

3. **Grant access**:
   - Use RevenueCat dashboard to grant this product to specific users
   - Or create promotional codes for this product

**Pros:**
- ✅ Appears as a "purchase" (users see it in purchase history)
- ✅ Can be managed like other products

**Cons:**
- ⚠️ Requires App Store Connect setup
- ⚠️ More complex

---

## Recommended Approach

**For Launch/Beta Testing:**
1. **Use Promotional Codes (Method 1)** - Easiest and fastest
2. Create codes like `BETA2024`, `EARLYACCESS`, etc.
3. Share codes with beta testers
4. They redeem via Customer Center in app

**For Ongoing Management:**
1. **Use RevenueCat Dashboard (Method 2)** - For one-off grants
2. **Use Backend API (Method 3)** - For automated/conditional grants

---

## Quick Setup: Promotional Codes

### Step 1: Create Code in RevenueCat
1. RevenueCat Dashboard → Promotional Codes
2. Click "Create Promotional Code"
3. Fill in:
   - **Code**: `FREEPRO2024` (or any code you want)
   - **Entitlement**: `Pro`
   - **Expires**: Set date or leave blank for lifetime
   - **Usage Limit**: How many times it can be used
4. Click "Create"

### Step 2: Share with Users
- Send them the code
- They open app → Menu → Manage Subscription → Customer Center
- Click "Redeem Code" → Enter code → Done!

### Step 3: Verify
- Check RevenueCat Dashboard → Customers
- See who redeemed codes
- Check entitlement status

---

## Security Considerations

**For Backend API (Method 3):**
- ✅ Add authentication (API key, JWT, etc.)
- ✅ Add authorization (admin-only endpoint)
- ✅ Rate limit the endpoint
- ✅ Log all grants for audit trail

**Example secure endpoint:**
```typescript
const ADMIN_API_KEY = process.env.ADMIN_API_KEY || "";

adminRouter.post("/grant-pro", async (req, res) => {
  const apiKey = req.headers["x-admin-api-key"];
  if (apiKey !== ADMIN_API_KEY) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  // ... rest of grant logic
});
```

---

## Which Method Should You Use?

| Method | Best For | Difficulty |
|--------|----------|------------|
| Promotional Codes | Beta testers, launch promotions | ⭐ Easy |
| Dashboard Grant | One-off grants, support requests | ⭐⭐ Medium |
| Backend API | Automated, conditional grants | ⭐⭐⭐ Hard |
| User ID + API | Integrated user system | ⭐⭐⭐ Hard |
| Free Product | Permanent free tier | ⭐⭐⭐⭐ Complex |

**Recommendation**: Start with **Promotional Codes** - it's the easiest and requires no code changes!
