import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { inspect } from 'node:util';
import { describe, expect, it } from 'vitest';
import { KeyHolder, Secret, loadDotenvKey, loadEnvKey, parseEnvKey, checkApiKey } from '../src/main/keystore';
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

describe('key loaders', () => {
  it('env and .env loaders are explicit and independent', () => {
    const dir = mkdtempSync(join(tmpdir(), 'aegis-'));
    writeFileSync(join(dir, '.env'), "SMARTSPECTRA_API_KEY='from-file'\n");
    expect(loadEnvKey({ SMARTSPECTRA_API_KEY: ' from-env ' }).reveal()).toBe('from-env');
    expect(loadEnvKey({}).present).toBe(false);
    expect(loadDotenvKey(dir).reveal()).toBe('from-file');
    expect(loadDotenvKey(join(dir, 'nope')).present).toBe(false);
  });
  it('parses quoted / exported forms', () => {
    expect(parseEnvKey('export SMARTSPECTRA_API_KEY="abc"')).toBe('abc');
    expect(parseEnvKey('OTHER=1')).toBe('');
  });
  it('KeyHolder redacts like Secret and can be swapped at runtime', () => {
    const h = new KeyHolder();
    expect(h.present).toBe(false);
    h.set(new Secret('HOLDER-KEY-123456'));
    expect(h.present).toBe(true);
    expect(JSON.stringify({ h })).not.toContain('HOLDER-KEY-123456');
    expect(inspect(h)).not.toContain('HOLDER-KEY-123456');
    expect(h.redact('x HOLDER-KEY-123456 y')).toBe('x [redacted] y');
  });
  it('checkApiKey trims and accepts any single-line token (no invented prefix or length rule)', () => {
    expect(checkApiKey('  abc123  ')).toEqual({ ok: true, key: 'abc123' });
    expect(checkApiKey('x')).toEqual({ ok: true, key: 'x' });
    expect(checkApiKey('prefix-less_and.any+chars/ok=')).toMatchObject({ ok: true });
    expect(checkApiKey('a'.repeat(1024))).toMatchObject({ ok: true });
  });
  it('checkApiKey rejects only what cannot be a single-line credential', () => {
    expect(checkApiKey('')).toEqual({ ok: false, reason: 'empty' });
    expect(checkApiKey('   \t  ')).toEqual({ ok: false, reason: 'empty' });
    expect(checkApiKey(undefined)).toEqual({ ok: false, reason: 'empty' });
    expect(checkApiKey(42)).toEqual({ ok: false, reason: 'empty' });
    expect(checkApiKey('line one\nline two')).toEqual({ ok: false, reason: 'multiline' });
    expect(checkApiKey('a\rb')).toEqual({ ok: false, reason: 'multiline' });
    expect(checkApiKey('bad\u0007bell')).toEqual({ ok: false, reason: 'control' });
    expect(checkApiKey('a'.repeat(1025))).toEqual({ ok: false, reason: 'too-long' });
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
