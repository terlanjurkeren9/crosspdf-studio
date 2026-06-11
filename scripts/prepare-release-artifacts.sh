#!/bin/bash
# prepare-release-artifacts.sh — Normalize electron-builder macOS output
# so all filenames referenced by latest-mac.yml actually exist, and stale
# artifacts from older versions are removed.
#
# Problem: electron-builder generates filenames with spaces
#   ("CrossPDF Studio-0.1.0-arm64-mac.zip") but latest-mac.yml references
#   hyphenated names ("CrossPDF-Studio-0.1.0-arm64-mac.zip").  Old builds
#   leave hyphen-named copies that accidentally pass verification.
#
# This script:
#   1. Removes stale artifacts from other versions.
#   2. Copies space-named files to the hyphenated names referenced by YAML.
#   3. Regenerates latest-mac.yml with correct sha512 and size.
#
# Usage:
#   bash scripts/prepare-release-artifacts.sh [release-dir]

set -euo pipefail

RELEASE_DIR="${1:-release}"

LATEST_MAC="$RELEASE_DIR/latest-mac.yml"

echo "=== Prepare Release Artifacts ==="
echo "Release dir: $RELEASE_DIR"
echo

# ── 0. Read version from package.json ─────────────────────────────
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null)
if [ -z "$PKG_VERSION" ] || [ "$PKG_VERSION" = "undefined" ]; then
  echo "ERROR: Cannot read version from package.json"
  exit 1
fi
echo "Package version: $PKG_VERSION"
echo

