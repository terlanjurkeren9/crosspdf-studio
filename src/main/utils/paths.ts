import { app } from 'electron';
import path from 'node:path';

export function getAppDataPath(): string {
  return path.join(app.getPath('userData'));
}

export function getLogsPath(): string {
  return path.join(app.getPath('logs'));
}

export function getDatabasePath(): string {
  return path.join(getAppDataPath(), 'crosspdf-studio.sqlite');
}

export function getTempPath(): string {
  return path.join(app.getPath('temp'), 'crosspdf-studio');
}
