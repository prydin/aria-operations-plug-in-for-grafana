/*
Aria Operations plug-in for Grafana
Copyright 2023 VMware, Inc.

The BSD-2 license (the "License") set forth below applies to all parts of the 
Aria Operations plug-in for Grafana project. You may not use this file except 
in compliance with the License.

BSD-2 License

Redistribution and use in source and binary forms, with or without 
modification, are permitted provided that the following conditions are met:

Redistributions of source code must retain the above copyright notice, 
this list of conditions and the following disclaimer.

Redistributions in binary form must reproduce the above copyright notice, this
list of conditions and the following disclaimer in the documentation and/or 
other materials provided with the distribution.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED 
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE 
DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE 
FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL 
DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR 
SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER 
CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, 
OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
*/

import { AvlTree } from '@datastructures-js/binary-search-tree';
import { MaxHeap, MinHeap } from '@datastructures-js/heap';

/*eslint no-unused-vars: ["error", { "args": "none" }]*/

export interface Smoother {
  push: (value: number, timestamp: number) => void;
  pushAndGet: (value: number, timestamp: number) => Sample;
  getValue: () => Sample;
}

export const smootherFactories: {
  [key: string]: (
    resolution: number,
    totalTime: number,
    params: { duration: number; shift?: boolean }
  ) => Smoother;
} = {
  mavg: (resolution, totalTime, params) =>
    new SlidingAverage(resolution, totalTime, params),
  msum: (resolution, totalTime, params) =>
    new SlidingSum(resolution, totalTime, params),
  mmedian: (resolution, totalTime, params) =>
    new SlidingMedian(resolution, totalTime, params),
  mstddev: (resolution, totalTime, params) =>
    new SlidingStdDev(resolution, totalTime, params),
  mvariance: (resolution, totalTime, params) =>
    new SlidingVariance(resolution, totalTime, params),
  mmax: (resolution, totalTime, params) =>
    new SlidingMax(resolution, totalTime, params),
  mmin: (resolution, totalTime, params) =>
    new SlidingMin(resolution, totalTime, params),
  mexpavg: (resolution, totalTime, params) =>
    new ExponentialAverage(resolution, params),
  mgaussian: (resolution, totalTime, params) =>
    new GaussianEstimator(resolution, totalTime, params),
};

interface Sample {
  timestamp: number;
  value: number;
}

/**
 * Base class for sliding windows
 */
export abstract class SlidingAccumulator implements Smoother {
  /**
   * Samples are kept in a ring buffer with buffer[head] being the most recent
   * and buffer[(head+1)%size] being the oldest
   */
  buffer: Array<Sample | null>;

  /**
   * Number of points in window
   */
  nPoints: number;

  /**
   * Most recent item in circular buffer
   */
  head = 0;

  /**
   * Resultion in milliseconds per point
   */
  resolution = 0;

  /**
   * Time from beginning to end of window in milliseconds
   */
  lag = 0;

  /**
   * True if we should adjust for lagging algorithms by time-shifting the data
   * half a window size.
   */
  adjustLag: boolean | undefined;

  /**
   * The total time covered by the entire graph
   */
  totalTime: number;

  /**
   * Creates a new SlidingAccumulator
   * @param resolution Milliseconds per point
   * @param params Subclass-specific parameters
   */
  constructor(
    resolution: number,
    totalTime: number,
    params: { duration: number; shift?: boolean }
  ) {
    this.nPoints = Math.round(params.duration / resolution);
    this.totalTime = totalTime;
    this.buffer = new Array<Sample>(this.nPoints);
    this.resolution = resolution;
    this.lag = params.duration;
    this.adjustLag = params.shift;
  }

  /**
   * Called when a new sample arrived
   * @param sample
   */
  /*eslint-disable no-unused-vars*/
  onPush(
    /* eslint-disable-line:  @typescript-eslint/no-unused-vars */ sample: Sample
  ): void {
    // Do nothing
  }

  /**
   * Called when the ring buffer overflows and an old entry is evicted
   * @param sample
   */
  onEvict(
    /* eslint-disable-line:  @typescript-eslint/no-unused-vars */ sample: Sample
  ): void {
    // Do nothing
  }

  /**
   * Add a new sample to the sliding window handler
   * @param timestamp
   * @param value
   */
  push(timestamp: number, value: number) {
    const sample = { timestamp, value };
    this.head = (this.head + 1) % this.nPoints;
    const old = this.buffer[this.head];
    this.buffer[this.head] = { timestamp, value };
    this.onPush(sample);
    if (old) {
      this.onEvict(old);
    }
  }

  /**
   * Pushes a sample and immediately gets the update result from the algorithm.
   * @param timestamp
   * @param valuew
   * @returns The latest value at the head of the window
   */
  pushAndGet(timestamp: number, value: number): Sample {
    this.push(timestamp, value);
    return this.getValue();
  }

  getLatestTimestamp() {
    return this.buffer[this.head]?.timestamp;
  }

