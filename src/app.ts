export interface Frame {
  readonly imageData: ImageData;
  readonly timestamp: number;
}

export interface Recording {
  readonly width: number;
  readonly height: number;
  readonly frames: Frame[];
}

export interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

export interface Range {
  start: number;
  end: number;
}

export interface RenderOptions {
  readonly trim: Range;
  readonly crop: Rect;
}

export interface Gif {
  readonly blob: Blob;
  readonly url: string;
  readonly duration: number;
  readonly size: number;
}

export interface App {
  startRecording(): void;
  stopRecording(recording: Recording): void;
  startRendering(renderOptions: RenderOptions): void;
  finishRendering(gif: Gif): void;
  cancelRendering(): void;
  editGif(): void;
  discardGif(): void;
}

export function getFrameIndex(frames: Frame[], timestamp: number, start = 0, end = frames.length - 1): number {
  const gap = end - start;

  if (gap === 0) {
    return start;
  } else if (gap === 1) {
    return timestamp < frames[end].timestamp ? start : end;
  }

  const mid = Math.floor((end + start) / 2);
  const midTimestamp = frames[mid].timestamp;

  if (timestamp === midTimestamp) {
    return mid;
  }

  return timestamp < midTimestamp
    ? getFrameIndex(frames, timestamp, start, mid)
    : getFrameIndex(frames, timestamp, mid, end);
}
