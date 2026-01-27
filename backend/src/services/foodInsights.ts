import OpenAI from "openai";
import { NutrientTotals } from "../utils/types";

export type FoodInsightsRequest = {
  foodName: string;
  nutrients: NutrientTotals;
  quantity: number;
  unit: string;
  grams: number;
  mealType?: string; // e.g., "breakfast", "lunch", "dinner", "snack"
  userGoal?: string; // e.g., "reduce_cholesterol_maintain_weight"
  otherFoodsToday?: Array<{ name: string; mealType?: string }>; // Other foods logged today
};

export type FoodInsightsResponse = {
  insights: string;
  tips: string[];
  healthQuotient: number;
};

export const hasOpenAi = Boolean(process.env.OPENAI_API_KEY);

const model = process.env.OPENAI_MODEL || "gpt-4o-mini";

const schemaName = "food_insights";
const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    insights: {
      type: "string",
      description: "A brief 2-3 sentence insight about this food item, its nutritional benefits, and how it fits into a healthy diet"
    },
    tips: {
      type: "array",
      items: { type: "string" },
      description: "Actionable tips specific to this food item (e.g., 'Try not to drink coffee after 2 pm' for coffee, 'Pair with protein for better absorption' for iron-rich foods, etc.)",
      minItems: 1,
      maxItems: 5
    },
    healthQuotient: {
      type: "number",
      description: "A health score from 0-100 based on nutritional density, processing level, and overall healthfulness",
      minimum: 0,
      maximum: 100
    }
  },
  required: ["insights", "tips", "healthQuotient"]
};

const calculateHealthQuotient = (nutrients: NutrientTotals, foodName: string): number => {
  let score = 50; // Base score

  const name = foodName.toLowerCase();

  // Check for highly processed foods
  const processedKeywords = ["processed", "packaged", "fast food", "fried", "candy", "soda", "sugar"];
  const isProcessed = processedKeywords.some(keyword => name.includes(keyword));
  if (isProcessed) score -= 20;

  // Check for whole foods
  const wholeFoodKeywords = ["fresh", "organic", "whole", "raw", "steamed", "grilled", "baked"];
  const isWholeFood = wholeFoodKeywords.some(keyword => name.includes(keyword));
  if (isWholeFood) score += 15;

  // Nutritional density scoring
  const calories = nutrients.calories_kcal || 1;
  const proteinPerCal = (nutrients.protein_g || 0) / calories * 100;
  const fiberPerCal = (nutrients.fiber_g || 0) / calories * 100;
  
  if (proteinPerCal > 0.5) score += 10;
  if (fiberPerCal > 0.3) score += 10;
  
  // Micronutrient richness
  const hasVitamins = (nutrients.vitamin_c_mg || 0) > 0 || 
                      (nutrients.vitamin_a_mcg || 0) > 0 || 
                      (nutrients.vitamin_d_iu || 0) > 0;
  if (hasVitamins) score += 5;

  const hasMinerals = (nutrients.potassium_mg || 0) > 0 || 
                      (nutrients.magnesium_mg || 0) > 0 || 
                      (nutrients.iron_mg || 0) > 0;
  if (hasMinerals) score += 5;

  // Negative factors
  if ((nutrients.sodium_mg || 0) > 500) score -= 10;
  if ((nutrients.cholesterol_mg || 0) > 100) score -= 5;
  if ((nutrients.fat_g || 0) > (nutrients.protein_g || 0) * 2) score -= 5;

  // Ensure score is within bounds
  return Math.max(0, Math.min(100, Math.round(score)));
};

