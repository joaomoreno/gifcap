importScripts('/encoder/encoder.js');

let initialized = false;
let opts;
const frames = [];

function process(frame) {
  if (frame) {
    frames.push(frame);
  }

  while (initialized && (frame = frames.pop())) {
    const ptr = Module._malloc(frame.buffer.byteLength);
    const input = new Uint8Array(Module.HEAPU8.buffer, ptr, frame.buffer.byteLength);
    input.set(new Uint8Array(frame.buffer));

    const imageLength = opts.width * opts.height;
    const cb = addFunctionWasm((palettePtr, paletteLength, imagePtr) => {
      const result = new Uint8Array(paletteLength + imageLength);
      result.set(new Uint8Array(Module.HEAPU8.buffer, palettePtr, paletteLength));
      result.set(new Uint8Array(Module.HEAPU8.buffer, imagePtr, imageLength), paletteLength);
      self.postMessage({ paletteLength, buffer: result.buffer }, { transfer: [result.buffer] });
    }, 'viii');

    Module['_quantize_image'](opts.width, opts.height, ptr, cb);
    Module._free(ptr);
  }
}

self.onmessage = msg => {
  opts = msg.data;
  self.onmessage = msg => process(msg.data);
};

Module['onRuntimeInitialized'] = () => {
  initialized = true;
  process();
};