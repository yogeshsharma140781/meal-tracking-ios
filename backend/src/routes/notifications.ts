import { Router } from "express";
import { upsertReminderState } from "../services/notifications";

export const notificationsRouter = Router();

notificationsRouter.post("/state", (req, res) => {
  const {
    deviceId,
    expoPushToken,
    timezone,
    reminderEnabled,
    reminderHour,
    reminderMinute,
    hasLoggedMealToday,
    statusDayKey
  } = req.body ?? {};

  if (!deviceId || typeof deviceId !== "string") {
    return res.status(400).json({ error: "deviceId is required" });
  }
  if (!expoPushToken || typeof expoPushToken !== "string") {
    return res.status(400).json({ error: "expoPushToken is required" });
  }
  if (!timezone || typeof timezone !== "string") {
    return res.status(400).json({ error: "timezone is required" });
  }
  if (typeof reminderEnabled !== "boolean") {
    return res.status(400).json({ error: "reminderEnabled must be boolean" });
  }
  if (!Number.isFinite(reminderHour) || !Number.isFinite(reminderMinute)) {
    return res.status(400).json({ error: "reminderHour and reminderMinute are required" });
  }
  if (typeof hasLoggedMealToday !== "boolean") {
    return res.status(400).json({ error: "hasLoggedMealToday must be boolean" });
  }
  if (!statusDayKey || typeof statusDayKey !== "string") {
    return res.status(400).json({ error: "statusDayKey is required" });
  }

  upsertReminderState({
    deviceId,
    expoPushToken,
    timezone,
    reminderEnabled,
    reminderHour,
    reminderMinute,
    hasLoggedMealToday,
    statusDayKey
  });

  return res.json({ ok: true });
});

