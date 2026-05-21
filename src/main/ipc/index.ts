import { registerFileHandlers } from './file.handler';
import { registerSystemHandlers } from './system.handler';
import { registerDatabaseHandlers } from './database.handler';

export function registerIpcHandlers(): void {
  registerFileHandlers();
  registerSystemHandlers();
  registerDatabaseHandlers();
}
