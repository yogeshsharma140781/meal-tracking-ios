# Barcode MVP

## Flow

1. **App** — Add item(s) → **SCAN BARCODE** → camera scans EAN-13 / EAN-8 / UPC-A / UPC-E.
2. **Client** — `GET {API_BASE_URL}/foods/barcode/{digits}` (same host as `/v1/meals`).
3. **Server** — Proxies **[Open Food Facts](https://world.openfoodfacts.org)** API v2 (`/api/v2/product/{code}`), maps nutriments to your `NutrientTotals`, estimates **portion grams** from `serving_size` / `quantity` (defaults to **100 g** if unknown).
4. **User** — Confirms **Add to meal**; one `MealItem` is appended to the selected meal.

## Env (Render / local)

- Optional: `OPENFOODFACTS_USER_AGENT` — descriptive User-Agent (recommended by OFF). Default in code is a generic dev string.

## Deploy

- Deploy **backend** so `/v1/foods/barcode/:code` is live.
- App already uses `API_BASE_URL` → e.g. `https://meal-tracking-api.onrender.com/v1` → request is  
  `https://meal-tracking-api.onrender.com/v1/foods/barcode/3017620422003`.

## Limitations (MVP)

- Not every barcode exists in OFF; 404 → error message.
- Nutrient coverage varies by product; missing macros still return partial data when possible.
- Portion size is best-effort from pack text.

## Attribution

UI shows **“Nutrition via Open Food Facts”**; keep it visible or equivalent in shipping builds per OFF terms.
