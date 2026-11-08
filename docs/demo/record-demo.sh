#!/usr/bin/env bash
# Silent screen recording (video only; NO audio input is ever opened, NO camera device is opened).
# Usage: docs/demo/record-demo.sh [test]     test = 3-second capture test, otherwise record until Ctrl-C.
# Output: ~/Movies/Aegis-Pulse-Demo/raw.mov (or test.mp4). Never inside the git repo.
set -euo pipefail
DIR="$HOME/Movies/Aegis-Pulse-Demo"; mkdir -p "$DIR"; chmod 700 "$DIR"
# Resolve the avfoundation index of a SCREEN device by name. Camera devices (FaceTime, webcams, iPhone) share the same
# index space, so a hard-coded number could open a camera on another machine. Refuse anything that is not a screen.
# (Listing devices only reads names; it does not open any device.)
LIST=$(ffmpeg -hide_banner -f avfoundation -list_devices true -i "" 2>&1 || true)
if [ -n "${SCREEN_INDEX:-}" ]; then SCREEN=$SCREEN_INDEX
else SCREEN=$(printf '%s\n' "$LIST" | sed -n 's/.*\[\([0-9][0-9]*\)\] Capture screen 0$/\1/p' | sed -n 1p); fi
[ -n "$SCREEN" ] || { echo "No 'Capture screen 0' device found (check Screen Recording permission); aborting." >&2; exit 1; }
NAME=$(printf '%s\n' "$LIST" | sed -n "s/.*\[$SCREEN\] //p" | sed -n 1p)
case "$NAME" in "Capture screen"*) ;; *) echo "Device [$SCREEN] is '$NAME', not a screen; aborting (no camera is ever opened)." >&2; exit 1;; esac
if [ "${1:-}" = test ]; then OUT="$DIR/test.mp4"; T=(-t 3 -an); else OUT="$DIR/raw.mov"; T=(-an); fi
if [ -e "$OUT" ] && [ "${1:-}" != test ]; then mv "$OUT" "$DIR/raw-$(date +%Y%m%d-%H%M%S).mov"; fi
for i in 3 2 1; do echo "recording in $i..."; sleep 1; done
echo "RECORDING -> $OUT   (press Ctrl-C once to stop and save)"
# -an: drop audio. Only the screen device (video) is passed as input.
trap '' INT   # let ffmpeg receive SIGINT and finalise the file; keep the script alive for verification
ffmpeg -hide_banner -loglevel error -y -f avfoundation -capture_cursor 1 -framerate 30 -pixel_format uyvy422 \
  -i "$SCREEN" "${T[@]}" -r 30 -c:v libx264 -preset veryfast -crf 16 -pix_fmt yuv420p "$OUT" || true
trap - INT
echo "--- verify ---"
ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=width,height,nb_read_frames:format=duration -of default=nw=1 "$OUT"
echo "audio streams: $(ffprobe -v error -select_streams a -show_entries stream=index -of csv=p=0 "$OUT" | wc -l | tr -d ' ')"
