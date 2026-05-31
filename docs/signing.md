# macOS Code Signing & Notarization

Code signing and notarization for macOS builds. All flows are **env-gated** —
unsigned local packaging works without Apple credentials.

## Quick reference

| Scenario                   | Command                                                               |
| -------------------------- | --------------------------------------------------------------------- |
| Local unsigned build       | `pnpm package:mac:unsigned`                                           |
| Local unsigned (dev debug) | `pnpm package:mac:dev`                                                |
| Local unsigned (.app only) | `pnpm package:mac:dir` (fastest — skips DMG/ZIP)                      |
| Local unsigned (ZIP only)  | `pnpm package:mac:zip` (reliable — skips hdiutil DMG)                 |
| Signed + notarized build   | `pnpm package:mac:signed` (requires env vars)                         |
| Verify an existing .app    | `bash scripts/sign-verify.sh "release/mac-arm64/CrossPDF Studio.app"` |

## Required secrets / environment variables

### Code signing (mandatory for signed builds)

| Variable           | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `CSC_LINK`         | Path to Developer ID Application `.p12` or `.pem`        |
| `CSC_KEY_PASSWORD` | Password/passphrase for the signing certificate          |
| `APPLE_TEAM_ID`    | Apple Developer Team ID (10-char alphanumeric)           |
| `CSC_IDENTITY`     | (optional) Common Name of signing cert — auto-discovered |

### Notarization (choose one flow)

**Option A — App Store Connect API Key (recommended)**

| Variable              | Description                               |
| --------------------- | ----------------------------------------- |
| `APPLE_API_KEY_ID`    | App Store Connect API Key ID              |
| `APPLE_API_ISSUER_ID` | App Store Connect Issuer ID               |
| `APPLE_API_KEY_PATH`  | (optional) Path to `.p8` private key file |

**Option B — Apple ID with app-specific password**

| Variable                      | Description                                          |
| ----------------------------- | ---------------------------------------------------- |
| `APPLE_ID`                    | Apple ID email address                               |
| `APPLE_APP_SPECIFIC_PASSWORD` | App-specific password generated in appleid.apple.com |

## How it works

```
pnpm package:mac:signed
    │
    ├── scripts/check-signing-env.cjs   ← pre-flight: fail early if missing vars
    │
    ├── pnpm build                       ← TypeScript + Vite production build
    │
    ├── electron-builder --mac           ← signs .app with identity from
    │                                        CSC_IDENTITY (or auto-discovered
    │                                        from CSC_LINK certificate)
    │
    └── scripts/notarize.cjs             ← afterSign hook (top-level):
            │                                reads env; if credentials present,
            │                                submits to Apple notary service
            │                                via notarytool
            │
            └── if no credentials: print
                "skipping notarization"
                and exit cleanly
```

### electron-builder.yml config

```yaml
mac:
  identity: ${CSC_IDENTITY}
  hardenedRuntime: true
  gatekeeperAssess: false

afterSign: scripts/notarize.cjs
```

- `identity: ${CSC_IDENTITY}` — if `CSC_IDENTITY` is set, use it as the signing identity name; if unset (empty), electron-builder auto-discovers from `CSC_LINK` certificate.
- `CSC_IDENTITY_AUTO_DISCOVERY=false` — when set, signing is skipped entirely (used by `package:mac:unsigned`, `package:mac:dev`, and `package:mac:dir`)
- `hardenedRuntime: true` — required by Apple notary
- `gatekeeperAssess: false` — avoids local verify failure on unsigned builds
- `afterSign` — calls our notarization hook

## Reliable unsigned smoke test

`pnpm package:mac:dir` produces only the `.app` bundle (no DMG/ZIP).
This bypasses `hdiutil` contention issues that can cause transient failures on
some macOS configurations.

If you need a distributable archive without DMG risk, use `pnpm package:mac:zip`
which produces only the ZIP artifact:

```bash
pnpm package:mac:zip
```

For file-size validation (no packaging at all):

```bash
pnpm package:mac:dir
```

Output: `release/mac-arm64/CrossPDF Studio.app`

## Scripts

| Script                          | Purpose                                                                |
| ------------------------------- | ---------------------------------------------------------------------- |
| `scripts/notarize.cjs`          | electron-builder `afterSign` hook; submits notarization via notarytool |
| `scripts/check-signing-env.cjs` | Pre-flight credential validation; exits with clear message if missing  |
| `scripts/sign-verify.sh`        | Post-build verification: `codesign`, `spctl`, `stapler` checks         |

## Verification commands

After packaging, verify the `.app` bundle:

```bash
# Full verification script
bash scripts/sign-verify.sh "release/mac-arm64/CrossPDF Studio.app"
```

Individual manual checks:

```bash
APP="release/mac-arm64/CrossPDF Studio.app"

# Show signing details (works on unsigned too — prints ad-hoc/no signature)
codesign -dvvv "$APP"

# Strict signature validation (fails on unsigned — expected for local builds)
codesign --verify --deep --strict "$APP"

# Gatekeeper assessment
spctl -a -t exec -vv "$APP"

# Check notarization ticket
stapler validate "$APP"
```

**Expected results by build type:**

