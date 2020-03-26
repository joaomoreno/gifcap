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
  return size < 1024 ? `${size} KB` : `${Math.floor(size / 1024 * 100) / 100} MB`;
}

const Button = {
  view(vnode) {
    return m('button', { class: `button ${vnode.attrs.primary ? 'primary' : 'secondary'}`, onclick: vnode.attrs.onclick }, [
      m('img', { src: `https://icongr.am/octicons/${vnode.attrs.icon}.svg?size=16&color=ffffff` }),
      vnode.attrs.label
    ]);
  }
};

const Timer = {
  view(vnode) {
    return m('span.tag.is-small', [
      m('img', { src: 'https://icongr.am/octicons/clock.svg?size=16&color=333333' }),
      timediff(vnode.attrs.duration)
    ]);
  }
};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

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
    if (isMobile) {
      return [];
    }

    if (this.state === 'idle') {
      return [
        this.recorded && m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.startRecording(), primary: true }),
        this.recorded && m(Button, { label: 'Discard', icon: 'trashcan', onclick: () => this.clearRecording() })
      ];
    }

    if (this.state === 'recording') {
      return [
        m(Button, { label: 'Stop', icon: 'primitive-square', onclick: () => this.stopRecording() })
      ];
    }

    if (this.state === 'preview') {
      return [
        m(Button, { label: 'Render', icon: 'gear', onclick: () => this.startRendering(), primary: true }),
        m(Button, { label: 'Discard', icon: 'trashcan', onclick: () => this.discardPreview() })
      ];
    }

    if (this.state === 'rendering') {
      return [
        m(Button, { label: 'Cancel', icon: 'primitive-square', onclick: () => this.cancelRendering() })
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
          isMobile ? m('p', 'Sorry, no mobile support.') : undefined,
          isMobile ? undefined : m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.startRecording(), primary: true }),
        ];
      }
    }

    if (this.state === 'recording') {
      return m('div', [
        m(Timer, { duration: typeof this.recordingStartTime === 'number' ? new Date().getTime() - this.recordingStartTime : 0 }),
        m('canvas.hidden', { width: 640, height: 480 }),
        m('video.hidden', { autoplay: true, playsinline: true }),
      ]);
    }

    if (this.state === 'preview') {
      return m('div', [
        m('canvas.recording', { width: 640, height: 480 }),
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

    if (this.state === 'preview' && this.preview === undefined) {
      const canvas = vnode.dom.getElementsByTagName('canvas')[0];
      this._startPreview(canvas);
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
      console.error(err);
      this.state = 'idle';
      m.redraw();
      return;
    }

    video.srcObject = captureStream;

    const ctx = canvas.getContext('2d');
    this.recordingStartTime = new Date().getTime();

    const frameInterval = setInterval(async () => {
      if (video.videoWidth === 0) {
        return;
      }

      if (typeof this.recording.width === 'undefined') {
        const width = video.videoWidth;
        const height = video.videoHeight;

        this.recording.width = width;
        this.recording.height = height;
        canvas.width = `${width}`;
        canvas.height = `${height}`;
      }

      ctx.drawImage(video, 0, 0);

      this.recording.frames.push({
        imageData: ctx.getImageData(0, 0, this.recording.width, this.recording.height),
        timestamp: new Date().getTime()
      });
    }, 100);

    const redrawInterval = setInterval(() => m.redraw(), 1000);
    m.redraw();

    const track = captureStream.getVideoTracks()[0];
    const endedListener = () => this.stopRecording();
    track.addEventListener('ended', endedListener);

    this.recording = {
      width: undefined,
      height: undefined,
      frames: [],
      stop() {
        clearInterval(frameInterval);
        clearInterval(redrawInterval);
        track.removeEventListener('ended', endedListener);
        track.stop();
        m.redraw();
      },
      cancel: () => null
    };
  }

  stopRecording() {
    if (this.state !== 'recording') {
      return;
    }

    this.state = 'preview';
    this.recording.stop();
  }

  _startPreview(canvas) {
    canvas.width = this.recording.width;
    canvas.height = this.recording.height;

    const ctx = canvas.getContext('2d');

    const firstTimestamp = this.recording.frames[0].timestamp;
    let start = new Date().getTime();
    let animationFrame = undefined;
    let index = 0;

    const draw = () => {
      const frame = this.recording.frames[index];

      if (index === 0 || frame.timestamp - firstTimestamp <= new Date().getTime() - start) {
        ctx.putImageData(frame.imageData, 0, 0);

        if (++index === this.recording.frames.length) {
          index = 0;
          start = new Date().getTime();
        }
      }

      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);

    this.preview = {
      stop: () => {
        cancelAnimationFrame(animationFrame);
        this.preview = undefined;
      }
    };
  }

  discardPreview() {
    if (this.state !== 'preview') {
      return;
    }

    this.preview.stop();
    this.state = 'idle';
    this.recording = undefined;
    this.recordingStartTime = undefined;
  }

  startRendering() {
    if (this.state !== 'preview') {
      return;
    }

    this.state = 'rendering';
    const duration = new Date() - this.recordingStartTime;
    this.preview.stop();
    this.renderingProgress = 0;

    const gif = new GIF({
      workers: navigator.hardwareConcurrency,
      quality: 10,
      width: this.recording.width,
      height: this.recording.height,
      workerScript: 'gif.worker.js',
    });

    gif.on('progress', progress => {
      this.renderingProgress = progress;
      m.redraw();
    });

    const done = () => {
      this.recording = undefined;
      this.recordingStartTime = undefined;
      m.redraw();
    };

    gif.once('finished', blob => {
      this.state = 'idle';
      this.recorded = {
        duration,
        size: blob.size,
        url: URL.createObjectURL(blob),
      };
      done();
    });

    gif.once('abort', () => {
      this.state = 'idle';
      done();
    });

    let previous = undefined;

    for (const { imageData, timestamp } of this.recording.frames) {
      gif.addFrame(imageData, { delay: previous && timestamp - previous });
      previous = timestamp;
    }

    this.recording.cancel = () => gif.abort();
    gif.render();
  }

  cancelRendering() {
    if (this.state !== 'rendering') {
      return;
    }

    this.recording.cancel();
  }

  clearRecording() {
    this.recorded = undefined;
  }
}

function main() {
  m.mount(document.getElementById('app-container'), App);
}

main();