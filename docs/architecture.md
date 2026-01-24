## High-Level System Architecture (Textual)

Assumptions:
- Mobile app uses Expo (React Native) for fast iteration and camera/barcode support.
- Backend is a modular Node.js + TypeScript REST API.
- Nutrition data quality varies; we store source and confidence.

Trade-offs (brief):
- Using two food sources (Open Food Facts + USDA) increases coverage but requires conflict resolution and source attribution.
- REST over GraphQL keeps implementation simpler; may need additional endpoints for complex drill-down.

Architecture diagram (textual):

[ Mobile App (Expo RN) ]
  - Meal Logging UI (NL text, barcode, quick add)
  - Offline queue + sync
  - Local defaults (portion prefs, recent meals)
  - REST Client
        |
        v
[ API Gateway / REST Server ]
  - Auth & User Context
  - Meal Service
  - FoodResolverService
  - NutritionCalculator
  - AttributionEngine
  - PortionAssumptionService
        |
        v
[ PostgreSQL ]
  - Users, Meals, MealItems
  - Ingredients, FoodItems
  - NutrientProfiles
  - PortionAssumptions
  - BarcodeProducts
        |
        v
[ External Data Sources ]
  - Open Food Facts (barcode -> product)
  - USDA FoodData Central (ingredient nutrient data)

Data flow (NL meal log):
1) App sends text -> /v1/meals/nl-log
2) FoodResolverService parses text into ingredients + assumptions
3) NutritionCalculator resolves each ingredient using USDA data
4) Meal + MealItems persisted with assumptions + confidence
5) AttributionEngine aggregates nutrients to meal/day
6) Response returns meal summary + drill-down
