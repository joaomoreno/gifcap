import m from "mithril";
import { App, Frame } from "../gifcap";
import Button from "../components/button";
import Timer from "../components/timer";
import View from "../components/view";

interface RecordViewAttrs {
  readonly app: App;
  readonly captureStream: MediaStream;
}

export default class RecordView implements m.ClassComponent<RecordViewAttrs> {
  private readonly app: App;
  private readonly captureStream: MediaStream;

  private startTime: number = 0;
  private width: number = 0;
  private height: number = 0;
  private frames: Frame[] = [];
  private stopped = false;
  private _onbeforeremove: Function | undefined;

  constructor(vnode: m.CVnode<RecordViewAttrs>) {
    this.app = vnode.attrs.app;
    this.captureStream = vnode.attrs.captureStream;
  }

  async oncreate(vnode: m.VnodeDOM<RecordViewAttrs, this>) {
    const video: HTMLVideoElement = vnode.dom.getElementsByTagName("video")[0];
    const canvas: HTMLCanvasElement = vnode.dom.getElementsByTagName("canvas")[0];

    video.srcObject = this.captureStream;

    const ctx = canvas.getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

    // on HiDPI (Retina) screens, the capture is at device pixels; by default scale it down to CSS pixels,
    // which cuts memory 4x (frames are kept uncompressed until rendering)
    const scale = this.app.fullResolution ? 1 : 1 / (window.devicePixelRatio || 1);

    const worker = new Worker("/dist/ticker.js");
    worker.postMessage(this.app.frameLength);
    worker.onmessage = () => {
      if (video.videoWidth === 0 || this.stopped) {
        return;
      }

      const first = this.startTime === 0;

      if (first) {
        const width = Math.round(video.videoWidth * scale);
        const height = Math.round(video.videoHeight * scale);

        this.startTime = Date.now();
        this.width = width;
        this.height = height;
        canvas.width = width;
        canvas.height = height;
        ctx.imageSmoothingQuality = "high"; // resizing the canvas resets the context state
      }

      ctx.drawImage(video, 0, 0, this.width, this.height);

      let imageData: ImageData;
      try {
        imageData = ctx.getImageData(0, 0, this.width, this.height);
      } catch (err) {
        // out of memory: keep what was recorded, minus the last second, to leave room for preview and rendering
        console.error(err);
        this.frames.splice(-Math.round(1000 / this.app.frameLength));
        this.stopRecording(true);
        return;
      }

      this.frames.push({
        imageData,
        timestamp: first ? 0 : Date.now() - this.startTime,
      });
    };

    const redrawInterval = setInterval(() => m.redraw(), this.app.frameLength);

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
      m(View, [
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

  private stopRecording(outOfMemory = false): void {
    if (this.stopped) {
      return;
    }

    this.stopped = true;
    this.app.stopRecording({
      width: this.width,
      height: this.height,
      frames: this.frames,
      outOfMemory,
    });
  }
}
