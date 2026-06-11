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
3. Runs `prepare-release-artifacts.sh` to normalize filenames
   (copies space-named electron-builder output to the hyphenated names
   that `latest-mac.yml` references, and regenerates the YAML with
   correct sha512 hashes and file sizes)
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

Checks `latest-mac.yml` exists, version matches `package.json`, every
referenced artifact exists with matching sha512 and file size, a ZIP is
referenced, and `publish.provider: github` is set. Fails if the only reason
checks pass is stale artifacts from previous builds.

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

| Command                                          | Output                                                                      |
| ------------------------------------------------ | --------------------------------------------------------------------------- |
| `pnpm package:mac:dir`                           | `.app` only (fastest — no DMG/ZIP/metadata)                                 |
| `pnpm package:mac:zip`                           | `.app` + ZIP + `latest-mac.yml`                                             |
| `pnpm package:mac:release`                       | `.app` + DMG + ZIP + `latest-mac.yml` + normalized artifacts + verification |
| `pnpm package:mac:unsigned`                      | DMG + ZIP (no metadata verification or artifact normalization)              |
| `bash scripts/prepare-release-artifacts.sh`      | Normalize filenames, regenerate YAML with correct sha512/size               |
| `bash scripts/verify-update-metadata.sh release` | Validate metadata, artifacts, sha512, size consistency                      |
| `bash scripts/sign-verify.sh --unsigned <app>`   | Validate unsigned signing state                                             |

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

Use separate jobs for signed and unsigned builds. `pnpm package:mac:signed` is
not a superset of unsigned — it requires credentials and will fail without them.

```yaml
# Unsigned build (current path — no Apple credentials needed):
- name: Package macOS (unsigned release)
  run: pnpm package:mac:release
# Signed build (blocked — requires Apple Developer credentials):
# - name: Package macOS (signed)
#   env:
#     CSC_LINK: ${{ secrets.CSC_LINK }}
#     CSC_KEY_PASSWORD: ${{ secrets.CSC_KEY_PASSWORD }}
#     APPLE_TEAM_ID: ${{ secrets.APPLE_TEAM_ID }}
#     APPLE_API_KEY_ID: ${{ secrets.APPLE_API_KEY_ID }}
#     APPLE_API_ISSUER_ID: ${{ secrets.APPLE_API_ISSUER_ID }}
#   run: pnpm package:mac:signed
```

Do not use `pnpm package:mac:signed` as a "try signed, fall back to unsigned"
strategy. The commands are independent paths. If credentials are unavailable,
use the unsigned command directly.

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

| Script                                 | Purpose                                                                  |
| -------------------------------------- | ------------------------------------------------------------------------ |
| `scripts/prepare-release-artifacts.sh` | Normalize filenames, regenerate YAML with correct sha512/size            |
| `scripts/notarize.cjs`                 | electron-builder `afterSign` hook; submits notarization via notarytool   |
| `scripts/check-signing-env.cjs`        | Pre-flight credential validation; exits 1 if missing                     |
| `scripts/sign-verify.sh`               | Post-build verification: `codesign`, `spctl`, `stapler`                  |
| `scripts/verify-update-metadata.sh`    | Validate `latest-mac.yml`, artifacts, sha512, size, filename consistency |
| `scripts/release-smoke-test.sh`        | Document manual auto-update smoke test steps                             |

---

## Update Metadata Verification

```bash
bash scripts/verify-update-metadata.sh [release-dir]
```

| Check                                       | Why                                            |
| ------------------------------------------- | ---------------------------------------------- |
| `latest-mac.yml` exists                     | electron-updater reads this to detect versions |
| Version matches `package.json`              | Prevents shipping stale metadata               |
| Every `files[].url` artifact exists         | Prevents GitHub asset name mismatch            |
| Each artifact file size matches YAML `size` | Prevents truncated or partial uploads          |
| Each artifact sha512 matches YAML `sha512`  | Prevents corrupted or stale artifact uploads   |
| YAML references `.zip`                      | electron-updater downloads ZIP (not DMG)       |
| DMG present (informational)                 | Manual install artifact                        |
| `publish.provider: github`                  | Required for GitHub provider                   |

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

