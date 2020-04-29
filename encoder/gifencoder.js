class GifEncoder {

  constructor(opts) {
    this.length = opts.width * opts.height * 4;
    this.encoder = Module['_encoder_new'](opts.width, opts.height);
  }

  addFrame(imageData, delay) {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    const ptr = Module._malloc(this.length);
    const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, this.length);
    buffer.set(imageData.data);
    Module['_encoder_add_frame'](this.encoder, ptr, delay / 10);
    Module._free(ptr);
  }

  encode() {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    Module['_encoder_encode'](this.encoder);

    this.length = null;
    this.encoder = null;

    const buffer = FS.readFile('/output.gif');
    return new Blob([buffer], { type: 'image/gif' });
  }
}