| Check               | Unsigned build   | Signed + notarized build |
| ------------------- | ---------------- | ------------------------ |
| `codesign --verify` | ✗ (no signature) | ✓ (Developer ID valid)   |
| `spctl -a`          | ✗ (rejected)     | ✓ (accepted)             |
| `stapler validate`  | ✗ (no ticket)    | ✓ (ticket stapled)       |

## CI integration

Add these as GitHub Actions secrets (repo → Settings → Secrets and variables → Actions):

```
APPLE_TEAM_ID
CSC_LINK             ← base64-encoded .p12
CSC_KEY_PASSWORD
APPLE_API_KEY_ID
APPLE_API_ISSUER_ID
APPLE_API_KEY_PATH   ← (optional) store .p8 content as secret, write to disk during CI
```

Example CI job step:

```yaml
- name: Package macOS (signed)
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
    APPLE_API_ISSUER_ID: ${{ secrets.APPLE_API_ISSUER_ID }}
  run: pnpm package:mac:signed
```

Without secrets, CI builds fall back to unsigned (no crash):

```yaml
- name: Package macOS (unsigned — no secrets)
  run: pnpm package:mac:unsigned
```

## Prerequisites (Apple Developer)

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/)
2. Create a **Developer ID Application** certificate in Xcode or Apple Developer portal
3. Export as `.p12` with password → set as `CSC_LINK` + `CSC_KEY_PASSWORD`
4. Find your **Team ID** in [Apple Developer Account](https://developer.apple.com/account) → Membership

### App Store Connect API Key (Option A)

1. Go to [App Store Connect → Users and Access → Keys](https://appstoreconnect.apple.com/access/api)
2. Create a key with **Developer** role
3. Download `.p8` file, note **Key ID** and **Issuer ID**

### App-specific password (Option B)

1. Sign in at [appleid.apple.com](https://appleid.apple.com)
2. Security → App-Specific Passwords → Generate
3. Use label like "CrossPDF Studio CI"

## Entitlements

The app uses `resources/entitlements.mac.plist` with hardened runtime exceptions for
JIT (`allow-jit`), unsigned executable memory, and library validation. These are
necessary for Electron + native addons and are compatible with notarization.

## Security notes

- `.env*` is in `.gitignore` — credentials are never committed
- `CSC_LINK` in CI should be a base64-encoded secret, not a plain file path
- `notarize.cjs` does not log credentials; only operation status messages
- The `check-signing-env.cjs` pre-flight prevents partial-signing scenarios

## Auto-Update Infrastructure

CrossPDF Studio uses `electron-updater` with the GitHub Releases provider configured
in `electron-builder.yml`:

```yaml
publish:
  provider: github
  owner: terlanjurkeren9
  repo: crosspdf-studio
```

`electron-updater` resolves releases via the GitHub API using `owner`/`repo` at
runtime. Without these fields the updater cannot locate release assets.

### How it works

```
GitHub Release (with latest-mac.yml)
  → electron-updater checks for newer version
  → Downloads update ZIP asset
  → Installs on quit (autoInstallOnAppQuit: true)
```

### Initialization

- `updater.service.ts` initializes only when `app.isPackaged === true` and
  `CROSSPDF_E2E` is not set. In dev or E2E mode, the updater is fully skipped
  and no network calls are made.
- Initial check runs on startup (non-blocking, errors are logged and swallowed).
- User can manually check via Help → "Check for Updates" menu item.

### Guard rails

- `downloadUpdate()` only calls `autoUpdater.downloadUpdate()` when internal
  state is `available`. Calling it in any other state is a no-op.
- `quitAndInstall()` only calls `autoUpdater.quitAndInstall()` when internal
  state is `downloaded`. Calling it in any other state is a no-op.
- The preload sanitises every `update:status` payload before it reaches the
  renderer, discarding malformed data and falling back to an `error` state.

### IPC surface

| Channel                   | Direction       | Description                            |
| ------------------------- | --------------- | -------------------------------------- |
| `update:check`            | renderer → main | Trigger check for updates              |
| `update:download`         | renderer → main | Download available update              |
| `update:quit-and-install` | renderer → main | Quit app and install downloaded update |
| `update:get-state`        | renderer → main | Get current update state               |
| `update:status`           | main → renderer | Push status/progress changes           |

All renderer→main channels use `ipcRenderer.invoke` / `ipcMain.handle`
(request/response) for consistency.

### Production requirements

- **Signed + notarized builds are mandatory** for macOS auto-update. `electron-updater`
  verifies the code signature of the downloaded update; unsigned builds will fail
  this check silently.
- **A GitHub Release** with `latest-mac.yml` (macOS) and/or `latest.yml` (Windows)
  assets must exist for `electron-updater` to detect an available update. The release
  tag must be a valid semver (e.g. `v0.2.0`) higher than the current `package.json`
  version.
- **Windows**: NSIS installer updates use the same GitHub provider.
- **macOS**: The release must include a ZIP asset (not just DMG) because
  `electron-updater` downloads ZIP files for macOS updates.

### Residual risk

- **Real update flow has never been tested end-to-end.** No signed/notarized release
  has been published to the GitHub Releases channel. Until a real release exists,
  the full check → download → quit-and-install cycle remains unverified in
  production conditions.
- E2E tests cover only the UI surface (menu item presence, no-crash smoke). They
  do not exercise actual network calls or binary replacement.
- The `electron-updater` GitHub provider reads release metadata from the GitHub API.
  Rate limiting may affect frequent checks.
