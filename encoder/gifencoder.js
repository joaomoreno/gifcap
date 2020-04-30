class GifEncoder {

  static ID = 0;

  constructor(opts) {
    this.opts = opts;
    this.listeners = new Map();
    this.frames = [];
    this.imageData = [];
  }

  addFrame(imageData, delay) {
    this.frames.push({ imageData: imageData.data.buffer, delay });
    this.imageData.push(imageData.data.buffer);
  }

  render() {
    if (this.worker) {
      return;
    }

    this.worker = new Worker('/encoder/worker.js');

    this.worker.addEventListener('message', msg => {
      switch (msg.data.type) {
        case 'progress':
          this._emit('progress', msg.data.progress);
          break;
        case 'finished':
          this.worker = null;
          this._emit('finished', msg.data.blob);
          break;
      }
    });

    this.worker.postMessage({ frames: this.frames, ...this.opts }, { transfer: this.imageData });

    this.imageData = [];
    this.delays = [];
  }

  abort() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }

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