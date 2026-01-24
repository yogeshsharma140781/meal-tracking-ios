import { NutrientTotals } from "../utils/types";

export type AttributionEntry = {
  nutrientKey: string;
  amount: number;
};

export class AttributionEngine {
  buildAttributions(totals: NutrientTotals): AttributionEntry[] {
    return Object.entries(totals).map(([key, amount]) => ({
      nutrientKey: key,
      amount
    }));
  }
}
