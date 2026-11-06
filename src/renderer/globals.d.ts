/// <reference types="vite/client" />

// Minimal typings for WebCodecs/Insertable Streams APIs that Chromium ships but lib.dom omits.
interface MediaStreamTrackProcessorInit {
  track: MediaStreamTrack;
  maxBufferSize?: number;
}
declare class MediaStreamTrackProcessor {
  constructor(init: MediaStreamTrackProcessorInit);
  readonly readable: ReadableStream<VideoFrame>;
}
