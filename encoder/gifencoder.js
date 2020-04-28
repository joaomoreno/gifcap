class GifEncoder {

  constructor(width, height) {
    this.length = width * height * 4;
    this.encoder = Module['_encoder_new'](width, height);
    this.ptrs = [];
  }

  addFrame(imageData, delay) {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    const ptr = Module._malloc(this.length);
    const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, this.length);
    buffer.set(imageData.data);
    Module['_encoder_add_frame'](this.encoder, ptr, delay / 10);
    this.ptrs.push(ptr);
  }

  encode() {
    if (!this.encoder) {
      throw new Error('Encoder is disposed');
    }

    Module['_encoder_encode'](this.encoder);

    for (const ptr of this.ptrs) {
      Module._free(ptr);
    }

    this.encoder = null;

    const buffer = FS.readFile('/output.gif');
    return new Blob([buffer], { type: 'image/gif' });
  }
}
