# macOS Release Distribution

CrossPDF Studio distributes macOS builds via GitHub Releases. Two paths exist:

| Path                           | Status                                         | Command                    |
| ------------------------------ | ---------------------------------------------- | -------------------------- |
| **Unsigned release**           | Working                                        | `pnpm package:mac:release` |
| **Signed + notarized release** | Blocked — requires Apple Developer credentials | `pnpm package:mac:signed`  |

---

## Unsigned Release (current path)

Unsigned builds are the primary release path until Apple Developer credentials
become available. The app runs on macOS but requires a one-time Gatekeeper bypass.

### Build unsigned DMG + ZIP + metadata

```bash
pnpm package:mac:release
```

This single command:

1. Builds the TypeScript + Vite production bundle
2. Packages unsigned DMG + ZIP for arm64 (and x64 if configured)
3. Generates `latest-mac.yml` for electron-updater
4. Runs `verify-update-metadata.sh` to validate all artifacts

Output in `release/`:

```
release/
  ├── CrossPDF Studio-X.Y.Z-arm64.dmg        ← manual install
  ├── CrossPDF Studio-X.Y.Z-arm64-mac.zip     ← auto-update asset
  └── latest-mac.yml                           ← electron-updater metadata
```

### Verify metadata

```bash
bash scripts/verify-update-metadata.sh release
```

Checks `latest-mac.yml` exists, references a ZIP, the ZIP file matches the YAML
`url` field, version is consistent, and `publish.provider: github` is set.

### Verify signing state

```bash
bash scripts/verify-update-metadata.sh release     # metadata
bash scripts/sign-verify.sh --unsigned "release/mac-arm64/CrossPDF Studio.app"
```

The `--unsigned` mode expects ad-hoc signature, Gatekeeper rejection, and no
notarization ticket — all correct for unsigned builds.

### Publish to GitHub

```bash
# Extract the YAML-referenced filename (hyphens, no spaces)
YAML_ZIP=$(grep '^\s*url:' release/latest-mac.yml | head -1 | awk '{print $2}' | tr -d '"')

# Copy with YAML-consistent name if needed
cp "release/CrossPDF Studio-X.Y.Z-arm64-mac.zip" "release/$YAML_ZIP"

gh release create vX.Y.Z \
  "release/$YAML_ZIP" \
  "release/CrossPDF Studio-X.Y.Z-arm64.dmg" \
  "release/latest-mac.yml" \
  --repo terlanjurkeren9/crosspdf-studio \
  --title "vX.Y.Z" \
  --notes "Release notes. ⚠️ Unsigned: right-click → Open to bypass Gatekeeper."
```

### Gatekeeper bypass (for users)

macOS blocks unsigned apps by default. Users must:

1. Right-click (or Control-click) the `.app` → **Open**
2. Click **Open** in the security dialog
3. The app launches normally on subsequent opens

This applies to both the DMG install and the ZIP install. The same bypass is
needed after an auto-update installs a new version.

### Auto-update with unsigned builds

`electron-updater` can detect and download updates from GitHub Releases without
signing. The flow:

```
Help → Check for Updates
  → GitHub API → latest-mac.yml → version comparison
  → Download ZIP asset
  → "Update downloaded. Restart to install."
  → Quit & Install → relaunches with new version
```

**Limitation:** `electron-updater` verifies the code signature of the downloaded
update on macOS. On unsigned builds, this verification fails. The download completes
but the install step may fail silently or the relaunched app may be blocked by
Gatekeeper. Users must bypass Gatekeeper again after each update.

This is the expected behavior for unsigned distribution and is not a bug in the
update infrastructure.

### Quick reference — all unsigned commands

| Command                                          | Output                                               |
| ------------------------------------------------ | ---------------------------------------------------- |
| `pnpm package:mac:dir`                           | `.app` only (fastest — no DMG/ZIP/metadata)          |
| `pnpm package:mac:zip`                           | `.app` + ZIP + `latest-mac.yml`                      |
| `pnpm package:mac:release`                       | `.app` + DMG + ZIP + `latest-mac.yml` + verification |
| `pnpm package:mac:unsigned`                      | DMG + ZIP (no metadata verification)                 |
| `bash scripts/verify-update-metadata.sh release` | Validate metadata + artifacts                        |
| `bash scripts/sign-verify.sh --unsigned <app>`   | Validate unsigned signing state                      |

---

## Signed + Notarized Release (blocked)

**Status: Blocked.** Apple Developer credentials are not available. The following
is documented for when credentials become available.

### Required environment variables

| Variable           | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `CSC_LINK`         | Path to Developer ID Application `.p12` or `.pem`        |
| `CSC_KEY_PASSWORD` | Password/passphrase for the signing certificate          |
| `APPLE_TEAM_ID`    | Apple Developer Team ID (10-char alphanumeric)           |
| `CSC_IDENTITY`     | (optional) Common Name of signing cert — auto-discovered |

