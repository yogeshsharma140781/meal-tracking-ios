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

export type AiPhotoMealItem = {
  name: string;
  quantity: number;
  unit: string;
  estimatedGrams: number;
  confidence: number;
  assumptionText: string;
  /** Typical grams for one unit (from vision model when structured units are used). */
  gramsPerUnit?: number;
};

export type AiPhotoMealResult = {
  items: AiPhotoMealItem[];
  descriptionText: string;
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

const photoSchemaName = "meal_photo_parse";
const photoSchema = {
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
          /** Total grams ≈ quantity × gramsPerUnit (should be consistent). */
          estimatedGrams: { type: "number" },
          /** Typical grams for ONE unit (piece, slice, bowl, cup, tbsp, serving, …). Use food knowledge + what you see; not pixel-scale weighing. For unit "g" or "ml", use 1. */
          gramsPerUnit: { type: "number" },
          confidence: { type: "number" },
          assumptionText: { type: "string" }
        },
        required: [
          "name",
          "quantity",
          "unit",
          "estimatedGrams",
          "gramsPerUnit",
          "confidence",
          "assumptionText"
        ]
      }
    },
    descriptionText: { type: "string" },
    notes: { type: "array", items: { type: "string" } }
  },
  required: ["items", "descriptionText", "notes"]
};

/** Direct mass/volume units: total grams = quantity (with L → ml×1000). */
function totalGramsFromDirectMassVolume(quantity: number, unitRaw: string): number | null {
  const q = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
  const u = unitRaw.trim().toLowerCase().replace(/\s+/g, "");
  if (u === "g" || u === "gram" || u === "grams") return q;
  if (u === "ml" || u === "mls" || u === "milliliter" || u === "milliliters") return q;
  if (u === "l" || u === "liter" || u === "liters") return q * 1000;
  return null;
}

const GRAMS_PER_UNIT_MIN = 0.5;
const GRAMS_PER_UNIT_MAX = 3500;

function clampGramsPerUnit(g: number): number {
  if (!Number.isFinite(g) || g <= 0) return 50;
  return Math.min(GRAMS_PER_UNIT_MAX, Math.max(GRAMS_PER_UNIT_MIN, g));
}

/** Compare units after normalization (plural/synonyms). */
function canonicalPortionUnit(u: string): string {
  const x = u.trim().toLowerCase().replace(/\s+/g, "");
  const map: Record<string, string> = {
    pieces: "piece",
    pcs: "piece",
    pc: "piece",
    bowls: "bowl",
    cups: "cup",
    slices: "slice",
    servings: "serving",
    grams: "g",
    gram: "g",
    milliliter: "ml",
    milliliters: "ml",
    mls: "ml",
    liter: "l",
    liters: "l",
    tablespoons: "tbsp",
    tablespoon: "tbsp",
    teaspoons: "tsp",
    teaspoon: "tsp"
  };
  return map[x] ?? x;
}

