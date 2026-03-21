# Barcode MVP

## Flow

1. **App** — Add item(s) → **SCAN BARCODE** → camera scans EAN-13 / EAN-8 / UPC-A / UPC-E.
2. **Client** — `GET {BARCODE_API_BASE_URL}/foods/barcode/{digits}`. In **`__DEV__`**, if `EXPO_PUBLIC_API_BASE_URL` is a **LAN/localhost HTTP** URL, `BARCODE_API_BASE_URL` defaults to the **production** API so barcode works on a phone without a local backend. Override with **`EXPO_PUBLIC_BARCODE_API_BASE_URL`**.
3. **Server** — Proxies **[Open Food Facts](https://world.openfoodfacts.org)** API v2 (`/api/v2/product/{code}`), maps nutriments to your `NutrientTotals`, estimates **portion grams** using (in order): `serving_quantity` + unit (rejecting values that match **whole-pack** `quantity`), parsed `serving_size` (incl. French *grammes* / *gr*, bare `"40"`), ratio of per-serving vs per-100g nutrients (reject if ≈ pack weight). **`product.quantity` is never used as a serving** (it is usually total pack, e.g. 600 g vs 40 g portion). If nothing matches, the API uses **100 g** as a placeholder and, when **`OPENAI_API_KEY`** is set, asks OpenAI for a **typical single-serving grams** (from name, OFF `categories_tags`, kcal/100g, pack weight); nutrients are scaled to that portion. If the key is missing or the model fails, the response stays at **100 g** and the note explains that OFF had no serving.
4. **User** — Sees product + **grams** field (default = server’s serving estimate), can edit, then **Add to meal**. Nutrients are scaled by `userGrams / servingGrams` from the preview payload.

## Env (Render / local)

- Optional: `OPENFOODFACTS_USER_AGENT` — descriptive User-Agent (recommended by OFF). Default in code is a generic dev string.
- Optional: `OPENAI_API_KEY` (+ `OPENAI_MODEL`) — when OFF has no serving size, suggest a reasonable default portion in grams; see `backend/env.example`.
- Optional (app): `EXPO_PUBLIC_BARCODE_API_BASE_URL` — force barcode requests to a specific base URL (e.g. local backend for testing the proxy).

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
