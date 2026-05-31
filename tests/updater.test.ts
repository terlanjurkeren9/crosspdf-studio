import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { UpdateState, UpdateStatus, UpdateStatusResult } from '../src/shared/types/ipc.types';
import { sanitizeUpdateState } from '../src/shared/types/ipc.types';
import { IPC_CHANNELS } from '../src/shared/ipc-channels';

// ── IPC channel constants ──────────────────────────────────────

describe('Update IPC channels', () => {
  it('defines all required update channels', () => {
    expect(IPC_CHANNELS.UPDATE_CHECK).toBe('update:check');
    expect(IPC_CHANNELS.UPDATE_DOWNLOAD).toBe('update:download');
    expect(IPC_CHANNELS.UPDATE_QUIT_AND_INSTALL).toBe('update:quit-and-install');
    expect(IPC_CHANNELS.UPDATE_GET_STATE).toBe('update:get-state');
    expect(IPC_CHANNELS.UPDATE_STATUS).toBe('update:status');
  });
});

// ── Update types ───────────────────────────────────────────────

describe('Update types', () => {
  it('UpdateState accepts idle status', () => {
    const state: UpdateState = { status: 'idle' };
    expect(state.status).toBe('idle');
  });

  it('UpdateState accepts checking status', () => {
    const state: UpdateState = { status: 'checking' };
    expect(state.status).toBe('checking');
  });

  it('UpdateState accepts available status with version', () => {
    const state: UpdateState = { status: 'available', version: '1.2.3' };
    expect(state.version).toBe('1.2.3');
  });

  it('UpdateState accepts downloading status with progress', () => {
    const state: UpdateState = {
      status: 'downloading',
      progress: { percent: 45.5, transferred: 1024, total: 2048 },
    };
    expect(state.progress?.percent).toBe(45.5);
  });

  it('UpdateState accepts downloaded status', () => {
    const state: UpdateState = { status: 'downloaded', version: '2.0.0' };
    expect(state.status).toBe('downloaded');
  });

  it('UpdateState accepts error status with message', () => {
    const state: UpdateState = { status: 'error', error: 'Network timeout' };
    expect(state.error).toBe('Network timeout');
  });

  it('UpdateStatusResult wraps UpdateState', () => {
    const result: UpdateStatusResult = { state: { status: 'idle' } };
    expect(result.state.status).toBe('idle');
  });

  it('all valid UpdateStatus values', () => {
    const validStatuses: UpdateStatus[] = [
      'idle',
      'checking',
      'available',
      'not-available',
      'downloading',
      'downloaded',
      'error',
    ];
    for (const status of validStatuses) {
      const state: UpdateState = { status };
      expect(state.status).toBe(status);
    }
  });
});

// ── sanitizeUpdateState ────────────────────────────────────────

