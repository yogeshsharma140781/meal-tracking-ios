import { NutrientTotals, emptyTotals } from "../utils/types";

export class NutritionCalculator {
  calculateTotals(per100g: NutrientTotals | null, grams: number): NutrientTotals {
    if (!per100g || grams <= 0) {
      return emptyTotals();
    }
    const factor = grams / 100;
    return {
      calories_kcal: per100g.calories_kcal * factor,
      protein_g: per100g.protein_g * factor,
      carbs_g: per100g.carbs_g * factor,
      fat_g: per100g.fat_g * factor,
      fiber_g: per100g.fiber_g * factor,
      sodium_mg: per100g.sodium_mg * factor,
      cholesterol_mg: per100g.cholesterol_mg * factor,
      omega_3_g: per100g.omega_3_g * factor,
      omega_6_g: per100g.omega_6_g * factor,
      potassium_mg: per100g.potassium_mg * factor,
      calcium_mg: per100g.calcium_mg * factor,
      iron_mg: per100g.iron_mg * factor,
      vitamin_d_iu: per100g.vitamin_d_iu * factor,
      vitamin_b12_ug: per100g.vitamin_b12_ug * factor,
      magnesium_mg: per100g.magnesium_mg * factor
    };
  }
}
