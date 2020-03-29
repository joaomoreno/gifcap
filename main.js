const FPS = 10;
const FRAME_DELAY = Math.floor(1000 / FPS);

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
    return m('button', {
      class: `button ${vnode.attrs.primary ? 'primary' : 'secondary'} ${vnode.attrs.label ? '' : 'icon-only'} ${vnode.attrs.outline ? 'outline' : ''}`,
      onclick: vnode.attrs.onclick,
      title: vnode.attrs.title || vnode.attrs.label,
      disabled: vnode.attrs.disabled
    }, [
      m('img', { src: `https://icongr.am/${vnode.attrs.iconset || 'octicons'}/${vnode.attrs.icon}.svg?size=16&color=${vnode.attrs.outline ? '333333' : 'ffffff'}` }),
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

const View = {
  view(vnode) {
    return m('section', { class: 'view' }, [
      m('section', { class: 'content' }, vnode.children),
      m('section', { class: 'actions' }, vnode.attrs.actions)
    ]);
  }
};


const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

class IdleView {

  constructor(vnode) {
    this.app = vnode.attrs.app;
  }

  view() {
    let content, actions;

    if (this.app.recording) {
      content = m('.recording-card', [
        m('a', { href: this.app.recording.url, target: '_blank' }, [
          m('img.recording', { src: this.app.recording.url })
        ]),
        m('footer', [
          m(Timer, { duration: this.app.recording.duration }),
          m('span.tag.is-small', [
            m('a.recording-detail', { href: this.app.recording.url, target: '_blank' }, [
              m('img', { src: 'https://icongr.am/octicons/cloud-download.svg?size=16&color=333333' }),
              humanSize(this.app.recording.size)
            ])
          ]),
        ]),
      ]);

      actions = [
        m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.app.startRecording(), primary: true }),
        m(Button, { label: 'Discard', icon: 'trashcan', onclick: () => this.app.cancel() })
      ];
    } else {
      content = [
        m('p', 'Create animated GIFs from a screen recording.'),
        m('p', 'Client-side only, no data is uploaded. Modern browser required.'),
        isMobile ? m('p', 'Sorry, mobile does not support screen recording.') : undefined,
        isMobile ? undefined : m(Button, { label: 'Start Recording', icon: 'play', onclick: () => this.app.startRecording(), primary: true }),
      ];
    }

    return [m(View, { actions }, content)];
  }
}

class RecordView {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.recording;
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
      this.app.cancel();
      m.redraw();
      return;
    }

    video.srcObject = captureStream;

    const ctx = canvas.getContext('2d');

    const frameInterval = setInterval(() => {
      if (video.videoWidth === 0) {
        return;
      }

      const first = typeof this.startTime === 'undefined';

      if (first) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        this.startTime = new Date().getTime();
        this.recording.width = width;
        this.recording.height = height;
        canvas.width = `${width}`;
        canvas.height = `${height}`;
      }

      ctx.drawImage(video, 0, 0);

      this.recording.frames.push(ctx.getImageData(0, 0, this.recording.width, this.recording.height));
    }, FRAME_DELAY);

    const redrawInterval = setInterval(() => m.redraw(), 1000);

    const track = captureStream.getVideoTracks()[0];
    const endedListener = () => {
      this.app.stopRecording();
      m.redraw();
    };
    track.addEventListener('ended', endedListener);

    this.onbeforeremove = () => {
      clearInterval(frameInterval);
      clearInterval(redrawInterval);
      track.removeEventListener('ended', endedListener);
      track.stop();
    };

    m.redraw();
  }

  view() {
    const actions = [
      m(Button, { label: 'Stop', icon: 'primitive-square', onclick: () => this.app.stopRecording() })
    ];

    return [
      m(View, { actions }, [
        m(Timer, { duration: typeof this.startTime === 'number' ? new Date().getTime() - this.startTime : 0 }),
        m('canvas.hidden', { width: 640, height: 480 }),
        m('video.hidden', { autoplay: true, playsinline: true }),
      ]),
    ];
  }
}

class PreviewView {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.recording;
    this.canvas = undefined;
    this.playbar = undefined;
    this.content = undefined;

    this.viewportDisposable = undefined;
    this.viewport = {
      width: undefined,
      height: undefined,
      zoom: 100
    };

    this.playback = {
      index: undefined,
      disposable: undefined,
      reset: false
    };

    this.trim = {
      start: 0,
      end: this.recording.frames.length - 1
    };

