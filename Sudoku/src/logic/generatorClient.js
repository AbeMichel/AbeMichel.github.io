export class GeneratorClient {
  constructor() {
    this._worker = new Worker(new URL('./generatorWorker.js', import.meta.url), { type: 'module' });
    this._resolve = null;
    this._reject = null;
    this._onProgress = null;
    this._worker.onmessage = (e) => {
      const { type, payload } = e.data;
      if (type === 'DEBUG') return;
      if (type === 'PROGRESS' && this._onProgress) this._onProgress(payload.percent);
      else if (type === 'COMPLETE') { this._resolve?.(payload); this._resolve = null; }
      else if (type === 'ERROR') { this._reject?.(new Error(payload.message)); this._reject = null; }
    };
  }

  generate(seed, difficulty, onProgress) {
    this._onProgress = onProgress || null;
    return new Promise((resolve, reject) => {
      this._resolve = resolve;
      this._reject = reject;
      this._worker.postMessage({ type: 'GENERATE', payload: { seed, difficulty } });
    });
  }

  terminate() {
    this._worker.terminate();
  }
}
