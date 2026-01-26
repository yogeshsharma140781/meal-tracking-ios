import OpenAI from "openai";
import { NutrientTotals } from "../utils/types";

export type AiMealItem = {
  name: string;
  quantity: number;
  unit: string;
  grams: number;
  confidence: number;
  assumptionText: string;
  nutrients: NutrientTotals;
};

export type AiMealResult = {
  items: AiMealItem[];
  notes: string[];
};

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const schemaName = "meal_parse";
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    items: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string" },
          quantity: { type: "number" },
          unit: { type: "string" },
          grams: { type: "number" },
          confidence: { type: "number" },
          assumptionText: { type: "string" },
          nutrients: {
            type: "object",
            additionalProperties: false,
            properties: {
              calories_kcal: { type: "number" },
              protein_g: { type: "number" },
              carbs_g: { type: "number" },
              fat_g: { type: "number" },
              fiber_g: { type: "number" },
              sodium_mg: { type: "number" },
              cholesterol_mg: { type: "number" },
              omega_3_g: { type: "number" },
              omega_6_g: { type: "number" },
              potassium_mg: { type: "number" },
              calcium_mg: { type: "number" },
              iron_mg: { type: "number" },
              vitamin_d_iu: { type: "number" },
              vitamin_b12_ug: { type: "number" },
              magnesium_mg: { type: "number" },
              vitamin_c_mg: { type: "number" },
              vitamin_a_mcg: { type: "number" }
            },
            required: [
              "calories_kcal",
              "protein_g",
              "carbs_g",
              "fat_g",
              "fiber_g",
              "sodium_mg",
              "cholesterol_mg",
              "omega_3_g",
              "omega_6_g",
              "potassium_mg",
              "calcium_mg",
              "iron_mg",
              "vitamin_d_iu",
              "vitamin_b12_ug",
              "magnesium_mg",
              "vitamin_c_mg",
              "vitamin_a_mcg"
            ]
          }
        },
        required: [
          "name",
          "quantity",
          "unit",
          "grams",
          "confidence",
          "assumptionText",
          "nutrients"
        ]
      }
    },
    notes: { type: "array", items: { type: "string" } }
  },
  required: ["items", "notes"]
};

export const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

export const parseMealWithAi = async (text: string): Promise<AiMealResult> => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = [
    "You are a nutrition assistant.",
    "Parse the user's meal text into structured ingredients with quantities, units, and grams.",
    "Estimate nutrient totals for each ingredient (calories, macros, fiber, sodium, cholesterol, omega-3, omega-6, potassium, calcium, iron, vitamin D, vitamin B12, magnesium, vitamin C, vitamin A).",
    "Use reasonable food defaults and common household conversions.",
    "",
    "CRITICAL: Do NOT decompose composite foods into sub-ingredients. Treat composite foods as single items.",
    "Examples of composite foods that should remain as single items: cappuccino, burger, pizza, chai, Indian chai, latte, smoothie, salad (unless ingredients are explicitly listed), sandwich, wrap, curry, stew, soup, pasta dish, etc.",
    "Only break down foods into sub-ingredients if the user explicitly lists the individual ingredients (e.g., '2 eggs, 1 cup milk, 1 banana' should be parsed as separate items).",
    "If the user enters a composite food name (e.g., 'Indian chai', 'cappuccino', 'chicken curry'), return it as a SINGLE item with estimated total nutrients for that composite food.",
    "",
    "If ambiguous, include assumptionText and lower confidence.",
    "Return only JSON that matches the provided schema."
  ].join(" ");

  const response = await client.responses.create({
    model,
    input: [
      { role: "system", content: system },
      { role: "user", content: text }
    ],
    text: {
      format: {
        type: "json_schema",
        name: schemaName,
        schema,
        strict: true
      }
    }
  });

  const outputText = response.output_text || "";
  const parsed = JSON.parse(outputText) as AiMealResult;
  return parsed;
};
