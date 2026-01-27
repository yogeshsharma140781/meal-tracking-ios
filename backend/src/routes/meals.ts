import { Router } from "express";
import { randomUUID } from "crypto";
import { hasDatabase, pool } from "../db/pool";
import { FoodResolverService, NUTRIENT_DB } from "../services/foodResolver";
import { hasOpenAi, parseMealWithAi } from "../services/aiNutrition";
import { NutritionCalculator } from "../services/nutritionCalculator";
import { AttributionEngine } from "../services/attributionEngine";
import { NutrientTotals, emptyTotals } from "../utils/types";
import { getFoodInsights } from "../services/foodInsights";

export const mealsRouter = Router();

const foodResolver = new FoodResolverService();
const nutritionCalculator = new NutritionCalculator();
const attributionEngine = new AttributionEngine();

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000001";

const sumTotals = (a: NutrientTotals, b: NutrientTotals): NutrientTotals => ({
  calories_kcal: a.calories_kcal + b.calories_kcal,
  protein_g: a.protein_g + b.protein_g,
  carbs_g: a.carbs_g + b.carbs_g,
  fat_g: a.fat_g + b.fat_g,
  fiber_g: a.fiber_g + b.fiber_g,
  sodium_mg: a.sodium_mg + b.sodium_mg,
  cholesterol_mg: a.cholesterol_mg + b.cholesterol_mg,
  omega_3_g: a.omega_3_g + b.omega_3_g,
  omega_6_g: a.omega_6_g + b.omega_6_g,
  potassium_mg: a.potassium_mg + b.potassium_mg,
  calcium_mg: a.calcium_mg + b.calcium_mg,
  iron_mg: a.iron_mg + b.iron_mg,
  vitamin_d_iu: a.vitamin_d_iu + b.vitamin_d_iu,
  vitamin_b12_ug: a.vitamin_b12_ug + b.vitamin_b12_ug,
  magnesium_mg: a.magnesium_mg + b.magnesium_mg,
  vitamin_c_mg: a.vitamin_c_mg + b.vitamin_c_mg,
  vitamin_a_mcg: a.vitamin_a_mcg + b.vitamin_a_mcg
});

const toLocalDay = (iso: string, tzOffsetMinutes?: number): string => {
  const date = new Date(iso);
  if (Number.isFinite(tzOffsetMinutes)) {
    date.setMinutes(date.getMinutes() - (tzOffsetMinutes ?? 0));
  }
  return date.toISOString().slice(0, 10);
};

const ensureDefaultUser = async () => {
  if (!hasDatabase || !pool) return;
  await pool.query(
    `insert into users (id, email, display_name)
     values ($1, $2, $3)
     on conflict (email) do nothing`,
    [DEFAULT_USER_ID, "demo@mealtracking.local", "Demo User"]
  );
};