---

## Windows Release Distribution

CrossPDF Studio distributes Windows builds via GitHub Releases. Builds are
**unsigned** — no Authenticode code-signing certificate available.

### Build Windows installer

```bash
pnpm package:win
```

Builds the TypeScript + Vite production bundle, then packages an NSIS installer.

With `artifactName: CrossPDF-Studio-Setup-${version}.${ext}` in
`electron-builder.yml`, the filename matches `latest.yml` automatically —
no space-vs-hyphen mismatch.

Output in `release/`:

```
release/
  ├── CrossPDF-Studio-Setup-0.1.0.exe          ← NSIS installer
  ├── CrossPDF-Studio-Setup-0.1.0.exe.blockmap  ← delta update blockmap
  └── latest.yml                                  ← electron-updater metadata
```

### Prepare artifacts and regenerate metadata

```bash
bash scripts/prepare-release-artifacts.sh release
```

Removes stale artifacts, regenerates both `latest.yml` (Windows) and
`latest-mac.yml` (macOS) with fresh sha512/size computed from actual files.

### Verify Windows metadata

```bash
bash scripts/verify-windows-metadata.sh release
```

Checks:

- `latest.yml` exists
- Version matches `package.json`
- `files[].url` points to existing `.exe` with correct size and sha512
- `.exe.blockmap` exists (required for delta updates)
- No stale/unreferenced `.exe` artifacts
- `publish.provider: github` and owner/repo are set

### Publish to GitHub

```bash
gh release upload vX.Y.Z \
  "release/CrossPDF-Studio-Setup-X.Y.Z.exe" \
  "release/CrossPDF-Studio-Setup-X.Y.Z.exe.blockmap" \
  "release/latest.yml" \
  --repo terlanjurkeren9/crosspdf-studio
```

### SmartScreen warning (expected)

Windows SmartScreen will warn users about unsigned software downloaded
from the internet. Users must:

1. Click "More info" on the SmartScreen dialog
2. Click "Run anyway"
3. The installer proceeds normally

This appears on every new version download. Resolved only with an
Authenticode (Extended Validation) code-signing certificate.

### Auto-update with unsigned Windows builds

`electron-updater` can download and apply updates without signature
verification on Windows. The flow works end-to-end even unsigned:

```
Help → Check for Updates
  → GitHub API → latest.yml → version comparison
  → Download EXE asset
  → "Update downloaded. Restart to install."
  → Quit & Install → relaunches with new version
```

---

## QPDF Platform Status

QPDF is used for PDF security operations: encrypt, decrypt, and structural
validation.

| Platform    | Binary location               | Status                                    |
| ----------- | ----------------------------- | ----------------------------------------- |
| macOS arm64 | `resources/darwin-arm64/qpdf` | ✅ Bundled. Working.                      |
| macOS x64   | `resources/darwin-x64/qpdf`   | ⚠️ Not bundled (no binary available).     |
| Windows x64 | `resources/win-x64/qpdf.exe`  | ⚠️ Not bundled (binary not yet obtained). |
| Linux       | N/A                           | ⚠️ Not a packaging target.                |

### Windows QPDF behavior

When `resources/win-x64/qpdf.exe` is not bundled, the app fails clearly:

> `QPDF binary not found at resources/win-x64/qpdf.exe`

Surfaced via `checkQpdfAvailable()` in `src/main/services/qpdf.service.ts`.
No silent failure.

### Bundling QPDF for Windows

When QPDF Windows binaries are obtained from official releases:

1. Place `qpdf.exe`, `libqpdf-30.dll`, `libcrypto-3-x64.dll`, `libjpeg-62.dll`
   in `resources/win-x64/`
2. Uncomment the `extraResources` block under `win:` in `electron-builder.yml`
3. Rebuild with `pnpm package:win`

Use only official qpdf releases (`https://github.com/qpdf/qpdf/releases`).
