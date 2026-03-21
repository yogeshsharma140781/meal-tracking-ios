import { Router } from "express";
import { FoodResolverService } from "../services/foodResolver";

export const foodsRouter = Router();
const foodResolver = new FoodResolverService();

foodsRouter.post("/resolve-text", (req, res) => {
  const text = String(req.body?.text || "").trim();
  if (!text) {
    return res.status(400).json({ error: "text is required" });
  }
  const result = foodResolver.resolveText(text);
  return res.json(result);
});

foodsRouter.get("/barcode/:barcode", async (req, res) => {
  const barcode = String(req.params.barcode || "").trim();
  if (!barcode) {
    return res.status(400).json({ error: "barcode is required" });
  }
  try {
    const result = await foodResolver.resolveBarcode(barcode);
    if (!result.found) {
      return res.status(404).json({
        error: "Product not found for this barcode",
        ...result
      });
    }
    return res.json(result);
  } catch (err) {
    console.error("barcode lookup failed:", err);
    return res.status(502).json({ error: "Barcode lookup failed" });
  }
});
