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

// Post-process AI output to enforce supplement doses from the name text,
// in case the model under-fills specific nutrient fields.
const applySupplementDoseOverrides = (result: AiMealResult): AiMealResult => {
  const doseRegexMg = /(\d+(?:\.\d+)?)\s*mg\b/i;
  const doseRegexMcg = /(\d+(?:\.\d+)?)\s*mcg\b/i;
  const doseRegexIU = /(\d+(?:\.\d+)?)\s*iu\b/i;

  const items = result.items.map((item) => {
    const name = item.name.toLowerCase();
    const nutrients = { ...item.nutrients };

    const textForDose = item.name + " " + (item.assumptionText || "");

    // Omega‑3 supplements: set omega_3_g from mg in name (e.g. "Omega 3 500mg")
    if (name.includes("omega") && name.includes("3")) {
      const m = textForDose.match(doseRegexMg);
      if (m) {
        const mg = parseFloat(m[1]);
        if (Number.isFinite(mg) && mg > 0) {
          nutrients.omega_3_g = mg / 1000; // mg → g
        }
      }
    }

    // Vitamin C 1000mg → vitamin_c_mg: 1000
    if (name.includes("vitamin c")) {
      const m = textForDose.match(doseRegexMg);
      if (m) {
        const mg = parseFloat(m[1]);
        if (Number.isFinite(mg) && mg > 0) {
          nutrients.vitamin_c_mg = mg;
        }
      }
    }

    // Vitamin D 2000 IU → vitamin_d_iu: 2000
    if (name.includes("vitamin d")) {
      const m = textForDose.match(doseRegexIU);
      if (m) {
        const iu = parseFloat(m[1]);
        if (Number.isFinite(iu) && iu > 0) {
          nutrients.vitamin_d_iu = iu;
        }
      }
    }

    // Vitamin A 3000 mcg → vitamin_a_mcg: 3000
    if (name.includes("vitamin a")) {
      const m = textForDose.match(doseRegexMcg);
      if (m) {
        const mcg = parseFloat(m[1]);
        if (Number.isFinite(mcg) && mcg > 0) {
          nutrients.vitamin_a_mcg = mcg;
        }
      }
    }

    // Magnesium 400mg → magnesium_mg: 400
    if (name.includes("magnesium")) {
      const m = textForDose.match(doseRegexMg);
      if (m) {
        const mg = parseFloat(m[1]);
        if (Number.isFinite(mg) && mg > 0) {
          nutrients.magnesium_mg = mg;
        }
      }
    }

    // Potassium 99mg → potassium_mg: 99
    if (name.includes("potassium")) {
      const m = textForDose.match(doseRegexMg);
      if (m) {
        const mg = parseFloat(m[1]);
        if (Number.isFinite(mg) && mg > 0) {
          nutrients.potassium_mg = mg;
        }
      }
    }

    // For obvious tablet/capsule supplements, ensure grams is a small, realistic value.
    const isSupplement =
      /\b(tablet|tab|capsule|caps|pill|softgel)\b/i.test(item.name) ||
      /\b(tablet|tab|capsule|caps|pill|softgel)\b/i.test(item.assumptionText || "");

    let grams = item.grams;
    if (isSupplement && (!grams || grams <= 0 || grams > 20)) {
      grams = 1; // assume ~1 g per tablet/capsule if unclear or unrealistic
    }

    return {
      ...item,
      grams,
      nutrients
    };
  });

  return { ...result, items };
};

export const parseMealWithAi = async (text: string): Promise<AiMealResult> => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = [
    "You are a nutrition assistant.",
    "Parse the user's meal text into structured ingredients with quantities, units, and grams.",
    "Estimate nutrient totals for each ingredient (calories, macros, fiber, sodium, cholesterol, omega-3, omega-6, potassium, calcium, iron, vitamin D, vitamin B12, magnesium, vitamin C, vitamin A).",
    "Use reasonable food defaults and common household conversions.",
    "",
    "SERVING SIZES: When estimating grams, use accurate standard serving sizes for packaged/prepared foods.",
    "Examples: '1 packet Maggi Masala' or '1 Maggi Masala packet' -> ~70g (standard instant noodle packet). '1 packet' of any branded instant noodle -> typically 70-80g. '1 slice bread' -> ~30g. '1 cup rice' -> ~200g cooked, ~80g uncooked.",
    "For items specified as '1 packet', '1 piece', '1 serving', etc., use realistic standard weights based on the food type and common product sizes.",
    "",
    "CRITICAL: Do NOT decompose composite foods into sub-ingredients. Treat composite foods as single items.",
    "Examples of composite foods that should remain as single items: cappuccino, burger, pizza, chai, Indian chai, latte, smoothie, salad (unless ingredients are explicitly listed), sandwich, wrap, curry, stew, soup, pasta dish, etc.",
    "Only break down foods into sub-ingredients if the user explicitly lists the individual ingredients (e.g., '2 eggs, 1 cup milk, 1 banana' should be parsed as separate items).",
    "If the user enters a composite food name (e.g., 'Indian chai', 'cappuccino', 'chicken curry'), return it as a SINGLE item with estimated total nutrients for that composite food.",
    "",
    "SUPPLEMENTS: When the user logs supplements, parse as a single item and set nutrients from the stated dose. Use grams ~1 for a typical tablet/capsule if not specified.",
    "Examples: Omega-3: 'Omega 3 tablet 500mg' or '1 Omega 3 500mg' -> omega_3_g: 0.5 (500 mg = 0.5 g). Vitamin C: 'Vitamin C 1000mg' -> vitamin_c_mg: 1000. Vitamin D: 'Vitamin D 2000 IU' -> vitamin_d_iu: 2000. Vitamin A: 'Vitamin A 3000 mcg' -> vitamin_a_mcg: 3000. Magnesium: 'Magnesium 400mg' -> magnesium_mg: 400. Potassium: 'Potassium 99mg' -> potassium_mg: 99. Apply the same for any supplement with a stated dose; set the matching nutrient from that dose.",
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
  return applySupplementDoseOverrides(parsed);
};
