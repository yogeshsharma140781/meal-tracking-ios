## Meal Tracking

This repo contains:
- `backend/`: Node.js + TypeScript REST API
- `app/`: Expo (React Native) mobile app
- `docs/`: Architecture, schema, API notes

### Backend setup

1) Create a Postgres database and run:
```
psql -d mealtracking -f backend/schema.sql
```
   (Includes `feedback` table for Share feedback feature.)
2) Create `backend/.env` from `backend/env.example` and set `DATABASE_URL`.
3) Install and run:
```
cd backend
npm install
npm run dev
```

### App setup

```
cd app
npm install
npm run start
```

1. Create `app/.env` from `app/env.example` and set `EXPO_PUBLIC_REVENUECAT_API_KEY_IOS` (RevenueCat dashboard → Project → API keys).
2. Update `API_BASE_URL` in `app/App.tsx` to point to your backend host.

**Feedback export (spreadsheet):** After running `schema.sql`, the `feedback` table is created. Export all feedback as CSV via:
```
GET /v1/feedback/export
```
(e.g. open `https://your-api/v1/feedback/export` in a browser to download).

For **Xcode builds** (warnings, build time): see [docs/xcode-build.md](docs/xcode-build.md). Enable **ccache** (`brew install ccache`) and set `apple.ccacheEnabled` in `app/ios/Podfile.properties.json` to speed up native builds.

### Production

**iOS app (Release)**

- Build for simulator: `cd app && npm run build`  
  Output: `app/ios/build/Build/Products/Release-iphonesimulator/Joul.app`
- Build and run on booted simulator: `cd app && npm run ios:production:simulator`
- Build for device (e.g. before archiving): `cd app && npm run build:device`  
  For App Store / TestFlight, open `app/ios/Joul.xcworkspace` in Xcode and use **Product → Archive**.

**Backend**

- Build and run in production: `cd backend && npm run production`  
  (Runs `tsc` then `NODE_ENV=production node dist/index.js`.)  
  Ensure `DATABASE_URL` and any API keys are set in `backend/.env`.

### Feedback (Share feedback)

- **Submit**: App POSTs to `POST /v1/feedback` with `{ rating: 1-5, text?: string }`.
- **Export to spreadsheet**: `GET /v1/feedback/export` returns CSV. Open in a browser or curl:
  ```
  curl -o feedback.csv "https://YOUR_API/v1/feedback/export"
  ```
  Import `feedback.csv` into Excel or Google Sheets.
