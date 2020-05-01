importScripts('/encoder/encoder.js');

let initialized = false;
let opts;
let totalFrames = 0;
const frames = [];

function process() {
  let frame;

  while (initialized && (frame = frames.pop())) {
    const id = totalFrames++;
    const ptr = Module._malloc(frame.buffer.byteLength);
    const input = new Uint8Array(Module.HEAPU8.buffer, ptr, frame.buffer.byteLength);
    input.set(new Uint8Array(frame.buffer));

    const cb = addFunctionWasm((ptr, len) => {
      const result = new Uint8Array(len);
      result.set(new Uint8Array(Module.HEAPU8.buffer, ptr, len));
      self.postMessage(result.buffer, { transfer: [result.buffer] });
    }, 'vii');

    Module['_encoder_new_frame'](id, opts.width, opts.height, ptr, frame.delay / 10, cb);
  }
}

self.onmessage = msg => {
  opts = msg.data;

  self.onmessage = msg => {
    frames.push(msg.data);
    process();
  };
};

Module['onRuntimeInitialized'] = () => {
  initialized = true;
  process();
};