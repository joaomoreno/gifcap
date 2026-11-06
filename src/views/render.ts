import m from "mithril";
import { App, Recording, RenderOptions } from "../gifcap";
import Button from "../components/button";
import View from "../components/view";

interface RenderViewAttrs {
  readonly app: App;
  readonly recording: Recording;
  readonly renderOptions: RenderOptions;
}

export default class RenderView implements m.ClassComponent<RenderViewAttrs> {
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

    let aborted = false;
    this._onbeforeremove = () => {
      aborted = true;
      gif.abort();
    };

    // frames are fed only as fast as they get quantized, so feeding progress tracks encoding progress
    const start = this.renderOptions.trim.start;
    const end = this.renderOptions.trim.end;
    const setProgress = (progress: number) => {
      this.progress = Math.max(this.progress, progress);
      m.redraw();
    };
    gif.on("progress", setProgress);

    gif.once("finished", (blob) => {
      const url = URL.createObjectURL(blob);
      const duration =
        this.recording.frames[this.renderOptions.trim.end].timestamp -
        this.recording.frames[this.renderOptions.trim.start].timestamp +
        this.app.frameLength;

      this.app.finishRendering({ blob, url, duration, size: blob.size });
    });

    const ctx = vnode.dom.getElementsByTagName("canvas")[0].getContext("2d", { willReadFrequently: true }) as CanvasRenderingContext2D;

    const processFrame = (index: number) => {
      if (aborted) {
        return;
      }

      if (index > end) {
        gif.render();
        return;
      }

      // backpressure: wait for quantizers to catch up, so frame copies don't accumulate in memory
      if (gif.isBusy) {
        setTimeout(() => processFrame(index), 10);
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

      const delay =
        index < end
          ? this.recording.frames[index + 1].timestamp - frame.timestamp
          : this.app.frameLength;
      gif.addFrame(imageData, delay);
      setProgress((index - start) / (end - start + 1));
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
      m(View, { actions }, [
        m(
          "progress",
          { max: "1", value: this.progress, title: "Rendering..." },
          `Rendering: ${Math.floor(this.progress * 100)}%`
        ),
        m("canvas.hidden", {
          width: this.recording.width,
          height: this.recording.height
        }),
      ]),
    ];
  }

  onbeforeremove(): void {
    this._onbeforeremove && this._onbeforeremove();
  }
}
