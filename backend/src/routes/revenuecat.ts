import { Router } from "express";

export const revenuecatRouter = Router();

const REVENUECAT_API_KEY_IOS = process.env.REVENUECAT_API_KEY_IOS || "";

if (!REVENUECAT_API_KEY_IOS) {
  console.warn("⚠️ REVENUECAT_API_KEY_IOS not set in environment variables");
}

/**
 * Server-side validation endpoint for subscription status
 * This provides an additional security layer by validating subscriptions server-side
 * Note: RevenueCat SDK still needs the public API key client-side for native StoreKit integration,
 * but this endpoint can be used for critical server-side validation
 */
revenuecatRouter.post("/validate-subscription", async (req, res) => {
  try {
    if (!REVENUECAT_API_KEY_IOS) {
      return res.status(500).json({ error: "RevenueCat not configured" });
    }

    const { appUserId, entitlementId } = req.body;
    
    if (!appUserId) {
      return res.status(400).json({ error: "appUserId required" });
    }

    const entitlement = entitlementId || "Pro";
    
    // RevenueCat REST API endpoint
    const revenuecatUrl = `https://api.revenuecat.com/v1/subscribers/${appUserId}`;
    
    const response = await fetch(revenuecatUrl, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${REVENUECAT_API_KEY_IOS}`,
        "Content-Type": "application/json",
        "X-Platform": "ios"
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("RevenueCat API error:", response.status, errorText);
      return res.status(response.status).json({ 
        error: "Failed to validate subscription",
        details: errorText 
      });
    }

    const data = await response.json();
    const subscriber = data.subscriber;
    const entitlementInfo = subscriber?.entitlements?.[entitlement];
    
    // Return validation result
    const isValid = entitlementInfo && 
      (!entitlementInfo.expires_date || new Date(entitlementInfo.expires_date) > new Date());
    
    res.json({
      isValid,
      entitlement: entitlementInfo || null,
      expiresDate: entitlementInfo?.expires_date || null
    });
  } catch (err) {
    console.error("RevenueCat validation error:", err);
    res.status(500).json({ 
      error: "Internal server error",
      message: err instanceof Error ? err.message : "Unknown error"
    });
  }
});