const getOrCreateIngredient = async (
  name: string,
  defaultUnit: string,
  defaultGrams: number
) => {
  if (!hasDatabase || !pool) {
    return { ingredient_id: randomUUID(), food_item_id: randomUUID() };
  }

  const { rows } = await pool.query(
    `select i.id as ingredient_id, f.id as food_item_id
     from ingredients i
     join food_items f on f.id = i.food_item_id
     where lower(i.name) = lower($1)
     limit 1`,
    [name]
  );

  if (rows.length > 0) {
    return rows[0];
  }

  const foodItemId = randomUUID();
  const ingredientId = randomUUID();
  await pool.query(
    `insert into food_items (id, name, source)
     values ($1, $2, $3)`,
    [foodItemId, name, "USDA"]
  );
  await pool.query(
    `insert into ingredients (id, food_item_id, name, default_unit, default_grams)
     values ($1, $2, $3, $4, $5)`,
    [ingredientId, foodItemId, name, defaultUnit, defaultGrams]
  );

  const nutrientProfile = NUTRIENT_DB[name];
  if (nutrientProfile) {
    await pool.query(
      `insert into nutrient_profiles (
        id, food_item_id, per_100g, calories_kcal, protein_g, carbs_g, fat_g,
        fiber_g, sodium_mg, cholesterol_mg, source, confidence
      )
      values ($1, $2, true, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        randomUUID(),
        foodItemId,
        nutrientProfile.calories_kcal,
        nutrientProfile.protein_g,
        nutrientProfile.carbs_g,
        nutrientProfile.fat_g,
        nutrientProfile.fiber_g,
        nutrientProfile.sodium_mg,
        nutrientProfile.cholesterol_mg,
        "USDA",
        0.7
      ]
    );
  }

  return { ingredient_id: ingredientId, food_item_id: foodItemId };
};

mealsRouter.post("/nl-log", async (req, res) => {
  try {
    await ensureDefaultUser();
    const text = String(req.body?.text || "").trim();
    const startedAt = String(req.body?.startedAt || new Date().toISOString());
    const tzOffsetMinutes = Number(req.body?.tzOffsetMinutes);

    if (!text) {
      return res.status(400).json({ error: "text is required" });
    }

    const resolved = hasOpenAi
      ? await parseMealWithAi(text)
      : foodResolver.resolveText(text);
    const mealId = randomUUID();
    const mealLabel = "meal";

    if (hasDatabase && pool) {
      await pool.query(
        `insert into meals (id, user_id, meal_label, started_at)
         values ($1, $2, $3, $4)`,
        [mealId, DEFAULT_USER_ID, mealLabel, startedAt]
      );
    }

    const itemResults = [];
    let mealTotals = emptyTotals();

    const ingredients =
      "ingredients" in resolved ? resolved.ingredients : resolved.items;

    for (const ingredient of ingredients) {
      const { ingredient_id: ingredientId } = await getOrCreateIngredient(
        ingredient.name,
        "assumedUnit" in ingredient ? ingredient.assumedUnit : ingredient.unit,
        "assumedGrams" in ingredient ? ingredient.assumedGrams : ingredient.grams
      );

      const mealItemId = randomUUID();
      if (hasDatabase && pool) {
        await pool.query(
          `insert into meal_items (
            id, meal_id, ingredient_id, quantity, unit, grams, assumption_text, confidence
          ) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [
            mealItemId,
            mealId,
            ingredientId,
            "assumedQuantity" in ingredient
              ? ingredient.assumedQuantity
              : ingredient.quantity,
            "assumedUnit" in ingredient ? ingredient.assumedUnit : ingredient.unit,
            "assumedGrams" in ingredient ? ingredient.assumedGrams : ingredient.grams,
            ingredient.assumptionText,
            ingredient.confidence
          ]
        );
      }

      const itemTotals =
        "nutrients" in ingredient
          ? ingredient.nutrients
          : nutritionCalculator.calculateTotals(
              NUTRIENT_DB[ingredient.name] || null,
              ingredient.assumedGrams
            );
      mealTotals = sumTotals(mealTotals, itemTotals);

      if (hasDatabase && pool) {
        const attributions = attributionEngine.buildAttributions(itemTotals);
        for (const entry of attributions) {
          await pool.query(
            `insert into nutrient_attribution (
              id, user_id, day, nutrient_key, meal_id, meal_item_id, amount
            ) values ($1, $2, $3, $4, $5, $6, $7)`,
            [
              randomUUID(),
              DEFAULT_USER_ID,
              toLocalDay(startedAt, tzOffsetMinutes),
              entry.nutrientKey,
              mealId,
              mealItemId,
              entry.amount
            ]
          );
        }
      }

      itemResults.push({
        id: mealItemId,
        name: ingredient.name,
        quantity:
          "assumedQuantity" in ingredient
            ? ingredient.assumedQuantity
            : ingredient.quantity,
        unit: "assumedUnit" in ingredient ? ingredient.assumedUnit : ingredient.unit,
        grams: "assumedGrams" in ingredient ? ingredient.assumedGrams : ingredient.grams,
        assumptionText: ingredient.assumptionText,
        confidence: ingredient.confidence,
        nutrients: itemTotals
      });
    }

    if (hasDatabase && pool) {
      await pool.query(
        `insert into meal_nutrients (
          id, meal_id, calories_kcal, protein_g, carbs_g, fat_g,
          fiber_g, sodium_mg, cholesterol_mg
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          randomUUID(),
          mealId,
          mealTotals.calories_kcal,
          mealTotals.protein_g,
          mealTotals.carbs_g,
          mealTotals.fat_g,
          mealTotals.fiber_g,
          mealTotals.sodium_mg,
          mealTotals.cholesterol_mg
        ]
      );
    }

    const daySummary: NutrientTotals = mealTotals;

    if (hasDatabase && pool) {
      const day = toLocalDay(startedAt, tzOffsetMinutes);
      const dayRows = await pool.query(
        `select sum(mn.calories_kcal) as calories_kcal,
                sum(mn.protein_g) as protein_g,
                sum(mn.carbs_g) as carbs_g,
                sum(mn.fat_g) as fat_g,
                sum(mn.fiber_g) as fiber_g,
                sum(mn.sodium_mg) as sodium_mg,
                sum(mn.cholesterol_mg) as cholesterol_mg
         from meal_nutrients mn
         join meals m on m.id = mn.meal_id
         where m.user_id = $1 and m.started_at::date = $2`,
        [DEFAULT_USER_ID, day]
      );

      const dbDaySummary: NutrientTotals = {
        ...emptyTotals(),
        calories_kcal: Number(dayRows.rows[0]?.calories_kcal || 0),
        protein_g: Number(dayRows.rows[0]?.protein_g || 0),
        carbs_g: Number(dayRows.rows[0]?.carbs_g || 0),
        fat_g: Number(dayRows.rows[0]?.fat_g || 0),
        fiber_g: Number(dayRows.rows[0]?.fiber_g || 0),
        sodium_mg: Number(dayRows.rows[0]?.sodium_mg || 0),
        cholesterol_mg: Number(dayRows.rows[0]?.cholesterol_mg || 0)
      };

      await pool.query(`delete from day_nutrients where user_id = $1 and day = $2`, [
        DEFAULT_USER_ID,
        day
      ]);
      await pool.query(
        `insert into day_nutrients (
          id, user_id, day, calories_kcal, protein_g, carbs_g, fat_g,
          fiber_g, sodium_mg, cholesterol_mg
        ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          randomUUID(),
          DEFAULT_USER_ID,
          day,
          dbDaySummary.calories_kcal,
          dbDaySummary.protein_g,
          dbDaySummary.carbs_g,
          dbDaySummary.fat_g,
          dbDaySummary.fiber_g,
          dbDaySummary.sodium_mg,
          dbDaySummary.cholesterol_mg
        ]
      );
    }

    const sodiumTotal = itemResults.reduce(
      (sum, item) => sum + item.nutrients.sodium_mg,
      0
    );
    const topSodium = itemResults
      .slice()
      .sort((a, b) => b.nutrients.sodium_mg - a.nutrients.sodium_mg)[0];
    const explanations =
      sodiumTotal > 0 && topSodium
        ? [
            {
              nutrient: "sodium_mg",
              reason: `${topSodium.name} contributed ${Math.round(
                (topSodium.nutrients.sodium_mg / sodiumTotal) * 100
              )}% of sodium.`
            }
          ]
        : [];

    return res.json({
      meal: {
        id: mealId,
        label: mealLabel,
        startedAt
      },
      items: itemResults,
      nutrients: mealTotals,
      daySummary,
      explanations,
      notes: resolved.notes
    });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error(error);
    return res.status(500).json({ error: "failed to log meal" });
  }
});

