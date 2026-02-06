import express from "express";
import cors from "cors";
import fs from "fs";
import path from "path";
import { mealsRouter } from "./routes/meals";
import { foodsRouter } from "./routes/foods";
import { feedbackRouter } from "./routes/feedback";
import { hasDatabase, pool } from "./db/pool";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1/meals", mealsRouter);
app.use("/v1/foods", foodsRouter);
app.use("/v1/feedback", feedbackRouter);

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
ensureSchema()
  .then(() => {
    app.listen(port, () => {
      // eslint-disable-next-line no-console
      console.log(`Meal Tracking API listening on ${port}`);
    });
  })
  .catch((err) => {
    console.error("Failed to initialize database:", err);
    process.exit(1);
  });
