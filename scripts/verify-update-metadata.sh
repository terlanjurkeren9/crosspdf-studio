#!/bin/bash
# verify-update-metadata.sh — Validate that electron-builder artifacts
# are complete, consistent, and release-ready.
#
# Checks:
#   1. latest-mac.yml exists and is parseable
#   2. package.json version == latest-mac.yml version (fail on mismatch)
#   3. Every files[].url referenced in YAML exists as an exact filename
#   4. Each artifact's file size matches YAML size
#   5. Each artifact's sha512 matches YAML sha512
#   6. ZIP is referenced (required for electron-updater)
#   7. No stale artifacts are the only reason checks pass
#   8. publish config in electron-builder.yml is valid
#
# Usage:
#   bash scripts/verify-update-metadata.sh [release-dir]
#
# Defaults to: release/

set -euo pipefail

OUTPUT_DIR="${1:-release}"

echo "=== Update Metadata Verification ==="
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

# ── 2. latest-mac.yml ────────────────────────────────────────────
echo "--- macOS metadata (latest-mac.yml) ---"
LATEST_MAC="$OUTPUT_DIR/latest-mac.yml"
if [ ! -f "$LATEST_MAC" ]; then
  echo "ERROR: Missing: $LATEST_MAC"
  echo "  electron-updater cannot detect updates without this file."
  echo "  Cause: publish.provider must be 'github' and the build must"
  echo "  complete a non-directory target (dmg or zip)."
  echo "  Run: pnpm package:mac:release"
  ERRORS=$((ERRORS + 1))
  echo
  echo "=== Summary ==="
  echo "ERROR: $ERRORS issue(s) found. Fix before publishing."
  exit 1
fi

echo "  Found: $LATEST_MAC"
echo "  Content:"
sed 's/^/    /' "$LATEST_MAC"
echo

# ── 3. Version match ─────────────────────────────────────────────
echo "--- Version consistency ---"
META_VERSION=$(grep '^version:' "$LATEST_MAC" | head -1 | awk '{print $2}' | tr -d "'\"")
if [ -z "$META_VERSION" ]; then
  echo "ERROR: Cannot parse version from latest-mac.yml"
  ERRORS=$((ERRORS + 1))
elif [ "$META_VERSION" != "$PKG_VERSION" ]; then
  echo "ERROR: Version mismatch!"
  echo "  package.json:    $PKG_VERSION"
  echo "  latest-mac.yml:  $META_VERSION"
  echo "  Fix: Rebuild with the current version, or update package.json."
  ERRORS=$((ERRORS + 1))
else
  echo "  OK: Versions match ($PKG_VERSION)"
fi
echo

# ── 4. Parse all file URLs from YAML ─────────────────────────────
echo "--- Artifact verification ---"
URLS=()
while IFS= read -r line; do
  url=$(echo "$line" | sed -n 's/.*url:[[:space:]]*//p' | tr -d "'\" " )
  if [ -n "$url" ]; then
    URLS+=("$url")
  fi
done < "$LATEST_MAC"

