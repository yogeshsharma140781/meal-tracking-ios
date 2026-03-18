import fs from "fs";
import path from "path";

type ReminderState = {
  deviceId: string;
  expoPushToken: string;
  timezone: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  hasLoggedMealToday: boolean;
  statusDayKey: string; // YYYY-MM-DD in user's timezone
  lastSentDayKey: string | null; // YYYY-MM-DD in user's timezone
  updatedAt: string;
};

const STORE_PATH = path.join(__dirname, "../../data/reminder-state.json");

let reminderStore: Record<string, ReminderState> = {};
let schedulerStarted = false;

function ensureStoreLoaded(): void {
  if (Object.keys(reminderStore).length > 0) return;
  try {
    if (!fs.existsSync(STORE_PATH)) return;
    const raw = fs.readFileSync(STORE_PATH, "utf8");
    const parsed = JSON.parse(raw) as Record<string, ReminderState>;
    if (parsed && typeof parsed === "object") {
      reminderStore = parsed;
    }
  } catch (err) {
    console.warn("Failed to load reminder state store:", err);
  }
}

function persistStore(): void {
  try {
    const dir = path.dirname(STORE_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(STORE_PATH, JSON.stringify(reminderStore, null, 2), "utf8");
  } catch (err) {
    console.warn("Failed to persist reminder state store:", err);
  }
}

function getDayKeyForTimezone(date: Date, timezone: string): string {
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: timezone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    return fmt.format(date);
  } catch {
    return new Intl.DateTimeFormat("en-CA").format(date);
  }
}

function getHourMinuteForTimezone(date: Date, timezone: string): { hour: number; minute: number } {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour12: false,
      hour: "2-digit",
      minute: "2-digit"
    }).formatToParts(date);
    const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
    const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
    return { hour, minute };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

async function sendExpoPush(expoPushToken: string): Promise<boolean> {
  try {
    const res = await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json"
      },
      body: JSON.stringify({
        to: expoPushToken,
        title: "Log your meals",
        body: "You haven't logged a meal yet today. Tap to open Joul and add your meals.",
        sound: "default",
        data: { type: "meal_reminder" }
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.warn("Expo push request failed:", res.status, body);
      return false;
    }
    const payload = (await res.json().catch(() => ({}))) as {
      data?: { status?: string; details?: { error?: string } };
    };
    if (payload?.data?.status === "error") {
      console.warn("Expo push send error:", payload?.data?.details?.error || "unknown");
      return false;
    }
    return true;
  } catch (err) {
    console.warn("Failed to send Expo push:", err);
    return false;
  }
}

export function upsertReminderState(input: {
  deviceId: string;
  expoPushToken: string;
  timezone: string;
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  hasLoggedMealToday: boolean;
  statusDayKey: string;
}): void {
  ensureStoreLoaded();
  const current = reminderStore[input.deviceId];
  reminderStore[input.deviceId] = {
    ...current,
    deviceId: input.deviceId,
    expoPushToken: input.expoPushToken,
    timezone: input.timezone,
    reminderEnabled: input.reminderEnabled,
    reminderHour: Math.max(0, Math.min(23, Math.floor(input.reminderHour))),
    reminderMinute: Math.max(0, Math.min(59, Math.floor(input.reminderMinute))),
    hasLoggedMealToday: input.hasLoggedMealToday,
    statusDayKey: input.statusDayKey,
    lastSentDayKey: current?.lastSentDayKey ?? null,
    updatedAt: new Date().toISOString()
  };
  persistStore();
}

export function startReminderScheduler(): void {
  if (schedulerStarted) return;
  schedulerStarted = true;
  ensureStoreLoaded();

  // Every minute, evaluate whether a reminder should be sent per device.
  setInterval(async () => {
    const now = new Date();
    const entries = Object.values(reminderStore);
    if (entries.length === 0) return;

    for (const state of entries) {
      if (!state.reminderEnabled || !state.expoPushToken) continue;

      const dayKeyNow = getDayKeyForTimezone(now, state.timezone);
      const timeNow = getHourMinuteForTimezone(now, state.timezone);

      // When day rolls over and app hasn't synced yet, default to "not logged today".
      const hasLoggedForToday =
        state.statusDayKey === dayKeyNow ? state.hasLoggedMealToday : false;

      if (hasLoggedForToday) continue;
      if (state.lastSentDayKey === dayKeyNow) continue;

      const reachedReminderTime =
        timeNow.hour > state.reminderHour ||
        (timeNow.hour === state.reminderHour && timeNow.minute >= state.reminderMinute);
      if (!reachedReminderTime) continue;

      const sent = await sendExpoPush(state.expoPushToken);
      if (sent) {
        reminderStore[state.deviceId] = {
          ...state,
          lastSentDayKey: dayKeyNow,
          updatedAt: new Date().toISOString()
        };
      }
    }

    persistStore();
  }, 60 * 1000);
}

