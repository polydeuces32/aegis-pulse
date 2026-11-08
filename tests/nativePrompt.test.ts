import { describe, expect, it } from 'vitest';
import { PROMPT_SCRIPT, parseOsascriptResult, promptForApiKey } from '../src/main/nativePrompt';
import { MAX_TYPED_KEY_CHARS, validateTypedKeyArg } from '../src/shared/ipc';

describe('parseOsascriptResult', () => {
  it('extracts the entered text (including commas) when Save is pressed', () => {
    expect(parseOsascriptResult('button returned:Save securely, text returned:ab,cd=ef, gave up:false\n')).toEqual({ status: 'entered', value: 'ab,cd=ef' });
    expect(parseOsascriptResult('button returned:Save securely, text returned:, gave up:false')).toEqual({ status: 'entered', value: '' });
  });
  it('treats a timeout (gave up) as cancelled', () => {
    expect(parseOsascriptResult('button returned:, text returned:, gave up:true')).toEqual({ status: 'cancelled' });
  });
  it('treats unexpected output as an error', () => {
    expect(parseOsascriptResult('garbage')).toEqual({ status: 'error' });
  });
});

describe('promptForApiKey', () => {
  it('runs a static script with no key and no user data in argv', async () => {
    let seen: string[] = [];
    const out = await promptForApiKey('darwin', async (file, args) => {
      seen = [file, ...args];
      return { stdout: 'button returned:Save securely, text returned:SECRET-123, gave up:false' };
    });
    expect(out).toEqual({ status: 'entered', value: 'SECRET-123' });
    expect(seen[0]).toBe('/usr/bin/osascript');
    expect(seen.join(' ')).not.toContain('SECRET-123');
    expect(PROMPT_SCRIPT).toContain('hidden answer');
    expect(PROMPT_SCRIPT).toContain('giving up after');
  });
  it('maps user cancel (osascript exit 1, -128) to cancelled', async () => {
    const out = await promptForApiKey('darwin', async () => { throw Object.assign(new Error('x'), { code: 1, stderr: 'execution error: User canceled. (-128)' }); });
    expect(out).toEqual({ status: 'cancelled' });
  });
  it('maps other failures to error and non-macOS to unavailable', async () => {
    expect(await promptForApiKey('darwin', async () => { throw Object.assign(new Error('boom'), { code: 2 }); })).toEqual({ status: 'error' });
    expect(await promptForApiKey('linux', async () => { throw new Error('should not run'); })).toEqual({ status: 'unavailable' });
  });
});

describe('validateTypedKeyArg (IPC argument guard)', () => {
  it('accepts exactly one string', () => expect(validateTypedKeyArg(['abc'])).toBe('abc'));
  it('rejects wrong arity and types', () => {
    for (const bad of [[], ['a', 'b'], [123], [null], [{ k: 'v' }], [undefined]]) expect(validateTypedKeyArg(bad)).toBeNull();
  });
  it('rejects absurdly large payloads before any processing', () => {
    expect(validateTypedKeyArg(['x'.repeat(MAX_TYPED_KEY_CHARS + 65)])).toBeNull();
  });
});
