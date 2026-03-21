import { describe, expect, it } from "vitest";
import { parseProductGrams } from "./openFoodFacts";

describe("parseProductGrams", () => {
  it("uses serving_quantity in g when present", () => {
    expect(
      parseProductGrams(
        { serving_quantity: 40, serving_quantity_unit: "g" },
        {}
      )
    ).toEqual({ grams: 40, needsAIGuess: false });
  });

  it("parses serving_size text (e.g. French grammes)", () => {
    expect(
      parseProductGrams({ serving_size: "Pour 40 grammes" }, {})
    ).toEqual({ grams: 40, needsAIGuess: false });
  });

  it("derives grams from per-serving vs per-100g kcal when OFF has both", () => {
    const nut = {
      "energy-kcal_100g": 539,
      "energy-kcal_serving": 80.85
    };
    const r = parseProductGrams({}, nut);
    expect(r.needsAIGuess).toBe(false);
    expect(r.grams).toBeCloseTo(15, 5);
  });

  it("returns 100g placeholder with needsAIGuess when OFF has no serving signal", () => {
    expect(parseProductGrams({ quantity: "600 g" }, {})).toEqual({
      grams: 100,
      needsAIGuess: true
    });
  });

  it("does not treat whole-pack duplicate serving_quantity as a portion", () => {
    const p = {
      serving_quantity: 600,
      serving_quantity_unit: "g",
      quantity: "600 g"
    };
    expect(parseProductGrams(p, {})).toEqual({
      grams: 100,
      needsAIGuess: true
    });
  });
});
