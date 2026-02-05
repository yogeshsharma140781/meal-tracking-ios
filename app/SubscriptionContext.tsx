/**
 * RevenueCat subscription context and hooks for Joul Nutrition.
 * Handles entitlement checking, paywall presentation, and Customer Center.
 */

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const ENTITLEMENT_ID = "Pro";

export type SubscriptionState = {
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
};

const defaultState: SubscriptionState = {
  isPro: false,
  isLoading: true,
  error: null
};

const SubscriptionContext = createContext<{
  isPro: boolean;
  isLoading: boolean;
  error: string | null;
  refreshSubscription: () => Promise<void>;
  presentPaywall: () => Promise<boolean>;
  presentPaywallIfNeeded: () => Promise<boolean>;
  presentCustomerCenter: () => Promise<void>;
  resetSubscriptionForTesting: () => Promise<void>;
} | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SubscriptionState>(defaultState);
  const isManuallyResetRef = useRef(false);

  const checkEntitlement = useCallback(async () => {
    if (Platform.OS !== "ios") {
      setState({ isPro: false, isLoading: false, error: null });
      return;
    }
    
    // If manually reset, skip checking entitlements (keep as free user)
    if (isManuallyResetRef.current) {
      console.log("Skipping entitlement check - manually reset to free user");
      return;
    }
    
    try {
      const customerInfo = await Purchases.getCustomerInfo();
      console.log("=== ENTITLEMENT CHECK ===");
      console.log("Active entitlements keys:", Object.keys(customerInfo.entitlements.active));
      console.log("All entitlements:", JSON.stringify(customerInfo.entitlements.active, null, 2));
      console.log("Looking for entitlement ID:", ENTITLEMENT_ID);
      
      // Check if entitlement exists
      const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
      console.log("Entitlement found:", !!entitlement);
      if (entitlement) {
        console.log("Entitlement details:", JSON.stringify(entitlement, null, 2));
        // Check expiration date
        const expirationDate = entitlement.expirationDate;
        if (expirationDate) {
          const expDate = new Date(expirationDate);
          const now = new Date();
          const isExpired = expDate < now;
          console.log("Expiration date:", expirationDate);
          console.log("Current date:", now.toISOString());
          console.log("Is expired:", isExpired);
          if (isExpired) {
            console.warn("⚠️ Entitlement has expired!");
          }
        }
        // Check if subscription is cancelled but still active
        const willRenew = entitlement.willRenew;
        console.log("Will renew:", willRenew);
        if (willRenew === false) {
          console.warn("⚠️ Subscription is cancelled but still active until expiration");
        }
      }
      
      // Also check all entitlements to see what we have
      const allEntitlementKeys = Object.keys(customerInfo.entitlements.all);
      console.log("All entitlement keys (active + inactive):", allEntitlementKeys);
      
      // Check if there are ANY active entitlements (for debugging)
      const activeEntitlementKeys = Object.keys(customerInfo.entitlements.active);
      console.log("Number of active entitlements:", activeEntitlementKeys.length);
      if (activeEntitlementKeys.length > 0 && !entitlement) {
        console.warn("⚠️ WARNING: Found active entitlements but not the expected one!");
        console.warn("Active entitlement keys:", activeEntitlementKeys);
        console.warn("Expected entitlement ID:", ENTITLEMENT_ID);
        console.warn("This suggests the entitlement ID might be mismatched.");
      }
      
      // Try case-insensitive matching as fallback
      let isPro = typeof entitlement !== "undefined";
      if (!isPro && activeEntitlementKeys.length > 0) {
        // Try to find entitlement with case-insensitive match
        const foundKey = activeEntitlementKeys.find(
          key => key.toLowerCase() === ENTITLEMENT_ID.toLowerCase()
        );
        if (foundKey) {
          console.log("Found entitlement with case-insensitive match:", foundKey);
          isPro = true;
        }
      }
      
      // IMPORTANT: Check expiration date - even if entitlement exists, it might be expired
      if (isPro && entitlement) {
        const expirationDate = entitlement.expirationDate;
        if (expirationDate) {
          const expDate = new Date(expirationDate);
          const now = new Date();
          if (expDate < now) {
            console.warn("⚠️ Entitlement expired, setting isPro to false");
            isPro = false;
          }
        }
      }
      
      console.log("Final isPro status:", isPro);
      console.log("=== END ENTITLEMENT CHECK ===");
      
      setState({ isPro, isLoading: false, error: null });
    } catch (err) {
      console.error("Entitlement check error:", err);
      const message = err instanceof Error ? err.message : "Unknown error";
      setState({ isPro: false, isLoading: false, error: message });
    }
  }, []);

  useEffect(() => {
    if (Platform.OS !== "ios") {
      setState({ isPro: false, isLoading: false, error: null });
      return;
    }
    if (!REVENUECAT_API_KEY_IOS) {
      setState({ isPro: false, isLoading: false, error: "RevenueCat API key not configured" });
      return;
    }
    let cancelled = false;
    let listener: { remove: () => void } | null = null;
    let appStateSubscription: { remove: () => void } | null = null;
    let intervalId: NodeJS.Timeout | null = null;
    
    const init = async () => {
      try {
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
        if (cancelled) return;
        await checkEntitlement();
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to initialize RevenueCat";
          setState({ isPro: false, isLoading: false, error: message });
        }
      }
    };
    init();
    
    listener = Purchases.addCustomerInfoUpdateListener((info) => {
      if (cancelled) return;
      
      // If manually reset, ignore customer info updates (keep as free user)
      if (isManuallyResetRef.current) {
        console.log("Ignoring customer info update - manually reset to free user");
        return;
      }
      
      console.log("=== CUSTOMER INFO UPDATE LISTENER ===");
      console.log("Active entitlements:", Object.keys(info.entitlements.active));
      const entitlement = info.entitlements.active[ENTITLEMENT_ID];
      console.log("Entitlement found:", !!entitlement);
      let isPro = typeof entitlement !== "undefined";
      
      // Check expiration date
      if (isPro && entitlement) {
        const expirationDate = entitlement.expirationDate;
        if (expirationDate) {
          const expDate = new Date(expirationDate);
          const now = new Date();
          if (expDate < now) {
            console.warn("⚠️ Entitlement expired in listener, setting isPro to false");
            isPro = false;
          } else {
            console.log("Entitlement valid until:", expirationDate);
          }
        }
      }
      
      console.log("Setting isPro to:", isPro);
      console.log("=== END LISTENER ===");
      setState((prev) => ({ ...prev, isPro, isLoading: false }));
    });
    
    // Refresh subscription when app comes to foreground
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === "active" && !cancelled) {
        console.log("App came to foreground, refreshing subscription...");
        checkEntitlement();
      }
    };
    
    appStateSubscription = AppState.addEventListener("change", handleAppStateChange);
    
    // Periodic check every 5 minutes
    intervalId = setInterval(() => {
      if (!cancelled) {
        console.log("Periodic subscription check...");
        checkEntitlement();
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => {
      cancelled = true;
      try {
        if (listener && typeof listener.remove === 'function') {
          listener.remove();
        }
      } catch (err) {
        console.warn("Error removing listener:", err);
      }
      try {
        if (appStateSubscription && typeof appStateSubscription.remove === 'function') {
          appStateSubscription.remove();
        }
      } catch (err) {
        console.warn("Error removing appStateSubscription:", err);
      }
      try {
        if (intervalId) {
          clearInterval(intervalId);
        }
      } catch (err) {
        console.warn("Error clearing interval:", err);
      }
    };
  }, [checkEntitlement]);

  const presentPaywall = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") return false;
    try {
      console.log("=== PAYWALL DEBUG START ===");
      console.log("API Key configured:", !!REVENUECAT_API_KEY_IOS);

      // Fetch offerings so we can see what RevenueCat is returning,
      // but don't assume availablePackages is always defined.
      const offerings = await Purchases.getOfferings();
      console.log("Available offerings:", Object.keys(offerings.all));

      const current = offerings.current;
      if (!current) {
        console.warn("No current offering returned from RevenueCat");
      } else {
        const packages = (current as any).availablePackages ?? [];
        console.log("Current offering:", current.identifier);
        console.log(
          "Packages in current offering (count):",
          Array.isArray(packages) ? packages.length : 0
        );
        // Log package details including prices
        if (Array.isArray(packages) && packages.length > 0) {
          packages.forEach((pkg: any, index: number) => {
            console.log(`Package ${index + 1}:`, {
              identifier: pkg.identifier,
              productId: pkg.product?.identifier,
              price: pkg.product?.price,
              priceString: pkg.product?.priceString,
              currencyCode: pkg.product?.currencyCode,
              displayPrice: pkg.product?.displayPrice
            });
          });
        }
      }

      console.log("Presenting paywall…");
      const result = await RevenueCatUI.presentPaywall({
        callbacks: {
          onPurchaseCompleted: async () => {
            console.log("Purchase completed callback fired");
            // Clear manual reset flag so subscription can be detected
            isManuallyResetRef.current = false;
            console.log("Manual reset flag cleared - subscription will be detected");
            // Sync purchases to ensure RevenueCat has the latest info
            try {
              await Purchases.syncPurchases();
              console.log("Purchases synced");
            } catch (syncErr) {
              console.warn("Sync error:", syncErr);
            }
            // Give RevenueCat a moment to sync, then refresh
            setTimeout(async () => {
              await checkEntitlement();
            }, 500);
          }
        }
      });
      console.log("Paywall result:", result);
      
      // If purchase was successful, sync purchases and clear manual reset flag
      if (result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED) {
        isManuallyResetRef.current = false;
        console.log("Purchase successful - manual reset flag cleared");
        try {
          console.log("Syncing purchases after successful purchase...");
          await Purchases.syncPurchases();
          console.log("Purchases synced successfully");
        } catch (syncErr) {
          console.warn("Sync error:", syncErr);
        }
      }
      
      // Always refresh entitlements after paywall closes
      await checkEntitlement();
      // Also refresh again after a short delay to catch any async updates
      setTimeout(async () => {
        await checkEntitlement();
      }, 1000);
      console.log("=== PAYWALL DEBUG END ===");
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (err) {
      console.error("=== PAYWALL ERROR ===");
      console.error("Paywall error:", err);
      if (err instanceof Error) {
        console.error("Error message:", err.message);
        console.error("Error code:", (err as any).code);
        console.error("Underlying error:", (err as any).underlyingErrorMessage);
        console.error("User info:", (err as any).userInfo);
      }
      console.error("=== END ERROR ===");
      return false;
    }
  }, [checkEntitlement]);

  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") return false;
    try {
      const result = await RevenueCatUI.presentPaywallIfNeeded({
        requiredEntitlementIdentifier: ENTITLEMENT_ID
      });
      await checkEntitlement();
      return result === PAYWALL_RESULT.PURCHASED || result === PAYWALL_RESULT.RESTORED;
    } catch (err) {
      console.warn("PaywallIfNeeded error:", err);
      return false;
    }
  }, [checkEntitlement]);

  const presentCustomerCenter = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      await RevenueCatUI.presentCustomerCenter({
        callbacks: {
          onRestoreCompleted: () => checkEntitlement()
        }
      });
      await checkEntitlement();
    } catch (err) {
      console.warn("Customer Center error:", err);
    }
  }, [checkEntitlement]);

  const resetSubscriptionForTesting = useCallback(async () => {
    if (Platform.OS !== "ios") {
      console.log("Reset: Not iOS, skipping");
      return;
    }
    
    console.log("=== RESETTING SUBSCRIPTION FOR TESTING ===");
    
    // Set flag to prevent automatic entitlement checks from overriding our reset
    isManuallyResetRef.current = true;
    console.log("Manual reset flag set - entitlement checks will be skipped");
    
    // Immediately reset local state to free user (this ensures UI updates instantly)
    setState({ isPro: false, isLoading: false, error: null });
    console.log("Local state reset to free user");
    
    // NOTE: We're NOT calling Purchases.logOut() here because:
    // 1. On real device: logout causes RevenueCat to lose access to products (Error 23)
    //    because StoreKit Configuration doesn't work on device
    // 2. On simulator: logout works but isn't necessary for testing
    // The manual reset flag is sufficient to simulate a free user experience
    // When user purchases again, the flag is cleared and real subscription is detected
    
    console.log("=== RESET COMPLETE ===");
    console.log("You should now see free user features (paywalls, badges, etc.)");
    console.log("Note: To restore Pro status, purchase again");
    console.log("Note: Logout skipped to avoid product fetch errors on real device");
  }, []);

  const value = {
    isPro: state.isPro,
    isLoading: state.isLoading,
    error: state.error,
    refreshSubscription: checkEntitlement,
    presentPaywall,
    presentPaywallIfNeeded,
    presentCustomerCenter,
    resetSubscriptionForTesting
  };

  return (
    <SubscriptionContext.Provider value={value}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription() {
  const ctx = useContext(SubscriptionContext);
  if (!ctx) {
    throw new Error("useSubscription must be used within SubscriptionProvider");
  }
  return ctx;
}