    this.crop = {
      top: 0,
      left: 0,
      width: this.recording.width,
      height: this.recording.height
    };
  }

  get isPlaying() { return !!this.playback.disposable; }

  oncreate(vnode) {
    this.canvas = vnode.dom.getElementsByTagName('canvas')[0];
    this.playbar = vnode.dom.querySelector('.playbar');
    this.content = vnode.dom.querySelector('.content');

    const viewportListener = () => this.updateViewport();
    window.addEventListener('resize', viewportListener);
    this.viewportDisposable = () => window.removeEventListener('resize', viewportListener);
    this.updateViewport();

    this.viewport.zoom = 10 * Math.max(1,
      Math.min(10,
        Math.floor(10 * this.viewport.width / this.recording.width),
        Math.floor(10 * this.viewport.height / this.recording.height)
      )
    );

    m.redraw(); // prevent flickering
    setTimeout(() => this.play());
  }

  updateViewport() {
    this.viewport.width = Math.floor(this.content.clientWidth);
    this.viewport.height = Math.floor(this.content.clientHeight);
  }

  onbeforeremove() {
    this.pause();
    this.viewportDisposable();
  }

  view() {
    const actions = [
      m(Button, { title: this.isPlaying ? 'Pause' : 'Play', iconset: 'material', icon: this.isPlaying ? 'pause' : 'play', primary: true, onclick: () => this.togglePlayPause() }),
      m('.playbar', [
        m('input', { type: 'range', min: 0, max: `${this.recording.frames.length - 1}`, value: `${this.playback.index}`, disabled: this.isPlaying, oninput: e => this.onPlaybarInput(e) }),
        m('.trim-bar', { style: { left: `${this.trim.start * 100 / (this.recording.frames.length - 1)}%`, width: `${(this.trim.end - this.trim.start) * 100 / (this.recording.frames.length - 1)}%` } }, [
          m('.trim-start', { onmousedown: e => this.onTrimMouseDown('start', e) }),
          m('.trim-end', { onmousedown: e => this.onTrimMouseDown('end', e) }),
        ])
      ]),
      m(Button, { title: 'Discard', icon: 'trashcan', onclick: () => this.app.cancel() }),
      m(Button, { label: 'Render', icon: 'gear', onclick: () => this.app.startRendering(this.trim), primary: true }),
    ];

    const width = this.recording.width * this.viewport.zoom / 100;
    const height = this.recording.height * this.viewport.zoom / 100;

    return [
      m(View, { actions }, [
        // m('.crop', {}, [
        //   m('.crop-box', { style: { top: `${this.crop.top}px`, left: `${this.crop.left}px`, width: `${this.crop.width}px`, height: `${this.crop.height}px` } }, [
        //     m('.crop-handle.top', { onmousedown: e => this.onMouseDown(['top'], e) }),
        //     m('.crop-handle.bottom', { onmousedown: e => this.onMouseDown(['bottom'], e) }),
        //     m('.crop-handle.left', { onmousedown: e => this.onMouseDown(['left'], e) }),
        //     m('.crop-handle.right', { onmousedown: e => this.onMouseDown(['right'], e) }),
        //     m('.crop-handle.tl', { onmousedown: e => this.onMouseDown(['top', 'left'], e) }),
        //     m('.crop-handle.tr', { onmousedown: e => this.onMouseDown(['top', 'right'], e) }),
        //     m('.crop-handle.bl', { onmousedown: e => this.onMouseDown(['bottom', 'left'], e) }),
        //     m('.crop-handle.br', { onmousedown: e => this.onMouseDown(['bottom', 'right'], e) }),
        //   ])
        // ]),
        m('canvas.recording-preview', {
          width: this.recording.width, height: this.recording.height, style: {
            top: `${Math.floor((this.viewport.height / 2) - (height / 2))}px`,
            left: `${Math.floor((this.viewport.width / 2) - (width / 2))}px`,
            width: `${width}px`,
            height: `${height}px`
          }
        }),
        m('.zoom-container', [
          m('span.tag.is-small', [
            `${this.viewport.zoom}%`,
            m('input.zoom', { type: 'range', min: '10', max: `300`, step: '10', value: `${this.viewport.zoom}`, oninput: e => this.onZoomInput(e) }),
          ]),
        ])
      ])
    ];
  }

  onTrimMouseDown(handle, event) {
    event.preventDefault();

    const ctx = this.canvas.getContext('2d');
    const start = {
      width: this.playbar.clientWidth,
      screenX: event.screenX,
      index: handle === 'start' ? this.trim.start : this.trim.end,
      min: handle === 'start' ? 0 : this.trim.start + 1,
      max: handle === 'start' ? this.trim.end - 1 : this.recording.frames.length - 1
    };

    const onMouseMove = e => {
      const diff = e.screenX - start.screenX;
      const index = start.index + Math.round(diff * (this.recording.frames.length - 1) / start.width);
      const previous = this.trim[handle];
      this.trim[handle] = Math.max(start.min, Math.min(start.max, index));

      if (!this.isPlaying && previous !== this.trim[handle]) {
        ctx.putImageData(this.recording.frames[this.trim[handle]], 0, 0);
      }

      m.redraw();
    };

    const onMouseUp = () => {
      document.body.removeEventListener('mousemove', onMouseMove);
      document.body.removeEventListener('mouseup', onMouseUp);

      this.playback.reset = true;

      if (this.isPlaying) {
        this.play();
      } else {
        ctx.putImageData(this.recording.frames[this.playback.index], 0, 0);
      }

      m.redraw();
    };

    if (!this.isPlaying) {
      ctx.putImageData(this.recording.frames[this.trim[handle]], 0, 0);
    }

    document.body.addEventListener('mousemove', onMouseMove);
    document.body.addEventListener('mouseup', onMouseUp);
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
        const top = Math.max(0, Math.min(start.bottom - 20, start.top + diff));
        const delta = top - start.top;
        this.crop.top = top;
        this.crop.height = start.height - delta;
      },
      bottom: e => {
        const diff = e.screenY - start.screenY;
        const height = Math.max(20, Math.min(this.recording.height - start.top, start.height + diff));
        this.crop.height = height;
      },
      left: e => {
        const diff = e.screenX - start.screenX;
        const left = Math.max(0, Math.min(start.right - 20, start.left + diff));
        const delta = left - start.left;
        this.crop.left = left;
        this.crop.width = start.width - delta;
      },
      right: e => {
        const diff = e.screenX - start.screenX;
        const width = Math.max(20, Math.min(this.recording.width - start.left, start.width + diff));
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

  onPlaybarInput(e) {
    this.playback.index = Number(e.target.value);

    const ctx = this.canvas.getContext('2d');
    ctx.putImageData(this.recording.frames[this.playback.index], 0, 0);
  }

  onZoomInput(e) {
    this.viewport.zoom = Number(e.target.value);
  }

  play() {
    if (this.playback.disposable) {
      this.playback.disposable();
    }

    if (this.playback.reset) {
      this.playback.index = undefined;
      this.playback.reset = false;
    }

    const range = {
      start: this.trim.start,
      end: this.trim.end
    };

    const ctx = this.canvas.getContext('2d');
    const duration = (range.end - range.start + 1) * FRAME_DELAY;
    const start = range.start * FRAME_DELAY + new Date().getTime() - ((this.playback.index || range.start) * FRAME_DELAY);
    let animationFrame = undefined;

    const draw = () => {
      const index = range.start + Math.floor(((new Date().getTime() - start) % duration) / FRAME_DELAY);

      if (this.playback.index !== index) {
        ctx.putImageData(this.recording.frames[index], 0, 0);
        m.redraw();
      }

      this.playback.index = index;
      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);

    this.playback.disposable = () => {
      cancelAnimationFrame(animationFrame);
    };
  }

  pause() {
    if (this.playback.disposable) {
      this.playback.disposable();
      this.playback.disposable = undefined;
    }
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  trimStart() {
    if (this.trim.start === this.playback.index) {
      this.trim.start = 0;
    } else {
      this.trim.start = this.playback.index;
    }
  }

  trimEnd() {
    if (this.trim.end === this.playback.index) {
      this.trim.end = this.recording.frames.length - 1;
    } else {
      this.trim.end = this.playback.index;
    }
  }
}

class RenderView {

  constructor(vnode) {
    this.app = vnode.attrs.app;
    this.recording = this.app.recording;
    this.trim = this.app.trim;
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
        duration: (this.trim.end - this.trim.start + 1) * FRAME_DELAY,
        size: blob.size,
        url: URL.createObjectURL(blob),
      });
      m.redraw();
    });

    let first = true;

    for (let i = this.trim.start; i <= this.trim.end; i++) {
      const frame = this.recording.frames[i];
      gif.addFrame(frame, { delay: first ? 0 : FRAME_DELAY });
      first = false;
    }

    this.onbeforeremove = () => {
      gif.abort();
    };

    gif.render();
  }

  view() {
    const actions = [
      m(Button, { label: 'Cancel', icon: 'primitive-square', onclick: () => this.app.cancel() })
    ];

    return [
      m(View, { actions }, [
        m('progress', { max: '1', value: this.progress, title: 'Rendering...' }, `Rendering: ${Math.floor(this.progress * 100)}%`)
      ])
    ];
  }
}

class App {

  constructor() {
    this.state = 'idle';
    this.recording = undefined;
    window.onbeforeunload = () => this.recording ? '' : null;
  }

  view() {
    switch (this.state) {
      case 'idle': return m(IdleView, { app: this });
      case 'recording': return m(RecordView, { app: this });
      case 'preview': return m(PreviewView, { app: this });
      case 'rendering': return m(RenderView, { app: this });
    }
  }

  startRecording() {
    if (this.recording && !window.confirm('This will discard the current recording, are you sure you want to continue?')) {
      return;
    }

    this.state = 'recording';
    this.recording = {
      width: undefined,
      height: undefined,
      frames: []
    };
  }

  stopRecording() {
    this.state = 'preview';
  }

  startRendering(trim) {
    this.state = 'rendering';
    this.trim = trim;
  }

  setRenderedRecording(recording) {
    this.state = 'idle';
    this.recording = recording;
    this.trim = undefined;
  }

  cancel() {
    this.state = 'idle';
    this.recording = undefined;
    this.trim = undefined;
  }
}

function main() {
  m.mount(document.getElementById('app-container'), App);
}

main();