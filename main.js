function main() {
  const recordButton = document.getElementById('record');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  recordButton.addEventListener('click', async () => {
    const captureStream = await navigator.mediaDevices.getDisplayMedia();
    const track = captureStream.getVideoTracks()[0];
    const imageCapture = new ImageCapture(track);

    let timestamp = new Date().getTime();
    let first = true;
    let gif;

    const interval = setInterval(async () => {
      try {
        const frame = await imageCapture.grabFrame();
        let delay = 0;

        if (first) {
          gif = new GIF({
            workers: navigator.hardwareConcurrency,
            quality: 10,
            width: frame.width,
            height: frame.height,
            workerScript: 'vendor/gifjs/gif.worker.js',
          });

          gif.once('finished', blob => {
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            img.src = url;
            document.body.appendChild(img);

            // window.open(url);
          });

          setTimeout(() => {
            clearInterval(interval);
            canvas.style.display = 'none';
            gif.render();
          }, 2000);

          canvas.width = `${frame.width}`;
          canvas.height = `${frame.height}`;
        }

        ctx.drawImage(frame, 0, 0);

        if (!first) {
          const now = new Date().getTime();
          delay = now - timestamp;
          timestamp = now;
        }

        gif.addFrame(ctx, { copy: true, delay });
        first = false;
      } catch (err) {
        if (err) {
          throw err;
        }
      }
    }, 42);
  });
}

window.addEventListener('load', main);