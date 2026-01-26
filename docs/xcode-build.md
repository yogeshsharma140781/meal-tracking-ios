# Xcode Build: Warnings & Build Time

## Why So Many Warnings?

Xcode builds for this Expo/React Native app produce a large number of warnings. They come from **three main sources**:

### 1. Run-script phases (“will be run during every build”)

Several **CocoaPods / React Native** script phases run on every build instead of only when their inputs change:

- `[CP-User] [Hermes] Replace Hermes for the right configuration`
- `[CP-User] [RNDeps] Replace React Native Dependencies / Core`
- `[RN]Check FBReactNativeSpec`
- `[Expo] Configure project`
- `Bundle React Native code and images`
- `Generate app.config for prebuilt Constants.manifest`

**Why:** These phases often don’t declare outputs, so Xcode can’t do dependency analysis and re-runs them every time. This is **upstream** (React Native, Expo, Hermes) behavior.

**Impact:** Slower incremental builds. The build still succeeds.

### 2. JS bundle / Hermes (“variable was not declared”)

Many warnings refer to **`main.jsbundle`** and look like:

```text
warning: the variable "Promise" was not declared...
warning: the variable "fetch" was not declared...
warning: the variable "setTimeout" was not declared...
```

**Why:** Hermes (or the JS toolchain) analyzes the bundled JavaScript. Globals like `Promise`, `fetch`, `setTimeout`, `AbortController`, etc. are **provided by the React Native runtime** at runtime, not “declared” in the bundle. The analyzer still warns about them.

**Impact:** **No functional impact.** Safe to ignore. Fixing them would require upstream changes to the Hermes/Expo toolchain.

### 3. AppIntents / optional frameworks

```text
warning: Metadata extraction skipped. No AppIntents.framework dependency found.
```

**Why:** Xcode checks for App Intents (e.g. Siri/Shortcuts). The app doesn’t use that framework.

**Impact:** None. Can be ignored.

---

## What You Can Do About Warnings

| Action | Effect |
|--------|--------|
| **Ignore them** | Build works; warnings are mostly from RN/Expo/Hermes. |
| **Reduce “run every build” scripts** | Possible via Xcode: per script phase, either add output files or uncheck “Based on dependency analysis”. These live in the **Pods** project; changes can be overwritten by `pod install`. |
| **Upstream** | Hermes/React Native/Expo would need to add outputs or fix globals; we can’t fix that in this repo. |

---

## Improving Build Time

### 1. **Use ccache (compiler cache)**

The project is set up to use **ccache** when building native code. It’s enabled via `ios/Podfile.properties.json`:

```json
"apple.ccacheEnabled": "true"
```

**Requirement:** Install ccache on your Mac:

```bash
brew install ccache
```

Then run `pod install` in `app/ios` and rebuild. Repeated builds (especially incremental) should be faster.

### 2. **Avoid clean builds**

Prefer **incremental** builds instead of “Clean Build Folder” when you haven’t changed native code or Pods. Clean builds ignore caches and are much slower.

### 3. **Keep Derived Data on a fast disk**

Use an SSD for Xcode Derived Data. In Xcode: **Settings → Locations → Derived Data** (default is `~/Library/Developer/Xcode/DerivedData`).

### 4. **Use Release only when needed**

- **Debug** builds are faster to compile but produce a heavier app.
- **Release** is slower to build but required for production. Use it when testing performance or creating installable builds.

### 5. **Build for one destination**

When possible, build for a single simulator or device (e.g. one iPhone model) instead of “generic device” or multiple destinations. Fewer architectures → faster builds.

### 6. **Parallel builds**

Xcode parallelizes by default. Ensure **Build Settings → Build Options → Parallelize Build** is enabled.

### 7. **Optional: local build cache**

Tools like **XCRemoteCache** or **ccache** (already configured) can cache compilation output across machines or runs. CCache is the one we’ve enabled for this project.

---

## Summary

- **Warnings:** Mostly from React Native / Expo / Hermes (run-script phases + JS bundle globals). They’re expected and can be ignored for day‑to‑day development.
- **Build time:** Use **ccache** (`brew install ccache`), avoid unnecessary clean builds, and keep Derived Data on an SSD. Incremental builds will benefit the most.
