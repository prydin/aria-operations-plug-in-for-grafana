import { MaxHeap, MinHeap } from '@datastructures-js/heap';

interface Sample {
  timestamp: number;
  value: number;
}

abstract class SlidingAccumulator {
  buffer: (Sample | null)[]; // Ring buffer
  interval: number;
  head = 0;

  constructor(interval: number, resolution: number) {
    this.buffer = new Array<Sample>(interval / resolution);
    this.interval = interval;
  }

  onPush(sample: Sample): void {}

  onEvict(sample: Sample): void {}

  apply(timestamp: number, callback: (s: Sample) => void) {
    for (let i = 0; i < this.buffer.length; ++i) {
      const s = this.buffer[(i + 1) % this.buffer.length];
      if (s && s.timestamp > timestamp - this.interval) {
        callback(s);
      }
    }
  }

  push(timestamp: number, value: number) {
    const sample = { timestamp, value };
    this.head = (this.head + 1) % this.buffer.length;
    const old = this.buffer[this.head];
    this.buffer[this.head] = { timestamp, value };
    this.onPush(sample);
    if (old) {
      this.onEvict(old);
    }
  }

  protected abstract _getValue(timestamp: number): number;

  getValue(timestamp: number): number {
    // Clean out stale entries
    for (let i = 0; i < this.buffer.length; ++i) {
      let p = (i + 1) % this.buffer.length;
      const s = this.buffer[p];
      if (!s) {
        continue;
      }
      if (s.timestamp >= timestamp - this.interval) {
        break;
      }
      this.onEvict(s!);
      this.buffer[p] = null;
    }
    return this._getValue(timestamp);
  }
}

export class SlidingAverage extends SlidingAccumulator {
  sum = 0.0;
  count = 0;

  onPush(sample: Sample): void {
    this.sum += sample.value;
    this.count++;
  }

  onEvict(sample: Sample): void {
    this.sum -= sample.value;
    this.count--;
  }

  _getValue(timestamp: number): number {
    return this.sum / this.count;
  }
}

export class SlidingCount extends SlidingAccumulator {
  count = 0;

  onPush(sample: Sample): void {
    this.count++;
  }

  onEvict(sample: Sample): void {
    this.count--;
  }

  _getValue(timestamp: number): number {
    return this.count;
  }
}

export class SlidingSum extends SlidingAccumulator {
  sum = 0.0;

  onPush(sample: Sample): void {
    this.sum += sample.value;
  }

  onEvict(sample: Sample): void {
    this.sum -= sample.value;
  }

  _getValue(timestamp: number): number {
    return this.sum;
  }
}

export class SlidingMax extends SlidingAccumulator {
  heap = new MaxHeap<number>();
  filled = false;

  onPush(sample: Sample): void {
    this.heap.push(sample.value);
  }

  onEvict(sample: Sample): void {
    // If the heap is full and smallest value is about to get dropped, then pop it from the heap
    if (this.heap.top() == sample.value) {
      this.heap.pop();
    }
  }

  _getValue(timestamp: number): number {
    return this.heap.root() != null ? this.heap.root()! : NaN;
  }
}

export class SlidingMin extends SlidingAccumulator {
  heap = new MinHeap<number>();
  filled = false;

  onPush(sample: Sample): void {
    this.heap.push(sample.value);
  }

  onEvict(sample: Sample): void {
    // If the heap is full and smallest value is about to get dropped, then pop it from the heap
    if (this.heap.top() == sample.value) {
      this.heap.pop();
    }
  }

  _getValue(timestamp: number): number {
    return this.heap.root() != null ? this.heap.root()! : NaN;
  }
}

export class SlidingVariance extends SlidingAccumulator {
  avg = 0.0;
  vAcc = 0.0;
  sum = 0.0;
  count = 0;
  full = false;

  onPush(sample: Sample): void {
    if (this.full) {
      return;
    }
    this.count++;
    if (this.count >= this.buffer.length) {
      this.full = true;
    }

    // Standard algorithm for non-sliding window. Otherwise calculation is done in onEvic
    const v = sample.value;
    this.sum += v;
    const avg = this.sum / this.count;
    this.vAcc += (v - this.avg) * (v - avg);
    this.avg = avg;
  }

  onEvict(sample: Sample): void {
    const current = this.buffer[this.head]?.value || NaN;
    const evicted = sample.value;
    const oldAvg = this.avg;
    this.avg = oldAvg + (current - evicted) / this.count;
    this.vAcc += (current - evicted) * (current - this.avg + evicted - oldAvg);
  }

  getVariance(): number {
    return this.count > 1 ? this.vAcc / (this.count - 1) : 0;
  }

  _getValue(timestamp: number): number {
    return this.getVariance();
  }
}

export class SlidingStdDev extends SlidingVariance {
  _getValue(timestamp: number): number {
    return Math.sqrt(this.getVariance());
  }
}