export const getFoodInsights = async (
  request: FoodInsightsRequest
): Promise<FoodInsightsResponse> => {
  if (!hasOpenAi) {
    // Fallback without AI
    const healthQuotient = calculateHealthQuotient(request.nutrients, request.foodName);
    return {
      insights: `${request.foodName} provides essential nutrients. It contains ${Math.round(request.nutrients.protein_g)}g protein, ${Math.round(request.nutrients.carbs_g)}g carbs, and ${Math.round(request.nutrients.fat_g)}g fat per ${request.quantity} ${request.unit}.`,
      tips: [],
      healthQuotient
    };
  }

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const system = [
    "You are a nutrition expert providing personalized food insights.",
    "Analyze the food item and provide:",
    "1. A brief 2-3 sentence insight about the food's nutritional benefits and role in a healthy diet",
    "2. 1-5 actionable tips specific to this food (e.g., timing, pairing, preparation, portion control)",
    "3. A health quotient score (0-100) based on nutritional density, processing level, and overall healthfulness",
    "",
    "IMPORTANT CONTEXT TO CONSIDER:",
    "- User's goal: reduce cholesterol and maintain weight (Male, 44 years, 73kg)",
    "- Meal timing: Consider when the food is being consumed (breakfast vs dinner matters)",
    "- Other foods logged today: Check if the user has already paired foods well or needs suggestions",
    "",
    "Tips should be specific and contextual:",
    "- If the food is typically paired with something (e.g., oats with berries/chia), check if user already had those today. If yes, compliment them!",
    "- For coffee/caffeine: Consider meal timing - 'Try not to drink after 2 pm' is more relevant for breakfast coffee than dinner",
    "- For cholesterol reduction goal: Suggest foods that help lower cholesterol, mention if current food supports this goal",
    "- If user already paired foods well (e.g., oats + berries + chia), acknowledge and compliment their good choices",
    "- Consider meal context: Breakfast foods vs dinner foods have different timing considerations",
    "",
    "Examples of contextual tips:",
    "- 'Great choice pairing oats with berries and chia seeds - this combination provides fiber and omega-3s that support heart health!' (if user already had those)",
    "- 'Oats pair well with berries and chia seeds for added fiber and omega-3s' (if user hasn't had those yet)",
    "- 'Since this is breakfast, try not to have coffee after 2 pm if you plan to have more later'",
    "- 'This food is low in saturated fat, which supports your goal of reducing cholesterol'",
    "",
    "Health quotient guidelines:",
    "- 80-100: Excellent nutritional profile, whole/unprocessed foods",
    "- 60-79: Good nutritional value with some considerations",
    "- 40-59: Moderate nutritional value, may be processed or high in certain nutrients",
    "- 0-39: Lower nutritional value, highly processed, or high in negative factors",
    "",
    "Return only JSON that matches the provided schema."
  ].join(" ");

  const nutrientsSummary = [
    `Calories: ${Math.round(request.nutrients.calories_kcal)} kcal`,
    `Protein: ${Math.round(request.nutrients.protein_g)}g`,
    `Carbs: ${Math.round(request.nutrients.carbs_g)}g`,
    `Fat: ${Math.round(request.nutrients.fat_g)}g`,
    `Fiber: ${Math.round(request.nutrients.fiber_g)}g`,
    `Sodium: ${Math.round(request.nutrients.sodium_mg)}mg`,
    `Cholesterol: ${Math.round(request.nutrients.cholesterol_mg)}mg`,
    request.nutrients.vitamin_c_mg > 0 ? `Vitamin C: ${Math.round(request.nutrients.vitamin_c_mg)}mg` : null,
    request.nutrients.vitamin_a_mcg > 0 ? `Vitamin A: ${Math.round(request.nutrients.vitamin_a_mcg)}mcg` : null,
    request.nutrients.potassium_mg > 0 ? `Potassium: ${Math.round(request.nutrients.potassium_mg)}mg` : null,
    request.nutrients.magnesium_mg > 0 ? `Magnesium: ${Math.round(request.nutrients.magnesium_mg)}mg` : null,
  ].filter(Boolean).join(", ");

  const contextParts = [];
  if (request.mealType) {
    contextParts.push(`Meal: ${request.mealType}`);
  }
  if (request.userGoal) {
    contextParts.push(`User's goal: ${request.userGoal}`);
  }
  if (request.otherFoodsToday && request.otherFoodsToday.length > 0) {
    const foodsList = request.otherFoodsToday.map(f => f.name).join(", ");
    contextParts.push(`Other foods logged today: ${foodsList}`);
  }

  const userMessage = `Food: ${request.foodName}
Quantity: ${request.quantity} ${request.unit} (${Math.round(request.grams)}g)
Nutrition per serving: ${nutrientsSummary}
${contextParts.length > 0 ? `\nContext:\n${contextParts.join("\n")}` : ""}

Provide insights, tips, and health quotient for this food item. Consider the context provided - if the user has already paired foods well, compliment them. If this is breakfast, consider timing tips. If the user's goal is to reduce cholesterol, mention how this food supports that goal.`;

  try {
    const response = await client.responses.create({
      model,
      input: [
        { role: "system", content: system },
        { role: "user", content: userMessage }
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
    const parsed = JSON.parse(outputText) as FoodInsightsResponse;
    
    // Ensure health quotient is within bounds
    parsed.healthQuotient = Math.max(0, Math.min(100, Math.round(parsed.healthQuotient)));
    
    return parsed;
  } catch (error) {
    console.error("Failed to get AI food insights:", error);
    // Fallback to calculated health quotient
    const healthQuotient = calculateHealthQuotient(request.nutrients, request.foodName);
    return {
      insights: `${request.foodName} provides essential nutrients for your health.`,
      tips: [],
      healthQuotient
    };
  }
};
