/**
 * Secure storage utilities using expo-secure-store
 * Use this for sensitive data like user profiles, API keys, etc.
 */

import * as SecureStore from "expo-secure-store";
import { Platform } from "react-native";

/**
 * iOS: use AFTER_FIRST_UNLOCK so Keychain **writes** don't hit errSecInteractionNotAllowed
 * ("User interaction is not allowed") during app foreground transitions or right after unlock.
 * Reads/deletes use native defaults so existing keys (written with WHEN_UNLOCKED) still resolve.
 * @see https://developer.apple.com/documentation/security/ksecattraccessible
 */
const SECURE_STORE_WRITE_OPTIONS: SecureStore.SecureStoreOptions | undefined =
  Platform.OS === "ios" ? { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK } : undefined;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isIosKeychainInteractionError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return (
    Platform.OS === "ios" &&
    (msg.includes("User interaction is not allowed") ||
      msg.includes("interactionNotAllowed") ||
      /interaction is not allowed/i.test(msg))
  );
}

/**
 * Store sensitive data securely
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  const write = () => SecureStore.setItemAsync(key, value, SECURE_STORE_WRITE_OPTIONS);
  try {
    await write();
  } catch (error) {
    if (isIosKeychainInteractionError(error)) {
      await sleep(300);
      try {
        await write();
        return;
      } catch {
        // fall through to log + throw
      }
    }
    console.warn(`Failed to store secure item ${key}:`, error);
    throw error;
  }
}

/**
 * Retrieve sensitive data securely
 */
export async function getSecureItem(key: string): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(key);
  } catch (error) {
    console.warn(`Failed to retrieve secure item ${key}:`, error);
    return null;
  }
}

/**
 * Delete sensitive data
 */
export async function deleteSecureItem(key: string): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch (error) {
    console.warn(`Failed to delete secure item ${key}:`, error);
  }
}

/**
 * Store JSON object securely
 */
export async function setSecureJSON<T>(key: string, value: T): Promise<void> {
  const jsonString = JSON.stringify(value);
  await setSecureItem(key, jsonString);
}

/**
 * Retrieve JSON object securely
 */
export async function getSecureJSON<T>(key: string): Promise<T | null> {
  try {
    const jsonString = await getSecureItem(key);
    if (!jsonString) return null;
    return JSON.parse(jsonString) as T;
  } catch (error) {
    console.warn(`Failed to retrieve secure JSON ${key}:`, error);
    return null;
  }
}

// Keys for sensitive data
export const SECURE_KEYS = {
  USER_PROFILE: "secure_user_profile",
  REVENUECAT_USER_ID: "secure_revenuecat_user_id",
  // Add other sensitive keys here
} as const;
