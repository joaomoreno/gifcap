function main() {
  const encode = Module['_encode'];
  const canvas = document.getElementById('canvas');
  const output = document.getElementById('output');

  const images = ['one', 'two', 'three']
    .map(id => document.getElementById(id));

  canvas.width = images[0].width;
  canvas.height = images[0].height;

  const ctx = canvas.getContext('2d');
  const imageData = images.map(img => {
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  });

  const ptrs = imageData.map(imageData => {
    const length = imageData.data.byteLength;
    const ptr = Module._malloc(length);
    const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
    buffer.set(imageData.data);

    return ptr;
  });

  const start = Date.now();
  encode(ptrs[0], ptrs[1], ptrs[2], canvas.width, canvas.height);
  console.log(`took ${Date.now() - start}ms`);

  const outputBuffer = FS.readFile('/output.gif');
  const blob = new Blob([outputBuffer], { type: 'image/gif' });
  console.log(blob);
  const url = URL.createObjectURL(blob);

  output.src = url;
}

Module['onRuntimeInitialized'] = main;