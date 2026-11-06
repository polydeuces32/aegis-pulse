import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { Secret, loadApiKey, parseEnvKey } from '../src/main/keystore';
import { extractSignals } from '../src/main/metrics';

describe('Secret', () => {
  const s = new Secret('KEY-123456789');
  it('never serializes or stringifies', () => {
    expect(String(s)).toBe('[Secret]');
    expect(JSON.stringify({ s })).not.toContain('KEY-123456789');
    expect(inspect(s)).not.toContain('KEY-123456789');
    expect(`${s}`).not.toContain('KEY-123456789');
  });
  it('redacts text', () => expect(s.redact('bad KEY-123456789 here')).toBe('bad [redacted] here'));
  it('empty secret is not present', () => expect(new Secret('').present).toBe(false));
});

describe('loadApiKey', () => {
  it('prefers env, then .env (dev only)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aegis-'));
    writeFileSync(join(dir, '.env'), "SMARTSPECTRA_API_KEY='from-file'\n");
    expect(loadApiKey({ env: { SMARTSPECTRA_API_KEY: 'from-env' }, projectRoot: dir, packaged: false }).reveal()).toBe('from-env');
    expect(loadApiKey({ env: {}, projectRoot: dir, packaged: false }).reveal()).toBe('from-file');
    expect(loadApiKey({ env: {}, projectRoot: dir, packaged: true }).present).toBe(false);
    expect(loadApiKey({ env: {}, projectRoot: join(dir, 'nope'), packaged: false }).present).toBe(false);
  });
  it('parses quoted / exported forms', () => {
    expect(parseEnvKey('export SMARTSPECTRA_API_KEY="abc"')).toBe('abc');
    expect(parseEnvKey('OTHER=1')).toBe('');
  });
});

describe('extractSignals', () => {
  it('takes the latest real sample only', () => {
    const r = extractSignals({
      cardio: { pulseRate: [{ value: 70, confidence: 50, stable: false, timestamp: 1 }, { value: 72, confidence: 88, stable: true, timestamp: 2 }] },
      breathing: { rate: [{ value: 15, confidence: 40, stable: true, timestamp: 3 }] },
    });
    expect(r.pulse).toEqual({ value: 72, confidence: 88, stable: true, timestampUs: 2 });
    expect(r.breathing?.value).toBe(15);
  });
  it('returns null (never a fabricated value) when absent or malformed', () => {
    expect(extractSignals({})).toEqual({ pulse: null, breathing: null });
    expect(extractSignals({ cardio: { pulseRate: [] }, breathing: { rate: [{ value: NaN }] } })).toEqual({ pulse: null, breathing: null });
  });
  it('clamps confidence into [0,100]', () => {
    expect(extractSignals({ breathing: { rate: [{ value: 12, confidence: 250 }] } }).breathing?.confidence).toBe(100);
  });
});
