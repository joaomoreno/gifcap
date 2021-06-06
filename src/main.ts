import m from "mithril";

declare global {
  interface MediaDevices {
    getDisplayMedia(opts: { video: { width: number; height: number } }): MediaStream;
  }
}

interface GifEncoderEvent {
  progress: number;
  finished: Blob;
}

declare class GifEncoder {
  constructor(opts: { width: number; height: number });
  on<E extends keyof GifEncoderEvent>(event: E, fn: (data: GifEncoderEvent[E]) => void): void;
  once<E extends keyof GifEncoderEvent>(event: E, fn: (data: GifEncoderEvent[E]) => void): void;
  addFrame(imageData: ImageData, delay: number): void;
  render(): void;
  abort(): void;
}

const FPS = 10;
const FRAME_DELAY = Math.floor(1000 / FPS);

interface Frame {
  readonly imageData: ImageData;
  readonly timestamp: number;
}

interface Recording {
  readonly width: number;
  readonly height: number;
  readonly frames: Frame[];
}

interface Gif {
  readonly blob: Blob;
  readonly url: string;
  readonly duration: number;
  readonly size: number;
}

interface RenderOptions {
  readonly trim: Range;
  readonly crop: Rect;
}

function timediff(millis: number): string {
  const abs = Math.floor(millis / 1000);
  const mins = Math.floor(abs / 60);
  const secs = abs % 60;
  const s = `${secs < 10 ? "0" : ""}${secs}`;
  const m = mins > 0 ? `${mins < 10 ? "0" : ""}${mins}` : "00";
  return `${m}:${s}`;
}

function humanSize(size: number): string {
  if (size < 1024) {
    return "1 KB";
  }

  size = Math.round(size / 1024);
  return size < 1024 ? `${size} KB` : `${Math.floor((size / 1024) * 100) / 100} MB`;
}

function getFrameIndex(frames: Frame[], timestamp: number, start = 0, end = frames.length - 1): number {
  const gap = end - start;

  if (gap === 0) {
    return start;
  } else if (gap === 1) {
    return timestamp < frames[end].timestamp ? start : end;
  }

  const mid = Math.floor((end + start) / 2);
  const midTimestamp = frames[mid].timestamp;

  if (timestamp === midTimestamp) {
    return mid;
  }

  return timestamp < midTimestamp
    ? getFrameIndex(frames, timestamp, start, mid)
    : getFrameIndex(frames, timestamp, mid, end);
}

interface ButtonAttrs {
  readonly a?: any;
  readonly primary?: boolean;
  readonly title?: string;
  readonly label?: string;
  readonly outline?: boolean;
  readonly iconset?: string;
  readonly disabled?: boolean;
  readonly icon: string;
  readonly onclick?: Function;
}

const Button: m.Component<ButtonAttrs> = {
  view(vnode) {
    if (vnode.attrs.a) {
      return m(
        "a",
        {
          class: `button ${vnode.attrs.primary ? "primary" : "secondary"} ${vnode.attrs.label ? "" : "icon-only"} ${
            vnode.attrs.outline ? "outline" : ""
          }`,
          ...vnode.attrs.a,
        },
        [
          m("img", {
            src: `https://icongr.am/${vnode.attrs.iconset || "octicons"}/${vnode.attrs.icon}.svg?size=16&color=${
              vnode.attrs.outline ? "333333" : "ffffff"
            }`,
          }),
          vnode.attrs.label,
        ]
      );
    } else {
      return m(
        "button",
        {
          class: `button ${vnode.attrs.primary ? "primary" : "secondary"} ${vnode.attrs.label ? "" : "icon-only"} ${
            vnode.attrs.outline ? "outline" : ""
          }`,
          onclick: vnode.attrs.onclick,
          title: vnode.attrs.title || vnode.attrs.label,
          disabled: vnode.attrs.disabled,
        },
        [
          m("img", {
            src: `https://icongr.am/${vnode.attrs.iconset || "octicons"}/${vnode.attrs.icon}.svg?size=16&color=${
              vnode.attrs.outline ? "333333" : "ffffff"
            }`,
          }),
          vnode.attrs.label,
        ]
      );
    }
  },
};

