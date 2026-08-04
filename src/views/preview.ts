import m from "mithril";
import { App, Frame, Recording, Rect, Range, RenderOptions } from "../gifcap";
import { FadeMode, FadeOptions, defaultFadeOptions, getFadeFactor } from "../fade";
import Button from "../components/button";
import View from "../components/view";

const MIN_FADE_DURATION_MS = 100;
// Worst case is fade mode "both" at the MIN_FADE_DURATION_MS floor: 100ms in
// + 100ms out = 200ms of fade. Requiring the clip to be at least 4x that
// keeps combined fade time to at most 50% of the clip, so it can't strobe.
const MIN_CLIP_LENGTH_FOR_FADE_MS = 4 * MIN_FADE_DURATION_MS;
const roundDownToTenthSecond = (ms: number): number => Math.floor(ms / 100) * 100;

interface Viewport extends Rect {
  scale: number;
}

interface Point {
  x: number;
  y: number;
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
const dpr = window.devicePixelRatio || 1;

interface PreviewViewAttrs {
  readonly app: App;
  readonly recording: Recording;
  readonly renderOptions?: RenderOptions;
}

export default class PreviewView implements m.ClassComponent<PreviewViewAttrs> {
  private readonly app: App;
  private readonly recording: Recording;
  private readonly duration: number;

  private sourceCanvas!: HTMLCanvasElement;
  private sourceCtx!: CanvasRenderingContext2D;
  private canvas!: HTMLCanvasElement;
  private ctx!: CanvasRenderingContext2D;
  private matrix!: DOMMatrix;

  private playbar!: HTMLDivElement;
  private content!: HTMLDivElement;
  private viewportDisposable!: Function;

  private mouse: Point;
  private viewport: Viewport;
  private initialScale!: number;
  private playback: Playback;
  private trim: Range;
  private crop: Rect;
  private fade: FadeOptions;
  private fadeDurationInput: string = "1";

  private didDraw = false;
  private didResize = false;

  constructor(vnode: m.CVnode<PreviewViewAttrs>) {
    this.app = vnode.attrs.app;
    this.recording = vnode.attrs.recording;
    this.duration = this.recording.frames[this.recording.frames.length - 1].timestamp + this.app.frameLength;
    this.mouse = { x: 0, y: 0 };
    this.viewport = { width: 0, height: 0, top: 0, left: 0, scale: 1 };

    const trimStart = vnode.attrs.renderOptions
      ? this.recording.frames[vnode.attrs.renderOptions.trim.start].timestamp
      : 0;
    const trimEnd = vnode.attrs.renderOptions
      ? this.recording.frames[vnode.attrs.renderOptions.trim.end].timestamp
      : this.duration;

    this.playback = { head: trimStart, start: trimStart, offset: 0, end: trimEnd, disposable: noop };
    this.trim = { start: trimStart, end: trimEnd };
    this.crop = vnode.attrs.renderOptions?.crop ?? {
      top: 0,
      left: 0,
      width: this.recording.width,
      height: this.recording.height,
    };
    this.fade = vnode.attrs.renderOptions?.fade ?? { ...defaultFadeOptions };
    this.fadeDurationInput = `${this.fade.durationMs / 1000}`;
  }

  private get isPlaying() {
    return this.playback.disposable !== noop;
  }

  private get maxFadeDurationMs(): number {
    const rangeLength = this.trim.end - this.trim.start;
    return this.fade.mode === "both" ? rangeLength / 2 : rangeLength;
  }

  private get fadeAvailable(): boolean {
    return this.trim.end - this.trim.start >= MIN_CLIP_LENGTH_FOR_FADE_MS;
  }

  private get effectiveFade(): FadeOptions {
    return this.fadeAvailable ? this.fade : { ...this.fade, mode: "none" };
  }

  // Keeps durationMs (and its text input) in sync with maxFadeDurationMs,
  // which changes whenever the trim range or fade mode changes ("both"
  // halves the available duration vs. "in"/"out"). Call after any change
  // to trim or mode so the displayed duration is never stale.
  private clampFadeDuration(): void {
    if (this.fade.durationMs <= this.maxFadeDurationMs) {
      return;
    }

    const rounded = roundDownToTenthSecond(this.maxFadeDurationMs); // round down to nearest 0.1s, never exceed max
    const clamped = Math.max(MIN_FADE_DURATION_MS, rounded);
    this.fade = { ...this.fade, durationMs: clamped };
    this.fadeDurationInput = `${clamped / 1000}`;
  }

