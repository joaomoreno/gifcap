class GifEncoder {

  static ID = 0;

  constructor(opts) {
    this.opts = opts;
    this.listeners = new Map();

    this.frames = [];
    this.workers = [];
    this.framesSent = 0;
    this.framesReceived = 0;
    this.totalFrames = undefined;
    this.busyWorkers = 0;

    for (let i = 0; i < navigator.hardwareConcurrency; i++) {
      const worker = new Worker('/encoder/worker.js');
      worker.postMessage(opts);

      const onMessage = msg => this._onWorkerMessage(i, msg);
      worker.addEventListener('message', onMessage);
      const dispose = () => worker.removeEventListener('message', onMessage);
      this.workers.push({ worker, busy: false, frameIndex: undefined, dispose });
    }
  }

  addFrame(imageData, delay) {
    if (!this.workers || this.totalFrames !== undefined) {
      return;
    }

    this.frames.push({ buffer: imageData.data.buffer, delay });
    this._work();
  }

  _work() {
    if (!this.workers) {
      return;
    }

    while (this.framesSent < this.frames.length && this.busyWorkers < this.workers.length) {
      const frameIndex = this.framesSent++;
      const frame = this.frames[frameIndex];
      const worker = this.workers[this.workers.findIndex(x => !x.busy)];

      worker.busy = true;
      worker.frameIndex = frameIndex;
      worker.worker.postMessage(frame, { transfer: [frame.buffer] });
      this.busyWorkers++;
    }

    if (this.framesReceived === this.totalFrames) {
      const content = [
        'GIF89a',
        new Uint16Array([this.opts.width, this.opts.height]),
        new Uint8Array([0x70, 255, 0]),
        ...this.frames.map(f => f.buffer),
        ';'
      ];

      const blob = new Blob(content, { type: 'image/gif' });
      this._emit('finished', blob);
      this.dispose();
    }
  }

  _onWorkerMessage(workerIndex, msg) {
    if (!this.workers) {
      return;
    }

    const worker = this.workers[workerIndex];
    const frame = this.frames[worker.frameIndex];

    frame.buffer = msg.data;

    worker.busy = false;
    worker.frameIndex = undefined;
    this.busyWorkers--;
    this.framesReceived++;
    this._emit('progress', this.framesReceived / this.totalFrames);
    this._work();
  }

  render() {
    if (!this.workers) {
      return;
    }

    this.totalFrames = this.frames.length;
    this._work();
  }

  abort() {
    this.dispose();
  }

  dispose() {
    if (!this.workers) {
      return;
    }

    for (const { worker, dispose } of this.workers) {
      worker.terminate();
      dispose();
    }

    this.workers = undefined;
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