interface TimerAttrs {
  readonly duration: number;
}

const Timer: m.Component<TimerAttrs> = {
  view(vnode) {
    return m("span.tag.is-small", [
      m("img", {
        src: "https://icongr.am/octicons/clock.svg?size=16&color=333333",
      }),
      timediff(vnode.attrs.duration),
    ]);
  },
};

interface DOMViewAttrs {
  readonly contentClass?: string;
  readonly contentProps?: object;
  readonly actions: m.Children;
}

const DOMView: m.Component<DOMViewAttrs> = {
  view(vnode) {
    return m("section", { class: "view" }, [
      m(
        "section",
        {
          class: `content ${vnode.attrs.contentClass || ""}`,
          ...(vnode.attrs.contentProps || {}),
        },
        vnode.children
      ),
      m("section", { class: "actions" }, vnode.attrs.actions),
    ]);
  },
};

const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

interface ViewAttrs {
  readonly app: App;
}

interface StartViewAttrs extends ViewAttrs {}

class StartView implements m.ClassComponent<StartViewAttrs> {
  private readonly app: App;

  constructor(vnode: m.CVnode<StartViewAttrs>) {
    this.app = vnode.attrs.app;
  }

  view() {
    return m(DOMView, [
      m("p", "Create animated GIFs from a screen recording."),
      m("p", "Client-side only, no data is uploaded. Modern browser required."),
      isMobile ? m("p", "Sorry, mobile does not support screen recording.") : undefined,
      isMobile
        ? undefined
        : m(Button, {
            label: "Start Recording",
            icon: "play",
            onclick: () => this.app.startRecording(),
            primary: true,
          }),
    ]);
  }
}

interface PlayViewAttrs extends ViewAttrs {
  readonly gif: Gif;
}

class PlayView implements m.ClassComponent<PlayViewAttrs> {
  private readonly app: App;
  private readonly gif: Gif;

  constructor(vnode: m.CVnode<PlayViewAttrs>) {
    this.app = vnode.attrs.app;
    this.gif = vnode.attrs.gif;
  }

  view() {
    const actions = [
      m(Button, {
        label: "Download",
        icon: "download",
        a: {
          href: this.gif.url,
          download: "recording.gif",
          target: "_blank",
        },
        primary: true,
      }),
      m(Button, {
        label: "Edit",
        icon: "pencil",
        onclick: () => this.app.editGif(),
      }),
      m(Button, {
        label: "Discard",
        icon: "trashcan",
        onclick: () => this.app.discardGif(),
      }),
    ];

    return [
      m(
        DOMView,
        { actions },
        m(".recording-card", [
          m(
            "a",
            {
              href: this.gif.url,
              download: "recording.gif",
              target: "_blank",
            },
            [m("img.recording", { src: this.gif.url })]
          ),
          m("footer", [
            m(Timer, { duration: this.gif.duration }),
            m("span.tag.is-small", [
              m(
                "a.recording-detail",
                {
                  href: this.gif.url,
                  download: "recording.gif",
                  target: "_blank",
                },
                [
                  m("img", {
                    src: "https://icongr.am/octicons/download.svg?size=16&color=333333",
                  }),
                  humanSize(this.gif.size),
                ]
              ),
            ]),
          ]),
        ])
      ),
    ];
  }
}

interface RecordViewAttrs extends ViewAttrs {
  readonly captureStream: MediaStream;
}

class RecordView implements m.ClassComponent<RecordViewAttrs> {
  private readonly app: App;
  private readonly captureStream: MediaStream;

  private startTime: number = 0;
  private width: number = 0;
  private height: number = 0;
  private frames: Frame[] = [];
  private _onbeforeremove: Function | undefined;

  constructor(vnode: m.CVnode<RecordViewAttrs>) {
    this.app = vnode.attrs.app;
    this.captureStream = vnode.attrs.captureStream;
  }

