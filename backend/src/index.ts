import express from "express";
import cors from "cors";
import { mealsRouter } from "./routes/meals";
import { foodsRouter } from "./routes/foods";

const app = express();

app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use("/v1/meals", mealsRouter);
app.use("/v1/foods", foodsRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Meal Tracking API listening on ${port}`);
});