  async oncreate(vnode: m.VnodeDOM<PreviewViewAttrs, this>) {
    this.sourceCanvas = vnode.dom.querySelector("canvas.source")!;
    this.sourceCtx = this.sourceCanvas.getContext("2d")!;
    this.canvas = vnode.dom.querySelector("canvas.target")!;
    this.ctx = this.canvas.getContext("2d")!;
    this.matrix = this.ctx.getTransform();
    this.playbar = vnode.dom.querySelector(".playbar")!;
    this.content = vnode.dom.querySelector(".content")!;

    const viewportListener = () => this.onDidResize();
    window.addEventListener("resize", viewportListener);
    this.viewportDisposable = () => window.removeEventListener("resize", viewportListener);
    this.onDidResize();
    this.zoomToFit();

    setTimeout(() => this.play());
  }

  private zoomToFit() {
    this.viewport.top = (this.recording.height - this.viewport.height * dpr) / -2;
    this.viewport.left = (this.recording.width - this.viewport.width * dpr) / -2;
    this.initialScale = Math.max(
      0.1,
      Math.min(
        1,
        (this.viewport.width * dpr * 0.95) / this.recording.width,
        (this.viewport.height * dpr * 0.95) / this.recording.height
      )
    );
  }

  private onDidResize() {
    const width = Math.floor(this.content.clientWidth);
    const height = Math.floor(this.content.clientHeight);
    this.viewport.left += Math.round((width - this.viewport.width) / this.viewport.scale / 2);
    this.viewport.top += Math.round((height - this.viewport.height) / this.viewport.scale / 2);
    this.viewport.width = width;
    this.viewport.height = height;
    this.didResize = true;
    m.redraw();
  }

  onbeforeremove() {
    this.pause();
    this.viewportDisposable();
  }

  view() {
    const fadeAvailable = this.fadeAvailable;

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
      m(".fade-controls", [
        m(
          "select",
          {
            title: "Fade",
            value: this.fade.mode,
            disabled: !fadeAvailable,
            onchange: (e: Event) => {
              this.fade = { ...this.fade, mode: (e.target as HTMLSelectElement).value as FadeMode };
              this.clampFadeDuration();
            },
          },
          [
            m("option", { value: "none" }, "No fade"),
            m("option", { value: "in" }, "Fade in"),
            m("option", { value: "out" }, "Fade out"),
            m("option", { value: "both" }, "Fade in & out"),
          ]
        ),
        this.fade.mode !== "none" &&
          !fadeAvailable &&
          m("span.fade-unavailable", "Clip too short for fade"),
        this.fade.mode !== "none" &&
          fadeAvailable &&
          m(".fade-duration", [
            m("input", {
              type: "number",
              title: "Fade length (seconds)",
              min: MIN_FADE_DURATION_MS / 1000,
              max: this.maxFadeDurationMs / 1000,
              step: 0.1,
              value: this.fadeDurationInput,
              oninput: (e: InputEvent) => {
                this.fadeDurationInput = (e.target as HTMLInputElement).value;
                const value = (e.target as HTMLInputElement).valueAsNumber;
                if (Number.isFinite(value) && value > 0) {
                  this.fade = { ...this.fade, durationMs: Math.round(value * 1000) };
                }
              },
              onchange: (e: InputEvent) => {
                const value = (e.target as HTMLInputElement).valueAsNumber;
                const rawMs = Number.isFinite(value) && value > 0 ? value * 1000 : this.fade.durationMs;
                const rounded = Math.round(rawMs / 100) * 100;
                const maxRounded = roundDownToTenthSecond(this.maxFadeDurationMs); // never exceed real max after rounding
                const clamped = Math.max(MIN_FADE_DURATION_MS, Math.min(rounded, maxRounded));
                this.fade = { ...this.fade, durationMs: clamped };
                this.fadeDurationInput = `${clamped / 1000}`;
              },
            }),
            m("span.fade-duration-suffix", "s"),
            m("span.fade-duration-max", `max ${(roundDownToTenthSecond(this.maxFadeDurationMs) / 1000).toFixed(1)}s`),
          ]),
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

    return [
      m(
        View,
        {
          actions,
          contentClass: "crop",
          contentProps: {
            onmousemove: (e: MouseEvent) => this.onMouseMove(e),
            onmousedown: (e: MouseEvent) => this.onMouseDown(e),
            oncontextmenu: (e: MouseEvent) => e.preventDefault(),
          },
        },
        [
          m("canvas", {
            class: "source",
            width: this.recording.width,
            height: this.recording.height,
          }),
          m("canvas", {
            class: "target",
            width: Math.floor(this.viewport.width * dpr),
            height: Math.floor(this.viewport.height * dpr),
            onwheel: (e: WheelEvent) => this.onContentWheel(e),
          }),
        ]
      ),
    ];
  }

  onTrimMouseDown(handle: "start" | "end", event: MouseEvent) {
    event.preventDefault();

    const wasPlaying = this.isPlaying;
    const head = this.playback.head;
    this.pause();

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
      this.playback.head = head;
      this.trim[handle] = Math.max(start.min, Math.min(start.max, head));

      m.redraw();
    };

    const onMouseUp = () => {
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseup", onMouseUp);

      this.playback.start = this.trim.start;
      this.playback.end = this.trim.end;

      if (wasPlaying) {
        this.playback.head = this.trim.start;
        this.play();
      } else {
        this.playback.head = Math.max(this.playback.start, Math.min(this.playback.end, head));
      }

      this.clampFadeDuration();

      m.redraw();
    };

    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);
  }

