importScripts('encoder.js');

let msg = undefined;
let initialized = false;

function main() {
  if (!msg || !initialized) {
    return;
  }

  const length = msg.data.width * msg.data.height * 4;
  const encoder = Module['_encoder_new'](msg.data.width, msg.data.height);


  for (let i = 0; i < msg.data.frames.length; i++) {
    const frame = msg.data.frames[i];
    const ptr = Module._malloc(length);
    const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
    buffer.set(new Uint8Array(frame.imageData));
    Module['_encoder_add_frame'](encoder, ptr, frame.delay / 10);
    Module._free(ptr);
    self.postMessage({ type: 'progress', progress: i / msg.data.frames.length });
  }

  Module['_encoder_encode'](encoder);

  const result = FS.readFile('/output.gif');
  const blob = new Blob([result], { type: 'image/gif' });

  self.postMessage({ type: 'finished', blob });
}

self.onmessage = _msg => {
  msg = _msg;
  main();
};

Module['onRuntimeInitialized'] = () => {
  initialized = true;
  main();
};