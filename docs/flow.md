## End-to-End Flow: Natural Language Meal Log

Assumptions:
- User is authenticated; userId available in API context.
- Parsing is rule-based with confidence scoring and assumptions.

Trade-offs (brief):
- We store assumptions early to improve speed; user can edit later.
- We accept incomplete nutrient data and fill missing with nulls.

### 1) Request (Client -> API)

POST /v1/meals/nl-log
{
  "text": "rice dal paneer lunch",
  "startedAt": "2026-01-19T12:30:00Z",
  "tzOffsetMinutes": 60
}

### 2) Parse + Resolve Ingredients (FoodResolverService)

Input text: "rice dal paneer lunch"

Resolved ingredients (example):
- rice, assumed: 1 bowl cooked (180g), confidence 0.62
- dal, assumed: 1 bowl cooked (200g), confidence 0.60
- paneer, assumed: 100g (default), confidence 0.72

Notes:
- "lunch" used as meal_label.
- Portion assumptions pulled from user history if available.

### 3) Persist Meal + Items

- Create meal row with started_at and meal_label = "lunch"
- Create meal_items with assumption_text and confidence
- Store portion assumptions if new

### 4) Nutrient Calculation (NutritionCalculator)

For each ingredient:
1) Fetch nutrient profile (USDA or user source)
2) Convert per-100g profile to actual totals using grams

Example totals (per ingredient):
- rice (180g): 234 kcal, 4g protein, 52g carbs, 0.5g fat
- dal (200g): 232 kcal, 16g protein, 40g carbs, 2g fat
- paneer (100g): 265 kcal, 18g protein, 2g carbs, 20g fat, sodium 370mg

### 5) Attribution + Aggregation

AttributionEngine creates:
nutrient_key -> meal_item -> amount

Aggregate:
- meal_nutrients totals
- day_nutrients totals (same day)

### 6) Response (API -> Client)

Response includes:
- meal summary
- item-level assumptions + confidence
- nutrient totals (meal + day)
- explanations such as:
  "Why was sodium high today? Paneer contributed 62% of sodium."