  makeSample(value: number): Sample {
    const shift = this.adjustLag ? this.lag / 2 : 0;
    return { timestamp: this.buffer[this.head]!.timestamp - shift, value };
  }

  protected abstract _getValue(): Sample;

  /**
   * Return the latest calculated value
   * @returns
   */
  getValue(): Sample {
    // Clean out stale entries
    const latest = this.buffer[this.head]!.timestamp;
    for (let i = 0; i < this.nPoints; ++i) {
      const p = (i + 1) % this.nPoints;
      const s = this.buffer[p];
      if (!s) {
        continue;
      }
      if (s.timestamp >= latest - this.lag) {
        break;
      }
      this.onEvict(s);
      this.buffer[p] = null;
    }
    return this._getValue();
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

  _getValue(): Sample {
    return this.makeSample(this.sum / this.count);
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

  _getValue(): Sample {
    return this.makeSample(this.count);
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

  _getValue(): Sample {
    return this.makeSample(this.sum);
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

  _getValue(): Sample {
    return this.makeSample(this.heap.root() != null ? this.heap.root()! : NaN);
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

  _getValue(): Sample {
    return this.makeSample(this.heap.root() != null ? this.heap.root()! : NaN);
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
    if (this.count >= this.nPoints) {
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

  _getValue(): Sample {
    return this.makeSample(this.getVariance());
  }
}

/**
 * Sliding standard deviation
 */
export class SlidingStdDev extends SlidingVariance {
  _getValue(): Sample {
    return this.makeSample(Math.sqrt(this.getVariance()));
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
    const node = this.map.findKey(value)?.getValue();
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
   * Make sure the invariant described above is maintained.
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

  _getValue(): Sample {
    if (this.maxHeap.size === 0) {
      return this.makeSample(NaN);
    }

    if (this.minHeap.size === this.maxHeap.size) {
      return this.makeSample((this.minHeap.top()! + this.maxHeap.top()!) / 2);
    }
    return this.makeSample(this.maxHeap.top()!);
  }
}

/**
 * Simple exponential smoother. s(n+1) = s(n) * alpha + x * (1 - alpha)
 */
export class ExponentialAverage implements Smoother {
  alpha: number;
  current = NaN;
  latestTimestamp = 0;
  lag: number;

  constructor(
    resolution: number,
    params: { duration: number; shift?: boolean }
  ) {
    this.alpha = 1 - Math.exp(-resolution / params.duration);
    this.lag = params.shift ? params.duration : 0;
  }

  push(timestamp: number, value: number) {
    this.current = isNaN(this.current)
      ? value
      : (1 - this.alpha) * this.current + this.alpha * value;
    this.latestTimestamp = timestamp;
  }

  getValue(): Sample {
    return {
      value: this.current,
      timestamp: this.latestTimestamp - this.lag / 2,
    };
  }

  pushAndGet(timestamp: number, value: number): Sample {
    this.push(timestamp, value);
    return this.getValue();
  }
}

const sqrt2pi = Math.sqrt(2 * Math.PI);

export class GaussianEstimator extends SlidingAccumulator {
  sum = 0.0;
  weightedSum = 0.0;
  h: number;
  windowSize: number;
  // gaussianCoeff: Array<number>;

  constructor(
    resolution: number,
    totalTime: number,
    params: { duration: number }
  ) {
    // Since the gaussian decays asymptotically, we expand the
    // window to catch more of the tails. The factor 2 is rather arbitrarily chosen
    // but seems to work.
    const windowSize = params.duration;
    super(resolution, params.duration * 2, params);
    this.windowSize = windowSize;

    // Calculate the smoothing factor, which is really the standard deviation.
    // We use the fact that the interval -2 * sigma to 2 * sigma from the mean
    // covers about 95% of samples following normal distribution. For the purpose
    // of our kernel, it means that the sliding window covers about 95% of the
    // area under the kernel function graph.
    this.h = params.duration / 2;

    // Precalculate gaussian coefficients

    /*  this.gaussianCoeff = new Array(this.nPoints);
    for (let i = 0; i < windowSize; ++i) {
      this.gaussianCoeff[i] = this.gaussian(
        i / this.nPoints - this.nPoints / 2
      );
    } */
  }

  _getValue(): Sample {
    // Implementation note: It migth be more efficient to calculate this in the frequency
    // domain instead, as what we're doing is basically a convolution. However, the point
    // count is probably too low for that to make any meaningful difference.
    let sum = 0;
    let wSum = 0;
    const x = this.buffer[this.head]!.timestamp;
    for (let i = 0; i < this.nPoints; i++) {
      const sample = this.buffer[(this.head + i + 1) % this.nPoints];
      if (sample == null) {
        continue;
      }
      //const g = this.gaussianCoeff[i];
      const g = this.gaussian(sample.timestamp - x + this.lag / 2);
      sum += g;
      wSum += g * sample.value;
    }
    return this.makeSample(wSum / sum);
  }

  gaussian(x: number): number {
    return (
      (1 / (sqrt2pi * this.h)) * Math.exp(-(x * x) / (2 * this.h * this.h))
    );
  }
}
