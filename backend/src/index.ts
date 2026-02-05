import express from "express";
import cors from "cors";
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

const ensureFeedbackTable = async () => {
  if (!hasDatabase || !pool) return;
  try {
    await pool.query(`
      create table if not exists feedback (
        id uuid primary key,
        rating smallint not null check (rating >= 1 and rating <= 5),
        text text,
        created_at timestamptz not null default now()
      )
    `);
    console.log("Feedback table ready");
  } catch (err) {
    console.error("Feedback table init error:", err);
  }
};

const port = Number(process.env.PORT) || 4000;
ensureFeedbackTable().then(() => {
  app.listen(port, () => {
    // eslint-disable-next-line no-console
    console.log(`Meal Tracking API listening on ${port}`);
  });
});
