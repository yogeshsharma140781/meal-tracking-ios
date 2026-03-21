# Notification Strategy for Joul

## Expo push token (`projectId`) — bare / Xcode builds

`expo-notifications` **`getExpoPushTokenAsync`** needs your **EAS project UUID** when the manifest does not supply it (common in bare workflow or opening **`Joul.xcworkspace`** directly).

Without it you will see:

`ERR_NOTIFICATIONS_NO_EXPERIENCE_ID` / `No "projectId" found`.

**Fix (pick one):**

1. **app.json** (committed value) — set `expo.extra.eas.projectId` to your project’s UUID from [expo.dev](https://expo.dev) (project page → Project settings), e.g. after linking the app with EAS:  
   `"extra": { "eas": { "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" } }`  
   Rebuild the native app if needed so the config is picked up.

2. **Env at bundle time** — set **`EXPO_PUBLIC_EAS_PROJECT_ID`** to the same UUID (e.g. in CI or a local `.env` your bundler loads) so it is available when Metro packs JS.

The app resolves **`EXPO_PUBLIC_EAS_PROJECT_ID`** first, then **`Constants.expoConfig.extra.eas.projectId`**.

---

## Goals
1. **Meal reminder** – Prompt users if they haven’t logged any meal by a set time (e.g. 12:00).
2. **Daily insight** – Send “yesterday’s top insight” at a set time (e.g. 9:00).

---

## Approach: Local notifications first

Use **local notifications** (scheduled on the device). No backend or push infrastructure is required. All logic and data stay in the app.

- **Library:** `expo-notifications` (works with current Expo setup).
- **Permission:** Request when the user turns on reminders or when they first open a “Notifications” / “Reminders” setting.

---

## 1. Meal reminder (“No meal logged by noon”)

**Idea:** One daily notification at a configurable time (e.g. 12:00). Only show it if the user hasn’t logged any meal for *today* by that time.

**Flow:**
- **On app launch / resume:**  
  - If **before** reminder time and **no meal** logged for today → ensure a single “meal reminder” is scheduled for today at the set time.  
  - If user **has** logged a meal today or it’s **after** reminder time → cancel today’s meal-reminder notification.
- **When user logs a meal (any meal for today):**  
  - Cancel the meal-reminder notification for today (so they don’t get reminded after logging).

**Implementation sketch:**
- Single identifier, e.g. `"joul-meal-reminder"`.
- Store reminder time in AsyncStorage (e.g. `{ hour: 12, minute: 0 }`), default 12:00.
- Use `expo-notifications`: `scheduleNotificationAsync({ content: { title, body }, trigger: { type: 'daily', hour, minute } })` and cancel by identifier when conditions above are met.

**Content:** e.g.  
*“You haven’t logged a meal yet today. Tap to open Joul and log your meals.”*

---

## 2. Yesterday’s top insight at 9 AM

**Idea:** At a set time (e.g. 9:00), show a notification with yesterday’s “best” insight. The text is derived from local data using the same logic as the Insights tab.

**Challenge:** The app doesn’t run at 9 AM when closed. So the notification **content must be set when we schedule it** (e.g. the evening before or when the user last had the app open).

**Flow:**
- **When the app is open** (e.g. on “today”):  
  - Compute “today’s” best insight with existing logic: `getBestInsightFromYesterday(todayDayData, userProfile)`.  
  - Schedule **one** notification for **tomorrow** at the insight time (e.g. 9:00) with body = that insight (e.g. `affirmation + ": " + message` or just `message`).  
  - Use a fixed identifier (e.g. `"joul-daily-insight"`) and cancel any previously scheduled one before rescheduling, so we only have one “tomorrow 9 AM” at a time.
- **When to run this:**  
  - On app launch and/or when app comes to foreground; optionally also after user logs a meal (so the 9 AM notification always reflects the latest “yesterday” data).

**Implementation sketch:**
- Reuse `getBestInsightFromYesterday(dayData, userProfile)` — it already returns the best insight for a given day’s data. For scheduling, call it with **today’s** `DayData` so that “tomorrow 9 AM” shows “yesterday’s” insight from the user’s perspective.
- Store insight time in AsyncStorage (e.g. `{ hour: 9, minute: 0 }`), default 9:00.
- Build body from `bestInsight.affirmation` and `bestInsight.message` (and optionally category/value). If `bestInsight` is null (no meals that day), either skip scheduling that day or use a generic line: *“Open Joul to see your insights.”*
- Trigger: one-time date trigger for tomorrow at 9:00 (not “daily” at 9:00), so the body is the one we set for that specific day.

---

## 3. Settings and persistence

- **Notification settings** (e.g. in Profile or a new “Reminders” screen):
  - Toggle: “Meal reminder” (default on).
  - Time picker: “Remind me if I haven’t logged a meal by” (default 12:00).
  - Toggle: “Daily insight” (default on).
  - Time picker: “Send yesterday’s insight at” (default 9:00).
- Persist in AsyncStorage (e.g. `joul_notification_settings`).  
- If user disables a feature, cancel the corresponding scheduled notification(s).

---

## 4. Permission and UX

- **When to ask:**  
  - Option A: When user first turns on “Meal reminder” or “Daily insight” in settings.  
  - Option B: Once when they first open the app (with a short explanation: “Joul can remind you to log meals and send a daily insight.”).
- **If permission denied:**  
  - Keep toggles in settings but show a short line: “Notifications are off. Enable in System Settings to get reminders.”

---

## 5. Technical checklist

| Item | Action |
|------|--------|
| Add dependency | `npx expo install expo-notifications` |
| iOS capability | Ensure “Push Notifications” / Background Modes if needed; for local-only, basic notification entitlement is enough. |
| App entry | Set notification handler (e.g. `setNotificationHandler`) so taps open the app (and optionally navigate to Meals or Insights). |
| Identifiers | Use `"joul-meal-reminder"` and `"joul-daily-insight"` so you can cancel/reschedule by id. |
| Day boundaries | Use the same `toDateKey(date)` / “today” logic as the rest of the app so “today” and “yesterday” are consistent. |

---

## 6. Optional later: push notifications

If you later want server-driven reminders (e.g. “We noticed you didn’t log lunch” only when the server knows you didn’t), you would:
- Store device token and optionally sync “last meal logged” per day to the backend.
- Run a cron (e.g. at 12:00) that checks who hasn’t logged and send a push via APNs.
- That’s a separate phase; the strategy above works without any backend changes.

---

## Summary

- **Meal reminder:** Daily local notification at configurable time; cancel when user logs any meal for today or when it’s past that time.
- **Daily insight:** When app is open, compute today’s best insight and schedule a one-time notification for tomorrow at the configured time with that text; single identifier, reschedule on each relevant app open so content is up to date.
- **No backend changes** for this first version; everything is local with `expo-notifications` and AsyncStorage.
