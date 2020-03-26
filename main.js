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

// State

class State {

  is(StateClass) {
    return this instanceof StateClass;
  }
}

class IdleState extends State {

  constructor(recording) {
    super();
    this.recording = recording;
  }
}

class RecordingState extends State {

  constructor() {
    super();

    this.recording = {
      duration: undefined,
      width: undefined,
      height: undefined,
      frames: []
    };
  }
}

class PreviewState extends State {

  constructor(recording) {
    super();
    this.recording = recording;
  }
}

class RenderingState extends State {

  constructor(recording) {
    super();
    this.recording = recording;
  }
}

// App

class Recorder {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.state.recording;
    this.startTime = undefined;
  }

  async oncreate(vnode) {
    const video = vnode.dom.getElementsByTagName('video')[0];
    const canvas = vnode.dom.getElementsByTagName('canvas')[0];

    let captureStream;

    try {
      captureStream = await navigator.mediaDevices.getDisplayMedia({ video: true });
    } catch (err) {
      console.error(err);
      this.app.cancelRecording();
      m.redraw();
      return;
    }

    video.srcObject = captureStream;

    const ctx = canvas.getContext('2d');
    this.startTime = new Date().getTime();

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

    const track = captureStream.getVideoTracks()[0];
    const endedListener = () => {
      this.app.stopRecording();
      m.redraw();
    };
    track.addEventListener('ended', endedListener);

    this.onbeforeremove = () => {
      this.recording.duration = new Date() - this.startTime;
      clearInterval(frameInterval);
      clearInterval(redrawInterval);
      track.removeEventListener('ended', endedListener);
      track.stop();
    };

    m.redraw();
  }

  view() {
    return m('div', [
      m(Timer, { duration: typeof this.startTime === 'number' ? new Date().getTime() - this.startTime : 0 }),
      m('canvas.hidden', { width: 640, height: 480 }),
      m('video.hidden', { autoplay: true, playsinline: true }),
    ]);
  }
}

class Previewer {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.state.recording;
    this.crop = {
      top: 0,
      left: 0,
      width: this.recording.width,
      height: this.recording.height
    };
  }

  async oncreate(vnode) {
    const canvas = vnode.dom.getElementsByTagName('canvas')[0];
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

    this.onbeforeremove = () => {
      cancelAnimationFrame(animationFrame);
    };
  }

  view() {
    return m('.preview', [
      m('.crop', { style: { top: `${this.crop.top}px`, left: `${this.crop.left}px`, width: `${this.crop.width}px`, height: `${this.crop.height}px` } }, [
        m('.crop-handle.top', { onmousedown: e => this.onMouseDown(['top'], e) }),
        m('.crop-handle.bottom', { onmousedown: e => this.onMouseDown(['bottom'], e) }),
        m('.crop-handle.left', { onmousedown: e => this.onMouseDown(['left'], e) }),
        m('.crop-handle.right', { onmousedown: e => this.onMouseDown(['right'], e) }),
        m('.crop-handle.tl', { onmousedown: e => this.onMouseDown(['top', 'left'], e) }),
        m('.crop-handle.tr', { onmousedown: e => this.onMouseDown(['top', 'right'], e) }),
        m('.crop-handle.bl', { onmousedown: e => this.onMouseDown(['bottom', 'left'], e) }),
        m('.crop-handle.br', { onmousedown: e => this.onMouseDown(['bottom', 'right'], e) }),
      ]),
      m('canvas.recording', { width: this.recording.width, height: this.recording.height }),
    ]);
  }

  onMouseDown(directions, event) {
    const start = {
      top: this.crop.top,
      left: this.crop.left,
      width: this.crop.width,
      height: this.crop.height,
      bottom: this.crop.top + this.crop.height,
      right: this.crop.left + this.crop.width,
      screenX: event.screenX,
      screenY: event.screenY,
    };

    const handlers = {
      top: e => {
        const diff = e.screenY - start.screenY;
        const top = Math.max(0, Math.min(start.bottom - 5, start.top + diff));
        const delta = top - start.top;
        this.crop.top = top;
        this.crop.height = start.height - delta;
      },
      bottom: e => {
        const diff = e.screenY - start.screenY;
        const height = Math.max(5, Math.min(this.recording.height - start.top, start.height + diff));
        this.crop.height = height;
      },
      left: e => {
        const diff = e.screenX - start.screenX;
        const left = Math.max(0, Math.min(start.right - 5, start.left + diff));
        const delta = left - start.left;
        this.crop.left = left;
        this.crop.width = start.width - delta;
      },
      right: e => {
        const diff = e.screenX - start.screenX;
        const width = Math.max(5, Math.min(this.recording.width - start.left, start.width + diff));
        this.crop.width = width;
      }
    };

    const onMouseMove = e => {
      for (const direction of directions) {
        handlers[direction](e);
      }

      m.redraw();
    };

    const onMouseUp = () => {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', onMouseUp);
      m.redraw();
    };

    event.preventDefault();
    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', onMouseUp);
  }
}

