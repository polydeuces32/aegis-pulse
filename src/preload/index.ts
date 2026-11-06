import { contextBridge, ipcRenderer } from 'electron';
import { CH, type AegisApi, type AegisEvent, type FramePayload } from '../shared/ipc';

// Narrow, typed bridge. No generic ipcRenderer, no channel names, no Electron objects, no key.
const api: AegisApi = {
  getState: () => ipcRenderer.invoke(CH.getState),
  setConsent: (granted: boolean) => ipcRenderer.invoke(CH.consent, granted === true),
  start: () => ipcRenderer.invoke(CH.start),
  stop: () => ipcRenderer.invoke(CH.stop),
  sendFrame: (frame: FramePayload) => ipcRenderer.invoke(CH.frame, frame),
  onEvent: (cb: (e: AegisEvent) => void) => {
    const listener = (_e: Electron.IpcRendererEvent, payload: AegisEvent): void => cb(payload);
    ipcRenderer.on(CH.event, listener);
    return () => {
      ipcRenderer.removeListener(CH.event, listener);
    };
  },
};

contextBridge.exposeInMainWorld('aegis', api);
