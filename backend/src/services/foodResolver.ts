import { NutrientTotals } from "../utils/types";
import { fetchOpenFoodFactsProduct, type OpenFoodFactsBarcodePayload } from "./openFoodFacts";

export type ResolvedIngredient = {
  name: string;
  assumedUnit: string;
  assumedQuantity: number;
  assumedGrams: number;
  confidence: number;
  assumptionText: string;
};

export type ResolveTextResult = {
  ingredients: ResolvedIngredient[];
  mealLabel?: string;
  notes: string[];
};

export type BarcodeResult = OpenFoodFactsBarcodePayload;

type IngredientDefaults = {
  defaultUnit: string;
  defaultGrams: number;
  gramsPerPiece?: number;
  densityGPerMl?: number;
};

export const NUTRIENT_DB: Record<string, NutrientTotals> = {
  oats: {
    calories_kcal: 389,
    protein_g: 16.9,
    carbs_g: 66.3,
    fat_g: 6.9,
    fiber_g: 10.6,
    sodium_mg: 2,
    cholesterol_mg: 0,
    omega_3_g: 0.11,
    omega_6_g: 2.42,
    potassium_mg: 429,
    calcium_mg: 54,
    iron_mg: 4.7,
    vitamin_d_iu: 0,
    vitamin_b12_ug: 0,
    magnesium_mg: 177,
    vitamin_c_mg: 0,
    vitamin_a_mcg: 0
  },
  blueberry: {
    calories_kcal: 57,
    protein_g: 0.7,
    carbs_g: 14.5,
    fat_g: 0.3,
    fiber_g: 2.4,
    sodium_mg: 1,
    cholesterol_mg: 0,
    omega_3_g: 0.04,
    omega_6_g: 0.09,
    potassium_mg: 77,
    calcium_mg: 6,
    iron_mg: 0.28,
    vitamin_d_iu: 0,
    vitamin_b12_ug: 0,
    magnesium_mg: 6,
    vitamin_c_mg: 9.7,
    vitamin_a_mcg: 3
  },
  "semi-skimmed milk": {
    calories_kcal: 50,
    protein_g: 3.4,
    carbs_g: 4.8,
    fat_g: 1.5,
    fiber_g: 0,
    sodium_mg: 44,
    cholesterol_mg: 5,
    omega_3_g: 0.04,
    omega_6_g: 0.05,
    potassium_mg: 150,
    calcium_mg: 120,
    iron_mg: 0,
    vitamin_d_iu: 40,
    vitamin_b12_ug: 0.4,
    magnesium_mg: 11,
    vitamin_c_mg: 0,
    vitamin_a_mcg: 46
  }
};

const INGREDIENT_DEFAULTS: Record<string, IngredientDefaults> = {
  oats: { defaultUnit: "g", defaultGrams: 50 },
  blueberry: { defaultUnit: "piece", defaultGrams: 20, gramsPerPiece: 2 },
  "semi-skimmed milk": { defaultUnit: "ml", defaultGrams: 200, densityGPerMl: 1.03 }
};

const ALIASES: Record<string, string> = {
  "plain oats": "oats",
  oats: "oats",
  blueberry: "blueberry",
  blueberries: "blueberry",
  melk: "semi-skimmed milk",
  "halfvolle melk": "semi-skimmed milk",
  "semi-skimmed milk": "semi-skimmed milk"
};

export class FoodResolverService {
  resolveText(text: string): ResolveTextResult {
    // TODO(ml): replace rule-based parsing with ML entity extraction.
    const notes: string[] = [];
    const ingredients: ResolvedIngredient[] = [];
    const parts = text
      .toLowerCase()
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);

    for (const part of parts) {
      const match = part.match(
        /^(\d+(?:[.,]\d+)?)\s*(g|gram|grams|ml|milliliter|milliliters|l|liter|liters|kg|kgs|pc|pcs|piece|pieces)?\s*(.*)$/
      );
      let quantity = 1;
      let unit = "piece";
      let name = part;
      if (match) {
        quantity = Number(match[1].replace(",", "."));
        const rawUnit = match[2] || "";
        name = match[3]?.trim() || "";
        if (rawUnit) {
          if (["g", "gram", "grams"].includes(rawUnit)) unit = "g";
          else if (["ml", "milliliter", "milliliters"].includes(rawUnit)) unit = "ml";
          else if (["l", "liter", "liters"].includes(rawUnit)) {
            unit = "ml";
            quantity = quantity * 1000;
          } else if (["kg", "kgs"].includes(rawUnit)) {
            unit = "g";
            quantity = quantity * 1000;
          } else unit = "piece";
        } else if (!Number.isNaN(quantity) && name) {
          unit = "piece";
        }
      }

      const normalizedName = ALIASES[name] || name;
      const defaults = INGREDIENT_DEFAULTS[normalizedName];
      if (!normalizedName || !defaults) {
        notes.push(`Unknown ingredient: ${name || part}`);
        continue;
      }

      let grams = defaults.defaultGrams;
      let confidence = 0.6;
      if (unit === "g") {
        grams = quantity;
        confidence = 0.9;
      } else if (unit === "ml") {
        const density = defaults.densityGPerMl || 1;
        grams = quantity * density;
        confidence = 0.85;
      } else {
        const gramsPerPiece = defaults.gramsPerPiece || defaults.defaultGrams;
        grams = quantity * gramsPerPiece;
        confidence = 0.6;
      }

      ingredients.push({
        name: normalizedName,
        assumedUnit: unit,
        assumedQuantity: quantity,
        assumedGrams: grams,
        confidence,
        assumptionText: `${quantity} ${unit} ${normalizedName}`
      });
    }

    if (ingredients.length === 0) {
      notes.push("No recognized ingredients found.");
    }

    return { ingredients, notes };
  }

  async resolveBarcode(barcode: string): Promise<BarcodeResult> {
    return fetchOpenFoodFactsProduct(barcode.trim());
  }
}
