import { join } from 'node:path';

/** Packaged builds keep their data apart from development runs (which use Electron's default `aegis-pulse` folder). */
export const PACKAGED_DATA_DIRNAME = 'Aegis Pulse';

/**
 * Returns the userData directory a PACKAGED app must use, or null to keep Electron's default (development runs).
 * Nothing is migrated, copied or deleted: a packaged app simply starts with its own empty folder.
 */
export function userDataOverride(isPackaged: boolean, appDataDir: string): string | null {
  return isPackaged ? join(appDataDir, PACKAGED_DATA_DIRNAME) : null;
}