mealsRouter.get("/:mealId", async (req, res) => {
  if (!hasDatabase || !pool) {
    return res.status(503).json({ error: "database not configured" });
  }
  const mealId = req.params.mealId;
  const mealRes = await pool.query(
    `select id, meal_label, started_at from meals where id = $1`,
    [mealId]
  );
  if (mealRes.rows.length === 0) {
    return res.status(404).json({ error: "meal not found" });
  }
  const itemsRes = await pool.query(
    `select mi.id, i.name, mi.quantity, mi.unit, mi.grams, mi.assumption_text, mi.confidence
     from meal_items mi
     join ingredients i on i.id = mi.ingredient_id
     where mi.meal_id = $1`,
    [mealId]
  );
  return res.json({ meal: mealRes.rows[0], items: itemsRes.rows });
});

mealsRouter.get("/", async (req, res) => {
  if (!hasDatabase || !pool) {
    return res.status(503).json({ error: "database not configured" });
  }
  const day = String(req.query.day || "").trim();
  if (!day) {
    return res.status(400).json({ error: "day is required (YYYY-MM-DD)" });
  }
  const mealsRes = await pool.query(
    `select id, meal_label, started_at
     from meals
     where user_id = $1 and started_at::date = $2
     order by started_at asc`,
    [DEFAULT_USER_ID, day]
  );
  return res.json({ meals: mealsRes.rows });
});

