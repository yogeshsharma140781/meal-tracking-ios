## API Endpoints (OpenAPI-style, abbreviated)

Base URL: /v1

POST /meals/nl-log
Request:
{
  "text": "rice dal paneer lunch",
  "startedAt": "2026-01-19T12:30:00Z",
  "tzOffsetMinutes": 60
}
Response:
{
  "meal": { "...": "..." },
  "items": [ "...meal items..." ],
  "nutrients": { "...meal totals..." },
  "daySummary": { "...day totals..." },
  "explanations": [
    { "nutrient": "sodium_mg", "reason": "Paneer contributed 62% of sodium." }
  ]
}

POST /meals/quick-add
Request: { "name": "banana", "quantity": 1, "unit": "piece" }
Response: meal + nutrients

POST /foods/resolve-text
Request: { "text": "rice dal paneer" }
Response: { "ingredients": [ ... ], "assumptions": [ ... ] }

GET /foods/barcode/{barcode}
Response: product + normalized food item + confidence

POST /meals/{mealId}/items
Request: { "ingredientId": "...", "quantity": 1, "unit": "bowl" }
Response: updated meal + nutrients

GET /meals/{mealId}
GET /meals?day=2026-01-19

GET /days/{day}/nutrients
Response: day totals + drill-down attribution

GET /meals/{mealId}/nutrients
Response: meal totals + drill-down attribution

GET /users/me/assumptions
PATCH /users/me/assumptions/{assumptionId}
