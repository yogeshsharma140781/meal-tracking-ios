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

/** Parse "400 g", "1 L", "330 ml" → grams (ml ≈ g for water-based foods). */
export function parseProductGrams(product: Record<string, unknown>): number {
  const serving = String(product.serving_size || "").trim();
  const mG = serving.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (mG) return parseFloat(mG[1].replace(",", "."));
  const mMl = serving.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (mMl) return parseFloat(mMl[1].replace(",", "."));

  const qty = String(product.quantity || "").trim();
  const qG = qty.match(/(\d+(?:[.,]\d+)?)\s*g\b/i);
  if (qG) return parseFloat(qG[1].replace(",", "."));
  const qMl = qty.match(/(\d+(?:[.,]\d+)?)\s*ml\b/i);
  if (qMl) return parseFloat(qMl[1].replace(",", "."));

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
  const servingGrams = parseProductGrams(p);
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
