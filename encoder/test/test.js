function main() {
  const encode = Module['_encode'];
  const canvas = document.getElementById('canvas');
  const image = document.getElementById('image');

  canvas.width = image.width;
  canvas.height = image.height;

  const ctx = canvas.getContext('2d');
  ctx.drawImage(image, 0, 0);

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  const start = Date.now();

  const byteLength = imageData.data.byteLength;
  const ptr = Module._malloc(byteLength);
  const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, byteLength);

  for (let i = 0; i < byteLength; i++) {
    buffer[i] = imageData.data[i];
  }

  const result = encode(ptr, imageData.width, imageData.height);

  console.log(`took ${Date.now() - start}ms`);
  console.log(result);
}

Module['onRuntimeInitialized'] = main;