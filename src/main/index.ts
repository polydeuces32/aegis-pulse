import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { BrowserWindow, app, clipboard, safeStorage, session as electronSession } from 'electron';
import { decodeMetrics, SmartSpectraSDK } from '@smartspectra/node-sdk';
import { CH, type AegisEvent } from '../shared/ipc';
import { CredentialService, CredentialStore } from './credentials';
import { registerIpc } from './ipc';
import { KeyHolder } from './keystore';
import { promptForApiKey } from './nativePrompt';
import { allowCamera, allowCameraCheck, type MediaPolicyState } from './permissions';
import { SdkSession, type SdkPort } from './sdkSession';
import { SessionLogger } from './sessionLog';
import type { DecodedMetricsLike } from './metrics';

const projectRoot = resolve(__dirname, '..', '..');
const devUrl = process.env['ELECTRON_RENDERER_URL'];
const indexFile = join(__dirname, '..', 'renderer', 'index.html');
const allowedUrls: string[] = devUrl ? [devUrl] : [pathToFileURL(indexFile).href];

// The key lives only in this holder (main process). It is filled by CredentialService after app ready.
const apiKey = new KeyHolder();
let credentials: CredentialService | null = null;

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
    minWidth: 480,
    minHeight: 520,
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
  if (!credentials) throw new Error('credentials not initialised');
  disposeIpc = registerIpc(win, session, credentials, allowedUrls);
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
  const state = (): MediaPolicyState => ({ consent: session.hasConsent(), phase: session.snapshot().phase, allowedUrls });
  // Camera only (never microphone), only for our own page, and only with consent AND an active, explicitly started session.
  ses.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const mediaTypes = (details as { mediaTypes?: string[] }).mediaTypes ?? [];
    const url = (details as { requestingUrl?: string }).requestingUrl ?? '';
    callback(allowCamera({ permission, mediaTypes, url }, state()));
  });
  ses.setPermissionCheckHandler((_wc, permission, requestingOrigin, details) => {
    const url = (details as { requestingUrl?: string }).requestingUrl ?? requestingOrigin;
    return allowCameraCheck(permission, url, state());
  });
}

app.whenReady().then(() => {
  sessionLog.lifecycle({ ts: Date.now(), sessionId: '-', event: 'app', what: 'ready' });
  credentials = new CredentialService({
    store: new CredentialStore(join(app.getPath('userData'), 'credentials.bin'), safeStorage),
    holder: apiKey,
    env: process.env,
    projectRoot,
    packaged: app.isPackaged,
    clipboard,
    prompt: () => promptForApiKey(),
    canChange: () => {
      const p = session.snapshot().phase;
      return p === 'idle' || p === 'error';
    },
  });
  credentials.resolve();
  console.log(`[aegis] api key source: ${credentials.status().source}`); // source name only, never the key
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
