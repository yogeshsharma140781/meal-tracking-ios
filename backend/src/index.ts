import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { mealsRouter } from "./routes/meals";
import { foodsRouter } from "./routes/foods";
import { feedbackRouter } from "./routes/feedback";
import { revenuecatRouter } from "./routes/revenuecat";
import { notificationsRouter } from "./routes/notifications";
import { hasDatabase, pool } from "./db/pool";
import { startReminderScheduler } from "./services/notifications";
import { hasOpenAi } from "./services/aiNutrition";

const app = express();

app.use(cors());
app.use(express.json({ limit: "12mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

// Same health check under /v1 for docs and quick pings (e.g. Safari on device).
app.get("/v1/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1/meals", mealsRouter);
app.use("/v1/foods", foodsRouter);
app.use("/v1/feedback", feedbackRouter);
app.use("/v1/revenuecat", revenuecatRouter);
app.use("/v1/notifications", notificationsRouter);

const ensureSchema = async () => {
  if (!hasDatabase || !pool) return;
  try {
    const schemaPath = path.join(__dirname, "../schema.sql");
    const schema = fs.readFileSync(schemaPath, "utf8");
    await pool.query(schema);
    console.log("Database schema ready");
  } catch (err) {
    console.error("Schema init error:", err);
    throw err;
  }
};

const port = Number(process.env.PORT) || 4000;
/** Bind address (default all interfaces so phones on the same Wi‑Fi can reach your Mac). */
const host = process.env.HOST || "0.0.0.0";
ensureSchema()
  .then(() => {
    startReminderScheduler();
    app.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`Meal Tracking API listening on http://${host}:${port}`);
      console.log(
        `OpenAI (nl-log / photo-describe): ${hasOpenAi ? "enabled" : "DISABLED — OPENAI_API_KEY missing at process start"}`
      );
      if (!hasDatabase) {
        console.warn("⚠️  Database not configured - some features will be unavailable");
      }
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    console.warn("⚠️  App will continue without database features");
    // Still start the app even if database fails
    startReminderScheduler();
    app.listen(port, host, () => {
      // eslint-disable-next-line no-console
      console.log(`Meal Tracking API listening on http://${host}:${port} (without database)`);
      console.log(
        `OpenAI (nl-log / photo-describe): ${hasOpenAi ? "enabled" : "DISABLED — OPENAI_API_KEY missing at process start"}`
      );
    });
  });