  async oncreate(vnode: m.VnodeDOM<RecordViewAttrs, this>) {
    const video: HTMLVideoElement = vnode.dom.getElementsByTagName("video")[0];
    const canvas: HTMLCanvasElement = vnode.dom.getElementsByTagName("canvas")[0];

    video.srcObject = this.captureStream;

    const ctx = canvas.getContext("2d")!;

    const worker = new Worker("/dist/ticker.js");
    worker.onmessage = () => {
      if (video.videoWidth === 0) {
        return;
      }

      const first = this.startTime === 0;

      if (first) {
        const width = video.videoWidth;
        const height = video.videoHeight;

        this.startTime = Date.now();
        this.width = width;
        this.height = height;
        canvas.width = width;
        canvas.height = height;
      }

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, this.width, this.height);

      this.frames.push({
        imageData,
        timestamp: first ? 0 : Date.now() - this.startTime,
      });
    };

    const redrawInterval = setInterval(() => m.redraw(), 100);

    const track = this.captureStream.getVideoTracks()[0];
    const endedListener = () => this.stopRecording();
    track.addEventListener("ended", endedListener);

    this._onbeforeremove = () => {
      worker.terminate();
      clearInterval(redrawInterval);
      track.removeEventListener("ended", endedListener);
      track.stop();
    };

    m.redraw();
  }

  onbeforeremove(): void {
    this._onbeforeremove && this._onbeforeremove();
  }

  view() {
    return [
      m(DOMView, [
        m("p", [
          m(Timer, {
            duration: this.startTime === 0 ? 0 : Date.now() - this.startTime,
          }),
        ]),
        m(Button, {
          label: "Stop Recording",
          icon: "square-fill",
          onclick: () => this.stopRecording(),
        }),
        m("canvas.hidden", { width: 640, height: 480 }),
        m("video.hidden", { autoplay: true, playsinline: true }),
      ]),
    ];
  }

  private stopRecording(): void {
    this.app.stopRecording({
      width: this.width,
      height: this.height,
      frames: this.frames,
    });
  }
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Viewport extends Rect {
  zoom: number;
}

// TODO: cleanup
interface Playback {
  head: number;
  start: number;
  end: number;
  offset: number;
  disposable: Function | undefined;
}

interface Range {
  start: number;
  end: number;
}

interface PreviewViewAttrs extends ViewAttrs {
  readonly recording: Recording;
}

class PreviewView implements m.ClassComponent<PreviewViewAttrs> {
  private readonly app: App;
  private readonly recording: Recording;
  private readonly duration: number;

  private canvas!: HTMLCanvasElement;
  private playbar!: HTMLDivElement;
  private content!: HTMLDivElement;
  private viewportDisposable!: Function;

  private viewport: Viewport;
  private playback: Playback;
  private trim: Range;
  private crop: Rect;

  constructor(vnode: m.CVnode<PreviewViewAttrs>) {
    this.app = vnode.attrs.app;
    this.recording = vnode.attrs.recording;
    this.duration = this.recording.frames[this.recording.frames.length - 1].timestamp + FRAME_DELAY;
    this.viewport = { width: 0, height: 0, top: 0, left: 0, zoom: 1 };
    this.playback = { head: 0, start: 0, offset: 0, end: this.duration, disposable: undefined };
    this.trim = { start: 0, end: this.duration };
    this.crop = { top: 0, left: 0, width: this.recording.width, height: this.recording.height };
  }

  private get isPlaying() {
    return !!this.playback.disposable;
  }

  async oncreate(vnode: m.VnodeDOM<PreviewViewAttrs, this>) {
    this.canvas = vnode.dom.getElementsByTagName("canvas")[0];
    this.playbar = vnode.dom.querySelector(".playbar")!;
    this.content = vnode.dom.querySelector(".content")!;

    const viewportListener = () => this.updateViewport();
    window.addEventListener("resize", viewportListener);
    this.viewportDisposable = () => window.removeEventListener("resize", viewportListener);
    this.updateViewport();
    this.zoomToFit();

    m.redraw(); // prevent flickering
    setTimeout(() => this.play());
  }

