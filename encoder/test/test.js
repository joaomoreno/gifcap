function main() {
  const canvas = document.getElementById('canvas');

  const images = ['one', 'two', 'three']
    .map(id => document.getElementById(id));

  canvas.width = images[0].width;
  canvas.height = images[0].height;

  const encoder = new GifEncoder(canvas.width, canvas.height);

  const ctx = canvas.getContext('2d');

  const imageData = images.map(img => {
    ctx.drawImage(img, 0, 0);
    return ctx.getImageData(0, 0, canvas.width, canvas.height);
  });

  for (const img of imageData) {
    encoder.addFrame(img);
  }

  const startGifsicle = Date.now();

  encoder.encode();

  const outputBuffer = FS.readFile('/output.gif');
  const blob = new Blob([outputBuffer], { type: 'image/gif' });

  const stats = document.getElementById('stats');
  stats.innerHTML += `<p>gifsicle: ${Date.now() - startGifsicle}ms, ${blob.size} bytes</p>`;

  const url = URL.createObjectURL(blob);
  const gifsicle = document.getElementById('gifsicle');
  gifsicle.src = url;

  // JS GIF

  const startGifjs = Date.now();
  const gif = new GIF({
    workers: 1,
    quality: 10,
    width: canvas.width,
    height: canvas.height,
    workerScript: '../../gif.worker.js',
  });

  gif.addFrame(imageData[0], { delay: 1000 });
  gif.addFrame(imageData[1], { delay: 1000 });
  gif.addFrame(imageData[2], { delay: 1000 });

  gif.once('finished', blob => {
    stats.innerHTML += `<p>gifjs ${Date.now() - startGifjs}ms, ${blob.size} bytes</p>`;
    const url = URL.createObjectURL(blob);
    const gifjs = document.getElementById('gifjs');
    gifjs.src = url;
  });

  gif.render();
}

Module['onRuntimeInitialized'] = main;