interface GifEncoderEvent {
  progress: number;
  finished: Blob;
}

declare class GifEncoder {
  constructor(opts: { width: number; height: number });
  on<E extends keyof GifEncoderEvent>(event: E, fn: (data: GifEncoderEvent[E]) => void): void;
  once<E extends keyof GifEncoderEvent>(event: E, fn: (data: GifEncoderEvent[E]) => void): void;
  addFrame(imageData: ImageData, delay: number): void;
  render(): void;
  abort(): void;
}