  zoomToFit() {
    this.viewport.zoom = Math.max(
      0.1,
      Math.min(
        1,
        (this.viewport.width * 0.95) / this.recording.width,
        (this.viewport.height * 0.95) / this.recording.height
      )
    );
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
    const isCropped =
      this.crop.top !== 0 ||
      this.crop.left !== 0 ||
      this.crop.width !== this.recording.width ||
      this.crop.height !== this.recording.height;
    const actions = [
      m(Button, {
        title: this.isPlaying ? "Pause" : "Play",
        iconset: "material",
        icon: this.isPlaying ? "pause" : "play",
        primary: true,
        onclick: () => this.togglePlayPause(),
      }),
      m(".playbar", [
        m("input", {
          type: "range",
          min: 0,
          max: `${this.duration}`,
          value: `${this.playback.head}`,
          disabled: this.isPlaying,
          oninput: (e: InputEvent) => this.onPlaybarInput(e),
        }),
        m(
          ".trim-bar",
          {
            style: {
              left: `${(this.trim.start * 100) / this.duration}%`,
              width: `${((this.trim.end - this.trim.start) * 100) / this.duration}%`,
            },
          },
          [
            m(".trim-start", {
              onmousedown: (e: MouseEvent) => this.onTrimMouseDown("start", e),
            }),
            m(".trim-end", {
              onmousedown: (e: MouseEvent) => this.onTrimMouseDown("end", e),
            }),
          ]
        ),
      ]),
      m(Button, {
        label: "Render",
        icon: "gear",
        onclick: () => this.app.startRendering({ trim: this.trim, crop: this.crop }),
        primary: true,
      }),
      m(Button, {
        title: "Discard",
        icon: "trashcan",
        onclick: () => this.app.discardGif(),
      }),
    ];

    const scale = (value: number) => value * this.viewport.zoom;
    const width = scale(this.recording.width);
    const height = scale(this.recording.height);
    const top = Math.floor(scale(this.viewport.top) + this.viewport.height / 2 - height / 2);
    const left = Math.floor(scale(this.viewport.left) + this.viewport.width / 2 - width / 2);

    return [
      m(
        DOMView,
        {
          actions,
          contentClass: "crop",
          contentProps: {
            onwheel: (e: WheelEvent) => this.onContentWheel(e),
            onmousedown: (e: MouseEvent) => this.onContentMouseDown(e),
            oncontextmenu: (e: MouseEvent) => e.preventDefault(),
          },
        },
        [
          m(
            ".preview",
            {
              style: {
                top: `${top}px`,
                left: `${left}px`,
                width: `${width}px`,
                height: `${height}px`,
              },
            },
            [
              m("canvas", {
                width: this.recording.width,
                height: this.recording.height,
              }),
              isCropped &&
                m(".crop-box", {
                  style: {
                    // here be dragons!
                    clipPath: `polygon(evenodd, 0 0, 0 ${scale(this.recording.height)}px, ${scale(
                      this.recording.width
                    )}% ${scale(this.recording.height)}px, ${scale(this.recording.width)}% 0, 0 0, ${scale(
                      this.crop.left
                    )}px ${scale(this.crop.top)}px, ${scale(this.crop.left)}px ${scale(
                      this.crop.top + this.crop.height
                    )}px, ${scale(this.crop.left + this.crop.width)}px ${scale(
                      this.crop.top + this.crop.height
                    )}px, ${scale(this.crop.left + this.crop.width)}px ${scale(this.crop.top)}px, ${scale(
                      this.crop.left
                    )}px ${scale(this.crop.top)}px)`,
                  },
                }),
            ]
          ),
        ]
      ),
    ];
  }