# ── 1. Remove stale artifacts from other versions ─────────────────
echo "--- Removing stale version artifacts ---"
CLEANED=0
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  # Keep files that match current version
  if echo "$fname" | grep -q "$PKG_VERSION"; then
    continue
  fi
  # Also keep files that are not versioned (e.g., latest-mac.yml, blockmap, etc.)
  case "$fname" in
    latest-*.yml|builder-*.yml|builder-*.yaml) continue ;;
  esac
  echo "  Removing stale: $fname"
  rm "$f"
  CLEANED=$((CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( -name "*.dmg" -o -name "*.dmg.blockmap" -o -name "*-mac.zip" -o -name "*-mac.zip.blockmap" -o -name "*-win.zip" -o -name "*-win.zip.blockmap" \) -print0 2>/dev/null)

# Remove stale hyphen-named copies of current version (will be recreated)
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  echo "  Removing stale hyphen copy: $fname"
  rm "$f"
  CLEANED=$((CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( -name "CrossPDF-Studio-${PKG_VERSION}*.zip" -o -name "CrossPDF-Studio-${PKG_VERSION}*.dmg" \) -print0 2>/dev/null)


if [ "$CLEANED" -eq 0 ]; then
  echo "  No stale artifacts found."
fi
echo

# ── 2. Collect actual electron-builder artifacts ──────────────────
echo "--- Collecting electron-builder artifacts ---"
ARM64_ZIP=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-*-arm64-mac.zip" ! -name "*.blockmap" 2>/dev/null | head -1)
ARM64_DMG=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-*-arm64.dmg" ! -name "*.blockmap" 2>/dev/null | head -1)
X64_ZIP=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-${PKG_VERSION}-mac.zip" ! -name "*.blockmap" 2>/dev/null | head -1)
X64_DMG=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-${PKG_VERSION}.dmg" ! -name "*.blockmap" 2>/dev/null | head -1)

if [ -z "$ARM64_ZIP" ]; then
  echo "ERROR: No arm64 macOS ZIP found in $RELEASE_DIR"
  echo "  Expected: CrossPDF Studio-*-arm64-mac.zip"
  exit 1
fi
echo "  ARM64 ZIP: $(basename "$ARM64_ZIP")"
if [ -n "$ARM64_DMG" ]; then
  echo "  ARM64 DMG: $(basename "$ARM64_DMG")"
else
  echo "  ARM64 DMG: (not found — optional)"
fi
if [ -n "$X64_ZIP" ]; then
  echo "  x64 ZIP:   $(basename "$X64_ZIP")"
fi
if [ -n "$X64_DMG" ]; then
  echo "  x64 DMG:   $(basename "$X64_DMG")"
fi
echo

# ── 3. Create hyphen-named copies for YAML references ─────────────
echo "--- Creating YAML-consistent copies ---"
HYPER_ZIP="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip"
cp "$ARM64_ZIP" "$HYPER_ZIP"
echo "  Created: $(basename "$HYPER_ZIP")"

HYPER_DMG=""
if [ -n "$ARM64_DMG" ]; then
  HYPER_DMG="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-arm64.dmg"
  cp "$ARM64_DMG" "$HYPER_DMG"
  echo "  Created: $(basename "$HYPER_DMG")"
fi

HYPER_X64_ZIP=""
if [ -n "$X64_ZIP" ]; then
  HYPER_X64_ZIP="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-mac.zip"
  cp "$X64_ZIP" "$HYPER_X64_ZIP"
  echo "  Created: $(basename "$HYPER_X64_ZIP")"
fi

HYPER_X64_DMG=""
if [ -n "$X64_DMG" ]; then
  HYPER_X64_DMG="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}.dmg"
  cp "$X64_DMG" "$HYPER_X64_DMG"
  echo "  Created: $(basename "$HYPER_X64_DMG")"
fi
echo

# ── 4. Compute sha512 (base64) and size ──────────────────────────
sha512_b64() {
  local file="$1"
  local hex
  hex=$(shasum -a 512 "$file" | awk '{print $1}')
  echo -n "$hex" | xxd -r -p | base64
}

file_size() {
  stat -f '%z' "$1"
}

echo "--- Generating latest-mac.yml ---"
ZIP_SHA512=$(sha512_b64 "$HYPER_ZIP")
ZIP_SIZE=$(file_size "$HYPER_ZIP")

if [ -n "$HYPER_DMG" ]; then
  DMG_SHA512=$(sha512_b64 "$HYPER_DMG")
  DMG_SIZE=$(file_size "$HYPER_DMG")
fi

if [ -n "$HYPER_X64_ZIP" ]; then
  X64_ZIP_SHA512=$(sha512_b64 "$HYPER_X64_ZIP")
  X64_ZIP_SIZE=$(file_size "$HYPER_X64_ZIP")
fi

if [ -n "$HYPER_X64_DMG" ]; then
  X64_DMG_SHA512=$(sha512_b64 "$HYPER_X64_DMG")
  X64_DMG_SIZE=$(file_size "$HYPER_X64_DMG")
fi

cat > "$LATEST_MAC" <<EOF
version: $PKG_VERSION
files:
  - url: CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip
    sha512: $ZIP_SHA512
    size: $ZIP_SIZE
EOF

if [ -n "$HYPER_DMG" ]; then
  cat >> "$LATEST_MAC" <<EOF
  - url: CrossPDF-Studio-${PKG_VERSION}-arm64.dmg
    sha512: $DMG_SHA512
    size: $DMG_SIZE
EOF
fi

if [ -n "$HYPER_X64_ZIP" ]; then
  cat >> "$LATEST_MAC" <<EOF
  - url: CrossPDF-Studio-${PKG_VERSION}-mac.zip
    sha512: $X64_ZIP_SHA512
    size: $X64_ZIP_SIZE
EOF
fi

if [ -n "$HYPER_X64_DMG" ]; then
  cat >> "$LATEST_MAC" <<EOF
  - url: CrossPDF-Studio-${PKG_VERSION}.dmg
    sha512: $X64_DMG_SHA512
    size: $X64_DMG_SIZE
EOF
fi

cat >> "$LATEST_MAC" <<EOF
path: CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip
sha512: $ZIP_SHA512
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
EOF

echo "  Generated: $LATEST_MAC"
echo "  Content:"
sed 's/^/    /' "$LATEST_MAC"
echo

# ── 5. Remove space-named originals (hyphen copies are canonical) ─
echo "--- Cleaning space-named originals ---"
SPACE_CLEANED=0
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  echo "  Removing space-named: $fname"
  rm "$f"
  SPACE_CLEANED=$((SPACE_CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( -name "CrossPDF Studio-${PKG_VERSION}*.zip" -o -name "CrossPDF Studio-${PKG_VERSION}*.dmg" -o -name "CrossPDF Studio-${PKG_VERSION}*.zip.blockmap" -o -name "CrossPDF Studio-${PKG_VERSION}*.dmg.blockmap" \) -print0 2>/dev/null)
if [ "$SPACE_CLEANED" -eq 0 ]; then
  echo "  No space-named originals to clean."
fi
echo

echo "=== Artifacts ready ==="