class Renderer {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.state.recording;
    this.progress = 0;
  }

  async oncreate() {
    const gif = new GIF({
      workers: navigator.hardwareConcurrency,
      quality: 10,
      width: this.recording.width,
      height: this.recording.height,
      workerScript: 'gif.worker.js',
    });

    gif.on('progress', progress => {
      this.progress = progress;
      m.redraw();
    });

    gif.once('finished', blob => {
      this.app.setRenderedRecording({
        duration: this.recording.duration,
        size: blob.size,
        url: URL.createObjectURL(blob),
      });
      m.redraw();
    });

    let previous = undefined;

    for (const { imageData, timestamp } of this.recording.frames) {
      gif.addFrame(imageData, { delay: previous && timestamp - previous });
      previous = timestamp;
    }

    this.onbeforeremove = () => {
      gif.abort();
    };

    gif.render();
  }

  view() {
    return m('div', [
      m('progress', { max: '1', value: this.progress, title: 'Rendering...' }, `Rendering: ${Math.floor(this.progress * 100)}%`),
    ]);
  }
}

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

class App {

  constructor() {
    this.state = new IdleState();
    window.onbeforeunload = () => this.state.is(RecordingState) || this.state.is(RenderingState) || (this.state.is(IdleState) && this.state.recording) ? '' : null;
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

    if (this.state.is(IdleState)) {
      return [
        this.state.recording && m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.startRecording(), primary: true }),
        this.state.recording && m(Button, { label: 'Discard', icon: 'trashcan', onclick: () => this.clearRecording() })
      ];
    }

    if (this.state.is(RecordingState)) {
      return [
        m(Button, { label: 'Stop', icon: 'primitive-square', onclick: () => this.stopRecording() })
      ];
    }

    if (this.state.is(PreviewState)) {
      return [
        m(Button, { label: 'Render', icon: 'gear', onclick: () => this.startRendering(), primary: true }),
        m(Button, { label: 'Discard', icon: 'trashcan', onclick: () => this.discardPreview() })
      ];
    }

    if (this.state.is(RenderingState)) {
      return [
        m(Button, { label: 'Cancel', icon: 'primitive-square', onclick: () => this.cancelRendering() })
      ];
    }
  }

  contentView() {
    if (this.state.is(IdleState)) {
      if (this.state.recording) {
        return m('div.recording-card', [
          m('a', { href: this.state.recording.url, target: '_blank' }, [
            m('img.recording', { src: this.state.recording.url })
          ]),
          m('footer', [
            m(Timer, { duration: this.state.recording.duration }),
            m('span.tag.is-small', [
              m('a.recording-detail', { href: this.state.recording.url, target: '_blank' }, [
                m('img', { src: 'https://icongr.am/octicons/cloud-download.svg?size=16&color=333333' }),
                humanSize(this.state.recording.size)
              ])
            ]),
          ]),
        ]);
      } else {
        return [
          m('p', 'Create animated GIFs from a screen recording.'),
          m('p', 'Client-side only, no data is uploaded. Modern browser required.'),
          isMobile ? m('p', 'Sorry, mobile does not support screen recording.') : undefined,
          isMobile ? undefined : m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.startRecording(), primary: true }),
        ];
      }
    }

    if (this.state.is(RecordingState)) {
      return m(Recorder, { app: this });
    }

    if (this.state.is(PreviewState)) {
      return m(Previewer, { app: this });
    }

    if (this.state.is(RenderingState)) {
      return m(Renderer, { app: this });
    }
  }

  startRecording() {
    if (!this.state.is(IdleState)) {
      return;
    }

    if (this.state.recording && !window.confirm('This will discard the current recording, are you sure you want to continue?')) {
      return;
    }

    this.state = new RecordingState();
  }

  stopRecording() {
    if (!this.state.is(RecordingState)) {
      return;
    }

    this.state = new PreviewState(this.state.recording);
  }

  cancelRecording() {
    if (!this.state.is(RecordingState)) {
      return;
    }

    this.state = new IdleState();
  }

  discardPreview() {
    if (!this.state.is(PreviewState)) {
      return;
    }

    this.state = new IdleState();
  }

  startRendering() {
    if (!this.state.is(PreviewState)) {
      return;
    }

    this.state = new RenderingState(this.state.recording);
  }

  cancelRendering() {
    if (!this.state.is(RenderingState)) {
      return;
    }

    this.state = new IdleState();
  }

  setRenderedRecording(recording) {
    if (!this.state.is(RenderingState)) {
      return;
    }

    this.state = new IdleState(recording);
  }

  clearRecording() {
    if (!this.state.is(IdleState)) {
      return;
    }

    this.state = new IdleState();
  }
}

function main() {
  m.mount(document.getElementById('app-container'), App);
}

main();