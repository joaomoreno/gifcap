class GifEncoder {

  constructor(width, height) {
    const length = width * height * 4;
    this.ptr = Module._malloc(length);
    this.buffer = new Uint8Array(Module.HEAPU8.buffer, this.ptr, length);
    this.encoder = Module['_encoder_new'](width, height);
  }

  addFrame(imageData, delay) {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    this.buffer.set(imageData.data);
    Module['_encoder_add_frame'](this.encoder, this.ptr, delay / 10);
  }

  encode() {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    Module['_encoder_encode'](this.encoder);
    Module._free(this.ptr);

    this.encoder = null;
    this.ptr = null;
    this.buffer = null;

    const buffer = FS.readFile('/output.gif');
    return new Blob([buffer], { type: 'image/gif' });
  }
}
