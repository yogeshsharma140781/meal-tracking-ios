import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockCreate } = vi.hoisted(() => ({
  mockCreate: vi.fn()
}));

vi.mock("openai", () => ({
  default: class MockOpenAI {
    responses = { create: mockCreate };
  }
}));

import { parseMealPhotoWithAi } from "./aiNutrition";

describe("parseMealPhotoWithAi (mocked OpenAI)", () => {
  beforeEach(() => {
    mockCreate.mockReset();
    process.env.OPENAI_API_KEY = "test-key-for-mock";
  });

  it("computes total as quantity × gramsPerUnit when unit is unchanged", async () => {
    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({
        descriptionText: "5 piece pineapple",
        notes: [],
        items: [
          {
            name: "pineapple",
            quantity: 5,
            unit: "piece",
            gramsPerUnit: 28,
            estimatedGrams: 140,
            confidence: 0.85,
            assumptionText: "Cut fruit visible."
          }
        ]
      })
    });

    const result = await parseMealPhotoWithAi("dGVzdA==");
    expect(result.items).toHaveLength(1);
    expect(result.items[0].estimatedGrams).toBe(140);
    expect(result.items[0].gramsPerUnit).toBe(28);
    expect(result.items[0].unit).toBe("piece");
  });

  it("uses direct g/ml mass from quantity (ignores per-unit semantics)", async () => {
    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({
        descriptionText: "200 g cooked rice",
        notes: [],
        items: [
          {
            name: "cooked rice",
            quantity: 200,
            unit: "g",
            gramsPerUnit: 1,
            estimatedGrams: 200,
            confidence: 0.9,
            assumptionText: "Stated mass."
          }
        ]
      })
    });

    const result = await parseMealPhotoWithAi("dGVzdA==");
    expect(result.items[0].estimatedGrams).toBe(200);
    expect(result.items[0].gramsPerUnit).toBeUndefined();
  });

  it("converts liters to grams via quantity × 1000", async () => {
    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({
        descriptionText: "0.5 L water",
        notes: [],
        items: [
          {
            name: "water",
            quantity: 0.5,
            unit: "l",
            gramsPerUnit: 1000,
            estimatedGrams: 500,
            confidence: 0.9,
            assumptionText: "Beverage."
          }
        ]
      })
    });

    const result = await parseMealPhotoWithAi("dGVzdA==");
    expect(result.items[0].estimatedGrams).toBe(500);
    expect(result.items[0].gramsPerUnit).toBeUndefined();
  });

  it("caps unrealistic gramsPerUnit for grapes (avoids 10×50g=500g)", async () => {
    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({
        descriptionText: "10 piece grapes",
        notes: [],
        items: [
          {
            name: "grapes",
            quantity: 10,
            unit: "piece",
            gramsPerUnit: 50,
            estimatedGrams: 500,
            confidence: 0.7,
            assumptionText: "Model overestimated per piece."
          }
        ]
      })
    });

    const result = await parseMealPhotoWithAi("dGVzdA==");
    expect(result.items[0].estimatedGrams).toBe(80);
    expect(result.items[0].gramsPerUnit).toBe(8);
  });

  it("when portion rules change unit (curry + piece → bowl), uses normalized total not piece gramsPerUnit", async () => {
    mockCreate.mockResolvedValue({
      output_text: JSON.stringify({
        descriptionText: "1 piece chhole",
        notes: [],
        items: [
          {
            name: "chhole",
            quantity: 1,
            unit: "piece",
            gramsPerUnit: 40,
            estimatedGrams: 40,
            confidence: 0.7,
            assumptionText: "Chickpea curry."
          }
        ]
      })
    });

    const result = await parseMealPhotoWithAi("dGVzdA==");
    expect(result.items[0].unit).toBe("bowl");
    expect(result.items[0].estimatedGrams).toBe(180);
  });
});
