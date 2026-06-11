#!/bin/bash
# verify-windows-metadata.sh — Validate that Windows electron-builder
# artifacts are complete, consistent, and release-ready.
#
# Checks:
#   1. latest.yml exists
#   2. package.json version == latest.yml version
#   3. files[].url .exe exists with correct size + sha512
#   4. .exe.blockmap exists
#   5. No stale/unreferenced .exe artifacts
#   6. publish config (github provider, owner, repo)
#
# Usage:
#   bash scripts/verify-windows-metadata.sh [release-dir]

set -euo pipefail

OUTPUT_DIR="${1:-release}"

echo "=== Windows Update Metadata Verification ==="
echo "Checking: $OUTPUT_DIR"
echo

ERRORS=0

# ── 1. package.json version ───────────────────────────────────────
echo "--- package.json version ---"
PKG_VERSION=$(node -p "require('./package.json').version" 2>/dev/null || echo "")
if [ -z "$PKG_VERSION" ] || [ "$PKG_VERSION" = "undefined" ]; then
  echo "ERROR: Cannot read version from package.json"
  ERRORS=$((ERRORS + 1))
else
  echo "  package.json version: $PKG_VERSION"
fi
echo

# ── 2. latest.yml ─────────────────────────────────────────────────
echo "--- Windows metadata (latest.yml) ---"
LATEST_YML="$OUTPUT_DIR/latest.yml"
if [ ! -f "$LATEST_YML" ]; then
  echo "ERROR: Missing: $LATEST_YML"
  echo "  electron-updater cannot detect Windows updates without this file."
  echo "  Ensure publish.provider is 'github' and the build includes an NSIS target."
  ERRORS=$((ERRORS + 1))
  echo
  echo "=== Summary ==="
  echo "ERROR: $ERRORS issue(s) found. Fix before publishing."
  exit 1
fi

echo "  Found: $LATEST_YML"
echo "  Content:"
sed 's/^/    /' "$LATEST_YML"
echo

# ── 3. Version match ─────────────────────────────────────────────
echo "--- Version consistency ---"
META_VERSION=$(grep '^version:' "$LATEST_YML" | head -1 | awk '{print $2}' | tr -d "'\"")
if [ -z "$META_VERSION" ]; then
  echo "ERROR: Cannot parse version from latest.yml"
  ERRORS=$((ERRORS + 1))
elif [ "$META_VERSION" != "$PKG_VERSION" ]; then
  echo "ERROR: Version mismatch!"
  echo "  package.json:    $PKG_VERSION"
  echo "  latest.yml:      $META_VERSION"
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Versions match ($PKG_VERSION)"
fi
echo

# ── 4. Parse all file URLs from YAML ──────────────────────────────
echo "--- Artifact verification ---"
URLS=()
while IFS= read -r line; do
  url=$(echo "$line" | sed -n 's/.*url:[[:space:]]*//p' | tr -d "'\" " )
  if [ -n "$url" ]; then
    URLS+=("$url")
  fi
done < "$LATEST_YML"

