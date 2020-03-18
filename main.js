function createEvent() {
  const listeners = new Set();
  const result = listener => {
    listeners.add(listener);
    return () => listeners.delete(listener);
  };
  result.fire = data => {
    for (const listener of listeners) {
      listener(data);
    }
  };
  return result;
}

function main() {
  const recordButton = document.getElementById('record');
  const status = document.getElementById('status');
  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');

  const app = {
    _state: 'idle',
    get state() { return this._state; },
    set state(state) {
      this._state = state;
      this.onDidChangeState.fire(state);
    },
    onDidChangeState: createEvent(),

    async startRecording() {
      if (this.state !== 'idle') {
        return;
      }

      this.state = 'recording';

      this.captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      video.srcObject = this.captureStream;

      const start = new Date().getTime();
      let timestamp = start;
      let first = true;

      this.interval = setInterval(async () => {
        try {
          let delay = 0;

          if (first) {
            const width = video.videoWidth;
            const height = video.videoHeight;

            this.gif = new GIF({
              workers: navigator.hardwareConcurrency,
              quality: 10,
              width,
              height,
              workerScript: 'vendor/gifjs/gif.worker.js',
            });

            canvas.width = `${width}`;
            canvas.height = `${height}`;
          }

          ctx.drawImage(video, 0, 0);
          const now = new Date().getTime();

          if (!first) {
            delay = now - timestamp;
            timestamp = now;
          }

          status.textContent = `Recording: ${Math.floor((now - start) / 1000)}s...`;
          this.gif.addFrame(ctx, { copy: true, delay });
          first = false;
        } catch (err) {
          if (err) {
            throw err;
          }
        }
      }, 100);

      const track = this.captureStream.getVideoTracks()[0];
      track.addEventListener('ended', () => this.stopRecording());
    },

    stopRecording() {
      if (this.state !== 'recording') {
        return;
      }

      this.state = 'processing';

      for (const track of this.captureStream.getVideoTracks()) {
        track.stop();
      }

      clearInterval(this.interval);
      canvas.style.display = 'none';

      this.captureStream = undefined;
      this.interval = undefined;

      this.gif.render();

      this.gif.on('progress', p => {
        status.textContent = `Processing: ${Math.floor(p * 100)}% done`;
      });

      this.gif.once('finished', blob => {
        const url = URL.createObjectURL(blob);
        const img = document.createElement('img');
        img.src = url;
        document.body.appendChild(img);
        status.textContent = ``;

        this.gif = undefined;
        this.state = 'idle';
      });
    }
  };

  app.onDidChangeState(state => {
    if (state === 'idle') {
      recordButton.textContent = 'Start Recording';
    } else if (state === 'recording') {
      recordButton.textContent = 'Stop Recording';
    } else if (state === 'processing') {
      recordButton.textContent = 'Processing...';
    }
  });

  recordButton.addEventListener('click', async () => {
    if (app.state === 'recording') {
      app.stopRecording();
    } else if (app.state === 'idle') {
      app.startRecording();
    }
  });
}

window.addEventListener('load', main);