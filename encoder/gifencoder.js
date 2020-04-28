class GifEncoder {

  constructor(width, height) {
    const length = width * height * 4;
    this.bufferPtr = Module._malloc(length);
    this.buffer = new Uint8Array(Module.HEAPU8.buffer, this.bufferPtr, length);
    this.encoder = Module['_encoder_new'](width, height);
  }

  addFrame(imageData) {
    if (!this.buffer) {
      throw new Error('Encoder is disposed');
    }

    this.buffer.set(imageData.data);
    Module['_encoder_add_frame'](this.encoder, this.bufferPtr);
  }

  encode() {
    if (!this.buffer) {
      throw new Error('Encoder is disposed');
    }

    Module['_encoder_encode'](this.encoder);

    this.encoder = null;
    this.buffer = null;
    Module._free(this.bufferPtr);
    this.bufferPtr = null;
  }
}
