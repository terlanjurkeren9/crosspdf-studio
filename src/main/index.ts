import { app, BrowserWindow, shell } from 'electron';
import path from 'node:path';
import { log } from './utils/logger';
import { getDatabase, saveDatabase, closeDatabase } from './database/connection';
import { registerIpcHandlers } from './ipc';

const isDev = !app.isPackaged;

const PRELOAD_PATH = path.join(__dirname, '../preload/index.js');
const RENDERER_DEV_URL = 'http://localhost:5173';
const RENDERER_PROD_PATH = path.join(__dirname, '../index.html');

let mainWindow: BrowserWindow | null = null;

function createMainWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'CrossPDF Studio',
    backgroundColor: '#ffffff',
    show: false,
    webPreferences: {
      sandbox: true,
      nodeIntegration: false,
      contextIsolation: true,
      preload: PRELOAD_PATH,
      webSecurity: true,
      allowRunningInsecureContent: false,
      spellcheck: false,
    },
  });

  win.once('ready-to-show', () => {
    win.show();
    if (isDev) {
      win.webContents.openDevTools({ mode: 'detach' });
    }
  });

  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('https:') || url.startsWith('http:')) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  if (isDev) {
    win.loadURL(RENDERER_DEV_URL);
  } else {
    win.loadFile(RENDERER_PROD_PATH);
  }

  win.on('closed', () => {
    mainWindow = null;
  });

  return win;
}

// Single instance lock
const gotLock = app.requestSingleInstanceLock();

if (!gotLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });
}

app.whenReady().then(async () => {
  await getDatabase();
  registerIpcHandlers();

  mainWindow = createMainWindow();

  log.info('CrossPDF Studio started');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    mainWindow = createMainWindow();
  }
});

app.on('before-quit', async () => {
  await saveDatabase();
  closeDatabase();
});
