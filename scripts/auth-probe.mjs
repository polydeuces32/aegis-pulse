// Probes how the REAL SmartSpectra SDK 3.4.0 reports a rejected credential.
// Uses a randomly generated throwaway key (never the user's key). Sends no frames; telemetry disabled.
import { randomBytes } from 'node:crypto';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const sdkMod = require('@smartspectra/node-sdk');
const { SmartSpectraSDK, SmartSpectraErrorCode, ProcessingStatus, FrameTransform, breathingMetrics } = sdkMod;
const names = Object.fromEntries(Object.entries(SmartSpectraErrorCode).map(([k, v]) => [v, k]));

const bogus = `probe-${randomBytes(18).toString('hex')}`;
const sdk = new SmartSpectraSDK({ apiKey: bogus, requestedMetrics: [...breathingMetrics], enableTelemetry: false });
const t0 = Date.now();
const result = await new Promise((resolve) => {
  const done = (r) => resolve({ ...r, ms: Date.now() - t0 });
  const timer = setTimeout(() => done({ outcome: 'no-error-within-timeout', status: sdk.processingStatus }), 25_000);
  sdk.on('error', (code, message) => { clearTimeout(timer); done({ outcome: 'error-event', code, name: names[code], leaksKey: String(message).includes(bogus) }); });
  sdk.on('processingStatus', (s) => { if (s === ProcessingStatus.kRunning) { clearTimeout(timer); done({ outcome: 'running' }); } });
  try {
    sdk.useCustomInput(FrameTransform.kNone);
    sdk.start();
  } catch (e) {
    clearTimeout(timer);
    done({ outcome: 'start-threw', code: e.code, name: names[e.code], leaksKey: String(e.message).includes(bogus) });
  }
});
console.log(JSON.stringify(result));
try { await Promise.race([sdk.stopAsync(), new Promise((r) => setTimeout(r, 5000))]); } catch {}
try { await Promise.race([sdk.destroy(), new Promise((r) => setTimeout(r, 5000))]); } catch {}
process.exit(0);