if [ ${#URLS[@]} -eq 0 ]; then
  echo "ERROR: No file URLs found in latest-mac.yml"
  ERRORS=$((ERRORS + 1))
else
  echo "  Found ${#URLS[@]} referenced artifact(s):"
  printf '    - %s\n' "${URLS[@]}"
fi
echo

# ── 5. Validate each artifact: exists, size, sha512 ──────────────
HAS_ZIP=false

for url in "${URLS[@]}"; do
  case "$url" in
    *.zip) HAS_ZIP=true ;;
  esac

  FILEPATH="$OUTPUT_DIR/$url"
  echo "  Checking: $url"

  # 5a. File exists
  if [ ! -f "$FILEPATH" ]; then
    # Try space variant
    SPACE_URL=$(echo "$url" | sed 's/CrossPDF-Studio/CrossPDF Studio/g')
    SPACE_PATH="$OUTPUT_DIR/$SPACE_URL"
    if [ -f "$SPACE_PATH" ]; then
      echo "    ERROR: Filename mismatch!"
      echo "      YAML references: $url"
      echo "      Actual file:     $SPACE_URL"
      echo "      Fix: Run 'bash scripts/prepare-release-artifacts.sh $OUTPUT_DIR'"
      echo "      Or: cp \"$SPACE_PATH\" \"$FILEPATH\""
    else
      echo "    ERROR: File not found: $FILEPATH"
      echo "      Neither '$url' nor '$SPACE_URL' exists in $OUTPUT_DIR"
    fi
    ERRORS=$((ERRORS + 1))
    echo
    continue
  fi

  # 5b. Extract expected size and sha512 from YAML for this URL
  #     YAML structure per file entry:
  #       - url: filename
  #         sha512: hash
  #         size: bytes
  EXPECTED_SIZE=""
  EXPECTED_SHA=""
  IN_BLOCK=false
  while IFS= read -r line; do
    if echo "$line" | grep -q "url:.*$url"; then
      IN_BLOCK=true
      continue
    fi
    if [ "$IN_BLOCK" = true ]; then
      # Next url line means end of this block
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
  done < "$LATEST_MAC"

  # 5c. Check size
  ACTUAL_SIZE=$(stat -f '%z' "$FILEPATH" 2>/dev/null || stat -c '%s' "$FILEPATH" 2>/dev/null || echo "0")
  if [ -n "$EXPECTED_SIZE" ] && [ "$ACTUAL_SIZE" != "$EXPECTED_SIZE" ]; then
    echo "    ERROR: Size mismatch!"
    echo "      Expected: $EXPECTED_SIZE bytes"
    echo "      Actual:   $ACTUAL_SIZE bytes"
    echo "      Fix: Run 'bash scripts/prepare-release-artifacts.sh $OUTPUT_DIR'"
    ERRORS=$((ERRORS + 1))
  elif [ -n "$EXPECTED_SIZE" ]; then
    echo "    OK: Size matches ($ACTUAL_SIZE bytes)"
  else
    echo "    WARN: No size field in YAML for this artifact"
  fi

  # 5d. Check sha512
  if [ -n "$EXPECTED_SHA" ]; then
    ACTUAL_HEX=$(shasum -a 512 "$FILEPATH" | awk '{print $1}')
    ACTUAL_SHA=$(echo -n "$ACTUAL_HEX" | xxd -r -p | base64)
    if [ "$ACTUAL_SHA" != "$EXPECTED_SHA" ]; then
      echo "    ERROR: SHA512 mismatch!"
      echo "      Expected: $EXPECTED_SHA"
      echo "      Actual:   $ACTUAL_SHA"
      echo "      Fix: Run 'bash scripts/prepare-release-artifacts.sh $OUTPUT_DIR'"
      ERRORS=$((ERRORS + 1))
    else
      echo "    OK: SHA512 matches"
    fi
  else
    echo "    WARN: No sha512 field in YAML for this artifact"
  fi
  echo
done

# ── 6. ZIP required ──────────────────────────────────────────────
echo "--- ZIP asset check ---"
if [ "$HAS_ZIP" = true ]; then
  echo "  OK: ZIP referenced (required for electron-updater macOS updates)"
else
  echo "  ERROR: No ZIP reference found in latest-mac.yml"
  echo "    electron-updater downloads ZIP for macOS updates."
  echo "    Ensure electron-builder.yml has zip target under mac.target."
  ERRORS=$((ERRORS + 1))
fi
echo

# ── 7. Stale artifact detection ──────────────────────────────────
echo "--- Stale artifact detection ---"
# Check for files matching current version that are NOT referenced by YAML
# and have different content (size) than what YAML expects.
# This catches the case where stale copies accidentally pass existence checks.
STALE_FOUND=false
while IFS= read -r -d '' f; do
  [ -f "$f" ] || continue
  fname=$(basename "$f")
  # Check if this file is referenced in YAML
  IS_REFERENCED=false
  for url in "${URLS[@]}"; do
    if [ "$fname" = "$url" ]; then
      IS_REFERENCED=true
      break
    fi
  done
  if [ "$IS_REFERENCED" = false ]; then
    echo "  ERROR: Unreferenced artifact: $fname"
    echo "    This file is not referenced in latest-mac.yml."
    echo "    Remove it or regenerate metadata."
    STALE_FOUND=true
    ERRORS=$((ERRORS + 1))
  fi
done < <(find "$OUTPUT_DIR" -maxdepth 1 \( -name "*.zip" -o -name "*.dmg" \) ! -name "*.blockmap" ! -name "latest-*" -print0 2>/dev/null)

if [ "$STALE_FOUND" = false ]; then
  echo "  OK: All artifacts are referenced by latest-mac.yml"
else
  echo "  FAIL: Stale/unreferenced artifacts found. Remove before publishing."
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
  echo "All update metadata checks passed."
  echo "  Artifacts are release-ready for GitHub Release upload."
else
  echo "ERROR: $ERRORS issue(s) found. Fix before publishing."
  exit 1
fi