  onContentWheel(event: WheelEvent) {
    event.preventDefault();

    const scaleDelta = Math.pow(1.1, -event.deltaY / 90);
    this.setScale(this.viewport.scale * scaleDelta, this.mouse);
    this.drawFrame();
  }

  private setScale(
    scale: number,
    reference: Point = { x: this.viewport.width / 2, y: this.viewport.height / 2 }
  ): void {
    scale = Math.max(0.2, Math.min(3, scale));

    const delta = scale / this.viewport.scale;
    const M = this.matrix.inverse();
    const mouse = M.transformPoint({ x: reference.x * dpr, y: reference.y * dpr });

    this.ctx.translate(mouse.x, mouse.y);
    this.ctx.scale(delta, delta);
    this.ctx.translate(-mouse.x, -mouse.y);

    this.matrix = this.ctx.getTransform();
    this.viewport.scale = scale;
  }

  private onMouseMove(event: MouseEvent) {
    this.mouse.x = event.clientX;
    this.mouse.y = event.clientY;
  }

  private onMouseDown(event: MouseEvent) {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || event.button > 0) {
      this.onViewportMove(event);
    } else {
      this.onCrop(event);
    }
  }

  private onCrop(event: MouseEvent) {
    const M = this.matrix.inverse();
    const point = (event: MouseEvent) => {
      const p = M.transformPoint({ x: event.clientX * dpr, y: event.clientY * dpr });

      return {
        x: Math.max(Math.min(Math.floor(p.x) - this.viewport.left, this.recording.width), 0),
        y: Math.max(Math.min(Math.floor(p.y) - this.viewport.top, this.recording.height), 0),
      };
    };

    const from = point(event);
    let didMove = false;

    const onMouseMove = (event: MouseEvent) => {
      const to = point(event);
      this.crop.top = Math.floor(Math.max(0, Math.min(from.y, to.y)));
      this.crop.left = Math.floor(Math.max(0, Math.min(from.x, to.x)));
      this.crop.width = Math.floor(Math.min(this.recording.width - this.crop.left, Math.abs(from.x - to.x)));
      this.crop.height = Math.floor(Math.min(this.recording.height - this.crop.top, Math.abs(from.y - to.y)));

      didMove = true;
      m.redraw();
    };

    const onMouseUp = (event: MouseEvent) => {
      event.preventDefault();
      document.body.removeEventListener("mousemove", onMouseMove);
      document.body.removeEventListener("mouseup", onMouseUp);

      if (!didMove || this.crop.width < 10 || this.crop.height < 10) {
        this.crop.top = 0;
        this.crop.left = 0;
        this.crop.width = this.recording.width;
        this.crop.height = this.recording.height;
      }

      m.redraw();
    };

    event.preventDefault();
    document.body.addEventListener("mousemove", onMouseMove);
    document.body.addEventListener("mouseup", onMouseUp);
  }

