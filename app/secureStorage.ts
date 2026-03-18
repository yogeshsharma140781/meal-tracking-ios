/**
 * Secure storage utilities using expo-secure-store
 * Use this for sensitive data like user profiles, API keys, etc.
 */

import * as SecureStore from "expo-secure-store";

/**
 * Store sensitive data securely
 */
export async function setSecureItem(key: string, value: string): Promise<void> {
  try {
    await SecureStore.setItemAsync(key, value);
  } catch (error) {
    console.error(`Failed to store secure item ${key}:`, error);
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
    console.error(`Failed to retrieve secure item ${key}:`, error);
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
    console.error(`Failed to delete secure item ${key}:`, error);
  }
}

/**
 * Store JSON object securely
 */
export async function setSecureJSON<T>(key: string, value: T): Promise<void> {
  try {
    const jsonString = JSON.stringify(value);
    await setSecureItem(key, jsonString);
  } catch (error) {
    console.error(`Failed to store secure JSON ${key}:`, error);
    throw error;
  }
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
    console.error(`Failed to retrieve secure JSON ${key}:`, error);
    return null;
  }
}

// Keys for sensitive data
export const SECURE_KEYS = {
  USER_PROFILE: "secure_user_profile",
  REVENUECAT_USER_ID: "secure_revenuecat_user_id",
  // Add other sensitive keys here
} as const;
