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

function filter(event, fn) {
  return listener => {
    return event(data => {
      if (fn(data)) {
        listener(data);
      }
    });
  };
}

function once(event) {
  return listener => {
    let dispose = event(data => {
      listener(data);
      dispose();
    });

    return dispose;
  };
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

    startRecording() {
      this.state = 'recording';
    },

    stopRecording() {
      this.state = 'idle';
    }
  };

  app.onDidChangeState(state => {
    if (state === 'idle') {
      recordButton.textContent = 'Start Recording';
    } else if (state === 'recording') {
      recordButton.textContent = 'Stop Recording';
    }
  });

  recordButton.addEventListener('click', async () => {
    if (app.state === 'recording') {
      app.stopRecording();
    } else {
      app.startRecording();

      const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      video.srcObject = captureStream;

      const start = new Date().getTime();
      let timestamp = start;
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
              status.textContent = `Processing: ${Math.floor(p * 100)}% done`;
            });

            gif.once('finished', blob => {
              const url = URL.createObjectURL(blob);
              const img = document.createElement('img');
              img.src = url;
              document.body.appendChild(img);
              status.textContent = ``;
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
          gif.addFrame(ctx, { copy: true, delay });
          first = false;
        } catch (err) {
          if (err) {
            throw err;
          }
        }
      }, 100);

      once(filter(app.onDidChangeState, state => state === 'idle'))(() => {
        for (const track of captureStream.getVideoTracks()) {
          track.stop();
        }

        clearInterval(interval);
        canvas.style.display = 'none';
        gif.render();
      })

      const stream = captureStream.getVideoTracks()[0];
      stream.addEventListener('ended', () => app.stopRecording());
    }
  });
}

window.addEventListener('load', main);