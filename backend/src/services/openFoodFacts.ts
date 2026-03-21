import { NutrientTotals, emptyTotals } from "../utils/types";

const OFF_BASE = "https://world.openfoodfacts.org/api/v2/product";
const USER_AGENT =
  process.env.OPENFOODFACTS_USER_AGENT ||
  "JoulMealTracker/1.0 (https://github.com/meal-tracking; dev)";

function num(v: unknown): number | undefined {
  if (v === null || v === undefined) return undefined;
  const n = typeof v === "number" ? v : parseFloat(String(v));
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Normalize OFF free-text (NBSP, thin spaces) and pull first plausible grams/ml from strings like:
 * "40 g", "40g", "40 grammes", "40 gr", "1 portion (40 g)", "Pour 40 g", "40 ml".
 */
function parseServingSizeString(raw: string): number | null {
  const s = raw
    .replace(/\u00A0/g, " ")
    .replace(/\u202F/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!s) return null;

  // Parenthetical grams: "1 portion (40 g)" / "(40g)"
  const paren = s.match(/\(\s*(\d+(?:[.,]\d+)?)\s*(?:g|gram|gramme|grammes|gr)\s*\)/i);
  if (paren) {
    const n = parseFloat(paren[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }

  // g / grammes / gr (French packs often use "40 g" or "40 grammes")
  const mG = s.match(
    /(\d+(?:[.,]\d+)?)\s*(?:g|gram|gramme|grammes|gr)\b/i
  );
  if (mG) {
    const n = parseFloat(mG[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }

  const mMl = s.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (mMl) {
    const n = parseFloat(mMl[1].replace(",", "."));
    if (Number.isFinite(n) && n > 0) return n;
  }

  return null;
}

/**
 * Derive serving grams when OFF has per-serving + per-100g nutriments (common on EU labels).
 */
function deriveServingGramsFromNutriments(n: Record<string, unknown>): number | null {
  // Prefer explicit per-100g; avoid plain energy-kcal (may be per serving on some rows).
  const k100 =
    num(n["energy-kcal_100g"]) ??
    (num(n["energy_100g"]) != null ? num(n["energy_100g"])! / 4.184 : undefined);
  const kServ = num(n["energy-kcal_serving"]);

  if (k100 != null && k100 > 0 && kServ != null && kServ > 0) {
    const g = (kServ / k100) * 100;
    if (g >= 0.5 && g <= 5000) return Math.round(g * 100) / 100;
  }

  const p100 = num(n["proteins_100g"]);
  const pServ = num(n["proteins_serving"]);
  if (p100 != null && p100 > 0 && pServ != null && pServ > 0) {
    const g = (pServ / p100) * 100;
    if (g >= 0.5 && g <= 5000) return Math.round(g * 100) / 100;
  }

  const c100 = num(n["carbohydrates_100g"]);
  const cServ = num(n["carbohydrates_serving"]);
  if (c100 != null && c100 > 0 && cServ != null && cServ > 0) {
    const g = (cServ / c100) * 100;
    if (g >= 0.5 && g <= 5000) return Math.round(g * 100) / 100;
  }

  return null;
}

/**
 * OFF fields + nutriments → grams for one logged portion (defaults 100 if unknown).
 * Prefer: serving_quantity + unit → serving_size text → nutriments ratio → product quantity (often whole pack).
 */
export function parseProductGrams(
  product: Record<string, unknown>,
  nutriments?: Record<string, unknown>
): number {
  // 1) Normalized numeric fields (often set when serving_size text is empty or inconsistent)
  const sq = num(product.serving_quantity);
  const unit = String(product.serving_quantity_unit || "")
    .toLowerCase()
    .trim();
  if (sq != null && sq > 0) {
    if (unit === "g" || unit === "gram" || unit === "grams") return sq;
    if (unit === "mg") return sq / 1000;
    if (unit === "ml" || unit === "cl") return unit === "cl" ? sq * 10 : sq;
    if (unit === "l") return sq * 1000;
    // OFF sometimes omits unit when it's grams (e.g. 40)
    if (unit === "" && sq >= 0.5 && sq <= 5000) return sq;
  }

  // 2) Free-text serving_size
  const servingStr = String(product.serving_size || "");
  const fromServing = parseServingSizeString(servingStr);
  if (fromServing != null) return fromServing;

  // 3) Infer from per-serving vs per-100g nutrients (common for EU labels / French products)
  if (nutriments && Object.keys(nutriments).length > 0) {
    const derived = deriveServingGramsFromNutriments(nutriments);
    if (derived != null) return derived;
  }

  // 4) Whole-pack quantity (last resort — can be 500 g while serving is 40 g)
  const qtyStr = String(product.quantity || "");
  const fromQty = parseServingSizeString(qtyStr);
  if (fromQty != null) return fromQty;

  return 100;
}

function nutrimentsToPer100g(n: Record<string, unknown>): { per100: NutrientTotals; missing: string[] } {
  const missing: string[] = [];
  const kcal =
    num(n["energy-kcal_100g"]) ??
    num(n["energy-kcal"]) ??
    (num(n["energy_100g"]) != null ? num(n["energy_100g"])! / 4.184 : undefined);

  const protein = num(n["proteins_100g"]);
  const carbs = num(n["carbohydrates_100g"]);
  const fat = num(n["fat_100g"]);
  const fiber = num(n["fiber_100g"]) ?? 0;

  let sodiumMg: number | undefined = num(n["sodium_100g"]);
  if (sodiumMg != null) {
    // OFF often stores sodium_100g in grams → mg
    if (sodiumMg < 1) sodiumMg *= 1000;
  } else {
    const saltG = num(n["salt_100g"]);
    if (saltG != null) sodiumMg = saltG * 1000 * 0.4;
  }

  if (kcal == null) missing.push("calories_kcal");
  if (protein == null) missing.push("protein_g");
  if (carbs == null) missing.push("carbs_g");
  if (fat == null) missing.push("fat_g");

  const per100: NutrientTotals = {
    ...emptyTotals(),
    calories_kcal: kcal ?? 0,
    protein_g: protein ?? 0,
    carbs_g: carbs ?? 0,
    fat_g: fat ?? 0,
    fiber_g: fiber,
    sodium_mg: sodiumMg ?? 0,
    cholesterol_mg: num(n["cholesterol_100g"]) != null ? num(n["cholesterol_100g"])! * 1000 : 0,
    omega_3_g: num(n["omega-3-fat_100g"]) ?? 0,
    omega_6_g: num(n["omega-6-fat_100g"]) ?? 0,
    potassium_mg: num(n["potassium_100g"]) ?? 0,
    calcium_mg: num(n["calcium_100g"]) ?? 0,
    iron_mg: num(n["iron_100g"]) ?? 0,
    vitamin_d_iu: num(n["vitamin-d_100g"]) ?? 0,
    vitamin_b12_ug: num(n["vitamin-b12_100g"]) ?? 0,
    magnesium_mg: num(n["magnesium_100g"]) ?? 0,
    vitamin_c_mg: num(n["vitamin-c_100g"]) ?? 0,
    vitamin_a_mcg: num(n["vitamin-a_100g"]) ?? 0
  };

  return { per100, missing };
}

function scaleTotals(t: NutrientTotals, factor: number): NutrientTotals {
  const out = { ...t };
  (Object.keys(out) as (keyof NutrientTotals)[]).forEach((k) => {
    out[k] = (out[k] as number) * factor;
  });
  return out;
}

export type OpenFoodFactsBarcodePayload = {
  found: boolean;
  barcode: string;
  productName: string;
  brand?: string;
  servingGrams: number;
  nutrients?: NutrientTotals;
  nutrientsPer100g?: NutrientTotals;
  confidence: number;
  missingFields: string[];
  source: "openfoodfacts";
  notes?: string[];
};

export async function fetchOpenFoodFactsProduct(barcode: string): Promise<OpenFoodFactsBarcodePayload> {
  const clean = barcode.replace(/\D/g, "");
  if (clean.length < 8) {
    return {
      found: false,
      barcode: clean,
      productName: "",
      servingGrams: 100,
      confidence: 0,
      missingFields: ["barcode"],
      source: "openfoodfacts",
      notes: ["Invalid barcode length"]
    };
  }

  const url = `${OFF_BASE}/${encodeURIComponent(clean)}`;
  const res = await fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      Accept: "application/json"
    }
  });

  if (!res.ok) {
    return {
      found: false,
      barcode: clean,
      productName: "",
      servingGrams: 100,
      confidence: 0,
      missingFields: ["network"],
      source: "openfoodfacts",
      notes: [`HTTP ${res.status}`]
    };
  }

  const body = (await res.json()) as {
    status?: number;
    product?: Record<string, unknown>;
  };

  if (body.status !== 1 || !body.product) {
    return {
      found: false,
      barcode: clean,
      productName: "",
      servingGrams: 100,
      confidence: 0,
      missingFields: ["product"],
      source: "openfoodfacts",
      notes: ["Product not found in Open Food Facts"]
    };
  }

  const p = body.product;
  const nut = (p.nutriments || {}) as Record<string, unknown>;
  const { per100, missing } = nutrimentsToPer100g(nut);
  const servingGrams = parseProductGrams(p, nut);
  const factor = servingGrams / 100;
  const nutrients = scaleTotals(per100, factor);

  const productName =
    String(p.product_name || p.product_name_en || p.generic_name || "Unknown product").trim() || "Unknown product";
  const brand = String(p.brands || "")
    .split(",")[0]
    ?.trim();

  const confidence = missing.length === 0 ? 0.85 : missing.length < 3 ? 0.65 : 0.45;

  return {
    found: true,
    barcode: clean,
    productName,
    brand: brand || undefined,
    servingGrams,
    nutrients,
    nutrientsPer100g: per100,
    confidence,
    missingFields: missing,
    source: "openfoodfacts",
    notes: [`Logged portion: ${Math.round(servingGrams)} g (from pack / serving where available).`]
  };
}
