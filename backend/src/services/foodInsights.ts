import OpenAI from "openai";
import { NutrientTotals } from "../utils/types";

export type UserContext = {
  goal?: string | null;
  age?: number | null;
  weightKg?: number | null;
  heightCm?: number | null;
  genderAtBirth?: "male" | "female" | null;
  activityLevel?: string | null;
  bmi?: number | null;
};

export type FoodInsightsRequest = {
  foodName: string;
  nutrients: NutrientTotals;
  quantity: number;
  unit: string;
  grams: number;
  mealType?: string; // e.g., "breakfast", "lunch", "dinner", "snack"
  userGoal?: string; // deprecated: use userContext.goal
  userContext?: UserContext; // User profile: goal, age, weight, height, gender, activity, BMI
  otherFoodsToday?: Array<{ name: string; mealType?: string }>; // Other foods logged today
  sameMealFoods?: string[]; // Foods from the same meal (for pairing checks)
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
      description: "A brief 2-3 sentence insight about this food item, its nutritional benefits, and how it fits into a healthy diet. If the user's food description mentions healthy prep (air fried, baked, healthy oils), compliment those choices."
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
  // "air fried" is healthy; only penalize deep-fried (exclude "air fried" from fried penalty)
  const processedKeywords = ["processed", "packaged", "fast food", "candy", "soda", "sugar"];
  const isProcessed = processedKeywords.some(keyword => name.includes(keyword));
  if (isProcessed) score -= 20;
  if (name.includes("fried") && !name.includes("air fried")) score -= 15;

  // Check for whole foods and healthy preparation
  const wholeFoodKeywords = ["fresh", "organic", "whole", "raw", "steamed", "grilled", "baked", "air fried", "avocado oil", "olive oil", "coconut oil"];
  const isWholeFood = wholeFoodKeywords.some(keyword => name.includes(keyword));
  if (isWholeFood) score += 15;

  // Nutritional density scoring
  const calories = nutrients.calories_kcal || 1;
  const proteinPerCal = (nutrients.protein_g || 0) / calories * 100;
  const fiberPerCal = (nutrients.fiber_g || 0) / calories * 100;
  
  if (proteinPerCal > 0.5 && nutrients.protein_g > 0) score += 10;
  if (fiberPerCal > 0.3 && nutrients.fiber_g > 0) score += 10;
  
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

  // Build user context string from profile (or fallback if not provided)
  const ctx = request.userContext;
  const goalFromCtx = ctx?.goal ?? request.userGoal;
  const userContextLines: string[] = [];
  if (goalFromCtx) {
    const goalLabel = goalFromCtx.replace(/_/g, " ");
    userContextLines.push(`User's goal: ${goalLabel}`);
  }
  if (ctx?.age != null) userContextLines.push(`${ctx.age} years old`);
  if (ctx?.weightKg != null) userContextLines.push(`${ctx.weightKg}kg`);
  if (ctx?.heightCm != null) userContextLines.push(`${ctx.heightCm}cm height`);
  if (ctx?.genderAtBirth) userContextLines.push(ctx.genderAtBirth === "male" ? "Male" : "Female");
  if (ctx?.activityLevel) userContextLines.push(`Activity level: ${ctx.activityLevel}`);
  if (ctx?.bmi != null) {
    const bmiCategory = ctx.bmi < 18.5 ? "underweight" : ctx.bmi < 25 ? "healthy" : ctx.bmi < 30 ? "overweight" : "obese";
    userContextLines.push(`BMI: ${ctx.bmi.toFixed(1)} (${bmiCategory})`);
  }
  const userContextStr = userContextLines.length > 0
    ? userContextLines.join(", ")
    : "User profile not provided";

  const system = [
    "You are a nutrition expert providing personalized food insights.",
    "Analyze the food item and provide:",
    "1. A brief 2-3 sentence insight about the food's nutritional benefits and role in a healthy diet",
    "2. 1-5 actionable tips specific to this food (e.g., timing, pairing, preparation, portion control)",
    "3. A health quotient score (0-100) based on nutritional density, processing level, and overall healthfulness",
    "",
    "IMPORTANT CONTEXT TO CONSIDER:",
    `- User profile: ${userContextStr}`,
    "- Food description: The user's exact food entry (e.g. 'Air fried fries with Avocado oil') often contains cooking method, oils, and preparation. PARSE this carefully and COMPLIMENT healthy choices: air frying (vs deep frying), healthy oils (avocado, olive, coconut), baking/steaming/grilling, organic, fresh, etc.",
    "- Meal timing: Consider when the food is being consumed (breakfast vs dinner matters)",
    "- Other foods logged today: A list of ALL other foods the user has logged today (check this list carefully!)",
    "- Same meal foods: Foods from the SAME meal as the current food (especially important for pairing suggestions)",
    "",
    "CRITICAL: Before suggesting pairing a food with something (e.g., 'add berries' or 'pair with chia seeds'):",
    "1. FIRST check the 'Other foods logged today' list to see if the user ALREADY logged that food",
    "2. Check the 'Same meal foods' list - if the food is in the same meal, they've already paired it!",
    "3. Use fuzzy matching - 'berries', 'berry', 'blueberries', 'strawberries' all count as berries",
    "4. If the food is already logged, DO NOT suggest adding it - instead COMPLIMENT the user for the good pairing",
    "",
    "Tips should be specific and contextual:",
    "- FOOD DESCRIPTION: If the user's entry mentions healthy prep (air fried, baked, steamed, grilled), healthy oils (avocado, olive, coconut), or quality (organic, fresh), COMPLIMENT them in insights or tips. E.g. 'Air fried fries with Avocado oil' → compliment air frying (less oil than deep frying) and avocado oil (heart-healthy monounsaturated fat).",
    "- If the food is typically paired with something (e.g., oats with berries/chia), FIRST check if user already had those in the same meal or today. If yes, compliment them!",
    "- For coffee/caffeine: Consider meal timing - 'Try not to drink after 2 pm' is more relevant for breakfast coffee than dinner",
    "- For cholesterol reduction goal: Suggest foods that help lower cholesterol, mention if current food supports this goal",
    "- If user already paired foods well (e.g., oats + berries + chia in same meal), acknowledge and compliment their good choices",
    "- Consider meal context: Breakfast foods vs dinner foods have different timing considerations",
    "",
    "Examples of contextual tips:",
    "- 'Great choice air frying and using avocado oil—both reduce added fat compared to deep frying and support heart health!' (when food description says 'air fried' and 'avocado oil')",
    "- 'Baking/steaming instead of frying is a smart way to cut calories while keeping flavor.' (when description mentions baked, steamed, etc.)",
    "- 'Great choice pairing oats with berries and chia seeds - this combination provides fiber and omega-3s that support heart health!' (if berries/chia are in sameMealFoods or otherFoodsToday)",
    "- 'Oats pair well with berries and chia seeds for added fiber and omega-3s' (ONLY if berries/chia are NOT in sameMealFoods or otherFoodsToday)",
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
  if (goalFromCtx) {
    contextParts.push(`User's goal: ${goalFromCtx.replace(/_/g, " ")}`);
  }
  if (request.sameMealFoods && request.sameMealFoods.length > 0) {
    contextParts.push(`Foods in the SAME meal: ${request.sameMealFoods.join(", ")}`);
  }
  if (request.otherFoodsToday && request.otherFoodsToday.length > 0) {
    const foodsList = request.otherFoodsToday.map(f => f.name).join(", ");
    contextParts.push(`Other foods logged today (from other meals): ${foodsList}`);
  }

  const userMessage = `Food (user's exact entry): ${request.foodName}
Quantity: ${request.quantity} ${request.unit} (${Math.round(request.grams)}g)
Nutrition per serving: ${nutrientsSummary}
${contextParts.length > 0 ? `\nContext:\n${contextParts.join("\n")}` : ""}

CRITICAL INSTRUCTIONS:
- PARSE the food description for cooking method, oils, and prep (air fried, baked, avocado oil, olive oil, etc.). If present, COMPLIMENT these healthy choices in your insights or tips.
- Before suggesting pairing this food with something (e.g., berries, chia seeds), CHECK the "Foods in the SAME meal" and "Other foods logged today" lists
- If a suggested pairing food is already in those lists, DO NOT suggest adding it - instead COMPLIMENT the user for already pairing it well
- Use fuzzy matching for food names (e.g., "berries", "berry", "blueberries" all match)
- Provide insights, tips, and health quotient for this food item considering the context provided.`;

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
