#!/bin/bash
# prepare-release-artifacts.sh — Normalize electron-builder output for
# macOS and Windows, regenerate update metadata YAML files with correct
# sha512 hashes and file sizes, and remove stale artifacts.
#
# macOS:
#   electron-builder.yml uses productName "CrossPDF Studio" (space).
#   Without artifactName, DMG/ZIP filenames contain spaces but
#   latest-mac.yml references hyphenated names.  This script creates
#   hyphen-named copies and regenerates latest-mac.yml.
#
# Windows:
#   artifactName is set to CrossPDF-Studio-Setup-${version}.${ext}
#   so the .exe filename matches latest.yml automatically.  This
#   script regenerates latest.yml with fresh sha512/size.
#
# Usage:
#   bash scripts/prepare-release-artifacts.sh [release-dir]

set -euo pipefail

RELEASE_DIR="${1:-release}"

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
  if echo "$fname" | grep -q "$PKG_VERSION"; then
    continue
  fi
  case "$fname" in
    latest-*.yml|builder-*.yml|builder-*.yaml) continue ;;
  esac
  echo "  Removing stale: $fname"
  rm "$f"
  CLEANED=$((CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( \
  -name "*.dmg" -o -name "*.dmg.blockmap" \
  -o -name "*-mac.zip" -o -name "*-mac.zip.blockmap" \
  -o -name "*-Setup.exe" -o -name "*-Setup.exe.blockmap" \
  -o -name "*-Setup-*.exe" -o -name "*-Setup-*.exe.blockmap" \
  \) -print0 2>/dev/null)

# Remove stale hyphen-named macOS copies of current version
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  echo "  Removing stale copy: $fname"
  rm "$f"
  CLEANED=$((CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( \
  -name "CrossPDF-Studio-${PKG_VERSION}*.zip" \
  -o -name "CrossPDF-Studio-${PKG_VERSION}*.dmg" \
  \) -print0 2>/dev/null)

# Remove stale space-named Windows artifacts (pre-artifactName builds)
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  echo "  Removing stale space-named: $fname"
  rm "$f"
  CLEANED=$((CLEANED + 1))
done < <(find "$RELEASE_DIR" -maxdepth 1 \( \
  -name "CrossPDF Studio Setup ${PKG_VERSION}.exe" \
  -o -name "CrossPDF Studio Setup ${PKG_VERSION}.exe.blockmap" \
  \) -print0 2>/dev/null)

if [ "$CLEANED" -eq 0 ]; then
  echo "  No stale artifacts found."
fi
echo

# ── Helpers ───────────────────────────────────────────────────────
sha512_b64() {
  local file="$1"
  local hex
  hex=$(shasum -a 512 "$file" | awk '{print $1}')
  echo -n "$hex" | xxd -r -p | base64
}

file_size() {
  stat -f '%z' "$1"
}

# ── 2. macOS artifacts ────────────────────────────────────────────
echo "--- macOS artifacts ---"
ARM64_ZIP=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-*-arm64-mac.zip" ! -name "*.blockmap" 2>/dev/null | head -1)
ARM64_DMG=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-*-arm64.dmg" ! -name "*.blockmap" 2>/dev/null | head -1)
X64_ZIP=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-${PKG_VERSION}-mac.zip" ! -name "*.blockmap" 2>/dev/null | head -1)
X64_DMG=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF Studio-${PKG_VERSION}.dmg" ! -name "*.blockmap" 2>/dev/null | head -1)

HAS_MAC=false
if [ -n "$ARM64_ZIP" ]; then
  HAS_MAC=true
fi

if [ "$HAS_MAC" = true ]; then
  echo "  ARM64 ZIP: $(basename "$ARM64_ZIP")"
  if [ -n "$ARM64_DMG" ]; then echo "  ARM64 DMG: $(basename "$ARM64_DMG")"; fi
  if [ -n "$X64_ZIP" ]; then echo "  x64 ZIP:   $(basename "$X64_ZIP")"; fi
  if [ -n "$X64_DMG" ]; then echo "  x64 DMG:   $(basename "$X64_DMG")"; fi

  # Create hyphen-named copies for YAML references
  echo "  Creating YAML-consistent copies..."
  HYPER_ZIP="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip"
  cp "$ARM64_ZIP" "$HYPER_ZIP"
  echo "    Created: $(basename "$HYPER_ZIP")"

  HYPER_DMG=""
  if [ -n "$ARM64_DMG" ]; then
    HYPER_DMG="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-arm64.dmg"
    cp "$ARM64_DMG" "$HYPER_DMG"
    echo "    Created: $(basename "$HYPER_DMG")"
  fi

  HYPER_X64_ZIP=""
  if [ -n "$X64_ZIP" ]; then
    HYPER_X64_ZIP="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}-mac.zip"
    cp "$X64_ZIP" "$HYPER_X64_ZIP"
    echo "    Created: $(basename "$HYPER_X64_ZIP")"
  fi

  HYPER_X64_DMG=""
  if [ -n "$X64_DMG" ]; then
    HYPER_X64_DMG="$RELEASE_DIR/CrossPDF-Studio-${PKG_VERSION}.dmg"
    cp "$X64_DMG" "$HYPER_X64_DMG"
    echo "    Created: $(basename "$HYPER_X64_DMG")"
  fi

  # Generate latest-mac.yml
  ZIP_SHA512=$(sha512_b64 "$HYPER_ZIP")
  ZIP_SIZE=$(file_size "$HYPER_ZIP")

  LATEST_MAC="$RELEASE_DIR/latest-mac.yml"

  cat > "$LATEST_MAC" <<YEOF
version: $PKG_VERSION
files:
  - url: CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip
    sha512: $ZIP_SHA512
    size: $ZIP_SIZE
YEOF

  if [ -n "$HYPER_DMG" ]; then
    DMG_SHA512=$(sha512_b64 "$HYPER_DMG")
    DMG_SIZE=$(file_size "$HYPER_DMG")
    cat >> "$LATEST_MAC" <<YEOF
  - url: CrossPDF-Studio-${PKG_VERSION}-arm64.dmg
    sha512: $DMG_SHA512
    size: $DMG_SIZE
YEOF
  fi

  if [ -n "$HYPER_X64_ZIP" ]; then
    X64_ZIP_SHA512=$(sha512_b64 "$HYPER_X64_ZIP")
    X64_ZIP_SIZE=$(file_size "$HYPER_X64_ZIP")
    cat >> "$LATEST_MAC" <<YEOF
  - url: CrossPDF-Studio-${PKG_VERSION}-mac.zip
    sha512: $X64_ZIP_SHA512
    size: $X64_ZIP_SIZE
YEOF
  fi

  if [ -n "$HYPER_X64_DMG" ]; then
    X64_DMG_SHA512=$(sha512_b64 "$HYPER_X64_DMG")
    X64_DMG_SIZE=$(file_size "$HYPER_X64_DMG")
    cat >> "$LATEST_MAC" <<YEOF
  - url: CrossPDF-Studio-${PKG_VERSION}.dmg
    sha512: $X64_DMG_SHA512
    size: $X64_DMG_SIZE
YEOF
  fi

  cat >> "$LATEST_MAC" <<YEOF
path: CrossPDF-Studio-${PKG_VERSION}-arm64-mac.zip
sha512: $ZIP_SHA512
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
YEOF

  echo "  Generated: latest-mac.yml"

  # Clean space-named originals
  SPACE_CLEANED=0
  while IFS= read -r -d '' f; do
    [ -f "$f" ] || continue
    fname=$(basename "$f")
    echo "  Removing space-named: $fname"
    rm "$f"
    SPACE_CLEANED=$((SPACE_CLEANED + 1))
  done < <(find "$RELEASE_DIR" -maxdepth 1 \( \
    -name "CrossPDF Studio-${PKG_VERSION}*.zip" \
    -o -name "CrossPDF Studio-${PKG_VERSION}*.dmg" \
    -o -name "CrossPDF Studio-${PKG_VERSION}*.zip.blockmap" \
    -o -name "CrossPDF Studio-${PKG_VERSION}*.dmg.blockmap" \
    \) -print0 2>/dev/null)
  if [ "$SPACE_CLEANED" -eq 0 ]; then
    echo "  No space-named originals to clean."
  fi
else
  echo "  No macOS artifacts found (skipping)."
fi
echo

# ── 3. Windows artifacts ──────────────────────────────────────────
echo "--- Windows artifacts ---"
WIN_EXE=$(find "$RELEASE_DIR" -maxdepth 1 -name "CrossPDF-Studio-Setup-${PKG_VERSION}.exe" ! -name "*.blockmap" 2>/dev/null | head -1)

if [ -n "$WIN_EXE" ]; then
  echo "  EXE: $(basename "$WIN_EXE")"

  EXE_SHA512=$(sha512_b64 "$WIN_EXE")
  EXE_SIZE=$(file_size "$WIN_EXE")

  LATEST_YML="$RELEASE_DIR/latest.yml"

  cat > "$LATEST_YML" <<YEOF
version: $PKG_VERSION
files:
  - url: CrossPDF-Studio-Setup-${PKG_VERSION}.exe
    sha512: $EXE_SHA512
    size: $EXE_SIZE
path: CrossPDF-Studio-Setup-${PKG_VERSION}.exe
sha512: $EXE_SHA512
releaseDate: '$(date -u +%Y-%m-%dT%H:%M:%S.000Z)'
YEOF

  echo "  Generated: latest.yml"
  echo "  Content:"
  sed 's/^/    /' "$LATEST_YML"
else
  echo "  No Windows artifacts found (skipping)."
fi
echo

echo "=== Artifacts ready ==="