mealsRouter.get("/:mealId/nutrients", async (req, res) => {
  if (!hasDatabase || !pool) {
    return res.status(503).json({ error: "database not configured" });
  }
  const mealId = req.params.mealId;
  const nutrientsRes = await pool.query(
    `select calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, cholesterol_mg
     from meal_nutrients
     where meal_id = $1`,
    [mealId]
  );
  const attributionRes = await pool.query(
    `select nutrient_key, meal_item_id, amount
     from nutrient_attribution
     where meal_id = $1`,
    [mealId]
  );
  return res.json({
    nutrients: nutrientsRes.rows[0] || emptyTotals(),
    attribution: attributionRes.rows
  });
});

mealsRouter.get("/days/:day/nutrients", async (req, res) => {
  if (!hasDatabase || !pool) {
    return res.status(503).json({ error: "database not configured" });
  }
  const day = req.params.day;
  const dayRes = await pool.query(
    `select calories_kcal, protein_g, carbs_g, fat_g, fiber_g, sodium_mg, cholesterol_mg
     from day_nutrients
     where user_id = $1 and day = $2`,
    [DEFAULT_USER_ID, day]
  );
  const attributionRes = await pool.query(
    `select nutrient_key, meal_id, meal_item_id, amount
     from nutrient_attribution
     where user_id = $1 and day = $2`,
    [DEFAULT_USER_ID, day]
  );
  return res.json({
    day,
    nutrients: dayRes.rows[0] || emptyTotals(),
    attribution: attributionRes.rows
  });
});

mealsRouter.post("/food-insights", async (req, res) => {
  try {
    const { foodName, nutrients, quantity, unit, grams, mealType, userGoal, otherFoodsToday } = req.body;

    if (!foodName || !nutrients) {
      return res.status(400).json({ error: "foodName and nutrients are required" });
    }

    const insights = await getFoodInsights({
      foodName: String(foodName),
      nutrients: nutrients as NutrientTotals,
      quantity: Number(quantity) || 1,
      unit: String(unit) || "serving",
      grams: Number(grams) || 100,
      mealType: mealType ? String(mealType) : undefined,
      userGoal: userGoal ? String(userGoal) : "reduce_cholesterol_maintain_weight",
      otherFoodsToday: Array.isArray(otherFoodsToday) ? otherFoodsToday : undefined
    });

    return res.json(insights);
  } catch (error) {
    console.error("Failed to get food insights:", error);
    return res.status(500).json({ error: "failed to get food insights" });
  }
});
