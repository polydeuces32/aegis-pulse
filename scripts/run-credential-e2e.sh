#!/bin/sh
# Bundles the TS credential modules and runs the real-Keychain end-to-end check under Electron.
set -e
cd "$(dirname "$0")/.."
OUT="${TMPDIR:-/tmp}/aegis-e2e"; mkdir -p "$OUT"
node_modules/.bin/esbuild src/main/credentials.ts --bundle --platform=node --format=cjs --external:electron --outfile="$OUT/cred.cjs" --log-level=error
node_modules/.bin/esbuild src/main/keystore.ts --bundle --platform=node --format=cjs --external:electron --outfile="$OUT/keystore.cjs" --log-level=error
CRED_BUNDLE="$OUT/cred.cjs" KEYSTORE_BUNDLE="$OUT/keystore.cjs" env -u ELECTRON_RUN_AS_NODE node_modules/.bin/electron scripts/credential-e2e.cjs 2>&1 | grep -E "^E2E"
