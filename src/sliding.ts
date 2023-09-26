import { AvlTree } from '@datastructures-js/binary-search-tree';
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

interface BagNode {
  value: number;
  count: number;
}

export class SortedBag {
  map = new AvlTree<BagNode>((a, b) => a.value - b.value, { key: 'value' });
  size = 0;

  constructor(descending: boolean) {
    if (descending) {
      this.map = new AvlTree<BagNode>((a, b) => b.value - a.value, {
        key: 'value',
      });
    } else {
      this.map = new AvlTree<BagNode>((a, b) => a.value - b.value, {
        key: 'value',
      });
    }
  }

  push(value: number) {
    let node = this.map.findKey(value)?.getValue();
    if (node == null) {
      node = { value, count: 1 };
      this.map.insert(node);
    } else {
      node.count++;
    }
    this.size++;
  }

  remove(value: number): boolean {
    let node = this.map.findKey(value)?.getValue();
    if (!node) {
      return false;
    }
    node.count--;
    if (node.count == 0) {
      this.map.remove(node);
    }
    this.size--;
    return true;
  }

  pop(): number | null {
    const node = this.map.min()?.getValue();
    if (!node) {
      return null;
    }
    this.remove(node.value);
    return node.value;
  }

  top(): number | undefined {
    return this.map.min()?.getValue()?.value;
  }
}

export class SlidingMedian extends SlidingAccumulator {
  minHeap = new SortedBag(false);

  maxHeap = new SortedBag(true);

  rebalance() {
    while (this.maxHeap.size > this.minHeap.size + 1) {
      this.minHeap.push(this.maxHeap.pop()!);
    }
    while (this.minHeap.size > this.maxHeap.size) {
      this.maxHeap.push(this.minHeap.pop()!);
    }
  }

  onPush(sample: Sample) {
    const v = sample.value;
    if (v <= -this.maxHeap.top()!) {
      this.maxHeap.push(v);
    } else {
      this.minHeap.push(v);
    }
    this.rebalance();
  }

  onEvict(sample: Sample): void {
    if (!this.minHeap.remove(sample.value)) {
      this.maxHeap.remove(sample.value);
    }
    this.rebalance();
  }

  protected _getValue(timestamp: number): number {
    if (this.maxHeap.size == 0) {
      return NaN;
    }
    if (this.minHeap.size == this.maxHeap.size) {
      return (this.minHeap.top()! + this.maxHeap.top()!) / 2;
    }
    return this.maxHeap.top()!;
  }
}
