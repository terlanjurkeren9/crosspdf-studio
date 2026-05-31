// Pre-flight check for macOS signing + notarization credentials.
// Exits with 0 (pass) if all required env vars are set,
// exits with 1 and clear message if anything is missing.

const required = ['CSC_LINK', 'CSC_KEY_PASSWORD', 'APPLE_TEAM_ID'];

const missing = required.filter((key) => !process.env[key]);

if (missing.length > 0) {
  console.error('ERROR: Missing required environment variables for signed macOS build:');
  missing.forEach((key) => console.error(`  - ${key}`));
  console.error('');
  console.error('Doc reference: docs/signing.md');
  console.error('For unsigned local builds use: pnpm package:mac:unsigned');
  process.exit(1);
}

// At least one notarization flow must be available
const appleId = process.env.APPLE_ID;
const applePassword = process.env.APPLE_APP_SPECIFIC_PASSWORD;
const apiKeyId = process.env.APPLE_API_KEY_ID;
const apiIssuerId = process.env.APPLE_API_ISSUER_ID;

const hasAppleIdFlow = appleId && applePassword;
const hasApiKeyFlow = apiKeyId && apiIssuerId;

if (!hasAppleIdFlow && !hasApiKeyFlow) {
  console.error('ERROR: No notarization credentials found. Set either:');
  console.error('');
  console.error('  Apple ID flow:');
  console.error('    APPLE_ID + APPLE_APP_SPECIFIC_PASSWORD');
  console.error('');
  console.error('  App Store Connect API Key flow (recommended):');
  console.error('    APPLE_API_KEY_ID + APPLE_API_ISSUER_ID');
  console.error('');
  console.error('Doc reference: docs/signing.md');
  console.error('For unsigned local builds use: pnpm package:mac:unsigned');
  process.exit(1);
}

console.log('✓ All signing + notarization environment variables present.');

if (process.env.CSC_IDENTITY) {
  console.log(`  CSC_IDENTITY: ${process.env.CSC_IDENTITY} (explicit)`);
} else {
  console.log('  CSC_IDENTITY: not set (auto-discovered from CSC_LINK certificate)');
}
