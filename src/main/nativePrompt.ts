import { execFile } from 'node:child_process';

export type PromptOutcome = { status: 'entered'; value: string } | { status: 'cancelled' } | { status: 'unavailable' } | { status: 'error' };

export type RunOsascript = (file: string, args: string[]) => Promise<{ stdout: string }>;

/** Static script: nothing user-supplied is ever interpolated into it, and the key is never in argv. */
export const PROMPT_SCRIPT =
  'display dialog "Paste your Presage SmartSpectra API key. Aegis Pulse stores it encrypted in your macOS Keychain." ' +
  'default answer "" with hidden answer with title "Aegis Pulse - API key" with icon note ' +
  'buttons {"Cancel", "Save securely"} default button "Save securely" cancel button "Cancel" giving up after 180';

const TIMEOUT_MS = 200_000;

const realRun: RunOsascript = (file, args) =>
  new Promise((resolve, reject) => {
    execFile(file, args, { timeout: TIMEOUT_MS, maxBuffer: 16 * 1024, env: { PATH: '/usr/bin:/bin' }, encoding: 'utf8' }, (err, stdout) => {
      if (err) reject(err);
      else resolve({ stdout });
    });
  });

/** Parses `button returned:Save securely, text returned:<key>[, gave up:false]`. */
export function parseOsascriptResult(stdout: string): PromptOutcome {
  const text = stdout.replace(/\r?\n$/, '');
  const m = /^button returned:([^,]*), text returned:([\s\S]*?)(?:, gave up:(true|false))?$/.exec(text);
  if (!m) return { status: 'error' };
  if (m[3] === 'true' || m[1] !== 'Save securely') return { status: 'cancelled' };
  return { status: 'entered', value: m[2] ?? '' };
}

/**
 * Native macOS hidden-input dialog, run by the MAIN process. The typed key travels only through this child
 * process's stdout pipe into main-process memory; it never enters renderer JavaScript.
 */
export async function promptForApiKey(platform: NodeJS.Platform = process.platform, run: RunOsascript = realRun): Promise<PromptOutcome> {
  if (platform !== 'darwin') return { status: 'unavailable' };
  try {
    const { stdout } = await run('/usr/bin/osascript', ['-e', PROMPT_SCRIPT]);
    return parseOsascriptResult(stdout);
  } catch (e) {
    const err = e as { code?: unknown; stderr?: unknown; message?: unknown };
    const detail = `${String(err.stderr ?? '')} ${String(err.message ?? '')}`;
    if (err.code === 1 && /User canceled|-128/.test(detail)) return { status: 'cancelled' };
    return { status: 'error' };
  }
}
