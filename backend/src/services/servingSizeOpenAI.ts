import OpenAI from "openai";

export type ServingSizeAIInput = {
  productName: string;
  brand?: string;
  /** e.g. Open Food Facts categories_tags */
  categoriesTags?: string[];
  kcalPer100g?: number;
  /** Total pack weight in g when known (not a serving) */
  packGrams?: number | null;
};

/**
 * When Open Food Facts has no reliable serving size, ask OpenAI for a typical single-serving grams.
 * Requires OPENAI_API_KEY. Returns null on failure / missing key.
 */
export async function suggestServingGramsOpenAI(input: ServingSizeAIInput): Promise<number | null> {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;

  const model = process.env.OPENAI_MODEL || "gpt-4o-mini";
  const client = new OpenAI({ apiKey: key });

  const payload = {
    product: input.productName,
    brand: input.brand ?? "",
    categories: (input.categoriesTags ?? []).slice(0, 10),
    kcal_per_100g: input.kcalPer100g ?? null,
    pack_total_g: input.packGrams ?? null
  };

  try {
    const completion = await client.chat.completions.create({
      model,
      temperature: 0.2,
      max_tokens: 100,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You choose ONE default serving size in grams for a food logging app when the package does not specify it clearly. " +
            "Respond with JSON only: {\"grams\": number}. " +
            "grams must be between 5 and 500. Use typical single servings: dry rolled oats ~40g, oil ~10g, milk ~200-250 (treat ml as g), " +
            "bread slice ~30-40g, yogurt ~125-150g, rice/pasta dry ~75g. " +
            "If the product is clearly a single-serve item (one bar, one drink), you may use that. " +
            "If very uncertain, use 100."
        },
        {
          role: "user",
          content: JSON.stringify(payload)
        }
      ]
    });

    const text = completion.choices[0]?.message?.content?.trim();
    if (!text) return null;
    const parsed = JSON.parse(text) as { grams?: unknown };
    const g = typeof parsed.grams === "number" ? parsed.grams : Number(parsed.grams);
    if (!Number.isFinite(g) || g < 5 || g > 500) return null;
    return Math.round(g * 10) / 10;
  } catch (err) {
    console.warn("suggestServingGramsOpenAI failed:", err);
    return null;
  }
}