  private onViewportMove(event: MouseEvent) {
    const M = this.matrix.inverse();
    const point = (event: MouseEvent) => {
      const p = M.transformPoint({ x: event.clientX * dpr, y: event.clientY * dpr });
      return { x: Math.floor(p.x), y: Math.floor(p.y) };
    };

    const start = {
      top: this.viewport.top,
      left: this.viewport.left,
      point: point(event),
    };

    const onMouseMove = (event: MouseEvent) => {
      const p = point(event);
      this.viewport.top = start.top + p.y - start.point.y;
      this.viewport.left = start.left + p.x - start.point.x;
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

    const index = getFrameIndex(this.recording.frames, this.playback.head);
    this.ctx.putImageData(this.recording.frames[index].imageData, 0, 0);
  }

  play() {
    this.playback.disposable();

    let handle: number | undefined = undefined;

    this.playback.head = Math.max(this.playback.start, Math.min(this.playback.end, this.playback.head));
    this.playback.offset = Date.now() - this.playback.head + this.playback.start;

    const draw = () => {
      this.playback.head =
        this.playback.start + ((Date.now() - this.playback.offset) % (this.playback.end - this.playback.start));

      m.redraw();
      handle = requestAnimationFrame(draw);
    };

    handle = requestAnimationFrame(draw);
    this.playback.disposable = () => cancelAnimationFrame(handle!);
  }

  onupdate(): void {
    if (this.didResize) {
      this.ctx.setTransform(this.matrix);
      this.didResize = false;
    }

    this.drawFrame();
  }

  private drawFrame(): void {
    if (!this.didDraw && this.initialScale !== 1) {
      this.setScale(this.initialScale);
    }

    const index = getFrameIndex(this.recording.frames, this.playback.head);
    const frame = this.recording.frames[index];
    this.sourceCtx.putImageData(frame.imageData, 0, 0);

    const transform = this.ctx.getTransform();
    this.ctx.setTransform();
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.ctx.setTransform(transform);
    this.ctx.drawImage(this.sourceCanvas, this.viewport.left, this.viewport.top);

    // Live fade preview: fade.ts is the single source of truth for fade
    // timing, shared with render.ts, so the two can never drift apart.
    // Both frame and range are snapped to actual frame timestamps here,
    // matching exactly what render.ts uses, so a static displayed frame
    // never darkens/lightens mid-display and the trim boundaries can't
    // shift between preview and export.
    const trimStartIndex = getFrameIndex(this.recording.frames, this.trim.start);
    const trimEndIndex = getFrameIndex(this.recording.frames, this.trim.end);
    const fadeFactor = getFadeFactor(
      frame.timestamp,
      this.recording.frames[trimStartIndex].timestamp,
      this.recording.frames[trimEndIndex].timestamp,
      this.effectiveFade
    );
    if (fadeFactor > 0) {
      this.ctx.fillStyle = "black";
      this.ctx.globalAlpha = fadeFactor;
      this.ctx.fillRect(this.viewport.left, this.viewport.top, this.recording.width, this.recording.height);
      this.ctx.globalAlpha = 1;
    }

    if (
      this.crop.top !== 0 ||
      this.crop.left !== 0 ||
      this.crop.width !== this.recording.width ||
      this.crop.height !== this.recording.height
    ) {
      this.ctx.beginPath();
      this.ctx.moveTo(this.viewport.left, this.viewport.top);
      this.ctx.lineTo(this.viewport.left + this.recording.width, this.viewport.top);
      this.ctx.lineTo(this.viewport.left + this.recording.width, this.viewport.top + this.recording.height);
      this.ctx.lineTo(this.viewport.left, this.viewport.top + this.recording.height);
      this.ctx.lineTo(this.viewport.left, this.viewport.top);
      this.ctx.closePath();
      this.ctx.moveTo(this.viewport.left + this.crop.left, this.viewport.top + this.crop.top);
      this.ctx.lineTo(this.viewport.left + this.crop.left, this.viewport.top + this.crop.top + this.crop.height);
      this.ctx.lineTo(
        this.viewport.left + this.crop.left + this.crop.width,
        this.viewport.top + this.crop.top + this.crop.height
      );
      this.ctx.lineTo(this.viewport.left + this.crop.left + this.crop.width, this.viewport.top + this.crop.top);
      this.ctx.lineTo(this.viewport.left + this.crop.left, this.viewport.top + this.crop.top);
      this.ctx.closePath();
      this.ctx.fillStyle = "#00000055";
      this.ctx.fill();
    }

    this.didDraw = true;
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
      fade: this.effectiveFade,
    });
  }
}
