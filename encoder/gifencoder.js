class GifEncoder {

  constructor(opts) {
    this.opts = opts;
    this.listeners = new Map();

    this.frames = [];
    this.quantizers = [];
    this.framesSentToQuantize = 0;
    this.framesQuantized = 0;
    this.framesSentToEncode = 0;
    this.totalFrames = undefined;
    this.busyQuantizers = 0;

    this.writer = new Worker('/encoder/writer.js');
    this.writer.postMessage(opts);

    const onMessage = msg => this._onWriterMessage(msg);
    this.writer.addEventListener('message', onMessage);
    this.disposeWriter = () => this.writer.removeEventListener('message', onMessage);

    const numberOfWorkers = Math.floor(navigator.hardwareConcurrency * 0.8);
    for (let i = 0; i < numberOfWorkers; i++) {
      const worker = new Worker('/encoder/quantizer.js');
      worker.postMessage(opts);

      const onMessage = msg => this._onQuantizerMessage(i, msg);
      worker.addEventListener('message', onMessage);
      const dispose = () => worker.removeEventListener('message', onMessage);
      this.quantizers.push({ worker, busy: false, frameIndex: undefined, dispose });
    }
  }

  addFrame(imageData, delay) {
    if (!this.quantizers || this.totalFrames !== undefined) {
      return;
    }

    this.frames.push({ buffer: imageData.data.buffer, paletteLength: undefined, delay, quantized: false });
    this._work();
  }

  _work() {
    if (!this.quantizers) {
      return;
    }

    while (this.framesSentToQuantize < this.frames.length && this.busyQuantizers < this.quantizers.length) {
      const frameIndex = this.framesSentToQuantize++;
      const frame = this.frames[frameIndex];
      const worker = this.quantizers[this.quantizers.findIndex(x => !x.busy)];

      worker.busy = true;
      worker.frameIndex = frameIndex;
      worker.worker.postMessage(frame, { transfer: [frame.buffer] });
      this.busyQuantizers++;
    }
  }

  _onQuantizerMessage(workerIndex, msg) {
    if (!this.quantizers) {
      return;
    }

    const worker = this.quantizers[workerIndex];
    worker.busy = false;
    this.busyQuantizers--;
    this.framesQuantized++;

    const frame = this.frames[worker.frameIndex];
    frame.buffer = msg.data.buffer;
    frame.paletteLength = msg.data.paletteLength;
    frame.quantized = true;

    while ((this.totalFrames === undefined || this.framesSentToEncode < this.totalFrames) && this.frames[this.framesSentToEncode].quantized) {
      const frameIndex = this.framesSentToEncode++;
      const { buffer, paletteLength, delay } = this.frames[frameIndex];
      this.writer.postMessage({ buffer, paletteLength, delay }, { transfer: [buffer] });
      this.frames[frameIndex] = undefined; // gc
    }

    if (this.framesSentToEncode === this.totalFrames) {
      this.writer.postMessage('finish', { transfer: [] });
    }

    this._emit('progress', this.framesSentToEncode / this.totalFrames);
    this._work();
  }

  _onWriterMessage(msg) {
    const blob = new Blob([msg.data], { type: 'image/gif' });
    this._emit('finished', blob);
    this.dispose();
  }

  render() {
    if (!this.quantizers) {
      return;
    }

    this.totalFrames = this.frames.length;
    this._work();
  }

  abort() {
    this.dispose();
  }

  dispose() {
    if (!this.quantizers) {
      return;
    }

    this.writer.terminate();
    this.disposeWriter();

    for (const { worker, dispose } of this.quantizers) {
      worker.terminate();
      dispose();
    }

    this.quantizers = undefined;
    this.frames = undefined;
  }

  // event listener

  on(event, fn) {
    let listeners = this.listeners.get(event);

    if (!listeners) {
      listeners = [];
      this.listeners.set(event, listeners);
    }

    listeners.push(fn);
    return () => listeners.splice(listeners.indexOf(fn), 1);
  }

  once(event, fn) {
    const remove = this.on(event, data => {
      fn(data);
      remove();
    });
  }

  _emit(event, data) {
    const listeners = this.listeners.get(event) || [];

    for (const listener of listeners) {
      listener(data);
    }
  }
}