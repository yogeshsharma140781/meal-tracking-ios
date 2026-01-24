## Core Domain Services (TypeScript-style)

Assumptions:
- Food resolver returns ingredient candidates with confidence and default portions.
- Nutrition calculator uses per-100g nutrient profiles and portion grams.

Trade-offs (brief):
- Rule-based parsing is fast and predictable, but less flexible than ML.
- Storing assumptions per user improves speed and accuracy over time.

### FoodResolverService

Responsibilities:
- text -> ingredient candidates + default units + confidence
- barcode -> packaged product + fallback nutrition if missing

Interface (TypeScript-style):

export interface ResolvedIngredient {
  name: string;
  ingredientId?: string;
  assumedUnit: string;
  assumedQuantity: number;
  assumedGrams: number;
  confidence: number; // 0..1
  assumptionText: string;
}

export interface ResolveTextResult {
  ingredients: ResolvedIngredient[];
  notes: string[];
}

export interface BarcodeResult {
  productName: string;
  foodItemId?: string;
  nutrients?: NutrientTotals;
  confidence: number;
  missingFields: string[];
}

export class FoodResolverService {
  async resolveText(text: string, userId: string): Promise<ResolveTextResult> {
    // TODO(ml): replace rule-based parsing with ML intent + entity model.
    // 1) tokenize words
    // 2) map to known ingredients using USDA synonym map
    // 3) apply user-specific portion assumptions
    // 4) attach default household units (bowl, cup, piece)
    return { ingredients: [], notes: [] };
  }

  async resolveBarcode(barcode: string): Promise<BarcodeResult> {
    // 1) query Open Food Facts
    // 2) normalize nutrients to per-100g
    // 3) persist barcode_products, food_items, nutrient_profiles
    return {
      productName: "",
      confidence: 0.5,
      missingFields: []
    };
  }
}

### NutritionCalculator

export interface NutrientTotals {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
}

export class NutritionCalculator {
  // Converts per-100g nutrient profile to actual totals.
  calculateTotals(per100g: NutrientTotals, grams: number): NutrientTotals {
    const factor = grams / 100;
    return {
      calories_kcal: per100g.calories_kcal * factor,
      protein_g: per100g.protein_g * factor,
      carbs_g: per100g.carbs_g * factor,
      fat_g: per100g.fat_g * factor,
      fiber_g: per100g.fiber_g * factor,
      sodium_mg: per100g.sodium_mg * factor,
      cholesterol_mg: per100g.cholesterol_mg * factor
    };
  }
}

### AttributionEngine

export interface AttributionEntry {
  nutrientKey: string;
  mealItemId: string;
  amount: number;
}

export class AttributionEngine {
  // Creates nutrient -> ingredient -> meal -> day attribution rows.
  buildAttributions(
    mealItemId: string,
    totals: NutrientTotals
  ): AttributionEntry[] {
    return Object.entries(totals).map(([key, amount]) => ({
      nutrientKey: key,
      mealItemId,
      amount
    }));
  }
}
