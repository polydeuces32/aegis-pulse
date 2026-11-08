import { readFileSync, readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '..');
const read = (p: string): string => readFileSync(path.join(root, p), 'utf8');
const list = (dir: string): string[] => readdirSync(path.join(root, dir)).filter((f) => /\.tsx?$/.test(f)).map((f) => `${dir}/${f}`);

describe('one session controller, one camera, one SDK instance', () => {
  const rendererFiles = ['src/renderer', 'src/renderer/views', 'src/renderer/components', 'src/renderer/state'].flatMap(list);

  it('useObservatory() is called exactly once, in App()', () => {
    const callers = rendererFiles.filter((f) => /\buseObservatory\(/.test(read(f)) && !f.endsWith('useObservatory.ts'));
    expect(callers).toEqual(['src/renderer/App.tsx']);
    expect((read('src/renderer/App.tsx').match(/useObservatory\(/g) ?? []).length).toBe(1);
  });

  it('views and components never touch the camera, frame pump or session lifecycle IPC directly', () => {
    for (const f of [...list('src/renderer/views'), ...list('src/renderer/components'), 'src/renderer/App.tsx']) {
      const t = read(f);
      expect(t, f).not.toMatch(/getUserMedia|openCamera|FramePump|window\.aegis\.(start|stop|setConsent|sendFrame)/);
    }
  });

  it('the controller opens the camera and creates the frame pump in exactly one place each', () => {
    const hook = read('src/renderer/state/useObservatory.ts');
    expect((hook.match(/await openCamera\(/g) ?? []).length).toBe(1);
    expect((hook.match(/new FramePump\(/g) ?? []).length).toBe(1);
    expect(hook).not.toMatch(/\bview\b|ViewId|navigation/); // controller is independent of which view is shown
  });

  it('the main process constructs the SDK in one place (inside the session factory)', () => {
    const mains = list('src/main').filter((f) => /new SmartSpectraSDK\(/.test(read(f)));
    expect(mains).toEqual(['src/main/index.ts']);
    expect((read('src/main/index.ts').match(/new SmartSpectraSDK\(/g) ?? []).length).toBe(1);
  });

  it('the renderer entry mounts App once', () => {
    expect((read('src/renderer/main.tsx').match(/render\(/g) ?? []).length).toBe(1);
  });
});
