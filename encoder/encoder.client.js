class GifEncoder {

  constructor(opts) {
    this.listeners = new Map();
    this.worker = new Promise(c => {
      const worker = new Worker(opts.workerScript);

      worker.addEventListener('message', msg => {
        switch (msg.data.type) {
          case 'ready':
            worker.postMessage({ type: 'init', width: opts.width, height: opts.height });
            c(worker);
            break;
          case 'progress':
            this._emit('progress', msg.data.progress);
            break;
          case 'finished':
            this._emit('finished', msg.data.blob);
            this.worker = null;
            break;
        }
      });
    });
  }

  addFrame(imageData, delay) {
    if (!this.worker) {
      throw new Error('Encoder is disposed');
    }

    this.worker.then(worker => worker.postMessage({ type: 'addFrame', imageData: imageData.data.buffer, delay }, { transfer: [imageData.data.buffer] }));
  }

  encode() {
    if (!this.worker) {
      throw new Error('Encoder is disposed');
    }

    this.worker.then(worker => worker.postMessage({ type: 'encode' }));
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