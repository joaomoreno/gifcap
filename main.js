function main() {
  const recordButton = document.getElementById('record');
  const canvas = document.getElementById('canvas');
  const video = document.getElementById('video');
  const ctx = canvas.getContext('2d');

  recordButton.addEventListener('click', async () => {
    const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    video.srcObject = captureStream;

    let timestamp = new Date().getTime();
    let first = true;
    let gif;

    const interval = setInterval(async () => {
      try {
        let delay = 0;

        if (first) {
          const width = video.videoWidth;
          const height = video.videoHeight;

          gif = new GIF({
            workers: Math.max(Math.floor(navigator.hardwareConcurrency * 0.8), 2),
            quality: 10,
            width,
            height,
            workerScript: 'vendor/gifjs/gif.worker.js',
          });

          gif.on('progress', p => {
            console.log(p);
          });

          gif.once('finished', blob => {
            const url = URL.createObjectURL(blob);
            const img = document.createElement('img');
            img.src = url;
            document.body.appendChild(img);
          });

          setTimeout(() => {
            for (const track of captureStream.getVideoTracks()) {
              track.stop();
            }
            clearInterval(interval);
            canvas.style.display = 'none';
            gif.render();
          }, 2000);

          canvas.width = `${width}`;
          canvas.height = `${height}`;
        }

        ctx.drawImage(video, 0, 0);

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
    }, 100);
  });
}

window.addEventListener('load', main);