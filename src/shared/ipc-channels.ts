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

  // Session
  SESSION_SAVE: 'session:save',
  SESSION_LOAD: 'session:load',

  // PDF Validation
  PDF_VALIDATE: 'pdf:validate',

  // PDF Security
  PDF_CHECK_ENCRYPTED: 'pdf:check-encrypted',
  PDF_APPLY_PASSWORD: 'pdf:apply-password',
  PDF_ENCRYPT: 'pdf:encrypt',
  PDF_REMOVE_PASSWORD: 'pdf:remove-password',

  // Export
  EXPORT_SAVE_TEXT: 'export:save-text',

  // Update
  UPDATE_CHECK: 'update:check',
  UPDATE_DOWNLOAD: 'update:download',
  UPDATE_QUIT_AND_INSTALL: 'update:quit-and-install',
  UPDATE_GET_STATE: 'update:get-state',
  UPDATE_STATUS: 'update:status',

  // Digital signature
  PDF_SIGN_DIGITAL: 'pdf:sign-digital',
} as const;
