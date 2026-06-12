# Agents

## Cursor Cloud specific instructions

### Overview

This is a meal/nutrition tracking app ("Joul") with two main components:
- **Backend**: Node.js + Express 5 + TypeScript REST API (port 4000)
- **App**: Expo (React Native) mobile app (iOS-first)

### Services

| Service | How to run | Notes |
|---------|-----------|-------|
| PostgreSQL | `pg_ctlcluster 16 main start` | Must be running before backend starts |
| Backend API | `cd backend && npm run dev` | Starts on port 4000 with hot-reload via ts-node-dev |
| App (Metro) | `cd app && npm run start` | Requires iOS Simulator (not available in cloud) |

### Backend development

- **Run dev server**: `cd backend && npm run dev`
- **Run tests**: `cd backend && npm test` (vitest)
- **TypeScript check**: `cd backend && npx tsc --noEmit` (passes cleanly)
- **Build**: `cd backend && npm run build`

The backend gracefully degrades without `OPENAI_API_KEY` or `DATABASE_URL` — it starts and logs warnings but disables affected features.

### Database

PostgreSQL 16 is used. The database name is `mealtracking`. Connection string format:
```
postgres://postgres:postgres@localhost:5432/mealtracking
```

The schema is in `backend/schema.sql` and is auto-applied on server start when the database is reachable.

### App development

The app uses Expo SDK 54 with React Native 0.81. It has 34 pre-existing TypeScript errors (strict mode) that are in the committed code — these are not regressions.

The app's Metro bundler (`npm run start`) requires an iOS Simulator which is not available in Cloud Agent VMs. Backend-only development and testing is the recommended scope for cloud agents.

### Key env vars (backend/.env)

See `backend/env.example`. Required: `DATABASE_URL`. Optional: `OPENAI_API_KEY`, `REVENUECAT_API_KEY_IOS`.

### Gotchas

- The backend uses Express 5 (not 4). Error handling middleware signatures differ.
- `ts-node-dev` hot-reloads on file changes but does NOT restart on new `npm install` — restart the dev server manually after adding dependencies.
- The app's `postinstall` script (`scripts/fix-expo-nested-modules.sh`) must run after `npm install` in the app directory.