describe('sanitizeUpdateState', () => {
  it('passes through a valid idle state', () => {
    const result = sanitizeUpdateState({ status: 'idle' });
    expect(result).toEqual({ status: 'idle' });
  });

  it('passes through a valid downloaded state with version', () => {
    const result = sanitizeUpdateState({ status: 'downloaded', version: '2.0.0' });
    expect(result).toEqual({ status: 'downloaded', version: '2.0.0' });
  });

  it('passes through a valid downloading state with progress', () => {
    const result = sanitizeUpdateState({
      status: 'downloading',
      progress: { percent: 50, transferred: 1024, total: 2048 },
    });
    expect(result.status).toBe('downloading');
    expect(result.progress).toEqual({ percent: 50, transferred: 1024, total: 2048 });
  });

  it('preserves error string on valid error state', () => {
    const result = sanitizeUpdateState({ status: 'error', error: 'timeout' });
    expect(result).toEqual({ status: 'error', error: 'timeout' });
  });

  it('returns error state for null payload', () => {
    const result = sanitizeUpdateState(null);
    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid update state payload');
  });

  it('returns error state for non-object payload', () => {
    const result = sanitizeUpdateState('not-an-object');
    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid update state payload');
  });

  it('returns error state for missing status field', () => {
    const result = sanitizeUpdateState({ version: '1.0.0' });
    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid update status value');
  });

  it('returns error state for invalid status string', () => {
    const result = sanitizeUpdateState({ status: 'bogus' });
    expect(result.status).toBe('error');
    expect(result.error).toBe('Invalid update status value');
  });

  it('drops non-string version', () => {
    const result = sanitizeUpdateState({ status: 'available', version: 42 });
    expect(result).toEqual({ status: 'available' });
  });

  it('drops non-string error', () => {
    const result = sanitizeUpdateState({ status: 'error', error: 123 });
    expect(result).toEqual({ status: 'error' });
  });

  it('drops progress with non-finite percent', () => {
    const result = sanitizeUpdateState({
      status: 'downloading',
      progress: { percent: Infinity, transferred: 0, total: 0 },
    });
    expect(result.progress).toBeUndefined();
  });

  it('drops progress with missing percent', () => {
    const result = sanitizeUpdateState({
      status: 'downloading',
      progress: { transferred: 100, total: 200 },
    });
    expect(result.progress).toBeUndefined();
  });

  it('defaults transferred and total to 0 when missing', () => {
    const result = sanitizeUpdateState({
      status: 'downloading',
      progress: { percent: 25 },
    });
    expect(result.progress).toEqual({ percent: 25, transferred: 0, total: 0 });
  });

  it('ignores extraneous fields', () => {
    const result = sanitizeUpdateState({
      status: 'idle',
      version: '1.0.0',
      extra: 'should be dropped',
      nested: { foo: 'bar' },
    });
    expect(result).toEqual({ status: 'idle', version: '1.0.0' });
  });
});

// ── Updater service guards (mocked) ───────────────────────────

// We mock electron and electron-updater so the service can be imported and
// exercised in a pure Node (vitest) environment with no real network calls.

let autoUpdaterMock: {
  autoDownload: boolean;
  autoInstallOnAppQuit: boolean;
  checkForUpdates: ReturnType<typeof vi.fn>;
  downloadUpdate: ReturnType<typeof vi.fn>;
  quitAndInstall: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  _listeners: Record<string, Array<(...args: unknown[]) => void>>;
  _emit(event: string, ...args: unknown[]): void;
};

function createAutoUpdaterMock() {
  const listeners: Record<string, Array<(...args: unknown[]) => void>> = {};
  const mock = {
    autoDownload: false,
    autoInstallOnAppQuit: false,
    checkForUpdates: vi.fn().mockResolvedValue(undefined),
    downloadUpdate: vi.fn().mockResolvedValue(undefined),
    quitAndInstall: vi.fn(),
    on: vi.fn((event: string, handler: (...args: unknown[]) => void) => {
      if (!listeners[event]) listeners[event] = [];
      listeners[event].push(handler);
      return mock;
    }),
    _listeners: listeners,
    _emit(event: string, ...args: unknown[]) {
      for (const handler of listeners[event] ?? []) {
        handler(...args);
      }
    },
  };
  return mock;
}

vi.mock('electron', () => ({
  app: { isPackaged: true },
}));

vi.mock('electron-log', () => {
  const noop = vi.fn();
  const log = Object.assign(noop, { debug: noop, info: noop, warn: noop, error: noop });
  log.transports = { file: { level: 'info', maxSize: 0 }, console: { level: 'debug' } };
  return { default: log };
});

