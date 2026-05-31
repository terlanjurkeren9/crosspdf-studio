import { registerFileHandlers } from './file.handler';
import { registerSystemHandlers } from './system.handler';
import { registerDatabaseHandlers } from './database.handler';
import { registerSecurityHandlers } from './security.handler';
import { registerExportHandlers } from './export.handler';
import { registerUpdaterHandlers } from './updater.handler';

export function registerIpcHandlers(): void {
  registerFileHandlers();
  registerSystemHandlers();
  registerDatabaseHandlers();
  registerSecurityHandlers();
  registerExportHandlers();
  registerUpdaterHandlers();
}
