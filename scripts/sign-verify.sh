#!/bin/bash
# sign-verify.sh — Verify macOS code signing + notarization on a packaged .app
#
# Usage:
#   bash scripts/sign-verify.sh <path-to-app>          # full check (signed expected)
#   bash scripts/sign-verify.sh --unsigned <path-to-app># unsigned check (expect ad-hoc)

set -euo pipefail

UNSIGNED_MODE=false
if [ "${1:-}" = "--unsigned" ]; then
  UNSIGNED_MODE=true
  shift
fi

APP_PATH="${1:-release/mac-arm64/CrossPDF Studio.app}"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: App not found at $APP_PATH"
  echo "Usage: bash scripts/sign-verify.sh [--unsigned] <path-to-app-bundle>"
  exit 1
fi

echo "=== Code Sign Check ==="
echo "App: $APP_PATH"
echo "Mode: $([ "$UNSIGNED_MODE" = true ] && echo 'unsigned (expect ad-hoc)' || echo 'signed (expect Developer ID)')"
echo

ERRORS=0

# 1. Basic signature presence
echo "--- codesign -dvvv ---"
codesign -dvvv "$APP_PATH" 2>&1 || true
echo

# 2. Signature validation
echo "--- codesign --verify --deep --strict ---"
if codesign --verify --deep --strict "$APP_PATH" 2>&1; then
  echo "✓ Signature valid"
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "⚠ Expected unsigned but signature is valid — this is a signed build"
  fi
else
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "✓ Expected: signature verification fails on unsigned build"
  else
    echo "✗ Signature verification failed"
    ERRORS=$((ERRORS + 1))
  fi
fi
echo

# 3. Gatekeeper assessment
echo "--- spctl -a -t exec -vv ---"
if spctl -a -t exec -vv "$APP_PATH" 2>&1; then
  echo "✓ Gatekeeper: accepted"
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "⚠ Expected unsigned but Gatekeeper accepted — this is a signed+notarized build"
  fi
else
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "✓ Expected: Gatekeeper rejects unsigned build"
    echo "  Users must right-click → Open to bypass (documented in release notes)"
  else
    echo "✗ Gatekeeper: rejected"
    ERRORS=$((ERRORS + 1))
  fi
fi
echo

# 4. Notarization stapler check
echo "--- stapler validate ---"
if stapler validate "$APP_PATH" 2>&1; then
  echo "✓ Notarization ticket stapled"
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "⚠ Expected unsigned but notarization ticket found"
  fi
else
  if [ "$UNSIGNED_MODE" = true ]; then
    echo "✓ Expected: no notarization ticket on unsigned build"
  else
    echo "✗ No notarization ticket"
    ERRORS=$((ERRORS + 1))
  fi
fi
echo

# Summary
echo "=== Summary ==="
if [ "$UNSIGNED_MODE" = true ]; then
  echo "✓ Unsigned build verification complete."
  echo "  The app is unsigned. Users will need to bypass Gatekeeper:"
  echo "    1. Right-click (or Control-click) the app → Open"
  echo "    2. Click 'Open' in the security dialog"
  echo "    3. The app will be allowed on subsequent launches"
  echo
  echo "  Auto-update limitation: electron-updater verifies code signatures"
  echo "  on downloaded updates. Unsigned builds cannot complete the full"
  echo "  download → install → relaunch cycle in production."
else
  if [ "$ERRORS" -eq 0 ]; then
    echo "✓ Signed build verification passed."
  else
    echo "✗ $ERRORS check(s) failed."
    exit 1
  fi
fi
