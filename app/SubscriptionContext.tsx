/**
 * RevenueCat subscription context and hooks for Joul Nutrition.
 * Handles entitlement checking, paywall presentation, and Customer Center.
 */

import React, { createContext, useCallback, useContext, useEffect, useState, useRef } from "react";
import { Platform, AppState, AppStateStatus } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Purchases, { LOG_LEVEL } from "react-native-purchases";
import RevenueCatUI, { PAYWALL_RESULT } from "react-native-purchases-ui";

const REVENUECAT_API_KEY_IOS =
  process.env.EXPO_PUBLIC_REVENUECAT_API_KEY_IOS ?? "";
const ENTITLEMENT_ID = "Pro";
const INSTALL_FREE_ACCESS_STARTED_AT_KEY = "@joul_installFreeAccessStartedAt";
const INSTALL_FREE_ACCESS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;

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

type InstallFreeAccessState = {
  isLoading: boolean;
  isInInstallFreePeriod: boolean;
  installFreeAccessEndsAt: string | null;
};

const defaultInstallFreeAccessState: InstallFreeAccessState = {
  isLoading: true,
  isInInstallFreePeriod: false,
  installFreeAccessEndsAt: null
};

const SubscriptionContext = createContext<{
  isPro: boolean;
  hasPremiumAccess: boolean;
  isInInstallFreePeriod: boolean;
  installFreeAccessEndsAt: string | null;
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
  const [installFreeAccess, setInstallFreeAccess] = useState<InstallFreeAccessState>(defaultInstallFreeAccessState);
  const isManuallyResetRef = useRef(false);

  const refreshInstallFreeAccess = useCallback(async (): Promise<number | null> => {
    const now = Date.now();
    try {
      const storedStartedAt = await AsyncStorage.getItem(INSTALL_FREE_ACCESS_STARTED_AT_KEY);
      let startedAtMs = storedStartedAt ? Number(storedStartedAt) : NaN;

      if (!Number.isFinite(startedAtMs) || startedAtMs <= 0 || startedAtMs > now + 60_000) {
        startedAtMs = now;
        await AsyncStorage.setItem(INSTALL_FREE_ACCESS_STARTED_AT_KEY, String(startedAtMs));
      }

      const endsAtMs = startedAtMs + INSTALL_FREE_ACCESS_DURATION_MS;
      setInstallFreeAccess({
        isLoading: false,
        isInInstallFreePeriod: now < endsAtMs,
        installFreeAccessEndsAt: new Date(endsAtMs).toISOString()
      });
      return endsAtMs;
    } catch (err) {
      console.warn("Install free access check failed:", err);
      setInstallFreeAccess({
        isLoading: false,
        isInInstallFreePeriod: false,
        installFreeAccessEndsAt: null
      });
      return null;
    }
  }, []);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;
    let appStateSubscription: { remove: () => void } | null = null;

    const scheduleExpiryRefresh = async () => {
      const endsAtMs = await refreshInstallFreeAccess();
      if (!endsAtMs) return;

      const msUntilExpiry = endsAtMs - Date.now();
      if (msUntilExpiry > 0 && msUntilExpiry < 2_147_483_647) {
        timeoutId = setTimeout(() => {
          refreshInstallFreeAccess();
        }, msUntilExpiry + 1000);
      }
    };

    scheduleExpiryRefresh();
    appStateSubscription = AppState.addEventListener("change", (nextAppState: AppStateStatus) => {
      if (nextAppState === "active") {
        refreshInstallFreeAccess();
      }
    });

    return () => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      appStateSubscription?.remove();
    };
  }, [refreshInstallFreeAccess]);

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
      // Use cached data if available - RevenueCat caches CustomerInfo between launches
      // This ensures valid subscriptions are detected even if network is temporarily unavailable
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
      
      // IMPORTANT: Don't immediately set isPro = false on errors
      // RevenueCat caches CustomerInfo, so network errors shouldn't invalidate valid subscriptions
      // Only update state if we're certain the subscription is expired
      // Preserve last known state to avoid false negatives for valid subscribers
      
      // Check if this is a network error vs a real expiration
      const isNetworkError = err instanceof Error && (
        message.includes("network") || 
        message.includes("Network") ||
        message.includes("timeout") ||
        message.includes("offline") ||
        (err as any).code === "NETWORK_ERROR" ||
        (err as any).code === "STORE_PROBLEM_ERROR"
      );
      
      // IMPORTANT: On errors, try to use cached data or preserve last known state
      // RevenueCat caches CustomerInfo, so getCustomerInfo() should work offline
      // If it fails, it's likely a temporary issue - don't invalidate valid subscriptions
      console.warn("Entitlement check failed - attempting to use cached data");
      
      // Try to get cached customer info as fallback
      try {
        // RevenueCat should have cached data - try to access it synchronously if possible
        // Note: This is a best-effort attempt to get cached data
        Purchases.getCustomerInfo()
          .then((cachedInfo) => {
            console.log("Got cached customer info after error");
            const cachedEntitlement = cachedInfo.entitlements.active[ENTITLEMENT_ID];
            if (cachedEntitlement) {
              const expirationDate = cachedEntitlement.expirationDate;
              if (expirationDate) {
                const expDate = new Date(expirationDate);
                const now = new Date();
                if (expDate >= now) {
                  console.log("Using cached entitlement (valid until:", expirationDate, ")");
                  setState({ isPro: true, isLoading: false, error: null });
                  return;
                }
              } else {
                // No expiration date, assume valid
                setState({ isPro: true, isLoading: false, error: null });
                return;
              }
            }
            // No cached entitlement found - preserve previous state if it was Pro, otherwise set to false
            setState((prev) => ({ 
              ...prev, // Preserve isPro state (might be true from previous session)
              isLoading: false, 
              error: isNetworkError ? "Network unavailable - using cached subscription status" : message 
            }));
          })
          .catch(() => {
            // Cache access also failed - preserve previous state
            console.warn("Cache access also failed - preserving last known subscription state");
            setState((prev) => ({ 
              ...prev, // Preserve isPro state
              isLoading: false, 
              error: isNetworkError ? "Network unavailable - using cached subscription status" : message 
            }));
          });
      } catch (cacheErr) {
        // Fallback if promise-based approach fails
        console.warn("Failed to access cache, preserving last known subscription state");
        setState((prev) => ({ 
          ...prev, // Preserve isPro state
          isLoading: false, 
          error: isNetworkError ? "Network unavailable - using cached subscription status" : message 
        }));
      }
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
        // Check if Purchases module is available before using it
        if (typeof Purchases === "undefined" || !Purchases) {
          console.error("Purchases module not available");
          setState({ isPro: false, isLoading: false, error: "RevenueCat module not available" });
          return;
        }
        
        // Check if required functions exist
        if (typeof Purchases.setLogLevel !== "function" || typeof Purchases.configure !== "function") {
          console.error("Purchases functions not available");
          setState({ isPro: false, isLoading: false, error: "RevenueCat functions not available" });
          return;
        }
        
        Purchases.setLogLevel(LOG_LEVEL.VERBOSE);
        await Purchases.configure({ apiKey: REVENUECAT_API_KEY_IOS });
        if (cancelled) return;
        // Try to get customer info immediately after configuration (uses cache)
        try {
          const customerInfo = await Purchases.getCustomerInfo();
          const entitlement = customerInfo.entitlements.active[ENTITLEMENT_ID];
          if (entitlement) {
            const expirationDate = entitlement.expirationDate;
            if (expirationDate) {
              const expDate = new Date(expirationDate);
              const now = new Date();
              if (expDate >= now) {
                console.log("Found valid subscription on init");
                setState({ isPro: true, isLoading: false, error: null });
                // Still run full checkEntitlement for complete validation
                await checkEntitlement();
                return;
              }
            } else {
              // No expiration, assume valid
              setState({ isPro: true, isLoading: false, error: null });
              await checkEntitlement();
              return;
            }
          }
        } catch (cacheErr) {
          console.warn("Initial cache check failed, proceeding with full check");
        }
        await checkEntitlement();
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "Failed to initialize RevenueCat";
          console.error("RevenueCat initialization error:", err);
          // Don't immediately set isPro = false, let checkEntitlement handle it
          // This allows the error handling in checkEntitlement to try cached data
          await checkEntitlement();
        }
      }
    };
    init();
    
    // Add listener for customer info updates (e.g., when subscription changes)
    // Note: Type definitions may not match runtime behavior - handle defensively
    try {
      const subscriptionResult = Purchases.addCustomerInfoUpdateListener((info) => {
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
      // Store subscription for cleanup (handle type mismatch defensively)
      listener = (subscriptionResult as any) || null;
    } catch (err) {
      console.warn("Failed to add customer info update listener:", err);
      listener = null;
    }
    
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
        // RevenueCat listener cleanup - check if listener exists and has remove method
        if (listener && typeof (listener as any).remove === 'function') {
          (listener as any).remove();
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
    if (installFreeAccess.isInInstallFreePeriod) return true;
    try {
      console.log("=== PAYWALL DEBUG START ===");
      console.log("API Key configured:", !!REVENUECAT_API_KEY_IOS);

      // Fetch offerings so we can see what RevenueCat is returning,
      // but don't assume availablePackages is always defined.
      let offerings;
      try {
        offerings = await Purchases.getOfferings();
        console.log("Available offerings:", Object.keys(offerings.all));
      } catch (offeringsError: any) {
        console.warn("Failed to fetch offerings (this is OK if products aren't configured yet):", offeringsError?.message || offeringsError);
        // Continue anyway - the paywall might still work with cached data
        offerings = await Purchases.getOfferings().catch(() => ({ all: {}, current: null }));
      }

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
      const result = await RevenueCatUI.presentPaywall();
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
  }, [checkEntitlement, installFreeAccess.isInInstallFreePeriod]);

  const presentPaywallIfNeeded = useCallback(async (): Promise<boolean> => {
    if (Platform.OS !== "ios") return false;
    if (installFreeAccess.isInInstallFreePeriod) return true;
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
  }, [checkEntitlement, installFreeAccess.isInInstallFreePeriod]);

  const presentCustomerCenter = useCallback(async () => {
    if (Platform.OS !== "ios") return;
    try {
      await RevenueCatUI.presentCustomerCenter();
      // Refresh entitlements after customer center closes (user may have restored purchases)
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
    hasPremiumAccess: state.isPro || installFreeAccess.isInInstallFreePeriod,
    isInInstallFreePeriod: installFreeAccess.isInInstallFreePeriod,
    installFreeAccessEndsAt: installFreeAccess.installFreeAccessEndsAt,
    isLoading: state.isLoading || installFreeAccess.isLoading,
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
