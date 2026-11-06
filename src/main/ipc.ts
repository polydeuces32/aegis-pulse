import { ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron';
import {
  CH,
  isTrustedUrl,
  validateConsentArg,
  validateFrame,
  validateNoArgs,
  type AegisError,
  type FrameAck,
  type Result,
  type Snapshot,
} from '../shared/ipc';
import type { SdkSession } from './sdkSession';

const deny = (message: string): { ok: false; error: AegisError } => ({
  ok: false,
  error: { kind: 'state', message, retryable: false },
});

/**
 * Registers the only IPC handlers in the app. Every handler:
 *  1. verifies the sender is OUR window's top frame at an allow-listed URL,
 *  2. validates argument count/type/shape (renderer input is untrusted),
 *  3. returns plain, secret-free data.
 */
export function registerIpc(win: BrowserWindow, session: SdkSession, allowedUrls: readonly string[]): () => void {
  const trusted = (e: IpcMainInvokeEvent): boolean =>
    e.sender === win.webContents && !!e.senderFrame && e.senderFrame === win.webContents.mainFrame && isTrustedUrl(e.senderFrame.url, allowedUrls);

  ipcMain.handle(CH.getState, (e, ...args): Snapshot | Result => {
    if (!trusted(e) || !validateNoArgs(args)) return deny('Rejected.');
    return session.snapshot();
  });

  ipcMain.handle(CH.consent, (e, ...args): Result => {
    if (!trusted(e) || args.length !== 1) return deny('Rejected.');
    const granted = validateConsentArg(args[0]);
    if (granted === null) return deny('Invalid consent argument.');
    return session.setConsent(granted);
  });

  ipcMain.handle(CH.start, async (e, ...args): Promise<Result> => {
    if (!trusted(e) || !validateNoArgs(args)) return deny('Rejected.');
    return session.start();
  });

  ipcMain.handle(CH.stop, async (e, ...args): Promise<Result> => {
    if (!trusted(e) || !validateNoArgs(args)) return deny('Rejected.');
    return session.stop();
  });

  ipcMain.handle(CH.frame, (e, ...args): FrameAck => {
    if (!trusted(e) || args.length !== 1) return { accepted: false, reason: 'invalid' };
    const check = validateFrame(args[0], Date.now());
    if (!check.ok) {
      session.noteInvalid();
      return { accepted: false, reason: 'invalid' };
    }
    return session.handleFrame(check.frame);
  });

  return () => {
    for (const ch of [CH.getState, CH.consent, CH.start, CH.stop, CH.frame]) ipcMain.removeHandler(ch);
  };
}