export const parseMealPhotoWithAi = async (
  imageBase64: string,
  mimeType = "image/jpeg"
): Promise<AiPhotoMealResult> => {
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const safeMimeType = /^image\/[a-zA-Z0-9.+-]+$/.test(mimeType) ? mimeType : "image/jpeg";
  const cleanedBase64 = imageBase64
    .replace(/^data:image\/[a-zA-Z0-9.+-]+;base64,/, "")
    .replace(/\s+/g, "");
  const dataUrl = `data:${safeMimeType};base64,${cleanedBase64}`;

  const system = [
    "You are a nutrition assistant analyzing meal photos.",
    "Identify visible foods in the photo. For portions, prioritize an accurate COUNT of discrete items and a sensible STRUCTURED unit (piece, slice, bowl, cup, g, ml, tbsp).",
    "For EVERY item you MUST fill gramsPerUnit: typical grams for ONE of that unit in a normal adult meal (combine what you see with common reference portions—USDA-style / home / restaurant / cultural norms).",
    "Do not pretend to weigh pixels; use typical sizes. piece = one discrete item; slice = one slice; bowl/cup/serving = one filled portion; tbsp/tsp = level spoon.",
    "For unit g or ml, set gramsPerUnit to 1 (total mass is quantity × 1). For L use quantity in liters and gramsPerUnit 1000, or prefer ml.",
    "Set estimatedGrams to quantity × gramsPerUnit (they must be consistent).",
    "Keep item names concise and practical for logging (e.g., 'grilled chicken', 'white rice').",
    "Support global cuisines and choose culturally accurate names when identifiable (Indian, East/Southeast Asian, Middle Eastern, African, European, Latin American, etc.).",
    "Be careful with lookalike foods and do not default to generic labels when a specific regional dish is plausible.",
    "Disambiguation guidance:",
    "- Poha vs cooked rice: If flattened flakes, yellow turmeric tint, peanuts/curry leaves/onion/chili are visible, prefer 'poha' or 'kanda poha' (not plain cooked rice). Use 'flattened rice poha' if needed.",
    "- Oats vs granola: Granola is clustered/crunchy and commonly has visible nuts/seeds/dried fruit; cooked oats is porridge-like and soft; raw oats look like loose flakes. Do not label oats as granola unless clear clusters/mix-ins are visible.",
    "- Upma/poha/pulao/rice: choose the closest Indian dish name when visual cues support it.",
    "- Chickpea curry naming: Prefer common Indian log name 'chhole' for chickpea/chana curry unless a clearly different dish is visible.",
    "- For curries, dals, gravies, soups, and stews, do NOT use 'piece' as a unit; prefer 'bowl', 'cup', or 'serving'.",
    "- Choose units that match each specific food type across cuisines. Avoid impossible pairs (e.g., 'piece rice', 'piece ramen broth', 'piece risotto').",
    "- Unit examples by food type: rice/noodles/porridge/curry/stew/salad -> bowl|cup|serving; discrete items (dumpling, sushi piece, taco, sandwich, bread slice, egg, cut fruit) -> piece|slice; drinks -> cup|ml.",
    "When uncertain between two similar foods, pick the most visually likely one, lower confidence (<=0.65), and mention alternatives in assumptionText.",
    "If quantity is uncertain, use standard serving assumptions and explain in assumptionText.",
    "Prefer units like g, piece, cup, tbsp, tsp, serving, bowl, slice.",
    "Set confidence from 0 to 1.",
    "Generate descriptionText as newline-separated lines in this format: '<quantity> <unit> <food name>'.",
    "Return only JSON matching the provided schema."
  ].join(" ");

  const response = await client.responses.create({
    model,
    input: [
      {
        role: "system",
        content: [{ type: "input_text", text: system }]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: "Analyze this meal photo and estimate food items with portions for meal logging."
          },
          { type: "input_image", image_url: dataUrl }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: photoSchemaName,
        schema: photoSchema,
        strict: true
      }
    }
  } as any);

  const outputText = response.output_text || "";
  const parsed = JSON.parse(outputText) as AiPhotoMealResult;

  const normalizeIndianPhotoItemName = (name: string): string => {
    const lower = name.toLowerCase();
    if (
      /\b(chickpea|chick peas|chana)\b/.test(lower) &&
      /\b(curry|masala|gravy)\b/.test(lower)
    ) {
      return "chhole";
    }
    if (/\bblack chickpea|kala chana\b/.test(lower)) {
      return "chhole";
    }
    return name.trim();
  };

  const estimateQuantityFromGrams = (grams: number, perUnitGrams: number): number => {
    if (!Number.isFinite(grams) || grams <= 0 || !Number.isFinite(perUnitGrams) || perUnitGrams <= 0) return 1;
    const raw = grams / perUnitGrams;
    if (raw < 0.75) return 0.5;
    return Math.max(1, Math.round(raw * 2) / 2);
  };

  const getFoodPortionCategory = (
    name: string
  ): "liquid" | "countable" | "spoonable" | "condiment" | "default" => {
    const lower = name.toLowerCase();
    if (/\b(tea|chai|coffee|juice|milk|lassi|smoothie|shake|broth|drink|beverage)\b/.test(lower)) return "liquid";
    if (/\b(sauce|chutney|dip|dressing|salsa|pesto|jam|ketchup|mayonnaise|mayo|hummus|spread)\b/.test(lower)) return "condiment";
    if (/\b(dumpling|momo|sushi|nigiri|roll|taco|burrito|sandwich|burger|pizza|slice|samosa|empanada|falafel|croissant|cookie|biscuit|muffin|egg|idli|dosa|roti|chapati|naan|paratha|wrap|spring\s+roll|meatball|wing|nugget|cutlet|apple|banana|orange|pear)\b/i.test(lower)) {
      return "countable";
    }
    if (/\b(rice|biryani|pulao|risotto|paella|poha|upma|khichdi|oatmeal|oats|porridge|dal|curry|gravy|stew|soup|noodle|noodles|ramen|udon|pho|pasta|mac\s+and\s+cheese|congee|kichari|salad)\b/i.test(lower)) {
      return "spoonable";
    }
    return "default";
  };

  const getPreferredUnitForFood = (name: string): string => {
    const category = getFoodPortionCategory(name);
    if (category === "liquid") return "cup";
    if (category === "countable") return "piece";
    if (category === "spoonable") return "bowl";
    if (category === "condiment") return "tbsp";
    return "serving";
  };

  const isUnitLikelyForFood = (name: string, unit: string): boolean => {
    const lowerUnit = unit.toLowerCase();
    const category = getFoodPortionCategory(name);
    const pieceLike = /^(piece|pieces|pc|pcs|slice|slices)$/.test(lowerUnit);
    const bowlLike = /^(bowl|bowls|cup|cups|serving|servings)$/.test(lowerUnit);
    const gramLike = /^(g|gram|grams|ml|milliliter|milliliters|l|liter|liters)$/.test(lowerUnit);
    const spoonLike = /^(tbsp|tablespoon|tablespoons|tsp|teaspoon|teaspoons)$/.test(lowerUnit);
    if (gramLike) return true;
    if (category === "liquid") return /^(cup|cups|ml|milliliter|milliliters|l|liter|liters|serving|servings|bowl|bowls)$/.test(lowerUnit);
    if (category === "condiment") return spoonLike || /^(serving|servings)$/.test(lowerUnit);
    if (category === "countable") return pieceLike || /^(serving|servings)$/.test(lowerUnit);
    if (category === "spoonable") return bowlLike;
    return true;
  };

  const normalizeUnitForFoodType = (
    name: string,
    unit: string,
    quantity: number,
    estimatedGrams: number
  ): { unit: string; quantity: number; estimatedGrams: number } => {
    const lowerName = name.toLowerCase();
    const lowerUnit = unit.toLowerCase();
    const isCurryLike = /\b(curry|dal|gravy|stew|soup|sabzi|chhole)\b/.test(lowerName);
    const isPieceLike = /^(piece|pieces|pc|pcs)$/.test(lowerUnit);
    if (isCurryLike && isPieceLike) {
      const safeQty = Number.isFinite(quantity) && quantity > 0 ? quantity : 1;
      return {
        unit: "bowl",
        quantity: safeQty,
        estimatedGrams: Math.max(estimatedGrams, safeQty * 180)
      };
    }
    if (!isUnitLikelyForFood(name, lowerUnit)) {
      const preferredUnit = getPreferredUnitForFood(name);
      const safeGrams = Number.isFinite(estimatedGrams) && estimatedGrams > 0 ? estimatedGrams : 100;
      const perUnitMap: Record<string, number> = {
        bowl: 180,
        cup: 240,
        serving: 100,
        piece: 50,
        tbsp: 15
      };
      const nextPerUnit = perUnitMap[preferredUnit] || 100;
      return {
        unit: preferredUnit,
        quantity: estimateQuantityFromGrams(safeGrams, nextPerUnit),
        estimatedGrams: safeGrams
      };
    }
    return { unit, quantity, estimatedGrams };
  };

  const staged = (parsed.items || [])
    .filter((item) => item && typeof item.name === "string" && item.name.trim().length > 0)
    .map((item) => {
      const rawName = normalizeIndianPhotoItemName(item.name);
      const rawQuantity = Number.isFinite(item.quantity) && item.quantity > 0 ? item.quantity : 1;
      const rawUnit = item.unit?.trim() || "serving";
      const rawGramsPerUnit = clampGramsPerUnit(
        item.gramsPerUnit != null &&
          Number.isFinite(item.gramsPerUnit) &&
          item.gramsPerUnit > 0
          ? item.gramsPerUnit
          : rawQuantity > 0 && item.estimatedGrams > 0
            ? item.estimatedGrams / rawQuantity
            : 50
      );
      const directMassTotal = totalGramsFromDirectMassVolume(rawQuantity, rawUnit);
      const rawEstimatedGrams =
        directMassTotal ?? rawQuantity * rawGramsPerUnit;
      const normalizedPortion = normalizeUnitForFoodType(
        rawName,
        rawUnit,
        rawQuantity,
        rawEstimatedGrams
      );
      return {
        rawName,
        rawUnit,
        rawQuantity,
        rawGramsPerUnit,
        normalizedPortion,
        visionGrams: Math.max(1, normalizedPortion.estimatedGrams),
        assumptionBase: item.assumptionText?.trim() || "Estimated from visible portion size.",
        confidence:
          Number.isFinite(item.confidence) && item.confidence >= 0 && item.confidence <= 1
            ? item.confidence
            : 0.5
      };
    });

  const normalizedItems = staged.map((s) => {
    const {
      normalizedPortion,
      rawName,
      rawUnit,
      rawQuantity,
      rawGramsPerUnit,
      visionGrams,
      assumptionBase,
      confidence
    } = s;
    const qty = Number.isFinite(normalizedPortion.quantity) && normalizedPortion.quantity > 0
      ? normalizedPortion.quantity
      : 1;
    const unit = normalizedPortion.unit;

    const normalizeUnchanged =
      canonicalPortionUnit(rawUnit) === canonicalPortionUnit(unit) &&
      Math.abs(rawQuantity - qty) < 1e-6;

    let estimatedGramsFinal: number;
    let gramsPerUnitOut: number | undefined;

    const direct = totalGramsFromDirectMassVolume(qty, unit);
    if (direct != null) {
      estimatedGramsFinal = Math.max(1, Math.round(direct * 10) / 10);
      gramsPerUnitOut = undefined;
    } else if (!normalizeUnchanged) {
      estimatedGramsFinal = Math.max(1, Math.round(visionGrams * 10) / 10);
      gramsPerUnitOut =
        qty > 0 ? Math.round((estimatedGramsFinal / qty) * 10) / 10 : undefined;
    } else {
      const per = clampGramsPerUnit(rawGramsPerUnit);
      estimatedGramsFinal = Math.max(1, Math.round(qty * per * 10) / 10);
      gramsPerUnitOut = per;
    }

    const fromVisionPortion = direct == null && normalizeUnchanged;
    const assumptionText = fromVisionPortion
      ? `${assumptionBase} Total weight ≈ ${estimatedGramsFinal} g (quantity × typical ${unit} weight from photo analysis).`
      : direct == null && !normalizeUnchanged
        ? `${assumptionBase} Total weight ≈ ${estimatedGramsFinal} g (portion rules adjusted unit or quantity).`
        : assumptionBase;

    return {
      name: rawName,
      quantity: normalizedPortion.quantity,
      unit: normalizedPortion.unit,
      estimatedGrams: estimatedGramsFinal,
      confidence,
      assumptionText,
      ...(gramsPerUnitOut != null ? { gramsPerUnit: gramsPerUnitOut } : {})
    };
  });

  const fallbackDescriptionText = normalizedItems
    .map((item) => `${item.quantity} ${item.unit} ${item.name}`)
    .join("\n");

  return {
    items: normalizedItems,
    descriptionText: (parsed.descriptionText || "").trim() || fallbackDescriptionText,
    notes: Array.isArray(parsed.notes) ? parsed.notes : []
  };
};
