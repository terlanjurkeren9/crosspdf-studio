#!/bin/bash
# release-smoke-test.sh — Manual smoke test for verifying auto-update end-to-end.
#
# This script documents and partially automates the flow for testing
# electron-updater from an old installed version to a new release.
#
# Prerequisites:
#   - A GitHub Release exists with version X (e.g. v0.1.0)
#   - A newer GitHub Release exists with version Y (e.g. v0.2.0)
#   - Both releases have latest-mac.yml and ZIP assets
#   - The app is built as signed+notarized for production update verification
#
# Usage:
#   bash scripts/release-smoke-test.sh [old-version] [new-version]
#
# Example:
#   bash scripts/release-smoke-test.sh 0.1.0 0.2.0

set -euo pipefail

OLD_VERSION="${1:-}"
NEW_VERSION="${2:-}"

echo "=== Auto-Update Smoke Test ==="
echo

# Step 0: Validate inputs
if [ -z "$OLD_VERSION" ] || [ -z "$NEW_VERSION" ]; then
  echo "Usage: bash scripts/release-smoke-test.sh <old-version> <new-version>"
  echo
  echo "Example:"
  echo "  bash scripts/release-smoke-test.sh 0.1.0 0.2.0"
  echo
  echo "This script guides you through verifying the auto-update flow:"
  echo "  1. Install the old version (packaged app)"
  echo "  2. Verify the GitHub Release for the new version exists"
  echo "  3. Launch the old version and trigger update check"
  echo "  4. Verify update is detected, downloaded, and installable"
  exit 1
fi

echo "Old version: $OLD_VERSION"
echo "New version: $NEW_VERSION"
echo

# Step 1: Check GitHub Release exists
REPO="terlanjurkeren9/crosspdf-studio"
RELEASE_URL="https://github.com/$REPO/releases/tag/v$NEW_VERSION"

echo "--- Step 1: Check GitHub Release ---"
echo "Release URL: $RELEASE_URL"
echo
echo "MANUAL: Open the URL above in a browser and verify:"
echo "  [ ] Release tag is v$NEW_VERSION"
echo "  [ ] latest-mac.yml asset exists"
echo "  [ ] .zip asset exists (not just .dmg)"
echo "  [ ] .zip filename contains the version number"
echo

# Step 2: Verify metadata via API
echo "--- Step 2: Verify release metadata via GitHub API ---"
echo "Run this command to check release assets:"
echo
echo "  gh release view v$NEW_VERSION --repo $REPO --json assets --jq '.assets[].name'"
echo
echo "Expected assets (minimum):"
echo "  - latest-mac.yml"
echo "  - CrossPDF-Studio-$NEW_VERSION-arm64-mac.zip"
echo "  - CrossPDF-Studio-$NEW_VERSION-x64-mac.zip  (if x64 target enabled)"
echo

# Step 3: Install old version
echo "--- Step 3: Install old version ---"
echo "MANUAL: Install the old version:"
echo
echo "  # If you have the old .dmg:"
echo "  hdiutil attach release/CrossPDF-Studio-$OLD_VERSION-arm64.dmg"
echo "  cp -R '/Volumes/CrossPDF Studio/CrossPDF Studio.app' /Applications/"
echo "  hdiutil detach '/Volumes/CrossPDF Studio'"
echo
echo "  # Or use the old ZIP:"
echo "  unzip -o release/CrossPDF-Studio-$OLD_VERSION-arm64-mac.zip -d /tmp/crosspdf-old"
echo

# Step 4: Launch and check
echo "--- Step 4: Launch old version and check for update ---"
echo "MANUAL:"
echo "  1. Launch CrossPDF Studio from /Applications (or the extracted location)"
echo "  2. Go to Help → Check for Updates"
echo "  3. Expected behavior:"
echo "     [ ] Toast shows 'Update available: v$NEW_VERSION'"
echo "     [ ] Click 'Download' (or trigger downloadUpdate via DevTools)"
echo "     [ ] Toast shows download progress"
echo "     [ ] Toast shows 'Update downloaded. Restart to install.'"
echo "     [ ] Click 'Install & Restart' → app quits and relaunches with new version"
echo "  4. After restart, verify:"
echo "     [ ] Help → About shows version $NEW_VERSION"
echo "     [ ] Help → Check for Updates shows 'You're up to date.'"
echo

# Step 5: DevTools inspection
echo "--- Step 5: DevTools console verification ---"
echo "Open DevTools (View → Toggle Dev Tools) in the old version and run:"
echo
cat <<'JSEOF'
  // Check current update state
  window.crosspdf.getUpdateState().then(s => console.log('State:', s));

  // Trigger manual check
  window.crosspdf.checkForUpdates().then(s => console.log('Check result:', s));

  // Subscribe to status changes
  window.crosspdf.onUpdateStatus(s => console.log('Status push:', s));
JSEOF
echo

# Step 6: Log inspection
echo "--- Step 6: Electron log inspection ---"
echo "Check logs for updater entries:"
echo
echo "  # macOS:"
echo "  cat ~/Library/Logs/CrossPDF\\ Studio/main.log | grep updater"
echo
echo "  Expected entries:"
echo "    updater: initializing"
echo "    updater: checking for update"
echo "    updater: update available"
echo "    updater: download progress"
echo "    updater: update downloaded"
echo "    updater: quit and install requested"
echo

echo "=== Smoke test steps documented ==="
echo "Follow the manual steps above to verify the full auto-update flow."
