// macOS notarization afterSign hook for electron-builder
// Supports both Apple ID (APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD) and
// App Store Connect API key (APPLE_API_KEY_ID + APPLE_API_ISSUER_ID) flows.
// When no credentials are set, bails out cleanly with a message.

const path = require('path');
const { notarize } = require('@electron/notarize');

exports.default = async function notarizing(context) {
  const { electronPlatformName, appOutDir } = context;

  if (electronPlatformName !== 'darwin') {
    return;
  }

  const appName = context.packager.appInfo.productFilename;
  const appPath = path.join(appOutDir, `${appName}.app`);

  const appleId = process.env.APPLE_ID;
  const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
  const appleTeamId = process.env.APPLE_TEAM_ID;
  const apiKeyId = process.env.APPLE_API_KEY_ID;
  const apiIssuerId = process.env.APPLE_API_ISSUER_ID;

  if (!appleTeamId) {
    console.log('  • APPLE_TEAM_ID not set — skipping notarization (unsigned build).');
    return;
  }

  const hasAppleIdFlow = appleId && applePassword;
  const hasApiKeyFlow = apiKeyId && apiIssuerId;

  if (!hasAppleIdFlow && !hasApiKeyFlow) {
    console.log('  • No Apple credentials found (set APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD');
    console.log(
      '    or APPLE_API_KEY_ID + APPLE_API_ISSUER_ID) — skipping notarization (unsigned build).'
    );
    return;
  }

  const notarizeOpts = {
    tool: 'notarytool',
    appPath,
    teamId: appleTeamId,
  };

  if (hasApiKeyFlow) {
    notarizeOpts.appleApiKeyId = apiKeyId;
    notarizeOpts.appleApiIssuer = apiIssuerId;
    // Private key path — optional, defaults to ~/.appstoreconnect/private_keys/
    if (process.env.APPLE_API_KEY_PATH) {
      notarizeOpts.appleApiKey = process.env.APPLE_API_KEY_PATH;
    }
  } else {
    notarizeOpts.appleId = appleId;
    notarizeOpts.appleIdPassword = applePassword;
  }

  console.log(`  • Notarizing ${appName}.app — this may take a few minutes…`);

  try {
    await notarize(notarizeOpts);
    console.log('  • Notarization submitted successfully.');
  } catch (err) {
    console.error('  • Notarization failed:', err.message);
    throw err;
  }
};
