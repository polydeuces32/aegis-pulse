import { describe, expect, it } from 'vitest';
import { PACKAGED_DATA_DIRNAME, userDataOverride } from '../src/main/paths';

describe('userData separation', () => {
  const appData = '/Users/x/Library/Application Support';
  it('development runs keep Electron\'s default folder (no override)', () => {
    expect(userDataOverride(false, appData)).toBeNull();
  });
  it('packaged runs use their own folder, different from the development one', () => {
    const p = userDataOverride(true, appData);
    expect(p).toBe(`${appData}/${PACKAGED_DATA_DIRNAME}`);
    expect(p).not.toBe(`${appData}/aegis-pulse`);
  });
  it('the main entry applies the override before logs and credentials read userData', async () => {
    const { readFileSync } = await import('node:fs');
    const src = readFileSync(new URL('../src/main/index.ts', import.meta.url), 'utf8');
    const set = src.indexOf("app.setPath('userData'");
    expect(set).toBeGreaterThan(0);
    expect(set).toBeLessThan(src.indexOf("app.getPath('userData')"));
  });
});