describe('Updater service guards', () => {
  beforeEach(() => {
    vi.resetModules();
    autoUpdaterMock = createAutoUpdaterMock();
    vi.doMock('electron-updater', () => ({ autoUpdater: autoUpdaterMock }));
  });

  async function initService() {
    const mod = await import('../src/main/services/updater.service');
    mod.initialize();
    return mod;
  }

  // ── quitAndInstall guard ─────────────────────────────────────

  it('quitAndInstall does NOT call autoUpdater when state is idle', async () => {
    const service = await initService();
    service.quitAndInstall();
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
  });

  it('quitAndInstall does NOT call autoUpdater when state is available', async () => {
    const service = await initService();
    autoUpdaterMock._emit('update-available', { version: '1.0.0' });
    service.quitAndInstall();
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
  });

  it('quitAndInstall DOES call autoUpdater when state is downloaded', async () => {
    const service = await initService();
    autoUpdaterMock._emit('update-downloaded', { version: '1.0.0' });
    service.quitAndInstall();
    expect(autoUpdaterMock.quitAndInstall).toHaveBeenCalledWith(false, true);
  });

  it('quitAndInstall does NOT call autoUpdater when updater is not initialized', async () => {
    // Don't call initialize — just import
    vi.doMock('electron', () => ({ app: { isPackaged: true } }));
    const mod = await import('../src/main/services/updater.service');
    // Not initialized, so quitAndInstall should bail
    mod.quitAndInstall();
    expect(autoUpdaterMock.quitAndInstall).not.toHaveBeenCalled();
  });

  // ── downloadUpdate guard ─────────────────────────────────────

  it('downloadUpdate does NOT call autoUpdater when state is idle', async () => {
    const service = await initService();
    await service.downloadUpdate();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  it('downloadUpdate does NOT call autoUpdater when state is downloading', async () => {
    const service = await initService();
    autoUpdaterMock._emit('update-available', { version: '1.0.0' });
    autoUpdaterMock._emit('download-progress', {
      percent: 50,
      transferred: 1024,
      total: 2048,
    });
    // State is now 'downloading' — second downloadUpdate should be blocked
    autoUpdaterMock.downloadUpdate.mockClear();
    await service.downloadUpdate();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
  });

  it('downloadUpdate DOES call autoUpdater when state is available', async () => {
    const service = await initService();
    autoUpdaterMock._emit('update-available', { version: '1.0.0' });
    await service.downloadUpdate();
    expect(autoUpdaterMock.downloadUpdate).toHaveBeenCalled();
  });

  it('downloadUpdate does NOT call autoUpdater when updater is not initialized', async () => {
    vi.doMock('electron', () => ({ app: { isPackaged: true } }));
    const mod = await import('../src/main/services/updater.service');
    const state = await mod.downloadUpdate();
    expect(autoUpdaterMock.downloadUpdate).not.toHaveBeenCalled();
    expect(state.status).toBe('idle');
  });

  // ── dev / E2E mode ───────────────────────────────────────────

  it('initialize skips setup in dev mode (app.isPackaged = false)', async () => {
    vi.doMock('electron', () => ({ app: { isPackaged: false } }));
    const mod = await import('../src/main/services/updater.service');
    mod.initialize();
    // autoUpdater.on should NOT have been called because init was skipped
    expect(autoUpdaterMock.on).not.toHaveBeenCalled();
  });

  it('initialize skips setup in E2E mode', async () => {
    process.env.CROSSPDF_E2E = '1';
    vi.doMock('electron', () => ({ app: { isPackaged: true } }));
    const mod = await import('../src/main/services/updater.service');
    mod.initialize();
    expect(autoUpdaterMock.on).not.toHaveBeenCalled();
    delete process.env.CROSSPDF_E2E;
  });

  // ── state machine ────────────────────────────────────────────

  it('getState returns current state after status transitions', async () => {
    const service = await initService();
    expect(service.getState().status).toBe('idle');

    autoUpdaterMock._emit('checking-for-update');
    expect(service.getState().status).toBe('checking');

    autoUpdaterMock._emit('update-available', { version: '1.2.0' });
    expect(service.getState().status).toBe('available');
    expect(service.getState().version).toBe('1.2.0');

    autoUpdaterMock._emit('update-downloaded', { version: '1.2.0' });
    expect(service.getState().status).toBe('downloaded');
  });

  it('onStatusChange returns working unsubscribe function', async () => {
    const service = await initService();
    const states: UpdateState[] = [];
    const unsub = service.onStatusChange((s) => states.push({ ...s }));

    autoUpdaterMock._emit('checking-for-update');
    autoUpdaterMock._emit('update-available', { version: '1.0.0' });

    unsub();

    autoUpdaterMock._emit('update-downloaded', { version: '1.0.0' });

    expect(states).toHaveLength(2);
    expect(states[0].status).toBe('checking');
    expect(states[1].status).toBe('available');
  });
});
