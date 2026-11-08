import { isTrustedUrl, type Phase } from '../shared/ipc';

export interface MediaPermissionRequest {
  permission: string;
  mediaTypes: readonly string[];
  url: string;
}

export interface MediaPolicyState {
  consent: boolean;
  phase: Phase;
  allowedUrls: readonly string[];
}

/** The camera is usable only while a measurement session is actually starting or running. */
export const cameraWindowOpen = (phase: Phase): boolean => phase === 'starting' || phase === 'running';

/**
 * Main-process camera authorization. ALL of these must hold at the moment of the request:
 *   - the request is for the camera only (never microphone),
 *   - it comes from our own page,
 *   - the user has granted consent in the main process, AND
 *   - a session was explicitly started (a separate Start action), and has not been stopped.
 * Consent alone is not enough, so a script in the page cannot open the camera without a Start.
 */
export function allowCamera(req: MediaPermissionRequest, s: MediaPolicyState): boolean {
  const cameraOnly = req.mediaTypes.length === 1 && req.mediaTypes[0] === 'video';
  return req.permission === 'media' && cameraOnly && isTrustedUrl(req.url, s.allowedUrls) && s.consent && cameraWindowOpen(s.phase);
}

/** Permission *checks* (no media types supplied) follow the same consent + active-session rule. */
export function allowCameraCheck(permission: string, url: string, s: MediaPolicyState): boolean {
  return permission === 'media' && isTrustedUrl(url, s.allowedUrls) && s.consent && cameraWindowOpen(s.phase);
}
