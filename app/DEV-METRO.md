# Metro without global `npm` / Node on PATH

This repo includes **Node 20** under `meal-tracking-ios/.tools/node-v20.20.1-darwin-arm64/`.

If Terminal says `npm: command not found`, **do not use `npm run`** — use the scripts below (only `bash` is required).

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

## If it still fails

- **Firewall:** allow **node** / **Terminal** on port **8081** (incoming).
- **No LAN:** `bash scripts/with-bundled-node.sh npx expo start --tunnel --clear`
