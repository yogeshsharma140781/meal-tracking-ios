import { Router, Request, Response } from "express";
import { randomUUID } from "crypto";
import { hasDatabase, pool } from "../db/pool";

export const feedbackRouter = Router();

/**
 * POST /v1/feedback
 * Submit user feedback (rating 1-5, optional text)
 */
feedbackRouter.post("/", async (req: Request, res: Response) => {
  try {
    const { rating, text } = req.body as { rating?: number; text?: string };

    if (typeof rating !== "number" || rating < 1 || rating > 5) {
      res.status(400).json({ error: "rating must be a number between 1 and 5" });
      return;
    }

    const textVal = typeof text === "string" ? text.slice(0, 500) : null;

    if (!hasDatabase || !pool) {
      res.status(503).json({
        error: "Database not configured. Feedback cannot be stored."
      });
      return;
    }

    const id = randomUUID();
    await pool.query(
      `insert into feedback (id, rating, text) values ($1, $2, $3)`,
      [id, rating, textVal]
    );

    res.status(201).json({ id, rating, text: textVal });
  } catch (err) {
    console.error("Feedback POST error:", err);
    res.status(500).json({ error: "Failed to save feedback" });
  }
});

/**
 * GET /v1/feedback/export
 * Export all feedback as CSV for spreadsheet import
 */
feedbackRouter.get("/export", async (_req: Request, res: Response) => {
  try {
    if (!hasDatabase || !pool) {
      res.status(503).json({
        error: "Database not configured. Export not available."
      });
      return;
    }

    const { rows } = await pool.query(
      `select id, rating, text, created_at from feedback order by created_at desc`
    );

    const header = "id,rating,text,created_at\n";
    const csvRows = rows.map(
      (r: { id: string; rating: number; text: string | null; created_at: string }) => {
        const escaped = (r.text ?? "")
          .replace(/"/g, '""')
          .replace(/\r?\n/g, " ");
        const textCol = `"${escaped}"`;
        return `${r.id},${r.rating},${textCol},${r.created_at}`;
      }
    );
    const csv = header + csvRows.join("\n");

    res.setHeader("Content-Type", "text/csv");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="feedback-${new Date().toISOString().slice(0, 10)}.csv"`
    );
    res.send(csv);
  } catch (err) {
    console.error("Feedback export error:", err);
    res.status(500).json({ error: "Failed to export feedback" });
  }
});
