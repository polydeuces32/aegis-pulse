import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app, session as electronSession } from 'electron';
import { decodeMetrics, SmartSpectraSDK } from '@smartspectra/node-sdk';
import { CH, isTrustedUrl, type AegisEvent } from '../shared/ipc';
import { registerIpc } from './ipc';
import { loadApiKey } from './keystore';
import { SdkSession, type SdkPort } from './sdkSession';
import { SessionLogger } from './sessionLog';
import type { DecodedMetricsLike } from './metrics';

const projectRoot = resolve(__dirname, '..', '..');
const devUrl = process.env['ELECTRON_RENDERER_URL'];
const indexFile = join(__dirname, '..', 'renderer', 'index.html');
const allowedUrls: string[] = devUrl ? [devUrl] : [pathToFileURL(indexFile).href];

const apiKey = loadApiKey({ env: process.env, projectRoot, packaged: app.isPackaged });

let win: BrowserWindow | null = null;
let disposeIpc: (() => void) | null = null;

const emit = (e: AegisEvent): void => {
  if (win && !win.isDestroyed()) win.webContents.send(CH.event, e);
};

const logDir = app.isPackaged ? join(app.getPath('userData'), 'logs') : join(projectRoot, 'logs');
const sessionLog = new SessionLogger({ dir: logDir, onError: (m) => console.warn(`[aegis] ${m}`) });

const session = new SdkSession({
  createSdk: (options) => new SmartSpectraSDK(options) as SdkPort,
  decode: (buf) => decodeMetrics(buf) as unknown as DecodedMetricsLike,
  apiKey,
  emit,
  nowMs: () => Date.now(),
  rssBytes: () => process.memoryUsage().rss,
  onSummary: (summary) => {
    const file = sessionLog.writeSummary(summary);
    if (file) console.log(`[aegis] session summary written: ${file}`);
  },
  lifecycle: (e) => {
    sessionLog.lifecycle(e);
    if (e.event === 'phase') console.log(`[aegis] phase=${e.phase}${e.errorKind ? ` error=${e.errorKind}` : ''}`);
  },
});

function createWindow(): void {
  win = new BrowserWindow({
    width: 1080,
    height: 780,
    backgroundColor: '#0b0f14',
    show: false,
    webPreferences: {
      preload: join(__dirname, '..', 'preload', 'index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      webSecurity: true,
      allowRunningInsecureContent: false,
      webviewTag: false,
      spellcheck: false,
    },
  });
  win.once('ready-to-show', () => win?.show());
  win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  win.webContents.on('will-navigate', (e) => e.preventDefault());
  win.webContents.on('will-attach-webview', (e) => e.preventDefault());
  disposeIpc = registerIpc(win, session, allowedUrls);
  win.on('closed', () => {
    disposeIpc?.();
    disposeIpc = null;
    win = null;
    void session.shutdown();
  });
  if (devUrl) void win.loadURL(devUrl);
  else void win.loadFile(indexFile);
}

function installPermissionPolicy(): void {
  const ses = electronSession.defaultSession;
  // Camera only (never microphone), only for our own page, only after explicit in-app consent.
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
    const cameraOnly = mediaTypes.length === 1 && mediaTypes[0] === 'video';
    const url = (details as { requestingUrl?: string }).requestingUrl ?? '';
    callback(permission === 'media' && cameraOnly && isTrustedUrl(url, allowedUrls) && session.hasConsent());
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
    const url = (details as { requestingUrl?: string }).requestingUrl ?? requestingOrigin;
    return permission === 'media' && isTrustedUrl(url, allowedUrls) && session.hasConsent();
  });
}

app.whenReady().then(() => {
  sessionLog.lifecycle({ ts: Date.now(), sessionId: '-', event: 'app', what: 'ready' });
  if (!apiKey.present) console.warn('[aegis] SMARTSPECTRA_API_KEY not configured; Start will report missing-key.');
  installPermissionPolicy();
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

let quitting = false;
app.on('before-quit', (e) => {
  if (quitting) return;
  e.preventDefault();
  quitting = true;
  void session
    .shutdown()
    .finally(() => {
      sessionLog.lifecycle({ ts: Date.now(), sessionId: '-', event: 'app', what: 'quit' });
      app.quit();
    });
});

app.on('window-all-closed', () => app.quit());
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, () => app.quit());
