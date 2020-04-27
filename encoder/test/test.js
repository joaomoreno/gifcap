function main() {
  const encode = Module['_encode'];
  const canvas = document.getElementById('canvas');

  const images = ['one', 'two', 'three']
    .map(id => document.getElementById(id));

  canvas.width = images[0].width;
  canvas.height = images[0].height;

  const ctx = canvas.getContext('2d');
  const imageData = images.map(img => {
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  });

  const startGifsicle = Date.now();
  const ptrs = imageData.map(imageData => {
    const length = imageData.data.byteLength;
    const ptr = Module._malloc(length);
    const buffer = new Uint8Array(Module.HEAPU8.buffer, ptr, length);
    buffer.set(imageData.data);

    return ptr;
  });

  encode(ptrs[0], ptrs[1], ptrs[2], canvas.width, canvas.height);

  const outputBuffer = FS.readFile('/output.gif');
  const blob = new Blob([outputBuffer], { type: 'image/gif' });

  console.log(`gifsicle took ${Date.now() - startGifsicle}ms`);
  console.log('gifsicle', blob);

  const url = URL.createObjectURL(blob);
  const gifsicle = document.getElementById('gifsicle');
  gifsicle.src = url;

  // JS GIF

  const startGifjs = Date.now();
  const gif = new GIF({
    workers: navigator.hardwareConcurrency,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    workerScript: '../../gif.worker.js',
  });

  gif.addFrame(imageData[0], { delay: 1000 });
  gif.addFrame(imageData[1], { delay: 1000 });
  gif.addFrame(imageData[2], { delay: 1000 });

  gif.once('finished', blob => {
    console.log(`gifjs took ${Date.now() - startGifjs}ms`);
    console.log('gifjs', blob);

    const url = URL.createObjectURL(blob);
    const gifjs = document.getElementById('gifjs');
    gifjs.src = url;
  });

  gif.render();
}

Module['onRuntimeInitialized'] = main;