// MediaRecorder is only in DOM lib from TS 4.4; we're on 4.3.
export interface MediaRecorderLike {
  readonly mimeType: string;
  readonly state: "inactive" | "recording" | "paused";
  start(timeslice?: number): void;
  stop(): void;
  ondataavailable: ((e: { data: Blob }) => void) | null;
  onstop: (() => void) | null;
}

declare global {
  var MediaRecorder: {
    new (stream: MediaStream, options?: { mimeType?: string }): MediaRecorderLike;
    isTypeSupported(type: string): boolean;
  };
}

export interface Frame {
  readonly imageData: ImageData;
  readonly timestamp: number;
}

export interface Recording {
  readonly width: number;
  readonly height: number;
  readonly frames: Frame[];
  readonly video?: Blob;
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
  readonly frameLength: number;
  startRecording(): void;
  stopRecording(recording: Recording): void;
  startRendering(renderOptions: RenderOptions): void;
  finishRendering(gif: Gif): void;
  cancelRendering(): void;
  editGif(): void;
  discardGif(): void;
}
