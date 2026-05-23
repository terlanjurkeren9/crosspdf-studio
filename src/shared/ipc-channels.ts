export const IPC_CHANNELS = {
  // File
  FILE_OPEN_DIALOG: 'file:open-dialog',
  FILE_SAVE_DIALOG: 'file:save-dialog',
  FILE_READ: 'file:read',
  FILE_WRITE_ATOMIC: 'file:write-atomic',

  // Recent documents
  RECENT_GET_ALL: 'recent:get-all',
  RECENT_UPSERT: 'recent:upsert',

  // System
  SYSTEM_GET_PLATFORM: 'system:get-platform',
  SYSTEM_GET_APP_VERSION: 'system:get-app-version',
  SYSTEM_OPEN_EXTERNAL: 'system:open-external',

  // Database
  DB_GET_PREFERENCE: 'db:get-preference',
  DB_SET_PREFERENCE: 'db:set-preference',

  // PDF Security
  PDF_CHECK_ENCRYPTED: 'pdf:check-encrypted',
  PDF_APPLY_PASSWORD: 'pdf:apply-password',
  PDF_REMOVE_PASSWORD: 'pdf:remove-password',

  // Export
  EXPORT_SAVE_TEXT: 'export:save-text',
} as const;
