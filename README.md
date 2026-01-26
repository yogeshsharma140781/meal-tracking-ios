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

Update `API_BASE_URL` in `app/App.tsx` to point to your backend host.

For **Xcode builds** (warnings, build time): see [docs/xcode-build.md](docs/xcode-build.md). Enable **ccache** (`brew install ccache`) and set `apple.ccacheEnabled` in `app/ios/Podfile.properties.json` to speed up native builds.
