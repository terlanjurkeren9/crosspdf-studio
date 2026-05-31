#!/bin/bash
# sign-verify.sh — Verify macOS code signing + notarization on a packaged .app
# Usage: bash scripts/sign-verify.sh release/mac-arm64/CrossPDF Studio.app

set -euo pipefail

APP_PATH="${1:-release/mac-arm64/CrossPDF Studio.app}"

if [ ! -d "$APP_PATH" ]; then
  echo "ERROR: App not found at $APP_PATH"
  echo "Usage: bash scripts/sign-verify.sh <path-to-app-bundle>"
  exit 1
fi

echo "=== Code Sign Check ==="
echo "Checking signatures on: $APP_PATH"
echo

# 1. Basic signature presence
echo "--- codesign -dvvv ---"
codesign -dvvv "$APP_PATH" 2>&1 || echo "(expected for unsigned builds)"
echo

# 2. Signature validation (fails on unsigned)
echo "--- codesign --verify --deep --strict ---"
if codesign --verify --deep --strict "$APP_PATH" 2>&1; then
  echo "✓ Signature valid"
else
  echo "✗ Signature verification failed (may be unsigned — see CSC_IDENTITY setup)"
fi
echo

# 3. Gatekeeper assessment
echo "--- spctl -a -t exec -vv ---"
if spctl -a -t exec -vv "$APP_PATH" 2>&1; then
  echo "✓ Gatekeeper: accepted"
else
  echo "✗ Gatekeeper: rejected (expected for unsigned/unnotarized builds)"
fi
echo

# 4. Notarization stapler check
echo "--- stapler validate ---"
if stapler validate "$APP_PATH" 2>&1; then
  echo "✓ Notarization ticket stapled"
else
  echo "✗ No notarization ticket (expected when notarization skipped)"
fi

echo
echo "=== Verification complete ==="
