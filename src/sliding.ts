import { AvlTree } from '@datastructures-js/binary-search-tree';
import { MaxHeap, MinHeap } from '@datastructures-js/heap';

export const slidingWindowFactories: {
  [key: string]: (size: number, interval: number) => SlidingAccumulator;
} = {
  mavg: (n, i) => new SlidingAverage(n, i),
  msum: (n, i) => new SlidingSum(n, i),
  mmedian: (n, i) => new SlidingMedian(n, i),
  mstddev: (n, i) => new SlidingStdDev(n, i),
  mvariance: (n, i) => new SlidingVariance(n, i),
  mmax: (n, i) => new SlidingMax(n, i),
  mmin: (n, i) => new SlidingMin(n, i),
};

interface Sample {
  timestamp: number;
  value: number;
}

/**
 * Base class for sliding windows
 */
export abstract class SlidingAccumulator {
  /**
   * Samples are kept in a ring buffer with buffer[head] being the most recent
   * and buffer[(head+1)%size] being the oldest
   */
  buffer: Array<Sample | null>;
  head = 0;
  interval = 0;
  pushCount = 0;

  constructor(size: number, interval: number) {
    console.log(
      'Created sliding window, size=' + size + ', interval=' + interval
    );
    this.buffer = new Array<Sample>(size);
    this.interval = interval;
  }

  /**
   * Called when a new sample arrived
   * @param sample
   */
  onPush(sample: Sample): void {}

  /**
   * Called when the ring buffer overflows and an old entry is evicted
   * @param sample
   */
  onEvict(sample: Sample): void {}

  /**
   * Add a new sample to the sliding window handler
   * @param timestamp
   * @param value
   */
  push(timestamp: number, value: number) {
    const sample = { timestamp, value };
    this.head = (this.head + 1) % this.buffer.length;
    const old = this.buffer[this.head];
    this.buffer[this.head] = { timestamp, value };
    ++this.pushCount;
    this.onPush(sample);
    if (old) {
      this.onEvict(old);
    }
  }

  /**
   * Pushes a sample and immediately gets the update result from the algorithm.
   * @param timestamp
   * @param value
   * @returns The latest value at the head of the window
   */
  pushAndGet(timestamp: number, value: number): number {
    this.push(timestamp, value);
    return this.getValue(timestamp);
  }

  protected abstract _getValue(timestamp: number): number;

  /**
   * Return the calculated value at a point in time
   * @param timestamp
   * @returns
   */
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

/**
 * Sliding window average
 */
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

/**
 * Sliding window sum
 */
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

/**
 * Sliding window max. Uses a heap to keep track of the largest value,
 * as well as when to adjust the maximum when the largest sample
 * exits the sliding window
 */
export class SlidingMax extends SlidingAccumulator {
  heap = new MaxHeap<number>();
  filled = false;

  onPush(sample: Sample): void {
    this.heap.push(sample.value);
  }

  onEvict(sample: Sample): void {
    // If the heap is full and smallest value is about to get dropped, then pop it from the heap
    if (this.heap.top() === sample.value) {
      this.heap.pop();
    }
  }

  _getValue(timestamp: number): number {
    return this.heap.root() != null ? this.heap.root()! : NaN;
  }
}

/**
 * Sliding window min. Uses a heap to keep track of the smalles value,
 * as well as when to adjust the minimum when the smallest sample
 * exits the sliding window
 */
export class SlidingMin extends SlidingAccumulator {
  heap = new MinHeap<number>();
  filled = false;

  onPush(sample: Sample): void {
    this.heap.push(sample.value);
  }

  onEvict(sample: Sample): void {
    // If the heap is full and smallest value is about to get dropped, then pop it from the heap
    if (this.heap.top() === sample.value) {
      this.heap.pop();
    }
  }

  _getValue(timestamp: number): number {
    return this.heap.root() != null ? this.heap.root()! : NaN;
  }
}

/**
 * Slding window variance
 */
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

    // Welford's method. The stock version of this is used when the windows isn't full. Once
    // the window fills up, the calculation takes place in onEvict.
    // https://en.wikipedia.org/wiki/Algorithms_for_calculating_variance#Welford's_online_algorithm
    const v = sample.value;
    this.sum += v;
    const avg = this.sum / this.count;
    this.vAcc += (v - this.avg) * (v - avg);
    this.avg = avg;
  }

  onEvict(sample: Sample): void {
    // Slightly modified version of Welford's method that allows us to remove
    // values that are out of scope.
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

/**
 * Sliding standard deviation
 */
export class SlidingStdDev extends SlidingVariance {
  _getValue(timestamp: number): number {
    return Math.sqrt(this.getVariance());
  }
}

interface BagNode {
  value: number;
  count: number;
}

/**
 * A simple implementation of a sorted Bag (multiset). This is an extension to a Set
 * allowing multiple identical values to be added and removed.
 */
export class SortedBag {
  map = new AvlTree<BagNode>((a, b) => a.value - b.value, { key: 'value' });
  size = 0;

  /**
   * Constructs a new SortedBag
   * @param descending If set, the larges value will be at the top of the bag
   */
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

  /**
   * Adds a value to the bag
   * @param value
   */
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

  /**
   * Removes a value from the bag
   * @param value
   * @returns True if the value was found and removed
   */
  remove(value: number): boolean {
    let node = this.map.findKey(value)?.getValue();
    if (!node) {
      return false;
    }
    node.count--;
    if (node.count === 0) {
      this.map.remove(node);
    }
    this.size--;
    return true;
  }

  /**
   * Returns the top value and removes it from the Bag
   * @returns The top value
   */
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

/**
 * Sliding median. Uses the "dual heap" algorithm. It works as follows.
 * Two heaps are kept, one sorted ascending (minHeap) and the other
 * sorted descending (maxHeap).
 * 1.  Values that are smaller than the greatest value on maxHeap are pushed
 * to maxHeap, otherwise it's pushed to minHeap.
 * 2. The following invariant is maintained:
 * minHeap.size <= maxHeap.size <= minHeap.size + 1.
 *
 * This partitions the list in two and the median can easily be obtained
 * by looking at the top of the heaps. By convention, if both heaps are
 * of equal size, the average of the top value from both heaps is returned.
 */
export class SlidingMedian extends SlidingAccumulator {
  minHeap = new SortedBag(false);

  maxHeap = new SortedBag(true);

  /**
   * Make sure the invariants described above are maintained.
   */
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
    if (v <= this.maxHeap.top()!) {
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
    if (this.maxHeap.size === 0) {
      return NaN;
    }

    if (this.minHeap.size === this.maxHeap.size) {
      return (this.minHeap.top()! + this.maxHeap.top()!) / 2;
    }
    return this.maxHeap.top()!;
  }
}
