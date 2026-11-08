import { afterEach, describe, expect, it, vi } from 'vitest';
import { CameraError, openCamera } from '../src/renderer/capture';

afterEach(() => { vi.unstubAllGlobals(); });

describe('camera access (renderer)', () => {
  it('maps a permission denial to a clear CameraError', async () => {
    vi.stubGlobal('MediaStreamTrackProcessor', class {});
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.reject(new DOMException('denied', 'NotAllowedError')) } });
    await expect(openCamera()).rejects.toMatchObject({ failure: 'denied' });
    await expect(openCamera()).rejects.toBeInstanceOf(CameraError);
  });
  it('maps a missing camera and an unsupported runtime', async () => {
    vi.stubGlobal('MediaStreamTrackProcessor', class {});
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: () => Promise.reject(new DOMException('none', 'NotFoundError')) } });
    await expect(openCamera()).rejects.toMatchObject({ failure: 'unavailable' });
    vi.unstubAllGlobals();
    vi.stubGlobal('MediaStreamTrackProcessor', undefined);
    await expect(openCamera()).rejects.toMatchObject({ failure: 'unsupported' });
  });
  it('requests video only (never audio)', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({});
    vi.stubGlobal('MediaStreamTrackProcessor', class {});
    vi.stubGlobal('navigator', { mediaDevices: { getUserMedia } });
    await openCamera();
    expect(getUserMedia.mock.calls[0]?.[0]).toMatchObject({ audio: false });
  });
});
