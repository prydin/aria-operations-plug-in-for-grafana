import { DataFrame, FieldType, Labels, MutableDataFrame } from '@grafana/data';
import { AggregationSpec, KeyValue } from 'types';

const statProducers: KeyValue = {
  avg: (acc: Accumulator) => acc.getAverage(),
  stddev: (acc: Accumulator) => acc.getStandardDeviation(),
  min: (acc: Accumulator) => acc.getMin(),
  max: (acc: Accumulator) => acc.getMax(),
  sum: (acc: Accumulator) => acc.getSum(),
  count: (acc: Accumulator) => acc.getCount(),
  variance: (acc: Accumulator) => acc.getVariance(),
};

export class Accumulator {
  sum = 0;
  count = 0;
  sumOfSquares = 0;
  max: number = Number.MIN_VALUE;
  min: number = Number.MAX_VALUE;

  aaddDataPoint(value: number) {
    this.sum += value;
    this.count += 1;
    this.sumOfSquares += value * value;
    this.max = Math.max(this.max, value);
    this.min = Math.min(this.min, value);
  }

  getAverage(): number {
    return this.sum !== 0 ? this.sum / this.count : 0;
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
    if (this.count < 2) {
      return 0;
    }
    const avg = this.getAverage();
    return this.sumOfSquares / this.count - avg * avg;
  }

  getStandardDeviation(): number {
    return Math.sqrt(this.getVariance());
  }
}

export class Bucket {
  accumulators: Map<number, Accumulator> = new Map();

  addDataPoint(timestamp: number, value: number) {
    let accumulator = this.accumulators.get(timestamp);
    if (!accumulator) {
      accumulator = new Accumulator();
      this.accumulators.set(timestamp, accumulator);
    }
    accumulator.aaddDataPoint(value);
  }

  getResults(): Map<number, Accumulator> {
    return this.accumulators;
  }
}

export class Stats {
  buckets: Map<string, Bucket> = new Map();

  add(timestamps: number[], values: number[], properties: Map<string, string>) {
    const key = JSON.stringify(Array.from(properties?.entries() || {}));
    console.log('Key', key);
    for (const idx in timestamps) {
      const ts = timestamps[idx];
      const value = values[idx];
      let slot = this.buckets.get(key);
      if (!slot) {
        slot = new Bucket();
        this.buckets.set(key, slot);
      }
      slot.addDataPoint(ts, value);
    }
  }

  toFrames(refId: string, aggregation: AggregationSpec): DataFrame[] {
    const produce = statProducers[aggregation.type];
    if (!produce) {
      throw 'Internal error: Producer ' + aggregation.type + ' not found';
    }
    const frames: MutableDataFrame[] = [];
    let statKey = '<undefined>';
    for (const [key, bucket] of this.buckets) {
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
      for (const [timestamp, data] of bucket.accumulators) {
        frame.add({ Time: timestamp, Value: produce(data) });
      }
      frames.push(frame);
    }
    return frames;
  }
}
