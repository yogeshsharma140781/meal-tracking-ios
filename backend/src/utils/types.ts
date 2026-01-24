export type NutrientTotals = {
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sodium_mg: number;
  cholesterol_mg: number;
  omega_3_g: number;
  omega_6_g: number;
  potassium_mg: number;
  calcium_mg: number;
  iron_mg: number;
  vitamin_d_iu: number;
  vitamin_b12_ug: number;
  magnesium_mg: number;
};

export const emptyTotals = (): NutrientTotals => ({
  calories_kcal: 0,
  protein_g: 0,
  carbs_g: 0,
  fat_g: 0,
  fiber_g: 0,
  sodium_mg: 0,
  cholesterol_mg: 0,
  omega_3_g: 0,
  omega_6_g: 0,
  potassium_mg: 0,
  calcium_mg: 0,
  iron_mg: 0,
  vitamin_d_iu: 0,
  vitamin_b12_ug: 0,
  magnesium_mg: 0
});