if [ ${#URLS[@]} -eq 0 ]; then
  echo "ERROR: No file URLs found in latest.yml"
  ERRORS=$((ERRORS + 1))
else
  echo "  Found ${#URLS[@]} referenced artifact(s):"
  printf '    - %s\n' "${URLS[@]}"
fi
echo

# ── 5. Validate each artifact: exists, size, sha512 ──────────────
for url in "${URLS[@]}"; do
  FILEPATH="$OUTPUT_DIR/$url"
  echo "  Checking: $url"

  if [ ! -f "$FILEPATH" ]; then
    echo "    ERROR: File not found: $FILEPATH"
    ERRORS=$((ERRORS + 1))
    echo
    continue
  fi

  # Extract expected size and sha512 from YAML for this URL
  EXPECTED_SIZE=""
  EXPECTED_SHA=""
  IN_BLOCK=false
  while IFS= read -r line; do
    if echo "$line" | grep -q "url:.*$url"; then
      IN_BLOCK=true
      continue
    fi
    if [ "$IN_BLOCK" = true ]; then
      if echo "$line" | grep -q '^\s*- url:' || echo "$line" | grep -q '^path:'; then
        break
      fi
      sha=$(echo "$line" | sed -n 's/.*sha512:[[:space:]]*//p' | tr -d "'\" ")
      if [ -n "$sha" ]; then
        EXPECTED_SHA="$sha"
      fi
      sz=$(echo "$line" | sed -n 's/.*size:[[:space:]]*//p' | tr -d "'\" ")
      if [ -n "$sz" ]; then
        EXPECTED_SIZE="$sz"
      fi
    fi
  done < "$LATEST_YML"

  ACTUAL_SIZE=$(stat -f '%z' "$FILEPATH" 2>/dev/null || stat -c '%s' "$FILEPATH" 2>/dev/null || echo "0")
  if [ -n "$EXPECTED_SIZE" ] && [ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]; then
    echo "    ERROR: Size mismatch!"
    echo "      Expected: $EXPECTED_SIZE bytes"
    echo "      Actual:   $ACTUAL_SIZE bytes"
    ERRORS=$((ERRORS + 1))
  elif [ -n "$EXPECTED_SIZE" ]; then
    echo "    OK: Size matches ($ACTUAL_SIZE bytes)"
  else
    echo "    WARN: No size field in YAML for this artifact"
  fi

  if [ -n "$EXPECTED_SHA" ]; then
    ACTUAL_HEX=$(shasum -a 512 "$FILEPATH" | awk '{print $1}')
    ACTUAL_SHA=$(echo -n "$ACTUAL_HEX" | xxd -r -p | base64)
    if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
      echo "    ERROR: SHA512 mismatch!"
      echo "      Expected: $EXPECTED_SHA"
      echo "      Actual:   $ACTUAL_SHA"
      ERRORS=$((ERRORS + 1))
    else
      echo "    OK: SHA512 matches"
    fi
  else
    echo "    WARN: No sha512 field in YAML for this artifact"
  fi
  echo
done

# ── 6. Blockmap check ─────────────────────────────────────────────
echo "--- Blockmap check ---"
BLOCKMAP_FILE="$OUTPUT_DIR/CrossPDF-Studio-Setup-${PKG_VERSION}.exe.blockmap"
if [ -f "$BLOCKMAP_FILE" ]; then
  echo "  OK: Blockmap exists: $(basename "$BLOCKMAP_FILE")"
else
  echo "  ERROR: Blockmap missing: $BLOCKMAP_FILE"
  echo "    electron-updater uses blockmaps for delta updates."
  ERRORS=$((ERRORS + 1))
fi
echo

# ── 7. Stale artifact detection ───────────────────────────────────
echo "--- Stale artifact detection ---"
STALE_FOUND=false
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  IS_REFERENCED=false
  for url in "${URLS[@]}"; do
    if [ "$fname" = "$url" ]; then
      IS_REFERENCED=true
      break
    fi
  done
  if [ "$IS_REFERENCED" = false ]; then
    echo "  ERROR: Unreferenced artifact: $fname"
    echo "    This file is not referenced in latest.yml."
    ERRORS=$((ERRORS + 1))
    STALE_FOUND=true
  fi
done < <(find "$OUTPUT_DIR" -maxdepth 1 \( -name "*.exe" ! -name "*.blockmap" ! -name "elevate.exe" \) -print0 2>/dev/null)

if [ "$STALE_FOUND" = false ]; then
  echo "  OK: All .exe artifacts are referenced by latest.yml"
else
  echo "  FAIL: Stale/unreferenced .exe artifacts found."
fi
echo

# ── 8. Publish config ────────────────────────────────────────────
echo "--- Publish config ---"
if [ -f "electron-builder.yml" ]; then
  if grep -q 'provider: github' electron-builder.yml 2>/dev/null; then
    echo "  OK: Publish provider: github"
  else
    echo "  ERROR: Publish provider not set to github in electron-builder.yml"
    ERRORS=$((ERRORS + 1))
  fi

  OWNER=$(grep 'owner:' electron-builder.yml 2>/dev/null | awk '{print $2}' | tr -d '":')
  REPO=$(grep 'repo:' electron-builder.yml 2>/dev/null | awk '{print $2}' | tr -d '":')
  if [ -n "$OWNER" ] && [ -n "$REPO" ]; then
    echo "  OK: owner/repo: $OWNER/$REPO"
  else
    echo "  ERROR: owner/repo not set in electron-builder.yml publish config"
    ERRORS=$((ERRORS + 1))
  fi
else
  echo "  WARN: electron-builder.yml not found (publish config not verified)"
fi
echo

# ── Summary ──────────────────────────────────────────────────────
echo "=== Summary ==="
if [ "$ERRORS" -eq 0 ]; then
  echo "All Windows update metadata checks passed."
  echo "  Artifacts are release-ready for GitHub Release upload."
else
  echo "ERROR: $ERRORS issue(s) found. Fix before publishing."
  exit 1
fi
