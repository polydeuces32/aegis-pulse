#!/usr/bin/env bash
# Post-production for the SILENT demo: hides the camera preview, burns in captions, strips ALL audio.
# Input must be your own authentic screen recording of the app. This script adds only a privacy mask and captions.
#
# Usage:
#   PREVIEW_BOX=x:y:w:h LIVE_SEGMENTS="0-8,22-100,115-125" docs/demo/render-demo.sh raw.mov out.mp4 [captions.srt]
#
#   PREVIEW_BOX    pixel rectangle of the camera preview in the RECORDED video (x:y:w:h), measured on a frame
#   LIVE_SEGMENTS  comma list of start-end seconds during which the Live Monitor view (with the preview) is on screen
#   FFMPEG         ffmpeg binary (default: ffmpeg)    FONT  font file for the mask label (default: macOS Helvetica)
set -euo pipefail
IN=${1:?input recording}; OUT=${2:?output .mp4}; SRT=${3:-"$(cd "$(dirname "$0")" && pwd)/captions.srt"}
: "${PREVIEW_BOX:?set PREVIEW_BOX=x:y:w:h}"; : "${LIVE_SEGMENTS:?set LIVE_SEGMENTS=a-b,c-d}"
abs() { echo "$(cd "$(dirname "$1")" && pwd)/$(basename "$1")"; }
IN=$(abs "$IN"); OUT=$(abs "$OUT"); SRT=$(abs "$SRT")
FFMPEG=${FFMPEG:-ffmpeg}; FONT=${FONT:-/System/Library/Fonts/Helvetica.ttc}
IFS=: read -r X Y W H <<<"$PREVIEW_BOX"
EN=""; IFS=, read -ra SEGS <<<"$LIVE_SEGMENTS"
for s in "${SEGS[@]}"; do EN+="${EN:+"+"}between(t,${s%-*},${s#*-})"; done
WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
cp "$SRT" "$WORK/c.srt"
STYLE="FontName=Helvetica,FontSize=11,PrimaryColour=&HFFFFFF&,OutlineColour=&H000000&,BackColour=&H80000000&,BorderStyle=4,Outline=1,Shadow=0,MarginV=28,Alignment=2"
FILTER="drawbox=x=${X}:y=${Y}:w=${W}:h=${H}:color=0x0b0f14@1:t=fill:enable='${EN}',\
drawtext=fontfile='${FONT}':text='Camera preview hidden for privacy':fontcolor=0xe3ecf7:fontsize=22:x=${X}+(${W}-text_w)/2:y=${Y}+(${H}-text_h)/2:enable='${EN}',\
subtitles=c.srt:force_style='${STYLE}'"
( cd "$WORK" && "$FFMPEG" -hide_banner -y -i "$IN" -vf "$FILTER" -an -c:v libx264 -crf 18 -preset medium -pix_fmt yuv420p -r 30 -movflags +faststart "out.mp4" ) 2>&1 | tail -3
mv "$WORK/out.mp4" "$OUT"
echo "wrote $OUT (video only, no audio track)"