  onTrimMouseDown(handle: "start" | "end", event: MouseEvent) {
    event.preventDefault();

    const ctx = this.canvas.getContext("2d")!;
    const start = {
      width: this.playbar.clientWidth,
      screenX: event.screenX,
      head: handle === "start" ? this.trim.start : this.trim.end,
      min: handle === "start" ? 0 : this.trim.start + FRAME_DELAY,
      max: handle === "start" ? this.trim.end - FRAME_DELAY : this.duration,
    };

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.screenX - start.screenX;
      const head = start.head + Math.round((diff * this.duration) / start.width);
      this.trim[handle] = Math.max(start.min, Math.min(start.max, head));

      m.redraw();
    };

    const onMouseUp = () => {
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseup", onMouseUp);

      this.playback.start = this.trim.start;
      this.playback.end = this.trim.end;

      if (this.isPlaying) {
        this.playback.head = Math.max(this.playback.start, Math.min(this.playback.end, this.playback.head));
        this.playback.offset = Date.now() - this.playback.head + this.playback.start;

        const index = getFrameIndex(this.recording.frames, this.playback.head);
        ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
      }

      m.redraw();
    };

    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);
  }

  onContentWheel(event: WheelEvent) {
    event.preventDefault();
    const zoom = this.viewport.zoom - (event.deltaY / 180) * 0.1;
    this.viewport.zoom = Math.max(0.1, Math.min(2, zoom));
  }

  onContentMouseDown(event: MouseEvent) {
    if (event.button === 0 && !event.ctrlKey && !event.metaKey && !event.shiftKey) {
      this.onCrop(event);
    } else {
      this.onViewportMove(event);
    }
  }

  onCrop(event: MouseEvent) {
    const width = this.recording.width * this.viewport.zoom;
    const height = this.recording.height * this.viewport.zoom;
    const top = Math.floor(this.viewport.top * this.viewport.zoom + this.viewport.height / 2 - height / 2);
    const left = Math.floor(this.viewport.left * this.viewport.zoom + this.viewport.width / 2 - width / 2);
    const offsetTop = (event.currentTarget as HTMLDivElement).offsetTop;
    const offsetLeft = (event.currentTarget as HTMLDivElement).offsetLeft;
    const mouseTop = (event: MouseEvent) =>
      Math.max(0, Math.min(this.recording.height, (event.clientY - offsetTop - top) / this.viewport.zoom));
    const mouseLeft = (event: MouseEvent) =>
      Math.max(0, Math.min(this.recording.width, (event.clientX - offsetLeft - left) / this.viewport.zoom));
    const point = (event: MouseEvent) => ({
      top: Math.round(mouseTop(event)),
      left: Math.round(mouseLeft(event)),
    });
    const from = point(event);

    let didMove = false;
    const onMouseMove = (event: MouseEvent) => {
      const to = point(event);
      const top = Math.max(0, Math.min(from.top, to.top));
      const left = Math.max(0, Math.min(from.left, to.left));
      const width = Math.min(this.recording.width - left, Math.abs(from.left - to.left));
      const height = Math.min(this.recording.height - top, Math.abs(from.top - to.top));

      this.crop = { top, left, width, height };
      didMove = true;
      m.redraw();
    };

    const onMouseUp = (event: MouseEvent) => {
      event.preventDefault();
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseup", onMouseUp);

      if (!didMove || this.crop.width < 10 || this.crop.height < 10) {
        this.crop = {
          top: 0,
          left: 0,
          width: this.recording.width,
          height: this.recording.height,
        };
      }

      m.redraw();
    };

    event.preventDefault();
    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);
  }

  onViewportMove(event: MouseEvent) {
    const start = {
      top: this.viewport.top,
      left: this.viewport.left,
      screenX: event.screenX,
      screenY: event.screenY,
    };

    const onMouseMove = (event: MouseEvent) => {
      this.viewport.top = start.top + (event.screenY - start.screenY) / this.viewport.zoom;
      this.viewport.left = start.left + (event.screenX - start.screenX) / this.viewport.zoom;
      m.redraw();
    };

    const onMouseUp = (event: MouseEvent) => {
      event.preventDefault();
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseup", onMouseUp);
      m.redraw();
    };

    event.preventDefault();
    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);
  }

  onPlaybarInput(event: InputEvent) {
    this.playback.head = (event.target as HTMLInputElement).valueAsNumber;

    const ctx = this.canvas.getContext("2d")!;
    const index = getFrameIndex(this.recording.frames, this.playback.head);
    ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
  }

  play() {
    if (this.playback.disposable) {
      this.playback.disposable();
    }

    const ctx = this.canvas.getContext("2d")!;

    let lastIndex: number | undefined = undefined;
    let animationFrame: number | undefined = undefined;

    this.playback.head = Math.max(this.playback.start, Math.min(this.playback.end, this.playback.head));
    this.playback.offset = Date.now() - this.playback.head + this.playback.start;

    const draw = () => {
      this.playback.head =
        this.playback.start + ((Date.now() - this.playback.offset) % (this.playback.end - this.playback.start));

      const index = getFrameIndex(this.recording.frames, this.playback.head);

      if (lastIndex !== index) {
        ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
      }

      lastIndex = index;
      m.redraw();
      animationFrame = requestAnimationFrame(draw);
    };

    animationFrame = requestAnimationFrame(draw);

    this.playback.disposable = () => {
      if (typeof animationFrame !== "undefined") {
        cancelAnimationFrame(animationFrame);
      }
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
}

interface RenderViewAttrs extends ViewAttrs {
  readonly recording: Recording;
  readonly renderOptions: RenderOptions;
}

class RenderView implements m.ClassComponent<RenderViewAttrs> {
  private readonly app: App;
  private readonly recording: Recording;
  private readonly renderOptions: RenderOptions;

  private progress = 0;
  private _onbeforeremove: Function | undefined;

  constructor(vnode: m.CVnode<RenderViewAttrs>) {
    this.app = vnode.attrs.app;
    this.recording = vnode.attrs.recording;
    this.renderOptions = vnode.attrs.renderOptions;
  }

  async oncreate(vnode: m.VnodeDOM<RenderViewAttrs, this>) {
    const gif = new GifEncoder({
      width: this.renderOptions.crop.width,
      height: this.renderOptions.crop.height,
    });

    gif.on("progress", (progress) => {
      this.progress = progress;
      m.redraw();
    });

    gif.once("finished", (blob) => {
      const url = URL.createObjectURL(blob);
      const duration = this.renderOptions.trim.end - this.renderOptions.trim.start;

      this.app.finishRendering({ blob, url, duration, size: blob.size });
    });

    const ctx = vnode.dom.getElementsByTagName("canvas")[0].getContext("2d")!;
    const start = getFrameIndex(this.recording.frames, this.renderOptions.trim.start);
    const end = getFrameIndex(this.recording.frames, this.renderOptions.trim.end);

    const processFrame = (index: number) => {
      if (index > end) {
        this._onbeforeremove = () => gif.abort();
        gif.render();
        return;
      }

      const frame = this.recording.frames[index];
      let imageData = frame.imageData;

      // we always copy the imagedata, because the user might want to
      // go back to edit, and we can't afford to lose frames which
      // were moved to web workers
      ctx.putImageData(imageData, 0, 0);
      imageData = ctx.getImageData(
        this.renderOptions.crop.left,
        this.renderOptions.crop.top,
        this.renderOptions.crop.width,
        this.renderOptions.crop.height
      );

      const delay = index < end ? this.recording.frames[index + 1].timestamp - frame.timestamp : 100;
      gif.addFrame(imageData, delay);
      setTimeout(() => processFrame(index + 1), 0);
    };

    processFrame(start);
  }

  view() {
    const actions = [
      m(Button, {
        label: "Cancel",
        icon: "square-fill",
        onclick: () => this.app.cancelRendering(),
      }),
    ];

    return [
      m(DOMView, { actions }, [
        m(
          "progress",
          { max: "1", value: this.progress, title: "Rendering..." },
          `Rendering: ${Math.floor(this.progress * 100)}%`
        ),
        m("canvas.hidden", {
          width: this.recording.width,
          height: this.recording.height,
        }),
      ]),
    ];
  }

  onbeforeremove(): void {
    this._onbeforeremove && this._onbeforeremove();
  }
}

type State =
  | { name: "start" }
  | { name: "playing"; gif: Gif; recording: Recording }
  | { name: "recording"; captureStream: MediaStream }
  | { name: "previewing"; recording: Recording }
  | { name: "rendering"; recording: Recording; renderOptions: RenderOptions };

function assertState<T extends State["name"], E extends T>(actual: T, expected: E): asserts actual is E {
  if (actual !== expected) {
    throw new Error("Invalid state");
  }
}

class App {
  private _state: State = { name: "start" };

  private get state(): State {
    return this._state;
  }

  private set state(state: State) {
    this._state = state;
    m.redraw();
  }

  constructor() {
    window.onbeforeunload = () => (this.state.name !== "start" ? "" : null);
  }

  view() {
    return m(
      "section",
      {
        id: "app",
        class: this.state.name === "start" ? "home" : "",
      },
      [
        m("section", { id: "app-body" }, [
          m("h1", [m("span", { class: "gif" }, "gif"), m("span", { class: "cap" }, "cap")]),
          this.body(),
        ]),
        m("footer", { id: "app-footer" }, [
          m("span.left", [
            m("a", { href: "https://github.com/joaomoreno/gifcap" }, [
              m("img", {
                alt: "GitHub",
                src: "https://icongr.am/octicons/mark-github.svg?size=18&color=9e9e9e",
              }),
              " joaomoreno/gifcap",
            ]),
          ]),
          m("span", [
            m(
              "a",
              {
                title: "Sponsor me!",
                href: "https://github.com/sponsors/joaomoreno",
              },
              [
                m("img", {
                  alt: "GitHub",
                  src: "https://icongr.am/material/coffee.svg?size=18&color=9e9e9e",
                }),
                " Like the tool? Sponsor me!",
              ]
            ),
          ]),
          m("span.right", [
            "Made with ",
            m("img", {
              alt: "love",
              src: "https://icongr.am/octicons/heart.svg?size=18&color=9e9e9e",
            }),
            " by ",
            m("a", { href: "https://github.com/joaomoreno" }, ["João Moreno"]),
          ]),
        ]),
      ]
    );
  }

  body() {
    switch (this.state.name) {
      case "start":
        return m(StartView, { app: this });
      case "playing":
        return m(PlayView, { app: this, gif: this.state.gif });
      case "recording":
        return m(RecordView, { app: this, captureStream: this.state.captureStream });
      case "previewing":
        return m(PreviewView, { app: this, recording: this.state.recording });
      case "rendering":
        return m(RenderView, { app: this, recording: this.state.recording, renderOptions: this.state.renderOptions });
    }
  }

  async startRecording() {
    if (
      this.state.name !== "start" &&
      !window.confirm("This will discard the current recording, are you sure you want to continue?")
    ) {
      return;
    }

    try {
      const captureStream = await navigator.mediaDevices.getDisplayMedia({
        video: { width: 9999, height: 9999 },
      });

      this.state = { name: "recording", captureStream };
      m.redraw.sync();
    } catch (err) {
      console.error(err);
      return;
    }
  }

  stopRecording(recording: Recording) {
    this.state = { name: "previewing", recording };
  }

  startRendering(renderOptions: RenderOptions) {
    assertState(this.state.name, "previewing");
    this.state = { name: "rendering", recording: this.state.recording, renderOptions };
  }

  finishRendering(gif: Gif) {
    assertState(this.state.name, "rendering");
    this.state = { name: "playing", gif, recording: this.state.recording };
  }

  cancelRendering() {
    assertState(this.state.name, "rendering");
    this.state = { name: "previewing", recording: this.state.recording };
  }

  editGif() {
    assertState(this.state.name, "playing");
    this.state = { name: "previewing", recording: this.state.recording };
  }

  discardGif() {
    this.state = { name: "start" };
  }
}

function main() {
  m.mount(document.getElementById("app-container")!, App);
}

main();
