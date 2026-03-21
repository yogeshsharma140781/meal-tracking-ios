# Metro without global `npm` / Node on PATH

This repo includes **Node 20** under `meal-tracking-ios/.tools/node-v20.20.1-darwin-arm64/`.

If Terminal says `npm: command not found`, **do not use `npm run`** — use the scripts below (only `bash` is required).

## Always a clean restart

- **`start-metro-lan.sh`**, **`npm run start`**, **`npm run start:lan`**, and **`npm run start:tunnel`** all:
  1. **Stop** any existing Metro listener on port **8081** (`scripts/kill-metro-if-running.sh`).
  2. Start Expo with **`--clear`** and **`--port 8081`** (avoids interactive “use 8082?” in some terminals).
  3. Run with **`env -u CI`** so **Fast Refresh stays on** (Cursor / CI often sets `CI=true`, which makes Metro say *“reloads are disabled”*).

## Start Metro (physical iPhone + Xcode Debug)

1. In Terminal:

   ```bash
   cd "/path/to/meal-tracking-ios/app"
   bash start-metro-lan.sh
   ```

   Or from the `app` folder:

   ```bash
   ./start-metro-lan.sh
   ```

   (If permission denied: `chmod +x start-metro-lan.sh` once.)

2. Leave that window open. Then **Run** the app from Xcode.

## If you *do* have `npm` on PATH

You can still use:

```bash
npm run start:lan
npm run start:tunnel
```

Those run the same bundled Node via `scripts/with-bundled-node.sh`.

## Double‑click (macOS Finder)

- `app/scripts/start-metro-lan.command` — double‑click (first time: **Right‑click → Open** if macOS warns).

## Barcode scan on your phone (SCAN BARCODE tab)

When `EXPO_PUBLIC_API_BASE_URL` points at a **LAN IP** (e.g. `http://192.168.x.x:4000/v1`) for dev, **meal** requests still go there — but **barcode lookup** automatically uses the **hosted HTTPS API** (`https://meal-tracking-api.onrender.com/v1`) so you don’t need the backend running on your Mac for scans to work.

- To force barcode to a specific host: set **`EXPO_PUBLIC_BARCODE_API_BASE_URL`** (optional).
- In Xcode / Metro logs, look for `[api] BARCODE_API_BASE_URL` and `[barcode] GET …` to confirm the URL.

## UI changes not showing on device?

- **Debug + Metro:** Shake device → **Reload**, or stop Metro and run `bash start-metro-lan.sh` again (kills old Metro + `--clear`).
- **Xcode Run without Metro (Release / embedded JS):** JavaScript is **baked into the app at build time**. Editing `App.tsx` does **nothing** until you **Product → Clean Build Folder** and **Run** again (or archive a new build).

After a barcode scan you should see **grams**, **~N kcal**, and **Add to meal** when the new bundle is loaded.

## If it still fails

- **Firewall:** allow **node** / **Terminal** on port **8081** (incoming).
- **No LAN:** `bash scripts/kill-metro-if-running.sh && env -u CI bash scripts/with-bundled-node.sh npx expo start --tunnel --clear --port 8081`
