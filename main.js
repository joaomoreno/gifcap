function timediff(millis) {
  const abs = Math.floor(millis / 1000);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const s = `${secs < 10 ? '0' : ''}${secs}`;
  const m = mins > 0 ? `${mins < 10 ? '0' : ''}${mins}` : '00';
  return `${m}:${s}`;
}

function humanSize(size) {
  if (size < 1024) {
    return '1 KB';
  }

  size = Math.round(size / 1024);

  if (size < 1024) {
    return `${size} KB`
  } else {
    return `${Math.floor(size / 1024 * 100) / 100} MB`;
  }
}

const Timer = {
  view(vnode) {
    return m('span.tag.is-small', [
      m('img', { src: 'https://icongr.am/octicons/clock.svg?size=16&color=333333' }),
      timediff(vnode.attrs.duration)
    ]);
  }
};

class App {

  constructor() {
    this.state = 'idle';
    window.onbeforeunload = () => this.state === 'recording' || this.state === 'rendering' || this.recorded ? '' : null;
  }

  view() {
    return [
      m('section', { class: 'app' }, [
        m('section', { class: 'content' }, this.contentView()),
        m('section', { class: 'actions' }, this.actionsView())
      ])
    ];
  }

  actionsView() {
    if (this.state === 'idle') {
      return [
        this.recorded && m('button', { class: 'button primary', onclick: () => this.startRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/play.svg?size=16&color=ffffff' }),
          'Start Recording'
        ]),
        this.recorded && m('button', { class: 'button secondary', onclick: () => this.clearRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/trashcan.svg?size=16&color=ffffff' }),
          'Discard'
        ])
      ];
    }

    if (this.state === 'recording') {
      return [
        m('button', { class: 'button secondary', onclick: () => this.stopRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/primitive-square.svg?size=16&color=ffffff' }),
          'Stop'
        ])
      ];
    }

    if (this.state === 'rendering') {
      return [
        m('button', { class: 'button secondary', onclick: () => this.cancelRecording() }, [
          m('img', { src: 'https://icongr.am/octicons/primitive-square.svg?size=16&color=ffffff' }),
          'Cancel'
        ])
      ];
    }
  }

  contentView() {
    if (this.state === 'idle') {
      if (this.recorded) {
        return m('div.recording-card', [
          m('a', { href: this.recorded.url, target: '_blank' }, [
            m('img.recording', { src: this.recorded.url })
          ]),
          m('footer', [
            m(Timer, { duration: this.recorded.duration }),
            m('span.tag.is-small', [
              m('a.recording-detail', { href: this.recorded.url, target: '_blank' }, [
                m('img', { src: 'https://icongr.am/octicons/cloud-download.svg?size=16&color=333333' }),
                humanSize(this.recorded.size)
              ])
            ]),
          ]),
        ]);
      } else {
        return [
          m('p', 'Create animated GIFs from a screen recording.'),
          m('p', 'Client-side only, no data is uploaded. Modern browser required.'),
          m('button', { class: 'button primary', onclick: () => this.startRecording() }, [
            m('img', { src: 'https://icongr.am/octicons/play.svg?size=16&color=ffffff' }),
            'Start Recording'
          ])
        ];
      }
    }

    if (this.state === 'recording') {
      return m('div', [
        m(Timer, { duration: typeof this.recordingStartTime === 'number' ? new Date().getTime() - this.recordingStartTime : 0 }),
        m('canvas', { width: 640, height: 480 }),
        m('video', { autoplay: true, playsinline: true }),
      ]);
    }

    if (this.state === 'rendering') {
      return m('div', [
        m('progress', { max: '1', value: this.renderingProgress, title: 'Rendering...' }, `Rendering: ${Math.floor(this.renderingProgress * 100)}%`),
      ]);
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

    if (this.recorded && !window.confirm('This will discard the current recording, are you sure you want to continue?')) {
      return;
    }

    this.recorded = undefined;
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
    if (this.state !== 'recording') {
      return;
    }

    this.state = 'rendering';

    const duration = new Date() - this.recordingStartTime;
    this.recording.stop();
    this.renderingProgress = 0;

    this.recording.gif.on('progress', progress => {
      this.renderingProgress = progress;
      m.redraw();
    });

    const done = () => {
      this.recording = undefined;
      this.recordingStartTime = undefined;
      m.redraw();
    };

    this.recording.gif.once('finished', blob => {
      this.state = 'idle';
      this.recorded = {
        duration,
        size: blob.size,
        url: URL.createObjectURL(blob),
      };
      done();
    });

    this.recording.gif.once('abort', () => {
      this.state = 'idle';
      done();
    });

    this.recording.gif.render();
  }

  cancelRecording() {
    if (this.state !== 'rendering') {
      return;
    }

    this.recording.gif.abort();
  }

  clearRecording() {
    this.recorded = undefined;
  }
}

function main() {
  m.mount(document.getElementById('app-container'), App);
}

main();