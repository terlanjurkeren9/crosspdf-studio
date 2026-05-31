import { app } from 'electron';
import { autoUpdater } from 'electron-updater';
import type { UpdateInfo, ProgressInfo } from 'electron-updater';
import { log } from '../utils/logger';
import type { UpdateState } from '../../shared/types/ipc.types';

type StateListener = (state: UpdateState) => void;

let currentState: UpdateState = { status: 'idle' };
const listeners: StateListener[] = [];
let initialized = false;

function setState(patch: Partial<UpdateState>): void {
  currentState = { ...currentState, ...patch };
  for (const listener of listeners) {
    try {
      listener(currentState);
    } catch {
      // listener error should not break update flow
    }
  }
}

export function getState(): UpdateState {
  return { ...currentState };
}

export function onStatusChange(callback: StateListener): () => void {
  listeners.push(callback);
  return () => {
    const idx = listeners.indexOf(callback);
    if (idx !== -1) listeners.splice(idx, 1);
  };
}

export async function checkForUpdates(): Promise<UpdateState> {
  if (!initialized) {
    log.warn('updater: checkForUpdates called but updater not initialized');
    return getState();
  }

  try {
    setState({ status: 'checking', error: undefined });
    await autoUpdater.checkForUpdates();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('updater: checkForUpdates failed', { error: message });
    setState({ status: 'error', error: message });
  }

  return getState();
}

export async function downloadUpdate(): Promise<UpdateState> {
  if (!initialized) {
    log.warn('updater: downloadUpdate called but updater not initialized');
    return getState();
  }

  if (currentState.status !== 'available') {
    log.warn('updater: downloadUpdate called but update not available', {
      status: currentState.status,
    });
    return getState();
  }

  try {
    setState({ status: 'downloading', error: undefined });
    await autoUpdater.downloadUpdate();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error('updater: downloadUpdate failed', { error: message });
    setState({ status: 'error', error: message });
  }

  return getState();
}

export function quitAndInstall(): void {
  if (!initialized) {
    log.warn('updater: quitAndInstall called but updater not initialized');
    return;
  }

  if (currentState.status !== 'downloaded') {
    log.warn('updater: quitAndInstall called but update not downloaded', {
      status: currentState.status,
    });
    return;
  }

  log.info('updater: quit and install requested');
  autoUpdater.quitAndInstall(false, true);
}

export function initialize(): void {
  const isDev = !app.isPackaged;
  const isE2E = !!process.env.CROSSPDF_E2E;

  if (isDev || isE2E) {
    log.info('updater: skipped (dev or E2E mode)', { isDev, isE2E });
    return;
  }

  log.info('updater: initializing');

  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;

  autoUpdater.on('checking-for-update', () => {
    log.info('updater: checking for update');
    setState({ status: 'checking', error: undefined });
  });

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    log.info('updater: update available', { version: info.version });
    setState({ status: 'available', version: info.version, error: undefined });
  });

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    log.info('updater: no update available', { version: info.version });
    setState({ status: 'not-available', version: info.version, error: undefined });
  });

  autoUpdater.on('error', (err: Error) => {
    log.error('updater: error', { error: err.message });
    setState({ status: 'error', error: err.message });
  });

  autoUpdater.on('download-progress', (progress: ProgressInfo) => {
    log.info('updater: download progress', { percent: progress.percent });
    setState({
      status: 'downloading',
      progress: {
        percent: progress.percent,
        transferred: progress.transferred,
        total: progress.total,
      },
    });
  });

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    log.info('updater: update downloaded', { version: info.version });
    setState({
      status: 'downloaded',
      version: info.version,
      progress: undefined,
      error: undefined,
    });
  });

  initialized = true;
  log.info('updater: initialized');

  // Initial check on startup (non-blocking)
  autoUpdater.checkForUpdates().catch((err: unknown) => {
    log.warn('updater: initial check failed (expected in dev/unsigned)', {
      error: err instanceof Error ? err.message : String(err),
    });
  });
}
