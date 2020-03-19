class App {

  constructor() {
    this.state = 'idle';
  }

  view() {
    switch (this.state) {
      case 'idle':
        return m('div', [
          m('div', [
            m('button', { onclick: () => this.startRecording() }, 'Start Recording'),
          ]),
          this.recordedUrl ? m('img', { src: this.recordedUrl }) : undefined
        ]);
      case 'recording':
        return m('div', [
          m('div', [
            m('button', { onclick: () => this.stopRecording() }, 'Stop Recording'),
            typeof this.recordingStartTime === 'number' ? `Recording ${Math.floor((new Date().getTime() - this.recordingStartTime) / 1000)}s...` : undefined,
          ]),
          m('canvas', { width: 640, height: 480 }),
          m('video', { autoplay: true, playsinline: true })
        ]);
      case 'rendering':
        return m('div', `Rendering ${Math.floor(this.renderingProgress * 100)}%...`);
    }
  }

  onupdate(vnode) {
    if (this.state === 'recording' && this.recording === undefined) {
      const video = vnode.dom.getElementsByTagName('video')[0];
      const canvas = vnode.dom.getElementsByTagName('canvas')[0];
      this._startRecording(video, canvas);
    }
  }

  startRecording() {
    if (this.state !== 'idle') {
      return;
    }

    this.state = 'recording';
  }

  async _startRecording(video, canvas) {
    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
      video.srcObject = captureStream;

      const ctx = canvas.getContext('2d');
      let timestamp = this.recordingStartTime = new Date().getTime();
      let first = true;

      const frameInterval = setInterval(async () => {
        try {
          let delay = 0;

          if (first) {
            const width = video.videoWidth;
            const height = video.videoHeight;

            this.recording.gif = new GIF({
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

          this.recording.gif.addFrame(ctx, { copy: true, delay });
          first = false;
        } catch (err) {
          if (err) {
            throw err;
          }
        }
      }, 100);

      const redrawInterval = setInterval(() => m.redraw(), 1000);
      m.redraw();

      const track = captureStream.getVideoTracks()[0];
      const endedListener = () => this.stopRecording();
      track.addEventListener('ended', endedListener);

      this.recording = {
        gif: undefined,
        stop: () => {
          clearInterval(frameInterval);
          clearInterval(redrawInterval);
          track.removeEventListener('ended', endedListener);
          track.stop();
        }
      };
    } catch (err) {
      this.state = 'idle';
      m.redraw();
    }
  }

  stopRecording() {
    if (this.state !== 'recording' || !this.recording) {
      return;
    }

    this.state = 'rendering';
    this.recording.stop();
    this.renderingProgress = 0;

    this.recording.gif.on('progress', progress => {
      this.renderingProgress = progress;
      m.redraw();
    });

    this.recording.gif.once('finished', blob => {
      this.state = 'idle';
      this.recordedUrl = URL.createObjectURL(blob)

      m.redraw();
    });

    this.recording.gif.render();
    this.recording = undefined;
    this.recordingStartTime = undefined;
  }
}

function main() {
  m.mount(document.body, App);
}

window.addEventListener('load', main);