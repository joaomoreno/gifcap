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
  readonly top: number;
  readonly left: number;
  readonly width: number;
  readonly height: number;
}

export interface Range {
  readonly start: number;
  readonly end: number;
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
