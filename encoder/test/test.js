function main() {
  const encode = Module['_encode'];
  const canvas = document.getElementById('canvas');
  const input = document.getElementById('input');
  const output = document.getElementById('output');

  canvas.width = input.width;
  canvas.height = input.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(input, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const byteLength = imageData.data.byteLength;
  const ptr = Module._malloc(byteLength);

  const start = Date.now();
  const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, byteLength);
  buffer.set(imageData.data);

  encode(ptr, imageData.width, imageData.height);

  console.log(`took ${Date.now() - start}ms`);

  console.log('stat', FS.stat('/output.gif'));

  const outputBuffer = FS.readFile('/output.gif');
  console.log(outputBuffer);

  const blob = new Blob([outputBuffer], { type: 'image/gif' });
  console.log(blob);

  const url = URL.createObjectURL(blob);
  console.log(url);

  output.src = url;
}

Module['onRuntimeInitialized'] = main;