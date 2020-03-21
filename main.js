class App {

  constructor() {
    this.state = 'idle';
  }

  view() {
    return m('section', { class: 'root' }, [
      m('header', [
        m('h1', [
          m('span', { class: 'gif' }, 'gif'),
          m('span', { class: 'cap' }, 'cap'),
        ]),
        m('p', 'Capture your screen to an animated GIF')
      ]),
      m('section', { class: 'actions' }, this.actionsView()),
      m('section', { class: 'status' }, this.statusView()),
      m('section', { class: 'content' }, this.contentView()),
      m('footer', 'footer'),
    ]);
  }

  actionsView() {
    if (this.state === 'idle') {
      return [
        m('button', { class: 'button primary', onclick: () => this.startRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/play.svg?size=16&color=ffffff' }),
          'Start Recording'
        ]),
        this.recordedUrl && m('button', { class: 'button secondary', onclick: () => this.clearRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/trashcan.svg?size=16&color=ffffff' }),
          'Clear'
        ])
      ];
    }

    if (this.state === 'recording') {
      return [
        m('button', { class: 'button error', onclick: () => this.stopRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/primitive-square.svg?size=16&color=ffffff' }),
          'Stop'
        ])
      ];
    }
  }

  statusView() {
    if (this.state === 'recording' && typeof this.recordingStartTime === 'number') {
      return m('p', `Recording ${Math.floor((new Date().getTime() - this.recordingStartTime) / 1000)}s...`);
    }

    if (this.state === 'rendering') {
      return m('p', `Rendering ${Math.floor(this.renderingProgress * 100)}%...`);
    }
  }

  contentView() {
    if (this.state === 'idle' && this.recordedUrl) {
      return m('a', { href: this.recordedUrl, target: '_blank' }, [m('img', { class: 'recording', src: this.recordedUrl })]);
    }

    if (this.state === 'recording') {
      return [
        m('canvas', { width: 640, height: 480 }),
        m('video', { autoplay: true, playsinline: true })
      ];
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
    let captureStream;

    try {
      captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (err) {
      this.state = 'idle';
      m.redraw();
      return;
    }

    video.srcObject = captureStream;

    const ctx = canvas.getContext('2d');
    this.recordingStartTime = new Date().getTime();

    let timestamp = undefined;
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
            workerScript: 'gif.worker.js',
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

        this.recording.gif.addFrame(ctx, { copy: true, delay: first ? undefined : delay });

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

  clearRecording() {
    this.recordedUrl = undefined;
  }
}

function main() {
  m.mount(document.body, App);
}

main();