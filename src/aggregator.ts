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

import { DataFrame, FieldType, Labels, MutableDataFrame } from '@grafana/data';
import { Smoother } from 'sliding';
import { AggregationSpec, KeyValue } from 'types';
const TDigest = require('tdigest').TDigest;

const statProducers: KeyValue = {
  avg: (acc: Accumulator) => acc.getAverage(),
  stddev: (acc: Accumulator) => acc.getStandardDeviation(),
  min: (acc: Accumulator) => acc.getMin(),
  max: (acc: Accumulator) => acc.getMax(),
  sum: (acc: Accumulator) => acc.getSum(),
  count: (acc: Accumulator) => acc.getCount(),
  variance: (acc: Accumulator) => acc.getVariance(),
  percentile: (acc: Accumulator) => acc.getPercentile(),
};

/**
 * Statistics accumulator for calculating average, variance, standard deviation and percentiles
 */
export class Accumulator {
  sum = 0;
  count = 0;
  max: number = Number.MIN_VALUE;
  min: number = Number.MAX_VALUE;
  vAcc = 0;
  avg = 0;
  wantDigest = false;
  digest: any;
  percentile? = 0.0;

  constructor(wantPercentile: boolean, percentile?: number) {
    this.wantDigest = wantPercentile;
    if (wantPercentile) {
      this.digest = new TDigest();
    }
    this.percentile = percentile;
  }

  /**
   * Adds a new sample to the accumulator
   * @param value
   */
  addDataPoint(value: number) {
    this.sum += value;
    this.count++;
    this.max = Math.max(this.max, value);
    this.min = Math.min(this.min, value);
    const avg = this.sum / this.count;
    this.vAcc += (value - this.avg) * (value - avg);
    this.avg = avg;
    if (this.wantDigest) {
      this.digest.push(value);
    }
  }

  getAverage(): number {
    return this.avg;
  }

  getCount(): number {
    return this.count;
  }

  getSum(): number {
    return this.sum;
  }

  getMin(): number {
    return this.min;
  }

  getMax(): number {
    return this.max;
  }

  getVariance(): number {
    return this.count > 1 ? this.vAcc / (this.count - 1) : 0;
  }

  getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }

  getPercentile(): number {
    this.digest.compress();
    return this.digest.percentile(this.percentile! / 100);
  }
}

/**
 * Holds the accumulators for a specific point in time.
 */
export class Bucket {
  accumulators: Map<number, Accumulator> = new Map();
  wantPercentile = false;
  percentile: number | undefined = 0.0;

  constructor(wantPercentile: boolean, percentile: number) {
    this.percentile = percentile;
    this.wantPercentile = wantPercentile;
  }

  /**
   * Adds a new sample
   * @param timestamp
   * @param value
   */
  addDataPoint(timestamp: number, value: number) {
    let accumulator = this.accumulators.get(timestamp);
    if (!accumulator) {
      accumulator = new Accumulator(this.wantPercentile, this.percentile);
      this.accumulators.set(timestamp, accumulator);
    }
    accumulator.addDataPoint(value);
  }

  /**
   * Returns the accumulators for each point in time, sorted by time.
   * @returns
   */
  getResults(): Map<number, Accumulator> {
    // If datapoints are missing in some time series, it's possible that some
    // values are inserted out of order. To prevent strange graph artifacts,
    // we sort the accumulators according to the timestamps before returning them.
    return new Map([...this.accumulators.entries()].sort());
  }
}

/**
 * Statistics accumulator for an entire composite time-series
 */
export class Stats {
  wantPercentile = false;
  percentile = 0.0;
  constructor(aggregation: AggregationSpec) {
    if (aggregation.type === 'percentile') {
      this.wantPercentile = true;
      this.percentile = aggregation.parameter ? aggregation.parameter : 0.0;
    }
  }
  buckets: Map<string, Bucket> = new Map();

  /**
   * Adds a sample and updates the accumulators
   * @param timestamps
   * @param values
   * @param properties
   */
  add(timestamps: number[], values: number[], properties: Map<string, string>) {
    const key = JSON.stringify(Array.from(properties?.entries() || {}));
    for (const idx in timestamps) {
      const ts = timestamps[idx];
      const value = values[idx];
      let slot = this.buckets.get(key);
      if (!slot) {
        slot = new Bucket(this.wantPercentile, this.percentile);
        this.buckets.set(key, slot);
      }
      slot.addDataPoint(ts, value);
    }
  }

  /**
   *
   * @param refId Converts the computed statistical key figures. If slidingWindowFactoey is
   * non-null, the specified sliding window is applied to the resulting time series.
   * @param aggregation
   * @param slidingWindowFactory
   * @returns
   */
  toFrames(
    refId: string,
    aggregation: AggregationSpec,
    slidingWindowFactory: (() => Smoother) | null
  ): DataFrame[] {
    const produce = statProducers[aggregation.type];
    if (!produce) {
      throw 'Internal error: Producer ' + aggregation.type + ' not found';
    }
    const frames: MutableDataFrame[] = [];
    let statKey = '<undefined>';
    for (const [key, bucket] of this.buckets) {
      const slidingWindow = slidingWindowFactory
        ? slidingWindowFactory()
        : null;
      const labels: Labels = {};
      if (key) {
        const properties = new Map<string, string>(JSON.parse(key));
        for (const [propKey, propValue] of properties) {
          if (propKey === '$statKey') {
            statKey = propValue;
          } else {
            labels[propKey] = propValue;
          }
        }
      }
      const frame = new MutableDataFrame({
        refId: refId,
        name: statKey,
        fields: [
          { name: 'Time', type: FieldType.time },
          { name: 'Value', type: FieldType.number, labels },
        ],
      });
      for (const [timestamp, data] of bucket.getResults()) {
        const value = produce(data);
        const point = slidingWindow
          ? slidingWindow.pushAndGet(timestamp, value)
          : value;
        frame.add({ Time: timestamp, Value: point });
      }
      frames.push(frame);
    }
    return frames;
  }
}
