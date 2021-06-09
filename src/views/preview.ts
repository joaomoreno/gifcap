import m from "mithril";
import { App, Frame, Recording, Rect, Range } from "../gifcap";
import Button from "../components/button";
import View from "../components/view";

interface Viewport extends Rect {
  readonly zoom: number;
}

interface Playback {
  head: number;
  start: number;
  end: number;
  offset: number;
  disposable: Function;
}

export function getFrameIndex(frames: Frame[], timestamp: number, start = 0, end = frames.length - 1): number {
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

const noop = () => null;

interface PreviewViewAttrs {
  readonly app: App;
  readonly recording: Recording;
}

export default class PreviewView implements m.ClassComponent<PreviewViewAttrs> {
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
    this.duration = this.recording.frames[this.recording.frames.length - 1].timestamp + this.app.frameLength;
    this.viewport = { width: 0, height: 0, top: 0, left: 0, zoom: 1 };
    this.playback = { head: 0, start: 0, offset: 0, end: this.duration, disposable: noop };
    this.trim = { start: 0, end: this.duration };
    this.crop = { top: 0, left: 0, width: this.recording.width, height: this.recording.height };
  }

  private get isPlaying() {
    return this.playback.disposable !== noop;
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
    const zoom = Math.max(
      0.1,
      Math.min(
        1,
        (this.viewport.width * 0.95) / this.recording.width,
        (this.viewport.height * 0.95) / this.recording.height
      )
    );

    this.viewport = { ...this.viewport, zoom };
  }

  updateViewport() {
    this.viewport = {
      ...this.viewport,
      width: Math.floor(this.content.clientWidth),
      height: Math.floor(this.content.clientHeight),
    };
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
        onclick: () => this.startRendering(),
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
        View,
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
      min: handle === "start" ? 0 : this.trim.start + this.app.frameLength,
      max: handle === "start" ? this.trim.end - this.app.frameLength : this.duration,
    };

    const onMouseMove = (e: MouseEvent) => {
      const diff = e.screenX - start.screenX;
      const head = start.head + Math.round((diff * this.duration) / start.width);
      this.trim = { ...this.trim, [handle]: Math.max(start.min, Math.min(start.max, head)) };

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
    const zoom = Math.max(0.1, Math.min(2, this.viewport.zoom - (event.deltaY / 180) * 0.1));
    this.viewport = { ...this.viewport, zoom };
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
      this.viewport = {
        ...this.viewport,
        top: start.top + (event.screenY - start.screenY) / this.viewport.zoom,
        left: start.left + (event.screenX - start.screenX) / this.viewport.zoom,
      };
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
    this.playback.disposable();

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
    this.playback.disposable = () => cancelAnimationFrame(animationFrame!);
  }

  pause() {
    this.playback.disposable();
    this.playback.disposable = noop;
  }

  togglePlayPause() {
    if (this.isPlaying) {
      this.pause();
    } else {
      this.play();
    }
  }

  private startRendering(): void {
    this.app.startRendering({
      trim: {
        start: getFrameIndex(this.recording.frames, this.trim.start),
        end: getFrameIndex(this.recording.frames, this.trim.end),
      },
      crop: this.crop,
    });
  }
}