Notarization (choose one):

| Flow                                    | Variables                                                                    |
| --------------------------------------- | ---------------------------------------------------------------------------- |
| App Store Connect API Key (recommended) | `APPLE_API_KEY_ID` + `APPLE_API_ISSUER_ID` (+ optional `APPLE_API_KEY_PATH`) |
| Apple ID + app-specific password        | `APPLE_ID` + `APPLE_APP_SPECIFIC_PASSWORD`                                   |

### How it works

```
pnpm package:mac:signed
    │
    ├── scripts/check-signing-env.cjs   ← fail early if missing vars
    │
    ├── pnpm build                       ← production build
    │
    ├── electron-builder --mac           ← signs .app with CSC_IDENTITY
    │
    └── scripts/notarize.cjs             ← afterSign hook: submits to Apple
```

### electron-builder.yml config (relevant)

```yaml
mac:
  identity: ${CSC_IDENTITY}
  hardenedRuntime: true
  entitlements: resources/entitlements.mac.plist
  gatekeeperAssess: false

afterSign: scripts/notarize.cjs

publish:
  provider: github
  owner: terlanjurkeren9
  repo: crosspdf-studio
```

### Prerequisites

1. Enroll in [Apple Developer Program](https://developer.apple.com/programs/) ($99/year)
2. Create a **Developer ID Application** certificate
3. Export as `.p12` → set as `CSC_LINK` + `CSC_KEY_PASSWORD`
4. Find **Team ID** in Apple Developer Account → Membership

### CI integration

```yaml
# With credentials:
- name: Package macOS (signed)
  env:
    CSC_LINK: ${{ secrets.CSC_LINK }}
    CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
    APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
    APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
    APPLE_API_ISSUER_ID: ${{ secrets.APPLE_API_ISSUER_ID }}
  run: pnpm package:mac:signed

# Without credentials (falls back to unsigned):
- name: Package macOS (unsigned)
  run: pnpm package:mac:unsigned
```

### What changes with signed builds

| Aspect              | Unsigned                           | Signed + Notarized         |
| ------------------- | ---------------------------------- | -------------------------- |
| Gatekeeper          | Blocks (user bypass needed)        | Accepted                   |
| `codesign --verify` | Fails                              | Passes                     |
| `stapler validate`  | No ticket                          | Ticket stapled             |
| Auto-update install | May fail (signature check)         | Works end-to-end           |
| User experience     | Right-click → Open on first launch | Normal double-click launch |

---

## Scripts

| Script                              | Purpose                                                                |
| ----------------------------------- | ---------------------------------------------------------------------- |
| `scripts/notarize.cjs`              | electron-builder `afterSign` hook; submits notarization via notarytool |
| `scripts/check-signing-env.cjs`     | Pre-flight credential validation; exits 1 if missing                   |
| `scripts/sign-verify.sh`            | Post-build verification: `codesign`, `spctl`, `stapler`                |
| `scripts/verify-update-metadata.sh` | Validate `latest-mac.yml`, ZIP artifacts, filename consistency         |
| `scripts/release-smoke-test.sh`     | Document manual auto-update smoke test steps                           |

---

## Update Metadata Verification

```bash
bash scripts/verify-update-metadata.sh [release-dir]
```

| Check                             | Why                                            |
| --------------------------------- | ---------------------------------------------- |
| `latest-mac.yml` exists           | electron-updater reads this to detect versions |
| YAML references `.zip`            | electron-updater downloads ZIP (not DMG)       |
| ZIP file matches YAML `url` field | Prevents GitHub asset name mismatch            |
| DMG present (informational)       | Manual install artifact                        |
| Version consistent                | `package.json` version matches metadata        |
| `publish.provider: github`        | Required for GitHub provider                   |

### YAML ↔ filename mismatch

electron-builder generates ZIP filenames with spaces (`CrossPDF Studio-X.Y.Z-arm64-mac.zip`)
but the YAML `url` field uses hyphens (`CrossPDF-Studio-X.Y.Z-arm64-mac.zip`). The
verification script detects this and reports the exact `cp` command to fix it before
uploading to GitHub.

---

## Entitlements

`resources/entitlements.mac.plist` contains hardened runtime exceptions for JIT,
unsigned executable memory, and library validation — required by Electron and
compatible with notarization.

---

## Security notes

- `.env*` is in `.gitignore` — credentials are never committed
- `CSC_LINK` in CI should be a base64-encoded secret, not a plain file path
- `notarize.cjs` does not log credentials; only operation status messages
- `check-signing-env.cjs` prevents partial-signing scenarios
