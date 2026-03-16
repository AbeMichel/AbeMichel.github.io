export class HumanSolverClient {
  constructor() {
    this.worker = null;
    this.queue = [];
    this.busy = false;
  }

  _initWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./humanSolver.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        this.busy = false;
        const result = e.data.payload;
        const resolve = this.queue.shift();
        if (resolve) resolve(result);
        this._processQueue();
      };
    }
  }

  _processQueue() {
    if (this.busy || this.queue.length === 0) return;
    this.busy = true;
    const { type, payload } = this.queue[0].request;
    this._initWorker();
    this.worker.postMessage({ type, payload });
  }

  _enqueue(request) {
    return new Promise((resolve) => {
      const queuedItem = (res) => resolve(res);
      queuedItem.request = request;
      this.queue.push(queuedItem);
      this._processQueue();
    });
  }

  grade(cells, regions) {
    return this._enqueue({ type: 'GRADE', payload: { cells, regions } });
  }

  hintNextCell(cells, regions) {
    return this._enqueue({ type: 'HINT_NEXT_CELL', payload: { cells, regions } });
  }

  hintNextTechnique(cells, regions) {
    return this._enqueue({ type: 'HINT_NEXT_TECHNIQUE', payload: { cells, regions } });
  }
}

export const humanSolver = new HumanSolverClient();
