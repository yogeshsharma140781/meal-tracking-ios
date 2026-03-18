import * as Notifications from "expo-notifications";

export const MEAL_REMINDER_ID = "joul-meal-reminder";

/** Initialize notification handler - call this once when app starts */
export function initializeNotificationHandler(): void {
  try {
    // Additional safety checks before accessing native module
    if (typeof Notifications === "undefined" || !Notifications) {
      console.warn("Notifications module not available");
      return;
    }
    
    // Check if notifications module is available and fully loaded
    if (typeof Notifications.setNotificationHandler === "function") {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldPlaySound: true,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true
        })
      });
      console.log("Notification handler initialized successfully");
    } else {
      console.warn("setNotificationHandler function not available");
    }
  } catch (err) {
    console.warn("Notification handler initialization error:", err);
    // Don't throw - allow app to continue without notifications
  }
}

export type MealReminderSettings = {
  enabled: boolean;
  hour: number;
  minute: number;
};

export const DEFAULT_MEAL_REMINDER: MealReminderSettings = {
  enabled: true,
  hour: 12,
  minute: 0
};

/** Request notification permission. Resolves to true if granted. */
export async function requestMealReminderPermission(): Promise<boolean> {
  try {
    if (!Notifications || typeof Notifications.getPermissionsAsync !== "function") {
      return false;
    }
    const { status: existing } = await Notifications.getPermissionsAsync();
    if (existing === "granted") return true;
    if (typeof Notifications.requestPermissionsAsync !== "function") {
      return false;
    }
    const { status } = await Notifications.requestPermissionsAsync();
    return status === "granted";
  } catch (err) {
    console.warn("Failed to request notification permission:", err);
    return false;
  }
}

/** Cancel the scheduled meal reminder (e.g. after user logs a meal). */
export async function cancelMealReminder(): Promise<void> {
  try {
    if (!Notifications || typeof Notifications.cancelScheduledNotificationAsync !== "function") {
      return;
    }
    await Notifications.cancelScheduledNotificationAsync(MEAL_REMINDER_ID);
  } catch (e) {
    console.warn("Failed to cancel meal reminder:", e);
  }
}

/** Test function: Send a notification immediately (for testing) */
export async function sendTestMealReminder(): Promise<void> {
  try {
    const granted = await requestMealReminderPermission();
    if (!granted) {
      console.warn("Notification permission not granted");
      return;
    }
    if (!Notifications || typeof Notifications.scheduleNotificationAsync !== "function") {
      console.warn("Notification functions not available");
      return;
    }
    // Schedule for 5 seconds from now
    const triggerDate = new Date(Date.now() + 5000);
    await Notifications.scheduleNotificationAsync({
      identifier: `${MEAL_REMINDER_ID}-test-${Date.now()}`,
      content: {
        title: "Log your meals",
        body: "You haven't logged a meal yet today. Tap to open Joul and add your meals."
      },
      trigger: { date: triggerDate }
    });
    console.log("Test notification scheduled for 5 seconds from now");
  } catch (e) {
    console.warn("Failed to send test notification:", e);
  }
}

/**
 * Backend-driven reminder mode:
 * - Keep local reminders cleared to avoid duplicate alerts.
 * - Actual reminder delivery is handled by backend push notifications.
 */
export async function updateMealReminderSchedule(
  _settings: MealReminderSettings,
  _hasLoggedMealToday: boolean
): Promise<void> {
  await cancelMealReminder();
}
